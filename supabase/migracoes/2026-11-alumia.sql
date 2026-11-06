-- ───────────────────────────── Alumia: nome, Salvos e federação (Fediverso / ActivityPub) ─────────────────────────────
-- Migração acrescentável: pode rodar mais de uma vez, sem apagar dado nenhum. O mesmo bloco está no fim do install.sql. Roda
-- DEPOIS das migrações da Rede v2 (2026-11-rede-*.sql). Documentos: docs/rede/FEDIVERSO.md, docs/rede/ALUMIA-DOMINIO.md, docs/rede/V2.md.
--
-- 1. Nome: a rede passa a se chamar Alumia nos textos que o banco escreve (avisos, e-mails do resumo semanal). As funções que
--    escreviam "Rede Lúcia" são recriadas com "Alumia" no lugar; os padrões que reconhecem avisos antigos aceitam os dois nomes.
-- 2. Salvos: public.rede_alumia_salvos lista o que a pessoa guardou (só o que ela ainda pode ver, pela mesma matriz de sempre).
-- 3. Fediverso: federação opcional e desligada por padrão. Só sai o que qualquer pessoa já lê sem conta (interno.rede_ve(p, null)),
--    de quem ligou a federação no próprio perfil (consentimento específico e destacado, com versão e data: LGPD art. 7º, I, e
--    art. 8º; revogável a qualquer momento, art. 8º, § 5º), e só posts escritos depois de ligar. Núcleo, comunidade fechada ou
--    restrita, alcance "membros", "seguidores", "comunidade", "equipe" e aviso do instituto nunca saem. As chaves privadas ficam
--    em interno.rede_fed_atores, cifradas pelo servidor do site (o banco nunca vê a chave aberta). As funções do servidor só
--    respondem a quem traz o segredo da federação (o hash fica em interno.configuracoes, chave 'fediverso').
--
-- Para ligar (passo a passo em docs/rede/FEDIVERSO.md):
--   insert into interno.configuracoes (chave, valor) values ('fediverso', jsonb_build_object(
--     'segredo_hash', encode(sha256(convert_to('<o mesmo valor de ALUMIA_FEDIVERSO_SEGREDO>', 'UTF8')), 'hex'),
--     'url_entrega', 'https://alumia.institutolucia.org/api/fediverso/entregar'))
--   on conflict (chave) do update set valor = excluded.valor;

-- ── 1. O nome: Alumia ───────────────────────────────────────────────────────────────────────────────────────────────────
-- Recria, com o nome novo, toda função dos esquemas interno e public que escrevia "Rede Lúcia" num texto (avisos e e-mails).
-- Primeiro os dois padrões que reconhecem avisos já gravados passam a aceitar os dois nomes (sem isso, um aviso antigo deixaria
-- de ser reconhecido e mostraria o trecho do post); depois o resto do texto troca de nome. Roda de novo sem efeito: o padrão
-- novo é escrito "Rede L[úu]cia", que não contém mais o nome antigo.
do $$
declare
  f record;
  v_def text;
begin
  for f in
    select p.oid from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname in ('interno', 'public') and p.prokind = 'f' and p.prosrc like '%Rede Lúcia%'
  loop
    v_def := pg_get_functiondef(f.oid);
    v_def := replace(v_def, 'respondeu ao seu post na Rede Lúcia: “(.*)”$', 'respondeu ao seu post na (?:Rede L[úu]cia|Alumia): “(.*)”$');
    v_def := replace(v_def, ' respondeu ao seu post na Rede Lúcia: “''', ' respondeu ao seu post na (?:Rede L[úu]cia|Alumia): “''');
    v_def := replace(v_def, 'Rede Lúcia', 'Alumia');
    execute v_def;
  end loop;
end $$;

-- ── 2. Salvos ───────────────────────────────────────────────────────────────────────────────────────────────────────────

/** O que a pessoa guardou para ler depois, do mais novo para o mais antigo. Cursor = "<quando salvou>|<post>". Só o que ela ainda vê. */
create or replace function public.rede_alumia_salvos(p_cursor text default null, p_limite integer default 20) returns jsonb
language plpgsql volatile security definer set search_path = interno, pg_temp as $$
declare
  v uuid := interno.eu();
  v_limite integer := least(greatest(coalesce(p_limite, 20), 1), 50);
  v_t timestamptz; v_id uuid;
  v_itens jsonb := '[]'::jsonb; v_proximo text; v_n integer := 0;
  r record;
begin
  perform interno.aberta('comunidade');
  perform interno.limite('rede2_ler', 600, 60);
  if nullif(p_cursor, '') is not null then
    begin
      v_t := split_part(p_cursor, '|', 1)::timestamptz;
      v_id := split_part(p_cursor, '|', 2)::uuid;
    exception when others then
      perform interno.erro('invalido:cursor');
    end;
  end if;
  for r in
    select s.criado_em as salvo_em, p.* from rede_salvos s join rede_posts p on p.id = s.post
    where s.usuario = v and (v_t is null or (s.criado_em, s.post) < (v_t, v_id)) and interno.rede_ve(p, v)
    order by s.criado_em desc, s.post desc
    limit v_limite + 1
  loop
    v_n := v_n + 1;
    if v_n > v_limite then exit; end if;
    v_itens := v_itens || jsonb_build_array(interno.rede_post_v2((select x from rede_posts x where x.id = r.id), v));
    v_proximo := r.salvo_em::text || '|' || r.id::text;
  end loop;
  return jsonb_build_object('itens', v_itens, 'proximo', case when v_n > v_limite then v_proximo end);
end $$;

-- ── 3. Fediverso: tabelas ───────────────────────────────────────────────────────────────────────────────────────────────

-- Quem ligou a federação. A chave privada vem CIFRADA pelo servidor do site (AES-256-GCM, chave derivada de ALUMIA_FEDIVERSO_SEGREDO).
-- Sem chave estrangeira para interno.perfis DE PROPÓSITO (como a fila, abaixo): quem apaga a conta com a federação ligada precisa
-- que os pedidos de apagar (Delete, Reject, Undo) ainda saiam assinados depois que o perfil sumiu (interno.rede_fed_conta_apagada);
-- a faxina (interno.rede_fed_limpar) apaga a linha e as chaves assim que a fila dessa pessoa esvazia (LGPD art. 18, VI).
create table if not exists interno.rede_fed_atores (
  perfil uuid primary key,
  handle text not null check (handle ~ '^[a-z0-9_]{3,20}$'),
  ligado boolean not null default false,
  consentimento_versao integer,
  ligado_em timestamptz,
  desligado_em timestamptz,
  chave_publica text check (chave_publica is null or char_length(chave_publica) <= 2000),
  chave_privada text check (chave_privada is null or char_length(chave_privada) <= 6000),
  criado_em timestamptz not null default now()
);
create unique index if not exists rede_fed_atores_handle on interno.rede_fed_atores (handle) where ligado;

