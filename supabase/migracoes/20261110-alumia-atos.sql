-- Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
--
-- ═══════════════════════════ Alumia · Onda A · atos: Farol do ato e Corrente de solidariedade (10/11/2026) ═══════════════════════════
-- docs/plano-2026-11/ALUMIA-FUNCOES-E-IDEIAS.md §2.1 (ideias 1 e 7) e PLANO-ALUMIA §6. Vem DEPOIS da F2
-- (20261109-alumia-f2.sql) e da F4 (20261109-alumia-f4.sql: rede_orgs, rede_org_gestores, rede_age_como). Idempotente: o teste
-- (scripts/testar-alumia-atos-banco.mjs) roda duas vezes no banco local. NÃO rodar em produção sem o Jonathan.
--
-- 1. FAROL DO ATO. Quem coordena o ato (quem age como quem chamou: a própria conta, uma identidade dela ou os gestores da
--    organização) acende um de quatro estados: tranquilo, atencao, dispersar, ponto2 (com o texto do novo ponto). A mudança só
--    vale quando DUAS pessoas diferentes da coordenação pedem o mesmo estado em até 15 minutos (a segunda confirma). Quem confirmou
--    presença recebe um aviso SEM o estado no texto ("o farol mudou"); a tela busca o estado. O registro da moderação guarda cada
--    mudança (interno.registrar), contra uso indevido. Quem recebeu não fica registrado.
-- 2. CORRENTE DE SOLIDARIEDADE. Uma organização com selo abre "precisamos de N pessoas às 5h na ocupação X" para uma CIDADE
--    ESCRITA (nunca posição). As pessoas respondem "vou"; a barra de elos fecha em passos de 10 %, só a partir de 3 respostas.
--    Quando a meta é atingida, a corrente fecha e para de aparecer. Limite: 2 correntes por organização por semana.
--
-- Privacidade (LGPD, Lei 13.709/2018: art. 5º, II e art. 11 — ir a um ato revela opinião política, dado sensível; art. 6º, III —
-- necessidade): nenhuma função devolve quem confirmou, quem respondeu "vou" ou quem pediu o farol; a corrente mostra só a
-- proporção (nula abaixo de 3) e o total exato só a quem age como a organização que abriu; o vínculo pessoa↔organização nunca
-- volta para ninguém. ECA (Lei 8.069/1990) e ECA Digital (Lei 15.211/2025): tudo exige membro 18+ (interno.rede2_membro).

-- ── 1. Tabelas ──────────────────────────────────────────────────────────────────────────────────────────────────────────────
create table if not exists interno.rede_ato_farol (
  post uuid primary key references interno.rede_posts (id) on delete cascade,
  estado text not null default 'tranquilo' check (estado in ('tranquilo', 'atencao', 'dispersar', 'ponto2')),
  texto text not null default '' check (char_length(texto) <= 140),
  mudado_em timestamptz not null default now()
);
-- Um pedido esperando a segunda pessoa por ato. Guarda quem pediu SÓ para impedir que a mesma pessoa confirme o próprio pedido;
-- nenhuma função devolve esse campo (só "o pedido é seu?").
create table if not exists interno.rede_ato_farol_pedidos (
  post uuid primary key references interno.rede_posts (id) on delete cascade,
  estado text not null check (estado in ('tranquilo', 'atencao', 'dispersar', 'ponto2')),
  texto text not null default '' check (char_length(texto) <= 140),
  pedido_por uuid not null references interno.perfis (id) on delete cascade,
  pedido_em timestamptz not null default now()
);
create table if not exists interno.rede_correntes (
  id uuid primary key default gen_random_uuid(),
  autor uuid not null references interno.perfis (id) on delete cascade,
  texto text not null check (char_length(texto) between 10 and 140),
  cidade text not null check (char_length(cidade) between 2 and 80),
  meta smallint not null check (meta between 3 and 5000),
  quando timestamptz,
  criada_em timestamptz not null default now(),
  expira_em timestamptz not null,
  fechada_em timestamptz
);
create index if not exists rede_correntes_cidade on interno.rede_correntes (interno.rede_ato_cidade(cidade), expira_em);
create index if not exists rede_correntes_autor on interno.rede_correntes (autor, criada_em);
create table if not exists interno.rede_corrente_vou (
  corrente uuid not null references interno.rede_correntes (id) on delete cascade,
  usuario uuid not null references interno.perfis (id) on delete cascade,
  primary key (corrente, usuario)
);
create index if not exists rede_corrente_vou_usuario on interno.rede_corrente_vou (usuario);
alter table interno.rede_ato_farol enable row level security;
alter table interno.rede_ato_farol_pedidos enable row level security;
alter table interno.rede_correntes enable row level security;
alter table interno.rede_corrente_vou enable row level security;
revoke all on table interno.rede_ato_farol, interno.rede_ato_farol_pedidos, interno.rede_correntes, interno.rede_corrente_vou from public;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on table interno.rede_ato_farol, interno.rede_ato_farol_pedidos, interno.rede_correntes, interno.rede_corrente_vou from anon, authenticated;
  end if;
