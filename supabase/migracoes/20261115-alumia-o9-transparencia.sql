-- Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
--
-- Alumia · Onda 9 · frente 9E (rótulos e transparência): o relatório de transparência público e os rótulos e listas de bloqueio
-- assináveis. As telas estão em components/rede/protecao/TelaDaTransparencia.tsx (/alumia/transparencia) e em
-- components/rede/rotulos/** (/alumia/rotulos, a tarja no cartão e o bloco do painel de controle); o texto em i18n/rede/rotulos;
-- o que cada número quer dizer, em docs/rede/TRANSPARENCIA.md.
--
--   1. Relatório de transparência, por trimestre, só com números agregados: denúncias recebidas e decididas por tipo, posts
--      tirados, contas suspensas, banidas e retidas, redes barradas, recursos e quantos foram revertidos, rótulos contestados e
--      revertidos e os pedidos de órgão público. Número abaixo de 3 sai como "menos_de_3" (nunca 1 ou 2); onde total e partes
--      se somam, o número vizinho que deixaria deduzir um pequeno pela subtração sai como "reservado". O trimestre sai 15 dias
--      depois de acabar (tempo de decidir o que chegou no fim dele) e, na primeira leitura, os números da moderação ficam
--      gravados e não mudam mais (alumia_transp_trimestres, só inserção): apagar uma conta ou a faxina das denúncias antigas não
--      reescreve um relatório publicado. Os pedidos de autoridade continuam contados na hora (a coordenação registra com a data
--      em que o pedido chegou, e um registro atrasado ainda aparece no trimestre certo).
--   2. Pedidos de autoridade: a coordenação registra o tipo de órgão, o que foi pedido, o que respondeu e quantas contas o pedido
--      alcançava. Sem número de processo, sem nome, sem texto livre: o relatório mostra só números e tipos.
--   3. O aviso de ordem sigilosa (canário): a coordenação renova a frase "até <data>, não recebemos ordem sigilosa"; sem renovar
--      em 90 dias, a página diz que não foi renovado. Cada renovação é uma linha nova (só inserção): ninguém volta a data.
--   4. Rótulos assináveis (L3-21, com a troca registrada no backlog): só organização com selo ou a mediação rotula; a lista de
--      rótulos é fechada e escrita; o rótulo só existe para quem assina aquele rotulador (não aparece no perfil, na busca nem para
--      quem não assina); quem assina escolhe o efeito ("avisar": tarja no cartão; "esconder": é a lista de bloqueio assinável, os
--      posts marcados e os das contas marcadas saem da linha de quem assina); quem foi marcado é avisado, vê a marca e o motivo e
--      contesta, e outra pessoa da mediação decide (nunca quem marcou); cada marca fica no registro só inserção; nada é removido
--      por um rótulo; quem assina não aparece para ninguém, nem como número.
--
-- Nenhum endereço de rede é guardado. Nada aqui devolve lista de quem denunciou, de quem assina um rotulador ou de quem foi
-- marcado, a não ser ao próprio rotulador (as marcas que ele mesmo pôs) e à mediação (as contestações).
-- Pode rodar mais de uma vez, sem apagar dado nenhum. Roda depois de 20261114-alumia-onda8-fim.sql.
-- Teste: scripts/testar-alumia-o9-transparencia.mjs.
--
-- Para quem junta: interno.alumia_rotulo_esconde(post, quem) é o efeito "esconder"; ele entra em interno.rede_silenciado (o
-- mesmo lugar da soneca de pessoa e de palavra), composto com as funções das frentes 9A e 9D, sem redefinir rede_ve.

-- ── 1. Transparência: tabelas ─────────────────────────────────────────────────────────────────────────────────────────────

-- Um pedido de órgão público. Só tipos: nada que identifique o processo, a pessoa ou a conta.
create table if not exists interno.alumia_transp_pedidos (
  id uuid primary key default gen_random_uuid(),
  recebido_em date not null check (recebido_em >= date '2026-01-01'),
  orgao text not null check (orgao in ('judiciario', 'policia', 'ministerio_publico', 'eleitoral', 'administrativo', 'estrangeiro', 'outro')),
  pedido text not null check (pedido in ('dados_de_conta', 'identificar_autor', 'retirar_conteudo', 'preservar_dados', 'outro')),
  resposta text not null default 'em_analise' check (resposta in ('em_analise', 'atendido', 'atendido_em_parte', 'recusado', 'sem_dados')),
  -- Quantas contas o pedido alcançava (0 quando não era sobre conta). Só entra somado, e a soma só a partir de 3.
  contas integer not null default 0 check (contas between 0 and 100000),
  respondido_em date,
  registrado_por uuid references interno.perfis (id) on delete set null,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  check (respondido_em is null or respondido_em >= recebido_em),
  check ((resposta = 'em_analise') = (respondido_em is null))
);
create index if not exists alumia_transp_pedidos_data on interno.alumia_transp_pedidos (recebido_em);

-- Cada renovação do aviso de ordem sigilosa. Só inserção.
create table if not exists interno.alumia_transp_canario (
  id bigint generated always as identity primary key,
  renovado_em timestamptz not null default now(),
  por uuid
);

-- Os números da moderação de um trimestre, gravados na primeira leitura depois de publicado. Só inserção.
create table if not exists interno.alumia_transp_trimestres (
  inicio date primary key check (extract(day from inicio) = 1 and extract(month from inicio) in (1, 4, 7, 10)),
  numeros jsonb not null,
  fechado_em timestamptz not null default now()
);

create or replace function interno.alumia_transp_so_insercao() returns trigger language plpgsql as $$
begin
  raise exception 'O relatório de transparência e o aviso de ordem sigilosa não se alteram nem se apagam.' using errcode = 'P0001';
end $$;
drop trigger if exists alumia_transp_so_insercao on interno.alumia_transp_canario;
create trigger alumia_transp_so_insercao before update or delete on interno.alumia_transp_canario for each row execute function interno.alumia_transp_so_insercao();
drop trigger if exists alumia_transp_so_insercao_truncate on interno.alumia_transp_canario;
create trigger alumia_transp_so_insercao_truncate before truncate on interno.alumia_transp_canario for each statement execute function interno.alumia_transp_so_insercao();
drop trigger if exists alumia_transp_so_insercao on interno.alumia_transp_trimestres;
create trigger alumia_transp_so_insercao before update or delete on interno.alumia_transp_trimestres for each row execute function interno.alumia_transp_so_insercao();
drop trigger if exists alumia_transp_so_insercao_truncate on interno.alumia_transp_trimestres;
create trigger alumia_transp_so_insercao_truncate before truncate on interno.alumia_transp_trimestres for each statement execute function interno.alumia_transp_so_insercao();

-- ── 2. Rótulos: tabelas ───────────────────────────────────────────────────────────────────────────────────────────────────

-- Quem rotula: uma organização com selo (que abriu o serviço e escreveu as regras dela) ou a mediação do Instituto (uma linha só).
create table if not exists interno.alumia_rotuladores (
  id uuid primary key default gen_random_uuid(),
  tipo text not null check (tipo in ('org', 'mediacao')),
  org uuid unique references interno.rede_orgs (perfil) on delete cascade,
  -- As regras escritas da organização: quando ela marca e o que cada rótulo quer dizer para ela. A da mediação está no texto da tela.
  regras text not null default '' check (char_length(regras) <= 1500),
  aberto boolean not null default true,
  criado_em timestamptz not null default now(),
  check ((tipo = 'org') = (org is not null)),
  check (tipo = 'mediacao' or char_length(regras) >= 40)
);
create unique index if not exists alumia_rotuladores_mediacao on interno.alumia_rotuladores (tipo) where tipo = 'mediacao';
insert into interno.alumia_rotuladores (tipo) select 'mediacao' where not exists (select 1 from interno.alumia_rotuladores where tipo = 'mediacao');

-- Uma marca: num perfil ou num post, com um rótulo da lista fechada e o motivo (que quem foi marcado lê).
create table if not exists interno.alumia_rotulos (
  id uuid primary key default gen_random_uuid(),
  rotulador uuid not null references interno.alumia_rotuladores (id) on delete cascade,
  perfil uuid references interno.perfis (id) on delete cascade,
  post uuid references interno.rede_posts (id) on delete cascade,
  rotulo text not null check (rotulo in ('assedio_coordenado', 'golpe', 'spam', 'perfil_falso', 'discurso_de_odio')),
  motivo text not null check (char_length(motivo) between 10 and 500),
  quem uuid references interno.perfis (id) on delete set null,
  situacao text not null default 'vale' check (situacao in ('vale', 'contestado', 'retirado', 'revertido')),
  contestacao text check (contestacao is null or char_length(contestacao) between 10 and 1000),
  contestado_em timestamptz,
  decidido_em timestamptz,
  decidido_por uuid references interno.perfis (id) on delete set null,
  decisao text check (decisao is null or char_length(decisao) <= 500),
  criado_em timestamptz not null default now(),
  check ((perfil is null) <> (post is null))
);
create unique index if not exists alumia_rotulos_um on interno.alumia_rotulos (rotulador, coalesce(perfil, post), rotulo) where situacao in ('vale', 'contestado');
create index if not exists alumia_rotulos_perfil on interno.alumia_rotulos (perfil) where situacao in ('vale', 'contestado') and perfil is not null;
create index if not exists alumia_rotulos_post on interno.alumia_rotulos (post) where situacao in ('vale', 'contestado') and post is not null;
create index if not exists alumia_rotulos_fila on interno.alumia_rotulos (contestado_em) where situacao = 'contestado';

-- Quem assina qual rotulador e com que efeito. Nunca volta a ninguém além da própria pessoa.
create table if not exists interno.alumia_rotulos_assinaturas (
  usuario uuid not null references interno.perfis (id) on delete cascade,
  rotulador uuid not null references interno.alumia_rotuladores (id) on delete cascade,
  efeito text not null default 'avisar' check (efeito in ('avisar', 'esconder')),
  criado_em timestamptz not null default now(),
  primary key (usuario, rotulador)
);

-- O registro das marcas: quem marcou, retirou, contestou e decidiu. Só inserção; sem chave estrangeira (apagar uma conta não
-- reescreve o registro) e sem o alvo (a marca, enquanto existe, diz o alvo; apagada a conta marcada, o registro não guarda quem era).
create table if not exists interno.alumia_rotulos_registro (
  id bigint generated always as identity primary key,
  marca uuid not null,
  rotulador uuid not null,
  rotulo text not null,
  acao text not null check (acao in ('marcar', 'retirar', 'contestar', 'manter', 'reverter')),
  quem uuid,
  motivo text not null default '' check (char_length(motivo) <= 1000),
  criado_em timestamptz not null default now()
);
create index if not exists alumia_rotulos_registro_tempo on interno.alumia_rotulos_registro (criado_em);
drop trigger if exists alumia_rotulos_registro_so_insercao on interno.alumia_rotulos_registro;
create trigger alumia_rotulos_registro_so_insercao before update or delete on interno.alumia_rotulos_registro for each row execute function interno.alumia_transp_so_insercao();
drop trigger if exists alumia_rotulos_registro_so_insercao_truncate on interno.alumia_rotulos_registro;
create trigger alumia_rotulos_registro_so_insercao_truncate before truncate on interno.alumia_rotulos_registro for each statement execute function interno.alumia_transp_so_insercao();

do $$
declare t text;
begin
  foreach t in array array['alumia_transp_pedidos', 'alumia_transp_canario', 'alumia_transp_trimestres', 'alumia_rotuladores', 'alumia_rotulos',
                           'alumia_rotulos_assinaturas', 'alumia_rotulos_registro'] loop
    execute format('alter table interno.%I enable row level security', t);
    execute format('revoke all on table interno.%I from public', t);
    if exists (select 1 from pg_roles where rolname = 'anon') then
      execute format('revoke all on table interno.%I from anon, authenticated', t);
    end if;
  end loop;
end $$;

-- ── 3. Transparência: contagens ───────────────────────────────────────────────────────────────────────────────────────────

/** Um número para o relatório: de 3 em diante, o número; abaixo disso (inclusive zero), "menos_de_3". */
create or replace function interno.alumia_transp_n(p bigint) returns jsonb language sql immutable as $$
  select case when coalesce(p, 0) >= 3 then to_jsonb(p) else to_jsonb('menos_de_3'::text) end
