-- Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
--
-- ═══════════════════════════ Alumia · B1 · atos: tarefas, caronas, petição, lembretes, meta e a borda de 3 (10/11/2026) ═══════════════════════════
-- docs/plano-2026-11/PLANO-ALUMIA.md §4.2, §5 (F2), §6 e §8 (F2). Vem DEPOIS da F2 (20261109-alumia-f2.sql), da F4 (rede_age_como)
-- e da Onda A dos atos (20261110-alumia-atos.sql). Idempotente: o teste (scripts/testar-alumia-b1-atos.mjs) roda três vezes no
-- banco local. NÃO rodar em produção sem o Jonathan.
--
-- O que faz:
--   1. BORDA DE 3. A proporção do mosaico (e o total da petição) passa a sair de uma CONTAGEM PUBLICADA, que só anda de 15 em 15
--      minutos (o marco de interno.rede_contagem_marco). Antes, quem confirmava a 3ª presença via o mosaico acender NA HORA (e,
--      desfazendo, apagar), e sabia que havia exatamente 2 pessoas antes dela. Agora a resposta do "Você vai" mostra o número do
--      último marco: a pessoa não vê o efeito do próprio toque, e no próximo marco outras pessoas já podem ter entrado ou saído.
--      Para isso rede_vou ganha `criado_em`, e quem sai deixa só o intervalo (entrou_em, saiu_em) em rede_contagem_saidas, SEM
--      dizer quem foi; o intervalo some em 1 hora. O total exato de quem organizou continua na hora (ela já sabe).
--      Risco que fica: quem tiver paciência para confirmar, esperar o marco, desfazer e esperar de novo ainda deduz a contagem
--      perto da borda quando ninguém mais se mexe. O atraso tira a dedução imediata; não a torna impossível.
--   2. META E LINK DE APOIO editáveis por quem organizou (rede_ato_editar) e devolvidos no ato (`meta`).
--   3. QUADRO DE TAREFAS (quem leva o quê): rede_ato_tarefas + rede_ato_tarefa_quem. O público vê o item, quantas pessoas a
--      organização pediu e se "já tem quem leve"; quem assumiu vê só que ela mesma assumiu. NINGUÉM recebe o codinome de quem
--      assumiu, nem quem organiza (nem quem opera a conta da organização por rede_age_como): seria uma lista de pessoas ligadas a
--      um ato político (LGPD art. 11). Quem organiza vê, além do "já tem quem leve", quantas pessoas assumiram só a partir de 3.
--   4. CARONAS E ÔNIBUS: rede_ato_caronas (oferta ou pedido, meio, vagas, ponto de saída PÚBLICO, hora). Nunca telefone nem
--      endereço com número (interno.rede3_pub_dado_pessoal); o contato é só pelo chat privado (encaixe da Faixa 2,
--      docs/rede/PEDIDOS-ENTRE-FAIXAS.md). Nenhuma função devolve quem ofereceu: só "é minha". Até 200 por ato (e 2 por pessoa).
--      Quem organiza pode tirar a carona de outra pessoa (contra abuso): vai a interno.auditoria sem dizer de quem era.
--   5. PETIÇÃO SEM LISTA: rede_peticoes + rede_peticao_assinaturas. Total só a partir de 3 (e pela contagem publicada); nenhum
--      nome de quem assinou, para ninguém (nem para quem criou). A petição não está no post: nunca federa (PLANO §8 F-FED).
--      Regra de prazo, DE PROPÓSITO: a petição vive mais que o ato (a pauta continua depois do dia). Abrir pede ato não cancelado,
--      mas pode ser depois do dia do ato; assinar só olha a própria petição (aberta e no prazo), nunca a data do ato.
--   6. LEMBRETES DO SERVIDOR: 24 h e 2 h antes, um aviso (tipo 'chamado', que o enviar-push leva SEM texto) a quem confirmou e
--      não desligou "lembrete". O ato guarda só a hora em que o lembrete saiu (nada por pessoa); adiar zera. O texto guardado é
--      a reserva em português; a tela de avisos o reconhece (lib/rede/tipos-avisos.ts, TEXTOS_DO_SERVIDOR) e mostra no idioma
--      de quem lê. Até 5000 avisos por rodada: o ato que não coube fica para a rodada seguinte (15 min depois).
--
-- Privacidade (LGPD, Lei 13.709/2018, conferida no texto: art. 5º, II e art. 11 — ir a um ato, levar uma tarefa, pedir carona e
-- assinar petição revelam opinião política, dado pessoal sensível; art. 6º, III — necessidade; art. 18, IX — revogar o
-- consentimento: desfazer sempre pode; art. 46 — segurança): nenhuma lista de pessoas; contagens só a partir de 3; codinome
-- (interno.rede_nome), nunca nome civil; sem GPS (o ponto de saída é texto público); limites de uso pela conta ou pelo endereço
-- CIFRADO (interno.limite), nunca o IP cru. ECA (Lei 8.069/1990) e ECA Digital (Lei 15.211/2025): escrever exige membro 18+
-- (interno.rede2_membro); visitante só lê o que já é público.

-- ── 1. A contagem publicada (borda de 3) ────────────────────────────────────────────────────────────────────────────────────
alter table interno.rede_vou add column if not exists criado_em timestamptz;
-- As confirmações de antes contam desde sempre (o mosaico não apaga na hora da migração).
update interno.rede_vou set criado_em = timestamptz '2000-01-01 00:00:00+00' where criado_em is null;
alter table interno.rede_vou alter column criado_em set default now();
alter table interno.rede_vou alter column criado_em set not null;

-- Só o intervalo de quem saiu (sem a pessoa): serve para a contagem publicada não cair na hora do "desfazer".
create table if not exists interno.rede_contagem_saidas (
  id bigint generated always as identity primary key,
  alvo uuid not null,
  entrou_em timestamptz not null,
  saiu_em timestamptz not null default now()
);
create index if not exists rede_contagem_saidas_alvo on interno.rede_contagem_saidas (alvo, saiu_em);
alter table interno.rede_contagem_saidas enable row level security;
revoke all on table interno.rede_contagem_saidas from public;

