-- ───────────────────────────── Alumia: a linha com REGRA ABERTA ("Em roda"), novembro de 2026 ─────────────────────────────
-- Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
--
-- A linha da Alumia sempre foi em ordem de chegada. Com mais gente, só a ordem de chegada embaralha: quem publica dez vezes
-- seguidas ocupa a tela, e o chamado de amanhã some debaixo da conversa de hoje. Esta migração acrescenta UMA regra de
-- arrumação, igual para todo mundo, escrita em português na tela "Como a linha é montada" e feita aqui exatamente como está lá:
--
--   1. O QUE ENTRA: os posts de primeiro nível da aba (ou da linha que a pessoa montou), dos últimos 7 dias, que ela pode ver e
--      não silenciou. No máximo os 300 mais novos.
--   2. NO ALTO: até 2 avisos fixados pela moderação (o mais novo primeiro).
--   3. DEPOIS: até 3 chamados/atos com data nas próximas 72 horas (o mais perto primeiro).
--   4. O RESTO vai em blocos de 6 horas, do bloco mais novo para o mais antigo. Dentro do bloco: primeiro as conversas em que
--      quem perguntou marcou como a que ajudou uma resposta de OUTRA pessoa, e que tiveram resposta de 3 pessoas diferentes ou
--      mais (número só a partir de 3: uma marca sozinha, numa conversa com uma resposta só, não muda a ordem); depois A RODA: a publicação mais nova de cada pessoa, depois a
--      segunda de cada pessoa, e assim por diante (em cada volta, a mais nova primeiro).
--   5. TETO: em cada tela de 20, no máximo 3 publicações da mesma pessoa; o que passa do teto desce para a tela seguinte.
--   6. Acabou a regra, a linha continua em ordem de chegada (o que é mais velho que 7 dias).
--
-- O QUE NÃO ENTRA NA CONTA (e o teste prova): curtida, apoio, "útil", reação, salvo, "eu vou", número de respostas, número de
-- seguidores, clique, tempo de leitura, hora em que a pessoa abriu a rede, quem a pessoa é. (A única conta é o piso da marca
-- "ajudou": 3 pessoas diferentes respondendo. Ela não ordena nada; só decide se a marca de quem perguntou vale.) Não existe tabela de comportamento:
-- esta migração não cria nenhuma coluna sobre o que a pessoa leu. A escolha entre "Em roda" e "Ordem de chegada", as linhas que
-- a pessoa monta e o marco da última visita ficam SÓ no aparelho (LGPD art. 6º, III: o servidor não precisa saber como ela lê;
-- a lista de linhas diria a opinião política dela, art. 5º, II, e art. 11). O servidor recebe o filtro a cada leitura e não guarda.
--
-- Também aqui:
--   - "Assuntos em alta" sem manipulação: #temas usados por 3 pessoas ou mais nas últimas 48 horas e por MAIS gente do que nas
--     48 horas anteriores. Só posts que todo membro pode ver; igual para todo mundo; sem número exato (só a faixa).
--   - "Enquanto você esteve fora": os primeiros da mesma regra, só com o que chegou depois do instante que o aparelho manda.
--   - Ocultar uma resposta sem apagar (quem abriu a conversa): a resposta sai do fio e fica atrás de "respostas ocultadas", que
--     qualquer pessoa pode abrir. Ninguém é avisado; a moderação continua vendo tudo.
--
-- Tudo no esquema interno, RLS ligada sem políticas, acesso só por função security definer com search_path fixo, e toda função
-- pública chama a porta da entrada (interno.alumia_porta, 20261112-alumia-portas.sql) na primeira linha.
-- Pode rodar mais de uma vez, sem apagar dado nenhum. Roda DEPOIS de 20261112-alumia-portas.sql.
-- Teste: npm run testar:alumia-o7-linha.

-- ── 1. Tabelas ────────────────────────────────────────────────────────────────────────────────────────────────────────────