end $$;

-- ── 2. Farol ────────────────────────────────────────────────────────────────────────────────────────────────────────────────

/** O farol como a tela recebe (FarolDoAto em lib/rede/tipos-atos.ts). `coordena` diz se quem lê pode pedir mudança. */
create or replace function interno.rede_ato_farol_json(p_id uuid, p_quem uuid, p_coordena boolean) returns jsonb
language plpgsql stable security definer set search_path = interno, pg_temp as $$
declare f rede_ato_farol; q rede_ato_farol_pedidos;
begin
  select * into f from rede_ato_farol where post = p_id;
  if p_coordena then
    select * into q from rede_ato_farol_pedidos where post = p_id and pedido_em > now() - interval '15 minutes';
  end if;
  return jsonb_build_object(
    'estado', coalesce(f.estado, 'tranquilo'),
    'texto', coalesce(f.texto, ''),
    'mudado_em', f.mudado_em,
    'coordena', p_coordena,
    'pendente', case when q.post is null then null else jsonb_build_object('estado', q.estado, 'texto', q.texto,
      'meu', q.pedido_por = p_quem, 'expira_em', q.pedido_em + interval '15 minutes') end);
end $$;

/**
 * O farol de um ato. Só para quem confirmou presença ou coordena (os outros recebem nulo: o farol é para quem está indo).
 * Visitante: nulo.
 */
create or replace function public.rede_ato_farol(p_id uuid) returns jsonb language plpgsql stable security definer set search_path = interno, pg_temp as $$
declare v uuid := auth.uid(); p rede_posts; v_coord boolean;
begin
  perform interno.aberta('comunidade');
  if v is null or not interno.rede2_membro(v) then return null; end if;
  p := interno.rede_ato_achar(p_id, v);
  v_coord := interno.rede_age_como(v, p.autor);
  if not v_coord and not exists (select 1 from rede_vou o where o.post = p_id and o.usuario = v) then return null; end if;
  return interno.rede_ato_farol_json(p_id, v, v_coord);
end $$;

/**
 * Pedir (ou confirmar) um estado do farol. Só quem coordena. Se já existe um pedido de OUTRA pessoa com o mesmo estado e texto,
 * nos últimos 15 minutos, esta chamada é a confirmação: o farol muda, o pedido some, quem confirmou presença recebe o aviso sem o
 * estado no texto e a mudança vai ao registro. Senão, este passa a ser o pedido esperando a segunda pessoa (os outros gestores da
 * organização recebem "confirme no ato", sem o nome de quem pediu). A mesma pessoa repetir o próprio pedido não confirma nada.
 */
create or replace function public.rede_ato_farol_pedir(p_id uuid, p_estado text, p_texto text default '') returns jsonb
language plpgsql security definer set search_path = interno, pg_temp as $$
declare
  v uuid := interno.eu(); p rede_posts; c rede_chamados; q rede_ato_farol_pedidos; g record;
  v_texto text := regexp_replace(btrim(coalesce(p_texto, '')), '\s+', ' ', 'g');
