-- Sentinela Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja ../../LICENSE).
--
-- Banco do painel de monitoramento de segurança do site do Instituto Lúcia. É um projeto Supabase SEPARADO do site:
-- se um cair ou for invadido, o outro não é atingido. Rode este arquivo inteiro no SQL Editor. Pode rodar de novo sem
-- medo: ele não apaga nada e só cria o que falta.
--
-- Como a segurança funciona (o mesmo desenho do banco do site)
--   1. As tabelas ficam no esquema "vigia", que a API não expõe. Ninguém lê nem escreve nelas direto.
--   2. A única porta de entrada são as funções do esquema "public". Cada uma confere, dentro do banco, quem está
--      chamando, o papel dessa pessoa (dono, analista, leitor) e se a sessão passou pelo segundo fator (aal2).
--   3. O coletor (Cloudflare Worker) grava com a chave de serviço, por funções próprias ("coleta_*"). Os tokens das
--      plataformas (Cloudflare, Vercel, GitHub, Supabase do site) NÃO ficam aqui: ficam nos segredos do Worker.
--   4. Tudo o que alguém vê ou faz de sensível entra em "vigia.auditoria", que ninguém edita nem apaga.
--
-- Primeira conta: crie a sua conta pelo app (ou em Authentication → Users → Add user). Enquanto não existe dono,
-- a primeira conta entra sem convite, mas sem papel nenhum. Depois rode aqui:
--   select public.promover_dono('seu-email@exemplo.com');
-- A partir daí, só entra quem recebe convite (Equipe → Convidar).

create schema if not exists vigia;
revoke all on schema vigia from public;

-- ───────────────────────────── Tabelas ─────────────────────────────

-- Quem usa o painel. No máximo cinco contas ativas.
create table if not exists vigia.perfis (
  id uuid primary key references auth.users (id) on delete cascade,
  nome text not null default '' check (char_length(nome) <= 80),
  papel text not null default 'leitor' check (papel in ('dono', 'analista', 'leitor')),
  ativo boolean not null default false,
  -- Como a pessoa quer ser avisada: {"email": true, "desktop": true, "minimo": "media"}
  avisos jsonb not null default '{"email": true, "desktop": true, "minimo": "media"}'::jsonb,
  criado_em timestamptz not null default now(),
  visto_em timestamptz not null default now()
);

-- Convites pessoais: um e-mail, um papel, um uso, sete dias. O código nunca fica guardado: só o selo (SHA-256).
create table if not exists vigia.convites (
  id uuid primary key default gen_random_uuid(),
  selo text not null unique,
  email text not null check (email ~ '^[^@[:space:]]+@[^@[:space:]]+[.][^@[:space:]]+$' and char_length(email) <= 200),
  papel text not null check (papel in ('dono', 'analista', 'leitor')),
  criado_por uuid references vigia.perfis (id) on delete set null,
  criado_em timestamptz not null default now(),
  expira_em timestamptz not null default now() + interval '7 days',
  usado_em timestamptz,
  usado_por uuid,
  revogado boolean not null default false
);

-- Quem viu e fez o quê. Só cresce; o dono lê. Não guarda endereço de rede de quem usa o painel.
create table if not exists vigia.auditoria (
  id bigint generated always as identity primary key,
  quem uuid,
  nome text not null default '',
  acao text not null check (char_length(acao) between 2 and 60),
  alvo text not null default '',
  detalhes jsonb not null default '{}'::jsonb,
  criado_em timestamptz not null default clock_timestamp()
);
create index if not exists auditoria_recentes on vigia.auditoria (criado_em desc);

-- O que o painel vigia e como. Nada secreto entra aqui (segredos ficam no Worker).
create table if not exists vigia.configuracoes (
  chave text primary key,
  valor jsonb not null
);
insert into vigia.configuracoes (chave, valor) values
  ('site', '{"url": "https://institutolucia.org", "dominio": "institutolucia.org", "paginas": ["/", "/pt", "/pt/entrar", "/pt/trilhas", "/pt/acervo", "/.well-known/assetlinks.json"], "terceiros_permitidos": ["challenges.cloudflare.com", "www.youtube-nocookie.com", "player.vimeo.com", "api.languagetool.org"]}'::jsonb),
  ('plataformas', '{"cloudflare_zona": "", "vercel_projeto": "", "vercel_equipe": "", "github_repositorio": "", "supabase_site_url": "", "supabase_site_ref": ""}'::jsonb),
  ('retencao', '{"eventos_dias": 90, "verificacoes_dias": 90, "agregados_dias": 400}'::jsonb)
on conflict do nothing;

-- Regras de alerta: ligadas ou não, com parâmetros. O Worker lê; o dono ajusta.
create table if not exists vigia.regras (
  id text primary key check (id ~ '^[a-z_]{3,40}$'),
  ligada boolean not null default true,
  gravidade text not null default 'media' check (gravidade in ('baixa', 'media', 'alta', 'critica')),
  parametros jsonb not null default '{}'::jsonb,
  descricao text not null default ''
);
insert into vigia.regras (id, gravidade, parametros, descricao) values
  ('site_fora', 'critica', '{"coletas_seguidas": 2}', 'O site não respondeu em duas coletas seguidas.'),
  ('site_lento', 'media', '{"ms": 3000, "coletas_seguidas": 3}', 'Tempo de resposta acima do limite em três coletas seguidas.'),
  ('pico_bloqueios', 'alta', '{"vezes_mediana": 5, "minimo": 50}', 'Bloqueios do WAF cinco vezes acima da mediana da semana.'),
  ('pico_requisicoes', 'alta', '{"vezes_mediana": 8, "minimo": 2000}', 'Requisições muito acima do normal (possível DDoS).'),
  ('logins_falhos', 'alta', '{"maximo_10min": 30}', 'Muitas tentativas de entrada erradas em dez minutos.'),
  ('pagina_mudou', 'alta', '{}', 'O conteúdo de uma página vigiada mudou sem deploy correspondente.'),
  ('dns_mudou', 'critica', '{}', 'Um registro DNS do domínio mudou.'),
  ('certificado_novo', 'alta', '{"emissores_conhecidos": ["Google Trust Services", "Let''s Encrypt", "Cloudflare", "Sectigo", "DigiCert"]}', 'Apareceu nos CT logs um certificado de emissor desconhecido para o domínio.'),
  ('terceiro_novo', 'alta', '{}', 'Uma página passou a carregar script, iframe ou recurso de um domínio que não está na lista.'),
  ('dominio_parecido', 'media', '{}', 'Um domínio parecido com o do instituto passou a resolver.'),
  ('deploy_falhou', 'media', '{}', 'Um deploy da Vercel falhou.'),
  ('deploy_desconhecido', 'media', '{}', 'Um deploy de produção que não veio do ramo principal.'),
  ('github_alerta', 'media', '{"minimo": "high"}', 'Alerta novo do GitHub (Dependabot, segredo, análise de código, rotina falhando).'),
  ('supabase_fora', 'alta', '{"coletas_seguidas": 2}', 'O serviço de contas do site não respondeu em duas coletas seguidas.'),
  ('cabecalho_sumiu', 'alta', '{}', 'Um cabeçalho de segurança do site deixou de ser enviado.'),
  ('csp_violacoes', 'baixa', '{"minimo_hora": 20}', 'Muitas violações novas da política de segurança do conteúdo.'),
  ('isca_pico', 'media', '{"maximo_hora": 100}', 'Muitas visitas a endereços-isca (varredura).'),
  ('reputacao_ruim', 'media', '{"minimo_abuso": 80}', 'Origem bloqueada com reputação ruim conhecida insistindo.'),
  ('assetlinks_mudou', 'alta', '{}', 'O arquivo que liga o aplicativo Android ao site mudou ou sumiu.')
on conflict do nothing;

-- Cada passada do coletor em um alvo: no ar?, código, tempo, resumo do conteúdo, cabeçalhos e nota de postura.
create table if not exists vigia.verificacoes (
  id bigint generated always as identity primary key,
  em timestamptz not null default now(),
  alvo text not null check (char_length(alvo) <= 200),
  regiao text not null default '',
  no_ar boolean not null,
  status integer,
  ms integer,
  hash text,
  cabecalhos jsonb not null default '{}'::jsonb,
  nota integer,
  erro text not null default ''
);
create index if not exists verificacoes_alvo on vigia.verificacoes (alvo, em desc);
create index if not exists verificacoes_em on vigia.verificacoes (em desc);

-- Tráfego por janela de cinco minutos, vindo da Cloudflare: pedidos, bloqueios, por país, por código.
create table if not exists vigia.metricas (
  em timestamptz primary key,
  requisicoes bigint not null default 0,
  bloqueios bigint not null default 0,
  desafios bigint not null default 0,
  bytes bigint not null default 0,
  por_pais jsonb not null default '{}'::jsonb,
  por_status jsonb not null default '{}'::jsonb,
  por_caminho jsonb not null default '{}'::jsonb
);

-- Eventos de segurança: WAF, logins falhos, iscas, CSP, DNS, certificados, hash, terceiros… Só o que os logs já
-- trazem (IP, país, ASN); nada é consultado para identificar pessoas.
create table if not exists vigia.eventos (
  id bigint generated always as identity primary key,
  em timestamptz not null default now(),
  fonte text not null check (fonte in ('waf', 'auth', 'isca', 'csp', 'vercel', 'github', 'supabase', 'dns', 'certificado', 'pagina', 'terceiro', 'dominio', 'reputacao', 'uptime', 'cabecalho', 'manual')),
  tipo text not null default '' check (char_length(tipo) <= 60),
  gravidade text not null default 'baixa' check (gravidade in ('info', 'baixa', 'media', 'alta', 'critica')),
  ip text not null default '',
  pais text not null default '',
  asn text not null default '',
  asn_nome text not null default '',
  caminho text not null default '',
  agente text not null default '',
  acao text not null default '',
  regra text not null default '',
  detalhes jsonb not null default '{}'::jsonb,
  -- Impressão do evento na origem (id do log, hash do conteúdo): a mesma coleta nunca entra duas vezes.
  impressao text unique
);
create index if not exists eventos_em on vigia.eventos (em desc);
create index if not exists eventos_fonte on vigia.eventos (fonte, em desc);
create index if not exists eventos_ip on vigia.eventos (ip, em desc) where ip <> '';

-- Alertas gerados pelas regras. Um alerta igual (mesma impressão) não se repete por uma hora.
create table if not exists vigia.alertas (
  id bigint generated always as identity primary key,
  em timestamptz not null default now(),
  regra text not null,
  gravidade text not null check (gravidade in ('baixa', 'media', 'alta', 'critica')),
  titulo text not null check (char_length(titulo) between 3 and 160),
  resumo text not null default '' check (char_length(resumo) <= 1000),
  detalhes jsonb not null default '{}'::jsonb,
  estado text not null default 'aberto' check (estado in ('aberto', 'visto', 'silenciado', 'resolvido')),
  impressao text,
  incidente uuid,
  visto_por uuid,
  visto_em timestamptz,
  silenciado_ate timestamptz,
  avisado boolean not null default false
);
create index if not exists alertas_estado on vigia.alertas (estado, em desc);
create index if not exists alertas_impressao on vigia.alertas (impressao, em desc) where impressao is not null;

-- Incidentes: abrir, atribuir, acompanhar, resolver. Tudo o que acontece neles fica na auditoria e nas notas.
create table if not exists vigia.incidentes (
  id uuid primary key default gen_random_uuid(),
  numero integer generated always as identity,
  titulo text not null check (char_length(titulo) between 3 and 160),
  resumo text not null default '' check (char_length(resumo) <= 4000),
  gravidade text not null default 'media' check (gravidade in ('baixa', 'media', 'alta', 'critica')),
  estado text not null default 'aberto' check (estado in ('aberto', 'investigando', 'contido', 'resolvido')),
  modelo text not null default '' check (modelo in ('', 'ddos', 'credenciais', 'defacement', 'certificado', 'deploy', 'dns', 'outro')),
  aberto_por uuid references vigia.perfis (id) on delete set null,
  atribuido_a uuid references vigia.perfis (id) on delete set null,
  aberto_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  resolvido_em timestamptz
);
create table if not exists vigia.incidente_notas (
  id bigint generated always as identity primary key,
  incidente uuid not null references vigia.incidentes (id) on delete cascade,
  autor uuid references vigia.perfis (id) on delete set null,
  texto text not null check (char_length(texto) between 1 and 4000),
  -- 'nota' é escrita por alguém; 'sistema' é o próprio painel anotando (mudança de estado, ação executada).
  tipo text not null default 'nota' check (tipo in ('nota', 'sistema')),
  em timestamptz not null default now()
);
create index if not exists incidente_notas_ordem on vigia.incidente_notas (incidente, em);
create table if not exists vigia.incidente_eventos (
  incidente uuid not null references vigia.incidentes (id) on delete cascade,
  evento bigint not null references vigia.eventos (id) on delete cascade,
  primary key (incidente, evento)
);

