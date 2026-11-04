-- ───────────────────────────── Rede Lúcia v2: pacote consertos (Etapa 7, R4 itens 1 a 9) ─────────────────
-- Migração acrescentável: pode rodar mais de uma vez, sem apagar dado nenhum. Roda DEPOIS do install.sql e da fundação
-- (2026-11-rede-fundacao.sql), na ordem de docs/rede/V2.md: fundacao → CONSERTOS → perfil → publicar → conversa →
-- descoberta → comunidades → avisos → moderacao. Teste: npm run testar:rede-consertos.
--
-- Estes consertos valem para a Rede de HOJE (as funções rede_* do install.sql) e não dependem do recurso "rede-v2":
--   1. Contagens: o total de "Apoiar" só sai para quem escreveu o post, e o de "Eu vou" só para quem organizou o chamado
--      (rede_post_json, rede_vou). Também o número de respostas passa a contar só o que a pessoa pode ver.
--   2. Idade mínima 18 (rede_18; rede_confirmar_idade). Quem declara ter menos fica fora só da Rede (rede_menor_em); o resto do
--      site segue aberto. Quem já tinha confirmado 16 precisa confirmar 18.
--   3. Paginação por cursor (rede_fix_linha) e o contador "N novos" por aba (rede_fix_novos, rede_fix_novos_abas).
--   4. Posts da Rede na segunda avaliação externa (função avaliar-comunidade, tipo 'rede'): comunidade_para_avaliar,
--      comunidade_avaliada e comunidade_pendentes ganham o ramo 'rede'. Falha nunca publica.
--   5. Convites de núcleo/espaço fechado com hash (sha256), validade, limite de usos e revogação (rede_fix_convite_*). O código
--      antigo em texto vale só por mais 30 dias, a mediação é avisada, e depois o texto é trocado por um sorteado.
--
-- Leis (planalto.gov.br, conferidas em 04/11/2026): LGPD (13.709/2018) art. 14 (dado de criança e adolescente: a Rede não os
-- trata) e art. 6º, III (necessidade: contagem só a quem precisa); ECA Digital (15.211/2025) art. 9º, §1º veda a autodeclaração
-- como verificação de idade para conteúdo impróprio a menores: a autodeclaração aqui é trava de produto, não aferição, e o ponto
-- segue em revisão jurídica antes de abrir para todos; Marco Civil (12.965/2014) art. 7º, VII (nada repassado a terceiros).

-- ── 0. Estrutura ───────────────────────────────────────────────────────────

alter table interno.perfis add column if not exists rede_menor_em timestamptz;
alter table interno.rede_posts add column if not exists avaliacao_em timestamptz;
alter table interno.rede_posts add column if not exists tentativas smallint not null default 0;
alter table interno.rede_espacos add column if not exists codigo_expira_em timestamptz;
alter table interno.rede_espacos add column if not exists codigo_aviso_em timestamptz;
alter table interno.rede_espacos add column if not exists codigo_apagado_em timestamptz;
-- O convite com hash serve a núcleo (v2) e a espaço fechado (Rede de hoje): um ou outro, nunca os dois nem nenhum.
alter table interno.rede_convites alter column nucleo drop not null;
alter table interno.rede_convites add column if not exists espaco text references interno.rede_espacos (slug) on delete cascade;
do $$
begin
  alter table interno.rede_convites add constraint rede_convites_alvo check ((nucleo is not null) <> (espaco is not null));
exception when duplicate_object then null;
end $$;
create index if not exists rede_convites_espaco on interno.rede_convites (espaco) where espaco is not null;
create index if not exists rede_posts_avaliacao on interno.rede_posts (criado_em) where retido;

-- Quem declarou ter menos de 18 anos não vira "18+" por um clique depois: só a mediação desfaz (rede_fix_idade_rever).
create or replace function interno.rede_fix_menor_trava() returns trigger language plpgsql security definer set search_path = interno, pg_temp as $$
begin
  if new.rede_18 and new.rede_menor_em is not null then
    perform interno.erro('idade_minima');
  end if;
  return new;
end $$;
drop trigger if exists rede_fix_menor_trava on interno.perfis;
create trigger rede_fix_menor_trava before insert or update of rede_18, rede_menor_em on interno.perfis
  for each row execute function interno.rede_fix_menor_trava();

-- ── 1. Idade mínima 18 ─────────────────────────────────────────────────────

/**
 * Confere a idade de quem chama. Visitante passa (a leitura pública não tem conta). Quem declarou ter menos de 18 não lê
 * nem escreve na Rede ('idade_minima'); para escrever, também precisa ter confirmado 18 ('confirme_idade').
 */
create or replace function interno.rede_fix_idade(p_escrever boolean default true) returns void language plpgsql stable security definer set search_path = interno, pg_temp as $$
declare v uuid := auth.uid(); f record;
begin
  if v is null then return; end if;
  select rede_18, rede_menor_em into f from perfis where id = v;
  if not found then return; end if;
  if f.rede_menor_em is not null and not f.rede_18 then perform interno.erro('idade_minima'); end if;
  if p_escrever and not f.rede_18 then perform interno.erro('confirme_idade'); end if;
end $$;

/** Declara 18 anos ou mais (true) ou menos (false). Quem declara menos fica fora só da Rede, com mensagem gentil na tela. */
create or replace function public.rede_confirmar_idade(p_maior boolean) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu();
begin
  perform interno.limite('rede_idade', 20, 60);
  if coalesce(p_maior, false) then
    if exists (select 1 from perfis where id = v and rede_menor_em is not null) then perform interno.erro('idade_minima'); end if;
    update perfis set rede_18 = true, rede_16 = true where id = v;
    return jsonb_build_object('ok', true, 'maior', true);
  end if;
  update perfis set rede_18 = false, rede_16 = false, rede_menor_em = now() where id = v;
  return jsonb_build_object('ok', false, 'maior', false, 'menor', true);
end $$;

/** "Tenho 18 anos ou mais" (sem argumento, como a Rede de hoje chamava). */
create or replace function public.rede_confirmar_idade() returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
begin
  return public.rede_confirmar_idade(true);
end $$;

/** Só a mediação: desfaz a declaração de quem marcou "menos de 18" por engano. Fica no registro. */
create or replace function public.rede_fix_idade_rever(p_usuario uuid) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
begin
  perform interno.eu();
  if not interno.cuida() then perform interno.erro('sem_permissao'); end if;
  update perfis set rede_menor_em = null where id = p_usuario;
  perform interno.registrar('rede_idade_revista', p_usuario::text);
  return jsonb_build_object('ok', true);
end $$;

