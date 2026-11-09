-- Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
--
-- ═══════════════════════════ Alumia · Onda 5 · F1 · o back-end mínimo da cara nova (09/11/2026) ═══════════════════════════
-- docs/plano-2026-11/PLANO-ALUMIA.md, seções 5 (F1), 6 e 8. Roda DEPOIS da F0 (20261109-alumia-f0-contrato.sql). Idempotente:
-- pode rodar duas vezes sem estrago (scripts/testar-alumia-f1-banco.mjs roda duas vezes no banco local). NÃO está no install.sql:
-- o integrador cola no fim, na ordem F0→F9. NÃO rodar em produção sem o Jonathan.
--
-- O que a tela da F1 precisa para cada função funcionar de verdade:
--   1. Repostar (rede_repostagens): o post aparece na aba Seguindo de quem segue quem repostou. Só o próprio estado volta; a
--      lista de quem repostou e o total nunca saem do banco.
--   2. Rascunho no servidor (rede_rascunhos): só o dono lê, guarda e apaga; até 20 por pessoa; some em 30 dias.
--   3. Desfazer envio: o atraso de 10 s é do aparelho; esta função cobre o toque em "Desfazer" que chega quando o pedido já
--      saiu (até 30 s depois de publicado, só o autor, e nunca o que a triagem segurou).
--   4. Emblemas do menu: quantos avisos não lidos, conversas com novidade e atos confirmados que a PRÓPRIA pessoa tem.
--
-- Tudo em `interno` com RLS ligada e nenhuma permissão direta para anon/authenticated: só pelas funções abaixo (security
-- definer, search_path fixo, quem chama conferido, limites de uso por interno.limite).
--
-- Leis (conferidas no texto, leis-do-brasil): LGPD (Lei 13.709/2018) art. 5º, II e art. 11 — repostar é manifestação de opinião
-- política (dado sensível): por isso nenhuma função devolve QUEM repostou nem quantas pessoas repostaram; quem segue vê o post
-- na própria linha sem o nome de quem repostou. Art. 6º, III (necessidade) e art. 15, I (término do tratamento quando a
-- finalidade acaba): o rascunho guarda só texto e escolhas (nada de arquivo) e é apagado em 30 dias. Art. 18, VI (eliminação a
-- pedido): apagar rascunho e desfazer repost apagam a linha, não marcam. Art. 46 (segurança): RLS e nenhuma permissão direta.
-- ECA (Lei 8.069/1990) art. 17 (preservação da imagem e da identidade): a Rede só aceita quem confirmou 18 anos
-- (interno.rede2_membro); estas funções exigem a mesma regra para escrever.

-- ── 1. Repostar ─────────────────────────────────────────────────────────────────────────────────────────────────────────────
create table if not exists interno.rede_repostagens (
  quem uuid not null references interno.perfis (id) on delete cascade,
  post uuid not null references interno.rede_posts (id) on delete cascade,
  criado_em timestamptz not null default now(),
  primary key (quem, post)
);
create index if not exists rede_repostagens_post on interno.rede_repostagens (post);
create index if not exists rede_repostagens_tempo on interno.rede_repostagens (quem, criado_em desc);
alter table interno.rede_repostagens enable row level security;
revoke all on table interno.rede_repostagens from public;

/**
 * Este post pode ser repostado por p_quem? Só post de primeiro nível, visível a quem reposta, que não é dele, que não some
 * sozinho (F6) e cujo público é amplo (internet ou quem está na Alumia): repostar o que foi escrito para um grupo pequeno
 * (seguidores, comunidade, núcleo, equipe) espalharia o recado para fora de onde a autora quis.
 */
create or replace function interno.rede_alumia_repostavel(p interno.rede_posts, p_quem uuid) returns boolean
language sql stable security definer set search_path = interno, pg_temp as $$
  select p.id is not null and p_quem is not null and p.autor is distinct from p_quem
    and p.resposta_a is null and p.expira_em is null
    and not p.oculto and not p.retido and p.apagado_em is null
    and interno.rede2_publico(p) in ('internet', 'membros')
    and interno.rede_ve(p, p_quem)
