-- Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
-- Alumia · Prompt 5 · notificações, convites, perfil e selos (26/11/2026).
-- Roda depois de 20261125-r3-fim.sql (banco na versão 16) e das migrações do Prompt 5 que vêm antes no install.sql; o
-- 20261126-p5-fim.sql vem por último. Pode rodar mais de uma vez, sem apagar dado nenhum. Não mexe em rede_alumia_versao nem na lista de exceções
-- da porta: as funções novas passam pela porta (interno.alumia_trancar() no fim).
--
--  1. NOTIFICAÇÕES (A8). A aba de avisos da Alumia vira Notificações: só o que acontece na rede (respondeu, mencionou, citou,
--     seguiu, acendeu, moderação...). Os avisos da conta (entrada nova, aplicativo autenticador novo, entrada aprovada) saem dela e
--     vão para a Segurança (public.rede_aviso_seguranca_listar e _ler), com o número de não lidos no emblema do menu
--     (public.rede_alumia_emblemas → "seguranca"). O mesmo aviso sem tipo ou de moderação, com o mesmo texto no mesmo dia, vira um
--     grupo só (o mesmo aviso quatro vezes não aparece quatro vezes). Quem não aparece pelo nome (perfil invisível) segue sem nome,
--     agora numa função só (interno.rede_aviso_nome_visivel), onde as escolhas de privacidade do Prompt 4 entram depois. Nos tipos
--     que nunca dizem quem fez (acender, reagir ao story), o banco não manda número abaixo de 3: manda 1 ("alguém").
--  2. CONVITES (A18). 10 por mês (o número da coordenação, se ela já tinha trocado o 3, fica). Cancelar um convite aberto tira o
--     convite do banco (como o usado) e devolve a vaga do mês: o código cancelado não vale mais, então ninguém passa de 10 convites
--     que valem no mês. A tela antiga dizia "restam 2 de 3" com um cancelado: o cancelado gastava a vaga e ficava na lista.
--  3. PERFIL E SELOS (A10). O papel de coordenação (interno.papeis, nunca e-mail no código) ganha o selo "coordenacao", troca o
--     nome, o @ e a foto sem os limites de tempo e pode usar os nomes reservados ao instituto; cada uso fica no registro de ações.
--     A equipe já tinha o selo "equipe" automático pelo papel (interno.rede3_perfil_selos), que some quando o papel sai. Nomes e
--     codinomes não aceitam símbolos parecidos com o selo (✓ ✔ ☑ ✅ 🔵 e afins) em nenhum caminho (gatilho em interno.perfis), e um
--     nome novo quase igual ao de uma conta verificada abre uma denúncia automática para a moderação (sem quem denunciou).
--     O que a coordenação NÃO ganha: ler conversa cifrada, ver voto, puxar lista de pessoas ou o e-mail de outra conta. Nada daqui
--     lê qualquer uma dessas coisas.
--
-- Funções que já existiam e são redefinidas aqui (a última definição, completa, tirada do banco montado com o install.sql):
--   interno.rede3_aviso_grupos, public.rede_aviso_ler, public.rede_aviso_listar, public.rede_alumia_emblemas,
--   public.alumia_convite_criar, public.alumia_convites_meus, public.alumia_convite_cancelar, interno.rede3_perfil_selos,
--   public.rede_codinome_definir, public.rede_perfil_handle_definir, public.rede_identidade_publicar,
--   public.rede_perfil_imagem_enviar, public.rede_identidade_foto_enviar.
-- Endereço de rede: nada daqui lê ou guarda. Texto de post: nenhum aviso daqui leva trecho de post. Teste: scripts/testar-p5-avisos.mjs.

-- ═══════════════════════ 1. Notificações ═══════════════════════════════════════════════════════════════════════════════════

/**
 * Pode dizer o nome de quem fez, numa notificação? Hoje: não, se a pessoa está invisível. As escolhas de privacidade do Prompt 4
 * (esconder curtidas, esconder seguidores) entram aqui, num lugar só.
 */
create or replace function interno.rede_aviso_nome_visivel(p_ator uuid, p_tipo text) returns boolean
language sql stable security definer set search_path = interno, pg_temp as $$
  select coalesce((select not (f.rede_modo = 'invisivel' or f.rede_invisivel) from perfis f where f.id = p_ator), false)
    and coalesce(p_tipo, '') not in ('apoio', 'ajudou', 'reacao_story', 'lembrete', 'fed_curtida', 'fed_impulso')
$$;