-- Respostas que quem abriu a conversa tirou do fio (sem apagar). Só o par conversa/resposta e a data: não diz quem ocultou
-- (é sempre quem abriu a conversa) nem por quê.
create table if not exists interno.rede_o7_ocultas (
  resposta uuid primary key references interno.rede_posts (id) on delete cascade,
  raiz uuid not null references interno.rede_posts (id) on delete cascade,
  criado_em timestamptz not null default now()
);
create index if not exists rede_o7_ocultas_raiz on interno.rede_o7_ocultas (raiz);
alter table interno.rede_o7_ocultas enable row level security;

-- #temas que a moderação tirou dos "assuntos em alta" (nome de pessoa, xingamento, campanha de ataque). O tema continua
-- existindo e buscável; só não sobe na lista.
create table if not exists interno.rede_o7_temas_retidos (
  tag text primary key check (tag ~ '^[a-z0-9_]{2,40}$'),
  criado_em timestamptz not null default now()
);
alter table interno.rede_o7_temas_retidos enable row level security;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on table interno.rede_o7_ocultas, interno.rede_o7_temas_retidos from anon, authenticated;
  end if;
end $$;

-- ── 2. Os números da regra (um lugar só; a tela lê daqui) ─────────────────────────────────────────────────────────────────

/** Os números da regra. A tela "Como a linha é montada" mostra estes mesmos valores; mudar aqui muda a regra e o texto. */
create or replace function interno.rede_o7_numeros() returns jsonb language sql immutable as $$
  select jsonb_build_object(
    'versao', 1,
    'janela_dias', 7, 'maximo', 300,
    'avisos', 2, 'atos', 3, 'perto_horas', 72,
    'bloco_horas', 6, 'tela', 20, 'teto', 3,
    'alta_horas', 48, 'alta_piso', 3, 'alta_maximo', 10, 'ajudou_piso', 3,
    'fora_destaques', 5)
$$;

-- ── 3. O filtro aberto das linhas que a pessoa monta ──────────────────────────────────────────────────────────────────────

/**
 * Confere e arruma o filtro de uma linha montada pela pessoa. Chaves aceitas (todas opcionais; valem juntas, com "e"):
 *   tipos        lista de tipos de post (post, discussao, duvida, chamado, enquete, aviso);
 *   tags         até 10 #temas (o post precisa ter pelo menos um);
 *   cidade       a cidade ESCRITA do chamado (texto; nunca posição do aparelho);
 *   nucleos      true = só o que foi publicado nos núcleos de que a pessoa faz parte;
 *   estudo       true = só as comunidades das disciplinas (estudo, ENEM);
 *   comunidades  até 20 comunidades (slug).
 * Chave desconhecida ou valor torto: 'invalido:filtro'. Nada disso é guardado: o filtro vem do aparelho a cada leitura.
 */
