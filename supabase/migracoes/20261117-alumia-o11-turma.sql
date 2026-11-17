-- ───────────────────────────── Alumia, onda 11: turma e agenda ─────────────────────────────
-- Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
--
-- Frente 11C. Três peças de estudo, cada uma com o princípio escrito na regra do banco:
--
--   1. TURMA DE ESTUDO COM META (L2-43): turma pequena (até 12 pessoas), que entra por código. A turma escolhe um combinado
--      semanal ("1 redação por semana"); cada pessoa marca só a própria semana. A turma vê SÓ o total da semana, e só quando ao
--      menos 3 marcaram E ao menos 3 ainda não (na turma pequena, "todo mundo marcou" diria quem marcou). O total é o do último
--      marco de 15 minutos, como o da petição (interno.rede_contagem_marco): quem marca ou desmarca não vê o número mudar na hora,
--      e não descobre por subtração quantas outras marcaram. Ninguém vê quem marcou, quem não marcou nem quem está na turma (só
--      quantas pessoas, a partir de 3). Sem placar, sem sequência, sem a palavra "atrasado". A marca de cada pessoa existe só durante a semana
--      (para não contar duas vezes e para ela poder desmarcar); fechada a semana, vira um número da turma e a marca some.
--   2. AGENDA DE PROVAS (L2-48): as datas do ENEM e dos vestibulares, escritas pela coordenação e pela mediação, cada uma com
--      a fonte oficial (sem fonte, não entra) e o dia em que foi conferida. A pessoa assina as que quer e recebe aviso 7 dias e
--      1 dia antes; se a data muda ou sai, quem assinou é avisado. A assinatura guarda só (data, pessoa) e some depois do dia.
--      O arquivo de agenda (.ics) nasce no aparelho.
--   3. MONITORIA MARCADA (L2-47): só quem a coordenação ou a mediação nomeou (e aceitou) oferece horários, nas disciplinas
--      dela. Quem estuda vê a disciplina, o dia, a hora e se há vaga, nunca quem é o monitor; ao marcar, os dois são avisados e
--      só os dois se veem (o codinome e o @, para conversar). Ninguém mais vê quem marcou, nem quantas vagas sobram. A sala é a
--      Aula ao vivo do site (uma aula do próprio monitor) ou a conversa da Alumia: nenhum vídeo novo. Lembrete 1 hora antes,
--      para os dois. A marcação e a dúvida somem 1 dia depois do horário.
--
-- Nenhum endereço de rede é guardado. Tudo em interno, com RLS e sem política; o acesso é só por funções security definer com
-- search_path fixo. As de membro passam pela porta da entrada (interno.alumia_trancar, no fim).
--
-- Pode rodar mais de uma vez, sem apagar dado nenhum. Roda DEPOIS de 20261116-alumia-onda10-fim.sql.
-- Teste: scripts/testar-alumia-o11-turma.mjs.

-- ── 1. Tabelas ────────────────────────────────────────────────────────────────────────────────────────────────────────────

-- A turma: nome, o combinado da semana e o código para entrar. Quem cuida troca o combinado e o código.
create table if not exists interno.alumia_turmas (
  id uuid primary key default gen_random_uuid(),
  nome text not null check (char_length(nome) between 3 and 60),
  meta text not null check (char_length(meta) between 3 and 120),
  codigo text not null unique check (codigo ~ '^[a-z0-9]{10}$'),
  criada_em timestamptz not null default now(),
  meta_em timestamptz not null default now()
);

-- Quem está na turma. Ninguém lê esta tabela de fora: a turma só sabe quantas pessoas tem.
create table if not exists interno.alumia_turma_pessoas (
  turma uuid not null references interno.alumia_turmas (id) on delete cascade,
  usuario uuid not null references interno.perfis (id) on delete cascade,
  cuida boolean not null default false,
  entrou_em timestamptz not null default now(),
  primary key (turma, usuario)
);
create index if not exists alumia_turma_pessoas_usuario on interno.alumia_turma_pessoas (usuario);

-- A marca da semana que está correndo (só para não contar duas vezes e para desmarcar). Some quando a semana fecha.
create table if not exists interno.alumia_turma_marcas (
  turma uuid not null,
  semana date not null,
  usuario uuid not null,
  marcado_em timestamptz not null default now(),
  primary key (turma, semana, usuario),
  foreign key (turma, usuario) references interno.alumia_turma_pessoas (turma, usuario) on delete cascade
);

-- O total de cada semana fechada. Só o número, sem ninguém.
create table if not exists interno.alumia_turma_semanas (
  turma uuid not null references interno.alumia_turmas (id) on delete cascade,
  semana date not null,
  total integer not null check (total >= 0),
  primary key (turma, semana)
);

-- As datas da agenda de provas, escritas pela coordenação e pela mediação, sempre com a fonte oficial.
create table if not exists interno.alumia_agenda_datas (
  id uuid primary key default gen_random_uuid(),
  exame text not null check (char_length(exame) between 2 and 60),
  etapa text not null check (char_length(etapa) between 3 and 160),
  dia date not null,
  hora time,
  orgao text not null check (char_length(orgao) between 2 and 60),
  fonte text not null check (char_length(fonte) <= 500 and fonte ~ '^https://[^\s<>"]{3,}$'),
  conferido_em date not null,
  criada_em timestamptz not null default now(),
  atualizada_em timestamptz not null default now(),
  unique (exame, etapa, dia)
);
create index if not exists alumia_agenda_datas_dia on interno.alumia_agenda_datas (dia);

-- Quem assinou cada data. Só (data, pessoa) e os dois avisos já dados; some depois do dia.
create table if not exists interno.alumia_agenda_assinaturas (
  data uuid not null references interno.alumia_agenda_datas (id) on delete cascade,
  usuario uuid not null references interno.perfis (id) on delete cascade,
  avisado_7 boolean not null default false,
  avisado_1 boolean not null default false,
  desde timestamptz not null default now(),
  primary key (data, usuario)
);
create index if not exists alumia_agenda_assinaturas_usuario on interno.alumia_agenda_assinaturas (usuario);

-- Quem dá monitoria, e em quais disciplinas. Nomeado pela coordenação ou pela mediação; só vale depois do aceite.
create table if not exists interno.alumia_monitores (
  usuario uuid primary key references interno.perfis (id) on delete cascade,
  disciplinas text[] not null check (cardinality(disciplinas) between 1 and 5
    and disciplinas <@ array['matematica', 'linguagens', 'redacao', 'humanas', 'natureza']::text[]),
  situacao text not null default 'convidado' check (situacao in ('convidado', 'ativo')),
  nomeado_em timestamptz not null default now(),
  aceito_em timestamptz
);

-- Os horários que cada monitor oferece. A sala é a conversa da Alumia ou uma aula ao vivo do próprio monitor.
create table if not exists interno.alumia_monitoria_janelas (
  id uuid primary key default gen_random_uuid(),
  monitor uuid not null references interno.alumia_monitores (usuario) on delete cascade,
  disciplina text not null check (disciplina in ('matematica', 'linguagens', 'redacao', 'humanas', 'natureza')),
  inicio timestamptz not null,
  duracao integer not null check (duracao between 15 and 120),
  vagas integer not null check (vagas between 1 and 5),
  sala text not null default 'conversa' check (sala in ('conversa', 'aula')),
  aula uuid references interno.aulas_ao_vivo (id) on delete set null,
  nota text not null default '' check (char_length(nota) <= 200),
  lembrada boolean not null default false,
  cancelada_em timestamptz,
  criada_em timestamptz not null default now()
);
create index if not exists alumia_monitoria_janelas_inicio on interno.alumia_monitoria_janelas (inicio);
create index if not exists alumia_monitoria_janelas_monitor on interno.alumia_monitoria_janelas (monitor, inicio);

