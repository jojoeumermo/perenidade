-- Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
--
-- ═══════════════════════════ Alumia · Reforço 1 · frente borda e LGPD · meus dados por inteiro (23/11/2026) ═══════════════════════════
-- O que entra:
--   MEUS DADOS, O RESTO: public.rede_meusdados_mais(), a parte da cópia em .zip com o que as ondas 9 a 14 passaram a guardar da
--   pessoa e que a cópia ainda não levava: o perfil completo (links, seções, voluntariado, outras identidades), os aceites dos
--   termos, as redações, o recado no mural, as questões, o fio que espera para sair, as conquistas, os convites gerados (sem o
--   código), as funções (cargos, moderação, liderança, monitoria, administração), a vida em organizações (boletins, sinos,
--   pedidos de núcleo, a própria organização), a participação (correntes, tarefas de ato, fotos do álbum, coautorias, etiquetas,
--   respostas de entrada em comunidade, notas da comunidade avaliadas, as conversas com a moderação), as preferências e as
--   retenções por precaução.
--   A cópia em .zip (lib/rede/meusdados/servidor.ts) chama esta parte logo depois de public.rede_meusdados_exportar, como a
--   pessoa, com o mesmo segundo fator recente. Sem esta migração no banco, a cópia sai como antes.
-- O que NÃO sai, de propósito (a tela de Meus dados e "O que guardamos" dizem):
--   - nada de outra pessoa: nem o id, nem o @, nem quem convidou, nomeou, decidiu ou corrigiu;
--   - o voto (enquete, story, consulta, decisão): ninguém pode exigir de alguém a prova de em quem votou;
--   - o código de um convite ou de um link conferido (são segredos de uso único);
--   - as conversas cifradas: o texto só abre no aparelho de quem participa, e a cópia delas é a do próprio aparelho.
-- Lei: LGPD (Lei 13.709/2018) art. 18, II (acesso) e V (portabilidade), art. 19, II (cópia completa, em formato que se leia); e
--   art. 6º, III (necessidade) para o que não sai. Marco Civil (Lei 12.965/2014) art. 7º, X.
-- Nada daqui guarda endereço de rede, lugar ou quem viu. Nenhuma função devolve lista de pessoas.
-- Idempotente (scripts/testar-alumia-r1-meusdados.mjs roda duas vezes no banco local). NÃO roda em produção sem o Jonathan.

create or replace function public.rede_meusdados_mais() returns jsonb language plpgsql stable security definer set search_path = interno, pg_temp as $$
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
      'sinos', interno.alumia_md_parte($q$ select s.org from rede_org_sinos s where s.usuario = $1 $q$, v),
      'pedidos_de_nucleo', interno.alumia_md_parte($q$
        select p.nucleo, p.criado_em from rede_org_nucleo_pedidos p where p.usuario = $1 order by p.criado_em $q$, v)),
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
      'conversas', interno.alumia_md_parte($q$ select p.quem_pode, p.prazo_dias from rede_dm_prefs p where p.usuario = $1 $q$, v),
      'mencoes_e_marcacoes', interno.alumia_md_parte($q$
        select p.mencao_quem, p.marcar_quem, p.marcar_aprovar, p.blindagem_ate, p.atualizado_em from rede_o9_prefs p where p.usuario = $1 $q$, v),
      'silencio_dos_avisos', interno.alumia_md_parte($q$ select s.inicio, s.fim from rede_avisos_silencio s where s.usuario = $1 $q$, v),
      'primeiros_passos', interno.alumia_md_parte($q$
        select d.escolhas_em, d.guia_em, d.guia_pulado, d.aparece, d.aparece_em, d.escolhas_adiadas_em from rede_desc_entrada d where d.usuario = $1 $q$, v),
      'rotuladores_assinados', interno.alumia_md_parte($q$
        select r.rotulador, r.efeito, r.criado_em from alumia_rotulos_assinaturas r where r.usuario = $1 order by r.criado_em $q$, v),
      'tempo_de_conta', interno.alumia_md_parte($q$ select c.semanas, c.desde from rede_vida_conta c where c.usuario = $1 $q$, v)),
    'retencoes_por_precaucao', interno.alumia_md_parte($q$
      select r.criado_em, r.responder_ate, r.situacao, r.decidido_em from alumia_lei_retencoes r where r.usuario = $1 order by r.criado_em $q$, v));
end $$;

-- Permissões: só quem tem conta (e, pela porta, só quem passou pela entrada); nada para anon.
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
