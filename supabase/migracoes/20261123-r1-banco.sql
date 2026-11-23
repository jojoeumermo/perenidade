-- Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
--
-- ═══════════════════════ Alumia · Reforço 1 · Banco: a porta que nega, a caixa de críticas sem sal, números a partir de 3 (23/11/2026) ═══════════════════════
-- Migração acrescentável: pode rodar mais de uma vez. Roda depois de 20261122-alumia-beta-fim.sql (o fim do install.sql da versão 13).
-- Teste: scripts/testar-r1-banco.mjs (a migração duas vezes sobre o install.sql do ramo; com R1_SEM_MIGRACAO=1, mostra o que falhava).
--
-- 1. A porta nega em toda falha. Antes, quando o banco não conseguia ler auth.sessions (o projeto hospedado pode não deixar),
--    interno.alumia_sessao_viva caía para "o token está no prazo": a sessão encerrada pelo serviço de contas (sair, trocar a senha,
--    o pânico feito pelo servidor) continuava passando até o token vencer, e o token renovado depois de um corte passava também.
--    Agora, onde auth.sessions existe, a sessão do token só vale se o banco a LÊ e ela está lá: sem leitura ou com qualquer erro,
--    nega. (Sem a tabela, como no banco de teste, ou com um token sem "session_id", que só quem tem o segredo dos tokens emite,
--    continua valendo o token e a lista de cortes.)
--    O ramo de interno.alumia_passa que deixa passar o próprio banco (papel "none" e nenhum token: o SQL Editor, o pg_cron, os
--    gatilhos) passa a exigir também que a conexão NÃO seja a da API (authenticator, anon, authenticated, service_role): quem chega
--    pela API nunca cai nele, nem se um dia conseguir zerar o papel e o token da própria sessão.
--    interno.eu(), que toda função da equipe e da Alumia chama para saber quem é, confere a mesma sessão: o pânico e o "sair de
--    todos" valem também para o painel da equipe, não só para a Alumia ("entre_primeiro", a tela já manda entrar de novo).
--    No fim, o SQL avisa alto (WARNING) se o banco não lê ou não apaga as sessões do serviço de contas.
-- 2. O gancho da senha: a assinatura é a do contrato do Supabase (event jsonb → {decision, message, should_logout_user}) e
--    continua sem derrubar a entrada de todo mundo quando dá erro, mas agora conta a falha (interno.configuracoes, chave
--    'gancho_senha_falhas': quantas e o dia, nada da pessoa) e a Saúde mostra (public.alumia_painel_r1_banco).
-- 3. A caixa de críticas anônimas da equipe sem sal no banco. A cota de três por dia era contada por uma marca md5 com um sal
--    guardado em interno.configuracoes ('cuidado_sal'), na MESMA transação da crítica: quem lia o banco refazia a marca de cada
--    pessoa, achava a linha da cota e, pelo xmin, a crítica dela. Agora a crítica chega pelo servidor do site
--    (app/api/alumia/voto/marca, tipo "critica"), que confere a pessoa e conta a cota na memória dele, como nos votos; o banco
--    recebe só o texto e o destino, sem pessoa e sem marca (public.alumia_cuidado_critica), e confere que quem mandou é da equipe
--    por outra chamada, sem o texto (public.alumia_cuidado_pode_criticar). O sal, as cotas guardadas e as funções da marca saem.
-- 4. A rotina de limpeza das urnas: toda madrugada, com o pg_cron, VACUUM FULL nas tabelas de cédula (a urna regravada deixa
--    versões mortas das linhas no disco; o VACUUM FULL reescreve a tabela e as tira). O WAL e as cópias com recuperação a um ponto
--    no tempo continuam de fora do alcance do banco: pendência da hospedagem.
-- 5. Número de pessoas só a partir de 3, no banco e não só na tela: o total de "eu vou" que o organizador recebe (interno.rede_post_json,
--    interno.rede_post_v2, interno.rede_ato_json, public.rede_vou, public.rede_ato_vou), o total de membros de um espaço na lista de
--    quem é dele (public.rede_meus_espacos), o de membros de cada comunidade no painel de admin (public.alumia_painel_comunidades), o
--    de pessoas de cada núcleo fechado (public.rede_nucleos_fechados_listar) e o de quem modera cada comunidade
--    (public.rede_painel_semeadura) voltam nulos abaixo de 3. Por troca de texto na definição que está no banco (a função inteira fica como estava, só com a conta
--    embrulhada), e só quando o trecho ainda não foi embrulhado.
-- 6. A porta em tudo (interno.alumia_trancar).
--
-- Leis: LGPD art. 6º, III (necessidade: a cota da crítica não fica no banco, o contador do gancho não tem pessoa), art. 46
-- (segurança: a porta nega em toda falha; RLS sem política e acesso só por função). Endereço de rede: nada daqui lê ou guarda.
-- NÃO rodar em produção sem o Jonathan.

