-- ───────────────────────────── Alumia, onda 12: perfil ─────────────────────────────
-- Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
--
-- Frente 12D. Seis peças do perfil, cada uma com o princípio escrito na regra do banco:
--
--   1. SEÇÕES DO PERFIL (L2-63): a pessoa escolhe e ordena as seções (sobre, links, trilhas, comunidades, voluntariado e as peças
--      que outras frentes penduram: destaques, coleções, conquistas). Nada aparece sem escolha: a lista nasce vazia. Comunidades
--      só as que ELA escolheu, uma a uma, e só as abertas de que ela é membro (pertencer a uma comunidade pode dizer opinião
--      política: LGPD art. 11). Sair da comunidade tira a comunidade do perfil na hora (a leitura confere de novo).
--   2. LINKS ORGANIZADOS (L2-60): até 8, com título e na ordem dela; só https, sem parâmetro de rastreio; nenhum clique contado.
--   3. LINK CONFERIDO (L3-26, com a troca): o site da pessoa aponta de volta para o perfil com rel="me"; o servidor do site busca a
--      página de lá sem mandar nada da pessoa (sem cookie, sem quem pediu) e só então marca o link (funções só para a chave de
--      serviço, e só logo depois de a própria pessoa pedir). Onde não dá para pôr rel="me" (Instagram), a mediação confere à mão
--      pelo código que a pessoa põe na bio de lá. Trocar o @ desfaz o que o rel="me" conferiu (o site aponta para o @ antigo).
--   4. STATUS (L2-61): a lista fechada ganha "na luta" e "ausente"; a pessoa escolhe quem vê: todos ou só a roda de confiança.
--      Continua escolhido à mão, com prazo, sem lugar e sem "visto por último".
--   5. HISTÓRICO DE VOLUNTARIADO (L2-64): opt-in, uma linha por frente de trabalho do Instituto (lista fechada, sem frente
--      política), período só em anos. A coordenação confirma pelo painel; só a linha confirmada aparece, e só com a seção
--      escolhida. Nenhuma função devolve "quem atuou na frente X": a coordenação vê só a fila do que espera decisão.
--   6. PACOTES INICIAIS (L1-6): o pacote só tem quem aceitou entrar NELE. A equipe convida; a pessoa aceita ou recusa cada
--      convite e sai quando quiser. O que já estava num pacote antes desta migração vira convite (ninguém fica sem ter aceitado).
--      O link e o QR do pacote nascem no aparelho.
--
-- Nenhum endereço de rede é guardado. Tudo em interno, com RLS e sem política; o acesso é só por funções security definer com
-- search_path fixo. As de membro passam pela porta da entrada (interno.alumia_trancar, no fim). Nenhuma função recebe parâmetro
-- do tipo linha de tabela com valor padrão.
--
-- Pode rodar mais de uma vez, sem apagar dado nenhum. Roda DEPOIS das migrações da onda 11.
-- Teste: scripts/testar-alumia-o12-perfil.mjs.

-- ── 1. Tabelas ────────────────────────────────────────────────────────────────────────────────────────────────────────────

-- As seções que a pessoa escolheu (na ordem dela), o texto do "Sobre" e as comunidades que ela escolheu mostrar.
create table if not exists interno.alumia_perfil_secoes (
  usuario uuid primary key references interno.perfis (id) on delete cascade,
  secoes text[] not null default '{}' check (cardinality(secoes) <= 8
    and secoes <@ array['sobre', 'links', 'trilhas', 'comunidades', 'voluntariado', 'destaques', 'colecoes', 'conquistas']::text[]),
  sobre text not null default '' check (char_length(sobre) <= 1000),
  comunidades text[] not null default '{}' check (cardinality(comunidades) <= 6),
  atualizado_em timestamptz not null default now()
);

-- Os links do perfil, na ordem da pessoa, e se (e como) foram conferidos.
create table if not exists interno.alumia_perfil_links (
  id uuid primary key default gen_random_uuid(),
  usuario uuid not null references interno.perfis (id) on delete cascade,
  ordem smallint not null check (ordem between 1 and 8),
  titulo text not null check (char_length(titulo) between 1 and 40),
  url text not null check (char_length(url) <= 200 and url ~ '^https://[a-z0-9.-]+\.[a-z]{2,}(/[^\s<>"''`]*)?$'),
  conferido_como text check (conferido_como in ('rel_me', 'mediacao')),
  conferido_em timestamptz,
  -- A pessoa pediu agora a conferência pelo rel="me": o servidor só pode marcar o link logo depois disso.
  pedido_em timestamptz,
  -- Instagram: o código que a pessoa põe na bio de lá, e quando pediu à mediação.
  codigo text check (codigo is null or codigo ~ '^alumia-[a-f0-9]{8}$'),
  mediacao_em timestamptz,
  unique (usuario, url)
);
create index if not exists alumia_perfil_links_usuario on interno.alumia_perfil_links (usuario, ordem);
create index if not exists alumia_perfil_links_mediacao on interno.alumia_perfil_links (mediacao_em) where mediacao_em is not null;

-- O histórico de voluntariado: a frente e o período em anos. Nada de dia, mês ou hora de presença.
create table if not exists interno.alumia_perfil_voluntariado (
  id uuid primary key default gen_random_uuid(),
  usuario uuid not null references interno.perfis (id) on delete cascade,
  frente text not null check (frente in ('educacao', 'curadoria', 'mediacao', 'revisao', 'traducao', 'jornalismo', 'comunicacao', 'mentoria',
                                         'design', 'desenvolvimento', 'saude', 'parcerias', 'eventos')),
  ano_de smallint not null check (ano_de between 2015 and 2100),
  ano_ate smallint check (ano_ate is null or ano_ate between 2015 and 2100),
  situacao text not null default 'esperando' check (situacao in ('esperando', 'confirmado', 'recusado')),
  check (ano_ate is null or ano_ate >= ano_de),
  unique (usuario, frente, ano_de)
);
create index if not exists alumia_perfil_voluntariado_fila on interno.alumia_perfil_voluntariado (situacao) where situacao = 'esperando';

