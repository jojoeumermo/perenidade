-- Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
-- ═══════════════════════════ Alumia · B1 · casca (Escrever, cartão, agendador, rascunhos) ═══════════════════════════
-- O back-end que faltava na F1 (PLANO-ALUMIA §8 F1; ALUMIA-FUNCOES-E-IDEIAS, Ondas A e B). Acrescentável e idempotente: pode
-- rodar mais de uma vez, não apaga dado de ninguém e roda DEPOIS de 2026-11-rede-publicar.sql, 2026-11-rede-conversa.sql e
-- 20261109-alumia-f1.sql. Tudo em `interno`, com RLS e sem permissão direta; as funções são security definer com
-- search_path fixo, conferem quem chama e têm limite de uso. Teste: npm run testar:alumia-b1-casca.
--
--   1. Agendador de verdade: liga o pg_cron (quando o serviço deixa) e roda rede_pub_agendados_rodar a cada minuto. Antes, um
--      post marcado para as 7h só saía quando a própria autora abria a Rede.
--   2. Agendar com recorrência ("toda semana", até 12 vezes) e "quando o ato terminar" (um ato que a própria pessoa chamou). A
--      repetição tem UM mecanismo só, que mora aqui (o gatilho interno.rede_alumia_serie_seguir): serve a este agendar e às séries
--      da comunidade (20261110-alumia-b1-comunidade.sql, rede_alumia_agendar_serie), com os mesmos valores: semanal, quinzenal, mensal.
--   3. Enquete avançada: resultado só no fim (nem quem fez nem quem votou vê a parcial: em assembleia, a parcial puxa o voto)
--      e ordem embaralhada por pessoa (a primeira opção não leva vantagem). O voto já é único e não se troca.
--   4. Quem pode citar (repostar com comentário): ninguém / quem eu sigo / todos, por post; padrão "ninguém" nos posts novos. A
--      regra vale no banco, para qualquer caminho que cite (trigger), e não só na tela.
--   5. Corrigir depois de publicar: o aviso de conteúdo, o texto alternativo de cada imagem e TIRAR uma imagem (um rosto que
--      escapou). Só o autor; as mesmas conferências de dado pessoal.
--   6. Rascunho na conta só cifrado no aparelho (AES-GCM; o servidor guarda só a cifra) e só com a chave "guardar na conta"
--      ligada (a tela decide; o banco recusa rascunho em texto claro). Opinião política e denúncia são dado sensível
--      (LGPD art. 11) e o servidor não precisa ler o rascunho (art. 6º, III, necessidade). Apagar todos de uma vez (art. 18, VI).
--      ATENÇÃO: esta migração NÃO apaga os rascunhos em texto claro gravados antes dela (não tira dado de ninguém sem o dono
--      decidir). Eles continuam em interno.rede_rascunhos, e rede_pub_rascunhos segue devolvendo-os à própria autora, até a
--      faxina por idade tirá-los: no máximo 30 dias depois da última vez que foram salvos. Para zerar antes, com a decisão do
--      Jonathan: delete from interno.rede_rascunhos where not (pedido ? 'cifra');
--
-- O que NÃO está aqui: a roda de confiança (lista do perfil, F4), "Público, também no Fediverso" num post comum (regra da Faixa 2,
-- pedido em docs/rede/PEDIDOS-ENTRE-FAIXAS.md) e o desfazer do ato (F2).

-- ── 0. Tabelas ──────────────────────────────────────────────────────────────────────────────────────────────────────────

-- O que o post tem a mais nesta etapa. A linha nasce com o post (trigger abaixo): post novo começa com "ninguém cita".
-- Post de antes desta migração não tem linha e segue como era (todos podiam citar).
create table if not exists interno.rede_b1_post (
  post uuid primary key references interno.rede_posts (id) on delete cascade,
  citar_quem text not null default 'ninguem' check (citar_quem in ('ninguem', 'seguindo', 'todos')),
  criado_em timestamptz not null default now()
);

create table if not exists interno.rede_b1_enquete (
  post uuid primary key references interno.rede_enquetes (post) on delete cascade,
  so_no_fim boolean not null default false,
  embaralhar boolean not null default false
);

