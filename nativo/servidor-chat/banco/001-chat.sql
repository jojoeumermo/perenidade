-- Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
--
-- ═══════════════════════ Alumia · O banco PRÓPRIO do servidor do chat (onda R3, item 3.1) ═══════════════════════
-- Um Postgres separado do da rede social (não é o Supabase e não entra no supabase/install.sql). Pode rodar mais de uma vez.
-- As tabelas e a lógica são as das caixas anônimas da R2 (supabase/migracoes/20261124-r2-caixas.sql: interno.caixas, pacotes,
-- caixa_contagem, passes_gastos e as funções do lote), PORTADAS para o esquema "chat", com três mudanças:
--   1. a caixa de pedidos de conversa é uma caixa como as outras, marcada na criação ("pedidos"): nela só entra o item "pedido", que
--      paga um passe anônimo e a prova de trabalho (ou só a prova de trabalho maior, para quem vem de outra instância, item 2.7).
--      O servidor do chat não sabe de quem é a caixa de pedidos (não tem diretório nem conta nenhuma);
--   2. o cofre anônimo (a lista sincronizada e a cópia de segurança da R2 saem da conta): uma caixa de um lugar só, cujo id e passes
--      o aparelho tira da chave de sincronia; o servidor não sabe de qual conta é;
--   3. nada de sessão, porta, perfis ou registro: este banco não tem conta nenhuma. Quem administra a rede social não tem acesso.
-- O servidor (nativo/servidor-chat) entra com o papel chat_servidor, que só executa as funções (não lê nem escreve tabela direto).
-- Endereço de rede: nada daqui lê ou guarda. Nenhum número de pessoas. Nenhuma hora (só o DIA do pacote).
-- Leis: LGPD art. 6º, III (necessidade), art. 46 (segurança), art. 16 (eliminação: o pacote some ao ser entregue e em 30 dias);
-- Marco Civil art. 10 (sigilo das comunicações privadas).

create extension if not exists pgcrypto with schema public;
create schema if not exists chat;
revoke all on schema chat from public;

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'chat_servidor') then
    create role chat_servidor login;
  end if;
end $$;
grant usage on schema chat to chat_servidor;

-- ── 1. Tabelas ─────────────────────────────────────────────────────────────────────────────────────────────────────────────

create table if not exists chat.caixas (
  id_h bytea primary key check (octet_length(id_h) = 32),
  pd_h bytea not null check (octet_length(pd_h) = 32),
  pd_anterior_h bytea check (pd_anterior_h is null or octet_length(pd_anterior_h) = 32),
  pd_anterior_ate date,
  pl_h bytea not null check (octet_length(pl_h) = 32),
  multi boolean not null,
  -- A caixa de pedidos de conversa: só aceita o item "pedido" (com passe e prova, ou prova maior).
  pedidos boolean not null default false,
  unico_feito boolean not null default false,
  proxima integer not null default 1 check (proxima > 0),
  vence date not null
);
alter table chat.caixas add column if not exists pedidos boolean not null default false;

create table if not exists chat.pacotes (
  id bytea primary key check (octet_length(id) = 16),
  caixa_h bytea not null references chat.caixas (id_h) on delete cascade,
  ordem integer not null check (ordem > 0),
  envelope bytea not null,
  franquia bytea check (franquia is null or octet_length(franquia) = 32),
  marca bytea check (marca is null or octet_length(marca) = 32),
  unico boolean not null default false,
  dia date not null,
  unique (caixa_h, ordem)
);

create table if not exists chat.caixa_contagem (
  caixa_h bytea not null,
  dia date not null,
  n integer not null default 0,
  primary key (caixa_h, dia)
);

create table if not exists chat.passes_gastos (
  resumo bytea primary key check (octet_length(resumo) = 32),
  dia date not null
);

create table if not exists chat.cofres (
  id_h bytea primary key check (octet_length(id_h) = 32),
  pd_h bytea not null check (octet_length(pd_h) = 32),
  pl_h bytea not null check (octet_length(pl_h) = 32),
  versao integer not null check (versao > 0),
  blob bytea not null,
  dia date not null
);

