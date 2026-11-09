-- Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
--
-- ═══════════════════════════ Alumia · Onda 5 · F5 · stories de 24 h (09/11/2026) ═══════════════════════════
-- docs/plano-2026-11/PLANO-ALUMIA.md, seções 5 (F5), 6.4, 7.2 e 8 (F5). O back-end mínimo para cada função da tela funcionar de
-- verdade: publicar, a faixa, abrir, apagar, responder, reagir, votar na enquete, "me avise", os atos da contagem e denunciar; o
-- depósito privado rede-stories; e a faxina de 15 em 15 minutos (pg_cron → Edge Function supabase/functions/faxina-stories).
-- As funções têm os nomes que o front-end já chama (lib/rede/cliente-stories.ts).
--
-- Depende da F0 (20261109-alumia-f0-contrato.sql: alvo 'story' nas denúncias e na moderação, aviso 'story_resposta').
-- Idempotente: pode rodar duas vezes (scripts/testar-alumia-f5.mjs roda duas vezes no banco local). NÃO está no install.sql (o
-- integrador cola depois da F4) e NÃO roda em produção sem o Jonathan.
--
-- Regras (PLANO §5): tudo em `interno`, RLS ligada e nenhuma permissão direta para anon/authenticated; acesso só por função
-- security definer com search_path = interno, pg_temp, que confere quem chama (interno.eu, rede2_membro, bloqueio) e limita o uso
-- (interno.limite / rede2_limite).
--
-- Privacidade (leis conferidas no texto, leis-do-brasil):
--   * LGPD (Lei 13.709/2018) art. 5º, II e art. 11: o que alguém viu, votou ou a que reagiu numa rede militante revela opinião
--     política, dado sensível. Por isso NÃO existe tabela, coluna nem contagem de quem viu (nem "quantos viram"); o voto da enquete
--     é secreto e a autora vê só a soma, a partir de 3 votos; a reação chega à autora sem o nome de quem reagiu.
--   * LGPD art. 6º, III (necessidade): o voto não guarda hora; a resposta e a reação somem com o story (cascata, e o aviso que
--     levou a resposta sai junto); o arquivo sai do depósito pela faxina; nada de GPS (o aparelho refaz a imagem sem EXIF e a
--     faxina confere de novo no servidor, tirando EXIF/XMP/texto que tenha sobrado).
--   * ECA (Lei 8.069/1990) e ECA Digital (Lei 15.211/2025) art. 9º § 1º: a Alumia é só 18+; só membro (rede2_membro: 18 anos
--     declarados e consentimento em vigor) publica, vê, responde ou vota. Denúncia de "menores" retém o story na hora.
--   * Marco Civil (Lei 12.965/2014) art. 15: nada aqui grava IP. A prova de um story denunciado fica no banco e no depósito
--     privado até a decisão da moderação, mesmo depois das 24 h (PLANO §7.2); decidida a denúncia, a faxina apaga.
--   * Stories nunca federam (PLANO §6.8): nada daqui entra nas tabelas rede_fed_*.

-- ── 1. Tabelas ────────────────────────────────────────────────────────────────────────────────────────────────────────────
create table if not exists interno.rede_stories (
  id uuid primary key default gen_random_uuid(),
  autor uuid not null references interno.perfis (id) on delete cascade,
  -- A identidade que publicou é SEMPRE a própria autora (o dono de uma identidade nunca fica gravado aqui, PLANO §6.6).
  como uuid references interno.perfis (id) on delete cascade,
  publico text not null default 'seguidores' check (publico in ('seguidores', 'membros', 'proximos')),
  fundo text not null default 'listras' check (fundo in ('listras', 'mosaico', 'imagem')),
  cor text not null default 'azul' check (cor in ('azul', 'vermelho', 'dourado', 'verde', 'rosa', 'noite')),
  texto text not null default '' check (char_length(texto) <= 140),
  legenda text check (legenda is null or char_length(legenda) between 1 and 80),
  -- "<uid>/<id>.<ext>" no depósito privado rede-stories; o arquivo só é lido por rede_story_pode (a mesma regra da tela).
  midia_caminho text unique check (midia_caminho is null or midia_caminho ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f-]{32,36}\.(webp|png|jpg)$'),
  alt text check (alt is null or char_length(alt) <= 200),
  post_ref uuid references interno.rede_posts (id) on delete set null,
  -- Retido por denúncia urgente: some para todos menos a autora e a faxina guarda a prova até a decisão.
  retido boolean not null default false,
  -- A faxina já conferiu o arquivo no servidor (sem EXIF/XMP). Story só de texto nasce conferido.
  conferido boolean not null default false,
  expira_em timestamptz not null default now() + interval '24 hours',
  criado_em timestamptz not null default now(),
  constraint rede_stories_como_autor check (como is null or como = autor),
  constraint rede_stories_imagem check ((fundo = 'imagem') = (midia_caminho is not null)),
  constraint rede_stories_24h check (expira_em <= criado_em + interval '24 hours')
);
create index if not exists rede_stories_autor on interno.rede_stories (autor, expira_em);
create index if not exists rede_stories_expira on interno.rede_stories (expira_em);

-- No máximo 3 figurinhas por story (ordem 0..2); os dados já vêm limpos pela função de publicar.
create table if not exists interno.rede_story_figurinhas (
  story uuid not null references interno.rede_stories (id) on delete cascade,
  ordem smallint not null check (ordem between 0 and 2),
  tipo text not null check (tipo in ('contagem', 'pergunta', 'enquete', 'link')),
  dados jsonb not null default '{}'::jsonb check (jsonb_typeof(dados) = 'object' and pg_column_size(dados) <= 2048),
  primary key (story, ordem)
);

