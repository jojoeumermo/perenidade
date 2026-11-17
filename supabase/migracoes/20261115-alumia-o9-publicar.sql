-- ───────────────────────────── Alumia: público e vida do post, onda 9, frente 9D ─────────────────────────────
-- Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
--
-- Quem vê um post e quanto tempo ele vive, escolhido por quem escreve:
--
--   Só a minha roda   publico = 'roda': o post é só de quem está na roda de confiança da autora (interno.rede_roda, a mesma lista
--                     do story "Só para a roda"). A lista é dela: ninguém lê, ninguém é avisado de entrar ou sair, ninguém sabe em
--                     que rodas está. As respostas seguem a roda de quem abriu a conversa. Nunca sai no Fediverso.
--   Não listado       nao_listado = true: vale dentro do público escolhido, mas não entra em linha, busca, aba nem aviso de
--                     menção; quem tem o link abre. Com a trava da entrada ligada, o link só abre para conta aprovada (troca por
--                     princípio, L3-2).
--   Arquivar          arquivado_em: o post some para todo mundo menos a autora, que o vê na lista dos arquivados e desarquiva
--                     quando quiser. Arquivar tira o post do Fediverso e ele não volta para lá (fora_do_fediverso).
--   Some sozinho      expira_em (a coluna do contrato da F0): 24 horas ou 7 dias. Vencido, ninguém mais vê, e o agendador do banco
--                     (pg_cron, a cada 10 minutos) apaga de verdade: o post, a mídia (pela fila de arquivos da onda 8, que o
--                     servidor do site esvazia pela API do depósito) e o histórico de edição.
--   Apagar depois     interno.rede_vida_conta: opção da conta. Posts mais velhos que X semanas somem sozinhos, pela mesma rodada.
--
-- O que outras pessoas responderam ou citaram não some junto: o post de cima fica como "[post apagado]" (sem autora, sem texto,
-- sem mídia), a mesma regra do apagar a conta (20261114-alumia-o8-meusdados.sql).
--
-- A regra de quem vê é FUNÇÃO PRÓPRIA, para quem junta compor numa ordem só (nenhuma frente redefine interno.rede_ve inteira):
--   interno.rede_vida_ve(post, quem)           nulo = sem opinião; false = não vê; true = vê (só para 'roda'). Entra em
--                                              interno.rede2_pode_ver depois das travas de comunidade e antes do "case" do público.
--   interno.rede_vida_fora_da_lista(post, quem) true = fica fora das listas (não listado de outra pessoa, ou arquivado). Entra em
--                                              interno.rede_silenciado com "or".
--   interno.rede_vida_federa(post)             false = não sai no Fediverso. Entra em interno.rede_fed_federavel (Faixa 2).
-- Até a composição, o post 'roda' fica só com a autora (o "case" do público cai no "else false"), o arquivado e o vencido
-- continuam visíveis a quem já via e o não listado aparece nas listas: nada fica MAIS aberto do que a pessoa escolheu, menos o
-- arquivado e o não listado, que dependem da composição para valer. O texto da composição está em docs/rede/VIDA-DO-POST.md.
--
-- Tabelas em interno, RLS ligada e sem política, nenhuma permissão direta. Nenhuma função devolve lista de pessoas (a roda já tem
-- as dela, de 20261110-alumia-b1-stories.sql, só para a dona). Pode rodar mais de uma vez, sem apagar dado nenhum. Roda DEPOIS da
-- onda 8. Teste: scripts/testar-alumia-o9-publicar.mjs.

-- 1. Colunas e regras da tabela ────────────────────────────────────────────────────────────────────────────────────────────

alter table interno.rede_posts add column if not exists nao_listado boolean not null default false;
alter table interno.rede_posts add column if not exists arquivado_em timestamptz;
alter table interno.rede_posts add column if not exists fora_do_fediverso boolean not null default false;
create index if not exists rede_posts_arquivados on interno.rede_posts (autor, arquivado_em desc) where arquivado_em is not null;