/** O último marco da contagem publicada: o começo do quarto de hora atual. */
create or replace function interno.rede_contagem_marco() returns timestamptz language sql stable security definer set search_path = interno, pg_temp as $$
  select to_timestamp(floor(extract(epoch from now()) / 900) * 900)
$$;

/** Quantas confirmações o ato tinha no último marco (quem entrou até ele, mais quem estava nele e saiu depois). */
create or replace function interno.rede_vou_publicado(p_post uuid) returns bigint language sql stable security definer set search_path = interno, pg_temp as $$
  select (select count(*) from rede_vou v where v.post = p_post and v.criado_em <= interno.rede_contagem_marco())
       + (select count(*) from rede_contagem_saidas s where s.alvo = p_post
            and s.entrou_em <= interno.rede_contagem_marco() and s.saiu_em > interno.rede_contagem_marco())
$$;

/** Quem desfaz deixa só o intervalo (se já contava no marco). Post apagado (cascata) não deixa nada. */
create or replace function interno.rede_vou_saiu() returns trigger language plpgsql security definer set search_path = interno, pg_temp as $$
begin
  if old.criado_em <= interno.rede_contagem_marco() and exists (select 1 from rede_posts where id = old.post) then
    insert into rede_contagem_saidas (alvo, entrou_em) values (old.post, old.criado_em);
  end if;
  if random() < 0.05 then delete from rede_contagem_saidas where saiu_em < now() - interval '1 hour'; end if;
  return old;
end $$;
drop trigger if exists rede_vou_saiu on interno.rede_vou;
create trigger rede_vou_saiu after delete on interno.rede_vou for each row execute function interno.rede_vou_saiu();

-- ── 2. O ato como a tela recebe (o de 20261109-alumia-f2.sql, com a contagem publicada e a meta) ───────────────────────────
alter table interno.rede_chamados add column if not exists lembrete_24h_em timestamptz;
alter table interno.rede_chamados add column if not exists lembrete_2h_em timestamptz;

create or replace function interno.rede_ato_json(p interno.rede_posts, c interno.rede_chamados, p_quem uuid) returns jsonb
language plpgsql stable security definer set search_path = interno, pg_temp as $$
declare
  v_titulo text := coalesce(c.titulo, nullif(p.titulo, ''), left(btrim(split_part(p.texto, E'\n', 1)), 60));
  v_palavra text := coalesce(c.palavra, nullif(interno.rede_ato_palavra(v_titulo), ''));
  v_meu boolean := p_quem is not null and interno.rede_age_como(p_quem, p.autor);
  f perfis;
  k rede_comunidades;
begin
  select * into f from perfis where id = p.autor;
  if p.comunidade is not null then select * into k from rede_comunidades where slug = p.comunidade; end if;
  if v_palavra is null or char_length(replace(v_palavra, ' ', '')) < 2 then v_palavra := 'ATO'; end if;
  return jsonb_build_object(
    'id', p.id,
    'titulo', coalesce(nullif(v_titulo, ''), v_palavra),
    'palavra', v_palavra,
    'comunidade', case when p.comunidade is null then null else jsonb_build_object('slug', p.comunidade, 'nome', coalesce(k.nome, p.comunidade), 'cor', null) end,
    'chamado_por', case when f.id is null then null
                        when coalesce(f.rede_modo = 'invisivel' or f.rede_invisivel, false) or f.rede_handle is null then interno.rede_nome(p.autor)
                        else f.rede_handle end,
    'inicio', c.inicio,
    'inicio_anterior', c.inicio_anterior,
    'onde', c.ponto,
    'cidade', coalesce(c.cidade, ''),
    'descricao', p.texto,
    'situacao', c.situacao,
    'motivo', coalesce(c.motivo, ''),
    -- A proporção sai da contagem PUBLICADA (de 15 em 15 min): ninguém vê o efeito do próprio toque na borda de 3.
    'acesos', interno.rede_ato_proporcao(interno.rede_vou_publicado(p.id), c.meta),
    'total', case when v_meu then (select count(*) from rede_vou v where v.post = p.id) end,
    'vou_eu', p_quem is not null and exists (select 1 from rede_vou v where v.post = p.id and v.usuario = p_quem),
    'meu', v_meu,
    'respostas', interno.rede2_respostas_visiveis(p.id, p_quem),
    'link_apoio', c.link_apoio,
    'meta', c.meta);
end $$;

/** "Você vai" (o de 20261109-alumia-f2.sql): a resposta traz a proporção do último marco, não a de agora. */
create or replace function public.rede_ato_vou(p_id uuid, p_sim boolean) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); p rede_posts; c rede_chamados;
begin
  perform interno.aberta('comunidade');
  if not interno.rede2_membro(v) then perform interno.erro('consentimento'); end if;
  perform interno.rede2_limite('reagir');
  p := interno.rede_ato_achar(p_id, v);
  select * into c from rede_chamados where post = p_id for update;
  if coalesce(p_sim, true) then
    if c.situacao = 'cancelado' then perform interno.erro('ato_cancelado'); end if;
    if c.inicio < now() - interval '6 hours' then perform interno.erro('ato_passou'); end if;
    if p.oculto or p.retido or p.apagado_em is not null then perform interno.erro('nao_encontrado'); end if;
    insert into rede_vou (post, usuario) values (p_id, v) on conflict do nothing;
  else
    delete from rede_vou where post = p_id and usuario = v;
  end if;
  return jsonb_build_object('vou_eu', coalesce(p_sim, true), 'acesos', interno.rede_ato_proporcao(interno.rede_vou_publicado(p_id), c.meta),
    'total', case when interno.rede_age_como(v, p.autor) then (select count(*) from rede_vou where post = p_id) end);
