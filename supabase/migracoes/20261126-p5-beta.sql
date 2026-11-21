-- ───────────────────────────── Prompt 5 (A21): zerar o beta, relatar um problema e o registro de erros da tela ─────────────────────────────
-- Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
--
-- Roda depois de 20261125-r3-fim.sql (banco na versão 16) e das migrações do Prompt 5 que vêm antes no install.sql; o
-- 20261126-p5-fim.sql vem por último. Pode rodar mais de uma vez, sem apagar dado nenhum (só cria tabelas e funções).
-- Teste: npm run testar:p5-beta.
--
-- O beta da Alumia NÃO tem banco separado: ela mora no mesmo banco do instituto. Por isso o "zerar o beta" é uma rotina da
-- coordenação, com confirmação dupla, que apaga SÓ o que é da Alumia:
--   1. ZERAR O BETA. Primeiro a prévia (public.alumia_admin_zerar_previa): o que vai sair, em números, e um pedido que vale 15
--      minutos. Depois, num segundo momento (pelo menos 10 segundos depois, a mesma pessoa, com a frase "ZERAR O BETA" escrita e o
--      motivo), public.alumia_admin_zerar_confirmar apaga. Nunca roda sozinha: nenhum agendador chama, e só a coordenação com o
--      segundo fator chega (interno.alumia_admin_exige).
--      O que sai: os posts (menos os das salas das disciplinas, que são da Escola e do site), as respostas, reações, votos, menções,
--      edições e tudo o que pendura num post; os stories, as figurinhas, as respostas, as reações e os destaques; os rascunhos, os
--      agendados e as chaves de envio; as mídias (as linhas, e os arquivos vão para a fila do servidor que apaga no depósito,
--      interno.alumia_arquivos_a_apagar); o álbum dos atos; e os avisos da Alumia (avisos de categoria "rede"). Os avisos da
--      equipe e da conta ficam.
--      As contas: a coordenação escolhe. "Manter as contas" deixa tudo de conta como está. "Contas saem da Alumia" tira a pessoa da
--      Alumia sem tocar na conta do instituto: o consentimento da Alumia é revogado (a linha fica, com a data: é a prova do que foi
--      aceito), a ficha da entrada sai (quem quiser voltar pede de novo), e saem os "seguir", as rodas e a participação em
--      comunidades. Quem tem papel no instituto (a equipe) fica na Alumia. Nenhuma linha de auth.* é tocada (o incidente do 2FA de
--      18/11: nunca zerar na hora o que o serviço de contas lê). Os bloqueios e silenciamentos ficam: são a segurança da pessoa.
--      As conversas: o servidor não guarda conversa da Alumia desde a R2 (o chat do beta sai com 20261124-r2-dupla.sql, por
--      drop table). O que sobra no servidor são as caixas anônimas, que a conversa da equipe também usa e que não dizem de quem
--      são, e o cofre cifrado de cada conta, que só o aparelho abre. Apagar isso quebraria a conversa da equipe e não apagaria nada
--      dos aparelhos: a rotina não toca no chat. Cada pessoa apaga as conversas no próprio aparelho.
--      Trava de segurança: antes de apagar, a rotina percorre as chaves estrangeiras "on delete cascade" e "set null" a partir das
--      tabelas que esvazia; se alguma tabela de fora da Alumia (fora de rede_*, alumia_*, fediverso_* e dos avisos) for alcançada,
--      ela para sem apagar nada ("zerar_tocaria"). Quem acrescentar uma tabela do instituto ligada a um post fica sabendo aqui.
--   2. RELATAR UM PROBLEMA. Um botão na ajuda da Alumia manda o texto, a tela (o endereço sem nada de quem é: números, @nomes e ids
--      viram ":x") e o aparelho (tipo de navegador, sistema e a medida da tela). Sem conta, sem endereço de rede, sem hora (só o
--      dia). Cai na fila do painel de admin da Alumia (public.alumia_admin_relatos). Some em 180 dias.
--   3. ERROS DA TELA. Quando uma tela quebra no aparelho de alguém, o site guarda só a mensagem do erro (sem e-mail, número, link
--      nem id), a página (do mesmo jeito), a versão do site e a família do navegador, somados por dia (quantas vezes). Sem IP, sem
--      conta, sem conteúdo, sem hora. Aparece em "Saúde e números" (public.alumia_admin_erros_tela). Some em 30 dias.
--
-- Funções novas: interno.alumia_p5_endereco_limpo, interno.alumia_p5_texto_limpo, interno.alumia_zerar_tocaria,
-- interno.alumia_zerar_contas, public.alumia_admin_zerar_previa, public.alumia_admin_zerar_confirmar, public.alumia_relato_enviar,
-- public.alumia_admin_relatos, public.alumia_admin_relato_mudar, public.erro_tela_registrar, public.alumia_admin_erros_tela.
-- Nenhuma função existente é redefinida. Endereço de rede: nada daqui lê ou guarda (o limite de pedidos usa a origem de sempre,
-- interno.origem: um resumo com sal que troca a cada hora, apagado em 2 dias). Não mexe em rede_alumia_versao nem na lista de
-- exceções da porta. Termina trancando tudo na porta.

