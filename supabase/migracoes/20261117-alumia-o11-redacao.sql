-- ─────────────── Alumia · Onda 11 · 11D · redação entre pares, a roda de correção (17/11/2026) ───────────────
-- Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
--
-- A roda de correção da redação (L2-44), com a troca por princípio: TROCA CEGA nos dois sentidos e tudo apagado depois.
--
--   1. O TEMA DA SEMANA é lançado pela coordenação (ou pelo admin da Alumia), uma proposta por semana (segunda a domingo, no horário
--      de São Paulo), com os textos motivadores. Dá para deixar as próximas semanas prontas; o tema de uma semana só muda enquanto
--      ninguém entregou redação nele.
--   2. ENTREGAR: a pessoa escreve a redação no aparelho (texto digitado, nada de foto com a letra dela) e entrega na semana do tema.
--      Uma por semana. A roda daquela semana fica aberta duas semanas (a do tema e a seguinte) para as leituras.
--   3. CORRIGIR: a pessoa pede uma redação para ler. O banco sorteia uma da roda que ainda precisa de leitura (nunca a dela, nunca
--      uma que ela já leu, nunca de quem a bloqueou; redação já devolvida só volta à roda para repor uma leitura tirada pela
--      mediação, e só para quem não corrigiu nada naquela roda), e entrega o texto SEM a autora: nem nome, nem codinome, nem id. A ficha tem as
--      5 competências do ENEM, cada uma com nota de 0 a 200 (de 40 em 40, como na prova) e um comentário, mais um comentário geral.
--      Até 2 leituras abertas por vez, 72 horas para cada uma (depois volta para a roda). A correção entra pelo servidor do site
--      (app/api/alumia/redacao/corrigir): ele sorteia o id da correção e grava junto o LACRE (abaixo).
--   4. A TROCA: cada redação recebe 2 leituras (3 só quando não há outra redação esperando, e nunca depois da devolução). A autora só RECEBE as dela se também
--      corrigiu 2 redações da mesma roda (ou tantas quantas recebeu, se recebeu menos). Quem não corrigiu não recebe. Se ela pede
--      para ler e a roda está cheia (nenhuma redação esperando e 3 ou mais alheias já com as leituras todas), a troca dela fica
--      cumprida: tentou e não havia o que ler.
--   5. A DEVOLUÇÃO é feita pelo agendador (interno.alumia_redacao_rodada, a cada 10 minutos), nunca na transação de quem corrigiu:
--      com 2 leituras feitas e a troca cumprida (ou com a roda fechada, 1 leitura ou mais e a troca cumprida), a redação é devolvida,
--      as linhas "quem leu o quê" (alumia_redacao_leituras) SOMEM e as correções são APAGADAS E ESCRITAS DE NOVO em ordem sorteada
--      (outra transação, e a ordem no disco deixa de seguir a ordem em que foram feitas). A correção não mexe no crédito da troca:
--      até a devolução, a conta é "créditos + leituras feitas"; a rodada passa as leituras para o crédito ao apagá-las e escreve de
--      novo, em ordem sorteada, todos os créditos daquela roda, de modo que o crédito de cada pessoa e as correções que ela fez têm
--      a mesma transação que os de todo mundo. Quando a roda fecha, as leituras feitas das redações que não foram devolvidas
--      (a autora não cumpriu a troca) somem do mesmo jeito. Depois disso o banco NÃO GUARDA a ligação corretor↔redação: a correção
--      não tem corretor, nem hora, nem id sequencial; o crédito da troca (alumia_redacao_creditos) é só "pessoa, semana, quantas",
--      sem redação. A medalha da redação (interno.alumia_o11_feito) também só conta quando a roda fecha, para todo mundo de uma vez.
--   6. A autora vê as leituras como "Leitura 1", "Leitura 2", sem nome, em ordem sorteada. Antes da devolução ela não vê nem
--      quantas leituras chegaram (o momento entregaria quem acabou de corrigir). Depois também não: a leitura que repõe uma tirada
--      pela mediação só aparece para ela quando a rodada a LIBERA (junto com a regravação), nunca na hora em que foi feita.
--   7. APAGAR DE VEZ: a redação, as correções e as denúncias delas somem 30 dias depois da devolução. Redação que não foi devolvida
--      (sem leitura, ou a autora não corrigiu) some 21 dias depois do começo da semana do tema. A autora pode apagar a dela antes.
--   8. DENÚNCIA DE CORREÇÃO ABUSIVA: a autora denuncia uma leitura recebida; vai à mediação (os mediadores do Instituto e o painel da
--      Alumia), que lê a correção e a redação, sem saber de quem são. Abusiva: a leitura sai da tela da autora e a redação volta à
--      roda para uma leitura nova. E quem escreveu fica fora da roda por 8 semanas, SEM que ninguém saiba quem é: o LACRE da correção
--      é HMAC-SHA-256 (segredo do servidor do site, ALUMIA_VOTO_SEGREDO com rótulo próprio; lib/rede/redacao/servidor.ts) sobre o id
--      da correção e a pessoa. O banco sozinho não desfaz o lacre. Só depois da decisão da mediação o servidor confere o lacre contra
--      as pessoas que corrigiram naquela roda e afasta a que bate (app/api/alumia/redacao/afastar); a tela da mediação não recebe o
--      nome, e o lacre é apagado em seguida. Sem o segredo no servidor, a correção entra sem lacre: a denúncia ainda tira a leitura,
--      mas ninguém é afastado.
--   9. NÚMEROS: "redações esperando leitura" só a partir de 3. Nenhuma lista de quem corrigiu, nenhum placar de quem corrige mais.
--
-- Tudo em interno, com RLS e sem política. As funções do servidor do site só aceitam a chave de serviço; as de membro passam pela
-- porta (interno.alumia_trancar, no fim). Pode rodar mais de uma vez, sem apagar dado nenhum. Roda DEPOIS das migrações da onda 10
-- (usa interno.alumia_pessoas, interno.alumia_painel_papel, interno.rede3_perfil_exige_membro). Depois de rodar em produção, com a
-- roda já em uso: VACUUM (FULL) interno.alumia_redacao_correcoes e interno.alumia_redacao_leituras de tempos em tempos (fora de
-- transação), para as versões antigas das linhas não ficarem no disco. Teste: scripts/testar-alumia-o11-redacao.mjs.

-- ── 1. As tabelas ───────────────────────────────────────────────────────────────────────────────────────────────────────────

