-- ─────────────── Alumia · Onda 8 · 8F · voto secreto de verdade no banco (14/11/2026) ───────────────
-- Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
--
-- O voto secreto estava separado só no papel. Na consulta à base (rede_consulta_votantes e rede_consulta_cedulas) e na
-- votação secreta da equipe (votacao_presencas e votacao_votos), "quem votou" e "o que votou" entravam na MESMA transação: as
-- duas linhas ficavam com o mesmo xmin, lado a lado no disco, e quem lê o banco (service_role, dono do projeto, função com erro)
-- casava uma com a outra com um `select xmin, ctid`. E a marca da presença da equipe era md5(sal, votação, pessoa) com o sal
-- guardado no próprio banco: quem lê o banco desfaz a marca.
--
-- O que muda (o porquê e os ataques em docs/rede/VOTO-SECRETO.md):
--   1. A cédula não tem mais id, nem hora, nem sequência: só a consulta (ou a votação) e o voto.
--   2. A urna (interno.alumia_urna e interno.votacao_urna): a cada voto, a cédula nova entra junto com as cédulas que já estavam
--      (todas, até 2000; acima disso, 2000 sorteadas), apagadas e gravadas de novo NUM COMANDO SÓ, em ordem sorteada por
--      gen_random_uuid(). Todas ficam com o mesmo xmin e o mesmo cmin, e a posição no disco é sorteio. O xmin da linha de quem
--      votou é o mesmo de todas as cédulas regravadas juntas: não aponta para nenhuma.
--   3. Votos da mesma consulta entram em fila (pg_advisory_xact_lock, que não deixa marca em linha nenhuma).
--   4. A marca da presença da equipe sai: votacao_presencas dá lugar a votacao_votantes, que guarda a pessoa às claras (é o
--      mesmo que a marca já dizia a quem lê o banco, sem fingir anonimato); o segredo fica onde importa, na cédula.
--   5. O resultado só sai com a consulta fechada, com 3 votos ou mais e com o quórum atingido. Na votação secreta da equipe, só
--      depois do fim e com 3 votos ou mais.
--   6. A conversão do que já existe: os votos já dados ficam (cada cédula, cada "votou"), o que revelava (id da cédula, a tabela
--      das marcas) sai, e todas as cédulas são regravadas de uma vez em ordem sorteada.
--
-- Pode rodar mais de uma vez (a segunda só sorteia de novo a ordem das cédulas). Roda DEPOIS da F4
-- (20261109-alumia-f4.sql) e das portas (20261112-alumia-portas.sql). No fim chama interno.alumia_trancar().
-- Depois de rodar em produção: VACUUM (FULL) interno.rede_consulta_cedulas e VACUUM (FULL) interno.votacao_votos
-- (fora de transação, um por vez), para as versões antigas das linhas saírem do disco. Teste: npm run testar:alumia-o8-voto.

-- ── 1. Consulta à base: a cédula sem id e a urna ────────────────────────────────────────────────────────────────────────────

-- Sem o id, sai também a chave primária (ela era só o id). Nada aponta para a cédula.
alter table interno.rede_consulta_cedulas drop column if exists id;
-- As versões antigas das linhas (o que a urna apaga a cada voto) saem do disco no próximo ciclo do autovacuum, sem esperar o
-- acúmulo de costume.
alter table interno.rede_consulta_cedulas set (autovacuum_vacuum_threshold = 0, autovacuum_vacuum_scale_factor = 0);

/**
 * A urna da consulta: grava a cédula nova misturada às que já estavam. Apaga até 2000 cédulas da mesma consulta (todas, enquanto
 * houver até 2000; acima, 2000 sorteadas) e grava de novo essas e a nova num INSERT só, em ordem sorteada. Resultado: a cédula
 * nova tem o mesmo xmin e o mesmo cmin de todas as que foram regravadas, e a posição no disco não diz a ordem de chegada.
 */
create or replace function interno.alumia_urna(p_consulta uuid, p_ranking uuid[]) returns void language plpgsql security definer set search_path = interno, pg_temp as $$
begin
  with velhas as (
    delete from rede_consulta_cedulas
    where consulta = p_consulta
      and ctid = any (array(select ctid from rede_consulta_cedulas where consulta = p_consulta order by gen_random_uuid() limit 2000))
    returning ranking)
  insert into rede_consulta_cedulas (consulta, ranking)
  select p_consulta, t.r from (select ranking as r from velhas union all select p_ranking) t order by gen_random_uuid();
