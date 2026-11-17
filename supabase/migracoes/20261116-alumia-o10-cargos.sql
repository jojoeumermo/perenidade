-- ───────────────────────────── Alumia, onda 10: cargos e chegada ─────────────────────────────
-- Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
--
-- Frente 10B. O que a moderação de cada comunidade divide com mais gente e o que ela prepara para quem chega:
--
--   1. CARGOS COM PERMISSÕES: a moderação cria cargos ("secretaria", "formação"…) e marca o que cada um pode, de uma lista
--      FECHADA: pedidos (aceitar pedidos de entrada e escrever as perguntas), regras (escrever as regras e pedir que sejam lidas
--      antes de postar), boas_vindas (o texto e os interesses de quem chega), etiquetas (as etiquetas dos posts e das pessoas) e
--      fixar (fixar posts e dar prazo ao fixado). A conferência é NO BANCO, em cada função que a permissão libera
--      (interno.alumia_o10_pode): rede_com_pedidos, rede_com_decidir_pedido, alumia_com_pedidos, alumia_com_perguntas_salvar,
--      rede_com_regras_salvar, rede_com_etiquetas_salvar e rede_com_fixar são refeitas aqui só na linha da permissão. Cargo nenhum
--      remove post, bane, nomeia moderação ou cria cargo: isso continua só com a moderação. Ninguém vira cargo sem aceitar, e
--      sai quando quiser. Não há lista pública de quem tem cargo: fora da moderação, só o número (a partir de 3).
--   2. ETIQUETA DA PESSOA NA COMUNIDADE (troca por princípio): só da lista fechada que a moderação escreve, nunca texto livre.
--      A etiqueta "a pessoa escolhe" ela mesma põe e tira; a "a moderação oferece" só vale depois do aceite. Aparece ao lado dos
--      posts da pessoa naquela comunidade; não existe função nem página de "quem tem a etiqueta".
--   3. BOAS-VINDAS COM INTERESSES: a moderação escreve as boas-vindas e até 8 interesses, cada um com o começo que a comunidade
--      sugere. Quem entra recebe as boas-vindas num aviso. A escolha dos interesses NÃO vem ao banco: fica só no aparelho.
--   4. REGRAS ANTES DE POSTAR: a comunidade pode pedir que as regras sejam lidas e aceitas antes do primeiro post (e de novo
--      quando mudarem). O banco barra o post sem o aceite ("leia_as_regras"); quem modera e a equipe passam.
--   5. PRAZO DO FIXADO: o post fixado pode ter data para sair do alto; passou o prazo, sai sozinho (pg_cron, a cada 5 minutos,
--      e na leitura da aba), com a linha no registro de moderação.
--
-- Nenhum endereço de rede é guardado. Tudo em interno, com RLS e sem política; o acesso é só por funções security definer com
-- search_path fixo. As de membro passam pela porta da entrada (interno.alumia_trancar, no fim).
--
-- Pode rodar mais de uma vez, sem apagar dado nenhum. Roda DEPOIS de 20261115-alumia-onda9-fim.sql.
-- Teste: scripts/testar-alumia-o10-cargos.mjs.

-- ── 1. Tabelas ────────────────────────────────────────────────────────────────────────────────────────────────────────────