-- Quem segue, de outra instância, uma pessoa daqui (só o endereço público do ator remoto e da caixa de entrada dele).
create table if not exists interno.rede_fed_seguidores (
  perfil uuid not null references interno.perfis (id) on delete cascade,
  ator text not null check (ator ~ '^https://' and char_length(ator) <= 500),
  inbox text not null check (inbox ~ '^https://' and char_length(inbox) <= 500),
  inbox_compartilhada text check (inbox_compartilhada is null or (inbox_compartilhada ~ '^https://' and char_length(inbox_compartilhada) <= 500)),
  pedido text not null default '' check (char_length(pedido) <= 500),
  criado_em timestamptz not null default now(),
  primary key (perfil, ator)
);

-- Quem uma pessoa daqui segue em outra instância (pedido = id da atividade Follow; aceito quando chega o Accept).
create table if not exists interno.rede_fed_seguindo (
  perfil uuid not null references interno.perfis (id) on delete cascade,
  ator text not null check (ator ~ '^https://' and char_length(ator) <= 500),
  pedido text not null check (char_length(pedido) <= 500),
  aceito boolean not null default false,
  criado_em timestamptz not null default now(),
  primary key (perfil, ator)
);

-- O que já se sabe de um ator remoto (público: chave, caixas, @nome). Serve para conferir assinaturas sem buscar toda vez.
create table if not exists interno.rede_fed_remotos (
  ator text primary key check (ator ~ '^https://' and char_length(ator) <= 500),
  chave_id text check (chave_id is null or char_length(chave_id) <= 600),
  chave_publica text check (chave_publica is null or char_length(chave_publica) <= 4000),
  inbox text check (inbox is null or char_length(inbox) <= 500),
  inbox_compartilhada text check (inbox_compartilhada is null or char_length(inbox_compartilhada) <= 500),
  handle text check (handle is null or char_length(handle) <= 200),
  nome text check (nome is null or char_length(nome) <= 200),
  resumo text check (resumo is null or char_length(resumo) <= 1000),
  url text check (url is null or char_length(url) <= 500),
  buscado_em timestamptz not null default now()
);

-- A fila de entrega (uma linha por atividade e caixa de destino). O servidor do site monta e assina na hora de entregar,
-- conferindo de novo se o post ainda pode sair.
create table if not exists interno.rede_fed_fila (
  id bigserial primary key,
  perfil uuid not null,
  tipo text not null check (tipo in ('create', 'update', 'delete', 'accept', 'reject', 'follow', 'undo-follow')),
  objeto text not null check (char_length(objeto) <= 500),
  destino text not null check (destino ~ '^https://' and char_length(destino) <= 500),
  extra jsonb not null default '{}'::jsonb,
  tentativas smallint not null default 0,
  proxima timestamptz not null default now(),
  criado_em timestamptz not null default now(),
  feito_em timestamptz,
  erro text not null default '' check (char_length(erro) <= 300)
);
create index if not exists rede_fed_fila_pendentes on interno.rede_fed_fila (proxima) where feito_em is null;

-- Os posts que já saíram (para mandar "Update" quando editados e "Delete" quando apagados, ocultados ou fechados).
create table if not exists interno.rede_fed_enviados (
  post uuid primary key,
  perfil uuid not null references interno.perfis (id) on delete cascade,
  enviado_em timestamptz not null default now(),
  apagado_em timestamptz
);

-- Posts públicos de quem alguém daqui segue em outra instância: só texto (sem HTML, sem imagem), guardados 30 dias.
create table if not exists interno.rede_fed_recebidos (
  id text primary key check (id ~ '^https://' and char_length(id) <= 500),
  ator text not null check (char_length(ator) <= 500),
  url text check (url is null or char_length(url) <= 500),
  texto text not null check (char_length(texto) <= 3000),
  aviso text not null default '' check (char_length(aviso) <= 200),
  publicado timestamptz,
  recebido_em timestamptz not null default now()
);
create index if not exists rede_fed_recebidos_ator on interno.rede_fed_recebidos (ator, publicado desc);

-- Instâncias que a mediação bloqueou (desfederação): nada entra delas e nada sai para elas.
create table if not exists interno.rede_fed_bloqueados (
  dominio text primary key check (dominio ~ '^[a-z0-9.-]{3,253}$'),
  motivo text not null default '' check (char_length(motivo) <= 300),
  por uuid,
  criado_em timestamptz not null default now()
);

-- Quem rodou uma versão anterior deste bloco tem a chave estrangeira com "on delete cascade" nas duas tabelas: sai aqui.
do $$
declare c record;
begin
  for c in select r.conname, r.conrelid::regclass::text as tabela from pg_constraint r
           where r.contype = 'f' and r.confrelid = 'interno.perfis'::regclass
             and r.conrelid in ('interno.rede_fed_atores'::regclass, 'interno.rede_fed_fila'::regclass) loop
    execute format('alter table %s drop constraint %I', c.tabela, c.conname);
  end loop;
end $$;

alter table interno.rede_fed_atores enable row level security;
alter table interno.rede_fed_seguidores enable row level security;
alter table interno.rede_fed_seguindo enable row level security;
alter table interno.rede_fed_remotos enable row level security;
alter table interno.rede_fed_fila enable row level security;
alter table interno.rede_fed_enviados enable row level security;
alter table interno.rede_fed_recebidos enable row level security;
alter table interno.rede_fed_bloqueados enable row level security;
revoke all on interno.rede_fed_atores, interno.rede_fed_seguidores, interno.rede_fed_seguindo, interno.rede_fed_remotos, interno.rede_fed_fila,
  interno.rede_fed_enviados, interno.rede_fed_recebidos, interno.rede_fed_bloqueados from public;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on interno.rede_fed_atores, interno.rede_fed_seguidores, interno.rede_fed_seguindo, interno.rede_fed_remotos, interno.rede_fed_fila,
      interno.rede_fed_enviados, interno.rede_fed_recebidos, interno.rede_fed_bloqueados from anon, authenticated;
    revoke all on sequence interno.rede_fed_fila_id_seq from anon, authenticated;
  end if;
end $$;

-- ── 4. Fediverso: regras ────────────────────────────────────────────────────────────────────────────────────────────────

/** Versão do texto do consentimento da federação (components/rede/alumia/Fediverso.tsx). Mudou o texto, sobe a versão. */
create or replace function interno.rede_fed_versao() returns integer language sql immutable as $$ select 1 $$;

/** O domínio (minúsculo) de um endereço https. */
create or replace function interno.rede_fed_dominio(p_url text) returns text language sql immutable as $$
  select lower(substring(coalesce(p_url, '') from '^https://([^/:?#]+)'))
$$;

