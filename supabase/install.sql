-- Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
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
-- Crie a primeira conta no painel do serviço de contas (Authentication → Users → Add user) e torne-a coordenação rodando aqui:
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
-- Quem mexeu por último e quando: é o que impede duas pessoas de sobrescreverem uma à outra.
alter table interno.contribuicoes add column if not exists editado_em timestamptz;
alter table interno.contribuicoes add column if not exists editado_por uuid references interno.perfis (id) on delete set null;

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
-- Só texto, sem imagem nem arquivo. Todo anúncio passa pela coordenação ou pela mediação e vence sozinho, para o mural não envelhecer.
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
-- O veredito da avaliação automática de cada mensagem da Comunidade e o motivo dele. 'revista' é a bloqueada que a equipe liberou depois.
alter table interno.topicos add column if not exists avaliacao text check (avaliacao is null or avaliacao in ('publicada', 'revisao', 'bloqueada', 'revista'));
alter table interno.topicos add column if not exists motivo text not null default '';
alter table interno.respostas add column if not exists avaliacao text check (avaliacao is null or avaliacao in ('publicada', 'revisao', 'bloqueada', 'revista'));
alter table interno.respostas add column if not exists motivo text not null default '';

-- Papéis e tipos de contribuição acrescentados depois da primeira instalação.
do $$
begin
  alter table interno.papeis drop constraint if exists papeis_papel_check;
  alter table interno.papeis add constraint papeis_papel_check
    check (papel in ('coordenacao', 'vice', 'curadoria', 'mediacao', 'educacao', 'revisao', 'traducao', 'jornalismo', 'mentoria', 'design', 'desenvolvimento'));
  alter table interno.candidaturas drop constraint if exists candidaturas_papel_check;
  alter table interno.candidaturas add constraint candidaturas_papel_check
    check (papel in ('curadoria', 'mediacao', 'educacao', 'revisao', 'traducao', 'jornalismo', 'mentoria', 'design', 'desenvolvimento'));
  alter table interno.contribuicoes drop constraint if exists contribuicoes_tipo_check;
  alter table interno.contribuicoes add constraint contribuicoes_tipo_check
    check (tipo in ('aula', 'obra', 'artigo', 'checagem', 'debate', 'verbete', 'memorial', 'video', 'frase', 'traducao', 'correcao', 'sugestao', 'questao'));
end $$;

-- Triagem: o que vem de fora passa primeiro pela mediação, que corta spam, vandalismo e envio sem forma antes de
-- chegar à fila de revisão. O que já estava na fila e o que a equipe escreve seguem direto ('liberada').
alter table interno.contribuicoes add column if not exists triagem text not null default 'liberada' check (triagem in ('aguardando', 'liberada'));

-- Candidaturas de voluntariado feitas pelo formulário público, por quem ainda não tem conta. O e-mail só aparece para a
-- coordenação. Aceita, vira um convite pessoal (ou a função direto, se a pessoa já tiver conta com o e-mail confirmado).
create table if not exists interno.inscricoes (
  id uuid primary key default gen_random_uuid(),
  nome text not null check (char_length(nome) between 5 and 120),
  email text not null check (char_length(email) between 5 and 200),
  papel text not null check (papel in ('curadoria', 'mediacao', 'educacao', 'revisao', 'traducao', 'jornalismo', 'mentoria', 'design', 'desenvolvimento')),
  disciplina text check (disciplina is null or disciplina ~ '^[a-z0-9-]{2,40}$'),
  mensagem text not null check (char_length(mensagem) between 30 and 2000),
  status text not null default 'pendente' check (status in ('pendente', 'aceita', 'recusada')),
  decidido_por uuid references interno.perfis (id) on delete set null,
  decidido_em timestamptz,
  criado_em timestamptz not null default now()
);
create index if not exists inscricoes_status on interno.inscricoes (status, criado_em);

-- Banimentos decididos pela mediação. A conta fica suspensa; em caso extremo, a origem dos envios também é barrada.
-- "origem" é o mesmo código embaralhado que conta os envios (interno.origem): o endereço de rede em si não é guardado.
alter table interno.perfis add column if not exists origem text;
create table if not exists interno.banimentos (
  id uuid primary key default gen_random_uuid(),
  usuario uuid references interno.perfis (id) on delete set null,
  nome text not null default '',
  origem text,
  motivo text not null check (char_length(motivo) between 5 and 300),
  por uuid references interno.perfis (id) on delete set null,
  ativo boolean not null default true,
  encerrado_por uuid references interno.perfis (id) on delete set null,
  encerrado_em timestamptz,
  criado_em timestamptz not null default now()
);
create index if not exists banimentos_origem on interno.banimentos (origem) where ativo and origem is not null;

-- Registro de atividades: quem fez o quê no painel. Só a coordenação lê. Não guarda endereço de ninguém.
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

-- Ordem de quem assume a coordenação se ela ficar sem acesso por mais de 90 dias.
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

-- Materiais de campanha e de agitação (zines, panfletos, cartazes). Só a coordenação publica.
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

-- Arquivos avulsos enviados pela equipe (imagem do aviso de abertura, panfleto em PDF). Só a coordenação aprova;
-- a publicação do site copia o arquivo aprovado para dentro do próprio site e anota aqui o endereço final.
create table if not exists interno.arquivos (
  id uuid primary key default gen_random_uuid(),
  caminho text not null unique check (caminho ~ '^[0-9a-f-]{36}/[a-z0-9-]{8,60}[.](webp|jpg|pdf)$'),
  nome text not null check (char_length(nome) between 3 and 120),
  dono uuid references interno.perfis (id) on delete set null,
  status text not null default 'pendente' check (status in ('pendente', 'aprovado', 'recusado', 'publicado')),
  destino text not null default '' check (destino = '' or destino ~ '^/arquivos/[a-f0-9]{20}[.](webp|jpg|pdf)$'),
  criado_em timestamptz not null default now()
);

insert into interno.configuracoes (chave, valor) values
  ('seguranca', '{"exigir_2fa": true, "padrao_ligado": true}'::jsonb),
  ('abertura', '{"definido": false}'::jsonb),
  ('equipe', '{"sala": ""}'::jsonb)
on conflict do nothing;

-- A exigência de segundo fator para coordenação, vice-coordenação e curadoria nasce ligada. Banco instalado antes
-- disso é virado uma única vez; daí em diante vale o que a coordenação decidir no painel.
update interno.configuracoes set valor = valor || '{"exigir_2fa": true, "padrao_ligado": true}'::jsonb
where chave = 'seguranca' and not valor ? 'padrao_ligado';

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

-- ───────────────────────────── Convites, anúncios sem conta e apoio a arquivos ─────────────────────────────

-- Não existe cadastro aberto: só entra quem recebe um convite da coordenação. O convite guarda o selo
-- (resumo) do código, nunca o código: quem ler esta tabela não consegue usar nenhum convite.
create table if not exists interno.convites (
  id uuid primary key default gen_random_uuid(),
  selo text not null unique check (selo ~ '^[a-f0-9]{64}$'),
  email text not null default '' check (char_length(email) <= 200),
  papel text check (papel is null or papel in ('vice', 'curadoria', 'mediacao', 'educacao', 'revisao', 'traducao', 'jornalismo', 'mentoria', 'design', 'desenvolvimento')),
  disciplina text check (disciplina is null or disciplina ~ '^[a-z0-9-]{2,40}$'),
  usos_max integer not null default 1 check (usos_max between 1 and 200),
  usos integer not null default 0,
  nota text not null default '' check (char_length(nota) <= 120),
  criado_por uuid references interno.perfis (id) on delete set null,
  criado_em timestamptz not null default now(),
  expira_em timestamptz not null,
  revogado boolean not null default false
);
-- Função acrescentada depois da primeira instalação: o convite também pode trazer a mediação.
alter table interno.convites drop constraint if exists convites_papel_check;
alter table interno.convites add constraint convites_papel_check
  check (papel is null or papel in ('vice', 'curadoria', 'mediacao', 'educacao', 'revisao', 'traducao', 'jornalismo', 'mentoria', 'design', 'desenvolvimento'));
create table if not exists interno.convites_usos (
  usuario uuid primary key,
  convite uuid references interno.convites (id) on delete set null,
  criado_em timestamptz not null default now()
);

-- O mural e o reforço aceitam pedidos de quem não tem conta. O anúncio sem conta leva um código de retirada.
alter table interno.mural alter column autor drop not null;
alter table interno.mural add column if not exists oficio text not null default '' check (char_length(oficio) <= 60);
alter table interno.mural add column if not exists codigo text check (codigo is null or codigo ~ '^[a-f0-9]{64}$');
create index if not exists mural_lugar on interno.mural (uf, cidade);
alter table interno.reforco alter column autor drop not null;

-- Imagem ou PDF enviado pela equipe só vai para a decisão da coordenação depois do apoio de colegas.
create table if not exists interno.arquivos_apoios (
  arquivo uuid not null references interno.arquivos (id) on delete cascade,
  usuario uuid not null references interno.perfis (id) on delete cascade,
  criado_em timestamptz not null default now(),
  primary key (arquivo, usuario)
);

-- A conversa da equipe só guarda texto cifrado. O que foi escrito antes disso é apagado.
delete from interno.equipe_mensagens where corpo !~ '^c1[.]';

-- Segunda leva do filtro: apologia ao nazismo e ameaças. Posta uma única vez.
do $$
begin
  if not exists (select 1 from interno.configuracoes where chave = 'filtro' and valor ? 'segunda_leva') then
    insert into interno.termos_vetados (termo) values
      ('viva hitler'), ('hitler tinha razao'), ('hitler estava certo'), ('viva o nazismo'), ('nazismo e bom'), ('holocausto e mentira'),
      ('holocausto nao existiu'), ('holocausto nunca existiu'), ('gas neles'), ('camara de gas neles'),
      ('viva ustra'), ('ustra vive'), ('morte aos comunistas'), ('morte aos petistas'), ('morte aos nordestinos'), ('morte aos indios'),
      ('morte as mulheres'), ('comunista bom e comunista morto'), ('petista bom e petista morto'), ('nordestino imundo'), ('indio imundo'),
      ('vou te matar'), ('vou matar voce'), ('vou matar voces'), ('vou te achar'), ('sei onde voce mora'), ('voce vai morrer'),
      ('voces vao morrer'), ('vou acabar com voce'), ('merece morrer'), ('merecem morrer'), ('vou te estuprar'),
      ('merece ser estuprada'), ('vou explodir'), ('vou atirar em'), ('vou meter bala')
    on conflict do nothing;
    insert into interno.configuracoes (chave, valor) values ('filtro', '{"semeado": true, "segunda_leva": true}'::jsonb)
    on conflict (chave) do update set valor = interno.configuracoes.valor || '{"segunda_leva": true}'::jsonb;
  end if;
end $$;

-- Expressão grave bloqueia a mensagem da Comunidade na hora; as outras só a mandam para a fila de revisão. As frases de
-- ameaça e de apologia ao ódio da lista inicial são marcadas uma única vez; termo novo entra sempre como "segura para leitura".
alter table interno.termos_vetados add column if not exists grave boolean not null default false;
do $$
begin
  if not exists (select 1 from interno.configuracoes where chave = 'filtro' and valor ? 'graves_marcados') then
    update interno.termos_vetados set grave = true where termo in (
      'heil hitler', 'sieg heil', 'poder branco', 'white power', 'morte aos gays', 'morte aos negros', 'morte aos judeus', 'volta pra senzala',
      'viva hitler', 'hitler tinha razao', 'hitler estava certo', 'viva o nazismo', 'nazismo e bom', 'holocausto e mentira',
      'holocausto nao existiu', 'holocausto nunca existiu', 'gas neles', 'camara de gas neles', 'viva ustra', 'ustra vive',
      'morte aos comunistas', 'morte aos petistas', 'morte aos nordestinos', 'morte aos indios', 'morte as mulheres',
      'comunista bom e comunista morto', 'petista bom e petista morto',
      'vou te matar', 'vou matar voce', 'vou matar voces', 'sei onde voce mora', 'voce vai morrer', 'voces vao morrer', 'vou te estuprar', 'merece ser estuprada');
    insert into interno.configuracoes (chave, valor) values ('filtro', '{"graves_marcados": true}'::jsonb)
    on conflict (chave) do update set valor = interno.configuracoes.valor || '{"graves_marcados": true}'::jsonb;
  end if;
end $$;

-- Quem pediu para receber o boletim do jornal. Só o endereço, nada mais.
create table if not exists interno.boletim (
  email text primary key check (email ~ '^[^@[:space:]]+@[^@[:space:]]+[.][^@[:space:]]+$' and char_length(email) <= 200),
  criado_em timestamptz not null default now()
);

-- Trabalho em conjunto: quem escreve libera a própria contribuição para colegas específicos, enquanto ela está pendente.
create table if not exists interno.colaboradores (
  contribuicao uuid not null references interno.contribuicoes (id) on delete cascade,
  usuario uuid not null references interno.perfis (id) on delete cascade,
  concedido_por uuid references interno.perfis (id) on delete set null,
  criado_em timestamptz not null default now(),
  primary key (contribuicao, usuario)
);

-- Conversas da equipe: privadas (duas pessoas) ou em grupo. As mensagens chegam cifradas, como as da rede interna.
create table if not exists interno.conversas (
  id uuid primary key default gen_random_uuid(),
  tipo text not null check (tipo in ('direta', 'grupo')),
  nome text not null default '' check (char_length(nome) <= 60),
  -- Só nas privadas: os dois participantes, em ordem, para existir uma única conversa por dupla.
  par text unique,
  criada_por uuid references interno.perfis (id) on delete set null,
  criado_em timestamptz not null default now(),
  movida_em timestamptz not null default now()
);
create table if not exists interno.conversa_membros (
  conversa uuid not null references interno.conversas (id) on delete cascade,
  usuario uuid not null references interno.perfis (id) on delete cascade,
  lido_em timestamptz not null default now(),
  entrou_em timestamptz not null default now(),
  primary key (conversa, usuario)
);
create index if not exists conversa_membros_usuario on interno.conversa_membros (usuario);
create table if not exists interno.conversa_mensagens (
  id uuid primary key default gen_random_uuid(),
  conversa uuid not null references interno.conversas (id) on delete cascade,
  autor uuid references interno.perfis (id) on delete set null,
  corpo text not null check (char_length(corpo) between 1 and 4000),
  criado_em timestamptz not null default clock_timestamp()
);
create index if not exists conversa_mensagens_ordem on interno.conversa_mensagens (conversa, criado_em);

-- Livro do acervo: toda inserção, edição, exclusão, aprovação, recusa e publicação no que vai para o site, e toda
-- função dada ou tirada. Quem escreve aqui é o próprio banco, por gatilho: vale também para o que for mudado direto
-- no SQL Editor ou pela rotina de publicação. Não guarda o texto de nada, só o título e o nome dos campos que mudaram.
-- Ninguém edita nem apaga uma linha; elas saem sozinhas depois de 400 dias, como o registro de atividades.
create table if not exists interno.audit_logs (
  id bigint generated always as identity primary key,
  criado_em timestamptz not null default clock_timestamp(),
  tabela text not null,
  registro text not null default '',
  acao text not null check (acao in ('insercao', 'edicao', 'exclusao', 'aprovacao', 'recusa', 'publicacao')),
  quem uuid,
  -- Por onde a mudança entrou: 'anon', 'authenticated', 'service_role' (rotina de publicação) ou 'banco' (SQL Editor e rotinas internas).
  via text not null default '',
  titulo text not null default '',
  de text,
  para text,
  campos text[] not null default '{}',
  detalhes jsonb not null default '{}'::jsonb
);
create index if not exists audit_logs_tabela on interno.audit_logs (tabela, id desc);

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

/** Esta conta cadastrou e confirmou um aplicativo autenticador? (Só onde o serviço de contas guarda essa informação.) */
create or replace function interno.tem_fator() returns boolean language plpgsql stable security definer set search_path = interno, pg_temp as $$
declare v boolean := false;
begin
  if auth.uid() is null or to_regclass('auth.mfa_factors') is null then return false; end if;
  execute 'select exists (select 1 from auth.mfa_factors m where m.user_id = $1 and m.status = ''verified'')' into v using auth.uid();
  return coalesce(v, false);
end $$;

/**
 * A pessoa tem este papel? Com a exigência de segundo fator ligada, coordenação, vice-coordenação e curadoria
 * só valem em sessão confirmada pelo aplicativo autenticador: senha ou link roubado, sozinhos, não abrem nada.
 * E quem cadastrou o aplicativo por conta própria, em qualquer função, só usa a função depois de digitar o código.
 */
create or replace function interno.tem(p_papel text, p_disciplina text default null) returns boolean
language sql stable security definer set search_path = interno, pg_temp as $$
  select auth.uid() is not null
    and (p_papel not in ('coordenacao', 'vice', 'curadoria') or not interno.exige_2fa() or interno.aal2())
    and (interno.aal2() or not interno.tem_fator())
    and exists (
      select 1 from papeis p join perfis f on f.id = p.usuario
      where p.usuario = auth.uid() and not f.suspenso and p.papel = p_papel
        and (p_disciplina is null or p.disciplina is null or p.disciplina = p_disciplina)
    )
