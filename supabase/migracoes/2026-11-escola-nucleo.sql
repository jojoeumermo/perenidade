-- ───────────────────────────── Escola de Formação (F4): núcleo, acompanhamento, banca e painel, novembro de 2026 ─────────────────────────────
-- Migração acrescentável: pode rodar mais de uma vez, sem apagar dado nenhum. Precisa da F1 (2026-11-escola-formacao-base.sql:
-- as tabelas nascem lá). Quem junta cola este bloco no fim do install.sql, DEPOIS da F1 (ordem: F1, F4, F5, F3, F6).
-- Plano: docs/plano-2026-11/PLANO-ESCOLA.md, seções 3 e 4.4. Teste: npm run testar:escola-nucleo.
--
-- O que nasce aqui (só funções; nenhuma tabela nova):
--  1. O encontro do núcleo: escola_nucleo (o próximo encontro, a pauta, quem faz o quê, a presença SOMADA das 4 últimas
--     rodas), escola_encontro_salvar (só a mediação do núcleo na Alumia ou a coordenação), escola_tarefa_pegar ("Eu levo",
--     com rodízio: quem fez a mesma tarefa na roda anterior deixa para outra pessoa) e escola_levar_ao_nucleo (a dúvida
--     vira item da pauta, sem dizer de quem).
--  2. A pergunta geradora da semana (Paulo Freire, círculo de cultura) e os recados da formação.
--  3. Quem acompanha (só alguém do Degrau 3) e a banca de passagem: balanço coletivo, SEM nota. Aprovada, sobe o degrau e
--     grava a conquista verificada 'degrau-N' (N = o degrau que a pessoa fechou).
--  4. O painel da coordenação: militantes pelo codinome, ajuste de núcleo, frente e degrau.
--
-- Segurança (a mesma da F1): só funções security definer com search_path fixo; entrada por interno.eu(); freio por
-- interno.limite; nada de nome civil (codinome da Alumia, e só quando confirmado); no registro de atividades, nada diz
-- "revolucionários": o departamento aparece como 'reservado'. Quem não é militante não recebe nada.

-- 0. Ajudantes ───────────────────────────────────────────────────────────────────────────────────────────────────────────
/** Uma pessoa como a Escola mostra: o codinome confirmado da Alumia e o @ (que some se ela estiver invisível). */
create or replace function interno.escola_pessoa(p uuid) returns jsonb language sql stable security definer set search_path = interno, pg_temp as $$
  select case when p is null then null else (
    select jsonb_build_object(
      'codinome', case when f.rede_codinome_ok then f.rede_codinome end,
      'handle', case when not coalesce(f.rede_modo = 'invisivel' or f.rede_invisivel, false) then f.rede_handle end)
    from perfis f where f.id = p and not f.suspenso) end
$$;

/** Hoje em Brasília. */
create or replace function interno.escola_hoje() returns date language sql stable set search_path = interno, pg_temp as $$
  select (now() at time zone 'America/Sao_Paulo')::date
$$;

/** Quem chama, exigindo militância (ou coordenação). Devolve o id. */
create or replace function interno.escola_militante_eu() returns uuid language plpgsql stable security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu();
begin
  if not interno.e_militante(v) then perform interno.erro('sem_permissao'); end if;
  return v;
end $$;

/** O núcleo da Escola de quem chama (nulo se ainda não tem). */
create or replace function interno.escola_meu_nucleo() returns uuid language sql stable security definer set search_path = interno, pg_temp as $$
  select nucleo from escola_militancia where usuario = auth.uid()
$$;

/**
 * Quem pode mexer no encontro, na pauta e nos recados deste núcleo: a coordenação, ou quem faz a MEDIAÇÃO do núcleo na
 * Alumia (rede_nucleo_membros.papel = 'mediacao') e é militante, em sessão confiável (com o segundo fator, se tiver).
 */
create or replace function interno.escola_medeia(p_nucleo uuid) returns boolean language sql stable security definer set search_path = interno, pg_temp as $$
  select p_nucleo is not null and (interno.coord() or (
    interno.sessao_confiavel() and interno.e_militante(auth.uid())
    and exists (select 1 from rede_nucleo_membros m where m.nucleo = p_nucleo and m.usuario = auth.uid() and m.papel = 'mediacao')))
$$;

/** O encontro "seguinte" de um núcleo: o primeiro que ainda não acabou (até 3 horas depois do começo, a roda ainda vale). */
create or replace function interno.escola_encontro_seguinte(p_nucleo uuid) returns uuid language sql stable security definer set search_path = interno, pg_temp as $$
  select id from escola_encontros where nucleo = p_nucleo and quando >= now() - interval '3 hours' order by quando, criado_em limit 1