/** Quem está na Rede (a de hoje): codinome, sugestão, 18+ e se declarou ter menos de 18. */
create or replace function public.rede_eu() returns jsonb language plpgsql volatile security definer set search_path = interno, pg_temp as $$
begin
  return (select jsonb_build_object('id', id, 'nome', rede_codinome, 'codinome', true, 'codinome_ok', rede_codinome_ok, 'bio', rede_bio,
    'sugestao', coalesce(rede_codinome, interno.rede_codinome_livre(case when interno.voluntario_e(id) then null else nome end)),
    'rede_18', rede_18, 'menor', (rede_menor_em is not null and not rede_18), 'invisivel', rede_invisivel) from perfis where id = interno.eu());
end $$;

-- ── 2. Contagens só para quem precisa ──────────────────────────────────────

-- Igual ao do install.sql, com três mudanças: "apoios" só para o autor (null para os outros), "vou" só para quem organizou e
-- "respostas" só com o que a pessoa pode ver. Quem lê a função por fora (API direta) também não recebe o número.
create or replace function interno.rede_post_json(p interno.rede_posts, p_com_original boolean default true) returns jsonb language plpgsql stable security definer set search_path = interno, pg_temp as $$
begin
  return jsonb_build_object('id', p.id, 'texto', p.texto, 'comunidade', p.comunidade, 'criado_em', p.criado_em, 'aviso', p.aviso, 'cita', p.cita, 'chamado', p.chamado,
    'alcance', p.alcance, 'posicao', p.posicao, 'meu', p.autor = auth.uid(), 'retido', case when p.autor = auth.uid() then p.retido or p.oculto else false end,
    'modero', interno.cuida() or exists (select 1 from rede_moderadores m where m.comunidade = p.comunidade and m.usuario = auth.uid())
              or (p.comunidade like 'fechado-%' and exists (select 1 from rede_espaco_membros m where m.espaco = p.comunidade and m.usuario = auth.uid() and m.cuida)),
    'autor', jsonb_build_object('id', p.autor, 'nome', interno.rede_nome(p.autor), 'codinome', true, 'avatar', null, 'equipe', interno.voluntario_e(p.autor)),
    'respostas', (select count(*) from rede_posts r where r.resposta_a = p.id and interno.rede_ve(r)),
    'apoios', case when p.autor = auth.uid() then (select count(*) from rede_apoios a where a.post = p.id) end,
    'apoiei', exists (select 1 from rede_apoios a where a.post = p.id and a.usuario = auth.uid()),
    'vou', case when p.chamado is not null and p.autor = auth.uid() then (select count(*) from rede_vou v where v.post = p.id) end,
    'vou_eu', exists (select 1 from rede_vou v where v.post = p.id and v.usuario = auth.uid()),
    'resposta_a', case when p.resposta_a is not null then (select jsonb_build_object('id', o.id, 'autor', interno.rede_nome(o.autor)) from rede_posts o where o.id = p.resposta_a) end,
    'original', case when p_com_original and p.repost_de is not null then (select case when interno.rede_ve(o) then interno.rede_post_json(o, false) end from rede_posts o where o.id = p.repost_de) end);
end $$;

create or replace function public.rede_apoiar(p_id uuid, p_sim boolean) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); x rede_posts;
begin
  perform interno.rede_fix_idade(true);
  select * into x from rede_posts where id = p_id;
  if not found or not interno.rede_ve(x) then perform interno.erro('nao_encontrado'); end if;
  if coalesce(p_sim, true) then insert into rede_apoios (post, usuario) values (p_id, v) on conflict do nothing;
  else delete from rede_apoios where post = p_id and usuario = v; end if;
  return jsonb_build_object('ok', true);
end $$;

/** "Eu vou" num chamado. O total só volta para quem organizou; para as outras pessoas, só "ok". */
create or replace function public.rede_vou(p_id uuid, p_sim boolean) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); x rede_posts;
begin
  perform interno.rede_fix_idade(true);
  select * into x from rede_posts where id = p_id;
  if not found or x.chamado is null or not interno.rede_ve(x) then perform interno.erro('nao_encontrado'); end if;
  if coalesce(p_sim, true) then insert into rede_vou (post, usuario) values (p_id, v) on conflict do nothing;
  else delete from rede_vou where post = p_id and usuario = v; end if;
  return jsonb_build_object('ok', true, 'vou', case when x.autor = v then (select count(*) from rede_vou where post = p_id) end);
end $$;

-- ── 3. Publicar (a Rede de hoje): 18 anos e segunda avaliação externa ─────

/**
 * Como no install.sql, com: 18 anos (rede_fix_idade) no lugar de 16, a triagem única da Rede (rede_triagem: regras do banco,
 * modo de segurança e segunda avaliação externa) e o campo "avaliar" na resposta: com true, o navegador pede a avaliação à
 * função avaliar-comunidade (tipo 'rede'). O post espera retido, com motivo 'aguardando_avaliacao'.
 */
create or replace function public.rede_postar(p jsonb) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare
  v uuid := interno.eu(); x rede_posts; o rede_posts;
  v_texto text := btrim(coalesce(p ->> 'texto', ''));
  v_resposta uuid; v_repost uuid; v_cita jsonb; v_chamado jsonb; v_quando timestamptz;
  v_alcance text := coalesce(nullif(p ->> 'alcance', ''), 'publico');
  v_tri jsonb; v_veredito text;
