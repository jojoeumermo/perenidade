-- ───────────────────────────── Rede Lúcia v2: moderação (Etapa 7, R4, itens 45 a 49) ─────────────────────────────
-- Migração acrescentável: pode rodar mais de uma vez, sem apagar dado nenhum. Roda DEPOIS de 2026-11-rede-fundacao.sql (e das
-- outras migrações rede que vierem antes na ordem de docs/rede/V2.md). Texto das regras: docs/rede/MODERACAO.md; dados:
-- docs/rede/PRIVACIDADE.md. Teste: npm run testar:rede-moderacao.
--
-- O que este arquivo faz, e só isto:
--   1. Níveis de confiança (0 novo a 4 líder), como o Discourse: regras escritas numa tabela pública (rede_niveis), nível
--      calculado na hora por função (sobe e desce sozinho; o 4 é designação da coordenação) e limites por nível (links, imagens,
--      posts por dia) aplicados por gatilho, para valer qualquer que seja a função que grava o post.
--   2. Denúncia com protocolo (post, perfil, comunidade), quem denuncia nunca é revelado (nem à moderação), fila por prioridade,
--      ação com regra e motivo no registro só de inserção (rede_moderacao), aviso a quem denunciou e a quem foi moderado,
--      recurso em até 30 dias revisto por outra pessoa. A página /denunciar (visitante) alimenta a mesma fila por gatilho.
--   3. Modo lento (por comunidade ou conversa), trava de conversa, silenciar (pessoa, conversa, comunidade, palavra) no servidor
--      e listas de bloqueio da mediação (palavras e pessoas, por comunidade ou núcleo).
--   4. Rótulo de desinformação: liga um post a uma checagem que já existe em /checagens, sem apagar o post.
--
-- Dado de pessoa: nenhum novo além do que a denúncia exige (quem denunciou, só para o aviso de andamento; nunca devolvido a ninguém
-- que não seja a própria pessoa). Sem rastreamento: o nível usa contagens do que a pessoa FAZ (posts, apoios, salvos), nunca o que ela lê.
--
-- Leis: Marco Civil (12.965/2014) art. 19 e art. 21, e a decisão do STF nos Temas 987 e 533 (junho de 2025: o art. 19 é
-- parcialmente inconstitucional; retirada após notificação para a regra geral, ordem judicial para crimes contra a honra, dever de
-- cuidado nos casos graves); art. 15 (guarda de registros: esta migração não grava IP); LGPD (13.709/2018) arts. 11 e 18;
-- Código Penal arts. 138 a 140 (calúnia, difamação, injúria: a denúncia tem categoria própria e o recurso garante contraditório).

-- ── 0. O registro de moderação ganha as ações novas (continua só de inserção) ─────────────────────────────────────────────
do $$
declare c record;
begin
  for c in select conname from pg_constraint where conrelid = 'interno.rede_moderacao'::regclass and contype = 'c' and pg_get_constraintdef(oid) like '%recurso_mantido%' loop
    execute format('alter table interno.rede_moderacao drop constraint %I', c.conname);
  end loop;
  alter table interno.rede_moderacao add constraint rede_moderacao_acao_v2 check (acao in (
    'remover', 'restaurar', 'reter', 'travar', 'destravar', 'fixar', 'banir', 'desbanir', 'suspender', 'avisar', 'quebra_vidro',
    'recurso_mantido', 'recurso_revertido', 'descartar', 'modo_lento', 'rotular', 'desrotular', 'lista_adicionar', 'lista_remover', 'nivel_lider'));
end $$;

-- ── 1. Tabelas novas (todas com RLS ligada e nenhuma permissão para anon e authenticated) ────────────────────────────────

-- As regras dos níveis: escritas, públicas e conferíveis. Quem muda os números é a coordenação, no banco, e a mudança vale na hora.
create table if not exists interno.rede_niveis (
  nivel smallint primary key check (nivel between 0 and 4),
  nome text not null,
  automatico boolean not null default true,
  dias integer not null default 0 check (dias >= 0),
  participacoes integer not null default 0 check (participacoes >= 0),
  posts integer not null default 0 check (posts >= 0),
  sem_procedente integer not null default 0 check (sem_procedente >= 0),
  links smallint not null check (links between 0 and 50),
  imagens smallint not null check (imagens between 0 and 4),
  posts_dia integer not null check (posts_dia between 1 and 5000)
);
insert into interno.rede_niveis (nivel, nome, automatico, dias, participacoes, posts, sem_procedente, links, imagens, posts_dia) values
  (0, 'novo', true, 0, 0, 0, 0, 1, 1, 30),
  (1, 'básico', true, 2, 5, 0, 30, 2, 2, 60),
  (2, 'membro', true, 15, 30, 3, 90, 4, 4, 120),
  (3, 'regular', true, 60, 120, 20, 180, 8, 4, 240),
  (4, 'líder', false, 0, 0, 0, 0, 15, 4, 500)
on conflict (nivel) do nothing;

-- Quem a coordenação designou líder (nível 4). Só a coordenação mexe.
create table if not exists interno.rede_lideres (
  usuario uuid primary key references interno.perfis (id) on delete cascade,
  por uuid references interno.perfis (id) on delete set null,
  criado_em timestamptz not null default now()
);

-- Modo lento: intervalo mínimo entre dois posts da mesma pessoa numa comunidade ou numa conversa.
create table if not exists interno.rede_lento (
  alvo_tipo text not null check (alvo_tipo in ('comunidade', 'conversa')),
  alvo text not null check (char_length(alvo) between 1 and 80),
  segundos integer not null check (segundos between 5 and 86400),
  quem uuid references interno.perfis (id) on delete set null,
  desde timestamptz not null default now(),
  primary key (alvo_tipo, alvo)
);

-- Listas de bloqueio da mediação: palavras (o post fica retido para leitura) e pessoas (não escrevem ali).
create table if not exists interno.rede_bloqueio_lista (
  id uuid primary key default gen_random_uuid(),
  escopo_tipo text not null check (escopo_tipo in ('comunidade', 'nucleo')),
  escopo text not null check (char_length(escopo) between 1 and 80),
  tipo text not null check (tipo in ('palavra', 'pessoa')),
  palavra text check (palavra is null or char_length(palavra) between 2 and 60),
  pessoa uuid references interno.perfis (id) on delete cascade,
  motivo text not null default '' check (char_length(motivo) <= 300),
  quem uuid references interno.perfis (id) on delete set null,
  criado_em timestamptz not null default now(),
  check ((tipo = 'palavra' and palavra is not null and pessoa is null) or (tipo = 'pessoa' and pessoa is not null and palavra is null))
);
create index if not exists rede_bloqueio_lista_escopo on interno.rede_bloqueio_lista (escopo_tipo, escopo);

-- O rótulo de desinformação: o post continua lá; ao lado dele, o link para a checagem (o slug é o de content/checagens).
create table if not exists interno.rede_rotulos (
  post uuid primary key references interno.rede_posts (id) on delete cascade,
  checagem text not null check (checagem ~ '^[a-z0-9-]{2,120}$'),
  veredito text not null check (char_length(veredito) between 2 and 40),
  titulo text not null default '' check (char_length(titulo) <= 200),
  quem uuid references interno.perfis (id) on delete set null,
  criado_em timestamptz not null default now()
);

alter table interno.rede_niveis enable row level security;
alter table interno.rede_lideres enable row level security;
alter table interno.rede_lento enable row level security;
alter table interno.rede_bloqueio_lista enable row level security;
alter table interno.rede_rotulos enable row level security;
revoke all on interno.rede_niveis, interno.rede_lideres, interno.rede_lento, interno.rede_bloqueio_lista, interno.rede_rotulos from public;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on interno.rede_niveis, interno.rede_lideres, interno.rede_lento, interno.rede_bloqueio_lista, interno.rede_rotulos from anon, authenticated;
  end if;
end $$;

-- ── 2. Auxiliares internos ────────────────────────────────────────────────────────────────────────────────────────────

/** Quem chama modera este lugar? Equipe que cuida, moderador da comunidade ou mediação do núcleo. */
create or replace function interno.rede3_mod_modera(p_com text, p_nucleo uuid) returns boolean language sql stable security definer set search_path = interno, pg_temp as $$
  select auth.uid() is not null and (
    interno.cuida()
    or (p_com is not null and exists (select 1 from rede_comunidade_membros m where m.comunidade = p_com and m.usuario = auth.uid() and m.papel = 'moderacao' and m.situacao = 'ativo'))
    or (p_nucleo is not null and exists (select 1 from rede_nucleo_membros n where n.nucleo = p_nucleo and n.usuario = auth.uid() and n.papel = 'mediacao')))
$$;

/**
 * Quem chama pode agir neste post? Em núcleo: a mediação do núcleo; a equipe geral só a partir de uma denúncia (o quebra-vidro da
 * ESPEC, registrado e avisado à mediação em rede_mod_abrir). Fora de núcleo: equipe que cuida ou moderador da comunidade.
 */
create or replace function interno.rede3_mod_pode_post(p interno.rede_posts, p_com_denuncia boolean) returns boolean language sql stable security definer set search_path = interno, pg_temp as $$
  select case when p.nucleo is not null then
      auth.uid() is not null and (exists (select 1 from rede_nucleo_membros n where n.nucleo = p.nucleo and n.usuario = auth.uid() and n.papel = 'mediacao')
                                  or (p_com_denuncia and interno.cuida()))
    else interno.rede3_mod_modera(p.comunidade, null) end