$$;

/** O encontro anterior a um momento (a roda que passou). */
create or replace function interno.escola_encontro_anterior(p_nucleo uuid, p_antes timestamptz) returns uuid language sql stable security definer set search_path = interno, pg_temp as $$
  select id from escola_encontros where nucleo = p_nucleo and quando < p_antes order by quando desc, criado_em desc limit 1
$$;

/** Os itens da pauta, limpos: até 12, cada um com 2 a 200 letras; "levado" só quando veio de uma dúvida. */
create or replace function interno.escola_pauta_limpa(p jsonb) returns jsonb language plpgsql immutable set search_path = interno, pg_temp as $$
declare x jsonb; t text; saida jsonb := '[]'::jsonb;
begin
  if p is null or jsonb_typeof(p) <> 'array' then perform interno.erro('invalido:pauta'); end if;
  if jsonb_array_length(p) > 12 then perform interno.erro('invalido:pauta'); end if;
  for x in select value from jsonb_array_elements(p) loop
    t := btrim(regexp_replace(coalesce(case when jsonb_typeof(x) = 'object' then x ->> 'texto' else x #>> '{}' end, ''), '\s+', ' ', 'g'));
    if char_length(t) < 2 or char_length(t) > 200 then perform interno.erro('invalido:pauta'); end if;
    saida := saida || jsonb_build_array(case when jsonb_typeof(x) = 'object' and coalesce((x ->> 'levado')::boolean, false)
      then jsonb_build_object('texto', t, 'levado', true) else jsonb_build_object('texto', t) end);
  end loop;
  return saida;
end $$;

/** Um encontro como o militante vê: pauta, tarefas (quem pelo codinome; "minha"; "repete" = eu fiz esta na roda anterior). */
create or replace function interno.escola_encontro_json(p_id uuid) returns jsonb language plpgsql stable security definer set search_path = interno, pg_temp as $$
declare e escola_encontros; v uuid := auth.uid(); antes uuid;
begin
  select * into e from escola_encontros where id = p_id;
  if not found then return null; end if;
  antes := interno.escola_encontro_anterior(e.nucleo, e.quando);
  return jsonb_build_object(
    'id', e.id,
    'quando', e.quando,
    'pauta', e.pauta,
    'tarefas', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', t.id,
        'item', t.item,
        'quem', interno.escola_pessoa(t.quem),
        'minha', t.quem is not distinct from v and v is not null,
        'feito', t.feito,
        'repete', t.quem is null and exists (select 1 from escola_encontro_tarefas a where a.encontro = antes and a.quem = v and lower(a.item) = lower(t.item)))
        order by t.criado_em, t.id)
      from escola_encontro_tarefas t where t.encontro = e.id), '[]'::jsonb));
end $$;

-- 1. O núcleo ────────────────────────────────────────────────────────────────────────────────────────────────────────────
/**
 * O núcleo de quem chama: o nome, o encontro seguinte (pauta e quem faz o quê), a roda que passou (presença e balanço, para
 * quem é do núcleo) e a presença das 4 últimas rodas, SÓ em números. Militante de outro núcleo não vê esta pauta: cada um
 * só recebe a do próprio núcleo.
 */
create or replace function public.escola_nucleo() returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.escola_militante_eu(); n uuid; v_nome text; seguinte uuid; anterior uuid; a escola_encontros;
begin
  perform interno.limite('escola_nucleo', 120, 10);
  n := interno.escola_meu_nucleo();
  if n is not null then select r.nome into v_nome from rede_nucleos r where r.id = n; end if;
  if n is null or v_nome is null then
    return jsonb_build_object('nucleo', null, 'proximo', null, 'presenca', '[]'::jsonb, 'medeia', false, 'anterior', null);
  end if;
  seguinte := interno.escola_encontro_seguinte(n);
  anterior := interno.escola_encontro_anterior(n, coalesce((select quando from escola_encontros where id = seguinte), now() - interval '3 hours'));
  if anterior is not null then select * into a from escola_encontros where id = anterior; end if;
  return jsonb_build_object(
    'nucleo', jsonb_build_object('id', n, 'nome', v_nome),
    'proximo', interno.escola_encontro_json(seguinte),
    'anterior', case when anterior is null then null else jsonb_build_object('id', a.id, 'quando', a.quando, 'presenca', a.presenca, 'balanco', a.balanco) end,
    'presenca', coalesce((
      select jsonb_agg(jsonb_build_object('quando', x.quando, 'presenca', x.presenca) order by x.quando)
      from (select quando, presenca from escola_encontros where nucleo = n and quando < now() - interval '3 hours' order by quando desc limit 4) x), '[]'::jsonb),
    'medeia', interno.escola_medeia(n));
