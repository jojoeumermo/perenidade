-- ───────────────────────────── Alumia, onda 12: organização ─────────────────────────────
-- Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
--
-- Frente 12E. O que a organização com conta na Alumia ganha para falar em nome dela:
--
--   1. FILA DE COMUNICAÇÃO: quem ocupa uma função com a permissão "avisos" (a comunicação) ou gerencia a organização escreve; OUTRA
--      pessoa com o mesmo direito aprova antes de sair. O post sai com o nome da organização (autor e "como" = a organização) e
--      sem o nome de quem escreveu. Quem escreveu fica guardado só enquanto o texto espera (para a outra pessoa aprovar e para
--      quem escreveu retirar); na decisão, o banco esquece quem escreveu e quem aprovou. O que espera há mais de 14 dias vence.
--   2. MODELOS DE POST: textos prontos da organização (até 20), que a comunicação usa para começar um texto da fila.
--   3. CHAMAR O NÚCLEO (o "@núcleo"): um recado da organização para o núcleo inteiro, que avisa cada pessoa do núcleo. Só quem tem
--      cargo (a comunicação, quem gerencia ou a mediação daquele núcleo), no máximo 2 vezes em 7 dias por núcleo (o teto vale para
--      o núcleo, não para a pessoa: duas pessoas com cargo não somam 4). O recado sai em nome da organização e só para o núcleo.
--      Troca por princípio: em vez de ler "@núcleo" no meio de qualquer post (o que deixaria qualquer pessoa disparar avisos para
--      um grupo), é um botão com teto, na aba Comunicação.
--   4. BOLETIM: a organização escolhe até 12 posts dela dos últimos 8 dias e escreve a abertura; o boletim passa pela mesma fila
--      (outra pessoa aprova), sai como post da organização e avisa quem pediu o boletim. Quem pediu também por e-mail recebe pela
--      rotina de e-mails que já existe (interno.email → interno.emails → enviar-emails): um e-mail por pessoa, para o endereço da
--      própria conta, sem lista de destinatários, sem link no texto (interno.sem_link) e só com o começo dos posts PÚBLICOS. Um
--      boletim a cada 6 dias. Ninguém vê quem assina; a organização vê o número só a partir de 3.
--   5. DOMÍNIO PRÓPRIO COMO IDENTIDADE: só organização com selo. Quem gerencia escolhe o domínio e recebe um desafio; prova pelo
--      registro TXT `_alumia.<domínio>` ou pelo arquivo `https://<domínio>/.well-known/alumia-dominio.txt`. Quem confere é o
--      servidor do site (app/api/rede/org/dominio, lib/rede/org/dominio.ts), que devolve o resultado por uma função só da chave de
--      serviço. O perfil mostra o domínio verificado enquanto houver selo. O WebFinger pelo domínio
--      lê interno.rede_org_por_dominio.
--
-- Nenhum endereço de rede é guardado (nem o da organização, nem o de quem confere). Nenhuma função devolve lista de pessoas: nem
-- quem escreveu, nem quem aprovou, nem quem assina o boletim, nem quem foi avisado; números só a partir de 3. Tudo em interno, com
-- RLS e sem política; o acesso é só por funções security definer com search_path fixo. As de membro passam pela porta da entrada
-- (interno.alumia_trancar, no fim). Nenhuma função recebe parâmetro do tipo linha de tabela.
--
-- Leis: LGPD (Lei 13.709/2018) art. 5º, II e art. 11 (filiação e opinião política são dado sensível: nenhuma lista, quem escreve
-- não aparece, quem assina o boletim não aparece), art. 6º, III (necessidade: quem escreveu some na decisão; só o dia da decisão),
-- art. 7º, I e art. 8º (o e-mail do boletim só para quem pediu, e para de chegar quando a pessoa desliga). ECA Digital (Lei
-- 15.211/2025): toda ação exige ser membro da Alumia (18+ com consentimento).
--
-- Pode rodar mais de uma vez, sem apagar dado nenhum. Roda DEPOIS de 20261117-alumia-onda11-fim.sql.
-- Teste: scripts/testar-alumia-o12-org.mjs.

-- ── 1. Tabelas ────────────────────────────────────────────────────────────────────────────────────────────────────────────

-- A fila de comunicação: o texto que espera a outra pessoa. `escreveu` só existe enquanto espera.
create table if not exists interno.rede_org_fila (
  id uuid primary key default gen_random_uuid(),
  org uuid not null references interno.rede_orgs (perfil) on delete cascade,
  tipo text not null default 'post' check (tipo in ('post', 'boletim')),
  texto text not null check (char_length(btrim(texto)) between 1 and 500),
  publico text not null default 'membros' check (publico in ('internet', 'membros', 'seguidores')),
  boletim_posts uuid[] not null default '{}' check (cardinality(boletim_posts) <= 12),
  escreveu uuid references interno.perfis (id) on delete set null,
  situacao text not null default 'esperando' check (situacao in ('esperando', 'aprovado', 'recusado', 'retirado', 'vencido')),
  motivo text not null default '' check (char_length(motivo) <= 300),
  post uuid references interno.rede_posts (id) on delete set null,
  criado_em timestamptz not null default now(),
  decidido_dia date
);
create index if not exists rede_org_fila_org on interno.rede_org_fila (org, criado_em desc);
alter table interno.rede_org_fila enable row level security;

-- Os modelos de post da organização.
create table if not exists interno.rede_org_modelos (
  id uuid primary key default gen_random_uuid(),
  org uuid not null references interno.rede_orgs (perfil) on delete cascade,
  nome text not null check (char_length(btrim(nome)) between 2 and 40),
  texto text not null check (char_length(btrim(texto)) between 1 and 500),
  publico text not null default 'membros' check (publico in ('internet', 'membros', 'seguidores')),
  criado_dia date not null default current_date
);
create unique index if not exists rede_org_modelos_nome on interno.rede_org_modelos (org, lower(nome));
alter table interno.rede_org_modelos enable row level security;

