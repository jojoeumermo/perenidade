-- Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
-- Alumia · Prompt 4 · conta, identidade e convivência (Parte H: itens 74 a 80, 104, 105, 107 a 114 e 127 a 129).
--
-- Roda depois de 20261126-p5-fim.sql (banco na versão 17) e das migrações 20261127-p4-* das três primeiras junções; quem junta põe
-- antes do 20261127-p4-fim.sql. Não mexe em rede_alumia_versao nem na lista de exceções da porta: o 20261127-p4-fim.sql faz isso.
-- Não redefine nenhuma função que já existia: todas as funções daqui são novas (interno.rede_p4_ct_* e public.rede_p4_ct_*). Os
-- gatilhos novos ficam em tabelas que já existiam (interno.rede_mencoes, rede_comunidade_membros e alumia_regras_lidas) e só
-- acrescentam uma conferência; os gatilhos de antes continuam iguais. Usa, sem mudar, interno.rede_o9_segue, rede3_conv_avisar,
-- rede3_com_achar, rede3_com_modera, rede_alumia_com_ver, rede2_na_comunidade, alumia_o10_pode, alumia_pessoas,
-- alumia_sem_dado_pessoal, rede_ve, rede_nome, rede_bloqueado, rede3_perfil_exige_membro, rede_fed_dominio, avisar_em, registrar e
-- limite; no quiz, chama public.alumia_cargos_regras_aceitar (o aceite das regras continua sendo o de sempre). Lê auth.users.created_at
-- (a idade da conta, para o escudo), sem escrever nada em auth.*.
-- Muda uma regra de tabela que já existia: a conferência de tipo da fila de entrega do Fediverso (interno.rede_fed_fila) troca a
-- rede_fed_fila_tipo_v2 pela rede_fed_fila_tipo_p4, a mesma lista mais "move". O nível de proteção (107) escreve, quando as tabelas
-- existem (to_regclass), nas escolhas dos lotes presenca-print e selo-contagens (rede_p4_presenca, rede_p4_contagens e
-- rede_p4_foto_protegida), só para desligar o que mostra a pessoa ou proteger a foto dela.
--
-- Tudo atrás do interruptor "alumia-p4-conta" (catálogo, só pelo nome, desligado): desligado, toda função daqui recusa com
-- "desligado" e todo gatilho daqui deixa passar (a Alumia fica como antes).
--
--   76. REVISÃO ANTES DE APARECER (interno.rede_p4_ct_prefs.mencao_revisar e rede_p4_ct_mencoes). Somada ao "quem pode me mencionar"
--       que já existia (rede_o9_prefs.mencao_quem): ligada, a menção de quem a pessoa não segue espera na fila dela, sem aviso, e só
--       vira menção (com o aviso de sempre) quando ela aprova. Quem escreveu não fica sabendo se a menção espera ou foi recusada.
--   107. NÍVEIS DE PROTEÇÃO PRONTOS (public.rede_p4_ct_nivel). Básico, Reforçado e Máximo ligam de uma vez as escolhas que o banco já
--       tem (quem menciona, quem marca, aprovar marcação, revisão das menções, status online e contagens públicas). O que é do aparelho
--       (Sair rápido, proteção contra print) a tela liga; o que muda o alcance (trancar o perfil, desligar o Fediverso) fica como
--       sugestão, para a pessoa decidir.
--   80. ESCUDO CONTRA INVASÃO (rede_p4_ct_escudo). Quando muitas contas novas entram numa comunidade de uma vez (padrão: 10 contas
--       com menos de 7 dias em 60 minutos), a entrada de contas novas trava por um tempo (padrão: 6 horas) e a mediação recebe um aviso
--       só com os números. Contas antigas continuam entrando. Conta o que já existe (a data de entrada e a idade da conta): nada novo é
--       guardado sobre quem entrou.
--   127. QUIZ DAS REGRAS (rede_p4_ct_quiz). A mediação escreve até 5 perguntas de múltipla escolha sobre as regras; com o quiz, o
--       aceite das regras (o "li e aceito" de sempre) só vale depois de acertar todas. As respostas não ficam guardadas: só o aceite.
--   114. GUIA DE ENTRADA (rede_p4_ct_guia). Até 6 passos escritos pela mediação para quem chega; o progresso fica no aparelho.
--   113. BOAS-VINDAS AUTOMÁTICAS: já existiam (interno.alumia_o10_membros_depois avisa quem entra com o texto da aba Chegada);
--       nada muda aqui, o teste prova.
--   105. SALA DE CUIDADO ENTRE PARES (rede_p4_ct_cuidado). A mediação marca uma comunidade como sala de cuidado: no alto dela aparecem
--       o CVV (188) e os serviços públicos, e a mediação pode mandar a alguém, em particular, o caminho desses serviços. A página
--       /alumia/cuidado ("Como a Rede cuida") lista as salas que a pessoa pode ver. Ninguém guarda a quem a mediação mandou.
--   78. MEDIAÇÃO RESTAURATIVA (rede_p4_ct_mediacoes, rede_p4_ct_med_partes e rede_p4_ct_med_falas). Alternativa à punição: quem
--       modera a comunidade convida duas pessoas para uma conversa mediada; as duas aceitam ou recusam. Só as três leem. Termina com um
--       acordo que as duas aceitam ou sem acordo; no fim, as falas são apagadas e fica só o acordo, por 30 dias, para as três. Não entra
--       no histórico de moderação de ninguém. Não é cifrado (a tela diz): quem administra o banco pode ler enquanto ela dura.
--   112. HORÁRIO DE ATENDIMENTO E MENSAGEM DE AUSÊNCIA (rede_p4_ct_prefs.atendimento e .ausencia). Escolha da própria pessoa (ou da
--       organização); quem abre uma conversa com ela vê "fora do horário" e a mensagem, calculado na hora.
--   74. MUDAR DE SERVIDOR NO FEDIVERSO (rede_p4_ct_mudanca). A exportação completa já existia (rede_meusdados_exportar). Agora a pessoa
--       que ligou a federação aponta a conta nova (que já declara esta em alsoKnownAs: o servidor do site confere) e as instâncias das
--       seguidoras recebem a atividade Move, que leva as seguidoras para a conta nova. A fila de entrega ganha o tipo "move".
--
-- O resto do lote não tem banco: 79 (releia antes de enviar), 104 (diário), 108 (checkup), 109 (modo viagem), 111 (respostas rápidas)
-- rodam só no aparelho; 77 (rel=me), 113 (boas-vindas), 128 (filtro da comunidade) e 129 (saúde da comunidade) já existiam e o teste
-- prova; 75 (chave de acesso) e 110 (checagem do aparelho, app Android) não têm banco.
--
-- Privacidade: nenhuma função devolve lista de pessoas de uma comunidade; nenhum número de pessoas abaixo de 3; nenhuma coluna de
-- endereço de rede (os limites são os de interno.limite, como no resto da Alumia). Pode rodar mais de uma vez. Rotina do pg_cron
-- (da junção): alumia-p4-conta-faxina, diária, apaga a mediação vencida e a menção que espera a revisão há mais de 30 dias.
-- Lei: LGPD art. 6º, III (necessidade: o escudo conta o que já existe, o quiz não guarda resposta), art. 9º (a pessoa escolhe e vê o
-- que cada nível liga), art. 18, II e V (acesso e portabilidade: a cópia dos dados e a mudança de servidor) e art. 46 (segurança);
-- ECA art. 17 e Lei 13.819/2019 (a sala de cuidado encaminha ao CVV e aos serviços públicos, sem expor quem precisa).

-- ── 0. O interruptor e as peças comuns ─────────────────────────────────────────────────────────────────────────────────────
do $$
begin
  if to_regclass('interno.recursos_catalogo') is not null then
    insert into interno.recursos_catalogo (nome, so_pelo_nome) values ('alumia-p4-conta', true)
      on conflict (nome) do update set so_pelo_nome = true;
  end if;
end $$;

/** Ligado só com a Alumia nova e o interruptor ligado no painel (recursos_vivos). */
create or replace function interno.rede_p4_ct_ligado() returns boolean language plpgsql stable security definer set search_path = interno, pg_temp as $$
begin
  if to_regclass('interno.recursos_vivos') is null then return false; end if;
  if exists (select 1 from recursos_vivos where nome in ('rede-v2', 'alumia-2') and not ligado) then return false; end if;
  return coalesce((select ligado from recursos_vivos where nome = 'alumia-p4-conta'), false);
end $$;

/** Confere o interruptor e a conta (membro da Alumia, 18+, codinome conferido). Devolve quem chama. */
create or replace function interno.rede_p4_ct_membro() returns uuid language plpgsql stable security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu();
begin
  if not interno.rede_p4_ct_ligado() then perform interno.erro('desligado'); end if;
  perform interno.rede3_perfil_exige_membro(v);
  return v;
end $$;

/** Um texto limpo: sem caracteres de controle, sem espaço sobrando nas pontas, cortado em p_max. */
create or replace function interno.rede_p4_ct_texto(p text, p_max integer) returns text language sql immutable as $$
  select left(btrim(regexp_replace(coalesce(p, ''), '[\x01-\x08\x0B\x0C\x0E-\x1F\x7F]', '', 'g')), p_max)
$$;

