-- ───────────────────────────── Alumia: os INTERESSES da pessoa na regra "Em roda" (onda 11, frente 11F) ─────────────────────────────
-- Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
--
-- A regra "Em roda" (20261113-alumia-o7-linha.sql) ganha um ingrediente ESCOLHIDO pela pessoa: o questionário de interesses do
-- cadastro (e dos Ajustes). As respostas ficam SÓ no aparelho (interesse político é dado sensível, LGPD art. 5º, II, e art. 11) e
-- chegam aqui como um filtro aberto a cada leitura, igual às linhas montadas: o banco usa e esquece. Esta migração não cria
-- tabela nem coluna; nenhuma função daqui grava nada (a montagem é `stable`; a linha só passa pelo freio de leitura de sempre).
--
-- O ingrediente, como está escrito na tela "Como a linha é montada":
--   - Dentro de cada bloco de 6 horas, vêm antes as publicações ligadas aos interesses: de um tipo que a pessoa marcou (chamado,
--     discussão, dúvida…), com um #tema das pautas dela, de uma comunidade que ela marcou, das comunidades de estudo (se marcou
--     estudo) ou dos núcleos dela (se marcou núcleo). A roda continua valendo dentro desse grupo e dentro do resto.
--   - Para quem marcou que quer MAIS CONTEÚDO do que conversa, as conversas paralelas descem para o fim do bloco, sem sumir:
--     publicação que cita outra, que responde a um post de fora ou que começa chamando alguém pelo @, escrita por quem ela não
--     segue, fora das comunidades e dos núcleos dela.
--   - Sem interesses (pulou o questionário, ou apagou), a ordem é exatamente a de antes: o teste compara as duas, tela a tela.
--   - O que NÃO entra continua não entrando: curtida, clique, leitura, número de respostas, quem a pessoa é.
--
-- Funções novas ao lado das antigas (as de 20261113 continuam iguais, e o aparelho sem interesses continua chamando elas):
--   public.rede_o11_linha(aba, modo, filtro, cursor, interesses) e public.rede_o11_desde(aba, desde, filtro, interesses).
-- Tudo no esquema interno, security definer com search_path fixo, a porta da entrada na primeira linha de cada função pública.
-- Pode rodar mais de uma vez, sem apagar dado nenhum. Roda DEPOIS de 20261113-alumia-o7-linha.sql.
-- Teste: node --import ./scripts/carregar-ts.mjs scripts/testar-alumia-o11-interesses.mjs

-- ── 1. O filtro aberto dos interesses ─────────────────────────────────────────────────────────────────────────────────────

/**
 * Confere e arruma os interesses que o aparelho manda. Chaves aceitas (todas opcionais; qualquer uma que casar põe o post no
 * grupo dos interesses, com "ou"):
 *   tipos        tipos de post (post, discussao, duvida, chamado, enquete, aviso);
 *   tags         até 30 #temas;
 *   comunidades  até 20 comunidades (slug);
 *   estudo       true = as comunidades das disciplinas (estudo, ENEM);
 *   nucleos      true = os núcleos de que a pessoa faz parte;
 *   conteudo     true = a pessoa quer mais conteúdo do que conversa (as conversas paralelas descem).
 * Chave desconhecida ou valor torto: 'invalido:interesses'. Devolve '{}' quando nada sobra. Nada disso é guardado.
 */
