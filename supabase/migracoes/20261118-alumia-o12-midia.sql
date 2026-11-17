-- Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
--
-- ═══════════════════════════ Alumia · Onda 12 · frente 12B · voz e vídeo (18/11/2026) ═══════════════════════════
-- O que entra (as telas ficam em components/rede/midia, o servidor em app/api/rede/video):
--   1. TRANSCRIÇÃO APROVADA do áudio (do post e da resposta): quem escreve é a autora (digitando, ou ditada no próprio aparelho,
--      quando o navegador garante que o reconhecimento roda nele) e o texto só chega aqui no "Aprovar": não existe rascunho no
--      servidor, nem transcrição feita por serviço de fora. Passa pela mesma conferência de texto do post (dado pessoal, regra
--      simples de ódio e triagem). Some com o post.
--   2. VÍDEO CURTO NO POST (até 60 s, até 16 MB), atrás do interruptor "alumia-video-post", que só vale ligado pelo painel
--      (interno.recursos_vivos; "só pelo nome": pede a segunda pessoa da coordenação). Desligado, nada se reserva, nada se liga e
--      nenhum vídeo aparece; desligar não apaga nada. O aparelho regrava o vídeo antes de subir (o arquivo que sai é só o que o
--      gravador do navegador escreve, sem GPS, modelo nem data) e a rota do servidor neutraliza de novo as caixas de metadado.
--      Depósito próprio, privado ("rede-video"), com a mesma regra das fotos: cada pessoa só grava na própria pasta, e só no
--      caminho que reservou; lê quem pode ver o post. Conta na cota de mídia da onda 8 (interno.alumia_midia_uso, refeita aqui
--      com o depósito novo). O arquivo que sai do registro (vídeo tirado, post apagado, conta apagada, reserva vencida) vai na
--      hora para a fila de arquivos do servidor (interno.alumia_arquivos_a_apagar), que a rota app/api/rede/exportar/faxina
--      esvazia. O painel do espaço (public.alumia_painel_espaco) passa a somar o depósito do vídeo.
--   3. MEUS DADOS: public.rede_meusdados_voz_e_video, a parte dos vídeos e das transcrições que a cópia em .zip junta.
-- Nada daqui guarda endereço de rede, lugar, quem viu ou quem ouviu. Nenhuma função devolve lista de pessoas.
-- Idempotente (scripts/testar-alumia-o12-midia.mjs roda três vezes no banco local). NÃO roda em produção sem o Jonathan.
--
-- Privacidade (leis conferidas no texto):
--   * LGPD (Lei 13.709/2018) art. 6º, III (necessidade): o vídeo sai do aparelho já sem metadado; sem som, o áudio nem é enviado.
--   * LGPD art. 18, VI: vídeo e transcrição saem com o post e com a conta (a fila de arquivos apaga o arquivo de verdade).
--   * ECA Digital (Lei 15.211/2025): só membro 18+ envia vídeo (a mesma regra das fotos).

-- ── 1. O interruptor no catálogo ─────────────────────────────────────────────────────────────────────────────────────────
-- "alumia-video-post" no catálogo dos recursos (lib/recursos.ts, pela junção): só pelo nome, como os outros da Alumia.
do $$
begin
  if to_regclass('interno.recursos_catalogo') is not null then
    insert into interno.recursos_catalogo (nome, so_pelo_nome) values ('alumia-video-post', true) on conflict (nome) do update set so_pelo_nome = true;
  end if;
end $$;

-- ── 2. Tabelas ───────────────────────────────────────────────────────────────────────────────────────────────────────────

/** A transcrição do áudio de um post, já aprovada pela autora. Uma por post (o post tem no máximo um áudio). */
create table if not exists interno.rede_audio_transcricoes (
  post uuid primary key references interno.rede_posts (id) on delete cascade,
  texto text not null check (char_length(texto) between 1 and 4000),
  origem text not null default 'digitada' check (origem in ('digitada', 'aparelho')),
  aprovada_em timestamptz not null default now()
);

/**
 * O vídeo de um post. Nasce como reserva (post nulo) quando a rota do servidor recebe o arquivo e vira do post no "ligar", logo
 * depois de publicar. Reserva que não virou de post em 24 horas sai (e o arquivo vai para a fila).
 */