end $$;

/**
 * Salvar o encontro (novo ou o mesmo): quando, a pauta, a presença somada, o balanço e quem faz o quê. Só a mediação do
 * núcleo ou a coordenação. Num encontro que já existe, o que não vier fica como estava (quando, pauta, presença, balanço). As tarefas, quando vêm, substituem a lista; a tarefa sem "quem" na entrada mantém quem já
 * tinha pegado a mesma tarefa neste encontro. "quem" dado tem de ser militante do mesmo núcleo.
 */
create or replace function public.escola_encontro_salvar(p jsonb) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare
  v uuid := interno.escola_militante_eu();
  n uuid;
  e_id uuid;
  velho escola_encontros;
  q timestamptz;
  v_pauta jsonb;
  pres smallint;
  bal text;
  x jsonb;
  v_item text;
  v_quem uuid;
  antigas jsonb;
begin
  perform interno.limite('escola_encontro_salvar', 60, 60);
  if p is null or jsonb_typeof(p) <> 'object' then perform interno.erro('invalido:encontro'); end if;
  begin
    n := (p ->> 'nucleo')::uuid;
    e_id := nullif(p ->> 'id', '')::uuid;
    q := (p ->> 'quando')::timestamptz;
  exception when others then perform interno.erro('invalido:encontro');
  end;
  if n is null or (q is null and e_id is null) then perform interno.erro('invalido:encontro'); end if;
  if not interno.escola_medeia(n) then perform interno.erro('sem_permissao'); end if;
  if q is not null and (q < now() - interval '400 days' or q > now() + interval '400 days') then perform interno.erro('invalido:quando'); end if;
  -- Sem "pauta" na entrada, a pauta fica como está (fechar a roda que passou manda só presença e balanço).
  if p ? 'pauta' or e_id is null then v_pauta := interno.escola_pauta_limpa(coalesce(p -> 'pauta', '[]'::jsonb)); end if;
  if p ? 'presenca' and jsonb_typeof(p -> 'presenca') <> 'null' then
    begin pres := (p ->> 'presenca')::smallint; exception when others then perform interno.erro('invalido:presenca'); end;
    if pres < 0 or pres > 500 then perform interno.erro('invalido:presenca'); end if;
  end if;
  bal := left(btrim(coalesce(p ->> 'balanco', '')), 2000);
  if char_length(btrim(coalesce(p ->> 'balanco', ''))) > 2000 then perform interno.erro('invalido:balanco'); end if;

  if e_id is not null then
    select * into velho from escola_encontros where id = e_id;
    if not found or velho.nucleo <> n then perform interno.erro('nao_encontrado'); end if;
    update escola_encontros set quando = coalesce(q, velho.quando), pauta = coalesce(v_pauta, velho.pauta),
      presenca = case when p ? 'presenca' then pres else velho.presenca end,
      balanco = case when p ? 'balanco' then bal else velho.balanco end
    where id = e_id;
  else
    insert into escola_encontros (nucleo, quando, pauta, presenca, balanco, criado_por) values (n, q, v_pauta, pres, bal, v) returning id into e_id;
  end if;

  if p ? 'tarefas' then
    if jsonb_typeof(p -> 'tarefas') <> 'array' or jsonb_array_length(p -> 'tarefas') > 12 then perform interno.erro('invalido:tarefas'); end if;
    select coalesce(jsonb_agg(jsonb_build_object('item', lower(t.item), 'quem', t.quem, 'feito', t.feito)), '[]'::jsonb) into antigas
    from escola_encontro_tarefas t where t.encontro = e_id;
    delete from escola_encontro_tarefas where encontro = e_id;
    for x in select value from jsonb_array_elements(p -> 'tarefas') loop
      v_item := btrim(regexp_replace(coalesce(x ->> 'item', ''), '\s+', ' ', 'g'));
      if char_length(v_item) < 2 or char_length(v_item) > 120 then perform interno.erro('invalido:tarefas'); end if;
      if x ? 'quem' then
        if jsonb_typeof(x -> 'quem') = 'null' then v_quem := null;
        else
          begin v_quem := (x ->> 'quem')::uuid; exception when others then perform interno.erro('invalido:quem'); end;
          if not exists (select 1 from escola_militancia m where m.usuario = v_quem and m.nucleo = n) then perform interno.erro('invalido:quem'); end if;
        end if;
      else
        select (a ->> 'quem')::uuid into v_quem from jsonb_array_elements(antigas) a where a ->> 'item' = lower(v_item) and a ->> 'quem' is not null limit 1;
      end if;
      insert into escola_encontro_tarefas (encontro, item, quem, feito)
      values (e_id, v_item, v_quem, coalesce((x ->> 'feito')::boolean,
        (select (a ->> 'feito')::boolean from jsonb_array_elements(antigas) a where a ->> 'item' = lower(v_item) limit 1), false));
    end loop;
  end if;
  perform interno.registrar('escola_encontro_salvo', e_id::text, jsonb_build_object('departamento', 'reservado'));
  return jsonb_build_object('ok', true, 'id', e_id);
