-- ───────────────────────────── Alumia, onda 9: a moderação da comunidade ─────────────────────────────
-- Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
--
-- Frente 9B. O que a moderação de cada comunidade calibra sozinha, com a regra escrita e visível a quem escreve ali:
--
--   1. FILTRO AUTOMÁTICO (automod): links por post, domínios que esperam leitura, conta nova e as palavras (a lista de palavras
--      da mediação que já existe, interno.rede_bloqueio_lista). O filtro só RETÉM: o post nasce esperando a leitura da moderação
--      (fila "Esperando leitura") e o autor vê que ele espera. Nada é apagado nem recusado em silêncio. Nenhum serviço de fora:
--      as regras são números e listas que a moderação escreve.
--   2. FILA DE RECÉM-CHEGADOS: se a comunidade quiser, os primeiros posts de quem chegou (ou só de conta nova) esperam leitura.
--   3. ALERTA DE BRIGADA: muitas respostas de contas de fora da comunidade num post em pouco tempo. O banco guarda só QUANTAS
--      contas (a partir de 3) e avisa só a moderação daquele lugar; nunca quem respondeu.
--   4. MODO LENTO, acabamento: quanto falta para a pessoa poder escrever de novo (a tela avisa antes, em minutos).
--   5. PERGUNTAS PARA ENTRAR: comunidade restrita pode pedir até 3 respostas no pedido de entrada. As respostas somem quando o
--      pedido é decidido (aceito, recusado ou desistido).
--   6. RECURSOS com prazo: a fila de recursos da moderação passa a dizer o prazo de resposta (7 dias, da onda 8) e se venceu.
--
-- Nenhum endereço de rede é guardado. Nenhuma função devolve lista de quem respondeu, de quem foi retido ou de quem respondeu às
-- perguntas, a não ser à moderação daquele lugar e só o pedido de cada pessoa (como já era o pedido de entrada).
-- Tudo em interno, com RLS e sem política; o acesso é só por funções security definer com search_path fixo. As de membro passam
-- pela porta da entrada (interno.alumia_trancar, no fim).
--
-- Pode rodar mais de uma vez, sem apagar dado nenhum. Roda DEPOIS de 20261114-alumia-onda8-fim.sql.
-- Teste: scripts/testar-alumia-o9-moderacao.mjs.

-- ── 1. Tabelas ────────────────────────────────────────────────────────────────────────────────────────────────────────────

-- O filtro automático e a fila de recém-chegados de uma comunidade. Uma linha por comunidade; sem linha, nada liga.
create table if not exists interno.alumia_automod (
  comunidade text primary key references interno.rede_comunidades (slug) on delete cascade on update cascade,
  -- Links: nulo = sem regra; 0 = todo post com link espera leitura; N = acima de N links espera leitura.
  links_max smallint check (links_max is null or links_max between 0 and 20),
  -- Domínios (sem "www.") cujo link faz o post esperar leitura; vale também para os subdomínios.
  dominios text[] not null default '{}' check (cardinality(dominios) <= 50),
  -- Conta nova: conta com menos de N dias de Alumia. Sozinha, todo post dela espera leitura; com novatos_posts, só os primeiros.
  conta_nova_dias smallint check (conta_nova_dias is null or conta_nova_dias between 1 and 90),
  -- Fila de recém-chegados: os primeiros N posts de cada pessoa aqui esperam leitura (contam só os já liberados).
  novatos_posts smallint check (novatos_posts is null or novatos_posts between 1 and 10),
  -- Alerta de brigada: quantas contas de fora respondendo ao mesmo post (a partir de 3) em quantos minutos.
  brigada_contas smallint not null default 10 check (brigada_contas between 3 and 500),
  brigada_minutos smallint not null default 30 check (brigada_minutos between 5 and 1440),
  -- A regra em palavras, escrita pela moderação: aparece para quem escreve na comunidade.
  explicacao text not null default '' check (char_length(explicacao) <= 600),
  atualizado_em timestamptz not null default now()
);

-- Os alertas de brigada: o post, quantas contas de fora (nunca quais) e a janela. Some 30 dias depois de encerrado.
create table if not exists interno.alumia_brigadas (
  id uuid primary key default gen_random_uuid(),
  comunidade text not null references interno.rede_comunidades (slug) on delete cascade on update cascade,
  post uuid not null references interno.rede_posts (id) on delete cascade,
  contas integer not null check (contas >= 3),
  minutos smallint not null,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  situacao text not null default 'aberto' check (situacao in ('aberto', 'encerrado')),
  encerrado_em timestamptz
);
create unique index if not exists alumia_brigadas_uma on interno.alumia_brigadas (post) where situacao = 'aberto';
create index if not exists alumia_brigadas_comunidade on interno.alumia_brigadas (comunidade, situacao, criado_em desc);