-- Ações de resposta (bloquear origem na Cloudflare, por exemplo). Proposta por um analista, confirmada por OUTRA
-- pessoa (dono ou analista), executada pelo Worker. Nunca sem confirmação.
create table if not exists vigia.acoes (
  id uuid primary key default gen_random_uuid(),
  incidente uuid references vigia.incidentes (id) on delete set null,
  tipo text not null check (tipo in ('bloquear_ip', 'bloquear_asn', 'bloquear_pais', 'desafiar_ip', 'desbloquear')),
  alvo text not null check (char_length(alvo) between 1 and 80),
  motivo text not null check (char_length(motivo) between 5 and 500),
  duracao_horas integer not null default 24 check (duracao_horas between 1 and 24 * 90),
  estado text not null default 'proposta' check (estado in ('proposta', 'confirmada', 'executada', 'falhou', 'recusada', 'desfeita')),
  proposta_por uuid references vigia.perfis (id) on delete set null,
  proposta_em timestamptz not null default now(),
  confirmada_por uuid references vigia.perfis (id) on delete set null,
  confirmada_em timestamptz,
  executada_em timestamptz,
  resultado jsonb not null default '{}'::jsonb,
  -- O identificador que a Cloudflare devolveu, para desfazer.
  referencia text not null default ''
);
create index if not exists acoes_estado on vigia.acoes (estado, proposta_em);

-- Integridade: DNS, certificados, scripts de terceiros, domínios parecidos, deploys, alertas do GitHub.
create table if not exists vigia.dns (
  id bigint generated always as identity primary key,
  em timestamptz not null default now(),
  nome text not null,
  tipo text not null,
  valores text[] not null default '{}',
  -- Verdadeiro na última leitura de cada (nome, tipo); as anteriores são o histórico.
  atual boolean not null default true
);
create index if not exists dns_atual on vigia.dns (nome, tipo) where atual;

create table if not exists vigia.certificados (
  crt_id bigint primary key,
  emissor text not null default '',
  nome_comum text not null default '',
  nomes text[] not null default '{}',
  nao_antes timestamptz,
  nao_depois timestamptz,
  visto_em timestamptz not null default now(),
  conhecido boolean not null default true
);

create table if not exists vigia.terceiros (
  id bigint generated always as identity primary key,
  pagina text not null,
  tipo text not null check (tipo in ('script', 'iframe', 'link', 'img', 'connect', 'outro')),
  host text not null,
  url text not null default '',
  primeiro_em timestamptz not null default now(),
  visto_em timestamptz not null default now(),
  permitido boolean not null default false,
  unique (pagina, tipo, host)
);

create table if not exists vigia.dominios_parecidos (
  dominio text primary key,
  resolve boolean not null default false,
  registros jsonb not null default '{}'::jsonb,
  primeiro_em timestamptz not null default now(),
  visto_em timestamptz not null default now(),
  mudou_em timestamptz
);

create table if not exists vigia.deploys (
  id text primary key,
  estado text not null default '',
  ambiente text not null default '',
  url text not null default '',
  ramo text not null default '',
  commit text not null default '',
  mensagem text not null default '',
  autor text not null default '',
  criado_em timestamptz not null default now(),
  pronto_em timestamptz
);
create index if not exists deploys_recentes on vigia.deploys (criado_em desc);

create table if not exists vigia.github_alertas (
  id text primary key,
  tipo text not null check (tipo in ('dependabot', 'segredo', 'codigo', 'rotina')),
  gravidade text not null default '',
  titulo text not null default '',
  pacote text not null default '',
  estado text not null default 'open',
  url text not null default '',
  criado_em timestamptz not null default now(),
  visto_em timestamptz not null default now()
);

-- Violações da política de segurança do conteúdo (CSP) relatadas pelos navegadores, agrupadas.
create table if not exists vigia.csp_violacoes (
  id bigint generated always as identity primary key,
  impressao text not null unique,
  documento text not null default '',
  diretiva text not null default '',
  bloqueado text not null default '',
  vezes integer not null default 1,
  primeiro_em timestamptz not null default now(),
  ultimo_em timestamptz not null default now()
);

-- Índice de postura (0–100) e seus componentes, calculados pelo Worker a cada coleta.
create table if not exists vigia.postura (
  em timestamptz primary key,
  nota integer not null check (nota between 0 and 100),
  componentes jsonb not null default '[]'::jsonb
);

-- Fila de e-mails (convites, alertas). O Worker envia pelo Resend e apaga o texto depois.
create table if not exists vigia.emails (
  id uuid primary key default gen_random_uuid(),
  para text not null check (para ~ '^[^@[:space:]]+@[^@[:space:]]+[.][^@[:space:]]+$' and char_length(para) <= 200),
  tipo text not null check (tipo ~ '^[a-z_]{3,40}$'),
  assunto text not null check (char_length(assunto) between 1 and 200),
  texto text not null default '' check (char_length(texto) <= 20000),
  status text not null default 'pendente' check (status in ('pendente', 'enviando', 'enviado', 'falhou')),
  tentativas smallint not null default 0,
  erro text not null default '',
  criado_em timestamptz not null default now(),
  tentado_em timestamptz,
  enviado_em timestamptz
);
create index if not exists emails_fila on vigia.emails (status, criado_em);

-- Contador de pedidos por pessoa (ou por origem embaralhada), para frear abuso.
create table if not exists vigia.limites (
  chave text not null,
  janela timestamptz not null,
  total integer not null default 0,
  primary key (chave, janela)
);

-- Trancadas duas vezes: sem permissões e com segurança por linha ligada (sem nenhuma regra = ninguém passa).
do $$
declare t record;
begin
  for t in select tablename from pg_tables where schemaname = 'vigia' loop
    execute format('alter table vigia.%I enable row level security', t.tablename);
    execute format('revoke all on vigia.%I from public', t.tablename);
  end loop;
end $$;

-- ───────────────────────────── Funções internas ─────────────────────────────

create or replace function vigia.claims() returns jsonb language sql stable as $$
  select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb
$$;
create or replace function vigia.servico() returns boolean language sql stable as $$
  select vigia.claims() ->> 'role' = 'service_role'
$$;
create or replace function vigia.aal2() returns boolean language sql stable as $$
  select coalesce(vigia.claims() ->> 'aal', '') = 'aal2'
$$;
create or replace function vigia.erro(codigo text) returns void language plpgsql as $$
begin
  raise exception '%', codigo using errcode = 'P0001';
end $$;

/** Esta conta cadastrou e confirmou um aplicativo autenticador? */
create or replace function vigia.tem_fator() returns boolean language plpgsql stable security definer set search_path = vigia, pg_temp as $$
declare v boolean := false;
begin
  if auth.uid() is null or to_regclass('auth.mfa_factors') is null then return false; end if;
  execute 'select exists (select 1 from auth.mfa_factors m where m.user_id = $1 and m.status = ''verified'')' into v using auth.uid();
  return coalesce(v, false);
end $$;

/** Quem chama, exigindo conta ativa. */
create or replace function vigia.eu() returns uuid language plpgsql stable security definer set search_path = vigia, pg_temp as $$
declare v uuid := auth.uid();
begin
  if v is null then perform vigia.erro('entre_primeiro'); end if;
  if not exists (select 1 from perfis where id = v and ativo) then perform vigia.erro('sem_permissao'); end if;
  return v;
end $$;

/**
 * Quem chama, exigindo conta ativa E sessão confirmada pelo segundo fator. É a porta de todas as telas: senha roubada,
 * sozinha, não abre nada. (Quem ainda não cadastrou o aplicativo é levado a cadastrar pelo app, via public.eu().)
 */
create or replace function vigia.eu2() returns uuid language plpgsql stable security definer set search_path = vigia, pg_temp as $$
declare v uuid := vigia.eu();
begin
  if not vigia.aal2() then perform vigia.erro('confirme_segundo_fator'); end if;
  return v;
end $$;

create or replace function vigia.papel() returns text language sql stable security definer set search_path = vigia, pg_temp as $$
  select coalesce((select papel from perfis where id = auth.uid() and ativo), '')
$$;
create or replace function vigia.dono() returns boolean language sql stable as $$ select vigia.aal2() and vigia.papel() = 'dono' $$;
create or replace function vigia.analista() returns boolean language sql stable as $$ select vigia.aal2() and vigia.papel() in ('dono', 'analista') $$;

/** Anota na auditoria. Só vale para o que deu certo: se a função falhar depois, a anotação some junto. */
create or replace function vigia.registrar(p_acao text, p_alvo text default '', p_detalhes jsonb default '{}'::jsonb) returns void
language plpgsql security definer set search_path = vigia, pg_temp as $$
begin
  insert into auditoria (quem, nome, acao, alvo, detalhes)
  values (auth.uid(), coalesce((select nome from perfis where id = auth.uid()), case when vigia.servico() then 'coletor' else '' end), left(p_acao, 60), left(coalesce(p_alvo, ''), 300), coalesce(p_detalhes, '{}'::jsonb));
end $$;

/** A auditoria só cresce: nenhuma linha é editada ou apagada antes de 400 dias. Vale até para o dono do banco. */
create or replace function vigia.auditoria_trava() returns trigger language plpgsql as $$
begin
  if tg_op = 'DELETE' and old.criado_em < now() - interval '400 days' then return old; end if;
  raise exception 'auditoria_imutavel' using errcode = 'P0001';
end $$;
drop trigger if exists vigia_auditoria_trava on vigia.auditoria;
create trigger vigia_auditoria_trava before update or delete on vigia.auditoria for each row execute function vigia.auditoria_trava();
drop trigger if exists vigia_auditoria_trava_tudo on vigia.auditoria;
create trigger vigia_auditoria_trava_tudo before truncate on vigia.auditoria for each statement execute function vigia.auditoria_trava();

/** A origem de rede de quem chama, embaralhada (nunca o endereço em si). */
create or replace function vigia.origem() returns text language sql stable as $$
  select encode(sha256(convert_to('sentinela:' || coalesce(
    nullif(nullif(current_setting('request.headers', true), '')::json ->> 'cf-connecting-ip', ''),
    split_part(nullif(current_setting('request.headers', true), '')::json ->> 'x-forwarded-for', ',', 1),
    'local'), 'UTF8')), 'hex')
$$;

create or replace function vigia.limite(p_acao text, p_maximo integer, p_minutos integer) returns void
language plpgsql security definer set search_path = vigia, pg_temp as $$
declare
  v_chave text := p_acao || ':' || coalesce(auth.uid()::text, vigia.origem());
  v_janela timestamptz := to_timestamp(floor(extract(epoch from now()) / (p_minutos * 60)) * p_minutos * 60);
  v_total integer;
begin
  insert into limites (chave, janela, total) values (v_chave, v_janela, 1)
  on conflict (chave, janela) do update set total = limites.total + 1
  returning total into v_total;
  if random() < 0.02 then delete from limites where janela < now() - interval '2 days'; end if;
  if v_total > p_maximo then perform vigia.erro('muitos_pedidos'); end if;
end $$;

create or replace function vigia.txt(p_valor text, p_campo text, p_min integer, p_max integer) returns text language plpgsql immutable as $$
declare v text := btrim(regexp_replace(coalesce(p_valor, ''), '[\u0001-\u0008\u000B\u000C\u000E-\u001F]', '', 'g'));
begin
  if char_length(v) < p_min or char_length(v) > p_max then raise exception 'invalido:%', p_campo using errcode = 'P0001'; end if;
  return v;
end $$;

create or replace function vigia.selo(p text) returns text language sql immutable as $$
  select encode(sha256(convert_to(coalesce(p, ''), 'UTF8')), 'hex')
$$;