-- A repetição do agendado, num desenho só para a casca e para as séries da comunidade:
--   repetir        'semanal' | 'quinzenal' | 'mensal' (nulo: sai uma vez só)
--   repetir_ate    até quando a série vai (nulo: só o teto de vezes)
--   vezes          em que vez esta linha está (1, 2, 3…; no máximo 52)
--   repetir_vezes  quantas vezes a série sai ao todo (nulo: até repetir_ate, ou 52)
--   serie          o número da série (o mesmo em todas as linhas dela; serve para listar e para parar)
alter table interno.rede_agendados add column if not exists repetir text;
alter table interno.rede_agendados add column if not exists repetir_ate timestamptz;
alter table interno.rede_agendados add column if not exists vezes smallint not null default 1;
alter table interno.rede_agendados add column if not exists repetir_vezes smallint;
alter table interno.rede_agendados add column if not exists serie uuid;
alter table interno.rede_agendados add column if not exists apos_ato uuid references interno.rede_posts (id) on delete set null;
do $$
begin
  -- As regras são refeitas a cada vez (um banco que rodou a versão de antes tinha só 'semana' e o teto de 12): tira a regra,
  -- acerta o que já estava gravado e põe a regra de agora. Rodar de novo não muda nada.
  alter table interno.rede_agendados drop constraint if exists rede_agendados_repetir;
  update interno.rede_agendados set repetir = 'semanal' where repetir = 'semana';
  update interno.rede_agendados set serie = gen_random_uuid() where repetir is not null and serie is null;
  alter table interno.rede_agendados add constraint rede_agendados_repetir check (repetir is null or repetir in ('semanal', 'quinzenal', 'mensal'));
  alter table interno.rede_agendados drop constraint if exists rede_agendados_vezes;
  alter table interno.rede_agendados add constraint rede_agendados_vezes check (vezes between 1 and 52);
end $$;
create index if not exists rede_agendados_apos_ato on interno.rede_agendados (apos_ato) where estado = 'pendente' and apos_ato is not null;
create index if not exists rede_agendados_serie on interno.rede_agendados (serie) where serie is not null;

alter table interno.rede_b1_post enable row level security;
alter table interno.rede_b1_enquete enable row level security;
revoke all on table interno.rede_b1_post, interno.rede_b1_enquete from public;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on table interno.rede_b1_post, interno.rede_b1_enquete from anon, authenticated;
  end if;
end $$;

-- Todo post de primeiro nível nasce com a sua linha (citar fechado). Resposta não tem: não se cita uma resposta pelo cartão.
create or replace function interno.rede_b1_post_nasce() returns trigger language plpgsql security definer set search_path = interno, pg_temp as $$
begin
  if new.resposta_a is null then
    insert into rede_b1_post (post) values (new.id) on conflict (post) do nothing;
  end if;
  return new;
end $$;
drop trigger if exists rede_b1_post_nasce on interno.rede_posts;
create trigger rede_b1_post_nasce after insert on interno.rede_posts for each row execute function interno.rede_b1_post_nasce();

-- ── 1. Quem pode citar ──────────────────────────────────────────────────────────────────────────────────────────────────

/**
 * Esta pessoa pode citar este post? O autor sempre pode; sem linha (post antigo), todos; "seguindo" = quem o autor segue DE FATO
 * (o pedido de seguir um perfil trancado, ainda pendente, não conta).
 */
create or replace function interno.rede_b1_pode_citar(p_alvo uuid, p_quem uuid) returns boolean language sql stable security definer set search_path = interno, pg_temp as $$
  select coalesce((
    select o.autor = p_quem
        or coalesce(b.citar_quem, 'todos') = 'todos'
        or (b.citar_quem = 'seguindo' and exists (select 1 from rede_seguindo s where s.quem = o.autor and s.segue = p_quem and not s.pendente))
    from rede_posts o left join rede_b1_post b on b.post = o.id
    where o.id = p_alvo), false)
$$;

-- A regra vale para QUALQUER caminho que grave a citação (rede_conv_citar de hoje e o que vier): a trigger recusa.
create or replace function interno.rede_b1_citar_confere() returns trigger language plpgsql security definer set search_path = interno, pg_temp as $$
begin
  if new.quote_of is not null and new.quote_of is distinct from old.quote_of and not interno.rede_b1_pode_citar(new.quote_of, new.autor) then
    perform interno.erro('citar_fechado');
  end if;
  return new;
end $$;
drop trigger if exists rede_b1_citar_confere on interno.rede_posts;
create trigger rede_b1_citar_confere before update of quote_of on interno.rede_posts for each row execute function interno.rede_b1_citar_confere();

-- ── 2. Publicar com os campos novos ─────────────────────────────────────────────────────────────────────────────────────

/**
 * Publicar com o que esta etapa acrescenta: p.citar_quem ('ninguem' | 'seguindo' | 'todos'; padrão 'ninguem') e, na enquete,
 * p.enquete.so_no_fim e p.enquete.embaralhar. O resto é o rede_publicar de sempre (todas as conferências), na mesma transação:
 * se algo aqui falhar, o post também não nasce.
 */
