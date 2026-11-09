-- Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
--
-- ═══════════════════════════ Alumia · Onda 5 · F2 · atos (back-end mínimo, 09/11/2026) ═══════════════════════════
-- docs/plano-2026-11/PLANO-ALUMIA.md, seções 5 (F2), 6 e 8. O contrato é o de lib/rede/tipos-atos.ts (as telas já usam o dublê
-- com estes nomes). Idempotente: pode rodar duas vezes (scripts/testar-alumia-f2.mjs roda duas vezes no banco local). Vem DEPOIS
-- da F0 (20261109-alumia-f0-contrato.sql). NÃO está no install.sql: o integrador cola. NÃO rodar em produção sem o Jonathan.
--
-- O que faz (só o mínimo para cada função da tela funcionar de verdade; tarefas, caronas, álbum, petição e mapa ficam para depois):
--   1. Reaproveita o chamado que já existe: interno.rede_chamados ganha situacao (confirmado/adiado/cancelado, migrado de
--      `cancelado`), inicio_anterior ("era 12/11"), titulo, palavra (a do mosaico, ^[A-Z ]{2,14}$), meta, link_apoio (só https),
--      motivo e mudado_em. Os chamados da Rede de hoje (o JSON rede_posts.chamado) ganham a linha deles em rede_chamados, sem
--      perder nada: o JSON e a coluna `cancelado` continuam lá e continuam certos. "Eu vou" é o mesmo rede_vou de sempre.
--   2. Funções (todas security definer, search_path fixo, com a checagem de quem chama, limite de uso e a matriz de visibilidade
--      interno.rede_ve): rede_ato_publicar, rede_atos, rede_ato, rede_ato_proximo, rede_ato_vou e rede_ato_mudar.
--
-- Privacidade (LGPD, Lei 13.709/2018, conferida no texto: art. 5º, II e art. 11 — ir a um ato revela opinião política, dado
-- pessoal sensível; art. 6º, III — necessidade; art. 46 — segurança):
--   - nenhuma função devolve quem confirmou; o mosaico recebe só a PROPORÇÃO (passos de 10 %, nula abaixo de 3 confirmações);
--   - o número exato de confirmações sai só para quem organizou (como já era no rede_vou de hoje);
--   - "Perto" é a cidade ESCRITA (texto), nunca posição do aparelho; o ato traz só o ponto público dele;
--   - o aviso de mudança vai só a quem confirmou, e nunca diz a ninguém quem mais confirmou;
--   - os limites de uso guardam a chave por conta ou pelo endereço CIFRADO (interno.origem), nunca o IP cru.
-- ECA (Lei 8.069/1990) e ECA Digital (Lei 15.211/2025): a Alumia é só 18+ (interno.rede2_membro exige rede_18), então confirmar
-- presença e chamar ato só existem para membro adulto; visitante só LÊ o que já é público na internet.

