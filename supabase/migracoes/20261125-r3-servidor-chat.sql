-- Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
--
-- ═══════════════════════ Alumia · Reforço 3 · O chat separado: passes por RSA cego e o endereço do servidor do chat (25/11/2026) ═══════════════════════
-- Migração acrescentável: pode rodar mais de uma vez. Roda depois de 20261125-r3-sem-internet-formal.sql e antes de 20261125-r3-fim.sql
-- (ordem do desenho da R3). Teste: scripts/testar-r3-passes.mjs (a migração duas vezes sobre o install.sql; os ataques escritos como
-- teste) e scripts/testar-r2-caixas-cliente.mjs (o caminho inteiro dos passes pelas rotas).
--
-- O que entra:
-- 1. Os passes anônimos passam de VOPRF (verificação privada: só quem tem o segredo confere) para RSA CEGO (RFC 9474 / RFC 9578, tipo
--    0x0002: qualquer um confere com a chave PÚBLICA). Assim o servidor do chat, quando sair do Supabase da rede, confere passes sem ter
--    segredo nenhum da rede social. A chave do emissor é da SEMANA (semanas desde 1970) e nasce no servidor do site na primeira emissão
--    da semana; a privada fica aqui SELADA com o segredo dos passes do servidor do site (quem copia o banco não emite passe), a pública
--    vai ao registro de transparência (linha 'passes-rsa'), uma por semana: o aparelho só pede passes com a chave anotada lá.
-- 2. O passe "com contexto" (a urna anônima da R3): uma chave por contexto (semana 0), também no registro, e uma marca por conta e por
--    contexto (HMAC do servidor do site: o banco não sabe de quem é). A chave é do contexto, e não da semana, porque na emissão cega o
--    servidor não vê o desafio: com a chave da semana, quem tem 30 passes gerais faria 30 passes "da urna". Só recebe quem vota na
--    votação aberta (interno.voto_situacao e interno.voto_pode_ver, da R2): public.rede_passes_contexto_pode e _marcar, com a porta.
-- 3. O endereço do servidor do chat separado entra no registro de transparência (linha 'servidor-chat'): o aparelho recusa servidor de
--    chat que não esteja lá. Só o dono do banco anota (interno.rede_servidor_chat_registrar, sem execute para ninguém).
-- 4. A limpeza: chave privada de semana velha SAI do banco (quem tomar o banco depois não emite passe de semana passada); marcas de
--    contexto com mais de 180 dias saem.
-- Endereço de rede: nada daqui lê ou guarda. Nenhum número de pessoas.
-- Leis: LGPD art. 6º, III (necessidade: a chave e a marca não dizem de quem é o passe), art. 46 (segurança: a privada selada, a velha
-- apagada); Marco Civil art. 10 (sigilo das comunicações privadas: o servidor do chat confere passes sem nada da rede social).

-- ── 1. Tabelas ─────────────────────────────────────────────────────────────────────────────────────────────────────────────

/**
 * A chave RSA cega da semana dos passes anônimos (e a do passe da urna de cada votação): a pública e a privada selada com o segredo do
 * servidor do site, que sai do banco quando a semana fica velha. Nenhuma conta.
 */
create table if not exists interno.passes_chaves (
  semana integer not null check (semana >= 0),
  -- Vazio: a chave geral da semana. 32 bytes: a chave de um contexto (semana 0).
  contexto bytea not null default ''::bytea check (octet_length(contexto) in (0, 32)),
  -- SPKI da chave pública RSA-PSS (o formato do RFC 9578; o id da chave é o SHA-256 disto).
  publica bytea not null check (octet_length(publica) between 290 and 600),
  -- versão(1) ‖ nonce(24) ‖ XChaCha20-Poly1305(pkcs8 da privada), com a chave tirada do segredo dos passes do servidor do site.
  -- Nula depois da limpeza (a pública fica, para conferir passes da semana anterior até ela sair também).
  privada_selada bytea check (privada_selada is null or octet_length(privada_selada) between 1000 and 4000),
  criada_dia date not null,
  primary key (semana, contexto),
  check ((octet_length(contexto) = 0 and semana > 0) or (octet_length(contexto) = 32 and semana = 0))
);