/**
 * A chave do grupo. A de sempre (interno.rede3_aviso_chave), menos nos avisos sem tipo e nos de moderação: o mesmo texto no mesmo
 * dia (hora de Brasília) é um grupo só. Assim uma ação repetida não enche a tela com o mesmo aviso.
 */
create or replace function interno.rede_aviso_chave_p5(p_tipo text, p_post uuid, p_id uuid, p_texto text, p_criado timestamptz) returns text
language sql immutable as $$
  select case when p_tipo is null or p_tipo = 'moderacao'
              then 't:' || coalesce(p_tipo, '') || ':' || md5(coalesce(p_texto, '')) || ':' || ((p_criado at time zone 'America/Sao_Paulo')::date)::text
              else interno.rede3_aviso_chave(p_tipo, p_post, p_id) end
$$;

-- Os grupos da tela de Notificações: só a categoria 'rede' (os avisos da conta moram na Segurança).
create or replace function interno.rede3_aviso_grupos(p_quem uuid, p_desde timestamptz default null)
returns table (chave text, tipo text, post uuid, alvo uuid, titulo text, total integer, pessoas integer, ultimo timestamptz, lido boolean, id uuid, ator uuid, atores uuid[], texto text, ids uuid[])
language sql stable security definer set search_path = interno, pg_temp as $$
  with u as (
    select a.* from avisos a
    where a.para = p_quem and a.categoria = 'rede' and (p_desde is null or a.criado_em >= p_desde)
    order by a.criado_em desc, a.id desc limit 200
  ), v as (
    select u.*, interno.rede_aviso_chave_p5(u.tipo, u.post, u.id, u.texto, u.criado_em) as chave, case when u.tipo = 'moderacao' then null else p.titulo end as ptitulo
    from u left join rede_posts p on p.id = coalesce(u.alvo, u.post)
    where (u.post is null or u.tipo = 'moderacao'
           or (p.id is not null and interno.rede_ve(p, p_quem) and p.apagado_em is null and (not (p.oculto or p.retido) or p.autor = p_quem) and not interno.rede_silenciado(p, p_quem)))
      and (u.ator is null or (not interno.rede_bloqueado(p_quem, u.ator)
           and not exists (select 1 from rede_silenciados s where s.usuario = p_quem and s.pessoa = u.ator and (s.ate is null or s.ate > now()))))
  )
  select g.chave, g.tipo, g.post, g.alvo, g.ptitulo, g.total, g.pessoas, g.ultimo, g.lido, g.id, g.ator,
    (select array_agg(x.ator) from (select w.ator from v w where w.chave = g.chave and w.ator is not null group by w.ator order by max(w.criado_em) desc limit 2) x),
    g.texto, g.ids
  from (
    select v.chave,
      (array_agg(v.tipo order by v.criado_em desc, v.id desc))[1] as tipo,
      (array_agg(v.post order by v.criado_em desc, v.id desc))[1] as post,
      (array_agg(v.alvo order by v.criado_em desc, v.id desc))[1] as alvo,
      (array_agg(v.ptitulo order by v.criado_em desc, v.id desc))[1] as ptitulo,
      count(*)::integer as total,
      (count(distinct v.ator) + count(*) filter (where v.ator is null))::integer as pessoas,
      max(v.criado_em) as ultimo,
      bool_and(v.lido) as lido,
      (array_agg(v.id order by v.criado_em desc, v.id desc))[1] as id,
      (array_agg(v.ator order by v.criado_em desc, v.id desc))[1] as ator,
      (array_agg(v.texto order by v.criado_em desc, v.id desc))[1] as texto,
      array_agg(v.id) as ids
    from v group by v.chave
  ) g
  order by g.ultimo desc, g.id desc
$$;

-- Marcar como lido: o grupo (pela chave nova) ou todas as notificações. Os avisos da conta são lidos na Segurança.
create or replace function public.rede_aviso_ler(p_id uuid default null) returns jsonb
language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); v_chave text;
begin
  if p_id is null then
    update avisos set lido = true where para = v and categoria = 'rede' and not lido;
  else
    select interno.rede_aviso_chave_p5(a.tipo, a.post, a.id, a.texto, a.criado_em) into v_chave from avisos a where a.id = p_id and a.para = v and a.categoria = 'rede';
    if v_chave is null then perform interno.erro('nao_encontrado'); end if;
    update avisos set lido = true where para = v and categoria = 'rede' and not lido and interno.rede_aviso_chave_p5(tipo, post, id, texto, criado_em) = v_chave;
  end if;
  return jsonb_build_object('ok', true, 'nao_lidos', (select count(*)::integer from interno.rede3_aviso_grupos(v) g where not g.lido));