$$;

/** Esta denúncia está no alcance de quem chama? */
create or replace function interno.rede3_mod_pode_denuncia(d interno.rede_denuncias) returns boolean language plpgsql stable security definer set search_path = interno, pg_temp as $$
declare x rede_posts;
begin
  if auth.uid() is null then return false; end if;
  if d.alvo_tipo = 'post' then
    select * into x from rede_posts where id::text = d.alvo;
    if not found then return interno.cuida(); end if;
    return interno.rede3_mod_pode_post(x, true);
  elsif d.alvo_tipo = 'comunidade' then
    return interno.rede3_mod_modera(d.alvo, null);
  end if;
  return interno.cuida();
end $$;

/** Registra uma ação no registro de moderação (só inserção). p_sistema = true: ação automática, sem pessoa. */
create or replace function interno.rede3_mod_registrar(p_acao text, p_tipo text, p_alvo text, p_regra text, p_motivo text, p_denuncia uuid, p_sistema boolean default false) returns uuid
language plpgsql security definer set search_path = interno, pg_temp as $$
declare v_id uuid;
begin
  insert into rede_moderacao (acao, alvo_tipo, alvo, regra, motivo, quem, denuncia)
  values (p_acao, p_tipo, p_alvo, left(btrim(coalesce(p_regra, '')), 80), left(btrim(coalesce(p_motivo, '')), 1000), case when p_sistema then null else auth.uid() end, p_denuncia)
  returning id into v_id;
  return v_id;
end $$;

/** Quantas decisões procedentes de moderação (remover, banir, suspender) recaíram sobre esta pessoa nos últimos p_dias dias, sem contar as revertidas. */
create or replace function interno.rede3_mod_procedentes(p_usuario uuid, p_dias integer) returns integer language sql stable security definer set search_path = interno, pg_temp as $$
  select count(*)::integer from rede_moderacao m
  where m.acao in ('remover', 'banir', 'suspender') and m.criado_em > now() - make_interval(days => greatest(p_dias, 0))
    and ((m.alvo_tipo = 'post' and exists (select 1 from rede_posts p where p.id::text = m.alvo and p.autor = p_usuario))
         or (m.alvo_tipo = 'perfil' and m.alvo = p_usuario::text))
    and not exists (select 1 from rede_recursos r where r.acao = m.id and r.situacao = 'revertido')
    and not exists (select 1 from rede_moderacao r2 where r2.acao = 'restaurar' and r2.alvo_tipo = m.alvo_tipo and r2.alvo = m.alvo and r2.criado_em > m.criado_em)
$$;

/** O que conta para o nível: dias de conta, participação (apoios, úteis e salvos que a pessoa deu) e posts à vista. Nada do que ela lê. */
create or replace function interno.rede3_mod_dados(p_usuario uuid) returns jsonb language sql stable security definer set search_path = interno, pg_temp as $$
  select jsonb_build_object(
    'dias', coalesce((select floor(extract(epoch from (now() - u.created_at)) / 86400)::integer from auth.users u where u.id = p_usuario), 0),
    'participacoes', (select count(*)::integer from rede_reacoes r where r.usuario = p_usuario) + (select count(*)::integer from rede_salvos s where s.usuario = p_usuario),
    'posts', (select count(*)::integer from rede_posts p where p.autor = p_usuario and not p.oculto and not p.retido and p.apagado_em is null))
$$;

/** O nível de confiança de uma pessoa, calculado na hora pelas regras de rede_niveis: sobe sozinho e desce se houver decisão procedente. O 4 é designação. */
create or replace function interno.rede3_mod_nivel(p_usuario uuid) returns smallint language plpgsql stable security definer set search_path = interno, pg_temp as $$
declare d jsonb; v smallint;
begin
  if p_usuario is null then return 0; end if;
  if exists (select 1 from rede_lideres l where l.usuario = p_usuario) then return 4; end if;
  d := interno.rede3_mod_dados(p_usuario);
  select coalesce(max(n.nivel), 0)::smallint into v from rede_niveis n
  where n.automatico and (d ->> 'dias')::integer >= n.dias and (d ->> 'participacoes')::integer >= n.participacoes and (d ->> 'posts')::integer >= n.posts
    and (n.sem_procedente = 0 or interno.rede3_mod_procedentes(p_usuario, n.sem_procedente) = 0);
  return v;
end $$;

/** Classifica o motivo livre do formulário /denunciar numa categoria da fila (a prioridade vem da categoria). */
create or replace function interno.rede3_mod_categoria(p_motivo text) returns text language sql immutable as $$
  select case
    when m ~ 'menor|crianc|adolescente|infantil' then 'menores'
    when m ~ 'amea' then 'ameaca'
    when m ~ 'exposi|dados pessoais|doxx|endereco' then 'exposicao'
    when m ~ 'violen|incita' then 'violencia'
    when m ~ 'suicid|autoles' then 'autolesao'
    when m ~ 'odio|racis|discrimin' then 'odio'
    when m ~ 'assedio|persegu' then 'assedio'
    when m ~ 'golpe|fraude' then 'golpe'
    when m ~ 'spam' then 'spam'
    else 'outro' end
  from (select interno.normal(coalesce(p_motivo, '')) as m) t
$$;

/** Avisa quem foi moderado, com o caminho do recurso (sem dizer quem decidiu). */
create or replace function interno.rede3_mod_avisar_afetado(p_usuario uuid, p_texto text) returns void language sql security definer set search_path = interno, pg_temp as $$
  select interno.avisar_em(p_usuario, p_texto, 'rede')
$$;

-- ── 3. Gatilhos: limites por nível, modo lento, listas de bloqueio ────────────────────────────────────────────────────────

/**
 * Antes de gravar um post feito por uma pessoa (não por migração nem por função do banco): lista de bloqueio de pessoas, modo lento,
 * limite diário e de links do nível; palavra da lista da mediação deixa o post retido para leitura. Quem modera o lugar não passa por isto.
 * Roda para qualquer função que grave (inclusive as que os outros pacotes redefinem).
 */
create or replace function interno.rede3_mod_antes_de_postar() returns trigger language plpgsql security definer set search_path = interno, pg_temp as $$
declare
  v uuid := auth.uid(); n rede_niveis; v_txt text; v_links integer; v_lento integer; v_raiz uuid;
begin
  if v is null or new.autor is distinct from v then return new; end if;
  if interno.voluntario() or interno.rede3_mod_modera(new.comunidade, new.nucleo) then return new; end if;
  v_txt := coalesce(new.titulo, '') || ' ' || coalesce(new.texto, '') || ' ' || coalesce(new.corpo, '');

  if exists (select 1 from rede_bloqueio_lista l where l.tipo = 'pessoa' and l.pessoa = v
             and ((l.escopo_tipo = 'comunidade' and l.escopo = new.comunidade) or (l.escopo_tipo = 'nucleo' and l.escopo = new.nucleo::text))) then
    perform interno.erro('lista_bloqueio');
  end if;

  -- Modo lento: da comunidade e da conversa.
  if new.comunidade is not null then
    select segundos into v_lento from rede_lento where alvo_tipo = 'comunidade' and alvo = new.comunidade;
    if v_lento is not null and exists (select 1 from rede_posts p where p.autor = v and p.comunidade = new.comunidade and p.criado_em > now() - make_interval(secs => v_lento)) then
      perform interno.erro('modo_lento');
    end if;
  end if;
  if new.resposta_a is not null then
    select coalesce(root_id, id) into v_raiz from rede_posts where id = new.resposta_a;
    select segundos into v_lento from rede_lento where alvo_tipo = 'conversa' and alvo = v_raiz::text;
    if v_lento is not null and exists (select 1 from rede_posts p where p.autor = v and (p.root_id = v_raiz or p.id = v_raiz) and p.criado_em > now() - make_interval(secs => v_lento)) then
      perform interno.erro('modo_lento');
    end if;
  end if;

  -- Limites do nível de confiança (regras públicas em rede_niveis).
  select * into n from rede_niveis where nivel = interno.rede3_mod_nivel(v);
  if (select count(*) from rede_posts p where p.autor = v and p.criado_em > now() - interval '24 hours') >= n.posts_dia then perform interno.erro('limite_diario'); end if;
  select count(*)::integer into v_links from regexp_matches(v_txt, '(https?://|www\.)', 'gi');
  if v_links > n.links then perform interno.erro('nivel_links'); end if;

  -- Palavra da lista da mediação: o post nasce retido, para a mediação ler (nada é recusado em silêncio).
  if exists (select 1 from rede_bloqueio_lista l where l.tipo = 'palavra'
             and ((l.escopo_tipo = 'comunidade' and l.escopo = new.comunidade) or (l.escopo_tipo = 'nucleo' and l.escopo = new.nucleo::text))
             and position(interno.normal(l.palavra) in interno.normal(v_txt)) > 0) then
    new.retido := true; new.oculto := true; new.avaliacao := 'revisao'; new.motivo := 'lista_da_mediacao';
  end if;
  return new;
