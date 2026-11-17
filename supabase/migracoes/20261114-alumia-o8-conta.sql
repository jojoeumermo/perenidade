-- Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
--
-- ═══════════════════════════ Alumia · Onda 8 · Conta segura (14/11/2026) ═══════════════════════════
-- O que a pessoa controla na própria conta, dentro da Alumia (telas em components/rede/seguranca/):
--
--   1. Códigos de recuperação do segundo fator com resumo forte. Os dez códigos continuam os de Minha conta (public.conta_*: um
--      jogo só por conta, o mesmo no site e na Alumia), mas passam a ser guardados com bcrypt (pgcrypto, crypt + gen_salt('bf', 10)),
--      um sal por código. Os resumos antigos (SHA-256 sem sal, que uma cópia vazada quebraria em minutos) são embrulhados em
--      bcrypt aqui mesmo ("h" + bcrypt do SHA-256 antigo) e conferidos assim; nenhum SHA-256 cru fica valendo. Usar um código tira o
--      aplicativo autenticador da conta (obriga a cadastrar outro), DESCONECTA todos os outros aparelhos e manda aviso e e-mail.
--   2. Aviso de entrada nova: cada sessão nova da conta (auth.sessions) gera um aviso na conta e um e-mail com o navegador, o
--      sistema, o dia e a hora. Sem endereço de rede, sem cidade. Entradas do mesmo navegador em até 15 minutos (o login único
--      abre o site, a Alumia e a Escola em seguida) contam uma vez só.
--   3. Aparelhos conectados: as sessões abertas da própria conta (navegador, sistema, desde quando e o dia da última atividade;
--      nunca o endereço de rede que o serviço de contas guarda) e desconectar uma, ou todas as outras.
--   4. Sessão desconectada para na hora: a porta da Alumia (interno.alumia_passa) passa a recusar o token de uma sessão que não
--      existe mais. Antes, o token de acesso já emitido seguia valendo até vencer.
--   5. Botão de pânico: desconecta TODOS os aparelhos (este também) e, se a pessoa quiser, esconde o perfil (o mesmo efeito do
--      modo invisível: some da busca, das sugestões, das menções e da página de perfil) até ela mesma mostrar de novo. O aparelho
--      apaga o que guardou (lib/rede/saida.ts).
--   6. Fora da busca: a pessoa some da busca de pessoas, das sugestões de @ e dos pacotes de sugestão; só quem digita o @ inteiro
--      a encontra.
--   7. Endereço de rede que não volta: o resumo da origem (interno.origem, usado nos limites de quem não tem conta, nas tentativas
--      de entrada e no registro das armadilhas) passa a usar um sal que vale uma hora e é apagado quando a hora acaba; o segredo
--      fixo de antes sai do banco (sem ele, os resumos antigos não voltam ao endereço). perfis.origem deixa de ser gravada e é
--      zerada, e o bloqueio de origem dos banimentos antigos também (banir por rede é só pela impressão com prazo do painel).
--      O serviço de contas, no mesmo banco, deixa de guardar o endereço das sessões, dos desafios do segundo fator e do registro
--      de auditoria dele (gatilhos que zeram a coluna antes de gravar), e o que já estava gravado é zerado.
--
-- Leis (conferidas no texto):
--  - LGPD (Lei 13.709/2018) art. 6º, III (necessidade): o aviso e a lista de aparelhos leem só o navegador, o sistema e as datas;
--    o endereço de rede não é guardado nem pelo serviço de contas (item 7). Art. 46: RLS e acesso só por função.
--  - LGPD art. 18, II e IX: a pessoa vê as próprias sessões e encerra o tratamento (desconecta) quando quiser.
--
-- Idempotente (scripts/testar-alumia-o8-conta.mjs roda duas vezes no banco local). Roda DEPOIS das migrações da onda 7.
-- NÃO rodar em produção sem o Jonathan.

-- ── 1. Colunas ────────────────────────────────────────────────────────────────────────────────────────────────────────────

alter table interno.perfis add column if not exists rede_fora_da_busca boolean not null default false;
-- Quando o pânico escondeu o perfil (nulo: não escondeu). Só a própria pessoa lê, para a tela oferecer "mostrar de novo".
alter table interno.perfis add column if not exists rede_panico_em timestamptz;

-- Os códigos de recuperação passam a aceitar o resumo bcrypt ($2a$/$2b$, 60 letras) e o SHA-256 antigo embrulhado em bcrypt ("h" na
-- frente). Aqui o SHA-256 cru ainda passa, para os antigos serem embrulhados no item 4; lá a regra fica sem ele.
do $$
begin
  alter table interno.codigos_recuperacao drop constraint if exists codigos_recuperacao_hash_check;
  alter table interno.codigos_recuperacao drop constraint if exists codigos_recuperacao_hash_forma;
  alter table interno.codigos_recuperacao add constraint codigos_recuperacao_hash_forma
    check (hash ~ '^[a-f0-9]{64}$' or hash ~ '^h?\$2[aby]\$[0-9]{2}\$[./A-Za-z0-9]{53}$');
end $$;

-- ── 2. Peças internas ─────────────────────────────────────────────────────────────────────────────────────────────────────

/** O navegador e o sistema de um "user agent", em códigos curtos (a tela traduz). Nada além disso sai do texto. */
create or replace function interno.alumia_navegador(p_agente text) returns jsonb language sql immutable as $$
  select jsonb_build_object(
    'navegador', case when a ~ 'Firefox/' then 'firefox' when a ~ 'Edg/' then 'edge' when a ~ 'OPR/' then 'opera'
                      when a ~ 'Chrome/' then 'chrome' when a ~ 'Safari/' then 'safari' else 'outro' end,
    'sistema', case when a ~ 'Android' then 'android' when a ~ 'iPhone|iPad' then 'ios' when a ~ 'Windows' then 'windows'
                    when a ~ 'Mac OS X' then 'macos' when a ~ 'Linux' then 'linux' else 'outro' end)
  from (select coalesce(p_agente, '') as a) x
