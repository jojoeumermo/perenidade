-- ─────────────── Alumia · beta: os consertos do chat e da privacidade do Fediverso que ainda faltavam ───────────────
-- Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
--
-- Fica no fim do install.sql. Pode rodar mais de uma vez (cada parte confere o que já está feito). Testes: npm run testar:rede-chat
-- (a regra da tabela do chat) e npm run testar:fediverso-banco (a parte do Fediverso). Documentos: docs/rede/CHAT-PRIVADO.md e
-- docs/rede/FEDIVERSO.md.
--
--   1. Chat: a regra da tabela das mensagens (rede_dm_mensagens_corpo_formato, a de 20261113-chat-olm.sql) passa a exigir que a
--      versão escrita no corpo ("c2.<versão>.", "c3.<versão>." ou "m1.<versão>.") seja a da coluna "versao". É a coluna que diz
--      ao aparelho qual chave usar e que a faxina olha: uma linha não pode dizer uma versão na coluna e outra no corpo. Todo envio
--      já grava as duas iguais (a função confere o corpo com a versão pedida e grava a mesma), então nenhuma linha de hoje é
--      recusada. A regra antiga sai e a nova entra no MESMO comando: se alguma linha não bater, nada muda (a tabela nunca fica
--      sem regra) e o comando falha dizendo qual regra.
--   2. Fediverso: curtida e impulso de fora não guardam mais o endereço de QUEM foi. A linha do aviso leva só um apelido: o
--      HMAC-SHA256 (do pgcrypto) de um segredo próprio deste banco, de quem recebe e do endereço de quem curtiu. O mesmo par dá
--      sempre o mesmo apelido (o total de pessoas e o desfazer continuam certos), e o apelido de alguém muda de uma conta daqui
--      para outra (duas contas não cruzam o que guardam). A linha da interação (fediverso_interacoes, entrada sobre post daqui)
--      também guarda só um apelido do ator (rede_fed_apelido_ator, o mesmo segredo, sem a conta), que serve para não contar duas
--      vezes e para o desfazer. As linhas e os avisos já guardados trocam na hora. O "ator apagado" (Delete de uma conta de fora)
--      acha as linhas e os avisos pelo apelido, calculado na hora. Limite: o segredo mora neste banco; o apelido protege as telas
--      e as funções, não uma cópia inteira do banco (quem tiver a cópia pode testar os endereços que conhece).
--   3. Fediverso: o histórico do consentimento tem teto por pessoa (a primeira linha e as 99 mais novas).
--   4. Fediverso: public.rede_fed_bloqueou_voce(p_nota): a nota que o banco guarda é de quem bloqueou a pessoa? A rota do fio
--      (app/api/fediverso/remoto) responde "não achamos isto" sem oferecer "buscar lá" nesse caso.
--   5. Fediverso: o domínio da conta (rede_fed_situacao, chave "dominio") sai só para quem está com a federação ligada, como o
--      endereço.
-- Os pedidos P18 e P19 (20261113-alumia-o7-pedidos.sql: o "baixar meus dados" e as listas antigas de avisos sem curtida e impulso
-- de fora) continuam valendo: nada aqui mexe nessas funções.

-- ── 1. Chat: a versão do corpo é a da coluna ─────────────────────────────────────────────────────────────────────────────

alter table interno.rede_dm_mensagens
  drop constraint if exists rede_dm_mensagens_corpo_formato,
  add constraint rede_dm_mensagens_corpo_formato check (
    split_part(corpo, '.', 2) = versao::text and (
      (char_length(corpo) <= 12000 and (
        (corpo ~ '^c3\.[1-9][0-9]{0,6}\.[A-Za-z0-9_-]{16}\.[A-Za-z0-9_-]+$'
          and char_length(split_part(corpo, '.', 4)) in (363, 704, 1387, 2752, 5483, 8214, 10944))
        or corpo ~ '^c2\.[1-9][0-9]{0,6}\.[A-Za-z0-9_-]{16}\.[A-Za-z0-9_-]{23,}$'))
      or (char_length(corpo) <= 15000 and corpo ~ '^m1\.[1-9][0-9]{0,6}\.[A-Za-z0-9+/]{43}\.[A-Za-z0-9+/]+$'
          and char_length(split_part(corpo, '.', 4)) in (723, 1192, 2088, 3923, 7550, 11198, 14846))
    )
  );

-- ── 2. Fediverso: curtida e impulso de fora guardam só um apelido ────────────────────────────────────────────────────────

-- O segredo do apelido: uma linha só, sorteada uma vez (rodar de novo não troca: os apelidos já gravados continuam valendo).
-- Ninguém lê esta tabela (RLS ligada, sem política, sem permissão); só interno.rede_fed_apelido, como dona.
create table if not exists interno.rede_fed_apelido_segredo (
  unico boolean primary key default true check (unico),
  valor text not null check (valor ~ '^[0-9a-f]{64}$')
);
alter table interno.rede_fed_apelido_segredo enable row level security;
revoke all on interno.rede_fed_apelido_segredo from public;
do $$
declare v_esq text := interno.cripto_esquema(); v text;
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on interno.rede_fed_apelido_segredo from anon, authenticated;
  end if;
  if not exists (select 1 from interno.rede_fed_apelido_segredo) then
    execute format('select encode(%I.gen_random_bytes(32), ''hex'')', v_esq) into v;
    insert into interno.rede_fed_apelido_segredo (valor) values (v) on conflict (unico) do nothing;
  end if;
end $$;

/** O apelido de quem curtiu ou impulsionou, para uma conta daqui: "anon:" e o HMAC-SHA256 (64 algarismos hexadecimais). */
create or replace function interno.rede_fed_apelido(p_para uuid, p_ator text) returns text language plpgsql stable security definer set search_path = interno, pg_temp as $$
declare v_esq text := interno.cripto_esquema(); v text;
begin
  execute format('select encode(%I.hmac(convert_to($1, ''UTF8''), convert_to($2, ''UTF8''), ''sha256''), ''hex'')', v_esq)
    into v using p_para::text || ':' || coalesce(p_ator, ''), (select s.valor from rede_fed_apelido_segredo s);
  return 'anon:' || v;
end $$;

/** O apelido do ator numa interação sobre post daqui (sem a conta que recebe): "anon:" e o HMAC-SHA256. */
create or replace function interno.rede_fed_apelido_ator(p_ator text) returns text language plpgsql stable security definer set search_path = interno, pg_temp as $$
declare v_esq text := interno.cripto_esquema(); v text;
begin
  execute format('select encode(%I.hmac(convert_to($1, ''UTF8''), convert_to($2, ''UTF8''), ''sha256''), ''hex'')', v_esq)
    into v using 'interacao:' || coalesce(p_ator, ''), (select s.valor from rede_fed_apelido_segredo s);
  return 'anon:' || v;
end $$;

-- A regra da coluna aceita o apelido (antes, só endereço https). A antiga sai, com o nome que tiver, e a nova entra com nome fixo,
-- num bloco só.
do $$
declare r record;
begin
  for r in select conname from pg_constraint
           where conrelid = 'interno.avisos'::regclass and contype = 'c' and pg_get_constraintdef(oid) like '%ator_remoto%' loop
    execute format('alter table interno.avisos drop constraint %I', r.conname);
  end loop;
  alter table interno.avisos add constraint avisos_ator_remoto_formato check (
    ator_remoto is null or (char_length(ator_remoto) <= 500 and (ator_remoto ~ '^https://' or ator_remoto ~ '^anon:[0-9a-f]{64}$'))
  );
end $$;

/**
 * Um aviso de algo que veio de fora (igual ao de 20261109-fediverso-total.sql), com uma diferença: em curtida e impulso, a linha
 * guarda o apelido de quem foi, nunca o endereço. O silêncio e o bloqueio continuam conferidos pelo endereço, antes.
 */
