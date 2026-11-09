-- Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
--
-- ═══════════════════════════ Alumia · Onda 5 · F4 · organizações e perfis (09/11/2026) ═══════════════════════════
-- docs/plano-2026-11/PLANO-ALUMIA.md §4.3, §5 (F4), §6, §7 e §8 (F4). O back-end MÍNIMO para cada função das telas da F4
-- funcionar: conta de organização (criada sem senha por lib/rede/contas-extra.ts), pedido do selo e a fila no painel, gestores
-- (o vínculo não aparece para ninguém), "Como votamos", consultas à base com voto secreto (só quem é de um núcleo da organização
-- vota; quórum; simples ou ranqueada por segundo turno instantâneo), plenárias com fila por ordem de chegada que não reordena,
-- núcleos da organização, o sininho e os extras do perfil de pessoa (status, pronomes, campos).
--
-- Idempotente: pode rodar duas vezes (scripts/testar-alumia-f4.mjs roda duas vezes no banco local). Depende da F0
-- (20261109-alumia-f0-contrato.sql: rede_identidades e rede_age_como). NÃO está no install.sql (o integrador cola depois da F0) e
-- NÃO rodar em produção sem o Jonathan.
--
-- Regras (§5): tudo em `interno` com RLS ligada e nenhuma permissão para anon/authenticated nas tabelas; acesso só por função
-- security definer com search_path = interno, pg_temp; cada função confere quem chama (membro da Rede, bloqueio, gestor,
-- coordenação) e o limite de uso (interno.limite).
--
-- Leis (conferidas no texto, leis-do-brasil):
--  - LGPD (Lei 13.709/2018) art. 5º, II e art. 11: filiação a organização política e opinião política são dado pessoal SENSÍVEL.
--    Por isso: nenhuma função devolve lista de quem segue, liga o sininho, votou, é de um núcleo ou está numa plenária; contagens
--    de pessoas só a partir de 3 (nulo abaixo); o voto da consulta é secreto POR CONSTRUÇÃO (quem votou e o que votou ficam em
--    tabelas separadas, sem chave comum nem hora); o vínculo organização↔gestor nunca sai do banco (só "eu gerencio", para mim).
--  - LGPD art. 6º, III (necessidade): o pedido do selo guarda só documento PÚBLICO da organização (CNPJ, registro do partido,
--    diploma, ata), nunca CPF/RG de pessoa, e não guarda quem pediu; datas de vínculo guardam só o dia.
--  - LGPD art. 46 (segurança): RLS ligada, nenhuma permissão direta; limites de uso em toda escrita.
--  - ECA (Lei 8.069/1990) e ECA Digital (Lei 15.211/2025) art. 9º § 1º: a Alumia é só para maiores; toda ação exige ser membro da
--    Rede (rede_18 + consentimento), e o pedido do selo exige a declaração de 18 anos de quem cuida da conta.

-- ── 1. Tabelas ────────────────────────────────────────────────────────────────────────────────────────────────────────────

-- A organização é um perfil (conta extra sem senha, em auth.users) com estes dados a mais.
create table if not exists interno.rede_orgs (
  perfil uuid primary key references interno.perfis (id) on delete cascade,
  tipo text not null check (tipo in ('partido', 'mandato', 'sindicato', 'movimento', 'coletivo', 'gremio', 'dce', 'outro')),
  cidade text not null default '' check (char_length(cidade) <= 60),
  palavra text not null default 'ORG' check (palavra ~ '^[A-Z ]{2,14}$'),
  -- O documento PÚBLICO conferido (tipo e número/link). Só aparece no perfil depois do selo.
  documento_tipo text not null default '' check (char_length(documento_tipo) <= 60),
  documento_publico text not null default '' check (char_length(documento_publico) <= 200),
  verificada_em timestamptz,
  verificada_por uuid references interno.perfis (id) on delete set null,
  criada_em date not null default current_date
);
alter table interno.rede_orgs enable row level security;

-- Quem age como a organização. NUNCA volta em função nenhuma a outra pessoa (só o "gerencio" de quem pergunta sobre si).
create table if not exists interno.rede_org_gestores (
  org uuid not null references interno.rede_orgs (perfil) on delete cascade,
  gestor uuid not null references interno.perfis (id) on delete cascade,
  papel text not null default 'gestor' check (papel in ('dono', 'gestor')),
  desde date not null default current_date,
  primary key (org, gestor),
  check (org <> gestor)
);
create index if not exists rede_org_gestores_gestor on interno.rede_org_gestores (gestor);
alter table interno.rede_org_gestores enable row level security;

-- A fila do selo. Não guarda quem pediu (a organização é quem pede).
create table if not exists interno.rede_org_pedidos (
  id uuid primary key default gen_random_uuid(),
  org uuid not null references interno.rede_orgs (perfil) on delete cascade,
  documento_tipo text not null check (char_length(btrim(documento_tipo)) between 2 and 60),
  documento text not null check (char_length(btrim(documento)) between 2 and 200),
  sobre text not null check (char_length(btrim(sobre)) between 2 and 280),
  situacao text not null default 'esperando' check (situacao in ('esperando', 'aceito', 'recusado')),
  motivo text not null default '' check (char_length(motivo) <= 500),
  criado_em timestamptz not null default now(),
  decidido_em timestamptz,
  decidido_por uuid references interno.perfis (id) on delete set null
);
create unique index if not exists rede_org_pedidos_um_esperando on interno.rede_org_pedidos (org) where situacao = 'esperando';
alter table interno.rede_org_pedidos enable row level security;

-- "Como votamos": a prestação de contas, sempre com a fonte pública.
create table if not exists interno.rede_org_votacoes (
  id uuid primary key default gen_random_uuid(),
  org uuid not null references interno.rede_orgs (perfil) on delete cascade,
  data date not null,
  projeto text not null check (char_length(btrim(projeto)) between 2 and 200),
  voto text not null check (voto in ('sim', 'nao', 'abstencao', 'obstrucao', 'ausente')),
  porque text not null default '' check (char_length(porque) <= 500),
  resultado text not null default '' check (char_length(resultado) <= 120),
  fonte text not null check (fonte ~ '^https?://[^\s]{3,}$' and char_length(fonte) <= 500),
  criado_em timestamptz not null default now()
);
create index if not exists rede_org_votacoes_org on interno.rede_org_votacoes (org, data desc);
alter table interno.rede_org_votacoes enable row level security;

-- Núcleos da organização: os núcleos de sempre, com o dono-organização, quando se encontram e a cor.
alter table interno.rede_nucleos add column if not exists org uuid;
alter table interno.rede_nucleos add column if not exists org_quando text not null default '';
alter table interno.rede_nucleos add column if not exists org_cor smallint not null default 1;
do $$
begin
  if not exists (select 1 from pg_constraint where conrelid = 'interno.rede_nucleos'::regclass and conname = 'rede_nucleos_org_fk') then
    alter table interno.rede_nucleos add constraint rede_nucleos_org_fk foreign key (org) references interno.rede_orgs (perfil) on delete cascade;
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'interno.rede_nucleos'::regclass and conname = 'rede_nucleos_org_quando') then
    alter table interno.rede_nucleos add constraint rede_nucleos_org_quando check (char_length(org_quando) <= 60);
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'interno.rede_nucleos'::regclass and conname = 'rede_nucleos_org_cor') then
    alter table interno.rede_nucleos add constraint rede_nucleos_org_cor check (org_cor between 1 and 5);
  end if;
end $$;
create index if not exists rede_nucleos_org on interno.rede_nucleos (org) where org is not null;

-- Pedidos para entrar num núcleo da organização (só a mediação do núcleo e os gestores veem).
create table if not exists interno.rede_org_nucleo_pedidos (
  nucleo uuid not null references interno.rede_nucleos (id) on delete cascade,
  usuario uuid not null references interno.perfis (id) on delete cascade,
  criado_em date not null default current_date,
  primary key (nucleo, usuario)
);
alter table interno.rede_org_nucleo_pedidos enable row level security;

-- Consultas à base.
create table if not exists interno.rede_consultas (
  id uuid primary key default gen_random_uuid(),
  org uuid not null references interno.rede_orgs (perfil) on delete cascade,
  -- Os núcleos que votam (vazio = todos os núcleos da organização).
  nucleos uuid[] not null default '{}',
  pergunta text not null check (char_length(btrim(pergunta)) between 5 and 280),
  metodo text not null check (metodo in ('simples', 'ranqueada')),
  quorum integer check (quorum is null or quorum between 3 and 1000000),
  prazo timestamptz not null,
  compromisso text not null check (char_length(btrim(compromisso)) between 10 and 500),
  criado_em timestamptz not null default now()
);
create index if not exists rede_consultas_org on interno.rede_consultas (org, prazo desc);
alter table interno.rede_consultas enable row level security;

