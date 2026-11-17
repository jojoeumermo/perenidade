-- Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
--
-- Transparência de chaves do chat privado. Documento: docs/rede/CHAT-PRIVADO.md ("Registro público das chaves").
--
-- Toda vez que a chave do chat de alguém muda (ativar, trocar de aparelho), entra uma linha num REGISTRO PÚBLICO só de
-- acréscimo, encadeado: cada linha leva o resumo (SHA-256) da anterior. Qualquer pessoa (até sem conta) pode baixar o registro e
-- refazer a corrente. O aparelho de quem conversa confere que a chave que o servidor lhe mostra da outra pessoa é a ÚLTIMA desse
-- registro, e guarda o ponto da corrente que já viu: se o servidor mostrar uma chave a uma pessoa e outra a outra, ou reescrever
-- o passado, a corrente não fecha e o aparelho avisa.
--
-- Privacidade: a linha não leva o id da conta, e sim um resumo dele com um "sal" fixo do registro (quem já sabe o id de alguém
-- encontra a linha; quem só baixa o registro não vê de quem é). Do momento, só o dia.
--
-- Precisa de 20261113-chat-olm.sql. Pode rodar de novo.

create table if not exists interno.rede_kt (
  seq bigint primary key check (seq > 0),
  -- sha256('alumia-kt:1:' || usuario), em base64.
  quem text not null check (quem ~ '^[A-Za-z0-9+/]{43}=$'),
  -- A identidade publicada ("o" + ed25519) e a versão da chave da conta.
  identidade text not null,
  versao integer not null check (versao > 0),
  dia date not null,
  -- sha256(anterior || '|' || seq || '|' || quem || '|' || identidade || '|' || versao || '|' || dia), em base64.
  resumo text not null check (resumo ~ '^[A-Za-z0-9+/]{43}=$')
);
create index if not exists rede_kt_quem on interno.rede_kt (quem, seq desc);
alter table interno.rede_kt enable row level security;
revoke all on interno.rede_kt from public;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on interno.rede_kt from anon, authenticated;
  end if;
end $$;

/** O resumo da conta no registro. */
create or replace function interno.rede_kt_quem(p_usuario uuid) returns text language sql immutable as $$
  select encode(sha256(convert_to('alumia-kt:1:' || p_usuario::text, 'UTF8')), 'base64')
$$;

/** O resumo de uma linha, a partir do resumo da anterior (a primeira usa 43 "A" e "="). */
create or replace function interno.rede_kt_resumo(p_anterior text, p_seq bigint, p_quem text, p_identidade text, p_versao integer, p_dia date) returns text language sql immutable as $$
  select encode(sha256(convert_to(p_anterior || '|' || p_seq || '|' || p_quem || '|' || p_identidade || '|' || p_versao || '|' || to_char(p_dia, 'YYYY-MM-DD'), 'UTF8')), 'base64')
$$;

/** Acrescenta uma linha ao registro quando a chave do chat de alguém nasce ou muda (só da biblioteca do Matrix). */
create or replace function interno.rede_kt_anotar() returns trigger language plpgsql security definer set search_path = interno, pg_temp as $$
declare v_ult rede_kt; v_seq bigint; v_dia date := (now() at time zone 'utc')::date; v_quem text;
begin
  if new.certificado is distinct from 'olm1' then return new; end if;
  if tg_op = 'UPDATE' and old.identidade = new.identidade and old.versao = new.versao then return new; end if;
  perform pg_advisory_xact_lock(hashtext('rede_kt'));
  select * into v_ult from rede_kt order by seq desc limit 1;
  v_seq := coalesce(v_ult.seq, 0) + 1;
  v_quem := interno.rede_kt_quem(new.usuario);
  insert into rede_kt (seq, quem, identidade, versao, dia, resumo)
  values (v_seq, v_quem, new.identidade, new.versao, v_dia, interno.rede_kt_resumo(coalesce(v_ult.resumo, repeat('A', 43) || '='), v_seq, v_quem, new.identidade, new.versao, v_dia));
  return new;
end $$;
drop trigger if exists rede_kt_anotar on interno.rede_dm_chaves;
create trigger rede_kt_anotar after insert or update on interno.rede_dm_chaves for each row execute function interno.rede_kt_anotar();

/** A ponta do registro: o número e o resumo da última linha. Público. */
create or replace function public.rede_kt_ponta() returns jsonb language sql stable security definer set search_path = interno, pg_temp as $$
  select coalesce((select jsonb_build_object('seq', seq, 'resumo', resumo) from rede_kt order by seq desc limit 1), jsonb_build_object('seq', 0, 'resumo', repeat('A', 43) || '='))
$$;

/** Um trecho do registro (até 1000 linhas depois de `p_desde`). Público: qualquer um refaz a corrente. */
create or replace function public.rede_kt_trecho(p_desde bigint default 0) returns jsonb language sql stable security definer set search_path = interno, pg_temp as $$
  select coalesce(jsonb_agg(jsonb_build_object('seq', k.seq, 'quem', k.quem, 'identidade', k.identidade, 'versao', k.versao, 'dia', to_char(k.dia, 'YYYY-MM-DD'), 'resumo', k.resumo) order by k.seq), '[]'::jsonb)
  from (select * from rede_kt where seq > coalesce(p_desde, 0) order by seq limit 1000) k
$$;

revoke all on function interno.rede_kt_quem(uuid), interno.rede_kt_resumo(text, bigint, text, text, integer, date), interno.rede_kt_anotar() from public;
do $$
declare f record;
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on function interno.rede_kt_quem(uuid), interno.rede_kt_resumo(text, bigint, text, text, integer, date), interno.rede_kt_anotar() from anon, authenticated;
  end if;
  for f in select p.oid::regprocedure as assinatura from pg_proc p join pg_namespace n on n.oid = p.pronamespace
           where n.nspname = 'public' and p.proname in ('rede_kt_ponta', 'rede_kt_trecho') loop
    execute format('revoke all on function %s from public', f.assinatura);
    if exists (select 1 from pg_roles where rolname = 'anon') then
      execute format('grant execute on function %s to anon, authenticated', f.assinatura);
    end if;
  end loop;
end $$;

-- As chaves que já existiam (antes deste registro) entram agora, na ordem em que foram criadas.
do $$
declare k record; v_ult interno.rede_kt; v_seq bigint; v_quem text; v_dia date;
begin
  for k in select c.* from interno.rede_dm_chaves c where c.certificado = 'olm1'
             and not exists (select 1 from interno.rede_kt t where t.quem = interno.rede_kt_quem(c.usuario) and t.identidade = c.identidade and t.versao = c.versao)
           order by c.trocada_em, c.usuario loop
    select * into v_ult from interno.rede_kt order by seq desc limit 1;
    v_seq := coalesce(v_ult.seq, 0) + 1;
    v_quem := interno.rede_kt_quem(k.usuario);
    v_dia := (k.trocada_em at time zone 'utc')::date;
    insert into interno.rede_kt (seq, quem, identidade, versao, dia, resumo)
    values (v_seq, v_quem, k.identidade, k.versao, v_dia, interno.rede_kt_resumo(coalesce(v_ult.resumo, repeat('A', 43) || '='), v_seq, v_quem, k.identidade, k.versao, v_dia));
  end loop;
end $$;
