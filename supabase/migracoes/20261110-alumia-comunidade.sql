-- Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
--
-- ═══════════════════ Alumia · polimento da comunidade e da conversa · seguir conversa e #tema (10/11/2026) ═══════════════════
-- docs/plano-2026-11/ALUMIA-FUNCOES-E-IDEIAS.md (Onda B: "seguir conversa" e "seguir hashtag") e PLANO-ALUMIA.md §6 e §12.
--   1. Seguir a conversa (rede_alumia_seguir_conversa): o sininho na barra "CONVERSA". Quem segue recebe aviso de resposta
--      nova na conversa inteira, AGRUPADO pela conversa (o mesmo grupo "resposta:<raiz>" de rede3_aviso_grupos), respeitando a
--      preferência "respostas" da pessoa, o bloqueio e a matriz de visibilidade.
--   2. Seguir um #tema (rede_alumia_seguir_tag, rede_alumia_tags_seguidas): a lista dos #temas que a PRÓPRIA pessoa segue,
--      mostrada no Explorar e na página do #tema. Não muda ordem de nada (sem algoritmo) e não gera aviso (sem ruído).
--   3. rede_alumia_seguindo: se a pessoa segue esta conversa e/ou este #tema (só ela pergunta sobre ela mesma).
--
-- Regras (PLANO-ALUMIA §5): tabelas em interno, RLS ligada e nenhuma permissão para anon/authenticated; acesso só pelas funções
-- security definer abaixo. Nenhuma função devolve QUEM segue nem QUANTOS seguem (nem o total agregado: seguir é sinal de
-- interesse político, e uma contagem por conversa viraria métrica de engajamento, PLANO-ALUMIA §12).
--
-- Leis (conferidas no texto): LGPD (Lei 13.709/2018) art. 5º, II e art. 11 — opinião política é dado sensível: o que alguém segue
-- só ela vê; art. 6º, III (necessidade): guarda só pessoa, conversa/tema e data, e some com a conta ou com o post (cascata);
-- art. 18, VI: deixar de seguir apaga a linha; art. 46: RLS e nenhuma permissão direta. ECA (Lei 8.069/1990) e ECA Digital (Lei
-- 15.211/2025): só membro da Rede (18+ confirmado, interno.rede2_membro) segue.
--
-- Idempotente (scripts/testar-alumia-comunidade.mjs roda duas vezes no banco local). Roda depois da F0..F5 e do Fediverso.
-- NÃO rodar em produção sem o Jonathan.

-- ── 1. Tabelas ────────────────────────────────────────────────────────────────────────────────────────────────────────────

create table if not exists interno.rede_alumia_seguir_conversa (
  raiz uuid not null references interno.rede_posts (id) on delete cascade,
  usuario uuid not null references interno.perfis (id) on delete cascade,
  criado_em timestamptz not null default now(),
  primary key (raiz, usuario)
);
create index if not exists rede_alumia_seguir_conversa_usuario on interno.rede_alumia_seguir_conversa (usuario);
alter table interno.rede_alumia_seguir_conversa enable row level security;

create table if not exists interno.rede_alumia_seguir_tag (
  usuario uuid not null references interno.perfis (id) on delete cascade,
  tag text not null check (tag ~ '^[a-z0-9_]{2,40}$' and tag ~ '[a-z_]'),
  criado_em timestamptz not null default now(),
  primary key (usuario, tag)
);
alter table interno.rede_alumia_seguir_tag enable row level security;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on table interno.rede_alumia_seguir_conversa, interno.rede_alumia_seguir_tag from anon, authenticated;
  end if;
end $$;

-- ── 2. Seguir a conversa ──────────────────────────────────────────────────────────────────────────────────────────────────

/**
 * Segue (p_sim = true) ou deixa de seguir a conversa do post p_post (sempre pela raiz). Só membro, que vê a raiz e o post, sem
 * bloqueio com quem abriu a conversa e não banido da comunidade. Até 500 conversas seguidas por pessoa. Devolve {seguindo}.
 */