/** Põe um e-mail na fila. O mesmo endereço recebe no máximo p_max e-mails do mesmo tipo por dia. */
create or replace function vigia.email(p_para text, p_tipo text, p_assunto text, p_texto text, p_max integer default 20)
returns boolean language plpgsql security definer set search_path = vigia, pg_temp as $$
declare v_para text := lower(btrim(coalesce(p_para, '')));
begin
  if v_para !~ '^[^@[:space:]]+@[^@[:space:]]+[.][^@[:space:]]+$' or char_length(v_para) > 200 then return false; end if;
  if (select count(*) from emails where para = v_para and tipo = p_tipo and criado_em > now() - interval '1 day') >= coalesce(p_max, 20) then return false; end if;
  insert into emails (para, tipo, assunto, texto) values (v_para, p_tipo, left(p_assunto, 200), left(coalesce(p_texto, ''), 19000) || E'\n\n— Sentinela Lúcia');
  return true;
end $$;

create or replace function vigia.email_da_conta(p_usuario uuid) returns text language sql stable security definer set search_path = vigia, pg_temp as $$
  select email from auth.users where id = p_usuario
$$;

create or replace function vigia.fator_de(p_usuario uuid) returns boolean language plpgsql stable security definer set search_path = vigia, pg_temp as $$
declare v boolean := false;
begin
  if to_regclass('auth.mfa_factors') is null then return false; end if;
  execute 'select exists (select 1 from auth.mfa_factors m where m.user_id = $1 and m.status = ''verified'')' into v using p_usuario;
  return coalesce(v, false);
end $$;
create or replace function vigia.perfil_json(f vigia.perfis) returns jsonb language sql stable security definer set search_path = vigia, pg_temp as $$
  select jsonb_build_object('id', f.id, 'nome', f.nome, 'papel', f.papel, 'ativo', f.ativo, 'criado_em', f.criado_em, 'visto_em', f.visto_em,
    'email', case when vigia.dono() or f.id = auth.uid() then vigia.email_da_conta(f.id) else '' end,
    'segundo_fator', case when to_regclass('auth.mfa_factors') is null then null else vigia.fator_de(f.id) end)
$$;

-- ───────────────────────────── Conta nova ─────────────────────────────

/**
 * Enquanto não existe dono, a primeira conta entra sem convite e sem papel (o dono é promovido pelo SQL Editor).
 * Depois disso, conta nova só com código de convite válido, e o e-mail precisa ser o do convite.
 */
create or replace function public.sentinela_conta_nova() returns trigger language plpgsql security definer set search_path = vigia, pg_temp as $$
declare v_codigo text := coalesce(new.raw_user_meta_data ->> 'convite', ''); c convites;
begin
  if not exists (select 1 from perfis where papel = 'dono' and ativo) then
    insert into perfis (id, nome, papel, ativo) values (new.id, '', 'leitor', false) on conflict do nothing;
    return new;
  end if;
  if v_codigo = '' then raise exception 'convite_obrigatorio' using errcode = 'P0001'; end if;
  select * into c from convites where selo = vigia.selo(v_codigo) for update;
  if not found or c.revogado or c.expira_em < now() or c.usado_em is not null then raise exception 'convite_invalido' using errcode = 'P0001'; end if;
  if lower(coalesce(new.email, '')) <> c.email then raise exception 'convite_de_outro_email' using errcode = 'P0001'; end if;
  if (select count(*) from perfis where ativo) >= 5 then raise exception 'limite_contas' using errcode = 'P0001'; end if;
  update convites set usado_em = now(), usado_por = new.id where id = c.id;
  insert into perfis (id, nome, papel, ativo) values (new.id, '', c.papel, true) on conflict do nothing;
  insert into auditoria (quem, nome, acao, alvo, detalhes) values (new.id, '', 'convite_aceito', c.id::text, jsonb_build_object('papel', c.papel));
  begin
    update auth.users set raw_user_meta_data = coalesce(raw_user_meta_data, '{}'::jsonb) - 'convite' where id = new.id;
  exception when others then null;
  end;
  return new;
end $$;
drop trigger if exists sentinela_conta_nova on auth.users;
create trigger sentinela_conta_nova after insert on auth.users for each row execute function public.sentinela_conta_nova();

/** Só pelo SQL Editor (nem anon nem conta logada): torna uma conta o dono do painel. */
create or replace function public.promover_dono(p_email text) returns text language plpgsql security definer set search_path = vigia, pg_temp as $$
declare v uuid;
begin
  if auth.uid() is not null or (vigia.claims() ->> 'role') in ('anon', 'authenticated') then raise exception 'sem_permissao' using errcode = 'P0001'; end if;
  select id into v from auth.users where lower(email) = lower(btrim(p_email));
  if v is null then return 'Não existe conta com esse e-mail. Crie a conta primeiro e rode de novo.'; end if;
  insert into perfis (id, nome, papel, ativo) values (v, 'Dono', 'dono', true)
  on conflict (id) do update set papel = 'dono', ativo = true;
  insert into auditoria (quem, nome, acao, alvo) values (null, 'banco', 'dono_promovido', v::text);
  return 'Pronto: ' || p_email || ' agora é dono do Sentinela.';
end $$;

-- ───────────────────────────── Conta, equipe e convites ─────────────────────────────

/** Quem está logado: perfil, papel e se a sessão já passou pelo segundo fator. Sem login, null. */
create or replace function public.eu() returns jsonb language plpgsql security definer set search_path = vigia, pg_temp as $$
declare v uuid := auth.uid(); f perfis;
begin
  if v is null then return null; end if;
  select * into f from perfis where id = v;
  if not found then return null; end if;
  if vigia.aal2() then update perfis set visto_em = now() where id = v and visto_em < now() - interval '1 minute'; end if;
  return vigia.perfil_json(f) || jsonb_build_object('segundo_fator_na_sessao', vigia.aal2(), 'tem_fator', vigia.tem_fator(), 'avisos', f.avisos,
    'alertas_abertos', case when f.ativo and vigia.aal2() then (select count(*) from alertas where estado = 'aberto') else 0 end);
end $$;

create or replace function public.perfil_salvar(p_nome text) returns jsonb language plpgsql security definer set search_path = vigia, pg_temp as $$
declare v uuid := vigia.eu2();
begin
  update perfis set nome = vigia.txt(p_nome, 'nome', 2, 80) where id = v;
  perform vigia.registrar('perfil_salvo');
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.avisos_configurar(p jsonb) returns jsonb language plpgsql security definer set search_path = vigia, pg_temp as $$
declare v uuid := vigia.eu2(); v_valor jsonb;
begin
  v_valor := jsonb_build_object('email', coalesce((p ->> 'email')::boolean, true), 'desktop', coalesce((p ->> 'desktop')::boolean, true),
    'minimo', case when p ->> 'minimo' in ('baixa', 'media', 'alta', 'critica') then p ->> 'minimo' else 'media' end);
  update perfis set avisos = v_valor where id = v;
  perform vigia.registrar('avisos_configurados', '', v_valor);
  return v_valor;
end $$;

/** A equipe inteira (todo mundo vê quem está no painel; só o dono vê os e-mails). */
create or replace function public.equipe_listar() returns jsonb language plpgsql security definer set search_path = vigia, pg_temp as $$
begin
  perform vigia.eu2();
  return (select coalesce(jsonb_agg(vigia.perfil_json(f) order by case f.papel when 'dono' then 0 when 'analista' then 1 else 2 end, f.nome), '[]'::jsonb) from perfis f);
end $$;

create or replace function public.papel_mudar(p_usuario uuid, p_papel text) returns jsonb language plpgsql security definer set search_path = vigia, pg_temp as $$
declare v uuid := vigia.eu2();
begin
  if not vigia.dono() then perform vigia.erro('sem_permissao'); end if;
  if p_papel not in ('dono', 'analista', 'leitor') then perform vigia.erro('invalido:papel'); end if;
  if p_usuario = v and p_papel <> 'dono' and (select count(*) from perfis where papel = 'dono' and ativo) <= 1 then perform vigia.erro('ultimo_dono'); end if;
  update perfis set papel = p_papel where id = p_usuario and ativo;
  if not found then perform vigia.erro('nao_encontrado'); end if;
  perform vigia.registrar('papel_mudado', p_usuario::text, jsonb_build_object('papel', p_papel));
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.conta_ativar(p_usuario uuid, p_ativa boolean) returns jsonb language plpgsql security definer set search_path = vigia, pg_temp as $$
declare v uuid := vigia.eu2();
begin
  if not vigia.dono() then perform vigia.erro('sem_permissao'); end if;
  if p_usuario = v then perform vigia.erro('nao_a_si_mesmo'); end if;
  if p_ativa and (select count(*) from perfis where ativo) >= 5 then perform vigia.erro('limite_contas'); end if;
  update perfis set ativo = p_ativa where id = p_usuario;
  if not found then perform vigia.erro('nao_encontrado'); end if;
  perform vigia.registrar(case when p_ativa then 'conta_reativada' else 'conta_desativada' end, p_usuario::text);
  return jsonb_build_object('ok', true);
end $$;

/** O dono convida por e-mail. O código aparece uma vez e vai no e-mail; aqui fica só o selo. */
create or replace function public.convite_criar(p_email text, p_papel text) returns jsonb language plpgsql security definer set search_path = vigia, pg_temp as $$
declare
  v uuid := vigia.eu2();
  v_email text := lower(btrim(coalesce(p_email, '')));
  v_codigo text := replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '');
  v_id uuid;
  v_site text := coalesce((select valor ->> 'app_url' from configuracoes where chave = 'site'), '');
begin
  if not vigia.dono() then perform vigia.erro('sem_permissao'); end if;
  if v_email !~ '^[^@[:space:]]+@[^@[:space:]]+[.][^@[:space:]]+$' then perform vigia.erro('invalido:email'); end if;
  if p_papel not in ('dono', 'analista', 'leitor') then perform vigia.erro('invalido:papel'); end if;
  if (select count(*) from perfis where ativo) + (select count(*) from convites where usado_em is null and not revogado and expira_em > now()) >= 5 then perform vigia.erro('limite_contas'); end if;
  perform vigia.limite('convite_criar', 10, 60);
  update convites set revogado = true where email = v_email and usado_em is null and not revogado;
  insert into convites (selo, email, papel, criado_por) values (vigia.selo(v_codigo), v_email, p_papel, v) returning id into v_id;
  perform vigia.email(v_email, 'convite', 'Convite para o Sentinela Lúcia',
    'Você foi convidado(a) para o painel de monitoramento de segurança do Instituto Lúcia, como ' || p_papel || E'.\n\n'
    || 'Abra o aplicativo Sentinela Lúcia, escolha "Criar conta com convite" e cole este código:' || E'\n\n    ' || v_codigo || E'\n\n'
    || case when v_site <> '' then 'Ou abra: ' || v_site || '/entrar?convite=' || v_codigo || E'\n\n' else '' end
    || 'O convite vale por sete dias e só para este e-mail. Depois de entrar, cadastre o aplicativo autenticador: o painel exige o segundo fator.');
  perform vigia.registrar('convite_criado', v_id::text, jsonb_build_object('papel', p_papel));
  return jsonb_build_object('id', v_id, 'codigo', v_codigo, 'expira_em', now() + interval '7 days');
end $$;

create or replace function public.convites_listar() returns jsonb language plpgsql security definer set search_path = vigia, pg_temp as $$
begin
  perform vigia.eu2();
  if not vigia.dono() then perform vigia.erro('sem_permissao'); end if;
  return (select coalesce(jsonb_agg(jsonb_build_object('id', c.id, 'email', c.email, 'papel', c.papel, 'criado_em', c.criado_em, 'expira_em', c.expira_em,
    'usado', c.usado_em is not null, 'revogado', c.revogado, 'vale', c.usado_em is null and not c.revogado and c.expira_em > now()) order by c.criado_em desc), '[]'::jsonb)
    from (select * from convites order by criado_em desc limit 50) c);
end $$;

create or replace function public.convite_revogar(p_id uuid) returns jsonb language plpgsql security definer set search_path = vigia, pg_temp as $$
begin
  perform vigia.eu2();
  if not vigia.dono() then perform vigia.erro('sem_permissao'); end if;
  update convites set revogado = true where id = p_id and usado_em is null;
  if not found then perform vigia.erro('nao_encontrado'); end if;
  perform vigia.registrar('convite_revogado', p_id::text);
  return jsonb_build_object('ok', true);
