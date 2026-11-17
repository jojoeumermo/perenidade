-- ───────────────────────────── Alumia · Onda 10 · acervo da comunidade e do núcleo (novembro de 2026) ─────────────────────────────
-- Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
--
-- Frente 10D (acervo). O que entra:
--
--   1. Coleções públicas de posts ("melhores explicações de redação"): uma pessoa (no perfil dela) ou a moderação de uma comunidade
--      monta uma coleção com título, descrição e ORDEM ESCRITA por quem cuida (nunca por curtida). Só entra post de público aberto
--      (internet ou membros) ou, na coleção da comunidade, post "só a comunidade" dela mesma; nunca de núcleo, de seguidores, de
--      equipe nem de comunidade fechada. Na leitura, cada post passa de novo por interno.rede_ve: ninguém vê pela coleção o que
--      não veria fora dela. A autora tira o post dela de qualquer coleção, e ele não volta. Quem é membro sugere um post para a
--      coleção da comunidade; a sugestão não guarda quem sugeriu. Nenhuma contagem de quem segue ou abriu a coleção.
--   2. Documentos do núcleo (pasta colaborativa): textos que quem é do núcleo escreve e edita junto, com todas as versões. Quem
--      editou cada versão só aparece para a mediação do núcleo (como na wiki: LGPD art. 11). Nenhum registro de quem leu.
--   3. Arquivos do núcleo: PDF e imagem, no depósito privado "rede-acervo", na pasta do núcleo (nunca na pasta de uma pessoa: a
--      tabela não guarda quem enviou). O servidor do site tira os metadados e só ELE grava no depósito, com a chave de serviço (o
--      depósito não tem regra de envio para quem tem conta: nada chega lá sem a limpeza; app/api/rede/acervo). Cota por
--      núcleo (configuracoes 'acervo_nucleo_cota', padrão 200 MB) e 10 MB por arquivo. Quem enviou pode desfazer o envio por 15
--      minutos com o código que recebeu na hora (o banco guarda só o hash); depois disso, só a mediação apaga.
--   4. Arquivo por mês e exportar a comunidade: os posts de uma comunidade por mês, do primeiro ao último (contagem só a partir de
--      3, como a dos posts da semana); e a exportação para a moderação, em páginas: regras, wiki, coleções e os posts PÚBLICOS
--      (internet ou membros; comunidade fechada não exporta posts), com o codinome do autor de cada post e nada mais de pessoa.
--      A busca dentro da comunidade é a de sempre (rede_alumia_buscar com "c:<slug>"): não precisa de função nova.
--   5. Acabamento da wiki: quem pode editar (membros, membros experientes ou só a moderação, escolhido pela moderação) e desfazer
--      a última edição (a própria, por 30 minutos; a moderação, qualquer uma). Desfazer vira uma versão nova: nada se perde.
--
-- Endereço de rede: nada daqui lê ou guarda (decisão de 13/11). Tabelas em interno, RLS ligada e sem política, nenhuma permissão
-- direta; acesso só pelas funções security definer abaixo (search_path fixo), que passam pela porta da Alumia (interno.alumia_trancar
-- no fim). Pode rodar mais de uma vez, sem apagar dado nenhum. Roda depois das migrações da Onda 9.
-- Teste: scripts/testar-alumia-o10-acervo.mjs.

-- 0. Configuração ──────────────────────────────────────────────────────────────────────────────────────────────────────────

-- A cota de cada núcleo (o plano de armazenamento é da coordenação: mude o valor aqui, sem migração nova).
insert into interno.configuracoes (chave, valor) values ('acervo_nucleo_cota', '{"bytes": 209715200}'::jsonb) on conflict (chave) do nothing;

-- 1. Tabelas ────────────────────────────────────────────────────────────────────────────────────────────────────────────────

-- Uma coleção: de uma pessoa (aparece no perfil dela) ou de uma comunidade (a moderação cuida).
create table if not exists interno.rede_acervo_colecoes (
  id uuid primary key default gen_random_uuid(),
  usuario uuid references interno.perfis (id) on delete cascade,
  comunidade text references interno.rede_comunidades (slug) on delete cascade on update cascade,
  titulo text not null check (char_length(titulo) between 2 and 80),
  descricao text not null default '' check (char_length(descricao) <= 280),
  criado_em timestamptz not null default now(),
  mudou_em timestamptz not null default now(),
  check ((usuario is null) <> (comunidade is null))
);
create index if not exists rede_acervo_colecoes_usuario on interno.rede_acervo_colecoes (usuario) where usuario is not null;
create index if not exists rede_acervo_colecoes_comunidade on interno.rede_acervo_colecoes (comunidade) where comunidade is not null;

-- Os posts de uma coleção, na ordem escrita por quem cuida. Não guarda quem pôs.
create table if not exists interno.rede_acervo_colecao_itens (
  colecao uuid not null references interno.rede_acervo_colecoes (id) on delete cascade,
  post uuid not null references interno.rede_posts (id) on delete cascade,
  ordem integer not null check (ordem between 1 and 1000),
  nota text not null default '' check (char_length(nota) <= 140),
  primary key (colecao, post)
);
create index if not exists rede_acervo_colecao_itens_post on interno.rede_acervo_colecao_itens (post);

-- A autora tirou o post desta coleção: ele não volta para ela.
create table if not exists interno.rede_acervo_colecao_fora (
  colecao uuid not null references interno.rede_acervo_colecoes (id) on delete cascade,
  post uuid not null references interno.rede_posts (id) on delete cascade,
  primary key (colecao, post)
);

-- Sugestões de post para a coleção de uma comunidade. Não guarda quem sugeriu.
create table if not exists interno.rede_acervo_sugestoes (
  colecao uuid not null references interno.rede_acervo_colecoes (id) on delete cascade,
  post uuid not null references interno.rede_posts (id) on delete cascade,
  criado_em timestamptz not null default now(),
  primary key (colecao, post)
);

-- Os documentos do núcleo e as versões de cada um.
create table if not exists interno.rede_acervo_docs (
  id uuid primary key default gen_random_uuid(),
  nucleo uuid not null references interno.rede_nucleos (id) on delete cascade,
  titulo text not null check (char_length(titulo) between 2 and 120),
  corpo text not null check (char_length(corpo) <= 50000),
  versao integer not null default 1,
  criado_em timestamptz not null default now(),
  editado_em timestamptz not null default now()
);
create index if not exists rede_acervo_docs_nucleo on interno.rede_acervo_docs (nucleo, editado_em desc);
create table if not exists interno.rede_acervo_doc_versoes (
  doc uuid not null references interno.rede_acervo_docs (id) on delete cascade,
  versao integer not null,
  titulo text not null,
  corpo text not null,
  resumo text not null default '' check (char_length(resumo) <= 140),
  editou uuid references interno.perfis (id) on delete set null,
  criado_em timestamptz not null default now(),
  primary key (doc, versao)
);

-- Os arquivos do núcleo. O arquivo mora no depósito "rede-acervo", em "<núcleo>/<id>.<ext>". Não guarda quem enviou.
create table if not exists interno.rede_acervo_arquivos (
  id uuid primary key default gen_random_uuid(),
  nucleo uuid not null references interno.rede_nucleos (id) on delete cascade,
  nome text not null check (char_length(nome) between 1 and 120),
  ext text not null check (ext in ('pdf', 'jpg', 'png', 'webp')),
  tamanho bigint not null default 0 check (tamanho between 0 and 10485760),
  caminho text not null unique,
  situacao text not null default 'reservado' check (situacao in ('reservado', 'pronto', 'apagado')),
  desfazer_hash text check (desfazer_hash is null or desfazer_hash ~ '^[a-f0-9]{64}$'),
  desfazer_ate timestamptz,
  criado_em timestamptz not null default now(),
  mudou_em timestamptz not null default now()
);
create index if not exists rede_acervo_arquivos_nucleo on interno.rede_acervo_arquivos (nucleo, situacao, criado_em desc);

-- Quem pode editar a wiki de cada comunidade (sem linha: membros de nível 1 ou mais, como antes).
create table if not exists interno.rede_acervo_wiki_regra (
  comunidade text primary key references interno.rede_comunidades (slug) on delete cascade on update cascade,
  quem text not null default 'membros' check (quem in ('membros', 'experientes', 'moderacao')),
  mudou_em timestamptz not null default now()
);