end $$;

-- A lista de Notificações. Igual à de antes, com o nome decidido por interno.rede_aviso_nome_visivel e, nos tipos sem nome, nenhum
-- número abaixo de 3 (1 = "alguém").
create or replace function public.rede_aviso_listar(p_cursor text default null, p_limite integer default 20) returns jsonb
language plpgsql security definer set search_path = interno, pg_temp as $$
declare
  v uuid := interno.eu();
  v_lim integer := greatest(1, least(coalesce(p_limite, 20), 50));
  v_ts timestamptz; v_id uuid;
  v_itens jsonb; v_mais boolean; v_ultimo text; v_nao integer;
begin
  perform interno.aberta('comunidade');
  perform interno.limite('rede_avisos', 300, 60);
  if p_cursor is not null then
    if p_cursor !~ '^[0-9T:.+ Z-]{10,40},[0-9a-f-]{36}$' then perform interno.erro('invalido:cursor'); end if;
    v_ts := split_part(p_cursor, ',', 1)::timestamptz; v_id := split_part(p_cursor, ',', 2)::uuid;
  end if;
  with todos as materialized (select * from interno.rede3_aviso_grupos(v)),
  pagina as (
    select t.*, row_number() over (order by t.ultimo desc, t.id desc) as pos from todos t
    where v_ts is null or (t.ultimo, t.id) < (v_ts, v_id) order by t.ultimo desc, t.id desc limit v_lim + 1
  )
  select coalesce(jsonb_agg(jsonb_build_object(
      'id', n.id, 'tipo', n.tipo,
      'total', case when n.tipo in ('apoio', 'reacao_story') and n.total < 3 then 1 else interno.rede_fed_aviso_total(n.tipo, n.total) end,
      'pessoas', case when n.tipo in ('apoio', 'reacao_story') and n.pessoas < 3 then 1 else interno.rede_fed_aviso_total(n.tipo, n.pessoas) end,
      'lido', n.lido, 'criado_em', n.ultimo,
      'post', n.post, 'alvo', n.alvo, 'titulo', n.titulo,
      'ator_remoto', interno.rede_fed_aviso_remoto(n.ids) -> 'atores' -> 0,
      'atores_remotos', coalesce(interno.rede_fed_aviso_remoto(n.ids) -> 'atores', '[]'::jsonb),
      'objeto_remoto', interno.rede_fed_aviso_remoto(n.ids) ->> 'objeto',
      'atores', case when n.tipo in ('apoio', 'ajudou', 'reacao_story', 'lembrete') then '[]'::jsonb else (
        select coalesce(jsonb_agg(case when interno.rede_aviso_nome_visivel(f.id, n.tipo) then to_jsonb(interno.rede_nome(f.id)) end order by u.o), '[]'::jsonb)
        from unnest(n.atores) with ordinality u (a, o) join perfis f on f.id = u.a) end,
      -- Aviso antigo sem estrutura que guarda trecho de post no texto (resposta que não casou, "resolveu a dúvida"): o trecho nunca sai,
      -- porque o aviso não passa pela matriz (o post pode ter sido removido ou retido depois).
      'texto', case when n.tipo is null and n.texto ~ ' respondeu ao seu post na (?:Rede L[úu]cia|Alumia): “' then 'Alguém respondeu ao seu post na Alumia.'
                    when n.tipo is null and n.texto ~ '^Sua resposta foi marcada como a que resolveu' then 'Sua resposta foi marcada como a que resolveu uma dúvida na Alumia.'
                    when n.tipo is null or n.tipo in ('chamado', 'nucleo', 'moderacao', 'ato', 'reacao_story', 'lembrete', 'estou_bem', 'detido') then n.texto end) order by n.pos) filter (where n.pos <= v_lim), '[]'::jsonb),
    coalesce(bool_or(n.pos > v_lim), false),
    (select to_char(x.ultimo at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') || ',' || x.id::text from pagina x where x.pos = v_lim),
    (select count(*)::integer from todos where not lido)
  into v_itens, v_mais, v_ultimo, v_nao from pagina n;
  return jsonb_build_object('itens', v_itens, 'proximo', case when v_mais then v_ultimo end, 'nao_lidos', v_nao);
end $$;

/**
 * Os avisos de segurança da conta (entrada nova, aplicativo autenticador novo, entrada aprovada ou recusada), que moram no botão de
 * Segurança. Os 50 mais novos dos últimos 120 dias; o mesmo texto no mesmo dia vem uma vez só, com quantas vezes.
 * Só os da própria pessoa: nenhuma outra conta, nenhum endereço de rede (o aviso nunca guardou IP).
 */
create or replace function public.rede_aviso_seguranca_listar() returns jsonb
language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu();
begin
  perform interno.limite('rede_avisos', 300, 60);
  return (
    with g as (
      select (array_agg(a.id order by a.criado_em desc, a.id desc))[1] as id, min(a.texto) as texto, bool_and(a.lido) as lido,
             max(a.criado_em) as criado_em, count(*)::integer as vezes
      from avisos a
      where a.para = v and a.categoria = 'conta' and a.criado_em > now() - interval '120 days'
      group by md5(a.texto), (a.criado_em at time zone 'America/Sao_Paulo')::date
    )
    select jsonb_build_object(
      'itens', coalesce((select jsonb_agg(jsonb_build_object('id', x.id, 'texto', x.texto, 'lido', x.lido, 'criado_em', x.criado_em, 'vezes', x.vezes) order by x.criado_em desc)
                         from (select * from g order by criado_em desc limit 50) x), '[]'::jsonb),
      'nao_lidos', (select count(*)::integer from g where not g.lido))
  );
end $$;

/** Marca como lidos os avisos de segurança da própria conta. */
create or replace function public.rede_aviso_seguranca_ler() returns jsonb
language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu();
begin
  perform interno.limite('rede_avisos', 300, 60);
  update avisos set lido = true where para = v and categoria = 'conta' and not lido;
  return jsonb_build_object('ok', true, 'nao_lidos', 0);
end $$;

-- Os emblemas do menu: o de Segurança conta os avisos da conta não lidos (grupos por texto e dia, como na lista).
create or replace function public.rede_alumia_emblemas() returns jsonb
language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := auth.uid(); v_avisos integer := 0; v_atos integer := 0; v_seg integer := 0;
begin
  if v is null or not interno.rede2_membro(v) or exists (select 1 from perfis where id = v and suspenso) then
    return jsonb_build_object('avisos', 0, 'conversas', 0, 'atos', 0, 'seguranca', 0);
  end if;
  perform interno.limite('rede_avisos_n', 600, 60);
  v_avisos := (select count(*)::integer from interno.rede3_aviso_grupos(v) g where not g.lido);
  v_seg := (select count(distinct (md5(a.texto), (a.criado_em at time zone 'America/Sao_Paulo')::date))::integer from avisos a
             where a.para = v and a.categoria = 'conta' and not a.lido and a.criado_em > now() - interval '120 days');
  begin
    v_atos := (select count(*)::integer from rede_vou o join rede_posts p on p.id = o.post
      where o.usuario = v and p.chamado is not null and p.apagado_em is null and not p.oculto
        and (p.chamado ->> 'quando') ~ '^\d{4}-\d{2}-\d{2}' and (p.chamado ->> 'quando')::timestamptz > now());
  exception when others then
    v_atos := 0;
  end;
  return jsonb_build_object('avisos', v_avisos, 'conversas', 0, 'atos', v_atos, 'seguranca', v_seg);
end $$;

revoke all on function interno.rede_aviso_nome_visivel(uuid, text), interno.rede_aviso_chave_p5(text, uuid, uuid, text, timestamptz) from public;
revoke all on function public.rede_aviso_seguranca_listar(), public.rede_aviso_seguranca_ler() from public;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on function interno.rede_aviso_nome_visivel(uuid, text), interno.rede_aviso_chave_p5(text, uuid, uuid, text, timestamptz) from anon, authenticated;
    revoke all on function public.rede_aviso_seguranca_listar(), public.rede_aviso_seguranca_ler() from anon;
    grant execute on function public.rede_aviso_seguranca_listar(), public.rede_aviso_seguranca_ler() to authenticated, service_role;
  end if;
end $$;

-- ═══════════════════════ 2. Convites ═══════════════════════════════════════════════════════════════════════════════════════

-- 10 por mês. Só troca o 3 de fábrica: se a coordenação já escolheu outro número no painel, ele fica.
update interno.configuracoes set valor = jsonb_set(valor, '{convites_mes}', '10'::jsonb)
 where chave = 'alumia_cadastro' and coalesce(valor ->> 'convites_mes', '3') = '3';

-- Os cancelados que ainda estão no banco saem dele (como o usado, que já sai na hora); os deste mês devolvem a vaga. Uma vez só:
-- o que saiu não volta a ser contado.
with c as (
  delete from interno.alumia_convites where situacao = 'cancelado' returning criado_por, criado_em
), n as (select criado_por, count(*)::integer as k from c where criado_em >= interno.alumia_convite_mes() group by criado_por)
update interno.alumia_convite_cotas q set gerados = greatest(0, q.gerados - n.k)
  from n where q.criado_por = n.criado_por and q.mes = interno.alumia_convite_mes();

create or replace function public.alumia_convite_criar() returns jsonb
language plpgsql volatile security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); v_teto integer := interno.alumia_cadastro_numero('convites_mes', 10); v_usados integer; v_codigo text; c alumia_convites;
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

-- "usados" = gerados no mês que já saíram do banco (o usado sai na hora; o cancelado também sai, mas devolve a vaga).
create or replace function public.alumia_convites_meus() returns jsonb
language plpgsql stable security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); v_teto integer := interno.alumia_cadastro_numero('convites_mes', 10); v_usados integer;
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