create or replace function public.rede_alumia_seguir_conversa(p_post uuid, p_sim boolean default true) returns jsonb language plpgsql volatile security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); x rede_posts; r rede_posts;
begin
  perform interno.aberta('comunidade');
  if not interno.rede2_membro(v) then perform interno.erro('consentimento'); end if;
  select * into x from rede_posts where id = p_post;
  if not found or not interno.rede_ve(x, v) or x.apagado_em is not null then perform interno.erro('nao_encontrado'); end if;
  r := interno.rede3_conv_raiz(x);
  if r.id is null or not interno.rede_ve(r, v) or r.oculto or r.retido or r.apagado_em is not null then perform interno.erro('nao_encontrado'); end if;
  if not coalesce(p_sim, true) then
    delete from rede_alumia_seguir_conversa where raiz = r.id and usuario = v;
    return jsonb_build_object('seguindo', false);
  end if;
  if r.autor is not null and interno.rede_bloqueado(v, r.autor) then perform interno.erro('nao_encontrado'); end if;
  if r.comunidade is not null and interno.rede3_com_situacao(r.comunidade, v) = 'banido' then perform interno.erro('sem_permissao'); end if;
  perform interno.rede2_limite('seguir');
  if not exists (select 1 from rede_alumia_seguir_conversa where raiz = r.id and usuario = v)
     and (select count(*) from rede_alumia_seguir_conversa where usuario = v) >= 500 then
    perform interno.erro('invalido:muitas');
  end if;
  insert into rede_alumia_seguir_conversa (raiz, usuario) values (r.id, v) on conflict do nothing;
  return jsonb_build_object('seguindo', true);
end $$;

-- ── 3. Seguir um #tema ────────────────────────────────────────────────────────────────────────────────────────────────────

/** Segue (p_sim = true) ou deixa de seguir um #tema (com ou sem #, com ou sem acento). Até 100 por pessoa. Devolve {seguindo}. */
create or replace function public.rede_alumia_seguir_tag(p_tag text, p_sim boolean default true) returns jsonb language plpgsql volatile security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); v_tag text;
begin
  perform interno.aberta('comunidade');
  if not interno.rede2_membro(v) then perform interno.erro('consentimento'); end if;
  v_tag := interno.rede3_desc_tag_norm(p_tag);
  if not coalesce(p_sim, true) then
    delete from rede_alumia_seguir_tag where usuario = v and tag = v_tag;
    return jsonb_build_object('seguindo', false);
  end if;
  perform interno.rede2_limite('seguir');
  if not exists (select 1 from rede_alumia_seguir_tag where usuario = v and tag = v_tag)
     and (select count(*) from rede_alumia_seguir_tag where usuario = v) >= 100 then
    perform interno.erro('invalido:muitas');
  end if;
  insert into rede_alumia_seguir_tag (usuario, tag) values (v, v_tag) on conflict do nothing;
  return jsonb_build_object('seguindo', true);
end $$;

/** Os #temas que a própria pessoa segue, em ordem alfabética: {tags}. Visitante recebe a lista vazia. */
create or replace function public.rede_alumia_tags_seguidas() returns jsonb language plpgsql volatile security definer set search_path = interno, pg_temp as $$
declare v uuid := auth.uid();
begin
  perform interno.aberta('comunidade');
  if v is null then return jsonb_build_object('tags', '[]'::jsonb); end if;
  return jsonb_build_object('tags', (select coalesce(jsonb_agg(tag order by tag), '[]'::jsonb) from rede_alumia_seguir_tag where usuario = v));
end $$;

/**
 * Se a pessoa segue a conversa de p_post e/ou o #tema p_tag: {conversa, tag}. Nulo no que não foi perguntado; visitante recebe
 * nulo nos dois (a tela não mostra o botão). Post que ela não vê responde como não seguido (sem confirmar que existe).
 */
