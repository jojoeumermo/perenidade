-- Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
-- Alumia · R1 · uso e funções (antes do beta):
--
--   0. Os interruptores novos no catálogo (só pelo nome, desligados): "alumia-falar-moderacao" e "alumia-identidades".
--
--   1. "Falar com a moderação": um canal direto entre a pessoa e a mediação de UMA comunidade, que não é denúncia.
--      Quem escreve escolhe se a mediação vê o codinome (o padrão é não ver: a conversa aparece como "Conversa nº 12"). A resposta
--      sai como "Mediação", nunca com o nome de quem modera (quem cuida não vira alvo). Quem lê, dito na tela antes de escrever:
--      as pessoas que moderam a comunidade e a equipe de cuidado da Alumia. Não é cifrado de ponta a ponta: o texto fica no
--      servidor, e quem administra o banco pode lê-lo. A conversa encerrada se apaga sozinha em 90 dias (LGPD art. 15 e 16): a
--      faxina roda toda madrugada pelo pg_cron ("alumia-modmail-faxina"), sem depender de alguém abrir conversa nova.
--      Fica atrás do interruptor "alumia-falar-moderacao" (catálogo, só pelo nome): desligado, nada abre e nada se lê.
--   2. A situação do cadastro em quatro passos claros: "na fila" (ninguém da triagem abriu a lista com o pedido ainda),
--      "em análise" (a triagem já o viu), "aprovado" e "recusado". Quem viu nunca é guardado: só a ficha e a tentativa.
--
-- Leis e princípios: LGPD art. 6º (finalidade, necessidade e transparência), art. 11 (dado sensível: opinião e filiação), art. 15 e
-- 16 (fim do tratamento). Nenhuma lista de pessoas (a mediação vê uma conversa de cada vez e só o número dela), nenhum endereço de
-- rede (nenhuma coluna de IP), nenhum número abaixo de 3.
--
-- Redefine (a definição COMPLETA, tirada do banco montado com o install.sql deste ramo): public.alumia_triagem_fila,
-- public.alumia_painel_cadastros e public.alumia_entrada_eu. Pode rodar mais de uma vez. Termina trancando tudo na porta.
-- Teste: npm run testar:r1-uso.

-- ── 1. Os interruptores ───────────────────────────────────────────────────────────────────────────────────────────────────
-- "alumia-falar-moderacao": o canal com a mediação (abaixo). "alumia-identidades": as várias identidades da mesma pessoa, cuja
-- troca ainda não existe; a tela /alumia/identidades passa a depender dele e fica desligada, à vista no painel único.
do $$
begin
  if to_regclass('interno.recursos_catalogo') is not null then
    insert into interno.recursos_catalogo (nome, so_pelo_nome) values ('alumia-falar-moderacao', true), ('alumia-identidades', true)
      on conflict (nome) do update set so_pelo_nome = true;
  end if;
end $$;

-- ── 2. Falar com a moderação: as tabelas ──────────────────────────────────────────────────────────────────────────────────
create table if not exists interno.rede_modmail_conversas (
  id uuid primary key default gen_random_uuid(),
  comunidade text not null references interno.rede_comunidades (slug) on delete cascade on update cascade,
  -- Quem abriu. Nunca sai em função para a mediação: ela vê o codinome só se a pessoa escolheu mostrar.
  autor uuid not null references interno.perfis (id) on delete cascade,
  com_codinome boolean not null default false,
  -- O número da conversa na comunidade ("Conversa nº 12"): a mediação fala dela sem nome.
  numero integer not null check (numero > 0),
  situacao text not null default 'aberta' check (situacao in ('aberta', 'encerrada')),
  criada_em timestamptz not null default now(),
  atualizada_em timestamptz not null default now(),
  encerrada_em timestamptz,
  -- O lado que escreveu por último e o que cada lado já leu (para o "nova" da lista, sem contar nada).
  ultima_de text not null default 'pessoa' check (ultima_de in ('pessoa', 'mediacao')),
  lida_pessoa boolean not null default true,
  lida_mediacao boolean not null default false,
  unique (comunidade, numero)
);
create index if not exists rede_modmail_conversas_autor on interno.rede_modmail_conversas (autor, atualizada_em desc);
create index if not exists rede_modmail_conversas_caixa on interno.rede_modmail_conversas (comunidade, situacao, atualizada_em desc);

