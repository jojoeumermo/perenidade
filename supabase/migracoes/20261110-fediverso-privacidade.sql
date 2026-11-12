-- Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
-- ───────────────────────────── Alumia no Fediverso: privacidade (o que sai, o que a tela recebe e a prova do consentimento) ─────────────────────────────
-- Migração acrescentável: pode rodar mais de uma vez, sem apagar dado nenhum. Roda DEPOIS de 20261109-fediverso-total.sql e de
-- 20261110-fediverso-bloqueio-padrao.sql. Teste: scripts/testar-fediverso-banco.mjs (seção "Privacidade").
-- Se um dia 2026-11-alumia.sql ou 20261109-fediverso-total.sql for rodado de novo sozinho, rode em seguida
-- 20261110-fediverso-bloqueio-padrao.sql e depois este arquivo: aqueles trazem as versões antigas das funções redefinidas aqui.
-- Este arquivo NÃO redefine public.rede_fed_bloquear nem interno.rede_fed_bloqueado (a dona é a migração do bloqueio padrão).
--
-- Regras da casa que este arquivo põe no banco: nenhuma lista de pessoas, contagem só a partir de 3, nada de IP.
--
-- O que este arquivo faz (as funções são as de 20261109-fediverso-total.sql, copiadas inteiras, mudando só o que está dito aqui):
--   1. Avisos de curtida e de impulso de fora sem dizer quem foi: interno.rede_fed_aviso_remoto não devolve ninguém nesses dois
--      tipos (ator_remoto nulo, atores_remotos vazio) e o endereço cru do avatar não sai em tipo nenhum. Em public.rede_aviso_listar,
--      o total e as pessoas desses dois tipos só saem a partir de 3; abaixo disso sai 1, que a tela lê como "alguém".
--      Seguidor, resposta e menção continuam dizendo quem foi (é a própria conversa com a pessoa).
--   2. Piso de 3 nas contagens que saem para outros servidores ou para a tela (abaixo de 3 sai 0; as coleções do ActivityPub
--      pedem totalItems inteiro, maior ou igual a zero): seguidores, seguindo_publico, comunidade.seguidores,
--      comunidade_seguidores, contagem.usuarios, contagem_ativos (NodeInfo), respostas do cartão e total de rede_fed_respostas_de.
--   3. A coleção de moderação do Group sai vazia: quem modera uma comunidade não é exposto para fora.
--   4. O nome do ator só sai quando o codinome passou pela conferência (rede_codinome_ok), como a bio; senão sai o @nome.
--   5. O cartão (interno.rede_fed_cartao) traz a relação de quem lê com quem escreveu: silenciado, bloqueado e bloqueou_voce.
--      public.rede_fed_perfil_remoto devolve bloqueou_voce: quem foi bloqueado lá fora vê só o cabeçalho do perfil, sem posts,
--      e a ação 'seguir' recusa o pedido. Só a própria pessoa recebe esses campos; nada disso sai para terceiros.
--   6. Nota de quem ninguém segue, impulsionada por alguém que alguém daqui segue, fica guardada (antes era recusada com
--      "sem_ligacao" e o impulso sumia na faxina). Só nota pública ou não listada; direta e só-seguidores continuam fora.
--   7. Prova do consentimento: interno.fediverso_consentimentos guarda cada vez que a federação de uma pessoa liga, desliga ou
--      muda de versão (perfil, versão, ligado, quando; nada de IP nem de navegador). Um gatilho em interno.rede_fed_atores grava,
--      então vale para todos os caminhos (perfil, consentimento de entrada, suspensão, conta apagada). Ligar ou desligar no
--      perfil (public.rede_fed_ligar) passa a refletir em rede_consentimentos.fediverso. LGPD art. 8º, § 2º (cabe a quem trata
--      provar o consentimento) e § 5º (revogação a qualquer momento). A linha some com a conta (como rede_consentimentos).
--   8. public.rede_fed_situacao devolve o endereço completo (endereco: "@nome@dominio") e o domínio da conta: o curto
--      ("alumia.exemplo.org" vira "exemplo.org") no modo total, o da Alumia sem ele; a mesma regra de lib/rede/fediverso/enderecos.ts.
--      public.rede_fed_perfil_remoto ganha página: a forma com três argumentos (ator, cursor, limite) devolve "proximo".
--   9. public.rede_fed_perfil_remoto, rede_fed_fio_remoto, rede_fed_bloquear_pessoa e rede_fed_silenciar_pessoa passam a conferir
--      a adesão (interno.rede2_membro: "consentimento") e o modo total ("fediverso_desligado"), como as outras RPCs da tela.
--
-- Fica para depois (docs/rede/PEDIDOS-ENTRE-FAIXAS.md, P12): guardar a mídia de fora no depósito daqui; e os "sotaques" por
-- software (Lemmy, Misskey, Pleroma).

