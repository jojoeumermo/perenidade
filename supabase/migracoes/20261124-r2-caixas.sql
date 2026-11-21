-- Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
--
-- ═══════════════════════ Alumia · Reforço 2 · Caixas anônimas: o servidor só entrega pacotes, sem saber de quem para quem (24/11/2026) ═══════════════════════
-- Migração acrescentável: pode rodar mais de uma vez. Roda depois de 20261123-r1-fim.sql (banco na versão 14) e ANTES das outras
-- migrações da R2 (cofres, dupla, equipe, grupos, voto), que usam as caixas. Teste: scripts/testar-r2-caixas.mjs (a migração duas
-- vezes sobre o install.sql; os ataques de quem tem o banco inteiro escritos como teste).
--
-- O que entra:
-- 1. As CAIXAS. Uma caixa é um identificador de 32 bytes sorteado no aparelho, com um passe de depósito e um passe de leitura, também
--    de 32 bytes. O banco guarda só os resumos (SHA-256 com um rótulo por finalidade): quem copia o banco não deposita, não lê e não
--    sabe de quem é a caixa. Nenhuma coluna liga caixa a conta; nenhuma hora (só o DIA do pacote); nenhuma sequência global (o pacote
--    tem um id sorteado e a ordem DENTRO da caixa). O pacote some quando quem lê confirma (caixa de um leitor só) e, de todo jeito,
--    em 30 dias; a caixa sem busca há uns 60 dias some.
-- 2. As funções das caixas NÃO usam a sessão de conta, de propósito: só o servidor do site as chama (com a chave de serviço), pelas
--    rotas anônimas (app/api/alumia/caixa/*, pedido, diretorio), que recusam cookie de sessão. Elas ficam na lista de exceções
--    escrita de interno.alumia_porta_aberta e se protegem assim: execute só para service_role; passes conferidos pelo resumo;
--    depósito com passe errado responde igual ao certo; teto por caixa por dia; tamanho fixo dos pacotes.
-- 3. Os depósitos e as criações chegam em LOTES (public.rede_caixa_lote): a rota junta os pedidos de até 2 s, e o lote é gravado
--    numa transação só, em ordem sorteada (o xmin é o mesmo para o lote inteiro e a posição no disco não diz a ordem de chegada).
-- 4. Os passes anônimos (Privacy Pass, RFC 9578): o banco guarda só o resumo dos passes gastos (para recusar o repetido) e, por um
--    dia, a marca de quem já pegou o lote do dia (HMAC do servidor do site; some no dia seguinte).
-- 5. O DIRETÓRIO das chaves públicas do chat novo (aparelhos, pré-chaves, pacotes MLS, a chave e a caixa de pedidos da conta): lido
--    sem sessão por codinome; a pré-chave e o pacote MLS são entregues uma vez cada, por pedido anônimo com passe.
-- 6. O registro de transparência (interno.rede_kt) passa a anotar a identidade da conta, os aparelhos e a chave de passes do dia.
-- 7. A denúncia com prova (franquia): a rota confere a prova e grava a denúncia na fila da moderação.
-- 8. A limpeza diária (pg_cron, 'alumia-caixas-limpeza').
-- Endereço de rede: nada daqui lê ou guarda (decisão de 13/11). Nenhum número de pessoas.
-- Leis: LGPD art. 6º, III (necessidade: o servidor guarda o mínimo para entregar), art. 46 (segurança), art. 16 (eliminação ao fim do
-- tratamento: o pacote some ao ser entregue e em 30 dias); Marco Civil art. 10 (sigilo das comunicações privadas).

-- ── 1. Tabelas ─────────────────────────────────────────────────────────────────────────────────────────────────────────────

create table if not exists interno.caixas (
  id_h bytea primary key check (octet_length(id_h) = 32),
  pd_h bytea not null check (octet_length(pd_h) = 32),
  pd_anterior_h bytea check (pd_anterior_h is null or octet_length(pd_anterior_h) = 32),
  pd_anterior_ate date,
  pl_h bytea not null check (octet_length(pl_h) = 32),
  multi boolean not null,
  unico_feito boolean not null default false,
  proxima integer not null default 1 check (proxima > 0),
  vence date not null
);

create table if not exists interno.pacotes (
  id bytea primary key check (octet_length(id) = 16),
  caixa_h bytea not null references interno.caixas (id_h) on delete cascade,
  ordem integer not null check (ordem > 0),
  envelope bytea not null,
  franquia bytea check (franquia is null or octet_length(franquia) = 32),
  marca bytea check (marca is null or octet_length(marca) = 32),
  unico boolean not null default false,
  dia date not null,
  unique (caixa_h, ordem)
);

create table if not exists interno.caixa_contagem (
  caixa_h bytea not null,
  dia date not null,
  n integer not null default 0,
  primary key (caixa_h, dia)
);

create table if not exists interno.passes_gastos (
  resumo bytea primary key check (octet_length(resumo) = 32),
  dia date not null
);

create table if not exists interno.passes_emitidos (
  marca bytea primary key check (octet_length(marca) = 32),
  dia date not null
);

create table if not exists interno.diretorio_contas (
  usuario uuid primary key references interno.perfis (id) on delete cascade,
  identidade bytea not null check (octet_length(identidade) = 32),
  pedidos_xwing bytea not null check (octet_length(pedidos_xwing) = 1216),
  pedidos_assinatura bytea not null check (octet_length(pedidos_assinatura) = 64),
  pedidos_caixa bytea not null check (octet_length(pedidos_caixa) = 32),
  pedidos_pd bytea not null check (octet_length(pedidos_pd) = 32),
  voto_xwing bytea check (voto_xwing is null or octet_length(voto_xwing) = 1216),
  voto_assinatura bytea check (voto_assinatura is null or octet_length(voto_assinatura) = 64),
  versao integer not null default 1 check (versao > 0)
);

create table if not exists interno.diretorio_aparelhos (
  aparelho bytea primary key check (octet_length(aparelho) = 32),
  usuario uuid not null references interno.perfis (id) on delete cascade,
  certificado bytea not null check (octet_length(certificado) = 64),
  proteus_impressao bytea not null check (octet_length(proteus_impressao) between 16 and 64),
  xwing_semana bytea not null check (octet_length(xwing_semana) = 1216),
  xwing_assinatura bytea not null check (octet_length(xwing_assinatura) = 64),
  semana integer not null check (semana > 0),
  criado_dia date not null
);
create index if not exists diretorio_aparelhos_usuario on interno.diretorio_aparelhos (usuario);

create table if not exists interno.diretorio_pre_chaves (
  aparelho bytea not null references interno.diretorio_aparelhos (aparelho) on delete cascade,
  id integer not null check (id between 0 and 65535),
  pkb bytea not null check (octet_length(pkb) between 32 and 256),
  assinatura bytea not null check (octet_length(assinatura) = 64),
  ultima boolean not null default false,
  primary key (aparelho, id)
);

create table if not exists interno.diretorio_pacotes_mls (
  aparelho bytea not null references interno.diretorio_aparelhos (aparelho) on delete cascade,
  ref bytea not null check (octet_length(ref) between 16 and 64),
  pacote bytea not null check (octet_length(pacote) between 64 and 8192),
  primary key (aparelho, ref)
);

-- O registro de transparência ganha o tipo da linha. As linhas de antes (a chave do chat da biblioteca do Matrix) ficam 'olm',
-- com o resumo de antes; as novas levam o tipo dentro do resumo (interno.rede_kt_resumo2).
alter table interno.rede_kt add column if not exists tipo text not null default 'olm';
do $$
begin
  if not exists (select 1 from pg_constraint where conrelid = 'interno.rede_kt'::regclass and conname = 'rede_kt_tipo_r2') then
    alter table interno.rede_kt add constraint rede_kt_tipo_r2 check (tipo in ('olm', 'conta', 'aparelho', 'aparelho-fora', 'passes'));
  end if;
end $$;

alter table interno.caixas enable row level security;
alter table interno.pacotes enable row level security;
alter table interno.caixa_contagem enable row level security;
alter table interno.passes_gastos enable row level security;
alter table interno.passes_emitidos enable row level security;
alter table interno.diretorio_contas enable row level security;
alter table interno.diretorio_aparelhos enable row level security;
alter table interno.diretorio_pre_chaves enable row level security;
alter table interno.diretorio_pacotes_mls enable row level security;
revoke all on interno.caixas, interno.pacotes, interno.caixa_contagem, interno.passes_gastos, interno.passes_emitidos,
  interno.diretorio_contas, interno.diretorio_aparelhos, interno.diretorio_pre_chaves, interno.diretorio_pacotes_mls from public;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on interno.caixas, interno.pacotes, interno.caixa_contagem, interno.passes_gastos, interno.passes_emitidos,
      interno.diretorio_contas, interno.diretorio_aparelhos, interno.diretorio_pre_chaves, interno.diretorio_pacotes_mls
      from anon, authenticated;
  end if;
end $$;

-- ── 2. Peças de dentro ─────────────────────────────────────────────────────────────────────────────────────────────────────

/** O dia de hoje em UTC (o único momento que as caixas guardam). */
create or replace function interno.caixa_hoje() returns date language sql stable set search_path = interno, pg_temp as $$
  select (now() at time zone 'utc')::date
$$;

/** O resumo de um segredo de 32 bytes com o rótulo da finalidade (o mesmo de lib/rede/caixas/resumos.ts). */
create or replace function interno.caixa_resumo(p_rotulo text, p_valor bytea) returns bytea language sql immutable set search_path = interno, pg_temp as $$
  select sha256(convert_to(p_rotulo, 'UTF8') || p_valor)
$$;

/** Base64 sem quebra de linha (o encode do Postgres quebra a cada 76 letras). */
create or replace function interno.caixa_b64(p bytea) returns text language sql immutable set search_path = interno, pg_temp as $$
  select replace(encode(p, 'base64'), E'\n', '')
$$;

/** Base64 (padrão ou de endereço) para bytes; nulo se não for base64. */
create or replace function interno.caixa_bytes(p text) returns bytea language plpgsql immutable set search_path = interno, pg_temp as $$
declare v text := translate(coalesce(p, ''), '-_', '+/');
begin
  if v = '' or v !~ '^[A-Za-z0-9+/]+=*$' then return null; end if;
  v := rtrim(v, '=');
  v := v || repeat('=', (4 - char_length(v) % 4) % 4);
  return decode(v, 'base64');
exception when others then
  return null;
end $$;

/**
 * Os tamanhos aceitos do envelope (a lista vive também em lib/rede/caixas/tamanhos.ts; o teste confere que são iguais):
 * conversa a dois e pedido 1120 + n + 16 (n = 2048, 4096, 8192, 16384, 24576, 32768); grupo 34 + n + 16 (n = 2048, 8192, 32768,
 * 131072); canal de ligar aparelho 1120 + 65536 + 16.
 */
create or replace function interno.caixa_tamanho_ok(p_tamanho integer) returns boolean language sql immutable set search_path = interno, pg_temp as $$
  select p_tamanho in (3184, 5232, 9328, 17520, 25712, 33904, 2098, 8242, 32818, 131122, 66672)
$$;

/** O tamanho do envelope de um pedido de conversa (HPKE X-Wing com o cifrado completado a 4096). */
create or replace function interno.caixa_tamanho_pedido() returns integer language sql immutable set search_path = interno, pg_temp as $$
  select 5232
$$;

/** A data de vencimento de uma caixa buscada hoje: o começo da semana mais 63 dias (semana arredondada: a busca não diz o dia). */
create or replace function interno.caixa_vence() returns date language sql stable set search_path = interno, pg_temp as $$
  select (date_trunc('week', interno.caixa_hoje()::timestamp)::date + 63)
$$;

/** Gasta um passe (ou um desafio): true se é a primeira vez; false se já foi gasto. */
create or replace function interno.caixa_gastar(p_resumo bytea) returns boolean language plpgsql security definer set search_path = interno, pg_temp as $$
declare v integer;
begin
  if p_resumo is null or octet_length(p_resumo) <> 32 then return false; end if;
  insert into passes_gastos (resumo, dia) values (p_resumo, interno.caixa_hoje()) on conflict (resumo) do nothing;
  get diagnostics v = row_count;
  return v = 1;
end $$;

/** O teto de depósitos por caixa por dia: true se ainda cabe (e conta este). */
create or replace function interno.caixa_contar(p_caixa_h bytea, p_multi boolean, p_pedidos boolean) returns boolean language plpgsql security definer set search_path = interno, pg_temp as $$
declare v_n integer;
begin
  insert into caixa_contagem (caixa_h, dia, n) values (p_caixa_h, interno.caixa_hoje(), 1)
  on conflict (caixa_h, dia) do update set n = caixa_contagem.n + 1 returning n into v_n;
  return v_n <= case when p_pedidos then 300 when p_multi then 5000 else 1000 end;
end $$;

-- ── 3. As caixas (só o servidor do site; sem sessão de conta) ────────────────────────────────────────────────────────────

/**
 * Um lote da rota: criações e depósitos de vários pedidos, gravados numa transação só e em ordem sorteada. `p_dia` é o dia (UTC) com
 * que a rota calculou a marca da franquia; o banco aceita só ontem, hoje ou amanhã e guarda esse dia no pacote.
 *   {acao:'criar', id_h, pd_h, pl_h, multi, gastos:[resumo do passe]}
 *   {acao:'depositar', id_h, pd, envelope, franquia?, marca?, unico?}
 *   {acao:'pedido', codinome, envelope, marca?, gastos:[resumo do passe, resumo do desafio]}
 * Devolve um resultado por item, na ordem dos itens: {ok:true} ou {ok:false, erro}. O depósito com passe errado (ou numa caixa que
 * não existe) responde {ok:true} como o certo e não grava nada: o bloqueio não se denuncia.
 */
create or replace function public.rede_caixa_lote(p_itens jsonb, p_dia date) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare
  v_hoje date := interno.caixa_hoje();
  v_n integer; i integer; x jsonb; v_res jsonb[];
  v_acao text; v_idh bytea; v_pd bytea; v_pdh bytea; v_plh bytea; v_env bytea; v_fr bytea; v_marca bytea; v_unico boolean; v_multi boolean;
  c caixas; v_g jsonb; v_ok boolean; v_existe caixas; v_dc diretorio_contas;
  -- O que o lote grava, juntado para um comando só no fim.
  n_idh bytea[] := '{}'; n_pdh bytea[] := '{}'; n_plh bytea[] := '{}'; n_multi boolean[] := '{}';
  p_caixa bytea[] := '{}'; p_ordem integer[] := '{}'; p_env bytea[] := '{}'; p_fr bytea[] := '{}'; p_marca bytea[] := '{}'; p_unico boolean[] := '{}';
begin
  if p_itens is null or jsonb_typeof(p_itens) <> 'array' then perform interno.erro('invalido:itens'); end if;
  v_n := jsonb_array_length(p_itens);
  if v_n < 1 or v_n > 64 then perform interno.erro('invalido:itens'); end if;
  if p_dia is null or p_dia not between v_hoje - 1 and v_hoje + 1 then perform interno.erro('invalido:dia'); end if;
  v_res := array_fill(null::jsonb, array[v_n]);

  -- 1. As criações primeiro (um depósito do mesmo lote pode ir para uma caixa criada nele). Os itens são tratados em ordem sorteada:
  -- as linhas novas de caixas (proxima) também não podem ficar no disco na ordem de chegada.
  for i in select k from generate_series(0, v_n - 1) k order by extensions.gen_random_bytes(8) loop
    x := p_itens -> i;
    if coalesce(x ->> 'acao', '') <> 'criar' then continue; end if;
    v_idh := interno.caixa_bytes(x ->> 'id_h'); v_pdh := interno.caixa_bytes(x ->> 'pd_h'); v_plh := interno.caixa_bytes(x ->> 'pl_h');
    v_multi := case x ->> 'multi' when 'true' then true when 'false' then false end;
    if octet_length(v_idh) is distinct from 32 or octet_length(v_pdh) is distinct from 32 or octet_length(v_plh) is distinct from 32 or v_multi is null
       or jsonb_typeof(x -> 'gastos') is distinct from 'array' or jsonb_array_length(x -> 'gastos') <> 1 then
      v_res[i + 1] := jsonb_build_object('ok', false, 'erro', 'invalido'); continue;
    end if;
    select * into v_existe from caixas where id_h = v_idh;
    if found or v_idh = any (n_idh) then
      -- Idempotente com os mesmos resumos; com outros, recusa (ninguém toma a caixa de outra pessoa).
      if found and v_existe.pd_h = v_pdh and v_existe.pl_h = v_plh and v_existe.multi = v_multi then
        v_res[i + 1] := jsonb_build_object('ok', true);
      else
        v_res[i + 1] := jsonb_build_object('ok', false, 'erro', 'existe');
      end if;
      continue;
    end if;
    if not interno.caixa_gastar(interno.caixa_bytes(x -> 'gastos' ->> 0)) then
      v_res[i + 1] := jsonb_build_object('ok', false, 'erro', 'passe_usado'); continue;
    end if;
    n_idh := n_idh || v_idh; n_pdh := n_pdh || v_pdh; n_plh := n_plh || v_plh; n_multi := n_multi || v_multi;
    v_res[i + 1] := jsonb_build_object('ok', true);
  end loop;
  insert into caixas (id_h, pd_h, pl_h, multi, vence)
  select u.idh, u.pdh, u.plh, u.multi, interno.caixa_vence()
  from unnest(n_idh, n_pdh, n_plh, n_multi) as u (idh, pdh, plh, multi)
  order by extensions.gen_random_bytes(8);

  -- 2. Os depósitos e os pedidos (também em ordem sorteada).
  for i in select k from generate_series(0, v_n - 1) k order by extensions.gen_random_bytes(8) loop
    x := p_itens -> i;
    v_acao := coalesce(x ->> 'acao', '');
    if v_acao = 'criar' then continue; end if;
    if v_acao not in ('depositar', 'pedido') then v_res[i + 1] := jsonb_build_object('ok', false, 'erro', 'invalido'); continue; end if;
    v_env := interno.caixa_bytes(x ->> 'envelope');
    v_fr := case when x ? 'franquia' and x ->> 'franquia' is not null then interno.caixa_bytes(x ->> 'franquia') end;
    v_marca := case when x ? 'marca' and x ->> 'marca' is not null then interno.caixa_bytes(x ->> 'marca') end;
    if (x ? 'franquia' and x ->> 'franquia' is not null and octet_length(v_fr) is distinct from 32)
       or (x ? 'marca' and x ->> 'marca' is not null and octet_length(v_marca) is distinct from 32) then
      v_res[i + 1] := jsonb_build_object('ok', false, 'erro', 'invalido'); continue;
    end if;

    if v_acao = 'pedido' then
      if v_env is null or octet_length(v_env) <> interno.caixa_tamanho_pedido() then
        v_res[i + 1] := jsonb_build_object('ok', false, 'erro', 'tamanho'); continue;
      end if;
      if jsonb_typeof(x -> 'gastos') is distinct from 'array' or jsonb_array_length(x -> 'gastos') <> 2 then
        v_res[i + 1] := jsonb_build_object('ok', false, 'erro', 'invalido'); continue;
      end if;
      select d.* into v_dc from diretorio_contas d join perfis f on f.id = d.usuario
      where f.rede_codinome is not null and interno.rede_chave(f.rede_codinome) = interno.rede_chave(coalesce(x ->> 'codinome', ''))
        and not coalesce(f.suspenso, false) and interno.rede2_membro(f.id)
      limit 1;
      if not found then v_res[i + 1] := jsonb_build_object('ok', false, 'erro', 'sem_pedidos'); continue; end if;
      v_idh := interno.caixa_resumo('alumia/r2/caixa', v_dc.pedidos_caixa);
      select * into c from caixas where id_h = v_idh;
      if not found or c.pd_h <> interno.caixa_resumo('alumia/r2/passe-deposito', v_dc.pedidos_pd) then
        v_res[i + 1] := jsonb_build_object('ok', false, 'erro', 'sem_pedidos'); continue;
      end if;
      -- O passe e o desafio da prova de trabalho: os dois só uma vez.
      v_ok := interno.caixa_gastar(interno.caixa_bytes(x -> 'gastos' ->> 0));
      v_ok := interno.caixa_gastar(interno.caixa_bytes(x -> 'gastos' ->> 1)) and v_ok;
      if not v_ok then v_res[i + 1] := jsonb_build_object('ok', false, 'erro', 'passe_usado'); continue; end if;
      if not interno.caixa_contar(v_idh, false, true) then v_res[i + 1] := jsonb_build_object('ok', false, 'erro', 'cheia'); continue; end if;
      update caixas set proxima = proxima + 1 where id_h = v_idh returning * into c;
      p_caixa := p_caixa || v_idh; p_ordem := p_ordem || (c.proxima - 1); p_env := p_env || v_env; p_fr := p_fr || v_fr;
      p_marca := p_marca || v_marca; p_unico := p_unico || false;
      v_res[i + 1] := jsonb_build_object('ok', true);
      continue;
    end if;

    -- Depositar.
    v_idh := interno.caixa_bytes(x ->> 'id_h'); v_pd := interno.caixa_bytes(x ->> 'pd');
    v_unico := coalesce(x ->> 'unico', 'false') = 'true';
    if octet_length(v_idh) is distinct from 32 or octet_length(v_pd) is distinct from 32 then
      v_res[i + 1] := jsonb_build_object('ok', false, 'erro', 'invalido'); continue;
    end if;
    if v_env is null or not interno.caixa_tamanho_ok(octet_length(v_env)) then
      v_res[i + 1] := jsonb_build_object('ok', false, 'erro', 'tamanho'); continue;
    end if;
    v_pdh := interno.caixa_resumo('alumia/r2/passe-deposito', v_pd);
    select * into c from caixas where id_h = v_idh for update;
    if not found or not coalesce(c.pd_h = v_pdh or (c.pd_anterior_h = v_pdh and c.pd_anterior_ate >= v_hoje), false) then
      -- Passe errado, trocado no bloqueio ou caixa que não existe: igual ao certo, e nada é gravado.
      v_res[i + 1] := jsonb_build_object('ok', true); continue;
    end if;
    if v_unico and c.unico_feito then v_res[i + 1] := jsonb_build_object('ok', false, 'erro', 'ocupada'); continue; end if;
    if not interno.caixa_contar(v_idh, c.multi, false) then v_res[i + 1] := jsonb_build_object('ok', false, 'erro', 'cheia'); continue; end if;
    update caixas set proxima = proxima + 1, unico_feito = unico_feito or v_unico where id_h = v_idh returning * into c;
    p_caixa := p_caixa || v_idh; p_ordem := p_ordem || (c.proxima - 1); p_env := p_env || v_env; p_fr := p_fr || v_fr;
    p_marca := p_marca || v_marca; p_unico := p_unico || v_unico;
    v_res[i + 1] := jsonb_build_object('ok', true);
  end loop;

  insert into pacotes (id, caixa_h, ordem, envelope, franquia, marca, unico, dia)
  select extensions.gen_random_bytes(16), u.caixa, u.ordem, u.env, u.fr, u.marca, u.unico, p_dia
  from unnest(p_caixa, p_ordem, p_env, p_fr, p_marca, p_unico) as u (caixa, ordem, env, fr, marca, unico)
  order by extensions.gen_random_bytes(8);

  return jsonb_build_object('resultados', to_jsonb(v_res));
end $$;

/**
 * Os pacotes de uma caixa depois de `p_cursor` (até 50, pela ordem dentro da caixa), para quem tem o passe de leitura. Passe errado
 * ou caixa que não existe: lista vazia, igual à caixa vazia. A busca adia o vencimento da caixa (semana arredondada).
 */
create or replace function public.rede_caixa_buscar(p_id_h bytea, p_pl bytea, p_cursor integer) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare c caixas; v_vence date := interno.caixa_vence();
begin
  if octet_length(p_id_h) is distinct from 32 or octet_length(p_pl) is distinct from 32 then return jsonb_build_object('pacotes', '[]'::jsonb); end if;
  select * into c from caixas where id_h = p_id_h;
  if not found or c.pl_h <> interno.caixa_resumo('alumia/r2/passe-leitura', p_pl) then return jsonb_build_object('pacotes', '[]'::jsonb); end if;
  if c.vence < v_vence then update caixas set vence = v_vence where id_h = p_id_h; end if;
  return jsonb_build_object('pacotes', coalesce((
    select jsonb_agg(jsonb_build_object('ordem', k.ordem, 'envelope', interno.caixa_b64(k.envelope),
             'franquia', case when k.franquia is null then null else interno.caixa_b64(k.franquia) end,
             'marca', case when k.marca is null then null else interno.caixa_b64(k.marca) end,
             'unico', k.unico, 'dia', to_char(k.dia, 'YYYY-MM-DD')) order by k.ordem)
    from (select * from pacotes where caixa_h = p_id_h and ordem > greatest(coalesce(p_cursor, 0), 0)
            and dia >= interno.caixa_hoje() - 30 order by ordem limit 50) k), '[]'::jsonb));
end $$;

/** Quem leu confirma até `p_ate`: numa caixa de um leitor só, os pacotes SAEM do banco. Na de vários leitores, nada muda. */
create or replace function public.rede_caixa_confirmar(p_id_h bytea, p_pl bytea, p_ate integer) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare c caixas; v integer := 0;
begin
  if octet_length(p_id_h) is distinct from 32 or octet_length(p_pl) is distinct from 32 then return jsonb_build_object('ok', true); end if;
  select * into c from caixas where id_h = p_id_h;
  if found and c.pl_h = interno.caixa_resumo('alumia/r2/passe-leitura', p_pl) and not c.multi then
    delete from pacotes where caixa_h = p_id_h and ordem <= coalesce(p_ate, 0);
    get diagnostics v = row_count;
  end if;
  return jsonb_build_object('ok', true);
end $$;

/**
 * Troca o passe de depósito e/ou o de leitura (só os resumos novos chegam). O passe de depósito anterior vale mais 7 dias (mensagem no
 * caminho não se perde); no bloqueio, deixa de valer na hora. Quem foi bloqueado continua depositando "ok" e nada chega.
 */
create or replace function public.rede_caixa_trocar(p_id_h bytea, p_pl bytea, p_pd_h_novo bytea, p_pl_h_novo bytea, p_bloqueio boolean) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare c caixas;
begin
  if octet_length(p_id_h) is distinct from 32 or octet_length(p_pl) is distinct from 32
     or (p_pd_h_novo is not null and octet_length(p_pd_h_novo) <> 32) or (p_pl_h_novo is not null and octet_length(p_pl_h_novo) <> 32)
     or (p_pd_h_novo is null and p_pl_h_novo is null) then
    return jsonb_build_object('ok', false, 'erro', 'invalido');
  end if;
  select * into c from caixas where id_h = p_id_h for update;
  if not found or c.pl_h <> interno.caixa_resumo('alumia/r2/passe-leitura', p_pl) then return jsonb_build_object('ok', false, 'erro', 'nao_encontrada'); end if;
  if p_pd_h_novo is not null and p_pd_h_novo <> c.pd_h then
    update caixas set pd_anterior_h = case when coalesce(p_bloqueio, false) then null else c.pd_h end,
                      pd_anterior_ate = case when coalesce(p_bloqueio, false) then null else interno.caixa_hoje() + 7 end,
                      pd_h = p_pd_h_novo
    where id_h = p_id_h;
  elsif p_pd_h_novo is not null and coalesce(p_bloqueio, false) then
    update caixas set pd_anterior_h = null, pd_anterior_ate = null where id_h = p_id_h;
  end if;
  if p_pl_h_novo is not null then update caixas set pl_h = p_pl_h_novo where id_h = p_id_h; end if;
  return jsonb_build_object('ok', true);
end $$;

/** Apaga a caixa e tudo o que há nela (quem tem o passe de leitura). */
create or replace function public.rede_caixa_apagar(p_id_h bytea, p_pl bytea) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
begin
  if octet_length(p_id_h) is distinct from 32 or octet_length(p_pl) is distinct from 32 then return jsonb_build_object('ok', true); end if;
  delete from caixas where id_h = p_id_h and pl_h = interno.caixa_resumo('alumia/r2/passe-leitura', p_pl);
  delete from caixa_contagem where caixa_h = p_id_h and not exists (select 1 from caixas where id_h = p_id_h);
  return jsonb_build_object('ok', true);
end $$;

/** Gasta um passe anônimo numa ação que não grava mais nada no banco (a credencial da voz, por exemplo). false = já gasto. */
create or replace function public.rede_passe_gastar(p_resumo bytea) returns boolean language sql security definer set search_path = interno, pg_temp as $$
  select interno.caixa_gastar(p_resumo)
$$;

-- ── 4. O diretório (leitura sem sessão; publicação com sessão) ────────────────────────────────────────────────────────────

/** A conta (aprovada, não suspensa) com este codinome, ou nula. */
create or replace function interno.diretorio_conta_de(p_codinome text) returns uuid language sql stable security definer set search_path = interno, pg_temp as $$
  select f.id from perfis f
  where f.rede_codinome is not null and char_length(coalesce(p_codinome, '')) between 3 and 30
    and interno.rede_chave(f.rede_codinome) = interno.rede_chave(p_codinome)
    and not coalesce(f.suspenso, false) and interno.rede2_membro(f.id)
  limit 1
$$;

/**
 * As chaves públicas de uma conta, por codinome, para quem vai começar uma conversa (sem sessão). Não diz quantas pré-chaves ou
 * pacotes sobram (isso diria quantas conversas a pessoa começou). Nula: sem conta, sem chat novo ou suspensa.
 */
create or replace function public.rede_diretorio_ler(p_codinome text) returns jsonb language plpgsql stable security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.diretorio_conta_de(p_codinome); d diretorio_contas;
begin
  if v is null then return null; end if;
  select * into d from diretorio_contas where usuario = v;
  if not found then return null; end if;
  return jsonb_build_object(
    'usuario', v, 'identidade', interno.caixa_b64(d.identidade), 'versao', d.versao,
    'pedidos_xwing', interno.caixa_b64(d.pedidos_xwing), 'pedidos_assinatura', interno.caixa_b64(d.pedidos_assinatura),
    'pedidos_caixa', interno.caixa_b64(d.pedidos_caixa), 'pedidos_pd', interno.caixa_b64(d.pedidos_pd),
    'voto_xwing', case when d.voto_xwing is null then null else interno.caixa_b64(d.voto_xwing) end,
    'voto_assinatura', case when d.voto_assinatura is null then null else interno.caixa_b64(d.voto_assinatura) end,
    'aparelhos', coalesce((select jsonb_agg(jsonb_build_object('aparelho', interno.caixa_b64(a.aparelho), 'certificado', interno.caixa_b64(a.certificado),
        'proteus_impressao', interno.caixa_b64(a.proteus_impressao), 'xwing_semana', interno.caixa_b64(a.xwing_semana),
        'xwing_assinatura', interno.caixa_b64(a.xwing_assinatura), 'semana', a.semana, 'criado_dia', to_char(a.criado_dia, 'YYYY-MM-DD'))
        order by a.aparelho) from diretorio_aparelhos a where a.usuario = v), '[]'::jsonb));
end $$;

/**
 * Entrega uma pré-chave Proteus (ou um pacote MLS) de cada aparelho da conta, uma vez cada, para quem gastou um passe anônimo
 * (`p_passe` é o resumo do passe; repetido, recusa). Sem pré-chave comum, entrega a última (que não sai). A pré-chave entregue é
 * SORTEADA (não a de menor número): com a de menor número, quem copiasse o banco contava quantas conversas cada conta começou (o
 * menor número que sobra, menos 1). Limite que fica: quantas sobram desde a última reposição.
 */
create or replace function public.rede_diretorio_reivindicar(p_usuario uuid, p_tipo text, p_passe bytea) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare a record; k record; v_saida jsonb := '[]'::jsonb;
begin
  if p_tipo is null or p_tipo not in ('proteus', 'mls') then perform interno.erro('invalido:tipo'); end if;
  if p_usuario is null or not exists (select 1 from perfis f where f.id = p_usuario and not coalesce(f.suspenso, false)) or not interno.rede2_membro(p_usuario) then
    perform interno.erro('nao_encontrado');
  end if;
  if not interno.caixa_gastar(p_passe) then perform interno.erro('passe_usado'); end if;
  for a in select aparelho from diretorio_aparelhos where usuario = p_usuario order by aparelho limit 8 loop
    if p_tipo = 'proteus' then
      select * into k from diretorio_pre_chaves where aparelho = a.aparelho and not ultima order by gen_random_uuid() limit 1 for update skip locked;
      if found then
        delete from diretorio_pre_chaves where aparelho = k.aparelho and id = k.id;
      else
        select * into k from diretorio_pre_chaves where aparelho = a.aparelho and ultima limit 1;
        if not found then continue; end if;
      end if;
      v_saida := v_saida || jsonb_build_object('aparelho', interno.caixa_b64(k.aparelho), 'id', k.id, 'pre', interno.caixa_b64(k.pkb), 'assinatura', interno.caixa_b64(k.assinatura));
    else
      select * into k from diretorio_pacotes_mls where aparelho = a.aparelho order by gen_random_uuid() limit 1 for update skip locked;
      if not found then continue; end if;
      delete from diretorio_pacotes_mls where aparelho = k.aparelho and ref = k.ref;
      v_saida := v_saida || jsonb_build_object('aparelho', interno.caixa_b64(k.aparelho), 'ref', interno.caixa_b64(k.ref), 'pre', interno.caixa_b64(k.pacote));
    end if;
  end loop;
  return v_saida;
end $$;

/** A conta de quem chama, aprovada e não suspensa (para publicar no diretório e pegar passes). */
create or replace function interno.diretorio_eu() returns uuid language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu();
begin
  perform interno.aberta('comunidade');
  if not interno.rede2_membro(v) or exists (select 1 from perfis f where f.id = v and coalesce(f.suspenso, false)) then perform interno.erro('consentimento'); end if;
  return v;
end $$;

/**
 * Publica a parte pública da conta no chat novo: a identidade (Ed25519), a chave de pedidos (X-Wing assinada pela identidade), a caixa
 * de pedidos (id e passe de depósito públicos, de propósito: diz "esta conta recebe pedidos", não de quem), o resumo do passe de leitura
 * dela e, se for guardiã, a chave de voto. A caixa de pedidos é criada aqui (é a única caixa ligada a uma conta).
 */
create or replace function public.rede_diretorio_conta(p jsonb) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare
  v uuid := interno.diretorio_eu(); d diretorio_contas; c caixas;
  v_id bytea := interno.caixa_bytes(p ->> 'identidade'); v_px bytea := interno.caixa_bytes(p ->> 'pedidos_xwing');
  v_pa bytea := interno.caixa_bytes(p ->> 'pedidos_assinatura'); v_cx bytea := interno.caixa_bytes(p ->> 'pedidos_caixa');
  v_pd bytea := interno.caixa_bytes(p ->> 'pedidos_pd'); v_plh bytea := interno.caixa_bytes(p ->> 'pedidos_pl_h');
  v_vx bytea := interno.caixa_bytes(p ->> 'voto_xwing'); v_va bytea := interno.caixa_bytes(p ->> 'voto_assinatura');
  v_idh bytea;
begin
  perform interno.limite('rede_diretorio_conta', 20, 60);
  if octet_length(v_id) is distinct from 32 or octet_length(v_px) is distinct from 1216 or octet_length(v_pa) is distinct from 64
     or octet_length(v_cx) is distinct from 32 or octet_length(v_pd) is distinct from 32 or octet_length(v_plh) is distinct from 32
     or (v_vx is not null and octet_length(v_vx) <> 1216) or (v_va is not null and octet_length(v_va) <> 64) or ((v_vx is null) <> (v_va is null)) then
    perform interno.erro('invalido:diretorio');
  end if;
  v_idh := interno.caixa_resumo('alumia/r2/caixa', v_cx);
  select * into d from diretorio_contas where usuario = v;
  select * into c from caixas where id_h = v_idh;
  -- A caixa de pedidos é nova, ou é a mesma que esta conta já publicou: ninguém aponta a caixa de pedidos para a caixa de outra pessoa.
  if found and not (d.usuario is not null and d.pedidos_caixa = v_cx) then perform interno.erro('caixa_ocupada'); end if;
  if d.usuario is not null and d.pedidos_caixa <> v_cx then
    delete from caixas where id_h = interno.caixa_resumo('alumia/r2/caixa', d.pedidos_caixa);
  end if;
  insert into caixas (id_h, pd_h, pl_h, multi, vence)
  values (v_idh, interno.caixa_resumo('alumia/r2/passe-deposito', v_pd), v_plh, false, interno.caixa_vence())
  on conflict (id_h) do update set pd_h = excluded.pd_h, pl_h = excluded.pl_h, pd_anterior_h = null, pd_anterior_ate = null;
  insert into diretorio_contas (usuario, identidade, pedidos_xwing, pedidos_assinatura, pedidos_caixa, pedidos_pd, voto_xwing, voto_assinatura)
  values (v, v_id, v_px, v_pa, v_cx, v_pd, v_vx, v_va)
  on conflict (usuario) do update set identidade = excluded.identidade, pedidos_xwing = excluded.pedidos_xwing,
    pedidos_assinatura = excluded.pedidos_assinatura, pedidos_caixa = excluded.pedidos_caixa, pedidos_pd = excluded.pedidos_pd,
    -- A chave de voto (da frente do voto, public.rede_voto_minha_chave) fica quando a conta é publicada de novo SEM ela e com a mesma
    -- identidade (outro aparelho ligado, cópia restaurada): só uma identidade nova (que não assinou a chave de voto) a tira.
    voto_xwing = case when excluded.voto_xwing is not null then excluded.voto_xwing when diretorio_contas.identidade = excluded.identidade then diretorio_contas.voto_xwing end,
    voto_assinatura = case when excluded.voto_xwing is not null then excluded.voto_assinatura when diretorio_contas.identidade = excluded.identidade then diretorio_contas.voto_assinatura end,
    versao = diretorio_contas.versao + case when diretorio_contas.identidade = excluded.identidade then 0 else 1 end;
  return jsonb_build_object('ok', true);
end $$;

/** Publica (ou atualiza) um aparelho da conta: o certificado assinado pela identidade, a impressão Proteus e a chave X-Wing da semana. */
create or replace function public.rede_diretorio_publicar(p_aparelho jsonb) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare
  v uuid := interno.diretorio_eu(); o uuid;
  v_ap bytea := interno.caixa_bytes(p_aparelho ->> 'aparelho'); v_cert bytea := interno.caixa_bytes(p_aparelho ->> 'certificado');
  v_imp bytea := interno.caixa_bytes(p_aparelho ->> 'proteus_impressao'); v_xw bytea := interno.caixa_bytes(p_aparelho ->> 'xwing_semana');
  v_xa bytea := interno.caixa_bytes(p_aparelho ->> 'xwing_assinatura'); v_sem integer;
begin
  perform interno.limite('rede_diretorio_publicar', 60, 60);
  begin v_sem := (p_aparelho ->> 'semana')::integer; exception when others then v_sem := null; end;
  if octet_length(v_ap) is distinct from 32 or octet_length(v_cert) is distinct from 64 or coalesce(octet_length(v_imp), 0) not between 16 and 64
     or octet_length(v_xw) is distinct from 1216 or octet_length(v_xa) is distinct from 64 or coalesce(v_sem, 0) <= 0 then
    perform interno.erro('invalido:aparelho');
  end if;
  select usuario into o from diretorio_aparelhos where aparelho = v_ap;
  if found and o <> v then perform interno.erro('aparelho_de_outra_conta'); end if;
  if not found and (select count(*) from diretorio_aparelhos where usuario = v) >= 8 then perform interno.erro('aparelhos_demais'); end if;
  insert into diretorio_aparelhos (aparelho, usuario, certificado, proteus_impressao, xwing_semana, xwing_assinatura, semana, criado_dia)
  values (v_ap, v, v_cert, v_imp, v_xw, v_xa, v_sem, interno.caixa_hoje())
  on conflict (aparelho) do update set certificado = excluded.certificado, proteus_impressao = excluded.proteus_impressao,
    xwing_semana = excluded.xwing_semana, xwing_assinatura = excluded.xwing_assinatura, semana = excluded.semana;
  return jsonb_build_object('ok', true);
end $$;

/** As pré-chaves Proteus de um aparelho meu (cada uma assinada pela chave do aparelho, por fora da biblioteca). Até 200 comuns. */
create or replace function public.rede_diretorio_pre_chaves(p_aparelho bytea, p_lista jsonb) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.diretorio_eu(); x jsonb; v_pkb bytea; v_as bytea; v_id integer; n integer := 0;
begin
  perform interno.limite('rede_diretorio_pre_chaves', 60, 60);
  if not exists (select 1 from diretorio_aparelhos where aparelho = p_aparelho and usuario = v) then perform interno.erro('nao_encontrado'); end if;
  if jsonb_typeof(p_lista) is distinct from 'array' or jsonb_array_length(p_lista) not between 1 and 200 then perform interno.erro('invalido:lista'); end if;
  for x in select * from jsonb_array_elements(p_lista) loop
    v_pkb := interno.caixa_bytes(x ->> 'pkb'); v_as := interno.caixa_bytes(x ->> 'assinatura');
    begin v_id := (x ->> 'id')::integer; exception when others then v_id := null; end;
    if v_id is null or v_id not between 0 and 65535 or coalesce(octet_length(v_pkb), 0) not between 32 and 256 or octet_length(v_as) is distinct from 64 then
      perform interno.erro('invalido:lista');
    end if;
    insert into diretorio_pre_chaves (aparelho, id, pkb, assinatura, ultima) values (p_aparelho, v_id, v_pkb, v_as, coalesce(x ->> 'ultima', 'false') = 'true')
    on conflict (aparelho, id) do update set pkb = excluded.pkb, assinatura = excluded.assinatura, ultima = excluded.ultima;
    n := n + 1;
  end loop;
  if (select count(*) from diretorio_pre_chaves where aparelho = p_aparelho and not ultima) > 200
     or (select count(*) from diretorio_pre_chaves where aparelho = p_aparelho and ultima) > 1 then
    perform interno.erro('invalido:lista');
  end if;
  return jsonb_build_object('ok', true, 'gravadas', n);
end $$;

/** Os pacotes de chave MLS (KeyPackage) de um aparelho meu, entregues um a um a quem me põe num grupo. Até 100. */
create or replace function public.rede_diretorio_pacotes_mls(p_aparelho bytea, p_lista jsonb) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.diretorio_eu(); x jsonb; v_ref bytea; v_pac bytea; n integer := 0;
begin
  perform interno.limite('rede_diretorio_pacotes_mls', 60, 60);
  if not exists (select 1 from diretorio_aparelhos where aparelho = p_aparelho and usuario = v) then perform interno.erro('nao_encontrado'); end if;
  if jsonb_typeof(p_lista) is distinct from 'array' or jsonb_array_length(p_lista) not between 1 and 100 then perform interno.erro('invalido:lista'); end if;
  for x in select * from jsonb_array_elements(p_lista) loop
    v_ref := interno.caixa_bytes(x ->> 'ref'); v_pac := interno.caixa_bytes(x ->> 'pacote');
    if coalesce(octet_length(v_ref), 0) not between 16 and 64 or coalesce(octet_length(v_pac), 0) not between 64 and 8192 then perform interno.erro('invalido:lista'); end if;
    insert into diretorio_pacotes_mls (aparelho, ref, pacote) values (p_aparelho, v_ref, v_pac) on conflict (aparelho, ref) do update set pacote = excluded.pacote;
    n := n + 1;
  end loop;
  if (select count(*) from diretorio_pacotes_mls where aparelho = p_aparelho) > 100 then perform interno.erro('invalido:lista'); end if;
  return jsonb_build_object('ok', true, 'gravados', n);
end $$;

/** Tira um aparelho meu do diretório (com as pré-chaves e os pacotes dele). */
create or replace function public.rede_diretorio_tirar_aparelho(p_aparelho bytea) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); n integer;
begin
  delete from diretorio_aparelhos where aparelho = p_aparelho and usuario = v;
  get diagnostics n = row_count;
  return jsonb_build_object('ok', true, 'tirados', n);
