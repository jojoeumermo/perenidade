-- ───────────────────────────── Escola de Formação (F3): aulas ao vivo só da Escola, novembro de 2026 ─────────────────────────────
-- Migração acrescentável: pode rodar mais de uma vez, sem apagar dado nenhum. Precisa da F1 (2026-11-escola-formacao-base.sql,
-- interno.e_militante). Quem junta cola este bloco no fim do install.sql (ordem da Escola: F1, F4, F5, F3, F6).
-- Plano: docs/plano-2026-11/PLANO-ESCOLA.md, seção 4.3. Teste: npm run testar:escola-aovivo.
--
-- O que muda:
--  1. interno.aulas_ao_vivo ganha "publico" ('site', o de sempre, ou 'escola') e "caderno_aula" ('caderno/aula').
--  2. Aula 'escola' NÃO aparece para quem não é militante: nem na agenda pública (aulas_ao_vivo_listar nunca a lista),
--     nem no calendário da equipe, nem no feed de atividade do painel; aula_ao_vivo_ver devolve nada; o bate-papo
--     devolve lista vazia e recusa quem escreve. Decisão de 08/11: quem não é militante não vê nem que há aula.
--  3. No bate-papo da Escola o nome gravado é o CODINOME da Alumia (rede_codinome confirmado), nunca perfis.nome; quem lê
--     não recebe o id de quem escreveu (só "minha"). A moderação é de quem conduz e da coordenação: nada vai para a fila
--     da mediação da Comunidade nem para a segunda avaliação externa (as regras do banco valem; o que fica em dúvida
--     espera quem conduz). Quem escreveu pode esconder a própria fala, mas não pode mostrar de novo o que foi retido.
--  4. public.escola_aulas_hoje() e public.escola_gravacoes(p_caderno) (contrato em lib/escola/contratos.ts).
--  5. O bate-papo da aula 'escola' é apagado 30 dias depois de encerrada (ou cancelada, ou abandonada): pg_cron, se
--     houver, e também a cada aula encerrada (para não depender só do agendador).
--  6. O registro (auditoria) das aulas da Escola sai com departamento 'reservado' (padrão de install.sql, departamento_incluir).
--
-- Limite honesto (também escrito na tela do painel): "não listada" não é secreta. Quem tiver o link assiste no YouTube.
-- O fechamento é o site só entregar o id do vídeo a militantes.

-- 1. As colunas ──────────────────────────────────────────────────────────────────────────────────────────────────────────
alter table interno.aulas_ao_vivo add column if not exists publico text not null default 'site';
alter table interno.aulas_ao_vivo add column if not exists caderno_aula text;
do $$
begin
  alter table interno.aulas_ao_vivo add constraint aulas_ao_vivo_publico_check check (publico in ('site', 'escola'));
exception when duplicate_object then null;
end $$;
do $$
begin
  alter table interno.aulas_ao_vivo add constraint aulas_ao_vivo_caderno_aula_check
    check (caderno_aula is null or (publico = 'escola' and caderno_aula ~ '^[a-z0-9-]{2,80}/[a-z0-9-]{2,120}$'));
exception when duplicate_object then null;
end $$;
create index if not exists aulas_ao_vivo_escola on interno.aulas_ao_vivo (inicio) where publico = 'escola';

-- 2. Quem vê ─────────────────────────────────────────────────────────────────────────────────────────────────────────────
/** Quem chama é militante (ou a coordenação, para si mesma) com a conta ativa. */
create or replace function interno.escola_aovivo_pode() returns boolean language sql stable security definer set search_path = interno, pg_temp as $$
  select auth.uid() is not null and interno.e_militante(auth.uid())
     and coalesce((select not f.suspenso from perfis f where f.id = auth.uid()), false)
$$;

/** A aula aparece para quem chama? Aula do site: sempre. Aula da Escola: só para militante (ou coordenação). */
create or replace function interno.escola_aula_ve(a interno.aulas_ao_vivo) returns boolean language sql stable security definer set search_path = interno, pg_temp as $$
  select a.publico = 'site' or interno.escola_aovivo_pode()
$$;

/** O codinome confirmado da Alumia, ou vazio. Nunca o nome civil. */
create or replace function interno.escola_codinome(p uuid) returns text language sql stable security definer set search_path = interno, pg_temp as $$
  select coalesce((select case when f.rede_codinome_ok then f.rede_codinome end from perfis f where f.id = p), '')
$$;

/** 'caderno/aula' de um dos 11 cadernos da Escola (lib/escola/contratos.ts, CADERNOS_DA_ESCOLA), ou nulo. */
create or replace function interno.escola_caderno_aula_ok(p text) returns text language plpgsql immutable
  set search_path = interno, pg_temp as $$
