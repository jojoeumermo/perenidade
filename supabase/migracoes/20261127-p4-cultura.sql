-- Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
-- Alumia · Prompt 4 · cultura (itens 38 a 42), atrás do interruptor "alumia-p4-cultura" (catálogo, só pelo nome, desligado).
--
-- Roda depois das migrações 20261127-p4-* da onda 1; quem junta põe antes do 20261127-p4-fim.sql. Não mexe na versão nem na lista
-- da porta: o 20261127-p4-fim.sql faz isso. Funções que já existiam e são redefinidas aqui: nenhuma. Tabela que já existia e muda:
-- interno.rede_encontros (ganha a coluna "comunidade", o núcleo deixa de ser obrigatório e um dos dois tem de estar preenchido; as
-- funções do encontro de núcleo continuam iguais, porque filtram pelo núcleo).
--
-- O que faz:
--   38. Obra seriada (conto, cordel, poesia, HQ): a autora cria a obra e liga, como capítulo, um post dela que já saiu (o post
--       continua sendo o post de sempre, com as regras de quem vê de sempre). Quem segue a obra recebe um aviso de capítulo novo,
--       com frase genérica (nunca o texto do post) e só se puder ver o capítulo. A autora nunca vê quem segue: o número só aparece
--       para ela, e só a partir de 3. As "séries" de antes (posts que se repetem, rede_agendados) ficam como estão.
--   39. Mural de arte e cultura: a pessoa marca um post dela como peça do portfólio (título e linguagem). O mural e o portfólio
--       mostram só o codinome e só as peças cujo post quem olha pode ver (interno.rede_ve).
--   40. Cineclube da comunidade: a sessão marcada é um encontro (interno.rede_encontros ganha a coluna "comunidade"; o encontro de
--       núcleo continua como estava) com o filme; o diário de filmes da roda não diz quem escreveu nem conta quem viu (sem ranking).
--   41. Clube de leitura da comunidade: estante, o progresso de cada pessoa (só o último, sem data nem histórico, visto só por ela)
--       e o do grupo somado (só com 3 leitoras ou mais, média arredondada de 10 em 10), e citações sem autoria à vista.
--   42. Playlist coletiva da comunidade: só links (http ou https). O título e a imagem vêm da prévia que o servidor do site já faz
--       (/api/rede/previa, com a imagem pelo proxy assinado); o banco só aceita imagem desse proxy. Nada de player embutido.
-- Núcleo: desde a R2 o banco não sabe quem é de cada núcleo, então estante e cineclube de núcleo não entram aqui (iriam como
-- mensagem cifrada do grupo, pendência de junção com o chat).
-- Pode rodar mais de uma vez. Endereço de rede: nada daqui lê ou guarda. Nenhuma função devolve lista de pessoas.
-- Lei: LGPD art. 6º, III (necessidade: só o que a tela usa), art. 7º, I (consentimento: tudo é a própria pessoa que põe), art. 18,
-- VI (eliminação: sai junto com a conta e a pessoa tira o que pôs) e art. 46 (segurança: tabelas fechadas, só pelas funções).

-- ── 0. O interruptor ───────────────────────────────────────────────────────────────────────────────────────────────────────
do $$
begin
  if to_regclass('interno.recursos_catalogo') is not null then
    insert into interno.recursos_catalogo (nome, so_pelo_nome) values ('alumia-p4-cultura', true)
      on conflict (nome) do update set so_pelo_nome = true;
  end if;
end $$;

/** A cultura está ligada? Só com decisão explícita do painel e sem a Alumia desligada lá. Sem a tabela de recursos: desligada. */
create or replace function interno.rede_p4_cultura_ligado() returns boolean language plpgsql stable security definer set search_path = interno, pg_temp as $$
begin
  if to_regclass('interno.recursos_vivos') is null then return false; end if;
  if exists (select 1 from recursos_vivos where nome in ('rede-v2', 'alumia-2') and not ligado) then return false; end if;
  return coalesce((select ligado from recursos_vivos where nome = 'alumia-p4-cultura'), false);
end $$;

/** Recusa com "desligado" quando o interruptor está desligado. */
create or replace function interno.rede_p4_cultura_exige() returns void language plpgsql stable security definer set search_path = interno, pg_temp as $$
begin
  if not interno.rede_p4_cultura_ligado() then perform interno.erro('desligado'); end if;
end $$;

-- ── 1. As tabelas ──────────────────────────────────────────────────────────────────────────────────────────────────────────

-- 38. Obras seriadas e capítulos (cada capítulo é um post da autora).
create table if not exists interno.rede_p4_obras (
  id uuid primary key default gen_random_uuid(),
  autor uuid not null references interno.perfis (id) on delete cascade,
  titulo text not null check (char_length(titulo) between 2 and 120),
  genero text not null check (genero in ('conto', 'cordel', 'poesia', 'hq')),
  sinopse text not null default '' check (char_length(sinopse) <= 500),
  criada_em timestamptz not null default now()
);
create index if not exists rede_p4_obras_autor on interno.rede_p4_obras (autor);

-- Os capítulos de uma obra seriada: o número, o título e o post de cada um (o texto mora no post).
create table if not exists interno.rede_p4_capitulos (
  obra uuid not null references interno.rede_p4_obras (id) on delete cascade,
  numero smallint not null check (numero between 1 and 500),
  post uuid not null unique references interno.rede_posts (id) on delete cascade,
  titulo text not null default '' check (char_length(titulo) <= 120),
  criado_em timestamptz not null default now(),
  primary key (obra, numero)
);

-- Quem segue a obra: só para mandar o aviso. Nenhuma função devolve quem é.
create table if not exists interno.rede_p4_obra_seguir (
  obra uuid not null references interno.rede_p4_obras (id) on delete cascade,
  usuario uuid not null references interno.perfis (id) on delete cascade,
  primary key (obra, usuario)
);
create index if not exists rede_p4_obra_seguir_usuario on interno.rede_p4_obra_seguir (usuario);

-- 39. As peças do mural (cada peça é um post da pessoa).
create table if not exists interno.rede_p4_pecas (
  id uuid primary key default gen_random_uuid(),
  autor uuid not null references interno.perfis (id) on delete cascade,
  post uuid not null unique references interno.rede_posts (id) on delete cascade,
  titulo text not null check (char_length(titulo) between 2 and 120),
  linguagem text not null check (linguagem in ('desenho', 'pintura', 'fotografia', 'gravura', 'lambe', 'grafite', 'musica', 'poesia', 'danca', 'teatro', 'artesanato', 'audiovisual', 'outra')),
  criada_em timestamptz not null default now()
);
create index if not exists rede_p4_pecas_autor on interno.rede_p4_pecas (autor);
create index if not exists rede_p4_pecas_quando on interno.rede_p4_pecas (criada_em desc);