create table if not exists interno.rede_consulta_opcoes (
  id uuid primary key default gen_random_uuid(),
  consulta uuid not null references interno.rede_consultas (id) on delete cascade,
  ordem smallint not null,
  texto text not null check (char_length(btrim(texto)) between 1 and 120),
  unique (consulta, ordem)
);
alter table interno.rede_consulta_opcoes enable row level security;

-- Voto secreto por construção: QUEM votou (para não votar duas vezes) e O QUE foi votado (a cédula) ficam em tabelas separadas,
-- sem chave comum e sem hora. A cédula tem um id aleatório; nada nela aponta para a pessoa.
create table if not exists interno.rede_consulta_votantes (
  consulta uuid not null references interno.rede_consultas (id) on delete cascade,
  usuario uuid not null references interno.perfis (id) on delete cascade,
  primary key (consulta, usuario)
);
alter table interno.rede_consulta_votantes enable row level security;
create table if not exists interno.rede_consulta_cedulas (
  id uuid primary key default gen_random_uuid(),
  consulta uuid not null references interno.rede_consultas (id) on delete cascade,
  ranking uuid[] not null check (cardinality(ranking) between 1 and 8)
);
create index if not exists rede_consulta_cedulas_consulta on interno.rede_consulta_cedulas (consulta);
alter table interno.rede_consulta_cedulas enable row level security;

-- Plenárias e a fila de perguntas (ordem de chegada: `seq`, que ninguém muda).
create table if not exists interno.rede_plenarias (
  id uuid primary key default gen_random_uuid(),
  org uuid not null references interno.rede_orgs (perfil) on delete cascade,
  titulo text not null check (char_length(btrim(titulo)) between 3 and 120),
  descricao text not null default '' check (char_length(descricao) <= 500),
  inicio timestamptz not null,
  sala text check (sala is null or (sala ~ '^https://[^\s]{3,}$' and char_length(sala) <= 300)),
  situacao text not null default 'marcada' check (situacao in ('marcada', 'ao_vivo', 'encerrada')),
  criado_em timestamptz not null default now()
);
create index if not exists rede_plenarias_org on interno.rede_plenarias (org, inicio desc);
create index if not exists rede_plenarias_ao_vivo on interno.rede_plenarias (situacao) where situacao = 'ao_vivo';
alter table interno.rede_plenarias enable row level security;

create table if not exists interno.rede_plenaria_perguntas (
  id uuid primary key default gen_random_uuid(),
  plenaria uuid not null references interno.rede_plenarias (id) on delete cascade,
  seq bigint generated always as identity,
  autor uuid references interno.perfis (id) on delete set null,
  mostrar boolean not null default false,
  texto text not null check (char_length(btrim(texto)) between 2 and 280),
  criado_em timestamptz not null default now(),
  respondida_em timestamptz,
  retirada_em timestamptz,
  retirada_motivo text check (retirada_motivo is null or retirada_motivo in ('ofensa', 'dado_pessoal', 'fora_do_tema', 'repetida'))
);
create index if not exists rede_plenaria_perguntas_fila on interno.rede_plenaria_perguntas (plenaria, seq);
alter table interno.rede_plenaria_perguntas enable row level security;

/** A fila não reordena: a ordem (seq, criado_em), a plenária, o texto e quem perguntou não mudam depois de entrar. */
create or replace function interno.alumia_fila_fixa() returns trigger language plpgsql as $$
begin
  if new.seq is distinct from old.seq or new.criado_em is distinct from old.criado_em or new.plenaria is distinct from old.plenaria
     or new.texto is distinct from old.texto or (new.autor is distinct from old.autor and new.autor is not null) then
    raise exception 'fila_fixa' using errcode = 'P0001';
  end if;
  return new;
end $$;
drop trigger if exists alumia_fila_fixa on interno.rede_plenaria_perguntas;
create trigger alumia_fila_fixa before update on interno.rede_plenaria_perguntas for each row execute function interno.alumia_fila_fixa();

-- O sininho ("avisar quando a organização postar").
create table if not exists interno.rede_org_sinos (
  org uuid not null references interno.rede_orgs (perfil) on delete cascade,
  usuario uuid not null references interno.perfis (id) on delete cascade,
  primary key (org, usuario)
);
create index if not exists rede_org_sinos_usuario on interno.rede_org_sinos (usuario);
alter table interno.rede_org_sinos enable row level security;

-- Extras do perfil de pessoa: status curto (com prazo), pronomes e até 4 campos.
alter table interno.perfis add column if not exists rede_status_tipo text;
alter table interno.perfis add column if not exists rede_status_texto text;
alter table interno.perfis add column if not exists rede_status_ate timestamptz;
alter table interno.perfis add column if not exists rede_pronomes text;
do $$
begin
  if not exists (select 1 from pg_constraint where conrelid = 'interno.perfis'::regclass and conname = 'perfis_rede_status_tipo') then
    alter table interno.perfis add constraint perfis_rede_status_tipo check (rede_status_tipo is null or rede_status_tipo in ('greve', 'ato', 'estudando', 'cuidando', 'ferias'));
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'interno.perfis'::regclass and conname = 'perfis_rede_status_texto') then
    alter table interno.perfis add constraint perfis_rede_status_texto check (rede_status_texto is null or char_length(rede_status_texto) <= 60);
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'interno.perfis'::regclass and conname = 'perfis_rede_pronomes') then
    alter table interno.perfis add constraint perfis_rede_pronomes check (rede_pronomes is null or char_length(rede_pronomes) <= 30);
  end if;
end $$;
create table if not exists interno.rede_perfil_campos (
  usuario uuid not null references interno.perfis (id) on delete cascade,
  ordem smallint not null check (ordem between 1 and 4),
  rotulo text not null check (char_length(btrim(rotulo)) between 1 and 30),
  valor text not null check (char_length(btrim(valor)) between 1 and 80),
  primary key (usuario, ordem)
);
alter table interno.rede_perfil_campos enable row level security;

-- Nenhuma permissão direta nas tabelas novas.
do $$
declare t text;
begin
  foreach t in array array['rede_orgs', 'rede_org_gestores', 'rede_org_pedidos', 'rede_org_votacoes', 'rede_org_nucleo_pedidos', 'rede_consultas',
    'rede_consulta_opcoes', 'rede_consulta_votantes', 'rede_consulta_cedulas', 'rede_plenarias', 'rede_plenaria_perguntas', 'rede_org_sinos', 'rede_perfil_campos'] loop
    execute format('revoke all on table interno.%I from public', t);
    if exists (select 1 from pg_roles where rolname = 'anon') then
      execute format('revoke all on table interno.%I from anon, authenticated', t);
    end if;
  end loop;
end $$;

-- ── 2. Ajudas internas ────────────────────────────────────────────────────────────────────────────────────────────────────

/** A organização pelo @ (nula se o @ não é de organização, ou se a conta está suspensa). */
create or replace function interno.alumia_org_de(p_handle text) returns uuid language sql stable security definer set search_path = interno, pg_temp as $$
  select o.perfil from rede_orgs o join perfis f on f.id = o.perfil
  where f.rede_handle = lower(btrim(coalesce(p_handle, ''), ' @')) and not f.suspenso
$$;

/** `p_quem` gerencia `p_org`? (dono ou gestor) */
create or replace function interno.alumia_org_gere(p_quem uuid, p_org uuid) returns boolean language sql stable security definer set search_path = interno, pg_temp as $$
  select p_quem is not null and p_org is not null and exists (select 1 from rede_org_gestores g where g.org = p_org and g.gestor = p_quem)
$$;

/** Contagem de PESSOAS para mostrar: nula abaixo de 3 (PLANO-ALUMIA §6.1). */
create or replace function interno.alumia_pessoas(p_n bigint) returns integer language sql immutable as $$
  select case when p_n >= 3 then p_n::integer end
$$;

/** A organização pelo @, para quem gerencia: confere membro, gestor e limite. Devolve o id. */
create or replace function interno.alumia_org_gestor(p_handle text, p_acao text, p_max integer, p_min integer) returns uuid language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); v_org uuid;
begin
  perform interno.rede3_perfil_exige_membro(v);
  v_org := interno.alumia_org_de(p_handle);
  if v_org is null or not interno.alumia_org_gere(v, v_org) then perform interno.erro('sem_permissao'); end if;
  perform interno.limite(p_acao, p_max, p_min);
  return v_org;
end $$;

/** A palavra da capa (A–Z, 2 a 14) a partir do codinome. */
create or replace function interno.alumia_palavra(p_codinome text) returns text language sql immutable as $$
  select case when char_length(w) >= 2 then w else 'ORG' end
  from (select btrim(left(regexp_replace(upper(translate(coalesce(p_codinome, ''), 'áàâãäéèêëíìîïóòôõöúùûüçñÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇÑ', 'aaaaaeeeeiiiiooooouuuucnAAAAAEEEEIIIIOOOOOUUUUCN')), '[^A-Z ]', '', 'g'), 14)) as w) x
$$;

