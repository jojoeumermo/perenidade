-- Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
--
-- Alumia: o painel único de admin (decisão da coordenação de 17/11/2026). Um painel só, dentro do painel interno do Instituto,
-- com plenos poderes sobre a Alumia, só para a coordenação com o segundo fator nesta sessão, e tudo no registro do painel
-- (interno.alumia_painel_registro: quem, quando, a ação e o alvo; nunca endereço de rede).
--
-- O que esta migração acrescenta (o resto do painel é o de 20261113-alumia-o7-painel.sql, reaproveitado):
--   1. interno.alumia_admin_exige(): coordenação, conta não suspensa e o segundo fator nesta sessão. Toda função nova passa por ela.
--   2. O estado do beta fechado (public.alumia_admin_estado): a trava da entrada, a Alumia aberta, os convites, o Fediverso, a
--      porta de entrada e TODOS os interruptores de interno.recursos_catalogo, com a decisão gravada em interno.recursos_vivos.
--   3. Ligar e desligar qualquer recurso (public.alumia_admin_recurso). Os interruptores do lançamento (alumia-aberta,
--      alumia-convites, fediverso-total, fediverso-grupos) valem direto com o segundo fator; os outros que só ligam pelo nome
--      continuam pedindo a segunda pessoa (Segurança › Confirmações). Ligar alumia-aberta com a trava desligada pede a frase
--      escrita: seria a janela em que qualquer pessoa cria conta e entra.
--   4. Fechar a porta de entrada com um clique (public.alumia_admin_porta): conta nova e pedido de entrada novo param na hora
--      (public.alumia_cadastro_passar, redefinida inteira aqui, e um gatilho em interno.alumia_entrada para quem pula o site).
--   5. Banir a conta e o que vem dela (public.alumia_admin_banir): o banimento do painel (que já encerra as sessões), o e-mail
--      (só o resumo HMAC com o segredo do servidor, nunca o e-mail em claro: interno.alumia_admin_emails_barrados), o aparelho
--      e a rede pela impressão HMAC com prazo que já existe (nunca o endereço), os convites abertos dela e quem ela convidou de
--      volta à triagem. Para isso o convite usado passa a deixar um laço (convidado, quem convidou) que vence em 60 dias e só
--      serve a esta cascata: nunca é listado por função nenhuma.
--   6. Apagar qualquer post, um de cada vez (public.alumia_admin_post_apagar), inclusive de núcleo e de espaço fechado, sem ler:
--      vai para a lixeira do painel como os outros.
--   7. Servidores do Fediverso: bloquear e desbloquear (public.alumia_admin_fed_*), pela função que já existe, com registro.
--   8. Bloqueio na borda (Cloudflare) durante um ataque: o IP é digitado pela coordenação na hora e vai do servidor do site à
--      Cloudflare; o banco guarda só o número da regra e a hora de vencer (interno.alumia_admin_borda). A rotina apaga a regra
--      vencida (app/api/alumia/admin/borda/vencidas, cutucada pelo pg_cron quando há o que apagar).
--   9. O motivo de toda ação do painel (interno.alumia_painel_motivo, redefinida) recusa texto com cara de endereço IPv4 ou IPv6
--      (invalido:motivo_com_endereco): o motivo fica guardado no registro, e endereço de rede não se guarda.
--
-- Nenhuma tabela nova tem endereço de rede. Pode rodar mais de uma vez. Termina trancando as funções novas na porta da Alumia.

-- ───────────── 1. As tabelas novas (RLS ligada, sem política: só as funções daqui leem e escrevem) ─────────────

-- O e-mail de quem foi banida: só o resumo HMAC-SHA-256 (o segredo fica no servidor do site, ALUMIA_EMAIL_SEGREDO). O banco
-- não consegue voltar ao e-mail; o servidor confere o resumo antes de criar uma conta.
create table if not exists interno.alumia_admin_emails_barrados (
  selo text primary key check (selo ~ '^[0-9a-f]{64}$'),
  criado_em timestamptz not null default now()
);

-- Quem convidou quem, só enquanto pode servir à cascata do banimento (60 dias depois de o convite ser usado). Some com a conta.
create table if not exists interno.alumia_admin_convite_lacos (
  convidado uuid primary key references interno.perfis (id) on delete cascade,
  por uuid not null references interno.perfis (id) on delete cascade,
  vence_em timestamptz not null default now() + interval '60 days'
);
create index if not exists alumia_admin_convite_lacos_por on interno.alumia_admin_convite_lacos (por);

