-- ───────────────────────────── Rede Lúcia v2: pacote avisos (Etapa 7, R4 itens 41 a 44) ─────────────────────────────
-- Migração acrescentável: pode rodar mais de uma vez, sem apagar dado nenhum. Roda DEPOIS do install.sql e da fundação
-- (2026-11-rede-fundacao.sql), na ordem de docs/rede/V2.md: fundacao → consertos → perfil → publicar → conversa →
-- descoberta → comunidades → AVISOS → moderacao. Contrato: docs/rede/V2.md. Segredos e passo a passo: docs/rede/AVISOS.md.
-- Teste: npm run testar:rede-avisos.
--
-- O que este arquivo faz, e só isto:
--   1. Estrutura: o aviso (interno.avisos, categoria 'rede') ganha tipo, post, alvo e ator para poder ser agrupado; as
--      preferências (rede_avisos_prefs) ganham os tipos 'apoio' e 'resumo'; nasce a tabela das assinaturas de aviso no celular.
--   2. Criação: interno.rede3_aviso_criar (a porta para os outros pacotes: conversa, comunidades, moderação) e gatilhos
--      que agrupam o aviso de resposta da fundação e geram o aviso de apoio, só com a quantidade.
--   3. Leitura agrupada ("Ana e mais 3 responderam"): rede_aviso_listar, rede_aviso_contar, rede_aviso_ler. Toda linha passa
--      por interno.rede_ve (a matriz): aviso de post que a pessoa não pode ver não aparece. Apoio nunca mostra quem apoiou.
--   4. Preferências por tipo e canal: rede_aviso_prefs_ver e rede_aviso_prefs_salvar.
--   5. Resumo semanal por e-mail, DESLIGADO por padrão: só contagens e títulos de conversas públicas, nunca o texto de um
--      post, nunca nome. Entra na fila de e-mails de sempre (interno.email → função enviar-emails, rotina emails.yml).
--   6. Aviso no celular (PWA, Web Push com VAPID): só "Você tem N avisos na Rede", sem texto de post. A assinatura fica no
--      servidor; quem envia é a função enviar-push (supabase/functions/enviar-push).
--
-- Leis: LGPD (13.709/2018) art. 7º, I e art. 8º (consentimento: e-mail e celular só depois que a pessoa liga), art. 18, VI
-- (revogar o consentimento: desligar apaga a assinatura do aparelho), art. 6º, III (necessidade: o push leva um número, nada
-- mais) e art. 11 (nada de opinião política ou filiação nos avisos: só contagem). Marco Civil (12.965/2014) art. 7º, VII
-- (nenhum dado de aviso é repassado a terceiros além do serviço de entrega do navegador, que só recebe o número).
-- ECA Digital (15.211/2025): a Rede é só 18+ (rede2_membro), então nenhum aviso é enviado a menor pela Rede.

-- ── 1. Estrutura ───────────────────────────────────────────────────────────────────────────────────────────────────────

alter table interno.avisos add column if not exists tipo text;
alter table interno.avisos add column if not exists post uuid references interno.rede_posts (id) on delete cascade;
alter table interno.avisos add column if not exists alvo uuid references interno.rede_posts (id) on delete cascade;
alter table interno.avisos add column if not exists ator uuid references interno.perfis (id) on delete set null;
alter table interno.avisos add column if not exists empurrado boolean not null default false;
do $$ begin
  alter table interno.avisos add constraint avisos_tipo check (tipo is null or tipo in ('resposta', 'mencao', 'citacao', 'seguidor', 'chamado', 'nucleo', 'moderacao', 'apoio'));
exception when duplicate_object then null;
end $$;
create index if not exists avisos_rede_grupo on interno.avisos (para, tipo, post);
-- Um apoio por pessoa e por post: ligar e desligar o apoio não soma avisos.
create unique index if not exists avisos_apoio_unico on interno.avisos (para, post, ator) where tipo = 'apoio';

-- As preferências ganham 'apoio' (aviso de apoio, só a quantidade) e 'resumo' (resumo semanal por e-mail). O que já estava fica.
do $$
declare r record;
begin
  for r in select conname from pg_constraint where conrelid = 'interno.rede_avisos_prefs'::regclass and contype = 'c' and pg_get_constraintdef(oid) like '%tipo%' loop
    execute format('alter table interno.rede_avisos_prefs drop constraint %I', r.conname);
  end loop;
  alter table interno.rede_avisos_prefs add constraint rede_avisos_prefs_tipo_v2
    check (tipo in ('resposta', 'mencao', 'citacao', 'seguidor', 'chamado', 'nucleo', 'moderacao', 'apoio', 'resumo'));
end $$;