-- ── 1. A porta nega em toda falha ─────────────────────────────────────────────────────────────────────────────────────────

/**
 * A chamada vem do próprio banco (SQL Editor, pg_cron, gatilho, função do dono) e não da API? Papel "none" (ninguém fez SET ROLE),
 * nenhum token na sessão, e a conexão não é de um papel da API: pela API a conexão é sempre do authenticator.
 */
create or replace function interno.alumia_conexao_direta() returns boolean language sql stable security definer set search_path = interno, pg_temp as $$
  select coalesce(nullif(current_setting('role', true), ''), 'none') = 'none'
     and interno.claims() = '{}'::jsonb
     and session_user::text not in ('authenticator', 'anon', 'authenticated', 'service_role')
$$;
revoke all on function interno.alumia_conexao_direta() from public;
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'anon') then revoke all on function interno.alumia_conexao_direta() from anon, authenticated; end if;
end $$;

/** Pode passar pela porta? A sessão vale e: a entrada não é exigida, ou a sessão é aprovada, ou é o próprio banco (não a API). */
create or replace function interno.alumia_passa() returns boolean language sql stable security definer set search_path = interno, pg_temp as $$
  select interno.alumia_sessao_viva() and (
    not interno.alumia_exigida()
      or interno.alumia_sessao_ok()
      or interno.alumia_conexao_direta())
$$;

/**
 * A sessão desta chamada ainda vale? Verdadeiro para quem não traz conta (visitante, chave de serviço, o próprio banco). Falso
 * quando a sessão foi cortada por nós, quando o token venceu e, onde existe auth.sessions, quando o token não diz a sessão, quando
 * o serviço de contas não a tem mais ou quando o banco não consegue lê-la. Nunca "viva" por falta de permissão ou por erro.
 */
create or replace function interno.alumia_sessao_viva() returns boolean language plpgsql stable security definer set search_path = interno, pg_temp as $$
declare v_id uuid := interno.alumia_sessao_atual(); v_uid uuid := auth.uid(); v boolean;
begin
  if v_uid is null then return true; end if;
  if interno.alumia_sessao_cortada(v_uid, v_id, interno.alumia_token_emitido()) then return false; end if;
  if not interno.alumia_token_no_prazo() then return false; end if;
  -- Sem a tabela do serviço de contas (banco de teste, sem o Supabase) ou token sem "session_id" (só quem tem o segredo dos tokens
  -- emite um assim; o serviço de contas sempre põe a sessão): vale o token e a lista de cortes.
  if to_regclass('auth.sessions') is null or v_id is null then return true; end if;
  begin
    execute 'select exists (select 1 from auth.sessions s where s.id = $1 and s.user_id = $2)' into v using v_id, v_uid;
    return coalesce(v, false);
  exception when others then
    return false;
  end;
exception when others then
  return false;
end $$;

/** Quem chama (a conta do token). Sem conta ou com a sessão encerrada: "entre_primeiro"; conta suspensa: "conta_suspensa". */
create or replace function interno.eu() returns uuid language plpgsql stable security definer set search_path = interno, pg_temp as $$
declare v uuid := auth.uid();
begin
  if v is null then perform interno.erro('entre_primeiro'); end if;
  -- Só com o "iat" do token (o serviço de contas sempre põe): sem ele, não há como saber se veio antes de um corte.
  if interno.alumia_token_emitido() is not null and not interno.alumia_sessao_viva() then perform interno.erro('entre_primeiro'); end if;
  if exists (select 1 from perfis where id = v and suspenso) then perform interno.erro('conta_suspensa'); end if;
  return v;
end $$;

-- ── 2. O gancho da senha conta as falhas ──────────────────────────────────────────────────────────────────────────────────

/** Anota que o gancho da senha deu erro (só quantas vezes e o último dia; nada da pessoa). Nunca quebra. */
create or replace function interno.alumia_gancho_falhou() returns void language plpgsql security definer set search_path = interno, pg_temp as $$
begin
  insert into configuracoes (chave, valor) values ('gancho_senha_falhas', jsonb_build_object('n', 1, 'dia', current_date))
  on conflict (chave) do update set valor = jsonb_build_object('n', coalesce((configuracoes.valor ->> 'n')::bigint, 0) + 1, 'dia', current_date);