$$;

/** O mesmo, por extenso em português (para o aviso e o e-mail): "Firefox em Linux". */
create or replace function interno.alumia_navegador_texto(p_agente text) returns text language sql immutable as $$
  select (case n ->> 'navegador' when 'firefox' then 'Firefox' when 'edge' then 'Edge' when 'opera' then 'Opera' when 'chrome' then 'Chrome'
                                 when 'safari' then 'Safari' else 'Navegador desconhecido' end)
      || ' em ' ||
         (case n ->> 'sistema' when 'android' then 'Android' when 'ios' then 'iPhone ou iPad' when 'windows' then 'Windows' when 'macos' then 'macOS'
                               when 'linux' then 'Linux' else 'sistema desconhecido' end)
  from (select interno.alumia_navegador(p_agente) as n) x
$$;

/** A sessão desta chamada (o "session_id" do token), ou nulo. */
create or replace function interno.alumia_sessao_atual() returns uuid language plpgsql stable as $$
declare v text := interno.claims() ->> 'session_id';
begin
  if v is null or v !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then return null; end if;
  return v::uuid;
end $$;

/**
 * A sessão desta chamada ainda existe? Verdadeiro para quem não traz sessão (visitante, chave de serviço, o próprio banco) e onde
 * o serviço de contas não guarda sessões. Falso só quando o token diz uma sessão e ela foi encerrada (desconectada a distância,
 * pânico, código de recuperação, troca de senha pelo painel).
 */
create or replace function interno.alumia_sessao_viva() returns boolean language plpgsql stable security definer set search_path = interno, pg_temp as $$
declare v_id uuid := interno.alumia_sessao_atual(); v boolean;
begin
  if v_id is null or auth.uid() is null or to_regclass('auth.sessions') is null then return true; end if;
  execute 'select exists (select 1 from auth.sessions s where s.id = $1 and s.user_id = $2)' into v using v_id, auth.uid();
  return coalesce(v, true);
exception when undefined_column or undefined_table or insufficient_privilege then
  return true;
end $$;

/**
 * A porta da Alumia (a mesma de 20261112-alumia-portas.sql) com mais uma condição: a sessão do token ainda existe. Vale com a
 * trava ligada ou desligada: token de sessão encerrada não usa função nenhuma da rede.
 */
create or replace function interno.alumia_passa() returns boolean language sql stable security definer set search_path = interno, pg_temp as $$
  select interno.alumia_sessao_viva() and (
    not interno.alumia_exigida()
      or interno.alumia_sessao_ok()
      or (coalesce(nullif(current_setting('role', true), ''), 'none') = 'none' and interno.claims() = '{}'::jsonb))
$$;

/**
 * Encerra sessões de uma conta: todas, ou todas menos p_menos. Apaga os tokens de renovação delas (o aparelho não renova mais) e
 * as próprias sessões (o token de acesso para na porta, interno.alumia_sessao_viva). Devolve quantas saíram.
 */
create or replace function interno.alumia_encerrar_sessoes(p_usuario uuid, p_menos uuid default null, p_so uuid default null) returns integer
language plpgsql security definer set search_path = interno, pg_temp as $$
declare v_n integer := 0;
begin
  if p_usuario is null or to_regclass('auth.sessions') is null then return 0; end if;
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
  return v_n;
end $$;

-- ── 3. Aviso de entrada nova ──────────────────────────────────────────────────────────────────────────────────────────────

/**
 * Gatilho em auth.sessions: a conta de quem está na Alumia (consentimento dado) entrou num aparelho. A pessoa recebe um aviso na
 * conta e um e-mail com o navegador, o sistema, o dia e a hora (hora de Brasília). Lê só o "user agent" da linha nova; o endereço
 * de rede que o serviço de contas grava não é lido. Nada é guardado em tabela nossa.
 * Entrada do mesmo navegador nos últimos 15 minutos não avisa de novo (o login único abre o site, a Alumia e a Escola em seguida).
 * Erro aqui nunca impede a entrada.
 */
create or replace function interno.alumia_sessao_nova() returns trigger language plpgsql security definer set search_path = interno, pg_temp as $$
declare v_agente text; v_texto text; v_quando text; v_repetida boolean := false;
begin
  begin
    if not exists (select 1 from perfis f where f.id = new.user_id and f.rede_consentimento is not null and not f.suspenso) then return new; end if;
    v_agente := to_jsonb(new) ->> 'user_agent';
    execute 'select exists (select 1 from auth.sessions s where s.user_id = $1 and s.id <> $2 and s.created_at > now() - interval ''15 minutes''
               and interno.alumia_navegador(s.user_agent) = interno.alumia_navegador($3))' into v_repetida using new.user_id, new.id, v_agente;
    if v_repetida then return new; end if;
    v_texto := interno.alumia_navegador_texto(v_agente);
    v_quando := to_char(now() at time zone 'America/Sao_Paulo', 'DD/MM/YYYY "às" HH24:MI');
    perform interno.avisar_em(new.user_id, 'Entrada nova na sua conta: ' || v_texto || ', em ' || v_quando || ' (hora de Brasília). Se não foi você, '
      || 'abra Segurança na Alumia e desconecte todos os aparelhos.', 'conta');
    perform interno.email(interno.email_da_conta(new.user_id), 'alumia_entrada_nova', 'Entrada nova na sua conta',
      'A sua conta do Instituto Lúcia acabou de entrar num aparelho:' || E'\n\n' || v_texto || E'\n' || v_quando || ' (hora de Brasília)' || E'\n\n'
      || 'Se foi você, não precisa fazer nada.' || E'\n\n'
      || 'Se não foi você, troque a senha agora e, na Alumia, abra Segurança e desconecte todos os aparelhos.', '', 6);
  exception when others then null;
  end;
  return new;