create or replace function interno.rede_o7_filtro(p jsonb) returns jsonb language plpgsql stable security definer set search_path = interno, pg_temp as $$
declare f jsonb := coalesce(p, '{}'::jsonb); v jsonb := '{}'::jsonb; k text; v_lista text[]; v_cidade text;
begin
  if jsonb_typeof(f) <> 'object' then perform interno.erro('invalido:filtro'); end if;
  for k in select jsonb_object_keys(f) loop
    if k not in ('tipos', 'tags', 'cidade', 'nucleos', 'estudo', 'comunidades') then perform interno.erro('invalido:filtro'); end if;
  end loop;
  if f ? 'tipos' then
    if jsonb_typeof(f -> 'tipos') <> 'array' then perform interno.erro('invalido:filtro'); end if;
    select coalesce(array_agg(distinct x order by x), '{}') into v_lista from jsonb_array_elements_text(f -> 'tipos') x;
    if not v_lista <@ array['post', 'discussao', 'duvida', 'chamado', 'enquete', 'aviso'] then perform interno.erro('invalido:filtro'); end if;
    if cardinality(v_lista) > 0 then v := v || jsonb_build_object('tipos', to_jsonb(v_lista)); end if;
  end if;
  if f ? 'tags' then
    if jsonb_typeof(f -> 'tags') <> 'array' or jsonb_array_length(f -> 'tags') > 10 then perform interno.erro('invalido:filtro'); end if;
    select coalesce(array_agg(distinct interno.rede3_desc_tag_norm(x) order by interno.rede3_desc_tag_norm(x)), '{}') into v_lista from jsonb_array_elements_text(f -> 'tags') x;
    if cardinality(v_lista) > 0 then v := v || jsonb_build_object('tags', to_jsonb(v_lista)); end if;
  end if;
  if f ? 'cidade' then
    if jsonb_typeof(f -> 'cidade') <> 'string' then perform interno.erro('invalido:filtro'); end if;
    v_cidade := interno.rede_ato_cidade(left(f ->> 'cidade', 80));
    if v_cidade is not null and v_cidade <> '' then v := v || jsonb_build_object('cidade', v_cidade); end if;
  end if;
  if f ? 'nucleos' then
    if jsonb_typeof(f -> 'nucleos') <> 'boolean' then perform interno.erro('invalido:filtro'); end if;
    if (f ->> 'nucleos')::boolean then v := v || jsonb_build_object('nucleos', true); end if;
  end if;
  if f ? 'estudo' then
    if jsonb_typeof(f -> 'estudo') <> 'boolean' then perform interno.erro('invalido:filtro'); end if;
    if (f ->> 'estudo')::boolean then v := v || jsonb_build_object('estudo', true); end if;
  end if;
  if f ? 'comunidades' then
    if jsonb_typeof(f -> 'comunidades') <> 'array' or jsonb_array_length(f -> 'comunidades') > 20 then perform interno.erro('invalido:filtro'); end if;
    select coalesce(array_agg(distinct lower(x) order by lower(x)), '{}') into v_lista from jsonb_array_elements_text(f -> 'comunidades') x;
    if exists (select 1 from unnest(v_lista) s where s !~ '^[a-z0-9-]{2,60}$') then perform interno.erro('invalido:filtro'); end if;
    if cardinality(v_lista) > 0 then v := v || jsonb_build_object('comunidades', to_jsonb(v_lista)); end if;
  end if;
  return v;
end $$;

/**
 * O post (de primeiro nível) cabe nesta aba e neste filtro, para esta pessoa? A aba 'temas' são os #temas que a própria pessoa
 * segue (p_seguidas). Confere também a matriz de visibilidade e o que a pessoa silenciou. Só olha o post e as ESCOLHAS da pessoa
 * (quem segue, comunidades, núcleos, temas, silenciados): nenhuma tabela de reação, de salvo ou de leitura.
 */
create or replace function interno.rede_o7_cabe(p interno.rede_posts, p_aba text, p_filtro jsonb, p_quem uuid, p_seguidas text[]) returns boolean
language sql stable security definer set search_path = interno, pg_temp as $$
  select p.resposta_a is null and p.apagado_em is null
    and case when p_aba = 'temas' then interno.rede3_desc_tags(p.titulo, p.texto, p.corpo) && coalesce(p_seguidas, '{}')
             else interno.rede_na_aba(p, p_aba, p_quem) end
    and (not (p_filtro ? 'tipos') or p.tipo in (select jsonb_array_elements_text(p_filtro -> 'tipos')))
    and (not (p_filtro ? 'tags') or interno.rede3_desc_tags(p.titulo, p.texto, p.corpo) && array(select jsonb_array_elements_text(p_filtro -> 'tags')))
    and (not (p_filtro ? 'cidade') or exists (select 1 from rede_chamados c where c.post = p.id and interno.rede_ato_cidade(c.cidade) = p_filtro ->> 'cidade'))
    and (not (p_filtro ? 'nucleos') or (p.nucleo is not null and interno.rede2_no_nucleo(p.nucleo, p_quem)))
    and (not (p_filtro ? 'estudo') or exists (select 1 from rede_comunidades c where c.slug = p.comunidade and c.categoria = 'disciplinas'))
    and (not (p_filtro ? 'comunidades') or p.comunidade in (select jsonb_array_elements_text(p_filtro -> 'comunidades')))
    and interno.rede_ve(p, p_quem) and not interno.rede_silenciado(p, p_quem)
$$;

-- ── 4. A regra ────────────────────────────────────────────────────────────────────────────────────────────────────────────