$$;
revoke all on function interno.rede_alumia_repostavel(interno.rede_posts, uuid) from public;

/** Repostar (p_sim = true) ou desfazer. Devolve só o próprio estado: { repostei }. Desfazer vale sempre, mesmo se o post sumiu. */
create or replace function public.rede_pub_repostar(p_post uuid, p_sim boolean) returns jsonb
language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); x rede_posts;
begin
  perform interno.aberta('comunidade');
  if not interno.rede2_membro(v) then perform interno.erro('consentimento'); end if;
  perform interno.limite('alumia_repostar', 120, 60);
  if coalesce(p_sim, false) then
    select * into x from rede_posts where id = p_post;
    if not found or not interno.rede_ve(x, v) or x.oculto or x.retido or x.apagado_em is not null then perform interno.erro('nao_encontrado'); end if;
    if not interno.rede_alumia_repostavel(x, v) then perform interno.erro('sem_permissao'); end if;
    insert into rede_repostagens (quem, post) values (v, p_post) on conflict do nothing;
  else
    delete from rede_repostagens where quem = v and post = p_post;
  end if;
  return jsonb_build_object('repostei', exists (select 1 from rede_repostagens r where r.quem = v and r.post = p_post));
end $$;

/** Dos posts pedidos (até 50), quais EU repostei. Visitante: lista vazia. Nunca diz nada de outra pessoa. */
create or replace function public.rede_pub_repostados(p_ids uuid[]) returns jsonb
language plpgsql stable security definer set search_path = interno, pg_temp as $$
declare v uuid := auth.uid();
begin
  if v is null or p_ids is null then return '[]'::jsonb; end if;
  return coalesce((select jsonb_agg(r.post order by r.post) from rede_repostagens r where r.quem = v and r.post = any (p_ids[1:50])), '[]'::jsonb);
end $$;

/**
 * Os posts que quem eu sigo repostou, com o momento do repost mais recente em (p_desde, p_ate] (até 50, do mais novo ao mais
 * antigo), para a tela misturar na aba Seguindo na ordem de chegada. Cada post vem uma vez, com `repostado_em`, e SEM dizer
 * quem repostou nem quantos. Fora: o que eu mesma escrevi, o que eu não posso ver, o que silenciei, repost de quem eu bloqueei
 * ou me bloqueou, e de conta suspensa.
 */
create or replace function public.rede_pub_repostes(p_ate timestamptz default null, p_desde timestamptz default null, p_limite integer default 20) returns jsonb
language plpgsql volatile security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); v_lim integer := least(greatest(coalesce(p_limite, 20), 1), 50);
begin
  perform interno.aberta('comunidade');
  if not interno.rede2_membro(v) then perform interno.erro('consentimento'); end if;
  perform interno.limite('rede2_ler', 600, 60);
  return coalesce((
    select jsonb_agg(interno.rede_post_v2(p, v) || jsonb_build_object('repostado_em', z.quando) order by z.quando desc, p.id desc)
    from (
      select r.post, max(r.criado_em) as quando
      from rede_repostagens r
      join rede_seguindo s on s.quem = v and s.segue = r.quem
      join perfis f on f.id = r.quem and not f.suspenso
      where (p_ate is null or r.criado_em <= p_ate) and (p_desde is null or r.criado_em > p_desde)
        and not interno.rede_bloqueado(v, r.quem)
      group by r.post
      order by 2 desc
      limit v_lim * 2
    ) z
    join rede_posts p on p.id = z.post
    where p.autor is distinct from v and interno.rede_alumia_repostavel(p, v) and not interno.rede_silenciado(p, v)
  ), '[]'::jsonb);
end $$;

