-- ───────────────────────────── Alumia: onda 14, revisão do banco (14A) ─────────────────────────────
-- Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
--
-- Fica no FIM do install.sql (depois das ondas 12 e 13 e da integração das duas faixas). Pode rodar mais de uma vez: cada passo
-- confere antes de mexer, e a segunda rodada não muda nada. Teste: scripts/testar-alumia-o14-banco.mjs (varre o catálogo inteiro).
-- Conferido também no Postgres 17 do Supabase, com o Auth e o Storage de verdade, rodando como o papel postgres.
--
-- O que entra aqui, e só isto:
--   1. A lista das funções sem a porta (interno.alumia_porta_aberta) com tudo o que as definições anteriores tinham (a federação, o
--      diretório, a transparência, a revisão de conta, a marca do convite) mais as três da Faixa 2 que são abertas por desenho:
--      public.rede_sel_depositar (o envelope selado é anônimo), public.rede_kt_ponta e public.rede_kt_trecho (o registro público
--      das chaves, que qualquer pessoa confere). Se alguma delas já tinha a porta, ela sai (interno.alumia_destrancar).
--   2. A federação começa pela vida do post: interno.rede_fed_federavel passa a chamar interno.rede_vida_federa (o não listado, o
--      arquivado, o que some sozinho e o da roda nunca saem), do mesmo jeito que 20261116-fediverso-vida-do-post.sql (Faixa 2).
--      Só acrescenta a conferência quando ela falta; a versão da Faixa 2, quando entrar, já a tem e fica como está.
--   3. Número de pessoas só a partir de 3: o total de "útil" de um post (quantas pessoas marcaram) volta nulo abaixo de 3 no cartão
--      do post (interno.rede_post_v2) e na resposta de public.rede_reagir. A tela já não mostra nada quando vem nulo. E conta pelo
--      marco de 15 minutos, como a petição e o "vou" (interno.rede_util_publicado): quem marca e desmarca o próprio "útil" não vê o
--      número mudar na hora, e não descobre por subtração quantas outras marcaram. A ordem "úteis" das respostas
--      (public.rede_conv_arvore) e da descoberta (interno.rede3_desc_pagina) usa essa mesma conta, com o nulo valendo 0.
--   4. O gancho da senha (public.alumia_porta_gancho_senha) só para o papel do serviço de contas (supabase_auth_admin): sai a
--      chave de serviço, que nunca o chama; o serviço de contas ganha o uso do esquema public, como pede o Supabase. O dono (quem
--      roda o SQL) fica com o execute: sem ele, o Postgres recusa o create or replace do gancho (o validador do plpgsql confere o
--      execute), e a onda 9 rodada de novo quebraria.
--   5. As funções security definer do esquema interno que nasceram sem "revoke" (o execute de todo mundo, PUBLIC, que o Postgres dá
--      a toda função nova) deixam de ser de todo mundo. No Supabase, anon e authenticated têm o uso do esquema interno (as regras
--      dos depósitos do storage chamam funções dele), então essas funções ficavam ao alcance deles. Quem precisa delas continua:
--      o dono (as funções de public, o pg_cron e os gatilhos rodam como ele), e as que uma regra do storage ou uma função comum
--      (sem security definer) chama ficam como estão. As que têm execute dado de propósito a anon ou authenticated não mudam.
--   6. A porta em tudo o que sobrou (interno.alumia_trancar).
-- Endereço de rede: nada daqui lê ou guarda (decisão de 13/11).

-- ── 1. As funções sem a porta ────────────────────────────────────────────────────────────────────────────────────────────

/**
 * As funções que ficam SEM a porta, de propósito. A lista de 20261115-alumia-o9-transparencia.sql (a mesma das migrações de antes
 * que a definem, sem tirar nenhum nome) mais as três da Faixa 2 abertas por desenho. Uma migração antiga rodada depois desta
 * volta à lista dela: rode esta em seguida.
 */