alter table interno.rede_acervo_colecoes enable row level security;
alter table interno.rede_acervo_colecao_itens enable row level security;
alter table interno.rede_acervo_colecao_fora enable row level security;
alter table interno.rede_acervo_sugestoes enable row level security;
alter table interno.rede_acervo_docs enable row level security;
alter table interno.rede_acervo_doc_versoes enable row level security;
alter table interno.rede_acervo_arquivos enable row level security;
alter table interno.rede_acervo_wiki_regra enable row level security;
do $$
begin
  revoke all on table interno.rede_acervo_colecoes, interno.rede_acervo_colecao_itens, interno.rede_acervo_colecao_fora, interno.rede_acervo_sugestoes,
    interno.rede_acervo_docs, interno.rede_acervo_doc_versoes, interno.rede_acervo_arquivos, interno.rede_acervo_wiki_regra from public;
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on table interno.rede_acervo_colecoes, interno.rede_acervo_colecao_itens, interno.rede_acervo_colecao_fora, interno.rede_acervo_sugestoes,
      interno.rede_acervo_docs, interno.rede_acervo_doc_versoes, interno.rede_acervo_arquivos, interno.rede_acervo_wiki_regra from anon, authenticated;
  end if;
end $$;

-- 2. Coleções ───────────────────────────────────────────────────────────────────────────────────────────────────────────────

/**
 * A pessoa dona de uma coleção, pelo @: só quem apareceria na busca de pessoas (codinome pronto, sem modo invisível, sem conta
 * suspensa, membro, sem bloqueio nos dois sentidos), ou a própria pessoa. Fora disso, 'nao_encontrado' (sem dizer por quê).
 */
create or replace function interno.rede_acervo_dono(p_handle text, p_quem uuid) returns uuid language plpgsql stable security definer set search_path = interno, pg_temp as $$
declare v_handle text := lower(regexp_replace(coalesce(p_handle, ''), '^@', '')); v_id uuid;
begin
  if v_handle !~ '^[a-z0-9_]{3,20}$' then perform interno.erro('nao_encontrado'); end if;
  select f.id into v_id from perfis f
   where f.rede_handle = v_handle
     and (f.id = p_quem or (f.rede_codinome_ok and f.rede_modo <> 'invisivel' and not f.rede_invisivel and not f.suspenso
                            and interno.rede2_membro(f.id) and not interno.rede_bloqueado(p_quem, f.id)));
  if v_id is null then perform interno.erro('nao_encontrado'); end if;
  return v_id;
end $$;

/** A coleção, se p_quem pode vê-la (a da comunidade: quem vê a comunidade; a da pessoa: quem veria a pessoa). */
create or replace function interno.rede_acervo_colecao_ver(p_id uuid, p_quem uuid) returns interno.rede_acervo_colecoes language plpgsql stable security definer set search_path = interno, pg_temp as $$
declare k rede_acervo_colecoes; v_handle text;
begin
  select * into k from rede_acervo_colecoes where id = p_id;
  if not found then perform interno.erro('nao_encontrado'); end if;
  if k.comunidade is not null then
    perform interno.rede_alumia_com_ver(k.comunidade, p_quem);
  else
    select rede_handle into v_handle from perfis where id = k.usuario;
    if interno.rede_acervo_dono(v_handle, p_quem) is distinct from k.usuario then perform interno.erro('nao_encontrado'); end if;
  end if;
  return k;
end $$;

/** Quem cuida da coleção: a dona (a da pessoa) ou a moderação da comunidade. */
create or replace function interno.rede_acervo_colecao_cuida(k interno.rede_acervo_colecoes, p_quem uuid) returns boolean language sql stable security definer set search_path = interno, pg_temp as $$
  select coalesce(p_quem is not null and interno.rede2_membro(p_quem)
     and (k.usuario = p_quem or (k.comunidade is not null and interno.rede3_com_modera(k.comunidade, p_quem))), false)
$$;

/**
 * O post pode entrar nesta coleção? Só o que está no ar e tem público aberto (internet ou membros), fora de comunidade fechada e de
 * espaço fechado; na coleção da comunidade, também o post "só a comunidade" dela mesma. Núcleo, seguidores e equipe, nunca.
 */
create or replace function interno.rede_acervo_cabe(k interno.rede_acervo_colecoes, x interno.rede_posts) returns boolean language sql stable security definer set search_path = interno, pg_temp as $$
  select x.id is not null and x.apagado_em is null and not x.oculto and not x.retido and x.nucleo is null
     and coalesce(x.comunidade, '') not like 'fechado-%'
     and not exists (select 1 from rede_comunidades c where c.slug = x.comunidade and c.tipo = 'fechada' and c.slug is distinct from k.comunidade)
     and (interno.rede2_publico(x) in ('internet', 'membros')
          or (k.comunidade is not null and x.comunidade = k.comunidade and interno.rede2_publico(x) = 'comunidade'))
$$;

/** As coleções de uma comunidade (p_slug) ou de uma pessoa (p_handle), com quantos posts cada uma tem (posts, nunca pessoas). */
create or replace function public.rede_acervo_colecoes(p_slug text default null, p_handle text default null) returns jsonb language plpgsql volatile security definer set search_path = interno, pg_temp as $$
declare v uuid := auth.uid(); c rede_comunidades; v_dono uuid; v_cuida boolean;
begin
  perform interno.aberta('comunidade');
  if (nullif(p_slug, '') is null) = (nullif(p_handle, '') is null) then perform interno.erro('invalido:alvo'); end if;
  if nullif(p_slug, '') is not null then c := interno.rede_alumia_com_ver(p_slug, v); else v_dono := interno.rede_acervo_dono(p_handle, v); end if;
  perform interno.limite('rede2_ler', 600, 60);
  v_cuida := case when c.slug is not null then v is not null and interno.rede2_membro(v) and interno.rede3_com_modera(c.slug, v)
                  else v is not null and v = v_dono and interno.rede2_membro(v) end;
  return jsonb_build_object(
    'itens', (select coalesce(jsonb_agg(jsonb_build_object('id', k.id, 'titulo', k.titulo, 'descricao', k.descricao, 'mudou_em', k.mudou_em,
                'posts', (select count(*)::integer from rede_acervo_colecao_itens i join rede_posts p on p.id = i.post where i.colecao = k.id and interno.rede_ve(p, v)),
                'sugestoes', case when v_cuida then (select count(*)::integer from rede_acervo_sugestoes s where s.colecao = k.id) end)
              order by lower(k.titulo)), '[]'::jsonb)
              from rede_acervo_colecoes k where (c.slug is not null and k.comunidade = c.slug) or (v_dono is not null and k.usuario = v_dono)),
    'pode_criar', v_cuida,
    'pode_sugerir', c.slug is not null and v is not null and interno.rede2_membro(v));
end $$;

/** Uma coleção com os posts na ordem escrita (só os que esta pessoa vê). Quem cuida recebe também as sugestões. */
create or replace function public.rede_acervo_colecao(p_id uuid) returns jsonb language plpgsql volatile security definer set search_path = interno, pg_temp as $$
declare v uuid := auth.uid(); k rede_acervo_colecoes; v_cuida boolean; c rede_comunidades;
begin
  perform interno.aberta('comunidade');
  k := interno.rede_acervo_colecao_ver(p_id, v);
  perform interno.limite('rede2_ler', 600, 60);
  v_cuida := interno.rede_acervo_colecao_cuida(k, v);
  if k.comunidade is not null then select * into c from rede_comunidades where slug = k.comunidade; end if;
  return jsonb_build_object(
    'id', k.id, 'titulo', k.titulo, 'descricao', k.descricao, 'mudou_em', k.mudou_em,
    'dono', case when k.comunidade is not null then jsonb_build_object('tipo', 'comunidade', 'slug', c.slug, 'nome', c.nome, 'cor', c.cor)
                 else jsonb_build_object('tipo', 'pessoa', 'handle', (select rede_handle from perfis where id = k.usuario), 'nome', interno.rede_nome(k.usuario)) end,
    'pode_editar', v_cuida,
    'itens', (select coalesce(jsonb_agg(jsonb_build_object('post', interno.rede_post_v2(p, v), 'nota', i.nota, 'meu', v is not null and p.autor = v) order by i.ordem, i.post), '[]'::jsonb)
              from rede_acervo_colecao_itens i join rede_posts p on p.id = i.post where i.colecao = k.id and interno.rede_ve(p, v)),
    'sugestoes', case when v_cuida then (select coalesce(jsonb_agg(interno.rede_post_v2(p, v) order by s.criado_em), '[]'::jsonb)
              from (select * from rede_acervo_sugestoes where colecao = k.id order by criado_em limit 50) s join rede_posts p on p.id = s.post where interno.rede_ve(p, v)) end);
