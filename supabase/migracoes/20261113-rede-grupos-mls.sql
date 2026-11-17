-- Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
--
-- Grupos cifrados da Alumia em MLS (RFC 9420), pela biblioteca ts-mls, com a suíte híbrida contra computador quântico
-- MLS_256_XWING_AES256GCM_SHA512_Ed25519 (X25519 + ML-KEM-768). Substitui a cifra de grupo feita à mão de
-- 20261112-rede-grupos-cifrados.sql, que nunca rodou em produção e saiu do install.sql. Documento: docs/rede/POSTS-RESTRITOS.md.
--
-- O banco guarda só o que é público ou cifrado:
--   - os "pacotes de chave" (KeyPackage) de cada pessoa: a parte pública que permite pôr alguém no grupo (cada um serve uma vez);
--   - o registro dos "commits" do grupo, em ordem (cada um leva o grupo à época seguinte), e a GroupInfo mais nova (com a chave
--     pública externa e a árvore), que deixa um membro novo entrar sozinho;
--   - as boas-vindas (Welcome) cifradas para quem foi posto no grupo.
-- O banco decide QUEM é do grupo (os membros do núcleo ou da comunidade, como sempre). Ele não consegue ler nada, nem entrar no
-- grupo com uma chave falsa sem o aparelho dos membros notar (cada aparelho guarda a chave de assinatura de cada pessoa na
-- primeira vez e recusa se mudar sem aviso).
--
-- Grupos: "nucleo:<uuid>" e "comunidade:<slug>". Pode rodar de novo.

-- ── 1. Quem é do grupo (as mesmas regras de antes) ──────────────────────────────────────────────────────────────────────────

create or replace function interno.rede_grupo_membro(p_grupo text, p_usuario uuid) returns boolean language plpgsql stable security definer set search_path = interno, pg_temp as $$
begin
  if p_usuario is null or not interno.rede2_membro(p_usuario) then return false; end if;
  if p_grupo ~ '^nucleo:[0-9a-f-]{36}$' then return interno.rede2_no_nucleo(substr(p_grupo, 8)::uuid, p_usuario); end if;
  if p_grupo ~ '^comunidade:[a-z0-9-]{2,60}$' then return interno.rede2_na_comunidade(substr(p_grupo, 12), p_usuario); end if;
  return false;
end $$;

create or replace function interno.rede_grupo_membros(p_grupo text) returns setof uuid language sql stable security definer set search_path = interno, pg_temp as $$
  select m.usuario from rede_nucleo_membros m where p_grupo ~ '^nucleo:[0-9a-f-]{36}$' and m.nucleo = substr(p_grupo, 8)::uuid and interno.rede2_membro(m.usuario)
  union
  select m.usuario from rede_comunidade_membros m where p_grupo ~ '^comunidade:[a-z0-9-]{2,60}$' and m.comunidade = substr(p_grupo, 12)
    and m.situacao = 'ativo' and (m.banido_ate is null or m.banido_ate < now()) and interno.rede2_membro(m.usuario)
$$;

-- ── 2. Tabelas ───────────────────────────────────────────────────────────────────────────────────────────────────────────────

-- Pacotes de chave (base64 do MLSMessage "mls_key_package"). Cada um serve uma vez; até 20 por pessoa.
create table if not exists interno.rede_mls_pacotes (
  id bigint generated always as identity primary key,
  usuario uuid not null references interno.perfis (id) on delete cascade,
  pacote text not null check (pacote ~ '^[A-Za-z0-9+/]+={0,2}$' and char_length(pacote) <= 6000),
  criado_em timestamptz not null default now()
);
create index if not exists rede_mls_pacotes_usuario on interno.rede_mls_pacotes (usuario, id);

-- O registro dos commits de cada grupo, em ordem. `epoca` é a época a que o commit leva o grupo (o primeiro, 1).
create table if not exists interno.rede_mls_commits (
  grupo text not null check (grupo ~ '^(nucleo:[0-9a-f-]{36}|comunidade:[a-z0-9-]{2,60})$'),
  epoca integer not null check (epoca > 0),
  autor uuid not null references interno.perfis (id) on delete cascade,
  commit text not null check (commit ~ '^[A-Za-z0-9+/]+={0,2}$' and char_length(commit) <= 200000),
  criado_em timestamptz not null default now(),
  primary key (grupo, epoca)
);

-- A GroupInfo mais nova de cada grupo (com a chave pública externa e a árvore): quem é membro e ainda não está no grupo entra
-- sozinho com ela (commit externo).
create table if not exists interno.rede_mls_info (
  grupo text primary key check (grupo ~ '^(nucleo:[0-9a-f-]{36}|comunidade:[a-z0-9-]{2,60})$'),
  epoca integer not null check (epoca > 0),
  info text not null check (info ~ '^[A-Za-z0-9+/]+={0,2}$' and char_length(info) <= 400000)
);