-- ── 1. Tabelas ────────────────────────────────────────────────────────────────────────────────────────────────────────────

-- O pedido de zerar: a prévia que a coordenação viu e a confirmação. Fica como registro (sem dado de ninguém além de quem pediu).
create table if not exists interno.alumia_zerar_pedidos (
  id uuid primary key default gen_random_uuid(),
  pedido_por uuid references interno.perfis (id) on delete set null,
  manter_contas boolean not null,
  previa jsonb not null default '{}'::jsonb,
  criado_em timestamptz not null default now(),
  expira_em timestamptz not null default now() + interval '15 minutes',
  feito_em timestamptz,
  resultado jsonb
);

-- O relato de um problema: sem conta, sem endereço de rede, sem hora.
create table if not exists interno.alumia_relatos (
  id uuid primary key default gen_random_uuid(),
  ordem bigint generated always as identity,
  texto text not null check (char_length(texto) between 10 and 2000),
  tela text not null default '' check (char_length(tela) <= 200),
  aparelho text not null default '' check (char_length(aparelho) <= 80),
  medida text not null default '' check (medida ~ '^([0-9]{2,5}x[0-9]{2,5})?$'),
  versao text not null default '' check (versao ~ '^[0-9a-z.-]{0,40}$'),
  situacao text not null default 'novo' check (situacao in ('novo', 'visto', 'resolvido', 'descartado')),
  nota text not null default '' check (char_length(nota) <= 1000),
  dia date not null default current_date
);
create index if not exists alumia_relatos_fila on interno.alumia_relatos (situacao, ordem desc);

-- Os erros da tela, somados por dia: nada de linha por pessoa nem por hora.
create table if not exists interno.alumia_erros_tela (
  dia date not null default current_date,
  mensagem text not null check (char_length(mensagem) between 1 and 300),
  pagina text not null check (char_length(pagina) <= 200),
  versao text not null check (versao ~ '^[0-9a-z.-]{0,40}$'),
  navegador text not null check (navegador in ('chrome', 'firefox', 'safari', 'edge', 'samsung', 'opera', 'outro')),
  vezes integer not null default 1 check (vezes > 0),
  primary key (dia, mensagem, pagina, versao, navegador)
);

do $$
declare t text;
begin
  foreach t in array array['alumia_zerar_pedidos', 'alumia_relatos', 'alumia_erros_tela'] loop
    execute format('alter table interno.%I enable row level security', t);
    execute format('revoke all on table interno.%I from public', t);
    if exists (select 1 from pg_roles where rolname = 'anon') then
      execute format('revoke all on table interno.%I from anon, authenticated', t);
    end if;
  end loop;
end $$;

-- ── 2. Limpar o que chega da tela ─────────────────────────────────────────────────────────────────────────────────────────