end $$;

/** Cria (p_id nulo: da comunidade p_slug, pela moderação; sem p_slug, da própria pessoa) ou edita o título e a descrição. */
create or replace function public.rede_acervo_colecao_salvar(p_id uuid, p_slug text, p_titulo text, p_descricao text default '') returns jsonb language plpgsql volatile security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); k rede_acervo_colecoes; c rede_comunidades; v_tit text; v_desc text; v_id uuid;
begin
  perform interno.aberta('comunidade');
  if not interno.rede2_membro(v) then perform interno.erro('consentimento'); end if;
  v_tit := interno.txt(p_titulo, 'titulo', 2, 80);
  v_desc := interno.txt(coalesce(p_descricao, ''), 'descricao', 0, 280);
  perform interno.limite('alumia_acervo_colecao', 30, 60);
  if p_id is null then
    if nullif(p_slug, '') is not null then
      c := interno.rede_alumia_com_ver(p_slug, v);
      if not interno.rede3_com_modera(c.slug, v) then perform interno.erro('sem_permissao'); end if;
      if (select count(*) from rede_acervo_colecoes where comunidade = c.slug) >= 30 then perform interno.erro('invalido:muitas'); end if;
      insert into rede_acervo_colecoes (comunidade, titulo, descricao) values (c.slug, v_tit, v_desc) returning id into v_id;
    else
      if (select count(*) from rede_acervo_colecoes where usuario = v) >= 30 then perform interno.erro('invalido:muitas'); end if;
      insert into rede_acervo_colecoes (usuario, titulo, descricao) values (v, v_tit, v_desc) returning id into v_id;
    end if;
    return jsonb_build_object('id', v_id, 'titulo', v_tit, 'descricao', v_desc);
  end if;
  k := interno.rede_acervo_colecao_ver(p_id, v);
  if not interno.rede_acervo_colecao_cuida(k, v) then perform interno.erro('sem_permissao'); end if;
  update rede_acervo_colecoes set titulo = v_tit, descricao = v_desc, mudou_em = now() where id = k.id;
  return jsonb_build_object('id', k.id, 'titulo', v_tit, 'descricao', v_desc);
end $$;

/** Apaga a coleção (os posts continuam onde estavam). */
create or replace function public.rede_acervo_colecao_apagar(p_id uuid) returns jsonb language plpgsql volatile security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); k rede_acervo_colecoes;
begin
  perform interno.aberta('comunidade');
  k := interno.rede_acervo_colecao_ver(p_id, v);
  if not interno.rede_acervo_colecao_cuida(k, v) then perform interno.erro('sem_permissao'); end if;
  delete from rede_acervo_colecoes where id = k.id;
  return jsonb_build_object('apagada', true);
end $$;

/**
 * Põe (p_sim) ou tira um post da coleção. Pôr confere a regra do público (interno.rede_acervo_cabe), que quem cuida vê o post e que
 * a autora não o tirou desta coleção; entra no fim da ordem. Pôr de novo só troca a nota. Até 100 posts por coleção.
 */
create or replace function public.rede_acervo_colecao_por(p_id uuid, p_post uuid, p_sim boolean default true, p_nota text default '') returns jsonb language plpgsql volatile security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); k rede_acervo_colecoes; x rede_posts; v_nota text;
begin
  perform interno.aberta('comunidade');
  k := interno.rede_acervo_colecao_ver(p_id, v);
  if not interno.rede_acervo_colecao_cuida(k, v) then perform interno.erro('sem_permissao'); end if;
  perform interno.limite('alumia_acervo_por', 120, 60);
  if not coalesce(p_sim, true) then
    delete from rede_acervo_colecao_itens where colecao = k.id and post = p_post;
    update rede_acervo_colecoes set mudou_em = now() where id = k.id;
    return jsonb_build_object('na_colecao', false);
  end if;
  v_nota := interno.txt(coalesce(p_nota, ''), 'nota', 0, 140);
  select * into x from rede_posts where id = p_post;
  if not found or not interno.rede_ve(x, v) then perform interno.erro('nao_encontrado'); end if;
  if not interno.rede_acervo_cabe(k, x) then perform interno.erro('publico_nao_permite'); end if;
  if exists (select 1 from rede_acervo_colecao_fora where colecao = k.id and post = x.id) then perform interno.erro('autora_tirou'); end if;
  if exists (select 1 from rede_acervo_colecao_itens where colecao = k.id and post = x.id) then
    update rede_acervo_colecao_itens set nota = v_nota where colecao = k.id and post = x.id;
  else
    if (select count(*) from rede_acervo_colecao_itens where colecao = k.id) >= 100 then perform interno.erro('invalido:muitos'); end if;
    insert into rede_acervo_colecao_itens (colecao, post, ordem, nota)
    values (k.id, x.id, coalesce((select max(ordem) from rede_acervo_colecao_itens where colecao = k.id), 0) + 1, v_nota);
  end if;
  delete from rede_acervo_sugestoes where colecao = k.id and post = x.id;
  update rede_acervo_colecoes set mudou_em = now() where id = k.id;
  return jsonb_build_object('na_colecao', true);
end $$;

/** Reescreve a ordem: p_posts traz TODOS os posts da coleção, na ordem nova (nem um a mais, nem um a menos). */
create or replace function public.rede_acervo_colecao_ordem(p_id uuid, p_posts uuid[]) returns jsonb language plpgsql volatile security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); k rede_acervo_colecoes; v_n integer;
begin
  perform interno.aberta('comunidade');
  k := interno.rede_acervo_colecao_ver(p_id, v);
  if not interno.rede_acervo_colecao_cuida(k, v) then perform interno.erro('sem_permissao'); end if;
  perform interno.limite('alumia_acervo_por', 120, 60);
  select count(*) into v_n from rede_acervo_colecao_itens where colecao = k.id;
  if p_posts is null or cardinality(p_posts) <> v_n or (select count(distinct x) from unnest(p_posts) x) <> v_n
     or exists (select 1 from unnest(p_posts) x where not exists (select 1 from rede_acervo_colecao_itens i where i.colecao = k.id and i.post = x)) then
    perform interno.erro('invalido:ordem');
  end if;
  update rede_acervo_colecao_itens i set ordem = o.n from unnest(p_posts) with ordinality as o(post, n) where i.colecao = k.id and i.post = o.post;
  update rede_acervo_colecoes set mudou_em = now() where id = k.id;
  return jsonb_build_object('ordem', to_jsonb(p_posts));
end $$;

/** A autora tira o post DELA de uma coleção (qualquer coleção, de qualquer dono). Ele não volta para essa coleção. */
create or replace function public.rede_acervo_colecao_tirar_meu(p_id uuid, p_post uuid) returns jsonb language plpgsql volatile security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu();
begin
  perform interno.aberta('comunidade');
  if not exists (select 1 from rede_posts where id = p_post and autor = v) then perform interno.erro('nao_encontrado'); end if;
  if not exists (select 1 from rede_acervo_colecoes where id = p_id) then perform interno.erro('nao_encontrado'); end if;
  perform interno.limite('alumia_acervo_por', 120, 60);
  delete from rede_acervo_colecao_itens where colecao = p_id and post = p_post;
  delete from rede_acervo_sugestoes where colecao = p_id and post = p_post;
  insert into rede_acervo_colecao_fora (colecao, post) values (p_id, p_post) on conflict do nothing;
  return jsonb_build_object('na_colecao', false);
end $$;