create table if not exists interno.rede_post_videos (
  id uuid primary key default gen_random_uuid(),
  autor uuid not null references interno.perfis (id) on delete cascade,
  post uuid unique references interno.rede_posts (id) on delete cascade,
  caminho text not null unique check (caminho ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(mp4|webm)$'),
  tipo text not null check (tipo in ('video/mp4', 'video/webm')),
  bytes integer not null check (bytes between 1 and 16777216),
  duracao_ms integer not null check (duracao_ms between 500 and 60500),
  largura smallint not null check (largura between 2 and 1280),
  altura smallint not null check (altura between 2 and 1280),
  som boolean not null default false,
  alt text not null default '' check (char_length(alt) <= 1000),
  criado_em timestamptz not null default now(),
  ligado_em timestamptz,
  constraint rede_post_videos_ligado check ((post is null) = (ligado_em is null)),
  constraint rede_post_videos_extensao check ((tipo = 'video/mp4') = (caminho ~ '\.mp4$'))
);
create index if not exists rede_post_videos_reservas on interno.rede_post_videos (criado_em) where post is null;
create index if not exists rede_post_videos_autor on interno.rede_post_videos (autor) where post is null;

alter table interno.rede_audio_transcricoes enable row level security;
alter table interno.rede_post_videos enable row level security;
revoke all on interno.rede_audio_transcricoes, interno.rede_post_videos from public;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on interno.rede_audio_transcricoes, interno.rede_post_videos from anon, authenticated;
  end if;
end $$;

-- ── 3. A fila de arquivos aceita o depósito do vídeo ─────────────────────────────────────────────────────────────────────
-- A regra é refeita só se ainda não aceita (pode rodar de novo); mantém os depósitos que já aceitava.
do $$
declare r record;
begin
  if to_regclass('interno.alumia_arquivos_a_apagar') is null then return; end if;
  if exists (select 1 from pg_constraint where conrelid = 'interno.alumia_arquivos_a_apagar'::regclass and contype = 'c'
             and pg_get_constraintdef(oid) ~ 'deposito' and pg_get_constraintdef(oid) ~ 'rede-video') then
    return;
  end if;
  for r in select conname from pg_constraint where conrelid = 'interno.alumia_arquivos_a_apagar'::regclass and contype = 'c' and pg_get_constraintdef(oid) ~ 'deposito' loop
    execute format('alter table interno.alumia_arquivos_a_apagar drop constraint %I', r.conname);
  end loop;
  alter table interno.alumia_arquivos_a_apagar add constraint alumia_arquivos_a_apagar_deposito_check
    check (deposito in ('rede-midia', 'rede-stories', 'rede-album', 'rede-video'));
end $$;

-- ── 4. As peças de dentro ────────────────────────────────────────────────────────────────────────────────────────────────

/**
 * O vídeo no post está ligado? Só com decisão explícita do painel (interno.recursos_vivos) e sem a Alumia nova desligada lá. A
 * variável de montagem do site mostra o botão; quem libera o envio e a leitura é o banco.
 */
create or replace function interno.rede_o12m_video_ligado() returns boolean language plpgsql stable security definer set search_path = interno, pg_temp as $$
begin
  if to_regclass('interno.recursos_vivos') is null then return false; end if;
  if exists (select 1 from recursos_vivos where nome in ('rede-v2', 'alumia-2') and not ligado) then return false; end if;
  return coalesce((select ligado from recursos_vivos where nome = 'alumia-video-post'), false);
end $$;

/** O vídeo como a tela mostra (sem o caminho: o endereço sai só por public.rede_video_caminho, para quem pode ver o post). */
create or replace function interno.rede_o12m_video_json(p_id uuid, p_quem uuid) returns jsonb language sql stable security definer set search_path = interno, pg_temp as $$
  select jsonb_build_object('id', v.id, 'tipo', v.tipo, 'duracao_ms', v.duracao_ms, 'largura', v.largura, 'altura', v.altura, 'som', v.som,
                            'alt', v.alt, 'meu', p_quem is not null and v.autor = p_quem)
  from rede_post_videos v where v.id = p_id
$$;

/**
 * O texto pode ir para a Rede? A mesma conferência do post: dado pessoal (CPF, telefone, e-mail, endereço com número), a regra
 * simples de ódio e a triagem. Erro "dado_pessoal" ou "revisar"; nada fica guardado quando recusa.
 */
create or replace function interno.rede_o12m_conferir_texto(p_texto text, p_autor uuid) returns void language plpgsql security definer set search_path = interno, pg_temp as $$
declare v_tri jsonb;
begin
  if interno.rede3_pub_dado_pessoal(p_texto) then perform interno.erro('dado_pessoal'); end if;
  if interno.normal(p_texto) ~ '(^|[^a-z])(macaco|crioulo|viado|bicha|sapatao|retardado|mongoloide|vagabunda|nordestino imundo|judeu imundo|negro imundo)([^a-z]|$)' then
    perform interno.erro('revisar');
  end if;
  v_tri := interno.rede_triagem(p_texto, p_autor);
  if coalesce(v_tri ->> 'veredito', 'revisar') <> 'publicar' then perform interno.erro('revisar'); end if;
end $$;

/** Tira as reservas de vídeo que não viraram de post em 24 horas (o arquivo vai para a fila pelo gatilho). Devolve quantas. */
create or replace function interno.rede_o12m_faxina(p_limite integer default 200) returns integer language plpgsql security definer set search_path = interno, pg_temp as $$
declare v_n integer;
begin
  with velhas as (
    select id from rede_post_videos where post is null and criado_em < now() - interval '24 hours'
    order by criado_em limit greatest(1, least(coalesce(p_limite, 200), 1000))
  ), fora as (delete from rede_post_videos v using velhas where v.id = velhas.id returning 1)
  select count(*)::integer into v_n from fora;
  return v_n;
end $$;

/** Um vídeo saiu do registro: o arquivo vai na hora para a fila de arquivos do servidor. */
create or replace function interno.rede_o12m_video_para_a_fila() returns trigger language plpgsql security definer set search_path = interno, pg_temp as $$
begin
  if to_regclass('interno.alumia_arquivos_a_apagar') is not null then
    insert into alumia_arquivos_a_apagar (deposito, caminho) values ('rede-video', old.caminho) on conflict do nothing;
  end if;
  return old;
end $$;

drop trigger if exists rede_post_videos_para_a_fila on interno.rede_post_videos;
create trigger rede_post_videos_para_a_fila after delete on interno.rede_post_videos for each row execute function interno.rede_o12m_video_para_a_fila();

/** O post foi apagado (pela autora, pela mediação ou com a conta): o vídeo e a transcrição saem com ele. */
create or replace function interno.rede_o12m_post_apagado() returns trigger language plpgsql security definer set search_path = interno, pg_temp as $$
begin
  if new.apagado_em is not null and old.apagado_em is null then
    delete from rede_post_videos where post = new.id;
    delete from rede_audio_transcricoes where post = new.id;
  end if;
  return new;
end $$;

drop trigger if exists rede_posts_o12m_apagado on interno.rede_posts;
create trigger rede_posts_o12m_apagado after update of apagado_em on interno.rede_posts for each row execute function interno.rede_o12m_post_apagado();

/**
 * Quanto uma pessoa ocupa nos depósitos da Alumia, em bytes: a pasta dela em rede-midia, rede-stories e rede-video e as fotos que
 * ela mandou ao álbum dos atos (rede-album, pela ligação do registro: a pasta do álbum é a do ato). Sem depósito (teste local):
 * zero. A mesma de 20261117-alumia-onda11-fim.sql, com o depósito do vídeo.
 */
create or replace function interno.alumia_midia_uso(p_usuario uuid) returns bigint language plpgsql stable security definer set search_path = interno, pg_temp as $$
declare v bigint := 0; v_album bigint := 0;
begin
  if p_usuario is null or to_regclass('storage.objects') is null then return 0; end if;
  execute 'select coalesce(sum(case when (metadata ->> ''size'') ~ ''^[0-9]{1,15}$'' then (metadata ->> ''size'')::bigint else 0 end), 0)::bigint
             from storage.objects where bucket_id in (''rede-midia'', ''rede-stories'', ''rede-video'') and name like $1'
    into v using p_usuario::text || '/%';
  if to_regclass('interno.rede_ato_album') is not null then
    execute 'select coalesce(sum(case when (o.metadata ->> ''size'') ~ ''^[0-9]{1,15}$'' then (o.metadata ->> ''size'')::bigint else 0 end), 0)::bigint
               from storage.objects o join interno.rede_ato_album a on a.caminho = o.name
              where o.bucket_id = ''rede-album'' and a.quem = $1'
      into v_album using p_usuario;
  end if;
  return coalesce(v, 0) + coalesce(v_album, 0);
end $$;

/**
 * O espaço no painel (coordenação e admin): só totais, como em 20261117-alumia-onda11-fim.sql, agora com o depósito do vídeo no
 * total de cada depósito e na conta de quem está perto da cota (a mesma soma de interno.alumia_midia_uso).
 */
create or replace function public.alumia_painel_espaco() returns jsonb language plpgsql stable security definer set search_path = interno, pg_temp as $$
declare
  v_cota bigint := interno.alumia_midia_cota();
  v_depositos jsonb := '{}'::jsonb;
  v_perto integer := 0;
  v_orfaos integer := 0;
  f alumia_operacao;
begin
  perform interno.alumia_painel_exige();
  if to_regclass('storage.objects') is not null then
    execute 'select coalesce(jsonb_object_agg(b, jsonb_build_object(''bytes'', bytes, ''arquivos'', arquivos)), ''{}''::jsonb) from (
               select bucket_id as b, coalesce(sum(case when (metadata ->> ''size'') ~ ''^[0-9]{1,15}$'' then (metadata ->> ''size'')::bigint else 0 end), 0)::bigint as bytes,
                      count(*)::integer as arquivos
                 from storage.objects where bucket_id in (''rede-midia'', ''rede-stories'', ''rede-album'', ''rede-video'') group by bucket_id) x'
      into v_depositos;
    execute 'select count(*)::integer from (
               select dono, sum(bytes) as bytes from (
                 select split_part(name, ''/'', 1) as dono, case when (metadata ->> ''size'') ~ ''^[0-9]{1,15}$'' then (metadata ->> ''size'')::bigint else 0 end as bytes
                   from storage.objects where bucket_id in (''rede-midia'', ''rede-stories'', ''rede-video'')
                 union all
                 select a.quem::text, case when (o.metadata ->> ''size'') ~ ''^[0-9]{1,15}$'' then (o.metadata ->> ''size'')::bigint else 0 end
                   from storage.objects o join interno.rede_ato_album a on a.caminho = o.name where o.bucket_id = ''rede-album'') y
               group by dono) x where x.bytes >= $1'
      into v_perto using (v_cota * 8) / 10;
    execute 'select count(*)::integer from storage.objects o
              where o.bucket_id = ''rede-midia'' and o.created_at < now() - interval ''24 hours''
                and not exists (select 1 from interno.rede_midia m where m.caminho = o.name)
                and not exists (select 1 from interno.rede_audios a where a.caminho = o.name)'
      into v_orfaos;
  end if;
  select * into f from alumia_operacao where rotina = 'faxina_midia';
  return jsonb_build_object(
    'cota', v_cota,
    'depositos', jsonb_build_object(
      'rede-midia', coalesce(v_depositos -> 'rede-midia', '{"bytes": 0, "arquivos": 0}'::jsonb),
      'rede-stories', coalesce(v_depositos -> 'rede-stories', '{"bytes": 0, "arquivos": 0}'::jsonb),
      'rede-album', coalesce(v_depositos -> 'rede-album', '{"bytes": 0, "arquivos": 0}'::jsonb),
      'rede-video', coalesce(v_depositos -> 'rede-video', '{"bytes": 0, "arquivos": 0}'::jsonb)),
    'perto_da_cota', case when v_perto >= 3 then v_perto end,
    'orfaos', v_orfaos,
    'faxina', case when f.rotina is null then null else jsonb_build_object('quando', f.rodou_em, 'detalhes', f.detalhes) end,
    'faxina_ligada', exists (select 1 from configuracoes where chave = 'faxina_midia'),
    'deposito', to_regclass('storage.objects') is not null);
