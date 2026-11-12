-- ───────────────────────────── Alumia: as portas da entrada (toda função da rede), novembro de 2026 ─────────────────────────────
-- Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
--
-- A migração da entrada (20261110-alumia-entrada.sql) trancou duas portas: interno.rede2_membro e interno.rede_aba. Mais de cem
-- funções public.rede_* não passam por nenhuma das duas (as da Rede de antes, as de perfil, de moderação, de organização): com a
-- trava ligada, uma conta nova, sem aprovação e sem o segundo fator, seguia uma pessoa (rede_seguir) e lia os posts "só para
-- seguidores" dela (rede_linha por modo, rede_buscar). Esta migração fecha por REGRA, não função por função:
--
--   1. interno.alumia_porta(): com a trava ligada, só passa a sessão aprovada e com o segundo fator (ou a chave de serviço, ou o
--      próprio banco: agendador e SQL Editor). Com a trava DESLIGADA não faz nada: ninguém que já usa percebe diferença.
--   2. interno.alumia_trancar(): põe a porta no começo de TODA função public.rede_* e public.alumia_* que anon ou authenticated
--      podem chamar, menos a lista curta de interno.alumia_porta_aberta (o que a pessoa precisa ANTES de ser aprovada: ver a
--      própria situação, pedir a entrada, consentir, e a linha aberta das disciplinas). Função criada depois nasce aberta até a
--      regra rodar de novo: por isso interno.alumia_entrada_ligar(true) chama a regra, e o teste lê o pg_proc e chama cada uma.
--      Rodar de novo uma migração ANTIGA sozinha recria as funções dela sem a porta: depois, rode select interno.alumia_trancar();
--   3. interno.rede2_pode_ver: com a trava ligada, "seguidores", "comunidade" e "núcleo" também pedem ser membro (aprovada).
--   4. public.rede_aderir: com a trava ligada, só consente quem tem ficha na entrada (pediu) ou já é aprovada.
--   5. A ponte do login único (app/api/sessao/ponte): o freio por conta e o registro passam a morar no banco.
--   6. Aplicativo autenticador novo na conta: a pessoa recebe aviso (e e-mail), para perceber se não foi ela.
--
-- Decisão que fica com a coordenação (docs/rede/ENTRADA.md): com a trava ligada, o diretório de organizações com selo e a lista de
-- comunidades também deixam de responder a visitante. Para reabrir alguma, acrescente o nome em interno.alumia_porta_aberta.
--
-- Pode rodar mais de uma vez, sem apagar dado nenhum. Roda DEPOIS de todas as migrações da Alumia (é a última do install.sql).
-- Teste: npm run testar:alumia-entrada.

-- 1. A porta ────────────────────────────────────────────────────────────────────────────────────────────────────────────────

/**
 * A chamada passa pela entrada da Alumia? Trava desligada: sempre. Ligada: sessão aprovada com o segundo fator, a chave de
 * serviço, ou o próprio banco (agendador, SQL Editor: nenhum papel de API escolhido e nenhum token). Pela API o papel é sempre
 * anon, authenticated ou service_role, então pedido de fora nunca cai no terceiro caso.
 */
create or replace function interno.alumia_passa() returns boolean language sql stable security definer set search_path = interno, pg_temp as $$
  select not interno.alumia_exigida()
      or interno.alumia_sessao_ok()
      or (coalesce(nullif(current_setting('role', true), ''), 'none') = 'none' and interno.claims() = '{}'::jsonb)
$$;

/** A porta: recusa com "alumia_entrada" quem não passa. É a primeira linha de toda função trancada por interno.alumia_trancar. */
create or replace function interno.alumia_porta() returns void language plpgsql stable security definer set search_path = interno, pg_temp as $$
begin
  if not interno.alumia_passa() then perform interno.erro('alumia_entrada'); end if;
end $$;

/**
 * As funções que ficam SEM a porta, de propósito: o que a pessoa precisa antes de ser aprovada (a própria situação, o pedido, o
 * codinome, a idade e o consentimento), a triagem (que tem a própria regra: papel e segundo fator) e as duas linhas por aba, que
 * já passam por interno.rede_aba (só "geral", as dúvidas das aulas que o site aberto mostra, fica aberta).
 */