-- As perguntas para entrar numa comunidade (até 3) e as respostas de cada pedido (somem quando o pedido é decidido).
create table if not exists interno.alumia_com_perguntas (
  comunidade text primary key references interno.rede_comunidades (slug) on delete cascade on update cascade,
  perguntas text[] not null check (cardinality(perguntas) between 1 and 3),
  atualizado_em timestamptz not null default now()
);
create table if not exists interno.alumia_com_respostas (
  comunidade text not null references interno.rede_comunidades (slug) on delete cascade on update cascade,
  usuario uuid not null references interno.perfis (id) on delete cascade,
  respostas text[] not null check (cardinality(respostas) between 1 and 3),
  criado_em timestamptz not null default now(),
  primary key (comunidade, usuario)
);

alter table interno.alumia_automod enable row level security;
alter table interno.alumia_brigadas enable row level security;
alter table interno.alumia_com_perguntas enable row level security;
alter table interno.alumia_com_respostas enable row level security;
revoke all on table interno.alumia_automod, interno.alumia_brigadas, interno.alumia_com_perguntas, interno.alumia_com_respostas from public;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on table interno.alumia_automod, interno.alumia_brigadas, interno.alumia_com_perguntas, interno.alumia_com_respostas from anon, authenticated;
  end if;
end $$;

-- ── 2. Auxiliares (puros e internos) ─────────────────────────────────────────────────────────────────────────────────────

/** Quantos links um texto tem (a mesma conta do limite do nível, em 2026-11-rede-moderacao.sql). */
create or replace function interno.alumia_o9_links(p_texto text) returns integer language sql immutable as $$
  select count(*)::integer from regexp_matches(coalesce(p_texto, ''), '(https?://|www\.)', 'gi')
$$;

/** Os domínios dos links de um texto, em minúsculas e sem "www.". */
create or replace function interno.alumia_o9_dominios(p_texto text) returns text[] language sql immutable as $$
  select coalesce(array_agg(distinct regexp_replace(lower(m[1]), '^www\.', '')), '{}')
  from regexp_matches(coalesce(p_texto, ''), '(?:https?://|(?=www\.))([a-z0-9.-]+\.[a-z]{2,})', 'gi') as m
$$;

/** Algum domínio do texto bate com a lista (o próprio domínio ou um subdomínio dele)? */
create or replace function interno.alumia_o9_dominio_bate(p_texto text, p_lista text[]) returns boolean language sql immutable as $$
  select exists (select 1 from unnest(interno.alumia_o9_dominios(p_texto)) h, unnest(coalesce(p_lista, '{}')) d where h = d or h like '%.' || d)
$$;

/** Esta pessoa, nesta comunidade, ainda está na fila de recém-chegados (pela regra que a comunidade escreveu)? */
create or replace function interno.alumia_o9_novata(p_com text, p_usuario uuid) returns boolean language plpgsql stable security definer set search_path = interno, pg_temp as $$
declare a alumia_automod; v_dias integer;
begin
  if p_com is null or p_usuario is null then return false; end if;
  select * into a from alumia_automod where comunidade = p_com;
  if not found or (a.conta_nova_dias is null and a.novatos_posts is null) then return false; end if;
  if a.conta_nova_dias is not null then
    select floor(extract(epoch from (now() - u.created_at)) / 86400)::integer into v_dias from auth.users u where u.id = p_usuario;
    if coalesce(v_dias, 0) >= a.conta_nova_dias then return false; end if;
  end if;
  if a.novatos_posts is not null then
    return (select count(*) from rede_posts p where p.autor = p_usuario and p.comunidade = p_com and not p.retido and not p.oculto and p.apagado_em is null) < a.novatos_posts;
  end if;
  return true;
end $$;

