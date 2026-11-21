-- Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
-- Alumia · Prompt 4 · item 4: avisos de local, no estilo do Waze, sem autor.
--
-- Roda depois de 20261126-p5-fim.sql (banco na versão 17). Não mexe na versão nem na lista da porta: o 20261127-p4-fim.sql faz isso.
-- Não redefine nenhuma função que já existia: todas as funções daqui (rede_local_*) são novas.
--
-- O que faz:
--   1. O interruptor "alumia-p4-avisos-de-local" no catálogo (só pelo nome, desligado). Desligado, o banco recusa tudo daqui.
--   2. Os avisos (interno.rede_local_avisos): uma célula da grade de cerca de 200 m (o aparelho arredonda a posição antes de enviar:
--      o banco só recebe os dois números inteiros da célula), uma categoria de uma lista fechada (sem texto livre, sem foto, nenhuma
--      categoria nomeia a polícia), o horário arredondado para 10 minutos e o fim, 2 horas depois. "Ainda está lá" renova uma vez.
--      O aviso NÃO tem autor: nenhuma coluna liga o aviso a uma conta.
--   3. A confirmação: o aviso fica "sem confirmação" até 3 relatos distintos na mesma célula e categoria, dentro da mesma hora; então
--      vira "relatos confirmados". Nenhuma função devolve o número de relatos (nunca número abaixo de 3, nem acima).
--   4. O limite contra abuso fica em OUTRA tabela (interno.rede_local_limite), sem ligação com o aviso: só a conta e a hora (um
--      número inteiro, a hora cheia), sem célula, sem categoria, sem id de aviso. Cada conta faz UMA coisa por hora (avisar,
--      confirmar ou renovar); é isso que garante que 3 relatos da mesma hora vêm de 3 pessoas. A cada ação, as linhas da hora são
--      regravadas em ordem sorteada (nem a ordem no disco nem a transação que gravou dizem quem agiu por último), e as das horas
--      passadas somem. Os passes anônimos (lib/rede/passes) ainda não entram aqui: um passe geral não diz se 3 relatos vêm de 3
--      pessoas, e um passe por área e hora pediria um tipo novo de contexto nos passes (hoje só as urnas têm), o que já é mexer
--      no protocolo.
--   5. Quem vê: só membro da Alumia com conta logada (interno.rede2_membro). Nunca a internet aberta, a prévia de link nem o
--      Fediverso: nada daqui sai por função sem conta. A leitura devolve só a vizinhança pedida (3 x 3 áreas de cerca de 2 km).
--   6. A moderação (interno.cuida) apaga um aviso e trava uma área de cerca de 2 km por até 72 horas; a trava apaga os avisos dela.
--      Um aviso nunca dispara push para ninguém: só aparece no mapa e para quem segue a área (a lista das áreas seguidas fica no
--      aparelho, nunca no banco).
--   7. A faxina: o aviso vencido some (relato falso some quando expira), a cada chamada e de hora em hora pelo pg_cron.
--
-- O limite do anonimato, dito também na tela: vale perante as outras pessoas, não perante o servidor. Quem opera o servidor vê o
-- pedido chegar (com a conta) nos registros da API; o banco não guarda isso, mas o caminho até ele passa por lá. Enquanto o
-- limite não usar passes anônimos, o pedido leva a conta.
--
-- Pode rodar mais de uma vez, sem apagar dado nenhum além dos avisos vencidos. Nenhuma coluna de endereço de rede.
-- Lei: LGPD art. 6º, III (necessidade: sem autor, posição em célula de 200 m, horário em 10 minutos, tudo some em horas),
-- art. 11 (o lugar de um ato revela opinião política) e art. 46 (segurança). Marco Civil, art. 15: nada de registro de acesso aqui.
-- Teste: npm run testar:p4-avisos-de-local.

-- ── 1. O interruptor ──────────────────────────────────────────────────────────────────────────────────────────────────────
do $$
begin
  if to_regclass('interno.recursos_catalogo') is not null then
    insert into interno.recursos_catalogo (nome, so_pelo_nome) values ('alumia-p4-avisos-de-local', true)
      on conflict (nome) do update set so_pelo_nome = true;
  end if;
end $$;

-- ── 2. As tabelas ─────────────────────────────────────────────────────────────────────────────────────────────────────────