end $$;

/**
 * Votar numa consulta aberta (mesma assinatura e mesmas regras da F4). Só quem é de um dos núcleos que votam. Grava "votou" e
 * põe a cédula na urna (interno.alumia_urna); nada volta além de "votei". Não dá para mudar.
 */
create or replace function public.rede_org_consulta_votar(p_consulta uuid, p_ranking uuid[]) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); c rede_consultas; v_nucleos uuid[]; v_opcoes uuid[];
begin
  perform interno.rede3_perfil_exige_membro(v);
  select * into c from rede_consultas where id = p_consulta;
  if not found or interno.rede_bloqueado(v, c.org) then perform interno.erro('nao_encontrado'); end if;
  if c.prazo <= now() then perform interno.erro('consulta_fechada'); end if;
  v_nucleos := case when cardinality(c.nucleos) > 0 then c.nucleos else coalesce((select array_agg(id) from rede_nucleos where org = c.org), '{}') end;
  if not exists (select 1 from rede_nucleo_membros m where m.usuario = v and m.nucleo = any (v_nucleos)) then perform interno.erro('sem_permissao'); end if;
  perform interno.limite('alumia_org_votar', 30, 60);
  select array_agg(id) into v_opcoes from rede_consulta_opcoes where consulta = c.id;
  if p_ranking is null or cardinality(p_ranking) = 0 or cardinality(p_ranking) > cardinality(v_opcoes)
     or (c.metodo = 'simples' and cardinality(p_ranking) <> 1)
     or exists (select 1 from unnest(p_ranking) x where x is null or not x = any (v_opcoes))
     or (select count(distinct x) from unnest(p_ranking) x) <> cardinality(p_ranking) then
    perform interno.erro('invalido:ranking');
  end if;
  -- Um voto por vez em cada consulta: a urna regrava as cédulas e dois votos ao mesmo tempo se atropelariam.
  perform pg_advisory_xact_lock(hashtextextended('alumia_urna:' || c.id::text, 0));
  insert into rede_consulta_votantes (consulta, usuario) values (c.id, v) on conflict do nothing;
  if not found then perform interno.erro('ja_votou'); end if;
  perform interno.alumia_urna(c.id, p_ranking);
  return jsonb_build_object('votei', true);
end $$;

/**
 * A consulta como o perfil mostra (mesma assinatura da F4). O resultado só sai com a consulta fechada, com 3 cédulas ou mais e
 * com o quórum atingido; antes disso, nem as proporções nem o número de quem votou.
 */
create or replace function interno.alumia_consulta_json(c interno.rede_consultas, p_quem uuid) returns jsonb language plpgsql stable security definer set search_path = interno, pg_temp as $$
declare
  v_fechada boolean := c.prazo <= now(); v_votantes integer; v_cedulas integer; v_ap jsonb; v_mostra boolean; v_nucleos uuid[];
  v_posso boolean; v_votei boolean; v_quorum boolean;
