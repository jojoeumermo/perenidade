-- Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
-- Alumia · Prompt 4 · itens 6 e 1 (o banco do grupo "presença e print"; o item 9, o Sair rápido pela marca, não tem banco).
-- Roda depois de 20261126-p5-fim.sql (banco na versão 17). Não sobe rede_alumia_versao: quem junta escreve o 20261127-p4-fim.sql.
--
-- O que faz:
--   0. O interruptor "alumia-p4-presenca-print" no catálogo, só pelo nome e desligado. Desligado, toda função daqui recusa com
--      "desligado" (menos public.rede_p4_pp_aberto, que só diz sim ou não).
--   1. Item 6, status online por escolha. Desligado por padrão: só quem liga tem uma linha em interno.rede_p4_presenca, com UM campo,
--      "ativo até", sempre em hora cheia (a hora cheia de agora mais duas: quem esteve ativo aparece como "ativo recentemente" por
--      uma a duas horas, nunca com o minuto). O campo é sobrescrito (uma linha por pessoa, sem data de criação nem de mudança, sem
--      gatilho, sem cópia em lugar nenhum) e só muda quando a hora cheia muda. Desligar apaga a linha. Quem vê: só quem está na
--      roda de confiança da pessoa (interno.rede_roda), e só "ativo recentemente" ou nada; para quem não está na roda, a resposta é
--      a mesma de quem não está ativo. A marcação não passa por interno.limite: a tabela dos limites guardaria a janela de cada
--      marcação, e isso seria um histórico de presença.
--   2. Item 1, proteção contra print (só a escolha da autora; a proteção em si é da tela, no navegador). "Proteger minha foto de
--      perfil" (interno.rede_p4_foto_protegida) e "proteger este story" (interno.rede_p4_story_protegido). Quem lê pergunta só quais
--      dos stories que já pode ver estão protegidos e recebe o próprio codinome para a marca d'água. Nenhuma leitura é gravada:
--      ninguém sabe quem abriu, e a autora nunca é avisada de print (isso seria registro de comportamento de quem lê).
-- Pode rodar mais de uma vez. Endereço de rede: nada daqui lê ou guarda. Nenhum número, nenhuma lista de pessoas.
-- Lei: LGPD art. 6º, III (necessidade: um campo só, arredondado, sem histórico), art. 8º (consentimento: desligado por padrão,
-- desligar apaga), art. 18, VI (eliminação) e art. 46 (segurança).

-- ── 0. O interruptor ──────────────────────────────────────────────────────────────────────────────────────────────────────
do $$
begin
  if to_regclass('interno.recursos_catalogo') is not null then
    insert into interno.recursos_catalogo (nome, so_pelo_nome) values ('alumia-p4-presenca-print', true)
      on conflict (nome) do update set so_pelo_nome = true;
  end if;
end $$;

/** O interruptor está ligado? Só com decisão explícita do painel e sem a Alumia desligada lá. Sem a tabela: desligado. */
create or replace function interno.rede_p4_pp_ligado() returns boolean language plpgsql stable security definer set search_path = interno, pg_temp as $$
begin
  if to_regclass('interno.recursos_vivos') is null then return false; end if;
  if exists (select 1 from recursos_vivos where nome in ('rede-v2', 'alumia-2') and not ligado) then return false; end if;
  return coalesce((select ligado from recursos_vivos where nome = 'alumia-p4-presenca-print'), false);
end $$;

/** Recusa com "desligado" quando o interruptor está desligado. */
create or replace function interno.rede_p4_pp_exige() returns void language plpgsql stable security definer set search_path = interno, pg_temp as $$
begin
  if not interno.rede_p4_pp_ligado() then perform interno.erro('desligado'); end if;
end $$;

-- ── 1. As tabelas ─────────────────────────────────────────────────────────────────────────────────────────────────────────
-- Presença: uma linha por pessoa que ligou, um campo só, sempre em hora cheia. Sem data de criação nem de mudança, de propósito.
create table if not exists interno.rede_p4_presenca (
  usuario uuid primary key references interno.perfis (id) on delete cascade,
  ativo_ate timestamptz not null check (ativo_ate = date_trunc('hour', ativo_ate))
);
-- As escolhas da autora para a proteção contra print. Só a escolha: nada de quem abriu.
create table if not exists interno.rede_p4_foto_protegida (
  dono uuid primary key references interno.perfis (id) on delete cascade
);
-- Os stories que a autora protegeu contra print. Só o story: nada de quem abriu.
create table if not exists interno.rede_p4_story_protegido (
  story uuid primary key references interno.rede_stories (id) on delete cascade
);

do $$
declare t text;
begin
  foreach t in array array['rede_p4_presenca', 'rede_p4_foto_protegida', 'rede_p4_story_protegido'] loop
    execute format('alter table interno.%I enable row level security', t);
    execute format('revoke all on table interno.%I from public', t);
    if exists (select 1 from pg_roles where rolname = 'anon') then
      execute format('revoke all on table interno.%I from anon, authenticated', t);
    end if;
  end loop;
