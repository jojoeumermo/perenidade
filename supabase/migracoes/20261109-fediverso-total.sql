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

-- ── 6. O que a pessoa chama (com a sessão dela) ────────────────────────────────────────────────────────────────────────

/**
 * Entrar na Alumia com o item destacado do Fediverso (D2): o mesmo rede_aderir de sempre, mais a escolha "meus posts públicos
 * também vão para o Fediverso" (marcada por padrão na tela, mas é a pessoa que decide). Com o modo total ligado, marcar liga a
 * federação (gatilho em rede_consentimentos); desmarcar desliga. Sem o modo total, a escolha só fica guardada.
 */
create or replace function public.rede_aderir(p_maior boolean, p_versao integer, p_fediverso boolean) returns jsonb
language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); v_res jsonb;
begin
  v_res := public.rede_aderir(p_maior, p_versao);
  update rede_consentimentos set fediverso = coalesce(p_fediverso, false)
  where usuario = v and revogado_em is null and versao = (select rede_consentimento from perfis where id = v)
    and fediverso is distinct from coalesce(p_fediverso, false);
  return v_res || jsonb_build_object('fediverso', public.rede_fed_situacao());
end $$;

/** A situação da federação para quem está na sessão (a de sempre, mais: modo total, descoberta e o item do consentimento). */
create or replace function public.rede_fed_situacao() returns jsonb language plpgsql stable security definer set search_path = interno, pg_temp as $$
declare v uuid := auth.uid(); a rede_fed_atores;
begin
  if v is null then return jsonb_build_object('logado', false, 'ligado', false, 'pode', false, 'motivo', 'entre_primeiro', 'versao', interno.rede_fed_versao(), 'total', interno.rede_fed_total()); end if;
  select * into a from rede_fed_atores where perfil = v;
  return jsonb_build_object(
    'logado', true,
    'handle', (select rede_handle from perfis where id = v),
    'motivo', interno.rede_fed_impedimento(v),
    'pode', interno.rede_fed_impedimento(v) is null,
    'ligado', coalesce(a.ligado, false),
    'desde', case when a.ligado then a.ligado_em end,
    'seguidores', (select count(*)::integer from rede_fed_seguidores where perfil = v),
    'seguindo', (select count(*)::integer from rede_fed_seguindo where perfil = v),
    'versao', interno.rede_fed_versao(),
    'total', interno.rede_fed_total(),
    'consentimento_versao', case when a.ligado then a.consentimento_versao end,
    'descobrivel', coalesce(a.ligado and a.descobrivel, false));
end $$;

/** Aparecer (ou não) em diretórios e buscas de fora (discoverable/indexable no ator). Só com a federação ligada. */
create or replace function public.rede_fed_descoberta(p_sim boolean) returns jsonb language plpgsql volatile security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu();
begin
  perform interno.aberta('comunidade');
  perform interno.limite('rede_fed_ligar', 10, 60);
  update rede_fed_atores set descobrivel = coalesce(p_sim, false) where perfil = v and ligado;
  if not found then perform interno.erro('fediverso_desligado'); end if;
  return public.rede_fed_situacao();
end $$;

/**
 * Quem está pedindo, para as rotas do servidor que agem em nome da pessoa. Confere a sessão, a adesão à rede e o limite por
 * pessoa; devolve o perfil e o estado da federação. Ações: buscar, seguir, interagir, responder, remoto, denunciar.
 */
create or replace function public.rede_fed_eu(p_acao text) returns jsonb language plpgsql volatile security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); a rede_fed_atores;
begin
  perform interno.aberta('comunidade');
  if p_acao is null or p_acao not in ('buscar', 'seguir', 'interagir', 'responder', 'remoto', 'denunciar') then perform interno.erro('invalido:acao'); end if;
  if not interno.rede2_membro(v) then perform interno.erro('consentimento'); end if;
  perform interno.limite('rede_fed_' || p_acao, case p_acao when 'buscar' then 30 when 'seguir' then 20 when 'interagir' then 120
                                                           when 'responder' then 30 when 'remoto' then 120 else 10 end, 60);
  select * into a from rede_fed_atores where perfil = v;
  return jsonb_build_object('perfil', v, 'handle', (select rede_handle from perfis where id = v), 'ligado', coalesce(a.ligado, false), 'total', interno.rede_fed_total());