-- ── 0. O Threads não entra, e sem interruptor ─────────────────────────────────────────────────────────────────────────────
-- Decisão do Instituto (12/11/2026): o Threads não federa com a Alumia e não há interruptor. Em produção, a versão de 10/11 de
-- 20261110-fediverso-bloqueio-padrao.sql criou public.rede_fed_threads; aqui ela some, a anotação "threads_liberado" também, e
-- os domínios do Threads ficam bloqueados e fixos (mesmo que alguém tenha usado o interruptor antes). Pode rodar de novo.
drop function if exists public.rede_fed_threads(boolean);
do $$
declare v_n integer;
begin
  update interno.configuracoes set valor = valor - 'threads_liberado' where chave = 'fediverso' and valor ? 'threads_liberado';
  insert into interno.rede_fed_bloqueados (dominio, motivo, por, fixo)
  select d, 'Threads (Meta): não federa com a Alumia, por decisão do Instituto. Sem interruptor.', null, true from unnest(interno.rede_fed_threads_dominios()) d
  on conflict (dominio) do nothing;
  get diagnostics v_n = row_count;
  update interno.rede_fed_bloqueados set fixo = true, motivo = 'Threads (Meta): não federa com a Alumia, por decisão do Instituto. Sem interruptor.'
   where dominio = any(interno.rede_fed_threads_dominios()) and (not fixo or motivo is distinct from 'Threads (Meta): não federa com a Alumia, por decisão do Instituto. Sem interruptor.');
  if v_n > 0 then perform interno.rede_fed_bloqueio_faxina(); end if;
end $$;

-- ── 1. Peças pequenas ─────────────────────────────────────────────────────────────────────────────────────────────────────

/** Contagem que sai para fora ou para a tela: só a partir de 3; abaixo disso (ou nula) vira 0. */
create or replace function interno.rede_fed_piso(p_n integer) returns integer language sql immutable as $$
  select case when coalesce(p_n, 0) >= 3 then p_n else 0 end
$$;

/** O total (ou as pessoas) de um grupo de avisos: em curtida e impulso de fora, abaixo de 3 sai 1 ("alguém"). O resto não muda. */
create or replace function interno.rede_fed_aviso_total(p_tipo text, p_n integer) returns integer language sql immutable as $$
  select case when p_tipo in ('fed_curtida', 'fed_impulso') and coalesce(p_n, 0) < 3 then 1 else p_n end
$$;

/**
 * O domínio do endereço da conta (@nome@dominio). No modo total é o curto ("alumia.exemplo.org" vira "exemplo.org", se sobrar um
 * nome com ponto); sem ele, o do servidor da Alumia. Nulo enquanto o endereço do servidor (url_entrega) não foi configurado.
 */
create or replace function interno.rede_fed_dominio_da_conta() returns text language sql stable security definer set search_path = interno, pg_temp as $$
  select case when interno.rede_fed_total() and x.h ~ '^alumia\.' and substr(x.h, 8) ~ '\.' then substr(x.h, 8) else x.h end
  -- Sem o ponto final ("exemplo.org." é o mesmo nome, mas o endereço da conta sairia com ele).
  from (select nullif(rtrim(interno.rede_fed_host_local(), '.'), '') as h) x
$$;

-- ── 2. Avisos sem lista de pessoas ────────────────────────────────────────────────────────────────────────────────────────

/**
 * Quem de fora aparece num grupo de avisos (até 2, do mais novo) e a nota de fora mais recente dele. Nulo quando ninguém é de fora.
 * Curtida e impulso NUNCA dizem quem foi: nesses dois tipos a função não devolve ninguém. O endereço do avatar não sai em tipo
 * nenhum (a tela desenha o rosto pelo @, nunca pela foto de outro servidor).
 */
create or replace function interno.rede_fed_aviso_remoto(p_ids uuid[]) returns jsonb language sql stable security definer set search_path = interno, pg_temp as $$
  with u as (
    select a.ator_remoto, a.objeto_remoto, a.criado_em from avisos a
    where a.id = any (coalesce(p_ids, '{}')) and a.ator_remoto is not null and coalesce(a.tipo, '') not in ('fed_curtida', 'fed_impulso')
  ), d as (
    select u.ator_remoto, max(u.criado_em) as em from u group by u.ator_remoto order by max(u.criado_em) desc limit 2
  )
  select case when not exists (select 1 from u) then null else jsonb_build_object(
    'atores', (select jsonb_agg(jsonb_build_object('ator', d.ator_remoto, 'handle', r.handle, 'nome', r.nome,
                                                   'servidor', interno.rede_fed_dominio(d.ator_remoto)) order by d.em desc)
               from d left join rede_fed_remotos r on r.ator = d.ator_remoto),
    'objeto', (select u.objeto_remoto from u where u.objeto_remoto is not null order by u.criado_em desc limit 1)) end
$$;

-- rede_aviso_listar é do pacote de avisos: aqui ela é remendada no lugar (como em 20261109-fediverso-total.sql), só no total e nas
-- pessoas. Quem recriar a função precisa rodar este arquivo de novo; o teste do banco do Fediverso confere que o remendo está lá.
do $$
declare
  v_def text;
  v_marca text := '''total'', n.total, ''pessoas'', n.pessoas,';
begin
  v_def := pg_get_functiondef('public.rede_aviso_listar(text, integer)'::regprocedure);
  if position('rede_fed_aviso_total' in v_def) > 0 then return; end if;
  if position(v_marca in v_def) = 0 then
    raise exception 'public.rede_aviso_listar mudou: o remendo do Fediverso (20261110-fediverso-privacidade.sql) precisa ser revisto';
  end if;
  v_def := replace(v_def, v_marca,
    '''total'', interno.rede_fed_aviso_total(n.tipo, n.total), ''pessoas'', interno.rede_fed_aviso_total(n.tipo, n.pessoas),');
  execute v_def;
