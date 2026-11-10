-- Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
--
-- ═══════════════════════════ Alumia · B1 · stories: o back-end que faltava (10/11/2026) ═══════════════════════════
-- docs/plano-2026-11/ALUMIA-ATE-O-FIM.md (B1) e PLANO-ALUMIA §6, F5 e §12. Por cima da F5 (20261109-alumia-f5.sql) e dos stories
-- com vídeo (20261110-alumia-stories-video.sql), sem tirar nada deles:
--   1. "PÔR NO STORY" DE VERDADE: o story devolve o cartão do post ou do ato de onde veio (só o que quem vê pode ver; o ato com a
--      data e a cidade, nunca o ponto exato nem quem vai) e o "criar" pede a prévia do post (rede_story_post).
--   2. RESPOSTAS E REAÇÕES COM VOLTA: a autora lista as respostas de cada story (rede_story_respostas, rede_story_caixa), marca as
--      que vieram da figurinha de pergunta e pode publicar uma delas num story novo (figurinha "resposta", sem o nome de quem
--      respondeu); vê o total das reações do story só a partir de 3 (nunca quem reagiu).
--   3. FIGURINHAS NOVAS: decorativas da Alumia (punho, lampião, megafone, faixa, carimbos…, lista fechada), "vou" (confirmar
--      presença no ato pelo story, total só a partir de 3 e arredondado), menção a pessoa (com aviso para ela, bloqueio vale),
--      #campanha e "Adicionar o seu" (corrente da campanha, total de pessoas só a partir de 3).
--   4. RODA DE CONFIANÇA: lista pessoal e privada (rede_roda). O público "proximos" passa a ser a roda da autora, não mais "seguir
--      um ao outro" (um infiltrado que segue de volta não entra na roda). Ninguém sabe em que rodas está, nem quantas pessoas
--      estão na roda de alguém.
--   5. DESTAQUES ARRUMÁVEIS: ordem dos destaques e dos stories dentro deles, capa escolhida e trocar a foto de um story guardado
--      pela versão borrada de novo (o "borrar de novo" de quando um story vira destaque).
--   6. MENÇÃO A COMUNIDADE QUE LEVA A ALGUM LUGAR: a página da comunidade lista os stories que a mencionam (os que eu vejo), a
--      moderação recebe UM aviso agregado por dia, e um público novo "só esta comunidade" (membros ativos dela).
--   7. VÍDEO: legendas (geradas e aprovadas pela autora no aparelho, com o tempo de cada uma) e a música opcional da própria Alumia
--      (gerada no aparelho, lista fechada: nada de serviço de terceiros, ninguém fica sabendo quem ouviu o quê).
-- Idempotente (scripts/testar-alumia-b1-stories.mjs roda duas vezes no banco local). NÃO roda em produção sem o Jonathan.
--
-- Privacidade (leis conferidas no texto, leis-do-brasil):
--   * LGPD (Lei 13.709/2018) art. 5º, II e art. 11: opinião política é dado sensível. Continua NÃO existindo quem viu; quem reagiu,
--     quem vai e quem entrou na corrente nunca saem, nem para a autora: só totais a partir de 3. A roda de confiança é só da dona.
--   * LGPD art. 6º, III (necessidade): a resposta publicada num story novo vai sem o nome de quem respondeu; o cartão do ato leva
--     a cidade, nunca o ponto; a música é gerada no aparelho (nenhum pedido a terceiro).
--   * ECA Digital (Lei 15.211/2025) art. 9º § 1º: só membro 18+ publica ou vê (as mesmas regras da F5).
--   * Stories, roda e menções nunca federam (PLANO §6.8): nada daqui entra nas tabelas rede_fed_*.

-- ── 1. Colunas e regras novas ─────────────────────────────────────────────────────────────────────────────────────────────
alter table interno.rede_story_respostas add column if not exists pergunta boolean not null default false;
alter table interno.rede_story_destaques add column if not exists ordem smallint not null default 0;
alter table interno.rede_story_destaques add column if not exists capa uuid references interno.rede_stories (id) on delete set null;
alter table interno.rede_story_no_destaque add column if not exists ordem integer not null default 0;
alter table interno.rede_stories add column if not exists comunidade text references interno.rede_comunidades (slug) on delete cascade on update cascade;
alter table interno.rede_stories add column if not exists legendas jsonb not null default '[]'::jsonb;
alter table interno.rede_stories add column if not exists musica text;

alter table interno.rede_stories drop constraint if exists rede_stories_publico_check;
alter table interno.rede_stories add constraint rede_stories_publico_check check (publico in ('seguidores', 'membros', 'proximos', 'comunidade'));
alter table interno.rede_stories drop constraint if exists rede_stories_comunidade;
alter table interno.rede_stories add constraint rede_stories_comunidade check ((publico = 'comunidade') = (comunidade is not null));
alter table interno.rede_stories drop constraint if exists rede_stories_legendas;
alter table interno.rede_stories add constraint rede_stories_legendas check (jsonb_typeof(legendas) = 'array' and jsonb_array_length(legendas) <= 40 and pg_column_size(legendas) <= 8192);
alter table interno.rede_stories drop constraint if exists rede_stories_musica;
alter table interno.rede_stories add constraint rede_stories_musica check (musica is null or (fundo = 'video' and musica in ('batucada', 'marcha', 'ciranda', 'tambor')));
create index if not exists rede_stories_comunidade on interno.rede_stories (comunidade) where comunidade is not null;

alter table interno.rede_story_figurinhas drop constraint if exists rede_story_figurinhas_tipo_check;
alter table interno.rede_story_figurinhas add constraint rede_story_figurinhas_tipo_check
  check (tipo in ('contagem', 'pergunta', 'enquete', 'link', 'comunidade', 'decorativa', 'resposta', 'vou', 'pessoa', 'campanha'));
-- Até 3 interativas e 3 decorativas (6 no total, ordem 0..5).
alter table interno.rede_story_figurinhas drop constraint if exists rede_story_figurinhas_ordem_check;
alter table interno.rede_story_figurinhas add constraint rede_story_figurinhas_ordem_check check (ordem between 0 and 5);
-- A menção (a comunidade, a pessoa, a campanha) fica achável sem varrer o JSON de todas as figurinhas.
create index if not exists rede_story_figurinhas_comunidade on interno.rede_story_figurinhas ((dados ->> 'slug')) where tipo = 'comunidade';
create index if not exists rede_story_figurinhas_campanha on interno.rede_story_figurinhas ((dados ->> 'tag')) where tipo = 'campanha';

-- ── 2. Tabelas novas ──────────────────────────────────────────────────────────────────────────────────────────────────────
-- A roda de confiança: lista pessoal e privada. Só a dona lê a própria (nenhuma função devolve "em que rodas estou").
create table if not exists interno.rede_roda (
  dono uuid not null references interno.perfis (id) on delete cascade,
  membro uuid not null references interno.perfis (id) on delete cascade,
  criado_em timestamptz not null default now(),
  primary key (dono, membro),
  check (dono <> membro)
);
create index if not exists rede_roda_membro on interno.rede_roda (membro);

-- O aviso agregado da menção a comunidade: um por comunidade e por dia, para cada pessoa da moderação.
create table if not exists interno.rede_story_mencao_aviso (
  comunidade text not null references interno.rede_comunidades (slug) on delete cascade on update cascade,
  dia date not null,
  para uuid not null references interno.perfis (id) on delete cascade,
  aviso uuid references interno.avisos (id) on delete set null,
  n integer not null default 0,
  primary key (comunidade, dia, para)
);

do $$
declare t text;
begin
  foreach t in array array['rede_roda', 'rede_story_mencao_aviso'] loop
    execute format('alter table interno.%I enable row level security', t);
    execute format('revoke all on table interno.%I from public', t);
    if exists (select 1 from pg_roles where rolname = 'anon') then
      execute format('revoke all on table interno.%I from anon, authenticated', t);
    end if;
  end loop;