/** A instância deste endereço foi bloqueada pela mediação (ela ou um subdomínio dela)? */
create or replace function interno.rede_fed_bloqueado(p_url text) returns boolean language sql stable security definer set search_path = interno, pg_temp as $$
  select exists (select 1 from rede_fed_bloqueados b, lateral (select interno.rede_fed_dominio(p_url) as d) x
                 where x.d = b.dominio or x.d like '%.' || b.dominio)
$$;

/** Confere o segredo da federação (o servidor do site o manda em toda chamada). Sem a configuração, nada responde. */
create or replace function interno.rede_fed_segredo(p_segredo text) returns void language plpgsql stable security definer set search_path = interno, pg_temp as $$
declare v_hash text := (select valor ->> 'segredo_hash' from configuracoes where chave = 'fediverso');
begin
  if coalesce(v_hash, '') !~ '^[0-9a-f]{64}$' or char_length(coalesce(p_segredo, '')) < 32
     or encode(sha256(convert_to(p_segredo, 'UTF8')), 'hex') <> v_hash then
    perform interno.erro('sem_permissao');
  end if;
end $$;

/** A pessoa pode ligar a federação? Devolve o motivo do "não" ou nulo. */
create or replace function interno.rede_fed_impedimento(p_perfil uuid) returns text language sql stable security definer set search_path = interno, pg_temp as $$
  select case
    when f.id is null then 'entre_primeiro'
    when f.suspenso then 'conta_suspensa'
    when not interno.rede2_membro(f.id) then 'consentimento'
    when f.rede_handle is null then 'sem_handle'
    when f.rede_modo <> 'aberto' or f.rede_invisivel then 'perfil_fechado'
    else null end
  from (select 1) um left join perfis f on f.id = p_perfil
$$;

/**
 * Este post pode sair para o Fediverso? Só o que qualquer pessoa lê sem conta (a mesma matriz de sempre, com visitante), de quem
 * ligou a federação e escrito depois de ligar; nunca núcleo, comunidade fechada ou restrita, equipe, aviso do instituto ou
 * compartilhamento. Resposta só sai se o post respondido também pode sair (a conversa não vaza pela metade).
 */
create or replace function interno.rede_fed_federavel(p interno.rede_posts, p_nivel integer default 0) returns boolean
language plpgsql stable security definer set search_path = interno, pg_temp as $$
declare a rede_fed_atores; pai rede_posts;
begin
  if p.id is null or p.autor is null or p_nivel > 8 then return false; end if;
  select * into a from rede_fed_atores where perfil = p.autor;
  if not found or not a.ligado or a.ligado_em is null or p.criado_em < a.ligado_em then return false; end if;
  if interno.rede_fed_impedimento(p.autor) is not null then return false; end if;
  if (select rede_handle from perfis where id = p.autor) is distinct from a.handle then return false; end if;
  if p.tipo = 'aviso' or p.nucleo is not null or p.repost_de is not null then return false; end if;
  if coalesce(p.publico, 'internet') <> 'internet' then return false; end if;
  if interno.rede2_publico(p) <> 'internet' or not interno.rede_ve(p, null) then return false; end if;
  if p.resposta_a is not null then
    select * into pai from rede_posts where id = p.resposta_a;
    if not found or not interno.rede_fed_federavel(pai, p_nivel + 1) then return false; end if;
  end if;
  return true;
end $$;

/** Põe na fila uma atividade para cada caixa de entrada dos seguidores remotos (a caixa compartilhada da instância, quando há). */
create or replace function interno.rede_fed_espalhar(p_perfil uuid, p_tipo text, p_objeto text) returns integer
language plpgsql security definer set search_path = interno, pg_temp as $$
declare v_n integer;
begin
  insert into rede_fed_fila (perfil, tipo, objeto, destino)
  select distinct p_perfil, p_tipo, p_objeto, coalesce(s.inbox_compartilhada, s.inbox)
  from rede_fed_seguidores s where s.perfil = p_perfil and not interno.rede_fed_bloqueado(s.inbox);
  get diagnostics v_n = row_count;
  return v_n;
end $$;

/** Um post mudou: sai (Create), muda (Update) ou é retirado (Delete) do Fediverso, conforme pode ou não sair agora. */
create or replace function interno.rede_fed_post_mudou() returns trigger language plpgsql security definer set search_path = interno, pg_temp as $$
declare v_p rede_posts; v_fed boolean := false; v_env rede_fed_enviados;
begin
  -- O caminho rápido: ninguém ligou a federação e nada foi enviado. Custa uma consulta a uma tabela quase sempre vazia.
  if not exists (select 1 from rede_fed_atores) then return null; end if;
  if tg_op = 'DELETE' then v_p := old; else v_p := new; v_fed := interno.rede_fed_federavel(new); end if;
  select * into v_env from rede_fed_enviados where post = v_p.id;
  if v_fed and (v_env.post is null or v_env.apagado_em is not null) then
    insert into rede_fed_enviados (post, perfil) values (v_p.id, v_p.autor) on conflict (post) do update set apagado_em = null, enviado_em = now();
    perform interno.rede_fed_espalhar(v_p.autor, 'create', v_p.id::text);
  elsif v_fed and tg_op = 'UPDATE' and (new.texto, coalesce(new.titulo, ''), coalesce(new.corpo, ''), new.aviso) is distinct from (old.texto, coalesce(old.titulo, ''), coalesce(old.corpo, ''), old.aviso) then
    perform interno.rede_fed_espalhar(v_p.autor, 'update', v_p.id::text);
  elsif not v_fed and v_env.post is not null and v_env.apagado_em is null then
    update rede_fed_enviados set apagado_em = now() where post = v_p.id;
    perform interno.rede_fed_espalhar(v_env.perfil, 'delete', v_p.id::text);
  end if;
  return null;
end $$;

drop trigger if exists rede_fed_post on interno.rede_posts;
create trigger rede_fed_post after insert or update or delete on interno.rede_posts for each row execute function interno.rede_fed_post_mudou();

/**
 * Desliga a federação de uma pessoa: retira do Fediverso cada post que saiu (Delete), desfaz quem a seguia de lá (Reject) e o que
 * ela seguia (Undo), e apaga as listas. As chaves ficam até a fila esvaziar (as instâncias conferem a assinatura dessas retiradas).
 */
create or replace function interno.rede_fed_desligar(p_perfil uuid) returns void language plpgsql security definer set search_path = interno, pg_temp as $$
declare e record;
begin
  if not exists (select 1 from rede_fed_atores where perfil = p_perfil and ligado) then return; end if;
  for e in select post from rede_fed_enviados where perfil = p_perfil and apagado_em is null loop
    perform interno.rede_fed_espalhar(p_perfil, 'delete', e.post::text);
  end loop;
  update rede_fed_enviados set apagado_em = now() where perfil = p_perfil and apagado_em is null;
  insert into rede_fed_fila (perfil, tipo, objeto, destino, extra)
  select p_perfil, 'reject', s.ator, s.inbox, jsonb_build_object('pedido', s.pedido) from rede_fed_seguidores s
  where s.perfil = p_perfil and s.pedido <> '' and not interno.rede_fed_bloqueado(s.inbox);
  insert into rede_fed_fila (perfil, tipo, objeto, destino, extra)
  select p_perfil, 'undo-follow', s.ator, coalesce(r.inbox, s.ator), jsonb_build_object('pedido', s.pedido)
  from rede_fed_seguindo s join rede_fed_remotos r on r.ator = s.ator
  where s.perfil = p_perfil and r.inbox is not null and not interno.rede_fed_bloqueado(r.inbox);
  delete from rede_fed_seguidores where perfil = p_perfil;
  delete from rede_fed_seguindo where perfil = p_perfil;
  update rede_fed_atores set ligado = false, desligado_em = now() where perfil = p_perfil;