/** Quem é membro sugere um post para a coleção de uma comunidade. A sugestão não guarda quem sugeriu. */
create or replace function public.rede_acervo_sugerir(p_id uuid, p_post uuid) returns jsonb language plpgsql volatile security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); k rede_acervo_colecoes; x rede_posts;
begin
  perform interno.aberta('comunidade');
  if not interno.rede2_membro(v) then perform interno.erro('consentimento'); end if;
  k := interno.rede_acervo_colecao_ver(p_id, v);
  if k.comunidade is null then perform interno.erro('nao_encontrado'); end if;
  perform interno.limite('alumia_acervo_sugerir', 20, 60);
  select * into x from rede_posts where id = p_post;
  if not found or not interno.rede_ve(x, v) then perform interno.erro('nao_encontrado'); end if;
  if not interno.rede_acervo_cabe(k, x) then perform interno.erro('publico_nao_permite'); end if;
  if exists (select 1 from rede_acervo_colecao_fora where colecao = k.id and post = x.id) then perform interno.erro('autora_tirou'); end if;
  if exists (select 1 from rede_acervo_colecao_itens where colecao = k.id and post = x.id) then return jsonb_build_object('sugerido', true); end if;
  if (select count(*) from rede_acervo_sugestoes where colecao = k.id) >= 100 then perform interno.erro('invalido:muitas'); end if;
  insert into rede_acervo_sugestoes (colecao, post) values (k.id, x.id) on conflict do nothing;
  return jsonb_build_object('sugerido', true);
end $$;

/** Quem cuida descarta uma sugestão (aceitar é pôr o post na coleção). */
create or replace function public.rede_acervo_sugestao_descartar(p_id uuid, p_post uuid) returns jsonb language plpgsql volatile security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); k rede_acervo_colecoes;
begin
  perform interno.aberta('comunidade');
  k := interno.rede_acervo_colecao_ver(p_id, v);
  if not interno.rede_acervo_colecao_cuida(k, v) then perform interno.erro('sem_permissao'); end if;
  delete from rede_acervo_sugestoes where colecao = k.id and post = p_post;
  return jsonb_build_object('descartada', true);
end $$;

-- 3. Documentos do núcleo ───────────────────────────────────────────────────────────────────────────────────────────────────

/** Quem é da mediação do núcleo. */
create or replace function interno.rede_acervo_media(p_nucleo uuid, p_quem uuid) returns boolean language sql stable security definer set search_path = interno, pg_temp as $$
  select p_quem is not null and exists (select 1 from rede_nucleo_membros m where m.nucleo = p_nucleo and m.usuario = p_quem and m.papel = 'mediacao')
$$;

/** O núcleo, se p_quem é dele (e membro da Alumia). Senão 'nao_encontrado' (sem dizer se existe). */
create or replace function interno.rede_acervo_nucleo(p_nucleo uuid, p_quem uuid) returns uuid language plpgsql stable security definer set search_path = interno, pg_temp as $$
begin
  if p_nucleo is null or not interno.rede2_no_nucleo(p_nucleo, p_quem) or not interno.rede2_membro(p_quem) then perform interno.erro('nao_encontrado'); end if;
  return p_nucleo;
end $$;

/** O documento, se p_quem é do núcleo dele. */
create or replace function interno.rede_acervo_doc_de(p_id uuid, p_quem uuid) returns interno.rede_acervo_docs language plpgsql stable security definer set search_path = interno, pg_temp as $$
declare d rede_acervo_docs;
begin
  select * into d from rede_acervo_docs where id = p_id;
  if not found then perform interno.erro('nao_encontrado'); end if;
  perform interno.rede_acervo_nucleo(d.nucleo, p_quem);
  return d;
end $$;

/** Os documentos do núcleo (título, versão, data, tamanho), do editado mais recente ao mais antigo. */
create or replace function public.rede_acervo_docs(p_nucleo uuid) returns jsonb language plpgsql volatile security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu();
begin
  perform interno.aberta('comunidade');
  perform interno.rede_acervo_nucleo(p_nucleo, v);
  perform interno.limite('rede2_ler', 600, 60);
  return jsonb_build_object(
    'itens', (select coalesce(jsonb_agg(jsonb_build_object('id', d.id, 'titulo', d.titulo, 'versao', d.versao, 'editado_em', d.editado_em, 'tamanho', char_length(d.corpo))
              order by d.editado_em desc), '[]'::jsonb) from rede_acervo_docs d where d.nucleo = p_nucleo),
    'media', interno.rede_acervo_media(p_nucleo, v));
end $$;

/** Um documento (a versão atual, ou a pedida). Quem editou aquela versão: só para a mediação. */
create or replace function public.rede_acervo_doc(p_id uuid, p_versao integer default null) returns jsonb language plpgsql volatile security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); d rede_acervo_docs; x rede_acervo_doc_versoes; v_media boolean;
begin
  perform interno.aberta('comunidade');
  d := interno.rede_acervo_doc_de(p_id, v);
  perform interno.limite('rede2_ler', 600, 60);
  v_media := interno.rede_acervo_media(d.nucleo, v);
  if p_versao is not null then
    select * into x from rede_acervo_doc_versoes where doc = d.id and versao = p_versao;
    if not found then perform interno.erro('nao_encontrado'); end if;
    return jsonb_build_object('id', d.id, 'nucleo', d.nucleo, 'titulo', x.titulo, 'corpo', x.corpo, 'versao', x.versao, 'atual', d.versao,
      'editado_em', x.criado_em, 'resumo', x.resumo, 'editou', case when v_media then interno.rede_nome(x.editou) end, 'media', v_media);
  end if;
  return jsonb_build_object('id', d.id, 'nucleo', d.nucleo, 'titulo', d.titulo, 'corpo', d.corpo, 'versao', d.versao, 'atual', d.versao,
    'editado_em', d.editado_em, 'media', v_media);
end $$;

/**
 * Cria (p_id nulo) ou edita um documento do núcleo. p_base é a versão que a pessoa abriu: se outra pessoa salvou no meio,
 * 'conflito' (a tela mostra a versão nova e não perde o texto). Até 100 documentos por núcleo e 200 versões por documento.
 */
create or replace function public.rede_acervo_doc_salvar(p_nucleo uuid, p_id uuid, p_titulo text, p_corpo text, p_resumo text default '', p_base integer default null) returns jsonb
language plpgsql volatile security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); d rede_acervo_docs; v_tit text; v_corpo text; v_res text; v_ver integer; v_id uuid;
begin
  perform interno.aberta('comunidade');
  v_tit := interno.txt(p_titulo, 'titulo', 2, 120);
  v_corpo := interno.txt(p_corpo, 'corpo', 1, 50000);
  v_res := interno.txt(coalesce(p_resumo, ''), 'resumo', 0, 140);
  if v_corpo ~ '\d{3}\.\d{3}\.\d{3}-\d{2}' or v_tit ~ '\d{3}\.\d{3}\.\d{3}-\d{2}' then perform interno.erro('dado_pessoal'); end if;
  if p_id is null then
    perform interno.rede_acervo_nucleo(p_nucleo, v);
    perform interno.limite('alumia_acervo_doc', 60, 60);
    if (select count(*) from rede_acervo_docs where nucleo = p_nucleo) >= 100 then perform interno.erro('invalido:muitos'); end if;
    insert into rede_acervo_docs (nucleo, titulo, corpo) values (p_nucleo, v_tit, v_corpo) returning id into v_id;
    insert into rede_acervo_doc_versoes (doc, versao, titulo, corpo, resumo, editou) values (v_id, 1, v_tit, v_corpo, v_res, v);
    return jsonb_build_object('id', v_id, 'versao', 1);
  end if;
  d := interno.rede_acervo_doc_de(p_id, v);
  perform interno.limite('alumia_acervo_doc', 60, 60);
  select * into d from rede_acervo_docs where id = d.id for update;
  if p_base is null or p_base <> d.versao then perform interno.erro('conflito'); end if;
  if d.titulo = v_tit and d.corpo = v_corpo then return jsonb_build_object('id', d.id, 'versao', d.versao); end if;
  v_ver := d.versao + 1;
  update rede_acervo_docs set titulo = v_tit, corpo = v_corpo, versao = v_ver, editado_em = now() where id = d.id;
  insert into rede_acervo_doc_versoes (doc, versao, titulo, corpo, resumo, editou) values (d.id, v_ver, v_tit, v_corpo, v_res, v);
  delete from rede_acervo_doc_versoes where doc = d.id and versao <= v_ver - 200;
  return jsonb_build_object('id', d.id, 'versao', v_ver);
end $$;