-- Resposta: vai SÓ para a autora (num aviso dela) e some com o story; `aviso` liga a resposta ao aviso para os dois sumirem juntos.
create table if not exists interno.rede_story_respostas (
  id uuid primary key default gen_random_uuid(),
  story uuid not null references interno.rede_stories (id) on delete cascade,
  quem uuid not null references interno.perfis (id) on delete cascade,
  texto text not null check (char_length(texto) between 1 and 500),
  aviso uuid references interno.avisos (id) on delete set null,
  criado_em timestamptz not null default now()
);
create index if not exists rede_story_respostas_story on interno.rede_story_respostas (story);
create index if not exists rede_story_respostas_quem on interno.rede_story_respostas (quem, criado_em);

-- Reação do conjunto fechado (PLANO §6.3): uma por pessoa e story; a autora recebe "Alguém reagiu…", sem o nome.
create table if not exists interno.rede_story_reacoes (
  story uuid not null references interno.rede_stories (id) on delete cascade,
  quem uuid not null references interno.perfis (id) on delete cascade,
  reacao text not null check (reacao in ('punho', 'chama', 'coracao')),
  aviso uuid references interno.avisos (id) on delete set null,
  primary key (story, quem)
);

-- Voto secreto na enquete (uma por story): sem hora (LGPD art. 6º, III); ninguém lê a linha, só a soma sai, e só para a autora.
create table if not exists interno.rede_story_votos (
  story uuid not null references interno.rede_stories (id) on delete cascade,
  quem uuid not null references interno.perfis (id) on delete cascade,
  opcao smallint not null check (opcao in (0, 1)),
  primary key (story, quem)
);

-- "Me avise quando começar": um lembrete MEU do ato (nem a autora do story nem quem organiza o ato sabe quem pediu).
create table if not exists interno.rede_story_lembretes (
  ato uuid not null references interno.rede_posts (id) on delete cascade,
  quem uuid not null references interno.perfis (id) on delete cascade,
  primary key (ato, quem)
);

do $$
declare t text;
begin
  foreach t in array array['rede_stories', 'rede_story_figurinhas', 'rede_story_respostas', 'rede_story_reacoes', 'rede_story_votos', 'rede_story_lembretes'] loop
    execute format('alter table interno.%I enable row level security', t);
    execute format('revoke all on table interno.%I from public', t);
    if exists (select 1 from pg_roles where rolname = 'anon') then
      execute format('revoke all on table interno.%I from anon, authenticated', t);
    end if;
  end loop;
end $$;

-- O aviso que levou a resposta (ou a reação) sai quando a resposta sai: apagar o story, a faxina ou a conta de quem respondeu.
create or replace function interno.rede5_story_tirar_aviso() returns trigger language plpgsql security definer set search_path = interno, pg_temp as $$
begin
  if old.aviso is not null then delete from avisos where id = old.aviso; end if;
  return null;
end $$;
drop trigger if exists rede5_story_tirar_aviso on interno.rede_story_respostas;
create trigger rede5_story_tirar_aviso after delete on interno.rede_story_respostas for each row execute function interno.rede5_story_tirar_aviso();
drop trigger if exists rede5_story_tirar_aviso on interno.rede_story_reacoes;
create trigger rede5_story_tirar_aviso after delete on interno.rede_story_reacoes for each row execute function interno.rede5_story_tirar_aviso();

-- ── 2. Regras internas ────────────────────────────────────────────────────────────────────────────────────────────────────

/** A coordenação desligou os stories pelo painel? (A flag da montagem só esconde a tela; esta trava vale também para a API.) */
create or replace function interno.rede5_story_ligado() returns void language plpgsql stable security definer set search_path = interno, pg_temp as $$
begin
  if exists (select 1 from recursos_vivos where nome in ('rede-v2', 'alumia-2', 'alumia-stories') and not ligado) then
    perform interno.erro('recurso_desligado');
  end if;
end $$;

/**
 * Esta pessoa pode ver este story? Uma regra só, para a tela, o depósito e cada ação (responder, reagir, votar, denunciar).
 * A autora vê o seu enquanto está no ar (retido também). Os outros: membro da Alumia, autora ainda membro, sem bloqueio em
 * nenhum sentido, no ar, não retido, e o público: seguidores (segue aceito), membros (quem é da Alumia) ou próximos (seguem um ao
 * outro). Visitante nunca vê (nenhum público é "internet").
 */
