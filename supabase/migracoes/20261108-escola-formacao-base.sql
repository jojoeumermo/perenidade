-- ───────────────────────────── Escola de Formação (F1): militância e tabelas da Escola, novembro de 2026 ─────────────────────────────
-- Migração acrescentável: pode rodar mais de uma vez, sem apagar dado nenhum. Quem junta cola este bloco no fim do
-- install.sql (ordem da Escola: F1, F4, F5, F3, F6). Plano: docs/plano-2026-11/PLANO-ESCOLA.md, seção 4.1.
-- Teste: npm run testar:escola-acesso (Postgres de verdade dentro do Node, com o install.sql e esta migração).
--
-- O que nasce aqui (TODAS as tabelas da Escola fechada; as funções de cada tela vêm nas migrações das outras frentes):
--  1. interno.e_militante(p): quem está no departamento Revolucionários (ou a coordenação, para si mesma). Conta suspensa não é.
--  2. Tabelas: escola_militancia, escola_encontros, escola_encontro_tarefas, escola_perguntas, escola_recados,
--     escola_bancas, escola_conquistas; e perfis.escola_publico (padrão 'ninguem').
--  3. Gatilho em departamento_membros: entrar nos Revolucionários cria a militância e a conquista 'carteirinha'
--     verificada; sair apaga a militância, as conquistas e as bancas (direito de eliminação, LGPD art. 18, VI).
--  4. public.escola_eu(): a única função de leitura desta frente. Quem não é militante recebe só {militante:false}.
--
-- Segurança (mesma regra de migracoes/2026-11-escola.sql): toda tabela em "interno", com segurança por linha ligada e
-- sem permissão nenhuma para public, anon e authenticated. Só funções security definer, com search_path fixo, leem.
-- Ser militante revela opinião política (dado sensível, LGPD art. 5º, II e art. 11): nada de nome civil aqui (a
-- Escola mostra o codinome da Alumia, perfis.rede_codinome) e nada de militância no registro com o nome do departamento.

-- 1. Quem é militante ────────────────────────────────────────────────────────────────────────────────────────────────────
/**
 * Militante = do departamento Revolucionários (pela participação ou por representá-lo), com a conta ativa. A coordenação
 * também entra na Escola, mas só ela mesma (a checagem da coordenação olha a sessão de quem chama, com o segundo fator).
 */
create or replace function interno.e_militante(p uuid) returns boolean language sql stable security definer set search_path = interno, pg_temp as $$
  select p is not null and coalesce(interno.membro_direto(p, 'revolucionarios') or (p = auth.uid() and interno.coord()), false)
$$;

-- 2. As tabelas ──────────────────────────────────────────────────────────────────────────────────────────────────────────
-- Uma linha por militante: o degrau (1 Despertar, 2 Base, 3 Quadros), a frente de atuação, o núcleo da Alumia e quem acompanha.
create table if not exists interno.escola_militancia (
  usuario uuid primary key references interno.perfis (id) on delete cascade,
  degrau smallint not null default 1 check (degrau between 1 and 3),
  frente text check (frente is null or frente in ('estudantil', 'bairros', 'trabalho', 'agitprop', 'atos', 'cultura', 'solidariedade')),
  nucleo uuid references interno.rede_nucleos (id) on delete set null,
  acompanha uuid references interno.perfis (id) on delete set null,
  desde date not null default ((now() at time zone 'America/Sao_Paulo')::date),
  constraint escola_militancia_acompanha_outra check (acompanha is distinct from usuario)
);
create index if not exists escola_militancia_nucleo on interno.escola_militancia (nucleo);
create index if not exists escola_militancia_acompanha on interno.escola_militancia (acompanha);

-- Os encontros do núcleo: quando, a pauta (até 12 itens), a presença SOMADA (só o número) e o balanço.
create table if not exists interno.escola_encontros (
  id uuid primary key default gen_random_uuid(),
  nucleo uuid not null references interno.rede_nucleos (id) on delete cascade,
  quando timestamptz not null,
  pauta jsonb not null default '[]'::jsonb check (jsonb_typeof(pauta) = 'array' and jsonb_array_length(pauta) <= 12),
  presenca smallint check (presenca is null or presenca between 0 and 500),
  balanco text not null default '' check (char_length(balanco) <= 2000),
  criado_por uuid references interno.perfis (id) on delete set null,
  criado_em timestamptz not null default now()
);
create index if not exists escola_encontros_nucleo on interno.escola_encontros (nucleo, quando);

