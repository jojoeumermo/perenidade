-- ───────────────────────────── Rede Lúcia v2: pacote descoberta (Etapa 7, R4, itens 29 a 35) ─────────────────────────────
-- Migração acrescentável: pode rodar mais de uma vez, sem apagar dado nenhum. Roda DEPOIS da fundação
-- (2026-11-rede-fundacao.sql: interno.rede_ve, rede_post_v2, rede_aba, rede_na_aba) e dos pacotes consertos e perfil.
-- Contrato: docs/rede/V2.md. Teste: npm run testar:rede-descoberta.
--
-- O que este arquivo faz, e só isto:
--   29. Primeira entrada guiada: o estado de cada passo (regras, consentimento, idade, codinome, 3 lutas + 3 trilhas, guia
--       de 4 cartões; só o guia pode ser pulado) e a gravação das escolhas.
--   30. Pacotes de pessoas para seguir, curados pela equipe; só entra perfil ABERTO cuja dona ou dono aceitou aparecer.
--   31. Linhas temáticas com regra pública escrita (ex.: "Greves: posts com #greve nas comunidades de luta").
--   32. Ordenações com fórmula escrita (novos, úteis, sem resposta, em debate): nenhuma nota escondida, nenhum
--       engajamento; no máximo 100 posts por ordenação (acabou, acabou).
--   33. Hashtag como página (rede_desc_tag). A hashtag nasce do próprio texto; não há tabela de tags.
--   34. Explorar (rede_desc_explorar): comunidades, linhas, pacotes e tags do momento (só tag com 3 autores ou mais).
--   35. Busca full-text em português (rede_desc_buscar): tsvector com configuração portuguese sobre o texto sem acento
--       (assim "educacao" acha "educação"), respeitando a matriz de visibilidade (interno.rede_ve), o que a pessoa
--       silenciou e o perfil invisível (nunca aparece em busca).
--
-- Dado de pessoa: só o que a própria pessoa escolhe (3 lutas, 3 trilhas, aceitar aparecer nos pacotes). Nada é rastreado;
-- contagens só agregadas. Toda leitura de post passa por interno.rede_ve.
--
-- Leis (planalto.gov.br, conferidas em 04/11/2026): LGPD (Lei 13.709/2018) art. 5º, II e art. 11, I (opinião política e
-- filiação sindical são dado sensível: consentimento "de forma específica e destacada", passo próprio da entrada) e art. 14
-- (a Rede é só 18+); aparecer em pacote de pessoas é opcional, desligado por padrão e revogável a qualquer hora (art. 18, IX).

-- ── 1. Ajudantes de texto (sem extensão: funciona no serviço real e no banco local) ──────────────────────────────────────

/** Minúsculas e sem acento, mantendo o resto do texto (não troca letras de outros alfabetos). */
create or replace function interno.rede3_desc_sa(p text) returns text language sql immutable parallel safe as $$
  select translate(lower(coalesce(p, '')), 'áàâãäéèêëíìîïóòôõöúùûüçñ', 'aaaaaeeeeiiiiooooouuuucn')
$$;

/** As hashtags de um post (título, texto e corpo), sem acento e em minúsculas, sem repetir. "#2026" sozinho não é tag. */
create or replace function interno.rede3_desc_tags(p_titulo text, p_texto text, p_corpo text) returns text[] language sql immutable parallel safe as $$
  select coalesce(array(
    select distinct m[1]
    from regexp_matches(interno.rede3_desc_sa(coalesce(p_titulo, '') || ' ' || coalesce(p_texto, '') || ' ' || coalesce(p_corpo, '')),
                        '(?:^|[^a-z0-9_/&#])#([a-z0-9_]{2,40})(?![a-z0-9_])', 'g') as m
    where m[1] ~ '[a-z_]'
    order by 1), '{}'::text[])
$$;

/** O texto pesquisável de um post: configuração portuguesa sobre o texto sem acento. */
create or replace function interno.rede3_desc_doc(p_titulo text, p_texto text, p_corpo text) returns tsvector language sql immutable parallel safe as $$
  select to_tsvector('portuguese', interno.rede3_desc_sa(coalesce(p_titulo, '') || ' ' || coalesce(p_texto, '') || ' ' || coalesce(p_corpo, '')))
$$;

create index if not exists rede_posts_desc_tags on interno.rede_posts using gin (interno.rede3_desc_tags(titulo, texto, corpo));
create index if not exists rede_posts_desc_doc on interno.rede_posts using gin (interno.rede3_desc_doc(titulo, texto, corpo));

/** A hashtag pedida (com ou sem #, com ou sem acento) na forma do banco; recusa o que não é tag. */
create or replace function interno.rede3_desc_tag_norm(p text) returns text language plpgsql stable as $$
declare v text := regexp_replace(interno.rede3_desc_sa(btrim(coalesce(p, ''))), '^#', '');
begin
  if v !~ '^[a-z0-9_]{2,40}$' or v !~ '[a-z_]' then perform interno.erro('invalido:tag'); end if;
  return v;
end $$;

-- ── 2. Tabelas do pacote (só por função; RLS ligada e nenhuma permissão para os papéis do cliente) ───────────────────────

-- O que a pessoa escolheu na primeira entrada: lutas (slug de comunidade) e trilhas (slug de trilha).
create table if not exists interno.rede_desc_interesses (
  usuario uuid not null references interno.perfis (id) on delete cascade,
  tipo text not null check (tipo in ('luta', 'trilha')),
  chave text not null check (chave ~ '^[a-z0-9-]{2,80}$'),
  criado_em timestamptz not null default now(),
  primary key (usuario, tipo, chave)
);

-- Onde a pessoa está na primeira entrada, e se aceitou aparecer nos pacotes de pessoas.
create table if not exists interno.rede_desc_entrada (
  usuario uuid primary key references interno.perfis (id) on delete cascade,
  escolhas_em timestamptz,
  guia_em timestamptz,
  guia_pulado boolean not null default false,
  aparece boolean not null default false,
  aparece_em timestamptz
);