-- Boas-vindas (Welcome) para quem foi posto no grupo. Só a pessoa lê; some em 30 dias.
create table if not exists interno.rede_mls_boasvindas (
  grupo text not null,
  epoca integer not null check (epoca > 0),
  para uuid not null references interno.perfis (id) on delete cascade,
  welcome text not null check (welcome ~ '^[A-Za-z0-9+/]+={0,2}$' and char_length(welcome) <= 400000),
  criado_em timestamptz not null default now(),
  primary key (grupo, epoca, para)
);

alter table interno.rede_mls_pacotes enable row level security;
alter table interno.rede_mls_commits enable row level security;
alter table interno.rede_mls_info enable row level security;
alter table interno.rede_mls_boasvindas enable row level security;
revoke all on interno.rede_mls_pacotes, interno.rede_mls_commits, interno.rede_mls_info, interno.rede_mls_boasvindas from public;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on interno.rede_mls_pacotes, interno.rede_mls_commits, interno.rede_mls_info, interno.rede_mls_boasvindas from anon, authenticated;
  end if;
end $$;

-- ── 3. O que o aparelho chama ────────────────────────────────────────────────────────────────────────────────────────────────

/** Publica pacotes de chave desta pessoa (até 20 guardados; os que passarem são ignorados). Devolve quantos há. */
create or replace function public.rede_mls_pacotes_publicar(p_pacotes text[]) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); x text; n integer;
begin
  perform interno.aberta('comunidade');
  if not interno.rede2_membro(v) then perform interno.erro('consentimento'); end if;
  perform interno.limite('rede_mls_pacotes', 30, 60);
  if coalesce(array_length(p_pacotes, 1), 0) > 20 then perform interno.erro('invalido:pacotes'); end if;
  foreach x in array coalesce(p_pacotes, '{}') loop
    if x !~ '^[A-Za-z0-9+/]+={0,2}$' or char_length(x) > 6000 then perform interno.erro('invalido:pacote'); end if;
    if (select count(*) from rede_mls_pacotes where usuario = v) >= 20 then exit; end if;
    insert into rede_mls_pacotes (usuario, pacote) values (v, x);
  end loop;
  select count(*) into n from rede_mls_pacotes where usuario = v;
  return jsonb_build_object('pacotes', n);
end $$;

/** Quantos pacotes meus ainda estão guardados (o aparelho repõe quando fica pouco). */
create or replace function public.rede_mls_meus_pacotes() returns jsonb language plpgsql stable security definer set search_path = interno, pg_temp as $$
begin
  perform interno.aberta('comunidade');
  return jsonb_build_object('pacotes', (select count(*) from rede_mls_pacotes where usuario = interno.eu()));
end $$;

/**
 * O estado do grupo para quem é membro: a época atual, os membros (só ids), os commits depois de `p_desde`, a GroupInfo mais nova
 * e as boas-vindas feitas para mim (a mais nova). Quem não é membro recebe "nao_encontrado".
 */
create or replace function public.rede_mls_estado(p_grupo text, p_desde integer default 0) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu();
begin
  perform interno.aberta('comunidade');
  if not interno.rede_grupo_membro(p_grupo, v) then perform interno.erro('nao_encontrado'); end if;
  perform interno.limite('rede_grupo_ler', 600, 60);
  delete from rede_mls_boasvindas where criado_em < now() - interval '30 days';
  return jsonb_build_object(
    'epoca', (select max(epoca) from rede_mls_commits where grupo = p_grupo),
    'membros', coalesce((select jsonb_agg(u order by u) from interno.rede_grupo_membros(p_grupo) u), '[]'::jsonb),
    'commits', coalesce((select jsonb_agg(jsonb_build_object('epoca', c.epoca, 'commit', c.commit) order by c.epoca)
      from (select * from rede_mls_commits where grupo = p_grupo and epoca > coalesce(p_desde, 0) order by epoca limit 200) c), '[]'::jsonb),
    'info', (select jsonb_build_object('epoca', i.epoca, 'info', i.info) from rede_mls_info i where i.grupo = p_grupo),
    'boasvindas', (select jsonb_build_object('epoca', b.epoca, 'welcome', b.welcome) from rede_mls_boasvindas b
      where b.grupo = p_grupo and b.para = v order by b.epoca desc limit 1));
end $$;