end $$;
drop trigger if exists rede3_mod_posts on interno.rede_posts;
create trigger rede3_mod_posts before insert on interno.rede_posts for each row execute function interno.rede3_mod_antes_de_postar();

/** Antes de gravar uma imagem: o limite de imagens do nível de quem escreveu o post. */
create or replace function interno.rede3_mod_antes_da_midia() returns trigger language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := auth.uid(); a rede_posts; n rede_niveis;
begin
  if v is null then return new; end if;
  select * into a from rede_posts where id = new.post;
  if not found or a.autor is distinct from v or interno.voluntario() or interno.rede3_mod_modera(a.comunidade, a.nucleo) then return new; end if;
  select * into n from rede_niveis where nivel = interno.rede3_mod_nivel(v);
  if (select count(*) from rede_midia m where m.post = new.post) >= n.imagens then perform interno.erro('nivel_imagens'); end if;
  return new;
end $$;
drop trigger if exists rede3_mod_midia on interno.rede_midia;
create trigger rede3_mod_midia before insert on interno.rede_midia for each row execute function interno.rede3_mod_antes_da_midia();

/**
 * A página /denunciar (que serve também a visitante) alimenta a mesma fila: quando o endereço denunciado é um post da Rede
 * (/comunidade/p/<id> ou ?post=<id>) e quem denuncia poderia vê-lo (visitante: só o que é público), nasce uma denúncia com protocolo.
 * Visitante não tem como acompanhar (não há conta): o protocolo vale só para a moderação.
 */
create or replace function interno.rede3_mod_ponte_denuncia() returns trigger language plpgsql security definer set search_path = interno, pg_temp as $$
declare v_id text := substring(new.alvo from '([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})'); x rede_posts; v_cat text;
begin
  if v_id is null or (new.alvo !~ '/comunidade/p/' and new.alvo !~ 'post=') then return new; end if;
  select * into x from rede_posts where id = v_id::uuid;
  if not found or not interno.rede_ve(x, new.autor) or x.autor is not distinct from new.autor then return new; end if;
  v_cat := interno.rede3_mod_categoria(new.motivo);
  if new.autor is not null and exists (select 1 from rede_denuncias d where d.quem = new.autor and d.alvo_tipo = 'post' and d.alvo = v_id and d.situacao in ('aberta', 'em_analise')) then return new; end if;
  insert into rede_denuncias (alvo_tipo, alvo, categoria, prioridade, texto, quem) values ('post', v_id, v_cat, interno.rede2_prioridade(v_cat), left(new.detalhes, 2000), new.autor);
  return new;
exception when others then
  return new;
end $$;
drop trigger if exists rede3_mod_ponte on interno.denuncias;
create trigger rede3_mod_ponte after insert on interno.denuncias for each row execute function interno.rede3_mod_ponte_denuncia();

-- ── 4. Níveis de confiança (leitura) ──────────────────────────────────────────────────────────────────────────────────────

/** As regras dos níveis, públicas: qualquer pessoa, com ou sem conta, pode conferir como se sobe de nível e o que cada nível pode. */
create or replace function public.rede_mod_niveis() returns jsonb language sql stable security definer set search_path = interno, pg_temp as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'nivel', n.nivel, 'nome', n.nome, 'automatico', n.automatico, 'dias', n.dias, 'participacoes', n.participacoes, 'posts', n.posts,
    'sem_procedente', n.sem_procedente, 'links', n.links, 'imagens', n.imagens, 'posts_dia', n.posts_dia) order by n.nivel), '[]'::jsonb)
  from rede_niveis n
$$;

/** O meu nível, o que falta para o próximo e os limites de hoje. Só a própria pessoa vê. */
create or replace function public.rede_mod_meu_nivel() returns jsonb language plpgsql stable security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); v_n smallint := interno.rede3_mod_nivel(v); a rede_niveis; p rede_niveis;
begin
  select * into a from rede_niveis where nivel = v_n;
  select * into p from rede_niveis where nivel = v_n + 1 and automatico;
  return jsonb_build_object(
    'nivel', v_n, 'nome', a.nome, 'lider', exists (select 1 from rede_lideres l where l.usuario = v),
    'dados', interno.rede3_mod_dados(v),
    'procedentes_90', interno.rede3_mod_procedentes(v, 90),
    'atual', to_jsonb(a),
    'proximo', case when p.nivel is not null then to_jsonb(p) end,
    'proximo_sem_procedente', case when p.nivel is not null then interno.rede3_mod_procedentes(v, p.sem_procedente) = 0 end);
end $$;

/** Designar (ou tirar) uma pessoa do nível 4, líder. Só a coordenação; fica no registro. */
create or replace function public.rede_mod_lider(p_handle text, p_sim boolean) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); f perfis;
begin
  if not interno.coord() then perform interno.erro('sem_permissao'); end if;
  select * into f from perfis where rede_handle = lower(btrim(coalesce(p_handle, ''), ' @'));
  if not found then perform interno.erro('nao_encontrado'); end if;
  if coalesce(p_sim, false) then
    insert into rede_lideres (usuario, por) values (f.id, v) on conflict do nothing;
  else
    delete from rede_lideres where usuario = f.id;
  end if;
  perform interno.rede3_mod_registrar('nivel_lider', 'perfil', f.id::text, 'niveis', case when coalesce(p_sim, false) then 'Designada líder pela coordenação.' else 'Deixou de ser líder.' end, null);
  return jsonb_build_object('lider', exists (select 1 from rede_lideres l where l.usuario = f.id));
end $$;

/** O que quem chama modera: o painel só mostra o que cabe. */
create or replace function public.rede_mod_escopo() returns jsonb language plpgsql stable security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu();
begin
  return jsonb_build_object(
    'cuida', interno.cuida(), 'coord', interno.coord(),
    'comunidades', coalesce((select jsonb_agg(m.comunidade order by m.comunidade) from rede_comunidade_membros m where m.usuario = v and m.papel = 'moderacao' and m.situacao = 'ativo'), '[]'::jsonb),
    'nucleos', coalesce((select jsonb_agg(jsonb_build_object('id', n.id, 'nome', n.nome) order by n.nome) from rede_nucleo_membros m join rede_nucleos n on n.id = m.nucleo where m.usuario = v and m.papel = 'mediacao'), '[]'::jsonb));
end $$;

-- ── 5. Denúncia com protocolo ─────────────────────────────────────────────────────────────────────────────────────────────

/**
 * Denunciar um post (id), um perfil (@handle) ou uma comunidade (slug). Quem denuncia nunca é revelado: a moderação não vê quem foi, e o alvo
 * muito menos. Só se denuncia o que se pode ver (a matriz vale aqui também). Mesma pessoa, mesmo alvo, denúncia ainda aberta: devolve o
 * mesmo protocolo. Categorias de prioridade 1 (menores, ameaça, exposição de dados, incitação à violência, autolesão) entram na frente
 * da fila e avisam a coordenação e a mediação; para menores e exposição de dados o post fica retido por precaução até a leitura
 * (reversível; o autor é avisado e pode recorrer). Esse freio tem teto por conta, para a denúncia não virar arma.
 */
create or replace function public.rede_mod_denunciar(p_alvo_tipo text, p_alvo text, p_categoria text, p_texto text default '') returns jsonb
language plpgsql security definer set search_path = interno, pg_temp as $$
declare
  v uuid := interno.eu(); x rede_posts; f perfis; c rede_comunidades; v_alvo text; d rede_denuncias; v_pri smallint; v_retido boolean := false;
  v_texto text := interno.txt(coalesce(p_texto, ''), 'texto', 0, 2000);