end $$;

/** A conta mudou de um jeito que fecha a federação (suspensa, perfil trancado ou invisível, @nome trocado, consentimento da rede revogado)? */
create or replace function interno.rede_fed_perfil_mudou() returns trigger language plpgsql security definer set search_path = interno, pg_temp as $$
begin
  if not exists (select 1 from rede_fed_atores where perfil = new.id and ligado) then return null; end if;
  if interno.rede_fed_impedimento(new.id) is not null or new.rede_handle is distinct from (select handle from rede_fed_atores where perfil = new.id) then
    perform interno.rede_fed_desligar(new.id);
  end if;
  return null;
end $$;

drop trigger if exists rede_fed_perfil on interno.perfis;
create trigger rede_fed_perfil after update of suspenso, rede_modo, rede_invisivel, rede_handle, rede_18, rede_consentimento on interno.perfis
  for each row execute function interno.rede_fed_perfil_mudou();

-- A revogação do consentimento da rede (rede_consentimentos.revogado_em) também desliga a federação.
create or replace function interno.rede_fed_consentimento_mudou() returns trigger language plpgsql security definer set search_path = interno, pg_temp as $$
begin
  if exists (select 1 from rede_fed_atores where perfil = new.usuario and ligado) and interno.rede_fed_impedimento(new.usuario) is not null then
    perform interno.rede_fed_desligar(new.usuario);
  end if;
  return null;
end $$;

drop trigger if exists rede_fed_consentimento on interno.rede_consentimentos;
create trigger rede_fed_consentimento after update on interno.rede_consentimentos for each row execute function interno.rede_fed_consentimento_mudou();

/**
 * A conta vai ser apagada (LGPD art. 18, VI): antes de o perfil sumir, a federação se desliga como num "desligar" normal (Delete de
 * cada post que saiu, Reject para quem seguia de fora, Undo do que ela seguia). A linha do ator e a fila não dependem do perfil,
 * então essas retiradas ainda saem assinadas; sem nada na fila, a linha sai já. O resto some com a faxina (rede_fed_limpar).
 */
create or replace function interno.rede_fed_conta_apagada() returns trigger language plpgsql security definer set search_path = interno, pg_temp as $$
begin
  if not exists (select 1 from rede_fed_atores where perfil = old.id) then return old; end if;
  perform interno.rede_fed_desligar(old.id);
  delete from rede_fed_atores a where a.perfil = old.id
    and not exists (select 1 from rede_fed_fila q where q.perfil = old.id and q.feito_em is null);
  return old;
end $$;

drop trigger if exists rede_fed_conta on interno.perfis;
create trigger rede_fed_conta before delete on interno.perfis for each row execute function interno.rede_fed_conta_apagada();

-- ── 5. Fediverso: o que a pessoa chama (com a sessão dela) ─────────────────────────────────────────────────────────────

/** A situação da federação para quem está na sessão: pode ligar? está ligada? quantas pessoas de fora seguem e são seguidas. */
create or replace function public.rede_fed_situacao() returns jsonb language plpgsql stable security definer set search_path = interno, pg_temp as $$
declare v uuid := auth.uid(); a rede_fed_atores;
begin
  if v is null then return jsonb_build_object('logado', false, 'ligado', false, 'pode', false, 'motivo', 'entre_primeiro', 'versao', interno.rede_fed_versao()); end if;
  select * into a from rede_fed_atores where perfil = v;
  return jsonb_build_object(
    'logado', true,
    'handle', (select rede_handle from perfis where id = v),
    'motivo', interno.rede_fed_impedimento(v),
    'pode', interno.rede_fed_impedimento(v) is null,
    'ligado', coalesce(a.ligado, false),
    'desde', case when a.ligado then a.ligado_em end,
    'seguidores', (select count(*)::integer from rede_fed_seguidores where perfil = v),
    'seguindo', (select count(*)::integer from rede_fed_seguindo where perfil = v),
    'versao', interno.rede_fed_versao());
end $$;

/** Liga (com o consentimento da versão em vigor) ou desliga a federação do próprio perfil. Desligar retira o que saiu. */
create or replace function public.rede_fed_ligar(p_sim boolean, p_versao integer default null) returns jsonb
language plpgsql volatile security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); v_motivo text; v_handle text;
begin
  perform interno.aberta('comunidade');
  perform interno.limite('rede_fed_ligar', 10, 60);
  if coalesce(p_sim, false) then
    v_motivo := interno.rede_fed_impedimento(v);
    if v_motivo is not null then perform interno.erro(v_motivo); end if;
    if p_versao is distinct from interno.rede_fed_versao() then perform interno.erro('invalido:versao'); end if;
    v_handle := (select rede_handle from perfis where id = v);
    if exists (select 1 from rede_fed_atores where handle = v_handle and ligado and perfil <> v) then perform interno.erro('invalido:handle'); end if;
    insert into rede_fed_atores (perfil, handle, ligado, consentimento_versao, ligado_em, desligado_em)
    values (v, v_handle, true, interno.rede_fed_versao(), now(), null)
    on conflict (perfil) do update set
      ligado_em = case when rede_fed_atores.ligado and rede_fed_atores.handle = excluded.handle then rede_fed_atores.ligado_em else now() end,
      -- Trocou de @nome desde a última vez: as chaves antigas não servem para o endereço novo.
      chave_publica = case when rede_fed_atores.handle = excluded.handle then rede_fed_atores.chave_publica end,
      chave_privada = case when rede_fed_atores.handle = excluded.handle then rede_fed_atores.chave_privada end,
      handle = excluded.handle, ligado = true, consentimento_versao = excluded.consentimento_versao, desligado_em = null;
  else
    perform interno.rede_fed_desligar(v);
  end if;
  return public.rede_fed_situacao();
end $$;

/** Quem a pessoa segue em outras instâncias. */
create or replace function public.rede_fed_seguindo_lista() returns jsonb language plpgsql stable security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu();
begin
  return coalesce((select jsonb_agg(jsonb_build_object('ator', s.ator, 'aceito', s.aceito, 'handle', r.handle, 'nome', r.nome, 'url', r.url, 'desde', s.criado_em) order by s.criado_em desc)
    from rede_fed_seguindo s left join rede_fed_remotos r on r.ator = s.ator where s.perfil = v), '[]'::jsonb);
