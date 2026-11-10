-- Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
-- Os parceiros nos seus territórios (09/11/2026). Os coletivos parceiros já têm o departamento de participação
-- "parcerias"; aqui cada pessoa parceira fica ligada ao território do seu coletivo (o slug de content/territorios.json),
-- e quem está ligado posta as novidades do território. As postagens aparecem na página do território e na seção
-- "Dos territórios" do Jornal. Vão ao ar na hora (a coordenação confiou o vínculo) e a coordenação, ou quem postou,
-- tira do ar com motivo; o filtro de palavras do site vale também aqui.

-- 1. Quem é parceiro de qual território ──────────────────────────────────────────────────────────────────────────────────
create table if not exists interno.territorio_parceiros (
  territorio text not null check (territorio ~ '^[a-z0-9-]{2,60}$'),
  usuario uuid not null references interno.perfis (id) on delete cascade,
  incluido_por uuid references interno.perfis (id) on delete set null,
  criado_em timestamptz not null default now(),
  primary key (territorio, usuario)
);
alter table interno.territorio_parceiros enable row level security;
revoke all on interno.territorio_parceiros from public;

-- 2. As postagens ────────────────────────────────────────────────────────────────────────────────────────────────────────
create table if not exists interno.territorio_posts (
  id uuid primary key default gen_random_uuid(),
  territorio text not null check (territorio ~ '^[a-z0-9-]{2,60}$'),
  autor uuid references interno.perfis (id) on delete set null,
  titulo text not null check (char_length(titulo) between 5 and 140),
  texto text not null check (char_length(texto) between 20 and 4000),
  link text not null default '' check (link = '' or (link ~ '^https://[^[:space:]]+$' and char_length(link) <= 500)),
  criado_em timestamptz not null default now(),
  oculto boolean not null default false,
  oculto_por uuid references interno.perfis (id) on delete set null,
  oculto_motivo text not null default '' check (char_length(oculto_motivo) <= 300)
);
create index if not exists territorio_posts_no_ar on interno.territorio_posts (territorio, criado_em desc) where not oculto;
alter table interno.territorio_posts enable row level security;
revoke all on interno.territorio_posts from public;

create or replace function interno.territorio_post_json(x interno.territorio_posts) returns jsonb language sql stable as $$
  select jsonb_build_object('id', x.id, 'territorio', x.territorio, 'titulo', x.titulo, 'texto', x.texto, 'link', x.link, 'criado_em', x.criado_em)
$$;

-- 3. Funções ─────────────────────────────────────────────────────────────────────────────────────────────────────────────
/** Ligar (ou desligar, com p_ligar false) uma pessoa a um território. Só a coordenação. Ligar põe a pessoa em Parcerias. */
create or replace function public.territorio_parceiro_definir(p_usuario uuid, p_territorio text, p_ligar boolean default true) returns jsonb
language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu();
begin
  if not interno.coord() then perform interno.erro('sem_permissao'); end if;
  if coalesce(p_territorio, '') !~ '^[a-z0-9-]{2,60}$' then perform interno.erro('invalido:territorio'); end if;
  if not exists (select 1 from perfis where id = p_usuario) then perform interno.erro('nao_encontrado'); end if;
  if coalesce(p_ligar, true) then
    insert into territorio_parceiros (territorio, usuario, incluido_por) values (p_territorio, p_usuario, v) on conflict do nothing;
    insert into departamento_membros (departamento, usuario, incluido_por) values ('parcerias', p_usuario, v) on conflict do nothing;
    perform interno.avisar(p_usuario, 'Você agora posta as novidades do seu território no site. Abra a página do território para escrever.');
  else
    delete from territorio_parceiros where territorio = p_territorio and usuario = p_usuario;
  end if;
  perform interno.registrar(case when coalesce(p_ligar, true) then 'territorio_parceiro_ligado' else 'territorio_parceiro_desligado' end, p_usuario::text, jsonb_build_object('territorio', p_territorio));
  return jsonb_build_object('ok', true);
end $$;

/** Os vínculos (coordenação): quem posta em cada território. */
create or replace function public.territorio_parceiros_listar() returns jsonb language plpgsql stable security definer set search_path = interno, pg_temp as $$
begin
  perform interno.eu();
  if not interno.coord() then perform interno.erro('sem_permissao'); end if;
  return coalesce((select jsonb_agg(jsonb_build_object('territorio', t.territorio, 'usuario', t.usuario, 'nome', f.nome, 'criado_em', t.criado_em) order by t.territorio, f.nome)
    from territorio_parceiros t join perfis f on f.id = t.usuario), '[]'::jsonb);