end $$;

/**
 * A mediação bloqueia (ou desbloqueia) uma instância inteira: nada entra dela, nada sai para ela, e o que havia dela some (agora
 * também curtidas, impulsos, avisos, seguidores das comunidades e bloqueios dela). Domínio vazio e p_sim nulo: só a lista.
 */
create or replace function public.rede_fed_bloquear(p_dominio text, p_sim boolean, p_motivo text default '') returns jsonb
language plpgsql volatile security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); v_d text := lower(btrim(coalesce(p_dominio, '')));
begin
  if not (interno.media() or interno.cuida()) then perform interno.erro('sem_permissao'); end if;
  if v_d = '' and p_sim is null then
    return coalesce((select jsonb_agg(jsonb_build_object('dominio', dominio, 'motivo', motivo, 'desde', criado_em) order by dominio) from rede_fed_bloqueados), '[]'::jsonb);
  end if;
  if v_d !~ '^[a-z0-9.-]{3,253}$' or v_d !~ '\.' then perform interno.erro('invalido:dominio'); end if;
  if coalesce(p_sim, true) then
    insert into rede_fed_bloqueados (dominio, motivo, por) values (v_d, left(coalesce(p_motivo, ''), 300), v)
    on conflict (dominio) do update set motivo = excluded.motivo, por = excluded.por, criado_em = now();
    delete from rede_fed_seguidores where interno.rede_fed_bloqueado(ator);
    delete from rede_fed_seguindo where interno.rede_fed_bloqueado(ator);
    delete from rede_fed_recebidos where interno.rede_fed_bloqueado(ator);
    delete from rede_fed_remotos where interno.rede_fed_bloqueado(ator);
    delete from fediverso_interacoes where interno.rede_fed_bloqueado(ator) or interno.rede_fed_bloqueado(objeto_remoto);
    delete from fediverso_grupo_seguidores where interno.rede_fed_bloqueado(ator);
    delete from fediverso_bloqueios_recebidos where interno.rede_fed_bloqueado(ator);
    delete from avisos where ator_remoto is not null and interno.rede_fed_bloqueado(ator_remoto);
    update rede_fed_fila set feito_em = now(), erro = 'instancia_bloqueada' where feito_em is null and interno.rede_fed_bloqueado(destino);
  else
    delete from rede_fed_bloqueados where dominio = v_d;
  end if;
  return coalesce((select jsonb_agg(jsonb_build_object('dominio', dominio, 'motivo', motivo, 'desde', criado_em) order by dominio) from rede_fed_bloqueados), '[]'::jsonb);
end $$;

/**
 * A linha de fora para juntar à linha local (rede_linha) por data, sem aba à parte: as notas de primeiro nível de quem a pessoa
 * segue lá fora e os impulsos (Announce) que essas pessoas fizeram de notas de fora. No MESMO formato de cartão (rede_fed_cartao);
 * criado_em é a hora que ordena (no impulso, a hora do impulso; a da nota fica em publicado_em). Cursor = "<criado_em>|<chave>".
 * Nunca: instância bloqueada, quem a pessoa bloqueou ou silenciou, quem a bloqueou lá fora, palavra silenciada. Modo total
 * desligado: vazia.
 */
create or replace function public.rede_fed_linha_mista(p_cursor text default null, p_limite integer default 20) returns jsonb
language plpgsql volatile security definer set search_path = interno, pg_temp as $$
declare
  v uuid := interno.eu();
  v_limite integer := least(greatest(coalesce(p_limite, 20), 1), 50);
  v_t timestamptz; v_k text;
  v_itens jsonb := '[]'::jsonb; v_n integer := 0; v_proximo text;
  v_linha record; v_nota rede_fed_recebidos; v_impulso jsonb;