-- Os convites para entrar num pacote de pessoas. Quem aceita passa para interno.rede_desc_pacote_pessoas (o pacote de verdade).
-- Na primeira vez, o que já estava num pacote vira convite: ninguém fica num pacote sem ter aceitado ESSE pacote.
do $$
begin
  if to_regclass('interno.alumia_pacote_convites') is null then
    create table interno.alumia_pacote_convites (
      pacote text not null references interno.rede_desc_pacotes (slug) on delete cascade on update cascade,
      usuario uuid not null references interno.perfis (id) on delete cascade,
      convidado_em timestamptz not null default now(),
      primary key (pacote, usuario)
    );
    insert into interno.alumia_pacote_convites (pacote, usuario) select pacote, usuario from interno.rede_desc_pacote_pessoas on conflict do nothing;
    delete from interno.rede_desc_pacote_pessoas;
  end if;
end $$;
create index if not exists alumia_pacote_convites_usuario on interno.alumia_pacote_convites (usuario);

alter table interno.alumia_perfil_secoes enable row level security;
alter table interno.alumia_perfil_links enable row level security;
alter table interno.alumia_perfil_voluntariado enable row level security;
alter table interno.alumia_pacote_convites enable row level security;
revoke all on interno.alumia_perfil_secoes, interno.alumia_perfil_links, interno.alumia_perfil_voluntariado, interno.alumia_pacote_convites from public;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on interno.alumia_perfil_secoes, interno.alumia_perfil_links, interno.alumia_perfil_voluntariado, interno.alumia_pacote_convites from anon, authenticated;
  end if;
end $$;

-- O status: a lista fechada com "na luta" e "ausente", e quem vê (todos ou só a roda de confiança).
alter table interno.perfis add column if not exists rede_status_publico text not null default 'todos';
do $$
begin
  alter table interno.perfis drop constraint if exists perfis_rede_status_tipo;
  alter table interno.perfis add constraint perfis_rede_status_tipo
    check (rede_status_tipo is null or rede_status_tipo in ('greve', 'ato', 'estudando', 'cuidando', 'ferias', 'na_luta', 'ausente'));
  if not exists (select 1 from pg_constraint where conrelid = 'interno.perfis'::regclass and conname = 'perfis_rede_status_publico') then
    alter table interno.perfis add constraint perfis_rede_status_publico check (rede_status_publico in ('todos', 'roda'));
  end if;
end $$;

-- ── 2. Ajudas internas ────────────────────────────────────────────────────────────────────────────────────────────────────

/** Quem pede pode ver o perfil desta pessoa? A mesma regra dos extras: suspensa, invisível ou bloqueio = não; sem conta, só org com selo. */
create or replace function interno.alumia_o12p_ve(p_dono uuid, p_quem uuid) returns boolean language sql stable security definer set search_path = interno, pg_temp as $$
  select exists (
    select 1 from perfis f where f.id = p_dono and not f.suspenso
      and not ((f.rede_modo = 'invisivel' or f.rede_invisivel) and f.id is distinct from p_quem)
      and not interno.rede_bloqueado(p_quem, f.id)
      and (p_quem is not null or exists (select 1 from rede_orgs o where o.perfil = f.id and o.verificada_em is not null)))
$$;

/** O que as seções escolhidas mostram a quem olha (a mesma resposta para a dona, que vê o que os outros veem). */
create or replace function interno.alumia_o12p_secoes_json(p_dono uuid) returns jsonb language plpgsql stable security definer set search_path = interno, pg_temp as $$
declare s alumia_perfil_secoes; r jsonb;
begin
  select * into s from alumia_perfil_secoes where usuario = p_dono;
  if not found then return jsonb_build_object('secoes', null); end if;
  r := jsonb_build_object('secoes', to_jsonb(s.secoes));
  if 'sobre' = any (s.secoes) then r := r || jsonb_build_object('sobre', nullif(s.sobre, '')); end if;
  if 'links' = any (s.secoes) then
    r := r || jsonb_build_object('links', coalesce((select jsonb_agg(jsonb_build_object('titulo', l.titulo, 'url', l.url, 'conferido', l.conferido_como) order by l.ordem)
      from alumia_perfil_links l where l.usuario = p_dono), '[]'::jsonb));
  end if;
  if 'comunidades' = any (s.secoes) then
    -- Só as abertas e só enquanto a pessoa for membro: sair da comunidade a tira do perfil na hora.
    r := r || jsonb_build_object('comunidades', coalesce((select jsonb_agg(jsonb_build_object('slug', c.slug, 'nome', c.nome, 'cor', c.cor) order by o)
      from unnest(s.comunidades) with ordinality as t(slug, o) join rede_comunidades c on c.slug = t.slug
      where c.tipo = 'aberta' and interno.rede2_na_comunidade(c.slug, p_dono)), '[]'::jsonb));
  end if;
  if 'voluntariado' = any (s.secoes) then
    r := r || jsonb_build_object('voluntariado', coalesce((select jsonb_agg(jsonb_build_object('frente', v.frente, 'de', v.ano_de, 'ate', v.ano_ate) order by v.ano_de desc, v.frente)
      from alumia_perfil_voluntariado v where v.usuario = p_dono and v.situacao = 'confirmado'), '[]'::jsonb));
  end if;
  return r;
end $$;