-- Um aviso: célula, categoria e tempo. SEM autor, de propósito. A célula é o par de inteiros que o aparelho manda
-- (floor(lat / 0,002) e floor(lon / 0,002)); o banco nunca recebe a posição de verdade.
create table if not exists interno.rede_local_avisos (
  id uuid primary key default gen_random_uuid(),
  la integer not null check (la >= -45000 and la < 45000),
  lo integer not null check (lo >= -90000 and lo < 90000),
  categoria text not null check (categoria in ('cuidado', 'assalto', 'obra', 'violencia_manifestantes', 'rua_bloqueada', 'alagamento')),
  -- Arredondado para baixo, em 10 minutos (o banco confere).
  criado_em timestamptz not null check (extract(epoch from criado_em)::bigint % 600 = 0),
  expira_em timestamptz not null check (expira_em > criado_em and expira_em <= criado_em + interval '4 hours 10 minutes'),
  renovado boolean not null default false,
  confirmado boolean not null default false,
  -- A hora (cheia) em que os relatos estão sendo contados e quantos vieram nela (1 a 3). Nunca sai em função.
  bloco integer not null,
  relatos_no_bloco smallint not null default 1 check (relatos_no_bloco between 1 and 3),
  unique (la, lo, categoria)
);
create index if not exists rede_local_avisos_expira on interno.rede_local_avisos (expira_em);

-- O limite contra abuso: a conta e a hora cheia. Sem célula, sem categoria, sem aviso.
create table if not exists interno.rede_local_limite (
  usuario uuid not null references interno.perfis (id) on delete cascade,
  bloco integer not null,
  primary key (usuario, bloco)
);

-- A trava de uma área (10 x 10 células, cerca de 2 km). Quem travou fica no registro de atividades, não aqui.
create table if not exists interno.rede_local_travas (
  ala integer not null,
  alo integer not null,
  ate timestamptz not null,
  motivo text not null check (motivo in ('infiltracao', 'abuso', 'risco', 'outro')),
  primary key (ala, alo)
);

alter table interno.rede_local_avisos enable row level security;
alter table interno.rede_local_limite enable row level security;
alter table interno.rede_local_travas enable row level security;
revoke all on table interno.rede_local_avisos, interno.rede_local_limite, interno.rede_local_travas from public;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on table interno.rede_local_avisos, interno.rede_local_limite, interno.rede_local_travas from anon, authenticated;
  end if;
end $$;

-- ── 3. As peças de dentro ─────────────────────────────────────────────────────────────────────────────────────────────────

/**
 * Os avisos de local estão ligados? Só com decisão explícita do painel (o recurso é "só pelo nome") e sem a Alumia desligada lá.
 * Sem a tabela de recursos: desligado.
 */
create or replace function interno.rede_local_ligado() returns boolean language plpgsql stable security definer set search_path = interno, pg_temp as $$
begin
  if to_regclass('interno.recursos_vivos') is null then return false; end if;
  if exists (select 1 from recursos_vivos where nome in ('rede-v2', 'alumia-2') and not ligado) then return false; end if;
  return coalesce((select ligado from recursos_vivos where nome = 'alumia-p4-avisos-de-local'), false);
end $$;

/** Quem chama pode usar os avisos? Interruptor ligado, área aberta, conta logada e membro da Alumia. Devolve a conta. */
create or replace function interno.rede_local_exige() returns uuid language plpgsql stable security definer set search_path = interno, pg_temp as $$
declare v uuid;
begin
  if not interno.rede_local_ligado() then perform interno.erro('desligado'); end if;
  perform interno.aberta('comunidade');
  v := interno.eu();
  if not interno.rede2_membro(v) then perform interno.erro('consentimento'); end if;
  return v;
end $$;

/** A área (10 x 10 células) de uma célula. */
create or replace function interno.rede_local_area(p integer) returns integer language sql immutable as $$
  select floor(p / 10.0)::integer
$$;

/** A célula é válida? Os dois números inteiros dentro da Terra. */
create or replace function interno.rede_local_celula_ok(p_la integer, p_lo integer) returns boolean language sql immutable as $$
  select p_la is not null and p_lo is not null and p_la >= -45000 and p_la < 45000 and p_lo >= -90000 and p_lo < 90000
