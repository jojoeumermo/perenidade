-- ───────────────────────────── Alumia no Fediverso: o modo total (servidor de verdade, sem aba à parte) ─────────────────────────────
-- Migração acrescentável: pode rodar mais de uma vez, sem apagar dado nenhum. O mesmo bloco está no fim do install.sql. Roda DEPOIS
-- de 2026-11-alumia.sql (a federação opcional) e de todas as migrações da Rede v2. Plano: PLANO-FEDIVERSO.md, frente F3 (banco),
-- contratos das seções 3.1, 3.2 e 3.4. Teste: scripts/testar-fediverso-banco.mjs.
--
-- DESLIGADO POR PADRÃO. Tudo o que muda de comportamento depende de interno.rede_fed_total() (recurso "fediverso-total") e, para as
-- comunidades como Group (Lemmy), de interno.rede_fed_grupos_ligado() (recurso "fediverso-grupos"). Com os dois desligados, a
-- federação continua exatamente como em 2026-11-alumia.sql: opt-in, versão 1 do consentimento, só "internet" nas disciplinas.
-- Para ligar (depois de publicar o site com a flag): pelo painel (Site › Controles avançados, tabela interno.recursos_vivos) ou
--   update interno.configuracoes set valor = valor || '{"total": true}'::jsonb where chave = 'fediverso';
-- ("grupos": true liga o Group; "comunidades_de_luta": true deixa sair também as comunidades abertas de lutas e do instituto.)
--
-- O que este arquivo faz:
--   1. Interruptores: rede_fed_total, rede_fed_grupos_ligado. Com o total ligado, a versão do consentimento passa a 2.
--   2. Consentimento (D2): rede_consentimentos.fediverso (o item destacado no consentimento de entrada da Alumia). Aceitar com o
--      item marcado liga a federação sozinho (gatilho); desmarcar desliga. Sem o item, nada sai. LGPD art. 7º, I e art. 8º
--      (consentimento livre, específico e destacado, com versão e data); art. 11, I (opinião política e filiação sindical são dado
--      sensível); art. 33, VIII (transferência internacional só com consentimento específico e em destaque, avisando que servidor de
--      fora não pode ser obrigado a apagar); art. 8º, § 5º e art. 18, VI (revogar e apagar a qualquer momento: desligar no perfil).
--   3. O que sai (D3): para quem consentiu na versão 2, sai todo post público do perfil (o "membros" do perfil) e das comunidades
--      abertas das disciplinas (e das de lutas e do instituto só com "comunidades_de_luta"). Nunca saem: núcleo, comunidade fechada
--      ou restrita, "seguidores", "comunidade", "equipe", aviso do instituto, compartilhamento, retido, oculto ou apagado. Quem
--      consentiu só na versão 1 continua com a regra antiga (só "internet"). D5: "seguidores" nunca sai.
--   4. O que entra: nota de fora guardada também quando responde ou menciona alguém daqui (não só de quem alguém segue), com HTML
--      já limpo pelo servidor do site e conferido de novo aqui (lista permitida; o que não passa fica só como texto), mídia só como
--      endereço https e metadados (o navegador busca pela rota-proxy, sem o IP de quem lê sair), visibilidade, fio e contexto.
--      Direto ou limitado NUNCA é guardado (a Alumia não tem DM federada). Só-seguidores só se alguém daqui segue o autor, e só
--      essa pessoa vê. A guarda de 30 dias vale para nota sem ligação com nada daqui; a que responde ou menciona algo daqui fica
--      enquanto o post local (ou a menção) existir (LGPD art. 15 e 16: término do tratamento quando acaba a finalidade).
--   5. Tabelas novas (todas em interno, com RLS e sem permissão direta): fediverso_interacoes (curtir e impulsionar, de fora e
--      daqui), fediverso_mencoes, fediverso_dominios (circuito por domínio), fediverso_denuncias (Flag de fora e para fora),
--      fediverso_bloqueios_recebidos, fediverso_filtros (a pessoa bloqueia ou silencia alguém de fora), fediverso_grupos e
--      fediverso_grupo_seguidores (Group). O nome começa com "fediverso_" para não se misturar às oito rede_fed_* de 2026-11-alumia.
--   6. Avisos: interno.avisos ganha ator_remoto e objeto_remoto; tipos fed_seguidor, fed_resposta, fed_mencao, fed_curtida,
--      fed_impulso, que respeitam a preferência do tipo de sempre (seguidor, resposta, mencao, apoio, citacao).
--   7. As ações novas de public.rede_fed_servidor (seção 3.1), as RPCs da tela (seção 3.2) e os tipos novos da fila (seção 3.4).
--
-- Privacidade: nada de IP; nada de quem denunciou sai na Flag (ela sai assinada pela instância); DMs (rede_dm_*) e "seguidores"
-- nunca são lidos aqui; nada sai de quem não consentiu.

-- ── 1. Interruptores ────────────────────────────────────────────────────────────────────────────────────────────────────

/** Uma chave booleana da configuração 'fediverso' (interno.configuracoes). Qualquer coisa que não seja true vale false. */
create or replace function interno.rede_fed_config_bool(p_chave text) returns boolean language sql stable security definer set search_path = interno, pg_temp as $$
  select coalesce((select valor ->> p_chave from configuracoes where chave = 'fediverso'), '') = 'true'
$$;

/** Um recurso decidido pelo painel (interno.recursos_vivos): true, false ou nulo (sem decisão, ou a tabela ainda não existe). */
create or replace function interno.rede_fed_recurso_vivo(p_nome text) returns boolean language plpgsql stable security definer set search_path = interno, pg_temp as $$
declare v boolean;
begin
  if to_regclass('interno.recursos_vivos') is null then return null; end if;
  execute 'select ligado from interno.recursos_vivos where nome = $1' into v using p_nome;
  return v;
end $$;