end $$;

/** Os posts recentes (até 30 dias) de quem a pessoa segue em outras instâncias, só texto. Cursor = data de publicação do último. */
create or replace function public.rede_fed_linha(p_antes timestamptz default null) returns jsonb language plpgsql volatile security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu();
begin
  perform interno.aberta('comunidade');
  perform interno.limite('rede2_ler', 600, 60);
  return coalesce((select jsonb_agg(x order by x ->> 'publicado' desc) from (
    select jsonb_build_object('id', c.id, 'url', c.url, 'texto', c.texto, 'aviso', c.aviso, 'publicado', coalesce(c.publicado, c.recebido_em),
                              'ator', c.ator, 'handle', r.handle, 'nome', r.nome) as x
    from rede_fed_recebidos c join rede_fed_seguindo s on s.ator = c.ator and s.perfil = v and s.aceito
    left join rede_fed_remotos r on r.ator = c.ator
    where p_antes is null or coalesce(c.publicado, c.recebido_em) < p_antes
    order by coalesce(c.publicado, c.recebido_em) desc limit 30) y), '[]'::jsonb);
end $$;

/**
 * Quem está pedindo, para as rotas do servidor que agem em nome da pessoa (buscar e seguir alguém de fora). Confere a sessão,
 * a adesão à rede e o limite por pessoa; devolve o perfil e o estado da federação. O servidor chama com o token da própria pessoa.
 */
create or replace function public.rede_fed_eu(p_acao text) returns jsonb language plpgsql volatile security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); a rede_fed_atores;
begin
  perform interno.aberta('comunidade');
  if p_acao not in ('buscar', 'seguir') then perform interno.erro('invalido:acao'); end if;
  if not interno.rede2_membro(v) then perform interno.erro('consentimento'); end if;
  perform interno.limite('rede_fed_' || p_acao, case p_acao when 'buscar' then 30 else 20 end, 60);
  select * into a from rede_fed_atores where perfil = v;
  return jsonb_build_object('perfil', v, 'handle', (select rede_handle from perfis where id = v), 'ligado', coalesce(a.ligado, false));
end $$;

/**
 * A mediação bloqueia (ou desbloqueia) uma instância inteira: nada entra dela, nada sai para ela, e o que havia dela some.
 * Com domínio vazio e p_sim nulo, só devolve a lista (a tela da mediação abre com ela).
 */
create or replace function public.rede_fed_bloquear(p_dominio text, p_sim boolean, p_motivo text default '') returns jsonb
language plpgsql volatile security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); v_d text := lower(btrim(coalesce(p_dominio, '')));
begin
  if not (interno.media() or interno.cuida()) then perform interno.erro('sem_permissao'); end if;
  if v_d = '' and p_sim is null then
    return coalesce((select jsonb_agg(jsonb_build_object('dominio', dominio, 'motivo', motivo, 'desde', criado_em) order by dominio) from rede_fed_bloqueados), '[]'::jsonb);
  end if;
  if v_d !~ '^[a-z0-9.-]{3,253}$' or v_d !~ '\.' then perform interno.erro('invalido:dominio'); end if;
  if coalesce(p_sim, true) then
    insert into rede_fed_bloqueados (dominio, motivo, por) values (v_d, left(coalesce(p_motivo, ''), 300), v)
    on conflict (dominio) do update set motivo = excluded.motivo, por = excluded.por, criado_em = now();
    delete from rede_fed_seguidores where interno.rede_fed_bloqueado(ator);
    delete from rede_fed_seguindo where interno.rede_fed_bloqueado(ator);
    delete from rede_fed_recebidos where interno.rede_fed_bloqueado(ator);
    delete from rede_fed_remotos where interno.rede_fed_bloqueado(ator);
    update rede_fed_fila set feito_em = now(), erro = 'instancia_bloqueada' where feito_em is null and interno.rede_fed_bloqueado(destino);
  else
    delete from rede_fed_bloqueados where dominio = v_d;
  end if;
  return coalesce((select jsonb_agg(jsonb_build_object('dominio', dominio, 'motivo', motivo, 'desde', criado_em) order by dominio) from rede_fed_bloqueados), '[]'::jsonb);
end $$;

-- ── 6. Fediverso: o que o servidor do site chama (com o segredo da federação) ───────────────────────────────────────────

/** O post como sai para o Fediverso: só o que pode sair agora (confere de novo na hora de entregar). */
create or replace function interno.rede_fed_post_json(p interno.rede_posts) returns jsonb language sql stable security definer set search_path = interno, pg_temp as $$
  select jsonb_build_object('id', p.id, 'tipo', p.tipo, 'titulo', p.titulo, 'texto', p.texto, 'corpo', p.corpo, 'aviso', p.aviso,
    'criado_em', p.criado_em, 'editado_em', p.editado_em, 'resposta_a', p.resposta_a, 'comunidade', p.comunidade,
    'handle', (select handle from rede_fed_atores where perfil = p.autor))
$$;

/**
 * As ações do servidor do site para a federação, numa função só, todas atrás do segredo (interno.rede_fed_segredo). O servidor
 * chama com a chave pública do banco e o segredo; nenhuma chave de serviço é usada. Ações:
 *   ator {handle}                 → {estado: ligado|saindo|desligado|inexistente, perfil, handle, nome, bio, ligado_em, chave_publica, chave_privada}
 *   chaves {perfil, publica, privada} → guarda o par se ainda não há (a privada já vem cifrada); devolve o par guardado
 *   instancia {publica?, privada?} → o par da instância (para buscar com assinatura); grava se ainda não há
 *   outbox {handle, antes?, limite?} → {total, itens: post[]}       post {id} → post ou nulo
 *   seguidores {handle} → {total}
 *   seguidor {handle, ator, inbox, compartilhada?, pedido, sim} → grava/apaga quem segue de fora; ao gravar, põe o Accept na fila
 *   remoto {ator} → o que se sabe do ator; remoto_salvar {ator, chave_id, chave_publica, inbox, compartilhada, handle, nome, resumo, url}
 *   resposta_follow {ator, pedido, aceito} → Accept/Reject de quem alguém daqui pediu para seguir
 *   ator_apagado {ator} → esquece um ator que foi apagado na instância dele
 *   recebido {id, ator, url, texto, aviso, publicado} → guarda o post de quem alguém daqui segue (e só nesse caso)
 *   seguir {perfil, ator, pedido, sim} → alguém daqui segue (ou deixa de seguir) um ator de fora: grava e põe Follow/Undo na fila
 *   fila_pegar {limite} → reserva até N entregas vencidas; fila_feito {id, ok, definitivo, erro}
 *   contagem → {usuarios, posts} (NodeInfo)      bloqueado {url} → boolean
 */
