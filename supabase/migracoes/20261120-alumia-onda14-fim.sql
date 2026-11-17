-- Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
-- Alumia · Onda 14 · fim: marca no banco que as migrações da onda 14 foram instaladas (a conta e o serviço de contas no Supabase de
-- verdade, a revisão do banco: as migrações 20261120-alumia-o14-*.sql, na ordem do fim do install.sql) e passa a porta da entrada
-- em toda função nova. A 20261120-alumia-o14-tipo-linha.sql não fica no fim: ela está antes da o9-publicar, onde tem de estar.
-- As frentes de telas, vazamento e celular não têm SQL. Nenhum interruptor novo nesta onda.
-- Pode rodar mais de uma vez. Roda por último, depois de todas elas.
-- Serve para conferir de fora, sem entrar no painel, se o SQL da onda já está em produção:
--   POST /rest/v1/rpc/rede_alumia_versao  →  11
-- O site NÃO exige a versão 11 para abrir: com o banco ainda em 10, o que já existia segue igual (o painel de controle mostra
-- "esperada 11 · instalada 10").
--
-- O que a junta conferiu: a da conta não redefine nenhuma função da revisão do banco, e só a do banco redefine
-- interno.alumia_porta_aberta (a lista da onda 9 com as três da Faixa 2). A do banco vem depois da conta, para o passo 5 dela (as
-- security definer de interno sem o execute de todo mundo) pegar também as funções novas da conta. Nenhuma função recebe linha de
-- tabela com valor padrão. Endereço de rede: nada daqui lê ou guarda (decisão de 13/11).

-- ── 1. A versão ───────────────────────────────────────────────────────────────────────────────────────────────────────────
create or replace function public.rede_alumia_versao() returns integer language sql immutable set search_path = interno, pg_temp as $$
  select 11
$$;
revoke all on function public.rede_alumia_versao() from public;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    grant execute on function public.rede_alumia_versao() to anon, authenticated, service_role;
  end if;
end $$;

-- ── 2. A porta ────────────────────────────────────────────────────────────────────────────────────────────────────────────
-- Toda função public.rede_* e public.alumia_* que anon ou authenticated chamam passa pela porta da entrada (as redefinidas pelas
-- frentes também: create or replace tira a porta, e esta linha a devolve). "abertas" tem de vir vazia.
do $$
declare v jsonb := interno.alumia_trancar();
begin
  if jsonb_array_length(coalesce(v -> 'abertas', '[]'::jsonb)) > 0 then
    raise warning 'alumia_trancar: função sem porta: %', v -> 'abertas';
  end if;
end $$;
select interno.alumia_trancar();
