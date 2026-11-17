-- ───────────────────────────── Alumia: o painel de controle (coordenação e admin), novembro de 2026 ─────────────────────────────
-- Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
--
-- O painel de controle da Alumia dentro do painel interno do Instituto . Quem usa:
--
--   coordenação   o papel "coordenacao" do Instituto. Pode tudo daqui.
--   admin         UMA conta, nomeada pela coordenação (interno.alumia_painel_admin). Pode tudo o que a coordenação pode na Alumia,
--                 menos nomear ou destituir o admin e menos agir sobre quem é da coordenação.
--   mediação      NÃO entra neste painel. Os mediadores do Instituto já são a moderação da Alumia pelo papel que têm
--                 (interno.cuida, interno.media, interno.alumia_triagem_pode): fila de denúncias, triagem e banimento da mediação
--                 continuam nas telas deles, com os mesmos poderes. Nenhum cadastro novo de moderador.
--
-- Toda função public.alumia_painel_* confere o papel NO BANCO (interno.alumia_painel_exige) e grava em
-- interno.alumia_painel_registro (só inserção: gatilhos barram update, delete e truncate) quem fez, o quê, em quê e por quê.
-- Ação que esconde, suspende, apaga ou muda papel pede motivo de 10 letras ou mais.
--
-- "Banir por IP" sem guardar IP: o servidor do site (app/api/alumia/impressao) calcula HMAC-SHA-256 do endereço (IPv4 inteiro;
-- no IPv6, só o prefixo /64) com um segredo que vive em variável de ambiente e NUNCA chega ao banco, e entrega aqui só o resumo
-- (public.alumia_impressao_registrar, chave de serviço). O resumo vence em 30 dias. O banimento por rede tem prazo (até 90 dias),
-- mostra quantas contas atinge antes de confirmar e não vale para quem tem função na casa. Ele barra quem continua entrando da
-- mesma rede: quem troca de rede (os dados do celular, por exemplo) sai da barreira na entrada seguinte, porque a barreira é da
-- rede, não da pessoa. Para a pessoa, existe a suspensão e o banimento da conta.
--
-- Endereço de rede NÃO é guardado em lugar nenhum (decisão da coordenação de 13/11, que vence a da noite de 12/11): nenhum
-- registro de acesso, nenhum endereço legível, nem para a coordenação. Se uma versão anterior desta migração já criou as tabelas
-- do registro de acesso e dos endereços barrados, o passo 1b as apaga com o que tiverem dentro.
--
-- Tabelas em interno, RLS ligada e sem política, nenhuma permissão direta. Pode rodar mais de uma vez, sem apagar dado nenhum.
-- Roda DEPOIS de 20261112-alumia-portas.sql. Teste: npm run testar:alumia-o7-painel.

-- 1. Tabelas ────────────────────────────────────────────────────────────────────────────────────────────────────────────────

-- O admin da Alumia: uma linha só (a chave é sempre true).
create table if not exists interno.alumia_painel_admin (
  unico boolean primary key default true check (unico),
  usuario uuid not null unique references interno.perfis (id) on delete cascade,
  nomeado_por uuid references interno.perfis (id) on delete set null,
  nomeado_em timestamptz not null default now()
);

-- O registro do painel: só inserção. "quem" não tem chave estrangeira: a linha fica mesmo se a conta sair.
create table if not exists interno.alumia_painel_registro (
  id bigint generated always as identity primary key,
  quem uuid,
  quem_nome text not null default '',
  papel text not null default '' check (papel in ('coordenacao', 'admin', 'sistema')),
  acao text not null check (char_length(acao) between 2 and 60),
  alvo_tipo text not null default '' check (char_length(alvo_tipo) <= 30),
  alvo text not null default '' check (char_length(alvo) <= 120),
  alvo_nome text not null default '' check (char_length(alvo_nome) <= 120),
  motivo text not null default '' check (char_length(motivo) <= 1000),
  detalhes jsonb not null default '{}'::jsonb,
  criado_em timestamptz not null default now()
);
create index if not exists alumia_painel_registro_tempo on interno.alumia_painel_registro (criado_em desc);
create index if not exists alumia_painel_registro_acao on interno.alumia_painel_registro (acao, criado_em desc);

create or replace function interno.alumia_painel_so_insercao() returns trigger language plpgsql as $$
begin
  raise exception 'O registro do painel da Alumia não se altera nem se apaga.' using errcode = 'P0001';
end $$;
drop trigger if exists alumia_painel_so_insercao on interno.alumia_painel_registro;
create trigger alumia_painel_so_insercao before update or delete on interno.alumia_painel_registro for each row execute function interno.alumia_painel_so_insercao();
drop trigger if exists alumia_painel_so_insercao_truncate on interno.alumia_painel_registro;
create trigger alumia_painel_so_insercao_truncate before truncate on interno.alumia_painel_registro for each statement execute function interno.alumia_painel_so_insercao();

-- Banimento por rede: a decisão (com prazo) e os resumos que ela barra. O resumo é HMAC do endereço; o endereço não existe aqui.
create table if not exists interno.alumia_impressao_banimentos (
  id uuid primary key default gen_random_uuid(),
  motivo text not null check (char_length(motivo) between 10 and 500),
  por uuid references interno.perfis (id) on delete set null,
  contas integer not null default 0,
  criado_em timestamptz not null default now(),
  ate timestamptz not null,
  encerrado_em timestamptz,
  encerrado_por uuid references interno.perfis (id) on delete set null,
  check (ate <= criado_em + interval '91 days')
);
create table if not exists interno.alumia_impressao_banidas (
  banimento uuid not null references interno.alumia_impressao_banimentos (id) on delete cascade,
  impressao text not null check (impressao ~ '^[0-9a-f]{64}$'),
  primary key (banimento, impressao)
);
create index if not exists alumia_impressao_banidas_resumo on interno.alumia_impressao_banidas (impressao);

-- De que redes cada conta entrou ou pediu a entrada (só o resumo, com validade). Some com a conta.
create table if not exists interno.alumia_impressoes (
  usuario uuid not null references interno.perfis (id) on delete cascade,
  impressao text not null check (impressao ~ '^[0-9a-f]{64}$'),
  primeira_em timestamptz not null default now(),
  vista_em timestamptz not null default now(),
  vence_em timestamptz not null default now() + interval '30 days',
  primary key (usuario, impressao)
);
create index if not exists alumia_impressoes_resumo on interno.alumia_impressoes (impressao);

-- Suspensão com prazo, banimento da conta e a barreira por rede. A conta fica suspensa (interno.perfis.suspenso) enquanto houver
-- uma sanção ativa; "ja_suspensa" guarda se ela já estava suspensa por outra decisão, que esta não desfaz.
create table if not exists interno.alumia_sancoes (
  id uuid primary key default gen_random_uuid(),
  usuario uuid not null references interno.perfis (id) on delete cascade,
  tipo text not null check (tipo in ('suspensao', 'banimento', 'rede')),
  motivo text not null check (char_length(motivo) between 10 and 500),
  por uuid references interno.perfis (id) on delete set null,
  criado_em timestamptz not null default now(),
  ate timestamptz,
  ja_suspensa boolean not null default false,
  banimento_rede uuid references interno.alumia_impressao_banimentos (id) on delete cascade,
  encerrada_em timestamptz,
  encerrada_por uuid references interno.perfis (id) on delete set null,
  check (tipo <> 'suspensao' or ate is not null)
);
create index if not exists alumia_sancoes_ativas on interno.alumia_sancoes (usuario) where encerrada_em is null;

-- Post apagado pelo painel: fica escondido e pode voltar até "restaurar_ate". Depois disso a faxina apaga o conteúdo de vez.
create table if not exists interno.alumia_painel_lixeira (
  post uuid primary key references interno.rede_posts (id) on delete cascade,
  por uuid references interno.perfis (id) on delete set null,
  motivo text not null check (char_length(motivo) between 10 and 500),
  estava_oculto boolean not null default false,
  estava_retido boolean not null default false,
  apagado_em timestamptz not null default now(),
  restaurar_ate timestamptz not null default now() + interval '30 days',
  de_vez_em timestamptz
);

-- Aviso fixado no alto da Alumia (no máximo 3 de cada vez).
create table if not exists interno.alumia_avisos_fixados (
  id uuid primary key default gen_random_uuid(),
  texto text not null check (char_length(texto) between 5 and 280),
  link text check (link is null or link ~ '^/[A-Za-z0-9/_@.?=&%#-]{0,200}$'),
  por uuid references interno.perfis (id) on delete set null,
  criado_em timestamptz not null default now(),
  ate timestamptz not null,
  retirado_em timestamptz
);

-- Comunidade encerrada: continua no ar para leitura, mas ninguém publica nela (gatilho em interno.rede_posts).
create table if not exists interno.alumia_comunidades_encerradas (
  slug text primary key references interno.rede_comunidades (slug) on delete cascade on update cascade,
  motivo text not null check (char_length(motivo) between 10 and 500),
  por uuid references interno.perfis (id) on delete set null,
  em timestamptz not null default now()
);

-- 1b. Sem endereço de rede (decisão de 13/11) ───────────────────────────────────────────────────────────────────────────────
-- Uma versão anterior desta migração criava o registro de acesso (endereço, porta, conta, por 6 meses, com um gatilho que não
-- deixava apagar antes do prazo) e a lista dos endereços de cada banimento por rede. Onde ela chegou a rodar, sai tudo: as
-- funções que liam e gravavam, e as tabelas inteiras (drop table não passa pelos gatilhos de linha, e cascade leva os gatilhos).
drop function if exists public.alumia_acesso_registrar(uuid, text, integer, text, text);
drop function if exists public.alumia_painel_acessos(jsonb);
drop function if exists public.alumia_painel_rede_enderecos(uuid);
drop table if exists interno.alumia_registro_acesso cascade;
drop table if exists interno.alumia_impressao_banidas_endereco cascade;
drop function if exists interno.alumia_registro_acesso_guarda();

do $$
declare t text;
begin
  foreach t in array array['alumia_painel_admin', 'alumia_painel_registro', 'alumia_impressao_banimentos', 'alumia_impressao_banidas', 'alumia_impressoes',
                           'alumia_sancoes', 'alumia_painel_lixeira', 'alumia_avisos_fixados', 'alumia_comunidades_encerradas'] loop
    execute format('alter table interno.%I enable row level security', t);
    execute format('revoke all on table interno.%I from public', t);
    if exists (select 1 from pg_roles where rolname = 'anon') then
      execute format('revoke all on table interno.%I from anon, authenticated', t);
    end if;
  end loop;
end $$;

-- 2. Quem pode ──────────────────────────────────────────────────────────────────────────────────────────────────────────────

/**
 * O papel de quem chama neste painel: 'coordenacao', 'admin' ou nulo. A coordenação vem do papel do Instituto (interno.tem, com
 * as regras de segundo fator dele); o admin, da linha única de alumia_painel_admin, em sessão confiável. Conta suspensa: nulo.
 */
create or replace function interno.alumia_painel_papel() returns text language sql stable security definer set search_path = interno, pg_temp as $$
  select case
    when auth.uid() is null or exists (select 1 from perfis f where f.id = auth.uid() and f.suspenso) then null
    when interno.tem('coordenacao') then 'coordenacao'
    when exists (select 1 from alumia_painel_admin a where a.usuario = auth.uid())
         and interno.sessao_confiavel() and (not interno.exige_2fa() or interno.aal2()) then 'admin'
    else null end
$$;

/** Exige o painel (ou só a coordenação). Devolve o papel. Quem não é recebe "sem_permissao", igual para toda função. */
create or replace function interno.alumia_painel_exige(p_so_coordenacao boolean default false) returns text language plpgsql stable security definer set search_path = interno, pg_temp as $$
declare v text := interno.alumia_painel_papel();
begin
  if v is null or (coalesce(p_so_coordenacao, false) and v <> 'coordenacao') then perform interno.erro('sem_permissao'); end if;
  return v;
end $$;

/** Grava uma linha no registro do painel. */
create or replace function interno.alumia_painel_registrar(p_acao text, p_alvo_tipo text, p_alvo text, p_alvo_nome text, p_motivo text, p_detalhes jsonb default '{}'::jsonb)
returns void language plpgsql security definer set search_path = interno, pg_temp as $$
begin
  insert into alumia_painel_registro (quem, quem_nome, papel, acao, alvo_tipo, alvo, alvo_nome, motivo, detalhes)
  values (auth.uid(), case when auth.uid() is null then '' else interno.alumia_painel_nome_fixo(auth.uid()) end, coalesce(interno.alumia_painel_papel(), 'sistema'),
          left(p_acao, 60), left(coalesce(p_alvo_tipo, ''), 30), left(coalesce(p_alvo, ''), 120), left(coalesce(p_alvo_nome, ''), 120),
          left(coalesce(p_motivo, ''), 1000), coalesce(p_detalhes, '{}'::jsonb));
end $$;

/** O motivo de uma ação: 10 a 500 letras. */
create or replace function interno.alumia_painel_motivo(p text) returns text language sql immutable as $$ select interno.txt(p, 'motivo', 10, 500) $$;

