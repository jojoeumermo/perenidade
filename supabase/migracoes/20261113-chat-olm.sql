-- Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
--
-- Chat privado da Alumia na biblioteca do Matrix (Olm + Megolm, lib/rede/chat/olm.ts). Documento: docs/rede/CHAT-PRIVADO.md.
--
-- Até aqui a cifra era feita à mão sobre o WebCrypto (formato "c3"). Agora quem cifra é a biblioteca do Matrix
-- (`@matrix-org/matrix-sdk-crypto-wasm`): Olm entre os dois aparelhos, para entregar as chaves, e Megolm para as mensagens,
-- com chave nova a cada mensagem (sigilo para a frente). O banco faz só o papel que a biblioteca precisa de um servidor:
--   - guarda a chave pública de cada aparelho (rede_olm_aparelhos) e as chaves de uso único (rede_olm_unicas, rede_olm_reserva);
--   - entrega recados cifrados de aparelho para aparelho (rede_olm_caixa): só "m.room.encrypted" (Olm), que ele não lê;
--   - aceita as mensagens no formato novo, "m1", em tamanhos fixos (o mesmo bloco do "c3" por dentro).
-- O servidor continua sem ser de confiança: o aparelho só entrega chave ao aparelho cuja identidade ele conhece da pessoa.
--
-- Precisa de: 20261106-t19-rede-chat-privado.sql, 20261107-t33-seguranca.sql e 20261110-chat-blocos.sql (nesta ordem).
-- Pode rodar de novo: não apaga dado nenhum.
--
-- Os tamanhos do "m1" (a última parte do corpo, o cifrado Megolm em base64), um por bloco de 256 a 8192 bytes:
--   723, 1192, 2088, 3923, 7550, 11198, 14846. Eles dependem da versão da biblioteca (fixa no package.json, 19.0.1): o teste
--   (npm run testar:rede-chat) confere a lista do banco contra a cifra de verdade.

do $$
begin
  if not exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'interno' and p.proname = 'rede_dm_corpo_c3') then
    raise exception 'Falta rodar antes supabase/migracoes/20261110-chat-blocos.sql (e as duas anteriores do chat).';
  end if;
end $$;

-- ── 1. As regras das tabelas de antes aceitam também a chave do aparelho Olm ────────────────────────────────────────────
-- Identidade = "o" + a chave ed25519 do aparelho; chave do aparelho = "o" + a curve25519; certificado = "olm1" (quem assina a
-- chave do aparelho é a própria biblioteca, nas chaves publicadas em rede_olm_aparelhos). Nos embrulhos, "olm1" marca só para
-- qual versão da chave de cada pessoa a versão da conversa foi feita: a chave em si vai pelo Olm, nunca pelo banco.

do $$
declare r record;
begin
  for r in select conname from pg_constraint
           where conrelid = 'interno.rede_dm_chaves'::regclass and contype = 'c'
             and (pg_get_constraintdef(oid) like '%identidade%' or pg_get_constraintdef(oid) like '%publica%' or pg_get_constraintdef(oid) like '%certificado%') loop
    execute format('alter table interno.rede_dm_chaves drop constraint %I', r.conname);
  end loop;
  for r in select conname from pg_constraint
           where conrelid = 'interno.rede_dm_embrulhos'::regclass and contype = 'c'
             and (pg_get_constraintdef(oid) like '%embrulho%' or pg_get_constraintdef(oid) like '%de_publica%' or pg_get_constraintdef(oid) like '%de_certificado%') loop
    execute format('alter table interno.rede_dm_embrulhos drop constraint %I', r.conname);
  end loop;
  for r in select conname from pg_constraint
           where conrelid = 'interno.rede_dm_mensagens'::regclass and contype = 'c' and pg_get_constraintdef(oid) like '%c3%' loop
    execute format('alter table interno.rede_dm_mensagens drop constraint %I', r.conname);
  end loop;
end $$;