end $$;

-- ── 3. Quem vê: a roda e a comunidade ────────────────────────────────────────────────────────────────────────────────────
/**
 * A regra de público (a mesma para o story vivo e o guardado num destaque). Novo: "proximos" é a RODA DE CONFIANÇA da autora (não
 * mais seguir um ao outro) e "comunidade" é quem é membro ativo da comunidade escolhida. O resto é o da F5.
 */
create or replace function interno.rede5_story_regra(s interno.rede_stories, p_quem uuid) returns boolean language sql stable security definer set search_path = interno, pg_temp as $$
  select s.id is not null and p_quem is not null and (
    s.autor = p_quem
    or (not s.retido
        and interno.rede2_membro(p_quem) and interno.rede2_membro(s.autor)
        and not interno.rede_bloqueado(p_quem, s.autor)
        and case s.publico
          when 'membros' then true
          when 'seguidores' then exists (select 1 from rede_seguindo g where g.quem = p_quem and g.segue = s.autor and not g.pendente)
          when 'proximos' then exists (select 1 from rede_roda r where r.dono = s.autor and r.membro = p_quem)
          when 'comunidade' then s.comunidade is not null
            and exists (select 1 from rede_comunidade_membros m where m.comunidade = s.comunidade and m.usuario = p_quem and m.situacao = 'ativo')
          else false end))
$$;

-- ── 4. O que o story mostra ──────────────────────────────────────────────────────────────────────────────────────────────
/**
 * O cartão do post ou do ato do "Pôr no story", como `p_quem` pode vê-lo: o post (autora, o começo do texto) ou o ato (nome, data,
 * cidade e situação; nunca o ponto exato nem quem vai). Sem permissão, ou apagado: só "indisponível" (sem dizer o porquê).
 */
create or replace function interno.rede5_story_post(p_post uuid, p_quem uuid) returns jsonb language plpgsql stable security definer set search_path = interno, pg_temp as $$
declare p rede_posts; c rede_chamados;
begin
  if p_post is null then return null; end if;
  select * into p from rede_posts where id = p_post;
  if not found or p.apagado_em is not null or p.oculto or p.retido or p_quem is null or not interno.rede2_pode_ver(p, p_quem) then
    return jsonb_build_object('tipo', 'indisponivel', 'id', null);
  end if;
  select * into c from rede_chamados where post = p.id;
  if found then
    return jsonb_build_object('tipo', 'ato', 'id', p.id, 'autora', interno.rede5_story_autora(p.autor),
      'titulo', left(coalesce(nullif(btrim(coalesce(c.titulo, '')), ''), nullif(btrim(coalesce(p.titulo, '')), ''), btrim(p.texto)), 80),
      'inicio', c.inicio, 'cidade', c.cidade, 'tipo_do_ato', c.tipo,
      'situacao', case when c.cancelado or c.situacao = 'cancelado' then 'cancelado' when c.situacao = 'adiado' then 'adiado' else 'confirmado' end);
  end if;
  return jsonb_build_object('tipo', 'post', 'id', p.id, 'autora', interno.rede5_story_autora(p.autor),
    'texto', left(coalesce(nullif(btrim(coalesce(p.titulo, '')), ''), btrim(p.texto)), 180), 'criado_em', p.criado_em, 'aviso', nullif(p.aviso, ''));
end $$;

/** As reações de um story para a autora: só totais, e só a partir de 3 (abaixo disso, "poucas"). Nunca quem. */
create or replace function interno.rede5_story_reacoes(p_story uuid) returns jsonb language sql stable security definer set search_path = interno, pg_temp as $$
  select jsonb_build_object(
    'total', case when count(*) >= 3 then count(*)::integer end,
    'poucas', count(*) between 1 and 2,
    'por', jsonb_build_object(
      'punho', case when count(*) filter (where reacao = 'punho') >= 3 then (count(*) filter (where reacao = 'punho'))::integer end,
      'chama', case when count(*) filter (where reacao = 'chama') >= 3 then (count(*) filter (where reacao = 'chama'))::integer end,
      'coracao', case when count(*) filter (where reacao = 'coracao') >= 3 then (count(*) filter (where reacao = 'coracao'))::integer end))
  from rede_story_reacoes where story = p_story
$$;

/** Um total de pessoas para mostrar a todos: nulo abaixo de 3; de 10 para cima, arredondado para baixo de 5 em 5 ("mais de 25"). */
create or replace function interno.rede5_story_total(p_n bigint) returns integer language sql immutable security definer set search_path = interno, pg_temp as $$
  select case when coalesce(p_n, 0) < 3 then null when p_n < 10 then p_n::integer else ((p_n / 5) * 5)::integer end
$$;

