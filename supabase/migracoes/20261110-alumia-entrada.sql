-- ───────────────────────────── Alumia: a entrada (triagem e segundo fator), novembro de 2026 ─────────────────────────────
-- Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
--
-- Sem conta aprovada ninguém vê a Alumia. Quem cria conta pela Alumia fica "em análise" até a coordenação ou a mediação aprovar
-- (fila no painel: alumia_triagem_fila / alumia_triagem_decidir). Já entram aprovadas, sem pedido: a coordenação e a
-- vice-coordenação (pelo papel) e quem é militante da Escola de Formação (departamento "revolucionarios"). O contrário não vale:
-- ser aprovada na Alumia não dá a Escola (interno.e_militante não muda).
-- Depois de aprovada, a sessão precisa do segundo fator (aal2) para ser membro da rede (interno.rede2_membro) e para ler as
-- linhas (interno.rede_aba): sem o código do aplicativo autenticador, senha roubada não abre nada.
--
-- A trava só vale depois de a coordenação ligar (interno.alumia_entrada_ligar(true), uma linha no SQL Editor), para o banco não
-- trancar ninguém antes de o site novo estar no ar. Ao ligar, quem já era membro da Alumia fica aprovado ("ja_membro").
-- O Fediverso não passa por aqui: o que vem de fora segue a moderação da federação (bloquear servidor ou ator, ocultar o post);
-- as rotas da federação usam a chave de serviço (interno.servico()) e não são trancadas.
--
-- Privacidade: nada de lista de pessoas para quem não é da triagem; a fila mostra codinome, o motivo escrito pela pessoa e há
-- quantos dias a conta existe (nunca e-mail, nome civil ou IP). O motivo do pedido some 30 dias depois da decisão (LGPD art. 15
-- e 16: guardar só pelo tempo necessário). Tudo em interno, com RLS e sem permissão direta; as funções conferem o papel e a sessão.
--
-- Migração acrescentável: pode rodar mais de uma vez, sem apagar dado nenhum. Roda DEPOIS das migrações da Alumia de 09 e 10/11.
-- O mesmo bloco está no fim do install.sql. Teste: npm run testar:alumia-entrada.

-- 1. A tabela ───────────────────────────────────────────────────────────────────────────────────────────────────────────────
create table if not exists interno.alumia_entrada (
  usuario uuid primary key references interno.perfis (id) on delete cascade,
  -- O número da ficha na fila (a triagem age por ele, nunca pelo id da conta).
  id uuid not null default gen_random_uuid() unique,
  situacao text not null default 'em_analise' check (situacao in ('em_analise', 'aprovada', 'recusada')),
  origem text not null default 'cadastro' check (origem in ('cadastro', 'ja_membro')),
  motivo_pedido text check (motivo_pedido is null or char_length(motivo_pedido) <= 500),
  pedido_em timestamptz not null default now(),
  tentativas smallint not null default 1,
  decidido_em timestamptz,
  decidido_por uuid references interno.perfis (id) on delete set null,
  motivo_decisao text check (motivo_decisao is null or char_length(motivo_decisao) <= 500)
);
create index if not exists alumia_entrada_fila on interno.alumia_entrada (situacao, pedido_em);
alter table interno.alumia_entrada enable row level security;
revoke all on table interno.alumia_entrada from public;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on table interno.alumia_entrada from anon, authenticated;
  end if;
end $$;

insert into interno.configuracoes (chave, valor) values ('alumia_entrada', '{"exigir": false}'::jsonb) on conflict (chave) do nothing;

-- 2. Quem está dentro ───────────────────────────────────────────────────────────────────────────────────────────────────────

/** A trava da entrada está ligada? (Só a coordenação liga, por interno.alumia_entrada_ligar.) */
create or replace function interno.alumia_exigida() returns boolean language sql stable security definer set search_path = interno, pg_temp as $$
  select coalesce((select (valor ->> 'exigir')::boolean from configuracoes where chave = 'alumia_entrada'), false)
$$;

/**
 * A situação de uma conta na entrada da Alumia: suspensa, aprovada (pela triagem, ou direto: coordenação, vice-coordenação e
 * militante da Escola), em_analise, recusada ou sem_pedido. Olha o papel na tabela (não a sessão): serve para qualquer conta.
 */