end $$;

-- ── 3. A prova do consentimento ───────────────────────────────────────────────────────────────────────────────────────────

-- Cada vez que a federação de uma pessoa liga, desliga ou muda de versão do consentimento. Só o mínimo: quem, qual versão do
-- texto, ligou ou desligou, e quando. Nada de IP, de navegador ou de por qual tela foi.
create table if not exists interno.fediverso_consentimentos (
  id bigserial primary key,
  -- "usuario", como nas outras tabelas da pessoa: o "baixar meus dados" (public.conta_meus_dados) leva o histórico sozinho.
  usuario uuid not null references interno.perfis (id) on delete cascade,
  versao integer,
  ligado boolean not null,
  quando timestamptz not null default now()
);
create index if not exists fediverso_consentimentos_usuario on interno.fediverso_consentimentos (usuario, quando desc);
alter table interno.fediverso_consentimentos enable row level security;
revoke all on interno.fediverso_consentimentos from public;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on interno.fediverso_consentimentos from anon, authenticated;
    revoke all on sequence interno.fediverso_consentimentos_id_seq from anon, authenticated;
  end if;
end $$;

/** Grava no histórico quando a federação de alguém liga, desliga ou muda de versão. Conta já apagada não ganha linha. */
create or replace function interno.rede_fed_consentimento_historico() returns trigger language plpgsql security definer set search_path = interno, pg_temp as $$
begin
  if tg_op = 'INSERT' then
    if not new.ligado then return null; end if;
  elsif new.ligado = old.ligado and (not new.ligado or new.consentimento_versao is not distinct from old.consentimento_versao) then
    return null;
  end if;
  insert into fediverso_consentimentos (usuario, versao, ligado)
  select new.perfil, new.consentimento_versao, new.ligado where exists (select 1 from perfis f where f.id = new.perfil);
  return null;
end $$;

drop trigger if exists fediverso_consentimento_historico on interno.rede_fed_atores;
create trigger fediverso_consentimento_historico after insert or update of ligado, consentimento_versao on interno.rede_fed_atores
  for each row execute function interno.rede_fed_consentimento_historico();

-- Quem JÁ estava com a federação ligada antes desta migração ganha a linha do "liga", com a data em que ligou (pode rodar de
-- novo: só entra quem ainda não tem linha nenhuma).
insert into interno.fediverso_consentimentos (usuario, versao, ligado, quando)
select a.perfil, a.consentimento_versao, true, coalesce(a.ligado_em, now())
  from interno.rede_fed_atores a
 where a.ligado and exists (select 1 from interno.perfis f where f.id = a.perfil)
   and not exists (select 1 from interno.fediverso_consentimentos c where c.usuario = a.perfil);

/**
 * Liga (com o consentimento da versão em vigor) ou desliga a federação do próprio perfil. Desligar retira o que saiu. Igual à de
 * 2026-11-alumia.sql, mais: a escolha feita no perfil fica também no consentimento de entrada (rede_consentimentos.fediverso),
 * para as duas telas dizerem a mesma coisa. O histórico é gravado pelo gatilho de interno.rede_fed_atores.
 */
create or replace function public.rede_fed_ligar(p_sim boolean, p_versao integer default null) returns jsonb
language plpgsql volatile security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); v_motivo text; v_handle text;
begin
  perform interno.aberta('comunidade');
  if coalesce(p_sim, false) then
    -- Ligar refaz a federação inteira e grava uma linha no histórico: 6 por hora bastam (chave própria, longe da "descoberta").
    -- DESLIGAR não tem teto: é a retirada do consentimento e precisa passar sempre (e só desliga quem está ligado, então o
    -- histórico continua com no máximo duas linhas por "ligar").
    perform interno.limite('rede_fed_ligar_sim', 6, 60);
    v_motivo := interno.rede_fed_impedimento(v);
    if v_motivo is not null then perform interno.erro(v_motivo); end if;
    if p_versao is distinct from interno.rede_fed_versao() then perform interno.erro('invalido:versao'); end if;
    v_handle := (select rede_handle from perfis where id = v);
    if exists (select 1 from rede_fed_atores where handle = v_handle and ligado and perfil <> v) then perform interno.erro('invalido:handle'); end if;
    insert into rede_fed_atores (perfil, handle, ligado, consentimento_versao, ligado_em, desligado_em)
    values (v, v_handle, true, interno.rede_fed_versao(), now(), null)
    on conflict (perfil) do update set
      ligado_em = case when rede_fed_atores.ligado and rede_fed_atores.handle = excluded.handle then rede_fed_atores.ligado_em else now() end,
      -- Trocou de @nome desde a última vez: as chaves antigas não servem para o endereço novo.
      chave_publica = case when rede_fed_atores.handle = excluded.handle then rede_fed_atores.chave_publica end,
      chave_privada = case when rede_fed_atores.handle = excluded.handle then rede_fed_atores.chave_privada end,
      handle = excluded.handle, ligado = true, consentimento_versao = excluded.consentimento_versao, desligado_em = null;
    -- A federação já está ligada: o gatilho do item do consentimento vê isso e não liga de novo.
    update rede_consentimentos set fediverso = true, fediverso_versao = interno.rede_fed_versao()
    where usuario = v and revogado_em is null and versao = (select rede_consentimento from perfis where id = v)
      and (fediverso, fediverso_versao) is distinct from (true, interno.rede_fed_versao()::smallint);
  else
    perform interno.rede_fed_desligar(v);
    -- Desligar no perfil é revogar o item: ele fica desmarcado também no consentimento de entrada.
    update rede_consentimentos set fediverso = false where usuario = v and revogado_em is null and fediverso;
  end if;
  return public.rede_fed_situacao();