-- Os cargos de uma comunidade, com as permissões marcadas da lista fechada.
create table if not exists interno.alumia_cargos (
  id uuid primary key default gen_random_uuid(),
  comunidade text not null references interno.rede_comunidades (slug) on delete cascade on update cascade,
  nome text not null check (char_length(nome) between 2 and 40),
  descricao text not null default '' check (char_length(descricao) <= 240),
  permissoes text[] not null default '{}' check (permissoes <@ array['pedidos', 'regras', 'boas_vindas', 'etiquetas', 'fixar']::text[]),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
create index if not exists alumia_cargos_comunidade on interno.alumia_cargos (comunidade, criado_em);

-- Quem tem (ou foi convidada para) cada cargo. Convidada não pode nada; só o aceite liga.
create table if not exists interno.alumia_cargo_pessoas (
  cargo uuid not null references interno.alumia_cargos (id) on delete cascade,
  usuario uuid not null references interno.perfis (id) on delete cascade,
  situacao text not null default 'convidado' check (situacao in ('convidado', 'ativo')),
  convidado_em timestamptz not null default now(),
  aceito_em timestamptz,
  primary key (cargo, usuario)
);
create index if not exists alumia_cargo_pessoas_usuario on interno.alumia_cargo_pessoas (usuario);

-- A lista fechada de etiquetas de pessoa de uma comunidade (até 12): quem escolhe é a pessoa, ou a moderação oferece.
create table if not exists interno.alumia_etiquetas_pessoa (
  id uuid primary key default gen_random_uuid(),
  comunidade text not null references interno.rede_comunidades (slug) on delete cascade on update cascade,
  nome text not null check (char_length(nome) between 2 and 30),
  quem_da text not null default 'pessoa' check (quem_da in ('pessoa', 'moderacao')),
  criado_em timestamptz not null default now()
);
create index if not exists alumia_etiquetas_pessoa_comunidade on interno.alumia_etiquetas_pessoa (comunidade, criado_em);

-- A etiqueta de cada pessoa na comunidade: no máximo uma valendo; as oferecidas esperam o aceite.
create table if not exists interno.alumia_etiqueta_de (
  comunidade text not null references interno.rede_comunidades (slug) on delete cascade on update cascade,
  usuario uuid not null references interno.perfis (id) on delete cascade,
  etiqueta uuid not null references interno.alumia_etiquetas_pessoa (id) on delete cascade,
  situacao text not null default 'vale' check (situacao in ('vale', 'oferecida')),
  desde timestamptz not null default now(),
  primary key (comunidade, usuario, etiqueta)
);
create unique index if not exists alumia_etiqueta_de_uma on interno.alumia_etiqueta_de (comunidade, usuario) where situacao = 'vale';

-- A chegada de uma comunidade: as boas-vindas, os interesses e se as regras são lidas antes de postar. Uma linha por comunidade.
create table if not exists interno.alumia_chegada (
  comunidade text primary key references interno.rede_comunidades (slug) on delete cascade on update cascade,
  boas_vindas text not null default '' check (char_length(boas_vindas) <= 1200),
  -- [{chave, nome, texto}], até 8. A chave sai do nome (o aparelho guarda as chaves escolhidas; o banco nunca as recebe).
  interesses jsonb not null default '[]'::jsonb check (jsonb_typeof(interesses) = 'array' and jsonb_array_length(interesses) <= 8),
  regras_antes boolean not null default false,
  -- Quando as regras mudaram pela última vez: aceite anterior a isto não vale mais.
  regras_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

-- Quem aceitou as regras de uma comunidade e quando (some quando a pessoa sai da comunidade).
create table if not exists interno.alumia_regras_lidas (
  comunidade text not null references interno.rede_comunidades (slug) on delete cascade on update cascade,
  usuario uuid not null references interno.perfis (id) on delete cascade,
  lidas_em timestamptz not null default now(),
  primary key (comunidade, usuario)
);

-- O prazo de um post fixado: passou, ele sai do alto sozinho.
create table if not exists interno.alumia_fixado_prazo (
  post uuid primary key references interno.rede_posts (id) on delete cascade,
  comunidade text not null references interno.rede_comunidades (slug) on delete cascade on update cascade,
  ate timestamptz not null,
  definido_em timestamptz not null default now()
);
create index if not exists alumia_fixado_prazo_ate on interno.alumia_fixado_prazo (ate);

alter table interno.alumia_cargos enable row level security;
alter table interno.alumia_cargo_pessoas enable row level security;
alter table interno.alumia_etiquetas_pessoa enable row level security;
alter table interno.alumia_etiqueta_de enable row level security;
alter table interno.alumia_chegada enable row level security;
alter table interno.alumia_regras_lidas enable row level security;
alter table interno.alumia_fixado_prazo enable row level security;
revoke all on table interno.alumia_cargos, interno.alumia_cargo_pessoas, interno.alumia_etiquetas_pessoa, interno.alumia_etiqueta_de,
  interno.alumia_chegada, interno.alumia_regras_lidas, interno.alumia_fixado_prazo from public;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on table interno.alumia_cargos, interno.alumia_cargo_pessoas, interno.alumia_etiquetas_pessoa, interno.alumia_etiqueta_de,
      interno.alumia_chegada, interno.alumia_regras_lidas, interno.alumia_fixado_prazo from anon, authenticated;
  end if;
end $$;

-- ── 2. Auxiliares internos ────────────────────────────────────────────────────────────────────────────────────────────────

/** A lista fechada de permissões de cargo (a mesma da regra da tabela e de components/rede/comunidades/cargos/regras.ts). */
create or replace function interno.alumia_o10_permissoes() returns text[] language sql immutable as $$
  select array['pedidos', 'regras', 'boas_vindas', 'etiquetas', 'fixar']::text[]
$$;

/** A permissão em palavras, para os avisos (que saem em português, como todos os avisos do banco). */
create or replace function interno.alumia_o10_permissao_texto(p text) returns text language sql immutable as $$
  select case p when 'pedidos' then 'aceitar pedidos de entrada' when 'regras' then 'escrever as regras' when 'boas_vindas' then 'escrever as boas-vindas'
                when 'etiquetas' then 'cuidar das etiquetas' when 'fixar' then 'fixar posts' else p end
$$;

/**
 * Esta pessoa pode fazer isto nesta comunidade? A moderação dela (e quem cuida da comunidade em geral) pode tudo da lista; quem
 * tem um cargo ACEITO pode o que o cargo marca, enquanto for membro ativo e não suspenso. Permissão fora da lista: nunca.
 */
create or replace function interno.alumia_o10_pode(p_slug text, p_quem uuid, p_permissao text) returns boolean language sql stable security definer set search_path = interno, pg_temp as $$
  select p_quem is not null and coalesce(p_permissao = any (interno.alumia_o10_permissoes()), false) and (
    interno.rede3_com_modera(p_slug, p_quem)
    or (interno.rede3_com_situacao(p_slug, p_quem) = 'membro'
        and not exists (select 1 from perfis f where f.id = p_quem and f.suspenso)
        and exists (select 1 from alumia_cargo_pessoas cp join alumia_cargos k on k.id = cp.cargo
                    where k.comunidade = p_slug and cp.usuario = p_quem and cp.situacao = 'ativo' and p_permissao = any (k.permissoes))))
$$;

/** As permissões desta pessoa nesta comunidade (a lista inteira para a moderação; vazia para quem não tem cargo). */
create or replace function interno.alumia_o10_minhas(p_slug text, p_quem uuid) returns text[] language sql stable security definer set search_path = interno, pg_temp as $$
  select case
    when p_quem is null then '{}'::text[]
    when interno.rede3_com_modera(p_slug, p_quem) then interno.alumia_o10_permissoes()
    else coalesce(array(select x from unnest(interno.alumia_o10_permissoes()) x where interno.alumia_o10_pode(p_slug, p_quem, x)), '{}'::text[])
  end
$$;

/** A pessoa pelo @nome (com ou sem a arroba). */
create or replace function interno.alumia_o10_pessoa(p_handle text) returns uuid language sql stable security definer set search_path = interno, pg_temp as $$
  select f.id from perfis f where f.rede_handle = lower(btrim(ltrim(btrim(coalesce(p_handle, '')), '@'))) and btrim(coalesce(p_handle, '')) <> '' limit 1
$$;

/** Tira do alto os fixados com o prazo vencido (de uma comunidade ou de todas). Devolve quantos saíram. */
create or replace function interno.alumia_o10_vencer_fixados(p_slug text default null) returns integer language plpgsql security definer set search_path = interno, pg_temp as $$
declare r record; n integer := 0;
begin
  for r in delete from alumia_fixado_prazo f where f.ate <= now() and (p_slug is null or f.comunidade = p_slug) returning f.post, f.comunidade loop
    update rede_posts set fixado = false where id = r.post and fixado;
    if found then
      insert into rede_moderacao (acao, alvo_tipo, alvo, regra, motivo, quem)
      values ('fixar', 'post', r.post::text, '', 'Solto do alto da comunidade ' || r.comunidade || ' (o prazo do fixado venceu)', null);
      n := n + 1;
    end if;
  end loop;
  return n;
end $$;

/** Os interesses limpos: [{chave, nome, texto}], até 8, nome de 2 a 40, texto até 300, sem nome repetido. */
create or replace function interno.alumia_o10_interesses(p jsonb) returns jsonb language plpgsql immutable as $$
declare e jsonb; v_nome text; v_texto text; v_lista jsonb := '[]'::jsonb; v_chaves text[] := '{}'; v_chave text;
begin
  if p is null or jsonb_typeof(p) is distinct from 'array' or jsonb_array_length(p) > 8 then perform interno.erro('invalido:interesses'); end if;
  for e in select * from jsonb_array_elements(p) loop
    if jsonb_typeof(e) is distinct from 'object' then perform interno.erro('invalido:interesses'); end if;
    v_nome := interno.txt(e ->> 'nome', 'interesses', 2, 40);
    v_texto := interno.txt(coalesce(e ->> 'texto', ''), 'interesses', 0, 300);
    v_chave := substr(md5(lower(v_nome)), 1, 10);
    if v_chave = any (v_chaves) then perform interno.erro('invalido:nome_repetido'); end if;
    v_chaves := v_chaves || v_chave;
    v_lista := v_lista || jsonb_build_array(jsonb_build_object('chave', v_chave, 'nome', v_nome, 'texto', v_texto));
  end loop;
  return v_lista;
end $$;

-- ── 3. Gatilhos ───────────────────────────────────────────────────────────────────────────────────────────────────────────

/**
 * Regras antes de postar: numa comunidade que pede, o post (ou a resposta) de quem ainda não aceitou as regras de agora não é
 * gravado. Quem modera o lugar e a equipe passam. Roda antes do filtro automático (pela ordem do nome), sem gastar nada.
 */
create or replace function interno.alumia_o10_regras_antes() returns trigger language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := auth.uid(); ch alumia_chegada;
begin
  if v is null or new.autor is distinct from v or new.comunidade is null then return new; end if;
  select * into ch from alumia_chegada where comunidade = new.comunidade;
  if not found or not ch.regras_antes then return new; end if;
  if interno.voluntario() or interno.rede3_com_modera(new.comunidade, v) then return new; end if;
  if exists (select 1 from alumia_regras_lidas l where l.comunidade = new.comunidade and l.usuario = v and l.lidas_em >= ch.regras_em) then return new; end if;
  perform interno.erro('leia_as_regras');
  return null;
end $$;
drop trigger if exists rede9_o10_regras on interno.rede_posts;
create trigger rede9_o10_regras before insert on interno.rede_posts for each row execute function interno.alumia_o10_regras_antes();

/** As regras mudaram: quem tinha aceitado aceita de novo (só onde a comunidade pede as regras antes). */
create or replace function interno.alumia_o10_regras_mudaram() returns trigger language plpgsql security definer set search_path = interno, pg_temp as $$
begin
  update alumia_chegada set regras_em = now() where comunidade = coalesce(new.comunidade, old.comunidade) and regras_em < now();
  return null;
end $$;
drop trigger if exists rede9_o10_regras_mudaram on interno.rede_comunidade_regras;
create trigger rede9_o10_regras_mudaram after insert or update or delete on interno.rede_comunidade_regras for each row execute function interno.alumia_o10_regras_mudaram();

/**
 * Entradas e saídas da comunidade:
 *   · pedido novo: avisa também quem tem cargo com a permissão "pedidos" (a moderação já é avisada por rede_com_entrar);
 *   · entrou (aberta, ou pedido aceito): as boas-vindas da comunidade chegam num aviso, se ela escreveu;
 *   · saiu, foi banida ou deixou de ser ativa: os cargos, a etiqueta e o aceite das regras daquela comunidade somem.
 */
create or replace function interno.alumia_o10_membros_depois() returns trigger language plpgsql security definer set search_path = interno, pg_temp as $$
declare v_nome text; v_boas text; v_entrou boolean := false; v_com text; v_quem uuid;
begin
  v_com := case when tg_op = 'DELETE' then old.comunidade else new.comunidade end;
  v_quem := case when tg_op = 'DELETE' then old.usuario else new.usuario end;
  select nome into v_nome from rede_comunidades where slug = v_com;
  if tg_op = 'INSERT' and new.situacao = 'pendente' then
    insert into avisos (para, texto, categoria)
    select distinct cp.usuario, format('Há um pedido para entrar em “%s” esperando quem cuida dos pedidos.', v_nome), 'rede'
    from alumia_cargo_pessoas cp join alumia_cargos k on k.id = cp.cargo
    where k.comunidade = new.comunidade and cp.situacao = 'ativo' and 'pedidos' = any (k.permissoes)
      and not exists (select 1 from rede_comunidade_membros m where m.comunidade = new.comunidade and m.usuario = cp.usuario and m.papel = 'moderacao');
    return null;
  end if;
  v_entrou := (tg_op = 'INSERT' and new.situacao = 'ativo' and new.papel = 'membro')
           or (tg_op = 'UPDATE' and old.situacao = 'pendente' and new.situacao = 'ativo');
  if v_entrou then
    select boas_vindas into v_boas from alumia_chegada where comunidade = v_com;
    if btrim(coalesce(v_boas, '')) <> '' then
      perform interno.avisar_em(v_quem, format('Boas-vindas a “%s”! %s · O começo que a comunidade preparou está na aba Chegada.', v_nome, left(v_boas, 300)), 'rede');
    end if;
    return null;
  end if;
  if tg_op = 'DELETE' or new.situacao <> 'ativo' or (new.banido_ate is not null and new.banido_ate > now()) then
    delete from alumia_cargo_pessoas cp using alumia_cargos k where k.id = cp.cargo and k.comunidade = v_com and cp.usuario = v_quem;
    delete from alumia_etiqueta_de where comunidade = v_com and usuario = v_quem;
    if tg_op = 'DELETE' then delete from alumia_regras_lidas where comunidade = v_com and usuario = v_quem; end if;
  end if;
  return null;
end $$;
drop trigger if exists rede9_o10_membros on interno.rede_comunidade_membros;
create trigger rede9_o10_membros after insert or update or delete on interno.rede_comunidade_membros for each row execute function interno.alumia_o10_membros_depois();

-- ── 4. As funções que cada permissão libera (o mesmo corpo de antes; só a conferência muda) ───────────────────────────────

/** Quem pediu para entrar: a moderação e quem tem cargo com "pedidos". (2026-11-rede-comunidades.sql) */
create or replace function public.rede_com_pedidos(p_slug text) returns jsonb language plpgsql stable security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); c rede_comunidades;
begin
  c := interno.rede3_com_achar(p_slug);
  if c.slug is null or not interno.alumia_o10_pode(c.slug, v, 'pedidos') then perform interno.erro('sem_permissao'); end if;
  return jsonb_build_object('itens', (
    select coalesce(jsonb_agg(jsonb_build_object('usuario', m.usuario, 'codinome', interno.rede_nome(m.usuario), 'quando', m.entrou_em) order by m.entrou_em), '[]'::jsonb)
    from (select * from rede_comunidade_membros where comunidade = c.slug and situacao = 'pendente' order by entrou_em limit 50) m));
end $$;

create or replace function public.rede_com_decidir_pedido(p_slug text, p_usuario uuid, p_aceita boolean) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); c rede_comunidades;
begin
  c := interno.rede3_com_achar(p_slug);
  if c.slug is null or not interno.alumia_o10_pode(c.slug, v, 'pedidos') then perform interno.erro('sem_permissao'); end if;
  if not exists (select 1 from rede_comunidade_membros where comunidade = c.slug and usuario = p_usuario and situacao = 'pendente') then perform interno.erro('nao_encontrado'); end if;
  if coalesce(p_aceita, false) then
    update rede_comunidade_membros set situacao = 'ativo', entrou_em = now() where comunidade = c.slug and usuario = p_usuario;
    perform interno.avisar_em(p_usuario, format('Você entrou em “%s”.', c.nome), 'rede');
  else
    delete from rede_comunidade_membros where comunidade = c.slug and usuario = p_usuario and situacao = 'pendente';
    perform interno.avisar_em(p_usuario, format('O pedido para entrar em “%s” não foi aceito.', c.nome), 'rede');
  end if;
  return jsonb_build_object('ok', true);