/** O texto entre p_min e p_max letras, sem dado pessoal (CPF, telefone, e-mail, endereço com número); fora disso, invalido:<campo>. */
create or replace function interno.rede_p4_ct_campo(p text, p_min integer, p_max integer, p_campo text) returns text language plpgsql stable security definer set search_path = interno, pg_temp as $$
declare v text := interno.rede_p4_ct_texto(p, p_max + 1);
begin
  if char_length(v) < p_min or char_length(v) > p_max then perform interno.erro('invalido:' || p_campo); end if;
  if v <> '' then v := interno.alumia_sem_dado_pessoal(v, p_campo); end if;
  return v;
end $$;

/** A comunidade que quem chama pode ver, e se quem chama a modera. */
create or replace function interno.rede_p4_ct_com(p_slug text, p_quem uuid) returns interno.rede_comunidades language plpgsql stable security definer set search_path = interno, pg_temp as $$
declare c rede_comunidades;
begin
  c := interno.rede_alumia_com_ver(p_slug, p_quem);
  if c.slug is null then perform interno.erro('nao_encontrado'); end if;
  return c;
end $$;

/** A comunidade, exigindo que quem chama a modere (ou tenha o cargo com a permissão dada). */
create or replace function interno.rede_p4_ct_com_modera(p_slug text, p_quem uuid, p_permissao text) returns interno.rede_comunidades language plpgsql stable security definer set search_path = interno, pg_temp as $$
declare c rede_comunidades;
begin
  c := interno.rede3_com_achar(p_slug);
  if c.slug is null then perform interno.erro('nao_encontrado'); end if;
  if not (interno.rede3_com_modera(c.slug, p_quem) or (p_permissao is not null and interno.alumia_o10_pode(c.slug, p_quem, p_permissao))) then
    perform interno.erro('sem_permissao');
  end if;
  return c;
end $$;

-- ── 1. As escolhas da pessoa (76 e 112) ─────────────────────────────────────────────────────────────────────────────────────

-- Uma linha por pessoa, só quando ela escolhe algo. Sem linha = o padrão (sem revisão das menções, sem horário de atendimento).
create table if not exists interno.rede_p4_ct_prefs (
  usuario uuid primary key references interno.perfis (id) on delete cascade,
  mencao_revisar boolean not null default false,
  -- {dias: [0..6] (0 = domingo), de: minutos, ate: minutos}, no horário de São Paulo; nulo = sem horário.
  atendimento jsonb check (atendimento is null or jsonb_typeof(atendimento) = 'object'),
  ausencia text not null default '' check (char_length(ausencia) <= 280),
  atualizado_em timestamptz not null default now()
);

-- As menções que esperam a revisão de quem foi mencionada (76). Só o post e a pessoa; somem quando ela decide ou em 30 dias.
create table if not exists interno.rede_p4_ct_mencoes (
  post uuid not null references interno.rede_posts (id) on delete cascade,
  mencionado uuid not null references interno.perfis (id) on delete cascade,
  criado_em timestamptz not null default now(),
  primary key (post, mencionado)
);
create index if not exists rede_p4_ct_mencoes_mencionado on interno.rede_p4_ct_mencoes (mencionado, criado_em desc);

alter table interno.rede_p4_ct_prefs enable row level security;
alter table interno.rede_p4_ct_mencoes enable row level security;
revoke all on table interno.rede_p4_ct_prefs, interno.rede_p4_ct_mencoes from public;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on table interno.rede_p4_ct_prefs, interno.rede_p4_ct_mencoes from anon, authenticated;
  end if;
end $$;

/**
 * A menção de quem a pessoa não segue, com a revisão ligada, vai para a fila dela em vez de virar menção (e aviso). Roda depois do
 * filtro de quem pode mencionar (rede_o9_mencao_filtro, pela ordem do nome): o que ele recusa nem chega aqui. A aprovação passa por
 * aqui com a marca da própria transação (alumia.p4ct_mencao), que só public.rede_p4_ct_mencao_decidir põe.
 */
create or replace function interno.rede_p4_ct_mencao_revisao() returns trigger language plpgsql security definer set search_path = interno, pg_temp as $$
declare v_autor uuid;
begin
  if coalesce(current_setting('alumia.p4ct_mencao', true), '') = new.post::text || ':' || new.mencionado::text then return new; end if;
  if not interno.rede_p4_ct_ligado() then return new; end if;
  if not coalesce((select f.mencao_revisar from rede_p4_ct_prefs f where f.usuario = new.mencionado), false) then return new; end if;
  select autor into v_autor from rede_posts where id = new.post;
  if v_autor is null or v_autor = new.mencionado or interno.rede_o9_segue(new.mencionado, v_autor) then return new; end if;
  insert into rede_p4_ct_mencoes (post, mencionado) values (new.post, new.mencionado) on conflict do nothing;
  return null;
end $$;
drop trigger if exists rede_p4_ct_mencao_revisao on interno.rede_mencoes;
create trigger rede_p4_ct_mencao_revisao before insert on interno.rede_mencoes for each row execute function interno.rede_p4_ct_mencao_revisao();

/** As escolhas da pessoa, com quantas menções esperam (só ela vê). */
create or replace function public.rede_p4_ct_prefs() returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid; f rede_p4_ct_prefs; o rede_o9_prefs;
begin
  perform interno.alumia_porta();
  v := interno.rede_p4_ct_membro();
  delete from rede_p4_ct_mencoes where mencionado = v and criado_em < now() - interval '30 days';
  select * into f from rede_p4_ct_prefs where usuario = v;
  select * into o from rede_o9_prefs where usuario = v;
  return jsonb_build_object(
    'mencao_revisar', coalesce(f.mencao_revisar, false),
    'mencao_quem', coalesce(o.mencao_quem, 'todos'),
    'marcar_quem', coalesce(o.marcar_quem, 'ninguem'),
    'marcar_aprovar', coalesce(o.marcar_aprovar, true),
    'atendimento', f.atendimento,
    'ausencia', coalesce(f.ausencia, ''),
    'nivel', f.nivel,
    'pendentes', (select count(*) from rede_p4_ct_mencoes m where m.mencionado = v)::integer);
end $$;

/** Liga ou desliga a revisão das menções (76). Desligar não solta as que esperam: elas continuam na fila até a pessoa decidir. */
create or replace function public.rede_p4_ct_mencao_revisar(p_sim boolean) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid;
begin
  perform interno.alumia_porta();
  v := interno.rede_p4_ct_membro();
  perform interno.limite('alumia_p4_ct_escolher', 30, 60);
  insert into rede_p4_ct_prefs (usuario, mencao_revisar) values (v, coalesce(p_sim, false))
    on conflict (usuario) do update set mencao_revisar = excluded.mencao_revisar, atualizado_em = now();
  return public.rede_p4_ct_prefs();
end $$;

/** As menções que esperam: o post (só se ela ainda pode ver), quem escreveu (codinome e @) e um trecho. No máximo 50. */
create or replace function public.rede_p4_ct_mencoes() returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid;
begin
  perform interno.alumia_porta();
  v := interno.rede_p4_ct_membro();
  delete from rede_p4_ct_mencoes where mencionado = v and criado_em < now() - interval '30 days';
  return jsonb_build_object('itens', coalesce((
    select jsonb_agg(jsonb_build_object('post', x.id, 'codinome', interno.rede_nome(x.autor), 'handle', f.rede_handle,
             'trecho', left(coalesce(nullif(x.titulo, ''), x.texto, ''), 160), 'quando', m.criado_em) order by m.criado_em desc)
    from (select * from rede_p4_ct_mencoes where mencionado = v order by criado_em desc limit 50) m
    join rede_posts x on x.id = m.post
    left join perfis f on f.id = x.autor
    where x.apagado_em is null and not x.oculto and not x.retido and coalesce(interno.rede_ve(x, v), false)
      and not interno.rede_bloqueado(x.autor, v)), '[]'::jsonb));
end $$;

/**
 * Aprovar (vira a menção de sempre, com o aviso de sempre) ou recusar (some da fila; o post continua com o @ no texto, como quando
 * a regra de quem pode mencionar recusa). Quem escreveu não é avisada de nada.
 */
create or replace function public.rede_p4_ct_mencao_decidir(p_post uuid, p_aprovar boolean) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid; x rede_posts;
begin
  perform interno.alumia_porta();
  v := interno.rede_p4_ct_membro();
  delete from rede_p4_ct_mencoes where post = p_post and mencionado = v;
  if not found then perform interno.erro('nao_encontrado'); end if;
  if coalesce(p_aprovar, false) then
    select * into x from rede_posts where id = p_post;
    if found and x.apagado_em is null and not x.oculto and not x.retido and coalesce(interno.rede_ve(x, v), false) then
      perform set_config('alumia.p4ct_mencao', p_post::text || ':' || v::text, true);
      insert into rede_mencoes (post, mencionado) values (x.id, v) on conflict do nothing;
      if found then
        perform interno.rede3_conv_avisar(v, 'mencao', x.id, x.id, x.autor,
          format('%s mencionou você na Alumia: “%s”', interno.rede_nome(x.autor), left(coalesce(x.titulo, x.texto), 100)));
      end if;
      perform set_config('alumia.p4ct_mencao', '', true);
    end if;
  end if;
  return jsonb_build_object('ok', true);
end $$;

-- ── 2. Níveis de proteção prontos (107) ────────────────────────────────────────────────────────────────────────────────────

alter table interno.rede_p4_ct_prefs add column if not exists nivel text check (nivel is null or nivel in ('basico', 'reforcado', 'maximo'));