create or replace function public.rede_alumia_seguindo(p_post uuid default null, p_tag text default null) returns jsonb language plpgsql volatile security definer set search_path = interno, pg_temp as $$
declare v uuid := auth.uid(); x rede_posts; v_conv boolean; v_tag boolean;
begin
  perform interno.aberta('comunidade');
  if v is null then return jsonb_build_object('conversa', null, 'tag', null); end if;
  perform interno.limite('rede2_ler', 600, 60);
  if p_post is not null then
    select * into x from rede_posts where id = p_post;
    v_conv := found and interno.rede_ve(x, v) and exists (select 1 from rede_alumia_seguir_conversa s where s.raiz = coalesce(x.root_id, x.id) and s.usuario = v);
  end if;
  if nullif(btrim(coalesce(p_tag, '')), '') is not null then
    v_tag := exists (select 1 from rede_alumia_seguir_tag s where s.usuario = v and s.tag = interno.rede3_desc_tag_norm(p_tag));
  end if;
  return jsonb_build_object('conversa', v_conv, 'tag', v_tag);
end $$;

-- ── 4. O aviso agrupado de quem segue a conversa ──────────────────────────────────────────────────────────────────────────

/**
 * Resposta nova numa conversa: avisa quem segue (menos quem escreveu e quem recebeu a resposta, que a fundação já avisa), só se
 * essa pessoa pode ver a resposta. O aviso entra no grupo "resposta:<raiz>" (rede3_aviso_grupos): várias respostas viram UMA linha
 * "N respostas". rede3_aviso_criar confere bloqueio, conta suspensa e a preferência "respostas" no site. Até 500 por resposta.
 */
create or replace function interno.rede_alumia_aviso_seguidores() returns trigger language plpgsql security definer set search_path = interno, pg_temp as $$
declare v_raiz uuid := coalesce(new.root_id, new.id); v_pai uuid; s record;
begin
  if new.resposta_a is null or new.oculto or new.retido or new.apagado_em is not null then return null; end if;
  if not exists (select 1 from rede_alumia_seguir_conversa where raiz = v_raiz) then return null; end if;
  select autor into v_pai from rede_posts where id = new.resposta_a;
  for s in
    select usuario from rede_alumia_seguir_conversa
     where raiz = v_raiz and usuario is distinct from new.autor and usuario is distinct from v_pai
     order by criado_em limit 500
  loop
    if interno.rede_ve(new, s.usuario) then
      perform interno.rede3_aviso_criar(s.usuario, 'resposta', v_raiz, new.id, new.autor, 'Há respostas novas numa conversa que você segue na Alumia.');
    end if;
  end loop;
  return null;
end $$;
drop trigger if exists rede_alumia_aviso_seguidores on interno.rede_posts;
create trigger rede_alumia_aviso_seguidores after insert on interno.rede_posts for each row execute function interno.rede_alumia_aviso_seguidores();

-- ── 5. Permissões ─────────────────────────────────────────────────────────────────────────────────────────────────────────
revoke all on function interno.rede_alumia_aviso_seguidores() from public;
revoke all on function public.rede_alumia_seguir_conversa(uuid, boolean), public.rede_alumia_seguir_tag(text, boolean),
  public.rede_alumia_tags_seguidas(), public.rede_alumia_seguindo(uuid, text) from public;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on function interno.rede_alumia_aviso_seguidores() from anon, authenticated;
    revoke all on function public.rede_alumia_seguir_conversa(uuid, boolean), public.rede_alumia_seguir_tag(text, boolean),
      public.rede_alumia_tags_seguidas(), public.rede_alumia_seguindo(uuid, text) from anon, authenticated;
    grant execute on function public.rede_alumia_tags_seguidas(), public.rede_alumia_seguindo(uuid, text) to anon, authenticated, service_role;
    grant execute on function public.rede_alumia_seguir_conversa(uuid, boolean), public.rede_alumia_seguir_tag(text, boolean) to authenticated, service_role;
  end if;
end $$;

-- ═══════════════════════════ fim da Alumia · comunidade (seguir conversa e #tema) ═══════════════════════════
