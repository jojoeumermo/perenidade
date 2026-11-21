-- Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
-- Alumia · Prompt 4 · memória e luta (itens 44, 115, 116 e 119; os itens 43 e 121 não têm banco).
--
-- Roda depois das migrações 20261127-p4-* da onda 1 (o banco na versão 17 do 20261126-p5-fim.sql, mais as do P4); quem junta põe
-- antes do 20261127-p4-fim.sql. Não mexe em rede_alumia_versao nem na lista de exceções da porta: o 20261127-p4-fim.sql faz isso.
-- Não redefine nenhuma função que já existia: todas as funções daqui são novas (as ajudantes, interno.rede_p4_ml_*, e as da
-- memória, das vitórias, das campanhas e do podcast: rede_p4_memoria*, rede_p4_vitoria*, rede_p4_campanha*, rede_p4_podcast* e
-- rede_p4_episodio*).
--
-- Tudo atrás do interruptor "alumia-p4-memoria-e-luta" (catálogo, só pelo nome, desligado): desligado, toda função daqui recusa com
-- "desligado" e as do visitante (o RSS e o áudio do podcast) devolvem nulo.
--
--   44. ARQUIVO VIVO DA LUTA (interno.rede_p4_memorias). Uma memória é de uma comunidade: título, texto, data do fato e, se a pessoa
--       quiser, uma foto. Cada item tem o próprio consentimento, escolhido por quem envia ("não aparece ninguém", "quem aparece
--       concordou" ou "só apareço eu"); sem ele, nada entra. A foto só sobe com a declaração de que os rostos foram borrados no
--       aparelho (o mesmo desfoque do álbum do ato), só o servidor grava no depósito privado "rede-memoria" (depois de tirar o
--       metadado de novo) e toda memória passa pela mediação da comunidade antes de aparecer. Quem aparece pede para sair com um
--       toque: a memória sai da vista na hora (a foto deixa de ser lida pelo depósito) e quem pediu não fica registrado.
--  115. PÁGINA DE CAMPANHA (interno.rede_p4_campanhas e rede_p4_campanha_itens). A mediação junta atos, posts, documentos (título e
--       link https), vitórias e memórias de uma luta numa linha do tempo. Post e ato entram só pelo id e cada pessoa só vê os que
--       interno.rede_ve deixa; a linha do tempo não copia o texto de post nenhum.
--  116. MURAL DE VITÓRIAS (interno.rede_p4_vitorias). A mediação registra a conquista (título, texto, data e a fonte, se houver).
--  119. PODCAST DO NÚCLEO OU DA COMUNIDADE (interno.rede_p4_podcasts e rede_p4_episodios). O episódio é um post da comunidade com
--       áudio (o mesmo áudio do post, de até 60 s, que já passa pela limpeza de metadado); o título e as notas são da mediação. O RSS
--       (public.rede_p4_podcast_rss, chamada como visitante) só sai de comunidade aberta, só com os posts que já podem sair da Alumia
--       (interno.alumia_alc_sai: abertos à internet, conta que sai, fora da fila) e nunca com a trava da entrada ligada. Não se
--       mistura com o podcast do Instituto (tabelas, rota e feed próprios).
--
-- Privacidade: nenhuma função devolve quem enviou, quem registrou, quem pediu para sair ou quem ouviu; nenhuma devolve número de
-- pessoas; nenhuma coluna de endereço de rede (os limites são pela conta, interno.limite). Pode rodar mais de uma vez.
-- Lei: LGPD art. 6º, III (necessidade), art. 7º, I e art. 11, I (consentimento por item: memória de luta revela opinião política,
-- dado sensível), art. 18, IX (revogar o consentimento: quem aparece pede para sair), art. 46 (segurança: depósito privado, sem
-- metadado e sem rosto) e Lei 9.610/1998 (a fonte da vitória e o link do documento ficam com quem publicou na origem).

-- ── 0. O interruptor ──────────────────────────────────────────────────────────────────────────────────────────────────────
do $$
begin
  if to_regclass('interno.recursos_catalogo') is not null then
    insert into interno.recursos_catalogo (nome, so_pelo_nome) values ('alumia-p4-memoria-e-luta', true)
      on conflict (nome) do update set so_pelo_nome = true;
  end if;
end $$;

/** Ligado só com a Alumia nova e o interruptor ligado no painel (recursos_vivos). */
create or replace function interno.rede_p4_ml_ligado() returns boolean language plpgsql stable security definer set search_path = interno, pg_temp as $$
begin
  if to_regclass('interno.recursos_vivos') is null then return false; end if;
  if exists (select 1 from recursos_vivos where nome in ('rede-v2', 'alumia-2') and not ligado) then return false; end if;
  return coalesce((select ligado from recursos_vivos where nome = 'alumia-p4-memoria-e-luta'), false);
end $$;

/** Recusa com "desligado" quando o interruptor está desligado. */
create or replace function interno.rede_p4_ml_exige() returns void language plpgsql stable security definer set search_path = interno, pg_temp as $$
begin
  if not interno.rede_p4_ml_ligado() then perform interno.erro('desligado'); end if;
end $$;

/** Quem chama, membro da Alumia (18+, consentimento, aprovado quando a entrada exige). */
create or replace function interno.rede_p4_ml_membro() returns uuid language plpgsql stable security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu();
begin
  if not interno.rede2_membro(v) then perform interno.erro('sem_permissao'); end if;
  return v;
end $$;

/** A pessoa vê o que é desta comunidade? Aberta: qualquer membro da Alumia; restrita ou fechada: só quem é da comunidade. */
create or replace function interno.rede_p4_ml_ve_comunidade(p_slug text, p_quem uuid) returns boolean language sql stable security definer set search_path = interno, pg_temp as $$
  select p_quem is not null and exists (
    select 1 from rede_comunidades c where c.slug = p_slug
       and ((c.tipo = 'aberta' and c.slug not like 'fechado-%' and interno.rede2_membro(p_quem)) or interno.rede2_na_comunidade(c.slug, p_quem)))
$$;

/** A mediação desta comunidade (ou a equipe de cuidado). */
create or replace function interno.rede_p4_ml_modera(p_slug text, p_quem uuid) returns boolean language sql stable security definer set search_path = interno, pg_temp as $$
  select coalesce(interno.rede3_com_modera(p_slug, p_quem), false)
$$;

/** Um texto limpo: sem caracteres de controle, sem espaço sobrando. */
create or replace function interno.rede_p4_ml_texto(p text, p_max integer) returns text language sql immutable as $$
  select left(btrim(regexp_replace(coalesce(p, ''), '[\x01-\x08\x0B\x0C\x0E-\x1F\x7F]', '', 'g')), p_max)
$$;

/** Um link aceito: https, sem espaço, sem usuário e senha no endereço, até 500 caracteres. Nulo quando vazio. */
create or replace function interno.rede_p4_ml_link(p text) returns text language plpgsql immutable as $$
declare v text := btrim(coalesce(p, ''));
begin
  if v = '' then return null; end if;
  if char_length(v) > 500 or v !~ '^https://[A-Za-z0-9.-]+\.[A-Za-z]{2,}(:[0-9]{1,5})?(/[^\s<>"]*)?$' or v ~ '^https://[^/]*@' then
    perform interno.erro('invalido:link');
  end if;
  return v;
end $$;

/** Uma data do fato, de 1500 até hoje. */
create or replace function interno.rede_p4_ml_data(p text) returns date language plpgsql stable as $$
declare v date;
begin
  if coalesce(btrim(p), '') = '' then return null; end if;
  begin
    v := btrim(p)::date;
  exception when others then
    perform interno.erro('invalido:data');
  end;
  if v < date '1500-01-01' or v > current_date + 1 then perform interno.erro('invalido:data'); end if;
  return v;
end $$;

-- ── 1. As tabelas ─────────────────────────────────────────────────────────────────────────────────────────────────────────
-- O arquivo vivo da comunidade: título, texto, data do fato, o consentimento do item e a foto (sem rosto), se houver.
create table if not exists interno.rede_p4_memorias (
  id uuid primary key default gen_random_uuid(),
  comunidade text not null references interno.rede_comunidades (slug) on delete cascade on update cascade,
  -- Quem enviou: só para a própria pessoa ver e apagar as dela e para o limite. NUNCA sai do banco para outra pessoa.
  autor uuid not null references interno.perfis (id) on delete cascade,
  titulo text not null check (char_length(titulo) between 3 and 120),
  texto text not null default '' check (char_length(texto) <= 2000),
  quando date,
  -- O consentimento deste item, escolhido por quem envia.
  consentimento text not null check (consentimento in ('sem_pessoas', 'pessoas_consentiram', 'so_eu')),
  foto text unique check (foto is null or foto ~ '^[0-9a-f-]{36}\.(jpg|png|webp)$'),
  largura integer check (largura is null or largura between 1 and 8000),
  altura integer check (altura is null or altura between 1 and 8000),
  rostos_conferidos boolean not null default false,
  estado text not null default 'pendente' check (estado in ('reservada', 'pendente', 'publicada', 'retirada')),
  retirada_por text check (retirada_por is null or retirada_por in ('aparece', 'mediacao')),
  criada_em timestamptz not null default now(),
  decidida_em timestamptz,
  retirada_em timestamptz,
  check (foto is null or rostos_conferidos),
  check ((estado = 'retirada') = (retirada_por is not null))
);
create index if not exists rede_p4_memorias_comunidade on interno.rede_p4_memorias (comunidade, estado, quando desc nulls last);
create index if not exists rede_p4_memorias_autor on interno.rede_p4_memorias (autor);

-- O mural de vitórias da comunidade: a conquista, a data e a fonte. Não guarda quem registrou.
create table if not exists interno.rede_p4_vitorias (
  id uuid primary key default gen_random_uuid(),
  comunidade text not null references interno.rede_comunidades (slug) on delete cascade on update cascade,
  titulo text not null check (char_length(titulo) between 3 and 140),
  texto text not null default '' check (char_length(texto) <= 1000),
  quando date not null,
  fonte text check (fonte is null or fonte ~ '^https://'),
  criada_em timestamptz not null default now()
);
create index if not exists rede_p4_vitorias_comunidade on interno.rede_p4_vitorias (comunidade, quando desc);

-- A página de campanha da comunidade: o título, o texto e se já acabou.
create table if not exists interno.rede_p4_campanhas (
  id uuid primary key default gen_random_uuid(),
  comunidade text not null references interno.rede_comunidades (slug) on delete cascade on update cascade,
  titulo text not null check (char_length(titulo) between 3 and 120),
  sobre text not null default '' check (char_length(sobre) <= 1000),
  encerrada boolean not null default false,
  criada_em timestamptz not null default now()
);
create index if not exists rede_p4_campanhas_comunidade on interno.rede_p4_campanhas (comunidade, criada_em desc);

-- A linha do tempo da campanha: post e ato só pelo id (o texto não é copiado), documento por título e link, vitória e memória.
create table if not exists interno.rede_p4_campanha_itens (
  id uuid primary key default gen_random_uuid(),
  campanha uuid not null references interno.rede_p4_campanhas (id) on delete cascade,
  tipo text not null check (tipo in ('post', 'ato', 'documento', 'vitoria', 'memoria')),
  post uuid references interno.rede_posts (id) on delete cascade,
  vitoria uuid references interno.rede_p4_vitorias (id) on delete cascade,
  memoria uuid references interno.rede_p4_memorias (id) on delete cascade,
  titulo text not null check (char_length(titulo) between 3 and 140),
  link text check (link is null or link ~ '^https://'),
  quando date not null,
  criado_em timestamptz not null default now(),
  check ((tipo in ('post', 'ato')) = (post is not null)),
  check ((tipo = 'vitoria') = (vitoria is not null)),
  check ((tipo = 'memoria') = (memoria is not null)),
  check ((tipo = 'documento') = (link is not null))
);
create index if not exists rede_p4_campanha_itens_linha on interno.rede_p4_campanha_itens (campanha, quando);

-- O podcast da comunidade: o endereço do feed, o título e o texto de apresentação.
create table if not exists interno.rede_p4_podcasts (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9-]{3,40}$'),
  comunidade text not null references interno.rede_comunidades (slug) on delete cascade on update cascade,
  titulo text not null check (char_length(titulo) between 3 and 80),
  sobre text not null default '' check (char_length(sobre) <= 1000),
  criado_em timestamptz not null default now()
);