create or replace function interno.rede5_story_ve(s interno.rede_stories, p_quem uuid) returns boolean language sql stable security definer set search_path = interno, pg_temp as $$
  select s.id is not null and p_quem is not null and s.expira_em > now() and (
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

/** A autora como aparece: @handle, codinome (nunca nome civil) e uma cor de 1 a 5 tirada do id (não diz nada sobre ela). */
create or replace function interno.rede5_story_autora(p_autor uuid) returns jsonb language sql stable security definer set search_path = interno, pg_temp as $$
  select jsonb_build_object('handle', f.rede_handle, 'nome', interno.rede_nome(f.id), 'cor', (abs(hashtext(f.id::text)) % 5) + 1)
  from perfis f where f.id = p_autor
$$;

/** Uma figurinha como `p_quem` a vê (a soma da enquete só para a autora, e só a partir de 3 votos). */
create or replace function interno.rede5_story_figurinha(f interno.rede_story_figurinhas, s interno.rede_stories, p_quem uuid) returns jsonb language plpgsql stable security definer set search_path = interno, pg_temp as $$
declare v_ato uuid; p rede_posts; v_n0 integer; v_n1 integer;
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
  else
    return jsonb_build_object('tipo', 'link', 'url', f.dados ->> 'url', 'rotulo', f.dados ->> 'rotulo');
  end if;
end $$;

/** O story inteiro como `p_quem` o vê. O caminho da imagem volta cru: o aparelho pede o endereço assinado ao depósito. */
create or replace function interno.rede5_story_json(s interno.rede_stories, p_quem uuid) returns jsonb language sql stable security definer set search_path = interno, pg_temp as $$
  select jsonb_build_object(
    'id', s.id, 'autora', interno.rede5_story_autora(s.autor), 'criado_em', s.criado_em, 'expira_em', s.expira_em, 'publico', s.publico,
    'fundo', case when s.fundo = 'imagem' then jsonb_build_object('tipo', 'imagem', 'cor', s.cor, 'caminho', s.midia_caminho, 'url', '', 'alt', coalesce(s.alt, ''))
                  else jsonb_build_object('tipo', s.fundo, 'cor', s.cor) end,
    'texto', s.texto, 'legenda', s.legenda, 'meu', s.autor = p_quem,
    'figurinhas', coalesce((select jsonb_agg(interno.rede5_story_figurinha(f, s, p_quem) order by f.ordem) from rede_story_figurinhas f where f.story = s.id), '[]'::jsonb))
$$;

/** O story vai ficar como prova? (há denúncia ainda aberta sobre ele: a faxina não apaga, PLANO §7.2) */
create or replace function interno.rede5_story_em_prova(p_id uuid) returns boolean language sql stable security definer set search_path = interno, pg_temp as $$
  select exists (select 1 from rede_denuncias d where d.alvo_tipo = 'story' and d.alvo = p_id::text and d.situacao in ('aberta', 'em_analise'))
$$;

/** Um story que esta pessoa vê, ou o erro "nao_encontrado" (o mesmo para "não existe" e "não pode ver": não confirma nada). */
create or replace function interno.rede5_story_visivel(p_id uuid, p_quem uuid) returns interno.rede_stories language plpgsql stable security definer set search_path = interno, pg_temp as $$
declare s rede_stories;
begin
  select * into s from rede_stories where id = p_id;
  if not found or not interno.rede5_story_ve(s, p_quem) then perform interno.erro('nao_encontrado'); end if;
  return s;
end $$;

/** Quem chama é membro da Alumia (18+, consentimento em vigor) e os stories estão ligados. Devolve o id. */
create or replace function interno.rede5_story_membro() returns uuid language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu();
begin
  perform interno.aberta('comunidade');
  perform interno.rede5_story_ligado();
  if not interno.rede2_membro(v) then perform interno.erro('sem_permissao'); end if;
  return v;
end $$;

-- ── 3. Leitura ────────────────────────────────────────────────────────────────────────────────────────────────────────────

/**
 * As bolinhas do alto da linha: os ids dos MEUS stories no ar e, de quem eu sigo, os que eu posso ver (até 60 pessoas, a mais
 * nova primeiro). Abrir não grava nada: o "já vi" fica só no aparelho. Visitante recebe a faixa vazia.
 */
create or replace function public.rede_story_faixa() returns jsonb language plpgsql stable security definer set search_path = interno, pg_temp as $$
declare v uuid := auth.uid();
begin
  if v is null or not interno.rede2_membro(v) then return jsonb_build_object('meus', '[]'::jsonb, 'grupos', '[]'::jsonb); end if;
  perform interno.rede5_story_ligado();
  return jsonb_build_object(
    'meus', coalesce((select jsonb_agg(s.id order by s.criado_em) from rede_stories s where s.autor = v and s.expira_em > now()), '[]'::jsonb),
    'grupos', coalesce((
      select jsonb_agg(jsonb_build_object('autora', interno.rede5_story_autora(g.autor), 'ids', g.ids, 'ultimo_em', g.ultimo) order by g.ultimo desc)
      from (
        select s.autor, jsonb_agg(s.id order by s.criado_em) as ids, max(s.criado_em) as ultimo
        from rede_seguindo seg join rede_stories s on s.autor = seg.segue
        join perfis f on f.id = s.autor and f.rede_handle is not null
        where seg.quem = v and not seg.pendente and interno.rede5_story_ve(s, v)
        group by s.autor order by max(s.criado_em) desc limit 60) g), '[]'::jsonb));
end $$;

/** Os stories no ar de uma pessoa (@handle), do mais antigo ao mais novo, só os que eu posso ver. Leitura pura (nada de "visto"). */
create or replace function public.rede_story_abrir(p_handle text) returns jsonb language plpgsql stable security definer set search_path = interno, pg_temp as $$
declare v uuid := auth.uid(); v_autor uuid;
begin
  if v is null or not interno.rede2_membro(v) then return '[]'::jsonb; end if;
  perform interno.rede5_story_ligado();
  if coalesce(p_handle, '') !~ '^[a-z0-9_]{3,20}$' then perform interno.erro('invalido:handle'); end if;
  select id into v_autor from perfis where rede_handle = p_handle;
  if not found then return '[]'::jsonb; end if;
  return coalesce((select jsonb_agg(interno.rede5_story_json(s, v) order by s.criado_em)
    from rede_stories s where s.autor = v_autor and interno.rede5_story_ve(s, v)), '[]'::jsonb);
end $$;

/** Os MEUS stories no ar (retido também, com a soma das enquetes a partir de 3). */
create or replace function public.rede_story_meus() returns jsonb language plpgsql stable security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu();
begin
  perform interno.rede5_story_ligado();
  return coalesce((select jsonb_agg(interno.rede5_story_json(s, v) order by s.criado_em) from rede_stories s where s.autor = v and s.expira_em > now()), '[]'::jsonb);
end $$;

/** Os próximos atos que eu organizo ou confirmei e que posso pôr numa contagem (sem número de ninguém). */
create or replace function public.rede_story_atos() returns jsonb language plpgsql stable security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.rede5_story_membro();
begin
  return coalesce((select jsonb_agg(jsonb_build_object('id', x.id, 'titulo', x.titulo, 'inicio', x.inicio) order by x.inicio)
    from (select p.id, left(coalesce(nullif(btrim(p.titulo), ''), btrim(p.texto)), 60) as titulo, c.inicio
          from rede_chamados c join rede_posts p on p.id = c.post
          where c.inicio > now() and not c.cancelado and interno.rede2_pode_ver(p, v)
            and (p.autor = v or exists (select 1 from rede_vou u where u.post = p.id and u.usuario = v))
          order by c.inicio limit 20) x), '[]'::jsonb);
end $$;

-- ── 4. Publicar e apagar ──────────────────────────────────────────────────────────────────────────────────────────────────

/**
 * Publica um story (o pedido de lib/rede/tipos-stories.ts, PedidoDeStory). Confere tudo de novo: público, fundo, tamanhos, dado
 * pessoal (CPF, telefone, e-mail, endereço: LGPD art. 6º, III), até 3 figurinhas (uma enquete e uma contagem no máximo; link só
 * https; a contagem só com ato que eu organizo ou confirmei, e o título e a hora vêm do ato, não do pedido), a imagem só da
 * minha pasta, já enviada, em WEBP/PNG/JPEG e até 3 MB, e o post do "Pôr no story" só se eu o vejo. 20 stories por dia.
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
  v_url text; v_rotulo text; v_perg text; v_op0 text; v_op1 text; v_enquetes integer := 0; v_contagens integer := 0;
  v_tam bigint; v_mime text; s rede_stories; i integer := 0;
begin
  if p is null or jsonb_typeof(p) is distinct from 'object' then perform interno.erro('invalido:pedido'); end if;
  if v_publico not in ('seguidores', 'membros', 'proximos') then perform interno.erro('invalido:publico'); end if;
  if v_fundo not in ('listras', 'mosaico', 'imagem') then perform interno.erro('invalido:fundo'); end if;
  if v_cor not in ('azul', 'vermelho', 'dourado', 'verde', 'rosa', 'noite') then perform interno.erro('invalido:cor'); end if;
  if not exists (select 1 from perfis where id = v and rede_handle is not null) then perform interno.erro('sem_handle'); end if;
  v_texto := interno.txt(p ->> 'texto', 'texto', 0, 140);
  v_legenda := nullif(interno.txt(p ->> 'legenda', 'legenda', 0, 80), '');
  v_alt := nullif(interno.txt(p ->> 'alt', 'alt', 0, 200), '');
  if jsonb_typeof(v_figs) is distinct from 'array' or jsonb_array_length(v_figs) > 3 then perform interno.erro('invalido:figurinhas'); end if;

  -- A imagem: o fundo "imagem" exige o caminho, e o caminho só vale com fundo "imagem".
  if (v_fundo = 'imagem') <> (v_imagem is not null) then perform interno.erro('invalido:imagem'); end if;
  if v_imagem is not null then
    if v_imagem !~ ('^' || v::text || '/[0-9a-f-]{32,36}\.(webp|png|jpg)$') then perform interno.erro('invalido:imagem'); end if;
    if exists (select 1 from rede_stories where midia_caminho = v_imagem) then perform interno.erro('invalido:imagem'); end if;
    if to_regclass('storage.objects') is not null then
      execute 'select (metadata ->> ''size'')::bigint, metadata ->> ''mimetype'' from storage.objects where bucket_id = ''rede-stories'' and name = $1'
        into v_tam, v_mime using v_imagem;
      if v_mime is null then perform interno.erro('invalido:imagem'); end if;
      if v_mime not in ('image/webp', 'image/png', 'image/jpeg') or coalesce(v_tam, 0) > 3145728 then perform interno.erro('invalido:imagem'); end if;
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
      select left(coalesce(nullif(btrim(x.titulo), ''), btrim(x.texto)), 60), c.inicio into v_titulo, v_inicio
      from rede_chamados c join rede_posts x on x.id = c.post
      where c.post = v_ato and c.inicio > now() and not c.cancelado and interno.rede2_pode_ver(x, v)
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
      v_rotulo := interno.txt(f ->> 'rotulo', 'rotulo', 1, 40);
      v_tudo := v_tudo || E'\n' || v_rotulo;
      v_limpas := v_limpas || jsonb_build_object('tipo', 'link', 'dados', jsonb_build_object('url', v_url, 'rotulo', v_rotulo));
    else
      perform interno.erro('invalido:figurinha');
    end if;
  end loop;
  if v_enquetes > 1 or v_contagens > 1 then perform interno.erro('invalido:figurinhas'); end if;
  if v_texto = '' and v_imagem is null and jsonb_array_length(v_limpas) = 0 then perform interno.erro('invalido:vazio'); end if;
  if interno.rede3_pub_dado_pessoal(v_texto || E'\n' || coalesce(v_legenda, '') || v_tudo) then perform interno.erro('dado_pessoal'); end if;

  perform interno.limite('rede5_story_publicar', 20, 1440);
  insert into rede_stories (autor, publico, fundo, cor, texto, legenda, midia_caminho, alt, post_ref, conferido)
  values (v, v_publico, v_fundo, v_cor, v_texto, v_legenda, v_imagem, v_alt, v_post, v_imagem is null)
  returning * into s;
  for f in select * from jsonb_array_elements(v_limpas) loop
    insert into rede_story_figurinhas (story, ordem, tipo, dados) values (s.id, i, f ->> 'tipo', f -> 'dados');
    i := i + 1;
  end loop;
  return jsonb_build_object('id', s.id, 'expira_em', s.expira_em);
end $$;

/**
 * Apagar o meu story: some na hora para todo mundo, com as respostas e as reações (e os avisos que as levaram). Se há denúncia
 * aberta sobre ele, a linha e o arquivo ficam guardados como prova até a decisão (PLANO §7.2), mas já fora do ar.
 */
create or replace function public.rede_story_apagar(p_id uuid) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); s rede_stories;
begin
  perform interno.rede5_story_ligado();
  perform interno.limite('rede5_story_apagar', 60, 60);
  select * into s from rede_stories where id = p_id and autor = v;
  if not found then perform interno.erro('nao_encontrado'); end if;
  delete from avisos a where a.id in (select r.aviso from rede_story_respostas r where r.story = s.id and r.aviso is not null
                                      union select x.aviso from rede_story_reacoes x where x.story = s.id and x.aviso is not null);
  if s.retido or interno.rede5_story_em_prova(s.id) then
    update rede_stories set expira_em = least(expira_em, now()) where id = s.id;
  else
    -- A linha sai agora; o arquivo, sem dono, sai do depósito na próxima faxina (e ninguém mais o lê: rede_story_pode).
    delete from rede_stories where id = s.id;
  end if;
  return jsonb_build_object('apagado', true);