-- Quem marcou cada horário, com a dúvida em uma linha. Só o monitor daquele horário e a própria pessoa veem.
create table if not exists interno.alumia_monitoria_marcas (
  janela uuid not null references interno.alumia_monitoria_janelas (id) on delete cascade,
  usuario uuid not null references interno.perfis (id) on delete cascade,
  duvida text not null default '' check (char_length(duvida) <= 200),
  lembrada boolean not null default false,
  marcada_em timestamptz not null default now(),
  primary key (janela, usuario)
);
create index if not exists alumia_monitoria_marcas_usuario on interno.alumia_monitoria_marcas (usuario);

alter table interno.alumia_turmas enable row level security;
alter table interno.alumia_turma_pessoas enable row level security;
alter table interno.alumia_turma_marcas enable row level security;
alter table interno.alumia_turma_semanas enable row level security;
alter table interno.alumia_agenda_datas enable row level security;
alter table interno.alumia_agenda_assinaturas enable row level security;
alter table interno.alumia_monitores enable row level security;
alter table interno.alumia_monitoria_janelas enable row level security;
alter table interno.alumia_monitoria_marcas enable row level security;
revoke all on table interno.alumia_turmas, interno.alumia_turma_pessoas, interno.alumia_turma_marcas, interno.alumia_turma_semanas,
  interno.alumia_agenda_datas, interno.alumia_agenda_assinaturas, interno.alumia_monitores, interno.alumia_monitoria_janelas,
  interno.alumia_monitoria_marcas from public;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on table interno.alumia_turmas, interno.alumia_turma_pessoas, interno.alumia_turma_marcas, interno.alumia_turma_semanas,
      interno.alumia_agenda_datas, interno.alumia_agenda_assinaturas, interno.alumia_monitores, interno.alumia_monitoria_janelas,
      interno.alumia_monitoria_marcas from anon, authenticated;
  end if;
end $$;

-- ── 2. Auxiliares internos ────────────────────────────────────────────────────────────────────────────────────────────────

/** O menor número de pessoas que aparece escrito (o mesmo MINIMO_DE_PESSOAS da tela). Abaixo dele, nulo. */
create or replace function interno.alumia_o11t_numero(p integer) returns integer language sql immutable as $$
  select case when p >= 3 then p else null end
$$;

/**
 * O total de uma semana como a turma vê: só com ao menos 3 que marcaram e ao menos 3 que não marcaram (p_pessoas é quantas
 * pessoas a turma tem). Fora disso, nulo: na turma pequena, "todo mundo marcou" ou "só uma não marcou" diria quem foi.
 */
create or replace function interno.alumia_o11t_total(p_n integer, p_pessoas integer) returns integer language sql immutable as $$
  select case when p_n >= 3 and p_pessoas - p_n >= 3 then p_n end
$$;

/** A segunda-feira da semana (no horário de Brasília) em que cai este instante. */
create or replace function interno.alumia_o11t_semana(p timestamptz) returns date language sql stable as $$
  select date_trunc('week', p at time zone 'America/Sao_Paulo')::date
$$;

/** Hoje, no horário de Brasília. */
create or replace function interno.alumia_o11t_hoje() returns date language sql stable as $$
  select (now() at time zone 'America/Sao_Paulo')::date
$$;

/** As disciplinas da monitoria (a mesma lista de lib/rede/agenda/regras.ts) e o nome de cada uma, para os avisos. */
create or replace function interno.alumia_o11t_disciplinas() returns text[] language sql immutable as $$
  select array['matematica', 'linguagens', 'redacao', 'humanas', 'natureza']::text[]
$$;
create or replace function interno.alumia_o11t_disciplina_nome(p text) returns text language sql immutable as $$
  select case p when 'matematica' then 'Matemática' when 'linguagens' then 'Linguagens' when 'redacao' then 'Redação'
                when 'humanas' then 'Ciências Humanas' when 'natureza' then 'Ciências da Natureza' else p end
$$;

/** Quando, para os avisos: "15/11 às 19:00" (horário de Brasília). */
create or replace function interno.alumia_o11t_quando(p timestamptz) returns text language sql stable as $$
  select to_char(p at time zone 'America/Sao_Paulo', 'DD/MM "às" HH24:MI')
$$;