begin
  perform interno.aberta('comunidade');
  perform interno.rede_fix_idade(true);
  if not coalesce((select rede_codinome_ok and rede_codinome is not null from perfis where id = v), false) then perform interno.erro('confirme_codinome'); end if;
  if char_length(v_texto) > 500 then perform interno.erro('invalido:texto'); end if;
  if v_alcance not in ('publico', 'seguidores', 'equipe') then perform interno.erro('invalido:alcance'); end if;
  if v_alcance = 'equipe' and not interno.voluntario() then perform interno.erro('invalido:alcance'); end if;
  if (select criado_em from perfis where id = v) > now() - interval '7 days' then perform interno.limite('rede_post_novo', 8, 1440);
  else perform interno.limite('rede_post', 80, 1440); end if;
  if v_texto ~ '\d{3}\.?\d{3}\.?\d{3}-?\d{2}' or v_texto ~ '\(?\d{2}\)?\s?9\d{4}[-\s]?\d{4}' or v_texto ~* '[a-z0-9._%+-]+@[a-z0-9-]+\.[a-z.]{2,}' then
    perform interno.erro('dado_pessoal');
  end if;
  begin
    v_resposta := nullif(p ->> 'resposta_a', '')::uuid;
    v_repost := nullif(p ->> 'repost_de', '')::uuid;
  exception when others then perform interno.erro('invalido:post');
  end;
  if v_resposta is not null then
    select * into o from rede_posts where id = v_resposta;
    if not found or not interno.rede_ve(o) or o.oculto then perform interno.erro('nao_encontrado'); end if;
  end if;
  if v_repost is not null then
    select * into o from rede_posts where id = v_repost;
    if not found or o.oculto or o.alcance <> 'publico' or interno.rede_bloqueado(v, o.autor) then perform interno.erro('nao_encontrado'); end if;
  end if;
  if v_texto = '' and v_repost is null then perform interno.erro('invalido:texto'); end if;
  if not interno.rede_espaco_entra(nullif(btrim(coalesce(p ->> 'comunidade', '')), '')) then perform interno.erro('sem_permissao'); end if;
  if nullif(p ->> 'posicao', '') is not null and (v_resposta is null or p ->> 'posicao' not in ('favor', 'contra', 'sintese')) then perform interno.erro('invalido:posicao'); end if;
  if p ? 'cita' and jsonb_typeof(p -> 'cita') = 'object' then
    if coalesce(p -> 'cita' ->> 'tipo', '') not in ('aula', 'obra', 'materia') or coalesce(p -> 'cita' ->> 'caminho', '') !~ '^/(trilhas|acervo|jornal)/[a-z0-9/-]{2,200}$' then
      perform interno.erro('invalido:cita');
    end if;
    v_cita := jsonb_build_object('tipo', p -> 'cita' ->> 'tipo', 'caminho', p -> 'cita' ->> 'caminho', 'titulo', left(coalesce(p -> 'cita' ->> 'titulo', ''), 200));
  end if;
  if p ? 'chamado' and jsonb_typeof(p -> 'chamado') = 'object' then
    begin
      v_quando := (p -> 'chamado' ->> 'quando')::timestamptz;
    exception when others then perform interno.erro('invalido:chamado');
    end;
    if coalesce(p -> 'chamado' ->> 'tipo', '') not in ('ato', 'mutirao', 'assembleia', 'roda') or v_quando is null or v_quando < now() or v_quando > now() + interval '365 days'
       or char_length(coalesce(p -> 'chamado' ->> 'onde', '')) not between 3 and 160 then
      perform interno.erro('invalido:chamado');
    end if;
    v_chamado := jsonb_build_object('tipo', p -> 'chamado' ->> 'tipo', 'quando', v_quando, 'onde', btrim(p -> 'chamado' ->> 'onde'));
  end if;
  v_tri := interno.rede_triagem(v_texto || ' ' || coalesce(v_chamado ->> 'onde', ''), v);
  v_veredito := v_tri ->> 'veredito';
  insert into rede_posts (autor, texto, comunidade, resposta_a, repost_de, cita, chamado, alcance, aviso, posicao, oculto, retido, avaliacao, motivo)
  values (v, v_texto, nullif(btrim(coalesce(p ->> 'comunidade', '')), ''), v_resposta, v_repost, v_cita, v_chamado, v_alcance, left(btrim(coalesce(p ->> 'aviso', '')), 80), nullif(p ->> 'posicao', ''),
          v_veredito <> 'publicar', v_veredito = 'revisar', case v_veredito when 'publicar' then 'publicada' when 'bloquear' then 'bloqueada' else 'revisao' end, coalesce(v_tri ->> 'motivo', ''))
  returning * into x;
  if v_resposta is not null and o.autor is distinct from v and x.oculto = false then
    perform interno.avisar_em(o.autor, format('%s respondeu ao seu post na Rede Lúcia: “%s”', interno.rede_nome(v), left(v_texto, 120)), 'rede');
  end if;
  return interno.rede_post_json(x) || jsonb_build_object('avaliar', coalesce((v_tri ->> 'externa')::boolean, false));
exception when check_violation then perform interno.erro('invalido:post');
end $$;

-- ── 4. Ler (a Rede de hoje): idade, paginação por cursor e "N novos" por aba ──

/** Este post pertence à linha pedida? (mesma regra do install.sql, em um lugar só: a linha e o contador usam esta.) */
create or replace function interno.rede_fix_na_linha(p interno.rede_posts, p_modo text, p_comunidade text, p_usuario uuid) returns boolean language sql stable security definer set search_path = interno, pg_temp as $$
  select p.apagado_em is null and case p_modo
    when 'seguindo' then p.resposta_a is null and (p.autor = auth.uid() or exists (select 1 from rede_seguindo s where s.quem = auth.uid() and s.segue = p.autor))
    when 'comunidade' then p.resposta_a is null and p.comunidade = p_comunidade
    when 'minhas' then p.resposta_a is null and (p.comunidade in (select c.comunidade from rede_comunidades_seguidas c where c.usuario = auth.uid())
                                                  or p.comunidade in (select m.espaco from rede_espaco_membros m where m.usuario = auth.uid()))
    when 'perfil' then p.autor = p_usuario
    when 'chamados' then p.chamado is not null and (p.chamado ->> 'quando')::timestamptz > now() - interval '6 hours'
    else p.resposta_a is null end
$$;

/**
 * A linha da Rede de hoje por cursor: 20 por vez (no máximo 50). O cursor é o "criado_em|id" do último post entregue, então post
 * que chega enquanto a pessoa lê não repete nem pula. Devolve {itens, proximo} (proximo nulo = acabou; "chamados" vem numa página só).
 */
create or replace function public.rede_fix_linha(p_modo text default 'tudo', p_comunidade text default null, p_usuario uuid default null, p_cursor text default null, p_limite integer default 20) returns jsonb
language plpgsql volatile security definer set search_path = interno, pg_temp as $$
declare
  v_modo text := coalesce(nullif(p_modo, ''), 'tudo');
  v_lim integer := least(greatest(coalesce(p_limite, 20), 1), 50);
  v_t timestamptz; v_id uuid; v_ids uuid[]; v_proximo text; v_itens jsonb; v_ult rede_posts;