$$;

/** Coordenação comunitária: uma pessoa, com a palavra final. */
create or replace function interno.lider() returns boolean language sql stable as $$ select interno.tem('coordenacao') $$;
/** Coordenação ou vice-coordenação: tudo o que a coordenação faz, menos mexer na própria coordenação. */
create or replace function interno.coord() returns boolean language sql stable as $$ select interno.tem('coordenacao') or interno.tem('vice') $$;
/** Curadoria: quem aprova e recusa. Coordenação e vice-coordenação também podem. */
create or replace function interno.curador() returns boolean language sql stable as $$ select interno.coord() or interno.tem('curadoria') $$;
/** Faz parte da equipe? Como em interno.tem: quem cadastrou o aplicativo autenticador só conta depois de digitar o código. */
create or replace function interno.voluntario() returns boolean language sql stable security definer set search_path = interno, pg_temp as $$
  select auth.uid() is not null and (interno.aal2() or not interno.tem_fator())
    and exists (select 1 from papeis p join perfis f on f.id = p.usuario where p.usuario = auth.uid() and not f.suspenso)
$$;
/** Esta contribuição foi aberta para mim por quem a escreveu? */
create or replace function interno.colabora(p_contribuicao uuid) returns boolean language sql stable security definer set search_path = interno, pg_temp as $$
  select auth.uid() is not null and (interno.aal2() or not interno.tem_fator())
    and exists (select 1 from colaboradores k join perfis f on f.id = k.usuario where k.contribuicao = p_contribuicao and k.usuario = auth.uid() and not f.suspenso)
$$;
/** Quem pode cuidar da comunidade: coordenação, curadoria, mediação e educadores. */
create or replace function interno.cuida() returns boolean language sql stable as $$ select interno.curador() or interno.tem('educacao') or interno.tem('mediacao') $$;
/** Mediação: a primeira leitura do que o público envia. Curadoria e coordenação também podem. */
create or replace function interno.media() returns boolean language sql stable as $$ select interno.curador() or interno.tem('mediacao') $$;
/** Rádio: o jornalismo também é a rádio. Quem escreve o jornal cuida dos canais, das faixas e do que vai ao ar. */
create or replace function interno.radialista() returns boolean language sql stable as $$ select interno.coord() or interno.tem('jornalismo') $$;
/** O Mural dos Trabalhadores é decidido pela coordenação e pela mediação. */
create or replace function interno.media_mural() returns boolean language sql stable as $$ select interno.coord() or interno.tem('mediacao') $$;
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
 * Política da aranha: se ninguém da coordenação entra há mais de 90 dias, ela passa para a primeira pessoa
 * da ordem de sucessão que esteve por aqui no último mês. Quem saiu continua na equipe, como vice-coordenação.
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
  values (null, 'sistema', 'sucessao_automatica', v_novo::text, jsonb_build_object('motivo', 'coordenação sem acesso há mais de 90 dias'));
  perform interno.avisar(v_novo, 'A coordenação do instituto passou para você: a pessoa anterior ficou mais de 90 dias sem entrar. Ela continua na equipe, como vice-coordenação.');
end $$;

/** O endereço que a borda da rede informa não pode ser forjado por quem chama; sem ele, vale o primeiro da fila. */
create or replace function interno.origem() returns text language sql stable as $$
  select md5('lucia:' || coalesce(
    nullif(nullif(current_setting('request.headers', true), '')::json ->> 'cf-connecting-ip', ''),
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
  update perfis set visto_em = now(), origem = interno.origem()
  where id = v and (visto_em < now() - interval '1 hour' or origem is distinct from interno.origem());
  perform interno.sucessao_conferir();
  return (
    select jsonb_build_object(
      'id', f.id, 'nome', f.nome, 'bio', f.bio, 'suspenso', f.suspenso,
      'papeis', coalesce((select jsonb_agg(jsonb_build_object('id', p.id, 'papel', p.papel, 'disciplina', p.disciplina) order by p.papel, p.disciplina)
                          from papeis p where p.usuario = f.id), '[]'::jsonb),
      'segundo_fator', interno.aal2(),
      'exige_segundo_fator', interno.tem_fator() or (interno.exige_2fa() and exists (select 1 from papeis p where p.usuario = f.id and p.papel in ('coordenacao', 'vice', 'curadoria'))),
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
  -- Senha roubada, sozinha, não apaga a conta de quem cadastrou o aplicativo autenticador.
  if interno.tem_fator() and not interno.aal2() then perform interno.erro('confirme_segundo_fator'); end if;
  -- Olha o papel direto na tabela: interno.coord() responde "não" em sessão sem o segundo fator, e a trava deixaria de valer.
  if exists (select 1 from papeis where usuario = v and papel = 'coordenacao') and (select count(*) from papeis where papel = 'coordenacao') <= 1 then
    perform interno.erro('ultima_coordenacao');
  end if;
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
  if p_papel not in ('curadoria', 'mediacao', 'educacao', 'revisao', 'traducao', 'jornalismo', 'mentoria', 'design', 'desenvolvimento') then perform interno.erro('invalido:papel'); end if;
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
 * Busca de pessoas por nome ou e-mail, para confiar uma função sem carregar a lista inteira de contas.
 * Só a coordenação (a resposta traz e-mails). Devolve no máximo vinte, e nada com menos de duas letras.
 */
create or replace function public.pessoas_buscar(p_busca text) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v_busca text := lower(btrim(left(coalesce(p_busca, ''), 120))); v_nome text;
begin
  perform interno.eu();
  if not interno.coord() then perform interno.erro('sem_permissao'); end if;
  if char_length(v_busca) < 2 then return '[]'::jsonb; end if;
  perform interno.limite('pessoas_buscar', 600, 60);
  v_nome := interno.normal(v_busca);
  return (
    select coalesce(jsonb_agg(jsonb_build_object('id', x.id, 'nome', x.nome, 'email', x.email, 'suspenso', x.suspenso) order by x.nome), '[]'::jsonb)
    from (select f.id, f.nome, u.email, f.suspenso
          from perfis f join auth.users u on u.id = f.id
          where position(v_busca in lower(coalesce(u.email, ''))) > 0 or (v_nome <> '' and position(v_nome in interno.normal(f.nome)) > 0)
          order by f.nome limit 20) x);
end $$;

/**
 * Confiar um papel. Coordenação e vice-coordenação confiam os papéis de trabalho; só a coordenação nomeia a vice-coordenação.
 * A coordenação em si não se concede por aqui: ela muda de mãos por lideranca_passar ou pela ordem de sucessão.
 */
create or replace function public.papel_conceder(p_usuario uuid, p_papel text, p_disciplina text) returns jsonb
language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu();
begin
  if not interno.coord() then perform interno.erro('sem_permissao'); end if;
  if p_papel not in ('vice', 'curadoria', 'mediacao', 'educacao', 'revisao', 'traducao', 'jornalismo', 'mentoria', 'design', 'desenvolvimento') then perform interno.erro('invalido:papel'); end if;
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
  -- A vice-coordenação não mexe na coordenação nem em outra vice-coordenação.
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
  -- Ninguém suspende a coordenação pelo painel, e só ela suspende a vice-coordenação.
  if exists (select 1 from papeis where usuario = p_usuario and papel = 'coordenacao') then perform interno.erro('sem_permissao'); end if;
  if exists (select 1 from papeis where usuario = p_usuario and papel = 'vice') and not interno.lider() then perform interno.erro('sem_permissao'); end if;
  update perfis set suspenso = p_suspenso where id = p_usuario;
  if not found then perform interno.erro('nao_encontrado'); end if;
  if not p_suspenso then update banimentos set ativo = false, encerrado_por = v, encerrado_em = now() where usuario = p_usuario and ativo; end if;
  perform interno.registrar(case when p_suspenso then 'conta_suspensa' else 'conta_reativada' end, p_usuario::text);
  return jsonb_build_object('ok', true);
end $$;

/** A coordenação entrega o posto a outra pessoa e passa a ser vice-coordenação. */
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
  perform interno.avisar(p_usuario, 'A coordenação do instituto foi passada para você.');
  return jsonb_build_object('ok', true);
end $$;

/** Ordem de sucessão: quem assume, e em que ordem, se a coordenação ficar mais de 90 dias sem entrar. */
create or replace function public.sucessao_definir(p_usuarios uuid[]) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); v_lista uuid[] := coalesce(p_usuarios, '{}');
begin
  if not interno.lider() then perform interno.erro('sem_permissao'); end if;
  if coalesce(array_length(v_lista, 1), 0) > 10 then perform interno.erro('invalido:usuarios'); end if;
  if (select count(distinct x) from unnest(v_lista) x) <> coalesce(array_length(v_lista, 1), 0) then perform interno.erro('invalido:usuarios'); end if;
  if exists (select 1 from unnest(v_lista) x where x = v or not exists (select 1 from perfis f where f.id = x and not f.suspenso)) then perform interno.erro('invalido:usuarios'); end if;
  delete from sucessao where true;
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
  on conflict (chave) do update set valor = configuracoes.valor || excluded.valor;
  perform interno.registrar('seguranca_configurada', '', jsonb_build_object('exigir_2fa', coalesce(p_exigir_2fa, false)));
  return jsonb_build_object('exigir_2fa', coalesce(p_exigir_2fa, false));
end $$;

/**
 * Chamada pelo site logo depois da entrada. Se a conta de alguém da equipe aparece em um aparelho que
 * nunca usou, a pessoa e a coordenação recebem um aviso no painel.
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
    perform interno.avisar(v, 'Sua conta foi aberta em um aparelho novo (' || coalesce(nullif(v_rotulo, ''), 'navegador desconhecido') || '). Se não foi você, avise a coordenação agora e saia de todos os aparelhos.');
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
 * A tentativa fica registrada, a coordenação é avisada e, se for uma conta comum, ela é suspensa na hora.
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
  if v is null then return 'Não existe conta com esse e-mail. Crie a conta primeiro (Authentication, Users, Add user) e rode de novo.'; end if;
  insert into perfis (id, nome) values (v, 'Coordenação') on conflict do nothing;
  delete from papeis where usuario = v and papel = 'vice';
  insert into papeis (usuario, papel) values (v, 'coordenacao') on conflict do nothing;
  insert into auditoria (quem, nome, acao, alvo) values (null, 'banco', 'lideranca_promovida', v::text);
  return 'Pronto: ' || p_email || ' agora é a coordenação.';
end $$;

-- ───────────────────────────── Contribuições ─────────────────────────────

/**
 * Porta única de envio, aberta a qualquer pessoa. Tudo entra como "pendente" e só vai ao ar
 * depois de aprovado pela curadoria. Material de ensino sem fonte é recusado na entrada.
 * O que vem de quem não é da equipe espera primeiro a triagem da mediação.
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

  insert into contribuicoes (tipo, disciplina, titulo, corpo, dados, fontes, alvo, autor, nome_autor, como, triagem)
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
    v_como,
    case when interno.voluntario() then 'liberada' else 'aguardando' end)
  returning id into v_id;
  return jsonb_build_object('id', v_id);
end $$;

create or replace function interno.contribuicao_json(c interno.contribuicoes, p_completa boolean) returns jsonb
language sql stable security definer set search_path = interno, pg_temp as $$
  select jsonb_build_object(
    'id', c.id, 'tipo', c.tipo, 'disciplina', c.disciplina, 'titulo', c.titulo, 'nome_autor', c.nome_autor, 'como', c.como,
    'status', c.status, 'nota', c.nota, 'criado_em', c.criado_em, 'revisado_em', c.revisado_em, 'publicado_em', c.publicado_em,
    'triagem', c.triagem, 'pareceres', (select count(*) from pareceres r where r.contribuicao = c.id))
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

/**
 * As matérias do jornal passam pelo crivo de mais gente: além de curadoria e revisão, qualquer educador lê e dá parecer.
 * O que ainda espera a triagem da mediação não chega a revisores nem a educadores; curadoria e coordenação veem tudo.
 */
create or replace function interno.ve_item(c interno.contribuicoes) returns boolean language sql stable as $$
  select interno.curador() or (c.triagem = 'liberada' and (interno.ve_fila(c.disciplina) or (c.tipo = 'artigo' and interno.tem('educacao'))))
$$;
/** A mediação abre o que espera a triagem dela, e só isso. */
create or replace function interno.tria(c interno.contribuicoes) returns boolean language sql stable as $$
  select c.status = 'pendente' and c.triagem = 'aguardando' and interno.media()
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
  if not (coalesce(c.autor = auth.uid(), false) or interno.ve_item(c) or interno.colabora(c.id) or interno.tria(c)) then perform interno.erro('sem_permissao'); end if;
  return interno.contribuicao_json(c, true) || jsonb_build_object(
    'minha', c.autor is not null and c.autor = auth.uid(),
    'colaboro', interno.colabora(c.id),
    'versao', coalesce(c.editado_em, c.criado_em), 'editado_em', c.editado_em,
    'editado_por', coalesce((select nome from perfis where id = c.editado_por), ''),
    'colaboradores', coalesce((select jsonb_agg(jsonb_build_object('id', f.id, 'nome', f.nome) order by k.criado_em)
                               from colaboradores k join perfis f on f.id = k.usuario where k.contribuicao = c.id), '[]'::jsonb));
end $$;

/**
 * Ajustes antes da decisão: a própria pessoa enquanto está pendente, quem ela chamou para trabalhar junto, a curadoria,
 * ou a mediação enquanto o envio espera a triagem (para acertar a forma, não o conteúdo).
 * Quem edita manda a versão que abriu; se alguém guardou outra nesse meio-tempo, nada é sobrescrito.
 */
create or replace function public.contribuicao_editar(p_id uuid, p jsonb) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); c contribuicoes;
begin
  select * into c from contribuicoes where id = p_id for update;
  if not found then perform interno.erro('nao_encontrado'); end if;
  if c.status <> 'pendente' then perform interno.erro('ja_decidida'); end if;
  if not (coalesce(c.autor = v, false) or interno.curador() or interno.colabora(c.id) or interno.tria(c)) then perform interno.erro('sem_permissao'); end if;
  if coalesce(p ->> 'versao', '') <> '' then
    if (p ->> 'versao') !~ '^[0-9T:.+ Z-]{10,40}$' then perform interno.erro('invalido:versao'); end if;
    if (p ->> 'versao')::timestamptz is distinct from coalesce(c.editado_em, c.criado_em) then perform interno.erro('mudou_enquanto_editava'); end if;
  end if;
  if jsonb_typeof(coalesce(p -> 'dados', '{}'::jsonb)) <> 'object' or pg_column_size(coalesce(p -> 'dados', '{}'::jsonb)) > 20000 then perform interno.erro('invalido:dados'); end if;
  update contribuicoes set
    titulo = interno.txt(p ->> 'titulo', 'titulo', 3, 160),
    corpo = interno.txt(p ->> 'corpo', 'corpo', case when c.tipo in ('obra', 'video', 'frase', 'debate', 'verbete') then 0 else 20 end, 60000),
    dados = coalesce(p -> 'dados', '{}'::jsonb),
    fontes = interno.fontes_ok(p -> 'fontes', c.tipo in ('aula', 'artigo', 'checagem', 'debate', 'verbete', 'memorial', 'frase')),
    editado_em = clock_timestamp(), editado_por = v
  where id = p_id;
  if c.autor is distinct from v then perform interno.registrar('contribuicao_editada', p_id::text); end if;
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

/** Triagem: o que veio de fora e ainda não foi lido pela mediação. */
create or replace function public.triagem_fila() returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
begin
  perform interno.eu();
  if not interno.media() then perform interno.erro('sem_permissao'); end if;
  return (
    select coalesce(jsonb_agg(interno.contribuicao_json(c, false) order by c.criado_em), '[]'::jsonb)
    from (select * from contribuicoes where status = 'pendente' and triagem = 'aguardando' order by criado_em limit 300) c);
end $$;

/**
 * A primeira barreira. Liberar manda o envio para a fila de revisão, onde educadores e revisores dão parecer e a
 * curadoria decide. Barrar encerra o envio como "não aprovado", com uma nota obrigatória para quem enviou.
 * A mediação não aprova conteúdo: isso continua com a curadoria.
 */
create or replace function public.triagem_decidir(p_id uuid, p_liberar boolean, p_nota text) returns jsonb
language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); c contribuicoes; v_nota text := interno.txt(p_nota, 'nota', 0, 2000);
begin
  if not interno.media() then perform interno.erro('sem_permissao'); end if;
  select * into c from contribuicoes where id = p_id for update;
  if not found then perform interno.erro('nao_encontrado'); end if;
  if c.status <> 'pendente' or c.triagem <> 'aguardando' then perform interno.erro('ja_decidida'); end if;
  if coalesce(p_liberar, false) then
    update contribuicoes set triagem = 'liberada' where id = p_id;
  else
    if char_length(v_nota) < 5 then perform interno.erro('invalido:nota'); end if;
    update contribuicoes set status = 'recusada', nota = v_nota, revisado_por = v, revisado_em = now() where id = p_id;
    perform interno.avisar(c.autor, 'Sua contribuição "' || left(c.titulo, 80) || '" não passou pela triagem. Abra "Meus envios" para ler a nota de quem leu.');
  end if;
  perform interno.registrar(case when coalesce(p_liberar, false) then 'triagem_liberada' else 'triagem_barrada' end, c.titulo, jsonb_build_object('id', c.id, 'tipo', c.tipo));
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

/**
 * Avaliação automática das mensagens da Comunidade. Três saídas: 'publicar' (vai ao ar na hora), 'bloquear' (violação
 * clara: ameaça ou apologia ao ódio, pelas expressões marcadas como graves no filtro) e 'revisar' (dúvida: vai para a
 * fila de quem cuida da comunidade). Dúvida é termo do filtro, endereço de site, contato pessoal, texto gritado ou
 * repetido e autor com mensagens ocultadas há pouco. Endereço, contato e histórico só pesam para quem não é da equipe.
 */
create or replace function interno.avaliar(p_texto text, p_equipe boolean, p_autor uuid) returns jsonb language plpgsql stable security definer set search_path = interno, pg_temp as $$
declare
  v_texto text := coalesce(p_texto, '');
  v_normal text := ' ' || interno.normal(v_texto) || ' ';
  v_letras text := regexp_replace(v_texto, '[^[:alpha:]]', '', 'g');
begin
  if exists (select 1 from termos_vetados t where t.grave and position(' ' || t.termo || ' ' in v_normal) > 0) then
    return jsonb_build_object('veredito', 'bloquear', 'motivo', 'expressao_grave');
  end if;
  if exists (select 1 from termos_vetados t where not t.grave and position(' ' || t.termo || ' ' in v_normal) > 0) then
    return jsonb_build_object('veredito', 'revisar', 'motivo', 'filtro');
  end if;
  if v_texto ~ '(.)\1{9,}' then return jsonb_build_object('veredito', 'revisar', 'motivo', 'repeticao'); end if;
  if char_length(v_letras) >= 40 and char_length(regexp_replace(v_letras, '[^[:upper:]]', '', 'g')) > 0.7 * char_length(v_letras) then
    return jsonb_build_object('veredito', 'revisar', 'motivo', 'gritaria');
  end if;
  if not coalesce(p_equipe, false) then
    if v_texto ~* '(https?://|www[.]|[a-z0-9-]{2,}[.](com|net|org|br|io|xyz|info|biz|ly|me|tv|app|site|online)([^a-z]|$))' then
      return jsonb_build_object('veredito', 'revisar', 'motivo', 'endereco');
    end if;
    if v_texto ~ '[^[:space:]@]+@[^[:space:]@]+[.][A-Za-z]{2,}' or v_texto ~ '([0-9][ ().-]{0,2}){10,}' then
      return jsonb_build_object('veredito', 'revisar', 'motivo', 'contato');
    end if;
    if (select count(*) from topicos where autor = p_autor and oculto and not retido and criado_em > now() - interval '30 days')
       + (select count(*) from respostas where autor = p_autor and oculto and not retido and criado_em > now() - interval '30 days') >= 2 then
      return jsonb_build_object('veredito', 'revisar', 'motivo', 'historico');
    end if;
  end if;
  return jsonb_build_object('veredito', 'publicar', 'motivo', '');
end $$;

/**
 * A única porta por onde uma mensagem da Comunidade recebe o veredito. Se a avaliação falhar ou devolver algo que não
 * se entende, a mensagem vai para a fila de revisão: falha nunca vira aprovação.
 */
create or replace function interno.veredito(p_texto text, p_equipe boolean, p_autor uuid) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v jsonb;
begin
  begin
    v := interno.avaliar(p_texto, p_equipe, p_autor);
  exception when others then
    v := null;
  end;
  if v is null or coalesce(v ->> 'veredito', '') not in ('publicar', 'revisar', 'bloquear') then
    return jsonb_build_object('veredito', 'revisar', 'motivo', 'avaliacao_falhou');
  end if;
  return jsonb_build_object('veredito', v ->> 'veredito', 'motivo', left(coalesce(v ->> 'motivo', ''), 40));
end $$;

drop function if exists public.topicos_listar(text, text, integer);
drop function if exists public.topico_criar(text, text, text);

/**
 * Lista de conversas e dúvidas, aberta a qualquer visitante. p_tipo: 'conversa', 'duvida' ou vazio (tudo).
 * p_ordem: 'alta', 'novos', 'melhores', 'sem_resposta'. O que espera a mediação só aparece para quem escreveu e para quem cuida.
 */
create or replace function public.topicos_listar(p_ordem text default 'alta', p_disciplina text default null, p_pagina integer default 0, p_tipo text default null, p_busca text default null) returns jsonb
language sql stable security definer set search_path = interno, pg_temp as $$
  select coalesce(jsonb_agg(x.j order by x.n), '[]'::jsonb) from (
    select row_number() over () as n, jsonb_build_object(
      'id', t.id, 'titulo', t.titulo, 'disciplina', t.disciplina, 'pontos', t.pontos, 'respostas', t.respostas, 'tipo', t.tipo, 'resolvida', t.aceita is not null,
      'trancado', t.trancado, 'oculto', t.oculto, 'retido', t.retido, 'criado_em', t.criado_em, 'autor', coalesce(f.nome, ''),
      'meu_voto', coalesce((select v.valor from votos v where v.usuario = auth.uid() and v.tipo = 'topico' and v.alvo = t.id), 0)) as j
    from topicos t left join perfis f on f.id = t.autor
    where (not t.oculto or interno.cuida() or coalesce(t.retido and t.autor = auth.uid(), false)) and (coalesce(p_disciplina, '') = '' or t.disciplina = p_disciplina)
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
  -- Quem escreveu acompanha a própria mensagem enquanto ela espera a mediação; mais ninguém de fora a vê.
  if not found or (t.oculto and not interno.cuida() and not coalesce(t.retido and t.autor = auth.uid(), false)) then perform interno.erro('nao_encontrado'); end if;
  return jsonb_build_object(
    'id', t.id, 'titulo', t.titulo, 'corpo', t.corpo, 'disciplina', t.disciplina, 'pontos', t.pontos, 'trancado', t.trancado, 'oculto', t.oculto, 'retido', t.retido,
    'tipo', t.tipo, 'aceita', t.aceita,
    'criado_em', t.criado_em, 'autor', coalesce((select nome from perfis where id = t.autor), ''),
    'meu', t.autor is not null and t.autor = auth.uid(),
    'meu_voto', coalesce((select valor from votos where usuario = auth.uid() and tipo = 'topico' and alvo = t.id), 0),
    'pode_cuidar', interno.cuida(), 'pode_banir', interno.media(),
    'autor_id', case when interno.media() then t.autor end,
    -- Numa dúvida, a resposta escolhida vem primeiro e depois as mais bem votadas; numa conversa, a ordem é a do tempo.
    'respostas', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', r.id, 'corpo', r.corpo, 'pontos', r.pontos, 'oculto', r.oculto, 'retido', r.retido, 'criado_em', r.criado_em, 'autor', coalesce(f.nome, ''),
        'aceita', r.id = t.aceita, 'da_equipe', exists (select 1 from papeis p where p.usuario = r.autor),
        'autor_id', case when interno.media() then r.autor end,
        'meu_voto', coalesce((select valor from votos where usuario = auth.uid() and tipo = 'resposta' and alvo = r.id), 0))
        order by (t.tipo = 'duvida' and r.id = t.aceita) desc, case when t.tipo = 'duvida' then r.pontos end desc nulls last, r.criado_em)
      from respostas r left join perfis f on f.id = r.autor
      where r.topico = t.id and (not r.oculto or interno.cuida() or coalesce(r.retido and r.autor = auth.uid(), false))), '[]'::jsonb));