-- Os episódios do podcast: o post com áudio, o número, o título e as notas (nada de quem ouviu).
create table if not exists interno.rede_p4_episodios (
  id uuid primary key default gen_random_uuid(),
  podcast uuid not null references interno.rede_p4_podcasts (id) on delete cascade,
  post uuid not null references interno.rede_posts (id) on delete cascade,
  titulo text not null check (char_length(titulo) between 3 and 120),
  notas text not null default '' check (char_length(notas) <= 2000),
  numero integer not null check (numero > 0),
  criado_em timestamptz not null default now(),
  unique (podcast, post),
  unique (podcast, numero)
);

do $$
declare t text;
begin
  foreach t in array array['rede_p4_memorias', 'rede_p4_vitorias', 'rede_p4_campanhas', 'rede_p4_campanha_itens', 'rede_p4_podcasts', 'rede_p4_episodios'] loop
    execute format('alter table interno.%I enable row level security', t);
    execute format('revoke all on table interno.%I from public', t);
    if exists (select 1 from pg_roles where rolname = 'anon') then execute format('revoke all on table interno.%I from anon, authenticated', t); end if;
  end loop;
end $$;

-- ── 2. Arquivo vivo da luta (44) ──────────────────────────────────────────────────────────────────────────────────────────

/** Uma memória como sai para quem vê. Nunca quem enviou: só se é dela ("minha") e se a pessoa modera ("posso_decidir"). */
create or replace function interno.rede_p4_memoria_json(m interno.rede_p4_memorias, p_quem uuid) returns jsonb language sql stable security definer set search_path = interno, pg_temp as $$
  select jsonb_build_object(
    'id', m.id, 'comunidade', m.comunidade, 'titulo', m.titulo, 'texto', m.texto, 'quando', m.quando,
    'consentimento', m.consentimento, 'foto', m.foto is not null and m.estado <> 'retirada', 'estado', m.estado,
    'retirada_por', m.retirada_por, 'minha', m.autor = p_quem, 'posso_decidir', interno.rede_p4_ml_modera(m.comunidade, p_quem))
