-- Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
--
-- ═══════════════════════ Alumia · Onda 14 · Conta e serviço de contas no Supabase de verdade (20/11/2026) ═══════════════════════
-- No projeto hospedado, as tabelas auth.* são do serviço de contas (supabase_auth_admin), e o papel postgres, dono das nossas
-- funções, pode não ter leitura, DELETE, UPDATE ou TRIGGER nelas. A onda 8 (20261114-alumia-o8-conta.sql) contava com isso.
-- Aqui, o que muda quando falta a permissão:
--
--   1. A porta não libera em silêncio. Antes, interno.alumia_sessao_viva respondia "viva" quando não conseguia ler auth.sessions;
--      agora confere o token (o prazo "exp") e a lista das sessões cortadas por nós (interno.alumia_sessoes_cortadas: a conta, a
--      sessão do token e quando foi cortada; nenhum endereço, nenhum aparelho). Desconectar um aparelho, todos os outros, o pânico,
--      o código de recuperação, o pânico do painel e a derrubada pelo painel anotam o corte ANTES de tentar apagar as sessões; o
--      token já emitido para na porta mesmo quando o banco não pode apagar nada. A anotação some sozinha (8 dias, o prazo mais
--      longo de um token; 90 dias quando é uma sessão só, que pode renovar o token se o serviço de contas não a apagou).
--   2. Apagar as sessões continua sendo tentado no banco (reserva). O caminho principal é o servidor do site, que chama o serviço
--      de contas (app/api/alumia/conta: "sair dos outros aparelhos" e "sair de todos", e tira o aplicativo autenticador depois do
--      código de recuperação). Sem permissão, o banco não quebra a chamada: diz que não apagou e deixa o servidor fazer.
--   3. Aviso de entrada nova sem o gatilho em auth.sessions: o servidor do site avisa ao entrar pela porta da Alumia
--      (public.alumia_porta_entrou). Com o gatilho, ele responde "o gatilho já avisa" e não repete.
--   4. A Saúde do painel diz o que o banco consegue no serviço de contas (public.alumia_painel_servico_de_contas): ler e apagar as
--      sessões, o gatilho de entrada nova, e se cada tabela do serviço de contas que grava endereço de rede tem o gatilho que zera.
--      Se não tem, diz quantas linhas ainda têm endereço (só o número; o endereço não sai daqui), ou que não dá para conferir.
--   5. E-mails de conta: os de entrada nova, de código de recuperação usado, o novo de pedido de apagamento da conta e o novo de
--      termos que mudaram (reaceite) levam, depois do português, o mesmo recado curto em inglês, espanhol, francês, russo e chinês
--      (o banco não sabe o idioma de cada pessoa).
--
-- Leis: LGPD art. 6º, III (necessidade): a lista de cortes guarda só a conta, a sessão e a hora, e some sozinha. Art. 46: RLS sem
-- política e acesso só por função.
-- Pode rodar mais de uma vez (scripts/testar-alumia-o14-conta.mjs roda duas). Roda DEPOIS de todas as migrações das ondas 8 a 13.
-- NÃO rodar em produção sem o Jonathan.

-- ── 1. As sessões cortadas ────────────────────────────────────────────────────────────────────────────────────────────────

create table if not exists interno.alumia_sessoes_cortadas (
  id bigint generated always as identity primary key,
  usuario uuid not null references interno.perfis (id) on delete cascade,
  -- Uma sessão só (desconectar um aparelho).
  sessao uuid,
  -- Todas menos esta (desconectar os outros, código de recuperação). Nulo com "sessao" nulo: todas (pânico).
  exceto uuid,
  antes_de timestamptz not null default now(),
  ate timestamptz not null,
  check (sessao is null or exceto is null)
);
create index if not exists alumia_sessoes_cortadas_usuario on interno.alumia_sessoes_cortadas (usuario, ate);
alter table interno.alumia_sessoes_cortadas enable row level security;
revoke all on table interno.alumia_sessoes_cortadas from public;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then revoke all on table interno.alumia_sessoes_cortadas from anon, authenticated; end if;
end $$;

/** Quando o token desta chamada foi emitido ("iat"), ou nulo. */
create or replace function interno.alumia_token_emitido() returns timestamptz language sql stable as $$
  select case when interno.claims() ->> 'iat' ~ '^[0-9]{1,12}(\.[0-9]+)?$' then to_timestamp((interno.claims() ->> 'iat')::double precision) end
$$;

/** O token desta chamada ainda está no prazo ("exp")? Sem "exp", quem decide é a API (que já recusa token vencido). */
create or replace function interno.alumia_token_no_prazo() returns boolean language sql stable as $$
  select case when interno.claims() ->> 'exp' ~ '^[0-9]{1,12}(\.[0-9]+)?$' then (interno.claims() ->> 'exp')::double precision > extract(epoch from now())
              else true end
$$;

