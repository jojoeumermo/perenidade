-- Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
-- Alumia · R2 · a conversa a dois sem metadados no servidor (itens 1.1, 1.2, 1.5, 2.1, 2.2, 2.4 e 2.5 do chat no nível do Signal):
--
--   1. SAI do banco tudo o que ligava conta a conversa, a caixa ou a pedido no chat a dois do beta: as conversas e as mensagens
--      (rede_dm_*), a caixa e as chaves da biblioteca do Matrix (rede_olm_*) e a caixa selada por conta (rede_sel_*), com as funções
--      e os gatilhos delas. É `drop table` (os arquivos da tabela saem do disco do banco), não `delete`. As conversas do beta somem
--      junto: a tela avisa antes, com a data (lib/rede/chat/r2/troca.ts), e o aparelho apaga as lojas velhas na primeira abertura
--      (lib/rede/chat/r2/limpeza.ts). Tudo que estava nessas tabelas já era cifrado no aparelho.
--   2. A conversa nova não tem tabela própria: os pacotes vão para as caixas anônimas (20261124-r2-caixas.sql), sem conta, e a lista
--      de conversas, os contatos, as preferências ("quem pode me chamar", prazo), as recusas e os bloqueios moram SÓ nos aparelhos
--      da pessoa. Para sincronizar os aparelhos e para a cópia de segurança, o servidor guarda um arquivo cifrado por conta e tipo
--      (interno.rede_cofres_da_conta), que ele não lê: só o tipo, a versão, a faixa do tamanho e o dia da última gravação.
--   3. A carona de um ato: o chat não abre mais conversa no servidor. public.rede_carona_contato devolve só o codinome de quem
--      publicou a carona, com as mesmas regras de antes (ato que vale para quem pede, não bloqueado, perfil visível, limite por dia);
--      o pedido de conversa sai do aparelho pela caixa de pedidos, como qualquer outro.
--   4. Redefine (a definição COMPLETA, tirada do banco montado com o install.sql deste ramo, sem o que lia o chat velho):
--      public.conta_meus_dados, public.rede_meusdados_mais e public.rede_alumia_emblemas ("conversas" passa a ser contado no aparelho).
--
-- Leis e princípios: LGPD art. 6º, III (necessidade: o servidor não precisa saber quem conversa com quem para entregar), art. 16
-- (eliminação ao fim do tratamento), art. 46 (segurança); Marco Civil art. 7º, II e III, e art. 10 (sigilo do fluxo e das
-- comunicações privadas). Nenhuma lista de pessoas, nenhum número de pessoas, nenhum endereço de rede.
--
-- A lista de exceções da porta (interno.alumia_porta_aberta) NÃO muda aqui: o nome 'rede_sel_depositar' fica sem função e a
-- junção o tira na lista final (20261124-r2-fim.sql). Pode rodar mais de uma vez. Termina trancando tudo na porta.
-- Teste: scripts/testar-r2-dupla-banco.mjs.

-- ── 1. O chat a dois do beta sai do banco ─────────────────────────────────────────────────────────────────────────────────
do $$
declare f record;
begin
  for f in
    select p.oid::regprocedure as assinatura from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname in ('public', 'interno') and p.proname ~ '^rede_(dm|olm|sel)_'
  loop
    execute format('drop function if exists %s cascade', f.assinatura);
  end loop;
end $$;

drop table if exists interno.rede_dm_mensagens, interno.rede_dm_embrulhos, interno.rede_dm_recusas, interno.rede_dm_prefs,
  interno.rede_dm_conversas, interno.rede_dm_chaves cascade;
drop table if exists interno.rede_olm_caixa, interno.rede_olm_unicas, interno.rede_olm_reserva, interno.rede_olm_aparelhos cascade;
drop table if exists interno.rede_sel_caixa, interno.rede_sel_contagem, interno.rede_sel_entrega cascade;

-- ── 2. Os arquivos cifrados da conta (lista de conversas e cópia de segurança) ───────────────────────────────────────────
-- O arquivo é cifrado no aparelho (libsodium, secretstream XChaCha20-Poly1305; lib/rede/aparelhos/arquivo.ts) com a chave de
-- sincronia ("lista") ou com a chave da cópia ("copia", 24 palavras ou Argon2id de uma frase): o servidor não tem nenhuma das duas.
-- O tamanho é sempre uma de quatro faixas (cabeçalho de 33 bytes + 24 do secretstream + a faixa + 17 por pedaço de 64 KB), então o
-- servidor não sabe quantas conversas a pessoa tem. `versao` é a concorrência otimista entre aparelhos; `dia` é só a data.
create table if not exists interno.rede_cofres_da_conta (
  usuario uuid not null references interno.perfis (id) on delete cascade,
  tipo text not null check (tipo in ('lista', 'copia')),
  versao integer not null check (versao > 0),
  blob bytea not null,
  dia date not null,
  primary key (usuario, tipo)
);
alter table interno.rede_cofres_da_conta enable row level security;
revoke all on interno.rede_cofres_da_conta from public;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on interno.rede_cofres_da_conta from anon, authenticated;
  end if;