/** Um código novo de turma: 10 letras e números, sem repetir. */
create or replace function interno.alumia_o11t_codigo() returns text language plpgsql volatile security definer set search_path = interno, pg_temp as $$
declare v text;
begin
  loop
    v := substr(replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', ''), 1, 10);
    exit when not exists (select 1 from alumia_turmas where codigo = v);
  end loop;
  return v;
end $$;

/** Quem cuida da agenda e nomeia monitores: coordenação, vice-coordenação e mediação (com a regra de sessão de interno.tem). */
create or replace function interno.alumia_o11t_cuidador() returns boolean language sql stable security definer set search_path = interno, pg_temp as $$
  select interno.coord() or interno.tem('mediacao')
$$;

/** O @ e o codinome de alguém, como as telas da Alumia mostram (o @ some de quem está invisível). */
create or replace function interno.alumia_o11t_pessoa(p_usuario uuid) returns jsonb language sql stable security definer set search_path = interno, pg_temp as $$
  select jsonb_build_object('nome', interno.rede_nome(p_usuario),
    'handle', (select case when not coalesce(f.rede_modo = 'invisivel' or f.rede_invisivel, false) then f.rede_handle end from perfis f where f.id = p_usuario))
$$;

/** A pessoa pelo @nome (com ou sem a arroba). */
create or replace function interno.alumia_o11t_achar(p_handle text) returns uuid language sql stable security definer set search_path = interno, pg_temp as $$
  select f.id from perfis f where f.rede_handle = lower(btrim(ltrim(btrim(coalesce(p_handle, '')), '@'))) and btrim(coalesce(p_handle, '')) <> '' limit 1
$$;

/**
 * A chave do intervalo de quem desmarcou a semana em interno.rede_contagem_saidas (a mesma tabela do "vou" e da petição): sai da
 * turma e da semana, sem a pessoa.
 */
create or replace function interno.alumia_o11t_alvo(p_turma uuid, p_semana date) returns uuid language sql immutable as $$
  select md5('turma:' || p_turma::text || ':' || p_semana::text)::uuid
$$;

/** Quantas pessoas marcaram a semana que está correndo, no último marco (quem marcou até ele, mais quem desmarcou depois dele). */
create or replace function interno.alumia_o11t_marcas_no_marco(p_turma uuid) returns integer language sql stable security definer set search_path = interno, pg_temp as $$
  select ((select count(*) from alumia_turma_marcas m
           where m.turma = p_turma and m.semana = interno.alumia_o11t_semana(now()) and m.marcado_em <= interno.rede_contagem_marco())
        + (select count(*) from rede_contagem_saidas s
           where s.alvo = interno.alumia_o11t_alvo(p_turma, interno.alumia_o11t_semana(now()))
             and s.entrou_em <= interno.rede_contagem_marco() and s.saiu_em > interno.rede_contagem_marco()))::integer
$$;

/** Quem desmarca a semana que está correndo deixa só o intervalo (se já contava no marco). Fechar a semana não deixa nada. */
create or replace function interno.alumia_o11t_marca_saiu() returns trigger language plpgsql security definer set search_path = interno, pg_temp as $$
begin
  if old.semana = interno.alumia_o11t_semana(now()) and old.marcado_em <= interno.rede_contagem_marco()
     and exists (select 1 from alumia_turmas where id = old.turma) then
    insert into rede_contagem_saidas (alvo, entrou_em) values (interno.alumia_o11t_alvo(old.turma, old.semana), old.marcado_em);
  end if;
  return old;
end $$;
drop trigger if exists alumia_o11t_marca_saiu on interno.alumia_turma_marcas;
create trigger alumia_o11t_marca_saiu after delete on interno.alumia_turma_marcas for each row execute function interno.alumia_o11t_marca_saiu();

/**
 * Fecha as semanas que já passaram (de uma turma, ou de todas): cada uma vira só o total, e as marcas das pessoas somem. Se o
 * total aparece para a turma (interno.alumia_o11t_total: ao menos 3 que marcaram e 3 que não), ela recebe um aviso com o número
 * (semana fraca não vira aviso, e "todo mundo cumpriu" também não). Devolve quantas fechou.
 */
create or replace function interno.alumia_o11t_fechar_semanas(p_turma uuid default null) returns integer language plpgsql security definer set search_path = interno, pg_temp as $$
declare r record; n integer := 0; v_atual date := interno.alumia_o11t_semana(now());
begin
  for r in
    select m.turma, m.semana, count(*)::int as total from alumia_turma_marcas m
    where m.semana < v_atual and (p_turma is null or m.turma = p_turma) group by m.turma, m.semana
  loop
    insert into alumia_turma_semanas (turma, semana, total) values (r.turma, r.semana, r.total)
    on conflict (turma, semana) do update set total = alumia_turma_semanas.total + excluded.total;
    delete from alumia_turma_marcas where turma = r.turma and semana = r.semana;
    if interno.alumia_o11t_total(r.total, (select count(*)::int from alumia_turma_pessoas x where x.turma = r.turma)) is not null then
      insert into avisos (para, texto, categoria)
      select tp.usuario, left(format('Na semana de %s, %s pessoas da turma “%s” cumpriram o combinado: %s.', to_char(r.semana, 'DD/MM'), r.total, t.nome, t.meta), 500), 'rede'
      from alumia_turma_pessoas tp join alumia_turmas t on t.id = tp.turma where tp.turma = r.turma;
    end if;
    n := n + 1;
  end loop;
  -- Meio ano de semanas basta para a fileira do mosaico; o resto some.
  delete from alumia_turma_semanas where semana < v_atual - 182 and (p_turma is null or turma = p_turma);
  return n;
end $$;

/**
 * Uma turma como a pessoa que está nela vê: só números, o combinado, a marca dela e as semanas fechadas. Quantas pessoas, a partir
 * de 3; o total da semana pelo marco e só com 3 que marcaram e 3 que não (interno.alumia_o11t_total); as fechadas pela mesma regra.
 */
create or replace function interno.alumia_o11t_turma_json(p_turma uuid, p_quem uuid) returns jsonb language sql stable security definer set search_path = interno, pg_temp as $$
  select jsonb_build_object(
    'id', t.id, 'nome', t.nome, 'meta', t.meta, 'codigo', t.codigo, 'cuida', tp.cuida,
    'pessoas', interno.alumia_o11t_numero(g.n),
    'semana', interno.alumia_o11t_semana(now()),
    'marquei', exists (select 1 from alumia_turma_marcas m where m.turma = t.id and m.semana = interno.alumia_o11t_semana(now()) and m.usuario = p_quem),
    'total', interno.alumia_o11t_total(interno.alumia_o11t_marcas_no_marco(t.id), g.n),
    'semanas', (select coalesce(jsonb_agg(jsonb_build_object('semana', s.semana, 'total', interno.alumia_o11t_total(s.total, g.n)) order by s.semana desc), '[]'::jsonb)
                from (select * from alumia_turma_semanas s where s.turma = t.id order by s.semana desc limit 8) s))
  from alumia_turmas t join alumia_turma_pessoas tp on tp.turma = t.id and tp.usuario = p_quem
  cross join lateral (select count(*)::int as n from alumia_turma_pessoas x where x.turma = t.id) g
  where t.id = p_turma
$$;

/** A pessoa está na turma? Senão, "nao_encontrado" (não diz se a turma existe). */
create or replace function interno.alumia_o11t_na_turma(p_turma uuid, p_quem uuid) returns interno.alumia_turma_pessoas language plpgsql stable security definer set search_path = interno, pg_temp as $$
declare tp alumia_turma_pessoas;
begin
  select * into tp from alumia_turma_pessoas where turma = p_turma and usuario = p_quem;
  if not found then perform interno.erro('nao_encontrado'); end if;
  return tp;
end $$;

-- ── 3. Turma de estudo ────────────────────────────────────────────────────────────────────────────────────────────────────

/** As minhas turmas. Fecha antes as semanas que já passaram (o agendador também fecha, toda segunda). */
create or replace function public.alumia_turma_minhas() returns jsonb language plpgsql volatile security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); r record;
begin
  for r in select turma from alumia_turma_pessoas where usuario = v loop
    perform interno.alumia_o11t_fechar_semanas(r.turma);
  end loop;
  return jsonb_build_object('itens', (
    select coalesce(jsonb_agg(interno.alumia_o11t_turma_json(tp.turma, v) order by tp.entrou_em), '[]'::jsonb)
    from alumia_turma_pessoas tp where tp.usuario = v));
end $$;

/** Cria uma turma; quem cria cuida dela. Até 5 turmas por pessoa. */
create or replace function public.alumia_turma_criar(p_nome text, p_meta text) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); v_nome text; v_meta text; v_id uuid;
begin
  v_nome := interno.txt(p_nome, 'nome', 3, 60);
  v_meta := interno.txt(p_meta, 'meta', 3, 120);
  if (select count(*) from alumia_turma_pessoas where usuario = v) >= 5 then perform interno.erro('limite_de_turmas'); end if;
  perform interno.limite('alumia_turma_criar', 5, 1440);
  insert into alumia_turmas (nome, meta, codigo) values (v_nome, v_meta, interno.alumia_o11t_codigo()) returning id into v_id;
  insert into alumia_turma_pessoas (turma, usuario, cuida) values (v_id, v, true);
  return interno.alumia_o11t_turma_json(v_id, v);
end $$;

/** Entra numa turma pelo código. Até 12 pessoas por turma e 5 turmas por pessoa. */
create or replace function public.alumia_turma_entrar(p_codigo text) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); t alumia_turmas; v_codigo text := lower(btrim(coalesce(p_codigo, '')));
begin
  perform interno.limite('alumia_turma_entrar', 10, 60);
  if v_codigo !~ '^[a-z0-9]{10}$' then perform interno.erro('nao_encontrado'); end if;
  select * into t from alumia_turmas where codigo = v_codigo for update;
  if not found then perform interno.erro('nao_encontrado'); end if;
  if exists (select 1 from alumia_turma_pessoas where turma = t.id and usuario = v) then return interno.alumia_o11t_turma_json(t.id, v); end if;
  if (select count(*) from alumia_turma_pessoas where usuario = v) >= 5 then perform interno.erro('limite_de_turmas'); end if;
  if (select count(*) from alumia_turma_pessoas where turma = t.id) >= 12 then perform interno.erro('turma_cheia'); end if;
  insert into alumia_turma_pessoas (turma, usuario) values (t.id, v);
  return interno.alumia_o11t_turma_json(t.id, v);
end $$;

/** Marca (ou desmarca) a própria semana. Só a semana que está correndo: a que fechou não muda mais. */
create or replace function public.alumia_turma_marcar(p_turma uuid, p_sim boolean) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); v_semana date := interno.alumia_o11t_semana(now());
begin
  perform interno.alumia_o11t_na_turma(p_turma, v);
  perform interno.limite('alumia_turma_marcar', 60, 60);
  perform interno.alumia_o11t_fechar_semanas(p_turma);
  if coalesce(p_sim, false) then
    insert into alumia_turma_marcas (turma, semana, usuario) values (p_turma, v_semana, v) on conflict do nothing;
  else
    delete from alumia_turma_marcas where turma = p_turma and semana = v_semana and usuario = v;
  end if;
  return interno.alumia_o11t_turma_json(p_turma, v);
end $$;