-- Aviso no celular: uma linha por aparelho que a própria pessoa ligou. O endereço e as chaves vêm do navegador (Web Push) e só
-- servem para entregar "Você tem N avisos"; saem quando a pessoa desliga, quando o serviço do navegador diz que o aparelho não
-- existe mais ou quando a conta é apagada.
create table if not exists interno.rede_push_assinaturas (
  id uuid primary key default gen_random_uuid(),
  usuario uuid not null references interno.perfis (id) on delete cascade,
  endpoint text not null unique check (endpoint ~ '^https://' and char_length(endpoint) <= 600),
  p256dh text not null check (p256dh ~ '^[A-Za-z0-9_-]{20,120}$'),
  auth text not null check (auth ~ '^[A-Za-z0-9_-]{10,40}$'),
  lang text not null default 'pt' check (lang in ('pt', 'en', 'es', 'fr', 'ru', 'zh')),
  criado_em timestamptz not null default now(),
  ultimo_envio timestamptz,
  falhas smallint not null default 0
);
create index if not exists rede_push_usuario on interno.rede_push_assinaturas (usuario);
alter table interno.rede_push_assinaturas enable row level security;

-- ── 2. Criação dos avisos ───────────────────────────────────────────────────────────────────────────────────────────────

/** A chave que agrupa avisos: respostas, menções, citações e apoios do mesmo post; seguidores juntos; o resto cada um por si. */
create or replace function interno.rede3_aviso_chave(p_tipo text, p_post uuid, p_id uuid) returns text language sql immutable as $$
  select case when p_tipo in ('resposta', 'mencao', 'citacao', 'apoio') and p_post is not null then p_tipo || ':' || p_post::text
              when p_tipo = 'seguidor' then 'seguidor'
              else 'n:' || p_id::text end
$$;

/** A preferência de uma pessoa: no site vale ligado, no e-mail e no celular vale desligado, até ela ligar. A moderação no site nunca se desliga. */
create or replace function interno.rede3_aviso_pref(p_usuario uuid, p_tipo text, p_canal text) returns boolean language sql stable security definer set search_path = interno, pg_temp as $$
  select case when p_tipo = 'moderacao' and p_canal = 'site' then true
    else coalesce((select p.ligado from rede_avisos_prefs p where p.usuario = p_usuario and p.tipo = p_tipo and p.canal = p_canal), p_canal = 'site') end
$$;

/**
 * A porta para criar um aviso da Rede (conversa, comunidades, moderação e a fundação passam por aqui, ou pelo gatilho abaixo).
 * p_texto é o texto de reserva (sem trecho de post; vazio vira uma frase genérica). Não avisa a si mesmo, nem quem bloqueou ou foi
 * bloqueado, e respeita a preferência "no site" da pessoa (menos moderação). Apoio guarda quem apoiou só para não repetir; o
 * nome nunca sai (rede_aviso_listar).
 */
create or replace function interno.rede3_aviso_criar(p_para uuid, p_tipo text, p_post uuid, p_alvo uuid, p_ator uuid, p_texto text default null) returns void language plpgsql security definer set search_path = interno, pg_temp as $$
begin
  if p_para is null or p_tipo not in ('resposta', 'mencao', 'citacao', 'seguidor', 'chamado', 'nucleo', 'moderacao', 'apoio') then return; end if;
  if p_ator is not null and (p_ator = p_para or interno.rede_bloqueado(p_ator, p_para)) then return; end if;
  if not exists (select 1 from perfis where id = p_para and not suspenso) then return; end if;
  insert into avisos (para, texto, categoria, tipo, post, alvo, ator)
  values (p_para,
    left(coalesce(nullif(btrim(p_texto), ''), case p_tipo
      when 'resposta' then 'Alguém respondeu ao seu post na Rede Lúcia.' when 'mencao' then 'Alguém mencionou você na Rede Lúcia.'
      when 'citacao' then 'Alguém citou o seu post na Rede Lúcia.' when 'seguidor' then 'Alguém começou a seguir você na Rede Lúcia.'
      when 'apoio' then 'Alguém apoiou o seu post na Rede Lúcia.' when 'chamado' then 'Um chamado da Rede Lúcia mudou.'
      when 'nucleo' then 'Há novidade no seu núcleo da Rede Lúcia.' else 'Há uma atualização da moderação da Rede Lúcia.' end), 500),
    'rede', p_tipo, p_post, p_alvo, p_ator)
  on conflict do nothing;
end $$;

/**
 * Antes de gravar um aviso: (1) o aviso de resposta que a fundação grava ("Fulana respondeu ao seu post na Rede Lúcia: …") ganha tipo,
 * post, alvo e ator, para ser agrupado; o texto antigo fica como está, para a Rede de hoje; (2) a pessoa que desligou aquele tipo no
 * site não recebe (a moderação nunca é desligada).
 */