begin
  if p is null or btrim(p) = '' then return null; end if;
  if p !~ '^[a-z0-9-]{2,80}/[a-z0-9-]{2,120}$' or split_part(p, '/', 1) <> all (array[
    'consciencia-de-classe', 'primeiros-passos-na-militancia', 'conversar-com-quem-pensa-diferente', 'organizacao-de-base',
    'organizacao-sindical-de-base', 'comunicacao-popular', 'seguranca-e-cuidado-na-militancia', 'analise-de-conjuntura',
    'formar-formadores', 'guardar-a-memoria', 'ano-de-formacao-politica']) then
    raise exception 'invalido:caderno_aula' using errcode = 'P0001';
  end if;
  return p;
end $$;

/** Pode dar aula da Escola junto: militante do departamento ou da coordenação/vice. */
create or replace function interno.escola_pode_conduzir(p uuid) returns boolean language sql stable security definer set search_path = interno, pg_temp as $$
  select p is not null and (interno.membro_direto(p, 'revolucionarios') or exists (select 1 from papeis x where x.usuario = p and x.papel in ('coordenacao', 'vice')))
$$;

-- 3. A aula em JSON (o mesmo de antes, com publico e caderno_aula; na Escola, codinomes) ─────────────────────────────────
create or replace function interno.aula_json(a interno.aulas_ao_vivo, p_completa boolean) returns jsonb language sql stable security definer set search_path = interno, pg_temp as $$
  select jsonb_build_object(
    'id', a.id, 'titulo', a.titulo, 'descricao', a.descricao, 'disciplina', a.disciplina, 'trilha', a.trilha, 'inicio', a.inicio, 'duracao', a.duracao,
    'status', a.status, 'iniciada_em', a.iniciada_em, 'encerrada_em', a.encerrada_em, 'gravacao', a.gravacao, 'sala_externa', a.sala_externa, 'youtube', a.youtube,
    'publico', a.publico, 'caderno_aula', a.caderno_aula,
    'educador', case when a.publico = 'escola'
      then jsonb_build_object('id', case when interno.conduz(a) then a.educador end, 'nome', interno.escola_codinome(a.educador))
      else jsonb_build_object('id', a.educador, 'nome', coalesce((select nome from perfis where id = a.educador), '')) end,
    'co_educadores', case when a.publico = 'escola'
      then coalesce((select jsonb_agg(jsonb_build_object('id', case when interno.conduz(a) then x end, 'nome', interno.escola_codinome(x)) order by x) from unnest(a.co_educadores) x), '[]'::jsonb)
      else coalesce((select jsonb_agg(jsonb_build_object('id', f.id, 'nome', f.nome) order by f.nome) from perfis f where f.id = any (a.co_educadores)), '[]'::jsonb) end,
    'inscritos', (select count(*) from aulas_inscricoes i where i.aula = a.id),
    'inscrito', auth.uid() is not null and exists (select 1 from aulas_inscricoes i where i.aula = a.id and i.usuario = auth.uid()),
    'conduzo', interno.conduz(a),
    'chaves', coalesce((select jsonb_agg(k.publica order by k.criado_em) from aulas_sala_chaves k where k.aula = a.id), '[]'::jsonb),
    'mensagens', case when p_completa then (select count(*) from aulas_chat m where m.aula = a.id and not m.oculta) else null end)
$$;

-- 4. A agenda pública e a aula: a Escola fica de fora ───────────────────────────────────────────────────────────────────
/** A agenda pública: só as aulas do site (as da Escola moram em escola_aulas_hoje, só para militante). */
create or replace function public.aulas_ao_vivo_listar(p_disciplina text default null, p_dias integer default 60) returns jsonb language sql stable security definer set search_path = interno, pg_temp as $$
  select coalesce(jsonb_agg(interno.aula_json(a, false) order by a.inicio), '[]'::jsonb)
  from aulas_ao_vivo a
  where a.publico = 'site'
    and (p_disciplina is null or a.disciplina = p_disciplina)
    and ((a.status in ('agendada', 'ao_vivo') and a.inicio < now() + make_interval(days => greatest(1, least(coalesce(p_dias, 60), 180))) and a.inicio > now() - interval '12 hours')
         or (a.status = 'encerrada' and a.gravacao <> '' and a.inicio > now() - interval '30 days'))
$$;

create or replace function public.aula_ao_vivo_ver(p_id uuid) returns jsonb language sql stable security definer set search_path = interno, pg_temp as $$
  select interno.aula_json(a, true) from aulas_ao_vivo a
  where a.id = p_id and (a.status <> 'cancelada' or interno.conduz(a)) and interno.escola_aula_ve(a)
$$;