/** A minha linha de seções (cria vazia na primeira vez). */
create or replace function interno.alumia_o12p_minha(p_quem uuid) returns interno.alumia_perfil_secoes language plpgsql security definer set search_path = interno, pg_temp as $$
declare s alumia_perfil_secoes;
begin
  insert into alumia_perfil_secoes (usuario) values (p_quem) on conflict (usuario) do nothing;
  select * into s from alumia_perfil_secoes where usuario = p_quem;
  return s;
end $$;

/** Trocar o @ desfaz o que o rel="me" conferiu: o site de fora aponta para o @ antigo. */
create or replace function interno.alumia_o12p_handle_mudou() returns trigger language plpgsql security definer set search_path = interno, pg_temp as $$
begin
  if new.rede_handle is distinct from old.rede_handle then
    update alumia_perfil_links set conferido_como = null, conferido_em = null, pedido_em = null where usuario = new.id and conferido_como = 'rel_me';
  end if;
  return new;
end $$;
drop trigger if exists alumia_o12p_handle_mudou on interno.perfis;
create trigger alumia_o12p_handle_mudou after update of rede_handle on interno.perfis for each row execute function interno.alumia_o12p_handle_mudou();

-- ── 3. Seções ─────────────────────────────────────────────────────────────────────────────────────────────────────────────

/**
 * As seções do perfil de alguém, pelo @. Nulo se não pode ver o perfil. `secoes` nulo = a pessoa nunca escolheu (a tela mostra
 * o perfil como sempre foi, sem seção nenhuma desta frente).
 */
create or replace function public.alumia_perfil_secoes(p_handle text) returns jsonb language plpgsql stable security definer set search_path = interno, pg_temp as $$
declare v uuid := auth.uid(); d uuid;
begin
  select id into d from perfis where rede_handle = lower(btrim(coalesce(p_handle, ''), ' @'));
  if d is null or not interno.alumia_o12p_ve(d, v) then return null; end if;
  return interno.alumia_o12p_secoes_json(d);
end $$;

/** As minhas seções para editar: a escolha, o "Sobre", as comunidades escolhidas e as que eu posso escolher, os links e o histórico. */
create or replace function public.alumia_perfil_secoes_minhas() returns jsonb language plpgsql stable security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); s alumia_perfil_secoes;
begin
  perform interno.rede3_perfil_exige_membro(v);
  select * into s from alumia_perfil_secoes where usuario = v;
  return jsonb_build_object(
    'secoes', case when s.usuario is null then null else to_jsonb(s.secoes) end,
    'sobre', coalesce(s.sobre, ''),
    'comunidades', coalesce(to_jsonb(s.comunidades), '[]'::jsonb),
    -- As que dá para escolher: abertas e de que sou membro agora.
    'possiveis', coalesce((select jsonb_agg(jsonb_build_object('slug', c.slug, 'nome', c.nome, 'cor', c.cor) order by c.nome)
      from rede_comunidades c where c.tipo = 'aberta' and interno.rede2_na_comunidade(c.slug, v)), '[]'::jsonb),
    'links', coalesce((select jsonb_agg(jsonb_build_object('id', l.id, 'titulo', l.titulo, 'url', l.url, 'conferido', l.conferido_como,
        'codigo', l.codigo, 'mediacao', l.mediacao_em is not null) order by l.ordem) from alumia_perfil_links l where l.usuario = v), '[]'::jsonb),
    'voluntariado', coalesce((select jsonb_agg(jsonb_build_object('id', x.id, 'frente', x.frente, 'de', x.ano_de, 'ate', x.ano_ate, 'situacao', x.situacao)
        order by x.ano_de desc, x.frente) from alumia_perfil_voluntariado x where x.usuario = v), '[]'::jsonb));
end $$;

/** Guardar as seções (só as chaves que vierem mudam): `secoes` (ordem), `sobre` (até 1000) e `comunidades` (até 6, abertas e minhas). */
create or replace function public.alumia_perfil_secoes_salvar(p jsonb) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); s alumia_perfil_secoes; v_secoes text[]; v_coms text[]; v_sobre text;
begin
  perform interno.rede3_perfil_exige_membro(v);
  perform interno.limite('alumia_perfil_secoes', 40, 60);
  if p is null or jsonb_typeof(p) <> 'object' then perform interno.erro('invalido:pedido'); end if;
  s := interno.alumia_o12p_minha(v);
  if p ? 'secoes' then
    if jsonb_typeof(p -> 'secoes') <> 'array' or jsonb_array_length(p -> 'secoes') > 8 then perform interno.erro('invalido:secoes'); end if;
    select coalesce(array_agg(e order by o), '{}') into v_secoes from jsonb_array_elements_text(p -> 'secoes') with ordinality as t(e, o);
    if not v_secoes <@ array['sobre', 'links', 'trilhas', 'comunidades', 'voluntariado', 'destaques', 'colecoes', 'conquistas']::text[]
       or cardinality(v_secoes) <> (select count(distinct x) from unnest(v_secoes) x) then
      perform interno.erro('invalido:secoes');
    end if;
    s.secoes := v_secoes;
  end if;
  if p ? 'sobre' then
    v_sobre := regexp_replace(replace(coalesce(p ->> 'sobre', ''), E'\r', ''), '[\u0001-\u0008\u000B\u000C\u000E-\u001F\u007F​-‏‪-‮⁦-⁩]', '', 'g');
    v_sobre := btrim(regexp_replace(v_sobre, E'\n{3,}', E'\n\n', 'g'));
    if char_length(v_sobre) > 1000 then perform interno.erro('invalido:sobre'); end if;
    s.sobre := v_sobre;
  end if;
  if p ? 'comunidades' then
    if jsonb_typeof(p -> 'comunidades') <> 'array' or jsonb_array_length(p -> 'comunidades') > 6 then perform interno.erro('invalido:comunidades'); end if;
    select coalesce(array_agg(e order by o), '{}') into v_coms from jsonb_array_elements_text(p -> 'comunidades') with ordinality as t(e, o);
    if cardinality(v_coms) <> (select count(distinct x) from unnest(v_coms) x)
       or exists (select 1 from unnest(v_coms) x where not exists (
         select 1 from rede_comunidades c where c.slug = x and c.tipo = 'aberta' and interno.rede2_na_comunidade(c.slug, v))) then
      perform interno.erro('invalido:comunidades');
    end if;
    s.comunidades := v_coms;
  end if;
  update alumia_perfil_secoes set secoes = s.secoes, sobre = s.sobre, comunidades = s.comunidades, atualizado_em = now() where usuario = v;
  return public.alumia_perfil_secoes_minhas();
