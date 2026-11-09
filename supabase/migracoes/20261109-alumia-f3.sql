-- Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
--
-- ═══════════════════════════ Alumia · Onda 5 · F3 · o back-end mínimo das telas novas (09/11/2026) ═══════════════════════════
-- docs/plano-2026-11/PLANO-ALUMIA.md, seções 5 (F3), 6 e 8 (F3). O que as telas da F3 (comunidade, conversa e "Comunidades
-- ativas") precisam para funcionar de verdade, e nada além:
--   1. "N posts esta semana" na página da comunidade (rede_alumia_com_pagina): o que rede_com_pagina já devolve (com o post
--      "Fixado pela moderação", que só a moderação fixa por rede_com_fixar) + a contagem agregada dos últimos 7 dias.
--   2. "Comunidades ativas" da coluna (rede_alumia_ativas): as com mais posts na semana, sem algoritmo e sem patrocínio.
--   3. "ajudou a autora" (rede_alumia_ajudou): SÓ quem abriu a conversa marca (a moderação não; a regra antiga de "resolveu" da
--      dúvida, rede_conv_aceitar, continua como está para a rede de hoje). Uma por conversa, em tabela própria.
--   4. Reações com emoji (rede_alumia_reagir, rede_alumia_reacoes): lista FECHADA de 8, só o total por emoji, nunca quem.
--   5. A conversa da tela nova (rede_alumia_conversa): rede_conv_arvore + a marca "ajudou", quem pode marcar, os pronomes de
--      quem abriu (para o selo não errar o gênero de ninguém) e as reações do post aberto.
--
-- Regras (PLANO-ALUMIA §5): tabelas novas em interno com RLS e sem nenhuma permissão para anon/authenticated; acesso só pelas
-- funções security definer abaixo (search_path = interno, pg_temp), que conferem quem chama, bloqueio, visibilidade
-- (interno.rede_ve, a mesma matriz de toda a Rede) e limite de uso (interno.rede2_limite / interno.limite).
--
-- Leis (conferidas no texto, leis-do-brasil): LGPD (Lei 13.709/2018) art. 5º, II e art. 11 — opinião política e filiação são
-- dado pessoal sensível. Por isso: nenhuma função devolve quem reagiu, quem escreveu na semana ou quem marcou; todo total de
-- pessoas ou de posts só aparece a partir de 3 (abaixo, nulo = "poucas"/"poucos", docs/rede/PRIVACIDADE.md §8); art. 6º, III
-- (necessidade): a reação guarda só post, pessoa, emoji e data, e some com a conta (cascata) ou com o post; art. 46 (segurança):
-- RLS ligada e nenhuma permissão direta. ECA (Lei 8.069/1990) e ECA Digital: a Rede segue só para 18+ confirmado
-- (interno.rede2_membro), e só membro reage ou marca.
--
-- Idempotente: pode rodar duas vezes sem estrago (scripts/testar-alumia-f3-banco.mjs roda duas vezes no banco local). NÃO está
-- no install.sql: o integrador cola no fim, na ordem F0→F9. NÃO rodar em produção sem o Jonathan.

-- ── 1. Tabelas ────────────────────────────────────────────────────────────────────────────────────────────────────────────

/**
 * Reação com emoji: uma linha por (post, pessoa, emoji). A lista fechada é a mesma de lib/rede/tipos-conversa.ts (REACOES), na
 * mesma ordem: ✊ ❤️ 🔥 👏 🤔 😢 😡 📚. Nada de emoji livre (PLANO-ALUMIA §6.3 e §12).
 */
create table if not exists interno.rede_reacoes_emoji (
  post uuid not null references interno.rede_posts (id) on delete cascade,
  usuario uuid not null references interno.perfis (id) on delete cascade,
  emoji text not null check (emoji in ('✊', '❤️', '🔥', '👏', '🤔', '😢', '😡', '📚')),
  criado_em timestamptz not null default now(),
  primary key (post, usuario, emoji)
);
create index if not exists rede_reacoes_emoji_usuario on interno.rede_reacoes_emoji (usuario);
alter table interno.rede_reacoes_emoji enable row level security;

/** "ajudou a autora": a resposta que quem abriu a conversa marcou. Uma por conversa (raiz). */
create table if not exists interno.rede_ajudou (
  raiz uuid primary key references interno.rede_posts (id) on delete cascade,
  resposta uuid not null references interno.rede_posts (id) on delete cascade,
  marcado_em timestamptz not null default now()
);
create index if not exists rede_ajudou_resposta on interno.rede_ajudou (resposta);
alter table interno.rede_ajudou enable row level security;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on table interno.rede_reacoes_emoji, interno.rede_ajudou from anon, authenticated;
  end if;
end $$;

-- ── 2. Contas internas ────────────────────────────────────────────────────────────────────────────────────────────────────

/** A ordem da lista fechada (a tela mostra nesta ordem). */
create or replace function interno.rede_alumia_emojis() returns text[] language sql immutable as $$
  select array['✊', '❤️', '🔥', '👏', '🤔', '😢', '😡', '📚']::text[]
$$;

/** Total que pode sair: nulo abaixo de 3 (PLANO-ALUMIA §6.1). */
create or replace function interno.rede_alumia_agregado(p_n integer) returns integer language sql immutable as $$
  select case when p_n >= 3 then p_n end
$$;

/**
 * As reações de um post como a tela mostra: [{emoji, total, minha}] na ordem da lista, só os emojis com alguém (ou a minha).
 * total nulo abaixo de 3. NUNCA quem reagiu, nem para quem escreveu o post. Quem chama esta conta já conferiu que p_quem vê o post.
 */
create or replace function interno.rede_alumia_reacoes_de(p_post uuid, p_quem uuid) returns jsonb language sql stable security definer set search_path = interno, pg_temp as $$
  select coalesce(jsonb_agg(jsonb_build_object('emoji', z.emoji, 'total', interno.rede_alumia_agregado(z.n), 'minha', z.minha)
                            order by array_position(interno.rede_alumia_emojis(), z.emoji)), '[]'::jsonb)
  from (
    select r.emoji, count(*)::integer as n, bool_or(p_quem is not null and r.usuario = p_quem) as minha
    from rede_reacoes_emoji r where r.post = p_post group by r.emoji) z
$$;

/** Posts da comunidade nos últimos 7 dias (sem removido, retido nem apagado). Só a conta; quem decide se sai é quem chama. */
create or replace function interno.rede_alumia_posts_7d(p_slug text) returns integer language sql stable security definer set search_path = interno, pg_temp as $$
  select count(*)::integer from rede_posts p
  where p.comunidade = p_slug and p.criado_em > now() - interval '7 days' and not p.oculto and not p.retido and p.apagado_em is null
$$;

revoke all on function interno.rede_alumia_emojis(), interno.rede_alumia_agregado(integer), interno.rede_alumia_reacoes_de(uuid, uuid),
  interno.rede_alumia_posts_7d(text) from public;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on function interno.rede_alumia_emojis(), interno.rede_alumia_agregado(integer), interno.rede_alumia_reacoes_de(uuid, uuid),
      interno.rede_alumia_posts_7d(text) from anon, authenticated;
  end if;
end $$;

-- ── 3. Comunidade: "N posts esta semana" e "Comunidades ativas" ───────────────────────────────────────────────────────────

/**
 * A página da comunidade na tela nova: tudo o que rede_com_pagina devolve (que já confere a comunidade fechada, a amostra de
 * visitante e os fixados que a pessoa pode ver) + posts_7d, nulo abaixo de 3. Nunca quantos membros nem quem escreveu.
 */
create or replace function public.rede_alumia_com_pagina(p_slug text) returns jsonb language plpgsql volatile security definer set search_path = interno, pg_temp as $$
declare v_base jsonb; c rede_comunidades;
begin
  perform interno.limite('rede2_ler', 600, 60);
  v_base := public.rede_com_pagina(p_slug);
  c := interno.rede3_com_achar(p_slug);
  return v_base || jsonb_build_object('posts_7d', interno.rede_alumia_agregado(interno.rede_alumia_posts_7d(c.slug)));
end $$;

/**
 * "Comunidades ativas" (prancha computador-inicio): até p_quantas (1 a 10, padrão 4) com mais posts nos últimos 7 dias; no empate,
 * o nome. Entra só comunidade que a pessoa poderia abrir e com 3 posts ou mais na semana (abaixo disso, a conta poderia apontar
 * quem escreveu). Visitante só vê as disciplinas (das lutas e do Instituto, visitante vê só a amostra, sem contagem: T32).
 */
create or replace function public.rede_alumia_ativas(p_quantas integer default 4) returns jsonb language plpgsql volatile security definer set search_path = interno, pg_temp as $$
declare v uuid := auth.uid(); v_n integer := least(greatest(coalesce(p_quantas, 4), 1), 10);
begin
  perform interno.aberta('comunidade');
  perform interno.limite('rede2_ler', 600, 60);
  if v is not null and exists (select 1 from perfis f where f.id = v and f.suspenso) then perform interno.erro('conta_suspensa'); end if;
  return jsonb_build_object('regra', 'posts_7d', 'itens', (
    select coalesce(jsonb_agg(jsonb_build_object('slug', x.slug, 'nome', x.nome, 'descricao', x.descricao, 'categoria', x.categoria,
             'tipo', x.tipo, 'icone', x.icone, 'cor', x.cor, 'situacao', interno.rede3_com_situacao(x.slug, v), 'posts_7d', x.n)
             order by x.n desc, x.nome), '[]'::jsonb)
    from (
      select c.*, interno.rede_alumia_posts_7d(c.slug) as n
      from rede_comunidades c
      where c.slug not like 'fechado-%'
        and (c.tipo <> 'fechada' or interno.rede2_na_comunidade(c.slug, v))
        and (v is not null or c.categoria = 'disciplinas')
      order by n desc, c.nome
      limit v_n) x
    where x.n >= 3));
end $$;

-- ── 4. Reações com emoji ──────────────────────────────────────────────────────────────────────────────────────────────────

/**
 * Reage (p_sim = true) ou tira a reação (false) com um emoji da lista fechada. Só membro da Rede (18+ e consentimento), que vê o
 * post, sem bloqueio entre as duas pessoas (rede_ve já recusa nos dois sentidos) e que não foi banido da comunidade do post.
 * Devolve {reacoes} do post (totais, nunca quem).
 */
create or replace function public.rede_alumia_reagir(p_post uuid, p_emoji text, p_sim boolean default true) returns jsonb language plpgsql volatile security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); x rede_posts;
begin
  perform interno.aberta('comunidade');
  if not interno.rede2_membro(v) then perform interno.erro('consentimento'); end if;
  if p_emoji is null or not (p_emoji = any (interno.rede_alumia_emojis())) then perform interno.erro('invalido:emoji'); end if;
  select * into x from rede_posts where id = p_post;
  if not found or not interno.rede_ve(x, v) or x.oculto or x.retido or x.apagado_em is not null then perform interno.erro('nao_encontrado'); end if;
  if interno.rede_bloqueado(v, x.autor) then perform interno.erro('nao_encontrado'); end if;
  if x.comunidade is not null and interno.rede3_com_situacao(x.comunidade, v) = 'banido' then perform interno.erro('sem_permissao'); end if;
  perform interno.rede2_limite('reagir');
  if coalesce(p_sim, true) then
    insert into rede_reacoes_emoji (post, usuario, emoji) values (x.id, v, p_emoji) on conflict do nothing;
  else
    delete from rede_reacoes_emoji where post = x.id and usuario = v and emoji = p_emoji;
  end if;
  return jsonb_build_object('reacoes', interno.rede_alumia_reacoes_de(x.id, v));