end $$;

/** Os pedidos com as respostas de cada um (20261115-alumia-o9-moderacao.sql): a moderação e quem tem cargo com "pedidos". */
create or replace function public.alumia_com_pedidos(p_slug text) returns jsonb language plpgsql stable security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); c rede_comunidades;
begin
  c := interno.rede3_com_achar(p_slug);
  if c.slug is null or not interno.alumia_o10_pode(c.slug, v, 'pedidos') then perform interno.erro('sem_permissao'); end if;
  return jsonb_build_object(
    'perguntas', to_jsonb(coalesce((select q.perguntas from alumia_com_perguntas q where q.comunidade = c.slug), '{}'::text[])),
    'itens', (select coalesce(jsonb_agg(jsonb_build_object('usuario', m.usuario, 'codinome', interno.rede_nome(m.usuario), 'quando', m.entrou_em,
        'respostas', to_jsonb(coalesce((select r.respostas from alumia_com_respostas r where r.comunidade = c.slug and r.usuario = m.usuario), '{}'::text[])))
        order by m.entrou_em), '[]'::jsonb)
      from (select * from rede_comunidade_membros where comunidade = c.slug and situacao = 'pendente' order by entrou_em limit 50) m));
end $$;

/** As perguntas para entrar (20261115-alumia-o9-moderacao.sql): a moderação do lugar, a equipe e quem tem cargo com "pedidos". */
create or replace function public.alumia_com_perguntas_salvar(p_slug text, p_perguntas text[]) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); c rede_comunidades; v_lista text[] := '{}'; q text;
begin
  c := interno.rede3_com_achar(p_slug);
  if c.slug is null then perform interno.erro('nao_encontrado'); end if;
  if not (interno.rede3_mod_modera(c.slug, null) or interno.alumia_o10_pode(c.slug, v, 'pedidos')) then perform interno.erro('sem_permissao'); end if;
  if coalesce(cardinality(p_perguntas), 0) > 3 then perform interno.erro('invalido:perguntas'); end if;
  perform interno.limite('alumia_com_perguntas', 30, 60);
  foreach q in array coalesce(p_perguntas, '{}'::text[]) loop
    if btrim(coalesce(q, '')) = '' then continue; end if;
    v_lista := v_lista || interno.txt(q, 'pergunta', 5, 200);
  end loop;
  if cardinality(v_lista) = 0 then
    delete from alumia_com_perguntas where comunidade = c.slug;
  else
    insert into alumia_com_perguntas (comunidade, perguntas) values (c.slug, v_lista)
    on conflict (comunidade) do update set perguntas = excluded.perguntas, atualizado_em = now();
  end if;
  return jsonb_build_object('perguntas', to_jsonb(v_lista));
end $$;