end $$;

-- ── 4. Links organizados e conferidos ─────────────────────────────────────────────────────────────────────────────────────

/**
 * Guardar os meus links (a lista inteira, na ordem): até 8, só https e sem parâmetro de rastreio. O link que fica com o MESMO
 * endereço guarda a conferência; endereço novo nasce sem conferência.
 */
create or replace function public.alumia_perfil_links_salvar(p jsonb) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); l jsonb; i integer := 0; v_urls text[] := '{}'; v_url text; v_titulo text;
begin
  perform interno.rede3_perfil_exige_membro(v);
  perform interno.limite('alumia_perfil_links', 30, 60);
  if p is null or jsonb_typeof(p) <> 'array' or jsonb_array_length(p) > 8 then perform interno.erro('invalido:links'); end if;
  for l in select value from jsonb_array_elements(p) loop
    v_url := btrim(coalesce(l ->> 'url', ''));
    v_titulo := btrim(regexp_replace(coalesce(l ->> 'titulo', ''), '[\u0001-\u001F\u007F​-‏‪-‮⁦-⁩]', ' ', 'g'));
    if v_url !~ '^https://[a-z0-9.-]+\.[a-z]{2,}(/[^\s<>"''`]*)?$' or char_length(v_url) > 200
       or v_url ~* '(^|[?&])(utm_[a-z_]+|fbclid|gclid|dclid|gbraid|wbraid|msclkid|mc_[a-z]+|igshid|igsh|si|ref_src|ref_url|_hsenc|_hsmi|yclid|twclid|ttclid|s_cid|mkt_tok)='
       or char_length(v_titulo) not between 1 and 40 or v_titulo ~* '(https?://|www\.)' or v_url = any (v_urls) then
      perform interno.erro('invalido:links');
    end if;
    v_urls := v_urls || v_url;
  end loop;
  delete from alumia_perfil_links where usuario = v and not (url = any (v_urls));
  for l in select value from jsonb_array_elements(p) loop
    i := i + 1;
    v_titulo := btrim(regexp_replace(coalesce(l ->> 'titulo', ''), '[\u0001-\u001F\u007F​-‏‪-‮⁦-⁩]', ' ', 'g'));
    insert into alumia_perfil_links (usuario, ordem, titulo, url) values (v, i, v_titulo, btrim(l ->> 'url'))
    on conflict (usuario, url) do update set ordem = excluded.ordem, titulo = excluded.titulo;
  end loop;
  return public.alumia_perfil_secoes_minhas();
end $$;

/**
 * Pedir a conferência pelo rel="me" de um link meu. Devolve o endereço e o meu @ para o servidor do site buscar a página de lá
 * (app/api/rede/perfil-link). Só o servidor marca o link, e só nos 2 minutos seguintes a este pedido.
 */
create or replace function public.alumia_perfil_link_conferir(p_link uuid) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); l alumia_perfil_links; h text;
begin
  perform interno.rede3_perfil_exige_membro(v);
  perform interno.limite('alumia_perfil_link_conferir', 12, 60);
  select * into l from alumia_perfil_links where id = p_link and usuario = v;
  if not found then perform interno.erro('nao_encontrado'); end if;
  select rede_handle into h from perfis where id = v;
  if h is null then perform interno.erro('sem_handle'); end if;
  update alumia_perfil_links set pedido_em = now() where id = l.id;
  return jsonb_build_object('url', l.url, 'handle', h);
end $$;

/**
 * Só a chave de serviço (o servidor do site, depois de buscar a página): marca ou desmarca o link conferido pelo rel="me".
 * Recusa se a dona não pediu nos últimos 2 minutos. Uma conferência que falha tira a marca antiga (o site não aponta mais).
 */
create or replace function public.alumia_perfil_link_resultado(p_usuario uuid, p_link uuid, p_ok boolean) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare l alumia_perfil_links;
begin
  select * into l from alumia_perfil_links where id = p_link and usuario = p_usuario;
  if not found then perform interno.erro('nao_encontrado'); end if;
  if l.pedido_em is null or l.pedido_em < now() - interval '2 minutes' then perform interno.erro('sem_pedido'); end if;
  if coalesce(p_ok, false) then
    update alumia_perfil_links set conferido_como = 'rel_me', conferido_em = now(), pedido_em = null where id = l.id;
  else
    update alumia_perfil_links set conferido_como = case when conferido_como = 'mediacao' then 'mediacao' end,
      conferido_em = case when conferido_como = 'mediacao' then conferido_em end, pedido_em = null where id = l.id;
  end if;
  return jsonb_build_object('conferido', coalesce(p_ok, false));
end $$;

/**
 * Pedir à mediação que confira um link do Instagram (lá não dá para pôr rel="me"). Devolve o código que a pessoa põe na bio de
 * lá; a mediação abre o perfil de lá e confere. `p_sim` falso desiste do pedido (o código some).
 */
