-- ───────────────────────────── Alumia, onda 8: a porta de entrada (cadastro em massa e convites) ─────────────────────────────
-- Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
--
-- Duas coisas, sem serviço de fora e sem guardar endereço de rede (decisão da coordenação de 13/11):
--
-- 1. DEFESA CONTRA CADASTRO EM MASSA. Antes de criar a conta pela Alumia e antes de pedir a entrada, o servidor do site
--    (app/api/alumia/porta/*) confere três coisas e só então segue:
--      · a prova de trabalho que o aparelho resolveu (um desafio assinado pelo servidor, com prazo, resolvido com SHA-256 da
--        Web Crypto; a dificuldade sobe com a pressão). Cada desafio vale uma vez: o resumo dele fica em alumia_cadastro_gastos
--        até vencer;
--      · o freio por rede: quantas vezes a mesma rede passou nesta hora. O banco não recebe nem a impressão da rede: recebe um
--        resumo dela com a hora dentro (SHA-256 de "momento + hora + impressão"), que não se liga à impressão do painel nem ao
--        resumo da hora seguinte. Some em um dia;
--      · o teto da casa por hora (contas novas e pedidos), com alerta no painel e aviso à coordenação quando é atingido.
--    Com a porta LIGADA (interno.configuracoes 'alumia_cadastro' → ligada, pelo painel), o banco exige o passe do servidor para
--    aceitar um pedido de entrada novo (gatilho em interno.alumia_entrada): pular o servidor e chamar alumia_entrada_pedir direto
--    não adianta. Desligada (como nasce), o servidor confere do mesmo jeito, mas o banco não exige o passe.
--
-- 2. CONVITES PARA A ALUMIA. Quem já está dentro (aprovada, com o segundo fator) gera convites, com teto por mês. O convite leva
--    à TRIAGEM e não aprova sozinho. O banco nunca liga a pessoa convidada a quem convidou: ao usar o convite, ele é APAGADO (a
--    linha do convite não é regravada na transação que grava a marca e o passe, para a versão da linha, o xmin, não ligar uma
--    coisa à outra) e a conta ganha só a marca "veio por convite" (sem dizer qual convite). O teto do mês conta pelo número
--    gravado quando o convite nasce (alumia_convite_cotas), não pelas linhas que sobram. A marca some quando a triagem decide.
--    O código não é guardado: só o resumo SHA-256 dele (interno.selo). O link vence em 7 dias.
--
-- Tudo em interno, com RLS e sem política; o acesso é só por funções security definer com search_path fixo. As que o servidor
-- chama só aceitam a chave de serviço. As de membro passam pela porta da entrada (interno.alumia_trancar, no fim).
--
-- Pode rodar mais de uma vez, sem apagar dado nenhum. Roda DEPOIS das migrações da onda 7 (20261113-alumia-o7-painel.sql).
-- Teste: npm run testar:alumia-o8-porta.
--
-- Os convites que já tinham virado "usado" antes deste conserto saem (a cota do mês nasce contando-os, se ainda não existe).
-- Depois de rodar, um "vacuum interno.alumia_convites, interno.alumia_convite_pedidos, interno.alumia_cadastro_passes" (fora de
-- transação) tira do disco as versões mortas das linhas.

-- 1. As tabelas ─────────────────────────────────────────────────────────────────────────────────────────────────────────────

-- Quantas contas novas e pedidos passaram (e quantos foram recusados) em cada hora. Só números; some em 8 dias.
create table if not exists interno.alumia_cadastro_horas (
  hora timestamptz primary key,
  contas integer not null default 0,
  pedidos integer not null default 0,
  recusados integer not null default 0,
  alerta_em timestamptz
);

-- O freio por rede: um resumo por rede, momento e hora (nunca o endereço, nunca a impressão do painel). Some em 1 dia.
create table if not exists interno.alumia_cadastro_freio (
  chave text not null check (chave ~ '^[0-9a-f]{64}$'),
  janela timestamptz not null,
  total integer not null default 0,
  primary key (chave, janela)
);

-- Os desafios já usados (o resumo do desafio), até vencerem: o mesmo desafio resolvido não vale duas vezes.
create table if not exists interno.alumia_cadastro_gastos (
  selo text primary key check (selo ~ '^[0-9a-f]{64}$'),
  vence_em timestamptz not null
);

-- O passe do servidor para o pedido de entrada: vale 30 minutos e uma vez (o gatilho do pedido gasta).
create table if not exists interno.alumia_cadastro_passes (
  usuario uuid primary key references interno.perfis (id) on delete cascade,
  vence_em timestamptz not null
);

-- Os convites: o resumo do código, quem gerou, o prazo e a situação. Nunca quem usou: o convite usado sai da tabela.
create table if not exists interno.alumia_convites (
  id uuid primary key default gen_random_uuid(),
  selo text not null unique check (selo ~ '^[0-9a-f]{64}$'),
  criado_por uuid not null references interno.perfis (id) on delete cascade,
  criado_em timestamptz not null default now(),
  vence_em timestamptz not null default now() + interval '7 days',
  situacao text not null default 'aberto' check (situacao in ('aberto', 'usado', 'cancelado'))
);
create index if not exists alumia_convites_de_quem on interno.alumia_convites (criado_por, criado_em desc);

-- A marca "veio por convite" de um pedido em análise. Sem o convite, sem quem convidou. Some quando a triagem decide.
create table if not exists interno.alumia_convite_pedidos (
  usuario uuid primary key references interno.perfis (id) on delete cascade
);

-- Quantos convites cada pessoa gerou em cada mês (o teto). Gravado ao gerar, nunca ao usar. Some depois de dois meses.
create table if not exists interno.alumia_convite_cotas (
  criado_por uuid not null references interno.perfis (id) on delete cascade,
  mes timestamptz not null,
  gerados integer not null default 0 check (gerados >= 0),
  primary key (criado_por, mes)
);

do $$
declare t text;
begin
  foreach t in array array['alumia_cadastro_horas', 'alumia_cadastro_freio', 'alumia_cadastro_gastos', 'alumia_cadastro_passes', 'alumia_convites', 'alumia_convite_pedidos',
                           'alumia_convite_cotas'] loop
    execute format('alter table interno.%I enable row level security', t);
    execute format('revoke all on table interno.%I from public', t);
    if exists (select 1 from pg_roles where rolname = 'anon') then
      execute format('revoke all on table interno.%I from anon, authenticated', t);
    end if;
  end loop;
end $$;

-- Os números que a coordenação ajusta no painel. Nasce DESLIGADA: o banco só exige o passe depois de o site novo estar no ar.
insert into interno.configuracoes (chave, valor)
values ('alumia_cadastro', '{"ligada": false, "teto_hora": 60, "convites_mes": 3, "rede_contas_hora": 3, "rede_pedidos_hora": 6}'::jsonb)
on conflict (chave) do nothing;

-- A chave do site (lib/recursos.ts): "alumia-convites", só pelo nome, como as outras da Alumia.
do $$
begin
  if to_regclass('interno.recursos_catalogo') is not null then
    insert into interno.recursos_catalogo (nome, so_pelo_nome) values ('alumia-convites', true) on conflict (nome) do update set so_pelo_nome = true;
  end if;
end $$;

insert into interno.alumia_convite_cotas (criado_por, mes, gerados)
select c.criado_por, date_trunc('month', c.criado_em at time zone 'America/Sao_Paulo') at time zone 'America/Sao_Paulo', count(*)
from interno.alumia_convites c where c.criado_em >= now() - interval '62 days' group by 1, 2
on conflict (criado_por, mes) do nothing;
delete from interno.alumia_convites where situacao = 'usado';

-- 2. As peças de dentro ─────────────────────────────────────────────────────────────────────────────────────────────────────

/** Um número da configuração da porta, com o padrão se faltar ou vier torto. */
create or replace function interno.alumia_cadastro_numero(p_chave text, p_padrao integer) returns integer language sql stable security definer set search_path = interno, pg_temp as $$
  select coalesce(case when (select valor ->> p_chave from configuracoes where chave = 'alumia_cadastro') ~ '^\d{1,6}$'
                       then (select (valor ->> p_chave)::integer from configuracoes where chave = 'alumia_cadastro') end, p_padrao)
$$;

/** A porta está ligada (o banco exige o passe do servidor no pedido de entrada)? */
create or replace function interno.alumia_cadastro_ligada() returns boolean language sql stable security definer set search_path = interno, pg_temp as $$
  select coalesce((select (valor ->> 'ligada')::boolean from configuracoes where chave = 'alumia_cadastro'), false)
$$;

/** A hora corrente (o balde do teto e do freio). */
create or replace function interno.alumia_cadastro_hora() returns timestamptz language sql stable as $$
  select date_trunc('hour', now())
$$;

/**
 * A faxina: desafios e passes vencidos, o freio de ontem, os números de mais de 8 dias, os convites de mais de 45 dias, as cotas de
 * mais de dois meses e a marca de convite de quem não chegou a pedir a entrada (sem passe e sem ficha em análise).
 */
create or replace function interno.alumia_cadastro_faxina() returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v_gastos integer; v_freio integer; v_horas integer; v_passes integer; v_convites integer;
begin
  delete from alumia_cadastro_gastos where vence_em < now();
  get diagnostics v_gastos = row_count;
  delete from alumia_cadastro_freio where janela < now() - interval '1 day';
  get diagnostics v_freio = row_count;
  delete from alumia_cadastro_horas where hora < now() - interval '8 days';
  get diagnostics v_horas = row_count;
  delete from alumia_cadastro_passes where vence_em < now();
  get diagnostics v_passes = row_count;
  -- O convite que venceu (ou foi usado ou cancelado) fica só até o mês acabar e mais um pouco: ele conta no teto do mês.
  delete from alumia_convites where criado_em < now() - interval '45 days';
  get diagnostics v_convites = row_count;
  delete from alumia_convite_cotas where mes < now() - interval '62 days';
  delete from alumia_convite_pedidos m
  where not exists (select 1 from alumia_cadastro_passes p where p.usuario = m.usuario)
    and not exists (select 1 from alumia_entrada e where e.usuario = m.usuario and e.situacao = 'em_analise');
  return jsonb_build_object('gastos', v_gastos, 'freio', v_freio, 'horas', v_horas, 'passes', v_passes, 'convites', v_convites);
end $$;

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule('alumia-cadastro-faxina', '41 * * * *', 'select interno.alumia_cadastro_faxina()');
  end if;
exception when others then null;
end $$;

/** Uma recusa conta no número da hora (para o painel ver a pressão), sem desfazer o resto. */
create or replace function interno.alumia_cadastro_recusar(p_motivo text) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
begin
  insert into alumia_cadastro_horas (hora, recusados) values (interno.alumia_cadastro_hora(), 1)
  on conflict (hora) do update set recusados = alumia_cadastro_horas.recusados + 1;
  return jsonb_build_object('ok', false, 'motivo', p_motivo);
end $$;

-- 3. O que o servidor do site chama (só a chave de serviço) ─────────────────────────────────────────────────────────────────

/**
 * A pressão agora, para o servidor escolher a dificuldade do desafio: quantas vezes esta rede passou nesta hora (pelo resumo do
 * freio) e quantas contas e pedidos a casa recebeu nesta hora, com o teto. Não grava nada.
 */
create or replace function public.alumia_cadastro_pressao(p_chave text, p_momento text) returns jsonb
language plpgsql stable security definer set search_path = interno, pg_temp as $$
declare h alumia_cadastro_horas;
begin
  if not interno.servico() then perform interno.erro('sem_permissao'); end if;
  if p_momento is null or p_momento not in ('conta', 'pedido') then perform interno.erro('invalido:momento'); end if;
  select * into h from alumia_cadastro_horas where hora = interno.alumia_cadastro_hora();
  return jsonb_build_object(
    'rede', coalesce((select f.total from alumia_cadastro_freio f where f.chave = p_chave and f.janela = interno.alumia_cadastro_hora()), 0),
    'rede_teto', case when p_momento = 'conta' then interno.alumia_cadastro_numero('rede_contas_hora', 3) else interno.alumia_cadastro_numero('rede_pedidos_hora', 6) end,
    'casa', coalesce(case when p_momento = 'conta' then h.contas else h.pedidos end, 0),
    'casa_teto', interno.alumia_cadastro_numero('teto_hora', 60));
end $$;

/**
 * O servidor conferiu a prova de trabalho: agora o banco confere o resto, numa transação só.
 *   p_momento   'conta' (antes de criar a conta) ou 'pedido' (antes do pedido de entrada, com p_usuario)
 *   p_chave     o resumo do freio (rede + momento + hora), ou nulo se o servidor não pôde ler a rede
 *   p_selo      o resumo do desafio resolvido (vale uma vez), p_vence o prazo dele
 *   p_impressao a impressão da rede (a do painel), só para conferir se a rede está barrada: não é gravada aqui
 *   p_convite   o código do convite (só no pedido), que o banco gasta e troca pela marca "veio por convite"
 * Recusa devolvendo {ok: false, motivo} (sem erro, para a recusa contar no número da hora): desafio_usado, rede_barrada,
 * muitos_pedidos (o freio da rede) ou porta_cheia (o teto da casa nesta hora). Pedido que veio com convite válido não para no
 * teto da casa (o freio da rede continua valendo): num ataque, quem foi chamado por alguém de dentro ainda entra na fila.
 */
create or replace function public.alumia_cadastro_passar(p_momento text, p_chave text, p_selo text, p_vence timestamptz, p_impressao text default null,
  p_usuario uuid default null, p_convite text default null) returns jsonb
language plpgsql volatile security definer set search_path = interno, pg_temp as $$
declare v_hora timestamptz := interno.alumia_cadastro_hora(); v_total integer; v_teto integer; h alumia_cadastro_horas;
  v_convite text := 'nenhum'; v_alertar boolean := false;
begin
  if not interno.servico() then perform interno.erro('sem_permissao'); end if;
  if p_momento is null or p_momento not in ('conta', 'pedido') then perform interno.erro('invalido:momento'); end if;
  if p_selo is null or p_selo !~ '^[0-9a-f]{64}$' then perform interno.erro('invalido:desafio'); end if;
  if p_chave is not null and p_chave !~ '^[0-9a-f]{64}$' then perform interno.erro('invalido:chave'); end if;
  if p_vence is null or p_vence < now() or p_vence > now() + interval '1 hour' then perform interno.erro('invalido:prazo'); end if;
  if p_momento = 'pedido' and (p_usuario is null or not exists (select 1 from perfis where id = p_usuario)) then perform interno.erro('nao_encontrado'); end if;
  if random() < 0.05 then perform interno.alumia_cadastro_faxina(); end if;

  -- O desafio vale uma vez.
  insert into alumia_cadastro_gastos (selo, vence_em) values (p_selo, p_vence) on conflict (selo) do nothing;
  if not found then return interno.alumia_cadastro_recusar('desafio_usado'); end if;

  -- A rede barrada pelo painel não cria conta nem pede a entrada (no pedido, a rota da impressão ainda suspende a conta).
  if p_impressao is not null and p_impressao ~ '^[0-9a-f]{64}$' and exists (
    select 1 from alumia_impressao_banidas i join alumia_impressao_banimentos b on b.id = i.banimento
    where i.impressao = p_impressao and b.encerrado_em is null and b.ate > now()) then
    return interno.alumia_cadastro_recusar('rede_barrada');
  end if;

  -- O freio da rede nesta hora.
  if p_chave is not null then
    insert into alumia_cadastro_freio (chave, janela, total) values (p_chave, v_hora, 1)
    on conflict (chave, janela) do update set total = alumia_cadastro_freio.total + 1
    returning total into v_total;
    v_teto := case when p_momento = 'conta' then interno.alumia_cadastro_numero('rede_contas_hora', 3) else interno.alumia_cadastro_numero('rede_pedidos_hora', 6) end;
    if v_total > v_teto then return interno.alumia_cadastro_recusar('muitos_pedidos'); end if;
  end if;

  -- O convite (só no pedido): vale se está aberto, no prazo e não é de quem pede. O que vale é APAGADO aqui, num comando só e sem
  -- "for update" (que marcaria a linha com esta transação): nenhuma linha viva de convite fica com a versão (xmin ou xmax) desta
  -- transação, a mesma da marca e do passe. O convite que não vale não é tocado.
  if p_momento = 'pedido' and nullif(btrim(coalesce(p_convite, '')), '') is not null then
    delete from alumia_convites where selo = interno.selo(lower(btrim(p_convite))) and situacao = 'aberto' and vence_em > now()
      and criado_por <> p_usuario;
    v_convite := case when found then 'aceito' else 'invalido' end;
  end if;

  -- O teto da casa nesta hora (o pedido com convite válido passa por cima).
  insert into alumia_cadastro_horas (hora) values (v_hora) on conflict (hora) do nothing;
  select * into h from alumia_cadastro_horas where hora = v_hora for update;
  v_teto := interno.alumia_cadastro_numero('teto_hora', 60);
  if v_convite <> 'aceito' and (case when p_momento = 'conta' then h.contas else h.pedidos end) >= v_teto then
    v_alertar := h.alerta_em is null;
    update alumia_cadastro_horas set recusados = recusados + 1, alerta_em = coalesce(alerta_em, now()) where hora = v_hora;
    if v_alertar then
      perform interno.avisar_lideranca('Alumia: a porta de entrada chegou ao teto desta hora (' || v_teto || '). Pedidos novos esperam a próxima hora. Veja o painel da Alumia › Porta de entrada.');
    end if;
    return jsonb_build_object('ok', false, 'motivo', 'porta_cheia');
  end if;
  update alumia_cadastro_horas set contas = contas + case when p_momento = 'conta' then 1 else 0 end,
    pedidos = pedidos + case when p_momento = 'pedido' then 1 else 0 end where hora = v_hora;

  if p_momento = 'pedido' then
    insert into alumia_cadastro_passes (usuario, vence_em) values (p_usuario, now() + interval '30 minutes')
    on conflict (usuario) do update set vence_em = excluded.vence_em;
    if v_convite = 'aceito' then
      insert into alumia_convite_pedidos (usuario) values (p_usuario) on conflict do nothing;
    end if;
  end if;
  return jsonb_build_object('ok', true, 'convite', v_convite);
end $$;

/** A página do convite pergunta se o código vale (sem dizer de quem é). Só a chave de serviço: a rota do site freia por rede. */
create or replace function public.alumia_convite_conferir(p_codigo text) returns jsonb language plpgsql stable security definer set search_path = interno, pg_temp as $$
declare c alumia_convites;
begin
  if not interno.servico() then perform interno.erro('sem_permissao'); end if;
  if coalesce(p_codigo, '') !~ '^[0-9a-f]{32}$' then return jsonb_build_object('valido', false); end if;
  select * into c from alumia_convites where selo = interno.selo(p_codigo);
  if not found or c.situacao <> 'aberto' or c.vence_em <= now() then return jsonb_build_object('valido', false); end if;
  return jsonb_build_object('valido', true, 'vence_em', c.vence_em);
end $$;

-- 4. O pedido de entrada exige o passe; a decisão apaga a marca do convite ─────────────────────────────────────────────────

/**
 * Com a porta ligada, pedido de entrada novo (ou pedido de novo) só é aceito de quem acabou de passar pelo servidor (o passe vale
 * 30 minutos e uma vez). A chave de serviço, o próprio banco e quem é da casa não precisam. Mudança que não é pedido novo (a
 * triagem decidindo, o motivo apagado pela faxina) não precisa.
 */
create or replace function interno.alumia_cadastro_pedido_com_passe() returns trigger language plpgsql security definer set search_path = interno, pg_temp as $$
begin
  if new.situacao <> 'em_analise' or auth.uid() is null or auth.uid() is distinct from new.usuario or interno.servico() then return new; end if;
  if tg_op = 'UPDATE' and old.situacao = 'em_analise' and new.pedido_em is not distinct from old.pedido_em then return new; end if;
  if not interno.alumia_cadastro_ligada() then return new; end if;
  if to_regprocedure('interno.alumia_painel_da_casa(uuid)') is not null and interno.alumia_painel_da_casa(new.usuario) then return new; end if;
  delete from alumia_cadastro_passes where usuario = new.usuario and vence_em > now();
  if not found then perform interno.erro('alumia_porta'); end if;
  return new;
end $$;
drop trigger if exists alumia_cadastro_pedido_com_passe on interno.alumia_entrada;
create trigger alumia_cadastro_pedido_com_passe before insert or update on interno.alumia_entrada for each row execute function interno.alumia_cadastro_pedido_com_passe();

/** A triagem decidiu: a marca "veio por convite" some (e o passe que sobrou, se houver). */
create or replace function interno.alumia_cadastro_decidido() returns trigger language plpgsql security definer set search_path = interno, pg_temp as $$
begin
  if old.situacao = 'em_analise' and new.situacao <> 'em_analise' then
    delete from alumia_convite_pedidos where usuario = new.usuario;
    delete from alumia_cadastro_passes where usuario = new.usuario;
  end if;
  return null;
end $$;
drop trigger if exists alumia_cadastro_decidido on interno.alumia_entrada;
create trigger alumia_cadastro_decidido after update on interno.alumia_entrada for each row execute function interno.alumia_cadastro_decidido();

-- 5. Os convites de quem está dentro ────────────────────────────────────────────────────────────────────────────────────────

/** O começo do mês corrente, no horário de Brasília (o teto de convites é por mês). */
create or replace function interno.alumia_convite_mes() returns timestamptz language sql stable as $$
  select date_trunc('month', now() at time zone 'America/Sao_Paulo') at time zone 'America/Sao_Paulo'
$$;

/**
 * Gerar um convite. Só quem já está dentro (aprovada; com a trava ligada, a porta ainda exige o segundo fator), dentro do teto do
 * mês. O código sai UMA vez, aqui; o banco guarda só o resumo. Vale 7 dias e leva à triagem.
 */
create or replace function public.alumia_convite_criar() returns jsonb language plpgsql volatile security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); v_teto integer := interno.alumia_cadastro_numero('convites_mes', 3); v_usados integer; v_codigo text; c alumia_convites;
begin
  if not interno.alumia_aprovada(v) then perform interno.erro('sem_permissao'); end if;
  perform interno.limite('alumia_convite_criar', 10, 60);
  insert into alumia_convite_cotas (criado_por, mes) values (v, interno.alumia_convite_mes()) on conflict (criado_por, mes) do nothing;
  select gerados into v_usados from alumia_convite_cotas where criado_por = v and mes = interno.alumia_convite_mes() for update;
  if v_usados >= v_teto then perform interno.erro('teto_de_convites'); end if;
  update alumia_convite_cotas set gerados = gerados + 1 where criado_por = v and mes = interno.alumia_convite_mes();
  v_codigo := replace(gen_random_uuid()::text, '-', '');
  insert into alumia_convites (selo, criado_por) values (interno.selo(v_codigo), v) returning * into c;
  perform interno.registrar('alumia_convite', '', '{}'::jsonb);
  return jsonb_build_object('id', c.id, 'codigo', v_codigo, 'vence_em', c.vence_em, 'restam', greatest(0, v_teto - v_usados - 1));