$$;

/** A hora cheia de agora, como número inteiro (o bloco do limite e da contagem dos relatos). */
create or replace function interno.rede_local_bloco() returns integer language sql stable as $$
  select floor(extract(epoch from now()) / 3600)::integer
$$;

/** Agora, arredondado para baixo em 10 minutos. */
create or replace function interno.rede_local_dez() returns timestamptz language sql stable as $$
  select to_timestamp(floor(extract(epoch from now()) / 600) * 600)
$$;

/** A faxina: aviso vencido e trava vencida somem; o limite das horas passadas também. */
create or replace function interno.rede_local_faxina() returns void language plpgsql security definer set search_path = interno, pg_temp as $$
begin
  delete from rede_local_avisos where expira_em <= now();
  delete from rede_local_travas where ate <= now();
  delete from rede_local_limite where bloco < interno.rede_local_bloco();
end $$;

/**
 * Gasta a ação da hora de quem chama (uma por hora: avisar, confirmar ou renovar). Depois, regrava as linhas da hora em ordem
 * sorteada (sorteio criptográfico, gen_random_bytes; não random()), todas na mesma transação: nem a ordem no disco nem a transação
 * que gravou a linha apontam quem agiu agora.
 */
create or replace function interno.rede_local_gastar(p_quem uuid) returns void language plpgsql security definer set search_path = interno, pg_temp as $$
declare v_bloco integer := interno.rede_local_bloco(); v_lista uuid[];
begin
  perform pg_advisory_xact_lock(hashtext('rede_local_limite'));
  if exists (select 1 from rede_local_limite where usuario = p_quem and bloco = v_bloco) then perform interno.erro('uma_por_hora'); end if;
  select coalesce(array_agg(usuario order by extensions.gen_random_bytes(16)), '{}') || p_quem into v_lista from rede_local_limite where bloco = v_bloco;
  select array_agg(u order by extensions.gen_random_bytes(16)) into v_lista from unnest(v_lista) u;
  delete from rede_local_limite where bloco <= v_bloco;
  insert into rede_local_limite (usuario, bloco) select u, v_bloco from unnest(v_lista) with ordinality t(u, i) order by i;
end $$;

/** A área está travada pela moderação? */
create or replace function interno.rede_local_travada(p_ala integer, p_alo integer) returns boolean language sql stable security definer set search_path = interno, pg_temp as $$
  select exists (select 1 from rede_local_travas where ala = p_ala and alo = p_alo and ate > now())
$$;

/** Um aviso como a tela mostra: sem número de relatos, sem nada de quem avisou (não há). */
create or replace function interno.rede_local_item(p_id uuid) returns jsonb language sql stable security definer set search_path = interno, pg_temp as $$
  select jsonb_build_object('id', a.id, 'la', a.la, 'lo', a.lo, 'categoria', a.categoria, 'confirmado', a.confirmado,
    'renovado', a.renovado, 'criado_em', a.criado_em, 'expira_em', a.expira_em)
  from rede_local_avisos a where a.id = p_id
$$;

-- ── 4. As funções da tela ─────────────────────────────────────────────────────────────────────────────────────────────────

/** O interruptor, para a tela saber se mostra os avisos (o banco confere de novo em cada chamada). */
create or replace function public.rede_local_ligado() returns boolean language plpgsql stable security definer set search_path = interno, pg_temp as $$
begin
  perform interno.alumia_porta();
  return auth.uid() is not null and interno.rede_local_ligado() and interno.rede2_membro(auth.uid());
end $$;

/**
 * Os avisos em volta de uma área (a pedida e as 8 vizinhas: cerca de 6 x 6 km), até 300, os confirmados primeiro. Também diz quais
 * dessas áreas a moderação travou. O banco não guarda qual área foi pedida.
 */