-- As chamadas de núcleo, para o teto (2 em 7 dias por núcleo). Não guarda quem chamou.
create table if not exists interno.rede_org_nucleo_chamadas (
  id uuid primary key default gen_random_uuid(),
  nucleo uuid not null references interno.rede_nucleos (id) on delete cascade,
  post uuid references interno.rede_posts (id) on delete set null,
  quando timestamptz not null default now()
);
create index if not exists rede_org_nucleo_chamadas_nucleo on interno.rede_org_nucleo_chamadas (nucleo, quando desc);
alter table interno.rede_org_nucleo_chamadas enable row level security;

-- Quem pediu o boletim (na Alumia; `email`: também por e-mail). Nunca sai do banco como lista.
create table if not exists interno.rede_org_boletim_assinaturas (
  org uuid not null references interno.rede_orgs (perfil) on delete cascade,
  usuario uuid not null references interno.perfis (id) on delete cascade,
  email boolean not null default false,
  desde date not null default current_date,
  primary key (org, usuario)
);
create index if not exists rede_org_boletim_assinaturas_usuario on interno.rede_org_boletim_assinaturas (usuario);
alter table interno.rede_org_boletim_assinaturas enable row level security;

-- Os boletins que saíram (para o intervalo de 6 dias e para a lista na página).
create table if not exists interno.rede_org_boletins (
  id uuid primary key default gen_random_uuid(),
  org uuid not null references interno.rede_orgs (perfil) on delete cascade,
  post uuid references interno.rede_posts (id) on delete set null,
  saiu_em timestamptz not null default now()
);
create index if not exists rede_org_boletins_org on interno.rede_org_boletins (org, saiu_em desc);
alter table interno.rede_org_boletins enable row level security;

-- O domínio da organização: o desafio e, depois da prova, quando foi verificado. Nenhum endereço de rede.
create table if not exists interno.rede_org_dominios (
  org uuid primary key references interno.rede_orgs (perfil) on delete cascade,
  dominio text not null check (char_length(dominio) between 4 and 253
    and dominio ~ '^([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z][a-z0-9-]{0,61}[a-z0-9]$'),
  desafio text not null check (desafio ~ '^[0-9a-f]{32}$'),
  situacao text not null default 'esperando' check (situacao in ('esperando', 'verificado')),
  metodo text check (metodo is null or metodo in ('txt', 'arquivo')),
  pedido_dia date not null default current_date,
  verificado_em timestamptz,
  conferido_em timestamptz
);
create unique index if not exists rede_org_dominios_um on interno.rede_org_dominios (dominio) where situacao = 'verificado';
alter table interno.rede_org_dominios enable row level security;

-- Nenhuma permissão direta nas tabelas novas.
do $$
declare t text;
begin
  foreach t in array array['rede_org_fila', 'rede_org_modelos', 'rede_org_nucleo_chamadas', 'rede_org_boletim_assinaturas', 'rede_org_boletins', 'rede_org_dominios'] loop
    execute format('revoke all on table interno.%I from public', t);
    if exists (select 1 from pg_roles where rolname = 'anon') then
      execute format('revoke all on table interno.%I from anon, authenticated', t);
    end if;
  end loop;
end $$;

-- ── 2. Ajudas internas ────────────────────────────────────────────────────────────────────────────────────────────────────

/** `p_quem` fala pela organização: gerencia ou ocupa (mandato aceito) uma função com a permissão "avisos". */
create or replace function interno.alumia_o12_comunica(p_quem uuid, p_org uuid) returns boolean language sql stable security definer set search_path = interno, pg_temp as $$
  select coalesce(interno.alumia_org_gere(p_quem, p_org), false) or coalesce(interno.alumia_org_funcao_tem(p_quem, p_org, 'avisos'), false)
$$;

/** A organização pelo @, para quem fala por ela (membro da Alumia, sem bloqueio, com o limite de uso). Senão, "sem_permissao". */
create or replace function interno.alumia_o12_org_de(p_handle text, p_acao text, p_max integer, p_min integer) returns uuid language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); o uuid;
begin
  perform interno.rede3_perfil_exige_membro(v);
  o := interno.alumia_org_de(p_handle);
  if o is null or interno.rede_bloqueado(v, o) or not interno.alumia_o12_comunica(v, o) then perform interno.erro('sem_permissao'); end if;
  perform interno.limite(p_acao, p_max, p_min);
  return o;
end $$;

/** Pode chamar o núcleo: a comunicação ou quem gerencia a organização dona do núcleo, ou a mediação daquele núcleo. */
create or replace function interno.alumia_o12_chama(p_quem uuid, p_nucleo uuid) returns boolean language sql stable security definer set search_path = interno, pg_temp as $$
  select p_quem is not null and exists (
    select 1 from rede_nucleos n where n.id = p_nucleo and n.org is not null
      and (interno.alumia_o12_comunica(p_quem, n.org)
           or exists (select 1 from rede_nucleo_membros m where m.nucleo = n.id and m.usuario = p_quem and m.papel = 'mediacao')))
$$;

/** Quantas chamadas o núcleo ainda tem nos últimos 7 dias (o teto é 2) e quando a próxima volta, se acabou. */
create or replace function interno.alumia_o12_teto(p_nucleo uuid) returns jsonb language sql stable security definer set search_path = interno, pg_temp as $$
  select jsonb_build_object(
    'restam', greatest(0, 2 - (select count(*) from rede_org_nucleo_chamadas c where c.nucleo = p_nucleo and c.quando > now() - interval '7 days'))::integer,
    'volta', case when (select count(*) from rede_org_nucleo_chamadas c where c.nucleo = p_nucleo and c.quando > now() - interval '7 days') >= 2
                  then (select min(c.quando) + interval '7 days' from (select quando from rede_org_nucleo_chamadas c2 where c2.nucleo = p_nucleo and c2.quando > now() - interval '7 days' order by quando desc limit 2) c) end)
$$;

/**
 * Publica um post EM NOME da organização (autor e "como" = a organização). A mesma triagem de quem publica (interno.rede_triagem,
 * a regra simples de ódio e o dado pessoal): o que a triagem segura fica retido para a mediação, como qualquer post.
 */