create table if not exists interno.rede_desc_pacotes (
  slug text primary key check (slug ~ '^[a-z0-9-]{2,60}$'),
  titulo text not null check (char_length(titulo) between 3 and 80),
  descricao text not null default '' check (char_length(descricao) <= 300),
  ordem smallint not null default 0,
  ativo boolean not null default true,
  criado_em timestamptz not null default now()
);
create table if not exists interno.rede_desc_pacote_pessoas (
  pacote text not null references interno.rede_desc_pacotes (slug) on delete cascade on update cascade,
  usuario uuid not null references interno.perfis (id) on delete cascade,
  primary key (pacote, usuario)
);

-- Linha temática: um filtro simples E a regra escrita em português claro, pública. A função que grava confere que a regra cita o filtro.
create table if not exists interno.rede_desc_linhas (
  slug text primary key check (slug ~ '^[a-z0-9-]{2,60}$'),
  titulo text not null check (char_length(titulo) between 3 and 60),
  regra text not null check (char_length(regra) between 10 and 300),
  tag text check (tag is null or tag ~ '^[a-z0-9_]{2,40}$'),
  categoria text check (categoria is null or categoria in ('lutas', 'disciplinas', 'instituto')),
  tipo text check (tipo is null or tipo in ('post', 'discussao', 'duvida', 'chamado', 'enquete', 'aviso')),
  sem_resposta boolean not null default false,
  ordem smallint not null default 0,
  ativo boolean not null default true,
  check (tag is not null or categoria is not null or tipo is not null or sem_resposta)
);

alter table interno.rede_desc_interesses enable row level security;
alter table interno.rede_desc_entrada enable row level security;
alter table interno.rede_desc_pacotes enable row level security;
alter table interno.rede_desc_pacote_pessoas enable row level security;
alter table interno.rede_desc_linhas enable row level security;
revoke all on interno.rede_desc_interesses, interno.rede_desc_entrada, interno.rede_desc_pacotes, interno.rede_desc_pacote_pessoas, interno.rede_desc_linhas from public;

-- As linhas de partida: regras simples, escritas aqui para qualquer pessoa conferir.
insert into interno.rede_desc_linhas (slug, titulo, regra, tag, categoria, tipo, sem_resposta, ordem) values
  ('greves', 'Greves', 'Posts com #greve nas comunidades de luta.', 'greve', 'lutas', null, false, 1),
  ('moradia', 'Moradia', 'Posts com #moradia nas comunidades de luta.', 'moradia', 'lutas', null, false, 2),
  ('saude', 'Saúde', 'Posts com #saude nas comunidades de luta.', 'saude', 'lutas', null, false, 3),
  ('duvidas-abertas', 'Dúvidas abertas', 'Dúvidas das comunidades de disciplinas que ainda não receberam nenhuma resposta.', null, 'disciplinas', 'duvida', true, 4)
on conflict (slug) do nothing;

-- ── 3. Quem pode aparecer num pacote de pessoas ────────────────────────────────────────────────────────────────────────

/**
 * Esta pessoa pode aparecer para quem pergunta (p_quem)? Só perfil ABERTO (nem trancado nem invisível), com @nome e codinome
 * confirmados, dentro da Rede, sem bloqueio entre as duas e que aceitou aparecer (desligado por padrão).
 */
create or replace function interno.rede3_desc_elegivel(f interno.perfis, p_quem uuid) returns boolean language sql stable security definer set search_path = interno, pg_temp as $$
  select f.rede_modo = 'aberto' and not f.rede_invisivel and not f.suspenso
    and f.rede_handle is not null and f.rede_codinome is not null and f.rede_codinome_ok
    and interno.rede2_membro(f.id)
    and exists (select 1 from rede_desc_entrada e where e.usuario = f.id and e.aparece)
    and not interno.rede_bloqueado(p_quem, f.id)
$$;

-- ── 4. Primeira entrada guiada ─────────────────────────────────────────────────────────────────────────────────────────

/**
 * Em que passo a pessoa está: entrar (sem conta), regras (regras, consentimento destacado e idade 18+: tudo isso grava em
 * rede_aderir), codinome, escolhas (3 lutas + 3 trilhas), guia (4 cartões; pode ser pulado) ou pronto.
 */
create or replace function public.rede_desc_entrada_estado() returns jsonb language plpgsql stable security definer set search_path = interno, pg_temp as $$
declare v uuid := auth.uid(); f perfis; e rede_desc_entrada; v_passo text; v_regras integer := coalesce((select max(versao) from rede_regras), 1);
begin
  if v is null then return jsonb_build_object('passo', 'entrar', 'regras_versao', v_regras); end if;
  select * into f from perfis where id = v;
  if not found then return jsonb_build_object('passo', 'entrar', 'regras_versao', v_regras); end if;
  select * into e from rede_desc_entrada where usuario = v;
  v_passo := case
    when f.suspenso then 'suspensa'
    when not interno.rede2_membro(v) then 'regras'
    when not (f.rede_codinome_ok and f.rede_codinome is not null) then 'codinome'
    when e.escolhas_em is null then 'escolhas'
    when e.guia_em is null and not coalesce(e.guia_pulado, false) then 'guia'
    else 'pronto' end;
  return jsonb_build_object(
    'passo', v_passo, 'regras_versao', v_regras, 'codinome', f.rede_codinome,
    'escolhas', e.escolhas_em is not null, 'guia', e.guia_em is not null or coalesce(e.guia_pulado, false),
    'aparece', coalesce(e.aparece, false),
    'lutas', (select coalesce(jsonb_agg(i.chave order by i.chave), '[]'::jsonb) from rede_desc_interesses i where i.usuario = v and i.tipo = 'luta'),
    'trilhas', (select coalesce(jsonb_agg(i.chave order by i.chave), '[]'::jsonb) from rede_desc_interesses i where i.usuario = v and i.tipo = 'trilha'));
end $$;

/**
 * As lutas (comunidades de luta abertas ou restritas) que a pessoa pode escolher: o passo "3 lutas". As trilhas vêm do catálogo
 * do site (a tela as lista); aqui só se guarda o que foi escolhido.
 */