/** O histórico de um documento: versão, data, resumo, tamanho. Quem editou: só para a mediação do núcleo. */
create or replace function public.rede_acervo_doc_historico(p_id uuid) returns jsonb language plpgsql volatile security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); d rede_acervo_docs; v_media boolean;
begin
  perform interno.aberta('comunidade');
  d := interno.rede_acervo_doc_de(p_id, v);
  perform interno.limite('rede2_ler', 600, 60);
  v_media := interno.rede_acervo_media(d.nucleo, v);
  return jsonb_build_object('media', v_media, 'versoes', (select coalesce(jsonb_agg(jsonb_build_object('versao', z.versao, 'criado_em', z.criado_em, 'resumo', z.resumo,
      'tamanho', char_length(z.corpo), 'editou', case when v_media then interno.rede_nome(z.editou) end) order by z.versao desc), '[]'::jsonb)
    from (select * from rede_acervo_doc_versoes where doc = d.id order by versao desc limit 100) z));
end $$;

/** Quem é do núcleo volta o documento para uma versão antiga: vira uma versão nova (o histórico não se perde). */
create or replace function public.rede_acervo_doc_restaurar(p_id uuid, p_versao integer) returns jsonb language plpgsql volatile security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); d rede_acervo_docs; x rede_acervo_doc_versoes;
begin
  perform interno.aberta('comunidade');
  d := interno.rede_acervo_doc_de(p_id, v);
  perform interno.limite('alumia_acervo_doc', 60, 60);
  select * into x from rede_acervo_doc_versoes where doc = d.id and versao = p_versao;
  if not found then perform interno.erro('nao_encontrado'); end if;
  select * into d from rede_acervo_docs where id = d.id for update;
  update rede_acervo_docs set titulo = x.titulo, corpo = x.corpo, versao = d.versao + 1, editado_em = now() where id = d.id;
  insert into rede_acervo_doc_versoes (doc, versao, titulo, corpo, resumo, editou) values (d.id, d.versao + 1, x.titulo, x.corpo, left('Volta à versão ' || p_versao, 140), v);
  return jsonb_build_object('id', d.id, 'versao', d.versao + 1);
end $$;

/** A mediação do núcleo apaga um documento inteiro (com as versões). */
create or replace function public.rede_acervo_doc_apagar(p_id uuid) returns jsonb language plpgsql volatile security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); d rede_acervo_docs;
begin
  perform interno.aberta('comunidade');
  d := interno.rede_acervo_doc_de(p_id, v);
  if not interno.rede_acervo_media(d.nucleo, v) then perform interno.erro('sem_permissao'); end if;
  delete from rede_acervo_docs where id = d.id;
  return jsonb_build_object('apagado', true);
end $$;

-- 4. Arquivos do núcleo ─────────────────────────────────────────────────────────────────────────────────────────────────────

/** A cota de cada núcleo, em bytes (entre 10 MB e 50 GB; valor estranho cai nos 200 MB). */
create or replace function interno.rede_acervo_cota() returns bigint language sql stable security definer set search_path = interno, pg_temp as $$
  select coalesce((select case when (valor ->> 'bytes') ~ '^[0-9]{1,12}$' and (valor ->> 'bytes')::bigint between 10485760 and 53687091200
                               then (valor ->> 'bytes')::bigint end
                   from configuracoes where chave = 'acervo_nucleo_cota'), 209715200)
$$;

/** Quanto o núcleo ocupa: os arquivos prontos e os envios reservados há menos de uma hora. */
create or replace function interno.rede_acervo_uso(p_nucleo uuid) returns bigint language sql stable security definer set search_path = interno, pg_temp as $$
  select coalesce(sum(tamanho), 0)::bigint from rede_acervo_arquivos
   where nucleo = p_nucleo and (situacao = 'pronto' or (situacao = 'reservado' and criado_em > now() - interval '1 hour'))
$$;

/** Os arquivos do núcleo (nome, tipo, tamanho, data), o espaço usado e a cota. */
create or replace function public.rede_acervo_arquivos(p_nucleo uuid) returns jsonb language plpgsql volatile security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu();
begin
  perform interno.aberta('comunidade');
  perform interno.rede_acervo_nucleo(p_nucleo, v);
  perform interno.limite('rede2_ler', 600, 60);
  return jsonb_build_object(
    'itens', (select coalesce(jsonb_agg(jsonb_build_object('id', a.id, 'nome', a.nome, 'ext', a.ext, 'tamanho', a.tamanho, 'criado_em', a.criado_em, 'caminho', a.caminho)
              order by a.criado_em desc), '[]'::jsonb) from rede_acervo_arquivos a where a.nucleo = p_nucleo and a.situacao = 'pronto'),
    'usado', interno.rede_acervo_uso(p_nucleo),
    'cota', interno.rede_acervo_cota(),
    'por_arquivo', 10485760,
    'media', interno.rede_acervo_media(p_nucleo, v));
end $$;

/**
 * Reserva o lugar de um arquivo novo (a rota do servidor chama depois de tirar os metadados, e só então guarda no depósito).
 * Devolve o caminho e um código para desfazer o envio por 15 minutos (o banco guarda só o hash do código).
 */
create or replace function public.rede_acervo_arquivo_reservar(p_nucleo uuid, p_nome text, p_ext text, p_tamanho bigint) returns jsonb language plpgsql volatile security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); v_nome text; v_id uuid := gen_random_uuid(); v_codigo text := replace(gen_random_uuid()::text, '-', ''); v_caminho text;
begin
  perform interno.aberta('comunidade');
  perform interno.rede_acervo_nucleo(p_nucleo, v);
  if coalesce(p_ext, '') not in ('pdf', 'jpg', 'png', 'webp') then perform interno.erro('invalido:tipo'); end if;
  if p_tamanho is null or p_tamanho < 1 or p_tamanho > 10485760 then perform interno.erro('invalido:tamanho'); end if;
  -- O nome que aparece na lista: sem caractere de controle nem barra (nunca vira caminho).
  v_nome := interno.txt(regexp_replace(coalesce(p_nome, ''), '[[:cntrl:]/\\]+', ' ', 'g'), 'nome', 1, 120);
  perform interno.limite('alumia_acervo_arquivo', 20, 60);
  delete from rede_acervo_arquivos where nucleo = p_nucleo and situacao = 'reservado' and criado_em < now() - interval '1 day';
  if (select count(*) from rede_acervo_arquivos where nucleo = p_nucleo and situacao <> 'apagado') >= 300 then perform interno.erro('invalido:muitos'); end if;
  if interno.rede_acervo_uso(p_nucleo) + p_tamanho > interno.rede_acervo_cota() then perform interno.erro('cota_cheia'); end if;
  v_caminho := p_nucleo::text || '/' || v_id::text || '.' || p_ext;
  insert into rede_acervo_arquivos (id, nucleo, nome, ext, tamanho, caminho, desfazer_hash, desfazer_ate)
  values (v_id, p_nucleo, v_nome, p_ext, p_tamanho, v_caminho, encode(sha256(convert_to(v_codigo, 'UTF8')), 'hex'), now() + interval '15 minutes');
  return jsonb_build_object('id', v_id, 'caminho', v_caminho, 'desfazer', v_codigo);
end $$;

/** Depois de guardar no depósito: o arquivo fica pronto. O tamanho é o que o depósito diz (quando há depósito). */
create or replace function public.rede_acervo_arquivo_confirmar(p_id uuid, p_tamanho bigint) returns jsonb language plpgsql volatile security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); a rede_acervo_arquivos; v_tam bigint := p_tamanho;
begin
  perform interno.aberta('comunidade');
  select * into a from rede_acervo_arquivos where id = p_id and situacao = 'reservado';
  if not found then perform interno.erro('nao_encontrado'); end if;
  perform interno.rede_acervo_nucleo(a.nucleo, v);
  if to_regclass('storage.objects') is not null then
    execute 'select case when (metadata ->> ''size'') ~ ''^[0-9]{1,15}$'' then (metadata ->> ''size'')::bigint end from storage.objects where bucket_id = ''rede-acervo'' and name = $1'
      into v_tam using a.caminho;
    if v_tam is null then perform interno.erro('nao_encontrado'); end if;
  end if;
  if v_tam is null or v_tam < 1 or v_tam > 10485760 then perform interno.erro('invalido:tamanho'); end if;
  update rede_acervo_arquivos set situacao = 'pronto', tamanho = v_tam, mudou_em = now() where id = a.id;
  return jsonb_build_object('id', a.id, 'tamanho', v_tam);