-- Cancelar um convite aberto: ele sai do banco (o código deixa de valer, e nada fica dizendo que existiu) e, se é deste mês, a
-- vaga volta.
create or replace function public.alumia_convite_cancelar(p_id uuid) returns jsonb
language plpgsql volatile security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); v_criado timestamptz; v_teto integer := interno.alumia_cadastro_numero('convites_mes', 10); v_gerados integer;
begin
  delete from alumia_convites where id = p_id and criado_por = v and situacao = 'aberto' returning criado_em into v_criado;
  if not found then perform interno.erro('nao_encontrado'); end if;
  if v_criado >= interno.alumia_convite_mes() then
    update alumia_convite_cotas set gerados = greatest(0, gerados - 1) where criado_por = v and mes = interno.alumia_convite_mes();
  end if;
  v_gerados := coalesce((select gerados from alumia_convite_cotas where criado_por = v and mes = interno.alumia_convite_mes()), 0);
  return jsonb_build_object('ok', true, 'restam', greatest(0, v_teto - v_gerados));
end $$;

-- ═══════════════════════ 3. Perfil e selos ═════════════════════════════════════════════════════════════════════════════════

/** Esta sessão é da coordenação (o papel no banco, confirmado pelo autenticador)? Não vale para a vice nem para outro papel. */
create or replace function interno.alumia_coordenacao() returns boolean language sql stable security definer set search_path = interno, pg_temp as $$
  select interno.tem('coordenacao')