end $$;

/** Quem recebeu o código confere se ele vale antes de criar a conta (sem login). */
create or replace function public.convite_ver(p_codigo text) returns jsonb language plpgsql security definer set search_path = vigia, pg_temp as $$
declare c convites;
begin
  perform vigia.limite('convite_ver', 30, 60);
  select * into c from convites where selo = vigia.selo(btrim(coalesce(p_codigo, '')));
  if not found or c.revogado or c.expira_em < now() or c.usado_em is not null then return jsonb_build_object('valido', false); end if;
  return jsonb_build_object('valido', true, 'email', c.email, 'papel', c.papel);
end $$;

/** Registro de atividades: quem viu e fez o quê. Só o dono. */
create or replace function public.auditoria_listar(p_pagina integer default 0, p_acao text default null) returns jsonb language plpgsql security definer set search_path = vigia, pg_temp as $$
begin
  perform vigia.eu2();
  if not vigia.dono() then perform vigia.erro('sem_permissao'); end if;
  perform vigia.registrar('viu:auditoria');
  return (select coalesce(jsonb_agg(jsonb_build_object('id', a.id, 'quem', a.quem, 'nome', a.nome, 'acao', a.acao, 'alvo', a.alvo, 'detalhes', a.detalhes, 'criado_em', a.criado_em) order by a.id desc), '[]'::jsonb)
    from (select * from auditoria where coalesce(p_acao, '') = '' or acao like p_acao || '%' order by id desc limit 100 offset greatest(coalesce(p_pagina, 0), 0) * 100) a);
end $$;

/** O app anota que alguém abriu uma tela sensível. */
create or replace function public.tela_vista(p_tela text) returns jsonb language plpgsql security definer set search_path = vigia, pg_temp as $$
begin
  perform vigia.eu2();
  if coalesce(p_tela, '') !~ '^[a-z_]{3,40}$' then perform vigia.erro('invalido:tela'); end if;
  perform vigia.limite('tela_vista', 600, 60);
  perform vigia.registrar('viu:' || p_tela);
  return jsonb_build_object('ok', true);
end $$;

-- ───────────────────────────── Configuração e regras ─────────────────────────────

create or replace function public.configuracoes_ver() returns jsonb language plpgsql security definer set search_path = vigia, pg_temp as $$
begin
  perform vigia.eu2();
  return (select coalesce(jsonb_object_agg(chave, valor), '{}'::jsonb) from configuracoes);
end $$;

/** O dono ajusta o que o coletor vigia. Nada secreto cabe aqui: tokens ficam nos segredos do Worker. */
create or replace function public.configuracoes_salvar(p_chave text, p jsonb) returns jsonb language plpgsql security definer set search_path = vigia, pg_temp as $$
begin
  perform vigia.eu2();
  if not vigia.dono() then perform vigia.erro('sem_permissao'); end if;
  if p_chave not in ('site', 'plataformas', 'retencao') then perform vigia.erro('invalido:chave'); end if;
  if jsonb_typeof(p) <> 'object' or char_length(p::text) > 8000 then perform vigia.erro('invalido:valor'); end if;
  if exists (select 1 from jsonb_each_text(p) e where e.value ~* '(token|secret|chave|key|bearer)[^a-z]' or e.key ~* 'token|secret|senha|password|key$') then perform vigia.erro('segredo_nao_cabe_aqui'); end if;
  insert into configuracoes (chave, valor) values (p_chave, p) on conflict (chave) do update set valor = excluded.valor;
  perform vigia.registrar('configuracao_salva', p_chave, p);
  return p;
end $$;

create or replace function public.regras_listar() returns jsonb language plpgsql security definer set search_path = vigia, pg_temp as $$
begin
  perform vigia.eu2();
  return (select coalesce(jsonb_agg(to_jsonb(r) order by r.id), '[]'::jsonb) from regras r);
end $$;

create or replace function public.regra_salvar(p_id text, p_ligada boolean, p_gravidade text default null, p_parametros jsonb default null) returns jsonb language plpgsql security definer set search_path = vigia, pg_temp as $$
begin
  perform vigia.eu2();
  if not vigia.dono() then perform vigia.erro('sem_permissao'); end if;
  if p_gravidade is not null and p_gravidade not in ('baixa', 'media', 'alta', 'critica') then perform vigia.erro('invalido:gravidade'); end if;
  if p_parametros is not null and (jsonb_typeof(p_parametros) <> 'object' or char_length(p_parametros::text) > 2000) then perform vigia.erro('invalido:parametros'); end if;
  update regras set ligada = coalesce(p_ligada, ligada), gravidade = coalesce(p_gravidade, gravidade), parametros = coalesce(p_parametros, parametros) where id = p_id;
  if not found then perform vigia.erro('nao_encontrado'); end if;
  perform vigia.registrar('regra_salva', p_id, jsonb_build_object('ligada', p_ligada, 'gravidade', p_gravidade, 'parametros', p_parametros));
  return (select to_jsonb(r) from regras r where id = p_id);
end $$;

-- ───────────────────────────── Leitura: visão geral, ameaças, integridade, plataforma ─────────────────────────────

/** Os números da primeira tela. */
create or replace function public.resumo(p_horas integer default 24) returns jsonb language plpgsql security definer set search_path = vigia, pg_temp as $$
declare v_desde timestamptz := now() - make_interval(hours => greatest(1, least(coalesce(p_horas, 24), 24 * 30)));
begin
  perform vigia.eu2();
  return jsonb_build_object(
    'agora', now(),
    'ultima_coleta', (select max(em) from verificacoes),
    'site', (select jsonb_build_object('no_ar', v.no_ar, 'status', v.status, 'ms', v.ms, 'em', v.em, 'nota', v.nota) from verificacoes v where v.alvo = 'site' order by em desc limit 1),
    'disponibilidade', (select round(100.0 * count(*) filter (where no_ar) / greatest(count(*), 1), 2) from verificacoes where alvo = 'site' and em > v_desde),
    'ms_mediana', (select percentile_cont(0.5) within group (order by ms) from verificacoes where alvo = 'site' and no_ar and em > v_desde),
    'tempos', (select coalesce(jsonb_agg(jsonb_build_object('em', em, 'ms', ms, 'no_ar', no_ar) order by em), '[]'::jsonb) from (select em, ms, no_ar from verificacoes where alvo = 'site' and em > v_desde order by em desc limit 600) x),
    'trafego', (select coalesce(jsonb_agg(jsonb_build_object('em', em, 'requisicoes', requisicoes, 'bloqueios', bloqueios, 'desafios', desafios) order by em), '[]'::jsonb) from (select * from metricas where em > v_desde order by em desc limit 600) x),
    'totais', (select jsonb_build_object('requisicoes', coalesce(sum(requisicoes), 0), 'bloqueios', coalesce(sum(bloqueios), 0), 'desafios', coalesce(sum(desafios), 0)) from metricas where em > v_desde),
    'postura', (select jsonb_build_object('nota', nota, 'componentes', componentes, 'em', em) from postura order by em desc limit 1),
    'postura_historico', (select coalesce(jsonb_agg(jsonb_build_object('em', em, 'nota', nota) order by em), '[]'::jsonb) from (select * from postura where em > now() - interval '30 days' order by em desc limit 400) x),
    'alertas_abertos', (select count(*) from alertas where estado = 'aberto'),
    'alertas_recentes', (select coalesce(jsonb_agg(to_jsonb(a) order by a.em desc), '[]'::jsonb) from (select id, em, regra, gravidade, titulo, estado from alertas order by em desc limit 8) a),
    'incidentes_abertos', (select count(*) from incidentes where estado <> 'resolvido'),
    'eventos_por_fonte', (select coalesce(jsonb_object_agg(fonte, n), '{}'::jsonb) from (select fonte, count(*) as n from eventos where em > v_desde group by fonte) x),
    'supabase', (select jsonb_build_object('no_ar', v.no_ar, 'ms', v.ms, 'em', v.em) from verificacoes v where v.alvo = 'supabase' order by em desc limit 1),
    'ultimo_deploy', (select to_jsonb(d) from deploys d order by criado_em desc limit 1));
end $$;

/** Eventos de segurança, com filtros. Quem lê fica anotado. */
create or replace function public.eventos_listar(p jsonb default '{}'::jsonb) returns jsonb language plpgsql security definer set search_path = vigia, pg_temp as $$
declare
  v_fonte text := nullif(p ->> 'fonte', '');
  v_grav text := nullif(p ->> 'gravidade', '');
  v_ip text := nullif(p ->> 'ip', '');
  v_busca text := nullif(btrim(coalesce(p ->> 'busca', '')), '');
  v_horas integer := greatest(1, least(coalesce((p ->> 'horas')::integer, 24), 24 * 90));
  v_pagina integer := greatest(coalesce((p ->> 'pagina')::integer, 0), 0);
begin
  perform vigia.eu2();
  perform vigia.limite('eventos_listar', 600, 60);
  return (select coalesce(jsonb_agg(to_jsonb(e) order by e.em desc), '[]'::jsonb) from (
    select id, em, fonte, tipo, gravidade, ip, pais, asn, asn_nome, caminho, agente, acao, regra, detalhes from eventos
    where em > now() - make_interval(hours => v_horas)
      and (v_fonte is null or fonte = v_fonte) and (v_grav is null or gravidade = v_grav) and (v_ip is null or ip = v_ip)
      and (v_busca is null or caminho ilike '%' || v_busca || '%' or ip = v_busca or asn_nome ilike '%' || v_busca || '%' or pais ilike v_busca or tipo ilike '%' || v_busca || '%')
    order by em desc limit 200 offset v_pagina * 200) e);
end $$;

/** As origens mais insistentes no período, para decidir bloqueio e documentar. */
create or replace function public.ameacas_resumo(p_horas integer default 24) returns jsonb language plpgsql security definer set search_path = vigia, pg_temp as $$
declare v_desde timestamptz := now() - make_interval(hours => greatest(1, least(coalesce(p_horas, 24), 24 * 90)));
begin
  perform vigia.eu2();
  perform vigia.registrar('viu:ameacas', '', jsonb_build_object('horas', p_horas));
  return jsonb_build_object(
    'ips', (select coalesce(jsonb_agg(x order by x.total desc), '[]'::jsonb) from (
      select ip, pais, max(asn) as asn, max(asn_nome) as asn_nome, count(*) as total, count(*) filter (where acao in ('block', 'managed_challenge', 'challenge', 'js_challenge')) as bloqueios,
             min(em) as primeiro, max(em) as ultimo, (select coalesce(max((d.detalhes ->> 'abuso')::integer), -1) from eventos d where d.fonte = 'reputacao' and d.ip = e.ip) as abuso
      from eventos e where em > v_desde and ip <> '' and fonte in ('waf', 'auth', 'isca') group by ip, pais order by total desc limit 50) x),
    'paises', (select coalesce(jsonb_agg(x order by x.total desc), '[]'::jsonb) from (select pais, count(*) as total from eventos where em > v_desde and fonte = 'waf' and pais <> '' group by pais order by total desc limit 20) x),
    'caminhos', (select coalesce(jsonb_agg(x order by x.total desc), '[]'::jsonb) from (select caminho, count(*) as total from eventos where em > v_desde and fonte in ('waf', 'isca') and caminho <> '' group by caminho order by total desc limit 30) x),
    'regras', (select coalesce(jsonb_agg(x order by x.total desc), '[]'::jsonb) from (select regra, acao, count(*) as total from eventos where em > v_desde and fonte = 'waf' group by regra, acao order by total desc limit 20) x),
    'logins_falhos', (select coalesce(jsonb_agg(jsonb_build_object('em', em, 'total', total) order by em), '[]'::jsonb) from (select date_trunc('hour', em) as em, count(*) as total from eventos where em > v_desde and fonte = 'auth' group by 1) x),
    'por_hora', (select coalesce(jsonb_agg(jsonb_build_object('em', em, 'waf', waf, 'isca', isca, 'auth', auth) order by em), '[]'::jsonb) from (
      select date_trunc('hour', em) as em, count(*) filter (where fonte = 'waf') as waf, count(*) filter (where fonte = 'isca') as isca, count(*) filter (where fonte = 'auth') as auth
      from eventos where em > v_desde group by 1) x));
end $$;