end $$;

-- ── 4. O cartão e as RPCs da tela ─────────────────────────────────────────────────────────────────────────────────────────

/**
 * A nota de fora no MESMO formato de cartão que interno.rede_post_v2 (como em 20261109-fediverso-total.sql), mais a relação de quem
 * lê com quem escreveu (silenciado, bloqueado, bloqueou_voce). "respostas" só sai a partir de 3 (abaixo disso, 0).
 */
create or replace function interno.rede_fed_cartao(c interno.rede_fed_recebidos, p_quem uuid, p_impulso jsonb default null) returns jsonb language sql stable security definer set search_path = interno, pg_temp as $$
  select jsonb_build_object(
    'id', c.id, 'origem', 'fediverso', 'tipo', 'post', 'titulo', null, 'texto', c.texto, 'html', c.html,
    'corpo', null, 'longo', false, 'comunidade', null, 'flair', null,
    'publico', case when c.visibilidade = 'seguidores' then 'seguidores' else 'internet' end, 'visibilidade', c.visibilidade,
    'criado_em', coalesce(c.publicado, c.recebido_em), 'editado_em', c.editado_em,
    'fixado', false, 'travado', false, 'aceita', null, 'verificada', false,
    'resposta_a', c.em_resposta_a, 'raiz', coalesce(c.contexto, c.id), 'nivel', 0,
    'aviso', c.aviso, 'sensivel', c.sensivel or c.aviso <> '', 'cita', null, 'chamado', null,
    'meu', false, 'retido', false, 'motivo', '', 'modero', false) || jsonb_build_object(
    'autor', jsonb_build_object('id', null, 'codinome', coalesce(nullif(r.nome, ''), r.handle, interno.rede_fed_dominio(c.ator)),
                                'handle', r.handle, 'perfil', false, 'equipe', false, 'remoto', true),
    'ator_remoto', c.ator, 'handle_remoto', r.handle, 'nome_remoto', r.nome, 'avatar', r.avatar,
    'servidor', interno.rede_fed_dominio(c.ator), 'url', coalesce(c.url, c.id),
    'respostas', interno.rede_fed_piso((select count(*)::integer from rede_fed_recebidos x where x.em_resposta_a = c.id and interno.rede_fed_nota_ve(x, p_quem))
               + (select count(*)::integer from rede_posts l where l.resposta_a_remota = c.id and interno.rede_ve(l, p_quem))),
    'na_conversa', null, 'util', 0, 'util_eu', false, 'apoios', null,
    'curti', p_quem is not null and exists (select 1 from fediverso_interacoes i where i.direcao = 'saida' and i.tipo = 'like' and i.perfil = p_quem and i.objeto_remoto = c.id),
    'impulsionei', p_quem is not null and exists (select 1 from fediverso_interacoes i where i.direcao = 'saida' and i.tipo = 'announce' and i.perfil = p_quem and i.objeto_remoto = c.id),
    'apoiei', p_quem is not null and exists (select 1 from fediverso_interacoes i where i.direcao = 'saida' and i.tipo = 'like' and i.perfil = p_quem and i.objeto_remoto = c.id),
    'salvei', false, 'vou', null, 'vou_eu', false,
    'midia', c.midia, 'citado', null, 'post_local', c.post_local, 'impulsionado_por', p_impulso) || jsonb_build_object(
    -- A relação de QUEM LÊ com quem escreveu. Só a própria pessoa recebe isto; sem sessão, tudo falso.
    'silenciado', p_quem is not null and exists (select 1 from fediverso_filtros f where f.usuario = p_quem and f.ator = c.ator and f.tipo = 'silencio'),
    'bloqueado', p_quem is not null and exists (select 1 from fediverso_filtros f where f.usuario = p_quem and f.ator = c.ator and f.tipo = 'bloqueio'),
    'bloqueou_voce', p_quem is not null and exists (select 1 from fediverso_bloqueios_recebidos b where b.perfil = p_quem and b.ator = c.ator))
  from (select 1) u left join rede_fed_remotos r on r.ator = c.ator
$$;

/**
 * A situação da federação para quem está na sessão (a de sempre, mais o endereço completo e o domínio da conta).
 * "seguidores" e "seguindo" são os números da própria pessoa, só para ela.
 */
