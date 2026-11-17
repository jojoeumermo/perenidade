-- ─────────────── Alumia · Onda 10 · 10E · decisão e números da comunidade (16/11/2026) ───────────────
-- Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
--
-- Duas coisas para a comunidade:
--
--   1. VOTAÇÃO INTERNA COM QUÓRUM E PRAZO (L2-58). A moderação abre a votação: a pergunta, de 2 a 8 opções, o quórum (quantas
--      pessoas precisam votar para valer, 3 ou mais) e o prazo. O modo é escolhido na abertura e não muda depois:
--      · SECRETA (o padrão): o mesmo esquema da consulta à base (docs/rede/VOTO-SECRETO.md). "Quem votou" fica numa tabela,
--        "o que votou" na outra, sem nada em comum. A cédula chega CIFRADA do aparelho (lib/rede/voto/cedula.ts, a mesma Web
--        Crypto da consulta) e entra na urna regravada junto com as outras, em ordem sorteada; com a votação fechada, o servidor do
--        site abre todas de uma vez (lib/rede/voto/servidor.ts, o mesmo segredo e a mesma derivação de chave por id) e devolve só
--        as escolhas, embaralhadas, num lote. Sem o segredo no servidor, a cédula vai pela urna do banco, sem cifra (como a 8F).
--      · ABERTA: o nome vai junto do voto, e todo mundo sabe disso antes de votar (a tela pede a confirmação). Os nomes aparecem
--        só no fechamento, junto com o resultado.
--      Só vota quem já era da comunidade quando a votação abriu (ninguém entra de última hora só para virar o resultado). Não dá
--      para mudar o voto. O resultado só sai com o prazo vencido, com 3 votos ou mais e com o quórum atingido; antes disso, nem o
--      número de quem votou. Número abaixo de 3 não aparece (a opção diz "menos de 3"). A moderação pode cancelar uma votação
--      aberta: as cédulas e os nomes somem, e o resultado nunca sai. Ninguém fecha antes do prazo.
--
--   2. NÚMEROS PARA A MODERAÇÃO (L2-56). Só para quem modera a comunidade: por semana (as últimas 8), posts e respostas novos,
--      pessoas que entraram, denúncias recebidas e decididas e o tempo até a primeira decisão (mediana, em horas). Só agregados,
--      cada número só a partir de 3. Nenhuma lista de pessoas, nenhum "quem mais posta".
--
-- Tudo em interno, com RLS e sem política. As funções que o servidor do site chama só aceitam a chave de serviço; as de membro
-- passam pela porta (interno.alumia_trancar, no fim). Pode rodar mais de uma vez, sem apagar dado nenhum. Roda DEPOIS das
-- migrações da onda 9 (usa interno.alumia_pessoas, interno.rede3_com_modera e o formato da cédula de 20261115-alumia-o9-resto8.sql).
-- Depois de rodar em produção, com votação já usada: VACUUM (FULL) interno.alumia_decisao_cedulas e interno.alumia_decisao_cifradas
-- (fora de transação), como na 8F. Teste: scripts/testar-alumia-o10-decisao.mjs.

-- ── 1. As tabelas ───────────────────────────────────────────────────────────────────────────────────────────────────────────

-- A votação. Sem "quem abriu": é a moderação da comunidade, e o nome de quem clicou não serve para nada.
create table if not exists interno.alumia_decisoes (
  id uuid primary key default gen_random_uuid(),
  comunidade text not null references interno.rede_comunidades (slug) on delete cascade on update cascade,
  pergunta text not null check (char_length(pergunta) between 5 and 200),
  explicacao text not null default '' check (char_length(explicacao) <= 1000),
  modo text not null default 'secreta' check (modo in ('secreta', 'aberta')),
  quorum integer not null check (quorum between 3 and 100000),
  prazo timestamptz not null,
  cancelada_em timestamptz,
  criada_em timestamptz not null default now(),
  check (prazo > criada_em)
);
create index if not exists alumia_decisoes_comunidade on interno.alumia_decisoes (comunidade, prazo desc);

create table if not exists interno.alumia_decisao_opcoes (
  id uuid primary key default gen_random_uuid(),
  decisao uuid not null references interno.alumia_decisoes (id) on delete cascade,
  ordem smallint not null check (ordem between 1 and 8),
  texto text not null check (char_length(texto) between 1 and 120),
  unique (decisao, ordem)
);