end $$;

do $$
begin
  if to_regclass('auth.sessions') is not null then
    execute 'drop trigger if exists alumia_sessao_nova on auth.sessions';
    execute 'create trigger alumia_sessao_nova after insert on auth.sessions for each row execute function interno.alumia_sessao_nova()';
  end if;
exception when others then
  raise notice 'alumia_sessao_nova: o gatilho em auth.sessions não pôde ser criado (%). O aviso de entrada nova fica desligado.', sqlerrm;
end $$;

/**
 * O banco consegue ler as sessões do serviço de contas? Sem isso, "desconectar" e o pânico não param o token já emitido: a tela de
 * segurança avisa em vez de prometer (alumia_conta_situacao → sessoes).
 */
create or replace function interno.alumia_sessoes_legiveis() returns boolean language plpgsql stable security definer set search_path = interno, pg_temp as $$
begin
  if to_regclass('auth.sessions') is null then return false; end if;
  execute 'select 1 from auth.sessions limit 1';
  return true;
exception when others then
  return false;
end $$;

-- ── 3b. O serviço de contas sem endereço de rede ─────────────────────────────────────────────────────────────────────────────
-- O serviço de contas grava, no mesmo banco, o endereço de quem entrou (auth.sessions.ip), de quem confirmou o segundo fator
-- (auth.mfa_challenges.ip_address) e de cada ação no registro de auditoria dele (auth.audit_log_entries.ip_address). Um gatilho
-- antes de gravar troca o endereço por vazio (nulo, 0.0.0.0 ou '' conforme a coluna aceita); o que já estava gravado é zerado.
-- Se o projeto não deixar criar o gatilho, o aviso abaixo diz qual ficou de fora (conferir depois de rodar, com o Jonathan).

/** Gatilho: troca as colunas de tg_argv[0] (jsonb {coluna: valor vazio}) antes de gravar. Coluna que não existe é ignorada. */
create or replace function interno.alumia_sem_endereco() returns trigger language plpgsql security definer set search_path = interno, pg_temp as $$
begin
  new := jsonb_populate_record(new, tg_argv[0]::jsonb);
  return new;
end $$;

do $$
declare r record;
begin
  for r in select * from (values ('sessions', 'ip', '{"ip": null}', 'ip = null'),
                                 ('mfa_challenges', 'ip_address', '{"ip_address": "0.0.0.0"}', 'ip_address = ''0.0.0.0''::inet'),
                                 ('audit_log_entries', 'ip_address', '{"ip_address": ""}', 'ip_address = ''''')) as t (tabela, coluna, vazio, zerar) loop
    begin
      if to_regclass('auth.' || r.tabela) is null
         or not exists (select 1 from information_schema.columns c where c.table_schema = 'auth' and c.table_name = r.tabela and c.column_name = r.coluna) then
        continue;
      end if;
      execute format('drop trigger if exists alumia_sem_endereco on auth.%I', r.tabela);
      execute format('create trigger alumia_sem_endereco before insert or update on auth.%I for each row execute function interno.alumia_sem_endereco(%L)', r.tabela, r.vazio);
      execute format('update auth.%I set %s where %I is not null and %I::text not in (''0.0.0.0'', '''')', r.tabela, r.zerar, r.coluna, r.coluna);
    exception when others then
      raise warning 'alumia_sem_endereco: auth.% ficou com o endereço de rede (%). Conferir com o Jonathan.', r.tabela, sqlerrm;
    end;
  end loop;
end $$;

-- ── 4. Códigos de recuperação com bcrypt ──────────────────────────────────────────────────────────────────────────────────

/** O código como a pessoa digitou, sem traço, espaço nem minúscula (só os 10 algarismos hexadecimais contam). */
create or replace function interno.codigo_normal(p text) returns text language sql immutable as $$
  select upper(regexp_replace(coalesce(p, ''), '[^0-9A-Fa-f]', '', 'g'))
$$;

/** O esquema onde o pgcrypto está (no serviço real, "extensions"). Sem ele, erro: código de recuperação não fica sem resumo forte. */
create or replace function interno.cripto_esquema() returns text language plpgsql stable security definer set search_path = interno, pg_temp as $$
declare v text;
begin
  select n.nspname into v from pg_extension e join pg_namespace n on n.oid = e.extnamespace where e.extname = 'pgcrypto';
  if v is null then perform interno.erro('sem_pgcrypto'); end if;
  return v;
end $$;

/** O resumo bcrypt de um código (sal próprio, custo 10). */
create or replace function interno.codigo_bf(p text) returns text language plpgsql volatile security definer set search_path = interno, pg_temp as $$
declare v_esq text := interno.cripto_esquema(); v text;
begin
  execute format('select %I.crypt($1, %I.gen_salt(''bf'', 10))', v_esq, v_esq) into v using 'lucia:recuperacao:' || interno.codigo_normal(p);
  return v;
end $$;

/**
 * O código confere com o resumo guardado? bcrypt para os novos; para os antigos, embrulhados ("h" + bcrypt do SHA-256), o bcrypt do
 * SHA-256 do código (interno.codigo_hash). SHA-256 cru não confere com nada.
 */
create or replace function interno.codigo_confere(p text, p_hash text) returns boolean language plpgsql stable security definer set search_path = interno, pg_temp as $$
declare v_esq text; v boolean;
begin
  if coalesce(p_hash, '') !~ '^h?\$2[aby]\$' then return false; end if;
  v_esq := interno.cripto_esquema();
  if left(p_hash, 1) = 'h' then
    execute format('select %I.crypt($1, $2) = $2', v_esq) into v using interno.codigo_hash(p), substr(p_hash, 2);
  else
    execute format('select %I.crypt($1, $2) = $2', v_esq) into v using 'lucia:recuperacao:' || interno.codigo_normal(p), p_hash;
  end if;
  return coalesce(v, false);
end $$;

-- Os resumos antigos (SHA-256 sem sal de um código de 40 bits) viram "h" + bcrypt deles, com sal próprio. Depois disso, a regra da
-- coluna deixa de aceitar o SHA-256 cru. Rodar de novo não embrulha duas vezes (o embrulhado não tem mais a forma do antigo).
do $$
declare v_esq text := interno.cripto_esquema();
begin
  execute format('update interno.codigos_recuperacao set hash = ''h'' || %I.crypt(hash, %I.gen_salt(''bf'', 10)) where hash ~ ''^[a-f0-9]{64}$''', v_esq, v_esq);
  alter table interno.codigos_recuperacao drop constraint if exists codigos_recuperacao_hash_forma;
  alter table interno.codigos_recuperacao add constraint codigos_recuperacao_hash_forma check (hash ~ '^h?\$2[aby]\$[0-9]{2}\$[./A-Za-z0-9]{53}$');
end $$;

/** Gera dez códigos novos (os antigos deixam de valer). Só com o segundo fator confirmado nesta sessão. Guarda só o bcrypt. */
create or replace function public.conta_codigos_gerar() returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); v_codigos text[] := '{}'; v_c text;
begin
  perform interno.limite('codigos_gerar', 5, 60);
  if not interno.tem_fator() then perform interno.erro('sem_segundo_fator'); end if;
  if not interno.aal2() then perform interno.erro('confirme_segundo_fator'); end if;
  delete from codigos_recuperacao where usuario = v;
  for i in 1..10 loop
    -- gen_random_uuid usa o gerador seguro do Postgres; 10 algarismos hexadecimais por código, como sempre foi.
    v_c := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 5) || '-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 5));
    insert into codigos_recuperacao (usuario, hash) values (v, interno.codigo_bf(v_c));
    v_codigos := v_codigos || v_c;
  end loop;
  perform interno.registrar('codigos_recuperacao_gerados', v::text, '{}'::jsonb);
  return jsonb_build_object('codigos', to_jsonb(v_codigos));