create or replace function public.rede_fed_situacao() returns jsonb language plpgsql stable security definer set search_path = interno, pg_temp as $$
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
    -- O endereço completo (@nome@dominio) e o domínio da conta: o curto no modo total, o da Alumia sem ele. Nulo sem @nome ou
    -- enquanto o endereço do servidor não foi configurado (url_entrega).
    'dominio', interno.rede_fed_dominio_da_conta(),
    'endereco', case when a.ligado then '@' || (select rede_handle from perfis where id = v) || '@' || interno.rede_fed_dominio_da_conta() end,
    -- A tela pede o item do Fediverso (de novo) para quem pode federar e ainda não aceitou a versão 2: inclusive quem marcou o
    -- item com a flag desligada (versão 1), que não é ligado sozinho, e quem está ligado só na versão 1. Quem já respondeu o item
    -- na versão 2 (marcado ou não) e quem desligou no perfil não são pedidos (decidiram; religam no perfil quando quiserem).
    'pedir_fediverso', interno.rede_fed_total() and interno.rede_fed_impedimento(v) is null
      and (a.perfil is null or (a.ligado and coalesce(a.consentimento_versao, 1) < 2))
      and not exists (select 1 from rede_consentimentos c where c.usuario = v and c.revogado_em is null and c.fediverso_versao >= 2));
end $$;

/**
 * O perfil de alguém de fora como a Alumia o conhece (só o que é público e já foi buscado) e as notas dele que a pessoa pode ver,
 * da mais nova para a mais antiga, em páginas. Cursor = "<criado_em>|<id>" (o "proximo" da página anterior); limite de 1 a 40.
 * Só para quem aderiu à rede e com o modo total ligado. Se a pessoa de fora bloqueou quem pede: bloqueou_voce = true e nenhum
 * post (só o cabeçalho público do perfil), e só a própria pessoa fica sabendo.
 */
create or replace function public.rede_fed_perfil_remoto(p_ator text, p_cursor text, p_limite integer) returns jsonb
language plpgsql volatile security definer set search_path = interno, pg_temp as $$
declare
  v uuid := interno.eu(); v_r rede_fed_remotos; v_s rede_fed_seguindo;
  v_limite integer := least(greatest(coalesce(p_limite, 20), 1), 40);
  v_t timestamptz; v_k text; v_bloqueou boolean; v_posts jsonb := '[]'::jsonb; v_n integer := 0; v_prox text;
begin
  perform interno.aberta('comunidade');
  if not interno.rede2_membro(v) then perform interno.erro('consentimento'); end if;
  if not interno.rede_fed_total() then perform interno.erro('fediverso_desligado'); end if;
  perform interno.limite('rede_fed_remoto', 120, 60);
  if nullif(p_cursor, '') is not null then
    if position('|' in p_cursor) = 0 then perform interno.erro('invalido:cursor'); end if;
    begin
      v_t := split_part(p_cursor, '|', 1)::timestamptz;
    exception when others then
      perform interno.erro('invalido:cursor');
    end;
    v_k := substr(p_cursor, position('|' in p_cursor) + 1);
  end if;
  select * into v_r from rede_fed_remotos where ator = left(btrim(coalesce(p_ator, '')), 500);
  if not found or interno.rede_fed_bloqueado(v_r.ator) then perform interno.erro('nao_encontrado'); end if;
  v_bloqueou := exists (select 1 from fediverso_bloqueios_recebidos b where b.perfil = v and b.ator = v_r.ator);
  select * into v_s from rede_fed_seguindo where perfil = v and ator = v_r.ator;
  if not v_bloqueou then
    with lista as (
      select y, coalesce(y.publicado, y.recebido_em) as q, y.id as k from rede_fed_recebidos y
      where y.ator = v_r.ator and interno.rede_fed_nota_ve(y, v)
        and (v_t is null or (coalesce(y.publicado, y.recebido_em), y.id) < (v_t, v_k))
      order by 2 desc, 3 desc limit v_limite + 1
    ), numerada as (select l.*, row_number() over (order by l.q desc, l.k desc) as n from lista l)
    select coalesce(jsonb_agg(interno.rede_fed_cartao(x.y, v) order by x.n) filter (where x.n <= v_limite), '[]'::jsonb), count(*)::integer,
           max(x.q::text || '|' || x.k) filter (where x.n = v_limite)
    into v_posts, v_n, v_prox from numerada x;
  end if;
  return jsonb_build_object('ator', v_r.ator, 'handle', v_r.handle, 'nome', v_r.nome, 'resumo', v_r.resumo, 'url', v_r.url, 'avatar', v_r.avatar,
    'tipo', v_r.tipo, 'servidor', interno.rede_fed_dominio(v_r.ator),
    'seguindo', case when v_s.ator is null then 'nao' when v_s.aceito then 'sim' else 'pedido' end,
    'segue_voce', exists (select 1 from rede_fed_seguidores x where x.perfil = v and x.ator = v_r.ator),
    'bloqueado', exists (select 1 from fediverso_filtros f where f.usuario = v and f.ator = v_r.ator and f.tipo = 'bloqueio'),
    'silenciado', exists (select 1 from fediverso_filtros f where f.usuario = v and f.ator = v_r.ator and f.tipo = 'silencio'),
    'bloqueou_voce', v_bloqueou,
    'posts', v_posts, 'proximo', case when v_n > v_limite then v_prox end);
end $$;