$$;

/**
 * Enviar uma memória. p: {comunidade, titulo, texto, quando, consentimento, foto: {ext, largura, altura, rostos_conferidos}}. Sem
 * foto, vai direto para a fila da mediação; com foto, fica "reservada" e devolve o caminho que só o servidor do site grava
 * (app/api/rede/memoria/foto), e vai para a fila em public.rede_p4_memoria_enviada.
 */
create or replace function public.rede_p4_memoria_enviar(p jsonb) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid; v_slug text := lower(btrim(coalesce(p ->> 'comunidade', ''))); v_titulo text; v_texto text; v_cons text := coalesce(p ->> 'consentimento', '');
  v_foto jsonb := p -> 'foto'; v_ext text; v_id uuid := gen_random_uuid(); v_cam text; m rede_p4_memorias;
begin
  perform interno.alumia_porta();
  perform interno.rede_p4_ml_exige();
  v := interno.rede_p4_ml_membro();
  if not interno.rede2_na_comunidade(v_slug, v) then perform interno.erro('sem_permissao'); end if;
  v_titulo := interno.rede_p4_ml_texto(p ->> 'titulo', 200);
  v_texto := interno.rede_p4_ml_texto(p ->> 'texto', 4000);
  if char_length(v_titulo) not between 3 and 120 then perform interno.erro('invalido:titulo'); end if;
  if char_length(v_texto) > 2000 then perform interno.erro('invalido:texto'); end if;
  if v_cons not in ('sem_pessoas', 'pessoas_consentiram', 'so_eu') then perform interno.erro('invalido:consentimento'); end if;
  perform interno.limite('alumia_p4_memoria', 10, 1440);
  if jsonb_typeof(v_foto) = 'object' then
    if coalesce((v_foto ->> 'rostos_conferidos')::boolean, false) is not true then perform interno.erro('rostos_nao_conferidos'); end if;
    v_ext := coalesce(v_foto ->> 'ext', '');
    if v_ext not in ('jpg', 'png', 'webp') then perform interno.erro('invalido:arquivo'); end if;
    v_cam := v_id::text || '.' || v_ext;
    insert into rede_p4_memorias (id, comunidade, autor, titulo, texto, quando, consentimento, foto, largura, altura, rostos_conferidos, estado)
    values (v_id, v_slug, v, v_titulo, v_texto, interno.rede_p4_ml_data(p ->> 'quando'), v_cons, v_cam,
            least(greatest(coalesce((v_foto ->> 'largura')::integer, 1), 1), 8000), least(greatest(coalesce((v_foto ->> 'altura')::integer, 1), 1), 8000),
            true, 'reservada')
    returning * into m;
    return jsonb_build_object('id', m.id, 'caminho', m.foto);
  end if;
  insert into rede_p4_memorias (id, comunidade, autor, titulo, texto, quando, consentimento)
  values (v_id, v_slug, v, v_titulo, v_texto, interno.rede_p4_ml_data(p ->> 'quando'), v_cons)
  returning * into m;
  return interno.rede_p4_memoria_json(m, v);
end $$;

/** A foto chegou ao depósito: a memória vai para a fila da mediação. Onde há depósito, confere que o arquivo existe. */
create or replace function public.rede_p4_memoria_enviada(p_id uuid) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid; m rede_p4_memorias; v_ok boolean := true;
begin
  perform interno.alumia_porta();
  perform interno.rede_p4_ml_exige();
  v := interno.rede_p4_ml_membro();
  select * into m from rede_p4_memorias where id = p_id and autor = v and estado = 'reservada' for update;
  if not found then perform interno.erro('nao_encontrado'); end if;
  if to_regclass('storage.objects') is not null then
    execute 'select exists (select 1 from storage.objects where bucket_id = ''rede-memoria'' and name = $1)' into v_ok using m.foto;
  end if;
  if not v_ok then perform interno.erro('invalido:arquivo'); end if;
  update rede_p4_memorias set estado = 'pendente' where id = p_id returning * into m;
  return interno.rede_p4_memoria_json(m, v);
end $$;

/** O arquivo vivo de uma comunidade: as publicadas (para quem vê a comunidade), as próprias e, para a mediação, a fila. */
create or replace function public.rede_p4_memorias(p_comunidade text) returns jsonb language plpgsql stable security definer set search_path = interno, pg_temp as $$
declare v uuid; v_slug text := lower(btrim(coalesce(p_comunidade, ''))); v_mod boolean;
begin
  perform interno.alumia_porta();
  perform interno.rede_p4_ml_exige();
  v := interno.rede_p4_ml_membro();
  if not interno.rede_p4_ml_ve_comunidade(v_slug, v) then perform interno.erro('nao_encontrado'); end if;
  v_mod := interno.rede_p4_ml_modera(v_slug, v);
  return jsonb_build_object(
    'comunidade', v_slug,
    'posso_enviar', interno.rede2_na_comunidade(v_slug, v),
    'modero', v_mod,
    'memorias', coalesce((select jsonb_agg(interno.rede_p4_memoria_json(m, v) order by m.quando desc nulls last, m.criada_em desc)
                            from rede_p4_memorias m where m.comunidade = v_slug and m.estado = 'publicada'), '[]'::jsonb),
    'minhas', coalesce((select jsonb_agg(interno.rede_p4_memoria_json(m, v) order by m.criada_em desc)
                          from rede_p4_memorias m where m.comunidade = v_slug and m.autor = v and m.estado in ('pendente', 'retirada')), '[]'::jsonb),
    'fila', case when v_mod then coalesce((select jsonb_agg(interno.rede_p4_memoria_json(m, v) order by m.criada_em)
                                             from rede_p4_memorias m where m.comunidade = v_slug and m.estado = 'pendente'), '[]'::jsonb)
                 else '[]'::jsonb end);
end $$;

/** A mediação publica a memória ou recusa (a memória some). */
create or replace function public.rede_p4_memoria_decidir(p_id uuid, p_publicar boolean) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid; m rede_p4_memorias;
begin
  perform interno.alumia_porta();
  perform interno.rede_p4_ml_exige();
  v := interno.rede_p4_ml_membro();
  select * into m from rede_p4_memorias where id = p_id and estado = 'pendente' for update;
  if not found or not interno.rede_p4_ml_modera(m.comunidade, v) then perform interno.erro('nao_encontrado'); end if;
  perform interno.limite('alumia_p4_memoria_mod', 300, 60);
  if coalesce(p_publicar, false) then
    update rede_p4_memorias set estado = 'publicada', decidida_em = now() where id = p_id;
  else
    delete from rede_p4_memorias where id = p_id;
  end if;
  return public.rede_p4_memorias(m.comunidade);
end $$;

/**
 * "Eu apareço aqui e quero sair": qualquer pessoa que vê a memória pede, e ela sai da vista na hora (a foto deixa de ser lida). Quem
 * pediu não é guardado em lugar nenhum; o limite é pela conta e some sozinho. A mediação também tira (p_motivo 'mediacao').
 */