end $$;

/** Apaga tudo o que é meu no diretório do chat novo (a conta, os aparelhos e a caixa de pedidos), sem apagar a conta. */
create or replace function public.rede_diretorio_apagar() returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); d diretorio_contas;
begin
  select * into d from diretorio_contas where usuario = v;
  if found then delete from caixas where id_h = interno.caixa_resumo('alumia/r2/caixa', d.pedidos_caixa); end if;
  delete from diretorio_aparelhos where usuario = v;
  delete from diretorio_contas where usuario = v;
  return jsonb_build_object('ok', true);
end $$;

/**
 * A rota de emissão dos passes marca que esta conta já pegou o lote de hoje. `p_marca` é um HMAC do servidor do site (segredo do dia +
 * conta): o banco não sabe de quem é, e a marca some amanhã. false = já pegou hoje.
 */
create or replace function public.rede_passes_marcar_hoje(p_marca bytea) returns boolean language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.diretorio_eu(); n integer;
begin
  if octet_length(p_marca) is distinct from 32 then perform interno.erro('invalido:marca'); end if;
  delete from passes_emitidos where dia < interno.caixa_hoje();
  insert into passes_emitidos (marca, dia) values (p_marca, interno.caixa_hoje()) on conflict (marca) do nothing;
  get diagnostics n = row_count;
  return n = 1;