-- ── 1. Tabela do chamado ────────────────────────────────────────────────────────────────────────────────────────────────────
alter table interno.rede_chamados add column if not exists situacao text not null default 'confirmado';
alter table interno.rede_chamados add column if not exists inicio_anterior timestamptz;
alter table interno.rede_chamados add column if not exists titulo text;
alter table interno.rede_chamados add column if not exists palavra text;
alter table interno.rede_chamados add column if not exists meta smallint;
alter table interno.rede_chamados add column if not exists link_apoio text;
alter table interno.rede_chamados add column if not exists motivo text not null default '';
alter table interno.rede_chamados add column if not exists mudado_em timestamptz;
-- Os chamados da Rede de hoje não pediam cidade: sem ela o ato só não entra em "Perto" (o check de tamanho continua valendo).
alter table interno.rede_chamados alter column cidade drop not null;
do $$
begin
  if not exists (select 1 from pg_constraint where conrelid = 'interno.rede_chamados'::regclass and conname = 'rede_chamados_situacao') then
    alter table interno.rede_chamados add constraint rede_chamados_situacao check (situacao in ('confirmado', 'adiado', 'cancelado'));
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'interno.rede_chamados'::regclass and conname = 'rede_chamados_palavra') then
    alter table interno.rede_chamados add constraint rede_chamados_palavra check (palavra is null or palavra ~ '^[A-Z ]{2,14}$');
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'interno.rede_chamados'::regclass and conname = 'rede_chamados_titulo') then
    alter table interno.rede_chamados add constraint rede_chamados_titulo check (titulo is null or char_length(titulo) between 2 and 60);
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'interno.rede_chamados'::regclass and conname = 'rede_chamados_meta') then
    alter table interno.rede_chamados add constraint rede_chamados_meta check (meta is null or meta between 3 and 30000);
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'interno.rede_chamados'::regclass and conname = 'rede_chamados_link_apoio') then
    alter table interno.rede_chamados add constraint rede_chamados_link_apoio check (link_apoio is null or (link_apoio ~ '^https://[^\s<>"'']{4,}$' and char_length(link_apoio) <= 300));
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'interno.rede_chamados'::regclass and conname = 'rede_chamados_motivo') then
    alter table interno.rede_chamados add constraint rede_chamados_motivo check (char_length(motivo) <= 140);
  end if;
  -- Só adiado guarda a data de antes junto com uma data nova.
  if not exists (select 1 from pg_constraint where conrelid = 'interno.rede_chamados'::regclass and conname = 'rede_chamados_anterior') then
    alter table interno.rede_chamados add constraint rede_chamados_anterior check (inicio_anterior is null or inicio_anterior <> inicio);
  end if;
end $$;
alter table interno.rede_chamados enable row level security;
revoke all on table interno.rede_chamados from public;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on table interno.rede_chamados from anon, authenticated;
    revoke all on table interno.rede_vou from anon, authenticated;
  end if;
end $$;
create index if not exists rede_chamados_inicio on interno.rede_chamados (inicio, post);
create index if not exists rede_vou_usuario on interno.rede_vou (usuario);

-- ── 2. Regras puras ─────────────────────────────────────────────────────────────────────────────────────────────────────────

/** A palavra do mosaico: a MESMA regra de lib/rede/mosaico.ts (normalizarPalavra): maiúsculas sem acento, só A–Z e espaço, até 14. */
create or replace function interno.rede_ato_palavra(p_texto text) returns text language sql immutable set search_path = interno, pg_temp as $$
  select btrim(left(btrim(regexp_replace(regexp_replace(upper(translate(coalesce(p_texto, ''),
    'áàâãäåéèêëíìîïóòôõöúùûüçñýÿÁÀÂÃÄÅÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇÑÝ',
    'aaaaaaeeeeiiiiooooouuuucnyyAAAAAAEEEEIIIIOOOOOUUUUCNY')), '[^A-Z ]', ' ', 'g'), '\s+', ' ', 'g')), 14))
$$;

/** A chave da cidade para "Perto": minúsculas, sem acento e com espaços simples ("São  Paulo" = "sao paulo"). Nada de posição. */
create or replace function interno.rede_ato_cidade(p_texto text) returns text language sql immutable set search_path = interno, pg_temp as $$
  select nullif(lower(btrim(regexp_replace(translate(coalesce(p_texto, ''),
    'áàâãäåéèêëíìîïóòôõöúùûüçñýÿÁÀÂÃÄÅÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇÑÝ',
    'aaaaaaeeeeiiiiooooouuuucnyyAAAAAAEEEEIIIIOOOOOUUUUCNY'), '\s+', ' ', 'g'))), '')
$$;
create index if not exists rede_chamados_cidade on interno.rede_chamados (interno.rede_ato_cidade(cidade), inicio);

/**
 * A proporção acesa do mosaico: a MESMA regra de lib/rede/mosaico.ts (proporcaoDoMosaico). Nula abaixo de 3 confirmações (agregado
 * só a partir de 3, docs/rede/PRIVACIDADE.md §8); senão confirmados ÷ max(30, meta), PARA BAIXO em passos de 10 %, entre 10 % e 100 %.
 */