create or replace function public.rede_desc_entrada_opcoes() returns jsonb language plpgsql stable security definer set search_path = interno, pg_temp as $$
begin
  perform interno.eu();
  return jsonb_build_object('lutas', (
    select coalesce(jsonb_agg(jsonb_build_object('slug', c.slug, 'nome', c.nome, 'descricao', c.descricao, 'cor', c.cor) order by c.nome), '[]'::jsonb)
    from rede_comunidades c where c.categoria = 'lutas' and c.tipo <> 'fechada'));
end $$;

/**
 * Grava as escolhas: até 3 lutas (exatamente 3, ou todas se houver menos de 3) e de 1 a 3 trilhas. Quem escolhe entra nas comunidades
 * abertas ligadas (a luta escolhida e as que citam a trilha); nunca desfaz banimento nem entra em comunidade restrita ou fechada.
 * Pode ser chamada de novo para mudar as escolhas. p_aparece liga ou desliga "aparecer nos pacotes de pessoas" (desligado por padrão).
 */
create or replace function public.rede_desc_entrada_escolher(p_lutas text[], p_trilhas text[], p_aparece boolean default false) returns jsonb
language plpgsql security definer set search_path = interno, pg_temp as $$
declare
  v uuid := interno.eu(); f perfis;
  v_lutas text[] := coalesce((select array_agg(distinct x) from unnest(coalesce(p_lutas, '{}')) x), '{}');
  v_trilhas text[] := coalesce((select array_agg(distinct x) from unnest(coalesce(p_trilhas, '{}')) x), '{}');
  v_disponiveis integer;
  x text;
begin
  perform interno.aberta('comunidade');
  perform interno.rede2_limite('seguir');
  select * into f from perfis where id = v;
  if not f.rede_18 then perform interno.erro('confirme_idade'); end if;
  if not interno.rede2_membro(v) then perform interno.erro('consentimento'); end if;
  if not (f.rede_codinome_ok and f.rede_codinome is not null) then perform interno.erro('confirme_codinome'); end if;

  select count(*)::integer into v_disponiveis from rede_comunidades c where c.categoria = 'lutas' and c.tipo <> 'fechada';
  if cardinality(v_lutas) > 3 or cardinality(v_lutas) <> least(3, v_disponiveis) then perform interno.erro('invalido:lutas'); end if;
  foreach x in array v_lutas loop
    if not exists (select 1 from rede_comunidades c where c.slug = x and c.categoria = 'lutas' and c.tipo <> 'fechada') then perform interno.erro('invalido:lutas'); end if;
  end loop;
  if cardinality(v_trilhas) < 1 or cardinality(v_trilhas) > 3 then perform interno.erro('invalido:trilhas'); end if;
  foreach x in array v_trilhas loop
    if x !~ '^[a-z0-9-]{2,80}$' then perform interno.erro('invalido:trilhas'); end if;
  end loop;

  delete from rede_desc_interesses where usuario = v;
  insert into rede_desc_interesses (usuario, tipo, chave) select v, 'luta', unnest(v_lutas);
  insert into rede_desc_interesses (usuario, tipo, chave) select v, 'trilha', unnest(v_trilhas);
  -- Entra nas comunidades abertas (sem tocar em quem já é membro ou está banido: o conflito não muda nada).
  insert into rede_comunidade_membros (comunidade, usuario)
    select c.slug, v from rede_comunidades c where c.tipo = 'aberta' and (c.slug = any (v_lutas) or c.trilhas && v_trilhas)
    on conflict (comunidade, usuario) do nothing;
  insert into rede_desc_entrada (usuario, escolhas_em, aparece, aparece_em) values (v, now(), coalesce(p_aparece, false), case when p_aparece then now() end)
    on conflict (usuario) do update set escolhas_em = now(), aparece = coalesce(p_aparece, false), aparece_em = case when p_aparece then coalesce(rede_desc_entrada.aparece_em, now()) end;
  perform interno.registrar('rede_desc_escolhas', '', jsonb_build_object('lutas', cardinality(v_lutas), 'trilhas', cardinality(v_trilhas)));
  return public.rede_desc_entrada_estado();
end $$;

/** O guia de segurança (4 cartões): visto ou pulado. É o único passo que se pode pular. */
create or replace function public.rede_desc_entrada_guia(p_pulado boolean default false) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu();
begin
  if not interno.rede2_membro(v) then perform interno.erro('consentimento'); end if;
  insert into rede_desc_entrada (usuario, guia_em, guia_pulado) values (v, case when not coalesce(p_pulado, false) then now() end, coalesce(p_pulado, false))
    on conflict (usuario) do update set guia_em = case when not coalesce(p_pulado, false) then now() else rede_desc_entrada.guia_em end,
                                        guia_pulado = coalesce(p_pulado, false);
  return public.rede_desc_entrada_estado();
end $$;

/** Aceitar (ou deixar de) aparecer nos pacotes de pessoas para seguir. Desligado por padrão; vale já na próxima leitura. */
create or replace function public.rede_desc_aparecer(p_sim boolean) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu();
begin
  if not interno.rede2_membro(v) then perform interno.erro('consentimento'); end if;
  insert into rede_desc_entrada (usuario, aparece, aparece_em) values (v, coalesce(p_sim, false), case when p_sim then now() end)
    on conflict (usuario) do update set aparece = coalesce(p_sim, false), aparece_em = case when p_sim then coalesce(rede_desc_entrada.aparece_em, now()) end;
  return public.rede_desc_entrada_estado();
end $$;

-- ── 5. Pacotes de pessoas para seguir ──────────────────────────────────────────────────────────────────────────────────

/** Um pacote e quem está nele para esta pessoa (só perfis abertos que aceitaram aparecer). */
create or replace function public.rede_desc_pacote(p_slug text) returns jsonb language plpgsql stable security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); k rede_desc_pacotes;
begin
  perform interno.aberta('comunidade');
  select * into k from rede_desc_pacotes where slug = coalesce(p_slug, '') and ativo;
  if not found then perform interno.erro('nao_encontrado'); end if;
  return jsonb_build_object('slug', k.slug, 'titulo', k.titulo, 'descricao', k.descricao,
    'pessoas', (select coalesce(jsonb_agg(jsonb_build_object(
        'codinome', f.rede_codinome, 'handle', f.rede_handle, 'bio', f.rede_bio, 'equipe', interno.voluntario_e(f.id),
        'sigo', exists (select 1 from rede_seguindo s where s.quem = v and s.segue = f.id and not s.pendente)) order by f.rede_codinome), '[]'::jsonb)
      from rede_desc_pacote_pessoas pp join perfis f on f.id = pp.usuario
      where pp.pacote = k.slug and f.id <> v and interno.rede3_desc_elegivel(f, v)));
