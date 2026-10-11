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

create or replace function interno.tem(p_papel text, p_disciplina text default null) returns boolean
language sql stable security definer set search_path = interno, pg_temp as $$
  select auth.uid() is not null and exists (
    select 1 from papeis p join perfis f on f.id = p.usuario
    where p.usuario = auth.uid() and not f.suspenso and p.papel = p_papel
      and (p_disciplina is null or p.disciplina is null or p.disciplina = p_disciplina)
  )
$$;

create or replace function interno.coord() returns boolean language sql stable as $$ select interno.tem('coordenacao') $$;
create or replace function interno.curador() returns boolean language sql stable as $$ select interno.tem('coordenacao') or interno.tem('curadoria') $$;
create or replace function interno.voluntario() returns boolean language sql stable security definer set search_path = interno, pg_temp as $$
  select auth.uid() is not null and exists (select 1 from papeis p join perfis f on f.id = p.usuario where p.usuario = auth.uid() and not f.suspenso)
$$;
/** Quem pode cuidar da comunidade: coordenação, curadoria e educadores. */
create or replace function interno.cuida() returns boolean language sql stable as $$ select interno.curador() or interno.tem('educacao') $$;

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
    select left(coalesce(nullif(btrim(u.raw_user_meta_data ->> 'full_name'), ''), nullif(btrim(u.raw_user_meta_data ->> 'name'), ''), split_part(u.email, '@', 1), 'Pessoa'), 60)
      into v_nome from auth.users u where u.id = v;
    if v_nome is null then return null; end if;
    if char_length(v_nome) < 2 then v_nome := v_nome || ' .'; end if;
    insert into perfis (id, nome) values (v, v_nome) on conflict do nothing;
  end if;
  return (
    select jsonb_build_object(
      'id', f.id, 'nome', f.nome, 'bio', f.bio, 'suspenso', f.suspenso,
      'papeis', coalesce((select jsonb_agg(jsonb_build_object('id', p.id, 'papel', p.papel, 'disciplina', p.disciplina) order by p.papel, p.disciplina)
                          from papeis p where p.usuario = f.id), '[]'::jsonb))
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
  if p_papel not in ('curadoria', 'educacao', 'revisao', 'traducao', 'jornalismo') then perform interno.erro('invalido:papel'); end if;
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
  end if;
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.voluntarios_listar() returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
begin
  if not interno.coord() then perform interno.erro('sem_permissao'); end if;
  return (
    select coalesce(jsonb_agg(jsonb_build_object(
      'id', f.id, 'nome', f.nome, 'email', u.email, 'suspenso', f.suspenso, 'criado_em', f.criado_em,
      'papeis', coalesce((select jsonb_agg(jsonb_build_object('id', p.id, 'papel', p.papel, 'disciplina', p.disciplina) order by p.papel, p.disciplina) from papeis p where p.usuario = f.id), '[]'::jsonb))
      order by f.nome), '[]'::jsonb)
    from perfis f join auth.users u on u.id = f.id);
end $$;

create or replace function public.papel_conceder(p_usuario uuid, p_papel text, p_disciplina text) returns jsonb
language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu();
begin
  if not interno.coord() then perform interno.erro('sem_permissao'); end if;
  if p_papel not in ('coordenacao', 'curadoria', 'educacao', 'revisao', 'traducao', 'jornalismo') then perform interno.erro('invalido:papel'); end if;
  if p_papel = 'educacao' and coalesce(p_disciplina, '') = '' then perform interno.erro('invalido:disciplina'); end if;
  if not exists (select 1 from perfis where id = p_usuario) then perform interno.erro('nao_encontrado'); end if;
  insert into papeis (usuario, papel, disciplina, concedido_por) values (p_usuario, p_papel, interno.disciplina_ok(p_disciplina), v) on conflict do nothing;
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.papel_remover(p_id uuid) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare r papeis;
begin
  perform interno.eu();
  if not interno.coord() then perform interno.erro('sem_permissao'); end if;
  select * into r from papeis where id = p_id;
  if not found then perform interno.erro('nao_encontrado'); end if;
  if r.papel = 'coordenacao' and (select count(*) from papeis where papel = 'coordenacao') <= 1 then perform interno.erro('ultima_coordenacao'); end if;
  delete from papeis where id = p_id;
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.usuario_suspender(p_usuario uuid, p_suspenso boolean) returns jsonb
language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu();
begin
  if not interno.coord() then perform interno.erro('sem_permissao'); end if;
  if p_usuario = v then perform interno.erro('invalido:usuario'); end if;
  update perfis set suspenso = p_suspenso where id = p_usuario;
  return jsonb_build_object('ok', true);
end $$;

/** Quem faz o site: nome escolhido e papéis. Não mostra e-mail nem nada além disso. */
create or replace function public.equipe() returns jsonb language sql stable security definer set search_path = interno, pg_temp as $$
  select coalesce(jsonb_agg(jsonb_build_object('nome', f.nome, 'papel', p.papel, 'disciplina', p.disciplina) order by p.papel, f.nome), '[]'::jsonb)
  from papeis p join perfis f on f.id = p.usuario where not f.suspenso
$$;

/** Só pelo SQL Editor (ou com a chave de serviço): dá o papel de coordenação a quem já entrou no site. */
create or replace function public.promover_coordenacao(p_email text) returns text language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid; v_nome text;
begin
  if auth.uid() is not null or (interno.claims() ->> 'role') in ('anon', 'authenticated') then
    raise exception 'sem_permissao' using errcode = 'P0001';
  end if;
  select id, left(coalesce(nullif(btrim(raw_user_meta_data ->> 'full_name'), ''), split_part(email, '@', 1)), 60) into v, v_nome
  from auth.users where lower(email) = lower(btrim(p_email));
  if v is null then return 'Ninguém entrou no site com esse e-mail ainda. Entre uma vez e rode de novo.'; end if;
  insert into perfis (id, nome) values (v, case when char_length(v_nome) < 2 then 'Coordenação' else v_nome end) on conflict do nothing;
  insert into papeis (usuario, papel) values (v, 'coordenacao') on conflict do nothing;
  return 'Pronto: ' || p_email || ' agora é da coordenação.';
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

  if v_tipo not in ('aula', 'obra', 'artigo', 'checagem', 'debate', 'verbete', 'memorial', 'video', 'frase', 'traducao', 'correcao', 'sugestao') then
    perform interno.erro('invalido:tipo');
  end if;
  if jsonb_typeof(v_dados) <> 'object' or pg_column_size(v_dados) > 20000 then perform interno.erro('invalido:dados'); end if;
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
    where interno.ve_fila(c.disciplina));
