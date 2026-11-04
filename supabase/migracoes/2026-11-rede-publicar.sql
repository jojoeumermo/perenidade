-- ───────────────────────────── Rede Lúcia v2: pacote publicar (Etapa 7, R4 itens 15 a 23) ─────────────────────────────
-- Migração acrescentável: pode rodar mais de uma vez, sem apagar dado nenhum. Roda DEPOIS de 2026-11-rede-fundacao.sql (e do
-- pacote consertos, se houver) e ANTES de perfil/conversa/descoberta/comunidades/avisos/moderacao, na ordem de docs/rede/V2.md.
-- Teste: npm run testar:rede-publicar. Contrato: docs/rede/V2.md, seção 7.
--
-- O que este arquivo faz, e só isto:
--   1. Tabelas novas do pacote (nenhuma no esquema public): rede_pub_extras (quem pode responder, prévia de link, fio),
--      rede_audios (áudio de até 1 min) e rede_agendados (publicação marcada). Imagens, enquetes e edições usam as tabelas da
--      Fase 2 (rede_midia, rede_enquetes/opcoes/votos, rede_post_edicoes).
--   2. public.rede_publicar redefinida como SUPERCONJUNTO da fundação: mesma assinatura, TODAS as conferências (conta ativa,
--      18+, consentimento, codinome, limite, dado pessoal, comunidade, árvore até 6 níveis, trava, triagem), mais enquete,
--      até 4 imagens, áudio, prévia de link, fio, "quem pode responder" e a recusa de endereço com número.
--   3. rede_pub_midia_reservar / rede_pub_midia_caminho: o caminho de cada arquivo no Storage (bucket privado "rede-midia"),
--      conferido pela matriz de visibilidade (interno.rede_ve) antes de alguém receber o endereço assinado.
--   4. rede_pub_enquete_votar (voto secreto: ninguém recebe quem votou em quê, só totais), rede_pub_editar (15 minutos sem
--      marca; depois, "editado" e o texto anterior guardado em rede_post_edicoes) e rede_pub_historico.
--   5. Agendamento: rede_pub_agendar (ensaia a publicação inteira e desfaz), rede_pub_agendados (publica o que venceu "ao ler"),
--      rede_pub_agendar_cancelar e rede_pub_agendados_rodar (para o agendador do banco ou a função agendada, só service_role).
--   6. rede_pub_detalhes(ids): o que o post tem a mais (áudio, enquete, prévia, quem responde, edição), por lote e sempre
--      pela matriz.
--
-- Dado de pessoa: nenhum novo além do que a pessoa escolhe publicar. Imagens chegam sem EXIF/GPS (o navegador reencoda e o
-- servidor tira de novo: app/api/rede/midia). Voto de enquete nunca sai por função nenhuma como "quem votou em quê".
-- Leis: LGPD (13.709/2018) arts. 5º II e 11 (opinião política é dado sensível: a enquete é de voto secreto e só mostra totais),
-- art. 6º III (minimização: sem EXIF/GPS, sem endereço com número); Marco Civil (12.965/2014) art. 21 (conteúdo íntimo
-- retirado a pedido: o rosto borrado e a denúncia ficam a um passo); Código Penal arts. 138 a 140 (a regra simples e a
-- avaliação externa seguram ódio e ofensa antes de aparecer).

-- ── 1. Tabelas ──────────────────────────────────────────────────────────────────────────────────────────────────────────

create table if not exists interno.rede_pub_extras (
  post uuid primary key references interno.rede_posts (id) on delete cascade,
  responde_quem text not null default 'todos' check (responde_quem in ('todos', 'seguindo', 'mencionados', 'ninguem')),
  previa jsonb check (previa is null or jsonb_typeof(previa) = 'object'),
  fio boolean not null default false,
  criado_em timestamptz not null default now()
);

create table if not exists interno.rede_audios (
  id uuid primary key default gen_random_uuid(),
  post uuid not null unique references interno.rede_posts (id) on delete cascade,
  caminho text not null unique check (caminho ~ '^[a-f0-9-]{36}/[a-f0-9-]{36}\.(webm|ogg|m4a)$'),
  tipo text not null check (tipo in ('audio/webm', 'audio/ogg', 'audio/mp4')),
  duracao smallint not null check (duracao between 1 and 60),
  criado_em timestamptz not null default now()
);

-- A publicação marcada: guarda o pedido inteiro (jsonb) e publica de verdade na hora, passando por TODAS as conferências.
create table if not exists interno.rede_agendados (
  id uuid primary key default gen_random_uuid(),
  autor uuid not null references interno.perfis (id) on delete cascade,
  pedido jsonb not null check (jsonb_typeof(pedido) = 'object'),
  quando timestamptz not null,
  estado text not null default 'pendente' check (estado in ('pendente', 'publicado', 'falhou', 'cancelado')),
  erro text not null default '' check (char_length(erro) <= 120),
  post uuid references interno.rede_posts (id) on delete set null,
  criado_em timestamptz not null default now()
);
create index if not exists rede_agendados_vencem on interno.rede_agendados (quando) where estado = 'pendente';
create index if not exists rede_agendados_autor on interno.rede_agendados (autor, quando desc);

alter table interno.rede_pub_extras enable row level security;
alter table interno.rede_audios enable row level security;
alter table interno.rede_agendados enable row level security;
revoke all on interno.rede_pub_extras, interno.rede_audios, interno.rede_agendados from public;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on interno.rede_pub_extras, interno.rede_audios, interno.rede_agendados from anon, authenticated;
  end if;
end $$;

-- ── 2. Conferências de texto ────────────────────────────────────────────────────────────────────────────────────────────

/**
 * O texto traz um endereço com número (rua, avenida… vírgula, número)? Recusado em qualquer post: expor onde alguém mora ou
 * está é o caminho do assédio e da violência (LGPD art. 6º, III: minimização). O ponto de um chamado público é do pacote
 * comunidades, que tem campo próprio.
 */
