-- ───────────────────────────── Alumia: meus dados (exportar e apagar a conta), onda 8, frente 8C ─────────────────────────────
-- Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
--
-- Os dois direitos da LGPD (art. 18, II e VI) dentro da Alumia, com a mesma regra da casa: nada de terceiro sai na cópia e nada da
-- pessoa fica para trás quando ela vai embora.
--
--   Exportar   public.rede_meusdados_exportar(): tudo o que a pessoa escreveu e configurou na Alumia, num jsonb que o servidor do
--              site (app/api/rede/exportar) embrulha num .zip com um índice em HTML e os arquivos de mídia dela. Pede o segundo
--              fator confirmado nos últimos 10 minutos e vale uma vez por dia. De outras pessoas, só números, e só a partir de 3
--              (o mesmo piso das curtidas, P18): quem curtiu, quem seguiu, quem respondeu, quem silenciou nunca aparece.
--   Apagar     public.rede_meusdados_apagar(palavra): com o segundo fator dos últimos 10 minutos e o @ escrito igual. A conta some
--              da rede na hora (perfil invisível, posts e stories fora do ar, o Fediverso desligado, nada novo sai dela) e é
--              apagada de vez 7 dias depois, pelo agendador do banco (interno.alumia_md_rodada, pg_cron de hora em hora).
--              public.rede_meusdados_cancelar() desfaz dentro do prazo.
--   De vez     interno.alumia_md_apagar_de_vez(conta): os posts saem; o que outras pessoas responderam ou citaram fica como
--              "[post apagado]" (sem autora, sem texto, sem mídia), para a conversa delas não sumir junto. As mídias vão para a
--              fila de arquivos (interno.alumia_arquivos_a_apagar) que o servidor do site esvazia pela API do depósito
--              (app/api/rede/exportar/faxina); o banco não apaga arquivo direto. Saem também a chave da federação, os limites, o
--              que a conta registrou na auditoria e, por fim, o perfil e a conta (o resto cai em cascata).
--   Painel     public.alumia_painel_apagamentos(): para a coordenação e o admin, só quantos pedidos estão no prazo e quando
--              vencem (por dia). Nenhum nome, nenhum conteúdo.
--   P18        public.conta_meus_dados (o "baixar meus dados" do site inteiro) deixa de levar dado de terceiro: as linhas em que a
--              pessoa é o ALVO da ação de outra (quem a silenciou, quem a pôs numa lista de bloqueio, o embrulho de quem lhe
--              escreveu, o agradecimento e o pedido de amizade de outra pessoa) e, de cada linha, toda coluna com o id de outra
--              conta (ou a lista de quem viu) e as que dizem quem agiu (ator, cuida, por, ..._por, de, revisou).
--
-- Fica no registro, de propósito: o registro de moderação (interno.rede_moderacao) e o do painel (interno.alumia_painel_registro)
-- são só de inserção e não se apagam (são a prova do processo). Quem tem função no Instituto (papel ou admin da Alumia) não apaga
-- por aqui: pede à coordenação.
--
-- Tabelas em interno, RLS ligada e sem política, nenhuma permissão direta. Pode rodar mais de uma vez, sem apagar dado nenhum.
-- Roda DEPOIS de 20261113-alumia-o7-pedidos.sql e de 20261113-alumia-o7-painel.sql. Teste: npm run testar:alumia-o8-meusdados.

-- 1. Tabelas ────────────────────────────────────────────────────────────────────────────────────────────────────────────────

-- O pedido de apagamento: um por conta, enquanto corre o prazo de arrependimento. Some junto com a conta.
create table if not exists interno.alumia_apagamentos (
  usuario uuid primary key references interno.perfis (id) on delete cascade,
  pedido_em timestamptz not null default now(),
  apagar_em timestamptz not null,
  -- Como o perfil estava antes (o cancelar devolve).
  estava_invisivel boolean not null default false
);
create index if not exists alumia_apagamentos_prazo on interno.alumia_apagamentos (apagar_em);

-- O que o pedido tirou do ar (para o cancelar devolver só isso, e não o que a moderação tirou).
create table if not exists interno.alumia_apagamento_escondidos (
  usuario uuid not null references interno.alumia_apagamentos (usuario) on delete cascade,
  tipo text not null check (tipo in ('post', 'story')),
  alvo uuid not null,
  primary key (usuario, tipo, alvo)
);

-- Os arquivos que o servidor do site apaga do depósito (o banco não apaga arquivo: só a API do depósito apaga de verdade). Sem
-- ligação com a conta além do próprio caminho, e a linha sai quando o arquivo sai.
create table if not exists interno.alumia_arquivos_a_apagar (
  id bigint generated always as identity primary key,
  deposito text not null check (deposito in ('rede-midia', 'rede-stories')),
  caminho text not null check (caminho ~ '^[0-9a-f-]{36}/[A-Za-z0-9._-]{1,120}$'),
  desde timestamptz not null default now(),
  tentativas smallint not null default 0,
  unique (deposito, caminho)
);

do $$
declare t text;
begin
  foreach t in array array['alumia_apagamentos', 'alumia_apagamento_escondidos', 'alumia_arquivos_a_apagar'] loop
    execute format('alter table interno.%I enable row level security', t);
    execute format('revoke all on table interno.%I from public', t);
    if exists (select 1 from pg_roles where rolname = 'anon') then
      execute format('revoke all on table interno.%I from anon, authenticated', t);
    end if;
  end loop;
end $$;

-- 2. Ajudas ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────

/**
 * A sessão confirmou o código do aplicativo autenticador há pouco? O token do serviço de contas traz, em "amr", cada método com a
 * hora em que foi usado; depois de mfa.challengeAndVerify a sessão é renovada com o "totp" de agora. Sessão aal2 antiga não basta.
 */
