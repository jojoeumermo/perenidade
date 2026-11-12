-- Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
--
-- Chat privado da Alumia: remetente selado e retenção mínima. Documento: docs/rede/CHAT-PRIVADO.md ("Remetente selado").
--
-- Cada mensagem vai cifrada por Olm só para o aparelho da outra pessoa e, por fora, num envelope HPKE (X-Wing) que só ela abre,
-- com quem mandou DENTRO. O banco guarda só: para quem, o envelope e o DIA (sem hora). Não guarda quem mandou, nem de qual
-- conversa é, nem a hora. A mensagem SAI do banco assim que o aparelho de quem recebe confirma que guardou (ou em 30 dias, se
-- ninguém buscar). O histórico fica no aparelho, cifrado.
--
-- Quem pode deixar envelope na caixa de alguém: quem tem a "senha de entrega" dessa pessoa. Ela entrega a senha só a quem tem
-- conversa aberta com ela, num recado Olm (o aperto de mão). O banco guarda só o resumo (SHA-256) das senhas. Deixar envelope não
-- exige entrar na conta: o banco não sabe nem qual conta mandou (e o site não guarda endereço de rede).
--
-- Precisa de 20261113-chat-olm.sql. Pode rodar de novo.

-- ── 1. Tabelas ─────────────────────────────────────────────────────────────────────────────────────────────────────────────

-- As senhas de entrega de cada pessoa (só o resumo; até 3 ao mesmo tempo, para trocar sem perder mensagem no caminho).
create table if not exists interno.rede_sel_entrega (
  usuario uuid primary key references interno.perfis (id) on delete cascade,
  resumos text[] not null check (cardinality(resumos) between 1 and 3),
  trocado_em timestamptz not null default now()
);

-- A caixa: para quem, o envelope e o dia. Nada mais.
create table if not exists interno.rede_sel_caixa (
  id bigint generated always as identity primary key,
  para uuid not null references interno.perfis (id) on delete cascade,
  envelope text not null check (
    envelope ~ '^s1\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$' and char_length(split_part(envelope, '.', 2)) = 1494
    and char_length(split_part(envelope, '.', 3)) in (2752, 5483, 10944, 21867, 32790, 43712)),
  dia date not null default (now() at time zone 'utc')::date
);
create index if not exists rede_sel_caixa_para on interno.rede_sel_caixa (para, id);

-- Quantos envelopes cada caixa recebeu em cada hora (o freio contra enxurrada; some em 2 horas).
create table if not exists interno.rede_sel_contagem (
  para uuid not null,
  hora timestamptz not null,
  n integer not null default 0,
  primary key (para, hora)
);

alter table interno.rede_sel_entrega enable row level security;
alter table interno.rede_sel_caixa enable row level security;
alter table interno.rede_sel_contagem enable row level security;
revoke all on interno.rede_sel_entrega, interno.rede_sel_caixa, interno.rede_sel_contagem from public;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on interno.rede_sel_entrega, interno.rede_sel_caixa, interno.rede_sel_contagem from anon, authenticated;
  end if;
end $$;

-- Quando a chave do chat da pessoa some (apagar tudo do chat, apagar a conta), a caixa e as senhas somem junto.
create or replace function interno.rede_sel_ao_apagar_chave() returns trigger language plpgsql security definer set search_path = interno, pg_temp as $$
begin
  delete from rede_sel_entrega where usuario = old.usuario;
  delete from rede_sel_caixa where para = old.usuario;
  return old;
end $$;
drop trigger if exists rede_sel_ao_apagar_chave on interno.rede_dm_chaves;
create trigger rede_sel_ao_apagar_chave after delete on interno.rede_dm_chaves for each row execute function interno.rede_sel_ao_apagar_chave();

-- ── 2. Funções ─────────────────────────────────────────────────────────────────────────────────────────────────────────────

/** Troca as senhas de entrega desta pessoa (só os resumos). Ao bloquear alguém, o aparelho troca e entrega a nova só aos outros. */
create or replace function public.rede_sel_entrega_publicar(p_resumos text[]) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); x text;
begin
  perform interno.aberta('comunidade');
  if not interno.rede2_membro(v) then perform interno.erro('consentimento'); end if;
  perform interno.limite('rede_sel_entrega', 30, 60);
  if coalesce(cardinality(p_resumos), 0) not between 1 and 3 then perform interno.erro('invalido:resumos'); end if;
  foreach x in array p_resumos loop
    if x !~ '^[A-Za-z0-9+/]{43}=$' then perform interno.erro('invalido:resumos'); end if;
  end loop;
  insert into rede_sel_entrega (usuario, resumos) values (v, p_resumos)
  on conflict (usuario) do update set resumos = excluded.resumos, trocado_em = now();
  return jsonb_build_object('ok', true);