end $$;

/**
 * Apaga um arquivo do núcleo: a mediação, a qualquer hora; quem enviou, com o código de desfazer, nos primeiros 15 minutos. A linha
 * fica "apagado" até a rota tirar o arquivo do depósito (public.rede_acervo_arquivo_sumiu). Devolve o caminho.
 */
create or replace function public.rede_acervo_arquivo_apagar(p_id uuid, p_desfazer text default null) returns jsonb language plpgsql volatile security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); a rede_acervo_arquivos;
begin
  perform interno.aberta('comunidade');
  select * into a from rede_acervo_arquivos where id = p_id and situacao <> 'apagado';
  if not found then perform interno.erro('nao_encontrado'); end if;
  perform interno.rede_acervo_nucleo(a.nucleo, v);
  if not (interno.rede_acervo_media(a.nucleo, v)
          or (nullif(p_desfazer, '') is not null and a.desfazer_ate > now() and a.desfazer_hash = encode(sha256(convert_to(p_desfazer, 'UTF8')), 'hex'))) then
    perform interno.erro('sem_permissao');
  end if;
  update rede_acervo_arquivos set situacao = 'apagado', desfazer_hash = null, desfazer_ate = null, mudou_em = now() where id = a.id;
  return jsonb_build_object('id', a.id, 'caminho', a.caminho);
end $$;

/** O arquivo apagado já saiu do depósito: a linha some. */
create or replace function public.rede_acervo_arquivo_sumiu(p_id uuid) returns jsonb language plpgsql volatile security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); a rede_acervo_arquivos;
begin
  perform interno.aberta('comunidade');
  select * into a from rede_acervo_arquivos where id = p_id and situacao = 'apagado';
  if not found then return jsonb_build_object('sumiu', true); end if;
  perform interno.rede_acervo_nucleo(a.nucleo, v);
  delete from rede_acervo_arquivos where id = a.id;
  return jsonb_build_object('sumiu', true);
end $$;

/**
 * Regra do depósito "rede-acervo" (as políticas de storage.objects chamam com o nome do objeto): 'ler' só o arquivo pronto. Sempre
 * quem é do núcleo, membro da Alumia e passando pela entrada. 'enviar' e 'apagar' respondem sempre "não": só o servidor do site
 * grava (depois de limpar) e apaga, com a chave de serviço. Responde "não" em vez de erro, para o depósito recusar limpo.
 */
create or replace function public.rede_acervo_deposito_pode(p_nome text, p_acao text) returns boolean language sql stable security definer set search_path = interno, pg_temp as $$
  select interno.alumia_passa() and auth.uid() is not null and interno.rede2_membro(auth.uid()) and exists (
    select 1 from rede_acervo_arquivos a
     where a.caminho = p_nome and interno.rede2_no_nucleo(a.nucleo, auth.uid())
       and p_acao = 'ler' and a.situacao = 'pronto')
$$;

-- O depósito privado do acervo: PDF e imagem até 10 MB. Sem Storage (teste local), nada.
do $$
begin
  if exists (select 1 from pg_namespace where nspname = 'storage') and to_regclass('storage.buckets') is not null then
    insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    values ('rede-acervo', 'rede-acervo', false, 10485760, array['application/pdf', 'image/jpeg', 'image/png', 'image/webp'])
    on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;
    -- Sem regra de envio nem de remoção para quem tem conta: só a rota do servidor grava (o arquivo que ela limpou) e apaga.
    execute 'drop policy if exists "rede_acervo_envio" on storage.objects';
    execute 'drop policy if exists "rede_acervo_leitura" on storage.objects';
    execute 'create policy "rede_acervo_leitura" on storage.objects for select to authenticated using (bucket_id = ''rede-acervo'' and public.rede_acervo_deposito_pode(name, ''ler''))';
    execute 'drop policy if exists "rede_acervo_remocao" on storage.objects';
  end if;
end $$;

/**
 * A faxina das linhas (agendador, quando há): os envios que nunca ficaram prontos (reservados há mais de um dia) e os apagados cujo
 * arquivo já saiu do depósito (sem depósito, banco local, não há arquivo: a linha apagada sai depois de um dia). O arquivo em si sai
 * pela rota da faxina dos arquivos (public.rede_acervo_orfaos).
 */
create or replace function interno.rede_acervo_faxina() returns integer language plpgsql security definer set search_path = interno, pg_temp as $$
declare v_n integer; v_m integer := 0;
begin
  delete from rede_acervo_arquivos where situacao = 'reservado' and criado_em < now() - interval '1 day';
  get diagnostics v_n = row_count;
  if to_regclass('storage.objects') is not null then
    execute 'delete from interno.rede_acervo_arquivos a where a.situacao = ''apagado''
               and not exists (select 1 from storage.objects o where o.bucket_id = ''rede-acervo'' and o.name = a.caminho)';
  else
    delete from rede_acervo_arquivos where situacao = 'apagado' and mudou_em < now() - interval '1 day';
  end if;
  get diagnostics v_m = row_count;
  return v_n + v_m;
end $$;

/**
 * Para a faxina dos arquivos (só a chave de serviço; app/api/rede/exportar/faxina): os arquivos de "rede-acervo" que não estão
 * prontos nem num envio em curso: sem linha, com a linha apagada, ou reservados há mais de um dia. Sem depósito, lista vazia.
 */
create or replace function public.rede_acervo_orfaos(p_limite integer default 500) returns setof text language plpgsql stable security definer set search_path = interno, pg_temp as $$
begin
  if to_regclass('storage.objects') is null then return; end if;
  return query execute 'select o.name from storage.objects o where o.bucket_id = ''rede-acervo''
                          and not exists (select 1 from interno.rede_acervo_arquivos a where a.caminho = o.name
                                           and (a.situacao = ''pronto'' or (a.situacao = ''reservado'' and a.criado_em > now() - interval ''1 day'')))
                          and o.created_at < now() - interval ''1 hour'' order by o.created_at limit $1'
    using least(greatest(coalesce(p_limite, 500), 1), 2000);
end $$;

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule('lucia-alumia-acervo-faxina', '50 7 * * *', 'select interno.rede_acervo_faxina()');
  end if;
end $$;

-- 5. Arquivo por mês e exportar a comunidade ────────────────────────────────────────────────────────────────────────────────

/** Os meses que têm posts nesta comunidade (só os que esta pessoa vê), do mais novo ao mais antigo; o número só a partir de 3. */
create or replace function public.rede_acervo_meses(p_slug text) returns jsonb language plpgsql volatile security definer set search_path = interno, pg_temp as $$
declare v uuid := auth.uid(); c rede_comunidades;
begin
  perform interno.aberta('comunidade');
  c := interno.rede_alumia_com_ver(p_slug, v);
  perform interno.limite('rede2_ler', 600, 60);
  return jsonb_build_object('comunidade', c.slug, 'meses', (select coalesce(jsonb_agg(jsonb_build_object('mes', m.mes, 'posts', case when m.n >= 3 then m.n end) order by m.mes desc), '[]'::jsonb)
    from (select to_char(p.criado_em at time zone 'America/Sao_Paulo', 'YYYY-MM') as mes, count(*)::integer as n
            from rede_posts p where p.comunidade = c.slug and p.resposta_a is null and p.apagado_em is null and interno.rede_ve(p, v)
           group by 1 order by 1 desc limit 120) m));
end $$;