end $$;

/**
 * As reações de vários posts de uma vez (até 50): {itens: [{post, reacoes}]}. Post que a pessoa não pode ver não volta (nem
 * o id). Visitante só lê o que é aberto à internet (a mesma matriz).
 */
create or replace function public.rede_alumia_reacoes(p_posts uuid[]) returns jsonb language plpgsql volatile security definer set search_path = interno, pg_temp as $$
declare v uuid := auth.uid();
begin
  perform interno.aberta('comunidade');
  perform interno.limite('rede2_ler', 600, 60);
  if coalesce(cardinality(p_posts), 0) > 50 then perform interno.erro('invalido:posts'); end if;
  if v is not null and exists (select 1 from perfis f where f.id = v and f.suspenso) then perform interno.erro('conta_suspensa'); end if;
  return jsonb_build_object('itens', (
    select coalesce(jsonb_agg(jsonb_build_object('post', x.id, 'reacoes', interno.rede_alumia_reacoes_de(x.id, v))), '[]'::jsonb)
    from rede_posts x
    where x.id = any (coalesce(p_posts, '{}'::uuid[])) and interno.rede_ve(x, v) and not x.oculto and not x.retido and x.apagado_em is null));
end $$;

-- ── 5. "ajudou a autora" ──────────────────────────────────────────────────────────────────────────────────────────────────