end $$;

/** O ato para quem escreve nele: existe, a pessoa vê, é membro 18+, e o ato não foi cancelado nem passou (desfazer não usa). */
create or replace function interno.rede_ato_aberto(p_id uuid, p_quem uuid) returns interno.rede_chamados
language plpgsql stable security definer set search_path = interno, pg_temp as $$
declare p rede_posts; c rede_chamados;
begin
  p := interno.rede_ato_achar(p_id, p_quem);
  if p.oculto or p.retido or p.apagado_em is not null then perform interno.erro('nao_encontrado'); end if;
  select * into c from rede_chamados where post = p_id;
  if c.situacao = 'cancelado' then perform interno.erro('ato_cancelado'); end if;
  if c.inicio < now() - interval '6 hours' then perform interno.erro('ato_passou'); end if;
  return c;
end $$;

-- ── 3. Meta e link de apoio ─────────────────────────────────────────────────────────────────────────────────────────────────

/**
 * Só quem organizou. p: {meta?, link_apoio?}; só as chaves presentes mudam; nulo ou vazio tira. Meta 3–30000 (o mosaico divide por
 * max(30, meta)); link só https, até 300, sem dado pessoal. Devolve o Ato.
 */
create or replace function public.rede_ato_editar(p_id uuid, p jsonb) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); x rede_posts; c rede_chamados; v_meta integer; v_link text;
begin
  perform interno.aberta('comunidade');
  if not interno.rede2_membro(v) then perform interno.erro('consentimento'); end if;
  if p is null or jsonb_typeof(p) is distinct from 'object' then perform interno.erro('invalido:ato'); end if;
  x := interno.rede_ato_achar(p_id, v);
  if not interno.rede_age_como(v, x.autor) then perform interno.erro('so_quem_organizou'); end if;
  perform interno.limite('alumia_ato_mudar', 20, 60);
  select * into c from rede_chamados where post = p_id for update;
  v_meta := c.meta; v_link := c.link_apoio;
  if p ? 'meta' then
    begin
      v_meta := nullif(btrim(coalesce(p ->> 'meta', '')), '')::integer;
    exception when others then perform interno.erro('invalido:meta');
    end;
    if v_meta is not null and v_meta not between 3 and 30000 then perform interno.erro('invalido:meta'); end if;
  end if;
  if p ? 'link_apoio' then
    v_link := nullif(btrim(coalesce(p ->> 'link_apoio', '')), '');
    if v_link is not null and (v_link !~ '^https://[^\s<>"'']{4,}$' or char_length(v_link) > 300) then perform interno.erro('invalido:link_apoio'); end if;
    if v_link is not null and v_link ~ '\d{3}\.?\d{3}\.?\d{3}-?\d{2}|\(?\d{2}\)?\s?9\d{4}[-\s]?\d{4}' then perform interno.erro('dado_pessoal'); end if;
  end if;
  update rede_chamados set meta = v_meta, link_apoio = v_link where post = p_id returning * into c;
  return interno.rede_ato_json(x, c, v);
end $$;

-- ── 4. Quadro de tarefas (quem leva o quê) ──────────────────────────────────────────────────────────────────────────────────
create table if not exists interno.rede_ato_tarefas (
  id uuid primary key default gen_random_uuid(),
  ato uuid not null references interno.rede_chamados (post) on delete cascade,
  item text not null check (char_length(item) between 2 and 80),
  quantos smallint not null default 1 check (quantos between 1 and 50),
  criado_em timestamptz not null default now()
);
create index if not exists rede_ato_tarefas_ato on interno.rede_ato_tarefas (ato, criado_em);
create table if not exists interno.rede_ato_tarefa_quem (
  tarefa uuid not null references interno.rede_ato_tarefas (id) on delete cascade,
  usuario uuid not null references interno.perfis (id) on delete cascade,
  criado_em timestamptz not null default now(),
  primary key (tarefa, usuario)
);
create index if not exists rede_ato_tarefa_quem_usuario on interno.rede_ato_tarefa_quem (usuario);
alter table interno.rede_ato_tarefas enable row level security;
alter table interno.rede_ato_tarefa_quem enable row level security;
revoke all on table interno.rede_ato_tarefas, interno.rede_ato_tarefa_quem from public;

/**
 * As tarefas do ato. Para todo mundo: item, quantos (o número que a organização PEDIU) e se já tem quem leve (`completa`).
 * `eu`: esta pessoa assumiu. Só quem organiza recebe `assumidas` (quantas pessoas), e só a partir de 3 (abaixo, nulo). Codinome
 * de quem assumiu, para ninguém (LGPD art. 11 e art. 6º, III: "tem quem leve" e o número bastam para organizar).
 */
create or replace function interno.rede_ato_tarefas_json(p_ato uuid, p_quem uuid, p_organiza boolean) returns jsonb
language sql stable security definer set search_path = interno, pg_temp as $$
  select coalesce(jsonb_agg(jsonb_build_object(
      'id', t.id, 'item', t.item, 'quantos', t.quantos,
      'completa', n.n >= t.quantos,
      'eu', p_quem is not null and exists (select 1 from rede_ato_tarefa_quem q where q.tarefa = t.id and q.usuario = p_quem),
      'assumidas', case when p_organiza and n.n >= 3 then n.n end
    ) order by t.criado_em, t.id), '[]'::jsonb)
    from rede_ato_tarefas t
    cross join lateral (select count(*) as n from rede_ato_tarefa_quem q where q.tarefa = t.id) n
   where t.ato = p_ato
$$;