end $$;

-- ── 5. Responder, reagir, votar, "me avise" e denunciar ──────────────────────────────────────────────────────────────────

/** Resposta (texto livre ou à figurinha de pergunta): vai SÓ para a autora, num aviso dela, e some com o story. */
create or replace function public.rede_story_responder(p_id uuid, p_texto text) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.rede5_story_membro(); s rede_stories; v_texto text := interno.txt(p_texto, 'texto', 1, 500); v_aviso uuid;
begin
  s := interno.rede5_story_visivel(p_id, v);
  if s.autor = v then perform interno.erro('sem_permissao'); end if;
  perform interno.rede2_limite('responder');
  perform interno.limite('rede5_story_responder', 10, 60);
  -- A autora desligou "respostas a stories" no site: a resposta não vira aviso nem fica guardada.
  if not interno.rede3_aviso_pref(s.autor, 'story_resposta', 'site') then return jsonb_build_object('ok', true); end if;
  insert into avisos (para, texto, categoria, ator)
  values (s.autor, left('Resposta ao seu story: “' || v_texto || '”', 500), 'rede', v) returning id into v_aviso;
  insert into rede_story_respostas (story, quem, texto, aviso) values (s.id, v, v_texto, v_aviso);
  return jsonb_build_object('ok', true);