end $$;

-- ── 5. O registro de transparência ────────────────────────────────────────────────────────────────────────────────────────

/** O resumo de uma linha nova do registro (com o tipo dentro): sha256(anterior|seq|tipo|quem|identidade|versao|dia). */
create or replace function interno.rede_kt_resumo2(p_anterior text, p_seq bigint, p_tipo text, p_quem text, p_identidade text, p_versao integer, p_dia date) returns text language sql immutable set search_path = interno, pg_temp as $$
  select encode(sha256(convert_to(p_anterior || '|' || p_seq || '|' || p_tipo || '|' || p_quem || '|' || p_identidade || '|' || p_versao || '|' || to_char(p_dia, 'YYYY-MM-DD'), 'UTF8')), 'base64')
$$;

/** Acrescenta uma linha ao registro (encadeada na última). */
create or replace function interno.rede_kt_acrescentar(p_tipo text, p_quem text, p_identidade text, p_versao integer) returns void language plpgsql security definer set search_path = interno, pg_temp as $$
declare v_ult rede_kt; v_seq bigint; v_dia date := interno.caixa_hoje();
begin
  perform pg_advisory_xact_lock(hashtext('rede_kt'));
  select * into v_ult from rede_kt order by seq desc limit 1;
  v_seq := coalesce(v_ult.seq, 0) + 1;
  insert into rede_kt (seq, tipo, quem, identidade, versao, dia, resumo)
  values (v_seq, p_tipo, p_quem, p_identidade, p_versao, v_dia,
          interno.rede_kt_resumo2(coalesce(v_ult.resumo, repeat('A', 43) || '='), v_seq, p_tipo, p_quem, p_identidade, p_versao, v_dia));