end $$;

/** Os tamanhos aceitos de um arquivo cifrado da conta (o mesmo cálculo de lib/rede/aparelhos/arquivo.ts, TAMANHOS_DO_ARQUIVO). */
create or replace function interno.rede_cofre_tamanho_ok(p_bytes integer) returns boolean language sql immutable set search_path = interno, pg_temp as $$
  select p_bytes in (select 33 + 24 + f + 17 * (f / 65536) from unnest(array[65536, 262144, 1048576, 4194304]) f)
$$;
revoke all on function interno.rede_cofre_tamanho_ok(integer) from public;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on function interno.rede_cofre_tamanho_ok(integer) from anon, authenticated;
  end if;
end $$;

/** Lê o arquivo cifrado da conta de quem chama. null se não há. */
create or replace function public.rede_cofre_ler(p_tipo text) returns jsonb language plpgsql stable security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); c rede_cofres_da_conta;
begin
  if v is null then perform interno.erro('sem_sessao'); end if;
  if p_tipo is null or p_tipo not in ('lista', 'copia') then perform interno.erro('invalido:tipo'); end if;
  select * into c from rede_cofres_da_conta where usuario = v and tipo = p_tipo;
  if not found then return null; end if;
  return jsonb_build_object('versao', c.versao, 'blob', encode(c.blob, 'base64'), 'dia', to_char(c.dia, 'YYYY-MM-DD'));
end $$;

/**
 * Grava o arquivo cifrado da conta. `p_versao` é a versão que o aparelho leu (0 = não havia): se outro aparelho gravou antes,
 * recusa com 'versao_ocupada' e o aparelho lê, junta e tenta de novo. Tamanho fora das faixas: recusa.
 */
create or replace function public.rede_cofre_gravar(p_tipo text, p_versao integer, p_blob bytea) returns jsonb language plpgsql volatile security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); v_atual integer;
begin
  if v is null then perform interno.erro('sem_sessao'); end if;
  if p_tipo is null or p_tipo not in ('lista', 'copia') then perform interno.erro('invalido:tipo'); end if;
  if p_blob is null or not interno.rede_cofre_tamanho_ok(octet_length(p_blob)) then perform interno.erro('invalido:tamanho'); end if;
  if p_versao is null or p_versao < 0 then perform interno.erro('invalido:versao'); end if;
  perform interno.limite('rede_cofre_gravar', 240, 60);
  select versao into v_atual from rede_cofres_da_conta where usuario = v and tipo = p_tipo for update;
  if coalesce(v_atual, 0) <> p_versao then perform interno.erro('versao_ocupada'); end if;
  insert into rede_cofres_da_conta (usuario, tipo, versao, blob, dia) values (v, p_tipo, p_versao + 1, p_blob, (now() at time zone 'utc')::date)
    on conflict (usuario, tipo) do update set versao = excluded.versao, blob = excluded.blob, dia = excluded.dia;
  return jsonb_build_object('versao', p_versao + 1);
end $$;

/** Apaga o arquivo cifrado da conta (a pessoa desligou a cópia, ou apagou tudo do chat). */
create or replace function public.rede_cofre_apagar(p_tipo text) returns jsonb language plpgsql volatile security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); n integer;
begin
  if v is null then perform interno.erro('sem_sessao'); end if;
  if p_tipo is null or p_tipo not in ('lista', 'copia') then perform interno.erro('invalido:tipo'); end if;
  delete from rede_cofres_da_conta where usuario = v and tipo = p_tipo;
  get diagnostics n = row_count;
  return jsonb_build_object('apagado', n > 0);
end $$;

-- ── 3. A carona de um ato: só o codinome de quem publicou ─────────────────────────────────────────────────────────────────
/**
 * O codinome de quem publicou a carona, para o aparelho mandar o pedido de conversa pela caixa de pedidos. As regras são as da
 * rede_dm_abrir_carona de antes: o ato tem de valer para quem pede (quem não vê o ato não fica sabendo nem que a carona existe),
 * não pode ter passado, e a pessoa não pode estar bloqueada nem invisível. "Quem pode me chamar" e as recusas de 30 dias são
 * conferidos no aparelho de quem recebe (o servidor não sabe mais). Nada é gravado além do limite por conta.
 */
create or replace function public.rede_carona_contato(p_carona uuid) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare
  v uuid := interno.eu(); k rede_ato_caronas; p rede_posts; ch rede_chamados; f perfis;
  fechada constant jsonb := jsonb_build_object('erro', 'dm_fechada');