/**
 * A F0 diz que a pessoa age como ela mesma ou como as identidades/organizações dela (rede_identidades). A F4 acrescenta: quem é
 * gestor da organização também age como ela. Mesma assinatura (create or replace).
 */
create or replace function interno.rede_age_como(p_quem uuid, p_como uuid) returns boolean
language sql stable security definer set search_path = interno, pg_temp as $$
  select p_quem is not null and p_como is not null
    and (p_quem = p_como
      or exists (select 1 from rede_identidades i where i.dono = p_quem and i.identidade = p_como)
      or exists (select 1 from rede_org_gestores g where g.gestor = p_quem and g.org = p_como))
$$;

/**
 * Apura uma consulta (as mesmas regras de lib/rede/org/apuracao.ts, que é a referência e o teste). Simples: conta a primeira
 * opção. Ranqueada: segundo turno instantâneo; empate na eliminação olha as rodadas anteriores e, se persistir, sai a última na
 * ordem das opções. Só entram cédulas (nunca pessoas). Devolve {cedulas, vencedora, proporcoes: {opcao: 0..1}} da última rodada.
 */
create or replace function interno.alumia_apurar(p_consulta uuid) returns jsonb language plpgsql stable security definer set search_path = interno, pg_temp as $$
declare
  v_metodo text; v_opcoes uuid[]; v_vivas uuid[]; v_n integer; v_votos jsonb; v_rodadas jsonb := '[]'::jsonb; v_total integer;
  v_lider uuid; v_min integer; v_empatadas uuid[]; v_menor integer; r integer; o uuid; v_venc uuid; v_ultima jsonb;
begin
  select metodo into v_metodo from rede_consultas where id = p_consulta;
  select array_agg(id order by ordem) into v_opcoes from rede_consulta_opcoes where consulta = p_consulta;
  select count(*) into v_n from rede_consulta_cedulas where consulta = p_consulta;
  v_vivas := coalesce(v_opcoes, '{}');
  loop
    -- Votos de cada opção viva: cada cédula conta para a sua opção viva mais bem colocada.
    select coalesce(jsonb_object_agg(x.o::text, x.n), '{}'::jsonb), coalesce(sum(x.n), 0)::integer into v_votos, v_total from (
      select vv.o, count(e.escolha)::integer as n
      from unnest(v_vivas) vv(o)
      left join (
        select (select u.x from unnest(case when v_metodo = 'simples' then c.ranking[1:1] else c.ranking end) with ordinality u(x, i)
                where u.x = any (v_vivas) order by u.i limit 1) as escolha
        from rede_consulta_cedulas c where c.consulta = p_consulta) e on e.escolha = vv.o
      group by vv.o) x;
    if v_metodo = 'simples' then
      select max((v_votos ->> k::text)::integer) into v_min from unnest(v_vivas) k;
      select array_agg(k order by array_position(v_opcoes, k)) into v_empatadas from unnest(v_vivas) k where (v_votos ->> k::text)::integer = v_min;
      v_venc := case when coalesce(v_min, 0) > 0 and cardinality(v_empatadas) = 1 then v_empatadas[1] end;
      v_rodadas := v_rodadas || jsonb_build_array(v_votos);
      exit;
    end if;
    if v_total = 0 then v_rodadas := v_rodadas || jsonb_build_array(v_votos); v_venc := null; exit; end if;
    v_lider := null;
    foreach o in array v_opcoes loop
      if o = any (v_vivas) and (v_votos ->> o::text)::integer * 2 > v_total then v_lider := o; exit; end if;
    end loop;
    if v_lider is not null or cardinality(v_vivas) = 1 then
      v_rodadas := v_rodadas || jsonb_build_array(v_votos);
      v_venc := coalesce(v_lider, v_vivas[1]);
      exit;
    end if;
    select min((v_votos ->> k::text)::integer) into v_min from unnest(v_vivas) k;
    select array_agg(k order by array_position(v_opcoes, k)) into v_empatadas from unnest(v_vivas) k where (v_votos ->> k::text)::integer = v_min;
    r := jsonb_array_length(v_rodadas) - 1;
    while r >= 0 and cardinality(v_empatadas) > 1 loop
      select min(coalesce((v_rodadas -> r ->> k::text)::integer, 0)) into v_menor from unnest(v_empatadas) k;
      select array_agg(k order by array_position(v_opcoes, k)) into v_empatadas from unnest(v_empatadas) k where coalesce((v_rodadas -> r ->> k::text)::integer, 0) = v_menor;
      r := r - 1;
    end loop;
    v_rodadas := v_rodadas || jsonb_build_array(v_votos);
    v_vivas := array_remove(v_vivas, v_empatadas[cardinality(v_empatadas)]);
    if cardinality(v_vivas) = 0 then v_venc := null; exit; end if;
  end loop;
  v_ultima := v_rodadas -> (jsonb_array_length(v_rodadas) - 1);
  select coalesce(sum(value::integer), 0) into v_total from jsonb_each_text(v_ultima);
  return jsonb_build_object('cedulas', v_n, 'vencedora', v_venc, 'rodadas', jsonb_array_length(v_rodadas),
    'proporcoes', (select coalesce(jsonb_object_agg(k::text, case when v_total > 0 then coalesce((v_ultima ->> k::text)::numeric, 0) / v_total else 0 end), '{}'::jsonb)
                   from unnest(coalesce(v_opcoes, '{}')) k));
end $$;

/** A consulta como o perfil mostra (para quem olha: p_quem nulo = visitante). */
create or replace function interno.alumia_consulta_json(c interno.rede_consultas, p_quem uuid) returns jsonb language plpgsql stable security definer set search_path = interno, pg_temp as $$
declare
  v_fechada boolean := c.prazo <= now(); v_votantes integer; v_ap jsonb; v_mostra boolean; v_nucleos uuid[];
  v_posso boolean; v_votei boolean;
begin
  v_nucleos := case when cardinality(c.nucleos) > 0 then c.nucleos else coalesce((select array_agg(id) from rede_nucleos where org = c.org), '{}') end;
  select count(*) into v_votantes from rede_consulta_votantes where consulta = c.id;
  v_votei := p_quem is not null and exists (select 1 from rede_consulta_votantes where consulta = c.id and usuario = p_quem);
  v_posso := p_quem is not null and not v_fechada and not v_votei and interno.rede2_membro(p_quem) and not interno.rede_bloqueado(p_quem, c.org)
    and exists (select 1 from rede_nucleo_membros m where m.usuario = p_quem and m.nucleo = any (v_nucleos));
  -- O resultado só sai com a consulta fechada e com 3 votos ou mais (com 1 ou 2 daria para saber o voto de alguém).
  v_mostra := v_fechada and v_votantes >= 3;
  if v_mostra then v_ap := interno.alumia_apurar(c.id); end if;
  return jsonb_build_object(
    'id', c.id, 'pergunta', c.pergunta, 'metodo', c.metodo, 'prazo', c.prazo, 'compromisso', c.compromisso, 'quorum', c.quorum,
    'situacao', case when v_fechada then 'fechada' else 'aberta' end,
    'votantes', case when v_fechada then interno.alumia_pessoas(v_votantes) end,
    'quorumAtingido', case when v_fechada then (c.quorum is null or v_votantes >= c.quorum) end,
    'possoVotar', v_posso, 'votei', v_votei,
    'nucleos', coalesce((select jsonb_agg(n.nome order by n.nome) from rede_nucleos n where n.id = any (v_nucleos)), '[]'::jsonb),
    'opcoes', coalesce((select jsonb_agg(jsonb_build_object('id', o.id, 'texto', o.texto,
                'proporcao', case when v_mostra then round((v_ap -> 'proporcoes' ->> o.id::text)::numeric, 4) end) order by o.ordem)
              from rede_consulta_opcoes o where o.consulta = c.id), '[]'::jsonb));
end $$;

/** A plenária como o perfil mostra. Visitante não vê a fila (só quantas perguntas esperam). */
create or replace function interno.alumia_plenaria_json(p interno.rede_plenarias, p_quem uuid, p_com_fila boolean) returns jsonb language sql stable security definer set search_path = interno, pg_temp as $$
  select jsonb_build_object(
    'id', p.id, 'org', jsonb_build_object('handle', f.rede_handle, 'codinome', f.rede_codinome),
    'titulo', p.titulo, 'descricao', p.descricao, 'inicio', p.inicio, 'aoVivo', p.situacao = 'ao_vivo',
    'sala', case when p.situacao = 'ao_vivo' then p.sala end,
    -- Não guardamos quem entra na sala (nenhum registro de presença): o número de pessoas na sala não existe.
    'naSala', null,
    'naFila', (select count(*) from rede_plenaria_perguntas q where q.plenaria = p.id and q.respondida_em is null and q.retirada_em is null),
    'pergunteiEu', p_quem is not null and exists (select 1 from rede_plenaria_perguntas q where q.plenaria = p.id and q.autor = p_quem),
    'fila', case when p_com_fila then coalesce((
      select jsonb_agg(jsonb_build_object('id', q.id, 'handle', case when q.mostrar then a.rede_handle end, 'texto', q.texto,
                                          'criadaEm', q.criado_em, 'respondida', q.respondida_em is not null) order by q.seq)
      from (select * from rede_plenaria_perguntas where plenaria = p.id and retirada_em is null order by seq limit 30) q
      left join perfis a on a.id = q.autor and not a.suspenso and not a.rede_invisivel and a.rede_modo <> 'invisivel'), '[]'::jsonb)
      else '[]'::jsonb end)
  from perfis f where f.id = p.org
