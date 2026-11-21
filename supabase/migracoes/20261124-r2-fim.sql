-- Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
-- Alumia · Reforço 2 · fim: marca no banco que o SQL da onda R2 foi instalado (as migrações de 24/11, na ordem do fim do install.sql:
-- 20261124-r2-caixas.sql, 20261124-r2-dupla.sql, 20261124-r2-equipe.sql, 20261124-r2-franquia.sql, 20261124-r2-grupos.sql,
-- 20261124-r2-membros.sql e 20261124-r2-voto.sql), escreve a lista final de exceções da porta e passa a porta em toda função nova.
-- Pode rodar mais de uma vez. Roda por último, depois de todas elas.
-- Serve para conferir de fora, sem entrar no painel, se o SQL da R2 já está em produção:
--   POST /rest/v1/rpc/rede_alumia_versao  →  15
--
-- O que a montagem do install.sql conferiu (no banco montado): a das caixas e a dos membros redefinem interno.alumia_porta_aberta
-- (a dos membros já com as caixas; a definição final é a daqui, sem rede_sel_depositar, cuja função a conversa a dois apagou); a
-- da franquia substitui public.rede_franquia_denunciar das caixas pela de (p_usuario uuid, p jsonb); a da conversa a dois e a dos
-- membros redefinem public.rede_meusdados_mais (a dos membros, a última, com a parte "conversas" da conversa a dois); a dos membros
-- e a do voto redefinem public.rede_org_consulta_votar e public.rede_org_consulta_votar_cifrada (a do voto, a última, pede a
-- filiação a interno.voto_consulta_elegivel, que lê interno.rede_nucleo_sem_membros()). Nenhuma função recebe linha de tabela com
-- valor padrão. Endereço de rede: nada daqui lê ou guarda.
-- Lei: LGPD art. 46 (segurança: a porta passa em toda função nova; "abertas" tem de vir vazia) e art. 6º, III (necessidade: o
-- banco deixa de guardar quem fala com quem e quem é de cada núcleo).

-- ── 1. A versão ───────────────────────────────────────────────────────────────────────────────────────────────────────────
create or replace function public.rede_alumia_versao() returns integer language sql immutable set search_path = interno, pg_temp as $$
  select 15
$$;
revoke all on function public.rede_alumia_versao() from public;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    grant execute on function public.rede_alumia_versao() to anon, authenticated, service_role;
  end if;
end $$;

-- ── 2. A lista final de exceções da porta ─────────────────────────────────────────────────────────────────────────────────

/**
 * As funções que ficam SEM a porta, de propósito: a lista da versão 14, sem rede_sel_depositar (a função saiu com o chat do beta),
 * mais as das caixas anônimas e a troca da entrada do núcleo (R2), que por desenho não usam a sessão de conta e só o servidor do
 * site chama (execute só para service_role). O teste da entrada (scripts/testar-alumia-entrada.mjs) confere esta lista.
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
                    -- O registro público das chaves é conferido por qualquer pessoa. (O envelope selado do chat do beta,
                    -- rede_sel_depositar, saiu com a conversa a dois da R2: 20261124-r2-dupla.sql.)
                    'rede_kt_ponta', 'rede_kt_trecho',
                    -- R2, caixas anônimas: sem sessão de conta por desenho; só o servidor do site chama (execute só para service_role).
                    'rede_caixa_lote', 'rede_caixa_buscar', 'rede_caixa_confirmar', 'rede_caixa_trocar', 'rede_caixa_apagar',
                    'rede_passe_gastar', 'rede_diretorio_ler', 'rede_diretorio_reivindicar', 'rede_passes_chave_registrar',
                    'rede_franquia_denunciar', 'rede_franquia_autoria',
                    -- R2 (membros escondidos): a mediação troca a entrada do núcleo com o passe de gestão, sem sessão de conta (só o
                    -- servidor do site chama; execute só para service_role).
                    'rede_nucleo_entrada_trocar')
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

-- ── 3. A porta ────────────────────────────────────────────────────────────────────────────────────────────────────────────
-- Toda função public.rede_* e public.alumia_* que anon ou authenticated chamam passa pela porta da entrada (as redefinidas pela
-- R2 também: create or replace tira a porta, e esta linha a devolve). "abertas" tem de vir vazia.
do $$
declare v jsonb := interno.alumia_trancar();
begin
  if jsonb_array_length(coalesce(v -> 'abertas', '[]'::jsonb)) > 0 then
    raise warning 'alumia_trancar: função sem porta: %', v -> 'abertas';
  end if;
end $$;
select interno.alumia_trancar();