create or replace function interno.alumia_md_fator_recente(p_minutos integer default 10) returns boolean language sql stable as $$
  select interno.aal2() and exists (
    select 1 from jsonb_array_elements(case when jsonb_typeof(interno.claims() -> 'amr') = 'array' then interno.claims() -> 'amr' else '[]'::jsonb end) e
    where jsonb_typeof(e) = 'object' and e ->> 'method' in ('totp', 'mfa/totp')
      and coalesce(e ->> 'timestamp', '') ~ '^[0-9]{9,11}$'
      and to_timestamp((e ->> 'timestamp')::bigint) between now() - make_interval(mins => greatest(1, least(coalesce(p_minutos, 10), 60))) and now() + interval '2 minutes')
$$;

/** A palavra que confirma o apagamento: o @ da pessoa (ou APAGAR, para quem ainda não escolheu um). */
create or replace function interno.alumia_md_palavra(p_usuario uuid) returns text language sql stable security definer set search_path = interno, pg_temp as $$
  select coalesce((select '@' || f.rede_handle from perfis f where f.id = p_usuario and coalesce(f.rede_handle, '') <> ''), 'APAGAR')
$$;

/** Tem função na casa (papel do Instituto ou admin da Alumia)? Então o apagamento é com a coordenação. */
create or replace function interno.alumia_md_tem_funcao(p_usuario uuid) returns boolean language sql stable security definer set search_path = interno, pg_temp as $$
  select exists (select 1 from papeis where usuario = p_usuario)
      or (to_regclass('interno.alumia_painel_admin') is not null and exists (select 1 from alumia_painel_admin where usuario = p_usuario))
$$;

/**
 * Uma parte da cópia: roda a consulta (com $1 = a conta) e devolve as linhas num jsonb. Se a tabela ainda não existe neste banco
 * (o de produção não tem tudo o que o install.sql tem), a parte vem vazia em vez de derrubar a cópia inteira.
 */
create or replace function interno.alumia_md_parte(p_sql text, p_usuario uuid) returns jsonb language plpgsql stable security definer set search_path = interno, pg_temp as $$
declare v jsonb;
begin
  execute format('select coalesce(jsonb_agg(to_jsonb(x)), ''[]''::jsonb) from (%s) x', p_sql) into v using p_usuario;
  return v;
exception when undefined_table or undefined_column then
  return '[]'::jsonb;
end $$;

/**
 * Uma linha da cópia sem nada que aponte para outra pessoa: sai toda coluna cujo valor é o id de outra conta (ou uma lista que tenha
 * o id de outra conta, como "visto_por"), toda coluna que diz quem agiu ("por", "..._por", "de", "ator"...) e o resumo de origem de
 * rede. A regra é pelo VALOR, não pelo nome: coluna nova com o id de alguém também fica de fora sem precisar entrar numa lista.
 */