create or replace function interno.rede_o11_interesses(p jsonb) returns jsonb language plpgsql stable security definer set search_path = interno, pg_temp as $$
declare f jsonb := coalesce(p, '{}'::jsonb); v jsonb := '{}'::jsonb; k text; v_lista text[];
begin
  if jsonb_typeof(f) <> 'object' then perform interno.erro('invalido:interesses'); end if;
  for k in select jsonb_object_keys(f) loop
    if k not in ('tipos', 'tags', 'comunidades', 'estudo', 'nucleos', 'conteudo') then perform interno.erro('invalido:interesses'); end if;
  end loop;
  if f ? 'tipos' then
    if jsonb_typeof(f -> 'tipos') <> 'array' then perform interno.erro('invalido:interesses'); end if;
    select coalesce(array_agg(distinct x order by x), '{}') into v_lista from jsonb_array_elements_text(f -> 'tipos') x;
    if not v_lista <@ array['post', 'discussao', 'duvida', 'chamado', 'enquete', 'aviso'] then perform interno.erro('invalido:interesses'); end if;
    if cardinality(v_lista) > 0 then v := v || jsonb_build_object('tipos', to_jsonb(v_lista)); end if;
  end if;
  if f ? 'tags' then
    if jsonb_typeof(f -> 'tags') <> 'array' or jsonb_array_length(f -> 'tags') > 30 then perform interno.erro('invalido:interesses'); end if;
    select coalesce(array_agg(distinct interno.rede3_desc_tag_norm(x) order by interno.rede3_desc_tag_norm(x)), '{}') into v_lista from jsonb_array_elements_text(f -> 'tags') x;
    v_lista := array_remove(v_lista, null);
    if exists (select 1 from unnest(v_lista) s where s !~ '^[a-z0-9_]{2,40}$') then perform interno.erro('invalido:interesses'); end if;
    if cardinality(v_lista) > 0 then v := v || jsonb_build_object('tags', to_jsonb(v_lista)); end if;
  end if;
  if f ? 'comunidades' then
    if jsonb_typeof(f -> 'comunidades') <> 'array' or jsonb_array_length(f -> 'comunidades') > 20 then perform interno.erro('invalido:interesses'); end if;
    select coalesce(array_agg(distinct lower(x) order by lower(x)), '{}') into v_lista from jsonb_array_elements_text(f -> 'comunidades') x;
    if exists (select 1 from unnest(v_lista) s where s !~ '^[a-z0-9-]{2,60}$') then perform interno.erro('invalido:interesses'); end if;
    if cardinality(v_lista) > 0 then v := v || jsonb_build_object('comunidades', to_jsonb(v_lista)); end if;
  end if;
  foreach k in array array['estudo', 'nucleos', 'conteudo'] loop
    if f ? k then
      if jsonb_typeof(f -> k) <> 'boolean' then perform interno.erro('invalido:interesses'); end if;
      if (f ->> k)::boolean then v := v || jsonb_build_object(k, true); end if;
    end if;
  end loop;
  return v;
end $$;

/** O post casa com algum interesse? Só olha o post e as ESCOLHAS da pessoa (núcleos dela): nada de reação, leitura ou contagem. */
create or replace function interno.rede_o11_liga(p interno.rede_posts, i jsonb, p_quem uuid) returns boolean
language sql stable security definer set search_path = interno, pg_temp as $$
  select coalesce(i ? 'tipos' and p.tipo in (select jsonb_array_elements_text(i -> 'tipos')), false)
      or coalesce(i ? 'tags' and interno.rede3_desc_tags(p.titulo, p.texto, p.corpo) && array(select jsonb_array_elements_text(i -> 'tags')), false)
      or coalesce(i ? 'comunidades' and p.comunidade in (select jsonb_array_elements_text(i -> 'comunidades')), false)
      or coalesce(i ? 'estudo' and exists (select 1 from rede_comunidades c where c.slug = p.comunidade and c.categoria = 'disciplinas'), false)
      or coalesce(i ? 'nucleos' and p.nucleo is not null and interno.rede2_no_nucleo(p.nucleo, p_quem), false)
$$;

/**
 * É uma "conversa paralela" para esta pessoa? Publicação que cita outra, que responde a um post de fora (Fediverso) ou que começa
 * chamando alguém pelo @, escrita por quem ela não segue, fora das comunidades e dos núcleos dela. Só olha o post e as escolhas
 * dela (quem segue, onde está): nenhum número de respostas entra.
 */
create or replace function interno.rede_o11_paralela(p interno.rede_posts, p_quem uuid) returns boolean
language sql stable security definer set search_path = interno, pg_temp as $$
  select (p.quote_of is not null or p.cita is not null or p.resposta_a_remota is not null or ltrim(coalesce(p.texto, '')) ~ '^@[A-Za-z0-9_]')
    and p.autor is distinct from p_quem
    and not exists (select 1 from rede_seguindo s where s.quem = p_quem and s.segue = p.autor and not s.pendente)
    and not coalesce(p.comunidade is not null and (
          exists (select 1 from rede_comunidade_membros m where m.comunidade = p.comunidade and m.usuario = p_quem and m.situacao = 'ativo')
          or exists (select 1 from rede_comunidades_seguidas c where c.usuario = p_quem and c.comunidade = p.comunidade)), false)
    and not coalesce(p.nucleo is not null and interno.rede2_no_nucleo(p.nucleo, p_quem), false)