/** Uma figurinha como `p_quem` a vê: a F5, a menção de comunidade e as novas (decorativa, resposta, vou, pessoa, campanha). */
create or replace function interno.rede5_story_figurinha(f interno.rede_story_figurinhas, s interno.rede_stories, p_quem uuid) returns jsonb language plpgsql stable security definer set search_path = interno, pg_temp as $$
declare v_ato uuid; p rede_posts; ch rede_chamados; v_n0 integer; v_n1 integer; c rede_comunidades; v_quem uuid; v_n bigint;
begin
  if f.tipo = 'contagem' then
    begin v_ato := (f.dados ->> 'ato')::uuid; exception when others then v_ato := null; end;
    if v_ato is not null then
      select * into p from rede_posts where id = v_ato;
      if not found or not interno.rede2_pode_ver(p, p_quem) then v_ato := null; end if;
    end if;
    return jsonb_build_object('tipo', 'contagem', 'ato', v_ato, 'titulo', f.dados ->> 'titulo', 'inicio', f.dados ->> 'inicio',
      'avisar', v_ato is not null and exists (select 1 from rede_story_lembretes l where l.ato = v_ato and l.quem = p_quem));
  elsif f.tipo = 'pergunta' then
    return jsonb_build_object('tipo', 'pergunta', 'texto', f.dados ->> 'texto');
  elsif f.tipo = 'enquete' then
    if s.autor = p_quem then
      select count(*) filter (where opcao = 0)::integer, count(*) filter (where opcao = 1)::integer into v_n0, v_n1 from rede_story_votos where story = s.id;
    end if;
    return jsonb_build_object('tipo', 'enquete', 'pergunta', f.dados ->> 'pergunta', 'opcoes', f.dados -> 'opcoes',
      'meu_voto', (select v.opcao from rede_story_votos v where v.story = s.id and v.quem = p_quem and s.autor <> p_quem),
      'soma', case when s.autor = p_quem and v_n0 + v_n1 >= 3 then jsonb_build_array(v_n0, v_n1) end);
  elsif f.tipo = 'comunidade' then
    select * into c from rede_comunidades where slug = f.dados ->> 'slug';
    if not found then return jsonb_build_object('tipo', 'comunidade', 'slug', null, 'nome', f.dados ->> 'nome'); end if;
    if c.tipo <> 'aberta' and not exists (select 1 from rede_comunidade_membros m where m.comunidade = c.slug and m.usuario = p_quem and m.situacao = 'ativo') then
      return jsonb_build_object('tipo', 'comunidade', 'slug', null, 'nome', c.nome);
    end if;
    return jsonb_build_object('tipo', 'comunidade', 'slug', c.slug, 'nome', c.nome);
  elsif f.tipo = 'decorativa' then
    return jsonb_build_object('tipo', 'decorativa', 'nome', f.dados ->> 'nome');
  elsif f.tipo = 'resposta' then
    -- A pergunta e a resposta, sem quem respondeu (a autora escolheu publicar; o nome nunca foi guardado aqui).
    return jsonb_build_object('tipo', 'resposta', 'pergunta', f.dados ->> 'pergunta', 'texto', f.dados ->> 'texto');
  elsif f.tipo = 'vou' then
    begin v_ato := (f.dados ->> 'ato')::uuid; exception when others then v_ato := null; end;
    if v_ato is not null then
      select * into p from rede_posts where id = v_ato;
      if not found or p.apagado_em is not null or not interno.rede2_pode_ver(p, p_quem) then v_ato := null; end if;
    end if;
    if v_ato is not null then
      select * into ch from rede_chamados where post = v_ato;
      select count(*) into v_n from rede_vou where post = v_ato;
    end if;
    return jsonb_build_object('tipo', 'vou', 'ato', v_ato, 'titulo', f.dados ->> 'titulo', 'inicio', coalesce(ch.inicio::text, f.dados ->> 'inicio'),
      'cidade', f.dados ->> 'cidade', 'vou_eu', v_ato is not null and exists (select 1 from rede_vou u where u.post = v_ato and u.usuario = p_quem),
      'total', case when v_ato is not null then interno.rede5_story_total(v_n) end,
      'encerrado', v_ato is null or ch.cancelado or coalesce(ch.situacao, '') = 'cancelado' or ch.inicio < now() - interval '6 hours');
  elsif f.tipo = 'pessoa' then
    begin v_quem := (f.dados ->> 'perfil')::uuid; exception when others then v_quem := null; end;
    if v_quem is null or interno.rede_bloqueado(p_quem, v_quem) or not interno.rede2_membro(v_quem)
       or not exists (select 1 from perfis where id = v_quem and rede_handle is not null) then
      return jsonb_build_object('tipo', 'pessoa', 'handle', null, 'nome', '');
    end if;
    return jsonb_build_object('tipo', 'pessoa', 'handle', (select rede_handle from perfis where id = v_quem), 'nome', interno.rede_nome(v_quem));
  elsif f.tipo = 'campanha' then
    if coalesce((f.dados ->> 'corrente')::boolean, false) then
      -- Quantas PESSOAS entraram na corrente (stories no ar com a mesma #): só a partir de 3, arredondado.
      select count(distinct x.autor) into v_n from rede_story_figurinhas g join rede_stories x on x.id = g.story
      where g.tipo = 'campanha' and g.dados ->> 'tag' = f.dados ->> 'tag' and coalesce((g.dados ->> 'corrente')::boolean, false)
        and x.expira_em > now() and not x.retido;
    end if;
    return jsonb_build_object('tipo', 'campanha', 'tag', f.dados ->> 'tag', 'corrente', coalesce((f.dados ->> 'corrente')::boolean, false),
      'total', interno.rede5_story_total(v_n));
  else
    return jsonb_build_object('tipo', 'link', 'url', f.dados ->> 'url', 'rotulo', f.dados ->> 'rotulo');
  end if;
end $$;

/**
 * O story inteiro como `p_quem` o vê. Novo: o cartão do post/ato ("post"), a comunidade do público, as legendas e a música do
 * vídeo; para a autora, quantas respostas chegaram (mensagens, não pessoas) e as reações só a partir de 3.
 */
create or replace function interno.rede5_story_json(s interno.rede_stories, p_quem uuid) returns jsonb language sql stable security definer set search_path = interno, pg_temp as $$
  select jsonb_build_object(
    'id', s.id, 'autora', interno.rede5_story_autora(s.autor), 'criado_em', s.criado_em, 'expira_em', s.expira_em, 'publico', s.publico,
    'comunidade', case when s.comunidade is not null then (select jsonb_build_object('slug', c.slug, 'nome', c.nome) from rede_comunidades c where c.slug = s.comunidade) end,
    'fundo', case
      when s.fundo = 'imagem' then jsonb_build_object('tipo', 'imagem', 'cor', s.cor, 'caminho', s.midia_caminho, 'url', '', 'alt', coalesce(s.alt, ''))
      when s.fundo = 'video' then jsonb_build_object('tipo', 'video', 'cor', s.cor, 'caminho', s.midia_caminho, 'url', '', 'alt', coalesce(s.alt, ''),
                                                     'duracao', s.duracao_ms, 'som', s.som)
      else jsonb_build_object('tipo', s.fundo, 'cor', s.cor) end,
    'texto', s.texto, 'legenda', s.legenda, 'meu', s.autor = p_quem, 'estilo', s.estilo,
    'post', interno.rede5_story_post(s.post_ref, p_quem),
    'legendas', case when jsonb_array_length(s.legendas) > 0 then s.legendas end,
    'musica', s.musica,
    'destaques', case when s.autor = p_quem then coalesce((select jsonb_agg(d.destaque) from rede_story_no_destaque d where d.story = s.id), '[]'::jsonb) end,
    'respostas', case when s.autor = p_quem then (select count(*)::integer from rede_story_respostas r where r.story = s.id) end,
    'reacoes', case when s.autor = p_quem then interno.rede5_story_reacoes(s.id) end,
    'figurinhas', coalesce((select jsonb_agg(interno.rede5_story_figurinha(f, s, p_quem) || jsonb_strip_nulls(jsonb_build_object('pos', f.dados -> 'pos')) order by f.ordem) from rede_story_figurinhas f where f.story = s.id), '[]'::jsonb))
$$;

/** A prévia do post/ato para o "criar" (o mesmo cartão que vai no story), só se eu vejo. */
create or replace function public.rede_story_post(p_id uuid) returns jsonb language plpgsql stable security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.rede5_story_membro();
begin
  return interno.rede5_story_post(p_id, v);
end $$;

-- ── 5. Publicar (com as figurinhas novas, o público de comunidade, as legendas e a música) ────────────────────────────────
/** A lista fechada das figurinhas decorativas da Alumia (os desenhos vêm do aparelho: components/rede/figurinhas/Decorativas.tsx). */
create or replace function interno.rede5_story_decorativas() returns text[] language sql immutable security definer set search_path = interno, pg_temp as $$
  select array['punho', 'lampiao', 'megafone', 'faixa', 'carimbo-luta', 'carimbo-presente', 'estrela', 'flor']
$$;

/** As legendas do vídeo, limpas: até 40, cada uma com início e fim em ms dentro do vídeo e até 120 letras; "grande" = texto no meio. */
create or replace function interno.rede5_story_legendas(p jsonb, p_duracao integer) returns jsonb language plpgsql immutable security definer set search_path = interno, pg_temp as $$
declare l jsonb; v_de integer; v_ate integer; v_saida jsonb := '[]'::jsonb;
begin
  if p is null or jsonb_typeof(p) = 'null' then return '[]'::jsonb; end if;
  if jsonb_typeof(p) <> 'array' or jsonb_array_length(p) > 40 then perform interno.erro('invalido:legendas'); end if;
  if jsonb_array_length(p) > 0 and p_duracao is null then perform interno.erro('invalido:legendas'); end if;
  for l in select * from jsonb_array_elements(p) loop
    if jsonb_typeof(l) <> 'object' or jsonb_typeof(l -> 'de') <> 'number' or jsonb_typeof(l -> 'ate') <> 'number' then perform interno.erro('invalido:legendas'); end if;
    v_de := round((l ->> 'de')::numeric)::integer;
    v_ate := round((l ->> 'ate')::numeric)::integer;
    if v_de < 0 or v_ate <= v_de or v_ate > p_duracao + 500 then perform interno.erro('invalido:legendas'); end if;
    v_saida := v_saida || jsonb_build_object('de', v_de, 'ate', v_ate, 'texto', interno.txt(l ->> 'texto', 'legendas', 1, 120),
      'grande', coalesce(jsonb_typeof(l -> 'grande') = 'boolean' and (l ->> 'grande')::boolean, false));
  end loop;
  return v_saida;
end $$;

/**
 * Publica um story (PedidoDeStory de lib/rede/tipos-stories.ts). Tudo da F5 e do vídeo continua. Novo: até 3 figurinhas
 * interativas e 3 decorativas; "resposta" só de uma resposta à MINHA pergunta (vai sem o nome de quem respondeu); "vou" só de um
 * ato que eu vejo e que não passou; menção a pessoa (membro, sem bloqueio, nunca eu mesma; ela recebe um aviso); #campanha (e a
 * corrente "Adicionar o seu"); público "comunidade" só de uma comunidade de que sou membro ativa; legendas e música só no vídeo.
 */
create or replace function public.rede_story_publicar(p jsonb) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare
  v uuid := interno.rede5_story_membro();
  v_publico text := coalesce(p ->> 'publico', 'seguidores');
  v_fundo text := coalesce(p -> 'fundo' ->> 'tipo', 'listras');
  v_cor text := coalesce(p -> 'fundo' ->> 'cor', 'azul');
  v_texto text; v_legenda text; v_alt text; v_imagem text := nullif(btrim(coalesce(p ->> 'imagem', '')), '');
  v_post uuid; pr rede_posts; v_figs jsonb := coalesce(p -> 'figurinhas', '[]'::jsonb);
  f jsonb; v_tipo text; v_limpas jsonb := '[]'::jsonb; v_tudo text := ''; v_ato uuid; v_titulo text; v_inicio timestamptz; v_cidade text;
  v_url text; v_rotulo text; v_perg text; v_op0 text; v_op1 text; v_enquetes integer := 0; v_contagens integer := 0; v_comunidades integer := 0;
  v_interativas integer := 0; v_decorativas integer := 0; v_vous integer := 0; v_pessoas integer := 0; v_campanhas integer := 0; v_respostas integer := 0;
  v_tam bigint; v_mime text; s rede_stories; i integer := 0; v_duracao integer; v_som boolean := false; v_estilo jsonb; c rede_comunidades;
  v_comunidade text; v_legendas jsonb := '[]'::jsonb; v_musica text; v_resp uuid; v_rtexto text; v_quem uuid; v_tag text; v_mencionadas uuid[] := '{}';
  v_slug_mencao text;
begin
  if p is null or jsonb_typeof(p) is distinct from 'object' then perform interno.erro('invalido:pedido'); end if;
  if v_publico not in ('seguidores', 'membros', 'proximos', 'comunidade') then perform interno.erro('invalido:publico'); end if;
  if v_fundo not in ('listras', 'mosaico', 'imagem', 'video') then perform interno.erro('invalido:fundo'); end if;
  if v_cor not in ('azul', 'vermelho', 'dourado', 'verde', 'rosa', 'noite') then perform interno.erro('invalido:cor'); end if;
  if not exists (select 1 from perfis where id = v and rede_handle is not null) then perform interno.erro('sem_handle'); end if;
  v_texto := interno.txt(p ->> 'texto', 'texto', 0, 140);
  v_legenda := nullif(interno.txt(p ->> 'legenda', 'legenda', 0, 80), '');
  v_alt := nullif(interno.txt(p ->> 'alt', 'alt', 0, 200), '');
  v_estilo := interno.rede5_story_estilo(p -> 'estilo');
  if jsonb_typeof(v_figs) is distinct from 'array' or jsonb_array_length(v_figs) > 6 then perform interno.erro('invalido:figurinhas'); end if;

  -- O público "só esta comunidade": só de uma comunidade em que sou membro ativa.
  if v_publico = 'comunidade' then
    v_comunidade := nullif(btrim(coalesce(p ->> 'comunidade', '')), '');
    if v_comunidade is null or not exists (select 1 from rede_comunidade_membros m where m.comunidade = v_comunidade and m.usuario = v and m.situacao = 'ativo') then
      perform interno.erro('invalido:comunidade');
    end if;
  end if;

  -- A mídia: imagem ou vídeo exigem o caminho, e o caminho só vale com um dos dois.
  if (v_fundo in ('imagem', 'video')) <> (v_imagem is not null) then perform interno.erro('invalido:imagem'); end if;
  if v_fundo = 'video' then
    begin v_duracao := round((p -> 'video' ->> 'duracao_ms')::numeric)::integer; exception when others then v_duracao := null; end;
    if v_duracao is null or v_duracao not between 300 and 60500 then perform interno.erro('invalido:video'); end if;
    v_som := coalesce((p -> 'video' ->> 'som')::boolean, false);
    v_musica := nullif(p -> 'video' ->> 'musica', '');
    if v_musica is not null and v_musica not in ('batucada', 'marcha', 'ciranda', 'tambor') then perform interno.erro('invalido:musica'); end if;
    v_legendas := interno.rede5_story_legendas(p -> 'video' -> 'legendas', v_duracao);
    select v_tudo || coalesce(string_agg(x ->> 'texto', E'\n'), '') into v_tudo from jsonb_array_elements(v_legendas) x;
  elsif jsonb_typeof(p -> 'video') = 'object' and (nullif(p -> 'video' ->> 'musica', '') is not null
        or (jsonb_typeof(p -> 'video' -> 'legendas') = 'array' and jsonb_array_length(p -> 'video' -> 'legendas') > 0)) then
    perform interno.erro('invalido:video');
  end if;
  if v_imagem is not null then
    if v_fundo = 'imagem' and v_imagem !~ ('^' || v::text || '/[0-9a-f-]{32,36}\.(webp|png|jpg)$') then perform interno.erro('invalido:imagem'); end if;
    if v_fundo = 'video' and v_imagem !~ ('^' || v::text || '/[0-9a-f-]{32,36}\.(mp4|webm)$') then perform interno.erro('invalido:video'); end if;
    if exists (select 1 from rede_stories where midia_caminho = v_imagem) then perform interno.erro('invalido:imagem'); end if;
    if to_regclass('storage.objects') is not null then
      execute 'select (metadata ->> ''size'')::bigint, metadata ->> ''mimetype'' from storage.objects where bucket_id = ''rede-stories'' and name = $1'
        into v_tam, v_mime using v_imagem;
      if v_mime is null then perform interno.erro('invalido:imagem'); end if;
      if v_fundo = 'imagem' and (v_mime not in ('image/webp', 'image/png', 'image/jpeg') or coalesce(v_tam, 0) > 3145728) then perform interno.erro('invalido:imagem'); end if;
      if v_fundo = 'video' and (v_mime not in ('video/mp4', 'video/webm') or coalesce(v_tam, 0) > 20971520) then perform interno.erro('invalido:video'); end if;
    end if;
  else
    v_alt := null;
  end if;

  -- "Pôr no story": só um post que eu vejo.
  if nullif(p ->> 'post_ref', '') is not null then
    begin v_post := (p ->> 'post_ref')::uuid; exception when others then perform interno.erro('invalido:post'); end;
    select * into pr from rede_posts where id = v_post;
    if not found or pr.apagado_em is not null or not interno.rede2_pode_ver(pr, v) then perform interno.erro('nao_encontrado'); end if;
  end if;

  for f in select * from jsonb_array_elements(v_figs) loop
    v_tipo := f ->> 'tipo';
    if v_tipo = 'decorativa' then v_decorativas := v_decorativas + 1; else v_interativas := v_interativas + 1; end if;
    if v_tipo = 'contagem' then
      v_contagens := v_contagens + 1;
      begin v_ato := (f ->> 'ato')::uuid; exception when others then v_ato := null; end;
      if v_ato is null then perform interno.erro('invalido:contagem'); end if;
      select left(coalesce(nullif(btrim(x.titulo), ''), btrim(x.texto)), 60), ch.inicio into v_titulo, v_inicio
      from rede_chamados ch join rede_posts x on x.id = ch.post
      where ch.post = v_ato and ch.inicio > now() and not ch.cancelado and interno.rede2_pode_ver(x, v)
        and (x.autor = v or exists (select 1 from rede_vou u where u.post = x.id and u.usuario = v));
      if not found then perform interno.erro('invalido:contagem'); end if;
      v_limpas := v_limpas || jsonb_build_object('tipo', 'contagem', 'dados', jsonb_build_object('ato', v_ato, 'titulo', v_titulo, 'inicio', v_inicio));
    elsif v_tipo = 'pergunta' then
      v_perg := interno.txt(f ->> 'texto', 'pergunta', 1, 90);
      v_tudo := v_tudo || E'\n' || v_perg;
      v_limpas := v_limpas || jsonb_build_object('tipo', 'pergunta', 'dados', jsonb_build_object('texto', v_perg));
    elsif v_tipo = 'enquete' then
      v_enquetes := v_enquetes + 1;
      if jsonb_typeof(f -> 'opcoes') is distinct from 'array' or jsonb_array_length(f -> 'opcoes') <> 2 then perform interno.erro('invalido:enquete'); end if;
      v_perg := interno.txt(f ->> 'pergunta', 'pergunta', 1, 90);
      v_op0 := interno.txt(f -> 'opcoes' ->> 0, 'opcao', 1, 24);
      v_op1 := interno.txt(f -> 'opcoes' ->> 1, 'opcao', 1, 24);
      if lower(v_op0) = lower(v_op1) then perform interno.erro('invalido:opcao'); end if;
      v_tudo := v_tudo || E'\n' || v_perg || E'\n' || v_op0 || E'\n' || v_op1;
      v_limpas := v_limpas || jsonb_build_object('tipo', 'enquete', 'dados', jsonb_build_object('pergunta', v_perg, 'opcoes', jsonb_build_array(v_op0, v_op1)));
    elsif v_tipo = 'link' then
      v_url := btrim(coalesce(f ->> 'url', ''));
      if v_url !~* '^https://[a-z0-9.-]+\.[a-z]{2,}(:[0-9]{2,5})?(/[^\s<>"]*)?$' or char_length(v_url) > 300 then perform interno.erro('invalido:link'); end if;
      v_rotulo := interno.txt(coalesce(f ->> 'rotulo', ''), 'rotulo', 0, 40);
      v_tudo := v_tudo || E'\n' || v_rotulo;
      v_limpas := v_limpas || jsonb_build_object('tipo', 'link', 'dados', jsonb_build_object('url', v_url, 'rotulo', v_rotulo));
    elsif v_tipo = 'comunidade' then
      v_comunidades := v_comunidades + 1;
      select * into c from rede_comunidades where slug = coalesce(f ->> 'slug', '');
      if not found or (c.tipo <> 'aberta' and not exists (select 1 from rede_comunidade_membros m where m.comunidade = c.slug and m.usuario = v and m.situacao = 'ativo')) then
        perform interno.erro('invalido:comunidade');
      end if;
      v_slug_mencao := c.slug;
      v_limpas := v_limpas || jsonb_build_object('tipo', 'comunidade', 'dados', jsonb_build_object('slug', c.slug, 'nome', c.nome));
    elsif v_tipo = 'decorativa' then
      if coalesce(f ->> 'nome', '') <> all (interno.rede5_story_decorativas()) then perform interno.erro('invalido:decorativa'); end if;
      v_limpas := v_limpas || jsonb_build_object('tipo', 'decorativa', 'dados', jsonb_build_object('nome', f ->> 'nome'));
    elsif v_tipo = 'resposta' then
      v_respostas := v_respostas + 1;
      begin v_resp := (f ->> 'resposta')::uuid; exception when others then v_resp := null; end;
      v_rtexto := null;
      select r.texto, (select g.dados ->> 'texto' from rede_story_figurinhas g where g.story = r.story and g.tipo = 'pergunta' order by g.ordem limit 1)
        into v_rtexto, v_perg
      from rede_story_respostas r join rede_stories x on x.id = r.story
      where r.id = v_resp and x.autor = v and r.pergunta;
      if v_rtexto is null or v_perg is null then perform interno.erro('invalido:resposta'); end if;
      v_tudo := v_tudo || E'\n' || v_rtexto;
      v_limpas := v_limpas || jsonb_build_object('tipo', 'resposta', 'dados', jsonb_build_object('pergunta', v_perg, 'texto', v_rtexto));
    elsif v_tipo = 'vou' then
      v_vous := v_vous + 1;
      begin v_ato := (f ->> 'ato')::uuid; exception when others then v_ato := null; end;
      v_titulo := null;
      select left(coalesce(nullif(btrim(coalesce(ch.titulo, '')), ''), nullif(btrim(coalesce(x.titulo, '')), ''), btrim(x.texto)), 60), ch.inicio, ch.cidade
        into v_titulo, v_inicio, v_cidade
      from rede_chamados ch join rede_posts x on x.id = ch.post
      where ch.post = v_ato and ch.inicio > now() - interval '6 hours' and not ch.cancelado and coalesce(ch.situacao, '') <> 'cancelado'
        and x.apagado_em is null and not x.oculto and not x.retido and interno.rede2_pode_ver(x, v);
      if v_titulo is null then perform interno.erro('invalido:vou'); end if;
      v_limpas := v_limpas || jsonb_build_object('tipo', 'vou', 'dados', jsonb_build_object('ato', v_ato, 'titulo', v_titulo, 'inicio', v_inicio, 'cidade', v_cidade));
    elsif v_tipo = 'pessoa' then
      v_pessoas := v_pessoas + 1;
      select id into v_quem from perfis where rede_handle = regexp_replace(lower(btrim(coalesce(f ->> 'handle', ''))), '^@', '') and rede_handle is not null;
      if v_quem is null or v_quem = v or not interno.rede2_membro(v_quem) or interno.rede_bloqueado(v, v_quem) then perform interno.erro('invalido:pessoa'); end if;
      v_mencionadas := v_mencionadas || v_quem;
      v_limpas := v_limpas || jsonb_build_object('tipo', 'pessoa', 'dados', jsonb_build_object('perfil', v_quem));
    elsif v_tipo = 'campanha' then
      v_campanhas := v_campanhas + 1;
      v_tag := lower(regexp_replace(btrim(coalesce(f ->> 'tag', '')), '^#', ''));
      if v_tag !~ '^[a-z0-9_]{2,40}$' or v_tag !~ '[a-z_]' then perform interno.erro('invalido:campanha'); end if;
      v_tudo := v_tudo || E'\n' || v_tag;
      v_limpas := v_limpas || jsonb_build_object('tipo', 'campanha', 'dados', jsonb_build_object('tag', v_tag,
        'corrente', coalesce(jsonb_typeof(f -> 'corrente') = 'boolean' and (f ->> 'corrente')::boolean, false)));
    else
      perform interno.erro('invalido:figurinha');
    end if;
    if interno.rede5_story_pos(f -> 'pos') is not null then
      v_limpas := jsonb_set(v_limpas, array[(jsonb_array_length(v_limpas) - 1)::text, 'dados', 'pos'], interno.rede5_story_pos(f -> 'pos'));
    end if;
  end loop;
  if v_enquetes > 1 or v_contagens > 1 or v_comunidades > 1 or v_vous > 1 or v_pessoas > 1 or v_campanhas > 1 or v_respostas > 1
     or v_interativas > 3 or v_decorativas > 3 then
    perform interno.erro('invalido:figurinhas');
  end if;
  if v_texto = '' and v_imagem is null and v_post is null and jsonb_array_length(v_limpas) = 0 then perform interno.erro('invalido:vazio'); end if;
  if interno.rede3_pub_dado_pessoal(v_texto || E'\n' || coalesce(v_legenda, '') || E'\n' || coalesce(v_alt, '') || v_tudo) then perform interno.erro('dado_pessoal'); end if;

  perform interno.limite('rede5_story_publicar', 20, 1440);
  insert into rede_stories (autor, publico, comunidade, fundo, cor, texto, legenda, midia_caminho, alt, post_ref, conferido, duracao_ms, som, estilo, legendas, musica)
  values (v, v_publico, v_comunidade, v_fundo, v_cor, v_texto, v_legenda, v_imagem, v_alt, v_post, v_imagem is null, v_duracao, v_som, v_estilo, v_legendas, v_musica)
  returning * into s;
  for f in select * from jsonb_array_elements(v_limpas) loop
    insert into rede_story_figurinhas (story, ordem, tipo, dados) values (s.id, i, f ->> 'tipo', f -> 'dados');
    i := i + 1;
  end loop;

  -- A pessoa mencionada fica sabendo (se não desligou os avisos de menção). Quem ela é já estava no story; nada mais sai.
  foreach v_quem in array v_mencionadas loop
    if interno.rede3_aviso_pref(v_quem, 'mencao', 'site') then
      insert into avisos (para, texto, categoria, ator) values (v_quem, 'Você foi mencionada num story (some em 24 h).', 'rede', v);
    end if;
  end loop;
  -- A moderação da comunidade mencionada recebe UM aviso por dia, que só soma (sem dizer quem mencionou).
  if v_slug_mencao is not null then perform interno.rede5_story_avisar_mencao(v_slug_mencao); end if;
  return jsonb_build_object('id', s.id, 'expira_em', s.expira_em);
end $$;

/** O aviso agregado da menção: um por comunidade, por dia e por pessoa da moderação; o número é de stories, abaixo de 3 "alguns". */
create or replace function interno.rede5_story_avisar_mencao(p_slug text) returns void language plpgsql security definer set search_path = interno, pg_temp as $$
declare m record; r rede_story_mencao_aviso; v_nome text; v_texto text; v_aviso uuid;
begin
  select nome into v_nome from rede_comunidades where slug = p_slug;
  if v_nome is null then return; end if;
  for m in select usuario from rede_comunidade_membros where comunidade = p_slug and papel = 'moderacao' and situacao = 'ativo' limit 20 loop
    insert into rede_story_mencao_aviso (comunidade, dia, para, n) values (p_slug, current_date, m.usuario, 1)
    on conflict (comunidade, dia, para) do update set n = rede_story_mencao_aviso.n + 1
    returning * into r;
    v_texto := left('Stories mencionaram a comunidade ' || v_nome || ' hoje' || case when r.n >= 3 then ' (' || r.n || ' stories).' else '.' end
      || ' Eles aparecem na página da comunidade enquanto estiverem no ar.', 500);
    if r.aviso is not null and exists (select 1 from avisos where id = r.aviso) then
      update avisos set texto = v_texto, lido = false where id = r.aviso;
    else
      insert into avisos (para, texto, categoria) values (m.usuario, v_texto, 'rede') returning id into v_aviso;
      update rede_story_mencao_aviso set aviso = v_aviso where comunidade = p_slug and dia = current_date and para = m.usuario;
    end if;
  end loop;
  if random() < 0.05 then delete from rede_story_mencao_aviso where dia < current_date - 7; end if;
end $$;

-- ── 6. Respostas: a caixa da autora e a resposta à pergunta ───────────────────────────────────────────────────────────────
/** Resposta à figurinha de pergunta: como a resposta comum (só para a autora, some com o story), marcada como "da pergunta". */
create or replace function public.rede_story_responder_pergunta(p_id uuid, p_texto text) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.rede5_story_membro(); s rede_stories; v_texto text := interno.txt(p_texto, 'texto', 1, 500); v_aviso uuid; v_perg text;
begin
  s := interno.rede5_story_visivel(p_id, v);
  if s.autor = v then perform interno.erro('sem_permissao'); end if;
  select dados ->> 'texto' into v_perg from rede_story_figurinhas where story = s.id and tipo = 'pergunta' order by ordem limit 1;
  if v_perg is null then perform interno.erro('nao_encontrado'); end if;
  perform interno.rede2_limite('responder');
  perform interno.limite('rede5_story_responder', 10, 60);
  if not interno.rede3_aviso_pref(s.autor, 'story_resposta', 'site') then return jsonb_build_object('ok', true); end if;
  insert into avisos (para, texto, categoria, ator)
  values (s.autor, left('Resposta à sua pergunta “' || v_perg || '”: “' || v_texto || '”', 500), 'rede', v) returning id into v_aviso;
  insert into rede_story_respostas (story, quem, texto, aviso, pergunta) values (s.id, v, v_texto, v_aviso, true);
  return jsonb_build_object('ok', true);
end $$;

/**
 * As respostas de UM story meu (no ar ou guardado num destaque), da mais nova para a mais antiga: o texto, se veio da pergunta e
 * quem mandou (como numa mensagem direta: ela escolheu falar comigo). Quem eu bloqueei (ou me bloqueou) aparece sem nome.
 */
create or replace function public.rede_story_respostas(p_id uuid) returns jsonb language plpgsql stable security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.rede5_story_membro(); s rede_stories;
begin
  select * into s from rede_stories where id = p_id and autor = v;
  if not found then perform interno.erro('nao_encontrado'); end if;
  return coalesce((select jsonb_agg(jsonb_build_object('id', r.id, 'texto', r.texto, 'criado_em', r.criado_em, 'pergunta', r.pergunta,
      'de', case when interno.rede_bloqueado(v, r.quem) or not interno.rede2_membro(r.quem) then null else interno.rede5_story_autora(r.quem) end)
    order by r.criado_em desc)
    from (select * from rede_story_respostas where story = s.id order by criado_em desc limit 200) r), '[]'::jsonb);
end $$;

/** A caixa: os meus stories (no ar ou guardados) que receberam resposta, com quantas (mensagens) e a mais recente. */
create or replace function public.rede_story_caixa() returns jsonb language plpgsql stable security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.rede5_story_membro();
begin
  return coalesce((select jsonb_agg(jsonb_build_object('id', x.id, 'texto', x.texto, 'cor', x.cor, 'criado_em', x.criado_em, 'expira_em', x.expira_em,
      'n', x.n, 'perguntas', x.perguntas, 'ultima', x.ultima) order by x.ultima desc)
    from (select s.id, s.texto, s.cor, s.criado_em, s.expira_em, count(r.id)::integer as n, count(r.id) filter (where r.pergunta)::integer as perguntas,
                 max(r.criado_em) as ultima
          from rede_stories s join rede_story_respostas r on r.story = s.id
          where s.autor = v and (s.expira_em > now() or interno.rede5_story_no_destaque(s.id))
          group by s.id order by max(r.criado_em) desc limit 30) x), '[]'::jsonb);
end $$;

-- ── 7. Roda de confiança ──────────────────────────────────────────────────────────────────────────────────────────────────
/** A minha roda (só eu vejo): @ e codinome, na ordem em que entraram. Ninguém mais lê esta lista. */
create or replace function public.rede_roda() returns jsonb language plpgsql stable security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu();
begin
  if not interno.rede2_membro(v) then perform interno.erro('sem_permissao'); end if;
  return coalesce((select jsonb_agg(jsonb_build_object('handle', f.rede_handle, 'nome', interno.rede_nome(f.id), 'cor', (abs(hashtext(f.id::text)) % 5) + 1) order by r.criado_em)
    from rede_roda r join perfis f on f.id = r.membro where r.dono = v and f.rede_handle is not null), '[]'::jsonb);
end $$;

/**
 * Põe ou tira alguém da minha roda (até 150 pessoas). A pessoa NÃO é avisada (nem de entrar, nem de sair). Só quem é da Alumia,
 * sem bloqueio; tirar quem não está não é erro. Devolve a roda como fica.
 */
create or replace function public.rede_roda_mudar(p_handle text, p_sim boolean) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); v_quem uuid;
begin
  perform interno.aberta('comunidade');
  if not interno.rede2_membro(v) then perform interno.erro('sem_permissao'); end if;
  perform interno.limite('rede_roda_mudar', 120, 60);
  if coalesce(p_handle, '') !~ '^@?[a-z0-9_]{3,20}$' then perform interno.erro('invalido:handle'); end if;
  select id into v_quem from perfis where rede_handle = regexp_replace(lower(p_handle), '^@', '');
  if coalesce(p_sim, true) then
    if v_quem is null or v_quem = v or not interno.rede2_membro(v_quem) or interno.rede_bloqueado(v, v_quem) then perform interno.erro('nao_encontrado'); end if;
    if (select count(*) from rede_roda where dono = v) >= 150 then perform interno.erro('limite:roda'); end if;
    insert into rede_roda (dono, membro) values (v, v_quem) on conflict do nothing;
  elsif v_quem is not null then
    delete from rede_roda where dono = v and membro = v_quem;
  end if;
  return public.rede_roda();