create or replace function interno.rede_ato_proporcao(p_confirmados bigint, p_meta integer) returns numeric language sql immutable set search_path = interno, pg_temp as $$
  select case when p_confirmados is null or p_confirmados < 3 then null
    else round(least(10, greatest(1, floor(p_confirmados::numeric * 10 / greatest(30, coalesce(p_meta, 0)))))::numeric / 10, 1) end
$$;

-- ── 3. O chamado de antes ganha a linha dele (sem perder dado) ──────────────────────────────────────────────────────────────
-- (a) quem já estava marcado como cancelado vira situacao 'cancelado' (a coluna `cancelado` continua lá e certa);
update interno.rede_chamados set situacao = 'cancelado' where cancelado and situacao = 'confirmado';
-- (b) os chamados da Rede de hoje (o JSON no post) entram em rede_chamados com a data, o ponto e o tipo deles. O que não cabe nas
--     regras (sem data, ponto curto) fica só no JSON, como sempre esteve. A cidade fica vazia (a Rede de hoje não perguntava).
insert into interno.rede_chamados (post, inicio, ponto, tipo)
select p.id, (p.chamado ->> 'quando')::timestamptz, left(btrim(p.chamado ->> 'onde'), 140),
       case when p.chamado ->> 'tipo' in ('ato', 'assembleia', 'roda', 'mutirao', 'aula', 'outro') then p.chamado ->> 'tipo' else 'ato' end
  from interno.rede_posts p
 where p.chamado is not null and jsonb_typeof(p.chamado) = 'object'
   and coalesce(p.chamado ->> 'quando', '') ~ '^\d{4}-\d{2}-\d{2}'
   and char_length(btrim(coalesce(p.chamado ->> 'onde', ''))) >= 3
   and not exists (select 1 from interno.rede_chamados c where c.post = p.id)
on conflict (post) do nothing;

-- ── 4. O ato como a tela recebe (lib/rede/tipos-atos.ts, Ato) ───────────────────────────────────────────────────────────────

/**
 * O ato em JSON para quem lê (p_quem; nulo = visitante). Quem chama JÁ conferiu que p_quem vê o post. Nunca a lista de quem
 * confirmou: `acesos` é a proporção e `total` só sai para quem organizou (ou para quem age como a organização, interno.rede_age_como).
 */
create or replace function interno.rede_ato_json(p interno.rede_posts, c interno.rede_chamados, p_quem uuid) returns jsonb
language plpgsql stable security definer set search_path = interno, pg_temp as $$
declare
  v_titulo text := coalesce(c.titulo, nullif(p.titulo, ''), left(btrim(split_part(p.texto, E'\n', 1)), 60));
  v_palavra text := coalesce(c.palavra, nullif(interno.rede_ato_palavra(v_titulo), ''));
  v_n bigint := (select count(*) from rede_vou v where v.post = p.id);
  v_meu boolean := p_quem is not null and interno.rede_age_como(p_quem, p.autor);
  f perfis;
  k rede_comunidades;
begin
  select * into f from perfis where id = p.autor;
  if p.comunidade is not null then select * into k from rede_comunidades where slug = p.comunidade; end if;
  if v_palavra is null or char_length(replace(v_palavra, ' ', '')) < 2 then v_palavra := 'ATO'; end if;
  return jsonb_build_object(
    'id', p.id,
    'titulo', coalesce(nullif(v_titulo, ''), v_palavra),
    'palavra', v_palavra,
    'comunidade', case when p.comunidade is null then null else jsonb_build_object('slug', p.comunidade, 'nome', coalesce(k.nome, p.comunidade), 'cor', null) end,
    -- Só o @nome público (ou o codinome, se o perfil é invisível); nunca o nome civil.
    'chamado_por', case when f.id is null then null
                        when coalesce(f.rede_modo = 'invisivel' or f.rede_invisivel, false) or f.rede_handle is null then interno.rede_nome(p.autor)
                        else f.rede_handle end,
    'inicio', c.inicio,
    'inicio_anterior', c.inicio_anterior,
    'onde', c.ponto,
    'cidade', coalesce(c.cidade, ''),
    'descricao', p.texto,
    'situacao', c.situacao,
    'motivo', coalesce(c.motivo, ''),
    'acesos', interno.rede_ato_proporcao(v_n, c.meta),
    'total', case when v_meu then v_n end,
    'vou_eu', p_quem is not null and exists (select 1 from rede_vou v where v.post = p.id and v.usuario = p_quem),
    'meu', v_meu,
    'respostas', interno.rede2_respostas_visiveis(p.id, p_quem),
    'link_apoio', c.link_apoio);