end $$;

/** Reação do conjunto fechado: a autora recebe "Alguém reagiu…", sem o nome; reagir de novo troca a reação (sem somar avisos). */
create or replace function public.rede_story_reagir(p_id uuid, p_reacao text) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.rede5_story_membro(); s rede_stories; r rede_story_reacoes; v_aviso uuid; v_texto text;
begin
  if p_reacao is null or p_reacao not in ('punho', 'chama', 'coracao') then perform interno.erro('invalido:reacao'); end if;
  s := interno.rede5_story_visivel(p_id, v);
  if s.autor = v then perform interno.erro('sem_permissao'); end if;
  perform interno.rede2_limite('reagir');
  v_texto := 'Alguém reagiu ao seu story com ' || case p_reacao when 'punho' then 'um punho erguido' when 'chama' then 'uma chama' else 'um coração' end || '.';
  select * into r from rede_story_reacoes where story = s.id and quem = v;
  if found then
    if r.reacao <> p_reacao then
      update rede_story_reacoes set reacao = p_reacao where story = s.id and quem = v;
      if r.aviso is not null then update avisos set texto = v_texto, lido = false where id = r.aviso; end if;
    end if;
    return jsonb_build_object('ok', true);
  end if;
  if interno.rede3_aviso_pref(s.autor, 'story_resposta', 'site') then
    insert into avisos (para, texto, categoria) values (s.autor, v_texto, 'rede') returning id into v_aviso;
  end if;
  insert into rede_story_reacoes (story, quem, reacao, aviso) values (s.id, v, p_reacao, v_aviso);
  return jsonb_build_object('ok', true);
end $$;

/** Voto secreto na enquete (um por pessoa; não muda depois). Devolve a figurinha como eu passo a ver (sem soma: só a autora vê). */
create or replace function public.rede_story_votar(p_id uuid, p_opcao integer) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.rede5_story_membro(); s rede_stories; f rede_story_figurinhas;
begin
  if p_opcao is null or p_opcao not in (0, 1) then perform interno.erro('invalido:opcao'); end if;
  s := interno.rede5_story_visivel(p_id, v);
  if s.autor = v then perform interno.erro('sem_permissao'); end if;
  select * into f from rede_story_figurinhas where story = s.id and tipo = 'enquete';
  if not found then perform interno.erro('nao_encontrado'); end if;
  perform interno.rede2_limite('votar');
  insert into rede_story_votos (story, quem, opcao) values (s.id, v, p_opcao) on conflict (story, quem) do nothing;
  return interno.rede5_story_figurinha(f, s, v);
end $$;

