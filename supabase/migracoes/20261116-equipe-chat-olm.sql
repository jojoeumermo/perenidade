-- Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
--
-- Chat da equipe (painel) na biblioteca do Matrix. Documento: docs/CONVERSAS-DA-EQUIPE.md ("A cifra").
--
-- Até aqui as conversas da equipe usavam cifra montada à mão (ECDH + HKDF + AES-GCM, o "w1", e mensagens "c2" com a chave da
-- versão). Agora:
--   - as MENSAGENS vão em Megolm ("e1"), pela biblioteca do Matrix (@matrix-org/matrix-sdk-crypto-wasm): chave nova a cada
--     mensagem, e as chaves de cada sessão vão de aparelho para aparelho por Olm (Double Ratchet);
--   - a IDENTIDADE repassada a um aparelho aprovado vai em HPKE ("h1", RFC 9180, biblioteca @hpke), no modo autenticado.
-- O banco faz só o papel de servidor que a biblioteca precisa, POR APARELHO (a equipe usa vários aparelhos por conta): as chaves
-- públicas Olm de cada aparelho aprovado (com o certificado da identidade da pessoa, que só os aparelhos conferem), as chaves de
-- uso único, a caixa de recados cifrados e os pedidos de chave (um aparelho novo pede a chave de uma sessão antiga, e um aparelho
-- de quem está na conversa repassa, por Olm, só se o pedido vier de aparelho certificado).
--
-- As funções novas se chamam equipe_chat_*: são do painel (só equipe), fora da porta de entrada da Alumia. Ninguém usa o chat
-- da equipe ainda (13/11/2026): não há dado a converter. As mensagens "c2" e os embrulhos "w1" antigos continuam só para leitura.
-- Pode rodar de novo.

-- ── 1. O embrulho da identidade aceita o "h1" (HPKE) ─────────────────────────────────────────────────────────────────────────

do $$
declare r record;
begin
  for r in select conname from pg_constraint
           where conrelid = 'interno.chat_aparelhos'::regclass and contype = 'c' and pg_get_constraintdef(oid) like '%identidade_embrulho%' loop
    execute format('alter table interno.chat_aparelhos drop constraint %I', r.conname);
  end loop;
end $$;
alter table interno.chat_aparelhos add constraint chat_aparelhos_identidade_embrulho_formato check (
  identidade_embrulho is null
  or identidade_embrulho ~ '^w1[.][A-Za-z0-9_-]{16}[.][A-Za-z0-9_-]{64}$'
  or (identidade_embrulho ~ '^h1[.][A-Za-z0-9_-]+[.][A-Za-z0-9_-]+$' and char_length(split_part(identidade_embrulho, '.', 2)) = 87 and char_length(split_part(identidade_embrulho, '.', 3)) = 64)
);

/** Um embrulho válido: o "h1" (HPKE, o novo) ou o "w1" (o antigo). */
create or replace function interno.equipe_chat_embrulho_ok(p text) returns boolean language sql immutable as $$
  select coalesce(p, '') ~ '^w1[.][A-Za-z0-9_-]{16}[.][A-Za-z0-9_-]{64}$'
      or (coalesce(p, '') ~ '^h1[.][A-Za-z0-9_-]+[.][A-Za-z0-9_-]+$' and char_length(split_part(p, '.', 2)) = 87 and char_length(split_part(p, '.', 3)) = 64)
$$;