-- ── 2. Rascunho no servidor ─────────────────────────────────────────────────────────────────────────────────────────────────
-- Só texto e escolhas (o "pedido" do compositor, com as chaves conferidas uma a uma); arquivo nunca.
create table if not exists interno.rede_rascunhos (
  id uuid primary key default gen_random_uuid(),
  autor uuid not null references interno.perfis (id) on delete cascade,
  pedido jsonb not null,
  atualizado_em timestamptz not null default now(),
  check (jsonb_typeof(pedido) = 'object' and pg_column_size(pedido) <= 65536)
);
create index if not exists rede_rascunhos_autor on interno.rede_rascunhos (autor, atualizado_em desc);
create index if not exists rede_rascunhos_tempo on interno.rede_rascunhos (atualizado_em);
alter table interno.rede_rascunhos enable row level security;
revoke all on table interno.rede_rascunhos from public;

/** Apaga os rascunhos com mais de 30 dias (de todo mundo). Roda de vez em quando, dentro das funções abaixo. */
create or replace function interno.rede_rascunhos_faxina() returns integer
language plpgsql security definer set search_path = interno, pg_temp as $$
declare v_n integer;
begin
  delete from rede_rascunhos where atualizado_em < now() - interval '30 days';
  get diagnostics v_n = row_count;
  return v_n;
end $$;
revoke all on function interno.rede_rascunhos_faxina() from public;

/**
 * Confere e limpa o pedido de um rascunho. Só estas chaves ficam: tipo, texto, titulo, corpo, comunidade, publico,
 * responde_quem (qualquer outra é descartada). Tamanhos e listas como no compositor; nada escrito → 'invalido:vazio'.
 */
create or replace function interno.rede_rascunho_limpo(p jsonb) returns jsonb
language plpgsql stable set search_path = interno, pg_temp as $$
declare
  v_tipo text; v_texto text; v_titulo text; v_corpo text; v_com text; v_publico text; v_responde text;
begin
  if p is null or jsonb_typeof(p) <> 'object' then perform interno.erro('invalido:rascunho'); end if;
  v_tipo := coalesce(nullif(p ->> 'tipo', ''), 'post');
  v_texto := coalesce(p ->> 'texto', '');
  v_titulo := coalesce(p ->> 'titulo', '');
  v_corpo := coalesce(p ->> 'corpo', '');
  v_com := nullif(p ->> 'comunidade', '');
  v_publico := coalesce(nullif(p ->> 'publico', ''), 'membros');
  v_responde := coalesce(nullif(p ->> 'responde_quem', ''), 'todos');
  if v_tipo not in ('post', 'ato', 'enquete', 'longo', 'aviso') then perform interno.erro('invalido:tipo'); end if;
  if char_length(v_texto) > 2000 or char_length(v_titulo) > 300 or char_length(v_corpo) > 20000 then perform interno.erro('invalido:tamanho'); end if;
  if v_com is not null and v_com !~ '^[a-z0-9-]{2,60}$' then perform interno.erro('invalido:comunidade'); end if;
  if v_publico not in ('internet', 'membros', 'seguidores', 'comunidade', 'nucleo', 'equipe') then perform interno.erro('invalido:publico'); end if;
  if v_responde not in ('todos', 'seguindo', 'mencionados', 'ninguem') then perform interno.erro('invalido:responde_quem'); end if;
  if btrim(v_texto) = '' and btrim(v_titulo) = '' and btrim(v_corpo) = '' then perform interno.erro('invalido:vazio'); end if;
  return jsonb_build_object('tipo', v_tipo, 'texto', v_texto, 'titulo', v_titulo, 'corpo', v_corpo, 'comunidade', v_com,
    'publico', v_publico, 'responde_quem', v_responde);
end $$;
revoke all on function interno.rede_rascunho_limpo(jsonb) from public;

/**
 * Guarda (com p.id de um rascunho MEU, atualiza; sem id ou com id que não é meu ou já sumiu, cria) e devolve { id, atualizado_em }.
 * Novo além do 20º: 'limite_rascunhos' (a tela avisa que fica só no aparelho).
 */