end $$;

/** A identidade da conta nasce ou muda: linha 'conta' ("r2:" + Ed25519 em base64). */
create or replace function interno.diretorio_kt_conta() returns trigger language plpgsql security definer set search_path = interno, pg_temp as $$
begin
  if tg_op = 'UPDATE' and old.identidade = new.identidade then return new; end if;
  perform interno.rede_kt_acrescentar('conta', interno.rede_kt_quem(new.usuario), 'r2:' || interno.caixa_b64(new.identidade), new.versao);
  return new;
end $$;
drop trigger if exists diretorio_kt_conta on interno.diretorio_contas;
create trigger diretorio_kt_conta after insert or update on interno.diretorio_contas for each row execute function interno.diretorio_kt_conta();

/** Um aparelho entra ou sai: linha 'aparelho' (chave do aparelho e o certificado) ou 'aparelho-fora'. */
create or replace function interno.diretorio_kt_aparelho() returns trigger language plpgsql security definer set search_path = interno, pg_temp as $$
begin
  if tg_op = 'DELETE' then
    perform interno.rede_kt_acrescentar('aparelho-fora', interno.rede_kt_quem(old.usuario), 'a2:' || interno.caixa_b64(old.aparelho), 1);
    return old;
  end if;
  if tg_op = 'UPDATE' and old.certificado = new.certificado then return new; end if;
  perform interno.rede_kt_acrescentar('aparelho', interno.rede_kt_quem(new.usuario), 'a2:' || interno.caixa_b64(new.aparelho) || ':' || interno.caixa_b64(new.certificado), 1);
  return new;