alter table interno.rede_dm_chaves add constraint rede_dm_chaves_formato check (
  (identidade ~ '^B[A-Za-z0-9_-]{86}$' and publica ~ '^B[A-Za-z0-9_-]{86}$' and certificado ~ '^[A-Za-z0-9_-]{86}$')
  or (identidade ~ '^o[A-Za-z0-9+/]{43}$' and publica ~ '^o[A-Za-z0-9+/]{43}$' and certificado = 'olm1')
);
alter table interno.rede_dm_embrulhos add constraint rede_dm_embrulhos_formato check (
  (embrulho ~ '^w1\.[A-Za-z0-9_-]{16}\.[A-Za-z0-9_-]{64}$' and de_publica ~ '^B[A-Za-z0-9_-]{86}$' and de_certificado ~ '^[A-Za-z0-9_-]{86}$')
  or (embrulho = 'olm1' and de_publica ~ '^o[A-Za-z0-9+/]{43}$' and de_certificado = 'olm1')
);

/** Um corpo "m1" válido para a versão: o formato e um dos sete tamanhos do cifrado Megolm. */
create or replace function interno.rede_dm_corpo_m1(p_corpo text, p_versao integer) returns boolean language sql immutable as $$
  select p_corpo is not null and p_versao is not null and p_versao > 0
    and char_length(p_corpo) <= 15000
    and p_corpo ~ ('^m1\.' || p_versao || '\.[A-Za-z0-9+/]{43}\.[A-Za-z0-9+/]+$')
    and char_length(split_part(p_corpo, '.', 4)) in (723, 1192, 2088, 3923, 7550, 11198, 14846)
$$;

alter table interno.rede_dm_mensagens add constraint rede_dm_mensagens_corpo_formato check (
  (char_length(corpo) <= 12000 and (
    (corpo ~ '^c3\.[1-9][0-9]{0,6}\.[A-Za-z0-9_-]{16}\.[A-Za-z0-9_-]+$'
      and char_length(split_part(corpo, '.', 4)) in (363, 704, 1387, 2752, 5483, 8214, 10944))
    or corpo ~ '^c2\.[1-9][0-9]{0,6}\.[A-Za-z0-9_-]{16}\.[A-Za-z0-9_-]{23,}$'))
  or (char_length(corpo) <= 15000 and corpo ~ '^m1\.[1-9][0-9]{0,6}\.[A-Za-z0-9+/]{43}\.[A-Za-z0-9+/]+$'
      and char_length(split_part(corpo, '.', 4)) in (723, 1192, 2088, 3923, 7550, 11198, 14846))
);

/**
 * O corpo que o envio aceita: só "m1" quando a conta de quem escreve já está na biblioteca do Matrix; "c3" enquanto não está
 * (a tela antiga, até o site novo ser publicado). Nome antigo mantido: public.rede_dm_enviar (20261110-chat-blocos.sql) o chama.
 */
create or replace function interno.rede_dm_corpo_c3(p_corpo text, p_versao integer) returns boolean language plpgsql stable security definer set search_path = interno, pg_temp as $$
declare v_olm boolean := exists (select 1 from rede_dm_chaves where usuario = interno.eu() and certificado = 'olm1');
begin
  if v_olm then return interno.rede_dm_corpo_m1(p_corpo, p_versao); end if;
  return p_corpo is not null and p_versao is not null and p_versao > 0
    and char_length(p_corpo) <= 12000
    and p_corpo ~ ('^c3\.' || p_versao || '\.[A-Za-z0-9_-]{16}\.[A-Za-z0-9_-]+$')
    and char_length(split_part(p_corpo, '.', 4)) in (363, 704, 1387, 2752, 5483, 8214, 10944);
end $$;

-- ── 2. As tabelas da biblioteca ──────────────────────────────────────────────────────────────────────────────────────────
-- Um aparelho por conta (como antes). `chaves`: as chaves públicas do aparelho como a biblioteca as publica (assinadas por ela).

create table if not exists interno.rede_olm_aparelhos (
  usuario uuid primary key references interno.perfis (id) on delete cascade,
  dispositivo text not null check (dispositivo ~ '^[A-Z]{10}$'),
  ed25519 text not null check (ed25519 ~ '^[A-Za-z0-9+/]{43}$'),
  curve25519 text not null check (curve25519 ~ '^[A-Za-z0-9+/]{43}$'),
  chaves jsonb not null check (octet_length(chaves::text) <= 2000),
  criado_em timestamptz not null default now()
);