create or replace function interno.alumia_o12_postar(p_org uuid, p_tipo text, p_titulo text, p_texto text, p_corpo text, p_publico text, p_nucleo uuid) returns uuid language plpgsql security definer set search_path = interno, pg_temp as $$
declare v_tudo text := coalesce(p_titulo, '') || ' ' || p_texto || ' ' || coalesce(p_corpo, ''); v_tri jsonb; v_ver text; v_motivo text; v_id uuid;
begin
  if interno.rede3_pub_dado_pessoal(v_tudo) then perform interno.erro('dado_pessoal'); end if;
  v_tri := interno.rede_triagem(v_tudo, p_org);
  v_ver := v_tri ->> 'veredito'; v_motivo := coalesce(v_tri ->> 'motivo', '');
  if v_ver = 'publicar' and interno.normal(v_tudo) ~ '(^|[^a-z])(macaco|crioulo|viado|bicha|sapatao|retardado|mongoloide|vagabunda|nordestino imundo|judeu imundo|negro imundo)([^a-z]|$)' then
    v_ver := 'revisar'; v_motivo := 'regra_simples_odio';
  end if;
  insert into rede_posts (autor, como, tipo, titulo, texto, corpo, publico, alcance, nucleo, oculto, retido, avaliacao, motivo)
  values (p_org, p_org, p_tipo, p_titulo, p_texto, p_corpo, p_publico, interno.rede_alcance(p_publico), p_nucleo,
          v_ver <> 'publicar', v_ver = 'revisar', case v_ver when 'publicar' then 'publicada' when 'bloquear' then 'bloqueada' else 'revisao' end, v_motivo)
  returning id into v_id;
  return v_id;
end $$;

/** O texto de reserva de um item da fila que venceu (mais de 14 dias esperando): vence e esquece quem escreveu. */
create or replace function interno.alumia_o12_vencer(p_org uuid) returns void language sql security definer set search_path = interno, pg_temp as $$
  update rede_org_fila set situacao = 'vencido', escreveu = null, decidido_dia = current_date
   where org = p_org and situacao = 'esperando' and criado_em < now() - interval '14 days';
  delete from rede_org_fila where org = p_org and situacao <> 'esperando' and decidido_dia < current_date - 90;
$$;

/**
 * O post cabe no boletim deste público? Só post da própria organização, de pé (nem apagado, nem retido, nem arquivado, nem vencido),
 * que abre conversa, fora de comunidade e de roda, listado, e com público igual ou mais aberto que o do boletim: "internet" cabe em
 * todos; "membros" só no boletim de membros; "seguidores" só no de seguidores (as duas listas não se contêm). "núcleo", "equipe",
 * "comunidade" e "roda" nunca entram. Assim o corpo do boletim nunca mostra um texto a quem não podia lê-lo.
 */
create or replace function interno.alumia_o12_cabe_no_boletim(p_post uuid, p_org uuid, p_publico text) returns boolean language sql stable security definer set search_path = interno, pg_temp as $$
  select exists (select 1 from rede_posts p
    where p.id = p_post and p.autor = p_org and p.apagado_em is null and not p.oculto and not p.retido and p.arquivado_em is null
      and (p.expira_em is null or p.expira_em > now()) and p.resposta_a is null and p.comunidade is null and not p.nao_listado
      and p.alcance <> 'roda'
      and (coalesce(p.publico, 'membros') = 'internet' or coalesce(p.publico, 'membros') = p_publico)
      and coalesce(p.publico, 'membros') in ('internet', 'membros', 'seguidores'))
$$;

/** Um item da fila como a tela recebe: nunca quem escreveu; só "meu" (escrevi eu) e se eu posso decidir. */
create or replace function interno.alumia_o12_item(p_id uuid, p_quem uuid) returns jsonb language sql stable security definer set search_path = interno, pg_temp as $$
  select jsonb_build_object('id', f.id, 'tipo', f.tipo, 'texto', f.texto, 'publico', f.publico, 'situacao', f.situacao, 'motivo', nullif(f.motivo, ''),
    'criadoEm', f.criado_em, 'decididoDia', f.decidido_dia, 'meu', f.escreveu is not null and f.escreveu = p_quem,
    'possoDecidir', f.situacao = 'esperando' and f.escreveu is distinct from p_quem,
    'boletim', case when f.tipo = 'boletim' then coalesce((select jsonb_agg(jsonb_build_object('id', p.id, 'texto', left(p.texto, 140)) order by p.criado_em desc)
                 from rede_posts p where p.id = any (f.boletim_posts) and p.apagado_em is null), '[]'::jsonb) end,
    'post', f.post, 'retido', case when f.post is not null then (select p.retido or p.oculto from rede_posts p where p.id = f.post) end)
  from rede_org_fila f where f.id = p_id
$$;

/** O domínio da organização como a tela de quem gerencia recebe (com o que pôr no TXT e no arquivo). */
create or replace function interno.alumia_o12_dominio_json(p_org uuid) returns jsonb language sql stable security definer set search_path = interno, pg_temp as $$
  select jsonb_build_object('dominio', d.dominio, 'situacao', d.situacao, 'metodo', d.metodo, 'verificadoEm', d.verificado_em, 'conferidoEm', d.conferido_em,
    'txtNome', '_alumia.' || d.dominio, 'txtValor', 'alumia-dominio=' || d.desafio,
    'arquivo', 'https://' || d.dominio || '/.well-known/alumia-dominio.txt', 'arquivoTexto', 'alumia-dominio=' || d.desafio)
  from rede_org_dominios d where d.org = p_org
$$;

/** Um domínio que nenhuma organização pode tomar: nomes reservados e o domínio do próprio Instituto (e os de baixo dele). */
create or replace function interno.alumia_o12_dominio_reservado(p_dominio text) returns boolean language sql stable security definer set search_path = interno, pg_temp as $$
  select p_dominio ~ '\.(local|localhost|internal|intranet|lan|home|corp|onion|invalid|test|example|arpa|alt)$'
      or p_dominio ~ '^(localhost|example\.(com|org|net))$'
      or p_dominio ~ '(^|\.)institutolucia\.org$'
      or p_dominio = lower(regexp_replace(interno.endereco(), '^https?://([^/:]+).*$', '\1'))
      or p_dominio like ('%.' || lower(regexp_replace(interno.endereco(), '^https?://([^/:]+).*$', '\1')))
$$;

-- ── 3. A aba Comunicação ──────────────────────────────────────────────────────────────────────────────────────────────────