create or replace function interno.rede_fed_avisar(p_para uuid, p_tipo text, p_post uuid, p_ator text, p_objeto text default null) returns void
language plpgsql security definer set search_path = interno, pg_temp as $$
begin
  if p_para is null or p_tipo not in ('fed_seguidor', 'fed_resposta', 'fed_mencao', 'fed_curtida', 'fed_impulso') or coalesce(p_ator, '') !~ '^https://' then return; end if;
  if not exists (select 1 from perfis where id = p_para and not suspenso) then return; end if;
  if exists (select 1 from fediverso_filtros f where f.usuario = p_para and f.ator = p_ator) then return; end if;
  insert into avisos (para, texto, categoria, tipo, post, ator_remoto, objeto_remoto)
  values (p_para, case p_tipo
      when 'fed_seguidor' then 'Uma pessoa de outro servidor do Fediverso começou a seguir você.'
      when 'fed_resposta' then 'Uma pessoa de outro servidor do Fediverso respondeu ao seu post.'
      when 'fed_mencao' then 'Uma pessoa de outro servidor do Fediverso mencionou você.'
      when 'fed_curtida' then 'Uma pessoa de outro servidor do Fediverso curtiu o seu post.'
      else 'Uma pessoa de outro servidor do Fediverso impulsionou o seu post.' end,
    'rede', p_tipo, p_post,
    case when p_tipo in ('fed_curtida', 'fed_impulso') then interno.rede_fed_apelido(p_para, left(p_ator, 500)) else left(p_ator, 500) end,
    case when coalesce(p_objeto, '') ~ '^https://' then left(p_objeto, 500) end)
  on conflict do nothing;
end $$;

-- Os avisos de curtida e impulso que já estavam guardados trocam o endereço pelo apelido (rodar de novo não acha mais nenhum).
update interno.avisos set ator_remoto = interno.rede_fed_apelido(para, ator_remoto)
where tipo in ('fed_curtida', 'fed_impulso') and ator_remoto ~ '^https://';

-- A interação de fora sobre post daqui guarda o apelido do ator, não o endereço. A regra da coluna passa a aceitar o apelido
-- (a antiga sai, com o nome que tiver, e a nova entra com nome fixo) e as linhas já guardadas trocam (rodar de novo não acha
-- mais nenhuma). A interação sobre nota de fora (objeto_remoto) continua com o endereço: é ela que põe o impulso na linha de
-- quem segue o ator.
do $$
declare r record;
begin
  for r in select conname from pg_constraint
           where conrelid = 'interno.fediverso_interacoes'::regclass and contype = 'c' and pg_get_constraintdef(oid) like '%ator ~%'
             and pg_get_constraintdef(oid) not like '%direcao%' loop
    execute format('alter table interno.fediverso_interacoes drop constraint %I', r.conname);
  end loop;
  alter table interno.fediverso_interacoes add constraint fediverso_interacoes_ator_formato check (
    ator is null or (char_length(ator) <= 500 and (ator ~ '^https://' or (ator ~ '^anon:[0-9a-f]{64}$' and post_local is not null)))
  );
end $$;
update interno.fediverso_interacoes set ator = interno.rede_fed_apelido_ator(ator)
where direcao = 'entrada' and post_local is not null and ator ~ '^https://';

/**
 * As ações do servidor do site para a federação (corpo inteiro, igual ao de hoje), com três diferenças: a curtida e o impulso
 * de fora sobre post daqui gravam o apelido do ator (rede_fed_apelido_ator), nunca o endereço; o "ator apagado" apaga também as
 * interações e os avisos de curtida e impulso dele, achados pelo apelido; e o desfazer acha a interação e o aviso pelo apelido.
 */
