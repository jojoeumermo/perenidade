-- Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
--
-- ═══════════════════════════ Alumia · Onda A · stories com vídeo e destaques (10/11/2026) ═══════════════════════════
-- docs/plano-2026-11/ALUMIA-ATE-O-FIM.md (A7: "stories como os do Instagram, com vídeo") e PLANO-ALUMIA §6.4, §7.2, §12.
-- Por cima da F5 (20261109-alumia-f5.sql), sem tirar nada dela:
--   1. VÍDEO: fundo "video" (até 60 s), arquivo .mp4/.webm no mesmo depósito privado rede-stories, até 20 MB; a duração e o "som"
--      (a autora pode publicar sem som: aí o áudio nem sai do aparelho) ficam na linha. O aparelho regrava o vídeo (MediaRecorder,
--      720p, taxa limitada), o que joga fora todo metadado do arquivo original (GPS, modelo, data); a faxina confere de novo.
--   2. ESTILO DO TEXTO: fonte, cor da letra, alinhamento e caixa atrás do texto, só valores de uma lista fechada (nunca CSS livre).
--   3. FIGURINHA "comunidade" (menção a uma comunidade da Alumia): o nome vem da comunidade, não do pedido; comunidade fechada só
--      se a autora é membro ativa.
--   4. DESTAQUES no perfil: a autora guarda stories em até 6 destaques. Story num destaque não some em 24 h (escolha dela, com aviso
--      na tela "vai ficar no seu perfil"); continua com o MESMO público (seguidores, membros ou próximos), bloqueio vale, retido
--      some, e nunca federa. Tirar do destaque (ou apagar o destaque) devolve o story vencido à faxina.
-- Idempotente (scripts/testar-alumia-stories-video.mjs roda duas vezes no banco local). NÃO roda em produção sem o Jonathan.
--
-- Privacidade (leis conferidas no texto, leis-do-brasil):
--   * LGPD (Lei 13.709/2018) art. 5º, II e art. 11: continua NÃO existindo tabela, coluna nem contagem de quem viu, nem nos destaques;
--     o destaque mostra só o número de stories dele, nunca de pessoas.
--   * LGPD art. 6º, III (necessidade): o vídeo sai do aparelho já sem metadado; sem som, o áudio nem é enviado; nada de GPS.
--   * ECA Digital (Lei 15.211/2025) art. 9º § 1º: só membro 18+ publica ou vê (as mesmas regras da F5).
--   * Stories e destaques nunca federam (PLANO §6.8): nada daqui entra nas tabelas rede_fed_*.

-- ── 1. Colunas e regras novas em rede_stories ────────────────────────────────────────────────────────────────────────────
alter table interno.rede_stories add column if not exists duracao_ms integer;
alter table interno.rede_stories add column if not exists som boolean not null default false;
alter table interno.rede_stories add column if not exists estilo jsonb not null default '{}'::jsonb;

alter table interno.rede_stories drop constraint if exists rede_stories_fundo_check;
alter table interno.rede_stories add constraint rede_stories_fundo_check check (fundo in ('listras', 'mosaico', 'imagem', 'video'));
alter table interno.rede_stories drop constraint if exists rede_stories_midia_caminho_check;
alter table interno.rede_stories add constraint rede_stories_midia_caminho_check check (midia_caminho is null
  or midia_caminho ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f-]{32,36}\.(webp|png|jpg|mp4|webm)$');
alter table interno.rede_stories drop constraint if exists rede_stories_imagem;
alter table interno.rede_stories add constraint rede_stories_imagem check ((fundo in ('imagem', 'video')) = (midia_caminho is not null));
alter table interno.rede_stories drop constraint if exists rede_stories_video;
alter table interno.rede_stories add constraint rede_stories_video check (
  ((fundo = 'video') = (duracao_ms is not null))
  and (duracao_ms is null or duracao_ms between 300 and 60500)
  and (fundo = 'video' or not som)
  and (midia_caminho is null or (fundo = 'video') = (midia_caminho ~ '\.(mp4|webm)$')));
alter table interno.rede_stories drop constraint if exists rede_stories_estilo;
alter table interno.rede_stories add constraint rede_stories_estilo check (jsonb_typeof(estilo) = 'object' and pg_column_size(estilo) <= 512);