/** Troca as regras numeradas (até 20, ao menos 1): a moderação e quem tem cargo com "regras". (2026-11-rede-comunidades.sql) */
create or replace function public.rede_com_regras_salvar(p_slug text, p_regras jsonb) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); c rede_comunidades; r jsonb; n integer := 0; v_titulo text; v_texto text;
begin
  c := interno.rede3_com_achar(p_slug);
  if c.slug is null or not interno.alumia_o10_pode(c.slug, v, 'regras') then perform interno.erro('sem_permissao'); end if;
  if p_regras is null or jsonb_typeof(p_regras) is distinct from 'array' or jsonb_array_length(p_regras) not between 1 and 20 then perform interno.erro('invalido:regras'); end if;
  for r in select * from jsonb_array_elements(p_regras) loop
    v_titulo := interno.txt(r ->> 'titulo', 'regras', 3, 80);
    v_texto := interno.txt(r ->> 'texto', 'regras', 0, 500);
  end loop;
  delete from rede_comunidade_regras where comunidade = c.slug;
  for r in select * from jsonb_array_elements(p_regras) loop
    n := n + 1;
    insert into rede_comunidade_regras (comunidade, numero, titulo, texto) values (c.slug, n, interno.txt(r ->> 'titulo', 'regras', 3, 80), interno.txt(r ->> 'texto', 'regras', 0, 500));
  end loop;
  perform interno.registrar('rede_com_regras', c.slug, jsonb_build_object('regras', n));
  return jsonb_build_object('regras', (select coalesce(jsonb_agg(jsonb_build_object('numero', g.numero, 'titulo', g.titulo, 'texto', g.texto) order by g.numero), '[]'::jsonb) from rede_comunidade_regras g where g.comunidade = c.slug));
end $$;

/** Troca as etiquetas dos posts (até 12): a moderação e quem tem cargo com "etiquetas". (2026-11-rede-comunidades.sql) */
create or replace function public.rede_com_etiquetas_salvar(p_slug text, p_etiquetas jsonb) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); c rede_comunidades; e jsonb; v_nome text; v_cor text;
begin
  c := interno.rede3_com_achar(p_slug);
  if c.slug is null or not interno.alumia_o10_pode(c.slug, v, 'etiquetas') then perform interno.erro('sem_permissao'); end if;
  if p_etiquetas is null or jsonb_typeof(p_etiquetas) is distinct from 'array' or jsonb_array_length(p_etiquetas) > 12 then perform interno.erro('invalido:etiquetas'); end if;
  for e in select * from jsonb_array_elements(p_etiquetas) loop
    v_nome := interno.txt(e ->> 'nome', 'etiquetas', 2, 40);
    v_cor := lower(coalesce(e ->> 'cor', ''));
    if v_cor <> '' and v_cor !~ '^#[0-9a-f]{6}$' then perform interno.erro('invalido:etiquetas'); end if;
  end loop;
  delete from rede_comunidade_flairs where comunidade = c.slug;
  for e in select * from jsonb_array_elements(p_etiquetas) loop
    insert into rede_comunidade_flairs (comunidade, nome, cor) values (c.slug, interno.txt(e ->> 'nome', 'etiquetas', 2, 40), lower(coalesce(e ->> 'cor', '')))
    on conflict (comunidade, nome) do nothing;
  end loop;
  perform interno.registrar('rede_com_etiquetas', c.slug, '{}'::jsonb);
  return jsonb_build_object('etiquetas', (select coalesce(jsonb_agg(jsonb_build_object('nome', f.nome, 'cor', f.cor) order by f.nome), '[]'::jsonb) from rede_comunidade_flairs f where f.comunidade = c.slug));
end $$;

/**
 * Fixar (ou soltar) um post de primeiro nível no alto, até 3: a moderação e quem tem cargo com "fixar". Soltar tira também o
 * prazo. (2026-11-rede-comunidades.sql)
 */
create or replace function public.rede_com_fixar(p_slug text, p_post uuid, p_sim boolean) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); c rede_comunidades; x rede_posts;
begin
  c := interno.rede3_com_achar(p_slug);
  if c.slug is null or not interno.alumia_o10_pode(c.slug, v, 'fixar') then perform interno.erro('sem_permissao'); end if;
  select * into x from rede_posts where id = p_post and comunidade = c.slug and resposta_a is null;
  if not found or not interno.rede_ve(x, v) or x.oculto or x.retido or x.apagado_em is not null then perform interno.erro('nao_encontrado'); end if;
  if coalesce(p_sim, true) then
    if not x.fixado and (select count(*) from rede_posts where comunidade = c.slug and fixado and resposta_a is null) >= 3 then perform interno.erro('invalido:limite_de_fixados'); end if;
    update rede_posts set fixado = true where id = x.id;
  else
    update rede_posts set fixado = false where id = x.id;
    delete from alumia_fixado_prazo where post = x.id;
  end if;
  insert into rede_moderacao (acao, alvo_tipo, alvo, regra, motivo, quem)
  values ('fixar', 'post', x.id::text, '', case when coalesce(p_sim, true) then 'Fixado no alto da comunidade ' else 'Solto do alto da comunidade ' end || c.slug, v);
  return jsonb_build_object('fixado', coalesce(p_sim, true));
end $$;

-- ── 5. A aba Chegada (leitura) ────────────────────────────────────────────────────────────────────────────────────────────

/**
 * Tudo o que a aba Chegada mostra, para quem pode ver a comunidade: as boas-vindas e os interesses, as regras e se esta pessoa
 * precisa aceitá-las antes de postar, os cargos (nome, o que podem e quantas pessoas, só a partir de 3), a lista de etiquetas e
 * a etiqueta da própria pessoa, os cargos e as ofertas dela. Para quem cuida, só o que a permissão dela pede: quem tem cada cargo
 * (só a moderação), os fixados com o prazo ("fixar") e quantos pedidos esperam ("pedidos"). Antes de ler, os fixados vencidos
 * saem do alto.
 */
create or replace function public.alumia_cargos_painel(p_slug text) returns jsonb language plpgsql volatile security definer set search_path = interno, pg_temp as $$
declare v uuid := auth.uid(); c rede_comunidades; v_modero boolean; v_perm text[]; ch alumia_chegada; v_lidas timestamptz; v_gestao jsonb := '{}'::jsonb;
begin
  perform interno.aberta('comunidade');
  c := interno.rede_alumia_com_ver(p_slug, v);
  perform interno.limite('rede2_ler', 600, 60);
  perform interno.alumia_o10_vencer_fixados(c.slug);
  v_modero := interno.rede3_com_modera(c.slug, v);
  v_perm := interno.alumia_o10_minhas(c.slug, v);
  select * into ch from alumia_chegada where comunidade = c.slug;
  if v is not null then select lidas_em into v_lidas from alumia_regras_lidas where comunidade = c.slug and usuario = v; end if;
  if v_modero then
    v_gestao := v_gestao || jsonb_build_object('pessoas', (select coalesce(jsonb_agg(jsonb_build_object(
        'cargo', cp.cargo, 'usuario', cp.usuario, 'codinome', interno.rede_nome(cp.usuario), 'handle', f.rede_handle, 'situacao', cp.situacao)
        order by k.criado_em, cp.situacao, cp.convidado_em), '[]'::jsonb)
      from alumia_cargo_pessoas cp join alumia_cargos k on k.id = cp.cargo join perfis f on f.id = cp.usuario where k.comunidade = c.slug));
  end if;
  if 'fixar' = any (v_perm) then
    v_gestao := v_gestao || jsonb_build_object('fixados', (select coalesce(jsonb_agg(jsonb_build_object(
        'post', p.id, 'trecho', left(coalesce(nullif(p.titulo, ''), p.texto, ''), 140), 'ate', fp.ate) order by p.criado_em desc), '[]'::jsonb)
      from rede_posts p left join alumia_fixado_prazo fp on fp.post = p.id
      where p.comunidade = c.slug and p.fixado and p.resposta_a is null and p.apagado_em is null));
  end if;
  if 'pedidos' = any (v_perm) then
    v_gestao := v_gestao || jsonb_build_object('pedidos', (select count(*)::integer from rede_comunidade_membros m where m.comunidade = c.slug and m.situacao = 'pendente'));
  end if;
  return jsonb_build_object(
    'comunidade', c.slug, 'nome', c.nome, 'tipo', c.tipo,
    'situacao', interno.rede3_com_situacao(c.slug, v),
    'modero', v_modero,
    'permissoes', to_jsonb(v_perm),
    'cargos', (select coalesce(jsonb_agg(jsonb_build_object('id', k.id, 'nome', k.nome, 'descricao', k.descricao, 'permissoes', to_jsonb(k.permissoes),
        'pessoas', interno.rede_alumia_agregado((select count(*)::integer from alumia_cargo_pessoas cp where cp.cargo = k.id and cp.situacao = 'ativo')))
        order by k.criado_em), '[]'::jsonb) from alumia_cargos k where k.comunidade = c.slug),
    'meus_cargos', (select coalesce(jsonb_agg(jsonb_build_object('id', k.id, 'nome', k.nome, 'permissoes', to_jsonb(k.permissoes), 'situacao', cp.situacao) order by k.criado_em), '[]'::jsonb)
      from alumia_cargo_pessoas cp join alumia_cargos k on k.id = cp.cargo where k.comunidade = c.slug and cp.usuario = v),
    'etiquetas', (select coalesce(jsonb_agg(jsonb_build_object('id', e.id, 'nome', e.nome, 'quem_da', e.quem_da) order by e.criado_em), '[]'::jsonb)
      from alumia_etiquetas_pessoa e where e.comunidade = c.slug),
    'minha_etiqueta', (select jsonb_build_object('id', e.id, 'nome', e.nome) from alumia_etiqueta_de d join alumia_etiquetas_pessoa e on e.id = d.etiqueta
      where d.comunidade = c.slug and d.usuario = v and d.situacao = 'vale'),
    'ofertas', (select coalesce(jsonb_agg(jsonb_build_object('id', e.id, 'nome', e.nome) order by d.desde), '[]'::jsonb)
      from alumia_etiqueta_de d join alumia_etiquetas_pessoa e on e.id = d.etiqueta where d.comunidade = c.slug and d.usuario = v and d.situacao = 'oferecida'),
    'chegada', jsonb_build_object('boas_vindas', coalesce(ch.boas_vindas, ''), 'interesses', coalesce(ch.interesses, '[]'::jsonb),
      'regras_antes', coalesce(ch.regras_antes, false), 'regras_em', ch.regras_em),
    'regras', (select coalesce(jsonb_agg(jsonb_build_object('numero', g.numero, 'titulo', g.titulo, 'texto', g.texto) order by g.numero), '[]'::jsonb)
      from rede_comunidade_regras g where g.comunidade = c.slug),
    'regras_lidas_em', v_lidas,
    'precisa_ler', v is not null and coalesce(ch.regras_antes, false) and not v_modero and not interno.voluntario() and (v_lidas is null or v_lidas < ch.regras_em),
    'gestao', v_gestao);