-- Os bloqueios na borda: o número da regra na Cloudflare e o prazo. O endereço bloqueado fica só na Cloudflare.
create table if not exists interno.alumia_admin_borda (
  id uuid primary key default gen_random_uuid(),
  regra text not null unique check (regra ~ '^[A-Za-z0-9]{8,64}$'),
  por uuid references interno.perfis (id) on delete set null,
  motivo text not null check (char_length(motivo) between 10 and 500),
  criado_em timestamptz not null default now(),
  vence_em timestamptz not null,
  removida_em timestamptz,
  check (vence_em >= criado_em + interval '23 hours' and vence_em <= criado_em + interval '7 days 1 hour')
);
create index if not exists alumia_admin_borda_vencem on interno.alumia_admin_borda (vence_em) where removida_em is null;

do $$
declare t text;
begin
  foreach t in array array['alumia_admin_emails_barrados', 'alumia_admin_convite_lacos', 'alumia_admin_borda'] loop
    execute format('alter table interno.%I enable row level security', t);
    execute format('revoke all on table interno.%I from public', t);
    if exists (select 1 from pg_roles where rolname = 'anon') then
      execute format('revoke all on table interno.%I from anon, authenticated', t);
    end if;
  end loop;
end $$;

-- A porta de entrada nasce aberta (a chave "fechada" entra ao lado dos números que a coordenação já ajusta).
insert into interno.configuracoes (chave, valor)
values ('alumia_cadastro', '{"ligada": false, "teto_hora": 60, "convites_mes": 3, "rede_contas_hora": 3, "rede_pedidos_hora": 6}'::jsonb)
on conflict (chave) do nothing;

-- ───────────── 2. Quem usa: a coordenação, com o segundo fator nesta sessão ─────────────

create or replace function interno.alumia_admin_exige() returns uuid language plpgsql stable security definer set search_path = interno, pg_temp as $$
declare v uuid := auth.uid();
begin
  if v is null or exists (select 1 from perfis f where f.id = v and f.suspenso) then perform interno.erro('sem_permissao'); end if;
  if not exists (select 1 from papeis p where p.usuario = v and p.papel = 'coordenacao') then perform interno.erro('sem_permissao'); end if;
  -- É da coordenação, mas a sessão não confirmou o aplicativo autenticador: a tela pede o código, sem dizer mais nada.
  if not interno.aal2() then perform interno.erro('confirme_segundo_fator'); end if;
  if not interno.tem('coordenacao') then perform interno.erro('sem_permissao'); end if;
  return v;
end $$;

-- O motivo de toda ação do painel: de 10 a 500 letras, como antes, e sem nada com cara de endereço IPv4 ou IPv6. O motivo fica
-- guardado (no registro e, no bloqueio da borda, ao lado da regra): um endereço escrito ali seria um endereço guardado. A hora
-- ("10:30:00") passa; quatro grupos com dois-pontos ou "::" com algarismo hexadecimal ao lado, não.
create or replace function interno.alumia_painel_motivo(p text) returns text language plpgsql immutable as $$
declare v text := interno.txt(p, 'motivo', 10, 500);
begin
  if v ~ '(^|[^0-9.])[0-9]{1,3}(\.[0-9]{1,3}){3}($|[^0-9])'
     or v ~* '(^|[^0-9a-z])([0-9a-f]{1,4}:){3,7}[0-9a-f]{1,4}'
     or v ~* '(^|[^0-9a-z:])[0-9a-f]{0,4}::[0-9a-f]{1,4}'
     or v ~* '(^|[^0-9a-z])[0-9a-f]{1,4}::' then
    raise exception 'invalido:motivo_com_endereco' using errcode = 'P0001';
  end if;
  return v;
end $$;
revoke all on function interno.alumia_painel_motivo(text) from public;
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'anon') then revoke all on function interno.alumia_painel_motivo(text) from anon, authenticated; end if;
end $$;

-- Número de pessoas só a partir de 3: abaixo disso, a tela diz "menos de 3" (e se houve alguma).
create or replace function interno.alumia_admin_conta(p_n integer) returns jsonb language sql immutable as $$
  select jsonb_build_object('n', case when coalesce(p_n, 0) >= 3 then p_n end, 'algum', coalesce(p_n, 0) > 0)
$$;

create or replace function interno.alumia_admin_porta_fechada() returns boolean language sql stable security definer set search_path = interno, pg_temp as $$
  select coalesce((select (valor ->> 'fechada')::boolean from configuracoes where chave = 'alumia_cadastro'), false)
$$;

-- Os interruptores do lançamento: a coordenação com o segundo fator liga e desliga direto (decisão de 17/11: "plenos poderes").
create or replace function interno.alumia_admin_direto(p_nome text) returns boolean language sql immutable as $$
  select p_nome in ('alumia-aberta', 'alumia-convites', 'fediverso-total', 'fediverso-grupos')
$$;

-- Faxina do que é do painel único: laços vencidos.
create or replace function interno.alumia_admin_faxina() returns void language plpgsql security definer set search_path = interno, pg_temp as $$
begin
  delete from alumia_admin_convite_lacos where vence_em <= now();
end $$;

