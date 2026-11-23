-- Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
-- Alumia · R2 · voto sem confiar no servidor (onda R2, item 1.7):
--
--   Até aqui, a chave de cada consulta saía do segredo do servidor do site (ALUMIA_VOTO_SEGREDO): quem tivesse o servidor abria as
--   cédulas. Agora a chave de cada votação secreta é criada no aparelho de quem a abre, e a semente dela é dividida entre N guardiãs
--   da coordenação (3 a 7); abrir exige K delas (2 a N). Cada parte vai cifrada para a chave de voto de uma guardiã (X-Wing), que
--   fica só no aparelho dela. O banco guarda a chave pública da votação, as partes cifradas e as cédulas cifradas: NADA disso abre
--   uma cédula sem K guardiãs. Vale para a consulta à base das organizações (e as eleições, que são consultas), a votação secreta
--   das comunidades e a votação secreta da equipe. A cifra está em lib/rede/voto/limiar.ts.
--
--   1. O registro da chave de cada votação (interno.rede_consulta_chaves) e as partes repassadas à abridora
--      (interno.rede_consulta_aberturas). A cédula repetida é recusada (resumo único por votação). A votação secreta da equipe
--      ganha a urna de cédulas cifradas (interno.votacao_cifradas).
--   2. As funções: a guardiã publica a chave de voto dela (no diretório do chat novo, assinada pela identidade); quem abre a votação
--      escolhe as guardiãs e publica a chave; quem vota lê o registro; depois de fechada, as guardiãs repassam as partes à abridora,
--      que apura no aparelho dela e manda só as escolhas, num lote embaralhado.
--   3. Os votos: só a cédula nova ("v2.", tamanho fixo). O voto secreto às claras sai (não há mais o caminho "sem serviço"), e as
--      funções com que o servidor abria as cédulas (alumia_voto_cifradas, alumia_voto_apurar, alumia_decisao_cifradas,
--      alumia_decisao_apurar) e o voto secreto da equipe às claras (alumia_voto_equipe) são apagadas.
--
-- Leis e princípios: Constituição art. 5º, XVII a XX (liberdade de associação: o voto da base é dela), LGPD art. 6º, III
-- (necessidade: o banco não guarda nada que abra o voto) e art. 11 (opinião política é dado sensível). Nenhuma lista de pessoas além
-- das guardiãs, que são da coordenação (já pública); o banco nunca liga quem votou ao voto; só o DIA, nunca a hora.
--
-- Depende de: 20261124-r2-caixas.sql (interno.diretorio_contas: a identidade da conta e a chave de voto). Para se houver cédula do
-- formato de antes esperando apuração (apure antes de rodar). Redefine (a definição COMPLETA, tirada do banco montado com o
-- install.sql deste ramo): public.rede_org_consulta_votar, public.rede_org_consulta_votar_cifrada, public.alumia_decisao_votar,
-- public.alumia_decisao_votar_cifrada, interno.alumia_urna_cifrada, interno.alumia_dec_urna_cifrada, interno.votacao_json e
-- interno.alumia_eleicao_avancar (a eleição espera as guardiãs abrirem a urna antes de apurar).
-- Pode rodar mais de uma vez. Termina trancando tudo na porta. Teste: npm run testar:r2-voto.

-- ── 0. Nada do formato de antes esperando ─────────────────────────────────────────────────────────────────────────────────
do $$
begin
  if exists (select 1 from interno.rede_consulta_cifradas where cedula like 'c1.%')
     or (to_regclass('interno.alumia_decisao_cifradas') is not null and exists (select 1 from interno.alumia_decisao_cifradas where cedula like 'c1.%')) then
    raise exception 'r2-voto: há cédulas do formato de antes (c1) esperando apuração. Apure essas votações com o servidor de antes e rode de novo.';
  end if;
end $$;

-- ── 1. As tabelas ─────────────────────────────────────────────────────────────────────────────────────────────────────────
-- O registro da chave de uma votação secreta. "consulta" é o id da votação (consulta, decisão da comunidade ou votação da equipe:
-- os três são sorteados, nunca se repetem). As guardiãs são da coordenação de quem abriu a votação (gestão da organização, mediação
-- da comunidade, coordenação da equipe), que já é pública. "partes": a parte de cada guardiã, cifrada para a chave de voto dela.
create table if not exists interno.rede_consulta_chaves (
  consulta uuid primary key,
  tipo text not null check (tipo in ('consulta', 'decisao', 'equipe')),
  pk bytea not null check (octet_length(pk) = 1216),
  n smallint not null check (n between 3 and 7),
  k smallint not null check (k between 2 and 7 and k <= n),
  guardias uuid[] not null check (cardinality(guardias) = n),
  -- O que foi assinado, por guardiã, na ordem: a chave de voto, a identidade e a assinatura dela (base64), como estavam ao criar.
  guardias_chaves jsonb not null check (jsonb_typeof(guardias_chaves) = 'array'),
  partes jsonb not null check (jsonb_typeof(partes) = 'array'),
  assinatura bytea not null check (octet_length(assinatura) = 64),
  criador uuid not null references interno.perfis (id) on delete cascade,
  criada_por_identidade bytea not null check (octet_length(criada_por_identidade) = 32),
  -- A abridora (o número dela entre as guardiãs), escolhida na hora de abrir; o dia, para outra guardiã assumir se ela sumir.
  abridora smallint check (abridora is null or abridora between 1 and n),
  abridora_dia date,
  apurada boolean not null default false,
  dia date not null default current_date
);
-- As partes que as guardiãs repassaram à abridora (cifradas para a chave de voto dela). Uma por guardiã: repetir é recusado.
create table if not exists interno.rede_consulta_aberturas (
  consulta uuid not null references interno.rede_consulta_chaves (consulta) on delete cascade,
  indice smallint not null check (indice between 1 and 7),
  parte bytea not null check (octet_length(parte) = 1193),
  dia date not null default current_date,
  primary key (consulta, indice)
);
-- A urna cifrada da votação secreta da equipe (como a da consulta e a da decisão).
create table if not exists interno.votacao_cifradas (
  votacao uuid not null references interno.votacoes (id) on delete cascade,
  cedula text not null,
  resumo bytea not null
);
create index if not exists votacao_cifradas_votacao on interno.votacao_cifradas (votacao);
alter table interno.votacao_cifradas set (autovacuum_vacuum_threshold = 0, autovacuum_vacuum_scale_factor = 0);

-- Cédula repetida (copiada de outra pessoa ou reenviada) é recusada: um resumo por cédula, único em cada votação.
alter table interno.rede_consulta_cifradas add column if not exists resumo bytea;
alter table interno.alumia_decisao_cifradas add column if not exists resumo bytea;
update interno.rede_consulta_cifradas set resumo = sha256(convert_to(cedula, 'UTF8')) where resumo is null;
update interno.alumia_decisao_cifradas set resumo = sha256(convert_to(cedula, 'UTF8')) where resumo is null;
alter table interno.rede_consulta_cifradas alter column resumo set not null;
alter table interno.alumia_decisao_cifradas alter column resumo set not null;
-- O formato da cédula muda (c1 → v2, de tamanho fixo): o "check" de antes (c1, até 1600 letras) dá lugar ao novo.
alter table interno.rede_consulta_cifradas drop constraint if exists rede_consulta_cifradas_cedula_check;
alter table interno.alumia_decisao_cifradas drop constraint if exists alumia_decisao_cifradas_cedula_check;
alter table interno.rede_consulta_cifradas drop constraint if exists rede_consulta_cifradas_v2;
alter table interno.alumia_decisao_cifradas drop constraint if exists alumia_decisao_cifradas_v2;
alter table interno.votacao_cifradas drop constraint if exists votacao_cifradas_v2;
alter table interno.rede_consulta_cifradas add constraint rede_consulta_cifradas_v2 check (char_length(cedula) = 2233 and cedula ~ '^v2\.[A-Za-z0-9_-]+$' and octet_length(resumo) = 32);
alter table interno.alumia_decisao_cifradas add constraint alumia_decisao_cifradas_v2 check (char_length(cedula) = 2233 and cedula ~ '^v2\.[A-Za-z0-9_-]+$' and octet_length(resumo) = 32);
alter table interno.votacao_cifradas add constraint votacao_cifradas_v2 check (char_length(cedula) = 2233 and cedula ~ '^v2\.[A-Za-z0-9_-]+$' and octet_length(resumo) = 32);
create unique index if not exists rede_consulta_cifradas_resumo on interno.rede_consulta_cifradas (consulta, resumo);
create unique index if not exists alumia_decisao_cifradas_resumo on interno.alumia_decisao_cifradas (decisao, resumo);
create unique index if not exists votacao_cifradas_resumo on interno.votacao_cifradas (votacao, resumo);