/** Marca ou altera uma aula. Quem conduz edita; co-educadores recebem um recado ao serem chamados. Aula da Escola: só quem vê os Revolucionários marca. */
create or replace function public.aula_ao_vivo_salvar(p_id uuid, p jsonb) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare
  v uuid := interno.eu();
  a aulas_ao_vivo;
  v_co uuid[] := coalesce((select array_agg((x #>> '{}')::uuid) from jsonb_array_elements(coalesce(p -> 'co_educadores', '[]'::jsonb)) x), '{}');
  v_inicio timestamptz;
  v_disc text;
  v_publico text := coalesce(nullif(p ->> 'publico', ''), 'site');
  v_caderno text := interno.escola_caderno_aula_ok(p ->> 'caderno_aula');
  v_reservado jsonb;
  c uuid;
begin
  if not interno.educador() then perform interno.erro('sem_permissao'); end if;
  if v_publico not in ('site', 'escola') then perform interno.erro('invalido:publico'); end if;
  if p_id is not null then
    select * into a from aulas_ao_vivo where id = p_id for update;
    if not found then perform interno.erro('nao_encontrado'); end if;
    if not interno.conduz(a) then perform interno.erro('sem_permissao'); end if;
    if a.publico = 'escola' and not interno.escola_aovivo_pode() then perform interno.erro('sem_permissao'); end if;
    if a.status = 'cancelada' or (a.status = 'encerrada' and a.publico = 'site') then perform interno.erro('ja_decidida'); end if;
    -- Aula da Escola encerrada: só a gravação e a ligação com a aula do caderno (o resto ficou no passado). A do site
    -- continua como antes (encerrada não se edita).
    if a.status = 'encerrada' then
      update aulas_ao_vivo set gravacao = coalesce(interno.txt(p ->> 'gravacao', 'gravacao', 0, 500), gravacao),
        caderno_aula = case when a.publico = 'escola' and p ? 'caderno_aula' then v_caderno else caderno_aula end, atualizado_em = now()
      where id = p_id returning * into a;
      return interno.aula_json(a, true);
    end if;
    v_publico := a.publico; -- o público nasce com a aula e não muda
  end if;
  v_reservado := case when v_publico = 'escola' then jsonb_build_object('departamento', 'reservado') else '{}'::jsonb end;
  if v_publico = 'site' then v_caderno := null; end if;
  -- Aula da Escola: a disciplina é sempre a do departamento (o registro e a supervisão já tratam 'revolucionarios' como
  -- reservado) e não há sala de fora: a aula passa pelo YouTube não listado, e só militante recebe o id.
  v_disc := case when v_publico = 'escola' then 'revolucionarios' else interno.disciplina_ok(p ->> 'disciplina') end;
  if v_publico = 'escola' then p := p || jsonb_build_object('sala_externa', '', 'trilha', null); end if;
  if v_disc is null then perform interno.erro('invalido:disciplina'); end if;
  begin
    v_inicio := (p ->> 'inicio')::timestamptz;
  exception when others then perform interno.erro('invalido:inicio');
  end;
  if v_inicio is null or v_inicio > now() + interval '365 days' then perform interno.erro('invalido:inicio'); end if;
  if cardinality(v_co) > 8 then perform interno.erro('invalido:co_educadores'); end if;
  v_co := array_remove(v_co, v);
  if exists (select 1 from unnest(v_co) x where not exists (select 1 from papeis p2 where p2.usuario = x and p2.papel in ('educacao', 'educacao_secundaria', 'coordenacao', 'vice', 'mentoria'))) then
    perform interno.erro('invalido:co_educadores');
  end if;
  -- Na Escola, quem dá a aula junto também tem de ser militante (ou da coordenação).
  if v_publico = 'escola' and exists (select 1 from unnest(v_co) x where not interno.escola_pode_conduzir(x)) then
    perform interno.erro('invalido:co_educadores');
  end if;
  if p_id is null then
    if v_publico = 'escola' and not (interno.ve_revolucionarios() and interno.escola_aovivo_pode()) then perform interno.erro('sem_permissao'); end if;
    if v_inicio < now() - interval '1 hour' then perform interno.erro('invalido:inicio'); end if;
    perform interno.limite('aula_ao_vivo', 20, 1440);
    insert into aulas_ao_vivo (titulo, descricao, disciplina, trilha, inicio, duracao, educador, co_educadores, sala_externa, publico, caderno_aula)
    values (interno.txt(p ->> 'titulo', 'titulo', 3, 140), interno.txt(p ->> 'descricao', 'descricao', 0, 2000), v_disc,
            nullif(interno.txt(p ->> 'trilha', 'trilha', 0, 80), ''), v_inicio, coalesce((p ->> 'duracao')::integer, 60), v, v_co,
            interno.txt(p ->> 'sala_externa', 'sala_externa', 0, 500), v_publico, v_caderno)
    returning * into a;
    perform interno.registrar('aula_ao_vivo_marcada', a.titulo, jsonb_build_object('id', a.id, 'inicio', a.inicio) || v_reservado);
    foreach c in array v_co loop
      perform interno.avisar(c, format('%s chamou você para dar junto a aula ao vivo "%s", em %s. Veja em Aulas ao vivo.',
        case when v_publico = 'escola' then coalesce(nullif(interno.escola_codinome(v), ''), 'Um colega') else coalesce((select nome from perfis where id = v), 'Um colega') end,
        left(a.titulo, 100), to_char(a.inicio at time zone 'America/Sao_Paulo', 'DD/MM HH24:MI')));
    end loop;
  else
    foreach c in array v_co loop
      if not (c = any (a.co_educadores)) then
        perform interno.avisar(c, format('%s chamou você para dar junto a aula ao vivo "%s". Veja em Aulas ao vivo.',
          case when v_publico = 'escola' then coalesce(nullif(interno.escola_codinome(v), ''), 'Um colega') else coalesce((select nome from perfis where id = v), 'Um colega') end,
          left(p ->> 'titulo', 100)));
      end if;
    end loop;
    update aulas_ao_vivo set titulo = interno.txt(p ->> 'titulo', 'titulo', 3, 140), descricao = interno.txt(p ->> 'descricao', 'descricao', 0, 2000), disciplina = v_disc,
      trilha = nullif(interno.txt(p ->> 'trilha', 'trilha', 0, 80), ''), inicio = v_inicio, duracao = coalesce((p ->> 'duracao')::integer, a.duracao),
      co_educadores = v_co, sala_externa = interno.txt(p ->> 'sala_externa', 'sala_externa', 0, 500), gravacao = coalesce(interno.txt(p ->> 'gravacao', 'gravacao', 0, 500), a.gravacao),
      caderno_aula = case when a.publico = 'escola' and p ? 'caderno_aula' then v_caderno else a.caderno_aula end, atualizado_em = now()
    where id = p_id returning * into a;
  end if;
  return interno.aula_json(a, true);
end $$;

/** Começar, encerrar, cancelar ou voltar a "agendada" (o mesmo de antes; na Escola, registro reservado e faxina do bate-papo velho). */
create or replace function public.aula_ao_vivo_estado(p_id uuid, p_status text) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); a aulas_ao_vivo; r record;
begin
  select * into a from aulas_ao_vivo where id = p_id for update;
  if not found then perform interno.erro('nao_encontrado'); end if;
  if not interno.conduz(a) then perform interno.erro('sem_permissao'); end if;
  if a.publico = 'escola' and not interno.escola_aovivo_pode() then perform interno.erro('sem_permissao'); end if;
  if p_status not in ('agendada', 'ao_vivo', 'encerrada', 'cancelada') then perform interno.erro('invalido:status'); end if;
  if a.status = p_status then return interno.aula_json(a, true); end if;
  if p_status = 'ao_vivo' then
    if a.inicio > now() + interval '2 hours' then perform interno.erro('invalido:inicio'); end if;
    update aulas_ao_vivo set status = 'ao_vivo', iniciada_em = coalesce(iniciada_em, now()), encerrada_em = null, atualizado_em = now() where id = p_id returning * into a;
    insert into aulas_chat (aula, autor, nome, corpo, tipo) values (a.id, v, '', 'A aula começou.', 'sistema');
    for r in select i.usuario from aulas_inscricoes i where i.aula = a.id and i.usuario <> v loop
      perform interno.avisar(r.usuario, case when a.publico = 'escola'
        then format('A aula ao vivo da Escola "%s" começou agora. Entre pela Escola.', left(a.titulo, 100))
        else format('A aula ao vivo "%s" começou agora. Entre pela agenda de aulas ao vivo.', left(a.titulo, 100)) end);
    end loop;
  elsif p_status = 'encerrada' then
    update aulas_ao_vivo set status = 'encerrada', encerrada_em = now(), atualizado_em = now(),
      gravacao = case when gravacao = '' and youtube is not null then 'https://www.youtube.com/watch?v=' || youtube else gravacao end
    where id = p_id returning * into a;
    insert into aulas_chat (aula, autor, nome, corpo, tipo) values (a.id, v, '', 'A aula terminou. Obrigado a quem participou.', 'sistema');
    perform interno.escola_aovivo_faxina();
  elsif p_status = 'cancelada' then
    update aulas_ao_vivo set status = 'cancelada', atualizado_em = now() where id = p_id returning * into a;
    for r in select i.usuario from aulas_inscricoes i where i.aula = a.id and i.usuario <> v loop
      perform interno.avisar(r.usuario, format('A aula ao vivo "%s" foi cancelada.', left(a.titulo, 100)));
    end loop;
  else
    update aulas_ao_vivo set status = 'agendada', iniciada_em = null, encerrada_em = null, atualizado_em = now() where id = p_id returning * into a;
  end if;
  perform interno.registrar('aula_ao_vivo_' || p_status, a.titulo, jsonb_build_object('id', a.id)
    || case when a.publico = 'escola' then jsonb_build_object('departamento', 'reservado') else '{}'::jsonb end);
  return interno.aula_json(a, true);
end $$;

create or replace function public.aula_ao_vivo_apagar(p_id uuid) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); a aulas_ao_vivo;
begin
  select * into a from aulas_ao_vivo where id = p_id;
  if not found then perform interno.erro('nao_encontrado'); end if;
  if not (interno.coord() or (a.educador = v and a.status <> 'ao_vivo')) then perform interno.erro('sem_permissao'); end if;
  delete from aulas_ao_vivo where id = p_id;
  perform interno.registrar('aula_ao_vivo_apagada', a.titulo, jsonb_build_object('id', p_id)
    || case when a.publico = 'escola' then jsonb_build_object('departamento', 'reservado') else '{}'::jsonb end);
  return jsonb_build_object('ok', true);
end $$;

/** Quem tem conta marca presença: recebe recado quando a aula começa. Aula da Escola: só militante. */
create or replace function public.aula_ao_vivo_inscrever(p_id uuid, p_inscrever boolean default true) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu();
begin
  if not exists (select 1 from aulas_ao_vivo a where a.id = p_id and a.status in ('agendada', 'ao_vivo') and interno.escola_aula_ve(a)) then perform interno.erro('nao_encontrado'); end if;
  if p_inscrever then
    perform interno.limite('aula_inscrever', 60, 60);
    insert into aulas_inscricoes (aula, usuario) values (p_id, v) on conflict do nothing;
  else
    delete from aulas_inscricoes where aula = p_id and usuario = v;
  end if;
  return jsonb_build_object('inscrito', p_inscrever, 'inscritos', (select count(*) from aulas_inscricoes where aula = p_id));
end $$;

-- 5. O bate-papo ─────────────────────────────────────────────────────────────────────────────────────────────────────────
/** A fala no bate-papo da Escola: sem o id de quem escreveu (só "minha"), com "esperando" quando espera quem conduz. */
create or replace function interno.escola_chat_json(m interno.aulas_chat) returns jsonb language sql stable security definer set search_path = interno, pg_temp as $$
  select jsonb_build_object('id', m.id, 'autor', null, 'minha', m.autor is not null and m.autor = auth.uid(), 'nome', m.nome, 'corpo', m.corpo, 'tipo', m.tipo,
    'oculta', m.oculta, 'retido', false, 'esperando', m.oculta and m.avaliacao = 'revisao', 'criado_em', m.criado_em)
$$;

/** Fala no bate-papo da aula (precisa de conta). Abre meia hora antes e fecha quando a aula termina. Na Escola: só militante, com o codinome. */
create or replace function public.aula_chat_enviar(p_aula uuid, p_corpo text, p_tipo text default 'fala') returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); a aulas_ao_vivo; m aulas_chat; v_corpo text := interno.txt(p_corpo, 'corpo', 1, 500); v_nome text; v_av jsonb; v_veredito text;
begin
  select * into a from aulas_ao_vivo where id = p_aula;
  if not found then perform interno.erro('nao_encontrado'); end if;
  if a.publico = 'escola' and not interno.escola_aovivo_pode() then perform interno.erro('sem_permissao'); end if;
  if a.status in ('encerrada', 'cancelada') then perform interno.erro('topico_trancado'); end if;
  if not (a.status = 'ao_vivo' or a.inicio < now() + interval '30 minutes' or interno.conduz(a)) then perform interno.erro('topico_trancado'); end if;
  if p_tipo not in ('fala', 'pergunta') then perform interno.erro('invalido:tipo'); end if;
  perform interno.limite('aula_chat', 40, 2);
  if a.publico = 'escola' then
    -- Na Escola só se fala pelo codinome da Alumia: sem ele confirmado, nada de nome nenhum (nem o civil).
    if interno.escola_codinome(v) = '' then perform interno.erro('confirme_codinome'); end if;
    -- Só as regras do banco: nada sai para a avaliação externa nem para a fila da mediação da Comunidade. O que fica em
    -- dúvida espera quem conduz a aula (escondido para os outros, visível para quem escreveu).
    v_av := interno.veredito(v_corpo, interno.conduz(a), v);
    v_veredito := v_av ->> 'veredito';
    if v_veredito = 'bloquear' then
      perform interno.registrar('comunidade_bloqueada', p_aula::text, jsonb_build_object('tipo', 'aula_chat', 'motivo', v_av ->> 'motivo', 'departamento', 'reservado'));
      perform interno.erro('conteudo_recusado');
    end if;
    insert into aulas_chat (aula, autor, nome, corpo, tipo, oculta, retido, avaliacao, motivo)
    values (p_aula, v, interno.escola_codinome(v), v_corpo, p_tipo, v_veredito <> 'publicar', false,
            case v_veredito when 'publicar' then 'publicada' else 'revisao' end, coalesce(v_av ->> 'motivo', '')) returning * into m;
    return interno.escola_chat_json(m) || jsonb_build_object('avaliando', false);
  end if;
  -- Aula do site: como sempre (a mesma avaliação da Comunidade; quem conduz fala direto).
  v_av := interno.moderar_texto(v_corpo, v, interno.conduz(a));
  v_veredito := v_av ->> 'veredito';
  if v_veredito = 'bloquear' then
    perform interno.registrar('comunidade_bloqueada', p_aula::text, jsonb_build_object('tipo', 'aula_chat', 'motivo', v_av ->> 'motivo'));
    perform interno.erro('conteudo_recusado');
  end if;
  select nome into v_nome from perfis where id = v;
  insert into aulas_chat (aula, autor, nome, corpo, tipo, oculta, retido, avaliacao, motivo)
  values (p_aula, v, coalesce(v_nome, ''), v_corpo, p_tipo, v_veredito <> 'publicar', v_veredito = 'revisar',
          case v_veredito when 'publicar' then 'publicada' else 'revisao' end, v_av ->> 'motivo') returning * into m;
  return interno.chat_aula_json(m) || jsonb_build_object('avaliando', coalesce((v_av ->> 'externa')::boolean, false));
end $$;

/** O bate-papo. Aula do site: qualquer visitante lê (como antes). Aula da Escola: só militante; os outros recebem lista vazia. */
create or replace function public.aula_chat_listar(p_aula uuid, p_depois timestamptz default null) returns jsonb language plpgsql stable security definer set search_path = interno, pg_temp as $$
declare a aulas_ao_vivo; v_conduzo boolean := false;
begin
  select * into a from aulas_ao_vivo where id = p_aula;
  if not found then return '[]'::jsonb; end if;
  v_conduzo := interno.conduz(a);
  if a.publico = 'escola' then
    if not interno.escola_aovivo_pode() then return '[]'::jsonb; end if;
    return coalesce((select jsonb_agg(interno.escola_chat_json(m) order by m.criado_em) from (
      select * from aulas_chat m where m.aula = p_aula
        and (not m.oculta or v_conduzo or (m.autor = auth.uid() and m.avaliacao = 'revisao'))
        and (p_depois is null or m.criado_em > p_depois) order by m.criado_em desc limit 300) m), '[]'::jsonb);
  end if;
  return coalesce((select jsonb_agg(interno.chat_aula_json(m) order by m.criado_em) from (
    select * from aulas_chat m where m.aula = p_aula and (not m.oculta or v_conduzo or (m.retido and m.autor = auth.uid()))
      and (p_depois is null or m.criado_em > p_depois) order by m.criado_em desc limit 300) m), '[]'::jsonb);
end $$;

/**
 * Esconder ou mostrar uma fala. Aula do site: quem conduz, a mediação, a coordenação e quem escreveu (como antes).
 * Aula da Escola: quem conduz (a coordenação conduz todas); quem escreveu só esconde a própria fala. A mediação da
 * Comunidade fica de fora (supervisão fora da Escola).
 */
create or replace function public.aula_chat_moderar(p_id uuid, p_ocultar boolean) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); m aulas_chat; a aulas_ao_vivo;
begin
  select * into m from aulas_chat where id = p_id;
  if not found then perform interno.erro('nao_encontrado'); end if;
  select * into a from aulas_ao_vivo where id = m.aula;
  if a.publico = 'escola' then
    if not interno.escola_aovivo_pode() then perform interno.erro('nao_encontrado'); end if;
    if not (interno.conduz(a) or (m.autor = v and coalesce(p_ocultar, true))) then perform interno.erro('sem_permissao'); end if;
    update aulas_chat set oculta = coalesce(p_ocultar, true),
      avaliacao = case when not coalesce(p_ocultar, true) and avaliacao = 'revisao' then 'revista' else avaliacao end
    where id = p_id;
    return jsonb_build_object('ok', true);
  end if;
  if not (interno.conduz(a) or interno.media() or m.autor = v) then perform interno.erro('sem_permissao'); end if;
  update aulas_chat set oculta = p_ocultar where id = p_id;
  return jsonb_build_object('ok', true);