end $$;

/** Antes de publicar numa comunidade (a tela pergunta, o gatilho confere): esta pessoa precisa aceitar as regras primeiro? */
create or replace function public.alumia_cargos_regras_para_postar(p_slug text) returns jsonb language plpgsql stable security definer set search_path = interno, pg_temp as $$
declare v uuid := auth.uid(); c rede_comunidades; ch alumia_chegada; v_lidas timestamptz;
begin
  -- Comunidade que esta pessoa não vê: a mesma resposta de uma que não existe (nem o nome sai).
  begin
    c := interno.rede_alumia_com_ver(p_slug, v);
  exception when others then
    return jsonb_build_object('precisa', false);
  end;
  if c.slug is null then return jsonb_build_object('precisa', false); end if;
  select * into ch from alumia_chegada where comunidade = c.slug;
  if v is null or not found or not ch.regras_antes or interno.voluntario() or interno.rede3_com_modera(c.slug, v) then
    return jsonb_build_object('precisa', false, 'nome', c.nome);
  end if;
  select lidas_em into v_lidas from alumia_regras_lidas where comunidade = c.slug and usuario = v;
  return jsonb_build_object('precisa', v_lidas is null or v_lidas < ch.regras_em, 'nome', c.nome);
end $$;

/**
 * As etiquetas de pessoa dos autores, nos posts que quem chama pode ver (até 100 por vez). Nunca o contrário: quem tem uma. Só
 * para quem é da comunidade do post (visitante e quem é de fora recebem lista vazia) e com freio por conta: varrer os posts para
 * montar "quem tem a etiqueta X" fica fora do alcance de quem não é dali, e lento para quem é.
 */
create or replace function public.alumia_cargos_etiquetas_dos_posts(p_posts uuid[]) returns jsonb language plpgsql volatile security definer set search_path = interno, pg_temp as $$
declare v uuid := auth.uid();
begin
  if coalesce(cardinality(p_posts), 0) > 100 then perform interno.erro('invalido:posts'); end if;
  if v is null then return '[]'::jsonb; end if;
  perform interno.limite('alumia_etiquetas_posts', 120, 10);
  return coalesce((select jsonb_agg(jsonb_build_object('post', p.id, 'etiqueta', e.nome))
    from rede_posts p
    join alumia_etiqueta_de d on d.comunidade = p.comunidade and d.usuario = p.autor and d.situacao = 'vale'
    join alumia_etiquetas_pessoa e on e.id = d.etiqueta
    where p.id = any (coalesce(p_posts, '{}'::uuid[])) and p.comunidade is not null
      and interno.rede3_com_situacao(p.comunidade, v) = 'membro' and interno.rede_ve(p, v)), '[]'::jsonb);
end $$;

-- ── 6. Cargos (só a moderação cria, convida e tira) ───────────────────────────────────────────────────────────────────────

