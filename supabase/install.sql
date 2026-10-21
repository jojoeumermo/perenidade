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

-- A coordenação redefine a senha de quem esqueceu gravando-a do jeito que o serviço de contas grava (bcrypt, da extensão
-- pgcrypto). No Supabase ela já vem ligada, no esquema "extensions"; aqui só se garante que exista. Sem ela, nada quebra:
-- só a redefinição de senha pelo painel responde que não está disponível.
do $$
begin
  if not exists (select 1 from pg_extension where extname = 'pgcrypto') then
    if exists (select 1 from pg_namespace where nspname = 'extensions') then
      create extension if not exists pgcrypto with schema extensions;
    else
      create extension if not exists pgcrypto;
    end if;
  end if;
exception when others then
  raise notice 'pgcrypto indisponível (%): a redefinição de senha pelo painel fica desligada.', sqlerrm;
end $$;

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
-- Escondido sai do mural público sem apagar; o consentimento diz como a pessoa autorizou o nome ali.
alter table interno.apoiadores add column if not exists visivel boolean not null default true;
alter table interno.apoiadores add column if not exists consentimento text not null default 'adicionado pela coordenação';

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
-- Quem teve a senha redefinida pela coordenação escolhe outra no próximo acesso, antes de o painel abrir.
alter table interno.perfis add column if not exists trocar_senha boolean not null default false;
-- De onde veio a suspensão em vigor. A supervisão só desfaz a que ela mesma fez; o resto é com a coordenação.
alter table interno.perfis add column if not exists suspensao text not null default '' check (suspensao in ('', 'coordenacao', 'supervisao', 'mediacao', 'sistema'));
alter table interno.topicos add column if not exists tipo text not null default 'conversa' check (tipo in ('conversa', 'duvida'));
alter table interno.topicos add column if not exists aceita uuid;
alter table interno.topicos add column if not exists retido boolean not null default false;
alter table interno.respostas add column if not exists retido boolean not null default false;
-- O veredito da avaliação automática de cada mensagem da Comunidade e o motivo dele. 'revista' é a bloqueada que a equipe liberou depois.
alter table interno.topicos add column if not exists avaliacao text check (avaliacao is null or avaliacao in ('publicada', 'revisao', 'bloqueada', 'revista'));
alter table interno.topicos add column if not exists motivo text not null default '';
alter table interno.respostas add column if not exists avaliacao text check (avaliacao is null or avaliacao in ('publicada', 'revisao', 'bloqueada', 'revista'));
alter table interno.respostas add column if not exists motivo text not null default '';
-- Segunda avaliação: quando a mensagem foi entregue para avaliar pela última vez e quantas vezes já foi.
alter table interno.topicos add column if not exists avaliacao_em timestamptz;
alter table interno.topicos add column if not exists tentativas smallint not null default 0;
alter table interno.respostas add column if not exists avaliacao_em timestamptz;
alter table interno.respostas add column if not exists tentativas smallint not null default 0;
-- Conversa ligada a uma aula ou a uma obra do acervo, e resposta a outra resposta (a árvore da conversa).
alter table interno.topicos add column if not exists alvo text check (alvo is null or alvo ~ '^/(trilhas|acervo)/[a-z0-9/-]{2,200}$');
alter table interno.topicos add column if not exists alvo_titulo text not null default '' check (char_length(alvo_titulo) <= 200);
alter table interno.respostas add column if not exists pai uuid references interno.respostas (id) on delete set null;
create index if not exists topicos_alvo on interno.topicos (alvo) where alvo is not null;

-- Papéis e tipos de contribuição acrescentados depois da primeira instalação. A supervisão é cargo de confiança: entra
-- por nomeação ou convite, nunca por candidatura. A educação secundária tem os poderes da educação, na disciplina; o
-- marketing e divulgação, os do design (materiais e imagens), mais a seção Divulgação.
do $$
begin
  alter table interno.papeis drop constraint if exists papeis_papel_check;
  alter table interno.papeis add constraint papeis_papel_check
    check (papel in ('coordenacao', 'vice', 'supervisao', 'curadoria', 'mediacao', 'educacao', 'educacao_secundaria', 'revisao', 'traducao', 'jornalismo', 'mentoria', 'design', 'marketing', 'desenvolvimento', 'representante', 'porta_voz', 'saude'));
  alter table interno.candidaturas drop constraint if exists candidaturas_papel_check;
  alter table interno.candidaturas add constraint candidaturas_papel_check
    check (papel in ('curadoria', 'mediacao', 'educacao', 'educacao_secundaria', 'revisao', 'traducao', 'jornalismo', 'mentoria', 'design', 'marketing', 'desenvolvimento', 'porta_voz', 'saude'));
  alter table interno.contribuicoes drop constraint if exists contribuicoes_tipo_check;
  alter table interno.contribuicoes add constraint contribuicoes_tipo_check
    check (tipo in ('aula', 'obra', 'artigo', 'checagem', 'debate', 'verbete', 'memorial', 'video', 'frase', 'traducao', 'correcao', 'sugestao', 'questao', 'avulso', 'temas', 'pratica'));
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
  papel text not null check (papel in ('curadoria', 'mediacao', 'educacao', 'revisao', 'traducao', 'jornalismo', 'mentoria', 'design', 'desenvolvimento', 'educacao_secundaria', 'marketing', 'porta_voz')),
  disciplina text check (disciplina is null or disciplina ~ '^[a-z0-9-]{2,40}$'),
  mensagem text not null check (char_length(mensagem) between 30 and 2000),
  status text not null default 'pendente' check (status in ('pendente', 'aceita', 'recusada')),
  decidido_por uuid references interno.perfis (id) on delete set null,
  decidido_em timestamptz,
  criado_em timestamptz not null default now()
);
create index if not exists inscricoes_status on interno.inscricoes (status, criado_em);
-- Funções acrescentadas depois: educação secundária e marketing e divulgação.
alter table interno.inscricoes drop constraint if exists inscricoes_papel_check;
alter table interno.inscricoes add constraint inscricoes_papel_check
  check (papel in ('curadoria', 'mediacao', 'educacao', 'educacao_secundaria', 'revisao', 'traducao', 'jornalismo', 'mentoria', 'design', 'marketing', 'desenvolvimento', 'porta_voz', 'saude'));

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
-- A conta já estava suspensa pela coordenação quando foi banida (ou foi suspensa durante o banimento)? Então encerrar o
-- banimento não tira essa suspensão: ela é outra decisão, que só a coordenação desfaz.
alter table interno.banimentos add column if not exists ja_suspensa boolean not null default false;

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

-- Assistente de reforço: só os contadores de uso por pessoa e por dia. Pergunta e resposta nunca passam pelo banco.
create table if not exists interno.assistente_uso (
  dia date not null,
  usuario uuid not null references interno.perfis (id) on delete cascade,
  usos integer not null default 0 check (usos >= 0),
  primary key (dia, usuario)
);

-- Conversa interna da equipe, por canal. "pedidos" é onde uma função pede ajuda a outra.
create table if not exists interno.equipe_mensagens (
  id uuid primary key default gen_random_uuid(),
  canal text not null check (canal in ('geral', 'pedidos', 'aprendizado', 'coordenacao', 'curadoria', 'educacao', 'revisao', 'traducao', 'jornalismo', 'mentoria', 'design', 'desenvolvimento')),
  resposta_a uuid references interno.equipe_mensagens (id) on delete cascade,
  autor uuid references interno.perfis (id) on delete set null,
  para text check (para is null or para in ('coordenacao', 'curadoria', 'educacao', 'revisao', 'traducao', 'jornalismo', 'mentoria', 'design', 'desenvolvimento')),
  corpo text not null check (char_length(corpo) between 1 and 4000),
  resolvido boolean not null default false,
  criado_em timestamptz not null default now()
);
create index if not exists equipe_canal on interno.equipe_mensagens (canal, criado_em desc);
-- Um canal por função, inclusive as que vieram depois (mediação, supervisão, marketing): sem isto, o banco recusava a
-- mensagem do canal da mediação e o pedido de ajuda endereçado a ela.
alter table interno.equipe_mensagens drop constraint if exists equipe_mensagens_canal_check;
alter table interno.equipe_mensagens add constraint equipe_mensagens_canal_check
  check (canal in ('geral', 'pedidos', 'aprendizado', 'coordenacao', 'supervisao', 'curadoria', 'mediacao', 'educacao', 'revisao', 'traducao', 'jornalismo', 'mentoria', 'design', 'marketing', 'desenvolvimento'));
alter table interno.equipe_mensagens drop constraint if exists equipe_mensagens_para_check;
alter table interno.equipe_mensagens add constraint equipe_mensagens_para_check
  check (para is null or para in ('coordenacao', 'supervisao', 'curadoria', 'mediacao', 'educacao', 'revisao', 'traducao', 'jornalismo', 'mentoria', 'design', 'marketing', 'desenvolvimento'));

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

-- O que a plataforma conta sozinha entra em "horas" com a origem 'plataforma' e a "fonte" (o trabalho que gerou a linha,
-- como "aula:<id>"): a mesma coisa nunca conta duas vezes.
alter table interno.horas add column if not exists origem text not null default 'manual' check (origem in ('manual', 'plataforma'));
alter table interno.horas add column if not exists fonte text check (fonte is null or char_length(fonte) <= 120);
create unique index if not exists horas_fonte on interno.horas (usuario, fonte) where fonte is not null;
create index if not exists auditoria_quem on interno.auditoria (quem, acao);

-- Pedidos de certificado: o voluntário pede, a coordenação abre o processo (ou responde com uma nota).
create table if not exists interno.certificado_pedidos (
  id uuid primary key default gen_random_uuid(),
  usuario uuid not null references interno.perfis (id) on delete cascade,
  inicio date not null,
  fim date not null,
  mensagem text not null default '' check (char_length(mensagem) <= 1000),
  status text not null default 'pendente' check (status in ('pendente', 'atendido', 'recusado', 'cancelado')),
  nota text not null default '' check (char_length(nota) <= 1000),
  certificado uuid references interno.certificados (id) on delete set null,
  decidido_por uuid references interno.perfis (id) on delete set null,
  decidido_em timestamptz,
  criado_em timestamptz not null default now(),
  check (fim >= inicio)
);
create unique index if not exists certificado_pedidos_aberto on interno.certificado_pedidos (usuario) where status = 'pendente';

-- Palavras que seguram uma mensagem da comunidade para leitura antes de ela aparecer. A curadoria edita a lista no painel.
create table if not exists interno.termos_vetados (termo text primary key check (termo ~ '^[a-z0-9 ]{3,40}$'));

-- Impressão digital de arquivos recusados por serem falsos ou perigosos: o mesmo arquivo não entra de novo.
-- Materiais: o arquivo enviado pelo próprio formulário, crédito e licença obrigatórios, e o que a lei eleitoral pede ao
-- material de apoio a candidatura. O endereço pode ficar vazio enquanto o arquivo espera a publicação.
alter table interno.materiais add column if not exists credito_autor text not null default '' check (char_length(credito_autor) <= 160);
alter table interno.materiais add column if not exists credito_origem text not null default '' check (char_length(credito_origem) <= 200);
alter table interno.materiais add column if not exists licenca text not null default '' check (licenca in ('', 'cc-by-sa', 'cc-by', 'cc0', 'dominio-publico', 'autorizacao', 'outra'));
alter table interno.materiais add column if not exists candidatura boolean not null default false;
alter table interno.materiais add column if not exists candidatura_responsavel text not null default '' check (char_length(candidatura_responsavel) <= 200);
alter table interno.materiais add column if not exists candidatura_sem_impulsionamento boolean not null default false;
alter table interno.materiais add column if not exists candidatura_votacao date;
alter table interno.materiais drop constraint if exists materiais_url_check;
alter table interno.materiais add constraint materiais_url_check check (url = '' or ((url ~ '^https://[^[:space:]]+$' or url ~ '^/[A-Za-z0-9/._-]+$') and char_length(url) <= 500));

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
alter table interno.materiais add column if not exists arquivo uuid references interno.arquivos (id) on delete set null;

insert into interno.configuracoes (chave, valor) values
  ('seguranca', '{"exigir_2fa": true, "padrao_ligado": true}'::jsonb),
  ('abertura', '{"definido": false}'::jsonb),
  ('equipe', '{"sala": ""}'::jsonb),
  ('comunidade', '{"avaliacao_externa": false}'::jsonb)
on conflict do nothing;

-- A exigência de segundo fator para coordenação, vice-coordenação, curadoria e mediação nasce ligada. Banco instalado antes
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
  papel text check (papel is null or papel in ('vice', 'curadoria', 'mediacao', 'educacao', 'revisao', 'traducao', 'jornalismo', 'mentoria', 'design', 'desenvolvimento', 'educacao_secundaria', 'marketing', 'porta_voz')),
  disciplina text check (disciplina is null or disciplina ~ '^[a-z0-9-]{2,40}$'),
  usos_max integer not null default 1 check (usos_max between 1 and 200),
  usos integer not null default 0,
  nota text not null default '' check (char_length(nota) <= 120),
  criado_por uuid references interno.perfis (id) on delete set null,
  criado_em timestamptz not null default now(),
  expira_em timestamptz not null,
  revogado boolean not null default false
);
-- Funções acrescentadas depois da primeira instalação: o convite também pode trazer a mediação, a supervisão e o marketing.
alter table interno.convites drop constraint if exists convites_papel_check;
alter table interno.convites add constraint convites_papel_check
  check (papel is null or papel in ('vice', 'supervisao', 'curadoria', 'mediacao', 'educacao', 'educacao_secundaria', 'revisao', 'traducao', 'jornalismo', 'mentoria', 'design', 'marketing', 'desenvolvimento', 'porta_voz', 'saude'));
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
delete from interno.equipe_mensagens where corpo !~ '^c[12][.]';

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
-- Confirmação em duas etapas: o endereço só entra na lista depois de a pessoa clicar no link que recebeu. O código serve
-- para confirmar e para sair. Quem já estava na lista antes disso continua valendo.
alter table interno.boletim add column if not exists confirmado boolean not null default true;
alter table interno.boletim add column if not exists codigo text check (codigo is null or codigo ~ '^[a-f0-9]{32}$');
update interno.boletim set codigo = replace(gen_random_uuid()::text, '-', '') where codigo is null;
-- Qualidade da lista: endereço que falha seguidamente para de receber (sem rastrear abertura nem clique de ninguém).
alter table interno.boletim add column if not exists falhas integer not null default 0;
alter table interno.boletim add column if not exists pausado boolean not null default false;

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
-- Ordem de chegada, para desempatar o que acontece no mesmo instante (o relógio pode repetir o valor).
alter table interno.conversa_membros add column if not exists ordem bigint generated by default as identity;
alter table interno.conversa_mensagens add column if not exists ordem bigint generated by default as identity;

-- Grupos fixos de cada departamento: quem tem a função entra sozinho e não sai; a coordenação está em todos.
-- 'geral' é o grupo da equipe inteira.
alter table interno.conversas drop constraint if exists conversas_tipo_check;
alter table interno.conversas add constraint conversas_tipo_check check (tipo in ('direta', 'grupo', 'departamento'));
alter table interno.conversas add column if not exists departamento text;
alter table interno.conversas drop constraint if exists conversas_departamento_check;
-- Grupo de departamento que deixou de existir (de uma versão anterior) vira grupo comum: a conversa e as mensagens ficam,
-- só sai do conjunto dos fixos. Assim a regra abaixo nunca para a instalação.
update interno.conversas set tipo = 'grupo', departamento = null
where departamento is not null and departamento not in
  ('geral', 'coordenacao', 'supervisao', 'curadoria', 'mediacao', 'educacao', 'revisao', 'traducao', 'jornalismo', 'mentoria', 'design', 'desenvolvimento', 'marketing');
alter table interno.conversas add constraint conversas_departamento_check check (departamento is null or departamento in
  ('geral', 'coordenacao', 'supervisao', 'curadoria', 'mediacao', 'educacao', 'revisao', 'traducao', 'jornalismo', 'mentoria', 'design', 'desenvolvimento', 'marketing'));
create unique index if not exists conversas_departamento on interno.conversas (departamento);
-- Autodestruição: mensagem enviada com ela ligada some sozinha depois do prazo escolhido (uma hora, um dia, sete dias).
alter table interno.conversas add column if not exists apagar_apos integer check (apagar_apos is null or apagar_apos in (3600, 86400, 604800));
alter table interno.conversas add column if not exists apagar_por uuid references interno.perfis (id) on delete set null;
alter table interno.conversas add column if not exists apagar_desde timestamptz;
-- A partir de qual versão da chave a conversa aceita mensagens. Sobe quando alguém sai: a chave é trocada na próxima mensagem.
alter table interno.conversas add column if not exists versao_minima integer not null default 1;
alter table interno.conversa_mensagens add column if not exists expira_em timestamptz;
alter table interno.conversa_mensagens add column if not exists versao integer;
create index if not exists conversa_mensagens_expira on interno.conversa_mensagens (expira_em) where expira_em is not null;
alter table interno.equipe_mensagens add column if not exists versao integer;

-- Cifra de ponta a ponta das conversas, sem frase combinada. Cada aparelho cria o próprio par de chaves no navegador; a parte
-- privada nunca sai de lá (nem o próprio navegador a exporta). Aqui fica só a parte pública, que serve para os colegas
-- embrulharem para este aparelho a chave de cada conversa.
create table if not exists interno.chat_aparelhos (
  id uuid primary key default gen_random_uuid(),
  usuario uuid not null references interno.perfis (id) on delete cascade,
  -- Ponto da curva P-256, sem compressão (65 bytes, base64url): sempre começa com "B".
  publica text not null unique check (publica ~ '^B[A-Za-z0-9_-]{86}$'),
  rotulo text not null default '' check (char_length(rotulo) <= 80),
  criado_em timestamptz not null default now(),
  visto_em timestamptz not null default now()
);
create index if not exists chat_aparelhos_usuario on interno.chat_aparelhos (usuario);
-- Cada conversa tem uma ou mais versões de chave (uma nova a cada troca). O banco só guarda que a versão existe.
create table if not exists interno.chat_versoes (
  conversa uuid not null references interno.conversas (id) on delete cascade,
  versao integer not null check (versao between 1 and 1000000),
  criada_por uuid references interno.chat_aparelhos (id) on delete set null,
  criado_em timestamptz not null default now(),
  primary key (conversa, versao)
);
-- A chave de uma versão, embrulhada para um aparelho: só esse aparelho a desembrulha. "de_publica" é a chave pública de quem
-- embrulhou, guardada junto para o embrulho continuar valendo mesmo que aquele aparelho seja removido depois.
create table if not exists interno.chat_chaves (
  conversa uuid not null,
  versao integer not null,
  para uuid not null references interno.chat_aparelhos (id) on delete cascade,
  de uuid references interno.chat_aparelhos (id) on delete set null,
  de_publica text not null check (de_publica ~ '^B[A-Za-z0-9_-]{86}$'),
  embrulho text not null check (embrulho ~ '^w1[.][A-Za-z0-9_-]{16}[.][A-Za-z0-9_-]{64}$'),
  criado_em timestamptz not null default now(),
  primary key (conversa, versao, para),
  foreign key (conversa, versao) references interno.chat_versoes (conversa, versao) on delete cascade
);
create index if not exists chat_chaves_para on interno.chat_chaves (para);

-- Confiança entre aparelhos. Cada conta tem uma chave de identidade (ECDSA P-256), criada no primeiro aparelho; o banco guarda
-- só a parte pública. Todo aparelho leva um certificado: a assinatura da chave pública dele pela identidade. Aparelho novo
-- entra "pendente" (sem certificado) e só recebe chaves dos colegas depois que um aparelho já aprovado da mesma pessoa o
-- certifica, conferindo um código mostrado na tela do aparelho novo. O banco não confere assinatura nenhuma: quem confere é
-- o aparelho de cada colega, com a identidade que ele conhece da pessoa. É isso que impede o banco de inserir um aparelho falso.
create table if not exists interno.chat_identidades (
  usuario uuid primary key references interno.perfis (id) on delete cascade,
  assina text check (assina is null or assina ~ '^B[A-Za-z0-9_-]{86}$'),
  -- Sobe cada vez que a identidade é recomeçada (todos os aparelhos perdidos, sem cópia de recuperação).
  versao integer not null default 1,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
alter table interno.chat_aparelhos add column if not exists certificado text check (certificado is null or certificado ~ '^[A-Za-z0-9_-]{86}$');
alter table interno.chat_aparelhos add column if not exists aprovado_por uuid references interno.chat_aparelhos (id) on delete set null;
alter table interno.chat_aparelhos add column if not exists aprovado_em timestamptz;
-- A identidade da conta, embrulhada por quem aprovou para este aparelho (só ele abre). "aprovado_publica" é a chave de quem embrulhou.
alter table interno.chat_aparelhos add column if not exists identidade_embrulho text check (identidade_embrulho is null or identidade_embrulho ~ '^w1[.][A-Za-z0-9_-]{16}[.][A-Za-z0-9_-]{64}$');
alter table interno.chat_aparelhos add column if not exists aprovado_publica text check (aprovado_publica is null or aprovado_publica ~ '^B[A-Za-z0-9_-]{86}$');
-- O pedido de aprovação: a chave pública do aparelho novo, cifrada com o código que ele mostra na tela.
alter table interno.chat_aparelhos add column if not exists pedido jsonb;
alter table interno.chat_aparelhos add column if not exists pedido_em timestamptz;
-- Cópia de recuperação: a identidade e as chaves de conversa, cifradas no aparelho com a chave de recuperação da pessoa.
create table if not exists interno.chat_recuperacoes (
  usuario uuid primary key references interno.perfis (id) on delete cascade,
  copia jsonb not null,
  atualizado_em timestamptz not null default now()
);

-- Mensagens: além do texto, reações e edições são mensagens cifradas que apontam para outra ("alvo"). O banco sabe que
-- alguém reagiu ou editou (e a quê), nunca com que emoji nem com que texto. Citação, encaminhamento, menção e prévia de
-- link vão dentro do cifrado, invisíveis ao banco.
alter table interno.conversa_mensagens add column if not exists tipo text not null default 'texto' check (tipo in ('texto', 'reacao', 'edicao'));
alter table interno.conversa_mensagens add column if not exists alvo uuid references interno.conversa_mensagens (id) on delete cascade;
create index if not exists conversa_mensagens_alvo on interno.conversa_mensagens (alvo) where alvo is not null;
-- Entrega e "digitando…": quando cada pessoa recebeu (abriu no aparelho) as mensagens da conversa, e se está escrevendo agora.
alter table interno.conversa_membros add column if not exists recebido_em timestamptz not null default now();
alter table interno.conversa_membros add column if not exists digitando_em timestamptz;
alter table interno.conversa_membros add column if not exists digitando text not null default '' check (digitando in ('', 'texto', 'audio'));
-- Cada pessoa escolhe se mostra o "visto por último" e a confirmação de leitura. Quem esconde também não vê o dos outros.
alter table interno.perfis add column if not exists chat_visto boolean not null default true;
alter table interno.perfis add column if not exists chat_leitura boolean not null default true;
-- Retrato: um ícone pré-definido ("p:estrela") para todo mundo; coordenação, coordenação pedagógica e supervisão podem
-- subir uma imagem própria, pequena (WebP em data URI, redesenhada no navegador, sem dados da câmera).
alter table interno.perfis add column if not exists avatar text not null default '' check (char_length(avatar) <= 40000);
alter table interno.perfis add column if not exists curriculo jsonb not null default '{}'::jsonb;
-- O termo de voluntariado que todo mundo da equipe confirma ao abrir o painel (não é CLT: trabalho voluntário).
alter table interno.perfis add column if not exists termo_voluntario_em timestamptz;
-- O aprendizado interno: quem aceitou aprender com os educadores pelo painel.
alter table interno.perfis add column if not exists aprendizado_em timestamptz;
-- Mensagens fixadas (por conversa, para todos) e favoritas (de cada pessoa, em todos os aparelhos dela).
create table if not exists interno.conversa_fixadas (
  mensagem uuid primary key references interno.conversa_mensagens (id) on delete cascade,
  conversa uuid not null references interno.conversas (id) on delete cascade,
  por uuid references interno.perfis (id) on delete set null,
  criado_em timestamptz not null default now()
);
create index if not exists conversa_fixadas_conversa on interno.conversa_fixadas (conversa);
create table if not exists interno.conversa_favoritas (
  usuario uuid not null references interno.perfis (id) on delete cascade,
  mensagem uuid not null references interno.conversa_mensagens (id) on delete cascade,
  criado_em timestamptz not null default now(),
  primary key (usuario, mensagem)
);
-- Arquivos das conversas (foto, vídeo, áudio, PDF, DOCX). O aparelho cifra cada arquivo com uma chave só dele e sobe o
-- cifrado aqui (base64 → bytea); a chave vai dentro da mensagem, que é cifrada com a chave da conversa. O arquivo sobe
-- antes da mensagem (mensagem nula) e é preso a ela em chat_enviar; o que ficar solto por uma hora some na faxina.
-- Somem junto com a mensagem (apagar, autodestruição, trinta dias). "Ver uma vez": cada pessoa lê uma única vez, quem
-- enviou não relê, e os bytes somem quando todos leram (ou em catorze dias).
create table if not exists interno.conversa_anexos (
  id uuid primary key default gen_random_uuid(),
  conversa uuid not null references interno.conversas (id) on delete cascade,
  mensagem uuid references interno.conversa_mensagens (id) on delete cascade,
  autor uuid not null references interno.perfis (id) on delete cascade,
  cifrado bytea,
  tamanho integer not null,
  uma_vez boolean not null default false,
  visto_por uuid[] not null default '{}',
  criado_em timestamptz not null default now()
);
create index if not exists conversa_anexos_mensagem on interno.conversa_anexos (mensagem);
create index if not exists conversa_anexos_soltos on interno.conversa_anexos (criado_em) where mensagem is null;
-- Caixa de entrada do marketing: qualquer pessoa da equipe sugere uma divulgação (um aulão, uma campanha); o marketing vê e decide.
create table if not exists interno.marketing_caixa (
  id uuid primary key default gen_random_uuid(),
  autor uuid references interno.perfis (id) on delete set null,
  texto text not null check (char_length(texto) between 5 and 2000),
  quando text not null default '' check (char_length(quando) <= 120),
  status text not null default 'nova' check (status in ('nova', 'em_andamento', 'feita', 'descartada')),
  por uuid references interno.perfis (id) on delete set null,
  decidido_em timestamptz,
  criado_em timestamptz not null default now()
);
-- Organização: o que cada pessoa faz com cada conversa (fixar no alto, arquivar, silenciar, marcar como não lida,
-- trancar com a digital). É de cada pessoa, vale em todos os aparelhos dela, e os outros não veem.
create table if not exists interno.conversa_prefs (
  usuario uuid not null references interno.perfis (id) on delete cascade,
  conversa uuid not null references interno.conversas (id) on delete cascade,
  fixada boolean not null default false,
  arquivada boolean not null default false,
  silenciada_ate timestamptz,
  nao_lida boolean not null default false,
  trancada boolean not null default false,
  primary key (usuario, conversa)
);
-- Grupos: descrição, foto (uma mensagem com a imagem, cifrada como qualquer outra), administradores e permissões.
alter table interno.conversas add column if not exists descricao text not null default '' check (char_length(descricao) <= 500);
alter table interno.conversas add column if not exists foto uuid references interno.conversa_mensagens (id) on delete set null;
alter table interno.conversas add column if not exists so_admins_enviam boolean not null default false;
alter table interno.conversas add column if not exists so_admins_mudam boolean not null default true;
alter table interno.conversa_membros add column if not exists admin boolean not null default false;
update interno.conversa_membros m set admin = true from interno.conversas c where c.id = m.conversa and c.tipo = 'grupo' and c.criada_por = m.usuario and not m.admin;
-- Avisos do sistema ("Fulana entrou", "Beltrano mudou o nome do grupo"): linhas que o próprio banco escreve, sem cifra
-- (são metadados que o banco já conhece). Enquete e evento vão dentro do cifrado; o voto e a resposta ao evento
-- são linhas apontando para a mensagem ("alvo"), uma por pessoa, como a reação.
alter table interno.conversa_mensagens drop constraint if exists conversa_mensagens_tipo_check;
alter table interno.conversa_mensagens add constraint conversa_mensagens_tipo_check check (tipo in ('texto', 'reacao', 'edicao', 'sistema', 'voto', 'rsvp'));
alter table interno.conversa_mensagens add column if not exists detalhe jsonb;
-- Relato à coordenação: a pessoa escolhe mensagens, o aparelho dela abre e manda o texto aberto. Só assim a coordenação
-- lê alguma coisa de uma conversa: por decisão de quem participa dela.
create table if not exists interno.conversa_relatos (
  id uuid primary key default gen_random_uuid(),
  conversa uuid references interno.conversas (id) on delete set null,
  conversa_nome text not null default '',
  autor uuid references interno.perfis (id) on delete set null,
  contra uuid references interno.perfis (id) on delete set null,
  motivo text not null check (char_length(motivo) between 2 and 500),
  mensagens jsonb not null default '[]'::jsonb,
  status text not null default 'aberto' check (status in ('aberto', 'resolvido')),
  nota text not null default '',
  resolvido_por uuid references interno.perfis (id) on delete set null,
  criado_em timestamptz not null default now()
);

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

-- Fila de saída dos e-mails automáticos (confirmação de candidatura, convite, boletim). Quem envia é a rotina
-- "Enviar e-mails" (scripts/enviar-emails.mjs), com a chave de serviço; ninguém de fora lê ou escreve aqui.
-- Depois de enviado, o texto é apagado (ele pode levar um link de convite) e fica só o registro de que saiu.
create table if not exists interno.emails (
  id uuid primary key default gen_random_uuid(),
  para text not null check (para ~ '^[^@[:space:]]+@[^@[:space:]]+[.][^@[:space:]]+$' and char_length(para) <= 200),
  tipo text not null check (tipo ~ '^[a-z_]{3,40}$'),
  assunto text not null check (char_length(assunto) between 1 and 200),
  texto text not null default '' check (char_length(texto) <= 20000),
  sair text not null default '' check (sair = '' or sair ~ '^https://[^[:space:]]+$'),
  status text not null default 'pendente' check (status in ('pendente', 'enviando', 'enviado', 'falhou')),
  tentativas smallint not null default 0,
  erro text not null default '',
  criado_em timestamptz not null default now(),
  tentado_em timestamptz,
  enviado_em timestamptz
);
create index if not exists emails_fila on interno.emails (status, criado_em);
create index if not exists emails_para on interno.emails (para, tipo, criado_em);

-- Calendário editorial do marketing e divulgação: o que vai para as redes do instituto, em que formato e quando, e o
-- material aprovado de cada post. Não guarda senha nem credencial de rede social nenhuma: o acesso ao Instagram é dado
-- pela coordenação na própria Central de Contas da Meta, como colaborador.
create table if not exists interno.divulgacao (
  id uuid primary key default gen_random_uuid(),
  rede text not null default 'instagram' check (rede in ('instagram', 'outra')),
  formato text not null default 'post' check (formato in ('post', 'carrossel', 'story', 'reels', 'video', 'outro')),
  titulo text not null check (char_length(titulo) between 3 and 120),
  legenda text not null default '' check (char_length(legenda) <= 2200),
  data_prevista date,
  -- Um endereço https (pasta de trabalho, rascunho) ou um arquivo já publicado no site, aprovado pela coordenação.
  material text not null default '' check (material = '' or ((material ~ '^https://[^[:space:]]+$' or material ~ '^/arquivos/[a-f0-9]{20}[.](webp|jpg|pdf)$') and char_length(material) <= 500)),
  situacao text not null default 'ideia' check (situacao in ('ideia', 'rascunho', 'pronto', 'publicado')),
  -- Comentário da coordenação; "devolvido" marca o que ela mandou de volta para rascunho e ainda não foi mexido.
  nota text not null default '' check (char_length(nota) <= 1000),
  devolvido boolean not null default false,
  criado_por uuid references interno.perfis (id) on delete set null,
  criado_em timestamptz not null default now(),
  mexido_por uuid references interno.perfis (id) on delete set null,
  mexido_em timestamptz not null default now()
);
create index if not exists divulgacao_data on interno.divulgacao (data_prevista);
-- Quem cuida de cada peça e quem aprovou ("pronto para sair" só com aprovação de quem pode).
alter table interno.divulgacao add column if not exists responsavel uuid references interno.perfis (id) on delete set null;
alter table interno.divulgacao add column if not exists aprovado_por uuid references interno.perfis (id) on delete set null;
alter table interno.divulgacao add column if not exists aprovado_em timestamptz;

-- Os votos ganham data, para o expurgo saber o que entrou num período. Os antigos ficam com a data da instalação.
alter table interno.votos add column if not exists criado_em timestamptz not null default now();

-- Pedidos da supervisão (interditar, liberar, expurgar): só valem depois da aprovação da coordenação ou da vice,
-- com os dados que estão no pedido. Pedido parado vence em 72 horas.
create table if not exists interno.pedidos (
  id uuid primary key default gen_random_uuid(),
  tipo text not null check (tipo in ('interdicao', 'liberacao', 'expurgo')),
  dados jsonb not null default '{}'::jsonb,
  justificativa text not null check (char_length(justificativa) between 30 and 1000),
  autor uuid references interno.perfis (id) on delete set null,
  situacao text not null default 'pendente' check (situacao in ('pendente', 'aprovado', 'recusado', 'vencido')),
  nota text not null default '' check (char_length(nota) <= 500),
  decidido_por uuid references interno.perfis (id) on delete set null,
  decidido_em timestamptz,
  resultado jsonb,
  criado_em timestamptz not null default now()
);
create index if not exists pedidos_situacao on interno.pedidos (situacao, criado_em);

-- Gaveta Aberta: trabalhos de estudantes (TCC, artigo, projeto, apostila…) que a própria pessoa publica para livre uso de
-- todos, sob uma licença livre que ela escolhe, depois de aceitar o termo de cessão. Nada aparece antes da mediação.
-- O arquivo, quando há, é um PDF num depósito fechado ("gaveta"); só sai para o público depois da aprovação.
create table if not exists interno.gaveta (
  id uuid primary key default gen_random_uuid(),
  autor uuid not null references interno.perfis (id) on delete cascade,
  titulo text not null check (char_length(titulo) between 5 and 160),
  tipo text not null check (tipo in ('tcc', 'monografia', 'dissertacao', 'artigo', 'projeto', 'relatorio', 'apostila', 'codigo', 'apresentacao', 'outro')),
  disciplina text not null check (disciplina ~ '^[a-z0-9-]{2,40}$'),
  curso text not null default '' check (char_length(curso) <= 120),
  instituicao text not null default '' check (char_length(instituicao) <= 160),
  ano smallint check (ano is null or ano between 1950 and 2100),
  comentario text not null check (char_length(comentario) between 40 and 2000),
  -- Um dos dois: o endereço do trabalho em outro lugar (repositório da universidade, Zenodo, GitHub…) ou o PDF enviado.
  link text not null default '' check (link = '' or (link ~ '^https://[^[:space:]]+$' and char_length(link) <= 500)),
  arquivo text not null default '' check (arquivo = '' or arquivo ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}[.]pdf$'),
  licenca text not null default 'CC BY 4.0' check (licenca in ('CC BY 4.0', 'CC BY-SA 4.0', 'CC0 1.0')),
  credito text not null check (char_length(credito) between 2 and 120),
  -- O aceite do termo de cessão: nome completo de quem aceitou, a versão do termo e quando. Só a equipe que decide vê.
  termo_nome text not null check (char_length(termo_nome) between 5 and 160),
  termo_versao text not null,
  termo_em timestamptz not null default now(),
  status text not null default 'pendente' check (status in ('pendente', 'aprovado', 'recusado', 'retirado')),
  nota text not null default '' check (char_length(nota) <= 1000),
  decidido_por uuid references interno.perfis (id) on delete set null,
  decidido_em timestamptz,
  criado_em timestamptz not null default now(),
  check ((link = '') <> (arquivo = ''))
);
-- Entrega de exercício de prática (Edição de vídeo e outras): o exercício e o comentário do educador da disciplina.
alter table interno.gaveta add column if not exists exercicio uuid;
alter table interno.gaveta add column if not exists retorno text not null default '' check (char_length(retorno) <= 2000);
alter table interno.gaveta add column if not exists retorno_por uuid references interno.perfis (id) on delete set null;
alter table interno.gaveta add column if not exists retorno_em timestamptz;
create index if not exists gaveta_status on interno.gaveta (status, decidido_em desc);
create index if not exists gaveta_autor on interno.gaveta (autor);

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

-- Sempre verdadeiro ou falso, nunca nulo: um token sem "role" daria nulo, e "if not nulo" não barraria ninguém.
create or replace function interno.servico() returns boolean language sql stable as $$
  select coalesce(interno.claims() ->> 'role' = 'service_role', false)
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
 * A pessoa tem este papel? Com a exigência de segundo fator ligada, coordenação, vice-coordenação, supervisão, curadoria e mediação
 * só valem em sessão confirmada pelo aplicativo autenticador: senha ou link roubado, sozinhos, não abrem nada.
 * E quem cadastrou o aplicativo por conta própria, em qualquer função, só usa a função depois de digitar o código.
 * Uma pessoa pode ter quantos papéis quiser: basta uma linha bater. As permissões são a soma dos papéis.
 */
create or replace function interno.tem(p_papel text, p_disciplina text default null) returns boolean
language sql stable security definer set search_path = interno, pg_temp as $$
  select auth.uid() is not null
    and (p_papel not in ('coordenacao', 'vice', 'supervisao', 'curadoria', 'mediacao') or not interno.exige_2fa() or interno.aal2())
    and (interno.aal2() or not interno.tem_fator())
    and exists (
      select 1 from papeis p join perfis f on f.id = p.usuario
      where p.usuario = auth.uid() and not f.suspenso
        -- A educação secundária tem os mesmos poderes da educação; o marketing, os do design (materiais, imagens, artes).
        and (p.papel = p_papel or (p_papel = 'educacao' and p.papel = 'educacao_secundaria') or (p_papel = 'design' and p.papel = 'marketing'))
        and (p_disciplina is null or p.disciplina is null or p.disciplina = p_disciplina)
    )
$$;

/** Coordenação comunitária: uma pessoa, com a palavra final. */
create or replace function interno.lider() returns boolean language sql stable as $$ select interno.tem('coordenacao') $$;
/** Coordenação ou vice-coordenação: tudo o que a coordenação faz, menos mexer na própria coordenação. */
create or replace function interno.coord() returns boolean language sql stable as $$ select interno.tem('coordenacao') or interno.tem('vice') $$;
/** Curadoria: quem aprova e recusa. Coordenação e vice-coordenação também podem. */
create or replace function interno.curador() returns boolean language sql stable as $$ select interno.coord() or interno.tem('curadoria') $$;
/** Esta pessoa faz parte da equipe (tem alguma função)? Sem olhar a sessão: serve para listar destinatários. */
create or replace function interno.voluntario_e(p_usuario uuid) returns boolean language sql stable security definer set search_path = interno, pg_temp as $$
  select exists (select 1 from papeis p join perfis f on f.id = p.usuario where p.usuario = p_usuario and not f.suspenso)
$$;
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
/**
 * Supervisão: logo abaixo da coordenação e da vice-coordenação, faz o painel andar e impede o caos quando as duas estão
 * ausentes, sem plenos poderes (vê a equipe sem e-mail, suspende em emergência, modera o mural da equipe, lê o registro
 * e aciona as proteções reversíveis). Coordenação e vice-coordenação também podem tudo o que ela pode.
 */
create or replace function interno.supervisor() returns boolean language sql stable as $$ select interno.coord() or interno.tem('supervisao') $$;
/** Marketing e divulgação: o calendário das redes e o kit da marca. Coordenação e vice-coordenação também. */
create or replace function interno.divulga() returns boolean language sql stable as $$ select interno.coord() or interno.tem('marketing') $$;
/** Quem aprova uma peça para sair (marca "pronto para sair"): coordenação, coordenação pedagógica e supervisão. */
create or replace function interno.aprova_divulgacao() returns boolean language sql stable as $$ select interno.coord() or interno.tem('supervisao') $$;
/**
 * Quem pode atender um pedido de reforço desta disciplina: mentoria e educação da disciplina, e a coordenação
 * (que destrava pedido parado). A curadoria cuida de conteúdo, não de reforço: não vê o e-mail de estudante nenhum.
 */
create or replace function interno.mentor(p_disciplina text) returns boolean language sql stable as $$
  select interno.coord() or interno.tem('mentoria', p_disciplina) or interno.tem('educacao', p_disciplina)
$$;
/** Quem pode enviar imagens e arquivos pelo painel: só gente da equipe que escreve, diagrama ou divulga. */
create or replace function interno.envia() returns boolean language sql stable as $$
  select interno.curador() or interno.tem('educacao') or interno.tem('jornalismo') or interno.tem('design') or interno.tem('marketing')
$$;

-- ───────────────────────────── Cargos: hierarquia ─────────────────────────────
--
-- Cada pessoa pode ter vários papéis (jornalista e tradutora, educadora e curadora…). As permissões são a soma deles.
-- Para dar e tirar papéis vale uma hierarquia: coordenação (4), vice-coordenação (3), supervisão (2), papéis de
-- trabalho (1). O nível de uma pessoa é o maior entre os papéis dela. Ninguém confia papel de nível igual ou maior que o
-- próprio, ninguém mexe nos cargos de quem está no mesmo nível ou acima, e ninguém mexe nos próprios. A coordenação, por
-- estar no topo, mexe em todos (menos nos próprios, e nunca tira a última coordenação).

/** O nível de cada papel na hierarquia. */
create or replace function interno.nivel(p_papel text) returns integer language sql immutable as $$
  select case p_papel when 'coordenacao' then 4 when 'vice' then 3 when 'supervisao' then 2 else 1 end
$$;

/** O nível de uma pessoa: o maior entre os papéis dela; 0 para quem não tem nenhum. Serve para comparar, não para autorizar. */
create or replace function interno.nivel_de(p_usuario uuid) returns integer language sql stable security definer set search_path = interno, pg_temp as $$
  select coalesce((select max(interno.nivel(p.papel)) from papeis p where p.usuario = p_usuario), 0)
$$;

/** Quem gere cargos: coordenação, vice-coordenação e supervisão (todas em sessão com o segundo fator, como as funções sensíveis). */
create or replace function interno.gere_cargos() returns boolean language sql stable as $$
  select interno.coord() or interno.tem('supervisao')
$$;

/**
 * Posso confiar este papel? Só papel de nível menor que o meu. Por cima disso valem as regras antigas: vice-coordenação e
 * supervisão só a coordenação nomeia; curadoria e mediação (que exigem segundo fator) ficam com coordenação e vice.
 */
create or replace function interno.pode_conceder(p_papel text) returns boolean language sql stable security definer set search_path = interno, pg_temp as $$
  select interno.gere_cargos()
    and interno.nivel(p_papel) < interno.nivel_de(auth.uid())
    and (p_papel <> 'vice' or interno.lider())
    and (p_papel not in ('curadoria', 'mediacao') or interno.coord())
$$;

/** Posso mexer nos cargos desta pessoa? Nunca nos meus. A coordenação mexe em todos; os outros, só em quem está abaixo. */
create or replace function interno.pode_mexer(p_usuario uuid) returns boolean language sql stable security definer set search_path = interno, pg_temp as $$
  select interno.gere_cargos() and p_usuario is not null and p_usuario is distinct from auth.uid()
    and (interno.lider() or interno.nivel_de(p_usuario) < interno.nivel_de(auth.uid()))
$$;

/**
 * As áreas públicas que podem ser interditadas, uma por pedaço do site. A mesma lista, com os caminhos de cada uma,
 * mora em lib/interdicao.ts; `npm run testar:interdicao` falha se as duas divergirem. Área nova: acrescente nos dois.
 */
create or replace function interno.areas_publicas() returns text[] language sql immutable as $$
  select array['comunidade', 'mural', 'reforco', 'contribuir', 'jornal', 'radio', 'acervo', 'estudo', 'ferramentas', 'memoria', 'debate', 'materiais', 'dados', 'videos', 'voluntariado', 'busca', 'gaveta']
$$;

/** O que o expurgo limpa: só o que o público escreve. O mural de apoiadores fica de fora: só a coordenação escreve ali. */
create or replace function interno.areas_expurgo() returns text[] language sql immutable as $$
  select array['comunidade', 'mural', 'anotacoes', 'reforco', 'contribuicoes', 'gaveta']
$$;

create or replace function interno.interdicao() returns jsonb language sql stable security definer set search_path = interno, pg_temp as $$
  select coalesce((select valor from configuracoes where chave = 'interdicao'), '{}'::jsonb)
$$;

/** A área está fechada para o público, sozinha ou porque o site inteiro está fora do ar? */
create or replace function interno.interditada(p_area text) returns boolean language sql stable security definer set search_path = interno, pg_temp as $$
  select coalesce((interno.interdicao() ->> 'geral')::boolean, false) or coalesce(interno.interdicao() -> 'areas' ? p_area, false)
$$;

/** Quem cuida de cada área continua lendo e limpando com ela interditada; é para isso que a interdição serve. */
create or replace function interno.cuida_area(p_area text) returns boolean language sql stable as $$
  select case p_area
    when 'comunidade' then interno.cuida()
    when 'estudo' then interno.cuida()
    when 'mural' then interno.media_mural()
    when 'reforco' then interno.coord() or interno.tem('mentoria') or interno.tem('educacao')
    when 'contribuir' then interno.voluntario()
    when 'radio' then interno.radialista()
    when 'materiais' then interno.curador() or interno.tem('design') or interno.tem('marketing')
    when 'gaveta' then interno.media()
    else interno.coord() end
$$;

/** A porta de cada função pública: área interditada recusa o público com "area_interditada". */
create or replace function interno.aberta(p_area text) returns void language plpgsql stable security definer set search_path = interno, pg_temp as $$
begin
  if interno.interditada(p_area) and not interno.cuida_area(p_area) then perform interno.erro('area_interditada'); end if;
end $$;

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

-- ───────────────────────────── E-mails automáticos ─────────────────────────────

/** O endereço público do site, para os links dos e-mails. Muda em configuracoes ('email' → 'site'). */
create or replace function interno.endereco() returns text language sql stable security definer set search_path = interno, pg_temp as $$
  select coalesce(nullif((select valor ->> 'site' from configuracoes where chave = 'email'), ''), 'https://institutolucia.org')
$$;

/** O nome que cada pessoa vê das outras no painel: completo só para a coordenação; primeiro nome para o resto. */
create or replace function interno.nome_visto(p_nome text) returns text language sql stable security definer set search_path = interno, pg_temp as $$
  select case when interno.lider() or p_nome is null then p_nome else split_part(btrim(p_nome), ' ', 1) end
$$;
create or replace function interno.primeiro_nome(p_nome text) returns text language sql immutable as $$ select split_part(btrim(coalesce(p_nome, '')), ' ', 1) $$;

create or replace function interno.nome_papel(p text) returns text language sql immutable as $$
  select case p when 'coordenacao' then 'coordenação' when 'vice' then 'coordenação pedagógica' when 'supervisao' then 'supervisão' when 'curadoria' then 'curadoria'
    when 'mediacao' then 'mediação' when 'educacao' then 'educação' when 'educacao_secundaria' then 'educação secundária' when 'revisao' then 'revisão'
    when 'traducao' then 'tradução' when 'jornalismo' then 'jornalismo, rádio e podcast' when 'mentoria' then 'aula de reforço' when 'design' then 'design'
    when 'marketing' then 'marketing e divulgação' when 'desenvolvimento' then 'desenvolvimento' when 'representante' then 'representante do departamento' when 'porta_voz' then 'porta-voz' when 'saude' then 'profissional de saúde'
    else coalesce(p, '') end
$$;

/**
 * Põe um e-mail na fila de saída. Endereço inválido não entra, e o mesmo endereço recebe no máximo p_max e-mails do
 * mesmo tipo por dia: ninguém usa os formulários do site para encher a caixa de outra pessoa. Devolve se entrou.
 */
alter table interno.perfis add column if not exists emails_desligados text[] not null default '{}';

create or replace function interno.email(p_para text, p_tipo text, p_assunto text, p_texto text, p_sair text default '', p_max integer default 3)
returns boolean language plpgsql security definer set search_path = interno, pg_temp as $$
declare v_para text := lower(btrim(coalesce(p_para, '')));
begin
  if v_para !~ '^[^@[:space:]]+@[^@[:space:]]+[.][^@[:space:]]+$' or char_length(v_para) > 200 then return false; end if;
  -- Quem é da equipe escolhe, em Minha conta, os avisos por e-mail que não quer receber (convites e segurança sempre chegam).
  if exists (select 1 from auth.users u join perfis f on f.id = u.id where lower(u.email) = v_para and p_tipo = any(f.emails_desligados)) then return false; end if;
  if (select count(*) from emails where para = v_para and tipo = p_tipo and criado_em > now() - interval '1 day') >= coalesce(p_max, 3) then return false; end if;
  insert into emails (para, tipo, assunto, texto, sair)
  values (v_para, p_tipo, left(p_assunto, 200), left(coalesce(p_texto, ''), 19000) || E'\n\n— Instituto Lúcia\n' || interno.endereco(), coalesce(p_sair, ''));
  return true;
end $$;

/** O envio de e-mails já funcionou de verdade? Fica ligado no primeiro e-mail que a rotina de envio confirma. */
create or replace function interno.email_ativo() returns boolean language sql stable security definer set search_path = interno, pg_temp as $$
  select coalesce((select (valor ->> 'ativo')::boolean from configuracoes where chave = 'email'), false)
$$;

/** O endereço de e-mail de uma conta. */
create or replace function interno.email_da_conta(p_usuario uuid) returns text language sql stable security definer set search_path = interno, pg_temp as $$
  select email from auth.users where id = p_usuario
$$;

/** Um e-mail para cada pessoa da coordenação e da vice-coordenação, no endereço da própria conta. */
create or replace function interno.email_lideranca(p_tipo text, p_assunto text, p_texto text) returns void language plpgsql security definer set search_path = interno, pg_temp as $$
declare r record;
begin
  for r in select distinct u.email from papeis p join auth.users u on u.id = p.usuario join perfis f on f.id = p.usuario
           where p.papel in ('coordenacao', 'vice') and not f.suspenso and coalesce(u.email, '') <> '' loop
    perform interno.email(r.email, p_tipo, p_assunto, p_texto, '', 30);
  end loop;
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
  -- A troca é do sistema, não de quem por acaso abriu o painel: o histórico de cargos anota "sistema".
  perform set_config('lucia.sistema', '1', true);
  for r in select id, usuario from papeis where papel = 'coordenacao' loop
    delete from papeis where id = r.id;
    insert into papeis (usuario, papel) values (r.usuario, 'vice') on conflict do nothing;
  end loop;
  delete from papeis where usuario = v_novo and papel = 'vice';
  insert into papeis (usuario, papel) values (v_novo, 'coordenacao') on conflict do nothing;
  perform set_config('lucia.sistema', '', true);
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
      'nivel', interno.nivel_de(f.id),
      'chat_visto', f.chat_visto, 'chat_leitura', f.chat_leitura,
      'avatar', f.avatar, 'curriculo', coalesce(f.curriculo, '{}'::jsonb), 'termo_voluntario', f.termo_voluntario_em is not null and f.termo_voluntario_versao = interno.termo_voluntario_vigente(), 'aprendizado', f.aprendizado_em is not null,
      'segundo_fator', interno.aal2(),
      'exige_segundo_fator', interno.tem_fator() or (interno.exige_2fa() and exists (select 1 from papeis p where p.usuario = f.id and p.papel in ('coordenacao', 'vice', 'supervisao', 'curadoria', 'mediacao'))),
      'trocar_senha', f.trocar_senha,
      'avisos', (select count(*) from avisos a where a.para = f.id and not a.lido),
      -- Pode mandar avisos à equipe (coordenação, vice-coordenação, supervisão) e usar o estúdio de design.
      'supervisao', interno.supervisiona(),
      'desenha', interno.desenha(),
      -- Disciplinas em que a pessoa foi convidada a ajudar (lib/backend.ts › escreveEm).
      'convites', coalesce((select jsonb_agg(jsonb_build_object('disciplina', c.disciplina, 'trilha', c.trilha)) from disciplina_convites c where c.convidado = f.id and c.revogado_em is null), '[]'::jsonb),
      'foto_pendente', f.foto_pendente <> '')
    from perfis f where f.id = v);
end $$;

create or replace function public.perfil_salvar(p_nome text, p_bio text) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu();
begin
  perform interno.limite('perfil', 20, 60);
  update perfis set nome = interno.txt(p_nome, 'nome', 2, 60), bio = interno.txt(p_bio, 'bio', 0, 500) where id = v;
  return public.eu();
end $$;

/** As escolhas de privacidade das conversas: mostrar o "visto por último" e confirmar leitura. Quem esconde também não vê o dos outros. */
/** O retrato: ícone pré-definido para todo mundo; imagem própria só para quem gere a equipe. */
/**
 * O currículo público do educador, para o cartão nas aulas e a página "Quem somos": só endereços https (portfólio,
 * Lattes, site, redes) e uma linha de formação. Tudo opcional; o que ficar vazio não aparece.
 */
create or replace function public.perfil_curriculo(p jsonb) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); k text; u text; v_novo jsonb := '{}'::jsonb;
begin
  perform interno.limite('perfil', 20, 60);
  if jsonb_typeof(coalesce(p, '{}'::jsonb)) <> 'object' then perform interno.erro('invalido:curriculo'); end if;
  foreach k in array array['portfolio', 'lattes', 'site', 'instagram', 'youtube', 'linkedin', 'github'] loop
    u := btrim(coalesce(p ->> k, ''));
    if u <> '' then
      if u !~ '^https://[^\s]{3,300}$' then perform interno.erro('invalido:' || k); end if;
      v_novo := v_novo || jsonb_build_object(k, u);
    end if;
  end loop;
  u := btrim(coalesce(p ->> 'formacao', ''));
  if u <> '' then v_novo := v_novo || jsonb_build_object('formacao', left(u, 160)); end if;
  update perfis set curriculo = v_novo where id = v;
  return public.eu();
end $$;

/** O dicionário do instituto: termos aceitos pela conferência de ortografia (nomes próprios, siglas, palavras das trilhas). Qualquer pessoa lê. */
create or replace function public.dicionario_termos() returns jsonb language sql stable security definer set search_path = interno, pg_temp as $$
  select coalesce((select valor from configuracoes where chave = 'dicionario'), '[]'::jsonb)
$$;

create or replace function public.dicionario_salvar(p_termos text[]) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); v_lista jsonb;
begin
  if not (interno.lider() or interno.tem('vice') or interno.tem('revisao')) then perform interno.erro('sem_permissao'); end if;
  select coalesce(jsonb_agg(distinct t order by t), '[]'::jsonb) into v_lista
  from (select btrim(x) as t from unnest(coalesce(p_termos, '{}')) x where btrim(x) ~ '^[^\s]{2,60}$' limit 5000) s;
  insert into configuracoes (chave, valor) values ('dicionario', v_lista) on conflict (chave) do update set valor = excluded.valor;
  perform interno.registrar('dicionario_salvo', '', jsonb_build_object('termos', jsonb_array_length(v_lista)));
  return v_lista;
end $$;

create or replace function public.perfil_avatar(p_avatar text) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); a text := coalesce(p_avatar, '');
begin
  if a <> '' and a !~ '^p:[a-z0-9-]{1,30}$' then
    -- Foto própria: qualquer pessoa da equipe (o painel recorta, reduz e tira os dados da câmera antes de enviar).
    if not (interno.voluntario() or interno.gere_cargos()) then perform interno.erro('sem_permissao'); end if;
    if a !~ '^data:image/webp;base64,[A-Za-z0-9+/=]+$' or char_length(a) > 40000 then perform interno.erro('invalido:avatar'); end if;
    -- A foto aparece nos cartões públicos de quem ensina: só depois de a coordenação aprovar. A coordenação aprova a própria.
    if not (interno.coord() or interno.tem('vice')) then
      perform interno.limite('foto_perfil', 10, 1440);
      update perfis set foto_pendente = a, foto_enviada_em = now() where id = v;
      perform interno.avisar_lideranca('Foto de perfil para aprovar: abra Voluntários e convites › Fotos.', v);
      return jsonb_build_object('ok', true, 'pendente', true);
    end if;
  end if;
  update perfis set avatar = a, foto_pendente = case when a ~ '^data:' then '' else foto_pendente end where id = v;
  return jsonb_build_object('ok', true);
end $$;

/** Confirma, uma vez, que a pessoa está aqui como voluntária (Lei nº 9.608/1998): sem salário e sem vínculo de emprego. */
create or replace function public.termo_voluntario_aceitar() returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu();
begin
  update perfis set termo_voluntario_em = coalesce(termo_voluntario_em, now()), termo_voluntario_versao = interno.termo_voluntario_vigente() where id = v;
  perform interno.registrar('termo_voluntario', v::text, jsonb_build_object('versao', interno.termo_voluntario_vigente()));
  return jsonb_build_object('ok', true);
end $$;

/** Aceita o aprendizado interno: aprender com os educadores pelo painel. Só conta como hora para quem também tem o termo de adesão. */
create or replace function public.aprendizado_aceitar(p_aceito boolean default true) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu();
begin
  if not interno.voluntario() then perform interno.erro('sem_permissao'); end if;
  update perfis set aprendizado_em = case when coalesce(p_aceito, true) then coalesce(aprendizado_em, now()) else null end where id = v;
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.perfil_preferencias(p_chat_visto boolean, p_chat_leitura boolean) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu();
begin
  update perfis set chat_visto = coalesce(p_chat_visto, chat_visto), chat_leitura = coalesce(p_chat_leitura, chat_leitura) where id = v;
  return public.eu();
end $$;

/** Apaga a conta e tudo o que é pessoal. O que já foi publicado continua, sem ligação com a pessoa. */
-- Apagar a conta pede a senha atual: uma sessão roubada (aparelho emprestado, aba esquecida) não basta para apagar.
drop function if exists public.conta_apagar();
create or replace function public.conta_apagar(p_senha text default null) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := auth.uid(); v_esquema text; v_hash text; v_confere boolean := false;
begin
  if v is null then perform interno.erro('entre_primeiro'); end if;
  perform interno.limite('conta_apagar', 5, 15);
  -- Senha roubada, sozinha, não apaga a conta de quem cadastrou o aplicativo autenticador.
  if interno.tem_fator() and not interno.aal2() then perform interno.erro('confirme_segundo_fator'); end if;
  -- Olha o papel direto na tabela: interno.coord() responde "não" em sessão sem o segundo fator, e a trava deixaria de valer.
  if exists (select 1 from papeis where usuario = v and papel = 'coordenacao') and (select count(*) from papeis where papel = 'coordenacao') <= 1 then
    perform interno.erro('ultima_coordenacao');
  end if;
  select encrypted_password into v_hash from auth.users where id = v;
  select n.nspname into v_esquema from pg_extension e join pg_namespace n on n.oid = e.extnamespace where e.extname = 'pgcrypto';
  if v_esquema is not null and coalesce(v_hash, '') <> '' and char_length(coalesce(p_senha, '')) between 1 and 200 then
    execute format('select %I.crypt($1, $2) = $2', v_esquema) into v_confere using p_senha, v_hash;
  end if;
  if not coalesce(v_confere, false) then perform interno.erro('senha_errada'); end if;
  delete from perfis where id = v;
  delete from auth.users where id = v;
  return jsonb_build_object('ok', true);
end $$;

-- ───────────────────────────── Voluntariado ─────────────────────────────

/**
 * Pedir uma função pelo painel. Supervisão é cargo de confiança e não se pede: a coordenação nomeia.
 */
create or replace function public.candidatar(p_papel text, p_disciplina text, p_mensagem text) returns jsonb
language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); v_id uuid; v_papel text := p_papel;
begin
  perform interno.limite('candidatar', 5, 1440);
  if coalesce(v_papel, '') not in ('curadoria', 'mediacao', 'educacao', 'educacao_secundaria', 'revisao', 'traducao', 'jornalismo', 'mentoria', 'design', 'marketing', 'desenvolvimento', 'porta_voz', 'saude') then perform interno.erro('invalido:papel'); end if;
  -- Educação, educação secundária e reforço são por disciplina: a pessoa só enxerga a fila da disciplina que receber.
  if v_papel in ('educacao', 'educacao_secundaria', 'mentoria') and coalesce(p_disciplina, '') = '' then perform interno.erro('invalido:disciplina'); end if;
  if exists (select 1 from candidaturas where usuario = v and papel = v_papel and coalesce(disciplina, '') = coalesce(p_disciplina, '') and status = 'pendente') then
    perform interno.erro('ja_pediu');
  end if;
  insert into candidaturas (usuario, papel, disciplina, mensagem)
  values (v, v_papel, interno.disciplina_ok(p_disciplina), interno.txt(p_mensagem, 'mensagem', 20, 2000))
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
  -- Aceitar é confiar o papel: valem as mesmas regras de nível de papel_conceder.
  if p_aceitar and not (interno.pode_conceder(c.papel) and interno.pode_mexer(c.usuario)) then perform interno.erro('sem_permissao'); end if;
  update candidaturas set status = case when p_aceitar then 'aceita' else 'recusada' end, decidido_por = v, decidido_em = now() where id = p_id;
  if p_aceitar then
    insert into papeis (usuario, papel, disciplina, concedido_por) values (c.usuario, c.papel, c.disciplina, v) on conflict do nothing;
    perform interno.avisar(c.usuario, 'Seu pedido de voluntariado foi aceito. As ferramentas do seu papel já aparecem no painel.');
    perform interno.email(interno.email_da_conta(c.usuario), 'candidatura_aceita', 'Seu pedido de voluntariado foi aceito',
      E'Olá.\n\nSeu pedido para a função de ' || interno.nome_papel(c.papel) || E' no Instituto Lúcia foi aceito. Boas-vindas à equipe!\n\n'
      || 'As ferramentas da função já aparecem no painel: ' || interno.endereco() || '/pt/painel');
  else
    perform interno.avisar(c.usuario, 'Seu pedido de voluntariado não foi aceito desta vez. Você pode continuar contribuindo e pedir de novo mais adiante.');
    perform interno.email(interno.email_da_conta(c.usuario), 'candidatura_recusada', 'Seu pedido de voluntariado no Instituto Lúcia',
      E'Olá.\n\nObrigado pelo interesse. Desta vez o seu pedido para a função de ' || interno.nome_papel(c.papel)
      || E' não foi aceito.\n\nVocê pode continuar contribuindo pelo site e pedir de novo mais adiante.');
  end if;
  perform interno.registrar(case when p_aceitar then 'pedido_aceito' else 'pedido_recusado' end, c.usuario::text, jsonb_build_object('papel', c.papel, 'disciplina', c.disciplina));
  return jsonb_build_object('ok', true);
end $$;

/** A equipe inteira, com todos os papéis de cada pessoa e o nível dela. O e-mail só vai para coordenação e vice; a supervisão vê sem e-mail. */
create or replace function public.voluntarios_listar() returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
begin
  if not interno.gere_cargos() then perform interno.erro('sem_permissao'); end if;
  return (
    select coalesce(jsonb_agg(jsonb_build_object(
      'id', f.id, 'nome', interno.nome_visto(f.nome), 'bio', f.bio, 'email', case when interno.lider() then u.email else '' end, 'suspenso', f.suspenso, 'suspensao', f.suspensao, 'trocar_senha', f.trocar_senha,
      'criado_em', f.criado_em, 'visto_em', f.visto_em, 'nivel', interno.nivel_de(f.id),
      'papeis', coalesce((select jsonb_agg(jsonb_build_object('id', p.id, 'papel', p.papel, 'disciplina', p.disciplina) order by interno.nivel(p.papel) desc, p.papel, p.disciplina) from papeis p where p.usuario = f.id), '[]'::jsonb))
      order by f.nome), '[]'::jsonb)
    from perfis f join auth.users u on u.id = f.id);
end $$;

/**
 * A equipe vista pela supervisão: nome, funções, quando passou pelo painel e se está suspensa. Nenhum e-mail.
 * "protegida" marca quem a supervisão não suspende (coordenação, vice-coordenação e a própria supervisão).
 */
create or replace function public.equipe_supervisao() returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu();
begin
  if not interno.supervisor() then perform interno.erro('sem_permissao'); end if;
  return (
    select coalesce(jsonb_agg(jsonb_build_object(
      'id', f.id, 'nome', f.nome, 'suspenso', f.suspenso, 'suspensao', f.suspensao, 'visto_em', f.visto_em, 'eu', f.id = v,
      'protegida', exists (select 1 from papeis p where p.usuario = f.id and p.papel in ('coordenacao', 'vice', 'supervisao')),
      'papeis', coalesce((select jsonb_agg(jsonb_build_object('id', p.id, 'papel', p.papel, 'disciplina', p.disciplina) order by p.papel, p.disciplina) from papeis p where p.usuario = f.id), '[]'::jsonb))
      order by f.nome), '[]'::jsonb)
    from perfis f where exists (select 1 from papeis p where p.usuario = f.id));
end $$;

/** Os pedidos de voluntariado que esperam a coordenação, para a supervisão acompanhar. Só leitura, e sem o e-mail de ninguém. */
create or replace function public.pedidos_supervisao() returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
begin
  perform interno.eu();
  if not interno.supervisor() then perform interno.erro('sem_permissao'); end if;
  return (
    select coalesce(jsonb_agg(x.j order by x.criado_em), '[]'::jsonb) from (
      select i.criado_em, jsonb_build_object('id', i.id, 'origem', 'formulario', 'nome', i.nome, 'papel', i.papel, 'disciplina', i.disciplina, 'mensagem', i.mensagem, 'criado_em', i.criado_em) as j
      from inscricoes i where i.status = 'pendente'
      union all
      select c.criado_em, jsonb_build_object('id', c.id, 'origem', 'painel', 'nome', coalesce(f.nome, ''), 'papel', c.papel, 'disciplina', c.disciplina, 'mensagem', c.mensagem, 'criado_em', c.criado_em)
      from candidaturas c left join perfis f on f.id = c.usuario where c.status = 'pendente') x);
end $$;

/**
 * Busca de pessoas por nome ou e-mail, para confiar uma função sem carregar a lista inteira de contas.
 * Quem gere cargos busca; a resposta só traz e-mails para coordenação e vice (a supervisão busca só por nome).
 * Devolve no máximo vinte, e nada com menos de duas letras.
 */
create or replace function public.pessoas_buscar(p_busca text) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v_busca text := lower(btrim(left(coalesce(p_busca, ''), 120))); v_nome text; v_email boolean := interno.lider();
begin
  perform interno.eu();
  if not interno.gere_cargos() then perform interno.erro('sem_permissao'); end if;
  if char_length(v_busca) < 2 then return '[]'::jsonb; end if;
  perform interno.limite('pessoas_buscar', 600, 60);
  v_nome := interno.normal(v_busca);
  return (
    select coalesce(jsonb_agg(jsonb_build_object('id', x.id, 'nome', interno.nome_visto(x.nome), 'email', case when v_email then x.email else '' end, 'suspenso', x.suspenso, 'nivel', interno.nivel_de(x.id)) order by x.nome), '[]'::jsonb)
    from (select f.id, f.nome, u.email, f.suspenso
          from perfis f join auth.users u on u.id = f.id
          where (v_email and position(v_busca in lower(coalesce(u.email, ''))) > 0) or (v_nome <> '' and position(v_nome in interno.normal(f.nome)) > 0)
          order by f.nome limit 20) x);
end $$;

/**
 * Confiar um papel. Coordenação, vice-coordenação e supervisão confiam papéis de nível menor que o próprio (interno.pode_conceder),
 * só a quem está abaixo de si na hierarquia (interno.pode_mexer); só a coordenação nomeia a vice-coordenação. Uma pessoa pode
 * acumular quantos papéis forem confiados. A coordenação em si não se concede por aqui: ela muda de mãos por lideranca_passar
 * ou pela ordem de sucessão.
 */
create or replace function public.papel_conceder(p_usuario uuid, p_papel text, p_disciplina text) returns jsonb
language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu();
begin
  if not interno.gere_cargos() then perform interno.erro('sem_permissao'); end if;
  if coalesce(p_papel, '') not in ('vice', 'supervisao', 'curadoria', 'mediacao', 'educacao', 'educacao_secundaria', 'revisao', 'traducao', 'jornalismo', 'mentoria', 'design', 'marketing', 'desenvolvimento', 'representante', 'porta_voz', 'saude') then perform interno.erro('invalido:papel'); end if;
  if p_papel = 'representante' and coalesce(p_disciplina, '') not in ('educacao', 'curadoria', 'mediacao', 'revisao', 'traducao', 'jornalismo', 'mentoria', 'design', 'desenvolvimento', 'saude')
     and coalesce(p_disciplina, '') !~ '^grupo-(percursos|linguagens|ciencias|tecnologia|humanidades|teoria|lutas|oficios|hobbies)$' then perform interno.erro('invalido:departamento'); end if;
  if not interno.pode_conceder(p_papel) then perform interno.erro('sem_permissao'); end if;
  -- Educação, educação secundária e reforço são por disciplina: sem ela, a pessoa enxergaria a fila de todas.
  if p_papel in ('educacao', 'educacao_secundaria', 'mentoria') and coalesce(p_disciplina, '') = '' then perform interno.erro('invalido:disciplina'); end if;
  if not exists (select 1 from perfis where id = p_usuario) then perform interno.erro('nao_encontrado'); end if;
  if not interno.pode_mexer(p_usuario) then perform interno.erro('sem_permissao'); end if;
  insert into papeis (usuario, papel, disciplina, concedido_por)
  values (p_usuario, p_papel, case when p_papel in ('vice', 'supervisao', 'marketing') then null else interno.disciplina_ok(p_disciplina) end, v) on conflict do nothing;
  perform interno.registrar('papel_confiado', p_usuario::text, jsonb_build_object('papel', p_papel, 'disciplina', p_disciplina));
  perform interno.avisar(p_usuario, 'Você recebeu um novo papel no instituto. Abra o painel para ver as ferramentas dele.');
  return jsonb_build_object('ok', true);
end $$;

/** Retirar um papel: as mesmas regras de nível. Quem tira fica anotado no histórico de cargos e no registro de atividades. */
create or replace function public.papel_remover(p_id uuid) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare r papeis;
begin
  perform interno.eu();
  if not interno.gere_cargos() then perform interno.erro('sem_permissao'); end if;
  select * into r from papeis where id = p_id;
  if not found then perform interno.erro('nao_encontrado'); end if;
  -- A vice-coordenação não mexe na coordenação nem em outra vice-coordenação.
  if r.papel in ('coordenacao', 'vice') and not interno.lider() then perform interno.erro('sem_permissao'); end if;
  -- A supervisão de quem também é vice-coordenação, só a coordenação retira (a mesma regra da própria vice-coordenação).
  if r.papel = 'supervisao' and not interno.lider() and exists (select 1 from papeis where usuario = r.usuario and papel = 'vice') then perform interno.erro('sem_permissao'); end if;
  if r.papel = 'coordenacao' and (select count(*) from papeis where papel = 'coordenacao') <= 1 then perform interno.erro('ultima_coordenacao'); end if;
  if not interno.pode_mexer(r.usuario) then perform interno.erro('sem_permissao'); end if;
  delete from papeis where id = p_id;
  perform interno.registrar('papel_retirado', r.usuario::text, jsonb_build_object('papel', r.papel, 'disciplina', r.disciplina));
  return jsonb_build_object('ok', true);
end $$;

drop function if exists public.usuario_suspender(uuid, boolean);
/**
 * Suspender ou reativar uma conta. Coordenação e vice-coordenação, como sempre (motivo opcional). A supervisão, só como
 * freio de emergência: motivo obrigatório, nunca em conta de coordenação, vice-coordenação ou supervisão, e a
 * coordenação é avisada na hora; ela reativa só o que ela mesma suspendeu (banimento da mediação é a coordenação que
 * desfaz). Ninguém suspende a própria conta, nem pelo painel nem chamando o banco direto.
 */
create or replace function public.usuario_suspender(p_usuario uuid, p_suspenso boolean, p_motivo text default '') returns jsonb
language plpgsql security definer set search_path = interno, pg_temp as $$
declare
  v uuid := interno.eu(); f perfis; v_coord boolean := interno.coord(); v_suspenso boolean := coalesce(p_suspenso, false);
  v_motivo text := interno.txt(p_motivo, 'motivo', 0, 300);
begin
  if not interno.supervisor() then perform interno.erro('sem_permissao'); end if;
  if p_usuario is null or p_usuario = v then perform interno.erro('invalido:usuario'); end if;
  select * into f from perfis where id = p_usuario for update;
  if not found then perform interno.erro('nao_encontrado'); end if;
  -- Ninguém suspende a coordenação pelo painel, e só ela suspende a vice-coordenação.
  if exists (select 1 from papeis where usuario = p_usuario and papel = 'coordenacao') then perform interno.erro('sem_permissao'); end if;
  if exists (select 1 from papeis where usuario = p_usuario and papel = 'vice') and not interno.lider() then perform interno.erro('sem_permissao'); end if;
  if not v_coord then
    if exists (select 1 from papeis where usuario = p_usuario and papel = 'supervisao') then perform interno.erro('sem_permissao'); end if;
    if char_length(v_motivo) < 5 then perform interno.erro('invalido:motivo'); end if;
    if not v_suspenso and (f.suspensao <> 'supervisao' or exists (select 1 from banimentos where usuario = p_usuario and ativo)) then perform interno.erro('sem_permissao'); end if;
  end if;
  update perfis set suspenso = v_suspenso, suspensao = case when not v_suspenso then '' when v_coord then 'coordenacao' else 'supervisao' end where id = p_usuario;
  -- Suspensão decidida pela coordenação ou pela supervisão vale por si: não cai quando um banimento da mesma conta for encerrado.
  if v_suspenso then update banimentos set ja_suspensa = true where usuario = p_usuario and ativo; end if;
  if not v_suspenso then update banimentos set ativo = false, encerrado_por = v, encerrado_em = now() where usuario = p_usuario and ativo; end if;
  perform interno.registrar(case when v_suspenso then 'conta_suspensa' else 'conta_reativada' end, p_usuario::text,
    case when v_motivo <> '' then jsonb_build_object('justificativa', v_motivo) else '{}'::jsonb end);
  if not v_coord then
    perform interno.avisar_lideranca('A supervisão ' || case when v_suspenso then 'suspendeu' else 'reativou' end || ' a conta de "' || left(f.nome, 60) || '". Motivo: ' || left(v_motivo, 200), v);
  end if;
  return jsonb_build_object('ok', true);
end $$;

/**
 * A conta de outra pessoa está ao alcance de quem chama? Só coordenação e vice-coordenação; ninguém age assim na própria
 * conta (para isso existe "Minha conta"); e a vice-coordenação não toca a conta da coordenação nem a de outra vice.
 */
create or replace function interno.ao_alcance(p_usuario uuid) returns void language plpgsql stable security definer set search_path = interno, pg_temp as $$
begin
  if not interno.coord() then perform interno.erro('sem_permissao'); end if;
  if p_usuario is null or p_usuario = auth.uid() then perform interno.erro('invalido:usuario'); end if;
  if not exists (select 1 from perfis where id = p_usuario) then perform interno.erro('nao_encontrado'); end if;
  if not interno.lider() and exists (select 1 from papeis where usuario = p_usuario and papel in ('coordenacao', 'vice')) then perform interno.erro('sem_permissao'); end if;
end $$;

/**
 * A coordenação acerta o nome público e a apresentação de outra pessoa (nome ofensivo, dado pessoal exposto, pedido de
 * quem não consegue entrar). O e-mail não muda por aqui. A pessoa é avisada; o registro guarda o que mudou, não o texto.
 */
create or replace function public.usuario_editar(p_usuario uuid, p_nome text, p_bio text) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); f perfis; v_nome text := interno.txt(p_nome, 'nome', 2, 60); v_bio text := interno.txt(p_bio, 'bio', 0, 500); v_campos text[] := '{}';
begin
  perform interno.ao_alcance(p_usuario);
  perform interno.limite('usuario_editar', 60, 60);
  select * into f from perfis where id = p_usuario for update;
  if f.nome is distinct from v_nome then v_campos := v_campos || 'nome'::text; end if;
  if f.bio is distinct from v_bio then v_campos := v_campos || 'apresentacao'::text; end if;
  if cardinality(v_campos) = 0 then return jsonb_build_object('ok', true, 'mudou', false); end if;
  update perfis set nome = v_nome, bio = v_bio where id = p_usuario;
  perform interno.registrar('usuario_editado', p_usuario::text, jsonb_build_object('campos', to_jsonb(v_campos)));
  perform interno.avisar(p_usuario, 'A coordenação acertou ' || case when cardinality(v_campos) = 2 then 'o seu nome e a sua apresentação' when v_campos[1] = 'nome' then 'o seu nome' else 'a sua apresentação' end
    || ' no painel. Confira em Minha conta e troque quando quiser.');
  return jsonb_build_object('ok', true, 'mudou', true);
end $$;

/**
 * A coordenação redefine a senha de quem esqueceu a própria. A senha é gravada como o serviço de contas grava (bcrypt, da
 * extensão pgcrypto, em qualquer esquema em que ela esteja), as sessões abertas da pessoa são encerradas e o painel pede a
 * ela uma senha nova no próximo acesso. A senha não vai para o registro nem para lugar nenhum além da conta.
 */
create or replace function public.usuario_senha_redefinir(p_usuario uuid, p_senha text) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v_esquema text; v_hash text; v_sessoes boolean := true;
begin
  perform interno.eu();
  perform interno.ao_alcance(p_usuario);
  perform interno.limite('senha_redefinir', 20, 60);
  -- A mesma regra da tela de senha nova: pelo menos 12 caracteres. O bcrypt só lê 72 bytes, e o serviço de contas recusa mais.
  if char_length(coalesce(p_senha, '')) < 12 or octet_length(p_senha) > 72 or p_senha ~ '[[:cntrl:]]' then perform interno.erro('invalido:senha'); end if;
  select n.nspname into v_esquema from pg_extension e join pg_namespace n on n.oid = e.extnamespace where e.extname = 'pgcrypto';
  if v_esquema is null then perform interno.erro('sem_pgcrypto'); end if;
  execute format('select %I.crypt($1, %I.gen_salt(''bf'', 10))', v_esquema, v_esquema) into v_hash using p_senha;
  update auth.users set encrypted_password = v_hash where id = p_usuario;
  if not found then perform interno.erro('nao_encontrado'); end if;
  -- Quem estava com a conta aberta (inclusive quem a tenha tomado) sai de todos os aparelhos.
  begin
    if to_regclass('auth.refresh_tokens') is not null then execute 'delete from auth.refresh_tokens where user_id::text = $1' using p_usuario::text; end if;
    if to_regclass('auth.sessions') is not null then execute 'delete from auth.sessions where user_id::text = $1' using p_usuario::text; end if;
  exception when others then
    v_sessoes := false;
  end;
  update perfis set trocar_senha = true where id = p_usuario;
  perform interno.registrar('senha_redefinida', p_usuario::text, jsonb_build_object('sessoes_encerradas', v_sessoes));
  perform interno.avisar(p_usuario, 'A coordenação redefiniu a sua senha. Entre com a senha que recebeu por um canal seguro: o painel pede que você escolha uma nova antes de abrir.');
  return jsonb_build_object('ok', true, 'sessoes_encerradas', v_sessoes);
end $$;

/** Depois de escolher a senha nova (no serviço de contas), a pessoa tira a própria marca de "trocar a senha". */
create or replace function public.senha_trocada() returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu();
begin
  update perfis set trocar_senha = false where id = v and trocar_senha;
  if found then perform interno.registrar('senha_trocada', v::text); end if;
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
      where p.papel in ('coordenacao', 'vice', 'supervisao', 'curadoria', 'mediacao')
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
  if random() < 0.05 then perform interno.vencer_sessoes(); end if;
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

/** O registro de atividades. Coordenação e vice-coordenação, e a supervisão, que só lê (é como ela acompanha a equipe). */
create or replace function public.auditoria_listar(p_pagina integer default 0, p_acao text default null) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
begin
  perform interno.eu();
  if not interno.supervisor() then perform interno.erro('sem_permissao'); end if;
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
  if v is not null and not exists (select 1 from papeis where usuario = v) then update perfis set suspenso = true, suspensao = 'sistema' where id = v; end if;
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
  perform interno.aberta('contribuir');
  -- Campo-isca: gente não vê, robô preenche. Finge que deu certo e não guarda nada.
  if coalesce(p ->> 'site', '') <> '' then return jsonb_build_object('id', gen_random_uuid()); end if;
  if v is not null then perform interno.eu(); end if;
  perform interno.limite('contribuir', case when v is null then 6 else 40 end, 60);

  if v_tipo not in ('aula', 'obra', 'artigo', 'checagem', 'debate', 'verbete', 'memorial', 'video', 'frase', 'traducao', 'correcao', 'sugestao', 'questao', 'avulso', 'temas', 'pratica') then
    perform interno.erro('invalido:tipo');
  end if;
  if jsonb_typeof(v_dados) <> 'object' or pg_column_size(v_dados) > (case when v_tipo = 'pratica' then 60000 else 20000 end) then perform interno.erro('invalido:dados'); end if;
  -- Prática lúdica de idioma: a aula a que pertence e de um a sessenta exercícios de tipo conhecido.
  if v_tipo = 'pratica' then
    if v is null then perform interno.erro('entre_primeiro'); end if;
    if coalesce(p ->> 'alvo', '') !~ '^[a-z0-9-]{2,80}/[a-z0-9-]{2,80}$' then perform interno.erro('invalido:alvo'); end if;
    if jsonb_typeof(v_dados -> 'exercicios') is distinct from 'array' or jsonb_array_length(v_dados -> 'exercicios') not between 1 and 60
       or exists (select 1 from jsonb_array_elements(v_dados -> 'exercicios') x
                  where jsonb_typeof(x) <> 'object' or coalesce(x ->> 'tipo', '') not in ('escolha', 'pares', 'lacuna', 'ordenar', 'ouvir', 'falar', 'cartoes', 'traduzir')) then
      perform interno.erro('invalido:exercicios');
    end if;
  end if;
  -- Questão para a prova de uma aula: de duas a seis alternativas, uma certa, e a aula a que pertence.
  if v_tipo = 'questao' then
    if jsonb_typeof(v_dados -> 'opcoes') is distinct from 'array' or jsonb_array_length(v_dados -> 'opcoes') not between 2 and 6
       or exists (select 1 from jsonb_array_elements(v_dados -> 'opcoes') o where jsonb_typeof(o) <> 'string' or char_length(btrim(o #>> '{}')) not between 1 and 300) then
      perform interno.erro('invalido:opcoes');
    end if;
    if coalesce(v_dados ->> 'correta', '') !~ '^[0-5]$' or (v_dados ->> 'correta')::int >= jsonb_array_length(v_dados -> 'opcoes') then perform interno.erro('invalido:correta'); end if;
    if coalesce(p ->> 'alvo', '') !~ '^[a-z0-9-]{2,80}/[a-z0-9-]{2,80}$' then perform interno.erro('invalido:alvo'); end if;
  end if;
  -- Nova versão de uma aula já publicada: só quem ensina a disciplina (ou a revisão e a liderança), nunca de fora.
  if v_tipo = 'aula' and coalesce(v_dados ->> 'substitui', '') <> '' then
    if v is null then perform interno.erro('entre_primeiro'); end if;
    if not (interno.coord() or interno.tem('supervisao') or interno.tem('revisao')
            or exists (select 1 from papeis p where p.usuario = v and p.papel in ('educacao', 'educacao_secundaria') and p.disciplina = v_disc)) then
      perform interno.erro('sem_permissao');
    end if;
  end if;
  -- Temas para as próximas aulas de uma trilha: de um a vinte títulos, um por linha, e a trilha a que pertencem.
  if v_tipo = 'temas' then
    if coalesce(v_dados ->> 'trilha', '') !~ '^[a-z0-9-]{2,80}$' then perform interno.erro('invalido:trilha'); end if;
    if char_length(coalesce(v_dados ->> 'temas', '')) not between 3 and 4000
       or (select count(*) from regexp_split_to_table(v_dados ->> 'temas', E'\n') l where btrim(l) <> '') not between 1 and 20
       or exists (select 1 from regexp_split_to_table(v_dados ->> 'temas', E'\n') l where btrim(l) <> '' and char_length(btrim(l)) not between 3 and 160) then
      perform interno.erro('invalido:temas');
    end if;
  end if;
  -- O jornal é escrito por quem tem esse papel.
  if v_tipo = 'artigo' and not (interno.tem('jornalismo') or interno.coord()) then perform interno.erro('sem_permissao'); end if;
  -- O acervo é da curadoria: na equipe, só curadoria e coordenação mandam obra (o público continua podendo sugerir).
  if v_tipo = 'obra' and v is not null and interno.voluntario() and not (interno.curador() or interno.tem('vice')) then perform interno.erro('sem_permissao'); end if;
  -- Cada educador escreve para a própria disciplina; para outra, só com o convite de quem ensina lá (interno.escreve_em).
  if v is not null and interno.voluntario() and v_tipo in ('aula', 'avulso', 'questao', 'temas', 'video') and v_disc is not null and not interno.escreve_em(v_disc) then
    perform interno.erro('sem_permissao');
  end if;
  -- Quem é da equipe só escreve aula, material e questão se tiver função de produção (educação, curadoria, revisão, tradução, jornalismo, design, marketing).
  if v is not null and interno.voluntario() and v_tipo in ('aula', 'avulso', 'questao', 'temas', 'pratica')
     and not (interno.envia() or interno.tem('revisao') or interno.tem('traducao') or interno.tem('supervisao')) then perform interno.erro('sem_permissao'); end if;
  if v_tipo = 'traducao' and v is null then perform interno.erro('entre_primeiro'); end if;

  if v is not null then
    if v_tipo = 'artigo' then v_como := 'jornalismo';
    elsif v_tipo = 'traducao' and interno.tem('traducao') then v_como := 'traducao';
    elsif v_disc is not null and exists (select 1 from papeis where usuario = v and papel in ('educacao', 'educacao_secundaria') and disciplina = v_disc) then v_como := 'educacao';
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
    interno.fontes_ok(p -> 'fontes', v_tipo in ('aula', 'artigo', 'checagem', 'debate', 'verbete', 'memorial', 'frase', 'avulso')),
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
    'lista_pareceres', coalesce((select jsonb_agg(jsonb_build_object('favoravel', r.favoravel, 'texto', r.texto, 'criado_em', r.criado_em, 'nome', coalesce(interno.nome_visto(f.nome), '')) order by r.criado_em)
                                 from pareceres r left join perfis f on f.id = r.autor where r.contribuicao = c.id), '[]'::jsonb))
    else '{}'::jsonb end
$$;

/** Quem pode ver uma contribuição na fila: curadoria e coordenação, revisores, e educadores da disciplina. */
create or replace function interno.ve_fila(p_disciplina text) returns boolean language sql stable as $$
  select interno.curador() or interno.tem('revisao')
    or (p_disciplina is not null and exists (select 1 from interno.papeis where usuario = auth.uid() and papel in ('educacao', 'educacao_secundaria') and disciplina = p_disciplina))
$$;

/**
 * As matérias do jornal passam pelo crivo de mais gente: além de curadoria e revisão, qualquer educador lê e dá parecer.
 * O que ainda espera a triagem da mediação não chega a revisores nem a educadores; curadoria e coordenação veem tudo.
 */
/** Quem revisa aulas (escritas ou em vídeo): revisão, supervisão, coordenação pedagógica e coordenação. O educador da disciplina entra por fora. */
create or replace function interno.revisa() returns boolean language sql stable as $$
  select interno.coord() or interno.tem('supervisao') or interno.tem('revisao')
$$;

create or replace function interno.ve_item(c interno.contribuicoes) returns boolean language sql stable as $$
  select interno.curador() or interno.tem('supervisao') or (c.triagem = 'liberada' and (interno.ve_fila(c.disciplina) or (c.tipo = 'artigo' and interno.tem('educacao'))))
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
/**
 * Quem pode dar a palavra final numa contribuição. Aula, material e questão: outro educador da mesma disciplina, revisão,
 * supervisão, coordenação pedagógica ou coordenação; uma dessas pessoas basta. Obras e fichas do acervo: a curadoria (os
 * bibliotecários), além da liderança. Nunca o próprio autor.
 */
create or replace function interno.decide(c interno.contribuicoes) returns boolean language sql stable security definer set search_path = interno, pg_temp as $$
  select auth.uid() is not null and c.autor is distinct from auth.uid() and (c.triagem = 'liberada' or interno.coord()) and (
    interno.coord() or interno.tem('supervisao')
    or (c.tipo in ('obra', 'verbete', 'memorial', 'video', 'frase', 'debate') and interno.curador())
    or (c.tipo not in ('obra', 'verbete', 'memorial', 'video', 'frase', 'debate') and (interno.tem('revisao')
        or (c.disciplina is not null and exists (select 1 from papeis p where p.usuario = auth.uid() and p.papel in ('educacao', 'educacao_secundaria') and p.disciplina = c.disciplina)))))
$$;

/**
 * O que vem de fora (quem não é da equipe) segue um caminho a mais: a mediação libera na triagem, um educador dá parecer
 * favorável e só então a revisão (ou a liderança) põe no ar. Quem é da equipe não precisa disso: uma pessoa que decide basta.
 */
create or replace function interno.pronta_para_o_ar(c interno.contribuicoes) returns boolean language plpgsql stable security definer set search_path = interno, pg_temp as $$
declare v_de_fora boolean;
begin
  if c.tipo not in ('aula', 'avulso', 'questao', 'temas', 'pratica') then return true; end if;
  select c.autor is null or not exists (select 1 from papeis where usuario = c.autor) into v_de_fora;
  if not v_de_fora then return true; end if;
  if interno.coord() then return true; end if;
  -- Falta o parecer de um educador (da disciplina, se houver; senão, qualquer educador)?
  if not exists (select 1 from pareceres r join papeis p on p.usuario = r.autor where r.contribuicao = c.id and r.favoravel and p.papel in ('educacao', 'educacao_secundaria')
                 and (p.disciplina = c.disciplina or not exists (select 1 from papeis q where q.papel in ('educacao', 'educacao_secundaria') and q.disciplina = c.disciplina))) then
    return false;
  end if;
  -- E quem decide por fim é a revisão (ou supervisão, coordenação pedagógica), não o educador que deu o parecer.
  return interno.tem('revisao') or interno.tem('supervisao') or interno.tem('vice');
end $$;

create or replace function public.contribuicao_decidir(p_id uuid, p_aprovar boolean, p_nota text) returns jsonb
language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); c contribuicoes;
begin
  select * into c from contribuicoes where id = p_id for update;
  if not found then perform interno.erro('nao_encontrado'); end if;
  if not interno.decide(c) then perform interno.erro('sem_permissao'); end if;
  if c.status <> 'pendente' then perform interno.erro('ja_decidida'); end if;
  if p_aprovar and not interno.pronta_para_o_ar(c) then perform interno.erro('falta_educador'); end if;
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
  -- O mesmo texto com os números de volta a letras, tudo junto e sem letra repetida: "v0u t3 m4t4r", "v o u  t e  m a t a r", "vooou te mataaar".
  v_junto text := regexp_replace(replace(interno.normal(translate(lower(v_texto), '013457@$!', 'oieastasi')), ' ', ''), '(.)\1+', '\1', 'g');
begin
  if exists (select 1 from termos_vetados t where t.grave and position(' ' || t.termo || ' ' in v_normal) > 0) then
    return jsonb_build_object('veredito', 'bloquear', 'motivo', 'expressao_grave');
  end if;
  -- Expressão grave disfarçada não é barrada sozinha (o disfarce também pega coincidência): vai para leitura humana.
  if exists (select 1 from termos_vetados t where t.grave and char_length(replace(t.termo, ' ', '')) >= 8
             and position(regexp_replace(replace(t.termo, ' ', ''), '(.)\1+', '\1', 'g') in v_junto) > 0) then
    return jsonb_build_object('veredito', 'revisar', 'motivo', 'disfarce');
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

/** Modo de segurança: com ele ligado, nada do público aparece na Comunidade sem aprovação manual, com ou sem segunda avaliação. */
create or replace function interno.aprovacao_manual() returns boolean language sql stable security definer set search_path = interno, pg_temp as $$
  select coalesce((select (valor ->> 'aprovacao_manual')::boolean from configuracoes where chave = 'comunidade'), false)
$$;

/** A segunda avaliação (feita fora do banco, pela função "avaliar-comunidade") está ligada? Nasce desligada. */
create or replace function interno.avaliacao_externa() returns boolean language sql stable security definer set search_path = interno, pg_temp as $$
  select coalesce((select (valor ->> 'avaliacao_externa')::boolean from configuracoes where chave = 'comunidade'), false)
$$;

/**
 * Lê o resultado da segunda avaliação e decide. Só chega aqui o que as regras do banco já deixaram passar.
 * Barra: ameaça, ódio e conteúdo sexual com menor apontados com clareza. Manda para leitura humana: qualquer outra
 * sinalização, nota alta em qualquer categoria e todo resultado com erro, incompleto ou que não se entende.
 * Nenhuma saída daqui suspende ou bane conta: isso é sempre decisão de gente.
 */
create or replace function interno.decidir_externa(p jsonb) returns jsonb language plpgsql immutable as $$
declare v_categorias jsonb; v_notas jsonb; v_maior numeric;
begin
  begin
    if p is null or jsonb_typeof(p) <> 'object' or p ? 'erro' or jsonb_typeof(p -> 'sinalizado') is distinct from 'boolean'
       or jsonb_typeof(p -> 'categorias') is distinct from 'object' or jsonb_typeof(p -> 'notas') is distinct from 'object'
       or not exists (select 1 from jsonb_object_keys(p -> 'notas')) then
      return jsonb_build_object('veredito', 'revisar', 'motivo', 'avaliacao_externa_falhou');
    end if;
    v_categorias := p -> 'categorias'; v_notas := p -> 'notas';
    select max(e.value::numeric) into v_maior from jsonb_each_text(v_notas) e;
    if coalesce((v_categorias ->> 'hate/threatening')::boolean, false) or coalesce((v_categorias ->> 'harassment/threatening')::boolean, false)
       or coalesce((v_categorias ->> 'sexual/minors')::boolean, false)
       or coalesce((v_notas ->> 'hate')::numeric, 0) >= 0.9 or coalesce((v_notas ->> 'sexual')::numeric, 0) >= 0.9
       or coalesce((v_notas ->> 'violence/graphic')::numeric, 0) >= 0.9 then
      return jsonb_build_object('veredito', 'bloquear', 'motivo', 'avaliacao_externa');
    end if;
    -- Quem fala de se machucar não cometeu violação: precisa de leitura humana, com cuidado.
    if coalesce((v_categorias ->> 'self-harm')::boolean, false) or coalesce((v_categorias ->> 'self-harm/intent')::boolean, false)
       or coalesce((v_categorias ->> 'self-harm/instructions')::boolean, false) then
      return jsonb_build_object('veredito', 'revisar', 'motivo', 'cuidado');
    end if;
    if (p ->> 'sinalizado')::boolean or v_maior is null or v_maior >= 0.5 then
      return jsonb_build_object('veredito', 'revisar', 'motivo', 'avaliacao_externa');
    end if;
    return jsonb_build_object('veredito', 'publicar', 'motivo', '');
  exception when others then
    return jsonb_build_object('veredito', 'revisar', 'motivo', 'avaliacao_externa_falhou');
  end;
end $$;

/**
 * Para a função "avaliar-comunidade" (só com a chave de serviço): entrega o texto de uma mensagem que espera a segunda
 * avaliação e a marca como "em avaliação". Enquanto uma avaliação está em andamento, a mensagem não é entregue de novo.
 * Se ela não voltar em dois minutos, ou voltar com falha, a mensagem pode ser entregue outra vez, até três no total;
 * depois disso fica na fila de revisão, onde alguém da equipe decide. Em nenhum momento ela aparece para o público.
 */
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
  else
    perform interno.erro('invalido:tipo');
  end if;
  if v_texto is null then return null; end if;
  return jsonb_build_object('texto', v_texto);
end $$;

/**
 * Para a função "avaliar-comunidade" (só com a chave de serviço): recebe o resultado da segunda avaliação e aplica a
 * decisão. Só mexe em mensagem que ela mesma pegou para avaliar e que ninguém da equipe decidiu nesse meio-tempo.
 */
create or replace function public.comunidade_avaliada(p_tipo text, p_id uuid, p_resultado jsonb) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v jsonb := interno.decidir_externa(p_resultado); v_veredito text := v ->> 'veredito'; v_topico uuid; v_achou boolean := false;
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
  else
    perform interno.erro('invalido:tipo');
  end if;
  if not v_achou then return jsonb_build_object('veredito', 'ignorado'); end if;
  if v_veredito = 'bloquear' then
    insert into auditoria (quem, nome, acao, alvo, detalhes) values (null, 'avaliação automática', 'comunidade_bloqueada', p_id::text, jsonb_build_object('tipo', p_tipo, 'motivo', v ->> 'motivo'));
  end if;
  return jsonb_build_object('veredito', v_veredito);
end $$;

/**
 * Para a função "avaliar-comunidade" (só com a chave de serviço): as mensagens que ficaram esperando a segunda avaliação
 * e ainda podem ser entregues (nunca avaliadas, avaliação que não voltou ou que falhou, com menos de três tentativas).
 * Serve para recuperar o que ficou para trás quando o navegador de quem escreveu fechou ou o serviço esteve fora do ar.
 */
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
      order by criado_em limit 20) x);
end $$;

/**
 * O que a coordenação vê sobre a moderação da Comunidade. Três coisas diferentes, que não se confundem: "habilitada" é a
 * chave ligada no banco; "verificacao" é o último teste feito de propósito pelo painel (função publicada, chave presente,
 * serviço respondendo); "ultima_avaliacao" é a última mensagem de verdade que passou pela segunda avaliação.
 */
create or replace function public.comunidade_controles() returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare c jsonb := coalesce((select valor from configuracoes where chave = 'comunidade'), '{}'::jsonb);
begin
  perform interno.eu();
  if not interno.coord() then perform interno.erro('sem_permissao'); end if;
  return jsonb_build_object(
    'aprovacao_manual', coalesce((c ->> 'aprovacao_manual')::boolean, false),
    'habilitada', coalesce((c ->> 'avaliacao_externa')::boolean, false),
    'verificacao', c -> 'verificacao',
    'ultima_avaliacao', c -> 'ultima_avaliacao',
    'esperando', (select count(*) from topicos where retido) + (select count(*) from respostas where retido));
end $$;

/**
 * Liga ou desliga o modo de segurança. É uma proteção reversível: coordenação, vice-coordenação e supervisão. Fica no
 * registro, e a coordenação é avisada quando ele liga (e, se foi a supervisão, também quando desliga).
 */
create or replace function public.comunidade_modo_seguranca(p_ligar boolean) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
begin
  perform interno.eu();
  if not interno.supervisor() then perform interno.erro('sem_permissao'); end if;
  insert into configuracoes (chave, valor) values ('comunidade', jsonb_build_object('aprovacao_manual', coalesce(p_ligar, false)))
  on conflict (chave) do update set valor = configuracoes.valor || excluded.valor;
  perform interno.registrar('comunidade_modo_seguranca', '', jsonb_build_object('ligado', coalesce(p_ligar, false)));
  if coalesce(p_ligar, false) then perform interno.avisar_lideranca('O modo de segurança da Comunidade foi ligado: toda mensagem nova espera aprovação manual.', auth.uid());
  elsif not interno.coord() then perform interno.avisar_lideranca('A supervisão desligou o modo de segurança da Comunidade.', auth.uid()); end if;
  -- O quadro completo (estado da segunda avaliação, testes) é da coordenação; a supervisão recebe só as proteções.
  return case when interno.coord() then public.comunidade_controles() else public.protecoes() end;
end $$;

/** Para a função "avaliar-comunidade" (só com a chave de serviço): guarda o resultado de um teste de funcionamento pedido pelo painel. */
create or replace function public.comunidade_verificacao(p jsonb) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
begin
  if not interno.servico() then perform interno.erro('sem_permissao'); end if;
  update configuracoes set valor = valor || jsonb_build_object('verificacao', jsonb_build_object(
    'em', now(), 'chave', coalesce((p ->> 'chave')::boolean, false), 'ok', coalesce((p ->> 'ok')::boolean, false), 'falha', left(coalesce(p ->> 'falha', ''), 40)))
  where chave = 'comunidade';
  return jsonb_build_object('ok', true);
end $$;

/** Só pelo SQL Editor: liga ou desliga a segunda avaliação. Ligue só depois de publicar a função "avaliar-comunidade" com a chave dela. */
create or replace function public.comunidade_avaliacao_externa(p_ligar boolean) returns text language plpgsql security definer set search_path = interno, pg_temp as $$
begin
  if auth.uid() is not null or (interno.claims() ->> 'role') in ('anon', 'authenticated') then
    raise exception 'sem_permissao' using errcode = 'P0001';
  end if;
  insert into configuracoes (chave, valor) values ('comunidade', jsonb_build_object('avaliacao_externa', coalesce(p_ligar, false)))
  on conflict (chave) do update set valor = configuracoes.valor || excluded.valor;
  insert into auditoria (quem, nome, acao, alvo, detalhes) values (null, 'banco', 'comunidade_avaliacao_externa', '', jsonb_build_object('ligada', coalesce(p_ligar, false)));
  return case when coalesce(p_ligar, false) then 'Segunda avaliação ligada: mensagem que as regras deixam passar espera por ela antes de aparecer.'
              else 'Segunda avaliação desligada: valem só as regras do banco.' end;
end $$;

drop function if exists public.topicos_listar(text, text, integer);
drop function if exists public.topico_criar(text, text, text);
-- As versões sem a aula ou obra ligada e sem a resposta-mãe saem: as novas aceitam os mesmos argumentos e mais estes.
drop function if exists public.topicos_listar(text, text, integer, text, text);
drop function if exists public.topico_criar(text, text, text, text);
drop function if exists public.responder(uuid, text);

/** O selo de quem escreve na comunidade: a função mais próxima do estudo (coordenação, educação, mentoria, mediação ou equipe). */
create or replace function interno.selo(p_usuario uuid) returns text language sql stable security definer set search_path = interno, pg_temp as $$
  select case
    when p_usuario is null then null
    when exists (select 1 from papeis where usuario = p_usuario and papel in ('coordenacao', 'vice')) then 'coordenacao'
    when exists (select 1 from papeis where usuario = p_usuario and papel in ('educacao', 'educacao_secundaria')) then 'educacao'
    when exists (select 1 from papeis where usuario = p_usuario and papel = 'mentoria') then 'mentoria'
    when exists (select 1 from papeis where usuario = p_usuario and papel = 'mediacao') then 'mediacao'
    when exists (select 1 from papeis where usuario = p_usuario) then 'equipe'
  end
$$;
revoke all on function interno.selo(uuid) from public, anon, authenticated;

/**
 * Lista de conversas e dúvidas, aberta a qualquer visitante. p_tipo: 'conversa', 'duvida' ou vazio (tudo).
 * p_ordem: 'alta', 'novos', 'melhores', 'sem_resposta'. O que espera a mediação só aparece para quem escreveu e para quem cuida.
 */
create or replace function public.topicos_listar(p_ordem text default 'alta', p_disciplina text default null, p_pagina integer default 0, p_tipo text default null, p_busca text default null, p_alvo text default null) returns jsonb
language sql stable security definer set search_path = interno, pg_temp as $$
  select interno.aberta('comunidade');
  select coalesce(jsonb_agg(x.j order by x.n), '[]'::jsonb) from (
    select row_number() over () as n, jsonb_build_object(
      'id', t.id, 'titulo', t.titulo, 'disciplina', t.disciplina, 'pontos', t.pontos, 'respostas', t.respostas, 'tipo', t.tipo, 'resolvida', t.aceita is not null,
      'trancado', t.trancado, 'oculto', t.oculto, 'retido', t.retido, 'criado_em', t.criado_em, 'autor', coalesce(f.nome, ''),
      'autor_selo', interno.selo(t.autor), 'trecho', left(regexp_replace(t.corpo, '[#*_>`\[\]()!]+|\s+', ' ', 'g'), 180),
      'alvo', t.alvo, 'alvo_titulo', t.alvo_titulo,
      'ultima', coalesce((select max(r.criado_em) from respostas r where r.topico = t.id and not r.oculto), t.criado_em),
      'meu_voto', coalesce((select v.valor from votos v where v.usuario = auth.uid() and v.tipo = 'topico' and v.alvo = t.id), 0)) as j
    from topicos t left join perfis f on f.id = t.autor
    where (not t.oculto or interno.cuida() or coalesce(t.retido and t.autor = auth.uid(), false)) and (coalesce(p_disciplina, '') = '' or t.disciplina = p_disciplina)
      and (coalesce(p_tipo, '') = '' or t.tipo = p_tipo)
      and (coalesce(p_alvo, '') = '' or t.alvo = p_alvo)
      and (p_ordem is distinct from 'sem_resposta' or t.respostas = 0)
      and (coalesce(btrim(p_busca), '') = '' or position(interno.normal(left(p_busca, 80)) in interno.normal(t.titulo || ' ' || left(t.corpo, 3000))) > 0)
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
  perform interno.aberta('comunidade');
  select * into t from topicos where id = p_id;
  -- Quem escreveu acompanha a própria mensagem enquanto ela espera a mediação; mais ninguém de fora a vê.
  if not found or (t.oculto and not interno.cuida() and not coalesce(t.retido and t.autor = auth.uid(), false)) then perform interno.erro('nao_encontrado'); end if;
  return jsonb_build_object(
    'id', t.id, 'titulo', t.titulo, 'corpo', t.corpo, 'disciplina', t.disciplina, 'pontos', t.pontos, 'trancado', t.trancado, 'oculto', t.oculto, 'retido', t.retido,
    'tipo', t.tipo, 'aceita', t.aceita, 'alvo', t.alvo, 'alvo_titulo', t.alvo_titulo, 'autor_selo', interno.selo(t.autor),
    'criado_em', t.criado_em, 'autor', coalesce((select nome from perfis where id = t.autor), ''),
    'meu', t.autor is not null and t.autor = auth.uid(),
    'meu_voto', coalesce((select valor from votos where usuario = auth.uid() and tipo = 'topico' and alvo = t.id), 0),
    'pode_cuidar', interno.cuida(), 'pode_banir', interno.media(),
    'autor_id', case when interno.media() then t.autor end,
    -- Numa dúvida, a resposta escolhida vem primeiro e depois as mais bem votadas; numa conversa, a ordem é a do tempo.
    'respostas', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', r.id, 'corpo', r.corpo, 'pontos', r.pontos, 'oculto', r.oculto, 'retido', r.retido, 'criado_em', r.criado_em, 'autor', coalesce(f.nome, ''),
        'aceita', r.id = t.aceita, 'da_equipe', exists (select 1 from papeis p where p.usuario = r.autor), 'autor_selo', interno.selo(r.autor), 'pai', r.pai,
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
create or replace function public.topico_criar(p_titulo text, p_corpo text, p_disciplina text, p_tipo text default 'conversa', p_alvo text default null, p_alvo_titulo text default '') returns jsonb
language plpgsql security definer set search_path = interno, pg_temp as $$
declare
  v uuid := interno.eu(); v_id uuid;
  v_alvo text := nullif(btrim(coalesce(p_alvo, '')), '');
  v_titulo text := interno.txt(p_titulo, 'titulo', 5, 140);
  v_corpo text := interno.txt(p_corpo, 'corpo', 10, 8000);
  v_av jsonb; v_veredito text; v_externa boolean := false;
begin
  perform interno.aberta('comunidade');
  perform interno.limite('topico', 3, 60);
  if coalesce(p_tipo, 'conversa') not in ('conversa', 'duvida') then perform interno.erro('invalido:tipo'); end if;
  if v_alvo is not null and v_alvo !~ '^/(trilhas|acervo)/[a-z0-9/-]{2,200}$' then perform interno.erro('invalido:alvo'); end if;
  v_av := interno.veredito(v_titulo || ' ' || v_corpo, interno.cuida(), v);
  v_veredito := v_av ->> 'veredito';
  -- Com a segunda avaliação ligada, o que as regras deixam passar fica na fila até ela responder. Sem resposta, fica lá.
  if v_veredito = 'publicar' and interno.aprovacao_manual() and not interno.cuida() then
    v_veredito := 'revisar'; v_av := jsonb_build_object('veredito', 'revisar', 'motivo', 'modo_seguranca');
  elsif v_veredito = 'publicar' and interno.avaliacao_externa() then
    v_veredito := 'revisar'; v_av := jsonb_build_object('veredito', 'revisar', 'motivo', 'aguardando_avaliacao'); v_externa := true;
  end if;
  insert into topicos (autor, titulo, corpo, disciplina, tipo, oculto, retido, avaliacao, motivo, alvo, alvo_titulo)
  values (v, v_titulo, v_corpo, interno.disciplina_ok(p_disciplina), coalesce(p_tipo, 'conversa'), v_veredito <> 'publicar', v_veredito = 'revisar',
          case v_veredito when 'publicar' then 'publicada' when 'bloquear' then 'bloqueada' else 'revisao' end, v_av ->> 'motivo',
          v_alvo, case when v_alvo is null then '' else interno.txt(p_alvo_titulo, 'alvo_titulo', 0, 200) end)
  returning id into v_id;
  if v_veredito = 'bloquear' then perform interno.registrar('comunidade_bloqueada', v_id::text, jsonb_build_object('tipo', 'topico', 'motivo', v_av ->> 'motivo')); end if;
  return jsonb_build_object('id', v_id, 'retido', v_veredito = 'revisar', 'bloqueado', v_veredito = 'bloquear', 'avaliando', v_externa);
end $$;

create or replace function public.responder(p_topico uuid, p_corpo text, p_pai uuid default null) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); t topicos; v_id uuid; v_corpo text := interno.txt(p_corpo, 'corpo', 2, 8000); v_av jsonb; v_veredito text; v_externa boolean := false;
  v_pai uuid := p_pai; v_nivel integer := 1; v_cima uuid;
begin
  perform interno.aberta('comunidade');
  perform interno.limite('responder', 30, 60);
  select * into t from topicos where id = p_topico for update;
  if not found or t.oculto then perform interno.erro('nao_encontrado'); end if;
  if t.trancado then perform interno.erro('topico_trancado'); end if;
  if v_pai is not null then
    if not exists (select 1 from respostas where id = v_pai and topico = p_topico and not oculto) then perform interno.erro('nao_encontrado'); end if;
    -- A árvore vai até três níveis: resposta a uma resposta de terceiro nível fica ao lado dela.
    select pai into v_cima from respostas where id = v_pai;
    while v_cima is not null and v_nivel < 3 loop
      v_nivel := v_nivel + 1;
      select pai into v_cima from respostas where id = v_cima;
    end loop;
    if v_nivel >= 3 then select pai into v_pai from respostas where id = v_pai; end if;
  end if;
  v_av := interno.veredito(v_corpo, interno.cuida(), v);
  v_veredito := v_av ->> 'veredito';
  if v_veredito = 'publicar' and interno.aprovacao_manual() and not interno.cuida() then
    v_veredito := 'revisar'; v_av := jsonb_build_object('veredito', 'revisar', 'motivo', 'modo_seguranca');
  elsif v_veredito = 'publicar' and interno.avaliacao_externa() then
    v_veredito := 'revisar'; v_av := jsonb_build_object('veredito', 'revisar', 'motivo', 'aguardando_avaliacao'); v_externa := true;
  end if;
  insert into respostas (topico, autor, corpo, oculto, retido, avaliacao, motivo, pai)
  values (p_topico, v, v_corpo, v_veredito <> 'publicar', v_veredito = 'revisar',
          case v_veredito when 'publicar' then 'publicada' when 'bloquear' then 'bloqueada' else 'revisao' end, v_av ->> 'motivo', v_pai)
  returning id into v_id;
  if v_veredito = 'publicar' then update topicos set respostas = respostas + 1 where id = p_topico; end if;
  if v_veredito = 'bloquear' then perform interno.registrar('comunidade_bloqueada', v_id::text, jsonb_build_object('tipo', 'resposta', 'motivo', v_av ->> 'motivo')); end if;
  return jsonb_build_object('id', v_id, 'retido', v_veredito = 'revisar', 'bloqueado', v_veredito = 'bloquear', 'avaliando', v_externa);
end $$;

/** Quem perguntou (ou a equipe) marca a resposta que resolveu a dúvida. Sem p_resposta, desmarca. */
create or replace function public.resposta_aceitar(p_topico uuid, p_resposta uuid) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); t topicos;
begin
  perform interno.aberta('comunidade');
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
  perform interno.aberta('comunidade');
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
  elsif p_tipo = 'comentario' and p_acao in ('ocultar', 'mostrar') then
    select retido, autor, avaliacao = 'bloqueada', oculto into v_retido, v_autor, v_bloqueada, v_oculto from comentarios where id = p_alvo;
    update comentarios set oculto = (p_acao = 'ocultar'), retido = false,
      avaliacao = case when p_acao = 'mostrar' and avaliacao = 'bloqueada' then 'revista' else avaliacao end where id = p_alvo;
    v_achou := found;
  elsif p_tipo = 'aula_chat' and p_acao in ('ocultar', 'mostrar') then
    select retido, autor, avaliacao = 'bloqueada', oculta into v_retido, v_autor, v_bloqueada, v_oculto from aulas_chat where id = p_alvo;
    update aulas_chat set oculta = (p_acao = 'ocultar'), retido = false,
      avaliacao = case when p_acao = 'mostrar' and avaliacao = 'bloqueada' then 'revista' else avaliacao end where id = p_alvo;
    v_achou := found;
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
  elsif p_tipo = 'comentario' then
    update comentarios set corpo = interno.txt(p_corpo, 'corpo', 2, 1000) where id = p_alvo;
  elsif p_tipo = 'aula_chat' then
    update aulas_chat set corpo = interno.txt(p_corpo, 'corpo', 1, 500) where id = p_alvo;
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
      union all
      select c.criado_em, jsonb_build_object('tipo', 'comentario', 'id', c.id, 'topico', null, 'titulo', 'Comentário na aula em vídeo: ' || coalesce((select titulo from videoaulas where id = c.videoaula), ''), 'corpo', c.corpo, 'autor', coalesce(f.nome, ''), 'criado_em', c.criado_em,
        'autor_id', case when interno.media() then c.autor end, 'filtro', interno.vetado(c.corpo), 'motivo', c.motivo)
      from comentarios c left join perfis f on f.id = c.autor where c.retido
      union all
      select m.criado_em, jsonb_build_object('tipo', 'aula_chat', 'id', m.id, 'topico', null, 'titulo', 'Bate-papo da aula ao vivo: ' || coalesce((select titulo from aulas_ao_vivo where id = m.aula), ''), 'corpo', m.corpo, 'autor', coalesce(f.nome, ''), 'criado_em', m.criado_em,
        'autor_id', case when interno.media() then m.autor end, 'filtro', interno.vetado(m.corpo), 'motivo', m.motivo)
      from aulas_chat m left join perfis f on f.id = m.autor where m.retido
    ) x);
end $$;

/**
 * Banimento pela mediação, para quem passa do limite na comunidade. A conta fica suspensa (lê, mas não envia nada) e o que
 * ela tinha esperando na fila é recusado. Em caso extremo, p_origem barra também os envios vindos da mesma origem de rede,
 * com ou sem conta. A mediação não bane gente da equipe: isso é com a coordenação. Desfazer também é só com a coordenação.
 */
create or replace function public.mediacao_banir(p_usuario uuid, p_motivo text, p_origem boolean default false) returns jsonb
language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); f perfis; v_motivo text := interno.txt(p_motivo, 'motivo', 5, 300); v_origem text; v_ja boolean;
begin
  if not interno.media() then perform interno.erro('sem_permissao'); end if;
  perform interno.limite('banir', 30, 1440);
  select * into f from perfis where id = p_usuario;
  if not found then perform interno.erro('nao_encontrado'); end if;
  if p_usuario = v or exists (select 1 from papeis where usuario = p_usuario) then perform interno.erro('sem_permissao'); end if;
  if coalesce(p_origem, false) then v_origem := f.origem; end if;
  -- Suspensa por outro banimento ainda ativo, a conta herda dele a marcação; suspensa sem banimento, foi a coordenação.
  v_ja := case when exists (select 1 from banimentos where usuario = p_usuario and ativo)
               then coalesce((select bool_or(ja_suspensa) from banimentos where usuario = p_usuario and ativo), false)
               else f.suspenso end;
  -- De onde veio a suspensão: se a coordenação (ou a supervisão) já tinha suspendido, a marcação dela continua valendo.
  update perfis set suspenso = true, suspensao = case when v_ja and suspensao <> '' then suspensao else 'mediacao' end where id = p_usuario;
  update topicos set retido = false where autor = p_usuario and retido;
  update respostas set retido = false where autor = p_usuario and retido;
  update comentarios set retido = false where autor = p_usuario and retido;
  update aulas_chat set retido = false where autor = p_usuario and retido;
  update gaveta set status = 'recusado', nota = 'Conta banida pela mediação.', decidido_por = v, decidido_em = now() where autor = p_usuario and status = 'pendente';
  update banimentos set ativo = false, encerrado_por = v, encerrado_em = now() where usuario = p_usuario and ativo;
  insert into banimentos (usuario, nome, origem, motivo, por, ja_suspensa) values (p_usuario, f.nome, v_origem, v_motivo, v, v_ja);
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
  if b.usuario is not null and not b.ja_suspensa and not exists (select 1 from banimentos where usuario = b.usuario and ativo) then
    update perfis set suspenso = false, suspensao = '' where id = b.usuario;
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
  perform interno.aberta('contribuir');
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
  perform interno.registrar('denuncia_resolvida', p_id::text);
  return jsonb_build_object('ok', true);
end $$;

-- ───────────────────────────── Anotações de leitura ─────────────────────────────

create or replace function public.anotacoes_listar(p_caminho text) returns jsonb language sql stable security definer set search_path = interno, pg_temp as $$
  select interno.aberta('estudo');
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
  perform interno.aberta('estudo');
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
  perform interno.registrar('anotacao_' || p_status, p_id::text);
  return jsonb_build_object('ok', true);
end $$;

-- ───────────────────────────── Apoiadores ─────────────────────────────

create or replace function public.apoiadores_listar() returns jsonb language sql stable security definer set search_path = interno, pg_temp as $$
  select interno.aberta('voluntariado');
  select coalesce(jsonb_agg(jsonb_build_object('id', a.id, 'nome', a.nome, 'mensagem', a.mensagem) order by a.criado_em), '[]'::jsonb) from apoiadores a where a.visivel
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
  perform interno.registrar('apoiador_salvo', v_id::text);
  return jsonb_build_object('id', v_id);
end $$;

create or replace function public.apoiador_remover(p_id uuid) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
begin
  perform interno.eu();
  if not interno.coord() then perform interno.erro('sem_permissao'); end if;
  delete from apoiadores where id = p_id;
  if found then perform interno.registrar('apoiador_removido', p_id::text); end if;
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
  select interno.aberta('mural');
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
  perform interno.aberta('mural');
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
declare v uuid := interno.eu(); v_autor uuid;
begin
  delete from mural where id = p_id and (autor = v or interno.coord()) returning autor into v_autor;
  if not found then perform interno.erro('nao_encontrado'); end if;
  -- Quem retira o próprio anúncio não precisa de rastro; a coordenação apagando o anúncio de outra pessoa, sim.
  if v_autor is distinct from v then perform interno.registrar('anuncio_removido', p_id::text); end if;
  return jsonb_build_object('ok', true);
end $$;

/** Anúncio aprovado vale 180 dias. Quem publicou renova com um clique enquanto a iniciativa existir. */
create or replace function public.mural_renovar(p_id uuid) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu();
begin
  perform interno.aberta('mural');
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
  perform interno.aberta('radio');
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
  perform interno.registrar('radio_canal_salvo', v_id::text);
  return jsonb_build_object('id', v_id);
end $$;

create or replace function public.radio_canal_remover(p_id uuid) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
begin
  perform interno.eu();
  if not interno.radialista() then perform interno.erro('sem_permissao'); end if;
  delete from radio_canais where id = p_id;
  if found then perform interno.registrar('radio_canal_removido', p_id::text); end if;
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.radio_faixa_salvar(p_id uuid, p_canal uuid, p_titulo text, p_artista text, p_url text, p_duracao integer, p_ordem integer) returns jsonb
language plpgsql security definer set search_path = interno, pg_temp as $$
declare v_id uuid; v_url text := btrim(coalesce(p_url, ''));
begin
  perform interno.eu();
  if not interno.radialista() then perform interno.erro('sem_permissao'); end if;
  -- Só https: o site é servido em https e o navegador não toca áudio http dentro dele.
  if v_url !~ '^https://[^[:space:]]+$' or char_length(v_url) > 500 then perform interno.erro('invalido:url'); end if;
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
  perform interno.registrar('radio_faixa_salva', v_id::text);
  return jsonb_build_object('id', v_id);
end $$;

create or replace function public.radio_faixa_remover(p_id uuid) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
begin
  perform interno.eu();
  if not interno.radialista() then perform interno.erro('sem_permissao'); end if;
  delete from radio_faixas where id = p_id;
  if found then perform interno.registrar('radio_faixa_removida', p_id::text); end if;
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
/**
 * Quem ensina, para a página "Quem somos" e o cartão de educadores de cada aula: nome (como assina as aulas), o
 * "sobre você" do perfil, o ícone e as disciplinas. Só educadores ativos; nada de e-mail nem de outros papéis.
 */
create or replace function public.educadores() returns jsonb language sql stable security definer set search_path = interno, pg_temp as $$
  select coalesce(jsonb_agg(jsonb_build_object('id', f.id, 'nome', f.nome, 'bio', f.bio, 'avatar', f.avatar, 'curriculo', coalesce(f.curriculo, '{}'::jsonb),
           'disciplinas', (select jsonb_agg(distinct p.disciplina) from papeis p where p.usuario = f.id and p.papel in ('educacao', 'educacao_secundaria') and p.disciplina is not null))
           order by f.nome), '[]'::jsonb)
  from perfis f
  where not f.suspenso and exists (select 1 from papeis p where p.usuario = f.id and p.papel in ('educacao', 'educacao_secundaria'))
$$;

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

/** Disciplinas com algum mentor ou educador que passou pelo painel nas últimas 24 horas: só a lista, nenhum nome. */
create or replace function public.reforco_disponibilidade() returns jsonb language sql stable security definer set search_path = interno, pg_temp as $$
  select coalesce(jsonb_agg(distinct p.disciplina), '[]'::jsonb)
  from papeis p join perfis f on f.id = p.usuario
  where p.papel in ('mentoria', 'educacao', 'educacao_secundaria') and p.disciplina is not null and not f.suspenso and f.visto_em > now() - interval '24 hours'
$$;

create or replace function public.reforco_pedir(p jsonb) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare
  v uuid := auth.uid();
  v_email text := lower(btrim(coalesce(p ->> 'email', '')));
  v_disc text := interno.disciplina_ok(p ->> 'disciplina');
  v_assunto text; v_duvida text; v_id uuid;
begin
  perform interno.aberta('reforco');
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
  perform interno.email(v_email, 'reforco_recebido', 'Recebemos seu pedido de aula de reforço',
    E'Olá.\n\nRecebemos o seu pedido de reforço sobre "' || v_assunto || E'".\n\nAlguém da equipe que ensina essa disciplina vai ler a sua dúvida e responder por este mesmo endereço. '
    || E'Às vezes leva alguns dias. Confira também a caixa de spam.\n\nSe não foi você quem pediu, é só ignorar esta mensagem.');
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
  if not (interno.coord() or interno.tem('mentoria') or interno.tem('educacao')) then perform interno.erro('sem_permissao'); end if;
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

/** Devolver o pedido à fila (quem assumiu não pôde responder). A coordenação destrava o pedido de quem sumiu. */
create or replace function public.reforco_soltar(p_id uuid) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu();
begin
  update reforco set status = 'aberto', mentor = null where id = p_id and status = 'em_atendimento' and (mentor = v or interno.coord());
  if not found then perform interno.erro('nao_encontrado'); end if;
  return jsonb_build_object('ok', true);
end $$;

/** Concluir: o e-mail da pessoa é apagado do banco neste momento. */
create or replace function public.reforco_concluir(p_id uuid, p_nota text) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); r reforco;
begin
  select * into r from reforco where id = p_id for update;
  if not found or r.status <> 'em_atendimento' then perform interno.erro('nao_encontrado'); end if;
  if not (r.mentor = v or interno.coord()) then perform interno.erro('sem_permissao'); end if;
  update reforco set status = 'atendido', email = '', nota = interno.txt(p_nota, 'nota', 0, 1000), atendido_em = now() where id = p_id;
  perform interno.registrar('reforco_concluido', p_id::text);
  perform interno.avisar(r.autor, 'Seu pedido de reforço "' || left(r.assunto, 80) || '" foi respondido por e-mail. Confira também a caixa de spam.');
  return jsonb_build_object('ok', true);
end $$;

-- ───────────────────────────── Assistente de reforço ─────────────────────────────
-- Quem pergunta é a função "assistente" (fora do banco), que chama um serviço pago de inteligência artificial. O banco
-- só decide se a pessoa pode perguntar agora e conta os usos. Nasce desligado; a coordenação liga pelo painel.

/** O dia do contador, no horário de Brasília (o limite diário vira à meia-noite daqui, não à de Londres). */
create or replace function interno.assistente_dia() returns date language sql stable as $$
  select (now() at time zone 'America/Sao_Paulo')::date
$$;

create or replace function interno.assistente_config() returns jsonb language sql stable security definer set search_path = interno, pg_temp as $$
  select '{"ligado": false, "por_pessoa": 10, "por_dia": 200}'::jsonb || coalesce((select valor from configuracoes where chave = 'assistente'), '{}'::jsonb)
$$;

/** Para o site: o quadro do assistente aparece? Desligado, ou com a aula de reforço interditada, não. */
create or replace function public.assistente_estado() returns jsonb language sql stable security definer set search_path = interno, pg_temp as $$
  select jsonb_build_object('ligado', coalesce((interno.assistente_config() ->> 'ligado')::boolean, false) and not interno.interditada('reforco'))
$$;

/**
 * Chamada pela função "assistente" com a sessão de quem pergunta, ANTES de chamar o serviço pago: exige conta ativa,
 * respeita a interdição e a pausa de envios, e conta um uso se ainda houver vaga hoje (por pessoa e no total do site).
 */
create or replace function public.assistente_usar() returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); c jsonb := interno.assistente_config(); v_dia date := interno.assistente_dia(); v_total integer; v_meus integer;
begin
  perform interno.aberta('reforco');
  if not coalesce((c ->> 'ligado')::boolean, false) then perform interno.erro('assistente_desligado'); end if;
  if coalesce((select (valor ->> 'pausa')::boolean from configuracoes where chave = 'site'), false) and not interno.voluntario() then
    perform interno.erro('envios_pausados');
  end if;
  -- Uma pergunta de cada vez no site inteiro passa por aqui, para o teto do dia não estourar com pedidos simultâneos.
  perform pg_advisory_xact_lock(hashtext('assistente_uso'));
  select coalesce(sum(usos), 0) into v_total from assistente_uso where dia = v_dia;
  if v_total >= (c ->> 'por_dia')::integer then perform interno.erro('assistente_lotado'); end if;
  select coalesce((select usos from assistente_uso where dia = v_dia and usuario = v), 0) into v_meus;
  if v_meus >= (c ->> 'por_pessoa')::integer then perform interno.erro('assistente_limite'); end if;
  insert into assistente_uso (dia, usuario, usos) values (v_dia, v, 1)
  on conflict (dia, usuario) do update set usos = assistente_uso.usos + 1;
  return jsonb_build_object('ok', true, 'usuario', v, 'restantes', (c ->> 'por_pessoa')::integer - v_meus - 1);
end $$;

/**
 * Para a função "assistente" (só com a chave de serviço): anota se a última pergunta de verdade deu certo e, quando o
 * serviço falhou, devolve o uso à pessoa (ela não perde a vez por um defeito que não é dela).
 */
create or replace function public.assistente_resultado(p jsonb) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v_provedor text := coalesce(p ->> 'provedor', '');
begin
  if not interno.servico() then perform interno.erro('sem_permissao'); end if;
  insert into configuracoes (chave, valor) values ('assistente', jsonb_build_object('ultimo', jsonb_build_object(
    'em', now(), 'ok', coalesce((p ->> 'ok')::boolean, false), 'falha', left(coalesce(p ->> 'falha', ''), 40), 'provedor', left(v_provedor, 20))))
  on conflict (chave) do update set valor = configuracoes.valor || excluded.valor;
  -- O consumo do dia por provedor (quantas respostas e quantas falhas), para o painel mostrar quem está respondendo.
  if v_provedor = any(interno.assistente_provedores_conhecidos()) then
    insert into assistente_provedor_uso (dia, provedor, ok, falhas) values (interno.assistente_dia(), v_provedor, case when coalesce((p ->> 'ok')::boolean, false) then 1 else 0 end, case when coalesce((p ->> 'ok')::boolean, false) then 0 else 1 end)
    on conflict (dia, provedor) do update set ok = assistente_provedor_uso.ok + excluded.ok, falhas = assistente_provedor_uso.falhas + excluded.falhas;
  end if;
  -- Falhas no caminho (provedores que não responderam antes do que respondeu) também contam no dia.
  if jsonb_typeof(p -> 'tentativas') = 'array' then
    insert into assistente_provedor_uso (dia, provedor, ok, falhas)
    select interno.assistente_dia(), t ->> 'id', 0, 1 from jsonb_array_elements(p -> 'tentativas') t
    where t ->> 'id' = any(interno.assistente_provedores_conhecidos()) and coalesce(t ->> 'falha', '') not in ('', 'sem_chave', 'sem_visao', 'desligado')
    on conflict (dia, provedor) do update set falhas = assistente_provedor_uso.falhas + 1;
  end if;
  if not coalesce((p ->> 'ok')::boolean, false) and coalesce(p ->> 'usuario', '') ~ '^[0-9a-f-]{36}$' then
    update assistente_uso set usos = greatest(usos - 1, 0) where dia = interno.assistente_dia() and usuario = (p ->> 'usuario')::uuid;
  end if;
  return jsonb_build_object('ok', true);
end $$;

/** Para a função "assistente" (só com a chave de serviço): guarda o resultado do teste de funcionamento pedido pelo painel. */
create or replace function public.assistente_verificacao(p jsonb) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
begin
  if not interno.servico() then perform interno.erro('sem_permissao'); end if;
  insert into configuracoes (chave, valor) values ('assistente', jsonb_build_object('verificacao', jsonb_build_object(
    'em', now(), 'chave', coalesce((p ->> 'chave')::boolean, false), 'ok', coalesce((p ->> 'ok')::boolean, false),
    'falha', left(coalesce(p ->> 'falha', ''), 40), 'modelo', left(coalesce(p ->> 'modelo', ''), 60),
    -- Um resultado por provedor: chave cadastrada, respondeu ao teste, motivo da falha e o modelo usado. Nunca a chave.
    'provedores', coalesce((select jsonb_agg(jsonb_build_object('id', t ->> 'id', 'chave', coalesce((t ->> 'chave')::boolean, false), 'ok', coalesce((t ->> 'ok')::boolean, false),
                     'falha', left(coalesce(t ->> 'falha', ''), 40), 'modelo', left(coalesce(t ->> 'modelo', ''), 100)))
                   from jsonb_array_elements(case when jsonb_typeof(p -> 'provedores') = 'array' then p -> 'provedores' else '[]'::jsonb end) t
                   where t ->> 'id' = any(interno.assistente_provedores_conhecidos())), '[]'::jsonb))))
  on conflict (chave) do update set valor = configuracoes.valor || excluded.valor;
  return jsonb_build_object('ok', true);
end $$;

/** O quadro do painel: ligado, limites, últimos testes e quanto se usou. Só coordenação e vice (quem responde pela conta paga). */
create or replace function public.assistente_controles() returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare c jsonb := interno.assistente_config(); v_dia date := interno.assistente_dia();
begin
  perform interno.eu();
  if not interno.coord() then perform interno.erro('sem_permissao'); end if;
  return jsonb_build_object(
    'ligado', coalesce((c ->> 'ligado')::boolean, false),
    'por_pessoa', (c ->> 'por_pessoa')::integer,
    'por_dia', (c ->> 'por_dia')::integer,
    'verificacao', c -> 'verificacao',
    'ultimo', c -> 'ultimo',
    'hoje', (select coalesce(sum(usos), 0) from assistente_uso where dia = v_dia),
    'pessoas_hoje', (select count(*) from assistente_uso where dia = v_dia and usos > 0),
    'semana', (select coalesce(sum(usos), 0) from assistente_uso where dia > v_dia - 7),
    'interditado', interno.interditada('reforco'),
    'provedores', interno.assistente_provedores_lista(),
    'uso_provedores', (select coalesce(jsonb_object_agg(provedor, jsonb_build_object('ok', ok, 'falhas', falhas)), '{}'::jsonb) from assistente_provedor_uso where dia = v_dia));
end $$;

/** Liga, desliga e muda os limites. Fica no registro; ligar avisa a liderança (é um serviço pago). */
create or replace function public.assistente_configurar(p jsonb) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare c jsonb := interno.assistente_config(); v_ligado boolean; v_pessoa integer; v_dia integer; v_provedores jsonb;
begin
  perform interno.eu();
  if not interno.coord() then perform interno.erro('sem_permissao'); end if;
  v_ligado := coalesce((p ->> 'ligado')::boolean, (c ->> 'ligado')::boolean);
  v_pessoa := coalesce(nullif(p ->> 'por_pessoa', '')::integer, (c ->> 'por_pessoa')::integer);
  v_dia := coalesce(nullif(p ->> 'por_dia', '')::integer, (c ->> 'por_dia')::integer);
  if v_pessoa not between 1 and 100 then perform interno.erro('invalido:por_pessoa'); end if;
  if v_dia not between 1 and 5000 then perform interno.erro('invalido:por_dia'); end if;
  -- A ordem dos provedores e quais entram: só nomes conhecidos, cada um uma vez. A chave de cada um nunca passa por aqui.
  if jsonb_typeof(p -> 'provedores') = 'array' then
    if exists (select 1 from jsonb_array_elements(p -> 'provedores') t where not (t ->> 'id' = any(interno.assistente_provedores_conhecidos())))
       or (select count(distinct t ->> 'id') from jsonb_array_elements(p -> 'provedores') t) <> jsonb_array_length(p -> 'provedores') then
      perform interno.erro('invalido:provedores');
    end if;
    select jsonb_agg(jsonb_build_object('id', t ->> 'id', 'ligado', coalesce((t ->> 'ligado')::boolean, false))) into v_provedores from jsonb_array_elements(p -> 'provedores') t;
  end if;
  insert into configuracoes (chave, valor) values ('assistente', jsonb_build_object('ligado', v_ligado, 'por_pessoa', v_pessoa, 'por_dia', v_dia) || case when v_provedores is null then '{}'::jsonb else jsonb_build_object('provedores', v_provedores) end)
  on conflict (chave) do update set valor = configuracoes.valor || excluded.valor;
  perform interno.registrar('assistente_configurado', '', jsonb_build_object('ligado', v_ligado, 'por_pessoa', v_pessoa, 'por_dia', v_dia) || case when v_provedores is null then '{}'::jsonb else jsonb_build_object('provedores', v_provedores) end);
  if v_ligado and not coalesce((c ->> 'ligado')::boolean, false) then
    perform interno.avisar_lideranca('O assistente de reforço (serviço de inteligência artificial) foi ligado.', auth.uid());
  end if;
  return public.assistente_controles();
exception when invalid_text_representation then
  perform interno.erro('invalido:limite');
end $$;

-- ───────────────────────────── Conversa da equipe ─────────────────────────────

/** Cada função tem o seu canal. A supervisão acompanha os canais das funções para manter o mural em ordem; o da coordenação, não. */
create or replace function interno.ve_canal(p_canal text) returns boolean language sql stable as $$
  select case
    when p_canal in ('geral', 'pedidos', 'aprendizado') then interno.voluntario()
    when p_canal = 'coordenacao' then interno.coord()
    when p_canal in ('supervisao', 'curadoria', 'mediacao', 'educacao', 'revisao', 'traducao', 'jornalismo', 'mentoria', 'design', 'marketing', 'desenvolvimento') then interno.supervisor() or interno.tem(p_canal)
    else false end
$$;

/**
 * O texto é cifrado no navegador antes de sair do aparelho, com a chave do grupo do departamento correspondente (a mesma das
 * Conversas). O banco guarda só "c2.<versão>.<vetor>.<texto cifrado>": quem ler a tabela não lê o mural.
 */
create or replace function public.equipe_canais() returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
begin
  perform interno.eu();
  if not interno.voluntario() then perform interno.erro('sem_permissao'); end if;
  return jsonb_build_object(
    'sala', coalesce((select valor ->> 'sala' from configuracoes where chave = 'equipe'), ''),
    'canais', (select coalesce(jsonb_agg(c order by n), '[]'::jsonb)
               from unnest(array['geral', 'pedidos', 'aprendizado', 'coordenacao', 'supervisao', 'curadoria', 'mediacao', 'educacao', 'revisao', 'traducao', 'jornalismo', 'mentoria', 'design', 'marketing', 'desenvolvimento']) with ordinality as t(c, n)
               where interno.ve_canal(c)),
    'conversas', (select coalesce(jsonb_object_agg(c, interno.canal_conversa(c)), '{}'::jsonb)
                  from unnest(array['geral', 'pedidos', 'aprendizado', 'coordenacao', 'supervisao', 'curadoria', 'mediacao', 'educacao', 'revisao', 'traducao', 'jornalismo', 'mentoria', 'design', 'marketing', 'desenvolvimento']) as t(c)
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
        'id', m.id, 'autor', coalesce(f.nome, ''), 'autor_id', m.autor, 'meu', m.autor is not null and m.autor = auth.uid(), 'para', m.para, 'corpo', m.corpo,
        'resolvido', m.resolvido, 'criado_em', m.criado_em,
        'respostas', coalesce((select jsonb_agg(jsonb_build_object('id', r.id, 'autor', coalesce(g.nome, ''), 'autor_id', r.autor, 'meu', r.autor is not null and r.autor = auth.uid(), 'corpo', r.corpo, 'criado_em', r.criado_em) order by r.criado_em)
                               from equipe_mensagens r left join perfis g on g.id = r.autor where r.resposta_a = m.id), '[]'::jsonb)) as j
      from equipe_mensagens m left join perfis f on f.id = m.autor
      where m.canal = p_canal and m.resposta_a is null
      order by m.criado_em desc limit 60) x);
end $$;

create or replace function public.equipe_escrever(p_canal text, p_corpo text, p_resposta_a uuid default null, p_para text default null) returns jsonb
language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); v_id uuid; v_para text := nullif(btrim(coalesce(p_para, '')), ''); v_versao integer;
begin
  if not interno.ve_canal(coalesce(p_canal, '')) then perform interno.erro('sem_permissao'); end if;
  perform interno.limite('equipe', 120, 60);
  -- O banco recusa texto aberto: só entra o que já chega cifrado com a chave atual do grupo do departamento.
  v_versao := interno.chat_versao_valida(interno.canal_conversa(p_canal), p_corpo);
  if p_resposta_a is not null then
    if not exists (select 1 from equipe_mensagens where id = p_resposta_a and canal = p_canal and resposta_a is null) then perform interno.erro('nao_encontrado'); end if;
    v_para := null;
  elsif p_canal = 'pedidos' then
    if v_para is null or v_para not in ('coordenacao', 'supervisao', 'curadoria', 'mediacao', 'educacao', 'revisao', 'traducao', 'jornalismo', 'mentoria', 'design', 'marketing', 'desenvolvimento') then perform interno.erro('invalido:para'); end if;
  else
    v_para := null;
  end if;
  insert into equipe_mensagens (canal, resposta_a, autor, para, corpo, versao) values (p_canal, p_resposta_a, v, v_para, p_corpo, v_versao) returning id into v_id;
  return jsonb_build_object('id', v_id);
end $$;

/** Marcar um pedido como resolvido: quem escreveu, ou quem cuida do mural (coordenação e supervisão), para a fila andar. */
create or replace function public.equipe_marcar(p_id uuid, p_resolvido boolean) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu();
begin
  update equipe_mensagens set resolvido = coalesce(p_resolvido, true)
  where id = p_id and resposta_a is null and (autor = v or (interno.supervisor() and interno.ve_canal(canal)));
  if not found then perform interno.erro('nao_encontrado'); end if;
  return jsonb_build_object('ok', true);
end $$;

/**
 * Apagar uma publicação do mural da equipe: quem escreveu, ou quem modera (coordenação e supervisão, nos canais que
 * enxerga). Apagar o que é de outra pessoa fica no registro de atividades, sem o texto.
 */
create or replace function public.equipe_apagar(p_id uuid) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); m equipe_mensagens;
begin
  select * into m from equipe_mensagens where id = p_id;
  if not found or not (coalesce(m.autor = v, false) or (interno.supervisor() and interno.ve_canal(m.canal))) then perform interno.erro('nao_encontrado'); end if;
  delete from equipe_mensagens where id = p_id;
  if m.autor is distinct from v then perform interno.registrar('equipe_mensagem_apagada', coalesce(m.autor::text, ''), jsonb_build_object('canal', m.canal)); end if;
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
  select interno.aberta('materiais');
  select coalesce(jsonb_agg(jsonb_build_object('id', m.id, 'tipo', m.tipo, 'titulo', m.titulo, 'descricao', m.descricao, 'campanha', m.campanha,
    -- O arquivo enviado pelo próprio formulário: o endereço aparece sozinho quando a publicação o põe no site.
    'url', coalesce(nullif(m.url, ''), nullif(a.destino, ''), ''),
    'publicado', m.publicado, 'ordem', m.ordem, 'criado_em', m.criado_em,
    'credito_autor', m.credito_autor, 'credito_origem', m.credito_origem, 'licenca', m.licenca,
    'candidatura', m.candidatura, 'candidatura_responsavel', m.candidatura_responsavel,
    'arquivo', case when interno.voluntario() then m.arquivo end, 'arquivo_caminho', case when interno.voluntario() then a.caminho end,
    'arquivo_status', case when interno.voluntario() then a.status end,
    'estado', case when m.publicado then 'publicado' when a.status in ('aprovado', 'publicado') then 'aprovado' else 'rascunho' end)
    order by m.ordem, m.criado_em desc), '[]'::jsonb)
  from materiais m left join arquivos a on a.id = m.arquivo
  where m.publicado or interno.curador() or interno.tem('design') or interno.tem('marketing')
$$;

/** Curadoria, design e marketing preparam o material; só a coordenação (ou a vice-coordenação) põe no ar. */
create or replace function public.material_salvar(p jsonb) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare
  v uuid := interno.eu(); v_id uuid := nullif(p ->> 'id', '')::uuid; v_url text := btrim(coalesce(p ->> 'url', ''));
  v_tipo text := coalesce(p ->> 'tipo', ''); v_publicar boolean := coalesce((p ->> 'publicado')::boolean, false) and interno.coord();
  v_arquivo uuid; a arquivos; v_cand boolean := coalesce((p ->> 'candidatura')::boolean, false); v_votacao date;
  v_autor text; v_origem text; v_licenca text := btrim(coalesce(p ->> 'licenca', ''));
begin
  if not (interno.curador() or interno.tem('design') or interno.tem('marketing')) then perform interno.erro('sem_permissao'); end if;
  if v_tipo not in ('zine', 'panfleto', 'cartaz', 'banner', 'video', 'texto') then perform interno.erro('invalido:tipo'); end if;
  begin
    v_arquivo := nullif(p ->> 'arquivo', '')::uuid;
    v_votacao := nullif(p ->> 'candidatura_votacao', '')::date;
  exception when others then
    perform interno.erro('invalido:dados');
  end;
  if v_arquivo is not null then
    select * into a from arquivos where id = v_arquivo and (dono = v or interno.coord());
    if not found then perform interno.erro('invalido:arquivo'); end if;
    if v_url = '' then v_url := a.destino; end if;
  end if;
  if v_url <> '' and ((v_url !~ '^https://[^[:space:]]+$' and v_url !~ '^/[A-Za-z0-9/._-]+$') or char_length(v_url) > 500) then perform interno.erro('invalido:url'); end if;
  if v_url = '' and v_arquivo is null then perform interno.erro('invalido:url'); end if;
  -- Crédito e licença: quem fez, de onde veio e com que licença. Sem isso o material não é guardado.
  v_autor := interno.txt(p ->> 'credito_autor', 'credito_autor', 2, 160);
  v_origem := interno.txt(p ->> 'credito_origem', 'credito_origem', 2, 200);
  if v_licenca not in ('cc-by-sa', 'cc-by', 'cc0', 'dominio-publico', 'autorizacao', 'outra') then perform interno.erro('invalido:licenca'); end if;
  -- Apoio a candidatura (lei eleitoral): quem responde pelo material, sem pagamento para impulsionar e nada de novidade no dia da votação.
  if v_cand then
    if char_length(btrim(coalesce(p ->> 'candidatura_responsavel', ''))) < 5 then perform interno.erro('invalido:candidatura_responsavel'); end if;
    if not coalesce((p ->> 'candidatura_sem_impulsionamento')::boolean, false) then perform interno.erro('invalido:candidatura_impulsionamento'); end if;
    if v_publicar and v_votacao is not null and current_date = v_votacao then perform interno.erro('candidatura_dia_da_votacao'); end if;
  end if;
  if v_publicar and v_url = '' then perform interno.erro('arquivo_nao_publicado'); end if;
  if v_id is null then
    insert into materiais (tipo, titulo, descricao, campanha, url, publicado, ordem, criado_por, arquivo, credito_autor, credito_origem, licenca,
                           candidatura, candidatura_responsavel, candidatura_sem_impulsionamento, candidatura_votacao)
    values (v_tipo, interno.txt(p ->> 'titulo', 'titulo', 3, 120), interno.txt(p ->> 'descricao', 'descricao', 0, 600), interno.txt(p ->> 'campanha', 'campanha', 0, 80),
            v_url, v_publicar, coalesce((p ->> 'ordem')::int, 0), v, v_arquivo, v_autor, v_origem, v_licenca,
            v_cand, case when v_cand then interno.txt(p ->> 'candidatura_responsavel', 'candidatura_responsavel', 5, 200) else '' end,
            v_cand and coalesce((p ->> 'candidatura_sem_impulsionamento')::boolean, false), case when v_cand then v_votacao end)
    returning id into v_id;
  else
    update materiais set tipo = v_tipo, titulo = interno.txt(p ->> 'titulo', 'titulo', 3, 120), descricao = interno.txt(p ->> 'descricao', 'descricao', 0, 600),
      campanha = interno.txt(p ->> 'campanha', 'campanha', 0, 80), url = v_url, ordem = coalesce((p ->> 'ordem')::int, 0),
      publicado = case when interno.coord() then v_publicar else false end, arquivo = v_arquivo,
      credito_autor = v_autor, credito_origem = v_origem, licenca = v_licenca, candidatura = v_cand,
      candidatura_responsavel = case when v_cand then interno.txt(p ->> 'candidatura_responsavel', 'candidatura_responsavel', 5, 200) else '' end,
      candidatura_sem_impulsionamento = v_cand and coalesce((p ->> 'candidatura_sem_impulsionamento')::boolean, false),
      candidatura_votacao = case when v_cand then v_votacao end
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

/** As horas da pessoa, já com o que a plataforma contou desde a última vez, e o pedido de certificado mais recente. */
create or replace function public.horas_minhas() returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu();
begin
  perform interno.horas_apurar(v);
  return jsonb_build_object(
    'confirmadas', coalesce((select sum(h.horas) from horas h where h.usuario = v and h.status = 'confirmada'), 0),
    'livres', coalesce((select sum(h.horas) from horas h where h.usuario = v and h.status = 'confirmada' and h.certificado is null), 0),
    'plataforma', coalesce((select sum(h.horas) from horas h where h.usuario = v and h.status = 'confirmada' and h.certificado is null and h.origem = 'plataforma'), 0),
    'pendentes', coalesce((select sum(h.horas) from horas h where h.usuario = v and h.status = 'pendente'), 0),
    'primeiro_livre', (select min(h.dia) from horas h where h.usuario = v and h.status in ('confirmada', 'pendente') and h.certificado is null),
    'lista', coalesce((select jsonb_agg(jsonb_build_object('id', h.id, 'dia', h.dia, 'horas', h.horas, 'atividade', h.atividade, 'status', h.status, 'origem', h.origem, 'certificado', h.certificado is not null) order by h.dia desc, h.criado_em desc)
                       from (select * from horas where usuario = v order by dia desc, criado_em desc limit 400) h), '[]'::jsonb),
    'pedido', (select interno.pedido_json(p) from certificado_pedidos p
               where p.usuario = v and (p.status = 'pendente' or (p.status in ('atendido', 'recusado') and p.decidido_em > now() - interval '60 days'))
               order by p.criado_em desc limit 1));
end $$;

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
     or not exists (select 1 from papeis r join perfis f on f.id = r.usuario where r.usuario = v_educador and r.papel in ('educacao', 'educacao_secundaria') and not f.suspenso) then perform interno.erro('invalido:educador'); end if;
  if v_vice is null then
    select r.usuario into v_vice from papeis r join perfis f on f.id = r.usuario
    where r.papel = 'vice' and not f.suspenso and r.usuario not in (v_usuario, v_educador, v) order by f.visto_em desc limit 1;
  end if;
  if v_vice is null or v_vice in (v_usuario, v_educador, v)
     or not exists (select 1 from papeis r join perfis f on f.id = r.usuario where r.usuario = v_vice and r.papel = 'vice' and not f.suspenso) then perform interno.erro('falta_vice'); end if;
  perform interno.horas_apurar(v_usuario);
  select coalesce(sum(horas), 0) into v_horas from horas where usuario = v_usuario and status = 'confirmada' and certificado is null and dia between v_inicio and v_fim;
  if v_horas <= 0 then perform interno.erro('sem_horas'); end if;
  v_assinaturas := jsonb_build_array(
    jsonb_build_object('id', v_educador, 'nome', interno.nome_de_assinar(v_educador), 'papel', 'educacao',
                       'disciplina', (select min(disciplina) from papeis where usuario = v_educador and papel in ('educacao', 'educacao_secundaria')), 'confirmou_em', null),
    jsonb_build_object('id', v_vice, 'nome', interno.nome_de_assinar(v_vice), 'papel', 'vice', 'disciplina', null, 'confirmou_em', null),
    jsonb_build_object('id', v, 'nome', interno.nome_de_assinar(v), 'papel', 'coordenacao', 'disciplina', null, 'confirmou_em', null));
  insert into certificados (id, codigo, usuario, nome, horas, inicio, fim, atividades, testemunhas)
  values (v_id, upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 12)), v_usuario, v_nome, v_horas, v_inicio, v_fim, interno.txt(p ->> 'atividades', 'atividades', 10, 700), v_assinaturas);
  update horas set certificado = v_id where usuario = v_usuario and status = 'confirmada' and certificado is null and dia between v_inicio and v_fim;
  perform interno.avisar(v_educador, 'Há um certificado de horas de voluntariado esperando a sua assinatura. Abra "Horas e certificados" no painel.');
  perform interno.avisar(v_vice, 'Há um certificado de horas de voluntariado esperando a sua assinatura. Abra "Horas e certificados" no painel.');
  -- Se a pessoa tinha pedido o certificado, o pedido está atendido: ela fica sabendo que o processo começou.
  update certificado_pedidos set status = 'atendido', certificado = v_id, decidido_por = v, decidido_em = now() where usuario = v_usuario and status = 'pendente';
  if found then
    perform interno.avisar(v_usuario, 'Seu pedido de certificado foi atendido: o processo está aberto, com ' || interno.horas_texto(v_horas) || ', e espera as assinaturas. Você é avisado quando ele for emitido.');
  end if;
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
    perform interno.avisar((x ->> 'id')::uuid, 'Um certificado de horas já tem as assinaturas do educador e da coordenação pedagógica. Falta a sua para emitir.')
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
  if not found then
    -- Certificado de participação de quem estuda (começa com A).
    return coalesce((select jsonb_build_object('encontrado', true, 'valido', true, 'aluno', true, 'nome', a.nome, 'trilha', a.trilha_titulo, 'aulas', a.aulas, 'emitido_em', a.emitido_em)
                     from certificados_alunos a where a.codigo = v_codigo), jsonb_build_object('encontrado', false));
  end if;
  if c.status = 'cancelado' then return jsonb_build_object('encontrado', true, 'valido', false); end if;
  return jsonb_build_object('encontrado', true, 'valido', true, 'nome', c.nome, 'horas', c.horas, 'inicio', c.inicio, 'fim', c.fim,
    'atividades', c.atividades, 'emitido_em', c.emitido_em, 'impressao', interno.certificado_json(c) ->> 'impressao',
    'testemunhas', (select coalesce(jsonb_agg(x ->> 'nome' order by n), '[]'::jsonb) from jsonb_array_elements(c.testemunhas) with ordinality as e(x, n) where x ->> 'confirmou_em' is not null));
end $$;

-- ───────────────────────────── Horas que a plataforma conta sozinha ─────────────────────────────
--
-- O trabalho feito dentro do painel deixa rastro: a aula que a curadoria aprovou, o parecer dado, o pedido de reforço
-- concluído, o episódio que foi ao ar. A plataforma transforma esse rastro em horas, por uma tabela que a coordenação
-- ajusta (configuracoes, chave 'horas_pesos'). Cada trabalho conta uma vez, no dia em que terminou, até 12 horas por dia
-- somando tudo, e entra já confirmado: o registro é a prova. A coordenação pode desconsiderar uma linha enquanto ela não
-- estiver em certificado.
-- O que a pessoa faz fora do painel continua sendo registrado à mão e conferido pela coordenação.

/** A tabela padrão: quanto vale, em horas, cada tipo de trabalho. "grupo" é como ele aparece no resumo do certificado. */
create or replace function interno.horas_tabela() returns jsonb language sql immutable as $$
  select '[
    {"chave": "aula", "nome": "Aula escrita e aprovada", "grupo": "aulas escritas e aprovadas", "padrao": 4},
    {"chave": "aprendizado", "nome": "Participação no aprendizado interno", "grupo": "aprendizado interno", "padrao": 0.5},
    {"chave": "artigo", "nome": "Artigo do jornal aprovado", "grupo": "artigos do jornal", "padrao": 3},
    {"chave": "checagem", "nome": "Checagem aprovada", "grupo": "checagens de fatos", "padrao": 3},
    {"chave": "traducao", "nome": "Tradução aprovada", "grupo": "traduções", "padrao": 3},
    {"chave": "memorial", "nome": "Entrada do memorial aprovada", "grupo": "entradas do memorial", "padrao": 2},
    {"chave": "debate", "nome": "Debate aprovado", "grupo": "debates", "padrao": 2},
    {"chave": "video", "nome": "Vídeo aprovado", "grupo": "vídeos", "padrao": 2},
    {"chave": "verbete", "nome": "Verbete aprovado", "grupo": "verbetes", "padrao": 1.5},
    {"chave": "obra", "nome": "Obra incluída no acervo", "grupo": "obras incluídas no acervo", "padrao": 1},
    {"chave": "frase", "nome": "Frase aprovada", "grupo": "frases", "padrao": 0.2},
    {"chave": "correcao", "nome": "Correção aceita", "grupo": "correções aceitas", "padrao": 0.5},
    {"chave": "sugestao", "nome": "Sugestão aceita", "grupo": "sugestões aceitas", "padrao": 0.3},
    {"chave": "parecer", "nome": "Parecer de revisão", "grupo": "pareceres de revisão", "padrao": 0.5},
    {"chave": "curadoria", "nome": "Decisão de curadoria", "grupo": "decisões de curadoria", "padrao": 0.3},
    {"chave": "triagem", "nome": "Envio lido na triagem", "grupo": "envios lidos na triagem", "padrao": 0.1},
    {"chave": "moderacao", "nome": "Decisão de moderação", "grupo": "decisões de moderação", "padrao": 0.1},
    {"chave": "reforco", "nome": "Aula de reforço concluída", "grupo": "aulas de reforço", "padrao": 1.5},
    {"chave": "podcast_producao", "nome": "Episódio de podcast produzido", "grupo": "episódios de podcast produzidos", "padrao": 4},
    {"chave": "podcast_edicao", "nome": "Episódio de podcast editado", "grupo": "episódios de podcast editados", "padrao": 3},
    {"chave": "podcast_supervisao", "nome": "Episódio de podcast supervisionado", "grupo": "episódios de podcast supervisionados", "padrao": 1},
    {"chave": "arte", "nome": "Arte entregue a pedido da equipe", "grupo": "artes entregues", "padrao": 1.5},
    {"chave": "boletim", "nome": "Edição do boletim enviada", "grupo": "edições do boletim", "padrao": 2},
    {"chave": "avulso", "nome": "Material avulso aprovado", "grupo": "materiais avulsos", "padrao": 2},
    {"chave": "temas", "nome": "Temas de aulas futuras aceitos", "grupo": "temas de aulas futuras", "padrao": 0.3},
    {"chave": "videoaula", "nome": "Aula em vídeo aprovada", "grupo": "aulas em vídeo", "padrao": 3}
  ]'::jsonb
$$;

/** Quanto vale um tipo de trabalho agora: o que a coordenação ajustou ou, sem ajuste, o padrão. */
create or replace function interno.horas_peso(p_chave text) returns numeric language sql stable security definer set search_path = interno, pg_temp as $$
  select coalesce((select (valor ->> p_chave)::numeric from configuracoes where chave = 'horas_pesos' and valor ? p_chave),
                  (select (x ->> 'padrao')::numeric from jsonb_array_elements(interno.horas_tabela()) x where x ->> 'chave' = p_chave), 0)
$$;

/** "3,5 h", como sai no painel e no certificado. */
create or replace function interno.horas_texto(p numeric) returns text language sql immutable as $$
  select replace(trim_scale(round(coalesce(p, 0), 1))::text, '.', ',') || ' h'
$$;

/** O dia de um trabalho, pelo relógio de Brasília. */
create or replace function interno.dia_de(p timestamptz) returns date language sql immutable as $$
  select (p at time zone 'America/Sao_Paulo')::date
$$;

/**
 * Põe em "horas" o trabalho da pessoa que a plataforma ainda não contou. Roda sempre que alguém olha as horas dela
 * (ela mesma, a coordenação ao ver o pedido, o coordenador ao abrir o certificado): não depende de agendador.
 * Conta o que terminou nos últimos 400 dias, a janela das horas registradas à mão.
 */
create or replace function interno.horas_apurar(p_usuario uuid) returns void language plpgsql security definer set search_path = interno, pg_temp as $$
declare r record; v_peso numeric; v_livre numeric; v_dia date;
begin
  if p_usuario is null or not exists (select 1 from termos_adesao where usuario = p_usuario) then return; end if;
  for r in
    select t.fonte, t.chave, t.quando, t.titulo from (
      -- O que a pessoa escreveu, sozinha ou junto, e outra pessoa aprovou: aulas, artigos, traduções, verbetes…
      select c.tipo || ':' || c.id as fonte, c.tipo as chave, c.revisado_em as quando, c.titulo
      from contribuicoes c
      where c.status in ('aprovada', 'publicada', 'resolvida') and c.revisado_em is not null and c.revisado_por is distinct from p_usuario
        and (c.autor = p_usuario or exists (select 1 from colaboradores k where k.contribuicao = c.id and k.usuario = p_usuario))
      union all
      -- Pareceres: um por contribuição, por mais que a pessoa volte a ela.
      select 'parecer:' || p.contribuicao, 'parecer', min(p.criado_em), min(c.titulo)
      from pareceres p join contribuicoes c on c.id = p.contribuicao
      where p.autor = p_usuario and c.autor is distinct from p_usuario
      group by p.contribuicao
      union all
      -- Decisões da curadoria e leituras da triagem: o registro de atividades guarda quem decidiu. A própria contribuição não conta.
      select case when a.acao like 'triagem%' then 'triagem:' else 'curadoria:' end || (a.detalhes ->> 'id'),
             case when a.acao like 'triagem%' then 'triagem' else 'curadoria' end, min(a.criado_em), min(a.alvo)
      from auditoria a
      where a.quem = p_usuario and a.acao in ('contribuicao_aprovada', 'contribuicao_recusada', 'triagem_liberada', 'triagem_barrada') and a.detalhes ? 'id'
        and not exists (select 1 from contribuicoes c where c.id::text = a.detalhes ->> 'id' and c.autor = p_usuario)
      group by 1, 2
      union all
      select 'moderacao:' || a.id, 'moderacao', a.criado_em, ''
      from auditoria a
      where a.quem = p_usuario and a.acao in ('comunidade_ocultar', 'comunidade_mostrar', 'comunidade_trancar', 'comunidade_destrancar', 'anuncio_aprovado', 'anuncio_recusado')
      union all
      select 'boletim:' || a.id, 'boletim', a.criado_em, a.alvo from auditoria a where a.quem = p_usuario and a.acao = 'boletim_enviado'
      union all
      select 'reforco:' || f.id, 'reforco', f.atendido_em, f.assunto from reforco f
      where f.mentor = p_usuario and f.status = 'atendido' and f.atendido_em is not null and f.autor <> p_usuario
      union all
      -- Podcast: quem produziu, quem editou o áudio e quem aprovou um episódio que foi ao ar.
      select 'podcast_producao:' || e.id, 'podcast_producao', e.publicado_em, e.titulo from podcast_episodios e
      where e.status = 'publicado' and e.publicado_em is not null and coalesce(e.responsavel, e.enviado_por) = p_usuario
      union all
      select 'podcast_edicao:' || e.id, 'podcast_edicao', e.publicado_em, e.titulo from podcast_episodios e
      where e.status = 'publicado' and e.publicado_em is not null and coalesce(e.responsavel, e.enviado_por) is distinct from p_usuario
        and exists (select 1 from podcast_arquivos f where f.episodio = e.id and f.enviado_por = p_usuario and f.tipo in ('editado', 'final'))
      union all
      select 'podcast_supervisao:' || e.id, 'podcast_supervisao', e.aprovado_em, e.titulo from podcast_episodios e
      where e.status = 'publicado' and e.aprovado_em is not null and e.aprovado_por = p_usuario and coalesce(e.responsavel, e.enviado_por) is distinct from p_usuario
      union all
      select 'arte:' || d.id, 'arte', d.feito_em, d.texto from podcast_pedidos d
      where d.atendido_por = p_usuario and d.status = 'feito' and d.feito_em is not null and d.pedido_por is distinct from p_usuario
      union all
      -- Aula em vídeo aprovada por outra pessoa.
      select 'videoaula:' || a.id, 'videoaula', a.revisado_em, a.titulo from videoaulas a
      where a.autor = p_usuario and a.status = 'aprovada' and a.revisado_em is not null and a.revisado_por is distinct from p_usuario
      union all
      -- Aprendizado interno: cada dia em que a pessoa perguntou ou respondeu no canal, se aceitou o aprendizado.
      select 'aprendizado:' || interno.dia_de(m.criado_em)::text, 'aprendizado', min(m.criado_em), '' from equipe_mensagens m
      where m.canal = 'aprendizado' and m.autor = p_usuario and exists (select 1 from perfis f where f.id = p_usuario and f.aprendizado_em is not null and m.criado_em >= f.aprendizado_em)
      group by interno.dia_de(m.criado_em)
    ) t
    where t.quando > now() - interval '400 days'
      and not exists (select 1 from horas h where h.usuario = p_usuario and h.fonte = t.fonte)
    order by t.quando
  loop
    v_peso := round(interno.horas_peso(r.chave), 1);
    if v_peso <= 0 then continue; end if;
    v_dia := interno.dia_de(r.quando);
    v_livre := 12 - coalesce((select sum(horas) from horas where usuario = p_usuario and dia = v_dia and status <> 'recusada'), 0);
    v_peso := least(v_peso, v_livre);
    if v_peso < 0.1 then continue; end if;
    insert into horas (usuario, dia, horas, atividade, status, origem, fonte)
    values (p_usuario, v_dia, v_peso,
            left((select x ->> 'nome' from jsonb_array_elements(interno.horas_tabela()) x where x ->> 'chave' = r.chave)
                 || case when btrim(coalesce(r.titulo, '')) <> '' then ': "' || left(regexp_replace(btrim(r.titulo), '\s+', ' ', 'g'), 200) || '"' else '' end, 300),
            'confirmada', 'plataforma', r.fonte)
    on conflict do nothing;
  end loop;
end $$;

/** O texto sugerido para o campo "atividades" do certificado: o que a pessoa fez no período, agrupado por tipo. */
create or replace function interno.horas_resumo(p_usuario uuid, p_inicio date, p_fim date) returns text language plpgsql stable security definer set search_path = interno, pg_temp as $$
declare v text;
begin
  select string_agg(case when g.chave is null then 'outras atividades, registradas e conferidas pela coordenação (' || interno.horas_texto(g.horas) || ')'
                         else g.grupo || ': ' || g.n || ' (' || interno.horas_texto(g.horas) || ')' end, '; ' order by g.ordem)
  into v
  from (select t.x ->> 'chave' as chave, t.x ->> 'grupo' as grupo, coalesce(t.n, 999) as ordem, count(*) as n, sum(h.horas) as horas
        from horas h
        left join lateral (select x, n from jsonb_array_elements(interno.horas_tabela()) with ordinality as e(x, n)
                           where h.origem = 'plataforma' and x ->> 'chave' = split_part(h.fonte, ':', 1)) t on true
        where h.usuario = p_usuario and h.status = 'confirmada' and h.certificado is null and h.dia between p_inicio and p_fim
        group by 1, 2, 3) g;
  if v is null then return ''; end if;
  return left(upper(left(v, 1)) || substr(v, 2) || '.', 700);
end $$;

create or replace function interno.pedido_json(p interno.certificado_pedidos) returns jsonb language sql stable as $$
  select jsonb_build_object('id', p.id, 'usuario', p.usuario, 'inicio', p.inicio, 'fim', p.fim, 'mensagem', p.mensagem, 'status', p.status,
    'nota', p.nota, 'criado_em', p.criado_em, 'decidido_em', p.decidido_em)
$$;

/** A tabela de horas, para todo mundo da equipe ver quanto vale cada trabalho. */
create or replace function public.horas_pesos() returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
begin
  perform interno.eu();
  if not interno.voluntario() then perform interno.erro('sem_permissao'); end if;
  return (select jsonb_agg(jsonb_build_object('chave', x ->> 'chave', 'nome', x ->> 'nome', 'padrao', (x ->> 'padrao')::numeric, 'horas', interno.horas_peso(x ->> 'chave')) order by n)
          from jsonb_array_elements(interno.horas_tabela()) with ordinality as e(x, n));
end $$;

/** Só o coordenador ajusta a tabela. Vale para o trabalho contado daqui em diante; o que já foi contado fica como está. */
create or replace function public.horas_pesos_salvar(p jsonb) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v_novo jsonb := '{}'::jsonb; r record; v_valor numeric;
begin
  perform interno.eu();
  if not interno.lider() then perform interno.erro('sem_permissao'); end if;
  if jsonb_typeof(p) is distinct from 'object' then perform interno.erro('invalido:tabela'); end if;
  for r in select key, value from jsonb_each(p) loop
    if not exists (select 1 from jsonb_array_elements(interno.horas_tabela()) x where x ->> 'chave' = r.key) then perform interno.erro('invalido:tabela'); end if;
    begin
      v_valor := round((r.value #>> '{}')::numeric, 1);
    exception when others then perform interno.erro('invalido:' || r.key);
    end;
    if v_valor is null or v_valor < 0 or v_valor > 12 then perform interno.erro('invalido:' || r.key); end if;
    v_novo := v_novo || jsonb_build_object(r.key, v_valor);
  end loop;
  insert into configuracoes (chave, valor) values ('horas_pesos', v_novo) on conflict (chave) do update set valor = configuracoes.valor || excluded.valor;
  perform interno.registrar('horas_pesos_salvos', '', v_novo);
  return public.horas_pesos();
end $$;

/** Coordenação e vice desconsideram (ou voltam a considerar) uma linha contada pela plataforma, se ela não estiver em certificado. */
create or replace function public.horas_considerar(p_id uuid, p_considerar boolean) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); h horas;
begin
  if not interno.coord() then perform interno.erro('sem_permissao'); end if;
  select * into h from horas where id = p_id and origem = 'plataforma' and certificado is null and usuario <> v for update;
  if not found or h.status = (case when coalesce(p_considerar, false) then 'confirmada' else 'recusada' end) then perform interno.erro('nao_encontrado'); end if;
  if coalesce(p_considerar, false)
     and coalesce((select sum(horas) from horas where usuario = h.usuario and dia = h.dia and status <> 'recusada'), 0) + h.horas > 12 then perform interno.erro('invalido:horas'); end if;
  update horas set status = case when coalesce(p_considerar, false) then 'confirmada' else 'recusada' end, conferido_por = v where id = p_id;
  perform interno.registrar(case when coalesce(p_considerar, false) then 'horas_consideradas' else 'horas_desconsideradas' end, p_id::text);
  return jsonb_build_object('ok', true);
end $$;

/** O voluntário pede o certificado de um período. A coordenação e a vice são avisadas no painel e por e-mail. */
create or replace function public.certificado_pedir(p_inicio date, p_fim date, p_mensagem text) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); v_livres numeric; v_pendentes numeric; v_id uuid; v_nome text; v_mensagem text := interno.txt(p_mensagem, 'mensagem', 0, 1000);
begin
  if not interno.voluntario() then perform interno.erro('sem_permissao'); end if;
  if not exists (select 1 from termos_adesao where usuario = v) then perform interno.erro('falta_termo'); end if;
  if p_inicio is null or p_fim is null or p_fim < p_inicio or p_fim > current_date + 1 or p_inicio < current_date - 800 then perform interno.erro('invalido:periodo'); end if;
  if exists (select 1 from certificado_pedidos where usuario = v and status = 'pendente') then perform interno.erro('ja_pediu'); end if;
  perform interno.limite('certificado_pedido', 5, 1440);
  perform interno.horas_apurar(v);
  select coalesce(sum(horas) filter (where status = 'confirmada'), 0), coalesce(sum(horas) filter (where status = 'pendente'), 0) into v_livres, v_pendentes
  from horas where usuario = v and certificado is null and dia between p_inicio and p_fim;
  if v_livres + v_pendentes <= 0 then perform interno.erro('sem_horas'); end if;
  insert into certificado_pedidos (usuario, inicio, fim, mensagem) values (v, p_inicio, p_fim, v_mensagem) returning id into v_id;
  v_nome := (select nome from perfis where id = v);
  perform interno.avisar_lideranca(left(v_nome, 60) || ' pediu um certificado de horas: ' || interno.horas_texto(v_livres + v_pendentes) || ', de '
    || to_char(p_inicio, 'DD/MM/YYYY') || ' a ' || to_char(p_fim, 'DD/MM/YYYY') || '. Abra "Horas e certificados" no painel.', v);
  perform interno.email_lideranca('certificado_pedido', 'Pedido de certificado de horas: ' || left(v_nome, 60),
    v_nome || ' pediu um certificado de horas de voluntariado, de ' || to_char(p_inicio, 'DD/MM/YYYY') || ' a ' || to_char(p_fim, 'DD/MM/YYYY') || E'.\n\n'
    || interno.horas_texto(v_livres) || ' já confirmadas' || case when v_pendentes > 0 then ' e ' || interno.horas_texto(v_pendentes) || ' esperando conferência' else '' end || E'.\n\n'
    || 'Veja o pedido e abra o processo no painel: ' || interno.endereco() || '/pt/painel?aba=horas');
  perform interno.registrar('certificado_pedido', v::text, jsonb_build_object('horas', v_livres + v_pendentes));
  return jsonb_build_object('id', v_id, 'livres', v_livres, 'pendentes', v_pendentes);
end $$;

create or replace function public.certificado_pedido_cancelar(p_id uuid) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu();
begin
  update certificado_pedidos set status = 'cancelado', decidido_em = now() where id = p_id and usuario = v and status = 'pendente';
  if not found then perform interno.erro('nao_encontrado'); end if;
  return jsonb_build_object('ok', true);
end $$;

/**
 * Os pedidos em aberto, para a coordenação e a vice: o que a pessoa pediu, as horas do período (as que a plataforma contou,
 * as registradas à mão, as que ainda esperam conferência) e o resumo sugerido para o certificado.
 */
create or replace function public.certificado_pedidos() returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); r record;
begin
  if not interno.coord() then perform interno.erro('sem_permissao'); end if;
  for r in select distinct usuario from certificado_pedidos where status = 'pendente' and usuario <> v loop
    perform interno.horas_apurar(r.usuario);
  end loop;
  return (
    select coalesce(jsonb_agg(interno.pedido_json(p) || jsonb_build_object(
      'nome', f.nome,
      'nome_completo', (select nome_completo from termos_adesao where usuario = p.usuario),
      'livres', coalesce((select sum(h.horas) from horas h where h.usuario = p.usuario and h.status = 'confirmada' and h.certificado is null and h.dia between p.inicio and p.fim), 0),
      'pendentes', coalesce((select sum(h.horas) from horas h where h.usuario = p.usuario and h.status = 'pendente' and h.dia between p.inicio and p.fim), 0),
      'resumo', interno.horas_resumo(p.usuario, p.inicio, p.fim),
      'horas', coalesce((select jsonb_agg(jsonb_build_object('id', h.id, 'dia', h.dia, 'horas', h.horas, 'atividade', h.atividade, 'status', h.status, 'origem', h.origem) order by h.dia, h.criado_em)
                         from horas h where h.usuario = p.usuario and h.certificado is null and h.dia between p.inicio and p.fim), '[]'::jsonb)
    ) order by p.criado_em), '[]'::jsonb)
    from certificado_pedidos p join perfis f on f.id = p.usuario
    where p.status = 'pendente' and p.usuario <> v);
end $$;

/** O coordenador responde sem abrir o processo, com uma nota que a pessoa lê no painel. */
create or replace function public.certificado_pedido_recusar(p_id uuid, p_nota text) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); v_nota text := interno.txt(p_nota, 'nota', 5, 1000); v_usuario uuid;
begin
  if not interno.lider() then perform interno.erro('sem_permissao'); end if;
  update certificado_pedidos set status = 'recusado', nota = v_nota, decidido_por = v, decidido_em = now()
  where id = p_id and status = 'pendente' and usuario <> v returning usuario into v_usuario;
  if v_usuario is null then perform interno.erro('nao_encontrado'); end if;
  perform interno.avisar(v_usuario, 'Seu pedido de certificado não foi atendido agora. A coordenação deixou uma nota em "Horas e certificados".');
  perform interno.registrar('certificado_pedido_recusado', v_usuario::text);
  return jsonb_build_object('ok', true);
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
  delete from emails where criado_em < now() - interval '30 days';
  -- Relatos de erro do site (/relatar-erro): um ano.
  if to_regclass('interno.erros_relatados') is not null then delete from erros_relatados where criado_em < now() - interval '365 days'; end if;
  -- Pedido de boletim que ninguém confirmou em uma semana sai da lista.
  delete from boletim where not confirmado and criado_em < now() - interval '7 days';
  delete from aparelhos where ultimo < now() - interval '180 days';
  delete from reforco where status in ('atendido', 'cancelado') and criado_em < now() - interval '180 days';
  delete from denuncias where status = 'resolvida' and criado_em < now() - interval '365 days';
  delete from equipe_mensagens where criado_em < now() - interval '30 days';
  delete from conversa_mensagens where criado_em < now() - interval '30 days' or expira_em < now();
  -- Versões de chave trocadas há mais de 31 dias já não têm mensagem nenhuma; aparelhos sem uso há seis meses saem da conta.
  delete from chat_versoes x where exists (select 1 from chat_versoes y where y.conversa = x.conversa and y.versao > x.versao and y.criado_em < now() - interval '31 days');
  perform interno.chat_aparelho_tirar(a.id) from chat_aparelhos a where a.visto_em < now() - interval '180 days';
  -- Pedido de aprovação que ninguém atendeu em um dia é descartado: o aparelho novo pede de novo quando a pessoa voltar.
  delete from chat_aparelhos where certificado is null and pedido_em < now() - interval '1 day';
  -- Arquivo que subiu e nunca foi preso a uma mensagem; e o "ver uma vez" que ninguém abriu em catorze dias.
  delete from conversa_anexos where mensagem is null and criado_em < now() - interval '1 hour';
  delete from conversa_relatos where status = 'resolvido' and criado_em < now() - interval '365 days';
  update conversa_anexos set cifrado = null where uma_vez and cifrado is not null and criado_em < now() - interval '14 days';
  delete from convites where expira_em < now() - interval '30 days';
  delete from inscricoes where status <> 'pendente' and decidido_em < now() - interval '90 days';
  delete from mural where status = 'recusado' and decidido_em < now() - interval '30 days';
  delete from mural where status = 'aprovado' and validade < now() - interval '60 days';
  -- Avisos à equipe vencidos, rascunhos parados há um ano e bate-papo de aulas antigas (a aula fica; o papo some).
  begin
    delete from avisos_gerais where expira_em < now() - interval '30 days';
    delete from rascunhos where atualizado_em < now() - interval '365 days';
    delete from aulas_chat m using aulas_ao_vivo a where a.id = m.aula and a.inicio < now() - interval '180 days';
    delete from aulas_ao_vivo where status = 'cancelada' and inicio < now() - interval '90 days';
  exception when undefined_table then null;
  end;
  delete from divulgacao where situacao = 'publicado' and mexido_em < now() - interval '400 days';
  perform interno.pedidos_vencer();
  delete from pedidos where situacao <> 'pendente' and criado_em < now() - interval '400 days';
  -- Da Gaveta, só some sozinho o que foi recusado ou retirado há muito tempo; o publicado fica.
  delete from gaveta where status in ('recusado', 'retirado') and coalesce(decidido_em, criado_em) < now() - interval '400 days';
  delete from assistente_uso where dia < interno.assistente_dia() - 90;
  -- O serviço de contas guarda endereço de rede nos próprios registros; apagamos os antigos onde isso é permitido.
  begin
    execute $q$delete from auth.audit_log_entries where created_at < now() - interval '30 days'$q$;
  exception when others then null;
  end;
end $$;

-- ───────────────────────────── Painel ─────────────────────────────

/**
 * As contagens da Mesa. Cada pessoa vê só o que ela mesma pode resolver: quem dá parecer não conta o que já leu, a
 * curadoria não conta o reforço (que não é dela), a supervisão conta as suspensões que fez, o marketing conta os posts
 * prontos para sair, o desenvolvimento conta a publicação atrasada, e toda função conta os pedidos de ajuda para ela.
 */
create or replace function public.painel_resumo() returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); v_equipe boolean := interno.voluntario(); v_curador boolean := interno.curador();
begin
  return jsonb_build_object(
    -- Na fila de revisão: quem decide conta tudo o que espera decisão; quem dá parecer, só o que não é seu e ainda não
    -- recebeu o parecer dela. O que ainda espera a triagem conta na triagem, não aqui.
    'fila', case when v_equipe then (select count(*) from contribuicoes c where c.status = 'pendente' and c.triagem = 'liberada' and interno.ve_item(c)
                    and (v_curador or (c.autor is distinct from v and not exists (select 1 from pareceres r where r.contribuicao = c.id and r.autor = v)))) else 0 end,
    'candidaturas', case when interno.coord() then (select count(*) from candidaturas where status = 'pendente') + (select count(*) from inscricoes where status = 'pendente') else 0 end,
    'denuncias', case when v_curador then (select count(*) from denuncias where status = 'aberta') else 0 end,
    'anotacoes', case when interno.cuida() then (select count(*) from anotacoes where status = 'pendente') else 0 end,
    'retidos', case when interno.cuida() then (select count(*) from topicos where retido) + (select count(*) from respostas where retido) else 0 end,
    'mural', case when interno.media_mural() then (select count(*) from mural where status = 'pendente') else 0 end,
    'triagem', case when interno.media() then (select count(*) from contribuicoes where status = 'pendente' and triagem = 'aguardando') else 0 end,
    'reforco', case when interno.coord() or interno.tem('mentoria') or interno.tem('educacao')
                    then (select count(*) from reforco r where r.status = 'aberto' and interno.mentor(r.disciplina)) else 0 end,
    'horas', case when interno.coord() then (select count(*) from horas where status = 'pendente' and usuario <> v) else 0 end,
    'pedidos', case when interno.lider() then (select count(*) from certificado_pedidos where status = 'pendente' and usuario <> v) else 0 end,
    'testemunhar', (select count(*) from certificados c where c.status = 'aberto'
                    and exists (select 1 from jsonb_array_elements(c.testemunhas) x where x ->> 'id' = v::text and x ->> 'confirmou_em' is null)),
    'minhas', (select count(*) from contribuicoes where autor = v),
    'juntas', (select count(*) from colaboradores k join contribuicoes c on c.id = k.contribuicao where k.usuario = v and c.status = 'pendente'),
    -- Pedidos de ajuda do mural da equipe endereçados a uma função da pessoa, ainda sem resolver.
    'pedidos_ajuda', case when v_equipe then (select count(*) from equipe_mensagens m where m.canal = 'pedidos' and m.resposta_a is null and not m.resolvido
                    and m.autor is distinct from v and m.criado_em > now() - interval '30 days'
                    and exists (select 1 from papeis p where p.usuario = v and (p.papel = m.para or (m.para = 'coordenacao' and p.papel = 'vice')))) else 0 end,
    'suspensas', case when interno.supervisor() then (select count(*) from perfis where suspenso and suspensao = 'supervisao') else 0 end,
    'divulgacao', case when interno.divulga() then (select count(*) from divulgacao d
                    where (d.situacao = 'pronto' and d.data_prevista is not null and d.data_prevista <= current_date) or (d.devolvido and interno.tem('marketing'))) else 0 end,
    -- Aprovado há mais de três horas e ainda fora do ar: a rotina de publicação (de hora em hora) parou.
    'gaveta', case when interno.media() then (select count(*) from gaveta where status = 'pendente') else 0 end,
    'pedidos_supervisao', case when interno.coord() then (select count(*) from pedidos where situacao = 'pendente' and criado_em > now() - interval '72 hours') else 0 end,
    'publicacao_atrasada', case when interno.coord() or interno.tem('desenvolvimento')
                    then (select count(*) from contribuicoes where status = 'aprovada' and revisado_em < now() - interval '3 hours') else 0 end);
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
    if v_papel not in ('vice', 'supervisao', 'curadoria', 'mediacao', 'educacao', 'educacao_secundaria', 'revisao', 'traducao', 'jornalismo', 'mentoria', 'design', 'marketing', 'desenvolvimento', 'porta_voz', 'saude') then perform interno.erro('invalido:papel'); end if;
    if v_papel in ('vice', 'curadoria') and not interno.lider() then perform interno.erro('sem_permissao'); end if;
    -- O convite confia o papel na entrada: valem as regras de nível de papel_conceder.
    if not interno.pode_conceder(v_papel) then perform interno.erro('sem_permissao'); end if;
    if v_email = '' then perform interno.erro('invalido:email'); end if;
    if v_papel in ('educacao', 'educacao_secundaria', 'mentoria') and v_disc is null then perform interno.erro('invalido:disciplina'); end if;
    if v_papel not in ('educacao', 'educacao_secundaria', 'mentoria') then v_disc := null; end if;
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
  -- Convite pessoal vai sozinho para o e-mail da pessoa; o da comunidade (sem e-mail) a coordenação espalha como quiser.
  if v_email <> '' then
    perform interno.email(v_email, 'convite', 'Seu convite para o Instituto Lúcia',
      E'Olá.\n\nA coordenação do Instituto Lúcia convidou você para criar uma conta' || case when v_papel is not null then ' e atuar na função de ' || interno.nome_papel(v_papel) else '' end
      || E'.\n\nAbra o endereço abaixo. Ele é pessoal, só funciona com este e-mail e vale por ' || v_dias || E' dia(s):\n\n'
      || interno.endereco() || '/pt/entrar?convite=' || v_codigo || E'\n\nSe você não esperava este convite, é só ignorar esta mensagem.', '', 5);
  end if;
  return jsonb_build_object('id', v_id, 'codigo', v_codigo, 'email_enviado', v_email <> '');
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
  select interno.aberta('mural');
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

-- A chave combinada por frase deu lugar às chaves de cada aparelho (seção "Conversas da equipe"): a frase não existe mais.
drop function if exists public.equipe_chave_definir(text);
update interno.configuracoes set valor = valor - 'prova' - 'sal' where chave = 'equipe';

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
/**
 * Qualquer pessoa pede o boletim. Com o envio de e-mails funcionando, o endereço só entra na lista depois de a pessoa clicar
 * no link que chega por e-mail; antes disso, entra direto, como sempre foi (senão ficaria esperando um link que não vem).
 * A resposta é a mesma para endereço novo, repetido ou já confirmado: ninguém descobre por aqui quem já assina.
 */
create or replace function public.boletim_assinar(p_email text, p_site text default '') returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v_email text := lower(btrim(coalesce(p_email, ''))); b boletim;
begin
  perform interno.aberta('jornal');
  if coalesce(p_site, '') <> '' then return jsonb_build_object('ok', true); end if;
  perform interno.limite('boletim', 5, 60);
  if v_email !~ '^[^@[:space:]]+@[^@[:space:]]+[.][^@[:space:]]+$' or char_length(v_email) > 200 then perform interno.erro('invalido:email'); end if;
  insert into boletim (email, confirmado, codigo) values (v_email, not interno.email_ativo(), replace(gen_random_uuid()::text, '-', '')) on conflict (email) do nothing;
  select * into b from boletim where email = v_email;
  if not b.confirmado then
    perform interno.email(v_email, 'boletim_confirmar', 'Confirme que você quer receber o boletim do Instituto Lúcia',
      E'Olá.\n\nAlguém (provavelmente você) pediu para receber o boletim do jornal do Instituto Lúcia neste endereço.\n\n'
      || E'Para confirmar, abra:\n' || interno.endereco() || '/pt/jornal?boletim=confirmar&codigo=' || b.codigo
      || E'\n\nSe não foi você, é só ignorar esta mensagem: sem a confirmação, nada será enviado.', '', 2);
  end if;
  return jsonb_build_object('ok', true, 'confirmar', interno.email_ativo());
end $$;

/** O link do e-mail de confirmação. */
create or replace function public.boletim_confirmar(p_codigo text) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
begin
  perform interno.aberta('jornal');
  perform interno.limite('boletim_codigo', 30, 60);
  if coalesce(p_codigo, '') !~ '^[a-f0-9]{32}$' then perform interno.erro('nao_encontrado'); end if;
  update boletim set confirmado = true where codigo = p_codigo;
  if not found then perform interno.erro('nao_encontrado'); end if;
  return jsonb_build_object('ok', true);
end $$;

/** O link "sair da lista", que vai em todo boletim. Sai na hora, sem pedir mais nada. */
create or replace function public.boletim_sair(p_codigo text) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
begin
  perform interno.limite('boletim_codigo', 30, 60);
  if coalesce(p_codigo, '') !~ '^[a-f0-9]{32}$' then perform interno.erro('nao_encontrado'); end if;
  delete from boletim where codigo = p_codigo;
  if not found then perform interno.erro('nao_encontrado'); end if;
  return jsonb_build_object('ok', true);
end $$;

/** A lista, para a coordenação e para quem escreve o jornal. "confirmado" diz quem já clicou no link. */
create or replace function public.boletim_listar() returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
begin
  perform interno.eu();
  if not (interno.coord() or interno.tem('jornalismo')) then perform interno.erro('sem_permissao'); end if;
  perform interno.registrar('boletim_lido');
  return (select coalesce(jsonb_agg(jsonb_build_object('email', email, 'criado_em', criado_em, 'confirmado', confirmado, 'falhas', falhas, 'pausado', pausado) order by criado_em desc), '[]'::jsonb) from boletim);
end $$;

/**
 * Manda uma edição do boletim para todos os endereços confirmados, cada um com o próprio link de saída. No máximo uma
 * edição a cada seis horas, para um engano não virar uma enxurrada. Devolve quantos e-mails entraram na fila.
 */
create or replace function public.boletim_enviar(p_assunto text, p_texto text) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v_assunto text := interno.txt(p_assunto, 'assunto', 5, 150); v_texto text := interno.txt(p_texto, 'texto', 50, 15000); v_total integer := 0; r record;
begin
  perform interno.eu();
  if not (interno.coord() or interno.tem('jornalismo')) then perform interno.erro('sem_permissao'); end if;
  if exists (select 1 from emails where tipo = 'boletim' and criado_em > now() - interval '6 hours') then perform interno.erro('boletim_recente'); end if;
  for r in select email, codigo from boletim where confirmado and not pausado loop
    if interno.email(r.email, 'boletim', v_assunto,
         v_texto || E'\n\n---\nVocê recebe este boletim porque pediu no site do Instituto Lúcia. Para sair da lista: ' || interno.endereco() || '/pt/jornal?boletim=sair&codigo=' || r.codigo,
         interno.endereco() || '/pt/jornal?boletim=sair&codigo=' || r.codigo, 2) then
      v_total := v_total + 1;
    end if;
  end loop;
  perform interno.registrar('boletim_enviado', v_assunto, jsonb_build_object('emails', v_total));
  return jsonb_build_object('emails', v_total);
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
      'id', f.id, 'nome', interno.nome_visto(f.nome), 'bio', f.bio, 'avatar', f.avatar, 'eu', f.id = auth.uid(), 'por_aqui', f.visto_em > now() - interval '90 minutes',
      'privado', interno.privado_permitido(f.id),
      -- Quem esconde o "visto por último" não o mostra e não vê o dos outros.
      'online', case when f.id = auth.uid() or (f.chat_visto and coalesce((select p.chat_visto from perfis p where p.id = auth.uid()), true)) then f.visto_em > now() - interval '2 minutes' end,
      'visto_em', case when f.id = auth.uid() or (f.chat_visto and coalesce((select p.chat_visto from perfis p where p.id = auth.uid()), true)) then f.visto_em end,
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
    'motivo', coalesce((select valor ->> 'motivo' from configuracoes where chave = 'site'), ''),
    -- O que o site fecha agora (lido pelo proxy.ts). O motivo interno e quem ligou ficam só no painel.
    'interdicao', jsonb_build_object(
      'geral', coalesce((interno.interdicao() ->> 'geral')::boolean, false),
      'areas', coalesce(interno.interdicao() -> 'areas', '[]'::jsonb),
      'mensagem', coalesce(interno.interdicao() ->> 'mensagem', '')))
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
  foreach tabela in array array['mural', 'reforco', 'boletim', 'contribuicoes', 'topicos', 'respostas', 'inscricoes', 'gaveta'] loop
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
  perform interno.aberta('voluntariado');
  -- Campo-isca: gente não vê, robô preenche. Finge que deu certo e não guarda nada.
  if coalesce(p ->> 'site', '') <> '' then return jsonb_build_object('id', gen_random_uuid()); end if;
  perform interno.limite('voluntariar', 3, 1440);
  if v_email !~ '^[^@[:space:]]+@[^@[:space:]]+[.][^@[:space:]]+$' or char_length(v_email) > 200 then perform interno.erro('invalido:email'); end if;
  if v_papel not in ('curadoria', 'mediacao', 'educacao', 'educacao_secundaria', 'revisao', 'traducao', 'jornalismo', 'mentoria', 'design', 'marketing', 'desenvolvimento', 'porta_voz', 'saude') then perform interno.erro('invalido:papel'); end if;
  if v_papel in ('educacao', 'educacao_secundaria', 'mentoria') and v_disc is null then perform interno.erro('invalido:disciplina'); end if;
  if v_papel not in ('educacao', 'educacao_secundaria', 'mentoria') then v_disc := null; end if;
  v_nome := interno.txt(p ->> 'nome', 'nome', 5, 120);
  v_mensagem := interno.txt(p ->> 'mensagem', 'mensagem', 30, 2000);
  if interno.vetado(v_nome || ' ' || v_mensagem) then perform interno.erro('conteudo_recusado'); end if;
  if exists (select 1 from inscricoes where email = v_email and papel = v_papel and status = 'pendente') then perform interno.erro('ja_pediu'); end if;
  insert into inscricoes (nome, email, papel, disciplina, mensagem) values (v_nome, v_email, v_papel, v_disc, v_mensagem) returning id into v_id;
  perform interno.email(v_email, 'inscricao_recebida', 'Recebemos seu pedido de voluntariado',
    'Olá, ' || v_nome || E'.\n\nRecebemos seu pedido para atuar como voluntário(a) no Instituto Lúcia, na função de ' || interno.nome_papel(v_papel) || E'.\n\n'
    || E'A coordenação lê cada pedido e responde por este mesmo endereço. Se o pedido for aceito, chega aqui o link para você criar a sua conta e entrar no painel da equipe.\n\n'
    || 'Se não foi você quem enviou este pedido, é só ignorar esta mensagem.');
  perform interno.email_lideranca('inscricao_nova', 'Novo pedido de voluntariado: ' || left(v_nome, 60),
    v_nome || ' (' || v_email || ') quer atuar na função de ' || interno.nome_papel(v_papel) || E'.\n\nLeia o pedido e decida no painel: ' || interno.endereco() || '/pt/painel?aba=pessoas');
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
    perform interno.email(i.email, 'inscricao_recusada', 'Seu pedido de voluntariado no Instituto Lúcia',
      'Olá, ' || i.nome || E'.\n\nObrigado pelo interesse em atuar no Instituto Lúcia. Desta vez o seu pedido para a função de ' || interno.nome_papel(i.papel)
      || E' não foi aceito.\n\nVocê pode continuar estudando e contribuindo com o acervo pelo site, e fazer um novo pedido mais adiante.');
    return jsonb_build_object('ok', true);
  end if;
  if i.papel = 'curadoria' and not interno.lider() then perform interno.erro('sem_permissao'); end if;
  -- Aceitar é confiar o papel: valem as regras de nível de papel_conceder.
  if not interno.pode_conceder(i.papel) then perform interno.erro('sem_permissao'); end if;
  select u.id into v_conta from auth.users u where lower(u.email) = i.email;
  if v_conta is not null then
    if not interno.pode_mexer(v_conta) then perform interno.erro('sem_permissao'); end if;
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
  if v_codigo is not null then
    perform interno.email(i.email, 'convite', 'Seu convite para a equipe do Instituto Lúcia',
      'Olá, ' || i.nome || E'.\n\nSeu pedido para a função de ' || interno.nome_papel(i.papel) || E' foi aceito. Boas-vindas à equipe!\n\n'
      || E'Para criar a sua conta, abra o endereço abaixo. Ele é pessoal, só funciona com este e-mail e vale por 14 dias:\n\n'
      || interno.endereco() || '/pt/entrar?convite=' || v_codigo || E'\n\nDepois de entrar, a sua função já aparece no painel.', '', 5);
  else
    perform interno.email(i.email, 'inscricao_aceita', 'Seu pedido de voluntariado foi aceito',
      'Olá, ' || i.nome || E'.\n\nSeu pedido para a função de ' || interno.nome_papel(i.papel) || E' foi aceito. Boas-vindas à equipe!\n\n'
      || 'Você já tinha conta, então a função já está liberada. Entre com o seu e-mail e senha e abra o painel: ' || interno.endereco() || '/pt/painel');
  end if;
  return jsonb_build_object('ok', true, 'codigo', v_codigo, 'email', i.email, 'nome', i.nome);
end $$;

-- ───────────────────────────── Conversas da equipe ─────────────────────────────

create or replace function interno.da_equipe(p_usuario uuid) returns boolean language sql stable security definer set search_path = interno, pg_temp as $$
  select exists (select 1 from papeis r join perfis f on f.id = r.usuario where r.usuario = p_usuario and not f.suspenso)
$$;

create or replace function interno.na_conversa(p_conversa uuid) returns boolean language sql stable security definer set search_path = interno, pg_temp as $$
  select interno.voluntario() and exists (select 1 from conversa_membros where conversa = p_conversa and usuario = auth.uid())
$$;
/** Administra o grupo: quem está marcado como administrador, e a coordenação (que participa de tudo para poder cuidar). */
create or replace function interno.chat_admin(p_conversa uuid) returns boolean language sql stable security definer set search_path = interno, pg_temp as $$
  select interno.na_conversa(p_conversa) and (interno.coord() or exists (select 1 from conversa_membros where conversa = p_conversa and usuario = auth.uid() and admin)
    or exists (select 1 from papeis p join conversas c on c.id = p_conversa where p.usuario = auth.uid() and p.papel = 'representante' and c.tipo = 'departamento' and p.disciplina = c.departamento))
$$;
/** Um aviso do sistema na conversa, escrito pelo banco: quem fez o quê. */
create or replace function interno.chat_aviso(p_conversa uuid, p_evento text, p_alvo uuid default null, p_texto text default null) returns void language plpgsql security definer set search_path = interno, pg_temp as $$
begin
  insert into conversa_mensagens (conversa, autor, corpo, versao, tipo, detalhe)
  values (p_conversa, auth.uid(), 'sistema', 0, 'sistema',
          jsonb_build_object('evento', p_evento, 'por', coalesce((select interno.primeiro_nome(nome) from perfis where id = auth.uid()), ''), 'alvo', p_alvo,
                             'alvo_nome', coalesce((select interno.primeiro_nome(nome) from perfis where id = p_alvo), ''), 'texto', left(coalesce(p_texto, ''), 120)));
end $$;

/** Esta pessoa pertence a este departamento? Quem tem a função, com a conta ativa; coordenação e vice-coordenação, em todos. */
create or replace function interno.no_departamento(p_usuario uuid, p_departamento text) returns boolean language sql stable security definer set search_path = interno, pg_temp as $$
  select exists (select 1 from papeis p join perfis f on f.id = p.usuario
                 where p.usuario = p_usuario and not f.suspenso
                   and ((p_departamento = 'geral' and p.papel <> 'saude') or p.papel in ('coordenacao', 'vice') or p.papel = p_departamento or (p.papel = 'representante' and p.disciplina = p_departamento)
                        -- Representante de um grupo de disciplinas (Tecnologia, Ciências…) é do departamento de educação.
                        or (p_departamento = 'educacao' and p.papel = 'representante' and p.disciplina like 'grupo-%')
                        -- A educação secundária conversa com a educação; o marketing, com o design (como no resto do painel).
                        or (p_departamento = 'educacao' and p.papel = 'educacao_secundaria') or (p_departamento = 'design' and p.papel = 'marketing')
                        -- A supervisão acompanha os grupos das funções para manter a conversa em ordem; o da coordenação, não.
                        or (p.papel = 'supervisao' and p_departamento <> 'coordenacao')))
$$;

/** A próxima mensagem da conversa sai com uma versão nova da chave. */
create or replace function interno.chat_trocar_chave(p_conversa uuid) returns void language plpgsql security definer set search_path = interno, pg_temp as $$
begin
  update conversas set versao_minima = greatest(versao_minima, coalesce((select max(versao) from chat_versoes where conversa = p_conversa), 0) + 1)
  where id = p_conversa;
end $$;

/**
 * Tira alguém de uma conversa. Os embrulhos da chave feitos para os aparelhos dessa pessoa somem, e a conversa passa a exigir
 * uma versão nova da chave: a próxima mensagem já sai cifrada com uma chave que quem saiu nunca recebeu.
 */
create or replace function interno.chat_retirar(p_conversa uuid, p_usuario uuid) returns void language plpgsql security definer set search_path = interno, pg_temp as $$
begin
  delete from conversa_membros where conversa = p_conversa and usuario = p_usuario;
  if not found then return; end if;
  delete from chat_chaves where conversa = p_conversa and para in (select id from chat_aparelhos where usuario = p_usuario);
  perform interno.chat_trocar_chave(p_conversa);
end $$;

/** Remove um aparelho: os embrulhos feitos para ele somem e todas as conversas da pessoa trocam de chave. */
create or replace function interno.chat_aparelho_tirar(p_id uuid) returns void language plpgsql security definer set search_path = interno, pg_temp as $$
declare v_usuario uuid; r record;
begin
  delete from chat_aparelhos where id = p_id returning usuario into v_usuario;
  if v_usuario is null then return; end if;
  for r in select conversa from conversa_membros where usuario = v_usuario loop
    perform interno.chat_trocar_chave(r.conversa);
  end loop;
end $$;

/** Põe e tira a pessoa dos grupos de departamento conforme as funções que ela tem agora. */
create or replace function interno.departamentos_sincronizar(p_usuario uuid) returns void language plpgsql security definer set search_path = interno, pg_temp as $$
declare r record;
begin
  if p_usuario is null then return; end if;
  for r in select id, departamento from conversas where tipo = 'departamento' and departamento is not null loop
    if interno.no_departamento(p_usuario, r.departamento) then
      insert into conversa_membros (conversa, usuario) values (r.id, p_usuario) on conflict do nothing;
    else
      perform interno.chat_retirar(r.id, p_usuario);
    end if;
  end loop;
end $$;

/** Roda sozinho quando uma função é dada, tirada ou trocada, e quando uma conta é suspensa ou reativada. */
create or replace function interno.departamentos_gatilho() returns trigger language plpgsql security definer set search_path = interno, pg_temp as $$
begin
  if tg_table_name = 'perfis' then
    perform interno.departamentos_sincronizar(new.id);
  elsif tg_op = 'INSERT' then
    perform interno.departamentos_sincronizar(new.usuario);
  elsif tg_op = 'DELETE' then
    perform interno.departamentos_sincronizar(old.usuario);
  else
    perform interno.departamentos_sincronizar(old.usuario);
    if new.usuario is distinct from old.usuario then perform interno.departamentos_sincronizar(new.usuario); end if;
  end if;
  return null;
end $$;
drop trigger if exists lucia_departamentos on interno.papeis;
create trigger lucia_departamentos after insert or update or delete on interno.papeis for each row execute function interno.departamentos_gatilho();
drop trigger if exists lucia_departamentos on interno.perfis;
create trigger lucia_departamentos after update of suspenso on interno.perfis for each row when (old.suspenso is distinct from new.suspenso)
  execute function interno.departamentos_gatilho();

insert into interno.conversas (tipo, nome, departamento) values
  ('departamento', 'Toda a equipe', 'geral'), ('departamento', 'Coordenação', 'coordenacao'), ('departamento', 'Curadoria', 'curadoria'),
  ('departamento', 'Mediação', 'mediacao'), ('departamento', 'Educação', 'educacao'), ('departamento', 'Revisão', 'revisao'),
  ('departamento', 'Tradução', 'traducao'), ('departamento', 'Jornalismo, rádio e podcast', 'jornalismo'), ('departamento', 'Aula de reforço', 'mentoria'),
  ('departamento', 'Design', 'design'), ('departamento', 'Desenvolvimento', 'desenvolvimento'), ('departamento', 'Marketing e divulgação', 'marketing'),
  ('departamento', 'Supervisão', 'supervisao')
on conflict (departamento) do update set nome = excluded.nome, tipo = 'departamento';

-- Quem já estava na equipe entra nos grupos do seu departamento (e sai do que não é mais seu). Rodar de novo não muda nada.
do $$
declare u uuid;
begin
  for u in select usuario from interno.papeis union select m.usuario from interno.conversa_membros m join interno.conversas c on c.id = m.conversa where c.tipo = 'departamento' loop
    perform interno.departamentos_sincronizar(u);
  end loop;
end $$;

/** O mural da equipe usa a chave do grupo do departamento correspondente: "geral" e "pedidos" usam a da equipe inteira. */
create or replace function interno.canal_conversa(p_canal text) returns uuid language sql stable security definer set search_path = interno, pg_temp as $$
  select id from conversas where tipo = 'departamento' and departamento = case when p_canal in ('geral', 'pedidos', 'aprendizado') then 'geral' else p_canal end
$$;

/** O texto cifrado com a versão atual da chave desta conversa? Devolve a versão, ou erro. Texto aberto nunca entra. */
create or replace function interno.chat_versao_valida(p_conversa uuid, p_corpo text) returns integer language plpgsql stable security definer set search_path = interno, pg_temp as $$
declare v_versao integer;
begin
  if coalesce(p_corpo, '') !~ '^c2[.][1-9][0-9]{0,6}[.][A-Za-z0-9_-]{16}[.][A-Za-z0-9_-]{23,}$' or char_length(p_corpo) > 12000 then
    perform interno.erro('invalido:corpo');
  end if;
  v_versao := split_part(p_corpo, '.', 2)::integer;
  -- Só vale a versão mais nova, e só se ela for posterior à última saída de alguém da conversa.
  if v_versao is distinct from (select max(versao) from chat_versoes where conversa = p_conversa)
     or v_versao < (select versao_minima from conversas where id = p_conversa) then
    perform interno.erro('chave_desatualizada');
  end if;
  return v_versao;
end $$;

/** O que um aparelho precisa saber de si mesmo: aprovado ou pendente, o certificado e a identidade embrulhada para ele. */
create or replace function interno.chat_aparelho_json(a interno.chat_aparelhos) returns jsonb language sql stable security definer set search_path = interno, pg_temp as $$
  select jsonb_build_object(
    'id', a.id, 'rotulo', a.rotulo, 'criado_em', a.criado_em, 'visto_em', a.visto_em, 'aprovado_em', a.aprovado_em,
    'estado', case when a.certificado is not null then 'aprovado' else 'pendente' end,
    'certificado', a.certificado, 'identidade_embrulho', a.identidade_embrulho, 'aprovado_publica', a.aprovado_publica,
    'identidade', (select jsonb_build_object('assina', i.assina, 'versao', i.versao) from chat_identidades i where i.usuario = a.usuario))
$$;

/**
 * Cada navegador cria o próprio par de chaves e registra aqui só a parte pública. A pessoa é avisada quando aparece
 * um aparelho novo na conta; cada conta tem no máximo dez (o mais antigo sem uso sai).
 *
 * O primeiro aparelho da conta (ou o primeiro depois de a identidade ser recomeçada) traz a identidade nova (p_assina) e o
 * próprio certificado, e já entra aprovado. Quem tem a identidade de uma cópia de recuperação traz p_assina igual à que o
 * banco já conhece e o certificado feito com ela: também entra aprovado, e os colegas não veem mudança nenhuma. Qualquer
 * outro aparelho entra pendente, com o pedido (a chave pública cifrada pelo código que ele mostra), até um aparelho
 * aprovado da mesma pessoa certificá-lo. O banco não confere assinatura: isso é dos aparelhos dos colegas.
 */
-- Assinatura nova: a antiga sai antes, senão as duas convivem e a API não sabe qual chamar (erro 300).
drop function if exists public.chat_aparelho_registrar(text, text);
create or replace function public.chat_aparelho_registrar(p_publica text, p_rotulo text default '', p_pedido jsonb default null, p_assina text default null, p_certificado text default null) returns jsonb
language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); v_rotulo text := interno.txt(p_rotulo, 'rotulo', 0, 80); v_id uuid; v_dono uuid; v_outros integer; v_assina text; a chat_aparelhos;
begin
  if not interno.voluntario() then perform interno.erro('sem_permissao'); end if;
  if coalesce(p_publica, '') !~ '^B[A-Za-z0-9_-]{86}$' then perform interno.erro('invalido:publica'); end if;
  select id, usuario into v_id, v_dono from chat_aparelhos where publica = p_publica;
  if v_id is not null then
    if v_dono is distinct from v then perform interno.erro('invalido:publica'); end if;
    update chat_aparelhos set visto_em = now(), rotulo = case when v_rotulo <> '' then v_rotulo else rotulo end where id = v_id returning * into a;
    return interno.chat_aparelho_json(a);
  end if;
  perform interno.limite('chat_aparelho', 10, 1440);
  if p_assina is not null and p_assina !~ '^B[A-Za-z0-9_-]{86}$' then perform interno.erro('invalido:assina'); end if;
  if p_certificado is not null and p_certificado !~ '^[A-Za-z0-9_-]{86}$' then perform interno.erro('invalido:certificado'); end if;
  if p_pedido is not null and (jsonb_typeof(p_pedido) <> 'object' or coalesce(p_pedido ->> 'sal', '') !~ '^[A-Za-z0-9_-]{22}$' or coalesce(p_pedido ->> 'iv', '') !~ '^[A-Za-z0-9_-]{16}$' or coalesce(p_pedido ->> 'cifrado', '') !~ '^[A-Za-z0-9_-]{100,160}$') then
    perform interno.erro('invalido:pedido');
  end if;
  select count(*) into v_outros from chat_aparelhos where usuario = v;
  if v_outros >= 10 then
    perform interno.chat_aparelho_tirar((select id from chat_aparelhos where usuario = v order by visto_em limit 1));
  end if;
  select assina into v_assina from chat_identidades where usuario = v;
  if p_assina is not null then
    -- Com identidade: ou é a primeira da conta (ou a primeira depois de recomeçar), ou é a mesma que já existe, vinda da cópia de recuperação.
    if p_certificado is null then perform interno.erro('invalido:certificado'); end if;
    if v_assina is not null and v_assina <> p_assina then perform interno.erro('identidade_existe'); end if;
    if v_assina is null then
      insert into chat_identidades (usuario, assina) values (v, p_assina)
      on conflict (usuario) do update set assina = excluded.assina, atualizado_em = now();
    end if;
    insert into chat_aparelhos (usuario, publica, rotulo, certificado, aprovado_em) values (v, p_publica, v_rotulo, p_certificado, now()) returning * into a;
    perform interno.registrar(case when v_assina is null then 'chat_identidade_criada' else 'chat_aparelho_recuperado' end, v::text, jsonb_build_object('rotulo', v_rotulo));
  else
    if p_pedido is null then perform interno.erro('invalido:pedido'); end if;
    insert into chat_aparelhos (usuario, publica, rotulo, pedido, pedido_em) values (v, p_publica, v_rotulo, p_pedido, now()) returning * into a;
  end if;
  if v_outros > 0 then
    perform interno.avisar(v, 'As suas conversas da equipe foram abertas em um aparelho novo (' || coalesce(nullif(v_rotulo, ''), 'navegador desconhecido')
      || case when a.certificado is null then '). Ele só passa a ler as conversas depois que você o aprovar, em Conversas → Aparelhos. Se não foi você, remova-o lá e avise a coordenação.'
              else '). Se não foi você, remova esse aparelho em Conversas → Aparelhos e avise a coordenação.' end);
  end if;
  perform interno.registrar('chat_aparelho_novo', v::text, jsonb_build_object('rotulo', v_rotulo, 'pendente', a.certificado is null));
  return interno.chat_aparelho_json(a);
end $$;

/** Um aparelho pendente sem pedido (ficou de fora da migração) ou com o pedido descartado deixa um pedido novo, com código novo. */
create or replace function public.chat_aparelho_pedir(p_id uuid, p_pedido jsonb) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); a chat_aparelhos;
begin
  perform interno.limite('chat_pedido', 20, 60);
  if p_pedido is null or jsonb_typeof(p_pedido) <> 'object' or coalesce(p_pedido ->> 'sal', '') !~ '^[A-Za-z0-9_-]{22}$' or coalesce(p_pedido ->> 'iv', '') !~ '^[A-Za-z0-9_-]{16}$' or coalesce(p_pedido ->> 'cifrado', '') !~ '^[A-Za-z0-9_-]{100,160}$' then
    perform interno.erro('invalido:pedido');
  end if;
  update chat_aparelhos set pedido = p_pedido, pedido_em = now(), visto_em = now() where id = p_id and usuario = v and certificado is null returning * into a;
  if not found then perform interno.erro('aparelho_desconhecido'); end if;
  return interno.chat_aparelho_json(a);
end $$;

/**
 * Um aparelho pendente que recebeu a identidade pela cópia de recuperação se certifica sozinho: a parte pública precisa ser
 * a que a conta já tem. Os colegas não veem mudança nenhuma.
 */
create or replace function public.chat_aparelho_recuperar(p_id uuid, p_assina text, p_certificado text) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); a chat_aparelhos;
begin
  perform interno.limite('chat_recuperar', 10, 60);
  if coalesce(p_assina, '') !~ '^B[A-Za-z0-9_-]{86}$' then perform interno.erro('invalido:assina'); end if;
  if coalesce(p_certificado, '') !~ '^[A-Za-z0-9_-]{86}$' then perform interno.erro('invalido:certificado'); end if;
  if not exists (select 1 from chat_identidades where usuario = v and assina = p_assina) then perform interno.erro('identidade_diferente'); end if;
  update chat_aparelhos set certificado = p_certificado, aprovado_em = now(), pedido = null where id = p_id and usuario = v and certificado is null returning * into a;
  if not found then perform interno.erro('aparelho_desconhecido'); end if;
  perform interno.registrar('chat_aparelho_recuperado', v::text, jsonb_build_object('rotulo', a.rotulo));
  return interno.chat_aparelho_json(a);
end $$;

/** O aparelho pendente pergunta, de tempos em tempos, se já foi aprovado. */
create or replace function public.chat_aparelho_estado(p_id uuid) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); a chat_aparelhos;
begin
  select * into a from chat_aparelhos where id = p_id and usuario = v;
  if not found then perform interno.erro('aparelho_desconhecido'); end if;
  update chat_aparelhos set visto_em = now() where id = p_id and visto_em < now() - interval '1 hour';
  return interno.chat_aparelho_json(a);
end $$;

/**
 * Um aparelho aprovado certifica um aparelho pendente da mesma conta (depois de conferir o código no próprio aparelho) e
 * deixa para ele a identidade embrulhada. A partir daí os colegas passam a entregar chaves ao aparelho novo.
 */
create or replace function public.chat_aparelho_aprovar(p_id uuid, p_por uuid, p_certificado text, p_identidade_embrulho text) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); v_publica text; a chat_aparelhos;
begin
  select publica into v_publica from chat_aparelhos where id = p_por and usuario = v and certificado is not null;
  if v_publica is null then perform interno.erro('aparelho_desconhecido'); end if;
  if coalesce(p_certificado, '') !~ '^[A-Za-z0-9_-]{86}$' then perform interno.erro('invalido:certificado'); end if;
  if coalesce(p_identidade_embrulho, '') !~ '^w1[.][A-Za-z0-9_-]{16}[.][A-Za-z0-9_-]{64}$' then perform interno.erro('invalido:embrulho'); end if;
  update chat_aparelhos set certificado = p_certificado, aprovado_por = p_por, aprovado_publica = v_publica, aprovado_em = now(), identidade_embrulho = p_identidade_embrulho, pedido = null
  where id = p_id and usuario = v and certificado is null and id <> p_por returning * into a;
  if not found then perform interno.erro('nao_encontrado'); end if;
  perform interno.registrar('chat_aparelho_aprovado', v::text, jsonb_build_object('rotulo', a.rotulo));
  return interno.chat_aparelho_json(a);
end $$;

/**
 * Migração dos aparelhos de antes da identidade: o aparelho que abre o painel primeiro (quando a conta ainda não tem
 * identidade) cria a identidade e se certifica. Os outros aparelhos da conta continuam na lista e são aprovados por ele
 * em seguida (chat_aparelho_aprovar), com aviso à pessoa. Só vale enquanto a conta não tem identidade.
 */
create or replace function public.chat_identidade_definir(p_aparelho uuid, p_assina text, p_certificado text) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); a chat_aparelhos;
begin
  if coalesce(p_assina, '') !~ '^B[A-Za-z0-9_-]{86}$' then perform interno.erro('invalido:assina'); end if;
  if coalesce(p_certificado, '') !~ '^[A-Za-z0-9_-]{86}$' then perform interno.erro('invalido:certificado'); end if;
  if exists (select 1 from chat_identidades where usuario = v and assina is not null) then perform interno.erro('identidade_existe'); end if;
  update chat_aparelhos set certificado = p_certificado, aprovado_em = now(), pedido = null where id = p_aparelho and usuario = v returning * into a;
  if not found then perform interno.erro('aparelho_desconhecido'); end if;
  insert into chat_identidades (usuario, assina) values (v, p_assina) on conflict (usuario) do update set assina = excluded.assina, atualizado_em = now();
  perform interno.registrar('chat_identidade_criada', v::text, jsonb_build_object('rotulo', a.rotulo, 'migracao', true));
  return jsonb_build_object('ok', true,
    'outros', coalesce((select jsonb_agg(jsonb_build_object('id', x.id, 'publica', x.publica, 'rotulo', x.rotulo, 'visto_em', x.visto_em) order by x.visto_em desc)
                        from chat_aparelhos x where x.usuario = v and x.id <> p_aparelho and x.certificado is null and x.pedido is null), '[]'::jsonb));
end $$;

/**
 * Quem perdeu todos os aparelhos e não tem a cópia de recuperação recomeça: os aparelhos antigos saem (as conversas trocam de
 * chave), a identidade some e o próximo aparelho cria outra. Os colegas veem "a chave de segurança mudou" e, se tinham
 * verificado a pessoa, só voltam a entregar chaves depois de confirmar. A cópia de recuperação antiga deixa de servir.
 */
create or replace function public.chat_identidade_redefinir() returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); r record;
begin
  if not interno.voluntario() then perform interno.erro('sem_permissao'); end if;
  perform interno.limite('chat_identidade', 3, 1440);
  for r in select id from chat_aparelhos where usuario = v loop perform interno.chat_aparelho_tirar(r.id); end loop;
  update chat_identidades set assina = null, versao = versao + 1, atualizado_em = now() where usuario = v;
  delete from chat_recuperacoes where usuario = v;
  perform interno.registrar('chat_identidade_recomecada', v::text);
  perform interno.avisar(v, 'A identidade das suas conversas foi recomeçada. Os colegas que tinham verificado você vão ver que a sua chave de segurança mudou.');
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.chat_aparelhos_meus() returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu();
begin
  return (select coalesce(jsonb_agg(jsonb_build_object('id', a.id, 'rotulo', a.rotulo, 'criado_em', a.criado_em, 'visto_em', a.visto_em, 'aprovado_em', a.aprovado_em, 'publica', a.publica,
            'estado', case when a.certificado is not null then 'aprovado' else 'pendente' end, 'pedido', a.pedido) order by (a.certificado is null) desc, a.visto_em desc), '[]'::jsonb)
          from chat_aparelhos a where a.usuario = v);
end $$;

/** A cópia de recuperação da própria pessoa: o banco só guarda o cifrado e só devolve ao dono. */
create or replace function public.chat_recuperacao_guardar(p_copia jsonb) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu();
begin
  if not interno.voluntario() then perform interno.erro('sem_permissao'); end if;
  perform interno.limite('chat_recuperacao', 60, 60);
  if jsonb_typeof(p_copia) <> 'object' or coalesce(p_copia ->> 'sal', '') !~ '^[A-Za-z0-9_-]{22}$' or coalesce(p_copia ->> 'iv', '') !~ '^[A-Za-z0-9_-]{16}$'
     or coalesce(p_copia ->> 'cifrado', '') !~ '^[A-Za-z0-9_-]{40,}$' or pg_column_size(p_copia) > 400000 then
    perform interno.erro('invalido:copia');
  end if;
  insert into chat_recuperacoes (usuario, copia) values (v, p_copia) on conflict (usuario) do update set copia = excluded.copia, atualizado_em = now();
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.chat_recuperacao_ler() returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu();
begin
  perform interno.limite('chat_recuperacao_ler', 20, 60);
  return (select jsonb_build_object('copia', r.copia, 'atualizado_em', r.atualizado_em) from chat_recuperacoes r where r.usuario = v);
end $$;

/** Aparelho perdido ou que não é mais usado: sai da conta, e todas as conversas da pessoa trocam de chave. */
create or replace function public.chat_aparelho_remover(p_id uuid) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu();
begin
  if not exists (select 1 from chat_aparelhos where id = p_id and usuario = v) then perform interno.erro('nao_encontrado'); end if;
  perform interno.chat_aparelho_tirar(p_id);
  perform interno.registrar('chat_aparelho_removido', v::text);
  return jsonb_build_object('ok', true);
end $$;

/**
 * As chaves de uma conversa para um aparelho: os embrulhos feitos para ele (só ele abre), a versão atual e a mínima, e a
 * parte pública dos aparelhos de quem participa, para criar uma versão nova quando for preciso.
 */
create or replace function public.chat_chaves(p_conversa uuid, p_aparelho uuid) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu();
begin
  if not interno.na_conversa(p_conversa) then perform interno.erro('nao_encontrado'); end if;
  if not exists (select 1 from chat_aparelhos where id = p_aparelho and usuario = v) then perform interno.erro('aparelho_desconhecido'); end if;
  update chat_aparelhos set visto_em = now() where id = p_aparelho and visto_em < now() - interval '1 hour';
  return jsonb_build_object(
    'atual', (select max(versao) from chat_versoes where conversa = p_conversa),
    'atual_em', (select criado_em from chat_versoes where conversa = p_conversa order by versao desc limit 1),
    'atual_mensagens', (select count(*) from conversa_mensagens g where g.conversa = p_conversa and g.versao = (select max(versao) from chat_versoes where conversa = p_conversa)),
    'minima', (select versao_minima from conversas where id = p_conversa),
    'minhas', coalesce((select jsonb_agg(jsonb_build_object('versao', k.versao, 'embrulho', k.embrulho, 'de_publica', k.de_publica) order by k.versao)
                        from chat_chaves k where k.conversa = p_conversa and k.para = p_aparelho), '[]'::jsonb),
    -- Só aparelhos aprovados, com o certificado: cada colega confere a assinatura no próprio aparelho antes de embrulhar.
    'aparelhos', coalesce((select jsonb_agg(jsonb_build_object('id', a.id, 'usuario', a.usuario, 'publica', a.publica, 'certificado', a.certificado) order by a.criado_em)
                           from chat_aparelhos a join conversa_membros m on m.usuario = a.usuario and m.conversa = p_conversa
                           join perfis f on f.id = a.usuario where not f.suspenso and a.certificado is not null), '[]'::jsonb),
    -- A identidade de cada pessoa da conversa, como o banco a conhece. Quem compara com a que já conhecia é o aparelho.
    'identidades', coalesce((select jsonb_agg(jsonb_build_object('usuario', m.usuario, 'nome', f.nome, 'assina', i.assina, 'versao', i.versao) order by f.nome)
                             from conversa_membros m join perfis f on f.id = m.usuario left join chat_identidades i on i.usuario = m.usuario
                             where m.conversa = p_conversa), '[]'::jsonb));
end $$;

/**
 * Cria a versão seguinte da chave de uma conversa, já embrulhada para os aparelhos de quem participa (inclusive o de quem cria).
 * Duas pessoas criando ao mesmo tempo: a segunda recebe "versao_ocupada" e usa a da primeira.
 */
create or replace function public.chat_chave_nova(p_conversa uuid, p_aparelho uuid, p_versao integer, p_embrulhos jsonb) returns jsonb
language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); v_publica text; v_minima integer; v_maxima integer; e jsonb;
begin
  if not interno.na_conversa(p_conversa) then perform interno.erro('nao_encontrado'); end if;
  -- Só aparelho aprovado cria versão de chave.
  select publica into v_publica from chat_aparelhos where id = p_aparelho and usuario = v and certificado is not null;
  if v_publica is null then perform interno.erro('aparelho_desconhecido'); end if;
  perform interno.limite('chat_chave', 120, 60);
  if jsonb_typeof(p_embrulhos) is distinct from 'array' or jsonb_array_length(p_embrulhos) not between 1 and 700 then perform interno.erro('invalido:embrulhos'); end if;
  for e in select * from jsonb_array_elements(p_embrulhos) loop
    if coalesce(e ->> 'para', '') !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
       or coalesce(e ->> 'embrulho', '') !~ '^w1[.][A-Za-z0-9_-]{16}[.][A-Za-z0-9_-]{64}$' then
      perform interno.erro('invalido:embrulhos');
    end if;
  end loop;
  if not exists (select 1 from jsonb_array_elements(p_embrulhos) x where x ->> 'para' = p_aparelho::text) then perform interno.erro('invalido:embrulhos'); end if;
  -- Uma versão nova por vez em cada conversa.
  select versao_minima into v_minima from conversas where id = p_conversa for update;
  select coalesce(max(versao), 0) into v_maxima from chat_versoes where conversa = p_conversa;
  if p_versao is distinct from greatest(v_maxima + 1, v_minima) then perform interno.erro('versao_ocupada'); end if;
  insert into chat_versoes (conversa, versao, criada_por) values (p_conversa, p_versao, p_aparelho);
  -- Só para aparelhos aprovados de quem está na conversa agora; quem saiu nesse meio-tempo fica de fora sem atrapalhar.
  insert into chat_chaves (conversa, versao, para, de, de_publica, embrulho)
  select p_conversa, p_versao, (x ->> 'para')::uuid, p_aparelho, v_publica, x ->> 'embrulho'
  from jsonb_array_elements(p_embrulhos) x
  where exists (select 1 from chat_aparelhos a join conversa_membros m on m.usuario = a.usuario and m.conversa = p_conversa join perfis f on f.id = a.usuario
                where a.id = (x ->> 'para')::uuid and not f.suspenso and a.certificado is not null)
  on conflict do nothing;
  -- Versão trocada há mais de 31 dias não tem mais mensagem nenhuma (tudo some em 30): sai, com os embrulhos.
  delete from chat_versoes x where x.conversa = p_conversa
    and exists (select 1 from chat_versoes y where y.conversa = x.conversa and y.versao > x.versao and y.criado_em < now() - interval '31 days');
  return jsonb_build_object('versao', p_versao);
end $$;

/**
 * O que este aparelho pode repassar: versões de chave que ele tem, de conversas em que a pessoa está, e que algum aparelho de
 * quem participa ainda não recebeu (aparelho novo, pessoa que acabou de entrar). Quem estiver com o painel aberto repassa.
 */
create or replace function public.chat_chaves_pendentes(p_aparelho uuid) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu();
begin
  if not interno.voluntario() then perform interno.erro('sem_permissao'); end if;
  if not exists (select 1 from chat_aparelhos where id = p_aparelho and usuario = v) then perform interno.erro('aparelho_desconhecido'); end if;
  update chat_aparelhos set visto_em = now() where id = p_aparelho and visto_em < now() - interval '1 hour';
  return (select coalesce(jsonb_agg(jsonb_build_object('conversa', y.conversa, 'versao', y.versao, 'para', y.para, 'usuario', y.usuario, 'publica', y.publica, 'certificado', y.certificado)), '[]'::jsonb) from (
    select k.conversa, k.versao, a.id as para, a.usuario, a.publica, a.certificado
    from chat_chaves k
    join conversa_membros minha on minha.conversa = k.conversa and minha.usuario = v
    join conversa_membros m on m.conversa = k.conversa
    join chat_aparelhos a on a.usuario = m.usuario
    join perfis f on f.id = a.usuario and not f.suspenso
    where k.para = p_aparelho and a.certificado is not null
      and not exists (select 1 from chat_chaves x where x.conversa = k.conversa and x.versao = k.versao and x.para = a.id)
    order by k.conversa, k.versao desc
    limit 200) y);
end $$;

/** Repassa chaves: só quem tem aquela versão, só para aparelho de quem está na conversa agora. */
create or replace function public.chat_chaves_dar(p_aparelho uuid, p_embrulhos jsonb) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); v_publica text; e jsonb; v_conversa uuid; v_versao integer; v_para uuid; v_total integer := 0;
begin
  if not interno.voluntario() then perform interno.erro('sem_permissao'); end if;
  -- Só aparelho aprovado repassa chaves.
  select publica into v_publica from chat_aparelhos where id = p_aparelho and usuario = v and certificado is not null;
  if v_publica is null then perform interno.erro('aparelho_desconhecido'); end if;
  perform interno.limite('chat_dar', 600, 60);
  if jsonb_typeof(p_embrulhos) is distinct from 'array' or jsonb_array_length(p_embrulhos) > 200 then perform interno.erro('invalido:embrulhos'); end if;
  for e in select * from jsonb_array_elements(p_embrulhos) loop
    if coalesce(e ->> 'conversa', '') !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
       or coalesce(e ->> 'para', '') !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
       or coalesce(e ->> 'versao', '') !~ '^[1-9][0-9]{0,6}$'
       or coalesce(e ->> 'embrulho', '') !~ '^w1[.][A-Za-z0-9_-]{16}[.][A-Za-z0-9_-]{64}$' then
      perform interno.erro('invalido:embrulhos');
    end if;
    v_conversa := (e ->> 'conversa')::uuid; v_versao := (e ->> 'versao')::integer; v_para := (e ->> 'para')::uuid;
    if exists (select 1 from chat_chaves k join conversa_membros minha on minha.conversa = k.conversa and minha.usuario = v
               where k.conversa = v_conversa and k.versao = v_versao and k.para = p_aparelho)
       and exists (select 1 from chat_aparelhos a join conversa_membros m on m.usuario = a.usuario and m.conversa = v_conversa join perfis f on f.id = a.usuario
                   where a.id = v_para and not f.suspenso and a.certificado is not null) then
      insert into chat_chaves (conversa, versao, para, de, de_publica, embrulho) values (v_conversa, v_versao, v_para, p_aparelho, v_publica, e ->> 'embrulho')
      on conflict do nothing;
      if found then v_total := v_total + 1; end if;
    end if;
  end loop;
  return jsonb_build_object('dadas', v_total);
end $$;

/** Embrulho que este aparelho não conseguiu abrir: sai, para alguém da conversa repassar de novo. */
create or replace function public.chat_chaves_recusar(p_aparelho uuid, p_conversa uuid, p_versao integer) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu();
begin
  if not exists (select 1 from chat_aparelhos where id = p_aparelho and usuario = v) then perform interno.erro('aparelho_desconhecido'); end if;
  perform interno.limite('chat_recusar', 60, 60);
  delete from chat_chaves where conversa = p_conversa and versao = p_versao and para = p_aparelho;
  return jsonb_build_object('ok', true);
end $$;

/** Autodestruição: as mensagens enviadas a partir de agora somem sozinhas depois do prazo. Qualquer participante liga ou desliga. */
create or replace function public.chat_autodestruir(p_id uuid, p_segundos integer) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); v_prazo integer := nullif(coalesce(p_segundos, 0), 0);
begin
  if not interno.na_conversa(p_id) then perform interno.erro('nao_encontrado'); end if;
  perform interno.limite('autodestruir', 30, 60);
  if v_prazo is not null and v_prazo not in (3600, 86400, 604800) then perform interno.erro('invalido:prazo'); end if;
  update conversas set apagar_apos = v_prazo, apagar_por = v, apagar_desde = now() where id = p_id;
  perform interno.chat_aviso(p_id, 'autodestruicao', null, coalesce(v_prazo::text, '0'));
  return jsonb_build_object('apagar_apos', v_prazo);
end $$;

/**
 * O painel chama de minuto em minuto enquanto está aberto: marca que a pessoa está por aqui (é o "online" e o
 * "visto por último" que a equipe vê) e devolve quantas conversas têm mensagem nova.
 */
create or replace function public.presenca() returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu();
begin
  update perfis set visto_em = now() where id = v and visto_em < now() - interval '30 seconds';
  delete from conversa_mensagens where expira_em < now();
  return jsonb_build_object('conversas', case when interno.voluntario() then (
    select count(*) from conversa_membros m left join conversa_prefs p on p.conversa = m.conversa and p.usuario = v
    where m.usuario = v and not coalesce(p.arquivada, false) and not coalesce(p.silenciada_ate > now(), false)
      and (coalesce(p.nao_lida, false) or exists (select 1 from conversa_mensagens g where g.conversa = m.conversa and g.tipo = 'texto' and g.criado_em > m.lido_em and g.autor is distinct from v))) else 0 end);
end $$;

/** As minhas conversas, da mais recente para a mais antiga. Ninguém vê conversa de que não participa, nem a coordenação. */
create or replace function public.chat_conversas() returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); v_mostro boolean := coalesce((select chat_visto from perfis where id = v), true);
begin
  if not interno.voluntario() then perform interno.erro('sem_permissao'); end if;
  update perfis set visto_em = now() where id = v and visto_em < now() - interval '30 seconds';
  -- Nada fica guardado por mais de trinta dias, e o que saiu com autodestruição some no prazo.
  delete from conversa_mensagens where criado_em < now() - interval '30 days' or expira_em < now();
  return (
    select coalesce(jsonb_agg(jsonb_build_object(
      'id', c.id, 'tipo', c.tipo, 'departamento', c.departamento, 'dona', coalesce(c.criada_por = v, false) or interno.coord() or coalesce(m.admin, false),
      'fixada', coalesce(p.fixada, false), 'arquivada', coalesce(p.arquivada, false), 'trancada', coalesce(p.trancada, false),
      'fechada', interno.chat_barrado(c.id) is not null,
      'silenciada', coalesce(p.silenciada_ate > now(), false), 'marcada_nao_lida', coalesce(p.nao_lida, false),
      'descricao', c.descricao,
      'foto', (select jsonb_build_object('id', g.id, 'corpo', g.corpo, 'autor', g.autor, 'criado_em', g.criado_em) from conversa_mensagens g where g.id = c.foto),
      'nome', case when c.tipo = 'direta' then coalesce(interno.nome_visto(o.nome), 'Alguém que saiu da equipe') else c.nome end,
      'outro', case when c.tipo = 'direta' then o.id end,
      -- O "visto por último" só aparece se os dois mostram o próprio.
      'online', case when c.tipo = 'direta' and o.mostra and v_mostro then coalesce(o.visto_em > now() - interval '2 minutes', false) end,
      'visto_em', case when c.tipo = 'direta' and o.mostra and v_mostro then o.visto_em end,
      'membros', (select count(*) from conversa_membros x where x.conversa = c.id),
      'apagar_apos', c.apagar_apos,
      'ultima', (select jsonb_build_object('corpo', g.corpo, 'minha', g.autor = v, 'autor', coalesce((select interno.nome_visto(nome) from perfis where id = g.autor), ''), 'autor_id', g.autor, 'criado_em', g.criado_em, 'versao', g.versao)
                 from conversa_mensagens g where g.conversa = c.id and g.tipo = 'texto' order by g.criado_em desc limit 1),
      'nao_lidas', (select count(*) from conversa_mensagens g where g.conversa = c.id and g.tipo = 'texto' and g.criado_em > m.lido_em and g.autor is distinct from v),
      'movida_em', c.movida_em) order by coalesce(p.fixada, false) desc, c.movida_em desc), '[]'::jsonb)
    from conversa_membros m
    join conversas c on c.id = m.conversa
    left join conversa_prefs p on p.conversa = c.id and p.usuario = v
    left join lateral (select f.id, f.nome, f.visto_em, f.chat_visto as mostra from conversa_membros x join perfis f on f.id = x.usuario
                       where x.conversa = c.id and x.usuario <> v and c.tipo = 'direta' limit 1) o on true
    where m.usuario = v);
end $$;

/** Fixar, arquivar, silenciar (horas; 0 tira), marcar como não lida e trancar: cada campo nulo fica como está. */
create or replace function public.chat_conversa_marcar(p_id uuid, p_fixar boolean default null, p_arquivar boolean default null, p_silenciar_horas integer default null, p_nao_lida boolean default null, p_trancar boolean default null) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu();
begin
  if not interno.na_conversa(p_id) then perform interno.erro('nao_encontrado'); end if;
  if p_silenciar_horas is not null and p_silenciar_horas not in (0, 8, 168, 876000) then perform interno.erro('invalido:horas'); end if;
  insert into conversa_prefs (usuario, conversa) values (v, p_id) on conflict do nothing;
  update conversa_prefs set
    fixada = coalesce(p_fixar, fixada),
    arquivada = coalesce(p_arquivar, arquivada),
    silenciada_ate = case when p_silenciar_horas is null then silenciada_ate when p_silenciar_horas = 0 then null else now() + make_interval(hours => p_silenciar_horas) end,
    nao_lida = coalesce(p_nao_lida, nao_lida),
    trancada = coalesce(p_trancar, trancada)
  where usuario = v and conversa = p_id;
  -- Marcar como não lida: a conversa volta a contar como pendente; mensagem nova tira o arquivamento.
  if p_nao_lida then update conversa_membros set lido_em = lido_em - interval '1 millisecond' where conversa = p_id and usuario = v; end if;
  return jsonb_build_object('ok', true);
end $$;

/** Abre (ou reencontra) a conversa privada com uma pessoa da equipe. */
/** Posso abrir conversa privada com esta pessoa? Liderança de um dos lados, ou colaboração numa contribuição pendente. */
create or replace function interno.privado_permitido(p_usuario uuid) returns boolean language sql stable security definer set search_path = interno, pg_temp as $$
  select interno.gere_cargos()
    or exists (select 1 from papeis where usuario = p_usuario and papel in ('coordenacao', 'vice', 'supervisao'))
    or exists (select 1 from contribuicoes c where c.status = 'pendente'
               and (c.autor = auth.uid() or exists (select 1 from colaboradores k where k.contribuicao = c.id and k.usuario = auth.uid()))
               and (c.autor = p_usuario or exists (select 1 from colaboradores k where k.contribuicao = c.id and k.usuario = p_usuario)))
$$;

/** A coordenação vê quem está em conversa privada (quem, com quem, quando foi a última), nunca o conteúdo. */
create or replace function public.chat_privadas() returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
begin
  perform interno.eu();
  if not interno.lider() then perform interno.erro('sem_permissao'); end if;
  return (select coalesce(jsonb_agg(jsonb_build_object('id', c.id, 'pessoas', (select jsonb_agg(f.nome order by f.nome) from conversa_membros m join perfis f on f.id = m.usuario where m.conversa = c.id),
                                                        'movida_em', c.movida_em, 'mensagens', (select count(*) from conversa_mensagens g where g.conversa = c.id and g.tipo = 'texto')) order by c.movida_em desc), '[]'::jsonb)
          from conversas c where c.tipo = 'direta');
end $$;

/** O que a coordenação fechou nas conversas: tudo, grupos específicos ou pessoas específicas. */
create or replace function interno.chat_controle() returns jsonb language sql stable security definer set search_path = interno, pg_temp as $$
  select coalesce((select valor from configuracoes where chave = 'chat'), '{}'::jsonb)
$$;
/** Esta pessoa está impedida de mandar mensagem nesta conversa? A liderança nunca fica. */
create or replace function interno.chat_barrado(p_conversa uuid) returns text language plpgsql stable security definer set search_path = interno, pg_temp as $$
declare c jsonb := interno.chat_controle();
begin
  if interno.gere_cargos() then return null; end if;
  if c -> 'silenciados' ? auth.uid()::text then return 'silenciado'; end if;
  if coalesce((c ->> 'fechado')::boolean, false) then return 'chat_fechado'; end if;
  if c -> 'grupos_fechados' ? p_conversa::text then return 'chat_fechado'; end if;
  return null;
end $$;

create or replace function public.chat_controles() returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
begin
  perform interno.eu();
  if not interno.lider() then perform interno.erro('sem_permissao'); end if;
  return jsonb_build_object(
    'controle', interno.chat_controle(),
    'grupos', (select coalesce(jsonb_agg(jsonb_build_object('id', c.id, 'nome', c.nome, 'tipo', c.tipo, 'membros', (select count(*) from conversa_membros m where m.conversa = c.id)) order by c.tipo, c.nome), '[]'::jsonb)
               from conversas c where c.tipo in ('grupo', 'departamento')),
    'pessoas', (select coalesce(jsonb_agg(jsonb_build_object('id', f.id, 'nome', f.nome) order by f.nome), '[]'::jsonb)
                from perfis f where not f.suspenso and exists (select 1 from papeis p where p.usuario = f.id)));
end $$;

create or replace function public.chat_controlar(p jsonb) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); c jsonb := interno.chat_controle(); v_novo jsonb;
begin
  if not interno.lider() then perform interno.erro('sem_permissao'); end if;
  v_novo := jsonb_build_object(
    'fechado', coalesce((p ->> 'fechado')::boolean, coalesce((c ->> 'fechado')::boolean, false)),
    'motivo', left(coalesce(p ->> 'motivo', c ->> 'motivo', ''), 200),
    'grupos_fechados', coalesce(p -> 'grupos_fechados', c -> 'grupos_fechados', '[]'::jsonb),
    'silenciados', coalesce(p -> 'silenciados', c -> 'silenciados', '[]'::jsonb));
  insert into configuracoes (chave, valor) values ('chat', v_novo) on conflict (chave) do update set valor = excluded.valor;
  perform interno.registrar('chat_controlado', '', v_novo);
  return v_novo;
end $$;

create or replace function public.chat_direta(p_usuario uuid) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); v_par text; v_id uuid;
begin
  if not interno.voluntario() then perform interno.erro('sem_permissao'); end if;
  if p_usuario is null or p_usuario = v or not interno.da_equipe(p_usuario) then perform interno.erro('invalido:usuario'); end if;
  -- Uso estritamente de trabalho: privado só com a liderança (coordenação, vice, supervisão) ou entre quem está
  -- colaborando numa contribuição em andamento. O resto conversa nos grupos de departamento.
  if not interno.privado_permitido(p_usuario) then perform interno.erro('privado_fechado'); end if;
  if coalesce((interno.chat_controle() ->> 'fechado')::boolean, false) and not interno.gere_cargos() then perform interno.erro('chat_fechado'); end if;
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
  insert into conversa_membros (conversa, usuario, admin) values (v_id, v, true);
  foreach m in array p_membros loop
    if m = v then continue; end if;
    if not interno.da_equipe(m) then perform interno.erro('invalido:membros'); end if;
    insert into conversa_membros (conversa, usuario) values (v_id, m) on conflict do nothing;
    perform interno.avisar(m, coalesce((select nome from perfis where id = v), 'Alguém da equipe') || ' colocou você no grupo "' || v_nome || '". Está em Conversas.');
  end loop;
  perform interno.chat_aviso(v_id, 'criou');
  return jsonb_build_object('id', v_id);
end $$;

/** Trocar o nome, pôr e tirar gente: quem criou o grupo ou a coordenação. */
-- Assinatura nova: a antiga sai antes, senão as duas convivem e a API não sabe qual chamar (erro 300).
drop function if exists public.chat_grupo_mudar(uuid, text, uuid[], uuid[]);
create or replace function public.chat_grupo_mudar(p_id uuid, p_nome text default null, p_incluir uuid[] default '{}', p_tirar uuid[] default '{}',
                                                     p_descricao text default null, p_foto uuid default null, p_so_admins_enviam boolean default null, p_so_admins_mudam boolean default null,
                                                     p_admins uuid[] default '{}', p_tirar_admin uuid[] default '{}') returns jsonb
language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); c conversas; m uuid; v_admin boolean; v_nome text;
begin
  select * into c from conversas where id = p_id and tipo in ('grupo', 'departamento');
  if not found or not interno.na_conversa(p_id) then perform interno.erro('nao_encontrado'); end if;
  v_admin := interno.chat_admin(p_id);
  -- No grupo do departamento quem entra e sai é a função; o representante cuida do resto.
  if c.tipo = 'departamento' and (cardinality(coalesce(p_incluir, '{}')) > 0 or cardinality(coalesce(p_tirar, '{}')) > 0 or cardinality(coalesce(p_admins, '{}')) > 0
                                  or cardinality(coalesce(p_tirar_admin, '{}')) > 0 or nullif(btrim(coalesce(p_nome, '')), '') is not null) then
    perform interno.erro('departamento_fixo');
  end if;
  -- Nome, descrição e foto: administradores, ou todo mundo se o grupo deixar. O resto, só administradores.
  if not v_admin and (c.so_admins_mudam or cardinality(coalesce(p_incluir, '{}')) > 0 or cardinality(coalesce(p_tirar, '{}')) > 0 or p_so_admins_enviam is not null or p_so_admins_mudam is not null
                      or cardinality(coalesce(p_admins, '{}')) > 0 or cardinality(coalesce(p_tirar_admin, '{}')) > 0) then
    perform interno.erro('sem_permissao');
  end if;
  if nullif(btrim(coalesce(p_nome, '')), '') is not null then
    v_nome := interno.txt(p_nome, 'nome', 2, 60);
    if v_nome <> c.nome then update conversas set nome = v_nome where id = p_id; perform interno.chat_aviso(p_id, 'nome', null, v_nome); end if;
  end if;
  if p_descricao is not null and left(btrim(p_descricao), 500) is distinct from c.descricao then
    update conversas set descricao = left(btrim(p_descricao), 500) where id = p_id;
    perform interno.chat_aviso(p_id, 'descricao');
  end if;
  if p_foto is not null then
    if not exists (select 1 from conversa_mensagens where id = p_foto and conversa = p_id and tipo = 'texto') then perform interno.erro('nao_encontrado'); end if;
    update conversas set foto = p_foto where id = p_id;
    perform interno.chat_aviso(p_id, 'foto');
  end if;
  if p_so_admins_enviam is not null and p_so_admins_enviam <> c.so_admins_enviam then
    update conversas set so_admins_enviam = p_so_admins_enviam where id = p_id;
    perform interno.chat_aviso(p_id, case when p_so_admins_enviam then 'so_admins_enviam' else 'todos_enviam' end);
  end if;
  if p_so_admins_mudam is not null and p_so_admins_mudam <> c.so_admins_mudam then
    update conversas set so_admins_mudam = p_so_admins_mudam where id = p_id;
    perform interno.chat_aviso(p_id, case when p_so_admins_mudam then 'so_admins_mudam' else 'todos_mudam' end);
  end if;
  foreach m in array coalesce(p_incluir, '{}') loop
    if not interno.da_equipe(m) then perform interno.erro('invalido:membros'); end if;
    if (select count(*) from conversa_membros where conversa = p_id) >= 61 then perform interno.erro('invalido:membros'); end if;
    insert into conversa_membros (conversa, usuario) values (p_id, m) on conflict do nothing;
    if found then
      perform interno.avisar(m, coalesce((select nome from perfis where id = v), 'Alguém da equipe') || ' colocou você no grupo "' || c.nome || '". Está em Conversas.');
      perform interno.chat_aviso(p_id, 'entrou', m);
    end if;
  end loop;
  foreach m in array coalesce(p_tirar, '{}') loop
    if m is distinct from v and exists (select 1 from conversa_membros where conversa = p_id and usuario = m) then
      perform interno.chat_aviso(p_id, 'tirado', m);
      perform interno.chat_retirar(p_id, m);
    end if;
  end loop;
  foreach m in array coalesce(p_admins, '{}') loop
    update conversa_membros set admin = true where conversa = p_id and usuario = m and not admin;
    if found then perform interno.chat_aviso(p_id, 'admin', m); end if;
  end loop;
  foreach m in array coalesce(p_tirar_admin, '{}') loop
    if m = v and (select count(*) from conversa_membros where conversa = p_id and admin) <= 1 then perform interno.erro('ultimo_admin'); end if;
    update conversa_membros set admin = false where conversa = p_id and usuario = m and admin;
    if found then perform interno.chat_aviso(p_id, 'admin_tirado', m); end if;
  end loop;
  return jsonb_build_object('ok', true);
end $$;

/** Sair de um grupo. O grupo que fica vazio some. Do grupo do próprio departamento ninguém sai: ele acompanha a função. */
create or replace function public.chat_sair(p_id uuid) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu();
begin
  if exists (select 1 from conversas where id = p_id and tipo = 'departamento') then perform interno.erro('departamento_fixo'); end if;
  if not exists (select 1 from conversas where id = p_id and tipo = 'grupo') then perform interno.erro('nao_encontrado'); end if;
  if not exists (select 1 from conversa_membros where conversa = p_id and usuario = v) then perform interno.erro('nao_encontrado'); end if;
  perform interno.chat_aviso(p_id, 'saiu');
  perform interno.chat_retirar(p_id, v);
  -- Se saiu o último administrador, quem está há mais tempo assume.
  if not exists (select 1 from conversa_membros where conversa = p_id and admin) then
    update conversa_membros set admin = true where conversa = p_id and usuario = (select usuario from conversa_membros where conversa = p_id order by entrou_em, ordem limit 1);
  end if;
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
declare v uuid := interno.eu(); c conversas; v_mostro boolean := true; v_confirmo boolean := true;
begin
  if not interno.na_conversa(p_id) then perform interno.erro('nao_encontrado'); end if;
  select * into c from conversas where id = p_id;
  select chat_visto, chat_leitura into v_mostro, v_confirmo from perfis where id = v;
  delete from conversa_mensagens where conversa = p_id and expira_em < now();
  update conversa_membros set lido_em = clock_timestamp() where conversa = p_id and usuario = v;
  update conversa_prefs set nao_lida = false where conversa = p_id and usuario = v and nao_lida;
  update perfis set visto_em = now() where id = v and visto_em < now() - interval '30 seconds';
  return jsonb_build_object(
    'id', c.id, 'tipo', c.tipo, 'departamento', c.departamento, 'nome', c.nome, 'descricao', c.descricao, 'foto', c.foto,
    'so_admins_enviam', c.so_admins_enviam, 'so_admins_mudam', c.so_admins_mudam,
    'admin', c.tipo in ('grupo', 'departamento') and interno.chat_admin(p_id),
    'posso_enviar', (c.tipo = 'direta' or not c.so_admins_enviam or interno.chat_admin(p_id)) and interno.chat_barrado(p_id) is null,
    'barrado', interno.chat_barrado(p_id), 'motivo_do_fechamento', interno.chat_controle() ->> 'motivo',
    'dona', coalesce(c.criada_por = v, false) or (c.tipo = 'grupo' and interno.chat_admin(p_id)),
    'apagar_apos', c.apagar_apos, 'apagar_desde', c.apagar_desde, 'apagar_por', coalesce((select nome from perfis where id = c.apagar_por), ''),
    -- Visto por último e leitura só aparecem entre quem mostra os próprios (os meus e os da outra pessoa).
    'membros', (select coalesce(jsonb_agg(jsonb_build_object('id', f.id, 'nome', interno.nome_visto(f.nome), 'avatar', f.avatar, 'eu', f.id = v,
                  'online', case when f.id = v or (f.chat_visto and v_mostro) then f.visto_em > now() - interval '2 minutes' end,
                  'visto_em', case when f.id = v or (f.chat_visto and v_mostro) then f.visto_em end,
                  'lido_em', case when f.id = v or (f.chat_leitura and v_confirmo) then m.lido_em end,
                  'recebido_em', m.recebido_em, 'admin', m.admin,
                  'digitando', case when f.id <> v and m.digitando_em > now() - interval '8 seconds' then m.digitando else '' end) order by f.nome), '[]'::jsonb)
                from conversa_membros m join perfis f on f.id = m.usuario where m.conversa = p_id),
    'fixadas', coalesce((select jsonb_agg(x.mensagem order by x.criado_em) from conversa_fixadas x where x.conversa = p_id), '[]'::jsonb),
    'favoritas', coalesce((select jsonb_agg(x.mensagem) from conversa_favoritas x join conversa_mensagens g on g.id = x.mensagem where x.usuario = v and g.conversa = p_id), '[]'::jsonb),
    'mensagens', (select coalesce(jsonb_agg(x.j order by x.criado_em, x.ordem), '[]'::jsonb) from (
                    select g.criado_em, g.ordem, jsonb_build_object('id', g.id, 'autor', g.autor, 'nome', coalesce(interno.nome_visto(f.nome), 'Alguém que saiu da equipe'), 'minha', g.autor = v,
                                                           'corpo', g.corpo, 'criado_em', g.criado_em, 'expira_em', g.expira_em, 'tipo', g.tipo, 'alvo', g.alvo, 'detalhe', g.detalhe,
                                                           'anexos', (select coalesce(jsonb_agg(jsonb_build_object('id', n.id, 'uma_vez', n.uma_vez, 'aberto', v = any (n.visto_por), 'disponivel', n.cifrado is not null)), '[]'::jsonb)
                                                                      from conversa_anexos n where n.mensagem = g.id)) as j
                    from conversa_mensagens g left join perfis f on f.id = g.autor where g.conversa = p_id order by g.criado_em desc, g.ordem desc limit 400) x));
end $$;

/**
 * Enviar: texto, ou uma reação ou edição de outra mensagem desta conversa ("alvo"). Reação: uma por pessoa por mensagem (a
 * nova substitui a antiga). Edição: só o autor, só mensagem de texto, só até quinze minutos depois de enviada. O conteúdo
 * (texto, emoji, texto novo) chega cifrado; o banco só sabe o tipo e o alvo.
 */
-- Assinatura nova: a antiga sai antes, senão as duas convivem e a API não sabe qual chamar (erro 300).
drop function if exists public.chat_enviar(uuid, text);
drop function if exists public.chat_enviar(uuid, text, text, uuid);
create or replace function public.chat_enviar(p_id uuid, p_corpo text, p_tipo text default 'texto', p_alvo uuid default null, p_anexos uuid[] default null) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); v_id uuid; v_versao integer; v_prazo integer; a conversa_mensagens; v_presos integer;
begin
  if not interno.na_conversa(p_id) then perform interno.erro('nao_encontrado'); end if;
  perform interno.limite('conversa', 600, 60);
  if coalesce(p_tipo, 'texto') not in ('texto', 'reacao', 'edicao', 'voto', 'rsvp') then perform interno.erro('invalido:tipo'); end if;
  if coalesce(p_tipo, 'texto') = 'texto' and exists (select 1 from conversas where id = p_id and so_admins_enviam and tipo <> 'direta') and not interno.chat_admin(p_id) then perform interno.erro('so_admins'); end if;
  if interno.chat_barrado(p_id) is not null then perform interno.erro(interno.chat_barrado(p_id)); end if;
  -- O banco recusa texto aberto: só entra o que já chega cifrado com a chave atual da conversa.
  v_versao := interno.chat_versao_valida(p_id, p_corpo);
  if p_tipo in ('reacao', 'edicao', 'voto', 'rsvp') then
    select * into a from conversa_mensagens where id = p_alvo and conversa = p_id and tipo = 'texto';
    if not found then perform interno.erro('nao_encontrado'); end if;
    if p_tipo = 'edicao' and a.autor is distinct from v then perform interno.erro('sem_permissao'); end if;
    if p_tipo = 'edicao' and a.criado_em < now() - interval '15 minutes' then perform interno.erro('fora_do_prazo'); end if;
    -- Reação, voto e resposta a evento: uma por pessoa por mensagem (a nova troca a anterior).
    if p_tipo in ('reacao', 'voto', 'rsvp') then delete from conversa_mensagens where tipo = p_tipo and alvo = p_alvo and autor = v; end if;
  elsif p_alvo is not null then
    perform interno.erro('invalido:alvo');
  end if;
  select apagar_apos into v_prazo from conversas where id = p_id;
  insert into conversa_mensagens (conversa, autor, corpo, versao, expira_em, tipo, alvo)
  values (p_id, v, p_corpo, v_versao, case when p_tipo in ('reacao', 'edicao', 'voto', 'rsvp') then a.expira_em when v_prazo is not null then now() + make_interval(secs => v_prazo) end, coalesce(p_tipo, 'texto'), p_alvo)
  returning id into v_id;
  if coalesce(p_tipo, 'texto') = 'texto' then
    update conversas set movida_em = now() where id = p_id;
    update conversa_membros set lido_em = clock_timestamp(), digitando_em = null, digitando = '' where conversa = p_id and usuario = v;
    -- Mensagem nova desarquiva a conversa para quem a tinha arquivado.
    update conversa_prefs set arquivada = false where conversa = p_id and arquivada;
  end if;
  -- Os arquivos que subiram antes ficam presos à mensagem: só os meus, só desta conversa, só os ainda soltos, e todos ou nada.
  if p_anexos is not null and cardinality(p_anexos) > 0 then
    if coalesce(p_tipo, 'texto') <> 'texto' or cardinality(p_anexos) > 6 then perform interno.erro('invalido:anexos'); end if;
    update conversa_anexos set mensagem = v_id where id = any (p_anexos) and conversa = p_id and autor = v and mensagem is null;
    get diagnostics v_presos = row_count;
    if v_presos <> cardinality(p_anexos) then perform interno.erro('invalido:anexos'); end if;
  end if;
  return jsonb_build_object('id', v_id);
end $$;

/**
 * Relatar à coordenação: a pessoa escolhe mensagens de uma conversa em que está, o aparelho dela abre e manda o texto
 * aberto. É a única porta pela qual a coordenação lê conteúdo de conversa, e só o que quem relata escolheu.
 */
create or replace function public.chat_relatar(p_conversa uuid, p_contra uuid, p_motivo text, p_mensagens jsonb) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); v_id uuid; v_nome text;
begin
  if not interno.na_conversa(p_conversa) then perform interno.erro('nao_encontrado'); end if;
  perform interno.limite('relato', 10, 1440);
  if p_contra is not null and not exists (select 1 from conversa_membros where conversa = p_conversa and usuario = p_contra) then perform interno.erro('invalido:contra'); end if;
  if jsonb_typeof(p_mensagens) <> 'array' or jsonb_array_length(p_mensagens) > 50 then perform interno.erro('invalido:mensagens'); end if;
  select case when tipo = 'direta' then 'Conversa privada' else nome end into v_nome from conversas where id = p_conversa;
  insert into conversa_relatos (conversa, conversa_nome, autor, contra, motivo, mensagens)
  values (p_conversa, v_nome, v, p_contra, interno.txt(p_motivo, 'motivo', 2, 500),
          (select coalesce(jsonb_agg(jsonb_build_object('id', left(x->>'id', 40), 'autor', left(x->>'autor', 80), 'quando', left(x->>'quando', 40), 'texto', left(x->>'texto', 4000))), '[]'::jsonb) from jsonb_array_elements(p_mensagens) x))
  returning id into v_id;
  perform interno.avisar_lideranca('Relato novo de conversa da equipe: ' || coalesce((select nome from perfis where id = v), 'alguém') || ' pediu que a coordenação olhe mensagens. Veja em Conversas → Relatos.', v);
  perform interno.registrar('chat_relato', v_id::text, jsonb_build_object('conversa', p_conversa));
  return jsonb_build_object('id', v_id);
end $$;

/** Os relatos, para quem gere a equipe (coordenação, vice e supervisão). */
create or replace function public.marketing_sugerir(p_texto text, p_quando text default '') returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); v_id uuid;
begin
  if not interno.voluntario() then perform interno.erro('sem_permissao'); end if;
  perform interno.limite('marketing_caixa', 20, 1440);
  insert into marketing_caixa (autor, texto, quando) values (v, interno.txt(p_texto, 'texto', 5, 2000), left(btrim(coalesce(p_quando, '')), 120)) returning id into v_id;
  perform interno.avisar(f.id, coalesce((select interno.primeiro_nome(nome) from perfis where id = v), 'Alguém') || ' mandou uma sugestão para a divulgação. Está na caixa de entrada do marketing, em Divulgação.')
    from perfis f where not f.suspenso and exists (select 1 from papeis p where p.usuario = f.id and p.papel = 'marketing');
  return jsonb_build_object('id', v_id);
end $$;

create or replace function interno.ve_marketing() returns boolean language sql stable as $$
  select interno.coord() or interno.tem('supervisao') or interno.tem('marketing') or interno.tem('design')
$$;

create or replace function public.marketing_caixa() returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
begin
  perform interno.eu();
  if not interno.ve_marketing() then perform interno.erro('sem_permissao'); end if;
  return (select coalesce(jsonb_agg(jsonb_build_object('id', m.id, 'autor', coalesce(interno.nome_visto(f.nome), ''), 'texto', m.texto, 'quando', m.quando, 'status', m.status, 'criado_em', m.criado_em, 'decidido_em', m.decidido_em)
                                    order by case m.status when 'nova' then 0 when 'em_andamento' then 1 else 2 end, m.criado_em desc), '[]'::jsonb)
          from marketing_caixa m left join perfis f on f.id = m.autor where m.criado_em > now() - interval '180 days');
end $$;

create or replace function public.marketing_caixa_decidir(p_id uuid, p_status text) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu();
begin
  if not interno.ve_marketing() then perform interno.erro('sem_permissao'); end if;
  if coalesce(p_status, '') not in ('nova', 'em_andamento', 'feita', 'descartada') then perform interno.erro('invalido:status'); end if;
  update marketing_caixa set status = p_status, por = v, decidido_em = now() where id = p_id;
  if not found then perform interno.erro('nao_encontrado'); end if;
  return jsonb_build_object('ok', true);
end $$;

/**
 * Estatísticas pedagógicas, por disciplina, para a coordenação e a coordenação pedagógica decidirem o que entra e o que
 * sai: aulas enviadas e aprovadas, pedidos de reforço, aulas em vídeo, aulas ao vivo e inscrições, dúvidas da comunidade
 * e quantos educadores cada disciplina tem. Só contagens; nenhum dado de pessoa.
 */
create or replace function public.painel_estatisticas() returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
begin
  perform interno.eu();
  if not (interno.lider() or interno.tem('vice')) then perform interno.erro('sem_permissao'); end if;
  return jsonb_build_object(
    'disciplinas', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'disciplina', d.disciplina,
        'aulas_aprovadas', (select count(*) from contribuicoes c where c.disciplina = d.disciplina and c.tipo in ('aula', 'avulso') and c.status in ('aprovada', 'publicada')),
        'aulas_pendentes', (select count(*) from contribuicoes c where c.disciplina = d.disciplina and c.tipo in ('aula', 'avulso') and c.status = 'pendente'),
        'aulas_recusadas', (select count(*) from contribuicoes c where c.disciplina = d.disciplina and c.tipo in ('aula', 'avulso') and c.status = 'recusada'),
        'aulas_90d', (select count(*) from contribuicoes c where c.disciplina = d.disciplina and c.tipo in ('aula', 'avulso') and c.criado_em > now() - interval '90 days'),
        'reforco_abertos', (select count(*) from reforco r where r.disciplina = d.disciplina and r.status in ('aberto', 'em_atendimento')),
        'reforco_total', (select count(*) from reforco r where r.disciplina = d.disciplina),
        'reforco_90d', (select count(*) from reforco r where r.disciplina = d.disciplina and r.criado_em > now() - interval '90 days'),
        'videoaulas', (select count(*) from videoaulas a where a.disciplina = d.disciplina and a.status in ('aprovada', 'publicada')),
        'aulas_ao_vivo', (select count(*) from aulas_ao_vivo a where a.disciplina = d.disciplina),
        'inscricoes_ao_vivo', (select count(*) from aulas_inscricoes i join aulas_ao_vivo a on a.id = i.aula where a.disciplina = d.disciplina),
        'duvidas_comunidade', (select count(*) from topicos t where t.disciplina = d.disciplina),
        'educadores', (select count(distinct p.usuario) from papeis p join perfis f on f.id = p.usuario where p.disciplina = d.disciplina and p.papel in ('educacao', 'educacao_secundaria') and not f.suspenso)
      ) order by d.disciplina), '[]'::jsonb)
      from (select disciplina from contribuicoes where disciplina is not null union select disciplina from reforco union select disciplina from videoaulas
            union select disciplina from aulas_ao_vivo union select disciplina from topicos where disciplina is not null
            union select disciplina from papeis where disciplina is not null and papel in ('educacao', 'educacao_secundaria')) d),
    'meses', (
      select coalesce(jsonb_agg(jsonb_build_object('mes', m.mes,
        'aulas', (select count(*) from contribuicoes c where c.tipo in ('aula', 'avulso') and to_char(c.criado_em, 'YYYY-MM') = m.mes),
        'reforco', (select count(*) from reforco r where to_char(r.criado_em, 'YYYY-MM') = m.mes),
        'duvidas', (select count(*) from topicos t where to_char(t.criado_em, 'YYYY-MM') = m.mes)) order by m.mes), '[]'::jsonb)
      from (select to_char(date_trunc('month', now()) - (n || ' months')::interval, 'YYYY-MM') as mes from generate_series(0, 5) n) m),
    'pedidos_de_disciplina', (select coalesce(jsonb_agg(jsonb_build_object('titulo', c.titulo, 'corpo', left(c.corpo, 400), 'criado_em', c.criado_em, 'status', c.status) order by c.criado_em desc), '[]'::jsonb)
                              from (select * from contribuicoes where tipo = 'sugestao' order by criado_em desc limit 50) c),
    -- O retrato geral, em contagens e tempos: tamanho da equipe por papel, o que chegou no ano, quanto a revisão demora,
    -- quanto o reforço demora a ser atendido e o que está esperando alguém. Nenhum nome, nenhum e-mail.
    'panorama', jsonb_build_object(
      'equipe', (select count(distinct p.usuario) from papeis p join perfis f on f.id = p.usuario where not f.suspenso),
      'por_papel', (select coalesce(jsonb_object_agg(x.papel, x.n), '{}'::jsonb)
                    from (select p.papel, count(distinct p.usuario) as n from papeis p join perfis f on f.id = p.usuario where not f.suspenso group by p.papel) x),
      'por_tipo_365d', (select coalesce(jsonb_object_agg(x.tipo, x.n), '{}'::jsonb)
                        from (select tipo, count(*) as n from contribuicoes where criado_em > now() - interval '365 days' group by tipo) x),
      'na_fila', (select count(*) from contribuicoes where status = 'pendente'),
      'fila_mais_antiga_dias', (select coalesce(extract(day from now() - min(criado_em))::int, 0) from contribuicoes where status = 'pendente'),
      'revisao_mediana_horas', (select coalesce(round((percentile_cont(0.5) within group (order by extract(epoch from revisado_em - criado_em)) / 3600)::numeric, 1), 0)
                                from contribuicoes where revisado_em is not null and criado_em > now() - interval '180 days'),
      'aprovadas_180d', (select count(*) from contribuicoes where status in ('aprovada', 'publicada', 'resolvida') and criado_em > now() - interval '180 days'),
      'recusadas_180d', (select count(*) from contribuicoes where status = 'recusada' and criado_em > now() - interval '180 days'),
      'reforco_atendidos_90d', (select count(*) from reforco where status = 'atendido' and criado_em > now() - interval '90 days'),
      'reforco_validos_90d', (select count(*) from reforco where status <> 'cancelado' and criado_em > now() - interval '90 days'),
      'reforco_espera_mediana_horas', (select coalesce(round((percentile_cont(0.5) within group (order by extract(epoch from atendido_em - criado_em)) / 3600)::numeric, 1), 0)
                                       from reforco where atendido_em is not null and criado_em > now() - interval '180 days'),
      'reforco_aberto_mais_antigo_dias', (select coalesce(extract(day from now() - min(criado_em))::int, 0) from reforco where status in ('aberto', 'em_atendimento')),
      'erros_abertos', (select count(*) from erros_relatados where status in ('novo', 'visto')),
      'saude_publicados', (select count(*) from saude_perfis where status = 'publicado'),
      'saude_aguardando', (select count(*) from saude_perfis where status = 'aguardando')));
end $$;

create or replace function public.chat_relatos() returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
begin
  if not interno.gere_cargos() then perform interno.erro('sem_permissao'); end if;
  return (select coalesce(jsonb_agg(jsonb_build_object('id', r.id, 'conversa_nome', r.conversa_nome, 'autor', coalesce(a.nome, ''), 'contra', coalesce(c.nome, ''), 'motivo', r.motivo,
                                                        'mensagens', r.mensagens, 'status', r.status, 'nota', r.nota, 'criado_em', r.criado_em) order by r.criado_em desc), '[]'::jsonb)
          from conversa_relatos r left join perfis a on a.id = r.autor left join perfis c on c.id = r.contra);
end $$;

create or replace function public.chat_relato_resolver(p_id uuid, p_nota text default '') returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
begin
  if not interno.gere_cargos() then perform interno.erro('sem_permissao'); end if;
  update conversa_relatos set status = 'resolvido', nota = left(coalesce(p_nota, ''), 2000), resolvido_por = auth.uid() where id = p_id and status = 'aberto';
  if not found then perform interno.erro('nao_encontrado'); end if;
  return jsonb_build_object('ok', true);
end $$;

/**
 * Subir um arquivo já cifrado no aparelho (base64 do cifrado). Fica solto até chat_enviar prendê-lo à mensagem. O banco
 * confere só o tamanho e a quantidade; o tipo e o conteúdo ele não vê.
 */
create or replace function public.chat_anexo_enviar(p_conversa uuid, p_cifrado text, p_uma_vez boolean default false) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); v_bytes bytea; v_id uuid;
begin
  if not interno.na_conversa(p_conversa) then perform interno.erro('nao_encontrado'); end if;
  perform interno.limite('anexo', 120, 60);
  if coalesce(p_cifrado, '') !~ '^[A-Za-z0-9+/=\s]{24,}$' or char_length(p_cifrado) > 16800000 then perform interno.erro('invalido:arquivo'); end if;
  v_bytes := decode(regexp_replace(p_cifrado, '\s', '', 'g'), 'base64');
  if length(v_bytes) > 12582912 + 16 then perform interno.erro('invalido:tamanho'); end if;
  if (select count(*) from conversa_anexos where autor = v and mensagem is null) >= 12 then perform interno.erro('invalido:anexos'); end if;
  insert into conversa_anexos (conversa, autor, cifrado, tamanho, uma_vez) values (p_conversa, v, v_bytes, length(v_bytes), coalesce(p_uma_vez, false)) returning id into v_id;
  return jsonb_build_object('id', v_id);
end $$;

/**
 * Baixar o cifrado de um arquivo de uma conversa em que estou. "Ver uma vez": quem enviou não relê; cada um dos outros lê
 * uma só vez, e quando todos leram (ou a mensagem some) os bytes vão embora.
 */
create or replace function public.chat_anexo_ler(p_id uuid) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); a conversa_anexos; v_faltam integer;
begin
  select * into a from conversa_anexos where id = p_id;
  if not found or a.mensagem is null or not interno.na_conversa(a.conversa) then perform interno.erro('nao_encontrado'); end if;
  perform interno.limite('anexo_ler', 600, 60);
  if a.uma_vez then
    if a.autor = v or v = any (a.visto_por) or a.cifrado is null then perform interno.erro('ja_visto'); end if;
    update conversa_anexos set visto_por = array_append(visto_por, v) where id = p_id;
    select count(*) into v_faltam from conversa_membros m where m.conversa = a.conversa and m.usuario <> a.autor and m.usuario <> v and not (m.usuario = any (a.visto_por));
    if v_faltam = 0 then update conversa_anexos set cifrado = null where id = p_id; end if;
  end if;
  return jsonb_build_object('cifrado', encode(a.cifrado, 'base64'), 'uma_vez', a.uma_vez);
end $$;

/** Cada pessoa apaga as próprias mensagens (e as próprias reações e edições). Apagar o texto leva as reações e edições junto. */
create or replace function public.chat_apagar(p_id uuid) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu();
begin
  delete from conversa_mensagens where id = p_id and autor = v and tipo <> 'sistema' and interno.na_conversa(conversa);
  if not found then perform interno.erro('nao_encontrado'); end if;
  return jsonb_build_object('ok', true);
end $$;

/** O aparelho avisa que recebeu (abriu) as mensagens da conversa até agora: é o segundo tique de quem enviou. */
create or replace function public.chat_recebidas(p_id uuid) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu();
begin
  update conversa_membros set recebido_em = clock_timestamp() where conversa = p_id and usuario = v;
  if not found then perform interno.erro('nao_encontrado'); end if;
  return jsonb_build_object('ok', true);
end $$;

/** "Fulano está digitando…" (ou gravando um áudio): vale por oito segundos; o painel renova enquanto a pessoa escreve. */
create or replace function public.chat_digitando(p_id uuid, p_tipo text default 'texto') returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu();
begin
  if coalesce(p_tipo, '') not in ('', 'texto', 'audio') then perform interno.erro('invalido:tipo'); end if;
  perform interno.limite('digitando', 600, 60);
  update conversa_membros set digitando_em = case when p_tipo = '' then null else now() end, digitando = coalesce(p_tipo, '') where conversa = p_id and usuario = v;
  if not found then perform interno.erro('nao_encontrado'); end if;
  return jsonb_build_object('ok', true);
end $$;

/** Fixar (ou desafixar) uma mensagem para todos da conversa. Qualquer participante; no máximo cinco por conversa. */
create or replace function public.chat_fixar(p_mensagem uuid, p_fixar boolean default true) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); v_conversa uuid;
begin
  select conversa into v_conversa from conversa_mensagens where id = p_mensagem and tipo = 'texto';
  if v_conversa is null or not interno.na_conversa(v_conversa) then perform interno.erro('nao_encontrado'); end if;
  if coalesce(p_fixar, true) then
    if (select count(*) from conversa_fixadas where conversa = v_conversa and mensagem <> p_mensagem) >= 5 then perform interno.erro('limite_fixadas'); end if;
    insert into conversa_fixadas (mensagem, conversa, por) values (p_mensagem, v_conversa, v) on conflict do nothing;
  else
    delete from conversa_fixadas where mensagem = p_mensagem;
  end if;
  return jsonb_build_object('ok', true);
end $$;

/** Favoritar (ou desfavoritar) uma mensagem, só para mim, em todos os meus aparelhos. */
create or replace function public.chat_favoritar(p_mensagem uuid, p_favoritar boolean default true) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); v_conversa uuid;
begin
  select conversa into v_conversa from conversa_mensagens where id = p_mensagem and tipo = 'texto';
  if v_conversa is null or not interno.na_conversa(v_conversa) then perform interno.erro('nao_encontrado'); end if;
  if coalesce(p_favoritar, true) then insert into conversa_favoritas (usuario, mensagem) values (v, p_mensagem) on conflict do nothing;
  else delete from conversa_favoritas where usuario = v and mensagem = p_mensagem; end if;
  return jsonb_build_object('ok', true);
end $$;

/** As minhas mensagens favoritas, de todas as conversas, para a lista "Favoritas". */
create or replace function public.chat_favoritas() returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu();
begin
  return (select coalesce(jsonb_agg(jsonb_build_object('id', g.id, 'conversa', g.conversa, 'conversa_nome', case when c.tipo = 'direta' then coalesce((select interno.nome_visto(p.nome) from conversa_membros x join perfis p on p.id = x.usuario where x.conversa = c.id and x.usuario <> v limit 1), '') else c.nome end,
            'autor', g.autor, 'nome', coalesce(interno.nome_visto(f.nome), ''), 'corpo', g.corpo, 'criado_em', g.criado_em, 'versao', g.versao) order by x.criado_em desc), '[]'::jsonb)
          from conversa_favoritas x join conversa_mensagens g on g.id = x.mensagem join conversas c on c.id = g.conversa left join perfis f on f.id = g.autor
          where x.usuario = v and interno.na_conversa(g.conversa));
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

/** O livro, do mais recente para o mais antigo. A coordenação e a vice-coordenação leem, e a supervisão também (só leitura). */
create or replace function public.audit_logs_listar(p_pagina integer default 0, p_tabela text default null) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
begin
  perform interno.eu();
  if not interno.supervisor() then perform interno.erro('sem_permissao'); end if;
  return (
    select coalesce(jsonb_agg(jsonb_build_object('id', a.id, 'criado_em', a.criado_em, 'tabela', a.tabela, 'acao', a.acao, 'titulo', a.titulo, 'de', a.de, 'para', a.para,
      'campos', to_jsonb(a.campos), 'via', a.via, 'detalhes', a.detalhes,
      'nome', coalesce((select f.nome from perfis f where f.id = a.quem), ''),
      'alvo_nome', coalesce((select f.nome from perfis f where f.id::text = a.detalhes ->> 'usuario'), '')) order by a.id desc), '[]'::jsonb)
    from (select * from audit_logs where coalesce(p_tabela, '') = '' or tabela = p_tabela order by id desc limit 100 offset greatest(coalesce(p_pagina, 0), 0) * 100) a);
end $$;

-- ───────────────────────────── Envio dos e-mails ─────────────────────────────

/**
 * Para a rotina "Enviar e-mails" (só com a chave de serviço): pega até p_limite e-mails da fila e os marca como "enviando".
 * Envio que começou e não terminou em quinze minutos volta para a fila; depois de cinco tentativas, o e-mail é dado como falho.
 */
create or replace function public.emails_pendentes(p_limite integer default 50) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v_ids uuid[];
begin
  if not interno.servico() then perform interno.erro('sem_permissao'); end if;
  update emails set status = case when tentativas >= 5 then 'falhou' else 'pendente' end, erro = case when tentativas >= 5 then 'sem resposta do envio' else erro end
  where status = 'enviando' and tentado_em < now() - interval '15 minutes';
  select array_agg(id) into v_ids from (
    select id from emails where status = 'pendente' order by criado_em limit greatest(1, least(coalesce(p_limite, 50), 100)) for update skip locked) x;
  update emails set status = 'enviando', tentado_em = now(), tentativas = tentativas + 1 where id = any (coalesce(v_ids, '{}'));
  return (select coalesce(jsonb_agg(jsonb_build_object('id', e.id, 'para', e.para, 'assunto', e.assunto, 'texto', e.texto, 'sair', e.sair,
            'blocos', coalesce(b.blocos, 'null'::jsonb), 'preheader', coalesce(b.preheader, '')) order by e.criado_em), '[]'::jsonb)
          from emails e left join boletim_edicoes b on b.id = e.edicao where e.id = any (coalesce(v_ids, '{}')));
end $$;

/** Para a rotina de envio: o resultado de cada e-mail. Enviado, o texto sai do banco (ele pode levar um link de convite). */
create or replace function public.email_resultado(p_id uuid, p_ok boolean, p_erro text default '') returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v_achou boolean;
begin
  if not interno.servico() then perform interno.erro('sem_permissao'); end if;
  if coalesce(p_ok, false) then
    update emails set status = 'enviado', enviado_em = now(), texto = '', erro = '' where id = p_id and status = 'enviando';
    if found then
      insert into configuracoes (chave, valor) values ('email', '{"ativo": true}'::jsonb) on conflict (chave) do update set valor = configuracoes.valor || '{"ativo": true}'::jsonb;
    end if;
  else
    update emails set status = case when tentativas >= 5 or coalesce(p_erro, '') = 'recusado' then 'falhou' else 'pendente' end, erro = left(coalesce(p_erro, ''), 200) where id = p_id and status = 'enviando';
  end if;
  v_achou := found;
  -- Boletim: cada falha definitiva conta para o endereço; três seguidas e ele para de receber até alguém reativar.
  update boletim b set falhas = case when coalesce(p_ok, false) then 0 else b.falhas + 1 end,
                       pausado = b.pausado or (not coalesce(p_ok, false) and b.falhas + 1 >= 3)
  from emails e where e.id = p_id and e.tipo = 'boletim' and b.email = e.para and (coalesce(p_ok, false) or e.status = 'falhou');
  return jsonb_build_object('ok', v_achou);
end $$;

/** O que a coordenação vê sobre os e-mails: quantos esperam, quantos saíram e o último erro. Sem endereço de ninguém. */
create or replace function public.emails_situacao() returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
begin
  perform interno.eu();
  if not interno.coord() then perform interno.erro('sem_permissao'); end if;
  return jsonb_build_object(
    'pendentes', (select count(*) from emails where status in ('pendente', 'enviando')),
    'enviados_7_dias', (select count(*) from emails where status = 'enviado' and enviado_em > now() - interval '7 days'),
    'falhos_7_dias', (select count(*) from emails where status = 'falhou' and criado_em > now() - interval '7 days'),
    'ultimo_envio', (select max(enviado_em) from emails),
    'mais_antigo_esperando', (select min(criado_em) from emails where status in ('pendente', 'enviando')),
    -- Esperando há mais de meia hora: a rotina de envio não está rodando, ou está sem a chave.
    'parado', exists (select 1 from emails where status in ('pendente', 'enviando') and criado_em < now() - interval '30 minutes'),
    'ultimo_erro', (select erro from emails where erro <> '' order by coalesce(tentado_em, criado_em) desc limit 1));
end $$;

-- ───────────────────────────── Supervisão: as proteções reversíveis ─────────────────────────────

/** O que a supervisão precisa ver das proteções reversíveis: a pausa geral de envios e o modo de segurança da Comunidade. */
create or replace function public.protecoes() returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
begin
  perform interno.eu();
  if not interno.supervisor() then perform interno.erro('sem_permissao'); end if;
  return jsonb_build_object(
    'pausa', coalesce((select (valor ->> 'pausa')::boolean from configuracoes where chave = 'site'), false),
    'motivo', coalesce((select valor ->> 'motivo' from configuracoes where chave = 'site'), ''),
    'aprovacao_manual', interno.aprovacao_manual());
end $$;

/**
 * O freio de emergência também nas mãos da supervisão: pausar ou retomar os envios do público, com um recado opcional.
 * Não mexe na faixa do alto nem no cadastro, que são decisões da coordenação (e a pausa, enquanto dura, já fecha o
 * cadastro). Fica no registro, e a coordenação é avisada.
 */
create or replace function public.site_pausa(p_pausa boolean, p_motivo text default '') returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); v_pausa boolean := coalesce(p_pausa, false); v_motivo text := interno.txt(p_motivo, 'motivo', 0, 200);
begin
  if not interno.supervisor() then perform interno.erro('sem_permissao'); end if;
  if not v_pausa then v_motivo := ''; end if;
  insert into configuracoes (chave, valor) values ('site', jsonb_build_object('pausa', v_pausa, 'motivo', v_motivo))
  on conflict (chave) do update set valor = configuracoes.valor || excluded.valor;
  perform interno.registrar('site_pausa', '', jsonb_build_object('pausa', v_pausa, 'motivo', v_motivo));
  perform interno.avisar_lideranca(case when v_pausa then 'Os envios do público foram pausados' else 'Os envios do público foram retomados' end
    || ' por ' || coalesce((select nome from perfis where id = v), 'alguém da equipe') || '.', v);
  return public.protecoes();
end $$;

-- ───────────────────────────── Marketing e divulgação ─────────────────────────────

create or replace function interno.divulgacao_json(d interno.divulgacao) returns jsonb language sql stable security definer set search_path = interno, pg_temp as $$
  select jsonb_build_object(
    'id', d.id, 'rede', d.rede, 'formato', d.formato, 'titulo', d.titulo, 'legenda', d.legenda, 'data_prevista', d.data_prevista, 'material', d.material,
    'situacao', d.situacao, 'nota', d.nota, 'devolvido', d.devolvido, 'criado_em', d.criado_em, 'mexido_em', d.mexido_em,
    'criado_por', coalesce((select nome from perfis where id = d.criado_por), ''), 'mexido_por', coalesce((select nome from perfis where id = d.mexido_por), ''),
    'responsavel_id', d.responsavel, 'responsavel', coalesce((select interno.nome_visto(nome) from perfis where id = d.responsavel), ''),
    'aprovado_por', coalesce((select interno.nome_visto(nome) from perfis where id = d.aprovado_por), ''), 'aprovado_em', d.aprovado_em)
$$;

/** O material de um item: um endereço https, ou um arquivo que a coordenação aprovou e que já está publicado no site. */
create or replace function interno.material_ok(p text) returns text language plpgsql stable security definer set search_path = interno, pg_temp as $$
declare v text := btrim(coalesce(p, ''));
begin
  if v = '' then return ''; end if;
  if char_length(v) <= 500 and v ~ '^https://[^[:space:]]+$' then return v; end if;
  if v ~ '^/arquivos/[a-f0-9]{20}[.](webp|jpg|pdf)$' and exists (select 1 from arquivos where destino = v and status = 'publicado') then return v; end if;
  raise exception 'invalido:material' using errcode = 'P0001';
end $$;

/** O calendário editorial e o endereço público do perfil do instituto. Marketing, coordenação e vice-coordenação. */
create or replace function public.divulgacao_listar() returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
begin
  perform interno.eu();
  if not interno.divulga() then perform interno.erro('sem_permissao'); end if;
  return jsonb_build_object(
    'instagram', coalesce((select valor ->> 'instagram' from configuracoes where chave = 'divulgacao'), ''),
    'itens', coalesce((select jsonb_agg(interno.divulgacao_json(d) order by d.data_prevista nulls last, d.criado_em) from divulgacao d), '[]'::jsonb));
end $$;

/**
 * Cria ou corrige um item do calendário, com a situação junto (ideia, rascunho, pronto, publicado). Mexer num item que a
 * coordenação devolveu tira a marca de devolvido. Guarda quem criou e quem mexeu por último.
 */
create or replace function public.divulgacao_salvar(p jsonb) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare
  v uuid := interno.eu();
  v_id uuid := nullif(p ->> 'id', '')::uuid;
  v_rede text := coalesce(nullif(p ->> 'rede', ''), 'instagram');
  v_formato text := coalesce(nullif(p ->> 'formato', ''), 'post');
  v_situacao text := coalesce(nullif(p ->> 'situacao', ''), 'ideia');
  v_resp uuid;
  v_data date; v_titulo text; v_legenda text; v_material text; d divulgacao; v_aprovado uuid; v_aprovado_em timestamptz;
begin
  if not interno.divulga() then perform interno.erro('sem_permissao'); end if;
  perform interno.limite('divulgacao', 120, 60);
  if v_rede not in ('instagram', 'outra') then perform interno.erro('invalido:rede'); end if;
  if v_formato not in ('post', 'carrossel', 'story', 'reels', 'video', 'outro') then perform interno.erro('invalido:formato'); end if;
  if v_situacao not in ('ideia', 'rascunho', 'pronto', 'publicado') then perform interno.erro('invalido:situacao'); end if;
  if coalesce(p ->> 'data_prevista', '') <> '' then
    begin
      if (p ->> 'data_prevista') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' then raise exception 'data'; end if;
      v_data := (p ->> 'data_prevista')::date;
    exception when others then
      perform interno.erro('invalido:data_prevista');
    end;
  end if;
  begin
    v_resp := nullif(p ->> 'responsavel', '')::uuid;
  exception when others then
    perform interno.erro('invalido:responsavel');
  end;
  if v_resp is not null and not exists (select 1 from papeis where usuario = v_resp) then perform interno.erro('invalido:responsavel'); end if;
  v_titulo := interno.txt(p ->> 'titulo', 'titulo', 3, 120);
  v_legenda := interno.txt(p ->> 'legenda', 'legenda', 0, 2200);
  v_material := interno.material_ok(p ->> 'material');
  if v_id is not null then
    select * into d from divulgacao where id = v_id for update;
    if not found then perform interno.erro('nao_encontrado'); end if;
  end if;
  v_aprovado := d.aprovado_por;
  v_aprovado_em := d.aprovado_em;
  -- "Pronto para sair" é aprovação: só quem aprova marca. Quem não aprova e mexe no texto de uma peça já aprovada a devolve
  -- para rascunho (precisa de aprovação de novo); só mudar para "publicado" mantém a aprovação.
  if v_situacao = 'pronto' and coalesce(d.situacao, '') <> 'pronto' then
    if not interno.aprova_divulgacao() then perform interno.erro('sem_permissao:aprovar'); end if;
    v_aprovado := v; v_aprovado_em := now();
  elsif v_situacao = 'pronto' and (d.titulo, d.legenda, d.material, d.formato) is distinct from (v_titulo, v_legenda, v_material, v_formato) then
    if interno.aprova_divulgacao() then v_aprovado := v; v_aprovado_em := now(); else v_situacao := 'rascunho'; v_aprovado := null; v_aprovado_em := null; end if;
  elsif v_situacao in ('ideia', 'rascunho') then
    v_aprovado := null; v_aprovado_em := null;
  end if;
  if v_id is null then
    insert into divulgacao (rede, formato, titulo, legenda, data_prevista, material, situacao, criado_por, mexido_por, responsavel, aprovado_por, aprovado_em)
    values (v_rede, v_formato, v_titulo, v_legenda, v_data, v_material, v_situacao, v, v, v_resp, v_aprovado, v_aprovado_em)
    returning id into v_id;
    perform interno.registrar('divulgacao_criada', v_titulo, jsonb_build_object('formato', v_formato, 'situacao', v_situacao));
  else
    update divulgacao set rede = v_rede, formato = v_formato, titulo = v_titulo, legenda = v_legenda, data_prevista = v_data, material = v_material,
      situacao = v_situacao, devolvido = false, mexido_por = v, mexido_em = now(), responsavel = v_resp, aprovado_por = v_aprovado, aprovado_em = v_aprovado_em
    where id = v_id;
    perform interno.registrar('divulgacao_editada', v_titulo, jsonb_build_object('situacao', v_situacao));
  end if;
  if v_resp is not null and v_resp <> v and v_resp is distinct from d.responsavel then
    perform interno.avisar(v_resp, 'Você ficou responsável pela peça "' || left(v_titulo, 80) || '" no calendário da divulgação.');
  end if;
  return jsonb_build_object('id', v_id, 'situacao', v_situacao);
end $$;

/** Muda só a situação de um item (ideia, rascunho, pronto, publicado), sem abrir o formulário. */
create or replace function public.divulgacao_situacao(p_id uuid, p_situacao text) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); d divulgacao;
begin
  if not interno.divulga() then perform interno.erro('sem_permissao'); end if;
  if coalesce(p_situacao, '') not in ('ideia', 'rascunho', 'pronto', 'publicado') then perform interno.erro('invalido:situacao'); end if;
  select * into d from divulgacao where id = p_id for update;
  if not found then perform interno.erro('nao_encontrado'); end if;
  if p_situacao = 'pronto' and d.situacao <> 'pronto' and not interno.aprova_divulgacao() then perform interno.erro('sem_permissao:aprovar'); end if;
  update divulgacao set situacao = p_situacao, devolvido = devolvido and p_situacao = 'rascunho', mexido_por = v, mexido_em = now(),
    aprovado_por = case when p_situacao = 'pronto' and d.situacao <> 'pronto' then v when p_situacao in ('ideia', 'rascunho') then null else aprovado_por end,
    aprovado_em = case when p_situacao = 'pronto' and d.situacao <> 'pronto' then now() when p_situacao in ('ideia', 'rascunho') then null else aprovado_em end
  where id = p_id;
  perform interno.registrar('divulgacao_situacao', d.titulo, jsonb_build_object('situacao', p_situacao));
  return jsonb_build_object('ok', true);
end $$;

/**
 * A coordenação comenta um item e, se for o caso, devolve para rascunho (aí a nota é obrigatória). Quem criou e quem
 * mexeu por último recebem um recado.
 */
create or replace function public.divulgacao_comentar(p_id uuid, p_nota text, p_devolver boolean default false) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); d divulgacao; v_nota text := interno.txt(p_nota, 'nota', 0, 1000); v_devolver boolean := coalesce(p_devolver, false); u uuid;
begin
  if not interno.coord() then perform interno.erro('sem_permissao'); end if;
  if v_devolver and char_length(v_nota) < 5 then perform interno.erro('invalido:nota'); end if;
  select * into d from divulgacao where id = p_id for update;
  if not found then perform interno.erro('nao_encontrado'); end if;
  update divulgacao set nota = v_nota, situacao = case when v_devolver then 'rascunho' else situacao end, devolvido = devolvido or v_devolver,
    mexido_por = v, mexido_em = now()
  where id = p_id;
  perform interno.registrar(case when v_devolver then 'divulgacao_devolvida' else 'divulgacao_comentada' end, d.titulo);
  if v_nota <> '' then
    for u in select distinct x from unnest(array[d.criado_por, d.mexido_por]) x where x is not null and x <> v loop
      perform interno.avisar(u, case when v_devolver then 'A coordenação devolveu "' || left(d.titulo, 80) || '" para rascunho: ' else 'A coordenação comentou "' || left(d.titulo, 80) || '": ' end || left(v_nota, 300));
    end loop;
  end if;
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.divulgacao_apagar(p_id uuid) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v_titulo text;
begin
  perform interno.eu();
  if not interno.divulga() then perform interno.erro('sem_permissao'); end if;
  delete from divulgacao where id = p_id returning titulo into v_titulo;
  if not found then perform interno.erro('nao_encontrado'); end if;
  perform interno.registrar('divulgacao_apagada', v_titulo);
  return jsonb_build_object('ok', true);
end $$;

/**
 * O endereço público do perfil do instituto no Instagram, que a coordenação define e o marketing vê como link.
 * Só o endereço: o acesso é dado pela própria Meta, e o site nunca guarda senha nem chave de rede social.
 */
create or replace function public.divulgacao_instagram_salvar(p_url text) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v_url text := btrim(coalesce(p_url, ''));
begin
  perform interno.eu();
  if not interno.coord() then perform interno.erro('sem_permissao'); end if;
  if v_url <> '' and v_url !~ '^https://(www[.])?instagram[.]com/[A-Za-z0-9_.]{1,30}/?$' then perform interno.erro('invalido:instagram'); end if;
  insert into configuracoes (chave, valor) values ('divulgacao', jsonb_build_object('instagram', v_url))
  on conflict (chave) do update set valor = configuracoes.valor || excluded.valor;
  perform interno.registrar('divulgacao_instagram', '', jsonb_build_object('definido', v_url <> ''));
  return jsonb_build_object('instagram', v_url);
end $$;

-- ───────────────────────────── Tradução ─────────────────────────────

/**
 * Traduções já enviadas que ainda não foram ao ar (esperando revisão ou a próxima publicação): é o que impede dois
 * tradutores de fazerem a mesma página no mesmo idioma. Quem traduz, quem revisa e quem decide.
 */
create or replace function public.traducoes_andamento() returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
begin
  perform interno.eu();
  if not (interno.curador() or interno.tem('traducao') or interno.tem('revisao')) then perform interno.erro('sem_permissao'); end if;
  -- Reserva parada além do prazo sai sozinha: a aula volta para a lista de quem quer traduzir.
  delete from traducao_reservas where prazo < current_date;
  return (
    select coalesce(jsonb_agg(x order by (x ->> 'criado_em') desc), '[]'::jsonb) from (
      select jsonb_build_object('alvo', c.alvo, 'idioma', c.dados ->> 'idioma', 'status', case when c.status = 'aprovada' then 'aprovada' else 'enviada' end,
        'nome', c.nome_autor, 'criado_em', c.criado_em, 'minha', c.autor is not null and c.autor = auth.uid(), 'prazo', null) as x
      from contribuicoes c where c.tipo = 'traducao' and c.status in ('pendente', 'aprovada')
      union all
      select jsonb_build_object('alvo', r.alvo, 'idioma', r.idioma, 'status', 'em_andamento', 'nome', interno.nome_visto(f.nome), 'criado_em', r.criado_em,
        'minha', r.usuario = auth.uid() or exists (select 1 from traducao_coautores c where c.alvo = r.alvo and c.idioma = r.idioma and c.usuario = auth.uid()),
        'dona', r.usuario = auth.uid(), 'prazo', r.prazo,
        'coautores', coalesce((select jsonb_agg(jsonb_build_object('id', c.usuario, 'nome', interno.nome_visto(g.nome))) from traducao_coautores c join perfis g on g.id = c.usuario
                               where c.alvo = r.alvo and c.idioma = r.idioma), '[]'::jsonb))
      from traducao_reservas r left join perfis f on f.id = r.usuario
    ) t);
end $$;

-- ───────────────────────────── Estado técnico ─────────────────────────────

/**
 * O que liga o banco ao site, para quem cuida do código: o que espera a rotina de publicação, a segunda avaliação da
 * Comunidade, a faxina agendada e sinais de varredura. Só contagens e datas: nenhum dado de pessoa.
 */
create or replace function public.diagnostico() returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare c jsonb := coalesce((select valor from configuracoes where chave = 'comunidade'), '{}'::jsonb);
begin
  perform interno.eu();
  if not (interno.coord() or interno.tem('desenvolvimento')) then perform interno.erro('sem_permissao'); end if;
  return jsonb_build_object(
    'aprovadas', (select count(*) from contribuicoes where status = 'aprovada'),
    'aprovada_mais_antiga', (select min(revisado_em) from contribuicoes where status = 'aprovada'),
    'ultima_publicacao', (select max(publicado_em) from contribuicoes where status = 'publicada'),
    'arquivos_aprovados', (select count(*) from arquivos where status = 'aprovado'),
    'segunda_avaliacao', jsonb_build_object('habilitada', coalesce((c ->> 'avaliacao_externa')::boolean, false), 'verificacao', c -> 'verificacao', 'ultima', c -> 'ultima_avaliacao'),
    'esperando_avaliacao', (select count(*) from topicos where retido and motivo in ('aguardando_avaliacao', 'em_avaliacao', 'avaliacao_externa_falhou'))
                         + (select count(*) from respostas where retido and motivo in ('aguardando_avaliacao', 'em_avaliacao', 'avaliacao_externa_falhou')),
    'faxina_agendada', exists (select 1 from pg_extension where extname = 'pg_cron'),
    'pgcrypto', exists (select 1 from pg_extension where extname = 'pgcrypto'),
    'iscas_24h', (select count(*) from auditoria where acao = 'isca' and criado_em > now() - interval '24 hours'),
    'armadilhas_7d', (select count(*) from auditoria where acao = 'armadilha' and criado_em > now() - interval '7 days'));
end $$;

-- ───────────────────────────── Interdição, expurgo e pedidos da supervisão ─────────────────────────────

/** Grava o estado novo da interdição, inteiro. Só é chamada depois de conferida a permissão (direto ou por pedido aprovado). */
create or replace function interno.interdicao_gravar(p jsonb, p_por uuid) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v_areas text[]; v jsonb;
begin
  select coalesce(array_agg(distinct a order by a), '{}') into v_areas from jsonb_array_elements_text(coalesce(p -> 'areas', '[]'::jsonb)) a;
  if exists (select 1 from unnest(v_areas) a where a <> all (interno.areas_publicas())) then perform interno.erro('invalido:areas'); end if;
  v := jsonb_build_object(
    'geral', coalesce((p ->> 'geral')::boolean, false),
    'areas', to_jsonb(v_areas),
    'motivo', interno.txt(p ->> 'motivo', 'motivo', 0, 300),
    'mensagem', interno.txt(p ->> 'mensagem', 'mensagem', 0, 300),
    'desde', now(),
    'por', p_por);
  insert into configuracoes (chave, valor) values ('interdicao', v) on conflict (chave) do update set valor = excluded.valor;
  return v;
end $$;

create or replace function interno.interdicao_texto(v jsonb) returns text language sql immutable as $$
  select case
    when coalesce((v ->> 'geral')::boolean, false) then 'o site inteiro está fora do ar (só a entrada e o painel funcionam)'
    when jsonb_array_length(coalesce(v -> 'areas', '[]'::jsonb)) > 0 then 'áreas interditadas: ' || (select string_agg(a, ', ') from jsonb_array_elements_text(v -> 'areas') a)
    else 'o site está aberto, sem interdição' end
$$;

/** O que a equipe que cuida disso vê: o estado, desde quando, quem ligou e por quê. Coordenação, vice-coordenação e supervisão. */
create or replace function public.interdicao_ver() returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v jsonb := interno.interdicao();
begin
  perform interno.eu();
  if not interno.supervisor() then perform interno.erro('sem_permissao'); end if;
  return jsonb_build_object(
    'geral', coalesce((v ->> 'geral')::boolean, false),
    'areas', coalesce(v -> 'areas', '[]'::jsonb),
    'motivo', coalesce(v ->> 'motivo', ''),
    'mensagem', coalesce(v ->> 'mensagem', ''),
    'desde', v ->> 'desde',
    'por', coalesce((select nome from perfis where id::text = v ->> 'por'), ''),
    'pode_aplicar', interno.coord(),
    'historico', coalesce((select jsonb_agg(jsonb_build_object('acao', a.acao, 'nome', a.nome, 'detalhes', a.detalhes, 'criado_em', a.criado_em) order by a.id desc)
                           from (select * from auditoria where acao in ('interdicao', 'expurgo', 'pedido_supervisao_criado', 'pedido_supervisao_aprovado', 'pedido_supervisao_recusado') order by id desc limit 30) a), '[]'::jsonb));
end $$;

/**
 * Liga, muda ou desliga a interdição. Só coordenação e vice-coordenação, com motivo (que fica no registro e vai no aviso
 * à liderança). p = { geral, areas: [...], motivo, mensagem }. A supervisão faz o mesmo por pedido (pedido_criar).
 */
create or replace function public.interdicao_definir(p jsonb) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); v_novo jsonb;
begin
  if not interno.coord() then perform interno.erro('sem_permissao'); end if;
  perform interno.limite('interdicao', 30, 60);
  if char_length(btrim(coalesce(p ->> 'motivo', ''))) < 5 then perform interno.erro('invalido:motivo'); end if;
  v_novo := interno.interdicao_gravar(p, v);
  perform interno.registrar('interdicao', '', jsonb_build_object('geral', v_novo -> 'geral', 'areas', v_novo -> 'areas', 'justificativa', v_novo ->> 'motivo'));
  perform interno.avisar_lideranca('Interdição: ' || interno.interdicao_texto(v_novo) || '. Motivo: ' || left(v_novo ->> 'motivo', 200), v);
  return public.interdicao_ver();
end $$;

create or replace function interno.da_equipe(p_usuario uuid) returns boolean language sql stable security definer set search_path = interno, pg_temp as $$
  select p_usuario is not null and exists (select 1 from papeis where usuario = p_usuario)
$$;

create or replace function interno.desde_periodo(p_periodo text) returns timestamptz language plpgsql stable as $$
begin
  return case p_periodo
    when '1h' then now() - interval '1 hour'
    when '6h' then now() - interval '6 hours'
    when '24h' then now() - interval '24 hours'
    when '7d' then now() - interval '7 days'
    when 'tudo' then '-infinity'::timestamptz
    else null end;
end $$;

/**
 * Conta (e, com p_aplicar, apaga) o que o público escreveu nas áreas escolhidas, no período escolhido. p = { areas: [...],
 * periodo: 1h | 6h | 24h | 7d | tudo, poupar_equipe }. Tudo numa transação só: ou apaga tudo o que contou, ou nada.
 */
create or replace function interno.expurgar(p jsonb, p_aplicar boolean) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare
  v_areas text[]; v_desde timestamptz := interno.desde_periodo(p ->> 'periodo'); v_poupar boolean := coalesce((p ->> 'poupar_equipe')::boolean, true);
  v_top uuid[]; v_resp uuid[]; v_votos integer; v_n integer; v_r jsonb := '{}'::jsonb; v_afetados uuid[];
begin
  select coalesce(array_agg(distinct a), '{}') into v_areas from jsonb_array_elements_text(coalesce(p -> 'areas', '[]'::jsonb)) a;
  if cardinality(v_areas) = 0 or exists (select 1 from unnest(v_areas) a where a <> all (interno.areas_expurgo())) then perform interno.erro('invalido:areas'); end if;
  if v_desde is null then perform interno.erro('invalido:periodo'); end if;

  if 'comunidade' = any (v_areas) then
    select coalesce(array_agg(id), '{}') into v_top from topicos where criado_em >= v_desde and not (v_poupar and interno.da_equipe(autor));
    select coalesce(array_agg(id), '{}') into v_resp from respostas where topico = any (v_top) or (criado_em >= v_desde and not (v_poupar and interno.da_equipe(autor)));
    select count(*) into v_votos from votos where alvo = any (v_top || v_resp) or (criado_em >= v_desde and not (v_poupar and interno.da_equipe(usuario)));
    v_r := v_r || jsonb_build_object('topicos', cardinality(v_top), 'respostas', cardinality(v_resp), 'votos', v_votos);
    if p_aplicar then
      -- Os tópicos que ficam e perderam respostas ou votos têm as contas refeitas no fim.
      select coalesce(array_agg(distinct x), '{}') into v_afetados from (
        select topico as x from respostas where id = any (v_resp)
        union select alvo from votos where tipo = 'topico' and criado_em >= v_desde and not (v_poupar and interno.da_equipe(usuario))) y;
      delete from votos where alvo = any (v_top || v_resp) or (criado_em >= v_desde and not (v_poupar and interno.da_equipe(usuario)));
      delete from respostas where id = any (v_resp);
      delete from topicos where id = any (v_top);
      update topicos t set aceita = null where t.aceita is not null and not exists (select 1 from respostas r where r.id = t.aceita);
      update respostas r set pontos = coalesce((select sum(valor) from votos x where x.tipo = 'resposta' and x.alvo = r.id), 0) where r.topico = any (v_afetados);
      update topicos t set pontos = coalesce((select sum(valor) from votos x where x.tipo = 'topico' and x.alvo = t.id), 0),
        respostas = (select count(*) from respostas r where r.topico = t.id and not r.oculto and not r.retido)
      where t.id = any (v_afetados);
    end if;
  end if;

  if 'mural' = any (v_areas) then
    select count(*) into v_n from mural where criado_em >= v_desde and not (v_poupar and interno.da_equipe(autor));
    v_r := v_r || jsonb_build_object('mural', v_n);
    if p_aplicar then delete from mural where criado_em >= v_desde and not (v_poupar and interno.da_equipe(autor)); end if;
  end if;

  if 'anotacoes' = any (v_areas) then
    select count(*) into v_n from anotacoes where criado_em >= v_desde and not (v_poupar and interno.da_equipe(autor));
    v_r := v_r || jsonb_build_object('anotacoes', v_n);
    if p_aplicar then delete from anotacoes where criado_em >= v_desde and not (v_poupar and interno.da_equipe(autor)); end if;
  end if;

  if 'reforco' = any (v_areas) then
    select count(*) into v_n from reforco where status in ('aberto', 'em_atendimento') and criado_em >= v_desde and not (v_poupar and interno.da_equipe(autor));
    v_r := v_r || jsonb_build_object('reforco', v_n);
    if p_aplicar then delete from reforco where status in ('aberto', 'em_atendimento') and criado_em >= v_desde and not (v_poupar and interno.da_equipe(autor)); end if;
  end if;

  if 'contribuicoes' = any (v_areas) then
    select count(*) into v_n from contribuicoes where status = 'pendente' and triagem = 'aguardando' and criado_em >= v_desde and not (v_poupar and interno.da_equipe(autor));
    v_r := v_r || jsonb_build_object('contribuicoes', v_n);
    if p_aplicar then delete from contribuicoes where status = 'pendente' and triagem = 'aguardando' and criado_em >= v_desde and not (v_poupar and interno.da_equipe(autor)); end if;
  end if;

  -- A Gaveta Aberta entra aqui quando a tabela dela existir (tarefa seguinte); sem ela, conta zero.
  if 'gaveta' = any (v_areas) then
    if to_regclass('interno.gaveta') is not null then
      execute 'select count(*) from interno.gaveta where criado_em >= $1 and not ($2 and interno.da_equipe(autor))' into v_n using v_desde, v_poupar;
      if p_aplicar then execute 'delete from interno.gaveta where criado_em >= $1 and not ($2 and interno.da_equipe(autor))' using v_desde, v_poupar; end if;
    else
      v_n := 0;
    end if;
    v_r := v_r || jsonb_build_object('gaveta', v_n);
  end if;
  return v_r;
end $$;

/** Quanto o expurgo apagaria, área por área, antes de alguém confirmar. Coordenação, vice-coordenação e supervisão. */
create or replace function public.expurgo_previa(p jsonb) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
begin
  perform interno.eu();
  if not interno.supervisor() then perform interno.erro('sem_permissao'); end if;
  return interno.expurgar(p, false);
end $$;

/** Aplica o expurgo (uso interno: coordenação direto, ou pedido aprovado). Fica no registro, avisa a liderança e pode pausar os envios junto. */
create or replace function interno.expurgo_aplicar(p jsonb, p_por uuid) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v_r jsonb := interno.expurgar(p, true); v_pausar boolean := coalesce((p ->> 'pausar')::boolean, false);
begin
  if v_pausar then
    insert into configuracoes (chave, valor) values ('site', jsonb_build_object('pausa', true, 'motivo', 'Os envios estão pausados por um tempo.'))
    on conflict (chave) do update set valor = configuracoes.valor || jsonb_build_object('pausa', true, 'motivo', coalesce(nullif(configuracoes.valor ->> 'motivo', ''), 'Os envios estão pausados por um tempo.'));
  end if;
  perform interno.registrar('expurgo', '', jsonb_build_object('areas', p -> 'areas', 'periodo', p ->> 'periodo', 'poupar_equipe', coalesce((p ->> 'poupar_equipe')::boolean, true), 'pausa', v_pausar, 'apagados', v_r));
  perform interno.avisar_lideranca('Expurgo feito (' || coalesce(p ->> 'periodo', '') || '): ' || (select string_agg(k || ' ' || v, ', ') from jsonb_each_text(v_r) e(k, v))
    || case when v_pausar then '. Os envios do público ficaram pausados.' else '.' end, p_por);
  return v_r;
end $$;

/**
 * O botão de expurgo: apaga de uma vez o que o público escreveu nas áreas escolhidas (chuva de spam). Só coordenação e
 * vice-coordenação, e só com a palavra EXPURGAR digitada. p = { areas, periodo, poupar_equipe, pausar, confirmacao }.
 */
create or replace function public.expurgo_aplicar(p jsonb) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu();
begin
  if not interno.coord() then perform interno.erro('sem_permissao'); end if;
  if coalesce(p ->> 'confirmacao', '') <> 'EXPURGAR' then perform interno.erro('invalido:confirmacao'); end if;
  perform interno.limite('expurgo', 10, 60);
  return interno.expurgo_aplicar(p, v);
end $$;

/** Pedido parado há 72 horas vence sozinho, sem aplicar nada. */
create or replace function interno.pedidos_vencer() returns void language sql security definer set search_path = interno, pg_temp as $$
  update pedidos set situacao = 'vencido', decidido_em = now() where situacao = 'pendente' and criado_em < now() - interval '72 hours'
$$;

/**
 * A supervisão pede uma interdição, a liberação ou um expurgo, com justificativa de pelo menos 30 letras. O pedido só vale
 * depois que a coordenação ou a vice-coordenação aprovar, com os dados que estão nele. Coordenação e vice são avisadas.
 */
create or replace function public.pedido_criar(p_tipo text, p_dados jsonb, p_justificativa text) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); v_id uuid; v_dados jsonb := coalesce(p_dados, '{}'::jsonb); v_just text := interno.txt(p_justificativa, 'justificativa', 30, 1000);
begin
  if not interno.tem('supervisao') then perform interno.erro('sem_permissao'); end if;
  perform interno.limite('pedido_criar', 10, 60);
  if coalesce(p_tipo, '') not in ('interdicao', 'liberacao', 'expurgo') then perform interno.erro('invalido:tipo'); end if;
  -- Confere os dados agora, para a coordenação não aprovar um pedido que falharia.
  if p_tipo = 'interdicao' then
    if not coalesce((v_dados ->> 'geral')::boolean, false) and jsonb_array_length(coalesce(v_dados -> 'areas', '[]'::jsonb)) = 0 then perform interno.erro('invalido:areas'); end if;
    if exists (select 1 from jsonb_array_elements_text(coalesce(v_dados -> 'areas', '[]'::jsonb)) a where a <> all (interno.areas_publicas())) then perform interno.erro('invalido:areas'); end if;
    v_dados := jsonb_build_object('geral', coalesce((v_dados ->> 'geral')::boolean, false), 'areas', coalesce(v_dados -> 'areas', '[]'::jsonb), 'mensagem', interno.txt(v_dados ->> 'mensagem', 'mensagem', 0, 300));
  elsif p_tipo = 'liberacao' then
    v_dados := '{}'::jsonb;
  else
    perform interno.expurgar(v_dados, false);
    v_dados := jsonb_build_object('areas', v_dados -> 'areas', 'periodo', v_dados ->> 'periodo', 'poupar_equipe', coalesce((v_dados ->> 'poupar_equipe')::boolean, true), 'pausar', coalesce((v_dados ->> 'pausar')::boolean, false));
  end if;
  insert into pedidos (tipo, dados, justificativa, autor) values (p_tipo, v_dados, v_just, v) returning id into v_id;
  perform interno.registrar('pedido_supervisao_criado', v_id::text, jsonb_build_object('tipo', p_tipo, 'justificativa', v_just));
  perform interno.avisar_lideranca('A supervisão pediu ' || case p_tipo when 'interdicao' then 'uma interdição' when 'liberacao' then 'a liberação do site' else 'um expurgo' end
    || ': ' || left(v_just, 200) || ' Aprove ou recuse em Interdição e expurgo (vence em 72 horas).', v);
  return jsonb_build_object('id', v_id);
end $$;

/** A fila de pedidos. A coordenação e a vice-coordenação veem todos; a supervisão vê os próprios e os já decididos. */
create or replace function public.pedidos_listar() returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); v_coord boolean := interno.coord();
begin
  if not interno.supervisor() then perform interno.erro('sem_permissao'); end if;
  perform interno.pedidos_vencer();
  return (select coalesce(jsonb_agg(jsonb_build_object(
      'id', p.id, 'tipo', p.tipo, 'dados', p.dados, 'justificativa', p.justificativa, 'situacao', p.situacao, 'nota', p.nota, 'resultado', p.resultado,
      'autor', coalesce((select nome from perfis where id = p.autor), ''), 'meu', p.autor = v,
      'decidido_por', coalesce((select nome from perfis where id = p.decidido_por), ''), 'decidido_em', p.decidido_em, 'criado_em', p.criado_em,
      'vence_em', p.criado_em + interval '72 hours') order by p.criado_em desc), '[]'::jsonb)
    from (select * from pedidos where v_coord or autor = v or situacao <> 'pendente' order by criado_em desc limit 50) p);
end $$;

/**
 * Coordenação ou vice-coordenação decide um pedido. Aprovar aplica a ação na mesma transação, com os dados que estavam no
 * pedido; recusar (com nota opcional) não aplica nada. Pedido vencido não se aprova. Quem pediu é avisado.
 */
create or replace function public.pedido_decidir(p_id uuid, p_aprovar boolean, p_nota text default '') returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); r pedidos; v_resultado jsonb := null; v_nota text := interno.txt(p_nota, 'nota', 0, 500);
begin
  if not interno.coord() then perform interno.erro('sem_permissao'); end if;
  perform interno.pedidos_vencer();
  select * into r from pedidos where id = p_id for update;
  if not found then perform interno.erro('nao_encontrado'); end if;
  if r.situacao = 'vencido' then perform interno.erro('pedido_vencido'); end if;
  if r.situacao <> 'pendente' then perform interno.erro('ja_decidida'); end if;
  if coalesce(p_aprovar, false) then
    if r.tipo = 'interdicao' then
      v_resultado := interno.interdicao_gravar(r.dados || jsonb_build_object('motivo', left('Pedido da supervisão: ' || r.justificativa, 300)), v);
      perform interno.registrar('interdicao', '', jsonb_build_object('geral', v_resultado -> 'geral', 'areas', v_resultado -> 'areas', 'justificativa', v_resultado ->> 'motivo'));
    elsif r.tipo = 'liberacao' then
      v_resultado := interno.interdicao_gravar(jsonb_build_object('geral', false, 'areas', '[]'::jsonb, 'motivo', left('Pedido da supervisão: ' || r.justificativa, 300)), v);
      perform interno.registrar('interdicao', '', jsonb_build_object('geral', false, 'areas', '[]'::jsonb, 'justificativa', v_resultado ->> 'motivo'));
    else
      v_resultado := interno.expurgo_aplicar(r.dados, v);
    end if;
  end if;
  update pedidos set situacao = case when coalesce(p_aprovar, false) then 'aprovado' else 'recusado' end, nota = v_nota, decidido_por = v, decidido_em = now(), resultado = v_resultado
  where id = p_id;
  perform interno.registrar(case when coalesce(p_aprovar, false) then 'pedido_supervisao_aprovado' else 'pedido_supervisao_recusado' end, p_id::text, jsonb_build_object('tipo', r.tipo, 'nota', v_nota));
  if r.autor is not null then
    perform interno.avisar(r.autor, 'Seu pedido de ' || case r.tipo when 'interdicao' then 'interdição' when 'liberacao' then 'liberação' else 'expurgo' end || ' foi '
      || case when coalesce(p_aprovar, false) then 'aprovado e já está valendo.' else 'recusado.' end || case when v_nota <> '' then ' Nota: ' || v_nota else '' end);
  end if;
  return jsonb_build_object('ok', true, 'resultado', v_resultado);
end $$;

-- ───────────────────────────── Gaveta Aberta ─────────────────────────────

/** A versão do termo de cessão em vigor. Mudou o texto (content/paginas/gaveta-termo.md)? Mude aqui e em lib/gaveta.ts. */
create or replace function interno.gaveta_termo_versao() returns text language sql immutable as $$ select '1' $$;

create or replace function interno.gaveta_json(g interno.gaveta, p_equipe boolean) returns jsonb language sql stable security definer set search_path = interno, pg_temp as $$
  select jsonb_build_object(
    'id', g.id, 'titulo', g.titulo, 'tipo', g.tipo, 'disciplina', g.disciplina, 'curso', g.curso, 'instituicao', g.instituicao, 'ano', g.ano,
    'comentario', g.comentario, 'link', g.link, 'arquivo', g.arquivo, 'licenca', g.licenca, 'credito', g.credito, 'publicado_em', g.decidido_em)
  || case when p_equipe then jsonb_build_object(
    'status', g.status, 'nota', g.nota, 'criado_em', g.criado_em, 'autor', coalesce((select nome from perfis where id = g.autor), ''),
    'termo_nome', g.termo_nome, 'termo_versao', g.termo_versao, 'termo_em', g.termo_em,
    'decidido_por', coalesce((select nome from perfis where id = g.decidido_por), '')) else '{}'::jsonb end
$$;

/**
 * Publicar um trabalho na Gaveta. Precisa de conta (participante da comunidade já serve), do aceite do termo com o nome
 * completo e de um link https ou de um PDF já enviado para a própria pasta do depósito. Passa pelo filtro de palavras,
 * pelo limite de envios, pela pausa e pelos banimentos; fica esperando a mediação.
 */
create or replace function public.gaveta_enviar(p jsonb) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare
  v uuid; v_id uuid; v_tipo text := coalesce(p ->> 'tipo', ''); v_licenca text := coalesce(nullif(p ->> 'licenca', ''), 'CC BY 4.0');
  v_link text := btrim(coalesce(p ->> 'link', '')); v_arquivo text := btrim(coalesce(p ->> 'arquivo', '')); v_ano smallint;
  v_titulo text; v_comentario text; v_curso text; v_instituicao text; v_credito text; v_termo_nome text; v_disciplina text;
  v_exercicio uuid;
begin
  perform interno.aberta('gaveta');
  v := interno.eu();
  perform interno.limite('gaveta', 5, 1440);
  if not coalesce((p ->> 'termo')::boolean, false) or coalesce(p ->> 'termo_versao', '') <> interno.gaveta_termo_versao() then perform interno.erro('falta_termo'); end if;
  if v_tipo not in ('tcc', 'monografia', 'dissertacao', 'artigo', 'projeto', 'relatorio', 'apostila', 'codigo', 'apresentacao', 'outro') then perform interno.erro('invalido:tipo'); end if;
  if v_licenca not in ('CC BY 4.0', 'CC BY-SA 4.0', 'CC0 1.0') then perform interno.erro('invalido:licenca'); end if;
  v_disciplina := interno.disciplina_ok(p ->> 'disciplina');
  if v_disciplina is null then perform interno.erro('invalido:disciplina'); end if;
  v_titulo := interno.txt(p ->> 'titulo', 'titulo', 5, 160);
  v_comentario := interno.txt(p ->> 'comentario', 'comentario', 40, 2000);
  v_curso := interno.txt(p ->> 'curso', 'curso', 0, 120);
  v_instituicao := interno.txt(p ->> 'instituicao', 'instituicao', 0, 160);
  v_credito := interno.txt(p ->> 'credito', 'credito', 2, 120);
  v_termo_nome := interno.txt(p ->> 'termo_nome', 'termo_nome', 5, 160);
  if coalesce(p ->> 'ano', '') <> '' then
    if (p ->> 'ano') !~ '^[0-9]{4}$' or (p ->> 'ano')::int < 1950 or (p ->> 'ano')::int > extract(year from now())::int then perform interno.erro('invalido:ano'); end if;
    v_ano := (p ->> 'ano')::smallint;
  end if;
  if (v_link = '') = (v_arquivo = '') then perform interno.erro('invalido:arquivo'); end if;
  if v_link <> '' and (v_link !~ '^https://[^[:space:]]+$' or char_length(v_link) > 500) then perform interno.erro('invalido:link'); end if;
  -- O PDF tem de estar na pasta da própria pessoa; onde o depósito existe, confere que o arquivo chegou mesmo.
  if v_arquivo <> '' then
    if v_arquivo !~ ('^' || v::text || '/[0-9a-f-]{36}[.]pdf$') then perform interno.erro('invalido:arquivo'); end if;
    if to_regclass('storage.objects') is not null then
      if not exists (select 1 from storage.objects where bucket_id = 'gaveta' and name = v_arquivo) then perform interno.erro('invalido:arquivo'); end if;
    end if;
  end if;
  if interno.vetado(v_titulo || ' ' || v_comentario || ' ' || v_curso || ' ' || v_instituicao || ' ' || v_credito) then perform interno.erro('conteudo_recusado'); end if;
  -- Entrega de um exercício de prática: o exercício tem de existir, estar ativo e ser da mesma disciplina.
  if coalesce(p ->> 'exercicio', '') <> '' then
    if (p ->> 'exercicio') !~ '^[0-9a-f-]{36}$' then perform interno.erro('invalido:exercicio'); end if;
    v_exercicio := (p ->> 'exercicio')::uuid;
    if not exists (select 1 from exercicios_pratica where id = v_exercicio and ativo and disciplina = v_disciplina) then perform interno.erro('invalido:exercicio'); end if;
  end if;
  insert into gaveta (autor, titulo, tipo, disciplina, curso, instituicao, ano, comentario, link, arquivo, licenca, credito, termo_nome, termo_versao, exercicio)
  values (v, v_titulo, v_tipo, v_disciplina, v_curso, v_instituicao, v_ano, v_comentario, v_link, v_arquivo, v_licenca, v_credito, v_termo_nome, interno.gaveta_termo_versao(), v_exercicio)
  returning id into v_id;
  if v_exercicio is not null then
    perform interno.avisar(p2.usuario, 'Chegou uma entrega do exercício "' || left(x.titulo, 80) || '". Veja em Exercícios de prática.')
    from exercicios_pratica x join papeis p2 on p2.papel in ('educacao', 'educacao_secundaria') and p2.disciplina = x.disciplina
    where x.id = v_exercicio;
  end if;
  return jsonb_build_object('id', v_id);
end $$;

/** As publicações da própria pessoa, em qualquer situação, com a nota da mediação. */
create or replace function public.gaveta_minhas() returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := auth.uid();
begin
  if v is null then perform interno.erro('entre_primeiro'); end if;
  return (select coalesce(jsonb_agg(interno.gaveta_json(g, false) || jsonb_build_object('status', g.status, 'nota', g.nota, 'criado_em', g.criado_em,
            'exercicio', g.exercicio, 'exercicio_titulo', (select titulo from exercicios_pratica where id = g.exercicio), 'retorno', g.retorno, 'retorno_em', g.retorno_em) order by g.criado_em desc), '[]'::jsonb)
          from gaveta g where g.autor = v and g.status <> 'retirado');
end $$;

/**
 * Quem publicou tira a ficha do ar quando quiser (o termo explica que a licença já concedida continua valendo para quem
 * já copiou). Devolve o caminho do PDF, para o navegador apagá-lo do depósito.
 */
create or replace function public.gaveta_retirar(p_id uuid) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := auth.uid(); v_arquivo text;
begin
  if v is null then perform interno.erro('entre_primeiro'); end if;
  update gaveta set status = 'retirado' where id = p_id and autor = v and status <> 'retirado' returning arquivo into v_arquivo;
  if not found then perform interno.erro('nao_encontrado'); end if;
  return jsonb_build_object('ok', true, 'arquivo', v_arquivo);
end $$;

/** O que está na Gaveta para todo mundo: só o aprovado, com filtros por disciplina, tipo e texto. Nunca o nome do termo. */
create or replace function public.gaveta_listar(p jsonb default '{}'::jsonb) returns jsonb language plpgsql stable security definer set search_path = interno, pg_temp as $$
declare v_busca text := interno.normal(coalesce(p ->> 'busca', ''));
begin
  perform interno.aberta('gaveta');
  return (select coalesce(jsonb_agg(interno.gaveta_json(g, false) order by g.decidido_em desc), '[]'::jsonb) from (
    select * from gaveta g
    where g.status = 'aprovado'
      and (coalesce(p ->> 'disciplina', '') = '' or g.disciplina = p ->> 'disciplina')
      and (coalesce(p ->> 'tipo', '') = '' or g.tipo = p ->> 'tipo')
      and (v_busca = '' or position(v_busca in interno.normal(g.titulo || ' ' || g.comentario || ' ' || g.curso || ' ' || g.instituicao || ' ' || g.credito)) > 0)
    order by g.decidido_em desc limit 300) g);
end $$;

/** A fila da equipe que decide (mediação, curadoria, coordenação e vice): os pendentes e os decididos há pouco. */
create or replace function public.gaveta_fila() returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
begin
  perform interno.eu();
  if not interno.media() then perform interno.erro('sem_permissao'); end if;
  return (select coalesce(jsonb_agg(interno.gaveta_json(g, true) order by (g.status = 'pendente') desc, g.criado_em desc), '[]'::jsonb) from (
    select * from gaveta where status = 'pendente' or criado_em > now() - interval '60 days' order by criado_em desc limit 200) g);
end $$;

/** Aprovar ou recusar (com nota opcional; recusar pede um motivo de pelo menos 5 letras). Quem publicou é avisado. */
create or replace function public.gaveta_decidir(p_id uuid, p_aprovar boolean, p_nota text default '') returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); g gaveta; v_nota text := interno.txt(p_nota, 'nota', 0, 1000); v_aprovar boolean := coalesce(p_aprovar, false);
begin
  if not interno.media() then perform interno.erro('sem_permissao'); end if;
  select * into g from gaveta where id = p_id for update;
  if not found then perform interno.erro('nao_encontrado'); end if;
  if g.status not in ('pendente', 'aprovado', 'recusado') then perform interno.erro('ja_decidida'); end if;
  if not v_aprovar and char_length(v_nota) < 5 then perform interno.erro('invalido:nota'); end if;
  update gaveta set status = case when v_aprovar then 'aprovado' else 'recusado' end, nota = v_nota, decidido_por = v, decidido_em = now() where id = p_id;
  perform interno.registrar(case when v_aprovar then 'gaveta_aprovada' else 'gaveta_recusada' end, g.titulo);
  perform interno.avisar(g.autor, case when v_aprovar then 'Seu trabalho "' || left(g.titulo, 80) || '" foi publicado na Gaveta Aberta.'
    else 'Seu trabalho "' || left(g.titulo, 80) || '" não foi publicado na Gaveta Aberta: ' || left(v_nota, 300) end);
  return jsonb_build_object('ok', true);
end $$;

/** A regra do depósito: o PDF de um trabalho aprovado é público. Usada pelas regras de storage.objects, que não leem as tabelas. */
create or replace function interno.gaveta_publico(p_nome text) returns boolean language sql stable security definer set search_path = interno, pg_temp as $$
  select exists (select 1 from gaveta where arquivo = p_nome and status = 'aprovado')
$$;

/** Quem lê um PDF da Gaveta: a própria pessoa, a equipe que decide, e todo mundo depois da aprovação. */
create or replace function interno.gaveta_le(p_nome text) returns boolean language sql stable security definer set search_path = interno, pg_temp as $$
  select (auth.uid() is not null and split_part(p_nome, '/', 1) = auth.uid()::text) or interno.media() or interno.gaveta_publico(p_nome)
$$;

/** Quem pode pôr um PDF na própria pasta da Gaveta agora: conta não suspensa, com a Gaveta aberta e os envios do público abertos. */
create or replace function interno.gaveta_pode_enviar() returns boolean language sql stable security definer set search_path = interno, pg_temp as $$
  select auth.uid() is not null
    and not exists (select 1 from perfis where id = auth.uid() and suspenso)
    and not interno.interditada('gaveta')
    and (interno.voluntario() or not coalesce((select (valor ->> 'pausa')::boolean from configuracoes where chave = 'site'), false))
$$;

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
             'comunidade_retidos', 'filtro_listar', 'filtro_salvar', 'abertura', 'abertura_salvar', 'reforco_pedir', 'reforco_disponibilidade', 'reforco_meus', 'reforco_cancelar',
             'reforco_fila', 'reforco_assumir', 'reforco_soltar', 'reforco_concluir', 'equipe_canais', 'equipe_listar', 'equipe_escrever', 'equipe_marcar',
             'equipe_apagar', 'equipe_sala_salvar', 'materiais_listar', 'material_salvar', 'material_remover', 'termo_meu', 'termo_aceitar',
             'horas_registrar', 'horas_minhas', 'horas_remover', 'horas_fila', 'horas_conferir', 'certificado_abrir', 'certificado_testemunhar',
             'certificado_emitir', 'certificado_cancelar', 'certificados_listar', 'certificado_conferir', 'arquivo_bloquear', 'arquivos_bloqueados',
             'horas_pesos', 'horas_pesos_salvar', 'horas_considerar', 'certificado_pedir', 'certificado_pedido_cancelar', 'certificado_pedidos', 'certificado_pedido_recusar',
             'arquivo_registrar', 'arquivos_listar', 'arquivo_decidir', 'arquivos_aprovados', 'arquivo_publicado',
             'convite_criar', 'convites_listar', 'convite_revogar', 'convite_ver', 'convidar_pelo_banco', 'mural_cidades', 'mural_retirar',
             'equipe_apagar_tudo', 'arquivo_apoiar', 'isca', 'boletim_assinar', 'boletim_listar', 'boletim_remover',
             'colaboracao_abrir', 'colaboracao_fechar', 'colaboracoes_minhas', 'equipe_membros', 'site', 'site_salvar',
             'presenca', 'chat_conversas', 'chat_direta', 'chat_grupo_criar', 'chat_grupo_mudar', 'chat_sair', 'chat_grupo_apagar', 'chat_ver', 'chat_enviar', 'chat_apagar',
             'chat_aparelho_registrar', 'chat_aparelhos_meus', 'chat_aparelho_remover', 'chat_chaves', 'chat_chave_nova', 'chat_chaves_pendentes',
             'chat_chaves_dar', 'chat_chaves_recusar', 'chat_autodestruir', 'chat_aparelho_estado', 'chat_aparelho_aprovar', 'chat_identidade_definir',
             'chat_identidade_redefinir', 'chat_recuperacao_guardar', 'chat_recuperacao_ler', 'chat_aparelho_pedir', 'chat_aparelho_recuperar',
             'chat_recebidas', 'chat_digitando', 'chat_fixar', 'chat_favoritar', 'chat_favoritas', 'perfil_preferencias', 'chat_anexo_enviar', 'chat_anexo_ler', 'chat_privadas', 'chat_conversa_marcar', 'chat_controles', 'chat_controlar', 'perfil_avatar', 'perfil_curriculo', 'curriculo_propor', 'curriculo_listar', 'curriculo_decidir', 'curriculo_aprovadas', 'curriculo_marcar', 'reuniao_salvar', 'reunioes_listar', 'reuniao_estado', 'reuniao_ata', 'reuniao_presenca', 'reuniao_propor', 'reunioes_propostas', 'reuniao_proposta_decidir', 'dicionario_termos', 'dicionario_salvar', 'termo_voluntario_aceitar', 'aprendizado_aceitar', 'marketing_sugerir', 'marketing_caixa', 'marketing_caixa_decidir', 'painel_estatisticas', 'educadores', 'chat_relatar', 'chat_relatos', 'chat_relato_resolver',
             'audit_logs_listar', 'comunidade_para_avaliar', 'comunidade_avaliada', 'comunidade_avaliacao_externa', 'comunidade_pendentes', 'comunidade_controles', 'comunidade_modo_seguranca', 'comunidade_verificacao',
             'boletim_confirmar', 'boletim_sair', 'boletim_enviar', 'emails_pendentes', 'email_resultado', 'emails_situacao', 'papeis_historico_listar',
             'equipe_supervisao', 'pedidos_supervisao', 'protecoes', 'site_pausa', 'usuario_editar', 'usuario_senha_redefinir', 'senha_trocada',
             'divulgacao_listar', 'divulgacao_salvar', 'divulgacao_situacao', 'divulgacao_comentar', 'divulgacao_apagar', 'divulgacao_instagram_salvar',
             'traducoes_andamento', 'diagnostico',
             'interdicao_ver', 'interdicao_definir', 'expurgo_previa', 'expurgo_aplicar', 'pedido_criar', 'pedidos_listar', 'pedido_decidir',
             'gaveta_enviar', 'gaveta_minhas', 'gaveta_retirar', 'gaveta_listar', 'gaveta_fila', 'gaveta_decidir',
             'assistente_estado', 'assistente_usar', 'assistente_resultado', 'assistente_verificacao', 'assistente_controles', 'assistente_configurar'))
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
revoke all on function public.comunidade_avaliacao_externa(boolean) from anon, authenticated;

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
    values ('envios', 'envios', false, 8388608, array['image/webp', 'image/jpeg', 'application/pdf', 'audio/webm', 'audio/mp4'])
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

-- ───────────────────────────── Envio dos e-mails de minuto em minuto ─────────────────────────────

-- O GitHub atrasa rotinas agendadas por horas, e os e-mails ficavam parados na fila. Agora o próprio banco chama a função
-- "enviar-emails" a cada minuto, só quando há e-mail esperando. O endereço da função fica nas configurações
-- (chave 'email', campo 'funcao'), com a chave pública do projeto (a "anon", a mesma que o site usa), definidos uma vez:
--   update interno.configuracoes set valor = valor || '{"funcao": "https://SEU-PROJETO.supabase.co/functions/v1/enviar-emails", "chave_publica": "eyJ..."}'::jsonb where chave = 'email';
-- Sem o endereço, ou sem as extensões pg_cron e pg_net, nada muda: a rotina do GitHub segue como antes.
create or replace function interno.emails_disparar() returns void language plpgsql security definer set search_path = interno, pg_temp as $$
declare
  v_url text := (select valor ->> 'funcao' from configuracoes where chave = 'email');
  v_chave text := coalesce((select valor ->> 'chave_publica' from configuracoes where chave = 'email'), '');
begin
  if coalesce(v_url, '') !~ '^https://[a-z0-9.-]+/functions/v1/enviar-emails$' then return; end if;
  if not exists (select 1 from emails where status = 'pendente' or (status = 'enviando' and tentado_em < now() - interval '15 minutes')) then return; end if;
  execute 'select net.http_post(url := $1, body := ''{}''::jsonb, headers := $2, timeout_milliseconds := 60000)'
    using v_url, jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || v_chave, 'apikey', v_chave);
end $$;
revoke all on function interno.emails_disparar() from public, anon, authenticated;

do $$
begin
  create extension if not exists pg_net;
exception when others then null;
end $$;
do $$
begin
  create extension if not exists pg_cron;
exception when others then null;
end $$;
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') and exists (select 1 from pg_extension where extname = 'pg_net') then
    perform cron.schedule('lucia-emails', '* * * * *', 'select interno.emails_disparar()');
  end if;
exception when others then null;
end $$;

-- ───────────────────────────── Mensagens do chat por e-mail ─────────────────────────────

-- Quem não abre as Conversas recebe por e-mail um resumo do que importa e ainda não leu: as mensagens da coordenação
-- (de qualquer conversa) e as do grupo do próprio departamento. Só o resumo (de onde e quantas): as mensagens são
-- cifradas de ponta a ponta e o banco nem sabe o que dizem. Espera 15 minutos antes de avisar (quem está com o painel
-- aberto lê antes) e não repete o aviso da mesma conversa até chegar mensagem nova. Dá para desligar em Minha conta.
alter table interno.conversa_membros add column if not exists avisado_em timestamptz;

create or replace function interno.chat_emails() returns void language plpgsql security definer set search_path = interno, pg_temp as $$
declare r record; v_linhas text; v_total integer;
begin
  for r in
    select m.usuario, u.email, interno.primeiro_nome(f.nome) as nome
    from conversa_membros m join perfis f on f.id = m.usuario join auth.users u on u.id = m.usuario
    where not f.suspenso and coalesce(u.email, '') <> ''
      and exists (select 1 from papeis p where p.usuario = m.usuario)
    group by m.usuario, u.email, f.nome
  loop
    with pendentes as (
      select c.id, c.tipo, c.nome, count(*) as n, max(x.criado_em) as ultima,
             string_agg(distinct interno.primeiro_nome(a.nome), ', ') as de
      from conversa_membros m join conversas c on c.id = m.conversa
      join conversa_mensagens x on x.conversa = c.id
      left join perfis a on a.id = x.autor
      where m.usuario = r.usuario and x.tipo = 'texto' and x.autor is distinct from r.usuario
        and x.criado_em > m.lido_em and x.criado_em > coalesce(m.avisado_em, '-infinity')
        and x.criado_em < now() - interval '15 minutes' and x.criado_em > now() - interval '3 days'
        and (c.tipo = 'departamento' or exists (select 1 from papeis p where p.usuario = x.autor and p.papel in ('coordenacao', 'vice')))
      group by c.id, c.tipo, c.nome
    )
    select string_agg('• ' || case when tipo = 'departamento' then 'Grupo ' || nome when tipo = 'direta' then 'Conversa com ' || coalesce(de, 'a coordenação') else nome || ' (' || coalesce(de, '') || ')' end
                      || ': ' || n || case when n = 1 then ' mensagem nova' else ' mensagens novas' end, E'\n' order by ultima desc),
           sum(n)
    into v_linhas, v_total from pendentes;
    if v_total is null then continue; end if;
    perform interno.email(r.email, 'chat_mensagem',
      case when v_total = 1 then 'Você tem 1 mensagem nova da equipe' else 'Você tem ' || v_total || ' mensagens novas da equipe' end,
      'Olá, ' || coalesce(nullif(r.nome, ''), 'tudo bem') || E'.\n\nChegaram mensagens importantes nas Conversas do painel e você ainda não leu:\n\n' || v_linhas
      || E'\n\nAbra o painel para ler (as mensagens são cifradas e só aparecem lá):\n\n' || interno.endereco() || E'/pt/painel\n\nPara não receber estes avisos, desligue em Minha conta › E-mails.', '', 6);
    update conversa_membros m set avisado_em = now()
    where m.usuario = r.usuario and exists (select 1 from conversa_mensagens x where x.conversa = m.conversa and x.criado_em > m.lido_em);
  end loop;
end $$;
revoke all on function interno.chat_emails() from public, anon, authenticated;

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule('lucia-chat-emails', '*/10 * * * *', 'select interno.chat_emails()');
  end if;
exception when others then null;
end $$;

-- ───────────────────────────── Podcasts ─────────────────────────────
--
-- O departamento de jornalismo é também a rádio e o podcast: quem tem a função "jornalismo" pode cuidar dos três, ou só
-- de um. Dentro do podcast há três tarefas, que a coordenação pode separar por pessoa (interno.podcast_funcoes):
--   produção    pauta, roteiro, convidados, envio do episódio para aprovação e publicação depois de aprovado;
--   edição      versões do áudio, transcrição, capítulos e conferência técnica (volume, ruído, trilhas);
--   supervisão  aprova ou devolve com pedido de ajuste. Ninguém aprova o que ele mesmo enviou (menos a coordenação).
-- Quem tem "jornalismo" e não recebeu nenhuma tarefa separada faz produção e edição. Coordenação e vice veem e fazem tudo.
-- Convidado não tem conta: recebe um link para ler e aceitar o termo de cessão de voz e testar o microfone.
--
-- O áudio pesa. O depósito público "podcast" guarda o áudio final e as capas; o fechado "podcast-producao", as versões de
-- trabalho, os termos assinados e as perguntas gravadas pelos ouvintes. Para não pesar, o depósito guarda o
-- áudio dos episódios mais recentes (10, ou o que a coordenação definir); quando sai um novo, o mais antigo libera o
-- espaço e passa a tocar pela cópia de fora (Internet Archive ou o serviço de hospedagem), se ela estiver cadastrada.
-- Quem apaga de fato o arquivo é o painel, logo depois de publicar: o banco só diz o que pode sair.

create table if not exists interno.podcast_series (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9][a-z0-9-]{0,58}[a-z0-9]$'),
  titulo text not null check (char_length(titulo) between 2 and 80),
  descricao text not null default '' check (char_length(descricao) <= 600),
  capa text not null default '' check (capa = '' or capa ~ '^capas/[a-z0-9/_-]{8,120}[.](jpg|png|webp)$'),
  capa_mini text not null default '' check (capa_mini = '' or capa_mini ~ '^capas/[a-z0-9/_-]{8,120}[.](jpg|png|webp)$'),
  ordem integer not null default 0,
  ativa boolean not null default true,
  criado_em timestamptz not null default now()
);

create table if not exists interno.podcast_convidados (
  id uuid primary key default gen_random_uuid(),
  nome text not null check (char_length(nome) between 2 and 120),
  -- Telefone, e-mail ou rede: só a produção e a supervisão enxergam.
  contato text not null default '' check (char_length(contato) <= 300),
  minibio text not null default '' check (char_length(minibio) <= 600),
  autoriza_voz boolean not null default false,
  autoriza_imagem boolean not null default false,
  -- Termo assinado em papel ou PDF, guardado no depósito fechado.
  termo text not null default '' check (termo = '' or termo ~ '^termos/[a-z0-9/_-]{8,120}[.](pdf|jpg|png|webp)$'),
  -- Aceite pelo link: nome digitado pela pessoa, quando, e de onde (sem guardar o endereço).
  aceite_nome text not null default '' check (char_length(aceite_nome) <= 120),
  aceite_em timestamptz,
  aceite_origem text not null default '',
  token text unique,
  token_validade timestamptz,
  criado_por uuid references interno.perfis (id) on delete set null,
  criado_em timestamptz not null default now()
);

create table if not exists interno.podcast_trilhas (
  id uuid primary key default gen_random_uuid(),
  titulo text not null check (char_length(titulo) between 1 and 160),
  autor text not null default '' check (char_length(autor) <= 120),
  tipo text not null default 'trilha' check (tipo in ('vinheta', 'trilha', 'efeito')),
  -- Sem licença registrada, a faixa não entra em episódio: é isso que evita derrubada por direito autoral.
  licenca text not null check (char_length(licenca) between 2 and 120),
  fonte text not null default '' check (fonte = '' or (fonte ~ '^https://[^[:space:]]+$' and char_length(fonte) <= 300)),
  caminho text not null default '' check (caminho = '' or caminho ~ '^trilhas/[a-z0-9/_-]{8,120}[.](mp3|m4a|ogg|opus|wav|flac)$'),
  duracao integer not null default 0 check (duracao between 0 and 7200),
  nota text not null default '' check (char_length(nota) <= 500),
  criado_por uuid references interno.perfis (id) on delete set null,
  criado_em timestamptz not null default now()
);

create table if not exists interno.podcast_episodios (
  id uuid primary key default gen_random_uuid(),
  slug text unique check (slug is null or slug ~ '^[a-z0-9][a-z0-9-]{0,78}[a-z0-9]$'),
  titulo text not null check (char_length(titulo) between 3 and 140),
  resumo text not null default '' check (char_length(resumo) <= 400),
  tema text not null default '' check (char_length(tema) <= 300),
  pauta text not null default '' check (char_length(pauta) <= 6000),
  roteiro text not null default '' check (char_length(roteiro) <= 60000),
  notas text not null default '' check (char_length(notas) <= 20000),
  fontes jsonb not null default '[]'::jsonb,
  -- Obras do acervo citadas no roteiro: [{id, titulo, autor, licenca, fonte}]. Saem nas notas com link para o acervo.
  obras jsonb not null default '[]'::jsonb,
  duracao_prevista integer not null default 0 check (duracao_prevista between 0 and 600),
  convidados uuid[] not null default '{}',
  trilhas uuid[] not null default '{}',
  serie uuid references interno.podcast_series (id) on delete set null,
  temporada smallint check (temporada is null or temporada between 1 and 99),
  numero smallint check (numero is null or numero between 0 and 9999),
  temas text[] not null default '{}',
  disciplina text check (disciplina is null or disciplina ~ '^[a-z0-9-]{2,40}$'),
  trilha text check (trilha is null or trilha ~ '^[a-z0-9-]{2,80}$'),
  status text not null default 'ideia' check (status in ('ideia', 'roteiro', 'gravacao', 'edicao', 'revisao', 'aprovado', 'publicado')),
  responsavel uuid references interno.perfis (id) on delete set null,
  criado_por uuid references interno.perfis (id) on delete set null,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  versao integer not null default 1,
  gravacao_em date,
  publicar_em date,
  -- Sala da gravação a distância (Jitsi, Meet, Zoom…): o painel só guarda o link.
  sala text not null default '' check (sala = '' or (sala ~ '^https://[^[:space:]]+$' and char_length(sala) <= 300)),
  capa text not null default '' check (capa = '' or capa ~ '^capas/[a-z0-9/_-]{8,120}[.](jpg|png|webp)$'),
  capa_mini text not null default '' check (capa_mini = '' or capa_mini ~ '^capas/[a-z0-9/_-]{8,120}[.](jpg|png|webp)$'),
  -- O áudio que vai ao ar: caminho no depósito público "podcast".
  audio text not null default '' check (audio = '' or audio ~ '^ep/[0-9a-f-]{36}/[a-z0-9_-]{8,80}[.](mp3|m4a|ogg|opus)$'),
  audio_bytes bigint not null default 0 check (audio_bytes >= 0),
  audio_tipo text not null default '' check (audio_tipo in ('', 'audio/mpeg', 'audio/mp4', 'audio/ogg', 'audio/opus')),
  duracao integer not null default 0 check (duracao between 0 and 36000),
  audio_guardado boolean not null default false,
  -- Cópia de fora (Internet Archive, Spotify for Creators…): continua tocando depois que o depósito libera o espaço.
  audio_externo text not null default '' check (audio_externo = '' or (audio_externo ~ '^https://[^[:space:]]+$' and char_length(audio_externo) <= 500)),
  -- A forma da onda, já calculada no envio: o tocador desenha a barra sem baixar nada a mais.
  picos jsonb not null default '[]'::jsonb,
  transcricao text not null default '' check (char_length(transcricao) <= 300000),
  -- Legendas com tempo (WebVTT): transcrição clicável no site e legenda dos cortes.
  legendas text not null default '' check (char_length(legendas) <= 400000),
  capitulos jsonb not null default '[]'::jsonb,
  checklist jsonb not null default '{}'::jsonb,
  explicito boolean not null default false,
  nota_supervisao text not null default '' check (char_length(nota_supervisao) <= 2000),
  enviado_por uuid references interno.perfis (id) on delete set null,
  enviado_em timestamptz,
  aprovado_por uuid references interno.perfis (id) on delete set null,
  aprovado_em timestamptz,
  publicado_por uuid references interno.perfis (id) on delete set null,
  publicado_em timestamptz,
  topico uuid references interno.topicos (id) on delete set null,
  token_revisao text unique,
  token_validade timestamptz
);
create index if not exists podcast_episodios_publicados on interno.podcast_episodios (publicado_em desc) where status = 'publicado';
create index if not exists podcast_episodios_status on interno.podcast_episodios (status, atualizado_em desc);

-- Versões dos arquivos de cada episódio: bruto, editado, final, vídeo, faixa do convidado. A linha fica mesmo depois de o
-- arquivo sair do depósito: é o histórico de versões (com o link da cópia de segurança, quando houver).
create table if not exists interno.podcast_arquivos (
  id uuid primary key default gen_random_uuid(),
  episodio uuid not null references interno.podcast_episodios (id) on delete cascade,
  tipo text not null check (tipo in ('bruto', 'editado', 'final', 'video', 'convidado', 'outro')),
  deposito text not null default '' check (deposito in ('', 'podcast', 'podcast-producao')),
  caminho text not null default '' check (caminho = '' or caminho ~ '^ep/[0-9a-f-]{36}/[a-z0-9_-]{8,80}[.](mp3|m4a|ogg|opus|wav|flac|aac|mp4|webm|mov|zip)$'),
  link text not null default '' check (link = '' or (link ~ '^https://[^[:space:]]+$' and char_length(link) <= 500)),
  nome text not null check (char_length(nome) between 1 and 200),
  bytes bigint not null default 0 check (bytes >= 0),
  mime text not null default '' check (char_length(mime) <= 80),
  nota text not null default '' check (char_length(nota) <= 500),
  guardado boolean not null default true,
  enviado_por uuid references interno.perfis (id) on delete set null,
  criado_em timestamptz not null default now(),
  check (caminho <> '' or link <> '')
);
create index if not exists podcast_arquivos_episodio on interno.podcast_arquivos (episodio, criado_em desc);

-- Pedidos de ajuste com marcação de tempo ("aos 12:40, cortar a respiração").
create table if not exists interno.podcast_comentarios (
  id uuid primary key default gen_random_uuid(),
  episodio uuid not null references interno.podcast_episodios (id) on delete cascade,
  autor uuid references interno.perfis (id) on delete set null,
  texto text not null check (char_length(texto) between 1 and 2000),
  tempo integer check (tempo is null or tempo between 0 and 36000),
  arquivo uuid references interno.podcast_arquivos (id) on delete set null,
  resolvido boolean not null default false,
  criado_em timestamptz not null default now()
);
create index if not exists podcast_comentarios_episodio on interno.podcast_comentarios (episodio, criado_em);

create table if not exists interno.podcast_historico (
  id bigint generated always as identity primary key,
  episodio uuid not null references interno.podcast_episodios (id) on delete cascade,
  quem uuid references interno.perfis (id) on delete set null,
  nome text not null default '',
  acao text not null check (char_length(acao) between 2 and 60),
  nota text not null default '' check (char_length(nota) <= 2000),
  criado_em timestamptz not null default now()
);
create index if not exists podcast_historico_episodio on interno.podcast_historico (episodio, id desc);

-- Banco de pautas: as da equipe e as sugeridas pela comunidade. As que a equipe põe em votação aparecem no site.
create table if not exists interno.podcast_pautas (
  id uuid primary key default gen_random_uuid(),
  titulo text not null check (char_length(titulo) between 5 and 140),
  descricao text not null default '' check (char_length(descricao) <= 1000),
  origem text not null default 'equipe' check (origem in ('equipe', 'comunidade')),
  autor uuid references interno.perfis (id) on delete set null,
  status text not null default 'sugerida' check (status in ('sugerida', 'votacao', 'escolhida', 'gravada', 'descartada')),
  episodio uuid references interno.podcast_episodios (id) on delete set null,
  votos integer not null default 0,
  criado_em timestamptz not null default now(),
  decidido_em timestamptz
);
create index if not exists podcast_pautas_status on interno.podcast_pautas (status, votos desc);

create table if not exists interno.podcast_votos (
  pauta uuid not null references interno.podcast_pautas (id) on delete cascade,
  usuario uuid not null references interno.perfis (id) on delete cascade,
  criado_em timestamptz not null default now(),
  primary key (pauta, usuario)
);

-- "Pergunte ao podcast": por texto ou por áudio gravado no próprio site. Só a equipe do podcast lê.
create table if not exists interno.podcast_perguntas (
  id uuid primary key default gen_random_uuid(),
  autor uuid references interno.perfis (id) on delete set null,
  -- Como a pessoa quer ser chamada no ar ("Ana, de Recife"). Vazio: a pergunta é lida sem nome.
  assinatura text not null default '' check (char_length(assinatura) <= 60),
  texto text not null default '' check (char_length(texto) <= 1500),
  audio text not null default '' check (audio = '' or audio ~ '^perguntas/[0-9a-f-]{36}/[a-z0-9_-]{8,80}[.](webm|ogg|mp4|m4a|mp3|wav)$'),
  status text not null default 'nova' check (status in ('nova', 'escolhida', 'respondida', 'descartada')),
  episodio uuid references interno.podcast_episodios (id) on delete set null,
  criado_em timestamptz not null default now(),
  check (texto <> '' or audio <> '')
);
create index if not exists podcast_perguntas_status on interno.podcast_perguntas (status, criado_em desc);

-- Agenda de postagens nas redes (cortes, artes, chamadas), ao lado das datas de gravação e de publicação.
create table if not exists interno.podcast_postagens (
  id uuid primary key default gen_random_uuid(),
  episodio uuid references interno.podcast_episodios (id) on delete set null,
  rede text not null check (rede in ('instagram', 'tiktok', 'youtube', 'facebook', 'x', 'outra')),
  formato text not null default 'corte' check (formato in ('corte', 'arte', 'carrossel', 'story', 'video', 'texto')),
  quando timestamptz not null,
  legenda text not null default '' check (char_length(legenda) <= 2200),
  status text not null default 'planejada' check (status in ('planejada', 'pronta', 'publicada')),
  link text not null default '' check (link = '' or (link ~ '^https://[^[:space:]]+$' and char_length(link) <= 300)),
  criado_por uuid references interno.perfis (id) on delete set null,
  criado_em timestamptz not null default now()
);
create index if not exists podcast_postagens_quando on interno.podcast_postagens (quando);

-- Entregas e pagamentos já existiram aqui e saíram: o painel não guarda valores. Banco instalado antes perde a tabela
-- e as funções.
drop function if exists public.podcast_entregas_listar();
drop function if exists public.podcast_entrega_salvar(uuid, jsonb);
drop function if exists public.podcast_entrega_marcar(uuid, text, boolean, text);
drop function if exists public.podcast_entrega_remover(uuid);
drop table if exists interno.podcast_entregas;

create table if not exists interno.podcast_funcoes (
  usuario uuid not null references interno.perfis (id) on delete cascade,
  funcao text not null check (funcao in ('producao', 'edicao', 'supervisao')),
  primary key (usuario, funcao)
);

-- Pedidos de arte ao design: capa, card de divulgação, ajuste de modelo.
create table if not exists interno.podcast_pedidos (
  id uuid primary key default gen_random_uuid(),
  episodio uuid references interno.podcast_episodios (id) on delete cascade,
  texto text not null check (char_length(texto) between 5 and 1000),
  pedido_por uuid references interno.perfis (id) on delete set null,
  status text not null default 'aberto' check (status in ('aberto', 'feito')),
  atendido_por uuid references interno.perfis (id) on delete set null,
  criado_em timestamptz not null default now(),
  feito_em timestamptz
);

-- Quantas vezes cada episódio foi tocado no site, por dia. Não guarda quem ouviu nem de onde.
create table if not exists interno.podcast_audicoes (
  episodio uuid not null references interno.podcast_episodios (id) on delete cascade,
  dia date not null default current_date,
  total integer not null default 0,
  primary key (episodio, dia)
);

-- Arquivos que podem sair dos depósitos: o banco anota, o painel apaga pelo serviço de arquivos e confirma.
create table if not exists interno.podcast_liberar (
  deposito text not null check (deposito in ('podcast', 'podcast-producao')),
  caminho text not null check (char_length(caminho) between 5 and 300),
  motivo text not null default '',
  criado_em timestamptz not null default now(),
  primary key (deposito, caminho)
);

insert into interno.configuracoes (chave, valor) values ('podcast', jsonb_build_object(
  'nome', 'Podcast do Instituto Lúcia',
  'descricao', 'Conversas de formação política e popular do Instituto Lúcia: história, economia, luta social e o que cai no ENEM, de graça e para todo mundo.',
  'autor', 'Instituto Lúcia',
  'email', '',
  'categoria', 'Education',
  'subcategoria', 'Courses',
  'explicito', false,
  'capa', '',
  'capa_mini', '',
  'guardados', 10,
  'links', '{}'::jsonb
)) on conflict do nothing;

do $$
declare t record;
begin
  for t in select tablename from pg_tables where schemaname = 'interno' and tablename like 'podcast%' loop
    execute format('alter table interno.%I enable row level security', t.tablename);
    execute format('revoke all on interno.%I from public', t.tablename);
  end loop;
end $$;

do $$
declare tabela text;
begin
  foreach tabela in array array['podcast_pautas', 'podcast_perguntas', 'podcast_votos'] loop
    execute format('drop trigger if exists lucia_pausa on interno.%I', tabela);
    execute format('create trigger lucia_pausa before insert on interno.%I for each row execute function interno.pausa()', tabela);
  end loop;
end $$;

-- Quem faz parte do podcast: coordenação, vice, jornalismo, ou quem recebeu uma tarefa do podcast.
create or replace function interno.podcaster() returns boolean language sql stable security definer set search_path = interno, pg_temp as $$
  select interno.coord() or interno.tem('jornalismo')
    or (auth.uid() is not null and (interno.aal2() or not interno.tem_fator())
        and exists (select 1 from podcast_funcoes p join perfis f on f.id = p.usuario where p.usuario = auth.uid() and not f.suspenso))
$$;

/**
 * A pessoa pode fazer esta tarefa do podcast? ('producao', 'edicao' ou 'supervisao'.) Coordenação e vice, sempre.
 * Quem tem jornalismo e nenhuma tarefa separada faz produção e edição; quem recebeu tarefas faz só as que recebeu.
 */
create or replace function interno.podcast_pode(p_funcao text) returns boolean language sql stable security definer set search_path = interno, pg_temp as $$
  select interno.coord()
    -- A "supervisão do podcast" deixou de ser um cargo próprio: a supervisão geral e o representante do jornalismo
    -- a exercem (quem foi nomeado antes pela função podcast_funcoes continua valendo, pelo caso abaixo).
    or (p_funcao = 'supervisao' and (interno.tem('supervisao') or exists (select 1 from papeis where usuario = auth.uid() and papel = 'representante' and disciplina = 'jornalismo')))
    or (
    auth.uid() is not null and (interno.aal2() or not interno.tem_fator())
    and not exists (select 1 from perfis where id = auth.uid() and suspenso)
    and case
      when exists (select 1 from podcast_funcoes where usuario = auth.uid())
        then exists (select 1 from podcast_funcoes where usuario = auth.uid() and funcao = p_funcao)
      else p_funcao in ('producao', 'edicao') and interno.tem('jornalismo')
    end)
$$;

/** Quem lê os episódios em andamento e pede ajustes: o podcast, a mediação e a curadoria. */
create or replace function interno.podcast_revisor() returns boolean language sql stable as $$
  select interno.podcaster() or interno.tem('mediacao') or interno.tem('curadoria')
$$;

create or replace function interno.podcast_temas() returns text[] language sql immutable as $$
  select array['historia', 'economia', 'luta-social', 'enem', 'filosofia', 'cultura', 'ciencia', 'trabalho', 'educacao', 'internacional', 'memoria', 'atualidade']
$$;

create or replace function interno.podcast_link(p text, p_campo text, p_max integer default 500) returns text language plpgsql immutable as $$
declare v text := btrim(coalesce(p, ''));
begin
  if v = '' then return ''; end if;
  if v !~ '^https://[^[:space:]<>"]+$' or char_length(v) > p_max then raise exception 'invalido:%', p_campo using errcode = 'P0001'; end if;
  return v;
end $$;

create or replace function interno.podcast_int(p jsonb, p_campo text, p_min integer, p_max integer) returns integer language plpgsql immutable as $$
declare v text;
begin
  if p is null or jsonb_typeof(p) = 'null' or p = '""'::jsonb then return null; end if;
  if jsonb_typeof(p) not in ('number', 'string') then raise exception 'invalido:%', p_campo using errcode = 'P0001'; end if;
  v := p #>> '{}';
  if v !~ '^-?[0-9]{1,9}$' then raise exception 'invalido:%', p_campo using errcode = 'P0001'; end if;
  if v::integer < p_min or v::integer > p_max then raise exception 'invalido:%', p_campo using errcode = 'P0001'; end if;
  return v::integer;
end $$;

create or replace function interno.podcast_data(p text, p_campo text) returns date language plpgsql immutable as $$
begin
  if coalesce(btrim(p), '') = '' then return null; end if;
  if p !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' then raise exception 'invalido:%', p_campo using errcode = 'P0001'; end if;
  return p::date;
exception when others then
  raise exception 'invalido:%', p_campo using errcode = 'P0001';
end $$;

create or replace function interno.podcast_uuids(p jsonb, p_campo text, p_max integer) returns uuid[] language plpgsql immutable as $$
declare v uuid[] := '{}'; x text;
begin
  if p is null or jsonb_typeof(p) = 'null' then return '{}'; end if;
  if jsonb_typeof(p) <> 'array' or jsonb_array_length(p) > p_max then raise exception 'invalido:%', p_campo using errcode = 'P0001'; end if;
  for x in select jsonb_array_elements_text(p) loop
    if x !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then raise exception 'invalido:%', p_campo using errcode = 'P0001'; end if;
    if not (x::uuid = any(v)) then v := v || x::uuid; end if;
  end loop;
  return v;
end $$;

/** Capítulos: [{t: segundos, titulo}], em ordem de tempo. */
create or replace function interno.podcast_capitulos(p jsonb) returns jsonb language plpgsql immutable as $$
declare v jsonb := coalesce(p, '[]'::jsonb); c jsonb; saida jsonb := '[]'::jsonb;
begin
  if jsonb_typeof(v) <> 'array' or jsonb_array_length(v) > 80 then raise exception 'invalido:capitulos' using errcode = 'P0001'; end if;
  for c in select x from jsonb_array_elements(v) x
           order by case when jsonb_typeof(x) = 'object' and coalesce(x ->> 't', '') ~ '^[0-9]{1,5}([.][0-9]+)?$' then (x ->> 't')::numeric end nulls first loop
    if jsonb_typeof(c) <> 'object' or coalesce(c ->> 't', '') !~ '^[0-9]{1,5}([.][0-9]+)?$' then raise exception 'invalido:capitulos' using errcode = 'P0001'; end if;
    if (c ->> 't')::numeric > 36000 then raise exception 'invalido:capitulos' using errcode = 'P0001'; end if;
    saida := saida || jsonb_build_object('t', floor((c ->> 't')::numeric)::integer, 'titulo', interno.txt(c ->> 'titulo', 'capitulos', 1, 120));
  end loop;
  return saida;
end $$;

/** Obras do acervo citadas: [{id, titulo, autor, licenca, fonte}]. */
create or replace function interno.podcast_obras(p jsonb) returns jsonb language plpgsql immutable as $$
declare v jsonb := coalesce(p, '[]'::jsonb); o jsonb; saida jsonb := '[]'::jsonb;
begin
  if jsonb_typeof(v) <> 'array' or jsonb_array_length(v) > 40 then raise exception 'invalido:obras' using errcode = 'P0001'; end if;
  for o in select * from jsonb_array_elements(v) loop
    if jsonb_typeof(o) <> 'object' or coalesce(o ->> 'id', '') !~ '^[a-z0-9][a-z0-9-]{0,118}[a-z0-9]$' then raise exception 'invalido:obras' using errcode = 'P0001'; end if;
    saida := saida || jsonb_build_object('id', o ->> 'id', 'titulo', interno.txt(o ->> 'titulo', 'obras', 1, 300), 'autor', interno.txt(o ->> 'autor', 'obras', 0, 200),
      'licenca', interno.txt(o ->> 'licenca', 'obras', 0, 60), 'fonte', interno.txt(o ->> 'fonte', 'obras', 0, 200));
  end loop;
  return saida;
end $$;

/** A forma da onda: até 600 números de 0 a 100. */
create or replace function interno.podcast_picos(p jsonb) returns jsonb language plpgsql immutable as $$
declare v jsonb := coalesce(p, '[]'::jsonb);
begin
  if jsonb_typeof(v) <> 'array' or jsonb_array_length(v) > 600 then raise exception 'invalido:picos' using errcode = 'P0001'; end if;
  if exists (select 1 from jsonb_array_elements(v) x where case when jsonb_typeof(x) <> 'number' then true else (x #>> '{}')::numeric not between 0 and 100 end) then
    raise exception 'invalido:picos' using errcode = 'P0001';
  end if;
  return (select coalesce(jsonb_agg(round((x #>> '{}')::numeric)::integer), '[]'::jsonb) from jsonb_array_elements(v) x);
end $$;

/** A conferência técnica que a edição marca à mão. Só estas chaves, só verdadeiro ou falso. */
create or replace function interno.podcast_checklist(p jsonb) returns jsonb language sql immutable as $$
  select jsonb_build_object(
    'volume', coalesce(p ->> 'volume', '') = 'true', 'ruido', coalesce(p ->> 'ruido', '') = 'true',
    'fontes', coalesce(p ->> 'fontes', '') = 'true', 'trilhas', coalesce(p ->> 'trilhas', '') = 'true')
$$;

create or replace function interno.podcast_slug(p_titulo text, p_id uuid) returns text language plpgsql stable security definer set search_path = interno, pg_temp as $$
declare v_base text := btrim(left(replace(interno.normal(p_titulo), ' ', '-'), 70), '-'); v text; n integer := 1;
begin
  if char_length(v_base) < 2 then v_base := 'episodio'; end if;
  -- Endereços que já são páginas do site (/podcasts/revisao, /podcasts/convidado, /podcasts/microfone).
  if v_base in ('revisao', 'convidado', 'microfone') then v_base := v_base || '-episodio'; end if;
  v := v_base;
  while exists (select 1 from podcast_episodios where slug = v and id is distinct from p_id) loop
    n := n + 1;
    v := v_base || '-' || n;
  end loop;
  return v;
end $$;

create or replace function interno.podcast_token() returns text language sql volatile as $$
  select replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '')
$$;

create or replace function interno.podcast_anotar(p_episodio uuid, p_acao text, p_nota text default '') returns void language plpgsql security definer set search_path = interno, pg_temp as $$
begin
  insert into podcast_historico (episodio, quem, nome, acao, nota)
  values (p_episodio, auth.uid(), coalesce((select nome from perfis where id = auth.uid()), 'sistema'), left(p_acao, 60), left(coalesce(p_nota, ''), 2000));
end $$;

/** O que falta para publicar. Vazio: pode ir ao ar. */
create or replace function interno.podcast_pendencias(e interno.podcast_episodios) returns text[] language sql stable security definer set search_path = interno, pg_temp as $$
  select array_remove(array[
    case when e.status not in ('aprovado', 'publicado') then 'aprovacao' end,
    case when not ((e.audio <> '' and e.audio_guardado) or e.audio_externo <> '') then 'audio' end,
    case when e.duracao <= 0 then 'duracao' end,
    case when e.capa = '' then 'capa' end,
    case when char_length(e.resumo) < 20 then 'resumo' end,
    case when char_length(e.notas) < 50 then 'notas' end,
    case when char_length(e.transcricao) < 200 then 'transcricao' end,
    case when exists (select 1 from podcast_convidados c where c.id = any(e.convidados) and not c.autoriza_voz) then 'convidados' end,
    case when coalesce((e.checklist ->> 'volume')::boolean, false) is not true then 'volume' end,
    case when coalesce((e.checklist ->> 'ruido')::boolean, false) is not true then 'ruido' end,
    case when coalesce((e.checklist ->> 'fontes')::boolean, false) is not true then 'fontes' end,
    case when coalesce((e.checklist ->> 'trilhas')::boolean, false) is not true then 'trilhas' end
  ], null)
$$;

/** O episódio como o site mostra. Completo: com notas, capítulos, transcrição e convidados. */
create or replace function interno.podcast_publico_json(e interno.podcast_episodios, p_completo boolean) returns jsonb
language sql stable security definer set search_path = interno, pg_temp as $$
  select jsonb_build_object(
    'id', e.id, 'slug', e.slug, 'titulo', e.titulo, 'resumo', e.resumo, 'capa', e.capa, 'capa_mini', e.capa_mini,
    'duracao', e.duracao, 'publicado_em', e.publicado_em, 'temporada', e.temporada, 'numero', e.numero, 'temas', to_jsonb(e.temas),
    'disciplina', e.disciplina, 'trilha', e.trilha, 'explicito', e.explicito,
    'audio', case when e.audio_guardado then e.audio else '' end, 'audio_bytes', e.audio_bytes, 'audio_tipo', e.audio_tipo, 'externo', e.audio_externo,
    'serie', (select jsonb_build_object('slug', s.slug, 'titulo', s.titulo) from podcast_series s where s.id = e.serie),
    'plays', (select coalesce(sum(a.total), 0) from podcast_audicoes a where a.episodio = e.id))
  || case when p_completo then jsonb_build_object(
    'notas', e.notas, 'fontes', e.fontes, 'obras', e.obras, 'capitulos', e.capitulos, 'transcricao', e.transcricao, 'legendas', e.legendas,
    'picos', e.picos, 'topico', e.topico,
    'convidados', (select coalesce(jsonb_agg(jsonb_build_object('nome', c.nome, 'minibio', c.minibio) order by array_position(e.convidados, c.id)), '[]'::jsonb)
                   from podcast_convidados c where c.id = any(e.convidados) and c.autoriza_voz))
  else '{}'::jsonb end
$$;

/** Uma linha do quadro de episódios no painel. */
create or replace function interno.podcast_resumo_json(e interno.podcast_episodios) returns jsonb language sql stable security definer set search_path = interno, pg_temp as $$
  select jsonb_build_object(
    'id', e.id, 'slug', e.slug, 'titulo', e.titulo, 'status', e.status, 'serie', e.serie, 'temporada', e.temporada, 'numero', e.numero,
    'capa', e.capa, 'capa_mini', e.capa_mini, 'disciplina', e.disciplina, 'temas', to_jsonb(e.temas),
    'responsavel', (select jsonb_build_object('id', f.id, 'nome', f.nome) from perfis f where f.id = e.responsavel),
    'gravacao_em', e.gravacao_em, 'publicar_em', e.publicar_em, 'publicado_em', e.publicado_em, 'atualizado_em', e.atualizado_em,
    'duracao', e.duracao, 'duracao_prevista', e.duracao_prevista, 'audio_guardado', e.audio_guardado, 'externo', e.audio_externo <> '',
    'audio_bytes', e.audio_bytes, 'enviado_por', (select nome from perfis where id = e.enviado_por),
    'comentarios', (select count(*) from podcast_comentarios k where k.episodio = e.id and not k.resolvido),
    'pendencias', to_jsonb(interno.podcast_pendencias(e)), 'nota_supervisao', e.nota_supervisao)
$$;

/**
 * Rodízio do depósito: guarda o áudio dos episódios mais recentes (10, ou o número definido nas configurações).
 * O áudio dos outros é anotado para sair; o episódio continua no site e passa a tocar pela cópia de fora.
 */
create or replace function interno.podcast_rodizio() returns void language plpgsql security definer set search_path = interno, pg_temp as $$
declare v_limite integer := greatest(1, least(50, coalesce((select (valor ->> 'guardados')::integer from configuracoes where chave = 'podcast'), 10))); r record;
begin
  for r in select id, audio from podcast_episodios where status = 'publicado' and audio_guardado and audio <> '' order by publicado_em desc nulls last offset v_limite loop
    update podcast_episodios set audio_guardado = false where id = r.id;
    update podcast_arquivos set guardado = false where episodio = r.id and deposito = 'podcast' and caminho = r.audio;
    insert into podcast_liberar (deposito, caminho, motivo) values ('podcast', r.audio, 'rodizio') on conflict do nothing;
    insert into podcast_historico (episodio, nome, acao, nota) values (r.id, 'sistema', 'audio_liberado', 'O áudio saiu do depósito para dar lugar aos episódios mais novos.');
  end loop;
end $$;

/** Faxina diária: versões de trabalho de episódio no ar há mais de 30 dias, links vencidos e contagens muito antigas. */
create or replace function interno.podcast_limpeza() returns void language plpgsql security definer set search_path = interno, pg_temp as $$
begin
  insert into podcast_liberar (deposito, caminho, motivo)
  select a.deposito, a.caminho, 'versao_de_trabalho' from podcast_arquivos a join podcast_episodios e on e.id = a.episodio
  where e.status = 'publicado' and e.publicado_em < now() - interval '30 days' and a.guardado and a.deposito = 'podcast-producao' and a.caminho <> ''
  on conflict do nothing;
  insert into podcast_liberar (deposito, caminho, motivo)
  select 'podcast-producao', p.audio, 'pergunta_antiga' from podcast_perguntas p
  where p.audio <> '' and p.status in ('respondida', 'descartada') and p.criado_em < now() - interval '90 days'
  on conflict do nothing;
  update podcast_episodios set token_revisao = null, token_validade = null where token_validade < now();
  update podcast_convidados set token = null, token_validade = null where token_validade < now();
  delete from podcast_audicoes where dia < current_date - 400;
end $$;

-- ── Leitura pública ──

/** Tudo o que a página de podcasts mostra: configuração, séries e episódios no ar. */
create or replace function public.podcast_catalogo() returns jsonb language sql stable security definer set search_path = interno, pg_temp as $$
  select jsonb_build_object(
    'config', (select jsonb_build_object('nome', valor ->> 'nome', 'descricao', valor ->> 'descricao', 'autor', valor ->> 'autor', 'capa', valor ->> 'capa',
                                         'capa_mini', valor ->> 'capa_mini', 'links', coalesce(valor -> 'links', '{}'::jsonb))
               from configuracoes where chave = 'podcast'),
    'series', coalesce((select jsonb_agg(jsonb_build_object('id', s.id, 'slug', s.slug, 'titulo', s.titulo, 'descricao', s.descricao, 'capa', s.capa, 'capa_mini', s.capa_mini) order by s.ordem, s.titulo)
                        from podcast_series s where s.ativa and exists (select 1 from podcast_episodios e where e.serie = s.id and e.status = 'publicado')), '[]'::jsonb),
    'episodios', coalesce((select jsonb_agg(interno.podcast_publico_json(e, false) order by e.publicado_em desc)
                           from podcast_episodios e where e.status = 'publicado' and (e.audio_guardado or e.audio_externo <> '')), '[]'::jsonb))
$$;

create or replace function public.podcast_episodio(p_slug text) returns jsonb language sql stable security definer set search_path = interno, pg_temp as $$
  select interno.podcast_publico_json(e, true) from podcast_episodios e where e.slug = p_slug and e.status = 'publicado'
$$;

/** Os episódios ligados a uma disciplina (ou a um curso), para aparecer como material complementar. */
create or replace function public.podcast_por_disciplina(p_disciplina text, p_trilha text default null) returns jsonb
language sql stable security definer set search_path = interno, pg_temp as $$
  select coalesce(jsonb_agg(interno.podcast_publico_json(e, false) order by (e.trilha is not distinct from p_trilha) desc, e.publicado_em desc), '[]'::jsonb)
  from podcast_episodios e
  where e.id in (select x.id from podcast_episodios x
                 where x.status = 'publicado' and (x.audio_guardado or x.audio_externo <> '')
                   and ((p_disciplina is not null and x.disciplina = p_disciplina) or (p_trilha is not null and x.trilha = p_trilha))
                 order by (x.trilha is not distinct from p_trilha) desc, x.publicado_em desc limit 8)
$$;

/** Para o aviso de episódio novo no menu: só a data do mais recente. */
create or replace function public.podcast_novidade() returns jsonb language sql stable security definer set search_path = interno, pg_temp as $$
  select jsonb_build_object('ultimo', max(publicado_em), 'total', count(*)) from podcast_episodios where status = 'publicado'
$$;

/** O que o feed RSS precisa. Com p_serie, só os episódios daquela série. */
create or replace function public.podcast_feed(p_serie text default null) returns jsonb language sql stable security definer set search_path = interno, pg_temp as $$
  select jsonb_build_object(
    'config', (select valor - 'guardados' from configuracoes where chave = 'podcast'),
    'serie', (select jsonb_build_object('slug', s.slug, 'titulo', s.titulo, 'descricao', s.descricao, 'capa', s.capa) from podcast_series s where s.slug = p_serie),
    'episodios', coalesce((select jsonb_agg(interno.podcast_publico_json(e, false) || jsonb_build_object('notas', e.notas, 'capitulos', e.capitulos, 'tem_legendas', e.legendas <> '',
                                    'convidados', (select coalesce(jsonb_agg(c.nome), '[]'::jsonb) from podcast_convidados c where c.id = any(e.convidados) and c.autoriza_voz))
                                  order by e.publicado_em desc)
                           from podcast_episodios e
                           where e.status = 'publicado' and (e.audio_guardado or e.audio_externo <> '')
                             and (p_serie is null or e.serie = (select id from podcast_series where slug = p_serie))), '[]'::jsonb))
$$;

/** Conta uma audição. Não guarda quem ouviu; só freia quem tenta inflar o número. */
create or replace function public.podcast_ouvir(p_id uuid) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
begin
  perform interno.limite('podcast_ouvir', 60, 60);
  if not exists (select 1 from podcast_episodios where id = p_id and status = 'publicado') then return jsonb_build_object('ok', false); end if;
  insert into podcast_audicoes (episodio, dia, total) values (p_id, current_date, 1)
  on conflict (episodio, dia) do update set total = podcast_audicoes.total + 1;
  return jsonb_build_object('ok', true);
end $$;

-- ── Comunidade: pautas em votação e perguntas ──

create or replace function public.podcast_pautas_publicas() returns jsonb language sql stable security definer set search_path = interno, pg_temp as $$
  select jsonb_build_object(
    'votacao', coalesce((select jsonb_agg(jsonb_build_object('id', p.id, 'titulo', p.titulo, 'descricao', p.descricao, 'votos', p.votos, 'origem', p.origem,
                                                             'meu_voto', exists (select 1 from podcast_votos v where v.pauta = p.id and v.usuario = auth.uid())) order by p.votos desc, p.criado_em)
                         from podcast_pautas p where p.status = 'votacao'), '[]'::jsonb),
    'escolhidas', coalesce((select jsonb_agg(jsonb_build_object('id', p.id, 'titulo', p.titulo, 'status', p.status,
                                                                'episodio', (select e.slug from podcast_episodios e where e.id = p.episodio and e.status = 'publicado')) order by p.decidido_em desc)
                            from (select * from podcast_pautas where status in ('escolhida', 'gravada') order by decidido_em desc nulls last limit 8) p), '[]'::jsonb))
$$;

/** Sugerir pauta: com conta, três por dia, e o texto passa pelo mesmo filtro da comunidade. A equipe decide se vai a votação. */
create or replace function public.podcast_pauta_sugerir(p_titulo text, p_descricao text) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); v_titulo text := interno.txt(p_titulo, 'titulo', 5, 140); v_descricao text := interno.txt(p_descricao, 'descricao', 0, 1000); v_id uuid;
begin
  perform interno.limite('podcast_pauta', 3, 1440);
  if interno.vetado(v_titulo || ' ' || v_descricao) then perform interno.erro('conteudo_recusado'); end if;
  insert into podcast_pautas (titulo, descricao, origem, autor, status) values (v_titulo, v_descricao, 'comunidade', v, 'sugerida') returning id into v_id;
  return jsonb_build_object('id', v_id);
end $$;

create or replace function public.podcast_pauta_votar(p_id uuid, p_votar boolean) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); v_total integer;
begin
  perform interno.limite('podcast_votar', 120, 60);
  perform 1 from podcast_pautas where id = p_id and status = 'votacao' for update;
  if not found then perform interno.erro('nao_encontrado'); end if;
  if coalesce(p_votar, true) then insert into podcast_votos (pauta, usuario) values (p_id, v) on conflict do nothing;
  else delete from podcast_votos where pauta = p_id and usuario = v; end if;
  update podcast_pautas set votos = (select count(*) from podcast_votos where pauta = p_id) where id = p_id returning votos into v_total;
  return jsonb_build_object('votos', v_total, 'meu_voto', coalesce(p_votar, true));
end $$;

/** "Pergunte ao podcast": texto, áudio gravado no site (já enviado para a pasta da própria pessoa) ou os dois. */
create or replace function public.podcast_perguntar(p_texto text, p_audio text, p_assinatura text, p_episodio uuid default null) returns jsonb
language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); v_texto text := interno.txt(p_texto, 'texto', 0, 1500); v_audio text := btrim(coalesce(p_audio, '')); v_id uuid;
begin
  perform interno.limite('podcast_pergunta', 5, 1440);
  if v_texto = '' and v_audio = '' then perform interno.erro('invalido:texto'); end if;
  if v_audio <> '' and (v_audio !~ '^perguntas/[0-9a-f-]{36}/[a-z0-9_-]{8,80}[.](webm|ogg|mp4|m4a|mp3|wav)$' or split_part(v_audio, '/', 2) <> v::text) then
    perform interno.erro('invalido:audio');
  end if;
  if interno.vetado(v_texto || ' ' || coalesce(p_assinatura, '')) then perform interno.erro('conteudo_recusado'); end if;
  insert into podcast_perguntas (autor, assinatura, texto, audio, episodio)
  values (v, interno.txt(p_assinatura, 'assinatura', 0, 60), v_texto, v_audio,
          (select id from podcast_episodios where id = p_episodio and status = 'publicado'))
  returning id into v_id;
  return jsonb_build_object('id', v_id);
end $$;

-- ── Link de revisão e convidados (sem conta) ──

/** Rascunho para quem aprova, pelo link privado: não aparece no site e o link vence em 30 dias. */
create or replace function public.podcast_revisao(p_token text) returns jsonb language plpgsql stable security definer set search_path = interno, pg_temp as $$
declare e podcast_episodios;
begin
  if coalesce(p_token, '') !~ '^[0-9a-f]{64}$' then perform interno.erro('nao_encontrado'); end if;
  select * into e from podcast_episodios where token_revisao = p_token and token_validade > now();
  if not found then perform interno.erro('nao_encontrado'); end if;
  return jsonb_build_object(
    'id', e.id, 'titulo', e.titulo, 'resumo', e.resumo, 'roteiro', e.roteiro, 'notas', e.notas, 'capa', e.capa, 'status', e.status,
    'audio', e.audio, 'externo', e.audio_externo, 'duracao', e.duracao, 'picos', e.picos, 'capitulos', e.capitulos, 'transcricao', e.transcricao,
    'fontes', e.fontes, 'obras', e.obras,
    'pendencias', to_jsonb(interno.podcast_pendencias(e)),
    'pode_comentar', interno.podcast_revisor(), 'pode_aprovar', interno.podcast_pode('supervisao') and e.status = 'revisao',
    'comentarios', coalesce((select jsonb_agg(jsonb_build_object('id', k.id, 'texto', k.texto, 'tempo', k.tempo, 'resolvido', k.resolvido, 'criado_em', k.criado_em,
                                                                 'autor', coalesce(f.nome, '')) order by k.criado_em)
                             from podcast_comentarios k left join perfis f on f.id = k.autor where k.episodio = e.id), '[]'::jsonb));
end $$;

create or replace function public.podcast_convidado_ver(p_token text) returns jsonb language plpgsql stable security definer set search_path = interno, pg_temp as $$
declare c podcast_convidados;
begin
  if coalesce(p_token, '') !~ '^[0-9a-f]{64}$' then perform interno.erro('nao_encontrado'); end if;
  select * into c from podcast_convidados where token = p_token and token_validade > now();
  if not found then perform interno.erro('nao_encontrado'); end if;
  return jsonb_build_object('nome', c.nome, 'aceito', c.aceite_em is not null, 'aceite_em', c.aceite_em, 'autoriza_voz', c.autoriza_voz, 'autoriza_imagem', c.autoriza_imagem,
    'episodios', coalesce((select jsonb_agg(e.titulo order by e.criado_em) from podcast_episodios e where c.id = any(e.convidados)), '[]'::jsonb));
end $$;

/** O convidado lê o termo de cessão, digita o nome completo e aceita. Fica anotado quando e de que origem (sem o endereço). */
create or replace function public.podcast_convidado_aceitar(p_token text, p_nome text, p_voz boolean, p_imagem boolean) returns jsonb
language plpgsql security definer set search_path = interno, pg_temp as $$
declare c podcast_convidados; v_nome text := interno.txt(p_nome, 'nome', 5, 120);
begin
  perform interno.limite('podcast_aceite', 10, 60);
  if coalesce(p_token, '') !~ '^[0-9a-f]{64}$' then perform interno.erro('nao_encontrado'); end if;
  select * into c from podcast_convidados where token = p_token and token_validade > now() for update;
  if not found then perform interno.erro('nao_encontrado'); end if;
  if not coalesce(p_voz, false) then perform interno.erro('invalido:voz'); end if;
  update podcast_convidados set aceite_nome = v_nome, aceite_em = now(), aceite_origem = interno.origem(), autoriza_voz = true,
         autoriza_imagem = coalesce(p_imagem, false) where id = c.id;
  perform interno.avisar(c.criado_por, format('%s aceitou o termo de cessão de voz%s do podcast.', c.nome, case when coalesce(p_imagem, false) then ' e imagem' else '' end));
  return jsonb_build_object('ok', true);
end $$;

-- ── Painel ──

/** A mesa do podcast: tarefas de quem pede, episódios, séries, configuração, contagens e o estado do depósito. */
create or replace function public.podcast_painel() returns jsonb language plpgsql stable security definer set search_path = interno, pg_temp as $$
declare
  v uuid := interno.eu(); v_design boolean := interno.tem('design'); v_time boolean := interno.podcaster(); v_rev boolean := interno.podcast_revisor();
  v_sup boolean := interno.podcast_pode('supervisao'); v_prod boolean := interno.podcast_pode('producao');
  c jsonb := coalesce((select valor from configuracoes where chave = 'podcast'), '{}'::jsonb);
  v_limite integer := coalesce((c ->> 'guardados')::integer, 10);
begin
  if not (v_rev or v_design) then perform interno.erro('sem_permissao'); end if;
  return jsonb_build_object(
    'eu', jsonb_build_object('id', v, 'producao', v_prod, 'edicao', interno.podcast_pode('edicao'), 'supervisao', v_sup,
                             'coordenacao', interno.coord(), 'design', v_design, 'time', v_time, 'revisor', v_rev),
    'config', c,
    'series', coalesce((select jsonb_agg(to_jsonb(s) order by s.ordem, s.titulo) from podcast_series s), '[]'::jsonb),
    'episodios', coalesce((select jsonb_agg(interno.podcast_resumo_json(e)
                             order by array_position(array['revisao', 'aprovado', 'edicao', 'gravacao', 'roteiro', 'ideia', 'publicado'], e.status), e.atualizado_em desc)
                           from podcast_episodios e
                           where v_rev or exists (select 1 from podcast_pedidos p where p.episodio = e.id and p.status = 'aberto')), '[]'::jsonb),
    'contagens', jsonb_build_object(
      'revisao', case when v_sup then (select count(*) from podcast_episodios where status = 'revisao' and (enviado_por is distinct from v or interno.coord())) else 0 end,
      'perguntas', case when v_time then (select count(*) from podcast_perguntas where status = 'nova') else 0 end,
      'sugestoes', case when v_time then (select count(*) from podcast_pautas where status = 'sugerida') else 0 end,
      'pedidos', (select count(*) from podcast_pedidos where status = 'aberto'),
      'comentarios', case when v_time then (select count(*) from podcast_comentarios k join podcast_episodios e on e.id = k.episodio
                                            where not k.resolvido and k.autor is distinct from v and v in (e.responsavel, e.criado_por, e.enviado_por)) else 0 end),
    'armazenamento', case when v_time then jsonb_build_object(
      'limite', v_limite,
      'guardados', (select count(*) from podcast_episodios where status = 'publicado' and audio_guardado),
      'bytes_publicos', (select coalesce(sum(audio_bytes), 0) from podcast_episodios where audio_guardado)
                        + (select coalesce(sum(bytes), 0) from podcast_arquivos where guardado and deposito = 'podcast' and caminho not in (select audio from podcast_episodios where audio_guardado)),
      'bytes_producao', (select coalesce(sum(bytes), 0) from podcast_arquivos where guardado and deposito = 'podcast-producao'),
      'liberar', (select count(*) from podcast_liberar),
      -- Os próximos a perder o áudio guardado quando sair um episódio novo, e se têm cópia de fora.
      'proximos', coalesce((select jsonb_agg(jsonb_build_object('id', x.id, 'titulo', x.titulo, 'externo', x.audio_externo <> '') order by x.publicado_em)
                            from (select * from podcast_episodios where status = 'publicado' and audio_guardado order by publicado_em desc offset greatest(v_limite - 1, 0)) x), '[]'::jsonb))
    else '{}'::jsonb end);
end $$;

/** Quantas coisas esperam por esta pessoa no podcast (para o número no menu do painel). */
create or replace function public.podcast_contagem() returns integer language plpgsql stable security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); n integer := 0;
begin
  if interno.podcast_pode('supervisao') then
    n := n + (select count(*) from podcast_episodios where status = 'revisao' and (enviado_por is distinct from v or interno.coord()));
  end if;
  if interno.podcaster() then
    n := n + (select count(*) from podcast_perguntas where status = 'nova') + (select count(*) from podcast_pautas where status = 'sugerida')
           + (select count(*) from podcast_comentarios k join podcast_episodios e on e.id = k.episodio
              where not k.resolvido and k.autor is distinct from v and v in (e.responsavel, e.criado_por, e.enviado_por));
  end if;
  if interno.tem('design') then n := n + (select count(*) from podcast_pedidos where status = 'aberto'); end if;
  return n;
end $$;

/** Um episódio inteiro, para a mesa de trabalho: com versões, comentários, histórico, convidados e o que falta. */
create or replace function public.podcast_ver(p_id uuid) returns jsonb language plpgsql stable security definer set search_path = interno, pg_temp as $$
declare e podcast_episodios; v_contato boolean := interno.podcast_pode('producao') or interno.podcast_pode('supervisao');
begin
  perform interno.eu();
  if not (interno.podcast_revisor() or interno.tem('design')) then perform interno.erro('sem_permissao'); end if;
  select * into e from podcast_episodios where id = p_id;
  if not found then perform interno.erro('nao_encontrado'); end if;
  return (to_jsonb(e) - 'token_revisao' - 'token_validade') || jsonb_build_object(
    'token_revisao', case when interno.podcaster() and e.token_validade > now() then e.token_revisao end,
    'token_validade', case when interno.podcaster() then e.token_validade end,
    'pendencias', to_jsonb(interno.podcast_pendencias(e)),
    'responsavel_nome', (select nome from perfis where id = e.responsavel),
    'enviado_por_nome', (select nome from perfis where id = e.enviado_por),
    'aprovado_por_nome', (select nome from perfis where id = e.aprovado_por),
    'arquivos', coalesce((select jsonb_agg(to_jsonb(a) || jsonb_build_object('enviado_por_nome', (select nome from perfis where id = a.enviado_por)) order by a.criado_em desc)
                          from podcast_arquivos a where a.episodio = e.id), '[]'::jsonb),
    'comentarios', coalesce((select jsonb_agg(jsonb_build_object('id', k.id, 'texto', k.texto, 'tempo', k.tempo, 'arquivo', k.arquivo, 'resolvido', k.resolvido,
                                                                  'criado_em', k.criado_em, 'autor', coalesce(f.nome, ''), 'meu', k.autor = auth.uid()) order by k.criado_em)
                             from podcast_comentarios k left join perfis f on f.id = k.autor where k.episodio = e.id), '[]'::jsonb),
    'historico', coalesce((select jsonb_agg(jsonb_build_object('acao', h.acao, 'nota', h.nota, 'nome', h.nome, 'criado_em', h.criado_em) order by h.id desc)
                           from (select * from podcast_historico where episodio = e.id order by id desc limit 60) h), '[]'::jsonb),
    'convidados_dados', coalesce((select jsonb_agg(jsonb_build_object('id', c.id, 'nome', c.nome, 'minibio', c.minibio, 'autoriza_voz', c.autoriza_voz,
                                                                       'autoriza_imagem', c.autoriza_imagem, 'contato', case when v_contato then c.contato else '' end)
                                                    order by array_position(e.convidados, c.id))
                                  from podcast_convidados c where c.id = any(e.convidados)), '[]'::jsonb),
    'trilhas_dados', coalesce((select jsonb_agg(jsonb_build_object('id', t.id, 'titulo', t.titulo, 'autor', t.autor, 'licenca', t.licenca, 'fonte', t.fonte))
                               from podcast_trilhas t where t.id = any(e.trilhas)), '[]'::jsonb),
    'pedidos', coalesce((select jsonb_agg(jsonb_build_object('id', p.id, 'texto', p.texto, 'status', p.status, 'criado_em', p.criado_em,
                                                             'pedido_por', (select nome from perfis where id = p.pedido_por)) order by p.criado_em desc)
                         from podcast_pedidos p where p.episodio = e.id), '[]'::jsonb),
    'perguntas', coalesce((select jsonb_agg(jsonb_build_object('id', q.id, 'texto', q.texto, 'assinatura', q.assinatura, 'audio', q.audio, 'status', q.status))
                           from podcast_perguntas q where q.episodio = e.id), '[]'::jsonb),
    'plays', (select coalesce(sum(total), 0) from podcast_audicoes where episodio = e.id));
end $$;

/**
 * Cria (p_id nulo) ou altera um episódio. Só mexe nos campos que vierem. Quem só tem a edição altera notas, transcrição,
 * legendas, capítulos, conferência técnica, trilhas e a cópia de fora. Com p_versao, recusa se alguém salvou no meio.
 */
create or replace function public.podcast_salvar(p_id uuid, p jsonb, p_versao integer default null) returns jsonb
language plpgsql security definer set search_path = interno, pg_temp as $$
declare
  v uuid := interno.eu(); e podcast_episodios;
  v_prod boolean := interno.podcast_pode('producao') or interno.podcast_pode('supervisao');
  v_ed boolean := interno.podcast_pode('edicao');
  v_edicao text[] := array['notas', 'transcricao', 'legendas', 'capitulos', 'checklist', 'audio_externo', 'trilhas'];
  k text; v_temas text[];
begin
  p := coalesce(p, '{}'::jsonb);
  if jsonb_typeof(p) <> 'object' then perform interno.erro('invalido:dados'); end if;
  if p_id is null then
    if not v_prod then perform interno.erro('sem_permissao'); end if;
    perform interno.limite('podcast_criar', 30, 60);
    insert into podcast_episodios (titulo, criado_por, responsavel) values (interno.txt(p ->> 'titulo', 'titulo', 3, 140), v, v) returning * into e;
    perform interno.podcast_anotar(e.id, 'criou');
  else
    select * into e from podcast_episodios where id = p_id for update;
    if not found then perform interno.erro('nao_encontrado'); end if;
    if not (v_prod or v_ed) then perform interno.erro('sem_permissao'); end if;
    if p_versao is not null and p_versao <> e.versao then perform interno.erro('mudou_enquanto_editava'); end if;
    if not v_prod then
      for k in select jsonb_object_keys(p) loop
        if not (k = any(v_edicao)) then perform interno.erro('sem_permissao'); end if;
      end loop;
    end if;
  end if;

  if p ? 'titulo' then e.titulo := interno.txt(p ->> 'titulo', 'titulo', 3, 140); end if;
  if p ? 'resumo' then e.resumo := interno.txt(p ->> 'resumo', 'resumo', 0, 400); end if;
  if p ? 'tema' then e.tema := interno.txt(p ->> 'tema', 'tema', 0, 300); end if;
  if p ? 'pauta' then e.pauta := interno.txt(p ->> 'pauta', 'pauta', 0, 6000); end if;
  if p ? 'roteiro' then e.roteiro := interno.txt(p ->> 'roteiro', 'roteiro', 0, 60000); end if;
  if p ? 'notas' then e.notas := interno.txt(p ->> 'notas', 'notas', 0, 20000); end if;
  if p ? 'fontes' then e.fontes := interno.fontes_ok(p -> 'fontes', false); end if;
  if p ? 'obras' then e.obras := interno.podcast_obras(p -> 'obras'); end if;
  if p ? 'duracao_prevista' then e.duracao_prevista := coalesce(interno.podcast_int(p -> 'duracao_prevista', 'duracao_prevista', 0, 600), 0); end if;
  if p ? 'convidados' then
    e.convidados := interno.podcast_uuids(p -> 'convidados', 'convidados', 12);
    if exists (select 1 from unnest(e.convidados) x where not exists (select 1 from podcast_convidados c where c.id = x)) then perform interno.erro('invalido:convidados'); end if;
  end if;
  if p ? 'trilhas' then
    e.trilhas := interno.podcast_uuids(p -> 'trilhas', 'trilhas', 30);
    if exists (select 1 from unnest(e.trilhas) x where not exists (select 1 from podcast_trilhas t where t.id = x)) then perform interno.erro('invalido:trilhas'); end if;
  end if;
  if p ? 'serie' then
    e.serie := (interno.podcast_uuids(case when coalesce(p ->> 'serie', '') = '' then '[]'::jsonb else jsonb_build_array(p ->> 'serie') end, 'serie', 1))[1];
    if e.serie is not null and not exists (select 1 from podcast_series where id = e.serie) then perform interno.erro('invalido:serie'); end if;
  end if;
  if p ? 'temporada' then e.temporada := interno.podcast_int(p -> 'temporada', 'temporada', 1, 99); end if;
  if p ? 'numero' then e.numero := interno.podcast_int(p -> 'numero', 'numero', 0, 9999); end if;
  if p ? 'temas' then
    if jsonb_typeof(p -> 'temas') <> 'array' or jsonb_array_length(p -> 'temas') > 5 then perform interno.erro('invalido:temas'); end if;
    v_temas := array(select distinct x from jsonb_array_elements_text(p -> 'temas') x);
    if not (v_temas <@ interno.podcast_temas()) then perform interno.erro('invalido:temas'); end if;
    e.temas := v_temas;
  end if;
  if p ? 'disciplina' then e.disciplina := interno.disciplina_ok(p ->> 'disciplina'); end if;
  if p ? 'trilha' then
    e.trilha := nullif(btrim(coalesce(p ->> 'trilha', '')), '');
    if e.trilha is not null and e.trilha !~ '^[a-z0-9-]{2,80}$' then perform interno.erro('invalido:trilha'); end if;
  end if;
  if p ? 'responsavel' then
    e.responsavel := (interno.podcast_uuids(case when coalesce(p ->> 'responsavel', '') = '' then '[]'::jsonb else jsonb_build_array(p ->> 'responsavel') end, 'responsavel', 1))[1];
    if e.responsavel is not null and not exists (select 1 from perfis where id = e.responsavel and not suspenso) then perform interno.erro('invalido:responsavel'); end if;
  end if;
  if p ? 'gravacao_em' then e.gravacao_em := interno.podcast_data(p ->> 'gravacao_em', 'gravacao_em'); end if;
  if p ? 'publicar_em' then e.publicar_em := interno.podcast_data(p ->> 'publicar_em', 'publicar_em'); end if;
  if p ? 'sala' then e.sala := interno.podcast_link(p ->> 'sala', 'sala', 300); end if;
  if p ? 'explicito' then e.explicito := coalesce(p ->> 'explicito', '') = 'true'; end if;
  if p ? 'audio_externo' then e.audio_externo := interno.podcast_link(p ->> 'audio_externo', 'audio_externo', 500); end if;
  if p ? 'transcricao' then e.transcricao := interno.txt(p ->> 'transcricao', 'transcricao', 0, 300000); end if;
  if p ? 'legendas' then
    e.legendas := interno.txt(p ->> 'legendas', 'legendas', 0, 400000);
    if e.legendas <> '' and e.legendas !~ '^WEBVTT' then perform interno.erro('invalido:legendas'); end if;
  end if;
  if p ? 'capitulos' then e.capitulos := interno.podcast_capitulos(p -> 'capitulos'); end if;
  if p ? 'checklist' then e.checklist := interno.podcast_checklist(p -> 'checklist'); end if;

  update podcast_episodios set
    titulo = e.titulo, resumo = e.resumo, tema = e.tema, pauta = e.pauta, roteiro = e.roteiro, notas = e.notas, fontes = e.fontes, obras = e.obras,
    duracao_prevista = e.duracao_prevista, convidados = e.convidados, trilhas = e.trilhas, serie = e.serie, temporada = e.temporada, numero = e.numero,
    temas = e.temas, disciplina = e.disciplina, trilha = e.trilha, responsavel = e.responsavel, gravacao_em = e.gravacao_em, publicar_em = e.publicar_em,
    sala = e.sala, explicito = e.explicito, audio_externo = e.audio_externo, transcricao = e.transcricao, legendas = e.legendas,
    capitulos = e.capitulos, checklist = e.checklist, versao = versao + 1, atualizado_em = now()
  where id = e.id returning * into e;
  return jsonb_build_object('id', e.id, 'versao', e.versao, 'pendencias', to_jsonb(interno.podcast_pendencias(e)));
end $$;

/** Muda a etapa (ideia → roteiro → gravação → edição → revisão). "Revisão" é o envio para a supervisão aprovar. */
create or replace function public.podcast_etapa(p_id uuid, p_status text, p_nota text default '') returns jsonb
language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); e podcast_episodios; r record;
begin
  if not (interno.podcast_pode('producao') or interno.podcast_pode('edicao') or interno.podcast_pode('supervisao')) then perform interno.erro('sem_permissao'); end if;
  if coalesce(p_status, '') not in ('ideia', 'roteiro', 'gravacao', 'edicao', 'revisao') then perform interno.erro('invalido:status'); end if;
  select * into e from podcast_episodios where id = p_id for update;
  if not found then perform interno.erro('nao_encontrado'); end if;
  if e.status = 'publicado' then perform interno.erro('ja_publicado'); end if;
  if e.status = p_status then return interno.podcast_resumo_json(e); end if;
  if p_status = 'revisao' then
    update podcast_episodios set status = 'revisao', enviado_por = v, enviado_em = now(), aprovado_por = null, aprovado_em = null, atualizado_em = now(), versao = versao + 1
    where id = p_id returning * into e;
    for r in select distinct usuario from (
               select usuario from podcast_funcoes where funcao = 'supervisao'
               union select usuario from papeis where papel in ('coordenacao', 'vice')) x where usuario <> v loop
      perform interno.avisar(r.usuario, format('Podcast: o episódio "%s" foi enviado para aprovação.', e.titulo));
    end loop;
  else
    update podcast_episodios set status = p_status, aprovado_por = null, aprovado_em = null, atualizado_em = now(), versao = versao + 1
    where id = p_id returning * into e;
  end if;
  perform interno.podcast_anotar(e.id, 'etapa:' || p_status, interno.txt(p_nota, 'nota', 0, 2000));
  return interno.podcast_resumo_json(e);
end $$;

/** A supervisão aprova ou devolve para a edição com o pedido de ajuste. Ninguém aprova o que ele mesmo enviou. */
create or replace function public.podcast_aprovar(p_id uuid, p_aprovar boolean, p_nota text default '') returns jsonb
language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); e podcast_episodios; v_nota text := interno.txt(p_nota, 'nota', 0, 2000);
begin
  if not interno.podcast_pode('supervisao') then perform interno.erro('sem_permissao'); end if;
  select * into e from podcast_episodios where id = p_id for update;
  if not found then perform interno.erro('nao_encontrado'); end if;
  if e.status <> 'revisao' then perform interno.erro('fora_de_revisao'); end if;
  if coalesce(p_aprovar, false) then
    if e.enviado_por = v and not interno.coord() then perform interno.erro('aprovar_o_proprio'); end if;
    update podcast_episodios set status = 'aprovado', aprovado_por = v, aprovado_em = now(), nota_supervisao = v_nota, atualizado_em = now(), versao = versao + 1
    where id = p_id returning * into e;
    perform interno.podcast_anotar(e.id, 'aprovou', v_nota);
    perform interno.avisar(e.enviado_por, format('Podcast: o episódio "%s" foi aprovado. Confira a lista antes de publicar.', e.titulo));
  else
    if char_length(v_nota) < 3 then perform interno.erro('invalido:nota'); end if;
    update podcast_episodios set status = 'edicao', nota_supervisao = v_nota, atualizado_em = now(), versao = versao + 1 where id = p_id returning * into e;
    insert into podcast_comentarios (episodio, autor, texto) values (e.id, v, 'Pedido de ajuste da supervisão: ' || v_nota);
    perform interno.podcast_anotar(e.id, 'pediu_ajuste', v_nota);
    perform interno.avisar(e.enviado_por, format('Podcast: a supervisão pediu ajustes no episódio "%s".', e.titulo));
  end if;
  return interno.podcast_resumo_json(e);
end $$;

/**
 * Publica um episódio aprovado, se a lista de conferência estiver completa. Abre a conversa do episódio na Comunidade
 * (com a mesma moderação de lá) e faz o rodízio do depósito. Devolve o que pode sair dos depósitos.
 */
create or replace function public.podcast_publicar(p_id uuid) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); e podcast_episodios; v_slug text; v_topico uuid;
begin
  if not (interno.podcast_pode('producao') or interno.podcast_pode('supervisao')) then perform interno.erro('sem_permissao'); end if;
  select * into e from podcast_episodios where id = p_id for update;
  if not found then perform interno.erro('nao_encontrado'); end if;
  if e.status = 'publicado' then perform interno.erro('ja_publicado'); end if;
  if cardinality(interno.podcast_pendencias(e)) > 0 then perform interno.erro('lista_incompleta'); end if;
  v_slug := coalesce(e.slug, interno.podcast_slug(e.titulo, e.id));
  v_topico := e.topico;
  if v_topico is null or not exists (select 1 from topicos where id = v_topico) then
    insert into topicos (autor, titulo, corpo, disciplina, tipo, avaliacao)
    values (v, left('Podcast: ' || e.titulo, 140),
            left(e.resumo || E'\n\nOuça o episódio: ' || interno.endereco() || '/pt/podcasts/' || v_slug || E'\n\nComente aqui o que achou, o que ficou de dúvida e o que quer ouvir nos próximos.', 8000),
            e.disciplina, 'conversa', 'publicada')
    returning id into v_topico;
  end if;
  update podcast_episodios set status = 'publicado', slug = v_slug, publicado_por = v, publicado_em = coalesce(publicado_em, now()), topico = v_topico,
         atualizado_em = now(), versao = versao + 1
  where id = p_id returning * into e;
  update podcast_pautas set status = 'gravada', decidido_em = now() where episodio = e.id and status in ('escolhida', 'votacao');
  update podcast_perguntas set status = 'respondida' where episodio = e.id and status = 'escolhida';
  -- Versões finais antigas (que não são o áudio no ar) já podem sair do depósito público.
  insert into podcast_liberar (deposito, caminho, motivo)
  select 'podcast', a.caminho, 'versao_antiga' from podcast_arquivos a where a.episodio = e.id and a.deposito = 'podcast' and a.guardado and a.caminho <> e.audio
  on conflict do nothing;
  perform interno.podcast_rodizio();
  perform interno.podcast_anotar(e.id, 'publicou');
  perform interno.registrar('podcast_publicado', v_slug);
  return jsonb_build_object('slug', v_slug, 'topico', v_topico,
    'liberar', coalesce((select jsonb_agg(jsonb_build_object('deposito', deposito, 'caminho', caminho)) from podcast_liberar), '[]'::jsonb));
end $$;

/** Tira do ar (volta a "aprovado"). A data de publicação fica: se voltar, volta no mesmo lugar da lista. */
create or replace function public.podcast_despublicar(p_id uuid, p_nota text) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare e podcast_episodios; v_nota text := interno.txt(p_nota, 'nota', 3, 2000);
begin
  perform interno.eu();
  if not interno.podcast_pode('supervisao') then perform interno.erro('sem_permissao'); end if;
  update podcast_episodios set status = 'aprovado', atualizado_em = now(), versao = versao + 1 where id = p_id and status = 'publicado' returning * into e;
  if not found then perform interno.erro('nao_encontrado'); end if;
  perform interno.podcast_anotar(e.id, 'despublicou', v_nota);
  perform interno.registrar('podcast_despublicado', coalesce(e.slug, ''), jsonb_build_object('nota', v_nota));
  return interno.podcast_resumo_json(e);
end $$;

/** Apaga um episódio que nunca foi ao ar (a coordenação apaga qualquer um). Os arquivos vão para a lista de liberar. */
create or replace function public.podcast_apagar(p_id uuid) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare e podcast_episodios;
begin
  perform interno.eu();
  select * into e from podcast_episodios where id = p_id for update;
  if not found then perform interno.erro('nao_encontrado'); end if;
  if not (interno.coord() or ((interno.podcast_pode('producao') or interno.podcast_pode('supervisao')) and e.publicado_em is null)) then perform interno.erro('sem_permissao'); end if;
  insert into podcast_liberar (deposito, caminho, motivo)
  select a.deposito, a.caminho, 'episodio_apagado' from podcast_arquivos a where a.episodio = e.id and a.guardado and a.caminho <> '' and a.deposito <> ''
  union select 'podcast', x, 'episodio_apagado' from unnest(array[e.capa, e.capa_mini]) x
        where x <> '' and not exists (select 1 from podcast_episodios o where o.id <> e.id and x in (o.capa, o.capa_mini))
  on conflict do nothing;
  delete from podcast_episodios where id = e.id;
  perform interno.registrar('podcast_apagado', e.titulo);
  return jsonb_build_object('liberar', coalesce((select jsonb_agg(jsonb_build_object('deposito', deposito, 'caminho', caminho)) from podcast_liberar), '[]'::jsonb));
end $$;

/** Link privado de revisão (vale 30 dias). p_renovar troca o link: o antigo deixa de abrir. */
create or replace function public.podcast_revisao_link(p_id uuid, p_renovar boolean default false) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare e podcast_episodios;
begin
  perform interno.eu();
  if not interno.podcaster() then perform interno.erro('sem_permissao'); end if;
  select * into e from podcast_episodios where id = p_id for update;
  if not found then perform interno.erro('nao_encontrado'); end if;
  if coalesce(p_renovar, false) or e.token_revisao is null or e.token_validade < now() then
    update podcast_episodios set token_revisao = interno.podcast_token(), token_validade = now() + interval '30 days' where id = p_id returning * into e;
  end if;
  return jsonb_build_object('token', e.token_revisao, 'validade', e.token_validade);
end $$;

-- ── Arquivos ──

/**
 * Anota uma versão: o painel envia o arquivo para o depósito e depois chama esta função. Áudio final vai para o depósito
 * público (é o que toca no site); bruto, editado, vídeo e faixas de convidado, para o fechado. Também aceita só um link
 * (cópia de segurança no Internet Archive, Drive…), para arquivo grande demais para o depósito.
 */
create or replace function public.podcast_arquivo_registrar(p_episodio uuid, p jsonb) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare
  v uuid := interno.eu(); v_tipo text := coalesce(p ->> 'tipo', ''); v_deposito text := coalesce(p ->> 'deposito', ''); v_caminho text := btrim(coalesce(p ->> 'caminho', ''));
  v_id uuid;
begin
  if not (interno.podcast_pode('producao') or interno.podcast_pode('edicao') or interno.podcast_pode('supervisao')) then perform interno.erro('sem_permissao'); end if;
  if not exists (select 1 from podcast_episodios where id = p_episodio) then perform interno.erro('nao_encontrado'); end if;
  if v_tipo not in ('bruto', 'editado', 'final', 'video', 'convidado', 'outro') then perform interno.erro('invalido:tipo'); end if;
  if v_caminho <> '' then
    if v_deposito not in ('podcast', 'podcast-producao') or (v_deposito = 'podcast') <> (v_tipo = 'final') then perform interno.erro('invalido:deposito'); end if;
    if v_caminho not like 'ep/' || p_episodio::text || '/%' then perform interno.erro('invalido:caminho'); end if;
  else
    v_deposito := '';
  end if;
  insert into podcast_arquivos (episodio, tipo, deposito, caminho, link, nome, bytes, mime, nota, guardado, enviado_por)
  values (p_episodio, v_tipo, v_deposito, v_caminho, interno.podcast_link(p ->> 'link', 'link', 500), interno.txt(p ->> 'nome', 'nome', 1, 200),
          greatest(coalesce(interno.podcast_int(p -> 'bytes', 'bytes', 0, 2000000000), 0), 0), interno.txt(p ->> 'mime', 'mime', 0, 80),
          interno.txt(p ->> 'nota', 'nota', 0, 500), v_caminho <> '', v)
  returning id into v_id;
  perform interno.podcast_anotar(p_episodio, 'arquivo:' || v_tipo, p ->> 'nome');
  update podcast_episodios set atualizado_em = now() where id = p_episodio;
  return jsonb_build_object('id', v_id);
end $$;

/** Escolhe a versão final que vai ao ar, com a duração e a forma da onda calculadas no navegador. */
create or replace function public.podcast_audio_definir(p_episodio uuid, p_arquivo uuid, p_duracao integer, p_picos jsonb) returns jsonb
language plpgsql security definer set search_path = interno, pg_temp as $$
declare e podcast_episodios; a podcast_arquivos;
begin
  perform interno.eu();
  if not (interno.podcast_pode('producao') or interno.podcast_pode('edicao') or interno.podcast_pode('supervisao')) then perform interno.erro('sem_permissao'); end if;
  select * into e from podcast_episodios where id = p_episodio for update;
  if not found then perform interno.erro('nao_encontrado'); end if;
  select * into a from podcast_arquivos where id = p_arquivo and episodio = p_episodio;
  if not found or a.tipo <> 'final' or a.deposito <> 'podcast' or not a.guardado then perform interno.erro('invalido:arquivo'); end if;
  if a.mime not in ('audio/mpeg', 'audio/mp4', 'audio/ogg', 'audio/opus') then perform interno.erro('invalido:formato'); end if;
  if coalesce(p_duracao, 0) not between 1 and 36000 then perform interno.erro('invalido:duracao'); end if;
  if e.status = 'publicado' and e.audio <> '' and e.audio <> a.caminho and e.audio_guardado then
    insert into podcast_liberar (deposito, caminho, motivo) values ('podcast', e.audio, 'versao_antiga') on conflict do nothing;
  end if;
  update podcast_episodios set audio = a.caminho, audio_bytes = a.bytes, audio_tipo = a.mime, duracao = p_duracao, picos = interno.podcast_picos(p_picos),
         audio_guardado = true, atualizado_em = now(), versao = versao + 1
  where id = p_episodio returning * into e;
  perform interno.podcast_anotar(e.id, 'audio_definido', a.nome);
  return interno.podcast_resumo_json(e);
end $$;

/** Tira uma versão do depósito (o registro fica no histórico). O áudio que está no ar não sai por aqui. */
create or replace function public.podcast_arquivo_remover(p_id uuid) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare a podcast_arquivos; e podcast_episodios;
begin
  perform interno.eu();
  if not (interno.podcast_pode('producao') or interno.podcast_pode('edicao') or interno.podcast_pode('supervisao')) then perform interno.erro('sem_permissao'); end if;
  select * into a from podcast_arquivos where id = p_id for update;
  if not found then perform interno.erro('nao_encontrado'); end if;
  select * into e from podcast_episodios where id = a.episodio for update;
  if a.caminho <> '' and a.caminho = e.audio and e.audio_guardado then
    if e.status = 'publicado' then perform interno.erro('em_uso'); end if;
    update podcast_episodios set audio = '', audio_bytes = 0, audio_tipo = '', duracao = 0, picos = '[]'::jsonb, audio_guardado = false where id = e.id;
  end if;
  if a.guardado and a.caminho <> '' then
    insert into podcast_liberar (deposito, caminho, motivo) values (a.deposito, a.caminho, 'removido') on conflict do nothing;
  end if;
  update podcast_arquivos set guardado = false where id = a.id;
  perform interno.podcast_anotar(a.episodio, 'arquivo_removido', a.nome);
  return jsonb_build_object('liberar', coalesce((select jsonb_agg(jsonb_build_object('deposito', deposito, 'caminho', caminho)) from podcast_liberar), '[]'::jsonb));
end $$;

/** O que pode sair dos depósitos agora (e a faxina, que roda antes de responder). */
create or replace function public.podcast_liberar_pendentes() returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
begin
  perform interno.eu();
  if not interno.podcaster() then perform interno.erro('sem_permissao'); end if;
  perform interno.podcast_limpeza();
  return coalesce((select jsonb_agg(jsonb_build_object('deposito', deposito, 'caminho', caminho, 'motivo', motivo)) from podcast_liberar), '[]'::jsonb);
end $$;

/** O painel confirma o que apagou de fato dos depósitos. */
create or replace function public.podcast_liberados(p_itens jsonb) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare i jsonb; n integer := 0;
begin
  perform interno.eu();
  if not interno.podcaster() then perform interno.erro('sem_permissao'); end if;
  if jsonb_typeof(coalesce(p_itens, '[]'::jsonb)) <> 'array' or jsonb_array_length(p_itens) > 500 then perform interno.erro('invalido:itens'); end if;
  for i in select * from jsonb_array_elements(p_itens) loop
    delete from podcast_liberar where deposito = i ->> 'deposito' and caminho = i ->> 'caminho';
    if found then
      n := n + 1;
      update podcast_arquivos set guardado = false where deposito = i ->> 'deposito' and caminho = i ->> 'caminho';
    end if;
  end loop;
  return jsonb_build_object('liberados', n);
end $$;

/** Capa do episódio (3000×3000 e a miniatura). O design também pode pôr a capa que fez. */
create or replace function public.podcast_capa_definir(p_episodio uuid, p_capa text, p_capa_mini text) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare e podcast_episodios; v_padrao text := '^capas/[a-z0-9/_-]{8,120}[.](jpg|png|webp)$';
begin
  perform interno.eu();
  if not (interno.podcast_pode('producao') or interno.podcast_pode('edicao') or interno.podcast_pode('supervisao') or interno.tem('design')) then perform interno.erro('sem_permissao'); end if;
  if coalesce(p_capa, '') !~ v_padrao or coalesce(p_capa_mini, '') !~ v_padrao then perform interno.erro('invalido:capa'); end if;
  select * into e from podcast_episodios where id = p_episodio for update;
  if not found then perform interno.erro('nao_encontrado'); end if;
  insert into podcast_liberar (deposito, caminho, motivo)
  select 'podcast', x, 'capa_trocada' from unnest(array[e.capa, e.capa_mini]) x where x <> '' and x not in (p_capa, p_capa_mini)
  on conflict do nothing;
  update podcast_episodios set capa = p_capa, capa_mini = p_capa_mini, atualizado_em = now(), versao = versao + 1 where id = e.id returning * into e;
  perform interno.podcast_anotar(e.id, 'capa_definida');
  return interno.podcast_resumo_json(e);
end $$;

-- ── Comentários com tempo ──

create or replace function public.podcast_comentar(p_episodio uuid, p_texto text, p_tempo integer default null, p_arquivo uuid default null) returns jsonb
language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); e podcast_episodios; v_id uuid; r uuid;
begin
  if not interno.podcast_revisor() then perform interno.erro('sem_permissao'); end if;
  perform interno.limite('podcast_comentar', 120, 60);
  select * into e from podcast_episodios where id = p_episodio;
  if not found then perform interno.erro('nao_encontrado'); end if;
  if p_tempo is not null and p_tempo not between 0 and 36000 then perform interno.erro('invalido:tempo'); end if;
  insert into podcast_comentarios (episodio, autor, texto, tempo, arquivo)
  values (e.id, v, interno.txt(p_texto, 'texto', 1, 2000), p_tempo, (select id from podcast_arquivos where id = p_arquivo and episodio = e.id))
  returning id into v_id;
  for r in select distinct x from unnest(array[e.responsavel, e.criado_por, e.enviado_por]) x where x is not null and x <> v loop
    perform interno.avisar(r, format('Podcast: novo comentário no episódio "%s".', e.titulo));
  end loop;
  return jsonb_build_object('id', v_id);
end $$;

create or replace function public.podcast_comentario_resolver(p_id uuid, p_resolvido boolean) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
begin
  perform interno.eu();
  if not interno.podcast_revisor() then perform interno.erro('sem_permissao'); end if;
  update podcast_comentarios set resolvido = coalesce(p_resolvido, true) where id = p_id;
  if not found then perform interno.erro('nao_encontrado'); end if;
  return jsonb_build_object('ok', true);
end $$;

-- ── Convidados ──

create or replace function public.podcast_convidados_listar() returns jsonb language plpgsql stable security definer set search_path = interno, pg_temp as $$
declare v_contato boolean := interno.podcast_pode('producao') or interno.podcast_pode('supervisao');
begin
  perform interno.eu();
  if not interno.podcaster() then perform interno.erro('sem_permissao'); end if;
  return coalesce((select jsonb_agg(jsonb_build_object(
      'id', c.id, 'nome', c.nome, 'minibio', c.minibio, 'contato', case when v_contato then c.contato else '' end,
      'autoriza_voz', c.autoriza_voz, 'autoriza_imagem', c.autoriza_imagem, 'termo', case when v_contato then c.termo else '' end,
      'aceite_nome', c.aceite_nome, 'aceite_em', c.aceite_em,
      'link', case when v_contato and c.token_validade > now() then c.token end, 'link_validade', c.token_validade,
      'episodios', (select coalesce(jsonb_agg(jsonb_build_object('id', e.id, 'titulo', e.titulo, 'status', e.status)), '[]'::jsonb) from podcast_episodios e where c.id = any(e.convidados)))
    order by c.nome) from podcast_convidados c), '[]'::jsonb);
end $$;

/** Ficha do convidado. A autorização marcada à mão só vale com o termo assinado anexado; sem ele, só pelo aceite no link. */
create or replace function public.podcast_convidado_salvar(p_id uuid, p jsonb) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); c podcast_convidados; v_termo text := btrim(coalesce(p ->> 'termo', ''));
begin
  if not (interno.podcast_pode('producao') or interno.podcast_pode('supervisao')) then perform interno.erro('sem_permissao'); end if;
  if v_termo <> '' and v_termo !~ '^termos/[a-z0-9/_-]{8,120}[.](pdf|jpg|png|webp)$' then perform interno.erro('invalido:termo'); end if;
  if p_id is null then
    insert into podcast_convidados (nome, criado_por) values (interno.txt(p ->> 'nome', 'nome', 2, 120), v) returning * into c;
  else
    select * into c from podcast_convidados where id = p_id for update;
    if not found then perform interno.erro('nao_encontrado'); end if;
  end if;
  if p ? 'termo' and c.termo <> '' and c.termo <> v_termo then
    insert into podcast_liberar (deposito, caminho, motivo) values ('podcast-producao', c.termo, 'termo_trocado') on conflict do nothing;
  end if;
  update podcast_convidados set
    nome = case when p ? 'nome' then interno.txt(p ->> 'nome', 'nome', 2, 120) else nome end,
    contato = case when p ? 'contato' then interno.txt(p ->> 'contato', 'contato', 0, 300) else contato end,
    minibio = case when p ? 'minibio' then interno.txt(p ->> 'minibio', 'minibio', 0, 600) else minibio end,
    termo = case when p ? 'termo' then v_termo else termo end
  where id = c.id returning * into c;
  if p ? 'autoriza_voz' or p ? 'autoriza_imagem' then
    if (coalesce(p ->> 'autoriza_voz', '') = 'true' or coalesce(p ->> 'autoriza_imagem', '') = 'true') and c.termo = '' and c.aceite_em is null then
      perform interno.erro('falta_termo_convidado');
    end if;
    update podcast_convidados set
      autoriza_voz = case when p ? 'autoriza_voz' then coalesce(p ->> 'autoriza_voz', '') = 'true' else autoriza_voz end,
      autoriza_imagem = case when p ? 'autoriza_imagem' then coalesce(p ->> 'autoriza_imagem', '') = 'true' else autoriza_imagem end
    where id = c.id returning * into c;
  end if;
  return jsonb_build_object('id', c.id);
end $$;

create or replace function public.podcast_convidado_remover(p_id uuid) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare c podcast_convidados;
begin
  perform interno.eu();
  if not (interno.podcast_pode('producao') or interno.podcast_pode('supervisao')) then perform interno.erro('sem_permissao'); end if;
  select * into c from podcast_convidados where id = p_id for update;
  if not found then perform interno.erro('nao_encontrado'); end if;
  if exists (select 1 from podcast_episodios where p_id = any(convidados) and publicado_em is not null) then perform interno.erro('em_uso'); end if;
  update podcast_episodios set convidados = array_remove(convidados, p_id) where p_id = any(convidados);
  if c.termo <> '' then insert into podcast_liberar (deposito, caminho, motivo) values ('podcast-producao', c.termo, 'convidado_removido') on conflict do nothing; end if;
  delete from podcast_convidados where id = p_id;
  return jsonb_build_object('liberar', coalesce((select jsonb_agg(jsonb_build_object('deposito', deposito, 'caminho', caminho)) from podcast_liberar), '[]'::jsonb));
end $$;

/** Link pessoal do convidado (30 dias): termo de cessão e teste de microfone, sem precisar de conta. */
create or replace function public.podcast_convidado_link(p_id uuid) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare c podcast_convidados;
begin
  perform interno.eu();
  if not (interno.podcast_pode('producao') or interno.podcast_pode('supervisao')) then perform interno.erro('sem_permissao'); end if;
  update podcast_convidados set token = interno.podcast_token(), token_validade = now() + interval '30 days' where id = p_id returning * into c;
  if not found then perform interno.erro('nao_encontrado'); end if;
  return jsonb_build_object('token', c.token, 'validade', c.token_validade);
end $$;

-- ── Biblioteca de áudios (vinhetas, trilhas e efeitos com licença registrada) ──

create or replace function public.podcast_trilhas_listar() returns jsonb language plpgsql stable security definer set search_path = interno, pg_temp as $$
begin
  perform interno.eu();
  if not interno.podcaster() then perform interno.erro('sem_permissao'); end if;
  return coalesce((select jsonb_agg(to_jsonb(t) || jsonb_build_object('usos', (select count(*) from podcast_episodios e where t.id = any(e.trilhas))) order by t.tipo, t.titulo)
                   from podcast_trilhas t), '[]'::jsonb);
end $$;

create or replace function public.podcast_trilha_salvar(p_id uuid, p jsonb) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); v_caminho text := btrim(coalesce(p ->> 'caminho', '')); v_id uuid; v_antigo text;
begin
  if not (interno.podcast_pode('producao') or interno.podcast_pode('edicao') or interno.podcast_pode('supervisao')) then perform interno.erro('sem_permissao'); end if;
  if v_caminho <> '' and v_caminho !~ '^trilhas/[a-z0-9/_-]{8,120}[.](mp3|m4a|ogg|opus|wav|flac)$' then perform interno.erro('invalido:caminho'); end if;
  if coalesce(p ->> 'tipo', 'trilha') not in ('vinheta', 'trilha', 'efeito') then perform interno.erro('invalido:tipo'); end if;
  if p_id is null then
    insert into podcast_trilhas (titulo, autor, tipo, licenca, fonte, caminho, duracao, nota, criado_por)
    values (interno.txt(p ->> 'titulo', 'titulo', 1, 160), interno.txt(p ->> 'autor', 'autor', 0, 120), coalesce(p ->> 'tipo', 'trilha'),
            interno.txt(p ->> 'licenca', 'licenca', 2, 120), interno.podcast_link(p ->> 'fonte', 'fonte', 300), v_caminho,
            coalesce(interno.podcast_int(p -> 'duracao', 'duracao', 0, 7200), 0), interno.txt(p ->> 'nota', 'nota', 0, 500), v)
    returning id into v_id;
  else
    select caminho into v_antigo from podcast_trilhas where id = p_id for update;
    if not found then perform interno.erro('nao_encontrado'); end if;
    if v_antigo <> '' and v_antigo <> v_caminho then
      insert into podcast_liberar (deposito, caminho, motivo) values ('podcast-producao', v_antigo, 'trilha_trocada') on conflict do nothing;
    end if;
    update podcast_trilhas set titulo = interno.txt(p ->> 'titulo', 'titulo', 1, 160), autor = interno.txt(p ->> 'autor', 'autor', 0, 120), tipo = coalesce(p ->> 'tipo', 'trilha'),
           licenca = interno.txt(p ->> 'licenca', 'licenca', 2, 120), fonte = interno.podcast_link(p ->> 'fonte', 'fonte', 300), caminho = v_caminho,
           duracao = coalesce(interno.podcast_int(p -> 'duracao', 'duracao', 0, 7200), 0), nota = interno.txt(p ->> 'nota', 'nota', 0, 500)
    where id = p_id returning id into v_id;
  end if;
  return jsonb_build_object('id', v_id);
end $$;

create or replace function public.podcast_trilha_remover(p_id uuid) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare t podcast_trilhas;
begin
  perform interno.eu();
  if not (interno.podcast_pode('producao') or interno.podcast_pode('edicao') or interno.podcast_pode('supervisao')) then perform interno.erro('sem_permissao'); end if;
  select * into t from podcast_trilhas where id = p_id for update;
  if not found then perform interno.erro('nao_encontrado'); end if;
  if exists (select 1 from podcast_episodios where p_id = any(trilhas) and publicado_em is not null) then perform interno.erro('em_uso'); end if;
  update podcast_episodios set trilhas = array_remove(trilhas, p_id) where p_id = any(trilhas);
  if t.caminho <> '' then insert into podcast_liberar (deposito, caminho, motivo) values ('podcast-producao', t.caminho, 'trilha_removida') on conflict do nothing; end if;
  delete from podcast_trilhas where id = p_id;
  return jsonb_build_object('liberar', coalesce((select jsonb_agg(jsonb_build_object('deposito', deposito, 'caminho', caminho)) from podcast_liberar), '[]'::jsonb));
end $$;

-- ── Pautas e perguntas, do lado da equipe ──

create or replace function public.podcast_pautas_listar() returns jsonb language plpgsql stable security definer set search_path = interno, pg_temp as $$
begin
  perform interno.eu();
  if not interno.podcaster() then perform interno.erro('sem_permissao'); end if;
  return coalesce((select jsonb_agg(jsonb_build_object('id', p.id, 'titulo', p.titulo, 'descricao', p.descricao, 'origem', p.origem, 'status', p.status, 'votos', p.votos,
                                                       'episodio', p.episodio, 'criado_em', p.criado_em, 'autor', coalesce(f.nome, ''))
                                    order by array_position(array['sugerida', 'votacao', 'escolhida', 'gravada', 'descartada'], p.status), p.votos desc, p.criado_em desc)
                   from podcast_pautas p left join perfis f on f.id = p.autor), '[]'::jsonb);
end $$;

create or replace function public.podcast_pauta_salvar(p_id uuid, p jsonb) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); v_id uuid;
begin
  if not interno.podcaster() then perform interno.erro('sem_permissao'); end if;
  if p_id is null then
    insert into podcast_pautas (titulo, descricao, origem, autor, status)
    values (interno.txt(p ->> 'titulo', 'titulo', 5, 140), interno.txt(p ->> 'descricao', 'descricao', 0, 1000), 'equipe', v, 'sugerida') returning id into v_id;
  else
    update podcast_pautas set titulo = interno.txt(p ->> 'titulo', 'titulo', 5, 140), descricao = interno.txt(p ->> 'descricao', 'descricao', 0, 1000)
    where id = p_id returning id into v_id;
    if not found then perform interno.erro('nao_encontrado'); end if;
  end if;
  return jsonb_build_object('id', v_id);
end $$;

/** Pôr em votação, escolher (ligando a um episódio), descartar. Escolher sem episódio cria a ideia de episódio. */
create or replace function public.podcast_pauta_decidir(p_id uuid, p_status text, p_episodio uuid default null) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); p podcast_pautas; v_episodio uuid := p_episodio;
begin
  if not (interno.podcast_pode('producao') or interno.podcast_pode('supervisao')) then perform interno.erro('sem_permissao'); end if;
  if coalesce(p_status, '') not in ('sugerida', 'votacao', 'escolhida', 'descartada') then perform interno.erro('invalido:status'); end if;
  select * into p from podcast_pautas where id = p_id for update;
  if not found then perform interno.erro('nao_encontrado'); end if;
  if p_status = 'escolhida' then
    if v_episodio is null then
      insert into podcast_episodios (titulo, tema, pauta, criado_por, responsavel) values (p.titulo, left(p.descricao, 300), p.descricao, v, v) returning id into v_episodio;
      perform interno.podcast_anotar(v_episodio, 'criou', 'A partir da pauta "' || p.titulo || '".');
    elsif not exists (select 1 from podcast_episodios where id = v_episodio) then
      perform interno.erro('invalido:episodio');
    end if;
    if p.autor is not null and p.autor <> v then perform interno.avisar(p.autor, format('A pauta que você sugeriu ao podcast ("%s") foi escolhida para um episódio.', p.titulo)); end if;
  end if;
  update podcast_pautas set status = p_status, episodio = case when p_status = 'escolhida' then v_episodio else episodio end, decidido_em = now() where id = p_id;
  return jsonb_build_object('episodio', v_episodio);
end $$;

create or replace function public.podcast_perguntas_listar() returns jsonb language plpgsql stable security definer set search_path = interno, pg_temp as $$
begin
  perform interno.eu();
  if not interno.podcaster() then perform interno.erro('sem_permissao'); end if;
  return coalesce((select jsonb_agg(jsonb_build_object('id', q.id, 'texto', q.texto, 'assinatura', q.assinatura, 'audio', q.audio, 'status', q.status,
                                                       'episodio', q.episodio, 'episodio_titulo', (select titulo from podcast_episodios where id = q.episodio),
                                                       'criado_em', q.criado_em, 'autor', coalesce(f.nome, ''))
                                    order by array_position(array['nova', 'escolhida', 'respondida', 'descartada'], q.status), q.criado_em desc)
                   from (select * from podcast_perguntas order by criado_em desc limit 300) q left join perfis f on f.id = q.autor), '[]'::jsonb);
end $$;

create or replace function public.podcast_pergunta_decidir(p_id uuid, p_status text, p_episodio uuid default null) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare q podcast_perguntas;
begin
  perform interno.eu();
  if not (interno.podcast_pode('producao') or interno.podcast_pode('supervisao')) then perform interno.erro('sem_permissao'); end if;
  if coalesce(p_status, '') not in ('nova', 'escolhida', 'respondida', 'descartada') then perform interno.erro('invalido:status'); end if;
  if p_episodio is not null and not exists (select 1 from podcast_episodios where id = p_episodio) then perform interno.erro('invalido:episodio'); end if;
  update podcast_perguntas set status = p_status, episodio = coalesce(p_episodio, episodio) where id = p_id returning * into q;
  if not found then perform interno.erro('nao_encontrado'); end if;
  if p_status = 'descartada' and q.audio <> '' then
    insert into podcast_liberar (deposito, caminho, motivo) values ('podcast-producao', q.audio, 'pergunta_descartada') on conflict do nothing;
  end if;
  return jsonb_build_object('ok', true);
end $$;

-- ── Agenda das redes ──

create or replace function public.podcast_postagens_listar(p_de date, p_ate date) returns jsonb language plpgsql stable security definer set search_path = interno, pg_temp as $$
begin
  perform interno.eu();
  if not interno.podcaster() then perform interno.erro('sem_permissao'); end if;
  if p_de is null or p_ate is null or p_ate < p_de or p_ate - p_de > 120 then perform interno.erro('invalido:periodo'); end if;
  return coalesce((select jsonb_agg(to_jsonb(k) || jsonb_build_object('episodio_titulo', (select titulo from podcast_episodios where id = k.episodio)) order by k.quando)
                   from podcast_postagens k where k.quando >= p_de and k.quando < p_ate + 1), '[]'::jsonb);
end $$;

create or replace function public.podcast_postagem_salvar(p_id uuid, p jsonb) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); v_id uuid; v_quando timestamptz; v_episodio uuid;
begin
  if not interno.podcaster() then perform interno.erro('sem_permissao'); end if;
  if coalesce(p ->> 'rede', '') not in ('instagram', 'tiktok', 'youtube', 'facebook', 'x', 'outra') then perform interno.erro('invalido:rede'); end if;
  if coalesce(p ->> 'formato', 'corte') not in ('corte', 'arte', 'carrossel', 'story', 'video', 'texto') then perform interno.erro('invalido:formato'); end if;
  if coalesce(p ->> 'status', 'planejada') not in ('planejada', 'pronta', 'publicada') then perform interno.erro('invalido:status'); end if;
  begin
    v_quando := (p ->> 'quando')::timestamptz;
  exception when others then
    perform interno.erro('invalido:quando');
  end;
  if v_quando is null then perform interno.erro('invalido:quando'); end if;
  v_episodio := (interno.podcast_uuids(case when coalesce(p ->> 'episodio', '') = '' then '[]'::jsonb else jsonb_build_array(p ->> 'episodio') end, 'episodio', 1))[1];
  if v_episodio is not null and not exists (select 1 from podcast_episodios where id = v_episodio) then perform interno.erro('invalido:episodio'); end if;
  if p_id is null then
    insert into podcast_postagens (episodio, rede, formato, quando, legenda, status, link, criado_por)
    values (v_episodio, p ->> 'rede', coalesce(p ->> 'formato', 'corte'), v_quando, interno.txt(p ->> 'legenda', 'legenda', 0, 2200), coalesce(p ->> 'status', 'planejada'),
            interno.podcast_link(p ->> 'link', 'link', 300), v)
    returning id into v_id;
  else
    update podcast_postagens set episodio = v_episodio, rede = p ->> 'rede', formato = coalesce(p ->> 'formato', 'corte'), quando = v_quando,
           legenda = interno.txt(p ->> 'legenda', 'legenda', 0, 2200), status = coalesce(p ->> 'status', 'planejada'), link = interno.podcast_link(p ->> 'link', 'link', 300)
    where id = p_id returning id into v_id;
    if not found then perform interno.erro('nao_encontrado'); end if;
  end if;
  return jsonb_build_object('id', v_id);
end $$;

create or replace function public.podcast_postagem_remover(p_id uuid) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
begin
  perform interno.eu();
  if not interno.podcaster() then perform interno.erro('sem_permissao'); end if;
  delete from podcast_postagens where id = p_id;
  return jsonb_build_object('ok', found);
end $$;

-- ── Equipe do podcast, séries e configuração ──

/** Quem está no departamento e o que faz no podcast. */
create or replace function public.podcast_equipe() returns jsonb language plpgsql stable security definer set search_path = interno, pg_temp as $$
begin
  perform interno.eu();
  if not interno.podcaster() then perform interno.erro('sem_permissao'); end if;
  return coalesce((select jsonb_agg(jsonb_build_object(
      'id', f.id, 'nome', f.nome, 'jornalismo', exists (select 1 from papeis p where p.usuario = f.id and p.papel = 'jornalismo'),
      'separadas', exists (select 1 from podcast_funcoes x where x.usuario = f.id),
      'funcoes', coalesce((select jsonb_agg(x.funcao order by x.funcao) from podcast_funcoes x where x.usuario = f.id), '[]'::jsonb)) order by f.nome)
    from perfis f where not f.suspenso and (exists (select 1 from papeis p where p.usuario = f.id and p.papel in ('jornalismo', 'coordenacao', 'vice'))
                                            or exists (select 1 from podcast_funcoes x where x.usuario = f.id))), '[]'::jsonb);
end $$;

/** A coordenação separa as tarefas de uma pessoa. Lista vazia: volta ao padrão (produção e edição, se for do jornalismo). */
create or replace function public.podcast_funcoes_definir(p_usuario uuid, p_funcoes jsonb) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v_lista text[];
begin
  perform interno.eu();
  if not interno.coord() then perform interno.erro('sem_permissao'); end if;
  if not exists (select 1 from perfis where id = p_usuario) then perform interno.erro('nao_encontrado'); end if;
  if jsonb_typeof(coalesce(p_funcoes, '[]'::jsonb)) <> 'array' then perform interno.erro('invalido:funcoes'); end if;
  v_lista := array(select distinct x from jsonb_array_elements_text(coalesce(p_funcoes, '[]'::jsonb)) x);
  if not (v_lista <@ array['producao', 'edicao', 'supervisao']) then perform interno.erro('invalido:funcoes'); end if;
  delete from podcast_funcoes where usuario = p_usuario;
  insert into podcast_funcoes (usuario, funcao) select p_usuario, x from unnest(v_lista) x;
  perform interno.registrar('podcast_funcoes', p_usuario::text, jsonb_build_object('funcoes', to_jsonb(v_lista)));
  perform interno.avisar(p_usuario, 'Suas tarefas no podcast mudaram. Veja em Podcast.');
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.podcast_serie_salvar(p_id uuid, p jsonb) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v_id uuid; v_titulo text := interno.txt(p ->> 'titulo', 'titulo', 2, 80); v_slug text; n integer := 1; v_capa text := btrim(coalesce(p ->> 'capa', '')); v_mini text := btrim(coalesce(p ->> 'capa_mini', ''));
begin
  perform interno.eu();
  if not (interno.podcast_pode('producao') or interno.podcast_pode('supervisao')) then perform interno.erro('sem_permissao'); end if;
  if (v_capa <> '' and v_capa !~ '^capas/[a-z0-9/_-]{8,120}[.](jpg|png|webp)$') or (v_mini <> '' and v_mini !~ '^capas/[a-z0-9/_-]{8,120}[.](jpg|png|webp)$') then
    perform interno.erro('invalido:capa');
  end if;
  if p_id is null then
    v_slug := btrim(left(replace(interno.normal(v_titulo), ' ', '-'), 58), '-');
    if char_length(v_slug) < 2 then v_slug := 'serie'; end if;
    while exists (select 1 from podcast_series where slug = v_slug || case when n > 1 then '-' || n else '' end) loop n := n + 1; end loop;
    v_slug := v_slug || case when n > 1 then '-' || n else '' end;
    insert into podcast_series (slug, titulo, descricao, capa, capa_mini, ordem, ativa)
    values (v_slug, v_titulo, interno.txt(p ->> 'descricao', 'descricao', 0, 600), v_capa, v_mini, coalesce(interno.podcast_int(p -> 'ordem', 'ordem', 0, 999), 0),
            coalesce(p ->> 'ativa', 'true') = 'true')
    returning id into v_id;
  else
    update podcast_series set titulo = v_titulo, descricao = interno.txt(p ->> 'descricao', 'descricao', 0, 600), capa = v_capa, capa_mini = v_mini,
           ordem = coalesce(interno.podcast_int(p -> 'ordem', 'ordem', 0, 999), 0), ativa = coalesce(p ->> 'ativa', 'true') = 'true'
    where id = p_id returning id into v_id;
    if not found then perform interno.erro('nao_encontrado'); end if;
  end if;
  return jsonb_build_object('id', v_id);
end $$;

create or replace function public.podcast_serie_remover(p_id uuid) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
begin
  perform interno.eu();
  if not interno.podcast_pode('supervisao') then perform interno.erro('sem_permissao'); end if;
  delete from podcast_series where id = p_id;
  return jsonb_build_object('ok', found);
end $$;

/** Nome, descrição, dono do feed, categoria, links das plataformas e quantos episódios o depósito guarda. */
create or replace function public.podcast_config_salvar(p jsonb) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v_valor jsonb; v_email text := lower(btrim(coalesce(p ->> 'email', ''))); v_links jsonb := '{}'::jsonb; k text;
  v_capa text := btrim(coalesce(p ->> 'capa', '')); v_mini text := btrim(coalesce(p ->> 'capa_mini', ''));
begin
  perform interno.eu();
  if not interno.podcast_pode('supervisao') then perform interno.erro('sem_permissao'); end if;
  if v_email <> '' and (v_email !~ '^[^@[:space:]]+@[^@[:space:]]+[.][^@[:space:]]+$' or char_length(v_email) > 200) then perform interno.erro('invalido:email'); end if;
  if (v_capa <> '' and v_capa !~ '^capas/[a-z0-9/_-]{8,120}[.](jpg|png|webp)$') or (v_mini <> '' and v_mini !~ '^capas/[a-z0-9/_-]{8,120}[.](jpg|png|webp)$') then
    perform interno.erro('invalido:capa');
  end if;
  foreach k in array array['spotify', 'apple', 'youtube', 'deezer', 'amazon', 'archive', 'instagram', 'tiktok'] loop
    if coalesce(p -> 'links' ->> k, '') <> '' then v_links := v_links || jsonb_build_object(k, interno.podcast_link(p -> 'links' ->> k, 'links', 300)); end if;
  end loop;
  if coalesce(p ->> 'categoria', 'Education') not in ('Education', 'Society & Culture', 'History', 'News', 'Government') then perform interno.erro('invalido:categoria'); end if;
  v_valor := jsonb_build_object(
    'nome', interno.txt(p ->> 'nome', 'nome', 2, 120), 'descricao', interno.txt(p ->> 'descricao', 'descricao', 10, 4000), 'autor', interno.txt(p ->> 'autor', 'autor', 2, 120),
    'email', v_email, 'categoria', coalesce(p ->> 'categoria', 'Education'), 'subcategoria', interno.txt(p ->> 'subcategoria', 'subcategoria', 0, 60),
    'explicito', coalesce(p ->> 'explicito', '') = 'true', 'capa', v_capa, 'capa_mini', v_mini,
    'guardados', coalesce(interno.podcast_int(p -> 'guardados', 'guardados', 1, 50), 10), 'links', v_links);
  insert into configuracoes (chave, valor) values ('podcast', v_valor) on conflict (chave) do update set valor = excluded.valor;
  perform interno.podcast_rodizio();
  perform interno.registrar('podcast_configurado');
  return v_valor;
end $$;

create or replace function public.podcast_estatisticas() returns jsonb language plpgsql stable security definer set search_path = interno, pg_temp as $$
begin
  perform interno.eu();
  if not interno.podcaster() then perform interno.erro('sem_permissao'); end if;
  return jsonb_build_object(
    'episodios', coalesce((select jsonb_agg(jsonb_build_object('id', e.id, 'titulo', e.titulo, 'publicado_em', e.publicado_em,
                                                               'total', (select coalesce(sum(total), 0) from podcast_audicoes where episodio = e.id),
                                                               'mes', (select coalesce(sum(total), 0) from podcast_audicoes where episodio = e.id and dia > current_date - 30))
                                            order by e.publicado_em desc)
                           from podcast_episodios e where e.publicado_em is not null), '[]'::jsonb),
    'dias', coalesce((select jsonb_agg(jsonb_build_object('dia', d.dia, 'total', coalesce((select sum(total) from podcast_audicoes a where a.dia = d.dia), 0)) order by d.dia)
                      from (select generate_series(current_date - 29, current_date, interval '1 day')::date as dia) d), '[]'::jsonb));
end $$;

-- ── Pedidos de arte ao design ──

create or replace function public.podcast_design_pedir(p_episodio uuid, p_texto text) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); v_id uuid; v_titulo text; r record;
begin
  if not interno.podcaster() then perform interno.erro('sem_permissao'); end if;
  perform interno.limite('podcast_design', 20, 1440);
  select titulo into v_titulo from podcast_episodios where id = p_episodio;
  if not found then perform interno.erro('nao_encontrado'); end if;
  insert into podcast_pedidos (episodio, texto, pedido_por) values (p_episodio, interno.txt(p_texto, 'texto', 5, 1000), v) returning id into v_id;
  for r in select distinct usuario from papeis where papel = 'design' and usuario <> v loop
    perform interno.avisar(r.usuario, format('Pedido de arte para o podcast: episódio "%s". Veja em Podcast → Pedidos de arte.', v_titulo));
  end loop;
  return jsonb_build_object('id', v_id);
end $$;

create or replace function public.podcast_pedidos_listar() returns jsonb language plpgsql stable security definer set search_path = interno, pg_temp as $$
begin
  perform interno.eu();
  if not (interno.podcaster() or interno.tem('design')) then perform interno.erro('sem_permissao'); end if;
  return coalesce((select jsonb_agg(jsonb_build_object('id', p.id, 'texto', p.texto, 'status', p.status, 'criado_em', p.criado_em, 'feito_em', p.feito_em,
                                                       'episodio', p.episodio, 'episodio_titulo', e.titulo, 'capa_mini', e.capa_mini, 'numero', e.numero,
                                                       'serie', (select titulo from podcast_series where id = e.serie),
                                                       'pedido_por', (select nome from perfis where id = p.pedido_por), 'atendido_por', (select nome from perfis where id = p.atendido_por))
                                    order by (p.status = 'aberto') desc, p.criado_em desc)
                   from podcast_pedidos p left join podcast_episodios e on e.id = p.episodio), '[]'::jsonb);
end $$;

create or replace function public.podcast_pedido_concluir(p_id uuid) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); p podcast_pedidos;
begin
  if not (interno.podcaster() or interno.tem('design')) then perform interno.erro('sem_permissao'); end if;
  update podcast_pedidos set status = 'feito', atendido_por = v, feito_em = now() where id = p_id and status = 'aberto' returning * into p;
  if not found then perform interno.erro('nao_encontrado'); end if;
  if p.pedido_por is distinct from v then perform interno.avisar(p.pedido_por, 'O design atendeu o seu pedido de arte para o podcast.'); end if;
  return jsonb_build_object('ok', true);
end $$;

/** Para a transcrição automática (função do serviço): onde está o áudio. Quem pede precisa poder editar o episódio. */
create or replace function public.podcast_para_transcrever(p_id uuid) returns jsonb language plpgsql stable security definer set search_path = interno, pg_temp as $$
declare e podcast_episodios;
begin
  perform interno.eu();
  if not (interno.podcast_pode('producao') or interno.podcast_pode('edicao') or interno.podcast_pode('supervisao')) then perform interno.erro('sem_permissao'); end if;
  select * into e from podcast_episodios where id = p_id;
  if not found then perform interno.erro('nao_encontrado'); end if;
  return jsonb_build_object('audio', case when e.audio_guardado then e.audio else '' end, 'bytes', e.audio_bytes, 'tipo', e.audio_tipo, 'externo', e.audio_externo, 'versao', e.versao);
end $$;

-- ── Permissões das funções do podcast ──

do $$
declare f record;
begin
  for f in select p.oid::regprocedure as assinatura, n.nspname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
           where p.prokind = 'f' and ((n.nspname = 'interno' and p.proname like 'podcast%') or (n.nspname = 'public' and p.proname like 'podcast\_%')) loop
    execute format('revoke all on function %s from public', f.assinatura);
    if f.nspname = 'public' then
      execute format('grant execute on function %s to anon, authenticated, service_role', f.assinatura);
    else
      execute format('revoke all on function %s from anon, authenticated', f.assinatura);
    end if;
  end loop;
end $$;

-- ── Depósitos do podcast ──

-- "podcast" é público para leitura (o áudio no ar e as capas); só o departamento envia e apaga, e o design envia capas.
-- "podcast-producao" é fechado: versões de trabalho, trilhas, termos dos convidados e perguntas gravadas.
-- O limite de 50 MB por arquivo é o do plano gratuito do serviço; arquivo maior entra como link (Internet Archive, Drive).
do $$
begin
  if exists (select 1 from pg_namespace where nspname = 'storage') then
    insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    values ('podcast', 'podcast', true, 52428800, array['audio/mpeg', 'audio/mp4', 'audio/x-m4a', 'audio/ogg', 'audio/opus', 'image/jpeg', 'image/png', 'image/webp'])
    on conflict (id) do update set public = true, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;
    insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    values ('podcast-producao', 'podcast-producao', false, 52428800, array['audio/mpeg', 'audio/mp4', 'audio/x-m4a', 'audio/ogg', 'audio/opus', 'audio/wav', 'audio/x-wav',
            'audio/wave', 'audio/flac', 'audio/x-flac', 'audio/aac', 'audio/webm', 'video/mp4', 'video/webm', 'video/quicktime', 'application/pdf', 'image/jpeg',
            'image/png', 'image/webp', 'application/zip'])
    on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

    execute 'drop policy if exists "podcast_envio" on storage.objects';
    execute 'create policy "podcast_envio" on storage.objects for insert to authenticated with check (bucket_id = ''podcast'' and ('
         || '((storage.foldername(name))[1] = ''ep'' and interno.podcaster()) or ((storage.foldername(name))[1] = ''capas'' and (interno.podcaster() or interno.tem(''design'')))))';
    execute 'drop policy if exists "podcast_remocao" on storage.objects';
    execute 'create policy "podcast_remocao" on storage.objects for delete to authenticated using (bucket_id = ''podcast'' and interno.podcaster())';

    execute 'drop policy if exists "podcast_producao_leitura" on storage.objects';
    execute 'create policy "podcast_producao_leitura" on storage.objects for select to authenticated using (bucket_id = ''podcast-producao'' and ('
         || '((storage.foldername(name))[1] in (''ep'', ''trilhas'') and interno.podcast_revisor())'
         || ' or ((storage.foldername(name))[1] = ''termos'' and (interno.podcast_pode(''producao'') or interno.podcast_pode(''supervisao'')))'
         || ' or ((storage.foldername(name))[1] = ''perguntas'' and (interno.podcaster() or (storage.foldername(name))[2] = auth.uid()::text))))';
    execute 'drop policy if exists "podcast_producao_envio" on storage.objects';
    execute 'create policy "podcast_producao_envio" on storage.objects for insert to authenticated with check (bucket_id = ''podcast-producao'' and ('
         || '((storage.foldername(name))[1] in (''ep'', ''trilhas'', ''termos'') and interno.podcaster())'
         || ' or ((storage.foldername(name))[1] = ''perguntas'' and (storage.foldername(name))[2] = auth.uid()::text)))';
    execute 'drop policy if exists "podcast_producao_remocao" on storage.objects';
    execute 'create policy "podcast_producao_remocao" on storage.objects for delete to authenticated using (bucket_id = ''podcast-producao'' and interno.podcaster())';

    execute 'grant usage on schema interno to authenticated';
    execute 'grant execute on function interno.podcaster() to authenticated';
    execute 'grant execute on function interno.podcast_pode(text) to authenticated';
    execute 'grant execute on function interno.podcast_revisor() to authenticated';
    execute 'grant execute on function interno.tem(text, text) to authenticated';
    execute 'grant execute on function interno.coord() to authenticated';
  end if;
end $$;

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule('lucia-podcast', '41 6 * * *', 'select interno.podcast_limpeza()');
  end if;
exception when others then null;
end $$;

-- ───────────── Educação secundária, marketing, material avulso e temas propostos ─────────────
-- Só alarga as regras: nenhuma linha guardada muda. Fica no fim do arquivo para valer por cima das versões anteriores.
do $$
begin
  alter table interno.inscricoes drop constraint if exists inscricoes_papel_check;
  alter table interno.inscricoes add constraint inscricoes_papel_check
    check (papel in ('curadoria', 'mediacao', 'educacao', 'revisao', 'traducao', 'jornalismo', 'mentoria', 'design', 'desenvolvimento', 'educacao_secundaria', 'marketing', 'porta_voz', 'saude'));
  alter table interno.equipe_mensagens drop constraint if exists equipe_mensagens_canal_check;
  alter table interno.equipe_mensagens add constraint equipe_mensagens_canal_check
    check (canal in ('geral', 'pedidos', 'aprendizado', 'coordenacao', 'supervisao', 'curadoria', 'mediacao', 'educacao', 'revisao', 'traducao', 'jornalismo', 'mentoria', 'design', 'marketing', 'desenvolvimento'));
  alter table interno.equipe_mensagens drop constraint if exists equipe_mensagens_para_check;
  alter table interno.equipe_mensagens add constraint equipe_mensagens_para_check
    check (para is null or para in ('coordenacao', 'supervisao', 'curadoria', 'mediacao', 'educacao', 'revisao', 'traducao', 'jornalismo', 'mentoria', 'design', 'marketing', 'desenvolvimento'));
end $$;

-- ───────────────────────────── Arquivos da Gaveta Aberta ─────────────────────────────

-- Depósito fechado, só PDF e até 10 MB. Cada pessoa envia só para a própria pasta; o arquivo fica visível para ela e para a
-- equipe que decide, e só passa a ser público quando a ficha é aprovada (a regra consulta a tabela por uma função).
do $$
begin
  if exists (select 1 from pg_namespace where nspname = 'storage') then
    insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    values ('gaveta', 'gaveta', false, 10485760, array['application/pdf'])
    on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

    execute 'drop policy if exists "gaveta_envio" on storage.objects';
    execute 'create policy "gaveta_envio" on storage.objects for insert to authenticated with check (bucket_id = ''gaveta'' and (storage.foldername(name))[1] = auth.uid()::text and interno.gaveta_pode_enviar())';
    execute 'drop policy if exists "gaveta_leitura" on storage.objects';
    execute 'create policy "gaveta_leitura" on storage.objects for select to anon, authenticated using (bucket_id = ''gaveta'' and interno.gaveta_le(name))';
    execute 'drop policy if exists "gaveta_remocao" on storage.objects';
    execute 'create policy "gaveta_remocao" on storage.objects for delete to authenticated using (bucket_id = ''gaveta'' and ((storage.foldername(name))[1] = auth.uid()::text or interno.media()))';
    -- As regras chamam funções do esquema interno: quem chama precisa poder usá-las (as tabelas continuam fechadas).
    execute 'grant usage on schema interno to anon, authenticated';
    execute 'grant execute on function interno.gaveta_le(text) to anon, authenticated';
    execute 'grant execute on function interno.gaveta_pode_enviar() to authenticated';
    execute 'grant execute on function interno.media() to authenticated';
  end if;
end $$;

-- ───────────────────────────── Aulas em vídeo ─────────────────────────────
-- Quem ensina grava ou envia, pelo painel, aulas de até 10 minutos e até 720p. O arquivo vai para o depósito fechado
-- "videoaulas" (até 50 MB, o limite por arquivo do plano gratuito do serviço). Enquanto a curadoria não aprova, só quem
-- enviou e quem revisa assiste; aprovada, qualquer visitante assiste por um endereço assinado que vale algumas horas.
create table if not exists interno.videoaulas (
  id uuid primary key default gen_random_uuid(),
  autor uuid references interno.perfis (id) on delete set null,
  nome_autor text not null default '' check (char_length(nome_autor) <= 80),
  disciplina text not null check (disciplina ~ '^[a-z0-9-]{2,40}$'),
  trilha text check (trilha is null or trilha ~ '^[a-z0-9-]{2,80}$'),
  titulo text not null check (char_length(titulo) between 3 and 160),
  descricao text not null default '' check (char_length(descricao) <= 2000),
  transcricao text not null default '' check (char_length(transcricao) <= 60000),
  legenda text not null default '' check (char_length(legenda) <= 200000),
  fontes jsonb not null default '[]'::jsonb,
  caminho text not null unique check (caminho ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\.(webm|mp4)$'),
  tipo text not null check (tipo in ('video/webm', 'video/mp4')),
  duracao integer not null check (duracao between 1 and 600),
  largura integer not null check (largura between 16 and 1280),
  altura integer not null check (altura between 16 and 1280),
  tamanho bigint not null check (tamanho between 1 and 52428800),
  status text not null default 'pendente' check (status in ('pendente', 'aprovada', 'recusada')),
  nota text not null default '' check (char_length(nota) <= 1000),
  revisado_por uuid references interno.perfis (id) on delete set null,
  revisado_em timestamptz,
  criado_em timestamptz not null default now(),
  -- 720p: o lado menor do vídeo não passa de 720 pixels (vale para vídeo deitado e em pé).
  constraint videoaulas_720p check (least(largura, altura) <= 720)
);
create index if not exists videoaulas_disciplina on interno.videoaulas (disciplina, status, revisado_em desc);
revoke all on interno.videoaulas from public;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then execute 'revoke all on interno.videoaulas from anon, authenticated'; end if;
end $$;

/** Quem revisa as aulas em vídeo de uma disciplina: curadoria e coordenação, e quem ensina aquela disciplina. Decidir, só a curadoria. */
create or replace function interno.videoaula_revisa(p_disciplina text) returns boolean language sql stable as $$
  select interno.revisa() or interno.tem('educacao', p_disciplina)
$$;

create or replace function interno.videoaula_json(v interno.videoaulas, p_completa boolean) returns jsonb language sql stable as $$
  select jsonb_build_object('id', v.id, 'disciplina', v.disciplina, 'trilha', v.trilha, 'titulo', v.titulo, 'descricao', v.descricao,
    'nome_autor', v.nome_autor, 'caminho', v.caminho, 'tipo', v.tipo, 'duracao', v.duracao, 'largura', v.largura, 'altura', v.altura,
    'tamanho', v.tamanho, 'status', v.status, 'nota', v.nota, 'criado_em', v.criado_em, 'revisado_em', v.revisado_em,
    'tem_legenda', v.legenda <> '', 'tem_transcricao', v.transcricao <> '', 'minha', v.autor = auth.uid())
  || case when p_completa then jsonb_build_object('transcricao', v.transcricao, 'legenda', v.legenda, 'fontes', v.fontes) else '{}'::jsonb end
$$;

/**
 * A regra de leitura do arquivo no depósito (usada pela política do serviço de arquivos, para visitante e para conta):
 * aula aprovada é de todos; a pendente ou recusada, de quem enviou e de quem revisa a disciplina. Quem enviou lê a
 * própria pasta e a coordenação lê o depósito inteiro mesmo sem registro: o serviço só apaga o que a pessoa pode ler,
 * e um arquivo sem registro (envio interrompido, aula apagada) precisa poder sair de lá.
 */
create or replace function public.videoaula_pode_ler(p_nome text) returns boolean language sql stable security definer set search_path = interno, pg_temp as $$
  select exists (select 1 from videoaulas v where v.caminho = p_nome and (
    v.status = 'aprovada' or (auth.uid() is not null and (v.autor = auth.uid() or interno.videoaula_revisa(v.disciplina)))))
    or (auth.uid() is not null and (split_part(p_nome, '/', 1) = auth.uid()::text or interno.coord()))
$$;

/** Quem pode pôr arquivo no depósito: quem ensina (educação e educação secundária) e a curadoria. */
create or replace function public.videoaula_pode_enviar() returns boolean language sql stable security definer set search_path = interno, pg_temp as $$
  select auth.uid() is not null and (interno.revisa() or interno.tem('educacao'))
$$;

/** Registra a aula depois que o arquivo subiu. Os números (duração, tamanho, resolução) foram medidos no navegador e o banco confere os limites. */
create or replace function public.videoaula_enviar(p jsonb) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare
  v uuid := interno.eu();
  v_disc text := interno.disciplina_ok(p ->> 'disciplina');
  v_caminho text := coalesce(p ->> 'caminho', '');
  v_tipo text := coalesce(p ->> 'tipo', '');
  v_legenda text;
  v_id uuid;
begin
  perform interno.limite('videoaula', 12, 1440);
  if v_disc is null then perform interno.erro('invalido:disciplina'); end if;
  if not (interno.revisa() or interno.tem('educacao', v_disc)) then perform interno.erro('sem_permissao'); end if;
  if v_caminho !~ ('^' || v::text || '/[0-9a-f-]{36}\.(webm|mp4)$') then perform interno.erro('invalido:caminho'); end if;
  -- O tipo declarado e a extensão do arquivo precisam bater (.webm ou .mp4).
  if v_tipo not in ('video/webm', 'video/mp4') or (v_tipo = 'video/mp4') <> (v_caminho like '%.mp4') then
    perform interno.erro('invalido:tipo');
  end if;
  if coalesce(p ->> 'duracao', '') !~ '^[0-9]{1,4}$' or (p ->> 'duracao')::int not between 1 and 600 then perform interno.erro('invalido:duracao'); end if;
  if coalesce(p ->> 'largura', '') !~ '^[0-9]{2,4}$' or coalesce(p ->> 'altura', '') !~ '^[0-9]{2,4}$'
     or greatest((p ->> 'largura')::int, (p ->> 'altura')::int) > 854 or least((p ->> 'largura')::int, (p ->> 'altura')::int) > 480 then
    perform interno.erro('invalido:resolucao');
  end if;
  if coalesce(p ->> 'tamanho', '') !~ '^[0-9]{1,9}$' or (p ->> 'tamanho')::bigint not between 1 and 52428800 then perform interno.erro('invalido:tamanho'); end if;
  if coalesce(p ->> 'trilha', '') <> '' and (p ->> 'trilha') !~ '^[a-z0-9-]{2,80}$' then perform interno.erro('invalido:trilha'); end if;
  v_legenda := interno.txt(p ->> 'legenda', 'legenda', 0, 200000);
  if v_legenda <> '' and v_legenda !~ '^WEBVTT' then perform interno.erro('invalido:legenda'); end if;
  -- No serviço de verdade, o arquivo precisa estar mesmo no depósito (o banco de teste não tem o serviço de arquivos).
  if to_regclass('storage.objects') is not null then
    if not exists (select 1 from storage.objects o where o.bucket_id = 'videoaulas' and o.name = v_caminho) then perform interno.erro('invalido:arquivo'); end if;
  end if;
  insert into videoaulas (autor, nome_autor, disciplina, trilha, titulo, descricao, transcricao, legenda, fontes, caminho, tipo, duracao, largura, altura, tamanho)
  values (v, coalesce((select nome from perfis where id = v), ''), v_disc, nullif(p ->> 'trilha', ''),
    interno.txt(p ->> 'titulo', 'titulo', 3, 160), interno.txt(p ->> 'descricao', 'descricao', 0, 2000),
    interno.txt(p ->> 'transcricao', 'transcricao', 0, 60000), v_legenda, interno.fontes_ok(p -> 'fontes', true),
    v_caminho, v_tipo, (p ->> 'duracao')::int, (p ->> 'largura')::int, (p ->> 'altura')::int, (p ->> 'tamanho')::bigint)
  returning id into v_id;
  perform interno.avisar_lideranca('Aula em vídeo nova para revisar: ' || left(p ->> 'titulo', 120), v);
  return jsonb_build_object('id', v_id);
end $$;

create or replace function public.videoaulas_minhas() returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu();
begin
  return coalesce((select jsonb_agg(interno.videoaula_json(x, false) order by x.criado_em desc) from videoaulas x where x.autor = v), '[]'::jsonb);
end $$;

/** As aulas que esperam revisão e que esta pessoa pode ver. */
create or replace function public.videoaulas_fila() returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
begin
  perform interno.eu();
  return coalesce((select jsonb_agg(interno.videoaula_json(x, true) order by x.criado_em) from videoaulas x
                   where x.status = 'pendente' and interno.videoaula_revisa(x.disciplina)), '[]'::jsonb);
end $$;

create or replace function public.videoaulas_contagem() returns integer language plpgsql security definer set search_path = interno, pg_temp as $$
begin
  perform interno.eu();
  return (select count(*)::int from videoaulas x where x.status = 'pendente' and interno.revisa() and x.autor is distinct from auth.uid());
end $$;

/** A curadoria aprova ou recusa. Ninguém aprova a própria aula, salvo a coordenação. */
create or replace function public.videoaula_decidir(p_id uuid, p_aprovar boolean, p_nota text default '') returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); x videoaulas; v_nota text := interno.txt(p_nota, 'nota', 0, 1000);
begin
  if not interno.revisa() then perform interno.erro('sem_permissao'); end if;
  select * into x from videoaulas where id = p_id for update;
  if not found then perform interno.erro('nao_encontrado'); end if;
  if x.status <> 'pendente' then perform interno.erro('ja_decidida'); end if;
  if x.autor = v and not interno.coord() then perform interno.erro('sem_permissao'); end if;
  if not p_aprovar and char_length(v_nota) < 5 then perform interno.erro('invalido:nota'); end if;
  update videoaulas set status = case when p_aprovar then 'aprovada' else 'recusada' end, nota = v_nota, revisado_por = v, revisado_em = now() where id = p_id;
  perform interno.registrar(case when p_aprovar then 'videoaula_aprovada' else 'videoaula_recusada' end, x.titulo, jsonb_build_object('id', p_id));
  perform interno.avisar(x.autor, case when p_aprovar then 'Sua aula em vídeo "' || left(x.titulo, 100) || '" foi aprovada e já está no ar.'
                                       else 'Sua aula em vídeo "' || left(x.titulo, 100) || '" não foi aprovada. Nota: ' || left(v_nota, 300) end);
  return jsonb_build_object('ok', true);
end $$;

/** Tira uma aula aprovada do ar (coordenação). O arquivo continua no depósito até alguém apagar. */
create or replace function public.videoaula_retirar(p_id uuid, p_nota text) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); x videoaulas; v_nota text := interno.txt(p_nota, 'nota', 5, 1000);
begin
  if not interno.coord() then perform interno.erro('sem_permissao'); end if;
  select * into x from videoaulas where id = p_id and status = 'aprovada' for update;
  if not found then perform interno.erro('nao_encontrado'); end if;
  update videoaulas set status = 'recusada', nota = v_nota, revisado_por = v, revisado_em = now() where id = p_id;
  perform interno.registrar('videoaula_retirada', x.titulo, jsonb_build_object('id', p_id));
  perform interno.avisar(x.autor, 'Sua aula em vídeo "' || left(x.titulo, 100) || '" foi retirada do ar. Nota: ' || left(v_nota, 300));
  return jsonb_build_object('ok', true);
end $$;

/** Apaga o registro e devolve o caminho do arquivo, que o painel apaga do depósito em seguida. Quem enviou apaga o que não está no ar; a coordenação apaga qualquer uma. */
create or replace function public.videoaula_apagar(p_id uuid) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); x videoaulas;
begin
  select * into x from videoaulas where id = p_id;
  if not found then perform interno.erro('nao_encontrado'); end if;
  if not (interno.coord() or (x.autor = v and x.status <> 'aprovada')) then perform interno.erro('sem_permissao'); end if;
  delete from videoaulas where id = p_id;
  if x.autor is distinct from v then perform interno.registrar('videoaula_apagada', x.titulo, jsonb_build_object('id', p_id)); end if;
  return jsonb_build_object('caminho', x.caminho);
end $$;

/** Para o site: as aulas no ar (sem transcrição nem legenda, que vêm com videoaula_ver). Qualquer visitante lê. */
create or replace function public.videoaulas_publicas(p_disciplina text default null) returns jsonb language sql stable security definer set search_path = interno, pg_temp as $$
  select coalesce(jsonb_agg(interno.videoaula_json(x, false) - 'minha' - 'nota' - 'status' order by x.revisado_em desc), '[]'::jsonb)
  from videoaulas x where x.status = 'aprovada' and (p_disciplina is null or x.disciplina = p_disciplina)
$$;

create or replace function public.videoaula_ver(p_id uuid) returns jsonb language sql stable security definer set search_path = interno, pg_temp as $$
  select interno.videoaula_json(x, true) - 'minha' - 'nota' from videoaulas x
  where x.id = p_id and (x.status = 'aprovada' or (auth.uid() is not null and (x.autor = auth.uid() or interno.videoaula_revisa(x.disciplina))))
$$;

-- As funções das aulas em vídeo: as de "public" abertas pela API (cada uma confere quem chama), as de "interno" fechadas.
do $$
declare f record;
begin
  for f in select p.oid::regprocedure as assinatura, n.nspname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
           where p.prokind = 'f' and p.proname like 'videoaula%' and n.nspname in ('public', 'interno') loop
    execute format('revoke all on function %s from public', f.assinatura);
    if f.nspname = 'public' then
      execute format('grant execute on function %s to anon, authenticated, service_role', f.assinatura);
    elsif exists (select 1 from pg_roles where rolname = 'anon') then
      execute format('revoke all on function %s from anon, authenticated', f.assinatura);
    end if;
  end loop;
end $$;

-- O depósito: fechado; quem ensina envia na própria pasta; a leitura segue videoaula_pode_ler; apaga quem enviou ou a coordenação.
do $$
begin
  if exists (select 1 from pg_namespace where nspname = 'storage') then
    insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    values ('videoaulas', 'videoaulas', false, 52428800, array['video/webm', 'video/mp4'])
    on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;
    execute 'drop policy if exists "videoaulas_envio" on storage.objects';
    execute 'create policy "videoaulas_envio" on storage.objects for insert to authenticated with check (bucket_id = ''videoaulas'''
         || ' and (storage.foldername(name))[1] = auth.uid()::text and public.videoaula_pode_enviar())';
    execute 'drop policy if exists "videoaulas_leitura" on storage.objects';
    execute 'create policy "videoaulas_leitura" on storage.objects for select to anon, authenticated using (bucket_id = ''videoaulas'' and public.videoaula_pode_ler(name))';
    execute 'drop policy if exists "videoaulas_remocao" on storage.objects';
    execute 'create policy "videoaulas_remocao" on storage.objects for delete to authenticated using (bucket_id = ''videoaulas'''
         || ' and ((storage.foldername(name))[1] = auth.uid()::text or interno.coord()))';
  end if;
end $$;

-- ═══════════════════════════════ Plataforma: avisos, rascunhos, aulas ao vivo e estúdio ═══════════════════════════════
--
-- Quatro peças que o painel ganhou de uma vez:
--   1. Avisos à equipe: a coordenação, a vice-coordenação e a supervisão mandam um aviso que aparece como quadro
--      por cima do painel de cada pessoa (de toda a equipe ou só de algumas funções), até ela fechar.
--   2. Rascunhos: o que a pessoa está escrevendo no painel fica guardado também no banco, para continuar de
--      outro aparelho ou depois de fechar o navegador.
--   3. Aulas ao vivo: a agenda pública, a inscrição, a sala (o vídeo vai direto entre os navegadores, pelo canal
--      de tempo real do serviço) e o bate-papo da aula, que fica guardado como registro.
--   4. Estúdio de design: os trabalhos do marketing e do design, guardados para continuar depois e compartilhar.

create table if not exists interno.avisos_gerais (
  id uuid primary key default gen_random_uuid(),
  autor uuid references interno.perfis (id) on delete set null,
  autor_nome text not null default '',
  titulo text not null check (char_length(titulo) between 2 and 120),
  texto text not null check (char_length(texto) between 2 and 2000),
  -- Vazio: a equipe inteira. Senão, as funções ("educacao", "design"…) e/ou "podcast" (a equipe do podcast).
  para text[] not null default '{}',
  importante boolean not null default false,
  criado_em timestamptz not null default now(),
  expira_em timestamptz not null default now() + interval '14 days'
);
create table if not exists interno.avisos_gerais_vistos (
  aviso uuid not null references interno.avisos_gerais (id) on delete cascade,
  usuario uuid not null references interno.perfis (id) on delete cascade,
  visto_em timestamptz not null default now(),
  primary key (aviso, usuario)
);

create table if not exists interno.rascunhos (
  usuario uuid not null references interno.perfis (id) on delete cascade,
  chave text not null check (chave ~ '^[a-z0-9:_-]{1,80}$'),
  dados jsonb not null default '{}'::jsonb,
  atualizado_em timestamptz not null default now(),
  primary key (usuario, chave)
);

create table if not exists interno.aulas_ao_vivo (
  id uuid primary key default gen_random_uuid(),
  titulo text not null check (char_length(titulo) between 3 and 140),
  descricao text not null default '' check (char_length(descricao) <= 2000),
  disciplina text not null check (disciplina ~ '^[a-z0-9-]{2,40}$'),
  trilha text check (trilha is null or trilha ~ '^[a-z0-9-]{2,80}$'),
  inicio timestamptz not null,
  duracao integer not null default 60 check (duracao between 15 and 240),
  educador uuid not null references interno.perfis (id) on delete cascade,
  co_educadores uuid[] not null default '{}',
  -- Sala de fora (Jitsi, Meet), para turmas grandes demais para o vídeo direto entre navegadores.
  sala_externa text not null default '' check (sala_externa = '' or sala_externa ~ '^https://[^\s]{3,500}$'),
  status text not null default 'agendada' check (status in ('agendada', 'ao_vivo', 'encerrada', 'cancelada')),
  iniciada_em timestamptz,
  encerrada_em timestamptz,
  gravacao text not null default '' check (gravacao = '' or gravacao ~ '^(https://[^\s]{3,500}|/[a-z]{2}/videoaulas[^\s]{0,200})$'),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
create index if not exists aulas_ao_vivo_inicio on interno.aulas_ao_vivo (inicio);
create table if not exists interno.aulas_inscricoes (
  aula uuid not null references interno.aulas_ao_vivo (id) on delete cascade,
  usuario uuid not null references interno.perfis (id) on delete cascade,
  criado_em timestamptz not null default now(),
  primary key (aula, usuario)
);
create table if not exists interno.aulas_chat (
  id uuid primary key default gen_random_uuid(),
  aula uuid not null references interno.aulas_ao_vivo (id) on delete cascade,
  autor uuid references interno.perfis (id) on delete set null,
  nome text not null default '',
  corpo text not null check (char_length(corpo) between 1 and 500),
  tipo text not null default 'fala' check (tipo in ('fala', 'pergunta', 'sistema')),
  oculta boolean not null default false,
  criado_em timestamptz not null default now()
);
create index if not exists aulas_chat_aula on interno.aulas_chat (aula, criado_em);
-- O bate-papo passa pelas mesmas camadas da Comunidade: regras do banco, segunda avaliação opcional e fila da mediação.
alter table interno.aulas_chat add column if not exists retido boolean not null default false;
alter table interno.aulas_chat add column if not exists avaliacao text check (avaliacao is null or avaliacao in ('publicada', 'revisao', 'bloqueada', 'revista'));
alter table interno.aulas_chat add column if not exists motivo text not null default '';
alter table interno.aulas_chat add column if not exists avaliacao_em timestamptz;
alter table interno.aulas_chat add column if not exists tentativas smallint not null default 0;

-- Comentários das aulas em vídeo, com resposta a outro comentário e a mesma moderação da Comunidade.
create table if not exists interno.comentarios (
  id uuid primary key default gen_random_uuid(),
  videoaula uuid not null references interno.videoaulas (id) on delete cascade,
  autor uuid references interno.perfis (id) on delete set null,
  corpo text not null check (char_length(corpo) between 2 and 1000),
  pai uuid references interno.comentarios (id) on delete set null,
  oculto boolean not null default false,
  retido boolean not null default false,
  avaliacao text check (avaliacao is null or avaliacao in ('publicada', 'revisao', 'bloqueada', 'revista')),
  motivo text not null default '',
  avaliacao_em timestamptz,
  tentativas smallint not null default 0,
  criado_em timestamptz not null default now()
);
alter table interno.comentarios enable row level security;
create index if not exists comentarios_videoaula on interno.comentarios (videoaula, criado_em);

create table if not exists interno.designs (
  id uuid primary key default gen_random_uuid(),
  autor uuid not null references interno.perfis (id) on delete cascade,
  autor_nome text not null default '',
  titulo text not null check (char_length(titulo) between 1 and 120),
  formato text not null default '' check (char_length(formato) <= 40),
  largura integer not null check (largura between 16 and 8000),
  altura integer not null check (altura between 16 and 8000),
  dados jsonb not null default '{}'::jsonb,
  -- Prévia pequena (JPEG em data:), para a lista abrir sem baixar o desenho inteiro.
  miniatura text not null default '' check (char_length(miniatura) <= 60000),
  compartilhado boolean not null default true,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

do $$
declare t text;
begin
  foreach t in array array['avisos_gerais', 'avisos_gerais_vistos', 'rascunhos', 'aulas_ao_vivo', 'aulas_inscricoes', 'aulas_chat', 'designs'] loop
    execute format('revoke all on interno.%I from public', t);
    if exists (select 1 from pg_roles where rolname = 'anon') then execute format('revoke all on interno.%I from anon, authenticated', t); end if;
  end loop;
end $$;

-- ───────────────────────────── Avisos à equipe ─────────────────────────────

/** Quem manda aviso para a equipe: coordenação, vice-coordenação e a supervisão (do podcast ou como função própria). */
create or replace function interno.supervisiona() returns boolean language sql stable security definer set search_path = interno, pg_temp as $$
  select interno.coord() or interno.tem('supervisao')
    or exists (select 1 from podcast_funcoes f where f.usuario = auth.uid() and f.funcao = 'supervisao')
$$;

/** Este aviso é para mim? Vazio é para a equipe toda; "podcast" é a equipe do podcast; o resto são funções. */
create or replace function interno.aviso_para_mim(p_para text[]) returns boolean language sql stable security definer set search_path = interno, pg_temp as $$
  select cardinality(p_para) = 0
    or exists (select 1 from papeis p where p.usuario = auth.uid() and p.papel = any (p_para))
    or ('podcast' = any (p_para) and exists (select 1 from podcast_funcoes f where f.usuario = auth.uid()))
$$;

create or replace function public.aviso_geral_enviar(p jsonb) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare
  v uuid := interno.eu();
  v_para text[] := coalesce((select array_agg(x) from jsonb_array_elements_text(coalesce(p -> 'para', '[]'::jsonb)) x), '{}');
  v_dias integer := greatest(1, least(60, coalesce((p ->> 'dias')::integer, 14)));
  v_id uuid;
  v_nome text;
begin
  if not interno.supervisiona() then perform interno.erro('sem_permissao'); end if;
  if exists (select 1 from unnest(v_para) x where x not in ('podcast', 'coordenacao', 'vice', 'curadoria', 'mediacao', 'educacao', 'educacao_secundaria', 'revisao', 'traducao', 'jornalismo', 'mentoria', 'design', 'marketing', 'desenvolvimento', 'supervisao', 'representante', 'porta_voz', 'saude')) then
    perform interno.erro('invalido:para');
  end if;
  perform interno.limite('aviso_geral', 20, 60);
  select nome into v_nome from perfis where id = v;
  insert into avisos_gerais (autor, autor_nome, titulo, texto, para, importante, expira_em)
  values (v, coalesce(v_nome, ''), interno.txt(p ->> 'titulo', 'titulo', 2, 120), interno.txt(p ->> 'texto', 'texto', 2, 2000), v_para,
          coalesce((p ->> 'importante')::boolean, false), now() + make_interval(days => v_dias))
  returning id into v_id;
  perform interno.registrar('aviso_geral_enviado', left(p ->> 'titulo', 120), jsonb_build_object('id', v_id, 'para', v_para));
  -- O mesmo aviso vai por e-mail a cada pessoa alcançada (o modelo com a identidade do instituto é aplicado no envio).
  perform interno.email(interno.email_da_conta(f.id), 'aviso_equipe', 'Aviso da equipe: ' || interno.txt(p ->> 'titulo', 'titulo', 2, 120),
                        'Olá, ' || interno.primeiro_nome(f.nome) || E'.\n\n' || coalesce(v_nome, 'A coordenação') || E' mandou um aviso à equipe:\n\n' || interno.txt(p ->> 'texto', 'texto', 2, 2000)
                        || E'\n\nO aviso também aparece ao abrir o painel: ' || interno.endereco() || '/pt/painel', '', 10)
    from perfis f where not f.suspenso and f.id is distinct from v
      and (interno.voluntario_e(f.id) or exists (select 1 from podcast_funcoes x where x.usuario = f.id))
      and (cardinality(v_para) = 0 or exists (select 1 from papeis p where p.usuario = f.id and p.papel = any (v_para))
           or ('podcast' = any (v_para) and exists (select 1 from podcast_funcoes x where x.usuario = f.id)));
  return jsonb_build_object('id', v_id);
end $$;

/** Os avisos que esta pessoa ainda não fechou. Só a equipe (quem tem função ou faz o podcast) recebe. */
create or replace function public.avisos_gerais_pendentes() returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu();
begin
  if not (interno.voluntario() or exists (select 1 from podcast_funcoes f where f.usuario = v)) then return '[]'::jsonb; end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object('id', a.id, 'titulo', a.titulo, 'texto', a.texto, 'autor', a.autor_nome, 'importante', a.importante, 'criado_em', a.criado_em, 'para', to_jsonb(a.para)) order by a.importante desc, a.criado_em)
    from avisos_gerais a
    where a.expira_em > now() and interno.aviso_para_mim(a.para)
      and not exists (select 1 from avisos_gerais_vistos x where x.aviso = a.id and x.usuario = v)), '[]'::jsonb);
end $$;

create or replace function public.aviso_geral_fechar(p_id uuid) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu();
begin
  insert into avisos_gerais_vistos (aviso, usuario) select p_id, v where exists (select 1 from avisos_gerais where id = p_id) on conflict do nothing;
  return jsonb_build_object('ok', true);
end $$;

/** Para quem manda: os avisos no ar, com quantas pessoas já os fecharam. */
create or replace function public.avisos_gerais_listar() returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
begin
  perform interno.eu();
  if not interno.supervisiona() then perform interno.erro('sem_permissao'); end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object('id', a.id, 'titulo', a.titulo, 'texto', a.texto, 'autor', a.autor_nome, 'importante', a.importante, 'para', to_jsonb(a.para),
                                        'criado_em', a.criado_em, 'expira_em', a.expira_em, 'vistos', (select count(*) from avisos_gerais_vistos x where x.aviso = a.id)) order by a.criado_em desc)
    from avisos_gerais a where a.expira_em > now()), '[]'::jsonb);
end $$;

create or replace function public.aviso_geral_apagar(p_id uuid) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); a avisos_gerais;
begin
  select * into a from avisos_gerais where id = p_id;
  if not found then perform interno.erro('nao_encontrado'); end if;
  if not (interno.coord() or (a.autor = v and interno.supervisiona())) then perform interno.erro('sem_permissao'); end if;
  delete from avisos_gerais where id = p_id;
  perform interno.registrar('aviso_geral_apagado', a.titulo, jsonb_build_object('id', p_id));
  return jsonb_build_object('ok', true);
end $$;

-- ───────────────────────────── Rascunhos ─────────────────────────────

/** Guarda o rascunho desta chave (até 200 KB; cada pessoa tem até 40). O navegador também guarda; aqui é a cópia que viaja. */
create or replace function public.rascunho_salvar(p_chave text, p_dados jsonb) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); v_agora timestamptz := now();
begin
  if p_chave !~ '^[a-z0-9:_-]{1,80}$' then perform interno.erro('invalido:chave'); end if;
  if p_dados is null or jsonb_typeof(p_dados) <> 'object' or pg_column_size(p_dados) > 204800 then perform interno.erro('invalido:dados'); end if;
  insert into rascunhos (usuario, chave, dados, atualizado_em) values (v, p_chave, p_dados, v_agora)
  on conflict (usuario, chave) do update set dados = excluded.dados, atualizado_em = v_agora;
  delete from rascunhos r where r.usuario = v and r.chave in (select chave from rascunhos where usuario = v order by atualizado_em desc offset 40);
  return jsonb_build_object('atualizado_em', v_agora);
end $$;

create or replace function public.rascunho_ver(p_chave text) returns jsonb language sql stable security definer set search_path = interno, pg_temp as $$
  select jsonb_build_object('dados', r.dados, 'atualizado_em', r.atualizado_em) from rascunhos r where r.usuario = interno.eu() and r.chave = p_chave
$$;

create or replace function public.rascunho_apagar(p_chave text) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
begin
  delete from rascunhos where usuario = interno.eu() and chave = p_chave;
  return jsonb_build_object('ok', true);
end $$;

/** Os rascunhos desta pessoa, sem o conteúdo: só a chave, o título e quando foi guardado. */
create or replace function public.rascunhos_listar() returns jsonb language sql stable security definer set search_path = interno, pg_temp as $$
  select coalesce(jsonb_agg(jsonb_build_object('chave', r.chave, 'titulo', coalesce(r.dados ->> 'titulo', ''), 'atualizado_em', r.atualizado_em) order by r.atualizado_em desc), '[]'::jsonb)
  from rascunhos r where r.usuario = interno.eu()
$$;

-- ───────────────────────────── Currículo: disciplinas e trilhas pelo painel ─────────────────────────────
-- As disciplinas e trilhas vivem no código do site (lib/areas.ts, dicionários e content/trilhas). Para a coordenação não
-- depender de ninguém, a mudança é proposta aqui, aprovada pela coordenação ou pela coordenação pedagógica e aplicada
-- pela rotina de publicação (scripts/curriculo.mjs), que escreve os arquivos e deixa o build conferir. Voluntários propõem.
create table if not exists interno.curriculo_propostas (
  id uuid primary key default gen_random_uuid(),
  tipo text not null check (tipo in ('disciplina', 'trilha', 'editar_disciplina', 'editar_trilha', 'remover_disciplina', 'remover_trilha')),
  dados jsonb not null default '{}'::jsonb,
  autor uuid references interno.perfis (id) on delete set null,
  status text not null default 'pendente' check (status in ('pendente', 'aprovada', 'recusada', 'aplicada', 'falhou')),
  nota text not null default '' check (char_length(nota) <= 1000),
  decidido_por uuid references interno.perfis (id) on delete set null,
  decidido_em timestamptz,
  aplicada_em timestamptz,
  criado_em timestamptz not null default now()
);
alter table interno.curriculo_propostas enable row level security;

/** Quem decide o currículo: coordenação e coordenação pedagógica. */
create or replace function interno.curriculo_decide() returns boolean language sql stable security definer set search_path = interno, pg_temp as $$
  select interno.coord() or interno.tem('vice')
$$;

create or replace function interno.curriculo_json(p interno.curriculo_propostas) returns jsonb language sql stable security definer set search_path = interno, pg_temp as $$
  select jsonb_build_object('id', p.id, 'tipo', p.tipo, 'dados', p.dados, 'status', p.status, 'nota', p.nota, 'criado_em', p.criado_em, 'decidido_em', p.decidido_em, 'aplicada_em', p.aplicada_em,
    'autor', coalesce((select interno.nome_visto(f.nome) from perfis f where f.id = p.autor), ''), 'minha', p.autor = auth.uid())
$$;

/**
 * Propõe (voluntário) ou cria direto (coordenação e coordenação pedagógica: nasce aprovada). Os dados são conferidos
 * na aplicação; aqui só o essencial: tamanho e campos obrigatórios por tipo.
 */
create or replace function public.curriculo_propor(p_tipo text, p_dados jsonb) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); p curriculo_propostas; v_slug text;
begin
  if not interno.voluntario() then perform interno.erro('sem_permissao'); end if;
  perform interno.limite('curriculo', 30, 1440);
  if coalesce(p_tipo, '') not in ('disciplina', 'trilha', 'editar_disciplina', 'editar_trilha', 'remover_disciplina', 'remover_trilha') then perform interno.erro('invalido:tipo'); end if;
  if jsonb_typeof(coalesce(p_dados, '{}'::jsonb)) <> 'object' or pg_column_size(p_dados) > 40000 then perform interno.erro('invalido:dados'); end if;
  v_slug := coalesce(p_dados ->> 'slug', '');
  if v_slug !~ '^[a-z0-9][a-z0-9-]{1,59}$' then perform interno.erro('invalido:slug'); end if;
  if p_tipo in ('disciplina', 'editar_disciplina') and char_length(coalesce(p_dados -> 'nomes' ->> 'pt', '')) not between 2 and 60 then perform interno.erro('invalido:nome'); end if;
  if p_tipo in ('trilha') and char_length(coalesce(p_dados ->> 'titulo', '')) not between 3 and 120 then perform interno.erro('invalido:titulo'); end if;
  if p_tipo in ('trilha', 'editar_trilha') and coalesce(p_dados ->> 'etapa', 'medio') not in ('fundamental', 'medio', 'superior') then perform interno.erro('invalido:etapa'); end if;
  if not interno.curriculo_decide() then
    if p_tipo in ('remover_disciplina', 'remover_trilha') then perform interno.erro('sem_permissao'); end if;
    if p_tipo = 'editar_disciplina' and not interno.escreve_em(v_slug) then perform interno.erro('sem_permissao'); end if;
    if p_tipo in ('trilha', 'editar_trilha') and not interno.escreve_em(p_dados ->> 'disciplina') then perform interno.erro('sem_permissao'); end if;
  end if;
  insert into curriculo_propostas (tipo, dados, autor, status, decidido_por, decidido_em)
  values (p_tipo, p_dados, v, case when interno.curriculo_decide() then 'aprovada' else 'pendente' end, case when interno.curriculo_decide() then v end, case when interno.curriculo_decide() then now() end)
  returning * into p;
  if p.status = 'pendente' then perform interno.avisar_lideranca('Proposta de currículo (' || p_tipo || ': ' || v_slug || '). Decida em Disciplinas e trilhas.', v); end if;
  perform interno.registrar('curriculo_' || p.status, p.id::text, jsonb_build_object('tipo', p_tipo, 'slug', v_slug));
  return interno.curriculo_json(p);
end $$;

create or replace function public.curriculo_listar() returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu();
begin
  if not interno.voluntario() then perform interno.erro('sem_permissao'); end if;
  return (select coalesce(jsonb_agg(interno.curriculo_json(p) order by case p.status when 'pendente' then 0 when 'aprovada' then 1 else 2 end, p.criado_em desc), '[]'::jsonb)
          from curriculo_propostas p where p.criado_em > now() - interval '365 days'
            and (p.autor = v or interno.curriculo_decide() or interno.ensina(coalesce(p.dados ->> 'disciplina', p.dados ->> 'slug'))));
end $$;

create or replace function public.curriculo_decidir(p_id uuid, p_aprovar boolean, p_nota text default '') returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); p curriculo_propostas;
begin
  if not interno.curriculo_decide() then perform interno.erro('sem_permissao'); end if;
  update curriculo_propostas set status = case when p_aprovar then 'aprovada' else 'recusada' end, nota = left(coalesce(p_nota, ''), 1000), decidido_por = v, decidido_em = now()
  where id = p_id and status = 'pendente' returning * into p;
  if not found then perform interno.erro('nao_encontrado'); end if;
  perform interno.avisar(p.autor, 'Sua proposta de currículo (' || p.tipo || ': ' || coalesce(p.dados ->> 'slug', '') || ') foi ' || case when p_aprovar then 'aprovada e entra no site na próxima publicação.' else 'recusada. ' || coalesce(p_nota, '') end);
  perform interno.registrar('curriculo_' || p.status, p.id::text, '{}'::jsonb);
  return interno.curriculo_json(p);
end $$;

/** A rotina de publicação (serviço) lê as aprovadas e depois marca o que aplicou (ou o que falhou, com o motivo). */
create or replace function public.curriculo_aprovadas() returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
begin
  if not interno.servico() then perform interno.erro('sem_permissao'); end if;
  return (select coalesce(jsonb_agg(jsonb_build_object('id', p.id, 'tipo', p.tipo, 'dados', p.dados) order by p.decidido_em), '[]'::jsonb) from curriculo_propostas p where p.status = 'aprovada');
end $$;

create or replace function public.curriculo_marcar(p_ids uuid[], p_falhas jsonb default '{}'::jsonb) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare k text;
begin
  if not interno.servico() then perform interno.erro('sem_permissao'); end if;
  update curriculo_propostas set status = 'aplicada', aplicada_em = now() where id = any (coalesce(p_ids, '{}')) and status = 'aprovada';
  for k in select jsonb_object_keys(coalesce(p_falhas, '{}'::jsonb)) loop
    update curriculo_propostas set status = 'falhou', nota = left(coalesce(p_falhas ->> k, ''), 1000) where id = k::uuid and status = 'aprovada';
  end loop;
  return jsonb_build_object('ok', true);
end $$;

-- ───────────────────────────── Reuniões da equipe ─────────────────────────────
-- Reuniões por vídeo (Jitsi, servidor configurável) dentro do painel. A coordenação, a coordenação pedagógica e a
-- supervisão criam e conduzem; qualquer voluntário propõe, e a proposta espera a decisão. Só nome, papel e horários
-- de entrada e saída ficam guardados: nada de áudio ou vídeo no servidor.
create table if not exists interno.reunioes (
  id uuid primary key default gen_random_uuid(),
  titulo text not null check (char_length(titulo) between 3 and 140),
  pauta text not null default '' check (char_length(pauta) <= 4000),
  inicio timestamptz not null,
  duracao integer not null default 60 check (duracao between 15 and 480),
  tipo text not null default 'aberta' check (tipo in ('aberta', 'coordenacao', 'convidados')),
  recorrencia text not null default '' check (recorrencia in ('', 'semanal', 'quinzenal')),
  link_pauta text not null default '' check (link_pauta = '' or link_pauta ~ '^https://[^\s]{3,500}$'),
  -- O nome da sala é sorteado no banco: longo e imprevisível, nunca adivinhável pelo título.
  sala text not null default ('InstitutoLucia-' || replace(gen_random_uuid()::text, '-', '')),
  status text not null default 'agendada' check (status in ('agendada', 'ao_vivo', 'encerrada', 'cancelada')),
  organizador uuid not null references interno.perfis (id) on delete cascade,
  ata text not null default '' check (char_length(ata) <= 20000),
  iniciada_em timestamptz,
  encerrada_em timestamptz,
  criado_em timestamptz not null default now()
);
create index if not exists reunioes_inicio on interno.reunioes (inicio);
create table if not exists interno.reunioes_convites (
  reuniao uuid not null references interno.reunioes (id) on delete cascade,
  usuario uuid not null references interno.perfis (id) on delete cascade,
  primary key (reuniao, usuario)
);
create table if not exists interno.reunioes_presencas (
  id uuid primary key default gen_random_uuid(),
  reuniao uuid not null references interno.reunioes (id) on delete cascade,
  usuario uuid not null references interno.perfis (id) on delete cascade,
  entrou_em timestamptz not null default now(),
  saiu_em timestamptz
);
create index if not exists reunioes_presencas_reuniao on interno.reunioes_presencas (reuniao);
create table if not exists interno.reunioes_propostas (
  id uuid primary key default gen_random_uuid(),
  autor uuid not null references interno.perfis (id) on delete cascade,
  titulo text not null check (char_length(titulo) between 3 and 140),
  assunto text not null default '' check (char_length(assunto) <= 2000),
  inicio timestamptz not null,
  duracao integer not null default 60 check (duracao between 15 and 480),
  convidados text not null default '' check (char_length(convidados) <= 500),
  status text not null default 'pendente' check (status in ('pendente', 'aprovada', 'recusada', 'reagendada')),
  resposta text not null default '' check (char_length(resposta) <= 500),
  reuniao uuid references interno.reunioes (id) on delete set null,
  decidido_por uuid references interno.perfis (id) on delete set null,
  decidido_em timestamptz,
  criado_em timestamptz not null default now()
);
alter table interno.reunioes enable row level security;
alter table interno.reunioes_convites enable row level security;
alter table interno.reunioes_presencas enable row level security;
alter table interno.reunioes_propostas enable row level security;

/** Posso entrar nesta reunião? Aberta a todos os voluntários; da coordenação, só quem gere cargos; de convidados, quem está na lista (e quem organiza). */
create or replace function interno.reuniao_entra(r interno.reunioes) returns boolean language sql stable security definer set search_path = interno, pg_temp as $$
  select auth.uid() is not null and (
    r.organizador = auth.uid() or interno.gere_cargos()
    or (r.tipo = 'aberta' and interno.voluntario())
    or (r.tipo = 'convidados' and exists (select 1 from reunioes_convites c where c.reuniao = r.id and c.usuario = auth.uid())))
$$;

create or replace function interno.reuniao_json(r interno.reunioes) returns jsonb language sql stable security definer set search_path = interno, pg_temp as $$
  select jsonb_build_object(
    'id', r.id, 'titulo', r.titulo, 'pauta', r.pauta, 'inicio', r.inicio, 'duracao', r.duracao, 'tipo', r.tipo, 'recorrencia', r.recorrencia,
    'link_pauta', r.link_pauta, 'status', r.status, 'ata', r.ata, 'iniciada_em', r.iniciada_em, 'encerrada_em', r.encerrada_em, 'criado_em', r.criado_em,
    'organizador', jsonb_build_object('id', r.organizador, 'nome', coalesce((select interno.nome_visto(f.nome) from perfis f where f.id = r.organizador), '')),
    'conduzo', r.organizador = auth.uid() or interno.gere_cargos(),
    'posso_entrar', interno.reuniao_entra(r),
    -- A sala só vai para quem pode entrar, e nunca de uma reunião cancelada ou encerrada.
    'sala', case when interno.reuniao_entra(r) and r.status in ('agendada', 'ao_vivo') then r.sala end,
    'convidados', (select coalesce(jsonb_agg(jsonb_build_object('id', f.id, 'nome', interno.nome_visto(f.nome)) order by f.nome), '[]'::jsonb) from reunioes_convites c join perfis f on f.id = c.usuario where c.reuniao = r.id),
    'presentes', (select count(distinct p.usuario) from reunioes_presencas p where p.reuniao = r.id),
    'presencas', case when r.organizador = auth.uid() or interno.gere_cargos()
      then (select coalesce(jsonb_agg(jsonb_build_object('nome', interno.nome_visto(f.nome), 'entrou_em', p.entrou_em, 'saiu_em', p.saiu_em) order by p.entrou_em), '[]'::jsonb) from reunioes_presencas p join perfis f on f.id = p.usuario where p.reuniao = r.id)
      else '[]'::jsonb end)
$$;

/** Cria ou altera uma reunião. Coordenação, coordenação pedagógica e supervisão. */
create or replace function public.reuniao_salvar(p_id uuid, p jsonb) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); r reunioes; v_inicio timestamptz; v_conv uuid[]; c uuid;
begin
  if not interno.gere_cargos() then perform interno.erro('sem_permissao'); end if;
  begin v_inicio := (p ->> 'inicio')::timestamptz; exception when others then perform interno.erro('invalido:inicio'); end;
  if v_inicio is null or v_inicio > now() + interval '365 days' then perform interno.erro('invalido:inicio'); end if;
  if coalesce(p ->> 'tipo', 'aberta') not in ('aberta', 'coordenacao', 'convidados') then perform interno.erro('invalido:tipo'); end if;
  v_conv := coalesce((select array_agg((x #>> '{}')::uuid) from jsonb_array_elements(coalesce(p -> 'convidados', '[]'::jsonb)) x), '{}');
  if cardinality(v_conv) > 200 then perform interno.erro('invalido:convidados'); end if;
  if p_id is null then
    insert into reunioes (titulo, pauta, inicio, duracao, tipo, recorrencia, link_pauta, organizador)
    values (interno.txt(p ->> 'titulo', 'titulo', 3, 140), interno.txt(coalesce(p ->> 'pauta', ''), 'pauta', 0, 4000), v_inicio, coalesce((p ->> 'duracao')::int, 60),
            coalesce(p ->> 'tipo', 'aberta'), coalesce(p ->> 'recorrencia', ''), coalesce(p ->> 'link_pauta', ''), v)
    returning * into r;
  else
    update reunioes set titulo = interno.txt(p ->> 'titulo', 'titulo', 3, 140), pauta = interno.txt(coalesce(p ->> 'pauta', ''), 'pauta', 0, 4000), inicio = v_inicio,
      duracao = coalesce((p ->> 'duracao')::int, duracao), tipo = coalesce(p ->> 'tipo', tipo), recorrencia = coalesce(p ->> 'recorrencia', recorrencia), link_pauta = coalesce(p ->> 'link_pauta', link_pauta)
    where id = p_id returning * into r;
    if not found then perform interno.erro('nao_encontrado'); end if;
  end if;
  delete from reunioes_convites where reuniao = r.id;
  foreach c in array v_conv loop
    if interno.da_equipe(c) then
      insert into reunioes_convites (reuniao, usuario) values (r.id, c) on conflict do nothing;
      if c <> v then perform interno.avisar(c, 'Você foi convidado para a reunião “' || r.titulo || '”, em ' || to_char(r.inicio at time zone 'America/Sao_Paulo', 'DD/MM HH24:MI') || '. Veja em Reuniões.'); end if;
    end if;
  end loop;
  perform interno.registrar('reuniao_salva', r.id::text, jsonb_build_object('titulo', r.titulo, 'tipo', r.tipo));
  return interno.reuniao_json(r);
end $$;

/** As reuniões que posso ver: as próximas e as ao vivo, e as passadas (histórico), nos últimos 180 dias. */
create or replace function public.reunioes_listar() returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
begin
  perform interno.eu();
  if not interno.voluntario() then perform interno.erro('sem_permissao'); end if;
  return (select coalesce(jsonb_agg(interno.reuniao_json(r) order by r.inicio desc), '[]'::jsonb)
          from reunioes r where r.inicio > now() - interval '180 days' and (interno.reuniao_entra(r) or r.tipo = 'aberta'));
end $$;

/** Começar, encerrar (para todos) ou cancelar. Quem organiza e quem gere cargos. */
create or replace function public.reuniao_estado(p_id uuid, p_status text) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); r reunioes;
begin
  select * into r from reunioes where id = p_id;
  if not found then perform interno.erro('nao_encontrado'); end if;
  if not (r.organizador = v or interno.gere_cargos()) then perform interno.erro('sem_permissao'); end if;
  if p_status not in ('ao_vivo', 'encerrada', 'cancelada') then perform interno.erro('invalido:status'); end if;
  update reunioes set status = p_status,
    iniciada_em = case when p_status = 'ao_vivo' then coalesce(iniciada_em, now()) else iniciada_em end,
    encerrada_em = case when p_status in ('encerrada', 'cancelada') then now() else encerrada_em end
  where id = p_id returning * into r;
  if p_status = 'encerrada' then update reunioes_presencas set saiu_em = now() where reuniao = p_id and saiu_em is null; end if;
  if p_status = 'ao_vivo' then
    -- Quem foi convidado (ou toda a equipe, se aberta) recebe o aviso de que começou.
    insert into avisos (para, texto)
    select distinct u, left('A reunião “' || r.titulo || '” começou agora. Entre em Reuniões.', 500)
    from (select c.usuario as u from reunioes_convites c where c.reuniao = p_id
          union select p.usuario from papeis p where r.tipo = 'aberta'
          union select p.usuario from papeis p where r.tipo = 'coordenacao' and p.papel in ('coordenacao', 'vice', 'supervisao')) x where u <> v;
  end if;
  -- Reunião recorrente encerrada: a próxima já fica marcada.
  if p_status = 'encerrada' and r.recorrencia <> '' then
    insert into reunioes (titulo, pauta, inicio, duracao, tipo, recorrencia, link_pauta, organizador)
    values (r.titulo, r.pauta, r.inicio + case when r.recorrencia = 'semanal' then interval '7 days' else interval '14 days' end, r.duracao, r.tipo, r.recorrencia, r.link_pauta, r.organizador);
  end if;
  perform interno.registrar('reuniao_' || p_status, p_id::text, '{}'::jsonb);
  return interno.reuniao_json(r);
end $$;

create or replace function public.reuniao_ata(p_id uuid, p_ata text) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); r reunioes;
begin
  select * into r from reunioes where id = p_id;
  if not found then perform interno.erro('nao_encontrado'); end if;
  if not (r.organizador = v or interno.gere_cargos()) then perform interno.erro('sem_permissao'); end if;
  update reunioes set ata = left(coalesce(p_ata, ''), 20000) where id = p_id returning * into r;
  return interno.reuniao_json(r);
end $$;

/** Entrei (ou saí) da sala: a lista de presença. */
create or replace function public.reuniao_presenca(p_id uuid, p_entrou boolean) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); r reunioes;
begin
  select * into r from reunioes where id = p_id;
  if not found or not interno.reuniao_entra(r) then perform interno.erro('nao_encontrado'); end if;
  if p_entrou then
    if not exists (select 1 from reunioes_presencas where reuniao = p_id and usuario = v and saiu_em is null) then
      insert into reunioes_presencas (reuniao, usuario) values (p_id, v);
    end if;
  else
    update reunioes_presencas set saiu_em = now() where reuniao = p_id and usuario = v and saiu_em is null;
  end if;
  return jsonb_build_object('ok', true);
end $$;

/** Um voluntário propõe uma reunião; a liderança decide. */
create or replace function public.reuniao_propor(p jsonb) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); v_inicio timestamptz; v_id uuid; v_titulo text;
begin
  if not interno.voluntario() then perform interno.erro('sem_permissao'); end if;
  perform interno.limite('reuniao_propor', 10, 1440);
  begin v_inicio := (p ->> 'inicio')::timestamptz; exception when others then perform interno.erro('invalido:inicio'); end;
  if v_inicio is null or v_inicio < now() or v_inicio > now() + interval '180 days' then perform interno.erro('invalido:inicio'); end if;
  v_titulo := interno.txt(p ->> 'titulo', 'titulo', 3, 140);
  insert into reunioes_propostas (autor, titulo, assunto, inicio, duracao, convidados)
  values (v, v_titulo, interno.txt(coalesce(p ->> 'assunto', ''), 'assunto', 0, 2000), v_inicio, least(greatest(coalesce((p ->> 'duracao')::int, 60), 15), 480), left(coalesce(p ->> 'convidados', ''), 500))
  returning id into v_id;
  perform interno.avisar_lideranca('Proposta de reunião: “' || v_titulo || '”, para ' || to_char(v_inicio at time zone 'America/Sao_Paulo', 'DD/MM HH24:MI') || '. Decida em Reuniões → Propostas.', v);
  return jsonb_build_object('id', v_id);
end $$;

/** As propostas: as minhas; para quem gere cargos, todas. */
create or replace function public.reunioes_propostas() returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu();
begin
  return (select coalesce(jsonb_agg(jsonb_build_object('id', p.id, 'titulo', p.titulo, 'assunto', p.assunto, 'inicio', p.inicio, 'duracao', p.duracao, 'convidados', p.convidados,
                                                        'status', p.status, 'resposta', p.resposta, 'reuniao', p.reuniao, 'criado_em', p.criado_em, 'minha', p.autor = v,
                                                        'autor', coalesce((select interno.nome_visto(f.nome) from perfis f where f.id = p.autor), ''))
                                     order by case p.status when 'pendente' then 0 else 1 end, p.inicio desc), '[]'::jsonb)
          from reunioes_propostas p where p.criado_em > now() - interval '180 days' and (p.autor = v or interno.gere_cargos()));
end $$;

/** Aprovar (vira reunião de convidados, com o autor dentro), recusar com motivo curto, ou sugerir outro horário. */
create or replace function public.reuniao_proposta_decidir(p_id uuid, p_status text, p_resposta text default '', p_inicio timestamptz default null) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); p reunioes_propostas; r reunioes;
begin
  if not interno.gere_cargos() then perform interno.erro('sem_permissao'); end if;
  select * into p from reunioes_propostas where id = p_id;
  if not found then perform interno.erro('nao_encontrado'); end if;
  if p_status not in ('aprovada', 'recusada', 'reagendada') then perform interno.erro('invalido:status'); end if;
  if p_status = 'aprovada' then
    insert into reunioes (titulo, pauta, inicio, duracao, tipo, organizador)
    values (p.titulo, p.assunto || case when p.convidados <> '' then E'\n\nConvidar: ' || p.convidados else '' end, coalesce(p_inicio, p.inicio), p.duracao, 'convidados', v)
    returning * into r;
    insert into reunioes_convites (reuniao, usuario) values (r.id, p.autor) on conflict do nothing;
    insert into reunioes_convites (reuniao, usuario) values (r.id, v) on conflict do nothing;
  end if;
  update reunioes_propostas set status = p_status, resposta = left(coalesce(p_resposta, ''), 500), reuniao = r.id, decidido_por = v, decidido_em = now(),
    inicio = coalesce(p_inicio, inicio) where id = p_id;
  perform interno.avisar(p.autor, case p_status when 'aprovada' then 'Sua proposta de reunião “' || p.titulo || '” foi aprovada: ' || to_char(coalesce(p_inicio, p.inicio) at time zone 'America/Sao_Paulo', 'DD/MM HH24:MI') || '. Veja em Reuniões.'
                                   when 'recusada' then 'Sua proposta de reunião “' || p.titulo || '” não foi aprovada. ' || coalesce(p_resposta, '')
                                   else 'Sua proposta de reunião “' || p.titulo || '” ganhou outro horário: ' || to_char(coalesce(p_inicio, p.inicio) at time zone 'America/Sao_Paulo', 'DD/MM HH24:MI') || '. ' || coalesce(p_resposta, '') end);
  perform interno.registrar('reuniao_proposta_' || p_status, p_id::text, '{}'::jsonb);
  return jsonb_build_object('ok', true, 'reuniao', r.id);
end $$;

-- ───────────────────────────── Aulas ao vivo ─────────────────────────────

/** Quem dá aula: educação e educação secundária (qualquer disciplina) e a coordenação. */
create or replace function interno.educador() returns boolean language sql stable security definer set search_path = interno, pg_temp as $$
  select interno.coord() or exists (select 1 from papeis p where p.usuario = auth.uid() and p.papel in ('educacao', 'educacao_secundaria'))
$$;

/** A pessoa conduz esta aula (é quem marcou, foi chamada como co-educadora, ou é da coordenação)? */
create or replace function interno.conduz(a interno.aulas_ao_vivo) returns boolean language sql stable security definer set search_path = interno, pg_temp as $$
  select auth.uid() is not null and (a.educador = auth.uid() or auth.uid() = any (a.co_educadores) or interno.coord())
$$;

create or replace function interno.aula_json(a interno.aulas_ao_vivo, p_completa boolean) returns jsonb language sql stable security definer set search_path = interno, pg_temp as $$
  select jsonb_build_object(
    'id', a.id, 'titulo', a.titulo, 'descricao', a.descricao, 'disciplina', a.disciplina, 'trilha', a.trilha, 'inicio', a.inicio, 'duracao', a.duracao,
    'status', a.status, 'iniciada_em', a.iniciada_em, 'encerrada_em', a.encerrada_em, 'gravacao', a.gravacao, 'sala_externa', a.sala_externa,
    'educador', jsonb_build_object('id', a.educador, 'nome', coalesce((select nome from perfis where id = a.educador), '')),
    'co_educadores', coalesce((select jsonb_agg(jsonb_build_object('id', f.id, 'nome', f.nome) order by f.nome) from perfis f where f.id = any (a.co_educadores)), '[]'::jsonb),
    'inscritos', (select count(*) from aulas_inscricoes i where i.aula = a.id),
    'inscrito', auth.uid() is not null and exists (select 1 from aulas_inscricoes i where i.aula = a.id and i.usuario = auth.uid()),
    'conduzo', interno.conduz(a),
    'mensagens', case when p_completa then (select count(*) from aulas_chat m where m.aula = a.id and not m.oculta) else null end)
$$;

/** Marca ou altera uma aula. Quem conduz edita; co-educadores recebem um recado ao serem chamados. */
create or replace function public.aula_ao_vivo_salvar(p_id uuid, p jsonb) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare
  v uuid := interno.eu();
  a aulas_ao_vivo;
  v_co uuid[] := coalesce((select array_agg((x #>> '{}')::uuid) from jsonb_array_elements(coalesce(p -> 'co_educadores', '[]'::jsonb)) x), '{}');
  v_inicio timestamptz;
  v_disc text := interno.disciplina_ok(p ->> 'disciplina');
  c uuid;
begin
  if not interno.educador() then perform interno.erro('sem_permissao'); end if;
  if v_disc is null then perform interno.erro('invalido:disciplina'); end if;
  begin
    v_inicio := (p ->> 'inicio')::timestamptz;
  exception when others then perform interno.erro('invalido:inicio');
  end;
  if v_inicio is null or v_inicio > now() + interval '365 days' then perform interno.erro('invalido:inicio'); end if;
  if cardinality(v_co) > 8 then perform interno.erro('invalido:co_educadores'); end if;
  v_co := array_remove(v_co, v);
  if exists (select 1 from unnest(v_co) x where not exists (select 1 from papeis p2 where p2.usuario = x and p2.papel in ('educacao', 'educacao_secundaria', 'coordenacao', 'vice', 'mentoria'))) then
    perform interno.erro('invalido:co_educadores');
  end if;
  if p_id is null then
    if v_inicio < now() - interval '1 hour' then perform interno.erro('invalido:inicio'); end if;
    perform interno.limite('aula_ao_vivo', 20, 1440);
    insert into aulas_ao_vivo (titulo, descricao, disciplina, trilha, inicio, duracao, educador, co_educadores, sala_externa)
    values (interno.txt(p ->> 'titulo', 'titulo', 3, 140), interno.txt(p ->> 'descricao', 'descricao', 0, 2000), v_disc,
            nullif(interno.txt(p ->> 'trilha', 'trilha', 0, 80), ''), v_inicio, coalesce((p ->> 'duracao')::integer, 60), v, v_co, interno.txt(p ->> 'sala_externa', 'sala_externa', 0, 500))
    returning * into a;
    perform interno.registrar('aula_ao_vivo_marcada', a.titulo, jsonb_build_object('id', a.id, 'inicio', a.inicio));
    foreach c in array v_co loop
      perform interno.avisar(c, format('%s chamou você para dar junto a aula ao vivo "%s", em %s. Veja em Aulas ao vivo.', coalesce((select nome from perfis where id = v), 'Um colega'), left(a.titulo, 100), to_char(a.inicio at time zone 'America/Sao_Paulo', 'DD/MM HH24:MI')));
    end loop;
  else
    select * into a from aulas_ao_vivo where id = p_id for update;
    if not found then perform interno.erro('nao_encontrado'); end if;
    if not interno.conduz(a) then perform interno.erro('sem_permissao'); end if;
    if a.status in ('encerrada', 'cancelada') then perform interno.erro('ja_decidida'); end if;
    foreach c in array v_co loop
      if not (c = any (a.co_educadores)) then
        perform interno.avisar(c, format('%s chamou você para dar junto a aula ao vivo "%s". Veja em Aulas ao vivo.', coalesce((select nome from perfis where id = v), 'Um colega'), left(p ->> 'titulo', 100)));
      end if;
    end loop;
    update aulas_ao_vivo set titulo = interno.txt(p ->> 'titulo', 'titulo', 3, 140), descricao = interno.txt(p ->> 'descricao', 'descricao', 0, 2000), disciplina = v_disc,
      trilha = nullif(interno.txt(p ->> 'trilha', 'trilha', 0, 80), ''), inicio = v_inicio, duracao = coalesce((p ->> 'duracao')::integer, a.duracao),
      co_educadores = v_co, sala_externa = interno.txt(p ->> 'sala_externa', 'sala_externa', 0, 500), gravacao = coalesce(interno.txt(p ->> 'gravacao', 'gravacao', 0, 500), a.gravacao), atualizado_em = now()
    where id = p_id returning * into a;
  end if;
  return interno.aula_json(a, true);
end $$;

/** A agenda pública: o que está marcado ou acontecendo, e as aulas recentes que deixaram gravação. */
create or replace function public.aulas_ao_vivo_listar(p_disciplina text default null, p_dias integer default 60) returns jsonb language sql stable security definer set search_path = interno, pg_temp as $$
  select coalesce(jsonb_agg(interno.aula_json(a, false) order by a.inicio), '[]'::jsonb)
  from aulas_ao_vivo a
  where (p_disciplina is null or a.disciplina = p_disciplina)
    and ((a.status in ('agendada', 'ao_vivo') and a.inicio < now() + make_interval(days => greatest(1, least(coalesce(p_dias, 60), 180))) and a.inicio > now() - interval '12 hours')
         or (a.status = 'encerrada' and a.gravacao <> '' and a.inicio > now() - interval '30 days'))
$$;

create or replace function public.aula_ao_vivo_ver(p_id uuid) returns jsonb language sql stable security definer set search_path = interno, pg_temp as $$
  select interno.aula_json(a, true) from aulas_ao_vivo a where a.id = p_id and (a.status <> 'cancelada' or interno.conduz(a))
$$;

/** As aulas que eu conduzo (as próximas e as dos últimos 90 dias). */
create or replace function public.aulas_ao_vivo_minhas() returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu();
begin
  return coalesce((select jsonb_agg(interno.aula_json(a, true) order by a.inicio desc) from aulas_ao_vivo a
                   where (a.educador = v or v = any (a.co_educadores) or interno.coord()) and a.inicio > now() - interval '90 days'), '[]'::jsonb);
end $$;

/** Começar, encerrar, cancelar ou voltar a "agendada". Ao começar, quem se inscreveu recebe um recado. */
create or replace function public.aula_ao_vivo_estado(p_id uuid, p_status text) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); a aulas_ao_vivo; r record;
begin
  select * into a from aulas_ao_vivo where id = p_id for update;
  if not found then perform interno.erro('nao_encontrado'); end if;
  if not interno.conduz(a) then perform interno.erro('sem_permissao'); end if;
  if p_status not in ('agendada', 'ao_vivo', 'encerrada', 'cancelada') then perform interno.erro('invalido:status'); end if;
  if a.status = p_status then return interno.aula_json(a, true); end if;
  if p_status = 'ao_vivo' then
    if a.inicio > now() + interval '2 hours' then perform interno.erro('invalido:inicio'); end if;
    update aulas_ao_vivo set status = 'ao_vivo', iniciada_em = coalesce(iniciada_em, now()), encerrada_em = null, atualizado_em = now() where id = p_id returning * into a;
    insert into aulas_chat (aula, autor, nome, corpo, tipo) values (a.id, v, '', 'A aula começou.', 'sistema');
    for r in select i.usuario from aulas_inscricoes i where i.aula = a.id and i.usuario <> v loop
      perform interno.avisar(r.usuario, format('A aula ao vivo "%s" começou agora. Entre pela agenda de aulas ao vivo.', left(a.titulo, 100)));
    end loop;
  elsif p_status = 'encerrada' then
    update aulas_ao_vivo set status = 'encerrada', encerrada_em = now(), atualizado_em = now() where id = p_id returning * into a;
    insert into aulas_chat (aula, autor, nome, corpo, tipo) values (a.id, v, '', 'A aula terminou. Obrigado a quem participou.', 'sistema');
  elsif p_status = 'cancelada' then
    update aulas_ao_vivo set status = 'cancelada', atualizado_em = now() where id = p_id returning * into a;
    for r in select i.usuario from aulas_inscricoes i where i.aula = a.id and i.usuario <> v loop
      perform interno.avisar(r.usuario, format('A aula ao vivo "%s" foi cancelada.', left(a.titulo, 100)));
    end loop;
  else
    update aulas_ao_vivo set status = 'agendada', iniciada_em = null, encerrada_em = null, atualizado_em = now() where id = p_id returning * into a;
  end if;
  perform interno.registrar('aula_ao_vivo_' || p_status, a.titulo, jsonb_build_object('id', a.id));
  return interno.aula_json(a, true);
end $$;

create or replace function public.aula_ao_vivo_apagar(p_id uuid) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); a aulas_ao_vivo;
begin
  select * into a from aulas_ao_vivo where id = p_id;
  if not found then perform interno.erro('nao_encontrado'); end if;
  if not (interno.coord() or (a.educador = v and a.status <> 'ao_vivo')) then perform interno.erro('sem_permissao'); end if;
  delete from aulas_ao_vivo where id = p_id;
  perform interno.registrar('aula_ao_vivo_apagada', a.titulo, jsonb_build_object('id', p_id));
  return jsonb_build_object('ok', true);
end $$;

/** Quem tem conta marca presença: recebe recado quando a aula começa. */
create or replace function public.aula_ao_vivo_inscrever(p_id uuid, p_inscrever boolean default true) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu();
begin
  if not exists (select 1 from aulas_ao_vivo where id = p_id and status in ('agendada', 'ao_vivo')) then perform interno.erro('nao_encontrado'); end if;
  if p_inscrever then
    perform interno.limite('aula_inscrever', 60, 60);
    insert into aulas_inscricoes (aula, usuario) values (p_id, v) on conflict do nothing;
  else
    delete from aulas_inscricoes where aula = p_id and usuario = v;
  end if;
  return jsonb_build_object('inscrito', p_inscrever, 'inscritos', (select count(*) from aulas_inscricoes where aula = p_id));
end $$;

create or replace function interno.chat_aula_json(m interno.aulas_chat) returns jsonb language sql stable as $$
  select jsonb_build_object('id', m.id, 'autor', m.autor, 'nome', m.nome, 'corpo', m.corpo, 'tipo', m.tipo, 'oculta', m.oculta, 'retido', m.retido, 'criado_em', m.criado_em)
$$;

/** Fala no bate-papo da aula (precisa de conta). Abre meia hora antes e fecha quando a aula termina. */
create or replace function public.aula_chat_enviar(p_aula uuid, p_corpo text, p_tipo text default 'fala') returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); a aulas_ao_vivo; m aulas_chat; v_corpo text := interno.txt(p_corpo, 'corpo', 1, 500); v_nome text; v_av jsonb; v_veredito text;
begin
  select * into a from aulas_ao_vivo where id = p_aula;
  if not found then perform interno.erro('nao_encontrado'); end if;
  if a.status in ('encerrada', 'cancelada') then perform interno.erro('topico_trancado'); end if;
  if not (a.status = 'ao_vivo' or a.inicio < now() + interval '30 minutes' or interno.conduz(a)) then perform interno.erro('topico_trancado'); end if;
  if p_tipo not in ('fala', 'pergunta') then perform interno.erro('invalido:tipo'); end if;
  perform interno.limite('aula_chat', 40, 2);
  -- A mesma avaliação da Comunidade; quem conduz a aula (e a equipe que cuida) fala direto.
  v_av := interno.moderar_texto(v_corpo, v, interno.conduz(a));
  v_veredito := v_av ->> 'veredito';
  if v_veredito = 'bloquear' then
    perform interno.registrar('comunidade_bloqueada', p_aula::text, jsonb_build_object('tipo', 'aula_chat', 'motivo', v_av ->> 'motivo'));
    perform interno.erro('conteudo_recusado');
  end if;
  select nome into v_nome from perfis where id = v;
  insert into aulas_chat (aula, autor, nome, corpo, tipo, oculta, retido, avaliacao, motivo)
  values (p_aula, v, coalesce(v_nome, ''), v_corpo, p_tipo, v_veredito <> 'publicar', v_veredito = 'revisar',
          case v_veredito when 'publicar' then 'publicada' else 'revisao' end, v_av ->> 'motivo') returning * into m;
  return interno.chat_aula_json(m) || jsonb_build_object('avaliando', coalesce((v_av ->> 'externa')::boolean, false));
end $$;

/** O bate-papo (qualquer visitante lê). Com p_depois, só o que chegou depois daquele instante: é o que a sala pede a cada poucos segundos. */
create or replace function public.aula_chat_listar(p_aula uuid, p_depois timestamptz default null) returns jsonb language plpgsql stable security definer set search_path = interno, pg_temp as $$
declare a aulas_ao_vivo; v_conduzo boolean := false;
begin
  select * into a from aulas_ao_vivo where id = p_aula;
  if found then v_conduzo := interno.conduz(a); end if;
  return coalesce((select jsonb_agg(interno.chat_aula_json(m) order by m.criado_em) from (
    select * from aulas_chat m where m.aula = p_aula and (not m.oculta or v_conduzo or (m.retido and m.autor = auth.uid()))
      and (p_depois is null or m.criado_em > p_depois) order by m.criado_em desc limit 300) m), '[]'::jsonb);
end $$;

/** Quem conduz a aula, a mediação, a coordenação e quem escreveu escondem (ou devolvem) uma fala. */
create or replace function public.aula_chat_moderar(p_id uuid, p_ocultar boolean) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); m aulas_chat; a aulas_ao_vivo;
begin
  select * into m from aulas_chat where id = p_id;
  if not found then perform interno.erro('nao_encontrado'); end if;
  select * into a from aulas_ao_vivo where id = m.aula;
  if not (interno.conduz(a) or interno.media() or m.autor = v) then perform interno.erro('sem_permissao'); end if;
  update aulas_chat set oculta = p_ocultar where id = p_id;
  return jsonb_build_object('ok', true);
end $$;

-- ───────────────────────────── Comentários em tempo real ─────────────────────────────

/**
 * A avaliação de sempre da Comunidade, para outros lugares onde o público escreve: as regras do banco
 * (interno.veredito), o modo de segurança (tudo espera aprovação manual) e a segunda avaliação opcional (o texto espera
 * por ela). Quem cuida da comunidade (ou conduz a aula) passa direto pelo modo de segurança.
 */
create or replace function interno.moderar_texto(p_texto text, p_autor uuid, p_equipe boolean default false) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v_av jsonb := interno.veredito(p_texto, interno.cuida() or coalesce(p_equipe, false), p_autor); v_veredito text := v_av ->> 'veredito';
begin
  if v_veredito = 'publicar' and interno.aprovacao_manual() and not (interno.cuida() or coalesce(p_equipe, false)) then
    return jsonb_build_object('veredito', 'revisar', 'motivo', 'modo_seguranca');
  elsif v_veredito = 'publicar' and interno.avaliacao_externa() then
    return jsonb_build_object('veredito', 'revisar', 'motivo', 'aguardando_avaliacao', 'externa', true);
  end if;
  return v_av;
end $$;
revoke all on function interno.moderar_texto(text, uuid, boolean) from public, anon, authenticated;

create or replace function interno.comentario_json(c interno.comentarios) returns jsonb language sql stable security definer set search_path = interno, pg_temp as $$
  select jsonb_build_object('id', c.id, 'corpo', c.corpo, 'pai', c.pai, 'criado_em', c.criado_em, 'retido', c.retido, 'oculto', c.oculto,
    'autor', coalesce((select nome from perfis where id = c.autor), ''), 'autor_selo', interno.selo(c.autor), 'meu', c.autor is not null and c.autor = auth.uid())
$$;
revoke all on function interno.comentario_json(interno.comentarios) from public, anon, authenticated;

/** Os comentários de uma aula em vídeo (qualquer visitante lê). Com p_depois, só os que chegaram depois. */
create or replace function public.comentarios_listar(p_videoaula uuid, p_depois timestamptz default null) returns jsonb language plpgsql stable security definer set search_path = interno, pg_temp as $$
begin
  perform interno.aberta('videos');
  return coalesce((select jsonb_agg(interno.comentario_json(c) order by c.criado_em) from (
    select * from comentarios c where c.videoaula = p_videoaula
      and (not c.oculto or (c.retido and c.autor = auth.uid()) or interno.cuida())
      and (p_depois is null or c.criado_em > p_depois)
    order by c.criado_em desc limit 300) c), '[]'::jsonb);
end $$;

/** Comentar uma aula em vídeo (precisa de conta), com resposta a outro comentário. A avaliação é a da Comunidade. */
create or replace function public.comentario_enviar(p_videoaula uuid, p_corpo text, p_pai uuid default null) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); v_corpo text := interno.txt(p_corpo, 'corpo', 2, 1000); v_av jsonb; v_veredito text; c comentarios;
begin
  perform interno.aberta('videos');
  perform interno.limite('comentario', 20, 10);
  if not exists (select 1 from videoaulas where id = p_videoaula and status = 'aprovada') then perform interno.erro('nao_encontrado'); end if;
  if p_pai is not null and not exists (select 1 from comentarios where id = p_pai and videoaula = p_videoaula and not oculto) then perform interno.erro('nao_encontrado'); end if;
  v_av := interno.moderar_texto(v_corpo, v, false);
  v_veredito := v_av ->> 'veredito';
  insert into comentarios (videoaula, autor, corpo, pai, oculto, retido, avaliacao, motivo)
  values (p_videoaula, v, v_corpo, p_pai, v_veredito <> 'publicar', v_veredito = 'revisar',
          case v_veredito when 'publicar' then 'publicada' when 'bloquear' then 'bloqueada' else 'revisao' end, v_av ->> 'motivo')
  returning * into c;
  if v_veredito = 'bloquear' then perform interno.registrar('comunidade_bloqueada', c.id::text, jsonb_build_object('tipo', 'comentario', 'motivo', v_av ->> 'motivo')); end if;
  return jsonb_build_object('id', c.id, 'retido', v_veredito = 'revisar', 'bloqueado', v_veredito = 'bloquear', 'avaliando', coalesce((v_av ->> 'externa')::boolean, false), 'comentario', interno.comentario_json(c));
end $$;

/** Quem escreveu tira o próprio comentário; quem cuida da comunidade também (e pode devolver). */
create or replace function public.comentario_apagar(p_id uuid) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu();
begin
  update comentarios set oculto = true, retido = false where id = p_id and (autor = v or interno.cuida());
  if not found then perform interno.erro('nao_encontrado'); end if;
  return jsonb_build_object('ok', true);
end $$;

do $$
declare f text;
begin
  foreach f in array array['comentarios_listar(uuid, timestamptz)', 'comentario_enviar(uuid, text, uuid)', 'comentario_apagar(uuid)'] loop
    execute format('revoke all on function public.%s from public', f);
    execute format('grant execute on function public.%s to anon, authenticated, service_role', f);
  end loop;
end $$;

-- ───────────────────────────── Estúdio de design ─────────────────────────────

/** Quem usa o estúdio: marketing, design e a coordenação (o jornalismo também, para as artes do podcast). */
create or replace function interno.desenha() returns boolean language sql stable security definer set search_path = interno, pg_temp as $$
  select interno.coord() or interno.tem('marketing') or interno.tem('design') or interno.tem('jornalismo')
$$;

-- Pasta, etiquetas, revisão, lixeira, número de páginas e o alcance anotado de cada trabalho.
alter table interno.designs add column if not exists pasta text not null default '' check (char_length(pasta) <= 60);
alter table interno.designs add column if not exists etiquetas text[] not null default '{}' check (cardinality(etiquetas) <= 12);
alter table interno.designs add column if not exists status text not null default 'rascunho' check (status in ('rascunho', 'revisao', 'ajustes', 'aprovado', 'publicado'));
alter table interno.designs add column if not exists nota text not null default '' check (char_length(nota) <= 1000);
alter table interno.designs add column if not exists decidido_por text not null default '';
alter table interno.designs add column if not exists paginas integer not null default 1 check (paginas between 1 and 60);
alter table interno.designs add column if not exists apagado_em timestamptz;
alter table interno.designs add column if not exists alcance integer check (alcance is null or alcance >= 0);
alter table interno.designs add column if not exists publicado_em timestamptz;

-- Comentários da revisão (de quem cria, da coordenação e de quem mais estiver no trabalho).
create table if not exists interno.design_comentarios (
  id uuid primary key default gen_random_uuid(),
  design uuid not null references interno.designs (id) on delete cascade,
  autor uuid not null references interno.perfis (id) on delete cascade,
  autor_nome text not null default '',
  texto text not null check (char_length(texto) between 1 and 2000),
  pagina integer not null default 0 check (pagina between 0 and 60),
  criado_em timestamptz not null default now()
);
create index if not exists design_comentarios_design on interno.design_comentarios (design, criado_em);

-- Versões anteriores: o que estava guardado antes de cada mudança (uma a cada dez minutos, as 15 mais novas).
create table if not exists interno.design_versoes (
  id uuid primary key default gen_random_uuid(),
  design uuid not null references interno.designs (id) on delete cascade,
  autor_nome text not null default '',
  dados jsonb not null,
  miniatura text not null default '' check (char_length(miniatura) <= 60000),
  criado_em timestamptz not null default now()
);
create index if not exists design_versoes_design on interno.design_versoes (design, criado_em desc);

-- A biblioteca da equipe: blocos reutilizáveis (camadas) e paletas de campanha.
create table if not exists interno.design_biblioteca (
  id uuid primary key default gen_random_uuid(),
  autor uuid not null references interno.perfis (id) on delete cascade,
  autor_nome text not null default '',
  tipo text not null check (tipo in ('bloco', 'paleta')),
  nome text not null check (char_length(nome) between 1 and 80),
  dados jsonb not null default '{}'::jsonb,
  criado_em timestamptz not null default now()
);

-- Quantas vezes cada modelo foi usado (só o nome do modelo e a contagem).
create table if not exists interno.design_modelos_uso (
  modelo text primary key check (modelo ~ '^[a-z0-9-]{2,60}$'),
  vezes integer not null default 0,
  atualizado_em timestamptz not null default now()
);

-- Publicações no Instagram (agora ou agendadas). As imagens ficam no depósito público "estudio-publicacoes".
create table if not exists interno.design_publicacoes (
  id uuid primary key default gen_random_uuid(),
  design uuid references interno.designs (id) on delete set null,
  autor uuid not null references interno.perfis (id) on delete cascade,
  autor_nome text not null default '',
  titulo text not null default '' check (char_length(titulo) <= 120),
  urls text[] not null check (cardinality(urls) between 1 and 10),
  legenda text not null default '' check (char_length(legenda) <= 2200),
  quando timestamptz not null default now(),
  status text not null default 'agendada' check (status in ('agendada', 'publicando', 'publicada', 'falhou', 'cancelada')),
  erro text not null default '' check (char_length(erro) <= 500),
  media_id text not null default '' check (char_length(media_id) <= 80),
  criado_em timestamptz not null default now()
);
create index if not exists design_publicacoes_quando on interno.design_publicacoes (status, quando);

-- Segredos que só o dono do banco escreve (pelo SQL Editor): a chave da tarefa automática que publica os agendados.
create table if not exists interno.segredos (
  nome text primary key,
  valor text not null
);

do $$
declare t text;
begin
  foreach t in array array['design_comentarios', 'design_versoes', 'design_biblioteca', 'design_modelos_uso', 'design_publicacoes', 'segredos'] loop
    execute format('alter table interno.%I enable row level security', t);
    execute format('revoke all on interno.%I from public', t);
    if exists (select 1 from pg_roles where rolname = 'anon') then execute format('revoke all on interno.%I from anon, authenticated', t); end if;
  end loop;
end $$;

/** Quem publica no perfil do instituto: a coordenação e o marketing. */
create or replace function interno.design_publica() returns boolean language sql stable security definer set search_path = interno, pg_temp as $$
  select interno.coord() or interno.tem('marketing')
$$;

create or replace function interno.design_json(d interno.designs, p_completo boolean) returns jsonb language sql stable as $$
  select jsonb_build_object('id', d.id, 'titulo', d.titulo, 'formato', d.formato, 'largura', d.largura, 'altura', d.altura, 'autor', d.autor_nome,
                            'meu', d.autor = auth.uid(), 'compartilhado', d.compartilhado, 'miniatura', d.miniatura, 'criado_em', d.criado_em, 'atualizado_em', d.atualizado_em,
                            'pasta', d.pasta, 'etiquetas', to_jsonb(d.etiquetas), 'status', d.status, 'nota', d.nota, 'decidido_por', d.decidido_por,
                            'paginas', d.paginas, 'apagado_em', d.apagado_em, 'alcance', d.alcance, 'publicado_em', d.publicado_em,
                            'dados', case when p_completo then d.dados else null end)
$$;

/** Pode ver (e comentar) este trabalho: quem fez, a equipe quando é compartilhado, a coordenação sempre. */
create or replace function interno.design_ve(d interno.designs) returns boolean language sql stable security definer set search_path = interno, pg_temp as $$
  select interno.desenha() and (d.autor = auth.uid() or d.compartilhado or interno.coord())
$$;

create or replace function public.design_salvar(p_id uuid, p jsonb) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare
  v uuid := interno.eu();
  d designs;
  v_nome text;
  v_mini text := coalesce(p ->> 'miniatura', '');
  v_paginas integer := least(60, greatest(1, coalesce((p ->> 'paginas')::integer, 1)));
begin
  if not interno.desenha() then perform interno.erro('sem_permissao'); end if;
  -- Até 3 MB: as imagens do aparelho entram no desenho já reduzidas, em data:.
  if p -> 'dados' is null or jsonb_typeof(p -> 'dados') <> 'object' or pg_column_size(p -> 'dados') > 3145728 then perform interno.erro('invalido:dados'); end if;
  if v_mini <> '' and (v_mini !~ '^data:image/(jpeg|webp|png);base64,[A-Za-z0-9+/=]+$' or char_length(v_mini) > 60000) then perform interno.erro('invalido:miniatura'); end if;
  select nome into v_nome from perfis where id = v;
  if p_id is null then
    perform interno.limite('design_salvar', 200, 60);
    if (select count(*) from designs where autor = v and apagado_em is null) >= 200 then perform interno.erro('limite_pedidos'); end if;
    insert into designs (autor, autor_nome, titulo, formato, largura, altura, dados, miniatura, compartilhado, paginas)
    values (v, coalesce(v_nome, ''), interno.txt(p ->> 'titulo', 'titulo', 1, 120), interno.txt(p ->> 'formato', 'formato', 0, 40),
            (p ->> 'largura')::integer, (p ->> 'altura')::integer, p -> 'dados', v_mini, coalesce((p ->> 'compartilhado')::boolean, true), v_paginas)
    returning * into d;
  else
    select * into d from designs where id = p_id and apagado_em is null for update;
    if not found then perform interno.erro('nao_encontrado'); end if;
    if not (d.autor = v or (d.compartilhado and interno.desenha()) or interno.coord()) then perform interno.erro('sem_permissao'); end if;
    -- A versão de antes fica guardada (no máximo uma a cada dez minutos; ficam as 15 mais novas).
    if d.dados is distinct from (p -> 'dados') and not exists (select 1 from design_versoes where design = d.id and criado_em > now() - interval '10 minutes') then
      insert into design_versoes (design, autor_nome, dados, miniatura) values (d.id, coalesce(v_nome, ''), d.dados, d.miniatura);
      delete from design_versoes where design = d.id and id not in (select id from design_versoes where design = d.id order by criado_em desc limit 15);
    end if;
    update designs set titulo = interno.txt(p ->> 'titulo', 'titulo', 1, 120), formato = interno.txt(p ->> 'formato', 'formato', 0, 40),
      largura = (p ->> 'largura')::integer, altura = (p ->> 'altura')::integer, dados = p -> 'dados', miniatura = v_mini, paginas = v_paginas,
      compartilhado = case when d.autor = v then coalesce((p ->> 'compartilhado')::boolean, d.compartilhado) else d.compartilhado end,
      -- Arte aprovada que muda volta para a revisão.
      status = case when d.status = 'aprovado' and d.dados is distinct from (p -> 'dados') then 'revisao' else d.status end,
      atualizado_em = now()
    where id = p_id returning * into d;
  end if;
  return interno.design_json(d, false);
end $$;

/** Os meus trabalhos e os que a equipe compartilhou (ou a lixeira), sem o desenho em si (que vem em design_ver). */
drop function if exists public.designs_listar();
create or replace function public.designs_listar(p_lixeira boolean default false) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu();
begin
  if not interno.desenha() then perform interno.erro('sem_permissao'); end if;
  -- Faxina: o que está na lixeira há mais de 30 dias sai de vez.
  if random() < 0.05 then delete from designs where apagado_em < now() - interval '30 days'; end if;
  if p_lixeira then
    return coalesce((select jsonb_agg(interno.design_json(d, false) order by d.apagado_em desc) from (select * from designs where apagado_em is not null and (autor = v or interno.coord()) order by apagado_em desc limit 200) d), '[]'::jsonb);
  end if;
  return coalesce((select jsonb_agg(interno.design_json(d, false) order by d.atualizado_em desc) from (select * from designs where apagado_em is null and (autor = v or compartilhado) order by atualizado_em desc limit 200) d), '[]'::jsonb);
end $$;

create or replace function public.design_ver(p_id uuid) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); d designs;
begin
  if not interno.desenha() then perform interno.erro('sem_permissao'); end if;
  select * into d from designs where id = p_id and apagado_em is null and (autor = v or compartilhado or interno.coord());
  if not found then perform interno.erro('nao_encontrado'); end if;
  return interno.design_json(d, true);
end $$;

/** Apagar manda para a lixeira (dá para restaurar por 30 dias). */
create or replace function public.design_apagar(p_id uuid) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); d designs;
begin
  select * into d from designs where id = p_id and apagado_em is null;
  if not found then perform interno.erro('nao_encontrado'); end if;
  if not (d.autor = v or interno.coord()) then perform interno.erro('sem_permissao'); end if;
  update designs set apagado_em = now() where id = p_id;
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.design_restaurar(p_id uuid) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); d designs;
begin
  select * into d from designs where id = p_id and apagado_em is not null;
  if not found then perform interno.erro('nao_encontrado'); end if;
  if not (d.autor = v or interno.coord()) then perform interno.erro('sem_permissao'); end if;
  update designs set apagado_em = null, atualizado_em = now() where id = p_id returning * into d;
  return interno.design_json(d, false);
end $$;

/** Apagar de vez: só o que já está na lixeira, por quem fez ou pela coordenação. */
create or replace function public.design_apagar_de_vez(p_id uuid) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); d designs;
begin
  select * into d from designs where id = p_id and apagado_em is not null;
  if not found then perform interno.erro('nao_encontrado'); end if;
  if not (d.autor = v or interno.coord()) then perform interno.erro('sem_permissao'); end if;
  delete from designs where id = p_id;
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.design_organizar(p_id uuid, p_pasta text, p_etiquetas text[]) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); d designs; v_etiquetas text[];
begin
  select * into d from designs where id = p_id and apagado_em is null for update;
  if not found then perform interno.erro('nao_encontrado'); end if;
  if not (d.autor = v or interno.coord()) then perform interno.erro('sem_permissao'); end if;
  select coalesce(array_agg(distinct e), '{}') into v_etiquetas
  from (select lower(interno.txt(x, 'etiquetas', 1, 30)) as e from unnest(coalesce(p_etiquetas, '{}')) x where btrim(x) <> '') t;
  if cardinality(v_etiquetas) > 12 then perform interno.erro('invalido:etiquetas'); end if;
  update designs set pasta = interno.txt(coalesce(p_pasta, ''), 'pasta', 0, 60), etiquetas = v_etiquetas where id = p_id returning * into d;
  return interno.design_json(d, false);
end $$;

/**
 * A revisão: quem cria manda para a revisão; a coordenação aprova ou pede ajuste (com nota); depois de aprovada,
 * quem fez, a coordenação ou o marketing marcam como publicada.
 */
create or replace function public.design_status(p_id uuid, p_status text, p_nota text default '') returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); d designs; v_nome text; v_nota text := interno.txt(coalesce(p_nota, ''), 'nota', 0, 1000);
begin
  if not interno.desenha() then perform interno.erro('sem_permissao'); end if;
  select * into d from designs where id = p_id and apagado_em is null for update;
  if not found or not interno.design_ve(d) then perform interno.erro('nao_encontrado'); end if;
  if p_status not in ('rascunho', 'revisao', 'ajustes', 'aprovado', 'publicado') then perform interno.erro('invalido:status'); end if;
  if p_status in ('aprovado', 'ajustes') and not interno.coord() then perform interno.erro('sem_permissao'); end if;
  if p_status = 'ajustes' and char_length(v_nota) < 3 then perform interno.erro('invalido:nota'); end if;
  if p_status = 'publicado' and not (d.autor = v or interno.design_publica()) then perform interno.erro('sem_permissao'); end if;
  select nome into v_nome from perfis where id = v;
  update designs set status = p_status,
    nota = case when p_status in ('aprovado', 'ajustes') then v_nota else nota end,
    decidido_por = case when p_status in ('aprovado', 'ajustes') then coalesce(v_nome, '') else decidido_por end,
    publicado_em = case when p_status = 'publicado' then coalesce(publicado_em, now()) else publicado_em end
  where id = p_id returning * into d;
  return interno.design_json(d, false);
end $$;

create or replace function public.design_revisao(p_id uuid) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); d designs;
begin
  select * into d from designs where id = p_id and apagado_em is null;
  if not found or not interno.design_ve(d) then perform interno.erro('nao_encontrado'); end if;
  return jsonb_build_object('status', d.status, 'nota', d.nota, 'decidido_por', d.decidido_por,
    'comentarios', coalesce((select jsonb_agg(jsonb_build_object('id', c.id, 'autor', c.autor_nome, 'texto', c.texto, 'pagina', c.pagina, 'criado_em', c.criado_em, 'meu', c.autor = v) order by c.criado_em)
                             from design_comentarios c where c.design = d.id), '[]'::jsonb));
end $$;

create or replace function public.design_comentar(p_id uuid, p_texto text, p_pagina integer default 0) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); d designs; v_nome text; c design_comentarios;
begin
  select * into d from designs where id = p_id and apagado_em is null;
  if not found or not interno.design_ve(d) then perform interno.erro('nao_encontrado'); end if;
  perform interno.limite('design_comentar', 60, 60);
  if (select count(*) from design_comentarios where design = d.id) >= 500 then perform interno.erro('limite_pedidos'); end if;
  select nome into v_nome from perfis where id = v;
  insert into design_comentarios (design, autor, autor_nome, texto, pagina)
  values (d.id, v, coalesce(v_nome, ''), interno.txt(p_texto, 'texto', 1, 2000), least(60, greatest(0, coalesce(p_pagina, 0))))
  returning * into c;
  return jsonb_build_object('id', c.id);
end $$;

create or replace function public.design_versoes(p_id uuid) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare d designs;
begin
  perform interno.eu();
  select * into d from designs where id = p_id and apagado_em is null;
  if not found or not interno.design_ve(d) then perform interno.erro('nao_encontrado'); end if;
  return coalesce((select jsonb_agg(jsonb_build_object('id', x.id, 'autor', x.autor_nome, 'criado_em', x.criado_em, 'miniatura', x.miniatura) order by x.criado_em desc)
                   from design_versoes x where x.design = d.id), '[]'::jsonb);
end $$;

create or replace function public.design_versao(p_versao uuid) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare x design_versoes; d designs;
begin
  perform interno.eu();
  select * into x from design_versoes where id = p_versao;
  if not found then perform interno.erro('nao_encontrado'); end if;
  select * into d from designs where id = x.design and apagado_em is null;
  if not found or not interno.design_ve(d) then perform interno.erro('nao_encontrado'); end if;
  return jsonb_build_object('id', x.id, 'criado_em', x.criado_em, 'dados', x.dados);
end $$;

create or replace function public.design_biblioteca_listar() returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu();
begin
  if not interno.desenha() then perform interno.erro('sem_permissao'); end if;
  return coalesce((select jsonb_agg(jsonb_build_object('id', b.id, 'tipo', b.tipo, 'nome', b.nome, 'dados', b.dados, 'autor', b.autor_nome, 'meu', b.autor = v) order by b.criado_em desc)
                   from (select * from design_biblioteca order by criado_em desc limit 300) b), '[]'::jsonb);
end $$;

create or replace function public.design_biblioteca_salvar(p jsonb) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); v_nome text; b design_biblioteca;
begin
  if not interno.desenha() then perform interno.erro('sem_permissao'); end if;
  if coalesce(p ->> 'tipo', '') not in ('bloco', 'paleta') then perform interno.erro('invalido:tipo'); end if;
  if p -> 'dados' is null or jsonb_typeof(p -> 'dados') <> 'object' or pg_column_size(p -> 'dados') > 1048576 then perform interno.erro('invalido:dados'); end if;
  perform interno.limite('design_biblioteca', 60, 60);
  if (select count(*) from design_biblioteca where autor = v) >= 100 then perform interno.erro('limite_pedidos'); end if;
  select nome into v_nome from perfis where id = v;
  insert into design_biblioteca (autor, autor_nome, tipo, nome, dados)
  values (v, coalesce(v_nome, ''), p ->> 'tipo', interno.txt(p ->> 'nome', 'nome', 1, 80), p -> 'dados')
  returning * into b;
  return jsonb_build_object('id', b.id);
end $$;

create or replace function public.design_biblioteca_apagar(p_id uuid) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); b design_biblioteca;
begin
  select * into b from design_biblioteca where id = p_id;
  if not found then perform interno.erro('nao_encontrado'); end if;
  if not (b.autor = v or interno.coord()) then perform interno.erro('sem_permissao'); end if;
  delete from design_biblioteca where id = p_id;
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.design_modelo_usado(p_modelo text) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
begin
  perform interno.eu();
  if not interno.desenha() then perform interno.erro('sem_permissao'); end if;
  if coalesce(p_modelo, '') !~ '^[a-z0-9-]{2,60}$' then perform interno.erro('invalido:modelo'); end if;
  perform interno.limite('design_modelo_usado', 120, 60);
  insert into design_modelos_uso (modelo, vezes) values (p_modelo, 1)
  on conflict (modelo) do update set vezes = design_modelos_uso.vezes + 1, atualizado_em = now();
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.design_modelos_mais_usados() returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
begin
  perform interno.eu();
  if not interno.desenha() then perform interno.erro('sem_permissao'); end if;
  return coalesce((select jsonb_agg(jsonb_build_object('modelo', m.modelo, 'vezes', m.vezes) order by m.vezes desc, m.modelo) from (select * from design_modelos_uso order by vezes desc, modelo limit 8) m), '[]'::jsonb);
end $$;

/** O alcance anotado de um post publicado (o número que o Instagram mostra), para saber o que funcionou. */
create or replace function public.design_alcance(p_id uuid, p_alcance integer) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); d designs;
begin
  select * into d from designs where id = p_id and apagado_em is null for update;
  if not found then perform interno.erro('nao_encontrado'); end if;
  if not (d.autor = v or interno.design_publica()) then perform interno.erro('sem_permissao'); end if;
  if p_alcance is null or p_alcance < 0 or p_alcance > 100000000 then perform interno.erro('invalido:alcance'); end if;
  update designs set alcance = p_alcance, publicado_em = coalesce(publicado_em, now()), status = case when status = 'aprovado' then 'publicado' else status end
  where id = p_id returning * into d;
  return interno.design_json(d, false);
end $$;

create or replace function public.design_pode_publicar() returns boolean language plpgsql security definer set search_path = interno, pg_temp as $$
begin
  perform interno.eu();
  return interno.design_publica();
end $$;

create or replace function interno.design_publicacao_json(x interno.design_publicacoes) returns jsonb language sql stable as $$
  select jsonb_build_object('id', x.id, 'design', x.design, 'titulo', x.titulo, 'quando', x.quando, 'status', x.status, 'erro', x.erro, 'autor', x.autor_nome,
                            'urls', to_jsonb(x.urls), 'legenda', x.legenda, 'media_id', x.media_id)
$$;

/**
 * Registra uma publicação no Instagram: já feita agora (com o número do post) ou agendada para depois. As imagens
 * precisam estar no depósito público de publicações, na pasta de quem publica.
 */
create or replace function public.design_publicacao_registrar(p jsonb) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare
  v uuid := interno.eu();
  v_nome text;
  v_urls text[];
  v_quando timestamptz := coalesce((p ->> 'quando')::timestamptz, now());
  v_status text := coalesce(p ->> 'status', 'agendada');
  x design_publicacoes;
begin
  if not interno.design_publica() then perform interno.erro('sem_permissao'); end if;
  perform interno.limite('design_publicar', 30, 60);
  select array_agg(u) into v_urls from jsonb_array_elements_text(coalesce(p -> 'urls', '[]'::jsonb)) u;
  if v_urls is null or cardinality(v_urls) not between 1 and 10 then perform interno.erro('invalido:urls'); end if;
  if exists (select 1 from unnest(v_urls) u where u !~ ('^https?://[^/]+/storage/v1/object/public/estudio-publicacoes/' || v::text || '/[a-z0-9]+\.jpg$')) then perform interno.erro('invalido:urls'); end if;
  if v_status not in ('agendada', 'publicada') then perform interno.erro('invalido:status'); end if;
  if v_status = 'agendada' and (v_quando < now() + interval '5 minutes' or v_quando > now() + interval '90 days') then perform interno.erro('invalido:quando'); end if;
  select nome into v_nome from perfis where id = v;
  insert into design_publicacoes (design, autor, autor_nome, titulo, urls, legenda, quando, status, media_id)
  values (case when p ->> 'design' ~ '^[0-9a-f-]{36}$' and exists (select 1 from designs where id = (p ->> 'design')::uuid) then (p ->> 'design')::uuid end,
          v, coalesce(v_nome, ''), interno.txt(coalesce(p ->> 'titulo', ''), 'titulo', 0, 120), v_urls, interno.txt(coalesce(p ->> 'legenda', ''), 'legenda', 1, 2200),
          case when v_status = 'publicada' then now() else v_quando end, v_status, interno.txt(coalesce(p ->> 'media_id', ''), 'media_id', 0, 80))
  returning * into x;
  return interno.design_publicacao_json(x);
end $$;

create or replace function public.design_publicacoes() returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
begin
  perform interno.eu();
  if not interno.desenha() then perform interno.erro('sem_permissao'); end if;
  return coalesce((select jsonb_agg(interno.design_publicacao_json(x) order by x.quando desc) from (select * from design_publicacoes order by quando desc limit 50) x), '[]'::jsonb);
end $$;

create or replace function public.design_publicacao_cancelar(p_id uuid) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); x design_publicacoes;
begin
  select * into x from design_publicacoes where id = p_id and status = 'agendada' for update;
  if not found then perform interno.erro('nao_encontrado'); end if;
  if not (x.autor = v or interno.coord()) then perform interno.erro('sem_permissao'); end if;
  update design_publicacoes set status = 'cancelada' where id = p_id returning * into x;
  return interno.design_publicacao_json(x);
end $$;

/** A chave da tarefa automática confere com a guardada em interno.segredos (nome 'cron', 24 caracteres ou mais). */
create or replace function interno.design_chave_ok(p_chave text) returns boolean language sql stable security definer set search_path = interno, pg_temp as $$
  select exists (select 1 from segredos where nome = 'cron' and char_length(valor) >= 24 and valor = coalesce(p_chave, ''))
$$;

/** Para a tarefa automática: as publicações agendadas que já venceram (marcadas como "publicando", para não repetir). */
create or replace function public.design_publicacoes_vencidas(p_chave text) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v jsonb;
begin
  if not interno.design_chave_ok(p_chave) then perform interno.erro('sem_permissao'); end if;
  -- Ficou presa em "publicando" (a tarefa caiu no meio)? Volta para a fila depois de 30 minutos.
  update design_publicacoes set status = 'agendada' where status = 'publicando' and quando < now() - interval '30 minutes';
  with vencidas as (
    update design_publicacoes set status = 'publicando'
    where id in (select id from design_publicacoes where status = 'agendada' and quando <= now() order by quando limit 5 for update skip locked)
    returning *
  )
  select coalesce(jsonb_agg(interno.design_publicacao_json(x)), '[]'::jsonb) into v from vencidas x;
  return v;
end $$;

create or replace function public.design_publicacao_marcar(p_chave text, p_id uuid, p_status text, p_erro text default '', p_media_id text default '') returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare x design_publicacoes;
begin
  if not interno.design_chave_ok(p_chave) then perform interno.erro('sem_permissao'); end if;
  if p_status not in ('publicada', 'falhou') then perform interno.erro('invalido:status'); end if;
  update design_publicacoes set status = p_status, erro = left(coalesce(p_erro, ''), 500), media_id = left(coalesce(p_media_id, ''), 80)
  where id = p_id and status = 'publicando' returning * into x;
  if not found then perform interno.erro('nao_encontrado'); end if;
  if p_status = 'publicada' and x.design is not null then update designs set status = 'publicado', publicado_em = coalesce(publicado_em, now()) where id = x.design; end if;
  return interno.design_publicacao_json(x);
end $$;

-- As funções desta parte: as de "public" abertas pela API (cada uma confere quem chama), as de "interno" fechadas.
do $$
declare f record;
begin
  for f in select p.oid::regprocedure as assinatura, n.nspname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
           where p.prokind = 'f' and n.nspname in ('public', 'interno')
             and (p.proname like 'aviso_geral%' or p.proname like 'avisos_gerais%' or p.proname like 'rascunho%' or p.proname like 'aula_ao_vivo%'
                  or p.proname like 'aulas_ao_vivo%' or p.proname like 'aula_chat%' or p.proname like 'design_%' or p.proname like 'designs_%'
                  or p.proname in ('supervisiona', 'aviso_para_mim', 'educador', 'conduz', 'aula_json', 'chat_aula_json', 'desenha')) loop
    execute format('revoke all on function %s from public', f.assinatura);
    if f.nspname = 'public' then
      execute format('grant execute on function %s to anon, authenticated, service_role', f.assinatura);
    elsif exists (select 1 from pg_roles where rolname = 'anon') then
      execute format('revoke all on function %s from anon, authenticated', f.assinatura);
    end if;
  end loop;
end $$;

-- O depósito público das publicações no Instagram: o Instagram baixa a imagem pelo endereço público. Só a coordenação
-- e o marketing enviam, cada um na própria pasta; ninguém lista o depósito (só abre quem tem o endereço exato).
do $$
begin
  if exists (select 1 from pg_namespace where nspname = 'storage') then
    insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    values ('estudio-publicacoes', 'estudio-publicacoes', true, 8388608, array['image/jpeg'])
    on conflict (id) do update set public = true, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;
    execute 'drop policy if exists "estudio_publicacoes_envio" on storage.objects';
    execute 'create policy "estudio_publicacoes_envio" on storage.objects for insert to authenticated with check (bucket_id = ''estudio-publicacoes'' and interno.design_publica() and (storage.foldername(name))[1] = auth.uid()::text)';
    execute 'drop policy if exists "estudio_publicacoes_remocao" on storage.objects';
    execute 'create policy "estudio_publicacoes_remocao" on storage.objects for delete to authenticated using (bucket_id = ''estudio-publicacoes'' and ((storage.foldername(name))[1] = auth.uid()::text or interno.coord()))';
    execute 'grant execute on function interno.design_publica() to authenticated';
    execute 'grant execute on function interno.tem(text, text) to authenticated';
    execute 'grant execute on function interno.coord() to authenticated';
  end if;
end $$;

-- ───────────────────────────── Cargos: histórico de quem confiou e quem tirou ─────────────────────────────
--
-- Cada papel confiado vira uma linha aqui, com quem confiou e quando; quando o papel é retirado, a mesma linha ganha quem
-- tirou e quando. Nada é apagado nem editado pelo painel. Os papéis que já existiam entram uma vez, na instalação, como
-- "migração" (foram confiados antes de o histórico existir); rodar o arquivo de novo não duplica nada.
create table if not exists interno.papeis_historico (
  id bigint generated always as identity primary key,
  papel_id uuid,
  usuario uuid not null,
  papel text not null,
  disciplina text,
  concedido_por uuid,
  concedido_em timestamptz not null default now(),
  removido_por uuid,
  removido_em timestamptz,
  -- Por onde entrou: 'authenticated' (painel), 'service_role', 'banco' (SQL Editor), 'sistema' (sucessão automática) ou 'migracao'.
  via text not null default ''
);
create index if not exists papeis_historico_usuario on interno.papeis_historico (usuario, concedido_em desc);
create unique index if not exists papeis_historico_aberto on interno.papeis_historico (papel_id) where removido_em is null and papel_id is not null;
alter table interno.papeis_historico enable row level security;
revoke all on interno.papeis_historico from public;

create or replace function interno.papeis_historico_gatilho() returns trigger language plpgsql security definer set search_path = interno, pg_temp as $$
declare
  v_sistema boolean := coalesce(current_setting('lucia.sistema', true), '') = '1';
  v_quem uuid := case when v_sistema then null else auth.uid() end;
  v_via text := case when v_sistema then 'sistema' else coalesce(nullif(interno.claims() ->> 'role', ''), 'banco') end;
begin
  if tg_op = 'INSERT' then
    insert into papeis_historico (papel_id, usuario, papel, disciplina, concedido_por, concedido_em, via)
    values (new.id, new.usuario, new.papel, new.disciplina, coalesce(new.concedido_por, v_quem), new.criado_em, v_via)
    on conflict do nothing;
  else
    update papeis_historico set removido_por = v_quem, removido_em = now() where papel_id = old.id and removido_em is null;
    if not found then
      insert into papeis_historico (papel_id, usuario, papel, disciplina, concedido_por, concedido_em, removido_por, removido_em, via)
      values (old.id, old.usuario, old.papel, old.disciplina, old.concedido_por, old.criado_em, v_quem, now(), v_via);
    end if;
  end if;
  return null;
end $$;
drop trigger if exists lucia_papeis_historico on interno.papeis;
create trigger lucia_papeis_historico after insert or delete on interno.papeis for each row execute function interno.papeis_historico_gatilho();

-- Migração dos papéis já existentes: cada um entra no histórico uma vez, sem perder ninguém.
insert into interno.papeis_historico (papel_id, usuario, papel, disciplina, concedido_por, concedido_em, via)
select p.id, p.usuario, p.papel, p.disciplina, p.concedido_por, p.criado_em, 'migracao' from interno.papeis p
where not exists (select 1 from interno.papeis_historico h where h.papel_id = p.id);

/** O histórico de cargos de uma pessoa (ou de todos, sem p_usuario): quem confiou, quando, quem tirou, quando. Coordenação e vice. */
create or replace function public.papeis_historico_listar(p_usuario uuid default null, p_pagina integer default 0) returns jsonb
language plpgsql security definer set search_path = interno, pg_temp as $$
begin
  perform interno.eu();
  if not interno.coord() then perform interno.erro('sem_permissao'); end if;
  return (
    select coalesce(jsonb_agg(jsonb_build_object(
      'id', h.id, 'usuario', h.usuario, 'nome', coalesce(f.nome, ''), 'papel', h.papel, 'disciplina', h.disciplina,
      'concedido_por', coalesce(c.nome, case when h.via in ('banco', 'sistema', 'migracao') then h.via else '' end), 'concedido_em', h.concedido_em,
      'removido_por', case when h.removido_em is null then null else coalesce(r.nome, 'banco') end, 'removido_em', h.removido_em, 'via', h.via) order by h.id desc), '[]'::jsonb)
    from (select * from papeis_historico where p_usuario is null or usuario = p_usuario order by id desc limit 100 offset greatest(coalesce(p_pagina, 0), 0) * 100) h
    left join perfis f on f.id = h.usuario left join perfis c on c.id = h.concedido_por left join perfis r on r.id = h.removido_por);
end $$;

revoke all on function interno.papeis_historico_gatilho() from public, anon, authenticated;
revoke all on function public.papeis_historico_listar(uuid, integer) from public;
grant execute on function public.papeis_historico_listar(uuid, integer) to anon, authenticated, service_role;


-- ───────────────────────────── Minha conta: recuperação, meus dados, atividade, avisos por e-mail, sessões ─────────────────────────────

-- Códigos de recuperação do segundo fator: dez, de uso único, mostrados uma vez só. Aqui fica só o resumo (hash).
create table if not exists interno.codigos_recuperacao (
  usuario uuid not null references interno.perfis (id) on delete cascade,
  hash text not null check (hash ~ '^[a-f0-9]{64}$'),
  usado_em timestamptz,
  criado_em timestamptz not null default now(),
  primary key (usuario, hash)
);
alter table interno.codigos_recuperacao enable row level security;

create or replace function interno.codigo_hash(p text) returns text language sql immutable as $$
  select encode(sha256(convert_to('lucia:recuperacao:' || upper(regexp_replace(coalesce(p, ''), '[^0-9A-Fa-f]', '', 'g')), 'UTF8')), 'hex')
$$;

/** Gera dez códigos novos (os antigos deixam de valer). Só com o segundo fator confirmado nesta sessão. */
create or replace function public.conta_codigos_gerar() returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); v_codigos text[] := '{}'; v_c text;
begin
  perform interno.limite('codigos_gerar', 5, 60);
  if not interno.tem_fator() then perform interno.erro('sem_segundo_fator'); end if;
  if not interno.aal2() then perform interno.erro('confirme_segundo_fator'); end if;
  delete from codigos_recuperacao where usuario = v;
  for i in 1..10 loop
    v_c := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 5) || '-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 5));
    insert into codigos_recuperacao (usuario, hash) values (v, interno.codigo_hash(v_c));
    v_codigos := v_codigos || v_c;
  end loop;
  perform interno.registrar('codigos_recuperacao_gerados', v::text, '{}'::jsonb);
  return jsonb_build_object('codigos', to_jsonb(v_codigos));
end $$;

/** Situação da proteção: segundo fator (desde quando), códigos que restam. */
create or replace function public.conta_protecao() returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); v_desde timestamptz;
begin
  if to_regclass('auth.mfa_factors') is not null then
    begin
      execute 'select min(created_at) from auth.mfa_factors where user_id = $1 and status = ''verified''' into v_desde using v;
    exception when undefined_column then v_desde := null;
    end;
  end if;
  return jsonb_build_object(
    'segundo_fator', interno.tem_fator(), 'segundo_fator_desde', v_desde,
    'codigos_restantes', (select count(*) from codigos_recuperacao where usuario = v and usado_em is null),
    'codigos_gerados_em', (select max(criado_em) from codigos_recuperacao where usuario = v),
    'sessao_dias', coalesce((select (valor ->> 'sessao_dias')::int from configuracoes where chave = 'seguranca'), 60));
end $$;

/**
 * Perdeu o celular do aplicativo autenticador: com a senha (sessão aal1) e um código de recuperação, o aplicativo é
 * tirado da conta e a pessoa cadastra outro. Cinco tentativas por hora; a pessoa e a coordenação recebem aviso.
 * Código errado não é erro (devolve ok: false): um erro desfaria também a contagem de tentativas, e o limite não valeria.
 */
create or replace function public.conta_codigo_usar(p_codigo text) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); v_nome text;
begin
  perform interno.limite('codigo_recuperacao', 5, 60);
  update codigos_recuperacao set usado_em = now() where usuario = v and hash = interno.codigo_hash(p_codigo) and usado_em is null;
  if not found then
    perform interno.registrar('codigo_recuperacao_errado', v::text, '{}'::jsonb);
    return jsonb_build_object('ok', false, 'motivo', 'codigo_invalido');
  end if;
  if to_regclass('auth.mfa_factors') is not null then execute 'delete from auth.mfa_factors where user_id = $1' using v; end if;
  select nome into v_nome from perfis where id = v;
  perform interno.registrar('segundo_fator_recuperado', v::text, '{}'::jsonb);
  perform interno.avisar(v, 'Um código de recuperação foi usado e o aplicativo autenticador saiu da sua conta. Cadastre outro em Minha conta. Se não foi você, troque a senha agora e avise a coordenação.');
  if exists (select 1 from papeis where usuario = v) then
    perform interno.avisar_lideranca(coalesce(v_nome, 'Alguém da equipe') || ' usou um código de recuperação para tirar o aplicativo autenticador da conta.', v);
  end if;
  return jsonb_build_object('ok', true, 'restantes', (select count(*) from codigos_recuperacao where usuario = v and usado_em is null));
end $$;

/** O painel anota no registro o que acontece na conta e que o banco não vê sozinho (troca de senha, chave de acesso…). */
create or replace function public.conta_evento(p_acao text) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu();
begin
  perform interno.limite('conta_evento', 30, 60);
  if p_acao not in ('senha_trocada', 'segundo_fator_ativado', 'segundo_fator_removido', 'chave_acesso_cadastrada', 'chave_acesso_removida', 'saiu_dos_outros', 'meus_dados_baixados') then
    perform interno.erro('invalido:acao');
  end if;
  perform interno.registrar(p_acao, v::text, '{}'::jsonb);
  return jsonb_build_object('ok', true);
end $$;

/** Os últimos acontecimentos da conta: o que o registro do painel anotou e as entradas que o serviço de contas guardou. */
create or replace function public.conta_atividade() returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); v_auth jsonb := '[]'::jsonb;
begin
  if to_regclass('auth.audit_log_entries') is not null then
    execute $q$
      select coalesce(jsonb_agg(jsonb_build_object('acao', 'auth:' || coalesce(a.payload ->> 'action', ''), 'quando', a.created_at, 'ip', coalesce(a.ip_address, '')) order by a.created_at desc), '[]'::jsonb)
      from (select * from auth.audit_log_entries where payload ->> 'actor_id' = $1::text
              and coalesce(payload ->> 'action', '') not in ('token_refreshed', 'token_revoked')
            order by created_at desc limit 40) a
    $q$ into v_auth using v;
  end if;
  return (
    select coalesce(jsonb_agg(x order by (x ->> 'quando') desc), '[]'::jsonb) from (
      select jsonb_build_object('acao', a.acao, 'quando', a.criado_em, 'ip', '') as x
      from (select * from auditoria where (quem = v or alvo = v::text)
              and acao in ('aparelho_novo', 'segundo_fator_recuperado', 'codigo_recuperacao_errado', 'codigos_recuperacao_gerados', 'senha_trocada', 'segundo_fator_ativado', 'segundo_fator_removido',
                           'chave_acesso_cadastrada', 'chave_acesso_removida', 'saiu_dos_outros', 'meus_dados_baixados', 'emails_preferencias', 'termo_voluntario', 'papel_concedido', 'papel_removido', 'senha_redefinida')
            order by criado_em desc limit 60) a
      union all
      select e from jsonb_array_elements(v_auth) e
    ) t
  );
end $$;

/**
 * Tudo o que o painel guarda sobre a pessoa (LGPD, art. 18): perfil, funções, aparelhos, recados e cada linha das tabelas
 * em que ela aparece como autora ou dona. Conversas cifradas saem cifradas (só os aparelhos da pessoa as abrem).
 */
create or replace function public.conta_meus_dados() returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); v_saida jsonb; v_dados jsonb; r record;
begin
  perform interno.limite('meus_dados', 3, 60);
  v_saida := jsonb_build_object(
    'gerado_em', now(),
    'conta', jsonb_build_object('id', v, 'email', interno.email_da_conta(v)),
    'perfil', (select to_jsonb(p) - 'avatar' from perfis p where p.id = v));
  for r in
    select c.table_name, c.column_name from information_schema.columns c
    where c.table_schema = 'interno' and c.data_type = 'uuid' and c.column_name in ('autor', 'usuario', 'quem', 'para', 'criado_por', 'pessoa', 'responsavel')
      and c.table_name not in ('codigos_recuperacao', 'limites', 'perfis')
    order by c.table_name, c.column_name
  loop
    execute format('select coalesce(jsonb_agg(to_jsonb(t)), ''[]''::jsonb) from (select * from interno.%I where %I = $1 limit 1000) t', r.table_name, r.column_name) into v_dados using v;
    if v_dados <> '[]'::jsonb then v_saida := v_saida || jsonb_build_object(r.table_name || '.' || r.column_name, v_dados); end if;
  end loop;
  perform interno.registrar('meus_dados_baixados', v::text, '{}'::jsonb);
  return v_saida;
end $$;

/** Os avisos por e-mail que a pessoa pode desligar (os de segurança e os convites sempre chegam). */
create or replace function interno.emails_opcionais() returns text[] language sql immutable as $$
  select array['aviso_equipe', 'inscricao_nova', 'certificado_pedido', 'chat_mensagem']
$$;

create or replace function public.conta_emails() returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu();
begin
  return jsonb_build_object('opcoes', to_jsonb(interno.emails_opcionais()), 'desligados', (select to_jsonb(emails_desligados) from perfis where id = v));
end $$;

create or replace function public.conta_emails_salvar(p_desligados text[]) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); v_lista text[];
begin
  select coalesce(array_agg(distinct x), '{}') into v_lista from unnest(coalesce(p_desligados, '{}')) x where x = any(interno.emails_opcionais());
  update perfis set emails_desligados = v_lista where id = v;
  perform interno.registrar('emails_preferencias', v::text, jsonb_build_object('desligados', to_jsonb(v_lista)));
  return public.conta_emails();
end $$;

/**
 * Sessões paradas há mais que o prazo (padrão 60 dias; a coordenação muda em Controles do site) vencem: o aparelho
 * precisa entrar de novo. Aparelhos sem uso no mesmo prazo saem da lista.
 */
create or replace function interno.vencer_sessoes() returns integer language plpgsql security definer set search_path = interno, pg_temp as $$
declare v_dias int := coalesce((select (valor ->> 'sessao_dias')::int from configuracoes where chave = 'seguranca'), 60); v_n int := 0;
begin
  if v_dias < 1 then return 0; end if;
  if to_regclass('auth.sessions') is not null then
    execute format('delete from auth.sessions where coalesce(updated_at, created_at) < now() - interval ''%s days''', v_dias);
    get diagnostics v_n = row_count;
  end if;
  delete from aparelhos where ultimo < now() - make_interval(days => v_dias);
  return v_n;
end $$;

/** O prazo das sessões, em dias (7 a 365). Coordenação, com o segundo fator. */
create or replace function public.seguranca_sessoes(p_dias integer) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
begin
  perform interno.eu();
  if not interno.lider() then perform interno.erro('sem_permissao'); end if;
  if coalesce(p_dias, 0) not between 7 and 365 then perform interno.erro('invalido:dias'); end if;
  insert into configuracoes (chave, valor) values ('seguranca', jsonb_build_object('sessao_dias', p_dias))
  on conflict (chave) do update set valor = configuracoes.valor || excluded.valor;
  perform interno.registrar('seguranca_sessoes', '', jsonb_build_object('dias', p_dias));
  return jsonb_build_object('sessao_dias', p_dias);
end $$;

revoke all on function interno.codigo_hash(text) from public, anon, authenticated;
revoke all on function interno.emails_opcionais() from public, anon, authenticated;
revoke all on function interno.vencer_sessoes() from public, anon, authenticated;
do $$
declare f text;
begin
  foreach f in array array['conta_codigos_gerar()', 'conta_protecao()', 'conta_codigo_usar(text)', 'conta_evento(text)', 'conta_atividade()', 'conta_meus_dados()', 'conta_emails()', 'conta_emails_salvar(text[])', 'seguranca_sessoes(integer)'] loop
    execute format('revoke all on function public.%s from public', f);
    execute format('grant execute on function public.%s to anon, authenticated, service_role', f);
  end loop;
end $$;


-- ───────────────────────────── Boletim: edições por blocos, rascunhos, histórico, teste ─────────────────────────────

-- Cada edição: assunto, texto de pré-visualização, os blocos (título, parágrafo, imagem, botão, matéria, acervo) e a
-- versão em texto. Rascunho até ser enviada; enviada fica no histórico com a data, quem enviou e para quantos.
create table if not exists interno.boletim_edicoes (
  id uuid primary key default gen_random_uuid(),
  assunto text not null default '' check (char_length(assunto) <= 150),
  preheader text not null default '' check (char_length(preheader) <= 140),
  blocos jsonb not null default '[]'::jsonb check (jsonb_typeof(blocos) = 'array'),
  texto text not null default '' check (char_length(texto) <= 15000),
  status text not null default 'rascunho' check (status in ('rascunho', 'enviada')),
  autor uuid references interno.perfis (id) on delete set null,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  enviada_em timestamptz,
  enviada_por uuid references interno.perfis (id) on delete set null,
  destinatarios integer not null default 0
);
alter table interno.boletim_edicoes enable row level security;
alter table interno.emails add column if not exists edicao uuid references interno.boletim_edicoes (id) on delete set null;

/** Confere os blocos de uma edição: até 40, só os tipos conhecidos, textos com tamanho, endereços https ou do próprio site. */
create or replace function interno.boletim_blocos(p jsonb) returns jsonb language plpgsql immutable as $$
declare b jsonb; v_saida jsonb := '[]'::jsonb; v_url text;
begin
  if p is null or jsonb_typeof(p) <> 'array' then return '[]'::jsonb; end if;
  if jsonb_array_length(p) > 40 then perform interno.erro('invalido:blocos'); end if;
  for b in select * from jsonb_array_elements(p) loop
    if jsonb_typeof(b) <> 'object' or coalesce(b ->> 'tipo', '') not in ('titulo', 'paragrafo', 'imagem', 'botao', 'materia', 'acervo') then perform interno.erro('invalido:blocos'); end if;
    v_url := coalesce(b ->> 'url', '');
    if v_url <> '' and v_url !~ '^(https://[^[:space:]"''<>]+|/[A-Za-z0-9/._~%?=&#-]*)$' then perform interno.erro('invalido:url'); end if;
    if b ->> 'tipo' = 'imagem' and coalesce(b ->> 'src', '') !~ '^/(arquivos|imagens)/[A-Za-z0-9/._-]+$' then perform interno.erro('invalido:imagem'); end if;
    if b ->> 'tipo' = 'imagem' and char_length(btrim(coalesce(b ->> 'alt', ''))) < 3 then perform interno.erro('invalido:descricao'); end if;
    if char_length(coalesce(b ->> 'texto', '')) > 6000 or char_length(coalesce(b ->> 'titulo', '')) > 200 or char_length(coalesce(b ->> 'resumo', '')) > 600
       or char_length(coalesce(b ->> 'alt', '')) > 300 or char_length(coalesce(b ->> 'legenda', '')) > 300 or char_length(coalesce(b ->> 'autor', '')) > 160 then
      perform interno.erro('invalido:blocos');
    end if;
    v_saida := v_saida || jsonb_build_array(jsonb_strip_nulls(jsonb_build_object('tipo', b ->> 'tipo', 'texto', b ->> 'texto', 'titulo', b ->> 'titulo', 'resumo', b ->> 'resumo',
      'autor', b ->> 'autor', 'url', nullif(v_url, ''), 'src', b ->> 'src', 'alt', b ->> 'alt', 'legenda', b ->> 'legenda')));
  end loop;
  return v_saida;
end $$;

create or replace function interno.pode_boletim() returns boolean language sql stable security definer set search_path = interno, pg_temp as $$
  select interno.coord() or interno.tem('jornalismo')
$$;

/** Guarda (cria ou atualiza) o rascunho de uma edição. Edição enviada não muda mais. */
create or replace function public.boletim_edicao_salvar(p_id uuid, p_assunto text, p_preheader text, p_blocos jsonb, p_texto text) returns jsonb
language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); v_id uuid := p_id; v_blocos jsonb := interno.boletim_blocos(p_blocos);
begin
  if not interno.pode_boletim() then perform interno.erro('sem_permissao'); end if;
  perform interno.limite('boletim_rascunho', 120, 60);
  if v_id is null then
    insert into boletim_edicoes (assunto, preheader, blocos, texto, autor) values (left(coalesce(p_assunto, ''), 150), left(coalesce(p_preheader, ''), 140), v_blocos, left(coalesce(p_texto, ''), 15000), v)
    returning id into v_id;
  else
    update boletim_edicoes set assunto = left(coalesce(p_assunto, ''), 150), preheader = left(coalesce(p_preheader, ''), 140), blocos = v_blocos, texto = left(coalesce(p_texto, ''), 15000), atualizado_em = now()
    where id = v_id and status = 'rascunho';
    if not found then perform interno.erro('nao_encontrado'); end if;
  end if;
  return jsonb_build_object('id', v_id, 'salvo_em', now());
end $$;

/** Rascunhos e edições enviadas, com quem escreveu, quem enviou e para quantos. */
create or replace function public.boletim_edicoes_listar() returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
begin
  perform interno.eu();
  if not interno.pode_boletim() then perform interno.erro('sem_permissao'); end if;
  return (select coalesce(jsonb_agg(jsonb_build_object('id', e.id, 'assunto', e.assunto, 'preheader', e.preheader, 'blocos', e.blocos, 'texto', e.texto, 'status', e.status,
            'autor', interno.nome_visto(a.nome), 'criado_em', e.criado_em, 'atualizado_em', e.atualizado_em, 'enviada_em', e.enviada_em,
            'enviada_por', interno.nome_visto(p.nome), 'destinatarios', e.destinatarios) order by coalesce(e.enviada_em, e.atualizado_em) desc), '[]'::jsonb)
          from (select * from boletim_edicoes order by coalesce(enviada_em, atualizado_em) desc limit 100) e
          left join perfis a on a.id = e.autor left join perfis p on p.id = e.enviada_por);
end $$;

create or replace function public.boletim_edicao_apagar(p_id uuid) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
begin
  perform interno.eu();
  if not interno.pode_boletim() then perform interno.erro('sem_permissao'); end if;
  delete from boletim_edicoes where id = p_id and status = 'rascunho';
  if not found then perform interno.erro('nao_encontrado'); end if;
  return jsonb_build_object('ok', true);
end $$;

/** "Enviar teste para mim": a edição vai só para o e-mail de quem pediu, não conta no limite de seis horas e não vai à lista. */
create or replace function public.boletim_testar(p_id uuid) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); e boletim_edicoes; v_email text := interno.email_da_conta(v);
begin
  if not interno.pode_boletim() then perform interno.erro('sem_permissao'); end if;
  perform interno.limite('boletim_teste', 10, 60);
  select * into e from boletim_edicoes where id = p_id;
  if not found then perform interno.erro('nao_encontrado'); end if;
  if char_length(btrim(e.assunto)) < 5 or char_length(btrim(e.texto)) < 20 then perform interno.erro('invalido:edicao'); end if;
  if lower(coalesce(v_email, '')) !~ '^[^@[:space:]]+@[^@[:space:]]+[.][^@[:space:]]+$' then perform interno.erro('sem_email'); end if;
  insert into emails (para, tipo, assunto, texto, sair, edicao)
  values (lower(v_email), 'boletim_teste', left('[Teste] ' || e.assunto, 200),
          e.texto || E'\n\n---\nEste é um envio de teste: só você recebeu. Para sair da lista (nos envios de verdade): ' || interno.endereco() || '/pt/jornal',
          interno.endereco() || '/pt/jornal', e.id);
  return jsonb_build_object('ok', true, 'para', regexp_replace(lower(v_email), '^(.).*(@.*)$', '\1…\2'));
end $$;

/**
 * Envia a edição para todos os endereços confirmados que não estão pausados, cada um com o próprio link de saída. No máximo
 * uma edição a cada seis horas. A edição vai para o histórico com a data, quem enviou e para quantos.
 */
create or replace function public.boletim_edicao_enviar(p_id uuid) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); e boletim_edicoes; v_total integer := 0; r record; v_sair text;
begin
  if not interno.pode_boletim() then perform interno.erro('sem_permissao'); end if;
  select * into e from boletim_edicoes where id = p_id for update;
  if not found or e.status <> 'rascunho' then perform interno.erro('nao_encontrado'); end if;
  if char_length(btrim(e.assunto)) < 5 or char_length(btrim(e.texto)) < 50 then perform interno.erro('invalido:edicao'); end if;
  if exists (select 1 from emails where tipo = 'boletim' and criado_em > now() - interval '6 hours') then perform interno.erro('boletim_recente'); end if;
  for r in select email, codigo from boletim where confirmado and not pausado loop
    v_sair := interno.endereco() || '/pt/jornal?boletim=sair&codigo=' || r.codigo;
    if (select count(*) from emails where para = r.email and tipo = 'boletim' and criado_em > now() - interval '1 day') < 2 then
      insert into emails (para, tipo, assunto, texto, sair, edicao)
      values (r.email, 'boletim', e.assunto, e.texto || E'\n\n---\nVocê recebe este boletim porque pediu no site do Instituto Lúcia. Para sair da lista: ' || v_sair, v_sair, e.id);
      v_total := v_total + 1;
    end if;
  end loop;
  update boletim_edicoes set status = 'enviada', enviada_em = now(), enviada_por = v, destinatarios = v_total where id = e.id;
  perform interno.registrar('boletim_enviado', e.assunto, jsonb_build_object('emails', v_total, 'edicao', e.id));
  return jsonb_build_object('emails', v_total);
end $$;

/** Endereço pausado por falhas volta a receber (por exemplo, a caixa encheu e já foi esvaziada). */
create or replace function public.boletim_reativar(p_email text) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
begin
  perform interno.eu();
  if not interno.pode_boletim() then perform interno.erro('sem_permissao'); end if;
  update boletim set pausado = false, falhas = 0 where email = lower(btrim(coalesce(p_email, '')));
  if not found then perform interno.erro('nao_encontrado'); end if;
  return jsonb_build_object('ok', true);
end $$;

revoke all on function interno.boletim_blocos(jsonb) from public, anon, authenticated;
revoke all on function interno.pode_boletim() from public, anon, authenticated;
do $$
declare f text;
begin
  foreach f in array array['boletim_edicao_salvar(uuid, text, text, jsonb, text)', 'boletim_edicoes_listar()', 'boletim_edicao_apagar(uuid)', 'boletim_testar(uuid)', 'boletim_edicao_enviar(uuid)', 'boletim_reativar(text)'] loop
    execute format('revoke all on function public.%s from public', f);
    execute format('grant execute on function public.%s to anon, authenticated, service_role', f);
  end loop;
end $$;


-- ───────────────────────────── Divulgação: registro de quem tem acesso ao Instagram ─────────────────────────────

-- O site não guarda senha de rede social: o acesso é dado na Central de Contas da Meta. Aqui fica só o registro de quem foi
-- convidado e quando, para ninguém esquecer de tirar o acesso de quem saiu da equipe.
create table if not exists interno.instagram_acessos (
  id uuid primary key default gen_random_uuid(),
  pessoa uuid references interno.perfis (id) on delete set null,
  nome text not null check (char_length(nome) between 2 and 120),
  conta text not null default '' check (conta = '' or conta ~ '^@?[A-Za-z0-9_.]{1,30}$'),
  permissoes text not null default '' check (char_length(permissoes) <= 300),
  situacao text not null default 'convidado' check (situacao in ('convidado', 'ativo', 'removido')),
  convidado_em date not null default current_date,
  removido_em date,
  nota text not null default '' check (char_length(nota) <= 500),
  registrado_por uuid references interno.perfis (id) on delete set null,
  atualizado_em timestamptz not null default now()
);
alter table interno.instagram_acessos enable row level security;

create or replace function public.instagram_acessos_listar() returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
begin
  perform interno.eu();
  if not (interno.coord() or interno.tem('supervisao')) then perform interno.erro('sem_permissao'); end if;
  return (select coalesce(jsonb_agg(jsonb_build_object('id', a.id, 'pessoa', a.pessoa, 'nome', a.nome, 'conta', a.conta, 'permissoes', a.permissoes, 'situacao', a.situacao,
            'convidado_em', a.convidado_em, 'removido_em', a.removido_em, 'nota', a.nota, 'atualizado_em', a.atualizado_em,
            'na_equipe', a.pessoa is not null and exists (select 1 from papeis p join perfis f on f.id = p.usuario where p.usuario = a.pessoa and not f.suspenso))
          order by (a.situacao = 'removido'), a.convidado_em desc), '[]'::jsonb) from instagram_acessos a);
end $$;

/** A coordenação registra (ou corrige) um convite ou acesso. "removido" pede a data em que o acesso saiu. */
create or replace function public.instagram_acesso_salvar(p jsonb) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); v_id uuid; v_pessoa uuid; v_situacao text := coalesce(nullif(p ->> 'situacao', ''), 'convidado'); v_conv date; v_rem date;
begin
  if not interno.coord() then perform interno.erro('sem_permissao'); end if;
  begin
    v_id := nullif(p ->> 'id', '')::uuid;
    v_pessoa := nullif(p ->> 'pessoa', '')::uuid;
    v_conv := coalesce(nullif(p ->> 'convidado_em', '')::date, current_date);
    v_rem := nullif(p ->> 'removido_em', '')::date;
  exception when others then
    perform interno.erro('invalido:dados');
  end;
  if v_situacao not in ('convidado', 'ativo', 'removido') then perform interno.erro('invalido:situacao'); end if;
  if v_situacao = 'removido' then v_rem := coalesce(v_rem, current_date); else v_rem := null; end if;
  if v_id is null then
    insert into instagram_acessos (pessoa, nome, conta, permissoes, situacao, convidado_em, removido_em, nota, registrado_por)
    values (v_pessoa, interno.txt(p ->> 'nome', 'nome', 2, 120), btrim(coalesce(p ->> 'conta', '')), interno.txt(p ->> 'permissoes', 'permissoes', 0, 300), v_situacao, v_conv, v_rem,
            interno.txt(p ->> 'nota', 'nota', 0, 500), v)
    returning id into v_id;
  else
    update instagram_acessos set pessoa = v_pessoa, nome = interno.txt(p ->> 'nome', 'nome', 2, 120), conta = btrim(coalesce(p ->> 'conta', '')), permissoes = interno.txt(p ->> 'permissoes', 'permissoes', 0, 300),
      situacao = v_situacao, convidado_em = v_conv, removido_em = v_rem, nota = interno.txt(p ->> 'nota', 'nota', 0, 500), registrado_por = v, atualizado_em = now()
    where id = v_id;
    if not found then perform interno.erro('nao_encontrado'); end if;
  end if;
  perform interno.registrar('instagram_acesso', coalesce(p ->> 'nome', ''), jsonb_build_object('situacao', v_situacao));
  return jsonb_build_object('id', v_id);
end $$;

/** Quem sai do painel (perde a última função) e ainda tem acesso ao Instagram: a coordenação recebe o lembrete. */
create or replace function interno.instagram_lembrete_gatilho() returns trigger language plpgsql security definer set search_path = interno, pg_temp as $$
declare v_nome text;
begin
  if exists (select 1 from instagram_acessos where pessoa = old.usuario and situacao <> 'removido')
     and not exists (select 1 from papeis where usuario = old.usuario and id <> old.id) then
    select nome into v_nome from instagram_acessos where pessoa = old.usuario and situacao <> 'removido' limit 1;
    perform interno.avisar_lideranca(coalesce(v_nome, 'Alguém') || ' saiu do painel e ainda aparece com acesso ao Instagram do instituto. Tire o acesso na Central de Contas da Meta e marque como removido em Divulgação → Acesso ao Instagram.');
  end if;
  return old;
end $$;
drop trigger if exists lucia_instagram_lembrete on interno.papeis;
create trigger lucia_instagram_lembrete after delete on interno.papeis for each row execute function interno.instagram_lembrete_gatilho();

revoke all on function interno.instagram_lembrete_gatilho() from public, anon, authenticated;
revoke all on function interno.aprova_divulgacao() from public, anon, authenticated;
do $$
declare f text;
begin
  foreach f in array array['instagram_acessos_listar()', 'instagram_acesso_salvar(jsonb)'] loop
    execute format('revoke all on function public.%s from public', f);
    execute format('grant execute on function public.%s to anon, authenticated, service_role', f);
  end loop;
end $$;


-- ───────────────────────────── Traduções: reserva de aula e glossário por trilha ─────────────────────────────

-- "Vou traduzir esta": a aula fica reservada no nome da pessoa, para ninguém fazer a mesma no mesmo idioma. O prazo
-- sugerido é de duas semanas (até oito); passou do prazo sem envio, a reserva cai sozinha. Enviar a tradução tira a reserva.
create table if not exists interno.traducao_reservas (
  alvo text not null check (alvo ~ '^/trilhas/[a-z0-9-]+/[a-z0-9-]+$'),
  idioma text not null check (idioma in ('en', 'es', 'zh', 'ru', 'fr')),
  usuario uuid not null references interno.perfis (id) on delete cascade,
  prazo date not null,
  criado_em timestamptz not null default now(),
  primary key (alvo, idioma)
);
alter table interno.traducao_reservas enable row level security;

-- Os termos de cada trilha e como ficam em cada idioma, para todas as aulas da trilha dizerem a mesma coisa.
create table if not exists interno.traducao_glossario (
  trilha text not null check (trilha ~ '^[a-z0-9-]{2,80}$'),
  idioma text not null check (idioma in ('en', 'es', 'zh', 'ru', 'fr')),
  termo text not null check (char_length(termo) between 1 and 120),
  traducao text not null check (char_length(traducao) between 1 and 160),
  nota text not null default '' check (char_length(nota) <= 300),
  autor uuid references interno.perfis (id) on delete set null,
  atualizado_em timestamptz not null default now(),
  primary key (trilha, idioma, termo)
);
alter table interno.traducao_glossario enable row level security;

create or replace function interno.traduz() returns boolean language sql stable as $$ select interno.curador() or interno.tem('traducao') $$;

create or replace function public.traducao_reservar(p_alvo text, p_idioma text, p_dias integer default 14) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); r traducao_reservas;
begin
  if not interno.traduz() then perform interno.erro('sem_permissao'); end if;
  perform interno.limite('traducao_reserva', 30, 60);
  if coalesce(p_alvo, '') !~ '^/trilhas/[a-z0-9-]+/[a-z0-9-]+$' then perform interno.erro('invalido:alvo'); end if;
  if coalesce(p_idioma, '') not in ('en', 'es', 'zh', 'ru', 'fr') then perform interno.erro('invalido:idioma'); end if;
  delete from traducao_reservas where prazo < current_date;
  select * into r from traducao_reservas where alvo = p_alvo and idioma = p_idioma;
  if found and r.usuario <> v and not exists (select 1 from traducao_coautores c where c.alvo = p_alvo and c.idioma = p_idioma and c.usuario = v) then perform interno.erro('traducao_reservada'); end if;
  if found and r.usuario <> v then return jsonb_build_object('ok', true, 'prazo', r.prazo); end if;
  if exists (select 1 from contribuicoes where tipo = 'traducao' and alvo = p_alvo and dados ->> 'idioma' = p_idioma and status in ('pendente', 'aprovada')) then perform interno.erro('traducao_a_caminho'); end if;
  if not found and (select count(*) from traducao_reservas where usuario = v) >= 5 then perform interno.erro('traducao_reservas_demais'); end if;
  insert into traducao_reservas (alvo, idioma, usuario, prazo) values (p_alvo, p_idioma, v, current_date + least(greatest(coalesce(p_dias, 14), 3), 56))
  on conflict (alvo, idioma) do update set prazo = excluded.prazo;
  return jsonb_build_object('ok', true, 'prazo', current_date + least(greatest(coalesce(p_dias, 14), 3), 56));
end $$;

create or replace function public.traducao_liberar(p_alvo text, p_idioma text) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu();
begin
  delete from traducao_reservas where alvo = p_alvo and idioma = p_idioma and (usuario = v or interno.coord());
  if not found then perform interno.erro('nao_encontrado'); end if;
  return jsonb_build_object('ok', true);
end $$;

/** Enviar a tradução tira a reserva daquela aula naquele idioma. */
create or replace function interno.traducao_reserva_gatilho() returns trigger language plpgsql security definer set search_path = interno, pg_temp as $$
begin
  if new.tipo = 'traducao' then delete from traducao_reservas where alvo = regexp_replace(coalesce(new.alvo, ''), '^/(pt|en|es|zh|ru|fr)(?=/)', '') and idioma = new.dados ->> 'idioma'; end if;
  return new;
end $$;
drop trigger if exists lucia_traducao_reserva on interno.contribuicoes;
create trigger lucia_traducao_reserva after insert on interno.contribuicoes for each row execute function interno.traducao_reserva_gatilho();

create or replace function public.traducao_glossario(p_trilha text, p_idioma text) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
begin
  perform interno.eu();
  if not (interno.traduz() or interno.tem('revisao')) then perform interno.erro('sem_permissao'); end if;
  return (select coalesce(jsonb_agg(jsonb_build_object('termo', g.termo, 'traducao', g.traducao, 'nota', g.nota, 'autor', interno.nome_visto(f.nome), 'atualizado_em', g.atualizado_em) order by lower(g.termo)), '[]'::jsonb)
          from traducao_glossario g left join perfis f on f.id = g.autor where g.trilha = p_trilha and g.idioma = p_idioma);
end $$;

create or replace function public.traducao_glossario_salvar(p_trilha text, p_idioma text, p_termo text, p_traducao text, p_nota text default '') returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu();
begin
  if not interno.traduz() then perform interno.erro('sem_permissao'); end if;
  perform interno.limite('glossario_traducao', 120, 60);
  insert into traducao_glossario (trilha, idioma, termo, traducao, nota, autor)
  values (p_trilha, p_idioma, interno.txt(p_termo, 'termo', 1, 120), interno.txt(p_traducao, 'traducao', 1, 160), interno.txt(p_nota, 'nota', 0, 300), v)
  on conflict (trilha, idioma, termo) do update set traducao = excluded.traducao, nota = excluded.nota, autor = v, atualizado_em = now();
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.traducao_glossario_apagar(p_trilha text, p_idioma text, p_termo text) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
begin
  perform interno.eu();
  if not interno.traduz() then perform interno.erro('sem_permissao'); end if;
  delete from traducao_glossario where trilha = p_trilha and idioma = p_idioma and termo = p_termo;
  if not found then perform interno.erro('nao_encontrado'); end if;
  return jsonb_build_object('ok', true);
end $$;

revoke all on function interno.traducao_reserva_gatilho() from public, anon, authenticated;
revoke all on function interno.traduz() from public, anon, authenticated;
do $$
declare f text;
begin
  foreach f in array array['traducao_reservar(text, text, integer)', 'traducao_liberar(text, text)', 'traducao_glossario(text, text)', 'traducao_glossario_salvar(text, text, text, text, text)', 'traducao_glossario_apagar(text, text, text)'] loop
    execute format('revoke all on function public.%s from public', f);
    execute format('grant execute on function public.%s to anon, authenticated, service_role', f);
  end loop;
end $$;


-- ───────────────────────────── Assistente: vários provedores, em ordem, com reserva ─────────────────────────────

-- Os provedores que a função "assistente" sabe chamar. A chave de cada um mora só nos segredos da função (nunca no banco
-- nem no navegador); aqui fica a ordem de tentativa, quais estão ligados e quanto cada um respondeu no dia.
create or replace function interno.assistente_provedores_conhecidos() returns text[] language sql immutable as $$
  select array['anthropic', 'groq', 'cerebras', 'gemini', 'openrouter']
$$;

create table if not exists interno.assistente_provedor_uso (
  dia date not null,
  provedor text not null,
  ok integer not null default 0,
  falhas integer not null default 0,
  primary key (dia, provedor)
);
alter table interno.assistente_provedor_uso enable row level security;

/** A lista guardada, completada com os que faltarem (desligados, no fim): provedor novo no código aparece sozinho no painel. */
create or replace function interno.assistente_provedores_lista() returns jsonb language sql stable security definer set search_path = interno, pg_temp as $$
  with guardada as (
    select t ->> 'id' as id, coalesce((t ->> 'ligado')::boolean, false) as ligado, n
    from jsonb_array_elements(coalesce(interno.assistente_config() -> 'provedores', '[{"id": "anthropic", "ligado": true}]'::jsonb)) with ordinality as x(t, n)
    where t ->> 'id' = any(interno.assistente_provedores_conhecidos())
  ), todos as (
    select id, ligado, n from guardada
    union all
    select c, false, 100 + k from unnest(interno.assistente_provedores_conhecidos()) with ordinality as y(c, k) where c not in (select id from guardada)
  )
  select coalesce(jsonb_agg(jsonb_build_object('id', id, 'ligado', ligado) order by n), '[]'::jsonb) from todos
$$;

/** Para a função "assistente" (só com a chave de serviço): os provedores ligados, na ordem de tentativa. */
create or replace function public.assistente_provedores() returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
begin
  if not interno.servico() then perform interno.erro('sem_permissao'); end if;
  return jsonb_build_object('ordem', (select coalesce(jsonb_agg(t ->> 'id'), '[]'::jsonb) from jsonb_array_elements(interno.assistente_provedores_lista()) t where (t ->> 'ligado')::boolean));
end $$;

-- ───────────────────────────── Controles do site: quem mudou o quê, e quando ─────────────────────────────

/** A última mudança de cada controle (do registro de atividades): quem e quando. Coordenação e supervisão. */
create or replace function public.controles_mudancas() returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
begin
  perform interno.eu();
  if not (interno.coord() or interno.tem('supervisao')) then perform interno.erro('sem_permissao'); end if;
  return (select coalesce(jsonb_object_agg(acao, jsonb_build_object('nome', interno.nome_visto(nome), 'em', criado_em, 'detalhes', detalhes)), '{}'::jsonb)
          from (select distinct on (acao) acao, nome, criado_em, detalhes from auditoria
                where acao in ('site_configurado', 'comunidade_modo_seguranca', 'chat_controlado', 'dicionario_salvo', 'seguranca_configurada', 'assistente_configurado', 'seguranca_sessoes')
                order by acao, criado_em desc) x);
end $$;

revoke all on function interno.assistente_provedores_conhecidos() from public, anon, authenticated;
revoke all on function interno.assistente_provedores_lista() from public, anon, authenticated;
do $$
declare f text;
begin
  foreach f in array array['assistente_provedores()', 'controles_mudancas()'] loop
    execute format('revoke all on function public.%s from public', f);
    execute format('grant execute on function public.%s to anon, authenticated, service_role', f);
  end loop;
end $$;


-- ───────────────────────────── Tarefas: "Para você hoje", saúde do acervo, mutirões ─────────────────────────────
-- Uma camada nova por cima das filas que já existem (Traduções, Fila de revisão, Triagem, Fontes abertas): nada delas muda.
-- O verificador do acervo (lib/lacunas.ts, no build) aponta as lacunas; a rotina de publicação as traz para cá, e cada uma
-- vira uma tarefa pequena (5, 15 ou 30 minutos) que qualquer pessoa da equipe pode reservar, entregar e ver revisada.

create table if not exists interno.tarefas (
  id uuid primary key default gen_random_uuid(),
  chave text unique check (chave is null or char_length(chave) <= 300),
  tipo text not null check (tipo ~ '^[a-z_]{3,30}$'),
  alvo text not null default '' check (char_length(alvo) <= 300),
  titulo text not null check (char_length(titulo) between 2 and 200),
  descricao text not null default '' check (char_length(descricao) <= 2000),
  detalhe text not null default '' check (char_length(detalhe) <= 300),
  minutos smallint not null default 15 check (minutos in (5, 15, 30)),
  dificuldade text not null default 'iniciante' check (dificuldade in ('iniciante', 'intermediario', 'avancado')),
  papel text not null default '' check (char_length(papel) <= 40),
  impacto text not null default '' check (char_length(impacto) <= 300),
  origem text not null default 'verificador' check (origem in ('verificador', 'manual')),
  status text not null default 'aberta' check (status in ('aberta', 'reservada', 'entregue', 'aprovada', 'concluida', 'encerrada')),
  reservada_por uuid references interno.perfis (id) on delete set null,
  reservada_em timestamptz,
  prazo timestamptz,
  avisada boolean not null default false,
  entrega jsonb not null default '{}'::jsonb,
  entregue_em timestamptz,
  revisada_por uuid references interno.perfis (id) on delete set null,
  revisada_em timestamptz,
  nota_revisao text not null default '' check (char_length(nota_revisao) <= 600),
  aplicada boolean not null default false,
  concluida_em timestamptz,
  mutirao uuid,
  projeto uuid,
  criado_por uuid references interno.perfis (id) on delete set null,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
create index if not exists tarefas_status on interno.tarefas (status, tipo, minutos);
create index if not exists tarefas_pessoa on interno.tarefas (reservada_por, status);
create index if not exists tarefas_concluidas on interno.tarefas (concluida_em);
alter table interno.tarefas enable row level security;

create table if not exists interno.tarefas_mutiroes (
  id uuid primary key default gen_random_uuid(),
  tema text not null check (char_length(tema) between 3 and 140),
  descricao text not null default '' check (char_length(descricao) <= 1000),
  tipo text not null default '' check (char_length(tipo) <= 30),
  meta integer not null check (meta between 1 and 10000),
  inicio date not null,
  fim date not null,
  reuniao uuid,
  criado_por uuid references interno.perfis (id) on delete set null,
  criado_em timestamptz not null default now(),
  check (fim >= inicio)
);
alter table interno.tarefas_mutiroes enable row level security;
create table if not exists interno.tarefas_mutirao_pessoas (
  mutirao uuid not null references interno.tarefas_mutiroes (id) on delete cascade,
  pessoa uuid not null references interno.perfis (id) on delete cascade,
  criado_em timestamptz not null default now(),
  primary key (mutirao, pessoa)
);
alter table interno.tarefas_mutirao_pessoas enable row level security;
create table if not exists interno.tarefas_projetos (
  id uuid primary key default gen_random_uuid(),
  nome text not null check (char_length(nome) between 3 and 140),
  descricao text not null default '' check (char_length(descricao) <= 1500),
  responsavel uuid references interno.perfis (id) on delete set null,
  prazo date,
  status text not null default 'ativo' check (status in ('ativo', 'concluido', 'arquivado')),
  criado_por uuid references interno.perfis (id) on delete set null,
  criado_em timestamptz not null default now()
);
alter table interno.tarefas_projetos enable row level security;
-- A conferência periódica dos links das obras: um lote pequeno por rodada, para não sobrecarregar ninguém.
create table if not exists interno.links_conferidos (
  url text primary key check (char_length(url) <= 600),
  alvo text not null default '' check (char_length(alvo) <= 300),
  status integer not null default 0,
  ok boolean not null default true,
  falhas integer not null default 0,
  conferido_em timestamptz not null default now()
);
alter table interno.links_conferidos enable row level security;

alter table interno.perfis add column if not exists habilidades text[] not null default '{}';
alter table interno.perfis add column if not exists agradecimento_publico boolean not null default false;
alter table interno.perfis add column if not exists selos_ocultos boolean not null default false;
alter table interno.perfis add column if not exists mentoria_oferecida boolean not null default false;

/** As regras, os limites e a meta da semana, com os padrões para o que a coordenação ainda não mexeu. */
create or replace function interno.tarefas_config() returns jsonb language sql stable security definer set search_path = interno, pg_temp as $$
  select jsonb_build_object(
    'regras', jsonb_build_object('ficha_ano', true, 'ficha_sinopse', true, 'licenca', true, 'sem_ligacao', true, 'biografia', true, 'duplicata', true, 'traducao', true, 'revisao_aula', true, 'imagem_alt', true, 'link', true),
    'max_por_ciclo', 60, 'max_reservas', 3, 'meta', null, 'mostrar', true)
  || coalesce((select valor from configuracoes where chave = 'tarefas'), '{}'::jsonb)
$$;

/** Prazo da reserva pelo tamanho da tarefa: 5 minutos, um dia; 15, três; 30, uma semana. */
create or replace function interno.tarefa_prazo(p_minutos integer) returns interval language sql immutable as $$
  select case when p_minutos <= 5 then interval '1 day' when p_minutos <= 15 then interval '3 days' else interval '7 days' end
$$;

/** Reservas vencidas voltam para a fila (com recado sem cobrança); as que vencem em menos de um dia ganham um lembrete. */
create or replace function interno.tarefas_vencer() returns void language plpgsql security definer set search_path = interno, pg_temp as $$
declare r record;
begin
  for r in select id, titulo, reservada_por from tarefas where status = 'reservada' and prazo < now() for update skip locked loop
    update tarefas set status = 'aberta', reservada_por = null, reservada_em = null, prazo = null, avisada = false, atualizado_em = now() where id = r.id;
    perform interno.avisar(r.reservada_por, 'A tarefa "' || left(r.titulo, 80) || '" voltou para a fila porque o prazo passou. Sem problema: quando der, é só pegar outra.');
  end loop;
  for r in select id, titulo, reservada_por from tarefas where status = 'reservada' and not avisada and prazo < now() + interval '1 day' for update skip locked loop
    update tarefas set avisada = true where id = r.id;
    perform interno.avisar(r.reservada_por, 'A tarefa "' || left(r.titulo, 80) || '" vence em menos de um dia. Se não for dar, libere sem culpa: ela volta para a fila.');
  end loop;
end $$;

create or replace function interno.tarefa_json(t interno.tarefas) returns jsonb language sql stable security definer set search_path = interno, pg_temp as $$
  select jsonb_build_object('id', t.id, 'tipo', t.tipo, 'alvo', t.alvo, 'titulo', t.titulo, 'descricao', t.descricao, 'detalhe', t.detalhe, 'minutos', t.minutos,
    'dificuldade', t.dificuldade, 'papel', t.papel, 'impacto', t.impacto, 'origem', t.origem, 'status', t.status, 'prazo', t.prazo, 'entrega', t.entrega,
    'nota_revisao', t.nota_revisao, 'minha', t.reservada_por = auth.uid(), 'reservada_por', case when t.reservada_por is null then '' else coalesce((select interno.nome_visto(nome) from perfis where id = t.reservada_por), '') end,
    'mutirao', t.mutirao, 'projeto', t.projeto, 'atualizado_em', t.atualizado_em)
$$;

/**
 * Traz as lacunas do verificador (a rotina de publicação, com a chave de serviço, ou a coordenação, pelo painel). Abre uma
 * tarefa para cada lacuna nova (até o limite do ciclo, só nas regras ligadas); não recria o que está aberto, reservado,
 * entregue, aprovado ou concluído; encerra o que perdeu o motivo (a lacuna sumiu por outro caminho) e conclui o que foi
 * entregue e cuja lacuna sumiu de verdade. Guarda os números da saúde do acervo.
 */
create or replace function public.tarefas_sincronizar(p_lacunas jsonb, p_saude jsonb default null) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare c jsonb := interno.tarefas_config(); v_max int := coalesce((c ->> 'max_por_ciclo')::int, 60); v_novas int := 0; v_encerradas int := 0; v_concluidas int := 0; l jsonb; v_chaves text[];
begin
  if not (interno.servico() or interno.coord()) then perform interno.erro('sem_permissao'); end if;
  if jsonb_typeof(p_lacunas) <> 'array' then perform interno.erro('invalido:lacunas'); end if;
  -- Links que falharam duas vezes seguidas também são lacunas.
  p_lacunas := p_lacunas || coalesce((select jsonb_agg(jsonb_build_object('chave', 'link:' || url, 'tipo', 'link', 'alvo', alvo, 'titulo', 'Link quebrado', 'detalhe', url)) from links_conferidos where not ok and falhas >= 2), '[]'::jsonb);
  select array_agg(x ->> 'chave') into v_chaves from jsonb_array_elements(p_lacunas) x;
  -- O que perdeu o motivo
  with fora as (
    update tarefas set status = case when status in ('entregue', 'aprovada') then 'concluida' else 'encerrada' end,
      concluida_em = case when status in ('entregue', 'aprovada') then now() else concluida_em end,
      reservada_por = case when status in ('aberta', 'reservada') then null else reservada_por end, atualizado_em = now()
    where origem = 'verificador' and status in ('aberta', 'reservada', 'entregue', 'aprovada') and not (chave = any(coalesce(v_chaves, '{}'))) returning status)
  select count(*) filter (where status = 'encerrada'), count(*) filter (where status = 'concluida') into v_encerradas, v_concluidas from fora;
  -- O que é novo (ou voltou depois de encerrado)
  for l in select x from jsonb_array_elements(p_lacunas) x loop
    exit when v_novas >= v_max;
    continue when not coalesce((c -> 'regras' ->> (l ->> 'tipo'))::boolean, false);
    continue when coalesce(l ->> 'chave', '') = '' or exists (select 1 from tarefas where chave = l ->> 'chave' and status in ('aberta', 'reservada', 'entregue', 'aprovada', 'concluida'));
    insert into tarefas (chave, tipo, alvo, titulo, detalhe, minutos, dificuldade, papel, impacto, origem)
    values (left(l ->> 'chave', 300), l ->> 'tipo', left(coalesce(l ->> 'alvo', ''), 300), left(coalesce(nullif(l ->> 'titulo', ''), 'Tarefa'), 200), left(coalesce(l ->> 'detalhe', ''), 300),
            case l ->> 'tipo' when 'ficha_ano' then 5 when 'duplicata' then 5 when 'imagem_alt' then 5 when 'biografia' then 30 when 'traducao' then 30 when 'revisao_aula' then 30 else 15 end,
            case l ->> 'tipo' when 'ficha_ano' then 'iniciante' when 'duplicata' then 'iniciante' when 'imagem_alt' then 'iniciante' when 'biografia' then 'avancado' when 'traducao' then 'avancado' else 'intermediario' end,
            case l ->> 'tipo' when 'licenca' then 'curadoria' when 'biografia' then 'curadoria' when 'sem_ligacao' then 'educacao' when 'traducao' then 'traducao' when 'revisao_aula' then 'revisao' else '' end,
            '', 'verificador')
    on conflict (chave) do update set status = 'aberta', reservada_por = null, reservada_em = null, prazo = null, entrega = '{}'::jsonb, entregue_em = null, revisada_por = null,
      revisada_em = null, nota_revisao = '', aplicada = false, concluida_em = null, atualizado_em = now()
    where tarefas.status = 'encerrada';
    v_novas := v_novas + 1;
  end loop;
  if p_saude is not null and jsonb_typeof(p_saude) = 'object' then
    insert into configuracoes (chave, valor) values ('acervo_saude', p_saude || jsonb_build_object('em', now())) on conflict (chave) do update set valor = excluded.valor;
  end if;
  insert into configuracoes (chave, valor) values ('tarefas_ciclo', jsonb_build_object('em', now(), 'novas', v_novas, 'encerradas', v_encerradas, 'concluidas', v_concluidas))
  on conflict (chave) do update set valor = excluded.valor;
  if not interno.servico() then perform interno.registrar('tarefas_verificadas', '', jsonb_build_object('novas', v_novas)); end if;
  return jsonb_build_object('novas', v_novas, 'encerradas', v_encerradas, 'concluidas', v_concluidas);
end $$;

/** Quantos itens esperam nas filas que já existem (só contagem): o atalho do "Para você hoje" leva até elas. */
create or replace function interno.tarefas_filas() returns jsonb language sql stable security definer set search_path = interno, pg_temp as $$
  select jsonb_build_object(
    'revisao', (select count(*) from contribuicoes where status = 'pendente'),
    'triagem', (select count(*) from contribuicoes where status = 'pendente' and triagem = 'aguardando'),
    'traducoes', (select count(*) from tarefas where tipo = 'traducao' and status = 'aberta'))
$$;

/**
 * O bloco "Para você hoje": de 3 a 5 tarefas para o tempo que a pessoa tem, pelas funções e habilidades dela, variando o
 * tipo (não repete o que ela acabou de fazer); o que ela reservou e ainda não terminou; as filas que já existem; a saúde
 * do acervo; a meta da semana; e se é o primeiro dia (sem nenhuma tarefa feita: o passo a passo aparece).
 */
create or replace function public.tarefas_para_mim(p_minutos integer default 15, p_pular uuid[] default '{}') returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); v_papeis text[]; v_hab text[]; v_recentes text[]; c jsonb := interno.tarefas_config(); v_meta jsonb := c -> 'meta';
begin
  if not interno.voluntario() then perform interno.erro('sem_permissao'); end if;
  perform interno.tarefas_vencer();
  select coalesce(array_agg(distinct papel), '{}') into v_papeis from papeis where usuario = v;
  select habilidades into v_hab from perfis where id = v;
  select coalesce(array_agg(tipo), '{}') into v_recentes from (select tipo from tarefas where reservada_por = v and status in ('entregue', 'aprovada', 'concluida') order by atualizado_em desc limit 3) x;
  return jsonb_build_object(
    'sugestoes', (
      select coalesce(jsonb_agg(interno.tarefa_json(t) order by r.ordem), '[]'::jsonb) from (
        select id, row_number() over (order by (case when papel = '' or papel = any(v_papeis) or papel = any(coalesce(v_hab, '{}')) then 0 else 1 end), (case when tipo = any(v_recentes) then 1 else 0 end), random()) as ordem,
               row_number() over (partition by tipo order by random()) as no_tipo
        from tarefas where status = 'aberta' and minutos <= greatest(coalesce(p_minutos, 15), 5) and not (id = any(coalesce(p_pular, '{}')))
          and (papel = '' or papel = any(v_papeis) or papel = any(coalesce(v_hab, '{}')) or interno.coord())
        limit 400) r join tarefas t on t.id = r.id
      where r.no_tipo <= 2 and r.ordem <= 40
      limit 5),
    'minhas', (select coalesce(jsonb_agg(interno.tarefa_json(t) order by t.prazo nulls last), '[]'::jsonb) from tarefas t where t.reservada_por = v and t.status in ('reservada', 'entregue')),
    'filas', interno.tarefas_filas(),
    'saude', coalesce((select valor from configuracoes where chave = 'acervo_saude'), '{}'::jsonb),
    'abertas', (select coalesce(jsonb_object_agg(tipo, n), '{}'::jsonb) from (select tipo, count(*) n from tarefas where status = 'aberta' group by tipo) x),
    'semanas', (select coalesce(jsonb_agg(jsonb_build_object('semana', semana, 'n', n) order by semana), '[]'::jsonb) from (
                  select date_trunc('week', concluida_em)::date semana, count(*) n from tarefas where concluida_em > now() - interval '8 weeks' and status in ('aprovada', 'concluida') group by 1) x),
    'meta', case when v_meta is null or jsonb_typeof(v_meta) <> 'object' then null else v_meta || jsonb_build_object('feitas', (select count(*) from tarefas where status in ('aprovada', 'concluida') and concluida_em >= coalesce((v_meta ->> 'desde')::date, date_trunc('week', now())::date) and (coalesce(v_meta ->> 'tipo', '') = '' or tipo = v_meta ->> 'tipo'))) end,
    'novato', not exists (select 1 from tarefas where reservada_por = v and status in ('entregue', 'aprovada', 'concluida')),
    'mentores', (select count(*) from perfis where mentoria_oferecida and id <> v),
    'mostrar', coalesce((interno.tarefas_config() ->> 'mostrar')::boolean, true));
end $$;

create or replace function public.tarefas_listar(p_tipo text default '', p_status text default 'aberta', p_pagina integer default 0) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
begin
  if not interno.voluntario() then perform interno.erro('sem_permissao'); end if;
  perform interno.tarefas_vencer();
  return (select coalesce(jsonb_agg(interno.tarefa_json(t) order by t.minutos, t.criado_em), '[]'::jsonb) from (
    select * from tarefas where (coalesce(p_tipo, '') = '' or tipo = p_tipo) and (coalesce(p_status, '') = '' or status = p_status)
    order by minutos, criado_em limit 50 offset greatest(coalesce(p_pagina, 0), 0) * 50) t);
end $$;

/** "Vou fazer esta": reserva no nome da pessoa, com prazo pelo tamanho; há um limite de reservas ao mesmo tempo. */
create or replace function public.tarefa_reservar(p_id uuid) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); t tarefas; v_max int := coalesce((interno.tarefas_config() ->> 'max_reservas')::int, 3);
begin
  if not interno.voluntario() then perform interno.erro('sem_permissao'); end if;
  perform interno.tarefas_vencer();
  select * into t from tarefas where id = p_id for update;
  if not found then perform interno.erro('nao_encontrado'); end if;
  if t.status = 'reservada' and t.reservada_por = v then return interno.tarefa_json(t); end if;
  if t.status <> 'aberta' then perform interno.erro('tarefa_ocupada'); end if;
  if (select count(*) from tarefas where reservada_por = v and status = 'reservada') >= v_max then perform interno.erro('tarefas_demais'); end if;
  update tarefas set status = 'reservada', reservada_por = v, reservada_em = now(), prazo = now() + interno.tarefa_prazo(minutos), avisada = false, atualizado_em = now()
  where id = p_id returning * into t;
  return interno.tarefa_json(t);
end $$;

create or replace function public.tarefa_liberar(p_id uuid) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu();
begin
  update tarefas set status = 'aberta', reservada_por = null, reservada_em = null, prazo = null, avisada = false, atualizado_em = now()
  where id = p_id and status = 'reservada' and (reservada_por = v or interno.coord());
  if not found then perform interno.erro('nao_encontrado'); end if;
  return jsonb_build_object('ok', true);
end $$;

/** A entrega: o que a pessoa fez (campos curtos e um texto). Vai para a revisão rápida. */
create or replace function public.tarefa_entregar(p_id uuid, p_entrega jsonb) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); t tarefas; e jsonb := '{}'::jsonb; k text;
begin
  select * into t from tarefas where id = p_id for update;
  if not found or t.status <> 'reservada' or t.reservada_por <> v then perform interno.erro('nao_encontrado'); end if;
  if jsonb_typeof(p_entrega) <> 'object' then perform interno.erro('invalido:entrega'); end if;
  -- Só campos conhecidos, só texto curto.
  foreach k in array array['texto', 'ano', 'sinopse', 'licenca', 'prova', 'aula', 'decisao', 'url', 'alt', 'biografia'] loop
    if p_entrega ? k then e := e || jsonb_build_object(k, left(btrim(coalesce(p_entrega ->> k, '')), case when k in ('sinopse', 'biografia', 'texto') then 6000 else 400 end)); end if;
  end loop;
  if (select coalesce(sum(char_length(value)), 0) from jsonb_each_text(e)) < 1 then perform interno.erro('invalido:entrega'); end if;
  if e ? 'ano' and coalesce(e ->> 'ano', '') !~ '^-?[0-9]{1,4}$' then perform interno.erro('invalido:ano'); end if;
  if e ? 'url' and coalesce(e ->> 'url', '') !~ '^https://[^[:space:]]+$' then perform interno.erro('invalido:url'); end if;
  if e ? 'prova' and coalesce(e ->> 'prova', '') <> '' and e ->> 'prova' !~ '^https://[^[:space:]]+$' then perform interno.erro('invalido:url'); end if;
  if e ? 'licenca' and coalesce(e ->> 'licenca', '') not in ('Domínio público', 'CC BY', 'CC BY-SA', 'CC BY-NC', 'CC BY-NC-SA', 'CC BY-ND', 'CC BY-NC-ND', 'CC0', 'Direitos reservados', 'Conforme a fonte') then perform interno.erro('invalido:licenca'); end if;
  update tarefas set status = 'entregue', entrega = e, entregue_em = now(), nota_revisao = '', atualizado_em = now() where id = p_id returning * into t;
  return interno.tarefa_json(t);
end $$;

create or replace function interno.revisa_tarefas() returns boolean language sql stable as $$
  select interno.coord() or interno.curador() or interno.tem('revisao') or interno.tem('supervisao')
$$;

/** A revisão rápida: o antes (o que estava no acervo) e o depois (a entrega), para aprovar ou devolver com um motivo. */
create or replace function public.tarefas_revisao() returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
begin
  perform interno.eu();
  if not interno.revisa_tarefas() then perform interno.erro('sem_permissao'); end if;
  return (select coalesce(jsonb_agg(interno.tarefa_json(t) || jsonb_build_object('entregue_em', t.entregue_em, 'espera_horas', round(extract(epoch from now() - t.entregue_em) / 3600)) order by t.entregue_em), '[]'::jsonb)
          from tarefas t where t.status = 'entregue' and t.reservada_por is distinct from auth.uid());
end $$;

/**
 * Aprovar ou devolver. Aprovado: a pessoa recebe a frase do que mudou; ficha (ano, sinopse, licença, link) é aplicada ao
 * acervo pela rotina de publicação e só fica concluída quando o verificador vê a lacuna sumir. Devolvido: volta para a
 * pessoa, reservada, com o motivo.
 */
create or replace function public.tarefa_revisar(p_id uuid, p_aprovar boolean, p_nota text default '') returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); t tarefas; v_nota text := interno.txt(p_nota, 'nota', 0, 600); v_frase text;
begin
  if not interno.revisa_tarefas() then perform interno.erro('sem_permissao'); end if;
  select * into t from tarefas where id = p_id for update;
  if not found or t.status <> 'entregue' then perform interno.erro('nao_encontrado'); end if;
  if t.reservada_por = v then perform interno.erro('sem_permissao'); end if;
  if not coalesce(p_aprovar, false) and char_length(v_nota) < 5 then perform interno.erro('invalido:nota'); end if;
  if coalesce(p_aprovar, false) then
    update tarefas set status = case when tipo in ('ficha_ano', 'ficha_sinopse', 'licenca', 'link') and origem = 'verificador' then 'aprovada' else 'concluida' end,
      concluida_em = now(), revisada_por = v, revisada_em = now(), nota_revisao = v_nota, atualizado_em = now() where id = p_id returning * into t;
    v_frase := case t.tipo
      when 'ficha_ano' then 'A obra "' || left(t.titulo, 80) || '" ganha o ano na próxima publicação e passa a aparecer na época certa.'
      when 'ficha_sinopse' then 'A sinopse de "' || left(t.titulo, 80) || '" entra na próxima publicação: quem acha a obra na busca vai entender do que ela trata.'
      when 'licenca' then 'A licença de "' || left(t.titulo, 80) || '" foi conferida e entra na próxima publicação.'
      when 'link' then 'O link consertado entra na próxima publicação.'
      when 'traducao' then 'A tradução segue para a fila de revisão e vai ao ar quando for aprovada.'
      else 'Tarefa "' || left(t.titulo, 80) || '" aprovada. Obrigada pelo trabalho!' end;
    perform interno.avisar(t.reservada_por, v_frase);
  else
    update tarefas set status = 'reservada', nota_revisao = v_nota, revisada_por = v, revisada_em = now(), prazo = greatest(coalesce(prazo, now()), now() + interval '2 days'), avisada = false, atualizado_em = now()
    where id = p_id returning * into t;
    perform interno.avisar(t.reservada_por, 'A tarefa "' || left(t.titulo, 80) || '" voltou com um comentário: ' || v_nota);
  end if;
  perform interno.registrar(case when coalesce(p_aprovar, false) then 'tarefa_aprovada' else 'tarefa_devolvida' end, t.id::text, jsonb_build_object('tipo', t.tipo));
  return interno.tarefa_json(t);
end $$;

/** Tarefa avulsa: coordenação e curadoria criam (título, descrição, tempo, papel, prazo opcional, mutirão ou projeto). */
create or replace function public.tarefa_criar(p jsonb) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); v_id uuid; v_min int := coalesce(nullif(p ->> 'minutos', '')::int, 15);
begin
  if not (interno.coord() or interno.curador()) then perform interno.erro('sem_permissao'); end if;
  if v_min not in (5, 15, 30) then perform interno.erro('invalido:minutos'); end if;
  insert into tarefas (tipo, alvo, titulo, descricao, minutos, dificuldade, papel, impacto, origem, criado_por, mutirao, projeto, prazo)
  values ('avulsa', left(coalesce(p ->> 'alvo', ''), 300), interno.txt(p ->> 'titulo', 'titulo', 3, 200), interno.txt(p ->> 'descricao', 'descricao', 0, 2000), v_min,
          coalesce(nullif(p ->> 'dificuldade', ''), 'iniciante'), left(coalesce(p ->> 'papel', ''), 40), interno.txt(p ->> 'impacto', 'impacto', 0, 300), 'manual', v,
          nullif(p ->> 'mutirao', '')::uuid, nullif(p ->> 'projeto', '')::uuid, null)
  returning id into v_id;
  perform interno.registrar('tarefa_criada', v_id::text, jsonb_build_object('titulo', p ->> 'titulo'));
  return jsonb_build_object('id', v_id);
end $$;

create or replace function public.tarefas_configurar(p jsonb) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare c jsonb := interno.tarefas_config(); v_novo jsonb := '{}'::jsonb;
begin
  perform interno.eu();
  if not interno.coord() then perform interno.erro('sem_permissao'); end if;
  if jsonb_typeof(p -> 'regras') = 'object' then v_novo := v_novo || jsonb_build_object('regras', (c -> 'regras') || (select coalesce(jsonb_object_agg(k, (val)::boolean), '{}'::jsonb) from jsonb_each_text(p -> 'regras') x(k, val) where (c -> 'regras') ? k)); end if;
  if p ? 'max_por_ciclo' then
    if coalesce((p ->> 'max_por_ciclo')::int, 0) not between 1 and 500 then perform interno.erro('invalido:max_por_ciclo'); end if;
    v_novo := v_novo || jsonb_build_object('max_por_ciclo', (p ->> 'max_por_ciclo')::int);
  end if;
  if p ? 'max_reservas' then
    if coalesce((p ->> 'max_reservas')::int, 0) not between 1 and 20 then perform interno.erro('invalido:max_reservas'); end if;
    v_novo := v_novo || jsonb_build_object('max_reservas', (p ->> 'max_reservas')::int);
  end if;
  if p ? 'mostrar' then v_novo := v_novo || jsonb_build_object('mostrar', coalesce((p ->> 'mostrar')::boolean, true)); end if;
  if p ? 'meta' then
    v_novo := v_novo || jsonb_build_object('meta', case when jsonb_typeof(p -> 'meta') = 'object' and coalesce((p -> 'meta' ->> 'alvo')::int, 0) > 0 then
      jsonb_build_object('texto', interno.txt(p -> 'meta' ->> 'texto', 'texto', 3, 140), 'alvo', (p -> 'meta' ->> 'alvo')::int, 'tipo', left(coalesce(p -> 'meta' ->> 'tipo', ''), 30), 'desde', coalesce(nullif(p -> 'meta' ->> 'desde', ''), date_trunc('week', now())::date::text))
      else null end);
  end if;
  insert into configuracoes (chave, valor) values ('tarefas', v_novo) on conflict (chave) do update set valor = configuracoes.valor || excluded.valor;
  perform interno.registrar('tarefas_configuradas', '', v_novo);
  return interno.tarefas_config();
exception when invalid_text_representation then
  perform interno.erro('invalido:numero');
end $$;

create or replace function public.tarefas_painel_config() returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
begin
  perform interno.eu();
  if not interno.coord() then perform interno.erro('sem_permissao'); end if;
  return interno.tarefas_config() || jsonb_build_object('ciclo', (select valor from configuracoes where chave = 'tarefas_ciclo'));
end $$;

/** A visão geral para a coordenação: por tipo, por pessoa, tempo de revisão, paradas e onde falta gente. */
create or replace function public.tarefas_visao_geral() returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
begin
  perform interno.eu();
  if not interno.coord() then perform interno.erro('sem_permissao'); end if;
  return jsonb_build_object(
    'por_tipo', (select coalesce(jsonb_object_agg(tipo, jsonb_build_object('abertas', abertas, 'reservadas', reservadas, 'entregues', entregues, 'concluidas_30', concluidas)), '{}'::jsonb) from (
      select tipo, count(*) filter (where status = 'aberta') abertas, count(*) filter (where status = 'reservada') reservadas, count(*) filter (where status = 'entregue') entregues,
             count(*) filter (where status in ('aprovada', 'concluida') and concluida_em > now() - interval '30 days') concluidas from tarefas group by tipo) x),
    'por_pessoa', (select coalesce(jsonb_agg(jsonb_build_object('nome', nome, 'reservadas', reservadas, 'feitas_30', feitas) order by feitas desc), '[]'::jsonb) from (
      select f.nome, count(*) filter (where t.status = 'reservada') reservadas, count(*) filter (where t.status in ('aprovada', 'concluida') and t.concluida_em > now() - interval '30 days') feitas
      from tarefas t join perfis f on f.id = t.reservada_por group by f.nome) x),
    'revisao_horas', (select round(avg(extract(epoch from revisada_em - entregue_em) / 3600)::numeric, 1) from tarefas where revisada_em > now() - interval '30 days' and entregue_em is not null),
    'esperando_revisao', (select count(*) from tarefas where status = 'entregue'),
    'paradas', (select coalesce(jsonb_agg(jsonb_build_object('titulo', t.titulo, 'nome', f.nome, 'desde', t.reservada_em) order by t.reservada_em), '[]'::jsonb) from tarefas t join perfis f on f.id = t.reservada_por where t.status = 'reservada' and t.reservada_em < now() - interval '5 days'),
    -- Onde falta gente: tipos com muita tarefa aberta e ninguém com nenhuma reservada.
    'falta_gente', (select coalesce(jsonb_agg(tipo order by n desc), '[]'::jsonb) from (select tipo, count(*) n from tarefas where status = 'aberta' group by tipo having count(*) >= 20) x where not exists (select 1 from tarefas y where y.tipo = x.tipo and y.status in ('reservada', 'entregue'))));
end $$;

/** O que a própria pessoa fez: tarefas, horas estimadas e selos (que ela pode esconder). */
create or replace function public.minhas_contribuicoes() returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); f perfis;
begin
  select * into f from perfis where id = v;
  return jsonb_build_object(
    'nome', f.nome,
    'tarefas', (select coalesce(jsonb_agg(jsonb_build_object('titulo', titulo, 'tipo', tipo, 'minutos', minutos, 'status', status, 'quando', coalesce(concluida_em, entregue_em), 'alvo', alvo) order by coalesce(concluida_em, entregue_em) desc), '[]'::jsonb)
                from tarefas where reservada_por = v and status in ('entregue', 'aprovada', 'concluida')),
    'envios', (select count(*) from contribuicoes where autor = v and status in ('aprovada', 'publicada')),
    'minutos', (select coalesce(sum(minutos), 0) from tarefas where reservada_por = v and status in ('aprovada', 'concluida')),
    'selos', case when f.selos_ocultos then '[]'::jsonb else (select coalesce(jsonb_agg(s), '[]'::jsonb) from (
        select 'Primeira tarefa' s where exists (select 1 from tarefas where reservada_por = v and status in ('aprovada', 'concluida'))
        union all select '10 fichas' where (select count(*) from tarefas where reservada_por = v and status in ('aprovada', 'concluida') and tipo like 'ficha%') >= 10
        union all select 'Primeira tradução publicada' where exists (select 1 from contribuicoes where autor = v and tipo = 'traducao' and status = 'publicada')
        union all select '50 tarefas' where (select count(*) from tarefas where reservada_por = v and status in ('aprovada', 'concluida')) >= 50) x) end,
    'selos_ocultos', f.selos_ocultos, 'agradecimento_publico', f.agradecimento_publico, 'habilidades', to_jsonb(coalesce(f.habilidades, '{}')), 'mentoria_oferecida', f.mentoria_oferecida);
end $$;

create or replace function public.perfil_tarefas_salvar(p jsonb) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); v_hab text[];
begin
  if jsonb_typeof(p -> 'habilidades') = 'array' then
    select coalesce(array_agg(distinct left(lower(btrim(x)), 30)), '{}') into v_hab from jsonb_array_elements_text(p -> 'habilidades') x where btrim(x) <> '' limit 20;
  end if;
  update perfis set habilidades = coalesce(v_hab, habilidades), agradecimento_publico = coalesce((p ->> 'agradecimento_publico')::boolean, agradecimento_publico),
    selos_ocultos = coalesce((p ->> 'selos_ocultos')::boolean, selos_ocultos), mentoria_oferecida = coalesce((p ->> 'mentoria_oferecida')::boolean, mentoria_oferecida)
  where id = v;
  return public.minhas_contribuicoes();
end $$;

/** "Pedir ajuda a um mentor": o recado vai a quem se ofereceu como mentor, com a tarefa; a conversa segue em Conversas. */
create or replace function public.tarefa_pedir_mentor(p_id uuid) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); t tarefas; v_mentor uuid; v_nome text;
begin
  perform interno.limite('pedir_mentor', 5, 60);
  select * into t from tarefas where id = p_id and reservada_por = v;
  if not found then perform interno.erro('nao_encontrado'); end if;
  select id into v_mentor from perfis where mentoria_oferecida and id <> v and not suspenso order by random() limit 1;
  if v_mentor is null then perform interno.erro('sem_mentor'); end if;
  select nome into v_nome from perfis where id = v;
  perform interno.avisar(v_mentor, interno.primeiro_nome(v_nome) || ' pediu uma mão na tarefa "' || left(t.titulo, 80) || '" (' || t.tipo || '). Chame nas Conversas para combinar.');
  return jsonb_build_object('ok', true, 'mentor', (select interno.nome_visto(nome) from perfis where id = v_mentor));
end $$;

/** Mutirões: tema, datas, meta e tipo de tarefa; a barra é coletiva e pode apontar para a sala de uma reunião. */
create or replace function public.mutiroes_listar() returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
begin
  if not interno.voluntario() then perform interno.erro('sem_permissao'); end if;
  return (select coalesce(jsonb_agg(jsonb_build_object('id', m.id, 'tema', m.tema, 'descricao', m.descricao, 'tipo', m.tipo, 'meta', m.meta, 'inicio', m.inicio, 'fim', m.fim, 'reuniao', m.reuniao,
            'pessoas', (select count(*) from tarefas_mutirao_pessoas x where x.mutirao = m.id), 'inscrito', exists (select 1 from tarefas_mutirao_pessoas x where x.mutirao = m.id and x.pessoa = auth.uid()),
            'feitas', (select count(*) from tarefas t where t.status in ('aprovada', 'concluida') and t.concluida_em::date between m.inicio and m.fim and (m.tipo = '' or t.tipo = m.tipo or t.mutirao = m.id))) order by m.inicio desc), '[]'::jsonb)
          from tarefas_mutiroes m where m.fim >= current_date - 30);
end $$;

create or replace function public.mutirao_salvar(p jsonb) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); v_id uuid;
begin
  if not (interno.coord() or interno.curador()) then perform interno.erro('sem_permissao'); end if;
  insert into tarefas_mutiroes (tema, descricao, tipo, meta, inicio, fim, reuniao, criado_por)
  values (interno.txt(p ->> 'tema', 'tema', 3, 140), interno.txt(p ->> 'descricao', 'descricao', 0, 1000), left(coalesce(p ->> 'tipo', ''), 30), (p ->> 'meta')::int,
          (p ->> 'inicio')::date, (p ->> 'fim')::date, nullif(p ->> 'reuniao', '')::uuid, v)
  returning id into v_id;
  perform interno.registrar('mutirao_criado', v_id::text, jsonb_build_object('tema', p ->> 'tema'));
  return jsonb_build_object('id', v_id);
exception when invalid_text_representation or invalid_datetime_format or check_violation or not_null_violation then
  perform interno.erro('invalido:mutirao');
end $$;

create or replace function public.mutirao_inscrever(p_id uuid, p_entrar boolean default true) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu();
begin
  if not interno.voluntario() then perform interno.erro('sem_permissao'); end if;
  if coalesce(p_entrar, true) then insert into tarefas_mutirao_pessoas (mutirao, pessoa) values (p_id, v) on conflict do nothing;
  else delete from tarefas_mutirao_pessoas where mutirao = p_id and pessoa = v; end if;
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.projetos_listar() returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
begin
  if not interno.voluntario() then perform interno.erro('sem_permissao'); end if;
  return (select coalesce(jsonb_agg(jsonb_build_object('id', p.id, 'nome', p.nome, 'descricao', p.descricao, 'responsavel', coalesce((select interno.nome_visto(nome) from perfis where id = p.responsavel), ''),
            'prazo', p.prazo, 'status', p.status, 'tarefas', (select count(*) from tarefas t where t.projeto = p.id), 'feitas', (select count(*) from tarefas t where t.projeto = p.id and t.status in ('aprovada', 'concluida'))) order by p.criado_em desc), '[]'::jsonb)
          from tarefas_projetos p where p.status = 'ativo');
end $$;

create or replace function public.projeto_salvar(p jsonb) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); v_id uuid;
begin
  if not (interno.coord() or interno.curador()) then perform interno.erro('sem_permissao'); end if;
  insert into tarefas_projetos (nome, descricao, responsavel, prazo, criado_por)
  values (interno.txt(p ->> 'nome', 'nome', 3, 140), interno.txt(p ->> 'descricao', 'descricao', 0, 1500), nullif(p ->> 'responsavel', '')::uuid, nullif(p ->> 'prazo', '')::date, v)
  returning id into v_id;
  return jsonb_build_object('id', v_id);
exception when invalid_text_representation or invalid_datetime_format then
  perform interno.erro('invalido:projeto');
end $$;

-- Para a rotina de publicação (só com a chave de serviço): as fichas aprovadas que ela aplica ao acervo e a conferência dos links.
create or replace function public.tarefas_aplicaveis() returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
begin
  if not interno.servico() then perform interno.erro('sem_permissao'); end if;
  return (select coalesce(jsonb_agg(jsonb_build_object('id', id, 'tipo', tipo, 'alvo', alvo, 'entrega', entrega)), '[]'::jsonb) from tarefas where status = 'aprovada' and not aplicada);
end $$;

create or replace function public.tarefas_aplicadas(p_ids uuid[], p_falhas jsonb default '{}') returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare k text;
begin
  if not interno.servico() then perform interno.erro('sem_permissao'); end if;
  update tarefas set aplicada = true, atualizado_em = now() where id = any(coalesce(p_ids, '{}'));
  for k in select jsonb_object_keys(coalesce(p_falhas, '{}'::jsonb)) loop
    update tarefas set status = 'entregue', nota_revisao = left('Não deu para aplicar: ' || (p_falhas ->> k), 600), atualizado_em = now() where id = k::uuid and status = 'aprovada';
  end loop;
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.links_para_conferir(p_urls jsonb, p_limite integer default 25) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
begin
  if not interno.servico() then perform interno.erro('sem_permissao'); end if;
  -- Dos endereços das obras, os nunca conferidos primeiro e depois os conferidos há mais tempo.
  return (select coalesce(jsonb_agg(x order by l.conferido_em nulls first), '[]'::jsonb) from (
    select x from jsonb_array_elements(p_urls) x) a left join links_conferidos l on l.url = a.x ->> 'url'
    where coalesce(l.conferido_em, 'epoch') < now() - interval '7 days' limit least(greatest(coalesce(p_limite, 25), 1), 100));
end $$;

create or replace function public.links_resultado(p jsonb) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare r jsonb;
begin
  if not interno.servico() then perform interno.erro('sem_permissao'); end if;
  for r in select x from jsonb_array_elements(p) x loop
    insert into links_conferidos (url, alvo, status, ok, falhas, conferido_em)
    values (left(r ->> 'url', 600), left(coalesce(r ->> 'alvo', ''), 300), coalesce((r ->> 'status')::int, 0), coalesce((r ->> 'ok')::boolean, true), case when coalesce((r ->> 'ok')::boolean, true) then 0 else 1 end, now())
    on conflict (url) do update set status = excluded.status, ok = excluded.ok, alvo = excluded.alvo, conferido_em = now(),
      falhas = case when excluded.ok then 0 else links_conferidos.falhas + 1 end;
  end loop;
  return jsonb_build_object('ok', true);
end $$;

revoke all on function interno.tarefas_config() from public, anon, authenticated;
revoke all on function interno.tarefa_prazo(integer) from public, anon, authenticated;
revoke all on function interno.tarefas_vencer() from public, anon, authenticated;
revoke all on function interno.tarefa_json(interno.tarefas) from public, anon, authenticated;
revoke all on function interno.tarefas_filas() from public, anon, authenticated;
revoke all on function interno.revisa_tarefas() from public, anon, authenticated;
do $$
declare f text;
begin
  foreach f in array array['tarefas_sincronizar(jsonb, jsonb)', 'tarefas_para_mim(integer, uuid[])', 'tarefas_listar(text, text, integer)', 'tarefa_reservar(uuid)', 'tarefa_liberar(uuid)',
    'tarefa_entregar(uuid, jsonb)', 'tarefas_revisao()', 'tarefa_revisar(uuid, boolean, text)', 'tarefa_criar(jsonb)', 'tarefas_configurar(jsonb)', 'tarefas_painel_config()',
    'tarefas_visao_geral()', 'minhas_contribuicoes()', 'perfil_tarefas_salvar(jsonb)', 'tarefa_pedir_mentor(uuid)', 'mutiroes_listar()', 'mutirao_salvar(jsonb)', 'mutirao_inscrever(uuid, boolean)',
    'projetos_listar()', 'projeto_salvar(jsonb)', 'tarefas_aplicaveis()', 'tarefas_aplicadas(uuid[], jsonb)', 'links_para_conferir(jsonb, integer)', 'links_resultado(jsonb)'] loop
    execute format('revoke all on function public.%s from public', f);
    execute format('grant execute on function public.%s to anon, authenticated, service_role', f);
  end loop;
end $$;

-- ───────────────────────────── Apoio e transparência ─────────────────────────────
-- A página de Apoie e a prestação de contas. Tudo o que é número ou afirmação vem daqui (escrito pela coordenação) ou de
-- contagens do próprio sistema: nada é inventado. O site não recebe nem guarda dados de pagamento, e o mural só tem nome
-- de quem pediu ou autorizou. A página tem rascunho, prévia, publicação e "desfazer a última publicação".

create table if not exists interno.apoio_pedidos_mural (
  id uuid primary key default gen_random_uuid(),
  nome text not null check (char_length(nome) between 2 and 80),
  mensagem text not null default '' check (char_length(mensagem) <= 200),
  status text not null default 'pendente' check (status in ('pendente', 'aprovado', 'recusado')),
  criado_em timestamptz not null default now(),
  decidido_por uuid references interno.perfis (id) on delete set null,
  decidido_em timestamptz
);
alter table interno.apoio_pedidos_mural enable row level security;

create table if not exists interno.apoio_lancamentos (
  id uuid primary key default gen_random_uuid(),
  mes date not null check (extract(day from mes) = 1),
  tipo text not null check (tipo in ('entrada', 'saida')),
  categoria text not null check (char_length(categoria) between 2 and 60),
  valor numeric(12, 2) not null check (valor > 0 and valor < 10000000),
  descricao text not null default '' check (char_length(descricao) <= 300),
  -- Onde o comprovante está guardado (pasta da coordenação, nome do arquivo): nunca sai para o público.
  comprovante text not null default '' check (char_length(comprovante) <= 300),
  criado_por uuid references interno.perfis (id) on delete set null,
  criado_em timestamptz not null default now()
);
alter table interno.apoio_lancamentos enable row level security;
create index if not exists apoio_lancamentos_mes on interno.apoio_lancamentos (mes);

create table if not exists interno.apoio_relatorios (
  id uuid primary key default gen_random_uuid(),
  mes date not null unique check (extract(day from mes) = 1),
  -- {entradas: {categoria: valor}, saidas: {categoria: valor}, total_entradas, total_saidas, saldo}
  dados jsonb not null,
  nota text not null default '' check (char_length(nota) <= 2000),
  status text not null default 'aguardando' check (status in ('aguardando', 'publicado')),
  -- A versão que espera a segunda pessoa (na primeira publicação, ou numa correção).
  proposta jsonb,
  pedido_por uuid references interno.perfis (id) on delete set null,
  pedido_em timestamptz,
  confirmado_por uuid references interno.perfis (id) on delete set null,
  publicado_em timestamptz,
  -- As versões publicadas antes de cada correção: [{dados, nota, publicado_em, corrigido_em, motivo}]
  historico jsonb not null default '[]'::jsonb
);
alter table interno.apoio_relatorios enable row level security;

/** A configuração da página quando nada foi escrito ainda: os valores da campanha que já existe na Benfeitoria. */
create or replace function interno.apoio_padrao() returns jsonb language sql immutable as $$
  select jsonb_build_object(
    'link', 'https://benfeitoria.com/projeto/instituto-lucia-28cx',
    'faixas', jsonb_build_array(
      jsonb_build_object('valor', 10, 'nome', 'Página', 'descricao', ''),
      jsonb_build_object('valor', 25, 'nome', 'Capítulo', 'descricao', ''),
      jsonb_build_object('valor', 50, 'nome', 'Livro', 'descricao', ''),
      jsonb_build_object('valor', 100, 'nome', 'Estante', 'descricao', ''),
      jsonb_build_object('valor', 200, 'nome', 'Biblioteca', 'descricao', '')),
    'metas', jsonb_build_object(
      'meta1', jsonb_build_object('alvo', 550, 'texto', 'Cobre todas as contas fixas do site'),
      'meta2', jsonb_build_object('alvo', 1000, 'texto', ''),
      'intermediaria', null),
    'campanha', null,
    'custos', '[]'::jsonb,
    'responsavel', jsonb_build_object('texto', '', 'confirmado', false),
    'taxa', jsonb_build_object('texto', '', 'confirmado', false),
    'cancelamento', jsonb_build_object('texto', '', 'confirmado', false),
    'faq', '[]'::jsonb)
$$;

create or replace function interno.apoio_regras() returns jsonb language sql stable security definer set search_path = interno, pg_temp as $$
  select jsonb_build_object('segunda_pessoa', true) || coalesce((select valor from configuracoes where chave = 'apoio_regras'), '{}'::jsonb)
$$;

/** Número dentro da faixa (ou erro com o nome do campo). */
create or replace function interno.apoio_num(p jsonb, p_campo text, p_min numeric, p_max numeric) returns numeric language plpgsql immutable as $$
declare v numeric;
begin
  if p is null or jsonb_typeof(p) <> 'number' then raise exception 'invalido:%', p_campo using errcode = 'P0001'; end if;
  v := (p #>> '{}')::numeric;
  if v < p_min or v > p_max then raise exception 'invalido:%', p_campo using errcode = 'P0001'; end if;
  return round(v, 2);
end $$;

/** Texto que só vai ao público depois de a coordenação confirmar: {texto, confirmado}. */
create or replace function interno.apoio_confirmavel(p jsonb, p_campo text, p_max integer) returns jsonb language plpgsql immutable as $$
begin
  if p is null or jsonb_typeof(p) <> 'object' then return jsonb_build_object('texto', '', 'confirmado', false); end if;
  return jsonb_build_object('texto', interno.txt(p ->> 'texto', p_campo, 0, p_max),
    'confirmado', coalesce((p ->> 'confirmado')::boolean, false) and btrim(coalesce(p ->> 'texto', '')) <> '');
end $$;

/** Confere e limpa a configuração da página antes de guardar o rascunho. */
create or replace function interno.apoio_validar(p jsonb) returns jsonb language plpgsql stable as $$
declare
  v_faixas jsonb := '[]'::jsonb; v_custos jsonb := '[]'::jsonb; v_faq jsonb := '[]'::jsonb; x jsonb; v_inter jsonb := null; v_camp jsonb := null;
begin
  if p is null or jsonb_typeof(p) <> 'object' then perform interno.erro('invalido:configuracao'); end if;
  if coalesce(p ->> 'link', '') !~ '^https://[^\s"<>]{4,}$' or char_length(p ->> 'link') > 300 then perform interno.erro('invalido:link'); end if;
  if jsonb_typeof(p -> 'faixas') <> 'array' or jsonb_array_length(p -> 'faixas') not between 1 and 8 then perform interno.erro('invalido:faixas'); end if;
  for x in select value from jsonb_array_elements(p -> 'faixas') loop
    v_faixas := v_faixas || jsonb_build_array(jsonb_build_object('valor', interno.apoio_num(x -> 'valor', 'faixa_valor', 1, 100000),
      'nome', interno.txt(x ->> 'nome', 'faixa_nome', 1, 40), 'descricao', interno.txt(x ->> 'descricao', 'faixa_descricao', 0, 200)));
  end loop;
  if jsonb_typeof(p -> 'metas') <> 'object' then perform interno.erro('invalido:metas'); end if;
  if jsonb_typeof(p -> 'metas' -> 'intermediaria') = 'object' then
    if coalesce(p -> 'metas' -> 'intermediaria' ->> 'unidade', '') not in ('apoiadores', 'reais') then perform interno.erro('invalido:meta_unidade'); end if;
    v_inter := jsonb_build_object('texto', interno.txt(p -> 'metas' -> 'intermediaria' ->> 'texto', 'meta_texto', 3, 140),
      'alvo', interno.apoio_num(p -> 'metas' -> 'intermediaria' -> 'alvo', 'meta_alvo', 1, 10000000), 'unidade', p -> 'metas' -> 'intermediaria' ->> 'unidade');
  end if;
  if jsonb_typeof(p -> 'campanha') = 'object' then
    if coalesce(p -> 'campanha' ->> 'em', '') !~ '^\d{4}-\d{2}-\d{2}$' or (p -> 'campanha' ->> 'em')::date > current_date + 1 then perform interno.erro('invalido:campanha_data'); end if;
    v_camp := jsonb_build_object('mensal', interno.apoio_num(p -> 'campanha' -> 'mensal', 'campanha_mensal', 0, 10000000),
      'apoiadores', interno.apoio_num(p -> 'campanha' -> 'apoiadores', 'campanha_apoiadores', 0, 1000000), 'em', p -> 'campanha' ->> 'em');
  end if;
  if jsonb_typeof(coalesce(p -> 'custos', '[]')) <> 'array' or jsonb_array_length(coalesce(p -> 'custos', '[]')) > 20 then perform interno.erro('invalido:custos'); end if;
  for x in select value from jsonb_array_elements(coalesce(p -> 'custos', '[]')) loop
    v_custos := v_custos || jsonb_build_array(jsonb_build_object('categoria', interno.txt(x ->> 'categoria', 'custo_categoria', 2, 60),
      'valor', case when x -> 'valor' is null or jsonb_typeof(x -> 'valor') = 'null' then null else interno.apoio_num(x -> 'valor', 'custo_valor', 0, 1000000) end,
      'dolar', coalesce((x ->> 'dolar')::boolean, false), 'descricao', interno.txt(x ->> 'descricao', 'custo_descricao', 0, 200)));
  end loop;
  if jsonb_typeof(coalesce(p -> 'faq', '[]')) <> 'array' or jsonb_array_length(coalesce(p -> 'faq', '[]')) > 20 then perform interno.erro('invalido:faq'); end if;
  for x in select value from jsonb_array_elements(coalesce(p -> 'faq', '[]')) loop
    v_faq := v_faq || jsonb_build_array(jsonb_build_object('p', interno.txt(x ->> 'p', 'faq_pergunta', 3, 200), 'r', interno.txt(x ->> 'r', 'faq_resposta', 3, 1500)));
  end loop;
  return jsonb_build_object(
    'link', p ->> 'link',
    'faixas', v_faixas,
    'metas', jsonb_build_object(
      'meta1', jsonb_build_object('alvo', interno.apoio_num(p -> 'metas' -> 'meta1' -> 'alvo', 'meta1', 1, 10000000), 'texto', interno.txt(p -> 'metas' -> 'meta1' ->> 'texto', 'meta1_texto', 0, 140)),
      'meta2', case when jsonb_typeof(p -> 'metas' -> 'meta2') = 'object' and jsonb_typeof(p -> 'metas' -> 'meta2' -> 'alvo') = 'number'
                    then jsonb_build_object('alvo', interno.apoio_num(p -> 'metas' -> 'meta2' -> 'alvo', 'meta2', 1, 10000000), 'texto', interno.txt(p -> 'metas' -> 'meta2' ->> 'texto', 'meta2_texto', 0, 140)) else null end,
      'intermediaria', v_inter),
    'campanha', v_camp,
    'custos', v_custos,
    'responsavel', interno.apoio_confirmavel(p -> 'responsavel', 'responsavel', 1500),
    'taxa', interno.apoio_confirmavel(p -> 'taxa', 'taxa', 600),
    'cancelamento', interno.apoio_confirmavel(p -> 'cancelamento', 'cancelamento', 1000),
    'faq', v_faq);
exception when invalid_text_representation or numeric_value_out_of_range or datetime_field_overflow or invalid_datetime_format then
  perform interno.erro('invalido:numero');
end $$;

/** O que a página pública mostra: só o confirmado, contagens agregadas, o mural e o último relatório. */
create or replace function interno.apoio_vitrine(c jsonb) returns jsonb language sql stable security definer set search_path = interno, pg_temp as $$
  select c
    || jsonb_build_object(
      'responsavel', case when coalesce((c -> 'responsavel' ->> 'confirmado')::boolean, false) then c -> 'responsavel' ->> 'texto' else null end,
      'taxa', case when coalesce((c -> 'taxa' ->> 'confirmado')::boolean, false) then c -> 'taxa' ->> 'texto' else null end,
      'cancelamento', case when coalesce((c -> 'cancelamento' ->> 'confirmado')::boolean, false) then c -> 'cancelamento' ->> 'texto' else null end,
      'mural', (select coalesce(jsonb_agg(jsonb_build_object('id', a.id, 'nome', a.nome, 'mensagem', a.mensagem) order by a.criado_em), '[]'::jsonb) from apoiadores a where a.visivel),
      'voluntarios', (select count(distinct p.usuario) from papeis p join perfis f on f.id = p.usuario where not f.suspenso and f.visto_em > now() - interval '90 days'),
      'nomes_voluntarios', (select coalesce(jsonb_agg(nome order by nome), '[]'::jsonb) from (select distinct f.nome from perfis f join papeis p on p.usuario = f.id
                              where f.agradecimento_publico and not f.suspenso and btrim(f.nome) <> '' limit 80) x),
      'contribuicoes_publicadas', (select count(*) from contribuicoes where status = 'publicada'),
      'relatorio', (select jsonb_build_object('mes', r.mes, 'dados', r.dados, 'publicado_em', r.publicado_em) from apoio_relatorios r where r.publicado_em is not null order by r.mes desc limit 1))
$$;

create or replace function public.apoio_publico() returns jsonb language plpgsql stable security definer set search_path = interno, pg_temp as $$
begin
  return interno.apoio_vitrine(coalesce((select valor from configuracoes where chave = 'apoio'), interno.apoio_padrao()))
    || jsonb_build_object('atualizado_em', (select valor ->> 'em' from configuracoes where chave = 'apoio_publicado_em'));
end $$;

/** A prévia: o rascunho como a página vai mostrar, só para a coordenação. */
create or replace function public.apoio_previa() returns jsonb language plpgsql stable security definer set search_path = interno, pg_temp as $$
begin
  perform interno.eu();
  if not interno.coord() then perform interno.erro('sem_permissao'); end if;
  return interno.apoio_vitrine(coalesce((select valor from configuracoes where chave = 'apoio_rascunho'), (select valor from configuracoes where chave = 'apoio'), interno.apoio_padrao()))
    || jsonb_build_object('previa', true);
end $$;

create or replace function public.apoio_painel() returns jsonb language plpgsql stable security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu();
begin
  if not interno.coord() then perform interno.erro('sem_permissao'); end if;
  return jsonb_build_object(
    'publicado', coalesce((select valor from configuracoes where chave = 'apoio'), interno.apoio_padrao()),
    'rascunho', coalesce((select valor from configuracoes where chave = 'apoio_rascunho'), (select valor from configuracoes where chave = 'apoio'), interno.apoio_padrao()),
    'publicado_em', (select valor ->> 'em' from configuracoes where chave = 'apoio_publicado_em'),
    'pode_desfazer', exists (select 1 from configuracoes where chave = 'apoio_anterior'),
    'regras', interno.apoio_regras(),
    'coordenacao', (select count(distinct p.usuario) from papeis p join perfis f on f.id = p.usuario where p.papel in ('coordenacao', 'vice') and not f.suspenso),
    'eu', v,
    'pedidos', (select coalesce(jsonb_agg(jsonb_build_object('id', id, 'nome', nome, 'mensagem', mensagem, 'criado_em', criado_em) order by criado_em), '[]'::jsonb) from apoio_pedidos_mural where status = 'pendente'),
    'mural', (select coalesce(jsonb_agg(jsonb_build_object('id', id, 'nome', nome, 'mensagem', mensagem, 'visivel', visivel, 'consentimento', consentimento, 'criado_em', criado_em) order by criado_em), '[]'::jsonb) from apoiadores),
    'lancamentos', (select coalesce(jsonb_agg(jsonb_build_object('id', id, 'mes', mes, 'tipo', tipo, 'categoria', categoria, 'valor', valor, 'descricao', descricao, 'comprovante', comprovante) order by mes desc, criado_em desc), '[]'::jsonb)
                    from apoio_lancamentos where mes > current_date - interval '3 years'),
    'relatorios', (select coalesce(jsonb_agg(jsonb_build_object('id', r.id, 'mes', r.mes, 'dados', r.dados, 'nota', r.nota, 'status', r.status, 'proposta', r.proposta,
                     'pedido_por', r.pedido_por, 'pedido_nome', (select nome from perfis where id = r.pedido_por), 'publicado_em', r.publicado_em, 'historico', r.historico) order by r.mes desc), '[]'::jsonb) from apoio_relatorios r),
    'texto', (select valor from configuracoes where chave = 'apoio_texto'),
    'voluntarios', (select count(distinct p.usuario) from papeis p join perfis f on f.id = p.usuario where not f.suspenso and f.visto_em > now() - interval '90 days'));
end $$;

create or replace function public.apoio_rascunho_salvar(p jsonb) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v_limpo jsonb;
begin
  perform interno.eu();
  if not interno.coord() then perform interno.erro('sem_permissao'); end if;
  v_limpo := interno.apoio_validar(p);
  insert into configuracoes (chave, valor) values ('apoio_rascunho', v_limpo) on conflict (chave) do update set valor = excluded.valor;
  return v_limpo;
end $$;

create or replace function public.apoio_publicar() returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v_rascunho jsonb; v_atual jsonb;
begin
  perform interno.eu();
  if not interno.coord() then perform interno.erro('sem_permissao'); end if;
  select valor into v_rascunho from configuracoes where chave = 'apoio_rascunho';
  if v_rascunho is null then perform interno.erro('nada_a_publicar'); end if;
  select valor into v_atual from configuracoes where chave = 'apoio';
  insert into configuracoes (chave, valor) values ('apoio_anterior', jsonb_build_object('config', v_atual, 'em', (select valor ->> 'em' from configuracoes where chave = 'apoio_publicado_em')))
    on conflict (chave) do update set valor = excluded.valor;
  insert into configuracoes (chave, valor) values ('apoio', v_rascunho) on conflict (chave) do update set valor = excluded.valor;
  insert into configuracoes (chave, valor) values ('apoio_publicado_em', jsonb_build_object('em', now())) on conflict (chave) do update set valor = excluded.valor;
  delete from configuracoes where chave = 'apoio_rascunho';
  perform interno.registrar('apoio_publicado', '', jsonb_build_object('config', v_rascunho));
  return jsonb_build_object('ok', true);
end $$;

/** Desfaz a última publicação: a página volta ao que era antes (uma vez só). */
create or replace function public.apoio_desfazer() returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v_anterior jsonb;
begin
  perform interno.eu();
  if not interno.coord() then perform interno.erro('sem_permissao'); end if;
  select valor into v_anterior from configuracoes where chave = 'apoio_anterior';
  if v_anterior is null then perform interno.erro('nada_a_desfazer'); end if;
  if v_anterior -> 'config' is null or jsonb_typeof(v_anterior -> 'config') = 'null' then
    delete from configuracoes where chave in ('apoio', 'apoio_publicado_em');
  else
    update configuracoes set valor = v_anterior -> 'config' where chave = 'apoio';
    insert into configuracoes (chave, valor) values ('apoio_publicado_em', jsonb_build_object('em', v_anterior ->> 'em')) on conflict (chave) do update set valor = excluded.valor;
  end if;
  delete from configuracoes where chave = 'apoio_anterior';
  perform interno.registrar('apoio_desfeito', '');
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.apoio_regras_salvar(p jsonb) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
begin
  perform interno.eu();
  if not interno.coord() then perform interno.erro('sem_permissao'); end if;
  insert into configuracoes (chave, valor) values ('apoio_regras', jsonb_build_object('segunda_pessoa', coalesce((p ->> 'segunda_pessoa')::boolean, true)))
    on conflict (chave) do update set valor = excluded.valor;
  perform interno.registrar('apoio_regras', '', p);
  return interno.apoio_regras();
end $$;

/** "Já apoiei e quero aparecer no mural": nome e mensagem curta, sem e-mail nem nada mais. Vai para a fila da coordenação. */
create or replace function public.apoio_mural_pedir(p_nome text, p_mensagem text default '', p_site text default '') returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
begin
  perform interno.aberta('voluntariado');
  -- Campo-isca: gente não vê, robô preenche.
  if coalesce(p_site, '') <> '' then return jsonb_build_object('ok', true); end if;
  perform interno.limite('apoio_mural', 3, 60);
  insert into apoio_pedidos_mural (nome, mensagem) values (interno.txt(p_nome, 'nome', 2, 80), interno.txt(p_mensagem, 'mensagem', 0, 200));
  if (select count(*) from apoio_pedidos_mural where status = 'pendente') <= 1 then
    perform interno.avisar_lideranca('Alguém pediu para aparecer no mural de apoiadores. Confira na lista da Benfeitoria antes de aprovar (Apoio e transparência).');
  end if;
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.apoio_mural_decidir(p_id uuid, p_aprovar boolean) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); r apoio_pedidos_mural;
begin
  if not interno.coord() then perform interno.erro('sem_permissao'); end if;
  update apoio_pedidos_mural set status = case when p_aprovar then 'aprovado' else 'recusado' end, decidido_por = v, decidido_em = now()
   where id = p_id and status = 'pendente' returning * into r;
  if r.id is null then perform interno.erro('nao_encontrado'); end if;
  if p_aprovar then
    insert into apoiadores (nome, mensagem, consentimento) values (r.nome, r.mensagem, 'pediu pela página em ' || to_char(r.criado_em at time zone 'America/Sao_Paulo', 'DD/MM/YYYY'));
  end if;
  perform interno.registrar(case when p_aprovar then 'apoio_mural_aprovado' else 'apoio_mural_recusado' end, p_id::text);
  return jsonb_build_object('ok', true);
end $$;

/** A coordenação acrescenta um nome direto, dizendo como a pessoa autorizou. */
create or replace function public.apoio_mural_adicionar(p_nome text, p_mensagem text, p_consentimento text) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v_id uuid;
begin
  perform interno.eu();
  if not interno.coord() then perform interno.erro('sem_permissao'); end if;
  insert into apoiadores (nome, mensagem, consentimento) values (interno.txt(p_nome, 'nome', 2, 80), interno.txt(p_mensagem, 'mensagem', 0, 200), interno.txt(p_consentimento, 'consentimento', 5, 200))
    returning id into v_id;
  perform interno.registrar('apoiador_salvo', v_id::text);
  return jsonb_build_object('id', v_id);
end $$;

create or replace function public.apoio_mural_visivel(p_id uuid, p_visivel boolean) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
begin
  perform interno.eu();
  if not interno.coord() then perform interno.erro('sem_permissao'); end if;
  update apoiadores set visivel = coalesce(p_visivel, true) where id = p_id;
  if not found then perform interno.erro('nao_encontrado'); end if;
  perform interno.registrar(case when p_visivel then 'apoiador_mostrado' else 'apoiador_escondido' end, p_id::text);
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.apoio_lancamento_salvar(p jsonb) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); v_id uuid; v_mes date;
begin
  if not interno.coord() then perform interno.erro('sem_permissao'); end if;
  if coalesce(p ->> 'mes', '') !~ '^\d{4}-\d{2}(-\d{2})?$' then perform interno.erro('invalido:mes'); end if;
  v_mes := date_trunc('month', (left(p ->> 'mes', 7) || '-01')::date)::date;
  if v_mes > date_trunc('month', current_date) then perform interno.erro('invalido:mes'); end if;
  if coalesce(p ->> 'tipo', '') not in ('entrada', 'saida') then perform interno.erro('invalido:tipo'); end if;
  if nullif(p ->> 'id', '') is null then
    insert into apoio_lancamentos (mes, tipo, categoria, valor, descricao, comprovante, criado_por)
    values (v_mes, p ->> 'tipo', interno.txt(p ->> 'categoria', 'categoria', 2, 60), interno.apoio_num(p -> 'valor', 'valor', 0.01, 9999999), interno.txt(p ->> 'descricao', 'descricao', 0, 300), interno.txt(p ->> 'comprovante', 'comprovante', 0, 300), v)
    returning id into v_id;
  else
    update apoio_lancamentos set mes = v_mes, tipo = p ->> 'tipo', categoria = interno.txt(p ->> 'categoria', 'categoria', 2, 60), valor = interno.apoio_num(p -> 'valor', 'valor', 0.01, 9999999),
      descricao = interno.txt(p ->> 'descricao', 'descricao', 0, 300), comprovante = interno.txt(p ->> 'comprovante', 'comprovante', 0, 300)
    where id = (p ->> 'id')::uuid returning id into v_id;
    if v_id is null then perform interno.erro('nao_encontrado'); end if;
  end if;
  perform interno.registrar('apoio_lancamento', v_id::text, jsonb_build_object('mes', v_mes, 'tipo', p ->> 'tipo', 'valor', p -> 'valor'));
  return jsonb_build_object('id', v_id);
exception when invalid_text_representation or invalid_datetime_format or datetime_field_overflow then
  perform interno.erro('invalido:numero');
end $$;

create or replace function public.apoio_lancamento_remover(p_id uuid) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
begin
  perform interno.eu();
  if not interno.coord() then perform interno.erro('sem_permissao'); end if;
  delete from apoio_lancamentos where id = p_id;
  if found then perform interno.registrar('apoio_lancamento_removido', p_id::text); end if;
  return jsonb_build_object('ok', true);
end $$;

/** Os números de um mês, somados dos lançamentos. */
create or replace function interno.apoio_somar(p_mes date) returns jsonb language sql stable security definer set search_path = interno, pg_temp as $$
  select jsonb_build_object(
    'entradas', (select coalesce(jsonb_object_agg(categoria, total), '{}'::jsonb) from (select categoria, sum(valor) total from apoio_lancamentos where mes = p_mes and tipo = 'entrada' group by categoria) x),
    'saidas', (select coalesce(jsonb_object_agg(categoria, total), '{}'::jsonb) from (select categoria, sum(valor) total from apoio_lancamentos where mes = p_mes and tipo = 'saida' group by categoria) x),
    'total_entradas', (select coalesce(sum(valor), 0) from apoio_lancamentos where mes = p_mes and tipo = 'entrada'),
    'total_saidas', (select coalesce(sum(valor), 0) from apoio_lancamentos where mes = p_mes and tipo = 'saida'),
    'saldo', (select coalesce(sum(case when tipo = 'entrada' then valor else -valor end), 0) from apoio_lancamentos where mes = p_mes))
$$;

/**
 * Pede a publicação do relatório do mês (ou de uma correção). Com a regra da segunda pessoa ligada, outra pessoa da
 * coordenação confirma; desligada (ou se a coordenação tem uma pessoa só e a regra foi desligada), sai na hora.
 */
create or replace function public.apoio_relatorio_pedir(p_mes text, p_nota text default '', p_motivo text default '') returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); v_mes date; r apoio_relatorios; v_prop jsonb;
begin
  if not interno.coord() then perform interno.erro('sem_permissao'); end if;
  if coalesce(p_mes, '') !~ '^\d{4}-\d{2}' then perform interno.erro('invalido:mes'); end if;
  v_mes := (left(p_mes, 7) || '-01')::date;
  if v_mes >= date_trunc('month', current_date) then perform interno.erro('mes_em_andamento'); end if;
  if not exists (select 1 from apoio_lancamentos where mes = v_mes) then perform interno.erro('sem_lancamentos'); end if;
  select * into r from apoio_relatorios where mes = v_mes for update;
  if r.publicado_em is not null and char_length(btrim(coalesce(p_motivo, ''))) < 5 then perform interno.erro('invalido:motivo'); end if;
  v_prop := jsonb_build_object('dados', interno.apoio_somar(v_mes), 'nota', interno.txt(p_nota, 'nota', 0, 2000), 'motivo', interno.txt(p_motivo, 'motivo', 0, 300));
  if r.id is null then
    insert into apoio_relatorios (mes, dados, nota, status, proposta, pedido_por, pedido_em) values (v_mes, v_prop -> 'dados', v_prop ->> 'nota', 'aguardando', v_prop, v, now()) returning * into r;
  else
    update apoio_relatorios set proposta = v_prop, pedido_por = v, pedido_em = now(), status = case when publicado_em is null then 'aguardando' else status end where id = r.id returning * into r;
  end if;
  perform interno.registrar('apoio_relatorio_pedido', r.id::text, jsonb_build_object('mes', v_mes));
  if not coalesce((interno.apoio_regras() ->> 'segunda_pessoa')::boolean, true) then
    return public.apoio_relatorio_confirmar(r.id);
  end if;
  perform interno.avisar_lideranca('O relatório de contas de ' || to_char(v_mes, 'MM/YYYY') || ' espera a confirmação de uma segunda pessoa da coordenação (Apoio e transparência).', v);
  return jsonb_build_object('id', r.id, 'aguardando', true);
end $$;

create or replace function public.apoio_relatorio_confirmar(p_id uuid) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); r apoio_relatorios; v_segunda boolean := coalesce((interno.apoio_regras() ->> 'segunda_pessoa')::boolean, true);
begin
  if not interno.coord() then perform interno.erro('sem_permissao'); end if;
  select * into r from apoio_relatorios where id = p_id for update;
  if r.id is null or r.proposta is null then perform interno.erro('nao_encontrado'); end if;
  if v_segunda and r.pedido_por = v then perform interno.erro('segunda_pessoa'); end if;
  update apoio_relatorios set
    historico = case when publicado_em is null then historico
                     else historico || jsonb_build_array(jsonb_build_object('dados', dados, 'nota', nota, 'publicado_em', publicado_em, 'corrigido_em', now(), 'motivo', r.proposta ->> 'motivo')) end,
    dados = r.proposta -> 'dados', nota = r.proposta ->> 'nota', status = 'publicado', proposta = null, confirmado_por = v, publicado_em = now()
  where id = p_id;
  perform interno.registrar('apoio_relatorio_publicado', p_id::text, jsonb_build_object('mes', r.mes, 'segunda_pessoa', v_segunda));
  return jsonb_build_object('id', p_id, 'publicado', true);
end $$;

create or replace function public.apoio_relatorio_descartar(p_id uuid) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
begin
  perform interno.eu();
  if not interno.coord() then perform interno.erro('sem_permissao'); end if;
  delete from apoio_relatorios where id = p_id and publicado_em is null;
  if not found then update apoio_relatorios set proposta = null where id = p_id; end if;
  perform interno.registrar('apoio_relatorio_descartado', p_id::text);
  return jsonb_build_object('ok', true);
end $$;

/** A prestação de contas pública: só os relatórios publicados, com o histórico das correções. Nenhum dado de pessoa. */
create or replace function public.apoio_relatorios_publicos() returns jsonb language sql stable security definer set search_path = interno, pg_temp as $$
  select coalesce(jsonb_agg(jsonb_build_object('mes', mes, 'dados', dados, 'nota', nota, 'publicado_em', publicado_em, 'historico', historico) order by mes desc), '[]'::jsonb)
  from apoio_relatorios where publicado_em is not null
$$;

/** Guarda os números do texto que foi copiado para a Benfeitoria, para o painel avisar quando ficarem velhos. */
create or replace function public.apoio_texto_copiado(p_numeros jsonb) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
begin
  perform interno.eu();
  if not interno.coord() then perform interno.erro('sem_permissao'); end if;
  if jsonb_typeof(p_numeros) <> 'object' or pg_column_size(p_numeros) > 2000 then perform interno.erro('invalido:numeros'); end if;
  insert into configuracoes (chave, valor) values ('apoio_texto', jsonb_build_object('numeros', p_numeros, 'em', now())) on conflict (chave) do update set valor = excluded.valor;
  return jsonb_build_object('ok', true);
end $$;

revoke all on function interno.apoio_padrao() from public, anon, authenticated;
revoke all on function interno.apoio_regras() from public, anon, authenticated;
revoke all on function interno.apoio_num(jsonb, text, numeric, numeric) from public, anon, authenticated;
revoke all on function interno.apoio_confirmavel(jsonb, text, integer) from public, anon, authenticated;
revoke all on function interno.apoio_validar(jsonb) from public, anon, authenticated;
revoke all on function interno.apoio_vitrine(jsonb) from public, anon, authenticated;
revoke all on function interno.apoio_somar(date) from public, anon, authenticated;
do $$
declare f text;
begin
  foreach f in array array['apoio_publico()', 'apoio_previa()', 'apoio_painel()', 'apoio_rascunho_salvar(jsonb)', 'apoio_publicar()', 'apoio_desfazer()', 'apoio_regras_salvar(jsonb)',
    'apoio_mural_pedir(text, text, text)', 'apoio_mural_decidir(uuid, boolean)', 'apoio_mural_adicionar(text, text, text)', 'apoio_mural_visivel(uuid, boolean)',
    'apoio_lancamento_salvar(jsonb)', 'apoio_lancamento_remover(uuid)', 'apoio_relatorio_pedir(text, text, text)', 'apoio_relatorio_confirmar(uuid)',
    'apoio_relatorio_descartar(uuid)', 'apoio_relatorios_publicos()', 'apoio_texto_copiado(jsonb)'] loop
    execute format('revoke all on function public.%s from public', f);
    execute format('grant execute on function public.%s to anon, authenticated, service_role', f);
  end loop;
end $$;

-- ───────────────────────────── Contribuir: acompanhar o envio ─────────────────────────────

/**
 * "Seus envios deste aparelho": a situação do que a pessoa mandou pela página de Contribuir, pelo código que ela recebeu
 * ao enviar (o id, que ninguém adivinha). Sem conta: o código é a chave. Mostra só o necessário: tipo, título, situação,
 * datas e o comentário da decisão.
 */
create or replace function public.contribuicao_situacao(p_ids uuid[]) returns jsonb language plpgsql stable security definer set search_path = interno, pg_temp as $$
begin
  if coalesce(array_length(p_ids, 1), 0) > 30 then perform interno.erro('invalido:ids'); end if;
  return (select coalesce(jsonb_agg(jsonb_build_object(
      'id', c.id, 'tipo', c.tipo, 'titulo', c.titulo, 'criado_em', c.criado_em,
      'situacao', case when c.status = 'pendente' and c.triagem = 'aguardando' then 'triagem' when c.status = 'pendente' then 'revisao' else c.status end,
      'decidido_em', coalesce(c.publicado_em, c.revisado_em),
      'nota', case when c.status in ('recusada', 'resolvida', 'aprovada', 'publicada') then c.nota else '' end) order by c.criado_em desc), '[]'::jsonb)
    from contribuicoes c where c.id = any(p_ids));
end $$;

revoke all on function public.contribuicao_situacao(uuid[]) from public;
grant execute on function public.contribuicao_situacao(uuid[]) to anon, authenticated, service_role;

-- ───────────────────────────── Comunidade: salas ─────────────────────────────

/** As salas (disciplinas) com o número de conversas visíveis em cada uma, e o total, para a barra lateral da Comunidade. */
create or replace function public.comunidade_salas() returns jsonb language sql stable security definer set search_path = interno, pg_temp as $$
  select interno.aberta('comunidade');
  select jsonb_build_object(
    'total', (select count(*) from topicos where not oculto),
    'salas', (select coalesce(jsonb_object_agg(disciplina, n), '{}'::jsonb) from (select disciplina, count(*) n from topicos where not oculto and disciplina is not null group by disciplina) x),
    'sem_resposta', (select count(*) from topicos where not oculto and respostas = 0 and tipo = 'duvida'))
$$;
revoke all on function public.comunidade_salas() from public;
grant execute on function public.comunidade_salas() to anon, authenticated, service_role;

-- ───────────────────────────── Exercícios de prática (Estúdio de prática) ─────────────────────────────
-- O educador da disciplina cria exercícios ligados às aulas: objetivo, material, programa, passo a passo e critérios.
-- Na aula aparece o exercício com "Abrir no estúdio"; a entrega vai pela Gaveta Aberta (link do vídeo) e o educador comenta.

create table if not exists interno.exercicios_pratica (
  id uuid primary key default gen_random_uuid(),
  disciplina text not null check (disciplina ~ '^[a-z0-9-]{2,40}$'),
  aula text not null check (aula ~ '^/trilhas/[a-z0-9-]{2,80}/[a-z0-9-]{2,80}$'),
  aula_titulo text not null default '' check (char_length(aula_titulo) <= 200),
  titulo text not null check (char_length(titulo) between 3 and 140),
  objetivo text not null check (char_length(objetivo) between 10 and 600),
  programa text not null check (programa in ('filmcraft', 'effectcraft', 'photocraft')),
  materiais jsonb not null default '[]'::jsonb,
  passos text not null check (char_length(passos) between 10 and 4000),
  criterios text not null check (char_length(criterios) between 5 and 2000),
  autor uuid references interno.perfis (id) on delete set null,
  ativo boolean not null default true,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
alter table interno.exercicios_pratica enable row level security;
create index if not exists exercicios_pratica_aula on interno.exercicios_pratica (aula) where ativo;

/** Quem ensina a disciplina (educação ou educação secundária dela), a curadoria e a coordenação. */
create or replace function interno.ensina(p_disciplina text) returns boolean language sql stable security definer set search_path = interno, pg_temp as $$
  select interno.coord() or interno.curador() or exists (select 1 from papeis p where p.usuario = auth.uid() and p.papel in ('educacao', 'educacao_secundaria') and p.disciplina = p_disciplina)
$$;
revoke all on function interno.ensina(text) from public, anon, authenticated;

create or replace function interno.exercicio_json(x interno.exercicios_pratica) returns jsonb language sql stable security definer set search_path = interno, pg_temp as $$
  select jsonb_build_object('id', x.id, 'disciplina', x.disciplina, 'aula', x.aula, 'aula_titulo', x.aula_titulo, 'titulo', x.titulo, 'objetivo', x.objetivo,
    'programa', x.programa, 'materiais', x.materiais, 'passos', x.passos, 'criterios', x.criterios, 'ativo', x.ativo,
    'autor', coalesce((select nome from perfis where id = x.autor), ''), 'atualizado_em', x.atualizado_em)
$$;
revoke all on function interno.exercicio_json(interno.exercicios_pratica) from public, anon, authenticated;

/** Os exercícios ativos de uma aula (ou de uma disciplina), para qualquer visitante. */
create or replace function public.exercicios_listar(p_aula text default null, p_disciplina text default null) returns jsonb language plpgsql stable security definer set search_path = interno, pg_temp as $$
begin
  perform interno.aberta('estudo');
  return (select coalesce(jsonb_agg(interno.exercicio_json(x) order by x.criado_em), '[]'::jsonb) from exercicios_pratica x
          where x.ativo and (coalesce(p_aula, '') = '' or x.aula = p_aula) and (coalesce(p_disciplina, '') = '' or x.disciplina = p_disciplina));
end $$;

create or replace function public.exercicio_ver(p_id uuid) returns jsonb language plpgsql stable security definer set search_path = interno, pg_temp as $$
declare x exercicios_pratica;
begin
  select * into x from exercicios_pratica where id = p_id and ativo;
  if not found then perform interno.erro('nao_encontrado'); end if;
  return interno.exercicio_json(x);
end $$;

/** Criar ou corrigir um exercício: só quem ensina a disciplina (ou a curadoria e a coordenação). */
create or replace function public.exercicio_salvar(p jsonb) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); v_disc text := interno.disciplina_ok(p ->> 'disciplina'); v_mat jsonb := '[]'::jsonb; m jsonb; x exercicios_pratica; v_id uuid;
begin
  v_id := nullif(p ->> 'id', '')::uuid;
  if v_disc is null then perform interno.erro('invalido:disciplina'); end if;
  if not interno.ensina(v_disc) then perform interno.erro('sem_permissao'); end if;
  perform interno.limite('exercicio_salvar', 60, 60);
  if coalesce(p ->> 'aula', '') !~ '^/trilhas/[a-z0-9-]{2,80}/[a-z0-9-]{2,80}$' then perform interno.erro('invalido:aula'); end if;
  if coalesce(p ->> 'programa', '') not in ('filmcraft', 'effectcraft', 'photocraft') then perform interno.erro('invalido:programa'); end if;
  if jsonb_typeof(coalesce(p -> 'materiais', '[]')) <> 'array' or jsonb_array_length(coalesce(p -> 'materiais', '[]')) > 8 then perform interno.erro('invalido:materiais'); end if;
  for m in select value from jsonb_array_elements(coalesce(p -> 'materiais', '[]')) loop
    if coalesce(m ->> 'url', '') !~ '^https://[^[:space:]"<>]{4,}$' or char_length(m ->> 'url') > 500 then perform interno.erro('invalido:materiais'); end if;
    v_mat := v_mat || jsonb_build_array(jsonb_build_object('titulo', interno.txt(m ->> 'titulo', 'material', 2, 120), 'url', m ->> 'url', 'credito', interno.txt(m ->> 'credito', 'credito', 0, 200)));
  end loop;
  if v_id is null then
    insert into exercicios_pratica (disciplina, aula, aula_titulo, titulo, objetivo, programa, materiais, passos, criterios, autor)
    values (v_disc, p ->> 'aula', interno.txt(p ->> 'aula_titulo', 'aula_titulo', 0, 200), interno.txt(p ->> 'titulo', 'titulo', 3, 140), interno.txt(p ->> 'objetivo', 'objetivo', 10, 600),
            p ->> 'programa', v_mat, interno.txt(p ->> 'passos', 'passos', 10, 4000), interno.txt(p ->> 'criterios', 'criterios', 5, 2000), v)
    returning * into x;
  else
    select * into x from exercicios_pratica where id = v_id for update;
    if not found then perform interno.erro('nao_encontrado'); end if;
    if not interno.ensina(x.disciplina) then perform interno.erro('sem_permissao'); end if;
    update exercicios_pratica set disciplina = v_disc, aula = p ->> 'aula', aula_titulo = interno.txt(p ->> 'aula_titulo', 'aula_titulo', 0, 200),
      titulo = interno.txt(p ->> 'titulo', 'titulo', 3, 140), objetivo = interno.txt(p ->> 'objetivo', 'objetivo', 10, 600), programa = p ->> 'programa',
      materiais = v_mat, passos = interno.txt(p ->> 'passos', 'passos', 10, 4000), criterios = interno.txt(p ->> 'criterios', 'criterios', 5, 2000), atualizado_em = now()
    where id = v_id returning * into x;
  end if;
  perform interno.registrar('exercicio_salvo', x.id::text, jsonb_build_object('aula', x.aula));
  return interno.exercicio_json(x);
exception when invalid_text_representation then
  perform interno.erro('invalido:id');
end $$;

create or replace function public.exercicio_arquivar(p_id uuid, p_ativo boolean default false) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare x exercicios_pratica;
begin
  perform interno.eu();
  select * into x from exercicios_pratica where id = p_id for update;
  if not found then perform interno.erro('nao_encontrado'); end if;
  if not interno.ensina(x.disciplina) then perform interno.erro('sem_permissao'); end if;
  update exercicios_pratica set ativo = coalesce(p_ativo, false), atualizado_em = now() where id = p_id;
  return jsonb_build_object('ok', true);
end $$;

/** No painel: os exercícios das disciplinas que a pessoa ensina (tudo, para a coordenação), com as entregas. */
create or replace function public.exercicios_meus() returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
begin
  perform interno.eu();
  if not (interno.educador() or interno.curador()) then perform interno.erro('sem_permissao'); end if;
  return (select coalesce(jsonb_agg(interno.exercicio_json(x) || jsonb_build_object(
            'entregas', (select count(*) from gaveta g where g.exercicio = x.id and g.status <> 'retirado'),
            'sem_retorno', (select count(*) from gaveta g where g.exercicio = x.id and g.status <> 'retirado' and g.retorno = '')) order by x.ativo desc, x.atualizado_em desc), '[]'::jsonb)
          from exercicios_pratica x where interno.ensina(x.disciplina));
end $$;

/** As entregas de um exercício, para quem ensina a disciplina comentar (o link do vídeo, o comentário e a situação na Gaveta). */
create or replace function public.exercicio_entregas(p_id uuid) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare x exercicios_pratica;
begin
  perform interno.eu();
  select * into x from exercicios_pratica where id = p_id;
  if not found then perform interno.erro('nao_encontrado'); end if;
  if not interno.ensina(x.disciplina) then perform interno.erro('sem_permissao'); end if;
  return (select coalesce(jsonb_agg(jsonb_build_object('id', g.id, 'titulo', g.titulo, 'autor', coalesce(f.nome, ''), 'credito', g.credito, 'link', g.link, 'arquivo', g.arquivo,
            'comentario', g.comentario, 'status', g.status, 'criado_em', g.criado_em, 'retorno', g.retorno, 'retorno_em', g.retorno_em) order by g.criado_em desc), '[]'::jsonb)
          from gaveta g left join perfis f on f.id = g.autor where g.exercicio = p_id and g.status <> 'retirado');
end $$;

/** O comentário do educador sobre uma entrega: quem entregou recebe um recado. */
create or replace function public.exercicio_retorno(p_gaveta uuid, p_texto text) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); g gaveta; x exercicios_pratica; v_texto text := interno.txt(p_texto, 'retorno', 5, 2000);
begin
  select * into g from gaveta where id = p_gaveta for update;
  if not found or g.exercicio is null then perform interno.erro('nao_encontrado'); end if;
  select * into x from exercicios_pratica where id = g.exercicio;
  if not interno.ensina(x.disciplina) then perform interno.erro('sem_permissao'); end if;
  update gaveta set retorno = v_texto, retorno_por = v, retorno_em = now() where id = p_gaveta;
  perform interno.avisar(g.autor, 'O educador comentou a sua entrega do exercício "' || left(x.titulo, 80) || '". Veja em Gaveta Aberta › Minhas publicações.');
  perform interno.registrar('exercicio_retorno', p_gaveta::text);
  return jsonb_build_object('ok', true);
end $$;

do $$
declare f text;
begin
  foreach f in array array['exercicios_listar(text, text)', 'exercicio_ver(uuid)', 'exercicio_salvar(jsonb)', 'exercicio_arquivar(uuid, boolean)', 'exercicios_meus()',
    'exercicio_entregas(uuid)', 'exercicio_retorno(uuid, text)'] loop
    execute format('revoke all on function public.%s from public', f);
    execute format('grant execute on function public.%s to anon, authenticated, service_role', f);
  end loop;
end $$;

-- ───────────────────────────── Sugestões da revisão ─────────────────────────────
-- Quem revisa marca um trecho do texto e propõe a troca ("trocar isto por aquilo", com um comentário). A pessoa que
-- escreveu (ou quem trabalha junto com ela) aceita com um clique, e a troca entra no texto, ou recusa.
create table if not exists interno.sugestoes_de_revisao (
  id uuid primary key default gen_random_uuid(),
  contribuicao uuid not null references interno.contribuicoes (id) on delete cascade,
  autor uuid references interno.perfis (id) on delete set null,
  trecho text not null check (char_length(trecho) between 1 and 2000),
  troca text not null default '' check (char_length(troca) <= 2000),
  comentario text not null default '' check (char_length(comentario) <= 1000),
  status text not null default 'aberta' check (status in ('aberta', 'aceita', 'recusada')),
  criado_em timestamptz not null default now(),
  decidido_em timestamptz,
  decidido_por uuid references interno.perfis (id) on delete set null
);
create index if not exists sugestoes_de_revisao_contribuicao on interno.sugestoes_de_revisao (contribuicao);
alter table interno.sugestoes_de_revisao enable row level security;
revoke all on interno.sugestoes_de_revisao from public;

create or replace function public.sugestao_criar(p_id uuid, p_trecho text, p_troca text, p_comentario text) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); c contribuicoes; v_id uuid;
begin
  perform interno.limite('sugestao', 120, 60);
  select * into c from contribuicoes where id = p_id;
  if not found then perform interno.erro('nao_encontrado'); end if;
  if not interno.ve_item(c) then perform interno.erro('sem_permissao'); end if;
  if c.status <> 'pendente' then perform interno.erro('ja_decidida'); end if;
  if coalesce(p_trecho, '') = '' or char_length(p_trecho) > 2000 or strpos(c.corpo, p_trecho) = 0 then perform interno.erro('invalido:trecho'); end if;
  if char_length(coalesce(p_troca, '')) > 2000 then perform interno.erro('invalido:troca'); end if;
  if p_troca = p_trecho and coalesce(btrim(p_comentario), '') = '' then perform interno.erro('invalido:troca'); end if;
  insert into sugestoes_de_revisao (contribuicao, autor, trecho, troca, comentario)
  values (p_id, v, p_trecho, coalesce(p_troca, ''), left(coalesce(btrim(p_comentario), ''), 1000)) returning id into v_id;
  if c.autor is not null and c.autor <> v then
    perform interno.avisar(c.autor, 'A revisão sugeriu uma mudança em "' || left(c.titulo, 80) || '". Aceite ou recuse em Meus envios.');
  end if;
  return jsonb_build_object('id', v_id);
end $$;

create or replace function public.sugestoes_listar(p_id uuid) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare c contribuicoes;
begin
  select * into c from contribuicoes where id = p_id;
  if not found then perform interno.erro('nao_encontrado'); end if;
  if not (coalesce(c.autor = auth.uid(), false) or interno.ve_item(c) or interno.colabora(c.id)) then perform interno.erro('sem_permissao'); end if;
  return coalesce((select jsonb_agg(jsonb_build_object('id', s.id, 'trecho', s.trecho, 'troca', s.troca, 'comentario', s.comentario, 'status', s.status,
                                                       'autor', coalesce(interno.nome_visto(f.nome), 'Revisão'), 'criado_em', s.criado_em,
                                                       'cabe', strpos(c.corpo, s.trecho) > 0) order by s.criado_em)
                   from sugestoes_de_revisao s left join perfis f on f.id = s.autor where s.contribuicao = p_id), '[]'::jsonb);
end $$;

create or replace function public.sugestao_responder(p_sugestao uuid, p_aceitar boolean) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); s sugestoes_de_revisao; c contribuicoes; v_pos int;
begin
  select * into s from sugestoes_de_revisao where id = p_sugestao for update;
  if not found then perform interno.erro('nao_encontrado'); end if;
  if s.status <> 'aberta' then perform interno.erro('ja_decidida'); end if;
  select * into c from contribuicoes where id = s.contribuicao for update;
  if not (coalesce(c.autor = v, false) or interno.colabora(c.id) or interno.curador()) then perform interno.erro('sem_permissao'); end if;
  if c.status <> 'pendente' then perform interno.erro('ja_decidida'); end if;
  if p_aceitar then
    v_pos := strpos(c.corpo, s.trecho);
    if v_pos = 0 then perform interno.erro('trecho_mudou'); end if;
    update contribuicoes set corpo = overlay(corpo placing s.troca from v_pos for char_length(s.trecho)), editado_em = clock_timestamp(), editado_por = v where id = c.id;
  end if;
  update sugestoes_de_revisao set status = case when p_aceitar then 'aceita' else 'recusada' end, decidido_em = now(), decidido_por = v where id = p_sugestao;
  return jsonb_build_object('ok', true);
end $$;

do $$
declare f text;
begin
  foreach f in array array['sugestao_criar(uuid, text, text, text)', 'sugestoes_listar(uuid)', 'sugestao_responder(uuid, boolean)'] loop
    execute format('revoke all on function public.%s from public', f);
    execute format('grant execute on function public.%s to anon, authenticated, service_role', f);
  end loop;
end $$;

-- ───────────────────────────── Cadernos prontos ─────────────────────────────
-- Coleções de fontes do próprio site (aulas, obras, páginas) montadas por voluntários por trilha ou tema. Quem estuda
-- duplica uma delas para o caderno do próprio aparelho com um clique. Guardam só os endereços: o texto vem do site.
-- Antes de aparecer, passam pela revisão (coordenação, curadoria, revisão, supervisão ou um educador da disciplina).
create table if not exists interno.cadernos_prontos (
  id uuid primary key default gen_random_uuid(),
  titulo text not null check (char_length(titulo) between 3 and 120),
  descricao text not null default '' check (char_length(descricao) <= 500),
  disciplina text,
  fontes jsonb not null default '[]'::jsonb,
  autor uuid references interno.perfis (id) on delete set null,
  status text not null default 'pendente' check (status in ('pendente', 'publicado', 'recusado', 'arquivado')),
  nota text not null default '' check (char_length(nota) <= 1000),
  criado_em timestamptz not null default now(),
  decidido_em timestamptz,
  decidido_por uuid references interno.perfis (id) on delete set null
);
alter table interno.cadernos_prontos enable row level security;
revoke all on interno.cadernos_prontos from public;

create or replace function interno.revisa_caderno(p_disciplina text) returns boolean language sql stable security definer set search_path = interno, pg_temp as $$
  select interno.coord() or interno.curador() or interno.tem('revisao') or interno.tem('supervisao')
    or (p_disciplina is not null and exists (select 1 from papeis where usuario = auth.uid() and papel in ('educacao', 'educacao_secundaria') and disciplina = p_disciplina))
$$;

create or replace function interno.caderno_pronto_json(c interno.cadernos_prontos) returns jsonb language sql stable security definer set search_path = interno, pg_temp as $$
  select jsonb_build_object('id', c.id, 'titulo', c.titulo, 'descricao', c.descricao, 'disciplina', c.disciplina, 'fontes', c.fontes, 'status', c.status,
                            'nota', c.nota, 'autor', coalesce(interno.nome_visto((select nome from perfis where id = c.autor)), ''), 'criado_em', c.criado_em)
$$;

create or replace function public.caderno_pronto_enviar(p jsonb) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); v_fontes jsonb; v_id uuid; v_disc text := nullif(p ->> 'disciplina', '');
begin
  if not interno.voluntario() then perform interno.erro('sem_permissao'); end if;
  perform interno.limite('caderno_pronto', 10, 60);
  if jsonb_typeof(p -> 'fontes') <> 'array' then perform interno.erro('invalido:fontes'); end if;
  select coalesce(jsonb_agg(jsonb_build_object('titulo', left(btrim(f ->> 'titulo'), 160), 'origem', f ->> 'origem')), '[]'::jsonb) into v_fontes
  from jsonb_array_elements(p -> 'fontes') f
  where coalesce(f ->> 'origem', '') ~ '^/[a-z0-9/-]{1,200}$' and char_length(btrim(coalesce(f ->> 'titulo', ''))) between 1 and 160;
  if jsonb_array_length(v_fontes) not between 1 and 30 then perform interno.erro('invalido:fontes'); end if;
  if v_disc is not null and v_disc !~ '^[a-z0-9-]{2,40}$' then perform interno.erro('invalido:disciplina'); end if;
  insert into cadernos_prontos (titulo, descricao, disciplina, fontes, autor)
  values (interno.txt(p ->> 'titulo', 'titulo', 3, 120), left(btrim(coalesce(p ->> 'descricao', '')), 500), v_disc, v_fontes, v) returning id into v_id;
  perform interno.registrar('caderno_pronto_enviado', v_id::text);
  return jsonb_build_object('id', v_id);
end $$;

create or replace function public.cadernos_prontos_fila() returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
begin
  perform interno.eu();
  return coalesce((select jsonb_agg(interno.caderno_pronto_json(c) order by c.criado_em) from cadernos_prontos c
                   where (c.status = 'pendente' and interno.revisa_caderno(c.disciplina) and c.autor is distinct from auth.uid()) or c.autor = auth.uid()), '[]'::jsonb);
end $$;

create or replace function public.caderno_pronto_decidir(p_id uuid, p_publicar boolean, p_nota text default '') returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); c cadernos_prontos;
begin
  select * into c from cadernos_prontos where id = p_id for update;
  if not found then perform interno.erro('nao_encontrado'); end if;
  if c.autor = v and not interno.coord() then perform interno.erro('sem_permissao'); end if;
  if not interno.revisa_caderno(c.disciplina) then perform interno.erro('sem_permissao'); end if;
  if c.status = 'publicado' and not p_publicar then
    update cadernos_prontos set status = 'arquivado', decidido_em = now(), decidido_por = v where id = p_id;
  elsif c.status <> 'pendente' then perform interno.erro('ja_decidida');
  else
    update cadernos_prontos set status = case when p_publicar then 'publicado' else 'recusado' end, nota = left(coalesce(btrim(p_nota), ''), 1000), decidido_em = now(), decidido_por = v where id = p_id;
  end if;
  if c.autor is not null and c.autor <> v then
    perform interno.avisar(c.autor, case when p_publicar then 'O caderno pronto "' || left(c.titulo, 80) || '" foi publicado no Caderno de estudos.' else 'O caderno pronto "' || left(c.titulo, 80) || '" não foi publicado. Veja o recado no Caderno de estudos do painel.' end);
  end if;
  perform interno.registrar('caderno_pronto_decidido', p_id::text);
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.cadernos_prontos_listar() returns jsonb language sql stable security definer set search_path = interno, pg_temp as $$
  select coalesce(jsonb_agg(jsonb_build_object('id', c.id, 'titulo', c.titulo, 'descricao', c.descricao, 'disciplina', c.disciplina, 'fontes', c.fontes) order by c.decidido_em desc), '[]'::jsonb)
  from cadernos_prontos c where c.status = 'publicado'
$$;

-- ───────────────────────────── Certificado de participação de quem estuda ─────────────────────────────
-- Quem conclui todas as aulas de uma trilha (o progresso fica no aparelho) pede um certificado de participação. O site
-- guarda só o nome que a pessoa escreveu, a trilha e a data, para qualquer um conferir o número depois. Não é diploma:
-- declara que a pessoa estudou as aulas da trilha no Instituto Lúcia.
create table if not exists interno.certificados_alunos (
  codigo text primary key check (codigo ~ '^A[A-Z0-9]{11}$'),
  nome text not null check (char_length(nome) between 3 and 120),
  trilha text not null check (trilha ~ '^[a-z0-9-]{2,80}$'),
  trilha_titulo text not null check (char_length(trilha_titulo) between 2 and 160),
  aulas integer not null check (aulas between 1 and 200),
  emitido_em timestamptz not null default now()
);
alter table interno.certificados_alunos enable row level security;
revoke all on interno.certificados_alunos from public;

create or replace function public.certificado_aluno_emitir(p_nome text, p_trilha text, p_titulo text, p_aulas integer) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v_codigo text; v_nome text := interno.txt(p_nome, 'nome', 3, 120);
begin
  perform interno.limite('certificado_aluno', 5, 60);
  if coalesce(p_trilha, '') !~ '^[a-z0-9-]{2,80}$' then perform interno.erro('invalido:trilha'); end if;
  if coalesce(p_aulas, 0) not between 1 and 200 then perform interno.erro('invalido:aulas'); end if;
  if v_nome ~ '(https?://|www\.|@)' then perform interno.erro('invalido:nome'); end if;
  loop
    v_codigo := 'A' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 11));
    exit when v_codigo ~ '^A[A-Z0-9]{11}$' and not exists (select 1 from certificados_alunos where codigo = v_codigo);
  end loop;
  insert into certificados_alunos (codigo, nome, trilha, trilha_titulo, aulas) values (v_codigo, v_nome, p_trilha, interno.txt(p_titulo, 'titulo', 2, 160), p_aulas);
  return jsonb_build_object('codigo', v_codigo, 'emitido_em', now());
end $$;

do $$
declare f text;
begin
  foreach f in array array['caderno_pronto_enviar(jsonb)', 'cadernos_prontos_fila()', 'caderno_pronto_decidir(uuid, boolean, text)', 'cadernos_prontos_listar()',
    'certificado_aluno_emitir(text, text, text, integer)'] loop
    execute format('revoke all on function public.%s from public', f);
    execute format('grant execute on function public.%s to anon, authenticated, service_role', f);
  end loop;
end $$;

-- ───────────────────────────── Resoluções das questões de provas públicas ─────────────────────────────
-- As questões do ENEM (e de outras provas públicas que tiverem fonte aberta) entram sozinhas no banco de questões. A
-- resolução comentada é escrita por quem ensina: educadores e educadores secundários publicam direto (a coordenação,
-- a coordenação pedagógica e a revisão podem tirar do ar). Também servem para apontar erro no gabarito da fonte.
create table if not exists interno.questoes_resolucoes (
  id uuid primary key default gen_random_uuid(),
  questao text not null check (questao ~ '^[a-z0-9-]{3,80}$'),
  autor uuid references interno.perfis (id) on delete set null,
  texto text not null check (char_length(texto) between 20 and 6000),
  status text not null default 'publicada' check (status in ('publicada', 'retirada')),
  criado_em timestamptz not null default now(),
  retirada_por uuid references interno.perfis (id) on delete set null
);
create index if not exists questoes_resolucoes_questao on interno.questoes_resolucoes (questao);
alter table interno.questoes_resolucoes enable row level security;
revoke all on interno.questoes_resolucoes from public;

create or replace function interno.resolve_questoes() returns boolean language sql stable security definer set search_path = interno, pg_temp as $$
  select interno.coord() or interno.tem('educacao') or interno.tem('educacao_secundaria') or interno.tem('revisao') or interno.tem('vice') or interno.tem('supervisao')
$$;

create or replace function public.resolucao_enviar(p_questao text, p_texto text) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); v_id uuid;
begin
  if not interno.resolve_questoes() then perform interno.erro('sem_permissao'); end if;
  perform interno.limite('resolucao', 60, 60);
  if coalesce(p_questao, '') !~ '^[a-z0-9-]{3,80}$' then perform interno.erro('invalido:questao'); end if;
  insert into questoes_resolucoes (questao, autor, texto) values (p_questao, v, interno.txt(p_texto, 'texto', 20, 6000)) returning id into v_id;
  perform interno.registrar('resolucao_enviada', p_questao);
  return jsonb_build_object('id', v_id);
end $$;

create or replace function public.resolucoes_listar(p_questoes text[]) returns jsonb language sql stable security definer set search_path = interno, pg_temp as $$
  select coalesce(jsonb_agg(jsonb_build_object('id', r.id, 'questao', r.questao, 'texto', r.texto, 'autor', coalesce(interno.nome_visto(f.nome), 'Educador'),
                                               'criado_em', r.criado_em, 'minha', r.autor = auth.uid()) order by r.criado_em), '[]'::jsonb)
  from questoes_resolucoes r left join perfis f on f.id = r.autor
  where r.status = 'publicada' and r.questao = any ((coalesce(p_questoes, '{}'::text[]))[1:60])
$$;

create or replace function public.resolucao_retirar(p_id uuid) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); r questoes_resolucoes;
begin
  select * into r from questoes_resolucoes where id = p_id for update;
  if not found then perform interno.erro('nao_encontrado'); end if;
  if not (r.autor = v or interno.coord() or interno.tem('vice') or interno.tem('revisao')) then perform interno.erro('sem_permissao'); end if;
  update questoes_resolucoes set status = 'retirada', retirada_por = v where id = p_id;
  perform interno.registrar('resolucao_retirada', r.questao);
  return jsonb_build_object('ok', true);
end $$;

do $$
declare f text;
begin
  foreach f in array array['resolucao_enviar(text, text)', 'resolucoes_listar(text[])', 'resolucao_retirar(uuid)'] loop
    execute format('revoke all on function public.%s from public', f);
    execute format('grant execute on function public.%s to anon, authenticated, service_role', f);
  end loop;
end $$;

-- ───────────────────────────── Rodada 4: convites entre disciplinas, fotos, termos para sempre, saúde ─────────────
-- Cada educador cuida da própria disciplina: escreve aulas, materiais e questões só para ela, e só vê as trilhas dela
-- em Disciplinas e trilhas. Para outra disciplina, só com o convite de quem ensina lá (ou da coordenação).

alter table interno.perfis add column if not exists foto_pendente text not null default '' check (char_length(foto_pendente) <= 40000);
alter table interno.perfis add column if not exists foto_enviada_em timestamptz;
alter table interno.perfis add column if not exists termo_voluntario_versao text;

/** A versão vigente do termo de voluntário que aparece ao entrar no painel (o texto mora em lib/termos.ts). */
create or replace function interno.termo_voluntario_vigente() returns text language sql immutable as $$ select '2026-10-20'::text $$;

create table if not exists interno.disciplina_convites (
  id uuid primary key default gen_random_uuid(),
  disciplina text not null check (disciplina ~ '^[a-z0-9-]{2,40}$'),
  trilha text check (trilha is null or trilha ~ '^[a-z0-9-]{2,80}$'),
  convidado uuid not null references interno.perfis (id) on delete cascade,
  convidado_por uuid references interno.perfis (id) on delete set null,
  nota text not null default '' check (char_length(nota) <= 500),
  criado_em timestamptz not null default now(),
  revogado_em timestamptz,
  revogado_por uuid references interno.perfis (id) on delete set null
);
create unique index if not exists disciplina_convites_ativo on interno.disciplina_convites (disciplina, coalesce(trilha, ''), convidado) where revogado_em is null;
create index if not exists disciplina_convites_convidado on interno.disciplina_convites (convidado) where revogado_em is null;
alter table interno.disciplina_convites enable row level security;

/** Ensina esta disciplina por função (educação ou educação secundária), não por convite. */
create or replace function interno.leciona(p_disc text, p_usuario uuid default null) returns boolean language sql stable security definer set search_path = interno, pg_temp as $$
  select p_disc is not null and exists (select 1 from papeis p join perfis f on f.id = p.usuario
                                        where p.usuario = coalesce(p_usuario, auth.uid()) and not f.suspenso
                                          and p.papel in ('educacao', 'educacao_secundaria') and p.disciplina = p_disc)
$$;

/**
 * Pode escrever para esta disciplina (aula, material avulso, questão, temas, vídeo indicado, trilhas em Disciplinas e
 * trilhas): quem ensina a disciplina, quem foi convidado por quem ensina, e quem cuida do site inteiro (coordenação,
 * coordenação pedagógica, supervisão, curadoria e revisão).
 */
create or replace function interno.escreve_em(p_disc text) returns boolean language sql stable security definer set search_path = interno, pg_temp as $$
  select p_disc is not null and (
    interno.coord() or interno.tem('vice') or interno.tem('supervisao') or interno.curador() or interno.tem('revisao')
    or interno.leciona(p_disc)
    or exists (select 1 from disciplina_convites c where c.convidado = auth.uid() and c.revogado_em is null and c.disciplina = p_disc))
$$;

/** Quem ensina a disciplina (ou a coordenação) convida outra pessoa da equipe para ajudar nela, numa trilha ou em toda. */
create or replace function public.disciplina_convidar(p_usuario uuid, p_disciplina text, p_trilha text default null, p_nota text default '') returns jsonb
language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); v_id uuid;
begin
  if coalesce(p_disciplina, '') !~ '^[a-z0-9-]{2,40}$' then perform interno.erro('invalido:disciplina'); end if;
  if p_trilha is not null and p_trilha !~ '^[a-z0-9-]{2,80}$' then perform interno.erro('invalido:trilha'); end if;
  if not (interno.leciona(p_disciplina) or interno.coord() or interno.tem('vice')) then perform interno.erro('sem_permissao'); end if;
  perform interno.limite('disciplina_convite', 40, 1440);
  if p_usuario is null or p_usuario = v or not exists (select 1 from perfis f where f.id = p_usuario and not f.suspenso)
     or not exists (select 1 from papeis where usuario = p_usuario) then perform interno.erro('nao_encontrado'); end if;
  if interno.leciona(p_disciplina, p_usuario) then perform interno.erro('ja_ensina'); end if;
  insert into disciplina_convites (disciplina, trilha, convidado, convidado_por, nota)
  values (p_disciplina, p_trilha, p_usuario, v, interno.txt(p_nota, 'nota', 0, 500))
  on conflict (disciplina, coalesce(trilha, ''), convidado) where revogado_em is null do nothing
  returning id into v_id;
  perform interno.avisar(p_usuario, coalesce((select interno.primeiro_nome(nome) from perfis where id = v), 'Alguém') || ' convidou você para ajudar na disciplina ' || p_disciplina
    || coalesce(' (trilha ' || p_trilha || ')', '') || '. Ela já aparece em Escrever e em Disciplinas e trilhas.');
  perform interno.registrar('disciplina_convite', p_usuario::text, jsonb_build_object('disciplina', p_disciplina, 'trilha', p_trilha));
  return jsonb_build_object('ok', true, 'id', v_id);
end $$;

/** Os convites ativos que me dizem respeito: os que recebi, os das disciplinas em que ensino e, para a coordenação, todos. */
create or replace function public.disciplina_convites() returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu();
begin
  if not interno.voluntario() then perform interno.erro('sem_permissao'); end if;
  return (select coalesce(jsonb_agg(jsonb_build_object('id', c.id, 'disciplina', c.disciplina, 'trilha', c.trilha, 'nota', c.nota, 'criado_em', c.criado_em,
            'convidado', interno.nome_visto(a.nome), 'convidado_id', c.convidado, 'por', coalesce(interno.nome_visto(b.nome), ''), 'meu', c.convidado = v,
            'posso_revogar', c.convidado = v or c.convidado_por = v or interno.leciona(c.disciplina) or interno.coord() or interno.tem('vice')) order by c.criado_em desc), '[]'::jsonb)
          from disciplina_convites c join perfis a on a.id = c.convidado left join perfis b on b.id = c.convidado_por
          where c.revogado_em is null and (c.convidado = v or c.convidado_por = v or interno.leciona(c.disciplina) or interno.coord() or interno.tem('vice')));
end $$;

create or replace function public.disciplina_convite_revogar(p_id uuid) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); c disciplina_convites;
begin
  select * into c from disciplina_convites where id = p_id and revogado_em is null for update;
  if not found then perform interno.erro('nao_encontrado'); end if;
  if not (c.convidado = v or c.convidado_por = v or interno.leciona(c.disciplina) or interno.coord() or interno.tem('vice')) then perform interno.erro('sem_permissao'); end if;
  update disciplina_convites set revogado_em = now(), revogado_por = v where id = p_id;
  if c.convidado <> v then perform interno.avisar(c.convidado, 'O seu convite para ajudar na disciplina ' || c.disciplina || ' foi encerrado. Obrigado pela ajuda!'); end if;
  perform interno.registrar('disciplina_convite_fim', c.convidado::text, jsonb_build_object('disciplina', c.disciplina));
  return jsonb_build_object('ok', true);
end $$;

-- Traduções em dupla (ou mais): quem reservou a aula convida outros tradutores para ela.
create table if not exists interno.traducao_coautores (
  alvo text not null check (alvo ~ '^/trilhas/[a-z0-9-]+/[a-z0-9-]+$'),
  idioma text not null check (idioma in ('en', 'es', 'zh', 'ru', 'fr')),
  usuario uuid not null references interno.perfis (id) on delete cascade,
  convidado_por uuid references interno.perfis (id) on delete set null,
  criado_em timestamptz not null default now(),
  primary key (alvo, idioma, usuario)
);
alter table interno.traducao_coautores enable row level security;

create or replace function public.traducao_convidar(p_alvo text, p_idioma text, p_usuario uuid) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu();
begin
  if not exists (select 1 from traducao_reservas where alvo = p_alvo and idioma = p_idioma and (usuario = v or interno.coord())) then perform interno.erro('sem_permissao'); end if;
  if p_usuario is null or p_usuario = v or not exists (select 1 from papeis p join perfis f on f.id = p.usuario where p.usuario = p_usuario and not f.suspenso and (p.papel in ('traducao', 'curadoria', 'coordenacao', 'vice'))) then
    perform interno.erro('nao_encontrado');
  end if;
  if (select count(*) from traducao_coautores where alvo = p_alvo and idioma = p_idioma) >= 5 then perform interno.erro('invalido:coautores'); end if;
  insert into traducao_coautores (alvo, idioma, usuario, convidado_por) values (p_alvo, p_idioma, p_usuario, v) on conflict do nothing;
  perform interno.avisar(p_usuario, coalesce((select interno.primeiro_nome(nome) from perfis where id = v), 'Alguém') || ' chamou você para traduzir junto a aula ' || p_alvo || ' (' || p_idioma || '). Abra Traduções › A caminho.');
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.traducao_coautor_tirar(p_alvo text, p_idioma text, p_usuario uuid) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu();
begin
  delete from traducao_coautores c where c.alvo = p_alvo and c.idioma = p_idioma and c.usuario = p_usuario
    and (p_usuario = v or interno.coord() or exists (select 1 from traducao_reservas r where r.alvo = p_alvo and r.idioma = p_idioma and r.usuario = v));
  if not found then perform interno.erro('nao_encontrado'); end if;
  return jsonb_build_object('ok', true);
end $$;

-- Fotos de perfil esperando a coordenação.
create or replace function public.fotos_pendentes() returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
begin
  perform interno.eu();
  if not (interno.coord() or interno.tem('vice')) then perform interno.erro('sem_permissao'); end if;
  return (select coalesce(jsonb_agg(jsonb_build_object('id', f.id, 'nome', f.nome, 'foto', f.foto_pendente, 'enviada_em', f.foto_enviada_em, 'atual', f.avatar,
            'funcoes', (select coalesce(jsonb_agg(distinct interno.nome_papel(p.papel)), '[]'::jsonb) from papeis p where p.usuario = f.id)) order by f.foto_enviada_em), '[]'::jsonb)
          from perfis f where f.foto_pendente <> '');
end $$;

create or replace function public.foto_decidir(p_usuario uuid, p_aprovar boolean) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
begin
  perform interno.eu();
  if not (interno.coord() or interno.tem('vice')) then perform interno.erro('sem_permissao'); end if;
  if not exists (select 1 from perfis where id = p_usuario and foto_pendente <> '') then perform interno.erro('nao_encontrado'); end if;
  update perfis set avatar = case when p_aprovar then foto_pendente else avatar end, foto_pendente = '', foto_enviada_em = null where id = p_usuario;
  perform interno.avisar(p_usuario, case when p_aprovar then 'Sua foto de perfil foi aprovada e já aparece no seu cartão.' else 'Sua foto de perfil não foi aprovada. Tente outra, de rosto, com boa luz e sem outras pessoas.' end);
  perform interno.registrar(case when p_aprovar then 'foto_aprovada' else 'foto_recusada' end, p_usuario::text, '{}'::jsonb);
  return jsonb_build_object('ok', true);
end $$;

-- ───────────────────────────── Termos aceitos, guardados para sempre ─────────────────────────────
-- Cada aceite (o termo de voluntário ao entrar no painel, o termo de adesão das horas, o termo da vitrine de saúde) fica
-- registrado com o texto inteiro que a pessoa leu, a versão, o resumo SHA-256 e a data. Não tem chave estrangeira para a
-- conta: se a conta for apagada, o registro fica (é a prova do voluntariado e da licença do que foi publicado). Ninguém
-- altera nem apaga: um gatilho recusa UPDATE e DELETE para qualquer papel.
create table if not exists interno.termos_aceites (
  id uuid primary key default gen_random_uuid(),
  usuario uuid,
  nome text not null check (char_length(nome) between 1 and 120),
  termo text not null check (termo ~ '^[a-z0-9-]{2,40}$'),
  versao text not null check (char_length(versao) between 1 and 40),
  texto text not null check (char_length(texto) between 20 and 60000),
  sha256 text not null check (sha256 ~ '^[a-f0-9]{64}$'),
  dados jsonb not null default '{}'::jsonb check (pg_column_size(dados) <= 4000),
  navegador text not null default '' check (char_length(navegador) <= 300),
  aceito_em timestamptz not null default now()
);
create index if not exists termos_aceites_usuario on interno.termos_aceites (usuario, aceito_em desc);
alter table interno.termos_aceites enable row level security;

create or replace function interno.termos_aceites_imutavel() returns trigger language plpgsql as $$
begin
  raise exception 'termos aceitos não se alteram nem se apagam';
end $$;
drop trigger if exists lucia_termos_aceites_imutavel on interno.termos_aceites;
create trigger lucia_termos_aceites_imutavel before update or delete on interno.termos_aceites for each row execute function interno.termos_aceites_imutavel();
drop trigger if exists lucia_termos_aceites_sem_truncar on interno.termos_aceites;
create trigger lucia_termos_aceites_sem_truncar before truncate on interno.termos_aceites for each statement execute function interno.termos_aceites_imutavel();

/** Registra um aceite com o texto que a pessoa leu. Os dados extras (maioridade, responsável, registro) vêm do formulário. */
create or replace function public.termo_registrar(p_termo text, p_versao text, p_texto text, p_dados jsonb default '{}'::jsonb) returns jsonb
language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); v_texto text := interno.txt(p_texto, 'texto', 20, 60000); v_sha text; v_id uuid; v_agente text;
begin
  perform interno.limite('termo_registrar', 30, 60);
  if coalesce(p_termo, '') not in ('voluntario', 'adesao', 'saude') then perform interno.erro('invalido:termo'); end if;
  if jsonb_typeof(coalesce(p_dados, '{}'::jsonb)) <> 'object' or pg_column_size(p_dados) > 4000 then perform interno.erro('invalido:dados'); end if;
  v_sha := encode(sha256(convert_to(v_texto, 'UTF8')), 'hex');
  begin
    v_agente := left(coalesce(current_setting('request.headers', true)::json ->> 'user-agent', ''), 300);
  exception when others then v_agente := '';
  end;
  insert into termos_aceites (usuario, nome, termo, versao, texto, sha256, dados, navegador)
  values (v, coalesce((select nome from perfis where id = v), ''), p_termo, interno.txt(p_versao, 'versao', 1, 40), v_texto, v_sha, coalesce(p_dados, '{}'::jsonb), v_agente)
  returning id into v_id;
  return jsonb_build_object('id', v_id, 'sha256', v_sha, 'aceito_em', now());
end $$;

create or replace function public.termos_meus() returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu();
begin
  return (select coalesce(jsonb_agg(jsonb_build_object('id', t.id, 'termo', t.termo, 'versao', t.versao, 'texto', t.texto, 'sha256', t.sha256, 'dados', t.dados, 'aceito_em', t.aceito_em)
            order by t.aceito_em desc), '[]'::jsonb) from termos_aceites t where t.usuario = v);
end $$;

/** Para a coordenação: todos os aceites (inclusive de contas já apagadas), sem o texto, que se lê pelo id. */
create or replace function public.termos_aceites_listar(p_texto_de uuid default null) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
begin
  perform interno.eu();
  if not (interno.coord() or interno.tem('vice')) then perform interno.erro('sem_permissao'); end if;
  if p_texto_de is not null then return (select to_jsonb(t) - 'navegador' from termos_aceites t where t.id = p_texto_de); end if;
  return (select coalesce(jsonb_agg(jsonb_build_object('id', t.id, 'nome', t.nome, 'termo', t.termo, 'versao', t.versao, 'sha256', t.sha256, 'dados', t.dados, 'aceito_em', t.aceito_em,
            'conta_apagada', t.usuario is null or not exists (select 1 from perfis f where f.id = t.usuario)) order by t.aceito_em desc), '[]'::jsonb)
          from (select * from termos_aceites order by aceito_em desc limit 2000) t);
end $$;

-- ───────────────────────────── Saúde Solidária: a vitrine de profissionais de saúde ─────────────────────────────
-- Um mural de contatos, como o Mural dos Trabalhadores: o instituto só mostra o contato que o profissional autorizou e
-- não presta, agenda, intermedeia nem garante atendimento. Sem chat, sem agenda, sem dado de paciente. Um profissional
-- só aparece se TUDO valer ao mesmo tempo, conferido a cada leitura pública (interno.saude_apto): tem o cargo de
-- profissional de saúde; aceitou a versão vigente do termo; a coordenação conferiu o registro no conselho há menos de
-- 180 dias; o profissional aprovou o texto final do próprio perfil; a coordenação publicou; não está suspenso nem pediu
-- remoção; e a chave geral da vitrine não está desligada (configuracoes 'saude' › desligada).
create table if not exists interno.saude_perfis (
  usuario uuid primary key references interno.perfis (id) on delete cascade,
  nome text not null default '' check (char_length(nome) <= 80),
  profissao text not null default '' check (char_length(profissao) <= 60),
  conselho text not null default '' check (conselho = '' or conselho ~ '^[A-Za-z]{2,10}$'),
  uf text not null default '' check (uf = '' or uf ~ '^[A-Z]{2}$'),
  registro text not null default '' check (char_length(registro) <= 30),
  abordagem text not null default '' check (char_length(abordagem) <= 120),
  areas text[] not null default '{}' check (cardinality(areas) <= 12),
  modalidade text not null default 'online' check (modalidade in ('online', 'presencial', 'ambas')),
  cidade text not null default '' check (char_length(cidade) <= 80),
  valor text not null default 'social' check (valor in ('gratuito', 'social', 'ambos')),
  bio text not null default '' check (char_length(bio) <= 900),
  contatos jsonb not null default '{}'::jsonb check (pg_column_size(contatos) <= 2000),
  foto text not null default '' check (char_length(foto) <= 60000),
  foto_autorizada boolean not null default false,
  status text not null default 'rascunho' check (status in ('rascunho', 'aguardando', 'publicado', 'suspenso', 'removido')),
  texto_aprovado_em timestamptz,
  termo_versao text,
  verificado_em date,
  verificado_por uuid references interno.perfis (id) on delete set null,
  verificacao_nota text not null default '' check (char_length(verificacao_nota) <= 500),
  atualizado_em timestamptz not null default now()
);
alter table interno.saude_perfis enable row level security;

create or replace function interno.saude_termo_vigente() returns text language sql immutable as $$ select '2026-10-20'::text $$;

create or replace function interno.saude_desligada() returns boolean language sql stable security definer set search_path = interno, pg_temp as $$
  select coalesce((select (valor ->> 'desligada')::boolean from configuracoes where chave = 'saude'), false)
$$;

create or replace function interno.saude_apto(s interno.saude_perfis) returns boolean language sql stable security definer set search_path = interno, pg_temp as $$
  select not interno.saude_desligada()
    and s.status = 'publicado'
    and s.termo_versao = interno.saude_termo_vigente()
    and s.verificado_em is not null and s.verificado_em > current_date - 180
    and s.texto_aprovado_em is not null
    and exists (select 1 from papeis p join perfis f on f.id = p.usuario where p.usuario = s.usuario and p.papel = 'saude' and not f.suspenso)
$$;

/** Texto que não pode ir para a vitrine: preço, promessa de resultado, "o melhor", depoimento. Devolve o motivo ou null. */
create or replace function interno.saude_texto_proibido(p text) returns text language sql immutable as $$
  select case
    when p ~* 'r\$\s*\d|\d+\s*reais' then 'Não ponha preço: o valor é combinado direto com cada pessoa.'
    when p ~* '\m(cura|curar|garant[a-z]*|100\s*%|resultado garantido)\M' then 'Não prometa cura nem resultado.'
    when p ~* '\m(o|a) melhor\M|\mmelhores\M|\mnúmero 1\M' then 'Evite "o melhor": a vitrine não compara profissionais.'
    when p ~* '\mdepoimento' then 'Depoimentos de pacientes não entram.'
    when p ~ '\d{3}\.?\d{3}\.?\d{3}-?\d{2}' then 'Não ponha CPF.'
    else null end
$$;

create or replace function interno.saude_json(s interno.saude_perfis, p_completo boolean) returns jsonb language sql stable security definer set search_path = interno, pg_temp as $$
  select jsonb_build_object('id', s.usuario, 'nome', s.nome, 'profissao', s.profissao, 'conselho', upper(s.conselho), 'uf', s.uf, 'registro', s.registro,
           'abordagem', s.abordagem, 'areas', to_jsonb(s.areas), 'modalidade', s.modalidade, 'cidade', s.cidade, 'valor', s.valor, 'bio', s.bio,
           'contatos', s.contatos, 'foto', case when s.foto_autorizada then s.foto else '' end, 'verificado_em', s.verificado_em)
    || case when p_completo then jsonb_build_object('status', s.status, 'foto_autorizada', s.foto_autorizada, 'foto_guardada', s.foto, 'texto_aprovado_em', s.texto_aprovado_em,
           'termo_versao', s.termo_versao, 'termo_vigente', interno.saude_termo_vigente(), 'verificacao_nota', s.verificacao_nota, 'atualizado_em', s.atualizado_em,
           'apto', interno.saude_apto(s),
           'faltam', to_jsonb(array_remove(array[
             case when s.termo_versao is distinct from interno.saude_termo_vigente() then 'aceitar o termo vigente' end,
             case when s.verificado_em is null or s.verificado_em <= current_date - 180 then 'a coordenação conferir o registro no conselho' end,
             case when s.texto_aprovado_em is null then 'o profissional aprovar o texto do perfil' end,
             case when s.status <> 'publicado' then 'a coordenação publicar' end,
             case when interno.saude_desligada() then 'a vitrine está desligada' end], null))) else '{}'::jsonb end
$$;

/** O meu perfil na vitrine (quem tem o cargo de profissional de saúde). */
create or replace function public.saude_meu() returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); s saude_perfis;
begin
  if not interno.tem('saude') then perform interno.erro('sem_permissao'); end if;
  insert into saude_perfis (usuario, nome) values (v, coalesce((select nome from perfis where id = v), '')) on conflict do nothing;
  select * into s from saude_perfis where usuario = v;
  return interno.saude_json(s, true);
end $$;

/**
 * O profissional escreve o próprio perfil. Qualquer mudança tira o perfil da vitrine até a coordenação olhar de novo
 * (status "aguardando"), e o texto salvo pelo próprio profissional conta como aprovado por ele.
 */
create or replace function public.saude_salvar(p jsonb) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); s saude_perfis; v_motivo text; v_contatos jsonb := '{}'::jsonb; v_areas text[];
begin
  if not interno.tem('saude') then perform interno.erro('sem_permissao'); end if;
  perform interno.limite('saude_salvar', 40, 60);
  v_motivo := interno.saude_texto_proibido(coalesce(p ->> 'bio', '') || ' ' || coalesce(p ->> 'abordagem', '') || ' ' || coalesce(p ->> 'profissao', ''));
  if v_motivo is not null then return jsonb_build_object('ok', false, 'motivo', v_motivo); end if;
  -- Contatos aceitos: WhatsApp (só números, com DDI), Instagram (usuário), e-mail e um site https. Nada embutido.
  if coalesce(p -> 'contatos' ->> 'whatsapp', '') ~ '^\+?[0-9 ()-]{10,20}$' then v_contatos := v_contatos || jsonb_build_object('whatsapp', regexp_replace(p -> 'contatos' ->> 'whatsapp', '[^0-9]', '', 'g')); end if;
  if coalesce(p -> 'contatos' ->> 'instagram', '') ~ '^@?[A-Za-z0-9._]{1,30}$' then v_contatos := v_contatos || jsonb_build_object('instagram', ltrim(p -> 'contatos' ->> 'instagram', '@')); end if;
  if coalesce(p -> 'contatos' ->> 'email', '') ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' and char_length(p -> 'contatos' ->> 'email') <= 120 then v_contatos := v_contatos || jsonb_build_object('email', p -> 'contatos' ->> 'email'); end if;
  if coalesce(p -> 'contatos' ->> 'site', '') ~ '^https://[^\s<>"]{4,200}$' then v_contatos := v_contatos || jsonb_build_object('site', p -> 'contatos' ->> 'site'); end if;
  select coalesce(array_agg(left(btrim(x), 40)), '{}') into v_areas from (select jsonb_array_elements_text(coalesce(p -> 'areas', '[]'::jsonb)) x limit 12) a where btrim(x) <> '';
  if coalesce(p ->> 'foto', '') <> '' and (p ->> 'foto' !~ '^data:image/webp;base64,[A-Za-z0-9+/=]+$' or char_length(p ->> 'foto') > 60000) then perform interno.erro('invalido:foto'); end if;
  insert into saude_perfis (usuario) values (v) on conflict do nothing;
  update saude_perfis set
    nome = interno.txt(p ->> 'nome', 'nome', 2, 80), profissao = interno.txt(p ->> 'profissao', 'profissao', 2, 60),
    conselho = upper(coalesce(nullif(btrim(p ->> 'conselho'), ''), '')), uf = upper(coalesce(p ->> 'uf', '')), registro = interno.txt(p ->> 'registro', 'registro', 1, 30),
    abordagem = interno.txt(p ->> 'abordagem', 'abordagem', 0, 120), areas = v_areas,
    modalidade = coalesce(nullif(p ->> 'modalidade', ''), 'online'), cidade = interno.txt(p ->> 'cidade', 'cidade', 0, 80),
    valor = coalesce(nullif(p ->> 'valor', ''), 'social'), bio = interno.txt(p ->> 'bio', 'bio', 0, 900), contatos = v_contatos,
    foto = case when p ? 'foto' then coalesce(p ->> 'foto', '') else foto end, foto_autorizada = coalesce((p ->> 'foto_autorizada')::boolean, false),
    status = case when status = 'removido' then 'removido' when status = 'suspenso' then 'suspenso' else 'aguardando' end,
    texto_aprovado_em = now(), atualizado_em = now()
  where usuario = v returning * into s;
  perform interno.avisar_lideranca('Perfil da vitrine de saúde atualizado: confira o registro e publique em Saúde Solidária.', v);
  perform interno.registrar('saude_perfil_salvo', v::text, '{}'::jsonb);
  return jsonb_build_object('ok', true, 'perfil', interno.saude_json(s, true));
end $$;

/** O profissional aceita o termo vigente (o texto inteiro fica em termos_aceites, para sempre). */
create or replace function public.saude_termo_aceitar(p_texto text, p_nome text, p_registro text) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu();
begin
  if not interno.tem('saude') then perform interno.erro('sem_permissao'); end if;
  perform public.termo_registrar('saude', interno.saude_termo_vigente(), p_texto, jsonb_build_object('nome_digitado', left(coalesce(p_nome, ''), 120), 'registro', left(coalesce(p_registro, ''), 40)));
  insert into saude_perfis (usuario) values (v) on conflict do nothing;
  update saude_perfis set termo_versao = interno.saude_termo_vigente(), atualizado_em = now() where usuario = v;
  return jsonb_build_object('ok', true);
end $$;

/** Pedir para sair da vitrine: some na hora; a coordenação só confirma. */
create or replace function public.saude_sair() returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu();
begin
  update saude_perfis set status = 'removido', atualizado_em = now() where usuario = v;
  perform interno.avisar_lideranca('Um profissional pediu para sair da vitrine de saúde (já saiu).', v);
  perform interno.registrar('saude_saiu', v::text, '{}'::jsonb);
  return jsonb_build_object('ok', true);
end $$;

/** Para a coordenação: todos os perfis, com o que falta para cada um aparecer. */
create or replace function public.saude_fila() returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
begin
  perform interno.eu();
  if not (interno.coord() or interno.tem('vice')) then perform interno.erro('sem_permissao'); end if;
  return jsonb_build_object('desligada', interno.saude_desligada(),
    'perfis', (select coalesce(jsonb_agg(interno.saude_json(s, true) order by lower(s.nome)), '[]'::jsonb) from saude_perfis s));
end $$;

/** A coordenação confere o registro, publica, suspende ou devolve para ajuste. */
create or replace function public.saude_decidir(p_usuario uuid, p_acao text, p_verificado_em date default null, p_nota text default '') returns jsonb
language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); s saude_perfis;
begin
  if not (interno.coord() or interno.tem('vice')) then perform interno.erro('sem_permissao'); end if;
  select * into s from saude_perfis where usuario = p_usuario for update;
  if not found then perform interno.erro('nao_encontrado'); end if;
  if p_acao = 'verificar' then
    -- Um dia de folga no futuro: a data vem do relógio de quem confere, que pode estar num fuso adiante do banco.
    if p_verificado_em is null or p_verificado_em > current_date + 1 or p_verificado_em <= current_date - 180 then perform interno.erro('invalido:data'); end if;
    update saude_perfis set verificado_em = p_verificado_em, verificado_por = v, verificacao_nota = interno.txt(p_nota, 'nota', 0, 500) where usuario = p_usuario;
  elsif p_acao = 'publicar' then
    if s.status = 'removido' then perform interno.erro('saude_removido'); end if;
    update saude_perfis set status = 'publicado' where usuario = p_usuario;
  elsif p_acao in ('suspender', 'aguardar') then
    update saude_perfis set status = case p_acao when 'suspender' then 'suspenso' else 'aguardando' end, verificacao_nota = interno.txt(p_nota, 'nota', 0, 500) where usuario = p_usuario;
    perform interno.avisar(p_usuario, 'Seu perfil na vitrine de saúde saiu do ar' || coalesce(': ' || nullif(p_nota, ''), '.') || ' Abra o painel para ver o que falta.');
  else
    perform interno.erro('invalido:acao');
  end if;
  perform interno.registrar('saude_' || p_acao, p_usuario::text, jsonb_build_object('verificado_em', p_verificado_em));
  select * into s from saude_perfis where usuario = p_usuario;
  return interno.saude_json(s, true);
end $$;

/** A chave geral: desliga a vitrine inteira na hora, sem publicar o site de novo. */
create or replace function public.saude_chave(p_desligar boolean) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
begin
  perform interno.eu();
  if not (interno.coord() or interno.tem('vice')) then perform interno.erro('sem_permissao'); end if;
  insert into configuracoes (chave, valor) values ('saude', jsonb_build_object('desligada', coalesce(p_desligar, false)))
  on conflict (chave) do update set valor = configuracoes.valor || jsonb_build_object('desligada', coalesce(p_desligar, false));
  perform interno.registrar(case when p_desligar then 'saude_desligada' else 'saude_ligada' end, '', '{}'::jsonb);
  return jsonb_build_object('desligada', coalesce(p_desligar, false));
end $$;

/** A vitrine pública: só quem está apto agora, em ordem alfabética (nunca ranking), e o estado da chave geral. */
create or replace function public.saude_vitrine() returns jsonb language sql stable security definer set search_path = interno, pg_temp as $$
  select jsonb_build_object('desligada', interno.saude_desligada(),
    'perfis', case when interno.saude_desligada() then '[]'::jsonb
                   else (select coalesce(jsonb_agg(interno.saude_json(s, false) order by lower(s.nome)), '[]'::jsonb) from saude_perfis s where interno.saude_apto(s)) end)
$$;

-- ───────────────────────────── Relatos de erro do site ─────────────────────────────
-- A página "Achei um erro" (/relatar-erro): o que deu errado, onde, e, só se a pessoa marcar, o navegador. Sem conta,
-- sem endereço de rede guardado. Quem cuida do código lê e responde no painel (Estado técnico › Erros relatados).
create table if not exists interno.erros_relatados (
  id uuid primary key default gen_random_uuid(),
  pagina text not null default '' check (char_length(pagina) <= 300),
  descricao text not null check (char_length(descricao) between 10 and 4000),
  passos text not null default '' check (char_length(passos) <= 2000),
  navegador text not null default '' check (char_length(navegador) <= 300),
  tela text not null default '' check (char_length(tela) <= 40),
  contato text not null default '' check (char_length(contato) <= 200),
  status text not null default 'novo' check (status in ('novo', 'visto', 'resolvido', 'descartado')),
  nota text not null default '' check (char_length(nota) <= 1000),
  criado_em timestamptz not null default now()
);
create index if not exists erros_relatados_status on interno.erros_relatados (status, criado_em desc);
alter table interno.erros_relatados enable row level security;

create or replace function public.erro_relatar(p jsonb) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v_id uuid;
begin
  -- Campo-isca: gente não vê, robô preenche.
  if coalesce(p ->> 'site', '') <> '' then return jsonb_build_object('ok', true); end if;
  perform interno.limite('erro_relatar', 6, 60);
  insert into erros_relatados (pagina, descricao, passos, navegador, tela, contato)
  values (interno.txt(p ->> 'pagina', 'pagina', 0, 300), interno.txt(p ->> 'descricao', 'descricao', 10, 4000), interno.txt(p ->> 'passos', 'passos', 0, 2000),
          interno.txt(p ->> 'navegador', 'navegador', 0, 300), interno.txt(p ->> 'tela', 'tela', 0, 40), interno.txt(p ->> 'contato', 'contato', 0, 200))
  returning id into v_id;
  return jsonb_build_object('ok', true, 'id', v_id);
end $$;

create or replace function public.erros_listar() returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
begin
  perform interno.eu();
  if not (interno.coord() or interno.tem('desenvolvimento')) then perform interno.erro('sem_permissao'); end if;
  return (select coalesce(jsonb_agg(to_jsonb(e) order by (e.status = 'novo') desc, e.criado_em desc), '[]'::jsonb)
          from (select * from erros_relatados where criado_em > now() - interval '365 days' order by criado_em desc limit 500) e);
end $$;

create or replace function public.erro_mudar(p_id uuid, p_status text, p_nota text default '') returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
begin
  perform interno.eu();
  if not (interno.coord() or interno.tem('desenvolvimento')) then perform interno.erro('sem_permissao'); end if;
  if coalesce(p_status, '') not in ('novo', 'visto', 'resolvido', 'descartado') then perform interno.erro('invalido:status'); end if;
  update erros_relatados set status = p_status, nota = interno.txt(p_nota, 'nota', 0, 1000) where id = p_id;
  if not found then perform interno.erro('nao_encontrado'); end if;
  return jsonb_build_object('ok', true);
end $$;

revoke all on function interno.termos_aceites_imutavel() from public, anon, authenticated;
revoke all on function interno.leciona(text, uuid) from public, anon, authenticated;
revoke all on function interno.escreve_em(text) from public, anon, authenticated;
revoke all on function interno.termo_voluntario_vigente() from public, anon, authenticated;
revoke all on function interno.saude_termo_vigente() from public, anon, authenticated;
revoke all on function interno.saude_desligada() from public, anon, authenticated;
revoke all on function interno.saude_apto(interno.saude_perfis) from public, anon, authenticated;
revoke all on function interno.saude_texto_proibido(text) from public, anon, authenticated;
revoke all on function interno.saude_json(interno.saude_perfis, boolean) from public, anon, authenticated;
do $$
declare f text;
begin
  foreach f in array array['disciplina_convidar(uuid, text, text, text)', 'disciplina_convites()', 'disciplina_convite_revogar(uuid)',
    'traducao_convidar(text, text, uuid)', 'traducao_coautor_tirar(text, text, uuid)', 'fotos_pendentes()', 'foto_decidir(uuid, boolean)',
    'termo_registrar(text, text, text, jsonb)', 'termos_meus()', 'termos_aceites_listar(uuid)',
    'saude_meu()', 'saude_salvar(jsonb)', 'saude_termo_aceitar(text, text, text)', 'saude_sair()', 'saude_fila()', 'saude_decidir(uuid, text, date, text)',
    'saude_chave(boolean)', 'saude_vitrine()', 'erro_relatar(jsonb)', 'erros_listar()', 'erro_mudar(uuid, text, text)'] loop
    execute format('revoke all on function public.%s from public', f);
    execute format('grant execute on function public.%s to anon, authenticated, service_role', f);
  end loop;
end $$;

-- Funções internas usadas só por dentro de outras funções: ninguém de fora as executa (o esquema já é fechado; isto é a
-- segunda tranca).
revoke all on function interno.curriculo_decide() from public, anon, authenticated;
revoke all on function interno.curriculo_json(interno.curriculo_propostas) from public, anon, authenticated;
revoke all on function interno.reuniao_entra(interno.reunioes) from public, anon, authenticated;
revoke all on function interno.reuniao_json(interno.reunioes) from public, anon, authenticated;
revoke all on function interno.revisa_caderno(text) from public, anon, authenticated;
revoke all on function interno.caderno_pronto_json(interno.cadernos_prontos) from public, anon, authenticated;
revoke all on function interno.resolve_questoes() from public, anon, authenticated;

-- ───────────────────────────── Tranca final ─────────────────────────────
-- O laço do começo só alcança as tabelas que já existiam quando ele rodou: as criadas mais abaixo ficariam sem segurança
-- por linha até a próxima execução deste arquivo. Aqui, no fim, toda tabela do esquema interno fica com a segurança por
-- linha ligada (sem regra = ninguém passa) e sem permissão direta para ninguém de fora: o acesso é só pelas funções.
do $$
declare t record;
begin
  for t in select tablename from pg_tables where schemaname = 'interno' loop
    execute format('alter table interno.%I enable row level security', t.tablename);
    execute format('revoke all on interno.%I from public', t.tablename);
    if exists (select 1 from pg_roles where rolname = 'anon') then execute format('revoke all on interno.%I from anon, authenticated', t.tablename); end if;
  end loop;
end $$;
