-- ───────────────────────────── Prompt 5, D1: modo só leitura de emergência, o alto da Alumia e os educadores da Escola ─────────────
-- Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
--
-- Roda depois de 20261125-r3-fim.sql (banco na versão 16) e das migrações do Prompt 5 que vêm antes no install.sql; o
-- 20261126-p5-fim.sql vem por último. Pode rodar mais de uma vez, sem apagar nada.
-- Teste: npm run testar:p5-emergencia.
--
-- 1. Modo só leitura de emergência. A coordenação, com o segundo fator, põe a rede em "só leitura" com um clique e tira com o
--    motivo. Com o modo ligado, nenhuma conta grava nas tabelas da rede (interno.rede_* e interno.alumia_*): post, comentário,
--    reação, story, comunidade, ato, enquete, perfil da rede, convite... A trava fica num lugar só: um gatilho igual em cada tabela
--    da rede, posto por interno.alumia_so_leitura_armar(), que interno.alumia_trancar() passa a chamar no fim. Toda migração já
--    termina com o trancar: tabela nova da rede nasce com a trava na próxima migração, sem ninguém lembrar.
--    O que continua valendo com o modo ligado, de propósito (interno.alumia_so_leitura_fora):
--      - ler tudo (a trava só olha gravação; nenhuma função de leitura grava numa tabela da rede: o teste confere);
--      - apagar o que é seu (a trava não olha DELETE) e a faxina das rotinas;
--      - se proteger: bloquear, silenciar, restringir, denunciar, as preferências de aviso, sair de todos os aparelhos;
--      - as conversas e as chaves (rede_olm_*, rede_mls_*, rede_grupo_*, rede_dm_*, rede_sel_*, rede_kt, rede_identidades,
--        os cofres e o push): a cifra e o ritmo da R3 não mudam (Prompt 5, regra 0.4), e a conversa a dois é o canal de cuidado;
--      - o Fediverso e as pontes (o servidor do site grava com o próprio segredo; o Fediverso tem o interruptor dele no painel);
--      - a entrada (aceitar os termos, as regras, o consentimento, o navegador conhecido) e o que é só da equipe (o painel, as
--        sanções, a moderação), porque a equipe passa (abaixo);
--      - avisar a equipe de um problema (20261126-p5-beta.sql): relatar um problema (alumia_relatos, 5 por hora) e os erros da
--        tela (alumia_erros_tela, somados por dia, sem conta), que numa emergência são justamente o que a equipe precisa ver.
--    Quem passa com o modo ligado: a chave de serviço, o próprio banco (rotinas) e, com o segundo fator nesta sessão, a
--    coordenação, a mediação e o admin da Alumia, para moderar e para desligar o modo. O que NÃO é tabela da rede (o perfil do
--    site, os avisos, a auditoria) não tem a trava: é dividido com o site do instituto e o painel.
--    A tela mostra a faixa "só leitura" no alto da Alumia (public.alumia_topo) e o erro "alumia_so_leitura" vira frase.
-- 2. O alto da Alumia: public.alumia_topo() devolve, numa chamada só, os avisos fixados em vigor (os mesmos de
--    public.alumia_avisos_fixados: texto, link de dentro e desde quando; nunca quem fixou) e se o modo só leitura está ligado.
--    Nada registra quem viu: é uma leitura "stable", sem gravação.
-- 3. Os educadores da Escola. A coordenação escolhe quem são (interno.escola_educadores). Só eles (e a coordenação e a vice)
--    marcam aula ao vivo da Escola e dão aula junto. Enquanto a lista estiver vazia vale a regra de antes (quem é militante),
--    para nenhuma aula parar no dia em que isto entrar. Dar e tirar ficam no registro do painel (com o codinome).
--
-- Funções redefinidas (o corpo inteiro, tirado do banco montado com o install.sql deste ramo):
--   interno.alumia_trancar()             → o mesmo corpo, e no fim arma a trava do modo só leitura nas tabelas novas;
--   interno.escola_pode_conduzir(uuid)  → passa a ser "educador da Escola" (interno.escola_educador_e).
-- Não mexe em public.rede_alumia_versao nem em interno.alumia_porta_aberta.
-- Endereço de rede: nada daqui lê ou guarda. Nenhuma lista de quem viu, nenhum número de pessoas.

-- ── 1. O modo só leitura ─────────────────────────────────────────────────────────────────────────────────────────────────────

insert into interno.configuracoes (chave, valor) values ('alumia_so_leitura', '{"ligado": false}'::jsonb)
on conflict (chave) do nothing;