/**
 * Marca (p_sim = true) ou desmarca a resposta que ajudou quem abriu a conversa. SÓ quem abriu a conversa marca: nem a moderação
 * (a marca diz o que ajudou a autora, e só ela sabe). A resposta tem de ser da conversa, visível para ela e de outra pessoa. Uma
 * por conversa: marcar outra troca a marca. Avisa quem escreveu a resposta (sem avisar se há bloqueio). Devolve {ajudou}.
 */
create or replace function public.rede_alumia_ajudou(p_resposta uuid, p_sim boolean default true) returns jsonb language plpgsql volatile security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); r rede_posts; v_raiz rede_posts; v_antes uuid;
begin
  perform interno.aberta('comunidade');
  if not interno.rede2_membro(v) then perform interno.erro('consentimento'); end if;
  select * into r from rede_posts where id = p_resposta;
  if not found or r.resposta_a is null or not interno.rede_ve(r, v) or r.oculto or r.retido or r.apagado_em is not null then perform interno.erro('nao_encontrado'); end if;
  v_raiz := interno.rede3_conv_raiz(r);
  if v_raiz.id is null or not interno.rede_ve(v_raiz, v) then perform interno.erro('nao_encontrado'); end if;
  if v_raiz.autor is distinct from v then perform interno.erro('sem_permissao'); end if;
  if r.autor = v then perform interno.erro('invalido:propria'); end if;
  perform interno.rede2_limite('reagir');
  select resposta into v_antes from rede_ajudou where rede_ajudou.raiz = v_raiz.id;
  if coalesce(p_sim, true) then
    insert into rede_ajudou (raiz, resposta) values (v_raiz.id, r.id)
    on conflict (raiz) do update set resposta = excluded.resposta, marcado_em = now();
    -- Na dúvida, a marca da autora também é a "resolveu" da rede de hoje (que a autora já podia marcar): as duas telas concordam.
    if v_raiz.tipo = 'duvida' then update rede_posts set aceita = r.id where id = v_raiz.id; end if;
    if v_antes is distinct from r.id and r.autor is not null and not interno.rede_bloqueado(v, r.autor) then
      perform interno.avisar_em(r.autor, format('Sua resposta ajudou quem abriu a conversa “%s” na Alumia.', left(coalesce(v_raiz.titulo, v_raiz.texto), 80)), 'rede');
    end if;
    return jsonb_build_object('ajudou', r.id);
  end if;
  delete from rede_ajudou where rede_ajudou.raiz = v_raiz.id and resposta = r.id;
  if v_raiz.tipo = 'duvida' and v_raiz.aceita = r.id then update rede_posts set aceita = null where id = v_raiz.id; end if;
  return jsonb_build_object('ajudou', coalesce((select resposta from rede_ajudou where rede_ajudou.raiz = v_raiz.id),
    (select aceita from rede_posts where id = v_raiz.id and tipo = 'duvida')));
