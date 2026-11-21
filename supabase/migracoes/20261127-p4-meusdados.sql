-- Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
-- Alumia · Prompt 4 · meus dados: a cópia dos dados da pessoa (LGPD art. 18, II e V) passa a levar as escolhas dela nas funções
-- novas do Prompt 4: o selo de verificado e o pedido, o nome reservado ligado a ela, as contagens públicas, a foto protegida, o
-- "ativo recentemente", o dia da chave de segurança, as organizações em que ela é assessora jurídica, o interruptor de sumiço (sem
-- o contato: só se há um) e, da junção dos lotes seguintes, os extras dos agendados do compositor, as sugestões e anotações da
-- criação coletiva, as obras, peças, diário do cineclube, livros, leitura, citações e links da cultura e as memórias que ela enviou
-- (sem o caminho da foto) e, da terceira junção, o mural, o banco de tempo (só o lado dela), o apoio direto, as tarefas que
-- assumiu, a participação (sem voto nem resposta) nas enquetes, consensos, orçamentos, metas, questionários e no termômetro, as
-- cartas, o pouso, os rodízios, a reserva na ciranda e a escolha "só os avisos" do sino da organização e, da quarta junção, as
-- linhas compartilháveis que ela publicou, a mentoria (a trilha e o papel dela, sem a outra pessoa do par), as respostas do simulado
-- ainda aberto, as escolhas da conta (revisão das menções, horário e ausência), as menções esperando a revisão dela, a mudança de
-- servidor, as mediações de que é parte ou que conduz (sem a outra parte) e as falas dela, e o "avisos só de quem eu sigo". Ficam fora, com o motivo no
-- teste da cobertura (scripts/testar-alumia-r1-meusdados.mjs): o limite dos avisos de local (vive 2 horas, sem lugar), os embrulhos
-- da caixa da assessoria e da ficha de filiação e os avisos de sumiço entregues (cifrados para quem recebe).
-- Roda depois de 20261126-p5-fim.sql (banco na versão 17), depois das migrações do Prompt 4 (20261127-p4-*.sql), e o
-- 20261127-p4-fim.sql vem por último. Não mexe na versão nem na lista da porta. Pode rodar mais de uma vez.
-- Função redefinida: public.rede_meusdados_mais(), com o corpo inteiro tirado do banco montado (o último é o de
-- 20261124-r2-membros.sql), com a parte "prompt4" acrescentada no fim e, nos sinos das organizações, a escolha "só os avisos"
-- (a coluna so_avisos do 20261127-p4-perto.sql). Lê tabelas que só existem depois das migrações do
-- Prompt 4; cada parte roda pela interno.alumia_md_parte, que devolve vazio se a tabela faltar.
-- Endereço de rede: nada daqui lê ou guarda.