alter table interno.rede_story_figurinhas drop constraint if exists rede_story_figurinhas_tipo_check;
alter table interno.rede_story_figurinhas add constraint rede_story_figurinhas_tipo_check check (tipo in ('contagem', 'pergunta', 'enquete', 'link', 'comunidade'));

-- ── 2. Destaques ──────────────────────────────────────────────────────────────────────────────────────────────────────────
create table if not exists interno.rede_story_destaques (
  id uuid primary key default gen_random_uuid(),
  autor uuid not null references interno.perfis (id) on delete cascade,
  titulo text not null check (char_length(titulo) between 1 and 24),
  cor text not null default 'vermelho' check (cor in ('azul', 'vermelho', 'dourado', 'verde', 'rosa', 'noite')),
  criado_em timestamptz not null default now()
);
create index if not exists rede_story_destaques_autor on interno.rede_story_destaques (autor, criado_em);

create table if not exists interno.rede_story_no_destaque (
  destaque uuid not null references interno.rede_story_destaques (id) on delete cascade,
  story uuid not null references interno.rede_stories (id) on delete cascade,
  posto_em timestamptz not null default now(),
  primary key (destaque, story)
);
create index if not exists rede_story_no_destaque_story on interno.rede_story_no_destaque (story);

do $$
declare t text;
begin
  foreach t in array array['rede_story_destaques', 'rede_story_no_destaque'] loop
    execute format('alter table interno.%I enable row level security', t);
    execute format('revoke all on table interno.%I from public', t);
    if exists (select 1 from pg_roles where rolname = 'anon') then
      execute format('revoke all on table interno.%I from anon, authenticated', t);
    end if;
  end loop;
end $$;

-- ── 3. Quem vê (a regra sem o prazo, para os destaques) ─────────────────────────────────────────────────────────────────
/** A regra de público da F5, sem o "no ar": a mesma para o story vivo e para o story guardado num destaque. */
create or replace function interno.rede5_story_regra(s interno.rede_stories, p_quem uuid) returns boolean language sql stable security definer set search_path = interno, pg_temp as $$
  select s.id is not null and p_quem is not null and (
    s.autor = p_quem
    or (not s.retido
        and interno.rede2_membro(p_quem) and interno.rede2_membro(s.autor)
        and not interno.rede_bloqueado(p_quem, s.autor)
        and case s.publico
          when 'membros' then true
          when 'seguidores' then exists (select 1 from rede_seguindo g where g.quem = p_quem and g.segue = s.autor and not g.pendente)
          when 'proximos' then exists (select 1 from rede_seguindo g where g.quem = p_quem and g.segue = s.autor and not g.pendente)
                           and exists (select 1 from rede_seguindo g where g.quem = s.autor and g.segue = p_quem and not g.pendente)
          else false end))
$$;

/** O story vivo (F5): a regra e as 24 h. */
create or replace function interno.rede5_story_ve(s interno.rede_stories, p_quem uuid) returns boolean language sql stable security definer set search_path = interno, pg_temp as $$
  select s.expira_em > now() and interno.rede5_story_regra(s, p_quem)
$$;

/** Está guardado em algum destaque? */
create or replace function interno.rede5_story_no_destaque(p_id uuid) returns boolean language sql stable security definer set search_path = interno, pg_temp as $$
  select exists (select 1 from rede_story_no_destaque d where d.story = p_id)
$$;

/** O story num destaque: a mesma regra de público, sem prazo (retido continua escondido, bloqueio continua valendo). */
create or replace function interno.rede5_story_ve_destaque(s interno.rede_stories, p_quem uuid) returns boolean language sql stable security definer set search_path = interno, pg_temp as $$
  select interno.rede5_story_no_destaque(s.id) and interno.rede5_story_regra(s, p_quem)
$$;

/** A faxina não leva: prova de denúncia aberta (F5) ou story guardado num destaque. */
create or replace function interno.rede5_story_guardado(p_id uuid) returns boolean language sql stable security definer set search_path = interno, pg_temp as $$
  select interno.rede5_story_em_prova(p_id) or interno.rede5_story_no_destaque(p_id)
$$;

