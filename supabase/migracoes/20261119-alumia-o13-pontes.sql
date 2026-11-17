-- ───────────────────────────── Alumia, onda 13: pontes ─────────────────────────────
-- Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
--
-- Frente 13E. O que liga a Alumia a outros lugares, sem abrir mão das regras dela:
--
--   1. TRADUZIR UM POST (atrás de "alumia-traducao", desligado): só quando a pessoa toca em "Traduzir", e só por um servidor de
--      tradução PRÓPRIO, cujo endereço fica numa variável do servidor do site (app/api/rede/traduzir). O banco só entrega o texto
--      de um post que a pessoa já pode ver, com limite de uso; nada da tradução é guardado.
--   2. RESUMO DAS COMUNIDADES (opcional): uma vez por semana, por e-mail, só os TÍTULOS dos posts públicos (os que podem sair da
--      Alumia, interno.alumia_alc_sai, e que a pessoa vê) das comunidades abertas que a pessoa escolheu. Pela rotina de e-mails de sempre (interno.email → interno.emails →
--      enviar-emails), no endereço da própria conta, sem link no meio do texto (interno.sem_link) e no máximo um a cada 6 dias.
--   3. ROBÔS IDENTIFICADOS: uma organização cria contas de robô que publicam pela API (app/api/rede/robos). O rótulo "robô" é da
--      conta e não se tira: toda resposta que leva o autor diz que é robô e de qual organização. A chave de API nasce no servidor
--      do site, aparece uma vez para quem gerencia, e o banco guarda só o resumo (SHA-256). Limite de 12 posts por hora e 60 por
--      dia por robô. Organização com selo liga o robô na hora; sem selo, a coordenação aprova antes.
--   4. PUBLICAR JUNTO NO TELEGRAM (atrás de "alumia-telegram", desligado): só organização com selo liga o PRÓPRIO canal. Sai só
--      post da organização que pode sair da Alumia pela mesma regra do RSS (interno.alumia_alc_sai), dez minutos depois de
--      publicado (o que foi apagado, retido ou mudou de público nesse meio-tempo não sai). O token do robô do Telegram é segredo do servidor do site;
--      o banco guarda só o nome público do canal. Cinco falhas seguidas desligam sozinho.
--   5. MURAL DOS TRABALHADORES: chamados de greve, paralisação, assembleia, campanha, solidariedade e trabalho coletivo das
--      organizações COM SELO, que vencem sozinhos (no máximo 90 dias). Só quem fala pela organização publica.
--
-- Com a trava da entrada ligada ou "alumia-org" desligado no painel, nem o resumo semanal, nem o robô, nem o Telegram andam
-- (interno.alumia_pontes_painel).
--
-- Nenhum endereço de rede é guardado. Nenhuma função devolve lista de pessoas: o robô é conta de organização, o mural é da
-- organização, o resumo é de cada pessoa só para ela. Tudo em interno, com RLS e sem política; o acesso é só por funções security
-- definer com search_path fixo. As de membro passam pela porta da entrada (interno.alumia_trancar, no fim); as do servidor (as
-- "rede_pontes_*") são só da chave de serviço. Nenhuma função recebe parâmetro do tipo linha de tabela.
--
-- Leis: LGPD (Lei 13.709/2018) art. 6º, III (necessidade: a tradução não guarda nada; do robô, só o resumo da chave; do Telegram,
-- só o nome do canal); art. 7º, I e art. 8º (o resumo por e-mail só para quem ligou, e para na hora em que desliga); art. 11
-- (filiação e opinião política são dado sensível: nada aqui diz quem leu, quem pediu o resumo ou quem escreveu pelo robô). Marco
-- Civil da Internet (Lei 12.965/2014) art. 7º, VII (nada vai a terceiros sem a pessoa pedir: a tradução é por servidor próprio e
-- só no toque; o Telegram só leva o que a organização já publicou para a internet). ECA Digital (Lei 15.211/2025): toda ação de
-- pessoa exige ser membro da Alumia (18+ com consentimento).
--
-- Pode rodar mais de uma vez, sem apagar dado nenhum. Roda DEPOIS de 20261118-alumia-onda12-fim.sql.
-- Teste: scripts/testar-alumia-o13-pontes.mjs.

-- ── 1. Os interruptores no catálogo ───────────────────────────────────────────────────────────────────────────────────────
-- "alumia-traducao" e "alumia-telegram": só pelo nome, como os outros da Alumia (lib/recursos.ts, pela junção). No banco, a
-- tradução e o Telegram só valem com o recurso ligado no painel (interno.alumia_pontes_ligado).
do $$
begin
  if to_regclass('interno.recursos_catalogo') is not null then
    insert into interno.recursos_catalogo (nome, so_pelo_nome) values ('alumia-traducao', true), ('alumia-telegram', true)
    on conflict (nome) do update set so_pelo_nome = true;
  end if;
end $$;

-- ── 2. Tabelas ────────────────────────────────────────────────────────────────────────────────────────────────────────────

-- O resumo das comunidades: quem ligou e quais comunidades (até 10). Nunca sai do banco como lista.
create table if not exists interno.rede_pontes_resumo (
  usuario uuid primary key references interno.perfis (id) on delete cascade,
  ligado boolean not null default false,
  comunidades text[] not null default '{}' check (cardinality(comunidades) <= 10),
  desde date not null default current_date
);
alter table interno.rede_pontes_resumo enable row level security;

-- Os robôs. `perfil` é a conta do robô (sem senha, criada pelo servidor do site); `org` é a dona. `resumo` é o SHA-256 da chave
-- de API (a chave nunca passa pelo banco). Sem quem criou: o robô é da organização.
create table if not exists interno.rede_pontes_robos (
  id uuid primary key default gen_random_uuid(),
  org uuid not null references interno.rede_orgs (perfil) on delete cascade,
  perfil uuid unique references interno.perfis (id) on delete cascade,
  nome text not null check (char_length(btrim(nome)) between 3 and 40),
  descricao text not null check (char_length(btrim(descricao)) between 10 and 300),
  situacao text not null default 'criando' check (situacao in ('criando', 'esperando', 'ativo', 'recusado', 'desligado')),
  resumo text unique check (resumo is null or resumo ~ '^[0-9a-f]{64}$'),
  chave_dia date,
  criado_em timestamptz not null default now(),
  decidido_dia date,
  usado_dia date
);
create index if not exists rede_pontes_robos_org on interno.rede_pontes_robos (org);
alter table interno.rede_pontes_robos enable row level security;

