-- Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
--
-- As conferências da cópia restaurada (scripts/operacao/restaurar.sh, rotina .github/workflows/restaurar.yml). Roda no banco
-- DESCARTÁVEL em que a cópia acabou de ser restaurada. Se algo falta, para com "restauracao:<o que faltou>". O que imprime é só
-- "certo" ou o nome do que faltou e o número de tabelas: nenhum número de pessoas, nenhum dado (o resumo da rotina é lido por quem
-- tem acesso ao repositório).
--
-- lucia.exigir_dados = 'nao' só para o teste (scripts/operacao/testar-operacao.mjs), num banco recém-instalado sem ninguém. Na
-- rotina vale o padrão: uma cópia de verdade TEM contas.
do $$
declare
  v_exigir boolean := coalesce(nullif(current_setting('lucia.exigir_dados', true), ''), 'sim') <> 'nao';
  v_tabelas integer;
  v_n bigint;
  v_tabela text;
begin
  if not exists (select 1 from pg_namespace where nspname = 'interno') then raise exception 'restauracao:sem_esquema_interno'; end if;
  if not exists (select 1 from pg_namespace where nspname = 'auth') then raise exception 'restauracao:sem_esquema_auth'; end if;

  select count(*)::integer into v_tabelas from pg_tables where schemaname = 'interno';
  if v_tabelas < 100 then raise exception 'restauracao:poucas_tabelas (%)', v_tabelas; end if;
  raise notice 'certo: % tabelas no esquema interno', v_tabelas;

  -- As tabelas de que o resto depende: contas, posts da Alumia, avisos, e-mails, configuração.
  foreach v_tabela in array array['interno.perfis', 'interno.papeis', 'interno.configuracoes', 'interno.avisos', 'interno.emails',
                                  'interno.rede_posts', 'interno.rede_midia', 'interno.rede_push_assinaturas', 'auth.users'] loop
    if to_regclass(v_tabela) is null then raise exception 'restauracao:falta_%', v_tabela; end if;
  end loop;
  raise notice 'certo: as tabelas principais estão lá';

  -- O segredo que embaralha as origens fica FORA da cópia (backup.yml): restaurada, ela não leva a origem nenhuma.
  if to_regclass('interno.origem_segredo') is not null then
    execute 'select count(*) from interno.origem_segredo' into v_n;
    if v_n > 0 then raise exception 'restauracao:a_copia_levou_o_segredo_das_origens'; end if;
  end if;
  if to_regclass('interno.origem_sal') is not null then
    execute 'select count(*) from interno.origem_sal where hora < date_trunc(''hour'', now())' into v_n;
    if v_n > 0 then raise exception 'restauracao:a_copia_levou_o_sal_das_origens'; end if;
  end if;
  raise notice 'certo: a cópia não leva o segredo das origens';

  -- Nenhuma tabela da Alumia guarda endereço de rede (decisão de 13/11): nenhuma coluna inet/cidr no esquema interno.
  if exists (select 1 from information_schema.columns where table_schema = 'interno' and data_type in ('inet', 'cidr')) then
    raise exception 'restauracao:coluna_de_endereco_de_rede';
  end if;
  raise notice 'certo: nenhuma coluna de endereço de rede';

  if v_exigir then
    execute 'select count(*) from interno.perfis' into v_n;
    if v_n = 0 then raise exception 'restauracao:sem_perfis'; end if;
    execute 'select count(*) from auth.users' into v_n;
    if v_n = 0 then raise exception 'restauracao:sem_contas'; end if;
    -- Todo perfil tem a conta dele (a cópia não veio pela metade).
    execute 'select count(*) from interno.perfis p where not exists (select 1 from auth.users u where u.id = p.id)' into v_n;
    if v_n > 0 then raise exception 'restauracao:perfis_sem_conta'; end if;
    raise notice 'certo: há contas, e todo perfil tem a sua';
  end if;
end $$;