create or replace function public.rede_fed_servidor(p_segredo text, p_acao text, p jsonb default '{}'::jsonb) returns jsonb
language plpgsql volatile security definer set search_path = interno, pg_temp as $$
declare
  a rede_fed_atores;
  f perfis;
  x rede_posts;
  v_limite integer;
  v_antes timestamptz;
  v_res jsonb;
  v_n integer;
  v_t smallint;
  v_ator text := left(coalesce(p ->> 'ator', ''), 500);
begin
  perform interno.rede_fed_segredo(p_segredo);
  p := coalesce(p, '{}'::jsonb);
  if v_ator <> '' and v_ator !~ '^https://[^\s]+$' then perform interno.erro('invalido:ator'); end if;

  case p_acao
  when 'ator' then
    select * into a from rede_fed_atores where handle = lower(coalesce(p ->> 'handle', '')) order by ligado desc, desligado_em desc nulls first limit 1;
    if not found then return jsonb_build_object('estado', 'inexistente'); end if;
    select * into f from perfis where id = a.perfil;
    if a.ligado and interno.rede_fed_impedimento(a.perfil) is null then
      return jsonb_build_object('estado', 'ligado', 'perfil', a.perfil, 'handle', a.handle, 'nome', coalesce(nullif(f.rede_codinome, ''), a.handle),
        'bio', case when f.rede_codinome_ok then left(coalesce(f.rede_bio, ''), 500) else '' end, 'ligado_em', a.ligado_em,
        'chave_publica', a.chave_publica, 'chave_privada', a.chave_privada);
    end if;
    -- Desligado com entregas ainda na fila (as retiradas): o ator continua com a chave, sem nada mais.
    if exists (select 1 from rede_fed_fila q where q.perfil = a.perfil and q.feito_em is null) and a.chave_publica is not null then
      return jsonb_build_object('estado', 'saindo', 'perfil', a.perfil, 'handle', a.handle, 'chave_publica', a.chave_publica, 'chave_privada', a.chave_privada);
    end if;
    return jsonb_build_object('estado', 'desligado');

  when 'chaves' then
    if coalesce(p ->> 'publica', '') !~ '^-----BEGIN PUBLIC KEY-----' or char_length(coalesce(p ->> 'privada', '')) < 100 then perform interno.erro('invalido:chave'); end if;
    update rede_fed_atores set chave_publica = p ->> 'publica', chave_privada = p ->> 'privada'
    where perfil = (p ->> 'perfil')::uuid and chave_publica is null;
    select * into a from rede_fed_atores where perfil = (p ->> 'perfil')::uuid;
    return jsonb_build_object('chave_publica', a.chave_publica, 'chave_privada', a.chave_privada);

  when 'instancia' then
    if (p ->> 'publica') is not null then
      if (p ->> 'publica') !~ '^-----BEGIN PUBLIC KEY-----' or char_length(coalesce(p ->> 'privada', '')) < 100 then perform interno.erro('invalido:chave'); end if;
      insert into configuracoes (chave, valor) values ('fediverso_instancia', jsonb_build_object('publica', p ->> 'publica', 'privada', p ->> 'privada'))
      on conflict (chave) do nothing;
    end if;
    return coalesce((select valor from configuracoes where chave = 'fediverso_instancia'), '{}'::jsonb);

  when 'outbox' then
    select * into a from rede_fed_atores where handle = lower(coalesce(p ->> 'handle', '')) and ligado;
    if not found then return jsonb_build_object('total', 0, 'itens', '[]'::jsonb); end if;
    v_limite := least(greatest(coalesce((p ->> 'limite')::integer, 20), 1), 40);
    v_antes := nullif(p ->> 'antes', '')::timestamptz;
    select count(*)::integer into v_n from rede_fed_enviados e where e.perfil = a.perfil and e.apagado_em is null;
    select coalesce(jsonb_agg(interno.rede_fed_post_json(r) order by r.criado_em desc), '[]'::jsonb) into v_res
    from (select r.* from rede_fed_enviados e join rede_posts r on r.id = e.post
          where e.perfil = a.perfil and e.apagado_em is null and (v_antes is null or r.criado_em < v_antes) and interno.rede_fed_federavel(r)
          order by r.criado_em desc limit v_limite) r;
    return jsonb_build_object('total', v_n, 'itens', v_res);

  when 'post' then
    begin
      select * into x from rede_posts where id = (p ->> 'id')::uuid;
    exception when others then
      return 'null'::jsonb;
    end;
    if not found or not interno.rede_fed_federavel(x) then
      -- Já saiu e foi retirado: a federação responde 410 (Gone) em vez de 404.
      if exists (select 1 from rede_fed_enviados e where e.post::text = p ->> 'id' and e.apagado_em is not null) then return jsonb_build_object('apagado', true); end if;
      return 'null'::jsonb;
    end if;
    return interno.rede_fed_post_json(x);

  when 'seguidores' then
    select * into a from rede_fed_atores where handle = lower(coalesce(p ->> 'handle', '')) and ligado;
    if not found then return jsonb_build_object('total', 0); end if;
    return jsonb_build_object('total', (select count(*)::integer from rede_fed_seguidores where perfil = a.perfil));

  when 'seguidor' then
    select * into a from rede_fed_atores where handle = lower(coalesce(p ->> 'handle', '')) and ligado;
    if not found or interno.rede_fed_impedimento(a.perfil) is not null then return jsonb_build_object('ok', false, 'motivo', 'desligado'); end if;
    if interno.rede_fed_bloqueado(v_ator) or interno.rede_fed_bloqueado(p ->> 'inbox') then return jsonb_build_object('ok', false, 'motivo', 'bloqueado'); end if;
    if coalesce((p ->> 'sim')::boolean, true) then
      if coalesce(p ->> 'inbox', '') !~ '^https://[^\s]+$' or interno.rede_fed_dominio(p ->> 'inbox') <> interno.rede_fed_dominio(v_ator) then perform interno.erro('invalido:inbox'); end if;
      insert into rede_fed_seguidores (perfil, ator, inbox, inbox_compartilhada, pedido)
      values (a.perfil, v_ator, p ->> 'inbox',
              case when coalesce(p ->> 'compartilhada', '') ~ '^https://[^\s]+$' and interno.rede_fed_dominio(p ->> 'compartilhada') = interno.rede_fed_dominio(v_ator) then p ->> 'compartilhada' end,
              left(coalesce(p ->> 'pedido', ''), 500))
      on conflict (perfil, ator) do update set inbox = excluded.inbox, inbox_compartilhada = excluded.inbox_compartilhada, pedido = excluded.pedido;
      insert into rede_fed_fila (perfil, tipo, objeto, destino, extra) values (a.perfil, 'accept', v_ator, p ->> 'inbox', jsonb_build_object('pedido', left(coalesce(p ->> 'pedido', ''), 500)));
    else
      delete from rede_fed_seguidores where perfil = a.perfil and ator = v_ator;
    end if;
    return jsonb_build_object('ok', true, 'perfil', a.perfil);

  when 'remoto' then
    return coalesce((select to_jsonb(r) from rede_fed_remotos r where r.ator = v_ator or r.chave_id = left(coalesce(p ->> 'chave_id', ''), 600) limit 1), 'null'::jsonb);

  when 'remoto_salvar' then
    if v_ator = '' then perform interno.erro('invalido:ator'); end if;
    if interno.rede_fed_bloqueado(v_ator) then return jsonb_build_object('ok', false, 'motivo', 'bloqueado'); end if;
    insert into rede_fed_remotos (ator, chave_id, chave_publica, inbox, inbox_compartilhada, handle, nome, resumo, url, buscado_em)
    values (v_ator, left(p ->> 'chave_id', 600), left(p ->> 'chave_publica', 4000),
            case when coalesce(p ->> 'inbox', '') ~ '^https://[^\s]+$' then left(p ->> 'inbox', 500) end,
            case when coalesce(p ->> 'compartilhada', '') ~ '^https://[^\s]+$' then left(p ->> 'compartilhada', 500) end,
            left(p ->> 'handle', 200), left(p ->> 'nome', 200), left(p ->> 'resumo', 1000),
            case when coalesce(p ->> 'url', '') ~ '^https://[^\s]+$' then left(p ->> 'url', 500) end, now())
    on conflict (ator) do update set chave_id = excluded.chave_id, chave_publica = excluded.chave_publica, inbox = excluded.inbox,
      inbox_compartilhada = excluded.inbox_compartilhada, handle = excluded.handle, nome = excluded.nome, resumo = excluded.resumo,
      url = excluded.url, buscado_em = now();
    return jsonb_build_object('ok', true);

  when 'resposta_follow' then
    if coalesce((p ->> 'aceito')::boolean, false) then
      update rede_fed_seguindo set aceito = true where ator = v_ator and (pedido = coalesce(p ->> 'pedido', '') or coalesce(p ->> 'pedido', '') = '');
    else
      delete from rede_fed_seguindo where ator = v_ator and (pedido = coalesce(p ->> 'pedido', '') or coalesce(p ->> 'pedido', '') = '');
    end if;
    get diagnostics v_n = row_count;
    return jsonb_build_object('ok', v_n > 0);

  when 'ator_apagado' then
    delete from rede_fed_seguidores where ator = v_ator;
    delete from rede_fed_seguindo where ator = v_ator;
    delete from rede_fed_recebidos where ator = v_ator;
    delete from rede_fed_remotos where ator = v_ator;
    return jsonb_build_object('ok', true);

  when 'recebido' then
    if not exists (select 1 from rede_fed_seguindo s where s.ator = v_ator and s.aceito) or interno.rede_fed_bloqueado(v_ator) then
      return jsonb_build_object('guardado', false);
    end if;
    if coalesce(p ->> 'id', '') !~ '^https://[^\s]+$' or interno.rede_fed_dominio(p ->> 'id') <> interno.rede_fed_dominio(v_ator) then perform interno.erro('invalido:id'); end if;
    insert into rede_fed_recebidos (id, ator, url, texto, aviso, publicado)
    values (left(p ->> 'id', 500), v_ator, case when coalesce(p ->> 'url', '') ~ '^https://[^\s]+$' then left(p ->> 'url', 500) end,
            left(coalesce(p ->> 'texto', ''), 3000), left(coalesce(p ->> 'aviso', ''), 200),
            least(coalesce(nullif(p ->> 'publicado', '')::timestamptz, now()), now()))
    on conflict (id) do update set texto = excluded.texto, aviso = excluded.aviso;
    return jsonb_build_object('guardado', true);

  when 'recebido_apagado' then
    delete from rede_fed_recebidos where id = left(coalesce(p ->> 'id', ''), 500) and ator = v_ator;
    return jsonb_build_object('ok', true);

  when 'seguir' then
    select * into a from rede_fed_atores where perfil = (p ->> 'perfil')::uuid and ligado;
    if not found then perform interno.erro('fediverso_desligado'); end if;
    if interno.rede_fed_bloqueado(v_ator) then perform interno.erro('instancia_bloqueada'); end if;
    if coalesce((p ->> 'sim')::boolean, true) then
      if not exists (select 1 from rede_fed_remotos r where r.ator = v_ator and r.inbox is not null) then perform interno.erro('nao_encontrado'); end if;
      if (select count(*) from rede_fed_seguindo where perfil = a.perfil) >= 2000 then perform interno.erro('muitos_pedidos'); end if;
      insert into rede_fed_seguindo (perfil, ator, pedido) values (a.perfil, v_ator, left(coalesce(p ->> 'pedido', ''), 500))
      on conflict (perfil, ator) do update set pedido = excluded.pedido, aceito = false;
      insert into rede_fed_fila (perfil, tipo, objeto, destino, extra)
      select a.perfil, 'follow', v_ator, r.inbox, jsonb_build_object('pedido', left(coalesce(p ->> 'pedido', ''), 500)) from rede_fed_remotos r where r.ator = v_ator;
    else
      insert into rede_fed_fila (perfil, tipo, objeto, destino, extra)
      select a.perfil, 'undo-follow', v_ator, r.inbox, jsonb_build_object('pedido', s.pedido)
      from rede_fed_seguindo s join rede_fed_remotos r on r.ator = s.ator where s.perfil = a.perfil and s.ator = v_ator and r.inbox is not null;
      delete from rede_fed_seguindo where perfil = a.perfil and ator = v_ator;
    end if;
    return jsonb_build_object('ok', true);

  when 'fila_pegar' then
    v_limite := least(greatest(coalesce((p ->> 'limite')::integer, 20), 1), 100);
    if random() < 0.05 then perform interno.rede_fed_limpar(); end if;
    with escolhidos as (
      select q.id from rede_fed_fila q where q.feito_em is null and q.proxima <= now() order by q.proxima, q.id limit v_limite for update skip locked
    ), reservados as (
      update rede_fed_fila q set proxima = now() + interval '3 minutes', tentativas = q.tentativas + 1 from escolhidos e where q.id = e.id returning q.*
    )
    select coalesce(jsonb_agg(jsonb_build_object('id', r.id, 'tipo', r.tipo, 'objeto', r.objeto, 'destino', r.destino, 'extra', r.extra,
      'tentativas', r.tentativas, 'handle', t.handle, 'chave_publica', t.chave_publica, 'chave_privada', t.chave_privada) order by r.id), '[]'::jsonb)
    into v_res from reservados r join rede_fed_atores t on t.perfil = r.perfil;
    return v_res;

  when 'fila_feito' then
    select tentativas into v_t from rede_fed_fila where id = (p ->> 'id')::bigint;
    if coalesce((p ->> 'ok')::boolean, false) then
      update rede_fed_fila set feito_em = now(), erro = '' where id = (p ->> 'id')::bigint;
    elsif coalesce((p ->> 'definitivo')::boolean, false) or coalesce(v_t, 0) >= 8 then
      update rede_fed_fila set feito_em = now(), erro = left(coalesce(p ->> 'erro', 'falha'), 300) where id = (p ->> 'id')::bigint;
    else
      update rede_fed_fila set erro = left(coalesce(p ->> 'erro', 'falha'), 300),
        proxima = now() + least(interval '12 hours', interval '1 minute' * power(2, greatest(coalesce(v_t, 1), 1)))
      where id = (p ->> 'id')::bigint;
    end if;
    return jsonb_build_object('ok', true);

  when 'contagem' then
    return jsonb_build_object('usuarios', (select count(*)::integer from rede_fed_atores where ligado),
                              'posts', (select count(*)::integer from rede_fed_enviados where apagado_em is null));

  when 'bloqueado' then
    return to_jsonb(interno.rede_fed_bloqueado(coalesce(p ->> 'url', '')));

  else
    perform interno.erro('invalido:acao');
  end case;
  return null;
