// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Gera supabase/verify.sql a partir do install.sql: as conferências de segurança fixas e, além delas, a lista de cada
// tabela, função, depósito e rotina que o install.sql cria, para saber se ele rodou inteiro (inclusive em partes).
// Uso: node scripts/gerar-verify.mjs
import fs from "node:fs";

const install = fs.readFileSync("supabase/install.sql", "utf8");
const unicos = (re) => [...new Set([...install.matchAll(re)].map((m) => m[1].toLowerCase()))].sort();
const tabelas = unicos(/create table (?:if not exists )?([a-z_]+\.[a-z_0-9]+)/gi);
const funcoes = unicos(/create (?:or replace )?function ([a-z_]+\.[a-z_0-9]+)\s*\(/gi);
const depositos = unicos(/storage\.buckets \(id[^)]*\)\s*values \('([a-z-]+)'/gi);
const rotinas = unicos(/cron\.schedule\('([a-z-]+)'/gi);
const lista = (nomes) => `array[${nomes.map((n) => `'${n}'`).join(", ")}]`;

const sql = `-- Instituto Lúcia. Licença: AGPL-3.0-or-later (veja LICENSE).
--
-- Conferência do banco depois do install.sql: SÓ LEITURA (não muda nada, pode rodar quantas vezes quiser no SQL
-- Editor). Cada linha é uma conferência; "ok" = true é o esperado. Qualquer false aponta o que olhar na coluna detalhe.
-- Gerado por scripts/gerar-verify.mjs a partir do install.sql (${tabelas.length} tabelas, ${funcoes.length} funções,
-- ${depositos.length} depósitos, ${rotinas.length} rotinas). Não edite à mão: rode o script de novo.
with
tabelas_esperadas(nome) as (select unnest(${lista(tabelas)})),
funcoes_esperadas(nome) as (select unnest(${lista(funcoes)})),
depositos_esperados(nome) as (select unnest(${lista(depositos)})),
rotinas_esperadas(nome) as (select unnest(${lista(rotinas)})),
tabelas_faltando as (select nome from tabelas_esperadas where to_regclass(nome) is null),
funcoes_faltando as (
  select e.nome from funcoes_esperadas e
  where not exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname || '.' || p.proname = e.nome)
),
depositos_faltando as (select nome from depositos_esperados where not exists (select 1 from storage.buckets b where b.id = nome)),
-- O agendador (pg_cron) pode não existir no projeto: a tabela dele só é lida quando existe.
rotinas_ativas as (
  select unnest(case when to_regclass('cron.job') is null then '{}'::text[]
    else string_to_array((xpath('/row/n/text()', query_to_xml('select string_agg(jobname, '','') as n from cron.job where active', false, true, '')))[1]::text, ',') end) as nome
),
conferencias(ordem, conferencia, ok, detalhe) as (
  select 1, 'todas as tabelas do install.sql existem',
         not exists (select 1 from tabelas_faltando),
         (select 'faltam ' || count(*) || ': ' || string_agg(nome, ', ') from tabelas_faltando)
  union all
  select 2, 'todas as funções do install.sql existem',
         not exists (select 1 from funcoes_faltando),
         (select 'faltam ' || count(*) || ': ' || string_agg(nome, ', ') from funcoes_faltando)
  union all
  select 3, 'todos os depósitos de arquivos existem',
         not exists (select 1 from depositos_faltando),
         (select 'faltam: ' || string_agg(nome, ', ') from depositos_faltando)
  union all
  select 4, 'toda tabela de interno tem segurança por linha',
         not exists (select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'interno' and c.relkind = 'r' and not c.relrowsecurity),
         (select string_agg(c.relname, ', ') from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'interno' and c.relkind = 'r' and not c.relrowsecurity)
  union all
  select 5, 'nenhuma tabela de interno com permissão direta para anon/authenticated',
         not exists (select 1 from information_schema.role_table_grants where table_schema = 'interno' and grantee in ('anon', 'authenticated', 'PUBLIC')),
         (select string_agg(distinct table_name, ', ') from information_schema.role_table_grants where table_schema = 'interno' and grantee in ('anon', 'authenticated', 'PUBLIC'))
  union all
  select 6, 'nenhuma tabela nem view no esquema public',
         not exists (select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relkind in ('r', 'v', 'm', 'p')),
         (select string_agg(c.relname, ', ') from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relkind in ('r', 'v', 'm', 'p'))
  union all
  select 7, 'toda função security definer tem search_path fixo',
         not exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname in ('public', 'interno') and p.prosecdef and not exists (select 1 from unnest(coalesce(p.proconfig, '{}')) c where c like 'search_path=%')),
         (select string_agg(n.nspname || '.' || p.proname, ', ') from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname in ('public', 'interno') and p.prosecdef and not exists (select 1 from unnest(coalesce(p.proconfig, '{}')) c where c like 'search_path=%'))
  union all
  -- O uso do esquema interno é liberado de propósito: as regras dos depósitos chamam funções de lá. O que importa é
  -- que nenhuma tabela seja legível e que as funções de permissão não sejam chamáveis por visitante.
  select 8, 'visitante e conta comum não leem tabela do interno nem chamam as funções de permissão',
         not exists (select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'interno' and c.relkind = 'r'
                       and (has_table_privilege('anon', c.oid, 'select') or has_table_privilege('authenticated', c.oid, 'select')))
           and not has_function_privilege('anon', 'interno.sessao_confiavel()', 'execute'),
         (select string_agg(c.relname, ', ') from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'interno' and c.relkind = 'r'
            and (has_table_privilege('anon', c.oid, 'select') or has_table_privilege('authenticated', c.oid, 'select')))
  union all
  select 9, 'regras dos depósitos que contam envios estão ativas',
         exists (select 1 from pg_policies where schemaname = 'storage' and policyname = 'gaveta_envio' and with_check like '%gaveta_arquivo_pode%')
           and exists (select 1 from pg_policies where schemaname = 'storage' and policyname = 'podcast_producao_envio' and with_check like '%podcast_pergunta_pode_enviar%'),
         null
  union all
  select 10, 'só rádio, podcast e publicações do estúdio são depósitos públicos',
         not exists (select 1 from storage.buckets where public and id not in ('radio', 'podcast', 'estudio-publicacoes')),
         (select string_agg(id, ', ') from storage.buckets where public)
  union all
  select 11, 'nenhuma regra de depósito liberada para todos sem condição',
         not exists (select 1 from pg_policies where schemaname = 'storage' and (coalesce(qual, '') ~* '^\\(?true\\)?$' or coalesce(with_check, '') ~* '^\\(?true\\)?$')),
         (select string_agg(policyname, ', ') from pg_policies where schemaname = 'storage' and (coalesce(qual, '') ~* '^\\(?true\\)?$' or coalesce(with_check, '') ~* '^\\(?true\\)?$'))
  union all
  select 12, 'rotinas agendadas ativas (precisa do pg_cron e do pg_net ligados)',
         not exists (select 1 from rotinas_esperadas e where e.nome not in (select nome from rotinas_ativas)),
         (select case when to_regclass('cron.job') is null then 'o pg_cron não está ligado: Database → Extensions'
            else 'paradas ou faltando: ' || string_agg(nome, ', ') end
          from rotinas_esperadas e where e.nome not in (select nome from rotinas_ativas))
  union all
  select 13, 'exigência de segundo fator para a liderança está ligada (escolha sua no painel)',
         coalesce((select (valor ->> 'exigir_2fa')::boolean from interno.configuracoes where chave = 'seguranca'), false),
         'Painel → Controles do site → Segurança'
)
select ordem, conferencia, ok, detalhe from conferencias order by ordem;
`;
fs.writeFileSync("supabase/verify.sql", sql);
console.log(`supabase/verify.sql: ${tabelas.length} tabelas, ${funcoes.length} funções, ${depositos.length} depósitos, ${rotinas.length} rotinas`);