begin
  perform interno.aberta('comunidade');
  perform interno.rede_fix_idade(false);
  if v_modo not in ('tudo', 'seguindo', 'minhas', 'chamados', 'comunidade', 'perfil') then perform interno.erro('invalido:modo'); end if;
  perform interno.limite('rede_fix_ler', 600, 60);
  if v_modo = 'perfil' and p_usuario is not null and p_usuario is distinct from auth.uid() and coalesce((select rede_invisivel from perfis where id = p_usuario), false) then
    return jsonb_build_object('itens', '[]'::jsonb, 'proximo', null);
  end if;
  if nullif(p_cursor, '') is not null and v_modo <> 'chamados' then
    begin
      v_t := split_part(p_cursor, '|', 1)::timestamptz;
      v_id := split_part(p_cursor, '|', 2)::uuid;
    exception when others then perform interno.erro('invalido:cursor');
    end;
  end if;
  if v_modo = 'chamados' then
    select array_agg(z.id order by z.quando, z.id) into v_ids from (
      select p.id, (p.chamado ->> 'quando')::timestamptz as quando from rede_posts p
      where interno.rede_ve(p) and interno.rede_fix_na_linha(p, v_modo, p_comunidade, p_usuario) order by 2, p.id limit v_lim) z;
  else
    select array_agg(z.id order by z.criado_em desc, z.id desc) into v_ids from (
      select p.id, p.criado_em from rede_posts p
      where interno.rede_ve(p) and (v_t is null or (p.criado_em, p.id) < (v_t, v_id)) and interno.rede_fix_na_linha(p, v_modo, p_comunidade, p_usuario)
      order by p.criado_em desc, p.id desc limit v_lim + 1) z;
    if coalesce(cardinality(v_ids), 0) > v_lim then
      select * into v_ult from rede_posts where id = v_ids[v_lim];
      v_proximo := to_char(v_ult.criado_em at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') || '|' || v_ult.id::text;
      v_ids := v_ids[1:v_lim];
    end if;
  end if;
  select coalesce(jsonb_agg(interno.rede_post_json(r) order by case when v_modo = 'chamados' then (r.chamado ->> 'quando')::timestamptz end, r.criado_em desc, r.id desc), '[]'::jsonb)
    into v_itens from rede_posts r where r.id = any (coalesce(v_ids, '{}'::uuid[]));
  return jsonb_build_object('itens', v_itens, 'proximo', v_proximo);
end $$;

/** "N novos" de uma linha: quantos posts de outras pessoas chegaram depois de p_desde (no máximo 100: o número só avisa). */
create or replace function public.rede_fix_novos(p_modo text, p_comunidade text, p_usuario uuid, p_desde timestamptz) returns integer language plpgsql stable security definer set search_path = interno, pg_temp as $$
begin
  if p_desde is null or p_modo not in ('tudo', 'seguindo', 'minhas', 'comunidade') then return 0; end if;
  perform interno.rede_fix_idade(false);
  return (select count(*)::integer from (
    select 1 from rede_posts p
    where p.criado_em > p_desde and p.autor is distinct from auth.uid() and interno.rede_ve(p)
      and interno.rede_fix_na_linha(p, p_modo, p_comunidade, p_usuario) limit 100) z);
end $$;

/**
 * "N novos" por aba, de uma vez: p_desde = {"seguindo": iso, "minhas": iso, "tudo": iso} (a última vez que a pessoa abriu cada aba).
 * Devolve {"seguindo": n, "minhas": n, "tudo": n}; aba sem data fica de fora. Só números.
 */
create or replace function public.rede_fix_novos_abas(p_desde jsonb) returns jsonb language plpgsql stable security definer set search_path = interno, pg_temp as $$
declare v_aba text; v_quando timestamptz; v_saida jsonb := '{}'::jsonb;
begin
  if p_desde is null or jsonb_typeof(p_desde) <> 'object' then return v_saida; end if;
  perform interno.rede_fix_idade(false);
  foreach v_aba in array array['seguindo', 'minhas', 'tudo'] loop
    begin
      v_quando := (p_desde ->> v_aba)::timestamptz;
    exception when others then v_quando := null;
    end;
    if v_quando is not null then
      v_saida := v_saida || jsonb_build_object(v_aba, public.rede_fix_novos(v_aba, null, null, v_quando));
    end if;
  end loop;
  return v_saida;
end $$;

-- As leituras antigas ganham só a conferência de idade (quem declarou menos de 18 fica fora da Rede).
create or replace function public.rede_linha(p_modo text default 'tudo', p_comunidade text default null, p_usuario uuid default null, p_antes timestamptz default null) returns jsonb
language plpgsql stable security definer set search_path = interno, pg_temp as $$
begin
  perform interno.rede_fix_idade(false);
  if p_modo = 'perfil' and p_usuario is not null and p_usuario is distinct from auth.uid() and coalesce((select rede_invisivel from perfis where id = p_usuario), false) then
    return '[]'::jsonb;
  end if;
  return coalesce((select jsonb_agg(interno.rede_post_json(x) order by case when p_modo = 'chamados' then (x.chamado ->> 'quando')::timestamptz end, x.criado_em desc) from (
    select p.* from rede_posts p
    where interno.rede_ve(p) and (p_antes is null or p.criado_em < p_antes) and interno.rede_fix_na_linha(p, p_modo, p_comunidade, p_usuario)
    order by p.criado_em desc limit 40) x), '[]'::jsonb);
end $$;

create or replace function public.rede_post_ver(p_id uuid) returns jsonb language plpgsql stable security definer set search_path = interno, pg_temp as $$
declare x rede_posts;
begin
  perform interno.rede_fix_idade(false);
  select * into x from rede_posts where id = p_id;
  if not found or not interno.rede_ve(x) then perform interno.erro('nao_encontrado'); end if;
  return jsonb_build_object('post', interno.rede_post_json(x),
    'respostas', (select coalesce(jsonb_agg(interno.rede_post_json(r) order by r.criado_em), '[]'::jsonb) from rede_posts r where r.resposta_a = x.id and interno.rede_ve(r)));
end $$;

create or replace function public.rede_buscar(p_termo text) returns jsonb language plpgsql stable security definer set search_path = interno, pg_temp as $$
declare v_termo text := btrim(left(coalesce(p_termo, ''), 80));
begin
  perform interno.rede_fix_idade(false);
  if char_length(v_termo) < 2 then return '[]'::jsonb; end if;
  perform interno.limite('rede_buscar', 120, 60);
  return coalesce((select jsonb_agg(interno.rede_post_json(x) order by x.criado_em desc) from (
    select p.* from rede_posts p where interno.rede_ve(p) and position(lower(v_termo) in lower(p.texto)) > 0 order by p.criado_em desc limit 40) x), '[]'::jsonb);
end $$;

-- ── 5. Segunda avaliação externa: o ramo 'rede' ────────────────────────────
-- Cópias das três funções do install.sql, só com o ramo acrescentado. Quem cuida da fila vê o resultado como antes.

create or replace function public.comunidade_para_avaliar(p_tipo text, p_id uuid) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v_texto text;
begin
  if not interno.servico() then perform interno.erro('sem_permissao'); end if;
  if interno.aprovacao_manual() or not interno.avaliacao_externa() then return null; end if;
  if p_tipo = 'topico' then
    update topicos set motivo = 'em_avaliacao', avaliacao_em = now(), tentativas = tentativas + 1
    where id = p_id and retido and tentativas < 3
      and (motivo = 'aguardando_avaliacao' or (motivo in ('em_avaliacao', 'avaliacao_externa_falhou') and avaliacao_em < now() - interval '2 minutes'))
    returning titulo || E'\n\n' || corpo into v_texto;
  elsif p_tipo = 'resposta' then
    update respostas set motivo = 'em_avaliacao', avaliacao_em = now(), tentativas = tentativas + 1
    where id = p_id and retido and tentativas < 3
      and (motivo = 'aguardando_avaliacao' or (motivo in ('em_avaliacao', 'avaliacao_externa_falhou') and avaliacao_em < now() - interval '2 minutes'))
    returning corpo into v_texto;
  elsif p_tipo = 'comentario' then
    update comentarios set motivo = 'em_avaliacao', avaliacao_em = now(), tentativas = tentativas + 1
    where id = p_id and retido and tentativas < 3
      and (motivo = 'aguardando_avaliacao' or (motivo in ('em_avaliacao', 'avaliacao_externa_falhou') and avaliacao_em < now() - interval '2 minutes'))
    returning corpo into v_texto;
  elsif p_tipo = 'aula_chat' then
    update aulas_chat set motivo = 'em_avaliacao', avaliacao_em = now(), tentativas = tentativas + 1
    where id = p_id and retido and tentativas < 3
      and (motivo = 'aguardando_avaliacao' or (motivo in ('em_avaliacao', 'avaliacao_externa_falhou') and avaliacao_em < now() - interval '2 minutes'))
    returning corpo into v_texto;
  elsif p_tipo = 'rede' then
    -- Post da Rede (a de hoje e a v2): título, corpo, texto e o ponto do chamado, na mesma ordem em que a pessoa escreveu.
    update rede_posts set motivo = 'em_avaliacao', avaliacao_em = now(), tentativas = tentativas + 1
    where id = p_id and retido and tentativas < 3
      and (motivo = 'aguardando_avaliacao' or (motivo in ('em_avaliacao', 'avaliacao_externa_falhou') and avaliacao_em < now() - interval '2 minutes'))
    returning concat_ws(E'

', nullif(titulo, ''), nullif(corpo, ''), nullif(texto, ''), nullif(chamado ->> 'onde', '')) into v_texto;
  else
    perform interno.erro('invalido:tipo');
  end if;
  if v_texto is null then return null; end if;
  return jsonb_build_object('texto', v_texto);
end $$;

create or replace function public.comunidade_avaliada(p_tipo text, p_id uuid, p_resultado jsonb) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v jsonb := interno.decidir_externa(p_resultado); v_veredito text := v ->> 'veredito'; v_topico uuid; v_achou boolean := false; v_rede record;
begin
  if not interno.servico() then perform interno.erro('sem_permissao'); end if;
  -- Modo de segurança ligado (ou segunda avaliação desligada) depois de a mensagem ter saído para avaliar: o resultado não publica.
  if v_veredito = 'publicar' and (interno.aprovacao_manual() or not interno.avaliacao_externa()) then
    v_veredito := 'revisar'; v := jsonb_build_object('veredito', 'revisar', 'motivo', 'modo_seguranca');
  end if;
  -- Anota quando a segunda avaliação respondeu de verdade pela última vez, e se respondeu com resultado ou com falha.
  update configuracoes set valor = valor || jsonb_build_object('ultima_avaliacao', jsonb_build_object('em', now(), 'ok', v ->> 'motivo' is distinct from 'avaliacao_externa_falhou',
    'falha', case when jsonb_typeof(p_resultado) = 'object' then left(coalesce(p_resultado ->> 'erro', ''), 40) else 'resultado_invalido' end)) where chave = 'comunidade';
  if p_tipo = 'topico' then
    update topicos set
      oculto = (v_veredito <> 'publicar'), retido = (v_veredito = 'revisar'), motivo = v ->> 'motivo',
      avaliacao = case v_veredito when 'publicar' then 'publicada' when 'bloquear' then 'bloqueada' else 'revisao' end
    where id = p_id and retido and motivo = 'em_avaliacao';
    v_achou := found;
  elsif p_tipo = 'resposta' then
    update respostas set
      oculto = (v_veredito <> 'publicar'), retido = (v_veredito = 'revisar'), motivo = v ->> 'motivo',
      avaliacao = case v_veredito when 'publicar' then 'publicada' when 'bloquear' then 'bloqueada' else 'revisao' end
    where id = p_id and retido and motivo = 'em_avaliacao' returning topico into v_topico;
    v_achou := found;
    if v_achou and v_veredito = 'publicar' then update topicos set respostas = respostas + 1 where id = v_topico; end if;
  elsif p_tipo = 'comentario' then
    update comentarios set
      oculto = (v_veredito <> 'publicar'), retido = (v_veredito = 'revisar'), motivo = v ->> 'motivo',
      avaliacao = case v_veredito when 'publicar' then 'publicada' when 'bloquear' then 'bloqueada' else 'revisao' end
    where id = p_id and retido and motivo = 'em_avaliacao';
    v_achou := found;
  elsif p_tipo = 'aula_chat' then
    update aulas_chat set
      oculta = (v_veredito <> 'publicar'), retido = (v_veredito = 'revisar'), motivo = v ->> 'motivo',
      avaliacao = case v_veredito when 'publicar' then 'publicada' when 'bloquear' then 'bloqueada' else 'revisao' end
    where id = p_id and retido and motivo = 'em_avaliacao';
    v_achou := found;
  elsif p_tipo = 'rede' then
    update rede_posts set
      oculto = (v_veredito <> 'publicar'), retido = (v_veredito = 'revisar'), motivo = v ->> 'motivo',
      avaliacao = case v_veredito when 'publicar' then 'publicada' when 'bloquear' then 'bloqueada' else 'revisao' end
    where id = p_id and retido and motivo = 'em_avaliacao'
    returning autor, resposta_a, texto, titulo into v_rede;
    v_achou := found;
    -- A resposta que ficou esperando só avisa quem foi respondido quando é publicada (o aviso saiu da fila junto com ela).
    if v_achou and v_veredito = 'publicar' and v_rede.resposta_a is not null then
      perform interno.avisar_em((select o.autor from rede_posts o where o.id = v_rede.resposta_a and o.autor is distinct from v_rede.autor and not interno.rede_bloqueado(v_rede.autor, o.autor)),
        format('%s respondeu ao seu post na Rede Lúcia: “%s”', interno.rede_nome(v_rede.autor), left(coalesce(nullif(v_rede.texto, ''), v_rede.titulo, ''), 120)), 'rede');
    end if;
  else
    perform interno.erro('invalido:tipo');
  end if;
  if not v_achou then return jsonb_build_object('veredito', 'ignorado'); end if;
  if v_veredito = 'bloquear' then
    insert into auditoria (quem, nome, acao, alvo, detalhes) values (null, 'avaliação automática', 'comunidade_bloqueada', p_id::text, jsonb_build_object('tipo', p_tipo, 'motivo', v ->> 'motivo'));
  end if;
  return jsonb_build_object('veredito', v_veredito);
end $$;

create or replace function public.comunidade_pendentes() returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
begin
  if not interno.servico() then perform interno.erro('sem_permissao'); end if;
  if interno.aprovacao_manual() or not interno.avaliacao_externa() then return '[]'::jsonb; end if;
  return (
    select coalesce(jsonb_agg(jsonb_build_object('tipo', x.tipo, 'id', x.id) order by x.criado_em), '[]'::jsonb) from (
      select 'topico' as tipo, id, criado_em from topicos
      where retido and tentativas < 3 and (motivo = 'aguardando_avaliacao' or (motivo in ('em_avaliacao', 'avaliacao_externa_falhou') and avaliacao_em < now() - interval '2 minutes'))
      union all
      select 'resposta', id, criado_em from respostas
      where retido and tentativas < 3 and (motivo = 'aguardando_avaliacao' or (motivo in ('em_avaliacao', 'avaliacao_externa_falhou') and avaliacao_em < now() - interval '2 minutes'))
      union all
      select 'comentario', id, criado_em from comentarios
      where retido and tentativas < 3 and (motivo = 'aguardando_avaliacao' or (motivo in ('em_avaliacao', 'avaliacao_externa_falhou') and avaliacao_em < now() - interval '2 minutes'))
      union all
      select 'aula_chat', id, criado_em from aulas_chat
      where retido and tentativas < 3 and (motivo = 'aguardando_avaliacao' or (motivo in ('em_avaliacao', 'avaliacao_externa_falhou') and avaliacao_em < now() - interval '2 minutes'))
      union all
      select 'rede', id, criado_em from rede_posts
      where retido and tentativas < 3 and (motivo = 'aguardando_avaliacao' or (motivo in ('em_avaliacao', 'avaliacao_externa_falhou') and avaliacao_em < now() - interval '2 minutes'))
      order by criado_em limit 20) x);
end $$;

-- ── 6. Convites com hash, validade e limite de usos ────────────────────────
-- O banco guarda só o sha256 do código: quem lê a tabela não entra com ele. O código aparece uma única vez, para quem o gerou.
-- Serve a núcleo (rede_nucleos, v2) e a espaço fechado (rede_espacos, a Rede de hoje).

/** Quem cuida deste destino? Mediação do núcleo, quem cuida do espaço, ou a mediação geral (interno.cuida). */
create or replace function interno.rede_fix_cuida(p_espaco text, p_nucleo uuid, p_quem uuid) returns boolean language sql stable security definer set search_path = interno, pg_temp as $$
  select p_quem is not null and (
    (p_espaco is not null and exists (select 1 from rede_espaco_membros m where m.espaco = p_espaco and m.usuario = p_quem and m.cuida))
    or (p_nucleo is not null and exists (select 1 from rede_nucleo_membros m where m.nucleo = p_nucleo and m.usuario = p_quem and m.papel = 'mediacao'))
    or interno.cuida())
$$;

/** O código em texto de um espaço, depois dos 30 dias, é trocado por um sorteado: o que está guardado deixa de servir. */
create or replace function interno.rede_fix_expirar_codigos() returns void language sql volatile security definer set search_path = interno, pg_temp as $$
  update rede_espacos set codigo = substr(md5(random()::text || clock_timestamp()::text || slug), 1, 12), codigo_apagado_em = now()
  where codigo_expira_em is not null and codigo_expira_em <= now() and codigo_apagado_em is null
$$;

/** Destino de um pedido: 'fechado-…' é espaço; um uuid é núcleo. */
create or replace function interno.rede_fix_alvo(p_alvo text, out p_espaco text, out p_nucleo uuid) language plpgsql stable security definer set search_path = interno, pg_temp as $$
begin
  p_espaco := null; p_nucleo := null;
  if coalesce(p_alvo, '') ~ '^fechado-[a-z0-9-]{2,50}$' then
    if not exists (select 1 from rede_espacos where slug = p_alvo) then perform interno.erro('nao_encontrado'); end if;
    p_espaco := p_alvo;
  else
    begin
      p_nucleo := p_alvo::uuid;
    exception when others then perform interno.erro('invalido:alvo');
    end;
    if not exists (select 1 from rede_nucleos where id = p_nucleo) then perform interno.erro('nao_encontrado'); end if;
  end if;
end $$;

/**
 * Gera um convite: validade de 1 a 30 dias (padrão 7) e de 1 a 200 usos (padrão 1). Escopo 'mediacao' entrega quem cuida.
 * Devolve o código uma única vez. Só quem cuida do destino gera; o registro guarda quem gerou, nunca o código.
 */
create or replace function public.rede_fix_convite_criar(p_alvo text, p_escopo text default 'membro', p_dias integer default 7, p_usos integer default 1) returns jsonb
language plpgsql volatile security definer set search_path = interno, pg_temp as $$
declare
  v uuid := interno.eu(); a record; v_codigo text; v_id uuid; v_validade timestamptz;
  v_dias integer := coalesce(p_dias, 7); v_usos integer := coalesce(p_usos, 1); v_escopo text := coalesce(nullif(p_escopo, ''), 'membro');
begin
  perform interno.rede_fix_idade(true);
  perform interno.limite('rede_fix_convite', 30, 60);
  select * into a from interno.rede_fix_alvo(p_alvo);
  if not interno.rede_fix_cuida(a.p_espaco, a.p_nucleo, v) then perform interno.erro('sem_permissao'); end if;
  if v_escopo not in ('membro', 'mediacao') then perform interno.erro('invalido:escopo'); end if;
  if v_dias not between 1 and 30 then perform interno.erro('invalido:dias'); end if;
  if v_usos not between 1 and 200 then perform interno.erro('invalido:usos'); end if;
  perform interno.rede_fix_expirar_codigos();
  v_codigo := replace(gen_random_uuid()::text, '-', '');
  v_validade := now() + make_interval(days => v_dias);
  insert into rede_convites (nucleo, espaco, token_hash, escopo, validade, usos_max, convidou)
  values (a.p_nucleo, a.p_espaco, encode(sha256(convert_to(v_codigo, 'UTF8')), 'hex'), v_escopo, v_validade, v_usos, v)
  returning id into v_id;
  perform interno.registrar('rede_convite_criado', v_id::text, jsonb_build_object('alvo', coalesce(a.p_espaco, a.p_nucleo::text), 'escopo', v_escopo, 'dias', v_dias, 'usos', v_usos));
  return jsonb_build_object('id', v_id, 'codigo', v_codigo, 'validade', v_validade, 'usos_max', v_usos, 'escopo', v_escopo);
end $$;

/**
 * Entrar com um convite. Código novo (32 letras e números): confere o hash, a validade, a revogação e o limite de usos. Código antigo
 * de espaço (12 caracteres): só enquanto os 30 dias não passaram. Convite que não vale responde sempre "convite_vencido", sem dizer
 * por quê. Exige conta ativa, 18+ e, para núcleo, o consentimento da Rede. Quem já é do destino entra sem gastar um uso.
 */
create or replace function public.rede_fix_convite_usar(p_codigo text) returns jsonb language plpgsql volatile security definer set search_path = interno, pg_temp as $$
declare
  v uuid := interno.eu(); c rede_convites; e rede_espacos; n rede_nucleos;
  v_cru text := btrim(coalesce(p_codigo, ''));
  v_norm text := lower(regexp_replace(v_cru, '[^a-zA-Z0-9]', '', 'g'));
begin
  perform interno.rede_fix_idade(true);
  perform interno.limite('rede_fix_convite_usar', 20, 60);
  perform interno.rede_fix_expirar_codigos();
  if char_length(v_cru) = 12 and v_cru ~ '^[A-Za-z0-9]{12}$' then
    select * into e from rede_espacos where codigo = v_cru and codigo_expira_em is not null and codigo_expira_em > now() and codigo_apagado_em is null;
    if not found then return jsonb_build_object('ok', false, 'erro', 'convite_vencido'); end if;
    insert into rede_espaco_membros (espaco, usuario) values (e.slug, v) on conflict do nothing;
    return jsonb_build_object('ok', true, 'tipo', 'espaco', 'slug', e.slug, 'nome', e.nome, 'antigo', true);
  end if;
  if v_norm !~ '^[a-f0-9]{32}$' then return jsonb_build_object('ok', false, 'erro', 'convite_vencido'); end if;
  select * into c from rede_convites where token_hash = encode(sha256(convert_to(v_norm, 'UTF8')), 'hex') for update;
  if not found or c.revogado_em is not null or c.validade <= now() then return jsonb_build_object('ok', false, 'erro', 'convite_vencido'); end if;
  if c.espaco is not null then
    select * into e from rede_espacos where slug = c.espaco;
    if not exists (select 1 from rede_espaco_membros where espaco = c.espaco and usuario = v) then
      if c.usos >= c.usos_max then return jsonb_build_object('ok', false, 'erro', 'convite_vencido'); end if;
      insert into rede_espaco_membros (espaco, usuario, cuida) values (c.espaco, v, c.escopo = 'mediacao');
      update rede_convites set usos = usos + 1 where id = c.id;
    end if;
    return jsonb_build_object('ok', true, 'tipo', 'espaco', 'slug', e.slug, 'nome', e.nome);
  end if;
  if not interno.rede2_membro(v) then perform interno.erro('consentimento'); end if;
  select * into n from rede_nucleos where id = c.nucleo;
  if not exists (select 1 from rede_nucleo_membros where nucleo = c.nucleo and usuario = v) then
    if c.usos >= c.usos_max then return jsonb_build_object('ok', false, 'erro', 'convite_vencido'); end if;
    insert into rede_nucleo_membros (nucleo, usuario, papel) values (c.nucleo, v, case c.escopo when 'mediacao' then 'mediacao' else 'membro' end);
    update rede_convites set usos = usos + 1 where id = c.id;
  end if;
  return jsonb_build_object('ok', true, 'tipo', 'nucleo', 'nucleo', n.id, 'nome', n.nome);
end $$;

/** Revoga um convite (a qualquer hora). Só quem cuida do destino. Quem já entrou continua; o convite deixa de valer. */
create or replace function public.rede_fix_convite_revogar(p_id uuid) returns jsonb language plpgsql volatile security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); c rede_convites;
begin
  select * into c from rede_convites where id = p_id;
  if not found then perform interno.erro('nao_encontrado'); end if;
  if not interno.rede_fix_cuida(c.espaco, c.nucleo, v) then perform interno.erro('sem_permissao'); end if;
  update rede_convites set revogado_em = coalesce(revogado_em, now()) where id = p_id;
  perform interno.registrar('rede_convite_revogado', p_id::text);
  return jsonb_build_object('ok', true);
end $$;

/** Os convites de um destino, sem o código (que ninguém, nem o banco, guarda): estado, validade e usos. Só quem cuida. */
create or replace function public.rede_fix_convites_listar(p_alvo text) returns jsonb language plpgsql stable security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); a record;
begin
  select * into a from interno.rede_fix_alvo(p_alvo);
  if not interno.rede_fix_cuida(a.p_espaco, a.p_nucleo, v) then perform interno.erro('sem_permissao'); end if;
  return coalesce((select jsonb_agg(jsonb_build_object('id', c.id, 'escopo', c.escopo, 'validade', c.validade, 'usos', c.usos, 'usos_max', c.usos_max,
      'revogado', c.revogado_em is not null, 'vencido', c.validade <= now() or c.usos >= c.usos_max, 'criado_em', c.criado_em) order by c.criado_em desc)
    from (select * from rede_convites where (espaco is not distinct from a.p_espaco) and (nucleo is not distinct from a.p_nucleo) order by criado_em desc limit 50) c), '[]'::jsonb);