/** Troca o nome e o combinado (só quem cuida). Quem está na turma recebe um aviso do combinado novo. */
create or replace function public.alumia_turma_editar(p_turma uuid, p_nome text, p_meta text) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); tp alumia_turma_pessoas; t alumia_turmas; v_nome text; v_meta text;
begin
  tp := interno.alumia_o11t_na_turma(p_turma, v);
  if not tp.cuida then perform interno.erro('sem_permissao'); end if;
  v_nome := interno.txt(p_nome, 'nome', 3, 60);
  v_meta := interno.txt(p_meta, 'meta', 3, 120);
  perform interno.limite('alumia_turma_editar', 20, 1440);
  select * into t from alumia_turmas where id = p_turma;
  update alumia_turmas set nome = v_nome, meta = v_meta, meta_em = case when meta is distinct from v_meta then now() else meta_em end where id = p_turma;
  if t.meta is distinct from v_meta then
    insert into avisos (para, texto, categoria)
    select usuario, left(format('A turma “%s” tem um combinado novo: %s.', v_nome, v_meta), 500), 'rede'
    from alumia_turma_pessoas where turma = p_turma and usuario <> v;
  end if;
  return interno.alumia_o11t_turma_json(p_turma, v);
end $$;

/** Um código novo (só quem cuida): o antigo deixa de valer. */
create or replace function public.alumia_turma_novo_codigo(p_turma uuid) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); tp alumia_turma_pessoas;
begin
  tp := interno.alumia_o11t_na_turma(p_turma, v);
  if not tp.cuida then perform interno.erro('sem_permissao'); end if;
  perform interno.limite('alumia_turma_codigo', 10, 1440);
  update alumia_turmas set codigo = interno.alumia_o11t_codigo() where id = p_turma;
  return interno.alumia_o11t_turma_json(p_turma, v);
end $$;

/**
 * Sai da turma (a marca da semana sai junto). A última pessoa que sai apaga a turma. Se quem cuidava sai e ninguém mais cuida,
 * a pessoa que está há mais tempo passa a cuidar, e recebe um aviso.
 */
create or replace function public.alumia_turma_sair(p_turma uuid) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); tp alumia_turma_pessoas; v_nova uuid; v_nome text;
begin
  tp := interno.alumia_o11t_na_turma(p_turma, v);
  perform interno.alumia_o11t_fechar_semanas(p_turma);
  delete from alumia_turma_pessoas where turma = p_turma and usuario = v;
  if not exists (select 1 from alumia_turma_pessoas where turma = p_turma) then
    delete from alumia_turmas where id = p_turma;
  elsif tp.cuida and not exists (select 1 from alumia_turma_pessoas where turma = p_turma and cuida) then
    select usuario into v_nova from alumia_turma_pessoas where turma = p_turma order by entrou_em, usuario limit 1;
    update alumia_turma_pessoas set cuida = true where turma = p_turma and usuario = v_nova;
    select nome into v_nome from alumia_turmas where id = p_turma;
    perform interno.avisar_em(v_nova, format('Agora você cuida da turma “%s”: pode trocar o combinado e o código.', v_nome), 'rede');
  end if;
  return jsonb_build_object('ok', true);
end $$;

-- ── 4. Agenda de provas ───────────────────────────────────────────────────────────────────────────────────────────────────

/** Uma data como a tela mostra, com a marca de assinada para quem pergunta. */
create or replace function interno.alumia_o11t_data_json(d interno.alumia_agenda_datas, p_quem uuid) returns jsonb language sql stable security definer set search_path = interno, pg_temp as $$
  select jsonb_build_object('id', d.id, 'exame', d.exame, 'etapa', d.etapa, 'dia', d.dia, 'hora', to_char(d.hora, 'HH24:MI'), 'orgao', d.orgao,
    'fonte', d.fonte, 'conferido_em', d.conferido_em,
    'assinada', exists (select 1 from alumia_agenda_assinaturas a where a.data = d.id and a.usuario = p_quem))
$$;

/** As datas de hoje em diante (e as da última semana, para quem acabou de fazer a prova), e se a pessoa cuida da agenda. */
create or replace function public.alumia_agenda_datas() returns jsonb language plpgsql stable security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu();
begin
  return jsonb_build_object(
    'pode_cuidar', interno.alumia_o11t_cuidador(),
    'hoje', interno.alumia_o11t_hoje(),
    'itens', (select coalesce(jsonb_agg(interno.alumia_o11t_data_json(d, v) order by d.dia, d.hora nulls first, d.exame, d.etapa), '[]'::jsonb)
              from alumia_agenda_datas d where d.dia >= interno.alumia_o11t_hoje() - 7));
end $$;

/**
 * Assina (ou deixa de assinar) uma ou mais datas. Até 60 assinaturas por pessoa. Data que já passou não se assina. O aviso que
 * já não cabe (assinar a 3 dias da prova) nasce marcado como dado, para não chegar um "faltam 7 dias" fora de hora.
 */
create or replace function public.alumia_agenda_assinar(p_datas uuid[], p_sim boolean) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); v_hoje date := interno.alumia_o11t_hoje();
begin
  if p_datas is null or cardinality(p_datas) = 0 or cardinality(p_datas) > 60 then perform interno.erro('invalido:datas'); end if;
  perform interno.limite('alumia_agenda_assinar', 120, 60);
  if coalesce(p_sim, false) then
    insert into alumia_agenda_assinaturas (data, usuario, avisado_7, avisado_1)
    select d.id, v, d.dia - v_hoje <= 7, d.dia - v_hoje <= 1 from alumia_agenda_datas d where d.id = any (p_datas) and d.dia >= v_hoje
    on conflict do nothing;
    if (select count(*) from alumia_agenda_assinaturas where usuario = v) > 60 then perform interno.erro('limite_de_assinaturas'); end if;
  else
    delete from alumia_agenda_assinaturas where usuario = v and data = any (p_datas);
  end if;
  return public.alumia_agenda_datas();
end $$;

/**
 * Escreve uma data (nova, ou a que tem p_id). Só coordenação, vice-coordenação e mediação. A fonte oficial é obrigatória
 * (https), e o dia em que foi conferida não pode ser no futuro. A mesma prova, etapa e dia não se repetem: escrever de novo
 * atualiza a fonte (é assim que "trazer as datas do ENEM do site" não duplica nada). Se o dia ou a hora mudou, quem assinou
 * é avisado e os lembretes recomeçam.
 */
create or replace function public.alumia_agenda_salvar(p_id uuid, p jsonb) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare
  v uuid := interno.eu(); d alumia_agenda_datas; v_antes alumia_agenda_datas; v_exame text; v_etapa text; v_orgao text; v_fonte text;
  v_dia date; v_hora time; v_conferido date; v_id uuid; v_hoje date := interno.alumia_o11t_hoje();