end $$;

-- ── 5. Transcrição aprovada ──────────────────────────────────────────────────────────────────────────────────────────────

/**
 * A autora aprova a transcrição do áudio do próprio post (ou resposta): o texto só chega aqui nesta hora e passa a aparecer para
 * quem pode ver o post. Aprovar de novo troca o texto. p_origem: 'digitada' ou 'aparelho' (ditada no próprio aparelho e revisada).
 */
create or replace function public.rede_transcricao_aprovar(p_post uuid, p_texto text, p_origem text) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); x rede_posts; v_texto text := btrim(coalesce(p_texto, '')); t rede_audio_transcricoes;
begin
  perform interno.aberta('comunidade');
  if not interno.rede2_membro(v) then perform interno.erro('consentimento'); end if;
  select * into x from rede_posts where id = p_post;
  if not found or x.autor is distinct from v or x.apagado_em is not null then perform interno.erro('nao_encontrado'); end if;
  if not exists (select 1 from rede_audios a where a.post = x.id) then perform interno.erro('sem_audio'); end if;
  if coalesce(p_origem, '') not in ('digitada', 'aparelho') then perform interno.erro('invalido:origem'); end if;
  if char_length(v_texto) not between 1 and 4000 then perform interno.erro('invalido:texto'); end if;
  perform interno.limite('rede_transcricao', 30, 60);
  perform interno.rede_o12m_conferir_texto(v_texto, v);
  insert into rede_audio_transcricoes (post, texto, origem, aprovada_em) values (x.id, v_texto, p_origem, now())
  on conflict (post) do update set texto = excluded.texto, origem = excluded.origem, aprovada_em = now()
  returning * into t;
  return jsonb_build_object('post', t.post, 'texto', t.texto, 'origem', t.origem, 'aprovada_em', t.aprovada_em);