end $$;

/**
 * "Eu levo" (p_pegar = true) ou "soltar" (false) uma tarefa do encontro do PRÓPRIO núcleo. Rodízio: quem fez a mesma
 * tarefa na roda anterior deixa para outra pessoa (a mediação ainda pode pôr pelo salvar, se ninguém mais pegar).
 */
create or replace function public.escola_tarefa_pegar(p_id uuid, p_pegar boolean) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.escola_militante_eu(); t escola_encontro_tarefas; e escola_encontros; antes uuid;
begin
  perform interno.limite('escola_tarefa_pegar', 60, 60);
  select * into t from escola_encontro_tarefas where id = p_id;
  if not found then perform interno.erro('nao_encontrado'); end if;
  select * into e from escola_encontros where id = t.encontro;
  if e.nucleo is distinct from interno.escola_meu_nucleo() and not interno.escola_medeia(e.nucleo) then perform interno.erro('sem_permissao'); end if;
  if coalesce(p_pegar, false) then
    if t.quem is not null and t.quem <> v then perform interno.erro('ja_tem_quem'); end if;
    antes := interno.escola_encontro_anterior(e.nucleo, e.quando);
    if t.quem is null and exists (select 1 from escola_encontro_tarefas a where a.encontro = antes and a.quem = v and lower(a.item) = lower(t.item)) then
      perform interno.erro('rodizio');
    end if;
    update escola_encontro_tarefas set quem = v where id = p_id;
  else
    if t.quem is distinct from v and not interno.escola_medeia(e.nucleo) then perform interno.erro('sem_permissao'); end if;
    update escola_encontro_tarefas set quem = null, feito = false where id = p_id;
  end if;
  return jsonb_build_object('ok', true);
end $$;

/** A dúvida (ou a resposta à pergunta da semana) vira item da pauta do próximo encontro do próprio núcleo, sem dizer de quem. */
create or replace function public.escola_levar_ao_nucleo(p_texto text) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.escola_militante_eu(); n uuid; e uuid; t text; v_pauta jsonb;
begin
  perform interno.limite('escola_levar_ao_nucleo', 6, 60);
  t := btrim(regexp_replace(coalesce(p_texto, ''), '\s+', ' ', 'g'));
  if char_length(t) < 3 or char_length(t) > 200 then perform interno.erro('invalido:texto'); end if;
  n := interno.escola_meu_nucleo();
  if n is null then perform interno.erro('sem_nucleo'); end if;
  e := interno.escola_encontro_seguinte(n);
  if e is null then perform interno.erro('sem_encontro'); end if;
  select x.pauta into v_pauta from escola_encontros x where x.id = e for update;
  if jsonb_array_length(v_pauta) >= 12 then perform interno.erro('pauta_cheia'); end if;
  update escola_encontros set pauta = v_pauta || jsonb_build_array(jsonb_build_object('texto', t, 'levado', true)) where id = e;
  return jsonb_build_object('ok', true);
end $$;

-- 2. Pergunta geradora e recados ─────────────────────────────────────────────────────────────────────────────────────────
/** A pergunta geradora desta semana (a semana começa na segunda, em Brasília), ou nulo. */
create or replace function public.escola_pergunta_da_semana() returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.escola_militante_eu(); r escola_perguntas;
begin
  select * into r from escola_perguntas where semana = date_trunc('week', interno.escola_hoje())::date;
  if not found then return null; end if;
  return jsonb_build_object('semana', r.semana, 'texto', r.texto);
end $$;