/**
 * O endereço de uma tela sem nada de quem é: sem "?", sem "#", ids (uuid e números de 4 algarismos ou mais) viram ":x", e o que
 * vem depois de /u/, /p/, /c/, /tag/, /convite/ e de um "@" também (o @nome, o slug, o código). Até 200 letras.
 */
create or replace function interno.alumia_p5_endereco_limpo(p text) returns text language sql immutable as $$
  select left(
    regexp_replace(
      regexp_replace(
        regexp_replace(
          regexp_replace(
            regexp_replace(split_part(split_part(coalesce(p, ''), '?', 1), '#', 1), '^https?://[^/]*', ''),
            '[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}', ':x', 'g'),
          '/(u|p|c|tag|convite|ato|series|o)/[^/]+', '/\1/:x', 'g'),
        '/@[^/]*', '/:x', 'g'),
      '[0-9]{4,}', ':x', 'g'),
    200)
$$;

/** Uma mensagem de erro sem dado pessoal: e-mail, link, @nome, uuid e número longo saem. Até 300 letras, numa linha. */
create or replace function interno.alumia_p5_texto_limpo(p text) returns text language sql immutable as $$
  select left(btrim(regexp_replace(
    regexp_replace(
      regexp_replace(
        regexp_replace(
          regexp_replace(coalesce(p, ''), '[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}', '<e-mail>', 'g'),
          '(https?|wss?|blob|data):[^\s"''<>)]*', '<link>', 'g'),
        '[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}', ':x', 'g'),
      '(@[A-Za-z0-9_]{2,}|[0-9]{4,})', ':x', 'g'),
    '\s+', ' ', 'g')), 300)
$$;

-- ── 3. Zerar o beta ───────────────────────────────────────────────────────────────────────────────────────────────────────

/**
 * As tabelas de FORA da Alumia que apagar estas tabelas alcançaria (por "on delete cascade" em cadeia, ou por "set null" no fim
 * da cadeia). Os avisos são de fora, mas a rotina só apaga os da Alumia (a categoria "rede") e os que penduram num post: ficam de
 * fora da conta. Vazio = seguro.
 */
create or replace function interno.alumia_zerar_tocaria(p_tabelas regclass[]) returns text[] language sql stable security definer set search_path = interno, pg_temp as $$
  with recursive alvo(t) as (
    select unnest(p_tabelas)::oid
    union
    select c.conrelid from pg_constraint c join alvo a on c.confrelid = a.t
    where c.contype = 'f' and c.confdeltype = 'c'
  ),
  tocadas as (
    select t from alvo
    union
    select c.conrelid from pg_constraint c join alvo a on c.confrelid = a.t
    where c.contype = 'f' and c.confdeltype in ('n', 'd')
  ),
  -- O nome sempre com o esquema (o regclass em texto o esconde quando o esquema está no search_path).
  nomes as (select n.nspname || '.' || k.relname as nome from tocadas x join pg_class k on k.oid = x.t join pg_namespace n on n.oid = k.relnamespace)
  select coalesce(array_agg(nome order by nome), '{}') from nomes
  where nome !~ '^interno\.(rede|alumia|fediverso)_' and nome <> 'interno.avisos'
$$;

/** Quem fica na Alumia mesmo com "contas saem": quem tem papel no instituto (a equipe), e quem está zerando. */
create or replace function interno.alumia_zerar_fica(p_usuario uuid) returns boolean language sql stable security definer set search_path = interno, pg_temp as $$
  select p_usuario = auth.uid() or exists (select 1 from papeis p where p.usuario = p_usuario)
$$;