-- Os posts de cada robô, para o limite (12 por hora, 60 por dia). Some em 2 dias.
create table if not exists interno.rede_pontes_robo_uso (
  robo uuid not null references interno.rede_pontes_robos (id) on delete cascade,
  quando timestamptz not null default now()
);
create index if not exists rede_pontes_robo_uso_robo on interno.rede_pontes_robo_uso (robo, quando desc);
alter table interno.rede_pontes_robo_uso enable row level security;

-- O canal do Telegram de cada organização: só o nome público (@canal) ou o número do canal. Nenhum token.
create table if not exists interno.rede_pontes_telegram (
  org uuid primary key references interno.rede_orgs (perfil) on delete cascade,
  canal text not null check (canal ~ '^(@[A-Za-z][A-Za-z0-9_]{4,31}|-100[0-9]{6,15})$'),
  ligado boolean not null default false,
  ligado_em timestamptz,
  falhas smallint not null default 0 check (falhas between 0 and 100),
  motivo text not null default '' check (motivo in ('', 'falhas')),
  enviado_dia date
);
alter table interno.rede_pontes_telegram enable row level security;

-- O que já saiu (ou está saindo) para o Telegram: um post sai uma vez só. Some em 30 dias.
create table if not exists interno.rede_pontes_telegram_envios (
  post uuid primary key references interno.rede_posts (id) on delete cascade,
  org uuid not null references interno.rede_orgs (perfil) on delete cascade,
  situacao text not null default 'saindo' check (situacao in ('saindo', 'saiu', 'falhou')),
  quando timestamptz not null default now()
);
alter table interno.rede_pontes_telegram_envios enable row level security;

-- O Mural dos Trabalhadores: os chamados das organizações com selo. Sem quem escreveu.
create table if not exists interno.rede_trabalhadores_chamados (
  id uuid primary key default gen_random_uuid(),
  org uuid not null references interno.rede_orgs (perfil) on delete cascade,
  tipo text not null check (tipo in ('greve', 'paralisacao', 'assembleia', 'campanha', 'solidariedade', 'trabalho')),
  categoria text not null check (char_length(btrim(categoria)) between 2 and 60),
  titulo text not null check (char_length(btrim(titulo)) between 4 and 90),
  texto text not null check (char_length(btrim(texto)) between 10 and 600),
  cidade text not null default '' check (char_length(cidade) <= 60),
  quando date,
  ate date not null,
  encerrado boolean not null default false,
  criado_em timestamptz not null default now()
);
create index if not exists rede_trabalhadores_chamados_ate on interno.rede_trabalhadores_chamados (ate desc);
create index if not exists rede_trabalhadores_chamados_org on interno.rede_trabalhadores_chamados (org);
alter table interno.rede_trabalhadores_chamados enable row level security;

-- Nenhuma permissão direta nas tabelas novas.
do $$
declare t text;
begin
  foreach t in array array['rede_pontes_resumo', 'rede_pontes_robos', 'rede_pontes_robo_uso', 'rede_pontes_telegram', 'rede_pontes_telegram_envios', 'rede_trabalhadores_chamados'] loop
    execute format('revoke all on table interno.%I from public', t);
    if exists (select 1 from pg_roles where rolname = 'anon') then
      execute format('revoke all on table interno.%I from anon, authenticated', t);
    end if;
  end loop;
end $$;

-- ── 3. Ajudas internas ────────────────────────────────────────────────────────────────────────────────────────────────────

/** O recurso está ligado no painel (e a Alumia nova também)? Sem a tabela dos recursos vivos, desligado. */
create or replace function interno.alumia_pontes_ligado(p_nome text) returns boolean language plpgsql stable security definer set search_path = interno, pg_temp as $$
begin
  if to_regclass('interno.recursos_vivos') is null then return false; end if;
  if exists (select 1 from recursos_vivos where nome in ('rede-v2', 'alumia-2') and not ligado) then return false; end if;
  return coalesce((select ligado from recursos_vivos where nome = p_nome), false);
end $$;

/**
 * A coordenação NÃO desligou no painel este recurso (nem a Alumia nova)? Para o que vem com as organizações ("alumia-org"): a
 * variável de montagem do site só mostra ou esconde a tela, e sem decisão no painel vale a montagem, que o banco não vê.
 */
create or replace function interno.alumia_pontes_painel(p_nome text) returns boolean language plpgsql stable security definer set search_path = interno, pg_temp as $$
begin
  if to_regclass('interno.recursos_vivos') is null then return true; end if;
  return not exists (select 1 from recursos_vivos where nome in ('rede-v2', 'alumia-2', p_nome) and not ligado);
end $$;

/** A organização tem selo (verificada) e a conta dela não está suspensa? */
create or replace function interno.alumia_pontes_selo(p_org uuid) returns boolean language sql stable security definer set search_path = interno, pg_temp as $$
  select exists (select 1 from rede_orgs o join perfis f on f.id = o.perfil where o.perfil = p_org and o.verificada_em is not null and not f.suspenso)
$$;

/** `p_quem` fala pela organização: gerencia ou tem a permissão "avisos" (a mesma regra da comunicação da onda 12). */
create or replace function interno.alumia_pontes_fala(p_quem uuid, p_org uuid) returns boolean language sql stable security definer set search_path = interno, pg_temp as $$
  select p_quem is not null and (coalesce(interno.alumia_org_gere(p_quem, p_org), false) or coalesce(interno.alumia_org_funcao_tem(p_quem, p_org, 'avisos'), false))
$$;

/** A organização pelo @, para quem a gerencia (membro da Alumia, sem bloqueio, com o limite de uso). Senão, "sem_permissao". */
create or replace function interno.alumia_pontes_org_gerida(p_handle text, p_acao text, p_max integer, p_min integer) returns uuid language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); o uuid;
begin
  if v is null then perform interno.erro('entre_primeiro'); end if;
  if not interno.rede2_membro(v) then perform interno.erro('consentimento'); end if;
  o := interno.alumia_org_de(p_handle);
  if o is null or interno.rede_bloqueado(v, o) or not coalesce(interno.alumia_org_gere(v, o), false) then perform interno.erro('sem_permissao'); end if;
  perform interno.limite(p_acao, p_max, p_min);
  return o;
end $$;