/** A sessão (e o token emitido em p_emitido) foi cortada por nós? Token sem "iat" conta como emitido antes do corte. */
create or replace function interno.alumia_sessao_cortada(p_usuario uuid, p_sessao uuid, p_emitido timestamptz) returns boolean
language sql stable security definer set search_path = interno, pg_temp as $$
  select exists (
    select 1 from alumia_sessoes_cortadas c
    where c.usuario = p_usuario and c.ate > now()
      and ((c.sessao is not null and c.sessao = p_sessao)
        or (c.sessao is null and (c.exceto is null or p_sessao is distinct from c.exceto) and (p_emitido is null or p_emitido < c.antes_de))))
$$;

/**
 * A sessão desta chamada ainda vale? Verdadeiro para quem não traz conta (visitante, chave de serviço, o próprio banco). Falso
 * quando a sessão foi cortada por nós, quando o serviço de contas não a tem mais, ou quando o token venceu. Sem leitura de
 * auth.sessions (projeto que não deixa), vale o token e a lista de cortes: nunca "viva" por falta de permissão.
 */
create or replace function interno.alumia_sessao_viva() returns boolean language plpgsql stable security definer set search_path = interno, pg_temp as $$
declare v_id uuid := interno.alumia_sessao_atual(); v_uid uuid := auth.uid(); v boolean;
begin
  if v_uid is null then return true; end if;
  if interno.alumia_sessao_cortada(v_uid, v_id, interno.alumia_token_emitido()) then return false; end if;
  if v_id is null or to_regclass('auth.sessions') is null then return interno.alumia_token_no_prazo(); end if;
  begin
    execute 'select exists (select 1 from auth.sessions s where s.id = $1 and s.user_id = $2)' into v using v_id, v_uid;
    return coalesce(v, false) and interno.alumia_token_no_prazo();
  exception when insufficient_privilege or undefined_column or undefined_table then
    return interno.alumia_token_no_prazo();
  end;
end $$;

/**
 * Corta sessões de uma conta: todas, todas menos p_menos, ou só p_so. Anota o corte (a porta para o token já emitido) e tenta
 * apagar as sessões e os tokens de renovação no serviço de contas (reserva do servidor, app/api/alumia/conta). Devolve
 * {apagadas, apagou}: "apagou" falso quando o banco não tem permissão (o servidor apaga pelo serviço de contas).
 */
create or replace function interno.alumia_cortar_sessoes(p_usuario uuid, p_menos uuid default null, p_so uuid default null) returns jsonb
language plpgsql security definer set search_path = interno, pg_temp as $$
declare v_n integer := 0; v_apagou boolean := false;
begin
  if p_usuario is null then return jsonb_build_object('apagadas', 0, 'apagou', false); end if;
  delete from alumia_sessoes_cortadas where ate <= now();
  if exists (select 1 from perfis where id = p_usuario) then
    insert into alumia_sessoes_cortadas (usuario, sessao, exceto, ate)
    values (p_usuario, p_so, case when p_so is null then p_menos end, now() + case when p_so is null then interval '8 days' else interval '90 days' end);
  end if;
  if to_regclass('auth.sessions') is null then return jsonb_build_object('apagadas', 0, 'apagou', true); end if;
  begin
    if to_regclass('auth.refresh_tokens') is not null then
      begin
        execute 'delete from auth.refresh_tokens r where r.session_id in (select s.id from auth.sessions s where s.user_id = $1
                   and ($2::uuid is null or s.id <> $2) and ($3::uuid is null or s.id = $3))' using p_usuario, p_menos, p_so;
      exception when undefined_column then
        -- Serviço antigo, sem sessão no token de renovação: só dá para cortar todos (e só quando é para cortar todos).
        if p_menos is null and p_so is null then execute 'delete from auth.refresh_tokens where user_id::text = $1' using p_usuario::text; end if;
      end;
    end if;
    execute 'delete from auth.sessions s where s.user_id = $1 and ($2::uuid is null or s.id <> $2) and ($3::uuid is null or s.id = $3)'
      using p_usuario, p_menos, p_so;
    get diagnostics v_n = row_count;
    v_apagou := true;
  exception when insufficient_privilege then
    v_apagou := false;
    begin
      execute 'select count(*)::integer from auth.sessions s where s.user_id = $1 and ($2::uuid is null or s.id <> $2) and ($3::uuid is null or s.id = $3)'
        into v_n using p_usuario, p_menos, p_so;
    exception when insufficient_privilege then
      v_n := 0;
    end;
  end;
  return jsonb_build_object('apagadas', v_n, 'apagou', v_apagou);
end $$;

/** O mesmo de antes (a onda 8 chama): quantas sessões saíram, ou, sem permissão para apagar, quantas foram cortadas na porta. */
create or replace function interno.alumia_encerrar_sessoes(p_usuario uuid, p_menos uuid default null, p_so uuid default null) returns integer
language plpgsql security definer set search_path = interno, pg_temp as $$
begin
  return coalesce((interno.alumia_cortar_sessoes(p_usuario, p_menos, p_so) ->> 'apagadas')::integer, 0);
end $$;