do $$
declare f text;
begin
  foreach f in array array['interno.alumia_admin_exige()', 'interno.alumia_admin_conta(integer)', 'interno.alumia_admin_porta_fechada()',
                           'interno.alumia_admin_direto(text)', 'interno.alumia_admin_faxina()'] loop
    execute format('revoke all on function %s from public', f);
    if exists (select 1 from pg_roles where rolname = 'anon') then execute format('revoke all on function %s from anon, authenticated', f); end if;
  end loop;
end $$;

-- ───────────── 3. Para a tela: quem pode e o estado do beta fechado ─────────────

-- Quem não pode recebe só {pode: false}: a seção nem aparece.
create or replace function public.alumia_admin_eu() returns jsonb language plpgsql stable security definer set search_path = interno, pg_temp as $$
declare v uuid := auth.uid();
begin
  if v is null or exists (select 1 from perfis f where f.id = v and f.suspenso)
     or not exists (select 1 from papeis p where p.usuario = v and p.papel = 'coordenacao') then
    return jsonb_build_object('pode', false);
  end if;
  if not interno.aal2() then return jsonb_build_object('pode', false, 'falta_segundo_fator', true); end if;
  return jsonb_build_object('pode', interno.tem('coordenacao'));
end $$;

create or replace function public.alumia_admin_estado() returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.alumia_admin_exige();
begin
  perform interno.alumia_admin_faxina();
  perform interno.alumia_painel_faxina();
  return jsonb_build_object(
    'trava', jsonb_build_object('ligada', interno.alumia_exigida(), 'desde', (select valor ->> 'ligada_em' from configuracoes where chave = 'alumia_entrada'),
      'eu_passo', interno.aal2() and interno.alumia_aprovada(v)),
    'porta', jsonb_build_object('fechada', interno.alumia_admin_porta_fechada(), 'passe', interno.alumia_cadastro_ligada()),
    -- Pessoas: só a partir de 3 ({n, algum}, como no resto do painel).
    'fila', interno.alumia_admin_conta((select count(*)::integer from alumia_entrada e join perfis f on f.id = e.usuario where e.situacao = 'em_analise' and not f.suspenso)),
    'aprovadas', interno.alumia_admin_conta((select count(*)::integer from alumia_entrada e where e.situacao = 'aprovada')),
    'borda_ativos', (select count(*) from alumia_admin_borda b where b.removida_em is null),
    'fed_bloqueados', (select count(*) from rede_fed_bloqueados),
    'versao', public.rede_alumia_versao(),
    'recursos', coalesce((select jsonb_agg(jsonb_build_object('nome', k.nome, 'so_pelo_nome', k.so_pelo_nome, 'direto', interno.alumia_admin_direto(k.nome) or not k.so_pelo_nome,
        'decisao', w.ligado, 'em', w.em, 'por', interno.alumia_painel_quem(w.por),
        'aguardando', exists (select 1 from confirmacoes c where c.tipo = 'recurso' and c.alvo = k.nome and c.status = 'aguardando' and c.expira_em > now()))
        order by k.nome)
      from recursos_catalogo k left join recursos_vivos w on w.nome = k.nome), '[]'::jsonb));
end $$;

-- ───────────── 4. Ligar e desligar qualquer recurso ─────────────