begin
  perform interno.aberta('comunidade');
  perform interno.limite('rede2_ler', 600, 60);
  if not interno.rede_fed_total() then return jsonb_build_object('itens', '[]'::jsonb, 'proximo', null); end if;
  if nullif(p_cursor, '') is not null then
    if position('|' in p_cursor) = 0 then perform interno.erro('invalido:cursor'); end if;
    begin
      v_t := split_part(p_cursor, '|', 1)::timestamptz;
    exception when others then
      perform interno.erro('invalido:cursor');
    end;
    v_k := substr(p_cursor, position('|' in p_cursor) + 1);
  end if;
  for v_linha in
    select x.nota, x.quando, x.chave, x.quem from (
      select c.id as nota, coalesce(c.publicado, c.recebido_em) as quando, c.id as chave, null::text as quem
      from rede_fed_recebidos c
      where c.em_resposta_a is null and exists (select 1 from rede_fed_seguindo s where s.perfil = v and s.ator = c.ator and s.aceito)
      union all
      select c.id, i.criado_em, c.id || '#' || i.id::text, i.ator
      from fediverso_interacoes i join rede_fed_recebidos c on c.id = i.objeto_remoto
      where i.direcao = 'entrada' and i.tipo = 'announce' and c.visibilidade <> 'seguidores'
        and exists (select 1 from rede_fed_seguindo s where s.perfil = v and s.ator = i.ator and s.aceito)
    ) x join rede_fed_recebidos c on c.id = x.nota
    where (v_t is null or (x.quando, x.chave) < (v_t, v_k))
      and interno.rede_fed_nota_ve(c, v)
      and not exists (select 1 from fediverso_filtros f where f.usuario = v and (f.ator = c.ator or f.ator = x.quem))
      and (x.quem is null or (not interno.rede_fed_bloqueado(x.quem) and not exists (select 1 from fediverso_bloqueios_recebidos b where b.perfil = v and b.ator = x.quem)))
      and not exists (select 1 from rede_silenciados s where s.usuario = v and s.palavra is not null and (s.ate is null or s.ate > now())
                      and position(interno.normal(s.palavra) in interno.normal(c.texto || ' ' || c.aviso)) > 0)
    order by x.quando desc, x.chave desc
    limit v_limite + 1
  loop
    v_n := v_n + 1;
    if v_n > v_limite then exit; end if;
    select * into v_nota from rede_fed_recebidos where id = v_linha.nota;
    v_impulso := null;
    if v_linha.quem is not null then
      select jsonb_build_object('ator', v_linha.quem, 'handle', q.handle, 'nome', q.nome, 'avatar', q.avatar, 'em', v_linha.quando)
      into v_impulso from (select 1) u left join rede_fed_remotos q on q.ator = v_linha.quem;
    end if;
    v_itens := v_itens || jsonb_build_array(interno.rede_fed_cartao(v_nota, v, v_impulso)
      || jsonb_build_object('criado_em', v_linha.quando, 'publicado_em', coalesce(v_nota.publicado, v_nota.recebido_em), 'chave', v_linha.chave));
    v_proximo := v_linha.quando::text || '|' || v_linha.chave;
  end loop;
  return jsonb_build_object('itens', v_itens, 'proximo', case when v_n > v_limite then v_proximo end);
end $$;