end $$;

/** Seguir o pacote inteiro de uma vez (no máximo 30 pessoas). Perfil aberto: não há pedido pendente. Devolve quantas pessoas passou a seguir. */
create or replace function public.rede_desc_pacote_seguir(p_slug text) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); k rede_desc_pacotes; n integer;
begin
  perform interno.aberta('comunidade');
  if not interno.rede2_membro(v) then perform interno.erro('consentimento'); end if;
  perform interno.rede2_limite('seguir');
  select * into k from rede_desc_pacotes where slug = coalesce(p_slug, '') and ativo;
  if not found then perform interno.erro('nao_encontrado'); end if;
  with novos as (
    insert into rede_seguindo (quem, segue)
    select v, f.id from rede_desc_pacote_pessoas pp join perfis f on f.id = pp.usuario
    where pp.pacote = k.slug and f.id <> v and interno.rede3_desc_elegivel(f, v)
    order by f.rede_codinome limit 30
    on conflict do nothing
    returning 1)
  select count(*)::integer into n from novos;
  return jsonb_build_object('seguidos', n);
end $$;

/** Equipe: cria ou muda um pacote. */
create or replace function public.rede_desc_pacote_salvar(p_slug text, p_titulo text, p_descricao text default '', p_ordem integer default 0, p_ativo boolean default true) returns jsonb
language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu();
begin
  if not interno.cuida() then perform interno.erro('sem_permissao'); end if;
  if coalesce(p_slug, '') !~ '^[a-z0-9-]{2,60}$' then perform interno.erro('invalido:slug'); end if;
  if char_length(btrim(coalesce(p_titulo, ''))) not between 3 and 80 then perform interno.erro('invalido:titulo'); end if;
  if char_length(coalesce(p_descricao, '')) > 300 then perform interno.erro('invalido:descricao'); end if;
  insert into rede_desc_pacotes (slug, titulo, descricao, ordem, ativo) values (p_slug, btrim(p_titulo), coalesce(p_descricao, ''), least(greatest(coalesce(p_ordem, 0), -100), 100), coalesce(p_ativo, true))
    on conflict (slug) do update set titulo = excluded.titulo, descricao = excluded.descricao, ordem = excluded.ordem, ativo = excluded.ativo;
  perform interno.registrar('rede_desc_pacote', p_slug, jsonb_build_object('ativo', coalesce(p_ativo, true)));
  return jsonb_build_object('slug', p_slug);
end $$;

/** Equipe: põe uma pessoa no pacote (ou tira). Só quem tem perfil aberto e aceitou aparecer; senão "invalido:pessoa". */
create or replace function public.rede_desc_pacote_pessoa(p_slug text, p_handle text, p_sim boolean) returns jsonb
language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); f perfis;
begin
  if not interno.cuida() then perform interno.erro('sem_permissao'); end if;
  if not exists (select 1 from rede_desc_pacotes where slug = coalesce(p_slug, '')) then perform interno.erro('nao_encontrado'); end if;
  select * into f from perfis where rede_handle = lower(btrim(coalesce(p_handle, ''), ' @'));
  if not found then perform interno.erro('nao_encontrado'); end if;
  if coalesce(p_sim, false) then
    -- Eleição "como se fosse" outra pessoa de fora: bloqueios entre a equipe e a pessoa não valem para a curadoria.
    if not interno.rede3_desc_elegivel(f, null) then perform interno.erro('invalido:pessoa'); end if;
    insert into rede_desc_pacote_pessoas (pacote, usuario) values (p_slug, f.id) on conflict do nothing;
  else
    delete from rede_desc_pacote_pessoas where pacote = p_slug and usuario = f.id;
  end if;
  perform interno.registrar('rede_desc_pacote_pessoa', p_slug, jsonb_build_object('entrou', coalesce(p_sim, false)));
  return jsonb_build_object('ok', true);
end $$;

-- ── 6. Linhas temáticas com regra pública ──────────────────────────────────────────────────────────────────────────────

/** Equipe: cria ou muda uma linha temática. A regra escrita precisa citar o filtro (a #tag), para texto e filtro nunca divergirem. */
create or replace function public.rede_desc_linha_salvar(p_slug text, p_titulo text, p_regra text, p_tag text default null, p_categoria text default null,
  p_tipo text default null, p_sem_resposta boolean default false, p_ordem integer default 0, p_ativo boolean default true) returns jsonb
language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); v_tag text := case when nullif(btrim(coalesce(p_tag, '')), '') is null then null else interno.rede3_desc_tag_norm(p_tag) end;
begin
  if not interno.cuida() then perform interno.erro('sem_permissao'); end if;
  if coalesce(p_slug, '') !~ '^[a-z0-9-]{2,60}$' then perform interno.erro('invalido:slug'); end if;
  if char_length(btrim(coalesce(p_titulo, ''))) not between 3 and 60 then perform interno.erro('invalido:titulo'); end if;
  if char_length(btrim(coalesce(p_regra, ''))) not between 10 and 300 then perform interno.erro('invalido:regra'); end if;
  if v_tag is null and p_categoria is null and p_tipo is null and not coalesce(p_sem_resposta, false) then perform interno.erro('invalido:filtro'); end if;
  if v_tag is not null and position('#' || v_tag in interno.rede3_desc_sa(p_regra)) = 0 then perform interno.erro('invalido:regra'); end if;
  insert into rede_desc_linhas (slug, titulo, regra, tag, categoria, tipo, sem_resposta, ordem, ativo)
    values (p_slug, btrim(p_titulo), btrim(p_regra), v_tag, p_categoria, p_tipo, coalesce(p_sem_resposta, false), least(greatest(coalesce(p_ordem, 0), -100), 100), coalesce(p_ativo, true))
    on conflict (slug) do update set titulo = excluded.titulo, regra = excluded.regra, tag = excluded.tag, categoria = excluded.categoria, tipo = excluded.tipo,
      sem_resposta = excluded.sem_resposta, ordem = excluded.ordem, ativo = excluded.ativo;
  perform interno.registrar('rede_desc_linha', p_slug, jsonb_build_object('ativo', coalesce(p_ativo, true)));
  return jsonb_build_object('slug', p_slug);