begin
  perform interno.aberta('comunidade');
  if not interno.rede2_membro(v) then perform interno.erro('consentimento'); end if;
  select * into k from rede_ato_caronas where id = p_carona;
  if not found then perform interno.erro('nao_encontrado'); end if;
  p := interno.rede_ato_achar(k.ato, v);
  if p.oculto or p.retido or p.apagado_em is not null then perform interno.erro('nao_encontrado'); end if;
  select * into ch from rede_chamados where post = k.ato;
  if ch.situacao = 'cancelado' then perform interno.erro('ato_cancelado'); end if;
  if ch.inicio < now() - interval '6 hours' then perform interno.erro('ato_passou'); end if;
  perform interno.limite('rede_dm_carona', 30, 1440);
  if k.quem = v then return fechada; end if;
  select * into f from perfis where id = k.quem;
  if not found or f.rede_handle is null or not interno.rede2_membro(f.id) or interno.rede_bloqueado(v, f.id)
     or f.rede_invisivel or f.rede_modo = 'invisivel' then
    return fechada;
  end if;
  return jsonb_build_object('codinome', f.rede_handle);
end $$;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on function public.rede_cofre_ler(text), public.rede_cofre_gravar(text, integer, bytea), public.rede_cofre_apagar(text),
      public.rede_carona_contato(uuid) from public, anon;
    grant execute on function public.rede_cofre_ler(text), public.rede_cofre_gravar(text, integer, bytea), public.rede_cofre_apagar(text),
      public.rede_carona_contato(uuid) to authenticated;
  end if;
end $$;

-- ── 4. As funções que liam o chat velho ───────────────────────────────────────────────────────────────────────────────────
-- "Meus dados": o arquivo cifrado da conta não sai inteiro na lista automática (são megabytes que só o aparelho abre); sai em
-- rede_meusdados_mais, com o tipo, a versão, o dia e o tamanho.
create or replace function public.conta_meus_dados() returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); v_saida jsonb; v_dados jsonb; r record;
begin
  perform interno.limite('meus_dados', 3, 60);
  v_saida := jsonb_build_object(
    'gerado_em', now(),
    'conta', jsonb_build_object('id', v, 'email', interno.email_da_conta(v)),
    'perfil', (select interno.alumia_md_sem_terceiros(to_jsonb(p) - 'avatar', v) from perfis p where p.id = v));
  for r in
    select c.table_name, c.column_name from information_schema.columns c
    where c.table_schema = 'interno' and c.data_type = 'uuid' and c.column_name in ('autor', 'usuario', 'quem', 'para', 'criado_por', 'pessoa', 'responsavel')
      and c.table_name not in ('codigos_recuperacao', 'limites', 'perfis', 'alumia_apagamentos', 'alumia_apagamento_escondidos', 'rede_cofres_da_conta')
      -- A pessoa como alvo da ação de outra: a linha é de quem agiu.
      and (c.table_name, c.column_name) not in (('rede_silenciados', 'pessoa'), ('rede_bloqueio_lista', 'pessoa'),
        ('agradecimentos', 'para'), ('amizades', 'para'), ('departamento_pedidos', 'para'), ('rede_story_mencao_aviso', 'para'))
    order by c.table_name, c.column_name
  loop
    execute format(
      'select coalesce(jsonb_agg(interno.alumia_md_sem_terceiros(to_jsonb(t), $1)), ''[]''::jsonb) from (select * from interno.%I where %I = $1 limit 1000) t',
      r.table_name, r.column_name) into v_dados using v;
    if v_dados <> '[]'::jsonb then v_saida := v_saida || jsonb_build_object(r.table_name || '.' || r.column_name, v_dados); end if;
  end loop;
  perform interno.registrar('meus_dados_baixados', v::text, '{}'::jsonb);
  return v_saida;
end $$;

-- O emblema de "conversas" é contado no aparelho (o servidor não sabe quais conversas a pessoa tem): aqui fica sempre 0.
create or replace function public.rede_alumia_emblemas() returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := auth.uid(); v_avisos integer := 0; v_atos integer := 0;
begin
  if v is null or not interno.rede2_membro(v) or exists (select 1 from perfis where id = v and suspenso) then
    return jsonb_build_object('avisos', 0, 'conversas', 0, 'atos', 0);
  end if;
  perform interno.limite('rede_avisos_n', 600, 60);
  v_avisos := (select count(*)::integer from interno.rede3_aviso_grupos(v) g where not g.lido);
  begin
    v_atos := (select count(*)::integer from rede_vou o join rede_posts p on p.id = o.post
      where o.usuario = v and p.chamado is not null and p.apagado_em is null and not p.oculto
        and (p.chamado ->> 'quando') ~ '^\d{4}-\d{2}-\d{2}' and (p.chamado ->> 'quando')::timestamptz > now());
  exception when others then
    v_atos := 0;
  end;
  return jsonb_build_object('avisos', v_avisos, 'conversas', 0, 'atos', v_atos);
end $$;

-- "Meus dados" (as partes à mão): as preferências do chat moram no aparelho; do servidor sai só o que há de arquivo cifrado.
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
      select r.criado_em, r.responder_ate, r.situacao, r.decidido_em from alumia_lei_retencoes r where r.usuario = $1 order by r.criado_em $q$, v));
end $$;

select interno.alumia_trancar();