end $$;

-- 6. A Escola lê as suas aulas (contrato: lib/escola/contratos.ts) ─────────────────────────────────────────────────────────
/** Uma aula da Escola no formato do contrato (AulaAoVivoDaEscola). "agendada" vira "marcada". */
create or replace function interno.escola_aula_json(a interno.aulas_ao_vivo) returns jsonb language sql stable security definer set search_path = interno, pg_temp as $$
  select jsonb_build_object('id', a.id, 'titulo', a.titulo, 'inicio', a.inicio,
    'status', case a.status when 'agendada' then 'marcada' else a.status end,
    'caderno_aula', a.caderno_aula, 'youtube', a.youtube)
$$;

/** As aulas da Escola de hoje, as dos próximos 7 dias (horário de Brasília) e as gravadas dos últimos 90 dias. Só militante. */
create or replace function public.escola_aulas_hoje() returns jsonb language plpgsql stable security definer set search_path = interno, pg_temp as $$
declare v_hoje date := (now() at time zone 'America/Sao_Paulo')::date;
begin
  if not interno.escola_aovivo_pode() then perform interno.erro('sem_permissao'); end if;
  return jsonb_build_object(
    'hoje', coalesce((select jsonb_agg(interno.escola_aula_json(a) order by a.inicio) from aulas_ao_vivo a
                      where a.publico = 'escola' and a.status in ('agendada', 'ao_vivo', 'encerrada')
                        and ((a.inicio at time zone 'America/Sao_Paulo')::date = v_hoje or a.status = 'ao_vivo')), '[]'::jsonb),
    'proximas', coalesce((select jsonb_agg(interno.escola_aula_json(a) order by a.inicio) from aulas_ao_vivo a
                          where a.publico = 'escola' and a.status = 'agendada'
                            and (a.inicio at time zone 'America/Sao_Paulo')::date between v_hoje + 1 and v_hoje + 7), '[]'::jsonb),
    'gravadas', coalesce((select jsonb_agg(interno.escola_aula_json(g) order by g.inicio desc) from (
                          select * from aulas_ao_vivo a where a.publico = 'escola' and a.status = 'encerrada' and a.youtube is not null
                            and a.inicio > now() - interval '90 days' order by a.inicio desc limit 12) g), '[]'::jsonb));