/** Os posts de um mês desta comunidade, do primeiro ao último (ordem de chegada). Cursor "<quando>|<post>". */
create or replace function public.rede_acervo_mes(p_slug text, p_mes text, p_cursor text default null) returns jsonb language plpgsql volatile security definer set search_path = interno, pg_temp as $$
declare v uuid := auth.uid(); c rede_comunidades; v_ini timestamptz; v_fim timestamptz; v_t timestamptz; v_id uuid; v_itens jsonb := '[]'::jsonb; v_prox text; v_n integer := 0; r record;
begin
  perform interno.aberta('comunidade');
  c := interno.rede_alumia_com_ver(p_slug, v);
  if coalesce(p_mes, '') !~ '^(20[2-9][0-9])-(0[1-9]|1[0-2])$' then perform interno.erro('invalido:mes'); end if;
  perform interno.limite('rede2_ler', 600, 60);
  v_ini := (p_mes || '-01')::timestamp at time zone 'America/Sao_Paulo';
  v_fim := ((p_mes || '-01')::timestamp + interval '1 month') at time zone 'America/Sao_Paulo';
  if nullif(p_cursor, '') is not null then
    begin
      v_t := split_part(p_cursor, '|', 1)::timestamptz; v_id := split_part(p_cursor, '|', 2)::uuid;
    exception when others then perform interno.erro('invalido:cursor');
    end;
  end if;
  for r in select p.* from rede_posts p
            where p.comunidade = c.slug and p.resposta_a is null and p.apagado_em is null and p.criado_em >= v_ini and p.criado_em < v_fim
              and (v_t is null or (p.criado_em, p.id) > (v_t, v_id)) and interno.rede_ve(p, v)
            order by p.criado_em, p.id limit 21 loop
    v_n := v_n + 1;
    if v_n > 20 then exit; end if;
    v_itens := v_itens || jsonb_build_array(interno.rede_post_v2((select x from rede_posts x where x.id = r.id), v));
    v_prox := r.criado_em::text || '|' || r.id::text;
  end loop;
  return jsonb_build_object('mes', p_mes, 'itens', v_itens, 'proximo', case when v_n > 20 then v_prox end);
end $$;

/**
 * Exportar a comunidade (só a moderação dela), em páginas de até 500 posts. A primeira página (cursor nulo) traz também a
 * comunidade, as regras, a wiki e as coleções. Posts: só os públicos (internet ou membros), no ar, da comunidade; comunidade
 * fechada não exporta posts. De pessoa, só o codinome do autor de cada post. Nada de quem curtiu, quem é membro, quem modera.
 */
create or replace function public.rede_acervo_exportar(p_slug text, p_cursor text default null) returns jsonb language plpgsql volatile security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); c rede_comunidades; v_t timestamptz; v_id uuid; v_posts jsonb := '[]'::jsonb; v_prox text; v_n integer := 0; r record; v_cabeca jsonb := '{}'::jsonb;
begin
  perform interno.aberta('comunidade');
  c := interno.rede_alumia_com_ver(p_slug, v);
  if not interno.rede3_com_modera(c.slug, v) then perform interno.erro('sem_permissao'); end if;
  perform interno.limite('alumia_acervo_exportar', 60, 60);
  if nullif(p_cursor, '') is not null then
    begin
      v_t := split_part(p_cursor, '|', 1)::timestamptz; v_id := split_part(p_cursor, '|', 2)::uuid;
    exception when others then perform interno.erro('invalido:cursor');
    end;
  else
    perform interno.registrar('alumia_acervo_exportar', c.slug, '{}'::jsonb);
    v_cabeca := jsonb_build_object(
      'comunidade', jsonb_build_object('slug', c.slug, 'nome', c.nome, 'descricao', c.descricao, 'categoria', c.categoria, 'tipo', c.tipo, 'criada_em', c.criada_em),
      'regras', (select coalesce(jsonb_agg(jsonb_build_object('numero', g.numero, 'titulo', g.titulo, 'texto', g.texto) order by g.numero), '[]'::jsonb)
                 from rede_comunidade_regras g where g.comunidade = c.slug),
      'wiki', (select coalesce(jsonb_agg(jsonb_build_object('pagina', w.pagina, 'titulo', w.titulo, 'corpo', w.corpo, 'versao', w.versao, 'editado_em', w.editado_em) order by w.titulo), '[]'::jsonb)
               from rede_alumia_wiki w where w.comunidade = c.slug),
      'colecoes', (select coalesce(jsonb_agg(jsonb_build_object('titulo', k.titulo, 'descricao', k.descricao,
                     'posts', (select coalesce(jsonb_agg(i.post order by i.ordem), '[]'::jsonb) from rede_acervo_colecao_itens i join rede_posts p on p.id = i.post
                               where i.colecao = k.id and p.comunidade = c.slug and p.apagado_em is null and not p.oculto and not p.retido
                                 and interno.rede2_publico(p) in ('internet', 'membros') and c.tipo <> 'fechada')) order by k.titulo), '[]'::jsonb)
                   from rede_acervo_colecoes k where k.comunidade = c.slug),
      'exportado_em', now(),
      'regra', 'posts públicos (internet ou membros) no ar; de pessoa, só o codinome do autor de cada post');
  end if;
  if c.tipo <> 'fechada' then
    for r in select p.id, p.criado_em, p.tipo, p.titulo, p.texto, p.corpo, p.resposta_a, p.autor from rede_posts p
              where p.comunidade = c.slug and p.apagado_em is null and not p.oculto and not p.retido
                and interno.rede2_publico(p) in ('internet', 'membros')
                and (v_t is null or (p.criado_em, p.id) > (v_t, v_id))
              order by p.criado_em, p.id limit 501 loop
      v_n := v_n + 1;
      if v_n > 500 then exit; end if;
      v_posts := v_posts || jsonb_build_array(jsonb_build_object('id', r.id, 'criado_em', r.criado_em, 'tipo', r.tipo, 'titulo', r.titulo, 'texto', r.texto,
        'corpo', r.corpo, 'resposta_a', r.resposta_a, 'autor', interno.rede_nome(r.autor)));
      v_prox := r.criado_em::text || '|' || r.id::text;
    end loop;
  end if;
  return v_cabeca || jsonb_build_object('posts', v_posts, 'proximo', case when v_n > 500 then v_prox end);
end $$;

-- 6. Acabamento da wiki ─────────────────────────────────────────────────────────────────────────────────────────────────────

/**
 * Pode editar a wiki desta comunidade? (a mesma de 20261110-alumia-b1-comunidade.sql, agora com a regra da comunidade). A moderação
 * sempre; quem é dela, membro da Alumia e não banido, com o nível que a regra pede: 'membros' (1 ou mais, o padrão), 'experientes'
 * (2 ou mais) ou 'moderacao' (só a moderação).
 */
create or replace function interno.rede_alumia_wiki_edita(p_slug text, p_quem uuid) returns boolean language sql stable security definer set search_path = interno, pg_temp as $$
  select p_quem is not null and interno.rede2_membro(p_quem) and (interno.rede3_com_modera(p_slug, p_quem)
    or (interno.rede3_com_situacao(p_slug, p_quem) = 'membro'
        and interno.rede3_mod_nivel(p_quem) >= case coalesce((select r.quem from rede_acervo_wiki_regra r where r.comunidade = p_slug), 'membros')
                                                when 'membros' then 1 when 'experientes' then 2 else 32000 end))
$$;

/** Pode desfazer a última edição desta página? A moderação, sempre; quem editou por último, por 30 minutos e se ainda edita. */
create or replace function interno.rede_acervo_wiki_desfaz(p_slug text, p_pagina text, p_quem uuid) returns boolean language sql stable security definer set search_path = interno, pg_temp as $$
  select p_quem is not null and exists (
    select 1 from rede_alumia_wiki w join rede_alumia_wiki_versoes x on x.comunidade = w.comunidade and x.pagina = w.pagina and x.versao = w.versao
     where w.comunidade = p_slug and w.pagina = p_pagina and w.versao > 1
       and exists (select 1 from rede_alumia_wiki_versoes y where y.comunidade = w.comunidade and y.pagina = w.pagina and y.versao = w.versao - 1)
       and (interno.rede3_com_modera(p_slug, p_quem)
            or (x.editou = p_quem and x.criado_em > now() - interval '30 minutes' and not w.travada and interno.rede_alumia_wiki_edita(p_slug, p_quem))))
$$;

/** A regra de quem edita a wiki desta comunidade e, com p_pagina, se esta pessoa pode desfazer a última edição dela. */
create or replace function public.rede_acervo_wiki_regras(p_slug text, p_pagina text default null) returns jsonb language plpgsql volatile security definer set search_path = interno, pg_temp as $$
declare v uuid := auth.uid(); c rede_comunidades;
begin
  perform interno.aberta('comunidade');
  c := interno.rede_alumia_com_ver(p_slug, v);
  perform interno.limite('rede2_ler', 600, 60);
  return jsonb_build_object(
    'quem', coalesce((select quem from rede_acervo_wiki_regra where comunidade = c.slug), 'membros'),
    'modera', v is not null and interno.rede3_com_modera(c.slug, v),
    'pode_desfazer', nullif(p_pagina, '') is not null and interno.rede_acervo_wiki_desfaz(c.slug, p_pagina, v));