-- Chaves de uso único: cada uma serve para UMA sessão Olm e some quando alguém a pega.
create table if not exists interno.rede_olm_unicas (
  usuario uuid not null references interno.perfis (id) on delete cascade,
  id text not null check (id ~ '^signed_curve25519:[A-Za-z0-9+/]{1,32}$'),
  chave jsonb not null check (octet_length(chave::text) <= 1000),
  criado_em timestamptz not null default now(),
  primary key (usuario, id)
);

-- A chave de reserva: usada quando as de uso único acabam (a biblioteca troca por outra).
create table if not exists interno.rede_olm_reserva (
  usuario uuid primary key references interno.perfis (id) on delete cascade,
  id text not null check (id ~ '^signed_curve25519:[A-Za-z0-9+/]{1,32}$'),
  chave jsonb not null check (octet_length(chave::text) <= 1000),
  usada boolean not null default false
);

-- Recados cifrados de aparelho para aparelho (Olm). O banco não lê: guarda até o aparelho buscar, no máximo 30 dias.
create table if not exists interno.rede_olm_caixa (
  id bigint generated always as identity primary key,
  para uuid not null references interno.perfis (id) on delete cascade,
  de uuid not null references interno.perfis (id) on delete cascade,
  conteudo jsonb not null check (octet_length(conteudo::text) <= 8000),
  criado_em timestamptz not null default now()
);
create index if not exists rede_olm_caixa_para on interno.rede_olm_caixa (para, id);

alter table interno.rede_olm_aparelhos enable row level security;
alter table interno.rede_olm_unicas enable row level security;
alter table interno.rede_olm_reserva enable row level security;
alter table interno.rede_olm_caixa enable row level security;
revoke all on interno.rede_olm_aparelhos, interno.rede_olm_unicas, interno.rede_olm_reserva, interno.rede_olm_caixa from public;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on interno.rede_olm_aparelhos, interno.rede_olm_unicas, interno.rede_olm_reserva, interno.rede_olm_caixa from anon, authenticated;
  end if;
end $$;

-- Quando a chave do chat da pessoa some (apagar tudo do chat, apagar a conta), some tudo da biblioteca junto.
create or replace function interno.rede_olm_ao_apagar_chave() returns trigger language plpgsql security definer set search_path = interno, pg_temp as $$
begin
  delete from rede_olm_aparelhos where usuario = old.usuario;
  delete from rede_olm_unicas where usuario = old.usuario;
  delete from rede_olm_reserva where usuario = old.usuario;
  delete from rede_olm_caixa where para = old.usuario;
  return old;
end $$;
drop trigger if exists rede_olm_ao_apagar_chave on interno.rede_dm_chaves;
create trigger rede_olm_ao_apagar_chave after delete on interno.rede_dm_chaves for each row execute function interno.rede_olm_ao_apagar_chave();

-- ── 3. Auxiliares ────────────────────────────────────────────────────────────────────────────────────────────────────────

/** O id que a biblioteca usa para a pessoa. */
create or replace function interno.rede_olm_id(p_usuario uuid) returns text language sql immutable as $$
  select '@' || p_usuario::text || ':alumia.invalid'
$$;

/** O contrário: o uuid de um id da biblioteca, ou null. */
create or replace function interno.rede_olm_usuario(p_id text) returns uuid language plpgsql immutable as $$
declare m text[];
begin
  m := regexp_match(coalesce(p_id, ''), '^@([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}):alumia\.invalid$');
  if m is null then return null; end if;
  return m[1]::uuid;
end $$;

/**
 * Posso falar com esta pessoa pelo chat? Eu mesma; ou alguém com quem tenho conversa ABERTA, sem bloqueio de nenhum lado e que
 * continua membro. Para qualquer outra pessoa o banco não dá nem a chave pública do aparelho.
 */
create or replace function interno.rede_olm_contato(p_eu uuid, p_outro uuid) returns boolean language sql stable security definer set search_path = interno, pg_temp as $$
  select p_outro = p_eu or (
    exists (select 1 from rede_dm_conversas c where c.situacao = 'aberta' and ((c.a = p_eu and c.b = p_outro) or (c.b = p_eu and c.a = p_outro)))
    and not interno.rede_bloqueado(p_eu, p_outro) and interno.rede2_membro(p_outro))
$$;