-- O tema de cada semana (a segunda-feira). Sem "quem lançou": é a coordenação.
create table if not exists interno.alumia_redacao_temas (
  semana date primary key check (extract(isodow from semana) = 1),
  titulo text not null check (char_length(titulo) between 10 and 200),
  motivadores text not null default '' check (char_length(motivadores) <= 3000),
  criado_em timestamptz not null default now()
);

-- A redação. A autora fica ligada à própria redação (é dela, ela lê as correções); quem corrigiu, nunca.
create table if not exists interno.alumia_redacoes (
  id uuid primary key default gen_random_uuid(),
  semana date not null references interno.alumia_redacao_temas (semana) on delete cascade,
  autora uuid not null references interno.perfis (id) on delete cascade,
  titulo text not null default '' check (char_length(titulo) <= 100),
  texto text not null check (char_length(texto) between 300 and 3600),
  entregue_em timestamptz not null default now(),
  devolvida_em timestamptz,
  apagar_em timestamptz not null,
  unique (semana, autora)
);
create index if not exists alumia_redacoes_roda on interno.alumia_redacoes (semana) where devolvida_em is null;
create index if not exists alumia_redacoes_apagar on interno.alumia_redacoes (apagar_em);

-- A leitura em andamento: a ÚNICA ligação entre quem corrige e a redação, e só até a devolução (o agendador apaga). Sem hora de
-- início: só o prazo.
create table if not exists interno.alumia_redacao_leituras (
  id uuid primary key default gen_random_uuid(),
  redacao uuid not null references interno.alumia_redacoes (id) on delete cascade,
  corretor uuid not null references interno.perfis (id) on delete cascade,
  prazo timestamptz not null,
  feita boolean not null default false,
  unique (redacao, corretor)
);
create index if not exists alumia_redacao_leituras_corretor on interno.alumia_redacao_leituras (corretor);
alter table interno.alumia_redacao_leituras set (autovacuum_vacuum_threshold = 0, autovacuum_vacuum_scale_factor = 0);

-- A correção: a redação, a ficha e o lacre. Sem corretor, sem hora, sem sequência (o id é sorteado pelo servidor do site).
create table if not exists interno.alumia_redacao_correcoes (
  id uuid primary key,
  redacao uuid not null references interno.alumia_redacoes (id) on delete cascade,
  ficha jsonb not null,
  lacre text check (lacre ~ '^[0-9a-f]{64}$'),
  removida boolean not null default false,
  liberada boolean not null default false
);
-- Liberada: a rodada já regravou a correção e a autora pode ver. A correção nova numa redação já devolvida espera a rodada.
do $$
begin
  if not exists (select 1 from information_schema.columns where table_schema = 'interno' and table_name = 'alumia_redacao_correcoes' and column_name = 'liberada') then
    alter table interno.alumia_redacao_correcoes add column liberada boolean not null default false;
    update interno.alumia_redacao_correcoes c set liberada = true
    from interno.alumia_redacoes r where r.id = c.redacao and r.devolvida_em is not null;
  end if;
end $$;
create index if not exists alumia_redacao_correcoes_redacao on interno.alumia_redacao_correcoes (redacao);
alter table interno.alumia_redacao_correcoes set (autovacuum_vacuum_threshold = 0, autovacuum_vacuum_scale_factor = 0);

-- O crédito da troca: quantas redações a pessoa corrigiu numa roda (as que a rodada já desligou; as outras ainda estão na leitura
-- feita), e se ficou dispensada (pediu para ler e a roda não tinha mais nenhuma redação esperando, com 3 ou mais redações alheias
-- já lidas). Sem redação, sem hora. Medalha: a roda fechou e as correções dela já contaram para a medalha.
create table if not exists interno.alumia_redacao_creditos (
  usuario uuid not null references interno.perfis (id) on delete cascade,
  semana date not null,
  feitas smallint not null default 0 check (feitas >= 0),
  dispensada boolean not null default false,
  medalha boolean not null default false,
  primary key (usuario, semana)
);
alter table interno.alumia_redacao_creditos add column if not exists medalha boolean not null default false;

-- A denúncia de uma correção recebida. Sem "quem denunciou" (é a autora da redação) e sem "quem decidiu".
create table if not exists interno.alumia_redacao_denuncias (
  id uuid primary key default gen_random_uuid(),
  correcao uuid not null unique references interno.alumia_redacao_correcoes (id) on delete cascade,
  motivo text not null check (char_length(motivo) between 10 and 1000),
  situacao text not null default 'aberta' check (situacao in ('aberta', 'abusiva', 'nao_abusiva')),
  afastamento text not null default 'nao' check (afastamento in ('nao', 'pendente', 'feito', 'sem_lacre')),
  nota text not null default '' check (char_length(nota) <= 500),
  criada_em timestamptz not null default now(),
  decidida_em timestamptz
);

-- Quem está fora da roda, e até quando. Sem a correção nem a denúncia.
create table if not exists interno.alumia_redacao_afastadas (
  usuario uuid primary key references interno.perfis (id) on delete cascade,
  ate timestamptz not null
);

alter table interno.alumia_redacao_temas enable row level security;
alter table interno.alumia_redacoes enable row level security;
alter table interno.alumia_redacao_leituras enable row level security;
alter table interno.alumia_redacao_correcoes enable row level security;
alter table interno.alumia_redacao_creditos enable row level security;
alter table interno.alumia_redacao_denuncias enable row level security;
alter table interno.alumia_redacao_afastadas enable row level security;
revoke all on interno.alumia_redacao_temas, interno.alumia_redacoes, interno.alumia_redacao_leituras, interno.alumia_redacao_correcoes,
  interno.alumia_redacao_creditos, interno.alumia_redacao_denuncias, interno.alumia_redacao_afastadas from public;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on interno.alumia_redacao_temas, interno.alumia_redacoes, interno.alumia_redacao_leituras, interno.alumia_redacao_correcoes,
      interno.alumia_redacao_creditos, interno.alumia_redacao_denuncias, interno.alumia_redacao_afastadas from anon, authenticated;
  end if;
end $$;

-- ── 2. As regras ────────────────────────────────────────────────────────────────────────────────────────────────────────────

/** Quem lança o tema: a coordenação do Instituto ou o painel da Alumia (coordenação e admin). */
create or replace function interno.alumia_red_pode_tema() returns boolean language sql stable security definer set search_path = interno, pg_temp as $$
  select auth.uid() is not null and (interno.coord() or interno.alumia_painel_papel() is not null)
$$;

/** Quem decide as denúncias: a mediação do Instituto (os mesmos mediadores da Alumia) e o painel da Alumia. */
create or replace function interno.alumia_red_media() returns boolean language sql stable security definer set search_path = interno, pg_temp as $$
  select auth.uid() is not null and (interno.media() or interno.alumia_painel_papel() is not null)