do $$
declare t text;
begin
  foreach t in array array['rede_consulta_chaves', 'rede_consulta_aberturas', 'votacao_cifradas'] loop
    execute format('alter table interno.%I enable row level security', t);
    execute format('revoke all on table interno.%I from public', t);
    if exists (select 1 from pg_roles where rolname = 'anon') then
      execute format('revoke all on table interno.%I from anon, authenticated', t);
    end if;
  end loop;
end $$;

-- A votação apagada leva a chave junto (as três tabelas de votação não têm a mesma chave estrangeira; um gatilho em cada).
create or replace function interno.voto_chave_some() returns trigger language plpgsql security definer set search_path = interno, pg_temp as $$
begin
  delete from rede_consulta_chaves where consulta = old.id;
  return old;
end $$;
drop trigger if exists voto_chave_some on interno.rede_consultas;
create trigger voto_chave_some after delete on interno.rede_consultas for each row execute function interno.voto_chave_some();
drop trigger if exists voto_chave_some on interno.alumia_decisoes;
create trigger voto_chave_some after delete on interno.alumia_decisoes for each row execute function interno.voto_chave_some();
drop trigger if exists voto_chave_some on interno.votacoes;
create trigger voto_chave_some after delete on interno.votacoes for each row execute function interno.voto_chave_some();

-- ── 2. As regras de cada tipo de votação ──────────────────────────────────────────────────────────────────────────────────

/** Base64 sem quebra de linha (o encode do Postgres quebra a cada 76 letras). */
create or replace function interno.voto_b64(p bytea) returns text language sql immutable as $$
  select translate(encode(p, 'base64'), E'\n', '')
$$;

/** Base64 → bytes; texto torto vira nulo (nunca lança). */
create or replace function interno.voto_bytes(p text) returns bytea language plpgsql immutable as $$
begin
  if p is null or p !~ '^[A-Za-z0-9+/]*={0,2}$' then return null; end if;
  return decode(p, 'base64');
exception when others then
  return null;
end $$;

/** A situação de uma votação secreta: 'aberta', 'fechada', 'cancelada', ou nulo se não existe (ou não é secreta). */
create or replace function interno.voto_situacao(p_tipo text, p_alvo uuid) returns text language plpgsql stable security definer set search_path = interno, pg_temp as $$
declare c rede_consultas; d alumia_decisoes; v votacoes;
begin
  if p_tipo = 'consulta' then
    select * into c from rede_consultas where id = p_alvo;
    if not found then return null; end if;
    return case when c.prazo > now() then 'aberta' else 'fechada' end;
  elsif p_tipo = 'decisao' then
    select * into d from alumia_decisoes where id = p_alvo;
    if not found or d.modo <> 'secreta' then return null; end if;
    return interno.alumia_dec_situacao(d);
  elsif p_tipo = 'equipe' then
    select * into v from votacoes where id = p_alvo;
    if not found or not v.secreta then return null; end if;
    return case when v.encerrada_em is not null or v.encerra_em <= now() then 'fechada' else 'aberta' end;
  end if;
  return null;
end $$;

/** A votação já recebeu voto (às claras, cifrado ou só a marca de quem votou)? Com voto, a chave não muda mais. */
create or replace function interno.voto_tem_votos(p_tipo text, p_alvo uuid) returns boolean language sql stable security definer set search_path = interno, pg_temp as $$
  select case p_tipo
    when 'consulta' then exists (select 1 from rede_consulta_votantes where consulta = p_alvo) or exists (select 1 from rede_consulta_cifradas where consulta = p_alvo)
      or exists (select 1 from rede_consulta_cedulas where consulta = p_alvo)
    when 'decisao' then exists (select 1 from alumia_decisao_votantes where decisao = p_alvo) or exists (select 1 from alumia_decisao_cifradas where decisao = p_alvo)
      or exists (select 1 from alumia_decisao_cedulas where decisao = p_alvo)
    when 'equipe' then exists (select 1 from votacao_marcas where votacao = p_alvo) or exists (select 1 from votacao_votantes where votacao = p_alvo)
      or exists (select 1 from votacao_votos where votacao = p_alvo) or exists (select 1 from votacao_cifradas where votacao = p_alvo)
    else false end
$$;

/** Quem pode ser guardiã desta votação: a coordenação de quem a abriu. */
create or replace function interno.voto_pode_guardar(p_tipo text, p_alvo uuid, p_quem uuid) returns boolean language plpgsql stable security definer set search_path = interno, pg_temp as $$
declare v_org uuid; v_slug text;
begin
  if p_quem is null or exists (select 1 from perfis where id = p_quem and suspenso) then return false; end if;
  if p_tipo = 'consulta' then
    select org into v_org from rede_consultas where id = p_alvo;
    return v_org is not null and interno.alumia_org_gere(p_quem, v_org) and interno.rede2_membro(p_quem);
  elsif p_tipo = 'decisao' then
    select comunidade into v_slug from alumia_decisoes where id = p_alvo;
    return v_slug is not null and exists (select 1 from rede_comunidade_membros m where m.comunidade = v_slug and m.usuario = p_quem and m.papel = 'moderacao' and m.situacao = 'ativo');
  elsif p_tipo = 'equipe' then
    return exists (select 1 from votacoes where id = p_alvo) and interno.voluntario_e(p_quem)
      and exists (select 1 from papeis p where p.usuario = p_quem and p.papel in ('coordenacao', 'vice'));
  end if;
  return false;
end $$;

/** Quem pode publicar a chave desta votação: quem pode abri-la. */
create or replace function interno.voto_pode_criar(p_tipo text, p_alvo uuid, p_quem uuid) returns boolean language plpgsql stable security definer set search_path = interno, pg_temp as $$
declare v_org uuid; v_slug text; v votacoes;
begin
  if p_quem is null then return false; end if;
  if p_tipo = 'consulta' then
    select org into v_org from rede_consultas where id = p_alvo;
    return v_org is not null and interno.alumia_org_gere(p_quem, v_org);
  elsif p_tipo = 'decisao' then
    select comunidade into v_slug from alumia_decisoes where id = p_alvo;
    return v_slug is not null and interno.rede3_com_modera(v_slug, p_quem);
  elsif p_tipo = 'equipe' then
    select * into v from votacoes where id = p_alvo;
    return found and (v.criada_por = p_quem or exists (select 1 from papeis p where p.usuario = p_quem and p.papel in ('coordenacao', 'vice')));
  end if;
  return false;
end $$;

/** Quem pode ler o registro da chave (para votar ou conferir): quem vota nela, ou a coordenação. A chave é pública por desenho. */
create or replace function interno.voto_pode_ver(p_tipo text, p_alvo uuid, p_quem uuid) returns boolean language plpgsql stable security definer set search_path = interno, pg_temp as $$
declare c rede_consultas; d alumia_decisoes; v votacoes;
begin
  if p_quem is null then return false; end if;
  if interno.voto_pode_guardar(p_tipo, p_alvo, p_quem) or interno.voto_pode_criar(p_tipo, p_alvo, p_quem) then return true; end if;
  if p_tipo = 'consulta' then
    select * into c from rede_consultas where id = p_alvo;
    return found and interno.rede2_membro(p_quem) and not interno.rede_bloqueado(p_quem, c.org);
  elsif p_tipo = 'decisao' then
    select * into d from alumia_decisoes where id = p_alvo;
    return found and interno.rede2_na_comunidade(d.comunidade, p_quem);
  elsif p_tipo = 'equipe' then
    select * into v from votacoes where id = p_alvo;
    return found and interno.vota_em(v, p_quem);
  end if;
  return false;