/** O limite das funções da biblioteca (por pessoa). */
create or replace function interno.rede_olm_limite(p_acao text) returns void language plpgsql security definer set search_path = interno, pg_temp as $$
declare v_teto integer;
begin
  v_teto := case p_acao when 'publicar' then 60 when 'consultar' then 600 when 'reivindicar' then 120 when 'enviar' then 600 when 'receber' then 1200 else null end;
  if v_teto is null then perform interno.erro('acao_desconhecida'); end if;
  perform interno.limite('rede_olm_' || p_acao, v_teto, 60);
end $$;

-- ── 4. As funções que o aparelho chama ───────────────────────────────────────────────────────────────────────────────────

/**
 * Publica as chaves do aparelho (o pedido "keys/upload" da biblioteca): `device_keys` (só na ativação), chaves de uso único e a
 * de reserva. Aparelho NOVO (outro nome ou outra chave): é a ativação do chat em outro lugar; a chave do chat da conta muda
 * (versão + 1), e as chaves e recados do aparelho antigo somem. Devolve quantas chaves de uso único há guardadas.
 */
create or replace function public.rede_olm_publicar(p jsonb) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare
  v uuid := interno.eu(); dk jsonb; ap rede_olm_aparelhos; v_disp text; v_ed text; v_cu text; k rede_dm_chaves; x record; n integer;
begin
  perform interno.aberta('comunidade');
  if not interno.rede2_membro(v) then perform interno.erro('consentimento'); end if;
  if jsonb_typeof(p) <> 'object' then perform interno.erro('invalido:pedido'); end if;
  perform interno.rede_olm_limite('publicar');
  select * into ap from rede_olm_aparelhos where usuario = v;
  dk := p -> 'device_keys';
  if dk is not null and jsonb_typeof(dk) = 'object' then
    v_disp := dk ->> 'device_id';
    if dk ->> 'user_id' is distinct from interno.rede_olm_id(v) or coalesce(v_disp, '') !~ '^[A-Z]{10}$' then perform interno.erro('invalido:aparelho'); end if;
    v_ed := dk -> 'keys' ->> ('ed25519:' || v_disp);
    v_cu := dk -> 'keys' ->> ('curve25519:' || v_disp);
    if coalesce(v_ed, '') !~ '^[A-Za-z0-9+/]{43}$' or coalesce(v_cu, '') !~ '^[A-Za-z0-9+/]{43}$' or v_ed = v_cu then perform interno.erro('invalido:aparelho'); end if;
    if octet_length(dk::text) > 2000 then perform interno.erro('invalido:aparelho'); end if;
    if ap.usuario is null or ap.dispositivo <> v_disp or ap.ed25519 <> v_ed or ap.curve25519 <> v_cu then
      perform interno.rede_dm_limite('chave');
      delete from rede_olm_unicas where usuario = v;
      delete from rede_olm_reserva where usuario = v;
      delete from rede_olm_caixa where para = v;
      insert into rede_olm_aparelhos (usuario, dispositivo, ed25519, curve25519, chaves) values (v, v_disp, v_ed, v_cu, dk)
      on conflict (usuario) do update set dispositivo = excluded.dispositivo, ed25519 = excluded.ed25519, curve25519 = excluded.curve25519,
        chaves = excluded.chaves, criado_em = now()
      returning * into ap;
      insert into rede_dm_chaves (usuario, identidade, publica, certificado) values (v, 'o' || v_ed, 'o' || v_cu, 'olm1')
      on conflict (usuario) do update set identidade = excluded.identidade, publica = excluded.publica, certificado = excluded.certificado,
        versao = rede_dm_chaves.versao + 1, trocada_em = now();
    end if;
  end if;
  if ap.usuario is null then perform interno.erro('dm_sem_chave'); end if;
  -- Chaves de uso único: no máximo 100 guardadas; as que passarem disso são ignoradas (a biblioteca manda de novo depois).
  if jsonb_typeof(p -> 'one_time_keys') = 'object' then
    for x in select key, value from jsonb_each(p -> 'one_time_keys') loop
      if x.key !~ '^signed_curve25519:[A-Za-z0-9+/]{1,32}$' or jsonb_typeof(x.value) <> 'object' or octet_length(x.value::text) > 1000 then perform interno.erro('invalido:chave'); end if;
      if (select count(*) from rede_olm_unicas where usuario = v) >= 100 then exit; end if;
      insert into rede_olm_unicas (usuario, id, chave) values (v, x.key, x.value) on conflict do nothing;
    end loop;
  end if;
  if jsonb_typeof(p -> 'fallback_keys') = 'object' then
    for x in select key, value from jsonb_each(p -> 'fallback_keys') limit 1 loop
      if x.key !~ '^signed_curve25519:[A-Za-z0-9+/]{1,32}$' or jsonb_typeof(x.value) <> 'object' or octet_length(x.value::text) > 1000 then perform interno.erro('invalido:chave'); end if;
      insert into rede_olm_reserva (usuario, id, chave) values (v, x.key, x.value)
      on conflict (usuario) do update set id = excluded.id, chave = excluded.chave, usada = false;
    end loop;
  end if;
  select count(*) into n from rede_olm_unicas where usuario = v;
  select * into k from rede_dm_chaves where usuario = v;
  return jsonb_build_object('one_time_key_counts', jsonb_build_object('signed_curve25519', n), 'versao', k.versao);