/**
 * A regra "Em roda", inteira. Devolve os posts na ordem, com a tela (de 20) em que cada um cai e o motivo de estar onde está
 * ('aviso', 'ato', 'ajudou' ou 'roda'). É função só do conjunto de posts, do instante p_ate e das escolhas da pessoa: chamada
 * duas vezes com a mesma entrada devolve a mesma ordem, e duas pessoas com as mesmas escolhas recebem a mesma ordem.
 * p_inicio estreita a janela (o "enquanto você esteve fora"); p_sem_meus tira os posts da própria pessoa.
 */
create or replace function interno.rede_o7_montar(p_aba text, p_filtro jsonb, p_quem uuid, p_ate timestamptz, p_inicio timestamptz default null, p_sem_meus boolean default false)
returns table (pos integer, tela integer, id uuid, porque text, criado_em timestamptz, total integer)
language plpgsql stable security definer set search_path = interno, pg_temp as $$
#variable_conflict use_column
declare
  n jsonb := interno.rede_o7_numeros();
  v_inicio timestamptz := greatest(coalesce(p_inicio, '-infinity'::timestamptz), p_ate - make_interval(days => (n ->> 'janela_dias')::integer));
  v_seguidas text[] := '{}';
  v_ids uuid[]; v_autores uuid[]; v_porques text[]; v_tempos timestamptz[];
  v_total integer; v_usado boolean[]; v_resta integer; v_tela integer := 0; v_na_tela integer; v_cont jsonb; v_k text; v_pos integer := 0; i integer;
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
      -- 1. O que entra.
      select p.id, coalesce(p.autor, p.id) as autor, p.criado_em, p.tipo, p.fixado, p.aceita
      from rede_posts p
      where p.resposta_a is null and p.apagado_em is null and p.criado_em <= p_ate and p.criado_em > v_inicio
        and (not p_sem_meus or p.autor is distinct from p_quem)
        and interno.rede_o7_cabe(p, p_aba, p_filtro, p_quem, v_seguidas)
      order by p.criado_em desc, p.id desc
      limit (n ->> 'maximo')::integer
    ), b as (
      select c.id, c.autor, c.criado_em,
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
      -- 2. Avisos fixados pela moderação.
      select b.id from b where b.aviso order by b.criado_em desc, b.id desc limit (n ->> 'avisos')::integer
    ), perto as (
      -- 3. Chamados e atos com data perto.
      select b.id from b where b.perto and b.id not in (select alto.id from alto) order by b.inicio, b.id limit (n ->> 'atos')::integer
    ), resto as (
      -- 4. A roda dentro de cada bloco.
      select b.*, row_number() over (partition by b.bloco, b.autor order by b.criado_em desc, b.id desc) as volta
      from b where b.id not in (select alto.id from alto) and b.id not in (select perto.id from perto)
    )
    select b.id, b.autor, b.criado_em, 'aviso'::text as porque, row_number() over (order by b.criado_em desc, b.id desc) as ord
      from b where b.id in (select alto.id from alto)
    union all
    select b.id, b.autor, b.criado_em, 'ato', 1000 + row_number() over (order by b.inicio, b.id)
      from b where b.id in (select perto.id from perto)
    union all
    select r.id, r.autor, r.criado_em, case when r.ajudou then 'ajudou' else 'roda' end,
           2000 + row_number() over (order by r.bloco desc, r.ajudou desc, r.volta, r.criado_em desc, r.id desc)
      from resto r
  ) o;

  v_total := cardinality(v_ids);
  v_resta := v_total;
  v_usado := array_fill(false, array[greatest(v_total, 1)]);
  -- 5. O teto por tela: quem passa de 3 na tela desce para a seguinte, sem perder a vez.
  while v_resta > 0 loop
    v_tela := v_tela + 1;
    v_na_tela := 0;
    v_cont := '{}'::jsonb;
    for i in 1 .. v_total loop
      exit when v_na_tela >= c_tela;
      continue when v_usado[i];
      v_k := v_autores[i]::text;
      continue when coalesce((v_cont ->> v_k)::integer, 0) >= c_teto;
      v_usado[i] := true;
      v_cont := v_cont || jsonb_build_object(v_k, coalesce((v_cont ->> v_k)::integer, 0) + 1);
      v_na_tela := v_na_tela + 1;
      v_resta := v_resta - 1;
      v_pos := v_pos + 1;
      pos := v_pos; tela := v_tela; id := v_ids[i]; porque := v_porques[i]; criado_em := v_tempos[i]; total := v_total;
      return next;
    end loop;
  end loop;