/** O banco consegue apagar as sessões do serviço de contas? (A Saúde do painel mostra.) */
create or replace function interno.alumia_sessoes_apagaveis() returns boolean language plpgsql stable security definer set search_path = interno, pg_temp as $$
begin
  if to_regclass('auth.sessions') is null then return false; end if;
  return has_table_privilege('auth.sessions', 'DELETE')
     and (to_regclass('auth.refresh_tokens') is null or has_table_privilege('auth.refresh_tokens', 'DELETE'));
exception when others then
  return false;
end $$;

-- As outras saídas que apagavam sessões direto passam pelo corte (sem permissão, elas quebravam a chamada inteira).

/** Encerra as sessões de uma conta pelo painel (banimento, suspensão). Devolve se o banco conseguiu apagar. */
create or replace function interno.alumia_painel_derrubar(p uuid) returns boolean language plpgsql security definer set search_path = interno, pg_temp as $$
begin
  return coalesce((interno.alumia_cortar_sessoes(p) ->> 'apagou')::boolean, false);
end $$;

/** As sessões paradas há mais tempo que o prazo saem (o site chama de vez em quando). Sem permissão, não quebra a entrada. */
create or replace function interno.vencer_sessoes() returns integer language plpgsql security definer set search_path = interno, pg_temp as $$
declare v_dias int := coalesce((select (valor ->> 'sessao_dias')::int from configuracoes where chave = 'seguranca'), 60); v_n int := 0;
begin
  if v_dias < 1 then return 0; end if;
  if to_regclass('auth.sessions') is not null then
    begin
      execute format('delete from auth.sessions where coalesce(updated_at, created_at) < now() - interval ''%s days''', v_dias);
      get diagnostics v_n = row_count;
    exception when insufficient_privilege then
      v_n := 0;
    end;
  end if;
  delete from aparelhos where ultimo < now() - make_interval(days => v_dias);
  return v_n;
end $$;

/**
 * O botão de pânico do painel da equipe (o mesmo de antes): avisa a coordenação e encerra as sessões da conta em todos os
 * aparelhos. Agora pelo corte: o token para na porta mesmo quando o banco não pode apagar as sessões.
 */
create or replace function public.panico(p_motivo text default '') returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); v_nome text := coalesce((select interno.nome_visto(nome) from perfis where id = v), 'Alguém da equipe'); v_motivo text := left(btrim(coalesce(p_motivo, '')), 200);
begin
  perform interno.limite('panico', 5, 60);
  perform interno.registrar('panico', v_nome, jsonb_build_object('motivo', v_motivo));
  perform interno.avisar_lideranca(format('%s apertou o botão de pânico no painel%s. As sessões da conta foram encerradas em todos os aparelhos. Fale com a pessoa por outro canal antes de qualquer coisa.',
    v_nome, case when v_motivo <> '' then ' (' || v_motivo || ')' else '' end), v);
  perform interno.alumia_cortar_sessoes(v);
  return jsonb_build_object('ok', true);
end $$;

-- ── 2. A tela de segurança sem leitura das sessões ───────────────────────────────────────────────────────────────────────

/**
 * Os aparelhos com sessão aberta nesta conta (o mesmo de 20261114-alumia-o8-conta.sql). Sem leitura de auth.sessions, responde
 * "indisponível" em vez de erro: a tela diz que a lista não está disponível e o pânico continua valendo.
 */
create or replace function public.alumia_conta_aparelhos() returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.alumia_conta_confiavel(); v_atual uuid := interno.alumia_sessao_atual(); v_lista jsonb := '[]'::jsonb;
begin
  if to_regclass('auth.sessions') is null then return jsonb_build_object('disponivel', false, 'aparelhos', '[]'::jsonb); end if;
  begin
    execute $q$
      select coalesce(jsonb_agg(x order by (x ->> 'este')::boolean desc, x ->> 'ultima' desc, x ->> 'desde' desc), '[]'::jsonb) from (
        select jsonb_build_object(
          'id', s.id,
          'desde', (s.criado)::date,
          'ultima', (greatest(s.criado, s.mudou, s.renovou))::date,
          'este', s.id = $2,
          'confirmado', s.aal = 'aal2') || interno.alumia_navegador(s.agente) as x
        from (select (j ->> 'id')::uuid as id, (j ->> 'created_at')::timestamptz as criado, (j ->> 'updated_at')::timestamptz as mudou,
                     (j ->> 'refreshed_at')::timestamptz as renovou, j ->> 'aal' as aal, j ->> 'user_agent' as agente
              from (select to_jsonb(t) as j from auth.sessions t where t.user_id = $1) a) s
        ) z
    $q$ into v_lista using v, v_atual;
  exception when insufficient_privilege or undefined_column then
    return jsonb_build_object('disponivel', false, 'aparelhos', '[]'::jsonb);
  end;
  return jsonb_build_object('disponivel', true, 'aparelhos', v_lista);
end $$;

-- ── 3. Código de recuperação sem permissão no serviço de contas ──────────────────────────────────────────────────────────

-- O sinal antigo "veio pelo servidor" era um cabeçalho do pedido, que quem chama o banco direto também põe. Sai: o servidor do site
-- usa a função dele (public.conta_codigo_usar_pelo_servidor), que só a chave de serviço chama.
drop function if exists interno.alumia_fator_pelo_servidor();