create or replace function public.rede_p4_memoria_sair(p_id uuid, p_motivo text default 'aparece') returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid; m rede_p4_memorias; v_por text := coalesce(p_motivo, 'aparece');
begin
  perform interno.alumia_porta();
  perform interno.rede_p4_ml_exige();
  v := interno.rede_p4_ml_membro();
  if v_por not in ('aparece', 'mediacao') then perform interno.erro('invalido:motivo'); end if;
  select * into m from rede_p4_memorias where id = p_id and estado = 'publicada' for update;
  if not found or not interno.rede_p4_ml_ve_comunidade(m.comunidade, v) then perform interno.erro('nao_encontrado'); end if;
  if v_por = 'mediacao' and not interno.rede_p4_ml_modera(m.comunidade, v) then perform interno.erro('sem_permissao'); end if;
  perform interno.limite('alumia_p4_memoria_sair', 20, 1440);
  update rede_p4_memorias set estado = 'retirada', retirada_por = v_por, retirada_em = now() where id = p_id;
  return jsonb_build_object('ok', true);
end $$;

/** Quem enviou apaga a própria memória (em qualquer estado): o registro some de verdade. */
create or replace function public.rede_p4_memoria_apagar(p_id uuid) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid; m rede_p4_memorias;
begin
  perform interno.alumia_porta();
  perform interno.rede_p4_ml_exige();
  v := interno.rede_p4_ml_membro();
  delete from rede_p4_memorias where id = p_id and autor = v returning * into m;
  if not found then perform interno.erro('nao_encontrado'); end if;
  return jsonb_build_object('ok', true, 'foto', m.foto);
end $$;

/** Regra de leitura do depósito "rede-memoria": publicada e a comunidade visível, ou a própria, ou a mediação (para a fila). */
create or replace function public.rede_p4_memoria_foto_pode(p_caminho text) returns boolean language sql stable security definer set search_path = interno, pg_temp as $$
  select interno.alumia_passa() and interno.rede_p4_ml_ligado() and exists (
    select 1 from rede_p4_memorias m
     where m.foto = p_caminho and m.estado in ('pendente', 'publicada')
       and ((m.estado = 'publicada' and interno.rede_p4_ml_ve_comunidade(m.comunidade, auth.uid()))
            or m.autor = auth.uid()
            or interno.rede_p4_ml_modera(m.comunidade, auth.uid())))
$$;

/** Onde está a foto (depósito e caminho), se esta pessoa pode vê-la. */
create or replace function public.rede_p4_memoria_foto(p_id uuid) returns jsonb language plpgsql stable security definer set search_path = interno, pg_temp as $$
declare m rede_p4_memorias;
begin
  perform interno.alumia_porta();
  perform interno.rede_p4_ml_exige();
  perform interno.rede_p4_ml_membro();
  select * into m from rede_p4_memorias where id = p_id and foto is not null;
  if not found or not public.rede_p4_memoria_foto_pode(m.foto) then perform interno.erro('nao_encontrado'); end if;
  return jsonb_build_object('bucket', 'rede-memoria', 'caminho', m.foto);
end $$;

/**
 * Para a faxina dos arquivos (só a chave de serviço): as fotos de "rede-memoria" que ninguém mais lê (memória retirada, apagada ou
 * reserva vencida) com mais de 1 dia. Sem depósito (banco local), lista vazia.
 */
create or replace function public.rede_p4_memoria_orfas(p_limite integer default 500) returns setof text language plpgsql security definer set search_path = interno, pg_temp as $$
begin
  delete from rede_p4_memorias where estado = 'reservada' and criada_em < now() - interval '1 day';
  if to_regclass('storage.objects') is null then return; end if;
  return query execute 'select o.name from storage.objects o where o.bucket_id = ''rede-memoria'' and o.created_at < now() - interval ''1 day''
                          and not exists (select 1 from interno.rede_p4_memorias m where m.foto = o.name and m.estado in (''pendente'', ''publicada''))
                        order by o.created_at limit $1'
    using least(greatest(coalesce(p_limite, 500), 1), 2000);
end $$;

-- O depósito das memórias: privado, só imagem, 3 MB, sem regra de envio (só o servidor grava). Sem Storage (teste local), nada.
do $$
begin
  if exists (select 1 from pg_namespace where nspname = 'storage') and to_regclass('storage.buckets') is not null then
    insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    values ('rede-memoria', 'rede-memoria', false, 3145728, array['image/jpeg', 'image/png', 'image/webp'])
    on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;
    execute 'drop policy if exists "rede_memoria_leitura" on storage.objects';
    execute 'create policy "rede_memoria_leitura" on storage.objects for select to anon, authenticated using (bucket_id = ''rede-memoria'' and public.rede_p4_memoria_foto_pode(name))';
  end if;
end $$;

-- ── 3. Mural de vitórias (116) ────────────────────────────────────────────────────────────────────────────────────────────

create or replace function interno.rede_p4_vitoria_json(x interno.rede_p4_vitorias, p_quem uuid) returns jsonb language sql stable security definer set search_path = interno, pg_temp as $$
  select jsonb_build_object('id', x.id, 'comunidade', x.comunidade, 'comunidade_nome', (select c.nome from rede_comunidades c where c.slug = x.comunidade),
                            'titulo', x.titulo, 'texto', x.texto, 'quando', x.quando, 'fonte', x.fonte,
                            'posso_tirar', interno.rede_p4_ml_modera(x.comunidade, p_quem))
$$;

/** A mediação registra uma vitória. p: {comunidade, titulo, texto, quando, fonte}. */
create or replace function public.rede_p4_vitoria_registrar(p jsonb) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid; v_slug text := lower(btrim(coalesce(p ->> 'comunidade', ''))); v_titulo text; v_texto text; v_quando date; x rede_p4_vitorias;
begin
  perform interno.alumia_porta();
  perform interno.rede_p4_ml_exige();
  v := interno.rede_p4_ml_membro();
  if not interno.rede_p4_ml_modera(v_slug, v) then perform interno.erro('sem_permissao'); end if;
  v_titulo := interno.rede_p4_ml_texto(p ->> 'titulo', 200);
  v_texto := interno.rede_p4_ml_texto(p ->> 'texto', 2000);
  if char_length(v_titulo) not between 3 and 140 then perform interno.erro('invalido:titulo'); end if;
  if char_length(v_texto) > 1000 then perform interno.erro('invalido:texto'); end if;
  v_quando := coalesce(interno.rede_p4_ml_data(p ->> 'quando'), current_date);
  perform interno.limite('alumia_p4_vitoria', 30, 1440);
  insert into rede_p4_vitorias (comunidade, titulo, texto, quando, fonte)
  values (v_slug, v_titulo, v_texto, v_quando, interno.rede_p4_ml_link(p ->> 'fonte'))
  returning * into x;
  return interno.rede_p4_vitoria_json(x, v);
end $$;

