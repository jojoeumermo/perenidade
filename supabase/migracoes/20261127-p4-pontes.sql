-- Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
-- Alumia · Prompt 4 · pontes, acessibilidade e lacunas (itens 81 a 88 e 130 a 134), atrás do interruptor "alumia-p4-pontes".
--
-- Roda depois de 20261126-p5-fim.sql (banco na versão 17), junto das outras 20261127-p4-*; quem junta põe esta antes do
-- 20261127-p4-fim.sql, que continua o último. Não mexe em rede_alumia_versao nem na lista de exceções da porta.
--
-- O que faz no banco (o resto do lote mora no aparelho ou nas rotas do servidor):
--   0    o interruptor, no catálogo (só pelo nome, desligado), e interno.rede_p4_pontes_ligado();
--   82   federação só com servidores aprovados: o modo "só os aprovados" e a lista de servidores (nomes de servidor, nunca de
--        pessoa), só pela mediação. Com o modo ligado, todo servidor fora da lista conta como bloqueado (interno.rede_fed_bloqueado
--        é o ponto único que a entrada, a saída, a busca e a rota-proxy já conferem). Ligar o modo NÃO apaga nada: desligar volta
--        ao que era. O bloqueio fixo (Threads e Bridgy Fed) continua valendo por cima da lista;
--   81   o ato como evento no Fediverso: o documento do post de um ato leva só o ponto público (título, começo, ponto, cidade e
--        situação); quem confirmou, quantos e a meta nunca saem. Mudar horário, ponto ou situação manda a atualização;
--   85   a ponte com o Bluesky: a escolha da comunidade aberta fica guardada, mas a ponte NÃO liga enquanto o Bridgy Fed estiver no
--        bloqueio fixo (decisão do Instituto, 20261110-fediverso-bloqueio-padrao.sql). interno.rede_p4_bluesky_ativa() diz não;
--   86   os avisos de ato no canal do Telegram da organização: o post do ato sai como aviso de ato (título, quando, onde, cidade e
--        o endereço), e adiar ou cancelar sai uma vez cada. Só atos que podem sair da Alumia; nenhum dado de conta;
--   131  avisos só de quem eu sigo: menção e resposta de quem a pessoa não segue continuam na tela de avisos, mas não viram push;
--   132  "pouco útil" nas respostas: voto secreto (o banco guarda só a marca, o HMAC que o servidor do site calcula com o segredo do
--        voto, que o banco não tem: nem quem tem o banco inteiro liga a marca à conta; nunca a conta nem a hora). O voto chega só pelo
--        servidor do site (chave de serviço). Nenhuma função devolve o total nem quem votou, e a resposta só desce entre as irmãs a
--        partir de 3 votos de contas diferentes;
--   133  o leitor de fios: o fio de uma autora (as respostas dela a ela mesma) como texto corrido, só o que quem lê já pode ver
--        (interno.rede_ve), sem post cifrado nem de núcleo.
--   (83, 84, 87, 88, 130 e 134 não precisam de banco novo: ver o relatório do lote.)
--
-- Funções existentes redefinidas (corpo inteiro tirado do banco montado, versão 18; cada uma muda só no ponto dito):
--   interno.rede_fed_bloqueado(text)               + o modo "só os aprovados" (82);
--   interno.rede_fed_post_json(interno.rede_posts) + o campo "ato" com o ponto público (81);
--   public.rede_pontes_telegram_pendentes(integer) + o campo "ato" para o aviso de ato (86);
--   public.rede_aviso_push_pendentes(integer)      + a escolha "só de quem eu sigo" (131);
--   public.rede_conv_arvore(uuid, text)            + a resposta com 3 "pouco útil" ou mais desce entre as irmãs (132).
--
-- Tabelas em interno, RLS ligada e sem política, nenhuma permissão direta. Nenhuma função devolve lista de pessoas. Endereço de
-- rede de pessoa: nada daqui lê ou guarda (o que entra na lista de aprovados é o nome de um servidor, digitado pela mediação).
-- Pode rodar mais de uma vez, sem apagar dado nenhum.
-- Lei: LGPD art. 6º, III (necessidade: só o ponto público do ato sai; o voto "pouco útil" não guarda a conta) e art. 46
-- (segurança: a federação pode ficar só com servidores conhecidos); Lei 13.146/2015 (Estatuto da Pessoa com Deficiência), art. 63
-- (acessibilidade nos sítios), pelos itens 87 e 88, que moram na tela.
-- Teste: npm run testar:p4-pontes.

-- ── 0. O interruptor ───────────────────────────────────────────────────────────────────────────────────────────────────────
do $$
begin
  if to_regclass('interno.recursos_catalogo') is not null then
    insert into interno.recursos_catalogo (nome, so_pelo_nome) values ('alumia-p4-pontes', true)
      on conflict (nome) do update set so_pelo_nome = true;
  end if;
end $$;

/** O lote das pontes do prompt 4 está ligado? Desligado com a Alumia (rede-v2, alumia-2) desligada; sem decisão no painel, desligado. */
create or replace function interno.rede_p4_pontes_ligado() returns boolean language plpgsql stable security definer set search_path = interno, pg_temp as $$
begin
  if to_regclass('interno.recursos_vivos') is null then return false; end if;
  if exists (select 1 from recursos_vivos where nome in ('rede-v2', 'alumia-2') and not ligado) then return false; end if;
  return coalesce((select ligado from recursos_vivos where nome = 'alumia-p4-pontes'), false);