end $$;

/** Os territórios em que a própria pessoa posta (vazio para quem não é parceiro). */
create or replace function public.territorio_meus() returns jsonb language plpgsql stable security definer set search_path = interno, pg_temp as $$
declare v uuid := auth.uid();
begin
  if v is null then return '[]'::jsonb; end if;
  return coalesce((select jsonb_agg(territorio order by territorio) from territorio_parceiros where usuario = v), '[]'::jsonb);
end $$;

/** Postar uma novidade do território (só quem está ligado a ele). */
create or replace function public.territorio_postar(p jsonb) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); v_t text := coalesce(p ->> 'territorio', ''); v_titulo text; v_texto text; v_link text := btrim(coalesce(p ->> 'link', '')); v_id uuid;
begin
  if not exists (select 1 from territorio_parceiros where territorio = v_t and usuario = v) then perform interno.erro('sem_permissao'); end if;
  perform interno.limite('territorio_postar', 20, 1440);
  v_titulo := interno.txt(p ->> 'titulo', 'titulo', 5, 140);
  v_texto := interno.txt(p ->> 'texto', 'texto', 20, 4000);
  if v_link <> '' and (v_link !~ '^https://[^[:space:]]+$' or char_length(v_link) > 500) then perform interno.erro('invalido:link'); end if;
  if interno.vetado(v_titulo || ' ' || v_texto) then perform interno.erro('conteudo_recusado'); end if;
  insert into territorio_posts (territorio, autor, titulo, texto, link) values (v_t, v, v_titulo, v_texto, v_link) returning id into v_id;
  return jsonb_build_object('id', v_id);
end $$;

/** Tirar uma postagem do ar: a coordenação ou quem postou. */
create or replace function public.territorio_post_ocultar(p_id uuid, p_motivo text default '') returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); x territorio_posts;
begin
  select * into x from territorio_posts where id = p_id for update;
  if not found then perform interno.erro('nao_encontrado'); end if;
  if not (interno.coord() or x.autor = v) then perform interno.erro('sem_permissao'); end if;
  update territorio_posts set oculto = true, oculto_por = v, oculto_motivo = interno.txt(p_motivo, 'motivo', 0, 300) where id = p_id;
  perform interno.registrar('territorio_post_oculto', x.territorio, jsonb_build_object('post', p_id));
  return jsonb_build_object('ok', true);
end $$;

/** As postagens de um território (público). Quem é parceiro dele vê também o botão de tirar do ar (campo "minha"). */
create or replace function public.territorio_posts(p_territorio text, p_limite integer default 20) returns jsonb language sql stable security definer set search_path = interno, pg_temp as $$
  select coalesce(jsonb_agg(interno.territorio_post_json(x) || jsonb_build_object('minha', x.autor is not null and x.autor = auth.uid()) order by x.criado_em desc), '[]'::jsonb)
  from (select * from territorio_posts where territorio = p_territorio and not oculto order by criado_em desc limit least(greatest(coalesce(p_limite, 20), 1), 50)) x
$$;

/** As últimas postagens de todos os territórios, para a seção "Dos territórios" do Jornal (público). */
create or replace function public.territorio_posts_recentes(p_limite integer default 6) returns jsonb language sql stable security definer set search_path = interno, pg_temp as $$
  select coalesce(jsonb_agg(interno.territorio_post_json(x) order by x.criado_em desc), '[]'::jsonb)
  from (select * from territorio_posts where not oculto order by criado_em desc limit least(greatest(coalesce(p_limite, 6), 1), 24)) x
$$;

-- 4. Permissões ──────────────────────────────────────────────────────────────────────────────────────────────────────────
revoke all on function interno.territorio_post_json(interno.territorio_posts) from public;
revoke all on function public.territorio_parceiro_definir(uuid, text, boolean), public.territorio_parceiros_listar(), public.territorio_meus(),
  public.territorio_postar(jsonb), public.territorio_post_ocultar(uuid, text), public.territorio_posts(text, integer), public.territorio_posts_recentes(integer) from public;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    grant execute on function public.territorio_parceiro_definir(uuid, text, boolean), public.territorio_parceiros_listar(), public.territorio_meus(),
      public.territorio_postar(jsonb), public.territorio_post_ocultar(uuid, text), public.territorio_posts(text, integer), public.territorio_posts_recentes(integer)
      to anon, authenticated, service_role;
  end if;
end $$;