end $$;

/** O ato, se esta pessoa pode vê-lo (matriz interno.rede_ve: bloqueio, público, comunidade fechada, retido, apagado). */
create or replace function interno.rede_ato_achar(p_id uuid, p_quem uuid) returns interno.rede_posts
language plpgsql stable security definer set search_path = interno, pg_temp as $$
declare p rede_posts;
begin
  select * into p from rede_posts where id = p_id;
  if not found or not exists (select 1 from rede_chamados c where c.post = p_id) or not interno.rede_ve(p, p_quem)
     or (p.apagado_em is not null and p.autor is distinct from p_quem) then
    perform interno.erro('nao_encontrado');
  end if;
  return p;
end $$;

-- ── 5. Chamar um ato ────────────────────────────────────────────────────────────────────────────────────────────────────────

/**
 * Chama um ato. Publica o post pelo rede_publicar de sempre (todas as conferências dele valem: membro 18+, consentimento, codinome,
 * limite, dado pessoal, comunidade, público, triagem) e, na MESMA transação, grava o chamado. Campos de p: titulo (2–60), palavra
 * (opcional; sai do título pela regra do mosaico), inicio (ISO, no futuro, até 365 dias), onde (3–140, o ponto PÚBLICO), cidade
 * (2–80), descricao (1–500, o texto do post), comunidade, publico, tipo ('ato' padrão; 'assembleia', 'roda', 'mutirao'), meta
 * (3–30000, opcional), link_apoio (só https, opcional). Devolve o Ato.
 */
create or replace function public.rede_ato_publicar(p jsonb) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare
  v uuid := interno.eu();
  v_titulo text; v_palavra text; v_inicio timestamptz; v_ponto text; v_cidade text; v_link text; v_meta integer;
  v_tipo text := coalesce(nullif(btrim(p ->> 'tipo'), ''), 'ato');
  v_post jsonb; v_tri jsonb; x rede_posts; c rede_chamados;