$$;

/** O começo de um dia em São Paulo, como instante. */
create or replace function interno.alumia_transp_instante(p date) returns timestamptz language sql immutable as $$
  select p::timestamp at time zone 'America/Sao_Paulo'
$$;

drop function if exists interno.alumia_transp_proteger(bigint[], boolean[], integer[]);
/**
 * A supressão complementar: o relatório publica totais e partes (recebidas = soma por tipo; decididas = procedentes + descartadas),
 * e um número escondido como "menos_de_3" sairia pela subtração quando todo o resto do grupo aparece. Recebe os valores, quais
 * deles a página publica (os outros, como "abertas", são partes que nunca aparecem), os grupos (cada linha: o total e as partes,
 * completada com 0) e quais números não podem sair pela conta quando são 1 ou 2 (sem a lista: os publicados). Começa escondendo o
 * que é menor que 3 e repete: se algum desses números de 1 ou 2 ainda se deduz pelas contas dos grupos (em cadeia), esconde também
 * a menor parte à mostra do grupo que o entregou (ou o total dele). Devolve quem fica escondido. Zero que se deduz não aponta para
 * ninguém e pode sair pela conta.
 */
create or replace function interno.alumia_transp_proteger(p_vals bigint[], p_pub boolean[], p_grupos integer[], p_sens boolean[] default null) returns boolean[] language plpgsql immutable set search_path = interno, pg_temp as $$
declare
  n integer := coalesce(array_length(p_vals, 1), 0);
  ng integer := coalesce(array_length(p_grupos, 1), 0);
  lg integer := coalesce(array_length(p_grupos, 2), 0);
  esc boolean[]; sabido boolean[]; origem integer[];
  g integer; i integer; j integer; k integer; faltam integer; ult integer; mudou boolean; sensivel integer; alvo integer; menor bigint;
begin
  if n = 0 then return '{}'::boolean[]; end if;
  esc := array_fill(false, array[n]);
  for i in 1..n loop
    esc[i] := not coalesce(p_pub[i], false) or coalesce(p_vals[i], 0) < 3;
  end loop;
  loop
    sabido := array_fill(false, array[n]);
    origem := array_fill(0, array[n]);
    for i in 1..n loop sabido[i] := not esc[i]; end loop;
    mudou := true;
    while mudou loop
      mudou := false;
      for g in 1..ng loop
        faltam := 0; ult := 0;
        for j in 1..lg loop
          k := p_grupos[g][j];
          continue when k is null or k = 0;
          if not sabido[k] then faltam := faltam + 1; ult := k; end if;
        end loop;
        if faltam = 1 then sabido[ult] := true; origem[ult] := g; mudou := true; end if;
      end loop;
    end loop;
    sensivel := 0;
    for i in 1..n loop
      if esc[i] and sabido[i] and coalesce(p_vals[i], 0) between 1 and 2 and coalesce(p_sens[i], p_pub[i], false) then sensivel := i; exit; end if;
    end loop;
    exit when sensivel = 0;
    alvo := 0; menor := null; g := origem[sensivel];
    for j in 2..lg loop
      k := p_grupos[g][j];
      continue when k is null or k = 0 or k = sensivel or esc[k];
      if menor is null or p_vals[k] < menor then menor := p_vals[k]; alvo := k; end if;
    end loop;
    if alvo = 0 and p_grupos[g][1] <> sensivel and not esc[p_grupos[g][1]] then alvo := p_grupos[g][1]; end if;
    if alvo = 0 then
      for i in 1..n loop
        if not esc[i] and (menor is null or p_vals[i] < menor) then menor := p_vals[i]; alvo := i; end if;
      end loop;
    end if;
    exit when alvo = 0;
    esc[alvo] := true;
  end loop;
  return esc;
end $$;

/**
 * Um número do relatório depois da supressão: à mostra, o número; escondido e menor que 3, "menos_de_3"; escondido para não
 * entregar um vizinho pequeno (3 ou mais), "reservado".
 */
