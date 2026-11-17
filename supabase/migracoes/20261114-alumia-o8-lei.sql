-- Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
--
-- Alumia · Onda 8 · frente 8B (lei e ajuda): o que o banco precisa para os termos de uso, a política de privacidade, as regras
-- com o caminho do recurso, a proteção de menores e a denúncia de conteúdo ilegal com prazo. As páginas estão em
-- app/[lang]/alumia/{termos,privacidade,regras,ajuda,o-que-guardamos} e o texto em i18n/rede/lei; o que cada dado é, onde fica,
-- por quanto tempo e quem lê, em docs/rede/PRIVACIDADE.md.
--
--   1. Termos: a versão em vigor (com a data que a página mostra no alto) e o aceite de cada pessoa. O aceite do cadastro é o
--      consentimento que o pedido de entrada já grava (rede_consentimentos): um gatilho anota junto a versão dos termos. Quando a
--      versão muda, quem aceitou a anterior aceita de novo (alumia_termos_aceitar, a tela de reaceite).
--   2. Denúncia de conteúdo ilegal ("ilegal") e prazo de resposta em toda denúncia (responder_ate), visível para a mediação.
--   3. Proteção de menores (ECA Digital, troca registrada no backlog): sem documento e sem biometria. A denúncia de que uma conta
--      pode ser de menor de 18 anos RETÉM a conta por precaução até a mediação ver (prazo de 24 h). Contra o uso da denúncia como
--      arma: só membro retém, no máximo duas retenções por quem denuncia a cada 30 dias, nunca sobre quem é da equipe, e quem a
--      mediação já liberou não é retido de novo por 90 dias (a denúncia continua entrando na fila, com prioridade 1).
--   4. Recurso de conta: quem teve a conta suspensa (pelo painel) ou retida por precaução pede revisão mesmo sem passar pela
--      porta da Alumia (as duas funções entram na lista de exceções); outra pessoa da mediação decide; todo recurso tem prazo de
--      resposta (7 dias). Revertido, a conta volta (o que a coordenação decidiu, só a coordenação desfaz).
--   5. O painel da lei para a mediação: contadores (ilegais abertas, vencendo, vencidas; contas retidas; recursos e prazos) e as
--      três listas. A tela é components/rede/lei/PainelDaLei.tsx; quem junta a pendura no painel de controle.
--
-- Nenhum endereço de rede é guardado. Nada aqui devolve lista de quem denunciou, de quem aceitou ou de quem recorreu: cada pessoa
-- vê só o que é dela, e a mediação vê a fila (sem quem denunciou), como já era.
-- Pode rodar mais de uma vez, sem apagar dado nenhum. Roda depois de 20261113-alumia-onda7-fim.sql.
-- Teste: scripts/testar-alumia-o8-lei.mjs.

-- ── 1. Termos de uso e política de privacidade: versão e aceite ────────────────────────────────────────────────────────────

create table if not exists interno.alumia_termos (
  versao smallint primary key check (versao > 0),
  -- A data que as páginas mostram no alto ("versão de 14 de novembro de 2026"). Igual à de components/rede/lei/versao.ts.
  publicada_em date not null,
  -- O que mudou desde a versão anterior, em uma ou duas frases (a tela de reaceite mostra).
  mudou text not null default '' check (char_length(mudou) <= 500),
  criado_em timestamptz not null default now()
);
alter table interno.alumia_termos enable row level security;
revoke all on table interno.alumia_termos from public;

insert into interno.alumia_termos (versao, publicada_em, mudou) values (1, date '2026-11-14', '') on conflict (versao) do nothing;

create table if not exists interno.alumia_termos_aceites (
  usuario uuid not null references interno.perfis (id) on delete cascade,
  versao smallint not null references interno.alumia_termos (versao),
  aceito_em timestamptz not null default now(),
  como text not null check (como in ('cadastro', 'reaceite')),
  primary key (usuario, versao)
);
alter table interno.alumia_termos_aceites enable row level security;
revoke all on table interno.alumia_termos_aceites from public;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on table interno.alumia_termos, interno.alumia_termos_aceites from anon, authenticated;
  end if;
end $$;

/** A versão dos termos em vigor (a maior publicada). */
create or replace function interno.alumia_termos_vigente() returns smallint language sql stable security definer set search_path = interno, pg_temp as $$
  select coalesce(max(versao), 1)::smallint from alumia_termos
$$;

/**
 * O aceite do cadastro: o pedido de entrada (alumia_entrada_pedir → rede_aderir) só grava o consentimento depois da caixa
 * "li e aceito" marcada, e a caixa leva às páginas de regras e de privacidade. Este gatilho anota junto a versão dos termos em
 * vigor naquele instante. Nunca barra o consentimento: se a anotação falhar, o consentimento entra mesmo assim.
 */
create or replace function interno.alumia_termos_do_consentimento() returns trigger language plpgsql security definer set search_path = interno, pg_temp as $$
begin
  begin
    insert into alumia_termos_aceites (usuario, versao, como) values (new.usuario, interno.alumia_termos_vigente(), 'cadastro')
    on conflict (usuario, versao) do nothing;
  exception when others then
    null;
  end;
  return new;
end $$;
drop trigger if exists alumia_termos_do_consentimento on interno.rede_consentimentos;
create trigger alumia_termos_do_consentimento after insert on interno.rede_consentimentos for each row execute function interno.alumia_termos_do_consentimento();

/**
 * Os termos para quem chama: a versão em vigor, a data, o que mudou e se esta pessoa já aceitou ESTA versão. Sem sessão, só a
 * versão (as páginas mostram a data mesmo assim).
 */