-- O público ganha 'roda'; o "alcance" da Rede de antes ganha 'roda' também, para a regra antiga (interno.rede_ve de um argumento)
-- não entregar o post da roda a ninguém além da autora.
do $$
declare r record;
begin
  if exists (select 1 from pg_constraint where conrelid = 'interno.rede_posts'::regclass and conname = 'rede_posts_publico'
             and pg_get_constraintdef(oid) !~ 'roda') then
    alter table interno.rede_posts drop constraint rede_posts_publico;
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'interno.rede_posts'::regclass and conname = 'rede_posts_publico') then
    alter table interno.rede_posts add constraint rede_posts_publico
      check (publico is null or publico in ('internet', 'membros', 'seguidores', 'comunidade', 'nucleo', 'equipe', 'roda'));
  end if;
  for r in select conname from pg_constraint where conrelid = 'interno.rede_posts'::regclass and contype = 'c'
             and pg_get_constraintdef(oid) ~* 'alcance' and pg_get_constraintdef(oid) !~ 'roda' loop
    execute format('alter table interno.rede_posts drop constraint %I', r.conname);
  end loop;
  if not exists (select 1 from pg_constraint where conrelid = 'interno.rede_posts'::regclass and conname = 'rede_posts_alcance_v9') then
    alter table interno.rede_posts add constraint rede_posts_alcance_v9 check (alcance in ('publico', 'seguidores', 'equipe', 'roda'));
  end if;
  -- Só post da roda tem alcance 'roda', e vice-versa.
  if not exists (select 1 from pg_constraint where conrelid = 'interno.rede_posts'::regclass and conname = 'rede_posts_roda_alcance') then
    alter table interno.rede_posts add constraint rede_posts_roda_alcance check ((publico = 'roda') = (alcance = 'roda'));
  end if;
end $$;

-- A opção da conta: apagar sozinho o que for mais velho que X semanas. Uma linha por pessoa, só enquanto a opção está ligada.
create table if not exists interno.rede_vida_conta (
  usuario uuid primary key references interno.perfis (id) on delete cascade,
  semanas smallint not null check (semanas in (1, 2, 4, 8, 12, 26, 52)),
  desde timestamptz not null default now()
);
do $$
begin
  alter table interno.rede_vida_conta enable row level security;
  revoke all on table interno.rede_vida_conta from public;
  if exists (select 1 from pg_roles where rolname = 'anon') then revoke all on table interno.rede_vida_conta from anon, authenticated; end if;
end $$;

-- 2. Quem vê (funções próprias, para quem junta compor) ─────────────────────────────────────────────────────────────────────

/**
 * A parte desta frente na regra de quem vê um post. Nulo: sem opinião (segue a regra de sempre). Quem escreveu: sempre nulo (a
 * regra de sempre já deixa a autora ver o que é dela). Arquivado ou vencido: ninguém mais. Não listado com a trava ligada: só conta
 * aprovada. Roda: só quem está na roda de quem abriu a conversa (e ela própria), conta aprovada quando a trava está ligada.
 */
create or replace function interno.rede_vida_ve(p interno.rede_posts, p_quem uuid) returns boolean language plpgsql stable security definer set search_path = interno, pg_temp as $$
declare v_dono uuid;
begin
  if p is null or p.id is null then return null; end if;
  if p_quem is not null and p.autor = p_quem then return null; end if;
  if p.arquivado_em is not null then return false; end if;
  if p.expira_em is not null and p.expira_em <= now() then return false; end if;
  if p.nao_listado and interno.alumia_exigida() and not interno.rede2_membro(p_quem) then return false; end if;
  if p.publico = 'roda' then
    if p_quem is null then return false; end if;
    if interno.alumia_exigida() and not interno.rede2_membro(p_quem) then return false; end if;
    v_dono := coalesce((select r.autor from rede_posts r where r.id = p.root_id), p.autor);
    if v_dono is null then return false; end if;
    return p_quem = v_dono or exists (select 1 from rede_roda x where x.dono = v_dono and x.membro = p_quem);
  end if;
  return null;
end $$;

/** Fica fora das listas (linha, abas, busca, perfil, aviso de menção)? O arquivado, para todos; o não listado, para quem não escreveu. */
create or replace function interno.rede_vida_fora_da_lista(p interno.rede_posts, p_quem uuid) returns boolean language sql stable security definer set search_path = interno, pg_temp as $$
  select p.id is not null and (p.arquivado_em is not null or (p.nao_listado and p.autor is distinct from p_quem))
$$;