create or replace function interno.rede3_pub_tem_endereco(p_texto text) returns boolean language sql immutable as $$
  select coalesce(p_texto, '') ~* '\m(rua|avenida|av|travessa|alameda|rodovia|estrada|praça|praca|largo|beco|viela)\M[^\n,.]{2,60}(,\s*|\s+n[ºo°]\.?\s*)\d{1,5}\M'
$$;

/** Dado pessoal que não vai para a Rede: CPF, telefone e e-mail (a mesma conferência da fundação), mais o endereço com número. */
create or replace function interno.rede3_pub_dado_pessoal(p_texto text) returns boolean language sql immutable as $$
  select coalesce(p_texto, '') ~ '\d{3}\.?\d{3}\.?\d{3}-?\d{2}' or coalesce(p_texto, '') ~ '\(?\d{2}\)?\s?9\d{4}[-\s]?\d{4}'
      or coalesce(p_texto, '') ~* '[a-z0-9._%+-]+@[a-z0-9-]+\.[a-z.]{2,}' or interno.rede3_pub_tem_endereco(p_texto)
$$;

/** A prévia de link que o cliente trouxe da rota do servidor, limpa: só http(s) sem senha na frente e imagem só pelo nosso proxy. */
create or replace function interno.rede3_pub_previa(p jsonb) returns jsonb language plpgsql immutable as $$
declare v_url text := btrim(coalesce(p ->> 'url', '')); v_img text := nullif(btrim(coalesce(p ->> 'imagem', '')), '');
begin
  if p is null or jsonb_typeof(p) is distinct from 'object' then return null; end if;
  if v_url !~* '^https?://[^/@\s]+(/[^\s]*)?$' or char_length(v_url) > 500 then perform interno.erro('invalido:previa'); end if;
  if v_img is not null and (v_img !~ '^/api/rede/previa/imagem\?u=[A-Za-z0-9%._~:/?#=&+-]+$' or char_length(v_img) > 700) then v_img := null; end if;
  return jsonb_build_object(
    'url', v_url,
    'dominio', lower(substring(v_url from '^https?://([^/:?#]+)')),
    'titulo', left(btrim(coalesce(p ->> 'titulo', '')), 200),
    'descricao', left(btrim(coalesce(p ->> 'descricao', '')), 300),
    'imagem', v_img);
end $$;

-- ── 3. Mídia: reservar o caminho e dar o endereço ───────────────────────────────────────────────────────────────────────

/**
 * Antes de subir um arquivo, a rota do servidor (app/api/rede/midia) pede aqui um caminho "<pessoa>/<id>.<ext>". É aqui que
 * entram o limite de envios e a conferência de que a pessoa é membro da Rede. p_tipo: 'jpg', 'png', 'webp', 'webm', 'ogg', 'm4a'.
 */
create or replace function public.rede_pub_midia_reservar(p_ext text) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); v_id uuid := gen_random_uuid();
begin
  perform interno.aberta('comunidade');
  if p_ext not in ('jpg', 'png', 'webp', 'webm', 'ogg', 'm4a') then perform interno.erro('invalido:arquivo'); end if;
  if not coalesce((select rede_18 from perfis where id = v), false) then perform interno.erro('confirme_idade'); end if;
  if not interno.rede2_membro(v) then perform interno.erro('consentimento'); end if;
  perform interno.limite('rede_pub_midia', 40, 60);
  return jsonb_build_object('id', v_id, 'caminho', v::text || '/' || v_id::text || '.' || p_ext);
end $$;

/** A pessoa pode enviar arquivos para a Rede? (Regra do depósito: membro da Rede, 18+ com consentimento em vigor.) */
create or replace function public.rede_pub_pode_enviar() returns boolean language sql stable security definer set search_path = interno, pg_temp as $$
  select auth.uid() is not null and coalesce((select rede_18 from perfis where id = auth.uid()), false) and interno.rede2_membro(auth.uid())
$$;

/** O arquivo deste caminho é de um post que esta pessoa pode ver? (Regra de leitura do depósito; a matriz decide, nunca o caminho.) */
create or replace function public.rede_pub_midia_pode(p_caminho text) returns boolean language sql stable security definer set search_path = interno, pg_temp as $$
  select exists (select 1 from rede_midia m join rede_posts p on p.id = m.post where m.caminho = p_caminho and interno.rede_ve(p, auth.uid()))
      or exists (select 1 from rede_audios a join rede_posts p on p.id = a.post where a.caminho = p_caminho and interno.rede_ve(p, auth.uid()))
$$;

/** Onde está o arquivo (imagem pelo id da mídia, áudio pelo id do áudio), se o post é visível para quem pergunta. */
create or replace function public.rede_pub_midia_caminho(p_id uuid) returns jsonb language plpgsql stable security definer set search_path = interno, pg_temp as $$
declare p rede_posts; v_post uuid; v_caminho text; v_tipo text;
begin
  select m.post, m.caminho, m.tipo into v_post, v_caminho, v_tipo from rede_midia m where m.id = p_id;
  if not found then
    select a.post, a.caminho, a.tipo into v_post, v_caminho, v_tipo from rede_audios a where a.id = p_id;
  end if;
  if not found then perform interno.erro('nao_encontrado'); end if;
  select * into p from rede_posts where id = v_post;
  if not found or not interno.rede_ve(p, auth.uid()) or p.apagado_em is not null then perform interno.erro('nao_encontrado'); end if;
  return jsonb_build_object('bucket', 'rede-midia', 'caminho', v_caminho, 'tipo', v_tipo);
end $$;

-- ── 4. Publicar (superconjunto da fundação) ─────────────────────────────────────────────────────────────────────────────