end $$;

/** A autora tira a transcrição do próprio post. */
create or replace function public.rede_transcricao_tirar(p_post uuid) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); v_n integer;
begin
  delete from rede_audio_transcricoes t using rede_posts x where t.post = p_post and x.id = t.post and x.autor = v;
  get diagnostics v_n = row_count;
  return jsonb_build_object('tirada', v_n > 0);
end $$;

/** As transcrições aprovadas dos posts pedidos (até 50) que quem pergunta pode ver: {post: {texto, origem}}. */
create or replace function public.rede_transcricoes(p_ids uuid[]) returns jsonb language sql stable security definer set search_path = interno, pg_temp as $$
  select coalesce(jsonb_object_agg(t.post, jsonb_build_object('texto', t.texto, 'origem', t.origem)), '{}'::jsonb)
  from rede_audio_transcricoes t join rede_posts p on p.id = t.post
  where t.post = any ((coalesce(p_ids, '{}'::uuid[]))[1:50]) and p.apagado_em is null and interno.rede_ve(p, auth.uid())
$$;

-- ── 6. Vídeo curto no post ───────────────────────────────────────────────────────────────────────────────────────────────

/**
 * Antes de subir o vídeo, a rota do servidor (app/api/rede/video) pede aqui o caminho "<pessoa>/<id>.<ext>", já com o tamanho, a
 * duração e a medida do arquivo limpo. Confere o interruptor, membro 18+, o limite de envios, no máximo 3 reservas abertas e a cota.
 * Quem chamar direto pela API só ganha um caminho onde não consegue gravar: o depósito só aceita o servidor (parte 7).
 */