/**
 * A pessoa de fora `p_ator` bloqueou quem pergunta (mandou um Block, guardado em fediverso_bloqueios_recebidos)? Leve, para a rota
 * conferir cada post lido agora na origem antes de mostrá-lo: não depende de o ator ainda estar em rede_fed_remotos (a faxina o
 * apaga depois de 60 dias sem seguidor, e quem bloqueou é justamente quem deixa de ter), não monta cartão e tem limite próprio.
 */
create or replace function public.rede_fed_me_bloqueou(p_ator text) returns boolean language plpgsql stable security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu();
begin
  perform interno.aberta('comunidade');
  if not interno.rede2_membro(v) then perform interno.erro('consentimento'); end if;
  if not interno.rede_fed_total() then perform interno.erro('fediverso_desligado'); end if;
  perform interno.limite('rede_fed_me_bloqueou', 600, 60);
  return exists (select 1 from fediverso_bloqueios_recebidos b where b.perfil = v and b.ator = left(btrim(coalesce(p_ator, '')), 500));
end $$;

/** A primeira página do perfil de alguém de fora (a chamada de sempre, com um argumento só). */
create or replace function public.rede_fed_perfil_remoto(p_ator text) returns jsonb language plpgsql volatile security definer set search_path = interno, pg_temp as $$
begin
  return public.rede_fed_perfil_remoto(p_ator, null::text, 20);
end $$;

/**
 * O fio de uma nota de fora: a nota, o que vem acima (até 10 níveis: notas de fora guardadas ou o post daqui que começou a
 * conversa) e as respostas (de fora e daqui), cada uma pela regra de quem pode ver. Só para quem aderiu e com o modo total ligado.
 */
create or replace function public.rede_fed_fio_remoto(p_id text) returns jsonb language plpgsql volatile security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); v_c rede_fed_recebidos; v_x rede_fed_recebidos; v_l rede_posts; v_acima jsonb := '[]'::jsonb; v_ref text; v_n integer := 0;
begin
  perform interno.aberta('comunidade');
  if not interno.rede2_membro(v) then perform interno.erro('consentimento'); end if;
  if not interno.rede_fed_total() then perform interno.erro('fediverso_desligado'); end if;
  perform interno.limite('rede2_ler', 600, 60);
  select * into v_c from rede_fed_recebidos where id = left(coalesce(p_id, ''), 500);
  if not found or not interno.rede_fed_nota_ve(v_c, v) then perform interno.erro('nao_encontrado'); end if;
  v_ref := v_c.em_resposta_a;
  while v_ref is not null and v_n < 10 loop
    v_n := v_n + 1;
    select * into v_x from rede_fed_recebidos where id = v_ref;
    if found then
      if not interno.rede_fed_nota_ve(v_x, v) then exit; end if;
      v_acima := jsonb_build_array(interno.rede_fed_cartao(v_x, v)) || v_acima;
      v_ref := v_x.em_resposta_a;
    else
      select * into v_l from rede_posts where id = interno.rede_fed_post_local(v_ref);
      if found and interno.rede_ve(v_l, v) then v_acima := jsonb_build_array(interno.rede_post_v2(v_l, v)) || v_acima; end if;
      exit;
    end if;
  end loop;
  return jsonb_build_object('post', interno.rede_fed_cartao(v_c, v), 'acima', v_acima,
    'respostas', coalesce((select jsonb_agg(z.j order by z.q) from (
        select interno.rede_fed_cartao(c, v) as j, coalesce(c.publicado, c.recebido_em) as q
        from rede_fed_recebidos c where c.em_resposta_a = v_c.id and interno.rede_fed_nota_ve(c, v)
        union all
        select interno.rede_post_v2(p, v), p.criado_em
        from rede_posts p where p.resposta_a_remota = v_c.id and interno.rede_ve(p, v) and not interno.rede_silenciado(p, v)
        order by 2 limit 200) z), '[]'::jsonb));
end $$;

/**
 * As respostas de fora a um post daqui (como em 20261109-fediverso-total.sql). "total" só sai a partir de 3; abaixo disso, 0
 * (a lista vem inteira do mesmo jeito: quem lê vê cada resposta, só não vê o número).
 */
create or replace function public.rede_fed_respostas_de(p_post uuid, p_cursor text default null, p_limite integer default 50) returns jsonb
language plpgsql volatile security definer set search_path = interno, pg_temp as $$
declare
  v uuid := interno.eu(); v_p rede_posts; v_limite integer := least(greatest(coalesce(p_limite, 50), 1), 100);
  v_t timestamptz; v_k text; v_itens jsonb; v_n integer; v_total integer; v_prox text;