/** Quantos segundos faltam para esta pessoa poder escrever de novo num lugar em modo lento (0 = pode). p_chave: slug ou id da raiz. */
create or replace function interno.alumia_o9_lento_falta(p_tipo text, p_chave text, p_usuario uuid) returns integer language plpgsql stable security definer set search_path = interno, pg_temp as $$
declare v_seg integer; v_ultimo timestamptz;
begin
  if p_usuario is null or p_chave is null then return 0; end if;
  select segundos into v_seg from rede_lento where alvo_tipo = p_tipo and alvo = p_chave;
  if v_seg is null then return 0; end if;
  if p_tipo = 'comunidade' then
    select max(p.criado_em) into v_ultimo from rede_posts p where p.autor = p_usuario and p.comunidade = p_chave;
  else
    select max(p.criado_em) into v_ultimo from rede_posts p where p.autor = p_usuario and (p.root_id::text = p_chave or p.id::text = p_chave);
  end if;
  if v_ultimo is null then return 0; end if;
  return greatest(0, ceil(v_seg - extract(epoch from (now() - v_ultimo))))::integer;
end $$;

-- ── 3. Gatilhos ───────────────────────────────────────────────────────────────────────────────────────────────────────────

/**
 * O filtro automático e a fila de recém-chegados, antes de gravar um post feito por uma pessoa numa comunidade. Roda depois do
 * gatilho do nível e da lista da mediação (rede3_mod_posts, pela ordem do nome): post que já nasceu retido fica como está. Quem
 * modera o lugar e a equipe passam livres. Só retém: o post nasce oculto e esperando leitura, com o motivo escrito.
 */
create or replace function interno.alumia_o9_automod_antes() returns trigger language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := auth.uid(); a alumia_automod; v_txt text; v_motivo text;
begin
  if v is null or new.autor is distinct from v or new.comunidade is null or new.retido then return new; end if;
  select * into a from alumia_automod where comunidade = new.comunidade;
  if not found then return new; end if;
  if interno.voluntario() or interno.rede3_mod_modera(new.comunidade, new.nucleo) then return new; end if;
  v_txt := coalesce(new.titulo, '') || ' ' || coalesce(new.texto, '') || ' ' || coalesce(new.corpo, '');
  if a.links_max is not null and interno.alumia_o9_links(v_txt) > a.links_max then
    v_motivo := 'automod_links';
  elsif cardinality(a.dominios) > 0 and interno.alumia_o9_dominio_bate(v_txt, a.dominios) then
    v_motivo := 'automod_dominio';
  elsif interno.alumia_o9_novata(new.comunidade, v) then
    v_motivo := case when a.novatos_posts is null then 'automod_conta_nova' else 'recem_chegada' end;
  end if;
  if v_motivo is not null then
    new.retido := true; new.oculto := true; new.avaliacao := 'revisao'; new.motivo := v_motivo;
  end if;
  return new;
end $$;
drop trigger if exists rede9_o9_automod on interno.rede_posts;
create trigger rede9_o9_automod before insert on interno.rede_posts for each row execute function interno.alumia_o9_automod_antes();

/**
 * O alerta de brigada, depois de gravar uma resposta numa comunidade: conta QUANTAS contas diferentes, de fora da comunidade (não
 * membro ativo, não moderação, não quem escreveu o post), responderam a esta conversa na janela que a comunidade escolheu (padrão:
 * 10 contas em 30 minutos). Passou do número: nasce um alerta (ou o aberto ganha o número novo) e a moderação do lugar é avisada.
 * Só o número fica guardado. Um alerta encerrado não reabre dentro da mesma janela. Nada aqui barra a resposta.
 */
create or replace function interno.alumia_o9_brigada_depois() returns trigger language plpgsql security definer set search_path = interno, pg_temp as $$
declare v_raiz rede_posts; v_contas smallint := 10; v_min smallint := 30; v_n integer; v_id uuid; v_nome text;
begin
  begin
    if new.resposta_a is null or new.comunidade is null then return null; end if;
    select * into v_raiz from rede_posts where id = coalesce(new.root_id, new.resposta_a);
    if not found or v_raiz.comunidade is distinct from new.comunidade then return null; end if;
    select brigada_contas, brigada_minutos into v_contas, v_min from alumia_automod where comunidade = new.comunidade;
    v_contas := coalesce(v_contas, 10); v_min := coalesce(v_min, 30);
    select count(distinct r.autor) into v_n from rede_posts r
    where r.root_id = v_raiz.id and r.criado_em > now() - make_interval(mins => v_min)
      and r.autor is distinct from v_raiz.autor and not interno.voluntario_e(r.autor)
      and not exists (select 1 from rede_comunidade_membros m where m.comunidade = new.comunidade and m.usuario = r.autor and m.situacao = 'ativo');
    if v_n < greatest(v_contas, 3) then return null; end if;
    update alumia_brigadas set contas = greatest(contas, v_n), atualizado_em = now() where post = v_raiz.id and situacao = 'aberto' returning id into v_id;
    if v_id is not null then return null; end if;
    if exists (select 1 from alumia_brigadas b where b.post = v_raiz.id and b.encerrado_em > now() - make_interval(mins => v_min)) then return null; end if;
    delete from alumia_brigadas where (situacao = 'encerrado' and encerrado_em < now() - interval '30 days') or criado_em < now() - interval '60 days';
    insert into alumia_brigadas (comunidade, post, contas, minutos) values (new.comunidade, v_raiz.id, v_n, v_min);
    select nome into v_nome from rede_comunidades where slug = new.comunidade;
    perform interno.avisar_em(m.usuario, left(format('Alerta de brigada em “%s”: %s contas de fora da comunidade responderam ao mesmo post em %s minutos. Veja na fila de moderação.', coalesce(v_nome, new.comunidade), v_n, v_min), 500), 'rede')
    from rede_comunidade_membros m where m.comunidade = new.comunidade and m.papel = 'moderacao' and m.situacao = 'ativo';
  exception when others then
    raise warning 'alumia_o9_brigada_depois: %', sqlerrm;
  end;
  return null;