create or replace function public.rede_pub_publicar_mais(p jsonb) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); v_pub jsonb; v_id uuid; v_citar text; v_enq jsonb;
begin
  if p is null or jsonb_typeof(p) is distinct from 'object' then perform interno.erro('invalido:post'); end if;
  v_citar := coalesce(nullif(p ->> 'citar_quem', ''), 'ninguem');
  if v_citar not in ('ninguem', 'seguindo', 'todos') then perform interno.erro('invalido:citar_quem'); end if;
  v_enq := p -> 'enquete';
  if v_enq is not null and jsonb_typeof(v_enq) = 'object'
     and ((v_enq ? 'so_no_fim' and jsonb_typeof(v_enq -> 'so_no_fim') <> 'boolean') or (v_enq ? 'embaralhar' and jsonb_typeof(v_enq -> 'embaralhar') <> 'boolean')) then
    perform interno.erro('invalido:enquete');
  end if;
  v_pub := public.rede_publicar(p - 'citar_quem');
  v_id := (v_pub ->> 'id')::uuid;
  update rede_b1_post b set citar_quem = v_citar from rede_posts x where b.post = v_id and x.id = v_id and x.autor = v;
  if exists (select 1 from rede_enquetes e join rede_posts x on x.id = e.post where e.post = v_id and x.autor = v) then
    insert into rede_b1_enquete (post, so_no_fim, embaralhar)
    values (v_id, coalesce((v_enq ->> 'so_no_fim')::boolean, false), coalesce((v_enq ->> 'embaralhar')::boolean, false))
    on conflict (post) do update set so_no_fim = excluded.so_no_fim, embaralhar = excluded.embaralhar;
  end if;
  return v_pub || jsonb_build_object('citar_quem', case when v_pub ->> 'resposta_a' is null then v_citar end);
end $$;

-- ── 3. Enquete: resultado só no fim e ordem embaralhada ─────────────────────────────────────────────────────────────────

/**
 * A enquete como esta pessoa pode ver. Totais: depois do prazo, sempre; antes, para quem votou ou fez a enquete, A NÃO SER que
 * ela seja "resultado só no fim" (aí ninguém vê parcial, nem quem fez). Embaralhada: cada pessoa vê as opções numa ordem própria
 * e estável (a mesma ao recarregar), sorteada pelo id da opção com o da pessoa. Nunca "quem votou em quê".
 */
create or replace function interno.rede3_pub_enquete(p interno.rede_posts, p_quem uuid) returns jsonb language sql stable security definer set search_path = interno, pg_temp as $$
  with cfg as (
    select e.prazo, e.multipla, coalesce(b.so_no_fim, false) as so_no_fim, coalesce(b.embaralhar, false) as embaralhar,
           exists (select 1 from rede_votos v2 join rede_opcoes o2 on o2.id = v2.opcao where o2.enquete = p.id and v2.usuario = p_quem) as votei
    from rede_enquetes e left join rede_b1_enquete b on b.post = e.post where e.post = p.id
  ), ve as (
    select c.*, (c.prazo <= now() or (not c.so_no_fim and (p.autor = p_quem or c.votei))) as mostra from cfg c
  )
  select jsonb_build_object(
    'prazo', ve.prazo, 'multipla', ve.multipla, 'encerrada', ve.prazo <= now(), 'so_no_fim', ve.so_no_fim, 'embaralhada', ve.embaralhar,
    'votei', coalesce((select jsonb_agg(v.opcao) from rede_votos v join rede_opcoes oo on oo.id = v.opcao where oo.enquete = p.id and v.usuario = p_quem), '[]'::jsonb),
    'opcoes', (select jsonb_agg(jsonb_build_object('id', oo.id, 'texto', oo.texto,
        'votos', case when ve.mostra then (select count(*)::integer from rede_votos v3 where v3.opcao = oo.id) end)
        order by case when ve.embaralhar then md5(oo.id::text || coalesce(p_quem::text, 'visitante')) else lpad(oo.ordem::text, 4, '0') end)
               from rede_opcoes oo where oo.enquete = p.id),
    'total', case when ve.mostra then (select count(distinct v4.usuario)::integer from rede_votos v4 join rede_opcoes o4 on o4.id = v4.opcao where o4.enquete = p.id) end)
  from ve
$$;

-- ── 4. Detalhes por lote (o de 2026-11-rede-publicar.sql + citar e enquete avançada) ───────────────────────────────────

/**
 * O que cada post tem a mais, por lote (até 50 ids). Acrescenta: `citar` (esta pessoa pode citar? só com conta) e, para o autor,
 * `citar_quem` (a escolha dele). Id que a matriz não deixa ver não aparece.
 */