/** "Me avise quando começar": liga ou desliga o MEU lembrete do ato da figurinha de contagem. Ninguém sabe quem pediu. */
create or replace function public.rede_story_avisar(p_id uuid, p_sim boolean) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.rede5_story_membro(); s rede_stories; v_ato uuid; p rede_posts;
begin
  s := interno.rede5_story_visivel(p_id, v);
  select (f.dados ->> 'ato')::uuid into v_ato from rede_story_figurinhas f where f.story = s.id and f.tipo = 'contagem';
  if v_ato is null then perform interno.erro('nao_encontrado'); end if;
  select * into p from rede_posts where id = v_ato;
  if not found or not interno.rede2_pode_ver(p, v) then perform interno.erro('nao_encontrado'); end if;
  perform interno.rede2_limite('salvar');
  if coalesce(p_sim, false) then
    if not exists (select 1 from rede_chamados c where c.post = v_ato and c.inicio > now() and not c.cancelado) then perform interno.erro('invalido:ato'); end if;
    insert into rede_story_lembretes (ato, quem) values (v_ato, v) on conflict do nothing;
  else
    delete from rede_story_lembretes where ato = v_ato and quem = v;
  end if;
  return jsonb_build_object('avisar', exists (select 1 from rede_story_lembretes where ato = v_ato and quem = v));
end $$;

/**
 * Denunciar um story que eu vejo. Quem denuncia nunca é revelado. Mesma pessoa e story com denúncia aberta: o mesmo protocolo.
 * Menores, ameaça e exposição (PLANO §7.2) retêm na hora: some para todos menos a autora, que é avisada e pode recorrer; e a prova
 * fica guardada até a decisão, mesmo depois das 24 h. O freio tem teto por conta (5 por dia), para a denúncia não virar arma.
 */
create or replace function public.rede_story_denunciar(p_id uuid, p_categoria text, p_texto text default '') returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare
  v uuid := interno.rede5_story_membro(); s rede_stories; d rede_denuncias; v_pri smallint; v_retido boolean := false;
  v_texto text := interno.txt(coalesce(p_texto, ''), 'texto', 0, 2000);
begin
  if p_categoria is null or p_categoria not in ('menores', 'ameaca', 'exposicao', 'violencia', 'autolesao', 'odio', 'assedio', 'golpe', 'spam', 'outro') then
    perform interno.erro('invalido:categoria');
  end if;
  s := interno.rede5_story_visivel(p_id, v);
  if s.autor = v then perform interno.erro('sem_permissao'); end if;
  select * into d from rede_denuncias where quem = v and alvo_tipo = 'story' and alvo = s.id::text and situacao in ('aberta', 'em_analise') limit 1;
  if found then return jsonb_build_object('protocolo', d.protocolo, 'retido', s.retido, 'ja', true); end if;
  perform interno.rede2_limite('denunciar');
  v_pri := interno.rede2_prioridade(p_categoria);
  insert into rede_denuncias (alvo_tipo, alvo, categoria, prioridade, texto, quem) values ('story', s.id::text, p_categoria, v_pri, v_texto, v) returning * into d;
  if p_categoria in ('menores', 'ameaca', 'exposicao') and not s.retido then
    begin
      perform interno.limite('rede5_story_precaucao', 5, 1440);
      update rede_stories set retido = true where id = s.id;
      perform interno.rede3_mod_registrar('reter', 'story', s.id::text, 'precaucao', 'Story retido por precaução até a moderação ler a denúncia ' || d.protocolo || '.', d.id, true);
      perform interno.rede3_mod_avisar_afetado(s.autor, 'Um story seu ficou retido por precaução enquanto a moderação lê uma denúncia (decisão automática, ainda sem leitura de uma pessoa). Só você o vê. Você pode recorrer em até 30 dias, em Denúncias e recursos.');
      v_retido := true;
    exception when others then
      v_retido := false;
    end;
  end if;
  if v_pri = 1 then
    insert into avisos (para, texto)
    select distinct pa.usuario, left('Denúncia prioritária ' || d.protocolo || ' (story, ' || p_categoria || '). Abra a fila de moderação da Rede.', 500)
    from papeis pa where pa.papel in ('coordenacao', 'vice', 'mediacao') and pa.usuario <> v;
  end if;
  return jsonb_build_object('protocolo', d.protocolo, 'retido', v_retido, 'ja', false);
end $$;

-- ── 6. Depósito privado rede-stories ──────────────────────────────────────────────────────────────────────────────────────

/** Regra de leitura do depósito: o arquivo deste caminho é de um story que quem pede pode ver (a mesma regra da tela). */
create or replace function public.rede_story_pode(p_caminho text) returns boolean language sql stable security definer set search_path = interno, pg_temp as $$
  select exists (select 1 from rede_stories s where s.midia_caminho = p_caminho and interno.rede5_story_ve(s, auth.uid()))
$$;

/** Regra de envio: membro da Alumia, stories ligados, e no máximo 30 arquivos nas últimas 24 h na própria pasta. */
create or replace function public.rede_story_pode_enviar() returns boolean language plpgsql stable security definer set search_path = interno, pg_temp as $$
declare v uuid := auth.uid(); v_n integer := 0;
begin
  if v is null or not interno.rede2_membro(v) then return false; end if;
  if exists (select 1 from recursos_vivos where nome in ('rede-v2', 'alumia-2', 'alumia-stories') and not ligado) then return false; end if;
  if to_regclass('storage.objects') is not null then
    execute 'select count(*)::integer from storage.objects where bucket_id = ''rede-stories'' and name like $1 and created_at > now() - interval ''24 hours'''
      into v_n using v::text || '/%';
  end if;
  return v_n < 30;