CREATE OR REPLACE FUNCTION public.rede_fed_servidor(p_segredo text, p_acao text, p jsonb DEFAULT '{}'::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'interno', 'pg_temp'
AS $function$
declare
  a rede_fed_atores;
  f perfis;
  x rede_posts;
  v_limite integer;
  v_antes timestamptz;
  v_res jsonb;
  v_n integer;
  v_t smallint;
  v_ator text := left(coalesce(p ->> 'ator', ''), 500);
  v_q rede_fed_fila;
  v_d fediverso_dominios;
  v_i fediverso_interacoes;
  v_g fediverso_grupos;
  v_com rede_comunidades;
  v_tipo text; v_sim boolean; v_id text; v_ref text; v_vis text; v_html text; v_midia jsonb; v_dom text; v_slug text; v_prot text; v_texto text;
  v_post uuid; v_resp_local uuid; v_post_local uuid; v_autor uuid; v_perfil uuid; v_uuid uuid;
  v_segue boolean; v_resp_nota boolean; v_novo boolean; v_conexao boolean; v_impulso boolean;
  v_mencoes uuid[]; v_den uuid[];
  v_publicado timestamptz; v_status integer; v_espera integer;
begin
  perform interno.rede_fed_segredo(p_segredo);
  p := coalesce(p, '{}'::jsonb);
  if v_ator <> '' and v_ator !~ '^https://[^\s]+$' then perform interno.erro('invalido:ator'); end if;

  case p_acao
  when 'ator' then
    select * into a from rede_fed_atores where handle = lower(coalesce(p ->> 'handle', '')) order by ligado desc, desligado_em desc nulls first limit 1;
    if not found then return jsonb_build_object('estado', 'inexistente'); end if;
    select * into f from perfis where id = a.perfil;
    if a.ligado and interno.rede_fed_impedimento(a.perfil) is null then
      return jsonb_build_object('estado', 'ligado', 'perfil', a.perfil, 'handle', a.handle,
        -- O nome só sai quando o codinome passou pela conferência (rede_codinome_ok), como a bio; senão sai o @nome.
        'nome', case when f.rede_codinome_ok then coalesce(nullif(f.rede_codinome, ''), a.handle) else a.handle end,
        'bio', case when f.rede_codinome_ok then left(coalesce(f.rede_bio, ''), 500) else '' end, 'ligado_em', a.ligado_em,
        'chave_publica', a.chave_publica, 'chave_privada', a.chave_privada,
        -- Só o rosto e a capa da galeria (arquivos públicos do site). A imagem enviada pela pessoa só aparece para quem tem conta
        -- (rede_perfil_imagem): não sai para fora sem um consentimento próprio (LGPD art. 6º, III).
        'avatar_url', case when f.rede_avatar ~ '^a(0[1-9]|1[0-9]|2[0-4])$' then '/rede/avatares/' || f.rede_avatar || '.svg' end,
        'capa_url', case when f.rede_capa ~ '^c0[1-8]$' then '/rede/capas/' || f.rede_capa || '.svg' end,
        -- Perfil trancado não federa (rede_fed_impedimento, que o plano manda não mudar): aqui ele nunca chega, então trancado é
        -- sempre false e manuallyApprovesFollowers também. Abrir o trancado com aprovação manual é decisão à parte.
        'discoverable', a.descobrivel, 'trancado', false,
        'total', interno.rede_fed_total(), 'consentimento_versao', a.consentimento_versao);
    end if;
    -- Desligado com entregas ainda na fila (as retiradas): o ator continua com a chave, sem nada mais.
    if exists (select 1 from rede_fed_fila q where q.perfil = a.perfil and q.feito_em is null) and a.chave_publica is not null then
      return jsonb_build_object('estado', 'saindo', 'perfil', a.perfil, 'handle', a.handle, 'chave_publica', a.chave_publica, 'chave_privada', a.chave_privada);
    end if;
    return jsonb_build_object('estado', 'desligado');

  when 'chaves' then
    if coalesce(p ->> 'publica', '') !~ '^-----BEGIN PUBLIC KEY-----' or char_length(coalesce(p ->> 'privada', '')) < 100 then perform interno.erro('invalido:chave'); end if;
    update rede_fed_atores set chave_publica = p ->> 'publica', chave_privada = p ->> 'privada'
    where perfil = (p ->> 'perfil')::uuid and chave_publica is null;
    select * into a from rede_fed_atores where perfil = (p ->> 'perfil')::uuid;
    return jsonb_build_object('chave_publica', a.chave_publica, 'chave_privada', a.chave_privada);

  when 'instancia' then
    if (p ->> 'publica') is not null then
      if (p ->> 'publica') !~ '^-----BEGIN PUBLIC KEY-----' or char_length(coalesce(p ->> 'privada', '')) < 100 then perform interno.erro('invalido:chave'); end if;
      insert into configuracoes (chave, valor) values ('fediverso_instancia', jsonb_build_object('publica', p ->> 'publica', 'privada', p ->> 'privada'))
      on conflict (chave) do nothing;
    end if;
    return coalesce((select valor from configuracoes where chave = 'fediverso_instancia'), '{}'::jsonb);

  when 'outbox' then
    select * into a from rede_fed_atores where handle = lower(coalesce(p ->> 'handle', '')) and ligado;
    if not found then return jsonb_build_object('total', 0, 'itens', '[]'::jsonb); end if;
    v_limite := least(greatest(coalesce((p ->> 'limite')::integer, 20), 1), 40);
    v_antes := nullif(p ->> 'antes', '')::timestamptz;
    select count(*)::integer into v_n from rede_fed_enviados e where e.perfil = a.perfil and e.apagado_em is null;
    select coalesce(jsonb_agg(interno.rede_fed_post_json(r) order by r.criado_em desc), '[]'::jsonb) into v_res
    from (select r.* from rede_fed_enviados e join rede_posts r on r.id = e.post
          where e.perfil = a.perfil and e.apagado_em is null and (v_antes is null or r.criado_em < v_antes) and interno.rede_fed_federavel(r)
          order by r.criado_em desc limit v_limite) r;
    return jsonb_build_object('total', v_n, 'itens', v_res);

  when 'post' then
    begin
      select * into x from rede_posts where id = (p ->> 'id')::uuid;
    exception when others then
      return 'null'::jsonb;
    end;
    if not found or not interno.rede_fed_federavel(x) then
      -- Já saiu e foi retirado: a federação responde 410 (Gone) em vez de 404.
      if exists (select 1 from rede_fed_enviados e where e.post::text = p ->> 'id' and e.apagado_em is not null) then return jsonb_build_object('apagado', true); end if;
      return 'null'::jsonb;
    end if;
    return interno.rede_fed_post_json(x);

  when 'midia' then
    begin
      v_uuid := (p ->> 'id')::uuid;
    exception when others then
      return 'null'::jsonb;
    end;
    select * into x from rede_posts where id = (select m.post from rede_midia m where m.id = v_uuid);
    if not found or not interno.rede_fed_federavel(x) then return 'null'::jsonb; end if;
    return (select jsonb_build_object('caminho', m.caminho, 'tipo', m.tipo, 'alt', m.alt, 'largura', m.largura, 'altura', m.altura) from rede_midia m where m.id = v_uuid);

  when 'seguidores' then
    select * into a from rede_fed_atores where handle = lower(coalesce(p ->> 'handle', '')) and ligado;
    if not found then return jsonb_build_object('total', 0); end if;
    return jsonb_build_object('total', interno.rede_fed_piso((select count(*)::integer from rede_fed_seguidores where perfil = a.perfil)));

  when 'seguindo_publico' then
    select * into a from rede_fed_atores where handle = lower(coalesce(p ->> 'handle', '')) and ligado;
    if not found then return jsonb_build_object('total', 0); end if;
    return jsonb_build_object('total', interno.rede_fed_piso((select count(*)::integer from rede_fed_seguindo where perfil = a.perfil and aceito)));

  when 'seguidor' then
    select * into a from rede_fed_atores where handle = lower(coalesce(p ->> 'handle', '')) and ligado;
    if not found or interno.rede_fed_impedimento(a.perfil) is not null then return jsonb_build_object('ok', false, 'motivo', 'desligado'); end if;
    if interno.rede_fed_bloqueado(v_ator) or interno.rede_fed_bloqueado(p ->> 'inbox') then return jsonb_build_object('ok', false, 'motivo', 'bloqueado'); end if;
    if coalesce((p ->> 'sim')::boolean, true) then
      if exists (select 1 from fediverso_filtros ff where ff.usuario = a.perfil and ff.ator = v_ator and ff.tipo = 'bloqueio') then
        return jsonb_build_object('ok', false, 'motivo', 'bloqueado');
      end if;
      if coalesce(p ->> 'inbox', '') !~ '^https://[^\s]+$' or interno.rede_fed_dominio(p ->> 'inbox') <> interno.rede_fed_dominio(v_ator) then perform interno.erro('invalido:inbox'); end if;
      v_novo := null;
      insert into rede_fed_seguidores (perfil, ator, inbox, inbox_compartilhada, pedido)
      values (a.perfil, v_ator, p ->> 'inbox',
              case when coalesce(p ->> 'compartilhada', '') ~ '^https://[^\s]+$' and interno.rede_fed_dominio(p ->> 'compartilhada') = interno.rede_fed_dominio(v_ator) then p ->> 'compartilhada' end,
              left(coalesce(p ->> 'pedido', ''), 500))
      on conflict (perfil, ator) do update set inbox = excluded.inbox, inbox_compartilhada = excluded.inbox_compartilhada, pedido = excluded.pedido
      returning (xmax = 0) into v_novo;
      insert into rede_fed_fila (perfil, tipo, objeto, destino, extra) values (a.perfil, 'accept', v_ator, p ->> 'inbox', jsonb_build_object('pedido', left(coalesce(p ->> 'pedido', ''), 500)));
      delete from fediverso_bloqueios_recebidos where perfil = a.perfil and ator = v_ator;
      if coalesce(v_novo, false) and interno.rede_fed_total() then perform interno.rede_fed_avisar(a.perfil, 'fed_seguidor', null, v_ator, null); end if;
    else
      delete from rede_fed_seguidores where perfil = a.perfil and ator = v_ator;
      delete from avisos where para = a.perfil and tipo = 'fed_seguidor' and ator_remoto = v_ator;
    end if;
    return jsonb_build_object('ok', true, 'perfil', a.perfil);

  when 'remoto' then
    return coalesce((select to_jsonb(r) from rede_fed_remotos r where r.ator = v_ator or r.chave_id = left(coalesce(p ->> 'chave_id', ''), 600) limit 1), 'null'::jsonb);

  when 'remoto_salvar' then
    if v_ator = '' then perform interno.erro('invalido:ator'); end if;
    if interno.rede_fed_bloqueado(v_ator) then return jsonb_build_object('ok', false, 'motivo', 'bloqueado'); end if;
    insert into rede_fed_remotos (ator, chave_id, chave_publica, inbox, inbox_compartilhada, handle, nome, resumo, url, avatar, tipo, buscado_em)
    values (v_ator, left(p ->> 'chave_id', 600), left(p ->> 'chave_publica', 4000),
            case when coalesce(p ->> 'inbox', '') ~ '^https://[^\s]+$' then left(p ->> 'inbox', 500) end,
            case when coalesce(p ->> 'compartilhada', '') ~ '^https://[^\s]+$' then left(p ->> 'compartilhada', 500) end,
            left(p ->> 'handle', 200), left(p ->> 'nome', 200), left(p ->> 'resumo', 1000),
            case when coalesce(p ->> 'url', '') ~ '^https://[^\s]+$' then left(p ->> 'url', 500) end,
            case when coalesce(p ->> 'avatar', '') ~ '^https://[^\s"''<>]+$' and char_length(p ->> 'avatar') <= 500 then p ->> 'avatar' end,
            case when coalesce(p ->> 'tipo', '') ~ '^[A-Za-z]{2,40}$' then p ->> 'tipo' end, now())
    on conflict (ator) do update set chave_id = excluded.chave_id, chave_publica = excluded.chave_publica, inbox = excluded.inbox,
      inbox_compartilhada = excluded.inbox_compartilhada, handle = excluded.handle, nome = excluded.nome, resumo = excluded.resumo,
      url = excluded.url, avatar = coalesce(excluded.avatar, case when p ? 'avatar' then null else rede_fed_remotos.avatar end),
      tipo = coalesce(excluded.tipo, rede_fed_remotos.tipo), buscado_em = now();
    return jsonb_build_object('ok', true);

  when 'resposta_follow' then
    if coalesce((p ->> 'aceito')::boolean, false) then
      update rede_fed_seguindo set aceito = true where ator = v_ator and (pedido = coalesce(p ->> 'pedido', '') or coalesce(p ->> 'pedido', '') = '');
    else
      delete from rede_fed_seguindo where ator = v_ator and (pedido = coalesce(p ->> 'pedido', '') or coalesce(p ->> 'pedido', '') = '');
    end if;
    get diagnostics v_n = row_count;
    return jsonb_build_object('ok', v_n > 0);

  when 'ator_apagado' then
    -- Os avisos vão primeiro: os de curtida e impulso guardam só o apelido de quem foi (interno.rede_fed_apelido) e são achados
    -- pelas interações dele, que saem logo abaixo.
    delete from avisos where ator_remoto = v_ator
      or (tipo in ('fed_curtida', 'fed_impulso')
          and post in (select fi.post_local from fediverso_interacoes fi
                       where fi.direcao = 'entrada' and fi.ator = interno.rede_fed_apelido_ator(v_ator) and fi.post_local is not null)
          and ator_remoto = interno.rede_fed_apelido(para, v_ator));
    delete from rede_fed_seguidores where ator = v_ator;
    delete from rede_fed_seguindo where ator = v_ator;
    delete from rede_fed_recebidos where ator = v_ator;
    delete from rede_fed_remotos where ator = v_ator;
    delete from fediverso_interacoes where direcao = 'entrada' and ator in (v_ator, interno.rede_fed_apelido_ator(v_ator));
    delete from fediverso_grupo_seguidores where ator = v_ator;
    delete from fediverso_bloqueios_recebidos where ator = v_ator;
    return jsonb_build_object('ok', true);

  when 'recebido' then
    if not exists (select 1 from rede_fed_seguindo s where s.ator = v_ator and s.aceito) or interno.rede_fed_bloqueado(v_ator) then
      return jsonb_build_object('guardado', false);
    end if;
    if coalesce(p ->> 'id', '') !~ '^https://[^\s]+$' or interno.rede_fed_dominio(p ->> 'id') <> interno.rede_fed_dominio(v_ator) then perform interno.erro('invalido:id'); end if;
    insert into rede_fed_recebidos (id, ator, url, texto, aviso, publicado)
    values (left(p ->> 'id', 500), v_ator, case when coalesce(p ->> 'url', '') ~ '^https://[^\s]+$' then left(p ->> 'url', 500) end,
            left(coalesce(p ->> 'texto', ''), 3000), left(coalesce(p ->> 'aviso', ''), 200),
            least(coalesce(nullif(p ->> 'publicado', '')::timestamptz, now()), now()))
    on conflict (id) do update set texto = excluded.texto, aviso = excluded.aviso;
    return jsonb_build_object('guardado', true);

  when 'nota_recebida' then
    v_id := left(coalesce(p ->> 'id', ''), 500);
    if v_ator = '' then perform interno.erro('invalido:ator'); end if;
    if interno.rede_fed_bloqueado(v_ator) then return jsonb_build_object('guardado', false, 'motivo', 'bloqueado'); end if;
    if v_id !~ '^https://[^\s]+$' or interno.rede_fed_dominio(v_id) <> interno.rede_fed_dominio(v_ator) then perform interno.erro('invalido:id'); end if;
    v_vis := coalesce(nullif(p ->> 'visibilidade', ''), 'publico');
    -- Direto ou limitado: nunca guardado (a Alumia não tem DM federada); quem mandou recebe 202 do mesmo jeito.
    if v_vis not in ('publico', 'nao_listado', 'seguidores') then return jsonb_build_object('guardado', false, 'motivo', 'direto'); end if;
    v_segue := exists (select 1 from rede_fed_seguindo s where s.ator = v_ator and s.aceito);
    v_ref := nullif(left(coalesce(p ->> 'em_resposta_a', ''), 500), '');
    v_resp_local := null; v_post_local := null; v_resp_nota := false; v_mencoes := '{}';
    if interno.rede_fed_total() then
      v_resp_local := interno.rede_fed_post_local(v_ref);
      v_post_local := v_resp_local;
      if v_resp_local is null and v_ref is not null then
        select true, rc.post_local into v_resp_nota, v_post_local from rede_fed_recebidos rc where rc.id = v_ref;
        v_resp_nota := coalesce(v_resp_nota, false);
      end if;
      select coalesce(array_agg(distinct ra.perfil), '{}') into v_mencoes
      from jsonb_array_elements_text(case when jsonb_typeof(p -> 'mencoes_locais') = 'array' then p -> 'mencoes_locais' else '[]'::jsonb end) with ordinality h (nome, o)
      join rede_fed_atores ra on ra.handle = lower(split_part(btrim(h.nome, ' @'), '@', 1)) and ra.ligado
      where h.o <= 50 and interno.rede_fed_impedimento(ra.perfil) is null
        and not exists (select 1 from fediverso_bloqueios_recebidos b where b.perfil = ra.perfil and b.ator = v_ator);
    end if;
    -- Só-seguidores: só se alguém daqui segue o autor (e só essa pessoa vê: interno.rede_fed_nota_ve).
    if v_vis = 'seguidores' and not v_segue then return jsonb_build_object('guardado', false, 'motivo', 'sem_seguidor'); end if;
    -- Nota de quem ninguém segue, mas impulsionada por alguém que alguém daqui segue: fica guardada (só pública ou não listada).
    -- Quem diz que houve o impulso é o próprio banco (a ação 'interacao' já o gravou, com a assinatura conferida pelo servidor).
    v_impulso := interno.rede_fed_total() and exists (
      select 1 from fediverso_interacoes fi
      where fi.direcao = 'entrada' and fi.tipo = 'announce' and fi.objeto_remoto = v_id and not interno.rede_fed_bloqueado(fi.ator)
        and exists (select 1 from rede_fed_seguindo s where s.ator = fi.ator and s.aceito));
    if not (v_segue or v_post_local is not null or v_resp_nota or cardinality(v_mencoes) > 0 or v_impulso) then
      return jsonb_build_object('guardado', false, 'motivo', 'sem_ligacao');
    end if;
    v_html := left(p ->> 'html_limpo', 20000);
    if not interno.rede_fed_html_ok(v_html) then v_html := null; end if;
    v_midia := coalesce((select jsonb_agg(jsonb_build_object(
        'url', e ->> 'url', 'tipo', e ->> 'tipo', 'alt', left(coalesce(e ->> 'alt', ''), 1500),
        'largura', case when coalesce(e ->> 'largura', '') ~ '^[0-9]{1,5}$' then (e ->> 'largura')::integer end,
        'altura', case when coalesce(e ->> 'altura', '') ~ '^[0-9]{1,5}$' then (e ->> 'altura')::integer end,
        'blurhash', case when coalesce(e ->> 'blurhash', '') ~ '^[^\s"''<>\\]{6,100}$' then e ->> 'blurhash' end) order by o)
      from jsonb_array_elements(case when jsonb_typeof(p -> 'midia') = 'array' then p -> 'midia' else '[]'::jsonb end) with ordinality m (e, o)
      where o <= 4 and jsonb_typeof(e) = 'object' and coalesce(e ->> 'url', '') ~ '^https://[^\s"''<>\\]+$' and char_length(e ->> 'url') <= 500
        and coalesce(e ->> 'tipo', '') ~ '^(image|video|audio)/[a-z0-9.+-]{1,60}$'), '[]'::jsonb);
    begin
      v_publicado := least(coalesce(nullif(p ->> 'publicado', '')::timestamptz, now()), now());
    exception when others then
      v_publicado := now();
    end;
    v_novo := null;
    insert into rede_fed_recebidos (id, ator, url, texto, aviso, publicado, html, sensivel, visibilidade, em_resposta_a, contexto, midia, post_local)
    values (v_id, v_ator, case when coalesce(p ->> 'url', '') ~ '^https://[^\s]+$' then left(p ->> 'url', 500) end,
            left(coalesce(p ->> 'texto', ''), 3000), left(coalesce(p ->> 'aviso', ''), 200), v_publicado,
            v_html, coalesce(p ->> 'sensivel', '') = 'true', v_vis, v_ref,
            case when coalesce(p ->> 'contexto', '') ~ '^https://[^\s]+$' then left(p ->> 'contexto', 500) end, v_midia, v_post_local)
    on conflict (id) do update set texto = excluded.texto, aviso = excluded.aviso, html = excluded.html, sensivel = excluded.sensivel,
      midia = excluded.midia, editado_em = now()
    where rede_fed_recebidos.ator = excluded.ator
    returning (xmax = 0) into v_novo;
    if v_novo is null then return jsonb_build_object('guardado', false, 'motivo', 'outro_ator'); end if;
    insert into fediverso_mencoes (nota, perfil) select v_id, u from unnest(v_mencoes) u on conflict do nothing;
    if v_novo then
      if v_resp_local is not null then
        select autor into v_autor from rede_posts where id = v_resp_local;
        -- Só-seguidores: só avisa (e só entrega o endereço da nota) a quem pode vê-la, como nas menções (interno.rede_fed_nota_ve).
        if v_vis <> 'seguidores' or exists (select 1 from rede_fed_seguindo s where s.perfil = v_autor and s.ator = v_ator and s.aceito) then
          perform interno.rede_fed_avisar(v_autor, 'fed_resposta', v_resp_local, v_ator, v_id);
        end if;
      end if;
      perform interno.rede_fed_avisar(u, 'fed_mencao', null, v_ator, v_id) from unnest(v_mencoes) u
      where u is distinct from v_autor
        and (v_vis <> 'seguidores' or exists (select 1 from rede_fed_seguindo s where s.perfil = u and s.ator = v_ator and s.aceito));
    end if;
    return jsonb_build_object('guardado', true, 'novo', v_novo,
      'motivo', case when v_resp_local is not null then 'resposta' when cardinality(v_mencoes) > 0 then 'mencao' when v_post_local is not null or v_resp_nota then 'fio' when v_segue then 'segue' else 'impulso' end);

  when 'recebido_apagado' then
    delete from rede_fed_recebidos where id = left(coalesce(p ->> 'id', ''), 500) and ator = v_ator;
    delete from fediverso_interacoes where direcao = 'entrada' and objeto_remoto = left(coalesce(p ->> 'id', ''), 500);
    delete from avisos where objeto_remoto = left(coalesce(p ->> 'id', ''), 500) and ator_remoto = v_ator;
    return jsonb_build_object('ok', true);

  when 'interacao' then
    v_tipo := nullif(p ->> 'tipo', '');
    v_sim := coalesce(p ->> 'sim', 'true') <> 'false';
    if (v_sim or v_tipo is not null) and (v_tipo is null or v_tipo not in ('like', 'announce')) then perform interno.erro('invalido:tipo'); end if;
    if v_ator = '' then perform interno.erro('invalido:ator'); end if;
    if not interno.rede_fed_total() then return jsonb_build_object('ok', false, 'motivo', 'desligado'); end if;
    if interno.rede_fed_bloqueado(v_ator) then return jsonb_build_object('ok', false, 'motivo', 'bloqueado'); end if;
    v_id := nullif(left(coalesce(p ->> 'atividade_id', ''), 500), '');
    -- objeto_remoto: a nota de fora impulsionada; post_local: o post daqui (aceito também para a nota de fora, por compatibilidade).
    v_ref := nullif(left(coalesce(nullif(p ->> 'objeto_remoto', ''), p ->> 'post_local', ''), 500), '');
    v_post := interno.rede_fed_post_local(v_ref);
    if v_post is not null then select autor into v_autor from rede_posts where id = v_post; end if;
    if v_sim then
      if v_post is not null then
        if exists (select 1 from fediverso_filtros ff where ff.usuario = v_autor and ff.ator = v_ator and ff.tipo = 'bloqueio') then
          return jsonb_build_object('ok', false, 'motivo', 'bloqueado');
        end if;
        v_i := null;
        insert into fediverso_interacoes (direcao, tipo, ator, post_local, atividade_id)
        values ('entrada', v_tipo, interno.rede_fed_apelido_ator(v_ator), v_post, v_id)
        on conflict do nothing returning * into v_i;
        if v_i.id is not null then
          perform interno.rede_fed_avisar(v_autor, case v_tipo when 'like' then 'fed_curtida' else 'fed_impulso' end, v_post, v_ator, null);
        end if;
        return jsonb_build_object('ok', true, 'perfil_autor', v_autor);
      elsif v_tipo = 'announce' and coalesce(v_ref, '') ~ '^https://[^\s]+$' and not interno.rede_fed_bloqueado(v_ref)
            and exists (select 1 from rede_fed_seguindo s where s.ator = v_ator and s.aceito) then
        -- Impulso de uma nota de fora por quem alguém daqui segue: entra na linha como impulso (rede_fed_linha_mista).
        insert into fediverso_interacoes (direcao, tipo, ator, objeto_remoto, atividade_id) values ('entrada', 'announce', v_ator, v_ref, v_id)
        on conflict do nothing;
        return jsonb_build_object('ok', true, 'perfil_autor', null);
      end if;
      return jsonb_build_object('ok', false, 'motivo', 'sem_ligacao');
    end if;
    -- Undo: pelo post, pela nota impulsionada ou pelo id da atividade desfeita.
    with apagadas as (
      delete from fediverso_interacoes fi
      where fi.direcao = 'entrada' and fi.ator in (v_ator, interno.rede_fed_apelido_ator(v_ator)) and (v_tipo is null or fi.tipo = v_tipo)
        and ((v_post is not null and fi.post_local = v_post) or (v_ref is not null and fi.objeto_remoto = v_ref) or (v_id is not null and fi.atividade_id = v_id))
      returning fi.post_local, fi.tipo
    )
    -- O aviso de curtida e de impulso guarda o apelido de quem foi (interno.rede_fed_apelido), não o endereço (os antigos, de
    -- antes desta migração, já foram trocados; o endereço fica na conta só por garantia).
    delete from avisos av using apagadas d
    where av.ator_remoto in (v_ator, interno.rede_fed_apelido(av.para, v_ator)) and av.post = d.post_local and av.tipo = case d.tipo when 'like' then 'fed_curtida' else 'fed_impulso' end;
    return jsonb_build_object('ok', true, 'perfil_autor', v_autor);

  when 'denuncia_recebida' then
    -- Flag de fora: só no modo total (com a flag desligada nada novo entra; cabeçalho, item 7).
    if not interno.rede_fed_total() then return jsonb_build_object('protocolo', null, 'ok', false, 'motivo', 'desligado'); end if;
    v_ref := left(coalesce(nullif(p ->> 'ator_instancia', ''), v_ator), 500);
    if v_ref !~ '^https://[^\s]+$' then perform interno.erro('invalido:ator'); end if;
    if interno.rede_fed_bloqueado(v_ref) then return jsonb_build_object('protocolo', null, 'ok', false, 'motivo', 'bloqueado'); end if;
    v_dom := interno.rede_fed_dominio(v_ref);
    -- Freio por instância: até 30 Flags por hora.
    if (select count(*) from fediverso_denuncias fd where fd.direcao = 'entrada' and fd.dominio = v_dom and fd.criado_em > now() - interval '1 hour') >= 30 then
      return jsonb_build_object('protocolo', null, 'ok', false, 'motivo', 'muitos_pedidos');
    end if;
    v_res := coalesce((select jsonb_agg(left(e, 500) order by o) from jsonb_array_elements_text(case when jsonb_typeof(p -> 'alvos') = 'array' then p -> 'alvos' else '[]'::jsonb end) with ordinality z (e, o)
                       where o <= 20 and e ~ '^https://[^\s]+$'), '[]'::jsonb);
    v_texto := left('Denúncia recebida de outro servidor do Fediverso (' || v_dom || '): ' || left(coalesce(p ->> 'conteudo', ''), 1800), 2000);
    v_den := '{}';
    -- Cada post e cada perfil daqui apontado vira uma denúncia na fila da mediação (rede_denuncias), sem autor (veio de fora).
    for v_uuid in
      select distinct e.post from jsonb_array_elements_text(v_res) z (u) join rede_fed_enviados e on e.post = interno.rede_fed_uuid_local(z.u)
      join rede_posts rp on rp.id = e.post
    loop
      insert into rede_denuncias (alvo_tipo, alvo, categoria, prioridade, texto, quem) values ('post', v_uuid::text, 'outro', 3, v_texto, null) returning id into v_post;
      v_den := v_den || v_post;
    end loop;
    for v_uuid in
      select distinct ra.perfil from jsonb_array_elements_text(v_res) z (u) join rede_fed_atores ra on ra.handle = interno.rede_fed_handle_local(z.u)
      join perfis pf on pf.id = ra.perfil
    loop
      insert into rede_denuncias (alvo_tipo, alvo, categoria, prioridade, texto, quem) values ('perfil', v_uuid::text, 'outro', 3, v_texto, null) returning id into v_post;
      v_den := v_den || v_post;
    end loop;
    insert into fediverso_denuncias (direcao, dominio, ator, alvos, conteudo, denuncias)
    values ('entrada', v_dom, v_ref, v_res, left(coalesce(p ->> 'conteudo', ''), 2000), v_den)
    returning protocolo into v_prot;
    return jsonb_build_object('protocolo', v_prot, 'ok', true, 'locais', cardinality(v_den));

  when 'bloqueio_recebido' then
    if v_ator = '' then perform interno.erro('invalido:ator'); end if;
    if not interno.rede_fed_total() then return jsonb_build_object('ok', false, 'motivo', 'desligado'); end if;
    v_ref := coalesce(interno.rede_fed_handle_local(p ->> 'alvo_handle'), lower(split_part(btrim(coalesce(p ->> 'alvo_handle', ''), ' @'), '@', 1)));
    select ra.perfil into v_perfil from rede_fed_atores ra where ra.handle = v_ref order by ra.ligado desc limit 1;
    if v_perfil is null or not exists (select 1 from perfis where id = v_perfil) then return jsonb_build_object('ok', false, 'motivo', 'inexistente'); end if;
    if coalesce(p ->> 'sim', 'true') <> 'false' then
      insert into fediverso_bloqueios_recebidos (perfil, ator) values (v_perfil, v_ator) on conflict do nothing;
      delete from rede_fed_seguidores where perfil = v_perfil and ator = v_ator;
      delete from rede_fed_seguindo where perfil = v_perfil and ator = v_ator;
      -- Como no bloqueio daqui: curtida e impulso ficam (sumirem diria quem foi).
      delete from avisos where para = v_perfil and ator_remoto = v_ator and tipo in ('fed_seguidor', 'fed_resposta', 'fed_mencao');
    else
      delete from fediverso_bloqueios_recebidos where perfil = v_perfil and ator = v_ator;
    end if;
    return jsonb_build_object('ok', true);

  when 'seguir' then
    select * into a from rede_fed_atores where perfil = (p ->> 'perfil')::uuid and ligado;
    if not found then perform interno.erro('fediverso_desligado'); end if;
    if interno.rede_fed_bloqueado(v_ator) then perform interno.erro('instancia_bloqueada'); end if;
    if coalesce((p ->> 'sim')::boolean, true) then
      if not exists (select 1 from rede_fed_remotos r where r.ator = v_ator and r.inbox is not null) then perform interno.erro('nao_encontrado'); end if;
      -- Quem bloqueou a pessoa lá fora não recebe pedido de seguir dela.
      if exists (select 1 from fediverso_bloqueios_recebidos b where b.perfil = a.perfil and b.ator = v_ator) then perform interno.erro('sem_permissao'); end if;
      if (select count(*) from rede_fed_seguindo where perfil = a.perfil) >= 2000 then perform interno.erro('muitos_pedidos'); end if;
      insert into rede_fed_seguindo (perfil, ator, pedido) values (a.perfil, v_ator, left(coalesce(p ->> 'pedido', ''), 500))
      on conflict (perfil, ator) do update set pedido = excluded.pedido, aceito = false;
      insert into rede_fed_fila (perfil, tipo, objeto, destino, extra)
      select a.perfil, 'follow', v_ator, r.inbox, jsonb_build_object('pedido', left(coalesce(p ->> 'pedido', ''), 500)) from rede_fed_remotos r where r.ator = v_ator;
    else
      insert into rede_fed_fila (perfil, tipo, objeto, destino, extra)
      select a.perfil, 'undo-follow', v_ator, r.inbox, jsonb_build_object('pedido', s.pedido)
      from rede_fed_seguindo s join rede_fed_remotos r on r.ator = s.ator where s.perfil = a.perfil and s.ator = v_ator and r.inbox is not null;
      delete from rede_fed_seguindo where perfil = a.perfil and ator = v_ator;
    end if;
    return jsonb_build_object('ok', true);

  when 'fila_pegar' then
    -- Até 200 por chamada no modo total; sem a flag, o teto de antes (100).
    v_limite := least(greatest(coalesce((p ->> 'limite')::integer, 20), 1), case when interno.rede_fed_total() then 200 else 100 end);
    if random() < 0.05 then perform interno.rede_fed_limpar(); end if;
    -- Domínio morto (circuito aberto): os itens dele esperam sem gastar tentativa.
    with escolhidos as (
      select q.id from rede_fed_fila q
      where q.feito_em is null and q.proxima <= now()
        and not (interno.rede_fed_total() and exists (select 1 from fediverso_dominios d where d.dominio = interno.rede_fed_dominio(q.destino) and d.morto_ate > now()))
      order by q.proxima, q.id limit v_limite for update skip locked
    ), reservados as (
      update rede_fed_fila q set proxima = now() + interval '3 minutes', tentativas = q.tentativas + 1 from escolhidos e where q.id = e.id returning q.*
    )
    select coalesce(jsonb_agg(jsonb_build_object('id', r.id, 'tipo', r.tipo, 'objeto', r.objeto, 'destino', r.destino, 'extra', r.extra,
      'tentativas', r.tentativas, 'handle', t.handle, 'comunidade', r.comunidade,
      'assinante', case when r.perfil is not null then 'pessoa' when r.comunidade is not null then 'grupo' else 'instancia' end,
      'chave_publica', coalesce(t.chave_publica, g.chave_publica), 'chave_privada', coalesce(t.chave_privada, g.chave_privada)) order by r.id), '[]'::jsonb)
    into v_res from reservados r left join rede_fed_atores t on t.perfil = r.perfil left join fediverso_grupos g on g.comunidade = r.comunidade
    where (r.perfil is not null and t.perfil is not null) or (r.perfil is null and r.comunidade is not null and g.comunidade is not null)
       or (r.perfil is null and r.comunidade is null);
    return v_res;

  when 'fila_feito' then
    select * into v_q from rede_fed_fila where id = (p ->> 'id')::bigint;
    if not found then return jsonb_build_object('ok', true); end if;
    v_t := v_q.tentativas;
    -- Sem a flag, o de antes: sem circuito por domínio, sem tratar 410 e 429 à parte.
    if not interno.rede_fed_total() then p := p - 'status'; end if;
    v_status := case when coalesce(p ->> 'status', '') ~ '^[0-9]{1,3}$' then (p ->> 'status')::integer end;
    v_dom := coalesce(case when lower(coalesce(p ->> 'dominio', '')) ~ '^[a-z0-9.-]{3,253}$' then lower(p ->> 'dominio') end, interno.rede_fed_dominio(v_q.destino));
    if coalesce((p ->> 'ok')::boolean, false) then
      update rede_fed_fila set feito_em = now(), erro = '' where id = v_q.id;
      update fediverso_dominios set falhas = 0, nivel = 0, morto_ate = null, ultimo_ok = now() where dominio = v_dom;
      return jsonb_build_object('ok', true);
    end if;
    if v_status = 410 then
      -- A caixa não existe mais (Gone): quem seguia por ela sai.
      update rede_fed_fila set feito_em = now(), erro = left(coalesce(p ->> 'erro', 'http_410'), 300) where id = v_q.id;
      delete from rede_fed_seguidores where inbox = v_q.destino or inbox_compartilhada = v_q.destino;
      delete from fediverso_grupo_seguidores where inbox = v_q.destino or inbox_compartilhada = v_q.destino;
      return jsonb_build_object('ok', true);
    end if;
    if v_status = 429 then
      v_espera := least(greatest(case when coalesce(p ->> 'espera', '') ~ '^[0-9]{1,6}$' then (p ->> 'espera')::integer else 600 end, 30), 43200);
      update rede_fed_fila set erro = left(coalesce(p ->> 'erro', 'http_429'), 300), proxima = now() + make_interval(secs => v_espera),
        tentativas = greatest(tentativas - 1, 0) where id = v_q.id;
      return jsonb_build_object('ok', true);
    end if;
    v_conexao := p ? 'status' and (v_status is null or v_status = 0 or v_status in (502, 503, 504, 520, 521, 522, 523, 524, 525, 526, 530));
    if v_conexao and v_dom is not null then
      insert into fediverso_dominios (dominio, falhas, ultima_falha) values (v_dom, 1, now())
      on conflict (dominio) do update set falhas = fediverso_dominios.falhas + 1, ultima_falha = now()
      returning * into v_d;
      if v_d.falhas >= 5 then
        update fediverso_dominios set morto_ate = now() + case nivel when 0 then interval '1 hour' when 1 then interval '6 hours' else interval '24 hours' end,
          nivel = least(nivel + 1, 2), falhas = 0
        where dominio = v_dom returning * into v_d;
        update rede_fed_fila set proxima = greatest(proxima, v_d.morto_ate) where feito_em is null and interno.rede_fed_dominio(destino) = v_dom;
        update rede_fed_fila set erro = left(coalesce(p ->> 'erro', 'dominio_fora_do_ar'), 300), tentativas = greatest(tentativas - 1, 0) where id = v_q.id;
        return jsonb_build_object('ok', true, 'morto_ate', v_d.morto_ate);
      end if;
    end if;
    if coalesce((p ->> 'definitivo')::boolean, false) or coalesce(v_t, 0) >= 8 then
      update rede_fed_fila set feito_em = now(), erro = left(coalesce(p ->> 'erro', 'falha'), 300) where id = v_q.id;
    else
      update rede_fed_fila set erro = left(coalesce(p ->> 'erro', 'falha'), 300),
        proxima = now() + least(interval '12 hours', interval '1 minute' * power(2, greatest(coalesce(v_t, 1), 1)))
      where id = v_q.id;
    end if;
    return jsonb_build_object('ok', true);

  when 'dominio_estado' then
    select * into v_d from fediverso_dominios where dominio = lower(coalesce(p ->> 'dominio', ''));
    return jsonb_build_object('morto_ate', case when v_d.morto_ate > now() then v_d.morto_ate end, 'falhas', coalesce(v_d.falhas, 0));

  when 'contagem' then
    return jsonb_build_object('usuarios', interno.rede_fed_piso((select count(*)::integer from rede_fed_atores where ligado)),
                              'posts', (select count(*)::integer from rede_fed_enviados where apagado_em is null));

  when 'contagem_ativos' then
    return jsonb_build_object(
      'mes', interno.rede_fed_piso((select count(distinct e.perfil)::integer from rede_fed_enviados e join rede_fed_atores t on t.perfil = e.perfil and t.ligado where e.enviado_em > now() - interval '30 days')),
      'semestre', interno.rede_fed_piso((select count(distinct e.perfil)::integer from rede_fed_enviados e join rede_fed_atores t on t.perfil = e.perfil and t.ligado where e.enviado_em > now() - interval '180 days')));

  when 'bloqueado' then
    return to_jsonb(interno.rede_fed_bloqueado(coalesce(p ->> 'url', '')));

  when 'comunidade' then
    v_slug := lower(coalesce(p ->> 'slug', ''));
    if not interno.rede_fed_grupo_ok(v_slug) then return jsonb_build_object('estado', 'inexistente'); end if;
    select * into v_com from rede_comunidades where slug = v_slug;
    select * into v_g from fediverso_grupos where comunidade = v_slug;
    return jsonb_build_object('estado', 'ligado', 'slug', v_com.slug, 'nome', v_com.nome, 'descricao', v_com.descricao, 'categoria', v_com.categoria,
      'criada_em', v_com.criada_em, 'chave_publica', v_g.chave_publica, 'chave_privada', v_g.chave_privada,
      -- Quem modera NÃO sai para fora: a coleção de moderação fica vazia (a chave continua, para o formato não mudar).
      'moderadores', '[]'::jsonb,
      'seguidores', interno.rede_fed_piso((select count(*)::integer from fediverso_grupo_seguidores s where s.comunidade = v_slug)));

  when 'comunidade_chaves' then
    v_slug := lower(coalesce(p ->> 'slug', ''));
    if not interno.rede_fed_grupo_ok(v_slug) then perform interno.erro('nao_encontrado'); end if;
    if coalesce(p ->> 'publica', '') !~ '^-----BEGIN PUBLIC KEY-----' or char_length(coalesce(p ->> 'privada', '')) < 100 then perform interno.erro('invalido:chave'); end if;
    insert into fediverso_grupos (comunidade, chave_publica, chave_privada) values (v_slug, p ->> 'publica', p ->> 'privada')
    on conflict (comunidade) do update set chave_publica = excluded.chave_publica, chave_privada = excluded.chave_privada where fediverso_grupos.chave_publica is null;
    select * into v_g from fediverso_grupos where comunidade = v_slug;
    return jsonb_build_object('chave_publica', v_g.chave_publica, 'chave_privada', v_g.chave_privada);

  when 'comunidade_seguidores' then
    v_slug := lower(coalesce(p ->> 'slug', ''));
    if not interno.rede_fed_grupo_ok(v_slug) then return jsonb_build_object('total', 0); end if;
    return jsonb_build_object('total', interno.rede_fed_piso((select count(*)::integer from fediverso_grupo_seguidores s where s.comunidade = v_slug)));

  when 'comunidade_seguidor' then
    v_slug := lower(coalesce(p ->> 'slug', ''));
    if not interno.rede_fed_grupo_ok(v_slug) then return jsonb_build_object('ok', false, 'motivo', 'desligado'); end if;
    if v_ator = '' then perform interno.erro('invalido:ator'); end if;
    if interno.rede_fed_bloqueado(v_ator) or interno.rede_fed_bloqueado(p ->> 'inbox') then return jsonb_build_object('ok', false, 'motivo', 'bloqueado'); end if;
    if coalesce((p ->> 'sim')::boolean, true) then
      if coalesce(p ->> 'inbox', '') !~ '^https://[^\s]+$' or interno.rede_fed_dominio(p ->> 'inbox') <> interno.rede_fed_dominio(v_ator) then perform interno.erro('invalido:inbox'); end if;
      insert into fediverso_grupo_seguidores (comunidade, ator, inbox, inbox_compartilhada, pedido)
      values (v_slug, v_ator, p ->> 'inbox',
              case when coalesce(p ->> 'compartilhada', '') ~ '^https://[^\s]+$' and interno.rede_fed_dominio(p ->> 'compartilhada') = interno.rede_fed_dominio(v_ator) then p ->> 'compartilhada' end,
              left(coalesce(p ->> 'pedido', ''), 500))
      on conflict (comunidade, ator) do update set inbox = excluded.inbox, inbox_compartilhada = excluded.inbox_compartilhada, pedido = excluded.pedido;
      insert into rede_fed_fila (perfil, comunidade, tipo, objeto, destino, extra)
      values (null, v_slug, 'group-accept', v_ator, p ->> 'inbox', jsonb_build_object('pedido', left(coalesce(p ->> 'pedido', ''), 500)));
    else
      delete from fediverso_grupo_seguidores where comunidade = v_slug and ator = v_ator;
    end if;
    return jsonb_build_object('ok', true);

  when 'comunidade_outbox' then
    v_slug := lower(coalesce(p ->> 'slug', ''));
    if not interno.rede_fed_grupo_ok(v_slug) then return jsonb_build_object('total', 0, 'itens', '[]'::jsonb); end if;
    v_limite := least(greatest(coalesce((p ->> 'limite')::integer, 20), 1), 40);
    v_antes := nullif(p ->> 'antes', '')::timestamptz;
    select count(*)::integer into v_n from rede_fed_enviados e join rede_posts r on r.id = e.post
    where e.apagado_em is null and r.comunidade = v_slug and r.resposta_a is null;
    select coalesce(jsonb_agg(interno.rede_fed_post_json(r) order by r.criado_em desc), '[]'::jsonb) into v_res
    from (select r.* from rede_fed_enviados e join rede_posts r on r.id = e.post
          where e.apagado_em is null and r.comunidade = v_slug and r.resposta_a is null and (v_antes is null or r.criado_em < v_antes)
            and interno.rede_fed_federavel(r)
          order by r.criado_em desc limit v_limite) r;
    return jsonb_build_object('total', v_n, 'itens', v_res);

  else
    perform interno.erro('invalido:acao');
  end case;
  return null;
end $function$;

-- ── 3. Fediverso: teto do histórico do consentimento ─────────────────────────────────────────────────────────────────────

/**
 * Grava no histórico quando a federação de alguém liga, desliga ou muda de versão (corpo inteiro, igual ao de hoje). Conta já
 * apagada não ganha linha. O histórico de cada pessoa tem teto: fica a PRIMEIRA linha (o primeiro consentimento) e as 99 mais
 * novas; as do meio saem. Ligar e desligar no perfil já tem limite (rede_fed_ligar), mas sem o teto uma conta gravaria linhas
 * para sempre.
 */
CREATE OR REPLACE FUNCTION interno.rede_fed_consentimento_historico()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'interno', 'pg_temp'
AS $function$
begin
  if tg_op = 'INSERT' then
    if not new.ligado then return null; end if;
  elsif new.ligado = old.ligado and (not new.ligado or new.consentimento_versao is not distinct from old.consentimento_versao) then
    return null;
  end if;
  insert into fediverso_consentimentos (usuario, versao, ligado)
  select new.perfil, new.consentimento_versao, new.ligado where exists (select 1 from perfis f where f.id = new.perfil);
  -- Teto por pessoa: fica a PRIMEIRA linha (o primeiro consentimento) e as 99 mais novas; as do meio saem.
  delete from fediverso_consentimentos c
  where c.usuario = new.perfil
    and c.id <> (select min(p.id) from fediverso_consentimentos p where p.usuario = new.perfil)
    and c.id not in (select n.id from fediverso_consentimentos n where n.usuario = new.perfil order by n.id desc limit 99);
  return null;
end $function$;

-- ── 4. Fediverso: a nota guardada de quem bloqueou a pessoa ──────────────────────────────────────────────────────────────

/**
 * A nota que o banco guarda (p_nota, o id de lá) é de alguém de fora que bloqueou quem pede? É o que a rota do fio
 * (app/api/fediverso/remoto) pergunta quando o banco não devolve o fio: aí ela responde "não achamos isto", sem oferecer "buscar
 * este post lá" (senão o fio de quem bloqueou voltaria pelo caminho de fora). Só responde sobre quem está na sessão. Só para quem
 * aderiu e com o modo total ligado.
 */
create or replace function public.rede_fed_bloqueou_voce(p_nota text) returns boolean language plpgsql volatile security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu();
begin
  perform interno.aberta('comunidade');
  if not interno.rede2_membro(v) then perform interno.erro('consentimento'); end if;
  if not interno.rede_fed_total() then perform interno.erro('fediverso_desligado'); end if;
  perform interno.limite('rede_fed_bloqueou_voce', 600, 60);
  return exists (select 1 from rede_fed_recebidos c join fediverso_bloqueios_recebidos b on b.perfil = v and b.ator = c.ator
                 where c.id = left(btrim(coalesce(p_nota, '')), 500));
end $$;

-- ── 5. Fediverso: o domínio da conta só para quem está ligado ────────────────────────────────────────────────────────────

/**
 * A situação da federação para quem está na sessão (corpo inteiro, igual ao de hoje), com uma diferença: o domínio da conta,
 * como o endereço, só vem para quem está com a federação ligada.
 */
CREATE OR REPLACE FUNCTION public.rede_fed_situacao()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'interno', 'pg_temp'
AS $function$
declare v uuid := auth.uid(); a rede_fed_atores;
begin
  if v is null then return jsonb_build_object('logado', false, 'ligado', false, 'pode', false, 'motivo', 'entre_primeiro', 'versao', interno.rede_fed_versao(), 'total', interno.rede_fed_total()); end if;
  select * into a from rede_fed_atores where perfil = v;
  return jsonb_build_object(
    'logado', true,
    'handle', (select rede_handle from perfis where id = v),
    'motivo', interno.rede_fed_impedimento(v),
    'pode', interno.rede_fed_impedimento(v) is null,
    'ligado', coalesce(a.ligado, false),
    'desde', case when a.ligado then a.ligado_em end,
    'seguidores', (select count(*)::integer from rede_fed_seguidores where perfil = v),
    'seguindo', (select count(*)::integer from rede_fed_seguindo where perfil = v),
    'versao', interno.rede_fed_versao(),
    'total', interno.rede_fed_total(),
    'consentimento_versao', case when a.ligado then a.consentimento_versao end,
    'descobrivel', coalesce(a.ligado and a.descobrivel, false),
    -- O endereço completo (@nome@dominio) e o domínio da conta: o curto no modo total, o da Alumia sem ele. Nulo sem @nome,
    -- enquanto o endereço do servidor não foi configurado (url_entrega) e para quem não está com a federação ligada (esse @ não
    -- existe lá fora: o WebFinger não responde por ele). Nenhuma tela usa o domínio sozinho.
    'dominio', case when a.ligado then interno.rede_fed_dominio_da_conta() end,
    'endereco', case when a.ligado then '@' || (select rede_handle from perfis where id = v) || '@' || interno.rede_fed_dominio_da_conta() end,
    -- A tela pede o item do Fediverso (de novo) para quem pode federar e ainda não aceitou a versão 2: inclusive quem marcou o
    -- item com a flag desligada (versão 1), que não é ligado sozinho, e quem está ligado só na versão 1. Quem já respondeu o item
    -- na versão 2 (marcado ou não) e quem desligou no perfil não são pedidos (decidiram; religam no perfil quando quiserem).
    'pedir_fediverso', interno.rede_fed_total() and interno.rede_fed_impedimento(v) is null
      and (a.perfil is null or (a.ligado and coalesce(a.consentimento_versao, 1) < 2))
      and not exists (select 1 from rede_consentimentos c where c.usuario = v and c.revogado_em is null and c.fediverso_versao >= 2));
end $function$;

-- ── 6. Permissões ────────────────────────────────────────────────────────────────────────────────────────────────────────
-- As internas novas não são chamáveis de fora. A da nota pede conta (confere a sessão).
do $$
declare v_papeis boolean := exists (select 1 from pg_roles where rolname = 'anon');
begin
  revoke all on function interno.rede_fed_apelido(uuid, text) from public;
  revoke all on function interno.rede_fed_apelido_ator(text) from public;
  revoke all on function interno.rede_fed_avisar(uuid, text, uuid, text, text) from public;
  revoke all on function interno.rede_fed_consentimento_historico() from public;
  revoke all on function public.rede_fed_bloqueou_voce(text) from public;
  if v_papeis then
    revoke all on function interno.rede_fed_apelido(uuid, text) from anon, authenticated;
    revoke all on function interno.rede_fed_apelido_ator(text) from anon, authenticated;
    revoke all on function interno.rede_fed_avisar(uuid, text, uuid, text, text) from anon, authenticated;
    revoke all on function interno.rede_fed_consentimento_historico() from anon, authenticated;
    revoke all on function public.rede_fed_bloqueou_voce(text) from anon, authenticated;
    grant execute on function public.rede_fed_bloqueou_voce(text) to authenticated, service_role;
  end if;
end $$;

select interno.alumia_trancar();
