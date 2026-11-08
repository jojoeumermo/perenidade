-- ───────────────────────────── Escola de Formação (F5): conquistas e a ligação com a Alumia, novembro de 2026 ─────────────────────────────
-- Migração acrescentável: pode rodar mais de uma vez, sem apagar dado nenhum. Roda DEPOIS da 2026-11-escola-formacao-base.sql
-- (F1, que cria interno.escola_conquistas, interno.escola_militancia e perfis.escola_publico) e da 2026-11-rede-perfil.sql
-- (Alumia, que cria interno.rede3_perfil_selos). Quem junta cola este bloco no fim do install.sql (ordem da Escola: F1, F4,
-- F5, F3, F6). Plano: docs/plano-2026-11/PLANO-ESCOLA.md, seção 4.5. Teste: npm run testar:escola-conquistas.
--
-- O que este arquivo faz, e só isto:
--  1. perfis.escola_publico_em: quando a pessoa ligou a exibição (passou pela tela de consentimento). Nulo = ninguém.
--  2. Quem vê: interno.escola_pode_ver(dono, quem) e interno.escola_conquistas_visiveis(dono, quem), o filtro de público
--     (ninguem: só o dono; militantes: quem é militante; seguidores: quem segue com pedido aceito; todos: quem abre o perfil).
--  3. interno.rede3_perfil_selos passa a acrescentar os selos da Escola ('escola:carteirinha', 'escola:degrau-N',
--     'escola:caderno-NN' e a CONTAGEM 'escola:aulas-N', nunca a lista de aulas), JÁ FILTRADOS no servidor por quem pede
--     (auth.uid()). O rede_selos_mostrar da Alumia não basta: o selo da Escola nasce escondido e só aparece para o público
--     escolhido. Contrato com a Onda 5 (perfil novo da Alumia): o campo "selos" de rede_perfil_de já vem filtrado.
--  4. Funções públicas: escola_publico_definir, escola_conquista_declarar e escola_conquistas_minhas (contrato em
--     lib/escola/contratos.ts).
--  5. Sair do departamento Revolucionários volta o público para 'ninguem' (a F1 já apaga as conquistas).
--
-- Privacidade: ser militante revela opinião política (dado sensível, LGPD art. 5º, II, e art. 11, I). Por isso: padrão
-- 'ninguem'; ligar exige a tela de consentimento (o banco guarda quando); desligar esconde na hora e APAGA o que o aparelho
-- declarou (aula e caderno), que só existia para ser mostrado (LGPD art. 6º, III, minimização; art. 18, VI, eliminação).
-- Aula e caderno são declarados pelo aparelho (verificada = false), como o selo de trilha da Alumia; carteirinha e degrau
-- são do servidor (gatilho do departamento, F1, e banca aprovada, F4). Nada de nome civil.

-- 1. Quando a pessoa ligou ────────────────────────────────────────────────────────────────────────────────────────────────
alter table interno.perfis add column if not exists escola_publico_em timestamptz;

-- 2. Quem vê ─────────────────────────────────────────────────────────────────────────────────────────────────────────────
/**
 * `p_quem` pode ver as conquistas da Escola de `p_dono`? O dono sempre vê as próprias. Os outros, só se o dono é militante
 * (tem a linha da militância), não está suspenso, não há bloqueio entre os dois e o público escolhido deixa.
 * Sem sessão (p_quem nulo), nunca.
 */
create or replace function interno.escola_pode_ver(p_dono uuid, p_quem uuid) returns boolean language sql stable security definer set search_path = interno, pg_temp as $$
  select p_dono is not null and p_quem is not null and (
    p_dono = p_quem
    or exists (
      select 1 from perfis f join escola_militancia m on m.usuario = f.id
      where f.id = p_dono and not f.suspenso and not interno.rede_bloqueado(p_dono, p_quem)
        and case f.escola_publico
              when 'todos' then true
              when 'militantes' then interno.e_militante(p_quem)
              when 'seguidores' then exists (select 1 from rede_seguindo s where s.quem = p_quem and s.segue = p_dono and not s.pendente)
              else false
            end))
$$;

/**
 * Os selos da Escola de `p_dono` que `p_quem` pode ver, na ordem: carteirinha, o maior degrau verificado, os cadernos
 * declarados e a contagem de aulas declaradas. Lista vazia quando não pode ver.
 */