/** As tarefas de um ato que a pessoa vê (visitante: só se o ato é público na internet). Devolve {organiza, tarefas}. */
create or replace function public.rede_ato_tarefas(p_ato uuid) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := auth.uid(); p rede_posts; v_org boolean;
begin
  perform interno.aberta('comunidade');
  if v is not null and exists (select 1 from perfis where id = v and suspenso) then perform interno.erro('conta_suspensa'); end if;
  perform interno.limite('alumia_atos_ler', 300, 60);
  p := interno.rede_ato_achar(p_ato, v);
  v_org := v is not null and interno.rede_age_como(v, p.autor);
  return jsonb_build_object('organiza', v_org, 'tarefas', interno.rede_ato_tarefas_json(p_ato, v, v_org));
end $$;

/** Só quem organiza: põe uma tarefa ("caixa de som", 1; "faixa", 4). Até 30 por ato. Sem dado pessoal. */
create or replace function public.rede_ato_tarefa_criar(p_ato uuid, p_item text, p_quantos integer default 1) returns jsonb
language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); p rede_posts; c rede_chamados; v_item text;
begin
  perform interno.aberta('comunidade');
  if not interno.rede2_membro(v) then perform interno.erro('consentimento'); end if;
  p := interno.rede_ato_achar(p_ato, v);
  if not interno.rede_age_como(v, p.autor) then perform interno.erro('so_quem_organizou'); end if;
  c := interno.rede_ato_aberto(p_ato, v);
  v_item := regexp_replace(interno.txt(p_item, 'item', 2, 80), '\s+', ' ', 'g');
  if p_quantos is null or p_quantos not between 1 and 50 then perform interno.erro('invalido:quantos'); end if;
  if interno.rede3_pub_dado_pessoal(v_item) then perform interno.erro('dado_pessoal'); end if;
  if (select count(*) from rede_ato_tarefas where ato = p_ato) >= 30 then perform interno.erro('invalido:tarefas'); end if;
  perform interno.limite('alumia_ato_tarefa', 60, 60);
  insert into rede_ato_tarefas (ato, item, quantos) values (p_ato, v_item, p_quantos);
  return jsonb_build_object('organiza', true, 'tarefas', interno.rede_ato_tarefas_json(p_ato, v, true));
end $$;

/**
 * Só quem organiza: tira uma tarefa (a tarefa é da organização). Quem tinha assumido não recebe aviso; vai a interno.auditoria
 * que quem organiza tirou a tarefa (o item e se alguém tinha assumido), sem dizer quem tinha assumido.
 */
create or replace function public.rede_ato_tarefa_apagar(p_tarefa uuid) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); t rede_ato_tarefas; p rede_posts;
begin
  perform interno.aberta('comunidade');
  if not interno.rede2_membro(v) then perform interno.erro('consentimento'); end if;
  select * into t from rede_ato_tarefas where id = p_tarefa;
  if not found then perform interno.erro('nao_encontrado'); end if;
  p := interno.rede_ato_achar(t.ato, v);
  if not interno.rede_age_como(v, p.autor) then perform interno.erro('so_quem_organizou'); end if;
  perform interno.limite('alumia_ato_tarefa', 60, 60);
  insert into auditoria (quem, nome, acao, alvo, detalhes)
  values (v, '', 'ato_tarefa_tirada', t.ato::text, jsonb_build_object('item', t.item,
    'tinha_quem', exists (select 1 from rede_ato_tarefa_quem q where q.tarefa = t.id)));
  delete from rede_ato_tarefas where id = p_tarefa;
  return jsonb_build_object('organiza', true, 'tarefas', interno.rede_ato_tarefas_json(t.ato, v, true));
end $$;

/** "Eu levo" (p_sim) ou desfazer. Tarefa completa não aceita mais gente; desfazer sempre pode (LGPD art. 18, IX). */
create or replace function public.rede_ato_tarefa_assumir(p_tarefa uuid, p_sim boolean) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); t rede_ato_tarefas; p rede_posts; v_org boolean;
begin
  perform interno.aberta('comunidade');
  if not interno.rede2_membro(v) then perform interno.erro('consentimento'); end if;
  perform interno.rede2_limite('reagir');
  select * into t from rede_ato_tarefas where id = p_tarefa for update;
  if not found then perform interno.erro('nao_encontrado'); end if;
  p := interno.rede_ato_achar(t.ato, v);
  v_org := interno.rede_age_como(v, p.autor);
  if coalesce(p_sim, true) then
    perform interno.rede_ato_aberto(t.ato, v);
    if not exists (select 1 from rede_ato_tarefa_quem where tarefa = t.id and usuario = v) then
      if (select count(*) from rede_ato_tarefa_quem where tarefa = t.id) >= t.quantos then perform interno.erro('tarefa_completa'); end if;
      insert into rede_ato_tarefa_quem (tarefa, usuario) values (t.id, v);
    end if;
  else
    delete from rede_ato_tarefa_quem where tarefa = t.id and usuario = v;
  end if;
  return jsonb_build_object('organiza', v_org, 'tarefas', interno.rede_ato_tarefas_json(t.ato, v, v_org));
end $$;

-- ── 5. Caronas e ônibus ─────────────────────────────────────────────────────────────────────────────────────────────────────
create table if not exists interno.rede_ato_caronas (
  id uuid primary key default gen_random_uuid(),
  ato uuid not null references interno.rede_chamados (post) on delete cascade,
  tipo text not null check (tipo in ('oferta', 'pedido')),
  meio text not null default 'carro' check (meio in ('carro', 'onibus', 'van', 'bicicleta', 'a_pe', 'outro')),
  saida_publica text not null check (char_length(saida_publica) between 3 and 100),
  vagas smallint check (vagas is null or vagas between 0 and 60),
  sai_em timestamptz,
  quem uuid not null references interno.perfis (id) on delete cascade,
  criado_em timestamptz not null default now()
);
create index if not exists rede_ato_caronas_ato on interno.rede_ato_caronas (ato, criado_em);
create index if not exists rede_ato_caronas_quem on interno.rede_ato_caronas (quem);
alter table interno.rede_ato_caronas enable row level security;
revoke all on table interno.rede_ato_caronas from public;