/** A mediação tira uma vitória do mural. */
create or replace function public.rede_p4_vitoria_tirar(p_id uuid) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid; x rede_p4_vitorias;
begin
  perform interno.alumia_porta();
  perform interno.rede_p4_ml_exige();
  v := interno.rede_p4_ml_membro();
  select * into x from rede_p4_vitorias where id = p_id;
  if not found or not interno.rede_p4_ml_modera(x.comunidade, v) then perform interno.erro('nao_encontrado'); end if;
  delete from rede_p4_vitorias where id = p_id;
  return jsonb_build_object('ok', true);
end $$;

/**
 * O mural: de uma comunidade (p_comunidade) ou de todas as que a pessoa vê (nulo), até 100, da mais nova para a mais antiga. Diz
 * também em quais comunidades a pessoa pode registrar (as que ela modera).
 */
create or replace function public.rede_p4_vitorias(p_comunidade text default null) returns jsonb language plpgsql stable security definer set search_path = interno, pg_temp as $$
declare v uuid; v_slug text := nullif(lower(btrim(coalesce(p_comunidade, ''))), '');
begin
  perform interno.alumia_porta();
  perform interno.rede_p4_ml_exige();
  v := interno.rede_p4_ml_membro();
  if v_slug is not null and not interno.rede_p4_ml_ve_comunidade(v_slug, v) then perform interno.erro('nao_encontrado'); end if;
  return jsonb_build_object(
    'vitorias', coalesce((select jsonb_agg(interno.rede_p4_vitoria_json(x, v) order by x.quando desc, x.criada_em desc)
                            from (select * from rede_p4_vitorias y
                                   where (v_slug is null or y.comunidade = v_slug) and interno.rede_p4_ml_ve_comunidade(y.comunidade, v)
                                   order by y.quando desc, y.criada_em desc limit 100) x), '[]'::jsonb),
    'posso_registrar', coalesce((select jsonb_agg(jsonb_build_object('slug', c.slug, 'nome', c.nome) order by c.nome)
                                   from rede_comunidades c where interno.rede_p4_ml_modera(c.slug, v)
                                     and exists (select 1 from rede_comunidade_membros mm where mm.comunidade = c.slug and mm.usuario = v)), '[]'::jsonb));
end $$;

-- ── 4. Página de campanha (115) ───────────────────────────────────────────────────────────────────────────────────────────

create or replace function interno.rede_p4_campanha_json(c interno.rede_p4_campanhas, p_quem uuid) returns jsonb language sql stable security definer set search_path = interno, pg_temp as $$
  select jsonb_build_object('id', c.id, 'comunidade', c.comunidade, 'comunidade_nome', (select k.nome from rede_comunidades k where k.slug = c.comunidade),
                            'titulo', c.titulo, 'sobre', c.sobre, 'encerrada', c.encerrada, 'criada_em', c.criada_em,
                            'modero', interno.rede_p4_ml_modera(c.comunidade, p_quem))
$$;

/** O item da linha do tempo pode aparecer para esta pessoa? Post e ato só pelo rede_ve; memória só publicada. */
create or replace function interno.rede_p4_ml_item_ve(i interno.rede_p4_campanha_itens, p_quem uuid) returns boolean language sql stable security definer set search_path = interno, pg_temp as $$
  select case i.tipo
    when 'post' then exists (select 1 from rede_posts p where p.id = i.post and p.apagado_em is null and not p.oculto and coalesce(interno.rede_ve(p, p_quem), false))
    when 'ato' then exists (select 1 from rede_posts p where p.id = i.post and p.apagado_em is null and not p.oculto and coalesce(interno.rede_ve(p, p_quem), false))
    when 'memoria' then exists (select 1 from rede_p4_memorias m where m.id = i.memoria and m.estado = 'publicada')
    else true end
$$;

/** A mediação abre uma campanha. p: {comunidade, titulo, sobre}. */
create or replace function public.rede_p4_campanha_criar(p jsonb) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid; v_slug text := lower(btrim(coalesce(p ->> 'comunidade', ''))); v_titulo text; v_sobre text; c rede_p4_campanhas;
begin
  perform interno.alumia_porta();
  perform interno.rede_p4_ml_exige();
  v := interno.rede_p4_ml_membro();
  if not interno.rede_p4_ml_modera(v_slug, v) then perform interno.erro('sem_permissao'); end if;
  v_titulo := interno.rede_p4_ml_texto(p ->> 'titulo', 200);
  v_sobre := interno.rede_p4_ml_texto(p ->> 'sobre', 2000);
  if char_length(v_titulo) not between 3 and 120 then perform interno.erro('invalido:titulo'); end if;
  if char_length(v_sobre) > 1000 then perform interno.erro('invalido:texto'); end if;
  perform interno.limite('alumia_p4_campanha', 10, 1440);
  insert into rede_p4_campanhas (comunidade, titulo, sobre) values (v_slug, v_titulo, v_sobre) returning * into c;
  return interno.rede_p4_campanha_json(c, v);
end $$;

/**
 * A mediação põe um item na linha do tempo. p: {campanha, tipo, titulo, quando, post (post e ato), vitoria, memoria, link (documento)}.
 * O post e o ato têm de ser da mesma comunidade e visíveis para quem põe; a vitória e a memória também. Sem data, vale a do ato
 * (o começo), a do post (quando foi escrito) ou a da vitória.
 */
create or replace function public.rede_p4_campanha_por(p jsonb) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid; c rede_p4_campanhas; v_tipo text := coalesce(p ->> 'tipo', ''); v_titulo text; v_quando date; v_post uuid; v_vit uuid; v_mem uuid;
  v_link text; po rede_posts; x rede_p4_vitorias; m rede_p4_memorias;
begin
  perform interno.alumia_porta();
  perform interno.rede_p4_ml_exige();
  v := interno.rede_p4_ml_membro();
  begin
    select * into c from rede_p4_campanhas where id = (p ->> 'campanha')::uuid;
  exception when others then perform interno.erro('nao_encontrado');
  end;
  if c.id is null or not interno.rede_p4_ml_modera(c.comunidade, v) then perform interno.erro('nao_encontrado'); end if;
  if v_tipo not in ('post', 'ato', 'documento', 'vitoria', 'memoria') then perform interno.erro('invalido:tipo'); end if;
  v_titulo := interno.rede_p4_ml_texto(p ->> 'titulo', 200);
  if char_length(v_titulo) not between 3 and 140 then perform interno.erro('invalido:titulo'); end if;
  v_quando := interno.rede_p4_ml_data(p ->> 'quando');
  if (select count(*) from rede_p4_campanha_itens where campanha = c.id) >= 300 then perform interno.erro('invalido:itens'); end if;
  perform interno.limite('alumia_p4_campanha_item', 120, 60);
  if v_tipo in ('post', 'ato') then
    begin
      v_post := (p ->> 'post')::uuid;
    exception when others then perform interno.erro('nao_encontrado');
    end;
    select * into po from rede_posts where id = v_post and apagado_em is null;
    if po.id is null or po.comunidade is distinct from c.comunidade or not coalesce(interno.rede_ve(po, v), false) then perform interno.erro('nao_encontrado'); end if;
    if v_tipo = 'ato' then
      if not exists (select 1 from rede_chamados k where k.post = po.id) then perform interno.erro('invalido:ato'); end if;
      v_quando := coalesce(v_quando, (select (k.inicio at time zone 'America/Sao_Paulo')::date from rede_chamados k where k.post = po.id));
    end if;
    v_quando := coalesce(v_quando, (po.criado_em at time zone 'America/Sao_Paulo')::date);
  elsif v_tipo = 'vitoria' then
    begin
      v_vit := (p ->> 'vitoria')::uuid;
    exception when others then perform interno.erro('nao_encontrado');
    end;
    select * into x from rede_p4_vitorias where id = v_vit and comunidade = c.comunidade;
    if x.id is null then perform interno.erro('nao_encontrado'); end if;
    v_quando := coalesce(v_quando, x.quando);
  elsif v_tipo = 'memoria' then
    begin
      v_mem := (p ->> 'memoria')::uuid;
    exception when others then perform interno.erro('nao_encontrado');
    end;
    select * into m from rede_p4_memorias where id = v_mem and comunidade = c.comunidade and estado = 'publicada';
    if m.id is null then perform interno.erro('nao_encontrado'); end if;
    v_quando := coalesce(v_quando, m.quando, (m.criada_em at time zone 'America/Sao_Paulo')::date);
  else
    v_link := interno.rede_p4_ml_link(p ->> 'link');
    if v_link is null then perform interno.erro('invalido:link'); end if;
  end if;
  if v_quando is null then perform interno.erro('invalido:data'); end if;
  insert into rede_p4_campanha_itens (campanha, tipo, post, vitoria, memoria, titulo, link, quando)
  values (c.id, v_tipo, v_post, v_vit, v_mem, v_titulo, v_link, v_quando);
  return public.rede_p4_campanha(c.id);