/** Cria (p_id nulo) ou troca um cargo: nome, descrição e as permissões da lista fechada. Até 12 por comunidade. */
create or replace function public.alumia_cargos_salvar(p_slug text, p_id uuid, p jsonb) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); c rede_comunidades; k alumia_cargos; v_nome text; v_desc text; v_perm text[] := '{}'; x jsonb; v_chave text; v_antes text[];
begin
  c := interno.rede3_com_achar(p_slug);
  if c.slug is null then perform interno.erro('nao_encontrado'); end if;
  if not interno.rede3_com_modera(c.slug, v) then perform interno.erro('sem_permissao'); end if;
  if p is null or jsonb_typeof(p) is distinct from 'object' then perform interno.erro('invalido:cargo'); end if;
  for v_chave in select jsonb_object_keys(p) loop
    if v_chave not in ('nome', 'descricao', 'permissoes') then perform interno.erro('invalido:cargo'); end if;
  end loop;
  v_nome := interno.txt(p ->> 'nome', 'nome', 2, 40);
  v_desc := interno.txt(coalesce(p ->> 'descricao', ''), 'descricao', 0, 240);
  if p ? 'permissoes' then
    if jsonb_typeof(p -> 'permissoes') is distinct from 'array' then perform interno.erro('invalido:permissoes'); end if;
    for x in select * from jsonb_array_elements(p -> 'permissoes') loop
      if jsonb_typeof(x) is distinct from 'string' or not ((x #>> '{}') = any (interno.alumia_o10_permissoes())) then perform interno.erro('invalido:permissoes'); end if;
      if not ((x #>> '{}') = any (v_perm)) then v_perm := v_perm || (x #>> '{}'); end if;
    end loop;
  end if;
  if exists (select 1 from alumia_cargos o where o.comunidade = c.slug and lower(o.nome) = lower(v_nome) and o.id is distinct from p_id) then
    perform interno.erro('invalido:nome_repetido');
  end if;
  perform interno.limite('alumia_cargos', 60, 60);
  if p_id is null then
    if (select count(*) from alumia_cargos where comunidade = c.slug) >= 12 then perform interno.erro('invalido:limite_de_cargos'); end if;
    insert into alumia_cargos (comunidade, nome, descricao, permissoes) values (c.slug, v_nome, v_desc, v_perm) returning * into k;
  else
    select permissoes into v_antes from alumia_cargos where id = p_id and comunidade = c.slug;
    if not found then perform interno.erro('nao_encontrado'); end if;
    update alumia_cargos set nome = v_nome, descricao = v_desc, permissoes = case when p ? 'permissoes' then v_perm else permissoes end, atualizado_em = now()
    where id = p_id returning * into k;
    -- Quem tem o cargo fica sabendo quando o que ele pode muda.
    if not (k.permissoes @> v_antes and v_antes @> k.permissoes) then
      insert into avisos (para, texto, categoria)
      select cp.usuario, format('O que o cargo “%s” pode fazer em “%s” mudou: %s.', k.nome, c.nome,
        coalesce(nullif(array_to_string(array(select interno.alumia_o10_permissao_texto(x2) from unnest(k.permissoes) x2), ', '), ''), 'nada além do nome')), 'rede'
      from alumia_cargo_pessoas cp where cp.cargo = k.id and cp.situacao = 'ativo';
    end if;
  end if;
  perform interno.registrar('alumia_cargo', c.slug, jsonb_build_object('cargo', k.id, 'permissoes', to_jsonb(k.permissoes)));
  return jsonb_build_object('id', k.id, 'nome', k.nome, 'descricao', k.descricao, 'permissoes', to_jsonb(k.permissoes));
end $$;

/** Apaga um cargo; quem o tinha fica sabendo. */
create or replace function public.alumia_cargos_apagar(p_slug text, p_id uuid) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); c rede_comunidades; k alumia_cargos;
begin
  c := interno.rede3_com_achar(p_slug);
  if c.slug is null or not interno.rede3_com_modera(c.slug, v) then perform interno.erro('sem_permissao'); end if;
  select * into k from alumia_cargos where id = p_id and comunidade = c.slug;
  if not found then perform interno.erro('nao_encontrado'); end if;
  insert into avisos (para, texto, categoria)
  select cp.usuario, format('O cargo “%s” em “%s” deixou de existir.', k.nome, c.nome), 'rede' from alumia_cargo_pessoas cp where cp.cargo = k.id and cp.situacao = 'ativo';
  delete from alumia_cargos where id = k.id;
  perform interno.registrar('alumia_cargo_apagar', c.slug, jsonb_build_object('cargo', k.id));
  return jsonb_build_object('ok', true);
end $$;

/** Convida um membro ativo da comunidade (pelo @nome) para um cargo. O cargo só vale depois do aceite. */
create or replace function public.alumia_cargos_convidar(p_slug text, p_cargo uuid, p_handle text) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); c rede_comunidades; k alumia_cargos; u uuid; v_atual text;
begin
  c := interno.rede3_com_achar(p_slug);
  if c.slug is null or not interno.rede3_com_modera(c.slug, v) then perform interno.erro('sem_permissao'); end if;
  select * into k from alumia_cargos where id = p_cargo and comunidade = c.slug;
  if not found then perform interno.erro('nao_encontrado'); end if;
  u := interno.alumia_o10_pessoa(p_handle);
  if u is null or interno.rede3_com_situacao(c.slug, u) is distinct from 'membro' then perform interno.erro('invalido:pessoa'); end if;
  select situacao into v_atual from alumia_cargo_pessoas where cargo = k.id and usuario = u;
  if v_atual is not null then return jsonb_build_object('situacao', v_atual); end if;
  perform interno.limite('alumia_cargos_convidar', 60, 60);
  insert into alumia_cargo_pessoas (cargo, usuario) values (k.id, u);
  perform interno.avisar_em(u, format('A moderação de “%s” convidou você para o cargo “%s” (%s). Aceite ou recuse na aba Chegada da comunidade.', c.nome, k.nome,
    coalesce(nullif(array_to_string(array(select interno.alumia_o10_permissao_texto(x) from unnest(k.permissoes) x), ', '), ''), 'sem permissão além do nome')), 'rede');
  return jsonb_build_object('situacao', 'convidado');
end $$;

/** A moderação tira uma pessoa de um cargo (ou desfaz o convite). */
create or replace function public.alumia_cargos_tirar(p_slug text, p_cargo uuid, p_usuario uuid) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); c rede_comunidades; k alumia_cargos; v_era text;
begin
  c := interno.rede3_com_achar(p_slug);
  if c.slug is null or not interno.rede3_com_modera(c.slug, v) then perform interno.erro('sem_permissao'); end if;
  select * into k from alumia_cargos where id = p_cargo and comunidade = c.slug;
  if not found then perform interno.erro('nao_encontrado'); end if;
  delete from alumia_cargo_pessoas where cargo = k.id and usuario = p_usuario returning situacao into v_era;
  if v_era = 'ativo' then perform interno.avisar_em(p_usuario, format('Você deixou o cargo “%s” em “%s” (decisão da moderação).', k.nome, c.nome), 'rede'); end if;
  return jsonb_build_object('ok', v_era is not null);
end $$;

/** Quem foi convidada aceita ou recusa. Aceitar pede ainda ser membro ativo da comunidade. */
create or replace function public.alumia_cargos_responder(p_cargo uuid, p_aceita boolean) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); k alumia_cargos;
begin
  select k2.* into k from alumia_cargos k2 join alumia_cargo_pessoas cp on cp.cargo = k2.id where k2.id = p_cargo and cp.usuario = v and cp.situacao = 'convidado';
  if not found then perform interno.erro('nao_encontrado'); end if;
  if coalesce(p_aceita, false) then
    if interno.rede3_com_situacao(k.comunidade, v) is distinct from 'membro' then perform interno.erro('sem_permissao'); end if;
    update alumia_cargo_pessoas set situacao = 'ativo', aceito_em = now() where cargo = k.id and usuario = v;
    return jsonb_build_object('situacao', 'ativo');
  end if;
  delete from alumia_cargo_pessoas where cargo = k.id and usuario = v;
  return jsonb_build_object('situacao', null);
end $$;

/** Quem tem um cargo sai dele quando quiser. */
create or replace function public.alumia_cargos_deixar(p_cargo uuid) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu();
begin
  delete from alumia_cargo_pessoas where cargo = p_cargo and usuario = v;
  return jsonb_build_object('ok', found);
end $$;

-- ── 7. Etiquetas de pessoa ────────────────────────────────────────────────────────────────────────────────────────────────

/**
 * Troca a lista fechada de etiquetas de pessoa (até 12): [{id?, nome, quem_da}]. A que sai da lista sai também de quem a tinha.
 * A moderação e quem tem cargo com "etiquetas".
 */
create or replace function public.alumia_cargos_etiquetas_salvar(p_slug text, p jsonb) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); c rede_comunidades; e jsonb; v_nome text; v_quem text; v_nomes text[] := '{}'; v_ids uuid[] := '{}'; v_id uuid;
begin
  c := interno.rede3_com_achar(p_slug);
  if c.slug is null or not interno.alumia_o10_pode(c.slug, v, 'etiquetas') then perform interno.erro('sem_permissao'); end if;
  if p is null or jsonb_typeof(p) is distinct from 'array' or jsonb_array_length(p) > 12 then perform interno.erro('invalido:etiquetas'); end if;
  for e in select * from jsonb_array_elements(p) loop
    if jsonb_typeof(e) is distinct from 'object' then perform interno.erro('invalido:etiquetas'); end if;
    v_nome := interno.txt(e ->> 'nome', 'etiquetas', 2, 30);
    v_quem := coalesce(e ->> 'quem_da', 'pessoa');
    if v_quem not in ('pessoa', 'moderacao') then perform interno.erro('invalido:etiquetas'); end if;
    if lower(v_nome) = any (v_nomes) then perform interno.erro('invalido:nome_repetido'); end if;
    v_nomes := v_nomes || lower(v_nome);
    if nullif(e ->> 'id', '') is not null then
      begin
        v_id := (e ->> 'id')::uuid;
      exception when others then
        perform interno.erro('invalido:etiquetas');
      end;
      if not exists (select 1 from alumia_etiquetas_pessoa where id = v_id and comunidade = c.slug) then perform interno.erro('nao_encontrado'); end if;
      v_ids := v_ids || v_id;
    end if;
  end loop;
  perform interno.limite('alumia_etiquetas', 30, 60);
  delete from alumia_etiquetas_pessoa where comunidade = c.slug and not (id = any (v_ids));
  for e in select * from jsonb_array_elements(p) loop
    v_nome := interno.txt(e ->> 'nome', 'etiquetas', 2, 30);
    v_quem := coalesce(e ->> 'quem_da', 'pessoa');
    if nullif(e ->> 'id', '') is not null then
      update alumia_etiquetas_pessoa set nome = v_nome, quem_da = v_quem where id = (e ->> 'id')::uuid;
    else
      insert into alumia_etiquetas_pessoa (comunidade, nome, quem_da) values (c.slug, v_nome, v_quem);
    end if;
  end loop;
  perform interno.registrar('alumia_etiquetas_pessoa', c.slug, jsonb_build_object('etiquetas', jsonb_array_length(p)));
  return (select coalesce(jsonb_agg(jsonb_build_object('id', x.id, 'nome', x.nome, 'quem_da', x.quem_da) order by x.criado_em), '[]'::jsonb)
          from alumia_etiquetas_pessoa x where x.comunidade = c.slug);