create or replace function interno.alumia_porta_aberta(p_nome text, p_argumentos text) returns boolean language sql immutable as $$
  select p_nome in ('alumia_entrada_eu', 'alumia_entrada_pedir', 'alumia_triagem_contagem', 'alumia_triagem_fila', 'alumia_triagem_decidir',
                    'rede_situacao', 'rede_aderir', 'rede_codinome_definir', 'rede_confirmar_idade', 'rede_eu', 'rede_alumia_versao',
                    'rede_fed_situacao', 'rede_antigo',
                    -- Chamadas pelo servidor do site sem sessão, com o segredo da federação (Faixa 2): com a porta, o Fediverso para.
                    'rede_fed_servidor', 'rede_fed_midia_servidor', 'rede_fed_mudanca_servidor')
      or (p_nome in ('rede_linha', 'rede_novos') and coalesce(p_argumentos, '') like 'p_aba text%')
$$;

/**
 * Põe a porta em toda função public.rede_* e public.alumia_* que anon ou authenticated podem chamar (fora a lista acima e as
 * que já têm a porta). Em plpgsql, o corpo é embrulhado num bloco que chama a porta primeiro; função em SQL de um select só vira plpgsql
 * com a porta antes do select. Devolve quantas trancou agora e as que NÃO conseguiu trancar ("abertas": tem de ser lista vazia).
 */
create or replace function interno.alumia_trancar() returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare r record; v_def text; v_corpo text; v_n integer := 0; v_abertas text[] := '{}';
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
  return jsonb_build_object('trancadas', v_n, 'abertas', to_jsonb(v_abertas));
end $$;

-- 2. Quem vê o post ─────────────────────────────────────────────────────────────────────────────────────────────────────────

/**
 * Quem pode ver um post (o mesmo de 20261109-alumia-f4.sql e das que vieram antes). O que muda: com a trava da entrada ligada,
 * os públicos "seguidores", "comunidade" e "núcleo" também pedem interno.rede2_membro (conta aprovada e, para a própria sessão,
 * o segundo fator). Antes bastava a linha em rede_seguindo, e rede_seguir não pedia aprovação.
 */
create or replace function interno.rede2_pode_ver(p interno.rede_posts, p_quem uuid) returns boolean language plpgsql stable security definer set search_path = interno, pg_temp as $$
declare
  v_publico text;
  v_comunidade rede_comunidades;
  v_equipe boolean;
  v_dentro boolean;
begin
  if p is null or p.id is null then return false; end if;
  if p_quem is not null and p.autor = p_quem then return true; end if;
  -- Removido, apagado ou retido: só o autor (acima).
  if p.oculto or p.retido or p.apagado_em is not null then return false; end if;
  if interno.rede_bloqueado(p_quem, p.autor) then return false; end if;
  if p_quem is not null and exists (select 1 from perfis f where f.id = p_quem and f.suspenso) then return false; end if;

  v_publico := interno.rede2_publico(p);
  v_equipe := p_quem is not null and interno.voluntario_e(p_quem);
  v_dentro := not interno.alumia_exigida() or interno.rede2_membro(p_quem);

  -- A comunidade restringe antes do público: em comunidade fechada só entra quem é dela; em restrita, membro da Rede lê.
  if p.comunidade is not null then
    select * into v_comunidade from rede_comunidades where slug = p.comunidade;
    if v_comunidade.slug is not null and v_comunidade.tipo = 'fechada' and not interno.rede2_na_comunidade(p.comunidade, p_quem) then return false; end if;
    if v_comunidade.slug is not null and v_comunidade.tipo = 'restrita' and not (interno.rede2_membro(p_quem) or interno.rede2_na_comunidade(p.comunidade, p_quem)) then return false; end if;
  end if;

  -- O espaço fechado da Rede de hoje ("fechado-…") só é de quem é membro do espaço, em qualquer público (a trava que
  -- interno.rede_ve já aplicava; aqui também, para nenhum outro caminho de leitura passar por fora dela).
  if p.comunidade like 'fechado-%' and not exists (select 1 from rede_espaco_membros m where m.espaco = p.comunidade and m.usuario = p_quem) then
    return false;
  end if;

  return case v_publico
    when 'internet' then true
    when 'membros' then interno.rede2_membro(p_quem) or v_equipe
    when 'seguidores' then v_dentro and exists (select 1 from rede_seguindo s where s.quem = p_quem and s.segue = p.autor and not s.pendente)
    when 'comunidade' then v_dentro and p.comunidade is not null and interno.rede2_na_comunidade(p.comunidade, p_quem)
    when 'nucleo' then v_dentro and p.nucleo is not null and interno.rede2_no_nucleo(p.nucleo, p_quem)
    when 'equipe' then v_equipe
    else false
  end;