/** O modo só leitura está ligado? */
create or replace function interno.alumia_so_leitura() returns boolean language sql stable security definer set search_path = interno, pg_temp as $$
  select coalesce((select (valor ->> 'ligado')::boolean from configuracoes where chave = 'alumia_so_leitura'), false)
$$;

/**
 * Quem grava mesmo com o modo ligado: quem não chega pela API como conta (a chave de serviço, o próprio banco e as rotinas) e,
 * com o segundo fator nesta sessão, a coordenação, a mediação e o admin da Alumia (conta não suspensa).
 */
create or replace function interno.alumia_so_leitura_passa() returns boolean language sql stable security definer set search_path = interno, pg_temp as $$
  select coalesce(interno.claims() ->> 'role', '') not in ('anon', 'authenticated')
      or (auth.uid() is not null and interno.aal2()
          and not exists (select 1 from perfis f where f.id = auth.uid() and f.suspenso)
          and (exists (select 1 from papeis p where p.usuario = auth.uid() and p.papel in ('coordenacao', 'mediacao'))
               or exists (select 1 from alumia_painel_admin a where a.usuario = auth.uid())))
$$;

/** As tabelas da rede que ficam SEM a trava, de propósito (o porquê está no cabeçalho deste arquivo). */
create or replace function interno.alumia_so_leitura_fora(p_tabela text) returns boolean language sql immutable as $$
  select p_tabela in (
           -- se proteger
           'rede_bloqueios', 'rede_bloqueio_lista', 'rede_silenciados', 'rede_denuncias', 'rede_questoes_denuncias',
           'alumia_redacao_denuncias', 'rede_avisos_prefs', 'rede_avisos_silencio', 'rede_o9_prefs', 'rede_o9_restritos',
           'rede_vida_conta', 'alumia_apagamentos', 'alumia_apagamento_escondidos', 'alumia_sessoes_cortadas', 'rede_rascunhos',
           -- conversas, chaves e aparelhos (a cifra e o ritmo não mudam)
           'rede_identidades', 'rede_kt', 'rede_cofres_da_conta', 'rede_alumia_caixas', 'rede_push_assinaturas', 'rede_contagem_saidas',
           -- a entrada
           'alumia_entrada_vista', 'alumia_regras_lidas', 'alumia_termos_aceites', 'alumia_entradas_pendentes', 'alumia_entrada_erros',
           'alumia_navegadores', 'rede_consentimentos', 'rede_migracao',
           -- a equipe e as rotinas (a equipe passa de todo jeito; aqui o que o sistema grava por conta da ação de quem se protege)
           'rede_moderacao', 'alumia_sancoes', 'alumia_impressoes', 'alumia_lei_retencoes', 'alumia_operacao', 'alumia_arquivos_a_apagar',
           -- avisar a equipe de um problema (relatos com teto por hora; erros da tela sem conta, somados por dia)
           'alumia_relatos', 'alumia_erros_tela')
      or p_tabela like 'rede\_olm\_%' or p_tabela like 'rede\_mls\_%' or p_tabela like 'rede\_grupo\_%' or p_tabela like 'rede\_dm\_%'
      or p_tabela like 'rede\_sel\_%' or p_tabela like 'rede\_fed\_%' or p_tabela like 'rede\_pontes\_%'
      or p_tabela like 'alumia\_admin\_%' or p_tabela like 'alumia\_painel\_%' or p_tabela like 'alumia\_cadastro\_%'
      or p_tabela like 'alumia\_impressao\_%' or p_tabela like 'alumia\_transp\_%'
$$;

/** O gatilho da trava: com o modo ligado, quem não passa não insere nem altera linha da tabela. */
create or replace function interno.alumia_so_leitura_barra() returns trigger language plpgsql security definer set search_path = interno, pg_temp as $$
begin
  if interno.alumia_so_leitura() and not interno.alumia_so_leitura_passa() then perform interno.erro('alumia_so_leitura'); end if;
  return new;
end $$;

/**
 * Põe a trava em toda tabela da rede (interno.rede_*, interno.alumia_*) que ainda não tem, menos as de fora; e tira de quem
 * passou a ficar de fora. Devolve quantas tabelas estão com a trava. Partição herda o gatilho da tabela mãe.
 */