begin
  perform interno.aberta('comunidade');
  if p_categoria is null or p_categoria not in ('menores', 'ameaca', 'exposicao', 'violencia', 'autolesao', 'odio', 'assedio', 'golpe', 'spam', 'outro') then perform interno.erro('invalido:categoria'); end if;
  if p_alvo_tipo = 'post' then
    begin select * into x from rede_posts where id = p_alvo::uuid; exception when others then perform interno.erro('invalido:alvo'); end;
    if not found or not interno.rede_ve(x, v) then perform interno.erro('nao_encontrado'); end if;
    if x.autor = v then perform interno.erro('sem_permissao'); end if;
    v_alvo := x.id::text;
  elsif p_alvo_tipo = 'perfil' then
    select * into f from perfis where rede_handle = lower(btrim(coalesce(p_alvo, ''), ' @'));
    if not found or (f.id <> v and (f.rede_modo = 'invisivel' or f.rede_invisivel or interno.rede_bloqueado(v, f.id))) then perform interno.erro('nao_encontrado'); end if;
    if f.id = v then perform interno.erro('sem_permissao'); end if;
    v_alvo := f.id::text;
  elsif p_alvo_tipo = 'comunidade' then
    select * into c from rede_comunidades where slug = coalesce(p_alvo, '') or coalesce(p_alvo, '') = any (apelidos) order by (slug = coalesce(p_alvo, '')) desc limit 1;
    if not found or (c.tipo = 'fechada' and not interno.rede2_na_comunidade(c.slug, v)) then perform interno.erro('nao_encontrado'); end if;
    v_alvo := c.slug;
  else
    perform interno.erro('invalido:alvo_tipo');
  end if;

  select * into d from rede_denuncias where quem = v and alvo_tipo = p_alvo_tipo and alvo = v_alvo and situacao in ('aberta', 'em_analise') limit 1;
  if found then return jsonb_build_object('protocolo', d.protocolo, 'prioridade', d.prioridade, 'retido', false, 'ja', true); end if;

  perform interno.rede2_limite('denunciar');
  v_pri := interno.rede2_prioridade(p_categoria);
  insert into rede_denuncias (alvo_tipo, alvo, categoria, prioridade, texto, quem) values (p_alvo_tipo, v_alvo, p_categoria, v_pri, v_texto, v) returning * into d;

  if p_alvo_tipo = 'post' and p_categoria in ('menores', 'exposicao') and not (x.oculto or x.retido) then
    begin
      perform interno.limite('rede3_precaucao', 5, 1440);
      update rede_posts set retido = true, oculto = true, motivo = 'aguardando_analise_de_denuncia' where id = x.id;
      perform interno.rede3_mod_registrar('reter', 'post', x.id::text, 'precaucao', 'Retido por precaução até a moderação ler a denúncia ' || d.protocolo || '.', d.id, true);
      perform interno.rede3_mod_avisar_afetado(x.autor, 'Um post seu ficou retido por precaução enquanto a moderação lê uma denúncia (decisão automática, ainda sem leitura de uma pessoa). Só você o vê. Você pode recorrer em até 30 dias, em Denúncias e recursos.');
      v_retido := true;
    exception when others then
      v_retido := false;
    end;
  end if;

  if v_pri = 1 then
    insert into avisos (para, texto)
    select distinct p.usuario, left('Denúncia prioritária ' || d.protocolo || ' (' || p_categoria || '). Abra a fila de moderação da Rede.', 500) from papeis p where p.papel in ('coordenacao', 'vice', 'mediacao') and p.usuario <> v;
  end if;
  return jsonb_build_object('protocolo', d.protocolo, 'prioridade', d.prioridade, 'retido', v_retido, 'ja', false);
end $$;

/** As denúncias que EU fiz: protocolo, categoria, andamento e o que a Rede decidiu (a regra e a ação; nunca quem decidiu nem detalhes do alvo). */
create or replace function public.rede_mod_minhas_denuncias() returns jsonb language plpgsql stable security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu();
begin
  return coalesce((select jsonb_agg(jsonb_build_object(
      'protocolo', d.protocolo, 'alvo_tipo', d.alvo_tipo, 'categoria', d.categoria, 'situacao', d.situacao, 'criado_em', d.criado_em,
      'acao', (select m.acao from rede_moderacao m where m.denuncia = d.id order by m.criado_em desc limit 1),
      'regra', (select m.regra from rede_moderacao m where m.denuncia = d.id order by m.criado_em desc limit 1)) order by d.criado_em desc)
    from (select * from rede_denuncias where quem = v order by criado_em desc limit 100) d), '[]'::jsonb);
end $$;

-- ── 6. A fila de moderação ────────────────────────────────────────────────────────────────────────────────────────────────

/** Uma denúncia como a fila mostra: sem quem denunciou, e sem trecho de conteúdo de núcleo (só abrindo, com o quebra-vidro registrado). */
create or replace function interno.rede3_mod_item(d interno.rede_denuncias) returns jsonb language plpgsql stable security definer set search_path = interno, pg_temp as $$
declare x rede_posts; v_trecho text; v_nucleo boolean := false; v_com text; v_titulo text;
begin
  if d.alvo_tipo = 'post' then
    select * into x from rede_posts where id::text = d.alvo;
    if found then
      v_nucleo := x.nucleo is not null; v_com := x.comunidade; v_titulo := x.titulo;
      if not v_nucleo then v_trecho := left(x.texto, 200); end if;
    end if;
  elsif d.alvo_tipo = 'comunidade' then
    v_com := d.alvo;
  end if;
  return jsonb_build_object(
    'id', d.id, 'protocolo', d.protocolo, 'alvo_tipo', d.alvo_tipo, 'alvo', d.alvo, 'categoria', d.categoria, 'prioridade', d.prioridade,
    'situacao', d.situacao, 'criado_em', d.criado_em, 'texto', d.texto, 'comunidade', v_com, 'titulo', v_titulo, 'trecho', v_trecho, 'nucleo', v_nucleo,
    'mesmas', (select count(*)::integer from rede_denuncias o where o.alvo_tipo = d.alvo_tipo and o.alvo = d.alvo));
end $$;

/** A fila por prioridade (1 primeiro: menores, ameaça, exposição, violência, autolesão), depois pela mais antiga. 'abertas' ou 'fechadas'. */
create or replace function public.rede_mod_fila(p_situacao text default 'abertas') returns jsonb language plpgsql stable security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu();
begin
  if not (interno.cuida() or exists (select 1 from rede_comunidade_membros m where m.usuario = v and m.papel = 'moderacao' and m.situacao = 'ativo')
          or exists (select 1 from rede_nucleo_membros n where n.usuario = v and n.papel = 'mediacao')) then
    perform interno.erro('sem_permissao');
  end if;
  return coalesce((select jsonb_agg(interno.rede3_mod_item(d) order by (d.situacao in ('aberta', 'em_analise')) desc, d.prioridade, d.criado_em)
    from (select * from rede_denuncias q
          where (case when coalesce(p_situacao, 'abertas') = 'fechadas' then q.situacao in ('resolvida', 'descartada') else q.situacao in ('aberta', 'em_analise') end)
          order by q.prioridade, q.criado_em limit 400) d
    where interno.rede3_mod_pode_denuncia(d)), '[]'::jsonb);
end $$;

/**
 * Abre uma denúncia com o conteúdo para decidir. Em post de núcleo a equipe geral só entra por aqui: o acesso fica no registro
 * (quebra-vidro, uma vez por pessoa e denúncia) e a mediação do núcleo é avisada (ESPEC, seção 2). Marca a denúncia como "em análise".
 */
create or replace function public.rede_mod_abrir(p_denuncia uuid) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); d rede_denuncias; x rede_posts; v_post jsonb; v_alvo_nome text; v_membro_nucleo boolean;
begin
  select * into d from rede_denuncias where id = p_denuncia;
  if not found or not interno.rede3_mod_pode_denuncia(d) then perform interno.erro('nao_encontrado'); end if;
  if d.situacao = 'aberta' then update rede_denuncias set situacao = 'em_analise', cuida = v where id = d.id; d.situacao := 'em_analise'; end if;
  if d.alvo_tipo = 'post' then
    select * into x from rede_posts where id::text = d.alvo;
    if found then
      if x.nucleo is not null then
        v_membro_nucleo := exists (select 1 from rede_nucleo_membros n where n.nucleo = x.nucleo and n.usuario = v);
        if not v_membro_nucleo and not exists (select 1 from rede_moderacao m where m.acao = 'quebra_vidro' and m.denuncia = d.id and m.quem = v) then
          perform interno.rede3_mod_registrar('quebra_vidro', 'post', x.id::text, 'denuncia', 'A moderação geral abriu o post de núcleo por causa da denúncia ' || d.protocolo || '.', d.id);
          insert into avisos (para, texto, categoria)
          select n.usuario, 'A moderação geral abriu um post do núcleo por causa de uma denúncia (protocolo ' || d.protocolo || '). O acesso ficou registrado.', 'rede' from rede_nucleo_membros n where n.nucleo = x.nucleo and n.papel = 'mediacao';
        end if;
      end if;
      v_post := jsonb_build_object(
        'id', x.id, 'tipo', x.tipo, 'titulo', x.titulo, 'texto', x.texto, 'corpo', x.corpo, 'comunidade', x.comunidade, 'publico', interno.rede2_publico(x),
        'criado_em', x.criado_em, 'oculto', x.oculto, 'retido', x.retido, 'travado', x.travado, 'motivo', x.motivo,
        'autor', interno.rede_nome(x.autor), 'autor_nivel', interno.rede3_mod_nivel(x.autor), 'autor_procedentes_90', interno.rede3_mod_procedentes(x.autor, 90),
        'rotulo', (select to_jsonb(r) - 'quem' from rede_rotulos r where r.post = x.id));
    end if;
  elsif d.alvo_tipo = 'perfil' then
    select jsonb_build_object('codinome', f.rede_codinome, 'handle', f.rede_handle, 'bio', f.rede_bio, 'nivel', interno.rede3_mod_nivel(f.id), 'procedentes_90', interno.rede3_mod_procedentes(f.id, 90)) into v_post from perfis f where f.id::text = d.alvo;
  end if;
  return jsonb_build_object(
    'denuncia', interno.rede3_mod_item(d), 'alvo', v_post,
    'historico', coalesce((select jsonb_agg(jsonb_build_object('id', m.id, 'acao', m.acao, 'regra', m.regra, 'motivo', m.motivo, 'criado_em', m.criado_em, 'por', interno.rede_nome(m.quem)) order by m.criado_em desc)
                           from rede_moderacao m where m.alvo_tipo = d.alvo_tipo and m.alvo = d.alvo and m.acao <> 'quebra_vidro'), '[]'::jsonb));
end $$;