/** O modo total ("fediverso-total") está ligado? Desligado no painel desliga sempre; sem decisão do painel, vale a configuração. */
create or replace function interno.rede_fed_total() returns boolean language sql stable security definer set search_path = interno, pg_temp as $$
  select coalesce(interno.rede_fed_recurso_vivo('fediverso-total'), interno.rede_fed_config_bool('total'))
$$;

/** As comunidades como Group ("fediverso-grupos")? Só com o modo total ligado. */
create or replace function interno.rede_fed_grupos_ligado() returns boolean language sql stable security definer set search_path = interno, pg_temp as $$
  select interno.rede_fed_total() and coalesce(interno.rede_fed_recurso_vivo('fediverso-grupos'), interno.rede_fed_config_bool('grupos'))
$$;

/** Versão do consentimento da federação: 1 (opt-in de 2026-11-alumia) ou 2 (o item destacado do modo total). Mudou o texto, sobe. */
create or replace function interno.rede_fed_versao() returns integer language sql stable security definer set search_path = interno, pg_temp as $$
  select case when interno.rede_fed_total() then 2 else 1 end
$$;

-- ── 2. Colunas novas nas tabelas que já existem ────────────────────────────────────────────────────────────────────────

-- A pessoa escolhe aparecer em diretórios e buscas de fora (discoverable/indexable). Desligado por padrão.
alter table interno.rede_fed_atores add column if not exists descobrivel boolean not null default false;

-- O rosto e o tipo do ator de fora (Person, Group, Service…), para o cartão e o perfil remoto.
alter table interno.rede_fed_remotos add column if not exists avatar text check (avatar is null or (avatar ~ '^https://' and char_length(avatar) <= 500));
alter table interno.rede_fed_remotos add column if not exists tipo text check (tipo is null or tipo ~ '^[A-Za-z]{2,40}$');

-- A nota de fora completa: HTML já limpo, aviso de conteúdo, visibilidade, fio, mídia (só endereço e metadados) e a ligação com
-- algo daqui (post_local: o post daqui a que ela responde, direta ou indiretamente; apagado o post, a nota vai junto).
alter table interno.rede_fed_recebidos add column if not exists html text check (html is null or char_length(html) <= 20000);
alter table interno.rede_fed_recebidos add column if not exists sensivel boolean not null default false;
alter table interno.rede_fed_recebidos add column if not exists visibilidade text not null default 'publico' check (visibilidade in ('publico', 'nao_listado', 'seguidores'));
alter table interno.rede_fed_recebidos add column if not exists em_resposta_a text check (em_resposta_a is null or char_length(em_resposta_a) <= 500);
alter table interno.rede_fed_recebidos add column if not exists contexto text check (contexto is null or char_length(contexto) <= 500);
alter table interno.rede_fed_recebidos add column if not exists midia jsonb not null default '[]'::jsonb;
alter table interno.rede_fed_recebidos add column if not exists post_local uuid references interno.rede_posts (id) on delete cascade;
alter table interno.rede_fed_recebidos add column if not exists editado_em timestamptz;
create index if not exists rede_fed_recebidos_resposta on interno.rede_fed_recebidos (em_resposta_a) where em_resposta_a is not null;
create index if not exists rede_fed_recebidos_post_local on interno.rede_fed_recebidos (post_local) where post_local is not null;

-- A fila: tipos novos (seção 3.4), entregas da comunidade (Group) e da instância (Flag) sem perfil.
alter table interno.rede_fed_fila add column if not exists comunidade text check (comunidade is null or comunidade ~ '^[a-z0-9-]{2,60}$');
alter table interno.rede_fed_fila alter column perfil drop not null;
do $$
declare r record;
begin
  for r in select conname from pg_constraint where conrelid = 'interno.rede_fed_fila'::regclass and contype = 'c'
             and pg_get_constraintdef(oid) like '%tipo%' and conname <> 'rede_fed_fila_tipo_v2' loop
    execute format('alter table interno.rede_fed_fila drop constraint %I', r.conname);
  end loop;
  if not exists (select 1 from pg_constraint where conrelid = 'interno.rede_fed_fila'::regclass and conname = 'rede_fed_fila_tipo_v2') then
    alter table interno.rede_fed_fila add constraint rede_fed_fila_tipo_v2 check (tipo in ('create', 'update', 'delete', 'accept', 'reject', 'follow', 'undo-follow',
      'like', 'undo-like', 'announce', 'undo-announce', 'flag', 'block', 'undo-block', 'group-announce', 'group-accept'));
  end if;
end $$;

-- Um post daqui que responde a uma nota de fora (sai com inReplyTo para ela).
alter table interno.rede_posts add column if not exists resposta_a_remota text check (resposta_a_remota is null or (resposta_a_remota ~ '^https://' and char_length(resposta_a_remota) <= 500));
create index if not exists rede_posts_resposta_remota on interno.rede_posts (resposta_a_remota) where resposta_a_remota is not null;

-- O item destacado do consentimento de entrada da Alumia: "meus posts públicos também vão para o Fediverso" (D2).
alter table interno.rede_consentimentos add column if not exists fediverso boolean not null default false;

-- Avisos com gente de fora: o ator remoto (endereço público) e a nota de fora (resposta ou menção).
alter table interno.avisos add column if not exists ator_remoto text check (ator_remoto is null or (ator_remoto ~ '^https://' and char_length(ator_remoto) <= 500));
alter table interno.avisos add column if not exists objeto_remoto text check (objeto_remoto is null or (objeto_remoto ~ '^https://' and char_length(objeto_remoto) <= 500));
alter table interno.avisos drop constraint if exists avisos_tipo;
alter table interno.avisos add constraint avisos_tipo check (tipo is null or tipo in ('resposta', 'mencao', 'citacao', 'seguidor', 'chamado', 'nucleo', 'moderacao', 'apoio',
  'fed_seguidor', 'fed_resposta', 'fed_mencao', 'fed_curtida', 'fed_impulso'));