/** A coordenação define (ou apaga, com texto vazio) a pergunta de uma semana (a data é a segunda-feira). */
create or replace function public.escola_pergunta_definir(p jsonb) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); s date; t text;
begin
  if not interno.coord() then perform interno.erro('sem_permissao'); end if;
  perform interno.limite('escola_pergunta_definir', 60, 60);
  begin s := (p ->> 'semana')::date; exception when others then perform interno.erro('invalido:semana'); end;
  if s is null or extract(isodow from s) <> 1 or s < date_trunc('week', interno.escola_hoje())::date - 7 or s > interno.escola_hoje() + 120 then
    perform interno.erro('invalido:semana');
  end if;
  t := btrim(regexp_replace(coalesce(p ->> 'texto', ''), '\s+', ' ', 'g'));
  if t = '' then
    delete from escola_perguntas where semana = s;
  else
    if char_length(t) < 3 or char_length(t) > 300 then perform interno.erro('invalido:texto'); end if;
    insert into escola_perguntas (semana, texto, por) values (s, t, v)
    on conflict (semana) do update set texto = excluded.texto, por = excluded.por, criado_em = now();
  end if;
  perform interno.registrar('escola_pergunta_definida', s::text, jsonb_build_object('departamento', 'reservado'));
  return jsonb_build_object('ok', true);
end $$;

/** Os recados que valem hoje: os de toda a Escola e os do próprio núcleo. */
create or replace function public.escola_recados() returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.escola_militante_eu(); n uuid := interno.escola_meu_nucleo();
begin
  return coalesce((
    select jsonb_agg(jsonb_build_object('id', r.id, 'texto', r.texto, 'ate', r.ate, 'nucleo', r.nucleo) order by r.nucleo nulls first, r.criado_em desc)
    from escola_recados r where r.ate >= interno.escola_hoje() and (r.nucleo is null or r.nucleo = n)), '[]'::jsonb);
end $$;

/** Criar, mudar ou apagar um recado. Para toda a Escola: só a coordenação. Para um núcleo: a coordenação ou a mediação dele. */
create or replace function public.escola_recado_salvar(p jsonb) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); r escola_recados; id_ uuid; n uuid; t text; ate_ date;
begin
  perform interno.limite('escola_recado_salvar', 60, 60);
  if p is null or jsonb_typeof(p) <> 'object' then perform interno.erro('invalido:recado'); end if;
  begin
    id_ := nullif(p ->> 'id', '')::uuid;
    n := nullif(p ->> 'nucleo', '')::uuid;
  exception when others then perform interno.erro('invalido:recado');
  end;
  if id_ is not null then
    select * into r from escola_recados where id = id_;
    if not found then perform interno.erro('nao_encontrado'); end if;
    -- Quem não pode mexer no núcleo do recado não mexe, nem para mudar de núcleo.
    if not (interno.coord() or (r.nucleo is not null and interno.escola_medeia(r.nucleo))) then perform interno.erro('sem_permissao'); end if;
    if coalesce((p ->> 'apagar')::boolean, false) then
      delete from escola_recados where id = id_;
      perform interno.registrar('escola_recado_apagado', id_::text, jsonb_build_object('departamento', 'reservado'));
      return jsonb_build_object('ok', true);
    end if;
    if not (p ? 'nucleo') then n := r.nucleo; end if;
  end if;
  if not (interno.coord() or (n is not null and interno.escola_medeia(n))) then perform interno.erro('sem_permissao'); end if;
  if n is not null and not exists (select 1 from rede_nucleos where id = n) then perform interno.erro('invalido:nucleo'); end if;
  t := btrim(regexp_replace(coalesce(p ->> 'texto', ''), '\s+', ' ', 'g'));
  if char_length(t) < 3 or char_length(t) > 400 then perform interno.erro('invalido:texto'); end if;
  begin ate_ := (p ->> 'ate')::date; exception when others then perform interno.erro('invalido:ate'); end;
  if ate_ is null or ate_ < interno.escola_hoje() or ate_ > interno.escola_hoje() + 366 then perform interno.erro('invalido:ate'); end if;
  if id_ is null then
    insert into escola_recados (texto, ate, nucleo, por) values (t, ate_, n, v) returning id into id_;
  else
    update escola_recados set texto = t, ate = ate_, nucleo = n, por = v where id = id_;
  end if;
  perform interno.registrar('escola_recado_salvo', id_::text, jsonb_build_object('departamento', 'reservado'));
  return jsonb_build_object('ok', true, 'id', id_);
end $$;