create or replace function public.chat_aparelho_aprovar(p_id uuid, p_por uuid, p_certificado text, p_identidade_embrulho text) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); v_publica text; a chat_aparelhos;
begin
  select publica into v_publica from chat_aparelhos where id = p_por and usuario = v and certificado is not null;
  if v_publica is null then perform interno.erro('aparelho_desconhecido'); end if;
  if coalesce(p_certificado, '') !~ '^[A-Za-z0-9_-]{86}$' then perform interno.erro('invalido:certificado'); end if;
  if not interno.equipe_chat_embrulho_ok(p_identidade_embrulho) then perform interno.erro('invalido:embrulho'); end if;
  update chat_aparelhos set certificado = p_certificado, aprovado_por = p_por, aprovado_publica = v_publica, aprovado_em = now(), identidade_embrulho = p_identidade_embrulho, pedido = null
  where id = p_id and usuario = v and certificado is null and id <> p_por returning * into a;
  if not found then perform interno.erro('nao_encontrado'); end if;
  perform interno.registrar('chat_aparelho_aprovado', v::text, jsonb_build_object('rotulo', a.rotulo));
  return interno.chat_aparelho_json(a);
end $$;

-- ── 2. As mensagens "e1" (Megolm) ────────────────────────────────────────────────────────────────────────────────────────────
-- "e1.<versão>.<sessão (43)>.<cifrado Megolm>". A versão continua sendo a da conversa (a troca quando alguém sai): cada versão é
-- uma "sala" própria para a biblioteca, com sessão nova.

do $$
declare r record;
begin
  for r in select conname from pg_constraint
           where conrelid = 'interno.conversa_mensagens'::regclass and contype = 'c' and pg_get_constraintdef(oid) like '%char_length(corpo)%' loop
    execute format('alter table interno.conversa_mensagens drop constraint %I', r.conname);
  end loop;
end $$;
alter table interno.conversa_mensagens add constraint conversa_mensagens_corpo_tamanho check (char_length(corpo) between 1 and 12000);

create or replace function interno.chat_versao_valida(p_conversa uuid, p_corpo text) returns integer language plpgsql stable security definer set search_path = interno, pg_temp as $$
declare v_versao integer;
begin
  if char_length(coalesce(p_corpo, '')) > 12000 or not (
       coalesce(p_corpo, '') ~ '^c2[.][1-9][0-9]{0,6}[.][A-Za-z0-9_-]{16}[.][A-Za-z0-9_-]{23,}$'
       or (coalesce(p_corpo, '') ~ '^e1[.][1-9][0-9]{0,6}[.][A-Za-z0-9+/]+[.][A-Za-z0-9+/]+$' and char_length(split_part(p_corpo, '.', 3)) = 43)) then
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

/**
 * Uma versão nova da conversa, para as mensagens "e1": a chave vai pela biblioteca (Olm), então aqui não há embrulho nenhum, só
 * a marca de que a versão existe. Mesmas regras de chat_chave_nova: aparelho aprovado, uma por vez, nunca abaixo da mínima.
 */
create or replace function public.equipe_chat_versao_nova(p_conversa uuid, p_aparelho uuid, p_versao integer) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); v_minima integer; v_maxima integer;
begin
  if not interno.na_conversa(p_conversa) then perform interno.erro('nao_encontrado'); end if;
  if not exists (select 1 from chat_aparelhos where id = p_aparelho and usuario = v and certificado is not null) then perform interno.erro('aparelho_desconhecido'); end if;
  perform interno.limite('chat_chave', 120, 60);
  select versao_minima into v_minima from conversas where id = p_conversa for update;
  select coalesce(max(versao), 0) into v_maxima from chat_versoes where conversa = p_conversa;
  if p_versao is distinct from greatest(v_maxima + 1, v_minima) then perform interno.erro('versao_ocupada'); end if;
  insert into chat_versoes (conversa, versao, criada_por) values (p_conversa, p_versao, p_aparelho);
  delete from chat_versoes x where x.conversa = p_conversa
    and exists (select 1 from chat_versoes y where y.conversa = x.conversa and y.versao > x.versao and y.criado_em < now() - interval '31 days');
  return jsonb_build_object('versao', p_versao);
end $$;

-- ── 3. A biblioteca por aparelho ────────────────────────────────────────────────────────────────────────────────────────────