create or replace function interno.rede3_aviso_antes() returns trigger language plpgsql security definer set search_path = interno, pg_temp as $$
declare m text[]; r record;
begin
  if new.categoria = 'rede' and new.tipo is null and new.post is null then
    m := regexp_match(new.texto, '^(.+) respondeu ao seu post na Rede Lúcia: “(.*)”$');
    if m is not null then
      select p.id, p.resposta_a, p.autor into r from rede_posts p join rede_posts pai on pai.id = p.resposta_a
       where pai.autor = new.para and p.autor is not null and interno.rede_nome(p.autor) = m[1] and left(p.texto, 120) = m[2]
       order by p.criado_em desc limit 1;
      if found then new.tipo := 'resposta'; new.post := r.resposta_a; new.alvo := r.id; new.ator := r.autor; end if;
    end if;
  end if;
  if new.tipo is not null and new.tipo <> 'moderacao' and not interno.rede3_aviso_pref(new.para, new.tipo, 'site') then return null; end if;
  return new;
end $$;
drop trigger if exists rede3_aviso_antes on interno.avisos;
create trigger rede3_aviso_antes before insert on interno.avisos for each row execute function interno.rede3_aviso_antes();

/** Apoio: avisa o autor só com a quantidade (a fundação não avisava). Desfazer o apoio tira o aviso: quem apoiou não deixa rastro. */
create or replace function interno.rede3_aviso_apoio() returns trigger language plpgsql security definer set search_path = interno, pg_temp as $$
declare o rede_posts;
begin
  if tg_op = 'INSERT' then
    if new.tipo = 'apoio' then
      select * into o from rede_posts where id = new.post;
      if found and o.autor is not null and not o.oculto and not o.retido and o.apagado_em is null then
        perform interno.rede3_aviso_criar(o.autor, 'apoio', o.id, null, new.usuario, null);
      end if;
    end if;
  elsif old.tipo = 'apoio' then
    delete from avisos where tipo = 'apoio' and post = old.post and ator = old.usuario;
  end if;
  return null;
end $$;
drop trigger if exists rede3_aviso_apoio on interno.rede_reacoes;
create trigger rede3_aviso_apoio after insert or delete on interno.rede_reacoes for each row execute function interno.rede3_aviso_apoio();

-- ── 3. Leitura agrupada ─────────────────────────────────────────────────────────────────────────────────────────────────

/**
 * Os avisos da Rede de uma pessoa, já agrupados, dos 200 mais novos. Cada linha segue a matriz: aviso de post que a pessoa não pode
 * ver (removido, retido, apagado, fora do alcance, silenciado) some; aviso de quem ela bloqueou ou silenciou também. Moderação
 * e avisos sem post (conta, núcleo) não dependem de post. Devolve o grupo mais novo primeiro. Interna: quem chama decide o que mostrar
 * (nomes, texto).
 */
create or replace function interno.rede3_aviso_grupos(p_quem uuid, p_desde timestamptz default null)
returns table (chave text, tipo text, post uuid, alvo uuid, titulo text, total integer, pessoas integer, ultimo timestamptz, lido boolean, id uuid, ator uuid, atores uuid[], texto text, ids uuid[])
language sql stable security definer set search_path = interno, pg_temp as $$
  with u as (
    select a.* from avisos a
    where a.para = p_quem and a.categoria in ('rede', 'conta') and (p_desde is null or a.criado_em >= p_desde)
    order by a.criado_em desc, a.id desc limit 200
  ), v as (
    select u.*, interno.rede3_aviso_chave(u.tipo, u.post, u.id) as chave, case when u.tipo = 'moderacao' then null else p.titulo end as ptitulo
    from u left join rede_posts p on p.id = coalesce(u.alvo, u.post)
    where (u.post is null or u.tipo = 'moderacao'
           or (p.id is not null and interno.rede_ve(p, p_quem) and p.apagado_em is null and (not (p.oculto or p.retido) or p.autor = p_quem) and not interno.rede_silenciado(p, p_quem)))
      and (u.ator is null or (not interno.rede_bloqueado(p_quem, u.ator)
           and not exists (select 1 from rede_silenciados s where s.usuario = p_quem and s.pessoa = u.ator and (s.ate is null or s.ate > now()))))
  )
  select g.chave, g.tipo, g.post, g.alvo, g.ptitulo, g.total, g.pessoas, g.ultimo, g.lido, g.id, g.ator,
    (select array_agg(x.ator) from (select w.ator from v w where w.chave = g.chave and w.ator is not null group by w.ator order by max(w.criado_em) desc limit 2) x),
    g.texto, g.ids
  from (
    select v.chave,
      (array_agg(v.tipo order by v.criado_em desc, v.id desc))[1] as tipo,
      (array_agg(v.post order by v.criado_em desc, v.id desc))[1] as post,
      (array_agg(v.alvo order by v.criado_em desc, v.id desc))[1] as alvo,
      (array_agg(v.ptitulo order by v.criado_em desc, v.id desc))[1] as ptitulo,
      count(*)::integer as total,
      (count(distinct v.ator) + count(*) filter (where v.ator is null))::integer as pessoas,
      max(v.criado_em) as ultimo,
      bool_and(v.lido) as lido,
      (array_agg(v.id order by v.criado_em desc, v.id desc))[1] as id,
      (array_agg(v.ator order by v.criado_em desc, v.id desc))[1] as ator,
      (array_agg(v.texto order by v.criado_em desc, v.id desc))[1] as texto,
      array_agg(v.id) as ids
    from v group by v.chave
  ) g
  order by g.ultimo desc, g.id desc
