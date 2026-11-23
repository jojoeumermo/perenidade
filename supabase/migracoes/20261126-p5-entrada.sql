-- Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
--
-- ═══════════════════════ Alumia · P5 · O navegador conhecido: sem aviso de "entrada nova" a cada volta (26/11/2026) ═══════════════════════
-- Migração acrescentável: pode rodar mais de uma vez. Roda depois de 20261125-r3-fim.sql (banco na versão 16). Não mexe na versão
-- nem na lista de exceções da porta (isso é do 20261126-p5-fim.sql). Teste: scripts/testar-p5-entrada.mjs (a migração duas vezes
-- sobre o install.sql).
--
-- O problema: cada sessão nova no serviço de contas gerava, na hora, o aviso de "entrada nova" (gatilho alumia_sessao_nova em
-- auth.sessions). O login único entre o site, a Alumia e a Escola abre uma sessão nova a cada passagem, e sair do site derrubava a
-- sessão da Alumia; a pessoa recebia um aviso a cada volta, para o mesmo navegador. E a sessão aberta pelo servidor do site (entrar
-- com senha) guardava o "user agent" do servidor: "Navegador desconhecido em sistema desconhecido".
--
-- O conserto (o lado do site está em lib/sessao/aparelho.ts):
--   1. Cada navegador guarda um identificador aleatório num cookie HttpOnly, Secure e SameSite=Lax, que só o servidor do site lê.
--      O banco guarda só uma marca dele por conta (interno.alumia_navegadores): o SHA-256 do resumo do cookie junto com a conta, para
--      que o mesmo navegador em duas contas não dê a mesma marca (o banco não liga uma conta à outra por aqui). Junto, só o nome do
--      navegador e do sistema e o DIA em que foi visto. Nada de endereço de rede, versão, modelo do aparelho ou hora.
--   2. A sessão nova não avisa mais na hora: fica numa fila curta (interno.alumia_entradas_pendentes: a conta, a sessão, o nome do
--      navegador e quando abriu). O site apresenta a sessão com o cookie (public.alumia_aparelho_entrou, só a chave de serviço):
--      navegador conhecido sai da fila sem aviso; navegador novo recebe o aviso na hora. Sessão que ninguém apresentou em 10 minutos
--      (entrada direto pela API, fora do site) recebe o aviso do mesmo jeito, pela rotina de 5 em 5 minutos. A fila se apaga em 1 dia.
--   3. O cookie é renovado (o mesmo valor, prazo novo) uma vez a cada 30 dias; o navegador que some por 400 dias é esquecido.
--   4. interno.alumia_navegador (e o texto dele e o mínimo do "user agent" da R3) passam a reconhecer Vivaldi, Brave, Samsung
--      Internet, ChromeOS e os nomes do Firefox, do Edge, do Chrome e do Opera no iPhone e no Android (a mesma regra de
--      lib/rede/seguranca/navegador.ts; o teste confere que as duas dão o mesmo).
--
-- O identificador não é credencial: quem copia o cookie não entra em conta nenhuma, só evita um aviso (a senha e o código continuam).
--
-- Funções existentes redefinidas (definição completa; a de antes é a do install.sql deste ramo): interno.alumia_navegador,
-- interno.alumia_navegador_texto (20261114-alumia-o8-conta.sql), interno.alumia_agente_minimo (20261125-r3-publico-ferramentas.sql)
-- e interno.alumia_sessao_nova (20261120-alumia-o14-conta.sql).
-- Lei: LGPD art. 6º, III (necessidade: só o nome do navegador e o dia) e art. 46 (segurança: o aviso para aparelho novo de verdade).

-- ── 1. O navegador e o sistema, com mais nomes ─────────────────────────────────────────────────────────────────────────────