/** O perfil de alguém de fora como a Alumia o conhece (só o que é público e já foi buscado) e as últimas notas dele que a pessoa pode ver. */
create or replace function public.rede_fed_perfil_remoto(p_ator text) returns jsonb language plpgsql volatile security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); v_r rede_fed_remotos; v_s rede_fed_seguindo;
begin
  perform interno.aberta('comunidade');
  perform interno.limite('rede_fed_remoto', 120, 60);
  select * into v_r from rede_fed_remotos where ator = left(btrim(coalesce(p_ator, '')), 500);
  if not found or interno.rede_fed_bloqueado(v_r.ator) or exists (select 1 from fediverso_bloqueios_recebidos b where b.perfil = v and b.ator = v_r.ator) then
    perform interno.erro('nao_encontrado');
  end if;
  select * into v_s from rede_fed_seguindo where perfil = v and ator = v_r.ator;
  return jsonb_build_object('ator', v_r.ator, 'handle', v_r.handle, 'nome', v_r.nome, 'resumo', v_r.resumo, 'url', v_r.url, 'avatar', v_r.avatar,
    'tipo', v_r.tipo, 'servidor', interno.rede_fed_dominio(v_r.ator),
    'seguindo', case when v_s.ator is null then 'nao' when v_s.aceito then 'sim' else 'pedido' end,
    'segue_voce', exists (select 1 from rede_fed_seguidores x where x.perfil = v and x.ator = v_r.ator),
    'bloqueado', exists (select 1 from fediverso_filtros f where f.usuario = v and f.ator = v_r.ator and f.tipo = 'bloqueio'),
    'silenciado', exists (select 1 from fediverso_filtros f where f.usuario = v and f.ator = v_r.ator and f.tipo = 'silencio'),
    'posts', coalesce((select jsonb_agg(interno.rede_fed_cartao(c, v) order by coalesce(c.publicado, c.recebido_em) desc)
                       from rede_fed_recebidos c where c.id in (
                         select y.id from rede_fed_recebidos y where y.ator = v_r.ator and interno.rede_fed_nota_ve(y, v)
                         order by coalesce(y.publicado, y.recebido_em) desc limit 20)), '[]'::jsonb));
end $$;

/**
 * O fio de uma nota de fora: a nota, o que vem acima (até 10 níveis: notas de fora guardadas ou o post daqui que começou a
 * conversa) e as respostas (de fora e daqui), cada uma pela regra de quem pode ver.
 */
create or replace function public.rede_fed_fio_remoto(p_id text) returns jsonb language plpgsql volatile security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); v_c rede_fed_recebidos; v_x rede_fed_recebidos; v_l rede_posts; v_acima jsonb := '[]'::jsonb; v_ref text; v_n integer := 0;
begin
  perform interno.aberta('comunidade');
  perform interno.limite('rede2_ler', 600, 60);
  select * into v_c from rede_fed_recebidos where id = left(coalesce(p_id, ''), 500);
  if not found or not interno.rede_fed_nota_ve(v_c, v) then perform interno.erro('nao_encontrado'); end if;
  v_ref := v_c.em_resposta_a;
  while v_ref is not null and v_n < 10 loop
    v_n := v_n + 1;
    select * into v_x from rede_fed_recebidos where id = v_ref;
    if found then
      if not interno.rede_fed_nota_ve(v_x, v) then exit; end if;
      v_acima := jsonb_build_array(interno.rede_fed_cartao(v_x, v)) || v_acima;
      v_ref := v_x.em_resposta_a;
    else
      select * into v_l from rede_posts where id = interno.rede_fed_post_local(v_ref);
      if found and interno.rede_ve(v_l, v) then v_acima := jsonb_build_array(interno.rede_post_v2(v_l, v)) || v_acima; end if;
      exit;
    end if;
  end loop;
  return jsonb_build_object('post', interno.rede_fed_cartao(v_c, v), 'acima', v_acima,
    'respostas', coalesce((select jsonb_agg(z.j order by z.q) from (
        select interno.rede_fed_cartao(c, v) as j, coalesce(c.publicado, c.recebido_em) as q
        from rede_fed_recebidos c where c.em_resposta_a = v_c.id and interno.rede_fed_nota_ve(c, v)
        union all
        select interno.rede_post_v2(p, v), p.criado_em
        from rede_posts p where p.resposta_a_remota = v_c.id and interno.rede_ve(p, v) and not interno.rede_silenciado(p, v)
        order by 2 limit 200) z), '[]'::jsonb));