revoke all on chat.caixas, chat.pacotes, chat.caixa_contagem, chat.passes_gastos, chat.cofres from public, chat_servidor;

-- ── 2. Peças de dentro ─────────────────────────────────────────────────────────────────────────────────────────────────────

create or replace function chat.hoje() returns date language sql stable set search_path = chat, pg_temp as $$
  select (now() at time zone 'utc')::date
$$;

create or replace function chat.resumo(p_rotulo text, p_valor bytea) returns bytea language sql immutable set search_path = chat, pg_temp as $$
  select sha256(convert_to(p_rotulo, 'UTF8') || p_valor)
$$;

create or replace function chat.b64(p bytea) returns text language sql immutable set search_path = chat, pg_temp as $$
  select replace(encode(p, 'base64'), E'\n', '')
$$;

create or replace function chat.bytes(p text) returns bytea language plpgsql immutable set search_path = chat, pg_temp as $$
declare v text := translate(coalesce(p, ''), '-_', '+/');
begin
  if v = '' or v !~ '^[A-Za-z0-9+/]+=*$' then return null; end if;
  v := rtrim(v, '=');
  v := v || repeat('=', (4 - char_length(v) % 4) % 4);
  return decode(v, 'base64');
exception when others then
  return null;
end $$;

/** Os tamanhos aceitos do envelope (os mesmos de lib/rede/caixas/tamanhos.ts e de interno.caixa_tamanho_ok). */
create or replace function chat.tamanho_ok(p_tamanho integer) returns boolean language sql immutable set search_path = chat, pg_temp as $$
  select p_tamanho in (3184, 5232, 9328, 17520, 25712, 33904, 2098, 8242, 32818, 131122, 66672)
$$;

/** O tamanho do pedido de conversa (HPKE X-Wing completado a 4096). */
create or replace function chat.tamanho_pedido() returns integer language sql immutable set search_path = chat, pg_temp as $$
  select 5232
$$;

/** Os tamanhos do cofre (os mesmos de interno.rede_cofre_tamanho_ok da R2). */
create or replace function chat.cofre_tamanho_ok(p_bytes integer) returns boolean language sql immutable set search_path = chat, pg_temp as $$
  select p_bytes in (select 33 + 24 + f + 17 * (f / 65536) from unnest(array[65536, 262144, 1048576, 4194304]) f)
$$;

create or replace function chat.vence() returns date language sql stable set search_path = chat, pg_temp as $$
  select (date_trunc('week', chat.hoje()::timestamp)::date + 63)
$$;

create or replace function chat.gastar(p_resumo bytea) returns boolean language plpgsql security definer set search_path = chat, pg_temp as $$
declare v integer;
begin
  if p_resumo is null or octet_length(p_resumo) <> 32 then return false; end if;
  insert into passes_gastos (resumo, dia) values (p_resumo, chat.hoje()) on conflict (resumo) do nothing;
  get diagnostics v = row_count;
  return v = 1;
end $$;

/**
 * O teto de depósitos por caixa. Na caixa de PEDIDOS de conversa, nada de contagem por dia (quem lê o diretório público pelo codinome
 * liga a caixa de pedidos à conta, e a contagem diria quantos pedidos cada conta recebeu por dia): o teto é o que está nela esperando
 * leitura (300). Nas outras, a contagem por dia (auditoria interna da R3; o mesmo de interno.caixa_contar no banco do site).
 */
create or replace function chat.contar(p_caixa_h bytea, p_multi boolean, p_pedidos boolean) returns boolean language plpgsql security definer set search_path = chat, pg_temp as $$
declare v_n integer;
begin
  if p_pedidos then
    return (select count(*) from pacotes where caixa_h = p_caixa_h) < 300;
  end if;
  insert into caixa_contagem (caixa_h, dia, n) values (p_caixa_h, chat.hoje(), 1)
  on conflict (caixa_h, dia) do update set n = caixa_contagem.n + 1 returning n into v_n;
  return v_n <= case when p_multi then 5000 else 1000 end;