/** O navegador e o sistema de um "user agent", em códigos curtos (a tela traduz). Nada além disso sai do texto. */
create or replace function interno.alumia_navegador(p_agente text) returns jsonb language sql immutable as $$
  select jsonb_build_object(
    'navegador', case when a ~ 'Firefox/|FxiOS/' then 'firefox' when a ~ 'Edg/|EdgA/|EdgiOS/' then 'edge' when a ~ 'OPR/|OPiOS/|OPT/' then 'opera'
                      when a ~ 'Vivaldi/' then 'vivaldi' when a ~ 'Brave/' then 'brave' when a ~ 'SamsungBrowser/|Samsung/' then 'samsung'
                      when a ~ 'Chrome/|CriOS/' then 'chrome' when a ~ 'Safari/' then 'safari' else 'outro' end,
    'sistema', case when a ~ 'Android' then 'android' when a ~ 'iPhone|iPad|iPod' then 'ios' when a ~ 'CrOS' then 'chromeos'
                    when a ~ 'Windows' then 'windows' when a ~ 'Mac OS X|Macintosh' then 'macos' when a ~ 'Linux' then 'linux' else 'outro' end)
  from (select coalesce(p_agente, '') as a) x
$$;

/** O texto, em português, de um navegador e um sistema já em código (para o aviso e o e-mail): "Firefox em Linux". */
create or replace function interno.alumia_navegador_rotulo(p_navegador text, p_sistema text) returns text language sql immutable as $$
  select (case p_navegador when 'firefox' then 'Firefox' when 'edge' then 'Edge' when 'opera' then 'Opera' when 'vivaldi' then 'Vivaldi'
                           when 'brave' then 'Brave' when 'samsung' then 'Samsung Internet' when 'chrome' then 'Chrome'
                           when 'safari' then 'Safari' else 'Navegador desconhecido' end)
      || ' em ' ||
         (case p_sistema when 'android' then 'Android' when 'ios' then 'iPhone ou iPad' when 'chromeos' then 'ChromeOS' when 'windows' then 'Windows'
                         when 'macos' then 'macOS' when 'linux' then 'Linux' else 'sistema desconhecido' end)
$$;

/** O mesmo, a partir do "user agent": "Firefox em Linux". */
create or replace function interno.alumia_navegador_texto(p_agente text) returns text language sql immutable as $$
  select interno.alumia_navegador_rotulo(n ->> 'navegador', n ->> 'sistema')
  from (select interno.alumia_navegador(p_agente) as n) x
$$;

/**
 * O mínimo de um "user agent" que dá o mesmo navegador e o mesmo sistema em interno.alumia_navegador: "Firefox/ Linux",
 * "Chrome/ Android", "" quando nenhum dos dois é conhecido. Aplicar duas vezes dá o mesmo texto. (O de 20261125-r3-publico-
 * ferramentas.sql, com os nomes novos.)
 */
create or replace function interno.alumia_agente_minimo(p_agente text) returns text language sql immutable set search_path = interno, pg_temp as $$
  select btrim(
    (case n ->> 'navegador' when 'firefox' then 'Firefox/' when 'edge' then 'Edg/' when 'opera' then 'OPR/' when 'vivaldi' then 'Vivaldi/'
                           when 'brave' then 'Brave/' when 'samsung' then 'Samsung/' when 'chrome' then 'Chrome/'
                           when 'safari' then 'Safari/' else '' end)
    || ' ' ||
    (case n ->> 'sistema' when 'android' then 'Android' when 'ios' then 'iPhone' when 'chromeos' then 'CrOS' when 'windows' then 'Windows'
                         when 'macos' then 'Mac OS X' when 'linux' then 'Linux' else '' end))
  from (select interno.alumia_navegador(p_agente) as n) x
$$;

-- ── 2. As tabelas ─────────────────────────────────────────────────────────────────────────────────────────────────────────

/**
 * Os navegadores onde cada conta já entrou: só a marca do cookie (SHA-256 do resumo do cookie com a conta; o cookie não volta daqui),
 * o nome do navegador e do sistema e o dia em que foi visto. Sem endereço de rede, sem hora, sem versão. Sai quando a conta sai,
 * quando a pessoa não aparece nesse navegador por 400 dias, e cada conta guarda no máximo 30.
 */