$$;

/**
 * Os avisos da pessoa, agrupados, com cursor ("data,id" do último item da página anterior). Cada item: tipo, total (quantos
 * avisos o grupo junta), pessoas, atores (até 2 codinomes, nulo quando a pessoa não aparece na Rede; nunca em apoio), post, título
 * do post (só se a pessoa o vê), texto (só avisos sem estrutura: conta, chamado, núcleo, moderação). Nenhum trecho de post sai daqui.
 */
create or replace function public.rede_aviso_listar(p_cursor text default null, p_limite integer default 20) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare
  v uuid := interno.eu();
  v_lim integer := greatest(1, least(coalesce(p_limite, 20), 50));
  v_ts timestamptz; v_id uuid;
  v_itens jsonb; v_mais boolean; v_ultimo text; v_nao integer;
begin
  perform interno.aberta('comunidade');
  perform interno.limite('rede_avisos', 300, 60);
  if p_cursor is not null then
    if p_cursor !~ '^[0-9T:.+ Z-]{10,40},[0-9a-f-]{36}$' then perform interno.erro('invalido:cursor'); end if;
    v_ts := split_part(p_cursor, ',', 1)::timestamptz; v_id := split_part(p_cursor, ',', 2)::uuid;
  end if;
  with todos as materialized (select * from interno.rede3_aviso_grupos(v)),
  pagina as (
    select t.*, row_number() over (order by t.ultimo desc, t.id desc) as pos from todos t
    where v_ts is null or (t.ultimo, t.id) < (v_ts, v_id) order by t.ultimo desc, t.id desc limit v_lim + 1
  )
  select coalesce(jsonb_agg(jsonb_build_object(
      'id', n.id, 'tipo', n.tipo, 'total', n.total, 'pessoas', n.pessoas, 'lido', n.lido, 'criado_em', n.ultimo,
      'post', n.post, 'alvo', n.alvo, 'titulo', n.titulo,
      'atores', case when n.tipo = 'apoio' then '[]'::jsonb else (
        select coalesce(jsonb_agg(case when coalesce(f.rede_modo = 'invisivel' or f.rede_invisivel, false) then null else to_jsonb(interno.rede_nome(f.id)) end order by u.o), '[]'::jsonb)
        from unnest(n.atores) with ordinality u (a, o) join perfis f on f.id = u.a) end,
      -- Aviso antigo sem estrutura que guarda trecho de post no texto (resposta que não casou, "resolveu a dúvida"): o trecho nunca sai,
      -- porque o aviso não passa pela matriz (o post pode ter sido removido ou retido depois).
      'texto', case when n.tipo is null and n.texto ~ ' respondeu ao seu post na Rede Lúcia: “' then 'Alguém respondeu ao seu post na Rede Lúcia.'
                    when n.tipo is null and n.texto ~ '^Sua resposta foi marcada como a que resolveu' then 'Sua resposta foi marcada como a que resolveu uma dúvida na Rede Lúcia.'
                    when n.tipo is null or n.tipo in ('chamado', 'nucleo', 'moderacao') then n.texto end) order by n.pos) filter (where n.pos <= v_lim), '[]'::jsonb),
    coalesce(bool_or(n.pos > v_lim), false),
    (select to_char(x.ultimo at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') || ',' || x.id::text from pagina x where x.pos = v_lim),
    (select count(*)::integer from todos where not lido)
  into v_itens, v_mais, v_ultimo, v_nao from pagina n;
  return jsonb_build_object('itens', v_itens, 'proximo', case when v_mais then v_ultimo end, 'nao_lidos', v_nao);
end $$;

/** Quantos grupos de avisos a pessoa ainda não leu (o número do sino). */
create or replace function public.rede_aviso_contar() returns integer language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu();
begin
  perform interno.limite('rede_avisos_n', 600, 60);
  return (select count(*)::integer from interno.rede3_aviso_grupos(v) g where not g.lido);
end $$;

/** Marca como lido o grupo do aviso p_id (todos os avisos juntos nele); sem id, marca todos os da Rede e da conta. */
create or replace function public.rede_aviso_ler(p_id uuid default null) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); v_chave text;
begin
  if p_id is null then
    update avisos set lido = true where para = v and categoria in ('rede', 'conta') and not lido;
  else
    select interno.rede3_aviso_chave(a.tipo, a.post, a.id) into v_chave from avisos a where a.id = p_id and a.para = v;
    if v_chave is null then perform interno.erro('nao_encontrado'); end if;
    update avisos set lido = true where para = v and categoria in ('rede', 'conta') and not lido and interno.rede3_aviso_chave(tipo, post, id) = v_chave;
  end if;
  return jsonb_build_object('ok', true, 'nao_lidos', (select count(*)::integer from interno.rede3_aviso_grupos(v) g where not g.lido));
end $$;

-- ── 4. Preferências ────────────────────────────────────────────────────────────────────────────────────────────────────

/** As preferências da pessoa, com os padrões: no site tudo ligado; celular e resumo desligados até ela ligar. */
create or replace function public.rede_aviso_prefs_ver() returns jsonb language plpgsql stable security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu();
begin
  return jsonb_build_object(
    'site', (select jsonb_object_agg(t, interno.rede3_aviso_pref(v, t, 'site')) from unnest(array['resposta', 'mencao', 'citacao', 'seguidor', 'chamado', 'nucleo', 'moderacao', 'apoio']) t),
    'push', (select jsonb_object_agg(t, interno.rede3_aviso_pref(v, t, 'push')) from unnest(array['resposta', 'mencao', 'citacao', 'seguidor', 'chamado', 'nucleo', 'moderacao', 'apoio']) t),
    'resumo', interno.rede3_aviso_pref(v, 'resumo', 'email'),
    'push_aparelhos', (select count(*)::integer from rede_push_assinaturas where usuario = v),
    'membro', interno.rede2_membro(v));
end $$;

/**
 * Liga ou desliga um tipo num canal. Canais: 'site' (qualquer tipo, menos moderação, que fica sempre ligada), 'push' (qualquer tipo
 * de aviso) e 'email' (só o tipo 'resumo': o resumo semanal). Resumo e celular só para quem já entrou na Rede (18+ com consentimento).
 */
create or replace function public.rede_aviso_prefs_salvar(p_tipo text, p_canal text, p_ligado boolean) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu();
begin
  perform interno.aberta('comunidade');
  perform interno.limite('rede_avisos_prefs', 120, 60);
  if p_tipo is null or p_tipo not in ('resposta', 'mencao', 'citacao', 'seguidor', 'chamado', 'nucleo', 'moderacao', 'apoio', 'resumo') then perform interno.erro('invalido:tipo'); end if;
  if p_canal is null or p_canal not in ('site', 'push', 'email') or (p_canal = 'email') <> (p_tipo = 'resumo') then perform interno.erro('invalido:canal'); end if;
  if p_tipo = 'moderacao' and p_canal = 'site' and not coalesce(p_ligado, false) then perform interno.erro('invalido:tipo'); end if;
  if p_canal in ('push', 'email') and coalesce(p_ligado, false) and not interno.rede2_membro(v) then perform interno.erro('consentimento'); end if;
  insert into rede_avisos_prefs (usuario, tipo, canal, ligado) values (v, p_tipo, p_canal, coalesce(p_ligado, false))
  on conflict (usuario, tipo, canal) do update set ligado = excluded.ligado;
  return public.rede_aviso_prefs_ver();
end $$;

-- ── 5. Resumo semanal por e-mail (desligado por padrão) ──────────────────────────────────────────────────────────────

/**
 * O resumo dos avisos não lidos dos últimos 7 dias de uma pessoa: contagens por tipo e, no máximo, 5 títulos de conversas PÚBLICAS
 * (post para a internet, visível, sem link). Nunca o texto de um post, nunca um nome. Nulo quando não há nada. Devolve {assunto, texto, n}.
 */
create or replace function interno.rede3_aviso_resumo(p_usuario uuid) returns jsonb language plpgsql stable security definer set search_path = interno, pg_temp as $$
declare
  r record; v_n integer := 0; v_linhas text := ''; v_titulos text := ''; v_lista text[] := '{}'; v_t text;
begin
  for r in select g.tipo, sum(g.total)::integer as n from interno.rede3_aviso_grupos(p_usuario, now() - interval '7 days') g where not g.lido group by g.tipo order by 2 desc loop
    v_n := v_n + r.n;
    v_linhas := v_linhas || format(E'- %s %s\n', r.n, case coalesce(r.tipo, '')
      when 'resposta' then case when r.n = 1 then 'resposta' else 'respostas' end
      when 'mencao' then case when r.n = 1 then 'menção' else 'menções' end
      when 'citacao' then case when r.n = 1 then 'citação' else 'citações' end
      when 'seguidor' then case when r.n = 1 then 'novo seguidor' else 'novos seguidores' end
      when 'apoio' then case when r.n = 1 then 'apoio' else 'apoios' end
      when 'chamado' then case when r.n = 1 then 'novidade em chamado' else 'novidades em chamados' end
      when 'nucleo' then case when r.n = 1 then 'novidade em núcleo' else 'novidades em núcleos' end
      when 'moderacao' then case when r.n = 1 then 'aviso da moderação' else 'avisos da moderação' end
      else case when r.n = 1 then 'aviso da conta' else 'avisos da conta' end end);
  end loop;
  if v_n = 0 then return null; end if;
  for r in
    select distinct on (g.post) g.post, g.titulo from interno.rede3_aviso_grupos(p_usuario, now() - interval '7 days') g
    join rede_posts p on p.id = g.post
    where not g.lido and g.tipo in ('resposta', 'mencao', 'citacao') and g.titulo is not null
      and interno.rede2_publico(p) = 'internet' and not p.oculto and not p.retido and p.apagado_em is null
    order by g.post limit 5 loop
    v_t := left(interno.sem_link(r.titulo), 80);
    if v_t <> '' then v_lista := v_lista || v_t; end if;
  end loop;
  if cardinality(v_lista) > 0 then
    v_titulos := E'\n\nConversas públicas com novidade:\n' || (select string_agg('- ' || t, E'\n') from unnest(v_lista) t);
  end if;
  return jsonb_build_object('n', v_n, 'assunto', 'Seu resumo da semana na Rede Lúcia',
    'texto', format(E'Nesta semana você teve %s %s na Rede Lúcia:\n%s%s\n\nAbrir os avisos:\n\n%s\n\nVocê recebe este resumo porque ligou, em Avisos → Preferências, a opção "Resumo semanal por e-mail". Ele leva só contagens e títulos de conversas públicas, nunca o texto de um post. Para desligar, entre em Avisos → Preferências.',
      v_n, case when v_n = 1 then 'aviso novo' else 'avisos novos' end, v_linhas, v_titulos, interno.endereco() || '/pt/comunidade/avisos'));
end $$;

/** O que seria enviado no resumo desta semana, para a pessoa conferir antes de ligar (nada é enviado por esta função). */
create or replace function public.rede_aviso_resumo_ver() returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); r jsonb;
begin
  perform interno.limite('rede_resumo_ver', 30, 60);
  r := interno.rede3_aviso_resumo(v);
  return coalesce(r, jsonb_build_object('n', 0));