create unique index if not exists avisos_fed_interacao on interno.avisos (para, tipo, post, ator_remoto) where tipo in ('fed_curtida', 'fed_impulso');
create unique index if not exists avisos_fed_nota on interno.avisos (para, tipo, objeto_remoto) where tipo in ('fed_resposta', 'fed_mencao');
create unique index if not exists avisos_fed_seguidor on interno.avisos (para, ator_remoto) where tipo = 'fed_seguidor';

-- ── 3. Tabelas novas ───────────────────────────────────────────────────────────────────────────────────────────────────

-- Curtir (Like) e impulsionar (Announce). Entrada: alguém de fora num post daqui (post_local) ou o impulso de uma nota de fora por
-- quem alguém daqui segue (objeto_remoto). Saída: alguém daqui numa nota de fora (perfil + objeto_remoto; ator = autor da nota).
create table if not exists interno.fediverso_interacoes (
  id bigserial primary key,
  direcao text not null check (direcao in ('entrada', 'saida')),
  tipo text not null check (tipo in ('like', 'announce')),
  ator text check (ator is null or (ator ~ '^https://' and char_length(ator) <= 500)),
  perfil uuid references interno.perfis (id) on delete cascade,
  post_local uuid references interno.rede_posts (id) on delete cascade,
  objeto_remoto text check (objeto_remoto is null or (objeto_remoto ~ '^https://' and char_length(objeto_remoto) <= 500)),
  atividade_id text check (atividade_id is null or char_length(atividade_id) <= 500),
  criado_em timestamptz not null default now(),
  check ((direcao = 'entrada' and ator is not null and perfil is null and num_nonnulls(post_local, objeto_remoto) = 1)
      or (direcao = 'saida' and perfil is not null and post_local is null and objeto_remoto is not null))
);
create unique index if not exists fediverso_interacoes_local on interno.fediverso_interacoes (tipo, ator, post_local) where direcao = 'entrada' and post_local is not null;
create unique index if not exists fediverso_interacoes_remota on interno.fediverso_interacoes (tipo, ator, objeto_remoto) where direcao = 'entrada' and objeto_remoto is not null;
create unique index if not exists fediverso_interacoes_saida on interno.fediverso_interacoes (tipo, perfil, objeto_remoto) where direcao = 'saida';
create index if not exists fediverso_interacoes_atividade on interno.fediverso_interacoes (ator, atividade_id) where atividade_id is not null;

-- Nota de fora que menciona alguém daqui (só quem tem a federação ligada pode ser mencionado de fora).
create table if not exists interno.fediverso_mencoes (
  nota text not null references interno.rede_fed_recebidos (id) on delete cascade,
  perfil uuid not null references interno.perfis (id) on delete cascade,
  criado_em timestamptz not null default now(),
  primary key (nota, perfil)
);
create index if not exists fediverso_mencoes_perfil on interno.fediverso_mencoes (perfil);

-- O circuito por domínio: 5 falhas de conexão seguidas = domínio "morto" por 1 h, depois 6 h, depois 24 h. Os itens esperam sem
-- gastar tentativa. Um sucesso zera.
create table if not exists interno.fediverso_dominios (
  dominio text primary key check (dominio ~ '^[a-z0-9.-]{3,253}$'),
  falhas smallint not null default 0,
  nivel smallint not null default 0,
  morto_ate timestamptz,
  ultima_falha timestamptz,
  ultimo_ok timestamptz
);

-- Denúncias com o Fediverso. Entrada: a Flag de outra instância (vira também denúncia na fila da mediação, rede_denuncias, para
-- cada post ou perfil daqui que ela aponta). Saída: alguém daqui denuncia uma nota ou um ator de fora; com "encaminhar", a Flag
-- sai assinada pela instância, sem dizer quem denunciou.
create table if not exists interno.fediverso_denuncias (
  id uuid primary key default gen_random_uuid(),
  protocolo text not null unique default upper(substr(md5(gen_random_uuid()::text), 1, 10)),
  direcao text not null check (direcao in ('entrada', 'saida')),
  dominio text not null check (dominio ~ '^[a-z0-9.-]{3,253}$'),
  ator text check (ator is null or (ator ~ '^https://' and char_length(ator) <= 500)),
  alvos jsonb not null default '[]'::jsonb,
  categoria text not null default 'outro' check (categoria in ('menores', 'ameaca', 'exposicao', 'violencia', 'autolesao', 'odio', 'assedio', 'golpe', 'spam', 'outro')),
  conteudo text not null default '' check (char_length(conteudo) <= 2000),
  quem uuid references interno.perfis (id) on delete set null,
  encaminhar boolean not null default false,
  denuncias uuid[] not null default '{}',
  situacao text not null default 'aberta' check (situacao in ('aberta', 'em_analise', 'resolvida', 'descartada')),
  criado_em timestamptz not null default now()
);
create index if not exists fediverso_denuncias_fila on interno.fediverso_denuncias (situacao, criado_em desc);

-- Alguém de fora bloqueou alguém daqui (Block): as relações caem e o que é dele some da linha de quem foi bloqueado.
create table if not exists interno.fediverso_bloqueios_recebidos (
  perfil uuid not null references interno.perfis (id) on delete cascade,
  ator text not null check (ator ~ '^https://' and char_length(ator) <= 500),
  criado_em timestamptz not null default now(),
  primary key (perfil, ator)
);

-- Alguém daqui bloqueou (sai um Block) ou silenciou (só aqui) alguém de fora.
create table if not exists interno.fediverso_filtros (
  usuario uuid not null references interno.perfis (id) on delete cascade,
  ator text not null check (ator ~ '^https://' and char_length(ator) <= 500),
  tipo text not null check (tipo in ('bloqueio', 'silencio')),
  atividade text check (atividade is null or char_length(atividade) <= 500),
  criado_em timestamptz not null default now(),
  primary key (usuario, ator)
);