/**
 * Tudo da aba Comunicação de uma organização, para quem fala por ela ou media um núcleo dela (senão, nulo): a fila (o que espera e
 * as últimas 20 decisões), os modelos, os núcleos que a pessoa pode chamar com o teto de cada um, o boletim (quem assina, só o
 * número a partir de 3; quando saiu o último; se já pode sair outro) e, para quem gerencia, o domínio.
 */
create or replace function public.rede_org_comunicacao(p_handle text) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); o uuid := interno.alumia_org_de(p_handle); v_com boolean; v_gere boolean; v_ultimo timestamptz;
begin
  perform interno.rede3_perfil_exige_membro(v);
  perform interno.limite('alumia_o12_ler', 300, 10);
  if o is null or interno.rede_bloqueado(v, o) then return null; end if;
  v_com := interno.alumia_o12_comunica(v, o);
  v_gere := coalesce(interno.alumia_org_gere(v, o), false);
  if not v_com and not exists (select 1 from rede_nucleos n join rede_nucleo_membros m on m.nucleo = n.id where n.org = o and m.usuario = v and m.papel = 'mediacao') then
    return null;
  end if;
  if v_com then perform interno.alumia_o12_vencer(o); end if;
  select max(saiu_em) into v_ultimo from rede_org_boletins where org = o;
  return jsonb_build_object(
    'comunico', v_com, 'gerencio', v_gere, 'selo', exists (select 1 from rede_orgs where perfil = o and verificada_em is not null),
    'fila', case when v_com then coalesce((select jsonb_agg(interno.alumia_o12_item(x.id, v) order by x.esperando desc, x.criado_em desc)
      from (select f.id, f.criado_em, f.situacao = 'esperando' as esperando from rede_org_fila f where f.org = o
            order by (f.situacao = 'esperando') desc, f.criado_em desc limit 50) x), '[]'::jsonb) else '[]'::jsonb end,
    'modelos', case when v_com then coalesce((select jsonb_agg(jsonb_build_object('id', m.id, 'nome', m.nome, 'texto', m.texto, 'publico', m.publico) order by lower(m.nome))
      from rede_org_modelos m where m.org = o), '[]'::jsonb) else '[]'::jsonb end,
    'nucleos', coalesce((select jsonb_agg(jsonb_build_object('id', n.id, 'nome', n.nome) || interno.alumia_o12_teto(n.id) order by n.nome)
      from rede_nucleos n where n.org = o and interno.alumia_o12_chama(v, n.id)), '[]'::jsonb),
    'boletim', case when v_com then jsonb_build_object(
      'assinantes', interno.alumia_pessoas((select count(*) from rede_org_boletim_assinaturas a join perfis f on f.id = a.usuario where a.org = o and not f.suspenso)),
      'porEmail', interno.alumia_pessoas((select count(*) from rede_org_boletim_assinaturas a join perfis f on f.id = a.usuario where a.org = o and a.email and not f.suspenso)),
      'ultimo', v_ultimo,
      'proximo', case when v_ultimo is not null and v_ultimo > now() - interval '6 days' then v_ultimo + interval '6 days' end,
      'posts', coalesce((select jsonb_agg(jsonb_build_object('id', p.id, 'texto', left(p.texto, 140), 'publico', p.publico, 'criadoEm', p.criado_em) order by p.criado_em desc)
        from (select * from rede_posts p where p.autor = o and (interno.alumia_o12_cabe_no_boletim(p.id, o, 'membros') or interno.alumia_o12_cabe_no_boletim(p.id, o, 'seguidores'))
                and p.criado_em > now() - interval '8 days'
              order by p.criado_em desc limit 30) p), '[]'::jsonb)) end,
    'dominio', case when v_gere then interno.alumia_o12_dominio_json(o) end);
end $$;

-- ── 4. A fila ─────────────────────────────────────────────────────────────────────────────────────────────────────────────

/**
 * Escrever pela organização: o texto entra na fila e espera OUTRA pessoa que fala pela organização. p: {texto, publico, modelo?}.
 * Até 30 textos esperando por organização. Quem mais fala pela organização é avisado (sem dizer quem escreveu).
 */
create or replace function public.rede_org_fila_escrever(p_handle text, p jsonb) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); o uuid := interno.alumia_o12_org_de(p_handle, 'alumia_o12_fila', 20, 60); v_texto text; v_publico text; v_id uuid; r record;
begin
  if p is null or jsonb_typeof(p) <> 'object' then perform interno.erro('invalido:pedido'); end if;
  v_texto := interno.txt(p ->> 'texto', 'texto', 1, 500);
  v_publico := coalesce(nullif(btrim(p ->> 'publico'), ''), 'membros');
  if v_publico not in ('internet', 'membros', 'seguidores') then perform interno.erro('invalido:publico'); end if;
  if interno.rede3_pub_dado_pessoal(v_texto) then perform interno.erro('dado_pessoal'); end if;
  if (select count(*) from rede_org_fila where org = o and situacao = 'esperando') >= 30 then perform interno.erro('fila_cheia'); end if;
  insert into rede_org_fila (org, tipo, texto, publico, escreveu) values (o, 'post', v_texto, v_publico, v) returning id into v_id;
  for r in select distinct x.quem from (
             select g.gestor as quem from rede_org_gestores g where g.org = o
             union select m.pessoa from rede_org_mandatos m join rede_org_funcoes f on f.id = m.funcao
              where f.org = o and 'avisos' = any (f.permissoes) and m.aceito and m.encerrado_dia is null and m.fim >= current_date) x
           where x.quem <> v loop
    perform interno.avisar_em(r.quem, format('Há um texto de “%s” esperando aprovação na aba Comunicação.', interno.rede_nome(o)), 'rede');
  end loop;
  return interno.alumia_o12_item(v_id, v);
end $$;

/**
 * Decidir um texto da fila: aprovar (sai como post da organização; o boletim também avisa e manda os e-mails) ou recusar (com
 * motivo). Só quem fala pela organização e NÃO escreveu o texto. Na decisão, o banco esquece quem escreveu.
 */