end $$;

/**
 * Curtir (like) ou impulsionar (announce) uma nota de fora, ou desfazer (p_sim = false). Põe na fila a atividade para a caixa do
 * autor (e, no impulso, também para quem segue a pessoa). Precisa do modo total e da federação ligada (a atividade sai assinada).
 * Impulsionar só-seguidores não pode (como no Mastodon).
 */
create or replace function public.rede_fed_interagir(p_post_remoto text, p_tipo text, p_sim boolean default true) returns jsonb
language plpgsql volatile security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); v_c rede_fed_recebidos; v_r rede_fed_remotos; v_i fediverso_interacoes; v_ativ text;
begin
  perform interno.aberta('comunidade');
  if p_tipo is null or p_tipo not in ('like', 'announce') then perform interno.erro('invalido:tipo'); end if;
  if not interno.rede2_membro(v) then perform interno.erro('consentimento'); end if;
  if not interno.rede_fed_total() or interno.rede_fed_impedimento(v) is not null or not exists (select 1 from rede_fed_atores where perfil = v and ligado) then
    perform interno.erro('fediverso_desligado');
  end if;
  perform interno.limite('rede_fed_interagir', 300, 60);
  select * into v_c from rede_fed_recebidos where id = left(coalesce(p_post_remoto, ''), 500);
  if not found or not interno.rede_fed_nota_ve(v_c, v) then perform interno.erro('nao_encontrado'); end if;
  if p_tipo = 'announce' and v_c.visibilidade = 'seguidores' then perform interno.erro('sem_permissao'); end if;
  select * into v_r from rede_fed_remotos where ator = v_c.ator;
  if v_r.inbox is null then perform interno.erro('nao_encontrado'); end if;
  if coalesce(p_sim, true) then
    v_ativ := gen_random_uuid()::text;
    insert into fediverso_interacoes (direcao, tipo, ator, perfil, objeto_remoto, atividade_id) values ('saida', p_tipo, v_c.ator, v, v_c.id, v_ativ)
    on conflict do nothing returning * into v_i;
  else
    delete from fediverso_interacoes where direcao = 'saida' and tipo = p_tipo and perfil = v and objeto_remoto = v_c.id returning * into v_i;
  end if;
  if v_i.id is not null then
    insert into rede_fed_fila (perfil, tipo, objeto, destino, extra)
    values (v, case when coalesce(p_sim, true) then p_tipo else 'undo-' || p_tipo end, v_c.id, v_r.inbox, jsonb_build_object('atividade', v_i.atividade_id, 'ator_objeto', v_c.ator));
    if p_tipo = 'announce' then
      insert into rede_fed_fila (perfil, tipo, objeto, destino, extra)
      select distinct v, case when coalesce(p_sim, true) then 'announce' else 'undo-announce' end, v_c.id, coalesce(s.inbox_compartilhada, s.inbox),
             jsonb_build_object('atividade', v_i.atividade_id, 'ator_objeto', v_c.ator)
      from rede_fed_seguidores s where s.perfil = v and not interno.rede_fed_bloqueado(s.inbox) and coalesce(s.inbox_compartilhada, s.inbox) <> v_r.inbox;
    end if;
  end if;
  return jsonb_build_object('ok', true,
    'curti', exists (select 1 from fediverso_interacoes i where i.direcao = 'saida' and i.tipo = 'like' and i.perfil = v and i.objeto_remoto = v_c.id),
    'impulsionei', exists (select 1 from fediverso_interacoes i where i.direcao = 'saida' and i.tipo = 'announce' and i.perfil = v and i.objeto_remoto = v_c.id));
end $$;

/**
 * Responder a uma nota de fora: cria o post daqui pelo rede_publicar de sempre (todas as regras: adesão, limite, dado pessoal),
 * guarda a nota respondida (resposta_a_remota, que sai como inReplyTo) e garante a entrega na caixa do autor da nota. Nota só para
 * seguidores não se responde daqui (a resposta sairia pública).
 */