create or replace function interno.alumia_situacao(p uuid) returns text language sql stable security definer set search_path = interno, pg_temp as $$
  select case
    when p is null or not exists (select 1 from perfis f where f.id = p) then 'sem_conta'
    when exists (select 1 from perfis f where f.id = p and f.suspenso) then 'suspensa'
    when exists (select 1 from papeis pa where pa.usuario = p and pa.papel in ('coordenacao', 'vice')) then 'aprovada'
    when interno.membro_direto(p, 'revolucionarios') then 'aprovada'
    else coalesce((select e.situacao from alumia_entrada e where e.usuario = p), 'sem_pedido')
  end
$$;

create or replace function interno.alumia_aprovada(p uuid) returns boolean language sql stable security definer set search_path = interno, pg_temp as $$
  select interno.alumia_situacao(p) = 'aprovada'
$$;

/** A sessão de quem chama vale para a Alumia: conta aprovada e código do aplicativo autenticador (aal2). A chave de serviço passa. */
create or replace function interno.alumia_sessao_ok() returns boolean language sql stable security definer set search_path = interno, pg_temp as $$
  select interno.servico() or (auth.uid() is not null and interno.aal2() and interno.alumia_aprovada(auth.uid()))
$$;

/** Quem faz a triagem: coordenação, vice-coordenação ou mediação, sempre em sessão com o segundo fator. */
create or replace function interno.alumia_triagem_pode() returns boolean language sql stable security definer set search_path = interno, pg_temp as $$
  select auth.uid() is not null and interno.aal2() and (interno.coord() or interno.tem('mediacao'))
$$;

/** Quem já era membro da Alumia (18+ e consentimento em vigor) entra aprovado. Só roda enquanto a trava está desligada, e ao ligar. */
create or replace function interno.alumia_aprovar_quem_ja_era() returns integer language plpgsql security definer set search_path = interno, pg_temp as $$
declare v_n integer;
begin
  insert into alumia_entrada (usuario, situacao, origem, pedido_em, decidido_em)
  select f.id, 'aprovada', 'ja_membro', now(), now() from perfis f
  where f.rede_18 and not f.suspenso and f.rede_consentimento is not null
    and exists (select 1 from rede_consentimentos c where c.usuario = f.id and c.versao = f.rede_consentimento and c.revogado_em is null)
  on conflict (usuario) do nothing;
  get diagnostics v_n = row_count;
  return v_n;
end $$;

do $$
begin
  if not interno.alumia_exigida() then perform interno.alumia_aprovar_quem_ja_era(); end if;
end $$;

/** Liga (ou desliga) a trava. Só pelo SQL Editor (dono do banco): select interno.alumia_entrada_ligar(true); */
create or replace function interno.alumia_entrada_ligar(p_ligar boolean default true) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v_n integer := 0;
begin
  if coalesce(p_ligar, false) then v_n := interno.alumia_aprovar_quem_ja_era(); end if;
  insert into configuracoes (chave, valor) values ('alumia_entrada', jsonb_build_object('exigir', coalesce(p_ligar, false)))
    on conflict (chave) do update set valor = configuracoes.valor || jsonb_build_object('exigir', coalesce(p_ligar, false));
  return jsonb_build_object('exigir', coalesce(p_ligar, false), 'aprovados_agora', v_n);
end $$;

-- 3. A trava nas funções da rede ────────────────────────────────────────────────────────────────────────────────────────────

/**
 * Membro da Rede: conta ativa, 18+ confirmado e consentimento em vigor (decisão 1). Com a trava da entrada ligada, também conta
 * aprovada na triagem e, para a própria sessão, o segundo fator (aal2). A chave de serviço (federação) não passa pelo aal2.
 */
create or replace function interno.rede2_membro(p_usuario uuid) returns boolean language sql stable security definer set search_path = interno, pg_temp as $$
  select p_usuario is not null and exists (
    select 1 from perfis f where f.id = p_usuario and f.rede_18 and not f.suspenso and f.rede_consentimento is not null
      and exists (select 1 from rede_consentimentos c where c.usuario = p_usuario and c.versao = f.rede_consentimento and c.revogado_em is null))
    and (not interno.alumia_exigida()
      or (interno.alumia_aprovada(p_usuario) and (p_usuario is distinct from auth.uid() or interno.aal2() or interno.servico())))
$$;

/**
 * Valida a aba e devolve a forma canônica (o mesmo de 20261109/2026-11-rede: 'seguindo', 'comunidades' e 'tudo' pedem conta;
 * 'geral' é a linha aberta das disciplinas; 'c:<slug>' comunidade; 'u:<handle>' perfil). Com a trava da entrada ligada, toda
 * aba menos 'geral' (as dúvidas das aulas, que o site aberto mostra) pede conta aprovada e sessão com o segundo fator.
 */