end $$;

/** As chaves públicas dos aparelhos (o pedido "keys/query"). Só de quem é contato (veja interno.rede_olm_contato); dos outros, vazio. */
create or replace function public.rede_olm_consultar(p_usuarios uuid[]) returns jsonb language plpgsql stable security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); u uuid; saida jsonb := '{}'::jsonb; ap rede_olm_aparelhos;
begin
  perform interno.aberta('comunidade');
  if not interno.rede2_membro(v) then perform interno.erro('consentimento'); end if;
  if coalesce(array_length(p_usuarios, 1), 0) > 20 then perform interno.erro('invalido:pedido'); end if;
  foreach u in array coalesce(p_usuarios, '{}') loop
    saida := saida || jsonb_build_object(interno.rede_olm_id(u), '{}'::jsonb);
    if not interno.rede_olm_contato(v, u) then continue; end if;
    select * into ap from rede_olm_aparelhos where usuario = u;
    if found then saida := saida || jsonb_build_object(interno.rede_olm_id(u), jsonb_build_object(ap.dispositivo, ap.chaves)); end if;
  end loop;
  return jsonb_build_object('device_keys', saida);
end $$;

/**
 * Pega uma chave de uso único de cada aparelho pedido (o pedido "keys/claim"), para abrir uma sessão Olm com ele. A chave sai
 * do banco (cada uma serve uma vez). Sem nenhuma, vai a de reserva. Só de contatos.
 */
create or replace function public.rede_olm_reivindicar(p jsonb) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); x record; d record; u uuid; ap rede_olm_aparelhos; un rede_olm_unicas; rs rede_olm_reserva; saida jsonb := '{}'::jsonb; dentro jsonb;
begin
  perform interno.aberta('comunidade');
  if not interno.rede2_membro(v) then perform interno.erro('consentimento'); end if;
  if jsonb_typeof(p) <> 'object' then perform interno.erro('invalido:pedido'); end if;
  perform interno.rede_olm_limite('reivindicar');
  for x in select key, value from jsonb_each(p) limit 20 loop
    u := interno.rede_olm_usuario(x.key);
    dentro := '{}'::jsonb;
    if u is not null and interno.rede_olm_contato(v, u) and jsonb_typeof(x.value) = 'object' then
      select * into ap from rede_olm_aparelhos where usuario = u;
      if found and x.value ? ap.dispositivo then
        delete from rede_olm_unicas where ctid = (select ctid from rede_olm_unicas where usuario = u order by criado_em, id limit 1 for update skip locked)
        returning * into un;
        if un.usuario is not null then
          dentro := jsonb_build_object(ap.dispositivo, jsonb_build_object(un.id, un.chave));
        else
          update rede_olm_reserva set usada = true where usuario = u returning * into rs;
          if rs.usuario is not null then dentro := jsonb_build_object(ap.dispositivo, jsonb_build_object(rs.id, rs.chave)); end if;
        end if;
        un := null; rs := null;
      end if;
    end if;
    saida := saida || jsonb_build_object(x.key, dentro);
  end loop;
  return jsonb_build_object('one_time_keys', saida);
end $$;

/**
 * Manda recados cifrados de aparelho para aparelho (o pedido "sendToDevice"). Só "m.room.encrypted" com o algoritmo Olm (o
 * banco não aceita recado em texto), só para o aparelho atual de um contato (ou o meu), no máximo 4 por chamada.
 */