/** Um story que esta pessoa vê (vivo, ou guardado num destaque), ou "nao_encontrado" (o mesmo erro para os dois casos). */
create or replace function interno.rede5_story_visivel(p_id uuid, p_quem uuid) returns interno.rede_stories language plpgsql stable security definer set search_path = interno, pg_temp as $$
declare s rede_stories;
begin
  select * into s from rede_stories where id = p_id;
  if not found or not (interno.rede5_story_ve(s, p_quem) or interno.rede5_story_ve_destaque(s, p_quem)) then perform interno.erro('nao_encontrado'); end if;
  return s;
end $$;

/** Regra de leitura do depósito: o arquivo é de um story que quem pede vê, vivo ou num destaque. */
create or replace function public.rede_story_pode(p_caminho text) returns boolean language sql stable security definer set search_path = interno, pg_temp as $$
  select exists (select 1 from rede_stories s where s.midia_caminho = p_caminho
                 and (interno.rede5_story_ve(s, auth.uid()) or interno.rede5_story_ve_destaque(s, auth.uid())))
$$;

-- ── 4. O story como a tela recebe ─────────────────────────────────────────────────────────────────────────────────────────
/** Uma figurinha como `p_quem` a vê (a F5, mais a menção de comunidade com o nome atual dela). */
create or replace function interno.rede5_story_figurinha(f interno.rede_story_figurinhas, s interno.rede_stories, p_quem uuid) returns jsonb language plpgsql stable security definer set search_path = interno, pg_temp as $$
declare v_ato uuid; p rede_posts; v_n0 integer; v_n1 integer; c rede_comunidades;
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
    -- Comunidade que não é aberta: quem não é membro vê o nome, sem o atalho para ela.
    if c.tipo <> 'aberta' and not exists (select 1 from rede_comunidade_membros m where m.comunidade = c.slug and m.usuario = p_quem and m.situacao = 'ativo') then
      return jsonb_build_object('tipo', 'comunidade', 'slug', null, 'nome', c.nome);
    end if;
    return jsonb_build_object('tipo', 'comunidade', 'slug', c.slug, 'nome', c.nome);
  else
    return jsonb_build_object('tipo', 'link', 'url', f.dados ->> 'url', 'rotulo', f.dados ->> 'rotulo');
  end if;
end $$;

/** O story inteiro como `p_quem` o vê. Vídeo: caminho cru, duração e se tem som. A autora vê em quais destaques ele está. */
create or replace function interno.rede5_story_json(s interno.rede_stories, p_quem uuid) returns jsonb language sql stable security definer set search_path = interno, pg_temp as $$
  select jsonb_build_object(
    'id', s.id, 'autora', interno.rede5_story_autora(s.autor), 'criado_em', s.criado_em, 'expira_em', s.expira_em, 'publico', s.publico,
    'fundo', case
      when s.fundo = 'imagem' then jsonb_build_object('tipo', 'imagem', 'cor', s.cor, 'caminho', s.midia_caminho, 'url', '', 'alt', coalesce(s.alt, ''))
      when s.fundo = 'video' then jsonb_build_object('tipo', 'video', 'cor', s.cor, 'caminho', s.midia_caminho, 'url', '', 'alt', coalesce(s.alt, ''),
                                                     'duracao', s.duracao_ms, 'som', s.som)
      else jsonb_build_object('tipo', s.fundo, 'cor', s.cor) end,
    'texto', s.texto, 'legenda', s.legenda, 'meu', s.autor = p_quem, 'estilo', s.estilo,
    'destaques', case when s.autor = p_quem then coalesce((select jsonb_agg(d.destaque) from rede_story_no_destaque d where d.story = s.id), '[]'::jsonb) end,
    'figurinhas', coalesce((select jsonb_agg(interno.rede5_story_figurinha(f, s, p_quem) || jsonb_strip_nulls(jsonb_build_object('pos', f.dados -> 'pos')) order by f.ordem) from rede_story_figurinhas f where f.story = s.id), '[]'::jsonb))
$$;

/** O estilo do texto, limpo: só chaves e valores da lista fechada (nunca CSS livre). Valor fora da lista é recusado. */
create or replace function interno.rede5_story_estilo(p jsonb) returns jsonb language plpgsql immutable security definer set search_path = interno, pg_temp as $$
declare
  v_fonte text := coalesce(p ->> 'fonte', 'condensada');
  v_cor text := nullif(p ->> 'cor_texto', '');
  v_alinhar text := coalesce(p ->> 'alinhar', 'esq');
  v_caixa text := coalesce(p ->> 'caixa', 'nenhuma');