end $$;

/** A moderação escolhe quem edita a wiki: 'membros', 'experientes' ou 'moderacao'. */
create or replace function public.rede_acervo_wiki_quem(p_slug text, p_quem text) returns jsonb language plpgsql volatile security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); c rede_comunidades;
begin
  perform interno.aberta('comunidade');
  c := interno.rede_alumia_com_ver(p_slug, v);
  if not interno.rede3_com_modera(c.slug, v) then perform interno.erro('sem_permissao'); end if;
  if coalesce(p_quem, '') not in ('membros', 'experientes', 'moderacao') then perform interno.erro('invalido:quem'); end if;
  perform interno.limite('alumia_wiki', 30, 60);
  insert into rede_acervo_wiki_regra (comunidade, quem) values (c.slug, p_quem)
  on conflict (comunidade) do update set quem = excluded.quem, mudou_em = now();
  perform interno.registrar('alumia_wiki_quem', c.slug, jsonb_build_object('quem', p_quem));
  return jsonb_build_object('quem', p_quem);
end $$;

/** Desfaz a última edição da página: o texto da versão anterior volta como uma versão nova (o histórico não se perde). */
create or replace function public.rede_acervo_wiki_desfazer(p_slug text, p_pagina text) returns jsonb language plpgsql volatile security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); c rede_comunidades; w rede_alumia_wiki; x rede_alumia_wiki_versoes;
begin
  perform interno.aberta('comunidade');
  c := interno.rede_alumia_com_ver(p_slug, v);
  perform interno.limite('alumia_wiki', 30, 60);
  select * into w from rede_alumia_wiki where comunidade = c.slug and pagina = p_pagina for update;
  if not found then perform interno.erro('nao_encontrado'); end if;
  if not interno.rede_acervo_wiki_desfaz(c.slug, w.pagina, v) then perform interno.erro('sem_permissao'); end if;
  select * into x from rede_alumia_wiki_versoes where comunidade = c.slug and pagina = w.pagina and versao = w.versao - 1;
  update rede_alumia_wiki set titulo = x.titulo, corpo = x.corpo, versao = w.versao + 1, editado_em = now() where comunidade = c.slug and pagina = w.pagina;
  insert into rede_alumia_wiki_versoes (comunidade, pagina, versao, titulo, corpo, resumo, editou)
  values (c.slug, w.pagina, w.versao + 1, x.titulo, x.corpo, left('Desfeita a versão ' || w.versao, 140), v);
  return jsonb_build_object('pagina', w.pagina, 'versao', w.versao + 1);
end $$;

-- 7. Permissões ─────────────────────────────────────────────────────────────────────────────────────────────────────────────
do $$
declare f text;
begin
  foreach f in array array[
    'interno.rede_acervo_dono(text, uuid)', 'interno.rede_acervo_colecao_ver(uuid, uuid)', 'interno.rede_acervo_colecao_cuida(interno.rede_acervo_colecoes, uuid)',
    'interno.rede_acervo_cabe(interno.rede_acervo_colecoes, interno.rede_posts)', 'interno.rede_acervo_media(uuid, uuid)', 'interno.rede_acervo_nucleo(uuid, uuid)',
    'interno.rede_acervo_doc_de(uuid, uuid)', 'interno.rede_acervo_cota()', 'interno.rede_acervo_uso(uuid)', 'interno.rede_acervo_faxina()',
    'public.rede_acervo_orfaos(integer)',
    'interno.rede_acervo_wiki_desfaz(text, text, uuid)',
    'public.rede_acervo_colecoes(text, text)', 'public.rede_acervo_colecao(uuid)', 'public.rede_acervo_colecao_salvar(uuid, text, text, text)',
    'public.rede_acervo_colecao_apagar(uuid)', 'public.rede_acervo_colecao_por(uuid, uuid, boolean, text)', 'public.rede_acervo_colecao_ordem(uuid, uuid[])',
    'public.rede_acervo_colecao_tirar_meu(uuid, uuid)', 'public.rede_acervo_sugerir(uuid, uuid)', 'public.rede_acervo_sugestao_descartar(uuid, uuid)',
    'public.rede_acervo_docs(uuid)', 'public.rede_acervo_doc(uuid, integer)', 'public.rede_acervo_doc_salvar(uuid, uuid, text, text, text, integer)',
    'public.rede_acervo_doc_historico(uuid)', 'public.rede_acervo_doc_restaurar(uuid, integer)', 'public.rede_acervo_doc_apagar(uuid)',
    'public.rede_acervo_arquivos(uuid)', 'public.rede_acervo_arquivo_reservar(uuid, text, text, bigint)', 'public.rede_acervo_arquivo_confirmar(uuid, bigint)',
    'public.rede_acervo_arquivo_apagar(uuid, text)', 'public.rede_acervo_arquivo_sumiu(uuid)', 'public.rede_acervo_deposito_pode(text, text)',
    'public.rede_acervo_meses(text)', 'public.rede_acervo_mes(text, text, text)', 'public.rede_acervo_exportar(text, text)',
    'public.rede_acervo_wiki_regras(text, text)', 'public.rede_acervo_wiki_quem(text, text)', 'public.rede_acervo_wiki_desfazer(text, text)'] loop
    execute format('revoke all on function %s from public', f);
    if exists (select 1 from pg_roles where rolname = 'anon') then
      execute format('revoke all on function %s from anon, authenticated', f);
    end if;
  end loop;
  if exists (select 1 from pg_roles where rolname = 'anon') then
    -- A lista dos arquivos órfãos: só a rota da faxina, com a chave de serviço.
    execute 'grant execute on function public.rede_acervo_orfaos(integer) to service_role';
    -- Leitura do que é aberto (a coleção, o arquivo por mês, a regra da wiki): com ou sem conta; a função confere quem vê.
    foreach f in array array['public.rede_acervo_colecoes(text, text)', 'public.rede_acervo_colecao(uuid)', 'public.rede_acervo_meses(text)',
                             'public.rede_acervo_mes(text, text, text)', 'public.rede_acervo_wiki_regras(text, text)'] loop
      execute format('grant execute on function %s to anon, authenticated, service_role', f);
    end loop;
    -- O resto: só com conta.
    foreach f in array array['public.rede_acervo_colecao_salvar(uuid, text, text, text)', 'public.rede_acervo_colecao_apagar(uuid)',
                             'public.rede_acervo_colecao_por(uuid, uuid, boolean, text)', 'public.rede_acervo_colecao_ordem(uuid, uuid[])',
                             'public.rede_acervo_colecao_tirar_meu(uuid, uuid)', 'public.rede_acervo_sugerir(uuid, uuid)', 'public.rede_acervo_sugestao_descartar(uuid, uuid)',
                             'public.rede_acervo_docs(uuid)', 'public.rede_acervo_doc(uuid, integer)', 'public.rede_acervo_doc_salvar(uuid, uuid, text, text, text, integer)',
                             'public.rede_acervo_doc_historico(uuid)', 'public.rede_acervo_doc_restaurar(uuid, integer)', 'public.rede_acervo_doc_apagar(uuid)',
                             'public.rede_acervo_arquivos(uuid)', 'public.rede_acervo_arquivo_reservar(uuid, text, text, bigint)', 'public.rede_acervo_arquivo_confirmar(uuid, bigint)',
                             'public.rede_acervo_arquivo_apagar(uuid, text)', 'public.rede_acervo_arquivo_sumiu(uuid)', 'public.rede_acervo_deposito_pode(text, text)',
                             'public.rede_acervo_exportar(text, text)', 'public.rede_acervo_wiki_quem(text, text)', 'public.rede_acervo_wiki_desfazer(text, text)'] loop
      execute format('grant execute on function %s to authenticated, service_role', f);
    end loop;
  end if;
end $$;

-- 8. A porta em todas as funções novas de membro ─────────────────────────────────────────────────────────────────────────────
do $$
declare v jsonb := interno.alumia_trancar();
begin
  if jsonb_array_length(v -> 'abertas') > 0 then
    raise warning 'alumia_trancar: função sem porta: %', v -> 'abertas';
  end if;
end $$;
