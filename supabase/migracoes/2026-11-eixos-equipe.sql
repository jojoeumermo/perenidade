-- ───────────────────────── Pesquisa dos 12 eixos da equipe, novembro de 2026 ─────────────────────────
-- Migração acrescentável: pode rodar mais de uma vez, sem apagar dado nenhum. Ainda NÃO está no install.sql (a integração junta).
-- Texto do pacote e da base legal: docs/eixos-equipe.md.
--
-- O que guarda: SÓ o agregado. A função recebe os 12 números (0 a 100, na ordem fixa de interno.eixos_equipe_ids abaixo),
-- soma em baldes (cinco faixas por eixo) e esquece os números. Não guarda a resposta de ninguém, nem data, nem tamanho de
-- teste. A marca "já respondeu" fica em outra tabela, só com a conta e a versão do aviso aceito (prova do consentimento), sem
-- nenhuma ligação com o valor.
--
-- Opinião política é dado pessoal sensível (LGPD, Lei 13.709/2018, art. 5º, II); o tratamento exige o consentimento específico
-- e destacado do art. 11, I, para finalidade determinada (art. 8º, § 4º). O agregado anonimizado deixa de ser dado pessoal
-- (art. 12), desde que não possa ser revertido: por isso a coordenação só vê o resultado quando há pelo menos 5 respostas e só
-- em degraus de 5 em 5 (o que se vê é uma "foto" tirada quando o total chega a 5, 10, 15...), para que a diferença entre duas
-- consultas não revele a resposta de uma pessoa.
--
-- Nenhuma tabela no esquema public; acesso só pelas funções public.* abaixo (security definer, search_path = interno, pg_temp).

create table if not exists interno.eixos_equipe_vivo (
  id boolean primary key default true check (id),
  n integer not null default 0,
  soma bigint[] not null default array_fill(0::bigint, array[12]),
  baldes integer[] not null default array_fill(0, array[60])   -- eixo * 5 + faixa (eixo de 0 a 11, faixa de 0 a 4)
);
create table if not exists interno.eixos_equipe_publicado (
  id boolean primary key default true check (id),
  n integer not null default 0,
  soma bigint[] not null default array_fill(0::bigint, array[12]),
  baldes integer[] not null default array_fill(0, array[60])
);
create table if not exists interno.eixos_equipe_marcas (
  usuario uuid primary key,
  versao text not null check (char_length(versao) between 1 and 40)
);
insert into interno.eixos_equipe_vivo (id) values (true) on conflict do nothing;
insert into interno.eixos_equipe_publicado (id) values (true) on conflict do nothing;

alter table interno.eixos_equipe_vivo enable row level security;
alter table interno.eixos_equipe_publicado enable row level security;
alter table interno.eixos_equipe_marcas enable row level security;
revoke all on interno.eixos_equipe_vivo, interno.eixos_equipe_publicado, interno.eixos_equipe_marcas from public;
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on interno.eixos_equipe_vivo, interno.eixos_equipe_publicado, interno.eixos_equipe_marcas from anon, authenticated;
  end if;
end $$;

/** Os 12 eixos, na ordem em que o teste manda os números (a mesma de content/eixos.json). */
create or replace function interno.eixos_equipe_ids() returns text[] language sql immutable as $$
  select array['propriedade','planejamento','comercio','poder','liberdades','territorio','soberania','conflito','diversidade','religiao','costumes','tecnologia']
$$;
revoke all on function interno.eixos_equipe_ids() from public;

/** A pessoa (da equipe) já respondeu? Só diz sim ou não. */
create or replace function public.eixos_equipe_estado() returns jsonb language plpgsql stable security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu();
begin
  if not interno.voluntario() then perform interno.erro('sem_permissao'); end if;
  return jsonb_build_object('respondeu', exists (select 1 from eixos_equipe_marcas where usuario = v));