-- p_ligar: true liga, false desliga, null volta ao padrão do código. p_frase só é pedida para abrir a Alumia sem a trava.
create or replace function public.alumia_admin_recurso(p_nome text, p_ligar boolean, p_motivo text, p_frase text) returns jsonb
language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.alumia_admin_exige(); k recursos_catalogo; v_motivo text := interno.alumia_painel_motivo(p_motivo); v_antes boolean; v_pedido uuid;
begin
  perform interno.limite('alumia_admin_recurso', 60, 60);
  select * into k from recursos_catalogo where nome = p_nome;
  if not found then perform interno.erro('invalido:nome'); end if;
  -- A entrada com triagem liga e desliga junto com a trava, pela lista de conferência (public.alumia_painel_trava).
  if k.nome = 'alumia-entrada' then perform interno.erro('use_a_trava'); end if;
  select w.ligado into v_antes from recursos_vivos w where w.nome = k.nome;
  -- Voltar ao padrão de um recurso que só liga pelo nome e está desligado poderia ligar sem ninguém decidir: só pelos botões.
  if p_ligar is null and v_antes is not distinct from false and k.so_pelo_nome then perform interno.erro('use_ligar'); end if;
  -- Abrir a Alumia (ou voltar ao padrão, que a abre) com a trava desligada: qualquer pessoa criaria conta e entraria.
  if k.nome = 'alumia-aberta' and coalesce(p_ligar, true) and not interno.alumia_exigida()
     and btrim(coalesce(p_frase, '')) is distinct from 'ABRIR SEM A TRAVA' then
    perform interno.erro('perigo_sem_trava');
  end if;
  if p_ligar and k.so_pelo_nome and not interno.alumia_admin_direto(k.nome) then
    v_pedido := interno.pedir_confirmacao('recurso', k.nome, v_motivo);
    perform interno.alumia_painel_registrar('recurso_pedido', 'recurso', k.nome, k.nome, v_motivo, jsonb_build_object('confirmacao', v_pedido, 'painel_unico', true));
    return jsonb_build_object('ok', true, 'aguardando', true, 'id', v_pedido);
  end if;
  if p_ligar is null then
    delete from recursos_vivos where nome = k.nome;
  else
    insert into recursos_vivos (nome, ligado, por) values (k.nome, p_ligar, v)
    on conflict (nome) do update set ligado = excluded.ligado, por = excluded.por, em = now();
  end if;
  -- Um pedido de segunda pessoa que estivesse esperando perde o sentido: a decisão já foi tomada.
  update confirmacoes set status = 'cancelada' where tipo = 'recurso' and alvo = k.nome and status = 'aguardando';
  perform interno.registrar(case when p_ligar is null then 'recurso_decisao_apagada' when p_ligar then 'recurso_ligado' else 'recurso_desligado' end, k.nome, jsonb_build_object('painel_unico', true));
  perform interno.alumia_painel_registrar(case when p_ligar is null then 'recurso_padrao' when p_ligar then 'recurso_ligado' else 'recurso_desligado' end, 'recurso', k.nome, k.nome, v_motivo,
    jsonb_build_object('antes', v_antes, 'painel_unico', true, 'sem_trava', k.nome = 'alumia-aberta' and coalesce(p_ligar, true) and not interno.alumia_exigida()));
  return jsonb_build_object('ok', true, 'decisao', p_ligar);
end $$;

-- ───────────── 5. A porta de entrada: fechar com um clique e reabrir ─────────────

create or replace function public.alumia_admin_porta(p_fechar boolean, p_motivo text) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.alumia_admin_exige(); v_fechar boolean := coalesce(p_fechar, true); v_motivo text;
begin
  perform interno.limite('alumia_admin_porta', 30, 60);
  -- Fechar é um clique (hora de ataque): sem motivo escrito, fica o motivo padrão. Reabrir pede o motivo.
  v_motivo := case when v_fechar and btrim(coalesce(p_motivo, '')) = '' then 'Porta fechada pelo painel, com um clique.' else interno.alumia_painel_motivo(p_motivo) end;
  if v_fechar = interno.alumia_admin_porta_fechada() then perform interno.erro('nada_a_fazer'); end if;
  insert into configuracoes (chave, valor) values ('alumia_cadastro', jsonb_build_object('fechada', v_fechar))
  on conflict (chave) do update set valor = configuracoes.valor || jsonb_build_object('fechada', v_fechar);
  perform interno.registrar(case when v_fechar then 'alumia_porta_fechada' else 'alumia_porta_reaberta' end, 'alumia_cadastro', '{}'::jsonb);
  perform interno.alumia_painel_registrar(case when v_fechar then 'porta_fechada' else 'porta_reaberta' end, 'porta', 'alumia_cadastro', 'Porta de entrada', v_motivo);
  return jsonb_build_object('ok', true, 'fechada', v_fechar);
end $$;

-- Quem pula o site e chama o pedido de entrada direto também encontra a porta fechada. Só o pedido da própria pessoa: a triagem
-- reabrir uma ficha, ou a cascata do banimento devolver alguém à fila, são decisões da equipe e passam.
create or replace function interno.alumia_admin_entrada_porta() returns trigger language plpgsql security definer set search_path = interno, pg_temp as $$
begin
  if new.situacao = 'em_analise' and (tg_op = 'INSERT' or old.situacao is distinct from 'em_analise')
     and auth.uid() is not distinct from new.usuario and interno.alumia_admin_porta_fechada() then
    perform interno.erro('porta_fechada');
  end if;
  return new;
end $$;
revoke all on function interno.alumia_admin_entrada_porta() from public;
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'anon') then revoke all on function interno.alumia_admin_entrada_porta() from anon, authenticated; end if;
end $$;
drop trigger if exists alumia_admin_entrada_porta on interno.alumia_entrada;
create trigger alumia_admin_entrada_porta before insert or update of situacao on interno.alumia_entrada
  for each row execute function interno.alumia_admin_entrada_porta();