/** Posts retidos esperando leitura (palavra da lista, modo de segurança, precaução), só do que a pessoa modera. */
create or replace function public.rede_mod_retidos() returns jsonb language plpgsql stable security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu();
begin
  return coalesce((select jsonb_agg(jsonb_build_object(
      'id', p.id, 'titulo', p.titulo, 'trecho', left(p.texto, 200), 'comunidade', p.comunidade, 'motivo', p.motivo, 'criado_em', p.criado_em,
      'autor', interno.rede_nome(p.autor), 'autor_nivel', interno.rede3_mod_nivel(p.autor)) order by p.criado_em)
    from (select * from rede_posts where retido and apagado_em is null order by criado_em limit 300) p
    where interno.rede3_mod_pode_post(p, false)), '[]'::jsonb);
end $$;

/**
 * Agir: remover, restaurar, reter, travar, destravar, avisar (num post ou perfil) ou banir/desbanir uma pessoa de uma comunidade
 * (p_contexto = o slug). Toda ação pede a regra citada e o motivo, entra no registro só de inserção, avisa o autor com o caminho do
 * recurso (30 dias) e, vindo de uma denúncia, fecha a denúncia e avisa quem denunciou. Suspender a conta continua no painel.
 */
create or replace function public.rede_mod_agir(p_denuncia uuid, p_alvo_tipo text, p_alvo text, p_acao text, p_regra text, p_motivo text, p_contexto text default null) returns jsonb
language plpgsql security definer set search_path = interno, pg_temp as $$
declare
  v uuid := interno.eu(); d rede_denuncias; x rede_posts; f perfis;
  v_regra text := interno.txt(p_regra, 'regra', 3, 80); v_motivo text := interno.txt(p_motivo, 'motivo', 3, 1000);
  v_id uuid; v_afetado uuid; v_motivo_log text := interno.txt(p_motivo, 'motivo', 3, 1000); v_texto text; v_com text := nullif(btrim(coalesce(p_contexto, '')), '');
begin
  if p_acao is null or p_acao not in ('remover', 'restaurar', 'reter', 'travar', 'destravar', 'avisar', 'banir', 'desbanir') then perform interno.erro('invalido:acao'); end if;
  if p_denuncia is not null then
    select * into d from rede_denuncias where id = p_denuncia;
    if not found or not interno.rede3_mod_pode_denuncia(d) then perform interno.erro('nao_encontrado'); end if;
    -- A denúncia tem de ser sobre o alvo da ação: senão ela serviria de passe livre (quebra-vidro) para mexer em outro post.
    if d.alvo_tipo is distinct from p_alvo_tipo then perform interno.erro('invalido:alvo'); end if;
  end if;
  perform interno.limite('rede3_agir', 300, 60);

  if p_alvo_tipo = 'post' and p_acao in ('remover', 'restaurar', 'reter', 'travar', 'destravar', 'avisar') then
    begin select * into x from rede_posts where id = p_alvo::uuid; exception when others then perform interno.erro('invalido:alvo'); end;
    if p_denuncia is not null and d.alvo is distinct from x.id::text then perform interno.erro('invalido:alvo'); end if;
    if not found or not interno.rede3_mod_pode_post(x, p_denuncia is not null) then perform interno.erro('nao_encontrado'); end if;
    -- Equipe geral em post de núcleo: só depois de abrir a denúncia (rede_mod_abrir registra o quebra-vidro e avisa a mediação).
    if x.nucleo is not null and not exists (select 1 from rede_nucleo_membros n where n.nucleo = x.nucleo and n.usuario = v and n.papel = 'mediacao')
       and not exists (select 1 from rede_moderacao m where m.acao = 'quebra_vidro' and m.denuncia = p_denuncia and m.quem = v) then
      perform interno.erro('sem_permissao');
    end if;
    v_afetado := x.autor;
    if p_acao = 'remover' then update rede_posts set oculto = true, retido = false, motivo = left(v_motivo, 200) where id = x.id;
    elsif p_acao = 'restaurar' then update rede_posts set oculto = false, retido = false, motivo = '', avaliacao = 'revista' where id = x.id;
    elsif p_acao = 'reter' then update rede_posts set oculto = true, retido = true, motivo = left(v_motivo, 200) where id = x.id;
    elsif p_acao = 'travar' then update rede_posts set travado = true where id = x.id;
    elsif p_acao = 'destravar' then update rede_posts set travado = false where id = x.id;
    end if;
    v_id := interno.rede3_mod_registrar(p_acao, 'post', x.id::text, v_regra, v_motivo_log, p_denuncia);
  elsif p_alvo_tipo = 'perfil' and p_acao in ('avisar', 'banir', 'desbanir') then
    select * into f from perfis where rede_handle = lower(btrim(coalesce(p_alvo, ''), ' @'));
    if not found then
      begin select * into f from perfis where id = p_alvo::uuid; exception when others then null; end;
    end if;
    if f.id is null then perform interno.erro('nao_encontrado'); end if;
    if f.id = v or interno.voluntario_e(f.id) then perform interno.erro('sem_permissao'); end if;
    v_afetado := f.id;
    if p_acao in ('banir', 'desbanir') then
      if v_com is null or not exists (select 1 from rede_comunidades where slug = v_com) then perform interno.erro('invalido:contexto'); end if;
      if not interno.rede3_mod_modera(v_com, null) then perform interno.erro('sem_permissao'); end if;
      if p_acao = 'banir' then
        insert into rede_comunidade_membros (comunidade, usuario, situacao, papel) values (v_com, f.id, 'banido', 'membro')
        on conflict (comunidade, usuario) do update set situacao = 'banido', papel = 'membro', banido_ate = null;
      else
        delete from rede_comunidade_membros where comunidade = v_com and usuario = f.id and situacao = 'banido';
      end if;
      v_motivo_log := 'comunidade ' || v_com || ': ' || v_motivo;
    elsif not (interno.cuida() or (v_com is not null and interno.rede3_mod_modera(v_com, null))) then
      perform interno.erro('sem_permissao');
    end if;
    v_id := interno.rede3_mod_registrar(p_acao, 'perfil', f.id::text, v_regra, left(v_motivo_log, 1000), p_denuncia);
  else
    perform interno.erro('invalido:alvo_tipo');
  end if;

  v_texto := case p_acao
    when 'remover' then 'Um post seu foi retirado da Rede'
    when 'reter' then 'Um post seu ficou retido para leitura da moderação'
    when 'travar' then 'Uma conversa sua foi travada'
    when 'banir' then 'Você não pode mais escrever numa comunidade da Rede'
    when 'avisar' then 'A moderação da Rede deixou um aviso para você'
    else null end;
  if v_texto is not null and v_afetado is not null then
    perform interno.rede3_mod_avisar_afetado(v_afetado, left(v_texto || ' (regra: ' || v_regra || '). Decisão de uma pessoa da moderação. Você pode recorrer em até 30 dias, em Denúncias e recursos. Motivo: ' || left(v_motivo, 200), 500));
  end if;
  if p_denuncia is not null and p_acao <> 'restaurar' then
    update rede_denuncias set situacao = 'resolvida', cuida = v where id = d.id;
    perform interno.avisar_em(d.quem, 'Sua denúncia ' || d.protocolo || ' foi analisada e a Rede tomou providências. Obrigada por cuidar da Rede.', 'rede');
  end if;
  return jsonb_build_object('acao', v_id);
end $$;

/** Fecha uma denúncia sem ação: 'em_analise', 'resolvida' ou 'descartada' (esta pede o motivo, que fica no registro). Quem denunciou é avisado. */
create or replace function public.rede_mod_denuncia_situacao(p_denuncia uuid, p_situacao text, p_nota text default '') returns jsonb
language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); d rede_denuncias; v_nota text := interno.txt(coalesce(p_nota, ''), 'nota', 0, 1000);
begin
  if p_situacao is null or p_situacao not in ('em_analise', 'resolvida', 'descartada') then perform interno.erro('invalido:situacao'); end if;
  select * into d from rede_denuncias where id = p_denuncia;
  if not found or not interno.rede3_mod_pode_denuncia(d) then perform interno.erro('nao_encontrado'); end if;
  if p_situacao = 'descartada' then
    if char_length(v_nota) < 3 then perform interno.erro('invalido:nota'); end if;
    perform interno.rede3_mod_registrar('descartar', d.alvo_tipo, d.alvo, 'sem_violacao', v_nota, d.id);
  end if;
  update rede_denuncias set situacao = p_situacao, cuida = v where id = d.id;
  if p_situacao <> 'em_analise' then
    perform interno.avisar_em(d.quem, case p_situacao
      when 'descartada' then 'Sua denúncia ' || d.protocolo || ' foi analisada: não encontramos violação das normas da Rede. Obrigada por cuidar da Rede.'
      else 'Sua denúncia ' || d.protocolo || ' foi analisada e encerrada. Obrigada por cuidar da Rede.' end, 'rede');
  end if;
  return jsonb_build_object('situacao', p_situacao);
end $$;

-- ── 7. Recurso (30 dias, revisto por outra pessoa) ────────────────────────────────────────────────────────────────────────