end $$;

-- ── 7. A linha com ordenação e filtros (o coração do pacote) ───────────────────────────────────────────────────────────

/**
 * Resolve e confere os filtros: {linha, tag, categoria, tipo, comunidade}. Uma linha temática traz o próprio filtro; a tag
 * explícita só vale quando a linha não tem uma.
 */
create or replace function interno.rede3_desc_filtros(p_filtros jsonb) returns jsonb language plpgsql stable security definer set search_path = interno, pg_temp as $$
declare
  f jsonb := coalesce(p_filtros, '{}'::jsonb);
  l rede_desc_linhas;
  v_tag text; v_cat text; v_tipo text; v_sem boolean := false; v_com text;
begin
  if jsonb_typeof(f) <> 'object' then perform interno.erro('invalido:filtros'); end if;
  if nullif(f ->> 'linha', '') is not null then
    select * into l from rede_desc_linhas where slug = f ->> 'linha' and ativo;
    if not found then perform interno.erro('nao_encontrado'); end if;
    v_tag := l.tag; v_cat := l.categoria; v_tipo := l.tipo; v_sem := l.sem_resposta;
  end if;
  if v_tag is null and nullif(f ->> 'tag', '') is not null then v_tag := interno.rede3_desc_tag_norm(f ->> 'tag'); end if;
  if v_cat is null and nullif(f ->> 'categoria', '') is not null then v_cat := f ->> 'categoria'; end if;
  if v_tipo is null and nullif(f ->> 'tipo', '') is not null then v_tipo := f ->> 'tipo'; end if;
  if v_cat is not null and v_cat not in ('lutas', 'disciplinas', 'instituto') then perform interno.erro('invalido:categoria'); end if;
  if v_tipo is not null and v_tipo not in ('post', 'discussao', 'duvida', 'chamado', 'enquete', 'aviso') then perform interno.erro('invalido:tipo'); end if;
  if nullif(f ->> 'comunidade', '') is not null then
    v_com := f ->> 'comunidade';
    if v_com !~ '^[a-z0-9-]{2,60}$' then perform interno.erro('invalido:comunidade'); end if;
  end if;
  return jsonb_strip_nulls(jsonb_build_object('tag', v_tag, 'categoria', v_cat, 'tipo', v_tipo, 'sem_resposta', case when v_sem then true end, 'comunidade', v_com));
end $$;

/**
 * Uma página de posts em ordem escrita. Ordens (a fórmula inteira, sem nota escondida):
 *   novos         do mais novo para o mais velho;
 *   uteis         quantas pessoas marcaram "útil" (do maior para o menor); empate: o mais novo; só os últimos 30 dias;
 *   sem_resposta  posts de primeiro nível sem nenhuma resposta que esta pessoa possa ver e sem resposta aceita, do mais novo; últimos 30 dias;
 *   em_debate     respostas dos últimos 7 dias na conversa (só as que esta pessoa pode ver); empate: o mais novo; últimos 30 dias;
 *   relevancia    (só busca) ts_rank_cd do texto contra a busca, arredondado; empate: o mais novo.
 * Nenhuma ordem usa tempo de leitura, cliques ou "engajamento". Cada ordenação entrega no máximo 100 posts: depois disso a lista
 * acaba (a pessoa refina por tag, comunidade ou busca). O cursor é "nota|criado_em|id|quantos já saíram" (sem repetir nem pular).
 * Toda linha passa por interno.rede_ve e pelo que a pessoa silenciou. Só posts de primeiro nível, menos na busca (acha respostas).
 */
create or replace function interno.rede3_desc_pagina(p_aba text, p_ordem text, p_cursor text, p_limite integer, p_filtros jsonb, p_quem uuid, p_tsq tsquery default null) returns jsonb
language plpgsql stable security definer set search_path = interno, pg_temp as $$
declare
  v_busca boolean := p_tsq is not null;
  v_ordem text := coalesce(nullif(p_ordem, ''), case when p_tsq is not null then 'relevancia' else 'novos' end);
  v_aba text := case when p_tsq is not null then 'busca' else interno.rede_aba(coalesce(p_aba, ''), p_quem) end;
  v_f jsonb := interno.rede3_desc_filtros(p_filtros);
  v_tag text := v_f ->> 'tag'; v_cat text := v_f ->> 'categoria'; v_tipo text := v_f ->> 'tipo'; v_com text := v_f ->> 'comunidade';
  v_sem boolean := coalesce((v_f ->> 'sem_resposta')::boolean, false) or v_ordem = 'sem_resposta';
  v_janela boolean := v_ordem in ('uteis', 'sem_resposta', 'em_debate');
  v_lim integer := least(greatest(coalesce(p_limite, 20), 1), 50);
  v_n integer := 0; v_cs numeric; v_ct timestamptz; v_ci uuid;
  v_ids uuid[]; v_notas numeric[]; v_tempos timestamptz[]; v_itens jsonb; v_proximo text; v_fim boolean := false;
  c_teto constant integer := 100;