create or replace function interno.escola_conquistas_visiveis(p_dono uuid, p_quem uuid) returns jsonb language sql stable security definer set search_path = interno, pg_temp as $$
  select case when not interno.escola_pode_ver(p_dono, p_quem) then '[]'::jsonb else coalesce((
    select jsonb_agg(x.s order by x.o, x.s)
    from (
      select 'escola:carteirinha' as s, 1 as o from escola_conquistas c
        where c.usuario = p_dono and c.tipo = 'carteirinha' and c.alvo = 'carteirinha' and c.verificada
      union all
      select 'escola:' || max(c.alvo), 2 from escola_conquistas c
        where c.usuario = p_dono and c.tipo = 'degrau' and c.verificada and c.alvo ~ '^degrau-[1-3]$' having count(*) > 0
      union all
      select 'escola:' || c.alvo, 3 from escola_conquistas c
        where c.usuario = p_dono and c.tipo = 'caderno' and c.alvo ~ '^caderno-(0[1-9]|1[01])$'
      union all
      select 'escola:aulas-' || count(*), 4 from escola_conquistas c
        where c.usuario = p_dono and c.tipo = 'aula' having count(*) > 0
    ) x), '[]'::jsonb) end
$$;

-- 3. Os selos do perfil da Alumia, com os da Escola já filtrados ─────────────────────────────────────────────────────────
/**
 * Os selos de trajetória de uma pessoa, como texto: 'equipe', 'educador', 'moderacao' (do papel), 'trilha:<slug>'
 * (declarado) e, desde a Escola de Formação, os 'escola:*' que QUEM PEDE (auth.uid()) pode ver. Mesmo corpo da
 * 2026-11-rede-perfil.sql, mais a última parte.
 */
create or replace function interno.rede3_perfil_selos(p_id uuid) returns jsonb language sql stable security definer set search_path = interno, pg_temp as $$
  select coalesce(jsonb_agg(x.s order by x.o, x.s), '[]'::jsonb)
  from (
    select 'equipe' as s, 1 as o where interno.voluntario_e(p_id)
    union all
    select 'educador', 2 where exists (select 1 from papeis q where q.usuario = p_id and q.papel in ('educacao', 'educacao_secundaria'))
    union all
    select 'moderacao', 3 where exists (select 1 from papeis q where q.usuario = p_id and q.papel = 'mediacao')
      or exists (select 1 from rede_comunidade_membros m where m.usuario = p_id and m.papel = 'moderacao' and m.situacao = 'ativo')
    union all
    select t, 4 from perfis f, unnest(f.rede_selos) t where f.id = p_id and t ~ '^trilha:[a-z0-9-]{2,80}$'
    union all
    select e.s, (4 + e.n)::int from jsonb_array_elements_text(interno.escola_conquistas_visiveis(p_id, auth.uid())) with ordinality as e(s, n)
  ) x
$$;

-- 4. Funções públicas ────────────────────────────────────────────────────────────────────────────────────────────────────
/** A linha da militância de quem chama, ou erro: só militante (com a linha criada pelo departamento) tem conquistas. */
create or replace function interno.escola_exige_militancia() returns uuid language plpgsql stable security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu();
begin
  if not interno.e_militante(v) or not exists (select 1 from escola_militancia where usuario = v) then perform interno.erro('sem_permissao'); end if;
  return v;
end $$;

/**
 * Quem vê as minhas conquistas da Escola no perfil da Alumia. A tela só chama com público diferente de 'ninguem' depois
 * da tela de consentimento; o banco guarda quando. 'ninguem' esconde na hora e apaga o que o aparelho declarou.
 */
create or replace function public.escola_publico_definir(p text) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.escola_exige_militancia();
begin
  if p is null or p not in ('ninguem', 'militantes', 'seguidores', 'todos') then perform interno.erro('invalido:publico'); end if;
  perform interno.limite('escola_publico', 30, 10);
  update perfis set escola_publico = p, escola_publico_em = case when p = 'ninguem' then null else now() end where id = v;
  if p = 'ninguem' then
    delete from escola_conquistas where usuario = v and not verificada and tipo in ('aula', 'caderno');
  end if;
  return jsonb_build_object('ok', true);
end $$;

/**
 * O aparelho declara (p_ligar = true) ou retira (false) uma aula ('trilha/aula', o mesmo lessonId de /trilhas) ou um
 * caderno ('caderno-01' a 'caderno-11') feito. Fica verificada = false: o servidor não confere o estudo, e o perfil só
 * mostra a CONTAGEM de aulas. Declarar só vale com a exibição ligada (sem público, não há para que guardar). Até 400 por pessoa.
 */
