-- Instituto Lúcia — © Jonathan Santos. Todos os direitos reservados.
--
-- Banco de apoio do site: contas, voluntariado, fila de contribuições, comunidade, anotações,
-- apoiadores e rádio. Rode este arquivo inteiro no SQL Editor. Pode rodar de novo sem medo:
-- ele não apaga nada e só cria o que falta.
--
-- Como a segurança funciona
--   1. As tabelas ficam no esquema "interno", que a API não expõe. Ninguém lê nem escreve nelas direto.
--   2. A única porta de entrada são as funções do esquema "public". Cada uma confere, dentro do banco,
--      quem está chamando e o que essa pessoa pode fazer.
--   3. O conteúdo publicado do site NÃO mora aqui: ele vai para os arquivos do site, com histórico.
--      Se este banco for invadido ou apagado, o acervo continua no ar e nada do que foi publicado se perde.
--
-- Depois de entrar no site pela primeira vez com o seu e-mail, torne-se coordenação rodando aqui:
--   select public.promover_coordenacao('seu-email@exemplo.com');

create schema if not exists interno;
revoke all on schema interno from public;

-- ───────────────────────────── Tabelas ─────────────────────────────

create table if not exists interno.perfis (
  id uuid primary key references auth.users (id) on delete cascade,
  nome text not null check (char_length(nome) between 2 and 60),
  bio text not null default '' check (char_length(bio) <= 500),
  suspenso boolean not null default false,
  criado_em timestamptz not null default now()
);

-- Um papel por linha. "disciplina" vazia vale para o site inteiro.
create table if not exists interno.papeis (
  id uuid primary key default gen_random_uuid(),
  usuario uuid not null references interno.perfis (id) on delete cascade,
  papel text not null check (papel in ('coordenacao', 'curadoria', 'educacao', 'revisao', 'traducao', 'jornalismo')),
  disciplina text check (disciplina is null or disciplina ~ '^[a-z0-9-]{2,40}$'),
  concedido_por uuid references interno.perfis (id) on delete set null,
  criado_em timestamptz not null default now()
);
create unique index if not exists papeis_unico on interno.papeis (usuario, papel, coalesce(disciplina, ''));

create table if not exists interno.candidaturas (
  id uuid primary key default gen_random_uuid(),
  usuario uuid not null references interno.perfis (id) on delete cascade,
  papel text not null check (papel in ('curadoria', 'educacao', 'revisao', 'traducao', 'jornalismo')),
  disciplina text check (disciplina is null or disciplina ~ '^[a-z0-9-]{2,40}$'),
  mensagem text not null check (char_length(mensagem) between 20 and 2000),
  status text not null default 'pendente' check (status in ('pendente', 'aceita', 'recusada')),
  decidido_por uuid references interno.perfis (id) on delete set null,
  decidido_em timestamptz,
  criado_em timestamptz not null default now()
);

create table if not exists interno.contribuicoes (
  id uuid primary key default gen_random_uuid(),
  tipo text not null check (tipo in ('aula', 'obra', 'artigo', 'checagem', 'debate', 'verbete', 'memorial', 'video', 'frase', 'traducao', 'correcao', 'sugestao')),
  disciplina text check (disciplina is null or disciplina ~ '^[a-z0-9-]{2,40}$'),
  titulo text not null check (char_length(titulo) between 3 and 160),
  corpo text not null default '' check (char_length(corpo) <= 60000),
  dados jsonb not null default '{}'::jsonb,
  fontes jsonb not null default '[]'::jsonb,
  alvo text check (alvo is null or char_length(alvo) <= 300),
  autor uuid references interno.perfis (id) on delete set null,
  nome_autor text not null default '' check (char_length(nome_autor) <= 80),
  como text not null default 'publico',
  status text not null default 'pendente' check (status in ('pendente', 'aprovada', 'recusada', 'publicada', 'resolvida')),
  nota text not null default '' check (char_length(nota) <= 2000),
  revisado_por uuid references interno.perfis (id) on delete set null,
  revisado_em timestamptz,
  publicado_em timestamptz,
  criado_em timestamptz not null default now()
);
create index if not exists contribuicoes_status on interno.contribuicoes (status, criado_em);

create table if not exists interno.pareceres (
  id uuid primary key default gen_random_uuid(),
  contribuicao uuid not null references interno.contribuicoes (id) on delete cascade,
  autor uuid references interno.perfis (id) on delete set null,
  favoravel boolean not null,
  texto text not null check (char_length(texto) between 3 and 2000),
  criado_em timestamptz not null default now()
);

create table if not exists interno.topicos (
  id uuid primary key default gen_random_uuid(),
  autor uuid references interno.perfis (id) on delete set null,
  titulo text not null check (char_length(titulo) between 5 and 140),
  corpo text not null check (char_length(corpo) between 10 and 8000),
  disciplina text check (disciplina is null or disciplina ~ '^[a-z0-9-]{2,40}$'),
  pontos integer not null default 0,
  respostas integer not null default 0,
  oculto boolean not null default false,
  trancado boolean not null default false,
  criado_em timestamptz not null default now()
);
create index if not exists topicos_recentes on interno.topicos (criado_em desc);

create table if not exists interno.respostas (
  id uuid primary key default gen_random_uuid(),
  topico uuid not null references interno.topicos (id) on delete cascade,
  autor uuid references interno.perfis (id) on delete set null,
  corpo text not null check (char_length(corpo) between 2 and 8000),
  pontos integer not null default 0,
  oculto boolean not null default false,
  criado_em timestamptz not null default now()
);
create index if not exists respostas_topico on interno.respostas (topico, criado_em);

create table if not exists interno.votos (
  usuario uuid not null references interno.perfis (id) on delete cascade,
  tipo text not null check (tipo in ('topico', 'resposta')),
  alvo uuid not null,
  valor smallint not null check (valor in (-1, 1)),
  primary key (usuario, tipo, alvo)
);

create table if not exists interno.anotacoes (
  id uuid primary key default gen_random_uuid(),
  caminho text not null check (caminho ~ '^/[a-z0-9/_-]{1,200}$'),
  paragrafo integer not null check (paragrafo between 0 and 2000),
  trecho text not null default '' check (char_length(trecho) <= 300),
  corpo text not null check (char_length(corpo) between 5 and 1500),
  autor uuid references interno.perfis (id) on delete set null,
  status text not null default 'pendente' check (status in ('pendente', 'aprovada', 'oculta')),
  criado_em timestamptz not null default now()
);
create index if not exists anotacoes_caminho on interno.anotacoes (caminho);

create table if not exists interno.denuncias (
  id uuid primary key default gen_random_uuid(),
  alvo text not null check (char_length(alvo) between 1 and 300),
  motivo text not null check (char_length(motivo) between 2 and 80),
  detalhes text not null check (char_length(detalhes) between 20 and 4000),
  autor uuid references interno.perfis (id) on delete set null,
  status text not null default 'aberta' check (status in ('aberta', 'resolvida')),
  nota text not null default '',
  criado_em timestamptz not null default now()
);

create table if not exists interno.apoiadores (
  id uuid primary key default gen_random_uuid(),
  nome text not null check (char_length(nome) between 2 and 80),
  mensagem text not null default '' check (char_length(mensagem) <= 200),
  criado_em timestamptz not null default now()
);

-- Mural dos Trabalhadores: anúncios de cooperativas, ofícios, arte e iniciativas de quem vive do próprio trabalho.
-- Só texto, sem imagem nem arquivo. Todo anúncio passa pela curadoria e vence sozinho, para o mural não envelhecer.
create table if not exists interno.mural (
  id uuid primary key default gen_random_uuid(),
  autor uuid not null references interno.perfis (id) on delete cascade,
  categoria text not null check (categoria in ('cooperativa', 'servico', 'produto', 'arte', 'iniciativa')),
  titulo text not null check (char_length(titulo) between 4 and 100),
  descricao text not null check (char_length(descricao) between 20 and 1200),
  cidade text not null check (char_length(cidade) between 2 and 80),
  uf text not null default '' check (uf ~ '^([A-Z]{2})?$'),
  contato text not null check (char_length(contato) between 4 and 160),
  link text not null default '' check (link = '' or (link ~ '^https://[^[:space:]]+$' and char_length(link) <= 300)),
  status text not null default 'pendente' check (status in ('pendente', 'aprovado', 'recusado')),
  nota text not null default '',
  criado_em timestamptz not null default now(),
  decidido_em timestamptz,
  validade timestamptz
);
create index if not exists mural_no_ar on interno.mural (status, validade);

create table if not exists interno.radio_canais (
  id uuid primary key default gen_random_uuid(),
  nome text not null check (char_length(nome) between 2 and 60),
  descricao text not null default '' check (char_length(descricao) <= 300),
  ordem integer not null default 0
);

create table if not exists interno.radio_faixas (
  id uuid primary key default gen_random_uuid(),
  canal uuid not null references interno.radio_canais (id) on delete cascade,
  titulo text not null check (char_length(titulo) between 1 and 160),
  artista text not null default '' check (char_length(artista) <= 120),
  url text not null check (url ~ '^https?://[^[:space:]]+$' and char_length(url) <= 500),
  duracao integer not null default 0 check (duracao between 0 and 86400),
  ordem integer not null default 0,
  criado_em timestamptz not null default now()
);

create table if not exists interno.audio_progresso (
  usuario uuid not null references interno.perfis (id) on delete cascade,
  faixa uuid not null references interno.radio_faixas (id) on delete cascade,
  segundos integer not null check (segundos between 0 and 86400),
  atualizado_em timestamptz not null default now(),
  primary key (usuario, faixa)
);

create table if not exists interno.configuracoes (
  chave text primary key,
  valor jsonb not null
);
insert into interno.configuracoes (chave, valor) values ('radio', '{"no_ar": false, "ao_vivo": ""}'::jsonb) on conflict do nothing;

-- Contador de pedidos por pessoa (ou por origem, sem guardar o endereço), para frear abuso.
create table if not exists interno.limites (
  chave text not null,
  janela timestamptz not null,
  total integer not null default 0,
  primary key (chave, janela)
);

-- ───────────────────────────── Tabelas da equipe, do reforço e da segurança ─────────────────────────────

alter table interno.perfis add column if not exists visto_em timestamptz not null default now();
alter table interno.topicos add column if not exists tipo text not null default 'conversa' check (tipo in ('conversa', 'duvida'));
alter table interno.topicos add column if not exists aceita uuid;
alter table interno.topicos add column if not exists retido boolean not null default false;
alter table interno.respostas add column if not exists retido boolean not null default false;

-- Papéis e tipos de contribuição acrescentados depois da primeira instalação.
do $$
begin
  alter table interno.papeis drop constraint if exists papeis_papel_check;
  alter table interno.papeis add constraint papeis_papel_check
    check (papel in ('coordenacao', 'vice', 'curadoria', 'educacao', 'revisao', 'traducao', 'jornalismo', 'mentoria', 'design', 'desenvolvimento'));
  alter table interno.candidaturas drop constraint if exists candidaturas_papel_check;
  alter table interno.candidaturas add constraint candidaturas_papel_check
    check (papel in ('curadoria', 'educacao', 'revisao', 'traducao', 'jornalismo', 'mentoria', 'design', 'desenvolvimento'));
  alter table interno.contribuicoes drop constraint if exists contribuicoes_tipo_check;
  alter table interno.contribuicoes add constraint contribuicoes_tipo_check
    check (tipo in ('aula', 'obra', 'artigo', 'checagem', 'debate', 'verbete', 'memorial', 'video', 'frase', 'traducao', 'correcao', 'sugestao', 'questao'));
end $$;

-- Registro de atividades: quem fez o quê no painel. Só a liderança lê. Não guarda endereço de ninguém.
create table if not exists interno.auditoria (
  id bigint generated always as identity primary key,
  quem uuid,
  nome text not null default '',
  acao text not null check (char_length(acao) between 2 and 60),
  alvo text not null default '',
  detalhes jsonb not null default '{}'::jsonb,
  criado_em timestamptz not null default now()
);
create index if not exists auditoria_recentes on interno.auditoria (criado_em desc);

-- Recados do painel para uma pessoa (papel recebido, contribuição decidida, acesso de aparelho novo).
create table if not exists interno.avisos (
  id uuid primary key default gen_random_uuid(),
  para uuid not null references interno.perfis (id) on delete cascade,
  texto text not null check (char_length(texto) between 1 and 500),
  lido boolean not null default false,
  criado_em timestamptz not null default now()
);
create index if not exists avisos_para on interno.avisos (para, lido, criado_em desc);

-- Aparelhos em que cada pessoa já entrou. A marca é um número sorteado no navegador, embaralhado: não identifica a máquina.
create table if not exists interno.aparelhos (
  usuario uuid not null references interno.perfis (id) on delete cascade,
  marca text not null check (marca ~ '^[a-f0-9]{64}$'),
  rotulo text not null default '' check (char_length(rotulo) <= 80),
  primeiro timestamptz not null default now(),
  ultimo timestamptz not null default now(),
  primary key (usuario, marca)
);

-- Ordem de quem assume a liderança se ela ficar sem acesso por mais de 90 dias.
create table if not exists interno.sucessao (
  posicao integer primary key check (posicao between 1 and 10),
  usuario uuid not null unique references interno.perfis (id) on delete cascade
);

-- Pedidos de aula de reforço. O e-mail só aparece para quem assume o pedido e é apagado quando ele é concluído.
create table if not exists interno.reforco (
  id uuid primary key default gen_random_uuid(),
  autor uuid not null references interno.perfis (id) on delete cascade,
  email text not null default '' check (char_length(email) <= 200),
  disciplina text not null check (disciplina ~ '^[a-z0-9-]{2,40}$'),
  assunto text not null check (char_length(assunto) between 4 and 140),
  duvida text not null check (char_length(duvida) between 20 and 3000),
  status text not null default 'aberto' check (status in ('aberto', 'em_atendimento', 'atendido', 'cancelado')),
  mentor uuid references interno.perfis (id) on delete set null,
  nota text not null default '' check (char_length(nota) <= 1000),
  criado_em timestamptz not null default now(),
  atendido_em timestamptz
);
create index if not exists reforco_abertos on interno.reforco (status, criado_em);

-- Conversa interna da equipe, por canal. "pedidos" é onde uma função pede ajuda a outra.
create table if not exists interno.equipe_mensagens (
  id uuid primary key default gen_random_uuid(),
  canal text not null check (canal in ('geral', 'pedidos', 'coordenacao', 'curadoria', 'educacao', 'revisao', 'traducao', 'jornalismo', 'mentoria', 'design', 'desenvolvimento')),
  resposta_a uuid references interno.equipe_mensagens (id) on delete cascade,
  autor uuid references interno.perfis (id) on delete set null,
  para text check (para is null or para in ('coordenacao', 'curadoria', 'educacao', 'revisao', 'traducao', 'jornalismo', 'mentoria', 'design', 'desenvolvimento')),
  corpo text not null check (char_length(corpo) between 1 and 4000),
  resolvido boolean not null default false,
  criado_em timestamptz not null default now()
);
create index if not exists equipe_canal on interno.equipe_mensagens (canal, criado_em desc);

-- Materiais de campanha e de agitação (zines, panfletos, cartazes). Só a liderança publica.
create table if not exists interno.materiais (
  id uuid primary key default gen_random_uuid(),
  tipo text not null check (tipo in ('zine', 'panfleto', 'cartaz', 'banner', 'video', 'texto')),
  titulo text not null check (char_length(titulo) between 3 and 120),
  descricao text not null default '' check (char_length(descricao) <= 600),
  campanha text not null default '' check (char_length(campanha) <= 80),
  url text not null check ((url ~ '^https://[^[:space:]]+$' or url ~ '^/[A-Za-z0-9/._-]+$') and char_length(url) <= 500),
  publicado boolean not null default false,
  ordem integer not null default 0,
  criado_por uuid references interno.perfis (id) on delete set null,
  criado_em timestamptz not null default now()
);

-- Voluntariado: aceite do termo de adesão, horas dedicadas e certificados (versão de teste).
create table if not exists interno.termos_adesao (
  usuario uuid primary key references interno.perfis (id) on delete cascade,
  nome_completo text not null check (char_length(nome_completo) between 5 and 120),
  versao text not null check (char_length(versao) between 1 and 20),
  aceito_em timestamptz not null default now()
);