begin
  if (v_busca and v_ordem not in ('relevancia', 'novos')) or (not v_busca and v_ordem not in ('novos', 'uteis', 'sem_resposta', 'em_debate')) then
    perform interno.erro('invalido:ordem');
  end if;
  if v_aba = 'nada' then return jsonb_build_object('itens', '[]'::jsonb, 'proximo', null, 'ordem', v_ordem, 'fim_por_teto', false); end if;
  if nullif(p_cursor, '') is not null then
    begin
      v_cs := split_part(p_cursor, '|', 1)::numeric;
      v_ct := split_part(p_cursor, '|', 2)::timestamptz;
      v_ci := split_part(p_cursor, '|', 3)::uuid;
      v_n := split_part(p_cursor, '|', 4)::integer;
    exception when others then
      perform interno.erro('invalido:cursor');
    end;
    if v_n < 0 or v_n > c_teto then perform interno.erro('invalido:cursor'); end if;
  end if;
  v_lim := least(v_lim, c_teto - v_n);
  if v_lim <= 0 then return jsonb_build_object('itens', '[]'::jsonb, 'proximo', null, 'ordem', v_ordem, 'fim_por_teto', true); end if;

  select coalesce(array_agg(b.id order by b.nota desc, b.criado_em desc, b.id desc), '{}'), coalesce(array_agg(b.nota order by b.nota desc, b.criado_em desc, b.id desc), '{}'),
         coalesce(array_agg(b.criado_em order by b.nota desc, b.criado_em desc, b.id desc), '{}')
    into v_ids, v_notas, v_tempos
  from (
    select s.id, s.criado_em, s.nota from (
      select p.id, p.criado_em,
        (case
          when v_busca and v_ordem = 'relevancia' then round(ts_rank_cd(interno.rede3_desc_doc(p.titulo, p.texto, p.corpo), p_tsq)::numeric, 4)
          when v_ordem = 'uteis' then (select count(*) from rede_reacoes r where r.post = p.id and r.tipo = 'util')::numeric
          when v_ordem = 'em_debate' then (select count(*) from rede_posts r where r.root_id = p.id and r.criado_em > now() - interval '7 days' and interno.rede_ve(r, p_quem))::numeric
          else 0::numeric end) as nota
      from rede_posts p
      where p.apagado_em is null
        and (not v_busca or interno.rede3_desc_doc(p.titulo, p.texto, p.corpo) @@ p_tsq)
        and (v_busca or interno.rede_na_aba(p, v_aba, p_quem))
        and (not v_janela or p.criado_em > now() - interval '30 days')
        and (v_tag is null or interno.rede3_desc_tags(p.titulo, p.texto, p.corpo) @> array[v_tag])
        and (v_tipo is null or p.tipo = v_tipo)
        and (v_com is null or p.comunidade = v_com)
        and (v_cat is null or exists (select 1 from rede_comunidades c where c.slug = p.comunidade and c.categoria = v_cat))
        and interno.rede_ve(p, p_quem) and not interno.rede_silenciado(p, p_quem)
        and (not v_sem or (p.resposta_a is null and p.aceita is null and interno.rede2_respostas_visiveis(p.id, p_quem) = 0))
    ) s
    where v_cs is null or (s.nota, s.criado_em, s.id) < (v_cs, v_ct, v_ci)
    order by s.nota desc, s.criado_em desc, s.id desc
    limit v_lim + 1
  ) b;

  if cardinality(v_ids) > v_lim then
    v_ids := v_ids[1:v_lim]; v_notas := v_notas[1:v_lim]; v_tempos := v_tempos[1:v_lim];
    if v_n + v_lim >= c_teto then
      v_fim := true;
    else
      v_proximo := v_notas[v_lim]::text || '|' || v_tempos[v_lim]::text || '|' || v_ids[v_lim]::text || '|' || (v_n + v_lim)::text;
    end if;
  end if;
  select coalesce(jsonb_agg(interno.rede_post_v2(r, p_quem) order by array_position(v_ids, r.id)), '[]'::jsonb) into v_itens
  from rede_posts r where r.id = any (v_ids);
  return jsonb_build_object('itens', v_itens, 'proximo', v_proximo, 'ordem', v_ordem, 'fim_por_teto', v_fim);
end $$;

/**
 * A linha com ordenação e filtros. p_aba: seguindo, comunidades, tudo, geral, c:<slug>, u:<handle> (as mesmas de rede_linha).
 * p_ordem: novos, uteis, sem_resposta, em_debate. p_filtros: {linha, tag, categoria, tipo, comunidade}.
 */
create or replace function public.rede_desc_linha(p_aba text, p_ordem text default 'novos', p_cursor text default null, p_limite integer default 20, p_filtros jsonb default '{}'::jsonb) returns jsonb
language plpgsql volatile security definer set search_path = interno, pg_temp as $$
declare v uuid := auth.uid();
begin
  perform interno.aberta('comunidade');
  if v is not null and exists (select 1 from perfis where id = v and suspenso) then perform interno.erro('conta_suspensa'); end if;
  perform interno.limite('rede2_ler', 600, 60);
  return interno.rede3_desc_pagina(p_aba, p_ordem, p_cursor, p_limite, p_filtros, v);
end $$;

-- ── 8. Hashtag como página ─────────────────────────────────────────────────────────────────────────────────────────────

/**
 * A página de uma hashtag: os posts de primeiro nível que a trazem, só os que esta pessoa pode ver (visitante: só o que é da
 * internet), na ordem pedida. Se a hashtag é de uma linha temática, a regra pública vem junto.
 */
create or replace function public.rede_desc_tag(p_tag text, p_ordem text default 'novos', p_cursor text default null, p_limite integer default 20) returns jsonb
language plpgsql volatile security definer set search_path = interno, pg_temp as $$
declare v uuid := auth.uid(); v_tag text := interno.rede3_desc_tag_norm(p_tag); v_pag jsonb; l rede_desc_linhas;
begin
  perform interno.aberta('comunidade');
  if v is not null and exists (select 1 from perfis where id = v and suspenso) then perform interno.erro('conta_suspensa'); end if;
  perform interno.limite('rede2_ler', 600, 60);
  v_pag := interno.rede3_desc_pagina(case when v is null then 'geral' else 'tudo' end, p_ordem, p_cursor, p_limite, jsonb_build_object('tag', v_tag), v);
  select * into l from rede_desc_linhas where tag = v_tag and ativo order by ordem limit 1;
  return v_pag || jsonb_build_object('tag', v_tag, 'linha', case when l.slug is not null then jsonb_build_object('slug', l.slug, 'titulo', l.titulo, 'regra', l.regra) end);
end $$;