end $$;

/**
 * Perdeu o celular do aplicativo autenticador: com a senha (sessão aal1) e um código de recuperação, o aplicativo é tirado da
 * conta e a pessoa cadastra outro antes de entrar de novo. Os outros aparelhos são desconectados (quem tinha a senha e uma sessão
 * aberta sai junto). Cinco tentativas por hora; a pessoa recebe aviso e e-mail, e a coordenação é avisada quando é da equipe.
 * Código errado não é erro (devolve ok: false): um erro desfaria também a contagem de tentativas, e o limite não valeria.
 */
create or replace function public.conta_codigo_usar(p_codigo text) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); v_nome text; v_hash text;
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
  update codigos_recuperacao set usado_em = now() where usuario = v and hash = v_hash;
  if to_regclass('auth.mfa_factors') is not null then execute 'delete from auth.mfa_factors where user_id = $1' using v; end if;
  perform interno.alumia_encerrar_sessoes(v, interno.alumia_sessao_atual());
  select nome into v_nome from perfis where id = v;
  perform interno.registrar('segundo_fator_recuperado', v::text, '{}'::jsonb);
  perform interno.avisar_em(v, 'Um código de recuperação foi usado: o aplicativo autenticador saiu da sua conta e os outros aparelhos foram desconectados. '
    || 'Cadastre outro aplicativo. Se não foi você, troque a senha agora e avise a coordenação.', 'conta');
  perform interno.email(interno.email_da_conta(v), 'codigo_recuperacao_usado', 'Código de recuperação usado na sua conta',
    'Um código de recuperação acabou de ser usado na sua conta do Instituto Lúcia. O aplicativo autenticador saiu da conta e os outros '
    || 'aparelhos foram desconectados.' || E'\n\n' || 'Se foi você, cadastre o aplicativo de novo ao entrar.' || E'\n\n'
    || 'Se não foi você, alguém tem a sua senha e um dos seus códigos: troque a senha agora e escreva para a coordenação.');
  if exists (select 1 from papeis where usuario = v) then
    perform interno.avisar_lideranca(coalesce(v_nome, 'Alguém da equipe') || ' usou um código de recuperação para tirar o aplicativo autenticador da conta.', v);
  end if;
  return jsonb_build_object('ok', true, 'restantes', (select count(*) from codigos_recuperacao where usuario = v and usado_em is null));
end $$;

-- ── 5. Funções da tela ────────────────────────────────────────────────────────────────────────────────────────────────────

/** Sessão que pode mexer na segurança: quem tem o aplicativo autenticador precisa ter passado pelo código nesta sessão. */
create or replace function interno.alumia_conta_confiavel() returns uuid language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu();
begin
  if interno.tem_fator() and not interno.aal2() then perform interno.erro('confirme_segundo_fator'); end if;
  return v;
end $$;