begin
  perform interno.aberta('comunidade');
  if not interno.rede2_membro(v) then perform interno.erro('consentimento'); end if;
  p := interno.rede_ato_achar(p_id, v);
  if not interno.rede_age_como(v, p.autor) then perform interno.erro('so_coordenacao'); end if;
  if p_estado is null or p_estado not in ('tranquilo', 'atencao', 'dispersar', 'ponto2') then perform interno.erro('invalido:estado'); end if;
  if p_estado <> 'ponto2' then v_texto := ''; end if;
  if p_estado = 'ponto2' and char_length(v_texto) < 3 then perform interno.erro('invalido:texto'); end if;
  if char_length(v_texto) > 140 then perform interno.erro('invalido:texto'); end if;
  if interno.rede3_pub_dado_pessoal(v_texto) then perform interno.erro('dado_pessoal'); end if;
  select * into c from rede_chamados where post = p_id;
  if c.situacao = 'cancelado' then perform interno.erro('ato_cancelado'); end if;
  perform interno.limite('alumia_ato_farol', 20, 60);

  select * into q from rede_ato_farol_pedidos where post = p_id for update;
  if q.post is not null and q.pedido_em > now() - interval '15 minutes' and q.pedido_por <> v
     and q.estado = p_estado and q.texto = v_texto then
    -- A segunda pessoa confirmou: vale.
    insert into rede_ato_farol (post, estado, texto, mudado_em) values (p_id, p_estado, v_texto, now())
    on conflict (post) do update set estado = excluded.estado, texto = excluded.texto, mudado_em = excluded.mudado_em;
    delete from rede_ato_farol_pedidos where post = p_id;
    perform interno.registrar('alumia_ato_farol', p_id::text, jsonb_build_object('estado', p_estado, 'texto', v_texto));
    for g in select o.usuario from rede_vou o where o.post = p_id and o.usuario <> v loop
      if interno.rede2_membro(g.usuario) and interno.rede_ve(p, g.usuario) and not interno.rede_age_como(g.usuario, p.autor) then
        perform interno.rede3_aviso_criar(g.usuario, 'chamado', p_id, null, null, 'O farol de um ato que você confirmou mudou. Abra o ato.');
      end if;
    end loop;
  else
    insert into rede_ato_farol_pedidos (post, estado, texto, pedido_por, pedido_em) values (p_id, p_estado, v_texto, v, now())
    on conflict (post) do update set estado = excluded.estado, texto = excluded.texto, pedido_por = excluded.pedido_por, pedido_em = excluded.pedido_em;
    for g in select gs.gestor from rede_org_gestores gs where gs.org = p.autor and gs.gestor <> v loop
      perform interno.avisar_em(g.gestor, 'Alguém da coordenação pediu para mudar o farol de um ato. Abra o ato para confirmar.', 'rede');
    end loop;
  end if;
  return interno.rede_ato_farol_json(p_id, v, true);
end $$;

-- ── 3. Corrente de solidariedade ────────────────────────────────────────────────────────────────────────────────────────────

/** Elos fechados: a MESMA regra do mosaico (nula abaixo de 3; passos de 10 %, para baixo; 100 % quando bate a meta). */
create or replace function interno.rede_corrente_elos(p_n bigint, p_meta integer) returns numeric language sql immutable set search_path = interno, pg_temp as $$
  select case when p_n is null or p_n < 3 then null
    else round(least(10, greatest(1, floor(p_n::numeric * 10 / greatest(3, coalesce(p_meta, 3)))))::numeric / 10, 1) end
$$;