create table if not exists interno.equipe_chat_olm (
  aparelho uuid primary key references interno.chat_aparelhos (id) on delete cascade,
  usuario uuid not null references interno.perfis (id) on delete cascade,
  dispositivo text not null unique check (dispositivo ~ '^[A-Z]{10}$'),
  ed25519 text not null check (ed25519 ~ '^[A-Za-z0-9+/]{43}$'),
  curve25519 text not null check (curve25519 ~ '^[A-Za-z0-9+/]{43}$'),
  chaves jsonb not null check (octet_length(chaves::text) <= 2000),
  -- A identidade da pessoa assinando as chaves Olm deste aparelho (só os aparelhos conferem).
  certificado text not null check (certificado ~ '^[A-Za-z0-9_-]{86}$'),
  criado_em timestamptz not null default now()
);
create table if not exists interno.equipe_chat_unicas (
  aparelho uuid not null references interno.chat_aparelhos (id) on delete cascade,
  id text not null check (id ~ '^signed_curve25519:[A-Za-z0-9+/]{1,32}$'),
  chave jsonb not null check (octet_length(chave::text) <= 1000),
  criado_em timestamptz not null default now(),
  primary key (aparelho, id)
);
create table if not exists interno.equipe_chat_reserva (
  aparelho uuid primary key references interno.chat_aparelhos (id) on delete cascade,
  id text not null check (id ~ '^signed_curve25519:[A-Za-z0-9+/]{1,32}$'),
  chave jsonb not null check (octet_length(chave::text) <= 1000),
  usada boolean not null default false
);
create table if not exists interno.equipe_chat_caixa (
  id bigint generated always as identity primary key,
  para uuid not null references interno.chat_aparelhos (id) on delete cascade,
  de uuid not null references interno.perfis (id) on delete cascade,
  conteudo jsonb not null check (octet_length(conteudo::text) <= 60000),
  criado_em timestamptz not null default now()
);
create index if not exists equipe_chat_caixa_para on interno.equipe_chat_caixa (para, id);
-- Pedidos de chave: um aparelho que não tem a sessão de uma mensagem pede; um aparelho de quem está na conversa repassa.
create table if not exists interno.equipe_chat_pedidos (
  id bigint generated always as identity primary key,
  aparelho uuid not null references interno.chat_aparelhos (id) on delete cascade,
  conversa uuid not null references interno.conversas (id) on delete cascade,
  sessao text not null check (sessao ~ '^[A-Za-z0-9+/]{43}$'),
  criado_em timestamptz not null default now(),
  unique (aparelho, conversa, sessao)
);

alter table interno.equipe_chat_olm enable row level security;
alter table interno.equipe_chat_unicas enable row level security;
alter table interno.equipe_chat_reserva enable row level security;
alter table interno.equipe_chat_caixa enable row level security;
alter table interno.equipe_chat_pedidos enable row level security;
revoke all on interno.equipe_chat_olm, interno.equipe_chat_unicas, interno.equipe_chat_reserva, interno.equipe_chat_caixa, interno.equipe_chat_pedidos from public;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on interno.equipe_chat_olm, interno.equipe_chat_unicas, interno.equipe_chat_reserva, interno.equipe_chat_caixa, interno.equipe_chat_pedidos from anon, authenticated;
  end if;
end $$;

/** Este aparelho é meu e está aprovado? (Toda função da biblioteca exige.) */
create or replace function interno.equipe_chat_meu(p_aparelho uuid) returns boolean language sql stable security definer set search_path = interno, pg_temp as $$
  select interno.voluntario() and exists (select 1 from chat_aparelhos a join perfis f on f.id = a.usuario
    where a.id = p_aparelho and a.usuario = interno.eu() and a.certificado is not null and not f.suspenso)
$$;
create or replace function interno.equipe_chat_id(p_usuario uuid) returns text language sql immutable as $$
  select '@' || p_usuario::text || ':alumia.invalid'
$$;
create or replace function interno.equipe_chat_usuario(p_id text) returns uuid language plpgsql immutable as $$
declare m text[];
begin
  m := regexp_match(coalesce(p_id, ''), '^@([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}):alumia\.invalid$');
  if m is null then return null; end if;
  return m[1]::uuid;