-- A comunidade como Group (Lemmy, FEP-1b12): o par de chaves (a privada vem cifrada pelo servidor do site) e quem segue de fora.
create table if not exists interno.fediverso_grupos (
  comunidade text primary key references interno.rede_comunidades (slug) on delete cascade on update cascade,
  chave_publica text check (chave_publica is null or char_length(chave_publica) <= 2000),
  chave_privada text check (chave_privada is null or char_length(chave_privada) <= 6000),
  criado_em timestamptz not null default now()
);
create table if not exists interno.fediverso_grupo_seguidores (
  comunidade text not null references interno.rede_comunidades (slug) on delete cascade on update cascade,
  ator text not null check (ator ~ '^https://' and char_length(ator) <= 500),
  inbox text not null check (inbox ~ '^https://' and char_length(inbox) <= 500),
  inbox_compartilhada text check (inbox_compartilhada is null or (inbox_compartilhada ~ '^https://' and char_length(inbox_compartilhada) <= 500)),
  pedido text not null default '' check (char_length(pedido) <= 500),
  criado_em timestamptz not null default now(),
  primary key (comunidade, ator)
);

alter table interno.fediverso_interacoes enable row level security;
alter table interno.fediverso_mencoes enable row level security;
alter table interno.fediverso_dominios enable row level security;
alter table interno.fediverso_denuncias enable row level security;
alter table interno.fediverso_bloqueios_recebidos enable row level security;
alter table interno.fediverso_filtros enable row level security;
alter table interno.fediverso_grupos enable row level security;
alter table interno.fediverso_grupo_seguidores enable row level security;
revoke all on interno.fediverso_interacoes, interno.fediverso_mencoes, interno.fediverso_dominios, interno.fediverso_denuncias,
  interno.fediverso_bloqueios_recebidos, interno.fediverso_filtros, interno.fediverso_grupos, interno.fediverso_grupo_seguidores from public;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on interno.fediverso_interacoes, interno.fediverso_mencoes, interno.fediverso_dominios, interno.fediverso_denuncias,
      interno.fediverso_bloqueios_recebidos, interno.fediverso_filtros, interno.fediverso_grupos, interno.fediverso_grupo_seguidores from anon, authenticated;
    revoke all on sequence interno.fediverso_interacoes_id_seq from anon, authenticated;
  end if;
end $$;

-- ── 4. Endereços daqui, HTML de fora e avisos ──────────────────────────────────────────────────────────────────────────

/** O domínio deste servidor da federação (o de url_entrega na configuração), ou nulo quando ainda não foi configurado. */
create or replace function interno.rede_fed_host_local() returns text language sql stable security definer set search_path = interno, pg_temp as $$
  select interno.rede_fed_dominio((select valor ->> 'url_entrega' from configuracoes where chave = 'fediverso'))
$$;

/** O id de post daqui num endereço (…/api/fediverso/p/<uuid> ou …/p/<uuid>, no host daqui) ou num uuid solto. Não confere se existe. */
create or replace function interno.rede_fed_uuid_local(p_ref text) returns uuid language plpgsql stable security definer set search_path = interno, pg_temp as $$
declare m text[]; v_host text := interno.rede_fed_host_local();
begin
  if p_ref is null then return null; end if;
  if p_ref ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then return p_ref::uuid; end if;
  m := regexp_match(p_ref, '^https://([^/:?#]+)(?::[0-9]+)?/(?:api/fediverso/p|p)/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/?$');
  if m is null or (v_host is not null and lower(m[1]) <> v_host) then return null; end if;
  return m[2]::uuid;
end $$;

/** O @nome daqui num endereço de ator (…/api/fediverso/u/<nome> ou …/@<nome>, no host daqui). */
create or replace function interno.rede_fed_handle_local(p_ref text) returns text language plpgsql stable security definer set search_path = interno, pg_temp as $$
declare m text[]; v_host text := interno.rede_fed_host_local();
begin
  m := regexp_match(coalesce(p_ref, ''), '^https://([^/:?#]+)(?::[0-9]+)?/(?:api/fediverso/u/|@)([a-z0-9_]{3,20})/?$');
  if m is null or (v_host is not null and lower(m[1]) <> v_host) then return null; end if;
  return m[2];
end $$;

/** O post daqui que já saiu para o Fediverso (e não foi retirado) para o qual este endereço aponta; nulo se não há. */
create or replace function interno.rede_fed_post_local(p_ref text) returns uuid language sql stable security definer set search_path = interno, pg_temp as $$
  select e.post from rede_fed_enviados e where e.post = interno.rede_fed_uuid_local(p_ref) and e.apagado_em is null
$$;

/**
 * Segunda tranca do HTML de fora (a primeira é a limpeza do servidor do site, lista permitida igual à do Mastodon 4.2+): só as
 * tags que o Mastodon mantém, nenhum atributo de evento, estilo ou fonte, e link só https, http, mailto, âncora ou caminho.
 * O que não passa é guardado só como texto (a coluna html fica nula).
 */
create or replace function interno.rede_fed_html_ok(p_html text) returns boolean language plpgsql immutable set search_path = interno, pg_temp as $$
declare t text; h text;
begin
  if p_html is null or char_length(p_html) > 20000 then return false; end if;
  if p_html ~ '<!--|<!\[|<\?|<!' then return false; end if;
  for t in select lower(m[1]) from regexp_matches(p_html, '<\s*/?\s*([A-Za-z][A-Za-z0-9:-]*)', 'g') m loop
    if t not in ('p', 'br', 'span', 'a', 'del', 's', 'pre', 'blockquote', 'code', 'b', 'strong', 'u', 'i', 'em', 'ul', 'ol', 'li',
                 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'sub', 'sup') then return false; end if;
  end loop;
  if p_html ~* '[\s"''/](on[a-z]+|style|src|srcset|formaction|action|xmlns|xlink:href|background|lowsrc|dynsrc)\s*=' then return false; end if;
  for h in select btrim(m[1], '"''') from regexp_matches(p_html, 'href\s*=\s*("[^"]*"|''[^'']*''|[^\s>]+)', 'gi') m loop
    if h !~* '^(https?://|mailto:|#|/)' or h ~ '[\s\\]' or h ~ '&#' then return false; end if;
  end loop;
  return true;