create or replace function public.rede_org_fila_decidir(p_id uuid, p_aprovar boolean, p_motivo text) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); f rede_org_fila; v_post uuid; v_corpo text; v_nome text; v_handle text; v_titulo text; v_email text; v_publicos text; r record;
begin
  perform interno.rede3_perfil_exige_membro(v);
  select * into f from rede_org_fila where id = p_id for update;
  if not found or not interno.alumia_o12_comunica(v, f.org) or interno.rede_bloqueado(v, f.org) then perform interno.erro('nao_encontrado'); end if;
  perform interno.limite('alumia_o12_decidir', 30, 60);
  if f.situacao <> 'esperando' then perform interno.erro('ja_decidido'); end if;
  -- Esperou mais de 14 dias: não sai mais (vira "vencido" na próxima leitura da aba; um erro aqui desfaria a marca).
  if f.criado_em < now() - interval '14 days' then perform interno.erro('vencido'); end if;
  if f.escreveu is not distinct from v then perform interno.erro('outra_pessoa'); end if;
  if not coalesce(p_aprovar, false) then
    update rede_org_fila set situacao = 'recusado', motivo = left(btrim(coalesce(p_motivo, '')), 300), escreveu = null, decidido_dia = current_date where id = f.id;
    return interno.alumia_o12_item(f.id, v);
  end if;

  if f.tipo = 'post' then
    v_post := interno.alumia_o12_postar(f.org, 'post', null, f.texto, null, f.publico, null);
  else
    if exists (select 1 from rede_org_boletins b where b.org = f.org and b.saiu_em > now() - interval '6 days') then perform interno.erro('boletim_cedo'); end if;
    v_nome := interno.rede_nome(f.org);
    select rede_handle into v_handle from perfis where id = f.org;
    v_titulo := left('Boletim de ' || v_nome, 140);
    v_corpo := coalesce((select string_agg('— ' || left(p.texto, 280), E'\n\n' order by p.criado_em desc) from rede_posts p
                         where p.id = any (f.boletim_posts) and interno.alumia_o12_cabe_no_boletim(p.id, f.org, f.publico)), '');
    v_post := interno.alumia_o12_postar(f.org, 'aviso', v_titulo, f.texto, nullif(v_corpo, ''), f.publico, null);
    insert into rede_org_boletins (org, post) values (f.org, v_post);
    -- Para o e-mail: só o começo dos posts PÚBLICOS (internet), sem link; os outros entram só como número.
    v_publicos := coalesce((select string_agg('- ' || interno.sem_link(left(p.texto, 160)), E'\n' order by p.criado_em desc) from rede_posts p
                            where p.id = any (f.boletim_posts) and interno.alumia_o12_cabe_no_boletim(p.id, f.org, f.publico)
                              and coalesce(p.publico, 'membros') = 'internet'), '');
    if not exists (select 1 from rede_posts p where p.id = v_post and (p.oculto or p.retido)) then
      for r in select a.usuario, a.email from rede_org_boletim_assinaturas a join perfis pf on pf.id = a.usuario
               where a.org = f.org and not pf.suspenso and not interno.rede_bloqueado(a.usuario, f.org) order by a.usuario limit 5000 loop
        if not interno.rede2_membro(r.usuario) then continue; end if;
        perform interno.avisar_em(r.usuario, format('Saiu o boletim de “%s” na Alumia.', v_nome), 'rede');
        if r.email then
          v_email := lower(coalesce(interno.email_da_conta(r.usuario), ''));
          if v_email <> '' and v_email !~ '\.invalid$' then
            perform interno.email(v_email, 'alumia_org_boletim', left(interno.sem_link('Boletim de ' || v_nome || ' na Alumia'), 200),
              format(E'%s\n\n%s%s\n\nLer o boletim inteiro na Alumia (entre com a sua conta):\n%s\n\nVocê recebe este e-mail porque pediu o boletim de %s por e-mail na página da organização na Alumia. Para parar, desligue lá. Cada pessoa recebe o seu e-mail, sozinha: ninguém vê quem mais recebe.',
                interno.sem_link(v_nome), interno.sem_link(f.texto), case when v_publicos <> '' then E'\n\nNesta semana:\n' || v_publicos else '' end,
                interno.endereco() || '/pt/alumia/@' || v_handle, interno.sem_link(v_nome)),
              interno.endereco() || '/pt/alumia/@' || v_handle, 2);
          end if;
        end if;
      end loop;
    end if;
  end if;
  update rede_org_fila set situacao = 'aprovado', post = v_post, escreveu = null, motivo = '', decidido_dia = current_date where id = f.id;
  return interno.alumia_o12_item(f.id, v);
end $$;

/** Retirar da fila o que eu escrevi, enquanto espera. */
create or replace function public.rede_org_fila_retirar(p_id uuid) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); f rede_org_fila;
begin
  perform interno.rede3_perfil_exige_membro(v);
  select * into f from rede_org_fila where id = p_id and escreveu = v and situacao = 'esperando' for update;
  if not found then perform interno.erro('nao_encontrado'); end if;
  perform interno.limite('alumia_o12_fila', 20, 60);
  update rede_org_fila set situacao = 'retirado', escreveu = null, decidido_dia = current_date where id = f.id;
  return interno.alumia_o12_item(f.id, v);
end $$;

-- ── 5. Modelos ────────────────────────────────────────────────────────────────────────────────────────────────────────────