$$;

/** A roda de uma semana ainda recebe leituras? A do tema desta semana e a da semana passada. */
create or replace function interno.alumia_red_roda_aberta(p_semana date) returns boolean language sql stable as $$
  select p_semana >= interno.semana_atual() - 7 and p_semana <= interno.semana_atual()
$$;

/** Até quando a pessoa está fora da roda (nulo: não está). */
create or replace function interno.alumia_red_afastada(p uuid) returns timestamptz language sql stable security definer set search_path = interno, pg_temp as $$
  select a.ate from alumia_redacao_afastadas a where a.usuario = p and a.ate > now()
$$;

/** Quantas correções a pessoa fez numa roda: as do crédito (já desligadas) e as leituras feitas que a rodada ainda não desligou. */
create or replace function interno.alumia_red_feitas(p uuid, p_semana date) returns integer language sql stable security definer set search_path = interno, pg_temp as $$
  select (coalesce((select c.feitas::integer from alumia_redacao_creditos c where c.usuario = p and c.semana = p_semana), 0)
        + (select count(*) from alumia_redacao_leituras l join alumia_redacoes r on r.id = l.redacao
           where l.corretor = p and l.feita and r.semana = p_semana))::integer
$$;

/** A troca da pessoa naquela roda está cumprida para receber n leituras? (corrigiu n, até 2, ou foi dispensada) */
create or replace function interno.alumia_red_troca_ok(p uuid, p_semana date, p_n integer) returns boolean language sql stable security definer set search_path = interno, pg_temp as $$
  select interno.alumia_red_feitas(p, p_semana) >= least(2, p_n)
      or coalesce((select c.dispensada from alumia_redacao_creditos c where c.usuario = p and c.semana = p_semana), false)
$$;

/** Leituras que contam numa redação: as correções que valem e as leituras abertas. */
create or replace function interno.alumia_red_ocupadas(p_redacao uuid) returns integer language sql stable security definer set search_path = interno, pg_temp as $$
  select ((select count(*) from alumia_redacao_correcoes c where c.redacao = p_redacao and not c.removida)
        + (select count(*) from alumia_redacao_leituras l where l.redacao = p_redacao and not l.feita))::integer
$$;

/**
 * Confere e arruma a ficha de correção: {competencias: [{nota, comentario}] (exatamente 5, na ordem do ENEM), geral}. Nota de 0 a
 * 200, de 40 em 40; comentário de 20 a 800 letras em cada competência; o geral até 800. Devolve a ficha só com esses campos.
 */
create or replace function interno.alumia_red_ficha(p jsonb) returns jsonb language plpgsql immutable as $$
declare v_comp jsonb := '[]'::jsonb; c jsonb; v_nota integer; v_com text; v_geral text;
begin
  if p is null or jsonb_typeof(p) <> 'object' or jsonb_typeof(p -> 'competencias') is distinct from 'array'
     or jsonb_array_length(p -> 'competencias') <> 5 then
    perform interno.erro('invalido:ficha');
  end if;
  for c in select value from jsonb_array_elements(p -> 'competencias') loop
    if jsonb_typeof(c) <> 'object' or jsonb_typeof(c -> 'nota') is distinct from 'number' then perform interno.erro('invalido:nota'); end if;
    begin
      v_nota := (c ->> 'nota')::integer;
    exception when others then
      perform interno.erro('invalido:nota');
    end;
    if (c ->> 'nota')::numeric <> v_nota or v_nota not in (0, 40, 80, 120, 160, 200) then perform interno.erro('invalido:nota'); end if;
    v_com := btrim(coalesce(c ->> 'comentario', ''));
    if char_length(v_com) not between 20 and 800 then perform interno.erro('invalido:comentario'); end if;
    v_comp := v_comp || jsonb_build_array(jsonb_build_object('nota', v_nota, 'comentario', v_com));
  end loop;
  v_geral := btrim(coalesce(p ->> 'geral', ''));
  if char_length(v_geral) > 800 then perform interno.erro('invalido:geral'); end if;
  return jsonb_build_object('competencias', v_comp, 'geral', v_geral);
end $$;

/** A correção como a autora (e a mediação) vê: a ficha e o total. Sem nada de quem corrigiu. */
create or replace function interno.alumia_red_correcao_json(c interno.alumia_redacao_correcoes) returns jsonb language sql stable security definer set search_path = interno, pg_temp as $$
  select jsonb_build_object('id', c.id, 'competencias', c.ficha -> 'competencias', 'geral', c.ficha ->> 'geral',
    'total', (select coalesce(sum((x ->> 'nota')::integer), 0) from jsonb_array_elements(c.ficha -> 'competencias') x),
    'removida', c.removida,
    'denuncia', (select d.situacao from alumia_redacao_denuncias d where d.correcao = c.id))
$$;

/**
 * Uma redação da autora, como a tela dela mostra. Antes da devolução: o texto, a semana, até quando a roda vai e quantas correções
 * faltam para ela cumprir a troca; nenhuma informação sobre as leituras recebidas. Devolvida: as leituras já liberadas pela
 * rodada, em ordem sorteada (pelo id), sem nome, e quando ela some.
 */
create or replace function interno.alumia_red_minha_json(r interno.alumia_redacoes) returns jsonb language sql stable security definer set search_path = interno, pg_temp as $$
  select jsonb_build_object(
    'id', r.id, 'semana', r.semana, 'tema', (select t.titulo from alumia_redacao_temas t where t.semana = r.semana),
    'titulo', r.titulo, 'texto', r.texto, 'entregue_em', r.entregue_em,
    'situacao', case when r.devolvida_em is not null then 'devolvida' when interno.alumia_red_roda_aberta(r.semana) then 'na_roda' else 'encerrada' end,
    'roda_ate', (r.semana + 14)::timestamp at time zone 'America/Sao_Paulo',
    'falta_corrigir', case when r.devolvida_em is null then
      case when interno.alumia_red_troca_ok(r.autora, r.semana, 2) then 0 else greatest(0, 2 - interno.alumia_red_feitas(r.autora, r.semana)) end end,
    'devolvida_em', r.devolvida_em,
    'apagar_em', r.apagar_em,
    'correcoes', case when r.devolvida_em is not null then
      coalesce((select jsonb_agg(interno.alumia_red_correcao_json(c) order by c.id) from alumia_redacao_correcoes c where c.redacao = r.id and c.liberada), '[]'::jsonb) end)
$$;