create or replace function public.integridade_ver() returns jsonb language plpgsql security definer set search_path = vigia, pg_temp as $$
begin
  perform vigia.eu2();
  return jsonb_build_object(
    'paginas', (select coalesce(jsonb_agg(x order by x.alvo), '[]'::jsonb) from (
      select v.alvo, v.hash, v.em, v.status, v.ms, (select count(distinct hash) from verificacoes h where h.alvo = v.alvo and h.em > now() - interval '7 days' and h.hash is not null) as versoes_7d,
             (select max(em) from verificacoes h where h.alvo = v.alvo and h.hash is distinct from v.hash and h.hash is not null) as mudou_em
      from verificacoes v where v.id in (select max(id) from verificacoes where alvo like 'pagina:%' or alvo = 'site' group by alvo)) x),
    'mudancas', (select coalesce(jsonb_agg(to_jsonb(e) order by e.em desc), '[]'::jsonb) from (select id, em, tipo, caminho, detalhes from eventos where fonte = 'pagina' order by em desc limit 30) e),
    'dns', (select coalesce(jsonb_agg(jsonb_build_object('nome', nome, 'tipo', tipo, 'valores', valores, 'em', em) order by nome, tipo), '[]'::jsonb) from dns where atual),
    'dns_mudancas', (select coalesce(jsonb_agg(to_jsonb(e) order by e.em desc), '[]'::jsonb) from (select id, em, tipo, detalhes from eventos where fonte = 'dns' order by em desc limit 30) e),
    'certificados', (select coalesce(jsonb_agg(to_jsonb(c) order by c.nao_depois desc nulls last), '[]'::jsonb) from (select * from certificados order by visto_em desc limit 60) c),
    'terceiros', (select coalesce(jsonb_agg(to_jsonb(t) order by t.permitido, t.visto_em desc), '[]'::jsonb) from terceiros t),
    'dominios', (select coalesce(jsonb_agg(to_jsonb(d) order by d.resolve desc, d.dominio), '[]'::jsonb) from dominios_parecidos d),
    'cabecalhos', (select cabecalhos from verificacoes where alvo = 'site' and no_ar order by em desc limit 1),
    'nota', (select nota from verificacoes where alvo = 'site' and no_ar order by em desc limit 1));
end $$;

create or replace function public.plataforma_ver() returns jsonb language plpgsql security definer set search_path = vigia, pg_temp as $$
begin
  perform vigia.eu2();
  return jsonb_build_object(
    'deploys', (select coalesce(jsonb_agg(to_jsonb(d) order by d.criado_em desc), '[]'::jsonb) from (select * from deploys order by criado_em desc limit 30) d),
    'github', (select coalesce(jsonb_agg(to_jsonb(g) order by g.estado, g.criado_em desc), '[]'::jsonb) from (select * from github_alertas order by criado_em desc limit 100) g),
    'supabase', (select coalesce(jsonb_agg(jsonb_build_object('alvo', alvo, 'no_ar', no_ar, 'ms', ms, 'em', em, 'status', status, 'erro', erro) order by alvo), '[]'::jsonb)
                 from verificacoes v where v.id in (select max(id) from verificacoes where alvo like 'supabase%' group by alvo)),
    'supabase_historico', (select coalesce(jsonb_agg(jsonb_build_object('em', em, 'ms', ms, 'no_ar', no_ar) order by em), '[]'::jsonb) from (select em, ms, no_ar from verificacoes where alvo = 'supabase' and em > now() - interval '24 hours' order by em desc limit 300) x),
    'csp', (select coalesce(jsonb_agg(to_jsonb(c) order by c.ultimo_em desc), '[]'::jsonb) from (select * from csp_violacoes order by ultimo_em desc limit 50) c),
    'emails', (select jsonb_build_object('pendentes', count(*) filter (where status = 'pendente'), 'falhos', count(*) filter (where status = 'falhou'), 'enviados_7d', count(*) filter (where status = 'enviado' and enviado_em > now() - interval '7 days')) from emails));
end $$;

-- ───────────────────────────── Alertas ─────────────────────────────

create or replace function public.alertas_listar(p_estado text default null, p_pagina integer default 0) returns jsonb language plpgsql security definer set search_path = vigia, pg_temp as $$
begin
  perform vigia.eu2();
  return (select coalesce(jsonb_agg(to_jsonb(a) order by a.em desc), '[]'::jsonb) from (
    select a.*, (select nome from perfis where id = a.visto_por) as visto_nome, (select numero from incidentes where id = a.incidente) as incidente_numero
    from alertas a where coalesce(p_estado, '') = '' or a.estado = p_estado or (p_estado = 'ativos' and a.estado in ('aberto', 'visto'))
    order by a.em desc limit 100 offset greatest(coalesce(p_pagina, 0), 0) * 100) a);
end $$;

/** Marcar como visto, silenciar por algumas horas ou resolver. Só analistas e dono. */
create or replace function public.alerta_marcar(p_id bigint, p_estado text, p_horas integer default null) returns jsonb language plpgsql security definer set search_path = vigia, pg_temp as $$
declare v uuid := vigia.eu2();
begin
  if not vigia.analista() then perform vigia.erro('sem_permissao'); end if;
  if p_estado not in ('visto', 'silenciado', 'resolvido', 'aberto') then perform vigia.erro('invalido:estado'); end if;
  update alertas set estado = p_estado, visto_por = v, visto_em = now(),
    silenciado_ate = case when p_estado = 'silenciado' then now() + make_interval(hours => greatest(1, least(coalesce(p_horas, 24), 24 * 30))) else null end
  where id = p_id;
  if not found then perform vigia.erro('nao_encontrado'); end if;
  perform vigia.registrar('alerta_' || p_estado, p_id::text, jsonb_build_object('horas', p_horas));
  return jsonb_build_object('ok', true);
end $$;

-- ───────────────────────────── Incidentes e ações ─────────────────────────────

create or replace function vigia.incidente_json(i vigia.incidentes) returns jsonb language sql stable security definer set search_path = vigia, pg_temp as $$
  select to_jsonb(i) || jsonb_build_object(
    'aberto_nome', (select nome from perfis where id = i.aberto_por),
    'atribuido_nome', (select nome from perfis where id = i.atribuido_a),
    'alertas', (select count(*) from alertas where incidente = i.id),
    'eventos', (select count(*) from incidente_eventos where incidente = i.id),
    'acoes', (select count(*) from acoes where incidente = i.id))
$$;

create or replace function public.incidentes_listar(p_estado text default null) returns jsonb language plpgsql security definer set search_path = vigia, pg_temp as $$
begin
  perform vigia.eu2();
  return (select coalesce(jsonb_agg(vigia.incidente_json(i) order by case i.estado when 'resolvido' then 1 else 0 end, i.atualizado_em desc), '[]'::jsonb)
    from (select * from incidentes where coalesce(p_estado, '') = '' or estado = p_estado or (p_estado = 'ativos' and estado <> 'resolvido') order by atualizado_em desc limit 200) i);
end $$;

create or replace function public.incidente_ver(p_id uuid) returns jsonb language plpgsql security definer set search_path = vigia, pg_temp as $$
declare i incidentes;
begin
  perform vigia.eu2();
  select * into i from incidentes where id = p_id;
  if not found then perform vigia.erro('nao_encontrado'); end if;
  perform vigia.registrar('viu:incidente', p_id::text);
  return vigia.incidente_json(i) || jsonb_build_object(
    'notas', (select coalesce(jsonb_agg(jsonb_build_object('id', n.id, 'texto', n.texto, 'tipo', n.tipo, 'em', n.em, 'autor', n.autor, 'nome', (select nome from perfis where id = n.autor)) order by n.em), '[]'::jsonb) from incidente_notas n where n.incidente = p_id),
    'alertas_lista', (select coalesce(jsonb_agg(to_jsonb(a) order by a.em desc), '[]'::jsonb) from (select id, em, regra, gravidade, titulo, estado from alertas where incidente = p_id) a),
    'eventos_lista', (select coalesce(jsonb_agg(to_jsonb(e) order by e.em desc), '[]'::jsonb) from (select e.id, e.em, e.fonte, e.tipo, e.gravidade, e.ip, e.pais, e.asn_nome, e.caminho, e.acao from incidente_eventos x join eventos e on e.id = x.evento where x.incidente = p_id order by e.em desc limit 200) e),
    'acoes_lista', (select coalesce(jsonb_agg(vigia.acao_json(a) order by a.proposta_em desc), '[]'::jsonb) from acoes a where a.incidente = p_id));
end $$;

create or replace function public.incidente_abrir(p jsonb) returns jsonb language plpgsql security definer set search_path = vigia, pg_temp as $$
declare v uuid := vigia.eu2(); v_id uuid; v_alerta bigint;
begin
  if not vigia.analista() then perform vigia.erro('sem_permissao'); end if;
  perform vigia.limite('incidente_abrir', 30, 60);
  insert into incidentes (titulo, resumo, gravidade, modelo, aberto_por, atribuido_a)
  values (vigia.txt(p ->> 'titulo', 'titulo', 3, 160), vigia.txt(p ->> 'resumo', 'resumo', 0, 4000),
    case when p ->> 'gravidade' in ('baixa', 'media', 'alta', 'critica') then p ->> 'gravidade' else 'media' end,
    case when p ->> 'modelo' in ('ddos', 'credenciais', 'defacement', 'certificado', 'deploy', 'dns', 'outro') then p ->> 'modelo' else '' end,
    v, nullif(p ->> 'atribuido_a', '')::uuid)
  returning id into v_id;
  insert into incidente_notas (incidente, autor, texto, tipo) values (v_id, v, 'Incidente aberto.', 'sistema');
  v_alerta := nullif(p ->> 'alerta', '')::bigint;
  if v_alerta is not null then update alertas set incidente = v_id, estado = case when estado = 'aberto' then 'visto' else estado end, visto_por = v, visto_em = now() where id = v_alerta; end if;
  perform vigia.registrar('incidente_aberto', v_id::text, jsonb_build_object('gravidade', p ->> 'gravidade', 'alerta', v_alerta));
  return jsonb_build_object('id', v_id);
end $$;

create or replace function public.incidente_atualizar(p_id uuid, p jsonb) returns jsonb language plpgsql security definer set search_path = vigia, pg_temp as $$
declare v uuid := vigia.eu2(); i incidentes; v_estado text; v_atrib uuid;
begin
  if not vigia.analista() then perform vigia.erro('sem_permissao'); end if;
  select * into i from incidentes where id = p_id for update;
  if not found then perform vigia.erro('nao_encontrado'); end if;
  v_estado := coalesce(nullif(p ->> 'estado', ''), i.estado);
  if v_estado not in ('aberto', 'investigando', 'contido', 'resolvido') then perform vigia.erro('invalido:estado'); end if;
  v_atrib := case when p ? 'atribuido_a' then nullif(p ->> 'atribuido_a', '')::uuid else i.atribuido_a end;
  update incidentes set
    titulo = case when p ? 'titulo' then vigia.txt(p ->> 'titulo', 'titulo', 3, 160) else titulo end,
    resumo = case when p ? 'resumo' then vigia.txt(p ->> 'resumo', 'resumo', 0, 4000) else resumo end,
    gravidade = case when p ->> 'gravidade' in ('baixa', 'media', 'alta', 'critica') then p ->> 'gravidade' else gravidade end,
    estado = v_estado, atribuido_a = v_atrib, atualizado_em = now(),
    resolvido_em = case when v_estado = 'resolvido' then coalesce(resolvido_em, now()) else null end
  where id = p_id;
  if v_estado <> i.estado then insert into incidente_notas (incidente, autor, texto, tipo) values (p_id, v, 'Estado: ' || i.estado || ' → ' || v_estado || '.', 'sistema'); end if;
  if v_atrib is distinct from i.atribuido_a then insert into incidente_notas (incidente, autor, texto, tipo) values (p_id, v, 'Atribuído a ' || coalesce((select nome from perfis where id = v_atrib), 'ninguém') || '.', 'sistema'); end if;
  if v_estado = 'resolvido' then update alertas set estado = 'resolvido' where incidente = p_id and estado <> 'resolvido'; end if;
  perform vigia.registrar('incidente_atualizado', p_id::text, p);
  return vigia.incidente_json((select x from incidentes x where id = p_id));
end $$;