create or replace function public.alumia_termos_eu() returns jsonb language plpgsql stable security definer set search_path = interno, pg_temp as $$
declare v uuid := auth.uid(); t alumia_termos; a alumia_termos_aceites;
begin
  select * into t from alumia_termos where versao = interno.alumia_termos_vigente();
  if v is null then
    return jsonb_build_object('logado', false, 'vigente', t.versao, 'publicada_em', t.publicada_em, 'mudou', t.mudou);
  end if;
  select * into a from alumia_termos_aceites where usuario = v and versao = t.versao;
  return jsonb_build_object('logado', true, 'vigente', t.versao, 'publicada_em', t.publicada_em, 'mudou', t.mudou,
    'aceita', a.usuario is not null, 'aceita_em', a.aceito_em,
    -- Aceitou alguma versão antes? A tela diz "os termos mudaram" (e mostra o que mudou) em vez de "leia os termos".
    'anterior', exists (select 1 from alumia_termos_aceites x where x.usuario = v and x.versao < t.versao));
end $$;

/**
 * Aceitar a versão em vigor (a tela de reaceite). Só a versão em vigor (quem tem a página antiga aberta recebe "invalido:versao"
 * e lê de novo) e só quem já declarou ter 18 anos ou mais na entrada.
 */
create or replace function public.alumia_termos_aceitar(p_versao integer) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); v_vigente smallint := interno.alumia_termos_vigente();
begin
  perform interno.limite('alumia_termos_aceitar', 20, 60);
  if p_versao is distinct from v_vigente then perform interno.erro('invalido:versao'); end if;
  if not coalesce((select f.rede_18 from perfis f where f.id = v), false) then perform interno.erro('idade_minima'); end if;
  insert into alumia_termos_aceites (usuario, versao, como) values (v, v_vigente, 'reaceite') on conflict (usuario, versao) do nothing;
  perform interno.registrar('alumia_termos_aceitar', '', jsonb_build_object('versao', v_vigente));
  return public.alumia_termos_eu();
end $$;

-- ── 2. Denúncia de conteúdo ilegal e prazo de resposta ─────────────────────────────────────────────────────────────────────

-- A categoria nova. O laço derruba só o check da LISTA de categorias (o Postgres guarda "categoria in (...)" como
-- "categoria = ANY (ARRAY[...])") e põe a lista de novo, com "ilegal".
do $$
declare r record;
begin
  for r in select conname from pg_constraint where conrelid = 'interno.rede_denuncias'::regclass and contype = 'c'
             and pg_get_constraintdef(oid) ~* '\(\(?categoria = ANY|categoria IN \(' loop
    execute format('alter table interno.rede_denuncias drop constraint %I', r.conname);
  end loop;
  alter table interno.rede_denuncias add constraint rede_denuncias_categoria_o8 check (categoria in (
    'menores', 'ameaca', 'exposicao', 'violencia', 'autolesao', 'odio', 'assedio', 'golpe', 'spam', 'outro', 'ilegal'));
end $$;

/** A prioridade da fila: conteúdo ilegal entra junto com menores, ameaça, exposição, violência e autolesão (1). */
create or replace function interno.rede2_prioridade(p_categoria text) returns smallint language sql immutable as $$
  select case when p_categoria in ('menores', 'ameaca', 'exposicao', 'violencia', 'autolesao', 'ilegal') then 1
              when p_categoria in ('odio', 'assedio', 'golpe') then 2 else 3 end::smallint
$$;

/**
 * O prazo de resposta de uma denúncia, pela categoria. Os mesmos números de components/rede/lei/versao.ts (PRAZOS) e da página
 * de regras: 24 horas para o que pode ferir alguém ou é crime, 3 dias para ódio, assédio e golpe, 7 dias para o resto.
 */
create or replace function interno.alumia_lei_prazo(p_categoria text) returns interval language sql immutable as $$
  select case when p_categoria in ('menores', 'ilegal', 'ameaca', 'exposicao', 'violencia', 'autolesao') then interval '24 hours'
              when p_categoria in ('odio', 'assedio', 'golpe') then interval '72 hours'
              else interval '7 days' end
$$;

alter table interno.rede_denuncias add column if not exists responder_ate timestamptz;
create index if not exists rede_denuncias_prazo on interno.rede_denuncias (responder_ate) where situacao in ('aberta', 'em_analise');
update interno.rede_denuncias set responder_ate = criado_em + interno.alumia_lei_prazo(categoria) where responder_ate is null;

create or replace function interno.alumia_lei_prazo_da_denuncia() returns trigger language plpgsql security definer set search_path = interno, pg_temp as $$
begin
  new.responder_ate := coalesce(new.criado_em, now()) + interno.alumia_lei_prazo(new.categoria);
  return new;
end $$;
drop trigger if exists alumia_lei_prazo_da_denuncia on interno.rede_denuncias;
create trigger alumia_lei_prazo_da_denuncia before insert on interno.rede_denuncias for each row execute function interno.alumia_lei_prazo_da_denuncia();