/** Os números da prévia: o que sai, nunca quem. Pessoas, só a partir de 3. */
create or replace function interno.alumia_zerar_numeros(p_manter_contas boolean) returns jsonb language sql stable security definer set search_path = interno, pg_temp as $$
  select jsonb_build_object(
    'posts', (select count(*) from rede_posts p where not exists (select 1 from rede_comunidades c where c.slug = p.comunidade and c.categoria = 'disciplinas')),
    'posts_das_disciplinas_ficam', (select count(*) from rede_posts p where exists (select 1 from rede_comunidades c where c.slug = p.comunidade and c.categoria = 'disciplinas')),
    'stories', (select count(*) from rede_stories),
    'midias', (select count(*) from rede_midia) + (select count(*) from rede_audios) + (select count(*) from rede_post_videos)
              + (select count(*) from rede_ato_album) + (select count(*) from rede_stories where midia_caminho is not null),
    'avisos', (select count(*) from avisos where categoria = 'rede'),
    'rascunhos', (select count(*) from rede_rascunhos) + (select count(*) from rede_agendados),
    'contas_saem', case when coalesce(p_manter_contas, true) then interno.alumia_admin_conta(0)
      else interno.alumia_admin_conta((select count(*)::integer from alumia_entrada e where not interno.alumia_zerar_fica(e.usuario))) end)
$$;

/** "Contas saem da Alumia": consentimento revogado (a linha fica), ficha da entrada fora, sem seguir, roda nem comunidade. */
create or replace function interno.alumia_zerar_contas() returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v_c integer; v_e integer; v_s integer; v_r integer; v_m integer; v_cs integer;
begin
  update rede_consentimentos c set revogado_em = now() where c.revogado_em is null and not interno.alumia_zerar_fica(c.usuario);
  get diagnostics v_c = row_count;
  delete from alumia_entrada e where not interno.alumia_zerar_fica(e.usuario);
  get diagnostics v_e = row_count;
  delete from rede_seguindo s where not interno.alumia_zerar_fica(s.quem) or not interno.alumia_zerar_fica(s.segue);
  get diagnostics v_s = row_count;
  delete from rede_roda r where not interno.alumia_zerar_fica(r.dono) or not interno.alumia_zerar_fica(r.membro);
  get diagnostics v_r = row_count;
  delete from rede_comunidade_membros m where not interno.alumia_zerar_fica(m.usuario);
  get diagnostics v_m = row_count;
  delete from rede_comunidades_seguidas m where not interno.alumia_zerar_fica(m.usuario);
  get diagnostics v_cs = row_count;
  return jsonb_build_object('consentimentos_revogados', v_c, 'fichas', v_e, 'seguir', v_s, 'rodas', v_r, 'comunidades', v_m + v_cs);
end $$;

/** O primeiro passo: a prévia e o pedido (vale 15 minutos). Nada é apagado aqui. */
create or replace function public.alumia_admin_zerar_previa(p_manter_contas boolean) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.alumia_admin_exige(); v_id uuid; v_previa jsonb;
begin
  perform interno.limite('alumia_admin_zerar', 10, 60);
  if p_manter_contas is null then perform interno.erro('invalido:contas'); end if;
  v_previa := interno.alumia_zerar_numeros(p_manter_contas);
  -- Um pedido de cada vez: o que estava esperando perde a validade.
  update alumia_zerar_pedidos set expira_em = least(expira_em, now()) where feito_em is null and expira_em > now();
  insert into alumia_zerar_pedidos (pedido_por, manter_contas, previa) values (v, p_manter_contas, v_previa) returning id into v_id;
  perform interno.alumia_painel_registrar('zerar_previa', 'beta', v_id::text, 'Zerar o beta (prévia)', 'Prévia do zerar o beta, nada apagado.',
    jsonb_build_object('manter_contas', p_manter_contas, 'previa', v_previa));
  return jsonb_build_object('id', v_id, 'manter_contas', p_manter_contas, 'previa', v_previa, 'frase', 'ZERAR O BETA',
    'expira_em', now() + interval '15 minutes', 'tocaria', to_jsonb(interno.alumia_zerar_tocaria(array['interno.rede_posts', 'interno.rede_stories',
      'interno.rede_story_destaques', 'interno.rede_rascunhos', 'interno.rede_agendados', 'interno.rede_envios', 'interno.rede_ato_album']::regclass[])));
end $$;