create or replace function public.alumia_perfil_link_mediacao(p_link uuid, p_sim boolean) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); l alumia_perfil_links;
begin
  perform interno.rede3_perfil_exige_membro(v);
  perform interno.limite('alumia_perfil_link_mediacao', 10, 60);
  select * into l from alumia_perfil_links where id = p_link and usuario = v;
  if not found then perform interno.erro('nao_encontrado'); end if;
  if l.url !~* '^https://(www\.)?instagram\.com/' then perform interno.erro('invalido:site'); end if;
  if coalesce(p_sim, false) then
    update alumia_perfil_links set codigo = coalesce(codigo, 'alumia-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 8)), mediacao_em = now()
    where id = l.id returning * into l;
  else
    update alumia_perfil_links set codigo = null, mediacao_em = null where id = l.id returning * into l;
  end if;
  return jsonb_build_object('codigo', l.codigo, 'mediacao', l.mediacao_em is not null);
end $$;

/** Só a mediação: os links do Instagram que esperam conferência (o endereço, o código e o @ da Alumia, nada mais). */
create or replace function public.alumia_perfil_links_fila() returns jsonb language plpgsql stable security definer set search_path = interno, pg_temp as $$
begin
  if not interno.media() then perform interno.erro('sem_permissao'); end if;
  return coalesce((select jsonb_agg(jsonb_build_object('id', l.id, 'url', l.url, 'codigo', l.codigo, 'handle', f.rede_handle) order by l.mediacao_em)
    from alumia_perfil_links l join perfis f on f.id = l.usuario where l.mediacao_em is not null and not f.suspenso), '[]'::jsonb);
end $$;

/** Só a mediação: confere (ou não) o link do Instagram. Sai da fila nos dois casos; o código some. */
create or replace function public.alumia_perfil_link_decidir(p_link uuid, p_ok boolean) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare l alumia_perfil_links;
begin
  if not interno.media() then perform interno.erro('sem_permissao'); end if;
  select * into l from alumia_perfil_links where id = p_link and mediacao_em is not null;
  if not found then perform interno.erro('nao_encontrado'); end if;
  if l.usuario = interno.eu() then perform interno.erro('sem_permissao'); end if;
  update alumia_perfil_links set conferido_como = case when coalesce(p_ok, false) then 'mediacao' else conferido_como end,
    conferido_em = case when coalesce(p_ok, false) then now() else conferido_em end, codigo = null, mediacao_em = null where id = l.id;
  perform interno.registrar('alumia_perfil_link_decidir', l.id::text, jsonb_build_object('conferido', coalesce(p_ok, false)));
  return jsonb_build_object('ok', true);
end $$;

-- ── 5. Status com a lista fechada nova e quem vê ──────────────────────────────────────────────────────────────────────────

/**
 * Status (só enquanto vale, e só para quem a pessoa escolheu: todos ou a roda de confiança), pronomes e campos de uma pessoa.
 * Mesma regra de quem pode ver o perfil (invisível/bloqueio = nada). Troca a de 20261109-alumia-f4.sql.
 */
create or replace function public.rede_perfil_extras(p_handle text) returns jsonb language plpgsql stable security definer set search_path = interno, pg_temp as $$
declare v uuid := auth.uid(); f perfis;
begin
  select * into f from perfis where rede_handle = lower(btrim(coalesce(p_handle, ''), ' @'));
  if not found or f.suspenso or ((f.rede_modo = 'invisivel' or f.rede_invisivel) and f.id is distinct from v) or interno.rede_bloqueado(v, f.id) then return null; end if;
  if v is null and not exists (select 1 from rede_orgs where perfil = f.id and verificada_em is not null) then return null; end if;
  return jsonb_build_object(
    'status', case when f.rede_status_tipo is not null and (f.rede_status_ate is null or f.rede_status_ate > now())
                    and (f.rede_status_publico = 'todos' or f.id = v or exists (select 1 from rede_roda r where r.dono = f.id and r.membro = v))
                then jsonb_build_object('tipo', f.rede_status_tipo, 'texto', coalesce(f.rede_status_texto, ''), 'ate', f.rede_status_ate,
                                        'publico', case when f.id = v then f.rede_status_publico end) end,
    'pronomes', nullif(f.rede_pronomes, ''),
    'campos', coalesce((select jsonb_agg(jsonb_build_object('rotulo', c.rotulo, 'valor', c.valor) order by c.ordem) from rede_perfil_campos c where c.usuario = f.id), '[]'::jsonb),
    'destaques', '[]'::jsonb);
end $$;

/**
 * Editar os meus extras (troca a de 20261110-alumia-perfil.sql): campos até 6 (substitui todos). Status da lista fechada (com
 * "na luta" e "ausente"), some sozinho depois de `horas` (1 a 720); `publico` 'todos' ou 'roda' (padrão: todos).
 */
create or replace function public.rede_perfil_extras_editar(p jsonb) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); c jsonb; i integer := 0;
begin
  perform interno.rede3_perfil_exige_membro(v);
  perform interno.limite('alumia_perfil_extras', 30, 60);
  if p ? 'status' then
    if jsonb_typeof(p -> 'status') = 'object' then
      if coalesce(p -> 'status' ->> 'tipo', '') not in ('greve', 'ato', 'estudando', 'cuidando', 'ferias', 'na_luta', 'ausente')
         or char_length(coalesce(p -> 'status' ->> 'texto', '')) > 60
         or coalesce(p -> 'status' ->> 'horas', '') !~ '^[0-9]{1,3}$' or (p -> 'status' ->> 'horas')::integer not between 1 and 720
         or coalesce(p -> 'status' ->> 'publico', 'todos') not in ('todos', 'roda') then
        perform interno.erro('invalido:status');
      end if;
      update perfis set rede_status_tipo = p -> 'status' ->> 'tipo', rede_status_texto = btrim(coalesce(p -> 'status' ->> 'texto', '')),
        rede_status_ate = now() + make_interval(hours => (p -> 'status' ->> 'horas')::integer),
        rede_status_publico = coalesce(p -> 'status' ->> 'publico', 'todos') where id = v;
    else
      update perfis set rede_status_tipo = null, rede_status_texto = null, rede_status_ate = null, rede_status_publico = 'todos' where id = v;
    end if;
  end if;
  if p ? 'pronomes' then
    if char_length(coalesce(p ->> 'pronomes', '')) > 30 then perform interno.erro('invalido:pronomes'); end if;
    update perfis set rede_pronomes = nullif(btrim(coalesce(p ->> 'pronomes', '')), '') where id = v;
  end if;
  if jsonb_typeof(p -> 'campos') = 'array' then
    if jsonb_array_length(p -> 'campos') > 6 then perform interno.erro('invalido:campos'); end if;
    delete from rede_perfil_campos where usuario = v;
    for c in select value from jsonb_array_elements(p -> 'campos') loop
      i := i + 1;
      -- Link no campo: só https e sem parâmetro de rastreio (o resto é texto).
      if coalesce(c ->> 'valor', '') ~* '^https?://' and (coalesce(c ->> 'valor', '') !~ '^https://[a-z0-9.-]+\.[a-z]{2,}(/[^\s<>"''`]*)?$'
         or (c ->> 'valor') ~* '(^|[?&])(utm_[a-z_]+|fbclid|gclid|msclkid|igshid|igsh|si|mc_[a-z]+)=') then
        perform interno.erro('invalido:campos');
      end if;
      begin
        insert into rede_perfil_campos (usuario, ordem, rotulo, valor) values (v, i, btrim(coalesce(c ->> 'rotulo', '')), btrim(coalesce(c ->> 'valor', '')));
      exception when check_violation then perform interno.erro('invalido:campos');
      end;
    end loop;
  end if;
  return public.rede_perfil_extras((select rede_handle from perfis where id = v));