begin
  if p is null or jsonb_typeof(p) = 'null' then return '{}'::jsonb; end if;
  if jsonb_typeof(p) <> 'object' then perform interno.erro('invalido:estilo'); end if;
  if exists (select 1 from jsonb_object_keys(p) k where k not in ('fonte', 'cor_texto', 'alinhar', 'caixa')) then perform interno.erro('invalido:estilo'); end if;
  if v_fonte not in ('condensada', 'serifa', 'maquina', 'marcador') then perform interno.erro('invalido:estilo'); end if;
  if v_cor is not null and v_cor not in ('papel', 'azul', 'vermelho', 'dourado', 'verde', 'rosa', 'noite') then perform interno.erro('invalido:estilo'); end if;
  if v_alinhar not in ('esq', 'centro', 'dir') then perform interno.erro('invalido:estilo'); end if;
  if v_caixa not in ('nenhuma', 'caixa') then perform interno.erro('invalido:estilo'); end if;
  return jsonb_strip_nulls(jsonb_build_object('fonte', v_fonte, 'cor_texto', v_cor, 'alinhar', v_alinhar, 'caixa', v_caixa));
end $$;

-- ── 5. Publicar (a F5, com vídeo, estilo e a menção de comunidade) ────────────────────────────────────────────────────────
/**
 * Onde a figurinha fica na tela, como a autora a deixou no "criar": x e y de 0 a 1 (o centro dela na tela do story), o giro em
 * graus (até 45 para cada lado, para continuar legível) e o tamanho (0,5 a 1,6). Só números; fora disso, nulo (a tela escolhe).
 */
create or replace function interno.rede5_story_pos(p jsonb) returns jsonb language plpgsql immutable set search_path = interno, pg_temp as $$
declare x numeric; y numeric; g numeric := 0; e numeric := 1;
begin
  if p is null or jsonb_typeof(p) is distinct from 'object' then return null; end if;
  if jsonb_typeof(p -> 'x') is distinct from 'number' or jsonb_typeof(p -> 'y') is distinct from 'number' then return null; end if;
  x := (p ->> 'x')::numeric;
  y := (p ->> 'y')::numeric;
  if jsonb_typeof(p -> 'giro') = 'number' then g := (p ->> 'giro')::numeric; end if;
  if jsonb_typeof(p -> 'escala') = 'number' then e := (p ->> 'escala')::numeric; end if;
  return jsonb_build_object('x', round(least(0.95, greatest(0.05, x)), 4), 'y', round(least(0.95, greatest(0.05, y)), 4),
    'giro', round(least(45, greatest(-45, g)), 1), 'escala', round(least(1.6, greatest(0.5, e)), 3));
end $$;

/**
 * Publica um story (PedidoDeStory de lib/rede/tipos-stories.ts). Tudo da F5 continua: público, fundo, tamanhos, dado pessoal,
 * até 3 figurinhas (uma enquete e uma contagem no máximo), link só https, contagem só de ato meu ou confirmado, 20 por dia. Novo:
 * vídeo (.mp4/.webm, até 20 MB, 0,3 a 60 s; sem som = o arquivo nem tem áudio, o aparelho garante e a tela respeita), o estilo
 * do texto e a menção de comunidade. O texto do link passa a ser opcional (a tela mostra o domínio).
 */
create or replace function public.rede_story_publicar(p jsonb) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare
  v uuid := interno.rede5_story_membro();
  v_publico text := coalesce(p ->> 'publico', 'seguidores');
  v_fundo text := coalesce(p -> 'fundo' ->> 'tipo', 'listras');
  v_cor text := coalesce(p -> 'fundo' ->> 'cor', 'azul');
  v_texto text; v_legenda text; v_alt text; v_imagem text := nullif(btrim(coalesce(p ->> 'imagem', '')), '');
  v_post uuid; pr rede_posts; v_figs jsonb := coalesce(p -> 'figurinhas', '[]'::jsonb);
  f jsonb; v_tipo text; v_limpas jsonb := '[]'::jsonb; v_tudo text := ''; v_ato uuid; v_titulo text; v_inicio timestamptz;
  v_url text; v_rotulo text; v_perg text; v_op0 text; v_op1 text; v_enquetes integer := 0; v_contagens integer := 0; v_comunidades integer := 0;
  v_tam bigint; v_mime text; s rede_stories; i integer := 0; v_duracao integer; v_som boolean := false; v_estilo jsonb; c rede_comunidades;