-- Quem votou (nos dois modos): para ninguém votar duas vezes, para o quórum e para dizer "você já votou". As funções nunca
-- devolvem esta lista. Conta apagada: a linha fica sem pessoa e continua contando.
create table if not exists interno.alumia_decisao_votantes (
  decisao uuid not null references interno.alumia_decisoes (id) on delete cascade,
  usuario uuid references interno.perfis (id) on delete set null
);
create unique index if not exists alumia_decisao_votantes_quem on interno.alumia_decisao_votantes (decisao, usuario);

-- A urna do voto secreto: só a votação e a opção. Sem id, sem hora, sem sequência, sem valor padrão (VOTO-SECRETO.md §6).
create table if not exists interno.alumia_decisao_cedulas (
  decisao uuid not null references interno.alumia_decisoes (id) on delete cascade,
  opcao uuid not null references interno.alumia_decisao_opcoes (id) on delete cascade
);
create index if not exists alumia_decisao_cedulas_decisao on interno.alumia_decisao_cedulas (decisao);
alter table interno.alumia_decisao_cedulas set (autovacuum_vacuum_threshold = 0, autovacuum_vacuum_scale_factor = 0);

-- A cédula cifrada no aparelho (o mesmo formato "c1." da consulta): só a votação e o texto cifrado. Sai na apuração.
create table if not exists interno.alumia_decisao_cifradas (
  decisao uuid not null references interno.alumia_decisoes (id) on delete cascade,
  cedula text not null check (char_length(cedula) <= 1600 and cedula ~ '^c1\.[A-Za-z0-9_-]{87}\.[A-Za-z0-9_-]{16}\.[A-Za-z0-9_-]{22,}$')
);
create index if not exists alumia_decisao_cifradas_decisao on interno.alumia_decisao_cifradas (decisao);
alter table interno.alumia_decisao_cifradas set (autovacuum_vacuum_threshold = 0, autovacuum_vacuum_scale_factor = 0);

-- O voto aberto: a pessoa e a opção na mesma linha, de propósito (quem votou sabia). Conta apagada: o voto fica, o nome sai.
create table if not exists interno.alumia_decisao_abertos (
  decisao uuid not null references interno.alumia_decisoes (id) on delete cascade,
  opcao uuid not null references interno.alumia_decisao_opcoes (id) on delete cascade,
  usuario uuid references interno.perfis (id) on delete set null
);
create unique index if not exists alumia_decisao_abertos_quem on interno.alumia_decisao_abertos (decisao, usuario);

alter table interno.alumia_decisoes enable row level security;
alter table interno.alumia_decisao_opcoes enable row level security;
alter table interno.alumia_decisao_votantes enable row level security;
alter table interno.alumia_decisao_cedulas enable row level security;
alter table interno.alumia_decisao_cifradas enable row level security;
alter table interno.alumia_decisao_abertos enable row level security;
revoke all on interno.alumia_decisoes, interno.alumia_decisao_opcoes, interno.alumia_decisao_votantes, interno.alumia_decisao_cedulas,
  interno.alumia_decisao_cifradas, interno.alumia_decisao_abertos from public;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on interno.alumia_decisoes, interno.alumia_decisao_opcoes, interno.alumia_decisao_votantes, interno.alumia_decisao_cedulas,
      interno.alumia_decisao_cifradas, interno.alumia_decisao_abertos from anon, authenticated;
  end if;
end $$;

-- ── 2. As urnas (as mesmas da consulta, para esta votação) ──────────────────────────────────────────────────────────────────

/**
 * A urna do voto secreto sem cifra: apaga as cédulas da votação (todas, até 2000; acima, 2000 sorteadas) e grava de novo essas e a
 * nova num INSERT só, em ordem sorteada. A cédula nova fica com o mesmo xmin e o mesmo cmin das regravadas.
 */
create or replace function interno.alumia_dec_urna(p_decisao uuid, p_opcao uuid) returns void language plpgsql security definer set search_path = interno, pg_temp as $$
begin
  with velhas as (
    delete from alumia_decisao_cedulas
    where decisao = p_decisao
      and ctid = any (array(select ctid from alumia_decisao_cedulas where decisao = p_decisao order by gen_random_uuid() limit 2000))
    returning opcao)
  insert into alumia_decisao_cedulas (decisao, opcao)
  select p_decisao, t.o from (select opcao as o from velhas union all select p_opcao) t order by gen_random_uuid();
end $$;