/**
 * Gasta um código de recuperação já conferido (o mesmo de 20261114-alumia-o8-conta.sql): desconecta os outros aparelhos (menos a
 * sessão p_sessao), avisa a pessoa e a liderança. p_pendente: o aplicativo autenticador ainda está na conta, e o servidor do site o
 * tira pelo serviço de contas.
 */
create or replace function interno.alumia_codigo_gastar(p_usuario uuid, p_sessao uuid, p_hash text, p_pendente boolean) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v_nome text;
begin
  update codigos_recuperacao set usado_em = now() where usuario = p_usuario and hash = p_hash;
  perform interno.alumia_cortar_sessoes(p_usuario, p_sessao);
  select nome into v_nome from perfis where id = p_usuario;
  perform interno.registrar('segundo_fator_recuperado', p_usuario::text, '{}'::jsonb);
  perform interno.avisar_em(p_usuario, 'Um código de recuperação foi usado: o aplicativo autenticador saiu da sua conta e os outros aparelhos foram desconectados. '
    || 'Cadastre outro aplicativo. Se não foi você, troque a senha agora e avise a coordenação.', 'conta');
  perform interno.email(interno.email_da_conta(p_usuario), 'codigo_recuperacao_usado', 'Código de recuperação usado na sua conta',
    'Um código de recuperação acabou de ser usado na sua conta do Instituto Lúcia. O aplicativo autenticador saiu da conta e os outros '
    || 'aparelhos foram desconectados.' || E'\n\n' || 'Se foi você, cadastre o aplicativo de novo ao entrar.' || E'\n\n'
    || 'Se não foi você, alguém tem a sua senha e um dos seus códigos: troque a senha agora e escreva para a coordenação.'
    || interno.alumia_email_linguas('codigo_recuperacao_usado'));
  if exists (select 1 from papeis where usuario = p_usuario) then
    perform interno.avisar_lideranca(coalesce(v_nome, 'Alguém da equipe') || ' usou um código de recuperação para tirar o aplicativo autenticador da conta.', p_usuario);
  end if;
  return jsonb_build_object('ok', true, 'restantes', (select count(*) from codigos_recuperacao where usuario = p_usuario and usado_em is null), 'fator_pendente', p_pendente);
end $$;

/**
 * Perdeu o celular do aplicativo autenticador (o mesmo de 20261114-alumia-o8-conta.sql): com a senha e um código de recuperação,
 * o aplicativo sai da conta e os outros aparelhos são desconectados. O que muda: sem permissão para apagar o aplicativo no banco,
 * o código não é gasto aqui; responde {ok: false, motivo: "pelo_servidor"} (o código confere e continua valendo), e o servidor do
 * site termina por public.conta_codigo_usar_pelo_servidor, que tira o aplicativo pelo serviço de contas.
 */
create or replace function public.conta_codigo_usar(p_codigo text) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); v_hash text;
begin
  perform interno.limite('codigo_recuperacao', 5, 60);
  if char_length(interno.codigo_normal(p_codigo)) <> 10 then
    perform interno.registrar('codigo_recuperacao_errado', v::text, '{}'::jsonb);
    return jsonb_build_object('ok', false, 'motivo', 'codigo_invalido');
  end if;
  select c.hash into v_hash from codigos_recuperacao c
  where c.usuario = v and c.usado_em is null and interno.codigo_confere(p_codigo, c.hash) limit 1;
  if v_hash is null then
    perform interno.registrar('codigo_recuperacao_errado', v::text, '{}'::jsonb);
    return jsonb_build_object('ok', false, 'motivo', 'codigo_invalido');
  end if;
  if to_regclass('auth.mfa_factors') is not null then
    begin
      execute 'delete from auth.mfa_factors where user_id = $1' using v;
    exception when insufficient_privilege then
      return jsonb_build_object('ok', false, 'motivo', 'pelo_servidor');
    end;
  end if;
  return interno.alumia_codigo_gastar(v, interno.alumia_sessao_atual(), v_hash, false);
end $$;

/**
 * Só a chave de serviço (app/api/alumia/conta, depois de conferir o token da pessoa com o serviço de contas e de conta_codigo_usar
 * responder "pelo_servidor"): gasta o código da conta p_usuario e desconecta os outros aparelhos (menos a sessão p_sessao). Se o
 * banco não pode tirar o aplicativo, devolve fator_pendente e o servidor o tira pelo serviço de contas. O freio de tentativas fica
 * em conta_codigo_usar, que a pessoa chama antes.
 */