-- ── 9. Busca full-text em português ────────────────────────────────────────────────────────────────────────────────────

/**
 * Busca em português: posts (relevância ou mais novos), pessoas e comunidades. O texto vira minúsculas sem acento dos dois
 * lados, e a configuração portuguesa tira o plural e a conjugação ("greves" acha "greve"). Aceita aspas, "or" e "-" (websearch).
 * Posts: só o que a matriz deixa esta pessoa ver; silenciados ficam de fora; no máximo 100. Pessoas: só dentro da Rede, perfil
 * invisível NUNCA aparece (nem pelo @nome), bloqueio some dos dois lados. Comunidades: fechada só para quem é dela; as de luta e do
 * Instituto só para quem tem conta. Pessoas e comunidades vêm só na primeira página.
 */
create or replace function public.rede_desc_buscar(p_q text, p_ordem text default 'relevancia', p_cursor text default null, p_limite integer default 20) returns jsonb
language plpgsql volatile security definer set search_path = interno, pg_temp as $$
declare
  v uuid := auth.uid();
  v_q text := btrim(regexp_replace(left(coalesce(p_q, ''), 200), '\s+', ' ', 'g'));
  v_sa text; v_tsq tsquery; v_pag jsonb; v_pessoas jsonb := '[]'::jsonb; v_comunidades jsonb := '[]'::jsonb;
  v_h text; v_like text;