end $$;

-- A Rede de hoje: as quatro funções dos espaços fechados passam a usar convite com hash. O 12 caracteres antigo expira.
create or replace function public.rede_espaco_criar(p_nome text, p_descricao text default '') returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); v_nome text := interno.txt(p_nome, 'nome', 3, 60); v_slug text; v_convite jsonb;
begin
  if not interno.voluntario() then perform interno.erro('sem_permissao'); end if;
  perform interno.rede_fix_idade(true);
  perform interno.limite('rede_espaco', 5, 1440);
  v_slug := 'fechado-' || left(trim(both '-' from regexp_replace(lower(translate(v_nome, 'áàâãäéèêëíìîïóòôõöúùûüçñ', 'aaaaaeeeeiiiiooooouuuucn')), '[^a-z0-9]+', '-', 'g')), 40) || '-' || substr(md5(random()::text), 1, 4);
  -- A coluna "codigo" é do desenho antigo (não pode ser nula): vai um sorteio que nunca é mostrado e já nasce vencido.
  insert into rede_espacos (slug, nome, descricao, criado_por, codigo, codigo_expira_em, codigo_apagado_em)
  values (v_slug, v_nome, interno.txt(coalesce(p_descricao, ''), 'descricao', 0, 300), v, substr(md5(random()::text || clock_timestamp()::text), 1, 12), now(), now());
  insert into rede_espaco_membros (espaco, usuario, cuida) values (v_slug, v, true);
  v_convite := public.rede_fix_convite_criar(v_slug, 'membro', 7, 20);
  return jsonb_build_object('slug', v_slug, 'codigo', v_convite ->> 'codigo', 'validade', v_convite -> 'validade');