/**
 * Publicar. Tudo o que a fundação confere continua valendo (docs/rede/V2.md, seção 5) e nada aqui afrouxa. Campos novos de p:
 *   tipo 'enquete': texto = a pergunta (até 500), enquete = {opcoes: [2 a 4 textos de até 80], horas: 1 a 168 (24), multipla: false}.
 *   midia: até 4 {caminho, alt (até 1000), largura, altura}: imagens já enviadas pela rota do servidor, na pasta da própria pessoa.
 *   audio: {caminho, duracao (1 a 60 s)}.   previa: {url, titulo, descricao, imagem} (da rota de prévia do servidor).
 *   fio: true quando é o seguinte de uma sequência do mesmo autor (resposta ao próprio post anterior).
 *   responde_quem: 'todos' (padrão), 'seguindo' (quem o autor segue), 'mencionados' (quem tem @ no post) ou 'ninguem'.
 * Um post que a regra simples achar de ódio nasce retido para a leitura da mediação (a avaliação externa vem depois).
 */
create or replace function public.rede_publicar(p jsonb) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare
  v uuid := interno.eu();
  x rede_posts; o rede_posts; v_raiz rede_posts; c rede_comunidades;
  v_tipo text := coalesce(nullif(btrim(p ->> 'tipo'), ''), 'post');
  v_titulo text; v_texto text; v_corpo text;
  v_com text := nullif(btrim(coalesce(p ->> 'comunidade', '')), '');
  v_publico text := nullif(btrim(coalesce(p ->> 'publico', '')), '');
  v_flair text := nullif(btrim(coalesce(p ->> 'flair', '')), '');
  v_aviso text := left(btrim(coalesce(p ->> 'aviso', '')), 80);
  v_resposta uuid; v_nucleo uuid; v_tri jsonb; v_ver text; v_tudo text; v_motivo text;
  v_quem text := coalesce(nullif(btrim(p ->> 'responde_quem'), ''), 'todos');
  v_fio boolean := coalesce((p ->> 'fio')::boolean, false);
  v_previa jsonb := null; v_opcoes jsonb := '[]'::jsonb; v_horas integer := 24; v_multipla boolean := false;
  v_midia jsonb := case when jsonb_typeof(p -> 'midia') = 'array' then p -> 'midia' else '[]'::jsonb end;
  v_audio jsonb := case when jsonb_typeof(p -> 'audio') = 'object' then p -> 'audio' end;
  m jsonb; v_i integer := 0; v_ok boolean; v_cam text; v_ext text; v_handle text; v_dur integer; v_opcao text;