end $$;

/**
 * As gravações da Escola ligadas a um caderno ("caderno") ou a uma aula dele ("caderno/aula"): as aulas encerradas com
 * vídeo no YouTube, da mais nova para a mais velha. Só militante.
 */
create or replace function public.escola_gravacoes(p_caderno text) returns jsonb language plpgsql stable security definer set search_path = interno, pg_temp as $$
begin
  if not interno.escola_aovivo_pode() then perform interno.erro('sem_permissao'); end if;
  if coalesce(p_caderno, '') !~ '^[a-z0-9-]{2,80}(/[a-z0-9-]{2,120})?$' then perform interno.erro('invalido:caderno'); end if;
  return coalesce((select jsonb_agg(interno.escola_aula_json(g) order by g.inicio desc) from (
    select * from aulas_ao_vivo a where a.publico = 'escola' and a.status = 'encerrada' and a.youtube is not null
      and (a.caderno_aula = p_caderno or (strpos(p_caderno, '/') = 0 and a.caderno_aula like p_caderno || '/%'))
    order by a.inicio desc limit 20) g), '[]'::jsonb);
end $$;

-- 7. O que mais lia as aulas: calendário da equipe, feed de atividade e a função do YouTube ───────────────────────────────
/** O calendário único da equipe (o mesmo de antes): aula da Escola só para quem vê os Revolucionários, com o codinome. */
create or replace function public.calendario_equipe(p_de date, p_ate date) returns jsonb language plpgsql stable security definer set search_path = interno, pg_temp as $$
declare v_de date := coalesce(p_de, current_date); v_ate date := least(coalesce(p_ate, current_date + 30), coalesce(p_de, current_date) + 120);
begin
  perform interno.eu();
  if not interno.voluntario() then perform interno.erro('sem_permissao'); end if;
  return coalesce((select jsonb_agg(e order by e ->> 'dia', e ->> 'hora') from (
    select jsonb_build_object('tipo', 'pauta', 'subtipo', x.tipo, 'id', x.id, 'titulo', x.titulo, 'dia', x.data_prevista, 'hora', '', 'situacao', x.status,
             'quem', coalesce((select interno.nome_visto(nome) from perfis where id = x.responsavel), '')) as e
      from pautas x where x.data_prevista between v_de and v_ate and x.status <> 'descartada'
    union all
    select jsonb_build_object('tipo', 'post', 'subtipo', d.formato, 'id', d.id, 'titulo', d.titulo, 'dia', d.data_prevista, 'hora', '', 'situacao', d.situacao, 'quem', '')
      from divulgacao d where d.data_prevista between v_de and v_ate
    union all
    select jsonb_build_object('tipo', 'aula', 'subtipo', a.disciplina, 'id', a.id, 'titulo', a.titulo, 'dia', (a.inicio at time zone 'America/Sao_Paulo')::date,
             'hora', to_char(a.inicio at time zone 'America/Sao_Paulo', 'HH24:MI'), 'situacao', a.status,
             'quem', case when a.publico = 'escola' then interno.escola_codinome(a.educador) else coalesce((select interno.nome_visto(nome) from perfis where id = a.educador), '') end)
      from aulas_ao_vivo a where a.status <> 'cancelada' and (a.inicio at time zone 'America/Sao_Paulo')::date between v_de and v_ate
        and (a.publico = 'site' or interno.ve_revolucionarios())
    union all
    select jsonb_build_object('tipo', 'reuniao', 'subtipo', r.tipo, 'id', r.id, 'titulo', r.titulo, 'dia', (r.inicio at time zone 'America/Sao_Paulo')::date,
             'hora', to_char(r.inicio at time zone 'America/Sao_Paulo', 'HH24:MI'), 'situacao', r.status, 'quem', '')
      from reunioes r where r.status <> 'cancelada' and (r.inicio at time zone 'America/Sao_Paulo')::date between v_de and v_ate and (interno.reuniao_entra(r) or r.tipo = 'aberta')
  ) eventos), '[]'::jsonb);