end $$;

/**
 * A rotina semanal (segunda, 8h de Brasília, no agendador do banco, ou à mão): enfileira o resumo de quem LIGOU a opção, é membro
 * da Rede (18+, com consentimento em vigor), tem e-mail e não recebeu outro nos últimos 6 dias. Quem desligou "e-mails" em Minha
 * conta ('rede_resumo' em emails_desligados) também não recebe. Devolve quantos entraram na fila. Também faz a faxina dos avisos lidos.
 */
create or replace function interno.rede3_aviso_resumo_semanal() returns integer language plpgsql security definer set search_path = interno, pg_temp as $$
declare r record; v_res jsonb; v_n integer := 0; v_email text;
begin
  for r in select f.id from perfis f
           where not f.suspenso and interno.rede3_aviso_pref(f.id, 'resumo', 'email') and exists (select 1 from rede_avisos_prefs p where p.usuario = f.id and p.tipo = 'resumo' and p.canal = 'email' and p.ligado)
           order by f.id limit 2000 loop
    if not interno.rede2_membro(r.id) then continue; end if;
    v_email := lower(coalesce(interno.email_da_conta(r.id), ''));
    if v_email = '' or exists (select 1 from emails e where e.para = v_email and e.tipo = 'rede_resumo' and e.criado_em > now() - interval '6 days') then continue; end if;
    v_res := interno.rede3_aviso_resumo(r.id);
    if v_res is null then continue; end if;
    if interno.email(v_email, 'rede_resumo', v_res ->> 'assunto', v_res ->> 'texto', interno.endereco() || '/pt/comunidade/avisos', 1) then v_n := v_n + 1; end if;
  end loop;
  delete from avisos where categoria = 'rede' and lido and criado_em < now() - interval '120 days';
  return v_n;