create or replace function public.conta_codigo_usar_pelo_servidor(p_usuario uuid, p_sessao uuid, p_codigo text) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v_hash text; v_pendente boolean := false;
begin
  if not interno.servico() then perform interno.erro('sem_permissao'); end if;
  if p_usuario is null or char_length(interno.codigo_normal(p_codigo)) <> 10 then return jsonb_build_object('ok', false, 'motivo', 'codigo_invalido'); end if;
  select c.hash into v_hash from codigos_recuperacao c
  where c.usuario = p_usuario and c.usado_em is null and interno.codigo_confere(p_codigo, c.hash) limit 1;
  if v_hash is null then
    perform interno.registrar('codigo_recuperacao_errado', p_usuario::text, '{}'::jsonb);
    return jsonb_build_object('ok', false, 'motivo', 'codigo_invalido');
  end if;
  if to_regclass('auth.mfa_factors') is not null then
    begin
      execute 'delete from auth.mfa_factors where user_id = $1' using p_usuario;
    exception when insufficient_privilege then
      v_pendente := true;
    end;
  end if;
  return interno.alumia_codigo_gastar(p_usuario, p_sessao, v_hash, v_pendente);
end $$;

-- ── 4. Os e-mails de conta nas outras cinco línguas ──────────────────────────────────────────────────────────────────────

/**
 * O recado curto, em inglês, espanhol, francês, russo e chinês, que vai depois do português nos e-mails de conta. O banco não
 * sabe o idioma de cada pessoa; o recado não traz dado nenhum da pessoa (a data e o aparelho ficam no texto em português).
 */
create or replace function interno.alumia_email_linguas(p_tipo text) returns text language sql immutable as $$
  select E'\n\n— — —\n' || case p_tipo
    when 'alumia_entrada_nova' then
      'EN: Your Instituto Lúcia account just signed in on a device (details above). If it was not you, change your password now and, in Alumia, open Security and disconnect all devices.' || E'\n\n'
      || 'ES: Tu cuenta del Instituto Lúcia acaba de iniciar sesión en un dispositivo (detalles arriba). Si no fuiste tú, cambia la contraseña ahora y, en Alumia, abre Seguridad y desconecta todos los dispositivos.' || E'\n\n'
      || 'FR : Votre compte de l''Instituto Lúcia vient de se connecter sur un appareil (détails ci-dessus). Si ce n''était pas vous, changez votre mot de passe maintenant et, dans Alumia, ouvrez Sécurité et déconnectez tous les appareils.' || E'\n\n'
      || 'RU: В ваш аккаунт Instituto Lúcia только что вошли с устройства (подробности выше). Если это были не вы, сразу смените пароль и в Alumia откройте «Безопасность» и отключите все устройства.' || E'\n\n'
      || 'ZH：你的 Instituto Lúcia 账户刚刚在一台设备上登录（详情见上文）。如果不是你本人，请立即更改密码，并在 Alumia 中打开“安全”，断开所有设备。'
    when 'codigo_recuperacao_usado' then
      'EN: A recovery code was just used on your Instituto Lúcia account. The authenticator app was removed and your other devices were disconnected. If it was not you, change your password now and write to the coordination.' || E'\n\n'
      || 'ES: Se acaba de usar un código de recuperación en tu cuenta del Instituto Lúcia. La aplicación de autenticación salió de la cuenta y tus otros dispositivos fueron desconectados. Si no fuiste tú, cambia la contraseña ahora y escribe a la coordinación.' || E'\n\n'
      || 'FR : Un code de récupération vient d''être utilisé sur votre compte de l''Instituto Lúcia. L''application d''authentification a été retirée et vos autres appareils ont été déconnectés. Si ce n''était pas vous, changez votre mot de passe maintenant et écrivez à la coordination.' || E'\n\n'
      || 'RU: В вашем аккаунте Instituto Lúcia только что использовали код восстановления. Приложение-аутентификатор удалено из аккаунта, остальные устройства отключены. Если это были не вы, сразу смените пароль и напишите координации.' || E'\n\n'
      || 'ZH：你的 Instituto Lúcia 账户刚刚使用了一个恢复码。身份验证器应用已从账户中移除，其他设备已断开连接。如果不是你本人，请立即更改密码并联系协调组。'
    when 'alumia_apagamento' then
      'EN: Your Instituto Lúcia account was scheduled for deletion (the date is above). Until then you can change your mind: sign in to Alumia and, in My data, cancel the deletion. If it was not you, change your password now.' || E'\n\n'
      || 'ES: Tu cuenta del Instituto Lúcia quedó programada para ser borrada (la fecha está arriba). Hasta entonces puedes desistir: entra en Alumia y, en Mis datos, cancela el borrado. Si no fuiste tú, cambia la contraseña ahora.' || E'\n\n'
      || 'FR : La suppression de votre compte de l''Instituto Lúcia a été programmée (la date est ci-dessus). D''ici là, vous pouvez changer d''avis : connectez-vous à Alumia et, dans Mes données, annulez la suppression. Si ce n''était pas vous, changez votre mot de passe maintenant.' || E'\n\n'
      || 'RU: Ваш аккаунт Instituto Lúcia поставлен на удаление (дата указана выше). До этого вы можете передумать: войдите в Alumia и в разделе «Мои данные» отмените удаление. Если это были не вы, сразу смените пароль.' || E'\n\n'
      || 'ZH：你的 Instituto Lúcia 账户已被安排删除（日期见上文）。在此之前你可以改变主意：登录 Alumia，在“我的数据”中取消删除。如果不是你本人，请立即更改密码。'
    when 'alumia_termos_novos' then
      'EN: The Alumia terms of use and privacy policy have a new version. The next time you sign in, Alumia shows what changed and asks you to accept again.' || E'\n\n'
      || 'ES: Los términos de uso y la política de privacidad de Alumia tienen una versión nueva. La próxima vez que entres, Alumia muestra lo que cambió y te pide aceptar de nuevo.' || E'\n\n'
      || 'FR : Les conditions d''utilisation et la politique de confidentialité d''Alumia ont une nouvelle version. À votre prochaine connexion, Alumia montre ce qui a changé et vous demande d''accepter à nouveau.' || E'\n\n'
      || 'RU: У условий использования и политики конфиденциальности Alumia новая версия. При следующем входе Alumia покажет, что изменилось, и попросит принять их снова.' || E'\n\n'
      || 'ZH：Alumia 的使用条款和隐私政策有了新版本。你下次登录时，Alumia 会显示变更内容，并请你重新接受。'
    else '' end