end $$;

-- O feed de atividade do painel ("Aula ao vivo marcada: <título>") é lido pela equipe toda: aula da Escola não entra.
do $$
begin
  if to_regprocedure('interno.atividade_gatilho()') is not null then
    drop trigger if exists atividade on interno.aulas_ao_vivo;
    create trigger atividade after insert on interno.aulas_ao_vivo for each row when (new.publico = 'site') execute function interno.atividade_gatilho();
  end if;
end $$;

/** Para a função do serviço "youtube": o mesmo de antes, com o público (aula da Escola vai sempre não listada) e, na Escola, sem nome. */
create or replace function public.youtube_transmissao_dados(p_aula uuid) returns jsonb language plpgsql stable security definer set search_path = interno, pg_temp as $$
begin
  if not interno.servico() then perform interno.erro('sem_permissao'); end if;
  return (select jsonb_build_object('id', a.id, 'titulo', a.titulo, 'descricao', case when a.publico = 'escola' then '' else a.descricao end, 'disciplina', a.disciplina, 'inicio', a.inicio,
            'duracao', a.duracao, 'status', a.status, 'publico', a.publico,
            'educador', case when a.publico = 'escola' then '' else coalesce((select nome from perfis where id = a.educador), '') end,
            'youtube', t.broadcast, 'stream', t.stream, 'rtmp', t.rtmp, 'chave', t.chave)
          from aulas_ao_vivo a left join transmissoes t on t.aula = a.id where a.id = p_aula);
