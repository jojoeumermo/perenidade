-- Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
-- Alumia · Prompt 5 (correções) · fim: marca no banco que o SQL do Prompt 5 foi instalado (as migrações de 26/11, na ordem do fim do
-- install.sql: 20261126-p5-publicar.sql, 20261126-p5-entrada.sql, 20261126-p5-somente-leitura.sql, 20261126-p5-equipe.sql,
-- 20261126-p5-escola.sql, 20261126-p5-avisos.sql, 20261126-p5-beta.sql, 20261126-p5-federacao.sql, 20261126-p5-stories.sql,
-- 20261126-p5-emergencia.sql, da fase 4, 20261126-p5-design.sql, 20261126-p5-imagens.sql e 20261126-p5-stories-mais.sql, e os consertos
-- da auditoria, 20261126-p5-auditoria.sql), escreve
-- a lista final de exceções da porta e passa a porta em toda função nova. Pode rodar mais de uma vez. Roda depois de
-- 20261125-r3-fim.sql (banco na versão 16), por último, depois de todas elas.
-- Serve para conferir de fora, sem entrar no painel, se o SQL do Prompt 5 já está em produção:
--   POST /rest/v1/rpc/rede_alumia_versao  →  17
--
-- O que a montagem do install.sql conferiu (no banco montado): nenhuma migração do Prompt 5 redefine interno.alumia_porta_aberta nem
-- public.rede_alumia_versao; as que são redefinidas por duas delas estão ditas abaixo; as que elas redefinem (rede_mod_agir, alumia_painel_geral,
-- interno.alumia_agente_minimo, interno.alumia_sessao_nova, interno.nome_papel, interno.pode_conceder, interno.papel_conceder_um,
-- territorio_parceiro_definir, contribuicao_editar, ferias_ver, interno.escola_conquistas_visiveis) partem do corpo final da R3.
-- As das fases 2 e 3 (avisos: os avisos, os convites, os selos e o nome do perfil; stories: rede_story_pode; emergencia:
-- interno.alumia_trancar, que passa a armar o modo só leitura, e interno.escola_pode_conduzir) partem do banco montado com as
-- anteriores. As da fase 4 (imagens: rede_pub_midia_pode e rede_midia_faxina_lista; stories-mais: rede_story_publicar,
-- interno.rede5_story_figurinha, interno.rede5_story_json, rede_story_pode, rede_story_trocar_midia, rede_story_destaques,
-- rede_story_faxina_lista, rede_story_conferir_pedir e rede_story_pode_enviar) também partem do banco montado com as anteriores; só
-- rede_story_pode e rede_story_conferir_pedir são redefinidas duas vezes (stories e stories-mais), e vale a do stories-mais, que é
-- a completa. O design só põe o recurso design-novo no catálogo, desligado. A da auditoria (rede_pub_midia_reservar,
-- alumia_escola_educadores, interno.alumia_p5_endereco_limpo, interno.alumia_p5_texto_limpo, erro_tela_registrar,
-- ferias_marcar(date) e interno.pendencias_linhas) parte do banco montado com as anteriores; alumia_escola_educadores (emergencia),
-- as duas limpezas e erro_tela_registrar (beta) e interno.pendencias_linhas (equipe) ficam redefinidas duas vezes, e vale a da
-- auditoria, que é a completa. Ela também tira a regra de envio rede_midia_envio do depósito, refaz rede_stories_envio e põe o
-- gatilho do modo só leitura em interno.perfis.
-- A lista da porta é a da R3 mais uma função só do servidor do site (a entrada de um navegador, 20261126-p5-entrada.sql).
-- As outras funções novas do Prompt 5 que começam com rede_ ou alumia_ (rede_envio_achar, rede_pub_apagar, as da Segurança, do
-- zerar o beta, dos relatos, da federação no painel, da conferência dos stories, do modo só leitura, do alto da Alumia e dos
-- educadores da Escola) passam pela porta. public.erro_tela_registrar não começa com rede_ nem alumia_ e fica fora dela de
-- propósito: a tela de entrada também quebra, antes de haver sessão (20261126-p5-beta.sql).
-- Endereço de rede: nada daqui lê ou guarda.
-- Lei: LGPD art. 46 (segurança: a porta passa em toda função nova; "abertas" tem de vir vazia).

-- ── 1. A versão ───────────────────────────────────────────────────────────────────────────────────────────────────────────
create or replace function public.rede_alumia_versao() returns integer language sql immutable set search_path = interno, pg_temp as $$
  select 17
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
 * As funções que ficam SEM a porta, de propósito: a lista da versão 16 (20261125-r3-fim.sql), mais a entrada de um navegador do
 * Prompt 5, que o servidor do site chama na hora de entrar, sem sessão da Alumia (execute só para service_role). O teste da entrada
 * (scripts/testar-alumia-entrada.mjs) confere esta lista.
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
                    'rede_nucleo_entrada_trocar',
                    -- R3 (20261125-r3-resto-r2.sql): a urna anônima recebe a cédula SEM sessão de conta, com o passe da urna (só o servidor
                    -- do site chama; execute só para service_role).
                    'rede_urna_depositar_anonimo',
                    -- R3 (20261125-r3-servidor-chat.sql): a chave RSA da semana dos passes, lida e guardada pelo servidor do site sem
                    -- sessão de conta (execute só para service_role).
                    'rede_passes_chave_ler', 'rede_passes_chave_guardar',
                    -- P5 (20261126-p5-entrada.sql): o servidor do site conta ao banco que um navegador entrou, na hora de entrar, antes de
                    -- haver sessão da Alumia nele (execute só para service_role). Com a porta, o servidor não conseguiria contar.
                    'alumia_aparelho_entrou')
      or (p_nome in ('rede_linha', 'rede_novos') and coalesce(p_argumentos, '') like 'p_aba text%')
      -- O diretório das organizações com selo e o mapa dele (20261113-alumia-o7-entrada.sql, decisão de 12/11).
      or (p_nome = 'rede_org_diretorio' and coalesce(p_argumentos, '') = 'p jsonb')
      or (p_nome = 'rede_org_mapa' and coalesce(p_argumentos, '') = '')
$$;revoke all on function interno.alumia_porta_aberta(text, text) from public;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on function interno.alumia_porta_aberta(text, text) from anon, authenticated;
  end if;
end $$;

-- ── 3. A porta ────────────────────────────────────────────────────────────────────────────────────────────────────────────
-- Toda função public.rede_* e public.alumia_* que anon ou authenticated chamam passa pela porta da entrada (as redefinidas pelo
-- Prompt 5 também: create or replace tira a porta, e esta linha a devolve). "abertas" tem de vir vazia.
do $$
declare v jsonb := interno.alumia_trancar();
begin
  if jsonb_array_length(coalesce(v -> 'abertas', '[]'::jsonb)) > 0 then
    raise warning 'alumia_trancar: função sem porta: %', v -> 'abertas';
  end if;
end $$;
select interno.alumia_trancar();
