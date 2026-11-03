-- ───────────────────────────── Escola Lúcia Maria, novembro de 2026 ─────────────────────────────
-- Migração acrescentável: pode rodar mais de uma vez, sem apagar dado nenhum. O mesmo bloco está no fim do install.sql.
-- Explicação, decisões e o passo de produção: docs/escola/banco.md. Teste: npm run testar:escola-banco.
--
-- Só acréscimo. Nenhuma função que já existe é redefinida (contar, turma_mes, turma_mes_entrar, erro_relatar,
-- aulas_funcionam, jornal_mais_lidas e interno.limite ficam como estão).
--
-- 1. interno.contagens_escola: somas anônimas por dia (presença, matrícula, formatura, turma e voto da assembleia).
-- 2. interno.escola_alvos e escola_alvos_definir: a lista de cursos e pautas que existem (mantida pela publicação).
-- 3. contar_escola: soma um, sem devolver nada. A chave do freio NUNCA leva o alvo (o curso, a trilha votada).
-- 4. escola_contagens: totais por alvo, em ordem de alvo (sem ranking).
-- 5. escola_presenca_hoje: três números para a entrada da Escola, lidos das contagens que já existem.
-- 6. Turmas por curso: como a Turma do mês, exige conta; no curso sensível, só com consentimento; sair apaga.
-- 7. Ouvidoria do estudante: sem conta, sem endereço de rede na tabela; em público só o resumo da mediação.
--
-- Por que o alvo não entra na chave do freio: interno.limite grava em interno.limites a chave
-- '<acao>:' || coalesce(conta, md5('lucia:' || endereço de rede)) por até dois dias. O md5 não tem sal, e um endereço
-- IPv4 se recupera por tentativa. Se a chave levasse o curso ou a trilha votada, o banco ligaria o endereço de rede a
-- um voto ou a um curso de formação política. Aqui ela leva só o tipo ('contar_escola:assembleia_voto'), que diz no
-- máximo que aquela origem votou em algo naquele minuto, nunca em quê.

-- 1. Somas anônimas da Escola ───────────────────────────────────────────────────────────────────────────────────────────
create table if not exists interno.contagens_escola (
  tipo text not null check (tipo in ('escola_presenca', 'escola_matricula', 'escola_formatura', 'escola_turma', 'assembleia_voto')),
  alvo text not null check (alvo ~ '^[a-z0-9/._-]{1,160}$'),
  dia date not null,
  total integer not null default 0,
  primary key (tipo, alvo, dia)
);
alter table interno.contagens_escola enable row level security;
revoke all on interno.contagens_escola from public;
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'anon') then revoke all on interno.contagens_escola from anon, authenticated; end if;
end $$;

-- 2. O que existe para ser contado ──────────────────────────────────────────────────────────────────────────────────────
-- 'curso': os cursos (e 'escola', o alvo geral); 'curso-sensivel': os cursos cujo vínculo revela opinião política;
-- 'assembleia': as pautas 'AAAA.S/trilha'. Lista vazia: aceita qualquer alvo no formato, como a lista de contar.
create table if not exists interno.escola_alvos (
  grupo text not null check (grupo in ('curso', 'curso-sensivel', 'assembleia')),
  alvo text not null check (alvo ~ '^[a-z0-9/._-]{1,160}$'),
  primary key (grupo, alvo)
);
alter table interno.escola_alvos enable row level security;
revoke all on interno.escola_alvos from public;
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'anon') then revoke all on interno.escola_alvos from anon, authenticated; end if;
end $$;

/** Troca a lista inteira de um grupo. Só o serviço (scripts/alvos-de-contagem.mjs, com a chave de serviço). */
create or replace function public.escola_alvos_definir(p_grupo text, p_alvos text[]) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
begin
  if not interno.servico() then perform interno.erro('sem_permissao'); end if;
  if p_grupo is null or p_grupo not in ('curso', 'curso-sensivel', 'assembleia') then perform interno.erro('invalido:grupo'); end if;
  if coalesce(array_length(p_alvos, 1), 0) > 50000 then perform interno.erro('invalido:alvos'); end if;
  delete from escola_alvos where grupo = p_grupo;
  insert into escola_alvos (grupo, alvo)
  select p_grupo, a from unnest(coalesce(p_alvos, '{}')) a where a ~ '^[a-z0-9/._-]{1,160}$'
  on conflict do nothing;
  return jsonb_build_object('ok', true, 'total', (select count(*) from escola_alvos where grupo = p_grupo));