$$;

-- ── 5. Aviso de entrada nova, com ou sem o gatilho ───────────────────────────────────────────────────────────────────────

/** O gatilho de entrada nova existe e está ligado em auth.sessions? */
create or replace function interno.alumia_entrada_gatilho() returns boolean language sql stable security definer set search_path = interno, pg_temp as $$
  select to_regclass('auth.sessions') is not null
     and exists (select 1 from pg_trigger t where t.tgrelid = to_regclass('auth.sessions') and t.tgname = 'alumia_sessao_nova' and t.tgenabled <> 'D')
$$;

/**
 * Avisa a entrada nova (aviso na conta e e-mail com o navegador, o sistema, o dia e a hora; sem endereço de rede). Só para quem
 * está na Alumia. O mesmo navegador em até 15 minutos não avisa de novo: pelas sessões do serviço de contas, quando o banco as
 * lê; senão, pelo aviso da própria conta. Erro aqui nunca impede a entrada. Devolve se avisou.
 */
create or replace function interno.alumia_entrada_avisar(p_usuario uuid, p_sessao uuid, p_agente text) returns boolean
language plpgsql security definer set search_path = interno, pg_temp as $$
declare v_texto text; v_quando text; v_repetida boolean := false;
begin
  begin
    if p_usuario is null or not exists (select 1 from perfis f where f.id = p_usuario and f.rede_consentimento is not null and not f.suspenso) then return false; end if;
    v_texto := interno.alumia_navegador_texto(p_agente);
    begin
      execute 'select exists (select 1 from auth.sessions s where s.user_id = $1 and s.id is distinct from $2 and s.created_at > now() - interval ''15 minutes''
                 and interno.alumia_navegador(s.user_agent) = interno.alumia_navegador($3))' into v_repetida using p_usuario, p_sessao, p_agente;
    exception when others then
      v_repetida := exists (select 1 from avisos a where a.para = p_usuario and a.categoria = 'conta' and a.criado_em > now() - interval '15 minutes'
                              and a.texto like 'Entrada nova na sua conta: ' || v_texto || ',%');
    end;
    if v_repetida then return false; end if;
    v_quando := to_char(now() at time zone 'America/Sao_Paulo', 'DD/MM/YYYY "às" HH24:MI');
    perform interno.avisar_em(p_usuario, 'Entrada nova na sua conta: ' || v_texto || ', em ' || v_quando || ' (hora de Brasília). Se não foi você, '
      || 'abra Segurança na Alumia e desconecte todos os aparelhos.', 'conta');
    perform interno.email(interno.email_da_conta(p_usuario), 'alumia_entrada_nova', 'Entrada nova na sua conta',
      'A sua conta do Instituto Lúcia acabou de entrar num aparelho:' || E'\n\n' || v_texto || E'\n' || v_quando || ' (hora de Brasília)' || E'\n\n'
      || 'Se foi você, não precisa fazer nada.' || E'\n\n'
      || 'Se não foi você, troque a senha agora e, na Alumia, abra Segurança e desconecte todos os aparelhos.'
      || interno.alumia_email_linguas('alumia_entrada_nova'), '', 6);
    return true;
  exception when others then
    return false;
  end;
end $$;

/** Gatilho em auth.sessions (o mesmo de 20261114-alumia-o8-conta.sql): lê só o "user agent" da linha nova. */
create or replace function interno.alumia_sessao_nova() returns trigger language plpgsql security definer set search_path = interno, pg_temp as $$
begin
  perform interno.alumia_entrada_avisar(new.user_id, new.id, to_jsonb(new) ->> 'user_agent');
  return new;
exception when others then
  return new;
end $$;

/**
 * O servidor do site acabou de abrir uma sessão pela porta da Alumia (app/api/alumia/porta/entrar). Com o gatilho em
 * auth.sessions, ele já avisou: nada a fazer. Sem o gatilho (o projeto não deixa criar), o aviso sai daqui. Só a chave de serviço.
 */
