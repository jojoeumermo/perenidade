-- Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
-- O cartão público do educador com aprovação (09/11/2026). No painel (Minha conta, Faixa de e-mail, "Visão pública"),
-- o voluntário pede a foto, a biografia e as redes do cartão que aparece no fim das aulas; a coordenação aprova ou
-- recusa com motivo. Só depois da aprovação o cartão muda. A foto vem já reduzida pelo navegador (WebP, até 150 KB),
-- fica no banco e sai para o site por /api/educador-foto/<id>, com cache; a lista de educadores leva só o endereço.

-- 1. A foto aprovada e os pedidos ─────────────────────────────────────────────────────────────────────────────────────────
alter table interno.perfis add column if not exists foto_publica text not null default '';
-- A bio e as redes APROVADAS do cartão ficam em colunas próprias: a bio do perfil (que a pessoa muda quando quiser, na
-- Alumia e em Minha conta) não vai mais para o cartão sem passar pela coordenação. Quem ainda não pediu cartão novo
-- continua com o que já estava no ar (a bio e as redes do perfil) até o primeiro pedido aprovado.
alter table interno.perfis add column if not exists cartao_bio text check (cartao_bio is null or char_length(cartao_bio) <= 500);
alter table interno.perfis add column if not exists cartao_curriculo jsonb check (cartao_curriculo is null or jsonb_typeof(cartao_curriculo) = 'object');
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'perfis_foto_publica_formato') then
    alter table interno.perfis add constraint perfis_foto_publica_formato
      check (foto_publica = '' or (foto_publica ~ '^data:image/webp;base64,[A-Za-z0-9+/=]+$' and char_length(foto_publica) <= 210000));
  end if;
end $$;

create table if not exists interno.cartao_publico_pedidos (
  id uuid primary key default gen_random_uuid(),
  usuario uuid not null references interno.perfis (id) on delete cascade,
  bio text not null default '' check (char_length(bio) <= 500),
  curriculo jsonb not null default '{}'::jsonb check (jsonb_typeof(curriculo) = 'object'),
  foto text not null default '' check (foto = '' or (foto ~ '^data:image/webp;base64,[A-Za-z0-9+/=]+$' and char_length(foto) <= 210000)),
  tirar_foto boolean not null default false,
  status text not null default 'pendente' check (status in ('pendente', 'aprovado', 'recusado', 'substituido')),
  nota text not null default '' check (char_length(nota) <= 1000),
  criado_em timestamptz not null default now(),
  decidido_por uuid references interno.perfis (id) on delete set null,
  decidido_em timestamptz
);
create index if not exists cartao_publico_pendentes on interno.cartao_publico_pedidos (criado_em) where status = 'pendente';
alter table interno.cartao_publico_pedidos enable row level security;
revoke all on interno.cartao_publico_pedidos from public;

-- 2. As redes, conferidas como em perfil_curriculo ────────────────────────────────────────────────────────────────────────
create or replace function interno.cartao_redes(p jsonb) returns jsonb language plpgsql immutable set search_path = interno, pg_temp as $$
declare k text; u text; v_novo jsonb := '{}'::jsonb;
begin
  if jsonb_typeof(coalesce(p, '{}'::jsonb)) <> 'object' then perform interno.erro('invalido:curriculo'); end if;
  foreach k in array array['portfolio', 'lattes', 'site', 'instagram', 'youtube', 'linkedin', 'github'] loop
    u := btrim(coalesce(p ->> k, ''));
    if u <> '' then
      if char_length(u) > 300 or u !~ '^https://[^\s]{3,}$' then perform interno.erro('invalido:' || k); end if;
      v_novo := v_novo || jsonb_build_object(k, u);
    end if;
  end loop;
  u := btrim(coalesce(p ->> 'formacao', ''));
  if u <> '' then v_novo := v_novo || jsonb_build_object('formacao', left(u, 160)); end if;
  return v_novo;
end $$;

-- 3. Pedir, ver o próprio, a fila e decidir ───────────────────────────────────────────────────────────────────────────────
/** O educador pede o cartão novo (foto opcional; "tirar_foto" volta ao cartão sem foto). O pedido anterior pendente é substituído. */
create or replace function public.cartao_publico_pedir(p jsonb) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); v_foto text := btrim(coalesce(p ->> 'foto', '')); v_id uuid;
begin
  if not exists (select 1 from papeis where usuario = v and papel in ('educacao', 'educacao_secundaria')) then perform interno.erro('sem_permissao'); end if;
  perform interno.limite('cartao_publico', 10, 1440);
  if v_foto <> '' and (v_foto !~ '^data:image/webp;base64,[A-Za-z0-9+/=]+$' or char_length(v_foto) > 210000) then perform interno.erro('invalido:foto'); end if;
  update cartao_publico_pedidos set status = 'substituido' where usuario = v and status = 'pendente';
  insert into cartao_publico_pedidos (usuario, bio, curriculo, foto, tirar_foto)
  values (v, interno.txt(p ->> 'bio', 'bio', 0, 500), interno.cartao_redes(p -> 'curriculo'), v_foto, coalesce((p ->> 'tirar_foto')::boolean, false))
  returning id into v_id;
  return jsonb_build_object('id', v_id);
end $$;