create or replace function public.rede_pub_detalhes(p_ids uuid[]) returns jsonb language plpgsql stable security definer set search_path = interno, pg_temp as $$
declare v uuid := auth.uid(); r jsonb := '{}'::jsonb; p rede_posts; ex rede_pub_extras; a rede_audios; b rede_b1_post;
begin
  if p_ids is null then return r; end if;
  for p in select * from rede_posts where id = any (p_ids[1:50]) and apagado_em is null loop
    continue when not interno.rede_ve(p, v);
    select * into ex from rede_pub_extras where post = p.id;
    select * into a from rede_audios where post = p.id;
    select * into b from rede_b1_post where post = p.id;
    r := r || jsonb_build_object(p.id::text, jsonb_strip_nulls(jsonb_build_object(
      'audio', case when a.id is not null then jsonb_build_object('id', a.id, 'duracao', a.duracao, 'tipo', a.tipo) end,
      'enquete', case when p.tipo = 'enquete' then interno.rede3_pub_enquete(p, v) end,
      'previa', ex.previa,
      'responde_quem', coalesce(ex.responde_quem, 'todos'),
      'fio', coalesce(ex.fio, false),
      'editado', p.editado_em is not null,
      'historico', exists (select 1 from rede_post_edicoes e where e.post = p.id),
      'janela_livre', v is not null and p.autor = v and p.criado_em > now() - interval '15 minutes',
      'citar', case when v is not null and p.resposta_a is null then interno.rede_b1_pode_citar(p.id, v) end,
      'citar_quem', case when v is not null and p.autor = v and p.resposta_a is null then coalesce(b.citar_quem, 'todos') end)));
  end loop;
  return r;
end $$;

-- ── 5. Corrigir depois de publicar: aviso, texto alternativo, tirar imagem, quem cita ──────────────────────────────────

/**
 * O autor corrige o que é de segurança, sem mexer no texto (o texto continua no rede_pub_editar, com histórico):
 *   p.aviso: o aviso de conteúdo (até 80; vazio tira);  p.alts: [{id, alt}] das imagens do post (até 1000 cada);
 *   p.tirar: [id] das imagens a tirar (o arquivo do depósito a tela apaga, pela regra de remoção da própria pasta);
 *   p.citar_quem: quem pode citar (só post de primeiro nível).
 * Depois dos 15 minutos, o post ganha "editado". Devolve o post e os caminhos tirados ({ post, tirados }).
 */
create or replace function public.rede_pub_corrigir(p_post uuid, p jsonb) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare
  v uuid := interno.eu(); x rede_posts; v_aviso text; v_mudou boolean := false; v_item jsonb; v_id uuid; v_alt text; v_tirados jsonb := '[]'::jsonb; v_cam text; v_citar text;