$$;

/**
 * O nome imita o selo de verificado? Os sinais de "visto" e de "marcado" (✓ ✔ ☑ ✅ ✗ 🗸 🗹 √), os círculos e quadrados de cor
 * (🔵 🟦...), o seletor de emoji que transforma um sinal em selo colorido e as palavras "verificado"/"verified"/"oficial".
 */
create or replace function interno.nome_imita_selo(p text) returns boolean language sql immutable as $$
  select coalesce(p, '') ~ '[✓✔☑☒✅✗✘√🗸🗹🗷🔵🔷🔹🟦🟢🟩⚪🆗️⃝⃞]'
      or coalesce(p, '') ~ '[🔴🟠🟡🟣🟤⚫🟥🟧🟨🟪🟫⬛⬜]'
      or interno.rede_chave(p) ~ '(verificad|verified|verifie|oficial|official)'
$$;

/**
 * O esqueleto de um nome, para achar o quase igual: sem acento, sem maiúscula, sem espaço nem pontuação, com as trocas comuns
 * (0→o, 1→l, 3→e, 4→a, 5→s, 7→t, 8→b, @→a, $→s, rn→m, vv→w) e sem letra repetida.
 */
create or replace function interno.nome_esqueleto(p text) returns text language sql immutable as $$
  select regexp_replace(
           replace(replace(regexp_replace(translate(interno.rede_chave(p), '0134578@$|!', 'oleaastbasli'), '[^a-z]', '', 'g'), 'rn', 'm'), 'vv', 'w'),
           '(.)\1+', '\1', 'g')
$$;

/** A pessoa tem o selo de verificado (equipe ou coordenação, pelo papel)? */
create or replace function interno.alumia_verificada(p_id uuid) returns boolean language sql stable security definer set search_path = interno, pg_temp as $$
  select interno.voluntario_e(p_id)
$$;