$$;

revoke all on function interno.alumia_org_de(text), interno.alumia_org_gere(uuid, uuid), interno.alumia_pessoas(bigint),
  interno.alumia_org_gestor(text, text, integer, integer), interno.alumia_palavra(text), interno.alumia_apurar(uuid),
  interno.alumia_consulta_json(interno.rede_consultas, uuid), interno.alumia_plenaria_json(interno.rede_plenarias, uuid, boolean),
  interno.alumia_fila_fixa(), interno.rede_age_como(uuid, uuid) from public;

-- ── 3. O perfil da organização e o "Ao vivo agora" ────────────────────────────────────────────────────────────────────────

/**
 * O perfil público de uma organização pelo @ (OrgPublica, lib/rede/tipos-org.ts); nulo se o @ não é de organização, se há
 * bloqueio entre quem olha e a organização, ou (para visitante) se a organização ainda não tem o selo. Sem contagem de
 * seguidores, sem lista de gestores, de membros de núcleo, de quem votou ou de quem liga o sininho.
 */
create or replace function public.rede_org_perfil(p_handle text) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := auth.uid(); v_org uuid; o rede_orgs; f perfis; v_membro boolean;
begin
  perform interno.limite('alumia_org_ler', 300, 10);
  v_org := interno.alumia_org_de(p_handle);
  if v_org is null then return null; end if;
  select * into o from rede_orgs where perfil = v_org;
  select * into f from perfis where id = v_org;
  if interno.rede_bloqueado(v, v_org) then return null; end if;
  v_membro := interno.rede2_membro(v);
  if not v_membro and o.verificada_em is null then return null; end if;
  return jsonb_build_object(
    'handle', f.rede_handle, 'codinome', coalesce(f.rede_codinome, ''), 'tipo', o.tipo, 'bio', coalesce(f.rede_bio, ''),
    'cidade', nullif(o.cidade, ''), 'verificadaEm', o.verificada_em,
    'documento', case when o.verificada_em is not null then nullif(o.documento_tipo, '') end,
    'palavra', o.palavra,
    'sigo', v is not null and exists (select 1 from rede_seguindo s where s.quem = v and s.segue = v_org and not s.pendente),
    'sino', v is not null and exists (select 1 from rede_org_sinos s where s.org = v_org and s.usuario = v),
    'gerencio', interno.alumia_org_gere(v, v_org),
    'nucleos', coalesce((select jsonb_agg(jsonb_build_object('id', n.id, 'nome', n.nome, 'cor', n.org_cor, 'quando', n.org_quando,
                  'onde', nullif(n.cidade, ''),
                  'sou', v is not null and exists (select 1 from rede_nucleo_membros m where m.nucleo = n.id and m.usuario = v),
                  'pedi', v is not null and exists (select 1 from rede_org_nucleo_pedidos q where q.nucleo = n.id and q.usuario = v)) order by n.nome)
                from rede_nucleos n where n.org = v_org), '[]'::jsonb),
    'votacoes', coalesce((select jsonb_agg(jsonb_build_object('id', x.id, 'data', x.data, 'projeto', x.projeto, 'voto', x.voto, 'porque', x.porque,
                  'resultado', x.resultado, 'fonte', x.fonte) order by x.data desc, x.criado_em desc)
                from (select * from rede_org_votacoes where org = v_org order by data desc, criado_em desc limit 30) x), '[]'::jsonb),
    'consultas', coalesce((select jsonb_agg(interno.alumia_consulta_json(c, v) order by c.prazo desc)
                from (select * from rede_consultas where org = v_org order by prazo desc limit 10) c), '[]'::jsonb),
    'plenarias', coalesce((select jsonb_agg(interno.alumia_plenaria_json(p, v, v_membro) order by (p.situacao = 'ao_vivo') desc, p.inicio)
                from (select * from rede_plenarias where org = v_org and situacao <> 'encerrada' order by inicio limit 5) p), '[]'::jsonb));
end $$;

/** "Ao vivo agora": plenárias acontecendo das organizações que sigo ou com selo. Visitante: só das com selo. Até 10. */
create or replace function public.rede_org_ao_vivo() returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := auth.uid();
begin
  perform interno.limite('alumia_org_ler', 300, 10);
  return coalesce((
    select jsonb_agg(interno.alumia_plenaria_json(p, v, false) - 'fila' - 'pergunteiEu' order by p.inicio desc)
    from (
      select p.* from rede_plenarias p join rede_orgs o on o.perfil = p.org join perfis f on f.id = p.org
      where p.situacao = 'ao_vivo' and not f.suspenso and not interno.rede_bloqueado(v, p.org)
        and (o.verificada_em is not null or (v is not null and exists (select 1 from rede_seguindo s where s.quem = v and s.segue = p.org and not s.pendente)))
      order by p.inicio desc limit 10) p), '[]'::jsonb);
end $$;

-- ── 4. Ações de quem é membro da Rede ─────────────────────────────────────────────────────────────────────────────────────

/** O sininho. Ninguém vê quem ligou (nem a organização). */
create or replace function public.rede_org_sino(p_handle text, p_sim boolean) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); v_org uuid;
begin
  perform interno.rede3_perfil_exige_membro(v);
  v_org := interno.alumia_org_de(p_handle);
  if v_org is null or interno.rede_bloqueado(v, v_org) then perform interno.erro('nao_encontrado'); end if;
  perform interno.limite('alumia_org_sino', 60, 60);
  if coalesce(p_sim, false) then insert into rede_org_sinos (org, usuario) values (v_org, v) on conflict do nothing;
  else delete from rede_org_sinos where org = v_org and usuario = v; end if;
  return jsonb_build_object('sino', exists (select 1 from rede_org_sinos where org = v_org and usuario = v));
end $$;

/** Pedir para entrar num núcleo da organização. Quem já é do núcleo fica como está. */
create or replace function public.rede_org_nucleo_entrar(p_nucleo uuid) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); n rede_nucleos;
begin
  perform interno.rede3_perfil_exige_membro(v);
  select * into n from rede_nucleos where id = p_nucleo and org is not null;
  if not found or interno.rede_bloqueado(v, n.org) or exists (select 1 from perfis where id = n.org and suspenso) then perform interno.erro('nao_encontrado'); end if;
  perform interno.limite('alumia_org_nucleo_entrar', 20, 1440);
  if not exists (select 1 from rede_nucleo_membros m where m.nucleo = n.id and m.usuario = v) then
    insert into rede_org_nucleo_pedidos (nucleo, usuario) values (n.id, v) on conflict do nothing;
  end if;
  return jsonb_build_object('sou', exists (select 1 from rede_nucleo_membros m where m.nucleo = n.id and m.usuario = v),
                            'pedi', exists (select 1 from rede_org_nucleo_pedidos q where q.nucleo = n.id and q.usuario = v));
end $$;

/**
 * Votar numa consulta aberta. Só quem é de um dos núcleos que votam. `p_ranking`: a ordem de preferência (na simples, uma opção).
 * O voto é secreto: grava "votou" numa tabela e a cédula noutra, sem ligação; nada volta além de "votei". Não dá para mudar.
 */
create or replace function public.rede_org_consulta_votar(p_consulta uuid, p_ranking uuid[]) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); c rede_consultas; v_nucleos uuid[]; v_opcoes uuid[];
begin
  perform interno.rede3_perfil_exige_membro(v);
  select * into c from rede_consultas where id = p_consulta;
  if not found or interno.rede_bloqueado(v, c.org) then perform interno.erro('nao_encontrado'); end if;
  if c.prazo <= now() then perform interno.erro('consulta_fechada'); end if;
  v_nucleos := case when cardinality(c.nucleos) > 0 then c.nucleos else coalesce((select array_agg(id) from rede_nucleos where org = c.org), '{}') end;
  if not exists (select 1 from rede_nucleo_membros m where m.usuario = v and m.nucleo = any (v_nucleos)) then perform interno.erro('sem_permissao'); end if;
  perform interno.limite('alumia_org_votar', 30, 60);
  select array_agg(id) into v_opcoes from rede_consulta_opcoes where consulta = c.id;
  if p_ranking is null or cardinality(p_ranking) = 0 or cardinality(p_ranking) > cardinality(v_opcoes)
     or (c.metodo = 'simples' and cardinality(p_ranking) <> 1)
     or exists (select 1 from unnest(p_ranking) x where x is null or not x = any (v_opcoes))
     or (select count(distinct x) from unnest(p_ranking) x) <> cardinality(p_ranking) then
    perform interno.erro('invalido:ranking');
  end if;
  insert into rede_consulta_votantes (consulta, usuario) values (c.id, v) on conflict do nothing;
  if not found then perform interno.erro('ja_votou'); end if;
  insert into rede_consulta_cedulas (consulta, ranking) values (c.id, p_ranking);
  return jsonb_build_object('votei', true);