create or replace function interno.alumia_transp_m(p bigint, p_esc boolean) returns jsonb language sql immutable as $$
  select case when not coalesce(p_esc, true) and coalesce(p, 0) >= 3 then to_jsonb(p)
              when coalesce(p, 0) < 3 then to_jsonb('menos_de_3'::text)
              else to_jsonb('reservado'::text) end
$$;

/** Uma linha de grupo para interno.alumia_transp_proteger: o total, as partes e zeros até a largura. */
create or replace function interno.alumia_transp_linha(p_total integer, p_partes integer[], p_largura integer) returns integer[] language sql immutable as $$
  select array_cat(array[p_total] || p_partes, array_fill(0, array[greatest(p_largura - 1 - coalesce(cardinality(p_partes), 0), 0)]))
$$;

/**
 * Os números da moderação do trimestre que começa em p_inicio (de p_inicio até o dia anterior a p_inicio + 3 meses, na hora de
 * São Paulo). Tudo agregado; número abaixo de 3 sai como "menos_de_3" e, onde total e partes se somam (denúncias e recursos),
 * passa pela supressão complementar (interno.alumia_transp_proteger). Contas são contadas uma vez por trimestre em cada linha.
 */
create or replace function interno.alumia_transp_contar(p_inicio date) returns jsonb language plpgsql stable security definer set search_path = interno, pg_temp as $$
declare
  a timestamptz := interno.alumia_transp_instante(p_inicio);
  b timestamptz := interno.alumia_transp_instante((p_inicio + interval '3 months')::date);
  v_cats text[] := array['menores', 'ameaca', 'exposicao', 'violencia', 'autolesao', 'odio', 'assedio', 'golpe', 'spam', 'ilegal', 'outro'];
  nc integer := 11;
  -- Denúncias: 1 recebidas, 2 decididas, 3 procedentes, 4 descartadas, 5 abertas (nunca sai); por tipo, a partir de 6, três
  -- números por tipo: recebidas, decididas e abertas (esta nunca sai).
  dv bigint[]; dp boolean[]; dg integer[]; de boolean[];
  v_rec bigint; v_dec bigint; v_pro bigint; v_des bigint; v_tr bigint; v_td bigint; c integer; base integer;
  v_recs integer[] := '{}'; v_decs integer[] := '{}'; v_abs integer[] := '{}';
  v_tipo jsonb := '{}'::jsonb;
  -- Recursos: 1 recebidos, 2 decididos, 3 revertidos, 4 abertos e 5 decididos sem reverter (estes dois nunca saem; o quinto, que é
  -- uma decisão, também não pode sair pela conta quando é 1 ou 2).
  rv bigint[]; re boolean[];
begin
  select count(*), count(*) filter (where d.situacao in ('resolvida', 'descartada')), count(*) filter (where d.situacao = 'resolvida'),
         count(*) filter (where d.situacao = 'descartada')
    into v_rec, v_dec, v_pro, v_des
  from rede_denuncias d where d.criado_em >= a and d.criado_em < b;
  dv := array[v_rec, v_dec, v_pro, v_des, v_rec - v_dec];
  dp := array[true, true, true, true, false];
  for c in 1..nc loop
    select count(*), count(*) filter (where x.situacao in ('resolvida', 'descartada')) into v_tr, v_td
    from rede_denuncias x where x.categoria = v_cats[c] and x.criado_em >= a and x.criado_em < b;
    base := 6 + (c - 1) * 3;
    dv := dv || array[v_tr, v_td, v_tr - v_td];
    dp := dp || array[true, true, false];
    v_recs := v_recs || base; v_decs := v_decs || (base + 1); v_abs := v_abs || (base + 2);
  end loop;
  dg := array[interno.alumia_transp_linha(1, array[2, 5], nc + 1)];
  dg := dg || array[interno.alumia_transp_linha(2, array[3, 4], nc + 1)];
  dg := dg || array[interno.alumia_transp_linha(1, v_recs, nc + 1)];
  dg := dg || array[interno.alumia_transp_linha(2, v_decs, nc + 1)];
  dg := dg || array[interno.alumia_transp_linha(5, v_abs, nc + 1)];
  for c in 1..nc loop
    base := 6 + (c - 1) * 3;
    dg := dg || array[interno.alumia_transp_linha(base, array[base + 1, base + 2], nc + 1)];
  end loop;
  de := interno.alumia_transp_proteger(dv, dp, dg);
  for c in 1..nc loop
    base := 6 + (c - 1) * 3;
    v_tipo := v_tipo || jsonb_build_object(v_cats[c], jsonb_build_object(
      'recebidas', interno.alumia_transp_m(dv[base], de[base]), 'decididas', interno.alumia_transp_m(dv[base + 1], de[base + 1])));
  end loop;

  select array[count(*), count(*) filter (where r.situacao <> 'aberto'), count(*) filter (where r.situacao = 'revertido'),
               count(*) filter (where r.situacao = 'aberto'), count(*) filter (where r.situacao not in ('aberto', 'revertido'))]
    into rv
  from rede_recursos r where r.criado_em >= a and r.criado_em < b;
  re := interno.alumia_transp_proteger(rv, array[true, true, true, false, false], array[array[1, 2, 4], array[2, 3, 5]], array[true, true, true, false, true]);

  return jsonb_build_object(
    'denuncias', jsonb_build_object(
      'recebidas', interno.alumia_transp_m(dv[1], de[1]),
      'decididas', interno.alumia_transp_m(dv[2], de[2]),
      'procedentes', interno.alumia_transp_m(dv[3], de[3]),
      'descartadas', interno.alumia_transp_m(dv[4], de[4]),
      'por_tipo', v_tipo),
    'posts_tirados', interno.alumia_transp_n((select count(distinct m.alvo) from rede_moderacao m
      where m.acao = 'remover' and m.alvo_tipo = 'post' and m.criado_em >= a and m.criado_em < b)),
    'contas', jsonb_build_object(
      'suspensas', interno.alumia_transp_n((select count(*) from (
          select s.usuario::text as conta from alumia_sancoes s where s.tipo = 'suspensao' and s.criado_em >= a and s.criado_em < b
          union
          select m.alvo from rede_moderacao m where m.acao = 'suspender' and m.alvo_tipo = 'perfil' and m.regra <> 'painel' and m.criado_em >= a and m.criado_em < b) x)),
      'banidas', interno.alumia_transp_n((select count(*) from (
          select s.usuario::text as conta from alumia_sancoes s where s.tipo = 'banimento' and s.criado_em >= a and s.criado_em < b
          union
          select m.alvo from rede_moderacao m where m.acao = 'banir' and m.alvo_tipo = 'perfil' and m.criado_em >= a and m.criado_em < b) x)),
      'retidas', interno.alumia_transp_n((select count(distinct m.alvo) from rede_moderacao m
        where m.acao = 'reter' and m.alvo_tipo = 'perfil' and m.criado_em >= a and m.criado_em < b)),
      'redes_barradas', interno.alumia_transp_n((select count(*) from alumia_sancoes s where s.tipo = 'rede' and s.criado_em >= a and s.criado_em < b))),
    'recursos', jsonb_build_object(
      'recebidos', interno.alumia_transp_m(rv[1], re[1]),
      'decididos', interno.alumia_transp_m(rv[2], re[2]),
      'revertidos', interno.alumia_transp_m(rv[3], re[3])),
    'rotulos', (
      select jsonb_build_object(
        'marcas', interno.alumia_transp_n(count(*) filter (where g.acao = 'marcar')),
        'contestadas', interno.alumia_transp_n(count(*) filter (where g.acao = 'contestar')),
        'revertidas', interno.alumia_transp_n(count(*) filter (where g.acao = 'reverter')))
      from alumia_rotulos_registro g where g.criado_em >= a and g.criado_em < b));
end $$;

/**
 * Os pedidos de órgão público que chegaram no trimestre: total e por tipo de órgão, de pedido e de resposta (contados na hora).
 * Os três cortes somam o total e passam pela supressão complementar: "1 pedido da polícia" não sai pela subtração.
 */