begin
  if not interno.alumia_o11t_cuidador() then perform interno.erro('sem_permissao'); end if;
  if p is null or jsonb_typeof(p) is distinct from 'object' or exists (select 1 from jsonb_object_keys(p) k where k not in ('exame', 'etapa', 'dia', 'hora', 'orgao', 'fonte', 'conferido_em')) then
    perform interno.erro('invalido:data');
  end if;
  perform interno.limite('alumia_agenda_salvar', 200, 60);
  v_exame := interno.txt(p ->> 'exame', 'exame', 2, 60);
  v_etapa := interno.txt(p ->> 'etapa', 'etapa', 3, 160);
  v_orgao := interno.txt(p ->> 'orgao', 'orgao', 2, 60);
  v_fonte := interno.txt(p ->> 'fonte', 'fonte', 11, 500);
  if v_fonte !~ '^https://[^\s<>"]{3,}$' then perform interno.erro('invalido:fonte'); end if;
  begin
    v_dia := (p ->> 'dia')::date;
    v_conferido := (p ->> 'conferido_em')::date;
    v_hora := nullif(btrim(coalesce(p ->> 'hora', '')), '')::time;
  exception when others then
    perform interno.erro('invalido:dia');
  end;
  if v_dia is null or v_dia < v_hoje - 30 or v_dia > v_hoje + 800 then perform interno.erro('invalido:dia'); end if;
  if v_conferido is null or v_conferido > v_hoje or v_conferido < v_hoje - 400 then perform interno.erro('invalido:conferido_em'); end if;
  if p_id is not null then
    select * into v_antes from alumia_agenda_datas where id = p_id for update;
    if not found then perform interno.erro('nao_encontrado'); end if;
    begin
      update alumia_agenda_datas set exame = v_exame, etapa = v_etapa, dia = v_dia, hora = v_hora, orgao = v_orgao, fonte = v_fonte,
        conferido_em = v_conferido, atualizada_em = now() where id = p_id returning * into d;
    exception when unique_violation then
      perform interno.erro('invalido:repetida');
    end;
  else
    insert into alumia_agenda_datas (exame, etapa, dia, hora, orgao, fonte, conferido_em)
    values (v_exame, v_etapa, v_dia, v_hora, v_orgao, v_fonte, v_conferido)
    on conflict (exame, etapa, dia) do update set hora = excluded.hora, orgao = excluded.orgao, fonte = excluded.fonte,
      conferido_em = excluded.conferido_em, atualizada_em = now()
    returning * into d;
  end if;
  if v_antes.id is not null and (v_antes.dia is distinct from d.dia or v_antes.hora is distinct from d.hora) then
    update alumia_agenda_assinaturas set avisado_7 = d.dia - v_hoje <= 7, avisado_1 = d.dia - v_hoje <= 1 where data = d.id;
    insert into avisos (para, texto, categoria)
    select a.usuario, left(format('A data mudou: %s · %s agora é em %s%s (antes: %s). Fonte: %s', d.exame, d.etapa, to_char(d.dia, 'DD/MM/YYYY'),
      coalesce(' às ' || to_char(d.hora, 'HH24:MI'), ''), to_char(v_antes.dia, 'DD/MM/YYYY'), d.fonte), 500), 'rede'
    from alumia_agenda_assinaturas a where a.data = d.id;
  end if;
  return interno.alumia_o11t_data_json(d, v);
end $$;

/** Tira uma data da agenda (só quem cuida). Quem assinou é avisado. */
create or replace function public.alumia_agenda_apagar(p_id uuid) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); d alumia_agenda_datas;
begin
  if not interno.alumia_o11t_cuidador() then perform interno.erro('sem_permissao'); end if;
  select * into d from alumia_agenda_datas where id = p_id;
  if not found then perform interno.erro('nao_encontrado'); end if;
  insert into avisos (para, texto, categoria)
  select a.usuario, left(format('A data %s · %s (%s) saiu da agenda de provas. Confira na fonte oficial.', d.exame, d.etapa, to_char(d.dia, 'DD/MM/YYYY')), 500), 'rede'
  from alumia_agenda_assinaturas a where a.data = d.id and a.usuario <> v;
  delete from alumia_agenda_datas where id = p_id;
  return jsonb_build_object('ok', true);
end $$;

/**
 * Os lembretes da agenda (agendador, de hora em hora; só o dono do banco chama; p_agora só muda no teste): faltando 7 dias e faltando 1 dia, das 9h às 21h
 * de Brasília. Depois do dia, a assinatura some; um ano depois, a data também.
 */
create or replace function interno.alumia_o11t_agenda_rodar(p_agora timestamptz default now()) returns integer language plpgsql security definer set search_path = interno, pg_temp as $$
declare n integer := 0; v_hoje date := (p_agora at time zone 'America/Sao_Paulo')::date; v_hora integer := extract(hour from p_agora at time zone 'America/Sao_Paulo')::int; k integer;
begin
  delete from alumia_agenda_assinaturas a using alumia_agenda_datas d where d.id = a.data and d.dia < v_hoje;
  delete from alumia_agenda_datas where dia < v_hoje - 365;
  if v_hora < 9 or v_hora > 21 then return 0; end if;
  with feitos as (
    update alumia_agenda_assinaturas a set avisado_7 = true from alumia_agenda_datas d
    where d.id = a.data and not a.avisado_7 and d.dia - v_hoje between 2 and 7
    returning a.usuario, d.exame, d.etapa, d.dia, d.hora, d.dia - v_hoje as faltam
  )
  insert into avisos (para, texto, categoria)
  select usuario, left(format('Faltam %s dias: %s · %s, em %s%s.', faltam, exame, etapa, to_char(dia, 'DD/MM'), coalesce(' às ' || to_char(hora, 'HH24:MI'), '')), 500), 'rede' from feitos;
  get diagnostics k = row_count; n := n + k;
  with feitos as (
    update alumia_agenda_assinaturas a set avisado_1 = true, avisado_7 = true from alumia_agenda_datas d
    where d.id = a.data and not a.avisado_1 and d.dia - v_hoje between 0 and 1
    returning a.usuario, d.exame, d.etapa, d.dia, d.hora, d.dia - v_hoje as faltam
  )
  insert into avisos (para, texto, categoria)
  select usuario, left(format('%s: %s · %s%s.', case when faltam = 0 then 'Hoje' else 'Amanhã' end, exame, etapa, coalesce(' às ' || to_char(hora, 'HH24:MI'), '')), 500), 'rede' from feitos;
  get diagnostics k = row_count; n := n + k;
  return n;
end $$;

-- ── 5. Monitoria marcada ──────────────────────────────────────────────────────────────────────────────────────────────────

/** O monitor ativo nesta disciplina? */
create or replace function interno.alumia_o11t_monitor(p_quem uuid, p_disciplina text default null) returns boolean language sql stable security definer set search_path = interno, pg_temp as $$
  select exists (select 1 from alumia_monitores m join perfis f on f.id = m.usuario
                 where m.usuario = p_quem and m.situacao = 'ativo' and not f.suspenso and (p_disciplina is null or p_disciplina = any (m.disciplinas)))
$$;

/** A sala de um horário como a tela abre: a conversa com a outra pessoa, ou a aula ao vivo (só o id; a tela monta o endereço). */
create or replace function interno.alumia_o11t_janela_json(j interno.alumia_monitoria_janelas) returns jsonb language sql stable security definer set search_path = interno, pg_temp as $$
  select jsonb_build_object('id', j.id, 'disciplina', j.disciplina, 'inicio', j.inicio, 'duracao', j.duracao, 'sala', j.sala,
    'aula', case when j.sala = 'aula' then j.aula end, 'nota', j.nota, 'cancelada', j.cancelada_em is not null)
$$;

/**
 * Tudo da monitoria para quem abre a aba: os horários com vaga (sem dizer de quem, nem quantas vagas sobram, nem a aula ao vivo,
 * que diria quem é o monitor: só se a sala é a aula ou a conversa; e sem tirar os de quem a pessoa bloqueou, que seria um jeito
 * de descobrir quem dá cada horário: o bloqueio é conferido ao marcar, com a mesma resposta de horário cheio), os que a pessoa
 * marcou (com o monitor), o convite para ser monitor, e, para o monitor, os horários dele com quem marcou. Para quem cuida, se
 * pode nomear.
 */
