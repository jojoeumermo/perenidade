-- Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
--
-- O código do aplicativo autenticador voltou a passar (site, painel e Alumia).
--
-- A onda 8 (20261114-alumia-o8-conta.sql, parte 3b) pôs um gatilho em auth.mfa_challenges que trocava o endereço de rede por
-- 0.0.0.0 ANTES de gravar. Só que o serviço de contas guarda esse endereço de propósito: na hora de conferir o código, ele compara
-- o endereço de quem pediu o código com o de quem confirma e, se forem diferentes, recusa (422 mfa_ip_address_mismatch). Com o
-- 0.0.0.0 gravado, nenhum código passava mais, nem o certo: nem para entrar, nem para cadastrar o aplicativo.
--
-- Agora o endereço do pedido de código fica guardado só enquanto o pedido vale (o serviço de contas aceita a resposta por
-- 5 minutos) e é zerado depois de 15: pelo pg_cron de 5 em 5 minutos, e também na faxina de cada pedido novo. A privacidade
-- continua: nenhum endereço fica guardado mais que uns minutos. Sessões e registro de auditoria seguem com o gatilho de antes
-- (o serviço de contas não confere o endereço delas).
-- Pode rodar mais de uma vez.

do $$
begin
  if to_regclass('auth.mfa_challenges') is not null then
    execute 'drop trigger if exists alumia_sem_endereco on auth.mfa_challenges';
  end if;
exception when others then
  raise warning 'mfa_endereco: não deu para tirar o gatilho de auth.mfa_challenges (%). Sem isso, o código do autenticador não passa.', sqlerrm;
end $$;

/** Zera o endereço dos pedidos de código do autenticador que já não valem (mais de 15 minutos). Devolve quantos zerou. */
create or replace function interno.mfa_endereco_zerar() returns integer language plpgsql security definer set search_path = interno, pg_temp as $$
declare v integer := 0;
begin
  if to_regclass('auth.mfa_challenges') is null then return 0; end if;
  execute 'update auth.mfa_challenges set ip_address = ''0.0.0.0''::inet where created_at < now() - interval ''15 minutes'' and ip_address is not null and ip_address <> ''0.0.0.0''::inet';
  get diagnostics v = row_count;
  return v;
exception when others then
  return 0;
end $$;
revoke all on function interno.mfa_endereco_zerar() from public;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on function interno.mfa_endereco_zerar() from anon, authenticated;
  end if;
end $$;

/** Gatilho depois de cada pedido de código novo: aproveita e zera os antigos (vale mesmo sem o pg_cron). */
create or replace function interno.mfa_endereco_faxina() returns trigger language plpgsql security definer set search_path = interno, pg_temp as $$
begin
  perform interno.mfa_endereco_zerar();
  return null;
end $$;
revoke all on function interno.mfa_endereco_faxina() from public;

do $$
begin
  if to_regclass('auth.mfa_challenges') is not null then
    execute 'drop trigger if exists mfa_endereco_faxina on auth.mfa_challenges';
    execute 'create trigger mfa_endereco_faxina after insert on auth.mfa_challenges for each statement execute function interno.mfa_endereco_faxina()';
  end if;
exception when others then
  raise warning 'mfa_endereco: o gatilho de faxina em auth.mfa_challenges ficou de fora (%). O pg_cron zera os endereços.', sqlerrm;
end $$;

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule('lucia-mfa-endereco', '*/5 * * * *', 'select interno.mfa_endereco_zerar()');
  end if;
exception when others then null;
end $$;

select interno.mfa_endereco_zerar();

/**
 * Para a Saúde do painel (coordenação e quem o painel aceita). Só sim, não e números: nenhum endereço, nenhuma conta.
 *   sessoes_legiveis    o banco lê auth.sessions (a porta confere a sessão; sem isso, o token e a lista de cortes)
 *   sessoes_apagaveis   o banco apaga sessões e tokens de renovação (sem isso, o servidor apaga pelo serviço de contas)
 *   aviso_de_entrada    "gatilho" (em auth.sessions) ou "servidor" (ao entrar pela porta da Alumia)
 *   cortes_em_vigor     quantas anotações de corte ainda valem (número só a partir de 3; abaixo, "menos de 3")
 *   enderecos           por tabela do serviço de contas que grava endereço de rede: o que zera existe (o gatilho; nos pedidos
 *                       de código do autenticador, a faxina depois de 15 minutos)? E quantas linhas têm endereço além do
 *                       permitido (nulo: não dá para conferir). Nos pedidos de código, só conta o que passou dos 15 minutos.
 */
create or replace function public.alumia_painel_servico_de_contas() returns jsonb language plpgsql stable security definer set search_path = interno, pg_temp as $$
declare v_papel text := interno.alumia_painel_exige(); r record; v_enderecos jsonb := '{}'::jsonb; v_gatilho boolean; v_n integer; v_cortes integer;
begin
  for r in select * from (values ('sessions', 'ip', 'ip is not null', 'alumia_sem_endereco'),
                                 ('mfa_challenges', 'ip_address', 'ip_address is not null and ip_address <> ''0.0.0.0''::inet and created_at < now() - interval ''15 minutes''', 'mfa_endereco_faxina'),
                                 ('audit_log_entries', 'ip_address', 'ip_address is not null and ip_address::text <> ''''', 'alumia_sem_endereco')) as t (tabela, coluna, com_endereco, gatilho) loop
    if to_regclass('auth.' || r.tabela) is null
       or not exists (select 1 from information_schema.columns c where c.table_schema = 'auth' and c.table_name = r.tabela and c.column_name = r.coluna) then
      continue;
    end if;
    v_gatilho := exists (select 1 from pg_trigger t where t.tgrelid = to_regclass('auth.' || r.tabela) and t.tgname = r.gatilho and t.tgenabled <> 'D');
    v_n := null;
    begin
      execute format('select count(*)::integer from auth.%I where %s', r.tabela, r.com_endereco) into v_n;
    exception when others then
      v_n := null;
    end;
    v_enderecos := v_enderecos || jsonb_build_object(r.tabela, jsonb_build_object('gatilho', v_gatilho, 'com_endereco', v_n));
  end loop;
  select count(*)::integer into v_cortes from alumia_sessoes_cortadas where ate > now();
  return jsonb_build_object(
    'papel', v_papel,
    'sessoes_legiveis', interno.alumia_sessoes_legiveis(),
    'sessoes_apagaveis', interno.alumia_sessoes_apagaveis(),
    'aviso_de_entrada', case when interno.alumia_entrada_gatilho() then 'gatilho' else 'servidor' end,
    'cortes_em_vigor', case when v_cortes >= 3 then to_jsonb(v_cortes) else to_jsonb('menos de 3'::text) end,
    'enderecos', v_enderecos);
end $$;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on function public.alumia_painel_servico_de_contas() from public, anon;
    grant execute on function public.alumia_painel_servico_de_contas() to authenticated, service_role;
  end if;
end $$;