create or replace function interno.alumia_transp_autoridade(p_inicio date) returns jsonb language plpgsql stable security definer set search_path = interno, pg_temp as $$
declare
  v_ate date := (p_inicio + interval '3 months')::date;
  v_orgaos text[] := array['judiciario', 'policia', 'ministerio_publico', 'eleitoral', 'administrativo', 'estrangeiro', 'outro'];
  v_pedidos text[] := array['dados_de_conta', 'identificar_autor', 'retirar_conteudo', 'preservar_dados', 'outro'];
  v_respostas text[] := array['em_analise', 'atendido', 'atendido_em_parte', 'recusado', 'sem_dados'];
  -- 1 o total; depois os órgãos, os pedidos e as respostas, cada corte seguido de um "resto" que nunca sai (o que não está na lista).
  v bigint[]; pub boolean[]; esc boolean[]; grupos integer[]; parte integer[];
  v_total bigint; v_contas bigint; v_soma bigint; o text; io integer; ip integer; ir integer; k integer; largura integer := 9;
  ro jsonb := '{}'::jsonb; rp jsonb := '{}'::jsonb; rr jsonb := '{}'::jsonb;
begin
  select count(*), coalesce(sum(x.contas), 0) into v_total, v_contas from alumia_transp_pedidos x where x.recebido_em >= p_inicio and x.recebido_em < v_ate;
  v := array[v_total]; pub := array[true];
  io := 2; v_soma := 0;
  foreach o in array v_orgaos loop
    v := v || (select count(*) from alumia_transp_pedidos x where x.recebido_em >= p_inicio and x.recebido_em < v_ate and x.orgao = o);
    pub := pub || true; v_soma := v_soma + v[cardinality(v)];
  end loop;
  v := v || (v_total - v_soma); pub := pub || false;
  ip := cardinality(v) + 1; v_soma := 0;
  foreach o in array v_pedidos loop
    v := v || (select count(*) from alumia_transp_pedidos x where x.recebido_em >= p_inicio and x.recebido_em < v_ate and x.pedido = o);
    pub := pub || true; v_soma := v_soma + v[cardinality(v)];
  end loop;
  v := v || (v_total - v_soma); pub := pub || false;
  ir := cardinality(v) + 1; v_soma := 0;
  foreach o in array v_respostas loop
    v := v || (select count(*) from alumia_transp_pedidos x where x.recebido_em >= p_inicio and x.recebido_em < v_ate and x.resposta = o);
    pub := pub || true; v_soma := v_soma + v[cardinality(v)];
  end loop;
  v := v || (v_total - v_soma); pub := pub || false;
  parte := '{}'; for k in io..io + cardinality(v_orgaos) loop parte := parte || k; end loop;
  grupos := array[interno.alumia_transp_linha(1, parte, largura)];
  parte := '{}'; for k in ip..ip + cardinality(v_pedidos) loop parte := parte || k; end loop;
  grupos := grupos || array[interno.alumia_transp_linha(1, parte, largura)];
  parte := '{}'; for k in ir..ir + cardinality(v_respostas) loop parte := parte || k; end loop;
  grupos := grupos || array[interno.alumia_transp_linha(1, parte, largura)];
  esc := interno.alumia_transp_proteger(v, pub, grupos);
  for k in 1..cardinality(v_orgaos) loop ro := ro || jsonb_build_object(v_orgaos[k], interno.alumia_transp_m(v[io + k - 1], esc[io + k - 1])); end loop;
  for k in 1..cardinality(v_pedidos) loop rp := rp || jsonb_build_object(v_pedidos[k], interno.alumia_transp_m(v[ip + k - 1], esc[ip + k - 1])); end loop;
  for k in 1..cardinality(v_respostas) loop rr := rr || jsonb_build_object(v_respostas[k], interno.alumia_transp_m(v[ir + k - 1], esc[ir + k - 1])); end loop;
  return jsonb_build_object('recebidos', interno.alumia_transp_m(v[1], esc[1]), 'contas', interno.alumia_transp_n(v_contas),
                            'por_orgao', ro, 'por_pedido', rp, 'por_resposta', rr);
end $$;

/** O prazo do aviso de ordem sigilosa: 90 dias (o mesmo de components/rede/rotulos/regras.ts). */
create or replace function interno.alumia_transp_canario_prazo() returns interval language sql immutable as $$ select interval '90 days' $$;

/** O aviso de ordem sigilosa como a página mostra: a data da última renovação, até quando vale e se venceu. */
create or replace function interno.alumia_transp_canario_json() returns jsonb language sql stable security definer set search_path = interno, pg_temp as $$
  select case when c.id is null then jsonb_build_object('renovado_em', null, 'vence_em', null, 'vencido', true)
         else jsonb_build_object('renovado_em', c.renovado_em, 'vence_em', c.renovado_em + interno.alumia_transp_canario_prazo(),
                                 'vencido', now() > c.renovado_em + interno.alumia_transp_canario_prazo()) end
  from (select 1) um left join lateral (select * from alumia_transp_canario order by renovado_em desc, id desc limit 1) c on true
$$;

/** O primeiro trimestre da Alumia (o relatório começa nele). */
create or replace function interno.alumia_transp_comeco() returns date language sql immutable as $$ select date '2026-10-01' $$;

/** Quantos dias depois do fim do trimestre o relatório dele sai (o mesmo de components/rede/rotulos/regras.ts). */
create or replace function interno.alumia_transp_folga() returns interval language sql immutable as $$ select interval '15 days' $$;

/**
 * O relatório como ele estava num dia (p_hoje): grava os trimestres que já podem sair e ainda não foram gravados, e devolve os 12
 * mais recentes, com os pedidos de autoridade de cada um, a data do próximo e o aviso de ordem sigilosa. Separada da pública só
 * para o teste poder pedir "o relatório em 20 de janeiro".
 */
create or replace function interno.alumia_transp_relatorio(p_hoje date) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare s date := interno.alumia_transp_comeco();
begin
  while (s + interval '3 months' - interval '1 day' + interno.alumia_transp_folga())::date <= p_hoje loop
    if not exists (select 1 from alumia_transp_trimestres t where t.inicio = s) then
      insert into alumia_transp_trimestres (inicio, numeros) values (s, interno.alumia_transp_contar(s)) on conflict (inicio) do nothing;
    end if;
    s := (s + interval '3 months')::date;
  end loop;
  return jsonb_build_object(
    'trimestres', coalesce((select jsonb_agg(jsonb_build_object(
        'inicio', t.inicio, 'fim', (t.inicio + interval '3 months' - interval '1 day')::date, 'fechado_em', t.fechado_em,
        'numeros', t.numeros, 'autoridade', interno.alumia_transp_autoridade(t.inicio)) order by t.inicio desc)
      from (select * from alumia_transp_trimestres x where x.inicio < s order by x.inicio desc limit 12) t), '[]'::jsonb),
    'proximo', jsonb_build_object('inicio', s, 'fim', (s + interval '3 months' - interval '1 day')::date,
                                  'sai_em', (s + interval '3 months' - interval '1 day' + interno.alumia_transp_folga())::date),
    'canario', interno.alumia_transp_canario_json());
end $$;

/**
 * O relatório de transparência, para qualquer pessoa (com ou sem conta, também com a entrada fechada: fica fora da porta). Só
 * números agregados, por trimestre, a partir de 3 (abaixo: "menos_de_3").
 */
create or replace function public.alumia_transparencia() returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
begin
  return interno.alumia_transp_relatorio((now() at time zone 'America/Sao_Paulo')::date);
end $$;

-- ── 4. Transparência: o painel da coordenação ─────────────────────────────────────────────────────────────────────────────

/** Os pedidos registrados (os 200 mais recentes) e o aviso, com as últimas renovações. Só a coordenação. */
create or replace function public.alumia_transp_painel() returns jsonb language plpgsql stable security definer set search_path = interno, pg_temp as $$
begin
  perform interno.alumia_painel_exige(true);
  return jsonb_build_object(
    'pedidos', coalesce((select jsonb_agg(jsonb_build_object('id', p.id, 'recebido_em', p.recebido_em, 'orgao', p.orgao, 'pedido', p.pedido,
        'resposta', p.resposta, 'contas', p.contas, 'respondido_em', p.respondido_em, 'criado_em', p.criado_em, 'atualizado_em', p.atualizado_em)
        order by p.recebido_em desc, p.criado_em desc)
      from (select * from alumia_transp_pedidos order by recebido_em desc, criado_em desc limit 200) p), '[]'::jsonb),
    'canario', interno.alumia_transp_canario_json(),
    'renovacoes', coalesce((select jsonb_agg(jsonb_build_object('renovado_em', c.renovado_em, 'por', interno.alumia_painel_quem(c.por)) order by c.renovado_em desc)
      from (select * from alumia_transp_canario order by renovado_em desc, id desc limit 10) c), '[]'::jsonb));