end $$;

-- ── 6. A conversa da tela nova ────────────────────────────────────────────────────────────────────────────────────────────

/**
 * rede_conv_arvore (a mesma matriz, ordem e limite) + o que a tela nova usa: ajudou (a resposta marcada, só se quem lê pode vê-la;
 * na dúvida sem marca nova, vale a "resolveu" de hoje), pode_ajudou (só quem abriu a conversa), pronomes_da_raiz (o que a pessoa
 * escreveu no perfil, quando a coluna da F4 existir; senão nulo) e as reações do post aberto (post.reacoes).
 */
create or replace function public.rede_alumia_conversa(p_id uuid, p_ordem text default 'antigas') returns jsonb language plpgsql volatile security definer set search_path = interno, pg_temp as $$
declare v uuid := auth.uid(); v_arv jsonb; v_raiz rede_posts; v_ajudou uuid; v_pron text; f perfis;
begin
  v_arv := public.rede_conv_arvore(p_id, p_ordem);
  select * into v_raiz from rede_posts where id = (v_arv ->> 'raiz')::uuid;
  select a.resposta into v_ajudou from rede_ajudou a join rede_posts r on r.id = a.resposta
  where a.raiz = v_raiz.id and interno.rede_ve(r, v) and not r.oculto and not r.retido and r.apagado_em is null;
  if v_ajudou is null and v_raiz.tipo = 'duvida' then v_ajudou := v_raiz.aceita; end if;
  select * into f from perfis where id = v_raiz.autor;
  -- Pronomes: só de perfil visível (o invisível não mostra nada de si). A coluna é da F4; to_jsonb lê sem quebrar antes dela.
  if f.id is not null and not coalesce(f.rede_modo = 'invisivel' or f.rede_invisivel, false) then
    v_pron := nullif(btrim(left(to_jsonb(f) ->> 'rede_pronomes', 30)), '');
  end if;
  return jsonb_set(v_arv, '{post,reacoes}', interno.rede_alumia_reacoes_de(p_id, v))
    || jsonb_build_object(
      'ajudou', v_ajudou,
      'pode_ajudou', v is not null and v_raiz.autor = v and interno.rede2_membro(v),
      'pronomes_da_raiz', v_pron);