end $$;

/**
 * Os meus convites deste mês e do anterior que ainda não foram usados: quando, até quando e a situação. O convite usado sai da
 * tabela: aqui ele conta só no número "usados" do mês (os gerados no mês menos os que sobraram). Nunca quem usou.
 */
create or replace function public.alumia_convites_meus() returns jsonb language plpgsql stable security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); v_teto integer := interno.alumia_cadastro_numero('convites_mes', 3); v_usados integer;
begin
  v_usados := coalesce((select gerados from alumia_convite_cotas where criado_por = v and mes = interno.alumia_convite_mes()), 0);
  return jsonb_build_object(
    'teto', v_teto,
    'no_mes', v_usados,
    'restam', greatest(0, v_teto - v_usados),
    'usados', greatest(0, v_usados - (select count(*) from alumia_convites where criado_por = v and criado_em >= interno.alumia_convite_mes()))::integer,
    'pode', interno.alumia_aprovada(v),
    'convites', coalesce((select jsonb_agg(jsonb_build_object('id', c.id, 'criado_em', c.criado_em, 'vence_em', c.vence_em,
        'situacao', case when c.situacao = 'aberto' and c.vence_em <= now() then 'vencido' else c.situacao end) order by c.criado_em desc)
      from (select * from alumia_convites where criado_por = v order by criado_em desc limit 30) c), '[]'::jsonb));