/** A urna das cédulas cifradas (como interno.alumia_urna_cifrada da consulta). */
create or replace function interno.alumia_dec_urna_cifrada(p_decisao uuid, p_cedula text) returns void language plpgsql security definer set search_path = interno, pg_temp as $$
begin
  with velhas as (
    delete from alumia_decisao_cifradas
    where decisao = p_decisao
      and ctid = any (array(select ctid from alumia_decisao_cifradas where decisao = p_decisao order by gen_random_uuid() limit 2000))
    returning cedula)
  insert into alumia_decisao_cifradas (decisao, cedula)
  select p_decisao, t.c from (select cedula as c from velhas union all select p_cedula) t order by gen_random_uuid();
end $$;

-- ── 3. Quem vota e como a votação aparece ───────────────────────────────────────────────────────────────────────────────────

/** 'cancelada', 'aberta' ou 'fechada' (o prazo venceu). */
create or replace function interno.alumia_dec_situacao(d interno.alumia_decisoes) returns text language sql stable as $$
  select case when d.cancelada_em is not null then 'cancelada' when d.prazo > now() then 'aberta' else 'fechada' end
$$;

/**
 * Por que esta pessoa não pode votar agora (nulo: pode). 'ja_votou'; 'fechada'; 'nao_membro' (não é da comunidade, ou está
 * banida); 'chegou_depois' (entrou na comunidade depois de a votação abrir); 'entre_na_alumia' (sem a entrada da Alumia).
 */
create or replace function interno.alumia_dec_impedimento(d interno.alumia_decisoes, p_quem uuid) returns text language sql stable security definer set search_path = interno, pg_temp as $$
  select case
    when p_quem is null or not interno.rede2_membro(p_quem) then 'entre_na_alumia'
    when interno.alumia_dec_situacao(d) <> 'aberta' then 'fechada'
    when exists (select 1 from alumia_decisao_votantes v where v.decisao = d.id and v.usuario = p_quem) then 'ja_votou'
    when not interno.rede2_na_comunidade(d.comunidade, p_quem) then 'nao_membro'
    when not exists (select 1 from rede_comunidade_membros m where m.comunidade = d.comunidade and m.usuario = p_quem and m.entrou_em <= d.criada_em) then 'chegou_depois'
    else null end
$$;

/**
 * A votação como a tela mostra. Aberta: a pergunta, as opções, o prazo, o quórum, o modo e se esta pessoa já votou ou pode votar;
 * nenhum número. Fechada: o resultado só com 3 votos ou mais, o quórum atingido e nenhuma cédula ainda cifrada ("apurar": a tela
 * pede ao servidor para abrir). Cada número abaixo de 3 sai nulo, com "poucos"; e, na secreta, quando alguma opção tem 1 ou 2 votos,
 * nenhum número sai (nem o total de votantes, nem o das outras opções), para o pequeno não sair por subtração: só a vencedora e o
 * quórum atingido. No modo aberto, os nomes por opção, no fechamento.
 */
create or replace function interno.alumia_dec_json(d interno.alumia_decisoes, p_quem uuid) returns jsonb language plpgsql stable security definer set search_path = interno, pg_temp as $$
declare
  v_sit text := interno.alumia_dec_situacao(d); v_votantes integer := 0; v_cedulas integer := 0; v_apurar boolean := false;
  v_mostra boolean := false; v_quorum boolean; v_max integer; v_vencedoras integer; v_imp text; v_numeros boolean := false;