/** Pode sair no Fediverso? Nunca o não listado, o arquivado (nem depois de desarquivar), o que some sozinho e o da roda. */
create or replace function interno.rede_vida_federa(p interno.rede_posts) returns boolean language sql stable security definer set search_path = interno, pg_temp as $$
  select p.id is not null and not (p.nao_listado or p.fora_do_fediverso or p.arquivado_em is not null or p.expira_em is not null or coalesce(p.publico, '') = 'roda')
$$;

/**
 * A pessoa tem a federação ligada (o perfil sai no Fediverso)? Lida pela tabela da Faixa 2, quando ela existe. Enquanto
 * interno.rede_fed_federavel não chamar interno.rede_vida_federa, o não listado e o some sozinho ficam recusados para essa pessoa.
 */
create or replace function interno.rede_vida_federacao_ligada(p_quem uuid) returns boolean language plpgsql stable security definer set search_path = interno, pg_temp as $$
declare v boolean := false;
begin
  if p_quem is null or to_regclass('interno.rede_fed_atores') is null then return false; end if;
  -- Quando a Faixa 2 compuser a vida do post na federação, a regra dela já basta.
  if position('rede_vida_federa' in coalesce((select prosrc from pg_proc where oid = to_regprocedure('interno.rede_fed_federavel(interno.rede_posts, integer)')), '')) > 0 then
    return false;
  end if;
  execute 'select coalesce(bool_or(a.ligado), false) from interno.rede_fed_atores a where a.perfil = $1' into v using p_quem;
  return coalesce(v, false);
end $$;

-- 3. Publicar com as escolhas novas ─────────────────────────────────────────────────────────────────────────────────────────

/**
 * Antes de gravar o post: aplica as escolhas que public.rede_pub_vida_publicar deixou na transação (roda, não listado, prazo),
 * só no post de primeiro nível da própria autora. Roda aqui, e não depois, para os avisos (menção, conversa seguida) já verem o post
 * como ele é: com público 'roda', só quem está na roda pode ser avisado. Todo post 'roda' (as respostas herdam) tem alcance 'roda'.
 */
create or replace function interno.rede_vida_nasce() returns trigger language plpgsql security definer set search_path = interno, pg_temp as $$
declare c jsonb;
begin
  begin
    c := nullif(current_setting('alumia.vida', true), '')::jsonb;
  exception when others then
    c := null;
  end;
  if c is not null and new.resposta_a is null and new.autor is not null and new.autor = nullif(c ->> 'autor', '')::uuid then
    if coalesce((c ->> 'roda')::boolean, false) then
      new.publico := 'roda';
      new.nucleo := null;
    end if;
    if coalesce((c ->> 'nao_listado')::boolean, false) then new.nao_listado := true; end if;
    if nullif(c ->> 'expira_em', '') is not null then new.expira_em := (c ->> 'expira_em')::timestamptz; end if;
  end if;
  if new.publico = 'roda' then new.alcance := 'roda'; end if;
  return new;
end $$;
drop trigger if exists rede_vida_nasce on interno.rede_posts;
create trigger rede_vida_nasce before insert on interno.rede_posts for each row execute function interno.rede_vida_nasce();

/**
 * Publicar com o que esta frente acrescenta ao pedido de public.rede_pub_publicar_mais (que continua conferindo tudo):
 *   p.publico = 'roda'   só a minha roda (sem comunidade, sem núcleo; a roda precisa ter alguém: erro 'roda_vazia');
 *   p.nao_listado        true: não entra em linha nem busca (não vale para a roda, que já não é de lista);
 *   p.some_em            '24h' ou '7d': o post some sozinho depois disso.
 * Com a federação ligada, não listado e some sozinho dão 'vida_federacao' (até a Faixa 2 compor interno.rede_vida_federa).
 * Resposta não escolhe nada disso: segue a conversa. Devolve o post como rede_pub_publicar_mais, mais nao_listado e expira_em.
 */
create or replace function public.rede_pub_vida_publicar(p jsonb) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare
  v uuid := interno.eu();
  v_roda boolean; v_nao_listado boolean := false; v_some text; v_expira timestamptz; v_pedido jsonb; v_post jsonb;