-- Quem faz o quê (encaminhamentos do encontro, em rodízio).
create table if not exists interno.escola_encontro_tarefas (
  id uuid primary key default gen_random_uuid(),
  encontro uuid not null references interno.escola_encontros (id) on delete cascade,
  item text not null check (char_length(item) between 2 and 120),
  quem uuid references interno.perfis (id) on delete set null,
  feito boolean not null default false,
  criado_em timestamptz not null default now()
);
create index if not exists escola_encontro_tarefas_encontro on interno.escola_encontro_tarefas (encontro);

-- A pergunta geradora da semana (a semana começa na segunda-feira).
create table if not exists interno.escola_perguntas (
  semana date primary key check (extract(isodow from semana) = 1),
  texto text not null check (char_length(texto) between 3 and 300),
  por uuid references interno.perfis (id) on delete set null,
  criado_em timestamptz not null default now()
);

-- Recados da formação: para toda a Escola (nucleo nulo) ou para um núcleo, até uma data.
create table if not exists interno.escola_recados (
  id uuid primary key default gen_random_uuid(),
  texto text not null check (char_length(texto) between 3 and 400),
  ate date not null,
  nucleo uuid references interno.rede_nucleos (id) on delete cascade,
  por uuid references interno.perfis (id) on delete set null,
  criado_em timestamptz not null default now()
);
create index if not exists escola_recados_ate on interno.escola_recados (ate);

-- A banca de passagem de degrau (balanço coletivo, sem nota). O balanço só é lido pelo militante, quem acompanha e a coordenação.
create table if not exists interno.escola_bancas (
  id uuid primary key default gen_random_uuid(),
  militante uuid not null references interno.perfis (id) on delete cascade,
  degrau smallint not null check (degrau between 1 and 3),
  nucleo uuid references interno.rede_nucleos (id) on delete set null,
  quando timestamptz,
  situacao text not null default 'marcada' check (situacao in ('marcada', 'aprovada', 'refazer')),
  balanco text not null default '' check (char_length(balanco) <= 2000),
  por uuid references interno.perfis (id) on delete set null,
  decidida_em timestamptz,
  criado_em timestamptz not null default now()
);
create index if not exists escola_bancas_militante on interno.escola_bancas (militante);

-- Conquistas: a carteirinha e o degrau são verificados pelo servidor; aula e caderno são declarados pelo aparelho (F5).
create table if not exists interno.escola_conquistas (
  usuario uuid not null references interno.perfis (id) on delete cascade,
  tipo text not null check (tipo in ('carteirinha', 'aula', 'caderno', 'degrau')),
  alvo text not null check (alvo ~ '^[a-z0-9/-]{1,160}$'),
  verificada boolean not null default false,
  em timestamptz not null default now(),
  primary key (usuario, tipo, alvo)
);

-- Quem vê as conquistas da Escola no perfil da Alumia. Padrão: ninguém (o selo da Alumia nasce ligado; este, não).
alter table interno.perfis add column if not exists escola_publico text not null default 'ninguem';
do $$
begin
  alter table interno.perfis add constraint perfis_escola_publico check (escola_publico in ('ninguem', 'militantes', 'seguidores', 'todos'));
exception when duplicate_object then null;
end $$;