exception when others then
  null;
end $$;
revoke all on function interno.alumia_gancho_falhou() from public;
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'anon') then revoke all on function interno.alumia_gancho_falhou() from anon, authenticated; end if;
end $$;

/**
 * O gancho "password verification attempt" do serviço de contas (Authentication → Hooks), no contrato do Supabase: recebe
 * {user_id, valid} e devolve {decision: "continue" | "reject", message, should_logout_user}. Senha errada conta um erro; com a conta
 * fechada, recusa até a senha certa. Senha certa com a conta aberta limpa os erros. Só o papel do serviço de contas chama
 * (supabase_auth_admin). Erro aqui dentro não derruba a entrada de todo mundo: segue, e a falha fica contada para a Saúde.
 */
create or replace function public.alumia_porta_gancho_senha(event jsonb) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v_email text; v_conta text; v_valida boolean := coalesce((event ->> 'valid')::boolean, false); v_bloqueio jsonb;
begin
  select u.email into v_email from auth.users u where u.id = nullif(event ->> 'user_id', '')::uuid;
  if v_email is null then return jsonb_build_object('decision', 'continue'); end if;
  v_conta := interno.alumia_entrada_conta(v_email);
  if not v_valida then perform interno.alumia_entrada_errou(v_conta); end if;
  v_bloqueio := interno.alumia_entrada_bloqueio(v_conta);
  if (v_bloqueio ->> 'bloqueado')::boolean then
    return jsonb_build_object('decision', 'reject', 'should_logout_user', false,
      'message', 'Muitas tentativas erradas nesta conta. Tente de novo em ' || ceil((v_bloqueio ->> 'segundos')::numeric / 60) || ' minutos.');
  end if;
  if v_valida then delete from alumia_entrada_erros where conta = v_conta; end if;
  return jsonb_build_object('decision', 'continue');
exception when others then
  -- O gancho nunca derruba a entrada de todo mundo por um erro aqui dentro; a falha fica contada (a Saúde mostra).
  perform interno.alumia_gancho_falhou();
  return jsonb_build_object('decision', 'continue');
end $$;
do $$
begin
  revoke all on function public.alumia_porta_gancho_senha(jsonb) from public;
  if exists (select 1 from pg_roles where rolname = 'anon') then revoke all on function public.alumia_porta_gancho_senha(jsonb) from anon, authenticated; end if;
  if exists (select 1 from pg_roles where rolname = 'service_role') then revoke all on function public.alumia_porta_gancho_senha(jsonb) from service_role; end if;
  if exists (select 1 from pg_roles where rolname = 'supabase_auth_admin') then
    grant usage on schema public to supabase_auth_admin;
    grant execute on function public.alumia_porta_gancho_senha(jsonb) to supabase_auth_admin;
    execute format('grant execute on function public.alumia_porta_gancho_senha(jsonb) to %I',
                   (select r.rolname from pg_proc p join pg_roles r on r.oid = p.proowner where p.oid = 'public.alumia_porta_gancho_senha(jsonb)'::regprocedure));
  end if;
end $$;

/**
 * Para a Saúde do painel (quem administra o painel da Alumia, pela porta, como public.alumia_painel_servico_de_contas): o que este reforço do banco precisa que esteja certo no projeto. Lê as
 * sessões do serviço de contas (sem isso, ninguém passa pela porta), apaga as sessões (sem isso, quem apaga é o servidor), e
 * quantas vezes o gancho da senha falhou. Nenhuma pessoa, nenhum endereço.
 */
create or replace function public.alumia_painel_r1_banco() returns jsonb language plpgsql stable security definer set search_path = interno, pg_temp as $$
declare v_papel text := interno.alumia_painel_exige(); v_f jsonb := (select valor from configuracoes where chave = 'gancho_senha_falhas');
begin
  return jsonb_build_object(
    'sessoes_tabela', to_regclass('auth.sessions') is not null,
    'sessoes_legiveis', interno.alumia_sessoes_legiveis(),
    'sessoes_apagaveis', interno.alumia_sessoes_apagaveis(),
    'gancho_falhas', coalesce((v_f ->> 'n')::bigint, 0),
    'gancho_falhou_em', v_f ->> 'dia',
    'limpeza_das_urnas', exists (select 1 from pg_extension where extname = 'pg_cron')
      and coalesce((select true from pg_namespace where nspname = 'cron'), false)
      and interno.alumia_r1_cron_tem('alumia-urnas-limpeza'),
    -- A faxina das conversas encerradas com a moderação (20261123-r1-uso.sql): sem ela, a conversa não some em 90 dias.
    'faxina_da_moderacao', interno.alumia_r1_cron_tem('alumia-modmail-faxina'));