end $$;

/** O nome da guardiã como a tela mostra: codinome na Alumia, o nome visto na equipe. */
create or replace function interno.voto_nome(p_tipo text, p_quem uuid) returns text language sql stable security definer set search_path = interno, pg_temp as $$
  select case when p_tipo = 'equipe' then coalesce((select interno.nome_visto(nome) from perfis where id = p_quem), '') else interno.rede_nome(p_quem) end
$$;

/** O número desta pessoa entre as guardiãs da votação (nulo se não for guardiã). */
create or replace function interno.voto_meu_indice(r interno.rede_consulta_chaves, p_quem uuid) returns smallint language sql immutable as $$
  select (array_position(r.guardias, p_quem))::smallint
$$;

/**
 * Quem pode votar na consulta: quem é de um núcleo dela (a regra de antes). Depois da R2 dos membros escondidos
 * (20261124-r2-membros.sql, que roda antes desta), o servidor não sabe quem é de qual núcleo: a filiação vem de
 * interno.rede_nucleo_sem_membros(), que não devolve ninguém, e a consulta à base fica fechada no servidor até haver credencial
 * anônima (pendência da R2). A regra mora numa função própria para mudar num lugar só.
 */
create or replace function interno.voto_consulta_elegivel(p_quem uuid, p_consulta uuid) returns boolean language plpgsql stable security definer set search_path = interno, pg_temp as $$
declare c rede_consultas; v_nucleos uuid[];
begin
  select * into c from rede_consultas where id = p_consulta;
  if not found then return false; end if;
  v_nucleos := case when cardinality(c.nucleos) > 0 then c.nucleos else coalesce((select array_agg(id) from rede_nucleos where org = c.org), '{}') end;
  return exists (select 1 from interno.rede_nucleo_sem_membros() m where m.usuario = p_quem and m.nucleo = any (v_nucleos));
end $$;

-- ── 3. A chave de voto da guardiã ─────────────────────────────────────────────────────────────────────────────────────────

/**
 * Publica (ou tira, com os dois nulos) a chave de voto desta conta no diretório do chat novo: a pública X-Wing e a assinatura dela
 * pela identidade da conta (o aparelho assina; o banco só guarda). A conta precisa já estar no diretório (chat novo ligado). Só
 * muda as duas colunas do voto: a identidade e a caixa de pedidos ficam como estão.
 */
create or replace function public.rede_voto_minha_chave(p jsonb) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); v_vx bytea := interno.voto_bytes(p ->> 'voto'); v_va bytea := interno.voto_bytes(p ->> 'assinatura');
begin
  perform interno.rede3_perfil_exige_membro(v);
  perform interno.limite('rede_voto_minha_chave', 10, 60);
  if (v_vx is null) <> (v_va is null) or (v_vx is not null and (octet_length(v_vx) <> 1216 or octet_length(v_va) <> 64)) then
    perform interno.erro('invalido:chave');
  end if;
  update diretorio_contas set voto_xwing = v_vx, voto_assinatura = v_va where usuario = v;
  if not found then perform interno.erro('sem_diretorio'); end if;
  return jsonb_build_object('ok', true);
end $$;

/** A minha chave de voto como está no diretório (para o aparelho conferir se é a que ele guarda). */
create or replace function public.rede_voto_minha_chave_ler() returns jsonb language plpgsql stable security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); d record;
begin
  select identidade, voto_xwing, voto_assinatura into d from diretorio_contas where usuario = v;
  if not found then return jsonb_build_object('diretorio', false); end if;
  return jsonb_build_object('diretorio', true, 'identidade', interno.voto_b64(d.identidade),
    'voto', case when d.voto_xwing is not null then interno.voto_b64(d.voto_xwing) end,
    'assinatura', case when d.voto_assinatura is not null then interno.voto_b64(d.voto_assinatura) end);
end $$;

-- ── 4. A chave da votação ─────────────────────────────────────────────────────────────────────────────────────────────────

/**
 * As pessoas da coordenação que podem ser guardiãs desta votação e já publicaram a chave de voto: para quem vai criar a chave
 * escolher. Só quem pode criar a chave vê; só com a votação aberta e ainda sem chave.
 */
create or replace function public.rede_voto_guardias_possiveis(p_tipo text, p_alvo uuid) returns jsonb language plpgsql stable security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu();
begin
  if p_tipo is null or p_tipo not in ('consulta', 'decisao', 'equipe') then perform interno.erro('invalido:tipo'); end if;
  if interno.voto_situacao(p_tipo, p_alvo) is null or not interno.voto_pode_criar(p_tipo, p_alvo, v) then perform interno.erro('sem_permissao'); end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object('usuario', d.usuario, 'nome', interno.voto_nome(p_tipo, d.usuario), 'identidade', interno.voto_b64(d.identidade),
             'voto', interno.voto_b64(d.voto_xwing), 'assinatura', interno.voto_b64(d.voto_assinatura), 'eu', d.usuario = v)
           order by interno.voto_nome(p_tipo, d.usuario), d.usuario)
    from diretorio_contas d
    where d.voto_xwing is not null and d.voto_assinatura is not null and interno.voto_pode_guardar(p_tipo, p_alvo, d.usuario)), '[]'::jsonb);
end $$;

/**
 * Publica a chave da votação, criada no aparelho de quem a abre (lib/rede/voto/limiar.ts). O banco confere o formato, que cada
 * guardiã é da coordenação e que a chave de voto e a identidade dela são as do diretório, e que a identidade de quem cria é a dela
 * no diretório. Não confere assinaturas (o aparelho de cada pessoa confere). Uma vez só, com a votação aberta e sem voto nenhum.
 *   p = {tipo, alvo, pk, k, guardias: [{indice, usuario, voto, identidade, assinatura}], partes: [b64 na ordem], assinatura,
 *        criador_identidade}
 */
create or replace function public.rede_voto_chave_publicar(p jsonb) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare
  v uuid := interno.eu(); v_tipo text := p ->> 'tipo'; v_alvo uuid; v_pk bytea := interno.voto_bytes(p ->> 'pk'); v_k integer; v_n integer;
  v_ass bytea := interno.voto_bytes(p ->> 'assinatura'); v_cid bytea := interno.voto_bytes(p ->> 'criador_identidade');
  v_guardias uuid[] := '{}'; v_chaves jsonb := '[]'::jsonb; v_partes jsonb := '[]'::jsonb; g jsonb; i integer; d record; v_parte bytea;