$$;

-- ── 2. A regra com o ingrediente escolhido ────────────────────────────────────────────────────────────────────────────────

/**
 * A regra "Em roda" (interno.rede_o7_montar) com os interesses. Com p_interesses nulo ou vazio, todo post fica no mesmo grupo e a
 * ordem é a de rede_o7_montar, item por item (o teste compara). Com interesses, dentro de cada bloco: primeiro o grupo dos
 * interesses (motivo 'interesse'), depois o resto, e, para quem pediu mais conteúdo, as conversas paralelas no fim do bloco.
 * Dentro de cada grupo valem "quem ajudou" e a roda por pessoa; o teto de 3 por tela continua igual.
 */
create or replace function interno.rede_o11_montar(p_aba text, p_filtro jsonb, p_quem uuid, p_ate timestamptz, p_inicio timestamptz default null, p_sem_meus boolean default false, p_interesses jsonb default null)
returns table (pos integer, tela integer, id uuid, porque text, criado_em timestamptz, total integer)
language plpgsql stable security definer set search_path = interno, pg_temp as $$
#variable_conflict use_column
declare
  n jsonb := interno.rede_o7_numeros();
  v_inicio timestamptz := greatest(coalesce(p_inicio, '-infinity'::timestamptz), p_ate - make_interval(days => (n ->> 'janela_dias')::integer));
  i jsonb := coalesce(p_interesses, '{}'::jsonb);
  v_com boolean := coalesce(p_interesses, '{}'::jsonb) - 'conteudo' <> '{}'::jsonb or coalesce((p_interesses ->> 'conteudo')::boolean, false);
  v_conteudo boolean := coalesce((p_interesses ->> 'conteudo')::boolean, false);
  v_seguidas text[] := '{}';
  v_ids uuid[]; v_autores uuid[]; v_porques text[]; v_tempos timestamptz[];
  v_total integer; v_usado boolean[]; v_resta integer; v_tela integer := 0; v_na_tela integer; v_cont jsonb; v_k text; v_pos integer := 0; j integer;
  c_tela constant integer := (n ->> 'tela')::integer; c_teto constant integer := (n ->> 'teto')::integer;