end $$;

/** O pg_cron tem esta rotina? (Sem pg_cron: falso.) */
create or replace function interno.alumia_r1_cron_tem(p_nome text) returns boolean language plpgsql stable security definer set search_path = interno, pg_temp as $$
declare v boolean := false;
begin
  if to_regclass('cron.job') is null then return false; end if;
  execute 'select exists (select 1 from cron.job where jobname = $1)' into v using p_nome;
  return coalesce(v, false);
exception when others then
  return false;
end $$;
revoke all on function interno.alumia_r1_cron_tem(text) from public;
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'anon') then revoke all on function interno.alumia_r1_cron_tem(text) from anon, authenticated; end if;
end $$;

-- ── 3. A caixa de críticas sem sal no banco ───────────────────────────────────────────────────────────────────────────────

/** A crítica chega só pelo servidor do site (public.alumia_cuidado_critica). Chamada direta: "pelo_servidor". */
create or replace function public.critica_enviar(p_texto text, p_para text default 'geral') returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
begin
  perform interno.eu();
  perform interno.erro('pelo_servidor');
  return null;
end $$;

/**
 * Para o servidor do site (só a chave de serviço): esta conta pode mandar crítica (é da equipe)? Chamada à parte, sem o texto: a
 * chamada que grava a crítica não leva a pessoa.
 */
create or replace function public.alumia_cuidado_pode_criticar(p_usuario uuid) returns boolean language plpgsql stable security definer set search_path = interno, pg_temp as $$
begin
  if not interno.servico() then perform interno.erro('sem_permissao'); end if;
  return p_usuario is not null and interno.voluntario_e(p_usuario)
     and not exists (select 1 from perfis where id = p_usuario and suspenso);
end $$;

/**
 * Para o servidor do site (só a chave de serviço): grava uma crítica anônima. Sem pessoa, sem marca, sem hora (só o dia). O
 * servidor já conferiu a pessoa (public.alumia_cuidado_pode_criticar) e contou a cota dela na memória dele.
 */
create or replace function public.alumia_cuidado_critica(p_texto text, p_para text default 'geral') returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v_texto text; v_para text := coalesce(nullif(btrim(p_para), ''), 'geral');
begin
  if not interno.servico() then perform interno.erro('sem_permissao'); end if;
  v_texto := interno.txt(p_texto, 'texto', 10, 2000);
  if v_para !~ '^[a-z_]{2,30}$' then perform interno.erro('invalido:para'); end if;
  insert into criticas (para, texto) values (v_para, v_texto);
  return jsonb_build_object('ok', true);
end $$;

do $$
declare f text;
begin
  foreach f in array array['public.alumia_cuidado_pode_criticar(uuid)', 'public.alumia_cuidado_critica(text, text)'] loop
    execute format('revoke all on function %s from public', f);
    if exists (select 1 from pg_roles where rolname = 'anon') then
      execute format('revoke all on function %s from anon, authenticated', f);
      execute format('grant execute on function %s to service_role', f);
    end if;
  end loop;
end $$;

-- O sal e o que dependia dele saem. As cotas guardadas (marca e dia) também: sem o sal, não servem para nada.
delete from interno.criticas_cotas;
delete from interno.configuracoes where chave = 'cuidado_sal';
drop function if exists interno.cuidado_marca(uuid, date);
drop function if exists interno.votacao_marca(uuid, uuid);

-- ── 4. A limpeza das urnas ────────────────────────────────────────────────────────────────────────────────────────────────
-- VACUUM não roda dentro de função; o pg_cron roda o comando direto. Só as tabelas que existem neste banco.
do $$
declare v_tabelas text;
begin
  select string_agg(format('interno.%I', t), ', ' order by t) into v_tabelas
  from unnest(array['rede_consulta_cedulas', 'rede_consulta_cifradas', 'alumia_decisao_cedulas', 'alumia_decisao_cifradas', 'votacao_votos',
                    'rede_votos', 'rede_story_votos', 'bem_estar_urna', 'alumia_redacao_leituras', 'alumia_redacao_correcoes']) t
  where to_regclass('interno.' || t) is not null;
  if v_tabelas is null then return; end if;
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule('alumia-urnas-limpeza', '37 4 * * *', 'vacuum (full, analyze) ' || v_tabelas);
  end if;