begin
  v_nucleos := case when cardinality(c.nucleos) > 0 then c.nucleos else coalesce((select array_agg(id) from rede_nucleos where org = c.org), '{}') end;
  select count(*) into v_votantes from rede_consulta_votantes where consulta = c.id;
  v_votei := p_quem is not null and exists (select 1 from rede_consulta_votantes where consulta = c.id and usuario = p_quem);
  v_posso := p_quem is not null and not v_fechada and not v_votei and interno.rede2_membro(p_quem) and not interno.rede_bloqueado(p_quem, c.org)
    and exists (select 1 from rede_nucleo_membros m where m.usuario = p_quem and m.nucleo = any (v_nucleos));
  v_quorum := c.quorum is null or v_votantes >= c.quorum;
  if v_fechada then select count(*) into v_cedulas from rede_consulta_cedulas where consulta = c.id; end if;
  -- Com 1 ou 2 votos daria para saber o voto de alguém; sem quórum, o resultado não vale e não aparece.
  v_mostra := v_fechada and v_votantes >= 3 and coalesce(v_cedulas, 0) >= 3 and v_quorum;
  if v_mostra then v_ap := interno.alumia_apurar(c.id); end if;
  return jsonb_build_object(
    'id', c.id, 'pergunta', c.pergunta, 'metodo', c.metodo, 'prazo', c.prazo, 'compromisso', c.compromisso, 'quorum', c.quorum,
    'situacao', case when v_fechada then 'fechada' else 'aberta' end,
    'votantes', case when v_fechada then interno.alumia_pessoas(v_votantes) end,
    'quorumAtingido', case when v_fechada then v_quorum end,
    'possoVotar', v_posso, 'votei', v_votei,
    'nucleos', coalesce((select jsonb_agg(n.nome order by n.nome) from rede_nucleos n where n.id = any (v_nucleos)), '[]'::jsonb),
    'opcoes', coalesce((select jsonb_agg(jsonb_build_object('id', o.id, 'texto', o.texto,
                'proporcao', case when v_mostra then round((v_ap -> 'proporcoes' ->> o.id::text)::numeric, 4) end) order by o.ordem)
              from rede_consulta_opcoes o where o.consulta = c.id), '[]'::jsonb));
end $$;

-- A conversão: todas as cédulas que já existem, regravadas de uma vez em ordem sorteada (perdem o xmin de quem votou).
with velhas as (delete from interno.rede_consulta_cedulas returning consulta, ranking)
insert into interno.rede_consulta_cedulas (consulta, ranking)
select consulta, ranking from velhas order by gen_random_uuid();

-- ── 2. Votação da equipe: presença sem marca, cédula sem id e a urna ────────────────────────────────────────────────────────

alter table interno.votacao_votos drop column if exists id;
alter table interno.votacao_votos set (autovacuum_vacuum_threshold = 0, autovacuum_vacuum_scale_factor = 0);