end $$;

/**
 * A pessoa escolhe a própria etiqueta (da lista, entre as que ela mesma escolhe, ou uma oferecida a ela) ou tira a sua (nulo).
 * Só membro ativo da comunidade.
 */
create or replace function public.alumia_cargos_etiqueta_escolher(p_slug text, p_etiqueta uuid) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); c rede_comunidades; e alumia_etiquetas_pessoa;
begin
  c := interno.rede3_com_achar(p_slug);
  if c.slug is null then perform interno.erro('nao_encontrado'); end if;
  if p_etiqueta is null then
    delete from alumia_etiqueta_de where comunidade = c.slug and usuario = v and situacao = 'vale';
    return jsonb_build_object('etiqueta', null);
  end if;
  if interno.rede3_com_situacao(c.slug, v) is distinct from 'membro' then perform interno.erro('sem_permissao'); end if;
  select * into e from alumia_etiquetas_pessoa where id = p_etiqueta and comunidade = c.slug;
  if not found then perform interno.erro('nao_encontrado'); end if;
  if e.quem_da <> 'pessoa' and not exists (select 1 from alumia_etiqueta_de where comunidade = c.slug and usuario = v and etiqueta = e.id) then
    perform interno.erro('sem_permissao');
  end if;
  perform interno.limite('alumia_etiqueta_escolher', 30, 60);
  delete from alumia_etiqueta_de where comunidade = c.slug and usuario = v and (situacao = 'vale' or etiqueta = e.id);
  insert into alumia_etiqueta_de (comunidade, usuario, etiqueta, situacao) values (c.slug, v, e.id, 'vale');
  return jsonb_build_object('etiqueta', jsonb_build_object('id', e.id, 'nome', e.nome));
end $$;

/** Recusar uma etiqueta oferecida. */
create or replace function public.alumia_cargos_etiqueta_recusar(p_slug text, p_etiqueta uuid) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); c rede_comunidades;
begin
  c := interno.rede3_com_achar(p_slug);
  if c.slug is null then perform interno.erro('nao_encontrado'); end if;
  delete from alumia_etiqueta_de where comunidade = c.slug and usuario = v and etiqueta = p_etiqueta and situacao = 'oferecida';
  return jsonb_build_object('ok', found);
end $$;

/** Oferece a um membro ativo (pelo @nome) uma etiqueta que só a moderação dá. Ela vale depois do aceite. */
create or replace function public.alumia_cargos_etiqueta_oferecer(p_slug text, p_etiqueta uuid, p_handle text) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); c rede_comunidades; e alumia_etiquetas_pessoa; u uuid;
begin
  c := interno.rede3_com_achar(p_slug);
  if c.slug is null or not interno.alumia_o10_pode(c.slug, v, 'etiquetas') then perform interno.erro('sem_permissao'); end if;
  select * into e from alumia_etiquetas_pessoa where id = p_etiqueta and comunidade = c.slug;
  if not found then perform interno.erro('nao_encontrado'); end if;
  if e.quem_da <> 'moderacao' then perform interno.erro('invalido:etiqueta'); end if;
  u := interno.alumia_o10_pessoa(p_handle);
  if u is null or interno.rede3_com_situacao(c.slug, u) is distinct from 'membro' then perform interno.erro('invalido:pessoa'); end if;
  if exists (select 1 from alumia_etiqueta_de where comunidade = c.slug and usuario = u and etiqueta = e.id) then return jsonb_build_object('ok', true); end if;
  perform interno.limite('alumia_etiqueta_oferecer', 60, 60);
  insert into alumia_etiqueta_de (comunidade, usuario, etiqueta, situacao) values (c.slug, u, e.id, 'oferecida');
  perform interno.avisar_em(u, format('A moderação de “%s” ofereceu a você a etiqueta “%s”. Ela só aparece nos seus posts de lá se você aceitar, na aba Chegada.', c.nome, e.nome), 'rede');
  return jsonb_build_object('ok', true);
end $$;

/** Tira a etiqueta (e as ofertas) de uma pessoa (pelo @nome) nesta comunidade. Ela fica sabendo. */
create or replace function public.alumia_cargos_etiqueta_tirar(p_slug text, p_handle text) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); c rede_comunidades; u uuid; v_nome text;
begin
  c := interno.rede3_com_achar(p_slug);
  if c.slug is null or not interno.alumia_o10_pode(c.slug, v, 'etiquetas') then perform interno.erro('sem_permissao'); end if;
  u := interno.alumia_o10_pessoa(p_handle);
  if u is null then perform interno.erro('invalido:pessoa'); end if;
  select e.nome into v_nome from alumia_etiqueta_de d join alumia_etiquetas_pessoa e on e.id = d.etiqueta where d.comunidade = c.slug and d.usuario = u and d.situacao = 'vale';
  delete from alumia_etiqueta_de where comunidade = c.slug and usuario = u;
  if v_nome is not null then
    perform interno.avisar_em(u, format('A moderação de “%s” tirou a sua etiqueta “%s” de lá.', c.nome, v_nome), 'rede');
  end if;
  return jsonb_build_object('ok', true);
end $$;

-- ── 8. Chegada: boas-vindas, interesses e regras antes de postar ─────────────────────────────────────────────────────────

/**
 * Salva o que veio: boas_vindas e interesses (cargo com "boas_vindas"), regras_antes (cargo com "regras"). Chave desconhecida é
 * recusada; o que não veio fica como estava.
 */
create or replace function public.alumia_cargos_chegada_salvar(p_slug text, p jsonb) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); c rede_comunidades; ch alumia_chegada; v_chave text;
begin
  c := interno.rede3_com_achar(p_slug);
  if c.slug is null then perform interno.erro('nao_encontrado'); end if;
  if p is null or jsonb_typeof(p) is distinct from 'object' then perform interno.erro('invalido:chegada'); end if;
  for v_chave in select jsonb_object_keys(p) loop
    if v_chave not in ('boas_vindas', 'interesses', 'regras_antes') then perform interno.erro('invalido:chegada'); end if;
  end loop;
  if (p ? 'boas_vindas' or p ? 'interesses') and not interno.alumia_o10_pode(c.slug, v, 'boas_vindas') then perform interno.erro('sem_permissao'); end if;
  if p ? 'regras_antes' and not interno.alumia_o10_pode(c.slug, v, 'regras') then perform interno.erro('sem_permissao'); end if;
  if p ? 'regras_antes' and jsonb_typeof(p -> 'regras_antes') is distinct from 'boolean' then perform interno.erro('invalido:regras_antes'); end if;
  perform interno.limite('alumia_chegada', 30, 60);
  insert into alumia_chegada (comunidade) values (c.slug) on conflict (comunidade) do nothing;
  select * into ch from alumia_chegada where comunidade = c.slug;
  update alumia_chegada set
    boas_vindas = case when p ? 'boas_vindas' then interno.txt(coalesce(p ->> 'boas_vindas', ''), 'boas_vindas', 0, 1200) else boas_vindas end,
    interesses = case when p ? 'interesses' then interno.alumia_o10_interesses(p -> 'interesses') else interesses end,
    regras_antes = case when p ? 'regras_antes' then (p ->> 'regras_antes')::boolean else regras_antes end,
    atualizado_em = now()
  where comunidade = c.slug returning * into ch;
  perform interno.registrar('alumia_chegada', c.slug, jsonb_build_object('regras_antes', ch.regras_antes, 'interesses', jsonb_array_length(ch.interesses)));
  return jsonb_build_object('boas_vindas', ch.boas_vindas, 'interesses', ch.interesses, 'regras_antes', ch.regras_antes, 'regras_em', ch.regras_em);