create table if not exists interno.alumia_navegadores (
  usuario uuid not null references interno.perfis (id) on delete cascade,
  marca text not null check (marca ~ '^[0-9a-f]{64}$'),
  navegador text not null default 'outro' check (char_length(navegador) <= 20),
  sistema text not null default 'outro' check (char_length(sistema) <= 20),
  visto_em date not null default current_date,
  renovar_em date not null default (current_date + 30),
  primary key (usuario, marca)
);
alter table interno.alumia_navegadores enable row level security;

/**
 * A fila curta do aviso de entrada nova: a sessão que acabou de abrir espera até 10 minutos o site dizer se o navegador já é
 * conhecido. Só a conta, a sessão, o nome do navegador e do sistema e quando abriu; a linha sai em 1 dia.
 */
create table if not exists interno.alumia_entradas_pendentes (
  sessao uuid primary key,
  usuario uuid not null references interno.perfis (id) on delete cascade,
  rotulo text not null default '' check (char_length(rotulo) <= 80),
  criada timestamptz not null default now(),
  resolvida boolean not null default false
);
alter table interno.alumia_entradas_pendentes enable row level security;
create index if not exists alumia_entradas_pendentes_espera on interno.alumia_entradas_pendentes (criada) where not resolvida;

-- ── 3. O aviso ────────────────────────────────────────────────────────────────────────────────────────────────────────────

/**
 * Avisa a entrada nova (aviso na conta e e-mail com o navegador, o sistema, o dia e a hora em que a sessão abriu; sem endereço de
 * rede). Só para quem está na Alumia. Erro aqui nunca impede nada. Devolve se avisou.
 */
create or replace function interno.alumia_entrada_aviso(p_usuario uuid, p_rotulo text, p_quando timestamptz) returns boolean
language plpgsql security definer set search_path = interno, pg_temp as $$
declare v_texto text := coalesce(nullif(btrim(p_rotulo), ''), 'Navegador desconhecido em sistema desconhecido'); v_quando text;
begin
  begin
    if p_usuario is null or not exists (select 1 from perfis f where f.id = p_usuario and f.rede_consentimento is not null and not f.suspenso) then return false; end if;
    v_quando := to_char(coalesce(p_quando, now()) at time zone 'America/Sao_Paulo', 'DD/MM/YYYY "às" HH24:MI');
    perform interno.avisar_em(p_usuario, 'Entrada nova na sua conta: ' || v_texto || ', em ' || v_quando || ' (hora de Brasília). Se não foi você, '
      || 'abra Segurança na Alumia e desconecte todos os aparelhos.', 'conta');
    perform interno.email(interno.email_da_conta(p_usuario), 'alumia_entrada_nova', 'Entrada nova na sua conta',
      'A sua conta do Instituto Lúcia entrou num aparelho novo:' || E'\n\n' || v_texto || E'\n' || v_quando || ' (hora de Brasília)' || E'\n\n'
      || 'Se foi você, não precisa fazer nada.' || E'\n\n'
      || 'Se não foi você, troque a senha agora e, na Alumia, abra Segurança e desconecte todos os aparelhos.'
      || interno.alumia_email_linguas('alumia_entrada_nova'), '', 6);
    return true;
  exception when others then
    return false;
  end;
end $$;

/**
 * Gatilho em auth.sessions (o de 20261120-alumia-o14-conta.sql, que avisava na hora). Agora a sessão nova de quem está na Alumia
 * entra na fila curta, com o nome do navegador lido do "user agent" (já reduzido pelo gatilho alumia_agente_minimo da R3); quem
 * avisa é o site (public.alumia_aparelho_entrou) ou a rotina dos 10 minutos (interno.alumia_entradas_vencidas).
 */
create or replace function interno.alumia_sessao_nova() returns trigger language plpgsql security definer set search_path = interno, pg_temp as $$
begin
  begin
    if exists (select 1 from perfis f where f.id = new.user_id and f.rede_consentimento is not null and not f.suspenso) then
      insert into alumia_entradas_pendentes (sessao, usuario, rotulo)
      values (new.id, new.user_id, left(interno.alumia_navegador_texto(to_jsonb(new) ->> 'user_agent'), 80))
      on conflict (sessao) do nothing;
    end if;
  exception when others then
    null;
  end;
  return new;