end $$;

-- ── 82. Federação só com servidores aprovados ──────────────────────────────────────────────────────────────────────────────

-- O modo (uma linha só). Ligado, só os servidores da lista conversam com a Alumia.
create table if not exists interno.rede_p4_fed_modo (
  um boolean primary key default true check (um),
  so_aprovados boolean not null default false,
  mudado_em date not null default current_date
);
alter table interno.rede_p4_fed_modo enable row level security;

-- A lista de servidores aprovados. Só o nome do servidor e o dia; quem aprovou não fica guardado aqui (fica no registro da mediação).
create table if not exists interno.rede_p4_fed_aprovados (
  dominio text primary key check (dominio ~ '^[a-z0-9.-]{3,253}$' or dominio ~ '^\[[0-9a-f:.]{2,45}\]$'),
  desde date not null default current_date
);
alter table interno.rede_p4_fed_aprovados enable row level security;

/** O modo "só os aprovados" vale agora? Só com o lote ligado. */
create or replace function interno.rede_p4_fed_so_aprovados() returns boolean language sql stable security definer set search_path = interno, pg_temp as $$
  select interno.rede_p4_pontes_ligado() and coalesce((select so_aprovados from rede_p4_fed_modo where um), false)
$$;

/** O servidor deste endereço (ou um servidor do qual ele é subdomínio) está na lista de aprovados? */
create or replace function interno.rede_p4_fed_aprovado(p_url text) returns boolean language sql stable security definer set search_path = interno, pg_temp as $$
  select exists (select 1 from rede_p4_fed_aprovados a, lateral (select rtrim(lower(substring(coalesce(p_url, '') from '^https://(?:[^/?#]*@)?(\[[0-9A-Fa-f:.]+\]|[^/:?#\[\]]+)')), '.') as d) x
                 where x.d = a.dominio or x.d like '%.' || a.dominio)
$$;

/**
 * A instância deste endereço está bloqueada (ela ou um subdomínio dela)? Igual à da r1 (20261123-r1-fediverso.sql), e mais
 * (Prompt 4, item 82): com o modo "só os aprovados" ligado, todo endereço https cujo servidor não está na lista conta como
 * bloqueado. Endereço vazio ou que não é https continua "não bloqueado" (quem chama confere o formato antes).
 */
create or replace function interno.rede_fed_bloqueado(p_url text) returns boolean language sql stable security definer set search_path = interno, pg_temp as $$
  select exists (select 1 from rede_fed_bloqueados b, lateral (select rtrim(lower(substring(coalesce(p_url, '') from '^https://(?:[^/?#]*@)?(\[[0-9A-Fa-f:.]+\]|[^/:?#\[\]]+)')), '.') as d) x
                 where x.d = b.dominio or x.d like '%.' || b.dominio)
      or (coalesce(p_url, '') ~ '^https://' and interno.rede_p4_fed_so_aprovados() and not interno.rede_p4_fed_aprovado(p_url))
$$;

/** O nome de servidor como a mediação o digitou: sem espaço, minúsculo, sem "https://", sem caminho e sem o ponto do fim. */
create or replace function interno.rede_p4_fed_nome(p_dominio text) returns text language sql immutable as $$
  select rtrim(regexp_replace(regexp_replace(lower(btrim(coalesce(p_dominio, ''))), '^https?://', ''), '/.*$', ''), '.')
$$;

/** A lista e o modo, para a mediação. Só nomes de servidor (nenhuma pessoa). */
create or replace function public.rede_p4_fed_aprovados_ver() returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
begin
  if not (interno.media() or interno.cuida()) then perform interno.erro('sem_permissao'); end if;
  return jsonb_build_object(
    'ligado', interno.rede_p4_pontes_ligado(),
    'so_aprovados', coalesce((select so_aprovados from rede_p4_fed_modo where um), false),
    'lista', coalesce((select jsonb_agg(jsonb_build_object('dominio', dominio, 'desde', desde) order by dominio) from rede_p4_fed_aprovados), '[]'::jsonb));
end $$;

/** Põe (p_sim) ou tira um servidor da lista de aprovados. Só a mediação; anota no registro da mediação, como o bloqueio. */
create or replace function public.rede_p4_fed_aprovar(p_dominio text, p_sim boolean) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v_d text := interno.rede_p4_fed_nome(p_dominio);
begin
  if not (interno.media() or interno.cuida()) then perform interno.erro('sem_permissao'); end if;
  if not interno.rede_p4_pontes_ligado() then perform interno.erro('desligado'); end if;
  if not (v_d ~ '^[a-z0-9.-]{3,253}$' and v_d ~ '\.' and v_d !~ '^[.-]|[.-]$|\.\.') then perform interno.erro('invalido:dominio'); end if;
  perform interno.limite('rede_p4_fed_aprovar', 120, 60);
  if coalesce(p_sim, false) then
    insert into rede_p4_fed_aprovados (dominio) values (v_d) on conflict (dominio) do nothing;
  else
    delete from rede_p4_fed_aprovados where dominio = v_d;
  end if;
  return public.rede_p4_fed_aprovados_ver();
end $$;