create or replace function public.rede_video_reservar(p_ext text, p_bytes integer, p_duracao_ms integer, p_largura integer, p_altura integer, p_som boolean)
returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); v_id uuid := gen_random_uuid(); v_caminho text;
begin
  perform interno.aberta('comunidade');
  if not interno.rede_o12m_video_ligado() then perform interno.erro('desligado'); end if;
  if coalesce(p_ext, '') not in ('mp4', 'webm') then perform interno.erro('invalido:arquivo'); end if;
  if p_bytes is null or p_bytes not between 1 and 16777216 then perform interno.erro('grande'); end if;
  if p_duracao_ms is null or p_duracao_ms not between 500 and 60500 then perform interno.erro('longo'); end if;
  if p_largura is null or p_altura is null or p_largura not between 2 and 1280 or p_altura not between 2 and 1280 then perform interno.erro('invalido:video'); end if;
  if not coalesce((select rede_18 from perfis where id = v), false) then perform interno.erro('confirme_idade'); end if;
  if not interno.rede2_membro(v) then perform interno.erro('consentimento'); end if;
  perform interno.limite('rede_video', 12, 60);
  perform interno.rede_o12m_faxina(50);
  if (select count(*) from rede_post_videos where autor = v and post is null) >= 3 then perform interno.erro('muitos_pedidos'); end if;
  if interno.alumia_midia_uso(v) + p_bytes > interno.alumia_midia_cota() then perform interno.erro('midia_cheia'); end if;
  v_caminho := v::text || '/' || v_id::text || '.' || p_ext;
  insert into rede_post_videos (id, autor, caminho, tipo, bytes, duracao_ms, largura, altura, som)
  values (v_id, v, v_caminho, case p_ext when 'mp4' then 'video/mp4' else 'video/webm' end, p_bytes, p_duracao_ms, p_largura, p_altura, coalesce(p_som, false));
  return jsonb_build_object('id', v_id, 'caminho', v_caminho);