create or replace function public.rede_pub_rascunho_salvar(p jsonb) returns jsonb
language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); v_pedido jsonb; v_id uuid; r rede_rascunhos;
begin
  perform interno.aberta('comunidade');
  if not interno.rede2_membro(v) then perform interno.erro('consentimento'); end if;
  perform interno.limite('alumia_rascunho', 600, 60);
  v_pedido := interno.rede_rascunho_limpo(p);
  delete from rede_rascunhos where autor = v and atualizado_em < now() - interval '30 days';
  if random() < 0.02 then perform interno.rede_rascunhos_faxina(); end if;
  begin
    v_id := nullif(p ->> 'id', '')::uuid;
  exception when others then
    v_id := null;
  end;
  if v_id is not null then
    update rede_rascunhos set pedido = v_pedido, atualizado_em = now() where id = v_id and autor = v returning * into r;
    if found then return jsonb_build_object('id', r.id, 'atualizado_em', r.atualizado_em); end if;
  end if;
  -- Um por vez por pessoa: dois salvamentos ao mesmo tempo não passam juntos do teto.
  perform pg_advisory_xact_lock(hashtextextended('rede_rascunhos:' || v::text, 0));
  if (select count(*) from rede_rascunhos where autor = v) >= 20 then perform interno.erro('limite_rascunhos'); end if;
  insert into rede_rascunhos (autor, pedido) values (v, v_pedido) returning * into r;
  return jsonb_build_object('id', r.id, 'atualizado_em', r.atualizado_em);
end $$;

/** Os MEUS rascunhos dos últimos 30 dias, do mais novo ao mais antigo (no máximo 20). Nunca os de outra pessoa. */
create or replace function public.rede_pub_rascunhos() returns jsonb
language plpgsql volatile security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu();
begin
  perform interno.aberta('comunidade');
  if not interno.rede2_membro(v) then perform interno.erro('consentimento'); end if;
  perform interno.limite('alumia_rascunhos_ler', 240, 60);
  delete from rede_rascunhos where autor = v and atualizado_em < now() - interval '30 days';
  return coalesce((
    select jsonb_agg(z.pedido || jsonb_build_object('id', z.id, 'atualizado_em', z.atualizado_em) order by z.atualizado_em desc)
    from (select * from rede_rascunhos where autor = v order by atualizado_em desc limit 20) z
  ), '[]'::jsonb);
end $$;

/** Apaga um rascunho MEU. O de outra pessoa (ou que não existe) dá { apagado: false }, sem dizer qual dos dois. */
create or replace function public.rede_pub_rascunho_apagar(p_id uuid) returns jsonb
language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu();
begin
  perform interno.limite('alumia_rascunho_apagar', 300, 60);
  delete from rede_rascunhos where id = p_id and autor = v;
  return jsonb_build_object('apagado', found);
end $$;

-- ── 3. Desfazer envio ───────────────────────────────────────────────────────────────────────────────────────────────────────
/**
 * Desfaz um post que acabou de sair: só o autor, até 30 s depois de publicado. Apaga de vez (o post, o que pendurou nele e, se
 * já tinha ido ao Fediverso, o gatilho da federação manda o Delete). Não desfaz o que a triagem segurou para revisão ou
 * bloqueou (a moderação precisa ver), nem o que já tem resposta de outra pessoa. Devolve { desfeito: true } ou um erro:
 * 'nao_encontrado' (não é meu ou não existe), 'prazo_passou', 'sem_permissao'.
 */
create or replace function public.rede_pub_desfazer(p_post uuid) returns jsonb
language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); x rede_posts;
begin
  perform interno.aberta('comunidade');
  perform interno.limite('alumia_desfazer', 30, 60);
  select * into x from rede_posts where id = p_post and autor = v for update;
  if not found or x.apagado_em is not null then perform interno.erro('nao_encontrado'); end if;
  if x.criado_em < now() - interval '30 seconds' then perform interno.erro('prazo_passou'); end if;
  if x.retido or x.oculto or coalesce(x.avaliacao, 'publicada') in ('revisao', 'bloqueada') then perform interno.erro('sem_permissao'); end if;
  if exists (select 1 from rede_posts r where r.resposta_a = x.id and r.autor is distinct from v) then perform interno.erro('sem_permissao'); end if;
  delete from rede_posts where id = x.id;
  return jsonb_build_object('desfeito', true);
end $$;