/** Liga ou desliga o modo "só os aprovados". Ligar não apaga nada (desligar volta ao que era). Só a mediação. */
create or replace function public.rede_p4_fed_modo(p_so_aprovados boolean) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
begin
  if not (interno.media() or interno.cuida()) then perform interno.erro('sem_permissao'); end if;
  if not interno.rede_p4_pontes_ligado() then perform interno.erro('desligado'); end if;
  perform interno.limite('rede_p4_fed_aprovar', 120, 60);
  insert into rede_p4_fed_modo (um, so_aprovados) values (true, coalesce(p_so_aprovados, false))
    on conflict (um) do update set so_aprovados = excluded.so_aprovados, mudado_em = current_date;
  return public.rede_p4_fed_aprovados_ver();
end $$;

-- ── 81. O ato como evento no Fediverso ─────────────────────────────────────────────────────────────────────────────────────

/** O ponto público de um ato, para o documento do Fediverso (só com o lote ligado). Nunca quem confirmou, quantos nem a meta. */
create or replace function interno.rede_p4_ato_publico(p_post uuid) returns jsonb language sql stable security definer set search_path = interno, pg_temp as $$
  select case when interno.rede_p4_pontes_ligado() then (
    select jsonb_build_object('titulo', coalesce(c.titulo, ''), 'inicio', c.inicio, 'fim', c.fim, 'onde', c.ponto, 'cidade', c.cidade,
                              'situacao', c.situacao, 'tipo', c.tipo)
      from rede_chamados c where c.post = p_post) end
$$;

create or replace function interno.rede_fed_post_json(p interno.rede_posts) returns jsonb language sql stable security definer set search_path = interno, pg_temp as $$
  select jsonb_build_object('id', p.id, 'tipo', p.tipo, 'titulo', p.titulo, 'texto', p.texto, 'corpo', p.corpo, 'aviso', p.aviso,
    'criado_em', p.criado_em, 'editado_em', p.editado_em, 'resposta_a', p.resposta_a, 'comunidade', p.comunidade,
    'handle', (select handle from rede_fed_atores where perfil = p.autor),
    'raiz', coalesce(p.root_id, p.id),
    'visibilidade', 'publico',
    'resposta_a_remota', p.resposta_a_remota,
    'midia', (select coalesce(jsonb_agg(jsonb_build_object('id', m.id, 'tipo', m.tipo, 'alt', m.alt, 'largura', m.largura, 'altura', m.altura,
                                                           'blurhash', m.blurhash, 'ordem', m.ordem) order by m.ordem), '[]'::jsonb)
              from rede_midia m where m.post = p.id),
    'mencoes', (select coalesce(jsonb_agg(jsonb_build_object('handle', r.handle, 'ator', r.ator, 'inbox', r.inbox) order by r.handle), '[]'::jsonb)
                from interno.rede_fed_mencionados(p) r))
  -- Prompt 4, item 81: o ponto público do ato (só com o lote ligado; sem ele, a chave nem aparece).
  || coalesce((select jsonb_build_object('ato', a.j) from (select interno.rede_p4_ato_publico(p.id) as j) a where a.j is not null), '{}'::jsonb)
$$;

/** O ato mudou (horário, ponto, cidade, nome ou situação) e o post já saiu: a atualização vai a quem segue lá fora. */
create or replace function interno.rede_p4_ato_mudou() returns trigger language plpgsql security definer set search_path = interno, pg_temp as $$
declare v_perfil uuid;
begin
  if not interno.rede_p4_pontes_ligado() then return null; end if;
  if (new.inicio, new.ponto, new.cidade, coalesce(new.titulo, ''), new.situacao) is not distinct from (old.inicio, old.ponto, old.cidade, coalesce(old.titulo, ''), old.situacao) then
    return null;
  end if;
  select perfil into v_perfil from rede_fed_enviados where post = new.post and apagado_em is null;
  if v_perfil is not null then perform interno.rede_fed_espalhar(v_perfil, 'update', new.post::text); end if;
  return null;
exception when others then
  return null;
end $$;
drop trigger if exists rede_p4_ato_mudou on interno.rede_chamados;
create trigger rede_p4_ato_mudou after update on interno.rede_chamados for each row execute function interno.rede_p4_ato_mudou();

-- ── 85. A ponte com o Bluesky (a opção existe; a ponte não liga) ───────────────────────────────────────────────────────────

-- A escolha da comunidade aberta. Só o dia; quem escolheu não fica guardado (a escolha é da comunidade).
create table if not exists interno.rede_p4_bluesky (
  comunidade text primary key references interno.rede_comunidades (slug) on delete cascade on update cascade,
  desde date not null default current_date
);
alter table interno.rede_p4_bluesky enable row level security;

/** O Bridgy Fed (a ponte) está no bloqueio fixo? Enquanto estiver, nenhuma comunidade vai para o Bluesky. */
create or replace function interno.rede_p4_bluesky_barrado() returns boolean language sql stable security definer set search_path = interno, pg_temp as $$
  select exists (select 1 from rede_fed_bloqueados where dominio = 'brid.gy' and fixo) or interno.rede_fed_bloqueado('https://bsky.brid.gy/')
$$;

/** A ponte desta comunidade vale agora? Lote ligado, comunidade aberta que escolheu, federação das comunidades ligada e a ponte fora do bloqueio. */
create or replace function interno.rede_p4_bluesky_ativa(p_slug text) returns boolean language sql stable security definer set search_path = interno, pg_temp as $$
  select interno.rede_p4_pontes_ligado() and interno.rede_fed_grupo_ok(p_slug) and not interno.rede_p4_bluesky_barrado()
     and exists (select 1 from rede_p4_bluesky b where b.comunidade = p_slug)
$$;