end $$;
drop trigger if exists rede9_o9_brigada on interno.rede_posts;
create trigger rede9_o9_brigada after insert on interno.rede_posts for each row execute function interno.alumia_o9_brigada_depois();

/** Pedido de entrada em comunidade com perguntas: sem as respostas, não entra na fila (a tela pede antes). */
create or replace function interno.alumia_o9_pedido_antes() returns trigger language plpgsql security definer set search_path = interno, pg_temp as $$
begin
  if new.situacao = 'pendente'
     and exists (select 1 from alumia_com_perguntas q where q.comunidade = new.comunidade)
     and not exists (select 1 from alumia_com_respostas r where r.comunidade = new.comunidade and r.usuario = new.usuario) then
    perform interno.erro('responda_perguntas');
  end if;
  return new;
end $$;
drop trigger if exists rede9_o9_pedido on interno.rede_comunidade_membros;
create trigger rede9_o9_pedido before insert on interno.rede_comunidade_membros for each row execute function interno.alumia_o9_pedido_antes();

/** O pedido foi decidido (aceito, recusado ou desistido): as respostas somem. */
create or replace function interno.alumia_o9_pedido_decidido() returns trigger language plpgsql security definer set search_path = interno, pg_temp as $$
begin
  if old.situacao = 'pendente' and (tg_op = 'DELETE' or new.situacao <> 'pendente') then
    delete from alumia_com_respostas where comunidade = old.comunidade and usuario = old.usuario;
  end if;
  return null;
end $$;
drop trigger if exists rede9_o9_pedido_decidido on interno.rede_comunidade_membros;
create trigger rede9_o9_pedido_decidido after update or delete on interno.rede_comunidade_membros for each row execute function interno.alumia_o9_pedido_decidido();

-- ── 4. O filtro automático: ler (quem escreve ali) e calibrar (a moderação) ──────────────────────────────────────────────

/**
 * As regras que valem para quem escreve nesta comunidade, para a tela mostrar ANTES de postar: o filtro (links, domínios, conta
 * nova, recém-chegados, se há lista de palavras), a explicação da moderação, o modo lento e quanto falta, e o que vale para mim
 * agora (se estou na fila de recém-chegados). A lista de palavras não é mostrada (só que existe): mostrar seria publicar o que se
 * quer barrar. Quem modera recebe também os números do alerta de brigada.
 */
create or replace function public.alumia_mod_automod(p_slug text) returns jsonb language plpgsql stable security definer set search_path = interno, pg_temp as $$
declare v uuid := auth.uid(); c rede_comunidades; a alumia_automod; v_modero boolean; v_lento integer;
begin
  c := interno.rede3_com_achar(p_slug);
  if c.slug is null or (c.tipo = 'fechada' and not interno.rede2_na_comunidade(c.slug, v) and not interno.rede3_mod_modera(c.slug, null)) then
    perform interno.erro('nao_encontrado');
  end if;
  select * into a from alumia_automod where comunidade = c.slug;
  v_modero := interno.rede3_mod_modera(c.slug, null);
  v_lento := coalesce((select segundos from rede_lento where alvo_tipo = 'comunidade' and alvo = c.slug), 0);
  return jsonb_build_object(
    'comunidade', c.slug,
    'tipo', c.tipo,
    'links_max', a.links_max,
    'dominios', to_jsonb(coalesce(a.dominios, '{}')),
    'conta_nova_dias', a.conta_nova_dias,
    'novatos_posts', a.novatos_posts,
    'palavras', exists (select 1 from rede_bloqueio_lista l where l.escopo_tipo = 'comunidade' and l.escopo = c.slug and l.tipo = 'palavra'),
    'explicacao', coalesce(a.explicacao, ''),
    'lento', v_lento,
    'modero', v_modero,
    'para_mim', jsonb_build_object(
      'novata', v is not null and not v_modero and not interno.voluntario() and interno.alumia_o9_novata(c.slug, v),
      'lento_falta', case when v_modero then 0 else interno.alumia_o9_lento_falta('comunidade', c.slug, v) end),
    'brigada', case when v_modero then jsonb_build_object('contas', coalesce(a.brigada_contas, 10), 'minutos', coalesce(a.brigada_minutos, 30)) end);