end $$;
drop trigger if exists diretorio_kt_aparelho on interno.diretorio_aparelhos;
create trigger diretorio_kt_aparelho after insert or update or delete on interno.diretorio_aparelhos for each row execute function interno.diretorio_kt_aparelho();

/**
 * A chave pública dos passes de um dia entra no registro (uma vez por dia; a rota chama ao servir a chave). Sem isso, o servidor
 * poderia dar uma chave a cada pessoa e reconhecer de quem é cada passe; com o registro, o aparelho só pede passes com a chave anotada.
 */
create or replace function public.rede_passes_chave_registrar(p_dia date, p_publica bytea) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v_quem text := encode(sha256(convert_to('alumia-kt:passes', 'UTF8')), 'base64'); v_id text; v_ja rede_kt;
begin
  if p_dia is null or p_dia not between interno.caixa_hoje() - 1 and interno.caixa_hoje() + 1
     or coalesce(octet_length(p_publica), 0) not between 33 and 97 then
    perform interno.erro('invalido:chave');
  end if;
  v_id := 'p2:' || to_char(p_dia, 'YYYY-MM-DD') || ':' || interno.caixa_b64(p_publica);
  perform pg_advisory_xact_lock(hashtext('rede_kt'));
  select * into v_ja from rede_kt where tipo = 'passes' and quem = v_quem and identidade like 'p2:' || to_char(p_dia, 'YYYY-MM-DD') || ':%' order by seq desc limit 1;
  if found then
    -- Uma chave por dia: outra chave para o mesmo dia é recusada (o segredo do servidor mudou no meio do dia: alarme).
    if v_ja.identidade <> v_id then perform interno.erro('chave_do_dia_diferente'); end if;
    return jsonb_build_object('ok', true, 'seq', v_ja.seq);
  end if;
  perform interno.rede_kt_acrescentar('passes', v_quem, v_id, 1);
  return jsonb_build_object('ok', true, 'seq', (select max(seq) from rede_kt));