begin
  perform interno.aberta('comunidade');
  if p is null or jsonb_typeof(p) is distinct from 'object' then perform interno.erro('invalido:post'); end if;
  if p ? 'nao_listado' and jsonb_typeof(p -> 'nao_listado') not in ('boolean', 'null') then perform interno.erro('invalido:nao_listado'); end if;
  v_roda := coalesce(p ->> 'publico', '') = 'roda';
  v_nao_listado := coalesce((p ->> 'nao_listado')::boolean, false);
  v_some := nullif(btrim(coalesce(p ->> 'some_em', '')), '');
  if v_some is not null and v_some not in ('24h', '7d') then perform interno.erro('invalido:some_em'); end if;
  v_expira := case v_some when '24h' then now() + interval '24 hours' when '7d' then now() + interval '7 days' end;
  if nullif(p ->> 'resposta_a', '') is not null and (v_roda or v_nao_listado or v_some is not null) then perform interno.erro('invalido:publico'); end if;
  -- Não listado e some sozinho ficam fora do Fediverso só quando a federação compuser interno.rede_vida_federa (a
  -- migração da vida do post no Fediverso). Até lá, quem tem a federação ligada não escolhe nenhum dos dois: o post sairia como
  -- público e ficaria copiado do lado de lá.
  if (v_nao_listado or v_some is not null) and not v_roda and interno.rede_vida_federacao_ligada(v) then
    perform interno.erro('vida_federacao');
  end if;
  if v_roda then
    if nullif(btrim(coalesce(p ->> 'comunidade', '')), '') is not null or nullif(p ->> 'nucleo', '') is not null then perform interno.erro('invalido:publico'); end if;
    if not exists (select 1 from rede_roda r where r.dono = v) then perform interno.erro('roda_vazia'); end if;
    v_nao_listado := false;
  end if;
  v_pedido := p - 'nao_listado' - 'some_em';
  -- A conferência do público é a de "seguidores" (o mais fechado sem comunidade); o gatilho troca para 'roda' antes de gravar.
  if v_roda then v_pedido := v_pedido || jsonb_build_object('publico', 'seguidores'); end if;
  perform set_config('alumia.vida', jsonb_build_object('autor', v, 'roda', v_roda, 'nao_listado', v_nao_listado, 'expira_em', v_expira)::text, true);
  begin
    v_post := public.rede_pub_publicar_mais(v_pedido);
  exception when others then
    perform set_config('alumia.vida', '', true);
    raise;
  end;
  perform set_config('alumia.vida', '', true);
  return v_post || jsonb_build_object('nao_listado', v_nao_listado, 'expira_em', v_expira);
end $$;

-- 4. Arquivar ───────────────────────────────────────────────────────────────────────────────────────────────────────────────

/** Arquiva (p_sim) ou desarquiva um post meu. Arquivado, sai do Fediverso e não volta para lá. */
create or replace function public.rede_pub_arquivar(p_post uuid, p_sim boolean default true) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); v_sim boolean := coalesce(p_sim, true);
begin
  perform interno.aberta('comunidade');
  perform interno.limite('rede_pub_arquivar', 120, 60);
  if v_sim then
    update rede_posts set arquivado_em = coalesce(arquivado_em, now()), fora_do_fediverso = true
    where id = p_post and autor = v and apagado_em is null;
  else
    update rede_posts set arquivado_em = null where id = p_post and autor = v and apagado_em is null;
  end if;
  if not found then perform interno.erro('nao_encontrado'); end if;
  return jsonb_build_object('arquivado', v_sim);
end $$;

/** Os meus arquivados, do arquivado mais recente ao mais antigo, 20 por página (p_antes: o `proximo` da página anterior). */
create or replace function public.rede_pub_arquivados(p_antes timestamptz default null) returns jsonb language plpgsql stable security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); v_itens jsonb; v_ultimo timestamptz; v_n integer;
begin
  perform interno.aberta('comunidade');
  select coalesce(jsonb_agg(interno.rede_post_v2(x, v) || jsonb_build_object('arquivado_em', x.arquivado_em) order by x.arquivado_em desc), '[]'::jsonb),
         min(x.arquivado_em), count(*)
    into v_itens, v_ultimo, v_n
  from (select * from rede_posts p where p.autor = v and p.arquivado_em is not null and p.apagado_em is null
          and (p_antes is null or p.arquivado_em < p_antes)
        order by p.arquivado_em desc limit 20) x;
  return jsonb_build_object('itens', v_itens, 'proximo', case when v_n = 20 then v_ultimo end);
end $$;

-- 5. O que o cartão precisa saber ───────────────────────────────────────────────────────────────────────────────────────────