end $$;

/** Cancelar um convite meu que ainda não foi usado. Ele continua contando no teto do mês. */
create or replace function public.alumia_convite_cancelar(p_id uuid) returns jsonb language plpgsql volatile security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu();
begin
  update alumia_convites set situacao = 'cancelado' where id = p_id and criado_por = v and situacao = 'aberto';
  if not found then perform interno.erro('nao_encontrado'); end if;
  return jsonb_build_object('ok', true);
end $$;

/**
 * Para a fila da triagem: os números das fichas em análise que vieram por convite (nunca de quem). Só quem faz a triagem.
 */
create or replace function public.alumia_triagem_convites() returns jsonb language plpgsql stable security definer set search_path = interno, pg_temp as $$
begin
  if not interno.alumia_triagem_pode() then perform interno.erro('sem_permissao'); end if;
  return coalesce((select jsonb_agg(e.id) from alumia_entrada e join alumia_convite_pedidos m on m.usuario = e.usuario where e.situacao = 'em_analise'), '[]'::jsonb);
end $$;

-- 6. O painel (coordenação e admin; ajustar só a coordenação) ──────────────────────────────────────────────────────────────

/**
 * A porta de entrada no painel: ligada ou não, os tetos, os números de cada uma das últimas 24 horas (contas, pedidos,
 * recusados e se houve alerta) e o alerta de agora (o teto atingido nesta hora ou na anterior). Só números.
 */