-- 3. Quem acompanha e a banca de passagem ────────────────────────────────────────────────────────────────────────────────
/** A coordenação indica quem acompanha a formação de um militante (só alguém do Degrau 3), ou tira (nulo). */
create or replace function public.escola_acompanhar(p_militante uuid, p_acompanha uuid) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu();
begin
  if not interno.coord() then perform interno.erro('sem_permissao'); end if;
  perform interno.limite('escola_acompanhar', 120, 60);
  if not exists (select 1 from escola_militancia where usuario = p_militante) then perform interno.erro('nao_encontrado'); end if;
  if p_acompanha is not null then
    if p_acompanha = p_militante then perform interno.erro('invalido:acompanha'); end if;
    if not exists (select 1 from escola_militancia m join perfis f on f.id = m.usuario where m.usuario = p_acompanha and m.degrau = 3 and not f.suspenso) then
      perform interno.erro('acompanhante_degrau_3');
    end if;
  end if;
  update escola_militancia set acompanha = p_acompanha where usuario = p_militante;
  perform interno.registrar('escola_acompanhante', p_militante::text, jsonb_build_object('departamento', 'reservado'));
  return jsonb_build_object('ok', true);
end $$;

/** Quem pode marcar e decidir a banca de um militante: a coordenação ou quem o acompanha hoje (e não a própria pessoa). */
create or replace function interno.escola_decide_banca(p_militante uuid) returns boolean language sql stable security definer set search_path = interno, pg_temp as $$
  select p_militante is not null and p_militante is distinct from auth.uid() and (interno.coord() or (
    interno.sessao_confiavel() and interno.e_militante(auth.uid())
    and exists (select 1 from escola_militancia m where m.usuario = p_militante and m.acompanha = auth.uid())))
$$;

/**
 * Marcar a banca de passagem: o degrau é o que a pessoa vai FECHAR (o dela hoje). Uma banca marcada por vez. O núcleo,
 * se não vier, é o da pessoa.
 */
create or replace function public.escola_banca_marcar(p jsonb) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); mil uuid; d smallint; q timestamptz; n uuid; m escola_militancia; id_ uuid;
begin
  perform interno.limite('escola_banca_marcar', 30, 60);
  begin
    mil := (p ->> 'militante')::uuid;
    d := (p ->> 'degrau')::smallint;
    q := nullif(p ->> 'quando', '')::timestamptz;
    n := nullif(p ->> 'nucleo', '')::uuid;
  exception when others then perform interno.erro('invalido:banca');
  end;
  if not interno.escola_decide_banca(mil) then perform interno.erro('sem_permissao'); end if;
  select * into m from escola_militancia where usuario = mil;
  if not found then perform interno.erro('nao_encontrado'); end if;
  if d is null or d <> m.degrau then perform interno.erro('invalido:degrau'); end if;
  if q is not null and (q < now() - interval '30 days' or q > now() + interval '400 days') then perform interno.erro('invalido:quando'); end if;
  if exists (select 1 from escola_bancas where militante = mil and situacao = 'marcada') then perform interno.erro('banca_ja_marcada'); end if;
  n := coalesce(n, m.nucleo);
  if n is not null and not exists (select 1 from rede_nucleos where id = n) then perform interno.erro('invalido:nucleo'); end if;
  insert into escola_bancas (militante, degrau, nucleo, quando, por) values (mil, d, n, q, v) returning id into id_;
  perform interno.registrar('escola_banca_marcada', id_::text, jsonb_build_object('departamento', 'reservado'));
  return jsonb_build_object('ok', true, 'id', id_);
end $$;

/**
 * Registrar o que a banca decidiu, com o BALANÇO COLETIVO (o que a pessoa trouxe, o que o núcleo viu, o que fica para o
 * próximo degrau). Sem nota: só "aprovada" (o degrau se abre) ou "refazer" (combinar de novo). Aprovada: sobe o degrau
 * (até 3) e grava a conquista verificada 'degrau-N', N = o degrau fechado.
 */
create or replace function public.escola_banca_decidir(p_id uuid, p_situacao text, p_balanco text) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); b escola_bancas; t text;
begin
  perform interno.limite('escola_banca_decidir', 30, 60);
  select * into b from escola_bancas where id = p_id;
  if not found then perform interno.erro('nao_encontrado'); end if;
  if not interno.escola_decide_banca(b.militante) then perform interno.erro('sem_permissao'); end if;
  if b.situacao <> 'marcada' then perform interno.erro('banca_ja_decidida'); end if;
  if coalesce(p_situacao, '') not in ('aprovada', 'refazer') then perform interno.erro('invalido:situacao'); end if;
  t := btrim(coalesce(p_balanco, ''));
  if char_length(t) < 10 or char_length(t) > 2000 then perform interno.erro('invalido:balanco'); end if;
  update escola_bancas set situacao = p_situacao, balanco = t, decidida_em = now(), por = v where id = p_id;
  if p_situacao = 'aprovada' then
    update escola_militancia set degrau = least(3, degrau + 1) where usuario = b.militante and degrau = b.degrau;
    insert into escola_conquistas (usuario, tipo, alvo, verificada) values (b.militante, 'degrau', 'degrau-' || b.degrau, true)
    on conflict (usuario, tipo, alvo) do update set verificada = true, em = now();
  end if;
  perform interno.registrar('escola_banca_decidida', p_id::text, jsonb_build_object('departamento', 'reservado', 'situacao', p_situacao));
  return jsonb_build_object('ok', true);