/**
 * As caronas do ato, sem quem: `minha` diz só se é desta pessoa; `apagar` se ela pode tirar (a dona ou quem organiza). No máximo
 * 200 (o mesmo teto da criação), as da pessoa primeiro.
 */
create or replace function interno.rede_ato_caronas_json(p_ato uuid, p_quem uuid, p_organiza boolean) returns jsonb
language sql stable security definer set search_path = interno, pg_temp as $$
  select coalesce(jsonb_agg(jsonb_build_object(
      'id', k.id, 'tipo', k.tipo, 'meio', k.meio, 'saida', k.saida_publica, 'vagas', k.vagas, 'sai_em', k.sai_em,
      'minha', k.quem = p_quem, 'apagar', k.quem = p_quem or p_organiza
    ) order by k.tipo, k.sai_em nulls last, k.criado_em, k.id), '[]'::jsonb)
    from (select * from rede_ato_caronas x
           where x.ato = p_ato and not interno.rede_bloqueado(x.quem, p_quem)
           order by (x.quem = p_quem) desc, x.criado_em, x.id limit 200) k
$$;

/** As caronas de um ato. Só membro (18+) que vê o ato: a lista de caronas não é para a internet aberta. */
create or replace function public.rede_ato_caronas(p_ato uuid) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); p rede_posts;
begin
  perform interno.aberta('comunidade');
  if not interno.rede2_membro(v) then perform interno.erro('consentimento'); end if;
  perform interno.limite('alumia_atos_ler', 300, 60);
  p := interno.rede_ato_achar(p_ato, v);
  return interno.rede_ato_caronas_json(p_ato, v, interno.rede_age_como(v, p.autor));
end $$;

/**
 * Oferecer ou pedir carona. p: {tipo 'oferta'|'pedido', meio, saida (3–100, o ponto PÚBLICO de saída: "Metrô Itaquera, saída B"),
 * vagas (1–60, opcional), sai_em (ISO, opcional, até 24 h antes do ato e não depois dele)}. Nada de telefone, e-mail, documento
 * nem endereço com número. Até 2 por pessoa por ato. Devolve a lista.
 */
create or replace function public.rede_ato_carona_criar(p_ato uuid, p jsonb) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare
  v uuid := interno.eu(); x rede_posts; c rede_chamados;
  v_tipo text := btrim(coalesce(p ->> 'tipo', ''));
  v_meio text := coalesce(nullif(btrim(coalesce(p ->> 'meio', '')), ''), 'carro');
  v_saida text; v_vagas integer; v_sai timestamptz;
begin
  perform interno.aberta('comunidade');
  if not interno.rede2_membro(v) then perform interno.erro('consentimento'); end if;
  if p is null or jsonb_typeof(p) is distinct from 'object' then perform interno.erro('invalido:carona'); end if;
  x := interno.rede_ato_achar(p_ato, v);
  c := interno.rede_ato_aberto(p_ato, v);
  if v_tipo not in ('oferta', 'pedido') then perform interno.erro('invalido:tipo'); end if;
  if v_meio not in ('carro', 'onibus', 'van', 'bicicleta', 'a_pe', 'outro') then perform interno.erro('invalido:meio'); end if;
  v_saida := regexp_replace(interno.txt(p ->> 'saida', 'saida', 3, 100), '\s+', ' ', 'g');
  begin
    v_vagas := nullif(btrim(coalesce(p ->> 'vagas', '')), '')::integer;
    v_sai := nullif(btrim(coalesce(p ->> 'sai_em', '')), '')::timestamptz;
  exception when others then perform interno.erro('invalido:vagas');
  end;
  if v_vagas is not null and v_vagas not between 1 and 60 then perform interno.erro('invalido:vagas'); end if;
  if v_sai is not null and (v_sai < c.inicio - interval '24 hours' or v_sai > c.inicio or v_sai < now() - interval '1 hour') then perform interno.erro('invalido:sai_em'); end if;
  if interno.rede3_pub_dado_pessoal(v_saida) or v_saida ~ '\d{4,5}[-\s]?\d{4}' then perform interno.erro('dado_pessoal'); end if;
  if (select count(*) from rede_ato_caronas where ato = p_ato and quem = v) >= 2 then perform interno.erro('invalido:caronas'); end if;
  if (select count(*) from rede_ato_caronas where ato = p_ato) >= 200 then perform interno.erro('invalido:caronas_do_ato'); end if;
  perform interno.limite('alumia_ato_carona', 10, 1440);
  insert into rede_ato_caronas (ato, tipo, meio, saida_publica, vagas, sai_em, quem) values (p_ato, v_tipo, v_meio, v_saida, v_vagas, v_sai, v);
  return interno.rede_ato_caronas_json(p_ato, v, interno.rede_age_como(v, x.autor));
end $$;

/** A dona muda as vagas (0 = lotada). */
create or replace function public.rede_ato_carona_vagas(p_id uuid, p_vagas integer) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); k rede_ato_caronas; x rede_posts;
begin
  perform interno.aberta('comunidade');
  if not interno.rede2_membro(v) then perform interno.erro('consentimento'); end if;
  select * into k from rede_ato_caronas where id = p_id;
  if not found or k.quem <> v then perform interno.erro('nao_encontrado'); end if;
  if p_vagas is not null and p_vagas not between 0 and 60 then perform interno.erro('invalido:vagas'); end if;
  perform interno.limite('alumia_ato_carona_mudar', 60, 60);
  x := interno.rede_ato_achar(k.ato, v);
  update rede_ato_caronas set vagas = p_vagas where id = p_id;
  return interno.rede_ato_caronas_json(k.ato, v, interno.rede_age_como(v, x.autor));
end $$;

/**
 * Tirar uma carona: a dona, ou quem organiza o ato (contra abuso). Quando é quem organiza tirando a de outra pessoa, vai a
 * interno.auditoria (quem tirou, o ato, o tipo e o meio), SEM dizer de quem era a carona.
 */