/**
 * O segundo passo: apaga. Pede o pedido da prévia (da mesma pessoa, de 10 segundos a 15 minutos atrás, ainda não feito), a frase
 * "ZERAR O BETA" escrita e o motivo. Tudo numa transação: se alguma parte falha, nada é apagado.
 */
create or replace function public.alumia_admin_zerar_confirmar(p_id uuid, p_frase text, p_motivo text) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare
  v uuid := interno.alumia_admin_exige();
  v_motivo text := interno.alumia_painel_motivo(p_motivo);
  z alumia_zerar_pedidos;
  v_tocaria text[];
  v_arquivos integer := 0; v_posts integer; v_stories integer; v_avisos integer; v_outros integer; v_n integer;
  v_contas jsonb := null;
begin
  perform interno.limite('alumia_admin_zerar', 10, 60);
  select * into z from alumia_zerar_pedidos where id = p_id for update;
  if not found or z.pedido_por is distinct from v then perform interno.erro('nao_encontrado'); end if;
  if z.feito_em is not null then perform interno.erro('ja_feito'); end if;
  if z.expira_em <= now() then perform interno.erro('expirado'); end if;
  -- A confirmação é um segundo momento, não o mesmo clique.
  if now() < z.criado_em + interval '10 seconds' then perform interno.erro('cedo_demais'); end if;
  if btrim(coalesce(p_frase, '')) is distinct from 'ZERAR O BETA' then perform interno.erro('invalido:frase'); end if;

  v_tocaria := interno.alumia_zerar_tocaria(array['interno.rede_posts', 'interno.rede_stories', 'interno.rede_story_destaques',
    'interno.rede_rascunhos', 'interno.rede_agendados', 'interno.rede_envios', 'interno.rede_ato_album']::regclass[]);
  if cardinality(v_tocaria) > 0 then
    raise exception 'zerar_tocaria:%', array_to_string(v_tocaria, ',') using errcode = 'P0001';
  end if;

  -- Os posts que saem (as salas das disciplinas ficam: são da Escola e do site).
  create temporary table if not exists p5_zerar_posts (id uuid primary key) on commit drop;
  truncate p5_zerar_posts;
  insert into p5_zerar_posts select p.id from rede_posts p
  where not exists (select 1 from rede_comunidades c where c.slug = p.comunidade and c.categoria = 'disciplinas');

  -- Os arquivos vão para a fila do servidor do site, que apaga no depósito pela API (o banco não apaga arquivo).
  insert into alumia_arquivos_a_apagar (deposito, caminho)
  select x.deposito, x.caminho from (
    select 'rede-midia' as deposito, m.caminho from rede_midia m join p5_zerar_posts z2 on z2.id = m.post
    union select 'rede-midia', a.caminho from rede_audios a join p5_zerar_posts z2 on z2.id = a.post
    union select 'rede-video', v2.caminho from rede_post_videos v2 where v2.post is null or v2.post in (select id from p5_zerar_posts)
    union select 'rede-album', b.caminho from rede_ato_album b
    union select 'rede-stories', s.midia_caminho from rede_stories s where s.midia_caminho is not null
  ) x where x.caminho ~ '^[0-9a-f-]{36}/[A-Za-z0-9._-]{1,120}$'
  on conflict do nothing;
  get diagnostics v_arquivos = row_count;

  -- Avisos da Alumia (os que penduram num post saem junto com ele).
  delete from avisos where categoria = 'rede';
  get diagnostics v_avisos = row_count;

  delete from rede_stories;
  get diagnostics v_stories = row_count;
  delete from rede_story_destaques;
  delete from rede_ato_album;
  delete from rede_post_videos where post is null or post in (select id from p5_zerar_posts);
  delete from rede_rascunhos;
  get diagnostics v_outros = row_count;
  delete from rede_agendados;
  get diagnostics v_n = row_count;
  v_outros := v_outros + v_n;
  delete from rede_envios;
  delete from rede_posts p where p.id in (select id from p5_zerar_posts);
  get diagnostics v_posts = row_count;

  if not z.manter_contas then v_contas := interno.alumia_zerar_contas(); end if;

  update alumia_zerar_pedidos set feito_em = now(),
    resultado = jsonb_build_object('posts', v_posts, 'stories', v_stories, 'avisos', v_avisos, 'rascunhos_e_agendados', v_outros,
      'arquivos_na_fila', v_arquivos, 'contas', v_contas)
  where id = z.id;
  perform interno.registrar('alumia_beta_zerado', z.id::text, jsonb_build_object('manter_contas', z.manter_contas));
  perform interno.alumia_painel_registrar('zerar_feito', 'beta', z.id::text, 'Zerar o beta', v_motivo,
    jsonb_build_object('manter_contas', z.manter_contas, 'posts', v_posts, 'stories', v_stories, 'avisos', v_avisos, 'arquivos_na_fila', v_arquivos));
  return jsonb_build_object('ok', true, 'posts', v_posts, 'stories', v_stories, 'avisos', v_avisos, 'rascunhos_e_agendados', v_outros,
    'arquivos_na_fila', v_arquivos, 'contas', v_contas, 'manter_contas', z.manter_contas);