end $$;

-- ── 6. Histórico de voluntariado ──────────────────────────────────────────────────────────────────────────────────────────

/**
 * Pôr ou mudar uma linha do meu histórico: frente da lista fechada e anos (de 2015 até o ano que vem). Mudar uma linha a devolve
 * para "esperando" (a coordenação confere de novo). Até 10 linhas.
 */
create or replace function public.alumia_perfil_voluntariado_salvar(p jsonb) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); v_id uuid; v_de integer; v_ate integer; v_frente text; v_teto integer := extract(year from now())::integer + 1;
begin
  perform interno.rede3_perfil_exige_membro(v);
  perform interno.limite('alumia_perfil_voluntariado', 30, 60);
  if p is null or jsonb_typeof(p) <> 'object' then perform interno.erro('invalido:pedido'); end if;
  v_frente := coalesce(p ->> 'frente', '');
  if v_frente not in ('educacao', 'curadoria', 'mediacao', 'revisao', 'traducao', 'jornalismo', 'comunicacao', 'mentoria', 'design', 'desenvolvimento', 'saude', 'parcerias', 'eventos') then
    perform interno.erro('invalido:frente');
  end if;
  if coalesce(p ->> 'de', '') !~ '^[0-9]{4}$' or (p ? 'ate' and p ->> 'ate' is not null and coalesce(p ->> 'ate', '') !~ '^[0-9]{4}$') then perform interno.erro('invalido:periodo'); end if;
  v_de := (p ->> 'de')::integer;
  v_ate := nullif(p ->> 'ate', '')::integer;
  if v_de < 2015 or v_de > v_teto or (v_ate is not null and (v_ate < v_de or v_ate > v_teto)) then perform interno.erro('invalido:periodo'); end if;
  if coalesce(p ->> 'id', '') ~ '^[0-9a-f-]{36}$' then
    v_id := (p ->> 'id')::uuid;
    if not exists (select 1 from alumia_perfil_voluntariado where id = v_id and usuario = v) then perform interno.erro('nao_encontrado'); end if;
    begin
      update alumia_perfil_voluntariado set frente = v_frente, ano_de = v_de, ano_ate = v_ate, situacao = 'esperando' where id = v_id;
    exception when unique_violation then perform interno.erro('repetido');
    end;
  else
    if (select count(*) from alumia_perfil_voluntariado where usuario = v) >= 10 then perform interno.erro('limite:voluntariado'); end if;
    begin
      insert into alumia_perfil_voluntariado (usuario, frente, ano_de, ano_ate) values (v, v_frente, v_de, v_ate);
    exception when unique_violation then perform interno.erro('repetido');
    end;
  end if;
  return public.alumia_perfil_secoes_minhas();
end $$;

/** Tirar uma linha do meu histórico (some na hora, também da fila da coordenação). */
create or replace function public.alumia_perfil_voluntariado_apagar(p_id uuid) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu();
begin
  perform interno.rede3_perfil_exige_membro(v);
  delete from alumia_perfil_voluntariado where id = p_id and usuario = v;
  if not found then perform interno.erro('nao_encontrado'); end if;
  return public.alumia_perfil_secoes_minhas();
end $$;

/** Painel (coordenação e admin): as linhas que esperam decisão, da mais antiga. Só o codinome e o @, a frente e os anos. */
create or replace function public.alumia_painel_voluntariado_fila() returns jsonb language plpgsql stable security definer set search_path = interno, pg_temp as $$
begin
  perform interno.alumia_painel_exige();
  return coalesce((select jsonb_agg(jsonb_build_object('id', x.id, 'quem', interno.alumia_painel_nome(x.usuario), 'frente', x.frente, 'de', x.ano_de, 'ate', x.ano_ate) order by x.ano_de, x.id)
    from alumia_perfil_voluntariado x join perfis f on f.id = x.usuario where x.situacao = 'esperando' and not f.suspenso), '[]'::jsonb);