begin
  if p is null or jsonb_typeof(p) is distinct from 'object' then perform interno.erro('invalido:pedido'); end if;
  if v_publico not in ('seguidores', 'membros', 'proximos') then perform interno.erro('invalido:publico'); end if;
  if v_fundo not in ('listras', 'mosaico', 'imagem', 'video') then perform interno.erro('invalido:fundo'); end if;
  if v_cor not in ('azul', 'vermelho', 'dourado', 'verde', 'rosa', 'noite') then perform interno.erro('invalido:cor'); end if;
  if not exists (select 1 from perfis where id = v and rede_handle is not null) then perform interno.erro('sem_handle'); end if;
  v_texto := interno.txt(p ->> 'texto', 'texto', 0, 140);
  v_legenda := nullif(interno.txt(p ->> 'legenda', 'legenda', 0, 80), '');
  v_alt := nullif(interno.txt(p ->> 'alt', 'alt', 0, 200), '');
  v_estilo := interno.rede5_story_estilo(p -> 'estilo');
  if jsonb_typeof(v_figs) is distinct from 'array' or jsonb_array_length(v_figs) > 3 then perform interno.erro('invalido:figurinhas'); end if;

  -- A mídia: imagem ou vídeo exigem o caminho, e o caminho só vale com um dos dois.
  if (v_fundo in ('imagem', 'video')) <> (v_imagem is not null) then perform interno.erro('invalido:imagem'); end if;
  if v_fundo = 'video' then
    begin v_duracao := round((p -> 'video' ->> 'duracao_ms')::numeric)::integer; exception when others then v_duracao := null; end;
    if v_duracao is null or v_duracao not between 300 and 60500 then perform interno.erro('invalido:video'); end if;
    v_som := coalesce((p -> 'video' ->> 'som')::boolean, false);
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
    if not found or not interno.rede2_pode_ver(pr, v) then perform interno.erro('nao_encontrado'); end if;
  end if;

  for f in select * from jsonb_array_elements(v_figs) loop
    v_tipo := f ->> 'tipo';
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
      -- Comunidade restrita ou fechada só pela autora que é membro ativa (a menção não revela que a comunidade existe para quem não pode saber).
      if not found or (c.tipo <> 'aberta' and not exists (select 1 from rede_comunidade_membros m where m.comunidade = c.slug and m.usuario = v and m.situacao = 'ativo')) then
        perform interno.erro('invalido:comunidade');
      end if;
      v_limpas := v_limpas || jsonb_build_object('tipo', 'comunidade', 'dados', jsonb_build_object('slug', c.slug, 'nome', c.nome));
    else
      perform interno.erro('invalido:figurinha');
    end if;
    -- O lugar na tela (opcional): só o que passa em rede5_story_pos.
    if interno.rede5_story_pos(f -> 'pos') is not null then
      v_limpas := jsonb_set(v_limpas, array[(jsonb_array_length(v_limpas) - 1)::text, 'dados', 'pos'], interno.rede5_story_pos(f -> 'pos'));
    end if;
  end loop;
  if v_enquetes > 1 or v_contagens > 1 or v_comunidades > 1 then perform interno.erro('invalido:figurinhas'); end if;
  if v_texto = '' and v_imagem is null and jsonb_array_length(v_limpas) = 0 then perform interno.erro('invalido:vazio'); end if;
  if interno.rede3_pub_dado_pessoal(v_texto || E'\n' || coalesce(v_legenda, '') || E'\n' || coalesce(v_alt, '') || v_tudo) then perform interno.erro('dado_pessoal'); end if;

  perform interno.limite('rede5_story_publicar', 20, 1440);
  insert into rede_stories (autor, publico, fundo, cor, texto, legenda, midia_caminho, alt, post_ref, conferido, duracao_ms, som, estilo)
  values (v, v_publico, v_fundo, v_cor, v_texto, v_legenda, v_imagem, v_alt, v_post, v_imagem is null, v_duracao, v_som, v_estilo)
  returning * into s;
  for f in select * from jsonb_array_elements(v_limpas) loop
    insert into rede_story_figurinhas (story, ordem, tipo, dados) values (s.id, i, f ->> 'tipo', f -> 'dados');
    i := i + 1;
  end loop;
  return jsonb_build_object('id', s.id, 'expira_em', s.expira_em);