/**
 * As redações que esta pessoa pode ler agora, com quantas leituras já contam: as da roda aberta ainda não devolvidas, e as devolvidas
 * que tiveram uma leitura tirada pela mediação (voltam para a roda até ter 2 de novo), estas só para quem não corrigiu nada naquela
 * roda (a linha "quem leu o quê" já sumiu; o crédito diz isso sem apontar a redação). Nunca a dela, uma que ela já leu, ou de quem a
 * bloqueou (ou foi bloqueado por ela).
 */
create or replace function interno.alumia_red_candidatas(p uuid) returns table (id uuid, semana date, ocupadas integer, devolvida boolean)
language sql stable security definer set search_path = interno, pg_temp as $$
  select r.id, r.semana, interno.alumia_red_ocupadas(r.id), r.devolvida_em is not null
  from alumia_redacoes r
  where r.autora <> p
    and ((r.devolvida_em is null and interno.alumia_red_roda_aberta(r.semana))
         or (r.devolvida_em is not null and exists (select 1 from alumia_redacao_correcoes c where c.redacao = r.id and c.removida)
             and interno.alumia_red_feitas(p, r.semana) = 0))
    and not exists (select 1 from alumia_redacao_leituras x where x.redacao = r.id and x.corretor = p)
    and not interno.rede_bloqueado(p, r.autora)
$$;

-- ── 3. As funções de membro ─────────────────────────────────────────────────────────────────────────────────────────────────

/**
 * A roda vista por quem chama: o tema da semana, se já entregou, as redações dela (até 6, as mais novas), as leituras abertas (o
 * texto, sem autora), quantas correções fez nas rodas abertas, quantas redações esperam leitura (só a partir de 3), se está fora da
 * roda, e se pode lançar tema ou mediar (com as denúncias abertas).
 */
create or replace function public.alumia_redacao_roda() returns jsonb language plpgsql stable security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); s date := interno.semana_atual(); t alumia_redacao_temas; v_media boolean;
begin
  perform interno.rede3_perfil_exige_membro(v);
  select * into t from alumia_redacao_temas where semana = s;
  v_media := interno.alumia_red_media();
  return jsonb_build_object(
    'semana', s,
    'tema', case when t.semana is not null then jsonb_build_object('semana', t.semana, 'titulo', t.titulo, 'motivadores', t.motivadores,
      'ate', (s + 7)::timestamp at time zone 'America/Sao_Paulo') end,
    'entreguei', exists (select 1 from alumia_redacoes r where r.autora = v and r.semana = s),
    'afastada_ate', interno.alumia_red_afastada(v),
    'minhas', coalesce((select jsonb_agg(interno.alumia_red_minha_json(r) order by r.semana desc)
      from (select * from alumia_redacoes r where r.autora = v order by r.semana desc limit 6) r), '[]'::jsonb),
    'leituras', coalesce((select jsonb_agg(jsonb_build_object('id', l.id, 'prazo', l.prazo, 'semana', r.semana,
        'tema', tm.titulo, 'motivadores', tm.motivadores, 'titulo', r.titulo, 'texto', r.texto) order by l.prazo)
      from alumia_redacao_leituras l join alumia_redacoes r on r.id = l.redacao join alumia_redacao_temas tm on tm.semana = r.semana
      where l.corretor = v and not l.feita and l.prazo > now()), '[]'::jsonb),
    'corrigi', jsonb_build_array(
      jsonb_build_object('semana', s, 'feitas', interno.alumia_red_feitas(v, s)),
      jsonb_build_object('semana', s - 7, 'feitas', interno.alumia_red_feitas(v, s - 7))),
    'esperando', interno.alumia_pessoas((select count(*) from alumia_redacoes r
      where r.autora <> v and r.devolvida_em is null and interno.alumia_red_roda_aberta(r.semana) and interno.alumia_red_ocupadas(r.id) < 2)),
    'pode_tema', interno.alumia_red_pode_tema(),
    'pode_mediar', v_media,
    'denuncias_abertas', case when v_media then (select count(*) from alumia_redacao_denuncias d where d.situacao = 'aberta' or d.afastamento = 'pendente') end);
end $$;

/** Entrega a redação desta semana (uma por pessoa). Precisa de tema lançado. */
create or replace function public.alumia_redacao_entregar(p_titulo text, p_texto text) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); s date := interno.semana_atual(); r alumia_redacoes; v_titulo text := btrim(coalesce(p_titulo, '')); v_texto text := btrim(coalesce(p_texto, ''));
begin
  perform interno.rede3_perfil_exige_membro(v);
  if interno.alumia_red_afastada(v) is not null then perform interno.erro('afastada'); end if;
  if not exists (select 1 from alumia_redacao_temas t where t.semana = s) then perform interno.erro('sem_tema'); end if;
  if char_length(v_titulo) > 100 then perform interno.erro('invalido:titulo'); end if;
  if char_length(v_texto) < 300 then perform interno.erro('invalido:curta'); end if;
  if char_length(v_texto) > 3600 then perform interno.erro('invalido:longa'); end if;
  perform interno.limite('alumia_redacao_entregar', 5, 60);
  insert into alumia_redacoes (semana, autora, titulo, texto, apagar_em)
  values (s, v, v_titulo, v_texto, (s + 21)::timestamp at time zone 'America/Sao_Paulo')
  on conflict (semana, autora) do nothing
  returning * into r;
  if r.id is null then perform interno.erro('ja_entregou'); end if;
  return interno.alumia_red_minha_json(r);
end $$;

/** A autora apaga a redação dela, quando quiser: com ela vão as leituras, as correções e as denúncias. */
create or replace function public.alumia_redacao_apagar(p_id uuid) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu();
begin
  delete from alumia_redacoes where id = p_id and autora = v;
  if not found then perform interno.erro('nao_encontrado'); end if;
  return jsonb_build_object('apagada', true);
end $$;

/**
 * Pede uma redação para ler. Sorteia entre as da roda que ainda precisam de leitura: primeiro as da roda em que a pessoa ainda deve
 * correções (a da redação dela), depois as que têm menos leituras; nunca a dela, uma que ela já leu ou de quem a bloqueou. Sem
 * redação com menos de 2 leituras, uma terceira leitura numa ainda não devolvida. Devolve o texto, o tema e o prazo; nunca a autora. Sem nada para ler:
 * {nenhuma: true, dispensada} (veja a roda cheia, abaixo).
 */