create or replace function public.rede_fed_responder_remoto(p_post_remoto text, p_texto text, p_aviso text default '') returns jsonb
language plpgsql volatile security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); v_c rede_fed_recebidos; v_r rede_fed_remotos; v_res jsonb; v_id uuid; v_fed boolean;
begin
  perform interno.aberta('comunidade');
  if not interno.rede_fed_total() or interno.rede_fed_impedimento(v) is not null or not exists (select 1 from rede_fed_atores where perfil = v and ligado) then
    perform interno.erro('fediverso_desligado');
  end if;
  select * into v_c from rede_fed_recebidos where id = left(coalesce(p_post_remoto, ''), 500);
  if not found or not interno.rede_fed_nota_ve(v_c, v) then perform interno.erro('nao_encontrado'); end if;
  if v_c.visibilidade = 'seguidores' then perform interno.erro('sem_permissao'); end if;
  v_res := public.rede_publicar(jsonb_build_object('tipo', 'post', 'texto', p_texto, 'aviso', coalesce(p_aviso, '')));
  v_id := (v_res ->> 'id')::uuid;
  update rede_posts set resposta_a_remota = v_c.id where id = v_id;
  v_fed := exists (select 1 from rede_fed_enviados e where e.post = v_id and e.apagado_em is null);
  select * into v_r from rede_fed_remotos where ator = v_c.ator;
  if v_fed and v_r.inbox is not null and not interno.rede_fed_bloqueado(v_r.inbox)
     and not exists (select 1 from rede_fed_fila q where q.tipo = 'create' and q.objeto = v_id::text and q.destino in (v_r.inbox, coalesce(v_r.inbox_compartilhada, v_r.inbox))) then
    insert into rede_fed_fila (perfil, tipo, objeto, destino) values (v, 'create', v_id::text, v_r.inbox);
  end if;
  return v_res || jsonb_build_object('resposta_a_remota', v_c.id, 'federado', v_fed);
end $$;

/**
 * Denunciar uma nota ou um ator de fora. Fica na mediação daqui (fediverso_denuncias, saída). Com p_encaminhar, a Flag vai para a
 * instância de lá, assinada pela instância daqui: leva os alvos e o comentário, nunca quem denunciou (LGPD art. 6º, III).
 */
create or replace function public.rede_fed_denunciar_remoto(p_alvo text, p_categoria text, p_texto text default '', p_encaminhar boolean default false) returns jsonb
language plpgsql volatile security definer set search_path = interno, pg_temp as $$
declare
  v uuid := interno.eu(); v_c rede_fed_recebidos; v_r rede_fed_remotos; v_alvo text := left(btrim(coalesce(p_alvo, '')), 500);
  v_ator text; v_alvos jsonb; v_d fediverso_denuncias; v_destino text; v_texto text := interno.txt(coalesce(p_texto, ''), 'texto', 0, 1000);