end $$;

/** A mediação tira um item da linha do tempo. */
create or replace function public.rede_p4_campanha_tirar(p_item uuid) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid; i rede_p4_campanha_itens; c rede_p4_campanhas;
begin
  perform interno.alumia_porta();
  perform interno.rede_p4_ml_exige();
  v := interno.rede_p4_ml_membro();
  select * into i from rede_p4_campanha_itens where id = p_item;
  select * into c from rede_p4_campanhas where id = i.campanha;
  if i.id is null or not interno.rede_p4_ml_modera(c.comunidade, v) then perform interno.erro('nao_encontrado'); end if;
  delete from rede_p4_campanha_itens where id = p_item;
  return public.rede_p4_campanha(c.id);
end $$;

/** A mediação encerra (ou reabre) a campanha: encerrada, ela continua de pé como memória, só não recebe item novo na tela. */
create or replace function public.rede_p4_campanha_encerrar(p_id uuid, p_encerrada boolean) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid; c rede_p4_campanhas;
begin
  perform interno.alumia_porta();
  perform interno.rede_p4_ml_exige();
  v := interno.rede_p4_ml_membro();
  select * into c from rede_p4_campanhas where id = p_id;
  if not found or not interno.rede_p4_ml_modera(c.comunidade, v) then perform interno.erro('nao_encontrado'); end if;
  update rede_p4_campanhas set encerrada = coalesce(p_encerrada, true) where id = p_id;
  return public.rede_p4_campanha(p_id);
end $$;

/** As campanhas que a pessoa vê (de uma comunidade, ou de todas), e onde ela pode abrir uma (as que modera). */
create or replace function public.rede_p4_campanhas(p_comunidade text default null) returns jsonb language plpgsql stable security definer set search_path = interno, pg_temp as $$
declare v uuid; v_slug text := nullif(lower(btrim(coalesce(p_comunidade, ''))), '');
begin
  perform interno.alumia_porta();
  perform interno.rede_p4_ml_exige();
  v := interno.rede_p4_ml_membro();
  return jsonb_build_object(
    'campanhas', coalesce((select jsonb_agg(interno.rede_p4_campanha_json(c, v) order by c.encerrada, c.criada_em desc)
                             from (select * from rede_p4_campanhas k where (v_slug is null or k.comunidade = v_slug)
                                      and interno.rede_p4_ml_ve_comunidade(k.comunidade, v) order by k.criada_em desc limit 100) c), '[]'::jsonb),
    'posso_abrir', coalesce((select jsonb_agg(jsonb_build_object('slug', c.slug, 'nome', c.nome) order by c.nome)
                               from rede_comunidades c where interno.rede_p4_ml_modera(c.slug, v)
                                 and exists (select 1 from rede_comunidade_membros mm where mm.comunidade = c.slug and mm.usuario = v)), '[]'::jsonb));
end $$;

/** Uma campanha com a linha do tempo (da mais antiga para a mais nova), só com os itens que esta pessoa pode ver. */
create or replace function public.rede_p4_campanha(p_id uuid) returns jsonb language plpgsql stable security definer set search_path = interno, pg_temp as $$
declare v uuid; c rede_p4_campanhas;
begin
  perform interno.alumia_porta();
  perform interno.rede_p4_ml_exige();
  v := interno.rede_p4_ml_membro();
  select * into c from rede_p4_campanhas where id = p_id;
  if not found or not interno.rede_p4_ml_ve_comunidade(c.comunidade, v) then perform interno.erro('nao_encontrado'); end if;
  return interno.rede_p4_campanha_json(c, v) || jsonb_build_object(
    'linha', coalesce((select jsonb_agg(jsonb_build_object('id', i.id, 'tipo', i.tipo, 'titulo', i.titulo, 'quando', i.quando,
                                                           'post', i.post, 'link', i.link, 'vitoria', i.vitoria, 'memoria', i.memoria)
                                        order by i.quando, i.criado_em)
                         from rede_p4_campanha_itens i where i.campanha = c.id and interno.rede_p4_ml_item_ve(i, v)), '[]'::jsonb));
end $$;

-- ── 5. Podcast do núcleo ou da comunidade (119) ───────────────────────────────────────────────────────────────────────────

/** O episódio como a Alumia mostra: o post (para tocar o áudio pelo caminho de sempre), o título e as notas da mediação. */
create or replace function interno.rede_p4_episodio_json(e interno.rede_p4_episodios) returns jsonb language sql stable security definer set search_path = interno, pg_temp as $$
  select jsonb_build_object('id', e.id, 'post', e.post, 'titulo', e.titulo, 'notas', e.notas, 'numero', e.numero, 'criado_em', e.criado_em,
                            'duracao', (select a.duracao from rede_audios a where a.post = e.post))
$$;

/** A mediação cria o podcast da comunidade. p: {comunidade, slug, titulo, sobre}. */
create or replace function public.rede_p4_podcast_criar(p jsonb) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid; v_slug text := lower(btrim(coalesce(p ->> 'comunidade', ''))); v_nome text := lower(btrim(coalesce(p ->> 'slug', ''))); v_titulo text; v_sobre text; x rede_p4_podcasts;
begin
  perform interno.alumia_porta();
  perform interno.rede_p4_ml_exige();
  v := interno.rede_p4_ml_membro();
  if not interno.rede_p4_ml_modera(v_slug, v) then perform interno.erro('sem_permissao'); end if;
  if v_nome !~ '^[a-z0-9-]{3,40}$' then perform interno.erro('invalido:slug'); end if;
  if exists (select 1 from rede_p4_podcasts where slug = v_nome) then perform interno.erro('invalido:slug_usado'); end if;
  v_titulo := interno.rede_p4_ml_texto(p ->> 'titulo', 200);
  v_sobre := interno.rede_p4_ml_texto(p ->> 'sobre', 2000);
  if char_length(v_titulo) not between 3 and 80 then perform interno.erro('invalido:titulo'); end if;
  if char_length(v_sobre) > 1000 then perform interno.erro('invalido:texto'); end if;
  perform interno.limite('alumia_p4_podcast', 5, 1440);
  insert into rede_p4_podcasts (slug, comunidade, titulo, sobre) values (v_nome, v_slug, v_titulo, v_sobre) returning * into x;
  return public.rede_p4_podcast(x.slug);