/** A marca de que uma conta já pegou o passe de um contexto (a urna de uma votação): HMAC do servidor do site, sem a conta. Sai em 180 dias. */
create table if not exists interno.passes_emitidos_contexto (
  marca bytea primary key check (octet_length(marca) = 32),
  dia date not null
);

alter table interno.passes_chaves enable row level security;
alter table interno.passes_emitidos_contexto enable row level security;
revoke all on interno.passes_chaves, interno.passes_emitidos_contexto from public;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on interno.passes_chaves, interno.passes_emitidos_contexto from anon, authenticated;
  end if;
end $$;

-- O registro de transparência ganha os tipos 'passes-rsa' (a chave dos passes da semana ou do contexto) e 'servidor-chat' (o endereço
-- do servidor do chat separado). A regra continua com o MESMO NOME da R2 (rede_kt_tipo_r2), agora com a lista inteira: assim, quando o
-- install.sql roda de novo, o trecho da R2 ("se não existe, cria") vê a regra e não volta à lista curta (que recusaria as linhas novas).
do $$
begin
  if not exists (select 1 from pg_constraint where conrelid = 'interno.rede_kt'::regclass and conname = 'rede_kt_tipo_r2'
                 and pg_get_constraintdef(oid) like '%servidor-chat%') then
    alter table interno.rede_kt drop constraint if exists rede_kt_tipo_r2;
    alter table interno.rede_kt add constraint rede_kt_tipo_r2
      check (tipo in ('olm', 'conta', 'aparelho', 'aparelho-fora', 'passes', 'passes-rsa', 'servidor-chat'));
  end if;
end $$;

-- ── 2. As peças de dentro ──────────────────────────────────────────────────────────────────────────────────────────────────

/** A semana de hoje: semanas inteiras desde 1970-01-01 (uma quinta-feira), em UTC. A mesma conta de lib/rede/passes/comum.ts. */
create or replace function interno.passes_semana_hoje() returns integer language sql stable set search_path = interno, pg_temp as $$
  select ((interno.caixa_hoje() - date '1970-01-01') / 7)::integer
$$;

/** O texto da linha do registro de uma chave: "p3:<semana>:<contexto em base64>:<SPKI em base64>" (contexto vazio = ""). */
create or replace function interno.passes_identidade(p_semana integer, p_contexto bytea, p_publica bytea) returns text language sql immutable set search_path = interno, pg_temp as $$
  select 'p3:' || p_semana || ':' || case when octet_length(p_contexto) = 0 then '' else interno.caixa_b64(p_contexto) end || ':' || interno.caixa_b64(p_publica)
$$;

-- ── 3. As chaves dos passes (só o servidor do site, com a chave de serviço) ────────────────────────────────────────────────

/**
 * A chave de uma semana (contexto vazio) ou de um contexto (semana 0): a pública, a privada selada (nula depois da limpeza) e a linha
 * do registro. Nula se ainda não há.
 */
create or replace function public.rede_passes_chave_ler(p_semana integer, p_contexto bytea) returns jsonb language plpgsql stable security definer set search_path = interno, pg_temp as $$
declare k passes_chaves; v_seq bigint;
begin
  if p_semana is null or p_contexto is null or octet_length(p_contexto) not in (0, 32) then perform interno.erro('invalido:chave'); end if;
  select * into k from passes_chaves where semana = p_semana and contexto = p_contexto;
  if not found then return null; end if;
  select seq into v_seq from rede_kt where tipo = 'passes-rsa' and identidade = interno.passes_identidade(k.semana, k.contexto, k.publica) order by seq limit 1;
  return jsonb_build_object('semana', k.semana, 'publica', interno.caixa_b64(k.publica),
    'privada_selada', case when k.privada_selada is null then null else interno.caixa_b64(k.privada_selada) end, 'seq', v_seq);
end $$;