end $$;

/** As comunidades que posso mencionar num story: as minhas (membro ativa), até 30, pelo nome. Sem número de membros. */
create or replace function public.rede_story_comunidades() returns jsonb language plpgsql stable security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.rede5_story_membro();
begin
  return coalesce((select jsonb_agg(jsonb_build_object('slug', x.slug, 'nome', x.nome) order by x.nome)
    from (select c.slug, c.nome from rede_comunidades c join rede_comunidade_membros m on m.comunidade = c.slug
          where m.usuario = v and m.situacao = 'ativo' order by c.nome limit 30) x), '[]'::jsonb);
end $$;

-- ── 6. Destaques ──────────────────────────────────────────────────────────────────────────────────────────────────────────
/**
 * Os destaques de alguém (@handle), como eu os vejo: só os que têm algum story que eu posso ver, com quantos stories (nunca
 * pessoas) e a capa (a cor e o caminho do primeiro story com mídia, que o aparelho troca por um endereço assinado). A dona vê
 * todos, inclusive os vazios. Visitante e quem não é da Alumia recebem a lista vazia. Leitura pura: nada é gravado.
 */
create or replace function public.rede_story_destaques(p_handle text) returns jsonb language plpgsql stable security definer set search_path = interno, pg_temp as $$
declare v uuid := auth.uid(); v_autor uuid;
begin
  if v is null or not interno.rede2_membro(v) then return '[]'::jsonb; end if;
  perform interno.rede5_story_ligado();
  if coalesce(p_handle, '') !~ '^[a-z0-9_]{3,20}$' then perform interno.erro('invalido:handle'); end if;
  select id into v_autor from perfis where rede_handle = p_handle;
  if not found then return '[]'::jsonb; end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object('id', d.id, 'titulo', d.titulo, 'cor', d.cor, 'n', x.n,
             'capa', case when x.capa is not null then jsonb_build_object('caminho', x.capa, 'tipo', x.capa_tipo) end) order by d.criado_em)
    from rede_story_destaques d
    cross join lateral (
      select count(*)::integer as n,
             (array_agg(s.midia_caminho order by nd.posto_em) filter (where s.midia_caminho is not null and s.fundo = 'imagem'))[1] as capa,
             'imagem'::text as capa_tipo
      from rede_story_no_destaque nd join rede_stories s on s.id = nd.story
      where nd.destaque = d.id and interno.rede5_story_regra(s, v)) x
    where d.autor = v_autor and (x.n > 0 or d.autor = v)), '[]'::jsonb);
end $$;

/** Os stories de um destaque, do mais antigo ao mais novo, só os que eu posso ver (a mesma regra de público, sem o prazo). */
create or replace function public.rede_story_destaque_abrir(p_id uuid) returns jsonb language plpgsql stable security definer set search_path = interno, pg_temp as $$
declare v uuid := auth.uid();
begin
  if v is null or not interno.rede2_membro(v) then return '[]'::jsonb; end if;
  perform interno.rede5_story_ligado();
  return coalesce((select jsonb_agg(interno.rede5_story_json(s, v) order by s.criado_em)
    from rede_story_no_destaque nd join rede_stories s on s.id = nd.story
    where nd.destaque = p_id and interno.rede5_story_ve_destaque(s, v)), '[]'::jsonb);
end $$;

/**
 * Guardar um story meu num destaque (novo, se p_destaque é nulo; até 6 destaques e 60 stories em cada) e/ou renomear e trocar a
 * cor de um destaque meu. O story precisa ser meu e estar no ar (ou já guardado). Título passa pela checagem de dado pessoal.
 */
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
    insert into rede_story_destaques (autor, titulo, cor) values (v, v_titulo, coalesce(p_cor, 'vermelho')) returning * into d;
  else
    select * into d from rede_story_destaques where id = p_destaque and autor = v;
    if not found then perform interno.erro('nao_encontrado'); end if;
    update rede_story_destaques set titulo = coalesce(v_titulo, titulo), cor = coalesce(p_cor, cor) where id = d.id returning * into d;
  end if;
  if p_story is not null then
    if (select count(*) from rede_story_no_destaque where destaque = d.id) >= 60 then perform interno.erro('limite:destaque'); end if;
    insert into rede_story_no_destaque (destaque, story) values (d.id, s.id) on conflict do nothing;
  end if;
  return jsonb_build_object('id', d.id, 'titulo', d.titulo, 'cor', d.cor);