end $$;

/**
 * As bancas que quem chama pode ver: as próprias, as de quem acompanha e, para a coordenação, todas (as 300 mais novas).
 * O balanço só vai a essas três pessoas (militante, quem acompanha, coordenação).
 */
create or replace function public.escola_bancas_listar() returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.escola_militante_eu(); c boolean := interno.coord();
begin
  perform interno.limite('escola_bancas_listar', 120, 10);
  return coalesce((
    select jsonb_agg(x.j order by x.ordem desc) from (
      select jsonb_build_object(
        'id', b.id,
        'militante', interno.escola_pessoa(b.militante),
        'usuario', b.militante,
        'degrau', b.degrau,
        'quando', b.quando,
        'situacao', b.situacao,
        'balanco', b.balanco,
        'minha', b.militante = v,
        'decido', interno.escola_decide_banca(b.militante)) j, coalesce(b.quando, b.criado_em) ordem
      from escola_bancas b left join escola_militancia m on m.usuario = b.militante
      where b.militante = v or m.acompanha = v or c
      order by coalesce(b.quando, b.criado_em) desc limit 300) x), '[]'::jsonb);
end $$;

/** Quem eu acompanho (para quem é do Degrau 3): codinome, degrau e o id (para marcar a banca). */
create or replace function public.escola_acompanho() returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.escola_militante_eu();
begin
  return coalesce((
    select jsonb_agg(interno.escola_pessoa(m.usuario) || jsonb_build_object('usuario', m.usuario, 'degrau', m.degrau,
      'banca_marcada', exists (select 1 from escola_bancas b where b.militante = m.usuario and b.situacao = 'marcada')) order by m.desde)
    from escola_militancia m join perfis f on f.id = m.usuario where m.acompanha = v and not f.suspenso), '[]'::jsonb);
end $$;

-- 4. O painel da coordenação ─────────────────────────────────────────────────────────────────────────────────────────────
/** Os militantes, pelo codinome (sem nome civil, sem e-mail): degrau, frente, núcleo, quem acompanha, desde quando. */
create or replace function public.escola_militantes_listar() returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu();
begin
  if not interno.coord() then perform interno.erro('sem_permissao'); end if;
  perform interno.registrar_acesso('escola_militantes', 'reservado');
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'usuario', m.usuario,
      'codinome', case when f.rede_codinome_ok then f.rede_codinome end,
      'degrau', m.degrau,
      'frente', m.frente,
      'nucleo', case when r.id is null then null else jsonb_build_object('id', r.id, 'nome', r.nome) end,
      'acompanha', interno.escola_pessoa(m.acompanha),
      'acompanha_id', m.acompanha,
      'desde', m.desde) order by m.degrau desc, lower(coalesce(f.rede_codinome, '')), m.desde)
    from escola_militancia m join perfis f on f.id = m.usuario left join rede_nucleos r on r.id = m.nucleo
    where not f.suspenso), '[]'::jsonb);
end $$;

/** A coordenação muda o núcleo, a frente e o degrau de um militante (só as chaves que vierem). */
create or replace function public.escola_militante_ajustar(p jsonb) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); u uuid; n uuid; d smallint; fr text;
begin
  if not interno.coord() then perform interno.erro('sem_permissao'); end if;
  perform interno.limite('escola_militante_ajustar', 120, 60);
  begin u := (p ->> 'usuario')::uuid; exception when others then perform interno.erro('invalido:usuario'); end;
  if u is null or not exists (select 1 from escola_militancia where usuario = u) then perform interno.erro('nao_encontrado'); end if;
  if p ? 'nucleo' then
    begin n := nullif(p ->> 'nucleo', '')::uuid; exception when others then perform interno.erro('invalido:nucleo'); end;
    if n is not null and not exists (select 1 from rede_nucleos where id = n) then perform interno.erro('invalido:nucleo'); end if;
    update escola_militancia set nucleo = n where usuario = u;
  end if;
  if p ? 'frente' then
    fr := nullif(p ->> 'frente', '');
    if fr is not null and fr not in ('estudantil', 'bairros', 'trabalho', 'agitprop', 'atos', 'cultura', 'solidariedade') then perform interno.erro('invalido:frente'); end if;
    update escola_militancia set frente = fr where usuario = u;
  end if;
  if p ? 'degrau' then
    begin d := (p ->> 'degrau')::smallint; exception when others then perform interno.erro('invalido:degrau'); end;
    if d is null or d not between 1 and 3 then perform interno.erro('invalido:degrau'); end if;
    update escola_militancia set degrau = d where usuario = u;
    -- Quem deixa o Degrau 3 deixa de acompanhar (só o Degrau 3 acompanha).
    if d < 3 then update escola_militancia set acompanha = null where acompanha = u; end if;
  end if;
  perform interno.registrar('escola_militante_ajustado', u::text, jsonb_build_object('departamento', 'reservado'));
  return jsonb_build_object('ok', true);