/** O robô como quem gerencia vê: nunca a chave, só se ela existe e o dia em que nasceu. */
create or replace function interno.alumia_pontes_robo_json(p_id uuid) returns jsonb language sql stable security definer set search_path = interno, pg_temp as $$
  select jsonb_build_object('id', r.id, 'nome', r.nome, 'descricao', r.descricao, 'situacao', r.situacao, 'handle', f.rede_handle,
    'temChave', r.resumo is not null, 'chaveDia', r.chave_dia, 'criadoDia', (r.criado_em at time zone 'America/Sao_Paulo')::date,
    'usadoDia', r.usado_dia, 'hoje', (select count(*)::integer from rede_pontes_robo_uso u where u.robo = r.id and u.quando > now() - interval '1 day'))
  from rede_pontes_robos r left join perfis f on f.id = r.perfil where r.id = p_id
$$;

/** Um chamado do mural como a tela recebe (a organização é pública; quem escreveu não existe na tabela). */
create or replace function interno.alumia_trabalhadores_json(p_id uuid, p_quem uuid) returns jsonb language sql stable security definer set search_path = interno, pg_temp as $$
  select jsonb_build_object('id', c.id, 'tipo', c.tipo, 'categoria', c.categoria, 'titulo', c.titulo, 'texto', c.texto, 'cidade', nullif(c.cidade, ''),
    'quando', c.quando, 'ate', c.ate, 'encerrado', c.encerrado or c.ate < (now() at time zone 'America/Sao_Paulo')::date,
    'org', jsonb_build_object('handle', f.rede_handle, 'nome', coalesce(f.rede_codinome, f.nome), 'palavra', o.palavra, 'tipo', o.tipo),
    'posso', interno.alumia_pontes_fala(p_quem, c.org))
  from rede_trabalhadores_chamados c join rede_orgs o on o.perfil = c.org join perfis f on f.id = c.org where c.id = p_id
$$;

/**
 * A regra do que é "público" aqui é a de sair da Alumia (interno.alumia_alc_sai, frente 13C): o público de fato, a vida do post, o
 * que um visitante vê, comunidade aberta, conta à vista e nada com a trava. A regra própria, que olhava só o público escolhido, saiu.
 */
drop function if exists interno.alumia_pontes_aberto(text, text, text);

/** O título que vai no resumo: só o título da discussão, sem link e sem quebra de linha (o post sem título não entra). */
create or replace function interno.alumia_pontes_titulo(p_titulo text) returns text language sql stable security definer set search_path = interno, pg_temp as $$
  select nullif(left(btrim(regexp_replace(interno.sem_link(coalesce(p_titulo, '')), '\s+', ' ', 'g')), 90), '')
$$;

/**
 * O resumo das comunidades de uma pessoa: os títulos públicos dos últimos 7 dias. Público é o que pode sair da Alumia
 * (interno.alumia_alc_sai: público de fato, nada arquivado, não listado, com prazo ou na roda, nada com a trava) e que a própria
 * pessoa vê (interno.rede_ve). Nulo quando não há nada novo.
 */
create or replace function interno.alumia_pontes_resumo_texto(p_usuario uuid) returns jsonb language plpgsql stable security definer set search_path = interno, pg_temp as $$
declare v_escolhidas text[]; c record; t record; v_corpo text := ''; v_n integer := 0; v_um integer; v_curtos integer;
begin
  select comunidades into v_escolhidas from rede_pontes_resumo where usuario = p_usuario and ligado;
  if v_escolhidas is null or cardinality(v_escolhidas) = 0 then return null; end if;
  for c in select m.slug, m.nome from rede_comunidades m where m.slug = any (v_escolhidas) and m.tipo = 'aberta' order by m.nome loop
    v_um := 0;
    for t in
      select interno.alumia_pontes_titulo(p.titulo) as t from rede_posts p
      where p.comunidade = c.slug and p.resposta_a is null and p.criado_em > now() - interval '7 days'
        and p.apagado_em is null and interno.alumia_alc_sai(p) and interno.rede_ve(p, p_usuario)
        and interno.alumia_pontes_titulo(p.titulo) is not null and not interno.rede_bloqueado(p_usuario, p.autor)
      order by p.criado_em desc limit 5 loop
      if v_um = 0 then v_corpo := v_corpo || E'\n' || c.nome || E'\n'; end if;
      v_corpo := v_corpo || '- ' || t.t || E'\n';
      v_um := v_um + 1;
    end loop;
    v_n := v_n + v_um;
    -- Os posts curtos (sem título) só como número, e só a partir de 3.
    select count(*)::integer into v_curtos from rede_posts p
     where p.comunidade = c.slug and p.resposta_a is null and p.criado_em > now() - interval '7 days'
       and p.apagado_em is null and interno.alumia_alc_sai(p) and interno.rede_ve(p, p_usuario) and interno.alumia_pontes_titulo(p.titulo) is null
       and not interno.rede_bloqueado(p_usuario, p.autor);
    if v_curtos >= 3 then
      if v_um = 0 then v_corpo := v_corpo || E'\n' || c.nome || E'\n'; end if;
      v_corpo := v_corpo || format(E'- e mais %s posts curtos\n', v_curtos);
      v_n := v_n + 1;
    end if;
  end loop;
  if v_n = 0 then return null; end if;
  return jsonb_build_object('assunto', 'O resumo das suas comunidades na Alumia',
    'texto', format(E'Os títulos públicos da semana nas comunidades que você escolheu:\n%s\nAbrir a Alumia:\n\n%s\n\nVocê recebe este resumo porque ligou, em Ajustes → Pontes, a opção "Resumo das comunidades". Ele leva só títulos de posts públicos, nunca o texto deles, nem quem escreveu. Para desligar, entre em Ajustes → Pontes.',
      v_corpo, interno.endereco() || '/pt/alumia'));
end $$;

-- ── 4. Resumo das comunidades ─────────────────────────────────────────────────────────────────────────────────────────────

/** O que a pessoa escolheu e as comunidades abertas em que ela está (para escolher). Só dela. */
create or replace function public.alumia_pontes_resumo_ver() returns jsonb language plpgsql stable security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); r rede_pontes_resumo;
begin
  if v is null then perform interno.erro('entre_primeiro'); end if;
  select * into r from rede_pontes_resumo where usuario = v;
  return jsonb_build_object('ligado', coalesce(r.ligado, false), 'escolhidas', to_jsonb(coalesce(r.comunidades, '{}'::text[])),
    'opcoes', coalesce((select jsonb_agg(jsonb_build_object('slug', c.slug, 'nome', c.nome) order by c.nome)
      from rede_comunidades c where c.tipo = 'aberta'
        and (exists (select 1 from rede_comunidade_membros m where m.comunidade = c.slug and m.usuario = v and m.situacao = 'ativo') or c.slug = any (coalesce(r.comunidades, '{}')))), '[]'::jsonb));