/** O motivo livre da página /denunciar numa categoria da fila; "ilegal", "crime" e "pirataria" viram conteúdo ilegal. */
create or replace function interno.rede3_mod_categoria(p_motivo text) returns text language sql immutable as $$
  select case
    when m ~ 'menor|crianc|adolescente|infantil' then 'menores'
    when m ~ 'amea' then 'ameaca'
    when m ~ 'exposi|dados pessoais|doxx|endereco' then 'exposicao'
    when m ~ 'violen|incita' then 'violencia'
    when m ~ 'suicid|autoles' then 'autolesao'
    when m ~ 'odio|racis|discrimin' then 'odio'
    when m ~ 'assedio|persegu' then 'assedio'
    when m ~ 'golpe|fraude' then 'golpe'
    when m ~ 'ilegal|crime|criminos|pirataria' then 'ilegal'
    when m ~ 'spam' then 'spam'
    else 'outro' end
  from (select interno.normal(coalesce(p_motivo, '')) as m) t
$$;

/**
 * Denunciar um post (id), um perfil (@handle) ou uma comunidade (slug). O mesmo de 2026-11-rede-moderacao.sql, com a categoria
 * "ilegal" e o prazo de resposta na volta. Quem denuncia nunca é revelado: a moderação não vê quem foi, e o alvo muito menos. Só
 * se denuncia o que se pode ver. Mesma pessoa, mesmo alvo, denúncia ainda aberta: devolve o mesmo protocolo. Categorias de
 * prioridade 1 entram na frente da fila e avisam a coordenação e a mediação; para menores e exposição de dados o post fica retido
 * por precaução até a leitura (reversível; o autor é avisado e pode recorrer). Esse freio tem teto por conta. A denúncia de menor
 * também retém a CONTA (gatilho alumia_lei_reter_menor, abaixo), com as travas contra abuso escritas lá.
 */
create or replace function public.rede_mod_denunciar(p_alvo_tipo text, p_alvo text, p_categoria text, p_texto text default '') returns jsonb
language plpgsql security definer set search_path = interno, pg_temp as $$
declare
  v uuid := interno.eu(); x rede_posts; f perfis; c rede_comunidades; v_alvo text; d rede_denuncias; v_pri smallint; v_retido boolean := false;
  v_texto text := interno.txt(coalesce(p_texto, ''), 'texto', 0, 2000);
begin
  perform interno.aberta('comunidade');
  if p_categoria is null or p_categoria not in ('menores', 'ameaca', 'exposicao', 'violencia', 'autolesao', 'odio', 'assedio', 'golpe', 'spam', 'outro', 'ilegal') then perform interno.erro('invalido:categoria'); end if;
  if p_alvo_tipo = 'post' then
    begin select * into x from rede_posts where id = p_alvo::uuid; exception when others then perform interno.erro('invalido:alvo'); end;
    if not found or not interno.rede_ve(x, v) then perform interno.erro('nao_encontrado'); end if;
    if x.autor = v then perform interno.erro('sem_permissao'); end if;
    v_alvo := x.id::text;
  elsif p_alvo_tipo = 'perfil' then
    select * into f from perfis where rede_handle = lower(btrim(coalesce(p_alvo, ''), ' @'));
    if not found or (f.id <> v and (f.rede_modo = 'invisivel' or f.rede_invisivel or interno.rede_bloqueado(v, f.id))) then perform interno.erro('nao_encontrado'); end if;
    if f.id = v then perform interno.erro('sem_permissao'); end if;
    v_alvo := f.id::text;
  elsif p_alvo_tipo = 'comunidade' then
    select * into c from rede_comunidades where slug = coalesce(p_alvo, '') or coalesce(p_alvo, '') = any (apelidos) order by (slug = coalesce(p_alvo, '')) desc limit 1;
    if not found or (c.tipo = 'fechada' and not interno.rede2_na_comunidade(c.slug, v)) then perform interno.erro('nao_encontrado'); end if;
    v_alvo := c.slug;
  else
    perform interno.erro('invalido:alvo_tipo');
  end if;

  select * into d from rede_denuncias where quem = v and alvo_tipo = p_alvo_tipo and alvo = v_alvo and situacao in ('aberta', 'em_analise') limit 1;
  if found then return jsonb_build_object('protocolo', d.protocolo, 'prioridade', d.prioridade, 'retido', false, 'ja', true, 'responder_ate', d.responder_ate); end if;

  perform interno.rede2_limite('denunciar');
  v_pri := interno.rede2_prioridade(p_categoria);
  insert into rede_denuncias (alvo_tipo, alvo, categoria, prioridade, texto, quem) values (p_alvo_tipo, v_alvo, p_categoria, v_pri, v_texto, v) returning * into d;

  if p_alvo_tipo = 'post' and p_categoria in ('menores', 'exposicao') and not (x.oculto or x.retido) then
    begin
      perform interno.limite('rede3_precaucao', 5, 1440);
      update rede_posts set retido = true, oculto = true, motivo = 'aguardando_analise_de_denuncia' where id = x.id;
      perform interno.rede3_mod_registrar('reter', 'post', x.id::text, 'precaucao', 'Retido por precaução até a moderação ler a denúncia (protocolo da denúncia: ' || d.protocolo || ').', d.id, true);
      perform interno.rede3_mod_avisar_afetado(x.autor, 'Um post seu ficou retido por precaução enquanto a moderação lê uma denúncia (decisão automática, ainda sem leitura de uma pessoa). Só você o vê. Você pode recorrer em até 30 dias, em Denúncias e recursos.');
      v_retido := true;
    exception when others then
      v_retido := false;
    end;
  end if;

  if v_pri = 1 then
    insert into avisos (para, texto)
    select distinct p.usuario, left('Denúncia prioritária ' || d.protocolo || ' (' || p_categoria || '). Abra a fila de moderação da Rede.', 500) from papeis p where p.papel in ('coordenacao', 'vice', 'mediacao') and p.usuario <> v;
  end if;
  return jsonb_build_object('protocolo', d.protocolo, 'prioridade', d.prioridade, 'retido', v_retido, 'ja', false, 'responder_ate', d.responder_ate);