create table if not exists interno.horas (
  id uuid primary key default gen_random_uuid(),
  usuario uuid not null references interno.perfis (id) on delete cascade,
  dia date not null,
  horas numeric(4, 1) not null check (horas > 0 and horas <= 12),
  atividade text not null check (char_length(atividade) between 5 and 300),
  status text not null default 'pendente' check (status in ('pendente', 'confirmada', 'recusada')),
  conferido_por uuid references interno.perfis (id) on delete set null,
  certificado uuid,
  criado_em timestamptz not null default now()
);
create index if not exists horas_usuario on interno.horas (usuario, dia);

create table if not exists interno.certificados (
  id uuid primary key default gen_random_uuid(),
  codigo text not null unique check (codigo ~ '^[A-Z0-9]{12}$'),
  usuario uuid references interno.perfis (id) on delete set null,
  nome text not null check (char_length(nome) between 5 and 120),
  horas numeric(6, 1) not null check (horas > 0),
  inicio date not null,
  fim date not null,
  atividades text not null check (char_length(atividades) between 10 and 3000),
  testemunhas jsonb not null default '[]'::jsonb,
  status text not null default 'aberto' check (status in ('aberto', 'emitido', 'cancelado')),
  emitido_por uuid references interno.perfis (id) on delete set null,
  emitido_em timestamptz,
  criado_em timestamptz not null default now()
);

-- Palavras que seguram uma mensagem da comunidade para leitura antes de ela aparecer. A curadoria edita a lista no painel.
create table if not exists interno.termos_vetados (termo text primary key check (termo ~ '^[a-z0-9 ]{3,40}$'));

-- Impressão digital de arquivos recusados por serem falsos ou perigosos: o mesmo arquivo não entra de novo.
create table if not exists interno.arquivos_bloqueados (
  sha256 text primary key check (sha256 ~ '^[a-f0-9]{64}$'),
  motivo text not null default '' check (char_length(motivo) <= 200),
  criado_em timestamptz not null default now()
);

insert into interno.configuracoes (chave, valor) values
  ('seguranca', '{"exigir_2fa": false}'::jsonb),
  ('abertura', '{"definido": false}'::jsonb),
  ('equipe', '{"sala": ""}'::jsonb)
on conflict do nothing;

-- Lista inicial do filtro da comunidade, posta uma única vez (depois disso vale o que a curadoria decidir).
do $$
begin
  if not exists (select 1 from interno.configuracoes where chave = 'filtro') then
    insert into interno.termos_vetados (termo) values
      ('viado'), ('viadinho'), ('boiola'), ('baitola'), ('traveco'), ('sapatao'), ('retardado'), ('retardada'), ('mongoloide'), ('aleijado'),
      ('vagabunda'), ('vadia'), ('puta'), ('filho da puta'), ('fdp'), ('arrombado'), ('arrombada'), ('cuzao'), ('vai se foder'), ('vsf'), ('vtnc'),
      ('tomar no cu'), ('lixo humano'), ('preto imundo'), ('negro imundo'), ('macaco imundo'), ('volta pra senzala'), ('judeu imundo'),
      ('heil hitler'), ('sieg heil'), ('poder branco'), ('white power'), ('morte aos gays'), ('morte aos negros'), ('morte aos judeus')
    on conflict do nothing;
    insert into interno.configuracoes (chave, valor) values ('filtro', '{"semeado": true}'::jsonb) on conflict do nothing;
  end if;
end $$;

-- Trancadas duas vezes: sem permissões e com segurança por linha ligada (sem nenhuma regra = ninguém passa).
do $$
declare t record;
begin
  for t in select tablename from pg_tables where schemaname = 'interno' loop
    execute format('alter table interno.%I enable row level security', t.tablename);
    execute format('revoke all on interno.%I from public', t.tablename);
  end loop;
end $$;

-- ───────────────────────────── Funções internas ─────────────────────────────

create or replace function interno.claims() returns jsonb language sql stable as $$
  select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb
$$;

create or replace function interno.servico() returns boolean language sql stable as $$
  select interno.claims() ->> 'role' = 'service_role'
$$;

create or replace function interno.erro(codigo text) returns void language plpgsql as $$
begin
  raise exception '%', codigo using errcode = 'P0001';
end $$;

/** Quem chama, exigindo conta ativa. */
create or replace function interno.eu() returns uuid language plpgsql stable security definer set search_path = interno, pg_temp as $$
declare v uuid := auth.uid();
begin
  if v is null then perform interno.erro('entre_primeiro'); end if;
  if exists (select 1 from perfis where id = v and suspenso) then perform interno.erro('conta_suspensa'); end if;
  return v;
end $$;

/** A sessão passou pelo segundo fator (código do aplicativo autenticador)? */
create or replace function interno.aal2() returns boolean language sql stable as $$
  select coalesce(interno.claims() ->> 'aal', '') = 'aal2'
$$;

create or replace function interno.exige_2fa() returns boolean language sql stable security definer set search_path = interno, pg_temp as $$
  select coalesce((select (valor ->> 'exigir_2fa')::boolean from configuracoes where chave = 'seguranca'), false)
$$;

/**
 * A pessoa tem este papel? Com a exigência de segundo fator ligada, liderança, vice-liderança e curadoria
 * só valem em sessão confirmada pelo aplicativo autenticador: senha ou link roubado, sozinhos, não abrem nada.
 */
create or replace function interno.tem(p_papel text, p_disciplina text default null) returns boolean
language sql stable security definer set search_path = interno, pg_temp as $$
  select auth.uid() is not null
    and (p_papel not in ('coordenacao', 'vice', 'curadoria') or not interno.exige_2fa() or interno.aal2())
    and exists (
      select 1 from papeis p join perfis f on f.id = p.usuario
      where p.usuario = auth.uid() and not f.suspenso and p.papel = p_papel
        and (p_disciplina is null or p.disciplina is null or p.disciplina = p_disciplina)
    )
$$;

/** Liderança comunitária: uma pessoa, com a palavra final. */
create or replace function interno.lider() returns boolean language sql stable as $$ select interno.tem('coordenacao') $$;
/** Liderança ou vice-liderança: tudo o que a liderança faz, menos mexer na própria liderança. */
create or replace function interno.coord() returns boolean language sql stable as $$ select interno.tem('coordenacao') or interno.tem('vice') $$;
create or replace function interno.curador() returns boolean language sql stable as $$ select interno.tem('coordenacao') or interno.tem('curadoria') $$;
create or replace function interno.voluntario() returns boolean language sql stable security definer set search_path = interno, pg_temp as $$
  select auth.uid() is not null and exists (select 1 from papeis p join perfis f on f.id = p.usuario where p.usuario = auth.uid() and not f.suspenso)
$$;
/** Quem pode cuidar da comunidade: coordenação, curadoria e educadores. */
create or replace function interno.cuida() returns boolean language sql stable as $$ select interno.curador() or interno.tem('educacao') $$;
/** Quem pode atender um pedido de reforço desta disciplina. */
create or replace function interno.mentor(p_disciplina text) returns boolean language sql stable as $$
  select interno.curador() or interno.tem('mentoria', p_disciplina) or interno.tem('educacao', p_disciplina)
$$;
/** Quem pode enviar imagens e arquivos pelo painel: só gente da equipe que escreve ou diagrama. */
create or replace function interno.envia() returns boolean language sql stable as $$
  select interno.curador() or interno.tem('educacao') or interno.tem('jornalismo') or interno.tem('design')
$$;

/** Anota no registro de atividades. Só vale para o que deu certo: se a função falhar depois, a anotação some junto. */
create or replace function interno.registrar(p_acao text, p_alvo text default '', p_detalhes jsonb default '{}'::jsonb) returns void
language plpgsql security definer set search_path = interno, pg_temp as $$
begin
  insert into auditoria (quem, nome, acao, alvo, detalhes)
  values (auth.uid(), coalesce((select nome from perfis where id = auth.uid()), ''), left(p_acao, 60), left(coalesce(p_alvo, ''), 300), coalesce(p_detalhes, '{}'::jsonb));
  if random() < 0.01 then delete from auditoria where criado_em < now() - interval '400 days'; end if;
end $$;

create or replace function interno.avisar(p_para uuid, p_texto text) returns void language plpgsql security definer set search_path = interno, pg_temp as $$
begin
  if p_para is null or not exists (select 1 from perfis where id = p_para) then return; end if;
  insert into avisos (para, texto) values (p_para, left(p_texto, 500));
  if random() < 0.02 then delete from avisos where criado_em < now() - interval '120 days'; end if;
end $$;

create or replace function interno.avisar_lideranca(p_texto text, p_menos uuid default null) returns void language plpgsql security definer set search_path = interno, pg_temp as $$
begin
  insert into avisos (para, texto)
  select distinct p.usuario, left(p_texto, 500) from papeis p where p.papel in ('coordenacao', 'vice') and p.usuario is distinct from p_menos;
end $$;

/** Texto sem acento, sem pontuação e em minúsculas, para comparar com a lista do filtro. */
create or replace function interno.normal(p text) returns text language sql immutable as $$
  select btrim(regexp_replace(translate(lower(coalesce(p, '')), 'áàâãäéèêëíìîïóòôõöúùûüçñ', 'aaaaaeeeeiiiiooooouuuucn'), '[^a-z0-9]+', ' ', 'g'))
$$;

create or replace function interno.vetado(p text) returns boolean language sql stable security definer set search_path = interno, pg_temp as $$
  select exists (select 1 from termos_vetados t where position(' ' || t.termo || ' ' in ' ' || interno.normal(p) || ' ') > 0)
$$;

/**
 * Política da aranha: se ninguém da liderança entra há mais de 90 dias, ela passa para a primeira pessoa
 * da ordem de sucessão que esteve por aqui no último mês. Quem saiu continua na equipe, como vice-liderança.
 */
create or replace function interno.sucessao_conferir() returns void language plpgsql security definer set search_path = interno, pg_temp as $$
declare v_novo uuid; r record;
begin
  if not exists (select 1 from sucessao) then return; end if;
  if exists (select 1 from papeis p join perfis f on f.id = p.usuario
             where p.papel = 'coordenacao' and not f.suspenso and f.visto_em > now() - interval '90 days') then return; end if;
  select s.usuario into v_novo from sucessao s join perfis f on f.id = s.usuario
  where not f.suspenso and f.visto_em > now() - interval '30 days'
    and not exists (select 1 from papeis p where p.usuario = s.usuario and p.papel = 'coordenacao')
  order by s.posicao limit 1;
  if v_novo is null then return; end if;
  for r in select id, usuario from papeis where papel = 'coordenacao' loop
    delete from papeis where id = r.id;
    insert into papeis (usuario, papel) values (r.usuario, 'vice') on conflict do nothing;
  end loop;
  delete from papeis where usuario = v_novo and papel = 'vice';
  insert into papeis (usuario, papel) values (v_novo, 'coordenacao') on conflict do nothing;
  delete from sucessao where usuario = v_novo;
  insert into auditoria (quem, nome, acao, alvo, detalhes)
  values (null, 'sistema', 'sucessao_automatica', v_novo::text, jsonb_build_object('motivo', 'liderança sem acesso há mais de 90 dias'));
  perform interno.avisar(v_novo, 'A liderança do instituto passou para você: a pessoa anterior ficou mais de 90 dias sem entrar. Ela continua na equipe, como vice-liderança.');
end $$;

/** Origem do pedido, embaralhada: serve para contar sem guardar o endereço de ninguém. */
create or replace function interno.origem() returns text language sql stable as $$
  select md5('lucia:' || coalesce(
    split_part(nullif(current_setting('request.headers', true), '')::json ->> 'x-forwarded-for', ',', 1),
    'local'))
$$;

create or replace function interno.limite(p_acao text, p_maximo integer, p_minutos integer) returns void
language plpgsql security definer set search_path = interno, pg_temp as $$
declare
  v_chave text := p_acao || ':' || coalesce(auth.uid()::text, interno.origem());
  v_janela timestamptz := to_timestamp(floor(extract(epoch from now()) / (p_minutos * 60)) * p_minutos * 60);
  v_total integer;
begin
  insert into limites (chave, janela, total) values (v_chave, v_janela, 1)
  on conflict (chave, janela) do update set total = limites.total + 1
  returning total into v_total;
  if random() < 0.02 then delete from limites where janela < now() - interval '2 days'; end if;
  if v_total > p_maximo then perform interno.erro('muitos_pedidos'); end if;
end $$;

/** Texto limpo e dentro do tamanho; devolve erro com o nome do campo quando não serve. */
create or replace function interno.txt(p_valor text, p_campo text, p_min integer, p_max integer) returns text language plpgsql immutable as $$
declare v text := btrim(regexp_replace(coalesce(p_valor, ''), '[\u0001-\u0008\u000B\u000C\u000E-\u001F]', '', 'g'));
begin
  if char_length(v) < p_min or char_length(v) > p_max then
    raise exception 'invalido:%', p_campo using errcode = 'P0001';
  end if;
  return v;
end $$;

create or replace function interno.disciplina_ok(p text) returns text language plpgsql immutable as $$
begin
  if p is null or p = '' then return null; end if;
  if p !~ '^[a-z0-9-]{2,40}$' then raise exception 'invalido:disciplina' using errcode = 'P0001'; end if;
  return p;
end $$;

/** Confere a lista de fontes: [{titulo, autor, url, ano}]. */
create or replace function interno.fontes_ok(p jsonb, p_obrigatoria boolean) returns jsonb language plpgsql immutable as $$
declare
  v jsonb := coalesce(p, '[]'::jsonb);
  f jsonb;
  saida jsonb := '[]'::jsonb;
begin
  if jsonb_typeof(v) <> 'array' or jsonb_array_length(v) > 20 then raise exception 'invalido:fontes' using errcode = 'P0001'; end if;
  for f in select * from jsonb_array_elements(v) loop
    if coalesce(btrim(f ->> 'titulo'), '') = '' then continue; end if;
    if coalesce(f ->> 'url', '') <> '' and ((f ->> 'url') !~ '^https?://[^[:space:]]+$' or char_length(f ->> 'url') > 500) then
      raise exception 'invalido:fontes' using errcode = 'P0001';
    end if;
    saida := saida || jsonb_build_array(jsonb_strip_nulls(jsonb_build_object(
      'titulo', left(btrim(f ->> 'titulo'), 300),
      'autor', nullif(left(btrim(coalesce(f ->> 'autor', '')), 160), ''),
      'url', nullif(btrim(coalesce(f ->> 'url', '')), ''),
      'ano', nullif(left(btrim(coalesce(f ->> 'ano', '')), 20), ''))));
  end loop;
  if p_obrigatoria and jsonb_array_length(saida) = 0 then raise exception 'falta_fonte' using errcode = 'P0001'; end if;
  return saida;
end $$;

-- ───────────────────────────── Conta ─────────────────────────────

/** Perfil e papéis de quem está logado; cria o perfil na primeira visita. Sem login, devolve null. */
create or replace function public.eu() returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare
  v uuid := auth.uid();
  v_nome text;
begin
  if v is null then return null; end if;
  if not exists (select 1 from perfis where id = v) then
    if not exists (select 1 from auth.users u where u.id = v) then return null; end if;
    -- O nome público nasce como um codinome sorteado: nada do e-mail nem da conta de origem aparece no site.
    -- A pessoa troca quando quiser, no painel.
    v_nome := 'Estudante ' || (10000 + floor(random() * 90000))::int;
    insert into perfis (id, nome) values (v, v_nome) on conflict do nothing;
  end if;
  update perfis set visto_em = now() where id = v and visto_em < now() - interval '1 hour';
  perform interno.sucessao_conferir();
  return (
    select jsonb_build_object(
      'id', f.id, 'nome', f.nome, 'bio', f.bio, 'suspenso', f.suspenso,
      'papeis', coalesce((select jsonb_agg(jsonb_build_object('id', p.id, 'papel', p.papel, 'disciplina', p.disciplina) order by p.papel, p.disciplina)
                          from papeis p where p.usuario = f.id), '[]'::jsonb),
      'segundo_fator', interno.aal2(),
      'exige_segundo_fator', interno.exige_2fa() and exists (select 1 from papeis p where p.usuario = f.id and p.papel in ('coordenacao', 'vice', 'curadoria')),
      'avisos', (select count(*) from avisos a where a.para = f.id and not a.lido))
    from perfis f where f.id = v);