-- Nenhum caminho grava nome ou codinome com símbolo de selo (a troca de nome, a identidade pública, a reserva).
create or replace function interno.nome_sem_selo_falso() returns trigger
language plpgsql security definer set search_path = interno, pg_temp as $$
begin
  if (tg_op = 'INSERT' or new.rede_codinome is distinct from old.rede_codinome) and interno.nome_imita_selo(new.rede_codinome) then
    perform interno.erro('nome_com_selo');
  end if;
  if (tg_op = 'INSERT' or new.rede_codinome_reserva is distinct from old.rede_codinome_reserva) and interno.nome_imita_selo(new.rede_codinome_reserva) then
    perform interno.erro('nome_com_selo');
  end if;
  return new;
end $$;
drop trigger if exists perfis_nome_sem_selo_falso on interno.perfis;
create trigger perfis_nome_sem_selo_falso before insert or update of rede_codinome, rede_codinome_reserva on interno.perfis
  for each row execute function interno.nome_sem_selo_falso();

/**
 * Nome novo quase igual ao de uma conta verificada (equipe, coordenação ou organização com selo): uma denúncia automática vai para a
 * fila da moderação, sem quem denunciou (quem = nulo) e sem dizer de quem é o nome parecido. Uma por perfil por dia. A troca não é
 * barrada: a moderação decide. Quem é verificado não dispara.
 */
create or replace function interno.nome_parecido_avisar() returns trigger
language plpgsql security definer set search_path = interno, pg_temp as $$
declare v_esq text;
begin
  begin
    if new.rede_codinome is null or new.rede_codinome is not distinct from old.rede_codinome then return null; end if;
    v_esq := interno.nome_esqueleto(new.rede_codinome);
    if char_length(v_esq) < 4 or interno.alumia_verificada(new.id) then return null; end if;
    if not exists (
         select 1 from perfis o
         where o.id <> new.id and o.rede_codinome is not null and interno.nome_esqueleto(o.rede_codinome) = v_esq
           and (interno.alumia_verificada(o.id) or exists (select 1 from rede_orgs g where g.perfil = o.id and g.verificada_em is not null))) then
      return null;
    end if;
    if exists (select 1 from rede_denuncias d where d.alvo_tipo = 'perfil' and d.alvo = new.id::text and d.quem is null
                 and d.texto like 'Sinal automático: nome parecido%' and d.criado_em > now() - interval '1 day') then
      return null;
    end if;
    insert into rede_denuncias (alvo_tipo, alvo, categoria, prioridade, texto, quem)
    values ('perfil', new.id::text, 'golpe', 2,
            'Sinal automático: nome parecido com o de uma conta verificada. Confira se a conta finge ser outra. Nome novo: ' || left(new.rede_codinome, 80), null);
  exception when others then
    -- O sinal nunca impede a troca de nome.
    null;
  end;
  return null;
end $$;
drop trigger if exists perfis_nome_parecido on interno.perfis;
create trigger perfis_nome_parecido after update of rede_codinome on interno.perfis
  for each row execute function interno.nome_parecido_avisar();