create or replace function public.alumia_redacao_pegar() returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); s date := interno.semana_atual(); v_deve date; v_redacao uuid; l alumia_redacao_leituras; r alumia_redacoes; t alumia_redacao_temas;
begin
  perform interno.rede3_perfil_exige_membro(v);
  if interno.alumia_red_afastada(v) is not null then perform interno.erro('afastada'); end if;
  if (select count(*) from alumia_redacao_leituras x where x.corretor = v and not x.feita and x.prazo > now()) >= 2 then perform interno.erro('leituras_abertas'); end if;
  perform interno.limite('alumia_redacao_pegar', 30, 60);
  -- A roda em que a pessoa ainda deve correções (a da redação dela, ainda não devolvida).
  select r0.semana into v_deve from alumia_redacoes r0
  where r0.autora = v and r0.devolvida_em is null and interno.alumia_red_roda_aberta(r0.semana) and not interno.alumia_red_troca_ok(v, r0.semana, 2)
  order by r0.semana limit 1;
  -- Uma leitura por vez em toda a roda: duas pessoas pedindo juntas não pegam a mesma vaga.
  perform pg_advisory_xact_lock(hashtextextended('alumia_redacao_roda', 0));
  delete from alumia_redacao_leituras x where not x.feita and x.prazo <= now();
  -- Primeiro as que têm menos de 2 leituras; sem nenhuma, uma terceira leitura numa da roda aberta ainda não devolvida.
  select c.id into v_redacao from interno.alumia_red_candidatas(v) c
  where c.ocupadas < 2
  order by (c.semana = v_deve) desc nulls last, c.ocupadas, gen_random_uuid() limit 1;
  if v_redacao is null then
    select c.id into v_redacao from interno.alumia_red_candidatas(v) c
    where c.ocupadas < 3 and interno.alumia_red_roda_aberta(c.semana)
    order by (c.semana = v_deve) desc nulls last, c.ocupadas, gen_random_uuid() limit 1;
  end if;
  if v_redacao is null then
    -- Nada para ler. Se a pessoa deve correções numa roda em que 3 ou mais redações alheias já têm todas as leituras, a roda está
    -- cheia: a troca dela fica cumprida (ela tentou e não havia o que ler). Não é erro: o que foi gravado tem de ficar.
    if v_deve is not null and (select count(*) from alumia_redacoes r3 where r3.autora <> v and r3.semana = v_deve) >= 3 then
      insert into alumia_redacao_creditos (usuario, semana, dispensada) values (v, v_deve, true)
      on conflict (usuario, semana) do update set dispensada = true;
      return jsonb_build_object('nenhuma', true, 'dispensada', true);
    end if;
    return jsonb_build_object('nenhuma', true, 'dispensada', false);
  end if;
  insert into alumia_redacao_leituras (redacao, corretor, prazo) values (v_redacao, v, now() + interval '72 hours') returning * into l;
  select * into r from alumia_redacoes where id = v_redacao;
  select * into t from alumia_redacao_temas where semana = r.semana;
  return jsonb_build_object('id', l.id, 'prazo', l.prazo, 'semana', r.semana, 'tema', t.titulo, 'motivadores', t.motivadores,
    'titulo', r.titulo, 'texto', r.texto);
end $$;

/** Larga uma leitura aberta (a redação volta para a roda). */
create or replace function public.alumia_redacao_largar(p_leitura uuid) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu();
begin
  delete from alumia_redacao_leituras where id = p_leitura and corretor = v and not feita;
  if not found then perform interno.erro('nao_encontrado'); end if;
  return jsonb_build_object('largada', true);
end $$;

/** A autora denuncia uma leitura que recebeu (já devolvida, uma denúncia por leitura). Vai à mediação. */
create or replace function public.alumia_redacao_denunciar(p_correcao uuid, p_motivo text) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); c alumia_redacao_correcoes; v_motivo text := btrim(coalesce(p_motivo, ''));
begin
  perform interno.rede3_perfil_exige_membro(v);
  select c1.* into c from alumia_redacao_correcoes c1 join alumia_redacoes r on r.id = c1.redacao
  where c1.id = p_correcao and r.autora = v and r.devolvida_em is not null and c1.liberada;
  if c.id is null then perform interno.erro('nao_encontrado'); end if;
  if c.removida then perform interno.erro('ja_removida'); end if;
  if char_length(v_motivo) not between 10 and 1000 then perform interno.erro('invalido:motivo'); end if;
  perform interno.limite('alumia_redacao_denunciar', 10, 60);
  insert into alumia_redacao_denuncias (correcao, motivo) values (c.id, v_motivo) on conflict (correcao) do nothing;
  if not found then perform interno.erro('ja_denunciada'); end if;
  return interno.alumia_red_correcao_json(c);
end $$;

/**
 * Os temas para a coordenação: da semana passada até 8 semanas à frente, com o tema (ou nulo) e se ainda dá para mudar (ninguém
 * entregou redação nele) e quantas redações chegaram (só a partir de 3).
 */
create or replace function public.alumia_redacao_temas() returns jsonb language plpgsql stable security definer set search_path = interno, pg_temp as $$
declare s date := interno.semana_atual();
begin
  if not interno.alumia_red_pode_tema() then perform interno.erro('sem_permissao'); end if;
  return coalesce((select jsonb_agg(jsonb_build_object(
      'semana', w.semana, 'titulo', t.titulo, 'motivadores', t.motivadores,
      'editavel', w.semana >= s and not exists (select 1 from alumia_redacoes r where r.semana = w.semana),
      'redacoes', interno.alumia_pessoas((select count(*) from alumia_redacoes r where r.semana = w.semana))) order by w.semana)
    from (select (s + 7 * i) as semana from generate_series(-1, 8) i) w left join alumia_redacao_temas t on t.semana = w.semana), '[]'::jsonb);
end $$;

/** A coordenação lança (ou troca) o tema de uma semana: desta até 12 semanas à frente, enquanto ninguém entregou redação nele. */
create or replace function public.alumia_redacao_tema_definir(p_semana date, p_titulo text, p_motivadores text) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); s date := interno.semana_atual(); v_titulo text := btrim(coalesce(p_titulo, '')); v_mot text := btrim(coalesce(p_motivadores, ''));
begin
  if not interno.alumia_red_pode_tema() then perform interno.erro('sem_permissao'); end if;
  if p_semana is null or extract(isodow from p_semana) <> 1 or p_semana < s or p_semana > s + 7 * 12 then perform interno.erro('invalido:semana'); end if;
  if char_length(v_titulo) not between 10 and 200 then perform interno.erro('invalido:titulo'); end if;
  if char_length(v_mot) > 3000 then perform interno.erro('invalido:motivadores'); end if;
  if exists (select 1 from alumia_redacoes r where r.semana = p_semana) then perform interno.erro('ja_tem_redacao'); end if;
  perform interno.limite('alumia_redacao_tema', 30, 60);
  insert into alumia_redacao_temas (semana, titulo, motivadores) values (p_semana, v_titulo, v_mot)
  on conflict (semana) do update set titulo = excluded.titulo, motivadores = excluded.motivadores;
  return jsonb_build_object('semana', p_semana, 'titulo', v_titulo, 'motivadores', v_mot, 'editavel', true);