begin
  if p_aba = 'temas' then
    select coalesce(array_agg(s.tag), '{}') into v_seguidas from rede_alumia_seguir_tag s where s.usuario = p_quem;
  end if;
  select coalesce(array_agg(o.id order by o.ord), '{}'), coalesce(array_agg(o.autor order by o.ord), '{}'),
         coalesce(array_agg(o.porque order by o.ord), '{}'), coalesce(array_agg(o.criado_em order by o.ord), '{}')
    into v_ids, v_autores, v_porques, v_tempos
  from (
    with c as (
      -- 1. O que entra (igual à regra de 20261113), com o grupo do ingrediente escolhido.
      select p.id, coalesce(p.autor, p.id) as autor, p.criado_em, p.tipo, p.fixado, p.aceita,
        case when not v_com then 0
             when interno.rede_o11_liga(p, i, p_quem) then 0
             when v_conteudo and interno.rede_o11_paralela(p, p_quem) then 2
             else 1 end as grupo
      from rede_posts p
      where p.resposta_a is null and p.apagado_em is null and p.criado_em <= p_ate and p.criado_em > v_inicio
        and (not p_sem_meus or p.autor is distinct from p_quem)
        and interno.rede_o7_cabe(p, p_aba, p_filtro, p_quem, v_seguidas)
      order by p.criado_em desc, p.id desc
      limit (n ->> 'maximo')::integer
    ), b as (
      select c.id, c.autor, c.criado_em, c.grupo,
        (c.tipo = 'aviso' and c.fixado) as aviso,
        ch.inicio,
        (ch.post is not null and not ch.cancelado and ch.situacao <> 'cancelado'
          and ch.inicio > p_ate and ch.inicio <= p_ate + make_interval(hours => (n ->> 'perto_horas')::integer)) as perto,
        (exists (select 1 from rede_posts r
                 where r.id in (c.aceita, (select a.resposta from rede_ajudou a where a.raiz = c.id))
                   and r.autor is distinct from c.autor and not r.oculto and not r.retido and r.apagado_em is null)
         and (select count(distinct r.autor) from rede_posts r
              where r.resposta_a = c.id and r.autor is distinct from c.autor and not r.oculto and not r.retido and r.apagado_em is null)
             >= (n ->> 'ajudou_piso')::integer) as ajudou,
        floor(extract(epoch from c.criado_em) / ((n ->> 'bloco_horas')::integer * 3600))::bigint as bloco
      from c left join rede_chamados ch on ch.post = c.id
    ), alto as (
      select b.id from b where b.aviso order by b.criado_em desc, b.id desc limit (n ->> 'avisos')::integer
    ), perto as (
      select b.id from b where b.perto and b.id not in (select alto.id from alto) order by b.inicio, b.id limit (n ->> 'atos')::integer
    ), resto as (
      -- 4. Dentro de cada bloco: o grupo (interesses, resto, conversas paralelas), quem ajudou e a roda dentro do grupo.
      select b.*, row_number() over (partition by b.bloco, b.grupo, b.autor order by b.criado_em desc, b.id desc) as volta
      from b where b.id not in (select alto.id from alto) and b.id not in (select perto.id from perto)
    )
    select b.id, b.autor, b.criado_em, 'aviso'::text as porque, row_number() over (order by b.criado_em desc, b.id desc) as ord
      from b where b.id in (select alto.id from alto)
    union all
    select b.id, b.autor, b.criado_em, 'ato', 1000 + row_number() over (order by b.inicio, b.id)
      from b where b.id in (select perto.id from perto)
    union all
    select r.id, r.autor, r.criado_em,
           case when r.ajudou then 'ajudou' when v_com and r.grupo = 0 then 'interesse' else 'roda' end,
           2000 + row_number() over (order by r.bloco desc, r.grupo, r.ajudou desc, r.volta, r.criado_em desc, r.id desc)
      from resto r
  ) o;

  v_total := cardinality(v_ids);
  v_resta := v_total;
  v_usado := array_fill(false, array[greatest(v_total, 1)]);
  -- 5. O teto por tela, igual ao de antes.
  while v_resta > 0 loop
    v_tela := v_tela + 1;
    v_na_tela := 0;
    v_cont := '{}'::jsonb;
    for j in 1 .. v_total loop
      exit when v_na_tela >= c_tela;
      continue when v_usado[j];
      v_k := v_autores[j]::text;
      continue when coalesce((v_cont ->> v_k)::integer, 0) >= c_teto;
      v_usado[j] := true;
      v_cont := v_cont || jsonb_build_object(v_k, coalesce((v_cont ->> v_k)::integer, 0) + 1);
      v_na_tela := v_na_tela + 1;
      v_resta := v_resta - 1;
      v_pos := v_pos + 1;
      pos := v_pos; tela := v_tela; id := v_ids[j]; porque := v_porques[j]; criado_em := v_tempos[j]; total := v_total;
      return next;
    end loop;
  end loop;
end $$;

-- ── 3. A linha e o "enquanto você esteve fora", com os interesses ─────────────────────────────────────────────────────────

/**
 * Uma tela da linha, como public.rede_roda_linha, com os interesses que o aparelho manda (p_interesses, ver
 * interno.rede_o11_interesses). Na ordem de chegada os interesses não mudam nada. Devolve o mesmo {itens, proximo, modo,
 * instante, na_regra, regra}; cada item leva 'o7_porque' ('interesse' quando subiu pelo ingrediente escolhido).
 */
create or replace function public.rede_o11_linha(p_aba text, p_modo text default 'roda', p_filtro jsonb default null, p_cursor text default null, p_interesses jsonb default null) returns jsonb
language plpgsql volatile security definer set search_path = interno, pg_temp as $$
declare
  v uuid; n jsonb := interno.rede_o7_numeros(); f jsonb; i jsonb; v_aba text; v_seguidas text[] := '{}';
  v_modo text := coalesce(nullif(p_modo, ''), 'roda'); v_tipo text; v_ate timestamptz := now(); v_tela integer := 1;
  v_t timestamptz; v_id uuid; v_ids uuid[] := '{}'; v_porques text[] := '{}'; v_total integer := 0; v_mais boolean := false;
  v_velho_t timestamptz; v_velho_id uuid; v_itens jsonb; v_prox text; v_lim integer := (n ->> 'tela')::integer; v_regra boolean;