/**
 * Por lote (até 50 ids): quando o post some (para quem pode vê-lo) e, só para a autora, se está arquivado, se é não listado e se é
 * da roda. Id que a pessoa não pode ver não aparece. Nunca diz quem está na roda.
 */
create or replace function public.rede_pub_vida(p_ids uuid[]) returns jsonb language plpgsql stable security definer set search_path = interno, pg_temp as $$
declare v uuid := auth.uid(); r jsonb := '{}'::jsonb; p rede_posts;
begin
  if p_ids is null then return r; end if;
  for p in select * from rede_posts where id = any (p_ids[1:50]) and apagado_em is null loop
    continue when not interno.rede_ve(p, v);
    r := r || jsonb_build_object(p.id::text, jsonb_strip_nulls(jsonb_build_object(
      'expira_em', p.expira_em,
      'arquivado', case when v is not null and p.autor = v then p.arquivado_em is not null end,
      'nao_listado', case when v is not null and p.autor = v then p.nao_listado end,
      'roda', case when v is not null and p.autor = v then p.publico = 'roda' end)));
  end loop;
  return r;
end $$;

-- 6. Apagar depois de X semanas (opção da conta) ────────────────────────────────────────────────────────────────────────────

/** A minha escolha: { semanas } (nulo: desligado). */
create or replace function public.rede_pub_vida_conta() returns jsonb language plpgsql stable security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu();
begin
  perform interno.aberta('comunidade');
  return jsonb_build_object('semanas', (select semanas from rede_vida_conta where usuario = v));
end $$;

/** Quantos posts meus sairiam com esta escolha (para a tela perguntar antes de ligar). Só os meus: nada de outra pessoa. */
create or replace function public.rede_pub_vida_conta_previa(p_semanas integer) returns jsonb language plpgsql stable security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu();
begin
  perform interno.aberta('comunidade');
  if p_semanas is null or p_semanas not in (1, 2, 4, 8, 12, 26, 52) then perform interno.erro('invalido:semanas'); end if;
  return jsonb_build_object('semanas', p_semanas,
    'posts', (select count(*) from rede_posts p where p.autor = v and p.criado_em < now() - make_interval(weeks => p_semanas)));
end $$;

/** Liga (1, 2, 4, 8, 12, 26 ou 52 semanas) ou desliga (nulo ou 0) o apagar sozinho. A próxima rodada do agendador já apaga. */
create or replace function public.rede_pub_vida_conta_mudar(p_semanas integer) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu();
begin
  perform interno.aberta('comunidade');
  perform interno.limite('rede_pub_vida_conta', 30, 60);
  if coalesce(p_semanas, 0) = 0 then
    delete from rede_vida_conta where usuario = v;
  else
    if p_semanas not in (1, 2, 4, 8, 12, 26, 52) then perform interno.erro('invalido:semanas'); end if;
    if not exists (select 1 from perfis where id = v) then perform interno.erro('nao_encontrado'); end if;
    insert into rede_vida_conta (usuario, semanas) values (v, p_semanas)
    on conflict (usuario) do update set semanas = excluded.semanas, desde = now();
  end if;
  return public.rede_pub_vida_conta();
end $$;

-- 7. Apagar de verdade (agendador) ──────────────────────────────────────────────────────────────────────────────────────────

/**
 * Apaga estes posts de verdade. A mídia vai para a fila de arquivos (interno.alumia_arquivos_a_apagar, onda 8), que o servidor do
 * site esvazia pela API do depósito. O post que outra pessoa respondeu (direto ou mais abaixo) ou citou, fora deste lote, fica
 * como "[post apagado]": sem autora, sem texto, sem mídia, sem histórico. O resto sai de vez (o Fediverso recebe a retirada pelo
 * gatilho da federação). Não é chamada pela API.
 */