end $$;

/** Liga ou desliga o resumo e escolhe até 10 comunidades abertas. Desligar apaga a escolha (LGPD art. 18, IX). */
create or replace function public.alumia_pontes_resumo_salvar(p_ligado boolean, p_comunidades text[]) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); v_lista text[];
begin
  if v is null then perform interno.erro('entre_primeiro'); end if;
  if not interno.rede2_membro(v) then perform interno.erro('consentimento'); end if;
  perform interno.limite('alumia_pontes_resumo', 30, 60);
  if not coalesce(p_ligado, false) then
    delete from rede_pontes_resumo where usuario = v;
    return public.alumia_pontes_resumo_ver();
  end if;
  select coalesce(array_agg(distinct s), '{}') into v_lista from unnest(coalesce(p_comunidades, '{}')) s where s is not null;
  if cardinality(v_lista) = 0 then perform interno.erro('invalido:comunidades'); end if;
  if cardinality(v_lista) > 10 then perform interno.erro('limite'); end if;
  if exists (select 1 from unnest(v_lista) s where not exists (select 1 from rede_comunidades c where c.slug = s and c.tipo = 'aberta')) then
    perform interno.erro('invalido:comunidades');
  end if;
  insert into rede_pontes_resumo (usuario, ligado, comunidades) values (v, true, v_lista)
  on conflict (usuario) do update set ligado = true, comunidades = excluded.comunidades;
  return public.alumia_pontes_resumo_ver();
end $$;

/** "Ver o que seria enviado agora": o texto do resumo, sem enviar. Nulo quando não há título novo. */
create or replace function public.alumia_pontes_resumo_previa() returns jsonb language plpgsql stable security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu();
begin
  if v is null then perform interno.erro('entre_primeiro'); end if;
  return interno.alumia_pontes_resumo_texto(v);
end $$;

/** A rotina da semana (pg_cron, segunda): um e-mail por pessoa que ligou, no endereço da própria conta, no máximo um a cada 6 dias. */
create or replace function interno.alumia_pontes_resumo_semanal() returns integer language plpgsql security definer set search_path = interno, pg_temp as $$
declare r record; v_res jsonb; v_n integer := 0; v_email text;
begin
  if interno.alumia_exigida() or not interno.alumia_pontes_painel('alumia-org') then return 0; end if;
  for r in select s.usuario from rede_pontes_resumo s join perfis f on f.id = s.usuario where s.ligado and not f.suspenso order by s.usuario limit 5000 loop
    if not interno.rede2_membro(r.usuario) then continue; end if;
    v_email := lower(coalesce(interno.email_da_conta(r.usuario), ''));
    if v_email = '' or exists (select 1 from emails e where e.para = v_email and e.tipo = 'rede_comunidades' and e.criado_em > now() - interval '6 days') then continue; end if;
    v_res := interno.alumia_pontes_resumo_texto(r.usuario);
    if v_res is null then continue; end if;
    if interno.email(v_email, 'rede_comunidades', v_res ->> 'assunto', v_res ->> 'texto', interno.endereco() || '/pt/alumia/seguranca', 1) then v_n := v_n + 1; end if;
  end loop;
  return v_n;
end $$;

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule('lucia-rede-comunidades', '30 11 * * 1', 'select interno.alumia_pontes_resumo_semanal()');
  end if;
exception when others then null;
end $$;

-- ── 5. Tradução ───────────────────────────────────────────────────────────────────────────────────────────────────────────

/**
 * O texto de um post para o servidor do site traduzir, só para quem já pode ver o post, só com "alumia-traducao" ligado e no
 * máximo 60 por hora. Nada é guardado: nem o pedido, nem a tradução.
 */
create or replace function public.alumia_pontes_traduzir_texto(p_post uuid) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); x rede_posts;
begin
  if not interno.alumia_pontes_ligado('alumia-traducao') then perform interno.erro('desligado'); end if;
  if v is null then perform interno.erro('entre_primeiro'); end if;
  perform interno.limite('alumia_pontes_traduzir', 60, 60);
  select * into x from rede_posts where id = p_post;
  if not found or not interno.rede_ve(x, v) then perform interno.erro('nao_encontrado'); end if;
  return jsonb_build_object('titulo', x.titulo, 'texto', left(coalesce(nullif(x.corpo, ''), x.texto), 5000));
end $$;

-- ── 6. Robôs ──────────────────────────────────────────────────────────────────────────────────────────────────────────────

/** As organizações que a pessoa gerencia ou pelas quais fala (só as dela), e se é da coordenação. */
create or replace function public.alumia_pontes_eu() returns jsonb language plpgsql stable security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu();
begin
  if v is null then perform interno.erro('entre_primeiro'); end if;
  return jsonb_build_object('coordenacao', coalesce(interno.coord(), false),
    'telegram', interno.alumia_pontes_ligado('alumia-telegram'),
    'orgs', coalesce((select jsonb_agg(jsonb_build_object('handle', f.rede_handle, 'nome', coalesce(f.rede_codinome, f.nome), 'palavra', o.palavra,
        'selo', interno.alumia_pontes_selo(o.perfil), 'gerencio', coalesce(interno.alumia_org_gere(v, o.perfil), false)) order by coalesce(f.rede_codinome, f.nome))
      from rede_orgs o join perfis f on f.id = o.perfil
      where not f.suspenso and f.rede_handle is not null and interno.alumia_pontes_fala(v, o.perfil)), '[]'::jsonb));
end $$;

/** Os robôs e o canal do Telegram de uma organização, para quem a gerencia. */
create or replace function public.alumia_pontes_org(p_handle text) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare o uuid := interno.alumia_pontes_org_gerida(p_handle, 'alumia_pontes_ler', 120, 60); t rede_pontes_telegram;
begin
  select * into t from rede_pontes_telegram where org = o;
  return jsonb_build_object('selo', interno.alumia_pontes_selo(o),
    'robos', coalesce((select jsonb_agg(interno.alumia_pontes_robo_json(r.id) order by r.criado_em) from rede_pontes_robos r where r.org = o and r.situacao <> 'criando'), '[]'::jsonb),
    'telegram', case when t.org is null then null else jsonb_build_object('canal', t.canal, 'ligado', t.ligado, 'motivo', nullif(t.motivo, ''), 'enviadoDia', t.enviado_dia) end);