/** As decisões de moderação sobre o que EU escrevi (ou sobre o meu perfil): a regra, o motivo, o prazo e o andamento do recurso. Nunca quem decidiu. */
create or replace function public.rede_mod_minhas_decisoes() returns jsonb language plpgsql stable security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu();
begin
  return coalesce((select jsonb_agg(jsonb_build_object(
      'id', m.id, 'acao', m.acao, 'alvo_tipo', m.alvo_tipo, 'alvo', case when m.alvo_tipo = 'post' then m.alvo end, 'regra', m.regra, 'motivo', m.motivo, 'criado_em', m.criado_em,
      'prazo', m.criado_em + interval '30 days',
      'recurso', (select jsonb_build_object('situacao', r.situacao, 'criado_em', r.criado_em, 'decidido_em', r.decidido_em) from rede_recursos r where r.acao = m.id),
      'pode_recorrer', m.acao in ('remover', 'reter', 'travar', 'banir', 'suspender') and now() <= m.criado_em + interval '30 days'
                       and not exists (select 1 from rede_recursos r where r.acao = m.id)) order by m.criado_em desc)
    from rede_moderacao m
    where m.acao in ('remover', 'reter', 'travar', 'banir', 'suspender', 'avisar') and m.criado_em > now() - interval '180 days'
      and ((m.alvo_tipo = 'post' and exists (select 1 from rede_posts p where p.id::text = m.alvo and p.autor = v))
           or (m.alvo_tipo = 'perfil' and m.alvo = v::text))), '[]'::jsonb);
end $$;

/** Recorrer de uma decisão em até 30 dias. Só quem foi atingido; um recurso por decisão. Vai para a fila de recursos, para outra pessoa da moderação. */
create or replace function public.rede_mod_recorrer(p_acao uuid, p_texto text) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); m rede_moderacao; v_texto text := interno.txt(p_texto, 'texto', 10, 2000); v_afetado boolean;
begin
  select * into m from rede_moderacao where id = p_acao;
  if not found or m.acao not in ('remover', 'reter', 'travar', 'banir', 'suspender') then perform interno.erro('nao_encontrado'); end if;
  v_afetado := (m.alvo_tipo = 'post' and exists (select 1 from rede_posts p where p.id::text = m.alvo and p.autor = v)) or (m.alvo_tipo = 'perfil' and m.alvo = v::text);
  if not v_afetado then perform interno.erro('nao_encontrado'); end if;
  if now() > m.criado_em + interval '30 days' then perform interno.erro('prazo_vencido'); end if;
  if exists (select 1 from rede_recursos r where r.acao = m.id) then perform interno.erro('recurso_ja_feito'); end if;
  perform interno.rede2_limite('denunciar');
  insert into rede_recursos (acao, autor, texto) values (m.id, v, v_texto);
  insert into avisos (para, texto)
  select distinct p.usuario, 'Há um recurso novo na fila de moderação da Rede.' from papeis p where p.papel in ('coordenacao', 'vice', 'mediacao') and p.usuario is distinct from m.quem;
  return jsonb_build_object('ok', true);
end $$;

/** A fila de recursos abertos que cabem a quem chama. 'minha' = a decisão foi dela: esta pessoa não pode rever (outra pessoa revê). */
create or replace function public.rede_mod_recursos() returns jsonb language plpgsql stable security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu();
begin
  return coalesce((select jsonb_agg(jsonb_build_object(
      'id', r.id, 'texto', r.texto, 'criado_em', r.criado_em, 'situacao', r.situacao,
      'acao', jsonb_build_object('id', m.id, 'acao', m.acao, 'alvo_tipo', m.alvo_tipo, 'alvo', m.alvo, 'regra', m.regra, 'motivo', m.motivo, 'criado_em', m.criado_em),
      'minha', m.quem = v) order by r.criado_em)
    from rede_recursos r join rede_moderacao m on m.id = r.acao
    where r.situacao = 'aberto'
      and (case when m.alvo_tipo = 'post' then exists (select 1 from rede_posts p where p.id::text = m.alvo and interno.rede3_mod_pode_post(p, true))
                else interno.cuida() end)), '[]'::jsonb);
end $$;

/**
 * Rever um recurso: 'mantido' ou 'revertido', sempre com o motivo. Quem decidiu a ação contestada não revê (o gatilho do banco também
 * barra). Revertido desfaz o efeito (post volta, trava sai, banimento sai) e avisa a pessoa; a decisão final fica no registro.
 */
create or replace function public.rede_mod_rever(p_recurso uuid, p_decisao text, p_motivo text) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); r rede_recursos; m rede_moderacao; v_motivo text := interno.txt(p_motivo, 'motivo', 3, 1000); v_com text; v_afetado uuid;
begin
  if p_decisao is null or p_decisao not in ('mantido', 'revertido') then perform interno.erro('invalido:decisao'); end if;
  select * into r from rede_recursos where id = p_recurso;
  if not found or r.situacao <> 'aberto' then perform interno.erro('nao_encontrado'); end if;
  select * into m from rede_moderacao where id = r.acao;
  if m.alvo_tipo = 'post' then
    if not exists (select 1 from rede_posts p where p.id::text = m.alvo and interno.rede3_mod_pode_post(p, true)) then perform interno.erro('sem_permissao'); end if;
  elsif not interno.cuida() then
    perform interno.erro('sem_permissao');
  end if;
  if m.quem is not distinct from v then perform interno.erro('outra_pessoa'); end if;
  update rede_recursos set situacao = p_decisao, revisou = v, decidido_em = now() where id = r.id;
  perform interno.rede3_mod_registrar(case p_decisao when 'mantido' then 'recurso_mantido' else 'recurso_revertido' end, m.alvo_tipo, m.alvo, m.regra, v_motivo, null);
  if p_decisao = 'revertido' then
    if m.alvo_tipo = 'post' then
      if m.acao in ('remover', 'reter') then update rede_posts set oculto = false, retido = false, motivo = '', avaliacao = 'revista' where id::text = m.alvo;
      elsif m.acao = 'travar' then update rede_posts set travado = false where id::text = m.alvo; end if;
    elsif m.alvo_tipo = 'perfil' and m.acao = 'banir' then
      v_com := substring(m.motivo from '^comunidade ([a-z0-9-]+):');
      if v_com is not null then delete from rede_comunidade_membros where comunidade = v_com and usuario::text = m.alvo and situacao = 'banido'; end if;
    end if;
  end if;
  v_afetado := r.autor;
  perform interno.avisar_em(v_afetado, left(case p_decisao
    when 'revertido' then 'Seu recurso foi aceito: a decisão foi desfeita. ' || v_motivo
    else 'Seu recurso foi analisado por outra pessoa da moderação e a decisão foi mantida. ' || v_motivo end, 500), 'rede');
  return jsonb_build_object('situacao', p_decisao);
end $$;

-- ── 8. Silenciar (no servidor; a opção "só neste aparelho" é do cliente) ────────────────────────────────────────────────

/**
 * Silenciar uma pessoa (@handle), uma conversa (id de um post dela), uma comunidade (slug) ou uma palavra. A linha, o contador de
 * novos e a busca já respeitam (interno.rede_silenciado). Ninguém é avisado. p_dias opcional (1 a 365); sem ele, até desfazer.
 */
create or replace function public.rede_mod_silenciar(p_tipo text, p_alvo text, p_dias integer default null) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); f perfis; x rede_posts; v_id uuid; v_ate timestamptz; v_pessoa uuid; v_com text; v_palavra text; v_conversa uuid;
begin
  if p_tipo is null or p_tipo not in ('pessoa', 'conversa', 'comunidade', 'palavra') then perform interno.erro('invalido:tipo'); end if;
  if p_dias is not null and (p_dias < 1 or p_dias > 365) then perform interno.erro('invalido:dias'); end if;
  v_ate := case when p_dias is not null then now() + make_interval(days => p_dias) end;
  perform interno.rede2_limite('salvar');
  if (select count(*) from rede_silenciados where usuario = v) >= 200 then perform interno.erro('muitos_silenciados'); end if;
  if p_tipo = 'pessoa' then
    select * into f from perfis where rede_handle = lower(btrim(coalesce(p_alvo, ''), ' @'));
    if not found or f.id = v or (f.rede_modo = 'invisivel' or f.rede_invisivel) then perform interno.erro('nao_encontrado'); end if;
    v_pessoa := f.id;
  elsif p_tipo = 'conversa' then
    begin select * into x from rede_posts where id = p_alvo::uuid; exception when others then perform interno.erro('invalido:alvo'); end;
    if not found or not interno.rede_ve(x, v) then perform interno.erro('nao_encontrado'); end if;
    v_conversa := coalesce(x.root_id, x.id);
  elsif p_tipo = 'comunidade' then
    select slug into v_com from rede_comunidades where slug = coalesce(p_alvo, '') or coalesce(p_alvo, '') = any (apelidos) order by (slug = coalesce(p_alvo, '')) desc limit 1;
    if v_com is null then perform interno.erro('nao_encontrado'); end if;
  else
    v_palavra := lower(btrim(coalesce(p_alvo, '')));
    if char_length(v_palavra) < 2 or char_length(v_palavra) > 60 then perform interno.erro('invalido:palavra'); end if;
  end if;
  select id into v_id from rede_silenciados s where s.usuario = v and s.pessoa is not distinct from v_pessoa and s.comunidade is not distinct from v_com and s.palavra is not distinct from v_palavra and s.conversa is not distinct from v_conversa;
  if v_id is null then
    insert into rede_silenciados (usuario, pessoa, comunidade, palavra, conversa, ate) values (v, v_pessoa, v_com, v_palavra, v_conversa, v_ate) returning id into v_id;
  else
    update rede_silenciados set ate = v_ate where id = v_id;
  end if;
  return jsonb_build_object('id', v_id);