/**
 * Liga de uma vez o nível escolhido. Só mexe no que a própria pessoa já pode mudar uma a uma (o "quem pode me mencionar" e o "quem
 * pode me marcar" do o9, a revisão das menções, o status online e as contagens públicas do Prompt 4) e devolve o que ficou valendo.
 *   basico:    menção de todas, marcação só de quem ela segue e com aprovação, sem revisão;
 *   reforcado: menção só de quem ela segue, revisão das outras, marcação só de quem ela segue e com aprovação, status online e
 *              contagens públicas desligados;
 *   maximo:    ninguém menciona nem marca, revisão ligada, status e contagens desligados e a foto do perfil protegida contra print.
 * Nenhum nível liga algo que mostre mais da pessoa: subir ou descer nunca liga o status online nem as contagens.
 */
create or replace function public.rede_p4_ct_nivel(p_nivel text) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid; v_mencao text; v_marcar text; v_revisar boolean;
begin
  perform interno.alumia_porta();
  v := interno.rede_p4_ct_membro();
  if p_nivel is null or p_nivel not in ('basico', 'reforcado', 'maximo') then perform interno.erro('invalido:nivel'); end if;
  perform interno.limite('alumia_p4_ct_escolher', 30, 60);
  v_mencao := case p_nivel when 'basico' then 'todos' when 'reforcado' then 'seguindo' else 'ninguem' end;
  v_marcar := case p_nivel when 'maximo' then 'ninguem' else 'seguindo' end;
  v_revisar := p_nivel <> 'basico';
  insert into rede_o9_prefs (usuario, mencao_quem, marcar_quem, marcar_aprovar) values (v, v_mencao, v_marcar, true)
    on conflict (usuario) do update set mencao_quem = excluded.mencao_quem, marcar_quem = excluded.marcar_quem, marcar_aprovar = true, atualizado_em = now();
  insert into rede_p4_ct_prefs (usuario, mencao_revisar, nivel) values (v, v_revisar, p_nivel)
    on conflict (usuario) do update set mencao_revisar = excluded.mencao_revisar, nivel = excluded.nivel, atualizado_em = now();
  if p_nivel <> 'basico' then
    if to_regclass('interno.rede_p4_presenca') is not null then execute 'delete from interno.rede_p4_presenca where usuario = $1' using v; end if;
    if to_regclass('interno.rede_p4_contagens') is not null then
      execute 'update interno.rede_p4_contagens set seguidores = false, apoios = false, em = now() where perfil = $1' using v;
    end if;
  end if;
  if p_nivel = 'maximo' and to_regclass('interno.rede_p4_foto_protegida') is not null then
    execute 'insert into interno.rede_p4_foto_protegida (dono) values ($1) on conflict do nothing' using v;
  end if;
  return public.rede_p4_ct_prefs() || jsonb_build_object(
    'ficou', jsonb_build_object('mencao_quem', v_mencao, 'marcar_quem', v_marcar, 'marcar_aprovar', true, 'mencao_revisar', v_revisar,
      'presenca', case when p_nivel = 'basico' then null else false end, 'contagens', case when p_nivel = 'basico' then null else false end,
      'foto_protegida', case when p_nivel = 'maximo' then true end),
    -- O que é do aparelho ou muda o alcance, a pessoa decide (a tela mostra como sugestão).
    'sugestoes', case p_nivel when 'basico' then '[]'::jsonb when 'reforcado' then '["sair_rapido"]'::jsonb
                   else '["sair_rapido", "print", "trancar", "fediverso"]'::jsonb end);
end $$;

-- ── 3. Escudo contra invasão (80) ──────────────────────────────────────────────────────────────────────────────────────────

-- Uma linha por comunidade, só quando a mediação calibra ou quando o escudo trava. Sem linha = o padrão (ligado: 10 contas com
-- menos de 7 dias em 60 minutos travam a entrada de contas novas por 6 horas).
create table if not exists interno.rede_p4_ct_escudo (
  comunidade text primary key references interno.rede_comunidades (slug) on delete cascade on update cascade,
  ligado boolean not null default true,
  contas smallint not null default 10 check (contas between 3 and 500),
  conta_dias smallint not null default 7 check (conta_dias between 1 and 90),
  minutos smallint not null default 60 check (minutos between 5 and 1440),
  horas smallint not null default 6 check (horas between 1 and 72),
  travado_ate timestamptz,
  atualizado_em timestamptz not null default now()
);
alter table interno.rede_p4_ct_escudo enable row level security;
revoke all on table interno.rede_p4_ct_escudo from public;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then revoke all on table interno.rede_p4_ct_escudo from anon, authenticated; end if;
end $$;

/** A idade da conta em dias (pela data de criação que o Auth já guarda; só leitura, nada novo). */
create or replace function interno.rede_p4_ct_dias_de_conta(p_usuario uuid) returns integer language sql stable security definer set search_path = interno, pg_temp as $$
  select coalesce((select floor(extract(epoch from (now() - u.created_at)) / 86400)::integer from auth.users u where u.id = p_usuario), 0)
$$;

/** O escudo de uma comunidade, com o padrão quando não há linha. */
create or replace function interno.rede_p4_ct_escudo_de(p_com text) returns interno.rede_p4_ct_escudo language plpgsql stable security definer set search_path = interno, pg_temp as $$
declare e rede_p4_ct_escudo;
begin
  select * into e from rede_p4_ct_escudo where comunidade = p_com;
  if not found then e.comunidade := p_com; e.ligado := true; e.contas := 10; e.conta_dias := 7; e.minutos := 60; e.horas := 6; end if;
  return e;
end $$;

/** Antes de entrar: com o escudo travado, conta nova não entra (nem pede para entrar). Contas antigas e a mediação passam. */
create or replace function interno.rede_p4_ct_escudo_antes() returns trigger language plpgsql security definer set search_path = interno, pg_temp as $$
declare e rede_p4_ct_escudo;
begin
  if new.papel <> 'membro' or new.situacao not in ('ativo', 'pendente') then return new; end if;
  if not interno.rede_p4_ct_ligado() then return new; end if;
  e := interno.rede_p4_ct_escudo_de(new.comunidade);
  if e.ligado and e.travado_ate > now() and interno.rede_p4_ct_dias_de_conta(new.usuario) < e.conta_dias then
    perform interno.erro('escudo');
  end if;
  return new;
end $$;
drop trigger if exists rede_p4_ct_escudo_antes on interno.rede_comunidade_membros;
create trigger rede_p4_ct_escudo_antes before insert on interno.rede_comunidade_membros for each row execute function interno.rede_p4_ct_escudo_antes();

/**
 * Depois de entrar: conta QUANTAS contas novas entraram na janela (pela data de entrada e pela idade da conta, que já existem). Bateu
 * o número: trava a entrada de contas novas pelo prazo e avisa a mediação só com os números (nunca quem). Uma falha aqui não impede a
 * entrada (só um aviso no log do banco).
 */
create or replace function interno.rede_p4_ct_escudo_depois() returns trigger language plpgsql security definer set search_path = interno, pg_temp as $$
declare e rede_p4_ct_escudo; v_n integer; v_nome text;
begin
  if new.papel <> 'membro' or new.situacao <> 'ativo' then return null; end if;
  begin
    if not interno.rede_p4_ct_ligado() then return null; end if;
    e := interno.rede_p4_ct_escudo_de(new.comunidade);
    if not e.ligado or e.travado_ate > now() then return null; end if;
    select count(*) into v_n from rede_comunidade_membros m join auth.users u on u.id = m.usuario
      where m.comunidade = new.comunidade and m.papel = 'membro' and m.situacao = 'ativo'
        and m.entrou_em > now() - make_interval(mins => e.minutos::integer) and u.created_at > now() - make_interval(days => e.conta_dias::integer);
    if v_n < e.contas then return null; end if;
    insert into rede_p4_ct_escudo (comunidade, travado_ate) values (new.comunidade, now() + make_interval(hours => e.horas::integer))
      on conflict (comunidade) do update set travado_ate = excluded.travado_ate, atualizado_em = now();
    select nome into v_nome from rede_comunidades where slug = new.comunidade;
    perform interno.avisar_em(m.usuario, left(format('Escudo contra invasão em “%s”: %s contas com menos de %s dias entraram em %s minutos. A entrada de contas novas ficou travada por %s horas; contas antigas continuam entrando. Veja em Conta › Comunidades.',
        coalesce(v_nome, new.comunidade), v_n, e.conta_dias, e.minutos, e.horas), 500), 'rede')
    from rede_comunidade_membros m where m.comunidade = new.comunidade and m.papel = 'moderacao' and m.situacao = 'ativo';
  exception when others then
    raise warning 'rede_p4_ct_escudo_depois: %', sqlerrm;
  end;
  return null;
end $$;
drop trigger if exists rede_p4_ct_escudo_depois on interno.rede_comunidade_membros;
create trigger rede_p4_ct_escudo_depois after insert or update of situacao on interno.rede_comunidade_membros for each row execute function interno.rede_p4_ct_escudo_depois();

/** O escudo, para a mediação: a calibragem e até quando trava. Quem só é membro vê se a entrada de contas novas está travada. */
create or replace function public.rede_p4_ct_escudo(p_slug text) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid; c rede_comunidades; e rede_p4_ct_escudo; v_modero boolean;
begin
  perform interno.alumia_porta();
  v := interno.rede_p4_ct_membro();
  c := interno.rede_p4_ct_com(p_slug, v);
  e := interno.rede_p4_ct_escudo_de(c.slug);
  v_modero := interno.rede3_com_modera(c.slug, v) or interno.alumia_o10_pode(c.slug, v, 'pedidos');
  return jsonb_build_object('travado_ate', case when e.travado_ate > now() then e.travado_ate end, 'modero', v_modero)
    || case when v_modero then jsonb_build_object('ligado', e.ligado, 'contas', e.contas, 'conta_dias', e.conta_dias, 'minutos', e.minutos, 'horas', e.horas)
       else '{}'::jsonb end;