end $$;

/** Um trecho do registro (até 1000 linhas depois de `p_desde`), agora com o tipo de cada linha. Público: qualquer um refaz a corrente. */
create or replace function public.rede_kt_trecho(p_desde bigint default 0) returns jsonb language sql stable security definer set search_path = interno, pg_temp as $$
  select coalesce(jsonb_agg(jsonb_build_object('seq', k.seq, 'tipo', k.tipo, 'quem', k.quem, 'identidade', k.identidade, 'versao', k.versao, 'dia', to_char(k.dia, 'YYYY-MM-DD'), 'resumo', k.resumo) order by k.seq), '[]'::jsonb)
  from (select * from rede_kt where seq > coalesce(p_desde, 0) order by seq limit 1000) k
$$;

-- ── 6. A denúncia com prova (franquia) ────────────────────────────────────────────────────────────────────────────────────

/**
 * Grava na fila da moderação uma denúncia de conversa com prova: a rota (app/api/alumia/franquia/denunciar) já conferiu a marca do
 * servidor e o compromisso da mensagem, e manda só os trechos escolhidos por quem denuncia, o dia e a conta que o aparelho atribui à
 * autoria. Quem denuncia (`p_quem`, da sessão conferida pela rota) nunca é mostrado à pessoa denunciada.
 */