end $$;

/**
 * Abrir conversa ou dúvida: só com conta. Toda mensagem passa pela avaliação automática (interno.veredito): a adequada
 * aparece na hora, a que viola claramente as regras é bloqueada e a duvidosa espera a leitura de quem cuida da comunidade.
 */
create or replace function public.topico_criar(p_titulo text, p_corpo text, p_disciplina text, p_tipo text default 'conversa') returns jsonb
language plpgsql security definer set search_path = interno, pg_temp as $$
declare
  v uuid := interno.eu(); v_id uuid;
  v_titulo text := interno.txt(p_titulo, 'titulo', 5, 140);
  v_corpo text := interno.txt(p_corpo, 'corpo', 10, 8000);
  v_av jsonb; v_veredito text;
begin
  perform interno.limite('topico', 3, 60);
  if coalesce(p_tipo, 'conversa') not in ('conversa', 'duvida') then perform interno.erro('invalido:tipo'); end if;
  v_av := interno.veredito(v_titulo || ' ' || v_corpo, interno.cuida(), v);
  v_veredito := v_av ->> 'veredito';
  insert into topicos (autor, titulo, corpo, disciplina, tipo, oculto, retido, avaliacao, motivo)
  values (v, v_titulo, v_corpo, interno.disciplina_ok(p_disciplina), coalesce(p_tipo, 'conversa'), v_veredito <> 'publicar', v_veredito = 'revisar',
          case v_veredito when 'publicar' then 'publicada' when 'bloquear' then 'bloqueada' else 'revisao' end, v_av ->> 'motivo')
  returning id into v_id;
  if v_veredito = 'bloquear' then perform interno.registrar('comunidade_bloqueada', v_id::text, jsonb_build_object('tipo', 'topico', 'motivo', v_av ->> 'motivo')); end if;
  return jsonb_build_object('id', v_id, 'retido', v_veredito = 'revisar', 'bloqueado', v_veredito = 'bloquear');
end $$;

create or replace function public.responder(p_topico uuid, p_corpo text) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); t topicos; v_id uuid; v_corpo text := interno.txt(p_corpo, 'corpo', 2, 8000); v_av jsonb; v_veredito text;
begin
  perform interno.limite('responder', 30, 60);
  select * into t from topicos where id = p_topico for update;
  if not found or t.oculto then perform interno.erro('nao_encontrado'); end if;
  if t.trancado then perform interno.erro('topico_trancado'); end if;
  v_av := interno.veredito(v_corpo, interno.cuida(), v);
  v_veredito := v_av ->> 'veredito';
  insert into respostas (topico, autor, corpo, oculto, retido, avaliacao, motivo)
  values (p_topico, v, v_corpo, v_veredito <> 'publicar', v_veredito = 'revisar',
          case v_veredito when 'publicar' then 'publicada' when 'bloquear' then 'bloqueada' else 'revisao' end, v_av ->> 'motivo')
  returning id into v_id;
  if v_veredito = 'publicar' then update topicos set respostas = respostas + 1 where id = p_topico; end if;
  if v_veredito = 'bloquear' then perform interno.registrar('comunidade_bloqueada', v_id::text, jsonb_build_object('tipo', 'resposta', 'motivo', v_av ->> 'motivo')); end if;
  return jsonb_build_object('id', v_id, 'retido', v_veredito = 'revisar', 'bloqueado', v_veredito = 'bloquear');
end $$;

/** Quem perguntou (ou a equipe) marca a resposta que resolveu a dúvida. Sem p_resposta, desmarca. */
create or replace function public.resposta_aceitar(p_topico uuid, p_resposta uuid) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); t topicos;
begin
  select * into t from topicos where id = p_topico for update;
  if not found or t.oculto then perform interno.erro('nao_encontrado'); end if;
  if not (coalesce(t.autor = v, false) or interno.cuida()) then perform interno.erro('sem_permissao'); end if;
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

/**
 * Cuidar da comunidade: ocultar, mostrar, trancar ou destrancar. Nada é apagado. Na fila de revisão, "mostrar" é
 * aprovar e "ocultar" é recusar; quem escreveu recebe um recado com a decisão. "Mostrar" também desfaz um bloqueio
 * da avaliação automática que a equipe julgue errado.
 */
create or replace function public.comunidade_cuidar(p_tipo text, p_alvo uuid, p_acao text) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v_retido boolean; v_topico uuid; v_autor uuid; v_bloqueada boolean; v_oculto boolean; v_achou boolean;
begin
  perform interno.eu();
  if not interno.cuida() then perform interno.erro('sem_permissao'); end if;
  if p_tipo = 'topico' and p_acao in ('ocultar', 'mostrar') then
    select retido, autor, avaliacao = 'bloqueada', oculto into v_retido, v_autor, v_bloqueada, v_oculto from topicos where id = p_alvo;
    update topicos set oculto = (p_acao = 'ocultar'), retido = false,
      avaliacao = case when p_acao = 'mostrar' and avaliacao = 'bloqueada' then 'revista' else avaliacao end where id = p_alvo;
    v_achou := found;
  elsif p_tipo = 'topico' and p_acao in ('trancar', 'destrancar') then
    update topicos set trancado = (p_acao = 'trancar') where id = p_alvo;
    v_achou := found;
  elsif p_tipo = 'resposta' and p_acao in ('ocultar', 'mostrar') then
    select retido, topico, autor, avaliacao = 'bloqueada', oculto into v_retido, v_topico, v_autor, v_bloqueada, v_oculto from respostas where id = p_alvo;
    update respostas set oculto = (p_acao = 'ocultar'), retido = false,
      avaliacao = case when p_acao = 'mostrar' and avaliacao = 'bloqueada' then 'revista' else avaliacao end where id = p_alvo;
    v_achou := found;
    -- A contagem do tópico acompanha o que está à vista: entra quando a resposta aparece, sai quando é ocultada.
    if v_achou and p_acao = 'mostrar' and v_oculto then update topicos set respostas = respostas + 1 where id = v_topico; end if;
    if v_achou and p_acao = 'ocultar' and not v_oculto then update topicos set respostas = greatest(respostas - 1, 0) where id = v_topico; end if;
  else perform interno.erro('invalido:acao'); end if;
  if not coalesce(v_achou, false) then perform interno.erro('nao_encontrado'); end if;
  perform interno.registrar('comunidade_' || p_acao, p_alvo::text, jsonb_build_object('tipo', p_tipo));
  -- Quem escreveu fica sabendo de toda decisão que muda o que o público vê da mensagem dele.
  if coalesce(v_retido, false) or (coalesce(v_bloqueada, false) and p_acao = 'mostrar') then
    perform interno.avisar(v_autor, case when p_acao = 'mostrar' then 'Sua mensagem na Comunidade foi aprovada e já aparece para todo mundo.'
                                         else 'Sua mensagem na Comunidade não foi aprovada pela mediação. Releia as regras da página e escreva de novo.' end);
  elsif p_acao = 'ocultar' and v_oculto = false then
    perform interno.avisar(v_autor, 'Uma mensagem sua na Comunidade foi ocultada pela mediação. Releia as regras da página; se achar que houve engano, use a página Denunciar.');
  end if;
  return jsonb_build_object('ok', true);
end $$;

/** A mediação acerta o texto de uma mensagem (dado pessoal exposto, palavrão, formatação) sem tirar a autoria. Fica no registro. */
create or replace function public.comunidade_editar(p_tipo text, p_alvo uuid, p_titulo text, p_corpo text) returns jsonb
language plpgsql security definer set search_path = interno, pg_temp as $$
begin
  perform interno.eu();
  if not interno.cuida() then perform interno.erro('sem_permissao'); end if;
  if p_tipo = 'topico' then
    update topicos set titulo = interno.txt(p_titulo, 'titulo', 5, 140), corpo = interno.txt(p_corpo, 'corpo', 10, 8000) where id = p_alvo;
  elsif p_tipo = 'resposta' then
    update respostas set corpo = interno.txt(p_corpo, 'corpo', 2, 8000) where id = p_alvo;
  else
    perform interno.erro('invalido:tipo');
  end if;
  if not found then perform interno.erro('nao_encontrado'); end if;
  perform interno.registrar('comunidade_editada', p_alvo::text, jsonb_build_object('tipo', p_tipo));
  return jsonb_build_object('ok', true);
end $$;

/** A fila de revisão: o que a avaliação automática deixou em dúvida e ainda espera leitura. "motivo" diz por que parou aqui. */
create or replace function public.comunidade_retidos() returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
begin
  perform interno.eu();
  if not interno.cuida() then perform interno.erro('sem_permissao'); end if;
  return (
    select coalesce(jsonb_agg(x.j order by x.criado_em), '[]'::jsonb) from (
      select t.criado_em, jsonb_build_object('tipo', 'topico', 'id', t.id, 'topico', t.id, 'titulo', t.titulo, 'corpo', t.corpo, 'autor', coalesce(f.nome, ''), 'criado_em', t.criado_em,
        'autor_id', case when interno.media() then t.autor end, 'filtro', interno.vetado(t.titulo || ' ' || t.corpo), 'motivo', t.motivo) as j
      from topicos t left join perfis f on f.id = t.autor where t.retido
      union all
      select r.criado_em, jsonb_build_object('tipo', 'resposta', 'id', r.id, 'topico', r.topico, 'titulo', (select titulo from topicos where id = r.topico), 'corpo', r.corpo, 'autor', coalesce(f.nome, ''), 'criado_em', r.criado_em,
        'autor_id', case when interno.media() then r.autor end, 'filtro', interno.vetado(r.corpo), 'motivo', r.motivo)
      from respostas r left join perfis f on f.id = r.autor where r.retido
    ) x);