end $$;

-- ── 5. A linha ────────────────────────────────────────────────────────────────────────────────────────────────────────────

/**
 * Uma tela da linha. p_aba: 'seguindo', 'comunidades', 'tudo', 'c:<slug>' ou 'temas' (os #temas que a pessoa segue).
 * p_modo: 'roda' (a regra aberta) ou 'chegada' (do mais novo para o mais velho, sem mais nada). p_filtro: o filtro de uma linha
 * montada pela pessoa (interno.rede_o7_filtro). O cursor é o `proximo` da tela anterior: na regra, "r|instante|tela" (o
 * instante fica preso na primeira tela: o que chega depois não muda a ordem das telas seguintes); depois da regra e na ordem de
 * chegada, "d|criado_em|id". Devolve {itens, proximo, modo, instante, regra}: cada item é o post de sempre mais 'o7_porque'.
 */
create or replace function public.rede_roda_linha(p_aba text, p_modo text default 'roda', p_filtro jsonb default null, p_cursor text default null) returns jsonb
language plpgsql volatile security definer set search_path = interno, pg_temp as $$
declare
  v uuid; n jsonb := interno.rede_o7_numeros(); f jsonb; v_aba text; v_seguidas text[] := '{}';
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
    from interno.rede_o7_montar(v_aba, f, v, v_ate) m;
    if v_mais then
      v_prox := 'r|' || v_ate::text || '|' || (v_tela + 1)::text;
    else
      -- 6. Acabou a regra: daqui para trás, ordem de chegada. Se a regra parou no máximo de 300, continua do mais velho deles;
      -- senão, do começo da janela de 7 dias.
      if v_total >= (n ->> 'maximo')::integer then
        select m.id into v_velho_id from interno.rede_o7_montar(v_aba, f, v, v_ate) m where m.criado_em = v_velho_t order by m.id limit 1;
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

/** Os números da regra, para a tela "Como a linha é montada" mostrar os mesmos valores que o banco usa. */
create or replace function public.rede_roda_regra() returns jsonb language plpgsql stable security definer set search_path = interno, pg_temp as $$
begin
  perform interno.alumia_porta();
  return interno.rede_o7_numeros();
end $$;

-- ── 6. Enquanto você esteve fora ──────────────────────────────────────────────────────────────────────────────────────────

/**
 * O que chegou à aba depois de p_desde (o instante da última visita, que o APARELHO guarda e manda; o banco não grava): os
 * primeiros da mesma regra (até 5), só de outras pessoas, e quantos posts são ao todo (até o máximo da regra). O instante mais
 * antigo que vale é o começo da janela de 7 dias. Devolve {novos, destaques, desde}.
 */
