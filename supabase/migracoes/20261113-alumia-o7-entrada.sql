-- Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
--
-- A entrada da Alumia, onda 7: o que continua aberto a quem não tem conta, com a trava ligada.
--
-- Decisão da coordenação (12/11/2026): com a trava da entrada ligada,
--   · o DIRETÓRIO das organizações com selo continua visível sem conta: public.rede_org_diretorio (a lista, só organização com
--     selo, sem contagem de pessoas) e public.rede_org_mapa (os estados e as cidades escritas onde há núcleo aceso, sem número);
--   · a LISTA DE COMUNIDADES fica fechada (rede_com_lista, rede_alumia_ativas e as outras continuam atrás da porta).
-- O perfil de cada organização, os atos e todo o resto da rede seguem atrás da porta: do diretório para dentro, só com conta
-- aprovada e o segundo fator.
--
-- O que este arquivo faz:
--   1. troca a lista de exceções (interno.alumia_porta_aberta, de 20261112-alumia-portas.sql) por uma com as duas funções a mais
--      (a mesma definição de 20261112-alumia-portas.sql e de 20261113-alumia-o7-portas-fediverso.sql, corrigidas junto, com as
--      funções do servidor da federação: rodar qualquer uma das três de novo dá a mesma lista);
--   2. tira a porta das duas, se a regra já tinha passado por elas (a porta é a primeira linha que interno.alumia_trancar escreve);
--   3. roda a regra de novo, para o resto continuar trancado.
--
-- Pode rodar mais de uma vez, sem apagar dado nenhum. Roda DEPOIS de 20261112-alumia-portas.sql e de
-- 20261113-alumia-o7-portas-fediverso.sql.
-- Teste: npm run testar:alumia-entrada.

-- 1. A lista de exceções ────────────────────────────────────────────────────────────────────────────────────────────────────

/**
 * As funções que ficam SEM a porta, de propósito: o que a pessoa precisa antes de ser aprovada (a própria situação, o pedido, o
 * codinome, a idade e o consentimento), a triagem (que tem a própria regra: papel e segundo fator), as duas linhas por aba, que
 * já passam por interno.rede_aba (só "geral" fica aberta), e o diretório das organizações com selo com o mapa dele.
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
                    'alumia_triagem_convites')
      or (p_nome in ('rede_linha', 'rede_novos') and coalesce(p_argumentos, '') like 'p_aba text%')
      -- O diretório das organizações com selo e o mapa dele (20261113-alumia-o7-entrada.sql, decisão de 12/11).
      or (p_nome = 'rede_org_diretorio' and coalesce(p_argumentos, '') = 'p jsonb')
      or (p_nome = 'rede_org_mapa' and coalesce(p_argumentos, '') = '')
$$;

-- 2. Tirar a porta das duas ─────────────────────────────────────────────────────────────────────────────────────────────────
-- A regra escreveu "perform interno.alumia_porta(); " no começo do corpo. Tirar essa chamada devolve a função como era (o bloco
-- de fora que sobra não muda nada). Se a função ainda não tinha a porta, nada acontece.
do $$
declare r record;
begin
  for r in
    select p.oid, p.prosrc
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.prokind = 'f' and p.proname in ('rede_org_diretorio', 'rede_org_mapa')
      and interno.alumia_porta_aberta(p.proname, pg_get_function_identity_arguments(p.oid))
      and position('perform interno.alumia_porta(); ' in p.prosrc) > 0
  loop
    execute replace(pg_get_functiondef(r.oid), r.prosrc, replace(r.prosrc, 'perform interno.alumia_porta(); ', ''));
  end loop;
end $$;

revoke all on function interno.alumia_porta_aberta(text, text) from public;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on function interno.alumia_porta_aberta(text, text) from anon, authenticated;
  end if;
end $$;

-- 3. Trancar o resto ────────────────────────────────────────────────────────────────────────────────────────────────────────
do $$
declare v jsonb := interno.alumia_trancar();
begin
  if jsonb_array_length(v -> 'abertas') > 0 then
    raise warning 'alumia_trancar: função sem porta: %', v -> 'abertas';
  end if;
end $$;