end $$;

/**
 * Registra um pedido de órgão público (p_id nulo) ou corrige um já registrado (a resposta muda quando a coordenação responde).
 * Não se apaga: um pedido some do relatório só se nunca tiver existido. Cada gravação vai para o registro do painel.
 */
create or replace function public.alumia_transp_pedido_salvar(p_id uuid, p jsonb) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare
  v_recebido date; v_resposta text := coalesce(nullif(p ->> 'resposta', ''), 'em_analise'); v_respondido date; v_contas integer;
  x alumia_transp_pedidos;
begin
  perform interno.alumia_painel_exige(true);
  perform interno.limite('alumia_transp_pedido', 60, 60);
  begin
    v_recebido := (p ->> 'recebido_em')::date;
    v_respondido := nullif(p ->> 'respondido_em', '')::date;
    v_contas := coalesce(nullif(p ->> 'contas', '')::integer, 0);
  exception when others then
    perform interno.erro('invalido:data');
  end;
  if v_recebido is null or v_recebido > (now() at time zone 'America/Sao_Paulo')::date or v_recebido < date '2026-01-01' then perform interno.erro('invalido:data'); end if;
  if coalesce(p ->> 'orgao', '') not in ('judiciario', 'policia', 'ministerio_publico', 'eleitoral', 'administrativo', 'estrangeiro', 'outro') then perform interno.erro('invalido:orgao'); end if;
  if coalesce(p ->> 'pedido', '') not in ('dados_de_conta', 'identificar_autor', 'retirar_conteudo', 'preservar_dados', 'outro') then perform interno.erro('invalido:pedido'); end if;
  if v_resposta not in ('em_analise', 'atendido', 'atendido_em_parte', 'recusado', 'sem_dados') then perform interno.erro('invalido:resposta'); end if;
  if v_contas < 0 or v_contas > 100000 then perform interno.erro('invalido:contas'); end if;
  if v_resposta = 'em_analise' then v_respondido := null;
  else
    v_respondido := coalesce(v_respondido, (now() at time zone 'America/Sao_Paulo')::date);
    if v_respondido < v_recebido or v_respondido > (now() at time zone 'America/Sao_Paulo')::date then perform interno.erro('invalido:data'); end if;
  end if;
  if p_id is null then
    insert into alumia_transp_pedidos (recebido_em, orgao, pedido, resposta, contas, respondido_em, registrado_por)
    values (v_recebido, p ->> 'orgao', p ->> 'pedido', v_resposta, v_contas, v_respondido, auth.uid()) returning * into x;
  else
    update alumia_transp_pedidos set recebido_em = v_recebido, orgao = p ->> 'orgao', pedido = p ->> 'pedido', resposta = v_resposta,
      contas = v_contas, respondido_em = v_respondido, atualizado_em = now()
    where id = p_id returning * into x;
    if not found then perform interno.erro('nao_encontrado'); end if;
  end if;
  perform interno.alumia_painel_registrar(case when p_id is null then 'transparencia_pedido' else 'transparencia_pedido_corrigido' end, 'pedido', x.id::text, '', '',
    jsonb_build_object('orgao', x.orgao, 'pedido', x.pedido, 'resposta', x.resposta));
  return jsonb_build_object('id', x.id, 'resposta', x.resposta, 'respondido_em', x.respondido_em);
end $$;

/**
 * Renova o aviso de ordem sigilosa: a coordenação escreve a frase "NÃO RECEBEMOS ORDEM SIGILOSA" (sem diferença de maiúsculas e
 * acentos) e a data de hoje passa a valer por 90 dias. Quem recebeu uma ordem sigilosa simplesmente não renova.
 */
create or replace function public.alumia_transp_canario_renovar(p_frase text) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
begin
  perform interno.alumia_painel_exige(true);
  perform interno.limite('alumia_transp_canario', 5, 60);
  if regexp_replace(interno.normal(coalesce(p_frase, '')), '\s+', ' ', 'g') <> 'nao recebemos ordem sigilosa' then perform interno.erro('invalido:frase'); end if;
  insert into alumia_transp_canario (por) values (auth.uid());
  perform interno.alumia_painel_registrar('transparencia_canario', 'canario', '', '', '', '{}'::jsonb);
  return interno.alumia_transp_canario_json();
end $$;

-- ── 5. Rótulos: regras ────────────────────────────────────────────────────────────────────────────────────────────────────

/** O rotulador pode marcar agora? Aberto e, se for de organização, com o selo em vigor e a conta da organização sem suspensão. */
create or replace function interno.alumia_rotulador_ativo(r interno.alumia_rotuladores) returns boolean language sql stable security definer set search_path = interno, pg_temp as $$
  select r.id is not null and r.aberto and (r.tipo = 'mediacao' or exists (
    select 1 from rede_orgs o join perfis f on f.id = o.perfil where o.perfil = r.org and o.verificada_em is not null and not f.suspenso))
$$;

/** p_quem pode pôr e retirar marcas em nome deste rotulador? A mediação (papel de cuidado) ou quem gere a organização. */
create or replace function interno.alumia_rotulos_pode(p_quem uuid, r interno.alumia_rotuladores) returns boolean language sql stable security definer set search_path = interno, pg_temp as $$
  select p_quem is not null and interno.alumia_rotulador_ativo(r)
    and ((r.tipo = 'mediacao' and p_quem = auth.uid() and interno.cuida()) or (r.tipo = 'org' and interno.alumia_org_gere(p_quem, r.org)))
$$;

/** O nome do rotulador como a tela mostra: o da organização; a mediação é nula (a tela escreve "Mediação da Alumia"). */
create or replace function interno.alumia_rotulador_nome(r interno.alumia_rotuladores) returns text language sql stable security definer set search_path = interno, pg_temp as $$
  select case when r.tipo = 'org' then interno.rede_nome(r.org) end
$$;

/** A conta dona da marca: a marcada ou a autora do post marcado. */
create or replace function interno.alumia_rotulo_dono(m interno.alumia_rotulos) returns uuid language sql stable security definer set search_path = interno, pg_temp as $$
  select coalesce(m.perfil, (select p.autor from rede_posts p where p.id = m.post))
$$;

/** Quem é da equipe da casa (coordenação, vice, mediação) não recebe marca de organização. */
create or replace function interno.alumia_rotulos_equipe(p uuid) returns boolean language sql stable security definer set search_path = interno, pg_temp as $$
  select exists (select 1 from papeis x where x.usuario = p and x.papel in ('coordenacao', 'vice', 'mediacao'))
$$;

/**
 * O efeito "esconder" (a lista de bloqueio assinável): este post sai da linha de quem lê? Sim quando quem lê assina, com
 * "esconder", um rotulador ativo que marcou o post ou a conta que o escreveu (marca valendo ou em contestação). O que a própria
 * pessoa escreveu, nunca. Quem junta compõe esta função em interno.rede_silenciado.
 */
create or replace function interno.alumia_rotulo_esconde(p interno.rede_posts, p_quem uuid) returns boolean language sql stable security definer set search_path = interno, pg_temp as $$
  select p_quem is not null and p.autor is distinct from p_quem and exists (
    select 1 from alumia_rotulos_assinaturas a
    join alumia_rotuladores r on r.id = a.rotulador
    join alumia_rotulos m on m.rotulador = r.id and m.situacao in ('vale', 'contestado')
    where a.usuario = p_quem and a.efeito = 'esconder' and (m.post = p.id or m.perfil = p.autor) and interno.alumia_rotulador_ativo(r))
$$;