create or replace function public.rede_roda_desde(p_aba text, p_desde timestamptz, p_filtro jsonb default null) returns jsonb
language plpgsql volatile security definer set search_path = interno, pg_temp as $$
declare v uuid; n jsonb := interno.rede_o7_numeros(); f jsonb; v_aba text; v_ate timestamptz := now(); v_ids uuid[]; v_porques text[]; v_total integer; v_itens jsonb;
begin
  perform interno.alumia_porta();
  perform interno.aberta('comunidade');
  v := interno.eu();
  if not interno.rede2_membro(v) then perform interno.erro('consentimento'); end if;
  perform interno.limite('rede2_ler', 600, 60);
  if p_desde is null or p_desde >= v_ate then return jsonb_build_object('novos', 0, 'destaques', '[]'::jsonb, 'desde', p_desde); end if;
  f := interno.rede_o7_filtro(p_filtro);
  if p_aba = 'temas' then v_aba := 'temas';
  elsif p_aba in ('seguindo', 'comunidades', 'tudo') or p_aba like 'c:%' then v_aba := interno.rede_aba(p_aba, v);
  else perform interno.erro('invalido:aba');
  end if;
  select coalesce(array_agg(m.id order by m.pos) filter (where m.pos <= (n ->> 'fora_destaques')::integer), '{}'),
         coalesce(array_agg(m.porque order by m.pos) filter (where m.pos <= (n ->> 'fora_destaques')::integer), '{}'),
         coalesce(max(m.total), 0)
    into v_ids, v_porques, v_total
  from interno.rede_o7_montar(v_aba, f, v, v_ate, p_desde, true) m;
  select coalesce(jsonb_agg(interno.rede_post_v2(r, v) || jsonb_build_object('o7_porque', v_porques[array_position(v_ids, r.id)])
                            order by array_position(v_ids, r.id)), '[]'::jsonb)
    into v_itens from rede_posts r where r.id = any (v_ids);
  return jsonb_build_object('novos', v_total, 'destaques', v_itens,
    'desde', greatest(p_desde, v_ate - make_interval(days => (n ->> 'janela_dias')::integer)));
end $$;

-- ── 7. Assuntos em alta ───────────────────────────────────────────────────────────────────────────────────────────────────

/**
 * Os #temas em alta. O critério inteiro: #tema usado em posts de primeiro nível, que TODO membro pode ver (público "internet" ou
 * "membros", fora de comunidade fechada), por 3 pessoas diferentes ou mais nas últimas 48 horas, e por MAIS pessoas do que nas
 * 48 horas anteriores. Ordem: quem mais cresceu em número de pessoas; empate, ordem alfabética. Até 10. Conta de conta suspensa
 * não entra; tema retido pela moderação não entra. A lista é a mesma para todo mundo (não olha quem pergunta) e não mostra
 * número: só a faixa ('algumas' de 3 a 9 pessoas, 'dezenas' de 10 a 99, 'centenas' de 100 em diante) e se o tema é novo.
 */
create or replace function public.rede_roda_em_alta() returns jsonb language plpgsql volatile security definer set search_path = interno, pg_temp as $$
declare v uuid; n jsonb := interno.rede_o7_numeros(); v_h integer := (n ->> 'alta_horas')::integer; v_agora timestamptz := now(); v_temas jsonb;
begin
  perform interno.alumia_porta();
  perform interno.aberta('comunidade');
  v := interno.eu();
  if not interno.rede2_membro(v) then perform interno.erro('consentimento'); end if;
  perform interno.limite('rede2_ler', 600, 60);
  select coalesce(jsonb_agg(jsonb_build_object('tag', t.tag, 'nova', t.antes = 0,
           'faixa', case when t.agora >= 100 then 'centenas' when t.agora >= 10 then 'dezenas' else 'algumas' end)
           order by t.agora - t.antes desc, t.tag), '[]'::jsonb) into v_temas
  from (
    select y.tag, y.agora, y.antes
    from (
      select x.tag,
             count(distinct x.autor) filter (where x.criado_em > v_agora - make_interval(hours => v_h))::integer as agora,
             count(distinct x.autor) filter (where x.criado_em <= v_agora - make_interval(hours => v_h))::integer as antes
      from (
        select p.autor, p.criado_em, unnest(interno.rede3_desc_tags(p.titulo, p.texto, p.corpo)) as tag
        from rede_posts p
        where p.resposta_a is null and p.apagado_em is null and not p.oculto and not p.retido and p.autor is not null
          and p.criado_em > v_agora - make_interval(hours => 2 * v_h) and p.criado_em <= v_agora
          and interno.rede2_publico(p) in ('internet', 'membros')
          and (p.comunidade is null or (p.comunidade not like 'fechado-%'
               and not exists (select 1 from rede_comunidades c where c.slug = p.comunidade and c.tipo = 'fechada')))
          and not exists (select 1 from perfis s where s.id = p.autor and s.suspenso)
      ) x
      where not exists (select 1 from rede_o7_temas_retidos k where k.tag = x.tag)
      group by x.tag
    ) y
    where y.agora >= (n ->> 'alta_piso')::integer and y.agora > y.antes
    order by y.agora - y.antes desc, y.tag
    limit (n ->> 'alta_maximo')::integer
  ) t;
  return jsonb_build_object('temas', v_temas, 'horas', v_h, 'piso', (n ->> 'alta_piso')::integer);