end $$;

/**
 * A moderação calibra o filtro: {links_max, dominios, conta_nova_dias, novatos_posts, brigada_contas, brigada_minutos, explicacao}.
 * Campo ausente fica como estava; nulo desliga (onde pode). Fica no registro da moderação como uma mudança de regra do lugar.
 */
create or replace function public.alumia_mod_automod_salvar(p_slug text, p jsonb) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); c rede_comunidades; a alumia_automod; v_dominios text[]; d text; v_int integer;
begin
  c := interno.rede3_com_achar(p_slug);
  if c.slug is null then perform interno.erro('nao_encontrado'); end if;
  if not interno.rede3_mod_modera(c.slug, null) then perform interno.erro('sem_permissao'); end if;
  if p is null or jsonb_typeof(p) <> 'object' then perform interno.erro('invalido:filtro'); end if;
  if exists (select 1 from jsonb_object_keys(p) k where k not in ('links_max', 'dominios', 'conta_nova_dias', 'novatos_posts', 'brigada_contas', 'brigada_minutos', 'explicacao')) then
    perform interno.erro('invalido:filtro');
  end if;
  perform interno.limite('alumia_mod_automod', 30, 60);
  insert into alumia_automod (comunidade) values (c.slug) on conflict (comunidade) do nothing;
  select * into a from alumia_automod where comunidade = c.slug for update;

  if p ? 'links_max' then
    if jsonb_typeof(p -> 'links_max') = 'null' then a.links_max := null;
    else
      begin v_int := (p ->> 'links_max')::integer; exception when others then perform interno.erro('invalido:links_max'); end;
      if v_int < 0 or v_int > 20 then perform interno.erro('invalido:links_max'); end if;
      a.links_max := v_int;
    end if;
  end if;
  if p ? 'dominios' then
    if jsonb_typeof(p -> 'dominios') <> 'array' or jsonb_array_length(p -> 'dominios') > 50 then perform interno.erro('invalido:dominios'); end if;
    v_dominios := '{}';
    for d in select regexp_replace(lower(btrim(x)), '^(https?://)?(www\.)?', '') from jsonb_array_elements_text(p -> 'dominios') x loop
      d := regexp_replace(d, '/.*$', '');
      if d = '' then continue; end if;
      if d !~ '^[a-z0-9-]+(\.[a-z0-9-]+)+$' or char_length(d) > 80 then perform interno.erro('invalido:dominios'); end if;
      if not d = any (v_dominios) then v_dominios := v_dominios || d; end if;
    end loop;
    a.dominios := v_dominios;
  end if;
  if p ? 'conta_nova_dias' then
    if jsonb_typeof(p -> 'conta_nova_dias') = 'null' then a.conta_nova_dias := null;
    else
      begin v_int := (p ->> 'conta_nova_dias')::integer; exception when others then perform interno.erro('invalido:conta_nova_dias'); end;
      if v_int < 1 or v_int > 90 then perform interno.erro('invalido:conta_nova_dias'); end if;
      a.conta_nova_dias := v_int;
    end if;
  end if;
  if p ? 'novatos_posts' then
    if jsonb_typeof(p -> 'novatos_posts') = 'null' then a.novatos_posts := null;
    else
      begin v_int := (p ->> 'novatos_posts')::integer; exception when others then perform interno.erro('invalido:novatos_posts'); end;
      if v_int < 1 or v_int > 10 then perform interno.erro('invalido:novatos_posts'); end if;
      a.novatos_posts := v_int;
    end if;
  end if;
  if p ? 'brigada_contas' then
    begin v_int := (p ->> 'brigada_contas')::integer; exception when others then perform interno.erro('invalido:brigada'); end;
    if v_int is null or v_int < 3 or v_int > 500 then perform interno.erro('invalido:brigada'); end if;
    a.brigada_contas := v_int;
  end if;
  if p ? 'brigada_minutos' then
    begin v_int := (p ->> 'brigada_minutos')::integer; exception when others then perform interno.erro('invalido:brigada'); end;
    if v_int is null or v_int < 5 or v_int > 1440 then perform interno.erro('invalido:brigada'); end if;
    a.brigada_minutos := v_int;
  end if;
  if p ? 'explicacao' then
    a.explicacao := interno.txt(p ->> 'explicacao', 'explicacao', 0, 600);
  end if;

  update alumia_automod set links_max = a.links_max, dominios = a.dominios, conta_nova_dias = a.conta_nova_dias, novatos_posts = a.novatos_posts,
    brigada_contas = a.brigada_contas, brigada_minutos = a.brigada_minutos, explicacao = a.explicacao, atualizado_em = now()
  where comunidade = c.slug;
  return public.alumia_mod_automod(c.slug);