end $$;

/**
 * O primeiro passo de criar um robô (o servidor do site chama COMO a pessoa, antes de criar a conta): só quem gerencia, no máximo
 * 3 robôs que não estejam desligados ou recusados por organização. Devolve o id do pedido; a conta vem em rede_pontes_robo_ligar.
 */
create or replace function public.alumia_pontes_robo_pedir(p_handle text, p_nome text, p_descricao text) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare o uuid := interno.alumia_pontes_org_gerida(p_handle, 'alumia_pontes_robo', 6, 60); v_id uuid; v_nome text := btrim(coalesce(p_nome, '')); v_desc text := btrim(coalesce(p_descricao, ''));
begin
  if char_length(v_nome) not between 3 and 40 or v_nome ~ '[@\n\r]' then perform interno.erro('invalido:nome'); end if;
  if char_length(v_desc) not between 10 and 300 then perform interno.erro('invalido:descricao'); end if;
  if interno.rede3_pub_dado_pessoal(v_nome || ' ' || v_desc) then perform interno.erro('dado_pessoal'); end if;
  delete from rede_pontes_robos where org = o and situacao = 'criando' and criado_em < now() - interval '1 hour';
  if (select count(*) from rede_pontes_robos where org = o and situacao in ('criando', 'esperando', 'ativo')) >= 3 then perform interno.erro('limite'); end if;
  insert into rede_pontes_robos (org, nome, descricao) values (o, v_nome, v_desc) returning id into v_id;
  return jsonb_build_object('id', v_id, 'nome', v_nome);
end $$;

/**
 * Só a chave de serviço: liga a conta recém-criada (sem senha) ao pedido. O robô ganha o @ "robo_<8 letras>" e o codinome que a
 * organização deu. Com selo, nasce ativo; sem selo, espera a coordenação (que é avisada).
 */
create or replace function public.rede_pontes_robo_ligar(p_robo uuid, p_perfil uuid) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare r rede_pontes_robos; v_selo boolean;
begin
  select * into r from rede_pontes_robos where id = p_robo and situacao = 'criando' and perfil is null for update;
  if not found then perform interno.erro('nao_encontrado'); end if;
  if not exists (select 1 from perfis where id = p_perfil) or exists (select 1 from rede_pontes_robos where perfil = p_perfil)
     or exists (select 1 from rede_orgs where perfil = p_perfil) then perform interno.erro('invalido:perfil'); end if;
  v_selo := interno.alumia_pontes_selo(r.org);
  update perfis set rede_codinome = r.nome, rede_codinome_ok = true, rede_handle = 'robo_' || left(replace(r.id::text, '-', ''), 8) where id = p_perfil;
  update rede_pontes_robos set perfil = p_perfil, situacao = case when v_selo then 'ativo' else 'esperando' end,
         decidido_dia = case when v_selo then current_date end where id = p_robo;
  if not v_selo then
    perform interno.avisar(p.usuario, 'Uma organização sem selo pediu uma conta de robô na Alumia. A decisão fica em Pontes.')
    from (select distinct usuario from papeis where papel = 'coordenacao') p;
  end if;
  return interno.alumia_pontes_robo_json(p_robo);
end $$;

/** Só a chave de serviço: desfaz um pedido que não virou conta (a conta não foi criada). */
create or replace function public.rede_pontes_robo_desfazer(p_robo uuid) returns void language sql security definer set search_path = interno, pg_temp as $$
  delete from rede_pontes_robos where id = p_robo and situacao = 'criando' and perfil is null
$$;

/** Guarda o resumo de uma chave nova (a chave antiga para de valer na hora). Só quem gerencia, só robô ativo. */
create or replace function public.alumia_pontes_robo_chave(p_robo uuid, p_resumo text) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare r rede_pontes_robos;
begin
  if coalesce(p_resumo, '') !~ '^[0-9a-f]{64}$' then perform interno.erro('invalido:chave'); end if;
  select * into r from rede_pontes_robos where id = p_robo;
  if not found or r.situacao = 'criando' then perform interno.erro('nao_encontrado'); end if;
  perform interno.alumia_pontes_org_gerida((select rede_handle from perfis where id = r.org), 'alumia_pontes_chave', 10, 60);
  if r.situacao <> 'ativo' then perform interno.erro('robo_parado'); end if;
  update rede_pontes_robos set resumo = p_resumo, chave_dia = current_date where id = p_robo;
  return interno.alumia_pontes_robo_json(p_robo);
end $$;

/** Desliga um robô de vez (a chave some; os posts ficam, com o rótulo). Quem gerencia ou a coordenação. */
create or replace function public.alumia_pontes_robo_desligar(p_robo uuid) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare r rede_pontes_robos; v uuid := interno.eu();
begin
  if v is null then perform interno.erro('entre_primeiro'); end if;
  select * into r from rede_pontes_robos where id = p_robo;
  if not found or r.situacao = 'criando' then perform interno.erro('nao_encontrado'); end if;
  if not (coalesce(interno.alumia_org_gere(v, r.org), false) or coalesce(interno.coord(), false)) then perform interno.erro('nao_encontrado'); end if;
  update rede_pontes_robos set situacao = 'desligado', resumo = null, decidido_dia = current_date where id = p_robo;
  return interno.alumia_pontes_robo_json(p_robo);
end $$;

/** A fila da coordenação: robôs de organização sem selo que esperam. A organização é pública; ninguém de dentro dela aparece. */
create or replace function public.alumia_pontes_robos_fila() returns jsonb language plpgsql stable security definer set search_path = interno, pg_temp as $$
begin
  if not coalesce(interno.coord(), false) then perform interno.erro('sem_permissao'); end if;
  return coalesce((select jsonb_agg(interno.alumia_pontes_robo_json(r.id) || jsonb_build_object('org', jsonb_build_object('handle', f.rede_handle, 'nome', coalesce(f.rede_codinome, f.nome)))
    order by r.criado_em) from rede_pontes_robos r join perfis f on f.id = r.org where r.situacao = 'esperando'), '[]'::jsonb);
end $$;