begin
  perform interno.aberta('comunidade');
  if p is null or jsonb_typeof(p) is distinct from 'object' then perform interno.erro('invalido:ato'); end if;
  if not interno.rede2_membro(v) then perform interno.erro('consentimento'); end if;
  if v_tipo not in ('ato', 'assembleia', 'roda', 'mutirao') then perform interno.erro('invalido:tipo'); end if;
  v_titulo := regexp_replace(interno.txt(p ->> 'titulo', 'titulo', 2, 60), '\s+', ' ', 'g');
  v_palavra := interno.rede_ato_palavra(coalesce(nullif(btrim(p ->> 'palavra'), ''), v_titulo));
  if v_palavra !~ '^[A-Z ]{2,14}$' or char_length(replace(v_palavra, ' ', '')) < 2 then perform interno.erro('invalido:palavra'); end if;
  begin
    v_inicio := (p ->> 'inicio')::timestamptz;
    v_meta := nullif(p ->> 'meta', '')::integer;
  exception when others then perform interno.erro('invalido:inicio');
  end;
  if v_inicio is null or v_inicio <= now() or v_inicio > now() + interval '365 days' then perform interno.erro('invalido:inicio'); end if;
  if v_meta is not null and v_meta not between 3 and 30000 then perform interno.erro('invalido:meta'); end if;
  v_ponto := regexp_replace(interno.txt(p ->> 'onde', 'onde', 3, 140), '\s+', ' ', 'g');
  v_cidade := regexp_replace(interno.txt(p ->> 'cidade', 'cidade', 2, 80), '\s+', ' ', 'g');
  v_link := nullif(btrim(coalesce(p ->> 'link_apoio', '')), '');
  if v_link is not null and (v_link !~ '^https://[^\s<>"'']{4,}$' or char_length(v_link) > 300) then perform interno.erro('invalido:link_apoio'); end if;
  -- Dado pessoal no nome, no ponto e na cidade (CPF, telefone, e-mail). O ponto PODE ter número: é o endereço público do ato.
  if interno.rede3_pub_dado_pessoal(v_titulo || ' ' || v_cidade)
     or (v_ponto || ' ' || coalesce(v_link, '')) ~ '\d{3}\.?\d{3}\.?\d{3}-?\d{2}|\(?\d{2}\)?\s?9\d{4}[-\s]?\d{4}'
     or v_ponto ~* '[a-z0-9._%+-]+@[a-z0-9-]+\.[a-z.]{2,}' then
    perform interno.erro('dado_pessoal');
  end if;
  perform interno.limite('alumia_ato_chamar', 10, 1440);

  v_post := public.rede_publicar(jsonb_strip_nulls(jsonb_build_object('tipo', 'post', 'texto', p ->> 'descricao',
    'comunidade', nullif(btrim(coalesce(p ->> 'comunidade', '')), ''), 'publico', nullif(btrim(coalesce(p ->> 'publico', '')), ''))));
  select * into x from rede_posts where id = (v_post ->> 'id')::uuid and autor = v;
  if not found then perform interno.erro('invalido:ato'); end if;

  -- A triagem também lê o nome e o ponto; um veredito mais duro que o do texto retém o post (nunca afrouxa o que o texto já reteve).
  v_tri := interno.rede_triagem(v_titulo || ' ' || v_ponto || ' ' || v_cidade, v);
  -- O JSON de antes continua sendo escrito: a Rede de hoje (flags desligadas) segue mostrando o chamado como sempre mostrou.
  update rede_posts set tipo = 'chamado', titulo = v_titulo,
         chamado = jsonb_build_object('tipo', v_tipo, 'quando', v_inicio, 'onde', v_ponto),
         oculto = oculto or (v_tri ->> 'veredito') <> 'publicar',
         retido = retido or (v_tri ->> 'veredito') = 'revisar',
         motivo = case when not (oculto or retido) and (v_tri ->> 'veredito') <> 'publicar' then coalesce(v_tri ->> 'motivo', '') else motivo end
   where id = x.id returning * into x;
  insert into rede_chamados (post, inicio, cidade, ponto, tipo, link, titulo, palavra, meta, link_apoio)
  values (x.id, v_inicio, v_cidade, v_ponto, v_tipo, null, v_titulo, v_palavra, v_meta, v_link)
  returning * into c;
  return interno.rede_ato_json(x, c, v);
end $$;

-- ── 6. Ler ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────

/**
 * Uma página de atos, do mais próximo no tempo para o mais longe (só os que não acabaram: começo há menos de 6 h). Filtros:
 * 'perto' (pela cidade ESCRITA em p_cidade; sem cidade, página vazia), 'seguindo' (de quem a pessoa segue, das comunidades em que
 * está ou que segue, e os que ela confirmou; pede conta). p_comunidade (opcional) restringe a uma comunidade. Visitante só vê o
 * que já é público na internet. Cursor = "<início ISO>|<id>". Devolve {itens, proximo}.
 */
create or replace function public.rede_atos(p_filtro text, p_cidade text default null, p_comunidade text default null, p_cursor text default null, p_limite integer default 20)
returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare
  v uuid := auth.uid();
  v_lim integer := least(greatest(coalesce(p_limite, 20), 1), 40);
  v_cidade text := interno.rede_ato_cidade(left(p_cidade, 80));
  v_com text := nullif(btrim(coalesce(p_comunidade, '')), '');
  v_c_inicio timestamptz; v_c_id uuid;
  v_ids uuid[]; v_itens jsonb; u rede_chamados;