create table if not exists interno.rede_modmail_mensagens (
  id bigint generated always as identity primary key,
  conversa uuid not null references interno.rede_modmail_conversas (id) on delete cascade,
  de text not null check (de in ('pessoa', 'mediacao')),
  -- A pessoa que escreveu, quando é ela (entra no "baixar meus dados" dela).
  autor uuid references interno.perfis (id) on delete cascade,
  -- Quem da mediação escreveu: só para a equipe responder por abuso. Nunca sai em função.
  por uuid references interno.perfis (id) on delete set null,
  texto text not null check (char_length(texto) between 1 and 2000),
  em timestamptz not null default now(),
  check ((de = 'pessoa' and autor is not null and por is null) or (de = 'mediacao' and autor is null))
);
create index if not exists rede_modmail_mensagens_conversa on interno.rede_modmail_mensagens (conversa, id);

alter table interno.rede_modmail_conversas enable row level security;
alter table interno.rede_modmail_mensagens enable row level security;
revoke all on table interno.rede_modmail_conversas, interno.rede_modmail_mensagens from public;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on table interno.rede_modmail_conversas, interno.rede_modmail_mensagens from anon, authenticated;
  end if;
end $$;

-- ── 3. Falar com a moderação: as peças de dentro ──────────────────────────────────────────────────────────────────────────

/**
 * "Falar com a moderação" está ligado? Só com decisão explícita do painel (interno.recursos_vivos; o recurso é "só pelo nome", então
 * ligar pede a segunda pessoa da coordenação) e sem a Alumia desligada lá. Sem a tabela de recursos: desligado.
 */
create or replace function interno.rede_modmail_ligado() returns boolean language plpgsql stable security definer set search_path = interno, pg_temp as $$
begin
  if to_regclass('interno.recursos_vivos') is null then return false; end if;
  if exists (select 1 from recursos_vivos where nome in ('rede-v2', 'alumia-2') and not ligado) then return false; end if;
  return coalesce((select ligado from recursos_vivos where nome = 'alumia-falar-moderacao'), false);
end $$;

/** Recusa com "desligado" quando o interruptor está desligado. */
create or replace function interno.rede_modmail_exige() returns void language plpgsql stable security definer set search_path = interno, pg_temp as $$
begin
  if not interno.rede_modmail_ligado() then perform interno.erro('desligado'); end if;
end $$;

/** A faxina: conversa encerrada há mais de 90 dias some, com as mensagens. Roda toda madrugada (pg_cron) e, de vez em quando, dentro das chamadas. */
create or replace function interno.rede_modmail_faxina() returns void language plpgsql security definer set search_path = interno, pg_temp as $$
begin
  delete from rede_modmail_conversas where situacao = 'encerrada' and encerrada_em < now() - interval '90 days';
end $$;

/**
 * A conversa e o lado de quem chama ('pessoa', 'mediacao' ou nulo). Quem não é a pessoa nem modera a comunidade recebe nulo, e
 * as funções respondem "nao_encontrado", o mesmo de quando a conversa não existe (não dá para sondar ids).
 */
create or replace function interno.rede_modmail_lado(p_conversa uuid, p_quem uuid) returns text language plpgsql stable security definer set search_path = interno, pg_temp as $$
declare c rede_modmail_conversas;
begin
  if p_conversa is null or p_quem is null then return null; end if;
  select * into c from rede_modmail_conversas where id = p_conversa;
  if not found then return null; end if;
  if c.autor = p_quem then return 'pessoa'; end if;
  if interno.rede3_mod_modera(c.comunidade, null) then return 'mediacao'; end if;
  return null;
end $$;