/** A escolha da comunidade (para a moderação dela): escolheu, se vale agora e por que não. */
create or replace function public.rede_p4_bluesky_ver(p_slug text) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu();
begin
  if not interno.rede3_com_modera(p_slug, v) then perform interno.erro('sem_permissao'); end if;
  return jsonb_build_object(
    'escolheu', exists (select 1 from rede_p4_bluesky where comunidade = p_slug),
    'aberta', exists (select 1 from rede_comunidades where slug = p_slug and tipo = 'aberta'),
    'ativa', interno.rede_p4_bluesky_ativa(p_slug),
    'barrada', interno.rede_p4_bluesky_barrado(),
    'ligado', interno.rede_p4_pontes_ligado());
end $$;

/** A moderação de uma comunidade ABERTA escolhe (ou desfaz). Guardar não liga a ponte: ela depende de decisão do Instituto. */
create or replace function public.rede_p4_bluesky_escolher(p_slug text, p_sim boolean) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu();
begin
  if not interno.rede3_com_modera(p_slug, v) then perform interno.erro('sem_permissao'); end if;
  perform interno.limite('rede_p4_bluesky', 30, 60);
  if coalesce(p_sim, false) then
    if not interno.rede_p4_pontes_ligado() then perform interno.erro('desligado'); end if;
    if not exists (select 1 from rede_comunidades where slug = p_slug and tipo = 'aberta') then perform interno.erro('so_comunidade_aberta'); end if;
    insert into rede_p4_bluesky (comunidade) values (p_slug) on conflict (comunidade) do nothing;
  else
    delete from rede_p4_bluesky where comunidade = p_slug;
  end if;
  return public.rede_p4_bluesky_ver(p_slug);
end $$;

-- ── 86. Os avisos de ato no canal do Telegram ──────────────────────────────────────────────────────────────────────────────

-- As mudanças de ato que já saíram (adiado ou cancelado, uma vez cada). Some em 30 dias.
create table if not exists interno.rede_p4_telegram_atos (
  post uuid not null references interno.rede_posts (id) on delete cascade,
  situacao text not null check (situacao in ('adiado', 'cancelado')),
  inicio timestamptz not null,
  quando timestamptz not null default now(),
  estado text not null default 'saindo' check (estado in ('saindo', 'saiu', 'falhou')),
  primary key (post, situacao, inicio)
);
alter table interno.rede_p4_telegram_atos enable row level security;

/** O ato que vai no aviso do Telegram (só com o lote ligado): só o ponto público. */
create or replace function interno.rede_p4_telegram_ato(p_post uuid) returns jsonb language sql stable security definer set search_path = interno, pg_temp as $$
  select case when interno.rede_p4_pontes_ligado() then (
    select jsonb_build_object('titulo', coalesce(c.titulo, ''), 'inicio', c.inicio, 'onde', c.ponto, 'cidade', c.cidade, 'situacao', c.situacao,
                              'motivo', left(coalesce(c.motivo, ''), 200))
      from rede_chamados c where c.post = p_post) end
$$;

/**
 * Só a chave de serviço (app/api/rede/telegram): os posts que saem agora. A mesma de 20261119-alumia-o13-pontes.sql e, com o lote
 * das pontes ligado (Prompt 4, item 86), o post de um ato leva o campo "ato" (o ponto público), para sair como aviso de ato.
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
      v := v || jsonb_strip_nulls(jsonb_build_object('post', r.id, 'canal', r.canal, 'titulo', r.titulo, 'texto', left(r.texto, 3500),
                                                     'ato', interno.rede_p4_telegram_ato(r.id)));
    end if;
  end loop;
  return v;
end $$;

/**
 * Só a chave de serviço: os atos de organização que mudaram (adiado ou cancelado) depois de sair no canal. Cada mudança sai uma
 * vez. Só ato que ainda pode sair da Alumia, de organização com selo e canal ligado. Nada de quem confirmou.
 */
create or replace function public.rede_p4_telegram_atos_pendentes(p_limite integer) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v jsonb := '[]'::jsonb; r record;
begin
  if not interno.servico() then perform interno.erro('sem_permissao'); end if;
  if not interno.rede_p4_pontes_ligado() or not interno.alumia_pontes_ligado('alumia-telegram') or not interno.alumia_pontes_painel('alumia-org') then return v; end if;
  delete from rede_p4_telegram_atos where quando < now() - interval '30 days';
  for r in
    select p.id, t.canal, c.situacao, c.inicio from rede_pontes_telegram t
    join rede_posts p on p.autor = t.org
    join rede_chamados c on c.post = p.id
    join rede_pontes_telegram_envios e on e.post = p.id and e.situacao = 'saiu'
    where t.ligado and interno.alumia_pontes_selo(t.org)
      and c.situacao in ('adiado', 'cancelado') and c.inicio > now() - interval '1 day'
      and p.apagado_em is null and interno.alumia_alc_sai(p)
      and not exists (select 1 from rede_p4_telegram_atos a where a.post = p.id and a.situacao = c.situacao and a.inicio = c.inicio)
    order by c.inicio limit least(greatest(coalesce(p_limite, 20), 1), 50)
  loop
    insert into rede_p4_telegram_atos (post, situacao, inicio) values (r.id, r.situacao, r.inicio) on conflict do nothing;
    if found then
      v := v || jsonb_build_object('post', r.id, 'canal', r.canal, 'titulo', null, 'texto', '', 'ato', interno.rede_p4_telegram_ato(r.id));
    end if;
  end loop;
  return v;
end $$;