/** O cartão no ar e o último pedido da própria pessoa (com a nota da coordenação, se recusado). */
create or replace function public.cartao_publico_meu() returns jsonb language plpgsql stable security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); f perfis; c cartao_publico_pedidos;
begin
  select * into f from perfis where id = v;
  select * into c from cartao_publico_pedidos where usuario = v and status <> 'substituido' order by criado_em desc limit 1;
  return jsonb_build_object(
    'no_ar', jsonb_build_object('bio', coalesce(f.cartao_bio, f.bio, ''), 'curriculo', coalesce(f.cartao_curriculo, f.curriculo, '{}'::jsonb), 'foto', f.foto_publica),
    'pedido', case when c.id is null then null else jsonb_build_object('id', c.id, 'status', c.status, 'nota', c.nota, 'criado_em', c.criado_em,
      'bio', c.bio, 'curriculo', c.curriculo, 'foto', c.foto, 'tirar_foto', c.tirar_foto) end);
end $$;

/** A fila da coordenação: os pedidos pendentes, com o nome de quem pediu e o cartão que está no ar hoje. */
create or replace function public.cartao_publico_fila() returns jsonb language plpgsql stable security definer set search_path = interno, pg_temp as $$
begin
  perform interno.eu();
  if not interno.coord() then perform interno.erro('sem_permissao'); end if;
  return coalesce((select jsonb_agg(jsonb_build_object('id', c.id, 'nome', f.nome, 'criado_em', c.criado_em, 'bio', c.bio, 'curriculo', c.curriculo,
      'foto', c.foto, 'tirar_foto', c.tirar_foto, 'bio_atual', coalesce(f.cartao_bio, f.bio, ''), 'foto_atual', f.foto_publica) order by c.criado_em)
    from cartao_publico_pedidos c join perfis f on f.id = c.usuario where c.status = 'pendente'), '[]'::jsonb);
end $$;

/** Aprovar copia o pedido para o cartão no ar; recusar pede um motivo de pelo menos 5 letras. Quem pediu é avisado. */
create or replace function public.cartao_publico_decidir(p_id uuid, p_aprovar boolean, p_nota text default '') returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); c cartao_publico_pedidos; v_nota text := interno.txt(p_nota, 'nota', 0, 1000); v_aprovar boolean := coalesce(p_aprovar, false);
begin
  if not interno.coord() then perform interno.erro('sem_permissao'); end if;
  select * into c from cartao_publico_pedidos where id = p_id for update;
  if not found then perform interno.erro('nao_encontrado'); end if;
  if c.status <> 'pendente' then perform interno.erro('ja_decidida'); end if;
  if not v_aprovar and char_length(v_nota) < 5 then perform interno.erro('invalido:nota'); end if;
  update cartao_publico_pedidos set status = case when v_aprovar then 'aprovado' else 'recusado' end, nota = v_nota, decidido_por = v, decidido_em = now() where id = p_id;
  if v_aprovar then
    update perfis set cartao_bio = c.bio, cartao_curriculo = c.curriculo,
      foto_publica = case when c.tirar_foto then '' when c.foto <> '' then c.foto else foto_publica end
    where id = c.usuario;
  end if;
  perform interno.registrar(case when v_aprovar then 'cartao_publico_aprovado' else 'cartao_publico_recusado' end, c.usuario::text);
  perform interno.avisar(c.usuario, case when v_aprovar then 'Seu cartão de educador foi aprovado e já aparece no site.'
    else 'Seu cartão de educador não foi aprovado: ' || left(v_nota, 300) end);
  return jsonb_build_object('ok', true);
end $$;

/** A foto aprovada de um educador (só de quem ensina e não está suspenso), para a rota /api/educador-foto/<id>. */
create or replace function public.educador_foto(p_id uuid) returns text language sql stable security definer set search_path = interno, pg_temp as $$
  select nullif(f.foto_publica, '') from perfis f
  where f.id = p_id and not f.suspenso and exists (select 1 from papeis p where p.usuario = f.id and p.papel in ('educacao', 'educacao_secundaria'))
$$;

/** A lista de educadores, agora com o endereço da foto aprovada (a foto em si vai pela rota, com cache). */
create or replace function public.educadores() returns jsonb language sql stable security definer set search_path = interno, pg_temp as $$
  select coalesce(jsonb_agg(jsonb_build_object('id', f.id, 'nome', f.nome, 'bio', coalesce(f.cartao_bio, f.bio), 'avatar', f.avatar,
           'curriculo', coalesce(f.cartao_curriculo, f.curriculo, '{}'::jsonb),
           'foto', case when f.foto_publica <> '' then '/api/educador-foto/' || f.id::text || '?v=' || substr(md5(f.foto_publica), 1, 8) else '' end,
           'disciplinas', (select jsonb_agg(distinct p.disciplina) from papeis p where p.usuario = f.id and p.papel in ('educacao', 'educacao_secundaria') and p.disciplina is not null))
           order by f.nome), '[]'::jsonb)
  from perfis f
  where not f.suspenso and exists (select 1 from papeis p where p.usuario = f.id and p.papel in ('educacao', 'educacao_secundaria'))
$$;

-- 4. Permissões ──────────────────────────────────────────────────────────────────────────────────────────────────────────
revoke all on function interno.cartao_redes(jsonb) from public;
revoke all on function public.cartao_publico_pedir(jsonb), public.cartao_publico_meu(), public.cartao_publico_fila(),
  public.cartao_publico_decidir(uuid, boolean, text), public.educador_foto(uuid) from public;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    grant execute on function public.cartao_publico_pedir(jsonb), public.cartao_publico_meu(), public.cartao_publico_fila(),
      public.cartao_publico_decidir(uuid, boolean, text), public.educador_foto(uuid), public.educadores() to anon, authenticated, service_role;
  end if;
end $$;