end $$;
revoke all on function public.escola_alvos_definir(text, text[]) from public;
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'anon') then revoke all on function public.escola_alvos_definir(text, text[]) from anon, authenticated; end if;
  if exists (select 1 from pg_roles where rolname = 'service_role') then grant execute on function public.escola_alvos_definir(text, text[]) to service_role; end if;
end $$;

-- 3. Somar um ───────────────────────────────────────────────────────────────────────────────────────────────────────────
/**
 * Soma um à contagem do dia (fuso de Brasília). Responde sempre vazio: quem chama não fica sabendo de nada, nem se
 * contou. Tipo fora da lista, alvo fora do formato ou fora da lista do grupo: não grava. O freio é por tipo e geral,
 * nunca pelo alvo (veja o alto deste bloco).
 */
create or replace function public.contar_escola(p_tipo text, p_alvo text) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
begin
  if coalesce(p_tipo, '') not in ('escola_presenca', 'escola_matricula', 'escola_formatura', 'escola_turma', 'assembleia_voto') then return '{}'::jsonb; end if;
  if coalesce(p_alvo, '') !~ '^[a-z0-9/._-]{1,160}$' then return '{}'::jsonb; end if;
  if p_tipo = 'assembleia_voto' then
    -- O voto é sempre numa pauta do semestre: 'AAAA.S/trilha'.
    if p_alvo !~ '^[0-9]{4}\.[12]/[a-z0-9_-]{1,150}$' then return '{}'::jsonb; end if;
    if exists (select 1 from escola_alvos where grupo = 'assembleia')
       and not exists (select 1 from escola_alvos where grupo = 'assembleia' and alvo = p_alvo) then
      return '{}'::jsonb;
    end if;
  elsif p_alvo <> 'escola'
     and exists (select 1 from escola_alvos where grupo in ('curso', 'curso-sensivel'))
     and not exists (select 1 from escola_alvos where grupo in ('curso', 'curso-sensivel') and alvo = p_alvo) then
    return '{}'::jsonb;
  end if;
  begin
    perform interno.limite('contar_escola:' || p_tipo, 5, 1);
    perform interno.limite('contar_escola', 120, 1);
  exception when others then
    return '{}'::jsonb;
  end;
  insert into contagens_escola (tipo, alvo, dia, total) values (p_tipo, p_alvo, (now() at time zone 'America/Sao_Paulo')::date, 1)
  on conflict (tipo, alvo, dia) do update set total = contagens_escola.total + 1;
  return '{}'::jsonb;
end $$;

-- 4. Ler as somas ───────────────────────────────────────────────────────────────────────────────────────────────────────
/**
 * Os totais de um tipo nos últimos p_dias (de 1 a 400), por alvo, em ordem de alvo: nunca por total, para não virar
 * ranking. p_prefixo ('AAAA.S/') filtra as pautas de um semestre da assembleia; prefixo fora desse formato não traz nada.
 */
create or replace function public.escola_contagens(p_tipo text, p_dias integer default 30, p_prefixo text default null) returns jsonb
language sql stable security definer set search_path = interno, pg_temp as $$
  select coalesce(jsonb_agg(jsonb_build_object('alvo', alvo, 'total', soma) order by alvo), '[]'::jsonb)
  from (
    select alvo, sum(total)::bigint as soma from contagens_escola
    where tipo = p_tipo
      and dia > (now() at time zone 'America/Sao_Paulo')::date - least(greatest(coalesce(p_dias, 30), 1), 400)
      and (coalesce(p_prefixo, '') = '' or (p_prefixo ~ '^[0-9]{4}\.[12]/$' and left(alvo, length(p_prefixo)) = p_prefixo))
    group by alvo
  ) x
$$;

-- 5. Presença somada ────────────────────────────────────────────────────────────────────────────────────────────────────
/** Só números, sem alvo: aulas abertas hoje, aulas terminadas nos últimos 7 dias e matrículas do mês (fuso de Brasília). */
create or replace function public.escola_presenca_hoje() returns jsonb language sql stable security definer set search_path = interno, pg_temp as $$
  with hoje as (select (now() at time zone 'America/Sao_Paulo')::date as d)
  select jsonb_build_object(
    'aulas_hoje', (select coalesce(sum(total), 0)::bigint from contagens, hoje where tipo = 'aula_abriu' and dia = hoje.d),
    'aulas_terminadas_7d', (select coalesce(sum(total), 0)::bigint from contagens, hoje where tipo = 'aula_terminou' and dia > hoje.d - 7),
    'matriculas_mes', (select coalesce(sum(total), 0)::bigint from contagens_escola, hoje where tipo = 'escola_matricula' and dia >= date_trunc('month', hoje.d)::date))