/** A conversa como a lista mostra. O codinome só para a mediação e só se a pessoa escolheu mostrar. */
create or replace function interno.rede_modmail_item(p_conversa uuid, p_lado text) returns jsonb language sql stable security definer set search_path = interno, pg_temp as $$
  select jsonb_build_object(
    'id', c.id, 'comunidade', c.comunidade, 'nome', k.nome, 'numero', c.numero, 'situacao', c.situacao,
    'atualizada_em', c.atualizada_em, 'com_codinome', c.com_codinome,
    'nova', case when p_lado = 'pessoa' then not c.lida_pessoa else not c.lida_mediacao end,
    'codinome', case when p_lado = 'mediacao' and c.com_codinome then nullif(f.rede_codinome, '') end)
  from rede_modmail_conversas c join rede_comunidades k on k.slug = c.comunidade join perfis f on f.id = c.autor
  where c.id = p_conversa
$$;

-- ── 4. Falar com a moderação: as funções da tela ──────────────────────────────────────────────────────────────────────────

/** O interruptor, para a tela saber se mostra o canal (o banco confere de novo em cada chamada). */
create or replace function public.rede_modmail_ligado() returns boolean language plpgsql stable security definer set search_path = interno, pg_temp as $$
begin
  return auth.uid() is not null and interno.rede_modmail_ligado();
end $$;

/**
 * Abre uma conversa com a mediação de uma comunidade. Texto de 1 a 2000 letras. No máximo 3 conversas abertas por pessoa em cada
 * comunidade e 5 aberturas por hora. Quem foi banida da comunidade também pode escrever (é o caminho para pedir revisão).
 */
create or replace function public.rede_modmail_abrir(p_comunidade text, p_texto text, p_com_codinome boolean) returns jsonb
language plpgsql security definer set search_path = interno, pg_temp as $$
declare
  v uuid := interno.eu(); k rede_comunidades; v_id uuid; v_num integer;
  v_texto text := interno.txt(p_texto, 'texto', 1, 2000);
begin
  perform interno.rede_modmail_exige();
  perform interno.aberta('comunidade');
  perform interno.limite('modmail_abrir', 5, 60);
  select * into k from rede_comunidades where slug = lower(btrim(coalesce(p_comunidade, '')));
  if not found then perform interno.erro('nao_encontrado'); end if;
  if (select count(*) from rede_modmail_conversas where autor = v and comunidade = k.slug and situacao = 'aberta') >= 3 then
    perform interno.erro('muitas_abertas');
  end if;
  -- O número da conversa: um por vez em cada comunidade.
  perform pg_advisory_xact_lock(hashtext('rede_modmail:' || k.slug));
  select coalesce(max(numero), 0) + 1 into v_num from rede_modmail_conversas where comunidade = k.slug;
  insert into rede_modmail_conversas (comunidade, autor, com_codinome, numero, ultima_de, lida_pessoa, lida_mediacao)
  values (k.slug, v, coalesce(p_com_codinome, false), v_num, 'pessoa', true, false)
  returning id into v_id;
  insert into rede_modmail_mensagens (conversa, de, autor, texto) values (v_id, 'pessoa', v, v_texto);
  if random() < 0.05 then perform interno.rede_modmail_faxina(); end if;
  return interno.rede_modmail_item(v_id, 'pessoa');
end $$;

/** As conversas de quem chama (até 50, as mais recentes primeiro). */
create or replace function public.rede_modmail_minhas() returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu();
begin
  perform interno.rede_modmail_exige();
  perform interno.limite('modmail_ler', 240, 60);
  return coalesce((select jsonb_agg(interno.rede_modmail_item(x.id, 'pessoa') order by x.atualizada_em desc)
    from (select id, atualizada_em from rede_modmail_conversas where autor = v order by atualizada_em desc limit 50) x), '[]'::jsonb);
end $$;

/**
 * A caixa da mediação de UMA comunidade: as conversas (abertas primeiro, até 100), cada uma pelo número. Só quem modera a
 * comunidade (ou a equipe de cuidado). Nunca lista quem escreveu: o codinome só vem quando a pessoa escolheu mostrar.
 */