create or replace function public.incidente_nota(p_id uuid, p_texto text) returns jsonb language plpgsql security definer set search_path = vigia, pg_temp as $$
declare v uuid := vigia.eu2();
begin
  if not vigia.analista() then perform vigia.erro('sem_permissao'); end if;
  if not exists (select 1 from incidentes where id = p_id) then perform vigia.erro('nao_encontrado'); end if;
  perform vigia.limite('incidente_nota', 120, 60);
  insert into incidente_notas (incidente, autor, texto) values (p_id, v, vigia.txt(p_texto, 'texto', 1, 4000));
  update incidentes set atualizado_em = now() where id = p_id;
  perform vigia.registrar('incidente_nota', p_id::text);
  return jsonb_build_object('ok', true);
end $$;

/** Liga eventos e alertas a um incidente. */
create or replace function public.incidente_vincular(p_id uuid, p_eventos bigint[] default '{}', p_alertas bigint[] default '{}') returns jsonb language plpgsql security definer set search_path = vigia, pg_temp as $$
declare v uuid := vigia.eu2();
begin
  if not vigia.analista() then perform vigia.erro('sem_permissao'); end if;
  if not exists (select 1 from incidentes where id = p_id) then perform vigia.erro('nao_encontrado'); end if;
  insert into incidente_eventos (incidente, evento) select p_id, e from unnest(coalesce(p_eventos, '{}')) e where exists (select 1 from eventos where id = e) on conflict do nothing;
  update alertas set incidente = p_id, visto_por = coalesce(visto_por, v), visto_em = coalesce(visto_em, now()), estado = case when estado = 'aberto' then 'visto' else estado end where id = any (coalesce(p_alertas, '{}'));
  update incidentes set atualizado_em = now() where id = p_id;
  perform vigia.registrar('incidente_vinculado', p_id::text, jsonb_build_object('eventos', coalesce(array_length(p_eventos, 1), 0), 'alertas', coalesce(array_length(p_alertas, 1), 0)));
  return jsonb_build_object('ok', true);
end $$;

create or replace function vigia.acao_json(a vigia.acoes) returns jsonb language sql stable security definer set search_path = vigia, pg_temp as $$
  select to_jsonb(a) || jsonb_build_object('proposta_nome', (select nome from perfis where id = a.proposta_por), 'confirmada_nome', (select nome from perfis where id = a.confirmada_por),
    'incidente_numero', (select numero from incidentes where id = a.incidente))
$$;

/** Um analista propõe bloquear (ou desafiar) uma origem na Cloudflare. Nada acontece até outra pessoa confirmar. */
create or replace function public.acao_propor(p jsonb) returns jsonb language plpgsql security definer set search_path = vigia, pg_temp as $$
declare v uuid := vigia.eu2(); v_tipo text := p ->> 'tipo'; v_alvo text := btrim(coalesce(p ->> 'alvo', '')); v_id uuid;
begin
  if not vigia.analista() then perform vigia.erro('sem_permissao'); end if;
  if v_tipo not in ('bloquear_ip', 'bloquear_asn', 'bloquear_pais', 'desafiar_ip', 'desbloquear') then perform vigia.erro('invalido:tipo'); end if;
  if v_tipo in ('bloquear_ip', 'desafiar_ip') and v_alvo !~ '^([0-9]{1,3}\.){3}[0-9]{1,3}(/(2[4-9]|3[0-2]))?$' and v_alvo !~ '^[0-9a-fA-F:]{3,45}(/(6[4-9]|[7-9][0-9]|1[01][0-9]|12[0-8]))?$' then perform vigia.erro('invalido:alvo'); end if;
  if v_tipo = 'bloquear_asn' and v_alvo !~ '^AS[0-9]{1,10}$' then perform vigia.erro('invalido:alvo'); end if;
  if v_tipo = 'bloquear_pais' and v_alvo !~ '^[A-Z]{2}$' then perform vigia.erro('invalido:alvo'); end if;
  if v_tipo = 'desbloquear' and (v_alvo !~ '^[0-9a-f-]{36}$' or not exists (select 1 from acoes where id = v_alvo::uuid and estado = 'executada')) then perform vigia.erro('invalido:alvo'); end if;
  perform vigia.limite('acao_propor', 30, 60);
  insert into acoes (incidente, tipo, alvo, motivo, duracao_horas, proposta_por)
  values (nullif(p ->> 'incidente', '')::uuid, v_tipo, v_alvo, vigia.txt(p ->> 'motivo', 'motivo', 5, 500), greatest(1, least(coalesce((p ->> 'duracao_horas')::integer, 24), 24 * 90)), v)
  returning id into v_id;
  if p ->> 'incidente' is not null and p ->> 'incidente' <> '' then
    insert into incidente_notas (incidente, autor, texto, tipo) values ((p ->> 'incidente')::uuid, v, 'Proposta: ' || v_tipo || ' ' || v_alvo || ' (' || (p ->> 'motivo') || '). Aguarda confirmação de outra pessoa.', 'sistema');
    update incidentes set atualizado_em = now() where id = (p ->> 'incidente')::uuid;
  end if;
  perform vigia.registrar('acao_proposta', v_id::text, jsonb_build_object('tipo', v_tipo, 'alvo', v_alvo));
  return vigia.acao_json((select a from acoes a where id = v_id));
end $$;

/** Outra pessoa (dono ou analista, nunca quem propôs) confirma. O Worker executa na próxima passada. */
create or replace function public.acao_confirmar(p_id uuid, p_confirmar boolean) returns jsonb language plpgsql security definer set search_path = vigia, pg_temp as $$
declare v uuid := vigia.eu2(); a acoes;
begin
  if not vigia.analista() then perform vigia.erro('sem_permissao'); end if;
  select * into a from acoes where id = p_id for update;
  if not found then perform vigia.erro('nao_encontrado'); end if;
  if a.estado <> 'proposta' then perform vigia.erro('ja_decidida'); end if;
  if a.proposta_por = v then perform vigia.erro('outra_pessoa_confirma'); end if;
  update acoes set estado = case when p_confirmar then 'confirmada' else 'recusada' end, confirmada_por = v, confirmada_em = now() where id = p_id;
  if a.incidente is not null then
    insert into incidente_notas (incidente, autor, texto, tipo) values (a.incidente, v, case when p_confirmar then 'Confirmada' else 'Recusada' end || ': ' || a.tipo || ' ' || a.alvo || '.', 'sistema');
    update incidentes set atualizado_em = now() where id = a.incidente;
  end if;
  perform vigia.registrar(case when p_confirmar then 'acao_confirmada' else 'acao_recusada' end, p_id::text, jsonb_build_object('tipo', a.tipo, 'alvo', a.alvo));
  return vigia.acao_json((select x from acoes x where id = p_id));
end $$;

create or replace function public.acoes_listar(p_estado text default null) returns jsonb language plpgsql security definer set search_path = vigia, pg_temp as $$
begin
  perform vigia.eu2();
  return (select coalesce(jsonb_agg(vigia.acao_json(a) order by a.proposta_em desc), '[]'::jsonb) from (select * from acoes where coalesce(p_estado, '') = '' or estado = p_estado order by proposta_em desc limit 200) a);
end $$;

-- ───────────────────────────── Relatório exportável ─────────────────────────────

create or replace function public.relatorio(p_desde timestamptz, p_ate timestamptz) returns jsonb language plpgsql security definer set search_path = vigia, pg_temp as $$
declare v_desde timestamptz := coalesce(p_desde, now() - interval '30 days'); v_ate timestamptz := coalesce(p_ate, now());
begin
  perform vigia.eu2();
  if v_ate - v_desde > interval '400 days' then perform vigia.erro('invalido:periodo'); end if;
  perform vigia.limite('relatorio', 20, 60);
  perform vigia.registrar('exportou:relatorio', '', jsonb_build_object('desde', v_desde, 'ate', v_ate));
  return jsonb_build_object(
    'periodo', jsonb_build_object('desde', v_desde, 'ate', v_ate, 'gerado_em', now(), 'por', (select nome from perfis where id = auth.uid())),
    'disponibilidade', (select jsonb_build_object('total', count(*), 'no_ar', count(*) filter (where no_ar), 'percentual', round(100.0 * count(*) filter (where no_ar) / greatest(count(*), 1), 3),
      'ms_mediana', percentile_cont(0.5) within group (order by ms), 'ms_p95', percentile_cont(0.95) within group (order by ms)) from verificacoes where alvo = 'site' and em between v_desde and v_ate),
    'trafego', (select jsonb_build_object('requisicoes', coalesce(sum(requisicoes), 0), 'bloqueios', coalesce(sum(bloqueios), 0), 'desafios', coalesce(sum(desafios), 0)) from metricas where em between v_desde and v_ate),
    'trafego_por_dia', (select coalesce(jsonb_agg(jsonb_build_object('dia', dia, 'requisicoes', r, 'bloqueios', b) order by dia), '[]'::jsonb) from (select date_trunc('day', em) as dia, sum(requisicoes) as r, sum(bloqueios) as b from metricas where em between v_desde and v_ate group by 1) x),
    'eventos_por_fonte', (select coalesce(jsonb_object_agg(fonte, n), '{}'::jsonb) from (select fonte, count(*) as n from eventos where em between v_desde and v_ate group by fonte) x),
    'alertas', (select coalesce(jsonb_agg(to_jsonb(a) order by a.em), '[]'::jsonb) from (select id, em, regra, gravidade, titulo, estado from alertas where em between v_desde and v_ate) a),
    'incidentes', (select coalesce(jsonb_agg(vigia.incidente_json(i) order by i.aberto_em), '[]'::jsonb) from incidentes i where aberto_em between v_desde and v_ate or (estado <> 'resolvido' and aberto_em < v_ate)),
    'acoes', (select coalesce(jsonb_agg(vigia.acao_json(a) order by a.proposta_em), '[]'::jsonb) from acoes a where proposta_em between v_desde and v_ate),
    'ips_top', (select coalesce(jsonb_agg(x order by x.total desc), '[]'::jsonb) from (select ip, pais, max(asn_nome) as asn_nome, count(*) as total from eventos where em between v_desde and v_ate and ip <> '' group by ip, pais order by total desc limit 30) x),
    'postura', (select coalesce(jsonb_agg(jsonb_build_object('em', em, 'nota', nota) order by em), '[]'::jsonb) from (select date_trunc('day', em) as em, min(nota) as nota from postura where em between v_desde and v_ate group by 1) x),
    'deploys', (select coalesce(jsonb_agg(to_jsonb(d) order by d.criado_em), '[]'::jsonb) from deploys d where criado_em between v_desde and v_ate),
    'certificados_novos', (select coalesce(jsonb_agg(to_jsonb(c) order by c.visto_em), '[]'::jsonb) from certificados c where visto_em between v_desde and v_ate));
end $$;

-- ───────────────────────────── O coletor (chave de serviço) ─────────────────────────────

create or replace function vigia.so_servico() returns void language plpgsql as $$
begin
  if not vigia.servico() then raise exception 'sem_permissao' using errcode = 'P0001'; end if;
end $$;