end $$;

-- O gatilho já existe onde o projeto deixa (20261114-alumia-o8-conta.sql); se sumiu, volta. Sem permissão: segue sem ele, e o site
-- avisa o navegador novo (public.alumia_aparelho_entrou).
do $$
begin
  if to_regclass('auth.sessions') is not null
     and not exists (select 1 from pg_trigger t where t.tgrelid = to_regclass('auth.sessions') and t.tgname = 'alumia_sessao_nova') then
    execute 'create trigger alumia_sessao_nova after insert on auth.sessions for each row execute function interno.alumia_sessao_nova()';
  end if;
exception when others then
  raise notice 'alumia_sessao_nova: o gatilho em auth.sessions não pôde ser criado (%). O site avisa o navegador novo.', sqlerrm;
end $$;

-- ── 4. O site apresenta a sessão ──────────────────────────────────────────────────────────────────────────────────────────

/**
 * Só a chave de serviço (app/api/sessao/aparelho e app/api/alumia/porta/entrar, depois de o serviço de contas conferir o token).
 * p_hash: o resumo do cookie deste navegador (nulo quando não há cookie ou ele veio mexido); p_hash_novo: o resumo de um
 * identificador novo, que o site grava no cookie quando a resposta diz "novo". Devolve {conhecido, cookie: "novo" | "renovar" | null}.
 *   conhecido: o navegador já era desta conta. A sessão sai da fila sem aviso.
 *   novo: o navegador passa a ser conhecido daqui em diante e a entrada é avisada na hora (uma vez por sessão).
 */
create or replace function public.alumia_aparelho_entrou(p_usuario uuid, p_sessao uuid, p_hash text, p_hash_novo text, p_navegador text, p_sistema text)
returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare
  v_nav text := case when p_navegador in ('firefox', 'edge', 'opera', 'vivaldi', 'brave', 'samsung', 'chrome', 'safari') then p_navegador else 'outro' end;
  v_sis text := case when p_sistema in ('android', 'ios', 'chromeos', 'windows', 'macos', 'linux') then p_sistema else 'outro' end;
  v_hash text := case when p_hash ~ '^[0-9a-f]{64}$' then p_hash end;
  v_marca text; v_linha alumia_navegadores; v_cookie text; v_pend alumia_entradas_pendentes;