/** A coordenação decide o robô de uma organização sem selo. */
create or replace function public.alumia_pontes_robo_decidir(p_robo uuid, p_aprovar boolean) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
begin
  if not coalesce(interno.coord(), false) then perform interno.erro('sem_permissao'); end if;
  update rede_pontes_robos set situacao = case when coalesce(p_aprovar, false) then 'ativo' else 'recusado' end, decidido_dia = current_date
   where id = p_robo and situacao = 'esperando';
  if not found then perform interno.erro('ja_decidido'); end if;
  perform interno.registrar(case when p_aprovar then 'robo_aprovado' else 'robo_recusado' end, p_robo::text, '{}'::jsonb);
  return interno.alumia_pontes_robo_json(p_robo);
end $$;

/**
 * Só a chave de serviço (app/api/rede/robos): publica um post do robô dono da chave. Só robô ativo de organização que existe;
 * 12 por hora e 60 por dia; o texto passa pela mesma triagem de quem publica (o que ela segura fica retido para a mediação).
 * Só "internet" ou "membros" (robô não fala em comunidade nem em núcleo).
 */
create or replace function public.rede_pontes_robo_publicar(p_resumo text, p_texto text, p_publico text) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare r rede_pontes_robos; v_texto text := btrim(coalesce(p_texto, '')); v_pub text := coalesce(nullif(p_publico, ''), 'membros');
        v_tri jsonb; v_ver text; v_motivo text; v_id uuid;
begin
  if interno.alumia_exigida() then perform interno.erro('alumia_entrada'); end if;
  if not interno.alumia_pontes_painel('alumia-org') then perform interno.erro('desligado'); end if;
  if coalesce(p_resumo, '') !~ '^[0-9a-f]{64}$' then perform interno.erro('chave'); end if;
  select * into r from rede_pontes_robos where resumo = p_resumo;
  if not found or r.perfil is null then perform interno.erro('chave'); end if;
  if r.situacao <> 'ativo' or exists (select 1 from perfis where id in (r.perfil, r.org) and suspenso) then perform interno.erro('robo_parado'); end if;
  if char_length(v_texto) not between 1 and 500 then perform interno.erro('invalido:texto'); end if;
  if v_pub not in ('internet', 'membros') then perform interno.erro('invalido:publico'); end if;
  delete from rede_pontes_robo_uso where quando < now() - interval '2 days';
  if (select count(*) from rede_pontes_robo_uso where robo = r.id and quando > now() - interval '1 hour') >= 12
     or (select count(*) from rede_pontes_robo_uso where robo = r.id and quando > now() - interval '1 day') >= 60 then
    perform interno.erro('muitos_pedidos');
  end if;
  if interno.rede3_pub_dado_pessoal(v_texto) then perform interno.erro('dado_pessoal'); end if;
  v_tri := interno.rede_triagem(v_texto, r.perfil);
  v_ver := coalesce(v_tri ->> 'veredito', 'revisar'); v_motivo := coalesce(v_tri ->> 'motivo', '');
  if v_ver = 'publicar' and interno.normal(v_texto) ~ '(^|[^a-z])(macaco|crioulo|viado|bicha|sapatao|retardado|mongoloide|vagabunda|nordestino imundo|judeu imundo|negro imundo)([^a-z]|$)' then
    v_ver := 'revisar'; v_motivo := 'regra_simples_odio';
  end if;
  insert into rede_posts (autor, como, tipo, texto, publico, alcance, oculto, retido, avaliacao, motivo)
  values (r.perfil, r.perfil, 'post', v_texto, v_pub, interno.rede_alcance(v_pub), v_ver <> 'publicar', v_ver = 'revisar',
          case v_ver when 'publicar' then 'publicada' when 'bloquear' then 'bloqueada' else 'revisao' end, v_motivo)
  returning id into v_id;
  insert into rede_pontes_robo_uso (robo) values (r.id);
  update rede_pontes_robos set usado_dia = current_date where id = r.id;
  return jsonb_build_object('id', v_id, 'retido', v_ver <> 'publicar');
end $$;

/** O rótulo dos robôs entre os autores de uma página de posts (até 100): o robô e a organização dona, que são públicos. */
create or replace function public.alumia_pontes_rotulos(p_autores uuid[]) returns jsonb language sql stable security definer set search_path = interno, pg_temp as $$
  select coalesce(jsonb_agg(jsonb_build_object('autor', r.perfil, 'org', jsonb_build_object('handle', f.rede_handle, 'nome', coalesce(f.rede_codinome, f.nome)))), '[]'::jsonb)
  from rede_pontes_robos r join perfis f on f.id = r.org
  where r.perfil = any ((coalesce(p_autores, '{}'::uuid[]))[1:100]) and r.situacao <> 'criando'
$$;

/** O rótulo de um perfil pelo @ (nulo quando não é robô). */
create or replace function public.alumia_pontes_robo_de(p_handle text) returns jsonb language sql stable security definer set search_path = interno, pg_temp as $$
  select jsonb_build_object('nome', r.nome, 'descricao', r.descricao, 'parado', r.situacao <> 'ativo',
    'org', jsonb_build_object('handle', o.rede_handle, 'nome', coalesce(o.rede_codinome, o.nome)))
  from rede_pontes_robos r join perfis f on f.id = r.perfil join perfis o on o.id = r.org
  where f.rede_handle = lower(btrim(coalesce(p_handle, ''), ' @')) and r.situacao <> 'criando'
$$;

-- ── 7. Telegram ───────────────────────────────────────────────────────────────────────────────────────────────────────────

/** Liga, troca ou desliga o canal da organização. Só quem gerencia, só organização com selo, só com "alumia-telegram" ligado. */
create or replace function public.alumia_pontes_telegram_salvar(p_handle text, p_canal text, p_ligado boolean) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare o uuid; v_canal text := btrim(coalesce(p_canal, ''));
begin
  if not interno.alumia_pontes_ligado('alumia-telegram') then perform interno.erro('desligado'); end if;
  o := interno.alumia_pontes_org_gerida(p_handle, 'alumia_pontes_telegram', 10, 60);
  if not interno.alumia_pontes_selo(o) then perform interno.erro('sem_selo'); end if;
  if v_canal = '' and not coalesce(p_ligado, false) then
    delete from rede_pontes_telegram where org = o;
    return public.alumia_pontes_org(p_handle);
  end if;
  if v_canal !~ '^(@[A-Za-z][A-Za-z0-9_]{4,31}|-100[0-9]{6,15})$' then perform interno.erro('invalido:canal'); end if;
  insert into rede_pontes_telegram (org, canal, ligado, ligado_em) values (o, v_canal, coalesce(p_ligado, false), case when p_ligado then now() end)
  on conflict (org) do update set canal = excluded.canal, ligado = excluded.ligado, falhas = 0, motivo = '',
    ligado_em = case when excluded.ligado and not rede_pontes_telegram.ligado then now() when excluded.ligado then rede_pontes_telegram.ligado_em end;
  return public.alumia_pontes_org(p_handle);
