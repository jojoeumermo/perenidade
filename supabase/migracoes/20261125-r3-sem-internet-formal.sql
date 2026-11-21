-- Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
-- Alumia · R3 · Farol do ato sem internet (onda R3, item 2.2):
--
--   Com internet, o farol de um ato só muda quando DUAS pessoas da coordenação pedem o mesmo estado (20261110-alumia-atos.sql): é o
--   banco que conta as duas. Sem internet não há banco. Então, antes do ato, com internet:
--     - quem confirmou presença (ou coordena) recebe a chave do ato, k_ato (32 bytes sorteados pelo banco). Com ela o aparelho
--       reconhece e abre os pacotes do farol que passam pela malha (lib/rede/malha/pacote.ts); quem não confirmou não reconhece nada;
--     - cada pessoa da coordenação publica a chave Ed25519 do farol dela para este ato (criada no aparelho; o banco guarda só a
--       pública, SEM assinatura da identidade da conta: uma assinatura da identidade, conferida por quem recebe contra o diretório,
--       diria QUEM coordena). Sem internet, o farol só vale com as assinaturas de DUAS chaves diferentes desta lista
--       (lib/rede/malha/farol.ts): a regra das duas pessoas, agora sem servidor. Quem garante que a chave é de quem coordena é o banco
--       (só aceita da sessão de quem coordena), não uma assinatura.
--
--   1. As tabelas: interno.rede_ato_farol_material (ato, k_ato, dia) e interno.rede_ato_farol_chaves (ato, chave, de, dia, falsa).
--      Toda lista de chaves tem SEMPRE 8 linhas: as que ninguém publicou são falsas, e a lista volta em ordem de chave. As falsas são
--      chaves Ed25519 VÁLIDAS que o aparelho de quem publica cria e cuja semente joga fora (iscas): 32 bytes sorteados pelo banco não
--      seriam um ponto da curva metade das vezes, e quem recebe contaria as verdadeiras. Antes da primeira publicação, as 8 são
--      sorteadas pelo banco (nenhuma vale). Assim quem recebe não sabe quantas pessoas da coordenação publicaram nem quem são.
--   2. public.rede_ato_farol_material(p_ato): com sessão; só quem confirmou presença ou coordena (a MESMA regra de
--      public.rede_ato_farol). Devolve {k_ato, chaves: [{chave}] × 8} em base64. Cria o material na primeira vez.
--   3. public.rede_ato_farol_chave_publicar(p_ato, p_chave, p_iscas): só quem coordena; uma chave por pessoa por ato (publicar
--      de novo troca a dela). Sem isso, uma pessoa só publicaria duas chaves e assinaria o farol sozinha. p_iscas: até 7 chaves
--      Ed25519 válidas sem dono, que tomam o lugar das linhas falsas.
--
-- O que o banco NÃO devolve: quem recebeu k_ato, quem confirmou presença, quantas pessoas publicaram chave (a lista tem sempre 8), de
-- quem é cada chave, nenhum número de pessoas. Só o DIA, nunca a hora. O material some 30 dias depois (o ato já passou) e junto com o
-- ato. LIMITE (dito em docs/rede/SEM-INTERNET.md): o banco GUARDA quem publicou cada chave (a coluna "de", para "uma por pessoa") e
-- quais linhas são falsas; quem tem o banco sabe quem da coordenação publicou chave para cada ato. Quem coordena o ato o banco já
-- sabia (a organização e as pessoas que a gerem).
--
-- Leis e princípios: LGPD art. 6º, III (necessidade) e art. 11 (ir a um ato revela opinião política, dado sensível); Constituição
-- art. 5º, XVI (reunião) e XVII (associação). ECA e ECA Digital: só membro 18+ (interno.rede2_membro).
--
-- Depende de: 20261110-alumia-atos.sql (rede_ato_farol, rede_vou, rede_ato_achar, rede_age_como), 20261124-r2-voto.sql
-- (interno.voto_b64 e interno.voto_bytes). Não redefine nenhuma função existente.
-- Pode rodar mais de uma vez. Termina trancando tudo na porta. Teste: npm run testar:r3-malha-banco.

-- ── 1. As tabelas ─────────────────────────────────────────────────────────────────────────────────────────────────────────
/**
 * O segredo de um ato para o modo sem internet (32 bytes sorteados pelo banco): só quem confirmou presença ou coordena o recebe. Só o
 * dia. Some 30 dias depois do ato e junto com o ato. Nenhuma lista de pessoas.
 */
create table if not exists interno.rede_ato_farol_material (
  ato uuid primary key references interno.rede_posts (id) on delete cascade,
  k_ato bytea not null check (octet_length(k_ato) = 32),
  dia date not null default current_date
);
/**
 * A chave do farol (Ed25519) de cada pessoa da coordenação de um ato, sem assinatura da identidade, com linhas falsas misturadas. O
 * "de" só garante uma chave por pessoa (nenhuma função o devolve; quem tem o banco sabe quem publicou). Some com o material do ato.
 */