end $$;

/** Tirar um story meu de um destaque meu. Vencido e fora de todo destaque, ele volta para a faxina. */
create or replace function public.rede_story_destaque_tirar(p_destaque uuid, p_story uuid) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.rede5_story_membro();
begin
  perform interno.limite('rede5_story_destaque', 60, 60);
  if not exists (select 1 from rede_story_destaques where id = p_destaque and autor = v) then perform interno.erro('nao_encontrado'); end if;
  delete from rede_story_no_destaque where destaque = p_destaque and story = p_story;
  return jsonb_build_object('ok', true);
end $$;

/** Apagar um destaque meu (os stories vencidos dele voltam para a faxina; os que estão no ar seguem até as 24 h). */
create or replace function public.rede_story_destaque_apagar(p_destaque uuid) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.rede5_story_membro(); v_n integer;
begin
  perform interno.limite('rede5_story_destaque', 60, 60);
  delete from rede_story_destaques where id = p_destaque and autor = v;
  get diagnostics v_n = row_count;
  if v_n = 0 then perform interno.erro('nao_encontrado'); end if;
  return jsonb_build_object('apagado', true);
end $$;

-- ── 7. Faxina: não leva o que está num destaque ───────────────────────────────────────────────────────────────────────────
create or replace function interno.rede5_story_faxina() returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare
  v_lembretes integer; v_texto integer;
  v_url text := (select valor ->> 'funcao' from configuracoes where chave = 'stories');
  v_chave text := coalesce((select valor ->> 'chave_publica' from configuracoes where chave = 'stories'), '');
  v_segredo text := coalesce((select valor ->> 'segredo' from configuracoes where chave = 'stories'), '');
  v_chamou boolean := false;
begin
  v_lembretes := interno.rede5_story_lembretes();
  with fora as (delete from rede_stories s where s.expira_em <= now() and s.midia_caminho is null and not interno.rede5_story_guardado(s.id) returning 1)
  select count(*)::integer into v_texto from fora;
  if coalesce(v_url, '') ~ '^https://[a-z0-9.-]+/functions/v1/faxina-stories$' and exists (select 1 from pg_extension where extname = 'pg_net')
     and (exists (select 1 from rede_stories s where s.midia_caminho is not null and (not s.conferido or s.expira_em <= now())) or to_regclass('storage.objects') is not null) then
    execute 'select net.http_post(url := $1, body := ''{}''::jsonb, headers := $2, timeout_milliseconds := 60000)'
      using v_url, jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || v_chave, 'apikey', v_chave, 'x-lucia-segredo', v_segredo);
    v_chamou := true;
  end if;
  return jsonb_build_object('lembretes', v_lembretes, 'apagados', v_texto, 'chamou', v_chamou);
end $$;

create or replace function public.rede_story_faxina_lista(p_limite integer default 200) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v_lim integer := greatest(1, least(coalesce(p_limite, 200), 500)); v_orfaos jsonb := '[]'::jsonb;
begin
  if to_regclass('storage.objects') is not null then
    execute 'select coalesce(jsonb_agg(o.name), ''[]''::jsonb) from (select name from storage.objects o where o.bucket_id = ''rede-stories''
               and o.created_at < now() - interval ''1 hour'' and not exists (select 1 from interno.rede_stories s where s.midia_caminho = o.name)
               order by o.created_at limit $1) o'
      into v_orfaos using v_lim;
  end if;
  return jsonb_build_object(
    'apagar', coalesce((select jsonb_agg(jsonb_build_object('id', x.id, 'caminho', x.midia_caminho)) from (
      select s.id, s.midia_caminho from rede_stories s where s.expira_em <= now() and s.midia_caminho is not null and not interno.rede5_story_guardado(s.id)
      order by s.expira_em limit v_lim) x), '[]'::jsonb),
    'conferir', coalesce((select jsonb_agg(jsonb_build_object('id', x.id, 'caminho', x.midia_caminho)) from (
      select s.id, s.midia_caminho from rede_stories s where s.midia_caminho is not null and not s.conferido and (s.expira_em > now() or interno.rede5_story_no_destaque(s.id))
      order by s.criado_em limit least(v_lim, 50)) x), '[]'::jsonb),
    'orfaos', v_orfaos);