end $$;

create or replace function public.perfil_salvar(p_nome text, p_bio text) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu();
begin
  perform interno.limite('perfil', 20, 60);
  update perfis set nome = interno.txt(p_nome, 'nome', 2, 60), bio = interno.txt(p_bio, 'bio', 0, 500) where id = v;
  return public.eu();
end $$;

/** Apaga a conta e tudo o que é pessoal. O que já foi publicado continua, sem ligação com a pessoa. */
create or replace function public.conta_apagar() returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := auth.uid();
begin
  if v is null then perform interno.erro('entre_primeiro'); end if;
  if interno.coord() and (select count(*) from papeis where papel = 'coordenacao') <= 1 then perform interno.erro('ultima_coordenacao'); end if;
  delete from perfis where id = v;
  delete from auth.users where id = v;
  return jsonb_build_object('ok', true);
end $$;

-- ───────────────────────────── Voluntariado ─────────────────────────────

create or replace function public.candidatar(p_papel text, p_disciplina text, p_mensagem text) returns jsonb
language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); v_id uuid;
begin
  perform interno.limite('candidatar', 5, 1440);
  if p_papel not in ('curadoria', 'educacao', 'revisao', 'traducao', 'jornalismo', 'mentoria', 'design', 'desenvolvimento') then perform interno.erro('invalido:papel'); end if;
  if p_papel = 'educacao' and coalesce(p_disciplina, '') = '' then perform interno.erro('invalido:disciplina'); end if;
  if exists (select 1 from candidaturas where usuario = v and papel = p_papel and coalesce(disciplina, '') = coalesce(p_disciplina, '') and status = 'pendente') then
    perform interno.erro('ja_pediu');
  end if;
  insert into candidaturas (usuario, papel, disciplina, mensagem)
  values (v, p_papel, interno.disciplina_ok(p_disciplina), interno.txt(p_mensagem, 'mensagem', 20, 2000))
  returning id into v_id;
  return jsonb_build_object('id', v_id);
end $$;

create or replace function public.candidaturas_minhas() returns jsonb language sql security definer set search_path = interno, pg_temp as $$
  select coalesce(jsonb_agg(jsonb_build_object('id', c.id, 'papel', c.papel, 'disciplina', c.disciplina, 'status', c.status, 'criado_em', c.criado_em) order by c.criado_em desc), '[]'::jsonb)
  from candidaturas c where c.usuario = auth.uid()
$$;

create or replace function public.candidaturas_listar() returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
begin
  if not interno.coord() then perform interno.erro('sem_permissao'); end if;
  return (
    select coalesce(jsonb_agg(jsonb_build_object(
      'id', c.id, 'papel', c.papel, 'disciplina', c.disciplina, 'mensagem', c.mensagem, 'status', c.status, 'criado_em', c.criado_em,
      'usuario', c.usuario, 'nome', f.nome, 'email', u.email) order by (c.status = 'pendente') desc, c.criado_em desc), '[]'::jsonb)
    from candidaturas c join perfis f on f.id = c.usuario join auth.users u on u.id = c.usuario);
end $$;

create or replace function public.candidatura_decidir(p_id uuid, p_aceitar boolean) returns jsonb
language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); c candidaturas;
begin
  if not interno.coord() then perform interno.erro('sem_permissao'); end if;
  select * into c from candidaturas where id = p_id and status = 'pendente' for update;
  if not found then perform interno.erro('nao_encontrado'); end if;
  update candidaturas set status = case when p_aceitar then 'aceita' else 'recusada' end, decidido_por = v, decidido_em = now() where id = p_id;
  if p_aceitar then
    insert into papeis (usuario, papel, disciplina, concedido_por) values (c.usuario, c.papel, c.disciplina, v) on conflict do nothing;
    perform interno.avisar(c.usuario, 'Seu pedido de voluntariado foi aceito. As ferramentas do seu papel já aparecem no painel.');
  else
    perform interno.avisar(c.usuario, 'Seu pedido de voluntariado não foi aceito desta vez. Você pode continuar contribuindo e pedir de novo mais adiante.');
  end if;
  perform interno.registrar(case when p_aceitar then 'pedido_aceito' else 'pedido_recusado' end, c.usuario::text, jsonb_build_object('papel', c.papel, 'disciplina', c.disciplina));
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.voluntarios_listar() returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
begin
  if not interno.coord() then perform interno.erro('sem_permissao'); end if;
  return (
    select coalesce(jsonb_agg(jsonb_build_object(
      'id', f.id, 'nome', f.nome, 'email', u.email, 'suspenso', f.suspenso, 'criado_em', f.criado_em, 'visto_em', f.visto_em,
      'papeis', coalesce((select jsonb_agg(jsonb_build_object('id', p.id, 'papel', p.papel, 'disciplina', p.disciplina) order by p.papel, p.disciplina) from papeis p where p.usuario = f.id), '[]'::jsonb))
      order by f.nome), '[]'::jsonb)
    from perfis f join auth.users u on u.id = f.id);
end $$;

/**
 * Confiar um papel. Liderança e vice-liderança confiam os papéis de trabalho; só a liderança nomeia a vice-liderança.
 * A liderança em si não se concede por aqui: ela muda de mãos por lideranca_passar ou pela ordem de sucessão.
 */
create or replace function public.papel_conceder(p_usuario uuid, p_papel text, p_disciplina text) returns jsonb
language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu();
begin
  if not interno.coord() then perform interno.erro('sem_permissao'); end if;
  if p_papel not in ('vice', 'curadoria', 'educacao', 'revisao', 'traducao', 'jornalismo', 'mentoria', 'design', 'desenvolvimento') then perform interno.erro('invalido:papel'); end if;
  if p_papel = 'vice' and not interno.lider() then perform interno.erro('sem_permissao'); end if;
  if p_papel = 'educacao' and coalesce(p_disciplina, '') = '' then perform interno.erro('invalido:disciplina'); end if;
  if not exists (select 1 from perfis where id = p_usuario) then perform interno.erro('nao_encontrado'); end if;
  insert into papeis (usuario, papel, disciplina, concedido_por)
  values (p_usuario, p_papel, case when p_papel = 'vice' then null else interno.disciplina_ok(p_disciplina) end, v) on conflict do nothing;
  perform interno.registrar('papel_confiado', p_usuario::text, jsonb_build_object('papel', p_papel, 'disciplina', p_disciplina));
  perform interno.avisar(p_usuario, 'Você recebeu um novo papel no instituto. Abra o painel para ver as ferramentas dele.');
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.papel_remover(p_id uuid) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare r papeis;
begin
  perform interno.eu();
  if not interno.coord() then perform interno.erro('sem_permissao'); end if;
  select * into r from papeis where id = p_id;
  if not found then perform interno.erro('nao_encontrado'); end if;
  -- A vice-liderança não mexe na liderança nem em outra vice-liderança.
  if r.papel in ('coordenacao', 'vice') and not interno.lider() then perform interno.erro('sem_permissao'); end if;
  if r.papel = 'coordenacao' and (select count(*) from papeis where papel = 'coordenacao') <= 1 then perform interno.erro('ultima_coordenacao'); end if;
  delete from papeis where id = p_id;
  perform interno.registrar('papel_retirado', r.usuario::text, jsonb_build_object('papel', r.papel, 'disciplina', r.disciplina));
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.usuario_suspender(p_usuario uuid, p_suspenso boolean) returns jsonb
language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu();
begin
  if not interno.coord() then perform interno.erro('sem_permissao'); end if;
  if p_usuario = v then perform interno.erro('invalido:usuario'); end if;
  -- Ninguém suspende a liderança pelo painel, e só ela suspende a vice-liderança.
  if exists (select 1 from papeis where usuario = p_usuario and papel = 'coordenacao') then perform interno.erro('sem_permissao'); end if;
  if exists (select 1 from papeis where usuario = p_usuario and papel = 'vice') and not interno.lider() then perform interno.erro('sem_permissao'); end if;
  update perfis set suspenso = p_suspenso where id = p_usuario;
  if not found then perform interno.erro('nao_encontrado'); end if;
  perform interno.registrar(case when p_suspenso then 'conta_suspensa' else 'conta_reativada' end, p_usuario::text);
  return jsonb_build_object('ok', true);
end $$;

/** A liderança entrega o posto a outra pessoa e passa a ser vice-liderança. */
create or replace function public.lideranca_passar(p_usuario uuid) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu();
begin
  if not interno.lider() then perform interno.erro('sem_permissao'); end if;
  if p_usuario = v or not exists (select 1 from perfis where id = p_usuario and not suspenso) then perform interno.erro('nao_encontrado'); end if;
  delete from papeis where usuario = v and papel = 'coordenacao';
  insert into papeis (usuario, papel, concedido_por) values (v, 'vice', v) on conflict do nothing;
  delete from papeis where usuario = p_usuario and papel = 'vice';
  insert into papeis (usuario, papel, concedido_por) values (p_usuario, 'coordenacao', v) on conflict do nothing;
  delete from sucessao where usuario = p_usuario;
  perform interno.registrar('lideranca_passada', p_usuario::text);
  perform interno.avisar(p_usuario, 'A liderança do instituto foi passada para você.');
  return jsonb_build_object('ok', true);
end $$;

/** Ordem de sucessão: quem assume, e em que ordem, se a liderança ficar mais de 90 dias sem entrar. */
create or replace function public.sucessao_definir(p_usuarios uuid[]) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); v_lista uuid[] := coalesce(p_usuarios, '{}');
begin
  if not interno.lider() then perform interno.erro('sem_permissao'); end if;
  if coalesce(array_length(v_lista, 1), 0) > 10 then perform interno.erro('invalido:usuarios'); end if;
  if (select count(distinct x) from unnest(v_lista) x) <> coalesce(array_length(v_lista, 1), 0) then perform interno.erro('invalido:usuarios'); end if;
  if exists (select 1 from unnest(v_lista) x where x = v or not exists (select 1 from perfis f where f.id = x and not f.suspenso)) then perform interno.erro('invalido:usuarios'); end if;
  delete from sucessao;
  insert into sucessao (posicao, usuario) select n::int, x from unnest(v_lista) with ordinality as t(x, n);
  perform interno.registrar('sucessao_definida', '', jsonb_build_object('ordem', to_jsonb(v_lista)));
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.sucessao_ver() returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
begin
  perform interno.eu();
  if not interno.coord() then perform interno.erro('sem_permissao'); end if;
  return jsonb_build_object(
    'lideranca', coalesce((select jsonb_agg(jsonb_build_object('id', f.id, 'nome', f.nome, 'visto_em', f.visto_em) order by f.nome)
                           from papeis p join perfis f on f.id = p.usuario where p.papel = 'coordenacao'), '[]'::jsonb),
    'ordem', coalesce((select jsonb_agg(jsonb_build_object('id', f.id, 'nome', f.nome, 'visto_em', f.visto_em) order by s.posicao)
                       from sucessao s join perfis f on f.id = s.usuario), '[]'::jsonb));
end $$;

-- ───────────────────────────── Segurança das contas ─────────────────────────────

create or replace function public.seguranca_ver() returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v_sem jsonb := null;
begin
  perform interno.eu();
  if not interno.coord() then perform interno.erro('sem_permissao'); end if;
  -- Quem tem papel sensível e ainda não cadastrou o aplicativo autenticador (só onde o serviço de contas guarda essa informação).
  if to_regclass('auth.mfa_factors') is not null then
    execute $q$
      select coalesce(jsonb_agg(distinct f.nome), '[]'::jsonb) from interno.papeis p join interno.perfis f on f.id = p.usuario
      where p.papel in ('coordenacao', 'vice', 'curadoria')
        and not exists (select 1 from auth.mfa_factors m where m.user_id = p.usuario and m.status = 'verified')
    $q$ into v_sem;
  end if;
  return jsonb_build_object('exigir_2fa', interno.exige_2fa(), 'segundo_fator', interno.aal2(), 'sem_segundo_fator', v_sem);
end $$;

/** Liga ou desliga a exigência de segundo fator. Só liga quem já está com o próprio segundo fator confirmado: ninguém se tranca para fora. */
create or replace function public.seguranca_configurar(p_exigir_2fa boolean) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
begin
  perform interno.eu();
  if not interno.lider() then perform interno.erro('sem_permissao'); end if;
  if coalesce(p_exigir_2fa, false) and not interno.aal2() then perform interno.erro('confirme_segundo_fator'); end if;
  insert into configuracoes (chave, valor) values ('seguranca', jsonb_build_object('exigir_2fa', coalesce(p_exigir_2fa, false)))
  on conflict (chave) do update set valor = excluded.valor;
  perform interno.registrar('seguranca_configurada', '', jsonb_build_object('exigir_2fa', coalesce(p_exigir_2fa, false)));
  return jsonb_build_object('exigir_2fa', coalesce(p_exigir_2fa, false));
end $$;

/**
 * Chamada pelo site logo depois da entrada. Se a conta de alguém da equipe aparece em um aparelho que
 * nunca usou, a pessoa e a liderança recebem um aviso no painel.
 */
create or replace function public.acesso_registrar(p_marca text, p_rotulo text) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); v_rotulo text := interno.txt(p_rotulo, 'rotulo', 0, 80); v_nome text; v_outros integer;
begin
  perform interno.limite('acesso', 30, 60);
  if coalesce(p_marca, '') !~ '^[a-f0-9]{64}$' then perform interno.erro('invalido:marca'); end if;
  update aparelhos set ultimo = now(), rotulo = v_rotulo where usuario = v and marca = p_marca;
  if found then return jsonb_build_object('novo', false); end if;
  select count(*) into v_outros from aparelhos where usuario = v;
  if v_outros >= 20 then delete from aparelhos where usuario = v and marca = (select marca from aparelhos where usuario = v order by ultimo limit 1); end if;
  insert into aparelhos (usuario, marca, rotulo) values (v, p_marca, v_rotulo);
  if v_outros > 0 and exists (select 1 from papeis where usuario = v) then
    select nome into v_nome from perfis where id = v;
    perform interno.avisar(v, 'Sua conta foi aberta em um aparelho novo (' || coalesce(nullif(v_rotulo, ''), 'navegador desconhecido') || '). Se não foi você, avise a liderança agora e saia de todos os aparelhos.');
    perform interno.avisar_lideranca('A conta de ' || v_nome || ' foi aberta em um aparelho novo (' || coalesce(nullif(v_rotulo, ''), 'navegador desconhecido') || ').', v);
    perform interno.registrar('aparelho_novo', v::text, jsonb_build_object('rotulo', v_rotulo));
  end if;
  return jsonb_build_object('novo', v_outros > 0);
end $$;

create or replace function public.aparelhos_meus() returns jsonb language sql stable security definer set search_path = interno, pg_temp as $$
  select coalesce(jsonb_agg(jsonb_build_object('marca', a.marca, 'rotulo', a.rotulo, 'primeiro', a.primeiro, 'ultimo', a.ultimo) order by a.ultimo desc), '[]'::jsonb)
  from aparelhos a where a.usuario = auth.uid() and auth.uid() is not null
$$;

create or replace function public.aparelho_esquecer(p_marca text) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu();
begin
  delete from aparelhos where usuario = v and marca = p_marca;
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.avisos_meus() returns jsonb language sql stable security definer set search_path = interno, pg_temp as $$
  select coalesce(jsonb_agg(jsonb_build_object('id', a.id, 'texto', a.texto, 'lido', a.lido, 'criado_em', a.criado_em) order by a.criado_em desc), '[]'::jsonb)
  from (select * from avisos where para = auth.uid() and auth.uid() is not null order by criado_em desc limit 40) a
$$;