create table if not exists interno.rede_ato_farol_chaves (
  ato uuid not null references interno.rede_ato_farol_material (ato) on delete cascade,
  chave bytea not null check (octet_length(chave) = 32),
  -- Quem publicou (só para "uma chave por pessoa"; nenhuma função devolve). Nulo nas linhas falsas.
  de uuid references interno.perfis (id) on delete cascade,
  falsa boolean not null default false,
  dia date not null default current_date,
  primary key (ato, chave),
  check (falsa = (de is null))
);
-- A assinatura da identidade da conta saiu (apontava quem coordena); quem rodou a versão de antes perde a coluna.
alter table interno.rede_ato_farol_chaves drop column if exists assinatura;
create unique index if not exists rede_ato_farol_chaves_de on interno.rede_ato_farol_chaves (ato, de) where de is not null;
alter table interno.rede_ato_farol_material enable row level security;
alter table interno.rede_ato_farol_chaves enable row level security;
revoke all on table interno.rede_ato_farol_material, interno.rede_ato_farol_chaves from public;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on table interno.rede_ato_farol_material, interno.rede_ato_farol_chaves from anon, authenticated;
  end if;
end $$;

-- ── 2. O material do ato ──────────────────────────────────────────────────────────────────────────────────────────────────

/** Cria (uma vez) o material do ato: k_ato e as 8 linhas falsas da lista. Some o material com mais de 30 dias. */
create or replace function interno.rede_ato_farol_material_garantir(p_ato uuid) returns void
language plpgsql security definer set search_path = interno, pg_temp as $$
begin
  delete from rede_ato_farol_material where dia < current_date - 30;
  insert into rede_ato_farol_material (ato, k_ato) values (p_ato, extensions.gen_random_bytes(32)) on conflict (ato) do nothing;
  if not exists (select 1 from rede_ato_farol_chaves where ato = p_ato) then
    insert into rede_ato_farol_chaves (ato, chave, falsa)
    select p_ato, extensions.gen_random_bytes(32), true from generate_series(1, 8);
  end if;
end $$;

/** O material como o aparelho recebe: k_ato e as 8 chaves (verdadeiras e falsas misturadas, em ordem de chave). */
create or replace function interno.rede_ato_farol_material_json(p_ato uuid) returns jsonb
language sql stable security definer set search_path = interno, pg_temp as $$
  select jsonb_build_object(
    'k_ato', (select interno.voto_b64(m.k_ato) from rede_ato_farol_material m where m.ato = p_ato),
    'chaves', coalesce((select jsonb_agg(jsonb_build_object('chave', interno.voto_b64(k.chave)) order by k.chave)
                          from rede_ato_farol_chaves k where k.ato = p_ato), '[]'::jsonb))
$$;

/**
 * A chave do ato e as chaves do farol, para guardar no aparelho ANTES do ato (com internet). Só quem confirmou presença ou coordena
 * (a mesma regra de public.rede_ato_farol); os outros, e o ato cancelado, recebem nulo.
 */
create or replace function public.rede_ato_farol_material(p_ato uuid) returns jsonb
language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := auth.uid(); p rede_posts; c rede_chamados;
begin
  perform interno.aberta('comunidade');
  if v is null or not interno.rede2_membro(v) then return null; end if;
  p := interno.rede_ato_achar(p_ato, v);
  if not interno.rede_age_como(v, p.autor) and not exists (select 1 from rede_vou o where o.post = p_ato and o.usuario = v) then return null; end if;
  select * into c from rede_chamados where post = p_ato;
  if c.situacao = 'cancelado' then return null; end if;
  perform interno.limite('rede_ato_farol_material', 30, 60);
  perform interno.rede_ato_farol_material_garantir(p_ato);
  return interno.rede_ato_farol_material_json(p_ato);
end $$;

-- A versão de antes recebia a assinatura da identidade da conta (p_assinatura); sai, com a permissão dela.
drop function if exists public.rede_ato_farol_chave_publicar(uuid, text, text);

/**
 * Quem coordena publica a chave do farol dela para este ato (p_chave: a pública Ed25519, 32 bytes, em base64). Uma por pessoa:
 * publicar de novo troca a dela. A lista nunca passa de 8 (a nova toma o lugar de uma linha falsa). p_iscas: até 7 chaves Ed25519
 * válidas, sem dono (o aparelho joga fora a semente: lib/rede/malha/farol.ts, iscasDoFarol), que tomam o lugar de TODAS as linhas
 * falsas, para elas não se distinguirem das verdadeiras por não serem ponto da curva. Nenhuma assinatura da identidade da conta: ela
 * diria a quem recebe QUEM coordena.
 */