begin
  perform interno.aberta('comunidade');
  if p is null or jsonb_typeof(p) is distinct from 'object' then perform interno.erro('invalido:post'); end if;
  if not coalesce((select rede_18 from perfis where id = v), false) then perform interno.erro('confirme_idade'); end if;
  if not interno.rede2_membro(v) then perform interno.erro('consentimento'); end if;
  if not coalesce((select rede_codinome_ok and rede_codinome is not null from perfis where id = v), false) then perform interno.erro('confirme_codinome'); end if;
  begin
    v_resposta := nullif(p ->> 'resposta_a', '')::uuid;
    v_nucleo := nullif(p ->> 'nucleo', '')::uuid;
  exception when others then perform interno.erro('invalido:post');
  end;
  if v_tipo not in ('post', 'discussao', 'duvida', 'aviso', 'enquete') then perform interno.erro('invalido:tipo'); end if;
  if v_tipo = 'aviso' and not interno.voluntario() then perform interno.erro('sem_permissao'); end if;
  if v_resposta is not null and v_tipo <> 'post' then perform interno.erro('invalido:tipo'); end if;
  if v_quem not in ('todos', 'seguindo', 'mencionados', 'ninguem') then perform interno.erro('invalido:responde_quem'); end if;
  if v_fio and v_resposta is null then perform interno.erro('invalido:fio'); end if;
  perform interno.rede2_limite(case when v_resposta is not null then 'responder' else 'postar' end);

  if v_tipo in ('discussao', 'duvida') then
    v_titulo := interno.txt(p ->> 'titulo', 'titulo', 5, 140);
    v_corpo := interno.txt(p ->> 'corpo', 'corpo', 10, 10000);
    v_texto := left(v_corpo, 500);
  else
    v_texto := interno.txt(p ->> 'texto', 'texto', 1, 500);
    v_titulo := case when v_tipo = 'aviso' then nullif(left(btrim(coalesce(p ->> 'titulo', '')), 140), '') end;
  end if;

  -- Enquete: 2 a 4 opções de até 80, prazo de 1 hora a 7 dias.
  if v_tipo = 'enquete' then
    if jsonb_typeof(p -> 'enquete') is distinct from 'object' or jsonb_typeof(p -> 'enquete' -> 'opcoes') is distinct from 'array' then perform interno.erro('invalido:enquete'); end if;
    if jsonb_array_length(p -> 'enquete' -> 'opcoes') not between 2 and 4 then perform interno.erro('invalido:opcoes'); end if;
    for v_opcao in select btrim(e) from jsonb_array_elements_text(p -> 'enquete' -> 'opcoes') e loop
      if char_length(v_opcao) not between 1 and 80 then perform interno.erro('invalido:opcoes'); end if;
      v_opcoes := v_opcoes || to_jsonb(v_opcao);
    end loop;
    if (select count(distinct lower(e)) from jsonb_array_elements_text(v_opcoes) e) <> jsonb_array_length(v_opcoes) then perform interno.erro('invalido:opcoes'); end if;
    begin
      v_horas := coalesce(nullif(p -> 'enquete' ->> 'horas', '')::integer, 24);
      v_multipla := coalesce((p -> 'enquete' ->> 'multipla')::boolean, false);
    exception when others then perform interno.erro('invalido:enquete');
    end;
    if v_horas not between 1 and 168 then perform interno.erro('invalido:prazo'); end if;
  elsif p ? 'enquete' and jsonb_typeof(p -> 'enquete') <> 'null' then
    perform interno.erro('invalido:enquete');
  end if;

  if jsonb_array_length(v_midia) > 4 then perform interno.erro('invalido:midia'); end if;
  if jsonb_array_length(v_midia) > 0 and v_audio is not null then perform interno.erro('invalido:midia'); end if;
  if p ? 'previa' and jsonb_typeof(p -> 'previa') = 'object' then v_previa := interno.rede3_pub_previa(p -> 'previa'); end if;

  -- Dado pessoal não vai para a Rede: CPF, telefone, e-mail e endereço com número (LGPD, minimização).
  v_tudo := coalesce(v_titulo, '') || ' ' || v_texto || ' ' || coalesce(v_corpo, '') || ' ' || coalesce(v_opcoes::text, '')
            || ' ' || coalesce((select string_agg(coalesce(e ->> 'alt', ''), ' ') from jsonb_array_elements(v_midia) e), '')
            || ' ' || coalesce(v_previa ->> 'titulo', '') || ' ' || coalesce(v_previa ->> 'descricao', '');
  if interno.rede3_pub_dado_pessoal(v_tudo) then perform interno.erro('dado_pessoal'); end if;

  if v_resposta is not null then
    select * into o from rede_posts where id = v_resposta;
    if not found or not interno.rede_ve(o, v) or o.oculto or o.retido or o.apagado_em is not null then perform interno.erro('nao_encontrado'); end if;
    select * into v_raiz from rede_posts where id = coalesce(o.root_id, o.id);
    if o.travado or v_raiz.travado then perform interno.erro('travado'); end if;
    if o.profundidade >= 6 then perform interno.erro('limite_de_niveis'); end if;
    v_com := o.comunidade; v_nucleo := o.nucleo; v_publico := interno.rede2_publico(o); v_flair := null;
    -- Quem pode responder (decidido por quem abriu a conversa); o próprio autor da conversa sempre pode.
    if v_raiz.autor is distinct from v then
      select coalesce(e.responde_quem, 'todos') into v_quem from (select 1) u left join rede_pub_extras e on e.post = v_raiz.id;
      if v_quem = 'ninguem' then perform interno.erro('sem_permissao'); end if;
      if v_quem = 'seguindo' and not exists (select 1 from rede_seguindo s where s.quem = v_raiz.autor and s.segue = v and not s.pendente) then perform interno.erro('sem_permissao'); end if;
      if v_quem = 'mencionados' then
        select rede_handle into v_handle from perfis where id = v;
        if v_handle is null or lower(coalesce(v_raiz.titulo, '') || ' ' || v_raiz.texto || ' ' || coalesce(v_raiz.corpo, '')) !~ ('(^|[^a-z0-9_])@' || v_handle || '([^a-z0-9_]|$)') then perform interno.erro('sem_permissao'); end if;
      end if;
    end if;
    v_quem := 'todos';
    -- Fio: só a sequência do próprio autor (resposta ao próprio post).
    if v_fio and o.autor is distinct from v then perform interno.erro('invalido:fio'); end if;
  end if;

  if v_com is not null then
    select * into c from rede_comunidades where slug = v_com;
    if not found and v_resposta is null then perform interno.erro('invalido:comunidade'); end if;
    if found then
      if exists (select 1 from rede_comunidade_membros m where m.comunidade = c.slug and m.usuario = v and (m.situacao = 'banido' or m.banido_ate > now())) then perform interno.erro('sem_permissao'); end if;
      if c.tipo <> 'aberta' and not interno.rede2_na_comunidade(c.slug, v) then perform interno.erro('sem_permissao'); end if;
    end if;
  end if;

  if v_resposta is null then
    if v_publico is null then
      v_publico := case when c.slug is null then 'membros' else case c.publico_padrao when 'comunidade' then 'comunidade' when 'internet' then 'internet' else 'membros' end end;
    end if;
    if v_publico not in ('internet', 'membros', 'seguidores', 'comunidade', 'nucleo', 'equipe') then perform interno.erro('invalido:publico'); end if;
    if v_publico = 'internet' and (c.slug is null or c.categoria <> 'disciplinas') then perform interno.erro('invalido:publico'); end if;
    if v_publico = 'comunidade' and c.slug is null then perform interno.erro('invalido:publico'); end if;
    if v_publico = 'nucleo' then
      if v_nucleo is null or not interno.rede2_no_nucleo(v_nucleo, v) then perform interno.erro('sem_permissao'); end if;
    else
      v_nucleo := null;
    end if;
    if v_publico = 'equipe' and not interno.voluntario() then perform interno.erro('sem_permissao'); end if;
    if v_flair is not null and not exists (select 1 from rede_comunidade_flairs f where f.comunidade = v_com and f.nome = v_flair) then perform interno.erro('invalido:flair'); end if;
  end if;

  -- Imagens: só da própria pasta, ainda sem dono, e que existem no depósito (onde há depósito).
  for m in select e from jsonb_array_elements(v_midia) e loop
    v_cam := btrim(coalesce(m ->> 'caminho', ''));
    if v_cam !~ ('^' || v ::text || '/[a-f0-9-]{36}\.(jpg|png|webp)$') then perform interno.erro('invalido:midia'); end if;
    if exists (select 1 from rede_midia where caminho = v_cam) then perform interno.erro('invalido:midia'); end if;
    if to_regclass('storage.objects') is not null then
      execute 'select exists (select 1 from storage.objects where bucket_id = ''rede-midia'' and name = $1)' into v_ok using v_cam;
      if not v_ok then perform interno.erro('invalido:midia'); end if;
    end if;
  end loop;
  if v_audio is not null then
    v_cam := btrim(coalesce(v_audio ->> 'caminho', ''));
    if v_cam !~ ('^' || v ::text || '/[a-f0-9-]{36}\.(webm|ogg|m4a)$') or exists (select 1 from rede_audios where caminho = v_cam) then perform interno.erro('invalido:audio'); end if;
    begin v_dur := (v_audio ->> 'duracao')::numeric::integer; exception when others then v_dur := null; end;
    if v_dur is null or v_dur not between 1 and 60 then perform interno.erro('invalido:audio'); end if;
  end if;

  v_tri := interno.rede_triagem(v_tudo, v);
  v_ver := v_tri ->> 'veredito'; v_motivo := coalesce(v_tri ->> 'motivo', '');
  -- Regra simples de ódio (xingamentos de ódio explícitos): vai para a leitura da mediação em vez de aparecer; a decisão é de gente.
  if v_ver = 'publicar' and interno.normal(v_tudo) ~ '(^|[^a-z])(macaco|crioulo|viado|bicha|sapatao|retardado|mongoloide|vagabunda|nordestino imundo|judeu imundo|negro imundo)([^a-z]|$)' then
    v_ver := 'revisar'; v_motivo := 'regra_simples_odio';
  end if;

  insert into rede_posts (autor, tipo, titulo, texto, corpo, comunidade, resposta_a, publico, alcance, nucleo, flair, aviso, oculto, retido, avaliacao, motivo)
  values (v, v_tipo, v_titulo, v_texto, v_corpo, v_com, v_resposta, v_publico, interno.rede_alcance(v_publico), v_nucleo, v_flair, v_aviso,
          v_ver <> 'publicar', v_ver = 'revisar', case v_ver when 'publicar' then 'publicada' when 'bloquear' then 'bloqueada' else 'revisao' end, v_motivo)
  returning * into x;

  if v_quem <> 'todos' or v_previa is not null or v_fio then
    insert into rede_pub_extras (post, responde_quem, previa, fio) values (x.id, v_quem, v_previa, v_fio);
  end if;
  if v_tipo = 'enquete' then
    insert into rede_enquetes (post, prazo, multipla) values (x.id, now() + make_interval(hours => v_horas), v_multipla);
    insert into rede_opcoes (enquete, texto, ordem) select x.id, e.t, (e.n - 1)::smallint from jsonb_array_elements_text(v_opcoes) with ordinality e(t, n);
  end if;
  v_i := 0;
  for m in select e from jsonb_array_elements(v_midia) e loop
    v_cam := btrim(m ->> 'caminho');
    v_ext := substring(v_cam from '\.([a-z]+)$');
    insert into rede_midia (post, caminho, tipo, largura, altura, alt, ordem)
    values (x.id, v_cam, case v_ext when 'jpg' then 'image/jpeg' when 'png' then 'image/png' else 'image/webp' end,
            nullif(m ->> 'largura', '')::integer, nullif(m ->> 'altura', '')::integer, left(btrim(coalesce(m ->> 'alt', '')), 1000), v_i::smallint);
    v_i := v_i + 1;
  end loop;
  if v_audio is not null then
    v_ext := substring(btrim(v_audio ->> 'caminho') from '\.([a-z0-9]+)$');
    insert into rede_audios (post, caminho, tipo, duracao)
    values (x.id, btrim(v_audio ->> 'caminho'), case v_ext when 'webm' then 'audio/webm' when 'ogg' then 'audio/ogg' else 'audio/mp4' end, v_dur::smallint);
  end if;

  if v_resposta is not null and o.autor is distinct from v and not x.oculto and not interno.rede_bloqueado(v, o.autor) then
    perform interno.avisar_em(o.autor, format('%s respondeu ao seu post na Rede Lúcia: “%s”', interno.rede_nome(v), left(v_texto, 120)), 'rede');
  end if;
  return interno.rede_post_v2(x, v, true) || jsonb_build_object('avaliar', coalesce((v_tri ->> 'externa')::boolean, false));