create or replace function public.coleta_configuracao() returns jsonb language plpgsql security definer set search_path = vigia, pg_temp as $$
begin
  perform vigia.so_servico();
  return jsonb_build_object(
    'configuracoes', (select coalesce(jsonb_object_agg(chave, valor), '{}'::jsonb) from configuracoes),
    'regras', (select coalesce(jsonb_agg(to_jsonb(r)), '[]'::jsonb) from regras r where ligada),
    'terceiros_conhecidos', (select coalesce(jsonb_agg(jsonb_build_object('pagina', pagina, 'tipo', tipo, 'host', host)), '[]'::jsonb) from terceiros),
    'certificados_conhecidos', (select coalesce(jsonb_agg(crt_id), '[]'::jsonb) from certificados),
    'dominios', (select coalesce(jsonb_object_agg(dominio, resolve), '{}'::jsonb) from dominios_parecidos),
    'dns_atual', (select coalesce(jsonb_agg(jsonb_build_object('nome', nome, 'tipo', tipo, 'valores', valores)), '[]'::jsonb) from dns where atual),
    'ultimo_hash', (select coalesce(jsonb_object_agg(alvo, hash), '{}'::jsonb) from (select alvo, hash from verificacoes v where v.id in (select max(id) from verificacoes where hash is not null group by alvo)) x),
    'ultimo_deploy_em', (select max(pronto_em) from deploys where estado in ('READY', 'ready')),
    'verificacoes_recentes', (select coalesce(jsonb_agg(jsonb_build_object('alvo', alvo, 'no_ar', no_ar, 'ms', ms, 'em', em) order by em desc), '[]'::jsonb) from (select alvo, no_ar, ms, em from verificacoes where em > now() - interval '1 hour' order by em desc limit 200) x),
    'mediana_bloqueios', (select percentile_cont(0.5) within group (order by bloqueios) from metricas where em > now() - interval '7 days'),
    'mediana_requisicoes', (select percentile_cont(0.5) within group (order by requisicoes) from metricas where em > now() - interval '7 days'),
    'ultima_metrica', (select max(em) from metricas),
    'ultimo_evento_waf', (select max(em) from eventos where fonte = 'waf'),
    'ultimo_evento_auth', (select max(em) from eventos where fonte = 'auth'),
    'deploys_conhecidos', (select coalesce(jsonb_agg(id), '[]'::jsonb) from (select id from deploys order by criado_em desc limit 100) x),
    'github_conhecidos', (select coalesce(jsonb_object_agg(id, estado), '{}'::jsonb) from github_alertas),
    'alertas_recentes', (select coalesce(jsonb_agg(jsonb_build_object('regra', regra, 'impressao', impressao, 'em', em)), '[]'::jsonb) from alertas where em > now() - interval '24 hours'),
    'ultimos_cabecalhos', (select cabecalhos from verificacoes where alvo = 'site' and no_ar order by em desc limit 1),
    'segundo_fator_todos', case when to_regclass('auth.mfa_factors') is null then null else (select bool_and(vigia.fator_de(id)) from perfis where ativo) end,
    'ips_insistentes', (select coalesce(jsonb_agg(x), '[]'::jsonb) from (
      select e.ip, count(*) as bloqueios from eventos e where e.em > now() - interval '6 hours' and e.ip <> '' and e.acao in ('block', 'drop')
        and not exists (select 1 from eventos r where r.fonte = 'reputacao' and r.ip = e.ip and r.em > now() - interval '7 days')
      group by e.ip having count(*) >= 5 order by count(*) desc limit 10) x));
end $$;

/** Para o coletor desfazer um bloqueio: a referência que a Cloudflare devolveu quando a ação foi executada. */
create or replace function public.coleta_acao_referencia(p_id uuid) returns jsonb language plpgsql security definer set search_path = vigia, pg_temp as $$
begin
  perform vigia.so_servico();
  return (select jsonb_build_object('referencia', referencia, 'estado', estado) from acoes where id = p_id);
end $$;

/** Uma verificação de alvo (site, página, supabase…). */
create or replace function public.coleta_verificacao(p jsonb) returns jsonb language plpgsql security definer set search_path = vigia, pg_temp as $$
declare v_id bigint;
begin
  perform vigia.so_servico();
  insert into verificacoes (alvo, regiao, no_ar, status, ms, hash, cabecalhos, nota, erro)
  values (left(p ->> 'alvo', 200), left(coalesce(p ->> 'regiao', ''), 40), coalesce((p ->> 'no_ar')::boolean, false), (p ->> 'status')::integer, (p ->> 'ms')::integer,
    nullif(p ->> 'hash', ''), coalesce(p -> 'cabecalhos', '{}'::jsonb), (p ->> 'nota')::integer, left(coalesce(p ->> 'erro', ''), 300))
  returning id into v_id;
  return jsonb_build_object('id', v_id);
end $$;

create or replace function public.coleta_metricas(p jsonb) returns jsonb language plpgsql security definer set search_path = vigia, pg_temp as $$
declare m jsonb; n integer := 0;
begin
  perform vigia.so_servico();
  for m in select * from jsonb_array_elements(case when jsonb_typeof(p) = 'array' then p else jsonb_build_array(p) end) loop
    insert into metricas (em, requisicoes, bloqueios, desafios, bytes, por_pais, por_status, por_caminho)
    values ((m ->> 'em')::timestamptz, coalesce((m ->> 'requisicoes')::bigint, 0), coalesce((m ->> 'bloqueios')::bigint, 0), coalesce((m ->> 'desafios')::bigint, 0), coalesce((m ->> 'bytes')::bigint, 0),
      coalesce(m -> 'por_pais', '{}'::jsonb), coalesce(m -> 'por_status', '{}'::jsonb), coalesce(m -> 'por_caminho', '{}'::jsonb))
    on conflict (em) do update set requisicoes = excluded.requisicoes, bloqueios = excluded.bloqueios, desafios = excluded.desafios, bytes = excluded.bytes,
      por_pais = excluded.por_pais, por_status = excluded.por_status, por_caminho = excluded.por_caminho;
    n := n + 1;
  end loop;
  return jsonb_build_object('gravadas', n);
end $$;

/** Eventos em lote; os que já existem (mesma impressão) são ignorados. */
create or replace function public.coleta_eventos(p jsonb) returns jsonb language plpgsql security definer set search_path = vigia, pg_temp as $$
declare e jsonb; n integer := 0; v_fonte text;
begin
  perform vigia.so_servico();
  if jsonb_typeof(p) <> 'array' then perform vigia.erro('invalido:eventos'); end if;
  for e in select * from jsonb_array_elements(p) loop
    v_fonte := e ->> 'fonte';
    if v_fonte not in ('waf', 'auth', 'isca', 'csp', 'vercel', 'github', 'supabase', 'dns', 'certificado', 'pagina', 'terceiro', 'dominio', 'reputacao', 'uptime', 'cabecalho', 'manual') then continue; end if;
    insert into eventos (em, fonte, tipo, gravidade, ip, pais, asn, asn_nome, caminho, agente, acao, regra, detalhes, impressao)
    values (coalesce((e ->> 'em')::timestamptz, now()), v_fonte, left(coalesce(e ->> 'tipo', ''), 60),
      case when e ->> 'gravidade' in ('info', 'baixa', 'media', 'alta', 'critica') then e ->> 'gravidade' else 'baixa' end,
      left(coalesce(e ->> 'ip', ''), 45), left(coalesce(e ->> 'pais', ''), 2), left(coalesce(e ->> 'asn', ''), 12), left(coalesce(e ->> 'asn_nome', ''), 120),
      left(coalesce(e ->> 'caminho', ''), 300), left(coalesce(e ->> 'agente', ''), 300), left(coalesce(e ->> 'acao', ''), 40), left(coalesce(e ->> 'regra', ''), 120),
      coalesce(e -> 'detalhes', '{}'::jsonb), nullif(left(e ->> 'impressao', 120), ''))
    on conflict (impressao) do nothing;
    if found then n := n + 1; end if;
  end loop;
  return jsonb_build_object('novos', n);
end $$;

create or replace function public.coleta_dns(p jsonb) returns jsonb language plpgsql security definer set search_path = vigia, pg_temp as $$
declare r jsonb; v_valores text[]; v_antes text[]; mudancas jsonb := '[]'::jsonb;
begin
  perform vigia.so_servico();
  for r in select * from jsonb_array_elements(p) loop
    select coalesce(array_agg(x order by x), '{}') into v_valores from jsonb_array_elements_text(coalesce(r -> 'valores', '[]'::jsonb)) x;
    select valores into v_antes from dns where nome = r ->> 'nome' and tipo = r ->> 'tipo' and atual;
    if v_antes is null then
      insert into dns (nome, tipo, valores) values (r ->> 'nome', r ->> 'tipo', v_valores);
    elsif v_antes <> v_valores then
      update dns set atual = false where nome = r ->> 'nome' and tipo = r ->> 'tipo' and atual;
      insert into dns (nome, tipo, valores) values (r ->> 'nome', r ->> 'tipo', v_valores);
      mudancas := mudancas || jsonb_build_object('nome', r ->> 'nome', 'tipo', r ->> 'tipo', 'de', to_jsonb(v_antes), 'para', to_jsonb(v_valores));
    else
      update dns set em = now() where nome = r ->> 'nome' and tipo = r ->> 'tipo' and atual;
    end if;
  end loop;
  return jsonb_build_object('mudancas', mudancas);
end $$;

create or replace function public.coleta_certificados(p jsonb) returns jsonb language plpgsql security definer set search_path = vigia, pg_temp as $$
declare c jsonb; novos jsonb := '[]'::jsonb;
begin
  perform vigia.so_servico();
  for c in select * from jsonb_array_elements(p) loop
    if exists (select 1 from certificados where crt_id = (c ->> 'crt_id')::bigint) then
      update certificados set visto_em = now() where crt_id = (c ->> 'crt_id')::bigint;
    else
      insert into certificados (crt_id, emissor, nome_comum, nomes, nao_antes, nao_depois, conhecido)
      values ((c ->> 'crt_id')::bigint, left(coalesce(c ->> 'emissor', ''), 200), left(coalesce(c ->> 'nome_comum', ''), 200),
        (select coalesce(array_agg(x), '{}') from jsonb_array_elements_text(coalesce(c -> 'nomes', '[]'::jsonb)) x), (c ->> 'nao_antes')::timestamptz, (c ->> 'nao_depois')::timestamptz, coalesce((c ->> 'conhecido')::boolean, true));
      novos := novos || c;
    end if;
  end loop;
  return jsonb_build_object('novos', novos);
end $$;

create or replace function public.coleta_terceiros(p jsonb) returns jsonb language plpgsql security definer set search_path = vigia, pg_temp as $$
declare t jsonb; novos jsonb := '[]'::jsonb; v_pagina text; v_tipo text; v_host text;
begin
  perform vigia.so_servico();
  for t in select * from jsonb_array_elements(p) loop
    v_pagina := left(t ->> 'pagina', 200);
    v_tipo := case when t ->> 'tipo' in ('script', 'iframe', 'link', 'img', 'connect') then t ->> 'tipo' else 'outro' end;
    v_host := left(lower(t ->> 'host'), 200);
    if exists (select 1 from terceiros where pagina = v_pagina and tipo = v_tipo and host = v_host) then
      update terceiros set visto_em = now(), url = left(coalesce(t ->> 'url', ''), 500), permitido = coalesce((t ->> 'permitido')::boolean, false) where pagina = v_pagina and tipo = v_tipo and host = v_host;
    else
      insert into terceiros (pagina, tipo, host, url, permitido) values (v_pagina, v_tipo, v_host, left(coalesce(t ->> 'url', ''), 500), coalesce((t ->> 'permitido')::boolean, false));
      novos := novos || t;
    end if;
  end loop;
  return jsonb_build_object('novos', novos);
end $$;

create or replace function public.coleta_dominios(p jsonb) returns jsonb language plpgsql security definer set search_path = vigia, pg_temp as $$
declare d jsonb; v_antes boolean; mudaram jsonb := '[]'::jsonb;
begin
  perform vigia.so_servico();
  for d in select * from jsonb_array_elements(p) loop
    select resolve into v_antes from dominios_parecidos where dominio = d ->> 'dominio';
    insert into dominios_parecidos (dominio, resolve, registros) values (left(lower(d ->> 'dominio'), 253), coalesce((d ->> 'resolve')::boolean, false), coalesce(d -> 'registros', '{}'::jsonb))
    on conflict (dominio) do update set resolve = excluded.resolve, registros = excluded.registros, visto_em = now(),
      mudou_em = case when dominios_parecidos.resolve <> excluded.resolve then now() else dominios_parecidos.mudou_em end;
    if v_antes is distinct from coalesce((d ->> 'resolve')::boolean, false) and coalesce((d ->> 'resolve')::boolean, false) then mudaram := mudaram || d; end if;
  end loop;
  return jsonb_build_object('passaram_a_resolver', mudaram);
end $$;

create or replace function public.coleta_deploys(p jsonb) returns jsonb language plpgsql security definer set search_path = vigia, pg_temp as $$
declare d jsonb; novos jsonb := '[]'::jsonb; v_antes text;
begin
  perform vigia.so_servico();
  for d in select * from jsonb_array_elements(p) loop
    select estado into v_antes from deploys where id = d ->> 'id';
    insert into deploys (id, estado, ambiente, url, ramo, commit, mensagem, autor, criado_em, pronto_em)
    values (left(d ->> 'id', 80), left(coalesce(d ->> 'estado', ''), 20), left(coalesce(d ->> 'ambiente', ''), 20), left(coalesce(d ->> 'url', ''), 300), left(coalesce(d ->> 'ramo', ''), 120),
      left(coalesce(d ->> 'commit', ''), 40), left(coalesce(d ->> 'mensagem', ''), 300), left(coalesce(d ->> 'autor', ''), 120), coalesce((d ->> 'criado_em')::timestamptz, now()), (d ->> 'pronto_em')::timestamptz)
    on conflict (id) do update set estado = excluded.estado, url = excluded.url, pronto_em = excluded.pronto_em;
    if v_antes is distinct from (d ->> 'estado') then novos := novos || (d || jsonb_build_object('estado_antes', v_antes)); end if;
  end loop;
  return jsonb_build_object('mudaram', novos);