begin
  perform interno.alumia_porta();
  perform interno.aberta('comunidade');
  v := interno.eu();
  if not interno.rede2_membro(v) then perform interno.erro('consentimento'); end if;
  perform interno.limite('rede2_ler', 600, 60);
  if v_modo not in ('roda', 'chegada') then perform interno.erro('invalido:modo'); end if;
  f := interno.rede_o7_filtro(p_filtro);
  i := interno.rede_o11_interesses(p_interesses);
  if p_aba = 'temas' then
    v_aba := 'temas';
    select coalesce(array_agg(s.tag), '{}') into v_seguidas from rede_alumia_seguir_tag s where s.usuario = v;
  elsif p_aba in ('seguindo', 'comunidades', 'tudo') or p_aba like 'c:%' then
    v_aba := interno.rede_aba(p_aba, v);
  else
    perform interno.erro('invalido:aba');
  end if;

  if nullif(p_cursor, '') is not null then
    begin
      v_tipo := split_part(p_cursor, '|', 1);
      if v_tipo = 'r' then
        v_ate := least(split_part(p_cursor, '|', 2)::timestamptz, now());
        v_tela := split_part(p_cursor, '|', 3)::integer;
        if v_tela < 1 or v_tela > 100 then raise exception 'tela'; end if;
      elsif v_tipo = 'd' then
        v_t := split_part(p_cursor, '|', 2)::timestamptz;
        v_id := split_part(p_cursor, '|', 3)::uuid;
      else
        raise exception 'tipo';
      end if;
    exception when others then
      perform interno.erro('invalido:cursor');
    end;
  end if;
  v_regra := v_modo = 'roda' and coalesce(v_tipo, 'r') = 'r';

  if v_regra then
    select coalesce(array_agg(m.id order by m.pos) filter (where m.tela = v_tela), '{}'),
           coalesce(array_agg(m.porque order by m.pos) filter (where m.tela = v_tela), '{}'),
           coalesce(max(m.total), 0), coalesce(bool_or(m.tela > v_tela), false),
           min(m.criado_em)
      into v_ids, v_porques, v_total, v_mais, v_velho_t
    from interno.rede_o11_montar(v_aba, f, v, v_ate, null, false, i) m;
    if v_mais then
      v_prox := 'r|' || v_ate::text || '|' || (v_tela + 1)::text;
    else
      -- Acabou a regra: daqui para trás, ordem de chegada (os interesses não entram).
      if v_total >= (n ->> 'maximo')::integer then
        select m.id into v_velho_id from interno.rede_o11_montar(v_aba, f, v, v_ate, null, false, i) m where m.criado_em = v_velho_t order by m.id limit 1;
      else
        v_velho_t := v_ate - make_interval(days => (n ->> 'janela_dias')::integer);
        v_velho_id := 'ffffffff-ffff-ffff-ffff-ffffffffffff';
      end if;
      if exists (select 1 from rede_posts p where p.resposta_a is null and p.apagado_em is null and (p.criado_em, p.id) < (v_velho_t, v_velho_id)
                   and interno.rede_o7_cabe(p, v_aba, f, v, v_seguidas)) then
        v_prox := 'd|' || v_velho_t::text || '|' || v_velho_id::text;
      end if;
    end if;
  else
    select coalesce(array_agg(b.id order by b.criado_em desc, b.id desc), '{}') into v_ids
    from (select p.id, p.criado_em from rede_posts p
          where p.resposta_a is null and p.apagado_em is null
            and (v_t is null or (p.criado_em, p.id) < (v_t, v_id))
            and interno.rede_o7_cabe(p, v_aba, f, v, v_seguidas)
          order by p.criado_em desc, p.id desc limit v_lim + 1) b;
    if cardinality(v_ids) > v_lim then
      v_ids := v_ids[1:v_lim];
      select 'd|' || p.criado_em::text || '|' || p.id::text into v_prox from rede_posts p where p.id = v_ids[v_lim];
    end if;
  end if;

  select coalesce(jsonb_agg(interno.rede_post_v2(r, v) || jsonb_build_object('o7_porque', case when v_regra then v_porques[array_position(v_ids, r.id)] else 'chegada' end)
                            order by array_position(v_ids, r.id)), '[]'::jsonb)
    into v_itens from rede_posts r where r.id = any (v_ids);
  return jsonb_build_object('itens', v_itens, 'proximo', v_prox, 'modo', v_modo, 'instante', v_ate, 'na_regra', v_regra, 'regra', n);