begin
  v_imp := interno.alumia_dec_impedimento(d, p_quem);
  if v_sit = 'fechada' then
    select count(*) into v_votantes from alumia_decisao_votantes where decisao = d.id;
    v_apurar := exists (select 1 from alumia_decisao_cifradas x where x.decisao = d.id);
    select (select count(*) from alumia_decisao_cedulas c where c.decisao = d.id) + (select count(*) from alumia_decisao_abertos a where a.decisao = d.id)
      into v_cedulas;
    v_quorum := v_votantes >= d.quorum;
    -- Com 1 ou 2 votos daria para saber o voto de alguém; sem quórum, o resultado não vale e não aparece.
    v_mostra := not v_apurar and v_votantes >= 3 and v_cedulas >= 3 and v_quorum;
  end if;
  if v_mostra then
    with x as (select (select count(*) from alumia_decisao_cedulas c where c.opcao = o.id) + (select count(*) from alumia_decisao_abertos a where a.opcao = o.id) as n
               from alumia_decisao_opcoes o where o.decisao = d.id)
    select max(n), count(*) filter (where n = (select max(n) from x)), d.modo = 'aberta' or not bool_or(n between 1 and 2)
      into v_max, v_vencedoras, v_numeros from x;
  end if;
  return jsonb_build_object(
    'id', d.id, 'pergunta', d.pergunta, 'explicacao', d.explicacao, 'modo', d.modo, 'quorum', d.quorum, 'prazo', d.prazo,
    'criada_em', d.criada_em, 'situacao', v_sit,
    'votei', p_quem is not null and exists (select 1 from alumia_decisao_votantes v where v.decisao = d.id and v.usuario = p_quem),
    'possoVotar', v_imp is null,
    'impedimento', case when v_sit = 'aberta' then v_imp end,
    'apurar', v_apurar,
    'votantes', case when v_sit = 'fechada' and (not v_mostra or v_numeros) then interno.alumia_pessoas(v_votantes) end,
    'quorumAtingido', case when v_sit = 'fechada' then v_quorum end,
    'resultado', v_mostra,
    'numeros', v_mostra and v_numeros,
    'empate', v_mostra and v_vencedoras > 1,
    'opcoes', coalesce((select jsonb_agg(jsonb_build_object(
        'id', o.id, 'texto', o.texto,
        'votos', case when v_mostra and v_numeros then interno.alumia_pessoas(o.n) end,
        'poucos', v_mostra and o.n < 3,
        'vencedora', v_mostra and o.n = v_max and v_max > 0,
        'quem', case when v_mostra and d.modo = 'aberta' then
          (select coalesce(jsonb_agg(interno.rede_nome(a.usuario) order by interno.rede_nome(a.usuario)), '[]'::jsonb)
           from alumia_decisao_abertos a where a.opcao = o.id and a.usuario is not null) end)
        order by o.ordem)
      from (select o1.*, (select count(*) from alumia_decisao_cedulas c where c.opcao = o1.id) + (select count(*) from alumia_decisao_abertos a where a.opcao = o1.id) as n
            from alumia_decisao_opcoes o1 where o1.decisao = d.id) o), '[]'::jsonb));
end $$;

-- ── 4. As funções de membro ─────────────────────────────────────────────────────────────────────────────────────────────────

/**
 * As votações de uma comunidade, para quem é dela (ou a modera): as abertas primeiro (a que fecha antes no alto), depois as
 * fechadas e as canceladas, as mais novas primeiro (até 30). Quem não é da comunidade recebe a lista vazia (sem dizer se existem).
 */
create or replace function public.alumia_decisao_lista(p_slug text) returns jsonb language plpgsql stable security definer set search_path = interno, pg_temp as $$
declare v uuid := auth.uid(); c rede_comunidades; v_modero boolean; v_membro boolean;
begin
  c := interno.rede3_com_achar(p_slug);
  if c.slug is null then perform interno.erro('nao_encontrado'); end if;
  v_modero := interno.rede3_com_modera(c.slug, v);
  v_membro := interno.rede2_na_comunidade(c.slug, v);
  if not v_modero and not v_membro then
    return jsonb_build_object('comunidade', c.slug, 'modero', false, 'membro', false, 'decisoes', '[]'::jsonb);
  end if;
  return jsonb_build_object('comunidade', c.slug, 'modero', v_modero, 'membro', v_membro,
    'decisoes', coalesce((select jsonb_agg(interno.alumia_dec_json(x, v) order by (interno.alumia_dec_situacao(x) = 'aberta') desc,
                                   case when interno.alumia_dec_situacao(x) = 'aberta' then x.prazo end asc, x.prazo desc)
                          from (select * from alumia_decisoes d where d.comunidade = c.slug
                                order by (d.cancelada_em is null and d.prazo > now()) desc, d.prazo desc limit 30) x), '[]'::jsonb));
end $$;

/**
 * A moderação abre uma votação. p = {pergunta, explicacao, opcoes: [texto], modo: 'secreta'|'aberta', quorum, prazo}. De 2 a 8
 * opções diferentes; o prazo entre 1 hora e 60 dias; o quórum de 3 a 100000. Até 5 votações abertas por comunidade.
 */
create or replace function public.alumia_decisao_criar(p_slug text, p jsonb) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare
  v uuid := interno.eu(); c rede_comunidades; d alumia_decisoes; v_opcoes text[]; v_pergunta text; v_expl text; v_modo text;
  v_quorum integer; v_prazo timestamptz; i integer;