end $$;

/** Mandar pergunta para a fila (entra no fim). Uma por pessoa e plenária; `p_mostrar` decide se o @ aparece na fila. */
create or replace function public.rede_org_plenaria_perguntar(p_plenaria uuid, p_texto text, p_mostrar boolean) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); p rede_plenarias; v_texto text := btrim(coalesce(p_texto, ''));
begin
  perform interno.rede3_perfil_exige_membro(v);
  select * into p from rede_plenarias where id = p_plenaria;
  if not found or interno.rede_bloqueado(v, p.org) or exists (select 1 from perfis where id = p.org and suspenso) then perform interno.erro('nao_encontrado'); end if;
  if p.situacao = 'encerrada' then perform interno.erro('plenaria_encerrada'); end if;
  if char_length(v_texto) < 2 or char_length(v_texto) > 280 then perform interno.erro('invalido:texto'); end if;
  perform interno.limite('alumia_org_perguntar', 10, 60);
  if exists (select 1 from rede_plenaria_perguntas q where q.plenaria = p.id and q.autor = v) then perform interno.erro('ja_perguntou'); end if;
  insert into rede_plenaria_perguntas (plenaria, autor, mostrar, texto) values (p.id, v, coalesce(p_mostrar, false), v_texto);
  return jsonb_build_object('ok', true, 'naFila', (select count(*) from rede_plenaria_perguntas q where q.plenaria = p.id and q.respondida_em is null and q.retirada_em is null));
end $$;

-- ── 5. Conta da organização e o selo ──────────────────────────────────────────────────────────────────────────────────────

/** Confere o pedido do selo (as mesmas regras de lib/rede/org/pedido.ts). Devolve o motivo ou nulo. */
create or replace function interno.alumia_pedido_falta(p jsonb) returns text language plpgsql immutable as $$
declare v_doc text := btrim(coalesce(p ->> 'documento', ''));
begin
  if char_length(btrim(coalesce(p ->> 'codinome', ''))) not between 2 and 60 then return 'codinome'; end if;
  if coalesce(p ->> 'handle', '') !~ '^[a-z0-9_]{3,20}$' then return 'handle'; end if;
  if coalesce(p ->> 'tipo', '') not in ('partido', 'mandato', 'sindicato', 'movimento', 'coletivo', 'gremio', 'dce', 'outro') then return 'tipo'; end if;
  if char_length(btrim(coalesce(p ->> 'cidade', ''))) not between 1 and 60 then return 'cidade'; end if;
  if char_length(btrim(coalesce(p ->> 'documentoTipo', ''))) not between 2 and 60 then return 'documentoTipo'; end if;
  if char_length(v_doc) not between 2 and 200 then return 'documento'; end if;
  -- CPF (11 dígitos) é documento de PESSOA: recusado (LGPD art. 6º, III). CNPJ tem 14 e passa.
  if v_doc ~ '^\d{3}\.?\d{3}\.?\d{3}-?\d{2}$' then return 'docPessoal'; end if;
  if char_length(btrim(coalesce(p ->> 'sobre', ''))) not between 2 and 280 then return 'sobre'; end if;
  if coalesce((p ->> 'maior')::boolean, false) is not true then return 'maior'; end if;
  return null;
end $$;
revoke all on function interno.alumia_pedido_falta(jsonb) from public;

/**
 * Pedir o selo. Se o @ já é de uma organização que eu gerencio: o pedido entra na fila (um esperando por vez). Se o @ está livre:
 * devolve {criar: true, dono} e o servidor (app/api/rede/org/selo) cria a conta sem senha e chama rede_org_criar. `dono` é o
 * próprio id de quem chama (vem da sessão, não do pedido). Recusa @ de outra pessoa ou de organização que não é minha.
 */
create or replace function public.rede_org_pedir_selo(p jsonb) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); v_falta text; v_handle text; v_org uuid; v_id uuid;
begin
  perform interno.rede3_perfil_exige_membro(v);
  v_falta := interno.alumia_pedido_falta(p);
  if v_falta is not null then perform interno.erro('invalido:' || lower(v_falta)); end if;
  perform interno.limite('alumia_org_selo', 6, 1440);
  v_handle := p ->> 'handle';
  select perfil into v_org from rede_orgs o join perfis f on f.id = o.perfil where f.rede_handle = v_handle;
  if v_org is not null then
    if not interno.alumia_org_gere(v, v_org) then perform interno.erro('handle_usado'); end if;
    if exists (select 1 from rede_org_pedidos where org = v_org and situacao = 'esperando') then perform interno.erro('ja_pedido'); end if;
    if exists (select 1 from rede_orgs where perfil = v_org and verificada_em is not null) then perform interno.erro('ja_verificada'); end if;
    insert into rede_org_pedidos (org, documento_tipo, documento, sobre) values (v_org, btrim(p ->> 'documentoTipo'), btrim(p ->> 'documento'), btrim(p ->> 'sobre'))
    returning id into v_id;
    return jsonb_build_object('id', v_id, 'situacao', 'esperando');
  end if;
  if not interno.rede2_handle_ok(v_handle, v) or exists (select 1 from perfis where rede_handle = v_handle) then
    perform interno.erro(case when v_handle ~ '(instituto|lucia|equipe|coordena|modera|admin|suporte|oficial)' then 'handle_reservado' else 'handle_usado' end);
  end if;
  if (select count(*) from rede_org_gestores where gestor = v and papel = 'dono') >= 5 then perform interno.erro('limite_identidades'); end if;
  return jsonb_build_object('criar', true, 'dono', v);
end $$;

/**
 * Só o servidor (chave de serviço), logo depois de lib/rede/contas-extra.ts criar a conta sem senha e ligá-la ao dono em
 * rede_identidades: transforma o perfil novo em organização, põe o dono como gestor e o pedido na fila. Confere tudo de novo.
 */
create or replace function public.rede_org_criar(p_dono uuid, p_org uuid, p jsonb) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v_falta text := interno.alumia_pedido_falta(p); v_handle text := p ->> 'handle'; v_id uuid;
begin
  if v_falta is not null then perform interno.erro('invalido:' || lower(v_falta)); end if;
  if not exists (select 1 from rede_identidades i where i.dono = p_dono and i.identidade = p_org and i.tipo = 'org') then perform interno.erro('sem_permissao'); end if;
  if not interno.rede2_membro(p_dono) then perform interno.erro('consentimento'); end if;
  if exists (select 1 from rede_orgs where perfil = p_org) then perform interno.erro('ja_pedido'); end if;
  if not interno.rede2_handle_ok(v_handle, p_org) then perform interno.erro('handle_usado'); end if;
  update perfis set rede_handle = v_handle, rede_codinome = btrim(p ->> 'codinome'), rede_codinome_ok = true, rede_bio = btrim(p ->> 'sobre')
  where id = p_org;
  insert into rede_orgs (perfil, tipo, cidade, palavra) values (p_org, p ->> 'tipo', btrim(p ->> 'cidade'), interno.alumia_palavra(p ->> 'codinome'));
  insert into rede_org_gestores (org, gestor, papel) values (p_org, p_dono, 'dono');
  insert into rede_org_pedidos (org, documento_tipo, documento, sobre) values (p_org, btrim(p ->> 'documentoTipo'), btrim(p ->> 'documento'), btrim(p ->> 'sobre'))
  returning id into v_id;
  return jsonb_build_object('id', v_id, 'situacao', 'esperando');
end $$;

/** A fila do selo (painel; só a coordenação). Mostra a organização e o documento público; nunca quem pediu nem os gestores. */
create or replace function public.rede_org_selo_fila() returns jsonb language plpgsql stable security definer set search_path = interno, pg_temp as $$
begin
  perform interno.eu();
  if not interno.coord() then perform interno.erro('sem_permissao'); end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object('id', x.id, 'codinome', f.rede_codinome, 'handle', f.rede_handle, 'tipo', o.tipo, 'cidade', o.cidade,
      'documentoTipo', x.documento_tipo, 'documento', x.documento, 'sobre', x.sobre, 'maior', true, 'criadoEm', x.criado_em, 'situacao', x.situacao,
      'motivo', x.motivo) order by (x.situacao = 'esperando') desc, x.criado_em)
    from (select * from rede_org_pedidos where situacao = 'esperando' or criado_em > now() - interval '60 days' order by criado_em desc limit 100) x
    join rede_orgs o on o.perfil = x.org join perfis f on f.id = x.org), '[]'::jsonb);
end $$;