end $$;

/**
 * Liga o vídeo reservado ao post que a autora acabou de publicar (até 15 minutos depois). Só post de primeiro nível, sem imagem e
 * sem áudio (um tipo de mídia por post), e só com o arquivo já no depósito (onde há depósito). p_alt: a descrição (até 1000).
 */
create or replace function public.rede_video_ligar(p_post uuid, p_video uuid, p_alt text) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); x rede_posts; r rede_post_videos; v_alt text := left(btrim(coalesce(p_alt, '')), 1000); v_ok boolean;
begin
  perform interno.aberta('comunidade');
  if not interno.rede_o12m_video_ligado() then perform interno.erro('desligado'); end if;
  if not interno.rede2_membro(v) then perform interno.erro('consentimento'); end if;
  select * into x from rede_posts where id = p_post;
  if not found or x.autor is distinct from v or x.apagado_em is not null then perform interno.erro('nao_encontrado'); end if;
  if x.resposta_a is not null then perform interno.erro('invalido:resposta'); end if;
  if x.criado_em < now() - interval '15 minutes' then perform interno.erro('tarde'); end if;
  if exists (select 1 from rede_midia m where m.post = x.id) or exists (select 1 from rede_audios a where a.post = x.id)
     or exists (select 1 from rede_post_videos o where o.post = x.id) then
    perform interno.erro('invalido:midia');
  end if;
  select * into r from rede_post_videos where id = p_video for update;
  if not found or r.autor is distinct from v or r.post is not null or r.criado_em < now() - interval '24 hours' then perform interno.erro('invalido:video'); end if;
  if to_regclass('storage.objects') is not null then
    execute 'select exists (select 1 from storage.objects where bucket_id = ''rede-video'' and name = $1)' into v_ok using r.caminho;
    if not v_ok then perform interno.erro('invalido:video'); end if;
  end if;
  if v_alt <> '' then perform interno.rede_o12m_conferir_texto(v_alt, v); end if;
  update rede_post_videos set post = x.id, ligado_em = now(), alt = v_alt where id = r.id;
  return interno.rede_o12m_video_json(r.id, v);
end $$;

/** A autora tira o vídeo do próprio post (o arquivo vai para a fila). */
create or replace function public.rede_video_tirar(p_post uuid) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); v_n integer;
begin
  delete from rede_post_videos where post = p_post and autor = v;
  get diagnostics v_n = row_count;
  return jsonb_build_object('tirado', v_n > 0);
end $$;

/** Os vídeos dos posts pedidos (até 50) que quem pergunta pode ver: {post: vídeo}. Com o interruptor desligado, nenhum. */
create or replace function public.rede_video_dos_posts(p_ids uuid[]) returns jsonb language plpgsql stable security definer set search_path = interno, pg_temp as $$
begin
  if not interno.rede_o12m_video_ligado() then return '{}'::jsonb; end if;
  return coalesce((select jsonb_object_agg(v.post, interno.rede_o12m_video_json(v.id, auth.uid()))
                   from rede_post_videos v join rede_posts p on p.id = v.post
                   where v.post = any ((coalesce(p_ids, '{}'::uuid[]))[1:50]) and p.apagado_em is null and interno.rede_ve(p, auth.uid())), '{}'::jsonb);
end $$;