-- Trancadas duas vezes: segurança por linha ligada sem regra nenhuma (ninguém passa) e sem permissão para os papéis da API.
do $$
declare tabela text;
begin
  foreach tabela in array array['escola_militancia', 'escola_encontros', 'escola_encontro_tarefas', 'escola_perguntas', 'escola_recados', 'escola_bancas', 'escola_conquistas'] loop
    execute format('alter table interno.%I enable row level security', tabela);
    execute format('revoke all on interno.%I from public', tabela);
    if exists (select 1 from pg_roles where rolname = 'anon') then
      execute format('revoke all on interno.%I from anon, authenticated', tabela);
    end if;
  end loop;
  -- Com a pausa geral ligada, nada novo entra de quem não é da equipe (como no resto do site). A militância e as
  -- conquistas ficam de fora: nascem do gatilho do departamento, e a pausa não pode impedir alguém de ser tirado ou posto.
  foreach tabela in array array['escola_encontros', 'escola_encontro_tarefas', 'escola_perguntas', 'escola_recados', 'escola_bancas'] loop
    execute format('drop trigger if exists lucia_pausa on interno.%I', tabela);
    execute format('create trigger lucia_pausa before insert on interno.%I for each row execute function interno.pausa()', tabela);
  end loop;
end $$;

-- 3. Entrar e sair do departamento ───────────────────────────────────────────────────────────────────────────────────────
/** Cria a militância e a carteirinha (verificada). Rodar de novo não muda nada. */
create or replace function interno.escola_militancia_criar(p uuid) returns void language plpgsql security definer set search_path = interno, pg_temp as $$
begin
  if p is null then return; end if;
  insert into escola_militancia (usuario) values (p) on conflict (usuario) do nothing;
  insert into escola_conquistas (usuario, tipo, alvo, verificada) values (p, 'carteirinha', 'carteirinha', true)
  on conflict (usuario, tipo, alvo) do update set verificada = true;
end $$;

/** Sair da militância apaga o que a Escola guardou da pessoa no servidor (LGPD art. 18, VI) e solta quem ela acompanhava. */
create or replace function interno.escola_militancia_apagar(p uuid) returns void language plpgsql security definer set search_path = interno, pg_temp as $$
begin
  if p is null then return; end if;
  delete from escola_militancia where usuario = p;
  delete from escola_conquistas where usuario = p;
  delete from escola_bancas where militante = p;
  update escola_militancia set acompanha = null where acompanha = p;
  update escola_encontro_tarefas set quem = null where quem = p;
end $$;

create or replace function interno.escola_departamento_gatilho() returns trigger language plpgsql security definer set search_path = interno, pg_temp as $$
begin
  if tg_op in ('UPDATE', 'DELETE') and old.departamento = 'revolucionarios'
     and (tg_op = 'DELETE' or new.departamento is distinct from 'revolucionarios' or new.usuario is distinct from old.usuario) then
    -- Quem continua militante por outro caminho (representa o departamento) não perde nada.
    if not interno.membro_direto(old.usuario, 'revolucionarios') then perform interno.escola_militancia_apagar(old.usuario); end if;
  end if;
  if tg_op in ('INSERT', 'UPDATE') and new.departamento = 'revolucionarios' then
    perform interno.escola_militancia_criar(new.usuario);
  end if;
  return null;
end $$;
drop trigger if exists lucia_escola_militancia on interno.departamento_membros;
create trigger lucia_escola_militancia after insert or update or delete on interno.departamento_membros for each row execute function interno.escola_departamento_gatilho();

-- Representar o departamento (papeis: papel 'representante', disciplina 'revolucionarios') também faz militante, e tirar
-- esse papel apaga a militância como sair do departamento (LGPD art. 18, VI), a menos que a pessoa continue por outro caminho.
create or replace function interno.escola_papel_gatilho() returns trigger language plpgsql security definer set search_path = interno, pg_temp as $$
begin
  if tg_op in ('UPDATE', 'DELETE') and (old.papel = 'revolucionarios' or (old.papel = 'representante' and old.disciplina = 'revolucionarios')) then
    if not interno.membro_direto(old.usuario, 'revolucionarios') then perform interno.escola_militancia_apagar(old.usuario); end if;
  end if;
  if tg_op in ('INSERT', 'UPDATE') and (new.papel = 'revolucionarios' or (new.papel = 'representante' and new.disciplina = 'revolucionarios'))
     and interno.membro_direto(new.usuario, 'revolucionarios') then
    perform interno.escola_militancia_criar(new.usuario);
  end if;
  return null;
end $$;
drop trigger if exists lucia_escola_militancia on interno.papeis;
create trigger lucia_escola_militancia after insert or update or delete on interno.papeis for each row execute function interno.escola_papel_gatilho();