create or replace function interno.alumia_so_leitura_armar() returns integer language plpgsql security definer set search_path = interno, pg_temp as $$
declare r record; v_n integer := 0;
begin
  for r in
    select c.relname, c.oid, interno.alumia_so_leitura_fora(c.relname) as fora,
           exists (select 1 from pg_trigger t where t.tgrelid = c.oid and t.tgname = 'alumia_so_leitura' and not t.tgisinternal) as tem
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'interno' and c.relkind in ('r', 'p') and not c.relispartition
      and (c.relname like 'rede\_%' or c.relname like 'alumia\_%')
    order by c.relname
  loop
    if r.fora and r.tem then
      execute format('drop trigger alumia_so_leitura on interno.%I', r.relname);
    elsif not r.fora then
      if not r.tem then
        execute format('create trigger alumia_so_leitura before insert or update on interno.%I for each row execute function interno.alumia_so_leitura_barra()', r.relname);
      end if;
      v_n := v_n + 1;
    end if;
  end loop;
  return v_n;
end $$;

do $$
declare f text;
begin
  foreach f in array array['interno.alumia_so_leitura()', 'interno.alumia_so_leitura_passa()', 'interno.alumia_so_leitura_fora(text)',
                           'interno.alumia_so_leitura_barra()', 'interno.alumia_so_leitura_armar()'] loop
    execute format('revoke all on function %s from public', f);
    if exists (select 1 from pg_roles where rolname = 'anon') then execute format('revoke all on function %s from anon, authenticated', f); end if;
  end loop;
end $$;

/**
 * Ligar ou desligar o modo só leitura (coordenação com o segundo fator). Ligar é um clique (hora de emergência: sem motivo,
 * fica o motivo padrão); desligar pede o motivo. Vai para o registro do painel.
 */
create or replace function public.alumia_modo_so_leitura(p_ligar boolean, p_motivo text) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.alumia_admin_exige(); v_ligar boolean := coalesce(p_ligar, true); v_motivo text;
begin
  perform interno.limite('alumia_admin_porta', 30, 60);
  v_motivo := case when v_ligar and btrim(coalesce(p_motivo, '')) = '' then 'Modo só leitura ligado pelo painel, com um clique.' else interno.alumia_painel_motivo(p_motivo) end;
  if v_ligar = interno.alumia_so_leitura() then perform interno.erro('nada_a_fazer'); end if;
  insert into configuracoes (chave, valor) values ('alumia_so_leitura', jsonb_build_object('ligado', v_ligar, 'desde', now()))
  on conflict (chave) do update set valor = jsonb_build_object('ligado', v_ligar, 'desde', now());
  perform interno.registrar(case when v_ligar then 'alumia_so_leitura_ligado' else 'alumia_so_leitura_desligado' end, 'alumia_so_leitura', '{}'::jsonb);
  perform interno.alumia_painel_registrar(case when v_ligar then 'so_leitura_ligado' else 'so_leitura_desligado' end, 'rede', 'alumia_so_leitura', 'Modo só leitura', v_motivo);
  return jsonb_build_object('ok', true, 'ligado', v_ligar);
end $$;

-- ── 2. O alto da Alumia ──────────────────────────────────────────────────────────────────────────────────────────────────────

/** O que a Alumia mostra no alto de toda página: os avisos fixados em vigor e o modo só leitura. Nunca quem fixou nem quem viu. */
create or replace function public.alumia_topo() returns jsonb language sql stable security definer set search_path = interno, pg_temp as $$
  select jsonb_build_object(
    'avisos', coalesce((select jsonb_agg(jsonb_build_object('id', a.id, 'texto', a.texto, 'link', a.link, 'desde', a.criado_em) order by a.criado_em desc)
      from alumia_avisos_fixados a where a.retirado_em is null and a.ate > now()), '[]'::jsonb),
    'so_leitura', jsonb_build_object('ligado', interno.alumia_so_leitura(),
      'desde', case when interno.alumia_so_leitura() then (select valor ->> 'desde' from configuracoes where chave = 'alumia_so_leitura') end))
$$;

-- ── 3. Os educadores da Escola ──────────────────────────────────────────────────────────────────────────────────────────────

-- Quem a coordenação escolheu como educador da Escola: a conta, quem deu o lugar e desde quando. Nada mais.
create table if not exists interno.escola_educadores (
  usuario uuid primary key references interno.perfis (id) on delete cascade,
  por uuid references interno.perfis (id) on delete set null,
  desde timestamptz not null default now()
);
alter table interno.escola_educadores enable row level security;
revoke all on table interno.escola_educadores from public;
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'anon') then revoke all on table interno.escola_educadores from anon, authenticated; end if;
end $$;
comment on table interno.escola_educadores is 'Quem a coordenação escolheu como educador da Escola (marca e dá aula ao vivo da Escola). Só a conta, quem deu e desde quando.';

/**
 * É educador da Escola? A coordenação e a vice sempre; depois, quem está na lista. Lista vazia: vale a regra de antes (militante
 * da Frente), para nenhuma aula parar até a coordenação escolher.
 */