-- A porta do servidor (20261114-alumia-o8-porta.sql), redefinida INTEIRA com duas mudanças: a porta fechada recusa tudo antes de
-- gastar o desafio, e o convite aceito deixa o laço (convidado, quem convidou) para a cascata do banimento.
create or replace function public.alumia_cadastro_passar(p_momento text, p_chave text, p_selo text, p_vence timestamp with time zone, p_impressao text DEFAULT NULL::text, p_usuario uuid DEFAULT NULL::uuid, p_convite text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'interno', 'pg_temp'
AS $function$
declare v_hora timestamptz := interno.alumia_cadastro_hora(); v_total integer; v_teto integer; h alumia_cadastro_horas;
  v_convite text := 'nenhum'; v_alertar boolean := false; v_de uuid;
begin
  if not interno.servico() then perform interno.erro('sem_permissao'); end if;
  if p_momento is null or p_momento not in ('conta', 'pedido') then perform interno.erro('invalido:momento'); end if;
  if p_selo is null or p_selo !~ '^[0-9a-f]{64}$' then perform interno.erro('invalido:desafio'); end if;
  if p_chave is not null and p_chave !~ '^[0-9a-f]{64}$' then perform interno.erro('invalido:chave'); end if;
  if p_vence is null or p_vence < now() or p_vence > now() + interval '1 hour' then perform interno.erro('invalido:prazo'); end if;
  if p_momento = 'pedido' and (p_usuario is null or not exists (select 1 from perfis where id = p_usuario)) then perform interno.erro('nao_encontrado'); end if;
  -- A porta fechada pelo painel único (hora de ataque): nem conta nova nem pedido novo, para todo mundo, com ou sem convite.
  if interno.alumia_admin_porta_fechada() then return interno.alumia_cadastro_recusar('porta_fechada'); end if;
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
  -- "for update". Quem convidou fica só no laço da cascata do banimento (interno.alumia_admin_convite_lacos, 60 dias), que
  -- nenhuma função lista: a triagem continua vendo só a marca "veio por convite".
  if p_momento = 'pedido' and nullif(btrim(coalesce(p_convite, '')), '') is not null then
    delete from alumia_convites where selo = interno.selo(lower(btrim(p_convite))) and situacao = 'aberto' and vence_em > now()
      and criado_por <> p_usuario
    returning criado_por into v_de;
    v_convite := case when v_de is not null then 'aceito' else 'invalido' end;
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
      insert into alumia_admin_convite_lacos (convidado, por) values (p_usuario, v_de)
      on conflict (convidado) do update set por = excluded.por, vence_em = now() + interval '60 days';
    end if;
  end if;
  return jsonb_build_object('ok', true, 'convite', v_convite);
end $function$;
revoke all on function public.alumia_cadastro_passar(text, text, text, timestamptz, text, uuid, text) from public;
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on function public.alumia_cadastro_passar(text, text, text, timestamptz, text, uuid, text) from anon, authenticated;
    grant execute on function public.alumia_cadastro_passar(text, text, text, timestamptz, text, uuid, text) to service_role;
  end if;
end $$;

-- ───────────── 6. Banir a conta e o que vem dela ─────────────

-- O e-mail da conta, para o servidor calcular o resumo com o segredo dele. Só a chave de serviço (a rota de banir, depois de o
-- banco dizer que quem pediu é da coordenação com o segundo fator).
create or replace function public.alumia_admin_email_de(p_id uuid) returns text language plpgsql stable security definer set search_path = interno, pg_temp as $$
begin
  if not interno.servico() then perform interno.erro('sem_permissao'); end if;
  return (select lower(btrim(u.email)) from auth.users u where u.id = p_id);
end $$;

-- O e-mail (pelo resumo) está barrado? Só a chave de serviço (a rota de criar conta).
create or replace function public.alumia_admin_email_barrado(p_selo text) returns boolean language plpgsql stable security definer set search_path = interno, pg_temp as $$
begin
  if not interno.servico() then perform interno.erro('sem_permissao'); end if;
  return p_selo ~ '^[0-9a-f]{64}$' and exists (select 1 from alumia_admin_emails_barrados where selo = p_selo);
end $$;

-- Banir: p_confirma é o codinome escrito igual; p_selo_email, o resumo do e-mail (nulo sem o segredo no servidor); p_rede_dias
-- (0 = não) e p_rede_contas barram também a rede e o aparelho pela impressão, com o número de contas atingidas conferido de novo.
create or replace function public.alumia_admin_banir(p_id uuid, p_motivo text, p_confirma text, p_selo_email text, p_rede_dias integer, p_rede_contas integer) returns jsonb
language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.alumia_admin_exige(); f perfis; v_motivo text := interno.alumia_painel_motivo(p_motivo); v_conv integer := 0; v_tri integer := 0;
  v_email boolean := false; v_sessoes jsonb; r record;
begin
  perform interno.limite('alumia_admin_banir', 30, 60);
  -- Ninguém se bane, a coordenação não é banida por aqui e quem tem função na casa segue as regras do painel da equipe.
  f := interno.alumia_painel_alvo(p_id, true);
  if btrim(coalesce(p_confirma, '')) = '' or btrim(p_confirma) is distinct from coalesce(nullif(f.rede_codinome, ''), 'Sem codinome') then perform interno.erro('confirmacao_errada'); end if;
  if p_selo_email is not null and p_selo_email !~ '^[0-9a-f]{64}$' then perform interno.erro('invalido:selo'); end if;
  if p_rede_dias is not null and (p_rede_dias < 0 or p_rede_dias > 90) then perform interno.erro('invalido:dias'); end if;

  -- A conta: o banimento do painel (suspende, encerra as sessões, avisa a pessoa, registra).
  perform public.alumia_painel_sancionar(f.id, 'banimento', null, v_motivo);
  -- O e-mail: só o resumo.
  if p_selo_email is not null then
    insert into alumia_admin_emails_barrados (selo) values (p_selo_email) on conflict (selo) do nothing;
    v_email := true;
  end if;
  -- Os convites que ela abriu e ninguém usou.
  update alumia_convites set situacao = 'cancelado' where criado_por = f.id and situacao = 'aberto';
  get diagnostics v_conv = row_count;
  -- Quem ela convidou e já foi aprovado volta à triagem (quem ainda espera continua na fila).
  for r in select l.convidado from alumia_admin_convite_lacos l where l.por = f.id loop
    if not interno.alumia_painel_da_casa(r.convidado) then
      update alumia_entrada set situacao = 'em_analise', decidido_em = null, decidido_por = null, motivo_decisao = null
      where usuario = r.convidado and situacao = 'aprovada';
      if found then
        v_tri := v_tri + 1;
        perform interno.avisar_em(r.convidado, 'Seu cadastro na Alumia voltou para a análise da equipe. Você recebe um aviso quando houver decisão.', 'conta');
      end if;
    end if;
  end loop;
  delete from alumia_admin_convite_lacos where por = f.id or convidado = f.id;
  -- A rede e o aparelho, pela impressão com prazo (nunca o endereço). Mostra antes quantas contas seriam atingidas.
  if coalesce(p_rede_dias, 0) > 0 then
    perform public.alumia_painel_rede_banir(f.id, p_rede_dias, v_motivo, p_rede_contas);
  end if;
  -- As sessões de novo (o banimento já encerrou; aqui só para dizer se o banco conseguiu no serviço de contas).
  v_sessoes := interno.alumia_cortar_sessoes(f.id);
  perform interno.alumia_painel_registrar('conta_banida_tudo', 'pessoa', f.id::text, interno.alumia_painel_nome_fixo(f.id), v_motivo,
    jsonb_build_object('email', v_email, 'convites', interno.alumia_admin_conta(v_conv), 'convidados', interno.alumia_admin_conta(v_tri),
      'rede_dias', coalesce(p_rede_dias, 0), 'sessoes', coalesce((v_sessoes ->> 'apagou')::boolean, false)));
  return jsonb_build_object('ok', true, 'email', v_email, 'convites', interno.alumia_admin_conta(v_conv), 'convidados', interno.alumia_admin_conta(v_tri),
    'rede_dias', coalesce(p_rede_dias, 0), 'sessoes', coalesce((v_sessoes ->> 'apagou')::boolean, false));
end $$;

-- ───────────── 7. Apagar qualquer post, um de cada vez ─────────────

-- Vai para a lixeira do painel (volta em até 30 dias pela aba Posts), inclusive post de núcleo e de espaço fechado. O banco não
-- devolve o texto: apagar não é ler.
create or replace function public.alumia_admin_post_apagar(p_id uuid, p_motivo text) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.alumia_admin_exige(); x rede_posts; v_motivo text := interno.alumia_painel_motivo(p_motivo); v_restrito boolean;
begin
  perform interno.limite('alumia_painel_agir', 300, 60);
  select * into x from rede_posts where id = p_id for update;
  if not found or x.apagado_em is not null then perform interno.erro('nao_encontrado'); end if;
  if exists (select 1 from alumia_painel_lixeira l where l.post = x.id and l.de_vez_em is null) then perform interno.erro('na_lixeira'); end if;
  v_restrito := x.nucleo is not null or coalesce(x.comunidade, '') like 'fechado-%';
  delete from alumia_painel_lixeira where post = x.id;
  insert into alumia_painel_lixeira (post, por, motivo, estava_oculto, estava_retido) values (x.id, v, v_motivo, x.oculto, x.retido);
  update rede_posts set oculto = true, retido = false, motivo = left(v_motivo, 200) where id = x.id;
  perform interno.rede3_mod_registrar('remover', 'post', x.id::text, 'painel', v_motivo, null);
  if x.autor is not null then
    perform interno.rede3_mod_avisar_afetado(x.autor, left('Um post seu foi retirado da Alumia (decisão de uma pessoa da coordenação). Você pode recorrer em até 30 dias, em Denúncias e recursos. Motivo: ' || v_motivo, 500));
  end if;
  perform interno.alumia_painel_registrar('post_apagar', 'post', x.id::text, interno.alumia_painel_nome_fixo(x.autor), v_motivo,
    jsonb_build_object('comunidade', case when v_restrito then null else x.comunidade end, 'restrito', v_restrito, 'painel_unico', true));
  return jsonb_build_object('ok', true, 'restrito', v_restrito);
end $$;

-- ───────────── 8. Servidores do Fediverso ─────────────

create or replace function public.alumia_admin_fed_servidores() returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.alumia_admin_exige();
begin
  return coalesce((select jsonb_agg(jsonb_build_object('dominio', b.dominio, 'motivo', b.motivo, 'desde', b.criado_em, 'fixo', coalesce((to_jsonb(b) ->> 'fixo')::boolean, false)) order by b.dominio)
    from rede_fed_bloqueados b), '[]'::jsonb);
end $$;

create or replace function public.alumia_admin_fed_bloquear(p_dominio text, p_sim boolean, p_motivo text) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.alumia_admin_exige(); v_motivo text := interno.alumia_painel_motivo(p_motivo); v_d text := lower(btrim(coalesce(p_dominio, '')));
begin
  perform interno.limite('alumia_admin_fed', 60, 60);
  if p_sim is null then perform interno.erro('invalido:sim'); end if;
  perform public.rede_fed_bloquear(v_d, p_sim, v_motivo);
  perform interno.alumia_painel_registrar(case when p_sim then 'fed_servidor_bloqueado' else 'fed_servidor_desbloqueado' end, 'servidor', v_d, v_d, v_motivo);
  return public.alumia_admin_fed_servidores();
end $$;

-- ───────────── 9. O bloqueio na borda (Cloudflare) ─────────────

create or replace function public.alumia_admin_borda_guardar(p_regra text, p_horas integer, p_motivo text) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.alumia_admin_exige(); v_motivo text := interno.alumia_painel_motivo(p_motivo); v_id uuid; v_vence timestamptz;
begin
  perform interno.limite('alumia_admin_borda', 60, 60);
  if p_regra is null or p_regra !~ '^[A-Za-z0-9]{8,64}$' then perform interno.erro('invalido:regra'); end if;
  if p_horas is null or p_horas < 24 or p_horas > 168 then perform interno.erro('invalido:horas'); end if;
  v_vence := now() + make_interval(hours => p_horas);
  insert into alumia_admin_borda (regra, por, motivo, vence_em) values (p_regra, v, v_motivo, v_vence) returning id into v_id;
  perform interno.alumia_painel_registrar('borda_bloqueio', 'borda', v_id::text, 'Bloqueio na borda', v_motivo, jsonb_build_object('horas', p_horas, 'vence_em', v_vence));
  return jsonb_build_object('id', v_id, 'vence_em', v_vence);
end $$;

create or replace function public.alumia_admin_borda_lista() returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.alumia_admin_exige();
begin
  return jsonb_build_object(
    'ativos', coalesce((select jsonb_agg(jsonb_build_object('id', b.id, 'criado_em', b.criado_em, 'vence_em', b.vence_em, 'quem', interno.alumia_painel_quem(b.por), 'motivo', b.motivo) order by b.vence_em)
      from alumia_admin_borda b where b.removida_em is null), '[]'::jsonb),
    'recentes', coalesce((select jsonb_agg(x.j order by x.removida_em desc) from (
      select b.removida_em, jsonb_build_object('id', b.id, 'criado_em', b.criado_em, 'vence_em', b.vence_em, 'removida_em', b.removida_em, 'quem', interno.alumia_painel_quem(b.por), 'motivo', b.motivo) as j
      from alumia_admin_borda b where b.removida_em is not null order by b.removida_em desc limit 20) x), '[]'::jsonb));
end $$;

-- O número da regra, para o servidor apagá-la na Cloudflare antes da hora.
create or replace function public.alumia_admin_borda_regra(p_id uuid) returns text language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.alumia_admin_exige(); v_regra text;
begin
  select regra into v_regra from alumia_admin_borda where id = p_id and removida_em is null;
  if v_regra is null then perform interno.erro('nao_encontrado'); end if;
  return v_regra;
end $$;

create or replace function public.alumia_admin_borda_tirada(p_id uuid, p_motivo text) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.alumia_admin_exige(); v_motivo text := interno.alumia_painel_motivo(p_motivo);
begin
  update alumia_admin_borda set removida_em = now() where id = p_id and removida_em is null;
  if not found then perform interno.erro('nao_encontrado'); end if;
  perform interno.alumia_painel_registrar('borda_desbloqueio', 'borda', p_id::text, 'Bloqueio na borda', v_motivo);
  return jsonb_build_object('ok', true);
end $$;

-- A rotina (chave de serviço): o que venceu e ainda está na Cloudflare, e a baixa depois de apagar lá.
create or replace function public.alumia_admin_borda_vencidas() returns jsonb language plpgsql stable security definer set search_path = interno, pg_temp as $$
begin
  if not interno.servico() then perform interno.erro('sem_permissao'); end if;
  return coalesce((select jsonb_agg(jsonb_build_object('id', x.id, 'regra', x.regra)) from (
    select b.id, b.regra from alumia_admin_borda b where b.removida_em is null and b.vence_em <= now() order by b.vence_em limit 50) x), '[]'::jsonb);
end $$;

create or replace function public.alumia_admin_borda_apagada(p_id uuid) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
begin
  if not interno.servico() then perform interno.erro('sem_permissao'); end if;
  update alumia_admin_borda set removida_em = now() where id = p_id and removida_em is null and vence_em <= now();
  if found then perform interno.alumia_painel_registrar('borda_venceu', 'borda', p_id::text, 'Bloqueio na borda', 'O prazo do bloqueio venceu e a regra saiu da Cloudflare.'); end if;
  return jsonb_build_object('ok', found);
end $$;

-- O pg_cron cutuca a rota do site quando há bloqueio vencido. O endereço da rota e a chave ficam em interno.configuracoes
-- ('alumia_admin_borda'), escritos uma vez pelo dono do banco. A chave é só desta rota (ALUMIA_BORDA_ROTINA no servidor, 32
-- letras ou mais), nunca a CRON_SECRET das outras rotinas: quem lê o banco ou um backup só consegue pedir a faxina da borda.
--   update interno.configuracoes set valor = '{"url": "https://SEU-SITE/api/alumia/admin/borda/vencidas", "segredo": "<ALUMIA_BORDA_ROTINA>"}'::jsonb where chave = 'alumia_admin_borda';
-- Sem isso (ou sem pg_cron e pg_net), a regra vencida sai da Cloudflare quando a coordenação abre a aba Ataque, ou pela rotina
-- do servidor que chamar a mesma rota.
insert into interno.configuracoes (chave, valor) values ('alumia_admin_borda', '{}'::jsonb) on conflict (chave) do nothing;

create or replace function interno.alumia_admin_rotina() returns void language plpgsql security definer set search_path = interno, pg_temp as $$
declare v_url text := (select valor ->> 'url' from configuracoes where chave = 'alumia_admin_borda');
  v_segredo text := coalesce((select valor ->> 'segredo' from configuracoes where chave = 'alumia_admin_borda'), '');
begin
  perform interno.alumia_admin_faxina();
  if coalesce(v_url, '') !~ '^https://[a-z0-9.-]+/api/alumia/admin/borda/vencidas$' or char_length(v_segredo) < 16 then return; end if;
  if not exists (select 1 from alumia_admin_borda b where b.removida_em is null and b.vence_em <= now()) then return; end if;
  execute 'select net.http_post(url := $1, body := ''{}''::jsonb, headers := $2, timeout_milliseconds := 30000)'
    using v_url, jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || v_segredo);