end $$;
revoke all on function public.eixos_equipe_estado() from public;
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'authenticated') then grant execute on function public.eixos_equipe_estado() to authenticated; end if;
end $$;

/**
 * Soma uma resposta ao agregado. Recebe SÓ os 12 números; exige o consentimento marcado e a versão do aviso. Uma resposta por
 * conta (a marca fica separada). Não devolve nada além de "ok".
 */
create or replace function public.eixos_equipe_enviar(p_pontos integer[], p_consentimento boolean, p_versao text) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare
  v uuid := interno.eu();
  i integer;
  f integer;
  r eixos_equipe_vivo%rowtype;
begin
  if not interno.voluntario() then perform interno.erro('sem_permissao'); end if;
  if p_consentimento is distinct from true then perform interno.erro('invalido:consentimento'); end if;
  if p_versao is null or char_length(p_versao) not between 1 and 40 then perform interno.erro('invalido:versao'); end if;
  if p_pontos is null or array_ndims(p_pontos) is distinct from 1 or array_length(p_pontos, 1) is distinct from 12 then perform interno.erro('invalido:pontos'); end if;
  for i in 1..12 loop
    if p_pontos[i] is null or p_pontos[i] < 0 or p_pontos[i] > 100 then perform interno.erro('invalido:pontos'); end if;
  end loop;

  -- Trava a linha do agregado: duas respostas ao mesmo tempo não se perdem.
  select * into r from eixos_equipe_vivo where id for update;
  insert into eixos_equipe_marcas (usuario, versao) values (v, p_versao) on conflict (usuario) do nothing;
  if not found then perform interno.erro('ja_respondeu'); end if;

  r.n := r.n + 1;
  for i in 1..12 loop
    r.soma[i] := r.soma[i] + p_pontos[i];
    f := least(4, greatest(0, floor(p_pontos[i] / 20.0)::integer));
    r.baldes[(i - 1) * 5 + f + 1] := r.baldes[(i - 1) * 5 + f + 1] + 1;
  end loop;
  update eixos_equipe_vivo set n = r.n, soma = r.soma, baldes = r.baldes where id;
  -- A "foto" que a coordenação enxerga só muda de 5 em 5 respostas.
  if r.n >= 5 and r.n % 5 = 0 then
    update eixos_equipe_publicado set n = r.n, soma = r.soma, baldes = r.baldes where id;
  end if;
  return jsonb_build_object('ok', true);
end $$;
revoke all on function public.eixos_equipe_enviar(integer[], boolean, text) from public;
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'authenticated') then grant execute on function public.eixos_equipe_enviar(integer[], boolean, text) to authenticated; end if;
end $$;

/** Só a coordenação: média e distribuição da equipe, ou "liberado: false" enquanto houver menos de 5 respostas. */
create or replace function public.eixos_equipe_resultado() returns jsonb language plpgsql stable security definer set search_path = interno, pg_temp as $$
declare
  p eixos_equipe_publicado%rowtype;
  ids text[] := interno.eixos_equipe_ids();
  media jsonb := '{}'::jsonb;
  dist jsonb := '{}'::jsonb;
  i integer;
begin
  if not interno.coord() then perform interno.erro('sem_permissao'); end if;
  select * into p from eixos_equipe_publicado where id;
  if p.n < 5 then return jsonb_build_object('liberado', false, 'minimo', 5); end if;
  for i in 1..12 loop
    media := media || jsonb_build_object(ids[i], round(p.soma[i]::numeric / p.n));
    dist := dist || jsonb_build_object(ids[i], to_jsonb(p.baldes[(i - 1) * 5 + 1 : (i - 1) * 5 + 5]));
  end loop;
  return jsonb_build_object('liberado', true, 'minimo', 5, 'n', p.n, 'media', media, 'distribuicao', dist);
end $$;
revoke all on function public.eixos_equipe_resultado() from public;
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'authenticated') then grant execute on function public.eixos_equipe_resultado() to authenticated; end if;
end $$;