exception when others then
  raise warning 'alumia-urnas-limpeza: a rotina não foi agendada (%). A limpeza das urnas fica para o "vacuum full" à mão.', sqlerrm;
end $$;

-- ── 5. Número de pessoas só a partir de 3 ─────────────────────────────────────────────────────────────────────────────────

/** Um número de pessoas só a partir de 3 (abaixo, nulo: a tela escreve "menos de 3"). */
create or replace function interno.alumia_r1_n3(p_n bigint) returns integer language sql immutable set search_path = interno, pg_temp as $$
  select case when p_n >= 3 then p_n::integer end
$$;
revoke all on function interno.alumia_r1_n3(bigint) from public;
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'anon') then revoke all on function interno.alumia_r1_n3(bigint) from anon, authenticated; end if;
end $$;

do $$
declare r record; v_src text;
begin
  for r in
    select p.oid, x.antes, 'interno.alumia_r1_n3(' || x.antes || ')' as depois
    from (values
      ('interno.rede_post_json(interno.rede_posts, boolean)', '(select count(*) from rede_vou v where v.post = p.id)'),
      ('interno.rede_post_v2(interno.rede_posts, uuid, boolean)', '(select count(*)::integer from rede_vou v where v.post = p.id)'),
      ('interno.rede_ato_json(interno.rede_posts, interno.rede_chamados, uuid)', '(select count(*) from rede_vou v where v.post = p.id)'),
      ('public.rede_vou(uuid, boolean)', '(select count(*) from rede_vou where post = p_id)'),
      ('public.rede_ato_vou(uuid, boolean)', '(select count(*) from rede_vou where post = p_id)'),
      ('public.rede_meus_espacos()', '(select count(*) from rede_espaco_membros x where x.espaco = e.slug)'),
      ('public.alumia_painel_comunidades()', '(select count(*) from rede_comunidade_membros m where m.comunidade = c.slug and m.situacao = ''ativo'')'),
      -- Para a coordenação: quantas pessoas há em cada núcleo fechado e quantas moderam cada comunidade.
      ('public.rede_nucleos_fechados_listar()', '(select count(*) from rede_nucleo_membros m where m.nucleo = r.id)'),
      ('public.rede_painel_semeadura()', '(select count(*)::integer from rede_comunidade_membros m where m.comunidade = c.slug and m.papel = ''moderacao'' and m.situacao = ''ativo'')')
    ) x (assinatura, antes)
    join pg_proc p on p.oid = to_regprocedure(x.assinatura)
  loop
    -- Lido de novo a cada passo: a mesma função pode ter mudado no passo de antes.
    select prosrc into v_src from pg_proc where oid = r.oid;
    if position(r.antes in v_src) > 0 and position(r.depois in v_src) = 0 then
      execute replace(pg_get_functiondef(r.oid), v_src, replace(v_src, r.antes, r.depois));
    end if;
  end loop;
end $$;

-- ── 6. Permissões e a porta ───────────────────────────────────────────────────────────────────────────────────────────────

do $$
begin
  revoke all on function public.alumia_painel_r1_banco() from public;
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on function public.alumia_painel_r1_banco() from anon;
    grant execute on function public.alumia_painel_r1_banco() to authenticated;
  end if;
end $$;

-- Avisa alto, na hora de rodar, o que o projeto não deixa (o SQL Editor mostra os WARNING).
do $$
begin
  if to_regclass('auth.sessions') is not null and not interno.alumia_sessoes_legiveis() then
    raise warning 'r1-banco: o banco NÃO lê auth.sessions. Com a entrada ligada, ninguém com conta passa pela porta da Alumia nem pelo painel. Conferir a permissão (select em auth.sessions para o dono das funções) antes de publicar.';
  end if;
  if to_regclass('auth.sessions') is not null and not interno.alumia_sessoes_apagaveis() then
    raise warning 'r1-banco: o banco não apaga auth.sessions. O pânico e o "sair de todos" ficam valendo pela lista de cortes e pelo servidor do site (SUPABASE_SERVICE_ROLE_KEY obrigatória).';
  end if;
end $$;

do $$
declare v jsonb := interno.alumia_trancar();
begin
  if jsonb_array_length(coalesce(v -> 'abertas', '[]'::jsonb)) > 0 then
    raise warning 'alumia_trancar: função sem porta: %', v -> 'abertas';
  end if;
end $$;
select interno.alumia_trancar();