/** O que a tela de segurança mostra: segundo fator, códigos que restam, fora da busca e se o pânico escondeu o perfil. */
create or replace function public.alumia_conta_situacao() returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); f perfis;
begin
  select * into f from perfis where id = v;
  return jsonb_build_object(
    'segundo_fator', interno.tem_fator(),
    'confirmado', interno.aal2(),
    'codigos_restantes', (select count(*) from codigos_recuperacao where usuario = v and usado_em is null),
    'codigos_gerados_em', (select max(criado_em) from codigos_recuperacao where usuario = v),
    'fora_da_busca', coalesce(f.rede_fora_da_busca, false),
    'escondido_pelo_panico', f.rede_panico_em is not null and f.rede_invisivel,
    'panico_em', case when f.rede_invisivel then f.rede_panico_em end,
    'sessoes', interno.alumia_sessoes_legiveis());
end $$;

/**
 * Os aparelhos com sessão aberta nesta conta: o navegador, o sistema, o dia em que entrou, o dia da última atividade, se é este
 * aparelho e se passou pelo código. Nunca o endereço de rede (a linha do serviço de contas é lida inteira, mas só essas chaves
 * saem daqui) nem a hora exata.
 */
create or replace function public.alumia_conta_aparelhos() returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.alumia_conta_confiavel(); v_atual uuid := interno.alumia_sessao_atual(); v_lista jsonb := '[]'::jsonb;
begin
  if to_regclass('auth.sessions') is null then return jsonb_build_object('disponivel', false, 'aparelhos', '[]'::jsonb); end if;
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
  return jsonb_build_object('disponivel', true, 'aparelhos', v_lista);
end $$;

/**
 * Desconecta um aparelho (p_sessao) ou, sem p_sessao, todos menos este. Este aparelho não sai por aqui (para sair dele, "Sair";
 * para sair de tudo, o pânico).
 */
create or replace function public.alumia_conta_desconectar(p_sessao uuid default null) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.alumia_conta_confiavel(); v_atual uuid := interno.alumia_sessao_atual(); v_n integer;
begin
  perform interno.limite('alumia_desconectar', 30, 60);
  if p_sessao is not null and p_sessao = v_atual then perform interno.erro('invalido:este_aparelho'); end if;
  v_n := interno.alumia_encerrar_sessoes(v, v_atual, p_sessao);
  if p_sessao is not null and v_n = 0 then perform interno.erro('nao_encontrado'); end if;
  perform interno.registrar('saiu_dos_outros', v::text, jsonb_build_object('aparelhos', v_n));
  return jsonb_build_object('ok', true, 'desconectados', v_n);
end $$;

/**
 * O botão de pânico: desconecta TODOS os aparelhos da conta, este também. Com p_esconder, o perfil some (o mesmo efeito do modo
 * invisível) até a própria pessoa mostrar de novo. Não grava nada no registro de atividades: quem olha o registro não fica sabendo.
 * Não pede o código do aplicativo de novo: a pessoa pode estar com pressa, e nada aqui expõe ninguém.
 */
create or replace function public.alumia_conta_panico(p_esconder boolean default false) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); v_n integer;
begin
  perform interno.limite('alumia_panico', 10, 60);
  if coalesce(p_esconder, false) then
    update perfis set rede_invisivel = true, rede_panico_em = now() where id = v;
  end if;
  v_n := interno.alumia_encerrar_sessoes(v);
  return jsonb_build_object('ok', true, 'desconectados', v_n, 'escondido', coalesce(p_esconder, false));
end $$;

/**
 * Mostra de novo o perfil que o pânico escondeu (volta ao modo que a pessoa tinha escolhido no perfil). Com o apagamento da conta
 * marcado (20261114-alumia-o8-meusdados.sql), o perfil segue fora do ar até o prazo; o modo escolhido fica anotado no pedido, para
 * o "desistir" devolver o perfil como a pessoa quer agora.
 */
create or replace function public.alumia_conta_mostrar_perfil() returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.alumia_conta_confiavel(); v_apagando integer := 0;
begin
  if to_regclass('interno.alumia_apagamentos') is not null and exists (select 1 from perfis where id = v and rede_panico_em is not null) then
    execute 'update interno.alumia_apagamentos a set estava_invisivel = (f.rede_modo = ''invisivel'') from interno.perfis f where f.id = a.usuario and a.usuario = $1'
      using v;
    get diagnostics v_apagando = row_count;
  end if;
  update perfis set rede_invisivel = (rede_modo = 'invisivel') or v_apagando > 0, rede_panico_em = null where id = v and rede_panico_em is not null;
  return jsonb_build_object('ok', true, 'invisivel', (select rede_invisivel from perfis where id = v));
end $$;

/** Fora da busca (ou de volta): some da busca de pessoas, das sugestões de @ e dos pacotes; quem digita o @ inteiro ainda acha. */
create or replace function public.alumia_conta_fora_da_busca(p_fora boolean) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.alumia_conta_confiavel();
begin
  perform interno.limite('alumia_fora_da_busca', 20, 60);
  update perfis set rede_fora_da_busca = coalesce(p_fora, false) where id = v;
  return jsonb_build_object('ok', true, 'fora_da_busca', coalesce(p_fora, false));
end $$;

-- ── 6. A busca, as sugestões de @ e os pacotes respeitam "fora da busca" ────────────────────────────────────────────────────
-- As três funções abaixo são as de 2026-11-rede-descoberta.sql e 2026-11-rede-conversa.sql, iguais, com uma condição a mais.