end $$;

/** Mesmo contrato de rede_fix_convite_usar ({ok: false, erro} quando o convite não vale). */
create or replace function public.rede_espaco_entrar(p_codigo text) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
begin
  return public.rede_fix_convite_usar(p_codigo);
end $$;

/** Quem cuida: 'novo_codigo' revoga os convites e o código antigo e gera um convite novo; 'tirar' tira alguém (como antes). */
create or replace function public.rede_espaco_cuidar(p_slug text, p_acao text, p_usuario uuid default null) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); v_convite jsonb;
begin
  if not interno.rede_fix_cuida(p_slug, null, v) then perform interno.erro('sem_permissao'); end if;
  if p_acao = 'novo_codigo' then
    update rede_convites set revogado_em = now() where espaco = p_slug and revogado_em is null;
    update rede_espacos set codigo_expira_em = now() where slug = p_slug and (codigo_expira_em is null or codigo_expira_em > now());
    v_convite := public.rede_fix_convite_criar(p_slug, 'membro', 7, 20);
    return jsonb_build_object('codigo', v_convite ->> 'codigo', 'validade', v_convite -> 'validade');
  elsif p_acao = 'tirar' and p_usuario is not null and p_usuario <> v then
    delete from rede_espaco_membros where espaco = p_slug and usuario = p_usuario;
    return jsonb_build_object('ok', true);
  end if;
  perform interno.erro('invalido:acao');