end $$;

/**
 * Banimento pela mediação, para quem passa do limite na comunidade. A conta fica suspensa (lê, mas não envia nada) e o que
 * ela tinha esperando na fila é recusado. Em caso extremo, p_origem barra também os envios vindos da mesma origem de rede,
 * com ou sem conta. A mediação não bane gente da equipe: isso é com a coordenação. Desfazer também é só com a coordenação.
 */
create or replace function public.mediacao_banir(p_usuario uuid, p_motivo text, p_origem boolean default false) returns jsonb
language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); f perfis; v_motivo text := interno.txt(p_motivo, 'motivo', 5, 300); v_origem text;
begin
  if not interno.media() then perform interno.erro('sem_permissao'); end if;
  perform interno.limite('banir', 30, 1440);
  select * into f from perfis where id = p_usuario;
  if not found then perform interno.erro('nao_encontrado'); end if;
  if p_usuario = v or exists (select 1 from papeis where usuario = p_usuario) then perform interno.erro('sem_permissao'); end if;
  if coalesce(p_origem, false) then v_origem := f.origem; end if;
  update perfis set suspenso = true where id = p_usuario;
  update topicos set retido = false where autor = p_usuario and retido;
  update respostas set retido = false where autor = p_usuario and retido;
  update banimentos set ativo = false, encerrado_por = v, encerrado_em = now() where usuario = p_usuario and ativo;
  insert into banimentos (usuario, nome, origem, motivo, por) values (p_usuario, f.nome, v_origem, v_motivo, v);
  perform interno.registrar('conta_banida', p_usuario::text, jsonb_build_object('motivo', v_motivo, 'origem', v_origem is not null));
  perform interno.avisar_lideranca('A mediação baniu a conta "' || left(f.nome, 60) || '"' || case when v_origem is not null then ' e barrou a origem de rede dela' else '' end || '. Motivo: ' || left(v_motivo, 200), v);
  return jsonb_build_object('ok', true, 'origem', v_origem is not null);
end $$;

create or replace function public.banimentos_listar() returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
begin
  perform interno.eu();
  if not interno.media() then perform interno.erro('sem_permissao'); end if;
  return (select coalesce(jsonb_agg(jsonb_build_object('id', b.id, 'nome', b.nome, 'motivo', b.motivo, 'origem', b.origem is not null, 'ativo', b.ativo,
            'por', coalesce(f.nome, ''), 'criado_em', b.criado_em, 'encerrado_em', b.encerrado_em) order by b.ativo desc, b.criado_em desc), '[]'::jsonb)
          from (select * from banimentos order by criado_em desc limit 300) b left join perfis f on f.id = b.por);
end $$;

/** Só a coordenação desfaz um banimento: a conta volta a poder enviar e a origem deixa de ser barrada. */
create or replace function public.banimento_encerrar(p_id uuid) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); b banimentos;
begin
  if not interno.coord() then perform interno.erro('sem_permissao'); end if;
  select * into b from banimentos where id = p_id and ativo for update;
  if not found then perform interno.erro('nao_encontrado'); end if;
  update banimentos set ativo = false, encerrado_por = v, encerrado_em = now() where id = p_id;
  if b.usuario is not null and not exists (select 1 from banimentos where usuario = b.usuario and ativo) then
    update perfis set suspenso = false where id = b.usuario;
  end if;
  perform interno.registrar('banimento_encerrado', coalesce(b.usuario::text, ''), jsonb_build_object('nome', b.nome));
  return jsonb_build_object('ok', true);
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
    'id', m.id, 'categoria', m.categoria, 'oficio', m.oficio, 'titulo', m.titulo, 'descricao', m.descricao, 'cidade', m.cidade, 'uf', m.uf,
    'contato', m.contato, 'link', m.link, 'nome', coalesce((select f.nome from perfis f where f.id = m.autor), ''), 'publicado_em', m.decidido_em)
  || case when p_completo then jsonb_build_object('status', m.status, 'nota', m.nota, 'criado_em', m.criado_em, 'validade', m.validade,
       'vencido', m.status = 'aprovado' and m.validade <= now(), 'sem_conta', m.autor is null) else '{}'::jsonb end
$$;

drop function if exists public.mural_listar(text, text);
/** O que o público vê: só anúncios aprovados e dentro da validade, com filtro de tipo, estado, cidade e palavra. */
create or replace function public.mural_listar(p_categoria text default null, p_uf text default null, p_cidade text default null, p_busca text default null) returns jsonb
language sql stable security definer set search_path = interno, pg_temp as $$
  select coalesce(jsonb_agg(interno.mural_json(m, false) order by m.decidido_em desc), '[]'::jsonb)
  from (select * from mural
        where status = 'aprovado' and validade > now()
          and (coalesce(p_categoria, '') = '' or categoria = p_categoria)
          and (coalesce(p_uf, '') = '' or uf = upper(p_uf))
          and (coalesce(p_cidade, '') = '' or interno.normal(cidade) = interno.normal(p_cidade))
          and (coalesce(p_busca, '') = '' or position(interno.normal(left(p_busca, 80)) in interno.normal(titulo || ' ' || oficio || ' ' || descricao)) > 0)
        order by decidido_em desc limit 300) m
$$;

/**
 * Enviar um anúncio. Não precisa de conta: cidade e estado são obrigatórios, o texto passa pelo filtro e nada vai ao ar
 * sem a coordenação ou a mediação aprovar. Quem envia sem conta recebe um código para retirar o anúncio depois.
 */
create or replace function public.mural_enviar(p jsonb) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare
  v uuid := auth.uid();
  v_id uuid := nullif(p ->> 'id', '')::uuid;
  v_categoria text := coalesce(p ->> 'categoria', '');
  v_uf text := upper(btrim(coalesce(p ->> 'uf', '')));
  v_link text := btrim(coalesce(p ->> 'link', ''));
  v_titulo text; v_descricao text; v_cidade text; v_contato text; v_oficio text; v_codigo text;
begin
  -- Campo-isca: gente não vê, robô preenche. Finge que deu certo e não guarda nada.
  if coalesce(p ->> 'site', '') <> '' then return jsonb_build_object('id', gen_random_uuid()); end if;
  if v is not null then perform interno.eu(); end if;
  perform interno.limite('mural', case when v is null then 3 else 6 end, 1440);
  if v_categoria not in ('cooperativa', 'servico', 'produto', 'arte', 'iniciativa') then perform interno.erro('invalido:categoria'); end if;
  if not interno.uf_ok(v_uf) then perform interno.erro('invalido:uf'); end if;
  if v_link <> '' and (v_link !~ '^https://[^[:space:]]+$' or char_length(v_link) > 300) then perform interno.erro('invalido:link'); end if;
  v_titulo := interno.txt(p ->> 'titulo', 'titulo', 4, 100);
  v_oficio := interno.txt(p ->> 'oficio', 'oficio', 0, 60);
  v_descricao := interno.txt(p ->> 'descricao', 'descricao', 20, 1200);
  v_cidade := interno.txt(p ->> 'cidade', 'cidade', 2, 80);
  v_contato := interno.txt(p ->> 'contato', 'contato', 4, 160);
  if interno.vetado(v_titulo || ' ' || v_oficio || ' ' || v_descricao || ' ' || v_cidade || ' ' || v_contato) then perform interno.erro('conteudo_recusado'); end if;
  if v_id is null then
    if v is not null and (select count(*) from mural where autor = v and status <> 'recusado') >= 3 then perform interno.erro('limite_anuncios'); end if;
    if v is null then v_codigo := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10)); end if;
    insert into mural (autor, categoria, oficio, titulo, descricao, cidade, uf, contato, link, codigo)
    values (v, v_categoria, v_oficio, v_titulo, v_descricao, v_cidade, v_uf, v_contato, v_link, case when v_codigo is null then null else interno.selo(v_codigo) end)
    returning id into v_id;
  else
    if v is null then perform interno.erro('entre_primeiro'); end if;
    update mural set categoria = v_categoria, oficio = v_oficio, titulo = v_titulo, descricao = v_descricao, cidade = v_cidade,
      uf = v_uf, contato = v_contato, link = v_link, status = 'pendente', nota = '', decidido_em = null, validade = null
    where id = v_id and autor = v;
    if not found then perform interno.erro('nao_encontrado'); end if;
  end if;
  return jsonb_build_object('id', v_id, 'codigo', v_codigo);
end $$;

create or replace function public.mural_meus() returns jsonb language sql stable security definer set search_path = interno, pg_temp as $$
  select coalesce(jsonb_agg(interno.mural_json(m, true) order by m.criado_em desc), '[]'::jsonb)
  from mural m where m.autor = auth.uid() and auth.uid() is not null
$$;

/** Quem publicou pode retirar o próprio anúncio; a coordenação pode retirar qualquer um. */
create or replace function public.mural_remover(p_id uuid) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu();
begin
  delete from mural where id = p_id and (autor = v or interno.coord());
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
  if not interno.media_mural() then perform interno.erro('sem_permissao'); end if;
  return (select coalesce(jsonb_agg(interno.mural_json(m, true) order by m.criado_em), '[]'::jsonb)
          from (select * from mural where status = coalesce(p_status, 'pendente') order by criado_em limit 300) m);
end $$;

/** A mediação acerta o texto de um anúncio que espera decisão (digitação, formatação), sem mudar de quem ele é nem onde fica. */
create or replace function public.mural_editar(p_id uuid, p jsonb) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v_link text := btrim(coalesce(p ->> 'link', ''));
begin
  perform interno.eu();
  if not interno.media_mural() then perform interno.erro('sem_permissao'); end if;
  if v_link <> '' and (v_link !~ '^https://[^[:space:]]+$' or char_length(v_link) > 300) then perform interno.erro('invalido:link'); end if;
  update mural set titulo = interno.txt(p ->> 'titulo', 'titulo', 4, 100), oficio = interno.txt(p ->> 'oficio', 'oficio', 0, 60),
    descricao = interno.txt(p ->> 'descricao', 'descricao', 20, 1200), contato = interno.txt(p ->> 'contato', 'contato', 4, 160), link = v_link
  where id = p_id and status = 'pendente';
  if not found then perform interno.erro('nao_encontrado'); end if;
  perform interno.registrar('anuncio_editado', p_id::text);
  return jsonb_build_object('ok', true);
end $$;

/** Quem decide o que vai para o mural: a coordenação (coordenador e vice) e a mediação. */
create or replace function public.mural_decidir(p_id uuid, p_aprovar boolean, p_nota text) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
begin
  perform interno.eu();
  if not interno.media_mural() then perform interno.erro('sem_permissao'); end if;
  update mural set status = case when p_aprovar then 'aprovado' else 'recusado' end, nota = interno.txt(p_nota, 'nota', 0, 500),
    decidido_em = now(), validade = case when p_aprovar then now() + interval '180 days' end
  where id = p_id;
  if not found then perform interno.erro('nao_encontrado'); end if;
  perform interno.registrar(case when p_aprovar then 'anuncio_aprovado' else 'anuncio_recusado' end, p_id::text);
  perform interno.avisar((select autor from mural where id = p_id), case when p_aprovar then 'Seu anúncio no Mural dos Trabalhadores está no ar por 180 dias.'
                                                                       else 'Seu anúncio no Mural dos Trabalhadores não foi aprovado. Veja a nota em "Meus anúncios".' end);
  return jsonb_build_object('ok', true);
end $$;

-- ───────────────────────────── Rádio ─────────────────────────────

/** Programação da rádio. Enquanto não estiver no ar, só a coordenação e o jornalismo enxergam os canais. */
create or replace function public.radio_estado() returns jsonb language plpgsql stable security definer set search_path = interno, pg_temp as $$
declare c jsonb := (select valor from configuracoes where chave = 'radio');
begin
  if not coalesce((c ->> 'no_ar')::boolean, false) and not interno.radialista() then
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
  if not interno.radialista() then perform interno.erro('sem_permissao'); end if;
  if v_url <> '' and (v_url !~ '^https://[^[:space:]]+$' or char_length(v_url) > 500) then perform interno.erro('invalido:ao_vivo'); end if;
  update configuracoes set valor = jsonb_build_object('no_ar', coalesce(p_no_ar, false), 'ao_vivo', v_url) where chave = 'radio';
  perform interno.registrar('radio_configurada', '', jsonb_build_object('no_ar', coalesce(p_no_ar, false)));
  return public.radio_estado();
end $$;

create or replace function public.radio_canal_salvar(p_id uuid, p_nome text, p_descricao text, p_ordem integer) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v_id uuid;
begin
  perform interno.eu();
  if not interno.radialista() then perform interno.erro('sem_permissao'); end if;
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
  if not interno.radialista() then perform interno.erro('sem_permissao'); end if;
  delete from radio_canais where id = p_id;
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.radio_faixa_salvar(p_id uuid, p_canal uuid, p_titulo text, p_artista text, p_url text, p_duracao integer, p_ordem integer) returns jsonb
language plpgsql security definer set search_path = interno, pg_temp as $$
declare v_id uuid; v_url text := btrim(coalesce(p_url, ''));
begin
  perform interno.eu();
  if not interno.radialista() then perform interno.erro('sem_permissao'); end if;
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
  if not interno.radialista() then perform interno.erro('sem_permissao'); end if;
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

/** O aviso que abre junto com o site, quando a coordenação definiu um pelo painel. */
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

create or replace function public.reforco_pedir(p jsonb) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare
  v uuid := auth.uid();
  v_email text := lower(btrim(coalesce(p ->> 'email', '')));
  v_disc text := interno.disciplina_ok(p ->> 'disciplina');
  v_assunto text; v_duvida text; v_id uuid;
begin
  if coalesce(p ->> 'site', '') <> '' then return jsonb_build_object('id', gen_random_uuid()); end if;
  if v is not null then perform interno.eu(); end if;
  perform interno.limite('reforco', case when v is null then 2 else 3 end, 60);
  perform interno.limite('reforco_dia', 5, 1440);
  if v_disc is null then perform interno.erro('invalido:disciplina'); end if;
  if v_email !~ '^[^@[:space:]]+@[^@[:space:]]+[.][^@[:space:]]+$' or char_length(v_email) > 200 then perform interno.erro('invalido:email'); end if;
  v_assunto := interno.txt(p ->> 'assunto', 'assunto', 4, 140);
  v_duvida := interno.txt(p ->> 'duvida', 'duvida', 20, 3000);
  -- Só texto: endereços, imagens e arquivos não entram.
  if (v_assunto || ' ' || v_duvida) ~* '(https?://|www[.]|data:|<img|[.](png|jpe?g|gif|webp|pdf|zip|exe|apk)($|[^a-z]))' then perform interno.erro('sem_links'); end if;
  if interno.vetado(v_assunto || ' ' || v_duvida) then perform interno.erro('conteudo_recusado'); end if;
  if v is not null and (select count(*) from reforco where autor = v and status in ('aberto', 'em_atendimento')) >= 3 then perform interno.erro('limite_pedidos'); end if;
  insert into reforco (autor, email, disciplina, assunto, duvida) values (v, v_email, v_disc, v_assunto, v_duvida) returning id into v_id;
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
    when p_canal in ('curadoria', 'mediacao', 'educacao', 'revisao', 'traducao', 'jornalismo', 'mentoria', 'design', 'desenvolvimento') then interno.coord() or interno.tem(p_canal)
    else false end
$$;

/**
 * O texto é cifrado no navegador com a chave da equipe (uma frase combinada fora do site) antes de sair do aparelho.
 * O banco guarda só "c1.<vetor>.<texto cifrado>": quem ler a tabela não lê as conversas. A "prova" é um texto conhecido
 * cifrado com a chave certa, para o navegador avisar quando alguém digita a frase errada.
 */
create or replace function public.equipe_canais() returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v_cfg jsonb;
begin
  perform interno.eu();
  if not interno.voluntario() then perform interno.erro('sem_permissao'); end if;
  select valor into v_cfg from configuracoes where chave = 'equipe';
  if coalesce(v_cfg ->> 'sal', '') = '' then
    v_cfg := coalesce(v_cfg, '{}'::jsonb) || jsonb_build_object('sal', replace(gen_random_uuid()::text, '-', ''));
    insert into configuracoes (chave, valor) values ('equipe', v_cfg) on conflict (chave) do update set valor = excluded.valor;
  end if;
  return jsonb_build_object(
    'sala', coalesce(v_cfg ->> 'sala', ''), 'sal', v_cfg ->> 'sal', 'prova', coalesce(v_cfg ->> 'prova', ''),
    'canais', (select coalesce(jsonb_agg(c order by n), '[]'::jsonb)
               from unnest(array['geral', 'pedidos', 'coordenacao', 'curadoria', 'mediacao', 'educacao', 'revisao', 'traducao', 'jornalismo', 'mentoria', 'design', 'desenvolvimento']) with ordinality as t(c, n)
               where interno.ve_canal(c)));