end $$;

/**
 * Deixa um envelope na caixa de `p_para`, com a senha de entrega dela. Não precisa entrar na conta: o banco não sabe quem
 * deixou. Resposta igual para senha errada e pessoa sem caixa ("dm_fechada"). Freio: 600 envelopes por hora por caixa.
 */
create or replace function public.rede_sel_depositar(p_para uuid, p_senha text, p_envelope text) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v_hora timestamptz := date_trunc('hour', now()); v_n integer;
begin
  perform interno.aberta('comunidade');
  if p_para is null or p_senha is null or char_length(p_senha) <> 43
     or not exists (select 1 from rede_sel_entrega e where e.usuario = p_para and encode(sha256(convert_to(p_senha, 'UTF8')), 'base64') = any (e.resumos)) then
    perform interno.erro('dm_fechada');
  end if;
  if p_envelope is null or p_envelope !~ '^s1\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$' or char_length(split_part(p_envelope, '.', 2)) <> 1494
     or char_length(split_part(p_envelope, '.', 3)) not in (2752, 5483, 10944, 21867, 32790, 43712) then
    perform interno.erro('invalido:envelope');
  end if;
  delete from rede_sel_contagem where hora < now() - interval '2 hours';
  insert into rede_sel_contagem (para, hora, n) values (p_para, v_hora, 1)
  on conflict (para, hora) do update set n = rede_sel_contagem.n + 1 returning n into v_n;
  if v_n > 600 then perform interno.erro('muitos_pedidos'); end if;
  insert into rede_sel_caixa (para, envelope) values (p_para, p_envelope);
  return jsonb_build_object('ok', true);
end $$;

/** Os envelopes da minha caixa (até 100, os mais antigos primeiro). Faz a faxina: envelope com mais de 30 dias some. */
create or replace function public.rede_sel_receber() returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu();
begin
  perform interno.aberta('comunidade');
  if not interno.rede2_membro(v) then perform interno.erro('consentimento'); end if;
  perform interno.limite('rede_sel_receber', 1200, 60);
  delete from rede_sel_caixa where dia < (now() at time zone 'utc')::date - 30;
  return coalesce((select jsonb_agg(jsonb_build_object('id', x.id, 'envelope', x.envelope, 'dia', x.dia) order by x.id)
    from (select * from rede_sel_caixa where para = v order by id limit 100) x), '[]'::jsonb);
end $$;

/** O aparelho guardou os envelopes até `p_ate`: eles SAEM do banco. */
create or replace function public.rede_sel_confirmar(p_ate bigint) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); n integer;
begin
  perform interno.aberta('comunidade');
  delete from rede_sel_caixa where para = v and id <= p_ate;
  get diagnostics n = row_count;
  return jsonb_build_object('apagados', n);
end $$;

-- ── 3. Permissões ──────────────────────────────────────────────────────────────────────────────────────────────────────────
-- Deixar envelope: quem entrou e também o visitante (o envelope não diz de quem é; exigir a conta só serviria para o banco saber
-- quem mandou). O resto: só quem entrou.

revoke all on function interno.rede_sel_ao_apagar_chave() from public;
do $$
declare f record;
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on function interno.rede_sel_ao_apagar_chave() from anon, authenticated;
  end if;
  for f in select p.oid::regprocedure as assinatura, p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
           where n.nspname = 'public' and p.proname in ('rede_sel_entrega_publicar', 'rede_sel_depositar', 'rede_sel_receber', 'rede_sel_confirmar') loop
    execute format('revoke all on function %s from public', f.assinatura);
    if exists (select 1 from pg_roles where rolname = 'anon') then
      if f.proname = 'rede_sel_depositar' then
        execute format('grant execute on function %s to anon, authenticated', f.assinatura);
      else
        execute format('revoke all on function %s from anon', f.assinatura);
        execute format('grant execute on function %s to authenticated', f.assinatura);
      end if;
    end if;
  end loop;
end $$;