end $$;

/** Uma denúncia como a fila mostra: sem quem denunciou, sem trecho de conteúdo de núcleo, e com o prazo de resposta. */
create or replace function interno.rede3_mod_item(d interno.rede_denuncias) returns jsonb language plpgsql stable security definer set search_path = interno, pg_temp as $$
declare x rede_posts; v_trecho text; v_nucleo boolean := false; v_com text; v_titulo text;
begin
  if d.alvo_tipo = 'post' then
    select * into x from rede_posts where id::text = d.alvo;
    if found then
      v_nucleo := x.nucleo is not null; v_com := x.comunidade; v_titulo := x.titulo;
      if not v_nucleo then v_trecho := left(x.texto, 200); end if;
    end if;
  elsif d.alvo_tipo = 'comunidade' then
    v_com := d.alvo;
  end if;
  return jsonb_build_object(
    'id', d.id, 'protocolo', d.protocolo, 'alvo_tipo', d.alvo_tipo, 'alvo', d.alvo, 'categoria', d.categoria, 'prioridade', d.prioridade,
    'situacao', d.situacao, 'criado_em', d.criado_em, 'texto', d.texto, 'comunidade', v_com, 'titulo', v_titulo, 'trecho', v_trecho, 'nucleo', v_nucleo,
    'mesmas', (select count(*)::integer from rede_denuncias o where o.alvo_tipo = d.alvo_tipo and o.alvo = d.alvo),
    'responder_ate', d.responder_ate,
    'vencida', d.situacao in ('aberta', 'em_analise') and d.responder_ate is not null and d.responder_ate < now());
end $$;

-- ── 3. Proteção de menores: a conta fica retida por precaução até a mediação ver ──────────────────────────────────────────

create table if not exists interno.alumia_lei_retencoes (
  id uuid primary key default gen_random_uuid(),
  usuario uuid not null references interno.perfis (id) on delete cascade,
  denuncia uuid references interno.rede_denuncias (id) on delete set null,
  -- A sanção do painel que segura a conta (a mesma tabela das suspensões: o painel mostra e a coordenação pode desfazer).
  sancao uuid references interno.alumia_sancoes (id) on delete set null,
  criado_em timestamptz not null default now(),
  responder_ate timestamptz not null default now() + interval '24 hours',
  situacao text not null default 'retida' check (situacao in ('retida', 'liberada', 'mantida')),
  decidido_em timestamptz,
  decidido_por uuid references interno.perfis (id) on delete set null
);
create unique index if not exists alumia_lei_retencoes_uma on interno.alumia_lei_retencoes (usuario) where situacao = 'retida';
create index if not exists alumia_lei_retencoes_conta on interno.alumia_lei_retencoes (usuario, decidido_em desc);
alter table interno.alumia_lei_retencoes enable row level security;
revoke all on table interno.alumia_lei_retencoes from public;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on table interno.alumia_lei_retencoes from anon, authenticated;
  end if;
end $$;

/** A conta por trás do alvo de uma denúncia: o perfil, ou quem escreveu o post ou o story. Outros alvos: nenhuma. */
create or replace function interno.alumia_lei_conta_do_alvo(p_tipo text, p_alvo text) returns uuid language plpgsql stable security definer set search_path = interno, pg_temp as $$
declare v uuid;
begin
  if p_alvo !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then return null; end if;
  if p_tipo = 'perfil' then
    select f.id into v from perfis f where f.id = p_alvo::uuid;
  elsif p_tipo = 'post' then
    select p.autor into v from rede_posts p where p.id = p_alvo::uuid;
  elsif p_tipo = 'story' then
    select s.autor into v from rede_stories s where s.id = p_alvo::uuid;
  end if;
  return v;
end $$;

/**
 * A denúncia de menor (categoria "menores") retém a conta por precaução: a conta fica suspensa (sanção do painel, sem pessoa
 * que decidiu) até a mediação ler, com prazo de 24 horas na fila. As travas contra abuso do canal (ECA Digital, art. 33):
 *   · quem denuncia tem de ser membro da Alumia (visitante e denúncia automática não retêm conta);
 *   · cada pessoa retém no máximo duas contas a cada 30 dias por este caminho;
 *   · nunca sobre quem é da equipe, nem sobre conta já suspensa, nem sobre quem a mediação liberou nos últimos 90 dias.
 * Fora das travas, a denúncia entra na fila igual, com prioridade 1. Nada aqui barra a denúncia: se reter falhar, ela entra.
 */