end $$;

/**
 * A fila da mediação: as denúncias abertas (e as já julgadas abusivas com o afastamento ainda pendente), com a correção, o tema e o
 * texto da redação, para julgar. Nada de quem escreveu nem de quem corrigiu.
 */
create or replace function public.alumia_redacao_mediacao() returns jsonb language plpgsql stable security definer set search_path = interno, pg_temp as $$
begin
  if not interno.alumia_red_media() then perform interno.erro('sem_permissao'); end if;
  return coalesce((select jsonb_agg(jsonb_build_object(
      'id', d.id, 'motivo', d.motivo, 'situacao', d.situacao, 'afastamento', d.afastamento, 'criada_em', d.criada_em,
      'tema', t.titulo, 'titulo', r.titulo, 'texto', r.texto, 'correcao', interno.alumia_red_correcao_json(c)) order by d.criada_em)
    from alumia_redacao_denuncias d join alumia_redacao_correcoes c on c.id = d.correcao join alumia_redacoes r on r.id = c.redacao
      join alumia_redacao_temas t on t.semana = r.semana
    where d.situacao = 'aberta' or d.afastamento = 'pendente'), '[]'::jsonb);
end $$;

/**
 * A mediação decide uma denúncia. Não abusiva: fica como está. Abusiva: a leitura sai da tela da autora, a redação volta para a roda
 * para uma leitura nova, e o afastamento de quem escreveu fica pendente para o servidor do site (que confere o lacre); sem lacre,
 * ninguém é afastado. A nota (opcional) é para a própria mediação.
 */
create or replace function public.alumia_redacao_mediar(p_denuncia uuid, p_abusiva boolean, p_nota text default '') returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare d alumia_redacao_denuncias; c alumia_redacao_correcoes; v_nota text := btrim(coalesce(p_nota, ''));
begin
  if not interno.alumia_red_media() then perform interno.erro('sem_permissao'); end if;
  if p_abusiva is null then perform interno.erro('invalido:decisao'); end if;
  if char_length(v_nota) > 500 then perform interno.erro('invalido:nota'); end if;
  select * into d from alumia_redacao_denuncias where id = p_denuncia for update;
  if not found then perform interno.erro('nao_encontrado'); end if;
  if d.situacao <> 'aberta' then perform interno.erro('ja_decidida'); end if;
  select * into c from alumia_redacao_correcoes where id = d.correcao;
  if p_abusiva then
    update alumia_redacao_correcoes set removida = true where id = c.id;
    update alumia_redacao_denuncias set situacao = 'abusiva', decidida_em = now(), nota = v_nota,
      afastamento = case when c.lacre is null then 'sem_lacre' else 'pendente' end
    where id = d.id returning * into d;
  else
    update alumia_redacao_denuncias set situacao = 'nao_abusiva', decidida_em = now(), nota = v_nota where id = d.id returning * into d;
  end if;
  return jsonb_build_object('id', d.id, 'situacao', d.situacao, 'afastamento', d.afastamento);
end $$;

-- ── 4. As funções do servidor do site (só a chave de serviço) ───────────────────────────────────────────────────────────────

/**
 * Grava uma correção. O servidor do site confere a sessão, sorteia o id da correção e calcula o lacre; aqui, a leitura tem de ser
 * desta pessoa, aberta e no prazo, e a ficha tem de valer. A leitura fica marcada como feita (até a devolução, para a mesma pessoa
 * não ler a mesma redação de novo, e é ela que conta na troca até lá). O crédito NÃO muda aqui (a linha do crédito na transação da
 * correção ligaria a pessoa à correção): quem passa a leitura para o crédito é a rodada. Nenhum freio por conta aqui pelo mesmo
 * motivo: o freio é do servidor.
 */
create or replace function public.alumia_redacao_corrigir(p_usuario uuid, p_leitura uuid, p_correcao uuid, p_ficha jsonb, p_lacre text) returns jsonb
language plpgsql security definer set search_path = interno, pg_temp as $$
declare l alumia_redacao_leituras; r alumia_redacoes; v_ficha jsonb;
begin
  if not interno.servico() then perform interno.erro('sem_permissao'); end if;
  if p_usuario is null or not exists (select 1 from perfis where id = p_usuario and not suspenso) then perform interno.erro('sem_permissao'); end if;
  perform interno.rede3_perfil_exige_membro(p_usuario);
  if interno.alumia_red_afastada(p_usuario) is not null then perform interno.erro('afastada'); end if;
  if p_correcao is null then perform interno.erro('invalido:correcao'); end if;
  if p_lacre is not null and p_lacre !~ '^[0-9a-f]{64}$' then perform interno.erro('invalido:lacre'); end if;
  select * into l from alumia_redacao_leituras where id = p_leitura and corretor = p_usuario for update;
  if not found or l.feita then perform interno.erro('nao_encontrado'); end if;
  if l.prazo <= now() then perform interno.erro('prazo'); end if;
  v_ficha := interno.alumia_red_ficha(p_ficha);
  select * into r from alumia_redacoes where id = l.redacao;
  insert into alumia_redacao_correcoes (id, redacao, ficha, lacre) values (p_correcao, r.id, v_ficha, p_lacre);
  update alumia_redacao_leituras set feita = true where id = l.id;
  return jsonb_build_object('corrigida', true, 'feitas', interno.alumia_red_feitas(p_usuario, r.semana));
end $$;

/**
 * Para afastar quem escreveu uma correção julgada abusiva: o lacre, o id da correção e as pessoas que corrigiram naquela roda (o
 * servidor confere o lacre contra cada uma). Só com a denúncia julgada abusiva e o afastamento pendente.
 */
create or replace function public.alumia_redacao_afastar_dados(p_denuncia uuid) returns jsonb language plpgsql stable security definer set search_path = interno, pg_temp as $$
declare d alumia_redacao_denuncias; c alumia_redacao_correcoes; v_semana date;
begin
  if not interno.servico() then perform interno.erro('sem_permissao'); end if;
  select * into d from alumia_redacao_denuncias where id = p_denuncia;
  if not found then perform interno.erro('nao_encontrado'); end if;
  if d.situacao <> 'abusiva' or d.afastamento <> 'pendente' then return jsonb_build_object('pendente', false); end if;
  select * into c from alumia_redacao_correcoes where id = d.correcao;
  select r.semana into v_semana from alumia_redacoes r where r.id = c.redacao;
  return jsonb_build_object('pendente', true, 'correcao', c.id, 'lacre', c.lacre,
    'candidatos', coalesce((select jsonb_agg(distinct x.usuario) from (
        select k.usuario from alumia_redacao_creditos k where k.semana = v_semana and k.feitas > 0
        union select l.corretor from alumia_redacao_leituras l join alumia_redacoes r on r.id = l.redacao where l.feita and r.semana = v_semana) x), '[]'::jsonb));