end $$;

create or replace function public.contribuicao_ver(p_id uuid) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare c contribuicoes;
begin
  select * into c from contribuicoes where id = p_id;
  if not found then perform interno.erro('nao_encontrado'); end if;
  if not (c.autor = auth.uid() or interno.ve_fila(c.disciplina)) then perform interno.erro('sem_permissao'); end if;
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
  if not interno.ve_fila(c.disciplina) then perform interno.erro('sem_permissao'); end if;
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

create or replace function public.topicos_listar(p_ordem text default 'alta', p_disciplina text default null, p_pagina integer default 0) returns jsonb
language sql stable security definer set search_path = interno, pg_temp as $$
  select coalesce(jsonb_agg(x.j order by x.n), '[]'::jsonb) from (
    select row_number() over () as n, jsonb_build_object(
      'id', t.id, 'titulo', t.titulo, 'disciplina', t.disciplina, 'pontos', t.pontos, 'respostas', t.respostas,
      'trancado', t.trancado, 'oculto', t.oculto, 'criado_em', t.criado_em, 'autor', coalesce(f.nome, ''),
      'meu_voto', coalesce((select v.valor from votos v where v.usuario = auth.uid() and v.tipo = 'topico' and v.alvo = t.id), 0)) as j
    from topicos t left join perfis f on f.id = t.autor
    where (not t.oculto or interno.cuida()) and (coalesce(p_disciplina, '') = '' or t.disciplina = p_disciplina)
    order by
      case when p_ordem = 'novos' then extract(epoch from t.criado_em) end desc nulls last,
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
    'criado_em', t.criado_em, 'autor', coalesce((select nome from perfis where id = t.autor), ''),
    'meu', t.autor is not null and t.autor = auth.uid(),
    'meu_voto', coalesce((select valor from votos where usuario = auth.uid() and tipo = 'topico' and alvo = t.id), 0),
    'pode_cuidar', interno.cuida(),
    'respostas', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', r.id, 'corpo', r.corpo, 'pontos', r.pontos, 'oculto', r.oculto, 'criado_em', r.criado_em, 'autor', coalesce(f.nome, ''),
        'meu_voto', coalesce((select valor from votos where usuario = auth.uid() and tipo = 'resposta' and alvo = r.id), 0)) order by r.criado_em)
      from respostas r left join perfis f on f.id = r.autor
      where r.topico = t.id and (not r.oculto or interno.cuida())), '[]'::jsonb));