create or replace function interno.rede_corrente_json(k interno.rede_correntes, p_quem uuid) returns jsonb
language plpgsql stable security definer set search_path = interno, pg_temp as $$
declare f perfis; v_n bigint := (select count(*) from rede_corrente_vou o where o.corrente = k.id);
begin
  select * into f from perfis where id = k.autor;
  return jsonb_build_object(
    'id', k.id, 'texto', k.texto, 'cidade', k.cidade, 'meta', k.meta, 'quando', k.quando, 'expira_em', k.expira_em,
    'org', jsonb_build_object('handle', f.rede_handle, 'nome', interno.rede_nome(k.autor)),
    'elos', interno.rede_corrente_elos(v_n, k.meta),
    'fechada', k.fechada_em is not null,
    'vou_eu', p_quem is not null and exists (select 1 from rede_corrente_vou o where o.corrente = k.id and o.usuario = p_quem),
    'total', case when p_quem is not null and interno.rede_age_como(p_quem, k.autor) then v_n end);
end $$;

/** As organizações COM SELO que esta pessoa gerencia (para o "Abrir corrente"). Só sobre si mesma. */
create or replace function public.rede_corrente_posso() returns jsonb language plpgsql stable security definer set search_path = interno, pg_temp as $$
declare v uuid := auth.uid();
begin
  if v is null or not interno.rede2_membro(v) then return '[]'::jsonb; end if;
  return coalesce((select jsonb_agg(jsonb_build_object('id', o.perfil, 'handle', f.rede_handle, 'nome', interno.rede_nome(o.perfil)) order by f.rede_handle)
    from rede_orgs o join perfis f on f.id = o.perfil
   where o.verificada_em is not null and interno.rede_age_como(v, o.perfil)), '[]'::jsonb);
end $$;

/**
 * Abrir uma corrente (como uma organização com selo que a pessoa gerencia). p: org (uuid), texto (10–140), cidade (2–80), meta
 * (3–5000), quando (ISO, opcional, até 30 dias). Some sozinha 6 h depois de `quando` (ou em 3 dias sem hora). 2 por semana.
 */
create or replace function public.rede_corrente_abrir(p jsonb) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare
  v uuid := interno.eu(); k rede_correntes;
  v_org uuid; v_texto text; v_cidade text; v_meta integer; v_quando timestamptz;
begin
  perform interno.aberta('comunidade');
  if not interno.rede2_membro(v) then perform interno.erro('consentimento'); end if;
  begin
    v_org := (p ->> 'org')::uuid;
  exception when others then
    perform interno.erro('invalido:org');
  end;
  if v_org is null or not exists (select 1 from rede_orgs o where o.perfil = v_org and o.verificada_em is not null)
     or not interno.rede_age_como(v, v_org) then perform interno.erro('so_org_verificada'); end if;
  v_texto := interno.txt(regexp_replace(coalesce(p ->> 'texto', ''), '\s+', ' ', 'g'), 'texto', 10, 140);
  v_cidade := interno.txt(regexp_replace(coalesce(p ->> 'cidade', ''), '\s+', ' ', 'g'), 'cidade', 2, 80);
  if interno.rede3_pub_dado_pessoal(v_texto) then perform interno.erro('dado_pessoal'); end if;
  begin
    v_meta := (p ->> 'meta')::integer;
  exception when others then
    perform interno.erro('invalido:meta');
  end;
  if v_meta is null or v_meta < 3 or v_meta > 5000 then perform interno.erro('invalido:meta'); end if;
  if coalesce(p ->> 'quando', '') <> '' then
    begin
      v_quando := (p ->> 'quando')::timestamptz;
    exception when others then
      perform interno.erro('invalido:quando');
    end;
    if v_quando <= now() or v_quando > now() + interval '30 days' then perform interno.erro('invalido:quando'); end if;
  end if;
  if (select count(*) from rede_correntes where autor = v_org and criada_em > now() - interval '7 days') >= 2 then
    perform interno.erro('muitos_pedidos');
  end if;
  perform interno.limite('alumia_corrente', 6, 60);
  insert into rede_correntes (autor, texto, cidade, meta, quando, expira_em)
  values (v_org, v_texto, v_cidade, v_meta, v_quando, coalesce(v_quando + interval '6 hours', now() + interval '3 days'))
  returning * into k;
  perform interno.registrar('alumia_corrente_abrir', k.id::text, jsonb_build_object('org', v_org, 'cidade', v_cidade));
  return interno.rede_corrente_json(k, v);