begin
  perform interno.aberta('comunidade');
  if p is null or jsonb_typeof(p) is distinct from 'object' then perform interno.erro('invalido:post'); end if;
  select * into x from rede_posts where id = p_post for update;
  if not found or x.autor is distinct from v or x.apagado_em is not null or x.tipo = 'aviso' then perform interno.erro('sem_permissao'); end if;
  if not coalesce((select rede_18 from perfis where id = v), false) then perform interno.erro('confirme_idade'); end if;
  if not interno.rede2_membro(v) then perform interno.erro('consentimento'); end if;
  perform interno.rede2_limite('editar');

  if p ? 'aviso' then
    v_aviso := left(btrim(coalesce(p ->> 'aviso', '')), 80);
    if interno.rede3_pub_dado_pessoal(v_aviso) then perform interno.erro('dado_pessoal'); end if;
    if v_aviso is distinct from coalesce(x.aviso, '') then
      update rede_posts set aviso = v_aviso where id = x.id;
      v_mudou := true;
    end if;
  end if;

  if p ? 'alts' then
    if jsonb_typeof(p -> 'alts') <> 'array' or jsonb_array_length(p -> 'alts') > 4 then perform interno.erro('invalido:alts'); end if;
    for v_item in select * from jsonb_array_elements(p -> 'alts') loop
      begin
        v_id := (v_item ->> 'id')::uuid;
      exception when others then perform interno.erro('invalido:alts');
      end;
      v_alt := left(btrim(coalesce(v_item ->> 'alt', '')), 1000);
      if interno.rede3_pub_dado_pessoal(v_alt) then perform interno.erro('dado_pessoal'); end if;
      update rede_midia set alt = v_alt where id = v_id and post = x.id and alt is distinct from v_alt;
      if found then v_mudou := true; end if;
    end loop;
  end if;

  if p ? 'tirar' then
    if jsonb_typeof(p -> 'tirar') <> 'array' or jsonb_array_length(p -> 'tirar') > 4 then perform interno.erro('invalido:tirar'); end if;
    for v_item in select * from jsonb_array_elements(p -> 'tirar') loop
      begin
        v_id := (v_item #>> '{}')::uuid;
      exception when others then perform interno.erro('invalido:tirar');
      end;
      delete from rede_midia where id = v_id and post = x.id returning caminho into v_cam;
      if v_cam is not null then
        v_tirados := v_tirados || to_jsonb(v_cam);
        v_mudou := true;
        v_cam := null;
      end if;
    end loop;
    -- As que ficam voltam a ser 0, 1, 2… (a ordem é única por post).
    -- Uma por vez, da menor para a maior: cada uma desce para uma vaga já livre (a ordem é única por post).
    for v_item in select to_jsonb(z) from (select id, (row_number() over (order by ordem))::integer - 1 as n, ordem from rede_midia where post = x.id order by ordem) z loop
      if (v_item ->> 'ordem')::integer <> (v_item ->> 'n')::integer then
        update rede_midia set ordem = (v_item ->> 'n')::smallint where id = (v_item ->> 'id')::uuid;
      end if;
    end loop;
  end if;

  if p ? 'citar_quem' then
    v_citar := p ->> 'citar_quem';
    if v_citar not in ('ninguem', 'seguindo', 'todos') or x.resposta_a is not null then perform interno.erro('invalido:citar_quem'); end if;
    insert into rede_b1_post (post, citar_quem) values (x.id, v_citar) on conflict (post) do update set citar_quem = excluded.citar_quem;
  end if;

  if v_mudou and x.criado_em < now() - interval '15 minutes' then
    update rede_posts set editado_em = now() where id = x.id;
  end if;
  select * into x from rede_posts where id = x.id;
  return jsonb_build_object('post', interno.rede_post_v2(x, v, true), 'tirados', v_tirados);
exception when check_violation then perform interno.erro('invalido:post');
end $$;

-- ── 6. Agendar: recorrência e "quando o ato terminar" ──────────────────────────────────────────────────────────────────

/** Quando o ato acaba: o fim marcado ou, sem fim, 3 horas depois do começo. Nulo se o ato foi cancelado. */
create or replace function interno.rede_b1_fim_do_ato(p_ato uuid) returns timestamptz language sql stable security definer set search_path = interno, pg_temp as $$
  select coalesce(c.fim, c.inicio + interval '3 hours')
  from rede_chamados c join rede_posts x on x.id = c.post
  where c.post = p_ato and not c.cancelado and coalesce(c.situacao, 'confirmado') <> 'cancelado' and x.apagado_em is null
$$;

/**
 * Publica o que venceu (de uma pessoa, ou de todas com p_autor nulo), em nome de cada autor, pelo rede_pub_publicar_mais (as mesmas
 * conferências de sempre). O que espera o fim de um ato segue a data do ato (se ele foi adiado, o post espera junto; se foi
 * cancelado, fica "falhou: ato_cancelado"). A próxima vez do que se repete NÃO é criada aqui: quem cria é o gatilho
 * interno.rede_alumia_serie_seguir (abaixo), o único lugar que faz isso, para o post nunca sair em dobro.
 */
create or replace function interno.rede3_pub_rodar(p_autor uuid default null) returns integer language plpgsql security definer set search_path = interno, pg_temp as $$
declare a rede_agendados; v_antes text := current_setting('request.jwt.claims', true); v_antes_sub text := current_setting('request.jwt.claim.sub', true); v_post jsonb; v_n integer := 0;
begin
  -- O fim do ato pode ter mudado (adiado) ou o ato caiu (cancelado).
  update rede_agendados g set quando = interno.rede_b1_fim_do_ato(g.apos_ato)
   where g.estado = 'pendente' and g.apos_ato is not null and (p_autor is null or g.autor = p_autor)
     and interno.rede_b1_fim_do_ato(g.apos_ato) is not null and g.quando is distinct from interno.rede_b1_fim_do_ato(g.apos_ato);
  update rede_agendados g set estado = 'falhou', erro = 'ato_cancelado'
   where g.estado = 'pendente' and g.apos_ato is not null and (p_autor is null or g.autor = p_autor) and interno.rede_b1_fim_do_ato(g.apos_ato) is null;

  for a in select * from rede_agendados where estado = 'pendente' and quando <= now() and (p_autor is null or autor = p_autor) order by quando limit 50 for update skip locked loop
    perform set_config('request.jwt.claims', jsonb_build_object('sub', a.autor, 'role', 'authenticated')::text, true);
    perform set_config('request.jwt.claim.sub', a.autor::text, true);
    begin
      v_post := public.rede_pub_publicar_mais(a.pedido);
      update rede_agendados set estado = 'publicado', post = (v_post ->> 'id')::uuid, erro = '' where id = a.id;
      v_n := v_n + 1;
    exception when others then
      update rede_agendados set estado = 'falhou', erro = left(sqlerrm, 120) where id = a.id;
    end;
  end loop;
  perform set_config('request.jwt.claims', coalesce(v_antes, ''), true);
  perform set_config('request.jwt.claim.sub', coalesce(v_antes_sub, ''), true);
  return v_n;
end $$;

/** O próximo horário de uma série. */
create or replace function interno.rede_alumia_proxima_vez(p_quando timestamptz, p_repetir text) returns timestamptz language sql immutable as $$
  select p_quando + case p_repetir when 'semanal' then interval '7 days' when 'quinzenal' then interval '14 days' when 'mensal' then interval '1 month' end
$$;

/**
 * O ÚNICO lugar que cria a próxima vez de um post que se repete (o agendar daqui e as séries da comunidade). Roda quando um
 * agendado deixa de estar pendente porque saiu (ou falhou: uma falha de um dia não acaba com a "assembleia toda terça"); cancelar
 * o que está na fila acaba com a série. Não cria nada se: a série chegou ao total de vezes (ou a 52), a próxima passaria da data
 * final, ou a série JÁ tem um na fila (é o que garante uma vez só, mesmo com dois agendadores rodando juntos). Se o agendador
 * ficou parado, a próxima é a primeira terça (ou o dia que for) ainda no futuro. Um erro aqui nunca desfaz a publicação.
 */
create or replace function interno.rede_alumia_serie_seguir() returns trigger language plpgsql security definer set search_path = interno, pg_temp as $$
declare v_prox timestamptz; v_serie uuid := coalesce(new.serie, gen_random_uuid());
begin
  if new.repetir is null or old.estado <> 'pendente' or new.estado not in ('publicado', 'falhou') then return null; end if;
  if new.vezes >= least(52, coalesce(new.repetir_vezes, 52)) then return null; end if;
  v_prox := interno.rede_alumia_proxima_vez(new.quando, new.repetir);
  while v_prox <= now() loop v_prox := interno.rede_alumia_proxima_vez(v_prox, new.repetir); end loop;
  if new.repetir_ate is not null and v_prox > new.repetir_ate then return null; end if;
  begin
    -- Uma série por vez (dois agendadores no mesmo instante esperam um pelo outro e o segundo já vê o que o primeiro pôs na fila).
    perform pg_advisory_xact_lock(hashtextextended('rede_serie:' || v_serie::text, 0));
    if exists (select 1 from rede_agendados where serie = v_serie and estado = 'pendente') then return null; end if;
    insert into rede_agendados (autor, pedido, quando, repetir, repetir_ate, vezes, repetir_vezes, serie)
    values (new.autor, new.pedido, v_prox, new.repetir, new.repetir_ate, new.vezes + 1, new.repetir_vezes, v_serie);
  exception when others then null;
  end;
  return null;
end $$;
drop trigger if exists rede_alumia_serie_seguir on interno.rede_agendados;
create trigger rede_alumia_serie_seguir after update of estado on interno.rede_agendados for each row execute function interno.rede_alumia_serie_seguir();

/**
 * Agendar com as opções desta etapa. p_opcoes: { repetir: 'semanal' | 'quinzenal' | 'mensal', vezes: 2..12 } e/ou { apos_ato: <id de um ato que EU chamei> }.
 * Com apos_ato, a hora é o fim do ato (p_quando é ignorado). Repetir não aceita imagem nem áudio (cada arquivo só nasce uma vez).
 * Usa o rede_pub_agendar de sempre (ensaio do pedido, de 5 minutos a 30 dias, até 10 na fila).
 */
create or replace function public.rede_pub_agendar_mais(p jsonb, p_quando timestamptz, p_opcoes jsonb) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); v_ato uuid; v_quando timestamptz := p_quando; v_r jsonb; v_id uuid; v_rep text; v_vezes integer; v_serie uuid;
begin
  perform interno.aberta('comunidade');
  if p_opcoes is null or jsonb_typeof(p_opcoes) <> 'object' then p_opcoes := '{}'::jsonb; end if;
  perform interno.limite('alumia_agendar', 30, 60);
  v_rep := nullif(p_opcoes ->> 'repetir', '');
  if v_rep is not null and v_rep not in ('semanal', 'quinzenal', 'mensal') then perform interno.erro('invalido:repetir'); end if;
  if v_rep is not null then
    begin
      v_vezes := coalesce((p_opcoes ->> 'vezes')::integer, 4);
    exception when others then perform interno.erro('invalido:repetir');
    end;
    if v_vezes not between 2 and 12 then perform interno.erro('invalido:repetir'); end if;
    if p ? 'midia' or p ? 'audio' then perform interno.erro('repetir_sem_arquivo'); end if;
  end if;
  if nullif(p_opcoes ->> 'apos_ato', '') is not null then
    begin
      v_ato := (p_opcoes ->> 'apos_ato')::uuid;
    exception when others then perform interno.erro('invalido:ato');
    end;
    if not exists (select 1 from rede_posts x where x.id = v_ato and x.autor = v) then perform interno.erro('invalido:ato'); end if;
    v_quando := interno.rede_b1_fim_do_ato(v_ato);
    if v_quando is null then perform interno.erro('invalido:ato'); end if;
    -- O ato já acabou ou está quase: o agendamento pede no mínimo 5 minutos.
    if v_quando < now() + interval '5 minutes' then v_quando := now() + interval '5 minutes' + interval '10 seconds'; end if;
  end if;
  v_r := public.rede_pub_agendar(p, v_quando);
  v_id := (v_r ->> 'id')::uuid;
  if v_rep is not null then v_serie := gen_random_uuid(); end if;
  update rede_agendados set repetir = v_rep, vezes = 1, repetir_vezes = v_vezes, apos_ato = v_ato, serie = v_serie,
         repetir_ate = case v_rep when 'semanal' then v_quando + (v_vezes - 1) * interval '7 days' when 'quinzenal' then v_quando + (v_vezes - 1) * interval '14 days'
                                  when 'mensal' then v_quando + (v_vezes - 1) * interval '1 month' end
   where id = v_id and autor = v;
  return v_r || jsonb_build_object('repetir', v_rep, 'vezes', v_vezes, 'apos_ato', v_ato, 'serie', v_serie);