end $$;
/** É da equipe (voluntário, conta não suspensa)? Lê os papéis sem depender de quem chama. */
create or replace function interno.equipe_de(p_usuario uuid) returns boolean language sql stable security definer set search_path = interno, pg_temp as $$
  select exists (select 1 from perfis f where f.id = p_usuario and not f.suspenso)
     and exists (select 1 from chat_aparelhos a where a.usuario = p_usuario and a.certificado is not null)
$$;
/** O aparelho Olm de alguém da equipe, pelo id da biblioteca e o nome do aparelho (só aprovado, de conta não suspensa). */
create or replace function interno.equipe_chat_destino(p_id text, p_dispositivo text) returns uuid language sql stable security definer set search_path = interno, pg_temp as $$
  select o.aparelho from equipe_chat_olm o join chat_aparelhos a on a.id = o.aparelho join perfis f on f.id = a.usuario
  where o.usuario = interno.equipe_chat_usuario(p_id) and o.dispositivo = p_dispositivo and a.certificado is not null and not f.suspenso
    and interno.equipe_de(o.usuario)
$$;

/**
 * Publica as chaves Olm de um aparelho aprovado ("keys/upload"): `device_keys` (com o certificado da identidade), chaves de uso
 * único e a de reserva. Chaves novas no mesmo aparelho: as de uso único, a reserva e a caixa dele recomeçam.
 */
create or replace function public.equipe_chat_olm_publicar(p_aparelho uuid, p jsonb, p_certificado text default null) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); dk jsonb; o equipe_chat_olm; v_disp text; v_ed text; v_cu text; x record; n integer;
begin
  if not interno.equipe_chat_meu(p_aparelho) then perform interno.erro('aparelho_desconhecido'); end if;
  if jsonb_typeof(p) <> 'object' then perform interno.erro('invalido:pedido'); end if;
  perform interno.limite('equipe_chat_publicar', 120, 60);
  select * into o from equipe_chat_olm where aparelho = p_aparelho;
  dk := p -> 'device_keys';
  if dk is not null and jsonb_typeof(dk) = 'object' then
    v_disp := dk ->> 'device_id';
    if dk ->> 'user_id' is distinct from interno.equipe_chat_id(v) or coalesce(v_disp, '') !~ '^[A-Z]{10}$' then perform interno.erro('invalido:aparelho'); end if;
    v_ed := dk -> 'keys' ->> ('ed25519:' || v_disp);
    v_cu := dk -> 'keys' ->> ('curve25519:' || v_disp);
    if coalesce(v_ed, '') !~ '^[A-Za-z0-9+/]{43}$' or coalesce(v_cu, '') !~ '^[A-Za-z0-9+/]{43}$' or v_ed = v_cu or octet_length(dk::text) > 2000 then perform interno.erro('invalido:aparelho'); end if;
    if coalesce(p_certificado, '') !~ '^[A-Za-z0-9_-]{86}$' then perform interno.erro('invalido:certificado'); end if;
    if o.aparelho is null or o.dispositivo <> v_disp or o.ed25519 <> v_ed or o.curve25519 <> v_cu then
      delete from equipe_chat_unicas where aparelho = p_aparelho;
      delete from equipe_chat_reserva where aparelho = p_aparelho;
      delete from equipe_chat_caixa where para = p_aparelho;
    end if;
    insert into equipe_chat_olm (aparelho, usuario, dispositivo, ed25519, curve25519, chaves, certificado) values (p_aparelho, v, v_disp, v_ed, v_cu, dk, p_certificado)
    on conflict (aparelho) do update set dispositivo = excluded.dispositivo, ed25519 = excluded.ed25519, curve25519 = excluded.curve25519,
      chaves = excluded.chaves, certificado = excluded.certificado
    returning * into o;
  end if;
  if o.aparelho is null then perform interno.erro('aparelho_desconhecido'); end if;
  if jsonb_typeof(p -> 'one_time_keys') = 'object' then
    for x in select key, value from jsonb_each(p -> 'one_time_keys') loop
      if x.key !~ '^signed_curve25519:[A-Za-z0-9+/]{1,32}$' or jsonb_typeof(x.value) <> 'object' or octet_length(x.value::text) > 1000 then perform interno.erro('invalido:chave'); end if;
      if (select count(*) from equipe_chat_unicas where aparelho = p_aparelho) >= 100 then exit; end if;
      insert into equipe_chat_unicas (aparelho, id, chave) values (p_aparelho, x.key, x.value) on conflict do nothing;
    end loop;
  end if;
  if jsonb_typeof(p -> 'fallback_keys') = 'object' then
    for x in select key, value from jsonb_each(p -> 'fallback_keys') limit 1 loop
      if x.key !~ '^signed_curve25519:[A-Za-z0-9+/]{1,32}$' or jsonb_typeof(x.value) <> 'object' or octet_length(x.value::text) > 1000 then perform interno.erro('invalido:chave'); end if;
      insert into equipe_chat_reserva (aparelho, id, chave) values (p_aparelho, x.key, x.value) on conflict (aparelho) do update set id = excluded.id, chave = excluded.chave, usada = false;
    end loop;
  end if;
  select count(*) into n from equipe_chat_unicas where aparelho = p_aparelho;
  return jsonb_build_object('one_time_key_counts', jsonb_build_object('signed_curve25519', n));