create or replace function public.alumia_monitoria() returns jsonb language plpgsql stable security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); m alumia_monitores;
begin
  select * into m from alumia_monitores where usuario = v;
  return jsonb_build_object(
    'pode_nomear', interno.alumia_o11t_cuidador(),
    'eu', case when m.usuario is null then null else jsonb_build_object('situacao', m.situacao, 'disciplinas', to_jsonb(m.disciplinas)) end,
    'abertas', (
      select coalesce(jsonb_agg((interno.alumia_o11t_janela_json(j) - 'aula') order by j.inicio), '[]'::jsonb)
      from alumia_monitoria_janelas j
      where j.cancelada_em is null and j.inicio > now() + interval '10 minutes' and j.monitor <> v
        and interno.alumia_o11t_monitor(j.monitor, j.disciplina)
        and not exists (select 1 from alumia_monitoria_marcas x where x.janela = j.id and x.usuario = v)
        and (select count(*) from alumia_monitoria_marcas x where x.janela = j.id) < j.vagas),
    'marcadas', (
      select coalesce(jsonb_agg(interno.alumia_o11t_janela_json(j) || jsonb_build_object('monitor', interno.alumia_o11t_pessoa(j.monitor), 'duvida', x.duvida) order by j.inicio), '[]'::jsonb)
      from alumia_monitoria_marcas x join alumia_monitoria_janelas j on j.id = x.janela where x.usuario = v),
    'minhas', case when m.situacao = 'ativo' then (
      select coalesce(jsonb_agg(interno.alumia_o11t_janela_json(j) || jsonb_build_object('vagas', j.vagas, 'marcas', (
          select coalesce(jsonb_agg(interno.alumia_o11t_pessoa(x.usuario) || jsonb_build_object('duvida', x.duvida) order by x.marcada_em), '[]'::jsonb)
          from alumia_monitoria_marcas x where x.janela = j.id)) order by j.inicio), '[]'::jsonb)
      from alumia_monitoria_janelas j where j.monitor = v) else '[]'::jsonb end,
    'aulas', case when m.situacao = 'ativo' then (
      select coalesce(jsonb_agg(jsonb_build_object('id', a.id, 'titulo', a.titulo, 'inicio', a.inicio) order by a.inicio), '[]'::jsonb)
      from aulas_ao_vivo a where (a.educador = v or v = any (a.co_educadores)) and a.status in ('agendada', 'ao_vivo') and a.inicio > now() - interval '4 hours') else '[]'::jsonb end);
end $$;

/**
 * O monitor oferece um horário: disciplina dele, de 1 hora a 60 dias à frente, 15 a 120 minutos, 1 a 5 vagas, a sala (a
 * conversa da Alumia ou uma aula ao vivo dele) e uma nota curta. Até 30 horários marcados à frente.
 */
create or replace function public.alumia_monitoria_oferecer(p jsonb) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); v_disc text; v_inicio timestamptz; v_duracao integer; v_vagas integer; v_sala text; v_aula uuid; v_nota text; j alumia_monitoria_janelas;
begin
  if p is null or jsonb_typeof(p) is distinct from 'object' or exists (select 1 from jsonb_object_keys(p) k where k not in ('disciplina', 'inicio', 'duracao', 'vagas', 'sala', 'aula', 'nota')) then
    perform interno.erro('invalido:horario');
  end if;
  v_disc := p ->> 'disciplina';
  if v_disc is null or not (v_disc = any (interno.alumia_o11t_disciplinas())) then perform interno.erro('invalido:disciplina'); end if;
  if not interno.alumia_o11t_monitor(v, v_disc) then perform interno.erro('sem_permissao'); end if;
  begin
    v_inicio := (p ->> 'inicio')::timestamptz;
    v_duracao := coalesce((p ->> 'duracao')::int, 60);
    v_vagas := coalesce((p ->> 'vagas')::int, 1);
    v_aula := nullif(p ->> 'aula', '')::uuid;
  exception when others then
    perform interno.erro('invalido:horario');
  end;
  if v_inicio is null or v_inicio < now() + interval '1 hour' or v_inicio > now() + interval '60 days' then perform interno.erro('invalido:inicio'); end if;
  if v_duracao not between 15 and 120 then perform interno.erro('invalido:duracao'); end if;
  if v_vagas not between 1 and 5 then perform interno.erro('invalido:vagas'); end if;
  v_sala := coalesce(p ->> 'sala', 'conversa');
  if v_sala not in ('conversa', 'aula') then perform interno.erro('invalido:sala'); end if;
  if v_sala = 'aula' and not exists (select 1 from aulas_ao_vivo a where a.id = v_aula and (a.educador = v or v = any (a.co_educadores)) and a.status in ('agendada', 'ao_vivo')) then
    perform interno.erro('invalido:aula');
  end if;
  if v_sala = 'conversa' then v_aula := null; end if;
  v_nota := interno.txt(coalesce(p ->> 'nota', ''), 'nota', 0, 200);
  perform interno.limite('alumia_monitoria_oferecer', 30, 1440);
  if (select count(*) from alumia_monitoria_janelas where monitor = v and cancelada_em is null and inicio > now()) >= 30 then perform interno.erro('limite_de_horarios'); end if;
  insert into alumia_monitoria_janelas (monitor, disciplina, inicio, duracao, vagas, sala, aula, nota)
  values (v, v_disc, v_inicio, v_duracao, v_vagas, v_sala, v_aula, v_nota) returning * into j;
  return interno.alumia_o11t_janela_json(j) || jsonb_build_object('vagas', j.vagas, 'marcas', '[]'::jsonb);
end $$;

/** O monitor cancela um horário dele: quem marcou é avisado. */
create or replace function public.alumia_monitoria_cancelar(p_janela uuid) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); j alumia_monitoria_janelas;
begin
  select * into j from alumia_monitoria_janelas where id = p_janela and monitor = v for update;
  if not found then perform interno.erro('nao_encontrado'); end if;
  if j.cancelada_em is null then
    update alumia_monitoria_janelas set cancelada_em = now() where id = j.id;
    insert into avisos (para, texto, categoria)
    select x.usuario, left(format('A monitoria de %s em %s foi cancelada por quem ia dar. Procure outro horário na Agenda.', interno.alumia_o11t_disciplina_nome(j.disciplina), interno.alumia_o11t_quando(j.inicio)), 500), 'rede'
    from alumia_monitoria_marcas x where x.janela = j.id;
  end if;
  return jsonb_build_object('ok', true);
end $$;

/**
 * Marca um horário com a dúvida em uma linha. Não marca o próprio, o que já começou, o que está cheio, nem de quem a bloqueou
 * (ou foi bloqueado por ela): estes dois respondem {erro: 'sem_vaga'}, iguais, e contam no freio. Até 3 marcados à frente por
 * pessoa. Os dois são avisados.
 */
create or replace function public.alumia_monitoria_marcar(p_janela uuid, p_duvida text) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); j alumia_monitoria_janelas; v_duvida text; v_nome text;
begin
  v_duvida := interno.txt(coalesce(p_duvida, ''), 'duvida', 0, 200);
  perform interno.limite('alumia_monitoria_marcar', 20, 1440);
  select * into j from alumia_monitoria_janelas where id = p_janela for update;
  if not found or j.cancelada_em is not null or j.monitor = v or not interno.alumia_o11t_monitor(j.monitor, j.disciplina) then
    perform interno.erro('nao_encontrado');
  end if;
  if j.inicio <= now() + interval '10 minutes' then perform interno.erro('ja_comecou'); end if;
  if exists (select 1 from alumia_monitoria_marcas where janela = j.id and usuario = v) then perform interno.erro('ja_marcada'); end if;
  -- Bloqueio entre a pessoa e o monitor: a mesma resposta de horário cheio (a lista não esconde o horário, para não apontar quem é).
  -- A resposta volta sem erro, para o pedido CONTAR no freio de marcar (um erro desfaria o freio junto): tentar adivinhar quem dá
  -- cada horário bloqueando e marcando gasta os 20 pedidos do dia, e é igual a dar com um horário cheio.
  if (select count(*) from alumia_monitoria_marcas where janela = j.id) >= j.vagas or interno.rede_bloqueado(v, j.monitor) then
    return jsonb_build_object('erro', 'sem_vaga');
  end if;
  if (select count(*) from alumia_monitoria_marcas x join alumia_monitoria_janelas k on k.id = x.janela where x.usuario = v and k.inicio > now() and k.cancelada_em is null) >= 3 then
    perform interno.erro('limite_de_marcas');
  end if;
  insert into alumia_monitoria_marcas (janela, usuario, duvida) values (j.id, v, v_duvida);
  v_nome := interno.rede_nome(v);
  perform interno.avisar_em(j.monitor, format('Monitoria marcada: %s em %s, com %s.%s', interno.alumia_o11t_disciplina_nome(j.disciplina), interno.alumia_o11t_quando(j.inicio), v_nome,
    case when v_duvida <> '' then format(' A dúvida: “%s”', v_duvida) else '' end), 'rede');
  perform interno.avisar_em(v, format('Você marcou a monitoria de %s em %s. A sala abre pela Agenda, na aba Monitoria.', interno.alumia_o11t_disciplina_nome(j.disciplina), interno.alumia_o11t_quando(j.inicio)), 'rede');
  return interno.alumia_o11t_janela_json(j) || jsonb_build_object('monitor', interno.alumia_o11t_pessoa(j.monitor), 'duvida', v_duvida);