end $$;

-- ── 7. Permissões ─────────────────────────────────────────────────────────────────────────────────────────────────────────
revoke all on function public.rede_alumia_com_pagina(text), public.rede_alumia_ativas(integer), public.rede_alumia_reagir(uuid, text, boolean),
  public.rede_alumia_reacoes(uuid[]), public.rede_alumia_ajudou(uuid, boolean), public.rede_alumia_conversa(uuid, text) from public;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on function public.rede_alumia_com_pagina(text), public.rede_alumia_ativas(integer), public.rede_alumia_reagir(uuid, text, boolean),
      public.rede_alumia_reacoes(uuid[]), public.rede_alumia_ajudou(uuid, boolean), public.rede_alumia_conversa(uuid, text) from anon, authenticated;
    -- Leitura: visitante lê o que a matriz deixa (disciplinas e posts abertos à internet). Escrita: só quem entrou.
    grant execute on function public.rede_alumia_com_pagina(text), public.rede_alumia_ativas(integer), public.rede_alumia_reacoes(uuid[]),
      public.rede_alumia_conversa(uuid, text) to anon, authenticated, service_role;
    grant execute on function public.rede_alumia_reagir(uuid, text, boolean), public.rede_alumia_ajudou(uuid, boolean) to authenticated, service_role;
  end if;
end $$;