end $$;

/**
 * Afasta da roda por 8 semanas a pessoa cujo lacre bateu (nulo: nenhuma bateu). O lacre é apagado e o afastamento fica "feito" (ou
 * "sem_lacre"). A denúncia não guarda a pessoa.
 */
create or replace function public.alumia_redacao_afastar(p_denuncia uuid, p_usuario uuid) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare d alumia_redacao_denuncias; v_ate timestamptz := date_trunc('day', now()) + interval '56 days';
begin
  if not interno.servico() then perform interno.erro('sem_permissao'); end if;
  select * into d from alumia_redacao_denuncias where id = p_denuncia for update;
  if not found then perform interno.erro('nao_encontrado'); end if;
  if d.situacao <> 'abusiva' or d.afastamento <> 'pendente' then return jsonb_build_object('afastamento', d.afastamento); end if;
  if p_usuario is not null and exists (select 1 from perfis where id = p_usuario) then
    insert into alumia_redacao_afastadas (usuario, ate) values (p_usuario, v_ate)
    on conflict (usuario) do update set ate = greatest(alumia_redacao_afastadas.ate, excluded.ate);
    -- As leituras abertas dela voltam para a roda.
    delete from alumia_redacao_leituras where corretor = p_usuario and not feita;
  end if;
  update alumia_redacao_correcoes set lacre = null where id = d.correcao;
  update alumia_redacao_denuncias set afastamento = case when p_usuario is null then 'sem_lacre' else 'feito' end where id = d.id returning * into d;
  return jsonb_build_object('afastamento', d.afastamento);
end $$;

-- ── 5. O agendador: devolver, soltar o que venceu e apagar de vez ───────────────────────────────────────────────────────────

/**
 * Roda a cada 10 minutos (pg_cron), numa transação só dela:
 *   - solta as leituras abertas que passaram do prazo;
 *   - DEVOLVE as redações prontas: 2 leituras feitas (ou a roda fechada com 1 ou mais, sem leitura aberta) e a troca cumprida (a
 *     autora corrigiu na mesma roda pelo menos 2, ou tantas quantas recebeu);
 *   - DESLIGA quem leu do que leu, nas redações devolvidas e nas da roda já fechada: as leituras feitas somem e viram crédito; os
 *     créditos daquelas rodas são apagados e escritos de novo em ordem sorteada; as correções são apagadas e escritas de novo em
 *     ordem sorteada (com as denúncias delas), e as das redações devolvidas ficam LIBERADAS para a autora. As leituras feitas
 *     depois da devolução (a leitura nova de uma redação que voltou à roda) seguem o mesmo caminho na rodada seguinte;
 *   - conta a medalha da redação de todo mundo das rodas que fecharam (interno.alumia_o11_feito, uma vez por correção);
 *   - apaga DE VEZ as redações vencidas (30 dias depois da devolução; 21 dias depois do começo da semana, se não foi devolvida),
 *     com as correções e as denúncias; os créditos de rodas com mais de 9 semanas; os afastamentos vencidos.
 */
create or replace function interno.alumia_redacao_rodada() returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v_soltas integer; v_novas integer; v_alvo uuid[]; v_semanas date[]; v_lidas jsonb; v_creditos jsonb; v_correcoes jsonb; v_denuncias jsonb;
  v_apagadas integer; v_medalhas integer := 0; m record;