end $$;

-- ── 4. Relatar um problema ────────────────────────────────────────────────────────────────────────────────────────────────

create or replace function public.alumia_relato_enviar(p jsonb) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v_id uuid; v_medida text; v_versao text;
begin
  if auth.uid() is null then perform interno.erro('entre_primeiro'); end if;
  if p is null or jsonb_typeof(p) <> 'object' then perform interno.erro('invalido:p'); end if;
  perform interno.limite('alumia_relato', 5, 60);
  v_medida := coalesce(substring(coalesce(p ->> 'medida', '') from '^([0-9]{2,5}x[0-9]{2,5})$'), '');
  v_versao := coalesce(substring(lower(coalesce(p ->> 'versao', '')) from '^([0-9a-z.-]{0,40})$'), '');
  insert into alumia_relatos (texto, tela, aparelho, medida, versao)
  values (interno.txt(p ->> 'texto', 'texto', 10, 2000), interno.alumia_p5_endereco_limpo(p ->> 'tela'),
          left(regexp_replace(coalesce(p ->> 'aparelho', ''), '[^A-Za-z0-9 ·./()-]', '', 'g'), 80), v_medida, v_versao)
  returning id into v_id;
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.alumia_admin_relatos() returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.alumia_admin_exige();
begin
  delete from alumia_relatos where dia < current_date - 180;
  return jsonb_build_object(
    'relatos', coalesce((select jsonb_agg(jsonb_build_object('id', r.id, 'texto', r.texto, 'tela', r.tela, 'aparelho', r.aparelho, 'medida', r.medida,
        'versao', r.versao, 'situacao', r.situacao, 'nota', r.nota, 'dia', r.dia) order by (r.situacao = 'novo') desc, r.ordem desc)
      from (select * from alumia_relatos order by ordem desc limit 300) r), '[]'::jsonb),
    'novos', (select count(*) from alumia_relatos where situacao = 'novo'));
end $$;

create or replace function public.alumia_admin_relato_mudar(p_id uuid, p_situacao text, p_nota text) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.alumia_admin_exige();
begin
  perform interno.limite('alumia_admin_relato', 120, 60);
  if coalesce(p_situacao, '') not in ('novo', 'visto', 'resolvido', 'descartado') then perform interno.erro('invalido:situacao'); end if;
  update alumia_relatos set situacao = p_situacao, nota = interno.txt(p_nota, 'nota', 0, 1000) where id = p_id;
  if not found then perform interno.erro('nao_encontrado'); end if;
  perform interno.alumia_painel_registrar('relato_' || p_situacao, 'relato', p_id::text, 'Relato de problema', '', '{}'::jsonb);
  return jsonb_build_object('ok', true);
end $$;

-- ── 5. Erros da tela ──────────────────────────────────────────────────────────────────────────────────────────────────────

/**
 * Guarda um erro da tela, somado por dia. Qualquer pessoa chama (a tela de entrada também quebra), com limite por origem e um teto
 * de linhas por dia: passado o teto, o erro novo é ignorado em silêncio (o que já está guardado continua somando).
 */
