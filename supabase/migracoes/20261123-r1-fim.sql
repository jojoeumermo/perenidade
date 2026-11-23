-- Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
-- Alumia · Reforço 1 · fim: marca no banco que o SQL da onda R1 foi instalado (as quatro migrações de 23/11, na ordem do fim do
-- install.sql: 20261123-r1-banco.sql, 20261123-r1-uso.sql, 20261123-r1-fediverso.sql e 20261123-r1-borda.sql) e passa a porta da
-- entrada em toda função nova. Pode rodar mais de uma vez. Roda por último, depois de todas elas.
-- Serve para conferir de fora, sem entrar no painel, se o SQL da R1 já está em produção:
--   POST /rest/v1/rpc/rede_alumia_versao  →  14
--
-- O que a montagem do install.sql conferiu: nenhuma das quatro redefine função de outra. A do banco redefine interno.alumia_sessao_viva,
-- interno.alumia_passa, interno.eu, o gancho da senha e a caixa de críticas, e embrulha (troca de texto no corpo que está no banco)
-- as contas de pessoas de interno.rede_post_json, interno.rede_post_v2, interno.rede_ato_json, public.rede_vou, public.rede_ato_vou,
-- public.rede_meus_espacos e public.alumia_painel_comunidades; a do uso, public.alumia_triagem_fila, public.alumia_painel_cadastros
-- e public.alumia_entrada_eu (e as funções novas do canal com a moderação); a do Fediverso, interno.rede_fed_dominio,
-- public.rede_fed_bloquear e interno.rede_fed_desligar; a da borda só acrescenta public.rede_meusdados_mais. Nenhuma função recebe
-- linha de tabela com valor padrão. Endereço de rede: nada daqui lê ou guarda (decisão de 13/11).
-- Lei: LGPD art. 46 (segurança: a porta passa em toda função nova; "abertas" tem de vir vazia).

-- ── 1. A versão ───────────────────────────────────────────────────────────────────────────────────────────────────────────
create or replace function public.rede_alumia_versao() returns integer language sql immutable set search_path = interno, pg_temp as $$
  select 14
$$;
revoke all on function public.rede_alumia_versao() from public;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    grant execute on function public.rede_alumia_versao() to anon, authenticated, service_role;
  end if;
end $$;

-- ── 2. A porta ────────────────────────────────────────────────────────────────────────────────────────────────────────────
-- Toda função public.rede_* e public.alumia_* que anon ou authenticated chamam passa pela porta da entrada (as redefinidas pela
-- R1 também: create or replace tira a porta, e esta linha a devolve). "abertas" tem de vir vazia.
do $$
declare v jsonb := interno.alumia_trancar();
begin
  if jsonb_array_length(coalesce(v -> 'abertas', '[]'::jsonb)) > 0 then
    raise warning 'alumia_trancar: função sem porta: %', v -> 'abertas';
  end if;
end $$;
select interno.alumia_trancar();