end $$;

-- ── 5. Modo lento: quanto falta ───────────────────────────────────────────────────────────────────────────────────────────

/**
 * O modo lento de um lugar (comunidade pelo slug, conversa pelo id de um post dela) e quanto falta para EU poder escrever ali
 * (em segundos; 0 = pode agora). Quem modera o lugar não espera. Lugar que a pessoa não pode ver: tudo zero.
 */
create or replace function public.alumia_mod_lento_falta(p_tipo text, p_alvo text) returns jsonb language plpgsql stable security definer set search_path = interno, pg_temp as $$
declare v uuid := auth.uid(); x rede_posts; c rede_comunidades; v_chave text; v_seg integer; v_modero boolean;
begin
  if p_tipo = 'comunidade' then
    c := interno.rede3_com_achar(p_alvo);
    if c.slug is null or (c.tipo = 'fechada' and not interno.rede2_na_comunidade(c.slug, v)) then return jsonb_build_object('segundos', 0, 'falta', 0); end if;
    v_chave := c.slug; v_modero := interno.rede3_mod_modera(c.slug, null);
  elsif p_tipo = 'conversa' then
    begin select * into x from rede_posts where id = p_alvo::uuid; exception when others then return jsonb_build_object('segundos', 0, 'falta', 0); end;
    if not found or not interno.rede_ve(x, v) then return jsonb_build_object('segundos', 0, 'falta', 0); end if;
    v_chave := coalesce(x.root_id, x.id)::text; v_modero := interno.rede3_mod_pode_post(x, false);
  else
    perform interno.erro('invalido:tipo');
  end if;
  v_seg := coalesce((select segundos from rede_lento where alvo_tipo = p_tipo and alvo = v_chave), 0);
  return jsonb_build_object('segundos', v_seg, 'falta', case when v_modero or v_seg = 0 then 0 else interno.alumia_o9_lento_falta(p_tipo, v_chave, v) end);
end $$;

-- ── 6. Alerta de brigada: a fila da moderação ─────────────────────────────────────────────────────────────────────────────

/**
 * Os alertas abertos das comunidades que eu modero (a equipe que cuida vê todos): o post (trecho, se não for de núcleo), QUANTAS
 * contas de fora responderam e em quantos minutos, e o que já está ligado na conversa (modo lento, trava). Nunca quem respondeu.
 */
create or replace function public.alumia_mod_brigadas() returns jsonb language plpgsql stable security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu();
begin
  return coalesce((select jsonb_agg(jsonb_build_object(
      'id', b.id, 'comunidade', b.comunidade, 'post', b.post, 'contas', b.contas, 'minutos', b.minutos,
      'criado_em', b.criado_em, 'atualizado_em', b.atualizado_em,
      'titulo', case when p.nucleo is null then p.titulo end,
      'trecho', case when p.nucleo is null then left(p.texto, 200) end,
      'lento', coalesce((select l.segundos from rede_lento l where l.alvo_tipo = 'conversa' and l.alvo = b.post::text), 0),
      'travado', coalesce(p.travado, false)) order by b.atualizado_em desc)
    from alumia_brigadas b join rede_posts p on p.id = b.post
    where b.situacao = 'aberto' and interno.rede3_mod_modera(b.comunidade, null)), '[]'::jsonb);
end $$;

/** Encerra um alerta de brigada (a moderação já agiu ou viu que não era). Não reabre dentro da mesma janela. */
create or replace function public.alumia_mod_brigada_encerrar(p_id uuid) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); b alumia_brigadas;
begin
  select * into b from alumia_brigadas where id = p_id;
  if not found or b.situacao <> 'aberto' then perform interno.erro('nao_encontrado'); end if;
  if not interno.rede3_mod_modera(b.comunidade, null) then perform interno.erro('sem_permissao'); end if;
  update alumia_brigadas set situacao = 'encerrado', encerrado_em = now() where id = b.id;
  return jsonb_build_object('ok', true);