begin
  perform interno.limite('rede_voto_chave_publicar', 20, 60);
  if v_tipo is null or v_tipo not in ('consulta', 'decisao', 'equipe') then perform interno.erro('invalido:tipo'); end if;
  begin
    v_alvo := (p ->> 'alvo')::uuid;
    v_k := (p ->> 'k')::integer;
  exception when others then perform interno.erro('invalido:chave');
  end;
  if interno.voto_situacao(v_tipo, v_alvo) is null or not interno.voto_pode_criar(v_tipo, v_alvo, v) then perform interno.erro('sem_permissao'); end if;
  perform pg_advisory_xact_lock(hashtextextended('alumia_voto_chave:' || v_alvo::text, 0));
  if interno.voto_situacao(v_tipo, v_alvo) <> 'aberta' then perform interno.erro('fechada'); end if;
  if exists (select 1 from rede_consulta_chaves where consulta = v_alvo) then perform interno.erro('ja_tem_chave'); end if;
  if interno.voto_tem_votos(v_tipo, v_alvo) then perform interno.erro('ja_tem_votos'); end if;
  if jsonb_typeof(p -> 'guardias') is distinct from 'array' or jsonb_typeof(p -> 'partes') is distinct from 'array' then perform interno.erro('invalido:chave'); end if;
  v_n := jsonb_array_length(p -> 'guardias');
  if v_n not between 3 and 7 or v_k is null or v_k < 2 or v_k > v_n or jsonb_array_length(p -> 'partes') <> v_n
     or octet_length(v_pk) is distinct from 1216 or octet_length(v_ass) is distinct from 64 or octet_length(v_cid) is distinct from 32 then
    perform interno.erro('invalido:chave');
  end if;
  -- Quem cria assina com a identidade que está no diretório (o aparelho de quem vota confere a assinatura com ela).
  if not exists (select 1 from diretorio_contas x where x.usuario = v and x.identidade = v_cid) then perform interno.erro('identidade_trocada'); end if;
  for i in 1 .. v_n loop
    g := p -> 'guardias' -> (i - 1);
    if jsonb_typeof(g) is distinct from 'object' or (g ->> 'indice') is distinct from i::text then perform interno.erro('invalido:guardias'); end if;
    begin
      v_guardias := v_guardias || (g ->> 'usuario')::uuid;
    exception when others then perform interno.erro('invalido:guardias');
    end;
    select x.identidade, x.voto_xwing, x.voto_assinatura into d from diretorio_contas x where x.usuario = v_guardias[i];
    if not found or d.voto_xwing is null or not interno.voto_pode_guardar(v_tipo, v_alvo, v_guardias[i])
       or d.voto_xwing is distinct from interno.voto_bytes(g ->> 'voto') or d.identidade is distinct from interno.voto_bytes(g ->> 'identidade')
       or d.voto_assinatura is distinct from interno.voto_bytes(g ->> 'assinatura') then
      perform interno.erro('invalido:guardias');
    end if;
    v_parte := interno.voto_bytes(p -> 'partes' ->> (i - 1));
    if octet_length(v_parte) is distinct from 1193 then perform interno.erro('invalido:partes'); end if;
    v_chaves := v_chaves || jsonb_build_array(jsonb_build_object('indice', i, 'voto', interno.voto_b64(d.voto_xwing), 'identidade', interno.voto_b64(d.identidade),
      'assinatura', interno.voto_b64(d.voto_assinatura)));
    v_partes := v_partes || to_jsonb(interno.voto_b64(v_parte));
  end loop;
  if (select count(distinct x) from unnest(v_guardias) x) <> v_n then perform interno.erro('invalido:guardias'); end if;
  insert into rede_consulta_chaves (consulta, tipo, pk, n, k, guardias, guardias_chaves, partes, assinatura, criador, criada_por_identidade)
  values (v_alvo, v_tipo, v_pk, v_n, v_k, v_guardias, v_chaves, v_partes, v_ass, v, v_cid);
  return jsonb_build_object('ok', true);
end $$;

/**
 * O registro da chave da votação, para quem vota conferir e cifrar (e para as guardiãs): a chave pública, N, K, as guardiãs com o
 * que foi assinado, quem criou e a assinatura. Mais a situação da urna: aberta ou fechada, apurada, a abridora, quantas partes já
 * foram repassadas, o número de quem pergunta, se for guardiã, e se quem pergunta pode ser guardiã (da coordenação). "chave" nula
 * se a votação ainda não tem chave.
 */
create or replace function public.rede_voto_chave(p_tipo text, p_alvo uuid) returns jsonb language plpgsql stable security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); r rede_consulta_chaves; v_sit text;
begin
  if p_tipo is null or p_tipo not in ('consulta', 'decisao', 'equipe') then perform interno.erro('invalido:tipo'); end if;
  v_sit := interno.voto_situacao(p_tipo, p_alvo);
  if v_sit is null or not interno.voto_pode_ver(p_tipo, p_alvo, v) then perform interno.erro('nao_encontrado'); end if;
  select * into r from rede_consulta_chaves where consulta = p_alvo and tipo = p_tipo;
  if not found then
    return jsonb_build_object('chave', null, 'situacao', v_sit, 'possoCriar', v_sit = 'aberta' and interno.voto_pode_criar(p_tipo, p_alvo, v) and not interno.voto_tem_votos(p_tipo, p_alvo),
      'possoGuardar', interno.voto_pode_guardar(p_tipo, p_alvo, v));
  end if;
  return jsonb_build_object(
    'chave', jsonb_build_object('tipo', r.tipo, 'alvo', r.consulta, 'pk', interno.voto_b64(r.pk), 'n', r.n, 'k', r.k, 'criador', r.criador,
      'criador_identidade', interno.voto_b64(r.criada_por_identidade), 'assinatura', interno.voto_b64(r.assinatura),
      'guardias', (select jsonb_agg(jsonb_build_object('indice', g.i, 'usuario', g.u, 'nome', interno.voto_nome(r.tipo, g.u),
                     'voto', r.guardias_chaves -> (g.i::integer - 1) ->> 'voto', 'identidade', r.guardias_chaves -> (g.i::integer - 1) ->> 'identidade',
                     'assinatura', r.guardias_chaves -> (g.i::integer - 1) ->> 'assinatura') order by g.i)
                   from unnest(r.guardias) with ordinality as g(u, i))),
    'situacao', v_sit, 'possoCriar', false, 'possoGuardar', interno.voto_pode_guardar(p_tipo, p_alvo, v),
    'apurada', r.apurada, 'abridora', r.abridora,
    'entregues', case when v_sit = 'fechada' then (select count(*) from rede_consulta_aberturas a where a.consulta = r.consulta) end,
    'meuIndice', interno.voto_meu_indice(r, v),
    'entreguei', exists (select 1 from rede_consulta_aberturas a where a.consulta = r.consulta and a.indice = interno.voto_meu_indice(r, v)),
    'cedulas', case when v_sit = 'fechada' and not r.apurada then
      (case r.tipo when 'consulta' then (select count(*) from rede_consulta_cifradas where consulta = r.consulta)
                   when 'decisao' then (select count(*) from alumia_decisao_cifradas where decisao = r.consulta)
                   else (select count(*) from votacao_cifradas where votacao = r.consulta) end) > 0 end);
end $$;

-- ── 5. Abrir a urna ───────────────────────────────────────────────────────────────────────────────────────────────────────

/** A guardiã de uma votação, com o registro dela; recusa quem não é. */
create or replace function interno.voto_guardia(p_tipo text, p_alvo uuid, p_quem uuid) returns interno.rede_consulta_chaves language plpgsql stable security definer set search_path = interno, pg_temp as $$
declare r rede_consulta_chaves;
begin
  if p_tipo is null or p_tipo not in ('consulta', 'decisao', 'equipe') then perform interno.erro('invalido:tipo'); end if;
  select * into r from rede_consulta_chaves where consulta = p_alvo and tipo = p_tipo;
  if not found or interno.voto_meu_indice(r, p_quem) is null then perform interno.erro('sem_permissao'); end if;
  return r;
end $$;

/** A parte desta guardiã (cifrada para a chave de voto dela): para conferir que abre e, depois de fechada, repassar. */
create or replace function public.rede_voto_minha_parte(p_tipo text, p_alvo uuid) returns jsonb language plpgsql stable security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); r rede_consulta_chaves := interno.voto_guardia(p_tipo, p_alvo, v); i smallint := interno.voto_meu_indice(r, v);
begin
  if r.apurada then return jsonb_build_object('indice', i, 'parte', null); end if;
  return jsonb_build_object('indice', i, 'parte', r.partes ->> (i - 1));
end $$;

/**
 * Começa a abrir a urna de uma votação fechada: a primeira guardiã que pede vira a abridora. Se a abridora sumiu (dois dias sem
 * apurar), outra guardiã assume, e as partes repassadas à de antes são apagadas (estavam cifradas para ela). Devolve o número
 * da abridora e a chave de voto dela, como estava no registro assinado (não a do diretório de hoje).
 */