/** Uma linha do registro das marcas. */
create or replace function interno.alumia_rotulos_registrar(m interno.alumia_rotulos, p_acao text, p_motivo text) returns void language plpgsql security definer set search_path = interno, pg_temp as $$
begin
  insert into alumia_rotulos_registro (marca, rotulador, rotulo, acao, quem, motivo) values (m.id, m.rotulador, m.rotulo, p_acao, auth.uid(), left(coalesce(p_motivo, ''), 1000));
end $$;

-- ── 6. Rótulos: para quem assina ──────────────────────────────────────────────────────────────────────────────────────────

/**
 * Os rotuladores ativos: a mediação primeiro, depois as organizações com selo que abriram o serviço. De cada um: as regras, se eu
 * assino (e com que efeito), se eu posso marcar em nome dele e quantas marcas valem e quantas foram revertidas no recurso (a
 * partir de 3). Nunca quem assina nem quantos assinam.
 */
create or replace function public.alumia_rotulos_catalogo() returns jsonb language plpgsql stable security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu();
begin
  perform interno.rede3_perfil_exige_membro(v);
  return coalesce((select jsonb_agg(jsonb_build_object(
      'id', r.id, 'tipo', r.tipo, 'nome', interno.alumia_rotulador_nome(r),
      'handle', (select f.rede_handle from perfis f where f.id = r.org),
      'palavra', (select o.palavra from rede_orgs o where o.perfil = r.org),
      'regras', r.regras,
      'efeito', (select a.efeito from alumia_rotulos_assinaturas a where a.usuario = v and a.rotulador = r.id),
      'posso', interno.alumia_rotulos_pode(v, r),
      'marcas', interno.alumia_transp_n((select count(*) from alumia_rotulos m where m.rotulador = r.id and m.situacao in ('vale', 'contestado'))),
      'revertidas', interno.alumia_transp_n((select count(*) from alumia_rotulos m where m.rotulador = r.id and m.situacao = 'revertido')))
      order by (r.tipo = 'mediacao') desc, interno.alumia_rotulador_nome(r))
    from alumia_rotuladores r where interno.alumia_rotulador_ativo(r)), '[]'::jsonb);
end $$;

/** Assinar um rotulador com um efeito ("avisar" ou "esconder"); efeito nulo deixa de assinar. Devolve o efeito em vigor. */
create or replace function public.alumia_rotulos_assinar(p_rotulador uuid, p_efeito text) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); r alumia_rotuladores;
begin
  perform interno.rede3_perfil_exige_membro(v);
  perform interno.limite('alumia_rotulos_assinar', 60, 60);
  if p_efeito is null then
    delete from alumia_rotulos_assinaturas where usuario = v and rotulador = p_rotulador;
    return jsonb_build_object('efeito', null);
  end if;
  if p_efeito not in ('avisar', 'esconder') then perform interno.erro('invalido:efeito'); end if;
  select * into r from alumia_rotuladores where id = p_rotulador;
  if not found or not interno.alumia_rotulador_ativo(r) then perform interno.erro('nao_encontrado'); end if;
  insert into alumia_rotulos_assinaturas (usuario, rotulador, efeito) values (v, r.id, p_efeito)
  on conflict (usuario, rotulador) do update set efeito = excluded.efeito;
  return jsonb_build_object('efeito', p_efeito);
end $$;

/**
 * As marcas de uma página de posts, para quem lê: só dos rotuladores que esta pessoa assina (e que estão ativos), só nos posts que
 * ela pode ver e nunca nos dela. Para cada post, a lista de marcas (do post ou da conta que escreveu) com o rotulador, o rótulo,
 * se está em contestação e o efeito que a pessoa escolheu. Até 100 posts por chamada.
 */
create or replace function public.alumia_rotulos_dos_posts(p_posts uuid[]) returns jsonb language plpgsql stable security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu();
begin
  if coalesce(array_length(p_posts, 1), 0) > 100 then perform interno.erro('invalido:posts'); end if;
  if not exists (select 1 from alumia_rotulos_assinaturas a where a.usuario = v) then return '[]'::jsonb; end if;
  return coalesce((select jsonb_agg(jsonb_build_object('post', x.id, 'marcas', x.marcas))
    from (
      select p.id, jsonb_agg(jsonb_build_object('rotulador', r.id, 'tipo', r.tipo, 'nome', interno.alumia_rotulador_nome(r), 'rotulo', m.rotulo,
               'da_conta', m.perfil is not null, 'contestado', m.situacao = 'contestado', 'efeito', a.efeito)
             order by (a.efeito = 'esconder') desc, m.criado_em) as marcas
      from rede_posts p
      join alumia_rotulos m on (m.post = p.id or m.perfil = p.autor) and m.situacao in ('vale', 'contestado')
      join alumia_rotuladores r on r.id = m.rotulador
      join alumia_rotulos_assinaturas a on a.rotulador = r.id and a.usuario = v
      where p.id = any (p_posts) and p.autor is distinct from v and interno.alumia_rotulador_ativo(r) and interno.rede_ve(p, v)
      group by p.id) x), '[]'::jsonb);
end $$;

-- ── 7. Rótulos: para quem rotula ──────────────────────────────────────────────────────────────────────────────────────────

/**
 * Uma organização com selo abre (ou ajusta, ou fecha) o serviço de rótulos, com as regras escritas dela (40 a 1500 letras).
 * Só quem gere a organização. Fechar não apaga marca nenhuma: elas param de valer enquanto o serviço está fechado.
 */
create or replace function public.alumia_rotulos_abrir(p_org text, p_regras text, p_aberto boolean default true) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v_org uuid := interno.alumia_org_gestor(p_org, 'alumia_rotulos_abrir', 10, 60); v_regras text := interno.txt(p_regras, 'regras', 40, 1500); r alumia_rotuladores;
begin
  if not exists (select 1 from rede_orgs o where o.perfil = v_org and o.verificada_em is not null) then perform interno.erro('sem_selo'); end if;
  insert into alumia_rotuladores (tipo, org, regras, aberto) values ('org', v_org, v_regras, coalesce(p_aberto, true))
  on conflict (org) do update set regras = excluded.regras, aberto = excluded.aberto
  returning * into r;
  return jsonb_build_object('id', r.id, 'aberto', r.aberto, 'regras', r.regras);
end $$;

/**
 * Pôr uma marca: num post (pelo id) ou numa conta (pelo @), com um rótulo da lista fechada e o motivo (10 a 500 letras, que a
 * conta marcada lê). Só em nome de um rotulador em que a pessoa pode marcar; só no que ela pode ver; nunca em si mesma, na própria
 * organização ou nos posts dela; organização não marca quem é da equipe. A conta marcada é avisada na hora.
 */
create or replace function public.alumia_rotulos_marcar(p_rotulador uuid, p_alvo_tipo text, p_alvo text, p_rotulo text, p_motivo text) returns jsonb
language plpgsql security definer set search_path = interno, pg_temp as $$
declare
  v uuid := interno.eu(); r alumia_rotuladores; x rede_posts; f perfis; v_dono uuid; m alumia_rotulos;
  v_motivo text := interno.txt(p_motivo, 'motivo', 10, 500); v_nome text;