exception when others then null;
end $$;
revoke all on function interno.alumia_admin_rotina() from public;
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'anon') then revoke all on function interno.alumia_admin_rotina() from anon, authenticated; end if;
end $$;
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule('alumia-admin-rotina', '*/15 * * * *', 'select interno.alumia_admin_rotina()');
  end if;
exception when others then null;
end $$;

-- ───────────── 10. Permissões: as da coordenação para quem tem conta; as da rotina só para a chave de serviço ─────────────

do $$
declare f text;
begin
  foreach f in array array['public.alumia_admin_eu()', 'public.alumia_admin_estado()', 'public.alumia_admin_recurso(text, boolean, text, text)',
                           'public.alumia_admin_porta(boolean, text)', 'public.alumia_admin_banir(uuid, text, text, text, integer, integer)',
                           'public.alumia_admin_post_apagar(uuid, text)', 'public.alumia_admin_fed_servidores()', 'public.alumia_admin_fed_bloquear(text, boolean, text)',
                           'public.alumia_admin_borda_guardar(text, integer, text)', 'public.alumia_admin_borda_lista()', 'public.alumia_admin_borda_regra(uuid)',
                           'public.alumia_admin_borda_tirada(uuid, text)'] loop
    execute format('revoke all on function %s from public', f);
    if exists (select 1 from pg_roles where rolname = 'anon') then
      execute format('revoke all on function %s from anon', f);
      execute format('grant execute on function %s to authenticated', f);
    end if;
  end loop;
  foreach f in array array['public.alumia_admin_email_de(uuid)', 'public.alumia_admin_email_barrado(text)', 'public.alumia_admin_borda_vencidas()',
                           'public.alumia_admin_borda_apagada(uuid)'] loop
    execute format('revoke all on function %s from public', f);
    if exists (select 1 from pg_roles where rolname = 'anon') then
      execute format('revoke all on function %s from anon, authenticated', f);
      execute format('grant execute on function %s to service_role', f);
    end if;
  end loop;
end $$;

select interno.alumia_trancar();