end $$;

create or replace function public.topico_criar(p_titulo text, p_corpo text, p_disciplina text) returns jsonb
language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); v_id uuid;
begin
  perform interno.limite('topico', 8, 60);
  insert into topicos (autor, titulo, corpo, disciplina)
  values (v, interno.txt(p_titulo, 'titulo', 5, 140), interno.txt(p_corpo, 'corpo', 10, 8000), interno.disciplina_ok(p_disciplina))
  returning id into v_id;
  return jsonb_build_object('id', v_id);
end $$;

create or replace function public.responder(p_topico uuid, p_corpo text) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); t topicos; v_id uuid;
begin
  perform interno.limite('responder', 40, 60);
  select * into t from topicos where id = p_topico for update;
  if not found or t.oculto then perform interno.erro('nao_encontrado'); end if;
  if t.trancado then perform interno.erro('topico_trancado'); end if;
  insert into respostas (topico, autor, corpo) values (p_topico, v, interno.txt(p_corpo, 'corpo', 2, 8000)) returning id into v_id;
  update topicos set respostas = respostas + 1 where id = p_topico;
  return jsonb_build_object('id', v_id);
end $$;

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
begin
  perform interno.eu();
  if not interno.cuida() then perform interno.erro('sem_permissao'); end if;
  if p_tipo = 'topico' and p_acao in ('ocultar', 'mostrar') then update topicos set oculto = (p_acao = 'ocultar') where id = p_alvo;
  elsif p_tipo = 'topico' and p_acao in ('trancar', 'destrancar') then update topicos set trancado = (p_acao = 'trancar') where id = p_alvo;
  elsif p_tipo = 'resposta' and p_acao in ('ocultar', 'mostrar') then update respostas set oculto = (p_acao = 'ocultar') where id = p_alvo;
  else perform interno.erro('invalido:acao'); end if;
  if not found then perform interno.erro('nao_encontrado'); end if;
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

-- ───────────────────────────── Painel ─────────────────────────────

create or replace function public.painel_resumo() returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
begin
  perform interno.eu();
  return jsonb_build_object(
    'fila', case when interno.voluntario() then (select count(*) from contribuicoes c where c.status = 'pendente' and interno.ve_fila(c.disciplina)) else 0 end,
    'aguardando_publicacao', case when interno.curador() then (select count(*) from contribuicoes where status = 'aprovada') else 0 end,
    'candidaturas', case when interno.coord() then (select count(*) from candidaturas where status = 'pendente') else 0 end,
    'denuncias', case when interno.curador() then (select count(*) from denuncias where status = 'aberta') else 0 end,
    'anotacoes', case when interno.cuida() then (select count(*) from anotacoes where status = 'pendente') else 0 end,
    'mural', case when interno.curador() then (select count(*) from mural where status = 'pendente') else 0 end,
    'minhas', (select count(*) from contribuicoes where autor = auth.uid()));
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
             'mural_listar', 'mural_enviar', 'mural_meus', 'mural_remover', 'mural_renovar', 'mural_fila', 'mural_decidir'))
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
    execute 'create policy "radio_envio_coordenacao" on storage.objects for insert to authenticated with check (bucket_id = ''radio'' and interno.tem(''coordenacao''))';
    execute 'drop policy if exists "radio_remocao_coordenacao" on storage.objects';
    execute 'create policy "radio_remocao_coordenacao" on storage.objects for delete to authenticated using (bucket_id = ''radio'' and interno.tem(''coordenacao''))';
    -- A regra acima chama interno.tem, então quem está logado precisa poder executá-la.
    execute 'grant usage on schema interno to authenticated';
    execute 'grant execute on function interno.tem(text, text) to authenticated';
  end if;
end $$;