create or replace function public.rede_voto_abrir(p_tipo text, p_alvo uuid) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); r rede_consulta_chaves := interno.voto_guardia(p_tipo, p_alvo, v); i smallint := interno.voto_meu_indice(r, v);
begin
  perform interno.limite('rede_voto_abrir', 20, 60);
  perform pg_advisory_xact_lock(hashtextextended('alumia_voto_chave:' || r.consulta::text, 0));
  select * into r from rede_consulta_chaves where consulta = r.consulta;
  if interno.voto_situacao(r.tipo, r.consulta) <> 'fechada' then perform interno.erro('aberta'); end if;
  if r.apurada then perform interno.erro('apurada'); end if;
  if r.abridora is null or (r.abridora <> i and r.abridora_dia < current_date - 2) then
    delete from rede_consulta_aberturas where consulta = r.consulta;
    update rede_consulta_chaves set abridora = i, abridora_dia = current_date where consulta = r.consulta returning * into r;
  end if;
  return jsonb_build_object('abridora', r.abridora, 'voto', r.guardias_chaves -> (r.abridora - 1) ->> 'voto', 'eu', r.abridora = i);
end $$;

/** A guardiã repassa a parte dela à abridora (cifrada para a chave de voto da abridora). Uma vez por guardiã. */
create or replace function public.rede_voto_parte_entregar(p_tipo text, p_alvo uuid, p_parte text) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); r rede_consulta_chaves := interno.voto_guardia(p_tipo, p_alvo, v); i smallint := interno.voto_meu_indice(r, v);
  v_parte bytea := interno.voto_bytes(p_parte);
begin
  perform interno.limite('rede_voto_parte_entregar', 20, 60);
  if interno.voto_situacao(r.tipo, r.consulta) <> 'fechada' then perform interno.erro('aberta'); end if;
  if r.apurada then perform interno.erro('apurada'); end if;
  if r.abridora is null then perform interno.erro('sem_abridora'); end if;
  if octet_length(v_parte) is distinct from 1193 then perform interno.erro('invalido:parte'); end if;
  insert into rede_consulta_aberturas (consulta, indice, parte) values (r.consulta, i, v_parte) on conflict do nothing;
  if not found then perform interno.erro('ja_entregue'); end if;
  return jsonb_build_object('ok', true, 'entregues', (select count(*) from rede_consulta_aberturas a where a.consulta = r.consulta));
end $$;

/**
 * Para a abridora: as partes repassadas e as cédulas cifradas, só com K partes ou mais (antes disso, só quantas chegaram), e as
 * opções (para a tela conferir as escolhas antes de mandar).
 */
create or replace function public.rede_voto_urna(p_tipo text, p_alvo uuid) returns jsonb language plpgsql stable security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); r rede_consulta_chaves := interno.voto_guardia(p_tipo, p_alvo, v); v_n integer;
begin
  if interno.voto_situacao(r.tipo, r.consulta) <> 'fechada' then perform interno.erro('aberta'); end if;
  if r.apurada then perform interno.erro('apurada'); end if;
  if r.abridora is distinct from interno.voto_meu_indice(r, v) then perform interno.erro('sem_permissao'); end if;
  select count(*) into v_n from rede_consulta_aberturas where consulta = r.consulta;
  if v_n < r.k then return jsonb_build_object('entregues', v_n, 'k', r.k); end if;
  return jsonb_build_object('entregues', v_n, 'k', r.k,
    'partes', (select jsonb_agg(jsonb_build_object('indice', a.indice, 'parte', interno.voto_b64(a.parte)) order by a.indice) from rede_consulta_aberturas a where a.consulta = r.consulta),
    'cedulas', coalesce(case r.tipo
      when 'consulta' then (select jsonb_agg(x.cedula) from rede_consulta_cifradas x where x.consulta = r.consulta)
      when 'decisao' then (select jsonb_agg(x.cedula) from alumia_decisao_cifradas x where x.decisao = r.consulta)
      else (select jsonb_agg(x.cedula) from votacao_cifradas x where x.votacao = r.consulta) end, '[]'::jsonb),
    -- Quantas pessoas votaram: a abridora confere que não há mais cédulas que pessoas (urna "inchada" para; nada se apura).
    'votantes', case r.tipo
      when 'consulta' then (select count(*) from rede_consulta_votantes where consulta = r.consulta)
      when 'decisao' then (select count(*) from alumia_decisao_votantes where decisao = r.consulta)
      else (select count(*) from votacao_marcas where votacao = r.consulta) + (select count(*) from votacao_votantes where votacao = r.consulta) end,
    'metodo', case when r.tipo = 'consulta' then (select metodo from rede_consultas where id = r.consulta) end,
    'opcoes', case r.tipo
      when 'consulta' then (select jsonb_agg(o.id order by o.ordem) from rede_consulta_opcoes o where o.consulta = r.consulta)
      when 'decisao' then (select jsonb_agg(o.id order by o.ordem) from alumia_decisao_opcoes o where o.decisao = r.consulta)
      else (select jsonb_agg(o.i - 1 order by o.i) from votacoes x, unnest(x.opcoes) with ordinality as o(t, i) where x.id = r.consulta) end);
end $$;

/**
 * A abridora manda as escolhas abertas no aparelho dela, embaralhadas, num lote só, com quantas cédulas havia. O banco descarta o
 * que não vale (conta como nula), põe o resto na urna de cédulas abertas num INSERT só em ordem sorteada, e apaga as cifradas, as
 * partes repassadas e as partes do registro. Mandar mais escolhas que cédulas é recusado.
 */
create or replace function public.rede_voto_apurar(p_tipo text, p_alvo uuid, p_escolhas jsonb, p_quantas integer) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare
  v uuid := interno.eu(); r rede_consulta_chaves := interno.voto_guardia(p_tipo, p_alvo, v); c rede_consultas; x votacoes;
  v_tem integer; v_opcoes uuid[]; v_lista jsonb := '[]'::jsonb; e jsonb; v_r uuid[]; v_o uuid; v_e smallint; v_ok integer := 0; v_nulas integer := 0;