end $$;

-- ── 7. Perguntas para entrar ──────────────────────────────────────────────────────────────────────────────────────────────

/** As perguntas que a comunidade faz no pedido de entrada (lista vazia: nenhuma). Comunidade fechada só para quem é dela. */
create or replace function public.alumia_com_perguntas(p_slug text) returns jsonb language plpgsql stable security definer set search_path = interno, pg_temp as $$
declare v uuid := auth.uid(); c rede_comunidades;
begin
  c := interno.rede3_com_achar(p_slug);
  if c.slug is null or (c.tipo = 'fechada' and not interno.rede2_na_comunidade(c.slug, v) and not interno.rede3_mod_modera(c.slug, null)) then
    perform interno.erro('nao_encontrado');
  end if;
  return jsonb_build_object('perguntas', to_jsonb(coalesce((select q.perguntas from alumia_com_perguntas q where q.comunidade = c.slug), '{}'::text[])));
end $$;

/** A moderação escreve as perguntas (até 3, de 5 a 200 caracteres cada); lista vazia tira as perguntas. Pedidos já feitos ficam. */
create or replace function public.alumia_com_perguntas_salvar(p_slug text, p_perguntas text[]) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); c rede_comunidades; v_lista text[] := '{}'; q text;
begin
  c := interno.rede3_com_achar(p_slug);
  if c.slug is null then perform interno.erro('nao_encontrado'); end if;
  if not interno.rede3_mod_modera(c.slug, null) then perform interno.erro('sem_permissao'); end if;
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

/**
 * Pedir para entrar respondendo às perguntas. Sem perguntas na comunidade, é o mesmo que rede_com_entrar. Com perguntas, uma
 * resposta para cada (de 1 a 500 caracteres): as respostas ficam até a moderação decidir e somem com a decisão.
 */
create or replace function public.alumia_com_pedir(p_slug text, p_respostas text[]) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); c rede_comunidades; v_perguntas text[]; v_lista text[] := '{}'; i integer;
begin
  c := interno.rede3_com_achar(p_slug);
  if c.slug is null then perform interno.erro('nao_encontrado'); end if;
  select perguntas into v_perguntas from alumia_com_perguntas where comunidade = c.slug;
  if v_perguntas is not null and c.tipo = 'restrita' and interno.rede3_com_situacao(c.slug, v) is null then
    if coalesce(cardinality(p_respostas), 0) <> cardinality(v_perguntas) then perform interno.erro('responda_perguntas'); end if;
    for i in 1 .. cardinality(v_perguntas) loop
      v_lista := v_lista || interno.txt(p_respostas[i], 'resposta', 1, 500);
    end loop;
    insert into alumia_com_respostas (comunidade, usuario, respostas) values (c.slug, v, v_lista)
    on conflict (comunidade, usuario) do update set respostas = excluded.respostas, criado_em = now();
  end if;
  return public.rede_com_entrar(c.slug);
end $$;

/** Os pedidos de entrada esperando, com as respostas de cada um (só a moderação do lugar). O mesmo teto de 50 de rede_com_pedidos. */
create or replace function public.alumia_com_pedidos(p_slug text) returns jsonb language plpgsql stable security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); c rede_comunidades;
begin
  c := interno.rede3_com_achar(p_slug);
  if c.slug is null or not interno.rede3_com_modera(c.slug, v) then perform interno.erro('sem_permissao'); end if;
  return jsonb_build_object(
    'perguntas', to_jsonb(coalesce((select q.perguntas from alumia_com_perguntas q where q.comunidade = c.slug), '{}'::text[])),
    'itens', (select coalesce(jsonb_agg(jsonb_build_object('usuario', m.usuario, 'codinome', interno.rede_nome(m.usuario), 'quando', m.entrou_em,
        'respostas', to_jsonb(coalesce((select r.respostas from alumia_com_respostas r where r.comunidade = c.slug and r.usuario = m.usuario), '{}'::text[])))
        order by m.entrou_em), '[]'::jsonb)
      from (select * from rede_comunidade_membros where comunidade = c.slug and situacao = 'pendente' order by entrou_em limit 50) m));
end $$;

-- ── 8. Recursos com prazo (a fila de recursos da moderação) ──────────────────────────────────────────────────────────────