create or replace function public.rede_ato_carona_apagar(p_id uuid) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); k rede_ato_caronas; x rede_posts; v_org boolean;
begin
  perform interno.aberta('comunidade');
  if not interno.rede2_membro(v) then perform interno.erro('consentimento'); end if;
  select * into k from rede_ato_caronas where id = p_id;
  if not found then perform interno.erro('nao_encontrado'); end if;
  x := interno.rede_ato_achar(k.ato, v);
  v_org := interno.rede_age_como(v, x.autor);
  if k.quem <> v and not v_org then perform interno.erro('nao_encontrado'); end if;
  perform interno.limite('alumia_ato_carona_mudar', 60, 60);
  if k.quem <> v then
    insert into auditoria (quem, nome, acao, alvo, detalhes)
    values (v, '', 'ato_carona_tirada', k.ato::text, jsonb_build_object('tipo', k.tipo, 'meio', k.meio));
  end if;
  delete from rede_ato_caronas where id = p_id;
  return interno.rede_ato_caronas_json(k.ato, v, v_org);
end $$;

-- ── 6. Petição sem lista ────────────────────────────────────────────────────────────────────────────────────────────────────
create table if not exists interno.rede_peticoes (
  id uuid primary key default gen_random_uuid(),
  post uuid not null unique references interno.rede_chamados (post) on delete cascade,
  alvo text not null check (char_length(alvo) between 3 and 120),
  texto text not null check (char_length(texto) between 20 and 1500),
  prazo timestamptz,
  encerrada boolean not null default false,
  criada_em timestamptz not null default now()
);
create table if not exists interno.rede_peticao_assinaturas (
  peticao uuid not null references interno.rede_peticoes (id) on delete cascade,
  usuario uuid not null references interno.perfis (id) on delete cascade,
  criado_em timestamptz not null default now(),
  primary key (peticao, usuario)
);
create index if not exists rede_peticao_assinaturas_usuario on interno.rede_peticao_assinaturas (usuario);
alter table interno.rede_peticoes enable row level security;
alter table interno.rede_peticao_assinaturas enable row level security;
revoke all on table interno.rede_peticoes, interno.rede_peticao_assinaturas from public;

/** Assinaturas no último marco (a mesma regra do mosaico: ninguém vê o efeito do próprio toque). */
create or replace function interno.rede_peticao_publicada(p_peticao uuid) returns bigint language sql stable security definer set search_path = interno, pg_temp as $$
  select (select count(*) from rede_peticao_assinaturas a where a.peticao = p_peticao and a.criado_em <= interno.rede_contagem_marco())
       + (select count(*) from rede_contagem_saidas s where s.alvo = p_peticao
            and s.entrou_em <= interno.rede_contagem_marco() and s.saiu_em > interno.rede_contagem_marco())
$$;

create or replace function interno.rede_peticao_saiu() returns trigger language plpgsql security definer set search_path = interno, pg_temp as $$
begin
  if old.criado_em <= interno.rede_contagem_marco() and exists (select 1 from rede_peticoes where id = old.peticao) then
    insert into rede_contagem_saidas (alvo, entrou_em) values (old.peticao, old.criado_em);
  end if;
  return old;
end $$;
drop trigger if exists rede_peticao_saiu on interno.rede_peticao_assinaturas;
create trigger rede_peticao_saiu after delete on interno.rede_peticao_assinaturas for each row execute function interno.rede_peticao_saiu();

/** A petição como a tela recebe. `total`: assinaturas publicadas, nulo abaixo de 3 (para todo mundo, inclusive quem criou). Nunca quem. */
create or replace function interno.rede_peticao_json(t interno.rede_peticoes, p_quem uuid, p_organiza boolean) returns jsonb
language plpgsql stable security definer set search_path = interno, pg_temp as $$
declare v_n bigint := interno.rede_peticao_publicada(t.id);
begin
  return jsonb_build_object(
    'id', t.id, 'ato', t.post, 'alvo', t.alvo, 'texto', t.texto, 'prazo', t.prazo,
    'aberta', not t.encerrada and (t.prazo is null or t.prazo > now()),
    'total', case when v_n >= 3 then v_n end,
    'assinei', p_quem is not null and exists (select 1 from rede_peticao_assinaturas a where a.peticao = t.id and a.usuario = p_quem),
    'organiza', p_organiza);
end $$;

/** A petição de um ato (nula se não há). Visitante lê se o ato é público na internet. */
create or replace function public.rede_peticao(p_ato uuid) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := auth.uid(); p rede_posts; t rede_peticoes;
begin
  perform interno.aberta('comunidade');
  if v is not null and exists (select 1 from perfis where id = v and suspenso) then perform interno.erro('conta_suspensa'); end if;
  perform interno.limite('alumia_atos_ler', 300, 60);
  p := interno.rede_ato_achar(p_ato, v);
  select * into t from rede_peticoes where post = p_ato;
  if not found then return null; end if;
  return interno.rede_peticao_json(t, v, v is not null and interno.rede_age_como(v, p.autor));
end $$;

/**
 * Só quem organiza o ato abre a petição dele (uma por ato). p: {alvo 3–120, texto 20–1500, prazo ISO opcional até 365 dias}.
 * Ato cancelado não abre petição; ato que já passou abre (de propósito: a pauta continua depois do dia; cabeçalho, item 5).
 */