end $$;

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule('lucia-rede-resumo', '0 11 * * 1', 'select interno.rede3_aviso_resumo_semanal()');
  end if;
exception when others then null;
end $$;

-- ── 6. Aviso no celular (Web Push) ───────────────────────────────────────────────────────────────────────────────────

/**
 * Liga o aviso no celular neste aparelho: guarda a assinatura que o navegador entregou (endereço do serviço de entrega e as duas
 * chaves). O endereço só vale se for de um serviço de entrega conhecido (Google, Mozilla, Apple, Microsoft): o servidor chama esse
 * endereço, então não aceita um qualquer. Máximo de 5 aparelhos por pessoa. Na primeira vez, liga o celular para resposta, menção,
 * chamado e moderação (a pessoa ajusta em seguida).
 */
create or replace function public.rede_aviso_push_assinar(p_endpoint text, p_p256dh text, p_auth text, p_lang text default 'pt') returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); v_lang text := case when p_lang in ('pt', 'en', 'es', 'fr', 'ru', 'zh') then p_lang else 'pt' end;
begin
  perform interno.aberta('comunidade');
  if not interno.rede2_membro(v) then perform interno.erro('consentimento'); end if;
  perform interno.limite('rede_push', 30, 60);
  if coalesce(p_endpoint, '') !~ '^https://(fcm\.googleapis\.com|android\.googleapis\.com|([a-z0-9-]+\.)*push\.services\.mozilla\.com|([a-z0-9-]+\.)*push\.apple\.com|([a-z0-9-]+\.)*notify\.windows\.com)/[A-Za-z0-9._~:/?#@!$&''()*+,;=%-]+$'
     or char_length(p_endpoint) > 600 then perform interno.erro('invalido:endpoint'); end if;
  if coalesce(p_p256dh, '') !~ '^[A-Za-z0-9_-]{20,120}$' or coalesce(p_auth, '') !~ '^[A-Za-z0-9_-]{10,40}$' then perform interno.erro('invalido:chave'); end if;
  if (select count(*) from rede_push_assinaturas where usuario = v and endpoint <> p_endpoint) >= 5 then perform interno.erro('invalido:aparelhos'); end if;
  insert into rede_push_assinaturas as s (usuario, endpoint, p256dh, auth, lang) values (v, p_endpoint, p_p256dh, p_auth, v_lang)
  on conflict (endpoint) do update set usuario = excluded.usuario, p256dh = excluded.p256dh, auth = excluded.auth, lang = excluded.lang, falhas = 0,
    criado_em = case when s.usuario = excluded.usuario then s.criado_em else now() end;
  if not exists (select 1 from rede_avisos_prefs where usuario = v and canal = 'push') then
    insert into rede_avisos_prefs (usuario, tipo, canal, ligado) select v, t, 'push', true from unnest(array['resposta', 'mencao', 'chamado', 'moderacao']) t on conflict do nothing;
  end if;
  return public.rede_aviso_prefs_ver();