end $$;

/** A mediação calibra: {ligado, contas, conta_dias, minutos, horas, destravar}. Chave desconhecida é recusada. */
create or replace function public.rede_p4_ct_escudo_salvar(p_slug text, p jsonb) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid; c rede_comunidades; e rede_p4_ct_escudo; k text; v_int integer;
begin
  perform interno.alumia_porta();
  v := interno.rede_p4_ct_membro();
  c := interno.rede_p4_ct_com_modera(p_slug, v, 'pedidos');
  if p is null or jsonb_typeof(p) <> 'object' then perform interno.erro('invalido:escudo'); end if;
  perform interno.limite('alumia_p4_ct_mediar', 60, 60);
  e := interno.rede_p4_ct_escudo_de(c.slug);
  for k in select jsonb_object_keys(p) loop
    if k = 'ligado' or k = 'destravar' then
      if jsonb_typeof(p -> k) <> 'boolean' then perform interno.erro('invalido:' || k); end if;
      if k = 'ligado' then e.ligado := (p ->> k)::boolean; elsif (p ->> k)::boolean then e.travado_ate := null; end if;
    elsif k in ('contas', 'conta_dias', 'minutos', 'horas') then
      begin v_int := (p ->> k)::integer; exception when others then perform interno.erro('invalido:' || k); end;
      if v_int is null
         or (k = 'contas' and (v_int < 3 or v_int > 500)) or (k = 'conta_dias' and (v_int < 1 or v_int > 90))
         or (k = 'minutos' and (v_int < 5 or v_int > 1440)) or (k = 'horas' and (v_int < 1 or v_int > 72)) then
        perform interno.erro('invalido:' || k);
      end if;
      if k = 'contas' then e.contas := v_int; elsif k = 'conta_dias' then e.conta_dias := v_int; elsif k = 'minutos' then e.minutos := v_int; else e.horas := v_int; end if;
    else
      perform interno.erro('invalido:escudo');
    end if;
  end loop;
  insert into rede_p4_ct_escudo (comunidade, ligado, contas, conta_dias, minutos, horas, travado_ate)
    values (c.slug, e.ligado, e.contas, e.conta_dias, e.minutos, e.horas, e.travado_ate)
    on conflict (comunidade) do update set ligado = excluded.ligado, contas = excluded.contas, conta_dias = excluded.conta_dias,
      minutos = excluded.minutos, horas = excluded.horas, travado_ate = excluded.travado_ate, atualizado_em = now();
  perform interno.registrar('alumia_p4_escudo', c.slug, jsonb_build_object('ligado', e.ligado, 'contas', e.contas, 'travado', e.travado_ate is not null));
  return public.rede_p4_ct_escudo(c.slug);
end $$;

-- ── 4. Quiz das regras (127) ───────────────────────────────────────────────────────────────────────────────────────────────

-- Até 5 perguntas de múltipla escolha por comunidade. A resposta certa só a mediação vê; as respostas de quem faz não ficam.
create table if not exists interno.rede_p4_ct_quiz (
  comunidade text not null references interno.rede_comunidades (slug) on delete cascade on update cascade,
  numero smallint not null check (numero between 1 and 5),
  pergunta text not null check (char_length(pergunta) between 5 and 200),
  opcoes text[] not null check (cardinality(opcoes) between 2 and 4),
  certa smallint not null check (certa between 1 and 4),
  primary key (comunidade, numero)
);
alter table interno.rede_p4_ct_quiz enable row level security;
revoke all on table interno.rede_p4_ct_quiz from public;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then revoke all on table interno.rede_p4_ct_quiz from anon, authenticated; end if;
end $$;

/**
 * O aceite das regras (alumia_regras_lidas) numa comunidade com quiz só vale pela função do quiz, depois de acertar todas: ela põe a
 * marca da própria transação (alumia.p4ct_quiz) antes de chamar o aceite de sempre. Quem modera passa. Desligado, nada muda.
 */
create or replace function interno.rede_p4_ct_quiz_antes() returns trigger language plpgsql security definer set search_path = interno, pg_temp as $$
begin
  if not interno.rede_p4_ct_ligado() then return new; end if;
  if not exists (select 1 from rede_p4_ct_quiz q where q.comunidade = new.comunidade) then return new; end if;
  if coalesce(current_setting('alumia.p4ct_quiz', true), '') = new.comunidade || ':' || new.usuario::text then return new; end if;
  if interno.rede3_com_modera(new.comunidade, new.usuario) then return new; end if;
  perform interno.erro('quiz_pendente');
  return null;
end $$;
drop trigger if exists rede_p4_ct_quiz_antes on interno.alumia_regras_lidas;
create trigger rede_p4_ct_quiz_antes before insert or update on interno.alumia_regras_lidas for each row execute function interno.rede_p4_ct_quiz_antes();

/** O quiz da comunidade: as perguntas e as opções (a certa, só para quem modera ou tem o cargo "regras") e se a pessoa já aceitou. */
create or replace function public.rede_p4_ct_quiz(p_slug text) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid; c rede_comunidades; v_modero boolean; v_lidas timestamptz; v_regras timestamptz;
begin
  perform interno.alumia_porta();
  v := interno.rede_p4_ct_membro();
  c := interno.rede_p4_ct_com(p_slug, v);
  v_modero := interno.rede3_com_modera(c.slug, v) or interno.alumia_o10_pode(c.slug, v, 'regras');
  select lidas_em into v_lidas from alumia_regras_lidas where comunidade = c.slug and usuario = v;
  select regras_em into v_regras from alumia_chegada where comunidade = c.slug;
  return jsonb_build_object('modero', v_modero, 'aceitei', v_lidas is not null and (v_regras is null or v_lidas >= v_regras),
    'perguntas', coalesce((select jsonb_agg(jsonb_build_object('numero', q.numero, 'pergunta', q.pergunta, 'opcoes', to_jsonb(q.opcoes))
                                            || case when v_modero then jsonb_build_object('certa', q.certa) else '{}'::jsonb end order by q.numero)
                           from rede_p4_ct_quiz q where q.comunidade = c.slug), '[]'::jsonb));
end $$;