end $$;

/** Desmarca. O monitor é avisado (antes de o horário começar). */
create or replace function public.alumia_monitoria_desmarcar(p_janela uuid) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); j alumia_monitoria_janelas;
begin
  select k.* into j from alumia_monitoria_janelas k join alumia_monitoria_marcas x on x.janela = k.id and x.usuario = v where k.id = p_janela;
  if not found then perform interno.erro('nao_encontrado'); end if;
  delete from alumia_monitoria_marcas where janela = j.id and usuario = v;
  if j.cancelada_em is null and j.inicio > now() then
    perform interno.avisar_em(j.monitor, format('%s desmarcou a monitoria de %s em %s.', interno.rede_nome(v), interno.alumia_o11t_disciplina_nome(j.disciplina), interno.alumia_o11t_quando(j.inicio)), 'rede');
  end if;
  return jsonb_build_object('ok', true);
end $$;

/** A coordenação, a vice-coordenação ou a mediação convida alguém para dar monitoria, nas disciplinas escolhidas. */
create or replace function public.alumia_monitoria_nomear(p_handle text, p_disciplinas text[]) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); v_quem uuid; v_disc text[];
begin
  if not interno.alumia_o11t_cuidador() then perform interno.erro('sem_permissao'); end if;
  v_quem := interno.alumia_o11t_achar(p_handle);
  if v_quem is null or exists (select 1 from perfis f where f.id = v_quem and f.suspenso) then perform interno.erro('invalido:pessoa'); end if;
  v_disc := array(select distinct x from unnest(coalesce(p_disciplinas, '{}'::text[])) x order by x);
  if cardinality(v_disc) = 0 or not (v_disc <@ interno.alumia_o11t_disciplinas()) then perform interno.erro('invalido:disciplinas'); end if;
  perform interno.limite('alumia_monitoria_nomear', 50, 1440);
  insert into alumia_monitores (usuario, disciplinas) values (v_quem, v_disc)
  on conflict (usuario) do update set disciplinas = excluded.disciplinas;
  if (select situacao from alumia_monitores where usuario = v_quem) = 'convidado' then
    perform interno.avisar_em(v_quem, format('Chegou um convite para você dar monitoria na Alumia (%s). Aceite ou recuse na Agenda, na aba Monitoria.',
      (select string_agg(interno.alumia_o11t_disciplina_nome(x), ', ') from unnest(v_disc) x)), 'rede');
  end if;
  return public.alumia_monitoria_monitores();
end $$;

/** A pessoa convidada aceita ou recusa. Recusar apaga o convite. */
create or replace function public.alumia_monitoria_responder(p_aceita boolean) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu();
begin
  if not exists (select 1 from alumia_monitores where usuario = v and situacao = 'convidado') then perform interno.erro('nao_encontrado'); end if;
  if coalesce(p_aceita, false) then
    update alumia_monitores set situacao = 'ativo', aceito_em = now() where usuario = v;
  else
    delete from alumia_monitores where usuario = v;
  end if;
  return public.alumia_monitoria();
end $$;

/** Deixa de dar monitoria (por vontade própria, ou tirada por quem cuida): os horários à frente caem, com aviso a quem marcou. */
create or replace function interno.alumia_o11t_monitor_sair(p_quem uuid) returns void language plpgsql security definer set search_path = interno, pg_temp as $$
declare j record;
begin
  for j in select * from alumia_monitoria_janelas where monitor = p_quem and cancelada_em is null and inicio > now() loop
    insert into avisos (para, texto, categoria)
    select x.usuario, left(format('A monitoria de %s em %s foi cancelada por quem ia dar. Procure outro horário na Agenda.', interno.alumia_o11t_disciplina_nome(j.disciplina), interno.alumia_o11t_quando(j.inicio)), 500), 'rede'
    from alumia_monitoria_marcas x where x.janela = j.id;
  end loop;
  delete from alumia_monitores where usuario = p_quem;
end $$;

create or replace function public.alumia_monitoria_deixar() returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu();
begin
  if not exists (select 1 from alumia_monitores where usuario = v) then perform interno.erro('nao_encontrado'); end if;
  perform interno.alumia_o11t_monitor_sair(v);
  return public.alumia_monitoria();
end $$;

create or replace function public.alumia_monitoria_tirar(p_handle text) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); v_quem uuid;
begin
  if not interno.alumia_o11t_cuidador() then perform interno.erro('sem_permissao'); end if;
  v_quem := interno.alumia_o11t_achar(p_handle);
  if v_quem is null or not exists (select 1 from alumia_monitores where usuario = v_quem) then perform interno.erro('nao_encontrado'); end if;
  perform interno.alumia_o11t_monitor_sair(v_quem);
  perform interno.avisar_em(v_quem, 'Você deixou de dar monitoria na Alumia. Os horários que estavam marcados foram cancelados, com aviso a quem marcou.', 'rede');
  return public.alumia_monitoria_monitores();
end $$;

/**
 * Quem dá monitoria, para quem cuida (coordenação, vice-coordenação e mediação), como a lista de cargos é só da moderação. Mostra o
 * codinome, o @, as disciplinas e se aceitou; nunca quem marcou com cada um, nem quantas pessoas cada um atendeu.
 */
create or replace function public.alumia_monitoria_monitores() returns jsonb language plpgsql stable security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu();
begin
  if not interno.alumia_o11t_cuidador() then perform interno.erro('sem_permissao'); end if;
  return jsonb_build_object('itens', (
    select coalesce(jsonb_agg(interno.alumia_o11t_pessoa(m.usuario) || jsonb_build_object('disciplinas', to_jsonb(m.disciplinas), 'situacao', m.situacao) order by m.nomeado_em), '[]'::jsonb)
    from alumia_monitores m));
end $$;

/**
 * A rodada da monitoria (agendador, de 10 em 10 minutos; só o dono do banco chama): lembrete 1 hora antes, para quem marcou e para
 * o monitor (uma vez por horário); um dia depois do fim, o horário, as marcas e as dúvidas somem, e o horário dado (não cancelado,
 * com alguém marcado) conta na medalha da monitoria do monitor (interno.alumia_o11_feito), no mesmo lote.
 */