create or replace function public.rede_peticao_criar(p_ato uuid, p jsonb) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); x rede_posts; t rede_peticoes; v_alvo text; v_texto text; v_prazo timestamptz; v_tri jsonb;
begin
  perform interno.aberta('comunidade');
  if not interno.rede2_membro(v) then perform interno.erro('consentimento'); end if;
  if p is null or jsonb_typeof(p) is distinct from 'object' then perform interno.erro('invalido:peticao'); end if;
  x := interno.rede_ato_achar(p_ato, v);
  if not interno.rede_age_como(v, x.autor) then perform interno.erro('so_quem_organizou'); end if;
  if x.oculto or x.retido or x.apagado_em is not null then perform interno.erro('nao_encontrado'); end if;
  if exists (select 1 from rede_chamados where post = p_ato and situacao = 'cancelado') then perform interno.erro('ato_cancelado'); end if;
  if exists (select 1 from rede_peticoes where post = p_ato) then perform interno.erro('peticao_existe'); end if;
  v_alvo := regexp_replace(interno.txt(p ->> 'alvo', 'alvo', 3, 120), '\s+', ' ', 'g');
  v_texto := interno.txt(p ->> 'texto', 'texto', 20, 1500);
  begin
    v_prazo := nullif(btrim(coalesce(p ->> 'prazo', '')), '')::timestamptz;
  exception when others then perform interno.erro('invalido:prazo');
  end;
  if v_prazo is not null and (v_prazo <= now() or v_prazo > now() + interval '365 days') then perform interno.erro('invalido:prazo'); end if;
  if interno.rede3_pub_dado_pessoal(v_alvo || ' ' || v_texto) then perform interno.erro('dado_pessoal'); end if;
  -- A triagem de sempre: o que ela não deixaria publicar também não vira petição.
  v_tri := interno.rede_triagem(v_alvo || ' ' || v_texto, v);
  if (v_tri ->> 'veredito') <> 'publicar' then perform interno.erro('invalido:triagem'); end if;
  perform interno.limite('alumia_peticao_criar', 5, 1440);
  insert into rede_peticoes (post, alvo, texto, prazo) values (p_ato, v_alvo, v_texto, v_prazo) returning * into t;
  return interno.rede_peticao_json(t, v, true);
end $$;

/**
 * Assinar (p_sim) ou tirar a assinatura (sempre pode, LGPD art. 18, IX). Petição encerrada ou vencida não recebe assinatura nova.
 * A data do ato não conta (a petição vive mais que o ato; cabeçalho, item 5).
 */
create or replace function public.rede_peticao_assinar(p_peticao uuid, p_sim boolean) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); t rede_peticoes; x rede_posts;
begin
  perform interno.aberta('comunidade');
  if not interno.rede2_membro(v) then perform interno.erro('consentimento'); end if;
  perform interno.rede2_limite('reagir');
  select * into t from rede_peticoes where id = p_peticao;
  if not found then perform interno.erro('nao_encontrado'); end if;
  x := interno.rede_ato_achar(t.post, v);
  if coalesce(p_sim, true) then
    if t.encerrada or (t.prazo is not null and t.prazo <= now()) then perform interno.erro('peticao_encerrada'); end if;
    if x.oculto or x.retido or x.apagado_em is not null then perform interno.erro('nao_encontrado'); end if;
    insert into rede_peticao_assinaturas (peticao, usuario) values (t.id, v) on conflict do nothing;
  else
    delete from rede_peticao_assinaturas where peticao = t.id and usuario = v;
  end if;
  return interno.rede_peticao_json(t, v, interno.rede_age_como(v, x.autor));
end $$;

/** Só quem organiza: encerra a petição (o total publicado fica; assinatura nova não entra). */
create or replace function public.rede_peticao_encerrar(p_peticao uuid) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); t rede_peticoes; x rede_posts;
begin
  perform interno.aberta('comunidade');
  if not interno.rede2_membro(v) then perform interno.erro('consentimento'); end if;
  select * into t from rede_peticoes where id = p_peticao;
  if not found then perform interno.erro('nao_encontrado'); end if;
  x := interno.rede_ato_achar(t.post, v);
  if not interno.rede_age_como(v, x.autor) then perform interno.erro('so_quem_organizou'); end if;
  perform interno.limite('alumia_ato_mudar', 20, 60);
  update rede_peticoes set encerrada = true where id = p_peticao returning * into t;
  return interno.rede_peticao_json(t, v, true);
end $$;

-- ── 7. Lembretes de 24 h e 2 h ──────────────────────────────────────────────────────────────────────────────────────────────

/** Adiar o ato (mudar a data) zera os lembretes: eles saem de novo para a data nova. */
create or replace function interno.rede_ato_lembrete_zerar() returns trigger language plpgsql security definer set search_path = interno, pg_temp as $$
begin
  if new.inicio is distinct from old.inicio then
    new.lembrete_24h_em := null;
    new.lembrete_2h_em := null;
  end if;
  return new;
end $$;
drop trigger if exists rede_ato_lembrete_zerar on interno.rede_chamados;
create trigger rede_ato_lembrete_zerar before update of inicio on interno.rede_chamados for each row execute function interno.rede_ato_lembrete_zerar();

/**
 * A rodada dos lembretes (pg_cron de 15 em 15 min; só o dono do banco chama). Para cada ato não cancelado que começa nas próximas
 * 24 h: 2 h antes sai o lembrete das 2 h; antes disso, o das 24 h (só se ainda faltam 12 h ou mais: ato chamado em cima da hora
 * recebe só o das 2 h). Vai a quem confirmou, é membro, ainda vê o ato e não desligou "lembrete"; o aviso tem tipo 'chamado' (o
 * enviar-push manda SEM texto) e um texto sem nome de ninguém (a reserva em português; a tela de avisos traduz). Nada fica guardado por pessoa: só a hora em que o lembrete do ato saiu.
 */