end $$;

/**
 * Só a chave de serviço (app/api/rede/telegram): os posts que saem agora. Só post da organização (autor) que pode sair da Alumia
 * pela mesma regra do RSS (interno.alumia_alc_sai: público de fato "internet", nada não listado, arquivado, com prazo, na roda ou
 * fora do Fediverso, o que um visitante vê, comunidade aberta, conta à vista e nada com a trava), publicado depois de o canal ser
 * ligado, há mais de 10 minutos e há menos de 2 dias. Cada post sai uma vez (a linha em rede_pontes_telegram_envios nasce aqui).
 */
create or replace function public.rede_pontes_telegram_pendentes(p_limite integer) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v jsonb := '[]'::jsonb; r record;
begin
  if not interno.alumia_pontes_ligado('alumia-telegram') or not interno.alumia_pontes_painel('alumia-org') then return v; end if;
  delete from rede_pontes_telegram_envios where quando < now() - interval '30 days';
  for r in
    select p.id, p.titulo, p.texto, t.canal, t.org from rede_pontes_telegram t
    join rede_posts p on p.autor = t.org
    where t.ligado and interno.alumia_pontes_selo(t.org)
      and p.criado_em > t.ligado_em and p.criado_em < now() - interval '10 minutes' and p.criado_em > now() - interval '2 days'
      and p.resposta_a is null and p.apagado_em is null and interno.alumia_alc_sai(p)
      and not exists (select 1 from rede_pontes_telegram_envios e where e.post = p.id)
    order by p.criado_em limit least(greatest(coalesce(p_limite, 20), 1), 50)
  loop
    insert into rede_pontes_telegram_envios (post, org) values (r.id, r.org) on conflict do nothing;
    if found then
      v := v || jsonb_build_object('post', r.id, 'canal', r.canal, 'titulo', r.titulo, 'texto', left(r.texto, 3500));
    end if;
  end loop;
  return v;
end $$;

/** Só a chave de serviço: o resultado de um envio. Cinco falhas seguidas desligam o canal (a organização vê o motivo). */
create or replace function public.rede_pontes_telegram_resultado(p_post uuid, p_ok boolean) returns void language plpgsql security definer set search_path = interno, pg_temp as $$
declare v_org uuid;
begin
  update rede_pontes_telegram_envios set situacao = case when p_ok then 'saiu' else 'falhou' end where post = p_post and situacao = 'saindo' returning org into v_org;
  if v_org is null then return; end if;
  if p_ok then
    update rede_pontes_telegram set falhas = 0, enviado_dia = current_date where org = v_org;
  else
    update rede_pontes_telegram set falhas = least(falhas + 1, 100) where org = v_org;
    update rede_pontes_telegram set ligado = false, motivo = 'falhas' where org = v_org and falhas >= 5 and ligado;
  end if;
end $$;

-- ── 8. Mural dos Trabalhadores ────────────────────────────────────────────────────────────────────────────────────────────

/** Os chamados abertos das organizações com selo (até 60), do mais novo para o mais antigo, com filtro por tipo e cidade. */
create or replace function public.alumia_trabalhadores(p jsonb) returns jsonb language plpgsql stable security definer set search_path = interno, pg_temp as $$
declare v uuid := auth.uid(); v_tipo text := nullif(coalesce(p ->> 'tipo', ''), ''); v_cidade text := lower(btrim(coalesce(p ->> 'cidade', '')));
        v_hoje date := (now() at time zone 'America/Sao_Paulo')::date;
begin
  return jsonb_build_object(
    'chamados', coalesce((select jsonb_agg(interno.alumia_trabalhadores_json(c.id, v) order by c.criado_em desc) from (
      select c.id, c.criado_em from rede_trabalhadores_chamados c
      where not c.encerrado and c.ate >= v_hoje and interno.alumia_pontes_selo(c.org)
        and (v_tipo is null or c.tipo = v_tipo) and (v_cidade = '' or lower(c.cidade) = v_cidade)
        and not interno.rede_bloqueado(v, c.org)
      order by c.criado_em desc limit 60) c), '[]'::jsonb),
    'cidades', coalesce((select jsonb_agg(x.cidade order by x.cidade) from (select distinct c.cidade from rede_trabalhadores_chamados c
      where not c.encerrado and c.ate >= v_hoje and c.cidade <> '' and interno.alumia_pontes_selo(c.org) limit 100) x), '[]'::jsonb),
    'possoPublicar', coalesce((select jsonb_agg(jsonb_build_object('handle', f.rede_handle, 'nome', coalesce(f.rede_codinome, f.nome)) order by coalesce(f.rede_codinome, f.nome))
      from rede_orgs o join perfis f on f.id = o.perfil
      where v is not null and f.rede_handle is not null and interno.alumia_pontes_selo(o.perfil) and interno.alumia_pontes_fala(v, o.perfil)), '[]'::jsonb),
    'meus', coalesce((select jsonb_agg(interno.alumia_trabalhadores_json(c.id, v) order by c.criado_em desc) from (
      select c.id, c.criado_em from rede_trabalhadores_chamados c where v is not null and interno.alumia_pontes_fala(v, c.org)
        and c.criado_em > now() - interval '120 days' order by c.criado_em desc limit 30) c), '[]'::jsonb));
end $$;

/** Publica um chamado no mural em nome da organização (com selo). No máximo 5 abertos por organização e 10 por dia. */
create or replace function public.alumia_trabalhadores_publicar(p_handle text, p jsonb) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); o uuid; v_id uuid; v_hoje date := (now() at time zone 'America/Sao_Paulo')::date;
        v_tipo text := coalesce(p ->> 'tipo', ''); v_cat text := btrim(coalesce(p ->> 'categoria', '')); v_tit text := btrim(coalesce(p ->> 'titulo', ''));
        v_texto text := btrim(coalesce(p ->> 'texto', '')); v_cidade text := btrim(coalesce(p ->> 'cidade', '')); v_quando date; v_ate date;