end $$;

/** Deixa de silenciar. Só mexe no que é da própria pessoa. */
create or replace function public.rede_mod_silenciar_remover(p_id uuid) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu();
begin
  delete from rede_silenciados where id = p_id and usuario = v;
  return jsonb_build_object('ok', found);
end $$;

/** O que EU silenciei (pessoa com @handle e codinome; conversa com o título; comunidade; palavra). */
create or replace function public.rede_mod_silenciados() returns jsonb language plpgsql stable security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu();
begin
  return coalesce((select jsonb_agg(jsonb_build_object(
      'id', s.id,
      'tipo', case when s.pessoa is not null then 'pessoa' when s.conversa is not null then 'conversa' when s.comunidade is not null then 'comunidade' else 'palavra' end,
      'rotulo', coalesce(case when s.pessoa is not null then (select '@' || coalesce(f.rede_handle, f.rede_codinome) from perfis f where f.id = s.pessoa) end,
                         case when s.conversa is not null then (select left(coalesce(p.titulo, p.texto), 80) from rede_posts p where p.id = s.conversa and interno.rede_ve(p, v)) end,
                         s.comunidade, s.palavra, ''),
      'ate', s.ate, 'criado_em', s.criado_em) order by s.criado_em desc)
    from rede_silenciados s where s.usuario = v and (s.ate is null or s.ate > now())), '[]'::jsonb);
end $$;

-- ── 9. Modo lento e trava ─────────────────────────────────────────────────────────────────────────────────────────────────

/** Liga o modo lento (p_segundos de 5 a 86400) ou desliga (0), numa comunidade (slug) ou numa conversa (id de um post dela). Fica no registro. */
create or replace function public.rede_mod_modo_lento(p_tipo text, p_alvo text, p_segundos integer, p_motivo text default '') returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); x rede_posts; v_chave text; v_motivo text;
begin
  if p_tipo is null or p_tipo not in ('comunidade', 'conversa') then perform interno.erro('invalido:tipo'); end if;
  if p_segundos is null or p_segundos < 0 or (p_segundos > 0 and (p_segundos < 5 or p_segundos > 86400)) then perform interno.erro('invalido:segundos'); end if;
  if p_tipo = 'comunidade' then
    if not exists (select 1 from rede_comunidades where slug = coalesce(p_alvo, '')) then perform interno.erro('nao_encontrado'); end if;
    if not interno.rede3_mod_modera(p_alvo, null) then perform interno.erro('sem_permissao'); end if;
    v_chave := p_alvo;
  else
    begin select * into x from rede_posts where id = p_alvo::uuid; exception when others then perform interno.erro('invalido:alvo'); end;
    if not found or not interno.rede3_mod_pode_post(x, false) then perform interno.erro('nao_encontrado'); end if;
    v_chave := coalesce(x.root_id, x.id)::text;
  end if;
  v_motivo := coalesce(nullif(btrim(coalesce(p_motivo, '')), ''), case when p_segundos = 0 then 'Modo lento desligado.' else 'Modo lento: um post a cada ' || p_segundos || ' segundos.' end);
  if p_segundos = 0 then delete from rede_lento where alvo_tipo = p_tipo and alvo = v_chave;
  else insert into rede_lento (alvo_tipo, alvo, segundos, quem) values (p_tipo, v_chave, p_segundos, v)
       on conflict (alvo_tipo, alvo) do update set segundos = excluded.segundos, quem = excluded.quem, desde = now(); end if;
  perform interno.rede3_mod_registrar('modo_lento', case when p_tipo = 'comunidade' then 'comunidade' else 'post' end, v_chave, 'modo_lento', v_motivo, null);
  return jsonb_build_object('segundos', p_segundos);
end $$;

/** O modo lento de um lugar, para a tela avisar antes de a pessoa escrever. 0 = desligado. Conversa que a pessoa não pode ver: 0. */
create or replace function public.rede_mod_lento_de(p_tipo text, p_alvo text) returns integer language plpgsql stable security definer set search_path = interno, pg_temp as $$
declare v uuid := auth.uid(); x rede_posts; c rede_comunidades;
begin
  if p_tipo = 'comunidade' then
    select * into c from rede_comunidades where slug = coalesce(p_alvo, '');
    if not found or (c.tipo = 'fechada' and not interno.rede2_na_comunidade(c.slug, v)) then return 0; end if;
    return coalesce((select segundos from rede_lento where alvo_tipo = 'comunidade' and alvo = c.slug), 0);
  elsif p_tipo = 'conversa' then
    begin select * into x from rede_posts where id = p_alvo::uuid; exception when others then return 0; end;
    if not found or not interno.rede_ve(x, v) then return 0; end if;
    return coalesce((select segundos from rede_lento where alvo_tipo = 'conversa' and alvo = coalesce(x.root_id, x.id)::text), 0);
  end if;
  return 0;
end $$;

-- ── 10. Listas de bloqueio da mediação (comunidade e núcleo) ─────────────────────────────────────────────────────────────

create or replace function interno.rede3_mod_modera_escopo(p_tipo text, p_escopo text) returns boolean language plpgsql stable security definer set search_path = interno, pg_temp as $$
declare v_nucleo uuid;
begin
  if p_tipo = 'comunidade' then return interno.rede3_mod_modera(p_escopo, null); end if;
  if p_tipo = 'nucleo' then
    begin v_nucleo := p_escopo::uuid; exception when others then return false; end;
    return auth.uid() is not null and exists (select 1 from rede_nucleo_membros n where n.nucleo = v_nucleo and n.usuario = auth.uid() and n.papel = 'mediacao');
  end if;
  return false;
end $$;

/** A lista de bloqueio de uma comunidade ou núcleo: só para quem a mantém (mediação). */
create or replace function public.rede_mod_lista(p_escopo_tipo text, p_escopo text) returns jsonb language plpgsql stable security definer set search_path = interno, pg_temp as $$
begin
  perform interno.eu();
  if not interno.rede3_mod_modera_escopo(p_escopo_tipo, p_escopo) then perform interno.erro('sem_permissao'); end if;
  return coalesce((select jsonb_agg(jsonb_build_object('id', l.id, 'tipo', l.tipo, 'palavra', l.palavra,
      'pessoa', case when l.pessoa is not null then (select coalesce('@' || f.rede_handle, f.rede_codinome) from perfis f where f.id = l.pessoa) end,
      'motivo', l.motivo, 'criado_em', l.criado_em) order by l.criado_em desc)
    from rede_bloqueio_lista l where l.escopo_tipo = p_escopo_tipo and l.escopo = p_escopo), '[]'::jsonb);
end $$;

/** Põe uma palavra ou uma pessoa (@handle) na lista. Palavra: o post fica retido para leitura. Pessoa: não escreve ali. Nunca vale para a equipe. */
create or replace function public.rede_mod_lista_adicionar(p_escopo_tipo text, p_escopo text, p_tipo text, p_valor text, p_motivo text default '') returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); f perfis; v_id uuid; v_palavra text; v_motivo text := interno.txt(coalesce(p_motivo, ''), 'motivo', 0, 300);
begin
  if p_tipo is null or p_tipo not in ('palavra', 'pessoa') then perform interno.erro('invalido:tipo'); end if;
  if not interno.rede3_mod_modera_escopo(p_escopo_tipo, p_escopo) then perform interno.erro('sem_permissao'); end if;
  perform interno.limite('rede3_lista', 200, 60);
  if (select count(*) from rede_bloqueio_lista where escopo_tipo = p_escopo_tipo and escopo = p_escopo) >= 300 then perform interno.erro('lista_cheia'); end if;
  if p_tipo = 'palavra' then
    v_palavra := lower(btrim(coalesce(p_valor, '')));
    if char_length(v_palavra) < 2 or char_length(v_palavra) > 60 then perform interno.erro('invalido:palavra'); end if;
    insert into rede_bloqueio_lista (escopo_tipo, escopo, tipo, palavra, motivo, quem) values (p_escopo_tipo, p_escopo, 'palavra', v_palavra, v_motivo, v) returning id into v_id;
  else
    select * into f from perfis where rede_handle = lower(btrim(coalesce(p_valor, ''), ' @'));
    if not found then perform interno.erro('nao_encontrado'); end if;
    if f.id = v or interno.voluntario_e(f.id) then perform interno.erro('sem_permissao'); end if;
    insert into rede_bloqueio_lista (escopo_tipo, escopo, tipo, pessoa, motivo, quem) values (p_escopo_tipo, p_escopo, 'pessoa', f.id, v_motivo, v) returning id into v_id;
  end if;
  perform interno.rede3_mod_registrar('lista_adicionar', p_escopo_tipo, p_escopo, 'lista_da_mediacao', 'Entrou na lista de bloqueio (' || p_tipo || ').', null);
  return jsonb_build_object('id', v_id);
end $$;