create or replace function public.alumia_painel_porta() returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
begin
  perform interno.alumia_painel_exige();
  return jsonb_build_object(
    'ligada', interno.alumia_cadastro_ligada(),
    'teto_hora', interno.alumia_cadastro_numero('teto_hora', 60),
    'convites_mes', interno.alumia_cadastro_numero('convites_mes', 3),
    'rede_contas_hora', interno.alumia_cadastro_numero('rede_contas_hora', 3),
    'rede_pedidos_hora', interno.alumia_cadastro_numero('rede_pedidos_hora', 6),
    'alerta', exists (select 1 from alumia_cadastro_horas h where h.alerta_em is not null and h.hora >= interno.alumia_cadastro_hora() - interval '1 hour'),
    'horas', coalesce((select jsonb_agg(jsonb_build_object('hora', h.hora, 'contas', h.contas, 'pedidos', h.pedidos, 'recusados', h.recusados,
        'alerta', h.alerta_em is not null) order by h.hora)
      from alumia_cadastro_horas h where h.hora > interno.alumia_cadastro_hora() - interval '24 hours'), '[]'::jsonb),
    'convites', jsonb_build_object(
      'abertos', (select count(*) from alumia_convites c where c.situacao = 'aberto' and c.vence_em > now()),
      'usados_no_mes', greatest(0, coalesce((select sum(q.gerados) from alumia_convite_cotas q where q.mes = interno.alumia_convite_mes()), 0)
        - (select count(*) from alumia_convites c where c.criado_em >= interno.alumia_convite_mes()))::integer,
      'na_fila', (select count(*) from alumia_convite_pedidos)));