/**
 * A fila de recursos abertos que cabem a quem chama (a mesma de 2026-11-rede-moderacao.sql), agora com o prazo de resposta da
 * onda 8 (responder_ate, vencido), se a decisão contestada foi automática e, quando é uma conta, o nome dela (nunca quem decidiu).
 */
create or replace function public.rede_mod_recursos() returns jsonb language plpgsql stable security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu();
begin
  return coalesce((select jsonb_agg(jsonb_build_object(
      'id', r.id, 'texto', r.texto, 'criado_em', r.criado_em, 'situacao', r.situacao,
      'responder_ate', r.responder_ate, 'vencido', r.responder_ate is not null and r.responder_ate < now(),
      'acao', jsonb_build_object('id', m.id, 'acao', m.acao, 'alvo_tipo', m.alvo_tipo, 'alvo', m.alvo, 'regra', m.regra, 'motivo', m.motivo, 'criado_em', m.criado_em, 'automatica', m.quem is null),
      'conta', case when m.alvo_tipo = 'perfil' and m.alvo ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then interno.rede_nome(m.alvo::uuid) end,
      'minha', m.quem = v) order by r.responder_ate nulls last, r.criado_em)
    from rede_recursos r join rede_moderacao m on m.id = r.acao
    where r.situacao = 'aberto'
      and (case when m.alvo_tipo = 'post' then exists (select 1 from rede_posts p where p.id::text = m.alvo and interno.rede3_mod_pode_post(p, true))
                else interno.cuida() end)), '[]'::jsonb);
end $$;

-- ── 9. Permissões ─────────────────────────────────────────────────────────────────────────────────────────────────────────
revoke all on function interno.alumia_o9_links(text), interno.alumia_o9_dominios(text), interno.alumia_o9_dominio_bate(text, text[]),
  interno.alumia_o9_novata(text, uuid), interno.alumia_o9_lento_falta(text, text, uuid), interno.alumia_o9_automod_antes(),
  interno.alumia_o9_brigada_depois(), interno.alumia_o9_pedido_antes(), interno.alumia_o9_pedido_decidido() from public;
revoke all on function public.alumia_mod_automod(text), public.alumia_mod_automod_salvar(text, jsonb), public.alumia_mod_lento_falta(text, text),
  public.alumia_mod_brigadas(), public.alumia_mod_brigada_encerrar(uuid), public.alumia_com_perguntas(text), public.alumia_com_perguntas_salvar(text, text[]),
  public.alumia_com_pedir(text, text[]), public.alumia_com_pedidos(text), public.rede_mod_recursos() from public;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on function interno.alumia_o9_links(text), interno.alumia_o9_dominios(text), interno.alumia_o9_dominio_bate(text, text[]),
      interno.alumia_o9_novata(text, uuid), interno.alumia_o9_lento_falta(text, text, uuid), interno.alumia_o9_automod_antes(),
      interno.alumia_o9_brigada_depois(), interno.alumia_o9_pedido_antes(), interno.alumia_o9_pedido_decidido() from anon, authenticated;
    revoke all on function public.alumia_mod_automod(text), public.alumia_mod_automod_salvar(text, jsonb), public.alumia_mod_lento_falta(text, text),
      public.alumia_mod_brigadas(), public.alumia_mod_brigada_encerrar(uuid), public.alumia_com_perguntas(text), public.alumia_com_perguntas_salvar(text, text[]),
      public.alumia_com_pedir(text, text[]), public.alumia_com_pedidos(text), public.rede_mod_recursos() from anon, authenticated;
    -- As regras do lugar e as perguntas são abertas (regras escritas valem para quem lê antes de entrar).
    grant execute on function public.alumia_mod_automod(text), public.alumia_com_perguntas(text), public.alumia_mod_lento_falta(text, text) to anon, authenticated, service_role;
    grant execute on function public.alumia_mod_automod_salvar(text, jsonb), public.alumia_mod_brigadas(), public.alumia_mod_brigada_encerrar(uuid),
      public.alumia_com_perguntas_salvar(text, text[]), public.alumia_com_pedir(text, text[]), public.alumia_com_pedidos(text), public.rede_mod_recursos() to authenticated, service_role;
  end if;
end $$;

-- ── 10. A porta em todas as funções novas ─────────────────────────────────────────────────────────────────────────────────
do $$
declare v jsonb := interno.alumia_trancar();
begin
  if jsonb_array_length(v -> 'abertas') > 0 then
    raise warning 'alumia_trancar: função sem porta: %', v -> 'abertas';
  end if;
end $$;