/** Só a chave de serviço: o resultado do aviso de mudança. */
create or replace function public.rede_p4_telegram_atos_resultado(p_post uuid, p_situacao text, p_ok boolean) returns void language plpgsql security definer set search_path = interno, pg_temp as $$
begin
  if not interno.servico() then perform interno.erro('sem_permissao'); end if;
  update rede_p4_telegram_atos set estado = case when p_ok then 'saiu' else 'falhou' end
   where post = p_post and situacao = p_situacao and estado = 'saindo';
end $$;

-- ── 131. Avisos só de quem eu sigo ─────────────────────────────────────────────────────────────────────────────────────────

-- Quem escolheu: só a pessoa (a escolha é dela) e o dia.
create table if not exists interno.rede_p4_avisos_so_seguidos (
  usuario uuid primary key references interno.perfis (id) on delete cascade,
  desde date not null default current_date
);
alter table interno.rede_p4_avisos_so_seguidos enable row level security;

/**
 * Este aviso vira push? A preferência de sempre (interno.rede3_aviso_pref) e, com o lote ligado e a escolha "só de quem eu sigo",
 * menção e resposta (daqui ou de fora) só de quem a pessoa segue. O aviso continua na tela de avisos de qualquer jeito.
 */
create or replace function interno.rede_p4_aviso_empurra(p_para uuid, p_tipo text, p_ator uuid, p_ator_remoto text) returns boolean
language sql stable security definer set search_path = interno, pg_temp as $$
  select interno.rede3_aviso_pref(p_para, p_tipo, 'push')
     and (p_tipo not in ('mencao', 'resposta', 'fed_mencao', 'fed_resposta')
          or not interno.rede_p4_pontes_ligado()
          or not exists (select 1 from rede_p4_avisos_so_seguidos s where s.usuario = p_para)
          or (p_ator is not null and exists (select 1 from rede_seguindo g where g.quem = p_para and g.segue = p_ator and not g.pendente))
          or (p_ator_remoto is not null and exists (select 1 from rede_fed_seguindo f where f.perfil = p_para and f.ator = p_ator_remoto and f.aceito)))
$$;

/**
 * Para a função enviar-push (só a chave de serviço): a mesma de 20261117 (o horário de silêncio) e, agora, a escolha "só de quem eu
 * sigo" (Prompt 4, item 131): no lugar de interno.rede3_aviso_pref(..., 'push'), interno.rede_p4_aviso_empurra, que sem o lote
 * ligado é a mesma coisa. O aviso que não empurra fica marcado como empurrado só se a preferência for a de sempre; o que a escolha
 * nova segura também não volta (não é para notificar depois).
 */
create or replace function public.rede_aviso_push_pendentes(p_limite integer default 50) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare r record; s record; v_n integer; v_out jsonb := '[]'::jsonb;
begin
  if not interno.servico() then perform interno.erro('sem_permissao'); end if;
  if not pg_try_advisory_xact_lock(hashtext('rede_push')) then return v_out; end if;
  for r in select distinct a.usuario from rede_push_assinaturas a
           where not exists (select 1 from rede_push_assinaturas t where t.usuario = a.usuario and t.ultimo_envio > now() - interval '10 minutes')
             and not interno.alumia_em_silencio(a.usuario)
             and exists (select 1 from avisos x where x.para = a.usuario and x.categoria = 'rede' and x.tipo is not null and not x.lido and not x.empurrado
                         and x.criado_em > a.criado_em and interno.rede_p4_aviso_empurra(x.para, x.tipo, x.ator, x.ator_remoto))
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

/** A escolha da própria pessoa (p_sim nulo = só ler). Só a dela; nunca a de outra pessoa. */
create or replace function public.rede_p4_avisos_so_seguidos(p_sim boolean default null) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu();
begin
  if p_sim is not null then
    perform interno.limite('rede_avisos_prefs', 120, 60);
    if p_sim then
      if not interno.rede_p4_pontes_ligado() then perform interno.erro('desligado'); end if;
      insert into rede_p4_avisos_so_seguidos (usuario) values (v) on conflict (usuario) do nothing;
    else
      delete from rede_p4_avisos_so_seguidos where usuario = v;
    end if;
  end if;
  return jsonb_build_object('so_seguidos', exists (select 1 from rede_p4_avisos_so_seguidos where usuario = v), 'ligado', interno.rede_p4_pontes_ligado());
end $$;

-- ── 132. "Pouco útil" nas respostas ────────────────────────────────────────────────────────────────────────────────────────

-- O voto é secreto também perante quem tem o banco (auditoria do P4, M1): a marca é o HMAC-SHA-256 calculado no SERVIDOR DO SITE com
-- o segredo do voto (ALUMIA_VOTO_SEGREDO, que nunca vai ao banco; lib/rede/voto/servidor.ts, tipo "pouco_util"), como a marca das
-- enquetes. A primeira versão do lote guardava um sal numa tabela daqui e calculava sha256(sal ‖ resposta ‖ conta) no banco: quem
-- abrisse o SQL Editor recalculava a marca de cada conta e descobria quem votou. O sal e a função saem; nada do que já foi marcado
-- com eles serve mais (o lote nunca rodou em produção). Num banco que já tinha o sal, as marcas antigas (que o sal ligava às contas)
-- saem junto, uma vez só.
do $$
begin
  if to_regclass('interno.rede_p4_pontes_sal') is not null and to_regclass('interno.rede_p4_pouco_util') is not null then
    delete from interno.rede_p4_pouco_util;
  end if;