create or replace function public.rede_local_ver(p_ala integer, p_alo integer) returns jsonb language plpgsql volatile security definer set search_path = interno, pg_temp as $$
declare v uuid;
begin
  perform interno.alumia_porta();
  v := interno.rede_local_exige();
  if p_ala is null or p_alo is null or p_ala < -4500 or p_ala >= 4500 or p_alo < -9000 or p_alo >= 9000 then perform interno.erro('invalido:area'); end if;
  perform interno.limite('local_avisos_ler', 240, 60);
  if random() < 0.1 then perform interno.rede_local_faxina(); end if;
  return jsonb_build_object(
    'area', jsonb_build_object('ala', p_ala, 'alo', p_alo),
    'avisos', coalesce((
      select jsonb_agg(interno.rede_local_item(a.id) order by a.confirmado desc, a.criado_em desc)
        from (select * from rede_local_avisos x
               where x.expira_em > now()
                 and x.la >= (p_ala - 1) * 10 and x.la < (p_ala + 2) * 10
                 and x.lo >= (p_alo - 1) * 10 and x.lo < (p_alo + 2) * 10
               order by x.confirmado desc, x.criado_em desc limit 300) a), '[]'::jsonb),
    'travadas', coalesce((
      select jsonb_agg(jsonb_build_object('ala', t.ala, 'alo', t.alo, 'ate', t.ate) order by t.ala, t.alo)
        from rede_local_travas t
       where t.ate > now() and t.ala between p_ala - 1 and p_ala + 1 and t.alo between p_alo - 1 and p_alo + 1), '[]'::jsonb),
    'modera', interno.cuida());
end $$;

/**
 * Avisa (ou confirma, se já há aviso igual na célula): a célula da grade de 200 m e uma categoria da lista. Gasta a ação da hora.
 * Área travada: "area_travada". Devolve o aviso como a tela mostra, e se é novo.
 */
create or replace function public.rede_local_avisar(p_la integer, p_lo integer, p_categoria text) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid; v_dez timestamptz; v_bloco integer; v_id uuid; v_novo boolean;
begin
  perform interno.alumia_porta();
  v := interno.rede_local_exige();
  if not interno.rede_local_celula_ok(p_la, p_lo) then perform interno.erro('invalido:celula'); end if;
  if p_categoria is null or p_categoria not in ('cuidado', 'assalto', 'obra', 'violencia_manifestantes', 'rua_bloqueada', 'alagamento') then
    perform interno.erro('invalido:categoria');
  end if;
  if interno.rede_local_travada(interno.rede_local_area(p_la), interno.rede_local_area(p_lo)) then perform interno.erro('area_travada'); end if;
  perform interno.rede_local_faxina();
  perform interno.rede_local_gastar(v);
  v_dez := interno.rede_local_dez();
  v_bloco := interno.rede_local_bloco();
  insert into rede_local_avisos (la, lo, categoria, criado_em, expira_em, bloco, relatos_no_bloco)
  values (p_la, p_lo, p_categoria, v_dez, v_dez + interval '2 hours', v_bloco, 1)
  on conflict (la, lo, categoria) do update set
    confirmado = rede_local_avisos.confirmado or (rede_local_avisos.bloco = excluded.bloco and rede_local_avisos.relatos_no_bloco >= 2),
    relatos_no_bloco = case when rede_local_avisos.bloco = excluded.bloco then least(rede_local_avisos.relatos_no_bloco + 1, 3) else 1 end,
    bloco = excluded.bloco
  returning id, (xmax = 0) into v_id, v_novo;
  return interno.rede_local_item(v_id) || jsonb_build_object('novo', v_novo);
end $$;

/** "Ainda está lá": renova o aviso por 2 horas a partir de agora (em 10 minutos), uma vez só. Gasta a ação da hora. */
create or replace function public.rede_local_ainda_la(p_id uuid) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid; v_renovado boolean;
begin
  perform interno.alumia_porta();
  v := interno.rede_local_exige();
  select renovado into v_renovado from rede_local_avisos where id = p_id and expira_em > now();
  if not found then perform interno.erro('nao_encontrado'); end if;
  if v_renovado then perform interno.erro('ja_renovado'); end if;
  perform interno.rede_local_gastar(v);
  update rede_local_avisos set renovado = true, expira_em = greatest(expira_em, interno.rede_local_dez() + interval '2 hours') where id = p_id;
  return interno.rede_local_item(p_id);
end $$;