/** O texto de uma busca pronto para o "ilike": sem curinga de quem digita (% e _ valem como letra). */
create or replace function interno.alumia_painel_busca(p text, p_max integer default 80) returns text language sql immutable as $$
  select replace(replace(replace(left(btrim(coalesce(p, '')), p_max), '\', '\\'), '%', '\%'), '_', '\_')
$$;

/** O nome que o painel mostra para uma conta: o codinome; sem ele, "Sem codinome". Nunca o nome civil. */
create or replace function interno.alumia_painel_nome(p uuid) returns text language sql stable security definer set search_path = interno, pg_temp as $$
  select coalesce((select coalesce(nullif(f.rede_codinome, ''), 'Sem codinome') || coalesce(' (@' || f.rede_handle || ')', '') from perfis f where f.id = p), 'Conta apagada')
$$;

/**
 * O nome que fica GRAVADO no registro do painel (que não se apaga): sempre o codinome, mesmo de quem está com o nome público
 * (o codinome guardado para a volta, perfis.rede_codinome_reserva), e o @. Assim, quem volta ao codinome não deixa o nome de
 * verdade preso no registro. As telas que mostram a conta agora continuam lendo o nome do momento (alumia_painel_nome).
 */
create or replace function interno.alumia_painel_nome_fixo(p uuid) returns text language plpgsql stable security definer set search_path = interno, pg_temp as $$
declare v text;
begin
  -- A coluna da identidade pública vem de 20261113-alumia-o7-identidade-publica.sql; sem ela, vale o codinome de sempre.
  begin
    execute 'select case when f.rede_identidade = ''publica'' then f.rede_codinome_reserva else f.rede_codinome end from interno.perfis f where f.id = $1' into v using p;
  exception when undefined_column then
    select f.rede_codinome into v from perfis f where f.id = p;
  end;
  if not exists (select 1 from perfis f where f.id = p) then return 'Conta apagada'; end if;
  return coalesce(nullif(v, ''), 'Sem codinome') || coalesce((select ' (@' || f.rede_handle || ')' from perfis f where f.id = p), '');
end $$;

/**
 * Quem decidiu (uma pessoa da coordenação, da mediação ou o admin), como o painel mostra: para a coordenação, o nome da conta do
 * Instituto, que ela já conhece; para o admin, que é uma conta da Alumia promovida, só o codinome e o @, nunca o nome civil.
 */
create or replace function interno.alumia_painel_quem(p uuid) returns text language sql stable security definer set search_path = interno, pg_temp as $$
  select case when p is null then null
              when interno.alumia_painel_papel() = 'coordenacao' then (select nome from perfis d where d.id = p)
              else interno.alumia_painel_nome(p) end
$$;

/**
 * A conta-alvo de uma ação sobre pessoa. Ninguém age sobre si, e ninguém age por aqui sobre quem é da coordenação (o admin não
 * mexe na coordenação; e a coordenação se cuida no painel da equipe, que tem a regra da última coordenação). O admin também não
 * age sobre quem tem qualquer papel na casa (vice-coordenação, mediação, voluntariado): senão uma pessoa sozinha tiraria a
 * mediação inteira do ar e ficaria moderando só. Sobre a equipe, quem decide é a coordenação.
 */
create or replace function interno.alumia_painel_alvo(p_id uuid, p_sem_funcao boolean default false) returns interno.perfis language plpgsql stable security definer set search_path = interno, pg_temp as $$
declare f perfis;
begin
  select * into f from perfis where id = p_id;
  if not found then perform interno.erro('nao_encontrado'); end if;
  if f.id = auth.uid() then perform interno.erro('voce_mesmo'); end if;
  if exists (select 1 from papeis pa where pa.usuario = f.id and pa.papel = 'coordenacao') then perform interno.erro('coordenacao_protegida'); end if;
  if interno.alumia_painel_papel() = 'admin' and exists (select 1 from papeis pa where pa.usuario = f.id) then perform interno.erro('tem_funcao'); end if;
  -- Zerar o segundo fator e apagar a conta de quem tem função na casa seguem as regras do painel da equipe (duas pessoas).
  if coalesce(p_sem_funcao, false) and (exists (select 1 from papeis pa where pa.usuario = f.id) or exists (select 1 from alumia_painel_admin a where a.usuario = f.id)) then
    perform interno.erro('tem_funcao');
  end if;
  return f;
end $$;

/** Tem função na casa (qualquer papel) ou é o admin: a barreira por rede não vale para essa conta. */
create or replace function interno.alumia_painel_da_casa(p uuid) returns boolean language sql stable security definer set search_path = interno, pg_temp as $$
  select exists (select 1 from papeis pa where pa.usuario = p) or exists (select 1 from alumia_painel_admin a where a.usuario = p)
$$;

/** A decisão foi de alguém da coordenação? (Desfazer o que a coordenação decidiu é só da coordenação.) */
create or replace function interno.alumia_painel_decidiu_a_coordenacao(p uuid) returns boolean language sql stable security definer set search_path = interno, pg_temp as $$
  select p is not null and exists (select 1 from papeis pa where pa.usuario = p and pa.papel = 'coordenacao')
$$;

/** Encerra as sessões de uma conta, onde o serviço de contas as guarda. Devolve se conseguiu. */
create or replace function interno.alumia_painel_derrubar(p uuid) returns boolean language plpgsql security definer set search_path = interno, pg_temp as $$
begin
  begin
    if to_regclass('auth.refresh_tokens') is not null then execute 'delete from auth.refresh_tokens where user_id::text = $1' using p::text; end if;
    if to_regclass('auth.sessions') is not null then execute 'delete from auth.sessions where user_id = $1' using p; end if;
  exception when others then
    return false;
  end;
  return true;
end $$;

/** Tira a suspensão que veio das sanções deste painel, se não sobrou nenhuma ativa nem outra decisão segurando a conta. */
create or replace function interno.alumia_painel_soltar(p uuid, p_ja_suspensa boolean) returns void language plpgsql security definer set search_path = interno, pg_temp as $$
begin
  if coalesce(p_ja_suspensa, false) then return; end if;
  if exists (select 1 from alumia_sancoes s where s.usuario = p and s.encerrada_em is null) then return; end if;
  if exists (select 1 from banimentos b where b.usuario = p and b.ativo) then return; end if;
  update perfis set suspenso = false, suspensao = '' where id = p and suspenso;
end $$;

/**
 * A faxina do painel: sanção e banimento por rede vencidos se encerram (a conta volta), resumo de rede vencido some, aviso
 * fixado vencido sai e post na lixeira além do prazo perde o conteúdo de vez. Roda no agendador e antes das leituras do painel.
 */
create or replace function interno.alumia_painel_faxina() returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare r record; v_s integer := 0; v_p integer := 0;
begin
  update alumia_impressao_banimentos set encerrado_em = now() where encerrado_em is null and ate <= now();
  for r in
    select s.id, s.usuario, s.ja_suspensa from alumia_sancoes s
    where s.encerrada_em is null
      and ((s.ate is not null and s.ate <= now())
        or (s.tipo = 'rede' and exists (select 1 from alumia_impressao_banimentos b where b.id = s.banimento_rede and b.encerrado_em is not null)))
  loop
    update alumia_sancoes set encerrada_em = now() where id = r.id;
    perform interno.alumia_painel_soltar(r.usuario, r.ja_suspensa);
    v_s := v_s + 1;
  end loop;
  delete from alumia_impressoes where vence_em <= now();
  update alumia_avisos_fixados set retirado_em = now() where retirado_em is null and ate <= now();
  for r in select l.post from alumia_painel_lixeira l where l.de_vez_em is null and l.restaurar_ate <= now() limit 500 loop
    begin
      delete from rede_midia where post = r.post;
      update rede_posts set texto = '[apagado pela moderação]', titulo = null, corpo = null, cita = null, chamado = null, oculto = true, retido = false, apagado_em = coalesce(apagado_em, now())
      where id = r.post;
      update alumia_painel_lixeira set de_vez_em = now() where post = r.post;
      v_p := v_p + 1;
    exception when others then null;
    end;
  end loop;
  return jsonb_build_object('sancoes_encerradas', v_s, 'posts_apagados_de_vez', v_p);
end $$;

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule('alumia-painel-faxina', '*/15 * * * *', 'select interno.alumia_painel_faxina()');
  end if;
exception when others then null;
end $$;

-- 3. Visão geral ────────────────────────────────────────────────────────────────────────────────────────────────────────────

/** Tenho o painel? Quem não tem recebe só {pode: false}: nada sobre o painel, o admin ou a coordenação. */
create or replace function public.alumia_painel_eu() returns jsonb language plpgsql stable security definer set search_path = interno, pg_temp as $$
declare v text := interno.alumia_painel_papel();
begin
  if v is null then return jsonb_build_object('pode', false); end if;
  return jsonb_build_object('pode', true, 'papel', v);
end $$;

/** Os números e a saúde. */
create or replace function public.alumia_painel_geral() returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v_papel text := interno.alumia_painel_exige(); v_dia timestamptz := date_trunc('day', now() at time zone 'America/Sao_Paulo') at time zone 'America/Sao_Paulo';
begin
  perform interno.alumia_painel_faxina();
  return jsonb_build_object(
    'papel', v_papel,
    'numeros', jsonb_build_object(
      'contas', (select count(*) from perfis f where f.rede_18 and f.rede_consentimento is not null),
      'aprovadas', (select count(*) from alumia_entrada e where e.situacao = 'aprovada'),
      'fila', (select count(*) from alumia_entrada e join perfis f on f.id = e.usuario where e.situacao = 'em_analise' and not f.suspenso),
      'denuncias', (select count(*) from rede_denuncias d where d.situacao in ('aberta', 'em_analise')),
      'denuncias_urgentes', (select count(*) from rede_denuncias d where d.situacao in ('aberta', 'em_analise') and d.prioridade = 1),
      'posts_hoje', (select count(*) from rede_posts p where p.criado_em >= v_dia and p.apagado_em is null),
      'comunidades', (select count(*) from rede_comunidades),
      'organizacoes', (select count(*) from rede_orgs),
      'selos_esperando', (select count(*) from rede_org_pedidos x where x.situacao = 'esperando'),
      'sancoes', (select count(*) from alumia_sancoes s where s.encerrada_em is null),
      'redes_barradas', (select count(*) from alumia_impressao_banimentos b where b.encerrado_em is null),
      'lixeira', (select count(*) from alumia_painel_lixeira l where l.de_vez_em is null)),
    'saude', jsonb_build_object(
      'versao', public.rede_alumia_versao(),
      'painel', 1,
      'trava', interno.alumia_exigida(),
      'trava_desde', (select valor ->> 'ligada_em' from configuracoes where chave = 'alumia_entrada'),
      'agendador', exists (select 1 from pg_extension where extname = 'pg_cron'),
      'redes_vistas', (select count(distinct impressao) from alumia_impressoes),
      'admin', exists (select 1 from alumia_painel_admin),
      'mediadores', (select count(distinct pa.usuario) from papeis pa where pa.papel = 'mediacao'),
      'decisoes', coalesce((select jsonb_object_agg(v.nome, v.ligado) from recursos_vivos v
                            where v.nome like 'alumia-%' or v.nome in ('rede-v2', 'fediverso-total', 'fediverso-grupos')), '{}'::jsonb)),
    'ultimas', coalesce((select jsonb_agg(x.j order by x.id desc) from (
      select r.id, jsonb_build_object('id', r.id, 'quando', r.criado_em, 'quem', r.quem_nome, 'papel', r.papel, 'acao', r.acao, 'alvo', r.alvo_nome, 'motivo', r.motivo) as j
      from alumia_painel_registro r order by r.id desc limit 8) x), '[]'::jsonb));
end $$;

-- 4. Cadastros ──────────────────────────────────────────────────────────────────────────────────────────────────────────────

/** A fila e o histórico dos pedidos de entrada. Codinome e o que a pessoa escreveu; nunca e-mail, nome civil ou endereço de rede. */
create or replace function public.alumia_painel_cadastros(p_situacao text default 'em_analise', p_busca text default '', p_pagina integer default 0) returns jsonb
language plpgsql security definer set search_path = interno, pg_temp as $$
declare v_busca text := left(btrim(coalesce(p_busca, '')), 60); v_pagina integer := greatest(0, least(coalesce(p_pagina, 0), 2000)); v_sit text := coalesce(p_situacao, 'em_analise');
begin
  perform interno.alumia_painel_exige();
  if v_sit not in ('em_analise', 'aprovada', 'recusada', 'todas') then perform interno.erro('invalido:situacao'); end if;
  return jsonb_build_object(
    'contagem', jsonb_build_object(
      'em_analise', (select count(*) from alumia_entrada where situacao = 'em_analise'),
      'aprovada', (select count(*) from alumia_entrada where situacao = 'aprovada'),
      'recusada', (select count(*) from alumia_entrada where situacao = 'recusada')),
    'itens', coalesce((select jsonb_agg(x.j order by x.ordem) from (
      select row_number() over (order by (e.situacao = 'em_analise') desc, case when e.situacao = 'em_analise' then e.pedido_em end, coalesce(e.decidido_em, e.pedido_em) desc) as ordem,
        jsonb_build_object(
          'id', e.id, 'codinome', coalesce(nullif(f.rede_codinome, ''), '—'), 'handle', f.rede_handle, 'situacao', e.situacao, 'origem', e.origem,
          'motivo', e.motivo_pedido, 'pedido_em', e.pedido_em, 'vezes', e.tentativas,
          'conta_dias', greatest(0, extract(day from now() - coalesce((select u.created_at from auth.users u where u.id = e.usuario), e.pedido_em))::integer),
          'decidido_em', e.decidido_em, 'motivo_decisao', e.motivo_decisao, 'decidido_por', interno.alumia_painel_quem(e.decidido_por),
          'suspensa', f.suspenso, 'da_casa', interno.alumia_painel_da_casa(e.usuario)) as j
      from alumia_entrada e join perfis f on f.id = e.usuario
      where (v_sit = 'todas' or e.situacao = v_sit)
        and (v_busca = '' or f.rede_codinome ilike '%' || interno.alumia_painel_busca(v_busca) || '%' or f.rede_handle ilike '%' || interno.alumia_painel_busca(btrim(v_busca, ' @')) || '%')
      order by ordem limit 50 offset v_pagina * 50) x), '[]'::jsonb));
end $$;

/** Aprovar ou recusar (recusar pede o motivo, que a pessoa lê). Vale também para decisão já tomada: tirar o acesso ou aprovar quem foi recusado. */
create or replace function public.alumia_painel_cadastro_decidir(p_id uuid, p_aprovar boolean, p_motivo text default '') returns jsonb
language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := auth.uid(); e alumia_entrada; v_motivo text; v_sim boolean := coalesce(p_aprovar, false);
begin
  perform interno.alumia_painel_exige();
  perform interno.limite('alumia_painel_agir', 300, 60);
  select * into e from alumia_entrada where id = p_id for update;
  if not found then perform interno.erro('nao_encontrado'); end if;
  if e.usuario = v then perform interno.erro('voce_mesmo'); end if;
  if not v_sim and interno.alumia_painel_da_casa(e.usuario) then perform interno.erro('tem_funcao'); end if;
  v_motivo := case when v_sim then nullif(left(btrim(coalesce(p_motivo, '')), 500), '') else interno.alumia_painel_motivo(p_motivo) end;
  update alumia_entrada set situacao = case when v_sim then 'aprovada' else 'recusada' end, decidido_em = now(), decidido_por = v, motivo_decisao = v_motivo where id = p_id;
  perform interno.avisar_em(e.usuario, case when v_sim
    then 'Sua entrada na Alumia foi aprovada. Falta só cadastrar o aplicativo autenticador para ver a rede.'
    else 'Seu pedido de entrada na Alumia não foi aceito. Motivo: ' || v_motivo end, 'conta');
  perform interno.alumia_painel_registrar(case when v_sim then 'cadastro_aprovado' else 'cadastro_recusado' end, 'cadastro', p_id::text, interno.alumia_painel_nome_fixo(e.usuario), coalesce(v_motivo, ''),
    jsonb_build_object('antes', e.situacao));
  return jsonb_build_object('id', p_id, 'situacao', case when v_sim then 'aprovada' else 'recusada' end);
end $$;

/** Reabrir: o pedido decidido volta para a fila, para ser lido de novo. */
create or replace function public.alumia_painel_cadastro_reabrir(p_id uuid, p_motivo text) returns jsonb
language plpgsql security definer set search_path = interno, pg_temp as $$
declare e alumia_entrada; v_motivo text := interno.alumia_painel_motivo(p_motivo);
begin
  perform interno.alumia_painel_exige();
  perform interno.limite('alumia_painel_agir', 300, 60);
  select * into e from alumia_entrada where id = p_id for update;
  if not found then perform interno.erro('nao_encontrado'); end if;
  if e.usuario = auth.uid() then perform interno.erro('voce_mesmo'); end if;
  if e.situacao = 'em_analise' then perform interno.erro('ja_na_fila'); end if;
  if interno.alumia_painel_da_casa(e.usuario) then perform interno.erro('tem_funcao'); end if;
  update alumia_entrada set situacao = 'em_analise', decidido_em = null, decidido_por = null, motivo_decisao = null where id = p_id;
  perform interno.avisar_em(e.usuario, 'Seu pedido de entrada na Alumia voltou para análise. Você recebe um aviso quando houver decisão.', 'conta');
  perform interno.alumia_painel_registrar('cadastro_reaberto', 'cadastro', p_id::text, interno.alumia_painel_nome_fixo(e.usuario), v_motivo, jsonb_build_object('antes', e.situacao));
  return jsonb_build_object('id', p_id, 'situacao', 'em_analise');
end $$;

-- 5. Pessoas ────────────────────────────────────────────────────────────────────────────────────────────────────────────────

/**
 * Busca por codinome ou @. A busca pelo nome da conta (que pode ser o nome civil) é só da coordenação e fica no registro:
 * o codinome existe para a moderação não precisar saber quem é quem.
 */
create or replace function public.alumia_painel_pessoas(p_busca text, p_pelo_nome boolean default false) returns jsonb
language plpgsql security definer set search_path = interno, pg_temp as $$
declare v_papel text := interno.alumia_painel_exige(); v_b text := left(btrim(coalesce(p_busca, ''), ' @'), 60); v_l text := interno.alumia_painel_busca(btrim(coalesce(p_busca, ''), ' @'), 60); v_nome boolean := coalesce(p_pelo_nome, false);
begin
  if char_length(v_b) < 2 then perform interno.erro('invalido:busca'); end if;
  perform interno.limite('alumia_painel_buscar', 240, 60);
  if v_nome then
    if v_papel <> 'coordenacao' then perform interno.erro('sem_permissao'); end if;
    perform interno.alumia_painel_registrar('busca_pelo_nome', 'pessoa', '', '', '', jsonb_build_object('letras', char_length(v_b)));
  end if;
  return coalesce((select jsonb_agg(x.j order by x.ordem) from (
    select row_number() over (order by (f.rede_handle = lower(v_b)) desc, f.rede_codinome nulls last, f.criado_em) as ordem,
      jsonb_build_object('id', f.id, 'codinome', coalesce(nullif(f.rede_codinome, ''), 'Sem codinome'), 'handle', f.rede_handle,
        'entrada', interno.alumia_situacao(f.id), 'suspensa', f.suspenso, 'da_casa', interno.alumia_painel_da_casa(f.id),
        'organizacao', exists (select 1 from rede_orgs o where o.perfil = f.id)) as j
    from perfis f
    where case when v_nome then f.nome ilike '%' || v_l || '%' else (f.rede_codinome ilike '%' || v_l || '%' or f.rede_handle ilike '%' || v_l || '%') end
    order by ordem limit 30) x), '[]'::jsonb);
end $$;

/** A ficha de moderação de uma conta: o que é preciso para decidir, e nada além (sem e-mail, nome civil, endereço ou o que ela leu). */
create or replace function public.alumia_painel_pessoa(p_id uuid) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare f perfis; v_fator boolean := false; v_sessoes integer := 0;
begin
  perform interno.alumia_painel_exige();
  perform interno.alumia_painel_faxina();
  select * into f from perfis where id = p_id;
  if not found then perform interno.erro('nao_encontrado'); end if;
  if to_regclass('auth.mfa_factors') is not null then
    execute 'select exists (select 1 from auth.mfa_factors m where m.user_id = $1 and m.status = ''verified'')' into v_fator using p_id;
  end if;
  if to_regclass('auth.sessions') is not null then
    execute 'select count(*)::integer from auth.sessions s where s.user_id = $1' into v_sessoes using p_id;
  end if;
  return jsonb_build_object(
    'id', f.id, 'codinome', coalesce(nullif(f.rede_codinome, ''), 'Sem codinome'), 'handle', f.rede_handle,
    'entrada', interno.alumia_situacao(f.id),
    'conta_dias', greatest(0, extract(day from now() - coalesce((select u.created_at from auth.users u where u.id = f.id), f.criado_em))::integer),
    'suspensa', f.suspenso, 'suspensao', f.suspensao,
    'nivel', interno.rede3_mod_nivel(f.id),
    'posts', (select count(*) from rede_posts p where p.autor = f.id and p.apagado_em is null),
    'posts_ocultos', (select count(*) from rede_posts p where p.autor = f.id and p.oculto and p.apagado_em is null),
    'procedentes_90', interno.rede3_mod_procedentes(f.id, 90),
    'denuncias_abertas', (select count(*) from rede_denuncias d where d.situacao in ('aberta', 'em_analise')
                            and ((d.alvo_tipo = 'perfil' and d.alvo = f.id::text) or (d.alvo_tipo = 'post' and exists (select 1 from rede_posts p where p.id::text = d.alvo and p.autor = f.id)))),
    'fator', coalesce(v_fator, false), 'sessoes', coalesce(v_sessoes, 0),
    'redes', (select count(*) from alumia_impressoes i where i.usuario = f.id),
    'papeis', coalesce((select jsonb_agg(distinct pa.papel) from papeis pa where pa.usuario = f.id), '[]'::jsonb),
    'admin', exists (select 1 from alumia_painel_admin a where a.usuario = f.id),
    'coordenacao', exists (select 1 from papeis pa where pa.usuario = f.id and pa.papel = 'coordenacao'),
    'organizacao', exists (select 1 from rede_orgs o where o.perfil = f.id),
    'eu', f.id = auth.uid(),
    'banimento_mediacao', exists (select 1 from banimentos b where b.usuario = f.id and b.ativo),
    'sancoes', coalesce((select jsonb_agg(jsonb_build_object('id', s.id, 'tipo', s.tipo, 'motivo', s.motivo, 'por', interno.alumia_painel_quem(s.por),
        'de', s.criado_em, 'ate', s.ate, 'ativa', s.encerrada_em is null, 'encerrada_em', s.encerrada_em) order by s.criado_em desc)
      from (select * from alumia_sancoes where usuario = f.id order by criado_em desc limit 30) s), '[]'::jsonb));
end $$;

/** Suspender por prazo (1 a 365 dias) ou banir a conta (sem prazo). As sessões caem na hora. A pessoa é avisada com o motivo. */
create or replace function public.alumia_painel_sancionar(p_id uuid, p_tipo text, p_dias integer, p_motivo text) returns jsonb
language plpgsql security definer set search_path = interno, pg_temp as $$
declare f perfis; v_motivo text := interno.alumia_painel_motivo(p_motivo); v_ate timestamptz; v_ja boolean; v_id uuid;
begin
  perform interno.alumia_painel_exige();
  perform interno.limite('alumia_painel_sancionar', 60, 60);
  if p_tipo is null or p_tipo not in ('suspensao', 'banimento') then perform interno.erro('invalido:tipo'); end if;
  f := interno.alumia_painel_alvo(p_id);
  if p_tipo = 'suspensao' then
    if p_dias is null or p_dias < 1 or p_dias > 365 then perform interno.erro('invalido:dias'); end if;
    v_ate := now() + make_interval(days => p_dias);
  end if;
  -- Já suspensa por outra decisão (da equipe ou da mediação)? Então desfazer esta não devolve a conta.
  v_ja := case when exists (select 1 from alumia_sancoes s where s.usuario = f.id and s.encerrada_em is null)
               then coalesce((select bool_or(s.ja_suspensa) from alumia_sancoes s where s.usuario = f.id and s.encerrada_em is null), false)
               else f.suspenso end;
  update alumia_sancoes set encerrada_em = now(), encerrada_por = auth.uid() where usuario = f.id and encerrada_em is null and tipo in ('suspensao', 'banimento');
  insert into alumia_sancoes (usuario, tipo, motivo, por, ate, ja_suspensa) values (f.id, p_tipo, v_motivo, auth.uid(), v_ate, v_ja) returning id into v_id;
  update perfis set suspenso = true, suspensao = case when suspensao <> '' then suspensao else 'coordenacao' end where id = f.id;
  perform interno.alumia_painel_derrubar(f.id);
  perform interno.avisar_em(f.id, case when p_tipo = 'banimento' then 'Sua conta foi banida da Alumia. Motivo: ' else 'Sua conta foi suspensa na Alumia por ' || p_dias || ' dia(s). Motivo: ' end || left(v_motivo, 300), 'conta');
  perform interno.rede3_mod_registrar('suspender', 'perfil', f.id::text, 'painel', v_motivo, null);
  perform interno.alumia_painel_registrar(case when p_tipo = 'banimento' then 'conta_banida' else 'conta_suspensa' end, 'pessoa', f.id::text, interno.alumia_painel_nome_fixo(f.id), v_motivo,
    jsonb_build_object('dias', p_dias, 'ate', v_ate));
  return jsonb_build_object('id', v_id, 'ate', v_ate);
end $$;

/** Desfazer uma suspensão ou um banimento de conta. */
create or replace function public.alumia_painel_sancao_desfazer(p_sancao uuid, p_motivo text) returns jsonb
language plpgsql security definer set search_path = interno, pg_temp as $$
declare s alumia_sancoes; v_motivo text := interno.alumia_painel_motivo(p_motivo);
begin
  perform interno.alumia_painel_exige();
  perform interno.limite('alumia_painel_sancionar', 60, 60);
  select * into s from alumia_sancoes where id = p_sancao and encerrada_em is null for update;
  if not found then perform interno.erro('nao_encontrado'); end if;
  -- O que a coordenação decidiu, só a coordenação desfaz (o admin não passa por cima dela).
  if interno.alumia_painel_decidiu_a_coordenacao(s.por) then perform interno.alumia_painel_exige(true); end if;
  perform interno.alumia_painel_alvo(s.usuario);
  update alumia_sancoes set encerrada_em = now(), encerrada_por = auth.uid() where id = s.id;
  perform interno.alumia_painel_soltar(s.usuario, s.ja_suspensa);
  perform interno.avisar_em(s.usuario, 'A sanção sobre a sua conta na Alumia foi desfeita.', 'conta');
  perform interno.alumia_painel_registrar('sancao_desfeita', 'pessoa', s.usuario::text, interno.alumia_painel_nome_fixo(s.usuario), v_motivo, jsonb_build_object('tipo', s.tipo));
  return jsonb_build_object('ok', true, 'suspensa', (select suspenso from perfis where id = s.usuario));
end $$;

/** Encerrar as sessões: a conta sai de todos os aparelhos e entra de novo com a senha (e o código, se tiver). */
create or replace function public.alumia_painel_sessoes_encerrar(p_id uuid, p_motivo text) returns jsonb
language plpgsql security definer set search_path = interno, pg_temp as $$
declare f perfis; v_motivo text := interno.alumia_painel_motivo(p_motivo); v_ok boolean;
begin
  perform interno.alumia_painel_exige();
  perform interno.limite('alumia_painel_sancionar', 60, 60);
  f := interno.alumia_painel_alvo(p_id);
  v_ok := interno.alumia_painel_derrubar(f.id);
  perform interno.alumia_painel_registrar('sessoes_encerradas', 'pessoa', f.id::text, interno.alumia_painel_nome_fixo(f.id), v_motivo, jsonb_build_object('conseguiu', v_ok));
  return jsonb_build_object('ok', v_ok);
end $$;

/** Tirar o segundo fator para a pessoa cadastrar de novo (perdeu o aparelho). As sessões caem junto. Não vale para quem tem função na casa. */
create or replace function public.alumia_painel_fator_tirar(p_id uuid, p_motivo text) returns jsonb
language plpgsql security definer set search_path = interno, pg_temp as $$
declare f perfis; v_motivo text := interno.alumia_painel_motivo(p_motivo);
begin
  perform interno.alumia_painel_exige();
  perform interno.limite('alumia_painel_sancionar', 60, 60);
  f := interno.alumia_painel_alvo(p_id, true);
  if to_regclass('auth.mfa_factors') is not null then execute 'delete from auth.mfa_factors where user_id = $1' using f.id; end if;
  perform interno.alumia_painel_derrubar(f.id);
  perform interno.avisar_em(f.id, 'O aplicativo autenticador da sua conta foi retirado pela coordenação da Alumia. Entre de novo e cadastre o aplicativo. Se você não pediu isso, troque a senha agora.', 'conta');
  perform interno.alumia_painel_registrar('segundo_fator_retirado', 'pessoa', f.id::text, interno.alumia_painel_nome_fixo(f.id), v_motivo);
  return jsonb_build_object('ok', true);
end $$;

/**
 * Apagar a conta: sai o perfil e tudo o que é pessoal (o banco apaga em cascata). Não tem volta. Pede o codinome escrito igual e
 * não vale para quem tem função na casa.
 */
create or replace function public.alumia_painel_conta_apagar(p_id uuid, p_motivo text, p_confirma text) returns jsonb
language plpgsql security definer set search_path = interno, pg_temp as $$
declare f perfis; v_motivo text := interno.alumia_painel_motivo(p_motivo); v_nome text;
begin
  perform interno.alumia_painel_exige();
  perform interno.limite('alumia_painel_apagar_conta', 10, 60);
  f := interno.alumia_painel_alvo(p_id, true);
  if btrim(coalesce(p_confirma, '')) = '' or btrim(p_confirma) is distinct from coalesce(nullif(f.rede_codinome, ''), 'Sem codinome') then perform interno.erro('confirmacao_errada'); end if;
  v_nome := interno.alumia_painel_nome_fixo(f.id);
  perform interno.alumia_painel_registrar('conta_apagada', 'pessoa', '', v_nome, v_motivo);
  delete from perfis where id = f.id;
  delete from auth.users where id = f.id;
  return jsonb_build_object('ok', true);
end $$;

-- 6. Banir a rede (o "banir por IP" sem IP) ─────────────────────────────────────────────────────────────────────────────────

/**
 * O servidor do site entrega o resumo da rede de onde a conta entrou ou pediu a entrada. Só a chave de serviço chama. Se o
 * resumo está barrado, a conta fica suspensa enquanto durar o banimento; se a conta estava barrada e agora veio de outra rede,
 * a barreira sai (ela é da rede, não da pessoa). Quem tem função na casa nunca é barrado por rede.
 */
create or replace function public.alumia_impressao_registrar(p_usuario uuid, p_impressao text, p_momento text default 'entrada') returns jsonb
language plpgsql security definer set search_path = interno, pg_temp as $$
declare f perfis; b alumia_impressao_banimentos; r record;
begin
  if not interno.servico() then perform interno.erro('sem_permissao'); end if;
  if p_impressao is null or p_impressao !~ '^[0-9a-f]{64}$' then perform interno.erro('invalido:impressao'); end if;
  select * into f from perfis where id = p_usuario;
  if not found then perform interno.erro('nao_encontrado'); end if;
  update alumia_impressao_banimentos set encerrado_em = now() where encerrado_em is null and ate <= now();
  insert into alumia_impressoes (usuario, impressao) values (f.id, p_impressao)
  on conflict (usuario, impressao) do update set vista_em = now(), vence_em = now() + interval '30 days';
  if interno.alumia_painel_da_casa(f.id) then return jsonb_build_object('barrada', false); end if;
  select x.* into b from alumia_impressao_banimentos x join alumia_impressao_banidas i on i.banimento = x.id
  where i.impressao = p_impressao and x.encerrado_em is null and x.ate > now() order by x.ate desc limit 1;
  if found then
    if not exists (select 1 from alumia_sancoes s where s.usuario = f.id and s.encerrada_em is null and s.tipo = 'rede' and s.banimento_rede = b.id) then
      insert into alumia_sancoes (usuario, tipo, motivo, por, ate, ja_suspensa, banimento_rede)
      values (f.id, 'rede', b.motivo, b.por, b.ate, f.suspenso and not exists (select 1 from alumia_sancoes s where s.usuario = f.id and s.encerrada_em is null), b.id);
      update perfis set suspenso = true, suspensao = case when suspensao <> '' then suspensao else 'sistema' end where id = f.id;
    end if;
    return jsonb_build_object('barrada', true, 'ate', b.ate);
  end if;
  -- Veio de uma rede que não está barrada: a barreira por rede que havia sobre a conta sai.
  for r in select s.id, s.ja_suspensa from alumia_sancoes s where s.usuario = f.id and s.encerrada_em is null and s.tipo = 'rede' loop
    update alumia_sancoes set encerrada_em = now() where id = r.id;
    perform interno.alumia_painel_soltar(f.id, r.ja_suspensa);
  end loop;
  return jsonb_build_object('barrada', false);
end $$;

/** Quantas contas o banimento por rede atingiria: as que entraram, nos últimos 30 dias, das mesmas redes desta conta (sem contar quem é da casa). */
create or replace function interno.alumia_painel_contas_da_rede(p uuid) returns integer language sql stable security definer set search_path = interno, pg_temp as $$
  select count(distinct o.usuario)::integer from alumia_impressoes m join alumia_impressoes o on o.impressao = m.impressao
  where m.usuario = p and m.vence_em > now() and o.vence_em > now() and not interno.alumia_painel_da_casa(o.usuario)
$$;

/** Antes de banir a rede: quantas redes a conta usou e quantas contas seriam atingidas. Nenhum resumo sai daqui. */
create or replace function public.alumia_painel_rede_previa(p_id uuid) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare f perfis;
begin
  perform interno.alumia_painel_exige();
  perform interno.alumia_painel_faxina();
  f := interno.alumia_painel_alvo(p_id);
  return jsonb_build_object(
    'redes', (select count(*) from alumia_impressoes i where i.usuario = f.id and i.vence_em > now()),
    'contas', interno.alumia_painel_contas_da_rede(f.id),
    'da_casa', interno.alumia_painel_da_casa(f.id));
end $$;

/**
 * Banir as redes de onde a conta entrou (1 a 90 dias). p_contas é o número que a tela mostrou na prévia: se mudou, a função
 * recusa ("confira_de_novo") para ninguém confirmar um número que já não vale. As contas atingidas ficam suspensas até o prazo.
 */
create or replace function public.alumia_painel_rede_banir(p_id uuid, p_dias integer, p_motivo text, p_contas integer) returns jsonb
language plpgsql security definer set search_path = interno, pg_temp as $$
declare f perfis; v_motivo text := interno.alumia_painel_motivo(p_motivo); v_n integer; v_id uuid; v_ate timestamptz; r record;
begin
  perform interno.alumia_painel_exige();
  perform interno.limite('alumia_painel_rede', 20, 60);
  if p_dias is null or p_dias < 1 or p_dias > 90 then perform interno.erro('invalido:dias'); end if;
  f := interno.alumia_painel_alvo(p_id);
  if interno.alumia_painel_da_casa(f.id) then perform interno.erro('tem_funcao'); end if;
  if not exists (select 1 from alumia_impressoes i where i.usuario = f.id and i.vence_em > now()) then perform interno.erro('sem_rede'); end if;
  v_n := interno.alumia_painel_contas_da_rede(f.id);
  if p_contas is distinct from v_n then perform interno.erro('confira_de_novo'); end if;
  v_ate := now() + make_interval(days => p_dias);
  insert into alumia_impressao_banimentos (motivo, por, contas, ate) values (v_motivo, auth.uid(), v_n, v_ate) returning id into v_id;
  insert into alumia_impressao_banidas (banimento, impressao) select v_id, i.impressao from alumia_impressoes i where i.usuario = f.id and i.vence_em > now();
  for r in
    select distinct o.usuario, g.suspenso from alumia_impressao_banidas x join alumia_impressoes o on o.impressao = x.impressao join perfis g on g.id = o.usuario
    where x.banimento = v_id and o.vence_em > now() and not interno.alumia_painel_da_casa(o.usuario)
  loop
    insert into alumia_sancoes (usuario, tipo, motivo, por, ate, ja_suspensa, banimento_rede)
    values (r.usuario, 'rede', v_motivo, auth.uid(), v_ate, r.suspenso and not exists (select 1 from alumia_sancoes s where s.usuario = r.usuario and s.encerrada_em is null), v_id);
    update perfis set suspenso = true, suspensao = case when suspensao <> '' then suspensao else 'sistema' end where id = r.usuario;
    perform interno.alumia_painel_derrubar(r.usuario);
  end loop;
  perform interno.alumia_painel_registrar('rede_banida', 'rede', v_id::text, interno.alumia_painel_nome_fixo(f.id), v_motivo, jsonb_build_object('dias', p_dias, 'contas', v_n, 'ate', v_ate));
  return jsonb_build_object('id', v_id, 'contas', v_n, 'ate', v_ate);
end $$;

/** Os banimentos por rede (ativos e os 80 últimos). Nunca o resumo: o endereço não existe em lugar nenhum. */
create or replace function public.alumia_painel_redes() returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
begin
  perform interno.alumia_painel_exige();
  perform interno.alumia_painel_faxina();
  return coalesce((select jsonb_agg(jsonb_build_object('id', b.id, 'motivo', b.motivo, 'por', interno.alumia_painel_quem(b.por), 'contas', b.contas,
      'barradas_agora', (select count(*) from alumia_sancoes s where s.banimento_rede = b.id and s.encerrada_em is null),
      'de', b.criado_em, 'ate', b.ate, 'ativo', b.encerrado_em is null) order by (b.encerrado_em is null) desc, b.criado_em desc)
    from (select * from alumia_impressao_banimentos order by (encerrado_em is null) desc, criado_em desc limit 80) b), '[]'::jsonb);
end $$;

/** Desfazer um banimento por rede: as contas que ele segurava voltam. */
create or replace function public.alumia_painel_rede_desfazer(p_id uuid, p_motivo text) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare b alumia_impressao_banimentos; v_motivo text := interno.alumia_painel_motivo(p_motivo); r record; v_n integer := 0;
begin
  perform interno.alumia_painel_exige();
  perform interno.limite('alumia_painel_rede', 20, 60);
  select * into b from alumia_impressao_banimentos where id = p_id and encerrado_em is null for update;
  if not found then perform interno.erro('nao_encontrado'); end if;
  if interno.alumia_painel_decidiu_a_coordenacao(b.por) then perform interno.alumia_painel_exige(true); end if;
  update alumia_impressao_banimentos set encerrado_em = now(), encerrado_por = auth.uid() where id = b.id;
  for r in select s.id, s.usuario, s.ja_suspensa from alumia_sancoes s where s.banimento_rede = b.id and s.encerrada_em is null loop
    update alumia_sancoes set encerrada_em = now(), encerrada_por = auth.uid() where id = r.id;
    perform interno.alumia_painel_soltar(r.usuario, r.ja_suspensa);
    v_n := v_n + 1;
  end loop;
  perform interno.alumia_painel_registrar('rede_liberada', 'rede', b.id::text, '', v_motivo, jsonb_build_object('contas', v_n));
  return jsonb_build_object('ok', true, 'contas', v_n);
end $$;

/**
 * Com um banimento por rede em vigor, pedido de entrada novo só é aceito de conta cuja rede o servidor acabou de ver (30 minutos):
 * sem isso, bastaria pular a chamada ao servidor para pedir a entrada de uma rede barrada.
 */
create or replace function interno.alumia_painel_pedido_com_rede() returns trigger language plpgsql security definer set search_path = interno, pg_temp as $$
begin
  if new.situacao <> 'em_analise' or auth.uid() is null or auth.uid() is distinct from new.usuario or interno.servico() then return new; end if;
  if tg_op = 'UPDATE' and old.situacao = 'em_analise' and new.pedido_em is not distinct from old.pedido_em then return new; end if;
  if not exists (select 1 from alumia_impressao_banimentos b where b.encerrado_em is null and b.ate > now()) then return new; end if;
  if interno.alumia_painel_da_casa(new.usuario) then return new; end if;
  if not exists (select 1 from alumia_impressoes i where i.usuario = new.usuario and i.vista_em > now() - interval '30 minutes') then
    perform interno.erro('alumia_rede');
  end if;
  return new;
end $$;
drop trigger if exists alumia_painel_pedido_com_rede on interno.alumia_entrada;
create trigger alumia_painel_pedido_com_rede before insert or update on interno.alumia_entrada for each row execute function interno.alumia_painel_pedido_com_rede();

-- 7. Posts, respostas, stories, mídias e aviso fixado ───────────────────────────────────────────────────────────────────────

/**
 * Busca de posts e respostas. Filtros (todos opcionais): busca, comunidade, pessoa (@ ou codinome exato), de, ate, estado
 * ('todos', 'visiveis', 'ocultos', 'retidos', 'lixeira', 'denunciados'), tipo ('todos', 'posts', 'respostas'), pagina.
 * Post de núcleo e de espaço fechado NÃO aparece aqui: a equipe geral só os abre a partir de uma denúncia (aba Denúncias),
 * com o acesso registrado e a mediação do núcleo avisada.
 */
create or replace function public.alumia_painel_posts(p jsonb default '{}'::jsonb) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare
  v_busca text := interno.alumia_painel_busca(p ->> 'busca');
  v_com text := nullif(lower(btrim(coalesce(p ->> 'comunidade', ''))), '');
  v_pessoa text := nullif(btrim(coalesce(p ->> 'pessoa', ''), ' @'), '');
  v_estado text := coalesce(nullif(p ->> 'estado', ''), 'todos');
  v_tipo text := coalesce(nullif(p ->> 'tipo', ''), 'todos');
  v_pagina integer := greatest(0, least(coalesce((p ->> 'pagina')::integer, 0), 2000));
  v_de timestamptz; v_ate timestamptz; v_autor uuid; v_itens jsonb;
begin
  perform interno.alumia_painel_exige();
  perform interno.limite('alumia_painel_buscar', 240, 60);
  if v_estado not in ('todos', 'visiveis', 'ocultos', 'retidos', 'lixeira', 'denunciados') then perform interno.erro('invalido:estado'); end if;
  if v_tipo not in ('todos', 'posts', 'respostas') then perform interno.erro('invalido:tipo'); end if;
  begin
    v_de := nullif(p ->> 'de', '')::date;
    v_ate := nullif(p ->> 'ate', '')::date + interval '1 day';
  exception when others then perform interno.erro('invalido:data');
  end;
  if v_pessoa is not null then
    select f.id into v_autor from perfis f where f.rede_handle = lower(v_pessoa) or f.rede_codinome = v_pessoa order by (f.rede_handle = lower(v_pessoa)) desc limit 1;
    if v_autor is null then return jsonb_build_object('itens', '[]'::jsonb, 'mais', false); end if;
  end if;
  select coalesce(jsonb_agg(x.j order by x.criado_em desc), '[]'::jsonb) into v_itens from (
    select q.criado_em, jsonb_build_object(
      'id', q.id, 'tipo', q.tipo, 'titulo', q.titulo, 'trecho', left(q.texto, 280), 'comunidade', q.comunidade, 'publico', interno.rede2_publico(q),
      'criado_em', q.criado_em, 'oculto', q.oculto, 'retido', q.retido, 'travado', q.travado, 'resposta', q.resposta_a is not null, 'motivo', q.motivo,
      'autor', interno.alumia_painel_nome(q.autor), 'autor_id', q.autor,
      'midias', (select count(*) from rede_midia m where m.post = q.id),
      'denuncias', (select count(*) from rede_denuncias d where d.alvo_tipo = 'post' and d.alvo = q.id::text and d.situacao in ('aberta', 'em_analise')),
      'lixeira', (select jsonb_build_object('ate', l.restaurar_ate, 'motivo', l.motivo, 'em', l.apagado_em) from alumia_painel_lixeira l where l.post = q.id and l.de_vez_em is null)) as j
    from rede_posts q
    where q.nucleo is null and coalesce(q.comunidade, '') not like 'fechado-%' and q.apagado_em is null and q.repost_de is null
      and (v_busca = '' or q.texto ilike '%' || v_busca || '%' or coalesce(q.titulo, '') ilike '%' || v_busca || '%')
      and (v_com is null or q.comunidade = v_com)
      and (v_autor is null or q.autor = v_autor)
      and (v_de is null or q.criado_em >= v_de) and (v_ate is null or q.criado_em < v_ate)
      and (v_tipo = 'todos' or (v_tipo = 'respostas') = (q.resposta_a is not null))
      and case v_estado
        when 'visiveis' then not q.oculto and not q.retido
        when 'ocultos' then q.oculto and not q.retido and not exists (select 1 from alumia_painel_lixeira l where l.post = q.id)
        when 'retidos' then q.retido
        when 'lixeira' then exists (select 1 from alumia_painel_lixeira l where l.post = q.id and l.de_vez_em is null)
        when 'denunciados' then exists (select 1 from rede_denuncias d where d.alvo_tipo = 'post' and d.alvo = q.id::text and d.situacao in ('aberta', 'em_analise'))
        else true end
    order by q.criado_em desc limit 51 offset v_pagina * 50) x;
  return jsonb_build_object('itens', case when jsonb_array_length(v_itens) > 50 then v_itens - 50 else v_itens end, 'mais', jsonb_array_length(v_itens) > 50);
end $$;

/**
 * Agir num post ou resposta: 'ocultar' (some para todos menos o autor), 'mostrar', 'apagar' (vai para a lixeira: volta em até 30
 * dias, depois o conteúdo some de vez) e 'restaurar' (tira da lixeira). O autor é avisado com o motivo e o caminho do recurso.
 */
create or replace function public.alumia_painel_post_agir(p_id uuid, p_acao text, p_motivo text) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare x rede_posts; l alumia_painel_lixeira; v_motivo text := interno.alumia_painel_motivo(p_motivo); v_lixo boolean;
begin
  perform interno.alumia_painel_exige();
  perform interno.limite('alumia_painel_agir', 300, 60);
  if p_acao is null or p_acao not in ('ocultar', 'mostrar', 'apagar', 'restaurar') then perform interno.erro('invalido:acao'); end if;
  select * into x from rede_posts where id = p_id for update;
  if not found or x.apagado_em is not null then perform interno.erro('nao_encontrado'); end if;
  if x.nucleo is not null or coalesce(x.comunidade, '') like 'fechado-%' then perform interno.erro('so_pela_denuncia'); end if;
  select * into l from alumia_painel_lixeira where post = x.id and de_vez_em is null;
  v_lixo := found;
  if p_acao = 'ocultar' then
    if v_lixo then perform interno.erro('na_lixeira'); end if;
    update rede_posts set oculto = true, retido = false, motivo = left(v_motivo, 200) where id = x.id;
    perform interno.rede3_mod_registrar('remover', 'post', x.id::text, 'painel', v_motivo, null);
  elsif p_acao = 'mostrar' then
    if v_lixo then perform interno.erro('na_lixeira'); end if;
    update rede_posts set oculto = false, retido = false, motivo = '', avaliacao = 'revista' where id = x.id;
    perform interno.rede3_mod_registrar('restaurar', 'post', x.id::text, 'painel', v_motivo, null);
  elsif p_acao = 'apagar' then
    if v_lixo then perform interno.erro('na_lixeira'); end if;
    delete from alumia_painel_lixeira where post = x.id;
    insert into alumia_painel_lixeira (post, por, motivo, estava_oculto, estava_retido) values (x.id, auth.uid(), v_motivo, x.oculto, x.retido);
    update rede_posts set oculto = true, retido = false, motivo = left(v_motivo, 200) where id = x.id;
    perform interno.rede3_mod_registrar('remover', 'post', x.id::text, 'painel', v_motivo, null);
  else
    if not v_lixo then perform interno.erro('nao_encontrado'); end if;
    delete from alumia_painel_lixeira where post = x.id;
    update rede_posts set oculto = l.estava_oculto, retido = l.estava_retido, motivo = case when l.estava_oculto then motivo else '' end where id = x.id;
    perform interno.rede3_mod_registrar('restaurar', 'post', x.id::text, 'painel', v_motivo, null);
  end if;
  if p_acao in ('ocultar', 'apagar') and x.autor is not null then
    perform interno.rede3_mod_avisar_afetado(x.autor, left('Um post seu foi retirado da Alumia (decisão de uma pessoa da coordenação). Você pode recorrer em até 30 dias, em Denúncias e recursos. Motivo: ' || v_motivo, 500));
  elsif p_acao in ('mostrar', 'restaurar') and x.autor is not null then
    perform interno.rede3_mod_avisar_afetado(x.autor, 'Um post seu voltou ao ar na Alumia.');
  end if;
  perform interno.alumia_painel_registrar('post_' || p_acao, 'post', x.id::text, interno.alumia_painel_nome_fixo(x.autor), v_motivo, jsonb_build_object('comunidade', x.comunidade, 'resposta', x.resposta_a is not null));
  return jsonb_build_object('ok', true, 'acao', p_acao);
end $$;

/**
 * Os stories no ar (e os retidos). Só texto, legenda e se tem imagem ou vídeo: o arquivo abre pela rota do servidor. Story para
 * os amigos próximos ("proximos") é como post de núcleo: não entra na lista geral; aparece só quando há denúncia aberta sobre ele
 * (ou quando já está retido) e, aberto, fica no registro do painel.
 */
create or replace function public.alumia_painel_stories(p jsonb default '{}'::jsonb) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v_pessoa text := nullif(btrim(coalesce(p ->> 'pessoa', ''), ' @'), ''); v_so_retidos boolean := coalesce((p ->> 'retidos')::boolean, false);
begin
  perform interno.alumia_painel_exige();
  return coalesce((select jsonb_agg(x.j order by x.criado_em desc) from (
    select s.criado_em, jsonb_build_object('id', s.id, 'autor', interno.alumia_painel_nome(s.autor), 'autor_id', s.autor, 'texto', s.texto, 'legenda', s.legenda,
      'alt', s.alt, 'fundo', s.fundo, 'cor', s.cor, 'publico', s.publico, 'midia', s.midia_caminho is not null, 'caminho', s.midia_caminho,
      'retido', s.retido, 'criado_em', s.criado_em, 'expira_em', s.expira_em) as j
    from rede_stories s left join perfis f on f.id = s.autor
    where (s.expira_em > now() or s.retido) and (not v_so_retidos or s.retido)
      and (s.publico <> 'proximos' or s.retido or interno.alumia_painel_story_denunciado(s.id))
      and (v_pessoa is null or f.rede_handle = lower(v_pessoa) or f.rede_codinome = v_pessoa)
    order by s.criado_em desc limit 200) x), '[]'::jsonb);
end $$;

/** Há denúncia aberta sobre o story? */
create or replace function interno.alumia_painel_story_denunciado(p uuid) returns boolean language sql stable security definer set search_path = interno, pg_temp as $$
  select exists (select 1 from rede_denuncias d where d.alvo_tipo = 'story' and d.alvo = p::text and d.situacao in ('aberta', 'em_analise'))
$$;

/**
 * Antes de a rota do servidor (app/api/alumia/painel/midia) assinar o endereço de um arquivo para o painel: o arquivo tem de ser
 * de um post fora de núcleo e de espaço fechado, ou de um story que a lista do painel mostra (o "proximos" só com denúncia aberta
 * ou retido). Cada abertura fica no registro do painel. Devolve {ok: true}; o que não passa recebe "nao_encontrado".
 */
create or replace function public.alumia_painel_midia_abrir(p_tipo text, p_caminho text) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare q rede_posts; s rede_stories; v_caminho text := btrim(coalesce(p_caminho, ''));
begin
  perform interno.alumia_painel_exige();
  perform interno.limite('alumia_painel_midia', 300, 60);
  if p_tipo = 'post' then
    select x.* into q from rede_midia m join rede_posts x on x.id = m.post where m.caminho = v_caminho limit 1;
    if not found or q.nucleo is not null or coalesce(q.comunidade, '') like 'fechado-%' or q.apagado_em is not null then perform interno.erro('nao_encontrado'); end if;
    perform interno.alumia_painel_registrar('midia_aberta', 'post', q.id::text, interno.alumia_painel_nome_fixo(q.autor), '');
  elsif p_tipo = 'story' then
    select * into s from rede_stories where midia_caminho = v_caminho;
    if not found or (s.publico = 'proximos' and not s.retido and not interno.alumia_painel_story_denunciado(s.id)) then perform interno.erro('nao_encontrado'); end if;
    perform interno.alumia_painel_registrar('midia_aberta', 'story', s.id::text, interno.alumia_painel_nome_fixo(s.autor), '', jsonb_build_object('publico', s.publico));
  else
    perform interno.erro('invalido:tipo');
  end if;
  return jsonb_build_object('ok', true);
end $$;

/** Agir num story: 'reter' (some para todos menos quem postou), 'liberar' ou 'apagar' (sai de vez: story não tem lixeira, ele já some em 24 h). */
create or replace function public.alumia_painel_story_agir(p_id uuid, p_acao text, p_motivo text) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare s rede_stories; v_motivo text := interno.alumia_painel_motivo(p_motivo);
begin
  perform interno.alumia_painel_exige();
  perform interno.limite('alumia_painel_agir', 300, 60);
  if p_acao is null or p_acao not in ('reter', 'liberar', 'apagar') then perform interno.erro('invalido:acao'); end if;
  select * into s from rede_stories where id = p_id for update;
  if not found then perform interno.erro('nao_encontrado'); end if;
  if s.publico = 'proximos' and not s.retido and not interno.alumia_painel_story_denunciado(s.id) then perform interno.erro('so_pela_denuncia'); end if;
  if p_acao = 'reter' then update rede_stories set retido = true where id = s.id;
  elsif p_acao = 'liberar' then update rede_stories set retido = false where id = s.id;
  else
    delete from avisos a where a.id in (select r.aviso from rede_story_respostas r where r.story = s.id and r.aviso is not null
                                        union select y.aviso from rede_story_reacoes y where y.story = s.id and y.aviso is not null);
    delete from rede_stories where id = s.id;
  end if;
  if p_acao <> 'liberar' then
    perform interno.rede3_mod_avisar_afetado(s.autor, left('Um story seu foi ' || case when p_acao = 'reter' then 'retido' else 'apagado' end || ' pela coordenação da Alumia. Motivo: ' || v_motivo, 500));
  end if;
  perform interno.alumia_painel_registrar('story_' || p_acao, 'story', s.id::text, interno.alumia_painel_nome_fixo(s.autor), v_motivo);
  return jsonb_build_object('ok', true, 'acao', p_acao);
end $$;

/** As imagens dos posts (fora de núcleo e de espaço fechado), das mais novas para as mais antigas. */
create or replace function public.alumia_painel_midias(p jsonb default '{}'::jsonb) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v_pessoa text := nullif(btrim(coalesce(p ->> 'pessoa', ''), ' @'), ''); v_pagina integer := greatest(0, least(coalesce((p ->> 'pagina')::integer, 0), 2000)); v_itens jsonb;
begin
  perform interno.alumia_painel_exige();
  select coalesce(jsonb_agg(x.j order by x.criado_em desc), '[]'::jsonb) into v_itens from (
    select m.criado_em, jsonb_build_object('id', m.id, 'post', m.post, 'caminho', m.caminho, 'alt', m.alt, 'largura', m.largura, 'altura', m.altura, 'criado_em', m.criado_em,
      'autor', interno.alumia_painel_nome(q.autor), 'trecho', left(q.texto, 120), 'oculto', q.oculto, 'comunidade', q.comunidade) as j
    from rede_midia m join rede_posts q on q.id = m.post left join perfis f on f.id = q.autor
    where q.nucleo is null and coalesce(q.comunidade, '') not like 'fechado-%' and q.apagado_em is null
      and (v_pessoa is null or f.rede_handle = lower(v_pessoa) or f.rede_codinome = v_pessoa)
    order by m.criado_em desc limit 61 offset v_pagina * 60) x;
  return jsonb_build_object('itens', case when jsonb_array_length(v_itens) > 60 then v_itens - 60 else v_itens end, 'mais', jsonb_array_length(v_itens) > 60);
end $$;

/** Apagar UMA imagem de um post (o post fica). Não tem volta: o arquivo sai do depósito na faxina de mídias. */
create or replace function public.alumia_painel_midia_apagar(p_id uuid, p_motivo text) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare m rede_midia; q rede_posts; v_motivo text := interno.alumia_painel_motivo(p_motivo);
begin
  perform interno.alumia_painel_exige();
  perform interno.limite('alumia_painel_agir', 300, 60);
  select * into m from rede_midia where id = p_id;
  if not found then perform interno.erro('nao_encontrado'); end if;
  select * into q from rede_posts where id = m.post;
  if q.nucleo is not null or coalesce(q.comunidade, '') like 'fechado-%' then perform interno.erro('so_pela_denuncia'); end if;
  delete from rede_midia where id = m.id;
  if q.autor is not null then
    perform interno.rede3_mod_avisar_afetado(q.autor, left('Uma imagem de um post seu foi apagada pela coordenação da Alumia. Motivo: ' || v_motivo, 500));
  end if;
  perform interno.rede3_mod_registrar('remover', 'post', q.id::text, 'painel', left('imagem: ' || v_motivo, 1000), null);
  perform interno.alumia_painel_registrar('midia_apagada', 'midia', m.id::text, interno.alumia_painel_nome_fixo(q.autor), v_motivo, jsonb_build_object('post', q.id, 'caminho', m.caminho));
  return jsonb_build_object('ok', true, 'caminho', m.caminho);
end $$;

/** Os avisos fixados (para o painel). */
create or replace function public.alumia_painel_avisos() returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
begin
  perform interno.alumia_painel_exige();
  perform interno.alumia_painel_faxina();
  return coalesce((select jsonb_agg(jsonb_build_object('id', a.id, 'texto', a.texto, 'link', a.link, 'por', interno.alumia_painel_quem(a.por),
      'de', a.criado_em, 'ate', a.ate, 'ativo', a.retirado_em is null) order by (a.retirado_em is null) desc, a.criado_em desc)
    from (select * from alumia_avisos_fixados order by (retirado_em is null) desc, criado_em desc limit 40) a), '[]'::jsonb);
end $$;

/** Fixar um aviso no alto da Alumia por 1 a 30 dias (no máximo 3 de cada vez). O link, se houver, é um caminho de dentro do site. */
create or replace function public.alumia_painel_aviso_fixar(p_texto text, p_link text, p_dias integer) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v_texto text := interno.txt(p_texto, 'texto', 5, 280); v_link text := nullif(btrim(coalesce(p_link, '')), ''); v_id uuid;
begin
  perform interno.alumia_painel_exige();
  perform interno.limite('alumia_painel_agir', 300, 60);
  perform interno.alumia_painel_faxina();
  if p_dias is null or p_dias < 1 or p_dias > 30 then perform interno.erro('invalido:dias'); end if;
  if v_link is not null and (v_link !~ '^/[A-Za-z0-9/_@.?=&%#-]{0,200}$' or v_link like '//%') then perform interno.erro('invalido:link'); end if;
  if (select count(*) from alumia_avisos_fixados where retirado_em is null) >= 3 then perform interno.erro('avisos_demais'); end if;
  insert into alumia_avisos_fixados (texto, link, por, ate) values (v_texto, v_link, auth.uid(), now() + make_interval(days => p_dias)) returning id into v_id;
  perform interno.alumia_painel_registrar('aviso_fixado', 'aviso', v_id::text, left(v_texto, 100), '', jsonb_build_object('dias', p_dias, 'link', v_link));
  return jsonb_build_object('id', v_id);
end $$;

create or replace function public.alumia_painel_aviso_tirar(p_id uuid) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare a alumia_avisos_fixados;
begin
  perform interno.alumia_painel_exige();
  perform interno.limite('alumia_painel_agir', 300, 60);
  select * into a from alumia_avisos_fixados where id = p_id and retirado_em is null for update;
  if not found then perform interno.erro('nao_encontrado'); end if;
  update alumia_avisos_fixados set retirado_em = now() where id = a.id;
  perform interno.alumia_painel_registrar('aviso_retirado', 'aviso', a.id::text, left(a.texto, 100), '');
  return jsonb_build_object('ok', true);
end $$;

/** O que a Alumia mostra no alto: os avisos fixados em vigor. Só o texto, o link e desde quando; nunca quem fixou. */
create or replace function public.alumia_avisos_fixados() returns jsonb language plpgsql stable security definer set search_path = interno, pg_temp as $$
begin
  return coalesce((select jsonb_agg(jsonb_build_object('id', a.id, 'texto', a.texto, 'link', a.link, 'desde', a.criado_em) order by a.criado_em desc)
    from alumia_avisos_fixados a where a.retirado_em is null and a.ate > now()), '[]'::jsonb);
end $$;

-- 8. Denúncias ──────────────────────────────────────────────────────────────────────────────────────────────────────────────

/** A fila única: tudo o que foi denunciado na Alumia, por prioridade. Quem denunciou nunca aparece. */
create or replace function public.alumia_painel_denuncias(p_situacao text default 'abertas') returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
begin
  perform interno.alumia_painel_exige();
  return coalesce((select jsonb_agg(interno.rede3_mod_item(d) order by (d.situacao in ('aberta', 'em_analise')) desc, d.prioridade, d.criado_em)
    from (select * from rede_denuncias q
          where (case when coalesce(p_situacao, 'abertas') = 'fechadas' then q.situacao in ('resolvida', 'descartada') else q.situacao in ('aberta', 'em_analise') end)
          order by q.prioridade, q.criado_em limit 400) d), '[]'::jsonb);
end $$;

/**
 * Abre uma denúncia com o conteúdo para decidir e a marca "em análise". Em post de núcleo, o acesso fica no registro de
 * moderação (quebra-vidro, uma vez por pessoa e denúncia) e a mediação do núcleo é avisada, como em rede_mod_abrir.
 */
create or replace function public.alumia_painel_denuncia(p_id uuid) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := auth.uid(); d rede_denuncias; x rede_posts; v_alvo jsonb;
begin
  perform interno.alumia_painel_exige();
  perform interno.limite('alumia_painel_agir', 300, 60);
  select * into d from rede_denuncias where id = p_id;
  if not found then perform interno.erro('nao_encontrado'); end if;
  if d.situacao = 'aberta' then update rede_denuncias set situacao = 'em_analise', cuida = v where id = d.id; d.situacao := 'em_analise'; end if;
  if d.alvo_tipo = 'post' then
    select * into x from rede_posts where id::text = d.alvo;
    if found then
      if x.nucleo is not null and not exists (select 1 from rede_nucleo_membros n where n.nucleo = x.nucleo and n.usuario = v)
         and not exists (select 1 from rede_moderacao m where m.acao = 'quebra_vidro' and m.denuncia = d.id and m.quem = v) then
        perform interno.rede3_mod_registrar('quebra_vidro', 'post', x.id::text, 'denuncia', 'O painel da Alumia abriu o post de núcleo por causa da denúncia ' || d.protocolo || '.', d.id);
        insert into avisos (para, texto, categoria)
        select n.usuario, 'A moderação geral abriu um post do núcleo por causa de uma denúncia (protocolo ' || d.protocolo || '). O acesso ficou registrado.', 'rede'
        from rede_nucleo_membros n where n.nucleo = x.nucleo and n.papel = 'mediacao';
        perform interno.alumia_painel_registrar('quebra_vidro', 'post', x.id::text, interno.alumia_painel_nome_fixo(x.autor), 'Denúncia ' || d.protocolo);
      end if;
      v_alvo := jsonb_build_object('id', x.id, 'tipo', x.tipo, 'titulo', x.titulo, 'texto', x.texto, 'corpo', x.corpo, 'comunidade', x.comunidade, 'nucleo', x.nucleo is not null,
        'criado_em', x.criado_em, 'oculto', x.oculto, 'retido', x.retido, 'motivo', x.motivo, 'autor', interno.alumia_painel_nome(x.autor), 'autor_id', x.autor,
        'autor_nivel', interno.rede3_mod_nivel(x.autor), 'autor_procedentes_90', interno.rede3_mod_procedentes(x.autor, 90));
    end if;
  elsif d.alvo_tipo = 'perfil' then
    select jsonb_build_object('autor', interno.alumia_painel_nome(f.id), 'autor_id', f.id, 'bio', f.rede_bio, 'autor_nivel', interno.rede3_mod_nivel(f.id),
      'autor_procedentes_90', interno.rede3_mod_procedentes(f.id, 90)) into v_alvo from perfis f where f.id::text = d.alvo;
  elsif d.alvo_tipo = 'comunidade' then
    select jsonb_build_object('comunidade', c.slug, 'nome', c.nome, 'descricao', c.descricao) into v_alvo from rede_comunidades c where c.slug = d.alvo;
  end if;
  return jsonb_build_object('denuncia', interno.rede3_mod_item(d), 'alvo', v_alvo,
    'historico', coalesce((select jsonb_agg(jsonb_build_object('acao', m.acao, 'regra', m.regra, 'motivo', m.motivo, 'criado_em', m.criado_em) order by m.criado_em desc)
                           from rede_moderacao m where m.alvo_tipo = d.alvo_tipo and m.alvo = d.alvo and m.acao <> 'quebra_vidro'), '[]'::jsonb));
end $$;

/**
 * A decisão: 'ocultar' (só post: sai do ar), 'avisar' (o autor recebe o aviso; nada sai do ar) ou 'descartar' (não há violação).
 * Sempre com a regra e o motivo. Quem denunciou recebe o andamento e, se houver, a resposta escrita (p_resposta), sem que a
 * moderação saiba quem é. Suspender ou banir a conta é na aba Pessoas.
 */
create or replace function public.alumia_painel_denuncia_decidir(p_id uuid, p_decisao text, p_regra text, p_motivo text, p_resposta text default '') returns jsonb
language plpgsql security definer set search_path = interno, pg_temp as $$
declare
  v uuid := auth.uid(); d rede_denuncias; x rede_posts; v_regra text := interno.txt(p_regra, 'regra', 3, 80); v_motivo text := interno.alumia_painel_motivo(p_motivo);
  v_resposta text := interno.txt(coalesce(p_resposta, ''), 'resposta', 0, 300); v_afetado uuid;
begin
  perform interno.alumia_painel_exige();
  perform interno.limite('alumia_painel_agir', 300, 60);
  if p_decisao is null or p_decisao not in ('ocultar', 'avisar', 'descartar') then perform interno.erro('invalido:decisao'); end if;
  select * into d from rede_denuncias where id = p_id for update;
  if not found then perform interno.erro('nao_encontrado'); end if;
  if d.situacao in ('resolvida', 'descartada') then perform interno.erro('ja_decidida'); end if;
  if d.alvo_tipo = 'post' then
    select * into x from rede_posts where id::text = d.alvo;
    if found then
      v_afetado := x.autor;
      -- Em post de núcleo, a decisão só vem depois de abrir a denúncia (o acesso registrado e a mediação avisada).
      if x.nucleo is not null and not exists (select 1 from rede_nucleo_membros n where n.nucleo = x.nucleo and n.usuario = v)
         and not exists (select 1 from rede_moderacao m where m.acao = 'quebra_vidro' and m.denuncia = d.id and m.quem = v) then
        perform interno.erro('abra_primeiro');
      end if;
    end if;
  elsif d.alvo_tipo = 'perfil' then
    begin v_afetado := d.alvo::uuid; exception when others then v_afetado := null; end;
  end if;
  if p_decisao = 'ocultar' then
    if d.alvo_tipo <> 'post' or x.id is null then perform interno.erro('invalido:decisao'); end if;
    update rede_posts set oculto = true, retido = false, motivo = left(v_motivo, 200) where id = x.id;
    perform interno.rede3_mod_registrar('remover', 'post', x.id::text, v_regra, v_motivo, d.id);
    perform interno.rede3_mod_avisar_afetado(v_afetado, left('Um post seu foi retirado da Alumia (regra: ' || v_regra || '). Decisão de uma pessoa da coordenação. Você pode recorrer em até 30 dias, em Denúncias e recursos. Motivo: ' || v_motivo, 500));
  elsif p_decisao = 'avisar' then
    if d.alvo_tipo = 'comunidade' or v_afetado is null then perform interno.erro('invalido:decisao'); end if;
    perform interno.rede3_mod_registrar('avisar', d.alvo_tipo, d.alvo, v_regra, v_motivo, d.id);
    perform interno.rede3_mod_avisar_afetado(v_afetado, left('A coordenação da Alumia deixou um aviso para você (regra: ' || v_regra || '). Você pode recorrer em até 30 dias, em Denúncias e recursos. Motivo: ' || v_motivo, 500));
  else
    perform interno.rede3_mod_registrar('descartar', d.alvo_tipo, d.alvo, v_regra, v_motivo, d.id);
  end if;
  update rede_denuncias set situacao = case when p_decisao = 'descartar' then 'descartada' else 'resolvida' end, cuida = v where id = d.id;
  perform interno.avisar_em(d.quem, left('Sua denúncia ' || d.protocolo || case when p_decisao = 'descartar'
      then ' foi analisada: não encontramos violação das normas da Alumia.' else ' foi analisada e a Alumia tomou providências.' end
    || case when v_resposta <> '' then ' Resposta da coordenação: ' || v_resposta else '' end || ' Obrigada por cuidar da rede.', 500), 'rede');
  perform interno.alumia_painel_registrar('denuncia_' || p_decisao, 'denuncia', d.protocolo, case when v_afetado is null then '' else interno.alumia_painel_nome_fixo(v_afetado) end, v_motivo,
    jsonb_build_object('regra', v_regra, 'categoria', d.categoria, 'alvo_tipo', d.alvo_tipo, 'respondeu', v_resposta <> ''));
  return jsonb_build_object('situacao', case when p_decisao = 'descartar' then 'descartada' else 'resolvida' end);
end $$;

-- 9. Papéis ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────

/**
 * Quem cuida da Alumia: a coordenação, o admin (um só) e a mediação do Instituto, que modera a Alumia pelo papel que já tem.
 * A lista da mediação é só leitura: dá-se e tira-se o papel no painel da equipe (Pessoas).
 */
create or replace function public.alumia_painel_papeis() returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v_papel text := interno.alumia_painel_exige();
begin
  return jsonb_build_object(
    'papel', v_papel,
    'admin', (select jsonb_build_object('id', a.usuario, 'nome', interno.alumia_painel_nome(a.usuario), 'desde', a.nomeado_em, 'por', interno.alumia_painel_quem(a.nomeado_por),
                'suspensa', (select suspenso from perfis f where f.id = a.usuario)) from alumia_painel_admin a),
    'coordenacao', coalesce((select jsonb_agg(distinct interno.alumia_painel_quem(f.id)) from papeis pa join perfis f on f.id = pa.usuario where pa.papel = 'coordenacao'), '[]'::jsonb),
    'mediacao', coalesce((select jsonb_agg(jsonb_build_object('nome', t.nome, 'na_alumia', t.na_alumia, 'suspensa', t.suspenso) order by t.nome)
      from (select distinct f.id, interno.alumia_painel_quem(f.id) as nome, f.suspenso, interno.alumia_situacao(f.id) = 'aprovada' as na_alumia from papeis pa join perfis f on f.id = pa.usuario where pa.papel = 'mediacao') t), '[]'::jsonb));
end $$;

/** Nomear O admin da Alumia. Só a coordenação. Um de cada vez: para trocar, destitua antes. A conta precisa estar aprovada na Alumia. */
create or replace function public.alumia_painel_admin_nomear(p_id uuid, p_motivo text) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare f perfis; v_motivo text := interno.alumia_painel_motivo(p_motivo);
begin
  perform interno.alumia_painel_exige(true);
  perform interno.limite('alumia_painel_papeis', 20, 60);
  f := interno.alumia_painel_alvo(p_id);
  if exists (select 1 from alumia_painel_admin) then perform interno.erro('ja_tem_admin'); end if;
  if f.suspenso or not interno.alumia_aprovada(f.id) then perform interno.erro('conta_nao_aprovada'); end if;
  insert into alumia_painel_admin (usuario, nomeado_por) values (f.id, auth.uid());
  perform interno.avisar_em(f.id, 'Você foi nomeada ou nomeado admin da Alumia pela coordenação. O painel de controle aparece no painel interno do Instituto. Use sempre com o aplicativo autenticador.', 'conta');
  perform interno.alumia_painel_registrar('admin_nomeado', 'pessoa', f.id::text, interno.alumia_painel_nome_fixo(f.id), v_motivo);
  return jsonb_build_object('ok', true);
end $$;

/** Destituir o admin. Só a coordenação. */
create or replace function public.alumia_painel_admin_destituir(p_motivo text) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare a alumia_painel_admin; v_motivo text := interno.alumia_painel_motivo(p_motivo);
begin
  perform interno.alumia_painel_exige(true);
  perform interno.limite('alumia_painel_papeis', 20, 60);
  select * into a from alumia_painel_admin for update;
  if not found then perform interno.erro('nao_encontrado'); end if;
  delete from alumia_painel_admin;
  perform interno.avisar_em(a.usuario, 'Você deixou de ser admin da Alumia.', 'conta');
  perform interno.alumia_painel_registrar('admin_destituido', 'pessoa', a.usuario::text, interno.alumia_painel_nome_fixo(a.usuario), v_motivo);
  return jsonb_build_object('ok', true);
end $$;

-- 10. Comunidades e organizações ────────────────────────────────────────────────────────────────────────────────────────────

/** Comunidade encerrada não recebe post novo (quem publica pela API recebe "comunidade_encerrada"). A federação e o banco passam. */
create or replace function interno.alumia_painel_comunidade_aberta() returns trigger language plpgsql security definer set search_path = interno, pg_temp as $$
begin
  if new.comunidade is not null and auth.uid() is not null and not interno.servico()
     and exists (select 1 from alumia_comunidades_encerradas e where e.slug = new.comunidade) then
    perform interno.erro('comunidade_encerrada');
  end if;
  return new;
end $$;
drop trigger if exists alumia_painel_comunidade_aberta on interno.rede_posts;
create trigger alumia_painel_comunidade_aberta before insert on interno.rede_posts for each row execute function interno.alumia_painel_comunidade_aberta();

create or replace function public.alumia_painel_comunidades() returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
begin
  perform interno.alumia_painel_exige();
  return coalesce((select jsonb_agg(jsonb_build_object(
      'slug', c.slug, 'nome', c.nome, 'descricao', c.descricao, 'categoria', c.categoria, 'tipo', c.tipo, 'criada_em', c.criada_em,
      'membros', (select count(*) from rede_comunidade_membros m where m.comunidade = c.slug and m.situacao = 'ativo'),
      'posts_30', (select count(*) from rede_posts p where p.comunidade = c.slug and p.criado_em > now() - interval '30 days' and p.apagado_em is null),
      'denuncias', (select count(*) from rede_denuncias d where d.situacao in ('aberta', 'em_analise')
                      and ((d.alvo_tipo = 'comunidade' and d.alvo = c.slug) or (d.alvo_tipo = 'post' and exists (select 1 from rede_posts p where p.id::text = d.alvo and p.comunidade = c.slug)))),
      'moderacao', coalesce((select jsonb_agg(jsonb_build_object('id', m.usuario, 'nome', interno.alumia_painel_nome(m.usuario)))
                             from rede_comunidade_membros m where m.comunidade = c.slug and m.papel = 'moderacao' and m.situacao = 'ativo'), '[]'::jsonb),
      'encerrada', (select jsonb_build_object('em', e.em, 'motivo', e.motivo) from alumia_comunidades_encerradas e where e.slug = c.slug)) order by c.nome)
    from rede_comunidades c where c.slug not like 'fechado-%'), '[]'::jsonb);
end $$;

/** Criar uma comunidade direto (sem proposta). p: slug, nome, descricao, categoria ('lutas' ou 'instituto'), tipo ('aberta', 'restrita', 'fechada'). */
create or replace function public.alumia_painel_comunidade_criar(p jsonb) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare
  v_slug text := lower(btrim(coalesce(p ->> 'slug', ''))); v_nome text := interno.txt(p ->> 'nome', 'nome', 3, 60); v_desc text := interno.txt(coalesce(p ->> 'descricao', ''), 'descricao', 0, 500);
  v_cat text := coalesce(nullif(p ->> 'categoria', ''), 'lutas'); v_tipo text := coalesce(nullif(p ->> 'tipo', ''), 'aberta');
begin
  perform interno.alumia_painel_exige();
  perform interno.limite('alumia_painel_agir', 300, 60);
  if v_slug !~ '^[a-z0-9][a-z0-9-]{1,58}[a-z0-9]$' or v_slug like 'fechado-%' then perform interno.erro('invalido:slug'); end if;
  if v_cat not in ('lutas', 'instituto') then perform interno.erro('invalido:categoria'); end if;
  if v_tipo not in ('aberta', 'restrita', 'fechada') then perform interno.erro('invalido:tipo'); end if;
  if exists (select 1 from rede_comunidades k where k.slug = v_slug or v_slug = any (k.apelidos)) then perform interno.erro('slug_em_uso'); end if;
  insert into rede_comunidades (slug, nome, descricao, categoria, tipo, publico_padrao, criada_por) values (v_slug, v_nome, v_desc, v_cat, v_tipo, 'membros', auth.uid());
  if to_regprocedure('interno.rede3_com_padroes(text)') is not null then execute 'select interno.rede3_com_padroes($1)' using v_slug; end if;
  perform interno.alumia_painel_registrar('comunidade_criada', 'comunidade', v_slug, v_nome, '', jsonb_build_object('categoria', v_cat, 'tipo', v_tipo));
  return jsonb_build_object('slug', v_slug);
end $$;

/** Encerrar (ninguém mais publica; o que existe continua para leitura) ou reabrir uma comunidade. */
create or replace function public.alumia_painel_comunidade_fechar(p_slug text, p_fechar boolean, p_motivo text) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare c rede_comunidades; v_motivo text := interno.alumia_painel_motivo(p_motivo); m record;
begin
  perform interno.alumia_painel_exige();
  perform interno.limite('alumia_painel_agir', 300, 60);
  select * into c from rede_comunidades where slug = lower(btrim(coalesce(p_slug, '')));
  if not found then perform interno.erro('nao_encontrado'); end if;
  if coalesce(p_fechar, true) then
    insert into alumia_comunidades_encerradas (slug, motivo, por) values (c.slug, v_motivo, auth.uid()) on conflict (slug) do nothing;
    if not found then perform interno.erro('ja_encerrada'); end if;
    for m in select usuario from rede_comunidade_membros where comunidade = c.slug and papel = 'moderacao' and situacao = 'ativo' loop
      perform interno.avisar_em(m.usuario, format('A comunidade “%s” foi encerrada pela coordenação da Alumia: %s', c.nome, left(v_motivo, 300)), 'rede');
    end loop;
  else
    delete from alumia_comunidades_encerradas where slug = c.slug;
    if not found then perform interno.erro('nao_encontrado'); end if;
  end if;
  perform interno.alumia_painel_registrar(case when coalesce(p_fechar, true) then 'comunidade_encerrada' else 'comunidade_reaberta' end, 'comunidade', c.slug, c.nome, v_motivo);
  return jsonb_build_object('ok', true);
end $$;

/** Pôr ou tirar alguém da moderação de uma comunidade. Quem entra precisa ser membro da Alumia. */
create or replace function public.alumia_painel_comunidade_moderacao(p_slug text, p_id uuid, p_sim boolean, p_motivo text) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare c rede_comunidades; v_motivo text := interno.alumia_painel_motivo(p_motivo); v_sim boolean := coalesce(p_sim, true);
begin
  perform interno.alumia_painel_exige();
  perform interno.limite('alumia_painel_agir', 300, 60);
  select * into c from rede_comunidades where slug = lower(btrim(coalesce(p_slug, '')));
  if not found or not exists (select 1 from perfis where id = p_id) then perform interno.erro('nao_encontrado'); end if;
  if v_sim then
    if not interno.rede2_membro(p_id) and not (interno.alumia_exigida() and interno.alumia_aprovada(p_id)) then perform interno.erro('conta_nao_aprovada'); end if;
    insert into rede_comunidade_membros (comunidade, usuario, papel, situacao) values (c.slug, p_id, 'moderacao', 'ativo')
    on conflict (comunidade, usuario) do update set papel = 'moderacao', situacao = 'ativo', banido_ate = null;
    perform interno.avisar_em(p_id, format('Você agora modera “%s” na Alumia. Leia as regras e, se não quiser, é só sair da comunidade.', c.nome), 'rede');
  else
    update rede_comunidade_membros set papel = 'membro' where comunidade = c.slug and usuario = p_id and papel = 'moderacao';
    if not found then perform interno.erro('nao_encontrado'); end if;
    perform interno.avisar_em(p_id, format('Você deixou de moderar “%s” na Alumia.', c.nome), 'rede');
  end if;
  perform interno.alumia_painel_registrar(case when v_sim then 'moderacao_nomeada' else 'moderacao_retirada' end, 'comunidade', c.slug, interno.alumia_painel_nome_fixo(p_id), v_motivo);
  return jsonb_build_object('ok', true);
end $$;

/** As organizações, com o selo e o pedido de selo que estiver esperando. Quem cuida de cada uma não aparece. */
create or replace function public.alumia_painel_orgs() returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
begin
  perform interno.alumia_painel_exige();
  return coalesce((select jsonb_agg(jsonb_build_object(
      'id', o.perfil, 'codinome', coalesce(nullif(f.rede_codinome, ''), 'Sem nome'), 'handle', f.rede_handle, 'tipo', o.tipo, 'cidade', o.cidade,
      'selo', o.verificada_em, 'documento_tipo', o.documento_tipo, 'documento', o.documento_publico, 'criada_em', o.criada_em, 'suspensa', f.suspenso,
      'pedido', (select jsonb_build_object('id', x.id, 'documento_tipo', x.documento_tipo, 'documento', x.documento, 'sobre', x.sobre, 'criado_em', x.criado_em)
                 from rede_org_pedidos x where x.org = o.perfil and x.situacao = 'esperando'))
      order by (exists (select 1 from rede_org_pedidos x where x.org = o.perfil and x.situacao = 'esperando')) desc, f.rede_codinome)
    from rede_orgs o join perfis f on f.id = o.perfil), '[]'::jsonb);
end $$;

/** Decidir um pedido de selo (recusar pede o motivo, que quem cuida da organização lê). */
create or replace function public.alumia_painel_org_pedido_decidir(p_id uuid, p_aceitar boolean, p_motivo text default '') returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare x rede_org_pedidos; v_sim boolean := coalesce(p_aceitar, false); v_motivo text; g record; v_nome text;
begin
  perform interno.alumia_painel_exige();
  perform interno.limite('alumia_painel_agir', 300, 60);
  select * into x from rede_org_pedidos where id = p_id for update;
  if not found or x.situacao <> 'esperando' then perform interno.erro('nao_encontrado'); end if;
  v_motivo := case when v_sim then left(btrim(coalesce(p_motivo, '')), 500) else interno.alumia_painel_motivo(p_motivo) end;
  v_nome := interno.rede_nome(x.org);
  update rede_org_pedidos set situacao = case when v_sim then 'aceito' else 'recusado' end, motivo = v_motivo, decidido_em = now(), decidido_por = auth.uid() where id = x.id;
  if v_sim then
    update rede_orgs set verificada_em = now(), verificada_por = auth.uid(), documento_tipo = x.documento_tipo, documento_publico = x.documento where perfil = x.org;
  end if;
  for g in select gestor from rede_org_gestores where org = x.org loop
    perform interno.avisar_em(g.gestor, case when v_sim then format('A organização “%s” recebeu o selo da Alumia.', v_nome)
      else format('O pedido do selo de “%s” não foi aceito: %s', v_nome, v_motivo) end, 'rede');
  end loop;
  perform interno.alumia_painel_registrar(case when v_sim then 'selo_dado' else 'selo_recusado' end, 'organizacao', x.org::text, v_nome, v_motivo, jsonb_build_object('pedido', x.id));
  return jsonb_build_object('ok', true);
end $$;

/** Dar o selo direto (sem pedido na fila) ou tirar o selo. Sempre com motivo; quem cuida da organização é avisado. */
create or replace function public.alumia_painel_org_selo(p_org uuid, p_dar boolean, p_motivo text) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare o rede_orgs; v_sim boolean := coalesce(p_dar, false); v_motivo text := interno.alumia_painel_motivo(p_motivo); g record; v_nome text;
begin
  perform interno.alumia_painel_exige();
  perform interno.limite('alumia_painel_agir', 300, 60);
  select * into o from rede_orgs where perfil = p_org for update;
  if not found then perform interno.erro('nao_encontrado'); end if;
  if v_sim = (o.verificada_em is not null) then perform interno.erro('nada_a_fazer'); end if;
  v_nome := interno.rede_nome(o.perfil);
  if v_sim then
    update rede_orgs set verificada_em = now(), verificada_por = auth.uid() where perfil = o.perfil;
    update rede_org_pedidos set situacao = 'aceito', motivo = left(v_motivo, 500), decidido_em = now(), decidido_por = auth.uid() where org = o.perfil and situacao = 'esperando';
  else
    update rede_orgs set verificada_em = null, verificada_por = null where perfil = o.perfil;
  end if;
  for g in select gestor from rede_org_gestores where org = o.perfil loop
    perform interno.avisar_em(g.gestor, case when v_sim then format('A organização “%s” recebeu o selo da Alumia.', v_nome)
      else format('O selo de “%s” foi retirado: %s', v_nome, left(v_motivo, 300)) end, 'rede');
  end loop;
  perform interno.alumia_painel_registrar(case when v_sim then 'selo_dado' else 'selo_retirado' end, 'organizacao', o.perfil::text, v_nome, v_motivo);
  return jsonb_build_object('ok', true);
end $$;

-- 11. Funções (interruptores) e a trava da entrada ──────────────────────────────────────────────────────────────────────────

/** O recurso é da Alumia? (Só esses se ligam e desligam por este painel.) */
create or replace function interno.alumia_painel_recurso_da_alumia(p text) returns boolean language sql immutable as $$
  select p like 'alumia-%' or p in ('rede-v2', 'fediverso-total', 'fediverso-grupos')
$$;

/** Os recursos da Alumia (o catálogo e a decisão gravada no banco, que vale por cima do código) e a trava da entrada. */
create or replace function public.alumia_painel_funcoes() returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
begin
  perform interno.alumia_painel_exige();
  return jsonb_build_object(
    'recursos', coalesce((select jsonb_agg(jsonb_build_object('nome', k.nome, 'decisao', v.ligado, 'em', v.em, 'por', interno.alumia_painel_quem(v.por),
        'so_pelo_nome', k.so_pelo_nome,
        'aguardando', exists (select 1 from confirmacoes c where c.tipo = 'recurso' and c.alvo = k.nome and c.status = 'aguardando' and c.expira_em > now())) order by k.nome)
      from recursos_catalogo k left join recursos_vivos v on v.nome = k.nome where interno.alumia_painel_recurso_da_alumia(k.nome)), '[]'::jsonb),
    'trava', jsonb_build_object('ligada', interno.alumia_exigida(), 'desde', (select valor ->> 'ligada_em' from configuracoes where chave = 'alumia_entrada'),
      'eu_passo', interno.aal2() and interno.alumia_aprovada(auth.uid()),
      'aprovadas', (select count(*) from alumia_entrada where situacao = 'aprovada'),
      'na_fila', (select count(*) from alumia_entrada where situacao = 'em_analise')));
end $$;

/**
 * Liga, desliga ou devolve ao padrão do código (p_ligar nulo) um recurso da Alumia. Vale em até um minuto, sem publicar o site
 * de novo. Padrão seguro: sem decisão gravada, vale o que o código diz; "desligado" aqui desliga sempre. O recurso da entrada
 * ("alumia-entrada") não se mexe por aqui: ele anda junto com a trava (alumia_painel_trava).
 * Ligar um recurso que só liga pelo nome (so_pelo_nome: espera SQL, texto ou revisão) segue a regra da casa: abre um pedido que
 * OUTRA pessoa da coordenação confirma (Segurança › Confirmações), como em public.recurso_ajustar. Desligar é sempre na hora.
 * "Voltar ao padrão" de um recurso que só liga pelo nome e está DESLIGADO aqui é recusado ("use_ligar"): o padrão do código pode
 * ser ligado, e apagar o "desligado" seria ligar sem a segunda pessoa. Para esses, voltar ao padrão só tira um "ligado".
 */
create or replace function public.alumia_painel_recurso(p_nome text, p_ligar boolean, p_motivo text) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v_motivo text := interno.alumia_painel_motivo(p_motivo); v_antes boolean; v_pedido uuid;
begin
  perform interno.alumia_painel_exige();
  perform interno.limite('alumia_painel_recurso', 60, 60);
  if p_nome is null or not interno.alumia_painel_recurso_da_alumia(p_nome) or not exists (select 1 from recursos_catalogo where nome = p_nome) then perform interno.erro('invalido:nome'); end if;
  if p_nome = 'alumia-entrada' then perform interno.erro('use_a_trava'); end if;
  select ligado into v_antes from recursos_vivos where nome = p_nome;
  if p_ligar is null and v_antes is not distinct from false and (select k.so_pelo_nome from recursos_catalogo k where k.nome = p_nome) then
    perform interno.erro('use_ligar');
  end if;
  if p_ligar and (select k.so_pelo_nome from recursos_catalogo k where k.nome = p_nome) then
    v_pedido := interno.pedir_confirmacao('recurso', p_nome, v_motivo);
    perform interno.alumia_painel_registrar('recurso_pedido', 'recurso', p_nome, p_nome, v_motivo, jsonb_build_object('confirmacao', v_pedido));
    return jsonb_build_object('ok', true, 'aguardando', true, 'id', v_pedido);
  end if;
  if p_ligar is null then
    delete from recursos_vivos where nome = p_nome;
  else
    insert into recursos_vivos (nome, ligado, por) values (p_nome, p_ligar, auth.uid())
    on conflict (nome) do update set ligado = excluded.ligado, por = excluded.por, em = now();
  end if;
  perform interno.registrar(case when p_ligar is null then 'recurso_decisao_apagada' when p_ligar then 'recurso_ligado' else 'recurso_desligado' end, p_nome, jsonb_build_object('painel_da_alumia', true));
  perform interno.alumia_painel_registrar(case when p_ligar is null then 'recurso_padrao' when p_ligar then 'recurso_ligado' else 'recurso_desligado' end, 'recurso', p_nome, p_nome, v_motivo, jsonb_build_object('antes', v_antes));
  return jsonb_build_object('ok', true, 'decisao', p_ligar);
end $$;

/**
 * A trava da entrada e o recurso "alumia-entrada", juntos e no mesmo instante (docs/rede/ENTRADA.md, seção 2, passo 4).
 * Confirmação dupla: a frase escrita ("LIGAR A TRAVA" ou "DESLIGAR A TRAVA") e, para ligar, os cinco itens da lista de
 * conferência marcados. Para ligar, quem chama precisa estar com o segundo fator nesta sessão e aprovado na Alumia: assim não se
 * tranca do lado de fora. Se alguma função da rede ficou sem porta, o banco recusa ligar.
 * Desligar abre a rede inteira para conta sem aprovação: é só da coordenação, com o segundo fator nesta sessão. O admin liga a
 * trava, mas não a desliga (para uma emergência, ele desliga o Fediverso ou um recurso, que vale na hora).
 */
create or replace function public.alumia_painel_trava(p_ligar boolean, p_motivo text, p_frase text, p_conferencia jsonb default '[]'::jsonb) returns jsonb
language plpgsql security definer set search_path = interno, pg_temp as $$
declare v_motivo text := interno.alumia_painel_motivo(p_motivo); v_liga boolean := coalesce(p_ligar, false); v_r jsonb;
begin
  perform interno.alumia_painel_exige();
  perform interno.limite('alumia_painel_trava', 10, 60);
  if btrim(coalesce(p_frase, '')) is distinct from (case when v_liga then 'LIGAR A TRAVA' else 'DESLIGAR A TRAVA' end) then perform interno.erro('confirmacao_errada'); end if;
  if v_liga then
    if jsonb_typeof(p_conferencia) is distinct from 'array' or jsonb_array_length(p_conferencia) <> 5 or p_conferencia <> '[true, true, true, true, true]'::jsonb then
      perform interno.erro('conferencia_incompleta');
    end if;
    if not (interno.aal2() and interno.alumia_aprovada(auth.uid())) then perform interno.erro('confirme_segundo_fator'); end if;
  else
    perform interno.alumia_painel_exige(true);
    if not interno.aal2() then perform interno.erro('confirme_segundo_fator'); end if;
  end if;
  if v_liga = interno.alumia_exigida() then perform interno.erro('nada_a_fazer'); end if;
  v_r := interno.alumia_entrada_ligar(v_liga);
  insert into recursos_vivos (nome, ligado, por) values ('alumia-entrada', v_liga, auth.uid())
  on conflict (nome) do update set ligado = excluded.ligado, por = excluded.por, em = now();
  perform interno.registrar(case when v_liga then 'alumia_trava_ligada' else 'alumia_trava_desligada' end, 'alumia-entrada', '{}'::jsonb);
  perform interno.alumia_painel_registrar(case when v_liga then 'trava_ligada' else 'trava_desligada' end, 'trava', 'alumia-entrada', 'Trava da entrada', v_motivo,
    jsonb_build_object('aprovados_agora', v_r -> 'aprovados_agora', 'portas_trancadas', v_r -> 'portas' -> 'trancadas'));
  return v_r;
end $$;

/**
 * O Fediverso inteiro de uma vez (decisão de 12/11): "fediverso-total" e "fediverso-grupos" juntos, num botão só. Desligar para
 * tudo na hora (entrada, saída, grupos e a fila, que o código só roda com o recurso ligado) e não apaga nada: ligar de novo
 * volta de onde parou. Desligar: a coordenação ou o admin. Ligar: só a coordenação, com o segundo fator nesta sessão, sem
 * segunda pessoa (o coordenador decide sozinho, como pediu).
 */
create or replace function public.alumia_painel_fediverso(p_ligar boolean, p_motivo text) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v_motivo text := interno.alumia_painel_motivo(p_motivo); v_liga boolean := coalesce(p_ligar, false); v_nome text;
begin
  perform interno.alumia_painel_exige(v_liga);
  perform interno.limite('alumia_painel_recurso', 60, 60);
  if v_liga and not interno.aal2() then perform interno.erro('confirme_segundo_fator'); end if;
  foreach v_nome in array array['fediverso-total', 'fediverso-grupos'] loop
    if exists (select 1 from recursos_catalogo where nome = v_nome) then
      insert into recursos_vivos (nome, ligado, por) values (v_nome, v_liga, auth.uid())
      on conflict (nome) do update set ligado = excluded.ligado, por = excluded.por, em = now();
      -- Um pedido de segunda pessoa que estivesse esperando perde o sentido: a decisão já foi tomada.
      update confirmacoes set status = 'cancelada' where tipo = 'recurso' and alvo = v_nome and status = 'aguardando';
    end if;
  end loop;
  perform interno.registrar(case when v_liga then 'recurso_ligado' else 'recurso_desligado' end, 'fediverso', jsonb_build_object('painel_da_alumia', true, 'fediverso_inteiro', true));
  perform interno.alumia_painel_registrar(case when v_liga then 'fediverso_ligado' else 'fediverso_desligado' end, 'recurso', 'fediverso', 'Fediverso inteiro', v_motivo);
  return jsonb_build_object('ok', true, 'ligado', v_liga);
end $$;

-- 12. O registro ────────────────────────────────────────────────────────────────────────────────────────────────────────────

/**
 * Lê o registro do painel. p: acao (exata), busca (em quem, no alvo e no motivo), de, ate, pagina, tudo (true: até 5.000 linhas,
 * para exportar; a exportação também fica no registro).
 */
create or replace function public.alumia_painel_registro(p jsonb default '{}'::jsonb) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare
  v_acao text := nullif(btrim(coalesce(p ->> 'acao', '')), '');
  v_busca text := interno.alumia_painel_busca(p ->> 'busca');
  v_pagina integer := greatest(0, least(coalesce((p ->> 'pagina')::integer, 0), 5000));
  v_tudo boolean := coalesce((p ->> 'tudo')::boolean, false);
  v_limite integer; v_de timestamptz; v_ate timestamptz; v_itens jsonb;
begin
  perform interno.alumia_painel_exige();
  begin
    v_de := nullif(p ->> 'de', '')::date;
    v_ate := nullif(p ->> 'ate', '')::date + interval '1 day';
  exception when others then perform interno.erro('invalido:data');
  end;
  v_limite := case when v_tudo then 5000 else 100 end;
  if v_tudo then
    perform interno.limite('alumia_painel_exportar', 10, 60);
    perform interno.alumia_painel_registrar('registro_exportado', 'registro', '', '', '', jsonb_build_object('acao', v_acao, 'de', p ->> 'de', 'ate', p ->> 'ate'));
  end if;
  select coalesce(jsonb_agg(x.j order by x.id desc), '[]'::jsonb) into v_itens from (
    select r.id, jsonb_build_object('id', r.id, 'quando', r.criado_em, 'quem', r.quem_nome, 'papel', r.papel, 'acao', r.acao, 'alvo_tipo', r.alvo_tipo, 'alvo', r.alvo_nome,
      'referencia', r.alvo, 'motivo', r.motivo, 'detalhes', r.detalhes) as j
    from alumia_painel_registro r
    where (v_acao is null or r.acao = v_acao)
      and (v_busca = '' or r.quem_nome ilike '%' || v_busca || '%' or r.alvo_nome ilike '%' || v_busca || '%' or r.motivo ilike '%' || v_busca || '%')
      and (v_de is null or r.criado_em >= v_de) and (v_ate is null or r.criado_em < v_ate)
    order by r.id desc limit v_limite + 1 offset case when v_tudo then 0 else v_pagina * 100 end) x;
  return jsonb_build_object(
    'itens', case when jsonb_array_length(v_itens) > v_limite then v_itens - v_limite else v_itens end,
    'mais', jsonb_array_length(v_itens) > v_limite,
    'acoes', coalesce((select jsonb_agg(a.acao order by a.acao) from (select distinct acao from alumia_painel_registro) a), '[]'::jsonb));
end $$;

-- 13. Permissões ────────────────────────────────────────────────────────────────────────────────────────────────────────────

do $$
declare r record;
begin
  -- As de dentro: ninguém chama pela API.
  for r in
    select p.oid::regprocedure as f from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'interno' and p.proname like 'alumia\_painel\_%'
  loop
    execute format('revoke all on function %s from public', r.f);
    if exists (select 1 from pg_roles where rolname = 'anon') then execute format('revoke all on function %s from anon, authenticated', r.f); end if;
  end loop;
  -- As do painel: só conta logada (o papel é conferido dentro). A que recebe o resumo da rede: só a chave de serviço.
  for r in
    select p.oid::regprocedure as f, p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and (p.proname like 'alumia\_painel\_%' or p.proname in ('alumia_impressao_registrar', 'alumia_avisos_fixados'))
  loop
    execute format('revoke all on function %s from public', r.f);
    if exists (select 1 from pg_roles where rolname = 'anon') then
      execute format('revoke all on function %s from anon, authenticated', r.f);
      if r.proname = 'alumia_impressao_registrar' then
        execute format('grant execute on function %s to service_role', r.f);
      elsif r.proname = 'alumia_avisos_fixados' then
        execute format('grant execute on function %s to anon, authenticated, service_role', r.f);
      else
        execute format('grant execute on function %s to authenticated, service_role', r.f);
      end if;
    end if;
  end loop;
end $$;

-- As funções novas passam pela porta da entrada, como toda função da rede (20261112-alumia-portas.sql).
do $$
begin
  if to_regprocedure('interno.alumia_trancar()') is not null then perform interno.alumia_trancar(); end if;
end $$;