end $$;

/** Os atos que EU chamei e ainda não acabaram (para "publicar quando o ato terminar"): id, nome e quando acaba. Até 20. */
create or replace function public.rede_pub_meus_atos() returns jsonb language plpgsql stable security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu();
begin
  return coalesce((
    select jsonb_agg(jsonb_build_object('id', z.post, 'nome', z.nome, 'fim', z.fim) order by z.fim)
    from (
      select c.post, left(coalesce(nullif(c.titulo, ''), x.titulo, x.texto), 80) as nome, interno.rede_b1_fim_do_ato(c.post) as fim
      from rede_chamados c join rede_posts x on x.id = c.post
      where x.autor = v and x.apagado_em is null and interno.rede_b1_fim_do_ato(c.post) > now() and interno.rede_b1_fim_do_ato(c.post) <= now() + interval '30 days'
      order by 3 limit 20
    ) z), '[]'::jsonb);
end $$;

/** Publica o que venceu desta pessoa ("ao ler") e devolve a fila dela, agora com a repetição e o "depois do ato". */
create or replace function public.rede_pub_agendados() returns jsonb language plpgsql volatile security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu();
begin
  perform interno.rede3_pub_rodar(v);
  return coalesce((select jsonb_agg(jsonb_build_object('id', a.id, 'quando', a.quando, 'estado', a.estado, 'erro', a.erro, 'post', a.post,
           'texto', left(coalesce(a.pedido ->> 'texto', a.pedido ->> 'titulo', ''), 120),
           'repetir', a.repetir, 'vezes', a.vezes, 'repetir_vezes', a.repetir_vezes, 'repetir_ate', a.repetir_ate, 'serie', a.serie, 'apos_ato', a.apos_ato is not null) order by a.quando desc)
         from (select * from rede_agendados where autor = v and estado <> 'cancelado' order by quando desc limit 20) a), '[]'::jsonb);