-- ── 4. Emblemas do menu ─────────────────────────────────────────────────────────────────────────────────────────────────────
/**
 * Os números dos emblemas do menu, todos da PRÓPRIA pessoa (nada de outra): avisos não lidos (mesma conta de rede_aviso_contar),
 * conversas com novidade (pedidos esperando + conversas com mensagem nova, a mesma regra de rede_dm_situacao) e atos que ela
 * confirmou ("Eu vou") e ainda vão acontecer. Visitante ou quem não é da Rede: tudo zero.
 */
create or replace function public.rede_alumia_emblemas() returns jsonb
language plpgsql volatile security definer set search_path = interno, pg_temp as $$
declare v uuid := auth.uid(); v_avisos integer := 0; v_conversas integer := 0; v_atos integer := 0;
begin
  if v is null or not interno.rede2_membro(v) or exists (select 1 from perfis where id = v and suspenso) then
    return jsonb_build_object('avisos', 0, 'conversas', 0, 'atos', 0);
  end if;
  perform interno.limite('rede_avisos_n', 600, 60);
  v_avisos := (select count(*)::integer from interno.rede3_aviso_grupos(v) g where not g.lido);
  v_conversas := (select count(*)::integer from rede_dm_conversas c
    where (c.a = v or c.b = v) and (
      (c.situacao = 'pedido' and c.pediu <> v and not interno.rede_bloqueado(v, c.pediu))
      or (c.situacao = 'aberta' and exists (select 1 from rede_dm_mensagens m where m.conversa = c.id and m.autor <> v and m.expira_em > now()
            and m.criado_em > coalesce(case when c.a = v then c.a_leu_em else c.b_leu_em end, '-infinity'::timestamptz)))));
  begin
    v_atos := (select count(*)::integer from rede_vou o join rede_posts p on p.id = o.post
      where o.usuario = v and p.chamado is not null and p.apagado_em is null and not p.oculto
        and (p.chamado ->> 'quando') ~ '^\d{4}-\d{2}-\d{2}' and (p.chamado ->> 'quando')::timestamptz > now());
  exception when others then
    v_atos := 0;
  end;
  return jsonb_build_object('avisos', v_avisos, 'conversas', v_conversas, 'atos', v_atos);
end $$;

-- ── 5. Permissões ───────────────────────────────────────────────────────────────────────────────────────────────────────────
revoke all on function public.rede_pub_repostar(uuid, boolean), public.rede_pub_repostados(uuid[]), public.rede_pub_repostes(timestamptz, timestamptz, integer),
  public.rede_pub_rascunho_salvar(jsonb), public.rede_pub_rascunhos(), public.rede_pub_rascunho_apagar(uuid), public.rede_pub_desfazer(uuid),
  public.rede_alumia_emblemas() from public;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on table interno.rede_repostagens, interno.rede_rascunhos from anon, authenticated;
    revoke all on function interno.rede_alumia_repostavel(interno.rede_posts, uuid), interno.rede_rascunhos_faxina(), interno.rede_rascunho_limpo(jsonb) from anon, authenticated;
    revoke all on function public.rede_pub_repostar(uuid, boolean), public.rede_pub_repostados(uuid[]), public.rede_pub_repostes(timestamptz, timestamptz, integer),
      public.rede_pub_rascunho_salvar(jsonb), public.rede_pub_rascunhos(), public.rede_pub_rascunho_apagar(uuid), public.rede_pub_desfazer(uuid),
      public.rede_alumia_emblemas() from anon;
    -- Tudo aqui é da própria conta: só quem entrou (e a chave de serviço, para o servidor).
    grant execute on function public.rede_pub_repostar(uuid, boolean), public.rede_pub_repostados(uuid[]), public.rede_pub_repostes(timestamptz, timestamptz, integer),
      public.rede_pub_rascunho_salvar(jsonb), public.rede_pub_rascunhos(), public.rede_pub_rascunho_apagar(uuid), public.rede_pub_desfazer(uuid),
      public.rede_alumia_emblemas() to authenticated, service_role;
    grant execute on function interno.rede_rascunhos_faxina() to service_role;
  end if;
end $$;

-- ═══════════════════════════ fim da F1 ═══════════════════════════