end $$;

/** A faxina da federação: entregas feitas há mais de 14 dias, posts recebidos há mais de 30 dias e atores remotos esquecidos. */
create or replace function interno.rede_fed_limpar() returns void language plpgsql security definer set search_path = interno, pg_temp as $$
begin
  delete from rede_fed_fila where feito_em is not null and feito_em < now() - interval '14 days';
  delete from rede_fed_recebidos where recebido_em < now() - interval '30 days';
  delete from rede_fed_remotos r where r.buscado_em < now() - interval '60 days'
    and not exists (select 1 from rede_fed_seguidores s where s.ator = r.ator) and not exists (select 1 from rede_fed_seguindo s where s.ator = r.ator);
  -- Chaves de quem desligou e já não tem nada na fila: apagadas (religar gera um par novo).
  update rede_fed_atores a set chave_publica = null, chave_privada = null
  where not a.ligado and a.chave_privada is not null and a.desligado_em < now() - interval '1 day'
    and not exists (select 1 from rede_fed_fila q where q.perfil = a.perfil and q.feito_em is null);
  -- Conta apagada (interno.rede_fed_conta_apagada): as retiradas já saíram ou desistiram; a linha e a fila dela somem.
  delete from rede_fed_atores a where not exists (select 1 from perfis f where f.id = a.perfil)
    and not exists (select 1 from rede_fed_fila q where q.perfil = a.perfil and q.feito_em is null);
  delete from rede_fed_fila q where q.feito_em is not null and not exists (select 1 from perfis f where f.id = q.perfil);