end $$;
-- A contagem por dia que já estava gravada para as caixas de pedidos sai.
delete from chat.caixa_contagem c using chat.caixas x where x.pedidos and c.caixa_h = x.id_h;

/** Gasta todos os resumos da lista (passe e/ou desafio); false se algum já foi gasto (os outros também ficam gastos: não há volta). */
create or replace function chat.gastar_todos(p_lista jsonb) returns boolean language plpgsql security definer set search_path = chat, pg_temp as $$
declare v_ok boolean := true; x jsonb;
begin
  if p_lista is null or jsonb_typeof(p_lista) <> 'array' or jsonb_array_length(p_lista) not between 1 and 2 then return false; end if;
  for x in select * from jsonb_array_elements(p_lista) loop
    v_ok := chat.gastar(chat.bytes(x #>> '{}')) and v_ok;
  end loop;
  return v_ok;
end $$;

-- ── 3. As caixas ───────────────────────────────────────────────────────────────────────────────────────────────────────────

/**
 * Um lote: criações, depósitos e pedidos de vários pedidos HTTP, gravados numa transação só e em ordem sorteada (o mesmo xmin para
 * todos; a posição no disco não diz quem chegou antes). `p_dia` é o dia (UTC) com que o servidor calculou a marca da franquia.
 *   {acao:'criar', id_h, pd_h, pl_h, multi, pedidos?, gastos:[resumo do passe ou do desafio]}
 *   {acao:'depositar', id_h, pd, envelope, franquia?, marca?, unico?}
 *   {acao:'pedido', id_h, pd, envelope, marca?, gastos:[resumos do passe e/ou do desafio]}
 * O servidor confere passe e prova ANTES (só manda o resumo a gastar). Depósito com passe errado (ou em caixa que não existe)
 * responde {ok:true} como o certo e não grava nada.
 */
create or replace function chat.caixa_lote(p_itens jsonb, p_dia date) returns jsonb language plpgsql security definer set search_path = chat, pg_temp as $$
declare
  v_hoje date := chat.hoje();
  v_n integer; i integer; x jsonb; v_res jsonb[];
  v_acao text; v_idh bytea; v_pd bytea; v_pdh bytea; v_plh bytea; v_env bytea; v_fr bytea; v_marca bytea; v_unico boolean; v_multi boolean; v_pedidos boolean;
  c caixas; v_existe caixas;
  n_idh bytea[] := '{}'; n_pdh bytea[] := '{}'; n_plh bytea[] := '{}'; n_multi boolean[] := '{}'; n_ped boolean[] := '{}';
  p_caixa bytea[] := '{}'; p_ordem integer[] := '{}'; p_env bytea[] := '{}'; p_fr bytea[] := '{}'; p_marca bytea[] := '{}'; p_unico boolean[] := '{}';
begin
  if p_itens is null or jsonb_typeof(p_itens) <> 'array' then raise exception 'invalido:itens'; end if;
  v_n := jsonb_array_length(p_itens);
  if v_n < 1 or v_n > 64 then raise exception 'invalido:itens'; end if;
  if p_dia is null or p_dia not between v_hoje - 1 and v_hoje + 1 then raise exception 'invalido:dia'; end if;
  v_res := array_fill(null::jsonb, array[v_n]);

  -- 1. As criações primeiro, em ordem sorteada.
  for i in select k from generate_series(0, v_n - 1) k order by public.gen_random_bytes(8) loop
    x := p_itens -> i;
    if coalesce(x ->> 'acao', '') <> 'criar' then continue; end if;
    v_idh := chat.bytes(x ->> 'id_h'); v_pdh := chat.bytes(x ->> 'pd_h'); v_plh := chat.bytes(x ->> 'pl_h');
    v_multi := case x ->> 'multi' when 'true' then true when 'false' then false end;
    v_pedidos := coalesce(x ->> 'pedidos', 'false') = 'true';
    if octet_length(v_idh) is distinct from 32 or octet_length(v_pdh) is distinct from 32 or octet_length(v_plh) is distinct from 32 or v_multi is null
       or (v_pedidos and v_multi) or jsonb_typeof(x -> 'gastos') is distinct from 'array' or jsonb_array_length(x -> 'gastos') <> 1 then
      v_res[i + 1] := jsonb_build_object('ok', false, 'erro', 'invalido'); continue;
    end if;
    select * into v_existe from caixas where id_h = v_idh;
    if found or v_idh = any (n_idh) then
      if found and v_existe.pd_h = v_pdh and v_existe.pl_h = v_plh and v_existe.multi = v_multi and v_existe.pedidos = v_pedidos then
        v_res[i + 1] := jsonb_build_object('ok', true);
      else
        v_res[i + 1] := jsonb_build_object('ok', false, 'erro', 'existe');
      end if;
      continue;
    end if;
    if not chat.gastar_todos(x -> 'gastos') then v_res[i + 1] := jsonb_build_object('ok', false, 'erro', 'passe_usado'); continue; end if;
    n_idh := n_idh || v_idh; n_pdh := n_pdh || v_pdh; n_plh := n_plh || v_plh; n_multi := n_multi || v_multi; n_ped := n_ped || v_pedidos;
    v_res[i + 1] := jsonb_build_object('ok', true);
  end loop;
  insert into caixas (id_h, pd_h, pl_h, multi, pedidos, vence)
  select u.idh, u.pdh, u.plh, u.multi, u.ped, chat.vence()
  from unnest(n_idh, n_pdh, n_plh, n_multi, n_ped) as u (idh, pdh, plh, multi, ped)
  order by public.gen_random_bytes(8);

  -- 2. Os depósitos e os pedidos, em ordem sorteada.
  for i in select k from generate_series(0, v_n - 1) k order by public.gen_random_bytes(8) loop
    x := p_itens -> i;
    v_acao := coalesce(x ->> 'acao', '');
    if v_acao = 'criar' then continue; end if;
    if v_acao not in ('depositar', 'pedido') then v_res[i + 1] := jsonb_build_object('ok', false, 'erro', 'invalido'); continue; end if;
    v_env := chat.bytes(x ->> 'envelope');
    v_fr := case when x ? 'franquia' and x ->> 'franquia' is not null then chat.bytes(x ->> 'franquia') end;
    v_marca := case when x ? 'marca' and x ->> 'marca' is not null then chat.bytes(x ->> 'marca') end;
    v_idh := chat.bytes(x ->> 'id_h'); v_pd := chat.bytes(x ->> 'pd');
    v_unico := v_acao = 'depositar' and coalesce(x ->> 'unico', 'false') = 'true';
    if (x ? 'franquia' and x ->> 'franquia' is not null and octet_length(v_fr) is distinct from 32)
       or (x ? 'marca' and x ->> 'marca' is not null and octet_length(v_marca) is distinct from 32)
       or octet_length(v_idh) is distinct from 32 or octet_length(v_pd) is distinct from 32 then
      v_res[i + 1] := jsonb_build_object('ok', false, 'erro', 'invalido'); continue;
    end if;
    if v_env is null or (v_acao = 'pedido' and octet_length(v_env) <> chat.tamanho_pedido()) or not chat.tamanho_ok(octet_length(v_env)) then
      v_res[i + 1] := jsonb_build_object('ok', false, 'erro', 'tamanho'); continue;
    end if;
    v_pdh := chat.resumo('alumia/r2/passe-deposito', v_pd);
    select * into c from caixas where id_h = v_idh for update;
    if not found or not coalesce(c.pd_h = v_pdh or (c.pd_anterior_h = v_pdh and c.pd_anterior_ate >= v_hoje), false) then
      -- Passe errado, trocado no bloqueio ou caixa que não existe: igual ao certo, e nada é gravado (o pedido também não gasta nada).
      v_res[i + 1] := jsonb_build_object('ok', true); continue;
    end if;
    if c.pedidos and v_acao <> 'pedido' then v_res[i + 1] := jsonb_build_object('ok', false, 'erro', 'pedido'); continue; end if;
    if v_acao = 'pedido' then
      if not c.pedidos then v_res[i + 1] := jsonb_build_object('ok', false, 'erro', 'invalido'); continue; end if;
      if not chat.gastar_todos(x -> 'gastos') then v_res[i + 1] := jsonb_build_object('ok', false, 'erro', 'passe_usado'); continue; end if;
    end if;
    if v_unico and c.unico_feito then v_res[i + 1] := jsonb_build_object('ok', false, 'erro', 'ocupada'); continue; end if;
    if not chat.contar(v_idh, c.multi, c.pedidos) then v_res[i + 1] := jsonb_build_object('ok', false, 'erro', 'cheia'); continue; end if;
    update caixas set proxima = proxima + 1, unico_feito = unico_feito or v_unico where id_h = v_idh returning * into c;
    p_caixa := p_caixa || v_idh; p_ordem := p_ordem || (c.proxima - 1); p_env := p_env || v_env; p_fr := p_fr || v_fr;
    p_marca := p_marca || v_marca; p_unico := p_unico || v_unico;
    v_res[i + 1] := jsonb_build_object('ok', true);
  end loop;

  insert into pacotes (id, caixa_h, ordem, envelope, franquia, marca, unico, dia)
  select public.gen_random_bytes(16), u.caixa, u.ordem, u.env, u.fr, u.marca, u.unico, p_dia
  from unnest(p_caixa, p_ordem, p_env, p_fr, p_marca, p_unico) as u (caixa, ordem, env, fr, marca, unico)
  order by public.gen_random_bytes(8);

  return jsonb_build_object('resultados', to_jsonb(v_res));
end $$;

create or replace function chat.caixa_buscar(p_id_h bytea, p_pl bytea, p_cursor integer) returns jsonb language plpgsql security definer set search_path = chat, pg_temp as $$
declare c caixas; v_vence date := chat.vence();
begin
  if octet_length(p_id_h) is distinct from 32 or octet_length(p_pl) is distinct from 32 then return jsonb_build_object('pacotes', '[]'::jsonb); end if;
  select * into c from caixas where id_h = p_id_h;
  if not found or c.pl_h <> chat.resumo('alumia/r2/passe-leitura', p_pl) then return jsonb_build_object('pacotes', '[]'::jsonb); end if;
  if c.vence < v_vence then update caixas set vence = v_vence where id_h = p_id_h; end if;
  return jsonb_build_object('pacotes', coalesce((
    select jsonb_agg(jsonb_build_object('ordem', k.ordem, 'envelope', chat.b64(k.envelope),
             'franquia', case when k.franquia is null then null else chat.b64(k.franquia) end,
             'marca', case when k.marca is null then null else chat.b64(k.marca) end,
             'unico', k.unico, 'dia', to_char(k.dia, 'YYYY-MM-DD')) order by k.ordem)
    from (select * from pacotes where caixa_h = p_id_h and ordem > greatest(coalesce(p_cursor, 0), 0)
            and dia >= chat.hoje() - 30 order by ordem limit 50) k), '[]'::jsonb));
end $$;

create or replace function chat.caixa_confirmar(p_id_h bytea, p_pl bytea, p_ate integer) returns jsonb language plpgsql security definer set search_path = chat, pg_temp as $$
declare c caixas;
begin
  if octet_length(p_id_h) is distinct from 32 or octet_length(p_pl) is distinct from 32 then return jsonb_build_object('ok', true); end if;
  select * into c from caixas where id_h = p_id_h;
  if found and c.pl_h = chat.resumo('alumia/r2/passe-leitura', p_pl) and not c.multi then
    delete from pacotes where caixa_h = p_id_h and ordem <= coalesce(p_ate, 0);
  end if;
  return jsonb_build_object('ok', true);
end $$;

create or replace function chat.caixa_trocar(p_id_h bytea, p_pl bytea, p_pd_h_novo bytea, p_pl_h_novo bytea, p_bloqueio boolean) returns jsonb language plpgsql security definer set search_path = chat, pg_temp as $$
declare c caixas;
begin
  if octet_length(p_id_h) is distinct from 32 or octet_length(p_pl) is distinct from 32
     or (p_pd_h_novo is not null and octet_length(p_pd_h_novo) <> 32) or (p_pl_h_novo is not null and octet_length(p_pl_h_novo) <> 32)
     or (p_pd_h_novo is null and p_pl_h_novo is null) then
    return jsonb_build_object('ok', false, 'erro', 'invalido');
  end if;
  select * into c from caixas where id_h = p_id_h for update;
  if not found or c.pl_h <> chat.resumo('alumia/r2/passe-leitura', p_pl) then return jsonb_build_object('ok', false, 'erro', 'nao_encontrada'); end if;
  if p_pd_h_novo is not null and p_pd_h_novo <> c.pd_h then
    update caixas set pd_anterior_h = case when coalesce(p_bloqueio, false) then null else c.pd_h end,
                      pd_anterior_ate = case when coalesce(p_bloqueio, false) then null else chat.hoje() + 7 end,
                      pd_h = p_pd_h_novo
    where id_h = p_id_h;
  elsif p_pd_h_novo is not null and coalesce(p_bloqueio, false) then
    update caixas set pd_anterior_h = null, pd_anterior_ate = null where id_h = p_id_h;
  end if;
  if p_pl_h_novo is not null then update caixas set pl_h = p_pl_h_novo where id_h = p_id_h; end if;
  return jsonb_build_object('ok', true);
end $$;

create or replace function chat.caixa_apagar(p_id_h bytea, p_pl bytea) returns jsonb language plpgsql security definer set search_path = chat, pg_temp as $$
begin
  if octet_length(p_id_h) is distinct from 32 or octet_length(p_pl) is distinct from 32 then return jsonb_build_object('ok', true); end if;
  delete from caixas where id_h = p_id_h and pl_h = chat.resumo('alumia/r2/passe-leitura', p_pl);
  delete from caixa_contagem where caixa_h = p_id_h and not exists (select 1 from caixas where id_h = p_id_h);
  return jsonb_build_object('ok', true);
end $$;

-- ── 4. O cofre anônimo ─────────────────────────────────────────────────────────────────────────────────────────────────────

/** Lê o cofre (quem tem o passe de leitura). Passe errado ou cofre que não existe: nulo, igual. */
create or replace function chat.cofre_ler(p_id_h bytea, p_pl bytea) returns jsonb language plpgsql security definer set search_path = chat, pg_temp as $$
declare c cofres;
begin
  if octet_length(p_id_h) is distinct from 32 or octet_length(p_pl) is distinct from 32 then return null; end if;
  select * into c from cofres where id_h = p_id_h;
  if not found or c.pl_h <> chat.resumo('alumia/r3/cofre-anonimo/leitura/v1', p_pl) then return null; end if;
  return jsonb_build_object('versao', c.versao, 'blob', chat.b64(c.blob), 'dia', to_char(c.dia, 'YYYY-MM-DD'));
end $$;

/**
 * Grava o cofre. `p_versao` é a versão que o aparelho leu (0 = não havia): se outro aparelho gravou antes, 'versao_ocupada'. Criar
 * (versão 0) gasta um passe ou uma prova (`p_gasto`) e fixa os resumos dos passes; depois, só quem tem o passe de gravação grava.
 */
create or replace function chat.cofre_gravar(p_id_h bytea, p_pd bytea, p_pd_h bytea, p_pl_h bytea, p_versao integer, p_blob bytea, p_gasto bytea) returns jsonb language plpgsql security definer set search_path = chat, pg_temp as $$
declare c cofres;
begin
  if octet_length(p_id_h) is distinct from 32 or octet_length(p_pd) is distinct from 32 or p_versao is null or p_versao < 0 then
    return jsonb_build_object('ok', false, 'erro', 'invalido');
  end if;
  if p_blob is null or not chat.cofre_tamanho_ok(octet_length(p_blob)) then return jsonb_build_object('ok', false, 'erro', 'tamanho'); end if;
  select * into c from cofres where id_h = p_id_h for update;
  if not found then
    if p_versao <> 0 then return jsonb_build_object('ok', false, 'erro', 'versao_ocupada'); end if;
    if octet_length(p_pd_h) is distinct from 32 or octet_length(p_pl_h) is distinct from 32 or p_pd_h <> chat.resumo('alumia/r3/cofre-anonimo/deposito/v1', p_pd) then
      return jsonb_build_object('ok', false, 'erro', 'invalido');
    end if;
    if not chat.gastar(p_gasto) then return jsonb_build_object('ok', false, 'erro', 'passe'); end if;
    insert into cofres (id_h, pd_h, pl_h, versao, blob, dia) values (p_id_h, p_pd_h, p_pl_h, 1, p_blob, chat.hoje());
    return jsonb_build_object('ok', true, 'versao', 1);
  end if;
  if c.pd_h <> chat.resumo('alumia/r3/cofre-anonimo/deposito/v1', p_pd) then return jsonb_build_object('ok', false, 'erro', 'nao_encontrado'); end if;
  if c.versao <> p_versao then return jsonb_build_object('ok', false, 'erro', 'versao_ocupada'); end if;
  update cofres set versao = versao + 1, blob = p_blob, dia = chat.hoje() where id_h = p_id_h;
  return jsonb_build_object('ok', true, 'versao', p_versao + 1);
end $$;

create or replace function chat.cofre_apagar(p_id_h bytea, p_pl bytea) returns jsonb language plpgsql security definer set search_path = chat, pg_temp as $$
begin
  if octet_length(p_id_h) is distinct from 32 or octet_length(p_pl) is distinct from 32 then return jsonb_build_object('ok', true); end if;
  delete from cofres where id_h = p_id_h and pl_h = chat.resumo('alumia/r3/cofre-anonimo/leitura/v1', p_pl);
  return jsonb_build_object('ok', true);
end $$;

-- ── 5. A limpeza (o servidor chama uma vez por dia) ────────────────────────────────────────────────────────────────────────

create or replace function chat.limpeza() returns jsonb language plpgsql security definer set search_path = chat, pg_temp as $$
declare a integer; b integer; c integer; d integer; e integer;
begin
  delete from pacotes where dia < chat.hoje() - 30; get diagnostics a = row_count;
  delete from caixas where vence < chat.hoje(); get diagnostics b = row_count;
  delete from caixa_contagem where dia < chat.hoje() - 1; get diagnostics c = row_count;
  -- O passe vale duas semanas (a da chave e a seguinte) e o desafio 10 minutos: 21 dias de resumo bastam para recusar o repetido.
  delete from passes_gastos where dia < chat.hoje() - 21; get diagnostics d = row_count;
  -- O cofre que ninguém grava há um ano some.
  delete from cofres where dia < chat.hoje() - 365; get diagnostics e = row_count;
  update caixas set pd_anterior_h = null, pd_anterior_ate = null where pd_anterior_ate < chat.hoje();
  return jsonb_build_object('pacotes', a, 'caixas', b, 'contagens', c, 'gastos', d, 'cofres', e);
end $$;

-- ── 6. Permissões: o servidor só executa as funções de fora; as peças de dentro não são de ninguém ──────────────────────────

do $$
declare f record;
begin
  for f in select p.oid::regprocedure as assinatura, p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'chat' loop
    execute format('revoke all on function %s from public', f.assinatura);
    if f.proname in ('caixa_lote', 'caixa_buscar', 'caixa_confirmar', 'caixa_trocar', 'caixa_apagar', 'cofre_ler', 'cofre_gravar', 'cofre_apagar', 'limpeza') then
      execute format('grant execute on function %s to chat_servidor', f.assinatura);
    else
      execute format('revoke all on function %s from chat_servidor', f.assinatura);
    end if;
  end loop;
end $$;