/** Marca um recado como lido; sem id, marca todos. */
create or replace function public.aviso_ler(p_id uuid default null) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu();
begin
  update avisos set lido = true where para = v and (p_id is null or id = p_id);
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.auditoria_listar(p_pagina integer default 0, p_acao text default null) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
begin
  perform interno.eu();
  if not interno.coord() then perform interno.erro('sem_permissao'); end if;
  return (
    select coalesce(jsonb_agg(jsonb_build_object('id', a.id, 'nome', a.nome, 'acao', a.acao, 'alvo', a.alvo, 'detalhes', a.detalhes, 'criado_em', a.criado_em,
      'alvo_nome', coalesce((select f.nome from perfis f where f.id::text = a.alvo), '')) order by a.id desc), '[]'::jsonb)
    from (select * from auditoria where coalesce(p_acao, '') = '' or acao = p_acao order by id desc limit 100 offset greatest(coalesce(p_pagina, 0), 0) * 100) a);
end $$;

/**
 * Funções-isca. O site nunca chama nenhuma delas: quem chama está vasculhando o banco atrás de dados.
 * A tentativa fica registrada, a liderança é avisada e, se for uma conta comum, ela é suspensa na hora.
 */
create or replace function interno.armadilha(p_qual text) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := auth.uid();
begin
  perform interno.limite('armadilha', 5, 60);
  insert into auditoria (quem, nome, acao, alvo, detalhes)
  values (v, coalesce((select nome from perfis where id = v), ''), 'armadilha', p_qual, jsonb_build_object('origem', interno.origem()));
  if v is not null and not exists (select 1 from papeis where usuario = v) then update perfis set suspenso = true where id = v; end if;
  perform interno.avisar_lideranca('Alguém chamou uma função-isca do banco (' || p_qual || '): é sinal de tentativa de vasculhar dados. Veja o registro de atividades.');
  return '[]'::jsonb;
end $$;
create or replace function public.exportar_usuarios() returns jsonb language sql security definer set search_path = interno, pg_temp as $$ select interno.armadilha('exportar_usuarios') $$;
create or replace function public.admin_senhas() returns jsonb language sql security definer set search_path = interno, pg_temp as $$ select interno.armadilha('admin_senhas') $$;
create or replace function public.chaves_api() returns jsonb language sql security definer set search_path = interno, pg_temp as $$ select interno.armadilha('chaves_api') $$;

/** Quem faz o site: nome escolhido e papéis. Não mostra e-mail nem nada além disso. */
create or replace function public.equipe() returns jsonb language sql stable security definer set search_path = interno, pg_temp as $$
  select coalesce(jsonb_agg(jsonb_build_object('nome', f.nome, 'papel', p.papel, 'disciplina', p.disciplina) order by p.papel, f.nome), '[]'::jsonb)
  from papeis p join perfis f on f.id = p.usuario where not f.suspenso
$$;

/** Só pelo SQL Editor (ou com a chave de serviço): dá o papel de coordenação a quem já entrou no site. */
create or replace function public.promover_coordenacao(p_email text) returns text language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid;
begin
  if auth.uid() is not null or (interno.claims() ->> 'role') in ('anon', 'authenticated') then
    raise exception 'sem_permissao' using errcode = 'P0001';
  end if;
  select id into v from auth.users where lower(email) = lower(btrim(p_email));
  if v is null then return 'Ninguém entrou no site com esse e-mail ainda. Entre uma vez e rode de novo.'; end if;
  insert into perfis (id, nome) values (v, 'Coordenação') on conflict do nothing;
  delete from papeis where usuario = v and papel = 'vice';
  insert into papeis (usuario, papel) values (v, 'coordenacao') on conflict do nothing;
  insert into auditoria (quem, nome, acao, alvo) values (null, 'banco', 'lideranca_promovida', v::text);
  return 'Pronto: ' || p_email || ' agora é a liderança.';
end $$;

-- ───────────────────────────── Contribuições ─────────────────────────────

/**
 * Porta única de envio, aberta a qualquer pessoa. Tudo entra como "pendente" e só vai ao ar
 * depois de aprovado pela curadoria. Material de ensino sem fonte é recusado na entrada.
 */
create or replace function public.contribuir(p jsonb) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare
  v uuid := auth.uid();
  v_tipo text := coalesce(p ->> 'tipo', '');
  v_disc text := interno.disciplina_ok(p ->> 'disciplina');
  v_dados jsonb := coalesce(p -> 'dados', '{}'::jsonb);
  v_como text := 'publico';
  v_nome text;
  v_id uuid;
begin
  -- Campo-isca: gente não vê, robô preenche. Finge que deu certo e não guarda nada.
  if coalesce(p ->> 'site', '') <> '' then return jsonb_build_object('id', gen_random_uuid()); end if;
  if v is not null then perform interno.eu(); end if;
  perform interno.limite('contribuir', case when v is null then 6 else 40 end, 60);

  if v_tipo not in ('aula', 'obra', 'artigo', 'checagem', 'debate', 'verbete', 'memorial', 'video', 'frase', 'traducao', 'correcao', 'sugestao', 'questao') then
    perform interno.erro('invalido:tipo');
  end if;
  if jsonb_typeof(v_dados) <> 'object' or pg_column_size(v_dados) > 20000 then perform interno.erro('invalido:dados'); end if;
  -- Questão para a prova de uma aula: de duas a seis alternativas, uma certa, e a aula a que pertence.
  if v_tipo = 'questao' then
    if jsonb_typeof(v_dados -> 'opcoes') is distinct from 'array' or jsonb_array_length(v_dados -> 'opcoes') not between 2 and 6
       or exists (select 1 from jsonb_array_elements(v_dados -> 'opcoes') o where jsonb_typeof(o) <> 'string' or char_length(btrim(o #>> '{}')) not between 1 and 300) then
      perform interno.erro('invalido:opcoes');
    end if;
    if coalesce(v_dados ->> 'correta', '') !~ '^[0-5]$' or (v_dados ->> 'correta')::int >= jsonb_array_length(v_dados -> 'opcoes') then perform interno.erro('invalido:correta'); end if;
    if coalesce(p ->> 'alvo', '') !~ '^[a-z0-9-]{2,80}/[a-z0-9-]{2,80}$' then perform interno.erro('invalido:alvo'); end if;
  end if;
  -- O jornal é escrito por quem tem esse papel.
  if v_tipo = 'artigo' and not (interno.tem('jornalismo') or interno.coord()) then perform interno.erro('sem_permissao'); end if;
  if v_tipo = 'traducao' and v is null then perform interno.erro('entre_primeiro'); end if;

  if v is not null then
    if v_tipo = 'artigo' then v_como := 'jornalismo';
    elsif v_tipo = 'traducao' and interno.tem('traducao') then v_como := 'traducao';
    elsif v_disc is not null and exists (select 1 from papeis where usuario = v and papel = 'educacao' and disciplina = v_disc) then v_como := 'educacao';
    elsif interno.curador() then v_como := 'curadoria';
    elsif interno.tem('revisao') then v_como := 'revisao';
    end if;
    select nome into v_nome from perfis where id = v;
  end if;

  insert into contribuicoes (tipo, disciplina, titulo, corpo, dados, fontes, alvo, autor, nome_autor, como)
  values (
    v_tipo, v_disc,
    interno.txt(p ->> 'titulo', 'titulo', 3, 160),
    interno.txt(p ->> 'corpo', 'corpo', case when v_tipo in ('obra', 'video', 'frase', 'debate', 'verbete') then 0 else 20 end, 60000),
    v_dados,
    interno.fontes_ok(p -> 'fontes', v_tipo in ('aula', 'artigo', 'checagem', 'debate', 'verbete', 'memorial', 'frase')),
    nullif(interno.txt(p ->> 'alvo', 'alvo', 0, 300), ''),
    v,
    -- Quem tem conta assina com o nome do perfil; quem não tem pode dizer como quer ser creditado.
    coalesce(v_nome, interno.txt(p ->> 'nome', 'nome', 0, 80)),
    v_como)
  returning id into v_id;
  return jsonb_build_object('id', v_id);
end $$;

create or replace function interno.contribuicao_json(c interno.contribuicoes, p_completa boolean) returns jsonb
language sql stable security definer set search_path = interno, pg_temp as $$
  select jsonb_build_object(
    'id', c.id, 'tipo', c.tipo, 'disciplina', c.disciplina, 'titulo', c.titulo, 'nome_autor', c.nome_autor, 'como', c.como,
    'status', c.status, 'nota', c.nota, 'criado_em', c.criado_em, 'revisado_em', c.revisado_em, 'publicado_em', c.publicado_em,
    'pareceres', (select count(*) from pareceres r where r.contribuicao = c.id))
  || case when p_completa then jsonb_build_object(
    'corpo', c.corpo, 'dados', c.dados, 'fontes', c.fontes, 'alvo', c.alvo,
    'lista_pareceres', coalesce((select jsonb_agg(jsonb_build_object('favoravel', r.favoravel, 'texto', r.texto, 'criado_em', r.criado_em, 'nome', coalesce(f.nome, '')) order by r.criado_em)
                                 from pareceres r left join perfis f on f.id = r.autor where r.contribuicao = c.id), '[]'::jsonb))
    else '{}'::jsonb end
$$;

/** Quem pode ver uma contribuição na fila: curadoria e coordenação, revisores, e educadores da disciplina. */
create or replace function interno.ve_fila(p_disciplina text) returns boolean language sql stable as $$
  select interno.curador() or interno.tem('revisao')
    or (p_disciplina is not null and exists (select 1 from interno.papeis where usuario = auth.uid() and papel = 'educacao' and disciplina = p_disciplina))
$$;

/** As matérias do jornal passam pelo crivo de mais gente: além de curadoria e revisão, qualquer educador lê e dá parecer. */
create or replace function interno.ve_item(c interno.contribuicoes) returns boolean language sql stable as $$
  select interno.ve_fila(c.disciplina) or (c.tipo = 'artigo' and interno.tem('educacao'))
$$;

create or replace function public.contribuicoes_minhas() returns jsonb language sql security definer set search_path = interno, pg_temp as $$
  select coalesce(jsonb_agg(interno.contribuicao_json(c, false) order by c.criado_em desc), '[]'::jsonb)
  from contribuicoes c where c.autor = auth.uid() and auth.uid() is not null
$$;

create or replace function public.fila(p_status text default 'pendente') returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
begin
  perform interno.eu();
  if not interno.voluntario() then perform interno.erro('sem_permissao'); end if;
  return (
    select coalesce(jsonb_agg(interno.contribuicao_json(c, false) order by c.criado_em), '[]'::jsonb)
    from (select * from contribuicoes where status = coalesce(p_status, 'pendente') order by criado_em limit 300) c
    where interno.ve_item(c));
end $$;

create or replace function public.contribuicao_ver(p_id uuid) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare c contribuicoes;
begin
  select * into c from contribuicoes where id = p_id;
  if not found then perform interno.erro('nao_encontrado'); end if;
  if not (c.autor = auth.uid() or interno.ve_item(c)) then perform interno.erro('sem_permissao'); end if;
  return interno.contribuicao_json(c, true);
end $$;

/** Ajustes antes da decisão: a própria pessoa enquanto está pendente, ou a curadoria. */
create or replace function public.contribuicao_editar(p_id uuid, p jsonb) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); c contribuicoes;
begin
  select * into c from contribuicoes where id = p_id for update;
  if not found then perform interno.erro('nao_encontrado'); end if;
  if c.status <> 'pendente' then perform interno.erro('ja_decidida'); end if;
  if not (c.autor = v or interno.curador()) then perform interno.erro('sem_permissao'); end if;
  if jsonb_typeof(coalesce(p -> 'dados', '{}'::jsonb)) <> 'object' or pg_column_size(coalesce(p -> 'dados', '{}'::jsonb)) > 20000 then perform interno.erro('invalido:dados'); end if;
  update contribuicoes set
    titulo = interno.txt(p ->> 'titulo', 'titulo', 3, 160),
    corpo = interno.txt(p ->> 'corpo', 'corpo', case when c.tipo in ('obra', 'video', 'frase', 'debate', 'verbete') then 0 else 20 end, 60000),
    dados = coalesce(p -> 'dados', '{}'::jsonb),
    fontes = interno.fontes_ok(p -> 'fontes', c.tipo in ('aula', 'artigo', 'checagem', 'debate', 'verbete', 'memorial', 'frase'))
  where id = p_id;
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.parecer(p_id uuid, p_favoravel boolean, p_texto text) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); c contribuicoes;
begin
  perform interno.limite('parecer', 60, 60);
  select * into c from contribuicoes where id = p_id;
  if not found then perform interno.erro('nao_encontrado'); end if;
  if not interno.ve_item(c) then perform interno.erro('sem_permissao'); end if;
  insert into pareceres (contribuicao, autor, favoravel, texto) values (p_id, v, p_favoravel, interno.txt(p_texto, 'texto', 3, 2000));
  return jsonb_build_object('ok', true);
end $$;

/** Aprovar ou recusar. Só curadoria e coordenação. Aprovar não publica: marca para a próxima publicação do site. */
create or replace function public.contribuicao_decidir(p_id uuid, p_aprovar boolean, p_nota text) returns jsonb
language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); c contribuicoes;
begin
  if not interno.curador() then perform interno.erro('sem_permissao'); end if;
  select * into c from contribuicoes where id = p_id for update;
  if not found then perform interno.erro('nao_encontrado'); end if;
  if c.status <> 'pendente' then perform interno.erro('ja_decidida'); end if;
  update contribuicoes set
    status = case when not p_aprovar then 'recusada' when c.tipo in ('correcao', 'sugestao') then 'resolvida' else 'aprovada' end,
    nota = interno.txt(p_nota, 'nota', 0, 2000), revisado_por = v, revisado_em = now()
  where id = p_id;
  perform interno.registrar(case when p_aprovar then 'contribuicao_aprovada' else 'contribuicao_recusada' end, c.titulo, jsonb_build_object('id', c.id, 'tipo', c.tipo));
  perform interno.avisar(c.autor, case when p_aprovar then 'Sua contribuição "' || left(c.titulo, 80) || '" foi aprovada e vai ao ar na próxima publicação do site.'
                                       else 'Sua contribuição "' || left(c.titulo, 80) || '" não foi aprovada. Abra "Minhas contribuições" para ler a nota de quem revisou.' end);
  return jsonb_build_object('ok', true);
end $$;

/** Para a rotina que publica no site: o que foi aprovado e ainda não foi ao ar. Só com a chave de serviço. */
create or replace function public.publicacoes_pendentes() returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
begin
  if not interno.servico() then perform interno.erro('sem_permissao'); end if;
  return (
    select coalesce(jsonb_agg(jsonb_build_object(
      'id', c.id, 'tipo', c.tipo, 'disciplina', c.disciplina, 'titulo', c.titulo, 'corpo', c.corpo, 'dados', c.dados,
      'fontes', c.fontes, 'alvo', c.alvo, 'nome_autor', c.nome_autor, 'revisado_em', c.revisado_em) order by c.revisado_em), '[]'::jsonb)
    from contribuicoes c where c.status = 'aprovada');
end $$;

create or replace function public.publicacoes_marcar(p_ids uuid[]) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
begin
  if not interno.servico() then perform interno.erro('sem_permissao'); end if;
  update contribuicoes set status = 'publicada', publicado_em = now() where id = any (p_ids) and status = 'aprovada';
  return jsonb_build_object('ok', true);
end $$;

-- ───────────────────────────── Comunidade ─────────────────────────────

drop function if exists public.topicos_listar(text, text, integer);
drop function if exists public.topico_criar(text, text, text);