create or replace function interno.alumia_md_sem_terceiros(p jsonb, p_usuario uuid) returns jsonb language sql stable security definer set search_path = interno, pg_temp as $$
  select coalesce(jsonb_object_agg(e.k, e.v), '{}'::jsonb)
  from jsonb_each(coalesce(p, '{}'::jsonb)) e (k, v)
  where not (
       e.k = 'por' or e.k like '%\_por' or e.k in ('de', 'ator', 'ator_remoto', 'atores_remotos', 'cuida', 'revisou')
    or (e.k like '%origem' and coalesce(e.v #>> '{}', '') ~ '^[0-9a-f]{32,64}$')
    or (jsonb_typeof(e.v) = 'string' and e.v #>> '{}' ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
        and (e.v #>> '{}')::uuid is distinct from p_usuario and exists (select 1 from perfis f where f.id = (e.v #>> '{}')::uuid))
    or (jsonb_typeof(e.v) = 'array' and exists (
          select 1 from jsonb_array_elements(e.v) x
          where jsonb_typeof(x) = 'string' and x #>> '{}' ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
            and (x #>> '{}')::uuid is distinct from p_usuario and exists (select 1 from perfis f where f.id = (x #>> '{}')::uuid))))
$$;

/** Um número de outras pessoas, com o piso de 3: abaixo disso, nulo ("menos de 3"). */
create or replace function interno.alumia_md_piso(p_n bigint) returns integer language sql immutable as $$
  select case when p_n >= 3 then p_n::integer end
$$;

-- 3. Nada novo sai de uma conta que pediu para ser apagada ───────────────────────────────────────────────────────────────────

/** Gatilho: post, story ou "seguir" de quem está no prazo de apagamento é recusado ("conta_apagando"). tg_argv[0] = a coluna. */
create or replace function interno.alumia_md_trava() returns trigger language plpgsql security definer set search_path = interno, pg_temp as $$
declare v_quem text := to_jsonb(new) ->> tg_argv[0];
begin
  if v_quem is not null and exists (select 1 from alumia_apagamentos a where a.usuario::text = v_quem) then
    perform interno.erro('conta_apagando');
  end if;
  return new;
end $$;

drop trigger if exists alumia_md_trava on interno.rede_posts;
create trigger alumia_md_trava before insert on interno.rede_posts for each row execute function interno.alumia_md_trava('autor');
do $$
begin
  if to_regclass('interno.rede_stories') is not null then
    execute 'drop trigger if exists alumia_md_trava on interno.rede_stories';
    execute 'create trigger alumia_md_trava before insert on interno.rede_stories for each row execute function interno.alumia_md_trava(''autor'')';
  end if;
end $$;
drop trigger if exists alumia_md_trava on interno.rede_seguindo;
create trigger alumia_md_trava before insert on interno.rede_seguindo for each row execute function interno.alumia_md_trava('quem');

-- 4. A situação (o que a tela mostra) ─────────────────────────────────────────────────────────────────────────────────────────

/**
 * O que a tela "Meus dados" precisa: a palavra de confirmação, se a pessoa tem função na casa, se já baixou a cópia de hoje, se o
 * segundo fator está fresco e, se houver, o pedido de apagamento em curso (quando foi feito e quando vence).
 */
create or replace function public.rede_meusdados_situacao() returns jsonb language plpgsql stable security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); a alumia_apagamentos;
begin
  select * into a from alumia_apagamentos where usuario = v;
  return jsonb_build_object(
    'palavra', interno.alumia_md_palavra(v),
    'tem_funcao', interno.alumia_md_tem_funcao(v),
    'fator_recente', interno.alumia_md_fator_recente(),
    'exportou_hoje', exists (select 1 from limites l where l.chave = 'rede_meusdados_exportar:' || v::text
                               and l.janela = to_timestamp(floor(extract(epoch from now()) / 86400) * 86400) and l.total >= 1),
    'apagamento', case when a.usuario is null then null else jsonb_build_object('pedido_em', a.pedido_em, 'apagar_em', a.apagar_em) end);
end $$;

-- 5. Exportar ───────────────────────────────────────────────────────────────────────────────────────────────────────────────

/**
 * A cópia dos dados da pessoa na Alumia. Só o que é dela: o que escreveu, o que configurou, o que escolheu seguir, guardar ou
 * silenciar. De outras pessoas, só números com o piso de 3 (respostas, apoios, reações, seguidores, assinaturas). Os avisos vêm sem
 * o texto e sem quem agiu (o texto do aviso costuma levar o nome de quem curtiu ou seguiu); os da moderação e da conta vêm inteiros.
 * As conversas do chat privado não entram: o servidor guarda só o texto cifrado. `midias` lista os arquivos que o servidor do site
 * põe no .zip (só os da própria pasta da pessoa). Segundo fator dos últimos 10 minutos; uma por dia.
 */
create or replace function public.rede_meusdados_exportar() returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); v_saida jsonb;
begin
  if not interno.alumia_md_fator_recente() then perform interno.erro('confirme_segundo_fator'); end if;
  perform interno.limite('rede_meusdados_exportar', 1, 1440);
  v_saida := jsonb_build_object(
    'formato', 'alumia-meus-dados/1',
    'gerado_em', now(),
    'conta', jsonb_build_object('email', interno.email_da_conta(v), 'criada_em', (select criado_em from perfis where id = v)),
    'perfil', coalesce((select jsonb_build_object(
        'codinome', f.rede_codinome, 'arroba', f.rede_handle, 'bio', f.rede_bio, 'pronomes', f.rede_pronomes,
        'identidade', f.rede_identidade, 'modo', f.rede_modo, 'invisivel', f.rede_invisivel,
        'status', jsonb_build_object('tipo', f.rede_status_tipo, 'texto', f.rede_status_texto, 'ate', f.rede_status_ate),
        'estudando', f.rede_estudando, 'aparencia', f.rede_aparencia, 'selos', f.rede_selos, 'mostrar_selos', f.rede_selos_mostrar,
        'avatar', f.rede_avatar, 'avatar_desenho', f.rede_avatar_dados, 'capa', f.rede_capa, 'capa_desenho', f.rede_capa_dados,
        'foto_publica', nullif(f.foto_publica, ''), 'post_fixado', f.rede_fixado, '18_anos', f.rede_18)
      from perfis f where f.id = v), '{}'::jsonb),
    'campos_do_perfil', interno.alumia_md_parte('select ordem, rotulo, valor from rede_perfil_campos where usuario = $1 order by ordem', v),
    'consentimentos', interno.alumia_md_parte('select versao, criado_em, revogado_em, fediverso from rede_consentimentos where usuario = $1 order by criado_em', v),
    'entrada', interno.alumia_md_parte('select situacao, origem, motivo_pedido, pedido_em, decidido_em, motivo_decisao from alumia_entrada where usuario = $1', v),
    'posts', interno.alumia_md_parte($q$
      select x.id, x.tipo, x.titulo, x.texto, x.corpo, x.comunidade, coalesce(x.publico, x.alcance) as publico, x.resposta_a,
             x.quote_of as citando, x.repost_de as repostando, x.aviso, x.flair, x.posicao, x.criado_em, x.editado_em, x.apagado_em,
             (x.oculto or x.retido) as fora_do_ar,
             interno.alumia_md_piso((select count(*) from rede_posts r where r.resposta_a = x.id and r.autor is distinct from $1)) as respostas_de_outras_pessoas,
             interno.alumia_md_piso((select count(*) from rede_apoios a where a.post = x.id and a.usuario <> $1)) as apoios,
             interno.alumia_md_piso((select count(*) from rede_reacoes r where r.post = x.id and r.usuario <> $1)
                                  + (select count(*) from rede_reacoes_emoji r where r.post = x.id and r.usuario <> $1)) as reacoes,
             (select coalesce(jsonb_agg(jsonb_build_object('arquivo', m.caminho, 'tipo', m.tipo, 'descricao', m.alt) order by m.ordem), '[]'::jsonb)
                from rede_midia m where m.post = x.id) as midias,
             (select coalesce(jsonb_agg(jsonb_build_object('arquivo', a.caminho, 'tipo', a.tipo, 'segundos', a.duracao)), '[]'::jsonb)
                from rede_audios a where a.post = x.id) as audios,
             (select coalesce(jsonb_agg(jsonb_build_object('texto', e.texto_anterior, 'em', e.criado_em) order by e.criado_em), '[]'::jsonb)
                from rede_post_edicoes e where e.post = x.id) as versoes_anteriores,
             (select to_jsonb(c) - 'post' - 'lembrete_24h_em' - 'lembrete_2h_em' from rede_chamados c where c.post = x.id) as ato
      from rede_posts x where x.autor = $1 order by x.criado_em limit 50000 $q$, v),
    'rascunhos', interno.alumia_md_parte('select pedido, atualizado_em from rede_rascunhos where autor = $1 order by atualizado_em', v),
    'agendados', interno.alumia_md_parte('select pedido, quando, estado, repetir, repetir_ate, criado_em from rede_agendados where autor = $1 order by quando', v),
    'stories', interno.alumia_md_parte($q$
      select s.id, s.publico, s.texto, s.legenda, s.legendas, s.fundo, s.cor, s.estilo, s.musica, s.alt as descricao, s.midia_caminho as arquivo,
             s.post_ref as post, s.comunidade, s.criado_em, s.expira_em
      from rede_stories s where s.autor = $1 order by s.criado_em $q$, v),
    'destaques_de_stories', interno.alumia_md_parte($q$
      select d.titulo, d.cor, d.ordem, d.criado_em,
             (select coalesce(jsonb_agg(n.story order by n.ordem), '[]'::jsonb) from rede_story_no_destaque n where n.destaque = d.id) as stories
      from rede_story_destaques d where d.autor = $1 order by d.ordem $q$, v),
    'respostas_a_stories', interno.alumia_md_parte('select story, texto, pergunta, criado_em from rede_story_respostas where quem = $1 order by criado_em', v),
    'notas_da_comunidade', interno.alumia_md_parte('select post, texto, fonte, situacao, criado_em from rede_alumia_notas where autora = $1 order by criado_em', v),
    'perguntas_que_fiz', interno.alumia_md_parte('select texto, anonima, situacao, criado_em, respondida_em is not null as respondida from rede_alumia_perguntas where quem = $1 order by criado_em', v),
    'minhas_caixas_de_perguntas', interno.alumia_md_parte($q$
      select c.comunidade, c.chamada, c.aberta, c.anonimas, c.criado_em,
             interno.alumia_md_piso((select count(*) from rede_alumia_perguntas p where p.caixa = c.id)) as perguntas_recebidas
      from rede_alumia_caixas c where c.dono = $1 order by c.criado_em $q$, v))
  -- (em partes: uma chamada de função leva no máximo 100 argumentos)
  || jsonb_build_object(
    'seguindo', interno.alumia_md_parte($q$
      select coalesce('@' || f.rede_handle, interno.rede_nome(s.segue)) as quem, s.pendente as esperando_aceite, s.criado_em
      from rede_seguindo s join perfis f on f.id = s.segue where s.quem = $1 order by s.criado_em $q$, v),
    'seguidores', jsonb_build_object('quantos', interno.alumia_md_piso((select count(*) from rede_seguindo s where s.segue = v and not s.pendente))),
    'comunidades', interno.alumia_md_parte('select comunidade, papel, situacao, entrou_em from rede_comunidade_membros where usuario = $1 order by entrou_em', v),
    'comunidades_seguidas', interno.alumia_md_parte('select comunidade from rede_comunidades_seguidas where usuario = $1 order by comunidade', v),
    'nucleos', interno.alumia_md_parte('select n.nome, n.cidade, m.papel, m.entrou_em from rede_nucleo_membros m join rede_nucleos n on n.id = m.nucleo where m.usuario = $1 order by m.entrou_em', v),
    'espacos_fechados', interno.alumia_md_parte('select espaco, entrou_em from rede_espaco_membros where usuario = $1 order by entrou_em', v),
    'organizacoes_que_ajudo_a_gerir', interno.alumia_md_parte('select coalesce(''@'' || f.rede_handle, '''') as organizacao, g.papel, g.desde from rede_org_gestores g join perfis f on f.id = g.org where g.gestor = $1', v),
    'mandatos', interno.alumia_md_parte('select funcao, inicio, fim, origem, aceito, encerrado_dia from rede_org_mandatos where pessoa = $1 order by inicio', v),
    'salvos', interno.alumia_md_parte('select post, criado_em from rede_salvos where usuario = $1 order by criado_em', v),
    'pastas', interno.alumia_md_parte($q$
      select p.nome, p.criado_em, (select coalesce(jsonb_agg(i.post order by i.criado_em), '[]'::jsonb) from rede_alumia_pasta_itens i where i.pasta = p.id) as posts
      from rede_alumia_pastas p where p.usuario = $1 order by p.criado_em $q$, v),
    'lembretes', interno.alumia_md_parte('select post, quando from rede_alumia_lembretes where usuario = $1 order by quando', v),
    'conversas_que_sigo', interno.alumia_md_parte('select raiz as post, criado_em from rede_alumia_seguir_conversa where usuario = $1 order by criado_em', v),
    'temas_que_sigo', interno.alumia_md_parte('select tag, criado_em from rede_alumia_seguir_tag where usuario = $1 order by criado_em', v),
    'buscas_salvas', interno.alumia_md_parte('select nome, q as busca, criado_em from rede_alumia_buscas_salvas where usuario = $1 order by criado_em', v),
    'interesses', interno.alumia_md_parte('select tipo, chave, criado_em from rede_desc_interesses where usuario = $1 order by criado_em', v),
    'repostagens', interno.alumia_md_parte('select post, criado_em from rede_repostagens where quem = $1 order by criado_em', v),
    'apoios_que_dei', interno.alumia_md_parte('select post from rede_apoios where usuario = $1', v),
    'reacoes_que_dei', interno.alumia_md_parte($q$
      select post, tipo as reacao, criado_em from rede_reacoes where usuario = $1
      union all select post, emoji, criado_em from rede_reacoes_emoji where usuario = $1 order by 3 $q$, v),
    'atos_que_vou', interno.alumia_md_parte('select post as ato, criado_em from rede_vou where usuario = $1 order by criado_em', v),
    'caronas', interno.alumia_md_parte('select ato, tipo, meio, saida_publica as saida, vagas, sai_em, criado_em from rede_ato_caronas where quem = $1 order by criado_em', v),
    'peticoes_que_assinei', interno.alumia_md_parte('select peticao, criado_em from rede_peticao_assinaturas where usuario = $1 order by criado_em', v),
    'minhas_peticoes', interno.alumia_md_parte($q$
      select pe.post, pe.alvo, pe.texto, pe.prazo, pe.encerrada,
             interno.alumia_md_piso((select count(*) from rede_peticao_assinaturas a where a.peticao = pe.id)) as assinaturas
      from rede_peticoes pe join rede_posts x on x.id = pe.post where x.autor = $1 order by pe.criada_em $q$, v),
    'consultas_em_que_votei', interno.alumia_md_parte('select consulta from rede_consulta_votantes where usuario = $1', v))
  || jsonb_build_object(
    'correntes', interno.alumia_md_parte('select texto, cidade, meta, quando, criada_em, expira_em from rede_correntes where autor = $1 order by criada_em', v),
    'bloqueei', interno.alumia_md_parte($q$
      select coalesce('@' || f.rede_handle, interno.rede_nome(b.bloqueado)) as quem, b.criado_em
      from rede_bloqueios b join perfis f on f.id = b.bloqueado where b.quem = $1 order by b.criado_em $q$, v),
    'silenciei', interno.alumia_md_parte($q$
      select case when s.pessoa is not null then coalesce('@' || f.rede_handle, interno.rede_nome(s.pessoa)) end as pessoa, s.comunidade, s.palavra, s.conversa, s.ate, s.criado_em
      from rede_silenciados s left join perfis f on f.id = s.pessoa where s.usuario = $1 order by s.criado_em $q$, v),
    'minha_roda', interno.alumia_md_parte($q$
      select coalesce('@' || f.rede_handle, interno.rede_nome(r.membro)) as quem, r.criado_em
      from rede_roda r join perfis f on f.id = r.membro where r.dono = $1 order by r.criado_em $q$, v),
    'preferencias_de_avisos', interno.alumia_md_parte('select tipo, canal, ligado from rede_avisos_prefs where usuario = $1 order by tipo, canal', v),
    'aparelhos_com_push', jsonb_build_object('quantos', (select count(*) from rede_push_assinaturas where usuario = v)),
    'avisos', interno.alumia_md_parte($q$
      select a.tipo, a.categoria, a.post, a.lido, a.criado_em,
             case when a.categoria = 'conta' or a.tipo = 'moderacao' then a.texto end as texto
      from avisos a where a.para = $1 and a.categoria in ('rede', 'conta') order by a.criado_em desc limit 2000 $q$, v),
    'decisoes_da_moderacao_sobre_mim', interno.alumia_md_parte($q$
      select m.acao, m.alvo_tipo, m.alvo, m.regra, m.motivo, m.criado_em from rede_moderacao m
      where (m.alvo_tipo in ('pessoa', 'usuario') and m.alvo = $1::text)
         or (m.alvo_tipo = 'post' and m.alvo in (select x.id::text from rede_posts x where x.autor = $1))
      order by m.criado_em $q$, v),
    'sancoes', interno.alumia_md_parte('select tipo, motivo, criado_em, ate, encerrada_em from alumia_sancoes where usuario = $1 order by criado_em', v),
    'denuncias_que_fiz', interno.alumia_md_parte('select protocolo, alvo_tipo, alvo, categoria, texto, situacao, criado_em from rede_denuncias where quem = $1 order by criado_em', v),
    'recursos_que_fiz', interno.alumia_md_parte('select acao as decisao, texto, situacao, criado_em, decidido_em from rede_recursos where autor = $1 order by criado_em', v),
    'perguntas_em_plenarias', interno.alumia_md_parte('select plenaria, texto, mostrar, criado_em, respondida_em from rede_plenaria_perguntas where autor = $1 order by criado_em', v),
    'fediverso', coalesce((select jsonb_build_object('ligado', a.ligado, 'desde', a.ligado_em, 'arroba', a.handle,
        'seguidores_de_fora', interno.alumia_md_piso((select count(*) from rede_fed_seguidores s where s.perfil = v)),
        'contas_de_fora_que_sigo', (select coalesce(jsonb_agg(s.ator order by s.criado_em), '[]'::jsonb) from rede_fed_seguindo s where s.perfil = v))
      from rede_fed_atores a where a.perfil = v), 'null'::jsonb),
    'conversas_privadas', 'As conversas do chat privado não entram nesta cópia: o servidor guarda só o texto cifrado, que só os aparelhos de quem conversa conseguem abrir.',
    'midias', interno.alumia_md_parte($q$
      select 'rede-midia' as deposito, m.caminho from rede_midia m join rede_posts x on x.id = m.post where x.autor = $1 and m.caminho like $1::text || '/%'
      union select 'rede-midia', a.caminho from rede_audios a join rede_posts x on x.id = a.post where x.autor = $1 and a.caminho like $1::text || '/%'
      union select 'rede-stories', s.midia_caminho from rede_stories s where s.autor = $1 and s.midia_caminho like $1::text || '/%'
      order by 1, 2 limit 5000 $q$, v));
  return v_saida;
end $$;

-- 6. Apagar (com prazo de arrependimento) ───────────────────────────────────────────────────────────────────────────────────

/**
 * Pede o apagamento da conta. Segundo fator dos últimos 10 minutos e a palavra (o @) escrita igual. Na hora: o perfil fica
 * invisível, os posts e os stories saem do ar (anotados, para o cancelar devolver), a federação desliga (o Fediverso recebe a
 * retirada de cada post que saiu) e nada novo sai da conta. Em 7 dias, o agendador apaga de vez. Pedir de novo devolve o mesmo prazo.
 */
create or replace function public.rede_meusdados_apagar(p_palavra text) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); a alumia_apagamentos; v_invisivel boolean;
begin
  perform interno.limite('rede_meusdados_apagar', 6, 60);
  if not interno.alumia_md_fator_recente() then perform interno.erro('confirme_segundo_fator'); end if;
  if interno.alumia_md_tem_funcao(v) then perform interno.erro('tem_funcao'); end if;
  if lower(btrim(coalesce(p_palavra, ''))) is distinct from lower(interno.alumia_md_palavra(v)) then perform interno.erro('confirmacao_errada'); end if;
  select * into a from alumia_apagamentos where usuario = v;
  if found then return jsonb_build_object('pedido_em', a.pedido_em, 'apagar_em', a.apagar_em); end if;

  select coalesce(rede_invisivel, false) into v_invisivel from perfis where id = v;
  insert into alumia_apagamentos (usuario, apagar_em, estava_invisivel) values (v, now() + interval '7 days', v_invisivel) returning * into a;

  insert into alumia_apagamento_escondidos (usuario, tipo, alvo)
  select v, 'post', x.id from rede_posts x where x.autor = v and not x.oculto on conflict do nothing;
  update rede_posts x set oculto = true from alumia_apagamento_escondidos e where e.usuario = v and e.tipo = 'post' and e.alvo = x.id and not x.oculto;

  insert into alumia_apagamento_escondidos (usuario, tipo, alvo)
  select v, 'story', s.id from rede_stories s where s.autor = v and not s.retido on conflict do nothing;
  update rede_stories s set retido = true from alumia_apagamento_escondidos e where e.usuario = v and e.tipo = 'story' and e.alvo = s.id and not s.retido;

  update perfis set rede_invisivel = true where id = v;
  if to_regprocedure('interno.rede_fed_desligar(uuid)') is not null then perform interno.rede_fed_desligar(v); end if;
  return jsonb_build_object('pedido_em', a.pedido_em, 'apagar_em', a.apagar_em);
end $$;

/**
 * Desiste do apagamento, dentro do prazo. Volta ao ar o que o pedido tirou (menos o que a moderação decidiu depois do pedido) e o
 * perfil volta a ser como era. A federação fica desligada: quem quiser liga de novo em Fediverso (`fediverso_desligado`).
 */
create or replace function public.rede_meusdados_cancelar() returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); a alumia_apagamentos; v_fed boolean;
begin
  perform interno.limite('rede_meusdados_cancelar', 10, 60);
  select * into a from alumia_apagamentos where usuario = v for update;
  if not found then return jsonb_build_object('ok', true, 'havia', false); end if;
  if a.apagar_em <= now() then perform interno.erro('prazo_passou'); end if;

  update rede_posts x set oculto = false
  from alumia_apagamento_escondidos e
  where e.usuario = v and e.tipo = 'post' and e.alvo = x.id and x.autor = v and x.oculto
    and not exists (select 1 from rede_moderacao m where m.alvo = x.id::text and m.criado_em >= a.pedido_em)
    and (to_regclass('interno.alumia_painel_lixeira') is null or not exists (select 1 from alumia_painel_lixeira l where l.post = x.id and l.apagado_em >= a.pedido_em));
  update rede_stories s set retido = false
  from alumia_apagamento_escondidos e
  where e.usuario = v and e.tipo = 'story' and e.alvo = s.id and s.autor = v and s.retido
    and not exists (select 1 from rede_moderacao m where m.alvo = s.id::text and m.criado_em >= a.pedido_em);
  -- O pânico apertado durante o prazo (20261114-alumia-o8-conta.sql) continua valendo: o perfil só volta quando a pessoa mostrar.
  update perfis f set rede_invisivel = a.estava_invisivel or (to_jsonb(f) ->> 'rede_panico_em') is not null where f.id = v;
  delete from alumia_apagamentos where usuario = v;
  v_fed := exists (select 1 from rede_fed_atores f where f.perfil = v and not f.ligado);
  return jsonb_build_object('ok', true, 'havia', true, 'fediverso_desligado', v_fed);
end $$;

/**
 * Apaga a conta de vez (o agendador chama quando o prazo vence; não é chamada pela API). Devolve quantos posts saíram e quantos
 * ficaram como "[post apagado]" porque outras pessoas responderam ou citaram.
 */
create or replace function interno.alumia_md_apagar_de_vez(p_usuario uuid) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v_lapides uuid[]; v_lapides_n integer := 0; v_posts integer := 0; r record;
begin
  if p_usuario is null or not exists (select 1 from perfis where id = p_usuario) then return jsonb_build_object('apagada', false); end if;

  -- a) Os arquivos de mídia vão para a fila do servidor (o banco não apaga arquivo do depósito).
  insert into alumia_arquivos_a_apagar (deposito, caminho)
  select 'rede-midia', m.caminho from rede_midia m join rede_posts x on x.id = m.post where x.autor = p_usuario and m.caminho like p_usuario::text || '/%'
  union select 'rede-midia', a.caminho from rede_audios a join rede_posts x on x.id = a.post where x.autor = p_usuario and a.caminho like p_usuario::text || '/%'
  union select 'rede-stories', s.midia_caminho from rede_stories s where s.autor = p_usuario and s.midia_caminho like p_usuario::text || '/%'
  on conflict do nothing;
  -- E o que mais houver na pasta da pessoa nos dois depósitos (envio que não virou post, por exemplo).
  if to_regclass('storage.objects') is not null then
    begin
      execute 'insert into interno.alumia_arquivos_a_apagar (deposito, caminho)
               select o.bucket_id, o.name from storage.objects o
               where o.bucket_id in (''rede-midia'', ''rede-stories'') and o.name like $1 and o.name ~ ''^[0-9a-f-]{36}/[A-Za-z0-9._-]{1,120}$''
               on conflict do nothing' using p_usuario::text || '/%';
    exception when others then null;
    end;
  end if;

  -- b) Os posts que outras pessoas responderam (direto ou mais abaixo na conversa) ou citaram ficam como "[post apagado]", com os
  --    posts dela acima deles na conversa (apagar o de cima levaria o de baixo junto, em cascata).
  with recursive guardar as (
    select x.id, x.resposta_a from rede_posts x
    where x.autor = p_usuario and exists (
      select 1 from rede_posts o where o.autor is distinct from p_usuario and (o.resposta_a = x.id or o.root_id = x.id or o.quote_of = x.id))
    union
    select pai.id, pai.resposta_a from rede_posts pai join guardar g on pai.id = g.resposta_a where pai.autor = p_usuario
  )
  select coalesce(array_agg(distinct id), '{}') into v_lapides from guardar;
  if cardinality(v_lapides) > 0 then
    delete from rede_midia where post = any (v_lapides);
    delete from rede_audios where post = any (v_lapides);
    delete from rede_post_edicoes where post = any (v_lapides);
    for r in select unnest(array['rede_pub_extras', 'rede_b1_post', 'rede_rotulos']) as t loop
      if to_regclass('interno.' || r.t) is not null then execute format('delete from interno.%I where post = any ($1)', r.t) using v_lapides; end if;
    end loop;
    update rede_posts set autor = null, como = null, texto = '[post apagado]', titulo = null, corpo = null, aviso = '', cita = null,
      chamado = null, flair = null, posicao = null, motivo = '', resposta_a_remota = null, editado_em = null, fixado = false,
      oculto = true, retido = false, apagado_em = coalesce(apagado_em, now())
    where id = any (v_lapides);
    v_lapides_n := cardinality(v_lapides);
  end if;
  -- O resto sai de vez (a federação já recebeu a retirada quando o pedido tirou os posts do ar).
  delete from rede_posts where autor = p_usuario or como = p_usuario;
  get diagnostics v_posts = row_count;
  if to_regclass('interno.rede_stories') is not null then delete from rede_stories where autor = p_usuario or como = p_usuario; end if;

  -- c) O que tem a autora com "set null" e é só dela (o recurso que fez, a pergunta da plenária) sai em vez de ficar sem nome.
  delete from rede_recursos where autor = p_usuario;
  delete from rede_plenaria_perguntas where autor = p_usuario;

  -- d) O que não tem chave estrangeira para o perfil: a federação (chaves e fila), os limites, o que a conta gravou na auditoria
  --    e os registros soltos da conta.
  delete from rede_fed_fila where perfil = p_usuario;
  delete from rede_fed_atores where perfil = p_usuario;
  delete from limites where chave like '%:' || p_usuario::text;
  delete from auditoria where quem = p_usuario;
  for r in select * from (values ('convites_usos', 'usuario'), ('termos_aceites', 'usuario'), ('eixos_equipe_marcas', 'usuario'),
                                 ('vale_historico', 'usuario'), ('saude_registro', 'usuario')) as t (tabela, coluna) loop
    if to_regclass('interno.' || r.tabela) is not null then
      begin
        execute format('delete from interno.%I where %I = $1', r.tabela, r.coluna) using p_usuario;
      exception when others then null;
      end;
    end if;
  end loop;

  -- O registro de auditoria do serviço de contas não tem chave para a conta: as linhas dela (com o e-mail dentro) saem aqui.
  if to_regclass('auth.audit_log_entries') is not null then
    begin
      execute 'delete from auth.audit_log_entries where payload ->> ''actor_id'' = $1 or payload -> ''traits'' ->> ''user_id'' = $1' using p_usuario::text;
    exception when others then
      raise warning 'alumia_md_apagar_de_vez: o registro do serviço de contas não pôde ser limpo (%)', sqlstate;
    end;
  end if;

  -- e) O perfil e a conta. O resto (seguir, salvos, comunidades, chaves do chat, avisos, o próprio pedido) cai em cascata.
  delete from perfis where id = p_usuario;
  delete from auth.users where id = p_usuario;
  return jsonb_build_object('apagada', true, 'posts', v_posts, 'post_apagado', v_lapides_n);
end $$;

/**
 * A rodada do agendador: apaga de vez as contas cujo prazo venceu (até 20 por vez, cada uma por conta própria: uma que falhe não
 * segura as outras) e chama a faxina dos arquivos no servidor do site, se houver arquivo na fila e o pg_net estiver ligado.
 */
create or replace function interno.alumia_md_rodada() returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare r record; v_ok integer := 0; v_falhas integer := 0; v_url text; v_segredo text; v_chamou boolean := false;
begin
  for r in select usuario from alumia_apagamentos where apagar_em <= now() order by apagar_em limit 20 loop
    begin
      perform interno.alumia_md_apagar_de_vez(r.usuario);
      v_ok := v_ok + 1;
    exception when others then
      v_falhas := v_falhas + 1;
      raise warning 'alumia_md_rodada: uma conta não foi apagada nesta rodada (%)', sqlstate;
    end;
  end loop;
  if exists (select 1 from alumia_arquivos_a_apagar) and exists (select 1 from pg_extension where extname = 'pg_net') then
    v_url := coalesce(nullif((select valor ->> 'faxina' from configuracoes where chave = 'meus_dados'), ''), interno.endereco() || '/api/rede/exportar/faxina');
    v_segredo := coalesce((select valor ->> 'segredo' from configuracoes where chave = 'meus_dados'), '');
    if v_url ~ '^https://[a-z0-9.-]+(:[0-9]+)?/api/rede/exportar/faxina$' then
      begin
        execute 'select net.http_post(url := $1, body := ''{}''::jsonb, headers := $2, timeout_milliseconds := 60000)'
          using v_url, jsonb_build_object('Content-Type', 'application/json', 'x-lucia-segredo', v_segredo);
        v_chamou := true;
      exception when others then null;
      end;
    end if;
  end if;
  return jsonb_build_object('apagadas', v_ok, 'falhas', v_falhas, 'chamou_faxina', v_chamou);
end $$;

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule('alumia-meus-dados', '23 * * * *', 'select interno.alumia_md_rodada()');
  end if;
exception when others then null;
end $$;

-- 7. A fila de arquivos (só a chave de serviço: o servidor do site) ─────────────────────────────────────────────────────────────

/** Os próximos arquivos a apagar do depósito (até 500). */
create or replace function public.rede_meusdados_arquivos_lista(p_limite integer default 200) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
begin
  if not interno.servico() then perform interno.erro('sem_permissao'); end if;
  return coalesce((select jsonb_agg(jsonb_build_object('id', a.id, 'deposito', a.deposito, 'caminho', a.caminho) order by a.id)
                   from (select * from alumia_arquivos_a_apagar order by tentativas, id limit greatest(1, least(coalesce(p_limite, 200), 500))) a), '[]'::jsonb);
end $$;

/** O servidor apagou (`p_feitos`) ou não conseguiu (`p_falhas`). Depois de 20 tentativas a linha sai (o arquivo já não existe). */
create or replace function public.rede_meusdados_arquivos_feito(p_feitos bigint[], p_falhas bigint[] default '{}') returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v_f integer; v_x integer;
begin
  if not interno.servico() then perform interno.erro('sem_permissao'); end if;
  delete from alumia_arquivos_a_apagar where id = any (coalesce(p_feitos, '{}'));
  get diagnostics v_f = row_count;
  update alumia_arquivos_a_apagar set tentativas = tentativas + 1 where id = any (coalesce(p_falhas, '{}'));
  get diagnostics v_x = row_count;
  delete from alumia_arquivos_a_apagar where tentativas >= 20;
  return jsonb_build_object('apagados', v_f, 'falhas', v_x);
end $$;

-- 8. Painel: só número e prazo ─────────────────────────────────────────────────────────────────────────────────────────────────

/** Para a coordenação e o admin: quantos pedidos de apagamento estão no prazo e quantos vencem em cada dia. Sem nome, sem conteúdo. */
create or replace function public.alumia_painel_apagamentos() returns jsonb language plpgsql stable security definer set search_path = interno, pg_temp as $$
begin
  perform interno.alumia_painel_exige();
  return jsonb_build_object(
    'total', (select count(*) from alumia_apagamentos),
    'por_dia', coalesce((select jsonb_agg(jsonb_build_object('dia', d.dia, 'n', d.n) order by d.dia)
                         from (select (apagar_em at time zone 'America/Sao_Paulo')::date as dia, count(*)::integer as n from alumia_apagamentos group by 1) d), '[]'::jsonb),
    'arquivos_na_fila', (select count(*) from alumia_arquivos_a_apagar));
end $$;

-- 9. P18 estendido: o "baixar meus dados" do site sem dado de terceiro ────────────────────────────────────────────────────────

/**
 * A cópia dos dados da conta no site inteiro (painel → Minha conta). O que muda (P18 estendido): ficam de fora as linhas em que a
 * pessoa é o ALVO da ação de outra (quem a silenciou, quem a pôs numa lista de bloqueio de comunidade, o embrulho de chave de quem
 * lhe escreveu no chat, o agradecimento ou o pedido de amizade que outra pessoa mandou, o pedido de departamento, o aviso de menção
 * em story) e, de toda linha, tudo o que aponta para outra pessoa (interno.alumia_md_sem_terceiros: o id de outra conta em qualquer
 * coluna, a lista de quem viu, quem agiu). Os avisos de curtida e impulso de fora continuam sem o endereço de quem curtiu (o P18 de
 * 20261113-alumia-o7-pedidos.sql).
 */
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
      and c.table_name not in ('codigos_recuperacao', 'limites', 'perfis', 'alumia_apagamentos', 'alumia_apagamento_escondidos')
      -- A pessoa como alvo da ação de outra: a linha é de quem agiu.
      and (c.table_name, c.column_name) not in (('rede_silenciados', 'pessoa'), ('rede_bloqueio_lista', 'pessoa'), ('rede_dm_embrulhos', 'para'),
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

-- 10. Permissões ─────────────────────────────────────────────────────────────────────────────────────────────────────────────

do $$
declare r record;
begin
  -- As de dentro: ninguém chama pela API.
  for r in
    select p.oid::regprocedure as f from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'interno' and p.proname like 'alumia\_md\_%'
  loop
    execute format('revoke all on function %s from public', r.f);
    if exists (select 1 from pg_roles where rolname = 'anon') then execute format('revoke all on function %s from anon, authenticated', r.f); end if;
  end loop;
  -- As da tela: só conta logada (a porta da entrada entra abaixo). As da fila de arquivos: só a chave de serviço.
  for r in
    select p.oid::regprocedure as f, p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and (p.proname like 'rede\_meusdados\_%' or p.proname in ('alumia_painel_apagamentos', 'conta_meus_dados'))
  loop
    execute format('revoke all on function %s from public', r.f);
    if exists (select 1 from pg_roles where rolname = 'anon') then
      execute format('revoke all on function %s from anon, authenticated', r.f);
      if r.proname in ('rede_meusdados_arquivos_lista', 'rede_meusdados_arquivos_feito') then
        execute format('grant execute on function %s to service_role', r.f);
      else
        execute format('grant execute on function %s to authenticated, service_role', r.f);
      end if;
    end if;
  end loop;
end $$;

-- As funções novas passam pela porta da entrada, como toda função da rede (20261112-alumia-portas.sql).
select interno.alumia_trancar();