create or replace function public.rede_mod_lista_remover(p_id uuid) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare l rede_bloqueio_lista;
begin
  perform interno.eu();
  select * into l from rede_bloqueio_lista where id = p_id;
  if not found or not interno.rede3_mod_modera_escopo(l.escopo_tipo, l.escopo) then perform interno.erro('nao_encontrado'); end if;
  delete from rede_bloqueio_lista where id = p_id;
  perform interno.rede3_mod_registrar('lista_remover', l.escopo_tipo, l.escopo, 'lista_da_mediacao', 'Saiu da lista de bloqueio (' || l.tipo || ').', null);
  return jsonb_build_object('ok', true);
end $$;

-- ── 11. Rótulo de desinformação, ligado à Checagem ───────────────────────────────────────────────────────────────────────

/**
 * Liga um post a uma checagem que já existe em /checagens (p_checagem = o slug do arquivo; o veredito e o título vêm da própria
 * checagem, escolhida na tela). O post NÃO é apagado nem escondido: ganha um rótulo com o link. Só quem modera o lugar do post. Fica no registro.
 */
create or replace function public.rede_mod_rotular(p_post uuid, p_checagem text, p_veredito text, p_titulo text default '') returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); x rede_posts;
begin
  if coalesce(p_checagem, '') !~ '^[a-z0-9-]{2,120}$' then perform interno.erro('invalido:checagem'); end if;
  select * into x from rede_posts where id = p_post;
  if not found or not interno.rede3_mod_pode_post(x, false) then perform interno.erro('nao_encontrado'); end if;
  insert into rede_rotulos (post, checagem, veredito, titulo, quem)
  values (x.id, p_checagem, interno.txt(p_veredito, 'veredito', 2, 40), left(btrim(coalesce(p_titulo, '')), 200), v)
  on conflict (post) do update set checagem = excluded.checagem, veredito = excluded.veredito, titulo = excluded.titulo, quem = excluded.quem, criado_em = now();
  perform interno.rede3_mod_registrar('rotular', 'post', x.id::text, 'checagem', 'Ligado à checagem ' || p_checagem || ' (' || left(p_veredito, 40) || ').', null);
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.rede_mod_desrotular(p_post uuid, p_motivo text default '') returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare x rede_posts;
begin
  perform interno.eu();
  select * into x from rede_posts where id = p_post;
  if not found or not interno.rede3_mod_pode_post(x, false) then perform interno.erro('nao_encontrado'); end if;
  delete from rede_rotulos where post = x.id;
  perform interno.rede3_mod_registrar('desrotular', 'post', x.id::text, 'checagem', coalesce(nullif(btrim(coalesce(p_motivo, '')), ''), 'Rótulo retirado.'), null);
  return jsonb_build_object('ok', true);
end $$;

/**
 * Os rótulos de uma leva de posts (até 60), para o cliente juntar ao cartão sem uma chamada por post. Cada id passa por interno.rede_ve:
 * o que a pessoa não pode ver nem aparece. Devolve só os posts que têm rótulo: {id: {rotulo: {checagem, veredito, titulo}}}.
 */
create or replace function public.rede_mod_detalhes(p_ids uuid[]) returns jsonb language plpgsql stable security definer set search_path = interno, pg_temp as $$
declare v uuid := auth.uid();
begin
  return coalesce((select jsonb_object_agg(p.id::text, jsonb_build_object('rotulo', jsonb_build_object('checagem', r.checagem, 'veredito', r.veredito, 'titulo', r.titulo)))
    from rede_posts p join rede_rotulos r on r.post = p.id
    where p.id = any ((select coalesce(array_agg(i), '{}') from (select i from unnest(coalesce(p_ids, '{}')) i limit 60) z)::uuid[])
      and interno.rede_ve(p, v)), '{}'::jsonb);
end $$;

-- ── 12. Permissões ───────────────────────────────────────────────────────────────────────────────────────────────────────
-- Nenhuma função interna é chamável de fora. Públicas de leitura aberta: níveis, modo lento, rótulos (a matriz decide). O resto, só com conta.
revoke all on function
  interno.rede3_mod_modera(text, uuid), interno.rede3_mod_pode_post(interno.rede_posts, boolean), interno.rede3_mod_pode_denuncia(interno.rede_denuncias),
  interno.rede3_mod_registrar(text, text, text, text, text, uuid, boolean), interno.rede3_mod_procedentes(uuid, integer), interno.rede3_mod_dados(uuid),
  interno.rede3_mod_nivel(uuid), interno.rede3_mod_categoria(text), interno.rede3_mod_avisar_afetado(uuid, text), interno.rede3_mod_antes_de_postar(),
  interno.rede3_mod_antes_da_midia(), interno.rede3_mod_ponte_denuncia(), interno.rede3_mod_item(interno.rede_denuncias), interno.rede3_mod_modera_escopo(text, text)
  from public;
revoke all on function
  public.rede_mod_niveis(), public.rede_mod_meu_nivel(), public.rede_mod_lider(text, boolean), public.rede_mod_escopo(),
  public.rede_mod_denunciar(text, text, text, text), public.rede_mod_minhas_denuncias(), public.rede_mod_fila(text), public.rede_mod_abrir(uuid),
  public.rede_mod_retidos(), public.rede_mod_agir(uuid, text, text, text, text, text, text), public.rede_mod_denuncia_situacao(uuid, text, text),
  public.rede_mod_minhas_decisoes(), public.rede_mod_recorrer(uuid, text), public.rede_mod_recursos(), public.rede_mod_rever(uuid, text, text),
  public.rede_mod_silenciar(text, text, integer), public.rede_mod_silenciar_remover(uuid), public.rede_mod_silenciados(),
  public.rede_mod_modo_lento(text, text, integer, text), public.rede_mod_lento_de(text, text), public.rede_mod_lista(text, text),
  public.rede_mod_lista_adicionar(text, text, text, text, text), public.rede_mod_lista_remover(uuid), public.rede_mod_rotular(uuid, text, text, text),
  public.rede_mod_desrotular(uuid, text), public.rede_mod_detalhes(uuid[])
  from public;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on function
      interno.rede3_mod_modera(text, uuid), interno.rede3_mod_pode_post(interno.rede_posts, boolean), interno.rede3_mod_pode_denuncia(interno.rede_denuncias),
      interno.rede3_mod_registrar(text, text, text, text, text, uuid, boolean), interno.rede3_mod_procedentes(uuid, integer), interno.rede3_mod_dados(uuid),
      interno.rede3_mod_nivel(uuid), interno.rede3_mod_categoria(text), interno.rede3_mod_avisar_afetado(uuid, text), interno.rede3_mod_antes_de_postar(),
      interno.rede3_mod_antes_da_midia(), interno.rede3_mod_ponte_denuncia(), interno.rede3_mod_item(interno.rede_denuncias), interno.rede3_mod_modera_escopo(text, text)
      from anon, authenticated;
    revoke all on function
      public.rede_mod_niveis(), public.rede_mod_meu_nivel(), public.rede_mod_lider(text, boolean), public.rede_mod_escopo(),
      public.rede_mod_denunciar(text, text, text, text), public.rede_mod_minhas_denuncias(), public.rede_mod_fila(text), public.rede_mod_abrir(uuid),
      public.rede_mod_retidos(), public.rede_mod_agir(uuid, text, text, text, text, text, text), public.rede_mod_denuncia_situacao(uuid, text, text),
      public.rede_mod_minhas_decisoes(), public.rede_mod_recorrer(uuid, text), public.rede_mod_recursos(), public.rede_mod_rever(uuid, text, text),
      public.rede_mod_silenciar(text, text, integer), public.rede_mod_silenciar_remover(uuid), public.rede_mod_silenciados(),
      public.rede_mod_modo_lento(text, text, integer, text), public.rede_mod_lento_de(text, text), public.rede_mod_lista(text, text),
      public.rede_mod_lista_adicionar(text, text, text, text, text), public.rede_mod_lista_remover(uuid), public.rede_mod_rotular(uuid, text, text, text),
      public.rede_mod_desrotular(uuid, text), public.rede_mod_detalhes(uuid[])
      from anon, authenticated;
    -- Leitura: com ou sem conta.
    grant execute on function public.rede_mod_niveis(), public.rede_mod_lento_de(text, text), public.rede_mod_detalhes(uuid[]) to anon, authenticated, service_role;
    -- Tudo o mais: só com conta (a função confere a sessão e o papel).
    grant execute on function
      public.rede_mod_meu_nivel(), public.rede_mod_lider(text, boolean), public.rede_mod_escopo(),
      public.rede_mod_denunciar(text, text, text, text), public.rede_mod_minhas_denuncias(), public.rede_mod_fila(text), public.rede_mod_abrir(uuid),
      public.rede_mod_retidos(), public.rede_mod_agir(uuid, text, text, text, text, text, text), public.rede_mod_denuncia_situacao(uuid, text, text),
      public.rede_mod_minhas_decisoes(), public.rede_mod_recorrer(uuid, text), public.rede_mod_recursos(), public.rede_mod_rever(uuid, text, text),
      public.rede_mod_silenciar(text, text, integer), public.rede_mod_silenciar_remover(uuid), public.rede_mod_silenciados(),
      public.rede_mod_modo_lento(text, text, integer, text), public.rede_mod_lista(text, text),
      public.rede_mod_lista_adicionar(text, text, text, text, text), public.rede_mod_lista_remover(uuid), public.rede_mod_rotular(uuid, text, text, text),
      public.rede_mod_desrotular(uuid, text)
      to authenticated, service_role;
  end if;
end $$;