end $$;

/**
 * A mediação põe um post com áudio como episódio. p: {podcast (slug), post, titulo, notas}. O post tem de ser da mesma comunidade,
 * ter áudio e não ser cifrado (o post cifrado não leva anexo, item 136).
 */
create or replace function public.rede_p4_episodio_por(p jsonb) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid; x rede_p4_podcasts; po rede_posts; v_post uuid; v_titulo text; v_notas text;
begin
  perform interno.alumia_porta();
  perform interno.rede_p4_ml_exige();
  v := interno.rede_p4_ml_membro();
  select * into x from rede_p4_podcasts where slug = lower(btrim(coalesce(p ->> 'podcast', '')));
  if not found or not interno.rede_p4_ml_modera(x.comunidade, v) then perform interno.erro('nao_encontrado'); end if;
  begin
    v_post := (p ->> 'post')::uuid;
  exception when others then perform interno.erro('nao_encontrado');
  end;
  select * into po from rede_posts where id = v_post and apagado_em is null;
  if po.id is null or po.comunidade is distinct from x.comunidade or not coalesce(interno.rede_ve(po, v), false) then perform interno.erro('nao_encontrado'); end if;
  if po.corpo_grupo is not null or not exists (select 1 from rede_audios a where a.post = po.id) then perform interno.erro('invalido:sem_audio'); end if;
  if exists (select 1 from rede_p4_episodios where podcast = x.id and post = po.id) then perform interno.erro('invalido:repetido'); end if;
  v_titulo := interno.rede_p4_ml_texto(p ->> 'titulo', 200);
  v_notas := interno.rede_p4_ml_texto(p ->> 'notas', 4000);
  if char_length(v_titulo) not between 3 and 120 then perform interno.erro('invalido:titulo'); end if;
  if char_length(v_notas) > 2000 then perform interno.erro('invalido:texto'); end if;
  perform interno.limite('alumia_p4_episodio', 30, 1440);
  insert into rede_p4_episodios (podcast, post, titulo, notas, numero)
  values (x.id, po.id, v_titulo, v_notas, coalesce((select max(numero) from rede_p4_episodios where podcast = x.id), 0) + 1);
  return public.rede_p4_podcast(x.slug);
end $$;

/** A mediação tira um episódio (o post continua onde está). */
create or replace function public.rede_p4_episodio_tirar(p_id uuid) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid; e rede_p4_episodios; x rede_p4_podcasts;
begin
  perform interno.alumia_porta();
  perform interno.rede_p4_ml_exige();
  v := interno.rede_p4_ml_membro();
  select * into e from rede_p4_episodios where id = p_id;
  select * into x from rede_p4_podcasts where id = e.podcast;
  if e.id is null or not interno.rede_p4_ml_modera(x.comunidade, v) then perform interno.erro('nao_encontrado'); end if;
  delete from rede_p4_episodios where id = p_id;
  return public.rede_p4_podcast(x.slug);
end $$;

/** Os podcasts que a pessoa vê e onde ela pode criar um (as comunidades que modera). */
create or replace function public.rede_p4_podcasts() returns jsonb language plpgsql stable security definer set search_path = interno, pg_temp as $$
declare v uuid;
begin
  perform interno.alumia_porta();
  perform interno.rede_p4_ml_exige();
  v := interno.rede_p4_ml_membro();
  return jsonb_build_object(
    'podcasts', coalesce((select jsonb_agg(jsonb_build_object('slug', x.slug, 'titulo', x.titulo, 'sobre', x.sobre, 'comunidade', x.comunidade,
                                                              'comunidade_nome', (select c.nome from rede_comunidades c where c.slug = x.comunidade),
                                                              'rss', exists (select 1 from rede_comunidades c where c.slug = x.comunidade and c.tipo = 'aberta' and c.slug not like 'fechado-%'))
                                           order by x.titulo)
                            from rede_p4_podcasts x where interno.rede_p4_ml_ve_comunidade(x.comunidade, v)), '[]'::jsonb),
    'posso_criar', coalesce((select jsonb_agg(jsonb_build_object('slug', c.slug, 'nome', c.nome) order by c.nome)
                               from rede_comunidades c where interno.rede_p4_ml_modera(c.slug, v)
                                 and exists (select 1 from rede_comunidade_membros mm where mm.comunidade = c.slug and mm.usuario = v)), '[]'::jsonb));
end $$;

/** Um podcast com os episódios que esta pessoa pode ouvir (o post visível pelo rede_ve), do mais novo para o mais antigo. */
create or replace function public.rede_p4_podcast(p_slug text) returns jsonb language plpgsql stable security definer set search_path = interno, pg_temp as $$
declare v uuid; x rede_p4_podcasts;
begin
  perform interno.alumia_porta();
  perform interno.rede_p4_ml_exige();
  v := interno.rede_p4_ml_membro();
  select * into x from rede_p4_podcasts where slug = lower(btrim(coalesce(p_slug, '')));
  if not found or not interno.rede_p4_ml_ve_comunidade(x.comunidade, v) then perform interno.erro('nao_encontrado'); end if;
  return jsonb_build_object(
    'slug', x.slug, 'titulo', x.titulo, 'sobre', x.sobre, 'comunidade', x.comunidade,
    'comunidade_nome', (select c.nome from rede_comunidades c where c.slug = x.comunidade),
    'rss', exists (select 1 from rede_comunidades c where c.slug = x.comunidade and c.tipo = 'aberta' and c.slug not like 'fechado-%'),
    'modero', interno.rede_p4_ml_modera(x.comunidade, v),
    'episodios', coalesce((select jsonb_agg(interno.rede_p4_episodio_json(e) order by e.numero desc)
                             from rede_p4_episodios e join rede_posts po on po.id = e.post
                            where e.podcast = x.id and po.apagado_em is null and not po.oculto and coalesce(interno.rede_ve(po, v), false)), '[]'::jsonb));
end $$;

/** O podcast pode sair para fora (RSS e áudio do visitante)? Interruptor ligado, sem a trava da entrada, comunidade aberta. */
create or replace function interno.rede_p4_podcast_sai(x interno.rede_p4_podcasts) returns boolean language sql stable security definer set search_path = interno, pg_temp as $$
  select x.id is not null and interno.rede_p4_ml_ligado() and not interno.alumia_exigida()
     and not exists (select 1 from recursos_vivos where nome = 'alumia-alcance' and not ligado)
     and exists (select 1 from rede_comunidades c where c.slug = x.comunidade and c.tipo = 'aberta' and c.slug not like 'fechado-%')