end $$;

/** Painel: confirmar (ou recusar, com motivo de 10 a 500 letras) uma linha. Ninguém decide a própria linha. Fica no registro. */
create or replace function public.alumia_painel_voluntariado_decidir(p_id uuid, p_confirmar boolean, p_motivo text) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare x alumia_perfil_voluntariado; v_motivo text := '';
begin
  perform interno.alumia_painel_exige();
  select * into x from alumia_perfil_voluntariado where id = p_id and situacao = 'esperando';
  if not found then perform interno.erro('nao_encontrado'); end if;
  if x.usuario = auth.uid() then perform interno.erro('sem_permissao'); end if;
  if not coalesce(p_confirmar, false) then v_motivo := interno.alumia_painel_motivo(p_motivo); end if;
  update alumia_perfil_voluntariado set situacao = case when coalesce(p_confirmar, false) then 'confirmado' else 'recusado' end where id = x.id;
  perform interno.alumia_painel_registrar(case when coalesce(p_confirmar, false) then 'voluntariado_confirmar' else 'voluntariado_recusar' end,
    'voluntariado', x.id::text, interno.alumia_painel_nome(x.usuario), v_motivo, jsonb_build_object('frente', x.frente, 'de', x.ano_de, 'ate', x.ano_ate));
  return jsonb_build_object('ok', true);
end $$;

-- ── 7. Pacotes iniciais: só quem aceitou entrar ───────────────────────────────────────────────────────────────────────────

/**
 * Equipe: convida uma pessoa para o pacote (ou tira). Convidar NÃO põe no pacote: a pessoa aceita ou recusa. Tirar apaga o convite
 * e a entrada. Troca a de 2026-11-rede-descoberta.sql (mesma assinatura).
 */
create or replace function public.rede_desc_pacote_pessoa(p_slug text, p_handle text, p_sim boolean) returns jsonb
language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); f perfis;
begin
  if not interno.cuida() then perform interno.erro('sem_permissao'); end if;
  if not exists (select 1 from rede_desc_pacotes where slug = coalesce(p_slug, '')) then perform interno.erro('nao_encontrado'); end if;
  select * into f from perfis where rede_handle = lower(btrim(coalesce(p_handle, ''), ' @'));
  if not found then perform interno.erro('nao_encontrado'); end if;
  if coalesce(p_sim, false) then
    if f.rede_modo <> 'aberto' or f.rede_invisivel or f.suspenso or f.rede_codinome is null or not interno.rede2_membro(f.id) then perform interno.erro('invalido:pessoa'); end if;
    if not exists (select 1 from rede_desc_pacote_pessoas where pacote = p_slug and usuario = f.id) then
      insert into alumia_pacote_convites (pacote, usuario) values (p_slug, f.id) on conflict do nothing;
    end if;
  else
    delete from alumia_pacote_convites where pacote = p_slug and usuario = f.id;
    delete from rede_desc_pacote_pessoas where pacote = p_slug and usuario = f.id;
  end if;
  perform interno.registrar('rede_desc_pacote_pessoa', p_slug, jsonb_build_object('convite', coalesce(p_sim, false)));
  return jsonb_build_object('ok', true);
end $$;

/** Os meus pacotes: os convites que esperam resposta e os pacotes em que eu entrei (título e descrição). */
create or replace function public.alumia_pacotes_meus() returns jsonb language plpgsql stable security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu();
begin
  perform interno.rede3_perfil_exige_membro(v);
  return jsonb_build_object(
    'convites', coalesce((select jsonb_agg(jsonb_build_object('slug', k.slug, 'titulo', k.titulo, 'descricao', k.descricao) order by k.ordem, k.titulo)
      from alumia_pacote_convites c join rede_desc_pacotes k on k.slug = c.pacote where c.usuario = v and k.ativo), '[]'::jsonb),
    'dentro', coalesce((select jsonb_agg(jsonb_build_object('slug', k.slug, 'titulo', k.titulo, 'descricao', k.descricao) order by k.ordem, k.titulo)
      from rede_desc_pacote_pessoas pp join rede_desc_pacotes k on k.slug = pp.pacote where pp.usuario = v), '[]'::jsonb),
    'aparece', coalesce((select e.aparece from rede_desc_entrada e where e.usuario = v), false));
end $$;

/**
 * Responder a um convite: aceitar põe no pacote (e liga "aparecer nos pacotes", que é a chave geral), recusar apaga o convite.
 * Sair de um pacote em que entrei: `p_sim` falso também serve (some do pacote na hora).
 */
create or replace function public.alumia_pacote_responder(p_slug text, p_sim boolean) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); f perfis;
begin
  perform interno.rede3_perfil_exige_membro(v);
  perform interno.limite('alumia_pacote_responder', 30, 60);
  if coalesce(p_sim, false) then
    if not exists (select 1 from alumia_pacote_convites c join rede_desc_pacotes k on k.slug = c.pacote where c.pacote = coalesce(p_slug, '') and c.usuario = v and k.ativo) then
      perform interno.erro('nao_encontrado');
    end if;
    select * into f from perfis where id = v;
    -- Pacote é de perfis abertos: quem está trancado ou invisível não entra (seria achado por quem não pode achá-lo).
    if f.rede_modo <> 'aberto' or f.rede_invisivel or f.rede_handle is null then perform interno.erro('perfil_fechado'); end if;
    insert into rede_desc_entrada (usuario, aparece, aparece_em) values (v, true, now())
    on conflict (usuario) do update set aparece = true, aparece_em = case when rede_desc_entrada.aparece then rede_desc_entrada.aparece_em else now() end;
    insert into rede_desc_pacote_pessoas (pacote, usuario) values (p_slug, v) on conflict do nothing;
    delete from alumia_pacote_convites where pacote = p_slug and usuario = v;
  else
    delete from alumia_pacote_convites where pacote = coalesce(p_slug, '') and usuario = v;
    delete from rede_desc_pacote_pessoas where pacote = coalesce(p_slug, '') and usuario = v;
  end if;
  return public.alumia_pacotes_meus();