create or replace function interno.rede_aba(p_aba text, p_quem uuid) returns text language plpgsql stable security definer set search_path = interno, pg_temp as $$
declare v_slug text; v_alvo perfis;
begin
  if p_aba is distinct from 'geral' and interno.alumia_exigida() and not interno.servico()
     and not (p_quem is not null and p_quem = auth.uid() and interno.aal2() and interno.alumia_aprovada(p_quem)) then
    perform interno.erro('alumia_entrada');
  end if;
  if p_aba in ('tudo', 'seguindo', 'comunidades') then
    if p_quem is null then perform interno.erro('entre_primeiro'); end if;
    return p_aba;
  elsif p_aba = 'geral' then
    return 'geral';
  elsif p_aba ~ '^c:[a-z0-9-]{2,60}$' then
    select c.slug into v_slug from rede_comunidades c where c.slug = substr(p_aba, 3) or substr(p_aba, 3) = any (c.apelidos) order by (c.slug = substr(p_aba, 3)) desc limit 1;
    return 'c:' || coalesce(v_slug, substr(p_aba, 3));
  elsif p_aba ~ '^u:[a-z0-9_]{3,20}$' then
    if p_quem is null then perform interno.erro('entre_primeiro'); end if;
    select * into v_alvo from perfis where rede_handle = substr(p_aba, 3);
    if not found or (v_alvo.id <> p_quem and (v_alvo.rede_modo = 'invisivel' or v_alvo.rede_invisivel or interno.rede_bloqueado(p_quem, v_alvo.id))) then
      perform interno.erro('nao_encontrado');
    end if;
    if v_alvo.id <> p_quem and v_alvo.rede_modo = 'trancado'
       and not exists (select 1 from rede_seguindo s where s.quem = p_quem and s.segue = v_alvo.id and not s.pendente) then
      return 'nada';
    end if;
    return 'u:' || v_alvo.id::text;
  end if;
  perform interno.erro('invalido:aba');
  return null;
end $$;

-- 4. A pessoa: onde estou e o pedido ────────────────────────────────────────────────────────────────────────────────────────

/** Onde a pessoa da sessão está na entrada da Alumia. Visitante recebe só {logado: false}. Nada sobre outras contas. */
create or replace function public.alumia_entrada_eu() returns jsonb language plpgsql stable security definer set search_path = interno, pg_temp as $$
declare v uuid := auth.uid(); f perfis; e alumia_entrada; v_sit text; v_auto boolean;
begin
  if v is null then return jsonb_build_object('logado', false, 'exigida', interno.alumia_exigida()); end if;
  select * into f from perfis where id = v;
  if not found then return jsonb_build_object('logado', true, 'situacao', 'sem_pedido', 'aal2', interno.aal2(), 'exigida', interno.alumia_exigida()); end if;
  select * into e from alumia_entrada where usuario = v;
  v_sit := interno.alumia_situacao(v);
  v_auto := v_sit = 'aprovada' and (e.usuario is null or e.situacao <> 'aprovada');
  return jsonb_build_object(
    'logado', true,
    'situacao', v_sit,
    'direto', v_auto,
    'aal2', interno.aal2(),
    'exigida', interno.alumia_exigida(),
    'codinome', case when f.rede_codinome_ok then f.rede_codinome end,
    'pedido_em', e.pedido_em,
    'motivo_recusa', case when v_sit = 'recusada' then e.motivo_decisao end,
    'pedir_de_novo_em', case when v_sit = 'recusada' then e.decidido_em + interval '30 days' end,
    'regras_versao', coalesce((select max(versao) from rede_regras), 1));
end $$;

/**
 * O pedido de entrada (o formulário "Criar conta" da Alumia, depois de a conta existir): codinome (nunca o nome civil: a regra de
 * rede_codinome_definir), 18 anos ou mais e consentimento das normas (rede_aderir: LGPD art. 11, I e art. 14), aceite das regras e
 * da privacidade, e o motivo (10 a 500 letras, sem telefone nem documento). A conta fica em análise. Recusada, pede de novo
 * depois de 30 dias. Militante da Escola e coordenação já entram aprovados (o pedido só grava o codinome e o consentimento).
 */