end $$;

/**
 * Cutuca o servidor do site para entregar a fila (pg_net), se há entrega vencida e a configuração tem 'url_entrega'
 * (interno.configuracoes, chave 'fediverso'). O pedido não leva segredo: a rota só entrega o que já está na fila.
 */
create or replace function interno.rede_fed_cutucar() returns void language plpgsql security definer set search_path = interno, pg_temp as $$
declare v_url text := (select valor ->> 'url_entrega' from configuracoes where chave = 'fediverso');
begin
  if coalesce(v_url, '') !~ '^https://[a-z0-9.-]+/api/fediverso/entregar$' then return; end if;
  if not exists (select 1 from rede_fed_fila where feito_em is null and proxima <= now()) then return; end if;
  execute 'select net.http_post(url := $1, body := ''{}''::jsonb, headers := $2, timeout_milliseconds := 30000)'
    using v_url, jsonb_build_object('Content-Type', 'application/json');
end $$;

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule('lucia-fediverso-limpar', '41 4 * * *', 'select interno.rede_fed_limpar()');
    if exists (select 1 from pg_extension where extname = 'pg_net') then
      perform cron.schedule('lucia-fediverso-entregar', '* * * * *', 'select interno.rede_fed_cutucar()');
    end if;
  end if;
exception when others then null;
end $$;

-- ── 7. Permissões ───────────────────────────────────────────────────────────────────────────────────────────────────────
-- Nenhuma função interna é chamável de fora. As da pessoa pedem conta (a própria função confere a sessão); a do servidor
-- (rede_fed_servidor) é chamada com a chave pública, mas só responde a quem traz o segredo da federação.
revoke all on function interno.rede_fed_versao(), interno.rede_fed_dominio(text), interno.rede_fed_bloqueado(text), interno.rede_fed_segredo(text),
  interno.rede_fed_impedimento(uuid), interno.rede_fed_federavel(interno.rede_posts, integer), interno.rede_fed_espalhar(uuid, text, text),
  interno.rede_fed_post_mudou(), interno.rede_fed_desligar(uuid), interno.rede_fed_perfil_mudou(), interno.rede_fed_consentimento_mudou(),
  interno.rede_fed_conta_apagada(), interno.rede_fed_post_json(interno.rede_posts), interno.rede_fed_limpar(), interno.rede_fed_cutucar() from public;
revoke all on function public.rede_alumia_salvos(text, integer), public.rede_fed_situacao(), public.rede_fed_ligar(boolean, integer),
  public.rede_fed_seguindo_lista(), public.rede_fed_linha(timestamptz), public.rede_fed_eu(text), public.rede_fed_bloquear(text, boolean, text),
  public.rede_fed_servidor(text, text, jsonb) from public;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on function interno.rede_fed_versao(), interno.rede_fed_dominio(text), interno.rede_fed_bloqueado(text), interno.rede_fed_segredo(text),
      interno.rede_fed_impedimento(uuid), interno.rede_fed_federavel(interno.rede_posts, integer), interno.rede_fed_espalhar(uuid, text, text),
      interno.rede_fed_post_mudou(), interno.rede_fed_desligar(uuid), interno.rede_fed_perfil_mudou(), interno.rede_fed_consentimento_mudou(),
      interno.rede_fed_conta_apagada(), interno.rede_fed_post_json(interno.rede_posts), interno.rede_fed_limpar(), interno.rede_fed_cutucar() from anon, authenticated;
    revoke all on function public.rede_alumia_salvos(text, integer), public.rede_fed_situacao(), public.rede_fed_ligar(boolean, integer),
      public.rede_fed_seguindo_lista(), public.rede_fed_linha(timestamptz), public.rede_fed_eu(text), public.rede_fed_bloquear(text, boolean, text),
      public.rede_fed_servidor(text, text, jsonb) from anon, authenticated;
    grant execute on function public.rede_alumia_salvos(text, integer), public.rede_fed_ligar(boolean, integer), public.rede_fed_seguindo_lista(),
      public.rede_fed_linha(timestamptz), public.rede_fed_eu(text), public.rede_fed_bloquear(text, boolean, text) to authenticated, service_role;
    grant execute on function public.rede_fed_situacao(), public.rede_fed_servidor(text, text, jsonb) to anon, authenticated, service_role;
  end if;
end $$;