end $$;

/** As chaves Olm dos aparelhos aprovados de pessoas da equipe ("keys/query"), com o certificado de cada um em "unsigned". */
create or replace function public.equipe_chat_olm_consultar(p_aparelho uuid, p_usuarios uuid[]) returns jsonb language plpgsql stable security definer set search_path = interno, pg_temp as $$
declare u uuid; saida jsonb := '{}'::jsonb; dentro jsonb;
begin
  if not interno.equipe_chat_meu(p_aparelho) then perform interno.erro('aparelho_desconhecido'); end if;
  if coalesce(array_length(p_usuarios, 1), 0) > 200 then perform interno.erro('invalido:pedido'); end if;
  foreach u in array coalesce(p_usuarios, '{}') loop
    dentro := '{}'::jsonb;
    if interno.equipe_de(u) then
      select coalesce(jsonb_object_agg(o.dispositivo, o.chaves || jsonb_build_object('unsigned', jsonb_build_object('lucia_aparelho', o.aparelho, 'lucia_certificado', o.certificado))), '{}'::jsonb)
      into dentro
      from equipe_chat_olm o join chat_aparelhos a on a.id = o.aparelho
      where o.usuario = u and a.certificado is not null;
    end if;
    saida := saida || jsonb_build_object(interno.equipe_chat_id(u), dentro);
  end loop;
  return jsonb_build_object('device_keys', saida);
end $$;

/** Pega uma chave de uso único (ou a de reserva) de cada aparelho pedido ("keys/claim"). */
create or replace function public.equipe_chat_olm_reivindicar(p_aparelho uuid, p jsonb) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare x record; d record; destino uuid; un equipe_chat_unicas; rs equipe_chat_reserva; saida jsonb := '{}'::jsonb; dentro jsonb;
begin
  if not interno.equipe_chat_meu(p_aparelho) then perform interno.erro('aparelho_desconhecido'); end if;
  if jsonb_typeof(p) <> 'object' then perform interno.erro('invalido:pedido'); end if;
  perform interno.limite('equipe_chat_reivindicar', 600, 60);
  for x in select key, value from jsonb_each(p) limit 200 loop
    dentro := '{}'::jsonb;
    if jsonb_typeof(x.value) = 'object' then
      for d in select key from jsonb_each(x.value) limit 20 loop
        destino := interno.equipe_chat_destino(x.key, d.key);
        if destino is null then continue; end if;
        delete from equipe_chat_unicas where ctid = (select ctid from equipe_chat_unicas where aparelho = destino order by criado_em, id limit 1 for update skip locked) returning * into un;
        if un.aparelho is not null then dentro := dentro || jsonb_build_object(d.key, jsonb_build_object(un.id, un.chave));
        else
          update equipe_chat_reserva set usada = true where aparelho = destino returning * into rs;
          if rs.aparelho is not null then dentro := dentro || jsonb_build_object(d.key, jsonb_build_object(rs.id, rs.chave)); end if;
        end if;
        un := null; rs := null;
      end loop;
    end if;
    saida := saida || jsonb_build_object(x.key, dentro);
  end loop;
  return jsonb_build_object('one_time_keys', saida);