create or replace function interno.escola_educador_e(p uuid) returns boolean language sql stable security definer set search_path = interno, pg_temp as $$
  select p is not null
     and not exists (select 1 from perfis f where f.id = p and f.suspenso)
     and (exists (select 1 from papeis x where x.usuario = p and x.papel in ('coordenacao', 'vice'))
          or exists (select 1 from escola_educadores e where e.usuario = p)
          or (not exists (select 1 from escola_educadores) and interno.membro_direto(p, 'revolucionarios')))
$$;

-- Redefinida inteira: quem pode dar aula da Escola junto passa a ser o educador da Escola (antes: militante ou coordenação/vice).
create or replace function interno.escola_pode_conduzir(p uuid) returns boolean language sql stable security definer set search_path = interno, pg_temp as $$
  select interno.escola_educador_e(p)
$$;

/** Aula ao vivo da Escola nova só por educador da Escola (a função que salva a aula já pede militante; esta é a regra a mais). */
create or replace function interno.escola_aula_educador() returns trigger language plpgsql security definer set search_path = interno, pg_temp as $$
begin
  if new.publico = 'escola' and coalesce(interno.claims() ->> 'role', '') in ('anon', 'authenticated') and not interno.escola_educador_e(auth.uid()) then
    perform interno.erro('sem_permissao');
  end if;
  return new;
end $$;
drop trigger if exists escola_aula_educador on interno.aulas_ao_vivo;
create trigger escola_aula_educador before insert on interno.aulas_ao_vivo for each row execute function interno.escola_aula_educador();

do $$
declare f text;
begin
  foreach f in array array['interno.escola_educador_e(uuid)', 'interno.escola_pode_conduzir(uuid)', 'interno.escola_aula_educador()'] loop
    execute format('revoke all on function %s from public', f);
    if exists (select 1 from pg_roles where rolname = 'anon') then execute format('revoke all on function %s from anon, authenticated', f); end if;
  end loop;
end $$;

/**
 * Para o painel (coordenação com o segundo fator): quem é educador da Escola e, para escolher, os militantes da Frente que ainda
 * não são. Só o codinome que o painel mostra, o id (para dar e tirar) e desde quando; a regra em vigor ("lista" ou "militantes").
 */
create or replace function public.alumia_escola_educadores() returns jsonb language plpgsql stable security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.alumia_admin_exige();
begin
  return jsonb_build_object(
    'regra', case when exists (select 1 from escola_educadores) then 'lista' else 'militantes' end,
    'educadores', coalesce((select jsonb_agg(jsonb_build_object('id', e.usuario, 'nome', interno.alumia_painel_nome(e.usuario), 'desde', e.desde)
        order by interno.alumia_painel_nome(e.usuario)) from escola_educadores e), '[]'::jsonb),
    'candidatos', coalesce((select jsonb_agg(jsonb_build_object('id', m.usuario, 'nome', interno.alumia_painel_nome(m.usuario)) order by interno.alumia_painel_nome(m.usuario))
        from (select distinct d.usuario from departamento_membros d join perfis f on f.id = d.usuario
              where d.departamento = 'revolucionarios' and not f.suspenso
                and not exists (select 1 from escola_educadores e where e.usuario = d.usuario)) m), '[]'::jsonb));
end $$;

/** Dar (p_dar true) ou tirar o lugar de educador da Escola. Pede o motivo; vai para o registro do painel com o codinome. */
create or replace function public.alumia_escola_educador(p_usuario uuid, p_dar boolean, p_motivo text) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.alumia_admin_exige(); v_motivo text := interno.alumia_painel_motivo(p_motivo);
begin
  perform interno.limite('alumia_admin_agir', 300, 60);
  if p_usuario is null or not exists (select 1 from perfis f where f.id = p_usuario and not f.suspenso) then perform interno.erro('nao_encontrado'); end if;
  if coalesce(p_dar, true) then
    insert into escola_educadores (usuario, por) values (p_usuario, v) on conflict (usuario) do nothing;
    if not found then perform interno.erro('nada_a_fazer'); end if;
  else
    delete from escola_educadores where usuario = p_usuario;
    if not found then perform interno.erro('nada_a_fazer'); end if;
  end if;
  perform interno.registrar(case when coalesce(p_dar, true) then 'escola_educador_dado' else 'escola_educador_tirado' end, p_usuario::text, jsonb_build_object('departamento', 'reservado'));
  perform interno.alumia_painel_registrar(case when coalesce(p_dar, true) then 'escola_educador_dado' else 'escola_educador_tirado' end, 'conta', p_usuario::text,
    interno.alumia_painel_nome_fixo(p_usuario), v_motivo);
  return jsonb_build_object('ok', true, 'educador', coalesce(p_dar, true));