/** Dar ou recusar o selo (só a coordenação; recusar pede motivo de 10 letras). Os gestores recebem o aviso. Registrado. */
create or replace function public.rede_org_selo_decidir(p_id uuid, p_aceitar boolean, p_motivo text) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); x rede_org_pedidos; v_motivo text := left(btrim(coalesce(p_motivo, '')), 500); g record; v_nome text;
begin
  if not interno.coord() then perform interno.erro('sem_permissao'); end if;
  select * into x from rede_org_pedidos where id = p_id for update;
  if not found or x.situacao <> 'esperando' then perform interno.erro('nao_encontrado'); end if;
  if not coalesce(p_aceitar, false) and char_length(v_motivo) < 10 then perform interno.erro('invalido:motivo'); end if;
  v_nome := interno.rede_nome(x.org);
  update rede_org_pedidos set situacao = case when p_aceitar then 'aceito' else 'recusado' end, motivo = v_motivo, decidido_em = now(), decidido_por = v where id = x.id;
  if p_aceitar then
    update rede_orgs set verificada_em = now(), verificada_por = v, documento_tipo = x.documento_tipo, documento_publico = x.documento where perfil = x.org;
  end if;
  for g in select gestor from rede_org_gestores where org = x.org loop
    perform interno.avisar_em(g.gestor, case when p_aceitar then format('A organização “%s” recebeu o selo da Alumia.', v_nome)
      else format('O pedido do selo de “%s” não foi aceito: %s', v_nome, v_motivo) end, 'rede');
  end loop;
  perform interno.registrar(case when p_aceitar then 'alumia_selo_dar' else 'alumia_selo_recusar' end, x.org::text, '{}'::jsonb);
  return jsonb_build_object('ok', true);
end $$;

/** Tirar o selo (só a coordenação, com motivo; os gestores são avisados e podem pedir de novo). Registrado (PLANO-ALUMIA §7.6). */
create or replace function public.rede_org_selo_tirar(p_handle text, p_motivo text) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v_org uuid; v_motivo text := left(btrim(coalesce(p_motivo, '')), 500); g record;
begin
  perform interno.eu();
  if not interno.coord() then perform interno.erro('sem_permissao'); end if;
  if char_length(v_motivo) < 10 then perform interno.erro('invalido:motivo'); end if;
  v_org := interno.alumia_org_de(p_handle);
  if v_org is null then perform interno.erro('nao_encontrado'); end if;
  update rede_orgs set verificada_em = null, verificada_por = null where perfil = v_org;
  for g in select gestor from rede_org_gestores where org = v_org loop
    perform interno.avisar_em(g.gestor, format('O selo de “%s” foi retirado: %s', interno.rede_nome(v_org), v_motivo), 'rede');
  end loop;
  perform interno.registrar('alumia_selo_tirar', v_org::text, jsonb_build_object('motivo', v_motivo));
  return jsonb_build_object('ok', true);
end $$;

-- ── 6. Gestores (o vínculo nunca volta: só "ok") ──────────────────────────────────────────────────────────────────────────

/** O dono põe outra pessoa (membro da Rede) como gestora. Responde só "ok". */
create or replace function public.rede_org_gestor_adicionar(p_org text, p_handle text) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); v_org uuid := interno.alumia_org_de(p_org); v_quem uuid;
begin
  perform interno.rede3_perfil_exige_membro(v);
  if v_org is null or not exists (select 1 from rede_org_gestores where org = v_org and gestor = v and papel = 'dono') then perform interno.erro('sem_permissao'); end if;
  perform interno.limite('alumia_org_gestor', 10, 1440);
  select id into v_quem from perfis where rede_handle = lower(btrim(coalesce(p_handle, ''), ' @')) and not suspenso;
  if v_quem is null or v_quem = v_org or not interno.rede2_membro(v_quem) or interno.rede_bloqueado(v, v_quem) or interno.rede_bloqueado(v_org, v_quem)
     or exists (select 1 from rede_orgs where perfil = v_quem) or exists (select 1 from rede_identidades where identidade = v_quem) then
    perform interno.erro('nao_encontrado');
  end if;
  if (select count(*) from rede_org_gestores where org = v_org) >= 10 then perform interno.erro('limite_gestores'); end if;
  insert into rede_org_gestores (org, gestor, papel) values (v_org, v_quem, 'gestor') on conflict do nothing;
  perform interno.avisar_em(v_quem, format('Você agora ajuda a cuidar da conta “%s” na Alumia. Se não quiser, saia pela página da organização.', interno.rede_nome(v_org)), 'rede');
  return jsonb_build_object('ok', true);
end $$;

/** O dono tira uma pessoa da gestão. Responde "ok" mesmo se ela não era (não serve para descobrir quem é). */
create or replace function public.rede_org_gestor_remover(p_org text, p_handle text) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); v_org uuid := interno.alumia_org_de(p_org);
begin
  if v_org is null or not exists (select 1 from rede_org_gestores where org = v_org and gestor = v and papel = 'dono') then perform interno.erro('sem_permissao'); end if;
  perform interno.limite('alumia_org_gestor', 10, 1440);
  delete from rede_org_gestores g using perfis f where g.org = v_org and g.papel = 'gestor' and f.id = g.gestor and f.rede_handle = lower(btrim(coalesce(p_handle, ''), ' @'));
  return jsonb_build_object('ok', true);
end $$;

/** Eu saio da gestão (o dono não sai: a conta ficaria sem ninguém). */
create or replace function public.rede_org_gestor_sair(p_org text) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); v_org uuid := interno.alumia_org_de(p_org);
begin
  delete from rede_org_gestores where org = v_org and gestor = v and papel = 'gestor';
  return jsonb_build_object('ok', true);
end $$;

-- ── 7. O que só quem gerencia faz ─────────────────────────────────────────────────────────────────────────────────────────

/** Registrar um voto em "Como votamos" (com a fonte pública obrigatória). */
create or replace function public.rede_org_votacao_registrar(p_handle text, p jsonb) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v_org uuid := interno.alumia_org_gestor(p_handle, 'alumia_org_votacao', 30, 1440); x rede_org_votacoes; v_data date;
begin
  begin v_data := (p ->> 'data')::date; exception when others then perform interno.erro('invalido:data'); end;
  if v_data is null or v_data > current_date or v_data < date '1988-10-05' then perform interno.erro('invalido:data'); end if;
  if coalesce(p ->> 'fonte', '') !~ '^https?://[^\s]{3,}$' then perform interno.erro('invalido:fonte'); end if;
  begin
    insert into rede_org_votacoes (org, data, projeto, voto, porque, resultado, fonte)
    values (v_org, v_data, btrim(coalesce(p ->> 'projeto', '')), p ->> 'voto', btrim(coalesce(p ->> 'porque', '')), btrim(coalesce(p ->> 'resultado', '')), btrim(p ->> 'fonte'))
    returning * into x;
  exception when check_violation or not_null_violation then perform interno.erro('invalido:votacao');
  end;
  return jsonb_build_object('id', x.id, 'data', x.data, 'projeto', x.projeto, 'voto', x.voto, 'porque', x.porque, 'resultado', x.resultado, 'fonte', x.fonte);
end $$;

/** Criar um núcleo da organização. */
create or replace function public.rede_org_nucleo_criar(p_handle text, p jsonb) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := auth.uid(); v_org uuid := interno.alumia_org_gestor(p_handle, 'alumia_org_nucleo', 10, 1440); v_id uuid;
begin
  if (select count(*) from rede_nucleos where org = v_org) >= 50 then perform interno.erro('limite_nucleos'); end if;
  begin
    insert into rede_nucleos (nome, cidade, criado_por, org, org_quando, org_cor)
    values (btrim(coalesce(p ->> 'nome', '')), btrim(coalesce(p ->> 'onde', '')), v_org, v_org, btrim(coalesce(p ->> 'quando', '')),
            coalesce(nullif(p ->> 'cor', '')::smallint, 1))
    returning id into v_id;
  exception when check_violation or invalid_text_representation or numeric_value_out_of_range then perform interno.erro('invalido:nucleo');
  end;
  -- Quem cria entra como mediação (para receber e decidir pedidos). Não aparece em lista nenhuma.
  insert into rede_nucleo_membros (nucleo, usuario, papel) values (v_id, v, 'mediacao') on conflict do nothing;
  return jsonb_build_object('id', v_id);
end $$;