create or replace function public.rede_olm_enviar(p_tipo text, p_mensagens jsonb) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); x record; d record; u uuid; ap rede_olm_aparelhos; n integer := 0;
begin
  perform interno.aberta('comunidade');
  if not interno.rede2_membro(v) then perform interno.erro('consentimento'); end if;
  if p_tipo is distinct from 'm.room.encrypted' or jsonb_typeof(p_mensagens) <> 'object' then perform interno.erro('invalido:recado'); end if;
  perform interno.rede_olm_limite('enviar');
  for x in select key, value from jsonb_each(p_mensagens) loop
    u := interno.rede_olm_usuario(x.key);
    if u is null or not interno.rede_olm_contato(v, u) or jsonb_typeof(x.value) <> 'object' then continue; end if;
    select * into ap from rede_olm_aparelhos where usuario = u;
    if not found then continue; end if;
    for d in select key, value from jsonb_each(x.value) loop
      if d.key <> ap.dispositivo then continue; end if;
      if d.value ->> 'algorithm' is distinct from 'm.olm.v1.curve25519-aes-sha2' or jsonb_typeof(d.value -> 'ciphertext') <> 'object'
         or octet_length(d.value::text) > 8000 then perform interno.erro('invalido:recado'); end if;
      n := n + 1;
      if n > 4 then perform interno.erro('invalido:recado'); end if;
      insert into rede_olm_caixa (para, de, conteudo) values (u, v, d.value);
    end loop;
  end loop;
  return jsonb_build_object('enviados', n);
end $$;

/**
 * Os recados que chegaram para o meu aparelho (até 100, os mais antigos primeiro), e quantas chaves de uso único ainda tenho.
 * Recado de quem eu bloqueei (ou me bloqueou) não é entregue. Faz também a faxina: recado com mais de 30 dias some.
 */
create or replace function public.rede_olm_receber() returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu();
begin
  perform interno.aberta('comunidade');
  if not interno.rede2_membro(v) then perform interno.erro('consentimento'); end if;
  perform interno.rede_olm_limite('receber');
  delete from rede_olm_caixa where para = v and (criado_em < now() - interval '30 days' or (de <> v and interno.rede_bloqueado(v, de)));
  return jsonb_build_object(
    'eventos', coalesce((select jsonb_agg(jsonb_build_object('id', x.id, 'sender', interno.rede_olm_id(x.de), 'type', 'm.room.encrypted', 'content', x.conteudo) order by x.id)
      from (select * from rede_olm_caixa where para = v order by id limit 100) x), '[]'::jsonb),
    'unicas', (select count(*) from rede_olm_unicas where usuario = v),
    'reserva_usada', coalesce((select usada from rede_olm_reserva where usuario = v), true));
end $$;

/** O aparelho já guardou os recados até `p_ate`: eles somem do banco. */
create or replace function public.rede_olm_confirmar(p_ate bigint) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); n integer;
begin
  perform interno.aberta('comunidade');
  delete from rede_olm_caixa where para = v and id <= p_ate;
  get diagnostics n = row_count;
  return jsonb_build_object('apagados', n);
end $$;

-- ── 5. Versão nova da conversa: na biblioteca, sem chave no banco ────────────────────────────────────────────────────────

/**
 * Igual à de 20261110-chat-blocos.sql, com uma diferença: quando as duas contas estão na biblioteca, o "embrulho" de cada uma
 * é só a marca "olm1" (a chave da versão vai pelo Olm, de aparelho para aparelho). Conta na biblioteca e conta no formato
 * antigo não fazem versão juntas: a antiga precisa ativar o chat de novo (o site novo faz isso sozinho).
 */
create or replace function public.rede_dm_nova_versao(p_conversa uuid, p_versao integer, p_embrulhos jsonb) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare
  v uuid := interno.eu(); c rede_dm_conversas; o uuid; minha rede_dm_chaves; e jsonb; k rede_dm_chaves; v_para uuid; n integer := 0; v_olm boolean;