end $$;

/** O tipo de aviso de sempre que vale para a preferência de um tipo da federação (curtida = apoio, impulso = citação). */
create or replace function interno.rede_fed_aviso_base(p_tipo text) returns text language sql immutable as $$
  select case p_tipo when 'fed_seguidor' then 'seguidor' when 'fed_resposta' then 'resposta' when 'fed_mencao' then 'mencao'
                     when 'fed_curtida' then 'apoio' when 'fed_impulso' then 'citacao' else p_tipo end
$$;

/** A preferência de uma pessoa (pacote avisos), agora também para os tipos da federação, que seguem o tipo de sempre. */
create or replace function interno.rede3_aviso_pref(p_usuario uuid, p_tipo text, p_canal text) returns boolean language sql stable security definer set search_path = interno, pg_temp as $$
  select case when p_tipo = 'moderacao' and p_canal = 'site' then true
    else coalesce((select p.ligado from rede_avisos_prefs p where p.usuario = p_usuario and p.tipo = interno.rede_fed_aviso_base(p_tipo) and p.canal = p_canal), p_canal = 'site') end
$$;

/** A chave que agrupa avisos, agora com os da federação: curtidas, impulsos e respostas de fora do mesmo post juntas; seguidores de fora juntos. */
create or replace function interno.rede3_aviso_chave(p_tipo text, p_post uuid, p_id uuid) returns text language sql immutable as $$
  select case when p_tipo in ('resposta', 'mencao', 'citacao', 'apoio', 'fed_resposta', 'fed_curtida', 'fed_impulso') and p_post is not null then p_tipo || ':' || p_post::text
              when p_tipo in ('seguidor', 'fed_seguidor') then p_tipo
              else 'n:' || p_id::text end
$$;

/**
 * Cria um aviso com gente de fora. Não avisa quem bloqueou ou silenciou esse ator de fora, nem conta suspensa; a preferência "no
 * site" do tipo de sempre vale pelo gatilho interno.rede3_aviso_antes. O texto não leva nada da nota de fora.
 */
create or replace function interno.rede_fed_avisar(p_para uuid, p_tipo text, p_post uuid, p_ator text, p_objeto text default null) returns void
language plpgsql security definer set search_path = interno, pg_temp as $$
begin
  if p_para is null or p_tipo not in ('fed_seguidor', 'fed_resposta', 'fed_mencao', 'fed_curtida', 'fed_impulso') or coalesce(p_ator, '') !~ '^https://' then return; end if;
  if not exists (select 1 from perfis where id = p_para and not suspenso) then return; end if;
  if exists (select 1 from fediverso_filtros f where f.usuario = p_para and f.ator = p_ator) then return; end if;
  insert into avisos (para, texto, categoria, tipo, post, ator_remoto, objeto_remoto)
  values (p_para, case p_tipo
      when 'fed_seguidor' then 'Uma pessoa de outro servidor do Fediverso começou a seguir você.'
      when 'fed_resposta' then 'Uma pessoa de outro servidor do Fediverso respondeu ao seu post.'
      when 'fed_mencao' then 'Uma pessoa de outro servidor do Fediverso mencionou você.'
      when 'fed_curtida' then 'Uma pessoa de outro servidor do Fediverso curtiu o seu post.'
      else 'Uma pessoa de outro servidor do Fediverso impulsionou o seu post.' end,
    'rede', p_tipo, p_post, left(p_ator, 500), case when coalesce(p_objeto, '') ~ '^https://' then left(p_objeto, 500) end)
  on conflict do nothing;
end $$;

/** Quem de fora aparece num grupo de avisos (até 2, do mais novo) e a nota de fora mais recente dele. Nulo quando ninguém é de fora. */
create or replace function interno.rede_fed_aviso_remoto(p_ids uuid[]) returns jsonb language sql stable security definer set search_path = interno, pg_temp as $$
  with u as (
    select a.ator_remoto, a.objeto_remoto, a.criado_em from avisos a where a.id = any (coalesce(p_ids, '{}')) and a.ator_remoto is not null
  ), d as (
    select u.ator_remoto, max(u.criado_em) as em from u group by u.ator_remoto order by max(u.criado_em) desc limit 2
  )
  select case when not exists (select 1 from u) then null else jsonb_build_object(
    'atores', (select jsonb_agg(jsonb_build_object('ator', d.ator_remoto, 'handle', r.handle, 'nome', r.nome, 'avatar', r.avatar,
                                                   'servidor', interno.rede_fed_dominio(d.ator_remoto)) order by d.em desc)
               from d left join rede_fed_remotos r on r.ator = d.ator_remoto),
    'objeto', (select u.objeto_remoto from u where u.objeto_remoto is not null order by u.criado_em desc limit 1)) end
$$;