/** Lista de conversas e dúvidas. p_tipo: 'conversa', 'duvida' ou vazio (tudo). p_ordem: 'alta', 'novos', 'melhores', 'sem_resposta'. */
create or replace function public.topicos_listar(p_ordem text default 'alta', p_disciplina text default null, p_pagina integer default 0, p_tipo text default null, p_busca text default null) returns jsonb
language sql stable security definer set search_path = interno, pg_temp as $$
  select coalesce(jsonb_agg(x.j order by x.n), '[]'::jsonb) from (
    select row_number() over () as n, jsonb_build_object(
      'id', t.id, 'titulo', t.titulo, 'disciplina', t.disciplina, 'pontos', t.pontos, 'respostas', t.respostas, 'tipo', t.tipo, 'resolvida', t.aceita is not null,
      'trancado', t.trancado, 'oculto', t.oculto, 'criado_em', t.criado_em, 'autor', coalesce(f.nome, ''),
      'meu_voto', coalesce((select v.valor from votos v where v.usuario = auth.uid() and v.tipo = 'topico' and v.alvo = t.id), 0)) as j
    from topicos t left join perfis f on f.id = t.autor
    where (not t.oculto or interno.cuida()) and (coalesce(p_disciplina, '') = '' or t.disciplina = p_disciplina)
      and (coalesce(p_tipo, '') = '' or t.tipo = p_tipo)
      and (p_ordem is distinct from 'sem_resposta' or t.respostas = 0)
      and (coalesce(btrim(p_busca), '') = '' or position(interno.normal(left(p_busca, 80)) in interno.normal(t.titulo)) > 0)
    order by
      case when p_ordem in ('novos', 'sem_resposta') then extract(epoch from t.criado_em) end desc nulls last,
      case when p_ordem = 'melhores' then t.pontos end desc nulls last,
      (t.pontos + 1) / power(extract(epoch from (now() - t.criado_em)) / 3600 + 2, 1.5) desc
    limit 30 offset greatest(coalesce(p_pagina, 0), 0) * 30
  ) x
$$;

create or replace function public.topico_ver(p_id uuid) returns jsonb language plpgsql stable security definer set search_path = interno, pg_temp as $$
declare t topicos;
begin
  select * into t from topicos where id = p_id;
  if not found or (t.oculto and not interno.cuida()) then perform interno.erro('nao_encontrado'); end if;
  return jsonb_build_object(
    'id', t.id, 'titulo', t.titulo, 'corpo', t.corpo, 'disciplina', t.disciplina, 'pontos', t.pontos, 'trancado', t.trancado, 'oculto', t.oculto,
    'tipo', t.tipo, 'aceita', t.aceita,
    'criado_em', t.criado_em, 'autor', coalesce((select nome from perfis where id = t.autor), ''),
    'meu', t.autor is not null and t.autor = auth.uid(),
    'meu_voto', coalesce((select valor from votos where usuario = auth.uid() and tipo = 'topico' and alvo = t.id), 0),
    'pode_cuidar', interno.cuida(),
    -- Numa dúvida, a resposta escolhida vem primeiro e depois as mais bem votadas; numa conversa, a ordem é a do tempo.
    'respostas', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', r.id, 'corpo', r.corpo, 'pontos', r.pontos, 'oculto', r.oculto, 'criado_em', r.criado_em, 'autor', coalesce(f.nome, ''),
        'aceita', r.id = t.aceita, 'da_equipe', exists (select 1 from papeis p where p.usuario = r.autor),
        'meu_voto', coalesce((select valor from votos where usuario = auth.uid() and tipo = 'resposta' and alvo = r.id), 0))
        order by (t.tipo = 'duvida' and r.id = t.aceita) desc, case when t.tipo = 'duvida' then r.pontos end desc nulls last, r.criado_em)
      from respostas r left join perfis f on f.id = r.autor
      where r.topico = t.id and (not r.oculto or interno.cuida())), '[]'::jsonb));
end $$;

/** Abrir conversa ou dúvida. Mensagem com termo do filtro fica retida até a equipe ler. */
create or replace function public.topico_criar(p_titulo text, p_corpo text, p_disciplina text, p_tipo text default 'conversa') returns jsonb
language plpgsql security definer set search_path = interno, pg_temp as $$
declare
  v uuid := interno.eu(); v_id uuid;
  v_titulo text := interno.txt(p_titulo, 'titulo', 5, 140);
  v_corpo text := interno.txt(p_corpo, 'corpo', 10, 8000);
  v_retido boolean;
begin
  perform interno.limite('topico', 3, 60);
  if coalesce(p_tipo, 'conversa') not in ('conversa', 'duvida') then perform interno.erro('invalido:tipo'); end if;
  v_retido := interno.vetado(v_titulo || ' ' || v_corpo);
  insert into topicos (autor, titulo, corpo, disciplina, tipo, oculto, retido)
  values (v, v_titulo, v_corpo, interno.disciplina_ok(p_disciplina), coalesce(p_tipo, 'conversa'), v_retido, v_retido)
  returning id into v_id;
  return jsonb_build_object('id', v_id, 'retido', v_retido);
end $$;

create or replace function public.responder(p_topico uuid, p_corpo text) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); t topicos; v_id uuid; v_corpo text := interno.txt(p_corpo, 'corpo', 2, 8000); v_retido boolean;
begin
  perform interno.limite('responder', 30, 60);
  select * into t from topicos where id = p_topico for update;
  if not found or t.oculto then perform interno.erro('nao_encontrado'); end if;
  if t.trancado then perform interno.erro('topico_trancado'); end if;
  v_retido := interno.vetado(v_corpo);
  insert into respostas (topico, autor, corpo, oculto, retido) values (p_topico, v, v_corpo, v_retido, v_retido) returning id into v_id;
  if not v_retido then update topicos set respostas = respostas + 1 where id = p_topico; end if;
  return jsonb_build_object('id', v_id, 'retido', v_retido);
end $$;

/** Quem perguntou (ou a equipe) marca a resposta que resolveu a dúvida. Sem p_resposta, desmarca. */
create or replace function public.resposta_aceitar(p_topico uuid, p_resposta uuid) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); t topicos;
begin
  select * into t from topicos where id = p_topico for update;
  if not found or t.oculto then perform interno.erro('nao_encontrado'); end if;
  if not (t.autor = v or interno.cuida()) then perform interno.erro('sem_permissao'); end if;
  if p_resposta is not null and not exists (select 1 from respostas where id = p_resposta and topico = p_topico and not oculto) then perform interno.erro('nao_encontrado'); end if;
  update topicos set aceita = p_resposta where id = p_topico;
  return jsonb_build_object('aceita', p_resposta);
end $$;

/** Voto para cima (1), para baixo (-1) ou retirar o voto (0). Um por pessoa. */
/** Voto para cima (1), para baixo (-1) ou retirar o voto (0). Um por pessoa. */
create or replace function public.votar(p_tipo text, p_alvo uuid, p_valor integer) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); v_antes integer; v_pontos integer;
begin
  perform interno.limite('votar', 300, 60);
  if p_tipo not in ('topico', 'resposta') or p_valor not in (-1, 0, 1) then perform interno.erro('invalido:voto'); end if;
  if p_tipo = 'topico' then perform 1 from topicos where id = p_alvo and not oculto for update;
  else perform 1 from respostas where id = p_alvo and not oculto for update; end if;
  if not found then perform interno.erro('nao_encontrado'); end if;
  select coalesce((select valor from votos where usuario = v and tipo = p_tipo and alvo = p_alvo), 0) into v_antes;
  if p_valor = 0 then delete from votos where usuario = v and tipo = p_tipo and alvo = p_alvo;
  else insert into votos (usuario, tipo, alvo, valor) values (v, p_tipo, p_alvo, p_valor)
       on conflict (usuario, tipo, alvo) do update set valor = excluded.valor; end if;
  if p_tipo = 'topico' then update topicos set pontos = pontos + (p_valor - v_antes) where id = p_alvo returning pontos into v_pontos;
  else update respostas set pontos = pontos + (p_valor - v_antes) where id = p_alvo returning pontos into v_pontos; end if;
  return jsonb_build_object('pontos', v_pontos, 'meu_voto', p_valor);
end $$;

/** Cuidar da comunidade: ocultar, mostrar, trancar ou destrancar. Nada é apagado. */
create or replace function public.comunidade_cuidar(p_tipo text, p_alvo uuid, p_acao text) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v_retido boolean; v_topico uuid;
begin
  perform interno.eu();
  if not interno.cuida() then perform interno.erro('sem_permissao'); end if;
  if p_tipo = 'topico' and p_acao in ('ocultar', 'mostrar') then
    update topicos set oculto = (p_acao = 'ocultar'), retido = false where id = p_alvo;
  elsif p_tipo = 'topico' and p_acao in ('trancar', 'destrancar') then
    update topicos set trancado = (p_acao = 'trancar') where id = p_alvo;
  elsif p_tipo = 'resposta' and p_acao in ('ocultar', 'mostrar') then
    select retido, topico into v_retido, v_topico from respostas where id = p_alvo;
    update respostas set oculto = (p_acao = 'ocultar'), retido = false where id = p_alvo;
    -- Resposta que estava retida só entra na contagem quando a equipe a libera.
    if found and v_retido and p_acao = 'mostrar' then update topicos set respostas = respostas + 1 where id = v_topico; end if;
  else perform interno.erro('invalido:acao'); end if;
  if not found then perform interno.erro('nao_encontrado'); end if;
  perform interno.registrar('comunidade_' || p_acao, p_alvo::text, jsonb_build_object('tipo', p_tipo));
  return jsonb_build_object('ok', true);
end $$;

/** Mensagens que o filtro segurou e ainda esperam leitura. */
create or replace function public.comunidade_retidos() returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
begin
  perform interno.eu();
  if not interno.cuida() then perform interno.erro('sem_permissao'); end if;
  return (
    select coalesce(jsonb_agg(x.j order by x.criado_em), '[]'::jsonb) from (
      select t.criado_em, jsonb_build_object('tipo', 'topico', 'id', t.id, 'titulo', t.titulo, 'corpo', t.corpo, 'autor', coalesce(f.nome, ''), 'criado_em', t.criado_em) as j
      from topicos t left join perfis f on f.id = t.autor where t.retido
      union all
      select r.criado_em, jsonb_build_object('tipo', 'resposta', 'id', r.id, 'titulo', (select titulo from topicos where id = r.topico), 'corpo', r.corpo, 'autor', coalesce(f.nome, ''), 'criado_em', r.criado_em)
      from respostas r left join perfis f on f.id = r.autor where r.retido
    ) x);
end $$;

create or replace function public.filtro_listar() returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
begin
  perform interno.eu();
  if not interno.curador() then perform interno.erro('sem_permissao'); end if;
  return (select coalesce(jsonb_agg(termo order by termo), '[]'::jsonb) from termos_vetados);
end $$;

create or replace function public.filtro_salvar(p_termo text, p_incluir boolean) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v_termo text := interno.normal(p_termo);
begin
  perform interno.eu();
  if not interno.curador() then perform interno.erro('sem_permissao'); end if;
  if v_termo !~ '^[a-z0-9 ]{3,40}$' then perform interno.erro('invalido:termo'); end if;
  if coalesce(p_incluir, true) then insert into termos_vetados (termo) values (v_termo) on conflict do nothing;
  else delete from termos_vetados where termo = v_termo; end if;
  perform interno.registrar(case when coalesce(p_incluir, true) then 'filtro_incluido' else 'filtro_retirado' end, v_termo);
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.denunciar(p_alvo text, p_motivo text, p_detalhes text, p_site text default '') returns jsonb
language plpgsql security definer set search_path = interno, pg_temp as $$
begin
  if coalesce(p_site, '') <> '' then return jsonb_build_object('ok', true); end if;
  perform interno.limite('denunciar', 6, 60);
  insert into denuncias (alvo, motivo, detalhes, autor)
  values (interno.txt(p_alvo, 'alvo', 1, 300), interno.txt(p_motivo, 'motivo', 2, 80), interno.txt(p_detalhes, 'detalhes', 20, 4000), auth.uid());
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.denuncias_listar() returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
begin
  perform interno.eu();
  if not interno.curador() then perform interno.erro('sem_permissao'); end if;
  return (select coalesce(jsonb_agg(jsonb_build_object('id', d.id, 'alvo', d.alvo, 'motivo', d.motivo, 'detalhes', d.detalhes, 'status', d.status, 'nota', d.nota, 'criado_em', d.criado_em)
                           order by (d.status = 'aberta') desc, d.criado_em desc), '[]'::jsonb)
          from (select * from denuncias order by criado_em desc limit 300) d);
end $$;

create or replace function public.denuncia_resolver(p_id uuid, p_nota text) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
begin
  perform interno.eu();
  if not interno.curador() then perform interno.erro('sem_permissao'); end if;
  update denuncias set status = 'resolvida', nota = interno.txt(p_nota, 'nota', 0, 2000) where id = p_id;
  if not found then perform interno.erro('nao_encontrado'); end if;
  return jsonb_build_object('ok', true);
end $$;

-- ───────────────────────────── Anotações de leitura ─────────────────────────────

create or replace function public.anotacoes_listar(p_caminho text) returns jsonb language sql stable security definer set search_path = interno, pg_temp as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', a.id, 'paragrafo', a.paragrafo, 'trecho', a.trecho, 'corpo', a.corpo, 'status', a.status, 'autor', coalesce(f.nome, ''), 'criado_em', a.criado_em)
    order by a.paragrafo, a.criado_em), '[]'::jsonb)
  from anotacoes a left join perfis f on f.id = a.autor
  where a.caminho = p_caminho and (a.status = 'aprovada' or (a.status = 'pendente' and a.autor = auth.uid()))
$$;

/** Anotar um parágrafo: só voluntários. Curadoria e educadores publicam direto; os demais passam pela fila. */
create or replace function public.anotar(p_caminho text, p_paragrafo integer, p_trecho text, p_corpo text) returns jsonb
language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); v_id uuid;
begin
  if not interno.voluntario() then perform interno.erro('sem_permissao'); end if;
  perform interno.limite('anotar', 40, 60);
  if coalesce(p_caminho, '') !~ '^/[a-z0-9/_-]{1,200}$' then perform interno.erro('invalido:caminho'); end if;
  insert into anotacoes (caminho, paragrafo, trecho, corpo, autor, status)
  values (p_caminho, p_paragrafo, interno.txt(p_trecho, 'trecho', 0, 300), interno.txt(p_corpo, 'corpo', 5, 1500), v,
          case when interno.cuida() then 'aprovada' else 'pendente' end)
  returning id into v_id;
  return jsonb_build_object('id', v_id);
end $$;

create or replace function public.anotacoes_fila() returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
begin
  perform interno.eu();
  if not interno.cuida() then perform interno.erro('sem_permissao'); end if;
  return (select coalesce(jsonb_agg(jsonb_build_object('id', a.id, 'caminho', a.caminho, 'paragrafo', a.paragrafo, 'trecho', a.trecho, 'corpo', a.corpo, 'autor', coalesce(f.nome, ''), 'criado_em', a.criado_em)
                           order by a.criado_em), '[]'::jsonb)
          from anotacoes a left join perfis f on f.id = a.autor where a.status = 'pendente');
end $$;

create or replace function public.anotacao_decidir(p_id uuid, p_status text) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
begin
  perform interno.eu();
  if not interno.cuida() then perform interno.erro('sem_permissao'); end if;
  if p_status not in ('aprovada', 'oculta') then perform interno.erro('invalido:status'); end if;
  update anotacoes set status = p_status where id = p_id;
  if not found then perform interno.erro('nao_encontrado'); end if;
  return jsonb_build_object('ok', true);
end $$;

-- ───────────────────────────── Apoiadores ─────────────────────────────

create or replace function public.apoiadores_listar() returns jsonb language sql stable security definer set search_path = interno, pg_temp as $$
  select coalesce(jsonb_agg(jsonb_build_object('id', a.id, 'nome', a.nome, 'mensagem', a.mensagem) order by a.criado_em), '[]'::jsonb) from apoiadores a
$$;

create or replace function public.apoiador_salvar(p_id uuid, p_nome text, p_mensagem text) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v_id uuid;
begin
  perform interno.eu();
  if not interno.coord() then perform interno.erro('sem_permissao'); end if;
  if p_id is null then
    insert into apoiadores (nome, mensagem) values (interno.txt(p_nome, 'nome', 2, 80), interno.txt(p_mensagem, 'mensagem', 0, 200)) returning id into v_id;
  else
    update apoiadores set nome = interno.txt(p_nome, 'nome', 2, 80), mensagem = interno.txt(p_mensagem, 'mensagem', 0, 200) where id = p_id returning id into v_id;
    if v_id is null then perform interno.erro('nao_encontrado'); end if;
  end if;
  return jsonb_build_object('id', v_id);
end $$;