end $$;

-- Bloquear alguém tira a pessoa da roda (nos dois sentidos).
create or replace function interno.rede5_roda_bloqueio() returns trigger language plpgsql security definer set search_path = interno, pg_temp as $$
begin
  delete from rede_roda where (dono = new.quem and membro = new.bloqueado) or (dono = new.bloqueado and membro = new.quem);
  return null;
end $$;
drop trigger if exists rede5_roda_bloqueio on interno.rede_bloqueios;
create trigger rede5_roda_bloqueio after insert on interno.rede_bloqueios for each row execute function interno.rede5_roda_bloqueio();

-- ── 8. Destaques: ordem, capa e trocar a foto pela borrada ────────────────────────────────────────────────────────────────
/** Os destaques de alguém (como a F5 de vídeo), agora na ordem da dona e com a capa que ela escolheu (se eu vejo aquele story). */
create or replace function public.rede_story_destaques(p_handle text) returns jsonb language plpgsql stable security definer set search_path = interno, pg_temp as $$
declare v uuid := auth.uid(); v_autor uuid;
begin
  if v is null or not interno.rede2_membro(v) then return '[]'::jsonb; end if;
  perform interno.rede5_story_ligado();
  if coalesce(p_handle, '') !~ '^[a-z0-9_]{3,20}$' then perform interno.erro('invalido:handle'); end if;
  select id into v_autor from perfis where rede_handle = p_handle;
  if not found then return '[]'::jsonb; end if;
  return coalesce((
    select jsonb_agg(jsonb_strip_nulls(jsonb_build_object('id', d.id, 'titulo', d.titulo, 'cor', d.cor, 'n', x.n,
             'capa', case when coalesce(x.escolhida, x.capa) is not null then jsonb_build_object('caminho', coalesce(x.escolhida, x.capa), 'tipo', 'imagem') end,
             'capa_story', case when d.autor = v then d.capa end)) order by d.ordem, d.criado_em)
    from rede_story_destaques d
    cross join lateral (
      select count(*)::integer as n,
             (array_agg(s.midia_caminho order by nd.ordem, nd.posto_em) filter (where s.midia_caminho is not null and s.fundo = 'imagem'))[1] as capa,
             (array_agg(s.midia_caminho) filter (where s.id = d.capa and s.fundo = 'imagem'))[1] as escolhida
      from rede_story_no_destaque nd join rede_stories s on s.id = nd.story
      where nd.destaque = d.id and interno.rede5_story_regra(s, v)) x
    where d.autor = v_autor and (x.n > 0 or d.autor = v)), '[]'::jsonb);