-- 40. O encontro passa a poder ser de uma comunidade (o de núcleo fica como estava) e ganha o filme da sessão.
alter table interno.rede_encontros add column if not exists comunidade text references interno.rede_comunidades (slug) on delete cascade on update cascade;
alter table interno.rede_encontros alter column nucleo drop not null;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'rede_encontros_um_dono') then
    alter table interno.rede_encontros add constraint rede_encontros_um_dono check (num_nonnulls(nucleo, comunidade) = 1);
  end if;
end $$;
create index if not exists rede_encontros_comunidade on interno.rede_encontros (comunidade, quando) where comunidade is not null;

-- A sessão do cineclube: o filme, o ano e a sinopse de um encontro da comunidade (nada de quem foi).
create table if not exists interno.rede_p4_cine_sessoes (
  encontro uuid primary key references interno.rede_encontros (id) on delete cascade,
  filme text not null check (char_length(filme) between 1 and 120),
  ano smallint check (ano is null or ano between 1880 and 2100),
  sinopse text not null default '' check (char_length(sinopse) <= 500)
);

-- O diário de filmes da roda: o que se conversou. Quem escreveu fica só para poder tirar; nunca sai.
create table if not exists interno.rede_p4_cine_diario (
  id uuid primary key default gen_random_uuid(),
  comunidade text not null references interno.rede_comunidades (slug) on delete cascade on update cascade,
  filme text not null check (char_length(filme) between 1 and 120),
  ano smallint check (ano is null or ano between 1880 and 2100),
  nota text not null default '' check (char_length(nota) <= 1000),
  sessao uuid references interno.rede_encontros (id) on delete set null,
  por uuid not null references interno.perfis (id) on delete cascade,
  criado_em timestamptz not null default now()
);
create index if not exists rede_p4_cine_diario_comunidade on interno.rede_p4_cine_diario (comunidade, criado_em desc);

-- 41. A estante, o progresso (só o último de cada pessoa, sem data) e as citações.
create table if not exists interno.rede_p4_livros (
  id uuid primary key default gen_random_uuid(),
  comunidade text not null references interno.rede_comunidades (slug) on delete cascade on update cascade,
  titulo text not null check (char_length(titulo) between 1 and 160),
  autoria text not null default '' check (char_length(autoria) <= 120),
  situacao text not null default 'proximo' check (situacao in ('proximo', 'lendo', 'lido')),
  por uuid not null references interno.perfis (id) on delete cascade,
  criado_em timestamptz not null default now()
);
create index if not exists rede_p4_livros_comunidade on interno.rede_p4_livros (comunidade);

-- O progresso de cada pessoa num livro da estante (só a porcentagem; o do grupo só aparece somado, a partir de 3).
create table if not exists interno.rede_p4_leitura (
  livro uuid not null references interno.rede_p4_livros (id) on delete cascade,
  usuario uuid not null references interno.perfis (id) on delete cascade,
  pct smallint not null check (pct between 0 and 100),
  primary key (livro, usuario)
);

-- As citações de um livro da estante: o trecho e a página. Quem guardou fica só para poder tirar; a citação sai sem autoria.
create table if not exists interno.rede_p4_citacoes (
  id uuid primary key default gen_random_uuid(),
  livro uuid not null references interno.rede_p4_livros (id) on delete cascade,
  por uuid not null references interno.perfis (id) on delete cascade,
  texto text not null check (char_length(texto) between 3 and 500),
  pagina text not null default '' check (char_length(pagina) <= 20),
  criada_em timestamptz not null default now()
);
create index if not exists rede_p4_citacoes_livro on interno.rede_p4_citacoes (livro, criada_em desc);

-- 42. A playlist coletiva: só links. A imagem, quando há, é a do proxy assinado do nosso servidor.
create table if not exists interno.rede_p4_playlist (
  id uuid primary key default gen_random_uuid(),
  comunidade text not null references interno.rede_comunidades (slug) on delete cascade on update cascade,
  url text not null check (char_length(url) between 10 and 500 and url ~ '^https?://[^/@\s]+(/\S*)?$'),
  titulo text not null check (char_length(titulo) between 1 and 140),
  dominio text not null check (char_length(dominio) between 3 and 120),
  imagem text check (imagem is null or (char_length(imagem) <= 1500 and imagem like '/api/rede/previa/imagem?%')),
  nota text not null default '' check (char_length(nota) <= 200),
  por uuid not null references interno.perfis (id) on delete cascade,
  criado_em timestamptz not null default now(),
  unique (comunidade, url)
);

alter table interno.rede_p4_obras enable row level security;
alter table interno.rede_p4_capitulos enable row level security;
alter table interno.rede_p4_obra_seguir enable row level security;
alter table interno.rede_p4_pecas enable row level security;
alter table interno.rede_p4_cine_sessoes enable row level security;
alter table interno.rede_p4_cine_diario enable row level security;
alter table interno.rede_p4_livros enable row level security;
alter table interno.rede_p4_leitura enable row level security;
alter table interno.rede_p4_citacoes enable row level security;
alter table interno.rede_p4_playlist enable row level security;

-- ── 2. As peças de dentro ──────────────────────────────────────────────────────────────────────────────────────────────────

/** Quem pode LER o que é da comunidade: fechada, só quem é dela; aberta ou restrita, também quem é membro da Rede. */
create or replace function interno.rede_p4_cult_le(p_com text, p_quem uuid) returns boolean language sql stable security definer set search_path = interno, pg_temp as $$
  select p_quem is not null and exists (
    select 1 from rede_comunidades k where k.slug = p_com and k.slug not like 'fechado-%'
      and (interno.rede2_na_comunidade(k.slug, p_quem) or (k.tipo <> 'fechada' and interno.rede2_membro(p_quem))))
$$;

/** Quem pode ESCREVER na comunidade: membro da Rede e da comunidade. */
create or replace function interno.rede_p4_cult_escreve(p_com text, p_quem uuid) returns boolean language sql stable security definer set search_path = interno, pg_temp as $$
  select interno.rede2_membro(p_quem) and interno.rede2_na_comunidade(p_com, p_quem)
$$;

/** A comunidade pedida, já conferida para leitura (o mesmo "nao_encontrado" de quando ela não existe). */
create or replace function interno.rede_p4_cult_comunidade(p_com text, p_quem uuid) returns text language plpgsql stable security definer set search_path = interno, pg_temp as $$
declare v_slug text := lower(btrim(coalesce(p_com, '')));
begin
  if not interno.rede_p4_cult_le(v_slug, p_quem) then perform interno.erro('nao_encontrado'); end if;
  return v_slug;