begin
  perform interno.rede3_perfil_exige_membro(v);
  c := interno.rede3_com_achar(p_slug);
  if c.slug is null then perform interno.erro('nao_encontrado'); end if;
  if not interno.rede3_com_modera(c.slug, v) then perform interno.erro('sem_permissao'); end if;
  if p is null or jsonb_typeof(p) <> 'object' then perform interno.erro('invalido:dados'); end if;
  v_pergunta := btrim(coalesce(p ->> 'pergunta', ''));
  v_expl := btrim(coalesce(p ->> 'explicacao', ''));
  v_modo := coalesce(p ->> 'modo', 'secreta');
  if char_length(v_pergunta) not between 5 and 200 then perform interno.erro('invalido:pergunta'); end if;
  if char_length(v_expl) > 1000 then perform interno.erro('invalido:explicacao'); end if;
  if v_modo not in ('secreta', 'aberta') then perform interno.erro('invalido:modo'); end if;
  if jsonb_typeof(p -> 'opcoes') is distinct from 'array' then perform interno.erro('invalido:opcoes'); end if;
  select array_agg(btrim(x) order by n) into v_opcoes from jsonb_array_elements_text(p -> 'opcoes') with ordinality as t(x, n) where btrim(x) <> '';
  if v_opcoes is null or cardinality(v_opcoes) not between 2 and 8
     or exists (select 1 from unnest(v_opcoes) y where char_length(y) > 120)
     or (select count(distinct lower(y)) from unnest(v_opcoes) y) <> cardinality(v_opcoes) then
    perform interno.erro('invalido:opcoes');
  end if;
  begin
    v_quorum := (p ->> 'quorum')::integer;
    v_prazo := (p ->> 'prazo')::timestamptz;
  exception when others then
    perform interno.erro('invalido:dados');
  end;
  if v_quorum is null or v_quorum not between 3 and 100000 then perform interno.erro('invalido:quorum'); end if;
  if v_prazo is null or v_prazo < now() + interval '1 hour' or v_prazo > now() + interval '60 days' then perform interno.erro('invalido:prazo'); end if;
  if (select count(*) from alumia_decisoes x where x.comunidade = c.slug and x.cancelada_em is null and x.prazo > now()) >= 5 then
    perform interno.erro('muitas_abertas');
  end if;
  perform interno.limite('alumia_decisao_criar', 10, 60);
  insert into alumia_decisoes (comunidade, pergunta, explicacao, modo, quorum, prazo)
  values (c.slug, v_pergunta, v_expl, v_modo, v_quorum, v_prazo) returning * into d;
  for i in 1..cardinality(v_opcoes) loop
    insert into alumia_decisao_opcoes (decisao, ordem, texto) values (d.id, i, v_opcoes[i]);
  end loop;
  return interno.alumia_dec_json(d, v);
end $$;

/** A moderação cancela uma votação aberta. As cédulas, os nomes e quem votou somem; o resultado nunca sai. */
create or replace function public.alumia_decisao_cancelar(p_id uuid) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); d alumia_decisoes;
begin
  select * into d from alumia_decisoes where id = p_id;
  if not found or not interno.rede3_com_modera(d.comunidade, v) then perform interno.erro('nao_encontrado'); end if;
  if interno.alumia_dec_situacao(d) <> 'aberta' then perform interno.erro('fechada'); end if;
  perform pg_advisory_xact_lock(hashtextextended('alumia_decisao:' || d.id::text, 0));
  update alumia_decisoes set cancelada_em = now() where id = d.id returning * into d;
  delete from alumia_decisao_cedulas where decisao = d.id;
  delete from alumia_decisao_cifradas where decisao = d.id;
  delete from alumia_decisao_abertos where decisao = d.id;
  delete from alumia_decisao_votantes where decisao = d.id;
  return interno.alumia_dec_json(d, v);
end $$;

/** Confere tudo antes de um voto e entra na fila da votação (um voto por vez em cada uma). Devolve a votação. */
create or replace function interno.alumia_dec_antes_de_votar(p_id uuid, p_quem uuid) returns interno.alumia_decisoes language plpgsql security definer set search_path = interno, pg_temp as $$
declare d alumia_decisoes; v_imp text;
begin
  perform interno.rede3_perfil_exige_membro(p_quem);
  select * into d from alumia_decisoes where id = p_id;
  if not found or not (interno.rede2_na_comunidade(d.comunidade, p_quem) or interno.rede3_com_modera(d.comunidade, p_quem)) then
    perform interno.erro('nao_encontrado');
  end if;
  -- A urna regrava as cédulas: dois votos ao mesmo tempo se atropelariam. A trava não deixa marca em linha nenhuma.
  perform pg_advisory_xact_lock(hashtextextended('alumia_decisao:' || d.id::text, 0));
  v_imp := interno.alumia_dec_impedimento(d, p_quem);
  if v_imp = 'fechada' then perform interno.erro('fechada'); end if;
  if v_imp = 'ja_votou' then perform interno.erro('ja_votou'); end if;
  if v_imp is not null then perform interno.erro('sem_permissao'); end if;
  return d;