end $$;

/** Os stories de um destaque, na ordem que a dona escolheu (depois, do mais antigo ao mais novo). */
create or replace function public.rede_story_destaque_abrir(p_id uuid) returns jsonb language plpgsql stable security definer set search_path = interno, pg_temp as $$
declare v uuid := auth.uid();
begin
  if v is null or not interno.rede2_membro(v) then return '[]'::jsonb; end if;
  perform interno.rede5_story_ligado();
  return coalesce((select jsonb_agg(interno.rede5_story_json(s, v) order by nd.ordem, s.criado_em)
    from rede_story_no_destaque nd join rede_stories s on s.id = nd.story
    where nd.destaque = p_id and interno.rede5_story_ve_destaque(s, v)), '[]'::jsonb);
end $$;

/** Guardar/renomear (como a F5 de vídeo): o destaque novo vai para o fim da fileira e o story novo para o fim do destaque. */
create or replace function public.rede_story_destaque_salvar(p_destaque uuid, p_titulo text, p_story uuid, p_cor text default null) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.rede5_story_membro(); d rede_story_destaques; s rede_stories; v_titulo text;
begin
  perform interno.limite('rede5_story_destaque', 60, 60);
  if p_cor is not null and p_cor not in ('azul', 'vermelho', 'dourado', 'verde', 'rosa', 'noite') then perform interno.erro('invalido:cor'); end if;
  if p_titulo is not null then
    v_titulo := interno.txt(p_titulo, 'titulo', 1, 24);
    if interno.rede3_pub_dado_pessoal(v_titulo) then perform interno.erro('dado_pessoal'); end if;
  end if;
  if p_story is not null then
    select * into s from rede_stories where id = p_story and autor = v;
    if not found or not (s.expira_em > now() or interno.rede5_story_no_destaque(s.id)) then perform interno.erro('nao_encontrado'); end if;
  end if;
  if p_destaque is null then
    if v_titulo is null then perform interno.erro('invalido:titulo'); end if;
    if (select count(*) from rede_story_destaques where autor = v) >= 6 then perform interno.erro('limite:destaques'); end if;
    insert into rede_story_destaques (autor, titulo, cor, ordem)
    values (v, v_titulo, coalesce(p_cor, 'vermelho'), coalesce((select max(ordem) + 1 from rede_story_destaques where autor = v), 0)) returning * into d;
  else
    select * into d from rede_story_destaques where id = p_destaque and autor = v;
    if not found then perform interno.erro('nao_encontrado'); end if;
    update rede_story_destaques set titulo = coalesce(v_titulo, titulo), cor = coalesce(p_cor, cor) where id = d.id returning * into d;
  end if;
  if p_story is not null then
    if (select count(*) from rede_story_no_destaque where destaque = d.id) >= 60 then perform interno.erro('limite:destaque'); end if;
    insert into rede_story_no_destaque (destaque, story, ordem)
    values (d.id, s.id, coalesce((select max(ordem) + 1 from rede_story_no_destaque where destaque = d.id), 0)) on conflict do nothing;
  end if;
  return jsonb_build_object('id', d.id, 'titulo', d.titulo, 'cor', d.cor);