end $$;

create or replace function public.rede_story_faxina_feito(p_apagados uuid[], p_conferidos uuid[], p_ruins uuid[]) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v_a integer; v_c integer; v_r integer;
begin
  with fora as (delete from rede_stories s where s.id = any (coalesce(p_apagados, '{}')) and s.expira_em <= now() and not interno.rede5_story_guardado(s.id) returning 1)
  select count(*)::integer into v_a from fora;
  update rede_stories set conferido = true where id = any (coalesce(p_conferidos, '{}')) and not conferido;
  get diagnostics v_c = row_count;
  -- Arquivo ruim: sai do ar E de todo destaque (senão o destaque o guardaria para sempre).
  delete from rede_story_no_destaque where story = any (coalesce(p_ruins, '{}'));
  update rede_stories set expira_em = least(expira_em, now()), conferido = true where id = any (coalesce(p_ruins, '{}'));
  get diagnostics v_r = row_count;
  return jsonb_build_object('apagados', v_a, 'conferidos', v_c, 'ruins', v_r);
end $$;

-- ── 8. O depósito aceita vídeo (até 20 MB; a função de publicar limita a imagem a 3 MB) ─────────────────────────────────────
do $$
begin
  if exists (select 1 from pg_namespace where nspname = 'storage') and to_regclass('storage.buckets') is not null then
    insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    values ('rede-stories', 'rede-stories', false, 20971520, array['image/webp', 'image/png', 'image/jpeg', 'video/mp4', 'video/webm'])
    on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;
  end if;
end $$;

-- ── 9. Permissões (a versão da Alumia, public.rede_alumia_versao, sobe na migração final da onda, pelo integrador) ────────────────────────────────────────────────────────────────────────────────────────────────────────
revoke all on function interno.rede5_story_regra(interno.rede_stories, uuid), interno.rede5_story_no_destaque(uuid),
  interno.rede5_story_ve_destaque(interno.rede_stories, uuid), interno.rede5_story_guardado(uuid), interno.rede5_story_estilo(jsonb), interno.rede5_story_pos(jsonb) from public;
revoke all on function public.rede_story_comunidades(), public.rede_story_destaques(text), public.rede_story_destaque_abrir(uuid),
  public.rede_story_destaque_salvar(uuid, text, uuid, text), public.rede_story_destaque_tirar(uuid, uuid), public.rede_story_destaque_apagar(uuid) from public;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on function interno.rede5_story_regra(interno.rede_stories, uuid), interno.rede5_story_no_destaque(uuid),
      interno.rede5_story_ve_destaque(interno.rede_stories, uuid), interno.rede5_story_guardado(uuid), interno.rede5_story_estilo(jsonb), interno.rede5_story_pos(jsonb) from anon, authenticated;
    revoke all on function public.rede_story_comunidades(), public.rede_story_destaques(text), public.rede_story_destaque_abrir(uuid),
      public.rede_story_destaque_salvar(uuid, text, uuid, text), public.rede_story_destaque_tirar(uuid, uuid), public.rede_story_destaque_apagar(uuid) from anon, authenticated;
    -- Leitura só com conta (visitante não vê story nenhum: a F5 só deixa a ele a faixa e o abrir, que voltam vazios).
    grant execute on function public.rede_story_destaques(text), public.rede_story_destaque_abrir(uuid) to authenticated, service_role;
    -- Com conta.
    grant execute on function public.rede_story_comunidades(), public.rede_story_destaque_salvar(uuid, text, uuid, text),
      public.rede_story_destaque_tirar(uuid, uuid), public.rede_story_destaque_apagar(uuid) to authenticated, service_role;
    -- As da F5 que foram refeitas aqui mantêm as permissões (create or replace não muda o grant), mas confirma:
    grant execute on function public.rede_story_publicar(jsonb), public.rede_story_pode(text) to authenticated, service_role;
  end if;
end $$;

-- ═══════════════════════════ fim de stories com vídeo e destaques ═══════════════════════════