end $$;

/**
 * Votar sem cifra no aparelho. No modo aberto, é o caminho de sempre: o nome vai junto do voto. No secreto, só quando o servidor
 * do site não tem o segredo do voto (a tela pergunta antes): a cédula entra na urna do banco, regravada com as outras.
 * Nenhum freio por conta aqui: uma linha de freio com o id da pessoa na mesma transação do voto não serve para nada (um voto por
 * pessoa) e só deixaria mais um rastro.
 */
create or replace function public.alumia_decisao_votar(p_id uuid, p_opcao uuid) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); d alumia_decisoes;
begin
  d := interno.alumia_dec_antes_de_votar(p_id, v);
  if p_opcao is null or not exists (select 1 from alumia_decisao_opcoes o where o.id = p_opcao and o.decisao = d.id) then
    perform interno.erro('invalido:opcao');
  end if;
  insert into alumia_decisao_votantes (decisao, usuario) values (d.id, v) on conflict do nothing;
  if not found then perform interno.erro('ja_votou'); end if;
  if d.modo = 'aberta' then
    insert into alumia_decisao_abertos (decisao, opcao, usuario) values (d.id, p_opcao, v);
  else
    perform interno.alumia_dec_urna(d.id, p_opcao);
  end if;
  return jsonb_build_object('votei', true);
end $$;

/** Votar no modo secreto com a cédula cifrada no aparelho (o banco não lê a cédula: a que não abrir é nula na apuração). */
create or replace function public.alumia_decisao_votar_cifrada(p_id uuid, p_cedula text) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); d alumia_decisoes;
begin
  d := interno.alumia_dec_antes_de_votar(p_id, v);
  if d.modo <> 'secreta' then perform interno.erro('invalido:modo'); end if;
  if p_cedula is null or char_length(p_cedula) > 1600 or p_cedula !~ '^c1\.[A-Za-z0-9_-]{87}\.[A-Za-z0-9_-]{16}\.[A-Za-z0-9_-]{22,}$' then
    perform interno.erro('invalido:cedula');
  end if;
  insert into alumia_decisao_votantes (decisao, usuario) values (d.id, v) on conflict do nothing;
  if not found then perform interno.erro('ja_votou'); end if;
  perform interno.alumia_dec_urna_cifrada(d.id, p_cedula);
  return jsonb_build_object('votei', true);
end $$;

-- ── 5. As funções do servidor do site (só a chave de serviço) ───────────────────────────────────────────────────────────────

/** As cédulas cifradas de uma votação FECHADA, para o servidor abrir. Aberta ou cancelada: nada. */
create or replace function public.alumia_decisao_cifradas(p_id uuid) returns jsonb language plpgsql stable security definer set search_path = interno, pg_temp as $$
declare d alumia_decisoes;
begin
  if not interno.servico() then perform interno.erro('sem_permissao'); end if;
  select * into d from alumia_decisoes where id = p_id;
  if not found then perform interno.erro('nao_encontrado'); end if;
  if interno.alumia_dec_situacao(d) <> 'fechada' then return jsonb_build_object('fechada', false); end if;
  return jsonb_build_object('fechada', true,
    'cedulas', coalesce((select jsonb_agg(x.cedula) from alumia_decisao_cifradas x where x.decisao = d.id), '[]'::jsonb));
end $$;

/**
 * A apuração das cédulas cifradas de uma votação fechada. Recebe as escolhas abertas (cada uma, uma lista com UM id de opção, o
 * formato do ranking da consulta), já embaralhadas pelo servidor, e quantas cédulas ele abriu, que tem de bater com as que estão
 * no banco. A escolha que não vale é nula. As que valem entram na urna num INSERT só, junto com as que já estavam (regravadas, em
 * ordem sorteada), e as cifradas saem.
 */