-- Faxina de quem já tinha perdido a militância antes deste gatilho (rodar de novo não apaga quem ainda é militante).
do $$
declare u uuid;
begin
  for u in select e.usuario from interno.escola_militancia e where not interno.membro_direto(e.usuario, 'revolucionarios') loop
    perform interno.escola_militancia_apagar(u);
  end loop;
end $$;

-- Quem já estava no departamento quando a migração rodou (rodar de novo não duplica nada).
insert into interno.escola_militancia (usuario)
select m.usuario from interno.departamento_membros m where m.departamento = 'revolucionarios'
on conflict (usuario) do nothing;
insert into interno.escola_conquistas (usuario, tipo, alvo, verificada)
select m.usuario, 'carteirinha', 'carteirinha', true from interno.departamento_membros m where m.departamento = 'revolucionarios'
on conflict (usuario, tipo, alvo) do nothing;

-- 4. Quem sou eu na Escola ───────────────────────────────────────────────────────────────────────────────────────────────
/**
 * A porta da Escola pergunta isto. Sem conta, conta suspensa ou sem militância: só {militante:false} (e "conta", para a
 * porta saber se oferece "Entrar"). Militante: o codinome da Alumia (nunca o nome civil), o degrau, a frente, o núcleo,
 * quem acompanha (pelo codinome e o @ da Alumia, se a pessoa não estiver invisível), desde quando e o público das conquistas.
 * Quem representa o departamento (sem a linha de participação) ganha a militância aqui, na primeira vez.
 */
create or replace function public.escola_eu() returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare
  v uuid := auth.uid();
  f perfis;
  m escola_militancia;
  n jsonb;
  a jsonb;
begin
  if v is null then return jsonb_build_object('militante', false, 'conta', false); end if;
  select * into f from perfis where id = v;
  if not found or f.suspenso or not interno.e_militante(v) then return jsonb_build_object('militante', false, 'conta', true); end if;
  perform interno.limite('escola_eu', 60, 1);
  if interno.membro_direto(v, 'revolucionarios') then perform interno.escola_militancia_criar(v); end if;
  select * into m from escola_militancia where usuario = v;
  if m.nucleo is not null then
    select jsonb_build_object('id', r.id, 'nome', r.nome) into n from rede_nucleos r where r.id = m.nucleo;
  end if;
  if m.acompanha is not null then
    select jsonb_build_object(
      'codinome', case when p.rede_codinome_ok then p.rede_codinome end,
      'handle', case when not coalesce(p.rede_modo = 'invisivel' or p.rede_invisivel, false) then p.rede_handle end)
    into a from perfis p where p.id = m.acompanha and not p.suspenso;
  end if;
  return jsonb_build_object(
    'militante', true,
    'conta', true,
    'codinome', case when f.rede_codinome_ok then f.rede_codinome end,
    'handle', f.rede_handle,
    'degrau', coalesce(m.degrau, 1),
    'frente', m.frente,
    'nucleo', n,
    'acompanha', a,
    'desde', m.desde,
    'publico', f.escola_publico,
    'coordena', interno.coord());
end $$;

-- 5. Permissões ──────────────────────────────────────────────────────────────────────────────────────────────────────────
-- O install.sql dá USAGE em "interno" para anon e authenticated: sem isto, uma conta poderia criar ou apagar a militância de
-- qualquer uuid, ou saber se qualquer uuid é militante. As funções internas só rodam por dentro das security definer.
revoke all on function interno.e_militante(uuid), interno.escola_militancia_criar(uuid), interno.escola_militancia_apagar(uuid),
  interno.escola_departamento_gatilho(), interno.escola_papel_gatilho() from public;
revoke all on function public.escola_eu() from public;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on function interno.e_militante(uuid), interno.escola_militancia_criar(uuid), interno.escola_militancia_apagar(uuid),
      interno.escola_departamento_gatilho(), interno.escola_papel_gatilho() from anon, authenticated;
    grant execute on function public.escola_eu() to anon, authenticated, service_role;
  end if;
end $$;