end $$;

-- 3. O consentimento não fura a fila ────────────────────────────────────────────────────────────────────────────────────────

/**
 * Aderir à Rede (o mesmo de 2026-11-rede2.sql). O que muda: com a trava da entrada ligada, só grava para quem já é aprovada ou
 * tem ficha na entrada (public.alumia_entrada_pedir cria a ficha antes de chamar esta função). Chamada direta de conta sem
 * pedido é recusada, para o consentimento nunca valer como atalho da triagem.
 */
create or replace function public.rede_aderir(p_maior boolean, p_versao integer) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); v_vigente integer := coalesce((select max(versao) from rede_regras), 1);
begin
  perform interno.aberta('comunidade');
  perform interno.limite('rede2_aderir', 20, 60);
  if interno.alumia_exigida() and not interno.alumia_aprovada(v) and not exists (select 1 from alumia_entrada e where e.usuario = v) then
    perform interno.erro('alumia_entrada');
  end if;
  if not coalesce(p_maior, false) then perform interno.erro('idade_minima'); end if;
  if p_versao is distinct from v_vigente then perform interno.erro('invalido:versao'); end if;
  update perfis set rede_18 = true, rede_consentimento = v_vigente where id = v;
  if not exists (select 1 from rede_consentimentos c where c.usuario = v and c.versao = v_vigente and c.revogado_em is null) then
    insert into rede_consentimentos (usuario, versao) values (v, v_vigente);
  end if;
  perform interno.registrar('rede_aderir', '', jsonb_build_object('versao', v_vigente));
  return public.rede_situacao();
end $$;

-- 4. As três funções que respondem "pode ou não pode" (regras de arquivo): falso em vez de erro ─────────────────────────────

create or replace function public.rede_pub_midia_pode(p_caminho text) returns boolean language sql stable security definer set search_path = interno, pg_temp as $$
  select interno.alumia_passa() and (
         exists (select 1 from rede_midia m join rede_posts p on p.id = m.post where m.caminho = p_caminho and interno.rede_ve(p, auth.uid()))
      or exists (select 1 from rede_audios a join rede_posts p on p.id = a.post where a.caminho = p_caminho and interno.rede_ve(p, auth.uid())))
$$;

create or replace function public.rede_pub_pode_enviar() returns boolean language sql stable security definer set search_path = interno, pg_temp as $$
  select interno.alumia_passa() and auth.uid() is not null and coalesce((select rede_18 from perfis where id = auth.uid()), false) and interno.rede2_membro(auth.uid())
$$;

create or replace function public.rede_story_pode(p_caminho text) returns boolean language sql stable security definer set search_path = interno, pg_temp as $$
  select interno.alumia_passa() and exists (select 1 from rede_stories s where s.midia_caminho = p_caminho
                 and (interno.rede5_story_ve(s, auth.uid()) or interno.rede5_story_ve_destaque(s, auth.uid())))
$$;

-- 5. A ponte do login único: freio e registro no banco ──────────────────────────────────────────────────────────────────────

/**
 * A rota /api/sessao/ponte (com a chave de serviço) pergunta antes de gerar o código de entrada: esta conta ainda pode? No máximo
 * 6 códigos por conta a cada 10 minutos, contados no banco (vale entre processos e depois de reiniciar o servidor). Cada código
 * gerado vai ao registro de atividades: só a conta e o destino ("alumia" ou "escola"), nunca o token nem o código.
 */