end $$;

/** Recados cifrados de aparelho para aparelho ("sendToDevice"): só Olm, só para aparelho aprovado da equipe, até 300 por chamada. */
create or replace function public.equipe_chat_olm_enviar(p_aparelho uuid, p_tipo text, p_mensagens jsonb) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); x record; d record; destino uuid; n integer := 0;
begin
  if not interno.equipe_chat_meu(p_aparelho) then perform interno.erro('aparelho_desconhecido'); end if;
  if p_tipo is distinct from 'm.room.encrypted' or jsonb_typeof(p_mensagens) <> 'object' then perform interno.erro('invalido:recado'); end if;
  perform interno.limite('equipe_chat_enviar', 1200, 60);
  for x in select key, value from jsonb_each(p_mensagens) loop
    if jsonb_typeof(x.value) <> 'object' then continue; end if;
    for d in select key, value from jsonb_each(x.value) loop
      destino := interno.equipe_chat_destino(x.key, d.key);
      if destino is null then continue; end if;
      if d.value ->> 'algorithm' is distinct from 'm.olm.v1.curve25519-aes-sha2' or jsonb_typeof(d.value -> 'ciphertext') <> 'object' or octet_length(d.value::text) > 60000 then
        perform interno.erro('invalido:recado');
      end if;
      n := n + 1;
      if n > 300 then perform interno.erro('invalido:recado'); end if;
      insert into equipe_chat_caixa (para, de, conteudo) values (destino, v, d.value);
    end loop;
  end loop;
  return jsonb_build_object('enviados', n);
end $$;

/** Os recados para este aparelho (até 100) e quantas chaves de uso único ainda há. Faxina: recado com mais de 30 dias some. */
create or replace function public.equipe_chat_olm_receber(p_aparelho uuid) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
begin
  if not interno.equipe_chat_meu(p_aparelho) then perform interno.erro('aparelho_desconhecido'); end if;
  delete from equipe_chat_caixa where para = p_aparelho and criado_em < now() - interval '30 days';
  delete from equipe_chat_pedidos where criado_em < now() - interval '7 days';
  return jsonb_build_object(
    'eventos', coalesce((select jsonb_agg(jsonb_build_object('id', x.id, 'sender', interno.equipe_chat_id(x.de), 'type', 'm.room.encrypted', 'content', x.conteudo) order by x.id)
      from (select * from equipe_chat_caixa where para = p_aparelho order by id limit 100) x), '[]'::jsonb),
    'unicas', (select count(*) from equipe_chat_unicas where aparelho = p_aparelho),
    'reserva_usada', coalesce((select usada from equipe_chat_reserva where aparelho = p_aparelho), true));
end $$;

create or replace function public.equipe_chat_olm_confirmar(p_aparelho uuid, p_ate bigint) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare n integer;
begin
  if not interno.equipe_chat_meu(p_aparelho) then perform interno.erro('aparelho_desconhecido'); end if;
  delete from equipe_chat_caixa where para = p_aparelho and id <= p_ate;
  get diagnostics n = row_count;
  return jsonb_build_object('apagados', n);
end $$;