end $$;

/** A ordem dos MEUS destaques na fileira do perfil (os ids na ordem nova; os que faltarem vão para o fim). */
create or replace function public.rede_story_destaque_ordem(p_ids uuid[]) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.rede5_story_membro(); k integer := 0; x uuid;
begin
  perform interno.limite('rede5_story_destaque', 60, 60);
  if p_ids is null or array_length(p_ids, 1) is null or array_length(p_ids, 1) > 6 then perform interno.erro('invalido:ordem'); end if;
  foreach x in array p_ids loop
    update rede_story_destaques set ordem = k where id = x and autor = v;
    k := k + 1;
  end loop;
  update rede_story_destaques set ordem = k + 1 where autor = v and not (id = any (p_ids));
  return jsonb_build_object('ok', true);
end $$;

/** A ordem dos stories dentro de um destaque meu. */
create or replace function public.rede_story_destaque_ordenar(p_destaque uuid, p_ids uuid[]) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.rede5_story_membro(); k integer := 0; x uuid;
begin
  perform interno.limite('rede5_story_destaque', 60, 60);
  if not exists (select 1 from rede_story_destaques where id = p_destaque and autor = v) then perform interno.erro('nao_encontrado'); end if;
  if p_ids is null or array_length(p_ids, 1) is null or array_length(p_ids, 1) > 60 then perform interno.erro('invalido:ordem'); end if;
  foreach x in array p_ids loop
    update rede_story_no_destaque set ordem = k where destaque = p_destaque and story = x;
    k := k + 1;
  end loop;
  update rede_story_no_destaque set ordem = k + 1 where destaque = p_destaque and not (story = any (p_ids));
  return jsonb_build_object('ok', true);