/** Pega um pacote de chave de cada pessoa pedida que é membro do grupo (o pacote sai do banco). */
create or replace function public.rede_mls_pacotes_pegar(p_grupo text, p_usuarios uuid[]) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); u uuid; saida jsonb := '{}'::jsonb; p rede_mls_pacotes;
begin
  perform interno.aberta('comunidade');
  if not interno.rede_grupo_membro(p_grupo, v) then perform interno.erro('nao_encontrado'); end if;
  if coalesce(array_length(p_usuarios, 1), 0) > 200 then perform interno.erro('invalido:pedido'); end if;
  perform interno.limite('rede_mls_pegar', 120, 60);
  foreach u in array coalesce(p_usuarios, '{}') loop
    if u = v or not interno.rede_grupo_membro(p_grupo, u) then continue; end if;
    delete from rede_mls_pacotes where id = (select id from rede_mls_pacotes where usuario = u order by id limit 1 for update skip locked) returning * into p;
    if p.id is not null then saida := saida || jsonb_build_object(u::text, p.pacote); end if;
    p := null;
  end loop;
  return saida;
end $$;

/**
 * Grava o commit que leva o grupo à época `p_epoca` (tem de ser a atual + 1: duas pessoas ao mesmo tempo, a segunda recebe
 * "versao_ocupada", lê o commit da primeira e tenta de novo), a GroupInfo nova e as boas-vindas ([{para, welcome}], só para
 * membros). Quem grava precisa ser membro do grupo.
 */
create or replace function public.rede_mls_commit(p_grupo text, p_epoca integer, p_commit text, p_info text, p_boasvindas jsonb default '[]'::jsonb) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); v_atual integer; b jsonb; v_para uuid;
begin
  perform interno.aberta('comunidade');
  if not interno.rede_grupo_membro(p_grupo, v) then perform interno.erro('nao_encontrado'); end if;
  perform interno.limite('rede_mls_commit', 60, 60);
  -- Um commit por vez em cada grupo.
  perform pg_advisory_xact_lock(hashtext('rede_mls:' || p_grupo));
  select max(epoca) into v_atual from rede_mls_commits where grupo = p_grupo;
  if p_epoca is distinct from coalesce(v_atual, 0) + 1 then perform interno.erro('versao_ocupada'); end if;
  if coalesce(p_commit, '') !~ '^[A-Za-z0-9+/]+={0,2}$' or char_length(p_commit) > 200000 then perform interno.erro('invalido:commit'); end if;
  if coalesce(p_info, '') !~ '^[A-Za-z0-9+/]+={0,2}$' or char_length(p_info) > 400000 then perform interno.erro('invalido:info'); end if;
  if jsonb_typeof(coalesce(p_boasvindas, '[]'::jsonb)) <> 'array' or jsonb_array_length(coalesce(p_boasvindas, '[]'::jsonb)) > 200 then perform interno.erro('invalido:boasvindas'); end if;
  insert into rede_mls_commits (grupo, epoca, autor, commit) values (p_grupo, p_epoca, v, p_commit);
  insert into rede_mls_info (grupo, epoca, info) values (p_grupo, p_epoca, p_info)
  on conflict (grupo) do update set epoca = excluded.epoca, info = excluded.info;
  for b in select * from jsonb_array_elements(coalesce(p_boasvindas, '[]'::jsonb)) loop
    begin v_para := (b ->> 'para')::uuid; exception when others then perform interno.erro('invalido:boasvindas'); end;
    if not interno.rede_grupo_membro(p_grupo, v_para) then continue; end if;
    if coalesce(b ->> 'welcome', '') !~ '^[A-Za-z0-9+/]+={0,2}$' or char_length(b ->> 'welcome') > 400000 then perform interno.erro('invalido:boasvindas'); end if;
    insert into rede_mls_boasvindas (grupo, epoca, para, welcome) values (p_grupo, p_epoca, v_para, b ->> 'welcome') on conflict do nothing;
  end loop;
  -- O registro guarda 90 dias; quem ficou mais para trás entra de novo sozinho pela GroupInfo.
  delete from rede_mls_commits where grupo = p_grupo and criado_em < now() - interval '90 days' and epoca < p_epoca;
  return jsonb_build_object('epoca', p_epoca);
end $$;

-- ── 4. Permissões ───────────────────────────────────────────────────────────────────────────────────────────────────────────

revoke all on function interno.rede_grupo_membro(text, uuid), interno.rede_grupo_membros(text) from public;
do $$
declare f record;
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on function interno.rede_grupo_membro(text, uuid), interno.rede_grupo_membros(text) from anon, authenticated;
  end if;
  for f in select p.oid::regprocedure as assinatura from pg_proc p join pg_namespace n on n.oid = p.pronamespace
           where n.nspname = 'public' and p.proname in ('rede_mls_pacotes_publicar', 'rede_mls_meus_pacotes', 'rede_mls_estado', 'rede_mls_pacotes_pegar', 'rede_mls_commit') loop
    execute format('revoke all on function %s from public', f.assinatura);
    if exists (select 1 from pg_roles where rolname = 'anon') then
      execute format('revoke all on function %s from anon', f.assinatura);
      execute format('grant execute on function %s to authenticated', f.assinatura);
    end if;
  end loop;
end $$;