create or replace function interno.rede_ato_lembretes() returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare c rede_chamados; p rede_posts; r record; v_texto text; v_qual text; v_atos integer := 0; v_avisos integer := 0; v_n bigint;
begin
  for c in select * from rede_chamados
            where situacao <> 'cancelado' and inicio > now() and inicio <= now() + interval '24 hours' and lembrete_2h_em is null
            order by inicio limit 500 for update skip locked loop
    -- O teto da rodada: o ato que não cabe inteiro nos 5000 avisos fica para a próxima (o primeiro sempre entra).
    if v_avisos > 0 then
      select count(*) into v_n from rede_vou where post = c.post;
      if v_avisos + v_n > 5000 then exit; end if;
    end if;
    if c.inicio <= now() + interval '2 hours' then
      v_qual := '2h';
      v_texto := 'Lembrete: um ato que você confirmou começa em menos de 2 horas.';
    elsif c.lembrete_24h_em is null then
      v_qual := '24h';
      v_texto := 'Lembrete: um ato que você confirmou começa em menos de 24 horas.';
    else
      continue;
    end if;
    select * into p from rede_posts where id = c.post;
    if v_qual = '24h' and c.inicio < now() + interval '12 hours' then
      update rede_chamados set lembrete_24h_em = now() where post = c.post;
      continue;
    end if;
    if found and p.apagado_em is null and not p.oculto and not p.retido then
      for r in select o.usuario from rede_vou o where o.post = c.post loop
        if interno.rede2_membro(r.usuario) and interno.rede3_aviso_pref(r.usuario, 'lembrete', 'site') and interno.rede_ve(p, r.usuario) then
          perform interno.rede3_aviso_criar(r.usuario, 'chamado', c.post, null, null, v_texto);
          v_avisos := v_avisos + 1;
        end if;
      end loop;
    end if;
    if v_qual = '2h' then
      update rede_chamados set lembrete_2h_em = now(), lembrete_24h_em = coalesce(lembrete_24h_em, now()) where post = c.post;
    else
      update rede_chamados set lembrete_24h_em = now() where post = c.post;
    end if;
    v_atos := v_atos + 1;
  end loop;
  delete from rede_contagem_saidas where saiu_em < now() - interval '1 hour';
  return jsonb_build_object('atos', v_atos, 'avisos', v_avisos);
end $$;

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule('alumia-atos-lembretes', '*/15 * * * *', 'select interno.rede_ato_lembretes()');
  end if;
exception when others then null;
end $$;

-- ── 8. Permissões ───────────────────────────────────────────────────────────────────────────────────────────────────────────
revoke all on function interno.rede_contagem_marco(), interno.rede_vou_publicado(uuid), interno.rede_vou_saiu(),
  interno.rede_ato_aberto(uuid, uuid), interno.rede_ato_tarefas_json(uuid, uuid, boolean), interno.rede_ato_caronas_json(uuid, uuid, boolean),
  interno.rede_peticao_publicada(uuid), interno.rede_peticao_saiu(), interno.rede_peticao_json(interno.rede_peticoes, uuid, boolean),
  interno.rede_ato_lembrete_zerar(), interno.rede_ato_lembretes() from public;
revoke all on function public.rede_ato_editar(uuid, jsonb), public.rede_ato_tarefas(uuid), public.rede_ato_tarefa_criar(uuid, text, integer),
  public.rede_ato_tarefa_apagar(uuid), public.rede_ato_tarefa_assumir(uuid, boolean), public.rede_ato_caronas(uuid),
  public.rede_ato_carona_criar(uuid, jsonb), public.rede_ato_carona_vagas(uuid, integer), public.rede_ato_carona_apagar(uuid),
  public.rede_peticao(uuid), public.rede_peticao_criar(uuid, jsonb), public.rede_peticao_assinar(uuid, boolean), public.rede_peticao_encerrar(uuid) from public;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on table interno.rede_contagem_saidas, interno.rede_ato_tarefas, interno.rede_ato_tarefa_quem, interno.rede_ato_caronas,
      interno.rede_peticoes, interno.rede_peticao_assinaturas from anon, authenticated;
    revoke all on function interno.rede_contagem_marco(), interno.rede_vou_publicado(uuid), interno.rede_vou_saiu(),
      interno.rede_ato_aberto(uuid, uuid), interno.rede_ato_tarefas_json(uuid, uuid, boolean), interno.rede_ato_caronas_json(uuid, uuid, boolean),
      interno.rede_peticao_publicada(uuid), interno.rede_peticao_saiu(), interno.rede_peticao_json(interno.rede_peticoes, uuid, boolean),
      interno.rede_ato_lembrete_zerar(), interno.rede_ato_lembretes() from anon, authenticated;
    revoke all on function public.rede_ato_editar(uuid, jsonb), public.rede_ato_tarefa_criar(uuid, text, integer), public.rede_ato_tarefa_apagar(uuid),
      public.rede_ato_tarefa_assumir(uuid, boolean), public.rede_ato_caronas(uuid), public.rede_ato_carona_criar(uuid, jsonb),
      public.rede_ato_carona_vagas(uuid, integer), public.rede_ato_carona_apagar(uuid), public.rede_peticao_criar(uuid, jsonb),
      public.rede_peticao_assinar(uuid, boolean), public.rede_peticao_encerrar(uuid) from anon;
    -- Ler tarefas e petição: visitante também (só de ato público na internet). Caronas: só membro.
    grant execute on function public.rede_ato_tarefas(uuid), public.rede_peticao(uuid) to anon, authenticated, service_role;
    grant execute on function public.rede_ato_editar(uuid, jsonb), public.rede_ato_tarefa_criar(uuid, text, integer), public.rede_ato_tarefa_apagar(uuid),
      public.rede_ato_tarefa_assumir(uuid, boolean), public.rede_ato_caronas(uuid), public.rede_ato_carona_criar(uuid, jsonb),
      public.rede_ato_carona_vagas(uuid, integer), public.rede_ato_carona_apagar(uuid), public.rede_peticao_criar(uuid, jsonb),
      public.rede_peticao_assinar(uuid, boolean), public.rede_peticao_encerrar(uuid) to authenticated, service_role;
  end if;
end $$;

-- ═══════════════════════════ fim do B1 dos atos ═══════════════════════════