create or replace function public.escola_conquista_declarar(p_tipo text, p_alvo text, p_ligar boolean) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.escola_exige_militancia(); n integer;
begin
  if p_tipo is null or p_tipo not in ('aula', 'caderno') then perform interno.erro('invalido:tipo'); end if;
  if p_tipo = 'aula' and not (coalesce(p_alvo, '') ~ '^[a-z0-9-]{2,80}/[a-z0-9-]{1,120}$' and char_length(p_alvo) <= 160) then perform interno.erro('invalido:alvo'); end if;
  if p_tipo = 'caderno' and coalesce(p_alvo, '') !~ '^caderno-(0[1-9]|1[01])$' then perform interno.erro('invalido:alvo'); end if;
  if p_ligar is null then perform interno.erro('invalido:ligar'); end if;
  perform interno.limite('escola_conquista', 600, 10);
  if p_ligar then
    if (select escola_publico from perfis where id = v) = 'ninguem' then perform interno.erro('invalido:publico'); end if;
    if not exists (select 1 from escola_conquistas where usuario = v and tipo = p_tipo and alvo = p_alvo) then
      select count(*) into n from escola_conquistas where usuario = v and not verificada;
      if n >= 400 then perform interno.erro('invalido:muitas'); end if;
      insert into escola_conquistas (usuario, tipo, alvo, verificada) values (v, p_tipo, p_alvo, false) on conflict do nothing;
    end if;
  else
    delete from escola_conquistas where usuario = v and tipo = p_tipo and alvo = p_alvo and not verificada;
  end if;
  return jsonb_build_object('ok', true);
end $$;

/** As minhas conquistas da Escola (todas, inclusive as que ninguém mais vê) e o público escolhido. Só militante. */
create or replace function public.escola_conquistas_minhas() returns jsonb language plpgsql stable security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.escola_exige_militancia();
begin
  return jsonb_build_object(
    'publico', (select escola_publico from perfis where id = v),
    'conquistas', coalesce((
      select jsonb_agg(jsonb_build_object('tipo', c.tipo, 'alvo', c.alvo, 'verificada', c.verificada, 'em', c.em) order by c.tipo, c.alvo)
      from escola_conquistas c where c.usuario = v), '[]'::jsonb));
end $$;

-- 5. Sair do departamento volta o público para 'ninguem' ─────────────────────────────────────────────────────────────────
create or replace function interno.escola_publico_ao_sair() returns trigger language plpgsql security definer set search_path = interno, pg_temp as $$
begin
  if old.departamento = 'revolucionarios' and (tg_op = 'DELETE' or new.departamento is distinct from 'revolucionarios' or new.usuario is distinct from old.usuario)
     and not interno.membro_direto(old.usuario, 'revolucionarios') then
    update perfis set escola_publico = 'ninguem', escola_publico_em = null where id = old.usuario;
  end if;
  return null;
end $$;
drop trigger if exists lucia_escola_publico on interno.departamento_membros;
create trigger lucia_escola_publico after update or delete on interno.departamento_membros for each row execute function interno.escola_publico_ao_sair();

-- 6. Permissões ──────────────────────────────────────────────────────────────────────────────────────────────────────────
-- Nenhuma função interna é chamável de fora; as públicas, só com conta.
revoke all on function interno.escola_pode_ver(uuid, uuid), interno.escola_conquistas_visiveis(uuid, uuid), interno.escola_exige_militancia(),
  interno.escola_publico_ao_sair() from public;
revoke all on function public.escola_publico_definir(text), public.escola_conquista_declarar(text, text, boolean), public.escola_conquistas_minhas() from public;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on function interno.escola_pode_ver(uuid, uuid), interno.escola_conquistas_visiveis(uuid, uuid), interno.escola_exige_militancia(),
      interno.escola_publico_ao_sair() from anon, authenticated;
    revoke all on function public.escola_publico_definir(text), public.escola_conquista_declarar(text, text, boolean), public.escola_conquistas_minhas() from anon;
    grant execute on function public.escola_publico_definir(text), public.escola_conquista_declarar(text, text, boolean), public.escola_conquistas_minhas() to authenticated, service_role;
  end if;
end $$;