end $$;
drop function if exists public.rede_p4_pouco_util(uuid, boolean);
drop function if exists public.rede_p4_pouco_util_meus(uuid[]);
drop function if exists interno.rede_p4_pouco_util_marca(uuid, uuid);
drop table if exists interno.rede_p4_pontes_sal;

-- O voto: só a resposta e a marca. Nem a conta, nem a hora, nem a ordem dos votos.
create table if not exists interno.rede_p4_pouco_util (
  post uuid not null references interno.rede_posts (id) on delete cascade,
  marca bytea not null check (octet_length(marca) = 32),
  primary key (post, marca)
);
alter table interno.rede_p4_pouco_util enable row level security;

/** A resposta desce? Só com o lote ligado e 3 marcas ou mais (contas diferentes). Só dentro do banco: nenhuma função pública devolve isto. */
create or replace function interno.rede_p4_pouco_util_desce(p_post uuid) returns boolean language sql stable security definer set search_path = interno, pg_temp as $$
  select interno.rede_p4_pontes_ligado() and (select count(*) from (select 1 from rede_p4_pouco_util u where u.post = p_post limit 3) z) >= 3
$$;

/**
 * Para o servidor do site (só a chave de serviço; app/api/alumia/voto/marca, tipo "pouco_util"): marca (p_sim) ou desfaz o "pouco
 * útil" numa RESPOSTA que a pessoa vê. As regras são conferidas com a pessoa que o servidor mandou (membro, não suspensa, vê a
 * resposta, não é a autora); gravada fica só a marca (64 letras hexadecimais, o HMAC do servidor). Devolve só o voto da própria
 * pessoa ({eu}); nunca o total, nunca quem votou. O freio é o do servidor (uma linha de freio aqui, com a pessoa, ligaria a ela o voto).
 */
create or replace function public.rede_p4_pouco_util(p_usuario uuid, p_post uuid, p_sim boolean, p_marca text) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare x rede_posts; v_marca bytea;
begin
  if not interno.servico() then perform interno.erro('sem_permissao'); end if;
  if p_marca is null or p_marca !~ '^[0-9a-f]{64}$' then perform interno.erro('invalido:marca'); end if;
  v_marca := decode(p_marca, 'hex');
  if p_usuario is null or not exists (select 1 from perfis where id = p_usuario and not suspenso) then perform interno.erro('sem_permissao'); end if;
  perform interno.rede3_perfil_exige_membro(p_usuario);
  select * into x from rede_posts where id = p_post;
  if not found or x.resposta_a is null or x.apagado_em is not null or not interno.rede_ve(x, p_usuario) then perform interno.erro('nao_encontrado'); end if;
  if x.autor = p_usuario then perform interno.erro('invalido:propria'); end if;
  if coalesce(p_sim, false) then
    if not interno.rede_p4_pontes_ligado() then perform interno.erro('desligado'); end if;
    insert into rede_p4_pouco_util (post, marca) values (x.id, v_marca) on conflict do nothing;
  else
    delete from rede_p4_pouco_util where post = x.id and marca = v_marca;
  end if;
  return jsonb_build_object('eu', exists (select 1 from rede_p4_pouco_util where post = x.id and marca = v_marca));
end $$;

/**
 * Para o servidor do site (só a chave de serviço; tipo "pouco_util_ver"): destas respostas (ids e as marcas da pessoa, que o servidor
 * calculou), em quais ela marcou "pouco útil" (só o dela, para o botão ficar marcado). Até 400. Com o lote desligado, nenhuma.
 */
create or replace function public.rede_p4_pouco_util_meus(p_marcas jsonb) returns jsonb language plpgsql stable security definer set search_path = interno, pg_temp as $$
begin
  if not interno.servico() then perform interno.erro('sem_permissao'); end if;
  if jsonb_typeof(p_marcas) is distinct from 'object' or not interno.rede_p4_pontes_ligado() then return '[]'::jsonb; end if;
  return coalesce((
    select jsonb_agg(k.key) from (select * from jsonb_each_text(p_marcas) limit 400) k
    where k.key ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' and k.value ~ '^[0-9a-f]{64}$'
      and exists (select 1 from rede_p4_pouco_util u where u.post = k.key::uuid and u.marca = decode(k.value, 'hex'))), '[]'::jsonb);
end $$;

-- A árvore da conversa: a do banco montado (a de 2026-11-rede-conversa.sql com o "útil" publicado em marcos de 15 minutos da onda 14,
-- interno.rede_util_publicado, conferido na junção); a única mudança (Prompt 4, item 132) é a primeira chave de ordem das
-- irmãs: a resposta com 3 "pouco útil" ou mais vai para o fim das irmãs, em qualquer ordem. Com o lote desligado, nada muda.
create or replace function public.rede_conv_arvore(p_id uuid, p_ordem text default 'uteis') returns jsonb language plpgsql volatile security definer set search_path = interno, pg_temp as $$
declare
  v_quem uuid := auth.uid(); v_ordem text := coalesce(nullif(btrim(p_ordem), ''), 'uteis');
  x rede_posts; v_raiz rede_posts; v_resp jsonb; v_cima jsonb; v_sint jsonb; v_n integer;
  v_aceita uuid;