/** Os pedidos para entrar nos núcleos da organização (só gestores e a mediação do núcleo): codinome e @, nada mais. */
create or replace function public.rede_org_nucleo_pedidos(p_handle text) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); v_org uuid := interno.alumia_org_de(p_handle); v_gere boolean;
begin
  perform interno.rede3_perfil_exige_membro(v);
  if v_org is null then perform interno.erro('sem_permissao'); end if;
  v_gere := interno.alumia_org_gere(v, v_org);
  if not v_gere and not exists (select 1 from rede_nucleo_membros m join rede_nucleos n on n.id = m.nucleo where n.org = v_org and m.usuario = v and m.papel = 'mediacao') then
    perform interno.erro('sem_permissao');
  end if;
  perform interno.limite('alumia_org_ler', 300, 10);
  return coalesce((
    select jsonb_agg(jsonb_build_object('nucleo', n.id, 'nucleoNome', n.nome, 'handle', f.rede_handle, 'codinome', f.rede_codinome) order by q.criado_em, f.rede_handle)
    from rede_org_nucleo_pedidos q join rede_nucleos n on n.id = q.nucleo join perfis f on f.id = q.usuario
    where n.org = v_org and not f.suspenso
      and (v_gere or exists (select 1 from rede_nucleo_membros m where m.nucleo = n.id and m.usuario = v and m.papel = 'mediacao'))), '[]'::jsonb);
end $$;

/** Aceitar ou recusar um pedido para entrar no núcleo (gestor ou mediação do núcleo). Recusar só apaga o pedido. */
create or replace function public.rede_org_nucleo_decidir(p_nucleo uuid, p_handle text, p_aceitar boolean) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); n rede_nucleos; v_quem uuid;
begin
  perform interno.rede3_perfil_exige_membro(v);
  select * into n from rede_nucleos where id = p_nucleo and org is not null;
  if not found or not (interno.alumia_org_gere(v, n.org) or exists (select 1 from rede_nucleo_membros m where m.nucleo = n.id and m.usuario = v and m.papel = 'mediacao')) then
    perform interno.erro('sem_permissao');
  end if;
  perform interno.limite('alumia_org_decidir', 200, 60);
  select q.usuario into v_quem from rede_org_nucleo_pedidos q join perfis f on f.id = q.usuario where q.nucleo = n.id and f.rede_handle = lower(btrim(coalesce(p_handle, ''), ' @'));
  if v_quem is null then perform interno.erro('nao_encontrado'); end if;
  delete from rede_org_nucleo_pedidos where nucleo = n.id and usuario = v_quem;
  if coalesce(p_aceitar, false) and interno.rede2_membro(v_quem) and not interno.rede_bloqueado(v_quem, n.org) then
    insert into rede_nucleo_membros (nucleo, usuario, papel) values (n.id, v_quem, 'membro') on conflict do nothing;
    perform interno.avisar_em(v_quem, format('Você entrou no núcleo “%s”.', n.nome), 'rede');
  end if;
  return jsonb_build_object('ok', true);
end $$;

/**
 * Abrir uma consulta à base. A pergunta, as opções (2 a 8), o método, o quórum, os núcleos que votam e o compromisso ficam
 * escritos ANTES e não mudam depois (ninguém troca a regra no meio). Prazo entre 1 hora e 60 dias.
 */
create or replace function public.rede_org_consulta_abrir(p_handle text, p jsonb) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare
  v_org uuid := interno.alumia_org_gestor(p_handle, 'alumia_org_consulta', 10, 1440); v_id uuid; v_prazo timestamptz; v_nucleos uuid[] := '{}';
  v_opcoes text[]; i integer;
begin
  begin v_prazo := (p ->> 'prazo')::timestamptz; exception when others then perform interno.erro('invalido:prazo'); end;
  if v_prazo is null or v_prazo < now() + interval '1 hour' or v_prazo > now() + interval '60 days' then perform interno.erro('invalido:prazo'); end if;
  select coalesce(array_agg(btrim(x)), '{}') into v_opcoes from jsonb_array_elements_text(coalesce(p -> 'opcoes', '[]'::jsonb)) x where btrim(x) <> '';
  if cardinality(v_opcoes) not between 2 and 8 or (select count(distinct lower(x)) from unnest(v_opcoes) x) <> cardinality(v_opcoes) then perform interno.erro('invalido:opcoes'); end if;
  if jsonb_typeof(p -> 'nucleos') = 'array' then
    select coalesce(array_agg(x::uuid), '{}') into v_nucleos from jsonb_array_elements_text(p -> 'nucleos') x;
    if exists (select 1 from unnest(v_nucleos) k where not exists (select 1 from rede_nucleos n where n.id = k and n.org = v_org)) then perform interno.erro('invalido:nucleos'); end if;
  end if;
  if not exists (select 1 from rede_nucleos n where n.org = v_org and (cardinality(v_nucleos) = 0 or n.id = any (v_nucleos))) then perform interno.erro('sem_nucleos'); end if;
  begin
    insert into rede_consultas (org, nucleos, pergunta, metodo, quorum, prazo, compromisso)
    values (v_org, v_nucleos, btrim(coalesce(p ->> 'pergunta', '')), p ->> 'metodo', nullif(p ->> 'quorum', '')::integer, v_prazo, btrim(coalesce(p ->> 'compromisso', '')))
    returning id into v_id;
  exception when check_violation or not_null_violation or invalid_text_representation then perform interno.erro('invalido:consulta');
  end;
  for i in 1 .. cardinality(v_opcoes) loop
    begin
      insert into rede_consulta_opcoes (consulta, ordem, texto) values (v_id, i, v_opcoes[i]);
    exception when check_violation then perform interno.erro('invalido:opcoes');
    end;
  end loop;
  return jsonb_build_object('id', v_id);
end $$;

/** Marcar uma plenária. */
create or replace function public.rede_org_plenaria_abrir(p_handle text, p jsonb) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v_org uuid := interno.alumia_org_gestor(p_handle, 'alumia_org_plenaria', 10, 1440); v_id uuid; v_inicio timestamptz;
begin
  begin v_inicio := (p ->> 'inicio')::timestamptz; exception when others then perform interno.erro('invalido:inicio'); end;
  if v_inicio is null or v_inicio < now() - interval '1 day' or v_inicio > now() + interval '180 days' then perform interno.erro('invalido:inicio'); end if;
  begin
    insert into rede_plenarias (org, titulo, descricao, inicio, sala)
    values (v_org, btrim(coalesce(p ->> 'titulo', '')), btrim(coalesce(p ->> 'descricao', '')), v_inicio, nullif(btrim(coalesce(p ->> 'sala', '')), ''))
    returning id into v_id;
  exception when check_violation then perform interno.erro('invalido:plenaria');
  end;
  return jsonb_build_object('id', v_id);
end $$;

/** Pôr no ar, encerrar ou trocar o link da sala (só https). */
create or replace function public.rede_org_plenaria_mudar(p_id uuid, p_situacao text, p_sala text default null) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); x rede_plenarias;
begin
  perform interno.rede3_perfil_exige_membro(v);
  select * into x from rede_plenarias where id = p_id;
  if not found or not interno.alumia_org_gere(v, x.org) then perform interno.erro('sem_permissao'); end if;
  if p_situacao not in ('marcada', 'ao_vivo', 'encerrada') or x.situacao = 'encerrada' then perform interno.erro('invalido:situacao'); end if;
  perform interno.limite('alumia_org_plenaria_mudar', 60, 60);
  begin
    update rede_plenarias set situacao = p_situacao, sala = coalesce(nullif(btrim(coalesce(p_sala, '')), ''), sala) where id = x.id;
  exception when check_violation then perform interno.erro('invalido:sala');
  end;
  return jsonb_build_object('ok', true);
end $$;

/** Marcar a pergunta como respondida (a ordem da fila não muda). */
create or replace function public.rede_org_plenaria_responder(p_pergunta uuid) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); v_org uuid;
begin
  select p.org into v_org from rede_plenaria_perguntas q join rede_plenarias p on p.id = q.plenaria where q.id = p_pergunta;
  if v_org is null or not interno.alumia_org_gere(v, v_org) then perform interno.erro('sem_permissao'); end if;
  perform interno.limite('alumia_org_plenaria_mudar', 60, 60);
  update rede_plenaria_perguntas set respondida_em = coalesce(respondida_em, now()) where id = p_pergunta;
  return jsonb_build_object('ok', true);
end $$;

/**
 * Tirar uma pergunta da fila só por regra escrita (ofensa, dado pessoal, fora do tema, repetida), com registro (PLANO-ALUMIA §7.4).
 * A pergunta não é apagada nem reordenada: fica marcada, fora da lista.
 */
create or replace function public.rede_org_plenaria_retirar(p_pergunta uuid, p_motivo text) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); v_org uuid;
begin
  select p.org into v_org from rede_plenaria_perguntas q join rede_plenarias p on p.id = q.plenaria where q.id = p_pergunta;
  if v_org is null or not interno.alumia_org_gere(v, v_org) then perform interno.erro('sem_permissao'); end if;
  if p_motivo is null or p_motivo not in ('ofensa', 'dado_pessoal', 'fora_do_tema', 'repetida') then perform interno.erro('invalido:motivo'); end if;
  perform interno.limite('alumia_org_plenaria_mudar', 60, 60);
  update rede_plenaria_perguntas set retirada_em = now(), retirada_motivo = p_motivo where id = p_pergunta and retirada_em is null;
  -- O registro leva a organização e o motivo, não quem do time tirou (o vínculo gestor↔organização não sai do banco).
  insert into auditoria (quem, nome, acao, alvo, detalhes) values (v_org, '', 'alumia_pergunta_retirar', p_pergunta::text, jsonb_build_object('motivo', p_motivo));
  return jsonb_build_object('ok', true);