end $$;

-- ── 2. As peças de dentro ─────────────────────────────────────────────────────────────────────────────────────────────────
/** A hora cheia até a qual quem esteve ativo agora aparece como "ativo recentemente": a hora cheia de `p_quando` mais duas. */
create or replace function interno.rede_p4_pp_ativo_ate(p_quando timestamptz) returns timestamptz language sql immutable as $$
  select date_trunc('hour', p_quando) + interval '2 hours'
$$;

/** O codinome de quem chama, para a marca d'água (só a própria pessoa recebe o próprio). */
create or replace function interno.rede_p4_pp_marca(p_quem uuid) returns text language sql stable security definer set search_path = interno, pg_temp as $$
  select coalesce(nullif(btrim(f.rede_codinome), ''), '@' || f.rede_handle, '') from perfis f where f.id = p_quem
$$;

-- ── 3. Item 6: status online por escolha ──────────────────────────────────────────────────────────────────────────────────

/** O interruptor, para a tela saber se mostra as escolhas (o banco confere de novo em cada chamada). */
create or replace function public.rede_p4_pp_aberto() returns boolean language plpgsql stable security definer set search_path = interno, pg_temp as $$
begin
  perform interno.alumia_porta();
  return auth.uid() is not null and interno.rede_p4_pp_ligado();
end $$;

/** As minhas escolhas: o status online e a proteção da foto. Nunca a hora guardada (nem para a própria pessoa: não precisa). */
create or replace function public.rede_p4_pp_minhas() returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid;
begin
  perform interno.alumia_porta();
  v := interno.eu();
  perform interno.rede_p4_pp_exige();
  return jsonb_build_object(
    'presenca', exists (select 1 from rede_p4_presenca where usuario = v),
    'foto', exists (select 1 from rede_p4_foto_protegida where dono = v));
end $$;

/** Liga ou desliga o status online. Ligar grava o "ativo até" de agora; desligar APAGA a linha (nada sobra). */
create or replace function public.rede_p4_presenca_ligar(p_sim boolean) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid;
begin
  perform interno.alumia_porta();
  v := interno.eu();
  perform interno.rede_p4_pp_exige();
  perform interno.limite('rede_p4_escolher', 30, 60);
  if coalesce(p_sim, false) then
    insert into rede_p4_presenca (usuario, ativo_ate) values (v, interno.rede_p4_pp_ativo_ate(now()))
      on conflict (usuario) do update set ativo_ate = excluded.ativo_ate;
  else
    delete from rede_p4_presenca where usuario = v;
  end if;
  return public.rede_p4_pp_minhas();
end $$;

/**
 * "Estou aqui": a tela chama ao abrir a Alumia e de tempos em tempos. Só mexe em quem ligou o status, e só quando a hora cheia muda
 * (no máximo uma escrita por hora, sobrescrevendo). Sem interno.limite: a tabela dos limites guardaria a janela de cada chamada, e
 * isso viraria histórico de presença. Devolve só se o status está ligado (para a tela parar de chamar).
 */
create or replace function public.rede_p4_presenca_marcar() returns boolean language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid; v_ate timestamptz := interno.rede_p4_pp_ativo_ate(now());
begin
  perform interno.alumia_porta();
  v := interno.eu();
  if not interno.rede_p4_pp_ligado() then return false; end if;
  update rede_p4_presenca set ativo_ate = v_ate where usuario = v and ativo_ate < v_ate;
  return exists (select 1 from rede_p4_presenca where usuario = v);
end $$;

/**
 * A presença de @handle como eu posso ver: só "recente" sim ou não. Sim só quando a pessoa ligou o status, esteve ativa (o "ativo
 * até" ainda não passou) e eu estou na roda de confiança dela, sem bloqueio entre nós. Em qualquer outro caso, não (a mesma resposta
 * para "não está na roda", "não ligou", "não existe" e "não está ativa": ninguém descobre por aqui o que não deve). Nenhuma leitura é
 * gravada. A própria pessoa vê o próprio status.
 */
create or replace function public.rede_p4_presenca_de(p_handle text) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid; v_dono uuid;
begin
  perform interno.alumia_porta();
  v := interno.eu();
  perform interno.rede_p4_pp_exige();
  perform interno.limite('rede_p4_presenca_de', 240, 60);
  select id into v_dono from perfis where rede_handle = lower(btrim(coalesce(p_handle, '')));
  if v_dono is null then return jsonb_build_object('recente', false); end if;
  return jsonb_build_object('recente',
    exists (select 1 from rede_p4_presenca p where p.usuario = v_dono and p.ativo_ate > now())
    and (v_dono = v or (
      exists (select 1 from rede_roda r where r.dono = v_dono and r.membro = v)
      and interno.rede2_membro(v) and interno.rede2_membro(v_dono)
      and not interno.rede_bloqueado(v, v_dono))));
end $$;