end $$;

/** Os espaços fechados da pessoa. Nunca devolve código: quem cuida vê quantos convites valem e até quando vale o código antigo. */
create or replace function public.rede_meus_espacos() returns jsonb language plpgsql stable security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu();
begin
  return (select coalesce(jsonb_agg(jsonb_build_object('slug', e.slug, 'nome', e.nome, 'descricao', e.descricao, 'cuido', m.cuida, 'codigo', null,
            'convites', case when m.cuida then (select count(*) from rede_convites c where c.espaco = e.slug and c.revogado_em is null and c.validade > now() and c.usos < c.usos_max) end,
            'codigo_antigo_ate', case when m.cuida and e.codigo_expira_em > now() and e.codigo_apagado_em is null then e.codigo_expira_em end,
            'membros', (select count(*) from rede_espaco_membros x where x.espaco = e.slug)) order by e.nome), '[]'::jsonb)
          from rede_espaco_membros m join rede_espacos e on e.slug = m.espaco where m.usuario = v);
end $$;

/** Só o serviço (a rotina diária de limpeza): troca os códigos em texto vencidos por um sorteado. */
create or replace function public.rede_fix_manutencao() returns jsonb language plpgsql volatile security definer set search_path = interno, pg_temp as $$
begin
  if not interno.servico() then perform interno.erro('sem_permissao'); end if;
  perform interno.rede_fix_expirar_codigos();
  return jsonb_build_object('ok', true);