exception when check_violation or invalid_text_representation or numeric_value_out_of_range then perform interno.erro('invalido:post');
end $$;

-- ── 5. Enquete: votar ───────────────────────────────────────────────────────────────────────────────────────────────────

/** A enquete do post como esta pessoa pode ver: totais só para quem votou, para quem fez a enquete ou depois do prazo. Nunca "quem votou em quê". */
create or replace function interno.rede3_pub_enquete(p interno.rede_posts, p_quem uuid) returns jsonb language sql stable security definer set search_path = interno, pg_temp as $$
  select jsonb_build_object(
    'prazo', e.prazo, 'multipla', e.multipla, 'encerrada', e.prazo <= now(),
    'votei', coalesce((select jsonb_agg(v.opcao) from rede_votos v join rede_opcoes oo on oo.id = v.opcao where oo.enquete = p.id and v.usuario = p_quem), '[]'::jsonb),
    'opcoes', (select jsonb_agg(jsonb_build_object('id', oo.id, 'texto', oo.texto,
        'votos', case when e.prazo <= now() or p.autor = p_quem or exists (select 1 from rede_votos v2 join rede_opcoes o2 on o2.id = v2.opcao where o2.enquete = p.id and v2.usuario = p_quem)
                      then (select count(*)::integer from rede_votos v3 where v3.opcao = oo.id) end) order by oo.ordem)
               from rede_opcoes oo where oo.enquete = p.id),
    'total', case when e.prazo <= now() or p.autor = p_quem or exists (select 1 from rede_votos v2 join rede_opcoes o2 on o2.id = v2.opcao where o2.enquete = p.id and v2.usuario = p_quem)
                  then (select count(distinct v4.usuario)::integer from rede_votos v4 join rede_opcoes o4 on o4.id = v4.opcao where o4.enquete = p.id) end)
  from rede_enquetes e where e.post = p.id
$$;

/**
 * Votar numa enquete (voto secreto). p_opcoes: uma opção (ou várias se a enquete aceita). Uma vez só: o voto não se troca. Só membro da
 * Rede, só quem pode ver o post, só antes do prazo. Devolve a enquete como esta pessoa pode ver (com os totais, agora que votou).
 */