end $$;

/** Um número que só sai a partir de 3 (abaixo, nulo). */
create or replace function interno.rede_p4_cult_tres(p_n bigint) returns integer language sql immutable as $$
  select case when p_n >= 3 then p_n::integer end
$$;

/** O post da própria pessoa que pode virar capítulo ou peça: dela, no ar, não é resposta e não é cifrado (o título ficaria aberto). */
create or replace function interno.rede_p4_cult_post_meu(p_post uuid, p_quem uuid) returns interno.rede_posts language plpgsql stable security definer set search_path = interno, pg_temp as $$
declare x rede_posts;
begin
  select * into x from rede_posts where id = p_post;
  if not found or x.autor is distinct from p_quem or x.apagado_em is not null or x.oculto or x.retido then perform interno.erro('nao_encontrado'); end if;
  if x.resposta_a is not null then perform interno.erro('invalido:resposta'); end if;
  if x.corpo_grupo is not null then perform interno.erro('invalido:cifrado'); end if;
  return x;
end $$;

/** O post está no ar para quem olha? */
create or replace function interno.rede_p4_cult_ve(p_post uuid, p_quem uuid) returns boolean language sql stable security definer set search_path = interno, pg_temp as $$
  select exists (select 1 from rede_posts x where x.id = p_post and x.apagado_em is null
    and (x.autor = p_quem or (not x.oculto and not x.retido)) and interno.rede_ve(x, p_quem))
$$;

/** A obra como a tela mostra, para quem olha. Nulo se a pessoa não vê nenhum capítulo (e não é a autora). */
create or replace function interno.rede_p4_obra_json(p_obra uuid, p_quem uuid, p_completa boolean default false) returns jsonb language plpgsql stable security definer set search_path = interno, pg_temp as $$
declare o rede_p4_obras; v_caps jsonb; v_n integer;
begin
  select * into o from rede_p4_obras where id = p_obra;
  if not found or interno.rede_bloqueado(p_quem, o.autor) then return null; end if;
  select coalesce(jsonb_agg(jsonb_build_object('numero', c.numero, 'titulo', c.titulo, 'post', c.post, 'em', c.criado_em) order by c.numero), '[]'::jsonb), count(*)
    into v_caps, v_n
    from rede_p4_capitulos c where c.obra = o.id and interno.rede_p4_cult_ve(c.post, p_quem);
  if v_n = 0 and o.autor <> p_quem then return null; end if;
  return jsonb_build_object('id', o.id, 'titulo', o.titulo, 'genero', o.genero, 'sinopse', o.sinopse,
    'autor', interno.rede_nome(o.autor), 'handle', (select f.rede_handle from perfis f where f.id = o.autor),
    'capitulos', v_n, 'minha', o.autor = p_quem,
    'sigo', exists (select 1 from rede_p4_obra_seguir s where s.obra = o.id and s.usuario = p_quem),
    'ultimo', (select max(c.criado_em) from rede_p4_capitulos c where c.obra = o.id and interno.rede_p4_cult_ve(c.post, p_quem)))
    || case when p_completa then jsonb_build_object('lista', v_caps,
         -- Quantas pessoas seguem: só para a autora e só a partir de 3. Quem são, nunca.
         'seguidores', case when o.autor = p_quem then interno.rede_p4_cult_tres((select count(*) from rede_p4_obra_seguir s where s.obra = o.id)) end)
       else '{}'::jsonb end;
end $$;

/** A peça como o mural mostra: título, linguagem, o post e o codinome. */
create or replace function interno.rede_p4_peca_json(k interno.rede_p4_pecas, p_quem uuid) returns jsonb language sql stable security definer set search_path = interno, pg_temp as $$
  select jsonb_build_object('id', k.id, 'titulo', k.titulo, 'linguagem', k.linguagem, 'post', k.post, 'em', k.criada_em,
    'autor', interno.rede_nome(k.autor), 'handle', (select f.rede_handle from perfis f where f.id = k.autor), 'minha', k.autor = p_quem)
$$;

/** O livro com o progresso de quem olha e o do grupo somado (só com 3 leitoras ou mais). */
create or replace function interno.rede_p4_livro_json(l interno.rede_p4_livros, p_quem uuid) returns jsonb language sql stable security definer set search_path = interno, pg_temp as $$
  with g as (select count(*) as n, avg(pct) as media, count(*) filter (where pct = 100) as fim from rede_p4_leitura where livro = l.id)
  select jsonb_build_object('id', l.id, 'titulo', l.titulo, 'autoria', l.autoria, 'situacao', l.situacao, 'meu', l.por = p_quem,
    'eu', (select pct from rede_p4_leitura where livro = l.id and usuario = p_quem),
    'grupo', jsonb_build_object(
      'leitoras', interno.rede_p4_cult_tres(g.n),
      'media', case when g.n >= 3 then (round(g.media / 10) * 10)::integer end,
      'terminaram', case when g.n >= 3 then interno.rede_p4_cult_tres(g.fim) end),
    'citacoes', (select coalesce(jsonb_agg(jsonb_build_object('id', c.id, 'texto', c.texto, 'pagina', c.pagina, 'minha', c.por = p_quem) order by c.criada_em desc), '[]'::jsonb)
      from (select * from rede_p4_citacoes where livro = l.id order by criada_em desc limit 30) c))
  from g
$$;

/** O local de um encontro público, como o encontro do núcleo já confere: nunca endereço de casa (rua com número, CEP). */
create or replace function interno.rede_p4_cult_local(p_tipo text, p_texto text) returns text language plpgsql immutable as $$
declare v_texto text;
begin
  if coalesce(p_tipo, '') not in ('praca', 'biblioteca', 'sindicato', 'escola', 'universidade', 'associacao', 'online', 'outro') then perform interno.erro('invalido:local'); end if;
  v_texto := interno.txt(p_texto, 'local', case when p_tipo = 'outro' then 3 else 0 end, 140);
  if v_texto ~* '\m(rua|avenida|av\.?|travessa|alameda|estrada|rodovia)\M[^;]{0,60}\d' or v_texto ~ '\d{5}-?\d{3}' then perform interno.erro('dado_pessoal'); end if;
  return v_texto;
end $$;