-- Os selos do perfil: o de sempre, mais "coordenacao" (o papel no banco) na frente.
create or replace function interno.rede3_perfil_selos(p_id uuid) returns jsonb
language sql stable security definer set search_path = interno, pg_temp as $$
  select coalesce(jsonb_agg(x.s order by x.o, x.s), '[]'::jsonb)
  from (
    select 'coordenacao' as s, 0 as o where exists (select 1 from papeis q join perfis f on f.id = q.usuario where q.usuario = p_id and q.papel = 'coordenacao' and not f.suspenso)
    union all
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

-- Codinome: a coordenação troca quantas vezes quiser e pode usar os nomes do instituto (fica no registro).
create or replace function public.rede_codinome_definir(p_codinome text) returns jsonb
language plpgsql security definer set search_path = interno, pg_temp as $$
declare
  v uuid := interno.eu();
  v_nome text := btrim(regexp_replace(coalesce(p_codinome, ''), '\s+', ' ', 'g'));
  v_chave text; v_civil text; v_coord boolean := interno.alumia_coordenacao();
begin
  if not v_coord then perform interno.limite('rede_codinome', 12, 60); end if;
  if char_length(v_nome) < 3 or char_length(v_nome) > 30 or v_nome !~ '^[[:alpha:]0-9][[:alpha:]0-9 .''_-]*$' or v_nome ~* '(https?|www\.|@)' then
    perform interno.erro('invalido:codinome');
  end if;
  if interno.nome_imita_selo(v_nome) then perform interno.erro('nome_com_selo'); end if;
  v_chave := interno.rede_chave(v_nome);
  if not v_coord and v_chave ~ '(instituto|lucia|moderac|mediac|coordenac|administra|equipe oficial)' then perform interno.erro('codinome_reservado'); end if;
  if interno.voluntario_e(v) and not v_coord then
    v_civil := interno.rede_chave((select nome from perfis where id = v));
    if v_civil <> '' and (v_chave = v_civil or split_part(v_chave, ' ', 1) = split_part(v_civil, ' ', 1) or (position(' ' in v_civil) > 0 and position(v_civil in v_chave) > 0)) then
      perform interno.erro('codinome_civil');
    end if;
  end if;
  if exists (select 1 from perfis o where o.id <> v and interno.rede_chave(o.rede_codinome) = v_chave)
     or exists (select 1 from papeis pa join perfis o on o.id = pa.usuario where o.id <> v and interno.rede_chave(o.nome) = v_chave) then
    perform interno.erro('codinome_usado');
  end if;
  update perfis set rede_codinome = v_nome, rede_codinome_ok = true where id = v;
  perform interno.registrar(case when v_coord then 'alumia_coordenacao_codinome' else 'rede_codinome' end, '', '{}'::jsonb);
  return jsonb_build_object('nome', v_nome, 'codinome_ok', true);
exception when unique_violation then perform interno.erro('codinome_usado');
end $$;

-- O @: a coordenação troca sem esperar os 30 dias (fica no registro).
create or replace function public.rede_perfil_handle_definir(p_handle text) returns jsonb
language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); f perfis; h text := lower(btrim(coalesce(p_handle, ''), ' @')); v_coord boolean := interno.alumia_coordenacao();
begin
  perform interno.rede3_perfil_exige_membro(v);
  if not v_coord then perform interno.limite('rede_perfil_handle', 20, 1440); end if;
  if h !~ '^[a-z0-9_]{3,20}$' then perform interno.erro('invalido:handle'); end if;
  select * into f from perfis where id = v;
  if f.rede_handle = h then return jsonb_build_object('handle', h); end if;
  if h ~ '(instituto|lucia|equipe|coordena|modera|admin|suporte|oficial)' and not interno.voluntario_e(v) then perform interno.erro('handle_reservado'); end if;
  if exists (select 1 from perfis o where o.rede_handle = h and o.id <> v) then perform interno.erro('handle_usado'); end if;
  if not v_coord and f.rede_handle is not null and f.rede_handle_em is not null and f.rede_handle_em > now() - interval '30 days' then perform interno.erro('handle_recente'); end if;
  update perfis set rede_handle = h, rede_handle_em = now() where id = v;
  if v_coord then perform interno.registrar('alumia_coordenacao_handle', '', '{}'::jsonb); end if;
  return jsonb_build_object('handle', h);
exception when unique_violation then perform interno.erro('handle_usado');
end $$;

-- O nome público: a coordenação pode usar o nome do instituto e trocar sem o limite do dia (fica no registro).
create or replace function public.rede_identidade_publicar(p_nome text, p_ciente boolean) returns jsonb
language plpgsql security definer set search_path = interno, pg_temp as $$
declare
  v uuid := interno.eu(); f perfis;
  v_nome text := btrim(regexp_replace(coalesce(p_nome, ''), '\s+', ' ', 'g'));
  v_chave text; v_coord boolean := interno.alumia_coordenacao();