end $$;

create or replace function public.equipe_listar(p_canal text) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
begin
  perform interno.eu();
  if not interno.ve_canal(coalesce(p_canal, '')) then perform interno.erro('sem_permissao'); end if;
  -- Nada fica guardado por mais de trinta dias.
  delete from equipe_mensagens where criado_em < now() - interval '30 days';
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
  if coalesce((select valor ->> 'prova' from configuracoes where chave = 'equipe'), '') = '' then perform interno.erro('sem_chave'); end if;
  -- O banco recusa texto aberto: só entra o que já chega cifrado.
  if coalesce(p_corpo, '') !~ '^c1[.][A-Za-z0-9_-]{16}[.][A-Za-z0-9_-]+$' or char_length(p_corpo) not between 40 and 4000 then perform interno.erro('invalido:corpo'); end if;
  if p_resposta_a is not null then
    if not exists (select 1 from equipe_mensagens where id = p_resposta_a and canal = p_canal and resposta_a is null) then perform interno.erro('nao_encontrado'); end if;
    v_para := null;
  elsif p_canal = 'pedidos' then
    if v_para is null or v_para not in ('coordenacao', 'curadoria', 'educacao', 'revisao', 'traducao', 'jornalismo', 'mentoria', 'design', 'desenvolvimento') then perform interno.erro('invalido:para'); end if;
  else
    v_para := null;
  end if;
  insert into equipe_mensagens (canal, resposta_a, autor, para, corpo) values (p_canal, p_resposta_a, v, v_para, p_corpo) returning id into v_id;
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
  insert into configuracoes (chave, valor) values ('equipe', jsonb_build_object('sala', v_url))
  on conflict (chave) do update set valor = configuracoes.valor || jsonb_build_object('sala', v_url);
  perform interno.registrar('equipe_sala', '', jsonb_build_object('definida', v_url <> ''));
  return jsonb_build_object('ok', true);
end $$;

-- ───────────────────────────── Materiais de campanha ─────────────────────────────

create or replace function public.materiais_listar() returns jsonb language sql stable security definer set search_path = interno, pg_temp as $$
  select coalesce(jsonb_agg(jsonb_build_object('id', m.id, 'tipo', m.tipo, 'titulo', m.titulo, 'descricao', m.descricao, 'campanha', m.campanha, 'url', m.url,
    'publicado', m.publicado, 'ordem', m.ordem, 'criado_em', m.criado_em) order by m.ordem, m.criado_em desc), '[]'::jsonb)
  from materiais m where m.publicado or interno.curador() or interno.tem('design')
$$;

/** Curadoria e design preparam o material; só a coordenação (ou a vice-coordenação) põe no ar. */
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

/** Coordenação e vice-coordenação conferem as horas dos outros; ninguém confere as próprias. */
create or replace function public.horas_conferir(p_id uuid, p_confirmar boolean) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu();
begin
  if not interno.coord() then perform interno.erro('sem_permissao'); end if;
  update horas set status = case when p_confirmar then 'confirmada' else 'recusada' end, conferido_por = v where id = p_id and status = 'pendente' and usuario <> v;
  if not found then perform interno.erro('nao_encontrado'); end if;
  perform interno.registrar(case when p_confirmar then 'horas_confirmadas' else 'horas_recusadas' end, p_id::text);
  return jsonb_build_object('ok', true);
end $$;

/** O nome que vai na linha de assinatura: o completo do termo de adesão, quando a pessoa aceitou um. */
create or replace function interno.nome_de_assinar(p_usuario uuid) returns text language sql stable security definer set search_path = interno, pg_temp as $$
  select coalesce((select nome_completo from termos_adesao where usuario = p_usuario), (select nome from perfis where id = p_usuario), '')
$$;

/** A impressão digital junta tudo o que o certificado afirma: mudou uma letra, muda a impressão. */
create or replace function interno.certificado_json(c interno.certificados) returns jsonb language sql stable as $$
  select jsonb_build_object('id', c.id, 'codigo', c.codigo, 'usuario', c.usuario, 'nome', c.nome, 'horas', c.horas, 'inicio', c.inicio, 'fim', c.fim,
    'atividades', c.atividades, 'testemunhas', c.testemunhas, 'status', c.status, 'emitido_em', c.emitido_em, 'criado_em', c.criado_em,
    'impressao', encode(sha256(convert_to(c.codigo || '|' || c.nome || '|' || c.horas::text || '|' || c.inicio::text || '|' || c.fim::text || '|' || c.atividades, 'UTF8')), 'hex'))
$$;

/**
 * O coordenador abre o processo: escolhe a pessoa, o período e o educador que acompanhou o trabalho. Todo certificado
 * leva três assinaturas eletrônicas, cada uma dada pela própria pessoa, na própria conta: a do educador, a do
 * vice-coordenador e, por último, a do coordenador (que é a emissão). Ninguém assina o próprio certificado. As horas
 * confirmadas do período entram no certificado e deixam de valer para outro.
 * (A coluna guarda as assinaturas com o nome antigo, "testemunhas".)
 */
create or replace function public.certificado_abrir(p jsonb) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare
  v uuid := interno.eu();
  v_usuario uuid := nullif(p ->> 'usuario', '')::uuid;
  v_educador uuid := nullif(p ->> 'educador', '')::uuid;
  v_vice uuid := nullif(p ->> 'vice', '')::uuid;
  v_inicio date := nullif(p ->> 'inicio', '')::date;
  v_fim date := nullif(p ->> 'fim', '')::date;
  v_nome text; v_horas numeric; v_id uuid := gen_random_uuid(); v_assinaturas jsonb;
begin
  if not interno.lider() then perform interno.erro('sem_permissao'); end if;
  if v_usuario is null or v_usuario = v then perform interno.erro('invalido:usuario'); end if;
  if v_inicio is null or v_fim is null or v_fim < v_inicio then perform interno.erro('invalido:periodo'); end if;
  select nome_completo into v_nome from termos_adesao where usuario = v_usuario;
  if v_nome is null then perform interno.erro('falta_termo'); end if;
  if v_educador is null or v_educador in (v_usuario, v)
     or not exists (select 1 from papeis r join perfis f on f.id = r.usuario where r.usuario = v_educador and r.papel = 'educacao' and not f.suspenso) then perform interno.erro('invalido:educador'); end if;
  if v_vice is null then
    select r.usuario into v_vice from papeis r join perfis f on f.id = r.usuario
    where r.papel = 'vice' and not f.suspenso and r.usuario not in (v_usuario, v_educador, v) order by f.visto_em desc limit 1;
  end if;
  if v_vice is null or v_vice in (v_usuario, v_educador, v)
     or not exists (select 1 from papeis r join perfis f on f.id = r.usuario where r.usuario = v_vice and r.papel = 'vice' and not f.suspenso) then perform interno.erro('falta_vice'); end if;
  select coalesce(sum(horas), 0) into v_horas from horas where usuario = v_usuario and status = 'confirmada' and certificado is null and dia between v_inicio and v_fim;
  if v_horas <= 0 then perform interno.erro('sem_horas'); end if;
  v_assinaturas := jsonb_build_array(
    jsonb_build_object('id', v_educador, 'nome', interno.nome_de_assinar(v_educador), 'papel', 'educacao',
                       'disciplina', (select min(disciplina) from papeis where usuario = v_educador and papel = 'educacao'), 'confirmou_em', null),
    jsonb_build_object('id', v_vice, 'nome', interno.nome_de_assinar(v_vice), 'papel', 'vice', 'disciplina', null, 'confirmou_em', null),
    jsonb_build_object('id', v, 'nome', interno.nome_de_assinar(v), 'papel', 'coordenacao', 'disciplina', null, 'confirmou_em', null));
  insert into certificados (id, codigo, usuario, nome, horas, inicio, fim, atividades, testemunhas)
  values (v_id, upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 12)), v_usuario, v_nome, v_horas, v_inicio, v_fim, interno.txt(p ->> 'atividades', 'atividades', 10, 700), v_assinaturas);
  update horas set certificado = v_id where usuario = v_usuario and status = 'confirmada' and certificado is null and dia between v_inicio and v_fim;
  perform interno.avisar(v_educador, 'Há um certificado de horas de voluntariado esperando a sua assinatura. Abra "Horas e certificados" no painel.');
  perform interno.avisar(v_vice, 'Há um certificado de horas de voluntariado esperando a sua assinatura. Abra "Horas e certificados" no painel.');
  perform interno.registrar('certificado_aberto', v_usuario::text, jsonb_build_object('horas', v_horas));
  return jsonb_build_object('id', v_id, 'horas', v_horas);
end $$;

/** A assinatura do educador e a do vice-coordenador: cada um assina só a própria linha, com a própria conta. */
create or replace function public.certificado_testemunhar(p_id uuid) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); c certificados; v_novas jsonb;
begin
  select * into c from certificados where id = p_id for update;
  if not found or c.status <> 'aberto' then perform interno.erro('nao_encontrado'); end if;
  if not exists (select 1 from jsonb_array_elements(c.testemunhas) x
                 where x ->> 'id' = v::text and x ->> 'confirmou_em' is null and coalesce(x ->> 'papel', '') <> 'coordenacao') then perform interno.erro('sem_permissao'); end if;
  select jsonb_agg(case when x ->> 'id' = v::text and coalesce(x ->> 'papel', '') <> 'coordenacao' then x || jsonb_build_object('confirmou_em', now()) else x end order by n)
  into v_novas from jsonb_array_elements(c.testemunhas) with ordinality as e(x, n);
  update certificados set testemunhas = v_novas where id = p_id;
  perform interno.registrar('certificado_testemunhado', p_id::text);
  if not exists (select 1 from jsonb_array_elements(v_novas) x where x ->> 'confirmou_em' is null and coalesce(x ->> 'papel', '') <> 'coordenacao') then
    perform interno.avisar((x ->> 'id')::uuid, 'Um certificado de horas já tem as assinaturas do educador e do vice-coordenador. Falta a sua para emitir.')
    from jsonb_array_elements(v_novas) x where x ->> 'papel' = 'coordenacao';
  end if;
  return jsonb_build_object('ok', true);
end $$;

/** A assinatura do coordenador é a última e é a emissão. Vale quem é coordenador no dia de assinar. */
create or replace function public.certificado_emitir(p_id uuid) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); c certificados; v_minha jsonb;
begin
  if not interno.lider() then perform interno.erro('sem_permissao'); end if;
  select * into c from certificados where id = p_id for update;
  if not found or c.status <> 'aberto' then perform interno.erro('nao_encontrado'); end if;
  if c.usuario = v then perform interno.erro('sem_permissao'); end if;
  if exists (select 1 from jsonb_array_elements(c.testemunhas) x where x ->> 'confirmou_em' is null and coalesce(x ->> 'papel', '') <> 'coordenacao') then perform interno.erro('falta_assinatura'); end if;
  v_minha := jsonb_build_object('id', v, 'nome', interno.nome_de_assinar(v), 'papel', 'coordenacao', 'disciplina', null, 'confirmou_em', now());
  update certificados set status = 'emitido', emitido_por = v, emitido_em = now(),
    testemunhas = coalesce((select jsonb_agg(x order by n) from jsonb_array_elements(c.testemunhas) with ordinality as e(x, n) where coalesce(x ->> 'papel', '') <> 'coordenacao'), '[]'::jsonb) || jsonb_build_array(v_minha)
  where id = p_id;
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

/** A coordenação vê todos; cada pessoa vê os próprios e aqueles que assina. */
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
    'atividades', c.atividades, 'emitido_em', c.emitido_em, 'impressao', interno.certificado_json(c) ->> 'impressao',
    'testemunhas', (select coalesce(jsonb_agg(x ->> 'nome' order by n), '[]'::jsonb) from jsonb_array_elements(c.testemunhas) with ordinality as e(x, n) where x ->> 'confirmou_em' is not null));
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

/** Depois de enviar um arquivo ao depósito, quem enviou registra o que ele é. Só entra no site se a coordenação aprovar. */
create or replace function public.arquivo_registrar(p_caminho text, p_nome text) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); v_id uuid;
begin
  if not interno.envia() then perform interno.erro('sem_permissao'); end if;
  perform interno.limite('arquivo', 30, 1440);
  if coalesce(p_caminho, '') !~ '^[0-9a-f-]{36}/[a-z0-9-]{8,60}[.](webp|jpg|pdf)$' or split_part(p_caminho, '/', 1) <> v::text then perform interno.erro('invalido:caminho'); end if;
  insert into arquivos (caminho, nome, dono) values (p_caminho, interno.txt(p_nome, 'nome', 3, 120), v) returning id into v_id;
  return jsonb_build_object('id', v_id);
end $$;

/** Cada pessoa vê os próprios envios; toda a equipe vê o que está esperando apoio; a coordenação vê tudo. */
create or replace function public.arquivos_listar() returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu();
begin
  if not interno.voluntario() then perform interno.erro('sem_permissao'); end if;
  return (select coalesce(jsonb_agg(jsonb_build_object('id', a.id, 'caminho', a.caminho, 'nome', a.nome, 'status', a.status, 'destino', a.destino, 'criado_em', a.criado_em,
            'de', coalesce(f.nome, ''), 'meu', a.dono is not null and a.dono = v,
            'apoios', (select count(*) from arquivos_apoios x where x.arquivo = a.id),
            'apoiei', exists (select 1 from arquivos_apoios x where x.arquivo = a.id and x.usuario = v)) order by a.criado_em desc), '[]'::jsonb)
          from (select * from arquivos where dono = v or status = 'pendente' or interno.coord() order by criado_em desc limit 200) a left join perfis f on f.id = a.dono);
end $$;

/** A coordenação aprova depois de dois apoios da equipe. O coordenador pode aprovar sem esperar; recusar, qualquer um dos dois pode. */
create or replace function public.arquivo_decidir(p_id uuid, p_aprovar boolean) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
begin
  perform interno.eu();
  if not interno.coord() then perform interno.erro('sem_permissao'); end if;
  if p_aprovar and not interno.lider() and (select count(*) from arquivos_apoios where arquivo = p_id) < 2 then perform interno.erro('falta_apoio'); end if;
  update arquivos set status = case when p_aprovar then 'aprovado' else 'recusado' end where id = p_id and status = 'pendente';
  if not found then perform interno.erro('nao_encontrado'); end if;
  perform interno.registrar(case when p_aprovar then 'arquivo_aprovado' else 'arquivo_recusado' end, p_id::text);
  return jsonb_build_object('ok', true);
end $$;

/** Para a rotina de publicação: arquivos aprovados que ainda não foram copiados para o site. Só com a chave de serviço. */
create or replace function public.arquivos_aprovados() returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
begin
  if not interno.servico() then perform interno.erro('sem_permissao'); end if;
  return (select coalesce(jsonb_agg(jsonb_build_object('id', id, 'caminho', caminho) order by criado_em), '[]'::jsonb) from arquivos where status = 'aprovado');
end $$;

create or replace function public.arquivo_publicado(p_id uuid, p_destino text) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
begin
  if not interno.servico() then perform interno.erro('sem_permissao'); end if;
  update arquivos set status = case when coalesce(p_destino, '') = '' then 'recusado' else 'publicado' end, destino = coalesce(p_destino, '') where id = p_id and status = 'aprovado';
  perform interno.avisar((select dono from arquivos where id = p_id),
    case when coalesce(p_destino, '') = '' then 'Um arquivo que você enviou foi recusado na publicação (formato inválido, dados embutidos ou arquivo bloqueado).'
         else 'Seu arquivo foi publicado. O endereço dele está em Materiais → Arquivos.' end);
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
  delete from auditoria where acao = 'isca' and criado_em < now() - interval '30 days';
  delete from audit_logs where criado_em < now() - interval '400 days';
  delete from aparelhos where ultimo < now() - interval '180 days';
  delete from reforco where status in ('atendido', 'cancelado') and criado_em < now() - interval '180 days';
  delete from denuncias where status = 'resolvida' and criado_em < now() - interval '365 days';
  delete from equipe_mensagens where criado_em < now() - interval '30 days';
  delete from conversa_mensagens where criado_em < now() - interval '30 days';
  delete from convites where expira_em < now() - interval '30 days';
  delete from inscricoes where status <> 'pendente' and decidido_em < now() - interval '90 days';
  delete from mural where status = 'recusado' and decidido_em < now() - interval '30 days';
  delete from mural where status = 'aprovado' and validade < now() - interval '60 days';
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
    'candidaturas', case when interno.coord() then (select count(*) from candidaturas where status = 'pendente') + (select count(*) from inscricoes where status = 'pendente') else 0 end,
    'denuncias', case when interno.curador() then (select count(*) from denuncias where status = 'aberta') else 0 end,
    'anotacoes', case when interno.cuida() then (select count(*) from anotacoes where status = 'pendente') else 0 end,
    'retidos', case when interno.cuida() then (select count(*) from topicos where retido) + (select count(*) from respostas where retido) else 0 end,
    'mural', case when interno.media_mural() then (select count(*) from mural where status = 'pendente') else 0 end,
    'triagem', case when interno.media() then (select count(*) from contribuicoes where status = 'pendente' and triagem = 'aguardando') else 0 end,
    'reforco', case when interno.curador() or interno.tem('mentoria') or interno.tem('educacao')
                    then (select count(*) from reforco r where r.status = 'aberto' and interno.mentor(r.disciplina)) else 0 end,
    'horas', case when interno.coord() then (select count(*) from horas where status = 'pendente' and usuario <> v) else 0 end,
    'testemunhar', (select count(*) from certificados c where c.status = 'aberto'
                    and exists (select 1 from jsonb_array_elements(c.testemunhas) x where x ->> 'id' = v::text and x ->> 'confirmou_em' is null)),
    'minhas', (select count(*) from contribuicoes where autor = v),
    'juntas', (select count(*) from colaboradores k join contribuicoes c on c.id = k.contribuicao where k.usuario = v and c.status = 'pendente'));