/** Um ano de filme opcional, vindo como texto ou número. */
create or replace function interno.rede_p4_cult_ano(p jsonb) returns smallint language plpgsql immutable as $$
declare v integer;
begin
  if p is null or jsonb_typeof(p) = 'null' or btrim(p #>> '{}') = '' then return null; end if;
  begin v := (p #>> '{}')::integer; exception when others then perform interno.erro('invalido:ano'); end;
  if v < 1880 or v > 2100 then perform interno.erro('invalido:ano'); end if;
  return v::smallint;
end $$;

revoke all on function interno.rede_p4_cultura_ligado(), interno.rede_p4_cultura_exige(), interno.rede_p4_cult_le(text, uuid), interno.rede_p4_cult_escreve(text, uuid),
  interno.rede_p4_cult_comunidade(text, uuid), interno.rede_p4_cult_tres(bigint), interno.rede_p4_cult_post_meu(uuid, uuid), interno.rede_p4_cult_ve(uuid, uuid),
  interno.rede_p4_obra_json(uuid, uuid, boolean), interno.rede_p4_peca_json(interno.rede_p4_pecas, uuid), interno.rede_p4_livro_json(interno.rede_p4_livros, uuid),
  interno.rede_p4_cult_local(text, text), interno.rede_p4_cult_ano(jsonb) from public;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on function interno.rede_p4_cultura_ligado(), interno.rede_p4_cultura_exige(), interno.rede_p4_cult_le(text, uuid), interno.rede_p4_cult_escreve(text, uuid),
      interno.rede_p4_cult_comunidade(text, uuid), interno.rede_p4_cult_tres(bigint), interno.rede_p4_cult_post_meu(uuid, uuid), interno.rede_p4_cult_ve(uuid, uuid),
      interno.rede_p4_obra_json(uuid, uuid, boolean), interno.rede_p4_peca_json(interno.rede_p4_pecas, uuid), interno.rede_p4_livro_json(interno.rede_p4_livros, uuid),
      interno.rede_p4_cult_local(text, text), interno.rede_p4_cult_ano(jsonb) from anon, authenticated;
  end if;
end $$;

-- ── 3. As funções da tela: comum ───────────────────────────────────────────────────────────────────────────────────────────

/** O interruptor, para a tela saber se abre (o banco confere de novo em cada chamada). */
create or replace function public.rede_p4_cultura_ligado() returns boolean language plpgsql stable security definer set search_path = interno, pg_temp as $$
begin
  perform interno.alumia_porta();
  return auth.uid() is not null and interno.rede_p4_cultura_ligado();
end $$;

/** As comunidades de quem chama (só as dela), para escolher onde ficam o cineclube, a estante e a playlist. */
create or replace function public.rede_p4_cultura_inicio() returns jsonb language plpgsql stable security definer set search_path = interno, pg_temp as $$
declare v uuid;
begin
  perform interno.alumia_porta();
  v := interno.eu();
  perform interno.rede_p4_cultura_exige();
  perform interno.aberta('comunidade');
  return jsonb_build_object('comunidades', (select coalesce(jsonb_agg(jsonb_build_object('slug', k.slug, 'nome', k.nome,
      'modero', interno.rede3_mod_modera(k.slug, null)) order by k.nome), '[]'::jsonb)
    from rede_comunidades k
    where k.slug not like 'fechado-%' and interno.rede2_na_comunidade(k.slug, v)));
end $$;

-- ── 4. Item 38: obra seriada ───────────────────────────────────────────────────────────────────────────────────────────────

/** Cria a obra: título (2 a 120), gênero (conto, cordel, poesia, hq) e sinopse (até 500). No máximo 50 obras por pessoa. */
create or replace function public.rede_p4_obra_criar(p jsonb) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid; v_id uuid;
begin
  perform interno.alumia_porta();
  v := interno.eu();
  perform interno.rede_p4_cultura_exige();
  perform interno.aberta('comunidade');
  if not interno.rede2_membro(v) then perform interno.erro('sem_permissao'); end if;
  if p is null or jsonb_typeof(p) <> 'object' then perform interno.erro('invalido:obra'); end if;
  perform interno.limite('p4_cultura_escrever', 60, 60);
  if coalesce(p ->> 'genero', '') not in ('conto', 'cordel', 'poesia', 'hq') then perform interno.erro('invalido:genero'); end if;
  if (select count(*) from rede_p4_obras where autor = v) >= 50 then perform interno.erro('muitas'); end if;
  insert into rede_p4_obras (autor, titulo, genero, sinopse)
  values (v, interno.txt(p ->> 'titulo', 'titulo', 2, 120), p ->> 'genero', interno.txt(p ->> 'sinopse', 'sinopse', 0, 500))
  returning id into v_id;
  return interno.rede_p4_obra_json(v_id, v, true);
end $$;

/** Apaga a obra (só a autora). Os posts dos capítulos continuam no ar: só a ligação some. */
create or replace function public.rede_p4_obra_apagar(p_id uuid) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid;
begin
  perform interno.alumia_porta();
  v := interno.eu();
  perform interno.rede_p4_cultura_exige();
  delete from rede_p4_obras where id = p_id and autor = v;
  if not found then perform interno.erro('nao_encontrado'); end if;
  return jsonb_build_object('apagada', true);
end $$;

/**
 * Liga um post da autora como o próximo capítulo. Quem segue a obra e pode ver o post recebe um aviso, com frase genérica (nunca o
 * texto do post; o aviso abre o capítulo, e a lista de avisos confere de novo quem vê).
 */
create or replace function public.rede_p4_obra_capitulo(p_obra uuid, p_post uuid, p_titulo text default null) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid; o rede_p4_obras; x rede_posts; v_num integer;
begin
  perform interno.alumia_porta();
  v := interno.eu();
  perform interno.rede_p4_cultura_exige();
  perform interno.aberta('comunidade');
  perform interno.limite('p4_cultura_escrever', 60, 60);
  select * into o from rede_p4_obras where id = p_obra and autor = v;
  if not found then perform interno.erro('nao_encontrado'); end if;
  x := interno.rede_p4_cult_post_meu(p_post, v);
  if exists (select 1 from rede_p4_capitulos where post = x.id) then perform interno.erro('ja_ligado'); end if;
  perform pg_advisory_xact_lock(hashtext('rede_p4_obra:' || o.id::text));
  select coalesce(max(numero), 0) + 1 into v_num from rede_p4_capitulos where obra = o.id;
  if v_num > 500 then perform interno.erro('muitos'); end if;
  insert into rede_p4_capitulos (obra, numero, post, titulo) values (o.id, v_num, x.id, interno.txt(p_titulo, 'titulo', 0, 120));
  insert into avisos (para, texto, categoria, post)
  select s.usuario, 'Saiu um capítulo novo de uma obra que você segue na Alumia.', 'rede', x.id
    from rede_p4_obra_seguir s
   where s.usuario <> v and interno.rede_ve(x, s.usuario) and not interno.rede_bloqueado(s.usuario, v)
     and exists (select 1 from perfis f where f.id = s.usuario and not f.suspenso)
   limit 5000
  on conflict do nothing;
  return interno.rede_p4_obra_json(o.id, v, true);
end $$;

/** Tira um capítulo da obra (só a autora). O post continua no ar. */
create or replace function public.rede_p4_obra_capitulo_tirar(p_obra uuid, p_numero integer) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid;
begin
  perform interno.alumia_porta();
  v := interno.eu();
  perform interno.rede_p4_cultura_exige();
  delete from rede_p4_capitulos c using rede_p4_obras o where c.obra = o.id and o.id = p_obra and o.autor = v and c.numero = p_numero;
  if not found then perform interno.erro('nao_encontrado'); end if;
  return interno.rede_p4_obra_json(p_obra, v, true);
end $$;

/** As obras que quem chama vê: as dela ("minhas"), as que segue ("seguindo") ou as mais recentes de um gênero. Até 60. */
create or replace function public.rede_p4_obras(p jsonb default '{}'::jsonb) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid; v_filtro text := coalesce(p ->> 'filtro', 'todas'); v_genero text := nullif(p ->> 'genero', '');
begin
  perform interno.alumia_porta();
  v := interno.eu();
  perform interno.rede_p4_cultura_exige();
  perform interno.aberta('comunidade');
  perform interno.limite('rede2_ler', 600, 60);
  if v_filtro not in ('todas', 'minhas', 'seguindo') then perform interno.erro('invalido:filtro'); end if;
  if v_genero is not null and v_genero not in ('conto', 'cordel', 'poesia', 'hq') then perform interno.erro('invalido:genero'); end if;
  return jsonb_build_object('itens', (select coalesce(jsonb_agg(y.j order by (y.j ->> 'ultimo') desc nulls last), '[]'::jsonb) from (
    select x.j from (
      select interno.rede_p4_obra_json(o.id, v) as j, o.criada_em from rede_p4_obras o
       where (v_genero is null or o.genero = v_genero)
         and (v_filtro <> 'minhas' or o.autor = v)
         and (v_filtro <> 'seguindo' or exists (select 1 from rede_p4_obra_seguir s where s.obra = o.id and s.usuario = v))
       order by o.criada_em desc limit 300) x
    where x.j is not null order by x.criada_em desc limit 60) y));
end $$;

/** Uma obra, com os capítulos que quem chama pode ver. */
create or replace function public.rede_p4_obra(p_id uuid) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid; v_j jsonb;
begin
  perform interno.alumia_porta();
  v := interno.eu();
  perform interno.rede_p4_cultura_exige();
  perform interno.aberta('comunidade');
  perform interno.limite('rede2_ler', 600, 60);
  v_j := interno.rede_p4_obra_json(p_id, v, true);
  if v_j is null then perform interno.erro('nao_encontrado'); end if;
  return v_j;
end $$;

/** Seguir ou deixar de seguir a obra (para receber o aviso de capítulo novo). Só quem vê a obra. */
create or replace function public.rede_p4_obra_seguir(p_id uuid, p_seguir boolean) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid;
begin
  perform interno.alumia_porta();
  v := interno.eu();
  perform interno.rede_p4_cultura_exige();
  perform interno.aberta('comunidade');
  perform interno.rede2_limite('seguir');
  if interno.rede_p4_obra_json(p_id, v) is null then perform interno.erro('nao_encontrado'); end if;
  if coalesce(p_seguir, true) then
    if exists (select 1 from rede_p4_obras where id = p_id and autor = v) then perform interno.erro('invalido:minha'); end if;
    insert into rede_p4_obra_seguir (obra, usuario) values (p_id, v) on conflict do nothing;
  else
    delete from rede_p4_obra_seguir where obra = p_id and usuario = v;
  end if;
  return jsonb_build_object('sigo', coalesce(p_seguir, true));
end $$;

-- ── 5. Item 39: mural de arte e cultura ────────────────────────────────────────────────────────────────────────────────────

/** Marca um post da própria pessoa como peça do portfólio (título e linguagem). No máximo 200 peças. */
create or replace function public.rede_p4_peca_criar(p jsonb) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid; x rede_posts; k rede_p4_pecas; v_post uuid;
begin
  perform interno.alumia_porta();
  v := interno.eu();
  perform interno.rede_p4_cultura_exige();
  perform interno.aberta('comunidade');
  if not interno.rede2_membro(v) then perform interno.erro('sem_permissao'); end if;
  if p is null or jsonb_typeof(p) <> 'object' then perform interno.erro('invalido:peca'); end if;
  perform interno.limite('p4_cultura_escrever', 60, 60);
  begin v_post := (p ->> 'post')::uuid; exception when others then perform interno.erro('invalido:post'); end;
  x := interno.rede_p4_cult_post_meu(v_post, v);
  if coalesce(p ->> 'linguagem', '') not in ('desenho', 'pintura', 'fotografia', 'gravura', 'lambe', 'grafite', 'musica', 'poesia', 'danca', 'teatro', 'artesanato', 'audiovisual', 'outra') then
    perform interno.erro('invalido:linguagem');
  end if;
  if (select count(*) from rede_p4_pecas where autor = v) >= 200 then perform interno.erro('muitas'); end if;
  insert into rede_p4_pecas (autor, post, titulo, linguagem) values (v, x.id, interno.txt(p ->> 'titulo', 'titulo', 2, 120), p ->> 'linguagem')
  on conflict (post) do nothing
  returning * into k;
  if k.id is null then perform interno.erro('ja_ligado'); end if;
  return interno.rede_p4_peca_json(k, v);
end $$;

/** Tira a peça do portfólio (só quem pôs). O post continua no ar. */
create or replace function public.rede_p4_peca_tirar(p_id uuid) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid;
begin
  perform interno.alumia_porta();
  v := interno.eu();
  perform interno.rede_p4_cultura_exige();
  delete from rede_p4_pecas where id = p_id and autor = v;
  if not found then perform interno.erro('nao_encontrado'); end if;
  return jsonb_build_object('tirada', true);
end $$;

/** O mural (as peças mais recentes, por linguagem) ou o portfólio de um codinome (pelo @handle). Só o que quem olha vê. Até 60. */
create or replace function public.rede_p4_mural(p jsonb default '{}'::jsonb) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid; v_ling text := nullif(p ->> 'linguagem', ''); v_handle text := nullif(lower(btrim(coalesce(p ->> 'handle', ''))), ''); v_autor uuid;
begin
  perform interno.alumia_porta();
  v := interno.eu();
  perform interno.rede_p4_cultura_exige();
  perform interno.aberta('comunidade');
  perform interno.limite('rede2_ler', 600, 60);
  if v_handle is not null then
    select id into v_autor from perfis where rede_handle = ltrim(v_handle, '@');
    if v_autor is null or interno.rede_bloqueado(v, v_autor) then perform interno.erro('nao_encontrado'); end if;
  end if;
  return jsonb_build_object('itens', (select coalesce(jsonb_agg(interno.rede_p4_peca_json(k, v) order by k.criada_em desc), '[]'::jsonb)
    from rede_p4_pecas k where k.id in (
      select q.id from rede_p4_pecas q
       where (v_ling is null or q.linguagem = v_ling) and (v_autor is null or q.autor = v_autor)
         and interno.rede_p4_cult_ve(q.post, v)
       order by q.criada_em desc limit 60)),
    'autor', case when v_autor is not null then interno.rede_nome(v_autor) end);
end $$;

-- ── 6. Item 40: cineclube ──────────────────────────────────────────────────────────────────────────────────────────────────

/** As sessões que vêm (e as das últimas 3 horas) e o diário de filmes da comunidade. Ninguém aparece: nem quem marcou, nem quem viu. */
create or replace function public.rede_p4_cine(p_comunidade text) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid; v_slug text;
begin
  perform interno.alumia_porta();
  v := interno.eu();
  perform interno.rede_p4_cultura_exige();
  perform interno.aberta('comunidade');
  perform interno.limite('rede2_ler', 600, 60);
  v_slug := interno.rede_p4_cult_comunidade(p_comunidade, v);
  return jsonb_build_object('comunidade', v_slug, 'modero', interno.rede3_mod_modera(v_slug, null), 'posso', interno.rede_p4_cult_escreve(v_slug, v),
    'sessoes', (select coalesce(jsonb_agg(jsonb_build_object('id', e.id, 'quando', e.quando, 'local_tipo', e.local_tipo, 'local_texto', e.local_texto,
        'filme', s.filme, 'ano', s.ano, 'sinopse', s.sinopse) order by e.quando), '[]'::jsonb)
      from rede_encontros e join rede_p4_cine_sessoes s on s.encontro = e.id
      where e.comunidade = v_slug and e.quando > now() - interval '3 hours'),
    'diario', (select coalesce(jsonb_agg(jsonb_build_object('id', d.id, 'filme', d.filme, 'ano', d.ano, 'nota', d.nota, 'em', d.criado_em,
        'minha', d.por = v) order by d.criado_em desc), '[]'::jsonb)
      from (select * from rede_p4_cine_diario where comunidade = v_slug order by criado_em desc limit 60) d));
end $$;

/** Marca a sessão (só a moderação da comunidade): um encontro em local público, com o filme. */
create or replace function public.rede_p4_cine_marcar(p jsonb) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid; v_slug text; v_quando timestamptz; v_texto text; v_id uuid;
begin
  perform interno.alumia_porta();
  v := interno.eu();
  perform interno.rede_p4_cultura_exige();
  perform interno.aberta('comunidade');
  if p is null or jsonb_typeof(p) <> 'object' then perform interno.erro('invalido:sessao'); end if;
  v_slug := interno.rede_p4_cult_comunidade(p ->> 'comunidade', v);
  if not interno.rede3_mod_modera(v_slug, null) then perform interno.erro('sem_permissao'); end if;
  perform interno.limite('p4_cultura_escrever', 60, 60);
  begin v_quando := (p ->> 'quando')::timestamptz; exception when others then perform interno.erro('invalido:quando'); end;
  if v_quando is null or v_quando < now() - interval '1 hour' or v_quando > now() + interval '1 year' then perform interno.erro('invalido:quando'); end if;
  v_texto := interno.rede_p4_cult_local(p ->> 'local_tipo', p ->> 'local_texto');
  if (select count(*) from rede_encontros where comunidade = v_slug and quando > now()) >= 30 then perform interno.erro('muitas'); end if;
  insert into rede_encontros (comunidade, quando, local_tipo, local_texto) values (v_slug, v_quando, p ->> 'local_tipo', v_texto) returning id into v_id;
  insert into rede_p4_cine_sessoes (encontro, filme, ano, sinopse)
  values (v_id, interno.txt(p ->> 'filme', 'filme', 1, 120), interno.rede_p4_cult_ano(p -> 'ano'), interno.txt(p ->> 'sinopse', 'sinopse', 0, 500));
  return jsonb_build_object('id', v_id);
end $$;

/** Desmarca a sessão (só a moderação da comunidade). */
create or replace function public.rede_p4_cine_desmarcar(p_id uuid) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid;
begin
  perform interno.alumia_porta();
  v := interno.eu();
  perform interno.rede_p4_cultura_exige();
  delete from rede_encontros e where e.id = p_id and e.comunidade is not null and interno.rede3_mod_modera(e.comunidade, null)
    and exists (select 1 from rede_p4_cine_sessoes s where s.encontro = e.id);
  if not found then perform interno.erro('nao_encontrado'); end if;
  return jsonb_build_object('desmarcada', true);
end $$;

/** Uma anotação no diário de filmes da roda (quem é da comunidade). Sai sem o nome de quem escreveu. */
create or replace function public.rede_p4_cine_anotar(p jsonb) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid; v_slug text; v_sessao uuid; v_id uuid;
begin
  perform interno.alumia_porta();
  v := interno.eu();
  perform interno.rede_p4_cultura_exige();
  perform interno.aberta('comunidade');
  if p is null or jsonb_typeof(p) <> 'object' then perform interno.erro('invalido:diario'); end if;
  v_slug := interno.rede_p4_cult_comunidade(p ->> 'comunidade', v);
  if not interno.rede_p4_cult_escreve(v_slug, v) then perform interno.erro('sem_permissao'); end if;
  perform interno.limite('p4_cultura_escrever', 60, 60);
  if nullif(p ->> 'sessao', '') is not null then
    begin v_sessao := (p ->> 'sessao')::uuid; exception when others then perform interno.erro('invalido:sessao'); end;
    if not exists (select 1 from rede_encontros e where e.id = v_sessao and e.comunidade = v_slug) then perform interno.erro('invalido:sessao'); end if;
  end if;
  insert into rede_p4_cine_diario (comunidade, filme, ano, nota, sessao, por)
  values (v_slug, interno.txt(p ->> 'filme', 'filme', 1, 120), interno.rede_p4_cult_ano(p -> 'ano'), interno.txt(p ->> 'nota', 'nota', 0, 1000), v_sessao, v)
  returning id into v_id;
  return jsonb_build_object('id', v_id);
end $$;

/** Tira uma anotação do diário: quem escreveu ou a moderação. */
create or replace function public.rede_p4_cine_nota_tirar(p_id uuid) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid;
begin
  perform interno.alumia_porta();
  v := interno.eu();
  perform interno.rede_p4_cultura_exige();
  delete from rede_p4_cine_diario d where d.id = p_id and (d.por = v or interno.rede3_mod_modera(d.comunidade, null));
  if not found then perform interno.erro('nao_encontrado'); end if;
  return jsonb_build_object('tirada', true);
end $$;

-- ── 7. Item 41: clube de leitura ───────────────────────────────────────────────────────────────────────────────────────────

/** A estante da comunidade: lendo, próximos e lidos, com o progresso de quem olha e o do grupo somado. */
create or replace function public.rede_p4_estante(p_comunidade text) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid; v_slug text;
begin
  perform interno.alumia_porta();
  v := interno.eu();
  perform interno.rede_p4_cultura_exige();
  perform interno.aberta('comunidade');
  perform interno.limite('rede2_ler', 600, 60);
  v_slug := interno.rede_p4_cult_comunidade(p_comunidade, v);
  return jsonb_build_object('comunidade', v_slug, 'modero', interno.rede3_mod_modera(v_slug, null), 'posso', interno.rede_p4_cult_escreve(v_slug, v),
    'livros', (select coalesce(jsonb_agg(interno.rede_p4_livro_json(l, v) order by array_position(array['lendo', 'proximo', 'lido'], l.situacao), l.criado_em desc), '[]'::jsonb)
      from rede_p4_livros l where l.comunidade = v_slug));
end $$;

/** Põe um livro na estante (quem é da comunidade). Entra como "próximo". No máximo 100 por comunidade. */
create or replace function public.rede_p4_livro_por(p jsonb) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid; v_slug text; l rede_p4_livros;
begin
  perform interno.alumia_porta();
  v := interno.eu();
  perform interno.rede_p4_cultura_exige();
  perform interno.aberta('comunidade');
  if p is null or jsonb_typeof(p) <> 'object' then perform interno.erro('invalido:livro'); end if;
  v_slug := interno.rede_p4_cult_comunidade(p ->> 'comunidade', v);
  if not interno.rede_p4_cult_escreve(v_slug, v) then perform interno.erro('sem_permissao'); end if;
  perform interno.limite('p4_cultura_escrever', 60, 60);
  if (select count(*) from rede_p4_livros where comunidade = v_slug) >= 100 then perform interno.erro('muitas'); end if;
  insert into rede_p4_livros (comunidade, titulo, autoria, por)
  values (v_slug, interno.txt(p ->> 'titulo', 'titulo', 1, 160), interno.txt(p ->> 'autoria', 'autoria', 0, 120), v)
  returning * into l;
  return interno.rede_p4_livro_json(l, v);
end $$;

/** Muda a situação do livro (lendo, próximo, lido): só a moderação da comunidade. */
create or replace function public.rede_p4_livro_situacao(p_id uuid, p_situacao text) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid; l rede_p4_livros;
begin
  perform interno.alumia_porta();
  v := interno.eu();
  perform interno.rede_p4_cultura_exige();
  if coalesce(p_situacao, '') not in ('proximo', 'lendo', 'lido') then perform interno.erro('invalido:situacao'); end if;
  update rede_p4_livros set situacao = p_situacao where id = p_id and interno.rede3_mod_modera(comunidade, null) returning * into l;
  if l.id is null then perform interno.erro('nao_encontrado'); end if;
  return interno.rede_p4_livro_json(l, v);
end $$;

/** Tira o livro da estante (com o progresso e as citações): quem pôs ou a moderação. */
create or replace function public.rede_p4_livro_tirar(p_id uuid) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid;
begin
  perform interno.alumia_porta();
  v := interno.eu();
  perform interno.rede_p4_cultura_exige();
  delete from rede_p4_livros l where l.id = p_id and (l.por = v or interno.rede3_mod_modera(l.comunidade, null));
  if not found then perform interno.erro('nao_encontrado'); end if;
  return jsonb_build_object('tirado', true);
end $$;

/** O progresso de quem chama (0 a 100); nulo apaga. Só o último fica, sem data. Ninguém mais vê o de uma pessoa. */
create or replace function public.rede_p4_leitura_marcar(p_livro uuid, p_pct integer) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid; l rede_p4_livros;
begin
  perform interno.alumia_porta();
  v := interno.eu();
  perform interno.rede_p4_cultura_exige();
  perform interno.aberta('comunidade');
  select * into l from rede_p4_livros where id = p_livro;
  if not found or not interno.rede_p4_cult_le(l.comunidade, v) then perform interno.erro('nao_encontrado'); end if;
  if not interno.rede_p4_cult_escreve(l.comunidade, v) then perform interno.erro('sem_permissao'); end if;
  perform interno.limite('p4_cultura_progresso', 120, 60);
  if p_pct is null then
    delete from rede_p4_leitura where livro = l.id and usuario = v;
  else
    if p_pct < 0 or p_pct > 100 then perform interno.erro('invalido:pct'); end if;
    insert into rede_p4_leitura (livro, usuario, pct) values (l.id, v, p_pct) on conflict (livro, usuario) do update set pct = excluded.pct;
  end if;
  return interno.rede_p4_livro_json(l, v);
end $$;

/** Uma citação do livro (3 a 500 letras e a página, opcional). Sai sem o nome de quem pôs. */
create or replace function public.rede_p4_citacao_por(p_livro uuid, p_texto text, p_pagina text default '') returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid; l rede_p4_livros;
begin
  perform interno.alumia_porta();
  v := interno.eu();
  perform interno.rede_p4_cultura_exige();
  perform interno.aberta('comunidade');
  select * into l from rede_p4_livros where id = p_livro;
  if not found or not interno.rede_p4_cult_le(l.comunidade, v) then perform interno.erro('nao_encontrado'); end if;
  if not interno.rede_p4_cult_escreve(l.comunidade, v) then perform interno.erro('sem_permissao'); end if;
  perform interno.limite('p4_cultura_escrever', 60, 60);
  insert into rede_p4_citacoes (livro, por, texto, pagina) values (l.id, v, interno.txt(p_texto, 'texto', 3, 500), interno.txt(p_pagina, 'pagina', 0, 20));
  return interno.rede_p4_livro_json(l, v);
end $$;

/** Tira a citação: quem pôs ou a moderação. */
create or replace function public.rede_p4_citacao_tirar(p_id uuid) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid;
begin
  perform interno.alumia_porta();
  v := interno.eu();
  perform interno.rede_p4_cultura_exige();
  delete from rede_p4_citacoes c using rede_p4_livros l where c.id = p_id and l.id = c.livro and (c.por = v or interno.rede3_mod_modera(l.comunidade, null));
  if not found then perform interno.erro('nao_encontrado'); end if;
  return jsonb_build_object('tirada', true);
end $$;

-- ── 8. Item 42: playlist coletiva ──────────────────────────────────────────────────────────────────────────────────────────

/** A playlist da comunidade: os links, do mais novo ao mais antigo (até 100). Sem o nome de quem pôs. */
create or replace function public.rede_p4_playlist(p_comunidade text) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid; v_slug text;
begin
  perform interno.alumia_porta();
  v := interno.eu();
  perform interno.rede_p4_cultura_exige();
  perform interno.aberta('comunidade');
  perform interno.limite('rede2_ler', 600, 60);
  v_slug := interno.rede_p4_cult_comunidade(p_comunidade, v);
  return jsonb_build_object('comunidade', v_slug, 'modero', interno.rede3_mod_modera(v_slug, null), 'posso', interno.rede_p4_cult_escreve(v_slug, v),
    'itens', (select coalesce(jsonb_agg(jsonb_build_object('id', x.id, 'url', x.url, 'titulo', x.titulo, 'dominio', x.dominio, 'imagem', x.imagem,
        'nota', x.nota, 'minha', x.por = v) order by x.criado_em desc), '[]'::jsonb)
      from (select * from rede_p4_playlist where comunidade = v_slug order by criado_em desc limit 100) x));
end $$;

/**
 * Põe um link na playlist (quem é da comunidade). Só http ou https, sem usuário e senha na frente. O domínio é tirado do próprio
 * link aqui (o que vier do aparelho não conta); a imagem só é aceita se for do proxy assinado do nosso servidor. Até 300 por comunidade.
 */
create or replace function public.rede_p4_playlist_por(p jsonb) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid; v_slug text; v_url text; v_dominio text; v_imagem text; v_id uuid;
begin
  perform interno.alumia_porta();
  v := interno.eu();
  perform interno.rede_p4_cultura_exige();
  perform interno.aberta('comunidade');
  if p is null or jsonb_typeof(p) <> 'object' then perform interno.erro('invalido:link'); end if;
  v_slug := interno.rede_p4_cult_comunidade(p ->> 'comunidade', v);
  if not interno.rede_p4_cult_escreve(v_slug, v) then perform interno.erro('sem_permissao'); end if;
  perform interno.limite('p4_cultura_escrever', 60, 60);
  v_url := btrim(coalesce(p ->> 'url', ''));
  if char_length(v_url) not between 10 and 500 or v_url !~* '^https?://[^/@\s]+(/\S*)?$' then perform interno.erro('invalido:url'); end if;
  v_dominio := lower(substring(v_url from '^[A-Za-z]+://([^/:?#]+)'));
  if v_dominio is null or v_dominio !~ '^[a-z0-9.-]+\.[a-z0-9-]{2,}$' or char_length(v_dominio) > 120 then perform interno.erro('invalido:url'); end if;
  v_imagem := nullif(btrim(coalesce(p ->> 'imagem', '')), '');
  if v_imagem is not null and (v_imagem not like '/api/rede/previa/imagem?%' or char_length(v_imagem) > 1500) then v_imagem := null; end if;
  if (select count(*) from rede_p4_playlist where comunidade = v_slug) >= 300 then perform interno.erro('muitas'); end if;
  insert into rede_p4_playlist (comunidade, url, titulo, dominio, imagem, nota, por)
  values (v_slug, v_url, interno.txt(coalesce(nullif(btrim(p ->> 'titulo'), ''), v_dominio), 'titulo', 1, 140), v_dominio, v_imagem,
          interno.txt(p ->> 'nota', 'nota', 0, 200), v)
  on conflict (comunidade, url) do nothing
  returning id into v_id;
  if v_id is null then perform interno.erro('ja_ligado'); end if;
  return jsonb_build_object('id', v_id, 'dominio', v_dominio);
end $$;

/** Tira o link: quem pôs ou a moderação. */
create or replace function public.rede_p4_playlist_tirar(p_id uuid) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid;
begin
  perform interno.alumia_porta();
  v := interno.eu();
  perform interno.rede_p4_cultura_exige();
  delete from rede_p4_playlist x where x.id = p_id and (x.por = v or interno.rede3_mod_modera(x.comunidade, null));
  if not found then perform interno.erro('nao_encontrado'); end if;
  return jsonb_build_object('tirado', true);
end $$;

-- ── 9. Permissões ──────────────────────────────────────────────────────────────────────────────────────────────────────────
-- As funções da tela são só para quem tem sessão (o banco confere a conta de novo em cada uma).
do $$
declare f record;
begin
  for f in select p.oid::regprocedure as assinatura from pg_proc p join pg_namespace n on n.oid = p.pronamespace
           where n.nspname = 'public' and p.proname like 'rede\_p4\_%' and p.proname not like 'rede\_p4\_cifrado%'
             and p.proname in ('rede_p4_cultura_ligado', 'rede_p4_cultura_inicio', 'rede_p4_obra_criar', 'rede_p4_obra_apagar', 'rede_p4_obra_capitulo',
               'rede_p4_obra_capitulo_tirar', 'rede_p4_obras', 'rede_p4_obra', 'rede_p4_obra_seguir', 'rede_p4_peca_criar', 'rede_p4_peca_tirar', 'rede_p4_mural',
               'rede_p4_cine', 'rede_p4_cine_marcar', 'rede_p4_cine_desmarcar', 'rede_p4_cine_anotar', 'rede_p4_cine_nota_tirar', 'rede_p4_estante',
               'rede_p4_livro_por', 'rede_p4_livro_situacao', 'rede_p4_livro_tirar', 'rede_p4_leitura_marcar', 'rede_p4_citacao_por', 'rede_p4_citacao_tirar',
               'rede_p4_playlist', 'rede_p4_playlist_por', 'rede_p4_playlist_tirar') loop
    execute format('revoke all on function %s from public', f.assinatura);
    if exists (select 1 from pg_roles where rolname = 'anon') then
      execute format('revoke all on function %s from anon', f.assinatura);
      execute format('grant execute on function %s to authenticated', f.assinatura);
    end if;
  end loop;
end $$;

select interno.alumia_trancar();