end $$;

-- O agendador: liga o pg_cron quando o serviço deixa (no Supabase, a extensão vem disponível) e roda a cada minuto (o
-- chamado das 7h sai às 7h). Sem pg_cron (banco local, teste), a rota /api/rede/agendados roda o mesmo com a chave de serviço,
-- e o "ao ler" de sempre continua valendo.
do $$
begin
  begin
    execute 'create extension if not exists pg_cron with schema pg_catalog';
  exception when others then
    begin
      execute 'create extension if not exists pg_cron';
    exception when others then null;
    end;
  end;
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    begin
      perform cron.unschedule('lucia-rede-agendados');
    exception when others then null;
    end;
    perform cron.schedule('lucia-rede-agendados', '* * * * *', 'select public.rede_pub_agendados_rodar()');
  end if;
exception when others then null;
end $$;

-- ── 7. Rascunho na conta: só cifrado ───────────────────────────────────────────────────────────────────────────────────

/**
 * Confere o rascunho. Desta etapa em diante, SÓ cifrado: { v: 1, iv: <12 bytes em base64>, cifra: <base64, até 60.000> }. O
 * servidor não sabe o tipo, o texto nem a comunidade. Rascunho em texto claro: 'rascunho_sem_cifra' (a tela guarda no aparelho).
 */