create or replace function interno.alumia_porta_aberta(p_nome text, p_argumentos text) returns boolean language sql immutable as $$
  select p_nome in ('alumia_entrada_eu', 'alumia_entrada_pedir', 'alumia_triagem_contagem', 'alumia_triagem_fila', 'alumia_triagem_decidir',
                    'rede_situacao', 'rede_aderir', 'rede_codinome_definir', 'rede_confirmar_idade', 'rede_eu', 'rede_alumia_versao',
                    'rede_fed_situacao', 'rede_antigo',
                    -- Chamadas pelo servidor do site sem sessão, com o segredo da federação (Faixa 2): com a porta, o Fediverso para.
                    'rede_fed_servidor', 'rede_fed_midia_servidor', 'rede_fed_mudanca_servidor',
                    -- Quem teve a conta suspensa ou retida pede revisão (20261114-alumia-o8-lei.sql).
                    'alumia_lei_minha_conta', 'alumia_lei_recorrer_conta',
                    -- A marca "veio por convite" na triagem, que tem a regra dela (20261114-alumia-o8-porta.sql).
                    'alumia_triagem_convites',
                    -- O relatório de transparência, público como a página (20261115-alumia-o9-transparencia.sql).
                    'alumia_transparencia',
                    -- Faixa 2: o envelope selado é anônimo por desenho (quem deposita não se identifica), e o registro público das
                    -- chaves é conferido por qualquer pessoa. As outras rede_olm_*, rede_mls_*
                    -- e rede_sel_* ficam com a porta.
                    'rede_sel_depositar', 'rede_kt_ponta', 'rede_kt_trecho')
      or (p_nome in ('rede_linha', 'rede_novos') and coalesce(p_argumentos, '') like 'p_aba text%')
      -- O diretório das organizações com selo e o mapa dele (20261113-alumia-o7-entrada.sql, decisão de 12/11).
      or (p_nome = 'rede_org_diretorio' and coalesce(p_argumentos, '') = 'p jsonb')
      or (p_nome = 'rede_org_mapa' and coalesce(p_argumentos, '') = '')
$$;
revoke all on function interno.alumia_porta_aberta(text, text) from public;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on function interno.alumia_porta_aberta(text, text) from anon, authenticated;
  end if;
end $$;

-- Se a migração da Faixa 2 rodou antes desta (e trancou no fim), a porta sai das três. Sem elas no banco, não faz nada.
select interno.alumia_destrancar(f) from unnest(array['rede_sel_depositar', 'rede_kt_ponta', 'rede_kt_trecho']) f;

-- ── 2. A federação começa pela vida do post ──────────────────────────────────────────────────────────────────────────────
do $$
declare
  v_oid oid := to_regprocedure('interno.rede_fed_federavel(interno.rede_posts, integer)');
  v_src text;
  v_novo text;
  c_inicio constant text := 'if p.id is null or p.autor is null or p_nivel > 8 then return false; end if;';
begin
  if v_oid is null then return; end if;
  select prosrc into v_src from pg_proc where oid = v_oid;
  if position('rede_vida_federa' in v_src) > 0 then return; end if;
  if position(c_inicio in v_src) = 0 then
    raise warning 'rede_fed_federavel: o começo da função mudou; a vida do post não foi acrescentada (confira à mão)';
    return;
  end if;
  -- A chamada fica num "if" próprio: o plpgsql só a prepara quando a função existe (o banco de antes da onda 9 não a tem).
  v_novo := replace(v_src, c_inicio, c_inicio || E'\n'
    || E'  -- A vida do post (não listado, arquivado, some sozinho, roda): nada disso sai (20261120-alumia-o14-banco.sql).\n'
    || E'  if to_regprocedure(''interno.rede_vida_federa(interno.rede_posts)'') is not null then\n'
    || E'    if not interno.rede_vida_federa(p) then return false; end if;\n'
    || E'  end if;');
  execute replace(pg_get_functiondef(v_oid), v_src, v_novo);