create or replace function interno.alumia_lei_reter_menor() returns trigger language plpgsql security definer set search_path = interno, pg_temp as $$
declare v_conta uuid; v_sancao uuid;
begin
  begin
    if new.categoria <> 'menores' or new.quem is null then return new; end if;
    v_conta := interno.alumia_lei_conta_do_alvo(new.alvo_tipo, new.alvo);
    if v_conta is null or v_conta = new.quem then return new; end if;
    if not interno.rede2_membro(new.quem) then return new; end if;
    if interno.voluntario_e(v_conta) then return new; end if;
    if exists (select 1 from perfis f where f.id = v_conta and f.suspenso) then return new; end if;
    if exists (select 1 from alumia_lei_retencoes r where r.usuario = v_conta and (r.situacao = 'retida' or (r.situacao = 'liberada' and r.decidido_em > now() - interval '90 days'))) then
      return new;
    end if;
    if (select count(*) from alumia_lei_retencoes r join rede_denuncias d on d.id = r.denuncia
        where d.quem = new.quem and r.criado_em > now() - interval '30 days') >= 2 then
      return new;
    end if;
    insert into alumia_sancoes (usuario, tipo, motivo, por, ate, ja_suspensa)
    values (v_conta, 'suspensao', 'Retida por precaução: denúncia de que a conta pode ser de menor de 18 anos (protocolo ' || new.protocolo || '). A mediação vai ler.',
            null, now() + interval '365 days', false)
    returning id into v_sancao;
    update perfis set suspenso = true, suspensao = case when suspensao <> '' then suspensao else 'sistema' end where id = v_conta;
    insert into alumia_lei_retencoes (usuario, denuncia, sancao) values (v_conta, new.id, v_sancao);
    perform interno.rede3_mod_registrar('reter', 'perfil', v_conta::text, 'precaucao_menor',
      'Conta retida por precaução até a mediação ler a denúncia (protocolo da denúncia: ' || new.protocolo || ').', new.id, true);
    perform interno.avisar_em(v_conta, 'Sua conta na Alumia ficou retida por precaução: chegou uma denúncia de que ela pode ser de alguém com menos de 18 anos. Decisão automática, ainda sem leitura de uma pessoa. A mediação lê em até 24 horas. Você pode escrever à mediação agora, em Regras da Alumia, no pedido de revisão.', 'conta');
  exception when others then
    raise warning 'alumia_lei_reter_menor: %', sqlerrm;
  end;
  return new;
end $$;
drop trigger if exists alumia_lei_reter_menor on interno.rede_denuncias;
create trigger alumia_lei_reter_menor after insert on interno.rede_denuncias for each row execute function interno.alumia_lei_reter_menor();

/**
 * A mediação decide uma conta retida: "liberar" (a denúncia não se confirma: a conta volta e a denúncia é descartada) ou
 * "manter" (a conta continua suspensa, agora por decisão de uma pessoa, com a regra "menor_de_18" e o recurso de 30 dias).
 * Sempre com o motivo. Quem fez a denúncia não decide.
 */
create or replace function public.alumia_lei_menor_decidir(p_retencao uuid, p_decisao text, p_motivo text) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); r alumia_lei_retencoes; d rede_denuncias; v_motivo text := interno.txt(p_motivo, 'motivo', 10, 500); v_ja boolean;
begin
  if not interno.cuida() then perform interno.erro('sem_permissao'); end if;
  if p_decisao is null or p_decisao not in ('liberar', 'manter') then perform interno.erro('invalido:decisao'); end if;
  perform interno.limite('alumia_lei_decidir', 120, 60);
  select * into r from alumia_lei_retencoes where id = p_retencao for update;
  if not found or r.situacao <> 'retida' then perform interno.erro('nao_encontrado'); end if;
  select * into d from rede_denuncias where id = r.denuncia;
  if d.quem is not distinct from v then perform interno.erro('outra_pessoa'); end if;
  if r.usuario = v then perform interno.erro('sem_permissao'); end if;
  if p_decisao = 'liberar' then
    update alumia_lei_retencoes set situacao = 'liberada', decidido_em = now(), decidido_por = v where id = r.id;
    select s.ja_suspensa into v_ja from alumia_sancoes s where s.id = r.sancao;
    update alumia_sancoes set encerrada_em = now(), encerrada_por = v where id = r.sancao and encerrada_em is null;
    perform interno.alumia_painel_soltar(r.usuario, coalesce(v_ja, false));
    perform interno.rede3_mod_registrar('restaurar', 'perfil', r.usuario::text, 'precaucao_menor', v_motivo, r.denuncia);
    if d.id is not null and d.situacao in ('aberta', 'em_analise') then
      update rede_denuncias set situacao = 'descartada', cuida = v where id = d.id;
      perform interno.avisar_em(d.quem, 'Sua denúncia ' || d.protocolo || ' foi analisada: a mediação não confirmou o que foi denunciado. Obrigada por cuidar da Rede.', 'rede');
    end if;
    perform interno.avisar_em(r.usuario, 'A mediação leu a denúncia e liberou a sua conta na Alumia. ' || v_motivo, 'conta');
  else
    update alumia_lei_retencoes set situacao = 'mantida', decidido_em = now(), decidido_por = v where id = r.id;
    perform interno.rede3_mod_registrar('suspender', 'perfil', r.usuario::text, 'menor_de_18', v_motivo, r.denuncia);
    -- A sanção ganha o mesmo instante da decisão: é por ele que o recurso revertido acha o que soltar.
    update alumia_sancoes set criado_em = now(), por = v, motivo = left('A mediação manteve a conta suspensa (menor de 18 anos): ' || v_motivo, 500) where id = r.sancao and encerrada_em is null;
    if d.id is not null and d.situacao in ('aberta', 'em_analise') then
      update rede_denuncias set situacao = 'resolvida', cuida = v where id = d.id;
      perform interno.avisar_em(d.quem, 'Sua denúncia ' || d.protocolo || ' foi analisada e a Rede tomou providências. Obrigada por cuidar da Rede.', 'rede');
    end if;
    perform interno.avisar_em(r.usuario, 'A mediação leu a denúncia e manteve a sua conta suspensa: a Alumia é só para quem tem 18 anos ou mais. Você pode pedir revisão em até 30 dias, em Regras da Alumia. ' || v_motivo, 'conta');
  end if;
  return jsonb_build_object('situacao', case p_decisao when 'liberar' then 'liberada' else 'mantida' end);
end $$;