create or replace function public.apoiador_remover(p_id uuid) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
begin
  perform interno.eu();
  if not interno.coord() then perform interno.erro('sem_permissao'); end if;
  delete from apoiadores where id = p_id;
  return jsonb_build_object('ok', true);
end $$;

-- ───────────────────────────── Mural dos Trabalhadores ─────────────────────────────

create or replace function interno.mural_json(m interno.mural, p_completo boolean) returns jsonb
language sql stable security definer set search_path = interno, pg_temp as $$
  select jsonb_build_object(
    'id', m.id, 'categoria', m.categoria, 'titulo', m.titulo, 'descricao', m.descricao, 'cidade', m.cidade, 'uf', m.uf,
    'contato', m.contato, 'link', m.link, 'nome', coalesce((select f.nome from perfis f where f.id = m.autor), ''), 'publicado_em', m.decidido_em)
  || case when p_completo then jsonb_build_object('status', m.status, 'nota', m.nota, 'criado_em', m.criado_em, 'validade', m.validade,
       'vencido', m.status = 'aprovado' and m.validade <= now()) else '{}'::jsonb end
$$;

/** O que o público vê: só anúncios aprovados e dentro da validade. */
create or replace function public.mural_listar(p_categoria text default null, p_uf text default null) returns jsonb
language sql stable security definer set search_path = interno, pg_temp as $$
  select coalesce(jsonb_agg(interno.mural_json(m, false) order by m.decidido_em desc), '[]'::jsonb)
  from (select * from mural
        where status = 'aprovado' and validade > now()
          and (coalesce(p_categoria, '') = '' or categoria = p_categoria)
          and (coalesce(p_uf, '') = '' or uf = upper(p_uf))
        order by decidido_em desc limit 300) m
$$;

/** Enviar ou corrigir um anúncio. Precisa de conta; no máximo três anúncios por pessoa; toda mudança volta para a curadoria. */
create or replace function public.mural_enviar(p jsonb) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare
  v uuid := interno.eu();
  v_id uuid := nullif(p ->> 'id', '')::uuid;
  v_categoria text := coalesce(p ->> 'categoria', '');
  v_uf text := upper(btrim(coalesce(p ->> 'uf', '')));
  v_link text := btrim(coalesce(p ->> 'link', ''));
begin
  perform interno.limite('mural', 6, 1440);
  if v_categoria not in ('cooperativa', 'servico', 'produto', 'arte', 'iniciativa') then perform interno.erro('invalido:categoria'); end if;
  if v_uf !~ '^([A-Z]{2})?$' then perform interno.erro('invalido:uf'); end if;
  if v_link <> '' and (v_link !~ '^https://[^[:space:]]+$' or char_length(v_link) > 300) then perform interno.erro('invalido:link'); end if;
  if v_id is null then
    if (select count(*) from mural where autor = v and status <> 'recusado') >= 3 then perform interno.erro('limite_anuncios'); end if;
    insert into mural (autor, categoria, titulo, descricao, cidade, uf, contato, link)
    values (v, v_categoria, interno.txt(p ->> 'titulo', 'titulo', 4, 100), interno.txt(p ->> 'descricao', 'descricao', 20, 1200),
            interno.txt(p ->> 'cidade', 'cidade', 2, 80), v_uf, interno.txt(p ->> 'contato', 'contato', 4, 160), v_link)
    returning id into v_id;
  else
    update mural set categoria = v_categoria, titulo = interno.txt(p ->> 'titulo', 'titulo', 4, 100),
      descricao = interno.txt(p ->> 'descricao', 'descricao', 20, 1200), cidade = interno.txt(p ->> 'cidade', 'cidade', 2, 80),
      uf = v_uf, contato = interno.txt(p ->> 'contato', 'contato', 4, 160), link = v_link,
      status = 'pendente', nota = '', decidido_em = null, validade = null
    where id = v_id and autor = v;
    if not found then perform interno.erro('nao_encontrado'); end if;
  end if;
  return jsonb_build_object('id', v_id);
end $$;

create or replace function public.mural_meus() returns jsonb language sql stable security definer set search_path = interno, pg_temp as $$
  select coalesce(jsonb_agg(interno.mural_json(m, true) order by m.criado_em desc), '[]'::jsonb)
  from mural m where m.autor = auth.uid() and auth.uid() is not null
$$;

/** Quem publicou pode retirar o próprio anúncio; a curadoria pode retirar qualquer um. */
create or replace function public.mural_remover(p_id uuid) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu();
begin
  delete from mural where id = p_id and (autor = v or interno.curador());
  if not found then perform interno.erro('nao_encontrado'); end if;
  return jsonb_build_object('ok', true);
end $$;

/** Anúncio aprovado vale 180 dias. Quem publicou renova com um clique enquanto a iniciativa existir. */
create or replace function public.mural_renovar(p_id uuid) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu();
begin
  update mural set validade = now() + interval '180 days' where id = p_id and autor = v and status = 'aprovado';
  if not found then perform interno.erro('nao_encontrado'); end if;
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.mural_fila(p_status text default 'pendente') returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
begin
  perform interno.eu();
  if not interno.curador() then perform interno.erro('sem_permissao'); end if;
  return (select coalesce(jsonb_agg(interno.mural_json(m, true) order by m.criado_em), '[]'::jsonb)
          from (select * from mural where status = coalesce(p_status, 'pendente') order by criado_em limit 300) m);
end $$;

create or replace function public.mural_decidir(p_id uuid, p_aprovar boolean, p_nota text) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
begin
  perform interno.eu();
  if not interno.curador() then perform interno.erro('sem_permissao'); end if;
  update mural set status = case when p_aprovar then 'aprovado' else 'recusado' end, nota = interno.txt(p_nota, 'nota', 0, 500),
    decidido_em = now(), validade = case when p_aprovar then now() + interval '180 days' end
  where id = p_id;
  if not found then perform interno.erro('nao_encontrado'); end if;
  perform interno.registrar(case when p_aprovar then 'anuncio_aprovado' else 'anuncio_recusado' end, p_id::text);
  perform interno.avisar((select autor from mural where id = p_id), case when p_aprovar then 'Seu anúncio no Mural dos Trabalhadores está no ar por 180 dias.'
                                                                       else 'Seu anúncio no Mural dos Trabalhadores não foi aprovado. Veja a nota da curadoria em "Meus anúncios".' end);
  return jsonb_build_object('ok', true);
end $$;

-- ───────────────────────────── Rádio ─────────────────────────────

/** Programação da rádio. Enquanto não estiver no ar, só a coordenação enxerga os canais. */
create or replace function public.radio_estado() returns jsonb language plpgsql stable security definer set search_path = interno, pg_temp as $$
declare c jsonb := (select valor from configuracoes where chave = 'radio');
begin
  if not coalesce((c ->> 'no_ar')::boolean, false) and not interno.coord() then
    return jsonb_build_object('no_ar', false);
  end if;
  return jsonb_build_object(
    'no_ar', coalesce((c ->> 'no_ar')::boolean, false),
    'ao_vivo', coalesce(c ->> 'ao_vivo', ''),
    'canais', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', k.id, 'nome', k.nome, 'descricao', k.descricao, 'ordem', k.ordem,
        'faixas', coalesce((select jsonb_agg(jsonb_build_object('id', f.id, 'titulo', f.titulo, 'artista', f.artista, 'url', f.url, 'duracao', f.duracao, 'ordem', f.ordem) order by f.ordem, f.criado_em)
                            from radio_faixas f where f.canal = k.id), '[]'::jsonb)) order by k.ordem, k.nome)
      from radio_canais k), '[]'::jsonb));
end $$;

create or replace function public.radio_configurar(p_no_ar boolean, p_ao_vivo text) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v_url text := btrim(coalesce(p_ao_vivo, ''));
begin
  perform interno.eu();
  if not interno.coord() then perform interno.erro('sem_permissao'); end if;
  if v_url <> '' and (v_url !~ '^https://[^[:space:]]+$' or char_length(v_url) > 500) then perform interno.erro('invalido:ao_vivo'); end if;
  update configuracoes set valor = jsonb_build_object('no_ar', coalesce(p_no_ar, false), 'ao_vivo', v_url) where chave = 'radio';
  perform interno.registrar('radio_configurada', '', jsonb_build_object('no_ar', coalesce(p_no_ar, false)));
  return public.radio_estado();
end $$;

create or replace function public.radio_canal_salvar(p_id uuid, p_nome text, p_descricao text, p_ordem integer) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v_id uuid;
begin
  perform interno.eu();
  if not interno.coord() then perform interno.erro('sem_permissao'); end if;
  if p_id is null then
    insert into radio_canais (nome, descricao, ordem) values (interno.txt(p_nome, 'nome', 2, 60), interno.txt(p_descricao, 'descricao', 0, 300), coalesce(p_ordem, 0)) returning id into v_id;
  else
    update radio_canais set nome = interno.txt(p_nome, 'nome', 2, 60), descricao = interno.txt(p_descricao, 'descricao', 0, 300), ordem = coalesce(p_ordem, 0) where id = p_id returning id into v_id;
    if v_id is null then perform interno.erro('nao_encontrado'); end if;
  end if;
  return jsonb_build_object('id', v_id);
end $$;

create or replace function public.radio_canal_remover(p_id uuid) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
begin
  perform interno.eu();
  if not interno.coord() then perform interno.erro('sem_permissao'); end if;
  delete from radio_canais where id = p_id;
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.radio_faixa_salvar(p_id uuid, p_canal uuid, p_titulo text, p_artista text, p_url text, p_duracao integer, p_ordem integer) returns jsonb
language plpgsql security definer set search_path = interno, pg_temp as $$
declare v_id uuid; v_url text := btrim(coalesce(p_url, ''));
begin
  perform interno.eu();
  if not interno.coord() then perform interno.erro('sem_permissao'); end if;
  if v_url !~ '^https?://[^[:space:]]+$' or char_length(v_url) > 500 then perform interno.erro('invalido:url'); end if;
  if not exists (select 1 from radio_canais where id = p_canal) then perform interno.erro('nao_encontrado'); end if;
  if p_id is null then
    insert into radio_faixas (canal, titulo, artista, url, duracao, ordem)
    values (p_canal, interno.txt(p_titulo, 'titulo', 1, 160), interno.txt(p_artista, 'artista', 0, 120), v_url, greatest(coalesce(p_duracao, 0), 0), coalesce(p_ordem, 0))
    returning id into v_id;
  else
    update radio_faixas set canal = p_canal, titulo = interno.txt(p_titulo, 'titulo', 1, 160), artista = interno.txt(p_artista, 'artista', 0, 120),
      url = v_url, duracao = greatest(coalesce(p_duracao, 0), 0), ordem = coalesce(p_ordem, 0)
    where id = p_id returning id into v_id;
    if v_id is null then perform interno.erro('nao_encontrado'); end if;
  end if;
  return jsonb_build_object('id', v_id);
end $$;

create or replace function public.radio_faixa_remover(p_id uuid) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
begin
  perform interno.eu();
  if not interno.coord() then perform interno.erro('sem_permissao'); end if;
  delete from radio_faixas where id = p_id;
  return jsonb_build_object('ok', true);
end $$;

/** Guarda onde a pessoa parou em uma faixa, para retomar em outro aparelho. */
create or replace function public.progresso_salvar(p_faixa uuid, p_segundos integer) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu();
begin
  perform interno.limite('progresso', 720, 60);
  if not exists (select 1 from radio_faixas where id = p_faixa) then perform interno.erro('nao_encontrado'); end if;
  insert into audio_progresso (usuario, faixa, segundos) values (v, p_faixa, least(greatest(coalesce(p_segundos, 0), 0), 86400))
  on conflict (usuario, faixa) do update set segundos = excluded.segundos, atualizado_em = now();
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.progresso_listar() returns jsonb language sql stable security definer set search_path = interno, pg_temp as $$
  select coalesce(jsonb_object_agg(p.faixa::text, p.segundos), '{}'::jsonb) from audio_progresso p where p.usuario = auth.uid()
$$;

-- ───────────────────────────── Aviso de abertura ─────────────────────────────

/** O aviso que abre junto com o site, quando a liderança definiu um pelo painel. */
create or replace function public.abertura() returns jsonb language sql stable security definer set search_path = interno, pg_temp as $$
  select coalesce((select case when coalesce((valor ->> 'definido')::boolean, false) then valor else null end from configuracoes where chave = 'abertura'),
                  jsonb_build_object('definido', false))
$$;

create or replace function public.abertura_salvar(p jsonb) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare
  v_imagem text := btrim(coalesce(p ->> 'imagem', ''));
  v_link text := btrim(coalesce(p ->> 'link', ''));
  v_ate text := btrim(coalesce(p ->> 'ate', ''));
  v jsonb;
begin
  perform interno.eu();
  if not interno.coord() then perform interno.erro('sem_permissao'); end if;
  -- A imagem precisa estar no próprio site; o link pode ser interno ou um endereço https.
  if v_imagem <> '' and (v_imagem !~ '^/[A-Za-z0-9/._-]+$' or char_length(v_imagem) > 200) then perform interno.erro('invalido:imagem'); end if;
  if v_link <> '' and ((v_link !~ '^/[A-Za-z0-9/._#-]*$' and v_link !~ '^https://[^[:space:]]+$') or char_length(v_link) > 300) then perform interno.erro('invalido:link'); end if;
  if v_ate <> '' and v_ate !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' then perform interno.erro('invalido:ate'); end if;
  v := jsonb_build_object(
    'definido', true,
    'ativo', coalesce((p ->> 'ativo')::boolean, false),
    'titulo', interno.txt(p ->> 'titulo', 'titulo', 0, 80),
    'texto', interno.txt(p ->> 'texto', 'texto', 0, 700),
    'imagem', v_imagem,
    'credito', interno.txt(p ->> 'credito', 'credito', 0, 200),
    'link', v_link,
    'link_texto', interno.txt(p ->> 'link_texto', 'link_texto', 0, 40),
    'assinatura', interno.txt(p ->> 'assinatura', 'assinatura', 0, 120),
    'ate', v_ate,
    'versao', floor(extract(epoch from now()))::bigint);
  insert into configuracoes (chave, valor) values ('abertura', v) on conflict (chave) do update set valor = excluded.valor;
  perform interno.registrar('abertura_salva', '', jsonb_build_object('ativo', v -> 'ativo', 'titulo', v -> 'titulo'));
  return v;
end $$;

-- ───────────────────────────── Aula de reforço ─────────────────────────────

/** Pedir ajuda em uma matéria. A resposta chega por e-mail, de alguém da equipe. */
create or replace function public.reforco_pedir(p jsonb) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); v_email text := lower(btrim(coalesce(p ->> 'email', ''))); v_disc text := interno.disciplina_ok(p ->> 'disciplina'); v_id uuid;
begin
  perform interno.limite('reforco', 3, 60);
  if v_disc is null then perform interno.erro('invalido:disciplina'); end if;
  if v_email !~ '^[^@[:space:]]+@[^@[:space:]]+[.][^@[:space:]]+$' or char_length(v_email) > 200 then perform interno.erro('invalido:email'); end if;
  if (select count(*) from reforco where autor = v and status in ('aberto', 'em_atendimento')) >= 3 then perform interno.erro('limite_pedidos'); end if;
  insert into reforco (autor, email, disciplina, assunto, duvida)
  values (v, v_email, v_disc, interno.txt(p ->> 'assunto', 'assunto', 4, 140), interno.txt(p ->> 'duvida', 'duvida', 20, 3000))
  returning id into v_id;
  return jsonb_build_object('id', v_id);
end $$;

create or replace function public.reforco_meus() returns jsonb language sql stable security definer set search_path = interno, pg_temp as $$
  select coalesce(jsonb_agg(jsonb_build_object('id', r.id, 'disciplina', r.disciplina, 'assunto', r.assunto, 'status', r.status, 'nota', r.nota, 'criado_em', r.criado_em) order by r.criado_em desc), '[]'::jsonb)
  from reforco r where r.autor = auth.uid() and auth.uid() is not null
$$;

create or replace function public.reforco_cancelar(p_id uuid) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu();
begin
  update reforco set status = 'cancelado', email = '' where id = p_id and autor = v and status in ('aberto', 'em_atendimento');
  if not found then perform interno.erro('nao_encontrado'); end if;
  return jsonb_build_object('ok', true);