create or replace function public.alumia_entrada_pedir(p_codinome text, p_motivo text, p_maior boolean, p_versao integer, p_aceite boolean) returns jsonb
language plpgsql volatile security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); f perfis; e alumia_entrada; v_sit text; v_motivo text; v_nome text;
begin
  perform interno.aberta('comunidade');
  perform interno.limite('alumia_pedir', 6, 60);
  if not coalesce(p_aceite, false) then perform interno.erro('aceite_obrigatorio'); end if;
  if not coalesce(p_maior, false) then perform interno.erro('idade_minima'); end if;
  v_sit := interno.alumia_situacao(v);
  if v_sit = 'suspensa' then perform interno.erro('conta_suspensa'); end if;
  select * into e from alumia_entrada where usuario = v;
  if v_sit = 'recusada' and e.decidido_em > now() - interval '30 days' then perform interno.erro('recusada_recente'); end if;
  if v_sit <> 'aprovada' then
    v_motivo := interno.txt(p_motivo, 'motivo', 10, 500);
    if regexp_replace(v_motivo, '[\s.\-()/]', '', 'g') ~ '\d{8,}' or v_motivo ~* '[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}' then perform interno.erro('dado_pessoal'); end if;
  end if;
  -- O codinome: o mesmo de sempre não chama a regra de novo (nem gasta o limite dela).
  select * into f from perfis where id = v;
  v_nome := btrim(regexp_replace(coalesce(p_codinome, ''), '\s+', ' ', 'g'));
  if not (f.rede_codinome_ok and f.rede_codinome = v_nome) then perform public.rede_codinome_definir(v_nome); end if;
  -- 18+ e consentimento (a mesma função da primeira entrada; grava a versão das normas).
  if not (f.rede_18 and f.rede_consentimento = p_versao
          and exists (select 1 from rede_consentimentos c where c.usuario = v and c.versao = p_versao and c.revogado_em is null)) then
    perform public.rede_aderir(p_maior, p_versao);
  end if;
  if v_sit <> 'aprovada' then
    insert into alumia_entrada (usuario, situacao, origem, motivo_pedido, pedido_em, tentativas)
    values (v, 'em_analise', 'cadastro', v_motivo, now(), 1)
    on conflict (usuario) do update set situacao = 'em_analise', motivo_pedido = excluded.motivo_pedido, pedido_em = now(),
      tentativas = least(alumia_entrada.tentativas + case when alumia_entrada.situacao = 'em_analise' then 0 else 1 end, 99),
      decidido_em = null, decidido_por = null, motivo_decisao = null;
  end if;
  perform interno.registrar('alumia_pedir', '', jsonb_build_object('direto', v_sit = 'aprovada'));
  return public.alumia_entrada_eu();
end $$;

-- 5. A triagem (painel) ─────────────────────────────────────────────────────────────────────────────────────────────────────

/** Quantos pedidos esperam (o número do menu do painel). Só a triagem; para os outros, nulo. */
create or replace function public.alumia_triagem_contagem() returns integer language plpgsql stable security definer set search_path = interno, pg_temp as $$
begin
  if not interno.alumia_triagem_pode() then return null; end if;
  return (select count(*)::integer from alumia_entrada where situacao = 'em_analise');
end $$;

/**
 * A fila: os pedidos em análise (os mais antigos primeiro, até 200) e os decididos nos últimos 30 dias. Cada pedido: o número da
 * ficha, o codinome, o motivo, quando pediu, quantas vezes pediu e há quantos dias a conta existe. Nada de e-mail, nome civil ou
 * IP. Só coordenação, vice-coordenação e mediação, em sessão com o segundo fator.
 */
create or replace function public.alumia_triagem_fila() returns jsonb language plpgsql volatile security definer set search_path = interno, pg_temp as $$
begin
  if not interno.alumia_triagem_pode() then perform interno.erro('sem_permissao'); end if;
  perform interno.limite('alumia_triagem_ler', 240, 60);
  -- O motivo de quem já foi decidido some 30 dias depois (o pedido não precisa mais dele).
  update alumia_entrada set motivo_pedido = null where motivo_pedido is not null and decidido_em < now() - interval '30 days';
  return jsonb_build_object(
    'pendentes', coalesce((select jsonb_agg(x.j order by x.pedido_em) from (
      select e.pedido_em, jsonb_build_object(
        'id', e.id, 'codinome', coalesce(f.rede_codinome, '—'), 'motivo', e.motivo_pedido, 'pedido_em', e.pedido_em, 'vezes', e.tentativas,
        'conta_dias', greatest(0, extract(day from now() - coalesce((select u.created_at from auth.users u where u.id = e.usuario), e.pedido_em))::integer)) as j
      from alumia_entrada e join perfis f on f.id = e.usuario
      where e.situacao = 'em_analise' and not f.suspenso order by e.pedido_em limit 200) x), '[]'::jsonb),
    'decididos', coalesce((select jsonb_agg(x.j order by x.decidido_em desc) from (
      select e.decidido_em, jsonb_build_object(
        'id', e.id, 'codinome', coalesce(f.rede_codinome, '—'), 'situacao', e.situacao, 'motivo_decisao', e.motivo_decisao, 'decidido_em', e.decidido_em) as j
      from alumia_entrada e join perfis f on f.id = e.usuario
      where e.origem = 'cadastro' and e.situacao <> 'em_analise' and e.decidido_em > now() - interval '30 days' order by e.decidido_em desc limit 200) x), '[]'::jsonb));