begin
  perform pg_advisory_xact_lock(hashtextextended('alumia_redacao_roda', 0));
  delete from alumia_redacao_leituras where not feita and prazo <= now();
  get diagnostics v_soltas = row_count;

  with prontas as (
    select r.id from alumia_redacoes r
    cross join lateral (select count(*) as n from alumia_redacao_correcoes c where c.redacao = r.id and not c.removida) k
    where r.devolvida_em is null and k.n >= 1
      and interno.alumia_red_troca_ok(r.autora, r.semana, k.n::integer)
      and (k.n >= 2 or (not interno.alumia_red_roda_aberta(r.semana)
                        and not exists (select 1 from alumia_redacao_leituras l where l.redacao = r.id and not l.feita)))),
  feitas as (
    update alumia_redacoes r set devolvida_em = now(), apagar_em = now() + interval '30 days'
    from prontas where r.id = prontas.id
    returning r.id)
  select count(*) into v_novas from feitas;

  -- O que se desliga: as redações com leitura feita que já foram devolvidas ou cuja roda fechou, e as devolvidas com correção
  -- ainda não liberada.
  select coalesce(array_agg(r.id), '{}'), coalesce(array_agg(distinct r.semana), '{}') into v_alvo, v_semanas from alumia_redacoes r
  where (exists (select 1 from alumia_redacao_leituras l where l.redacao = r.id and l.feita)
         and (r.devolvida_em is not null or not interno.alumia_red_roda_aberta(r.semana)))
     or (r.devolvida_em is not null and exists (select 1 from alumia_redacao_correcoes c where c.redacao = r.id and not c.liberada));

  if cardinality(v_alvo) > 0 then
    -- As leituras feitas somem e viram crédito.
    with fora as (delete from alumia_redacao_leituras l using alumia_redacoes r
                  where r.id = l.redacao and l.feita and l.redacao = any (v_alvo) returning l.corretor, r.semana)
    select coalesce(jsonb_agg(jsonb_build_object('usuario', corretor, 'semana', semana)), '[]'::jsonb) into v_lidas from fora;
    -- Os créditos daquelas rodas, de todo mundo, apagados e escritos de novo em ordem sorteada.
    with antigos as (delete from alumia_redacao_creditos c where c.semana = any (v_semanas) returning c.*)
    select coalesce(jsonb_agg(to_jsonb(antigos)), '[]'::jsonb) into v_creditos from antigos;
    insert into alumia_redacao_creditos (usuario, semana, feitas, dispensada, medalha)
    select x.usuario, x.semana, least(sum(x.feitas), 32767)::smallint, bool_or(x.dispensada), bool_or(x.medalha)
    from (
      select (e ->> 'usuario')::uuid usuario, (e ->> 'semana')::date semana, (e ->> 'feitas')::integer feitas,
             (e ->> 'dispensada')::boolean dispensada, (e ->> 'medalha')::boolean medalha from jsonb_array_elements(v_creditos) e
      union all
      select (e ->> 'usuario')::uuid, (e ->> 'semana')::date, 1, false, false from jsonb_array_elements(v_lidas) e
    ) x
    where exists (select 1 from perfis f where f.id = x.usuario)
    group by x.usuario, x.semana
    order by gen_random_uuid();
    -- As correções (e as denúncias delas), apagadas e escritas de novo em ordem sorteada; liberadas as das redações devolvidas.
    select coalesce(jsonb_agg(to_jsonb(d)), '[]'::jsonb) into v_denuncias from alumia_redacao_denuncias d
    join alumia_redacao_correcoes c on c.id = d.correcao where c.redacao = any (v_alvo);
    with antigas as (delete from alumia_redacao_correcoes c where c.redacao = any (v_alvo) returning c.*)
    select coalesce(jsonb_agg(to_jsonb(antigas)), '[]'::jsonb) into v_correcoes from antigas;
    insert into alumia_redacao_correcoes (id, redacao, ficha, lacre, removida, liberada)
    select (e ->> 'id')::uuid, (e ->> 'redacao')::uuid, e -> 'ficha', e ->> 'lacre', (e ->> 'removida')::boolean,
           (e ->> 'liberada')::boolean or r.devolvida_em is not null
    from jsonb_array_elements(v_correcoes) e join alumia_redacoes r on r.id = (e ->> 'redacao')::uuid
    order by gen_random_uuid();
    insert into alumia_redacao_denuncias select * from jsonb_populate_recordset(null::alumia_redacao_denuncias, v_denuncias) order by gen_random_uuid();
  end if;

  -- A medalha da redação: quando a roda fecha, todo mundo daquela roda de uma vez (uma vez por correção).
  if to_regprocedure('interno.alumia_o11_feito(uuid, text)') is not null then
    for m in select c.usuario, c.feitas from alumia_redacao_creditos c
             where not c.medalha and c.feitas > 0 and not interno.alumia_red_roda_aberta(c.semana) and c.semana < interno.semana_atual()
             order by gen_random_uuid() loop
      perform interno.alumia_o11_feito(m.usuario, 'redacao') from generate_series(1, m.feitas);
      v_medalhas := v_medalhas + 1;
    end loop;
  end if;
  update alumia_redacao_creditos c set medalha = true
  where not c.medalha and not interno.alumia_red_roda_aberta(c.semana) and c.semana < interno.semana_atual();

  delete from alumia_redacoes where apagar_em <= now();
  get diagnostics v_apagadas = row_count;
  delete from alumia_redacao_creditos where semana < interno.semana_atual() - 63;
  delete from alumia_redacao_afastadas where ate <= now();
  return jsonb_build_object('soltas', v_soltas, 'devolvidas', v_novas, 'desligadas', cardinality(v_alvo), 'medalhas', v_medalhas, 'apagadas', v_apagadas);
end $$;

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule('alumia-redacao-rodada', '*/10 * * * *', 'select interno.alumia_redacao_rodada()');
  end if;
exception when others then null;
end $$;

-- ── 6. Quem chama o quê ─────────────────────────────────────────────────────────────────────────────────────────────────────

revoke all on function interno.alumia_red_pode_tema(), interno.alumia_red_media(), interno.alumia_red_roda_aberta(date), interno.alumia_red_afastada(uuid),
  interno.alumia_red_feitas(uuid, date), interno.alumia_red_troca_ok(uuid, date, integer), interno.alumia_red_ocupadas(uuid), interno.alumia_red_candidatas(uuid), interno.alumia_red_ficha(jsonb),
  interno.alumia_red_correcao_json(interno.alumia_redacao_correcoes), interno.alumia_red_minha_json(interno.alumia_redacoes),
  interno.alumia_redacao_rodada() from public;
revoke all on function public.alumia_redacao_roda(), public.alumia_redacao_entregar(text, text), public.alumia_redacao_apagar(uuid),
  public.alumia_redacao_pegar(), public.alumia_redacao_largar(uuid), public.alumia_redacao_denunciar(uuid, text), public.alumia_redacao_temas(),
  public.alumia_redacao_tema_definir(date, text, text), public.alumia_redacao_mediacao(), public.alumia_redacao_mediar(uuid, boolean, text),
  public.alumia_redacao_corrigir(uuid, uuid, uuid, jsonb, text), public.alumia_redacao_afastar_dados(uuid), public.alumia_redacao_afastar(uuid, uuid) from public;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on function interno.alumia_red_pode_tema(), interno.alumia_red_media(), interno.alumia_red_roda_aberta(date), interno.alumia_red_afastada(uuid),
      interno.alumia_red_feitas(uuid, date), interno.alumia_red_troca_ok(uuid, date, integer), interno.alumia_red_ocupadas(uuid), interno.alumia_red_candidatas(uuid), interno.alumia_red_ficha(jsonb),
      interno.alumia_red_correcao_json(interno.alumia_redacao_correcoes), interno.alumia_red_minha_json(interno.alumia_redacoes),
      interno.alumia_redacao_rodada() from anon, authenticated;
    revoke all on function public.alumia_redacao_roda(), public.alumia_redacao_entregar(text, text), public.alumia_redacao_apagar(uuid),
      public.alumia_redacao_pegar(), public.alumia_redacao_largar(uuid), public.alumia_redacao_denunciar(uuid, text), public.alumia_redacao_temas(),
      public.alumia_redacao_tema_definir(date, text, text), public.alumia_redacao_mediacao(), public.alumia_redacao_mediar(uuid, boolean, text),
      public.alumia_redacao_corrigir(uuid, uuid, uuid, jsonb, text), public.alumia_redacao_afastar_dados(uuid), public.alumia_redacao_afastar(uuid, uuid) from anon, authenticated;
    grant execute on function public.alumia_redacao_roda(), public.alumia_redacao_entregar(text, text), public.alumia_redacao_apagar(uuid),
      public.alumia_redacao_pegar(), public.alumia_redacao_largar(uuid), public.alumia_redacao_denunciar(uuid, text), public.alumia_redacao_temas(),
      public.alumia_redacao_tema_definir(date, text, text), public.alumia_redacao_mediacao(), public.alumia_redacao_mediar(uuid, boolean, text) to authenticated, service_role;
    grant execute on function public.alumia_redacao_corrigir(uuid, uuid, uuid, jsonb, text), public.alumia_redacao_afastar_dados(uuid),
      public.alumia_redacao_afastar(uuid, uuid) to service_role;
  end if;
end $$;

select interno.alumia_trancar();