end $$;

/** A capa de um destaque meu: um story com foto que está nele (nulo = a primeira foto, como antes). */
create or replace function public.rede_story_destaque_capa(p_destaque uuid, p_story uuid) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.rede5_story_membro();
begin
  perform interno.limite('rede5_story_destaque', 60, 60);
  if not exists (select 1 from rede_story_destaques where id = p_destaque and autor = v) then perform interno.erro('nao_encontrado'); end if;
  if p_story is not null and not exists (select 1 from rede_story_no_destaque nd join rede_stories s on s.id = nd.story
                                         where nd.destaque = p_destaque and nd.story = p_story and s.fundo = 'imagem') then
    perform interno.erro('invalido:capa');
  end if;
  update rede_story_destaques set capa = p_story where id = p_destaque;
  return jsonb_build_object('ok', true);
end $$;

/**
 * Troca a foto de um story MEU pela versão nova (borrada de novo, refeita no aparelho), já enviada à minha pasta: a mesma regra
 * do publicar (WEBP/PNG/JPEG até 3 MB, arquivo ainda sem dono). O arquivo antigo fica sem story e a faxina o leva (órfão > 1 h).
 * Só foto: o vídeo se publica de novo.
 */
create or replace function public.rede_story_trocar_midia(p_story uuid, p_caminho text) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.rede5_story_membro(); s rede_stories; v_tam bigint; v_mime text;
begin
  perform interno.limite('rede5_story_trocar', 20, 60);
  select * into s from rede_stories where id = p_story and autor = v;
  if not found or not (s.expira_em > now() or interno.rede5_story_no_destaque(s.id)) then perform interno.erro('nao_encontrado'); end if;
  if s.fundo <> 'imagem' then perform interno.erro('invalido:imagem'); end if;
  if coalesce(p_caminho, '') !~ ('^' || v::text || '/[0-9a-f-]{32,36}\.(webp|png|jpg)$') then perform interno.erro('invalido:imagem'); end if;
  if exists (select 1 from rede_stories where midia_caminho = p_caminho) then perform interno.erro('invalido:imagem'); end if;
  if to_regclass('storage.objects') is not null then
    execute 'select (metadata ->> ''size'')::bigint, metadata ->> ''mimetype'' from storage.objects where bucket_id = ''rede-stories'' and name = $1'
      into v_tam, v_mime using p_caminho;
    if v_mime is null or v_mime not in ('image/webp', 'image/png', 'image/jpeg') or coalesce(v_tam, 0) > 3145728 then perform interno.erro('invalido:imagem'); end if;
  end if;
  update rede_stories set midia_caminho = p_caminho, conferido = false where id = s.id;
  return jsonb_build_object('ok', true);