/**
 * Guarda a chave nova de uma semana (só a de hoje, a de ontem ou a de amanhã, pelo relógio do banco) ou de um contexto, e a anota no
 * registro de transparência. Se já há chave para a semana (outro processo do site chegou antes), NÃO troca: devolve a que está, e o
 * site usa essa. Uma chave por semana: o servidor não consegue dar uma chave a cada pessoa sem que o registro mostre.
 */
create or replace function public.rede_passes_chave_guardar(p_semana integer, p_contexto bytea, p_publica bytea, p_privada_selada bytea) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v_semana integer := interno.passes_semana_hoje(); v_quem text := encode(sha256(convert_to('alumia-kt:passes', 'UTF8')), 'base64');
begin
  if p_semana is null or p_contexto is null or octet_length(p_contexto) not in (0, 32)
     or (octet_length(p_contexto) = 0 and p_semana not between v_semana - 1 and v_semana + 1)
     or (octet_length(p_contexto) = 32 and p_semana <> 0)
     or coalesce(octet_length(p_publica), 0) not between 290 and 600
     or coalesce(octet_length(p_privada_selada), 0) not between 1000 and 4000 then
    perform interno.erro('invalido:chave');
  end if;
  perform pg_advisory_xact_lock(hashtext('rede_kt'));
  if not exists (select 1 from passes_chaves where semana = p_semana and contexto = p_contexto) then
    insert into passes_chaves (semana, contexto, publica, privada_selada, criada_dia)
    values (p_semana, p_contexto, p_publica, p_privada_selada, interno.caixa_hoje());
    perform interno.rede_kt_acrescentar('passes-rsa', v_quem, interno.passes_identidade(p_semana, p_contexto, p_publica), 1);
  end if;
  return public.rede_passes_chave_ler(p_semana, p_contexto);
end $$;

/**
 * A conta (com sessão, pela porta) vota nesta votação, e a votação está aberta? É a regra para receber a chave da urna e o passe com
 * contexto: quem pode ver a chave de voto (interno.voto_pode_ver, da R2) numa votação aberta (interno.voto_situacao).
 */
create or replace function interno.passes_contexto_permitido(p_tipo text, p_alvo uuid, p_quem uuid) returns boolean language plpgsql stable security definer set search_path = interno, pg_temp as $$
begin
  if p_tipo is null or p_tipo not in ('consulta', 'decisao', 'equipe') or p_alvo is null or p_quem is null then return false; end if;
  return coalesce(interno.voto_situacao(p_tipo, p_alvo) = 'aberta', false) and coalesce(interno.voto_pode_ver(p_tipo, p_alvo, p_quem), false);
end $$;

/** A rota de emissão pergunta, antes de criar a chave da urna de uma votação, se a conta da sessão vota nela. */
create or replace function public.rede_passes_contexto_pode(p_tipo text, p_alvo uuid) returns boolean language plpgsql stable security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.diretorio_eu();
begin
  return interno.passes_contexto_permitido(p_tipo, p_alvo, v);
end $$;

/**
 * Marca que esta conta (com sessão, pela porta) já pegou o passe da urna de uma votação: `p_marca` é um HMAC do servidor do site
 * (segredo + conta + contexto), então o banco não sabe de quem é. Antes, confere que a conta vota nesta votação aberta. false = já pegou.
 */
create or replace function public.rede_passes_contexto_marcar(p_tipo text, p_alvo uuid, p_marca bytea) returns boolean language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.diretorio_eu(); n integer;
begin
  if octet_length(p_marca) is distinct from 32 or p_alvo is null then perform interno.erro('invalido:marca'); end if;
  if not interno.passes_contexto_permitido(p_tipo, p_alvo, v) then perform interno.erro('sem_permissao'); end if;
  insert into passes_emitidos_contexto (marca, dia) values (p_marca, interno.caixa_hoje()) on conflict (marca) do nothing;
  get diagnostics n = row_count;
  return n = 1;
end $$;

-- ── 4. O endereço do servidor do chat no registro ──────────────────────────────────────────────────────────────────────────