end $$;

/**
 * Ajustar a porta: ligar ou desligar a exigência do passe no banco, o teto da casa por hora (5 a 5000), o freio por rede (1 a 50
 * por hora) e o teto de convites por pessoa no mês (0 a 20; 0 desliga os convites). Só a coordenação, com motivo; vai ao registro.
 */
create or replace function public.alumia_painel_porta_ajustar(p_ligada boolean, p_teto_hora integer, p_convites_mes integer, p_rede_contas_hora integer,
  p_rede_pedidos_hora integer, p_motivo text) returns jsonb
language plpgsql security definer set search_path = interno, pg_temp as $$
declare v_motivo text := interno.alumia_painel_motivo(p_motivo); v_novo jsonb;
begin
  perform interno.alumia_painel_exige(true);
  perform interno.limite('alumia_painel_porta', 30, 60);
  if p_ligada is null then perform interno.erro('invalido:ligada'); end if;
  if p_teto_hora is null or p_teto_hora < 5 or p_teto_hora > 5000 then perform interno.erro('invalido:teto_hora'); end if;
  if p_convites_mes is null or p_convites_mes < 0 or p_convites_mes > 20 then perform interno.erro('invalido:convites_mes'); end if;
  if p_rede_contas_hora is null or p_rede_contas_hora < 1 or p_rede_contas_hora > 50 then perform interno.erro('invalido:rede_contas_hora'); end if;
  if p_rede_pedidos_hora is null or p_rede_pedidos_hora < 1 or p_rede_pedidos_hora > 50 then perform interno.erro('invalido:rede_pedidos_hora'); end if;
  v_novo := jsonb_build_object('ligada', p_ligada, 'teto_hora', p_teto_hora, 'convites_mes', p_convites_mes,
    'rede_contas_hora', p_rede_contas_hora, 'rede_pedidos_hora', p_rede_pedidos_hora);
  insert into configuracoes (chave, valor) values ('alumia_cadastro', v_novo)
  on conflict (chave) do update set valor = configuracoes.valor || excluded.valor;
  perform interno.alumia_painel_registrar('porta_ajustada', 'porta', 'alumia_cadastro', '', v_motivo, v_novo);
  return public.alumia_painel_porta();