end $$;

-- ── 8. O sininho avisa quando a organização posta ────────────────────────────────────────────────────────────────────────

/** Post novo (não resposta) de uma organização: avisa quem ligou o sininho e pode ver o post (sem trecho do texto). */
create or replace function interno.alumia_org_postou() returns trigger language plpgsql security definer set search_path = interno, pg_temp as $$
declare s record; v_nome text;
begin
  if new.resposta_a is not null or new.autor is null or not exists (select 1 from rede_orgs where perfil = new.autor) then return new; end if;
  v_nome := interno.rede_nome(new.autor);
  for s in select usuario from rede_org_sinos where org = new.autor limit 5000 loop
    if interno.rede2_membro(s.usuario) and not interno.rede_bloqueado(s.usuario, new.autor) and interno.rede2_pode_ver(new, s.usuario)
       and interno.rede3_aviso_pref(s.usuario, 'org_postou', 'site') then
      perform interno.avisar_em(s.usuario, format('“%s” publicou na Alumia.', v_nome), 'rede');
    end if;
  end loop;
  return new;
exception when others then
  return new;
end $$;
revoke all on function interno.alumia_org_postou() from public;
drop trigger if exists alumia_org_postou on interno.rede_posts;
create trigger alumia_org_postou after insert on interno.rede_posts for each row execute function interno.alumia_org_postou();

-- ── 9. Extras do perfil de pessoa ─────────────────────────────────────────────────────────────────────────────────────────

/** Status (só enquanto vale), pronomes e campos de uma pessoa. Mesma regra de quem pode ver o perfil (invisível/bloqueio = nada). */
create or replace function public.rede_perfil_extras(p_handle text) returns jsonb language plpgsql stable security definer set search_path = interno, pg_temp as $$
declare v uuid := auth.uid(); f perfis;
begin
  select * into f from perfis where rede_handle = lower(btrim(coalesce(p_handle, ''), ' @'));
  if not found or f.suspenso or ((f.rede_modo = 'invisivel' or f.rede_invisivel) and f.id is distinct from v) or interno.rede_bloqueado(v, f.id) then return null; end if;
  if v is null and not exists (select 1 from rede_orgs where perfil = f.id and verificada_em is not null) then return null; end if;
  return jsonb_build_object(
    'status', case when f.rede_status_tipo is not null and (f.rede_status_ate is null or f.rede_status_ate > now())
                then jsonb_build_object('tipo', f.rede_status_tipo, 'texto', coalesce(f.rede_status_texto, ''), 'ate', f.rede_status_ate) end,
    'pronomes', nullif(f.rede_pronomes, ''),
    'campos', coalesce((select jsonb_agg(jsonb_build_object('rotulo', c.rotulo, 'valor', c.valor) order by c.ordem) from rede_perfil_campos c where c.usuario = f.id), '[]'::jsonb),
    'destaques', '[]'::jsonb);
end $$;

/** Editar os meus extras. Campos: até 4 (substitui todos). Status: some sozinho depois de `horas` (1 a 720). */
create or replace function public.rede_perfil_extras_editar(p jsonb) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); c jsonb; i integer := 0;
begin
  perform interno.rede3_perfil_exige_membro(v);
  perform interno.limite('alumia_perfil_extras', 30, 60);
  if p ? 'status' then
    if jsonb_typeof(p -> 'status') = 'object' then
      if coalesce(p -> 'status' ->> 'tipo', '') not in ('greve', 'ato', 'estudando', 'cuidando', 'ferias')
         or char_length(coalesce(p -> 'status' ->> 'texto', '')) > 60
         or coalesce((p -> 'status' ->> 'horas')::integer, 0) not between 1 and 720 then
        perform interno.erro('invalido:status');
      end if;
      update perfis set rede_status_tipo = p -> 'status' ->> 'tipo', rede_status_texto = btrim(coalesce(p -> 'status' ->> 'texto', '')),
        rede_status_ate = now() + make_interval(hours => (p -> 'status' ->> 'horas')::integer) where id = v;
    else
      update perfis set rede_status_tipo = null, rede_status_texto = null, rede_status_ate = null where id = v;
    end if;
  end if;
  if p ? 'pronomes' then
    if char_length(coalesce(p ->> 'pronomes', '')) > 30 then perform interno.erro('invalido:pronomes'); end if;
    update perfis set rede_pronomes = nullif(btrim(coalesce(p ->> 'pronomes', '')), '') where id = v;
  end if;
  if jsonb_typeof(p -> 'campos') = 'array' then
    if jsonb_array_length(p -> 'campos') > 4 then perform interno.erro('invalido:campos'); end if;
    delete from rede_perfil_campos where usuario = v;
    for c in select value from jsonb_array_elements(p -> 'campos') loop
      i := i + 1;
      begin
        insert into rede_perfil_campos (usuario, ordem, rotulo, valor) values (v, i, btrim(coalesce(c ->> 'rotulo', '')), btrim(coalesce(c ->> 'valor', '')));
      exception when check_violation then perform interno.erro('invalido:campos');
      end;
    end loop;
  end if;
  return public.rede_perfil_extras((select rede_handle from perfis where id = v));
end $$;

-- ── 10. Permissões das funções ────────────────────────────────────────────────────────────────────────────────────────────
do $$
declare f text;
begin
  foreach f in array array[
    'public.rede_org_perfil(text)', 'public.rede_org_ao_vivo()', 'public.rede_org_sino(text, boolean)', 'public.rede_org_nucleo_entrar(uuid)',
    'public.rede_org_consulta_votar(uuid, uuid[])', 'public.rede_org_plenaria_perguntar(uuid, text, boolean)', 'public.rede_org_pedir_selo(jsonb)',
    'public.rede_org_criar(uuid, uuid, jsonb)', 'public.rede_org_selo_fila()', 'public.rede_org_selo_decidir(uuid, boolean, text)',
    'public.rede_org_selo_tirar(text, text)', 'public.rede_org_gestor_adicionar(text, text)', 'public.rede_org_gestor_remover(text, text)',
    'public.rede_org_gestor_sair(text)', 'public.rede_org_votacao_registrar(text, jsonb)', 'public.rede_org_nucleo_criar(text, jsonb)',
    'public.rede_org_nucleo_pedidos(text)', 'public.rede_org_nucleo_decidir(uuid, text, boolean)', 'public.rede_org_consulta_abrir(text, jsonb)',
    'public.rede_org_plenaria_abrir(text, jsonb)', 'public.rede_org_plenaria_mudar(uuid, text, text)', 'public.rede_org_plenaria_responder(uuid)',
    'public.rede_org_plenaria_retirar(uuid, text)', 'public.rede_perfil_extras(text)', 'public.rede_perfil_extras_editar(jsonb)'] loop
    execute format('revoke all on function %s from public', f);
    if exists (select 1 from pg_roles where rolname = 'anon') then
      execute format('revoke all on function %s from anon, authenticated', f);
    end if;
  end loop;
  if exists (select 1 from pg_roles where rolname = 'anon') then
    -- Visitante: só o que a matriz deixa ver (perfil com selo, ao vivo das com selo, extras de organização com selo).
    grant execute on function public.rede_org_perfil(text), public.rede_org_ao_vivo(), public.rede_perfil_extras(text) to anon;
    grant execute on function public.rede_org_perfil(text), public.rede_org_ao_vivo(), public.rede_org_sino(text, boolean), public.rede_org_nucleo_entrar(uuid),
      public.rede_org_consulta_votar(uuid, uuid[]), public.rede_org_plenaria_perguntar(uuid, text, boolean), public.rede_org_pedir_selo(jsonb),
      public.rede_org_selo_fila(), public.rede_org_selo_decidir(uuid, boolean, text), public.rede_org_selo_tirar(text, text),
      public.rede_org_gestor_adicionar(text, text), public.rede_org_gestor_remover(text, text), public.rede_org_gestor_sair(text),
      public.rede_org_votacao_registrar(text, jsonb), public.rede_org_nucleo_criar(text, jsonb), public.rede_org_nucleo_pedidos(text),
      public.rede_org_nucleo_decidir(uuid, text, boolean), public.rede_org_consulta_abrir(text, jsonb), public.rede_org_plenaria_abrir(text, jsonb),
      public.rede_org_plenaria_mudar(uuid, text, text), public.rede_org_plenaria_responder(uuid), public.rede_org_plenaria_retirar(uuid, text),
      public.rede_perfil_extras(text), public.rede_perfil_extras_editar(jsonb) to authenticated;
    -- Só o servidor transforma a conta nova em organização.
    grant execute on function public.rede_org_criar(uuid, uuid, jsonb) to service_role;
  end if;
end $$;

-- ═══════════════════════════ fim da F4 ═══════════════════════════