/**
 * Esta pessoa pode aparecer para quem pergunta (p_quem)? Só perfil ABERTO (nem trancado nem invisível), com @nome e codinome
 * confirmados, dentro da Rede, sem bloqueio entre as duas, que aceitou aparecer (desligado por padrão) e não pediu para ficar
 * fora da busca.
 */
create or replace function interno.rede3_desc_elegivel(f interno.perfis, p_quem uuid) returns boolean language sql stable security definer set search_path = interno, pg_temp as $$
  select f.rede_modo = 'aberto' and not f.rede_invisivel and not f.suspenso and not f.rede_fora_da_busca
    and f.rede_handle is not null and f.rede_codinome is not null and f.rede_codinome_ok
    and interno.rede2_membro(f.id)
    and exists (select 1 from rede_desc_entrada e where e.usuario = f.id and e.aparece)
    and not interno.rede_bloqueado(p_quem, f.id)
$$;

/**
 * Sugestões de @ enquanto a pessoa digita. Só gente que está na Rede, tem @handle, não está invisível nem suspensa e não tem
 * bloqueio com quem pede. Quem está fora da busca só aparece com o @ inteiro digitado. Com p_post, só quem poderia ver o post
 * (mencionar quem não vê não adianta, e não deve revelar o post). Primeiro quem já está na conversa, depois quem a pessoa segue,
 * depois por ordem alfabética. No máximo 8.
 */
create or replace function public.rede_conv_sugerir(p_prefixo text, p_post uuid default null) returns jsonb language plpgsql volatile security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); v_pre text := lower(btrim(coalesce(p_prefixo, ''), ' @')); x rede_posts; v_raiz uuid; v_r jsonb;
begin
  if not interno.rede2_membro(v) then perform interno.erro('consentimento'); end if;
  if v_pre !~ '^[a-z0-9_]{0,20}$' then return '[]'::jsonb; end if;
  if p_post is not null then
    select * into x from rede_posts where id = p_post;
    if not found or not interno.rede_ve(x, v) then perform interno.erro('nao_encontrado'); end if;
    v_raiz := coalesce(x.root_id, x.id);
  elsif v_pre = '' then
    return '[]'::jsonb;
  else
    select * into x from rede_posts where false;
  end if;
  perform interno.rede2_limite('buscar');
  select coalesce(jsonb_agg(jsonb_build_object('handle', z.rede_handle, 'codinome', z.rede_codinome, 'equipe', z.equipe) order by z.ordem, z.rede_handle), '[]'::jsonb) into v_r
  from (
    select f.rede_handle, f.rede_codinome, interno.voluntario_e(f.id) as equipe,
      case when v_raiz is not null and exists (select 1 from rede_posts r where (r.id = v_raiz or r.root_id = v_raiz) and r.autor = f.id) then 0
           when exists (select 1 from rede_seguindo s where s.quem = v and s.segue = f.id and not s.pendente) then 1 else 2 end as ordem
    from perfis f
    where f.rede_handle is not null and f.id <> v
      and (v_pre = '' or f.rede_handle like v_pre || '%' or interno.normal(coalesce(f.rede_codinome, '')) like interno.normal(v_pre) || '%')
      and (not f.rede_fora_da_busca or f.rede_handle = v_pre)
      and not (f.rede_modo = 'invisivel' or f.rede_invisivel) and not f.suspenso
      and interno.rede2_membro(f.id) and not interno.rede_bloqueado(v, f.id)
      and (p_post is null or interno.rede_ve(x, f.id))
    order by 4, f.rede_handle limit 8) z;
  return v_r;
end $$;

/**
 * Busca em português: posts (relevância ou mais novos), pessoas e comunidades. O texto vira minúsculas sem acento dos dois
 * lados, e a configuração portuguesa tira o plural e a conjugação ("greves" acha "greve"). Aceita aspas, "or" e "-" (websearch).
 * Posts: só o que a matriz deixa esta pessoa ver; silenciados ficam de fora; no máximo 100. Pessoas: só dentro da Rede, perfil
 * invisível NUNCA aparece (nem pelo @nome), quem pediu para ficar fora da busca só aparece pelo @nome inteiro, bloqueio some dos
 * dois lados. Comunidades: fechada só para quem é dela; as de luta e do Instituto só para quem tem conta. Pessoas e comunidades
 * vêm só na primeira página.
 */
create or replace function public.rede_desc_buscar(p_q text, p_ordem text default 'relevancia', p_cursor text default null, p_limite integer default 20) returns jsonb
language plpgsql volatile security definer set search_path = interno, pg_temp as $$
declare
  v uuid := auth.uid();
  v_q text := btrim(regexp_replace(left(coalesce(p_q, ''), 200), '\s+', ' ', 'g'));
  v_sa text; v_tsq tsquery; v_pag jsonb; v_pessoas jsonb := '[]'::jsonb; v_comunidades jsonb := '[]'::jsonb;
  v_h text; v_like text;