end $$;
revoke all on function public.rede_fix_manutencao() from public, anon, authenticated;
grant execute on function public.rede_fix_manutencao() to service_role;

-- Os códigos em texto que existem hoje valem por mais 30 dias, uma vez só (rodar de novo não estende), e quem cuida é avisado.
update interno.rede_espacos set codigo_expira_em = now() + interval '30 days' where codigo_expira_em is null;
do $$
declare e record; m record;
begin
  for e in select slug, nome, codigo_expira_em from interno.rede_espacos where codigo_expira_em > now() and codigo_aviso_em is null and codigo_apagado_em is null loop
    for m in select usuario from interno.rede_espaco_membros where espaco = e.slug and cuida loop
      perform interno.avisar_em(m.usuario, format('O código de convite em texto do espaço “%s” deixa de valer em %s. Gere um convite novo, com validade e limite de usos, em Núcleos fechados.', e.nome, to_char(e.codigo_expira_em, 'DD/MM/YYYY')), 'rede');
    end loop;
    update interno.rede_espacos set codigo_aviso_em = now() where slug = e.slug;
  end loop;
end $$;

-- ── 7. Permissões ──────────────────────────────────────────────────────────
-- As funções internas nunca são executáveis pelo cliente; as públicas, só as listadas.

do $$
declare f record;
begin
  for f in select p.oid::regprocedure as assinatura from pg_proc p join pg_namespace n on n.oid = p.pronamespace
           where n.nspname = 'interno' and p.proname in ('rede_fix_menor_trava', 'rede_fix_idade', 'rede_post_json', 'rede_fix_na_linha', 'rede_fix_cuida', 'rede_fix_expirar_codigos', 'rede_fix_alvo') loop
    execute format('revoke all on function %s from public, anon, authenticated', f.assinatura);
  end loop;
  for f in select p.oid::regprocedure as assinatura from pg_proc p join pg_namespace n on n.oid = p.pronamespace
           where n.nspname = 'public' and p.proname in ('rede_confirmar_idade', 'rede_eu', 'rede_apoiar', 'rede_vou', 'rede_postar', 'rede_linha', 'rede_post_ver', 'rede_buscar',
             'rede_fix_linha', 'rede_fix_novos', 'rede_fix_novos_abas', 'rede_fix_idade_rever', 'rede_fix_convite_criar', 'rede_fix_convite_usar', 'rede_fix_convite_revogar',
             'rede_fix_convites_listar', 'rede_espaco_criar', 'rede_espaco_entrar', 'rede_espaco_cuidar', 'rede_meus_espacos') loop
    execute format('revoke all on function %s from public', f.assinatura);
    execute format('grant execute on function %s to anon, authenticated, service_role', f.assinatura);
  end loop;
  -- Escrita só com conta; a conferência de quem chama fica dentro de cada função.
  for f in select p.oid::regprocedure as assinatura from pg_proc p join pg_namespace n on n.oid = p.pronamespace
           where n.nspname = 'public' and p.proname in ('rede_fix_idade_rever', 'rede_fix_convite_criar', 'rede_fix_convite_usar', 'rede_fix_convite_revogar', 'rede_fix_convites_listar') loop
    execute format('revoke all on function %s from anon', f.assinatura);
  end loop;
end $$;