end $$;

/** A moderação tira (p_sim) ou devolve um #tema dos assuntos em alta. O tema continua existindo e buscável. Devolve {retido}. */
create or replace function public.rede_roda_tema_reter(p_tag text, p_sim boolean default true) returns jsonb language plpgsql volatile security definer set search_path = interno, pg_temp as $$
declare v uuid; v_tag text;
begin
  perform interno.alumia_porta();
  v := interno.eu();
  if not interno.cuida() then perform interno.erro('sem_permissao'); end if;
  perform interno.limite('alumia_painel_agir', 300, 60);
  v_tag := interno.rede3_desc_tag_norm(p_tag);
  if coalesce(p_sim, true) then
    insert into rede_o7_temas_retidos (tag) values (v_tag) on conflict do nothing;
  else
    delete from rede_o7_temas_retidos where tag = v_tag;
  end if;
  perform interno.registrar('rede_roda_tema_reter', v_tag, jsonb_build_object('retido', coalesce(p_sim, true)));
  -- Também no registro do painel da Alumia (20261113-alumia-o7-painel.sql), que a coordenação lê e ninguém apaga.
  if to_regprocedure('interno.alumia_painel_registrar(text, text, text, text, text, jsonb)') is not null then
    perform interno.alumia_painel_registrar(case when coalesce(p_sim, true) then 'tema_retido' else 'tema_devolvido' end, 'tema', v_tag, '#' || v_tag, '');
  end if;
  return jsonb_build_object('retido', coalesce(p_sim, true));
end $$;

-- ── 8. Ocultar resposta sem apagar ────────────────────────────────────────────────────────────────────────────────────────

/**
 * Quem ABRIU a conversa tira (p_sim) ou devolve uma resposta do fio. A resposta não é apagada: continua no perfil de quem
 * escreveu e atrás de "respostas ocultadas" na conversa. Ninguém é avisado. Não vale para a própria resposta nem para o post
 * que abriu a conversa. Até 200 por conversa. Devolve {oculta}.
 */
create or replace function public.rede_roda_ocultar(p_resposta uuid, p_sim boolean default true) returns jsonb language plpgsql volatile security definer set search_path = interno, pg_temp as $$
declare v uuid; x rede_posts; r rede_posts;
begin
  perform interno.alumia_porta();
  perform interno.aberta('comunidade');
  v := interno.eu();
  if not interno.rede2_membro(v) then perform interno.erro('consentimento'); end if;
  select * into x from rede_posts where id = p_resposta;
  if not found or x.apagado_em is not null or not interno.rede_ve(x, v) then perform interno.erro('nao_encontrado'); end if;
  r := interno.rede3_conv_raiz(x);
  if r.id is null or x.id = r.id then perform interno.erro('nao_encontrado'); end if;
  if r.autor is distinct from v then perform interno.erro('sem_permissao'); end if;
  if x.autor = v then perform interno.erro('invalido:propria'); end if;
  if not coalesce(p_sim, true) then
    delete from rede_o7_ocultas where resposta = x.id;
    return jsonb_build_object('oculta', false);
  end if;
  perform interno.rede2_limite('editar');
  if not exists (select 1 from rede_o7_ocultas where resposta = x.id)
     and (select count(*) from rede_o7_ocultas where raiz = r.id) >= 200 then
    perform interno.erro('invalido:muitas');
  end if;
  insert into rede_o7_ocultas (resposta, raiz) values (x.id, r.id) on conflict do nothing;
  return jsonb_build_object('oculta', true);
end $$;

/**
 * As respostas ocultadas de uma conversa (pelo id de qualquer post dela): {ids, pode}. Só os ids das que quem pergunta pode
 * ver; `pode` diz se é quem abriu a conversa (só ela oculta e devolve). Visitante e quem não vê a conversa: lista vazia.
 */