end $$;

/** As correntes abertas da cidade ESCRITA (texto; nada de posição). Só para membro (visitante recebe lista vazia). Até 10. */
create or replace function public.rede_correntes(p_cidade text) returns jsonb language plpgsql stable security definer set search_path = interno, pg_temp as $$
declare v uuid := auth.uid(); v_cidade text := interno.rede_ato_cidade(left(coalesce(p_cidade, ''), 80));
begin
  perform interno.aberta('comunidade');
  if v is null or not interno.rede2_membro(v) or v_cidade is null then return '[]'::jsonb; end if;
  return coalesce((select jsonb_agg(interno.rede_corrente_json(k, v) order by k.criada_em desc)
    from (select * from rede_correntes k
           where interno.rede_ato_cidade(k.cidade) = v_cidade and k.fechada_em is null and k.expira_em > now()
             and not exists (select 1 from rede_bloqueios b where (b.quem = k.autor and b.bloqueado = v) or (b.quem = v and b.bloqueado = k.autor))
           order by k.criada_em desc limit 10) k), '[]'::jsonb);
end $$;

/** "Vou" (ou desfazer) numa corrente aberta. Quando bate a meta, a corrente fecha (e deixa de aparecer na lista). */
create or replace function public.rede_corrente_vou(p_id uuid, p_sim boolean) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); k rede_correntes; v_n bigint;
begin
  perform interno.aberta('comunidade');
  if not interno.rede2_membro(v) then perform interno.erro('consentimento'); end if;
  perform interno.rede2_limite('reagir');
  select * into k from rede_correntes where id = p_id for update;
  if not found or exists (select 1 from rede_bloqueios b where (b.quem = k.autor and b.bloqueado = v) or (b.quem = v and b.bloqueado = k.autor)) then
    perform interno.erro('nao_encontrado');
  end if;
  if coalesce(p_sim, true) then
    if k.fechada_em is not null or k.expira_em <= now() then perform interno.erro('corrente_fechada'); end if;
    insert into rede_corrente_vou (corrente, usuario) values (p_id, v) on conflict do nothing;
  else
    delete from rede_corrente_vou where corrente = p_id and usuario = v;
  end if;
  select count(*) into v_n from rede_corrente_vou where corrente = p_id;
  if k.fechada_em is null and v_n >= k.meta then
    update rede_correntes set fechada_em = now() where id = p_id returning * into k;
  else
    select * into k from rede_correntes where id = p_id;
  end if;
  return interno.rede_corrente_json(k, v);
end $$;

-- ── 4. Permissões ───────────────────────────────────────────────────────────────────────────────────────────────────────────
revoke all on function interno.rede_ato_farol_json(uuid, uuid, boolean), interno.rede_corrente_elos(bigint, integer),
  interno.rede_corrente_json(interno.rede_correntes, uuid) from public;
revoke all on function public.rede_ato_farol(uuid), public.rede_ato_farol_pedir(uuid, text, text), public.rede_corrente_posso(),
  public.rede_corrente_abrir(jsonb), public.rede_correntes(text), public.rede_corrente_vou(uuid, boolean) from public;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on function interno.rede_ato_farol_json(uuid, uuid, boolean), interno.rede_corrente_elos(bigint, integer),
      interno.rede_corrente_json(interno.rede_correntes, uuid) from anon, authenticated;
    revoke all on function public.rede_ato_farol_pedir(uuid, text, text), public.rede_corrente_abrir(jsonb), public.rede_corrente_vou(uuid, boolean) from anon;
    grant execute on function public.rede_ato_farol(uuid), public.rede_correntes(text), public.rede_corrente_posso() to anon, authenticated, service_role;
    grant execute on function public.rede_ato_farol_pedir(uuid, text, text), public.rede_corrente_abrir(jsonb), public.rede_corrente_vou(uuid, boolean)
      to authenticated, service_role;
  end if;
end $$;

-- ═══════════════════════════ fim dos atos da Onda A (Farol e Corrente) ═══════════════════════════