/** Este aparelho não tem a sessão `p_sessao` desta conversa: pede a quem tem. Só quem está na conversa. */
create or replace function public.equipe_chat_pedir_chave(p_aparelho uuid, p_conversa uuid, p_sessao text) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
begin
  if not interno.equipe_chat_meu(p_aparelho) then perform interno.erro('aparelho_desconhecido'); end if;
  if not interno.na_conversa(p_conversa) then perform interno.erro('nao_encontrado'); end if;
  if coalesce(p_sessao, '') !~ '^[A-Za-z0-9+/]{43}$' then perform interno.erro('invalido:sessao'); end if;
  perform interno.limite('equipe_chat_pedir', 600, 60);
  insert into equipe_chat_pedidos (aparelho, conversa, sessao) values (p_aparelho, p_conversa, p_sessao) on conflict do nothing;
  return jsonb_build_object('ok', true);
end $$;

/**
 * Os pedidos de chave que este aparelho pode atender: de conversas em que a pessoa está, feitos por OUTRO aparelho aprovado de
 * alguém que também está na conversa. Quem atende confere o certificado do aparelho que pediu antes de repassar.
 */
create or replace function public.equipe_chat_pedidos(p_aparelho uuid) returns jsonb language plpgsql stable security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu();
begin
  if not interno.equipe_chat_meu(p_aparelho) then perform interno.erro('aparelho_desconhecido'); end if;
  return coalesce((select jsonb_agg(jsonb_build_object('id', p.id, 'conversa', p.conversa, 'sessao', p.sessao, 'usuario', a.usuario, 'aparelho', p.aparelho, 'dispositivo', o.dispositivo) order by p.id)
    from (select * from equipe_chat_pedidos order by id limit 200) p
    join chat_aparelhos a on a.id = p.aparelho and a.certificado is not null
    join equipe_chat_olm o on o.aparelho = p.aparelho
    where p.aparelho <> p_aparelho
      and exists (select 1 from conversa_membros m where m.conversa = p.conversa and m.usuario = v)
      and exists (select 1 from conversa_membros m where m.conversa = p.conversa and m.usuario = a.usuario)), '[]'::jsonb);
end $$;

/** Pedido atendido: some. Só quem também podia atender (está na conversa). */
create or replace function public.equipe_chat_pedido_atendido(p_aparelho uuid, p_id bigint) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu();
begin
  if not interno.equipe_chat_meu(p_aparelho) then perform interno.erro('aparelho_desconhecido'); end if;
  delete from equipe_chat_pedidos p where p.id = p_id and exists (select 1 from conversa_membros m where m.conversa = p.conversa and m.usuario = v);
  return jsonb_build_object('ok', true);
end $$;

-- ── 4. Permissões ────────────────────────────────────────────────────────────────────────────────────────────────────────────

revoke all on function interno.equipe_chat_embrulho_ok(text), interno.equipe_chat_meu(uuid), interno.equipe_chat_id(uuid), interno.equipe_chat_usuario(text),
  interno.equipe_chat_destino(text, text), interno.equipe_de(uuid) from public;
do $$
declare f record;
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on function interno.equipe_chat_embrulho_ok(text), interno.equipe_chat_meu(uuid), interno.equipe_chat_id(uuid), interno.equipe_chat_usuario(text),
      interno.equipe_chat_destino(text, text), interno.equipe_de(uuid) from anon, authenticated;
  end if;
  for f in select p.oid::regprocedure as assinatura from pg_proc p join pg_namespace n on n.oid = p.pronamespace
           where n.nspname = 'public' and (p.proname like 'equipe\_chat\_%' or p.proname = 'chat_aparelho_aprovar') loop
    execute format('revoke all on function %s from public', f.assinatura);
    if exists (select 1 from pg_roles where rolname = 'anon') then
      execute format('revoke all on function %s from anon', f.assinatura);
      execute format('grant execute on function %s to authenticated', f.assinatura);
    end if;
  end loop;
end $$;