begin
  if not interno.servico() then perform interno.erro('sem_permissao'); end if;
  if p_usuario is null or not exists (select 1 from perfis where id = p_usuario) then
    return jsonb_build_object('conhecido', false, 'cookie', null);
  end if;
  if v_hash is not null then
    v_marca := encode(sha256(convert_to(v_hash || ':' || p_usuario::text, 'UTF8')), 'hex');
    select * into v_linha from alumia_navegadores where usuario = p_usuario and marca = v_marca;
  end if;
  if p_sessao is not null then
    select * into v_pend from alumia_entradas_pendentes where sessao = p_sessao and usuario = p_usuario for update;
  end if;

  if v_linha.marca is not null then
    -- Conhecido: só o dia em que foi visto muda; a sessão sai da fila sem aviso.
    v_cookie := case when v_linha.renovar_em <= current_date then 'renovar' end;
    update alumia_navegadores set visto_em = current_date, navegador = v_nav, sistema = v_sis,
      renovar_em = case when v_cookie is null then renovar_em else current_date + 30 end
    where usuario = p_usuario and marca = v_marca;
    if v_pend.sessao is not null then update alumia_entradas_pendentes set resolvida = true where sessao = p_sessao; end if;
    return jsonb_build_object('conhecido', true, 'cookie', v_cookie);
  end if;

  -- Novo nesta conta. O cookie que já existe (de outra conta neste navegador) continua; sem cookie, vale o identificador novo.
  if v_hash is null then
    if p_hash_novo !~ '^[0-9a-f]{64}$' or p_hash_novo is null then return jsonb_build_object('conhecido', false, 'cookie', null); end if;
    v_hash := p_hash_novo;
    v_marca := encode(sha256(convert_to(v_hash || ':' || p_usuario::text, 'UTF8')), 'hex');
    v_cookie := 'novo';
  else
    v_cookie := 'renovar';
  end if;
  insert into alumia_navegadores (usuario, marca, navegador, sistema) values (p_usuario, v_marca, v_nav, v_sis)
  on conflict (usuario, marca) do update set visto_em = current_date;
  delete from alumia_navegadores n where n.usuario = p_usuario and n.marca in (
    select marca from alumia_navegadores where usuario = p_usuario order by visto_em desc, renovar_em desc offset 30);

  -- O aviso, uma vez por sessão: pela fila (a sessão que o gatilho pôs lá e que ainda não foi avisada) ou, sem o gatilho, daqui.
  if v_pend.sessao is not null then
    if not v_pend.resolvida then
      update alumia_entradas_pendentes set resolvida = true where sessao = p_sessao;
      perform interno.alumia_entrada_aviso(p_usuario, interno.alumia_navegador_rotulo(v_nav, v_sis), v_pend.criada);
    end if;
  elsif not interno.alumia_entrada_gatilho() then
    perform interno.alumia_entrada_aviso(p_usuario, interno.alumia_navegador_rotulo(v_nav, v_sis), now());
  end if;
  return jsonb_build_object('conhecido', false, 'cookie', v_cookie);
end $$;

-- ── 5. As rotinas ─────────────────────────────────────────────────────────────────────────────────────────────────────────

/** A cada 5 minutos: a sessão que ninguém apresentou em 10 minutos recebe o aviso; a fila de mais de 1 dia sai. Devolve quantas avisou. */
create or replace function interno.alumia_entradas_vencidas() returns integer language plpgsql security definer set search_path = interno, pg_temp as $$
declare r record; v_n integer := 0;
begin
  for r in
    update alumia_entradas_pendentes set resolvida = true
    where not resolvida and criada < now() - interval '10 minutes'
    returning usuario, rotulo, criada
  loop
    if interno.alumia_entrada_aviso(r.usuario, r.rotulo, r.criada) then v_n := v_n + 1; end if;
  end loop;
  delete from alumia_entradas_pendentes where criada < now() - interval '1 day';
  return v_n;
end $$;

/** Uma vez por dia: o navegador que não aparece há 400 dias (o prazo do cookie) é esquecido. */
create or replace function interno.alumia_navegadores_faxina() returns integer language plpgsql security definer set search_path = interno, pg_temp as $$
declare v_n integer;
begin
  delete from alumia_navegadores where visto_em < current_date - 400;
  get diagnostics v_n = row_count;
  return v_n;
end $$;

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule('alumia-entradas-pendentes', '*/5 * * * *', 'select interno.alumia_entradas_vencidas()');
    perform cron.schedule('alumia-navegadores-faxina', '47 4 * * *', 'select interno.alumia_navegadores_faxina()');
  end if;
exception when others then null;
end $$;

-- ── 6. Permissões ─────────────────────────────────────────────────────────────────────────────────────────────────────────

revoke all on function interno.alumia_navegador_rotulo(text, text), interno.alumia_entrada_aviso(uuid, text, timestamptz),
  interno.alumia_entradas_vencidas(), interno.alumia_navegadores_faxina(),
  public.alumia_aparelho_entrou(uuid, uuid, text, text, text, text) from public;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on function interno.alumia_navegador_rotulo(text, text), interno.alumia_entrada_aviso(uuid, text, timestamptz),
      interno.alumia_entradas_vencidas(), interno.alumia_navegadores_faxina(),
      public.alumia_aparelho_entrou(uuid, uuid, text, text, text, text) from anon, authenticated;
    grant execute on function public.alumia_aparelho_entrou(uuid, uuid, text, text, text, text) to service_role;
  end if;
end $$;

select interno.alumia_trancar();