create or replace function public.erro_tela_registrar(p jsonb) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v_msg text; v_pag text; v_ver text; v_nav text;
begin
  if p is null or jsonb_typeof(p) <> 'object' then return jsonb_build_object('ok', false); end if;
  perform interno.limite('erro_tela', 20, 10);
  v_msg := interno.alumia_p5_texto_limpo(p ->> 'mensagem');
  v_pag := interno.alumia_p5_endereco_limpo(p ->> 'pagina');
  v_ver := coalesce(substring(lower(coalesce(p ->> 'versao', '')) from '^([0-9a-z.-]{0,40})$'), '');
  v_nav := case when p ->> 'navegador' in ('chrome', 'firefox', 'safari', 'edge', 'samsung', 'opera') then p ->> 'navegador' else 'outro' end;
  if v_msg = '' or v_pag !~ '^/' then return jsonb_build_object('ok', false); end if;
  if (select count(*) from alumia_erros_tela where dia = current_date) >= 2000
     and not exists (select 1 from alumia_erros_tela where dia = current_date and mensagem = v_msg and pagina = v_pag and versao = v_ver and navegador = v_nav) then
    return jsonb_build_object('ok', true);
  end if;
  insert into alumia_erros_tela (dia, mensagem, pagina, versao, navegador) values (current_date, v_msg, v_pag, v_ver, v_nav)
  on conflict (dia, mensagem, pagina, versao, navegador) do update set vezes = least(alumia_erros_tela.vezes + 1, 1000000);
  if random() < 0.02 then delete from alumia_erros_tela where dia < current_date - 30; end if;
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.alumia_admin_erros_tela(p_dias integer default 7) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.alumia_admin_exige(); v_dias integer := greatest(1, least(coalesce(p_dias, 7), 30));
begin
  delete from alumia_erros_tela where dia < current_date - 30;
  return jsonb_build_object('dias', v_dias, 'erros', coalesce((select jsonb_agg(x order by x.vezes desc, x.ultimo desc) from (
    select mensagem, pagina, versao, navegador, sum(vezes)::integer as vezes, max(dia) as ultimo, min(dia) as primeiro
    from alumia_erros_tela where dia > current_date - v_dias
    group by mensagem, pagina, versao, navegador order by sum(vezes) desc limit 100) x), '[]'::jsonb));
end $$;

-- ── 6. Permissões ─────────────────────────────────────────────────────────────────────────────────────────────────────────

do $$
declare f text;
begin
  foreach f in array array['interno.alumia_p5_endereco_limpo(text)', 'interno.alumia_p5_texto_limpo(text)', 'interno.alumia_zerar_tocaria(regclass[])',
                           'interno.alumia_zerar_fica(uuid)', 'interno.alumia_zerar_numeros(boolean)', 'interno.alumia_zerar_contas()'] loop
    execute format('revoke all on function %s from public', f);
    if exists (select 1 from pg_roles where rolname = 'anon') then execute format('revoke all on function %s from anon, authenticated', f); end if;
  end loop;
  foreach f in array array['public.alumia_admin_zerar_previa(boolean)', 'public.alumia_admin_zerar_confirmar(uuid, text, text)', 'public.alumia_relato_enviar(jsonb)',
                           'public.alumia_admin_relatos()', 'public.alumia_admin_relato_mudar(uuid, text, text)', 'public.alumia_admin_erros_tela(integer)'] loop
    execute format('revoke all on function %s from public', f);
    if exists (select 1 from pg_roles where rolname = 'anon') then
      execute format('revoke all on function %s from anon', f);
      execute format('grant execute on function %s to authenticated, service_role', f);
    end if;
  end loop;
  revoke all on function public.erro_tela_registrar(jsonb) from public;
  if exists (select 1 from pg_roles where rolname = 'anon') then
    grant execute on function public.erro_tela_registrar(jsonb) to anon, authenticated, service_role;
  end if;
end $$;

select interno.alumia_trancar();