create or replace function public.rede_modmail_caixa(p_comunidade text) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); v_slug text := lower(btrim(coalesce(p_comunidade, '')));
begin
  perform interno.rede_modmail_exige();
  perform interno.limite('modmail_ler', 240, 60);
  if not exists (select 1 from rede_comunidades where slug = v_slug) or not interno.rede3_mod_modera(v_slug, null) then
    perform interno.erro('sem_permissao');
  end if;
  return coalesce((select jsonb_agg(interno.rede_modmail_item(x.id, 'mediacao') order by x.aberta desc, x.atualizada_em desc)
    from (select id, situacao = 'aberta' as aberta, atualizada_em from rede_modmail_conversas
          where comunidade = v_slug and autor <> v
          order by situacao = 'aberta' desc, atualizada_em desc limit 100) x), '[]'::jsonb);
end $$;

/**
 * Uma conversa inteira (até as 200 últimas mensagens), para a pessoa ou para a mediação. Marca como lida pelo lado de quem chama.
 * Cada mensagem diz só o lado ("pessoa" ou "mediacao") e se é de quem chama: nunca quem da mediação escreveu.
 */
create or replace function public.rede_modmail_conversa(p_id uuid) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); v_lado text;
begin
  perform interno.rede_modmail_exige();
  perform interno.limite('modmail_ler', 240, 60);
  v_lado := interno.rede_modmail_lado(p_id, v);
  -- A mediação não abre a conversa que ela mesma começou como pessoa (aí ela é a pessoa) e ninguém de fora abre nenhuma.
  if v_lado is null then perform interno.erro('nao_encontrado'); end if;
  if v_lado = 'pessoa' then
    update rede_modmail_conversas set lida_pessoa = true where id = p_id and not lida_pessoa;
  else
    update rede_modmail_conversas set lida_mediacao = true where id = p_id and not lida_mediacao;
  end if;
  return interno.rede_modmail_item(p_id, v_lado) || jsonb_build_object(
    'lado', v_lado,
    'mensagens', coalesce((select jsonb_agg(jsonb_build_object('de', m.de, 'texto', m.texto, 'em', m.em,
        'minha', (m.de = 'pessoa' and m.autor = v) or (m.de = 'mediacao' and v_lado = 'mediacao')) order by m.id)
      from (select * from rede_modmail_mensagens where conversa = p_id order by id desc limit 200) m), '[]'::jsonb));
end $$;

/** Escreve na conversa (a pessoa ou a mediação). Conversa encerrada não recebe mais nada. 30 mensagens por hora. */
create or replace function public.rede_modmail_escrever(p_id uuid, p_texto text) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); v_lado text; c rede_modmail_conversas; v_texto text := interno.txt(p_texto, 'texto', 1, 2000);
begin
  perform interno.rede_modmail_exige();
  perform interno.limite('modmail_escrever', 30, 60);
  v_lado := interno.rede_modmail_lado(p_id, v);
  if v_lado is null then perform interno.erro('nao_encontrado'); end if;
  select * into c from rede_modmail_conversas where id = p_id for update;
  if c.situacao <> 'aberta' then perform interno.erro('encerrada'); end if;
  if v_lado = 'pessoa' then
    insert into rede_modmail_mensagens (conversa, de, autor, texto) values (p_id, 'pessoa', v, v_texto);
  else
    insert into rede_modmail_mensagens (conversa, de, por, texto) values (p_id, 'mediacao', v, v_texto);
  end if;
  update rede_modmail_conversas set atualizada_em = now(), ultima_de = v_lado,
    lida_pessoa = (v_lado = 'pessoa'), lida_mediacao = (v_lado = 'mediacao')
  where id = p_id;
  return interno.rede_modmail_item(p_id, v_lado);
end $$;

/** Encerra a conversa (qualquer um dos lados). Encerrada, ela some sozinha em 90 dias. */
create or replace function public.rede_modmail_encerrar(p_id uuid) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); v_lado text;
begin
  perform interno.rede_modmail_exige();
  perform interno.limite('modmail_escrever', 30, 60);
  v_lado := interno.rede_modmail_lado(p_id, v);
  if v_lado is null then perform interno.erro('nao_encontrado'); end if;
  update rede_modmail_conversas set situacao = 'encerrada', encerrada_em = coalesce(encerrada_em, now()),
    lida_pessoa = lida_pessoa or v_lado = 'pessoa', lida_mediacao = lida_mediacao or v_lado = 'mediacao'
  where id = p_id;
  return interno.rede_modmail_item(p_id, v_lado);