-- ── 4. Recurso de conta e prazo de resposta de todo recurso ───────────────────────────────────────────────────────────────

/** O prazo de resposta de um recurso: 7 dias (o mesmo de components/rede/lei/versao.ts e da página de regras). */
create or replace function interno.alumia_lei_prazo_recurso() returns interval language sql immutable as $$ select interval '7 days' $$;

alter table interno.rede_recursos add column if not exists responder_ate timestamptz;
update interno.rede_recursos set responder_ate = criado_em + interno.alumia_lei_prazo_recurso() where responder_ate is null;

create or replace function interno.alumia_lei_prazo_do_recurso() returns trigger language plpgsql security definer set search_path = interno, pg_temp as $$
begin
  new.responder_ate := coalesce(new.criado_em, now()) + interno.alumia_lei_prazo_recurso();
  return new;
end $$;
drop trigger if exists alumia_lei_prazo_do_recurso on interno.rede_recursos;
create trigger alumia_lei_prazo_do_recurso before insert on interno.rede_recursos for each row execute function interno.alumia_lei_prazo_do_recurso();

/**
 * Recurso revertido sobre uma CONTA (suspensão do painel, retenção por precaução, suspensão mantida pela mediação): a conta volta.
 * A sanção que a decisão criou tem o mesmo instante dela (mesma transação). O que a coordenação decidiu, a mediação pode manter,
 * mas só a coordenação ou a vice-coordenação desfaz (a regra do painel; quem decidiu nunca revê o próprio caso): outra pessoa da
 * mediação recebe "so_coordenacao" e o recurso continua aberto.
 */
create or replace function interno.alumia_lei_recurso_revertido() returns trigger language plpgsql security definer set search_path = interno, pg_temp as $$
declare m rede_moderacao; s record; v_conta uuid;
begin
  if not (new.situacao = 'revertido' and old.situacao = 'aberto') then return new; end if;
  select * into m from rede_moderacao where id = new.acao;
  if not found or m.alvo_tipo <> 'perfil' or m.acao not in ('suspender', 'reter') then return new; end if;
  begin v_conta := m.alvo::uuid; exception when others then return new; end;
  -- A sanção da decisão: a do mesmo instante (painel, retenção) ou, numa decisão que veio de uma denúncia de menor, a sanção da
  -- retenção daquela denúncia (que ganha o instante de "manter" e não o da retenção automática).
  for s in select * from alumia_sancoes x where x.usuario = v_conta and x.encerrada_em is null and x.tipo in ('suspensao', 'banimento')
             and (x.criado_em = m.criado_em
                  or (m.denuncia is not null and x.id in (select r.sancao from alumia_lei_retencoes r where r.usuario = v_conta and r.denuncia = m.denuncia))) loop
    if interno.alumia_painel_decidiu_a_coordenacao(s.por) and not exists (select 1 from papeis pa where pa.usuario = new.revisou and pa.papel in ('coordenacao', 'vice')) then
      perform interno.erro('so_coordenacao');
    end if;
    update alumia_sancoes set encerrada_em = now(), encerrada_por = new.revisou where id = s.id;
    perform interno.alumia_painel_soltar(v_conta, s.ja_suspensa);
  end loop;
  if m.denuncia is not null then
    update alumia_lei_retencoes set situacao = 'liberada', decidido_em = now(), decidido_por = new.revisou
    where usuario = v_conta and denuncia = m.denuncia and situacao in ('retida', 'mantida');
  end if;
  return new;
end $$;
drop trigger if exists alumia_lei_recurso_revertido on interno.rede_recursos;
create trigger alumia_lei_recurso_revertido after update on interno.rede_recursos for each row execute function interno.alumia_lei_recurso_revertido();

/**
 * A situação da MINHA conta, para quem está suspensa ou retida (fica fora da porta da Alumia: sem isso, quem foi suspensa não
 * teria como pedir revisão). Só o que é desta pessoa: se está suspensa, se está retida por precaução (com o prazo da mediação) e
 * as decisões sobre a conta nos últimos 180 dias, com o prazo do recurso e o andamento. Nunca quem decidiu.
 */
create or replace function public.alumia_lei_minha_conta() returns jsonb language plpgsql stable security definer set search_path = interno, pg_temp as $$
declare v uuid := auth.uid(); r alumia_lei_retencoes;
begin
  if v is null then return jsonb_build_object('logado', false); end if;
  select * into r from alumia_lei_retencoes where usuario = v and situacao = 'retida' order by criado_em desc limit 1;
  return jsonb_build_object(
    'logado', true,
    'suspensa', coalesce((select f.suspenso from perfis f where f.id = v), false),
    'retida', case when r.id is null then null else jsonb_build_object('desde', r.criado_em, 'responder_ate', r.responder_ate) end,
    'decisoes', coalesce((select jsonb_agg(jsonb_build_object(
        'id', m.id, 'acao', m.acao, 'regra', m.regra, 'motivo', m.motivo, 'criado_em', m.criado_em,
        'automatica', m.quem is null,
        'prazo', m.criado_em + interval '30 days',
        'pode_recorrer', now() <= m.criado_em + interval '30 days' and not exists (select 1 from rede_recursos x where x.acao = m.id),
        'recurso', (select jsonb_build_object('situacao', x.situacao, 'criado_em', x.criado_em, 'responder_ate', x.responder_ate, 'decidido_em', x.decidido_em)
                    from rede_recursos x where x.acao = m.id)) order by m.criado_em desc)
      from rede_moderacao m
      where m.alvo_tipo = 'perfil' and m.alvo = v::text and m.acao in ('suspender', 'reter') and m.criado_em > now() - interval '180 days'), '[]'::jsonb));