-- A migração da denúncia com prova (20261124-r2-franquia.sql, que roda depois) troca esta função pela de (p_usuario uuid, p jsonb):
-- rodada de novo por cima dela, esta tira a de lá antes (o Postgres não troca o nome de um parâmetro com create or replace), e a da
-- franquia, que vem em seguida, volta a valer.
drop function if exists public.rede_franquia_denunciar(uuid, jsonb);
create or replace function public.rede_franquia_denunciar(p_quem uuid, p jsonb) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare
  v_autor uuid; v_cat text := p ->> 'categoria'; v_dia date; d rede_denuncias; v_texto text;
begin
  if p_quem is null or not interno.rede2_membro(p_quem) then perform interno.erro('consentimento'); end if;
  begin v_autor := (p ->> 'autor')::uuid; v_dia := (p ->> 'dia')::date; exception when others then perform interno.erro('invalido:denuncia'); end;
  if v_autor is null or v_autor = p_quem or not exists (select 1 from perfis where id = v_autor) then perform interno.erro('invalido:denuncia'); end if;
  if v_cat is null or v_cat not in ('menores', 'ameaca', 'exposicao', 'violencia', 'autolesao', 'odio', 'assedio', 'golpe', 'spam', 'outro') then perform interno.erro('invalido:categoria'); end if;
  v_texto := left('[Chat privado, com prova: o texto exato abaixo passou por uma caixa da conversa no dia ' || to_char(v_dia, 'DD/MM/YYYY')
    || '. Trechos escolhidos por quem denunciou.] ' || interno.txt(coalesce(p ->> 'trechos', ''), 'trechos', 1, 1800), 2000);
  select * into d from rede_denuncias where quem = p_quem and alvo_tipo = 'perfil' and alvo = v_autor::text and situacao in ('aberta', 'em_analise') limit 1;
  if found then
    update rede_denuncias set texto = left(texto || E'\n\n' || v_texto, 2000) where id = d.id returning * into d;
  else
    insert into rede_denuncias (alvo_tipo, alvo, categoria, prioridade, texto, quem)
    values ('perfil', v_autor::text, v_cat, interno.rede2_prioridade(v_cat), v_texto, p_quem) returning * into d;
  end if;
  return jsonb_build_object('protocolo', d.protocolo, 'prioridade', d.prioridade);
end $$;

-- ── 7. A limpeza diária ───────────────────────────────────────────────────────────────────────────────────────────────────

/** Tira o que passou do prazo: pacotes de mais de 30 dias, caixas vencidas, contagens, passes gastos de mais de 2 dias, marcas de ontem. */
create or replace function interno.rede_caixas_limpeza() returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v_hoje date := interno.caixa_hoje(); a integer; b integer; c integer; d integer; e integer; v_passes passes_gastos[];
begin
  delete from pacotes where dia < v_hoje - 30; get diagnostics a = row_count;
  -- A caixa de pedidos de uma conta não vence enquanto a conta estiver no diretório.
  delete from caixas k where k.vence < v_hoje
    and not exists (select 1 from diretorio_contas dc where interno.caixa_resumo('alumia/r2/caixa', dc.pedidos_caixa) = k.id_h);
  get diagnostics b = row_count;
  delete from caixa_contagem where dia < v_hoje - 1; get diagnostics c = row_count;
  delete from passes_gastos where dia < v_hoje - 2; get diagnostics d = row_count;
  delete from passes_emitidos where dia < v_hoje; get diagnostics e = row_count;
  -- Revisão final da R2 (metadados): com pouco tráfego, o xmin da caixa criada (e do passe gasto para criá-la) ficava colado ao da
  -- gravação com sessão da mesma conta, e uma cópia do banco ligava os dois. Uma vez por dia, as caixas e os passes gastos são
  -- regravados inteiros numa transação só (todas as linhas com o mesmo xmin), os passes em ordem sorteada (apaga e põe de volta,
  -- como a urna do voto). As caixas não podem sair e voltar (os pacotes dependem delas): são reescritas no lugar. Não apaga o que o
  -- WAL ou um gatilho do dono já viu; protege a cópia tirada depois da rotina.
  update caixas k set vence = k.vence from (select id_h from caixas order by gen_random_uuid()) s where s.id_h = k.id_h;
  select array_agg(p order by gen_random_uuid()) into v_passes from passes_gastos p;
  delete from passes_gastos;
  insert into passes_gastos (resumo, dia) select u.resumo, u.dia from unnest(coalesce(v_passes, '{}')) with ordinality as u(resumo, dia, o) order by u.o;
  return jsonb_build_object('pacotes', a, 'caixas', b, 'contagens', c, 'passes', d, 'marcas', e);