/** Criar ou mudar um modelo (p: {id?, nome, texto, publico}). Até 20 por organização. Devolve a lista. */
create or replace function public.rede_org_modelo_salvar(p_handle text, p jsonb) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare o uuid := interno.alumia_o12_org_de(p_handle, 'alumia_o12_modelo', 60, 60); v_nome text; v_texto text; v_publico text;
begin
  if p is null or jsonb_typeof(p) <> 'object' then perform interno.erro('invalido:pedido'); end if;
  v_nome := interno.txt(p ->> 'nome', 'nome', 2, 40);
  v_texto := interno.txt(p ->> 'texto', 'texto', 1, 500);
  v_publico := coalesce(nullif(btrim(p ->> 'publico'), ''), 'membros');
  if v_publico not in ('internet', 'membros', 'seguidores') then perform interno.erro('invalido:publico'); end if;
  if interno.rede3_pub_dado_pessoal(v_texto) then perform interno.erro('dado_pessoal'); end if;
  begin
    if nullif(p ->> 'id', '') is not null then
      update rede_org_modelos set nome = v_nome, texto = v_texto, publico = v_publico where id = (p ->> 'id')::uuid and org = o;
      if not found then perform interno.erro('nao_encontrado'); end if;
    else
      if (select count(*) from rede_org_modelos where org = o) >= 20 then perform interno.erro('limite'); end if;
      insert into rede_org_modelos (org, nome, texto, publico) values (o, v_nome, v_texto, v_publico);
    end if;
  exception
    when unique_violation then perform interno.erro('modelo_existe');
    when invalid_text_representation then perform interno.erro('invalido:modelo');
  end;
  return coalesce((select jsonb_agg(jsonb_build_object('id', m.id, 'nome', m.nome, 'texto', m.texto, 'publico', m.publico) order by lower(m.nome)) from rede_org_modelos m where m.org = o), '[]'::jsonb);
end $$;

create or replace function public.rede_org_modelo_apagar(p_handle text, p_id uuid) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare o uuid := interno.alumia_o12_org_de(p_handle, 'alumia_o12_modelo', 60, 60);
begin
  delete from rede_org_modelos where id = p_id and org = o;
  if not found then perform interno.erro('nao_encontrado'); end if;
  return coalesce((select jsonb_agg(jsonb_build_object('id', m.id, 'nome', m.nome, 'texto', m.texto, 'publico', m.publico) order by lower(m.nome)) from rede_org_modelos m where m.org = o), '[]'::jsonb);
end $$;

-- ── 6. Chamar o núcleo ────────────────────────────────────────────────────────────────────────────────────────────────────

/**
 * Chamar o núcleo inteiro: um recado da organização só para o núcleo (público "núcleo") e um aviso para cada pessoa dele que pode
 * ver o recado (fora quem chamou e quem a organização bloqueou ou a bloqueou). Teto: 2 em 7 dias por núcleo. Devolve o post, quantas
 * pessoas foram avisadas (só a partir de 3) e o teto que sobrou. O aviso não diz quem chamou.
 */
create or replace function public.rede_org_nucleo_chamar(p_nucleo uuid, p_texto text) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); n rede_nucleos; v_texto text; v_post uuid; x rede_posts; v_n integer := 0; r record;
begin
  perform interno.rede3_perfil_exige_membro(v);
  select * into n from rede_nucleos where id = p_nucleo for update;
  if not found or n.org is null or not interno.alumia_o12_chama(v, n.id) or interno.rede_bloqueado(v, n.org)
     or not exists (select 1 from perfis f where f.id = n.org and not f.suspenso) then
    perform interno.erro('sem_permissao');
  end if;
  perform interno.limite('alumia_o12_chamar', 10, 60);
  v_texto := interno.txt(p_texto, 'texto', 1, 500);
  if (interno.alumia_o12_teto(n.id) ->> 'restam')::integer <= 0 then perform interno.erro('teto_do_nucleo'); end if;
  v_post := interno.alumia_o12_postar(n.org, 'post', null, v_texto, null, 'nucleo', n.id);
  insert into rede_org_nucleo_chamadas (nucleo, post) values (n.id, v_post);
  select * into x from rede_posts where id = v_post;
  if not x.oculto and not x.retido then
    for r in select m.usuario from rede_nucleo_membros m join perfis f on f.id = m.usuario
             where m.nucleo = n.id and m.usuario <> v and not f.suspenso and not interno.rede_bloqueado(m.usuario, n.org) loop
      if not interno.rede_ve(x, r.usuario) then continue; end if;
      perform interno.rede3_aviso_criar(r.usuario, 'nucleo', v_post, null, null, format('“%s” chamou o seu núcleo (%s) na Alumia.', interno.rede_nome(n.org), n.nome));
      v_n := v_n + 1;
    end loop;
  end if;
  return jsonb_build_object('post', v_post, 'retido', x.oculto or x.retido, 'avisadas', interno.alumia_pessoas(v_n)) || interno.alumia_o12_teto(n.id);
end $$;

-- ── 7. Boletim ────────────────────────────────────────────────────────────────────────────────────────────────────────────

/**
 * Propor o boletim (p: {texto, posts: [ids], publico}): até 12 posts da própria organização dos últimos 8 dias, cada um com público
 * que caiba no do boletim (interno.alumia_o12_cabe_no_boletim). Vai para a fila.
 */
create or replace function public.rede_org_boletim_propor(p_handle text, p jsonb) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); o uuid := interno.alumia_o12_org_de(p_handle, 'alumia_o12_fila', 20, 60); v_texto text; v_publico text; v_posts uuid[]; v_id uuid;
begin
  if p is null or jsonb_typeof(p) <> 'object' then perform interno.erro('invalido:pedido'); end if;
  v_texto := interno.txt(p ->> 'texto', 'texto', 1, 500);
  v_publico := coalesce(nullif(btrim(p ->> 'publico'), ''), 'membros');
  if v_publico not in ('internet', 'membros', 'seguidores') then perform interno.erro('invalido:publico'); end if;
  if interno.rede3_pub_dado_pessoal(v_texto) then perform interno.erro('dado_pessoal'); end if;
  begin
    select coalesce(array_agg(distinct x::uuid), '{}') into v_posts from jsonb_array_elements_text(coalesce(p -> 'posts', '[]'::jsonb)) x;
  exception when others then perform interno.erro('invalido:posts');
  end;
  if cardinality(v_posts) not between 1 and 12 then perform interno.erro('invalido:posts'); end if;
  if exists (select 1 from unnest(v_posts) i where not exists (
       select 1 from rede_posts p where p.id = i and p.criado_em > now() - interval '8 days' and interno.alumia_o12_cabe_no_boletim(i, o, v_publico))) then
    perform interno.erro('invalido:posts');
  end if;
  if exists (select 1 from rede_org_fila where org = o and tipo = 'boletim' and situacao = 'esperando') then perform interno.erro('boletim_esperando'); end if;
  if exists (select 1 from rede_org_boletins b where b.org = o and b.saiu_em > now() - interval '6 days') then perform interno.erro('boletim_cedo'); end if;
  insert into rede_org_fila (org, tipo, texto, publico, boletim_posts, escreveu) values (o, 'boletim', v_texto, v_publico, v_posts, v) returning id into v_id;
  return interno.alumia_o12_item(v_id, v);
