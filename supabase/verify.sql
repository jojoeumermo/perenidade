-- Instituto Lúcia. Licença: AGPL-3.0-or-later (veja LICENSE).
--
-- Conferência do banco depois do install.sql: SÓ LEITURA (não muda nada, pode rodar quantas vezes quiser no SQL
-- Editor). Cada linha é uma conferência; "ok" = true é o esperado. Qualquer false aponta o que olhar.
with
conferencias(ordem, conferencia, ok, detalhe) as (
  select 1, 'toda tabela de interno tem segurança por linha',
         not exists (select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'interno' and c.relkind = 'r' and not c.relrowsecurity),
         (select string_agg(c.relname, ', ') from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'interno' and c.relkind = 'r' and not c.relrowsecurity)
  union all
  select 2, 'nenhuma tabela de interno com permissão direta para anon/authenticated',
         not exists (select 1 from information_schema.role_table_grants where table_schema = 'interno' and grantee in ('anon', 'authenticated', 'PUBLIC')),
         (select string_agg(distinct table_name, ', ') from information_schema.role_table_grants where table_schema = 'interno' and grantee in ('anon', 'authenticated', 'PUBLIC'))
  union all
  select 3, 'nenhuma tabela nem view no esquema public',
         not exists (select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relkind in ('r', 'v', 'm', 'p')),
         (select string_agg(c.relname, ', ') from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relkind in ('r', 'v', 'm', 'p'))
  union all
  select 4, 'toda função security definer tem search_path fixo',
         not exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname in ('public', 'interno') and p.prosecdef and not exists (select 1 from unnest(coalesce(p.proconfig, '{}')) c where c like 'search_path=%')),
         (select string_agg(n.nspname || '.' || p.proname, ', ') from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname in ('public', 'interno') and p.prosecdef and not exists (select 1 from unnest(coalesce(p.proconfig, '{}')) c where c like 'search_path=%'))
  union all
  select 5, 'proteções de 25/10 instaladas (segundo fator, depósitos, aula ao vivo, e-mails)',
         to_regprocedure('interno.sessao_confiavel()') is not null and to_regprocedure('interno.podcast_pergunta_pode_enviar(text)') is not null
           and to_regprocedure('interno.gaveta_arquivo_pode(text)') is not null and to_regprocedure('public.aula_ao_vivo_sala_chave(uuid,text)') is not null
           and to_regprocedure('interno.sem_link(text)') is not null and to_regclass('interno.aulas_sala_chaves') is not null,
         null
  union all
  select 6, 'regras dos depósitos que contam envios estão ativas',
         exists (select 1 from pg_policies where schemaname = 'storage' and policyname = 'gaveta_envio' and with_check like '%gaveta_arquivo_pode%')
           and exists (select 1 from pg_policies where schemaname = 'storage' and policyname = 'podcast_producao_envio' and with_check like '%podcast_pergunta_pode_enviar%'),
         null
  union all
  select 7, 'só rádio, podcast e publicações do estúdio são depósitos públicos',
         not exists (select 1 from storage.buckets where public and id not in ('radio', 'podcast', 'estudio-publicacoes')),
         (select string_agg(id, ', ') from storage.buckets where public)
  union all
  select 8, 'nenhuma regra de depósito liberada para todos sem condição',
         not exists (select 1 from pg_policies where schemaname = 'storage' and (coalesce(qual, '') ~* '^\(?true\)?$' or coalesce(with_check, '') ~* '^\(?true\)?$')),
         (select string_agg(policyname, ', ') from pg_policies where schemaname = 'storage' and (coalesce(qual, '') ~* '^\(?true\)?$' or coalesce(with_check, '') ~* '^\(?true\)?$'))
  union all
  select 9, 'funções internas de permissão não chamáveis por visitante',
         not has_function_privilege('anon', 'interno.sessao_confiavel()', 'execute'),
         null
  union all
  select 10, 'exigência de segundo fator para a liderança está ligada',
         coalesce((select (valor ->> 'exigir_2fa')::boolean from interno.configuracoes where chave = 'seguranca'), false),
         'Painel → Controles do site → Segurança'
  union all
  select 11, 'rotinas agendadas ativas',
         (select count(*) from cron.job where jobname like 'lucia-%' and active) >= 5,
         (select string_agg(jobname || case when active then '' else ' (parada)' end, ', ') from cron.job where jobname like 'lucia-%')
)
select ordem, conferencia, ok, detalhe from conferencias order by ordem;