create or replace function public.rede_roda_ocultas(p_post uuid) returns jsonb language plpgsql stable security definer set search_path = interno, pg_temp as $$
declare v uuid := auth.uid(); x rede_posts; r rede_posts;
begin
  perform interno.alumia_porta();
  select * into x from rede_posts where id = p_post;
  if not found or not interno.rede_ve(x, v) then return jsonb_build_object('ids', '[]'::jsonb, 'pode', false); end if;
  r := interno.rede3_conv_raiz(x);
  if r.id is null or not interno.rede_ve(r, v) then return jsonb_build_object('ids', '[]'::jsonb, 'pode', false); end if;
  return jsonb_build_object(
    'ids', (select coalesce(jsonb_agg(o.resposta order by o.criado_em, o.resposta), '[]'::jsonb)
            from rede_o7_ocultas o join rede_posts p on p.id = o.resposta
            where o.raiz = r.id and p.apagado_em is null and interno.rede_ve(p, v)),
    'pode', v is not null and r.autor = v and interno.rede2_membro(v));
end $$;

-- ── 9. Permissões ─────────────────────────────────────────────────────────────────────────────────────────────────────────
revoke all on function interno.rede_o7_numeros(), interno.rede_o7_filtro(jsonb), interno.rede_o7_cabe(interno.rede_posts, text, jsonb, uuid, text[]),
  interno.rede_o7_montar(text, jsonb, uuid, timestamptz, timestamptz, boolean) from public;
revoke all on function public.rede_roda_linha(text, text, jsonb, text), public.rede_roda_regra(), public.rede_roda_desde(text, timestamptz, jsonb),
  public.rede_roda_em_alta(), public.rede_roda_tema_reter(text, boolean), public.rede_roda_ocultar(uuid, boolean), public.rede_roda_ocultas(uuid) from public;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on function interno.rede_o7_numeros(), interno.rede_o7_filtro(jsonb), interno.rede_o7_cabe(interno.rede_posts, text, jsonb, uuid, text[]),
      interno.rede_o7_montar(text, jsonb, uuid, timestamptz, timestamptz, boolean) from anon, authenticated;
    revoke all on function public.rede_roda_linha(text, text, jsonb, text), public.rede_roda_regra(), public.rede_roda_desde(text, timestamptz, jsonb),
      public.rede_roda_em_alta(), public.rede_roda_tema_reter(text, boolean), public.rede_roda_ocultar(uuid, boolean), public.rede_roda_ocultas(uuid) from anon, authenticated;
    grant execute on function public.rede_roda_linha(text, text, jsonb, text), public.rede_roda_desde(text, timestamptz, jsonb),
      public.rede_roda_em_alta(), public.rede_roda_tema_reter(text, boolean), public.rede_roda_ocultar(uuid, boolean) to authenticated, service_role;
    grant execute on function public.rede_roda_regra(), public.rede_roda_ocultas(uuid) to anon, authenticated, service_role;
  end if;
end $$;

-- ── 10. O interruptor ─────────────────────────────────────────────────────────────────────────────────────────────────────
-- "alumia-linha-aberta" no catálogo de recursos do painel (lib/recursos.ts). Só liga pelo nome: precisa desta migração no banco.
do $do$
begin
  if to_regclass('interno.recursos_catalogo') is not null then
    insert into interno.recursos_catalogo (nome, so_pelo_nome) values ('alumia-linha-aberta', true) on conflict (nome) do update set so_pelo_nome = true;
  end if;
end $do$;

-- ── 11. A porta ───────────────────────────────────────────────────────────────────────────────────────────────────────────
-- As funções acima já chamam interno.alumia_porta() na primeira linha. Roda a regra de novo para a conta fechar (e para avisar
-- se alguma função da rede ficou sem porta).
do $$
declare v jsonb := interno.alumia_trancar();
begin
  if jsonb_array_length(v -> 'abertas') > 0 then
    raise warning 'alumia_trancar: função sem porta: %', v -> 'abertas';
  end if;
end $$;