end $$;

-- 8. O bate-papo da Escola some 30 dias depois ───────────────────────────────────────────────────────────────────────────
/** Apaga o bate-papo das aulas da Escola encerradas (ou canceladas, ou abandonadas sem encerrar) há mais de 30 dias. */
create or replace function interno.escola_aovivo_faxina() returns integer language plpgsql security definer set search_path = interno, pg_temp as $$
declare n integer;
begin
  delete from aulas_chat m using aulas_ao_vivo a
  where a.id = m.aula and a.publico = 'escola'
    and ((a.status = 'encerrada' and coalesce(a.encerrada_em, a.inicio) < now() - interval '30 days')
      or (a.status = 'cancelada' and a.atualizado_em < now() - interval '30 days')
      or (a.status in ('agendada', 'ao_vivo') and a.inicio + make_interval(mins => a.duracao) < now() - interval '30 days'));
  get diagnostics n = row_count;
  return n;
end $$;

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule('lucia-escola-aovivo-faxina', '41 5 * * *', $c$select interno.escola_aovivo_faxina()$c$);
  end if;
end $$;

-- 9. Permissões ──────────────────────────────────────────────────────────────────────────────────────────────────────────
-- As de "public" abertas pela API (cada uma confere quem chama); as de "interno", fechadas.
do $$
declare f record;
begin
  for f in select p.oid::regprocedure as assinatura, n.nspname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
           where p.prokind = 'f' and (
             (n.nspname = 'public' and p.proname in ('aulas_ao_vivo_listar', 'aula_ao_vivo_ver', 'aula_ao_vivo_salvar', 'aula_ao_vivo_estado', 'aula_ao_vivo_apagar',
               'aula_ao_vivo_inscrever', 'aula_chat_enviar', 'aula_chat_listar', 'aula_chat_moderar', 'escola_aulas_hoje', 'escola_gravacoes', 'calendario_equipe', 'youtube_transmissao_dados'))
             or (n.nspname = 'interno' and p.proname in ('escola_aovivo_pode', 'escola_aula_ve', 'escola_codinome', 'escola_caderno_aula_ok', 'escola_pode_conduzir',
               'aula_json', 'escola_chat_json', 'escola_aula_json', 'escola_aovivo_faxina'))) loop
    execute format('revoke all on function %s from public', f.assinatura);
    if f.nspname = 'public' then
      execute format('grant execute on function %s to anon, authenticated, service_role', f.assinatura);
    elsif exists (select 1 from pg_roles where rolname = 'anon') then
      execute format('revoke all on function %s from anon, authenticated', f.assinatura);
    end if;
  end loop;
end $$;