end $$;

-- ───────────────────────────── Convites ─────────────────────────────

create or replace function interno.selo(p text) returns text language sql immutable as $$
  select encode(sha256(convert_to(coalesce(p, ''), 'UTF8')), 'hex')
$$;

/**
 * A coordenação gera um convite e recebe o código uma única vez. Com e-mail, o convite é pessoal (um uso) e pode
 * já trazer a função. Sem e-mail, é um convite da comunidade: vale para várias pessoas, sem função nenhuma.
 */
create or replace function public.convite_criar(p jsonb) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare
  v uuid := interno.eu();
  v_email text := lower(btrim(coalesce(p ->> 'email', '')));
  v_papel text := nullif(p ->> 'papel', '');
  v_disc text := interno.disciplina_ok(p ->> 'disciplina');
  v_usos integer := coalesce(nullif(p ->> 'usos', '')::integer, 1);
  v_dias integer := coalesce(nullif(p ->> 'dias', '')::integer, 7);
  v_codigo text := replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '');
  v_id uuid;
begin
  if not interno.coord() then perform interno.erro('sem_permissao'); end if;
  perform interno.limite('convite_criar', 60, 1440);
  if v_email <> '' and (v_email !~ '^[^@[:space:]]+@[^@[:space:]]+[.][^@[:space:]]+$' or char_length(v_email) > 200) then perform interno.erro('invalido:email'); end if;
  if v_papel is not null then
    if v_papel not in ('vice', 'curadoria', 'mediacao', 'educacao', 'revisao', 'traducao', 'jornalismo', 'mentoria', 'design', 'desenvolvimento') then perform interno.erro('invalido:papel'); end if;
    if v_papel in ('vice', 'curadoria') and not interno.lider() then perform interno.erro('sem_permissao'); end if;
    if v_email = '' then perform interno.erro('invalido:email'); end if;
    if v_papel in ('educacao', 'mentoria') and v_disc is null then perform interno.erro('invalido:disciplina'); end if;
    if v_papel not in ('educacao', 'mentoria') then v_disc := null; end if;
  else
    v_disc := null;
  end if;
  if v_email <> '' then v_usos := 1; end if;
  if v_usos not between 1 and 200 then perform interno.erro('invalido:usos'); end if;
  if v_dias not between 1 and 30 then perform interno.erro('invalido:dias'); end if;
  insert into convites (selo, email, papel, disciplina, usos_max, nota, criado_por, expira_em)
  values (interno.selo(v_codigo), v_email, v_papel, v_disc, v_usos, interno.txt(p ->> 'nota', 'nota', 0, 120), v, now() + make_interval(days => v_dias))
  returning id into v_id;
  perform interno.registrar('convite_criado', v_id::text, jsonb_build_object('papel', v_papel, 'usos', v_usos));
  return jsonb_build_object('id', v_id, 'codigo', v_codigo);
end $$;

create or replace function public.convites_listar() returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
begin
  perform interno.eu();
  if not interno.coord() then perform interno.erro('sem_permissao'); end if;
  return (select coalesce(jsonb_agg(jsonb_build_object('id', c.id, 'email', c.email, 'papel', c.papel, 'disciplina', c.disciplina, 'usos', c.usos,
            'usos_max', c.usos_max, 'nota', c.nota, 'criado_em', c.criado_em, 'expira_em', c.expira_em, 'de', coalesce(f.nome, ''),
            'valido', not c.revogado and c.expira_em > now() and c.usos < c.usos_max) order by c.criado_em desc), '[]'::jsonb)
          from (select * from convites order by criado_em desc limit 200) c left join perfis f on f.id = c.criado_por);
end $$;

create or replace function public.convite_revogar(p_id uuid) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
begin
  perform interno.eu();
  if not interno.coord() then perform interno.erro('sem_permissao'); end if;
  update convites set revogado = true where id = p_id;
  if not found then perform interno.erro('nao_encontrado'); end if;
  perform interno.registrar('convite_revogado', p_id::text);
  return jsonb_build_object('ok', true);
end $$;

/** Para a página de entrada dizer a quem o convite se destina. De convite que não vale, não diz nada. */
create or replace function public.convite_ver(p_codigo text) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare c convites;
begin
  perform interno.limite('convite_ver', 30, 60);
  select * into c from convites where selo = interno.selo(btrim(coalesce(p_codigo, '')));
  if not found or c.revogado or c.expira_em < now() or c.usos >= c.usos_max then return jsonb_build_object('valido', false); end if;
  return jsonb_build_object('valido', true, 'email', c.email, 'papel', c.papel);
end $$;

/** Só pelo SQL Editor: gera um convite pessoal quando ninguém consegue entrar no painel. Devolve o final do endereço. */
create or replace function public.convidar_pelo_banco(p_email text) returns text language plpgsql security definer set search_path = interno, pg_temp as $$
declare v_codigo text := replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '');
begin
  if auth.uid() is not null or (interno.claims() ->> 'role') in ('anon', 'authenticated') then
    raise exception 'sem_permissao' using errcode = 'P0001';
  end if;
  insert into convites (selo, email, usos_max, nota, expira_em)
  values (interno.selo(v_codigo), lower(btrim(p_email)), 1, 'Gerado pelo banco', now() + interval '2 days');
  return '/pt/entrar?convite=' || v_codigo;
end $$;

/**
 * Toda conta nova passa por aqui. Enquanto não existe coordenação (instalação), a primeira conta entra livre.
 * Sem convite, a conta nasce como participante da comunidade, sem função nenhuma: pode perguntar e responder, e tudo o
 * que escreve espera a mediação. A coordenação fecha essa porta nos Controles do site (cadastro) ou com a pausa geral.
 * Com convite, vale o convite: o pessoal já entrega a função combinada, e convite que não vale não cria conta.
 */
create or replace function public.lucia_conta_nova() returns trigger language plpgsql security definer set search_path = interno, pg_temp as $$
declare v_codigo text := coalesce(new.raw_user_meta_data ->> 'convite', ''); c convites;
begin
  if not exists (select 1 from papeis where papel = 'coordenacao') then return new; end if;
  if v_codigo = '' then
    if not coalesce((select (valor ->> 'cadastro')::boolean from configuracoes where chave = 'site'), true)
       or coalesce((select (valor ->> 'pausa')::boolean from configuracoes where chave = 'site'), false) then
      raise exception 'convite_obrigatorio' using errcode = 'P0001';
    end if;
    insert into perfis (id, nome) values (new.id, 'Estudante ' || (10000 + floor(random() * 90000))::int) on conflict do nothing;
    return new;
  end if;
  select * into c from convites where selo = interno.selo(v_codigo) for update;
  if not found or c.revogado or c.expira_em < now() or c.usos >= c.usos_max then raise exception 'convite_invalido' using errcode = 'P0001'; end if;
  if c.email <> '' and lower(coalesce(new.email, '')) <> c.email then raise exception 'convite_de_outro_email' using errcode = 'P0001'; end if;
  update convites set usos = usos + 1 where id = c.id;
  insert into convites_usos (usuario, convite) values (new.id, c.id) on conflict do nothing;
  insert into perfis (id, nome) values (new.id, 'Estudante ' || (10000 + floor(random() * 90000))::int) on conflict do nothing;
  if c.papel is not null then
    insert into papeis (usuario, papel, disciplina, concedido_por) values (new.id, c.papel, c.disciplina, c.criado_por) on conflict do nothing;
  end if;
  insert into auditoria (quem, nome, acao, alvo, detalhes) values (new.id, '', 'convite_aceito', c.id::text, jsonb_build_object('papel', c.papel));
  -- O código já foi gasto: não precisa ficar guardado junto da conta.
  begin
    update auth.users set raw_user_meta_data = coalesce(raw_user_meta_data, '{}'::jsonb) - 'convite' where id = new.id;
  exception when others then null;
  end;
  return new;
end $$;
drop trigger if exists lucia_conta_nova on auth.users;
create trigger lucia_conta_nova after insert on auth.users for each row execute function public.lucia_conta_nova();

-- ───────────────────────────── Filtro geral do que vem de fora ─────────────────────────────

/** Contribuição de quem não tem conta com termo da lista vetada não chega nem à fila. */
create or replace function interno.filtro_contribuicao() returns trigger language plpgsql security definer set search_path = interno, pg_temp as $$
begin
  if new.autor is null and interno.vetado(new.titulo || ' ' || new.corpo || ' ' || new.nome_autor || ' ' || new.dados::text) then
    raise exception 'conteudo_recusado' using errcode = 'P0001';
  end if;
  return new;
end $$;
drop trigger if exists lucia_filtro on interno.contribuicoes;
create trigger lucia_filtro before insert on interno.contribuicoes for each row execute function interno.filtro_contribuicao();

-- ───────────────────────────── Mural: pedidos de qualquer pessoa, decisão da coordenação ou da mediação ─────────────────────────────

create or replace function interno.uf_ok(p text) returns boolean language sql immutable as $$
  select upper(coalesce(p, '')) in ('AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO')
$$;

/** As cidades que têm anúncio no ar (em um estado ou em todos), para montar o filtro. */
create or replace function public.mural_cidades(p_uf text default null) returns jsonb language sql stable security definer set search_path = interno, pg_temp as $$
  select coalesce(jsonb_agg(jsonb_build_object('cidade', x.cidade, 'uf', x.uf, 'total', x.total) order by x.uf, x.cidade), '[]'::jsonb)
  from (select min(cidade) as cidade, uf, count(*) as total from mural
        where status = 'aprovado' and validade > now() and (coalesce(p_uf, '') = '' or uf = upper(p_uf))
        group by uf, interno.normal(cidade)) x
$$;

/** Quem anunciou sem conta retira o anúncio com o código que recebeu. */
create or replace function public.mural_retirar(p_codigo text) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
begin
  perform interno.limite('mural_retirar', 10, 60);
  delete from mural where codigo is not null and codigo = interno.selo(upper(btrim(coalesce(p_codigo, ''))));
  if not found then perform interno.erro('nao_encontrado'); end if;
  return jsonb_build_object('ok', true);
end $$;

-- ───────────────────────────── Conversa da equipe: cifrada no aparelho, apagada em trinta dias ─────────────────────────────

/** A coordenação define (ou troca) a chave. Trocar apaga as conversas: com a chave nova elas ficariam ilegíveis. */
create or replace function public.equipe_chave_definir(p_prova text) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
begin
  perform interno.eu();
  if not interno.lider() then perform interno.erro('sem_permissao'); end if;
  if coalesce(p_prova, '') !~ '^c1[.][A-Za-z0-9_-]{16}[.][A-Za-z0-9_-]{20,200}$' then perform interno.erro('invalido:prova'); end if;
  delete from equipe_mensagens where true;
  delete from conversa_mensagens where true;
  insert into configuracoes (chave, valor) values ('equipe', jsonb_build_object('prova', p_prova))
  on conflict (chave) do update set valor = configuracoes.valor || jsonb_build_object('prova', p_prova);
  perform interno.registrar('equipe_chave_definida');
  return jsonb_build_object('ok', true);
end $$;

/** O botão de apagar tudo: só o coordenador, na hora, sem volta. */
create or replace function public.equipe_apagar_tudo() returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v_total integer; v_conversas integer;
begin
  perform interno.eu();
  if not interno.lider() then perform interno.erro('sem_permissao'); end if;
  delete from equipe_mensagens where true;
  get diagnostics v_total = row_count;
  delete from conversa_mensagens where true;
  get diagnostics v_conversas = row_count;
  v_total := v_total + v_conversas;
  perform interno.registrar('equipe_apagada', '', jsonb_build_object('mensagens', v_total));
  return jsonb_build_object('ok', true, 'apagadas', v_total);
end $$;

-- ───────────────────────────── Arquivos: apoio dos colegas antes da decisão ─────────────────────────────

/** Qualquer pessoa da equipe, menos quem enviou, apoia (ou retira o apoio a) um arquivo que está esperando. */
create or replace function public.arquivo_apoiar(p_id uuid, p_apoiar boolean default true) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu();
begin
  if not interno.voluntario() then perform interno.erro('sem_permissao'); end if;
  if not exists (select 1 from arquivos where id = p_id and status = 'pendente' and dono is distinct from v) then perform interno.erro('nao_encontrado'); end if;
  if coalesce(p_apoiar, true) then
    insert into arquivos_apoios (arquivo, usuario) values (p_id, v) on conflict do nothing;
  else
    delete from arquivos_apoios where arquivo = p_id and usuario = v;
  end if;
  return jsonb_build_object('apoios', (select count(*) from arquivos_apoios where arquivo = p_id));
end $$;

-- ───────────────────────────── Boletim do jornal ─────────────────────────────

/** Qualquer pessoa entra na lista. A resposta é a mesma para endereço novo ou repetido: ninguém descobre por aqui quem já assina. */
create or replace function public.boletim_assinar(p_email text, p_site text default '') returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v_email text := lower(btrim(coalesce(p_email, '')));
begin
  if coalesce(p_site, '') <> '' then return jsonb_build_object('ok', true); end if;
  perform interno.limite('boletim', 5, 60);
  if v_email !~ '^[^@[:space:]]+@[^@[:space:]]+[.][^@[:space:]]+$' or char_length(v_email) > 200 then perform interno.erro('invalido:email'); end if;
  insert into boletim (email) values (v_email) on conflict do nothing;
  return jsonb_build_object('ok', true);
end $$;

/** A lista, para a coordenação e para quem escreve o jornal mandarem o boletim. */
create or replace function public.boletim_listar() returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
begin
  perform interno.eu();
  if not (interno.coord() or interno.tem('jornalismo')) then perform interno.erro('sem_permissao'); end if;
  perform interno.registrar('boletim_lido');
  return (select coalesce(jsonb_agg(jsonb_build_object('email', email, 'criado_em', criado_em) order by criado_em desc), '[]'::jsonb) from boletim);
end $$;

create or replace function public.boletim_remover(p_email text) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
begin
  perform interno.eu();
  if not (interno.coord() or interno.tem('jornalismo')) then perform interno.erro('sem_permissao'); end if;
  delete from boletim where email = lower(btrim(coalesce(p_email, '')));
  if not found then perform interno.erro('nao_encontrado'); end if;
  return jsonb_build_object('ok', true);
end $$;

-- ───────────────────────────── Trabalho em conjunto ─────────────────────────────

/**
 * Quem escreve pode chamar um colega específico para mexer na própria contribuição (um educador chama uma designer
 * para pôr os gráficos da aula, por exemplo). O acesso vale só para aquela contribuição, só enquanto ela está
 * pendente, e quem liberou tira quando quiser. A pessoa chamada recebe um recado na hora.
 */
create or replace function public.colaboracao_abrir(p_id uuid, p_usuario uuid) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); c contribuicoes;
begin
  select * into c from contribuicoes where id = p_id;
  if not found then perform interno.erro('nao_encontrado'); end if;
  if not (coalesce(c.autor = v, false) or interno.curador()) then perform interno.erro('sem_permissao'); end if;
  if c.status <> 'pendente' then perform interno.erro('ja_decidida'); end if;
  if p_usuario = v or p_usuario is not distinct from c.autor
     or not exists (select 1 from papeis p join perfis f on f.id = p.usuario where p.usuario = p_usuario and not f.suspenso) then perform interno.erro('invalido:usuario'); end if;
  if (select count(*) from colaboradores where contribuicao = p_id) >= 5 then perform interno.erro('limite_colaboradores'); end if;
  insert into colaboradores (contribuicao, usuario, concedido_por) values (p_id, p_usuario, v) on conflict do nothing;
  perform interno.avisar(p_usuario, coalesce((select nome from perfis where id = v), 'Alguém da equipe') || ' chamou você para trabalhar em "' || left(c.titulo, 120) || '". Está em Produção, Compartilhadas comigo.');
  perform interno.registrar('colaboracao_aberta', p_id::text, jsonb_build_object('para', p_usuario));
  return jsonb_build_object('ok', true);