end $$;

/**
 * Equipe: todos os pacotes, com os @ de quem está dentro e ainda pode aparecer (a mesma regra da lista que o próprio pacote mostra
 * a quem o abre: perfil aberto, visível, não suspenso) e se há convites esperando (o número só a partir de 3). Quem foi convidado e
 * não respondeu não aparece por nome.
 */
create or replace function public.alumia_pacotes_cuidar() returns jsonb language plpgsql stable security definer set search_path = interno, pg_temp as $$
begin
  if not interno.cuida() then perform interno.erro('sem_permissao'); end if;
  return coalesce((select jsonb_agg(jsonb_build_object('slug', k.slug, 'titulo', k.titulo, 'descricao', k.descricao, 'ordem', k.ordem, 'ativo', k.ativo,
      'dentro', coalesce((select jsonb_agg(f.rede_handle order by f.rede_handle) from rede_desc_pacote_pessoas pp join perfis f on f.id = pp.usuario
                          where pp.pacote = k.slug and interno.rede3_desc_elegivel(f, null)), '[]'::jsonb),
      'ha_convites', exists (select 1 from alumia_pacote_convites c where c.pacote = k.slug),
      'convites', interno.alumia_pessoas((select count(*) from alumia_pacote_convites c where c.pacote = k.slug))) order by k.ordem, k.titulo)
    from rede_desc_pacotes k), '[]'::jsonb);
end $$;

-- ── 8. Permissões ─────────────────────────────────────────────────────────────────────────────────────────────────────────
revoke all on function interno.alumia_o12p_ve(uuid, uuid), interno.alumia_o12p_secoes_json(uuid), interno.alumia_o12p_minha(uuid),
  interno.alumia_o12p_handle_mudou() from public;
revoke all on function public.alumia_perfil_secoes(text), public.alumia_perfil_secoes_minhas(), public.alumia_perfil_secoes_salvar(jsonb),
  public.alumia_perfil_links_salvar(jsonb), public.alumia_perfil_link_conferir(uuid), public.alumia_perfil_link_resultado(uuid, uuid, boolean),
  public.alumia_perfil_link_mediacao(uuid, boolean), public.alumia_perfil_links_fila(), public.alumia_perfil_link_decidir(uuid, boolean),
  public.alumia_perfil_voluntariado_salvar(jsonb), public.alumia_perfil_voluntariado_apagar(uuid), public.alumia_painel_voluntariado_fila(),
  public.alumia_painel_voluntariado_decidir(uuid, boolean, text), public.alumia_pacotes_meus(), public.alumia_pacote_responder(text, boolean),
  public.alumia_pacotes_cuidar() from public;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on function interno.alumia_o12p_ve(uuid, uuid), interno.alumia_o12p_secoes_json(uuid), interno.alumia_o12p_minha(uuid),
      interno.alumia_o12p_handle_mudou() from anon, authenticated;
    revoke all on function public.alumia_perfil_secoes(text), public.alumia_perfil_secoes_minhas(), public.alumia_perfil_secoes_salvar(jsonb),
      public.alumia_perfil_links_salvar(jsonb), public.alumia_perfil_link_conferir(uuid), public.alumia_perfil_link_resultado(uuid, uuid, boolean),
      public.alumia_perfil_link_mediacao(uuid, boolean), public.alumia_perfil_links_fila(), public.alumia_perfil_link_decidir(uuid, boolean),
      public.alumia_perfil_voluntariado_salvar(jsonb), public.alumia_perfil_voluntariado_apagar(uuid), public.alumia_painel_voluntariado_fila(),
      public.alumia_painel_voluntariado_decidir(uuid, boolean, text), public.alumia_pacotes_meus(), public.alumia_pacote_responder(text, boolean),
      public.alumia_pacotes_cuidar() from anon, authenticated;
    -- As seções de um perfil seguem a regra do perfil (sem conta, só org com selo): abrem para anon como os extras.
    grant execute on function public.alumia_perfil_secoes(text) to anon, authenticated, service_role;
    grant execute on function public.alumia_perfil_secoes_minhas(), public.alumia_perfil_secoes_salvar(jsonb), public.alumia_perfil_links_salvar(jsonb),
      public.alumia_perfil_link_conferir(uuid), public.alumia_perfil_link_mediacao(uuid, boolean), public.alumia_perfil_links_fila(),
      public.alumia_perfil_link_decidir(uuid, boolean), public.alumia_perfil_voluntariado_salvar(jsonb), public.alumia_perfil_voluntariado_apagar(uuid),
      public.alumia_painel_voluntariado_fila(), public.alumia_painel_voluntariado_decidir(uuid, boolean, text), public.alumia_pacotes_meus(),
      public.alumia_pacote_responder(text, boolean), public.alumia_pacotes_cuidar() to authenticated, service_role;
    -- Só o servidor do site, depois de buscar a página de fora, marca o link conferido.
    grant execute on function public.alumia_perfil_link_resultado(uuid, uuid, boolean) to service_role;
  end if;
end $$;

-- ── 9. A porta em todas as funções novas ──────────────────────────────────────────────────────────────────────────────────
do $$
declare v jsonb := interno.alumia_trancar();
begin
  if jsonb_array_length(v -> 'abertas') > 0 then
    raise warning 'alumia_trancar: função sem porta: %', v -> 'abertas';
  end if;
end $$;