begin
  perform interno.aberta('comunidade');
  perform interno.limite('rede2_ler', 600, 60);
  if v_ordem not in ('uteis', 'antigas', 'novas') then perform interno.erro('invalido:ordem'); end if;
  select * into x from rede_posts where id = p_id;
  if not found or not interno.rede_ve(x, v_quem) then perform interno.erro('nao_encontrado'); end if;
  v_raiz := interno.rede3_conv_raiz(x);
  v_aceita := case when v_raiz.tipo = 'duvida' then v_raiz.aceita end;

  with recursive cand as (
    select r.id, r.resposta_a, r.criado_em, 1 as n from rede_posts r where r.resposta_a = x.id and interno.rede_ve(r, v_quem)
    union all
    select r.id, r.resposta_a, r.criado_em, c.n + 1 from rede_posts r join cand c on r.resposta_a = c.id where c.n < 5 and interno.rede_ve(r, v_quem)),
  pontos as (
    select c.*, (c.id = v_aceita) as resolveu, coalesce(interno.rede_util_publicado(c.id), 0) as util,
      interno.rede_p4_pouco_util_desce(c.id) as desce
    from cand c),
  irmas as (
    select p.*, row_number() over (partition by p.resposta_a order by
      case when v_ordem = 'uteis' and p.resolveu then 0 else 1 end,
      case when p.desce then 1 else 0 end,
      case when v_ordem = 'uteis' then -p.util else 0 end,
      case when v_ordem = 'novas' then -extract(epoch from p.criado_em) else extract(epoch from p.criado_em) end, p.id) as pos
    from pontos p),
  ord as (
    select i.id, array[i.pos::integer] as caminho from irmas i where i.resposta_a = x.id
    union all
    select i.id, o.caminho || i.pos::integer from irmas i join ord o on i.resposta_a = o.id)
  select coalesce(jsonb_agg(
           case when interno.rede_silenciado(r, v_quem)
                then interno.rede_post_v2(r, v_quem) || jsonb_build_object('texto', '', 'titulo', null, 'corpo', null, 'longo', false, 'midia', '[]'::jsonb, 'citado', null, 'silenciada', true)
                else interno.rede_post_v2(r, v_quem) end
           order by z.caminho), '[]'::jsonb), count(*)::integer
    into v_resp, v_n
  from (select o.id, o.caminho from ord o order by o.caminho limit 400) z join rede_posts r on r.id = z.id;

  with recursive cima(id, n) as (
    select x.resposta_a, 1 where x.resposta_a is not null
    union all
    select r.resposta_a, c.n + 1 from rede_posts r join cima c on r.id = c.id where r.resposta_a is not null and c.n < 10)
  select coalesce(jsonb_agg(interno.rede_post_v2(r, v_quem) order by r.profundidade), '[]'::jsonb) into v_cima
  from rede_posts r where r.id in (select cima.id from cima) and interno.rede_ve(r, v_quem);

  if interno.rede_ve(v_raiz, v_quem) then
    select jsonb_build_object('id', s.id, 'texto', s.texto, 'autor', interno.rede_nome(s.autor), 'criado_em', s.criado_em, 'versoes', (select count(*)::integer from rede_sinteses h where h.raiz = s.raiz))
      into v_sint from rede_sinteses s where s.raiz = v_raiz.id and s.retirada_em is null;
  end if;

  return jsonb_build_object(
    'post', interno.rede_post_v2(x, v_quem, true), 'acima', v_cima, 'respostas', v_resp, 'sintese', v_sint, 'ordem', v_ordem,
    'raiz', v_raiz.id,
    'pode_aceitar', v_quem is not null and v_raiz.tipo = 'duvida' and (v_raiz.autor = v_quem or interno.rede3_conv_modera(v_raiz, v_quem)),
    'pode_sintese', v_quem is not null and interno.rede2_membro(v_quem) and (v_raiz.autor = v_quem or interno.rede3_conv_modera(v_raiz, v_quem)),
    'mais', jsonb_array_length(v_resp) >= 400);
end $$;

-- ── 133. O leitor de fios ──────────────────────────────────────────────────────────────────────────────────────────────────

/** O post entra no leitor? Aberto (nem cifrado, nem de núcleo), de pé, e que quem lê vê. */
create or replace function interno.rede_p4_fio_entra(p interno.rede_posts, p_quem uuid) returns boolean language sql stable security definer set search_path = interno, pg_temp as $$
  select p.id is not null and p.apagado_em is null and not p.oculto and not p.retido and p.nucleo is null
     and (to_jsonb(p) ->> 'corpo_grupo') is null and interno.rede_ve(p, p_quem) and not interno.rede_silenciado(p, p_quem)
$$;

/**
 * O fio de uma autora como texto corrido: sobe pelas respostas dela a ela mesma até o começo do fio e desce pela primeira resposta
 * dela a cada post dela (até 100 posts). Só junta o que quem lê já pode ver (interno.rede_ve); um post que não entra corta o fio
 * ali. Devolve {autor, itens: [{id, titulo, texto, corpo, criado_em}]}: o nome público da autora (codinome ou @), nunca outra pessoa.
 */