create or replace function interno.rede_rascunho_limpo(p jsonb) returns jsonb
language plpgsql stable set search_path = interno, pg_temp as $$
declare v_iv text; v_cifra text;
begin
  if p is null or jsonb_typeof(p) <> 'object' then perform interno.erro('invalido:rascunho'); end if;
  if not (p ? 'cifra') then perform interno.erro('rascunho_sem_cifra'); end if;
  v_iv := coalesce(p ->> 'iv', '');
  v_cifra := coalesce(p ->> 'cifra', '');
  if coalesce(p ->> 'v', '') <> '1' then perform interno.erro('invalido:rascunho'); end if;
  if v_iv !~ '^[A-Za-z0-9+/]{16}$' then perform interno.erro('invalido:rascunho'); end if;
  if char_length(v_cifra) not between 24 and 60000 or v_cifra !~ '^[A-Za-z0-9+/]+={0,2}$' then perform interno.erro('invalido:tamanho'); end if;
  return jsonb_build_object('v', 1, 'iv', v_iv, 'cifra', v_cifra);
end $$;

/** Apaga TODOS os meus rascunhos da conta (ao desligar "guardar na conta"). Devolve quantos. */
create or replace function public.rede_pub_rascunhos_apagar_todos() returns jsonb
language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); v_n integer;
begin
  perform interno.aberta('comunidade');
  perform interno.limite('alumia_rascunhos_apagar', 30, 60);
  delete from rede_rascunhos where autor = v;
  get diagnostics v_n = row_count;
  return jsonb_build_object('apagados', v_n);
end $$;

-- ── 8. Permissões ───────────────────────────────────────────────────────────────────────────────────────────────────────
revoke all on function interno.rede_b1_post_nasce(), interno.rede_b1_pode_citar(uuid, uuid), interno.rede_b1_citar_confere(),
  interno.rede_b1_fim_do_ato(uuid), interno.rede3_pub_enquete(interno.rede_posts, uuid), interno.rede3_pub_rodar(uuid), interno.rede_rascunho_limpo(jsonb),
  interno.rede_alumia_proxima_vez(timestamptz, text), interno.rede_alumia_serie_seguir() from public;
revoke all on function public.rede_pub_publicar_mais(jsonb), public.rede_pub_detalhes(uuid[]), public.rede_pub_corrigir(uuid, jsonb),
  public.rede_pub_agendar_mais(jsonb, timestamptz, jsonb), public.rede_pub_meus_atos(), public.rede_pub_agendados(), public.rede_pub_rascunhos_apagar_todos() from public;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on function interno.rede_b1_post_nasce(), interno.rede_b1_pode_citar(uuid, uuid), interno.rede_b1_citar_confere(),
      interno.rede_b1_fim_do_ato(uuid), interno.rede3_pub_enquete(interno.rede_posts, uuid), interno.rede3_pub_rodar(uuid), interno.rede_rascunho_limpo(jsonb),
  interno.rede_alumia_proxima_vez(timestamptz, text), interno.rede_alumia_serie_seguir() from anon, authenticated;
    revoke all on function public.rede_pub_publicar_mais(jsonb), public.rede_pub_corrigir(uuid, jsonb), public.rede_pub_agendar_mais(jsonb, timestamptz, jsonb),
      public.rede_pub_meus_atos(), public.rede_pub_agendados(), public.rede_pub_rascunhos_apagar_todos() from anon;
    -- Leitura (a matriz decide): com ou sem conta.
    grant execute on function public.rede_pub_detalhes(uuid[]) to anon, authenticated, service_role;
    -- Escrita: só com conta.
    grant execute on function public.rede_pub_publicar_mais(jsonb), public.rede_pub_corrigir(uuid, jsonb), public.rede_pub_agendar_mais(jsonb, timestamptz, jsonb),
      public.rede_pub_meus_atos(), public.rede_pub_agendados(), public.rede_pub_rascunhos_apagar_todos() to authenticated, service_role;
  end if;
end $$;
-- ═══════════════════════════ fim da B1 · casca ═══════════════════════════