end $$;

/** Encerra o acesso: quem liberou, a curadoria, ou a própria pessoa chamada (que sai quando quiser). */
create or replace function public.colaboracao_fechar(p_id uuid, p_usuario uuid) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu();
begin
  if not (p_usuario = v or interno.curador() or exists (select 1 from contribuicoes where id = p_id and autor = v)) then perform interno.erro('sem_permissao'); end if;
  delete from colaboradores where contribuicao = p_id and usuario = p_usuario;
  if not found then perform interno.erro('nao_encontrado'); end if;
  perform interno.registrar('colaboracao_fechada', p_id::text, jsonb_build_object('de', p_usuario));
  return jsonb_build_object('ok', true);
end $$;

/** As contribuições de colegas que estão abertas para mim. */
create or replace function public.colaboracoes_minhas() returns jsonb language sql security definer set search_path = interno, pg_temp as $$
  select coalesce(jsonb_agg(interno.contribuicao_json(c, false) order by k.criado_em desc), '[]'::jsonb)
  from colaboradores k join contribuicoes c on c.id = k.contribuicao
  where k.usuario = auth.uid() and auth.uid() is not null
    and not exists (select 1 from perfis f where f.id = auth.uid() and f.suspenso)
$$;

/** Quem faz parte da equipe, para a rede interna e para escolher com quem trabalhar junto. Só a equipe vê. */
create or replace function public.equipe_membros() returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
begin
  perform interno.eu();
  if not interno.voluntario() then perform interno.erro('sem_permissao'); end if;
  return (
    select coalesce(jsonb_agg(jsonb_build_object(
      'id', f.id, 'nome', f.nome, 'bio', f.bio, 'eu', f.id = auth.uid(), 'por_aqui', f.visto_em > now() - interval '90 minutes',
      'online', f.visto_em > now() - interval '2 minutes', 'visto_em', f.visto_em,
      'papeis', (select jsonb_agg(jsonb_build_object('papel', p.papel, 'disciplina', p.disciplina) order by p.papel, p.disciplina) from papeis p where p.usuario = f.id))
      order by f.nome), '[]'::jsonb)
    from perfis f where not f.suspenso and exists (select 1 from papeis p where p.usuario = f.id));
end $$;

-- ───────────────────────────── Controles do site ─────────────────────────────

/** O que o site inteiro consulta: o texto da faixa do alto (se a coordenação trocou) e se os envios estão pausados. */
create or replace function public.site() returns jsonb language sql stable security definer set search_path = interno, pg_temp as $$
  select jsonb_build_object(
    'faixa', coalesce((select valor ->> 'faixa' from configuracoes where chave = 'site'), ''),
    'pausa', coalesce((select (valor ->> 'pausa')::boolean from configuracoes where chave = 'site'), false),
    'cadastro', coalesce((select (valor ->> 'cadastro')::boolean from configuracoes where chave = 'site'), true),
    'motivo', coalesce((select valor ->> 'motivo' from configuracoes where chave = 'site'), ''))
$$;

/** Só a coordenação. A pausa fecha, na hora, tudo o que o público pode enviar; a equipe continua trabalhando. */
create or replace function public.site_salvar(p jsonb) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v_valor jsonb;
begin
  perform interno.eu();
  if not interno.coord() then perform interno.erro('sem_permissao'); end if;
  v_valor := jsonb_build_object(
    'faixa', interno.txt(p ->> 'faixa', 'faixa', 0, 140),
    'pausa', coalesce((p ->> 'pausa')::boolean, false),
    -- Quem guarda só a faixa ou a pausa não mexe no cadastro: sem o campo, vale o que já estava.
    'cadastro', coalesce((p ->> 'cadastro')::boolean, (select (valor ->> 'cadastro')::boolean from configuracoes where chave = 'site'), true),
    'motivo', interno.txt(p ->> 'motivo', 'motivo', 0, 200));
  insert into configuracoes (chave, valor) values ('site', v_valor) on conflict (chave) do update set valor = excluded.valor;
  perform interno.registrar('site_configurado', '', v_valor);
  if (v_valor ->> 'pausa')::boolean then perform interno.avisar_lideranca('Os envios do público foram pausados pela coordenação.', auth.uid()); end if;
  return v_valor;
end $$;

/**
 * Com a pausa ligada, nada de quem não é da equipe entra: mural, reforço, boletim, contribuições, comunidade e candidaturas.
 * E de origem barrada pela mediação não entra nada, com ou sem conta, com ou sem pausa.
 */
create or replace function interno.pausa() returns trigger language plpgsql security definer set search_path = interno, pg_temp as $$
begin
  if coalesce((select (valor ->> 'pausa')::boolean from configuracoes where chave = 'site'), false) and not interno.voluntario() and not interno.servico() then
    raise exception 'envios_pausados' using errcode = 'P0001';
  end if;
  if not interno.voluntario() and not interno.servico()
     and exists (select 1 from banimentos b where b.ativo and b.origem is not null and b.origem = interno.origem()) then
    raise exception 'acesso_bloqueado' using errcode = 'P0001';
  end if;
  return new;
end $$;
do $$
declare tabela text;
begin
  foreach tabela in array array['mural', 'reforco', 'boletim', 'contribuicoes', 'topicos', 'respostas', 'inscricoes'] loop
    execute format('drop trigger if exists lucia_pausa on interno.%I', tabela);
    execute format('create trigger lucia_pausa before insert on interno.%I for each row execute function interno.pausa()', tabela);
  end loop;
end $$;

-- ───────────────────────────── Candidatura pública de voluntariado ─────────────────────────────

/**
 * Quem quer ser voluntário preenche o formulário, sem precisar de conta: nome completo, e-mail de contato, função
 * pretendida e uma apresentação. A coordenação lê no painel e responde por e-mail.
 */
create or replace function public.voluntariar(p jsonb) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare
  v_email text := lower(btrim(coalesce(p ->> 'email', '')));
  v_papel text := coalesce(p ->> 'papel', '');
  v_disc text := interno.disciplina_ok(p ->> 'disciplina');
  v_nome text; v_mensagem text; v_id uuid;
begin
  -- Campo-isca: gente não vê, robô preenche. Finge que deu certo e não guarda nada.
  if coalesce(p ->> 'site', '') <> '' then return jsonb_build_object('id', gen_random_uuid()); end if;
  perform interno.limite('voluntariar', 3, 1440);
  if v_email !~ '^[^@[:space:]]+@[^@[:space:]]+[.][^@[:space:]]+$' or char_length(v_email) > 200 then perform interno.erro('invalido:email'); end if;
  if v_papel not in ('curadoria', 'mediacao', 'educacao', 'revisao', 'traducao', 'jornalismo', 'mentoria', 'design', 'desenvolvimento') then perform interno.erro('invalido:papel'); end if;
  if v_papel in ('educacao', 'mentoria') and v_disc is null then perform interno.erro('invalido:disciplina'); end if;
  if v_papel not in ('educacao', 'mentoria') then v_disc := null; end if;
  v_nome := interno.txt(p ->> 'nome', 'nome', 5, 120);
  v_mensagem := interno.txt(p ->> 'mensagem', 'mensagem', 30, 2000);
  if interno.vetado(v_nome || ' ' || v_mensagem) then perform interno.erro('conteudo_recusado'); end if;
  if exists (select 1 from inscricoes where email = v_email and papel = v_papel and status = 'pendente') then perform interno.erro('ja_pediu'); end if;
  insert into inscricoes (nome, email, papel, disciplina, mensagem) values (v_nome, v_email, v_papel, v_disc, v_mensagem) returning id into v_id;
  return jsonb_build_object('id', v_id);
end $$;

create or replace function public.inscricoes_listar() returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
begin
  perform interno.eu();
  if not interno.coord() then perform interno.erro('sem_permissao'); end if;
  return (select coalesce(jsonb_agg(jsonb_build_object('id', i.id, 'nome', i.nome, 'email', i.email, 'papel', i.papel, 'disciplina', i.disciplina,
            'mensagem', i.mensagem, 'status', i.status, 'criado_em', i.criado_em, 'tem_conta', exists (select 1 from auth.users u where lower(u.email) = i.email))
            order by (i.status = 'pendente') desc, i.criado_em desc), '[]'::jsonb)
          from (select * from inscricoes order by criado_em desc limit 300) i);
end $$;

/**
 * A coordenação aceita ou recusa. Aceitar libera o acesso para aquele e-mail: quem já tem conta (com o e-mail confirmado)
 * recebe a função na hora; quem não tem recebe um convite pessoal, que só serve para aquele e-mail e já traz a função.
 * O código do convite é devolvido uma única vez, para a coordenação mandar por e-mail. Curadoria, só o coordenador confia.
 */
create or replace function public.inscricao_decidir(p_id uuid, p_aceitar boolean) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare
  v uuid := interno.eu(); i inscricoes; v_conta uuid; v_confirmado boolean := true;
  v_codigo text := replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '');
begin
  if not interno.coord() then perform interno.erro('sem_permissao'); end if;
  select * into i from inscricoes where id = p_id and status = 'pendente' for update;
  if not found then perform interno.erro('nao_encontrado'); end if;
  if not coalesce(p_aceitar, false) then
    update inscricoes set status = 'recusada', decidido_por = v, decidido_em = now() where id = p_id;
    perform interno.registrar('inscricao_recusada', i.nome, jsonb_build_object('papel', i.papel));
    return jsonb_build_object('ok', true);
  end if;
  if i.papel = 'curadoria' and not interno.lider() then perform interno.erro('sem_permissao'); end if;
  select u.id into v_conta from auth.users u where lower(u.email) = i.email;
  if v_conta is not null then
    -- Sem a confirmação do e-mail, outra pessoa poderia ter criado a conta com o endereço de quem se candidatou.
    if exists (select 1 from information_schema.columns where table_schema = 'auth' and table_name = 'users' and column_name = 'email_confirmed_at') then
      execute 'select email_confirmed_at is not null from auth.users where id = $1' into v_confirmado using v_conta;
    end if;
    if not coalesce(v_confirmado, false) then perform interno.erro('email_nao_confirmado'); end if;
    insert into perfis (id, nome) values (v_conta, left(i.nome, 60)) on conflict do nothing;
    insert into papeis (usuario, papel, disciplina, concedido_por) values (v_conta, i.papel, i.disciplina, v) on conflict do nothing;
    perform interno.avisar(v_conta, 'Sua candidatura a voluntário foi aceita. As ferramentas da sua função já aparecem no painel.');
    v_codigo := null;
  else
    insert into convites (selo, email, papel, disciplina, usos_max, nota, criado_por, expira_em)
    values (interno.selo(v_codigo), i.email, i.papel, i.disciplina, 1, left('Candidatura de ' || i.nome, 120), v, now() + interval '14 days');
  end if;
  update inscricoes set status = 'aceita', decidido_por = v, decidido_em = now() where id = p_id;
  perform interno.registrar('inscricao_aceita', i.nome, jsonb_build_object('papel', i.papel, 'disciplina', i.disciplina, 'convite', v_codigo is not null));
  return jsonb_build_object('ok', true, 'codigo', v_codigo, 'email', i.email, 'nome', i.nome);
end $$;

-- ───────────────────────────── Conversas da equipe ─────────────────────────────

create or replace function interno.da_equipe(p_usuario uuid) returns boolean language sql stable security definer set search_path = interno, pg_temp as $$
  select exists (select 1 from papeis r join perfis f on f.id = r.usuario where r.usuario = p_usuario and not f.suspenso)
$$;

create or replace function interno.na_conversa(p_conversa uuid) returns boolean language sql stable security definer set search_path = interno, pg_temp as $$
  select interno.voluntario() and exists (select 1 from conversa_membros where conversa = p_conversa and usuario = auth.uid())
$$;

/**
 * O painel chama de minuto em minuto enquanto está aberto: marca que a pessoa está por aqui (é o "online" e o
 * "visto por último" que a equipe vê) e devolve quantas conversas têm mensagem nova.
 */
create or replace function public.presenca() returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu();
begin
  update perfis set visto_em = now() where id = v and visto_em < now() - interval '30 seconds';
  return jsonb_build_object('conversas', case when interno.voluntario() then (
    select count(*) from conversa_membros m
    where m.usuario = v and exists (select 1 from conversa_mensagens g where g.conversa = m.conversa and g.criado_em > m.lido_em and g.autor is distinct from v)) else 0 end);
end $$;

/** As minhas conversas, da mais recente para a mais antiga. Ninguém vê conversa de que não participa, nem a coordenação. */
create or replace function public.chat_conversas() returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu();
begin
  if not interno.voluntario() then perform interno.erro('sem_permissao'); end if;
  update perfis set visto_em = now() where id = v and visto_em < now() - interval '30 seconds';
  -- Nada fica guardado por mais de trinta dias.
  delete from conversa_mensagens where criado_em < now() - interval '30 days';
  return (
    select coalesce(jsonb_agg(jsonb_build_object(
      'id', c.id, 'tipo', c.tipo, 'dona', c.criada_por = v,
      'nome', case when c.tipo = 'grupo' then c.nome else coalesce(o.nome, 'Alguém que saiu da equipe') end,
      'outro', case when c.tipo = 'direta' then o.id end,
      'online', case when c.tipo = 'direta' then coalesce(o.visto_em > now() - interval '2 minutes', false) end,
      'visto_em', case when c.tipo = 'direta' then o.visto_em end,
      'membros', (select count(*) from conversa_membros x where x.conversa = c.id),
      'ultima', (select jsonb_build_object('corpo', g.corpo, 'minha', g.autor = v, 'autor', coalesce((select nome from perfis where id = g.autor), ''), 'criado_em', g.criado_em)
                 from conversa_mensagens g where g.conversa = c.id order by g.criado_em desc limit 1),
      'nao_lidas', (select count(*) from conversa_mensagens g where g.conversa = c.id and g.criado_em > m.lido_em and g.autor is distinct from v),
      'movida_em', c.movida_em) order by c.movida_em desc), '[]'::jsonb)
    from conversa_membros m
    join conversas c on c.id = m.conversa
    left join lateral (select f.id, f.nome, f.visto_em from conversa_membros x join perfis f on f.id = x.usuario
                       where x.conversa = c.id and x.usuario <> v and c.tipo = 'direta' limit 1) o on true
    where m.usuario = v);
end $$;

/** Abre (ou reencontra) a conversa privada com uma pessoa da equipe. */
create or replace function public.chat_direta(p_usuario uuid) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); v_par text; v_id uuid;
begin
  if not interno.voluntario() then perform interno.erro('sem_permissao'); end if;
  if p_usuario is null or p_usuario = v or not interno.da_equipe(p_usuario) then perform interno.erro('invalido:usuario'); end if;
  v_par := least(v::text, p_usuario::text) || ':' || greatest(v::text, p_usuario::text);
  insert into conversas (tipo, par, criada_por) values ('direta', v_par, v) on conflict (par) do nothing;
  select id into v_id from conversas where par = v_par;
  insert into conversa_membros (conversa, usuario) values (v_id, v), (v_id, p_usuario) on conflict do nothing;
  return jsonb_build_object('id', v_id);
end $$;

/** Qualquer pessoa da equipe cria um grupo e escolhe quem entra. Quem criou (e a coordenação) cuida dele depois. */
create or replace function public.chat_grupo_criar(p_nome text, p_membros uuid[]) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); v_id uuid := gen_random_uuid(); v_nome text := interno.txt(p_nome, 'nome', 2, 60); m uuid;
begin
  if not interno.voluntario() then perform interno.erro('sem_permissao'); end if;
  perform interno.limite('grupo', 20, 60);
  if coalesce(cardinality(p_membros), 0) not between 1 and 60 then perform interno.erro('invalido:membros'); end if;
  insert into conversas (id, tipo, nome, criada_por) values (v_id, 'grupo', v_nome, v);
  insert into conversa_membros (conversa, usuario) values (v_id, v);
  foreach m in array p_membros loop
    if m = v then continue; end if;
    if not interno.da_equipe(m) then perform interno.erro('invalido:membros'); end if;
    insert into conversa_membros (conversa, usuario) values (v_id, m) on conflict do nothing;
    perform interno.avisar(m, coalesce((select nome from perfis where id = v), 'Alguém da equipe') || ' colocou você no grupo "' || v_nome || '". Está em Conversas.');
  end loop;
  return jsonb_build_object('id', v_id);
end $$;