end $$;

-- ── 3. O total de "útil": pelo marco e só a partir de 3 ──────────────────────────────────────────────────────────────────

/**
 * A chave do intervalo de quem desfez o "útil" em interno.rede_contagem_saidas. Sai do id do post, mas não é ele: as saídas do
 * "vou" do mesmo post usam o id do post, e as duas contas não se misturam.
 */
create or replace function interno.rede_util_alvo(p_post uuid) returns uuid language sql immutable as $$
  select md5('util:' || p_post::text)::uuid
$$;

/**
 * Quantas pessoas marcaram "útil" no último marco (quem marcou até ele, mais quem estava nele e desfez depois: a regra da petição e
 * do "vou", ninguém vê o efeito do próprio toque). Nulo abaixo de 3.
 */
create or replace function interno.rede_util_publicado(p_post uuid) returns integer language sql stable security definer set search_path = interno, pg_temp as $$
  select case when x.n >= 3 then x.n::integer end from (
    select (select count(*) from rede_reacoes r where r.post = p_post and r.tipo = 'util' and r.criado_em <= interno.rede_contagem_marco())
         + (select count(*) from rede_contagem_saidas s where s.alvo = interno.rede_util_alvo(p_post)
              and s.entrou_em <= interno.rede_contagem_marco() and s.saiu_em > interno.rede_contagem_marco()) as n) x
$$;

/** Quem desfaz o "útil" deixa só o intervalo (se já contava no marco), sem a pessoa. Post apagado (cascata) não deixa nada. */
create or replace function interno.rede_util_saiu() returns trigger language plpgsql security definer set search_path = interno, pg_temp as $$
begin
  if old.tipo = 'util' and old.criado_em <= interno.rede_contagem_marco() and exists (select 1 from rede_posts where id = old.post) then
    insert into rede_contagem_saidas (alvo, entrou_em) values (interno.rede_util_alvo(old.post), old.criado_em);
  end if;
  if random() < 0.05 then delete from rede_contagem_saidas where saiu_em < now() - interval '1 hour'; end if;
  return old;
end $$;
drop trigger if exists rede_util_saiu on interno.rede_reacoes;
create trigger rede_util_saiu after delete on interno.rede_reacoes for each row when (old.tipo = 'util') execute function interno.rede_util_saiu();
revoke all on function interno.rede_util_publicado(uuid), interno.rede_util_saiu() from public;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on function interno.rede_util_publicado(uuid), interno.rede_util_saiu() from anon, authenticated;
  end if;
end $$;