/** A mediação (ou o cargo "regras") troca o quiz inteiro: [{pergunta, opcoes[2..4], certa (1..n)}], até 5. Lista vazia tira o quiz. */
create or replace function public.rede_p4_ct_quiz_salvar(p_slug text, p jsonb) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid; c rede_comunidades; q jsonb; i integer := 0; v_opcoes text[]; v_certa integer; v_perg text; o jsonb;
begin
  perform interno.alumia_porta();
  v := interno.rede_p4_ct_membro();
  c := interno.rede_p4_ct_com_modera(p_slug, v, 'regras');
  if p is null or jsonb_typeof(p) <> 'array' or jsonb_array_length(p) > 5 then perform interno.erro('invalido:quiz'); end if;
  perform interno.limite('alumia_p4_ct_mediar', 60, 60);
  delete from rede_p4_ct_quiz where comunidade = c.slug;
  for q in select x from jsonb_array_elements(p) x loop
    i := i + 1;
    if jsonb_typeof(q) <> 'object' or jsonb_typeof(q -> 'opcoes') is distinct from 'array' then perform interno.erro('invalido:quiz'); end if;
    v_perg := interno.rede_p4_ct_campo(q ->> 'pergunta', 5, 200, 'pergunta');
    v_opcoes := '{}';
    for o in select y from jsonb_array_elements(q -> 'opcoes') y loop
      if jsonb_typeof(o) <> 'string' then perform interno.erro('invalido:opcao'); end if;
      v_opcoes := v_opcoes || interno.rede_p4_ct_campo(o #>> '{}', 1, 120, 'opcao');
    end loop;
    if cardinality(v_opcoes) < 2 or cardinality(v_opcoes) > 4 then perform interno.erro('invalido:opcoes'); end if;
    begin v_certa := (q ->> 'certa')::integer; exception when others then perform interno.erro('invalido:certa'); end;
    if v_certa is null or v_certa < 1 or v_certa > cardinality(v_opcoes) then perform interno.erro('invalido:certa'); end if;
    insert into rede_p4_ct_quiz (comunidade, numero, pergunta, opcoes, certa) values (c.slug, i, v_perg, v_opcoes, v_certa);
  end loop;
  -- O quiz novo vale para o próximo aceite; quem já aceitou continua valendo (como as regras, que pedem o aceite de novo quando mudam).
  perform interno.registrar('alumia_p4_quiz', c.slug, jsonb_build_object('perguntas', i));
  return public.rede_p4_ct_quiz(c.slug);
end $$;

/**
 * Responder o quiz: acertou todas, o aceite das regras de sempre (public.alumia_cargos_regras_aceitar) é gravado. Errou: devolve só
 * quantas erraram (nunca quais, nem a certa). As respostas não são guardadas em lugar nenhum.
 */
create or replace function public.rede_p4_ct_quiz_responder(p_slug text, p_respostas integer[]) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid; c rede_comunidades; v_total integer; v_erradas integer; v_aceite jsonb;
begin
  perform interno.alumia_porta();
  v := interno.rede_p4_ct_membro();
  c := interno.rede_p4_ct_com(p_slug, v);
  perform interno.limite('alumia_p4_ct_quiz', 20, 60);
  select count(*) into v_total from rede_p4_ct_quiz where comunidade = c.slug;
  if v_total = 0 then perform interno.erro('sem_quiz'); end if;
  if p_respostas is null or cardinality(p_respostas) <> v_total then perform interno.erro('invalido:respostas'); end if;
  select count(*) into v_erradas from rede_p4_ct_quiz q where q.comunidade = c.slug and q.certa is distinct from p_respostas[q.numero];
  if v_erradas > 0 then return jsonb_build_object('ok', false, 'erradas', v_erradas); end if;
  perform set_config('alumia.p4ct_quiz', c.slug || ':' || v::text, true);
  v_aceite := public.alumia_cargos_regras_aceitar(c.slug);
  perform set_config('alumia.p4ct_quiz', '', true);
  return jsonb_build_object('ok', true) || coalesce(v_aceite, '{}'::jsonb);
end $$;

-- ── 5. Guia de entrada (114) ───────────────────────────────────────────────────────────────────────────────────────────────

-- Até 6 passos para quem chega: título, texto e um caminho da própria Alumia (opcional). O progresso fica no aparelho.
create table if not exists interno.rede_p4_ct_guia (
  comunidade text primary key references interno.rede_comunidades (slug) on delete cascade on update cascade,
  passos jsonb not null default '[]'::jsonb check (jsonb_typeof(passos) = 'array' and jsonb_array_length(passos) <= 6),
  atualizado_em timestamptz not null default now()
);
alter table interno.rede_p4_ct_guia enable row level security;
revoke all on table interno.rede_p4_ct_guia from public;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then revoke all on table interno.rede_p4_ct_guia from anon, authenticated; end if;
end $$;

/** O guia de entrada da comunidade (quem pode ver a comunidade lê) e se quem chama pode editar. */
create or replace function public.rede_p4_ct_guia(p_slug text) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid; c rede_comunidades;
begin
  perform interno.alumia_porta();
  v := interno.rede_p4_ct_membro();
  c := interno.rede_p4_ct_com(p_slug, v);
  return jsonb_build_object('passos', coalesce((select passos from rede_p4_ct_guia where comunidade = c.slug), '[]'::jsonb),
    'posso_editar', interno.rede3_com_modera(c.slug, v) or interno.alumia_o10_pode(c.slug, v, 'boas_vindas'));
end $$;

/** Troca o guia inteiro: [{titulo, texto, link}] (link: caminho que começa por /alumia/, ou vazio). Lista vazia tira o guia. */
create or replace function public.rede_p4_ct_guia_salvar(p_slug text, p jsonb) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid; c rede_comunidades; x jsonb; v_lista jsonb := '[]'::jsonb; v_link text;
begin
  perform interno.alumia_porta();
  v := interno.rede_p4_ct_membro();
  c := interno.rede_p4_ct_com_modera(p_slug, v, 'boas_vindas');
  if p is null or jsonb_typeof(p) <> 'array' or jsonb_array_length(p) > 6 then perform interno.erro('invalido:guia'); end if;
  perform interno.limite('alumia_p4_ct_mediar', 60, 60);
  for x in select y from jsonb_array_elements(p) y loop
    if jsonb_typeof(x) <> 'object' then perform interno.erro('invalido:guia'); end if;
    v_link := interno.rede_p4_ct_texto(x ->> 'link', 200);
    if v_link <> '' and v_link !~ '^/alumia/[a-z0-9/_#?=&.-]*$' then perform interno.erro('invalido:link'); end if;
    v_lista := v_lista || jsonb_build_array(jsonb_build_object(
      'titulo', interno.rede_p4_ct_campo(x ->> 'titulo', 3, 80, 'titulo'),
      'texto', interno.rede_p4_ct_campo(x ->> 'texto', 0, 400, 'texto'),
      'link', v_link));
  end loop;
  if jsonb_array_length(v_lista) = 0 then
    delete from rede_p4_ct_guia where comunidade = c.slug;
  else
    insert into rede_p4_ct_guia (comunidade, passos) values (c.slug, v_lista)
      on conflict (comunidade) do update set passos = excluded.passos, atualizado_em = now();
  end if;
  return public.rede_p4_ct_guia(c.slug);
end $$;

-- ── 6. Sala de cuidado entre pares (105) ───────────────────────────────────────────────────────────────────────────────────

-- As comunidades que a mediação marcou como sala de cuidado. Só a marca e um texto da mediação; nada de quem precisou.
create table if not exists interno.rede_p4_ct_cuidado (
  comunidade text primary key references interno.rede_comunidades (slug) on delete cascade on update cascade,
  texto text not null default '' check (char_length(texto) <= 600),
  desde timestamptz not null default now()
);
alter table interno.rede_p4_ct_cuidado enable row level security;
revoke all on table interno.rede_p4_ct_cuidado from public;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then revoke all on table interno.rede_p4_ct_cuidado from anon, authenticated; end if;
end $$;

/** A comunidade é sala de cuidado? (o texto da mediação e se quem chama pode marcar ou encaminhar). */
create or replace function public.rede_p4_ct_cuidado(p_slug text) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid; c rede_comunidades; s rede_p4_ct_cuidado;
begin
  perform interno.alumia_porta();
  v := interno.rede_p4_ct_membro();
  c := interno.rede_p4_ct_com(p_slug, v);
  select * into s from rede_p4_ct_cuidado where comunidade = c.slug;
  return jsonb_build_object('sala', s.comunidade is not null, 'texto', coalesce(s.texto, ''), 'modero', interno.rede3_com_modera(c.slug, v));
end $$;

/** As salas de cuidado que a pessoa pode ver (para a página "Como a Rede cuida"). Só o nome e o endereço; nenhum número. */
create or replace function public.rede_p4_ct_cuidados() returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid;
begin
  perform interno.alumia_porta();
  v := interno.rede_p4_ct_membro();
  return jsonb_build_object('salas', coalesce((
    select jsonb_agg(jsonb_build_object('slug', c.slug, 'nome', c.nome) order by c.nome)
    from rede_p4_ct_cuidado s join rede_comunidades c on c.slug = s.comunidade
    where c.tipo <> 'fechada' or interno.rede2_na_comunidade(c.slug, v)), '[]'::jsonb));
end $$;

/** Só quem modera a comunidade marca ou desmarca a sala de cuidado (com um texto opcional da mediação). */
create or replace function public.rede_p4_ct_cuidado_marcar(p_slug text, p_sim boolean, p_texto text default '') returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid; c rede_comunidades;
begin
  perform interno.alumia_porta();
  v := interno.rede_p4_ct_membro();
  c := interno.rede_p4_ct_com_modera(p_slug, v, null);
  perform interno.limite('alumia_p4_ct_mediar', 60, 60);
  if coalesce(p_sim, false) then
    insert into rede_p4_ct_cuidado (comunidade, texto) values (c.slug, interno.rede_p4_ct_campo(p_texto, 0, 600, 'texto'))
      on conflict (comunidade) do update set texto = excluded.texto;
  else
    delete from rede_p4_ct_cuidado where comunidade = c.slug;
  end if;
  perform interno.registrar('alumia_p4_cuidado', c.slug, jsonb_build_object('sala', coalesce(p_sim, false)));
  return public.rede_p4_ct_cuidado(c.slug);
end $$;

/**
 * A mediação de uma sala de cuidado manda a alguém da comunidade, em particular, o caminho do CVV (188) e dos serviços públicos (um
 * aviso só para a pessoa, com o texto fixo). Não fica registro de a quem foi (só o aviso da própria pessoa, que ela apaga).
 */
create or replace function public.rede_p4_ct_cuidado_encaminhar(p_slug text, p_handle text) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid; c rede_comunidades; v_alvo uuid;
begin
  perform interno.alumia_porta();
  v := interno.rede_p4_ct_membro();
  c := interno.rede_p4_ct_com_modera(p_slug, v, null);
  if not exists (select 1 from rede_p4_ct_cuidado where comunidade = c.slug) then perform interno.erro('nao_e_sala'); end if;
  perform interno.limite('alumia_p4_ct_encaminhar', 20, 60);
  select f.id into v_alvo from perfis f where f.rede_handle = lower(btrim(coalesce(p_handle, ''), ' @'));
  if v_alvo is null or v_alvo = v or not exists (select 1 from rede_comunidade_membros m where m.comunidade = c.slug and m.usuario = v_alvo and m.situacao = 'ativo')
     or interno.rede_bloqueado(v, v_alvo) or interno.rede_bloqueado(v_alvo, v) then
    perform interno.erro('nao_encontrado');
  end if;
  perform interno.avisar_em(v_alvo, format('A mediação de “%s” deixou um caminho de cuidado para você: o CVV atende pelo 188 (24 horas, de graça) e em cvv.org.br; '
    || 'em emergência, o SAMU pelo 192; o CAPS e a UBS do seu bairro atendem de graça. A página “Como a Rede cuida” tem mais.', c.nome), 'rede');
  return jsonb_build_object('ok', true);
end $$;

-- ── 7. Mediação restaurativa (78) ──────────────────────────────────────────────────────────────────────────────────────────

-- A mediação restaurativa: a comunidade, a mediadora, a situação e o acordo (só o texto combinado, apagado 30 dias depois do fim).
create table if not exists interno.rede_p4_ct_mediacoes (
  id uuid primary key default gen_random_uuid(),
  comunidade text not null references interno.rede_comunidades (slug) on delete cascade on update cascade,
  mediadora uuid not null references interno.perfis (id) on delete cascade,
  situacao text not null default 'convite' check (situacao in ('convite', 'aberta', 'acordo', 'sem_acordo', 'recusada')),
  acordo text not null default '' check (char_length(acordo) <= 1500),
  criado_em timestamptz not null default now(),
  encerrada_em timestamptz
);
create index if not exists rede_p4_ct_mediacoes_mediadora on interno.rede_p4_ct_mediacoes (mediadora);
-- As duas partes: o convite (aceitou ou recusou) e se aceitou o acordo proposto.
create table if not exists interno.rede_p4_ct_med_partes (
  mediacao uuid not null references interno.rede_p4_ct_mediacoes (id) on delete cascade,
  usuario uuid not null references interno.perfis (id) on delete cascade,
  aceite text not null default 'pendente' check (aceite in ('pendente', 'aceitou', 'recusou')),
  acordo_ok boolean not null default false,
  primary key (mediacao, usuario)
);
create index if not exists rede_p4_ct_med_partes_usuario on interno.rede_p4_ct_med_partes (usuario);
-- As falas: só enquanto a mediação está aberta; somem quando ela termina.
create table if not exists interno.rede_p4_ct_med_falas (
  id bigserial primary key,
  mediacao uuid not null references interno.rede_p4_ct_mediacoes (id) on delete cascade,
  autor uuid not null references interno.perfis (id) on delete cascade,
  texto text not null check (char_length(texto) between 1 and 1000),
  criado_em timestamptz not null default now()
);
create index if not exists rede_p4_ct_med_falas_mediacao on interno.rede_p4_ct_med_falas (mediacao, id);
alter table interno.rede_p4_ct_mediacoes enable row level security;
alter table interno.rede_p4_ct_med_partes enable row level security;
alter table interno.rede_p4_ct_med_falas enable row level security;
revoke all on table interno.rede_p4_ct_mediacoes, interno.rede_p4_ct_med_partes, interno.rede_p4_ct_med_falas from public;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on table interno.rede_p4_ct_mediacoes, interno.rede_p4_ct_med_partes, interno.rede_p4_ct_med_falas from anon, authenticated;
  end if;
end $$;

/** A faxina: o acordo (ou o fim sem acordo, ou a recusa) fica 30 dias para as três; o convite sem resposta some em 14 dias. */
create or replace function interno.rede_p4_ct_med_faxina() returns void language sql security definer set search_path = interno, pg_temp as $$
  delete from interno.rede_p4_ct_mediacoes where (encerrada_em is not null and encerrada_em < now() - interval '30 days')
    or (situacao = 'convite' and criado_em < now() - interval '14 days');
$$;

/** A mediação, se quem chama é a mediadora ou uma das partes; senão, nao_encontrado (ninguém de fora sabe que ela existe). */
create or replace function interno.rede_p4_ct_med_achar(p_id uuid, p_quem uuid) returns interno.rede_p4_ct_mediacoes language plpgsql stable security definer set search_path = interno, pg_temp as $$
declare m rede_p4_ct_mediacoes;
begin
  select * into m from rede_p4_ct_mediacoes where id = p_id;
  if m.id is null or not (m.mediadora = p_quem or exists (select 1 from rede_p4_ct_med_partes p where p.mediacao = m.id and p.usuario = p_quem)) then
    perform interno.erro('nao_encontrado');
  end if;
  return m;
end $$;

/** Uma mediação como as três a veem: as partes pelo codinome, o que cada uma decidiu, as falas (enquanto aberta) e o acordo. */
create or replace function interno.rede_p4_ct_med_json(m interno.rede_p4_ct_mediacoes, p_quem uuid) returns jsonb language sql stable security definer set search_path = interno, pg_temp as $$
  select jsonb_build_object('id', m.id, 'comunidade', (select jsonb_build_object('slug', c.slug, 'nome', c.nome) from interno.rede_comunidades c where c.slug = m.comunidade),
    'situacao', m.situacao, 'acordo', m.acordo, 'criado_em', m.criado_em, 'encerrada_em', m.encerrada_em,
    'sou', case when m.mediadora = p_quem then 'mediadora' else 'parte' end,
    'mediadora', interno.rede_nome(m.mediadora),
    'partes', coalesce((select jsonb_agg(jsonb_build_object('codinome', interno.rede_nome(p.usuario), 'eu', p.usuario = p_quem, 'aceite', p.aceite, 'acordo_ok', p.acordo_ok)
                                         order by p.usuario = p_quem desc, interno.rede_nome(p.usuario))
                        from interno.rede_p4_ct_med_partes p where p.mediacao = m.id), '[]'::jsonb),
    'falas', case when m.situacao = 'aberta' then coalesce((
               select jsonb_agg(jsonb_build_object('id', f.id, 'codinome', interno.rede_nome(f.autor), 'eu', f.autor = p_quem, 'mediadora', f.autor = m.mediadora,
                                                   'texto', f.texto, 'quando', f.criado_em) order by f.id)
               from (select * from interno.rede_p4_ct_med_falas x where x.mediacao = m.id order by x.id desc limit 200) f), '[]'::jsonb) else '[]'::jsonb end)
$$;

/** As mediações de quem chama (como mediadora ou parte que não recusou). */
create or replace function public.rede_p4_ct_mediacoes() returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid;
begin
  perform interno.alumia_porta();
  v := interno.rede_p4_ct_membro();
  perform interno.rede_p4_ct_med_faxina();
  return jsonb_build_object('itens', coalesce((
    select jsonb_agg(interno.rede_p4_ct_med_json(m, v) order by m.criado_em desc)
    from rede_p4_ct_mediacoes m
    where m.mediadora = v or exists (select 1 from rede_p4_ct_med_partes p where p.mediacao = m.id and p.usuario = v)), '[]'::jsonb));
end $$;

/**
 * Quem modera a comunidade convida duas pessoas dela (pelo @) para uma conversa mediada. As duas recebem um aviso que não diz com
 * quem nem por quê; cada uma aceita ou recusa. Não entra no histórico de moderação de ninguém.
 */
create or replace function public.rede_p4_ct_mediacao_abrir(p_slug text, p_handle_a text, p_handle_b text) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid; c rede_comunidades; v_a uuid; v_b uuid; m rede_p4_ct_mediacoes;
begin
  perform interno.alumia_porta();
  v := interno.rede_p4_ct_membro();
  c := interno.rede_p4_ct_com_modera(p_slug, v, null);
  perform interno.limite('alumia_p4_ct_mediacao_abrir', 10, 1440);
  select f.id into v_a from perfis f where f.rede_handle = lower(btrim(coalesce(p_handle_a, ''), ' @'));
  select f.id into v_b from perfis f where f.rede_handle = lower(btrim(coalesce(p_handle_b, ''), ' @'));
  if v_a is null or v_b is null or v_a = v_b or v in (v_a, v_b)
     or not exists (select 1 from rede_comunidade_membros x where x.comunidade = c.slug and x.usuario = v_a and x.situacao = 'ativo')
     or not exists (select 1 from rede_comunidade_membros x where x.comunidade = c.slug and x.usuario = v_b and x.situacao = 'ativo') then
    perform interno.erro('invalido:partes');
  end if;
  if exists (select 1 from rede_p4_ct_mediacoes x join rede_p4_ct_med_partes pa on pa.mediacao = x.id and pa.usuario = v_a
             join rede_p4_ct_med_partes pb on pb.mediacao = x.id and pb.usuario = v_b where x.situacao in ('convite', 'aberta')) then
    perform interno.erro('ja_existe');
  end if;
  insert into rede_p4_ct_mediacoes (comunidade, mediadora) values (c.slug, v) returning * into m;
  insert into rede_p4_ct_med_partes (mediacao, usuario) values (m.id, v_a), (m.id, v_b);
  perform interno.avisar_em(x, format('A mediação de “%s” convidou você para uma conversa mediada, como alternativa à punição. Você aceita ou recusa em Conta › Mediações.', c.nome), 'rede')
    from unnest(array[v_a, v_b]) x;
  return interno.rede_p4_ct_med_json(m, v);
end $$;

/** A parte aceita ou recusa o convite. Recusou: a mediação termina para as três (sem dizer quem recusou). */
create or replace function public.rede_p4_ct_mediacao_responder(p_id uuid, p_aceitar boolean) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid; m rede_p4_ct_mediacoes;
begin
  perform interno.alumia_porta();
  v := interno.rede_p4_ct_membro();
  m := interno.rede_p4_ct_med_achar(p_id, v);
  if m.mediadora = v then perform interno.erro('sem_permissao'); end if;
  if m.situacao <> 'convite' then perform interno.erro('encerrada'); end if;
  perform interno.limite('alumia_p4_ct_escolher', 30, 60);
  update rede_p4_ct_med_partes set aceite = case when coalesce(p_aceitar, false) then 'aceitou' else 'recusou' end where mediacao = m.id and usuario = v;
  if not coalesce(p_aceitar, false) then
    update rede_p4_ct_mediacoes set situacao = 'recusada', encerrada_em = now() where id = m.id returning * into m;
    -- Ninguém fica sabendo quem recusou: as duas voltam a "pendente" na resposta.
    update rede_p4_ct_med_partes set aceite = 'pendente' where mediacao = m.id;
  elsif not exists (select 1 from rede_p4_ct_med_partes p where p.mediacao = m.id and p.aceite <> 'aceitou') then
    update rede_p4_ct_mediacoes set situacao = 'aberta' where id = m.id returning * into m;
  end if;
  return interno.rede_p4_ct_med_json(m, v);
end $$;

/** Uma fala (até 1000 letras) das três, só com a mediação aberta. */
create or replace function public.rede_p4_ct_mediacao_falar(p_id uuid, p_texto text) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid; m rede_p4_ct_mediacoes; v_t text;
begin
  perform interno.alumia_porta();
  v := interno.rede_p4_ct_membro();
  m := interno.rede_p4_ct_med_achar(p_id, v);
  if m.situacao <> 'aberta' then perform interno.erro('encerrada'); end if;
  v_t := interno.rede_p4_ct_texto(p_texto, 1001);
  if char_length(v_t) < 1 or char_length(v_t) > 1000 then perform interno.erro('invalido:texto'); end if;
  perform interno.limite('alumia_p4_ct_falar', 60, 10);
  insert into rede_p4_ct_med_falas (mediacao, autor, texto) values (m.id, v, v_t);
  return interno.rede_p4_ct_med_json(m, v);
end $$;

/** A mediadora propõe (ou troca) o texto do acordo; as duas aceitações voltam a zero. */
create or replace function public.rede_p4_ct_mediacao_propor(p_id uuid, p_acordo text) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid; m rede_p4_ct_mediacoes;
begin
  perform interno.alumia_porta();
  v := interno.rede_p4_ct_membro();
  m := interno.rede_p4_ct_med_achar(p_id, v);
  if m.mediadora <> v then perform interno.erro('sem_permissao'); end if;
  if m.situacao <> 'aberta' then perform interno.erro('encerrada'); end if;
  perform interno.limite('alumia_p4_ct_falar', 60, 10);
  update rede_p4_ct_mediacoes set acordo = interno.rede_p4_ct_campo(p_acordo, 10, 1500, 'acordo') where id = m.id returning * into m;
  update rede_p4_ct_med_partes set acordo_ok = false where mediacao = m.id;
  return interno.rede_p4_ct_med_json(m, v);
end $$;

/** A parte aceita (ou retira o aceite) do acordo proposto. As duas aceitaram: a mediação termina com acordo e as falas somem. */
create or replace function public.rede_p4_ct_mediacao_acordo(p_id uuid, p_sim boolean) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid; m rede_p4_ct_mediacoes;
begin
  perform interno.alumia_porta();
  v := interno.rede_p4_ct_membro();
  m := interno.rede_p4_ct_med_achar(p_id, v);
  if m.mediadora = v then perform interno.erro('sem_permissao'); end if;
  if m.situacao <> 'aberta' then perform interno.erro('encerrada'); end if;
  if m.acordo = '' then perform interno.erro('sem_acordo'); end if;
  perform interno.limite('alumia_p4_ct_escolher', 30, 60);
  update rede_p4_ct_med_partes set acordo_ok = coalesce(p_sim, false) where mediacao = m.id and usuario = v;
  if not exists (select 1 from rede_p4_ct_med_partes p where p.mediacao = m.id and not p.acordo_ok) then
    delete from rede_p4_ct_med_falas where mediacao = m.id;
    update rede_p4_ct_mediacoes set situacao = 'acordo', encerrada_em = now() where id = m.id returning * into m;
  end if;
  return interno.rede_p4_ct_med_json(m, v);
end $$;

/** A mediadora ou qualquer das partes encerra sem acordo: as falas somem. */
create or replace function public.rede_p4_ct_mediacao_encerrar(p_id uuid) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid; m rede_p4_ct_mediacoes;
begin
  perform interno.alumia_porta();
  v := interno.rede_p4_ct_membro();
  m := interno.rede_p4_ct_med_achar(p_id, v);
  if m.situacao not in ('convite', 'aberta') then perform interno.erro('encerrada'); end if;
  delete from rede_p4_ct_med_falas where mediacao = m.id;
  update rede_p4_ct_mediacoes set situacao = 'sem_acordo', acordo = '', encerrada_em = now() where id = m.id returning * into m;
  return interno.rede_p4_ct_med_json(m, v);
end $$;

-- ── 8. Horário de atendimento e mensagem de ausência (112) ─────────────────────────────────────────────────────────────────

/** {dias: [0..6], de: 'HH:MM', ate: 'HH:MM'} (ou nulo, sem horário) e a mensagem de ausência (até 280 letras, sem dado pessoal). */
create or replace function public.rede_p4_ct_atendimento_salvar(p_atendimento jsonb, p_ausencia text) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid; v_dias integer[]; v_de integer; v_ate integer; v_a jsonb; d jsonb;
begin
  perform interno.alumia_porta();
  v := interno.rede_p4_ct_membro();
  perform interno.limite('alumia_p4_ct_escolher', 30, 60);
  if p_atendimento is not null and jsonb_typeof(p_atendimento) <> 'null' then
    if jsonb_typeof(p_atendimento) <> 'object' or jsonb_typeof(p_atendimento -> 'dias') is distinct from 'array'
       or coalesce(p_atendimento ->> 'de', '') !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' or coalesce(p_atendimento ->> 'ate', '') !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' then
      perform interno.erro('invalido:atendimento');
    end if;
    v_dias := '{}';
    for d in select x from jsonb_array_elements(p_atendimento -> 'dias') x loop
      if jsonb_typeof(d) <> 'number' or (d #>> '{}') !~ '^[0-6]$' then perform interno.erro('invalido:atendimento'); end if;
      if not ((d #>> '{}')::integer = any (v_dias)) then v_dias := v_dias || (d #>> '{}')::integer; end if;
    end loop;
    if cardinality(v_dias) = 0 then perform interno.erro('invalido:atendimento'); end if;
    v_de := split_part(p_atendimento ->> 'de', ':', 1)::integer * 60 + split_part(p_atendimento ->> 'de', ':', 2)::integer;
    v_ate := split_part(p_atendimento ->> 'ate', ':', 1)::integer * 60 + split_part(p_atendimento ->> 'ate', ':', 2)::integer;
    if v_de = v_ate then perform interno.erro('invalido:atendimento'); end if;
    v_a := jsonb_build_object('dias', (select jsonb_agg(x order by x) from unnest(v_dias) x), 'de', v_de, 'ate', v_ate);
  end if;
  insert into rede_p4_ct_prefs (usuario, atendimento, ausencia) values (v, v_a, interno.rede_p4_ct_campo(p_ausencia, 0, 280, 'ausencia'))
    on conflict (usuario) do update set atendimento = excluded.atendimento, ausencia = excluded.ausencia, atualizado_em = now();
  return public.rede_p4_ct_prefs();
end $$;

/** Fora do horário no instante dado (pelo relógio de São Paulo)? Nulo = sem horário. Atravessa a meia-noite quando "de" > "até". */
create or replace function interno.rede_p4_ct_fora(p_a jsonb, p_em timestamptz) returns boolean language plpgsql stable set search_path = interno, pg_temp as $$
declare v_agora timestamp := p_em at time zone 'America/Sao_Paulo'; v_min integer; v_dia integer; v_de integer; v_ate integer; v_ontem integer;
begin
  if p_a is null then return null; end if;
  v_min := extract(hour from v_agora)::integer * 60 + extract(minute from v_agora)::integer;
  v_dia := extract(dow from v_agora)::integer;
  v_ontem := (v_dia + 6) % 7;
  v_de := (p_a ->> 'de')::integer; v_ate := (p_a ->> 'ate')::integer;
  if v_de < v_ate then
    return not ((p_a -> 'dias') @> to_jsonb(v_dia) and v_min >= v_de and v_min < v_ate);
  end if;
  return not (((p_a -> 'dias') @> to_jsonb(v_dia) and v_min >= v_de) or ((p_a -> 'dias') @> to_jsonb(v_ontem) and v_min < v_ate));
end $$;

/**
 * O horário de alguém, para quem vai escrever: só "fora do horário agora" e a mensagem, calculados na hora (nada guardado sobre quem
 * perguntou). Nulo quando a pessoa não pôs horário nem mensagem, ou quando há bloqueio entre as duas.
 */
create or replace function public.rede_p4_ct_atendimento_de(p_handle text) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid; v_alvo uuid; f rede_p4_ct_prefs; v_fora boolean;
begin
  perform interno.alumia_porta();
  v := interno.rede_p4_ct_membro();
  perform interno.limite('rede2_ler', 600, 60);
  select p.id into v_alvo from perfis p where p.rede_handle = lower(btrim(coalesce(p_handle, ''), ' @'));
  if v_alvo is null or interno.rede_bloqueado(v_alvo, v) or interno.rede_bloqueado(v, v_alvo) then return null; end if;
  select * into f from rede_p4_ct_prefs where usuario = v_alvo;
  if f.usuario is null or (f.atendimento is null and f.ausencia = '') then return null; end if;
  v_fora := interno.rede_p4_ct_fora(f.atendimento, now());
  return jsonb_build_object('tem_horario', f.atendimento is not null, 'fora', coalesce(v_fora, true),
    'mensagem', case when coalesce(v_fora, true) then f.ausencia else '' end, 'horario', f.atendimento);
end $$;

-- ── 9. As comunidades da pessoa (para a tela) ─────────────────────────────────────────────────────────────────────────────

/** As comunidades em que a pessoa está, com o que ela pode cuidar em cada uma. Só as dela; nenhuma pessoa, nenhum número. */
create or replace function public.rede_p4_ct_minhas() returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid;
begin
  perform interno.alumia_porta();
  v := interno.rede_p4_ct_membro();
  return jsonb_build_object('comunidades', coalesce((
    select jsonb_agg(jsonb_build_object('slug', c.slug, 'nome', c.nome, 'modero', m.papel = 'moderacao',
             'regras', m.papel = 'moderacao' or interno.alumia_o10_pode(c.slug, v, 'regras'),
             'boas_vindas', m.papel = 'moderacao' or interno.alumia_o10_pode(c.slug, v, 'boas_vindas'),
             'pedidos', m.papel = 'moderacao' or interno.alumia_o10_pode(c.slug, v, 'pedidos')) order by c.nome)
    from rede_comunidade_membros m join rede_comunidades c on c.slug = m.comunidade
    where m.usuario = v and m.situacao = 'ativo'), '[]'::jsonb));
end $$;

-- ── 10. Mudar de servidor no Fediverso (74) ────────────────────────────────────────────────────────────────────────────────

-- A conta nova para onde a pessoa se mudou: o servidor do site confere o alsoKnownAs da conta nova antes de mandar o Move.
create table if not exists interno.rede_p4_ct_mudanca (
  usuario uuid primary key references interno.perfis (id) on delete cascade,
  alvo text not null check (alvo ~ '^https://[^\s]+$' and char_length(alvo) <= 500),
  situacao text not null default 'conferir' check (situacao in ('conferir', 'enviada')),
  pedido_em timestamptz not null default now(),
  enviada_em timestamptz
);
alter table interno.rede_p4_ct_mudanca enable row level security;
revoke all on table interno.rede_p4_ct_mudanca from public;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then revoke all on table interno.rede_p4_ct_mudanca from anon, authenticated; end if;
end $$;

-- A fila de entrega ganha o tipo "move" (os outros continuam iguais).
do $$
declare r record;
begin
  for r in select conname from pg_constraint where conrelid = 'interno.rede_fed_fila'::regclass and contype = 'c'
             and pg_get_constraintdef(oid) like '%tipo%' and conname <> 'rede_fed_fila_tipo_p4' loop
    execute format('alter table interno.rede_fed_fila drop constraint %I', r.conname);
  end loop;
  if not exists (select 1 from pg_constraint where conrelid = 'interno.rede_fed_fila'::regclass and conname = 'rede_fed_fila_tipo_p4') then
    alter table interno.rede_fed_fila add constraint rede_fed_fila_tipo_p4 check (tipo in ('create', 'update', 'delete', 'accept', 'reject', 'follow', 'undo-follow',
      'like', 'undo-like', 'announce', 'undo-announce', 'flag', 'block', 'undo-block', 'group-announce', 'group-accept', 'move'));
  end if;
end $$;

/** A mudança da pessoa: se a federação está ligada, o @, a conta nova, a situação e quantas seguidoras de fora (só a partir de 3). */
create or replace function public.rede_p4_ct_mudanca() returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid; a rede_fed_atores; m rede_p4_ct_mudanca;
begin
  perform interno.alumia_porta();
  v := interno.rede_p4_ct_membro();
  select * into a from rede_fed_atores where perfil = v;
  select * into m from rede_p4_ct_mudanca where usuario = v;
  return jsonb_build_object('federada', coalesce(a.ligado, false), 'handle', case when coalesce(a.ligado, false) then a.handle end,
    'alvo', m.alvo, 'situacao', m.situacao, 'enviada_em', m.enviada_em,
    'seguidoras', interno.alumia_pessoas((select count(*) from rede_fed_seguidores s where s.perfil = v)));
end $$;

/** Aponta a conta nova (endereço https do ator dela); vazio desiste. Só com a federação ligada e enquanto não foi enviada. */
create or replace function public.rede_p4_ct_mudanca_pedir(p_alvo text) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid; v_alvo text := btrim(coalesce(p_alvo, ''));
begin
  perform interno.alumia_porta();
  v := interno.rede_p4_ct_membro();
  if not exists (select 1 from rede_fed_atores a where a.perfil = v and a.ligado) then perform interno.erro('sem_federacao'); end if;
  if exists (select 1 from rede_p4_ct_mudanca where usuario = v and situacao = 'enviada') then perform interno.erro('ja_enviada'); end if;
  perform interno.limite('alumia_p4_ct_mudanca', 10, 60);
  if v_alvo = '' then
    delete from rede_p4_ct_mudanca where usuario = v;
  else
    if char_length(v_alvo) > 500 or v_alvo !~ '^https://[a-z0-9.-]+\.[a-z]{2,}(:[0-9]{2,5})?/[^\s]*$' then perform interno.erro('invalido:alvo'); end if;
    if exists (select 1 from rede_fed_bloqueados b where b.dominio = interno.rede_fed_dominio(v_alvo)) then perform interno.erro('servidor_bloqueado'); end if;
    insert into rede_p4_ct_mudanca (usuario, alvo) values (v, v_alvo)
      on conflict (usuario) do update set alvo = excluded.alvo, situacao = 'conferir', pedido_em = now();
  end if;
  return public.rede_p4_ct_mudanca();
end $$;

/**
 * Só o servidor do site (chave de serviço), depois de buscar a conta nova e conferir que ela declara esta em alsoKnownAs: marca a
 * mudança como enviada e põe um Move por caixa de entrada das seguidoras na fila de entrega. Uma vez só.
 */
create or replace function public.rede_p4_ct_mudanca_enviar(p_usuario uuid, p_alvo text) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare m rede_p4_ct_mudanca; v_n integer;
begin
  perform interno.alumia_porta();
  if not interno.rede_p4_ct_ligado() then perform interno.erro('desligado'); end if;
  select * into m from rede_p4_ct_mudanca where usuario = p_usuario for update;
  if m.usuario is null or m.alvo is distinct from p_alvo then perform interno.erro('nao_encontrado'); end if;
  if m.situacao = 'enviada' then return jsonb_build_object('ok', true, 'caixas', 0); end if;
  if not exists (select 1 from rede_fed_atores a where a.perfil = p_usuario and a.ligado) then perform interno.erro('sem_federacao'); end if;
  insert into rede_fed_fila (perfil, tipo, objeto, destino)
  select p_usuario, 'move', m.alvo, x.caixa
  from (select distinct coalesce(s.inbox_compartilhada, s.inbox) as caixa from rede_fed_seguidores s where s.perfil = p_usuario) x
  where not exists (select 1 from rede_fed_bloqueados b where b.dominio = interno.rede_fed_dominio(x.caixa));
  get diagnostics v_n = row_count;
  update rede_p4_ct_mudanca set situacao = 'enviada', enviada_em = now() where usuario = p_usuario;
  return jsonb_build_object('ok', true, 'caixas', v_n);
end $$;

/** Para o documento do ator (servidor do site, chave de serviço): a conta nova de quem já se mudou (movedTo). Nulo sem mudança. */
create or replace function public.rede_p4_ct_mudou_para(p_handle text) returns text language plpgsql stable security definer set search_path = interno, pg_temp as $$
begin
  perform interno.alumia_porta();
  if not interno.rede_p4_ct_ligado() then return null; end if;
  return (select m.alvo from rede_fed_atores a join rede_p4_ct_mudanca m on m.usuario = a.perfil
          where a.handle = lower(coalesce(p_handle, '')) and a.ligado and m.situacao = 'enviada');
end $$;

-- ── Permissões ────────────────────────────────────────────────────────────────────────────────────────────────────────────
do $$
declare f text;
begin
  for f in select p.oid::regprocedure::text from pg_proc p join pg_namespace n on n.oid = p.pronamespace
           where n.nspname = 'interno' and p.proname like 'rede_p4_ct_%' loop
    execute format('revoke all on function %s from public', f);
    if exists (select 1 from pg_roles where rolname = 'anon') then
      execute format('revoke all on function %s from anon, authenticated', f);
    end if;
  end loop;
  for f in select p.oid::regprocedure::text from pg_proc p join pg_namespace n on n.oid = p.pronamespace
           where n.nspname = 'public' and p.proname like 'rede_p4_ct_%' loop
    execute format('revoke all on function %s from public', f);
    if exists (select 1 from pg_roles where rolname = 'anon') then
      execute format('revoke all on function %s from anon', f);
      if f like '%rede_p4_ct_mudanca_enviar(%' or f like '%rede_p4_ct_mudou_para(%' then
        -- Só o servidor do site, com a chave de serviço.
        execute format('revoke all on function %s from authenticated', f);
        execute format('grant execute on function %s to service_role', f);
      else
        execute format('grant execute on function %s to authenticated, service_role', f);
      end if;
    end if;
  end loop;
end $$;

-- A faxina diária pelo pg_cron (da junção): a mediação que terminou há mais de 30 dias (e o convite sem resposta há mais de 14) e a
-- menção que espera a revisão há mais de 30 dias somem do banco mesmo que ninguém abra a tela (as faxinas de quando a tela abre
-- continuam). A rotina apaga direto nas tabelas (não passa pela porta da entrada, que é das chamadas de conta). Sem o pg_cron, só avisa.
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule('alumia-p4-conta-faxina', '43 3 * * *',
      'select interno.rede_p4_ct_med_faxina(); delete from interno.rede_p4_ct_mencoes where criado_em < now() - make_interval(days => 30)');
  end if;
exception when others then
  raise warning 'alumia-p4-conta-faxina: a rotina não foi agendada (%).', sqlerrm;
end $$;

select interno.alumia_trancar();