$$;

-- 6. Turmas por curso ───────────────────────────────────────────────────────────────────────────────────────────────────
-- Amplia a Turma do mês sem tocar nela: quem entra na turma de um curso, num mês. Como lá, só fica quem entrou; o
-- progresso continua no aparelho. No curso sensível (grupo 'curso-sensivel', como o Ano de formação política), estar na
-- turma revela opinião política, que é dado pessoal sensível (Lei 13.709/2018, art. 5º, II): só entra com consentimento
-- específico e destacado (art. 11, I), guardado em consentiu_sensivel. Sair apaga a linha.
create table if not exists interno.turmas_curso (
  mes text not null check (mes ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
  curso text not null check (curso ~ '^[a-z0-9][a-z0-9-]{0,79}$'),
  usuario uuid not null references interno.perfis (id) on delete cascade,
  entrou_em timestamptz not null default now(),
  consentiu_sensivel boolean not null default false,
  primary key (mes, curso, usuario)
);
alter table interno.turmas_curso enable row level security;
revoke all on interno.turmas_curso from public;

-- A sala do encontro de cada turma: sorteada na primeira inscrição, entregue só a quem está nela.
create table if not exists interno.turmas_curso_salas (
  mes text not null check (mes ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
  curso text not null check (curso ~ '^[a-z0-9][a-z0-9-]{0,79}$'),
  sala text not null check (sala ~ '^InstitutoLucia-Curso-[0-9a-f]{10}$'),
  primary key (mes, curso)
);
alter table interno.turmas_curso_salas enable row level security;
revoke all on interno.turmas_curso_salas from public;
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on interno.turmas_curso from anon, authenticated;
    revoke all on interno.turmas_curso_salas from anon, authenticated;
  end if;
end $$;
-- A mesma trava dos envios do público: site pausado pela coordenação ou origem barrada pela mediação não entra.
drop trigger if exists lucia_pausa on interno.turmas_curso;
create trigger lucia_pausa before insert on interno.turmas_curso for each row execute function interno.pausa();

/** Quantos estão na turma, se quem pergunta está nela (sem conta, falso), a sala (só para quem entrou) e se o curso é sensível. */
create or replace function public.turma_curso(p_mes text, p_curso text) returns jsonb language sql stable security definer set search_path = interno, pg_temp as $$
  with eu as (select auth.uid() is not null and exists (select 1 from turmas_curso where mes = p_mes and curso = p_curso and usuario = auth.uid()) as dentro)
  select jsonb_build_object(
    'inscritos', (select count(*) from turmas_curso where mes = p_mes and curso = p_curso),
    'eu', (select dentro from eu),
    'sala', case when (select dentro from eu) then (select sala from turmas_curso_salas where mes = p_mes and curso = p_curso) end,
    'sensivel', exists (select 1 from escola_alvos where grupo = 'curso-sensivel' and alvo = p_curso))
$$;

/**
 * Entrar (p_entrar verdadeiro) na turma de um curso, só no mês atual ou no próximo (Brasília), ou sair dela. Exige conta.
 * Curso sensível: entrar exige p_consentimento verdadeiro, senão dá 'consentimento'. Sair apaga a linha, em qualquer mês.
 */
create or replace function public.turma_curso_entrar(p_mes text, p_curso text, p_entrar boolean, p_consentimento boolean default false) returns jsonb
language plpgsql security definer set search_path = interno, pg_temp as $$
declare
  v uuid := interno.eu();
  v_agora text := to_char(now() at time zone 'America/Sao_Paulo', 'YYYY-MM');
  v_prox text := to_char((now() at time zone 'America/Sao_Paulo') + interval '1 month', 'YYYY-MM');
  v_sensivel boolean;
begin
  if coalesce(p_curso, '') !~ '^[a-z0-9][a-z0-9-]{0,79}$' or p_curso = 'escola' then perform interno.erro('invalido:curso'); end if;
  if not coalesce(p_entrar, false) then
    -- Sair nunca é barrado: nem por mês, nem por pausa, nem por interdição.
    if coalesce(p_mes, '') !~ '^[0-9]{4}-(0[1-9]|1[0-2])$' then perform interno.erro('invalido:mes'); end if;
    delete from turmas_curso where mes = p_mes and curso = p_curso and usuario = v;
    return public.turma_curso(p_mes, p_curso);
  end if;
  perform interno.aberta('estudo');
  if p_mes is null or p_mes not in (v_agora, v_prox) then perform interno.erro('invalido:mes'); end if;
  if exists (select 1 from escola_alvos where grupo in ('curso', 'curso-sensivel'))
     and not exists (select 1 from escola_alvos where grupo in ('curso', 'curso-sensivel') and alvo = p_curso) then
    perform interno.erro('invalido:curso');
  end if;
  v_sensivel := exists (select 1 from escola_alvos where grupo = 'curso-sensivel' and alvo = p_curso);
  if v_sensivel and not coalesce(p_consentimento, false) then perform interno.erro('consentimento'); end if;
  perform interno.limite('turma_curso_entrar', 30, 60);
  insert into turmas_curso (mes, curso, usuario, consentiu_sensivel) values (p_mes, p_curso, v, v_sensivel and coalesce(p_consentimento, false))
  on conflict (mes, curso, usuario) do update set consentiu_sensivel = turmas_curso.consentiu_sensivel or excluded.consentiu_sensivel;
  insert into turmas_curso_salas (mes, curso, sala) values (p_mes, p_curso, 'InstitutoLucia-Curso-' || substr(md5(gen_random_uuid()::text), 1, 10))
  on conflict do nothing;
  return public.turma_curso(p_mes, p_curso);
end $$;

/** As turmas de curso de quem está logado ([{mes, curso}]); sem conta, lista vazia. */
create or replace function public.turmas_curso_minhas() returns jsonb language sql stable security definer set search_path = interno, pg_temp as $$
  select coalesce(jsonb_agg(jsonb_build_object('mes', mes, 'curso', curso) order by mes desc, curso), '[]'::jsonb)
  from turmas_curso where auth.uid() is not null and usuario = auth.uid()
$$;

-- 7. Ouvidoria do estudante ─────────────────────────────────────────────────────────────────────────────────────────────
-- Sem conta e sem endereço de rede na tabela. O texto e o contato somem depois de um ano (rotina abaixo). Em público
-- só aparece o resumo e a resposta que a mediação escreveu, nunca o texto nem o contato de quem mandou.
create table if not exists interno.ouvidoria (
  id uuid primary key default gen_random_uuid(),
  sobre text not null check (sobre in ('aula', 'curso', 'educador', 'escola', 'outro')),
  caminho text not null default '' check (caminho = '' or caminho ~ '^/[a-z0-9/._-]{0,199}$'),
  texto text not null default '' check (char_length(texto) <= 3000),
  contato text not null default '' check (char_length(contato) <= 200),
  status text not null default 'nova' check (status in ('nova', 'em_analise', 'respondida', 'arquivada')),
  resumo_publico text not null default '' check (char_length(resumo_publico) <= 600),
  resposta_publica text not null default '' check (char_length(resposta_publica) <= 2000),
  publicar boolean not null default false,
  respondida_em timestamptz,
  criado_em timestamptz not null default now()
);
create index if not exists ouvidoria_fila on interno.ouvidoria (status, criado_em desc);
alter table interno.ouvidoria enable row level security;
revoke all on interno.ouvidoria from public;
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'anon') then revoke all on interno.ouvidoria from anon, authenticated; end if;
end $$;
drop trigger if exists lucia_pausa on interno.ouvidoria;
create trigger lucia_pausa before insert on interno.ouvidoria for each row execute function interno.pausa();

/** Manda uma mensagem à ouvidoria. Campo-isca 'site'; até 4 por hora por origem. Devolve {ok, protocolo}. */
create or replace function public.ouvidoria_enviar(p jsonb) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v_id uuid; v_sobre text := coalesce(p ->> 'sobre', ''); v_caminho text;
begin
  -- Campo-isca: gente não vê, robô preenche.
  if coalesce(p ->> 'site', '') <> '' then return jsonb_build_object('ok', true); end if;
  perform interno.aberta('estudo');
  perform interno.limite('ouvidoria_enviar', 4, 60);
  if v_sobre not in ('aula', 'curso', 'educador', 'escola', 'outro') then perform interno.erro('invalido:sobre'); end if;
  v_caminho := interno.txt(p ->> 'caminho', 'caminho', 0, 200);
  if v_caminho <> '' and v_caminho !~ '^/[a-z0-9/._-]{0,199}$' then perform interno.erro('invalido:caminho'); end if;
  insert into ouvidoria (sobre, caminho, texto, contato)
  values (v_sobre, v_caminho, interno.txt(p ->> 'texto', 'texto', 10, 3000), interno.txt(p ->> 'contato', 'contato', 0, 200))
  returning id into v_id;
  return jsonb_build_object('ok', true, 'protocolo', left(v_id::text, 8));
end $$;

/** A fila da ouvidoria, do último ano: coordenação, vice-coordenação ou mediação. */
create or replace function public.ouvidoria_fila() returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
begin
  perform interno.eu();
  if not (interno.coord() or interno.tem('mediacao')) then perform interno.erro('sem_permissao'); end if;
  return (select coalesce(jsonb_agg(to_jsonb(o) || jsonb_build_object('protocolo', left(o.id::text, 8)) order by (o.status = 'nova') desc, o.criado_em desc), '[]'::jsonb)
          from (select * from ouvidoria where criado_em > now() - interval '365 days' order by criado_em desc limit 500) o);
end $$;

/** Muda a situação e escreve o resumo e a resposta públicos. Para publicar, os dois precisam estar escritos. */
create or replace function public.ouvidoria_responder(p_id uuid, p_status text, p_resumo text, p_resposta text, p_publicar boolean) returns jsonb
language plpgsql security definer set search_path = interno, pg_temp as $$
declare v_resumo text; v_resposta text;
begin
  perform interno.eu();
  if not (interno.coord() or interno.tem('mediacao')) then perform interno.erro('sem_permissao'); end if;
  if coalesce(p_status, '') not in ('nova', 'em_analise', 'respondida', 'arquivada') then perform interno.erro('invalido:status'); end if;
  v_resumo := interno.txt(p_resumo, 'resumo', 0, 600);
  v_resposta := interno.txt(p_resposta, 'resposta', 0, 2000);
  if coalesce(p_publicar, false) and (v_resumo = '' or v_resposta = '') then perform interno.erro('invalido:publicar'); end if;
  update ouvidoria set status = p_status, resumo_publico = v_resumo, resposta_publica = v_resposta, publicar = coalesce(p_publicar, false),
    respondida_em = case when p_status = 'respondida' then coalesce(respondida_em, now()) else respondida_em end
  where id = p_id;
  if not found then perform interno.erro('nao_encontrado'); end if;
  perform interno.registrar('ouvidoria_respondida', left(p_id::text, 8), jsonb_build_object('status', p_status, 'publicar', coalesce(p_publicar, false)));
  return jsonb_build_object('ok', true);
end $$;

/** As respostas públicas dos últimos dois anos (até 200). Nunca o texto nem o contato de quem mandou. */
create or replace function public.ouvidoria_publicas() returns jsonb language sql stable security definer set search_path = interno, pg_temp as $$
  select coalesce(jsonb_agg(jsonb_build_object('protocolo', left(o.id::text, 8), 'sobre', o.sobre, 'resumo_publico', o.resumo_publico,
                                               'resposta_publica', o.resposta_publica, 'respondida_em', o.respondida_em) order by o.respondida_em desc), '[]'::jsonb)
  from (select id, sobre, resumo_publico, resposta_publica, respondida_em from ouvidoria
        where publicar and status = 'respondida' and respondida_em > now() - interval '2 years' and resumo_publico <> '' and resposta_publica <> ''
        order by respondida_em desc limit 200) o
$$;

-- Permissões das funções públicas (a de serviço, escola_alvos_definir, ficou fechada lá em cima).
do $$
declare f record;
begin
  for f in select p.oid::regprocedure as assinatura from pg_proc p join pg_namespace n on n.oid = p.pronamespace
           where p.prokind = 'f' and n.nspname = 'public' and p.proname in ('contar_escola', 'escola_contagens', 'escola_presenca_hoje', 'turma_curso',
             'turma_curso_entrar', 'turmas_curso_minhas', 'ouvidoria_enviar', 'ouvidoria_fila', 'ouvidoria_responder', 'ouvidoria_publicas') loop
    execute format('revoke all on function %s from public', f.assinatura);
    execute format('grant execute on function %s to anon, authenticated, service_role', f.assinatura);
  end loop;
end $$;

-- Faxinas: turmas de curso com mais de 13 meses saem; texto e contato da ouvidoria viram vazio depois de um ano.
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule('lucia-turmas-curso-faxina', '23 5 * * *',
      $c$delete from interno.turmas_curso where mes < to_char((now() at time zone 'America/Sao_Paulo') - interval '13 months', 'YYYY-MM'); delete from interno.turmas_curso_salas s where s.mes < to_char((now() at time zone 'America/Sao_Paulo') - interval '13 months', 'YYYY-MM')$c$);
    perform cron.schedule('lucia-ouvidoria-faxina', '29 5 * * *',
      $c$update interno.ouvidoria set texto = '', contato = '' where criado_em < now() - interval '365 days' and (texto <> '' or contato <> '')$c$);
  end if;
exception when others then null;
end $$;