create or replace function public.rede_pub_enquete_votar(p_post uuid, p_opcoes uuid[]) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); p rede_posts; e rede_enquetes; v_n integer;
begin
  perform interno.aberta('comunidade');
  if not coalesce((select rede_18 from perfis where id = v), false) then perform interno.erro('confirme_idade'); end if;
  if not interno.rede2_membro(v) then perform interno.erro('consentimento'); end if;
  perform interno.rede2_limite('votar');
  select * into p from rede_posts where id = p_post and tipo = 'enquete';
  if not found or not interno.rede_ve(p, v) or p.oculto or p.retido or p.apagado_em is not null then perform interno.erro('nao_encontrado'); end if;
  select * into e from rede_enquetes where post = p.id;
  if e.prazo <= now() then perform interno.erro('encerrada'); end if;
  if p_opcoes is null or coalesce(array_length(p_opcoes, 1), 0) = 0 then perform interno.erro('invalido:opcoes'); end if;
  if array_length(p_opcoes, 1) > 1 and not e.multipla then perform interno.erro('invalido:opcoes'); end if;
  select count(distinct o) into v_n from unnest(p_opcoes) o;
  if v_n <> array_length(p_opcoes, 1) or (select count(*) from rede_opcoes where enquete = p.id and id = any (p_opcoes)) <> v_n then perform interno.erro('invalido:opcoes'); end if;
  if exists (select 1 from rede_votos vo join rede_opcoes oo on oo.id = vo.opcao where oo.enquete = p.id and vo.usuario = v) then perform interno.erro('ja_votou'); end if;
  insert into rede_votos (opcao, usuario) select o, v from unnest(p_opcoes) o;
  return interno.rede3_pub_enquete(p, v);
end $$;

-- ── 6. Editar e histórico ───────────────────────────────────────────────────────────────────────────────────────────────

/**
 * Editar o próprio post. p: texto (post, enquete: não muda a pergunta depois de votada) ou titulo e corpo (discussão e dúvida).
 * Nos primeiros 15 minutos a edição passa sem marca. Depois, o texto anterior vai para rede_post_edicoes e o post ganha
 * "editado" (o histórico é visível para quem lê). As mesmas conferências de publicar valem de novo: dado pessoal, endereço e
 * triagem; o que a triagem segurar volta para a leitura da mediação.
 */
create or replace function public.rede_pub_editar(p_post uuid, p jsonb) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare
  v uuid := interno.eu(); x rede_posts; v_tri jsonb; v_ver text; v_motivo text; v_titulo text; v_texto text; v_corpo text; v_tudo text; v_antes text; v_novo text; v_marca boolean;
begin
  perform interno.aberta('comunidade');
  if p is null or jsonb_typeof(p) is distinct from 'object' then perform interno.erro('invalido:post'); end if;
  select * into x from rede_posts where id = p_post;
  if not found or x.autor is distinct from v or x.apagado_em is not null or x.tipo = 'aviso' then perform interno.erro('sem_permissao'); end if;
  -- Quem retirou o consentimento ou não confirma 18+ não edita mais (as mesmas portas de publicar).
  if not coalesce((select rede_18 from perfis where id = v), false) then perform interno.erro('confirme_idade'); end if;
  if not interno.rede2_membro(v) then perform interno.erro('consentimento'); end if;
  if x.travado or (select travado from rede_posts where id = coalesce(x.root_id, x.id)) then perform interno.erro('travado'); end if;
  perform interno.rede2_limite('editar');
  if x.tipo in ('discussao', 'duvida') then
    v_titulo := interno.txt(p ->> 'titulo', 'titulo', 5, 140);
    v_corpo := interno.txt(p ->> 'corpo', 'corpo', 10, 10000);
    v_texto := left(v_corpo, 500);
    v_antes := coalesce(x.titulo, '') || E'\n\n' || coalesce(x.corpo, '');
  elsif x.tipo = 'enquete' then
    if exists (select 1 from rede_votos vo join rede_opcoes oo on oo.id = vo.opcao where oo.enquete = x.id) then perform interno.erro('sem_permissao'); end if;
    v_texto := interno.txt(p ->> 'texto', 'texto', 1, 500); v_antes := x.texto;
  else
    v_texto := interno.txt(p ->> 'texto', 'texto', 1, 500); v_antes := x.texto;
  end if;
  v_tudo := coalesce(v_titulo, '') || ' ' || v_texto || ' ' || coalesce(v_corpo, '');
  if interno.rede3_pub_dado_pessoal(v_tudo) then perform interno.erro('dado_pessoal'); end if;
  v_tri := interno.rede_triagem(v_tudo, v);
  v_ver := v_tri ->> 'veredito'; v_motivo := coalesce(v_tri ->> 'motivo', '');
  if v_ver = 'bloquear' then perform interno.erro('invalido:texto'); end if;
  if v_ver = 'publicar' and interno.normal(v_tudo) ~ '(^|[^a-z])(macaco|crioulo|viado|bicha|sapatao|retardado|mongoloide|vagabunda|nordestino imundo|judeu imundo|negro imundo)([^a-z]|$)' then
    v_ver := 'revisar'; v_motivo := 'regra_simples_odio';
  end if;
  v_novo := case when x.tipo in ('discussao', 'duvida') then coalesce(v_titulo, '') || chr(10) || chr(10) || coalesce(v_corpo, '') else v_texto end;
  if v_antes is not distinct from v_novo then
    return interno.rede_post_v2(x, v, true) || jsonb_build_object('avaliar', false);
  end if;
  v_marca := x.criado_em < now() - interval '15 minutes';
  if v_marca then insert into rede_post_edicoes (post, texto_anterior) values (x.id, left(v_antes, 12000)); end if;
  update rede_posts set titulo = coalesce(v_titulo, titulo), texto = v_texto, corpo = coalesce(v_corpo, corpo),
         editado_em = case when v_marca then now() else editado_em end,
         oculto = case when v_ver = 'publicar' then oculto else true end,
         retido = case when v_ver = 'publicar' then retido else true end,
         avaliacao = case when v_ver = 'publicar' then avaliacao else 'revisao' end,
         motivo = case when v_ver = 'publicar' then motivo else v_motivo end
   where id = x.id returning * into x;
  return interno.rede_post_v2(x, v, true) || jsonb_build_object('avaliar', coalesce((v_tri ->> 'externa')::boolean, false));