end $$;

/** O resto do painel: os núcleos da Alumia (com quantos militantes), os recados e as perguntas (as recentes e as marcadas). */
create or replace function public.escola_painel_resumo() returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu();
begin
  if not interno.coord() then perform interno.erro('sem_permissao'); end if;
  return jsonb_build_object(
    'nucleos', coalesce((select jsonb_agg(jsonb_build_object('id', r.id, 'nome', r.nome, 'cidade', r.cidade,
        'militantes', (select count(*) from escola_militancia m where m.nucleo = r.id)) order by r.nome) from rede_nucleos r), '[]'::jsonb),
    'recados', coalesce((select jsonb_agg(jsonb_build_object('id', x.id, 'texto', x.texto, 'ate', x.ate, 'nucleo', x.nucleo) order by x.ate desc, x.criado_em desc)
        from escola_recados x where x.ate >= interno.escola_hoje() - 30), '[]'::jsonb),
    'perguntas', coalesce((select jsonb_agg(jsonb_build_object('semana', q.semana, 'texto', q.texto) order by q.semana desc)
        from escola_perguntas q where q.semana >= interno.escola_hoje() - 63), '[]'::jsonb),
    'semana', date_trunc('week', interno.escola_hoje())::date);
end $$;

-- 5. Permissões e faxina ─────────────────────────────────────────────────────────────────────────────────────────────────
-- As públicas: só para quem tem conta (anon fica de fora; com conta, cada função confere militância ou coordenação).
do $$
declare f record;
begin
  for f in select p.oid::regprocedure as assinatura from pg_proc p join pg_namespace n on n.oid = p.pronamespace
           where p.prokind = 'f' and n.nspname = 'public' and p.proname in ('escola_nucleo', 'escola_encontro_salvar', 'escola_tarefa_pegar',
             'escola_levar_ao_nucleo', 'escola_pergunta_da_semana', 'escola_pergunta_definir', 'escola_recados', 'escola_recado_salvar',
             'escola_acompanhar', 'escola_banca_marcar', 'escola_banca_decidir', 'escola_bancas_listar', 'escola_acompanho',
             'escola_militantes_listar', 'escola_militante_ajustar', 'escola_painel_resumo') loop
    execute format('revoke all on function %s from public', f.assinatura);
    if exists (select 1 from pg_roles where rolname = 'anon') then
      execute format('revoke all on function %s from anon', f.assinatura);
      execute format('grant execute on function %s to authenticated, service_role', f.assinatura);
    end if;
  end loop;
  -- As internas não são chamáveis de fora.
  for f in select p.oid::regprocedure as assinatura from pg_proc p join pg_namespace n on n.oid = p.pronamespace
           where p.prokind = 'f' and n.nspname = 'interno' and p.proname in ('escola_pessoa', 'escola_hoje', 'escola_militante_eu', 'escola_meu_nucleo',
             'escola_medeia', 'escola_encontro_seguinte', 'escola_encontro_anterior', 'escola_pauta_limpa', 'escola_encontro_json',
             'escola_decide_banca') loop
    execute format('revoke all on function %s from public', f.assinatura);
    if exists (select 1 from pg_roles where rolname = 'anon') then execute format('revoke all on function %s from anon, authenticated', f.assinatura); end if;
  end loop;
end $$;

-- Faxina: recados vencidos há mais de 60 dias saem; perguntas com mais de 2 anos também. Os encontros ficam (são a
-- memória do núcleo, sem nome de ninguém além do codinome de quem pegou a tarefa).
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule('lucia-escola-recados-faxina', '41 5 * * *',
      $c$delete from interno.escola_recados where ate < (now() at time zone 'America/Sao_Paulo')::date - 60; delete from interno.escola_perguntas where semana < (now() at time zone 'America/Sao_Paulo')::date - 730$c$);
  end if;
end $$;