begin
  perform interno.aberta('comunidade');
  if not interno.rede2_membro(v) then perform interno.erro('consentimento'); end if;
  select * into c from rede_dm_conversas where id = p_conversa and (a = v or b = v) for update;
  if not found then perform interno.erro('nao_encontrado'); end if;
  o := interno.rede_dm_outro(c, v);
  if c.situacao <> 'aberta' or interno.rede_bloqueado(v, o) or not interno.rede2_membro(o) then perform interno.erro('dm_fechada'); end if;
  if p_versao is distinct from c.versao + 1 then perform interno.erro('versao_desatualizada'); end if;
  if c.versao > 0 and c.versao_em > now() - interval '5 minutes'
     and (select count(*) from rede_dm_embrulhos x join rede_dm_chaves kk on kk.usuario = x.para and kk.versao = x.chave_versao
          where x.conversa = c.id and x.versao = c.versao) = 2 then
    perform interno.erro('versao_desatualizada');
  end if;
  perform interno.rede_dm_limite('versao');
  select * into minha from rede_dm_chaves where usuario = v;
  if not found then perform interno.erro('dm_sem_chave'); end if;
  v_olm := minha.certificado = 'olm1';
  if jsonb_typeof(p_embrulhos) <> 'array' or jsonb_array_length(p_embrulhos) <> 2 then perform interno.erro('invalido:embrulhos'); end if;
  for e in select * from jsonb_array_elements(p_embrulhos) loop
    begin v_para := (e ->> 'para')::uuid; exception when others then perform interno.erro('invalido:embrulhos'); end;
    if v_para not in (c.a, c.b) then perform interno.erro('invalido:embrulhos'); end if;
    select * into k from rede_dm_chaves where usuario = v_para;
    if not found then perform interno.erro('dm_sem_chave'); end if;
    if (e ->> 'chave_versao')::integer is distinct from k.versao then perform interno.erro('versao_desatualizada'); end if;
    if (k.certificado = 'olm1') is distinct from v_olm then perform interno.erro('dm_sem_chave'); end if;
    if v_olm then
      if coalesce(e ->> 'embrulho', '') <> 'olm1' then perform interno.erro('invalido:embrulho'); end if;
    elsif coalesce(e ->> 'embrulho', '') !~ '^w1\.[A-Za-z0-9_-]{16}\.[A-Za-z0-9_-]{64}$' then
      perform interno.erro('invalido:embrulho');
    end if;
    insert into rede_dm_embrulhos (conversa, versao, para, chave_versao, embrulho, de, de_publica, de_certificado)
    values (c.id, p_versao, v_para, k.versao, e ->> 'embrulho', v, minha.publica, minha.certificado);
    n := n + 1;
  end loop;
  if n <> 2 or (select count(distinct para) from rede_dm_embrulhos where conversa = c.id and versao = p_versao) <> 2 then perform interno.erro('invalido:embrulhos'); end if;
  update rede_dm_conversas set versao = p_versao, versao_em = now() where id = c.id;
  perform interno.rede_dm_faxina_da_conversa(c.id);
  perform interno.rede_dm_talvez_faxina();
  return jsonb_build_object('versao', p_versao);
end $$;

-- ── 6. Permissões ───────────────────────────────────────────────────────────────────────────────────────────────────────

revoke all on function interno.rede_dm_corpo_m1(text, integer), interno.rede_dm_corpo_c3(text, integer), interno.rede_olm_ao_apagar_chave(),
  interno.rede_olm_id(uuid), interno.rede_olm_usuario(text), interno.rede_olm_contato(uuid, uuid), interno.rede_olm_limite(text) from public;
do $$
declare f record;
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on function interno.rede_dm_corpo_m1(text, integer), interno.rede_dm_corpo_c3(text, integer), interno.rede_olm_ao_apagar_chave(),
      interno.rede_olm_id(uuid), interno.rede_olm_usuario(text), interno.rede_olm_contato(uuid, uuid), interno.rede_olm_limite(text) from anon, authenticated;
  end if;
  for f in select p.oid::regprocedure as assinatura from pg_proc p join pg_namespace n on n.oid = p.pronamespace
           where n.nspname = 'public' and p.proname in ('rede_olm_publicar', 'rede_olm_consultar', 'rede_olm_reivindicar', 'rede_olm_enviar',
             'rede_olm_receber', 'rede_olm_confirmar', 'rede_dm_nova_versao') loop
    execute format('revoke all on function %s from public', f.assinatura);
    if exists (select 1 from pg_roles where rolname = 'anon') then
      execute format('revoke all on function %s from anon', f.assinatura);
      execute format('grant execute on function %s to authenticated', f.assinatura);
    end if;
  end loop;
end $$;