-- O total no cartão e na resposta de rede_reagir, e a ordem "úteis" das respostas e da descoberta: troca só onde o trecho está
-- (a contagem crua, ou a "a partir de 3" sem marco de uma rodada anterior desta migração). Função sem o trecho fica como está.
do $$
declare
  r record;
  c_cru constant text := '''util'', (select count(*)::integer from rede_reacoes r where r.post = %s and r.tipo = ''util'')';
  c_tres constant text := '''util'', (select case when count(*) >= 3 then count(*)::integer end from rede_reacoes r where r.post = %s and r.tipo = ''util'')';
  c_marco constant text := '''util'', interno.rede_util_publicado(%s)';
  v_src text;
begin
  for r in
    select p.oid, p.prosrc, x.antes, x.depois
    from (values
      ('interno.rede_post_v2(interno.rede_posts, uuid, boolean)', format(c_cru, 'p.id'), format(c_marco, 'p.id')),
      ('interno.rede_post_v2(interno.rede_posts, uuid, boolean)', format(c_tres, 'p.id'), format(c_marco, 'p.id')),
      ('public.rede_reagir(uuid, text, boolean)', format(c_cru, 'p_post'), format(c_marco, 'p_post')),
      ('public.rede_reagir(uuid, text, boolean)', format(c_tres, 'p_post'), format(c_marco, 'p_post')),
      ('public.rede_conv_arvore(uuid, text)', '(select count(*)::integer from rede_reacoes u where u.post = c.id and u.tipo = ''util'') as util',
       'coalesce(interno.rede_util_publicado(c.id), 0) as util'),
      ('interno.rede3_desc_pagina(text, text, text, integer, jsonb, uuid, tsquery)', '(select count(*) from rede_reacoes r where r.post = p.id and r.tipo = ''util'')::numeric',
       'coalesce(interno.rede_util_publicado(p.id), 0)::numeric')
    ) x (assinatura, antes, depois)
    join pg_proc p on p.oid = to_regprocedure(x.assinatura)
  loop
    -- Lido de novo a cada passo: a mesma função pode ter mudado no passo de antes.
    select prosrc into v_src from pg_proc where oid = r.oid;
    if position(r.antes in v_src) > 0 then
      execute replace(pg_get_functiondef(r.oid), v_src, replace(v_src, r.antes, r.depois));
    end if;
  end loop;
end $$;

-- ── 4. O gancho da senha só para o serviço de contas ─────────────────────────────────────────────────────────────────────
do $$
begin
  if to_regprocedure('public.alumia_porta_gancho_senha(jsonb)') is null then return; end if;
  revoke all on function public.alumia_porta_gancho_senha(jsonb) from public;
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on function public.alumia_porta_gancho_senha(jsonb) from anon, authenticated;
  end if;
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    revoke all on function public.alumia_porta_gancho_senha(jsonb) from service_role;
  end if;
  if exists (select 1 from pg_roles where rolname = 'supabase_auth_admin') then
    grant usage on schema public to supabase_auth_admin;
    grant execute on function public.alumia_porta_gancho_senha(jsonb) to supabase_auth_admin;
    -- O dono (quem roda o SQL) fica com o execute, mesmo sem chamar o gancho: o create or replace dele pede o execute (o validador do
    -- plpgsql confere), e sem ele a onda 9 rodada de novo para com "permission denied". Devolve a quem tinha perdido.
    execute format('grant execute on function public.alumia_porta_gancho_senha(jsonb) to %I',
                   (select r.rolname from pg_proc p join pg_roles r on r.oid = p.proowner where p.oid = 'public.alumia_porta_gancho_senha(jsonb)'::regprocedure));
  end if;
end $$;

-- ── 5. As security definer de interno sem o execute de todo mundo ──────────────────────────────────────────────────────
do $$
declare r record;
begin
  for r in
    select p.oid::regprocedure as f, p.proname from pg_proc p
    where p.pronamespace = 'interno'::regnamespace and p.prokind = 'f' and p.prosecdef
      and exists (select 1 from aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a where a.grantee = 0 and a.privilege_type = 'EXECUTE')
  loop
    -- Chamada por uma regra (política) de alguma tabela ou por uma função comum: fica como está.
    continue when exists (select 1 from pg_policy po
                          where coalesce(pg_get_expr(po.polqual, po.polrelid), '') || ' ' || coalesce(pg_get_expr(po.polwithcheck, po.polrelid), '')
                                ~ ('(^|[^a-z0-9_])' || r.proname || '[(]'));
    continue when exists (select 1 from pg_proc q join pg_namespace n on n.oid = q.pronamespace
                          where not q.prosecdef and q.prolang in (select l.oid from pg_language l where l.lanname in ('sql', 'plpgsql'))
                            and n.nspname not in ('pg_catalog', 'information_schema') and q.prosrc ~ ('(^|[^a-z0-9_])' || r.proname || '[(]'));
    execute format('revoke all on function %s from public', r.f);
  end loop;
end $$;

-- ── 6. A porta ───────────────────────────────────────────────────────────────────────────────────────────────────────────
select interno.alumia_trancar();