create or replace function public.alumia_ponte_passar(p_conta uuid, p_destino text) returns boolean language plpgsql volatile security definer set search_path = interno, pg_temp as $$
declare v_janela timestamptz := to_timestamp(floor(extract(epoch from now()) / 600) * 600); v_total integer;
begin
  if not interno.servico() then perform interno.erro('sem_permissao'); end if;
  if p_conta is null or not exists (select 1 from perfis f where f.id = p_conta and not f.suspenso) then return false; end if;
  insert into limites (chave, janela, total) values ('alumia_ponte:' || p_conta::text, v_janela, 1)
  on conflict (chave, janela) do update set total = limites.total + 1
  returning total into v_total;
  if v_total > 6 then return false; end if;
  insert into auditoria (quem, nome, acao, alvo, detalhes)
  values (p_conta, '', 'ponte', case when p_destino in ('alumia', 'escola') then p_destino else '' end, '{}'::jsonb);
  return true;
end $$;

-- 6. Aplicativo autenticador novo: a conta fica sabendo ─────────────────────────────────────────────────────────────────────

/**
 * Quando um aplicativo autenticador passa a valer numa conta (auth.mfa_factors: status "verified"), a pessoa recebe um aviso de
 * conta e um e-mail. Quem entrou com a senha de outra pessoa e cadastrou o PRÓPRIO autenticador não passa despercebido.
 */
create or replace function interno.alumia_fator_novo() returns trigger language plpgsql security definer set search_path = interno, pg_temp as $$
begin
  if new.status::text = 'verified' and (tg_op = 'INSERT' or old.status::text is distinct from 'verified') then
    begin
      perform interno.avisar_em(new.user_id, 'Um aplicativo autenticador novo foi cadastrado na sua conta. Se não foi você, troque a senha agora e fale com a coordenação.', 'conta');
      perform interno.email(interno.email_da_conta(new.user_id), 'fator_novo', 'Aplicativo autenticador novo na sua conta',
        E'Um aplicativo autenticador (o código de 6 números) acabou de ser cadastrado na sua conta do Instituto Lúcia.\n\nSe foi você, não precisa fazer nada.\n\nSe não foi você, alguém entrou com a sua senha: troque a senha agora e escreva para a coordenação.');
    exception when others then null;
    end;
  end if;
  return new;
end $$;

do $$
begin
  if to_regclass('auth.mfa_factors') is not null then
    execute 'drop trigger if exists alumia_fator_novo on auth.mfa_factors';
    execute 'create trigger alumia_fator_novo after insert or update of status on auth.mfa_factors for each row execute function interno.alumia_fator_novo()';
  end if;
exception when others then
  raise notice 'alumia_fator_novo: o gatilho em auth.mfa_factors não pôde ser criado (%). O aviso de autenticador novo fica desligado.', sqlerrm;
end $$;

-- 7. Permissões ─────────────────────────────────────────────────────────────────────────────────────────────────────────────
revoke all on function interno.alumia_passa(), interno.alumia_porta(), interno.alumia_porta_aberta(text, text), interno.alumia_trancar(),
  interno.alumia_fator_novo() from public;
revoke all on function public.alumia_ponte_passar(uuid, text), public.rede_aderir(boolean, integer), public.rede_pub_midia_pode(text),
  public.rede_pub_pode_enviar(), public.rede_story_pode(text) from public;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on function interno.alumia_passa(), interno.alumia_porta(), interno.alumia_porta_aberta(text, text), interno.alumia_trancar(),
      interno.alumia_fator_novo() from anon, authenticated;
    revoke all on function public.alumia_ponte_passar(uuid, text) from anon, authenticated;
    grant execute on function public.alumia_ponte_passar(uuid, text) to service_role;
    revoke all on function public.rede_aderir(boolean, integer) from anon;
    grant execute on function public.rede_aderir(boolean, integer) to authenticated, service_role;
    grant execute on function public.rede_pub_midia_pode(text) to anon, authenticated, service_role;
    grant execute on function public.rede_pub_pode_enviar(), public.rede_story_pode(text) to authenticated, service_role;
  end if;
end $$;

-- 8. Trancar agora ──────────────────────────────────────────────────────────────────────────────────────────────────────────
-- Roda por último, com todas as funções já criadas. Se alguma não puder ser trancada, a migração avisa qual (e
-- interno.alumia_entrada_ligar(true) se recusa a ligar a trava enquanto houver porta aberta).
do $$
declare v jsonb := interno.alumia_trancar();
begin
  if jsonb_array_length(v -> 'abertas') > 0 then
    raise warning 'alumia_trancar: função sem porta: %', v -> 'abertas';
  end if;
end $$;