end $$;

/** Li e aceito as regras desta comunidade (as de agora). Qualquer membro da Alumia que pode ver a comunidade. */
create or replace function public.alumia_cargos_regras_aceitar(p_slug text) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); c rede_comunidades; v_em timestamptz;
begin
  perform interno.aberta('comunidade');
  c := interno.rede_alumia_com_ver(p_slug, v);
  if not interno.rede2_membro(v) then perform interno.erro('consentimento'); end if;
  perform interno.limite('alumia_regras_aceitar', 30, 60);
  insert into alumia_regras_lidas (comunidade, usuario, lidas_em) values (c.slug, v, now())
  on conflict (comunidade, usuario) do update set lidas_em = now()
  returning lidas_em into v_em;
  return jsonb_build_object('lidas_em', v_em);
end $$;

-- ── 9. Prazo do fixado ────────────────────────────────────────────────────────────────────────────────────────────────────

/** Dá (ou tira, com nulo) o prazo de um post fixado: de 1 hora a 180 dias. A moderação e quem tem cargo com "fixar". */
create or replace function public.alumia_cargos_fixar_prazo(p_slug text, p_post uuid, p_ate timestamptz) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); c rede_comunidades; x rede_posts;
begin
  c := interno.rede3_com_achar(p_slug);
  if c.slug is null or not interno.alumia_o10_pode(c.slug, v, 'fixar') then perform interno.erro('sem_permissao'); end if;
  select * into x from rede_posts where id = p_post and comunidade = c.slug and resposta_a is null and fixado and apagado_em is null;
  if not found then perform interno.erro('nao_encontrado'); end if;
  if p_ate is null then
    delete from alumia_fixado_prazo where post = x.id;
  else
    if p_ate < now() + interval '1 hour' or p_ate > now() + interval '180 days' then perform interno.erro('invalido:prazo'); end if;
    insert into alumia_fixado_prazo (post, comunidade, ate) values (x.id, c.slug, p_ate)
    on conflict (post) do update set ate = excluded.ate, definido_em = now();
  end if;
  insert into rede_moderacao (acao, alvo_tipo, alvo, regra, motivo, quem)
  values ('fixar', 'post', x.id::text, '', case when p_ate is null then 'Fixado sem prazo em ' || c.slug
                                                 else 'Fixado em ' || c.slug || ' até ' || to_char(p_ate at time zone 'America/Sao_Paulo', 'DD/MM/YYYY HH24:MI') end, v);
  return jsonb_build_object('post', x.id, 'ate', p_ate);
end $$;

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule('lucia-alumia-fixados', '*/5 * * * *', 'select interno.alumia_o10_vencer_fixados(null)');
  end if;
exception when others then null;
end $$;

-- ── 10. Permissões ────────────────────────────────────────────────────────────────────────────────────────────────────────
revoke all on function interno.alumia_o10_permissoes(), interno.alumia_o10_permissao_texto(text), interno.alumia_o10_pode(text, uuid, text),
  interno.alumia_o10_minhas(text, uuid), interno.alumia_o10_pessoa(text), interno.alumia_o10_vencer_fixados(text), interno.alumia_o10_interesses(jsonb),
  interno.alumia_o10_regras_antes(), interno.alumia_o10_regras_mudaram(), interno.alumia_o10_membros_depois() from public;
revoke all on function public.alumia_cargos_painel(text), public.alumia_cargos_regras_para_postar(text), public.alumia_cargos_etiquetas_dos_posts(uuid[]),
  public.alumia_cargos_salvar(text, uuid, jsonb), public.alumia_cargos_apagar(text, uuid), public.alumia_cargos_convidar(text, uuid, text),
  public.alumia_cargos_tirar(text, uuid, uuid), public.alumia_cargos_responder(uuid, boolean), public.alumia_cargos_deixar(uuid),
  public.alumia_cargos_etiquetas_salvar(text, jsonb), public.alumia_cargos_etiqueta_escolher(text, uuid), public.alumia_cargos_etiqueta_recusar(text, uuid),
  public.alumia_cargos_etiqueta_oferecer(text, uuid, text), public.alumia_cargos_etiqueta_tirar(text, text), public.alumia_cargos_chegada_salvar(text, jsonb),
  public.alumia_cargos_regras_aceitar(text), public.alumia_cargos_fixar_prazo(text, uuid, timestamptz) from public;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on function interno.alumia_o10_permissoes(), interno.alumia_o10_permissao_texto(text), interno.alumia_o10_pode(text, uuid, text),
      interno.alumia_o10_minhas(text, uuid), interno.alumia_o10_pessoa(text), interno.alumia_o10_vencer_fixados(text), interno.alumia_o10_interesses(jsonb),
      interno.alumia_o10_regras_antes(), interno.alumia_o10_regras_mudaram(), interno.alumia_o10_membros_depois() from anon, authenticated;
    revoke all on function public.alumia_cargos_painel(text), public.alumia_cargos_regras_para_postar(text), public.alumia_cargos_etiquetas_dos_posts(uuid[]),
      public.alumia_cargos_salvar(text, uuid, jsonb), public.alumia_cargos_apagar(text, uuid), public.alumia_cargos_convidar(text, uuid, text),
      public.alumia_cargos_tirar(text, uuid, uuid), public.alumia_cargos_responder(uuid, boolean), public.alumia_cargos_deixar(uuid),
      public.alumia_cargos_etiquetas_salvar(text, jsonb), public.alumia_cargos_etiqueta_escolher(text, uuid), public.alumia_cargos_etiqueta_recusar(text, uuid),
      public.alumia_cargos_etiqueta_oferecer(text, uuid, text), public.alumia_cargos_etiqueta_tirar(text, text), public.alumia_cargos_chegada_salvar(text, jsonb),
      public.alumia_cargos_regras_aceitar(text), public.alumia_cargos_fixar_prazo(text, uuid, timestamptz) from anon, authenticated;
    -- A aba, a pergunta de antes de publicar e as etiquetas nos cartões abrem também para quem lê sem conta (as regras são abertas).
    grant execute on function public.alumia_cargos_painel(text), public.alumia_cargos_regras_para_postar(text), public.alumia_cargos_etiquetas_dos_posts(uuid[])
      to anon, authenticated, service_role;
    grant execute on function public.alumia_cargos_salvar(text, uuid, jsonb), public.alumia_cargos_apagar(text, uuid), public.alumia_cargos_convidar(text, uuid, text),
      public.alumia_cargos_tirar(text, uuid, uuid), public.alumia_cargos_responder(uuid, boolean), public.alumia_cargos_deixar(uuid),
      public.alumia_cargos_etiquetas_salvar(text, jsonb), public.alumia_cargos_etiqueta_escolher(text, uuid), public.alumia_cargos_etiqueta_recusar(text, uuid),
      public.alumia_cargos_etiqueta_oferecer(text, uuid, text), public.alumia_cargos_etiqueta_tirar(text, text), public.alumia_cargos_chegada_salvar(text, jsonb),
      public.alumia_cargos_regras_aceitar(text), public.alumia_cargos_fixar_prazo(text, uuid, timestamptz) to authenticated, service_role;
  end if;
end $$;

-- ── 11. A porta em todas as funções novas e refeitas ──────────────────────────────────────────────────────────────────────
do $$
declare v jsonb := interno.alumia_trancar();
begin
  if jsonb_array_length(v -> 'abertas') > 0 then
    raise warning 'alumia_trancar: função sem porta: %', v -> 'abertas';
  end if;
end $$;