begin
  perform interno.aberta('comunidade');
  if v is not null and exists (select 1 from perfis where id = v and suspenso) then perform interno.erro('conta_suspensa'); end if;
  perform interno.rede2_limite('buscar');
  if p_ordem is not null and p_ordem not in ('relevancia', 'novos') then perform interno.erro('invalido:ordem'); end if;
  if char_length(v_q) < 2 then
    return jsonb_build_object('q', v_q, 'curta', true, 'itens', '[]'::jsonb, 'proximo', null, 'ordem', coalesce(p_ordem, 'relevancia'), 'pessoas', '[]'::jsonb, 'comunidades', '[]'::jsonb);
  end if;
  v_sa := interno.rede3_desc_sa(v_q);
  v_tsq := websearch_to_tsquery('portuguese', v_sa);
  if numnode(v_tsq) = 0 then
    return jsonb_build_object('q', v_q, 'so_comuns', true, 'itens', '[]'::jsonb, 'proximo', null, 'ordem', coalesce(p_ordem, 'relevancia'), 'pessoas', '[]'::jsonb, 'comunidades', '[]'::jsonb);
  end if;
  v_pag := interno.rede3_desc_pagina('busca', coalesce(p_ordem, 'relevancia'), p_cursor, p_limite, '{}'::jsonb, v, v_tsq);

  if nullif(p_cursor, '') is null then
    v_like := '%' || replace(replace(replace(regexp_replace(v_sa, '^[@#]', ''), '\', '\\'), '%', '\%'), '_', '\_') || '%';
    v_h := replace(replace(replace(regexp_replace(v_sa, '^@', ''), '\', '\\'), '%', '\%'), '_', '\_') || '%';
    if v is not null then
      select coalesce(jsonb_agg(jsonb_build_object('codinome', z.rede_codinome, 'handle', z.rede_handle, 'equipe', interno.voluntario_e(z.id)) order by z.ex desc, z.rede_codinome), '[]'::jsonb) into v_pessoas
      from (select f.id, f.rede_codinome, f.rede_handle, (f.rede_handle = regexp_replace(v_sa, '^@', '')) as ex
            from perfis f
            where f.rede_handle is not null and f.rede_codinome is not null and f.rede_codinome_ok
              and f.rede_modo <> 'invisivel' and not f.rede_invisivel and not f.suspenso and interno.rede2_membro(f.id)
              and not interno.rede_bloqueado(v, f.id)
              and (f.rede_handle like v_h or interno.rede3_desc_sa(f.rede_codinome) like v_like)
              and (not f.rede_fora_da_busca or f.rede_handle = regexp_replace(v_sa, '^@', ''))
            order by (f.rede_handle = regexp_replace(v_sa, '^@', '')) desc, f.rede_codinome limit 8) z;
    end if;
    select coalesce(jsonb_agg(jsonb_build_object('slug', k.slug, 'nome', k.nome, 'categoria', k.categoria, 'tipo', k.tipo) order by k.nome), '[]'::jsonb) into v_comunidades
    from (select c.* from rede_comunidades c
          where (c.categoria = 'disciplinas' or v is not null)
            and (c.tipo <> 'fechada' or interno.rede2_na_comunidade(c.slug, v))
            and (interno.rede3_desc_sa(c.nome) like v_like or c.slug like v_like or interno.rede3_desc_sa(c.descricao) like v_like)
          order by c.nome limit 8) k;
  end if;
  return v_pag || jsonb_build_object('q', v_q, 'pessoas', v_pessoas, 'comunidades', v_comunidades);
end $$;

-- ── 6b. O resumo da origem com sal de uma hora ──────────────────────────────────────────────────────────────────────────────
-- Antes: SHA-256 de um segredo fixo guardado no próprio banco com o endereço. Quem lê o banco lê o segredo e desfaz o resumo
-- testando os 4 bilhões de IPv4. Agora o sal vale uma hora (o balde do limite de quem não tem conta, das tentativas de entrada e do
-- registro das armadilhas) e sai quando a hora acaba (na primeira chamada da hora seguinte e no agendador, de hora em hora): depois
-- disso, nem quem tem o banco inteiro liga o resumo a um endereço. Fica de fora da cópia semanal, como o segredo antigo.

create table if not exists interno.origem_sal (
  hora timestamptz primary key,
  sal text not null check (char_length(sal) >= 64)
);
alter table interno.origem_sal enable row level security;
revoke all on interno.origem_sal from public;
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'anon') then revoke all on interno.origem_sal from anon, authenticated; end if;
end $$;

/**
 * O endereço que a borda da rede informa, virado resumo com o sal desta hora. Numa transação só de leitura (onde o sal da hora não
 * pode nascer), o sal é sorteado ali e jogado fora: o resumo não casa com nada e não volta ao endereço.
 */
create or replace function interno.origem() returns text language plpgsql volatile security definer set search_path = interno, pg_temp as $$
declare
  v_hora timestamptz := date_trunc('hour', now());
  v_sal text;
  v_rede text := coalesce(
    nullif(nullif(current_setting('request.headers', true), '')::json ->> 'cf-connecting-ip', ''),
    split_part(nullif(current_setting('request.headers', true), '')::json ->> 'x-forwarded-for', ',', 1),
    'local');
begin
  select sal into v_sal from origem_sal where hora = v_hora;
  if v_sal is null then
    begin
      delete from origem_sal where hora < v_hora;
      insert into origem_sal (hora, sal) values (v_hora, replace(gen_random_uuid()::text || gen_random_uuid()::text || gen_random_uuid()::text, '-', ''))
      on conflict (hora) do nothing;
      select sal into v_sal from origem_sal where hora = v_hora;
    exception when read_only_sql_transaction then
      v_sal := replace(gen_random_uuid()::text || gen_random_uuid()::text || gen_random_uuid()::text, '-', '');
    end;
  end if;
  return encode(sha256(convert_to(v_sal || ':' || v_rede, 'UTF8')), 'hex');
end $$;
revoke all on function interno.origem() from public;
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'anon') then revoke all on function interno.origem() from anon, authenticated; end if;
end $$;

/** O sal das horas que já acabaram sai (o agendador chama de hora em hora; a primeira chamada da hora também apaga). */
create or replace function interno.origem_sal_faxina() returns integer language plpgsql security definer set search_path = interno, pg_temp as $$
declare v integer;
begin
  delete from origem_sal where hora < date_trunc('hour', now());
  get diagnostics v = row_count;
  return v;
end $$;
revoke all on function interno.origem_sal_faxina() from public;
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule('alumia-origem-sal', '0 * * * *', 'select interno.origem_sal_faxina()');
  end if;
exception when others then null;
end $$;

/**
 * Perfil e papéis de quem está logado; cria o perfil na primeira visita (a mesma do install.sql). A diferença: não grava mais a
 * origem da rede no perfil (perfis.origem), só a hora da última visita.
 */
create or replace function public.eu() returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare
  v uuid := auth.uid();
  v_nome text;
begin
  if v is null then return null; end if;
  if not exists (select 1 from perfis where id = v) then
    if not exists (select 1 from auth.users u where u.id = v) then return null; end if;
    -- O nome público nasce como o apelido escolhido no cadastro ou um codinome sorteado: nada do e-mail nem da conta de
    -- origem aparece no site. A pessoa troca quando quiser, no painel.
    v_nome := interno.codinome((select u.raw_user_meta_data ->> 'apelido' from auth.users u where u.id = v));
    insert into perfis (id, nome) values (v, v_nome) on conflict do nothing;
  end if;
  update perfis set visto_em = now(), origem = null where id = v and (visto_em < now() - interval '1 hour' or origem is not null);
  perform interno.sucessao_conferir();
  return (
    select jsonb_build_object(
      'id', f.id, 'nome', f.nome, 'bio', f.bio, 'suspenso', f.suspenso,
      'papeis', coalesce((select jsonb_agg(jsonb_build_object('id', p.id, 'papel', p.papel, 'disciplina', p.disciplina) order by p.papel, p.disciplina)
                          from papeis p where p.usuario = f.id), '[]'::jsonb),
      'nivel', interno.nivel_de(f.id),
      'chat_visto', f.chat_visto, 'chat_leitura', f.chat_leitura,
      'avatar', f.avatar, 'curriculo', coalesce(f.curriculo, '{}'::jsonb), 'termo_voluntario', f.termo_voluntario_em is not null and f.termo_voluntario_versao = interno.termo_voluntario_vigente(), 'aprendizado', f.aprendizado_em is not null,
      'segundo_fator', interno.aal2(),
      'exige_segundo_fator', interno.tem_fator() or (interno.exige_2fa() and exists (select 1 from papeis p where p.usuario = f.id and p.papel in ('coordenacao', 'vice', 'supervisao', 'curadoria', 'mediacao'))),
      'trocar_senha', f.trocar_senha,
      'avisos', (select count(*) from avisos a where a.para = f.id and not a.lido),
      -- Pode mandar avisos à equipe (coordenação, vice-coordenação, supervisão) e usar o estúdio de design.
      'supervisao', interno.supervisiona(),
      'desenha', interno.desenha(),
      -- Disciplinas em que a pessoa foi convidada a ajudar (lib/backend.ts › escreveEm).
      'convites', coalesce((select jsonb_agg(jsonb_build_object('disciplina', c.disciplina, 'trilha', c.trilha)) from disciplina_convites c where c.convidado = f.id and c.revogado_em is null), '[]'::jsonb),
      'foto_pendente', f.foto_pendente <> '')
    from perfis f where f.id = v);
end $$;

-- O segredo fixo sai (sem ele, os resumos que já estão gravados não voltam ao endereço), e a origem guardada no perfil e no
-- bloqueio de rede dos banimentos também: banir por rede é só pela impressão com prazo do painel (alumia_impressao_banimentos).
do $$ begin
  if to_regclass('interno.origem_segredo') is not null then execute 'delete from interno.origem_segredo'; end if;
end $$;
update interno.perfis set origem = null where origem is not null;
update interno.banimentos set origem = null where origem is not null;

-- ── 7. Permissões ─────────────────────────────────────────────────────────────────────────────────────────────────────────

revoke all on function interno.alumia_navegador(text), interno.alumia_navegador_texto(text), interno.alumia_sessao_atual(), interno.alumia_sessao_viva(),
  interno.alumia_encerrar_sessoes(uuid, uuid, uuid), interno.alumia_sessao_nova(), interno.codigo_normal(text), interno.cripto_esquema(),
  interno.codigo_bf(text), interno.codigo_confere(text, text), interno.alumia_conta_confiavel() from public, anon, authenticated;
revoke all on function interno.alumia_passa() from public, anon, authenticated;
do $$
declare f text;
begin
  foreach f in array array['alumia_conta_situacao()', 'alumia_conta_aparelhos()', 'alumia_conta_desconectar(uuid)', 'alumia_conta_panico(boolean)',
                           'alumia_conta_mostrar_perfil()', 'alumia_conta_fora_da_busca(boolean)'] loop
    execute format('revoke all on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated, service_role', f);
  end loop;
  foreach f in array array['conta_codigos_gerar()', 'conta_codigo_usar(text)'] loop
    execute format('revoke all on function public.%s from public', f);
    execute format('grant execute on function public.%s to anon, authenticated, service_role', f);
  end loop;
end $$;
revoke all on function public.rede_conv_sugerir(text, uuid) from public, anon;
grant execute on function public.rede_conv_sugerir(text, uuid) to authenticated, service_role;
revoke all on function interno.rede3_desc_elegivel(interno.perfis, uuid) from public, anon, authenticated;
revoke all on function public.rede_desc_buscar(text, text, text, integer) from public;
grant execute on function public.rede_desc_buscar(text, text, text, integer) to anon, authenticated, service_role;

-- A porta em toda função nova da rede (alumia_conta_* e as três refeitas).
select interno.alumia_trancar();