end $$;

do $$
begin
  if exists (select 1 from pg_namespace where nspname = 'storage') and to_regclass('storage.buckets') is not null then
    insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    values ('rede-stories', 'rede-stories', false, 3145728, array['image/webp', 'image/png', 'image/jpeg'])
    on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;
    execute 'drop policy if exists "rede_stories_envio" on storage.objects';
    execute 'create policy "rede_stories_envio" on storage.objects for insert to authenticated with check (bucket_id = ''rede-stories'' and (storage.foldername(name))[1] = auth.uid()::text and public.rede_story_pode_enviar())';
    execute 'drop policy if exists "rede_stories_leitura" on storage.objects';
    execute 'create policy "rede_stories_leitura" on storage.objects for select to authenticated using (bucket_id = ''rede-stories'' and ((storage.foldername(name))[1] = auth.uid()::text or public.rede_story_pode(name)))';
    execute 'drop policy if exists "rede_stories_remocao" on storage.objects';
    execute 'create policy "rede_stories_remocao" on storage.objects for delete to authenticated using (bucket_id = ''rede-stories'' and (storage.foldername(name))[1] = auth.uid()::text)';
  end if;
end $$;

-- ── 7. Faxina (de 15 em 15 minutos) ───────────────────────────────────────────────────────────────────────────────────────
-- O que o banco faz sozinho: tira da tabela os stories vencidos SEM arquivo (que não estejam em prova) e manda os lembretes de
-- ato. O que tem arquivo precisa da Edge Function faxina-stories, que apaga o arquivo pela API do Storage e só DEPOIS a linha
-- (apagar só a linha de storage.objects por SQL deixaria o arquivo no depósito, como a doc do Supabase avisa); ela também
-- confere as imagens novas (tira EXIF/XMP que tenha sobrado) e leva os arquivos sem story (envio abandonado há mais de 1 hora).
-- O endereço da função fica nas configurações, como o dos e-mails (interno.emails_disparar), definido uma vez pelo Jonathan:
--   insert into interno.configuracoes (chave, valor) values ('stories', '{"funcao": "https://SEU-PROJETO.supabase.co/functions/v1/faxina-stories", "chave_publica": "eyJ...", "segredo": "..."}')
--   on conflict (chave) do update set valor = excluded.valor;
-- Sem o endereço, ou sem pg_net, as funções de leitura continuam filtrando expira_em > now(): nada vencido aparece, só fica guardado.

/** Os lembretes de "me avise": ato começando em até 1 hora vira aviso (e o lembrete sai); ato cancelado ou já começado, só sai. */
create or replace function interno.rede5_story_lembretes() returns integer language plpgsql security definer set search_path = interno, pg_temp as $$
declare r record; v_n integer := 0;
begin
  for r in select l.ato, l.quem from rede_story_lembretes l join rede_chamados c on c.post = l.ato
           where c.inicio > now() and c.inicio <= now() + interval '1 hour' and not c.cancelado limit 2000 loop
    perform interno.rede3_aviso_criar(r.quem, 'chamado', r.ato, null, null, 'Um ato que você pediu para lembrar começa em menos de 1 hora.');
    delete from rede_story_lembretes where ato = r.ato and quem = r.quem;
    v_n := v_n + 1;
  end loop;
  delete from rede_story_lembretes l using rede_chamados c where c.post = l.ato and (c.inicio <= now() or c.cancelado);
  delete from rede_story_lembretes l where not exists (select 1 from rede_chamados c where c.post = l.ato);
  return v_n;
end $$;

/** A rodada do banco (pg_cron): lembretes, vencidos sem arquivo e, se há trabalho com arquivo, chama a Edge Function. */
create or replace function interno.rede5_story_faxina() returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare
  v_lembretes integer; v_texto integer;
  v_url text := (select valor ->> 'funcao' from configuracoes where chave = 'stories');
  v_chave text := coalesce((select valor ->> 'chave_publica' from configuracoes where chave = 'stories'), '');
  v_segredo text := coalesce((select valor ->> 'segredo' from configuracoes where chave = 'stories'), '');
  v_chamou boolean := false;
begin
  v_lembretes := interno.rede5_story_lembretes();
  with fora as (delete from rede_stories s where s.expira_em <= now() and s.midia_caminho is null and not interno.rede5_story_em_prova(s.id) returning 1)
  select count(*)::integer into v_texto from fora;
  if coalesce(v_url, '') ~ '^https://[a-z0-9.-]+/functions/v1/faxina-stories$' and exists (select 1 from pg_extension where extname = 'pg_net')
     and (exists (select 1 from rede_stories s where s.midia_caminho is not null and (not s.conferido or s.expira_em <= now())) or to_regclass('storage.objects') is not null) then
    execute 'select net.http_post(url := $1, body := ''{}''::jsonb, headers := $2, timeout_milliseconds := 60000)'
      using v_url, jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || v_chave, 'apikey', v_chave, 'x-lucia-segredo', v_segredo);
    v_chamou := true;
  end if;
  return jsonb_build_object('lembretes', v_lembretes, 'apagados', v_texto, 'chamou', v_chamou);
end $$;