-- Quem votou, sem marca: a pessoa às claras (com o sal no banco, a marca já dizia isso a quem lê o banco). Tabela nova no lugar
-- de votacao_presencas, para o install.sql continuar rodando de novo: o bloco antigo recria votacao_presencas vazia, e o trecho
-- abaixo passa o que houver e a apaga outra vez.
create table if not exists interno.votacao_votantes (
  votacao uuid not null references interno.votacoes (id) on delete cascade,
  -- Conta apagada: a linha fica sem pessoa e continua contando como "votou".
  usuario uuid references interno.perfis (id) on delete set null
);
create unique index if not exists votacao_votantes_quem on interno.votacao_votantes (votacao, usuario);
alter table interno.votacao_votantes enable row level security;
revoke all on interno.votacao_votantes, interno.votacao_votos from public;
do $$
declare v_sal text;
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on interno.votacao_votantes, interno.votacao_votos from anon, authenticated;
  end if;
  -- A conversão: cada marca vira a pessoa (a marca que não bate com conta nenhuma, de conta apagada, fica sem pessoa).
  if to_regclass('interno.votacao_presencas') is not null then
    v_sal := coalesce((select valor #>> '{}' from interno.configuracoes where chave = 'cuidado_sal'), '');
    insert into interno.votacao_votantes (votacao, usuario)
    select p.votacao, (select f.id from interno.perfis f where md5(v_sal || ':voto:' || p.votacao::text || ':' || f.id::text) = p.marca limit 1)
    from interno.votacao_presencas p
    on conflict do nothing;
    drop table interno.votacao_presencas;
  end if;
end $$;

/** A urna da votação secreta da equipe: como interno.alumia_urna, só com as cédulas sem pessoa (as do voto secreto). */
create or replace function interno.votacao_urna(p_votacao uuid, p_opcao smallint) returns void language plpgsql security definer set search_path = interno, pg_temp as $$
begin
  with velhos as (
    delete from votacao_votos
    where votacao = p_votacao and usuario is null
      and ctid = any (array(select ctid from votacao_votos where votacao = p_votacao and usuario is null order by gen_random_uuid() limit 2000))
    returning opcao)
  insert into votacao_votos (votacao, opcao)
  select p_votacao, t.o from (select opcao as o from velhos union all select p_opcao) t order by gen_random_uuid();
end $$;

create or replace function interno.votacao_json(v interno.votacoes) returns jsonb language sql stable security definer set search_path = interno, pg_temp as $$
  select jsonb_build_object('id', v.id, 'titulo', v.titulo, 'descricao', v.descricao, 'opcoes', to_jsonb(v.opcoes), 'departamento', v.departamento, 'secreta', v.secreta,
    'encerra_em', v.encerra_em, 'terminou_em', least(coalesce(v.encerrada_em, v.encerra_em), v.encerra_em), 'encerrada', v.encerrada_em is not null or v.encerra_em <= now(), 'criado_em', v.criado_em,
    'criada_por', coalesce((select interno.nome_visto(nome) from perfis where id = v.criada_por), ''),
    'minha', v.criada_por = auth.uid(),
    'posso_votar', interno.vota_em(v, auth.uid()),
    'votei', auth.uid() is not null and exists (select 1 from votacao_votantes p where p.votacao = v.id and p.usuario = auth.uid()),
    'votantes', (select count(*) from votacao_votantes p where p.votacao = v.id),
    'aptos', (select count(*) from perfis f where interno.vota_em(v, f.id)),
    -- Só depois do fim; no voto secreto, só com 3 votos ou mais (com 1 ou 2, quem votou saberia o voto da outra pessoa).
    'resultado', case when (v.encerrada_em is not null or v.encerra_em <= now())
                        and (not v.secreta or (select count(*) from votacao_votos w where w.votacao = v.id) >= 3) then
      (select jsonb_agg(jsonb_build_object('opcao', o.i - 1, 'texto', o.t, 'votos', (select count(*) from votacao_votos w where w.votacao = v.id and w.opcao = o.i - 1),
         'quem', case when not v.secreta then (select coalesce(jsonb_agg(interno.nome_visto(f.nome) order by f.nome), '[]'::jsonb) from votacao_votos w join perfis f on f.id = w.usuario where w.votacao = v.id and w.opcao = o.i - 1) end)
         order by o.i)
       from unnest(v.opcoes) with ordinality as o(t, i)) end)
$$;

/** Votar uma vez. No voto secreto, a lista de quem votou guarda a pessoa e a cédula vai para a urna, sem nada que ligue uma à outra. */
create or replace function public.votar(p_id uuid, p_opcao integer) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); x votacoes;
begin
  select * into x from votacoes where id = p_id;
  if not found then perform interno.erro('nao_encontrado'); end if;
  if x.encerrada_em is not null or x.encerra_em <= now() then perform interno.erro('encerrada'); end if;
  if not interno.vota_em(x, v) then perform interno.erro('sem_permissao'); end if;
  if p_opcao is null or p_opcao < 0 or p_opcao >= cardinality(x.opcoes) then perform interno.erro('invalido:opcao'); end if;
  perform pg_advisory_xact_lock(hashtextextended('votacao_urna:' || x.id::text, 0));
  insert into votacao_votantes (votacao, usuario) values (x.id, v) on conflict do nothing;
  if not found then perform interno.erro('ja_votou'); end if;
  if x.secreta then perform interno.votacao_urna(x.id, p_opcao::smallint);
  else insert into votacao_votos (votacao, opcao, usuario) values (x.id, p_opcao, v); end if;
  return jsonb_build_object('ok', true);
end $$;

-- A marca não existe mais.
drop function if exists interno.votacao_marca(uuid, uuid);

-- A conversão: as cédulas secretas que já existem, regravadas de uma vez em ordem sorteada.
with velhos as (delete from interno.votacao_votos where usuario is null returning votacao, opcao)
insert into interno.votacao_votos (votacao, opcao)
select votacao, opcao from velhos order by gen_random_uuid();

-- A votacao_json confia na linha que recebe (encerra_em, secreta): só as funções da votação (security definer) a chamam.
revoke all on function interno.alumia_urna(uuid, uuid[]), interno.votacao_urna(uuid, smallint), interno.votacao_json(interno.votacoes) from public;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on function interno.alumia_urna(uuid, uuid[]), interno.votacao_urna(uuid, smallint), interno.votacao_json(interno.votacoes) from anon, authenticated;
  end if;
end $$;

select interno.alumia_trancar();