exception when check_violation then perform interno.erro('invalido:post');
end $$;

/** O que o post era antes de cada edição (do mais recente ao mais antigo), para quem pode ver o post. */
create or replace function public.rede_pub_historico(p_post uuid) returns jsonb language plpgsql stable security definer set search_path = interno, pg_temp as $$
declare p rede_posts;
begin
  select * into p from rede_posts where id = p_post;
  if not found or not interno.rede_ve(p, auth.uid()) or p.apagado_em is not null then perform interno.erro('nao_encontrado'); end if;
  return coalesce((select jsonb_agg(jsonb_build_object('texto', e.texto_anterior, 'quando', e.criado_em) order by e.criado_em desc) from rede_post_edicoes e where e.post = p.id), '[]'::jsonb);
end $$;

-- ── 7. Agendar ──────────────────────────────────────────────────────────────────────────────────────────────────────────

/**
 * Publica de verdade, em nome do autor, tudo o que venceu (de uma pessoa, ou de todas quando p_autor é nulo). Cada pedido passa
 * por public.rede_publicar com as credenciais do autor: as mesmas conferências de sempre. O que falhar fica "falhou", com o código.
 */
create or replace function interno.rede3_pub_rodar(p_autor uuid default null) returns integer language plpgsql security definer set search_path = interno, pg_temp as $$
declare a rede_agendados; v_antes text := current_setting('request.jwt.claims', true); v_antes_sub text := current_setting('request.jwt.claim.sub', true); v_post jsonb; v_n integer := 0;
begin
  for a in select * from rede_agendados where estado = 'pendente' and quando <= now() and (p_autor is null or autor = p_autor) order by quando limit 50 for update skip locked loop
    perform set_config('request.jwt.claims', jsonb_build_object('sub', a.autor, 'role', 'authenticated')::text, true);
    perform set_config('request.jwt.claim.sub', a.autor::text, true);
    begin
      v_post := public.rede_publicar(a.pedido);
      update rede_agendados set estado = 'publicado', post = (v_post ->> 'id')::uuid, erro = '' where id = a.id;
      v_n := v_n + 1;
    exception when others then
      update rede_agendados set estado = 'falhou', erro = left(sqlerrm, 120) where id = a.id;
    end;
  end loop;
  perform set_config('request.jwt.claims', coalesce(v_antes, ''), true);
  perform set_config('request.jwt.claim.sub', coalesce(v_antes_sub, ''), true);
  return v_n;
end $$;

/**
 * Marcar uma publicação para depois (de 5 minutos a 30 dias). A publicação inteira é ensaiada agora e desfeita: se o pedido não
 * passaria (dado pessoal, comunidade, limite de caracteres), a pessoa sabe já. No horário, o banco publica; sem agendador, a
 * publicação sai na próxima vez que a pessoa abrir a Rede (rede_pub_agendados).
 */
create or replace function public.rede_pub_agendar(p jsonb, p_quando timestamptz) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); v_id uuid; v_pedido jsonb;
begin
  perform interno.aberta('comunidade');
  if p is null or jsonb_typeof(p) is distinct from 'object' then perform interno.erro('invalido:post'); end if;
  if p_quando is null or p_quando < now() + interval '5 minutes' or p_quando > now() + interval '30 days' then perform interno.erro('invalido:quando'); end if;
  if (select count(*) from rede_agendados where autor = v and estado = 'pendente') >= 10 then perform interno.erro('muitos_pedidos'); end if;
  -- A mídia e o áudio ainda sem dono valem: o caminho só é "usado" quando o post nasce.
  v_pedido := p - 'agendar';
  begin
    perform public.rede_publicar(v_pedido);
    raise exception '__ensaio__' using errcode = 'P0001';
  exception when others then
    if sqlerrm <> '__ensaio__' then raise; end if;
  end;
  insert into rede_agendados (autor, pedido, quando) values (v, v_pedido, p_quando) returning id into v_id;
  return jsonb_build_object('id', v_id, 'quando', p_quando);
end $$;

/** Publica o que venceu desta pessoa ("ao ler") e devolve a fila dela: o que espera, o que falhou e o que já saiu (últimos 20). */
create or replace function public.rede_pub_agendados() returns jsonb language plpgsql volatile security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu();
begin
  perform interno.rede3_pub_rodar(v);
  return coalesce((select jsonb_agg(jsonb_build_object('id', a.id, 'quando', a.quando, 'estado', a.estado, 'erro', a.erro, 'post', a.post,
           'texto', left(coalesce(a.pedido ->> 'texto', a.pedido ->> 'titulo', ''), 120)) order by a.quando desc)
         from (select * from rede_agendados where autor = v and estado <> 'cancelado' order by quando desc limit 20) a), '[]'::jsonb);
end $$;

create or replace function public.rede_pub_agendar_cancelar(p_id uuid) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu();
begin
  update rede_agendados set estado = 'cancelado' where id = p_id and autor = v and estado in ('pendente', 'falhou');
  if not found then perform interno.erro('nao_encontrado'); end if;
  return jsonb_build_object('cancelado', true);
end $$;

/** Para o agendador (pg_cron ou função agendada com a chave de serviço): publica o que venceu, de todo mundo. */
create or replace function public.rede_pub_agendados_rodar() returns integer language sql volatile security definer set search_path = interno, pg_temp as $$
  select interno.rede3_pub_rodar(null)
$$;

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule('lucia-rede-agendados', '*/5 * * * *', 'select public.rede_pub_agendados_rodar()');
  end if;
exception when others then null;
end $$;

-- ── 8. Detalhes por lote ────────────────────────────────────────────────────────────────────────────────────────────────