/**
 * Só a Edge Function (chave de serviço): o que ela tem a fazer. `apagar`: vencidos com arquivo, fora de prova. `conferir`: imagens
 * ainda não conferidas no servidor. `orfaos`: arquivos do depósito sem story há mais de 1 hora (envio abandonado ou story apagado).
 */
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
      select s.id, s.midia_caminho from rede_stories s where s.expira_em <= now() and s.midia_caminho is not null and not interno.rede5_story_em_prova(s.id)
      order by s.expira_em limit v_lim) x), '[]'::jsonb),
    'conferir', coalesce((select jsonb_agg(jsonb_build_object('id', x.id, 'caminho', x.midia_caminho)) from (
      select s.id, s.midia_caminho from rede_stories s where s.midia_caminho is not null and not s.conferido and s.expira_em > now()
      order by s.criado_em limit least(v_lim, 50)) x), '[]'::jsonb),
    'orfaos', v_orfaos);
end $$;

/**
 * Só a Edge Function: o que ela fez. `p_apagados`: os arquivos já saíram do depósito; a linha sai agora (se ainda vencida e fora
 * de prova). `p_conferidos`: imagem conferida (e limpa, se precisou). `p_ruins`: o arquivo não era imagem que se lê: o story sai do ar.
 */
create or replace function public.rede_story_faxina_feito(p_apagados uuid[], p_conferidos uuid[], p_ruins uuid[]) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v_a integer; v_c integer; v_r integer;
begin
  with fora as (delete from rede_stories s where s.id = any (coalesce(p_apagados, '{}')) and s.expira_em <= now() and not interno.rede5_story_em_prova(s.id) returning 1)
  select count(*)::integer into v_a from fora;
  update rede_stories set conferido = true where id = any (coalesce(p_conferidos, '{}')) and not conferido;
  get diagnostics v_c = row_count;
  update rede_stories set expira_em = least(expira_em, now()), conferido = true where id = any (coalesce(p_ruins, '{}'));
  get diagnostics v_r = row_count;
  return jsonb_build_object('apagados', v_a, 'conferidos', v_c, 'ruins', v_r);
end $$;

do $$
begin
  create extension if not exists pg_cron;
exception when others then null;
end $$;
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule('alumia-faxina-stories', '*/15 * * * *', 'select interno.rede5_story_faxina()');
  end if;
exception when others then null;
end $$;

-- ── 8. Permissões ─────────────────────────────────────────────────────────────────────────────────────────────────────────
revoke all on function interno.rede5_story_tirar_aviso(), interno.rede5_story_ligado(), interno.rede5_story_ve(interno.rede_stories, uuid),
  interno.rede5_story_autora(uuid), interno.rede5_story_figurinha(interno.rede_story_figurinhas, interno.rede_stories, uuid),
  interno.rede5_story_json(interno.rede_stories, uuid), interno.rede5_story_em_prova(uuid), interno.rede5_story_visivel(uuid, uuid),
  interno.rede5_story_membro(), interno.rede5_story_lembretes(), interno.rede5_story_faxina() from public;
revoke all on function public.rede_story_faixa(), public.rede_story_abrir(text), public.rede_story_meus(), public.rede_story_atos(),
  public.rede_story_publicar(jsonb), public.rede_story_apagar(uuid), public.rede_story_responder(uuid, text), public.rede_story_reagir(uuid, text),
  public.rede_story_votar(uuid, integer), public.rede_story_avisar(uuid, boolean), public.rede_story_denunciar(uuid, text, text),
  public.rede_story_pode(text), public.rede_story_pode_enviar(), public.rede_story_faxina_lista(integer), public.rede_story_faxina_feito(uuid[], uuid[], uuid[]) from public;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on function interno.rede5_story_tirar_aviso(), interno.rede5_story_ligado(), interno.rede5_story_ve(interno.rede_stories, uuid),
      interno.rede5_story_autora(uuid), interno.rede5_story_figurinha(interno.rede_story_figurinhas, interno.rede_stories, uuid),
      interno.rede5_story_json(interno.rede_stories, uuid), interno.rede5_story_em_prova(uuid), interno.rede5_story_visivel(uuid, uuid),
      interno.rede5_story_membro(), interno.rede5_story_lembretes(), interno.rede5_story_faxina() from anon, authenticated;
    revoke all on function public.rede_story_faixa(), public.rede_story_abrir(text), public.rede_story_meus(), public.rede_story_atos(),
      public.rede_story_publicar(jsonb), public.rede_story_apagar(uuid), public.rede_story_responder(uuid, text), public.rede_story_reagir(uuid, text),
      public.rede_story_votar(uuid, integer), public.rede_story_avisar(uuid, boolean), public.rede_story_denunciar(uuid, text, text),
      public.rede_story_pode(text), public.rede_story_pode_enviar(), public.rede_story_faxina_lista(integer), public.rede_story_faxina_feito(uuid[], uuid[], uuid[]) from anon, authenticated;
    -- Leitura que visitante pode chamar (volta vazia para ele): a faixa e abrir.
    grant execute on function public.rede_story_faixa(), public.rede_story_abrir(text) to anon, authenticated, service_role;
    -- Com conta.
    grant execute on function public.rede_story_meus(), public.rede_story_atos(), public.rede_story_publicar(jsonb), public.rede_story_apagar(uuid),
      public.rede_story_responder(uuid, text), public.rede_story_reagir(uuid, text), public.rede_story_votar(uuid, integer),
      public.rede_story_avisar(uuid, boolean), public.rede_story_denunciar(uuid, text, text),
      public.rede_story_pode(text), public.rede_story_pode_enviar() to authenticated, service_role;
    -- Só a Edge Function da faxina.
    grant execute on function public.rede_story_faxina_lista(integer), public.rede_story_faxina_feito(uuid[], uuid[], uuid[]) to service_role;
  end if;
end $$;

-- ═══════════════════════════ fim da F5 ═══════════════════════════