end $$;

/**
 * Pedir revisão de uma decisão sobre a MINHA conta (suspensão ou retenção), em até 30 dias, uma vez por decisão. Fica fora da
 * porta pelo mesmo motivo da função acima. Vai para a fila de recursos, com prazo de resposta de 7 dias; outra pessoa da
 * mediação decide (o gatilho do banco barra quem decidiu).
 */
create or replace function public.alumia_lei_recorrer_conta(p_acao uuid, p_texto text) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := auth.uid(); m rede_moderacao; v_texto text; x rede_recursos;
begin
  if v is null then perform interno.erro('entre_primeiro'); end if;
  perform interno.limite('alumia_lei_recorrer', 6, 60);
  v_texto := interno.txt(p_texto, 'texto', 10, 2000);
  select * into m from rede_moderacao where id = p_acao;
  if not found or m.alvo_tipo <> 'perfil' or m.alvo <> v::text or m.acao not in ('suspender', 'reter') then perform interno.erro('nao_encontrado'); end if;
  if now() > m.criado_em + interval '30 days' then perform interno.erro('prazo_vencido'); end if;
  if exists (select 1 from rede_recursos r where r.acao = m.id) then perform interno.erro('recurso_ja_feito'); end if;
  insert into rede_recursos (acao, autor, texto) values (m.id, v, v_texto) returning * into x;
  insert into avisos (para, texto)
  select distinct p.usuario, 'Há um pedido de revisão de conta na fila de recursos da Alumia (prazo de 7 dias).' from papeis p
  where p.papel in ('coordenacao', 'vice', 'mediacao') and p.usuario is distinct from m.quem and p.usuario <> v;
  return jsonb_build_object('ok', true, 'responder_ate', x.responder_ate);
end $$;

-- ── 5. O painel da lei (mediação): contadores e listas ────────────────────────────────────────────────────────────────────

/**
 * O que a mediação precisa ver primeiro, com os prazos: as denúncias de conteúdo ilegal abertas (e quantas vencem nas próximas
 * 6 horas e quantas já venceram), todas as denúncias com prazo vencido, as contas retidas por precaução e os recursos abertos.
 * Só para quem cuida (equipe que modera). As listas não dizem quem denunciou nem quem recorreu.
 */
create or replace function public.alumia_lei_painel() returns jsonb language plpgsql stable security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu();
begin
  if not interno.cuida() then perform interno.erro('sem_permissao'); end if;
  return jsonb_build_object(
    'contadores', jsonb_build_object(
      'ilegais', (select count(*) from rede_denuncias d where d.categoria = 'ilegal' and d.situacao in ('aberta', 'em_analise')),
      'ilegais_vencendo', (select count(*) from rede_denuncias d where d.categoria = 'ilegal' and d.situacao in ('aberta', 'em_analise')
                             and d.responder_ate >= now() and d.responder_ate < now() + interval '6 hours'),
      'ilegais_vencidas', (select count(*) from rede_denuncias d where d.categoria = 'ilegal' and d.situacao in ('aberta', 'em_analise') and d.responder_ate < now()),
      'denuncias_vencidas', (select count(*) from rede_denuncias d where d.situacao in ('aberta', 'em_analise') and d.responder_ate < now()),
      'retidas', (select count(*) from alumia_lei_retencoes r where r.situacao = 'retida'),
      'retidas_vencidas', (select count(*) from alumia_lei_retencoes r where r.situacao = 'retida' and r.responder_ate < now()),
      'recursos', (select count(*) from rede_recursos x where x.situacao = 'aberto'),
      'recursos_vencidos', (select count(*) from rede_recursos x where x.situacao = 'aberto' and x.responder_ate < now())),
    'ilegais', coalesce((select jsonb_agg(interno.rede3_mod_item(d) order by d.responder_ate)
      from (select * from rede_denuncias q where q.categoria = 'ilegal' and q.situacao in ('aberta', 'em_analise') order by q.responder_ate limit 100) d), '[]'::jsonb),
    'retidas', coalesce((select jsonb_agg(jsonb_build_object(
        'id', r.id, 'conta', interno.rede_nome(r.usuario), 'desde', r.criado_em, 'responder_ate', r.responder_ate, 'vencida', r.responder_ate < now(),
        'protocolo', d.protocolo, 'denuncia', d.id, 'texto', d.texto, 'pode', d.quem is distinct from v) order by r.responder_ate)
      from alumia_lei_retencoes r left join rede_denuncias d on d.id = r.denuncia where r.situacao = 'retida'), '[]'::jsonb),
    'recursos', coalesce((select jsonb_agg(jsonb_build_object(
        'id', x.id, 'texto', x.texto, 'criado_em', x.criado_em, 'responder_ate', x.responder_ate, 'vencido', x.responder_ate < now(),
        'acao', jsonb_build_object('acao', m.acao, 'alvo_tipo', m.alvo_tipo, 'regra', m.regra, 'motivo', m.motivo, 'criado_em', m.criado_em, 'automatica', m.quem is null),
        'conta', case when m.alvo_tipo = 'perfil' then interno.rede_nome(m.alvo::uuid) end,
        'trecho', case when m.alvo_tipo = 'post' then (select left(p.texto, 200) from rede_posts p where p.id::text = m.alvo and p.nucleo is null) end,
        'minha', m.quem is not distinct from v) order by x.responder_ate)
      from rede_recursos x join rede_moderacao m on m.id = x.acao
      where x.situacao = 'aberto'
        and (case when m.alvo_tipo = 'post' then exists (select 1 from rede_posts p where p.id::text = m.alvo and interno.rede3_mod_pode_post(p, true))
                  else true end)), '[]'::jsonb));