end $$;

do $$
declare f text;
begin
  foreach f in array array['public.alumia_modo_so_leitura(boolean, text)', 'public.alumia_topo()', 'public.alumia_escola_educadores()',
                           'public.alumia_escola_educador(uuid, boolean, text)'] loop
    execute format('revoke all on function %s from public', f);
    if exists (select 1 from pg_roles where rolname = 'anon') then
      execute format('revoke all on function %s from anon', f);
      execute format('grant execute on function %s to authenticated', f);
    end if;
  end loop;
end $$;

-- ── 4. A trava num lugar só: o trancar arma o modo só leitura ───────────────────────────────────────────────────────────────

-- Redefinida inteira (o corpo do banco montado com o install.sql deste ramo), com uma linha a mais no fim: arma a trava do modo
-- só leitura em toda tabela da rede. Toda migração termina com o trancar, então tabela nova ganha a trava sozinha.
CREATE OR REPLACE FUNCTION interno.alumia_trancar()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'interno', 'pg_temp'
AS $function$
declare r record; v_def text; v_corpo text; v_n integer := 0; v_abertas text[] := '{}'; v_tabelas integer;
begin
  for r in
    select p.oid, p.proname, l.lanname, p.prosrc, p.proretset, pg_get_function_identity_arguments(p.oid) as argumentos
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace join pg_language l on l.oid = p.prolang
    where n.nspname = 'public' and p.prokind = 'f' and p.prorettype <> 'trigger'::regtype
      and (p.proname like 'rede\_%' or p.proname like 'alumia\_%')
      and not interno.alumia_porta_aberta(p.proname, pg_get_function_identity_arguments(p.oid))
      and (coalesce(has_function_privilege(to_regrole('anon'), p.oid, 'execute'), true)
           or coalesce(has_function_privilege(to_regrole('authenticated'), p.oid, 'execute'), true))
      and p.prosrc !~ 'interno\.alumia_(porta|passa)\(\)'
    order by p.proname
  loop
    begin
      v_def := pg_get_functiondef(r.oid);
      if r.lanname = 'plpgsql' then
        -- O corpo inteiro vira um bloco de dentro: a porta roda antes até dos valores iniciais do "declare" (que em muitas
        -- funções já conferem quem chama ou validam o que veio). Diretiva "#..." no começo do corpo não é embrulhada.
        v_corpo := case when r.prosrc ~ '^\s*#' then null
          else 'begin perform interno.alumia_porta(); ' || regexp_replace(r.prosrc, '[\s;]+$', '') || E'\n; end ' end;
      elsif r.lanname = 'sql' and not r.proretset and btrim(r.prosrc, E' \t\r\n;') !~ ';' and btrim(r.prosrc, E' \t\r\n') ~* '^select\M' then
        v_corpo := E'\nbegin perform interno.alumia_porta(); return (' || btrim(r.prosrc, E' \t\r\n;') || E'\n); end ';
        v_def := regexp_replace(v_def, '\n LANGUAGE sql\n', E'\n LANGUAGE plpgsql\n');
      else
        v_corpo := null;
      end if;
      if v_corpo is null or v_corpo = r.prosrc or position(r.prosrc in v_def) = 0 then
        v_abertas := v_abertas || format('%s(%s)', r.proname, r.argumentos);
      else
        execute replace(v_def, r.prosrc, v_corpo);
        v_n := v_n + 1;
      end if;
    exception when others then
      v_abertas := v_abertas || format('%s(%s)', r.proname, r.argumentos);
    end;
  end loop;
  -- Prompt 5, D1: a trava do modo só leitura em toda tabela da rede (a que já tem fica como está).
  v_tabelas := case when to_regprocedure('interno.alumia_so_leitura_armar()') is not null then interno.alumia_so_leitura_armar() end;
  return jsonb_build_object('trancadas', v_n, 'abertas', to_jsonb(v_abertas), 'so_leitura', v_tabelas);
end $function$;

-- Toda função public.rede_* e public.alumia_* que anon ou authenticated chamam passa pela porta (as novas daqui também), e toda
-- tabela da rede ganha a trava do modo só leitura. "abertas" tem de vir vazia.
do $$
declare v jsonb := interno.alumia_trancar();
begin
  if jsonb_array_length(coalesce(v -> 'abertas', '[]'::jsonb)) > 0 then
    raise warning 'alumia_trancar: função sem porta: %', v -> 'abertas';
  end if;
end $$;
select interno.alumia_trancar();