create or replace function public.alumia_porta_entrou(p_usuario uuid, p_sessao uuid, p_agente text) returns jsonb
language plpgsql security definer set search_path = interno, pg_temp as $$
begin
  if not interno.servico() then perform interno.erro('sem_permissao'); end if;
  if interno.alumia_entrada_gatilho() then return jsonb_build_object('avisou', false, 'por', 'gatilho'); end if;
  return jsonb_build_object('avisou', interno.alumia_entrada_avisar(p_usuario, p_sessao, left(coalesce(p_agente, ''), 500)), 'por', 'servidor');
end $$;

-- ── 6. E-mails de apagamento e de termos novos ───────────────────────────────────────────────────────────────────────────

/** Pedido de apagamento da conta (20261114-alumia-o8-meusdados.sql): a dona fica sabendo por e-mail, com o prazo para desistir. */
create or replace function interno.alumia_apagamento_email() returns trigger language plpgsql security definer set search_path = interno, pg_temp as $$
begin
  begin
    perform interno.email(interno.email_da_conta(new.usuario), 'alumia_apagamento', 'Pedido de apagamento da sua conta',
      'Recebemos um pedido para apagar a sua conta do Instituto Lúcia, com tudo o que é dela na Alumia. Os seus posts e stories já saíram do ar.'
      || E'\n\n' || 'A conta será apagada de vez em ' || to_char(new.apagar_em at time zone 'America/Sao_Paulo', 'DD/MM/YYYY "às" HH24:MI') || ' (hora de Brasília).'
      || E'\n\n' || 'Se mudar de ideia até lá, entre na Alumia e, em Meus dados, desista do apagamento.'
      || E'\n\n' || 'Se não foi você, alguém entrou na sua conta: troque a senha agora e desista do apagamento.'
      || interno.alumia_email_linguas('alumia_apagamento'), '', 3);
  exception when others then
    null;
  end;
  return new;
end $$;

/** Versão nova dos termos (20261114-alumia-o8-lei.sql): quem aceitou uma versão anterior recebe um e-mail; a tela pede o reaceite. */
create or replace function interno.alumia_termos_email() returns trigger language plpgsql security definer set search_path = interno, pg_temp as $$
declare r record;
begin
  begin
    for r in
      select distinct a.usuario from alumia_termos_aceites a join perfis f on f.id = a.usuario
      where a.versao < new.versao and not f.suspenso and f.rede_consentimento is not null
        and not exists (select 1 from alumia_termos_aceites b where b.usuario = a.usuario and b.versao >= new.versao)
    loop
      perform interno.email(interno.email_da_conta(r.usuario), 'alumia_termos_novos', 'Os termos da Alumia mudaram',
        'Os termos de uso e a política de privacidade da Alumia têm uma versão nova, de '
        || to_char(new.publicada_em, 'DD/MM/YYYY') || '.'
        || case when btrim(new.mudou) <> '' then E'\n\n' || 'O que mudou: ' || interno.sem_link(new.mudou) else '' end
        || E'\n\n' || 'Na próxima vez que você entrar, a Alumia mostra o que mudou e pede que você aceite de novo.'
        || interno.alumia_email_linguas('alumia_termos_novos'), '', 2);
    end loop;
  exception when others then
    null;
  end;
  return new;
end $$;

do $$
begin
  if to_regclass('interno.alumia_apagamentos') is not null then
    drop trigger if exists alumia_apagamento_email on interno.alumia_apagamentos;
    create trigger alumia_apagamento_email after insert on interno.alumia_apagamentos for each row execute function interno.alumia_apagamento_email();
  end if;
  if to_regclass('interno.alumia_termos') is not null and to_regclass('interno.alumia_termos_aceites') is not null then
    drop trigger if exists alumia_termos_email on interno.alumia_termos;
    create trigger alumia_termos_email after insert on interno.alumia_termos for each row execute function interno.alumia_termos_email();
  end if;
end $$;

/**
 * Apagar de vez (interno.alumia_md_apagar_de_vez) tira o perfil logo antes da conta: com ele saem os e-mails da fila para o
 * endereço da conta (o aviso do apagamento e qualquer outro), que senão ficariam até a faxina de 30 dias com o endereço de quem
 * já não existe. Se a conta já tiver saído antes do perfil, não há endereço para procurar e nada muda.
 */
create or replace function interno.alumia_perfil_sai_emails() returns trigger language plpgsql security definer set search_path = interno, pg_temp as $$
declare v_email text;
begin
  begin
    v_email := interno.email_da_conta(old.id);
    if v_email is not null then
      delete from emails where lower(para) = lower(v_email);
    end if;
  exception when others then
    null;
  end;
  return old;
end $$;
revoke all on function interno.alumia_perfil_sai_emails() from public;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on function interno.alumia_perfil_sai_emails() from anon, authenticated;
  end if;
  if to_regclass('interno.perfis') is not null and to_regclass('interno.emails') is not null then
    drop trigger if exists alumia_perfil_sai_emails on interno.perfis;
    create trigger alumia_perfil_sai_emails before delete on interno.perfis for each row execute function interno.alumia_perfil_sai_emails();
  end if;
end $$;

-- ── 7. A Saúde do painel: o que o banco consegue no serviço de contas ────────────────────────────────────────────────────