begin
  if v is null then perform interno.erro('entre_primeiro'); end if;
  if not interno.rede2_membro(v) then perform interno.erro('consentimento'); end if;
  o := interno.alumia_org_de(p_handle);
  if o is null or interno.rede_bloqueado(v, o) or not interno.alumia_pontes_fala(v, o) then perform interno.erro('sem_permissao'); end if;
  if not interno.alumia_pontes_selo(o) then perform interno.erro('sem_selo'); end if;
  perform interno.limite('alumia_trabalhadores', 10, 1440);
  if v_tipo not in ('greve', 'paralisacao', 'assembleia', 'campanha', 'solidariedade', 'trabalho') then perform interno.erro('invalido:tipo'); end if;
  if char_length(v_cat) not between 2 and 60 then perform interno.erro('invalido:categoria'); end if;
  if char_length(v_tit) not between 4 and 90 then perform interno.erro('invalido:titulo'); end if;
  if char_length(v_texto) not between 10 and 600 then perform interno.erro('invalido:texto'); end if;
  if char_length(v_cidade) > 60 then perform interno.erro('invalido:cidade'); end if;
  begin
    v_quando := nullif(p ->> 'quando', '')::date;
    v_ate := coalesce(nullif(p ->> 'ate', '')::date, v_hoje + 30);
  exception when others then perform interno.erro('invalido:data');
  end;
  if v_ate < v_hoje or v_ate > v_hoje + 90 then perform interno.erro('invalido:ate'); end if;
  if v_quando is not null and (v_quando < v_hoje - 1 or v_quando > v_ate) then perform interno.erro('invalido:quando'); end if;
  if interno.rede3_pub_dado_pessoal(v_tit || ' ' || v_texto || ' ' || v_cat) then perform interno.erro('dado_pessoal'); end if;
  if (select count(*) from rede_trabalhadores_chamados where org = o and not encerrado and ate >= v_hoje) >= 5 then perform interno.erro('limite'); end if;
  insert into rede_trabalhadores_chamados (org, tipo, categoria, titulo, texto, cidade, quando, ate)
  values (o, v_tipo, v_cat, v_tit, v_texto, v_cidade, v_quando, v_ate) returning id into v_id;
  -- Os chamados encerrados ou vencidos há mais de 120 dias saem.
  delete from rede_trabalhadores_chamados where org = o and ate < v_hoje - 120;
  return interno.alumia_trabalhadores_json(v_id, v);
end $$;

/** Encerra um chamado (some do mural). Quem fala pela organização. */
create or replace function public.alumia_trabalhadores_encerrar(p_id uuid) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); o uuid;
begin
  if v is null then perform interno.erro('entre_primeiro'); end if;
  select org into o from rede_trabalhadores_chamados where id = p_id;
  if o is null or not interno.alumia_pontes_fala(v, o) then perform interno.erro('nao_encontrado'); end if;
  update rede_trabalhadores_chamados set encerrado = true where id = p_id;
  return interno.alumia_trabalhadores_json(p_id, v);
end $$;

-- ── 9. Permissões ─────────────────────────────────────────────────────────────────────────────────────────────────────────
do $$
declare f text;
begin
  -- As internas: ninguém de fora.
  foreach f in array array[
    'interno.alumia_pontes_ligado(text)', 'interno.alumia_pontes_painel(text)', 'interno.alumia_pontes_selo(uuid)', 'interno.alumia_pontes_fala(uuid, uuid)',
    'interno.alumia_pontes_org_gerida(text, text, integer, integer)', 'interno.alumia_pontes_robo_json(uuid)', 'interno.alumia_trabalhadores_json(uuid, uuid)',
    'interno.alumia_pontes_titulo(text)', 'interno.alumia_pontes_resumo_texto(uuid)', 'interno.alumia_pontes_resumo_semanal()'] loop
    execute format('revoke all on function %s from public', f);
    if exists (select 1 from pg_roles where rolname = 'anon') then execute format('revoke all on function %s from anon, authenticated', f); end if;
  end loop;
  -- As do servidor do site: só a chave de serviço.
  foreach f in array array[
    'public.rede_pontes_robo_ligar(uuid, uuid)', 'public.rede_pontes_robo_desfazer(uuid)', 'public.rede_pontes_robo_publicar(text, text, text)',
    'public.rede_pontes_telegram_pendentes(integer)', 'public.rede_pontes_telegram_resultado(uuid, boolean)'] loop
    execute format('revoke all on function %s from public', f);
    if exists (select 1 from pg_roles where rolname = 'anon') then
      execute format('revoke all on function %s from anon, authenticated', f);
      execute format('grant execute on function %s to service_role', f);
    end if;
  end loop;
  -- As de pessoa: quem tem conta (e, no mural e no rótulo, também o visitante; a porta decide com a entrada ligada).
  foreach f in array array[
    'public.alumia_pontes_resumo_ver()', 'public.alumia_pontes_resumo_salvar(boolean, text[])', 'public.alumia_pontes_resumo_previa()',
    'public.alumia_pontes_traduzir_texto(uuid)', 'public.alumia_pontes_eu()', 'public.alumia_pontes_org(text)',
    'public.alumia_pontes_robo_pedir(text, text, text)', 'public.alumia_pontes_robo_chave(uuid, text)', 'public.alumia_pontes_robo_desligar(uuid)',
    'public.alumia_pontes_robos_fila()', 'public.alumia_pontes_robo_decidir(uuid, boolean)', 'public.alumia_pontes_telegram_salvar(text, text, boolean)',
    'public.alumia_trabalhadores_publicar(text, jsonb)', 'public.alumia_trabalhadores_encerrar(uuid)'] loop
    execute format('revoke all on function %s from public', f);
    if exists (select 1 from pg_roles where rolname = 'anon') then
      execute format('revoke all on function %s from anon', f);
      execute format('grant execute on function %s to authenticated', f);
    end if;
  end loop;
  foreach f in array array['public.alumia_trabalhadores(jsonb)', 'public.alumia_pontes_rotulos(uuid[])', 'public.alumia_pontes_robo_de(text)'] loop
    if exists (select 1 from pg_roles where rolname = 'anon') then execute format('grant execute on function %s to anon, authenticated', f); end if;
  end loop;
end $$;

-- ── 10. A porta em toda função nova de pessoa ─────────────────────────────────────────────────────────────────────────────
select interno.alumia_trancar();