/** Trocar o nome, pôr e tirar gente: quem criou o grupo ou a coordenação. */
create or replace function public.chat_grupo_mudar(p_id uuid, p_nome text default null, p_incluir uuid[] default '{}', p_tirar uuid[] default '{}') returns jsonb
language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); c conversas; m uuid;
begin
  select * into c from conversas where id = p_id and tipo = 'grupo';
  if not found or not interno.na_conversa(p_id) then perform interno.erro('nao_encontrado'); end if;
  if not (c.criada_por = v or interno.coord()) then perform interno.erro('sem_permissao'); end if;
  if nullif(btrim(coalesce(p_nome, '')), '') is not null then update conversas set nome = interno.txt(p_nome, 'nome', 2, 60) where id = p_id; end if;
  foreach m in array coalesce(p_incluir, '{}') loop
    if not interno.da_equipe(m) then perform interno.erro('invalido:membros'); end if;
    if (select count(*) from conversa_membros where conversa = p_id) >= 61 then perform interno.erro('invalido:membros'); end if;
    insert into conversa_membros (conversa, usuario) values (p_id, m) on conflict do nothing;
    if found then perform interno.avisar(m, coalesce((select nome from perfis where id = v), 'Alguém da equipe') || ' colocou você no grupo "' || c.nome || '". Está em Conversas.'); end if;
  end loop;
  delete from conversa_membros where conversa = p_id and usuario = any (coalesce(p_tirar, '{}')) and usuario <> v;
  return jsonb_build_object('ok', true);
end $$;

/** Sair de um grupo. O grupo que fica vazio some. */
create or replace function public.chat_sair(p_id uuid) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu();
begin
  if not exists (select 1 from conversas where id = p_id and tipo = 'grupo') then perform interno.erro('nao_encontrado'); end if;
  delete from conversa_membros where conversa = p_id and usuario = v;
  if not found then perform interno.erro('nao_encontrado'); end if;
  delete from conversas where id = p_id and not exists (select 1 from conversa_membros where conversa = p_id);
  return jsonb_build_object('ok', true);
end $$;

/** Apagar o grupo inteiro, com as mensagens: quem criou ou a coordenação. */
create or replace function public.chat_grupo_apagar(p_id uuid) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu();
begin
  if not interno.na_conversa(p_id) then perform interno.erro('nao_encontrado'); end if;
  delete from conversas where id = p_id and tipo = 'grupo' and (criada_por = v or interno.coord());
  if not found then perform interno.erro('sem_permissao'); end if;
  return jsonb_build_object('ok', true);
end $$;

/** Abre uma conversa: quem participa, quem está por aqui, as últimas mensagens. Abrir marca como lida. */
create or replace function public.chat_ver(p_id uuid) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); c conversas;
begin
  if not interno.na_conversa(p_id) then perform interno.erro('nao_encontrado'); end if;
  select * into c from conversas where id = p_id;
  update conversa_membros set lido_em = clock_timestamp() where conversa = p_id and usuario = v;
  update perfis set visto_em = now() where id = v and visto_em < now() - interval '30 seconds';
  return jsonb_build_object(
    'id', c.id, 'tipo', c.tipo, 'nome', c.nome, 'dona', c.criada_por = v or (c.tipo = 'grupo' and interno.coord()),
    'membros', (select coalesce(jsonb_agg(jsonb_build_object('id', f.id, 'nome', f.nome, 'eu', f.id = v, 'online', f.visto_em > now() - interval '2 minutes',
                                                              'visto_em', f.visto_em, 'lido_em', m.lido_em) order by f.nome), '[]'::jsonb)
                from conversa_membros m join perfis f on f.id = m.usuario where m.conversa = p_id),
    'mensagens', (select coalesce(jsonb_agg(x.j order by x.criado_em), '[]'::jsonb) from (
                    select g.criado_em, jsonb_build_object('id', g.id, 'autor', g.autor, 'nome', coalesce(f.nome, 'Alguém que saiu da equipe'), 'minha', g.autor = v,
                                                           'corpo', g.corpo, 'criado_em', g.criado_em) as j
                    from conversa_mensagens g left join perfis f on f.id = g.autor where g.conversa = p_id order by g.criado_em desc limit 300) x));
end $$;

create or replace function public.chat_enviar(p_id uuid, p_corpo text) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); v_id uuid;
begin
  if not interno.na_conversa(p_id) then perform interno.erro('nao_encontrado'); end if;
  perform interno.limite('conversa', 600, 60);
  if coalesce((select valor ->> 'prova' from configuracoes where chave = 'equipe'), '') = '' then perform interno.erro('sem_chave'); end if;
  -- O banco recusa texto aberto: só entra o que já chega cifrado.
  if coalesce(p_corpo, '') !~ '^c1[.][A-Za-z0-9_-]{16}[.][A-Za-z0-9_-]+$' or char_length(p_corpo) not between 40 and 4000 then perform interno.erro('invalido:corpo'); end if;
  insert into conversa_mensagens (conversa, autor, corpo) values (p_id, v, p_corpo) returning id into v_id;
  update conversas set movida_em = now() where id = p_id;
  update conversa_membros set lido_em = clock_timestamp() where conversa = p_id and usuario = v;
  return jsonb_build_object('id', v_id);
end $$;

/** Cada pessoa apaga as próprias mensagens. */
create or replace function public.chat_apagar(p_id uuid) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu();
begin
  delete from conversa_mensagens where id = p_id and autor = v and interno.na_conversa(conversa);
  if not found then perform interno.erro('nao_encontrado'); end if;
  return jsonb_build_object('ok', true);
end $$;

-- ───────────────────────────── Iscas do site ─────────────────────────────

/**
 * O site chama esta função quando alguém pede um endereço que só invasor procura (/wp-admin, /.env…).
 * Fica no registro de atividades, sem guardar endereço de rede: só o caminho pedido e o programa usado.
 */
create or replace function public.isca(p_caminho text, p_agente text default '') returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
begin
  perform interno.limite('isca', 20, 60);
  if (select count(*) from auditoria where acao = 'isca' and criado_em > now() - interval '1 hour') < 200 then
    insert into auditoria (quem, nome, acao, alvo, detalhes)
    values (null, '', 'isca', left(coalesce(p_caminho, ''), 200), jsonb_build_object('agente', left(coalesce(p_agente, ''), 200)));
  end if;
  return '{}'::jsonb;
end $$;

-- ───────────────────────────── Livro do acervo ─────────────────────────────

/**
 * Anota no livro cada linha que entra, muda ou sai das tabelas vigiadas. Roda depois da mudança e nunca a impede:
 * se a anotação falhar, o banco avisa no próprio registro de erros e o trabalho de quem estava mexendo segue.
 */
create or replace function interno.audit_logs_anotar() returns trigger language plpgsql security definer set search_path = interno, pg_temp as $$
declare
  v_linha jsonb; v_velha jsonb; v_acao text; v_de text; v_para text; v_campos text[] := '{}';
begin
  begin
    if tg_op = 'INSERT' then
      v_linha := to_jsonb(new); v_acao := 'insercao'; v_para := v_linha ->> 'status';
    elsif tg_op = 'DELETE' then
      v_linha := to_jsonb(old); v_acao := 'exclusao'; v_de := v_linha ->> 'status';
    else
      v_linha := to_jsonb(new); v_velha := to_jsonb(old);
      if v_linha = v_velha then return null; end if;
      select coalesce(array_agg(n.key order by n.key), '{}') into v_campos from jsonb_each(v_linha) n where n.value is distinct from v_velha -> n.key;
      v_de := v_velha ->> 'status'; v_para := v_linha ->> 'status';
      v_acao := case
        when v_para is distinct from v_de and v_para in ('aprovada', 'aprovado', 'resolvida') then 'aprovacao'
        when v_para is distinct from v_de and v_para in ('recusada', 'recusado') then 'recusa'
        when v_para is distinct from v_de and v_para in ('publicada', 'publicado') then 'publicacao'
        when v_linha ->> 'publicado' = 'true' and v_velha ->> 'publicado' = 'false' then 'publicacao'
        else 'edicao' end;
    end if;
    insert into audit_logs (tabela, registro, acao, quem, via, titulo, de, para, campos, detalhes)
    values (
      tg_table_name, coalesce(v_linha ->> 'id', ''), v_acao, auth.uid(), coalesce(nullif(interno.claims() ->> 'role', ''), 'banco'),
      left(coalesce(v_linha ->> 'titulo', v_linha ->> 'nome', v_linha ->> 'papel', ''), 160), v_de, v_para, v_campos,
      coalesce((select jsonb_object_agg(e.key, e.value) from jsonb_each(v_linha) e
                where e.key in ('tipo', 'disciplina', 'papel', 'usuario', 'concedido_por', 'destino', 'publicado') and jsonb_typeof(e.value) <> 'null'), '{}'::jsonb));
    if random() < 0.01 then delete from audit_logs where criado_em < now() - interval '400 days'; end if;
  exception when others then
    raise warning 'audit_logs: %', sqlerrm;
  end;
  return null;
end $$;

do $$
declare tabela text;
begin
  foreach tabela in array array['contribuicoes', 'arquivos', 'materiais', 'papeis'] loop
    execute format('drop trigger if exists lucia_audit on interno.%I', tabela);
    execute format('create trigger lucia_audit after insert or update or delete on interno.%I for each row execute function interno.audit_logs_anotar()', tabela);
  end loop;
end $$;

/** O livro só cresce: nenhuma linha é editada, e só sai a que já passou do prazo de guarda. Vale até para o dono do banco. */
create or replace function interno.audit_logs_trava() returns trigger language plpgsql as $$
begin
  if tg_op = 'DELETE' then
    if old.criado_em < now() - interval '400 days' then return old; end if;
  end if;
  raise exception 'audit_logs_imutavel' using errcode = 'P0001';
end $$;
drop trigger if exists lucia_audit_trava on interno.audit_logs;
create trigger lucia_audit_trava before update or delete on interno.audit_logs for each row execute function interno.audit_logs_trava();
drop trigger if exists lucia_audit_trava_tudo on interno.audit_logs;
create trigger lucia_audit_trava_tudo before truncate on interno.audit_logs for each statement execute function interno.audit_logs_trava();

/** O livro, do mais recente para o mais antigo. Só a coordenação e a vice-coordenação leem. */
create or replace function public.audit_logs_listar(p_pagina integer default 0, p_tabela text default null) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
begin
  perform interno.eu();
  if not interno.coord() then perform interno.erro('sem_permissao'); end if;
  return (
    select coalesce(jsonb_agg(jsonb_build_object('id', a.id, 'criado_em', a.criado_em, 'tabela', a.tabela, 'acao', a.acao, 'titulo', a.titulo, 'de', a.de, 'para', a.para,
      'campos', to_jsonb(a.campos), 'via', a.via, 'detalhes', a.detalhes,
      'nome', coalesce((select f.nome from perfis f where f.id = a.quem), ''),
      'alvo_nome', coalesce((select f.nome from perfis f where f.id::text = a.detalhes ->> 'usuario'), '')) order by a.id desc), '[]'::jsonb)
    from (select * from audit_logs where coalesce(p_tabela, '') = '' or tabela = p_tabela order by id desc limit 100 offset greatest(coalesce(p_pagina, 0), 0) * 100) a);
end $$;

-- ───────────────────────────── Permissões ─────────────────────────────

-- As funções internas não podem ser chamadas de fora; as públicas, sim (cada uma faz a própria conferência).
do $$
declare f record;
begin
  for f in select p.oid::regprocedure as assinatura, n.nspname from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname in ('interno', 'public') and p.prokind = 'f'
           and (n.nspname = 'interno' or p.proname in (
             'eu', 'perfil_salvar', 'conta_apagar', 'candidatar', 'candidaturas_minhas', 'candidaturas_listar', 'candidatura_decidir', 'voluntarios_listar', 'pessoas_buscar',
             'papel_conceder', 'papel_remover', 'usuario_suspender', 'equipe', 'promover_coordenacao', 'contribuir', 'contribuicoes_minhas', 'fila',
             'contribuicao_ver', 'contribuicao_editar', 'parecer', 'contribuicao_decidir', 'publicacoes_pendentes', 'publicacoes_marcar', 'topicos_listar',
             'topico_ver', 'topico_criar', 'responder', 'votar', 'comunidade_cuidar', 'denunciar', 'denuncias_listar', 'denuncia_resolver', 'anotacoes_listar',
             'anotar', 'anotacoes_fila', 'anotacao_decidir', 'apoiadores_listar', 'apoiador_salvar', 'apoiador_remover', 'radio_estado', 'radio_configurar',
             'radio_canal_salvar', 'radio_canal_remover', 'radio_faixa_salvar', 'radio_faixa_remover', 'progresso_salvar', 'progresso_listar', 'painel_resumo',
             'mural_listar', 'mural_enviar', 'mural_meus', 'mural_remover', 'mural_renovar', 'mural_fila', 'mural_decidir', 'mural_editar',
             'triagem_fila', 'triagem_decidir', 'comunidade_editar', 'mediacao_banir', 'banimentos_listar', 'banimento_encerrar',
             'voluntariar', 'inscricoes_listar', 'inscricao_decidir',
             'lideranca_passar', 'sucessao_definir', 'sucessao_ver', 'seguranca_ver', 'seguranca_configurar', 'acesso_registrar', 'aparelhos_meus',
             'aparelho_esquecer', 'avisos_meus', 'aviso_ler', 'auditoria_listar', 'exportar_usuarios', 'admin_senhas', 'chaves_api', 'resposta_aceitar',
             'comunidade_retidos', 'filtro_listar', 'filtro_salvar', 'abertura', 'abertura_salvar', 'reforco_pedir', 'reforco_meus', 'reforco_cancelar',
             'reforco_fila', 'reforco_assumir', 'reforco_soltar', 'reforco_concluir', 'equipe_canais', 'equipe_listar', 'equipe_escrever', 'equipe_marcar',
             'equipe_apagar', 'equipe_sala_salvar', 'materiais_listar', 'material_salvar', 'material_remover', 'termo_meu', 'termo_aceitar',
             'horas_registrar', 'horas_minhas', 'horas_remover', 'horas_fila', 'horas_conferir', 'certificado_abrir', 'certificado_testemunhar',
             'certificado_emitir', 'certificado_cancelar', 'certificados_listar', 'certificado_conferir', 'arquivo_bloquear', 'arquivos_bloqueados',
             'arquivo_registrar', 'arquivos_listar', 'arquivo_decidir', 'arquivos_aprovados', 'arquivo_publicado',
             'convite_criar', 'convites_listar', 'convite_revogar', 'convite_ver', 'convidar_pelo_banco', 'mural_cidades', 'mural_retirar',
             'equipe_chave_definir', 'equipe_apagar_tudo', 'arquivo_apoiar', 'isca', 'boletim_assinar', 'boletim_listar', 'boletim_remover',
             'colaboracao_abrir', 'colaboracao_fechar', 'colaboracoes_minhas', 'equipe_membros', 'site', 'site_salvar',
             'presenca', 'chat_conversas', 'chat_direta', 'chat_grupo_criar', 'chat_grupo_mudar', 'chat_sair', 'chat_grupo_apagar', 'chat_ver', 'chat_enviar', 'chat_apagar',
             'audit_logs_listar'))
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
revoke all on function public.convidar_pelo_banco(text) from anon, authenticated;

-- ───────────────────────────── Arquivos da rádio ─────────────────────────────

-- Um depósito público só para leitura; só a coordenação e o jornalismo (a rádio) enviam ou apagam. Limite de 50 MB e só áudio.
do $$
begin
  if exists (select 1 from pg_namespace where nspname = 'storage') then
    insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    values ('radio', 'radio', true, 52428800, array['audio/ogg', 'audio/opus', 'audio/mpeg', 'audio/mp4', 'audio/webm'])
    on conflict (id) do update set public = true, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

    execute 'drop policy if exists "radio_envio_coordenacao" on storage.objects';
    execute 'create policy "radio_envio_coordenacao" on storage.objects for insert to authenticated with check (bucket_id = ''radio'' and interno.radialista())';
    execute 'drop policy if exists "radio_remocao_coordenacao" on storage.objects';
    execute 'create policy "radio_remocao_coordenacao" on storage.objects for delete to authenticated using (bucket_id = ''radio'' and interno.radialista())';
    execute 'grant execute on function interno.radialista() to authenticated';
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
    values ('envios', 'envios', false, 8388608, array['image/webp', 'image/jpeg', 'application/pdf'])
    on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

    execute 'drop policy if exists "envios_envio" on storage.objects';
    execute 'create policy "envios_envio" on storage.objects for insert to authenticated with check (bucket_id = ''envios'' and interno.envia() and (storage.foldername(name))[1] = auth.uid()::text)';
    execute 'drop policy if exists "envios_leitura" on storage.objects';
    execute 'create policy "envios_leitura" on storage.objects for select to authenticated using (bucket_id = ''envios'' and ((storage.foldername(name))[1] = auth.uid()::text or interno.voluntario()))';
    execute 'drop policy if exists "envios_remocao" on storage.objects';
    execute 'create policy "envios_remocao" on storage.objects for delete to authenticated using (bucket_id = ''envios'' and ((storage.foldername(name))[1] = auth.uid()::text or interno.curador()))';
    execute 'grant execute on function interno.envia() to authenticated';
    execute 'grant execute on function interno.voluntario() to authenticated';
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