end $$;

/** O meu boletim de uma organização (eu assino? por e-mail também?) e os últimos 5 que saíram (só o post, se eu posso vê-lo). */
create or replace function public.rede_org_boletim(p_handle text) returns jsonb language plpgsql stable security definer set search_path = interno, pg_temp as $$
declare v uuid := auth.uid(); o uuid := interno.alumia_org_de(p_handle); a rede_org_boletim_assinaturas;
begin
  perform interno.limite('alumia_o12_ler', 300, 10);
  if o is null or v is null or interno.rede_bloqueado(v, o) or not interno.rede2_membro(v) then return null; end if;
  select * into a from rede_org_boletim_assinaturas where org = o and usuario = v;
  return jsonb_build_object('assino', a.usuario is not null, 'email', coalesce(a.email, false),
    'saidos', coalesce((select jsonb_agg(jsonb_build_object('post', b.post, 'saiuEm', b.saiu_em) order by b.saiu_em desc)
      from (select b.* from rede_org_boletins b join rede_posts p on p.id = b.post where b.org = o and interno.rede_ve(p, v) order by b.saiu_em desc limit 5) b), '[]'::jsonb));
end $$;

/** Pedir (ou parar) o boletim de uma organização; `p_email`: também por e-mail, para o endereço da própria conta. */
create or replace function public.rede_org_boletim_assinar(p_handle text, p_sim boolean, p_email boolean) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); o uuid := interno.alumia_org_de(p_handle);
begin
  perform interno.rede3_perfil_exige_membro(v);
  if o is null or o = v or interno.rede_bloqueado(v, o) then perform interno.erro('nao_encontrado'); end if;
  perform interno.limite('alumia_o12_assinar', 30, 60);
  if coalesce(p_sim, false) then
    insert into rede_org_boletim_assinaturas (org, usuario, email) values (o, v, coalesce(p_email, false))
    on conflict (org, usuario) do update set email = excluded.email;
  else
    delete from rede_org_boletim_assinaturas where org = o and usuario = v;
  end if;
  return public.rede_org_boletim(p_handle);
end $$;

-- ── 8. Domínio próprio ────────────────────────────────────────────────────────────────────────────────────────────────────

/** O domínio limpo (minúsculas, sem esquema, sem caminho, sem ponto no fim) ou nulo se não serve. */
create or replace function interno.alumia_o12_dominio_limpo(p text) returns text language plpgsql stable security definer set search_path = interno, pg_temp as $$
declare d text := lower(btrim(coalesce(p, '')));
begin
  d := regexp_replace(d, '^[a-z][a-z0-9+.-]*://', '');
  d := regexp_replace(d, '[/?#:].*$', '');
  d := regexp_replace(d, '\.+$', '');
  d := regexp_replace(d, '^www\.', '');
  if char_length(d) not between 4 and 253 or d !~ '^([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z][a-z0-9-]{0,61}[a-z0-9]$'
     or d ~ '^[0-9.]+$' or interno.alumia_o12_dominio_reservado(d) then
    return null;
  end if;
  return d;
end $$;

/**
 * Escolher o domínio (só quem gerencia, só organização com selo). Gera um desafio novo: o domínio só passa a "verificado" quando o
 * servidor do site achar o desafio no TXT ou no arquivo. Trocar de domínio volta a "esperando".
 */
create or replace function public.rede_org_dominio_pedir(p_handle text, p_dominio text) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare o uuid := interno.alumia_org_gestor(p_handle, 'alumia_o12_dominio', 10, 60); d text := interno.alumia_o12_dominio_limpo(p_dominio);
begin
  if not exists (select 1 from rede_orgs where perfil = o and verificada_em is not null) then perform interno.erro('sem_selo'); end if;
  if d is null then perform interno.erro('invalido:dominio'); end if;
  if exists (select 1 from rede_org_dominios where dominio = d and situacao = 'verificado' and org <> o) then perform interno.erro('dominio_em_uso'); end if;
  insert into rede_org_dominios (org, dominio, desafio) values (o, d, replace(gen_random_uuid()::text, '-', ''))
  on conflict (org) do update set dominio = excluded.dominio, desafio = excluded.desafio, situacao = 'esperando', metodo = null,
    pedido_dia = current_date, verificado_em = null, conferido_em = null
  where rede_org_dominios.dominio is distinct from excluded.dominio or rede_org_dominios.situacao <> 'verificado';
  return interno.alumia_o12_dominio_json(o);
end $$;

/** Tirar o domínio do perfil (só quem gerencia). */
create or replace function public.rede_org_dominio_tirar(p_handle text) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare o uuid := interno.alumia_org_gestor(p_handle, 'alumia_o12_dominio', 10, 60);
begin
  delete from rede_org_dominios where org = o;
  return jsonb_build_object('ok', true);
end $$;

/**
 * O que o servidor do site precisa para conferir (chamado COMO a pessoa, pela rota app/api/rede/org/dominio): a organização, o
 * domínio e o desafio. Só quem gerencia, só com selo, no máximo 10 conferências por hora.
 */
create or replace function public.rede_org_dominio_para_conferir(p_handle text) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare o uuid := interno.alumia_org_gestor(p_handle, 'alumia_o12_conferir', 10, 60); d rede_org_dominios;
begin
  if not exists (select 1 from rede_orgs where perfil = o and verificada_em is not null) then perform interno.erro('sem_selo'); end if;
  select * into d from rede_org_dominios where org = o;
  if not found then perform interno.erro('nao_encontrado'); end if;
  return jsonb_build_object('org', o, 'dominio', d.dominio, 'desafio', d.desafio);
end $$;

/**
 * O resultado da conferência (SÓ a chave de serviço, a rota do servidor). Vale só se o domínio e o desafio ainda são os mesmos (se
 * quem gerencia trocou no meio, nada muda). Achou: verificado, com o método. Não achou: um domínio que estava verificado continua
 * (uma falha de rede não tira o domínio do perfil); só o que esperava continua esperando.
 */