CREATE OR REPLACE FUNCTION public.rede_meusdados_mais()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'interno', 'pg_temp'
AS $function$begin perform interno.alumia_porta();
declare v uuid := interno.eu();
begin
  if v is null then perform interno.erro('sem_sessao'); end if;
  if not interno.alumia_md_fator_recente() then perform interno.erro('confirme_segundo_fator'); end if;
  return jsonb_build_object(
    'links_do_perfil', interno.alumia_md_parte($q$
      select l.ordem, l.titulo, l.url, l.conferido_como, l.conferido_em, l.pedido_em, l.mediacao_em
      from alumia_perfil_links l where l.usuario = $1 order by l.ordem $q$, v),
    'secoes_do_perfil', interno.alumia_md_parte($q$
      select s.secoes, s.sobre, s.comunidades, s.atualizado_em from alumia_perfil_secoes s where s.usuario = $1 $q$, v),
    'voluntariado_no_perfil', interno.alumia_md_parte($q$
      select p.frente, p.ano_de, p.ano_ate, p.situacao from alumia_perfil_voluntariado p where p.usuario = $1 order by p.ano_de $q$, v),
    'outras_identidades', interno.alumia_md_parte($q$
      select i.tipo, i.criada_em, f.rede_codinome as codinome, f.rede_handle as arroba
      from rede_identidades i join perfis f on f.id = i.identidade where i.dono = $1 and i.identidade <> $1 order by i.criada_em $q$, v),
    'aceites_dos_termos', interno.alumia_md_parte($q$
      select t.versao, t.aceito_em, t.como from alumia_termos_aceites t where t.usuario = $1 order by t.aceito_em $q$, v),
    'regras_lidas', interno.alumia_md_parte($q$
      select r.comunidade, r.lidas_em from alumia_regras_lidas r where r.usuario = $1 order by r.lidas_em $q$, v),
    'redacoes', interno.alumia_md_parte($q$
      select r.semana, r.titulo, r.texto, r.entregue_em, r.devolvida_em, r.apagar_em from alumia_redacoes r where r.autora = $1 order by r.semana $q$, v),
    'redacoes_por_semana', interno.alumia_md_parte($q$
      select c.semana, c.feitas, c.dispensada, c.medalha from alumia_redacao_creditos c where c.usuario = $1 order by c.semana $q$, v),
    'recado_no_mural', interno.alumia_md_parte($q$
      select m.como, m.codinome, m.curso, m.instituicao, m.recado, m.entrou_em from alumia_mural m where m.usuario = $1 $q$, v),
    'questoes', interno.alumia_md_parte($q$
      select q.materia, q.tema, q.enunciado, q.alternativas, q.certa, q.explicacao, q.criado_em, q.mudou_em, q.retirada_em
      from rede_questoes q where q.autor = $1 order by q.criado_em $q$, v),
    'fio_esperando_para_sair', interno.alumia_md_parte($q$
      select e.post, e.blocos, e.criado_em from rede_o12_fio_espera e where e.autor = $1 order by e.criado_em $q$, v),
    'extras_dos_agendados', interno.alumia_md_parte($q$
      select a.agendado, a.fuso, a.extras from rede_o12_agendado a where a.autor = $1 $q$, v),
    'propostas_de_comunidade', interno.alumia_md_parte($q$
      select p.slug, p.nome, p.objetivo, p.regras, p.situacao, p.motivo, p.criado_em from rede_propostas p where p.autor = $1 order by p.criado_em $q$, v),
    'sinteses', interno.alumia_md_parte($q$
      select s.raiz, s.texto, s.criado_em, s.retirada_em from rede_sinteses s where s.autor = $1 order by s.criado_em $q$, v),
    'perguntas_em_ama', interno.alumia_md_parte($q$
      select p.ama, p.nome, p.texto, p.situacao, p.resposta, p.motivo, p.criado_em, p.respondida_em
      from rede_ama_perguntas p where p.quem = $1 order by p.criado_em $q$, v),
    'reacoes_a_stories', interno.alumia_md_parte($q$ select r.story, r.reacao from rede_story_reacoes r where r.quem = $1 $q$, v),
    'lembretes_de_ato_em_stories', interno.alumia_md_parte($q$ select l.ato from rede_story_lembretes l where l.quem = $1 $q$, v),
    'falas_em_atas', interno.alumia_md_parte($q$
      select f.ata, f.ponto, f.posicao, f.falou_em from rede_org_ata_falas f where f.pessoa = $1 order by f.falou_em $q$, v),
    'candidaturas', interno.alumia_md_parte($q$ select c.eleicao, c.opcao from rede_org_eleicao_candidatos c where c.pessoa = $1 $q$, v),
    'conquistas', interno.alumia_md_parte($q$
      select c.medalha, c.alvo, c.progresso, c.mostrar from alumia_conquistas c where c.usuario = $1 order by c.medalha $q$, v),
    'convites_que_gerei', interno.alumia_md_parte($q$
      select c.criado_em, c.vence_em, c.situacao from alumia_convites c where c.criado_por = $1 order by c.criado_em $q$, v),
    'colecoes_do_acervo', interno.alumia_md_parte($q$
      select c.comunidade, c.titulo, c.descricao, c.criado_em, c.mudou_em from rede_acervo_colecoes c where c.usuario = $1 order by c.criado_em $q$, v),
    'agenda_assinada', interno.alumia_md_parte($q$
      select a.data, a.desde from alumia_agenda_assinaturas a where a.usuario = $1 order by a.desde $q$, v),
    'funcoes', jsonb_build_object(
      'cargos', interno.alumia_md_parte($q$
        select c.cargo, c.situacao, c.convidado_em, c.aceito_em from alumia_cargo_pessoas c where c.usuario = $1 order by c.convidado_em $q$, v),
      'moderacao', interno.alumia_md_parte($q$ select m.comunidade from rede_moderadores m where m.usuario = $1 order by 1 $q$, v),
      'lideranca', interno.alumia_md_parte($q$ select l.criado_em from rede_lideres l where l.usuario = $1 $q$, v),
      'monitoria', interno.alumia_md_parte($q$
        select m.disciplinas, m.situacao, m.nomeado_em, m.aceito_em from alumia_monitores m where m.usuario = $1 $q$, v),
      'administracao', interno.alumia_md_parte($q$ select a.nomeado_em from alumia_painel_admin a where a.usuario = $1 $q$, v),
      'turmas', interno.alumia_md_parte($q$ select t.turma, t.cuida, t.entrou_em from alumia_turma_pessoas t where t.usuario = $1 order by t.entrou_em $q$, v)),
    'organizacoes', jsonb_build_object(
      'minha_organizacao', interno.alumia_md_parte($q$
        select o.tipo, o.cidade, o.documento_tipo, o.documento_publico, o.verificada_em, o.criada_em from rede_orgs o where o.perfil = $1 $q$, v),
      'robos_da_organizacao', interno.alumia_md_parte($q$
        select r.nome, r.descricao, r.situacao, r.criado_em from rede_pontes_robos r where r.perfil = $1 order by r.criado_em $q$, v),
      'boletins_assinados', interno.alumia_md_parte($q$
        select b.org, b.email as por_email, b.desde from rede_org_boletim_assinaturas b where b.usuario = $1 order by b.desde $q$, v),
      'sinos', interno.alumia_md_parte($q$ select s.org, s.so_avisos from rede_org_sinos s where s.usuario = $1 $q$, v)),
    'participacao', jsonb_build_object(
      'correntes', interno.alumia_md_parte($q$ select c.corrente from rede_corrente_vou c where c.usuario = $1 $q$, v),
      'tarefas_de_ato', interno.alumia_md_parte($q$ select t.tarefa, t.criado_em from rede_ato_tarefa_quem t where t.usuario = $1 order by t.criado_em $q$, v),
      'fotos_no_album_do_ato', interno.alumia_md_parte($q$
        select a.ato, a.caminho as arquivo, a.legenda, a.estado, a.criado_em, a.decidido_em from rede_ato_album a where a.quem = $1 order by a.criado_em $q$, v),
      'coautorias', interno.alumia_md_parte($q$
        select c.post, c.estado, c.convidada_em, c.decidida_em from rede_coautorias c where c.coautora = $1 order by c.convidada_em $q$, v),
      'etiquetas_em_comunidades', interno.alumia_md_parte($q$
        select e.comunidade, e.etiqueta, e.situacao, e.desde from alumia_etiqueta_de e where e.usuario = $1 order by e.desde $q$, v),
      'respostas_de_entrada_em_comunidade', interno.alumia_md_parte($q$
        select r.comunidade, r.respostas, r.criado_em from alumia_com_respostas r where r.usuario = $1 order by r.criado_em $q$, v),
      'notas_da_comunidade_avaliadas', interno.alumia_md_parte($q$
        select n.nota, n.ajuda, n.criado_em from rede_alumia_nota_votos n where n.usuario = $1 order by n.criado_em $q$, v),
      'pedidos_de_fonte', interno.alumia_md_parte($q$ select f.post, f.criado_em from rede_fonte_pedidos f where f.usuario = $1 order by f.criado_em $q$, v),
      'pedido_de_mais_convites', exists (select 1 from alumia_convite_pedidos p where p.usuario = v),
      -- As conversas que a pessoa abriu com a mediação (20261123-r1-uso.sql), com as mensagens dos dois lados: a da mediação sai
      -- como "mediacao", nunca com quem dela escreveu (a coluna "por" não entra).
      'conversas_com_a_moderacao', interno.alumia_md_parte($q$
        select c.comunidade, c.numero, c.com_codinome, c.situacao, c.criada_em, c.encerrada_em,
          (select coalesce(jsonb_agg(jsonb_build_object('de', m.de, 'texto', m.texto, 'em', m.em) order by m.id), '[]'::jsonb)
             from rede_modmail_mensagens m where m.conversa = c.id) as mensagens
        from rede_modmail_conversas c where c.autor = $1 order by c.criada_em $q$, v)),
    'preferencias', jsonb_build_object(
      'conversas', jsonb_build_object('onde', 'no_aparelho', 'arquivos_cifrados', interno.alumia_md_parte($q$
        select c.tipo, c.versao, c.dia, octet_length(c.blob) as bytes from rede_cofres_da_conta c where c.usuario = $1 order by c.tipo $q$, v)),
      'mencoes_e_marcacoes', interno.alumia_md_parte($q$
        select p.mencao_quem, p.marcar_quem, p.marcar_aprovar, p.blindagem_ate, p.atualizado_em from rede_o9_prefs p where p.usuario = $1 $q$, v),
      'silencio_dos_avisos', interno.alumia_md_parte($q$ select s.inicio, s.fim from rede_avisos_silencio s where s.usuario = $1 $q$, v),
      'primeiros_passos', interno.alumia_md_parte($q$
        select d.escolhas_em, d.guia_em, d.guia_pulado, d.aparece, d.aparece_em, d.escolhas_adiadas_em from rede_desc_entrada d where d.usuario = $1 $q$, v),
      'rotuladores_assinados', interno.alumia_md_parte($q$
        select r.rotulador, r.efeito, r.criado_em from alumia_rotulos_assinaturas r where r.usuario = $1 order by r.criado_em $q$, v),
      'tempo_de_conta', interno.alumia_md_parte($q$ select c.semanas, c.desde from rede_vida_conta c where c.usuario = $1 $q$, v)),
    'retencoes_por_precaucao', interno.alumia_md_parte($q$
      select r.criado_em, r.responder_ate, r.situacao, r.decidido_em from alumia_lei_retencoes r where r.usuario = $1 order by r.criado_em $q$, v),
    -- Prompt 4 (20261127-p4-meusdados.sql): as escolhas da própria pessoa nas funções novas. Nada de outra pessoa (o contato do
    -- interruptor de sumiço sai só como "tem contato"), nenhuma chave nem cifra.
    'prompt4', jsonb_build_object(
      'selo_de_verificado', interno.alumia_md_parte($q$ select s.tipo, s.dado_em from rede_p4_selos s where s.perfil = $1 $q$, v),
      'pedido_de_selo', interno.alumia_md_parte($q$ select p.tipo, p.canal, p.criado_em from rede_p4_selo_pedidos p where p.perfil = $1 $q$, v),
      'nome_reservado', interno.alumia_md_parte($q$ select n.rotulo, n.criado_em from rede_p4_nomes_reservados n where n.dono = $1 order by n.id $q$, v),
      'contagens_publicas', interno.alumia_md_parte($q$ select c.seguidores, c.apoios, c.em from rede_p4_contagens c where c.perfil = $1 $q$, v),
      'foto_protegida', interno.alumia_md_parte($q$ select true as protegida from rede_p4_foto_protegida f where f.dono = $1 $q$, v),
      'ativo_recentemente', interno.alumia_md_parte($q$ select p.ativo_ate from rede_p4_presenca p where p.usuario = $1 $q$, v),
      'chave_de_seguranca', interno.alumia_md_parte($q$ select c.criado_dia from rede_p4_seg_chaves c where c.usuario = $1 $q$, v),
      'assessoria_juridica', interno.alumia_md_parte($q$
        select f.rede_handle as organizacao, a.desde from rede_p4_seg_assessoras a join perfis f on f.id = a.org where a.usuario = $1 order by a.desde $q$, v),
      'interruptor_de_sumico', interno.alumia_md_parte($q$
        select s.dias, s.apagar, s.destino is not null as tem_contato, s.cifra is not null as tem_aviso, s.lembrado_dia, s.criado_dia
        from rede_p4_sumico s where s.usuario = $1 $q$, v),
      -- Da junção dos lotes do compositor, da criação coletiva, da cultura e da memória e luta: só o que a própria pessoa escreveu,
      -- enviou ou escolheu. Nada de quem mais sugeriu, anotou, leu ou seguiu; a obra seguida e o livro lido saem pelo id e pelo
      -- título, sem quem os criou. A foto da memória sai só como "tem foto" (o caminho no depósito não serve à pessoa), e quem pediu
      -- para tirar uma memória do ar não sai (não fica registrado).
      'extras_dos_agendados_p4', interno.alumia_md_parte($q$ select a.agendado, a.extras from rede_p4c_agendado a where a.autor = $1 $q$, v),
      'sugestoes_em_rascunhos', interno.alumia_md_parte($q$
        select s.comunidade, s.pagina, s.trecho, s.proposta, s.motivo, s.situacao, s.criado_em, s.decidido_em
        from rede_p4_cc_sugestoes s where s.autor = $1 order by s.criado_em $q$, v),
      'anotacoes_no_acervo', interno.alumia_md_parte($q$
        select a.comunidade, a.pagina, a.trecho, a.texto, a.resolvida, a.criado_em from rede_p4_cc_anotacoes a where a.autor = $1 order by a.criado_em $q$, v),
      'respostas_a_anotacoes', interno.alumia_md_parte($q$
        select r.anotacao, r.texto, r.criado_em from rede_p4_cc_anotacao_respostas r where r.autor = $1 order by r.criado_em $q$, v),
      'obras', interno.alumia_md_parte($q$ select o.titulo, o.genero, o.sinopse, o.criada_em from rede_p4_obras o where o.autor = $1 order by o.criada_em $q$, v),
      'obras_que_sigo', interno.alumia_md_parte($q$
        select s.obra, o.titulo from rede_p4_obra_seguir s join rede_p4_obras o on o.id = s.obra where s.usuario = $1 order by o.titulo $q$, v),
      'pecas_no_mural', interno.alumia_md_parte($q$
        select p.post, p.titulo, p.linguagem, p.criada_em from rede_p4_pecas p where p.autor = $1 order by p.criada_em $q$, v),
      'diario_do_cineclube', interno.alumia_md_parte($q$
        select d.comunidade, d.filme, d.ano, d.nota, d.criado_em from rede_p4_cine_diario d where d.por = $1 order by d.criado_em $q$, v),
      'livros_que_propus', interno.alumia_md_parte($q$
        select l.comunidade, l.titulo, l.autoria, l.situacao, l.criado_em from rede_p4_livros l where l.por = $1 order by l.criado_em $q$, v),
      'minha_leitura', interno.alumia_md_parte($q$
        select x.livro, l.titulo, x.pct from rede_p4_leitura x join rede_p4_livros l on l.id = x.livro where x.usuario = $1 order by l.titulo $q$, v),
      'citacoes', interno.alumia_md_parte($q$ select c.livro, c.texto, c.pagina, c.criada_em from rede_p4_citacoes c where c.por = $1 order by c.criada_em $q$, v),
      'links_na_playlist', interno.alumia_md_parte($q$
        select p.comunidade, p.url, p.titulo, p.nota, p.criado_em from rede_p4_playlist p where p.por = $1 order by p.criado_em $q$, v),
      'memorias_enviadas', interno.alumia_md_parte($q$
        select m.comunidade, m.titulo, m.texto, m.quando, m.consentimento, m.foto is not null as tem_foto, m.estado, m.criada_em, m.decidida_em,
          m.retirada_em
        from rede_p4_memorias m where m.autor = $1 order by m.criada_em $q$, v),
      -- Da terceira junção (organização, ação coletiva e perto): o que a própria pessoa pôs, pediu, ofereceu ou assumiu. Do banco
      -- de tempo sai só o lado dela (deu ou recebeu), nunca a outra pessoa da troca. Das enquetes, consensos, orçamentos, metas e
      -- avaliações do território e dos questionários da base sai só que ela participou (o voto, a posição, a nota e a resposta
      -- viram contadores ou ficam soltas, e não são dela).
      'mural_ofereco_preciso', interno.alumia_md_parte($q$
        select m.comunidade, m.tipo, m.categoria, m.titulo, m.texto, m.criado_em, m.expira_em
        from rede_p4_or_mural m where m.autor = $1 order by m.criado_em $q$, v),
      'banco_de_tempo', interno.alumia_md_parte($q$
        select h.comunidade, case when h.deu = $1 then 'dei' else 'recebi' end as lado, h.minutos, h.servico, h.estado, h.dia
        from rede_p4_or_horas h where h.deu = $1 or h.recebeu = $1 order by h.dia $q$, v),
      'apoio_direto', interno.alumia_md_parte($q$
        select a.pix, a.link, a.texto, a.atualizado_dia from rede_p4_or_apoio_direto a where a.pessoa = $1 $q$, v),
      'tarefas_que_assumi', interno.alumia_md_parte($q$ select e.cartao from rede_p4_or_cartao_eu e where e.pessoa = $1 $q$, v),
      'participei', jsonb_build_object(
        'enquetes_de_horario', interno.alumia_md_parte($q$ select x.enquete from rede_p4_or_horario_votantes x where x.pessoa = $1 $q$, v),
        'consensos', interno.alumia_md_parte($q$ select x.consenso from rede_p4_or_consenso_votantes x where x.pessoa = $1 $q$, v),
        'orcamentos', interno.alumia_md_parte($q$ select x.orcamento from rede_p4_or_orc_apoiadores x where x.pessoa = $1 $q$, v),
        'metas', interno.alumia_md_parte($q$ select x.meta from rede_p4_or_meta_pessoas x where x.pessoa = $1 $q$, v),
        'questionarios_da_base', interno.alumia_md_parte($q$ select x.questionario from rede_p4_quest_responderam x where x.quem = $1 $q$, v),
        'termometro_do_territorio', interno.alumia_md_parte($q$
          select x.lugar, x.periodo from rede_p4_or_lugar_avaliadores x where x.pessoa = $1 $q$, v)),
      'cartas_de_solidariedade', interno.alumia_md_parte($q$
        select c.campanha, c.texto, c.assinatura, c.estado, c.criada_dia from rede_p4_cartas c where c.autor = $1 order by c.criada_dia $q$, v),
      'pouso_solidario', interno.alumia_md_parte($q$
        select p.org, p.tipo, p.cidade, p.pessoas, p.de, p.ate, p.observacao, p.estado, p.criado_em
        from rede_p4_pouso p where p.quem = $1 order by p.criado_em $q$, v),
      'rodizios', interno.alumia_md_parte($q$ select r.rodizio from rede_p4_rodizio_pessoas r where r.quem = $1 $q$, v),
      'ciranda', interno.alumia_md_parte($q$ select c.ato, c.criancas from rede_p4_ciranda_reservas c where c.quem = $1 $q$, v),
      -- Da quarta junção (descoberta e estudo, conta e pontes): só o lado da própria pessoa. Da mentoria sai a trilha e o papel dela,
      -- nunca a outra pessoa do par; das mediações, a situação, o acordo e o aceite dela, nunca a outra parte nem a mediadora; das
      -- menções esperando revisão, só o post. As respostas do simulado só existem enquanto ele está aberto.
      'linhas_que_publiquei', interno.alumia_md_parte($q$
        select l.codigo, l.nome, l.filtro, l.criada_em from rede_p4_de_linhas l where l.dona = $1 order by l.criada_em $q$, v),
      'mentoria_que_ofereco', interno.alumia_md_parte($q$ select m.trilha, m.vagas, m.desde from rede_p4_de_mentoras m where m.usuario = $1 order by m.desde $q$, v),
      'mentorias', interno.alumia_md_parte($q$
        select m.trilha, case when m.veterana = $1 then 'veterana' else 'caloura' end as papel, m.criada_em
        from rede_p4_de_mentorias m where m.veterana = $1 or m.caloura = $1 order by m.criada_em $q$, v),
      'respostas_de_simulado_aberto', interno.alumia_md_parte($q$
        select r.simulado, r.respostas from rede_p4_de_simulado_respostas r where r.usuario = $1 $q$, v),
      'escolhas_da_conta', interno.alumia_md_parte($q$
        select p.mencao_revisar, p.atendimento, p.ausencia, p.atualizado_em from rede_p4_ct_prefs p where p.usuario = $1 $q$, v),
      'mencoes_esperando_revisao', interno.alumia_md_parte($q$
        select m.post, m.criado_em from rede_p4_ct_mencoes m where m.mencionado = $1 order by m.criado_em $q$, v),
      'mudanca_de_servidor', interno.alumia_md_parte($q$
        select m.alvo, m.situacao, m.pedido_em, m.enviada_em from rede_p4_ct_mudanca m where m.usuario = $1 $q$, v),
      'mediacoes_de_que_sou_parte', interno.alumia_md_parte($q$
        select m.comunidade, m.situacao, m.acordo, p.aceite, p.acordo_ok, m.criado_em, m.encerrada_em
        from rede_p4_ct_med_partes p join rede_p4_ct_mediacoes m on m.id = p.mediacao where p.usuario = $1 order by m.criado_em $q$, v),
      'mediacoes_que_conduzo', interno.alumia_md_parte($q$
        select m.comunidade, m.situacao, m.criado_em, m.encerrada_em from rede_p4_ct_mediacoes m where m.mediadora = $1 order by m.criado_em $q$, v),
      'minhas_falas_em_mediacao', interno.alumia_md_parte($q$
        select f.mediacao, f.texto, f.criado_em from rede_p4_ct_med_falas f where f.autor = $1 order by f.id $q$, v),
      'avisos_so_de_quem_sigo', interno.alumia_md_parte($q$ select a.desde from rede_p4_avisos_so_seguidos a where a.usuario = $1 $q$, v)));
end
; end $function$;

revoke all on function public.rede_meusdados_mais() from public;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on function public.rede_meusdados_mais() from anon, authenticated;
    grant execute on function public.rede_meusdados_mais() to authenticated, service_role;
  end if;
end $$;

-- A porta: toda função public.rede_* passa pela entrada da Alumia ("abertas" tem de vir vazia).
select interno.alumia_trancar();