-- ── 4. Item 1: as escolhas da autora para a proteção contra print ─────────────────────────────────────────────────────────

/** "Proteger minha foto de perfil": liga ou desliga. */
create or replace function public.rede_p4_foto_proteger(p_sim boolean) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid;
begin
  perform interno.alumia_porta();
  v := interno.eu();
  perform interno.rede_p4_pp_exige();
  perform interno.limite('rede_p4_escolher', 30, 60);
  if coalesce(p_sim, false) then
    insert into rede_p4_foto_protegida (dono) values (v) on conflict do nothing;
  else
    delete from rede_p4_foto_protegida where dono = v;
  end if;
  return public.rede_p4_pp_minhas();
end $$;

/** "Proteger este story": só a autora. Story de outra pessoa, ou que não existe: "nao_encontrado" (sem dizer qual dos dois). */
create or replace function public.rede_p4_story_proteger(p_story uuid, p_sim boolean) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid;
begin
  perform interno.alumia_porta();
  v := interno.eu();
  perform interno.rede_p4_pp_exige();
  perform interno.limite('rede_p4_escolher', 30, 60);
  if not exists (select 1 from rede_stories where id = p_story and autor = v) then perform interno.erro('nao_encontrado'); end if;
  if coalesce(p_sim, false) then
    insert into rede_p4_story_protegido (story) values (p_story) on conflict do nothing;
  else
    delete from rede_p4_story_protegido where story = p_story;
  end if;
  return jsonb_build_object('protegido', coalesce(p_sim, false));
end $$;

/**
 * Quais destes stories (até 100) estão protegidos, entre os que eu posso ver (a mesma regra do visor, interno.rede5_story_regra), e o
 * meu codinome para a marca d'água. Só leitura: ninguém fica sabendo que eu perguntei.
 */
create or replace function public.rede_p4_pp_stories(p_stories uuid[]) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid;
begin
  perform interno.alumia_porta();
  v := interno.eu();
  perform interno.rede_p4_pp_exige();
  perform interno.limite('rede_p4_pp_stories', 240, 60);
  if coalesce(cardinality(p_stories), 0) > 100 then perform interno.erro('invalido:stories'); end if;
  return jsonb_build_object(
    'stories', coalesce((select jsonb_agg(s.id order by s.id) from rede_stories s join rede_p4_story_protegido x on x.story = s.id
                         where s.id = any (coalesce(p_stories, '{}')) and interno.rede5_story_regra(s, v)), '[]'::jsonb),
    'marca', interno.rede_p4_pp_marca(v));
end $$;

/**
 * Quais destes @ (até 60) protegem a foto de perfil, entre as pessoas da Alumia que eu posso ver (sem bloqueio), e o meu codinome para
 * a marca d'água. É uma propriedade da foto, como o "foto pública": não diz nada de quem pergunta e não é gravado.
 */
create or replace function public.rede_p4_fotos_protegidas(p_handles text[]) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid;
begin
  perform interno.alumia_porta();
  v := interno.eu();
  perform interno.rede_p4_pp_exige();
  perform interno.limite('rede_p4_pp_stories', 240, 60);
  if coalesce(cardinality(p_handles), 0) > 60 then perform interno.erro('invalido:handles'); end if;
  return jsonb_build_object(
    'handles', coalesce((select jsonb_agg(f.rede_handle order by f.rede_handle) from perfis f join rede_p4_foto_protegida x on x.dono = f.id
                         where f.rede_handle = any (select lower(btrim(h)) from unnest(coalesce(p_handles, '{}')) h)
                           and (f.id = v or not interno.rede_bloqueado(v, f.id))), '[]'::jsonb),
    'marca', interno.rede_p4_pp_marca(v));
end $$;

-- ── 5. Quem chama o quê ───────────────────────────────────────────────────────────────────────────────────────────────────
do $$
declare r record;
begin
  for r in
    select p.oid::regprocedure as f from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'interno' and (p.proname like 'rede\_p4\_pp\_%')
  loop
    execute format('revoke all on function %s from public', r.f);
    if exists (select 1 from pg_roles where rolname = 'anon') then execute format('revoke all on function %s from anon, authenticated', r.f); end if;
  end loop;
  for r in
    select p.oid::regprocedure as f from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname in ('rede_p4_pp_aberto', 'rede_p4_pp_minhas', 'rede_p4_presenca_ligar', 'rede_p4_presenca_marcar',
      'rede_p4_presenca_de', 'rede_p4_foto_proteger', 'rede_p4_story_proteger', 'rede_p4_pp_stories', 'rede_p4_fotos_protegidas')
  loop
    execute format('revoke all on function %s from public', r.f);
    if exists (select 1 from pg_roles where rolname = 'anon') then
      execute format('revoke all on function %s from anon', r.f);
      execute format('grant execute on function %s to authenticated, service_role', r.f);
    end if;
  end loop;
end $$;

-- ── 6. A porta ────────────────────────────────────────────────────────────────────────────────────────────────────────────
select interno.alumia_trancar();
