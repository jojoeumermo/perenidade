-- Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
-- Alumia · Prompt 4 (novas funcionalidades) · fim: marca no banco que o SQL do Prompt 4 foi instalado (as migrações de 27/11, na
-- ordem do fim do install.sql: 20261127-p4-cifrado-sem-anexo.sql, 20261127-p4-anexo-cifrado.sql, 20261127-p4-selo-contagens.sql,
-- 20261127-p4-presenca-print.sql, 20261127-p4-avisos-de-local.sql, 20261127-p4-seguranca-pessoal.sql, 20261127-p4-compositor.sql,
-- 20261127-p4-cartao-do-post.sql, 20261127-p4-criacao-coletiva.sql, 20261127-p4-cultura.sql, 20261127-p4-memoria-e-luta.sql,
-- 20261127-p4-organizacao.sql, 20261127-p4-coletiva.sql, 20261127-p4-conversa.sql, 20261127-p4-perto.sql,
-- 20261127-p4-descoberta-estudo.sql, 20261127-p4-conta.sql, 20261127-p4-pontes.sql, 20261127-p4-chamadas.sql,
-- 20261127-p4-meusdados.sql e 20261127-p4-escola-tag.sql), escreve a lista final de exceções da porta e passa a porta em toda função nova. Pode rodar mais de
-- uma vez. Roda depois de 20261126-p5-fim.sql (banco na versão 17), por último, depois de todas elas.
-- Serve para conferir de fora, sem entrar no painel, se o SQL do Prompt 4 já está em produção:
--   POST /rest/v1/rpc/rede_alumia_versao  →  18
--
-- O que a montagem do install.sql conferiu (no banco montado): nenhuma migração do Prompt 4 redefine interno.alumia_porta_aberta nem
-- public.rede_alumia_versao, e nenhuma função é redefinida por inteiro por duas delas. As funções que já existiam e mudam:
--   · public.rede_publicar(jsonb): o item 136 (cifrado-sem-anexo) acrescenta a recusa do post cifrado com anexo ao corpo final do
--     Prompt 5, lido do banco; depois o compositor a redefine inteira (a partir do corpo com o item 136), com o álbum de até 20
--     imagens, a capa, a versão curta, a fonte e o "Mande a sua";
--   · do compositor também: interno.rede_o12_separar(jsonb, uuid), public.rede_pub_corrigir(uuid, jsonb),
--     interno.rede_texto_limpo(text), public.rede_mod_niveis() e public.rede_mod_meu_nivel();
--   · interno.alumia_verificada e interno.nome_esqueleto (o selo das pessoas, a partir do corpo de 20261126-p5-avisos.sql);
--   · do cartão do post: interno.rede_alumia_reacoes_de(uuid, uuid) (a lista de reações em vigor do post) e
--     public.rede_alumia_reagir(uuid, text, boolean) (só a conferência do emoji, trocada no corpo lido do banco); a tabela
--     interno.rede_reacoes_emoji troca o check fixo dos emojis por um de tamanho e pelo gatilho da lista da comunidade;
--   · da cultura: a tabela interno.rede_encontros ganha a coluna comunidade (o núcleo deixa de ser obrigatório, com o check de um
--     dono só); as funções dos encontros de núcleo ficam como estavam;
--   · da conversa: interno.alumia_em_silencio(uuid, timestamptz) (com a flag alumia-p4-conversa ligada, o banco deixa de segurar o
--     push, porque o não perturbe com horário vive no aparelho; a partir do corpo lido do banco);
--   · do perto: interno.alumia_org_postou() (o sino da organização com a escolha "só os avisos", a partir do corpo lido do banco);
--     a tabela interno.rede_org_sinos ganha a coluna so_avisos, desligada por padrão;
--   · das pontes (cada uma a partir do corpo lido do banco montado, com uma ou duas linhas a mais): interno.rede_fed_bloqueado(text)
--     (com o modo "só servidores aprovados" ligado, servidor fora da lista conta como bloqueado), interno.rede_fed_post_json(
--     interno.rede_posts) (o ponto público do ato), public.rede_pontes_telegram_pendentes(integer) (o aviso de ato),
--     public.rede_aviso_push_pendentes(integer) (push de menção e resposta só de quem a pessoa segue, por escolha dela) e
--     public.rede_conv_arvore(uuid, text) (a resposta com 3 "pouco útil" desce; o "útil" continua publicado em marcos da onda 14);
--   · da conta: a regra de tipo da fila do Fediverso (interno.rede_fed_fila) troca rede_fed_fila_tipo_v2 por rede_fed_fila_tipo_p4,
--     a mesma lista mais "move" (mudar de servidor);
--   · public.rede_meusdados_mais (a cópia dos dados ganha a parte "prompt4", a partir do corpo de 20261124-r2-membros.sql);
--   · interno.alumia_so_leitura_perfil() (20261127-p4-escola-tag.sql: com o modo só leitura do Prompt 5 ligado, desligar a tag da
--     Escola, que é booleana, conta como tirar e continua; a partir do corpo lido do banco montado).
-- A organização, a ação coletiva, a descoberta e estudo e a conta não redefinem nenhuma função que já existia; as chamadas só põem
-- os interruptores alumia-p4-chamadas e sala-livekit no catálogo. Todas as outras funções são novas.
-- A lista da porta é a do Prompt 5, sem nada a mais: as funções novas do Prompt 4 que começam com rede_ ou alumia_ passam pela porta
-- (as do selo, das contagens, da presença, da proteção contra print, dos avisos de local, da segurança pessoal, do compositor, do
-- cartão do post, da criação coletiva, da cultura, da memória e luta, da organização, da ação coletiva, da conversa, do perto, da
-- descoberta e estudo, da conta e das pontes). As funções do servidor do site da conta (public.rede_p4_ct_mudanca_enviar e
-- _mudou_para), das pontes (os avisos de ato no Telegram e o "pouco útil", public.rede_p4_pouco_util e _meus) e da ação coletiva
-- (o "mandei" da pressão em parlamentar, public.rede_p4_pressao_mandei e public.rede_p4_pressao_minhas: a marca é o HMAC que o
-- servidor do site calcula) têm execute só para service_role. O RSS do #tema da descoberta
-- (public.rede_p4_de_rss_tag), o leitor de fios e a árvore da conversa das pontes, chamados também por visitante, passam pela porta
-- como as outras (nenhuma exceção nova). As
-- duas do visitante da memória e luta (o RSS do podcast, public.rede_p4_podcast_rss, e a regra de leitura do depósito "rede-memoria", public.rede_p4_memoria_foto_pode) já chamam a porta
-- (ou interno.alumia_passa) por conta própria: com a trava da entrada ligada, nada delas sai para quem não passou. As três do
-- depósito dos anexos cifrados (public.alumia_anexo_reservar, _ver e _tirar), o áudio do podcast (public.rede_p4_podcast_audio) e a
-- limpeza das fotos órfãs da memória (public.rede_p4_memoria_orfas) só o servidor do site chama, com a chave de serviço (execute
-- só para service_role), e a porta não as alcança.
-- Endereço de rede: nada daqui lê ou guarda.
-- Lei: LGPD art. 46 (segurança: a porta passa em toda função nova; "abertas" tem de vir vazia).