begin
  perform interno.aberta('comunidade');
  if not interno.rede2_membro(v) then perform interno.erro('consentimento'); end if;
  if p_categoria is null or p_categoria not in ('menores', 'ameaca', 'exposicao', 'violencia', 'autolesao', 'odio', 'assedio', 'golpe', 'spam', 'outro') then perform interno.erro('invalido:categoria'); end if;
  select * into v_c from rede_fed_recebidos where id = v_alvo;
  if found then
    if not interno.rede_fed_nota_ve(v_c, v) then perform interno.erro('nao_encontrado'); end if;
    v_ator := v_c.ator; v_alvos := jsonb_build_array(v_c.ator, v_c.id);
  else
    select * into v_r from rede_fed_remotos where ator = v_alvo;
    if not found then perform interno.erro('nao_encontrado'); end if;
    v_ator := v_r.ator; v_alvos := jsonb_build_array(v_r.ator);
  end if;
  if interno.rede_fed_bloqueado(v_ator) then perform interno.erro('instancia_bloqueada'); end if;
  select * into v_d from fediverso_denuncias where direcao = 'saida' and quem = v and alvos = v_alvos and situacao in ('aberta', 'em_analise') limit 1;
  if found then return jsonb_build_object('protocolo', v_d.protocolo, 'encaminhada', v_d.encaminhar, 'ja', true); end if;
  perform interno.rede2_limite('denunciar');
  insert into fediverso_denuncias (direcao, dominio, ator, alvos, categoria, conteudo, quem, encaminhar)
  values ('saida', interno.rede_fed_dominio(v_ator), v_ator, v_alvos, p_categoria, v_texto, v, coalesce(p_encaminhar, false))
  returning * into v_d;
  if v_d.encaminhar then
    select coalesce(q.inbox_compartilhada, q.inbox) into v_destino from rede_fed_remotos q where q.ator = v_ator;
    if v_destino is not null then
      insert into rede_fed_fila (perfil, tipo, objeto, destino, extra)
      values (null, 'flag', v_ator, v_destino, jsonb_build_object('alvos', v_alvos, 'conteudo', v_texto, 'denuncia', v_d.protocolo));
    end if;
  end if;
  if interno.rede2_prioridade(p_categoria) = 1 then
    insert into avisos (para, texto)
    select distinct p.usuario, left('Denúncia prioritária ' || v_d.protocolo || ' sobre conteúdo de outro servidor do Fediverso (' || p_categoria || '). Abra a mediação de instâncias.', 500)
    from papeis p where p.papel in ('coordenacao', 'vice', 'mediacao') and p.usuario <> v;
  end if;
  return jsonb_build_object('protocolo', v_d.protocolo, 'encaminhada', v_d.encaminhar and v_destino is not null, 'ja', false);
end $$;

/**
 * Bloquear (ou desbloquear) alguém de fora: some da linha, dos avisos e do fio; deixa de seguir e de ser seguido; com a federação
 * ligada, sai um Block (e um Undo dele ao desbloquear).
 */
create or replace function public.rede_fed_bloquear_pessoa(p_ator text, p_sim boolean default true) returns jsonb
language plpgsql volatile security definer set search_path = interno, pg_temp as $$
declare
  v uuid := interno.eu(); v_ator text := left(btrim(coalesce(p_ator, '')), 500); v_f fediverso_filtros; v_inbox text; v_ativ text;
  v_ligado boolean := exists (select 1 from rede_fed_atores where perfil = v and ligado);
begin
  perform interno.aberta('comunidade');
  perform interno.limite('rede_fed_filtro', 60, 60);
  if v_ator !~ '^https://[^\s]+$' then perform interno.erro('invalido:ator'); end if;
  select inbox into v_inbox from rede_fed_remotos where ator = v_ator;
  select * into v_f from fediverso_filtros where usuario = v and ator = v_ator;
  if coalesce(p_sim, true) then
    if v_f.tipo is distinct from 'bloqueio' then
      v_ativ := case when v_ligado and v_inbox is not null and not interno.rede_fed_bloqueado(v_inbox) then gen_random_uuid()::text end;
      insert into fediverso_filtros (usuario, ator, tipo, atividade) values (v, v_ator, 'bloqueio', v_ativ)
      on conflict (usuario, ator) do update set tipo = 'bloqueio', atividade = excluded.atividade, criado_em = now();
      if v_ativ is not null then
        insert into rede_fed_fila (perfil, tipo, objeto, destino, extra) values (v, 'block', v_ator, v_inbox, jsonb_build_object('atividade', v_ativ));
      end if;
    end if;
    delete from avisos where para = v and ator_remoto = v_ator;
    delete from rede_fed_seguidores where perfil = v and ator = v_ator;
    if v_ligado and v_inbox is not null then
      insert into rede_fed_fila (perfil, tipo, objeto, destino, extra)
      select v, 'undo-follow', s.ator, v_inbox, jsonb_build_object('pedido', s.pedido) from rede_fed_seguindo s where s.perfil = v and s.ator = v_ator;
    end if;
    delete from rede_fed_seguindo where perfil = v and ator = v_ator;
  elsif v_f.tipo = 'bloqueio' then
    delete from fediverso_filtros where usuario = v and ator = v_ator;
    if v_f.atividade is not null and v_ligado and v_inbox is not null then
      insert into rede_fed_fila (perfil, tipo, objeto, destino, extra) values (v, 'undo-block', v_ator, v_inbox, jsonb_build_object('atividade', v_f.atividade));
    end if;
  end if;
  return jsonb_build_object('ok', true, 'bloqueado', exists (select 1 from fediverso_filtros f where f.usuario = v and f.ator = v_ator and f.tipo = 'bloqueio'));