end $$;

/**
 * Aprovar ou recusar um pedido (também tirar a aprovação de quem já entrou: recusar com o motivo). Recusar pede o motivo (10 a
 * 500 letras), que a pessoa recebe no aviso. Ninguém decide o próprio pedido. Vai ao registro de atividades.
 */
create or replace function public.alumia_triagem_decidir(p_id uuid, p_aprovar boolean, p_motivo text default '') returns jsonb
language plpgsql volatile security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); e alumia_entrada; v_motivo text;
begin
  if not interno.alumia_triagem_pode() then perform interno.erro('sem_permissao'); end if;
  perform interno.limite('alumia_triagem_decidir', 120, 60);
  select * into e from alumia_entrada where id = p_id for update;
  if not found then perform interno.erro('nao_encontrado'); end if;
  if e.usuario = v then perform interno.erro('proprio_pedido'); end if;
  if coalesce(p_aprovar, false) then
    v_motivo := nullif(btrim(coalesce(p_motivo, '')), '');
    if v_motivo is not null then v_motivo := interno.txt(v_motivo, 'motivo', 1, 500); end if;
  else
    v_motivo := interno.txt(p_motivo, 'motivo', 10, 500);
  end if;
  update alumia_entrada set situacao = case when coalesce(p_aprovar, false) then 'aprovada' else 'recusada' end,
    decidido_em = now(), decidido_por = v, motivo_decisao = v_motivo
  where id = p_id;
  perform interno.avisar_em(e.usuario, case when coalesce(p_aprovar, false)
    then 'Sua entrada na Alumia foi aprovada. Falta só cadastrar o aplicativo autenticador para ver a rede.'
    else 'Seu pedido de entrada na Alumia não foi aceito. Motivo: ' || v_motivo end, 'conta');
  perform interno.registrar('alumia_triagem', p_id::text, jsonb_build_object('aprovar', coalesce(p_aprovar, false)));
  return jsonb_build_object('id', p_id, 'situacao', case when coalesce(p_aprovar, false) then 'aprovada' else 'recusada' end);
end $$;

-- 6. Permissões ─────────────────────────────────────────────────────────────────────────────────────────────────────────────
revoke all on function interno.alumia_exigida(), interno.alumia_situacao(uuid), interno.alumia_aprovada(uuid), interno.alumia_sessao_ok(),
  interno.alumia_triagem_pode(), interno.alumia_aprovar_quem_ja_era(), interno.alumia_entrada_ligar(boolean) from public;
revoke all on function public.alumia_entrada_eu(), public.alumia_entrada_pedir(text, text, boolean, integer, boolean), public.alumia_triagem_contagem(),
  public.alumia_triagem_fila(), public.alumia_triagem_decidir(uuid, boolean, text) from public;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on function interno.alumia_exigida(), interno.alumia_situacao(uuid), interno.alumia_aprovada(uuid), interno.alumia_sessao_ok(),
      interno.alumia_triagem_pode(), interno.alumia_aprovar_quem_ja_era(), interno.alumia_entrada_ligar(boolean) from anon, authenticated;
    revoke all on function public.alumia_entrada_pedir(text, text, boolean, integer, boolean), public.alumia_triagem_contagem(),
      public.alumia_triagem_fila(), public.alumia_triagem_decidir(uuid, boolean, text) from anon;
    grant execute on function public.alumia_entrada_eu() to anon, authenticated, service_role;
    grant execute on function public.alumia_entrada_pedir(text, text, boolean, integer, boolean), public.alumia_triagem_contagem(),
      public.alumia_triagem_fila(), public.alumia_triagem_decidir(uuid, boolean, text) to authenticated, service_role;
  end if;
end $$;