begin
  perform interno.rede3_perfil_exige_membro(v);
  perform interno.limite('alumia_rotulos_marcar', 30, 60);
  select * into r from alumia_rotuladores where id = p_rotulador;
  if not found or not interno.alumia_rotulos_pode(v, r) then perform interno.erro('sem_permissao'); end if;
  if p_rotulo is null or p_rotulo not in ('assedio_coordenado', 'golpe', 'spam', 'perfil_falso', 'discurso_de_odio') then perform interno.erro('invalido:rotulo'); end if;
  if p_alvo_tipo = 'post' then
    begin select * into x from rede_posts where id = p_alvo::uuid; exception when others then perform interno.erro('invalido:alvo'); end;
    if not found or x.apagado_em is not null or not interno.rede_ve(x, v) then perform interno.erro('nao_encontrado'); end if;
    v_dono := x.autor;
  elsif p_alvo_tipo = 'perfil' then
    select * into f from perfis where rede_handle = lower(btrim(coalesce(p_alvo, ''), ' @'));
    if not found or (f.id <> v and (f.rede_modo = 'invisivel' or f.rede_invisivel or interno.rede_bloqueado(v, f.id))) then perform interno.erro('nao_encontrado'); end if;
    v_dono := f.id;
  else
    perform interno.erro('invalido:alvo');
  end if;
  if v_dono is null or v_dono = v or v_dono is not distinct from r.org then perform interno.erro('sem_permissao'); end if;
  if r.tipo = 'org' and interno.alumia_rotulos_equipe(v_dono) then perform interno.erro('sem_permissao'); end if;
  insert into alumia_rotulos (rotulador, perfil, post, rotulo, motivo, quem)
  values (r.id, case when p_alvo_tipo = 'perfil' then v_dono end, case when p_alvo_tipo = 'post' then x.id end, p_rotulo, v_motivo, v)
  on conflict do nothing
  returning * into m;
  if m.id is null then perform interno.erro('ja_marcado'); end if;
  perform interno.alumia_rotulos_registrar(m, 'marcar', v_motivo);
  v_nome := coalesce(interno.alumia_rotulador_nome(r), 'a mediação da Alumia');
  perform interno.avisar_em(v_dono, left(case when p_alvo_tipo = 'post' then 'Um post seu' else 'A sua conta' end || ' recebeu um rótulo de ' || v_nome
    || ' (' || replace(p_rotulo, '_', ' ') || '). O rótulo só aparece para quem assina esse rotulador e não tira nada do ar. Veja o motivo e conteste em Rótulos.', 500), 'rede');
  return jsonb_build_object('id', m.id, 'situacao', m.situacao);
end $$;

/** Retirar uma marca que o próprio rotulador pôs (o motivo vai para o registro). A conta marcada é avisada. */
create or replace function public.alumia_rotulos_retirar(p_marca uuid, p_motivo text) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); m alumia_rotulos; r alumia_rotuladores; v_motivo text := interno.txt(p_motivo, 'motivo', 10, 500);
begin
  perform interno.limite('alumia_rotulos_retirar', 60, 60);
  select * into m from alumia_rotulos where id = p_marca for update;
  if not found or m.situacao not in ('vale', 'contestado') then perform interno.erro('nao_encontrado'); end if;
  select * into r from alumia_rotuladores where id = m.rotulador;
  if not interno.alumia_rotulos_pode(v, r) then perform interno.erro('sem_permissao'); end if;
  update alumia_rotulos set situacao = 'retirado', decidido_em = now(), decidido_por = v, decisao = v_motivo where id = m.id returning * into m;
  perform interno.alumia_rotulos_registrar(m, 'retirar', v_motivo);
  perform interno.avisar_em(interno.alumia_rotulo_dono(m), 'Um rótulo que estava na sua conta ou num post seu foi retirado por quem o pôs.', 'rede');
  return jsonb_build_object('id', m.id, 'situacao', m.situacao);
end $$;

/** As marcas que valem (ou estão em contestação) de um rotulador, para quem marca em nome dele: as 200 mais recentes. */
create or replace function public.alumia_rotulos_meus(p_rotulador uuid) returns jsonb language plpgsql stable security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); r alumia_rotuladores;
begin
  select * into r from alumia_rotuladores where id = p_rotulador;
  if not found or not interno.alumia_rotulos_pode(v, r) then perform interno.erro('sem_permissao'); end if;
  return coalesce((select jsonb_agg(jsonb_build_object(
      'id', m.id, 'rotulo', m.rotulo, 'motivo', m.motivo, 'situacao', m.situacao, 'criado_em', m.criado_em,
      'alvo_tipo', case when m.perfil is not null then 'perfil' else 'post' end,
      'conta', interno.rede_nome(interno.alumia_rotulo_dono(m)),
      'handle', (select f.rede_handle from perfis f where f.id = interno.alumia_rotulo_dono(m)),
      'trecho', (select left(p.texto, 140) from rede_posts p where p.id = m.post),
      'minha', m.quem is not distinct from v) order by m.criado_em desc)
    from (select * from alumia_rotulos q where q.rotulador = r.id and q.situacao in ('vale', 'contestado') order by q.criado_em desc limit 200) m), '[]'::jsonb);
end $$;

-- ── 8. Rótulos: para quem foi marcado e para a mediação ───────────────────────────────────────────────────────────────────

/**
 * As marcas na minha conta e nos meus posts (as que valem, as em contestação e as decididas nos últimos 90 dias): quem marcou (o
 * rotulador, nunca a pessoa), o rótulo, o motivo, o andamento e se ainda posso contestar.
 */
create or replace function public.alumia_rotulos_sobre_mim() returns jsonb language plpgsql stable security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu();
begin
  return coalesce((select jsonb_agg(jsonb_build_object(
      'id', m.id, 'tipo', r.tipo, 'nome', interno.alumia_rotulador_nome(r), 'rotulo', m.rotulo, 'motivo', m.motivo,
      'alvo_tipo', case when m.perfil is not null then 'perfil' else 'post' end,
      'trecho', (select left(p.texto, 140) from rede_posts p where p.id = m.post),
      'situacao', m.situacao, 'criado_em', m.criado_em, 'contestado_em', m.contestado_em, 'decidido_em', m.decidido_em,
      'decisao', case when m.situacao in ('vale', 'revertido') and m.decidido_em is not null then m.decisao end,
      'pode_contestar', m.situacao = 'vale' and m.contestado_em is null) order by m.criado_em desc)
    from alumia_rotulos m join alumia_rotuladores r on r.id = m.rotulador
    where (m.perfil = v or m.post in (select p.id from rede_posts p where p.autor = v))
      and (m.situacao in ('vale', 'contestado') or m.decidido_em > now() - interval '90 days')), '[]'::jsonb);
end $$;

/** Contestar uma marca na minha conta ou num post meu (uma vez por marca). Vai para a fila da mediação. */
create or replace function public.alumia_rotulos_contestar(p_marca uuid, p_texto text) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); m alumia_rotulos; v_texto text := interno.txt(p_texto, 'texto', 10, 1000);
begin
  perform interno.limite('alumia_rotulos_contestar', 10, 60);
  select * into m from alumia_rotulos where id = p_marca for update;
  if not found or interno.alumia_rotulo_dono(m) is distinct from v then perform interno.erro('nao_encontrado'); end if;
  if m.situacao <> 'vale' or m.contestado_em is not null then perform interno.erro('ja_contestado'); end if;
  update alumia_rotulos set situacao = 'contestado', contestacao = v_texto, contestado_em = now() where id = m.id returning * into m;
  perform interno.alumia_rotulos_registrar(m, 'contestar', '');
  insert into avisos (para, texto)
  select distinct p.usuario, 'Há uma contestação de rótulo na fila da mediação da Alumia.' from papeis p
  where p.papel in ('coordenacao', 'vice', 'mediacao') and p.usuario is distinct from m.quem and p.usuario <> v;
  return jsonb_build_object('id', m.id, 'situacao', m.situacao);
end $$;

/** A fila das contestações, para a mediação: o rotulador, o rótulo, o motivo, a contestação e o alvo. Nunca quem assina. */
create or replace function public.alumia_rotulos_fila() returns jsonb language plpgsql stable security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu();
begin
  if not interno.cuida() then perform interno.erro('sem_permissao'); end if;
  return coalesce((select jsonb_agg(jsonb_build_object(
      'id', m.id, 'tipo', r.tipo, 'nome', interno.alumia_rotulador_nome(r), 'rotulo', m.rotulo, 'motivo', m.motivo, 'contestacao', m.contestacao,
      'criado_em', m.criado_em, 'contestado_em', m.contestado_em,
      'alvo_tipo', case when m.perfil is not null then 'perfil' else 'post' end,
      'conta', interno.rede_nome(interno.alumia_rotulo_dono(m)),
      'trecho', (select left(p.texto, 200) from rede_posts p where p.id = m.post),
      'pode', m.quem is distinct from v) order by m.contestado_em)
    from alumia_rotulos m join alumia_rotuladores r on r.id = m.rotulador where m.situacao = 'contestado'), '[]'::jsonb);
end $$;

/**
 * A mediação decide uma contestação: "manter" (a marca volta a valer e não se contesta de novo) ou "reverter" (a marca sai). Quem
 * pôs a marca nunca decide. A conta marcada é avisada, com o motivo.
 */