end $$;

/** Desliga o aviso no celular: neste aparelho (p_endpoint) ou em todos (sem endereço). Apaga a assinatura. */
create or replace function public.rede_aviso_push_cancelar(p_endpoint text default null) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); v_n integer;
begin
  delete from rede_push_assinaturas where usuario = v and (p_endpoint is null or endpoint = p_endpoint);
  get diagnostics v_n = row_count;
  return jsonb_build_object('removidos', v_n, 'push_aparelhos', (select count(*)::integer from rede_push_assinaturas where usuario = v));
end $$;

/**
 * Para a função enviar-push (só a chave de serviço): quem deve receber um aviso agora. Por pessoa: tem aviso novo, não lido, do tipo
 * que ela ligou para o celular, depois de ter ligado o aparelho; no máximo um envio a cada 10 minutos. Devolve uma linha por aparelho
 * com o NÚMERO de grupos não lidos (n) e o idioma: nada do texto de nenhum post. Marca os avisos como já empurrados.
 */
create or replace function public.rede_aviso_push_pendentes(p_limite integer default 50) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare r record; s record; v_n integer; v_out jsonb := '[]'::jsonb;
begin
  if not interno.servico() then perform interno.erro('sem_permissao'); end if;
  if not pg_try_advisory_xact_lock(hashtext('rede_push')) then return v_out; end if;
  for r in select distinct a.usuario from rede_push_assinaturas a
           where not exists (select 1 from rede_push_assinaturas t where t.usuario = a.usuario and t.ultimo_envio > now() - interval '10 minutes')
             and exists (select 1 from avisos x where x.para = a.usuario and x.categoria = 'rede' and x.tipo is not null and not x.lido and not x.empurrado
                         and x.criado_em > a.criado_em and interno.rede3_aviso_pref(x.para, x.tipo, 'push'))
           limit greatest(1, least(coalesce(p_limite, 50), 200)) loop
    update avisos set empurrado = true
     where para = r.usuario and categoria = 'rede' and tipo is not null and not lido and not empurrado and interno.rede3_aviso_pref(para, tipo, 'push');
    if not exists (select 1 from perfis f where f.id = r.usuario and not f.suspenso) or not interno.rede2_membro(r.usuario) then continue; end if;
    select count(*)::integer into v_n from interno.rede3_aviso_grupos(r.usuario) g where not g.lido;
    if v_n = 0 then continue; end if;
    for s in select * from rede_push_assinaturas where usuario = r.usuario loop
      v_out := v_out || jsonb_build_object('id', s.id, 'endpoint', s.endpoint, 'p256dh', s.p256dh, 'auth', s.auth, 'lang', s.lang, 'n', least(v_n, 99));
    end loop;
    update rede_push_assinaturas set ultimo_envio = now() where usuario = r.usuario;
  end loop;
  return v_out;
end $$;

/** Para a função enviar-push: o resultado de cada entrega. Aparelho que o serviço diz que não existe mais (404/410) é apagado; falha repetida também. */
create or replace function public.rede_aviso_push_resultado(p_id uuid, p_ok boolean, p_gone boolean default false) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
begin
  if not interno.servico() then perform interno.erro('sem_permissao'); end if;
  if coalesce(p_gone, false) then
    delete from rede_push_assinaturas where id = p_id;
  elsif coalesce(p_ok, false) then
    update rede_push_assinaturas set falhas = 0 where id = p_id;
  else
    update rede_push_assinaturas set falhas = falhas + 1 where id = p_id;
    delete from rede_push_assinaturas where id = p_id and falhas >= 5;
  end if;
  return jsonb_build_object('ok', true);