end $$;

-- ── 5. A situação do cadastro: "na fila" ou "em análise" ──────────────────────────────────────────────────────────────────
-- A ficha que a triagem já viu na lista. Só a ficha e a tentativa: nem quem viu, nem quando (nada que exponha quem analisa).
create table if not exists interno.alumia_entrada_vista (
  ficha uuid not null references interno.alumia_entrada (id) on delete cascade,
  tentativa smallint not null,
  primary key (ficha, tentativa)
);
alter table interno.alumia_entrada_vista enable row level security;
revoke all on table interno.alumia_entrada_vista from public;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on table interno.alumia_entrada_vista from anon, authenticated;
  end if;
end $$;

/**
 * A fila: os pedidos em análise (os mais antigos primeiro, até 200) e os decididos nos últimos 30 dias. Cada pedido: o número da
 * ficha, o codinome, o motivo, quando pediu, quantas vezes pediu e há quantos dias a conta existe. Nada de e-mail, nome civil ou
 * IP. Só coordenação, vice-coordenação e mediação, em sessão com o segundo fator. (R1: os pedidos listados passam de "na fila"
 * para "em análise" na tela de quem pediu, sem guardar quem viu.)
 */
create or replace function public.alumia_triagem_fila() returns jsonb language plpgsql volatile security definer set search_path = interno, pg_temp as $$
declare v_res jsonb;
begin
  if not interno.alumia_triagem_pode() then perform interno.erro('sem_permissao'); end if;
  perform interno.limite('alumia_triagem_ler', 240, 60);
  v_res := jsonb_build_object(
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
  insert into alumia_entrada_vista (ficha, tentativa)
    select e.id, e.tentativas from alumia_entrada e
    where e.situacao = 'em_analise' and e.id in (select (x ->> 'id')::uuid from jsonb_array_elements(v_res -> 'pendentes') x)
  on conflict do nothing;
  return v_res;
end $$;

/** Os cadastros no painel da Alumia. (R1: os pedidos em análise listados passam de "na fila" para "em análise" na tela de quem pediu.) */
create or replace function public.alumia_painel_cadastros(p_situacao text default 'em_analise', p_busca text default '', p_pagina integer default 0) returns jsonb
language plpgsql security definer set search_path = interno, pg_temp as $$
declare v_busca text := left(btrim(coalesce(p_busca, '')), 60); v_pagina integer := greatest(0, least(coalesce(p_pagina, 0), 2000)); v_sit text := coalesce(p_situacao, 'em_analise');
  v_res jsonb;
begin
  perform interno.alumia_painel_exige();
  if v_sit not in ('em_analise', 'aprovada', 'recusada', 'todas') then perform interno.erro('invalido:situacao'); end if;
  v_res := jsonb_build_object(
    'contagem', jsonb_build_object(
      'em_analise', (select count(*) from alumia_entrada where situacao = 'em_analise'),
      'aprovada', (select count(*) from alumia_entrada where situacao = 'aprovada'),
      'recusada', (select count(*) from alumia_entrada where situacao = 'recusada')),
    'itens', coalesce((select jsonb_agg(x.j order by x.ordem) from (
      select row_number() over (order by (e.situacao = 'em_analise') desc, case when e.situacao = 'em_analise' then e.pedido_em end, coalesce(e.decidido_em, e.pedido_em) desc) as ordem,
        jsonb_build_object(
          'id', e.id, 'codinome', coalesce(nullif(f.rede_codinome, ''), '—'), 'handle', f.rede_handle, 'situacao', e.situacao, 'origem', e.origem,
          'motivo', e.motivo_pedido, 'pedido_em', e.pedido_em, 'vezes', e.tentativas,
          'conta_dias', greatest(0, extract(day from now() - coalesce((select u.created_at from auth.users u where u.id = e.usuario), e.pedido_em))::integer),
          'decidido_em', e.decidido_em, 'motivo_decisao', e.motivo_decisao, 'decidido_por', interno.alumia_painel_quem(e.decidido_por),
          'suspensa', f.suspenso, 'da_casa', interno.alumia_painel_da_casa(e.usuario)) as j
      from alumia_entrada e join perfis f on f.id = e.usuario
      where (v_sit = 'todas' or e.situacao = v_sit)
        and (v_busca = '' or f.rede_codinome ilike '%' || interno.alumia_painel_busca(v_busca) || '%' or f.rede_handle ilike '%' || interno.alumia_painel_busca(btrim(v_busca, ' @')) || '%')
      order by ordem limit 50 offset v_pagina * 50) x), '[]'::jsonb));
  insert into alumia_entrada_vista (ficha, tentativa)
    select e.id, e.tentativas from alumia_entrada e
    where e.situacao = 'em_analise' and e.id in (select (x ->> 'id')::uuid from jsonb_array_elements(v_res -> 'itens') x where x ->> 'situacao' = 'em_analise')
  on conflict do nothing;
  return v_res;
end $$;

/**
 * Onde a pessoa da sessão está na entrada da Alumia. Visitante recebe só {logado: false}. Nada sobre outras contas. (R1: "etapa"
 * diz "na_fila" enquanto ninguém da triagem viu o pedido e "em_analise" depois; nunca quem viu nem quando.)
 */
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
    'etapa', case when v_sit = 'em_analise' then
        case when exists (select 1 from alumia_entrada_vista w where w.ficha = e.id and w.tentativa = e.tentativas) then 'em_analise' else 'na_fila' end
      else v_sit end,
    'direto', v_auto,
    'aal2', interno.aal2(),
    'exigida', interno.alumia_exigida(),
    'codinome', case when f.rede_codinome_ok then f.rede_codinome end,
    'pedido_em', e.pedido_em,
    'motivo_recusa', case when v_sit = 'recusada' then e.motivo_decisao end,
    'pedir_de_novo_em', case when v_sit = 'recusada' then e.decidido_em + interval '30 days' end,
    'regras_versao', coalesce((select max(versao) from rede_regras), 1));