end $$;

/** Pedidos abertos das disciplinas de quem chama. O e-mail só aparece para quem assumiu o pedido. */
create or replace function public.reforco_fila() returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
begin
  perform interno.eu();
  if not (interno.curador() or interno.tem('mentoria') or interno.tem('educacao')) then perform interno.erro('sem_permissao'); end if;
  return (
    select coalesce(jsonb_agg(jsonb_build_object(
      'id', r.id, 'disciplina', r.disciplina, 'assunto', r.assunto, 'duvida', r.duvida, 'status', r.status, 'criado_em', r.criado_em,
      'nome', coalesce(f.nome, ''), 'meu', r.mentor is not null and r.mentor = auth.uid(), 'mentor', coalesce(m.nome, ''),
      'email', case when r.mentor = auth.uid() and r.status = 'em_atendimento' then r.email else '' end) order by r.criado_em), '[]'::jsonb)
    from reforco r left join perfis f on f.id = r.autor left join perfis m on m.id = r.mentor
    where r.status in ('aberto', 'em_atendimento') and interno.mentor(r.disciplina));
end $$;

create or replace function public.reforco_assumir(p_id uuid) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); r reforco;
begin
  select * into r from reforco where id = p_id for update;
  if not found or r.status <> 'aberto' then perform interno.erro('nao_encontrado'); end if;
  if not interno.mentor(r.disciplina) then perform interno.erro('sem_permissao'); end if;
  update reforco set status = 'em_atendimento', mentor = v where id = p_id;
  perform interno.registrar('reforco_assumido', p_id::text, jsonb_build_object('disciplina', r.disciplina));
  perform interno.avisar(r.autor, 'Seu pedido de reforço "' || left(r.assunto, 80) || '" foi assumido por alguém da equipe. A resposta chega no e-mail que você informou.');
  return jsonb_build_object('email', r.email);
end $$;

/** Devolver o pedido à fila (quem assumiu não pôde responder). */
create or replace function public.reforco_soltar(p_id uuid) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu();
begin
  update reforco set status = 'aberto', mentor = null where id = p_id and status = 'em_atendimento' and (mentor = v or interno.curador());
  if not found then perform interno.erro('nao_encontrado'); end if;
  return jsonb_build_object('ok', true);
end $$;

/** Concluir: o e-mail da pessoa é apagado do banco neste momento. */
create or replace function public.reforco_concluir(p_id uuid, p_nota text) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); r reforco;
begin
  select * into r from reforco where id = p_id for update;
  if not found or r.status <> 'em_atendimento' then perform interno.erro('nao_encontrado'); end if;
  if not (r.mentor = v or interno.curador()) then perform interno.erro('sem_permissao'); end if;
  update reforco set status = 'atendido', email = '', nota = interno.txt(p_nota, 'nota', 0, 1000), atendido_em = now() where id = p_id;
  perform interno.registrar('reforco_concluido', p_id::text);
  perform interno.avisar(r.autor, 'Seu pedido de reforço "' || left(r.assunto, 80) || '" foi respondido por e-mail. Confira também a caixa de spam.');
  return jsonb_build_object('ok', true);
end $$;

-- ───────────────────────────── Conversa da equipe ─────────────────────────────

create or replace function interno.ve_canal(p_canal text) returns boolean language sql stable as $$
  select case
    when p_canal in ('geral', 'pedidos') then interno.voluntario()
    when p_canal = 'coordenacao' then interno.coord()
    when p_canal in ('curadoria', 'educacao', 'revisao', 'traducao', 'jornalismo', 'mentoria', 'design', 'desenvolvimento') then interno.coord() or interno.tem(p_canal)
    else false end
$$;

/** Canais que a pessoa enxerga e o endereço da sala cifrada de voz e vídeo, se a liderança indicou uma. */
create or replace function public.equipe_canais() returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
begin
  perform interno.eu();
  if not interno.voluntario() then perform interno.erro('sem_permissao'); end if;
  return jsonb_build_object(
    'sala', coalesce((select valor ->> 'sala' from configuracoes where chave = 'equipe'), ''),
    'canais', (select coalesce(jsonb_agg(c order by n), '[]'::jsonb)
               from unnest(array['geral', 'pedidos', 'coordenacao', 'curadoria', 'educacao', 'revisao', 'traducao', 'jornalismo', 'mentoria', 'design', 'desenvolvimento']) with ordinality as t(c, n)
               where interno.ve_canal(c)));
end $$;

create or replace function public.equipe_listar(p_canal text) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
begin
  perform interno.eu();
  if not interno.ve_canal(coalesce(p_canal, '')) then perform interno.erro('sem_permissao'); end if;
  return (
    select coalesce(jsonb_agg(x.j order by x.criado_em desc), '[]'::jsonb) from (
      select m.criado_em, jsonb_build_object(
        'id', m.id, 'autor', coalesce(f.nome, ''), 'meu', m.autor is not null and m.autor = auth.uid(), 'para', m.para, 'corpo', m.corpo,
        'resolvido', m.resolvido, 'criado_em', m.criado_em,
        'respostas', coalesce((select jsonb_agg(jsonb_build_object('id', r.id, 'autor', coalesce(g.nome, ''), 'meu', r.autor is not null and r.autor = auth.uid(), 'corpo', r.corpo, 'criado_em', r.criado_em) order by r.criado_em)
                               from equipe_mensagens r left join perfis g on g.id = r.autor where r.resposta_a = m.id), '[]'::jsonb)) as j
      from equipe_mensagens m left join perfis f on f.id = m.autor
      where m.canal = p_canal and m.resposta_a is null
      order by m.criado_em desc limit 60) x);
end $$;

create or replace function public.equipe_escrever(p_canal text, p_corpo text, p_resposta_a uuid default null, p_para text default null) returns jsonb
language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); v_id uuid; v_para text := nullif(btrim(coalesce(p_para, '')), '');
begin
  if not interno.ve_canal(coalesce(p_canal, '')) then perform interno.erro('sem_permissao'); end if;
  perform interno.limite('equipe', 120, 60);
  if p_resposta_a is not null then
    if not exists (select 1 from equipe_mensagens where id = p_resposta_a and canal = p_canal and resposta_a is null) then perform interno.erro('nao_encontrado'); end if;
    v_para := null;
  elsif p_canal = 'pedidos' then
    if v_para is null or v_para not in ('coordenacao', 'curadoria', 'educacao', 'revisao', 'traducao', 'jornalismo', 'mentoria', 'design', 'desenvolvimento') then perform interno.erro('invalido:para'); end if;
  else
    v_para := null;
  end if;
  insert into equipe_mensagens (canal, resposta_a, autor, para, corpo) values (p_canal, p_resposta_a, v, v_para, interno.txt(p_corpo, 'corpo', 1, 4000)) returning id into v_id;
  return jsonb_build_object('id', v_id);
end $$;

create or replace function public.equipe_marcar(p_id uuid, p_resolvido boolean) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu();
begin
  update equipe_mensagens set resolvido = coalesce(p_resolvido, true) where id = p_id and resposta_a is null and (autor = v or interno.coord());
  if not found then perform interno.erro('nao_encontrado'); end if;
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.equipe_apagar(p_id uuid) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu();
begin
  delete from equipe_mensagens where id = p_id and (autor = v or interno.coord());
  if not found then perform interno.erro('nao_encontrado'); end if;
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.equipe_sala_salvar(p_url text) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v_url text := btrim(coalesce(p_url, ''));
begin
  perform interno.eu();
  if not interno.lider() then perform interno.erro('sem_permissao'); end if;
  if v_url <> '' and (v_url !~ '^https://[^[:space:]]+$' or char_length(v_url) > 300) then perform interno.erro('invalido:url'); end if;
  insert into configuracoes (chave, valor) values ('equipe', jsonb_build_object('sala', v_url)) on conflict (chave) do update set valor = excluded.valor;
  perform interno.registrar('sala_da_equipe', '');
  return jsonb_build_object('sala', v_url);
end $$;

-- ───────────────────────────── Materiais de campanha ─────────────────────────────

create or replace function public.materiais_listar() returns jsonb language sql stable security definer set search_path = interno, pg_temp as $$
  select coalesce(jsonb_agg(jsonb_build_object('id', m.id, 'tipo', m.tipo, 'titulo', m.titulo, 'descricao', m.descricao, 'campanha', m.campanha, 'url', m.url,
    'publicado', m.publicado, 'ordem', m.ordem, 'criado_em', m.criado_em) order by m.ordem, m.criado_em desc), '[]'::jsonb)
  from materiais m where m.publicado or interno.curador() or interno.tem('design')
$$;

/** Curadoria e design preparam o material; só a liderança (ou a vice-liderança) põe no ar. */
create or replace function public.material_salvar(p jsonb) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare
  v uuid := interno.eu(); v_id uuid := nullif(p ->> 'id', '')::uuid; v_url text := btrim(coalesce(p ->> 'url', ''));
  v_tipo text := coalesce(p ->> 'tipo', ''); v_publicar boolean := coalesce((p ->> 'publicado')::boolean, false) and interno.coord();
begin
  if not (interno.curador() or interno.tem('design')) then perform interno.erro('sem_permissao'); end if;
  if v_tipo not in ('zine', 'panfleto', 'cartaz', 'banner', 'video', 'texto') then perform interno.erro('invalido:tipo'); end if;
  if (v_url !~ '^https://[^[:space:]]+$' and v_url !~ '^/[A-Za-z0-9/._-]+$') or char_length(v_url) > 500 then perform interno.erro('invalido:url'); end if;
  if v_id is null then
    insert into materiais (tipo, titulo, descricao, campanha, url, publicado, ordem, criado_por)
    values (v_tipo, interno.txt(p ->> 'titulo', 'titulo', 3, 120), interno.txt(p ->> 'descricao', 'descricao', 0, 600), interno.txt(p ->> 'campanha', 'campanha', 0, 80),
            v_url, v_publicar, coalesce((p ->> 'ordem')::int, 0), v)
    returning id into v_id;
  else
    update materiais set tipo = v_tipo, titulo = interno.txt(p ->> 'titulo', 'titulo', 3, 120), descricao = interno.txt(p ->> 'descricao', 'descricao', 0, 600),
      campanha = interno.txt(p ->> 'campanha', 'campanha', 0, 80), url = v_url, ordem = coalesce((p ->> 'ordem')::int, 0),
      publicado = case when interno.coord() then v_publicar else false end
    where id = v_id and (interno.coord() or criado_por = v);
    if not found then perform interno.erro('nao_encontrado'); end if;
  end if;
  perform interno.registrar(case when v_publicar then 'material_publicado' else 'material_guardado' end, v_id::text, jsonb_build_object('titulo', p ->> 'titulo'));
  return jsonb_build_object('id', v_id, 'publicado', v_publicar);
end $$;

create or replace function public.material_remover(p_id uuid) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu();
begin
  delete from materiais where id = p_id and (interno.coord() or (criado_por = v and not publicado));
  if not found then perform interno.erro('nao_encontrado'); end if;
  perform interno.registrar('material_removido', p_id::text);
  return jsonb_build_object('ok', true);
end $$;

-- ───────────────────────────── Horas de voluntariado e certificados (versão de teste) ─────────────────────────────

create or replace function public.termo_meu() returns jsonb language sql stable security definer set search_path = interno, pg_temp as $$
  select (select jsonb_build_object('nome_completo', t.nome_completo, 'versao', t.versao, 'aceito_em', t.aceito_em) from termos_adesao t where t.usuario = auth.uid())
$$;

/** A pessoa lê o termo de adesão ao trabalho voluntário e registra o aceite com o nome completo. */
create or replace function public.termo_aceitar(p_nome_completo text, p_versao text) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu();
begin
  if not interno.voluntario() then perform interno.erro('sem_permissao'); end if;
  insert into termos_adesao (usuario, nome_completo, versao) values (v, interno.txt(p_nome_completo, 'nome_completo', 5, 120), interno.txt(p_versao, 'versao', 1, 20))
  on conflict (usuario) do update set nome_completo = excluded.nome_completo, versao = excluded.versao, aceito_em = now();
  perform interno.registrar('termo_aceito', v::text, jsonb_build_object('versao', p_versao));
  return public.termo_meu();
end $$;

create or replace function public.horas_registrar(p_dia date, p_horas numeric, p_atividade text) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); v_id uuid;
begin
  if not interno.voluntario() then perform interno.erro('sem_permissao'); end if;
  if not exists (select 1 from termos_adesao where usuario = v) then perform interno.erro('falta_termo'); end if;
  perform interno.limite('horas', 30, 1440);
  if p_dia is null or p_dia > current_date or p_dia < current_date - 400 then perform interno.erro('invalido:dia'); end if;
  if p_horas is null or p_horas <= 0 or p_horas > 12 then perform interno.erro('invalido:horas'); end if;
  if coalesce((select sum(horas) from horas where usuario = v and dia = p_dia and status <> 'recusada'), 0) + p_horas > 12 then perform interno.erro('invalido:horas'); end if;
  insert into horas (usuario, dia, horas, atividade) values (v, p_dia, round(p_horas, 1), interno.txt(p_atividade, 'atividade', 5, 300)) returning id into v_id;
  return jsonb_build_object('id', v_id);
end $$;

create or replace function public.horas_minhas() returns jsonb language sql stable security definer set search_path = interno, pg_temp as $$
  select jsonb_build_object(
    'confirmadas', coalesce((select sum(h.horas) from horas h where h.usuario = auth.uid() and h.status = 'confirmada'), 0),
    'lista', coalesce((select jsonb_agg(jsonb_build_object('id', h.id, 'dia', h.dia, 'horas', h.horas, 'atividade', h.atividade, 'status', h.status, 'certificado', h.certificado is not null) order by h.dia desc, h.criado_em desc)
                       from (select * from horas where usuario = auth.uid() order by dia desc limit 400) h), '[]'::jsonb))
$$;

create or replace function public.horas_remover(p_id uuid) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu();
begin
  delete from horas where id = p_id and usuario = v and status = 'pendente';
  if not found then perform interno.erro('nao_encontrado'); end if;
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.horas_fila() returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
begin
  perform interno.eu();
  if not interno.coord() then perform interno.erro('sem_permissao'); end if;
  return (select coalesce(jsonb_agg(jsonb_build_object('id', h.id, 'usuario', h.usuario, 'nome', f.nome, 'dia', h.dia, 'horas', h.horas, 'atividade', h.atividade, 'criado_em', h.criado_em) order by h.dia, h.criado_em), '[]'::jsonb)
          from horas h join perfis f on f.id = h.usuario where h.status = 'pendente');
end $$;

/** Liderança e vice-liderança conferem as horas dos outros; ninguém confere as próprias. */
create or replace function public.horas_conferir(p_id uuid, p_confirmar boolean) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu();
begin
  if not interno.coord() then perform interno.erro('sem_permissao'); end if;
  update horas set status = case when p_confirmar then 'confirmada' else 'recusada' end, conferido_por = v where id = p_id and status = 'pendente' and usuario <> v;
  if not found then perform interno.erro('nao_encontrado'); end if;
  perform interno.registrar(case when p_confirmar then 'horas_confirmadas' else 'horas_recusadas' end, p_id::text);
  return jsonb_build_object('ok', true);
end $$;

create or replace function interno.certificado_json(c interno.certificados) returns jsonb language sql stable as $$
  select jsonb_build_object('id', c.id, 'codigo', c.codigo, 'usuario', c.usuario, 'nome', c.nome, 'horas', c.horas, 'inicio', c.inicio, 'fim', c.fim,
    'atividades', c.atividades, 'testemunhas', c.testemunhas, 'status', c.status, 'emitido_em', c.emitido_em, 'criado_em', c.criado_em)
$$;

/**
 * A liderança abre o processo: escolhe a pessoa, o período e quem testemunha. As horas confirmadas do período
 * entram no certificado e deixam de valer para outro.
 */
create or replace function public.certificado_abrir(p jsonb) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare
  v uuid := interno.eu();
  v_usuario uuid := nullif(p ->> 'usuario', '')::uuid;
  v_inicio date := nullif(p ->> 'inicio', '')::date;
  v_fim date := nullif(p ->> 'fim', '')::date;
  v_nome text; v_horas numeric; v_id uuid := gen_random_uuid(); v_testemunhas jsonb := '[]'::jsonb; t text;