-- ── 1. A versão ───────────────────────────────────────────────────────────────────────────────────────────────────────────
create or replace function public.rede_alumia_versao() returns integer language sql immutable set search_path = interno, pg_temp as $$
  select 18
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
 * As funções que ficam SEM a porta, de propósito: a lista da versão 17 (20261126-p5-fim.sql), sem nada a mais. O Prompt 4 não
 * acrescenta exceção: o depósito dos anexos cifrados é só do servidor do site (execute só para service_role). O teste da entrada
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
                    'rede_urna_depositar_anonimo', 'rede_urna_cedula_contar',
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
$$;
revoke all on function interno.alumia_porta_aberta(text, text) from public;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on function interno.alumia_porta_aberta(text, text) from anon, authenticated;
  end if;
end $$;

-- ── 3. A porta ────────────────────────────────────────────────────────────────────────────────────────────────────────────
-- Toda função public.rede_* e public.alumia_* que anon ou authenticated chamam passa pela porta da entrada (as redefinidas pelo
-- Prompt 4 também: create or replace tira a porta, e esta linha a devolve). "abertas" tem de vir vazia.
do $$
declare v jsonb := interno.alumia_trancar();
begin
  if jsonb_array_length(coalesce(v -> 'abertas', '[]'::jsonb)) > 0 then
    raise warning 'alumia_trancar: função sem porta: %', v -> 'abertas';
  end if;
end $$;
select interno.alumia_trancar();