end $$;

/** "Enquanto você esteve fora" (public.rede_roda_desde) com os interesses: os primeiros pela mesma regra com o ingrediente. */
create or replace function public.rede_o11_desde(p_aba text, p_desde timestamptz, p_filtro jsonb default null, p_interesses jsonb default null) returns jsonb
language plpgsql volatile security definer set search_path = interno, pg_temp as $$
declare v uuid; n jsonb := interno.rede_o7_numeros(); f jsonb; i jsonb; v_aba text; v_ate timestamptz := now(); v_ids uuid[]; v_porques text[]; v_total integer; v_itens jsonb;
begin
  perform interno.alumia_porta();
  perform interno.aberta('comunidade');
  v := interno.eu();
  if not interno.rede2_membro(v) then perform interno.erro('consentimento'); end if;
  perform interno.limite('rede2_ler', 600, 60);
  if p_desde is null or p_desde >= v_ate then return jsonb_build_object('novos', 0, 'destaques', '[]'::jsonb, 'desde', p_desde); end if;
  f := interno.rede_o7_filtro(p_filtro);
  i := interno.rede_o11_interesses(p_interesses);
  if p_aba = 'temas' then v_aba := 'temas';
  elsif p_aba in ('seguindo', 'comunidades', 'tudo') or p_aba like 'c:%' then v_aba := interno.rede_aba(p_aba, v);
  else perform interno.erro('invalido:aba');
  end if;
  select coalesce(array_agg(m.id order by m.pos) filter (where m.pos <= (n ->> 'fora_destaques')::integer), '{}'),
         coalesce(array_agg(m.porque order by m.pos) filter (where m.pos <= (n ->> 'fora_destaques')::integer), '{}'),
         coalesce(max(m.total), 0)
    into v_ids, v_porques, v_total
  from interno.rede_o11_montar(v_aba, f, v, v_ate, p_desde, true, i) m;
  select coalesce(jsonb_agg(interno.rede_post_v2(r, v) || jsonb_build_object('o7_porque', v_porques[array_position(v_ids, r.id)])
                            order by array_position(v_ids, r.id)), '[]'::jsonb)
    into v_itens from rede_posts r where r.id = any (v_ids);
  return jsonb_build_object('novos', v_total, 'destaques', v_itens,
    'desde', greatest(p_desde, v_ate - make_interval(days => (n ->> 'janela_dias')::integer)));
end $$;

-- ── 4. Permissões ─────────────────────────────────────────────────────────────────────────────────────────────────────────
revoke all on function interno.rede_o11_interesses(jsonb), interno.rede_o11_liga(interno.rede_posts, jsonb, uuid),
  interno.rede_o11_paralela(interno.rede_posts, uuid),
  interno.rede_o11_montar(text, jsonb, uuid, timestamptz, timestamptz, boolean, jsonb) from public;
revoke all on function public.rede_o11_linha(text, text, jsonb, text, jsonb), public.rede_o11_desde(text, timestamptz, jsonb, jsonb) from public;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on function interno.rede_o11_interesses(jsonb), interno.rede_o11_liga(interno.rede_posts, jsonb, uuid),
      interno.rede_o11_paralela(interno.rede_posts, uuid),
      interno.rede_o11_montar(text, jsonb, uuid, timestamptz, timestamptz, boolean, jsonb) from anon, authenticated;
    revoke all on function public.rede_o11_linha(text, text, jsonb, text, jsonb), public.rede_o11_desde(text, timestamptz, jsonb, jsonb) from anon, authenticated;
    grant execute on function public.rede_o11_linha(text, text, jsonb, text, jsonb), public.rede_o11_desde(text, timestamptz, jsonb, jsonb) to authenticated, service_role;
  end if;
end $$;

-- ── 5. A porta ────────────────────────────────────────────────────────────────────────────────────────────────────────────
do $$
declare v jsonb := interno.alumia_trancar();
begin
  if jsonb_array_length(v -> 'abertas') > 0 then
    raise warning 'alumia_trancar: função sem porta: %', v -> 'abertas';
  end if;
end $$;
select interno.alumia_trancar();