/** Onde está o arquivo do vídeo (para pedir o endereço assinado), se quem pergunta pode ver o post. */
create or replace function public.rede_video_caminho(p_id uuid) returns jsonb language plpgsql stable security definer set search_path = interno, pg_temp as $$
declare r rede_post_videos; x rede_posts;
begin
  if not interno.rede_o12m_video_ligado() then perform interno.erro('nao_encontrado'); end if;
  select * into r from rede_post_videos where id = p_id and post is not null;
  if not found then perform interno.erro('nao_encontrado'); end if;
  select * into x from rede_posts where id = r.post;
  if not found or x.apagado_em is not null or not interno.rede_ve(x, auth.uid()) then perform interno.erro('nao_encontrado'); end if;
  return jsonb_build_object('bucket', 'rede-video', 'caminho', r.caminho, 'tipo', r.tipo);
end $$;

-- As duas regras do depósito (falso em vez de erro, como as das fotos em 20261112-alumia-portas.sql).

/** O arquivo deste caminho é do vídeo de um post que quem pergunta pode ver? */
create or replace function public.rede_video_pode(p_caminho text) returns boolean language sql stable security definer set search_path = interno, pg_temp as $$
  select interno.alumia_passa() and interno.rede_o12m_video_ligado()
     and exists (select 1 from rede_post_videos v join rede_posts p on p.id = v.post
                 where v.caminho = p_caminho and p.apagado_em is null and interno.rede_ve(p, auth.uid()))
$$;

-- O depósito não tem regra de envio para quem tem conta (como o álbum do ato): só o servidor do site grava, com a chave de serviço,
-- e só o arquivo que a rota acabou de limpar, no caminho que o banco reservou como a própria pessoa. Assim nenhum arquivo cru (com
-- GPS ou o modelo da câmera) entra pela API do depósito, e o tamanho guardado na reserva é o do arquivo que de fato entrou.
-- A regra de envio das versões de antes desta migração sai junto (no fim da parte 7, depois da política que a usava).

-- ── 7. O depósito do vídeo (Storage) ─────────────────────────────────────────────────────────────────────────────────────
-- Privado, até 16 MB, só MP4 e WEBM. Envia: só o servidor do site (chave de serviço), no caminho reservado; não há regra de envio
-- para quem tem conta. Lê: o dono da pasta ou quem pode ver o
-- post. Apaga: o dono da pasta (e o servidor, pela fila). Sem Storage (teste local), nada.
do $$
begin
  if exists (select 1 from pg_namespace where nspname = 'storage') and to_regclass('storage.buckets') is not null then
    insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    values ('rede-video', 'rede-video', false, 16777216, array['video/mp4', 'video/webm'])
    on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;
    execute 'drop policy if exists "rede_video_envio" on storage.objects'; -- versões de antes: quem tem conta enviava direto
    execute 'drop policy if exists "rede_video_leitura" on storage.objects';
    execute 'create policy "rede_video_leitura" on storage.objects for select to anon, authenticated using (bucket_id = ''rede-video'' and ((storage.foldername(name))[1] = auth.uid()::text or public.rede_video_pode(name)))';
    execute 'drop policy if exists "rede_video_remocao" on storage.objects';
    execute 'create policy "rede_video_remocao" on storage.objects for delete to authenticated using (bucket_id = ''rede-video'' and (storage.foldername(name))[1] = auth.uid()::text)';
  end if;
end $$;

drop function if exists public.rede_video_reservado(text);

-- A faxina das reservas vencidas, todo dia às 4h40 de Brasília (a fila de arquivos roda de hora em hora).
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule('lucia-alumia-video-faxina', '40 7 * * *', 'select interno.rede_o12m_faxina(1000)');
  end if;
end $$;

-- ── 7b. Meus dados: os vídeos e as transcrições na cópia ─────────────────────────────────────────────────────────────────
-- A cópia em .zip (lib/rede/meusdados/servidor.ts) chama esta parte logo depois de public.rede_meusdados_exportar, que já conferiu
-- o segundo fator e o limite de uma por dia; aqui só sai o que é da própria pessoa (LGPD art. 18, II). Sem o segundo fator
-- recente, nada.