begin
  perform interno.aberta('comunidade');
  if v is not null and exists (select 1 from perfis where id = v and suspenso) then perform interno.erro('conta_suspensa'); end if;
  perform interno.rede2_limite('buscar');
  if p_ordem is not null and p_ordem not in ('relevancia', 'novos') then perform interno.erro('invalido:ordem'); end if;
  if char_length(v_q) < 2 then
    return jsonb_build_object('q', v_q, 'curta', true, 'itens', '[]'::jsonb, 'proximo', null, 'ordem', coalesce(p_ordem, 'relevancia'), 'pessoas', '[]'::jsonb, 'comunidades', '[]'::jsonb);
  end if;
  v_sa := interno.rede3_desc_sa(v_q);
  v_tsq := websearch_to_tsquery('portuguese', v_sa);
  if numnode(v_tsq) = 0 then
    return jsonb_build_object('q', v_q, 'so_comuns', true, 'itens', '[]'::jsonb, 'proximo', null, 'ordem', coalesce(p_ordem, 'relevancia'), 'pessoas', '[]'::jsonb, 'comunidades', '[]'::jsonb);
  end if;
  v_pag := interno.rede3_desc_pagina('busca', coalesce(p_ordem, 'relevancia'), p_cursor, p_limite, '{}'::jsonb, v, v_tsq);

  if nullif(p_cursor, '') is null then
    v_like := '%' || replace(replace(replace(regexp_replace(v_sa, '^[@#]', ''), '\', '\\'), '%', '\%'), '_', '\_') || '%';
    v_h := replace(replace(replace(regexp_replace(v_sa, '^@', ''), '\', '\\'), '%', '\%'), '_', '\_') || '%';
    if v is not null then
      select coalesce(jsonb_agg(jsonb_build_object('codinome', z.rede_codinome, 'handle', z.rede_handle, 'equipe', interno.voluntario_e(z.id)) order by z.ex desc, z.rede_codinome), '[]'::jsonb) into v_pessoas
      from (select f.id, f.rede_codinome, f.rede_handle, (f.rede_handle = regexp_replace(v_sa, '^@', '')) as ex
            from perfis f
            where f.rede_handle is not null and f.rede_codinome is not null and f.rede_codinome_ok
              and f.rede_modo <> 'invisivel' and not f.rede_invisivel and not f.suspenso and interno.rede2_membro(f.id)
              and not interno.rede_bloqueado(v, f.id)
              and (f.rede_handle like v_h or interno.rede3_desc_sa(f.rede_codinome) like v_like)
            order by (f.rede_handle = regexp_replace(v_sa, '^@', '')) desc, f.rede_codinome limit 8) z;
    end if;
    select coalesce(jsonb_agg(jsonb_build_object('slug', k.slug, 'nome', k.nome, 'categoria', k.categoria, 'tipo', k.tipo) order by k.nome), '[]'::jsonb) into v_comunidades
    from (select c.* from rede_comunidades c
          where (c.categoria = 'disciplinas' or v is not null)
            and (c.tipo <> 'fechada' or interno.rede2_na_comunidade(c.slug, v))
            and (interno.rede3_desc_sa(c.nome) like v_like or c.slug like v_like or interno.rede3_desc_sa(c.descricao) like v_like)
          order by c.nome limit 8) k;
  end if;
  return v_pag || jsonb_build_object('q', v_q, 'pessoas', v_pessoas, 'comunidades', v_comunidades);
end $$;

-- ── 10. Explorar ───────────────────────────────────────────────────────────────────────────────────────────────────────

/**
 * A página Explorar: comunidades por categoria (as de luta e do Instituto só com conta; fechada só para quem é dela), linhas
 * temáticas com a regra, pacotes de pessoas (só com conta; só traz quantas pessoas), as ordenações e as tags da semana. Tag da
 * semana = hashtag de posts de primeiro nível dos últimos 7 dias que esta pessoa pode ver, usada por 3 autores diferentes ou mais,
 * pelas contas contadas uma vez por post: contagem agregada, nunca de um grupo pequeno. Também devolve o que a pessoa escolheu.
 */
create or replace function public.rede_desc_explorar() returns jsonb language plpgsql volatile security definer set search_path = interno, pg_temp as $$
declare v uuid := auth.uid(); v_tags jsonb; v_com jsonb; v_linhas jsonb; v_pacotes jsonb := '[]'::jsonb; v_eu jsonb := null;
begin
  perform interno.aberta('comunidade');
  if v is not null and exists (select 1 from perfis where id = v and suspenso) then perform interno.erro('conta_suspensa'); end if;
  perform interno.limite('rede2_ler', 600, 60);

  select coalesce(jsonb_agg(jsonb_build_object('tag', t.tag, 'posts', t.n) order by t.n desc, t.tag), '[]'::jsonb) into v_tags
  from (select x.tag, count(*)::integer as n
        from (select p.autor, unnest(interno.rede3_desc_tags(p.titulo, p.texto, p.corpo)) as tag
              from rede_posts p
              where p.id in (select id from rede_posts where criado_em > now() - interval '7 days' and apagado_em is null and resposta_a is null order by criado_em desc limit 3000)
                and interno.rede_ve(p, v) and not interno.rede_silenciado(p, v)) x
        group by x.tag having count(distinct x.autor) >= 3
        order by count(*) desc, x.tag limit 12) t;

  select coalesce(jsonb_agg(jsonb_build_object('slug', c.slug, 'nome', c.nome, 'descricao', c.descricao, 'categoria', c.categoria, 'tipo', c.tipo, 'cor', c.cor,
           'membro', interno.rede2_na_comunidade(c.slug, v)) order by c.categoria, c.nome), '[]'::jsonb) into v_com
  from rede_comunidades c
  where (c.categoria = 'disciplinas' or v is not null) and (c.tipo <> 'fechada' or interno.rede2_na_comunidade(c.slug, v));

  select coalesce(jsonb_agg(jsonb_build_object('slug', l.slug, 'titulo', l.titulo, 'regra', l.regra) order by l.ordem, l.titulo), '[]'::jsonb) into v_linhas
  from rede_desc_linhas l where l.ativo;

  if v is not null then
    select coalesce(jsonb_agg(jsonb_build_object('slug', k.slug, 'titulo', k.titulo, 'descricao', k.descricao, 'pessoas', k.n) order by k.ordem, k.titulo), '[]'::jsonb) into v_pacotes
    from (select pk.slug, pk.titulo, pk.descricao, pk.ordem,
            (select count(*)::integer from rede_desc_pacote_pessoas pp join perfis f on f.id = pp.usuario where pp.pacote = pk.slug and f.id <> v and interno.rede3_desc_elegivel(f, v)) as n
          from rede_desc_pacotes pk where pk.ativo) k
    where k.n > 0;
    v_eu := public.rede_desc_entrada_estado();
  end if;
  return jsonb_build_object('tags', v_tags, 'comunidades', v_com, 'linhas', v_linhas, 'pacotes', v_pacotes, 'ordens', jsonb_build_array('novos', 'uteis', 'sem_resposta', 'em_debate'), 'eu', v_eu);
end $$;

-- ── 11. Permissões ─────────────────────────────────────────────────────────────────────────────────────────────────────
-- Nenhuma função interna é chamável de fora. Leitura: com ou sem conta (a matriz decide o que cada um vê); o resto, só com conta.
revoke all on function interno.rede3_desc_sa(text), interno.rede3_desc_tags(text, text, text), interno.rede3_desc_doc(text, text, text), interno.rede3_desc_tag_norm(text),
  interno.rede3_desc_elegivel(interno.perfis, uuid), interno.rede3_desc_filtros(jsonb),
  interno.rede3_desc_pagina(text, text, text, integer, jsonb, uuid, tsquery) from public;
revoke all on function public.rede_desc_entrada_estado(), public.rede_desc_entrada_opcoes(), public.rede_desc_entrada_escolher(text[], text[], boolean), public.rede_desc_entrada_guia(boolean),
  public.rede_desc_aparecer(boolean), public.rede_desc_pacote(text), public.rede_desc_pacote_seguir(text),
  public.rede_desc_pacote_salvar(text, text, text, integer, boolean), public.rede_desc_pacote_pessoa(text, text, boolean),
  public.rede_desc_linha_salvar(text, text, text, text, text, text, boolean, integer, boolean),
  public.rede_desc_linha(text, text, text, integer, jsonb), public.rede_desc_tag(text, text, text, integer), public.rede_desc_buscar(text, text, text, integer),
  public.rede_desc_explorar() from public;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on function interno.rede3_desc_sa(text), interno.rede3_desc_tags(text, text, text), interno.rede3_desc_doc(text, text, text), interno.rede3_desc_tag_norm(text),
      interno.rede3_desc_elegivel(interno.perfis, uuid), interno.rede3_desc_filtros(jsonb),
      interno.rede3_desc_pagina(text, text, text, integer, jsonb, uuid, tsquery) from anon, authenticated;
    revoke all on interno.rede_desc_interesses, interno.rede_desc_entrada, interno.rede_desc_pacotes, interno.rede_desc_pacote_pessoas, interno.rede_desc_linhas from anon, authenticated;
    revoke all on function public.rede_desc_entrada_estado(), public.rede_desc_entrada_opcoes(), public.rede_desc_entrada_escolher(text[], text[], boolean), public.rede_desc_entrada_guia(boolean),
      public.rede_desc_aparecer(boolean), public.rede_desc_pacote(text), public.rede_desc_pacote_seguir(text),
      public.rede_desc_pacote_salvar(text, text, text, integer, boolean), public.rede_desc_pacote_pessoa(text, text, boolean),
      public.rede_desc_linha_salvar(text, text, text, text, text, text, boolean, integer, boolean),
      public.rede_desc_linha(text, text, text, integer, jsonb), public.rede_desc_tag(text, text, text, integer), public.rede_desc_buscar(text, text, text, integer),
      public.rede_desc_explorar() from anon;
    grant execute on function public.rede_desc_entrada_estado(), public.rede_desc_linha(text, text, text, integer, jsonb), public.rede_desc_tag(text, text, text, integer),
      public.rede_desc_buscar(text, text, text, integer), public.rede_desc_explorar() to anon, authenticated, service_role;
    grant execute on function public.rede_desc_entrada_opcoes(), public.rede_desc_entrada_escolher(text[], text[], boolean), public.rede_desc_entrada_guia(boolean),
      public.rede_desc_aparecer(boolean), public.rede_desc_pacote(text), public.rede_desc_pacote_seguir(text),
      public.rede_desc_pacote_salvar(text, text, text, integer, boolean), public.rede_desc_pacote_pessoa(text, text, boolean),
      public.rede_desc_linha_salvar(text, text, text, text, text, text, boolean, integer, boolean) to authenticated, service_role;
  end if;
end $$;