end $$;

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule('alumia-caixas-limpeza', '23 3 * * *', 'select interno.rede_caixas_limpeza()');
  end if;
exception when others then
  raise warning 'alumia-caixas-limpeza: a rotina não foi agendada (%).', sqlerrm;
end $$;

-- ── 8. Permissões ─────────────────────────────────────────────────────────────────────────────────────────────────────────
-- As funções das caixas, do diretório anônimo, dos passes gastos, do registro da chave e da denúncia com prova: só o servidor do site
-- (service_role). As do diretório com sessão e a marca dos passes: quem entrou (authenticated), com a porta. As de dentro: ninguém.

do $$
declare f record;
begin
  for f in select p.oid::regprocedure as assinatura, n.nspname as esquema, p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
           where (n.nspname = 'interno' and p.proname in ('caixa_hoje', 'caixa_resumo', 'caixa_b64', 'caixa_bytes', 'caixa_tamanho_ok',
                    'caixa_tamanho_pedido', 'caixa_vence', 'caixa_gastar', 'caixa_contar', 'diretorio_conta_de', 'diretorio_eu',
                    'rede_kt_resumo2', 'rede_kt_acrescentar', 'diretorio_kt_conta', 'diretorio_kt_aparelho', 'rede_caixas_limpeza'))
              or (n.nspname = 'public' and p.proname in ('rede_caixa_lote', 'rede_caixa_buscar', 'rede_caixa_confirmar', 'rede_caixa_trocar',
                    'rede_caixa_apagar', 'rede_passe_gastar', 'rede_diretorio_ler', 'rede_diretorio_reivindicar', 'rede_passes_chave_registrar',
                    'rede_franquia_denunciar', 'rede_diretorio_conta', 'rede_diretorio_publicar', 'rede_diretorio_pre_chaves',
                    'rede_diretorio_pacotes_mls', 'rede_diretorio_tirar_aparelho', 'rede_diretorio_apagar', 'rede_passes_marcar_hoje')) loop
    execute format('revoke all on function %s from public', f.assinatura);
    if exists (select 1 from pg_roles where rolname = 'anon') then
      execute format('revoke all on function %s from anon, authenticated', f.assinatura);
    end if;
    if f.esquema = 'public' and exists (select 1 from pg_roles where rolname = 'service_role')
       and f.proname in ('rede_caixa_lote', 'rede_caixa_buscar', 'rede_caixa_confirmar', 'rede_caixa_trocar', 'rede_caixa_apagar',
                         'rede_passe_gastar', 'rede_diretorio_ler', 'rede_diretorio_reivindicar', 'rede_passes_chave_registrar', 'rede_franquia_denunciar') then
      execute format('grant execute on function %s to service_role', f.assinatura);
    end if;
    if f.esquema = 'public' and exists (select 1 from pg_roles where rolname = 'authenticated')
       and f.proname in ('rede_diretorio_conta', 'rede_diretorio_publicar', 'rede_diretorio_pre_chaves', 'rede_diretorio_pacotes_mls',
                         'rede_diretorio_tirar_aparelho', 'rede_diretorio_apagar', 'rede_passes_marcar_hoje') then
      execute format('grant execute on function %s to authenticated', f.assinatura);
    end if;
  end loop;
end $$;

-- ── 9. A lista de exceções da porta ───────────────────────────────────────────────────────────────────────────────────────

/**
 * As funções que ficam SEM a porta, de propósito: a lista de 20261120-alumia-o14-banco.sql (sem tirar nenhum nome) mais as das caixas
 * anônimas (R2), que por desenho não usam a sessão de conta e só o servidor do site chama (execute só para service_role).
 */
create or replace function interno.alumia_porta_aberta(p_nome text, p_argumentos text) returns boolean language sql immutable as $$
  select p_nome in ('alumia_entrada_eu', 'alumia_entrada_pedir', 'alumia_triagem_contagem', 'alumia_triagem_fila', 'alumia_triagem_decidir',
                    'rede_situacao', 'rede_aderir', 'rede_codinome_definir', 'rede_confirmar_idade', 'rede_eu', 'rede_alumia_versao',
                    'rede_fed_situacao', 'rede_antigo',
                    -- Chamadas pelo servidor do site sem sessão, com o segredo da federação (Faixa 2): com a porta, o Fediverso para.
                    'rede_fed_servidor', 'rede_fed_midia_servidor', 'rede_fed_mudanca_servidor',
                    -- Quem teve a conta suspensa ou retida pede revisão (20261114-alumia-o8-lei.sql).
                    'alumia_lei_minha_conta', 'alumia_lei_recorrer_conta',
                    -- A marca "veio por convite" na triagem, que tem a regra dela (20261114-alumia-o8-porta.sql).
                    'alumia_triagem_convites',
                    -- O relatório de transparência, público como a página (20261115-alumia-o9-transparencia.sql).
                    'alumia_transparencia',
                    -- Faixa 2: o envelope selado é anônimo por desenho (quem deposita não se identifica), e o registro público das
                    -- chaves é conferido por qualquer pessoa. As outras rede_olm_*, rede_mls_*
                    -- e rede_sel_* ficam com a porta.
                    'rede_sel_depositar', 'rede_kt_ponta', 'rede_kt_trecho',
                    -- R2, caixas anônimas: sem sessão de conta por desenho; só o servidor do site chama (execute só para service_role).
                    'rede_caixa_lote', 'rede_caixa_buscar', 'rede_caixa_confirmar', 'rede_caixa_trocar', 'rede_caixa_apagar',
                    'rede_passe_gastar', 'rede_diretorio_ler', 'rede_diretorio_reivindicar', 'rede_passes_chave_registrar',
                    'rede_franquia_denunciar')
      or (p_nome in ('rede_linha', 'rede_novos') and coalesce(p_argumentos, '') like 'p_aba text%')
      -- O diretório das organizações com selo e o mapa dele (20261113-alumia-o7-entrada.sql, decisão de 12/11).
      or (p_nome = 'rede_org_diretorio' and coalesce(p_argumentos, '') = 'p jsonb')
      or (p_nome = 'rede_org_mapa' and coalesce(p_argumentos, '') = '')
$$;
revoke all on function interno.alumia_porta_aberta(text, text) from public;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on function interno.alumia_porta_aberta(text, text) from anon, authenticated;
  end if;
end $$;

-- O registro público (rede_kt_trecho) foi redefinido acima: fica sem a porta e com o execute de todo mundo, como antes.
select interno.alumia_destrancar('rede_kt_trecho');
do $$
declare f record;
begin
  for f in select p.oid::regprocedure as assinatura from pg_proc p join pg_namespace n on n.oid = p.pronamespace
           where n.nspname = 'public' and p.proname = 'rede_kt_trecho' loop
    execute format('revoke all on function %s from public', f.assinatura);
    if exists (select 1 from pg_roles where rolname = 'anon') then
      execute format('grant execute on function %s to anon, authenticated', f.assinatura);
    end if;
  end loop;
end $$;

-- ── 10. A porta ───────────────────────────────────────────────────────────────────────────────────────────────────────────
do $$
declare v jsonb := interno.alumia_trancar();
begin
  if jsonb_array_length(coalesce(v -> 'abertas', '[]'::jsonb)) > 0 then
    raise warning 'alumia_trancar: função sem porta: %', v -> 'abertas';
  end if;
end $$;
select interno.alumia_trancar();