begin
  if not interno.lider() then perform interno.erro('sem_permissao'); end if;
  if v_usuario is null or v_usuario = v then perform interno.erro('invalido:usuario'); end if;
  if v_inicio is null or v_fim is null or v_fim < v_inicio then perform interno.erro('invalido:periodo'); end if;
  select nome_completo into v_nome from termos_adesao where usuario = v_usuario;
  if v_nome is null then perform interno.erro('falta_termo'); end if;
  if jsonb_typeof(coalesce(p -> 'testemunhas', '[]'::jsonb)) <> 'array' or jsonb_array_length(coalesce(p -> 'testemunhas', '[]'::jsonb)) > 5 then perform interno.erro('invalido:testemunhas'); end if;
  for t in select jsonb_array_elements_text(coalesce(p -> 'testemunhas', '[]'::jsonb)) loop
    if t::uuid = v_usuario or not exists (select 1 from papeis where usuario = t::uuid and papel in ('educacao', 'curadoria', 'vice')) then perform interno.erro('invalido:testemunhas'); end if;
    v_testemunhas := v_testemunhas || jsonb_build_array(jsonb_build_object('id', t, 'nome', (select nome from perfis where id = t::uuid), 'confirmou_em', null));
  end loop;
  select coalesce(sum(horas), 0) into v_horas from horas where usuario = v_usuario and status = 'confirmada' and certificado is null and dia between v_inicio and v_fim;
  if v_horas <= 0 then perform interno.erro('sem_horas'); end if;
  insert into certificados (id, codigo, usuario, nome, horas, inicio, fim, atividades, testemunhas)
  values (v_id, upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 12)), v_usuario, v_nome, v_horas, v_inicio, v_fim, interno.txt(p ->> 'atividades', 'atividades', 10, 3000), v_testemunhas);
  update horas set certificado = v_id where usuario = v_usuario and status = 'confirmada' and certificado is null and dia between v_inicio and v_fim;
  for t in select jsonb_array_elements_text(coalesce(p -> 'testemunhas', '[]'::jsonb)) loop
    perform interno.avisar(t::uuid, 'Você foi indicada(o) como testemunha de um certificado de horas de voluntariado. Abra "Horas e certificados" no painel para confirmar.');
  end loop;
  perform interno.registrar('certificado_aberto', v_usuario::text, jsonb_build_object('horas', v_horas));
  return jsonb_build_object('id', v_id, 'horas', v_horas);
end $$;

create or replace function public.certificado_testemunhar(p_id uuid) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); c certificados;
begin
  select * into c from certificados where id = p_id for update;
  if not found or c.status <> 'aberto' then perform interno.erro('nao_encontrado'); end if;
  if not exists (select 1 from jsonb_array_elements(c.testemunhas) x where x ->> 'id' = v::text and x ->> 'confirmou_em' is null) then perform interno.erro('sem_permissao'); end if;
  update certificados set testemunhas = (
    select jsonb_agg(case when x ->> 'id' = v::text then x || jsonb_build_object('confirmou_em', now()) else x end) from jsonb_array_elements(c.testemunhas) x)
  where id = p_id;
  perform interno.registrar('certificado_testemunhado', p_id::text);
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.certificado_emitir(p_id uuid) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); c certificados;
begin
  if not interno.lider() then perform interno.erro('sem_permissao'); end if;
  select * into c from certificados where id = p_id for update;
  if not found or c.status <> 'aberto' then perform interno.erro('nao_encontrado'); end if;
  if exists (select 1 from jsonb_array_elements(c.testemunhas) x where x ->> 'confirmou_em' is null) then perform interno.erro('falta_testemunha'); end if;
  update certificados set status = 'emitido', emitido_por = v, emitido_em = now() where id = p_id;
  perform interno.registrar('certificado_emitido', c.usuario::text, jsonb_build_object('codigo', c.codigo, 'horas', c.horas));
  perform interno.avisar(c.usuario, 'Seu certificado de horas de voluntariado foi emitido. Ele está em "Horas e certificados", no painel.');
  return jsonb_build_object('codigo', c.codigo);
end $$;

create or replace function public.certificado_cancelar(p_id uuid) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
begin
  perform interno.eu();
  if not interno.lider() then perform interno.erro('sem_permissao'); end if;
  update certificados set status = 'cancelado' where id = p_id and status <> 'cancelado';
  if not found then perform interno.erro('nao_encontrado'); end if;
  update horas set certificado = null where certificado = p_id;
  perform interno.registrar('certificado_cancelado', p_id::text);
  return jsonb_build_object('ok', true);
end $$;

/** A liderança vê todos; cada pessoa vê os próprios e aqueles em que é testemunha. */
create or replace function public.certificados_listar() returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu();
begin
  return (select coalesce(jsonb_agg(interno.certificado_json(c) order by c.criado_em desc), '[]'::jsonb) from certificados c
          where interno.coord() or c.usuario = v or exists (select 1 from jsonb_array_elements(c.testemunhas) x where x ->> 'id' = v::text));
end $$;

/** Conferência pública: a faculdade digita o código impresso no certificado e vê se ele é verdadeiro. */
create or replace function public.certificado_conferir(p_codigo text) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare c certificados; v_codigo text := upper(regexp_replace(coalesce(p_codigo, ''), '[^A-Za-z0-9]', '', 'g'));
begin
  perform interno.limite('conferir', 20, 60);
  select * into c from certificados where codigo = v_codigo and status in ('emitido', 'cancelado');
  if not found then return jsonb_build_object('encontrado', false); end if;
  if c.status = 'cancelado' then return jsonb_build_object('encontrado', true, 'valido', false); end if;
  return jsonb_build_object('encontrado', true, 'valido', true, 'nome', c.nome, 'horas', c.horas, 'inicio', c.inicio, 'fim', c.fim,
    'atividades', c.atividades, 'emitido_em', c.emitido_em, 'testemunhas', (select coalesce(jsonb_agg(x ->> 'nome'), '[]'::jsonb) from jsonb_array_elements(c.testemunhas) x));
end $$;

-- ───────────────────────────── Arquivos enviados pela equipe ─────────────────────────────

create or replace function public.arquivo_bloquear(p_sha256 text, p_motivo text) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
begin
  perform interno.eu();
  if not interno.curador() then perform interno.erro('sem_permissao'); end if;
  if coalesce(p_sha256, '') !~ '^[a-f0-9]{64}$' then perform interno.erro('invalido:sha256'); end if;
  insert into arquivos_bloqueados (sha256, motivo) values (p_sha256, interno.txt(p_motivo, 'motivo', 0, 200)) on conflict do nothing;
  perform interno.registrar('arquivo_bloqueado', p_sha256);
  return jsonb_build_object('ok', true);
end $$;

/** Para a rotina de publicação: impressões digitais que não podem entrar no site. Só com a chave de serviço. */
create or replace function public.arquivos_bloqueados() returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
begin
  if not interno.servico() then perform interno.erro('sem_permissao'); end if;
  return (select coalesce(jsonb_agg(sha256), '[]'::jsonb) from arquivos_bloqueados);
end $$;

/** Faxina periódica: apaga o que não precisa mais existir. Roda sozinha onde o agendador do banco estiver ligado. */
create or replace function interno.limpeza() returns void language plpgsql security definer set search_path = interno, pg_temp as $$
begin
  delete from limites where janela < now() - interval '2 days';
  delete from avisos where (lido and criado_em < now() - interval '30 days') or criado_em < now() - interval '120 days';
  delete from auditoria where criado_em < now() - interval '400 days';
  delete from aparelhos where ultimo < now() - interval '180 days';
  delete from reforco where status in ('atendido', 'cancelado') and criado_em < now() - interval '180 days';
  delete from denuncias where status = 'resolvida' and criado_em < now() - interval '365 days';
  -- O serviço de contas guarda endereço de rede nos próprios registros; apagamos os antigos onde isso é permitido.
  begin
    execute $q$delete from auth.audit_log_entries where created_at < now() - interval '30 days'$q$;
  exception when others then null;
  end;
end $$;

-- ───────────────────────────── Painel ─────────────────────────────

create or replace function public.painel_resumo() returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu();
begin
  return jsonb_build_object(
    'fila', case when interno.voluntario() then (select count(*) from contribuicoes c where c.status = 'pendente' and interno.ve_item(c)) else 0 end,
    'aguardando_publicacao', case when interno.curador() then (select count(*) from contribuicoes where status = 'aprovada') else 0 end,
    'candidaturas', case when interno.coord() then (select count(*) from candidaturas where status = 'pendente') else 0 end,
    'denuncias', case when interno.curador() then (select count(*) from denuncias where status = 'aberta') else 0 end,
    'anotacoes', case when interno.cuida() then (select count(*) from anotacoes where status = 'pendente') else 0 end,
    'retidos', case when interno.cuida() then (select count(*) from topicos where retido) + (select count(*) from respostas where retido) else 0 end,
    'mural', case when interno.curador() then (select count(*) from mural where status = 'pendente') else 0 end,
    'reforco', case when interno.curador() or interno.tem('mentoria') or interno.tem('educacao')
                    then (select count(*) from reforco r where r.status = 'aberto' and interno.mentor(r.disciplina)) else 0 end,
    'horas', case when interno.coord() then (select count(*) from horas where status = 'pendente' and usuario <> v) else 0 end,
    'testemunhar', (select count(*) from certificados c where c.status = 'aberto'
                    and exists (select 1 from jsonb_array_elements(c.testemunhas) x where x ->> 'id' = v::text and x ->> 'confirmou_em' is null)),
    'minhas', (select count(*) from contribuicoes where autor = v));
end $$;

-- ───────────────────────────── Permissões ─────────────────────────────

-- As funções internas não podem ser chamadas de fora; as públicas, sim (cada uma faz a própria conferência).
do $$
declare f record;
begin
  for f in select p.oid::regprocedure as assinatura, n.nspname from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname in ('interno', 'public') and p.prokind = 'f'
           and (n.nspname = 'interno' or p.proname in (
             'eu', 'perfil_salvar', 'conta_apagar', 'candidatar', 'candidaturas_minhas', 'candidaturas_listar', 'candidatura_decidir', 'voluntarios_listar',
             'papel_conceder', 'papel_remover', 'usuario_suspender', 'equipe', 'promover_coordenacao', 'contribuir', 'contribuicoes_minhas', 'fila',
             'contribuicao_ver', 'contribuicao_editar', 'parecer', 'contribuicao_decidir', 'publicacoes_pendentes', 'publicacoes_marcar', 'topicos_listar',
             'topico_ver', 'topico_criar', 'responder', 'votar', 'comunidade_cuidar', 'denunciar', 'denuncias_listar', 'denuncia_resolver', 'anotacoes_listar',
             'anotar', 'anotacoes_fila', 'anotacao_decidir', 'apoiadores_listar', 'apoiador_salvar', 'apoiador_remover', 'radio_estado', 'radio_configurar',
             'radio_canal_salvar', 'radio_canal_remover', 'radio_faixa_salvar', 'radio_faixa_remover', 'progresso_salvar', 'progresso_listar', 'painel_resumo',
             'mural_listar', 'mural_enviar', 'mural_meus', 'mural_remover', 'mural_renovar', 'mural_fila', 'mural_decidir',
             'lideranca_passar', 'sucessao_definir', 'sucessao_ver', 'seguranca_ver', 'seguranca_configurar', 'acesso_registrar', 'aparelhos_meus',
             'aparelho_esquecer', 'avisos_meus', 'aviso_ler', 'auditoria_listar', 'exportar_usuarios', 'admin_senhas', 'chaves_api', 'resposta_aceitar',
             'comunidade_retidos', 'filtro_listar', 'filtro_salvar', 'abertura', 'abertura_salvar', 'reforco_pedir', 'reforco_meus', 'reforco_cancelar',
             'reforco_fila', 'reforco_assumir', 'reforco_soltar', 'reforco_concluir', 'equipe_canais', 'equipe_listar', 'equipe_escrever', 'equipe_marcar',
             'equipe_apagar', 'equipe_sala_salvar', 'materiais_listar', 'material_salvar', 'material_remover', 'termo_meu', 'termo_aceitar',
             'horas_registrar', 'horas_minhas', 'horas_remover', 'horas_fila', 'horas_conferir', 'certificado_abrir', 'certificado_testemunhar',
             'certificado_emitir', 'certificado_cancelar', 'certificados_listar', 'certificado_conferir', 'arquivo_bloquear', 'arquivos_bloqueados'))
  loop
    execute format('revoke all on function %s from public', f.assinatura);
    if f.nspname = 'public' then
      execute format('grant execute on function %s to anon, authenticated, service_role', f.assinatura);
    else
      execute format('revoke all on function %s from anon, authenticated', f.assinatura);
    end if;
  end loop;
end $$;
revoke all on function public.promover_coordenacao(text) from anon, authenticated;

-- ───────────────────────────── Arquivos da rádio ─────────────────────────────

-- Um depósito público só para leitura; só a coordenação envia ou apaga. Limite de 50 MB e só áudio.
do $$
begin
  if exists (select 1 from pg_namespace where nspname = 'storage') then
    insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    values ('radio', 'radio', true, 52428800, array['audio/ogg', 'audio/opus', 'audio/mpeg', 'audio/mp4', 'audio/webm'])
    on conflict (id) do update set public = true, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

    execute 'drop policy if exists "radio_envio_coordenacao" on storage.objects';
    execute 'create policy "radio_envio_coordenacao" on storage.objects for insert to authenticated with check (bucket_id = ''radio'' and interno.coord())';
    execute 'drop policy if exists "radio_remocao_coordenacao" on storage.objects';
    execute 'create policy "radio_remocao_coordenacao" on storage.objects for delete to authenticated using (bucket_id = ''radio'' and interno.coord())';
    -- A regra acima chama interno.tem, então quem está logado precisa poder executá-la.
    execute 'grant usage on schema interno to authenticated';
    execute 'grant execute on function interno.tem(text, text) to authenticated';
    execute 'grant execute on function interno.coord() to authenticated';
  end if;
end $$;

-- ───────────────────────────── Arquivos enviados pela equipe (imagens de aula e materiais) ─────────────────────────────

-- Depósito fechado: ninguém de fora lê. A equipe envia para a própria pasta; a publicação do site copia
-- o que foi aprovado para dentro do próprio site e apaga daqui. Imagens chegam já convertidas no navegador,
-- sem nenhum dado embutido (local, aparelho, autor).
do $$
begin
  if exists (select 1 from pg_namespace where nspname = 'storage') then
    insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    values ('envios', 'envios', false, 8388608, array['image/webp', 'application/pdf'])
    on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

    execute 'drop policy if exists "envios_envio" on storage.objects';
    execute 'create policy "envios_envio" on storage.objects for insert to authenticated with check (bucket_id = ''envios'' and interno.envia() and (storage.foldername(name))[1] = auth.uid()::text)';
    execute 'drop policy if exists "envios_leitura" on storage.objects';
    execute 'create policy "envios_leitura" on storage.objects for select to authenticated using (bucket_id = ''envios'' and ((storage.foldername(name))[1] = auth.uid()::text or interno.curador() or interno.tem(''revisao'')))';
    execute 'drop policy if exists "envios_remocao" on storage.objects';
    execute 'create policy "envios_remocao" on storage.objects for delete to authenticated using (bucket_id = ''envios'' and ((storage.foldername(name))[1] = auth.uid()::text or interno.curador()))';
    execute 'grant execute on function interno.envia() to authenticated';
    execute 'grant execute on function interno.curador() to authenticated';
    execute 'grant execute on function interno.coord() to authenticated';
    execute 'grant execute on function interno.lider() to authenticated';
  end if;
end $$;

-- ───────────────────────────── Faxina agendada ─────────────────────────────

-- Onde o agendador do banco (pg_cron) estiver ligado, a faxina roda toda madrugada. Sem ele, nada quebra:
-- cada função já apaga o que é velho de vez em quando.
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule('lucia-faxina', '17 6 * * *', 'select interno.limpeza()');
  end if;
exception when others then null;
end $$;