$$;

/**
 * O feed do podcast, para a rota do RSS (chamada como visitante). Nulo quando não existe ou não pode sair. Só os episódios cujo post
 * já pode sair da Alumia (interno.alumia_alc_sai). Nada de quem publicou além do nome da comunidade; nenhum número de quem ouve.
 */
create or replace function public.rede_p4_podcast_rss(p_slug text) returns jsonb language plpgsql stable security definer set search_path = interno, pg_temp as $$
declare x rede_p4_podcasts;
begin
  perform interno.alumia_porta();
  select * into x from rede_p4_podcasts where slug = lower(btrim(coalesce(p_slug, '')));
  if not found or not interno.rede_p4_podcast_sai(x) then return null; end if;
  return jsonb_build_object(
    'slug', x.slug, 'titulo', x.titulo, 'sobre', x.sobre, 'comunidade', x.comunidade,
    'comunidade_nome', (select c.nome from rede_comunidades c where c.slug = x.comunidade),
    'episodios', coalesce((select jsonb_agg(jsonb_build_object('id', e.id, 'titulo', e.titulo, 'notas', e.notas, 'numero', e.numero, 'criado_em', e.criado_em,
                                                              'duracao', a.duracao, 'tipo', a.tipo) order by e.numero desc)
                             from rede_p4_episodios e join rede_posts po on po.id = e.post join rede_audios a on a.post = po.id
                            where e.podcast = x.id and interno.alumia_alc_sai(po)), '[]'::jsonb));
end $$;

/**
 * O arquivo de áudio de um episódio que sai (para a rota que o entrega aos aplicativos de podcast). Nulo fora da regra do RSS. Só a
 * chave de serviço chama: o caminho do áudio do post começa pelo id da conta de quem gravou, e não pode ir a quem chama de fora; a
 * rota entrega os bytes pelo endereço dela.
 */
create or replace function public.rede_p4_podcast_audio(p_slug text, p_episodio uuid) returns jsonb language plpgsql stable security definer set search_path = interno, pg_temp as $$
declare x rede_p4_podcasts; v_r jsonb;
begin
  perform interno.alumia_porta();
  select * into x from rede_p4_podcasts where slug = lower(btrim(coalesce(p_slug, '')));
  if not found or not interno.rede_p4_podcast_sai(x) then return null; end if;
  select jsonb_build_object('bucket', 'rede-midia', 'caminho', a.caminho, 'tipo', a.tipo) into v_r
    from rede_p4_episodios e join rede_posts po on po.id = e.post join rede_audios a on a.post = po.id
   where e.id = p_episodio and e.podcast = x.id and interno.alumia_alc_sai(po);
  return v_r;
end $$;

-- ── 5b. As comunidades da própria pessoa (para a tela escolher onde ver e enviar) ─────────────────────────────────────────────

/**
 * As comunidades de que a própria pessoa é membro ativo, com o nome e se ela modera. Só as dela: não diz quem mais está em cada uma
 * nem quantas pessoas são.
 */
create or replace function public.rede_p4_ml_minhas() returns jsonb language plpgsql stable security definer set search_path = interno, pg_temp as $$
declare v uuid;
begin
  perform interno.alumia_porta();
  perform interno.rede_p4_ml_exige();
  v := interno.rede_p4_ml_membro();
  return coalesce((select jsonb_agg(jsonb_build_object('slug', c.slug, 'nome', c.nome, 'modero', interno.rede_p4_ml_modera(c.slug, v)) order by c.nome)
                     from rede_comunidades c where interno.rede2_na_comunidade(c.slug, v)), '[]'::jsonb);
end $$;

-- ── 6. Permissões ─────────────────────────────────────────────────────────────────────────────────────────────────────────
do $$
declare f text;
  v_internas text[] := array['rede_p4_ml_ligado()', 'rede_p4_ml_exige()', 'rede_p4_ml_membro()', 'rede_p4_ml_ve_comunidade(text, uuid)', 'rede_p4_ml_modera(text, uuid)',
    'rede_p4_ml_texto(text, integer)', 'rede_p4_ml_link(text)', 'rede_p4_ml_data(text)', 'rede_p4_memoria_json(interno.rede_p4_memorias, uuid)',
    'rede_p4_vitoria_json(interno.rede_p4_vitorias, uuid)', 'rede_p4_campanha_json(interno.rede_p4_campanhas, uuid)',
    'rede_p4_ml_item_ve(interno.rede_p4_campanha_itens, uuid)', 'rede_p4_episodio_json(interno.rede_p4_episodios)', 'rede_p4_podcast_sai(interno.rede_p4_podcasts)'];
  v_pessoa text[] := array['rede_p4_memoria_enviar(jsonb)', 'rede_p4_memoria_enviada(uuid)', 'rede_p4_memorias(text)', 'rede_p4_memoria_decidir(uuid, boolean)',
    'rede_p4_memoria_sair(uuid, text)', 'rede_p4_memoria_apagar(uuid)', 'rede_p4_memoria_foto(uuid)', 'rede_p4_vitoria_registrar(jsonb)',
    'rede_p4_vitoria_tirar(uuid)', 'rede_p4_vitorias(text)', 'rede_p4_campanha_criar(jsonb)', 'rede_p4_campanha_por(jsonb)', 'rede_p4_campanha_tirar(uuid)',
    'rede_p4_campanha_encerrar(uuid, boolean)', 'rede_p4_campanhas(text)', 'rede_p4_campanha(uuid)', 'rede_p4_podcast_criar(jsonb)', 'rede_p4_episodio_por(jsonb)',
    'rede_p4_episodio_tirar(uuid)', 'rede_p4_podcasts()', 'rede_p4_podcast(text)', 'rede_p4_ml_minhas()'];
  v_visitante text[] := array['rede_p4_podcast_rss(text)', 'rede_p4_memoria_foto_pode(text)'];
  -- Só a chave de serviço (as rotas do site): o caminho do áudio leva o id da conta de quem gravou e nunca vai a quem chama de fora.
  v_servico text[] := array['rede_p4_podcast_audio(text, uuid)', 'rede_p4_memoria_orfas(integer)'];
begin
  foreach f in array v_internas loop
    execute format('revoke all on function interno.%s from public', f);
    if exists (select 1 from pg_roles where rolname = 'anon') then execute format('revoke all on function interno.%s from anon, authenticated', f); end if;
  end loop;
  foreach f in array v_pessoa || v_visitante || v_servico loop
    execute format('revoke all on function public.%s from public', f);
  end loop;
  if exists (select 1 from pg_roles where rolname = 'anon') then
    foreach f in array v_pessoa loop
      execute format('revoke all on function public.%s from anon', f);
      execute format('grant execute on function public.%s to authenticated, service_role', f);
    end loop;
    foreach f in array v_visitante loop
      execute format('grant execute on function public.%s to anon, authenticated, service_role', f);
    end loop;
    foreach f in array v_servico loop
      execute format('revoke all on function public.%s from anon, authenticated', f);
      execute format('grant execute on function public.%s to service_role', f);
    end loop;
  end if;
end $$;

select interno.alumia_trancar();