/**
 * O que cada post tem a mais, por lote (até 50 ids): áudio, enquete, prévia de link, quem pode responder, fio, se foi editado, se
 * ainda está na janela de 15 minutos. Id que a matriz não deixa esta pessoa ver simplesmente não aparece. {id: {...}}
 */
create or replace function public.rede_pub_detalhes(p_ids uuid[]) returns jsonb language plpgsql stable security definer set search_path = interno, pg_temp as $$
declare v uuid := auth.uid(); r jsonb := '{}'::jsonb; p rede_posts; ex rede_pub_extras; a rede_audios;
begin
  if p_ids is null then return r; end if;
  for p in select * from rede_posts where id = any (p_ids[1:50]) and apagado_em is null loop
    continue when not interno.rede_ve(p, v);
    select * into ex from rede_pub_extras where post = p.id;
    select * into a from rede_audios where post = p.id;
    r := r || jsonb_build_object(p.id::text, jsonb_strip_nulls(jsonb_build_object(
      'audio', case when a.id is not null then jsonb_build_object('id', a.id, 'duracao', a.duracao, 'tipo', a.tipo) end,
      'enquete', case when p.tipo = 'enquete' then interno.rede3_pub_enquete(p, v) end,
      'previa', ex.previa,
      'responde_quem', coalesce(ex.responde_quem, 'todos'),
      'fio', coalesce(ex.fio, false),
      'editado', p.editado_em is not null,
      'historico', exists (select 1 from rede_post_edicoes e where e.post = p.id),
      'janela_livre', v is not null and p.autor = v and p.criado_em > now() - interval '15 minutes')));
  end loop;
  return r;
end $$;

-- ── 9. Depósito de arquivos (Storage) ───────────────────────────────────────────────────────────────────────────────────
-- Bucket privado: imagens (já sem EXIF/GPS) e áudio de até 1 minuto. Quem envia: membro da Rede, só na própria pasta. Quem lê:
-- a regra da matriz (public.rede_pub_midia_pode) ou o dono da pasta (para ver antes de publicar). Sem Storage (teste local), nada.
do $$
begin
  if exists (select 1 from pg_namespace where nspname = 'storage') and to_regclass('storage.buckets') is not null then
    insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    values ('rede-midia', 'rede-midia', false, 3145728, array['image/jpeg', 'image/png', 'image/webp', 'audio/webm', 'audio/ogg', 'audio/mp4'])
    on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;
    execute 'drop policy if exists "rede_midia_envio" on storage.objects';
    execute 'create policy "rede_midia_envio" on storage.objects for insert to authenticated with check (bucket_id = ''rede-midia'' and (storage.foldername(name))[1] = auth.uid()::text and public.rede_pub_pode_enviar())';
    execute 'drop policy if exists "rede_midia_leitura" on storage.objects';
    execute 'create policy "rede_midia_leitura" on storage.objects for select to anon, authenticated using (bucket_id = ''rede-midia'' and ((storage.foldername(name))[1] = auth.uid()::text or public.rede_pub_midia_pode(name)))';
    execute 'drop policy if exists "rede_midia_remocao" on storage.objects';
    execute 'create policy "rede_midia_remocao" on storage.objects for delete to authenticated using (bucket_id = ''rede-midia'' and (storage.foldername(name))[1] = auth.uid()::text)';
  end if;
end $$;

-- ── 10. Permissões ──────────────────────────────────────────────────────────────────────────────────────────────────────
revoke all on function interno.rede3_pub_tem_endereco(text), interno.rede3_pub_dado_pessoal(text), interno.rede3_pub_previa(jsonb),
  interno.rede3_pub_enquete(interno.rede_posts, uuid), interno.rede3_pub_rodar(uuid) from public;
revoke all on function public.rede_pub_midia_reservar(text), public.rede_pub_pode_enviar(), public.rede_pub_midia_pode(text), public.rede_pub_midia_caminho(uuid),
  public.rede_pub_enquete_votar(uuid, uuid[]), public.rede_pub_editar(uuid, jsonb), public.rede_pub_historico(uuid), public.rede_pub_agendar(jsonb, timestamptz),
  public.rede_pub_agendados(), public.rede_pub_agendar_cancelar(uuid), public.rede_pub_agendados_rodar(), public.rede_pub_detalhes(uuid[]) from public;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on function interno.rede3_pub_tem_endereco(text), interno.rede3_pub_dado_pessoal(text), interno.rede3_pub_previa(jsonb),
      interno.rede3_pub_enquete(interno.rede_posts, uuid), interno.rede3_pub_rodar(uuid) from anon, authenticated;
    revoke all on function public.rede_pub_midia_reservar(text), public.rede_pub_pode_enviar(), public.rede_pub_midia_pode(text), public.rede_pub_midia_caminho(uuid),
      public.rede_pub_enquete_votar(uuid, uuid[]), public.rede_pub_editar(uuid, jsonb), public.rede_pub_historico(uuid), public.rede_pub_agendar(jsonb, timestamptz),
      public.rede_pub_agendados(), public.rede_pub_agendar_cancelar(uuid), public.rede_pub_agendados_rodar(), public.rede_pub_detalhes(uuid[]) from anon;
    -- Leitura (a matriz decide): com ou sem conta.
    grant execute on function public.rede_pub_midia_pode(text), public.rede_pub_midia_caminho(uuid), public.rede_pub_historico(uuid), public.rede_pub_detalhes(uuid[]) to anon, authenticated, service_role;
    -- Escrita: só com conta.
    grant execute on function public.rede_pub_midia_reservar(text), public.rede_pub_pode_enviar(), public.rede_pub_enquete_votar(uuid, uuid[]), public.rede_pub_editar(uuid, jsonb),
      public.rede_pub_agendar(jsonb, timestamptz), public.rede_pub_agendados(), public.rede_pub_agendar_cancelar(uuid) to authenticated, service_role;
    grant execute on function public.rede_pub_agendados_rodar() to service_role;
    revoke all on function public.rede_pub_agendados_rodar() from authenticated;
  end if;
end $$;