end $$;

/** Silenciar (ou não) alguém de fora: some da linha e dos avisos, só aqui (nada sai). Quem está bloqueado continua bloqueado. */
create or replace function public.rede_fed_silenciar_pessoa(p_ator text, p_sim boolean default true) returns jsonb
language plpgsql volatile security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); v_ator text := left(btrim(coalesce(p_ator, '')), 500);
begin
  perform interno.aberta('comunidade');
  perform interno.limite('rede_fed_filtro', 60, 60);
  if v_ator !~ '^https://[^\s]+$' then perform interno.erro('invalido:ator'); end if;
  if coalesce(p_sim, true) then
    insert into fediverso_filtros (usuario, ator, tipo) values (v, v_ator, 'silencio') on conflict (usuario, ator) do nothing;
  else
    delete from fediverso_filtros where usuario = v and ator = v_ator and tipo = 'silencio';
  end if;
  return jsonb_build_object('ok', true, 'silenciado', exists (select 1 from fediverso_filtros f where f.usuario = v and f.ator = v_ator and f.tipo = 'silencio'));
end $$;

/** A mediação lê as denúncias com o Fediverso (as que chegaram de fora e as que saem daqui). Sem o nome de quem denunciou. */
create or replace function public.rede_fed_denuncias_listar(p_situacao text default 'aberta') returns jsonb
language plpgsql stable security definer set search_path = interno, pg_temp as $$
begin
  perform interno.eu();
  if not (interno.media() or interno.cuida()) then perform interno.erro('sem_permissao'); end if;
  return coalesce((select jsonb_agg(jsonb_build_object('id', d.id, 'protocolo', d.protocolo, 'direcao', d.direcao, 'dominio', d.dominio, 'ator', d.ator,
      'alvos', d.alvos, 'categoria', d.categoria, 'conteudo', d.conteudo, 'encaminhar', d.encaminhar, 'situacao', d.situacao,
      'denuncias', to_jsonb(d.denuncias), 'criado_em', d.criado_em) order by d.criado_em desc)
    from (select * from fediverso_denuncias where p_situacao is null or situacao = p_situacao order by criado_em desc limit 200) d), '[]'::jsonb);
end $$;

/** A mediação decide uma denúncia com o Fediverso. */
create or replace function public.rede_fed_denuncia_decidir(p_id uuid, p_situacao text) returns jsonb
language plpgsql volatile security definer set search_path = interno, pg_temp as $$
begin
  perform interno.eu();
  if not (interno.media() or interno.cuida()) then perform interno.erro('sem_permissao'); end if;
  if p_situacao is null or p_situacao not in ('aberta', 'em_analise', 'resolvida', 'descartada') then perform interno.erro('invalido:situacao'); end if;
  update fediverso_denuncias set situacao = p_situacao where id = p_id;
  if not found then perform interno.erro('nao_encontrado'); end if;
  perform interno.registrar('rede_fed_denuncia', p_id::text, jsonb_build_object('situacao', p_situacao));
  return jsonb_build_object('ok', true);
end $$;