create or replace function interno.rede_vida_apagar(p_ids uuid[]) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v_lapides uuid[]; v_n integer := 0; r record;
begin
  if p_ids is null or cardinality(p_ids) = 0 then return jsonb_build_object('apagados', 0, 'post_apagado', 0); end if;
  if to_regclass('interno.alumia_arquivos_a_apagar') is not null then
    execute 'insert into interno.alumia_arquivos_a_apagar (deposito, caminho)
             select ''rede-midia'', m.caminho from interno.rede_midia m join interno.rede_posts x on x.id = m.post
             where m.post = any ($1) and x.autor is not null and m.caminho like x.autor::text || ''/%''
             union
             select ''rede-midia'', a.caminho from interno.rede_audios a join interno.rede_posts x on x.id = a.post
             where a.post = any ($1) and x.autor is not null and a.caminho like x.autor::text || ''/%''
             on conflict do nothing' using p_ids;
  end if;
  select coalesce(array_agg(x.id), '{}') into v_lapides from rede_posts x
  where x.id = any (p_ids)
    and exists (select 1 from rede_posts o where not (o.id = any (p_ids)) and (o.resposta_a = x.id or o.root_id = x.id or o.quote_of = x.id));
  if cardinality(v_lapides) > 0 then
    delete from rede_midia where post = any (v_lapides);
    delete from rede_audios where post = any (v_lapides);
    delete from rede_post_edicoes where post = any (v_lapides);
    for r in select unnest(array['rede_pub_extras', 'rede_b1_post', 'rede_b1_enquete', 'rede_enquetes', 'rede_rotulos', 'rede_mencoes']) as t loop
      if to_regclass('interno.' || r.t) is not null then
        execute format('delete from interno.%I where post = any ($1)', r.t) using v_lapides;
      end if;
    end loop;
    update rede_posts set autor = null, como = null, texto = '[post apagado]', titulo = null, corpo = null, aviso = '', cita = null,
      chamado = null, flair = null, posicao = null, motivo = '', resposta_a_remota = null, editado_em = null, fixado = false,
      oculto = true, retido = false, apagado_em = coalesce(apagado_em, now()), expira_em = null, nao_listado = false, arquivado_em = null
    where id = any (v_lapides);
  end if;
  delete from rede_posts where id = any (p_ids) and not (id = any (v_lapides));
  get diagnostics v_n = row_count;
  return jsonb_build_object('apagados', v_n, 'post_apagado', cardinality(v_lapides));
end $$;

/**
 * A rodada do agendador (a cada 10 minutos): os posts vencidos e os mais velhos que a escolha da conta, até p_limite por vez.
 * Devolve quantos saíram e quantos ficaram como "[post apagado]".
 */
create or replace function interno.rede_vida_rodada(p_limite integer default 500) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v_ids uuid[];
begin
  select coalesce(array_agg(id), '{}') into v_ids from (
    select id from (
      select p.id from rede_posts p where p.expira_em is not null and p.expira_em <= now() and p.autor is not null
      union
      select p.id from rede_posts p join rede_vida_conta c on c.usuario = p.autor where p.criado_em < now() - make_interval(weeks => c.semanas)
    ) u limit greatest(1, least(coalesce(p_limite, 500), 2000))) x;
  return interno.rede_vida_apagar(v_ids);
end $$;

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule('alumia-vida-dos-posts', '*/10 * * * *', 'select interno.rede_vida_rodada()');
  end if;
exception when others then null;
end $$;

-- 8. Permissões ─────────────────────────────────────────────────────────────────────────────────────────────────────────────

do $$
declare r record;
begin
  -- As de dentro: ninguém chama pela API (as regras de quem vê são chamadas pelas funções da rede, que são security definer).
  for r in
    select p.oid::regprocedure as f from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'interno' and p.proname like 'rede\_vida\_%'
  loop
    execute format('revoke all on function %s from public', r.f);
    if exists (select 1 from pg_roles where rolname = 'anon') then execute format('revoke all on function %s from anon, authenticated', r.f); end if;
  end loop;
  -- As da tela: só conta logada.
  for r in
    select p.oid::regprocedure as f from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname in ('rede_pub_vida_publicar', 'rede_pub_arquivar', 'rede_pub_arquivados', 'rede_pub_vida',
                                                 'rede_pub_vida_conta', 'rede_pub_vida_conta_previa', 'rede_pub_vida_conta_mudar')
  loop
    execute format('revoke all on function %s from public', r.f);
    if exists (select 1 from pg_roles where rolname = 'anon') then
      execute format('revoke all on function %s from anon', r.f);
      execute format('grant execute on function %s to authenticated, service_role', r.f);
    end if;
  end loop;
end $$;

-- As funções novas passam pela porta da entrada, como toda função da rede (20261112-alumia-portas.sql).
select interno.alumia_trancar();