end $$;

create or replace function public.coleta_github(p jsonb) returns jsonb language plpgsql security definer set search_path = vigia, pg_temp as $$
declare g jsonb; novos jsonb := '[]'::jsonb;
begin
  perform vigia.so_servico();
  for g in select * from jsonb_array_elements(p) loop
    if exists (select 1 from github_alertas where id = left(g ->> 'id', 80)) then
      update github_alertas set estado = left(coalesce(g ->> 'estado', 'open'), 20), visto_em = now(), titulo = left(coalesce(g ->> 'titulo', ''), 300) where id = left(g ->> 'id', 80);
    else
      insert into github_alertas (id, tipo, gravidade, titulo, pacote, estado, url, criado_em)
      values (left(g ->> 'id', 80), case when g ->> 'tipo' in ('dependabot', 'segredo', 'codigo', 'rotina') then g ->> 'tipo' else 'rotina' end, left(coalesce(g ->> 'gravidade', ''), 20), left(coalesce(g ->> 'titulo', ''), 300),
        left(coalesce(g ->> 'pacote', ''), 120), left(coalesce(g ->> 'estado', 'open'), 20), left(coalesce(g ->> 'url', ''), 300), coalesce((g ->> 'criado_em')::timestamptz, now()));
      novos := novos || g;
    end if;
  end loop;
  return jsonb_build_object('novos', novos);
end $$;

create or replace function public.coleta_postura(p jsonb) returns jsonb language plpgsql security definer set search_path = vigia, pg_temp as $$
begin
  perform vigia.so_servico();
  insert into postura (em, nota, componentes) values (now(), greatest(0, least(coalesce((p ->> 'nota')::integer, 0), 100)), coalesce(p -> 'componentes', '[]'::jsonb));
  return jsonb_build_object('ok', true);
end $$;

/** Relatórios de CSP recebidos pelo Worker (o navegador manda sem conta; o Worker repassa com a chave de serviço). */
create or replace function public.coleta_csp(p jsonb) returns jsonb language plpgsql security definer set search_path = vigia, pg_temp as $$
declare v jsonb; n integer := 0;
begin
  perform vigia.so_servico();
  for v in select * from jsonb_array_elements(case when jsonb_typeof(p) = 'array' then p else jsonb_build_array(p) end) loop
    insert into csp_violacoes (impressao, documento, diretiva, bloqueado)
    values (left(v ->> 'impressao', 120), left(coalesce(v ->> 'documento', ''), 300), left(coalesce(v ->> 'diretiva', ''), 80), left(coalesce(v ->> 'bloqueado', ''), 300))
    on conflict (impressao) do update set vezes = csp_violacoes.vezes + 1, ultimo_em = now();
    n := n + 1;
  end loop;
  return jsonb_build_object('gravadas', n);
end $$;

/** Cria um alerta. O mesmo alerta (mesma impressão) não se repete em uma hora. Devolve quem deve ser avisado. */
create or replace function public.alerta_criar(p jsonb) returns jsonb language plpgsql security definer set search_path = vigia, pg_temp as $$
declare v_id bigint; v_impressao text := nullif(p ->> 'impressao', ''); v_grav text := p ->> 'gravidade'; v_regra text := p ->> 'regra';
begin
  perform vigia.so_servico();
  if v_grav not in ('baixa', 'media', 'alta', 'critica') then v_grav := 'media'; end if;
  if not exists (select 1 from regras where id = v_regra and ligada) then return jsonb_build_object('ignorado', 'regra_desligada'); end if;
  if v_impressao is not null and exists (select 1 from alertas where impressao = v_impressao and em > now() - interval '1 hour') then return jsonb_build_object('ignorado', 'repetido'); end if;
  if v_impressao is not null and exists (select 1 from alertas where impressao = v_impressao and estado = 'silenciado' and silenciado_ate > now()) then return jsonb_build_object('ignorado', 'silenciado'); end if;
  insert into alertas (regra, gravidade, titulo, resumo, detalhes, impressao)
  values (v_regra, v_grav, left(p ->> 'titulo', 160), left(coalesce(p ->> 'resumo', ''), 1000), coalesce(p -> 'detalhes', '{}'::jsonb), v_impressao)
  returning id into v_id;
  -- Quem avisar por e-mail: quem optou e cuja gravidade mínima cabe. O texto não leva detalhe nenhum (nada sensível na prévia).
  return jsonb_build_object('id', v_id, 'avisar', (
    select coalesce(jsonb_agg(jsonb_build_object('email', vigia.email_da_conta(f.id), 'nome', f.nome)), '[]'::jsonb) from perfis f
    where f.ativo and (f.avisos ->> 'email')::boolean
      and array_position(array['baixa', 'media', 'alta', 'critica'], v_grav) >= array_position(array['baixa', 'media', 'alta', 'critica'], coalesce(f.avisos ->> 'minimo', 'media'))));
end $$;

/** O Worker pega os e-mails da fila (até 50) e os marca como "enviando". */
create or replace function public.emails_pendentes(p_limite integer default 50) returns jsonb language plpgsql security definer set search_path = vigia, pg_temp as $$
declare v_ids uuid[];
begin
  perform vigia.so_servico();
  update emails set status = case when tentativas >= 5 then 'falhou' else 'pendente' end where status = 'enviando' and tentado_em < now() - interval '15 minutes';
  select array_agg(id) into v_ids from (select id from emails where status = 'pendente' order by criado_em limit greatest(1, least(coalesce(p_limite, 50), 100)) for update skip locked) x;
  update emails set status = 'enviando', tentado_em = now(), tentativas = tentativas + 1 where id = any (coalesce(v_ids, '{}'));
  return (select coalesce(jsonb_agg(jsonb_build_object('id', id, 'para', para, 'assunto', assunto, 'texto', texto) order by criado_em), '[]'::jsonb) from emails where id = any (coalesce(v_ids, '{}')));
end $$;

create or replace function public.email_resultado(p_id uuid, p_ok boolean, p_erro text default '') returns jsonb language plpgsql security definer set search_path = vigia, pg_temp as $$
begin
  perform vigia.so_servico();
  if p_ok then
    update emails set status = 'enviado', enviado_em = now(), texto = '', erro = '' where id = p_id;
  else
    update emails set status = case when tentativas >= 5 then 'falhou' else 'pendente' end, erro = left(coalesce(p_erro, ''), 300) where id = p_id;
  end if;
  return jsonb_build_object('ok', true);
end $$;

/** Ações confirmadas que o Worker ainda não executou (e as executadas cujo prazo venceu, para desfazer). */
create or replace function public.acoes_pendentes() returns jsonb language plpgsql security definer set search_path = vigia, pg_temp as $$
begin
  perform vigia.so_servico();
  return jsonb_build_object(
    'executar', (select coalesce(jsonb_agg(to_jsonb(a) order by a.confirmada_em), '[]'::jsonb) from acoes a where estado = 'confirmada'),
    'desfazer', (select coalesce(jsonb_agg(to_jsonb(a) order by a.executada_em), '[]'::jsonb) from acoes a where estado = 'executada' and tipo <> 'desbloquear' and executada_em + make_interval(hours => duracao_horas) < now()));
end $$;

create or replace function public.acao_resultado(p_id uuid, p_estado text, p_resultado jsonb default '{}'::jsonb, p_referencia text default '') returns jsonb language plpgsql security definer set search_path = vigia, pg_temp as $$
declare a acoes;
begin
  perform vigia.so_servico();
  if p_estado not in ('executada', 'falhou', 'desfeita') then perform vigia.erro('invalido:estado'); end if;
  select * into a from acoes where id = p_id for update;
  if not found then perform vigia.erro('nao_encontrado'); end if;
  update acoes set estado = p_estado, executada_em = case when p_estado = 'executada' then now() else executada_em end, resultado = coalesce(p_resultado, '{}'::jsonb),
    referencia = coalesce(nullif(left(p_referencia, 120), ''), referencia) where id = p_id;
  if a.incidente is not null then
    insert into incidente_notas (incidente, autor, texto, tipo) values (a.incidente, null, case p_estado when 'executada' then 'Executada na Cloudflare: ' when 'falhou' then 'Falhou na Cloudflare: ' else 'Desfeita (prazo vencido): ' end || a.tipo || ' ' || a.alvo || '.', 'sistema');
    update incidentes set atualizado_em = now() where id = a.incidente;
  end if;
  perform vigia.registrar('acao_' || p_estado, p_id::text, jsonb_build_object('tipo', a.tipo, 'alvo', a.alvo, 'resultado', p_resultado));
  return jsonb_build_object('ok', true);
end $$;

-- ───────────────────────────── Limpeza ─────────────────────────────

create or replace function vigia.limpeza() returns void language plpgsql security definer set search_path = vigia, pg_temp as $$
declare r jsonb := (select valor from configuracoes where chave = 'retencao');
begin
  delete from eventos where em < now() - make_interval(days => coalesce((r ->> 'eventos_dias')::integer, 90));
  delete from verificacoes where em < now() - make_interval(days => coalesce((r ->> 'verificacoes_dias')::integer, 90));
  delete from metricas where em < now() - make_interval(days => coalesce((r ->> 'agregados_dias')::integer, 400));
  delete from postura where em < now() - make_interval(days => coalesce((r ->> 'agregados_dias')::integer, 400));
  delete from alertas where em < now() - make_interval(days => coalesce((r ->> 'agregados_dias')::integer, 400)) and estado = 'resolvido';
  delete from csp_violacoes where ultimo_em < now() - interval '90 days';
  delete from emails where status in ('enviado', 'falhou') and criado_em < now() - interval '90 days';
  delete from limites where janela < now() - interval '2 days';
  delete from convites where (usado_em is not null or revogado or expira_em < now()) and criado_em < now() - interval '90 days';
  delete from auditoria where criado_em < now() - interval '400 days';
  delete from dns where not atual and em < now() - interval '400 days';
end $$;

create or replace function public.coleta_limpeza() returns jsonb language plpgsql security definer set search_path = vigia, pg_temp as $$
begin
  perform vigia.so_servico();
  perform vigia.limpeza();
  return jsonb_build_object('ok', true);
end $$;

-- A faxina diária pelo relógio do banco, quando a extensão existe (no Supabase: Database → Extensions → pg_cron).
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule('sentinela-faxina') from cron.job where jobname = 'sentinela-faxina';
    perform cron.schedule('sentinela-faxina', '23 5 * * *', 'select vigia.limpeza()');
  end if;
exception when others then
  raise notice 'pg_cron indisponível: a limpeza fica a cargo do Worker (coleta_limpeza).';
end $$;

-- ───────────────────────────── Permissões ─────────────────────────────

-- Só as funções públicas são chamáveis; o esquema vigia continua fechado.
do $$
declare f record;
begin
  for f in select p.oid::regprocedure as assinatura, p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' loop
    -- O serviço dá EXECUTE por padrão a anon, authenticated e service_role em toda função nova: tira tudo e dá só o que cabe.
    execute format('revoke all on function %s from public, anon, authenticated, service_role', f.assinatura);
    if f.proname like 'coleta_%' or f.proname in ('alerta_criar', 'emails_pendentes', 'email_resultado', 'acoes_pendentes', 'acao_resultado') then
      execute format('grant execute on function %s to service_role', f.assinatura);
    elsif f.proname in ('convite_ver') then
      execute format('grant execute on function %s to anon, authenticated, service_role', f.assinatura);
    elsif f.proname in ('sentinela_conta_nova', 'promover_dono') then
      null; -- gatilho e SQL Editor: ninguém chama pela API
    else
      execute format('grant execute on function %s to authenticated, service_role', f.assinatura);
    end if;
  end loop;
end $$;
grant usage on schema vigia to service_role;