create or replace function public.rede_p4_fio_texto(p_id uuid) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := auth.uid(); x rede_posts; y rede_posts; v_itens jsonb := '[]'::jsonb; v_n integer := 0;
begin
  perform interno.aberta('comunidade');
  if not interno.rede_p4_pontes_ligado() then perform interno.erro('desligado'); end if;
  perform interno.limite('rede2_ler', 600, 60);
  select * into x from rede_posts where id = p_id;
  if not found or not interno.rede_p4_fio_entra(x, v) then perform interno.erro('nao_encontrado'); end if;
  -- Sobe: enquanto o post responde a um post da mesma autora que também entra.
  loop
    exit when x.resposta_a is null or v_n >= 200;
    select * into y from rede_posts where id = x.resposta_a;
    exit when not found or y.autor is distinct from x.autor or not interno.rede_p4_fio_entra(y, v);
    x := y; v_n := v_n + 1;
  end loop;
  -- Desce: a primeira resposta da autora a ela mesma, em ordem de chegada.
  v_n := 0;
  loop
    v_itens := v_itens || jsonb_build_object('id', x.id, 'titulo', x.titulo, 'texto', x.texto, 'corpo', x.corpo, 'criado_em', x.criado_em);
    v_n := v_n + 1;
    exit when v_n >= 100;
    select r.* into y from rede_posts r
     where r.resposta_a = x.id and r.autor = x.autor and interno.rede_p4_fio_entra(r, v)
     order by r.criado_em, r.id limit 1;
    exit when not found;
    x := y;
  end loop;
  return jsonb_build_object('autor', interno.rede_nome(x.autor), 'itens', v_itens);
end $$;

-- ── Permissões ─────────────────────────────────────────────────────────────────────────────────────────────────────────────
revoke all on function interno.rede_p4_pontes_ligado(), interno.rede_p4_fed_so_aprovados(), interno.rede_p4_fed_aprovado(text),
  interno.rede_p4_fed_nome(text), interno.rede_p4_ato_publico(uuid), interno.rede_p4_ato_mudou(), interno.rede_p4_bluesky_barrado(),
  interno.rede_p4_bluesky_ativa(text), interno.rede_p4_telegram_ato(uuid), interno.rede_p4_aviso_empurra(uuid, text, uuid, text),
  interno.rede_p4_pouco_util_desce(uuid), interno.rede_p4_fio_entra(interno.rede_posts, uuid),
  interno.rede_fed_bloqueado(text), interno.rede_fed_post_json(interno.rede_posts) from public;
revoke all on function public.rede_p4_fed_aprovados_ver(), public.rede_p4_fed_aprovar(text, boolean), public.rede_p4_fed_modo(boolean),
  public.rede_p4_bluesky_ver(text), public.rede_p4_bluesky_escolher(text, boolean), public.rede_pontes_telegram_pendentes(integer),
  public.rede_p4_telegram_atos_pendentes(integer), public.rede_p4_telegram_atos_resultado(uuid, text, boolean),
  public.rede_aviso_push_pendentes(integer), public.rede_p4_avisos_so_seguidos(boolean), public.rede_p4_pouco_util(uuid, uuid, boolean, text),
  public.rede_p4_pouco_util_meus(jsonb), public.rede_conv_arvore(uuid, text), public.rede_p4_fio_texto(uuid) from public;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on function interno.rede_p4_pontes_ligado(), interno.rede_p4_fed_so_aprovados(), interno.rede_p4_fed_aprovado(text),
      interno.rede_p4_fed_nome(text), interno.rede_p4_ato_publico(uuid), interno.rede_p4_ato_mudou(), interno.rede_p4_bluesky_barrado(),
      interno.rede_p4_bluesky_ativa(text), interno.rede_p4_telegram_ato(uuid), interno.rede_p4_aviso_empurra(uuid, text, uuid, text),
      interno.rede_p4_pouco_util_desce(uuid), interno.rede_p4_fio_entra(interno.rede_posts, uuid),
      interno.rede_fed_bloqueado(text), interno.rede_fed_post_json(interno.rede_posts) from anon, authenticated;
    revoke all on function public.rede_p4_fed_aprovados_ver(), public.rede_p4_fed_aprovar(text, boolean), public.rede_p4_fed_modo(boolean),
      public.rede_p4_bluesky_ver(text), public.rede_p4_bluesky_escolher(text, boolean), public.rede_pontes_telegram_pendentes(integer),
      public.rede_p4_telegram_atos_pendentes(integer), public.rede_p4_telegram_atos_resultado(uuid, text, boolean),
      public.rede_aviso_push_pendentes(integer), public.rede_p4_avisos_so_seguidos(boolean), public.rede_p4_pouco_util(uuid, uuid, boolean, text),
      public.rede_p4_pouco_util_meus(jsonb), public.rede_conv_arvore(uuid, text), public.rede_p4_fio_texto(uuid) from anon, authenticated;
    -- Leitura aberta a visitante: a conversa (como sempre) e o leitor de fios (só o que a matriz deixa).
    grant execute on function public.rede_conv_arvore(uuid, text), public.rede_p4_fio_texto(uuid) to anon, authenticated, service_role;
    grant execute on function public.rede_p4_fed_aprovados_ver(), public.rede_p4_fed_aprovar(text, boolean), public.rede_p4_fed_modo(boolean),
      public.rede_p4_bluesky_ver(text), public.rede_p4_bluesky_escolher(text, boolean), public.rede_p4_avisos_so_seguidos(boolean) to authenticated, service_role;
    -- Só a chave de serviço (rotas do servidor).
    grant execute on function public.rede_pontes_telegram_pendentes(integer), public.rede_p4_telegram_atos_pendentes(integer),
      public.rede_p4_telegram_atos_resultado(uuid, text, boolean), public.rede_aviso_push_pendentes(integer),
      public.rede_p4_pouco_util(uuid, uuid, boolean, text), public.rede_p4_pouco_util_meus(jsonb) to service_role;
  end if;
end $$;

select interno.alumia_trancar();