end $$;

-- ── 6. A porta da Alumia: as duas funções de quem está suspensa ficam fora ────────────────────────────────────────────────

/**
 * As funções que ficam SEM a porta, de propósito. A lista de 20261113-alumia-o7-entrada.sql (igual à de 20261112-alumia-portas.sql
 * e de 20261113-alumia-o7-portas-fediverso.sql) mais as duas da conta suspensa ou retida (alumia_lei_minha_conta e
 * alumia_lei_recorrer_conta): sem elas, quem teve a conta suspensa não teria como pedir revisão. Rodar uma das três migrações
 * antigas depois desta volta a trancar as duas: rode esta em seguida (ou ponha as duas nas listas de lá, ao juntar).
 */
create or replace function interno.alumia_porta_aberta(p_nome text, p_argumentos text) returns boolean language sql immutable as $$
  select p_nome in ('alumia_entrada_eu', 'alumia_entrada_pedir', 'alumia_triagem_contagem', 'alumia_triagem_fila', 'alumia_triagem_decidir',
                    'rede_situacao', 'rede_aderir', 'rede_codinome_definir', 'rede_confirmar_idade', 'rede_eu', 'rede_alumia_versao',
                    'rede_fed_situacao', 'rede_antigo',
                    -- Chamadas pelo servidor do site sem sessão, com o segredo da federação (Faixa 2): com a porta, o Fediverso para.
                    'rede_fed_servidor', 'rede_fed_midia_servidor', 'rede_fed_mudanca_servidor',
                    -- Quem teve a conta suspensa ou retida pede revisão (20261114-alumia-o8-lei.sql).
                    'alumia_lei_minha_conta', 'alumia_lei_recorrer_conta',
                    -- A marca "veio por convite" na triagem, que tem a regra dela (20261114-alumia-o8-porta.sql).
                    'alumia_triagem_convites')
      or (p_nome in ('rede_linha', 'rede_novos') and coalesce(p_argumentos, '') like 'p_aba text%')
      -- O diretório das organizações com selo e o mapa dele (20261113-alumia-o7-entrada.sql, decisão de 12/11).
      or (p_nome = 'rede_org_diretorio' and coalesce(p_argumentos, '') = 'p jsonb')
      or (p_nome = 'rede_org_mapa' and coalesce(p_argumentos, '') = '')
$$;

-- As duas nasceram agora, sem a porta; se uma versão anterior desta migração já tinha passado pela regra, a porta sai.
do $$
declare r record;
begin
  for r in
    select p.oid, p.prosrc
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.prokind = 'f' and p.proname in ('alumia_lei_minha_conta', 'alumia_lei_recorrer_conta')
      and position('perform interno.alumia_porta(); ' in p.prosrc) > 0
  loop
    execute replace(pg_get_functiondef(r.oid), r.prosrc, replace(r.prosrc, 'perform interno.alumia_porta(); ', ''));
  end loop;
end $$;

-- ── 7. Permissões ─────────────────────────────────────────────────────────────────────────────────────────────────────────
revoke all on function interno.alumia_termos_vigente(), interno.alumia_termos_do_consentimento(), interno.alumia_lei_prazo(text),
  interno.alumia_lei_prazo_da_denuncia(), interno.alumia_lei_conta_do_alvo(text, text), interno.alumia_lei_reter_menor(),
  interno.alumia_lei_prazo_recurso(), interno.alumia_lei_prazo_do_recurso(), interno.alumia_lei_recurso_revertido(),
  interno.alumia_porta_aberta(text, text) from public;
revoke all on function public.alumia_termos_eu(), public.alumia_termos_aceitar(integer), public.alumia_lei_menor_decidir(uuid, text, text),
  public.alumia_lei_minha_conta(), public.alumia_lei_recorrer_conta(uuid, text), public.alumia_lei_painel() from public;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on function interno.alumia_termos_vigente(), interno.alumia_termos_do_consentimento(), interno.alumia_lei_prazo(text),
      interno.alumia_lei_prazo_da_denuncia(), interno.alumia_lei_conta_do_alvo(text, text), interno.alumia_lei_reter_menor(),
      interno.alumia_lei_prazo_recurso(), interno.alumia_lei_prazo_do_recurso(), interno.alumia_lei_recurso_revertido(),
      interno.alumia_porta_aberta(text, text) from anon, authenticated;
    revoke all on function public.alumia_termos_eu(), public.alumia_termos_aceitar(integer), public.alumia_lei_menor_decidir(uuid, text, text),
      public.alumia_lei_minha_conta(), public.alumia_lei_recorrer_conta(uuid, text), public.alumia_lei_painel() from anon, authenticated;
    grant execute on function public.alumia_termos_eu(), public.alumia_lei_minha_conta() to anon, authenticated, service_role;
    grant execute on function public.alumia_termos_aceitar(integer), public.alumia_lei_menor_decidir(uuid, text, text),
      public.alumia_lei_recorrer_conta(uuid, text), public.alumia_lei_painel() to authenticated, service_role;
  end if;
end $$;

-- ── 8. A porta em todas as funções novas ──────────────────────────────────────────────────────────────────────────────────
do $$
declare v jsonb := interno.alumia_trancar();
begin
  if jsonb_array_length(v -> 'abertas') > 0 then
    raise warning 'alumia_trancar: função sem porta: %', v -> 'abertas';
  end if;
end $$;