-- rede_aviso_listar passa a devolver quem é de fora (ator_remoto, atores_remotos) e a nota de fora (objeto_remoto). A função é
-- remendada no lugar (como o bloco de nome da Alumia faz), para não reescrever o texto que o pacote avisos e a Alumia já deixaram.
do $$
declare
  v_def text;
  v_marca text := '''post'', n.post, ''alvo'', n.alvo, ''titulo'', n.titulo,';
begin
  v_def := pg_get_functiondef('public.rede_aviso_listar(text, integer)'::regprocedure);
  if position('ator_remoto' in v_def) > 0 then return; end if;
  if position(v_marca in v_def) = 0 then
    raise exception 'public.rede_aviso_listar mudou: o remendo do Fediverso (20261109-fediverso-total.sql) precisa ser revisto';
  end if;
  v_def := replace(v_def, v_marca, v_marca || '
      ''ator_remoto'', interno.rede_fed_aviso_remoto(n.ids) -> ''atores'' -> 0,
      ''atores_remotos'', coalesce(interno.rede_fed_aviso_remoto(n.ids) -> ''atores'', ''[]''::jsonb),
      ''objeto_remoto'', interno.rede_fed_aviso_remoto(n.ids) ->> ''objeto'',');
  execute v_def;
end $$;

-- ── 5. Regras: o que sai, ligar sozinho, o que se vê de fora ───────────────────────────────────────────────────────────

/**
 * A comunidade pode sair para o Fediverso (posts no modo total; Group com "fediverso-grupos")? Só aberta, e só das disciplinas,
 * a não ser que a configuração deixe sair também as abertas de lutas e do instituto ("comunidades_de_luta": D3, à espera da decisão).
 */
create or replace function interno.rede_fed_comunidade_ok(p_slug text) returns boolean language sql stable security definer set search_path = interno, pg_temp as $$
  select exists (select 1 from rede_comunidades c where c.slug = p_slug and c.tipo = 'aberta'
                 and (c.categoria = 'disciplinas' or interno.rede_fed_config_bool('comunidades_de_luta')))
$$;

/** A comunidade responde como Group? Com "fediverso-grupos" ligado e a comunidade podendo sair. */
create or replace function interno.rede_fed_grupo_ok(p_slug text) returns boolean language sql stable security definer set search_path = interno, pg_temp as $$
  select interno.rede_fed_grupos_ligado() and interno.rede_fed_comunidade_ok(p_slug)
$$;

/**
 * Este post pode sair para o Fediverso? Sempre: de quem ligou a federação, escrito depois de ligar, @nome igual ao do ator, nunca
 * aviso do instituto, núcleo ou compartilhamento, e resposta só se o post respondido também pode sair.
 * Regra da versão 1 (opt-in, e de quem só consentiu na versão 1): só o que qualquer pessoa lê sem conta ("internet").
 * Regra do modo total (D3), para quem consentiu na versão 2: todo post público do perfil ("internet" ou "membros") e das comunidades
 * abertas que podem sair (interno.rede_fed_comunidade_ok); nunca "seguidores", "comunidade", "nucleo", "equipe", nem retido,
 * oculto ou apagado.
 */
create or replace function interno.rede_fed_federavel(p interno.rede_posts, p_nivel integer default 0) returns boolean
language plpgsql stable security definer set search_path = interno, pg_temp as $$
declare a rede_fed_atores; pai rede_posts; v_pub text;
begin
  if p.id is null or p.autor is null or p_nivel > 8 then return false; end if;
  select * into a from rede_fed_atores where perfil = p.autor;
  if not found or not a.ligado or a.ligado_em is null or p.criado_em < a.ligado_em then return false; end if;
  if interno.rede_fed_impedimento(p.autor) is not null then return false; end if;
  if (select rede_handle from perfis where id = p.autor) is distinct from a.handle then return false; end if;
  if p.tipo = 'aviso' or p.nucleo is not null or p.repost_de is not null then return false; end if;
  if interno.rede_fed_total() and coalesce(a.consentimento_versao, 0) >= 2 then
    if p.oculto or p.retido or p.apagado_em is not null then return false; end if;
    if p.comunidade is not null and p.comunidade like 'fechado-%' then return false; end if;
    v_pub := interno.rede2_publico(p);
    if v_pub not in ('internet', 'membros') then return false; end if;
    if p.comunidade is not null and not interno.rede_fed_comunidade_ok(p.comunidade) then return false; end if;
  else
    if coalesce(p.publico, 'internet') <> 'internet' then return false; end if;
    if interno.rede2_publico(p) <> 'internet' or not interno.rede_ve(p, null) then return false; end if;
  end if;
  if p.resposta_a is not null then
    select * into pai from rede_posts where id = p.resposta_a;
    if not found or not interno.rede_fed_federavel(pai, p_nivel + 1) then return false; end if;
  end if;
  return true;
end $$;

/**
 * O post como sai para o Fediverso. Além do de sempre: a mídia (id, tipo, texto alternativo, tamanho e blurhash; o caminho do
 * arquivo NÃO sai: o servidor pede pela ação "midia"), as menções a gente de fora já conhecida (@nome@servidor no texto, mais o
 * autor da nota respondida), a visibilidade (sempre pública: D5), a nota de fora respondida e a raiz da conversa.
 */
create or replace function interno.rede_fed_post_json(p interno.rede_posts) returns jsonb language sql stable security definer set search_path = interno, pg_temp as $$
  select jsonb_build_object('id', p.id, 'tipo', p.tipo, 'titulo', p.titulo, 'texto', p.texto, 'corpo', p.corpo, 'aviso', p.aviso,
    'criado_em', p.criado_em, 'editado_em', p.editado_em, 'resposta_a', p.resposta_a, 'comunidade', p.comunidade,
    'handle', (select handle from rede_fed_atores where perfil = p.autor),
    'raiz', coalesce(p.root_id, p.id),
    'visibilidade', 'publico',
    'resposta_a_remota', p.resposta_a_remota,
    'midia', (select coalesce(jsonb_agg(jsonb_build_object('id', m.id, 'tipo', m.tipo, 'alt', m.alt, 'largura', m.largura, 'altura', m.altura,
                                                           'blurhash', m.blurhash, 'ordem', m.ordem) order by m.ordem), '[]'::jsonb)
              from rede_midia m where m.post = p.id),
    'mencoes', (select coalesce(jsonb_agg(jsonb_build_object('handle', r.handle, 'ator', r.ator, 'inbox', r.inbox) order by r.handle), '[]'::jsonb)
                from rede_fed_remotos r
                where r.inbox is not null and not interno.rede_fed_bloqueado(r.ator)
                  and (lower(r.handle) in (select lower(m[1] || '@' || m[2]) from regexp_matches(coalesce(p.titulo, '') || ' ' || p.texto || ' ' || coalesce(p.corpo, ''),
                                             '@([A-Za-z0-9_.-]{1,100})@([A-Za-z0-9.-]{1,200}\.[A-Za-z]{2,})', 'g') m)
                       or r.ator = (select c.ator from rede_fed_recebidos c where c.id = p.resposta_a_remota))))
$$;

/**
 * Um post mudou: sai (Create), muda (Update) ou é retirado (Delete) do Fediverso, conforme pode ou não sair agora. Com
 * "fediverso-grupos", o post de uma comunidade também vai para quem segue a comunidade (Group) de fora, como Announce do grupo.
 */
create or replace function interno.rede_fed_post_mudou() returns trigger language plpgsql security definer set search_path = interno, pg_temp as $$
declare v_p rede_posts; v_fed boolean := false; v_env rede_fed_enviados; v_atividade text;
begin
  -- O caminho rápido: ninguém ligou a federação e nada foi enviado. Custa uma consulta a uma tabela quase sempre vazia.
  if not exists (select 1 from rede_fed_atores) then return null; end if;
  if tg_op = 'DELETE' then v_p := old; else v_p := new; v_fed := interno.rede_fed_federavel(new); end if;
  select * into v_env from rede_fed_enviados where post = v_p.id;
  if v_fed and (v_env.post is null or v_env.apagado_em is not null) then
    insert into rede_fed_enviados (post, perfil) values (v_p.id, v_p.autor) on conflict (post) do update set apagado_em = null, enviado_em = now();
    perform interno.rede_fed_espalhar(v_p.autor, 'create', v_p.id::text);
    v_atividade := 'create';
  elsif v_fed and tg_op = 'UPDATE' and (new.texto, coalesce(new.titulo, ''), coalesce(new.corpo, ''), new.aviso) is distinct from (old.texto, coalesce(old.titulo, ''), coalesce(old.corpo, ''), old.aviso) then
    perform interno.rede_fed_espalhar(v_p.autor, 'update', v_p.id::text);
    v_atividade := 'update';
  elsif not v_fed and v_env.post is not null and v_env.apagado_em is null then
    update rede_fed_enviados set apagado_em = now() where post = v_p.id;
    perform interno.rede_fed_espalhar(v_env.perfil, 'delete', v_p.id::text);
    v_atividade := 'delete';
  end if;
  if v_atividade is not null and v_p.comunidade is not null and v_p.resposta_a is null
     and (v_atividade = 'delete' or interno.rede_fed_grupo_ok(v_p.comunidade)) then
    insert into rede_fed_fila (perfil, comunidade, tipo, objeto, destino, extra)
    select distinct null::uuid, s.comunidade, 'group-announce', v_p.id::text, coalesce(s.inbox_compartilhada, s.inbox), jsonb_build_object('atividade', v_atividade)
    from fediverso_grupo_seguidores s where s.comunidade = v_p.comunidade and not interno.rede_fed_bloqueado(s.inbox);
  end if;
  return null;
end $$;

/** Liga a federação de uma pessoa com o consentimento da versão em vigor (o mesmo que rede_fed_ligar faz). Devolve se ligou. */
create or replace function interno.rede_fed_ligar_perfil(p_perfil uuid) returns boolean language plpgsql security definer set search_path = interno, pg_temp as $$
declare v_handle text;
begin
  if interno.rede_fed_impedimento(p_perfil) is not null then return false; end if;
  v_handle := (select rede_handle from perfis where id = p_perfil);
  if exists (select 1 from rede_fed_atores where handle = v_handle and ligado and perfil <> p_perfil) then return false; end if;
  insert into rede_fed_atores (perfil, handle, ligado, consentimento_versao, ligado_em, desligado_em)
  values (p_perfil, v_handle, true, interno.rede_fed_versao(), now(), null)
  on conflict (perfil) do update set
    ligado_em = case when rede_fed_atores.ligado and rede_fed_atores.handle = excluded.handle then rede_fed_atores.ligado_em else now() end,
    chave_publica = case when rede_fed_atores.handle = excluded.handle then rede_fed_atores.chave_publica end,
    chave_privada = case when rede_fed_atores.handle = excluded.handle then rede_fed_atores.chave_privada end,
    handle = excluded.handle, ligado = true, consentimento_versao = excluded.consentimento_versao, desligado_em = null;
  return true;
end $$;

/**
 * Desliga a federação de uma pessoa (o de sempre: Delete de cada post que saiu, Reject para quem seguia, Undo do que ela seguia) e,
 * agora, desfaz também o que ela curtiu e impulsionou lá fora (Undo) e apaga esses registros.
 */
create or replace function interno.rede_fed_desligar(p_perfil uuid) returns void language plpgsql security definer set search_path = interno, pg_temp as $$
declare e record;
begin
  if not exists (select 1 from rede_fed_atores where perfil = p_perfil and ligado) then return; end if;
  for e in select post from rede_fed_enviados where perfil = p_perfil and apagado_em is null loop
    perform interno.rede_fed_espalhar(p_perfil, 'delete', e.post::text);
  end loop;
  update rede_fed_enviados set apagado_em = now() where perfil = p_perfil and apagado_em is null;
  insert into rede_fed_fila (perfil, tipo, objeto, destino, extra)
  select p_perfil, 'reject', s.ator, s.inbox, jsonb_build_object('pedido', s.pedido) from rede_fed_seguidores s
  where s.perfil = p_perfil and s.pedido <> '' and not interno.rede_fed_bloqueado(s.inbox);
  insert into rede_fed_fila (perfil, tipo, objeto, destino, extra)
  select p_perfil, 'undo-follow', s.ator, coalesce(r.inbox, s.ator), jsonb_build_object('pedido', s.pedido)
  from rede_fed_seguindo s join rede_fed_remotos r on r.ator = s.ator
  where s.perfil = p_perfil and r.inbox is not null and not interno.rede_fed_bloqueado(r.inbox);
  insert into rede_fed_fila (perfil, tipo, objeto, destino, extra)
  select p_perfil, 'undo-' || i.tipo, i.objeto_remoto, r.inbox, jsonb_build_object('atividade', i.atividade_id, 'ator_objeto', i.ator)
  from fediverso_interacoes i join rede_fed_remotos r on r.ator = i.ator
  where i.direcao = 'saida' and i.perfil = p_perfil and r.inbox is not null and not interno.rede_fed_bloqueado(r.inbox);
  delete from fediverso_interacoes where direcao = 'saida' and perfil = p_perfil;
  delete from rede_fed_seguidores where perfil = p_perfil;
  delete from rede_fed_seguindo where perfil = p_perfil;
  update rede_fed_atores set ligado = false, desligado_em = now() where perfil = p_perfil;
end $$;

/**
 * O item "meus posts públicos também vão para o Fediverso" do consentimento de entrada (D2). Marcado, com o modo total ligado, liga
 * a federação; desmarcado, desliga (retira o que saiu). Revogar o consentimento da rede já desliga (interno.rede_fed_consentimento_mudou).
 */
create or replace function interno.rede_fed_consentimento_fediverso() returns trigger language plpgsql security definer set search_path = interno, pg_temp as $$
begin
  if new.revogado_em is not null then return null; end if;
  if new.fediverso and interno.rede_fed_total() then
    if not exists (select 1 from rede_fed_atores where perfil = new.usuario and ligado and consentimento_versao >= interno.rede_fed_versao()) then
      perform interno.rede_fed_ligar_perfil(new.usuario);
    end if;
  elsif not new.fediverso and tg_op = 'UPDATE' and old.fediverso then
    perform interno.rede_fed_desligar(new.usuario);
  end if;
  return null;
end $$;

drop trigger if exists fediverso_consentimento on interno.rede_consentimentos;
create trigger fediverso_consentimento after insert or update of fediverso on interno.rede_consentimentos
  for each row execute function interno.rede_fed_consentimento_fediverso();

/**
 * Esta pessoa pode ver esta nota de fora? Precisa de conta; nunca de instância bloqueada, de quem ela bloqueou, nem de quem a
 * bloqueou lá fora. Só-seguidores: só quem segue o autor (com o pedido aceito). Silenciar esconde da linha, não do fio.
 */
create or replace function interno.rede_fed_nota_ve(c interno.rede_fed_recebidos, p_quem uuid) returns boolean language sql stable security definer set search_path = interno, pg_temp as $$
  select c.id is not null and p_quem is not null
    and not interno.rede_fed_bloqueado(c.ator)
    and not exists (select 1 from fediverso_filtros f where f.usuario = p_quem and f.ator = c.ator and f.tipo = 'bloqueio')
    and not exists (select 1 from fediverso_bloqueios_recebidos b where b.perfil = p_quem and b.ator = c.ator)
    and (c.visibilidade <> 'seguidores' or exists (select 1 from rede_fed_seguindo s where s.perfil = p_quem and s.ator = c.ator and s.aceito))
$$;

/**
 * A nota de fora no MESMO formato de cartão que interno.rede_post_v2 (as mesmas chaves, com os valores neutros onde não se aplica),
 * mais: origem 'fediverso', ator_remoto, handle_remoto, nome_remoto, avatar, servidor, url (o original), html (limpo), sensivel,
 * visibilidade, curti, impulsionei, post_local (o post daqui a que a conversa pertence) e impulsionado_por (quando veio por impulso).
 */
create or replace function interno.rede_fed_cartao(c interno.rede_fed_recebidos, p_quem uuid, p_impulso jsonb default null) returns jsonb language sql stable security definer set search_path = interno, pg_temp as $$
  select jsonb_build_object(
    'id', c.id, 'origem', 'fediverso', 'tipo', 'post', 'titulo', null, 'texto', c.texto, 'html', c.html,
    'corpo', null, 'longo', false, 'comunidade', null, 'flair', null,
    'publico', case when c.visibilidade = 'seguidores' then 'seguidores' else 'internet' end, 'visibilidade', c.visibilidade,
    'criado_em', coalesce(c.publicado, c.recebido_em), 'editado_em', c.editado_em,
    'fixado', false, 'travado', false, 'aceita', null, 'verificada', false,
    'resposta_a', c.em_resposta_a, 'raiz', coalesce(c.contexto, c.id), 'nivel', 0,
    'aviso', c.aviso, 'sensivel', c.sensivel or c.aviso <> '', 'cita', null, 'chamado', null,
    'meu', false, 'retido', false, 'motivo', '', 'modero', false,
    'autor', jsonb_build_object('id', null, 'codinome', coalesce(nullif(r.nome, ''), r.handle, interno.rede_fed_dominio(c.ator)),
                                'handle', r.handle, 'perfil', false, 'equipe', false, 'remoto', true),
    'ator_remoto', c.ator, 'handle_remoto', r.handle, 'nome_remoto', r.nome, 'avatar', r.avatar,
    'servidor', interno.rede_fed_dominio(c.ator), 'url', coalesce(c.url, c.id),
    'respostas', (select count(*)::integer from rede_fed_recebidos x where x.em_resposta_a = c.id and interno.rede_fed_nota_ve(x, p_quem))
               + (select count(*)::integer from rede_posts l where l.resposta_a_remota = c.id and interno.rede_ve(l, p_quem)),
    'na_conversa', null, 'util', 0, 'util_eu', false, 'apoios', null,
    'curti', p_quem is not null and exists (select 1 from fediverso_interacoes i where i.direcao = 'saida' and i.tipo = 'like' and i.perfil = p_quem and i.objeto_remoto = c.id),
    'impulsionei', p_quem is not null and exists (select 1 from fediverso_interacoes i where i.direcao = 'saida' and i.tipo = 'announce' and i.perfil = p_quem and i.objeto_remoto = c.id),
    'apoiei', p_quem is not null and exists (select 1 from fediverso_interacoes i where i.direcao = 'saida' and i.tipo = 'like' and i.perfil = p_quem and i.objeto_remoto = c.id),
    'salvei', false, 'vou', null, 'vou_eu', false,
    'midia', c.midia, 'citado', null, 'post_local', c.post_local, 'impulsionado_por', p_impulso)
  from (select 1) u left join rede_fed_remotos r on r.ator = c.ator
$$;