create or replace function public.alumia_decisao_apurar(p_id uuid, p_escolhas jsonb, p_quantas integer) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare d alumia_decisoes; v_opcoes uuid[]; v_lista uuid[] := '{}'; e jsonb; v_o uuid; v_nulas integer := 0; v_ok integer := 0; v_tem integer;
begin
  if not interno.servico() then perform interno.erro('sem_permissao'); end if;
  select * into d from alumia_decisoes where id = p_id;
  if not found then perform interno.erro('nao_encontrado'); end if;
  if interno.alumia_dec_situacao(d) <> 'fechada' then perform interno.erro('aberta'); end if;
  perform pg_advisory_xact_lock(hashtextextended('alumia_decisao:' || d.id::text, 0));
  select count(*) into v_tem from alumia_decisao_cifradas where decisao = d.id;
  if v_tem = 0 then return jsonb_build_object('apuradas', 0, 'nulas', 0); end if;
  if p_quantas is distinct from v_tem or jsonb_typeof(p_escolhas) is distinct from 'array' or jsonb_array_length(p_escolhas) > v_tem then
    perform interno.erro('invalido:apuracao');
  end if;
  select array_agg(id) into v_opcoes from alumia_decisao_opcoes where decisao = d.id;
  for e in select value from jsonb_array_elements(p_escolhas) loop
    begin
      if jsonb_typeof(e) <> 'array' or jsonb_array_length(e) <> 1 then raise exception 'nula'; end if;
      v_o := (e ->> 0)::uuid;
      if v_o is null or not v_o = any (v_opcoes) then raise exception 'nula'; end if;
      v_lista := v_lista || v_o;
      v_ok := v_ok + 1;
    exception when others then
      v_nulas := v_nulas + 1;
    end;
  end loop;
  v_nulas := v_nulas + (v_tem - jsonb_array_length(p_escolhas));
  with velhas as (delete from alumia_decisao_cedulas where decisao = d.id returning opcao)
  insert into alumia_decisao_cedulas (decisao, opcao)
  select d.id, t.o from (select opcao as o from velhas union all select unnest(v_lista)) t order by gen_random_uuid();
  delete from alumia_decisao_cifradas where decisao = d.id;
  return jsonb_build_object('apuradas', v_ok, 'nulas', v_nulas);
end $$;

-- ── 6. Os números para a moderação ──────────────────────────────────────────────────────────────────────────────────────────

/** Um número só a partir de 3 (abaixo, nulo: a tela escreve "menos de 3"). Para contagens que não são de pessoas. */
create or replace function interno.alumia_dec_n(p_n bigint) returns integer language sql immutable as $$
  select case when p_n >= 3 then p_n::integer end
$$;

/**
 * Os números da comunidade, só para quem a modera. Por semana (segunda a domingo, no horário de São Paulo), as últimas 8, da mais
 * nova para a mais velha: posts e respostas novos, pessoas que entraram (e continuam), denúncias recebidas (sobre posts da
 * comunidade ou sobre a comunidade) e decididas, e o tempo até a primeira decisão registrada (mediana, em horas, com 3 decisões ou
 * mais). E agora: as denúncias ainda sem decisão e as votações abertas. Cada número só a partir de 3. Nenhuma pessoa.
 */
create or replace function public.alumia_decisao_numeros(p_slug text) returns jsonb language plpgsql stable security definer set search_path = interno, pg_temp as $$
declare v uuid := auth.uid(); c rede_comunidades; v_semanas jsonb := '[]'::jsonb; s date; a timestamptz; b timestamptz; i integer;
  v_posts bigint; v_resp bigint; v_membros bigint; v_den bigint; v_dec bigint; v_horas numeric; v_n_horas bigint;