begin
  perform interno.aberta('comunidade');
  perform interno.limite('rede2_ler', 600, 60);
  select * into v_p from rede_posts where id = p_post;
  if not found or not interno.rede_ve(v_p, v) then perform interno.erro('nao_encontrado'); end if;
  if not interno.rede_fed_total() then return jsonb_build_object('itens', '[]'::jsonb, 'proximo', null, 'total', 0); end if;
  if nullif(p_cursor, '') is not null then
    if position('|' in p_cursor) = 0 then perform interno.erro('invalido:cursor'); end if;
    begin
      v_t := split_part(p_cursor, '|', 1)::timestamptz;
    exception when others then
      perform interno.erro('invalido:cursor');
    end;
    v_k := substr(p_cursor, position('|' in p_cursor) + 1);
  end if;
  select count(*)::integer into v_total from rede_fed_recebidos c where c.post_local = p_post and interno.rede_fed_nota_ve(c, v);
  with lista as (
    select c, coalesce(c.publicado, c.recebido_em) as q, c.id as k from rede_fed_recebidos c
    where c.post_local = p_post and interno.rede_fed_nota_ve(c, v)
      and (v_t is null or (coalesce(c.publicado, c.recebido_em), c.id) > (v_t, v_k))
    order by 2, 3 limit v_limite + 1
  ), numerada as (select l.*, row_number() over (order by l.q, l.k) as n from lista l)
  select coalesce(jsonb_agg(interno.rede_fed_cartao(x.c, v) order by x.n) filter (where x.n <= v_limite), '[]'::jsonb), count(*)::integer
  into v_itens, v_n from numerada x;
  if v_n > v_limite then
    select z.q::text || '|' || z.k into v_prox from (select coalesce(c.publicado, c.recebido_em) as q, c.id as k from rede_fed_recebidos c
      where c.post_local = p_post and interno.rede_fed_nota_ve(c, v) and (v_t is null or (coalesce(c.publicado, c.recebido_em), c.id) > (v_t, v_k))
      order by 1, 2 limit v_limite) z order by z.q desc, z.k desc limit 1;
  end if;
  return jsonb_build_object('itens', v_itens, 'proximo', v_prox, 'total', interno.rede_fed_piso(v_total));
end $$;

/**
 * Bloquear (ou desbloquear) alguém de fora: some da linha, dos avisos e do fio; deixa de seguir e de ser seguido; com a federação
 * ligada, sai um Block (e um Undo dele ao desbloquear). Só para quem aderiu e com o modo total ligado.
 */
create or replace function public.rede_fed_bloquear_pessoa(p_ator text, p_sim boolean default true) returns jsonb
language plpgsql volatile security definer set search_path = interno, pg_temp as $$
declare
  v uuid := interno.eu(); v_ator text := left(btrim(coalesce(p_ator, '')), 500); v_f fediverso_filtros; v_inbox text; v_ativ text;
  v_ligado boolean := interno.rede_fed_total() and exists (select 1 from rede_fed_atores where perfil = v and ligado);
begin
  perform interno.aberta('comunidade');
  if not interno.rede2_membro(v) then perform interno.erro('consentimento'); end if;
  if not interno.rede_fed_total() then perform interno.erro('fediverso_desligado'); end if;
  perform interno.limite('rede_fed_filtro', 60, 60);
  if v_ator !~ '^https://[^\s]+$' then perform interno.erro('invalido:ator'); end if;
  select inbox into v_inbox from rede_fed_remotos where ator = v_ator;
  select * into v_f from fediverso_filtros where usuario = v and ator = v_ator;
  if coalesce(p_sim, true) then
    if v_f.tipo is distinct from 'bloqueio' then
      v_ativ := case when v_ligado and v_inbox is not null and not interno.rede_fed_bloqueado(v_inbox) then gen_random_uuid()::text end;
      insert into fediverso_filtros (usuario, ator, tipo, atividade) values (v, v_ator, 'bloqueio', v_ativ)
      on conflict (usuario, ator) do update set tipo = 'bloqueio', atividade = excluded.atividade, criado_em = now();
      if v_ativ is not null then
        insert into rede_fed_fila (perfil, tipo, objeto, destino, extra) values (v, 'block', v_ator, v_inbox, jsonb_build_object('atividade', v_ativ));
      end if;
    end if;
    -- Só os avisos que já dizem quem foi. Os de curtida e impulso ficam: apagá-los revelaria, bloqueando um candidato por vez,
    -- quem curtiu ou impulsionou.
    delete from avisos where para = v and ator_remoto = v_ator and tipo in ('fed_seguidor', 'fed_resposta', 'fed_mencao');
    delete from rede_fed_seguidores where perfil = v and ator = v_ator;
    if v_ligado and v_inbox is not null then
      insert into rede_fed_fila (perfil, tipo, objeto, destino, extra)
      select v, 'undo-follow', s.ator, v_inbox, jsonb_build_object('pedido', s.pedido) from rede_fed_seguindo s where s.perfil = v and s.ator = v_ator;
    end if;
    delete from rede_fed_seguindo where perfil = v and ator = v_ator;
  elsif v_f.tipo = 'bloqueio' then
    delete from fediverso_filtros where usuario = v and ator = v_ator;
    if v_f.atividade is not null and v_ligado and v_inbox is not null then
      insert into rede_fed_fila (perfil, tipo, objeto, destino, extra) values (v, 'undo-block', v_ator, v_inbox, jsonb_build_object('atividade', v_f.atividade));
    end if;
  end if;
  return jsonb_build_object('ok', true, 'bloqueado', exists (select 1 from fediverso_filtros f where f.usuario = v and f.ator = v_ator and f.tipo = 'bloqueio'));
end $$;