/** Os vídeos e as transcrições da própria pessoa, e os arquivos do depósito do vídeo que a cópia baixa. */
create or replace function public.rede_meusdados_voz_e_video() returns jsonb language plpgsql stable security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu();
begin
  if not interno.alumia_md_fator_recente() then perform interno.erro('confirme_segundo_fator'); end if;
  return jsonb_build_object(
    'videos_dos_posts', interno.alumia_md_parte($q$
      select v.post, v.caminho as arquivo, v.tipo, round(v.duracao_ms / 1000.0, 1) as segundos, v.largura, v.altura, v.som, v.alt as descricao,
             v.ligado_em
      from rede_post_videos v where v.autor = $1 and v.post is not null order by v.ligado_em $q$, v),
    'transcricoes_dos_audios', interno.alumia_md_parte($q$
      select t.post, t.texto, t.origem, t.aprovada_em
      from rede_audio_transcricoes t join rede_posts x on x.id = t.post where x.autor = $1 order by t.aprovada_em $q$, v),
    'midias', interno.alumia_md_parte($q$
      select 'rede-video' as deposito, v.caminho from rede_post_videos v where v.autor = $1 and v.post is not null and v.caminho like $1::text || '/%'
      order by 2 limit 500 $q$, v));
end $$;

-- ── 8. Permissões ────────────────────────────────────────────────────────────────────────────────────────────────────────
revoke all on function interno.rede_o12m_video_ligado(), interno.rede_o12m_video_json(uuid, uuid), interno.rede_o12m_conferir_texto(text, uuid),
  interno.rede_o12m_faxina(integer), interno.rede_o12m_video_para_a_fila(), interno.rede_o12m_post_apagado(), interno.alumia_midia_uso(uuid) from public;
revoke all on function public.rede_transcricao_aprovar(uuid, text, text), public.rede_transcricao_tirar(uuid), public.rede_transcricoes(uuid[]),
  public.rede_video_reservar(text, integer, integer, integer, integer, boolean), public.rede_video_ligar(uuid, uuid, text), public.rede_video_tirar(uuid),
  public.rede_video_dos_posts(uuid[]), public.rede_video_caminho(uuid), public.rede_video_pode(text),
  public.rede_meusdados_voz_e_video() from public;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on function interno.rede_o12m_video_ligado(), interno.rede_o12m_video_json(uuid, uuid), interno.rede_o12m_conferir_texto(text, uuid),
      interno.rede_o12m_faxina(integer), interno.rede_o12m_video_para_a_fila(), interno.rede_o12m_post_apagado(), interno.alumia_midia_uso(uuid) from anon, authenticated;
    revoke all on function public.rede_transcricao_aprovar(uuid, text, text), public.rede_transcricao_tirar(uuid), public.rede_transcricoes(uuid[]),
      public.rede_video_reservar(text, integer, integer, integer, integer, boolean), public.rede_video_ligar(uuid, uuid, text), public.rede_video_tirar(uuid),
      public.rede_video_dos_posts(uuid[]), public.rede_video_caminho(uuid), public.rede_video_pode(text),
      public.rede_meusdados_voz_e_video() from anon, authenticated;
    -- Leitura (a regra de quem vê o post decide): com ou sem conta, como as fotos e o áudio.
    grant execute on function public.rede_transcricoes(uuid[]), public.rede_video_dos_posts(uuid[]), public.rede_video_caminho(uuid), public.rede_video_pode(text)
      to anon, authenticated, service_role;
    -- Escrita: só com conta.
    grant execute on function public.rede_transcricao_aprovar(uuid, text, text), public.rede_transcricao_tirar(uuid),
      public.rede_video_reservar(text, integer, integer, integer, integer, boolean), public.rede_video_ligar(uuid, uuid, text), public.rede_video_tirar(uuid),
      public.rede_meusdados_voz_e_video() to authenticated, service_role;
  end if;
end $$;

-- ── 9. A porta ───────────────────────────────────────────────────────────────────────────────────────────────────────────
-- Toda função public.rede_* e public.alumia_* que anon ou authenticated chamam passa pela porta da entrada (as duas regras do
-- depósito já chamam interno.alumia_passa e respondem falso em vez de erro). "abertas" tem de vir vazia.
do $$
declare v jsonb := interno.alumia_trancar();
begin
  if jsonb_array_length(coalesce(v -> 'abertas', '[]'::jsonb)) > 0 then
    raise warning 'alumia_trancar: função sem porta: %', v -> 'abertas';
  end if;
end $$;
select interno.alumia_trancar();

-- ═══════════════════════════ fim da frente 12B · voz e vídeo ═══════════════════════════