begin
  c := interno.rede3_com_achar(p_slug);
  if c.slug is null then perform interno.erro('nao_encontrado'); end if;
  if not interno.rede3_com_modera(c.slug, v) then perform interno.erro('sem_permissao'); end if;
  for i in 0..7 loop
    s := interno.semana_atual() - (i * 7);
    a := s::timestamp at time zone 'America/Sao_Paulo';
    b := (s + 7)::timestamp at time zone 'America/Sao_Paulo';
    select count(*) filter (where p.resposta_a is null), count(*) filter (where p.resposta_a is not null) into v_posts, v_resp
    from rede_posts p where p.comunidade = c.slug and p.criado_em >= a and p.criado_em < b and p.repost_de is null;
    select count(*) into v_membros from rede_comunidade_membros m
    where m.comunidade = c.slug and m.situacao = 'ativo' and m.entrou_em >= a and m.entrou_em < b;
    with dn as (
      select x.id, x.situacao, x.criado_em from rede_denuncias x
      where x.criado_em >= a and x.criado_em < b
        and ((x.alvo_tipo = 'comunidade' and x.alvo = c.slug)
             or (x.alvo_tipo = 'post' and exists (select 1 from rede_posts p where p.id::text = x.alvo and p.comunidade = c.slug)))),
    tempos as (
      select extract(epoch from (min(m.criado_em) - dn.criado_em)) / 3600.0 as horas
      from dn join rede_moderacao m on m.denuncia = dn.id group by dn.id, dn.criado_em)
    select (select count(*) from dn), (select count(*) from dn where dn.situacao in ('resolvida', 'descartada')),
           (select count(*) from tempos), (select percentile_cont(0.5) within group (order by horas) from tempos)
      into v_den, v_dec, v_n_horas, v_horas;
    v_semanas := v_semanas || jsonb_build_array(jsonb_build_object(
      'semana', s,
      'posts', interno.alumia_dec_n(v_posts),
      'respostas', interno.alumia_dec_n(v_resp),
      'membros_novos', interno.alumia_pessoas(v_membros),
      'denuncias', interno.alumia_dec_n(v_den),
      'decididas', interno.alumia_dec_n(v_dec),
      'resposta_horas', case when v_n_horas >= 3 then round(v_horas::numeric, 1) end));
  end loop;
  return jsonb_build_object('comunidade', c.slug, 'semanas', v_semanas,
    'denuncias_abertas', interno.alumia_dec_n((select count(*) from rede_denuncias x
      where x.situacao in ('aberta', 'em_analise')
        and ((x.alvo_tipo = 'comunidade' and x.alvo = c.slug)
             or (x.alvo_tipo = 'post' and exists (select 1 from rede_posts p where p.id::text = x.alvo and p.comunidade = c.slug))))),
    'votacoes_abertas', (select count(*) from alumia_decisoes d where d.comunidade = c.slug and d.cancelada_em is null and d.prazo > now()));
end $$;

-- ── 7. Quem chama o quê ─────────────────────────────────────────────────────────────────────────────────────────────────────

revoke all on function interno.alumia_dec_urna(uuid, uuid), interno.alumia_dec_urna_cifrada(uuid, text), interno.alumia_dec_situacao(interno.alumia_decisoes),
  interno.alumia_dec_impedimento(interno.alumia_decisoes, uuid), interno.alumia_dec_json(interno.alumia_decisoes, uuid),
  interno.alumia_dec_antes_de_votar(uuid, uuid), interno.alumia_dec_n(bigint) from public;
revoke all on function public.alumia_decisao_lista(text), public.alumia_decisao_criar(text, jsonb), public.alumia_decisao_cancelar(uuid),
  public.alumia_decisao_votar(uuid, uuid), public.alumia_decisao_votar_cifrada(uuid, text), public.alumia_decisao_numeros(text),
  public.alumia_decisao_cifradas(uuid), public.alumia_decisao_apurar(uuid, jsonb, integer) from public;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on function interno.alumia_dec_urna(uuid, uuid), interno.alumia_dec_urna_cifrada(uuid, text), interno.alumia_dec_situacao(interno.alumia_decisoes),
      interno.alumia_dec_impedimento(interno.alumia_decisoes, uuid), interno.alumia_dec_json(interno.alumia_decisoes, uuid),
      interno.alumia_dec_antes_de_votar(uuid, uuid), interno.alumia_dec_n(bigint) from anon, authenticated;
    revoke all on function public.alumia_decisao_lista(text), public.alumia_decisao_criar(text, jsonb), public.alumia_decisao_cancelar(uuid),
      public.alumia_decisao_votar(uuid, uuid), public.alumia_decisao_votar_cifrada(uuid, text), public.alumia_decisao_numeros(text),
      public.alumia_decisao_cifradas(uuid), public.alumia_decisao_apurar(uuid, jsonb, integer) from anon, authenticated;
    grant execute on function public.alumia_decisao_lista(text), public.alumia_decisao_criar(text, jsonb), public.alumia_decisao_cancelar(uuid),
      public.alumia_decisao_votar(uuid, uuid), public.alumia_decisao_votar_cifrada(uuid, text), public.alumia_decisao_numeros(text) to authenticated, service_role;
    grant execute on function public.alumia_decisao_cifradas(uuid), public.alumia_decisao_apurar(uuid, jsonb, integer) to service_role;
  end if;
end $$;

select interno.alumia_trancar();