create or replace function public.rede_ato_farol_chave_publicar(p_ato uuid, p_chave text, p_iscas text[]) returns jsonb
language plpgsql security definer set search_path = interno, pg_temp as $$
declare
  v uuid := interno.eu(); p rede_posts; c rede_chamados;
  v_chave bytea := interno.voto_bytes(p_chave); v_falsa bytea; v_iscas bytea[] := '{}'; v_b bytea; v_t text; v_reais int;
begin
  perform interno.aberta('comunidade');
  if not interno.rede2_membro(v) then perform interno.erro('consentimento'); end if;
  p := interno.rede_ato_achar(p_ato, v);
  if not interno.rede_age_como(v, p.autor) then perform interno.erro('so_coordenacao'); end if;
  select * into c from rede_chamados where post = p_ato;
  if c.situacao = 'cancelado' then perform interno.erro('ato_cancelado'); end if;
  if octet_length(v_chave) is distinct from 32 then perform interno.erro('invalido:chave'); end if;
  if coalesce(cardinality(p_iscas), 0) > 7 then perform interno.erro('invalido:iscas'); end if;
  foreach v_t in array coalesce(p_iscas, '{}'::text[]) loop
    v_b := interno.voto_bytes(v_t);
    if octet_length(v_b) is distinct from 32 or v_b = v_chave or v_b = any (v_iscas) then perform interno.erro('invalido:iscas'); end if;
    v_iscas := v_iscas || v_b;
  end loop;
  perform interno.limite('rede_ato_farol_chave_publicar', 10, 60);
  perform interno.rede_ato_farol_material_garantir(p_ato);
  perform pg_advisory_xact_lock(hashtextextended('alumia_farol_chaves:' || p_ato::text, 0));
  if exists (select 1 from rede_ato_farol_chaves where ato = p_ato and chave = v_chave and de is distinct from v) then perform interno.erro('invalido:chave'); end if;
  if exists (select 1 from rede_ato_farol_chaves where ato = p_ato and not falsa and de is distinct from v and chave = any (v_iscas)) then perform interno.erro('invalido:iscas'); end if;
  if exists (select 1 from rede_ato_farol_chaves where ato = p_ato and de = v) then
    update rede_ato_farol_chaves set chave = v_chave, dia = current_date where ato = p_ato and de = v;
  else
    select chave into v_falsa from rede_ato_farol_chaves where ato = p_ato and falsa order by extensions.gen_random_bytes(8) limit 1;
    if v_falsa is null then perform interno.erro('limite'); end if;
    delete from rede_ato_farol_chaves where ato = p_ato and chave = v_falsa;
    insert into rede_ato_farol_chaves (ato, chave, de, falsa) values (p_ato, v_chave, v, false);
  end if;
  -- As iscas tomam o lugar de todas as linhas falsas (nenhuma sorteada pelo banco fica ao lado delas); se faltar isca, o banco completa
  -- com sorteio até 8.
  if cardinality(v_iscas) > 0 then
    select count(*) into v_reais from rede_ato_farol_chaves where ato = p_ato and not falsa;
    delete from rede_ato_farol_chaves where ato = p_ato and falsa;
    insert into rede_ato_farol_chaves (ato, chave, falsa)
    select p_ato, x, true from unnest(v_iscas[1:greatest(8 - v_reais, 0)]) x on conflict do nothing;
    insert into rede_ato_farol_chaves (ato, chave, falsa)
    select p_ato, extensions.gen_random_bytes(32), true
      from generate_series(1, 8 - (select count(*) from rede_ato_farol_chaves where ato = p_ato)::int);
  end if;
  return interno.rede_ato_farol_material_json(p_ato);
end $$;

-- ── 3. Permissões ─────────────────────────────────────────────────────────────────────────────────────────────────────────
revoke all on function interno.rede_ato_farol_material_garantir(uuid) from public;
revoke all on function interno.rede_ato_farol_material_json(uuid) from public;
revoke all on function public.rede_ato_farol_material(uuid) from public;
revoke all on function public.rede_ato_farol_chave_publicar(uuid, text, text[]) from public;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on function interno.rede_ato_farol_material_garantir(uuid) from anon, authenticated;
    revoke all on function interno.rede_ato_farol_material_json(uuid) from anon, authenticated;
    revoke all on function public.rede_ato_farol_material(uuid) from anon;
    revoke all on function public.rede_ato_farol_chave_publicar(uuid, text, text[]) from anon;
    grant execute on function public.rede_ato_farol_material(uuid) to authenticated, service_role;
    grant execute on function public.rede_ato_farol_chave_publicar(uuid, text, text[]) to authenticated, service_role;
  end if;
end $$;

select interno.alumia_trancar();