end $$;

/**
 * Chama a função enviar-push (pg_net), como interno.emails_disparar faz com os e-mails. Só dispara se há aparelho, aviso novo e a
 * configuração existe: interno.configuracoes, chave 'push' = {"funcao": "https://<projeto>.supabase.co/functions/v1/enviar-push",
 * "chave_publica": "<anon key>", "segredo": "<o mesmo de PUSH_SEGREDO>"}. Sem a linha, nada acontece (passo a passo em docs/rede/AVISOS.md).
 */
create or replace function interno.rede3_push_disparar() returns void language plpgsql security definer set search_path = interno, pg_temp as $$
declare
  v_url text := (select valor ->> 'funcao' from configuracoes where chave = 'push');
  v_chave text := coalesce((select valor ->> 'chave_publica' from configuracoes where chave = 'push'), '');
  v_segredo text := coalesce((select valor ->> 'segredo' from configuracoes where chave = 'push'), '');
begin
  if coalesce(v_url, '') !~ '^https://[a-z0-9.-]+/functions/v1/enviar-push$' then return; end if;
  if not exists (select 1 from rede_push_assinaturas) then return; end if;
  if not exists (select 1 from avisos a where not a.lido and not a.empurrado and a.categoria = 'rede' and a.tipo is not null and a.criado_em > now() - interval '2 days') then return; end if;
  execute 'select net.http_post(url := $1, body := ''{}''::jsonb, headers := $2, timeout_milliseconds := 30000)'
    using v_url, jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || v_chave, 'apikey', v_chave, 'x-lucia-segredo', v_segredo);
end $$;

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') and exists (select 1 from pg_extension where extname = 'pg_net') then
    perform cron.schedule('lucia-rede-push', '*/2 * * * *', 'select interno.rede3_push_disparar()');
  end if;
exception when others then null;
end $$;

-- ── 7. Permissões ───────────────────────────────────────────────────────────────────────────────────────────────────────
-- Nenhuma função interna é chamável de fora. As públicas pedem conta (a própria função confere a sessão); as duas da função
-- enviar-push só respondem à chave de serviço.
revoke all on function interno.rede3_aviso_chave(text, uuid, uuid), interno.rede3_aviso_pref(uuid, text, text),
  interno.rede3_aviso_criar(uuid, text, uuid, uuid, uuid, text), interno.rede3_aviso_antes(), interno.rede3_aviso_apoio(),
  interno.rede3_aviso_grupos(uuid, timestamptz), interno.rede3_aviso_resumo(uuid), interno.rede3_aviso_resumo_semanal(),
  interno.rede3_push_disparar() from public;
revoke all on function public.rede_aviso_listar(text, integer), public.rede_aviso_contar(), public.rede_aviso_ler(uuid), public.rede_aviso_prefs_ver(),
  public.rede_aviso_prefs_salvar(text, text, boolean), public.rede_aviso_resumo_ver(), public.rede_aviso_push_assinar(text, text, text, text),
  public.rede_aviso_push_cancelar(text), public.rede_aviso_push_pendentes(integer), public.rede_aviso_push_resultado(uuid, boolean, boolean) from public;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on function interno.rede3_aviso_chave(text, uuid, uuid), interno.rede3_aviso_pref(uuid, text, text),
      interno.rede3_aviso_criar(uuid, text, uuid, uuid, uuid, text), interno.rede3_aviso_antes(), interno.rede3_aviso_apoio(),
      interno.rede3_aviso_grupos(uuid, timestamptz), interno.rede3_aviso_resumo(uuid), interno.rede3_aviso_resumo_semanal(),
      interno.rede3_push_disparar() from anon, authenticated;
    revoke all on function public.rede_aviso_listar(text, integer), public.rede_aviso_contar(), public.rede_aviso_ler(uuid), public.rede_aviso_prefs_ver(),
      public.rede_aviso_prefs_salvar(text, text, boolean), public.rede_aviso_resumo_ver(), public.rede_aviso_push_assinar(text, text, text, text),
      public.rede_aviso_push_cancelar(text), public.rede_aviso_push_pendentes(integer), public.rede_aviso_push_resultado(uuid, boolean, boolean) from anon, authenticated;
    grant execute on function public.rede_aviso_listar(text, integer), public.rede_aviso_contar(), public.rede_aviso_ler(uuid), public.rede_aviso_prefs_ver(),
      public.rede_aviso_prefs_salvar(text, text, boolean), public.rede_aviso_resumo_ver(), public.rede_aviso_push_assinar(text, text, text, text),
      public.rede_aviso_push_cancelar(text) to authenticated, service_role;
    grant execute on function public.rede_aviso_push_pendentes(integer), public.rede_aviso_push_resultado(uuid, boolean, boolean) to service_role;
  end if;
end $$;