end $$;

-- 7. Permissões ─────────────────────────────────────────────────────────────────────────────────────────────────────────────
do $$
declare r record;
begin
  -- As de dentro: ninguém chama pela API.
  for r in
    select p.oid::regprocedure as f from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'interno' and (p.proname like 'alumia\_cadastro\_%' or p.proname = 'alumia_convite_mes')
  loop
    execute format('revoke all on function %s from public', r.f);
    if exists (select 1 from pg_roles where rolname = 'anon') then execute format('revoke all on function %s from anon, authenticated', r.f); end if;
  end loop;
  -- As do servidor: só a chave de serviço. As de membro, da triagem e do painel: só conta logada (cada uma confere quem é).
  for r in
    select p.oid::regprocedure as f, p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname in ('alumia_cadastro_pressao', 'alumia_cadastro_passar', 'alumia_convite_conferir', 'alumia_convite_criar',
      'alumia_convites_meus', 'alumia_convite_cancelar', 'alumia_triagem_convites', 'alumia_painel_porta', 'alumia_painel_porta_ajustar')
  loop
    execute format('revoke all on function %s from public', r.f);
    if exists (select 1 from pg_roles where rolname = 'anon') then
      execute format('revoke all on function %s from anon, authenticated', r.f);
      if r.proname in ('alumia_cadastro_pressao', 'alumia_cadastro_passar', 'alumia_convite_conferir') then
        execute format('grant execute on function %s to service_role', r.f);
      else
        execute format('grant execute on function %s to authenticated, service_role', r.f);
      end if;
    end if;
  end loop;
end $$;

-- As funções novas de membro passam pela porta da entrada, como toda função da rede (20261112-alumia-portas.sql).
select interno.alumia_trancar();