begin
  perform interno.aberta('comunidade');
  perform interno.rede3_perfil_exige_membro(v);
  if not interno.alumia_identidade_publica_ligada() then perform interno.erro('identidade_desligada'); end if;
  if exists (select 1 from rede_orgs o where o.perfil = v) then perform interno.erro('identidade_org'); end if;
  if not coalesce(p_ciente, false) then perform interno.erro('confirme_ciencia'); end if;
  if not v_coord then perform interno.limite('alumia_identidade', 8, 1440); end if;
  if char_length(v_nome) < 2 or char_length(v_nome) > 60 or v_nome !~ '^[[:alpha:]][[:alpha:] .''’-]*[[:alpha:].]$' or v_nome ~* '(https?|www\.)' then
    perform interno.erro('invalido:nome');
  end if;
  if interno.nome_imita_selo(v_nome) then perform interno.erro('nome_com_selo'); end if;
  v_chave := interno.rede_chave(v_nome);
  if not v_coord and v_chave ~ '(instituto lucia|alumia|moderac|mediac|coordenac|administra|equipe oficial|suporte)' then perform interno.erro('nome_reservado'); end if;
  -- O codinome em uso é público (aparece em todo post): dizer que está em uso não revela nada.
  if exists (select 1 from perfis o where o.id <> v and o.rede_identidade = 'codinome' and interno.rede_chave(o.rede_codinome) = v_chave) then
    perform interno.erro('nome_usado');
  end if;
  if exists (select 1 from perfis o where o.id <> v and interno.rede_chave(o.rede_codinome_reserva) = v_chave) then
    perform interno.erro('invalido:nome');
  end if;
  if (interno.veredito(v_nome, false, v) ->> 'veredito') <> 'publicar' then perform interno.erro('invalido:nome'); end if;

  select * into f from perfis where id = v for update;
  -- Marca a transação: só daqui o nome de quem está em público muda (interno.alumia_identidade_guarda).
  perform set_config('alumia.identidade_troca', '1', true);
  if f.rede_identidade = 'publica' then
    update perfis set rede_codinome = v_nome where id = v;
  else
    update perfis set rede_identidade = 'publica', rede_codinome_reserva = f.rede_codinome, rede_codinome = v_nome, rede_identidade_dia = current_date where id = v;
  end if;
  perform set_config('alumia.identidade_troca', '', true);
  perform interno.alumia_identidade_trocar_nome(v, f.rede_codinome, v_nome);
  -- O registro guarda só que a escolha mudou, nunca o nome.
  perform interno.registrar(case when v_coord then 'alumia_coordenacao_identidade' else 'rede_identidade' end, '', jsonb_build_object('modo', 'publica'));
  return interno.alumia_identidade_minha(v);
end $$;

-- A foto e a capa: a da coordenação já entrava aceita (interno.cuida); agora também sem o limite do dia (fica no registro).
create or replace function public.rede_perfil_imagem_enviar(p_tipo text, p_dados text) returns jsonb
language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); v_ok boolean; v_coord boolean := interno.alumia_coordenacao();
begin
  perform interno.rede3_perfil_exige_membro(v);
  if p_tipo not in ('avatar', 'capa') then perform interno.erro('invalido:tipo'); end if;
  if not v_coord then perform interno.limite('rede_perfil_imagem', 10, 1440); end if;
  if not interno.rede3_perfil_webp_ok(p_dados, case when p_tipo = 'avatar' then 40000 else 90000 end) then perform interno.erro('invalido:imagem'); end if;
  v_ok := interno.cuida();
  if p_tipo = 'avatar' then
    update perfis set rede_avatar = 'envio', rede_avatar_dados = p_dados, rede_avatar_ok = v_ok where id = v;
  else
    update perfis set rede_capa = 'envio', rede_capa_dados = p_dados, rede_capa_ok = v_ok where id = v;
  end if;
  if v_coord then perform interno.registrar('alumia_coordenacao_imagem', p_tipo, '{}'::jsonb); end if;
  return interno.rede3_perfil_meu(v);
end $$;

create or replace function public.rede_identidade_foto_enviar(p_dados text) returns jsonb
language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); v_coord boolean := interno.alumia_coordenacao();
begin
  perform interno.aberta('comunidade');
  perform interno.rede3_perfil_exige_membro(v);
  if not interno.alumia_identidade_publica_ligada() then perform interno.erro('identidade_desligada'); end if;
  if not exists (select 1 from perfis where id = v and rede_identidade = 'publica') then perform interno.erro('identidade_codinome'); end if;
  if not v_coord then perform interno.limite('rede_perfil_imagem', 10, 1440); end if;
  if not interno.rede3_perfil_webp_ok(p_dados, 40000) then perform interno.erro('invalido:imagem'); end if;
  update perfis set rede_avatar = 'envio', rede_avatar_dados = p_dados, rede_avatar_ok = interno.cuida() where id = v;
  if v_coord then perform interno.registrar('alumia_coordenacao_imagem', 'identidade', '{}'::jsonb); end if;
  return interno.alumia_identidade_minha(v);
end $$;

revoke all on function interno.alumia_coordenacao(), interno.nome_imita_selo(text), interno.nome_esqueleto(text), interno.alumia_verificada(uuid),
  interno.nome_sem_selo_falso(), interno.nome_parecido_avisar() from public;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on function interno.alumia_coordenacao(), interno.nome_imita_selo(text), interno.nome_esqueleto(text), interno.alumia_verificada(uuid),
      interno.nome_sem_selo_falso(), interno.nome_parecido_avisar() from anon, authenticated;
  end if;
end $$;

-- ── A porta ─────────────────────────────────────────────────────────────────────────────────────────────────────────────
-- create or replace tira a porta das redefinidas; esta linha a devolve, e põe nas novas. "abertas" tem de vir vazia.
select interno.alumia_trancar();