begin
  perform interno.aberta('comunidade');
  if v is not null and exists (select 1 from perfis where id = v and suspenso) then perform interno.erro('conta_suspensa'); end if;
  if p_filtro is null or p_filtro not in ('perto', 'seguindo') then perform interno.erro('invalido:filtro'); end if;
  if p_filtro = 'seguindo' and v is null and v_com is null then perform interno.erro('entre_primeiro'); end if;
  if v_com is not null and v_com !~ '^[a-z0-9-]{2,60}$' then perform interno.erro('invalido:comunidade'); end if;
  perform interno.limite('alumia_atos_ler', 300, 60);
  if nullif(p_cursor, '') is not null then
    begin
      v_c_inicio := split_part(p_cursor, '|', 1)::timestamptz;
      v_c_id := split_part(p_cursor, '|', 2)::uuid;
    exception when others then perform interno.erro('invalido:cursor');
    end;
  end if;
  if p_filtro = 'perto' and v_cidade is null and v_com is null then return jsonb_build_object('itens', '[]'::jsonb, 'proximo', null); end if;

  select array_agg(z.post order by z.inicio, z.post) into v_ids from (
    select c.post, c.inicio
      from rede_chamados c join rede_posts p on p.id = c.post
     where c.inicio > now() - interval '6 hours'
       and (v_c_inicio is null or (c.inicio, c.post) > (v_c_inicio, v_c_id))
       and (v_com is null or p.comunidade = v_com)
       and (p_filtro <> 'perto' or v_com is not null or interno.rede_ato_cidade(c.cidade) = v_cidade)
       and (p_filtro <> 'seguindo' or v_com is not null or p.autor = v
            or exists (select 1 from rede_seguindo s where s.quem = v and s.segue = p.autor and not s.pendente)
            or (p.comunidade is not null and (interno.rede2_na_comunidade(p.comunidade, v)
                or exists (select 1 from rede_comunidades_seguidas g where g.usuario = v and g.comunidade = p.comunidade)))
            or exists (select 1 from rede_vou o where o.post = p.id and o.usuario = v))
       and p.apagado_em is null
       and interno.rede_ve(p, v)
       and not interno.rede_silenciado(p, v)
     order by c.inicio, c.post
     limit v_lim + 1) z;

  select coalesce(jsonb_agg(interno.rede_ato_json(p, c, v) order by c.inicio, c.post), '[]'::jsonb) into v_itens
    from rede_chamados c join rede_posts p on p.id = c.post
   where c.post = any (coalesce(v_ids[1:v_lim], '{}'::uuid[]));
  if coalesce(cardinality(v_ids), 0) > v_lim then
    select * into u from rede_chamados where post = v_ids[v_lim];
    return jsonb_build_object('itens', v_itens, 'proximo', to_char(u.inicio at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') || '|' || u.post::text);
  end if;
  return jsonb_build_object('itens', v_itens, 'proximo', null);
end $$;

/** Um ato (a página do ato). Visitante só se o post é público na internet. */
create or replace function public.rede_ato(p_id uuid) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := auth.uid(); p rede_posts; c rede_chamados;
begin
  perform interno.aberta('comunidade');
  if v is not null and exists (select 1 from perfis where id = v and suspenso) then perform interno.erro('conta_suspensa'); end if;
  perform interno.limite('alumia_atos_ler', 300, 60);
  p := interno.rede_ato_achar(p_id, v);
  select * into c from rede_chamados where post = p_id;
  return interno.rede_ato_json(p, c, v);
end $$;

/**
 * O próximo ato da pessoa (a faixa PRÓXIMO ATO): o primeiro que ela confirmou e não foi cancelado; senão, o primeiro de quem ela
 * segue ou das comunidades dela. Nulo para visitante e quando não há.
 */
create or replace function public.rede_ato_proximo() returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := auth.uid(); p rede_posts; c rede_chamados;
begin
  if v is null or not interno.rede2_membro(v) then return null; end if;
  perform interno.aberta('comunidade');
  perform interno.limite('alumia_atos_ler', 300, 60);
  select pp.* into p from rede_chamados cc join rede_posts pp on pp.id = cc.post
   where cc.situacao <> 'cancelado' and cc.inicio > now() - interval '2 hours' and pp.apagado_em is null
     and exists (select 1 from rede_vou o where o.post = pp.id and o.usuario = v)
     and interno.rede_ve(pp, v)
   order by cc.inicio, cc.post limit 1;
  if not found then
    select pp.* into p from rede_chamados cc join rede_posts pp on pp.id = cc.post
     where cc.situacao <> 'cancelado' and cc.inicio > now() and pp.apagado_em is null
       and (pp.autor = v or exists (select 1 from rede_seguindo s where s.quem = v and s.segue = pp.autor and not s.pendente)
            or (pp.comunidade is not null and (interno.rede2_na_comunidade(pp.comunidade, v)
                or exists (select 1 from rede_comunidades_seguidas g where g.usuario = v and g.comunidade = pp.comunidade))))
       and interno.rede_ve(pp, v) and not interno.rede_silenciado(pp, v)
     order by cc.inicio, cc.post limit 1;
    if not found then return null; end if;
  end if;
  select * into c from rede_chamados where post = p.id;
  return interno.rede_ato_json(p, c, v);
end $$;

-- ── 7. "Você vai" ───────────────────────────────────────────────────────────────────────────────────────────────────────────

/**
 * Confirma (p_sim true) ou desfaz. Só membro da Rede (18+, consentimento) que vê o ato; ato cancelado ou que já passou não recebe
 * confirmação nova (desfazer sempre pode). Devolve {vou_eu, acesos, total}: a proporção nova e, só para quem organizou, o total.
 */
create or replace function public.rede_ato_vou(p_id uuid, p_sim boolean) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); p rede_posts; c rede_chamados; v_n bigint;
begin
  perform interno.aberta('comunidade');
  if not interno.rede2_membro(v) then perform interno.erro('consentimento'); end if;
  perform interno.rede2_limite('reagir');
  p := interno.rede_ato_achar(p_id, v);
  select * into c from rede_chamados where post = p_id for update;
  if coalesce(p_sim, true) then
    if c.situacao = 'cancelado' then perform interno.erro('ato_cancelado'); end if;
    if c.inicio < now() - interval '6 hours' then perform interno.erro('ato_passou'); end if;
    if p.oculto or p.retido or p.apagado_em is not null then perform interno.erro('nao_encontrado'); end if;
    insert into rede_vou (post, usuario) values (p_id, v) on conflict do nothing;
  else
    delete from rede_vou where post = p_id and usuario = v;
  end if;
  select count(*) into v_n from rede_vou where post = p_id;
  return jsonb_build_object('vou_eu', coalesce(p_sim, true), 'acesos', interno.rede_ato_proporcao(v_n, c.meta),
    'total', case when interno.rede_age_como(v, p.autor) then v_n end);
end $$;

-- ── 8. Adiar, cancelar, confirmar de novo ───────────────────────────────────────────────────────────────────────────────────

/**
 * Só quem organizou (ou quem age como a organização). 'adiado' pede p_inicio (no futuro, até 365 dias, diferente da data atual) e
 * guarda a data de ANTES ("era 12/11": a primeira, se adiar duas vezes); 'cancelado' e 'confirmado' mantêm a data. p_motivo até 140
 * (sem dado pessoal). Quando muda alguma coisa, avisa SÓ quem confirmou (tipo 'chamado' nos avisos; quem desligou "ato_mudou" no
 * site não recebe), com um texto sem o nome de ninguém. Devolve o Ato.
 */
create or replace function public.rede_ato_mudar(p_id uuid, p_situacao text, p_inicio timestamptz default null, p_motivo text default '')
returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare
  v uuid := interno.eu(); p rede_posts; c rede_chamados; d rede_chamados;
  v_motivo text := regexp_replace(btrim(coalesce(p_motivo, '')), '\s+', ' ', 'g');
  v_texto text; r record;
begin
  perform interno.aberta('comunidade');
  if not interno.rede2_membro(v) then perform interno.erro('consentimento'); end if;
  p := interno.rede_ato_achar(p_id, v);
  if not interno.rede_age_como(v, p.autor) then perform interno.erro('so_quem_organizou'); end if;
  if p_situacao is null or p_situacao not in ('confirmado', 'adiado', 'cancelado') then perform interno.erro('invalido:situacao'); end if;
  if char_length(v_motivo) > 140 then perform interno.erro('invalido:motivo'); end if;
  if interno.rede3_pub_dado_pessoal(v_motivo) then perform interno.erro('dado_pessoal'); end if;
  perform interno.limite('alumia_ato_mudar', 20, 60);
  select * into c from rede_chamados where post = p_id for update;

  if p_situacao = 'adiado' then
    if p_inicio is null or p_inicio <= now() or p_inicio > now() + interval '365 days' or p_inicio = c.inicio then perform interno.erro('invalido:inicio'); end if;
    update rede_chamados set situacao = 'adiado', inicio_anterior = coalesce(inicio_anterior, inicio), inicio = p_inicio,
           cancelado = false, motivo = v_motivo, mudado_em = now()
     where post = p_id returning * into d;
    -- Se a data nova é a mesma "de antes", não sobra "era …" para mostrar.
    if d.inicio_anterior = d.inicio then update rede_chamados set inicio_anterior = null where post = p_id returning * into d; end if;
    update rede_posts set chamado = jsonb_set(coalesce(chamado, '{}'::jsonb), '{quando}', to_jsonb(p_inicio)) where id = p_id;
  elsif p_situacao = 'cancelado' then
    update rede_chamados set situacao = 'cancelado', cancelado = true, motivo = v_motivo, mudado_em = now() where post = p_id returning * into d;
  else
    update rede_chamados set situacao = 'confirmado', cancelado = false, motivo = '', mudado_em = now() where post = p_id returning * into d;
  end if;

  if d.situacao is distinct from c.situacao or d.inicio is distinct from c.inicio then
    v_texto := case d.situacao when 'adiado' then 'Um ato que você confirmou mudou de data.'
                               when 'cancelado' then 'Um ato que você confirmou foi cancelado.'
                               else 'Um ato que você confirmou está confirmado de novo.' end;
    for r in select o.usuario from rede_vou o where o.post = p_id and o.usuario <> p.autor and o.usuario <> v loop
      if interno.rede2_membro(r.usuario) and interno.rede3_aviso_pref(r.usuario, 'ato_mudou', 'site') and interno.rede_ve(p, r.usuario) then
        perform interno.rede3_aviso_criar(r.usuario, 'chamado', p_id, null, null, v_texto);
      end if;
    end loop;
  end if;
  select * into p from rede_posts where id = p_id;
  return interno.rede_ato_json(p, d, v);
end $$;

-- ── 9. Permissões ───────────────────────────────────────────────────────────────────────────────────────────────────────────
revoke all on function interno.rede_ato_palavra(text), interno.rede_ato_cidade(text), interno.rede_ato_proporcao(bigint, integer),
  interno.rede_ato_json(interno.rede_posts, interno.rede_chamados, uuid), interno.rede_ato_achar(uuid, uuid) from public;
revoke all on function public.rede_ato_publicar(jsonb), public.rede_atos(text, text, text, text, integer), public.rede_ato(uuid),
  public.rede_ato_proximo(), public.rede_ato_vou(uuid, boolean), public.rede_ato_mudar(uuid, text, timestamptz, text) from public;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on function interno.rede_ato_palavra(text), interno.rede_ato_cidade(text), interno.rede_ato_proporcao(bigint, integer),
      interno.rede_ato_json(interno.rede_posts, interno.rede_chamados, uuid), interno.rede_ato_achar(uuid, uuid) from anon, authenticated;
    revoke all on function public.rede_ato_publicar(jsonb), public.rede_ato_vou(uuid, boolean), public.rede_ato_mudar(uuid, text, timestamptz, text) from anon;
    -- Ler: visitante também (a função só devolve o que é público na internet para quem não entrou).
    grant execute on function public.rede_atos(text, text, text, text, integer), public.rede_ato(uuid), public.rede_ato_proximo() to anon, authenticated, service_role;
    grant execute on function public.rede_ato_publicar(jsonb), public.rede_ato_vou(uuid, boolean), public.rede_ato_mudar(uuid, text, timestamptz, text) to authenticated, service_role;
  end if;
end $$;

-- ═══════════════════════════ fim da F2 (atos, back-end mínimo) ═══════════════════════════