/**
 * Para a Saúde do painel (coordenação e quem o painel aceita). Só sim, não e números: nenhum endereço, nenhuma conta.
 *   sessoes_legiveis    o banco lê auth.sessions (a porta confere a sessão; sem isso, o token e a lista de cortes)
 *   sessoes_apagaveis   o banco apaga sessões e tokens de renovação (sem isso, o servidor apaga pelo serviço de contas)
 *   aviso_de_entrada    "gatilho" (em auth.sessions) ou "servidor" (ao entrar pela porta da Alumia)
 *   cortes_em_vigor     quantas anotações de corte ainda valem (número só a partir de 3; abaixo, "menos de 3")
 *   enderecos           por tabela do serviço de contas que grava endereço de rede: o gatilho que zera existe? Se não, quantas
 *                       linhas têm endereço (nulo: não dá para conferir)
 */
create or replace function public.alumia_painel_servico_de_contas() returns jsonb language plpgsql stable security definer set search_path = interno, pg_temp as $$
declare v_papel text := interno.alumia_painel_exige(); r record; v_enderecos jsonb := '{}'::jsonb; v_gatilho boolean; v_n integer; v_cortes integer;
begin
  for r in select * from (values ('sessions', 'ip', 'ip is not null'),
                                 ('mfa_challenges', 'ip_address', 'ip_address is not null and ip_address::text <> ''0.0.0.0'''),
                                 ('audit_log_entries', 'ip_address', 'ip_address is not null and ip_address::text <> ''''')) as t (tabela, coluna, com_endereco) loop
    if to_regclass('auth.' || r.tabela) is null
       or not exists (select 1 from information_schema.columns c where c.table_schema = 'auth' and c.table_name = r.tabela and c.column_name = r.coluna) then
      continue;
    end if;
    v_gatilho := exists (select 1 from pg_trigger t where t.tgrelid = to_regclass('auth.' || r.tabela) and t.tgname = 'alumia_sem_endereco' and t.tgenabled <> 'D');
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

-- ── 8. Permissões ─────────────────────────────────────────────────────────────────────────────────────────────────────────

revoke all on function interno.alumia_token_emitido(), interno.alumia_token_no_prazo(), interno.alumia_sessao_cortada(uuid, uuid, timestamptz),
  interno.alumia_sessao_viva(), interno.alumia_cortar_sessoes(uuid, uuid, uuid), interno.alumia_encerrar_sessoes(uuid, uuid, uuid),
  interno.alumia_sessoes_apagaveis(), interno.alumia_painel_derrubar(uuid), interno.vencer_sessoes(), interno.alumia_codigo_gastar(uuid, uuid, text, boolean),
  interno.alumia_email_linguas(text), interno.alumia_entrada_gatilho(), interno.alumia_entrada_avisar(uuid, uuid, text),
  interno.alumia_sessao_nova(), interno.alumia_apagamento_email(), interno.alumia_termos_email() from public;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on function interno.alumia_token_emitido(), interno.alumia_token_no_prazo(), interno.alumia_sessao_cortada(uuid, uuid, timestamptz),
      interno.alumia_sessao_viva(), interno.alumia_cortar_sessoes(uuid, uuid, uuid), interno.alumia_encerrar_sessoes(uuid, uuid, uuid),
      interno.alumia_sessoes_apagaveis(), interno.alumia_painel_derrubar(uuid), interno.vencer_sessoes(), interno.alumia_codigo_gastar(uuid, uuid, text, boolean),
      interno.alumia_email_linguas(text), interno.alumia_entrada_gatilho(), interno.alumia_entrada_avisar(uuid, uuid, text),
      interno.alumia_sessao_nova(), interno.alumia_apagamento_email(), interno.alumia_termos_email() from anon, authenticated;
    revoke all on function public.alumia_porta_entrou(uuid, uuid, text) from public, anon, authenticated;
    grant execute on function public.alumia_porta_entrou(uuid, uuid, text) to service_role;
    revoke all on function public.alumia_painel_servico_de_contas() from public, anon;
    grant execute on function public.alumia_painel_servico_de_contas() to authenticated, service_role;
    revoke all on function public.alumia_conta_aparelhos() from public, anon;
    grant execute on function public.alumia_conta_aparelhos() to authenticated, service_role;
    revoke all on function public.conta_codigo_usar(text) from public;
    grant execute on function public.conta_codigo_usar(text) to anon, authenticated, service_role;
    revoke all on function public.conta_codigo_usar_pelo_servidor(uuid, uuid, text) from public, anon, authenticated;
    grant execute on function public.conta_codigo_usar_pelo_servidor(uuid, uuid, text) to service_role;
    revoke all on function public.panico(text) from public;
    grant execute on function public.panico(text) to anon, authenticated, service_role;
  else
    revoke all on function public.alumia_porta_entrou(uuid, uuid, text), public.alumia_painel_servico_de_contas(),
      public.conta_codigo_usar_pelo_servidor(uuid, uuid, text) from public;
  end if;
end $$;

select interno.alumia_trancar();