begin
  perform pg_advisory_xact_lock(hashtextextended('alumia_voto_chave:' || r.consulta::text, 0));
  select * into r from rede_consulta_chaves where consulta = r.consulta;
  if interno.voto_situacao(r.tipo, r.consulta) <> 'fechada' then perform interno.erro('aberta'); end if;
  if r.apurada then perform interno.erro('apurada'); end if;
  if r.abridora is distinct from interno.voto_meu_indice(r, v) then perform interno.erro('sem_permissao'); end if;
  if (select count(*) from rede_consulta_aberturas where consulta = r.consulta) < r.k then perform interno.erro('faltam_partes'); end if;
  v_tem := case r.tipo
    when 'consulta' then (select count(*) from rede_consulta_cifradas where consulta = r.consulta)
    when 'decisao' then (select count(*) from alumia_decisao_cifradas where decisao = r.consulta)
    else (select count(*) from votacao_cifradas where votacao = r.consulta) end;
  if p_quantas is distinct from v_tem or jsonb_typeof(p_escolhas) is distinct from 'array' or jsonb_array_length(p_escolhas) > v_tem then
    perform interno.erro('invalido:apuracao');
  end if;

  if r.tipo = 'consulta' then
    select * into c from rede_consultas where id = r.consulta;
    perform pg_advisory_xact_lock(hashtextextended('alumia_urna:' || c.id::text, 0));
    select array_agg(id) into v_opcoes from rede_consulta_opcoes where consulta = c.id;
    for e in select value from jsonb_array_elements(p_escolhas) loop
      begin
        if jsonb_typeof(e) <> 'array' then raise exception 'nula'; end if;
        select array_agg(y::uuid order by n) into v_r from jsonb_array_elements_text(e) with ordinality as t(y, n);
        if v_r is null or cardinality(v_r) = 0 or cardinality(v_r) > cardinality(v_opcoes) or cardinality(v_r) > 8
           or (c.metodo = 'simples' and cardinality(v_r) <> 1)
           or exists (select 1 from unnest(v_r) y where y is null or not y = any (v_opcoes))
           or (select count(distinct y) from unnest(v_r) y) <> cardinality(v_r) then
          raise exception 'nula';
        end if;
        v_lista := v_lista || jsonb_build_array(to_jsonb(v_r));
        v_ok := v_ok + 1;
      exception when others then
        v_nulas := v_nulas + 1;
      end;
    end loop;
    with velhas as (delete from rede_consulta_cedulas where consulta = c.id returning ranking)
    insert into rede_consulta_cedulas (consulta, ranking)
    select c.id, t.r from (
      select ranking as r from velhas
      union all
      select array(select y.v::uuid from jsonb_array_elements_text(z.value) with ordinality as y(v, n) order by y.n) from jsonb_array_elements(v_lista) z
    ) t order by gen_random_uuid();
    delete from rede_consulta_cifradas where consulta = c.id;
    -- Se a consulta é de uma eleição, ela é apurada agora (esperava a urna aberta).
    perform interno.alumia_eleicao_avancar(el.id) from rede_org_eleicoes el where el.consulta = c.id and el.situacao = 'votacao';

  elsif r.tipo = 'decisao' then
    perform pg_advisory_xact_lock(hashtextextended('alumia_decisao:' || r.consulta::text, 0));
    select array_agg(id) into v_opcoes from alumia_decisao_opcoes where decisao = r.consulta;
    for e in select value from jsonb_array_elements(p_escolhas) loop
      begin
        if jsonb_typeof(e) <> 'array' or jsonb_array_length(e) <> 1 then raise exception 'nula'; end if;
        v_o := (e ->> 0)::uuid;
        if v_o is null or not v_o = any (v_opcoes) then raise exception 'nula'; end if;
        v_lista := v_lista || to_jsonb(v_o);
        v_ok := v_ok + 1;
      exception when others then
        v_nulas := v_nulas + 1;
      end;
    end loop;
    with velhas as (delete from alumia_decisao_cedulas where decisao = r.consulta returning opcao)
    insert into alumia_decisao_cedulas (decisao, opcao)
    select r.consulta, t.o from (select opcao as o from velhas union all select (z #>> '{}')::uuid from jsonb_array_elements(v_lista) z) t order by gen_random_uuid();
    delete from alumia_decisao_cifradas where decisao = r.consulta;

  else
    select * into x from votacoes where id = r.consulta;
    perform pg_advisory_xact_lock(hashtextextended('votacao_urna:' || x.id::text, 0));
    for e in select value from jsonb_array_elements(p_escolhas) loop
      begin
        if jsonb_typeof(e) <> 'array' or jsonb_array_length(e) <> 1 or jsonb_typeof(e -> 0) <> 'number' then raise exception 'nula'; end if;
        v_e := (e ->> 0)::smallint;
        if v_e is null or v_e < 0 or v_e >= cardinality(x.opcoes) or (e ->> 0) !~ '^[0-9]$' then raise exception 'nula'; end if;
        v_lista := v_lista || to_jsonb(v_e);
        v_ok := v_ok + 1;
      exception when others then
        v_nulas := v_nulas + 1;
      end;
    end loop;
    with velhos as (delete from votacao_votos where votacao = x.id and usuario is null returning opcao)
    insert into votacao_votos (votacao, opcao)
    select x.id, t.o from (select opcao as o from velhos union all select (z #>> '{}')::smallint from jsonb_array_elements(v_lista) z) t order by gen_random_uuid();
    delete from votacao_cifradas where votacao = x.id;
  end if;

  v_nulas := v_nulas + (v_tem - jsonb_array_length(p_escolhas));
  delete from rede_consulta_aberturas where consulta = r.consulta;
  update rede_consulta_chaves set apurada = true, partes = '[]'::jsonb where consulta = r.consulta;
  return jsonb_build_object('apuradas', v_ok, 'nulas', v_nulas);
end $$;

-- ── 6. As urnas cifradas, com o resumo ────────────────────────────────────────────────────────────────────────────────────

/** A cédula nova: "v2." e 2230 letras de base64url (1672 bytes: X-Wing, nonce e cifra de 512 + 16). */
create or replace function interno.voto_cedula_valida(p text) returns boolean language sql immutable as $$
  -- (o Postgres não aceita repetição acima de 255 na expressão: o tamanho vai à parte)
  select p is not null and char_length(p) = 2233 and p ~ '^v2\.[A-Za-z0-9_-]+$'
$$;

CREATE OR REPLACE FUNCTION interno.alumia_urna_cifrada(p_consulta uuid, p_cedula text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'interno', 'pg_temp'
AS $function$
begin
  -- A mesma cédula duas vezes (copiada ou reenviada) não entra.
  if exists (select 1 from rede_consulta_cifradas where consulta = p_consulta and resumo = sha256(convert_to(p_cedula, 'UTF8'))) then
    perform interno.erro('cedula_repetida');
  end if;
  with velhas as (
    delete from rede_consulta_cifradas
    where consulta = p_consulta
      and ctid = any (array(select ctid from rede_consulta_cifradas where consulta = p_consulta order by gen_random_uuid() limit 2000))
    returning cedula, resumo)
  insert into rede_consulta_cifradas (consulta, cedula, resumo)
  select p_consulta, t.c, t.r from (select cedula as c, resumo as r from velhas union all select p_cedula, sha256(convert_to(p_cedula, 'UTF8'))) t order by gen_random_uuid();
end $function$;

CREATE OR REPLACE FUNCTION interno.alumia_dec_urna_cifrada(p_decisao uuid, p_cedula text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'interno', 'pg_temp'
AS $function$
begin
  if exists (select 1 from alumia_decisao_cifradas where decisao = p_decisao and resumo = sha256(convert_to(p_cedula, 'UTF8'))) then
    perform interno.erro('cedula_repetida');
  end if;
  with velhas as (
    delete from alumia_decisao_cifradas
    where decisao = p_decisao
      and ctid = any (array(select ctid from alumia_decisao_cifradas where decisao = p_decisao order by gen_random_uuid() limit 2000))
    returning cedula, resumo)
  insert into alumia_decisao_cifradas (decisao, cedula, resumo)
  select p_decisao, t.c, t.r from (select cedula as c, resumo as r from velhas union all select p_cedula, sha256(convert_to(p_cedula, 'UTF8'))) t order by gen_random_uuid();
end $function$;

create or replace function interno.votacao_urna_cifrada(p_votacao uuid, p_cedula text) returns void language plpgsql security definer set search_path = interno, pg_temp as $$
begin
  if exists (select 1 from votacao_cifradas where votacao = p_votacao and resumo = sha256(convert_to(p_cedula, 'UTF8'))) then
    perform interno.erro('cedula_repetida');
  end if;
  with velhas as (
    delete from votacao_cifradas
    where votacao = p_votacao
      and ctid = any (array(select ctid from votacao_cifradas where votacao = p_votacao order by gen_random_uuid() limit 2000))
    returning cedula, resumo)
  insert into votacao_cifradas (votacao, cedula, resumo)
  select p_votacao, t.c, t.r from (select cedula as c, resumo as r from velhas union all select p_cedula, sha256(convert_to(p_cedula, 'UTF8'))) t order by gen_random_uuid();
end $$;

-- ── 7. Os votos ───────────────────────────────────────────────────────────────────────────────────────────────────────────

-- A consulta à base: só cifrada, com a chave das guardiãs. O voto às claras (o caminho "sem serviço" de antes) sai.
CREATE OR REPLACE FUNCTION public.rede_org_consulta_votar(p_consulta uuid, p_ranking uuid[])
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'interno', 'pg_temp'
AS $function$
begin
  -- O voto da consulta à base é sempre cifrado no aparelho, para a chave das guardiãs (public.rede_org_consulta_votar_cifrada).
  perform interno.erro('voto_cifrado');
  return null;
end
$function$;

CREATE OR REPLACE FUNCTION public.rede_org_consulta_votar_cifrada(p_consulta uuid, p_cedula text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'interno', 'pg_temp'
AS $function$
declare v uuid := interno.eu(); c rede_consultas;
begin
  perform interno.rede3_perfil_exige_membro(v);
  select * into c from rede_consultas where id = p_consulta;
  if not found or interno.rede_bloqueado(v, c.org) then perform interno.erro('nao_encontrado'); end if;
  if c.prazo <= now() then perform interno.erro('consulta_fechada'); end if;
  if not interno.voto_consulta_elegivel(v, c.id) then perform interno.erro('sem_permissao'); end if;
  if not exists (select 1 from rede_consulta_chaves k where k.consulta = c.id and k.tipo = 'consulta') then perform interno.erro('sem_chave'); end if;
  if not interno.voto_cedula_valida(p_cedula) then perform interno.erro('invalido:cedula'); end if;
  perform interno.limite('alumia_org_votar', 30, 60);
  perform pg_advisory_xact_lock(hashtextextended('alumia_urna:' || c.id::text, 0));
  insert into rede_consulta_votantes (consulta, usuario) values (c.id, v) on conflict do nothing;
  if not found then perform interno.erro('ja_votou'); end if;
  perform interno.alumia_urna_cifrada(c.id, p_cedula);
  return jsonb_build_object('votei', true);
end
$function$;

-- A votação da comunidade: a secreta só cifrada; a aberta (com o nome) como antes.
CREATE OR REPLACE FUNCTION public.alumia_decisao_votar(p_id uuid, p_opcao uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'interno', 'pg_temp'
AS $function$
declare v uuid := interno.eu(); d alumia_decisoes;
begin
  d := interno.alumia_dec_antes_de_votar(p_id, v);
  -- A secreta é sempre cifrada no aparelho, para a chave das guardiãs (public.alumia_decisao_votar_cifrada).
  if d.modo <> 'aberta' then perform interno.erro('voto_cifrado'); end if;
  if p_opcao is null or not exists (select 1 from alumia_decisao_opcoes o where o.id = p_opcao and o.decisao = d.id) then
    perform interno.erro('invalido:opcao');
  end if;
  insert into alumia_decisao_votantes (decisao, usuario) values (d.id, v) on conflict do nothing;
  if not found then perform interno.erro('ja_votou'); end if;
  insert into alumia_decisao_abertos (decisao, opcao, usuario) values (d.id, p_opcao, v);
  return jsonb_build_object('votei', true);
end
$function$;

CREATE OR REPLACE FUNCTION public.alumia_decisao_votar_cifrada(p_id uuid, p_cedula text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'interno', 'pg_temp'
AS $function$
declare v uuid := interno.eu(); d alumia_decisoes;
begin
  d := interno.alumia_dec_antes_de_votar(p_id, v);
  if d.modo <> 'secreta' then perform interno.erro('invalido:modo'); end if;
  if not exists (select 1 from rede_consulta_chaves k where k.consulta = d.id and k.tipo = 'decisao') then perform interno.erro('sem_chave'); end if;
  if not interno.voto_cedula_valida(p_cedula) then perform interno.erro('invalido:cedula'); end if;
  insert into alumia_decisao_votantes (decisao, usuario) values (d.id, v) on conflict do nothing;
  if not found then perform interno.erro('ja_votou'); end if;
  perform interno.alumia_dec_urna_cifrada(d.id, p_cedula);
  return jsonb_build_object('votei', true);
end
$function$;

/**
 * O voto secreto da equipe, cifrado no aparelho. Chega pelo servidor do site (app/api/alumia/voto/marca), que confere a sessão e
 * calcula a marca de "já votou" (HMAC com ALUMIA_VOTO_SEGREDO): o banco grava a marca, nunca a pessoa; o servidor vê só a cédula
 * cifrada, que ele não abre.
 */
create or replace function public.alumia_voto_equipe_cifrada(p_usuario uuid, p_votacao uuid, p_cedula text, p_marca text) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare x votacoes;
begin
  if not interno.servico() then perform interno.erro('sem_permissao'); end if;
  if p_marca is null or p_marca !~ '^[0-9a-f]{64}$' then perform interno.erro('invalido:marca'); end if;
  if p_usuario is null or exists (select 1 from perfis where id = p_usuario and suspenso) then perform interno.erro('sem_permissao'); end if;
  select * into x from votacoes where id = p_votacao;
  if not found or not x.secreta then perform interno.erro('nao_encontrado'); end if;
  if x.encerrada_em is not null or x.encerra_em <= now() then perform interno.erro('encerrada'); end if;
  if not interno.vota_em(x, p_usuario) then perform interno.erro('sem_permissao'); end if;
  if not exists (select 1 from rede_consulta_chaves k where k.consulta = x.id and k.tipo = 'equipe') then perform interno.erro('sem_chave'); end if;
  if not interno.voto_cedula_valida(p_cedula) then perform interno.erro('invalido:cedula'); end if;
  perform pg_advisory_xact_lock(hashtextextended('votacao_urna:' || x.id::text, 0));
  if exists (select 1 from votacao_votantes p where p.votacao = x.id and p.usuario = p_usuario) then perform interno.erro('ja_votou'); end if;
  insert into votacao_marcas (votacao, marca) values (x.id, p_marca) on conflict do nothing;
  if not found then perform interno.erro('ja_votou'); end if;
  perform interno.votacao_urna_cifrada(x.id, p_cedula);
  return jsonb_build_object('ok', true);
end $$;

-- A votação da equipe na tela: mais "chave" (tem a chave das guardiãs) e "apurar" (fechada com cédula cifrada esperando).
CREATE OR REPLACE FUNCTION interno.votacao_json(v interno.votacoes)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'interno', 'pg_temp'
AS $function$
  select jsonb_build_object('id', v.id, 'titulo', v.titulo, 'descricao', v.descricao, 'opcoes', to_jsonb(v.opcoes), 'departamento', v.departamento, 'secreta', v.secreta,
    'encerra_em', v.encerra_em, 'terminou_em', least(coalesce(v.encerrada_em, v.encerra_em), v.encerra_em), 'encerrada', v.encerrada_em is not null or v.encerra_em <= now(), 'criado_em', v.criado_em,
    'criada_por', coalesce((select interno.nome_visto(nome) from perfis where id = v.criada_por), ''),
    'minha', v.criada_por = auth.uid(),
    'posso_votar', interno.vota_em(v, auth.uid()),
    'votei', auth.uid() is not null and exists (select 1 from votacao_votantes p where p.votacao = v.id and p.usuario = auth.uid()),
    'votantes', (select count(*) from votacao_votantes p where p.votacao = v.id) + (select count(*) from votacao_marcas m where m.votacao = v.id),
    'aptos', (select count(*) from perfis f where interno.vota_em(v, f.id)),
    'chave', v.secreta and exists (select 1 from rede_consulta_chaves k where k.consulta = v.id and k.tipo = 'equipe'),
    'apurar', v.secreta and (v.encerrada_em is not null or v.encerra_em <= now()) and exists (select 1 from votacao_cifradas c where c.votacao = v.id),
    'resultado', case when (v.encerrada_em is not null or v.encerra_em <= now())
                        and not exists (select 1 from votacao_cifradas c where c.votacao = v.id)
                        and (not v.secreta or (select count(*) from votacao_votos w where w.votacao = v.id) >= 3) then
      (select jsonb_agg(jsonb_build_object('opcao', o.i - 1, 'texto', o.t, 'votos', (select count(*) from votacao_votos w where w.votacao = v.id and w.opcao = o.i - 1),
         'quem', case when not v.secreta then (select coalesce(jsonb_agg(interno.nome_visto(f.nome) order by f.nome), '[]'::jsonb) from votacao_votos w join perfis f on f.id = w.usuario where w.votacao = v.id and w.opcao = o.i - 1) end)
         order by o.i)
       from unnest(v.opcoes) with ordinality as o(t, i)) end)
$function$;

-- A eleição (que é uma consulta) espera a urna aberta pelas guardiãs para apurar.
CREATE OR REPLACE FUNCTION interno.alumia_eleicao_avancar(p_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'interno', 'pg_temp'
AS $function$
declare e rede_org_eleicoes; f rede_org_funcoes; v_c uuid; c record; i integer := 0; v_votantes integer; v_ap jsonb; v_venc uuid; v_pessoa uuid; v_m uuid;
begin
  select * into e from rede_org_eleicoes where id = p_id for update;
  if not found then return; end if;
  select * into f from rede_org_funcoes where id = e.funcao;
  if e.situacao = 'inscricoes' and now() >= e.inscricoes_ate then
    if not exists (select 1 from rede_org_eleicao_candidatos where eleicao = e.id) then
      update rede_org_eleicoes set situacao = 'vazia' where id = e.id;
      return;
    end if;
    insert into rede_consultas (org, nucleos, pergunta, metodo, quorum, prazo, compromisso, eleicao)
    values (e.org, '{}', left(format('Eleição: %s', f.nome), 280), 'ranqueada', e.quorum, e.prazo,
            left(format('Quem vencer ocupa a função “%s” até %s. Se “Reabrir a eleição” vencer, ninguém assume e a eleição é marcada de novo.', f.nome, to_char(e.mandato_fim, 'DD/MM/YYYY')), 500), e.id)
    returning id into v_c;
    for c in select k.pessoa, coalesce(nullif(p.rede_codinome, ''), p.rede_handle) as nome from rede_org_eleicao_candidatos k join perfis p on p.id = k.pessoa
             where k.eleicao = e.id and not p.suspenso order by lower(coalesce(nullif(p.rede_codinome, ''), p.rede_handle)) limit 7 loop
      i := i + 1;
      insert into rede_consulta_opcoes (consulta, ordem, texto) values (v_c, i, left(c.nome, 120)) returning id into v_m;
      update rede_org_eleicao_candidatos set opcao = v_m where eleicao = e.id and pessoa = c.pessoa;
    end loop;
    insert into rede_consulta_opcoes (consulta, ordem, texto) values (v_c, i + 1, 'Reabrir a eleição');
    update rede_org_eleicoes set situacao = 'votacao', consulta = v_c where id = e.id;
    return;
  end if;
  if e.situacao = 'votacao' and now() >= e.prazo and e.consulta is not null then
    select count(*) into v_votantes from rede_consulta_votantes where consulta = e.consulta;
    if v_votantes < 3 or (e.quorum is not null and v_votantes < e.quorum) then
      update rede_org_eleicoes set situacao = 'sem_quorum' where id = e.id;
      return;
    end if;
    -- R2 (voto em limiar): com cédula cifrada ainda fechada, a eleição espera as guardiãs abrirem a urna (public.rede_voto_apurar
    -- chama esta função de novo logo depois). Antes, contava a urna vazia e decidia sem os votos.
    if exists (select 1 from rede_consulta_cifradas x where x.consulta = e.consulta) then return; end if;
    v_ap := interno.alumia_apurar(e.consulta);
    v_venc := nullif(v_ap ->> 'vencedora', '')::uuid;
    select k.pessoa into v_pessoa from rede_org_eleicao_candidatos k where k.eleicao = e.id and k.opcao = v_venc;
    if v_pessoa is not null and interno.rede2_membro(v_pessoa) and not exists (select 1 from perfis where id = v_pessoa and suspenso) then
      update rede_org_mandatos set encerrado_dia = current_date where funcao = e.funcao and pessoa = v_pessoa and encerrado_dia is null;
      insert into rede_org_mandatos (funcao, pessoa, fim, origem) values (e.funcao, v_pessoa, greatest(e.mandato_fim, current_date), 'eleicao') returning id into v_m;
      update rede_org_eleicoes set situacao = 'apurada', eleito = v_m where id = e.id;
      perform interno.avisar_em(v_pessoa, format('Você foi eleita para a função “%s” em “%s”, até %s.', f.nome, interno.rede_nome(e.org), to_char(e.mandato_fim, 'DD/MM/YYYY')), 'rede');
    else
      update rede_org_eleicoes set situacao = 'apurada' where id = e.id;
    end if;
  end if;
end $function$;

-- ── 8. O que sai: o servidor não abre mais cédula nenhuma ─────────────────────────────────────────────────────────────────
drop function if exists public.alumia_voto_cifradas(uuid);
drop function if exists public.alumia_voto_apurar(uuid, jsonb, integer);
drop function if exists public.alumia_decisao_cifradas(uuid);
drop function if exists public.alumia_decisao_apurar(uuid, jsonb, integer);
drop function if exists public.alumia_voto_equipe(uuid, uuid, integer, text);

-- ── 9. Permissões ─────────────────────────────────────────────────────────────────────────────────────────────────────────
do $$
declare f text;
begin
  -- As de dentro do banco: ninguém de fora chama.
  foreach f in array array['voto_chave_some()', 'voto_b64(bytea)', 'voto_bytes(text)', 'voto_situacao(text, uuid)', 'voto_tem_votos(text, uuid)',
                           'voto_pode_guardar(text, uuid, uuid)', 'voto_pode_criar(text, uuid, uuid)', 'voto_pode_ver(text, uuid, uuid)',
                           'voto_nome(text, uuid)', 'voto_meu_indice(interno.rede_consulta_chaves, uuid)', 'voto_consulta_elegivel(uuid, uuid)',
                           'voto_guardia(text, uuid, uuid)', 'voto_cedula_valida(text)', 'alumia_urna_cifrada(uuid, text)',
                           'alumia_dec_urna_cifrada(uuid, text)', 'votacao_urna_cifrada(uuid, text)', 'votacao_json(interno.votacoes)'] loop
    execute format('revoke all on function interno.%s from public', f);
    if exists (select 1 from pg_roles where rolname = 'anon') then
      execute format('revoke all on function interno.%s from anon, authenticated', f);
    end if;
  end loop;
  -- Só o servidor do site (a chave de serviço).
  execute 'revoke all on function public.alumia_voto_equipe_cifrada(uuid, uuid, text, text) from public';
  if exists (select 1 from pg_roles where rolname = 'anon') then
    execute 'revoke all on function public.alumia_voto_equipe_cifrada(uuid, uuid, text, text) from anon, authenticated';
  end if;
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    execute 'grant execute on function public.alumia_voto_equipe_cifrada(uuid, uuid, text, text) to service_role';
  end if;
  -- Com a sessão da conta (passam pela porta).
  foreach f in array array['rede_voto_minha_chave(jsonb)', 'rede_voto_minha_chave_ler()', 'rede_voto_guardias_possiveis(text, uuid)',
                           'rede_voto_chave_publicar(jsonb)', 'rede_voto_chave(text, uuid)', 'rede_voto_minha_parte(text, uuid)',
                           'rede_voto_abrir(text, uuid)', 'rede_voto_parte_entregar(text, uuid, text)', 'rede_voto_urna(text, uuid)',
                           'rede_voto_apurar(text, uuid, jsonb, integer)'] loop
    execute format('revoke all on function public.%s from public', f);
    if exists (select 1 from pg_roles where rolname = 'anon') then
      execute format('revoke all on function public.%s from anon', f);
      execute format('grant execute on function public.%s to authenticated', f);
    end if;
  end loop;
end $$;

-- ── 10. A limpeza das urnas ganha as tabelas novas ────────────────────────────────────────────────────────────────────────
do $$
declare v_tabelas text;
begin
  select string_agg(format('interno.%I', t), ', ' order by t) into v_tabelas
  from unnest(array['rede_consulta_cedulas', 'rede_consulta_cifradas', 'alumia_decisao_cedulas', 'alumia_decisao_cifradas', 'votacao_votos',
                    'votacao_cifradas', 'rede_consulta_aberturas', 'rede_consulta_chaves',
                    'rede_votos', 'rede_story_votos', 'bem_estar_urna', 'alumia_redacao_leituras', 'alumia_redacao_correcoes']) t
  where to_regclass('interno.' || t) is not null;
  if v_tabelas is null then return; end if;
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule('alumia-urnas-limpeza', '37 4 * * *', 'vacuum (full, analyze) ' || v_tabelas);
  end if;
exception when others then
  raise warning 'alumia-urnas-limpeza: a rotina não foi agendada (%). A limpeza das urnas fica para o "vacuum full" à mão.', sqlerrm;
end $$;

select interno.alumia_trancar();