create or replace function public.alumia_rotulos_decidir(p_marca uuid, p_decisao text, p_motivo text) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); m alumia_rotulos; v_motivo text := interno.txt(p_motivo, 'motivo', 10, 500);
begin
  if not interno.cuida() then perform interno.erro('sem_permissao'); end if;
  perform interno.limite('alumia_rotulos_decidir', 120, 60);
  if p_decisao is null or p_decisao not in ('manter', 'reverter') then perform interno.erro('invalido:decisao'); end if;
  select * into m from alumia_rotulos where id = p_marca for update;
  if not found or m.situacao <> 'contestado' then perform interno.erro('nao_encontrado'); end if;
  if m.quem is not distinct from v or interno.alumia_rotulo_dono(m) = v then perform interno.erro('outra_pessoa'); end if;
  update alumia_rotulos set situacao = case when p_decisao = 'manter' then 'vale' else 'revertido' end,
    decidido_em = now(), decidido_por = v, decisao = v_motivo where id = m.id returning * into m;
  perform interno.alumia_rotulos_registrar(m, p_decisao, v_motivo);
  perform interno.avisar_em(interno.alumia_rotulo_dono(m), left(case when p_decisao = 'manter'
    then 'A mediação leu a sua contestação e manteve o rótulo. Motivo: ' else 'A mediação leu a sua contestação e tirou o rótulo. Motivo: ' end || v_motivo, 500), 'rede');
  return jsonb_build_object('id', m.id, 'situacao', m.situacao);
end $$;

-- ── 9. A porta: o relatório de transparência fica fora ────────────────────────────────────────────────────────────────────

/**
 * As funções que ficam SEM a porta, de propósito. A lista de 20261114-alumia-o8-lei.sql (a mesma das outras três migrações que a
 * definem) mais o relatório de transparência (alumia_transparencia), que é público como a página. Rodar uma das migrações antigas
 * depois desta volta a trancar o relatório: rode esta em seguida (ou ponha o nome nas listas de lá, ao juntar).
 */
create or replace function interno.alumia_porta_aberta(p_nome text, p_argumentos text) returns boolean language sql immutable as $$
  select p_nome in ('alumia_entrada_eu', 'alumia_entrada_pedir', 'alumia_triagem_contagem', 'alumia_triagem_fila', 'alumia_triagem_decidir',
                    'rede_situacao', 'rede_aderir', 'rede_codinome_definir', 'rede_confirmar_idade', 'rede_eu', 'rede_alumia_versao',
                    'rede_fed_situacao', 'rede_antigo',
                    -- Chamadas pelo servidor do site sem sessão, com o segredo da federação (Faixa 2): com a porta, o Fediverso para.
                    'rede_fed_servidor', 'rede_fed_midia_servidor', 'rede_fed_mudanca_servidor',
                    -- Quem teve a conta suspensa ou retida pede revisão (20261114-alumia-o8-lei.sql).
                    'alumia_lei_minha_conta', 'alumia_lei_recorrer_conta',
                    -- A marca "veio por convite" na triagem, que tem a regra dela (20261114-alumia-o8-porta.sql).
                    'alumia_triagem_convites',
                    -- O relatório de transparência, público como a página (20261115-alumia-o9-transparencia.sql).
                    'alumia_transparencia')
      or (p_nome in ('rede_linha', 'rede_novos') and coalesce(p_argumentos, '') like 'p_aba text%')
      -- O diretório das organizações com selo e o mapa dele (20261113-alumia-o7-entrada.sql, decisão de 12/11).
      or (p_nome = 'rede_org_diretorio' and coalesce(p_argumentos, '') = 'p jsonb')
      or (p_nome = 'rede_org_mapa' and coalesce(p_argumentos, '') = '')
$$;

-- Se uma rodada anterior (ou a regra da porta antes desta lista) já tinha posto a porta no relatório, ela sai.
do $$
declare r record;
begin
  for r in
    select p.oid, p.prosrc
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.prokind = 'f' and p.proname = 'alumia_transparencia'
      and position('perform interno.alumia_porta(); ' in p.prosrc) > 0
  loop
    execute replace(pg_get_functiondef(r.oid), r.prosrc, replace(r.prosrc, 'perform interno.alumia_porta(); ', ''));
  end loop;
end $$;

-- ── 10. Permissões ────────────────────────────────────────────────────────────────────────────────────────────────────────
do $$
declare f text;
begin
  foreach f in array array['interno.alumia_transp_so_insercao()', 'interno.alumia_transp_n(bigint)', 'interno.alumia_transp_instante(date)',
                           'interno.alumia_transp_contar(date)', 'interno.alumia_transp_autoridade(date)',
                           'interno.alumia_transp_proteger(bigint[], boolean[], integer[], boolean[])', 'interno.alumia_transp_m(bigint, boolean)',
                           'interno.alumia_transp_linha(integer, integer[], integer)', 'interno.alumia_transp_canario_prazo()',
                           'interno.alumia_transp_canario_json()', 'interno.alumia_transp_comeco()', 'interno.alumia_transp_folga()',
                           'interno.alumia_transp_relatorio(date)', 'interno.alumia_rotulador_ativo(interno.alumia_rotuladores)',
                           'interno.alumia_rotulos_pode(uuid, interno.alumia_rotuladores)', 'interno.alumia_rotulador_nome(interno.alumia_rotuladores)',
                           'interno.alumia_rotulo_dono(interno.alumia_rotulos)', 'interno.alumia_rotulos_equipe(uuid)',
                           'interno.alumia_rotulo_esconde(interno.rede_posts, uuid)', 'interno.alumia_rotulos_registrar(interno.alumia_rotulos, text, text)',
                           'interno.alumia_porta_aberta(text, text)',
                           'public.alumia_transparencia()', 'public.alumia_transp_painel()', 'public.alumia_transp_pedido_salvar(uuid, jsonb)',
                           'public.alumia_transp_canario_renovar(text)', 'public.alumia_rotulos_catalogo()', 'public.alumia_rotulos_assinar(uuid, text)',
                           'public.alumia_rotulos_dos_posts(uuid[])', 'public.alumia_rotulos_abrir(text, text, boolean)',
                           'public.alumia_rotulos_marcar(uuid, text, text, text, text)', 'public.alumia_rotulos_retirar(uuid, text)',
                           'public.alumia_rotulos_meus(uuid)', 'public.alumia_rotulos_sobre_mim()', 'public.alumia_rotulos_contestar(uuid, text)',
                           'public.alumia_rotulos_fila()', 'public.alumia_rotulos_decidir(uuid, text, text)'] loop
    execute format('revoke all on function %s from public', f);
    if exists (select 1 from pg_roles where rolname = 'anon') then
      execute format('revoke all on function %s from anon, authenticated', f);
    end if;
  end loop;
  if exists (select 1 from pg_roles where rolname = 'anon') then
    grant execute on function public.alumia_transparencia() to anon, authenticated, service_role;
    foreach f in array array['public.alumia_transp_painel()', 'public.alumia_transp_pedido_salvar(uuid, jsonb)', 'public.alumia_transp_canario_renovar(text)',
                             'public.alumia_rotulos_catalogo()', 'public.alumia_rotulos_assinar(uuid, text)', 'public.alumia_rotulos_dos_posts(uuid[])',
                             'public.alumia_rotulos_abrir(text, text, boolean)', 'public.alumia_rotulos_marcar(uuid, text, text, text, text)',
                             'public.alumia_rotulos_retirar(uuid, text)', 'public.alumia_rotulos_meus(uuid)', 'public.alumia_rotulos_sobre_mim()',
                             'public.alumia_rotulos_contestar(uuid, text)', 'public.alumia_rotulos_fila()', 'public.alumia_rotulos_decidir(uuid, text, text)'] loop
      execute format('grant execute on function %s to authenticated, service_role', f);
    end loop;
  end if;
end $$;

-- ── 11. A porta em todas as funções novas de membro ───────────────────────────────────────────────────────────────────────
do $$
declare v jsonb := interno.alumia_trancar();
begin
  if jsonb_array_length(v -> 'abertas') > 0 then
    raise warning 'alumia_trancar: função sem porta: %', v -> 'abertas';
  end if;
end $$;