create or replace function interno.alumia_o11t_monitoria_rodar() returns integer language plpgsql security definer set search_path = interno, pg_temp as $$
declare n integer := 0; k integer;
begin
  with feitos as (
    update alumia_monitoria_marcas x set lembrada = true from alumia_monitoria_janelas j
    where j.id = x.janela and not x.lembrada and j.cancelada_em is null and j.inicio > now() and j.inicio <= now() + interval '70 minutes'
    returning x.usuario, j.disciplina, j.inicio
  )
  insert into avisos (para, texto, categoria)
  select usuario, format('Daqui a pouco: monitoria de %s às %s. A sala abre pela Agenda, na aba Monitoria.', interno.alumia_o11t_disciplina_nome(disciplina), to_char(inicio at time zone 'America/Sao_Paulo', 'HH24:MI')), 'rede' from feitos;
  get diagnostics k = row_count; n := n + k;
  with feitos as (
    update alumia_monitoria_janelas j set lembrada = true
    where not j.lembrada and j.cancelada_em is null and j.inicio > now() and j.inicio <= now() + interval '70 minutes'
      and exists (select 1 from alumia_monitoria_marcas x where x.janela = j.id)
    returning j.monitor, j.disciplina, j.inicio
  )
  insert into avisos (para, texto, categoria)
  select monitor, format('Daqui a pouco: a sua monitoria de %s às %s. Quem marcou está na Agenda, na aba Monitoria.', interno.alumia_o11t_disciplina_nome(disciplina), to_char(inicio at time zone 'America/Sao_Paulo', 'HH24:MI')), 'rede' from feitos;
  get diagnostics k = row_count; n := n + k;
  -- A medalha da monitoria: um horário dado (não cancelado, com alguém marcado) conta quando a rodada o apaga, todos do lote juntos.
  if to_regprocedure('interno.alumia_o11_feito(uuid, text)') is not null then
    perform interno.alumia_o11_feito(j.monitor, 'monitoria') from (
      select j.monitor from alumia_monitoria_janelas j
      where j.inicio + make_interval(mins => j.duracao) < now() - interval '1 day' and j.cancelada_em is null
        and exists (select 1 from alumia_monitoria_marcas x where x.janela = j.id)
      order by gen_random_uuid()) j;
  end if;
  delete from alumia_monitoria_janelas where inicio + make_interval(mins => duracao) < now() - interval '1 day';
  return n;
end $$;

-- ── 6. Agendador ──────────────────────────────────────────────────────────────────────────────────────────────────────────
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule('alumia-turmas-semana', '11 3 * * 1', 'select interno.alumia_o11t_fechar_semanas(null)');
    perform cron.schedule('alumia-agenda-lembretes', '17 * * * *', 'select interno.alumia_o11t_agenda_rodar()');
    perform cron.schedule('alumia-monitoria-lembretes', '*/10 * * * *', 'select interno.alumia_o11t_monitoria_rodar()');
  end if;
exception when others then null;
end $$;

-- ── 7. Permissões ─────────────────────────────────────────────────────────────────────────────────────────────────────────
revoke all on function interno.alumia_o11t_numero(integer), interno.alumia_o11t_semana(timestamptz), interno.alumia_o11t_hoje(),
  interno.alumia_o11t_total(integer, integer), interno.alumia_o11t_alvo(uuid, date), interno.alumia_o11t_marcas_no_marco(uuid), interno.alumia_o11t_marca_saiu(),
  interno.alumia_o11t_disciplinas(), interno.alumia_o11t_disciplina_nome(text), interno.alumia_o11t_quando(timestamptz), interno.alumia_o11t_codigo(),
  interno.alumia_o11t_cuidador(), interno.alumia_o11t_pessoa(uuid), interno.alumia_o11t_achar(text), interno.alumia_o11t_fechar_semanas(uuid),
  interno.alumia_o11t_turma_json(uuid, uuid), interno.alumia_o11t_na_turma(uuid, uuid), interno.alumia_o11t_data_json(interno.alumia_agenda_datas, uuid),
  interno.alumia_o11t_agenda_rodar(timestamptz), interno.alumia_o11t_monitor(uuid, text), interno.alumia_o11t_janela_json(interno.alumia_monitoria_janelas),
  interno.alumia_o11t_monitor_sair(uuid), interno.alumia_o11t_monitoria_rodar() from public;
revoke all on function public.alumia_turma_minhas(), public.alumia_turma_criar(text, text), public.alumia_turma_entrar(text), public.alumia_turma_marcar(uuid, boolean),
  public.alumia_turma_editar(uuid, text, text), public.alumia_turma_novo_codigo(uuid), public.alumia_turma_sair(uuid),
  public.alumia_agenda_datas(), public.alumia_agenda_assinar(uuid[], boolean), public.alumia_agenda_salvar(uuid, jsonb), public.alumia_agenda_apagar(uuid),
  public.alumia_monitoria(), public.alumia_monitoria_oferecer(jsonb), public.alumia_monitoria_cancelar(uuid), public.alumia_monitoria_marcar(uuid, text),
  public.alumia_monitoria_desmarcar(uuid), public.alumia_monitoria_nomear(text, text[]), public.alumia_monitoria_responder(boolean),
  public.alumia_monitoria_deixar(), public.alumia_monitoria_tirar(text), public.alumia_monitoria_monitores() from public;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on function interno.alumia_o11t_numero(integer), interno.alumia_o11t_semana(timestamptz), interno.alumia_o11t_hoje(),
      interno.alumia_o11t_total(integer, integer), interno.alumia_o11t_alvo(uuid, date), interno.alumia_o11t_marcas_no_marco(uuid), interno.alumia_o11t_marca_saiu(),
      interno.alumia_o11t_disciplinas(), interno.alumia_o11t_disciplina_nome(text), interno.alumia_o11t_quando(timestamptz), interno.alumia_o11t_codigo(),
      interno.alumia_o11t_cuidador(), interno.alumia_o11t_pessoa(uuid), interno.alumia_o11t_achar(text), interno.alumia_o11t_fechar_semanas(uuid),
      interno.alumia_o11t_turma_json(uuid, uuid), interno.alumia_o11t_na_turma(uuid, uuid), interno.alumia_o11t_data_json(interno.alumia_agenda_datas, uuid),
      interno.alumia_o11t_agenda_rodar(timestamptz), interno.alumia_o11t_monitor(uuid, text), interno.alumia_o11t_janela_json(interno.alumia_monitoria_janelas),
      interno.alumia_o11t_monitor_sair(uuid), interno.alumia_o11t_monitoria_rodar() from anon, authenticated;
    revoke all on function public.alumia_turma_minhas(), public.alumia_turma_criar(text, text), public.alumia_turma_entrar(text), public.alumia_turma_marcar(uuid, boolean),
      public.alumia_turma_editar(uuid, text, text), public.alumia_turma_novo_codigo(uuid), public.alumia_turma_sair(uuid),
      public.alumia_agenda_datas(), public.alumia_agenda_assinar(uuid[], boolean), public.alumia_agenda_salvar(uuid, jsonb), public.alumia_agenda_apagar(uuid),
      public.alumia_monitoria(), public.alumia_monitoria_oferecer(jsonb), public.alumia_monitoria_cancelar(uuid), public.alumia_monitoria_marcar(uuid, text),
      public.alumia_monitoria_desmarcar(uuid), public.alumia_monitoria_nomear(text, text[]), public.alumia_monitoria_responder(boolean),
      public.alumia_monitoria_deixar(), public.alumia_monitoria_tirar(text), public.alumia_monitoria_monitores() from anon, authenticated;
    -- Tudo pede conta: a turma, a agenda e a monitoria são de quem está dentro.
    grant execute on function public.alumia_turma_minhas(), public.alumia_turma_criar(text, text), public.alumia_turma_entrar(text), public.alumia_turma_marcar(uuid, boolean),
      public.alumia_turma_editar(uuid, text, text), public.alumia_turma_novo_codigo(uuid), public.alumia_turma_sair(uuid),
      public.alumia_agenda_datas(), public.alumia_agenda_assinar(uuid[], boolean), public.alumia_agenda_salvar(uuid, jsonb), public.alumia_agenda_apagar(uuid),
      public.alumia_monitoria(), public.alumia_monitoria_oferecer(jsonb), public.alumia_monitoria_cancelar(uuid), public.alumia_monitoria_marcar(uuid, text),
      public.alumia_monitoria_desmarcar(uuid), public.alumia_monitoria_nomear(text, text[]), public.alumia_monitoria_responder(boolean),
      public.alumia_monitoria_deixar(), public.alumia_monitoria_tirar(text), public.alumia_monitoria_monitores() to authenticated, service_role;
  end if;
end $$;

-- ── 8. A porta em todas as funções novas ──────────────────────────────────────────────────────────────────────────────────
do $$
declare v jsonb := interno.alumia_trancar();
begin
  if jsonb_array_length(v -> 'abertas') > 0 then
    raise warning 'alumia_trancar: função sem porta: %', v -> 'abertas';
  end if;
end $$;