/**
 * Anota no registro de transparência o endereço do servidor do chat separado ("sc1:<https://…>"; vazio = o chat volta para o próprio
 * site). Só o dono do banco chama (no SQL, ao implantar): nenhuma conta, nem o serviço, tem execute.
 */
create or replace function interno.rede_servidor_chat_registrar(p_endereco text) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v_quem text := encode(sha256(convert_to('alumia-kt:servidor-chat', 'UTF8')), 'base64'); v text := btrim(coalesce(p_endereco, ''));
begin
  if v <> '' and (v !~ '^https://[a-z0-9.-]+(:[0-9]{2,5})?(/[A-Za-z0-9._~/-]*)?$' or char_length(v) > 200 or v ~ '/$') then
    perform interno.erro('invalido:endereco');
  end if;
  perform interno.rede_kt_acrescentar('servidor-chat', v_quem, 'sc1:' || v, 1);
  return jsonb_build_object('ok', true, 'seq', (select max(seq) from rede_kt));
end $$;

-- ── 5. A limpeza ───────────────────────────────────────────────────────────────────────────────────────────────────────────

/**
 * Tira a chave PRIVADA das semanas que já não emitem (mais velhas que a anterior) e apaga as chaves de semanas com mais de 3 semanas;
 * marcas de contexto com mais de 180 dias saem. As de contexto ficam (a votação pode durar).
 */
create or replace function interno.rede_passes_limpeza() returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v_semana integer := interno.passes_semana_hoje(); a integer; b integer; c integer;
begin
  update passes_chaves set privada_selada = null where octet_length(contexto) = 0 and semana < v_semana and privada_selada is not null;
  get diagnostics a = row_count;
  delete from passes_chaves where octet_length(contexto) = 0 and semana < v_semana - 3; get diagnostics b = row_count;
  delete from passes_emitidos_contexto where dia < interno.caixa_hoje() - 180; get diagnostics c = row_count;
  return jsonb_build_object('privadas', a, 'chaves', b, 'marcas', c);
end $$;

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule('alumia-passes-limpeza', '41 0 * * *', 'select interno.rede_passes_limpeza()');
  end if;
exception when others then
  raise warning 'alumia-passes-limpeza: a rotina não foi agendada (%).', sqlerrm;
end $$;

-- ── 6. Permissões ─────────────────────────────────────────────────────────────────────────────────────────────────────────
-- As chaves: só o servidor do site (service_role). A marca do contexto: quem entrou (authenticated), com a porta. As de dentro e a
-- do endereço do servidor do chat: ninguém (o dono do banco chama).

do $$
declare f record;
begin
  for f in select p.oid::regprocedure as assinatura, n.nspname as esquema, p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
           where (n.nspname = 'interno' and p.proname in ('passes_semana_hoje', 'passes_identidade', 'passes_contexto_permitido', 'rede_servidor_chat_registrar', 'rede_passes_limpeza'))
              or (n.nspname = 'public' and p.proname in ('rede_passes_chave_ler', 'rede_passes_chave_guardar', 'rede_passes_contexto_pode', 'rede_passes_contexto_marcar')) loop
    execute format('revoke all on function %s from public', f.assinatura);
    if exists (select 1 from pg_roles where rolname = 'anon') then
      execute format('revoke all on function %s from anon, authenticated', f.assinatura);
    end if;
    if f.esquema = 'public' and f.proname in ('rede_passes_chave_ler', 'rede_passes_chave_guardar') and exists (select 1 from pg_roles where rolname = 'service_role') then
      execute format('grant execute on function %s to service_role', f.assinatura);
    end if;
    if f.esquema = 'public' and f.proname in ('rede_passes_contexto_pode', 'rede_passes_contexto_marcar') and exists (select 1 from pg_roles where rolname = 'authenticated') then
      execute format('grant execute on function %s to authenticated', f.assinatura);
    end if;
  end loop;
end $$;

-- ── 7. A porta ────────────────────────────────────────────────────────────────────────────────────────────────────────────
select interno.alumia_trancar();