create or replace function public.rede_org_dominio_resultado(p_org uuid, p_dominio text, p_desafio text, p_ok boolean, p_metodo text) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare d rede_org_dominios;
begin
  if not interno.servico() then perform interno.erro('sem_permissao'); end if;
  select * into d from rede_org_dominios where org = p_org and dominio = p_dominio and desafio = p_desafio for update;
  if not found or not exists (select 1 from rede_orgs where perfil = p_org and verificada_em is not null) then perform interno.erro('nao_encontrado'); end if;
  if coalesce(p_ok, false) then
    if p_metodo is null or p_metodo not in ('txt', 'arquivo') then perform interno.erro('invalido:metodo'); end if;
    if exists (select 1 from rede_org_dominios where dominio = d.dominio and situacao = 'verificado' and org <> p_org) then perform interno.erro('dominio_em_uso'); end if;
    update rede_org_dominios set situacao = 'verificado', metodo = p_metodo, verificado_em = coalesce(case when situacao = 'verificado' then verificado_em end, now()), conferido_em = now()
     where org = p_org;
  else
    update rede_org_dominios set conferido_em = now() where org = p_org;
  end if;
  return interno.alumia_o12_dominio_json(p_org);
end $$;

/** O domínio verificado de uma organização, para o perfil (nulo sem selo ou sem domínio verificado). */
create or replace function public.rede_org_dominio(p_handle text) returns jsonb language plpgsql stable security definer set search_path = interno, pg_temp as $$
declare v uuid := auth.uid(); o uuid := interno.alumia_org_de(p_handle);
begin
  perform interno.limite('alumia_o12_ler', 300, 10);
  if o is null or interno.rede_bloqueado(v, o) or not exists (select 1 from rede_orgs where perfil = o and verificada_em is not null) then return null; end if;
  return (select jsonb_build_object('dominio', d.dominio, 'desde', d.verificado_em::date) from rede_org_dominios d where d.org = o and d.situacao = 'verificado');
end $$;

/** Para a Faixa 2 (WebFinger pelo domínio): a organização com selo dona deste domínio verificado, ou nulo. Só dentro do banco. */
create or replace function interno.rede_org_por_dominio(p_dominio text) returns uuid language sql stable security definer set search_path = interno, pg_temp as $$
  select d.org from rede_org_dominios d join rede_orgs o on o.perfil = d.org join perfis f on f.id = d.org
   where d.dominio = lower(btrim(coalesce(p_dominio, ''), ' .')) and d.situacao = 'verificado' and o.verificada_em is not null and not f.suspenso
$$;

-- ── 9. Permissões ─────────────────────────────────────────────────────────────────────────────────────────────────────────

revoke all on function interno.alumia_o12_comunica(uuid, uuid), interno.alumia_o12_org_de(text, text, integer, integer), interno.alumia_o12_chama(uuid, uuid),
  interno.alumia_o12_teto(uuid), interno.alumia_o12_postar(uuid, text, text, text, text, text, uuid), interno.alumia_o12_vencer(uuid),
  interno.alumia_o12_item(uuid, uuid), interno.alumia_o12_dominio_json(uuid), interno.alumia_o12_dominio_reservado(text),
  interno.alumia_o12_dominio_limpo(text), interno.rede_org_por_dominio(text), interno.alumia_o12_cabe_no_boletim(uuid, uuid, text) from public;
revoke all on function public.rede_org_dominio_resultado(uuid, text, text, boolean, text) from public;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on function interno.alumia_o12_comunica(uuid, uuid), interno.alumia_o12_org_de(text, text, integer, integer), interno.alumia_o12_chama(uuid, uuid),
      interno.alumia_o12_teto(uuid), interno.alumia_o12_postar(uuid, text, text, text, text, text, uuid), interno.alumia_o12_vencer(uuid),
      interno.alumia_o12_item(uuid, uuid), interno.alumia_o12_dominio_json(uuid), interno.alumia_o12_dominio_reservado(text),
      interno.alumia_o12_dominio_limpo(text), interno.rede_org_por_dominio(text), interno.alumia_o12_cabe_no_boletim(uuid, uuid, text) from anon, authenticated;
    revoke all on function public.rede_org_dominio_resultado(uuid, text, text, boolean, text) from anon, authenticated;
    -- Visitante não chama nenhuma função de conta desta frente (todas pedem quem é membro): só quem tem conta.
    revoke all on function public.rede_org_boletim(text), public.rede_org_boletim_assinar(text, boolean, boolean), public.rede_org_boletim_propor(text, jsonb),
      public.rede_org_comunicacao(text), public.rede_org_dominio(text), public.rede_org_dominio_para_conferir(text), public.rede_org_dominio_pedir(text, text),
      public.rede_org_dominio_tirar(text), public.rede_org_fila_decidir(uuid, boolean, text), public.rede_org_fila_escrever(text, jsonb),
      public.rede_org_fila_retirar(uuid), public.rede_org_modelo_apagar(text, uuid), public.rede_org_modelo_salvar(text, jsonb),
      public.rede_org_nucleo_chamar(uuid, text) from public, anon;
    grant execute on function public.rede_org_boletim(text), public.rede_org_boletim_assinar(text, boolean, boolean), public.rede_org_boletim_propor(text, jsonb),
      public.rede_org_comunicacao(text), public.rede_org_dominio(text), public.rede_org_dominio_para_conferir(text), public.rede_org_dominio_pedir(text, text),
      public.rede_org_dominio_tirar(text), public.rede_org_fila_decidir(uuid, boolean, text), public.rede_org_fila_escrever(text, jsonb),
      public.rede_org_fila_retirar(uuid), public.rede_org_modelo_apagar(text, uuid), public.rede_org_modelo_salvar(text, jsonb),
      public.rede_org_nucleo_chamar(uuid, text) to authenticated;
  end if;
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant execute on function public.rede_org_dominio_resultado(uuid, text, text, boolean, text) to service_role;
  end if;
end $$;

-- ── 10. A porta ───────────────────────────────────────────────────────────────────────────────────────────────────────────
-- Toda função public.rede_* nova que anon ou authenticated chamam passa pela porta da entrada. "abertas" tem de vir vazia.
select interno.alumia_trancar();