/** Silenciar (ou não) alguém de fora: some da linha e dos avisos, só aqui (nada sai). Só para quem aderiu e com o modo total ligado. */
create or replace function public.rede_fed_silenciar_pessoa(p_ator text, p_sim boolean default true) returns jsonb
language plpgsql volatile security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); v_ator text := left(btrim(coalesce(p_ator, '')), 500);
begin
  perform interno.aberta('comunidade');
  if not interno.rede2_membro(v) then perform interno.erro('consentimento'); end if;
  if not interno.rede_fed_total() then perform interno.erro('fediverso_desligado'); end if;
  perform interno.limite('rede_fed_filtro', 60, 60);
  if v_ator !~ '^https://[^\s]+$' then perform interno.erro('invalido:ator'); end if;
  if coalesce(p_sim, true) then
    insert into fediverso_filtros (usuario, ator, tipo) values (v, v_ator, 'silencio') on conflict (usuario, ator) do nothing;
  else
    delete from fediverso_filtros where usuario = v and ator = v_ator and tipo = 'silencio';
  end if;
  return jsonb_build_object('ok', true, 'silenciado', exists (select 1 from fediverso_filtros f where f.usuario = v and f.ator = v_ator and f.tipo = 'silencio'));
end $$;

-- ── 5. O que o servidor do site chama ─────────────────────────────────────────────────────────────────────────────────────

/**
 * As ações do servidor do site (a de 20261109-fediverso-total.sql, inteira), com estas mudanças:
 *   ator                  → nome só com o codinome conferido (rede_codinome_ok); senão o @nome
 *   seguidores, seguindo_publico, comunidade_seguidores → total só a partir de 3 (abaixo disso, 0)
 *   comunidade            → moderadores sempre []; seguidores só a partir de 3
 *   contagem              → usuarios só a partir de 3 (posts não muda: não conta pessoas)
 *   contagem_ativos       → mes e semestre só a partir de 3
 *   nota_recebida         → guarda também a nota impulsionada por quem alguém daqui segue (motivo: 'impulso')
 *   seguir                → recusa (sem_permissao) o pedido a quem bloqueou a pessoa lá fora
 */
create or replace function public.rede_fed_servidor(p_segredo text, p_acao text, p jsonb default '{}'::jsonb) returns jsonb
language plpgsql volatile security definer set search_path = interno, pg_temp as $$
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
    delete from rede_fed_seguidores where ator = v_ator;
    delete from rede_fed_seguindo where ator = v_ator;
    delete from rede_fed_recebidos where ator = v_ator;
    delete from rede_fed_remotos where ator = v_ator;
    delete from fediverso_interacoes where direcao = 'entrada' and ator = v_ator;
    delete from fediverso_grupo_seguidores where ator = v_ator;
    delete from fediverso_bloqueios_recebidos where ator = v_ator;
    delete from avisos where ator_remoto = v_ator;
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
        insert into fediverso_interacoes (direcao, tipo, ator, post_local, atividade_id) values ('entrada', v_tipo, v_ator, v_post, v_id)
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
      where fi.direcao = 'entrada' and fi.ator = v_ator and (v_tipo is null or fi.tipo = v_tipo)
        and ((v_post is not null and fi.post_local = v_post) or (v_ref is not null and fi.objeto_remoto = v_ref) or (v_id is not null and fi.atividade_id = v_id))
      returning fi.post_local, fi.tipo
    )
    delete from avisos av using apagadas d
    where av.ator_remoto = v_ator and av.post = d.post_local and av.tipo = case d.tipo when 'like' then 'fed_curtida' else 'fed_impulso' end;
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
end $$;

-- ── 6. Permissões ─────────────────────────────────────────────────────────────────────────────────────────────────────────
-- Nenhuma função interna é chamável de fora. As da pessoa pedem conta (cada uma confere a sessão); a do servidor continua só com o segredo.
do $$
declare
  v_internas text[] := array['rede_fed_piso(integer)', 'rede_fed_aviso_total(text, integer)', 'rede_fed_dominio_da_conta()', 'rede_fed_aviso_remoto(uuid[])',
    'rede_fed_consentimento_historico()', 'rede_fed_cartao(interno.rede_fed_recebidos, uuid, jsonb)'];
  v_publicas text[] := array['rede_fed_ligar(boolean, integer)', 'rede_fed_me_bloqueou(text)', 'rede_fed_perfil_remoto(text)', 'rede_fed_perfil_remoto(text, text, integer)', 'rede_fed_fio_remoto(text)',
    'rede_fed_respostas_de(uuid, text, integer)', 'rede_fed_bloquear_pessoa(text, boolean)', 'rede_fed_silenciar_pessoa(text, boolean)'];
  v_f text;
  v_papeis boolean := exists (select 1 from pg_roles where rolname = 'anon');
begin
  foreach v_f in array v_internas loop
    execute format('revoke all on function interno.%s from public', v_f);
    if v_papeis then execute format('revoke all on function interno.%s from anon, authenticated', v_f); end if;
  end loop;
  foreach v_f in array v_publicas || array['rede_fed_situacao()', 'rede_fed_servidor(text, text, jsonb)'] loop
    execute format('revoke all on function public.%s from public', v_f);
    if v_papeis then execute format('revoke all on function public.%s from anon, authenticated', v_f); end if;
  end loop;
  if v_papeis then
    foreach v_f in array v_publicas loop
      execute format('grant execute on function public.%s to authenticated, service_role', v_f);
    end loop;
    grant execute on function public.rede_fed_situacao(), public.rede_fed_servidor(text, text, jsonb) to anon, authenticated, service_role;
  end if;
end $$;