/** A moderação apaga um aviso. Fica no registro de atividades (quem apagou e a categoria; não há autor a registrar). */
create or replace function public.rede_local_apagar(p_id uuid) returns void language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid; v_cat text;
begin
  perform interno.alumia_porta();
  v := interno.rede_local_exige();
  if not interno.cuida() then perform interno.erro('sem_permissao'); end if;
  delete from rede_local_avisos where id = p_id returning categoria into v_cat;
  if v_cat is null then perform interno.erro('nao_encontrado'); end if;
  perform interno.registrar('local_aviso_apagado', '', jsonb_build_object('categoria', v_cat));
end $$;

/**
 * A moderação trava uma área (10 x 10 células) por 1 a 72 horas, com um motivo da lista: ninguém avisa nela e os avisos dela somem.
 * Travar de novo troca o prazo.
 */
create or replace function public.rede_local_travar(p_ala integer, p_alo integer, p_horas integer, p_motivo text) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid; v_ate timestamptz; v_n integer;
begin
  perform interno.alumia_porta();
  v := interno.rede_local_exige();
  if not interno.cuida() then perform interno.erro('sem_permissao'); end if;
  if p_ala is null or p_alo is null or p_ala < -4500 or p_ala >= 4500 or p_alo < -9000 or p_alo >= 9000 then perform interno.erro('invalido:area'); end if;
  if p_horas is null or p_horas < 1 or p_horas > 72 then perform interno.erro('invalido:horas'); end if;
  if p_motivo is null or p_motivo not in ('infiltracao', 'abuso', 'risco', 'outro') then perform interno.erro('invalido:motivo'); end if;
  v_ate := now() + make_interval(hours => p_horas);
  insert into rede_local_travas (ala, alo, ate, motivo) values (p_ala, p_alo, v_ate, p_motivo)
  on conflict (ala, alo) do update set ate = excluded.ate, motivo = excluded.motivo;
  delete from rede_local_avisos where interno.rede_local_area(la) = p_ala and interno.rede_local_area(lo) = p_alo;
  get diagnostics v_n = row_count;
  perform interno.registrar('local_area_travada', p_ala || ',' || p_alo, jsonb_build_object('horas', p_horas, 'motivo', p_motivo));
  return jsonb_build_object('ala', p_ala, 'alo', p_alo, 'ate', v_ate, 'apagados', v_n >= 3);
end $$;

/** A moderação destrava a área antes do prazo. */
create or replace function public.rede_local_destravar(p_ala integer, p_alo integer) returns void language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid;
begin
  perform interno.alumia_porta();
  v := interno.rede_local_exige();
  if not interno.cuida() then perform interno.erro('sem_permissao'); end if;
  delete from rede_local_travas where ala = p_ala and alo = p_alo;
  perform interno.registrar('local_area_destravada', coalesce(p_ala, 0) || ',' || coalesce(p_alo, 0), '{}'::jsonb);
end $$;

-- ── 5. Permissões ─────────────────────────────────────────────────────────────────────────────────────────────────────────
do $$
declare r record;
begin
  -- As de dentro: ninguém chama pela API.
  for r in
    select p.oid::regprocedure as f from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'interno' and p.proname like 'rede\_local\_%'
  loop
    execute format('revoke all on function %s from public', r.f);
    if exists (select 1 from pg_roles where rolname = 'anon') then execute format('revoke all on function %s from anon, authenticated', r.f); end if;
  end loop;
  -- As da tela: só conta logada.
  for r in
    select p.oid::regprocedure as f from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname like 'rede\_local\_%'
  loop
    execute format('revoke all on function %s from public', r.f);
    if exists (select 1 from pg_roles where rolname = 'anon') then
      execute format('revoke all on function %s from anon', r.f);
      execute format('grant execute on function %s to authenticated, service_role', r.f);
    end if;
  end loop;
end $$;

-- ── 6. A faxina de hora em hora ───────────────────────────────────────────────────────────────────────────────────────────
-- Só se o pg_cron existe: o aviso vencido some mesmo que ninguém chame nada.
do $$
begin
  if to_regprocedure('cron.schedule(text,text,text)') is not null then
    perform cron.schedule('alumia-avisos-de-local-faxina', '7 * * * *', 'select interno.rede_local_faxina()');
  end if;
exception when others then
  raise warning 'alumia-avisos-de-local-faxina: a rotina não foi agendada (%).', sqlerrm;
end $$;

select interno.alumia_trancar();