end $$;

-- ── 6. Permissões ─────────────────────────────────────────────────────────────────────────────────────────────────────────
do $$
declare r record;
begin
  -- As de dentro: ninguém chama pela API.
  for r in
    select p.oid::regprocedure as f from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'interno' and p.proname like 'rede\_modmail\_%'
  loop
    execute format('revoke all on function %s from public', r.f);
    if exists (select 1 from pg_roles where rolname = 'anon') then execute format('revoke all on function %s from anon, authenticated', r.f); end if;
  end loop;
  -- As da tela: só conta logada (a porta da entrada entra abaixo).
  for r in
    select p.oid::regprocedure as f from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname like 'rede\_modmail\_%'
  loop
    execute format('revoke all on function %s from public', r.f);
    if exists (select 1 from pg_roles where rolname = 'anon') then
      execute format('revoke all on function %s from anon', r.f);
      execute format('grant execute on function %s to authenticated, service_role', r.f);
    end if;
  end loop;
end $$;

-- ── 6b. A faxina toda madrugada ───────────────────────────────────────────────────────────────────────────────────────────
-- Só se o pg_cron existe (como a limpeza das urnas): a conversa encerrada some em 90 dias mesmo que ninguém abra conversa nova.
-- Sem o pg_cron, nada é agendado; a Saúde (public.alumia_painel_r1_banco, "faxina_da_moderacao") mostra se a rotina existe.
do $$
begin
  if to_regprocedure('cron.schedule(text,text,text)') is not null then
    perform cron.schedule('alumia-modmail-faxina', '17 4 * * *', 'select interno.rede_modmail_faxina()');
  end if;
exception when others then
  raise warning 'alumia-modmail-faxina: a rotina não foi agendada (%).', sqlerrm;
end $$;

-- ── 7. A porta ────────────────────────────────────────────────────────────────────────────────────────────────────────────
do $$
declare v jsonb := interno.alumia_trancar();
begin
  if jsonb_array_length(coalesce(v -> 'abertas', '[]'::jsonb)) > 0 then
    raise warning 'alumia_trancar: função sem porta: %', v -> 'abertas';
  end if;
end $$;
select interno.alumia_trancar();