end $$;

-- ── 9. A comunidade mencionada: os stories que falam dela ─────────────────────────────────────────────────────────────────
/**
 * Os stories no ar que mencionam a comunidade (e os de público "só esta comunidade"), em bolinhas por autora, só os que EU posso
 * ver. Comunidade fechada ou restrita: só para membro ativo. Sem número de quem viu; leitura pura.
 */
create or replace function public.rede_story_da_comunidade(p_slug text) returns jsonb language plpgsql stable security definer set search_path = interno, pg_temp as $$
declare v uuid := auth.uid(); c rede_comunidades;
begin
  if v is null or not interno.rede2_membro(v) then return '[]'::jsonb; end if;
  perform interno.rede5_story_ligado();
  select * into c from rede_comunidades where slug = p_slug;
  if not found then return '[]'::jsonb; end if;
  if c.tipo <> 'aberta' and not exists (select 1 from rede_comunidade_membros m where m.comunidade = c.slug and m.usuario = v and m.situacao = 'ativo') then
    return '[]'::jsonb;
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object('autora', interno.rede5_story_autora(g.autor), 'ids', g.ids, 'ultimo_em', g.ultimo) order by g.ultimo desc)
    from (
      select s.autor, jsonb_agg(s.id order by s.criado_em) as ids, max(s.criado_em) as ultimo
      from rede_stories s join perfis f on f.id = s.autor and f.rede_handle is not null
      where s.expira_em > now() and interno.rede5_story_ve(s, v)
        and (s.comunidade = c.slug or exists (select 1 from rede_story_figurinhas g where g.story = s.id and g.tipo = 'comunidade' and g.dados ->> 'slug' = c.slug))
      group by s.autor order by max(s.criado_em) desc limit 60) g), '[]'::jsonb);
end $$;

-- ── 10. Permissões ────────────────────────────────────────────────────────────────────────────────────────────────────────
revoke all on function interno.rede5_story_post(uuid, uuid), interno.rede5_story_reacoes(uuid), interno.rede5_story_total(bigint),
  interno.rede5_story_decorativas(), interno.rede5_story_legendas(jsonb, integer), interno.rede5_story_avisar_mencao(text), interno.rede5_roda_bloqueio() from public;
revoke all on function public.rede_story_post(uuid), public.rede_story_responder_pergunta(uuid, text), public.rede_story_respostas(uuid), public.rede_story_caixa(),
  public.rede_roda(), public.rede_roda_mudar(text, boolean), public.rede_story_destaque_ordem(uuid[]), public.rede_story_destaque_ordenar(uuid, uuid[]),
  public.rede_story_destaque_capa(uuid, uuid), public.rede_story_trocar_midia(uuid, text), public.rede_story_da_comunidade(text) from public;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on function interno.rede5_story_post(uuid, uuid), interno.rede5_story_reacoes(uuid), interno.rede5_story_total(bigint),
      interno.rede5_story_decorativas(), interno.rede5_story_legendas(jsonb, integer), interno.rede5_story_avisar_mencao(text), interno.rede5_roda_bloqueio() from anon, authenticated;
    revoke all on function public.rede_story_post(uuid), public.rede_story_responder_pergunta(uuid, text), public.rede_story_respostas(uuid), public.rede_story_caixa(),
      public.rede_roda(), public.rede_roda_mudar(text, boolean), public.rede_story_destaque_ordem(uuid[]), public.rede_story_destaque_ordenar(uuid, uuid[]),
      public.rede_story_destaque_capa(uuid, uuid), public.rede_story_trocar_midia(uuid, text), public.rede_story_da_comunidade(text) from anon, authenticated;
    -- Tudo com conta (visitante não vê story nenhum).
    grant execute on function public.rede_story_post(uuid), public.rede_story_responder_pergunta(uuid, text), public.rede_story_respostas(uuid), public.rede_story_caixa(),
      public.rede_roda(), public.rede_roda_mudar(text, boolean), public.rede_story_destaque_ordem(uuid[]), public.rede_story_destaque_ordenar(uuid, uuid[]),
      public.rede_story_destaque_capa(uuid, uuid), public.rede_story_trocar_midia(uuid, text), public.rede_story_da_comunidade(text) to authenticated, service_role;
    -- As refeitas aqui mantêm as permissões (create or replace não muda o grant), mas confirma:
    grant execute on function public.rede_story_publicar(jsonb), public.rede_story_destaques(text), public.rede_story_destaque_abrir(uuid),
      public.rede_story_destaque_salvar(uuid, text, uuid, text) to authenticated, service_role;
  end if;
end $$;

-- ═══════════════════════════ fim do B1 dos stories ═══════════════════════════
