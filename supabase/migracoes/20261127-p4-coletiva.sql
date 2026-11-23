-- Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
-- Alumia · Prompt 4 · ação coletiva (Parte F: itens 89 a 100 e 122 a 126; os itens 90, 91, 94 e 97 não têm banco: o radar e a
-- previsão do tempo vão pelo servidor do site com cache na borda, os modelos de documento e o panfleto são feitos no aparelho).
--
-- Roda depois de 20261126-p5-fim.sql (banco na versão 17) e das outras 20261127-p4-*; quem junta põe antes do
-- 20261127-p4-fim.sql. Não mexe em rede_alumia_versao nem na lista de exceções da porta: o 20261127-p4-fim.sql faz isso.
-- Não redefine nenhuma função que já existia: todas as funções daqui são novas (prefixo rede_p4_ac_, rede_p4_pressao, rede_p4_carta,
-- rede_p4_quest, rede_p4_ato_, rede_p4_ciranda, rede_p4_pouso, rede_p4_filiacao, rede_p4_pix, rede_p4_org_, rede_p4_frente,
-- rede_p4_vitrine e rede_p4_rodizio). Usa, sem mudar, as tabelas da chave de segurança do lote de segurança pessoal
-- (20261127-p4-seguranca-pessoal.sql: interno.rede_p4_seg_chaves e interno.rede_p4_seg_bytes) para a ficha de filiação cifrada.
--
-- Tudo atrás do interruptor "alumia-p4-coletiva" (catálogo, só pelo nome, desligado): desligado, toda função daqui recusa com
-- "desligado".
--
-- As funções de leitura que contam no limite por conta (interno.limite grava) são volatile: o PostgREST roda as stable e immutable
-- numa transação só de leitura, e o limite falharia (o testar:p5-somente-leitura confere).
-- Privacidade: nenhuma função devolve lista de pessoas (a exceção é o pouso solidário, item 98: a gestão da organização vê o
-- codinome e o @ de quem ofereceu ou pediu pouso, porque é ela quem combina, e só porque a própria pessoa escolheu pedir ou
-- oferecer); nenhuma devolve número de pessoas abaixo de 3; nenhuma coluna de endereço de rede (os limites são pela conta,
-- interno.limite); nenhum texto de post sai para terceiros. Pode rodar mais de uma vez.
-- Lei: LGPD art. 6º, III (necessidade), art. 7º, I e art. 11, I (consentimento: opinião política e filiação são dados sensíveis),
-- art. 11, II, a e art. 46 (a ficha de filiação vai cifrada só para a coordenação da organização) e art. 18 (a pessoa desfaz o que
-- fez); Lei 12.527/2011 (os contatos oficiais e os dados abertos são públicos); ECA, art. 17 (a ciranda não guarda nome de criança).

-- ── 0. O interruptor e as ajudantes ───────────────────────────────────────────────────────────────────────────────────────
do $$
begin
  if to_regclass('interno.recursos_catalogo') is not null then
    insert into interno.recursos_catalogo (nome, so_pelo_nome) values ('alumia-p4-coletiva', true)
      on conflict (nome) do update set so_pelo_nome = true;
  end if;
end $$;

/** Ligado só com a Alumia nova e o interruptor ligado no painel (recursos_vivos). */
create or replace function interno.rede_p4_ac_ligado() returns boolean language plpgsql stable security definer set search_path = interno, pg_temp as $$
begin
  if to_regclass('interno.recursos_vivos') is null then return false; end if;
  if exists (select 1 from recursos_vivos where nome in ('rede-v2', 'alumia-2') and not ligado) then return false; end if;
  return coalesce((select ligado from recursos_vivos where nome = 'alumia-p4-coletiva'), false);
end $$;

/** Quem chama: o interruptor ligado e membro da Alumia (18+, consentimento). Devolve a conta. */
create or replace function interno.rede_p4_ac_eu() returns uuid language plpgsql stable security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu();
begin
  if not interno.rede_p4_ac_ligado() then perform interno.erro('desligado'); end if;
  if not interno.rede2_membro(v) then perform interno.erro('sem_permissao'); end if;
  return v;
end $$;

/** Um texto limpo: sem caracteres de controle, sem espaço sobrando, até p_max. */
create or replace function interno.rede_p4_ac_texto(p text, p_max integer) returns text language sql immutable as $$
  select left(btrim(regexp_replace(coalesce(p, ''), '[\x01-\x08\x0B\x0C\x0E-\x1F\x7F]', '', 'g')), p_max)
$$;

/** Um texto obrigatório entre p_min e p_max letras, sem dado pessoal (CPF, telefone, e-mail, endereço com número). */
create or replace function interno.rede_p4_ac_campo(p text, p_campo text, p_min integer, p_max integer) returns text language plpgsql stable set search_path = interno, pg_temp as $$
declare v text := interno.rede_p4_ac_texto(p, p_max + 1);
begin
  if char_length(v) not between p_min and p_max then perform interno.erro('invalido:' || p_campo); end if;
  return interno.alumia_sem_dado_pessoal(v, p_campo);
end $$;

/** Um link aceito: https, sem espaço, sem usuário e senha no endereço, até 300 caracteres. Nulo quando vazio. */
create or replace function interno.rede_p4_ac_link(p text) returns text language plpgsql immutable as $$
declare v text := btrim(coalesce(p, ''));
begin
  if v = '' then return null; end if;
  if char_length(v) > 300 or v !~ '^https://[A-Za-z0-9.-]+\.[A-Za-z]{2,}(:[0-9]{1,5})?(/[^\s<>"]*)?$' or v ~ '^https://[^/]*@' then
    perform interno.erro('invalido:link');
  end if;
  return v;
end $$;

/** A pessoa vê o que é desta comunidade? Aberta: qualquer membro da Alumia; restrita ou fechada: só quem é da comunidade. */
create or replace function interno.rede_p4_ac_ve_comunidade(p_slug text, p_quem uuid) returns boolean language sql stable security definer set search_path = interno, pg_temp as $$
  select p_quem is not null and exists (
    select 1 from rede_comunidades c where c.slug = p_slug
       and ((c.tipo = 'aberta' and c.slug not like 'fechado-%' and interno.rede2_membro(p_quem)) or interno.rede2_na_comunidade(c.slug, p_quem)))
$$;

/** A mediação desta comunidade (ou a equipe de cuidado). */
create or replace function interno.rede_p4_ac_modera(p_slug text, p_quem uuid) returns boolean language sql stable security definer set search_path = interno, pg_temp as $$
  select coalesce(interno.rede3_com_modera(p_slug, p_quem), false)
$$;

/** A comunidade pelo endereço, para a mediação dela: confere e devolve o endereço limpo. */
create or replace function interno.rede_p4_ac_mediacao(p_slug text, p_quem uuid) returns text language plpgsql stable security definer set search_path = interno, pg_temp as $$
declare v text := lower(btrim(coalesce(p_slug, '')));
begin
  if not interno.rede_p4_ac_modera(v, p_quem) then perform interno.erro('sem_permissao'); end if;
  return v;
end $$;

/** Contagem de pessoas para mostrar: nula abaixo de 3. */
create or replace function interno.rede_p4_ac_pessoas(p_n bigint) returns integer language sql immutable as $$
  select case when p_n >= 3 then p_n::integer end
$$;

/** A organização pelo @ (só perfis de organização e sem suspensão). Nulo quando não acha. */
create or replace function interno.rede_p4_ac_org(p_handle text) returns uuid language sql stable security definer set search_path = interno, pg_temp as $$
  select o.perfil from rede_orgs o join perfis f on f.id = o.perfil
   where f.rede_handle = lower(btrim(coalesce(p_handle, ''), ' @')) and not f.suspenso
$$;

/** A organização pelo @, para quem a gere: confere a gestão (e o selo, se pedido) e o limite. Devolve o id. */
create or replace function interno.rede_p4_ac_gestao(p_handle text, p_quem uuid, p_selo boolean) returns uuid language plpgsql stable security definer set search_path = interno, pg_temp as $$
declare v_org uuid := interno.rede_p4_ac_org(p_handle);
begin
  if v_org is null or not interno.alumia_org_gere(p_quem, v_org) then perform interno.erro('sem_permissao'); end if;
  if p_selo and not interno.alumia_o13_selo(v_org) then perform interno.erro('so_com_selo'); end if;
  return v_org;
end $$;

/** Uma organização como sai para quem vê: @, nome e se tem selo. Nunca quem a gere. */
create or replace function interno.rede_p4_ac_org_json(p_org uuid) returns jsonb language sql stable security definer set search_path = interno, pg_temp as $$
  select jsonb_build_object('handle', f.rede_handle, 'nome', interno.rede_nome(o.perfil), 'selo', o.verificada_em is not null)
    from rede_orgs o join perfis f on f.id = o.perfil where o.perfil = p_org
$$;

do $$
declare f text;
begin
  foreach f in array array['rede_p4_ac_ligado()', 'rede_p4_ac_eu()', 'rede_p4_ac_texto(text, integer)', 'rede_p4_ac_campo(text, text, integer, integer)',
    'rede_p4_ac_link(text)', 'rede_p4_ac_ve_comunidade(text, uuid)', 'rede_p4_ac_modera(text, uuid)', 'rede_p4_ac_mediacao(text, uuid)',
    'rede_p4_ac_pessoas(bigint)', 'rede_p4_ac_org(text)', 'rede_p4_ac_gestao(text, uuid, boolean)', 'rede_p4_ac_org_json(uuid)'] loop
    execute format('revoke all on function interno.%s from public', f);
    if exists (select 1 from pg_roles where rolname = 'anon') then execute format('revoke all on function interno.%s from anon, authenticated', f); end if;
  end loop;
end $$;

/** As comunidades da própria pessoa, com o nome e se ela modera. Só as dela: não diz quem mais está nem quantas pessoas são. */
create or replace function public.rede_p4_ac_minhas() returns jsonb language plpgsql stable security definer set search_path = interno, pg_temp as $$
declare v uuid;
begin
  perform interno.alumia_porta();
  v := interno.rede_p4_ac_eu();
  return jsonb_build_object(
    'comunidades', coalesce((select jsonb_agg(jsonb_build_object('slug', c.slug, 'nome', c.nome, 'modero', interno.rede_p4_ac_modera(c.slug, v)) order by c.nome)
                               from rede_comunidades c where interno.rede2_na_comunidade(c.slug, v)), '[]'::jsonb),
    -- As organizações que eu giro (só as minhas, com o selo de cada uma).
    'orgs', coalesce((select jsonb_agg(interno.rede_p4_ac_org_json(g.org) order by f.rede_handle)
                        from rede_org_gestores g join perfis f on f.id = g.org where g.gestor = v and not f.suspenso), '[]'::jsonb));
end $$;

-- ═══ Item 89 · Pressão em parlamentar ════════════════════════════════════════════════════════════════════════════════════
-- A mediação da comunidade monta a pressão: quem é o alvo, a mensagem pronta e os contatos OFICIAIS públicos (e-mail e site só em
-- domínio .leg.br, .gov.br, .jus.br ou .mp.br; telefone só fixo, o do gabinete). Cada pessoa manda do próprio aparelho (o e-mail
-- abre no programa dela; nada passa pela Alumia) e, se quiser, marca "mandei". O total aparece só a partir de 3. Para não contar a
-- mesma pessoa duas vezes, o banco guarda uma MARCA, nunca a conta: o HMAC-SHA-256 que o SERVIDOR DO SITE calcula com o segredo do
-- voto (ALUMIA_VOTO_SEGREDO, que nunca vai ao banco; lib/rede/voto/servidor.ts, tipo "pressao"), como no "pouco útil" das respostas
-- (20261127-p4-pontes.sql) e nas enquetes. O "mandei" e "as minhas" chegam só pelo servidor do site (chave de serviço, rota
-- app/api/alumia/voto/marca). Ao encerrar, as marcas somem e só o total fica.
-- A primeira versão do lote guardava um sal na linha da pressão e calculava sha256(sal ‖ conta) no banco: enquanto a pressão estava
-- aberta, quem abrisse o SQL Editor recalculava a marca de cada conta e descobria quem mandou (o mesmo desenho do achado M1 da
-- auditoria do P4). O sal e a função saem; num banco que já tinha o sal, as marcas antigas (que o sal ligava às contas) saem uma vez
-- e a contagem das pressões abertas recomeça (o lote nunca rodou em produção).
create table if not exists interno.rede_p4_pressoes (
  id uuid primary key default gen_random_uuid(),
  comunidade text not null references interno.rede_comunidades (slug) on delete cascade on update cascade,
  alvo text not null check (char_length(alvo) between 3 and 120),
  cargo text not null default '' check (char_length(cargo) <= 80),
  assunto text not null check (char_length(assunto) between 3 and 140),
  mensagem text not null check (char_length(mensagem) between 20 and 2000),
  contatos jsonb not null default '[]'::jsonb check (jsonb_typeof(contatos) = 'array' and jsonb_array_length(contatos) between 1 and 6),
  feitas integer not null default 0 check (feitas >= 0),
  encerrada boolean not null default false,
  criada_em timestamptz not null default now()
);
create index if not exists rede_p4_pressoes_comunidade on interno.rede_p4_pressoes (comunidade, criada_em desc);

-- A marca de quem já mandou: só para não contar duas vezes. Não é a conta; some quando a pressão encerra.
create table if not exists interno.rede_p4_pressao_marcas (
  pressao uuid not null references interno.rede_p4_pressoes (id) on delete cascade,
  marca bytea not null check (octet_length(marca) = 32),
  primary key (pressao, marca)
);

-- Num banco com a primeira versão (o sal na linha da pressão): as marcas antigas saem, a contagem das abertas recomeça e o sal sai
-- (com ele sai a restrição que o ligava ao "encerrada"). Uma vez só: depois disso a coluna não existe mais.
do $$
begin
  if exists (select 1 from information_schema.columns where table_schema = 'interno' and table_name = 'rede_p4_pressoes' and column_name = 'sal') then
    delete from interno.rede_p4_pressao_marcas;
    update interno.rede_p4_pressoes set feitas = 0 where not encerrada;
    alter table interno.rede_p4_pressoes drop column sal;
  end if;
end $$;
drop function if exists public.rede_p4_pressao_mandei(uuid, boolean);
drop function if exists interno.rede_p4_pressao_marca(bytea, uuid);

do $$
declare t text;
begin
  foreach t in array array['rede_p4_pressoes', 'rede_p4_pressao_marcas'] loop
    execute format('alter table interno.%I enable row level security', t);
    execute format('revoke all on table interno.%I from public', t);
    if exists (select 1 from pg_roles where rolname = 'anon') then execute format('revoke all on table interno.%I from anon, authenticated', t); end if;
  end loop;
end $$;

/** Um contato oficial: {tipo: email | telefone | site, valor}. E-mail e site só em domínio público; telefone só fixo. */
create or replace function interno.rede_p4_pressao_contato(p jsonb) returns jsonb language plpgsql immutable set search_path = interno, pg_temp as $$
declare v_tipo text := coalesce(p ->> 'tipo', ''); v text := btrim(coalesce(p ->> 'valor', '')); v_dom text;
begin
  if v_tipo = 'email' then
    v := lower(v);
    if v !~ '^[a-z0-9._%+-]{1,64}@([a-z0-9-]+\.)+(leg|gov|jus|mp)\.br$' then perform interno.erro('invalido:contato'); end if;
  elsif v_tipo = 'telefone' then
    v := regexp_replace(v, '[^0-9]', '', 'g');
    -- Só fixo, com DDD: (DD) 2xxx a 5xxx. Celular (9 na frente) é recusado: o contato oficial é o do gabinete.
    if v !~ '^[1-9][0-9][2-5][0-9]{7}$' then perform interno.erro('invalido:contato'); end if;
  elsif v_tipo = 'site' then
    v := interno.rede_p4_ac_link(v);
    v_dom := lower(substring(v from '^https://([^/:]+)'));
    if v is null or v_dom !~ '(^|\.)(leg|gov|jus|mp)\.br$' then perform interno.erro('invalido:contato'); end if;
  else
    perform interno.erro('invalido:contato');
  end if;
  return jsonb_build_object('tipo', v_tipo, 'valor', v);
end $$;

/** A mediação cria a pressão. p: {comunidade, alvo, cargo, assunto, mensagem, contatos: [{tipo, valor}]}. */
create or replace function public.rede_p4_pressao_criar(p jsonb) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid; v_slug text; v_contatos jsonb := '[]'::jsonb; c jsonb; v_id uuid;
begin
  perform interno.alumia_porta();
  v := interno.rede_p4_ac_eu();
  v_slug := interno.rede_p4_ac_mediacao(p ->> 'comunidade', v);
  if jsonb_typeof(p -> 'contatos') is distinct from 'array' or jsonb_array_length(p -> 'contatos') not between 1 and 6 then perform interno.erro('invalido:contato'); end if;
  for c in select * from jsonb_array_elements(p -> 'contatos') loop
    v_contatos := v_contatos || jsonb_build_array(interno.rede_p4_pressao_contato(c));
  end loop;
  perform interno.limite('alumia_p4_pressao', 20, 1440);
  insert into rede_p4_pressoes (comunidade, alvo, cargo, assunto, mensagem, contatos)
  values (v_slug, interno.rede_p4_ac_campo(p ->> 'alvo', 'alvo', 3, 120), interno.rede_p4_ac_campo(p ->> 'cargo', 'cargo', 0, 80),
          interno.rede_p4_ac_campo(p ->> 'assunto', 'assunto', 3, 140), interno.rede_p4_ac_campo(p ->> 'mensagem', 'mensagem', 20, 2000),
          v_contatos)
  returning id into v_id;
  return public.rede_p4_pressoes(v_slug);
end $$;

/**
 * As pressões de uma comunidade: o alvo, a mensagem, os contatos e o total (só a partir de 3). Se eu já mandei, o aparelho pergunta
 * ao servidor do site (public.rede_p4_pressao_minhas): o banco não sabe calcular a marca de ninguém.
 */
create or replace function public.rede_p4_pressoes(p_comunidade text) returns jsonb language plpgsql stable security definer set search_path = interno, pg_temp as $$
declare v uuid; v_slug text := lower(btrim(coalesce(p_comunidade, '')));
begin
  perform interno.alumia_porta();
  v := interno.rede_p4_ac_eu();
  if not interno.rede_p4_ac_ve_comunidade(v_slug, v) then perform interno.erro('nao_encontrado'); end if;
  return jsonb_build_object(
    'comunidade', v_slug,
    'modero', interno.rede_p4_ac_modera(v_slug, v),
    'pressoes', coalesce((select jsonb_agg(jsonb_build_object(
        'id', x.id, 'alvo', x.alvo, 'cargo', x.cargo, 'assunto', x.assunto, 'mensagem', x.mensagem, 'contatos', x.contatos,
        'encerrada', x.encerrada, 'total', interno.rede_p4_ac_pessoas(x.feitas))
        order by x.encerrada, x.criada_em desc)
      from rede_p4_pressoes x where x.comunidade = v_slug), '[]'::jsonb));
end $$;

/**
 * Para o servidor do site (só a chave de serviço; app/api/alumia/voto/marca, tipo "pressao"): "mandei" (p_sim) ou "desfazer". As
 * regras são conferidas com a pessoa que o servidor mandou (interruptor ligado, membro da Alumia, vê a comunidade); gravada fica só a
 * marca (64 letras hexadecimais, o HMAC do servidor). Só conta uma vez por pessoa; desfazer tira a marca e desconta. Devolve só a
 * marca da própria pessoa ({eu}) e a comunidade (para o aparelho ler a lista de novo); nunca quem mandou. O freio é o do servidor (uma
 * linha de freio aqui, com a pessoa, ligaria a ela o "mandei").
 */
create or replace function public.rede_p4_pressao_mandei(p_usuario uuid, p_id uuid, p_sim boolean, p_marca text) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare x rede_p4_pressoes; v_marca bytea;
begin
  if not interno.servico() then perform interno.erro('sem_permissao'); end if;
  if p_marca is null or p_marca !~ '^[0-9a-f]{64}$' then perform interno.erro('invalido:marca'); end if;
  v_marca := decode(p_marca, 'hex');
  if not interno.rede_p4_ac_ligado() then perform interno.erro('desligado'); end if;
  if p_usuario is null or not exists (select 1 from perfis where id = p_usuario and not suspenso) or not interno.rede2_membro(p_usuario) then
    perform interno.erro('sem_permissao');
  end if;
  select * into x from rede_p4_pressoes where id = p_id for update;
  if not found or not interno.rede_p4_ac_ve_comunidade(x.comunidade, p_usuario) then perform interno.erro('nao_encontrado'); end if;
  if x.encerrada then perform interno.erro('encerrada'); end if;
  if coalesce(p_sim, false) then
    insert into rede_p4_pressao_marcas (pressao, marca) values (p_id, v_marca) on conflict do nothing;
    if found then update rede_p4_pressoes set feitas = feitas + 1 where id = p_id; end if;
  else
    delete from rede_p4_pressao_marcas where pressao = p_id and marca = v_marca;
    if found then update rede_p4_pressoes set feitas = greatest(feitas - 1, 0) where id = p_id; end if;
  end if;
  return jsonb_build_object('eu', exists (select 1 from rede_p4_pressao_marcas where pressao = p_id and marca = v_marca), 'comunidade', x.comunidade);
end $$;

/**
 * Para o servidor do site (só a chave de serviço; tipo "pressao_ver"): destas pressões (ids e as marcas da pessoa, que o servidor
 * calculou), em quais ela marcou "mandei" (só o dela, para o botão ficar marcado). Até 100. Com o lote desligado, nenhuma.
 */
create or replace function public.rede_p4_pressao_minhas(p_marcas jsonb) returns jsonb language plpgsql stable security definer set search_path = interno, pg_temp as $$
begin
  if not interno.servico() then perform interno.erro('sem_permissao'); end if;
  if jsonb_typeof(p_marcas) is distinct from 'object' or not interno.rede_p4_ac_ligado() then return '[]'::jsonb; end if;
  return coalesce((
    select jsonb_agg(k.key) from (select * from jsonb_each_text(p_marcas) limit 100) k
    where k.key ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' and k.value ~ '^[0-9a-f]{64}$'
      and exists (select 1 from rede_p4_pressao_marcas m where m.pressao = k.key::uuid and m.marca = decode(k.value, 'hex'))), '[]'::jsonb);
end $$;

/** A mediação encerra: as marcas somem; o total fica. */
create or replace function public.rede_p4_pressao_encerrar(p_id uuid) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid; x rede_p4_pressoes;
begin
  perform interno.alumia_porta();
  v := interno.rede_p4_ac_eu();
  select * into x from rede_p4_pressoes where id = p_id for update;
  if not found or not interno.rede_p4_ac_modera(x.comunidade, v) then perform interno.erro('nao_encontrado'); end if;
  delete from rede_p4_pressao_marcas where pressao = p_id;
  update rede_p4_pressoes set encerrada = true where id = p_id;
  return public.rede_p4_pressoes(x.comunidade);
end $$;

do $$
declare f text;
  v_internas text[] := array['rede_p4_pressao_contato(jsonb)'];
  v_pessoa text[] := array['rede_p4_ac_minhas()', 'rede_p4_pressao_criar(jsonb)', 'rede_p4_pressoes(text)', 'rede_p4_pressao_encerrar(uuid)'];
  -- O "mandei" e "as minhas": só a chave de serviço (o servidor do site, que calcula a marca).
  v_servico text[] := array['rede_p4_pressao_mandei(uuid, uuid, boolean, text)', 'rede_p4_pressao_minhas(jsonb)'];
begin
  foreach f in array v_internas loop
    execute format('revoke all on function interno.%s from public', f);
    if exists (select 1 from pg_roles where rolname = 'anon') then execute format('revoke all on function interno.%s from anon, authenticated', f); end if;
  end loop;
  foreach f in array v_pessoa loop
    execute format('revoke all on function public.%s from public', f);
    if exists (select 1 from pg_roles where rolname = 'anon') then
      execute format('revoke all on function public.%s from anon', f);
      execute format('grant execute on function public.%s to authenticated, service_role', f);
    end if;
  end loop;
  foreach f in array v_servico loop
    execute format('revoke all on function public.%s from public', f);
    if exists (select 1 from pg_roles where rolname = 'anon') then
      execute format('revoke all on function public.%s from anon, authenticated', f);
      execute format('grant execute on function public.%s to service_role', f);
    end if;
  end loop;
end $$;

-- ═══ Item 92 · Campanha de cartas de solidariedade ══════════════════════════════════════════════════════════════════════
-- A mediação abre a campanha para alguém preso, demitido ou ameaçado (só o nome PÚBLICO ou como a pessoa pede para ser chamada, e
-- nunca endereço: a mediação entrega por fora, pelo caminho que ela combinou). Cada pessoa da comunidade escreve uma carta, assinada
-- com o codinome ou sem assinatura; a mediação aprova antes da entrega e baixa só as aprovadas, para imprimir. O banco guarda quem
-- escreveu só para a pessoa ver e apagar a própria carta (nunca sai para outra pessoa, nem para a mediação). PENDÊNCIA JURÍDICA: o
-- consentimento de quem recebe, as regras de correspondência de presídio e a guarda das cartas (o relatório do lote tem as opções);
-- até lá o interruptor fica desligado.
create table if not exists interno.rede_p4_cartas_campanhas (
  id uuid primary key default gen_random_uuid(),
  comunidade text not null references interno.rede_comunidades (slug) on delete cascade on update cascade,
  para text not null check (char_length(para) between 3 and 120),
  situacao text not null check (situacao in ('presa', 'demitida', 'ameacada', 'outra')),
  sobre text not null default '' check (char_length(sobre) <= 1000),
  -- Como a mediação vai entregar, em palavras (sem endereço): "na visita de domingo", "pelo sindicato".
  entrega text not null default '' check (char_length(entrega) <= 300),
  encerrada boolean not null default false,
  criada_em timestamptz not null default now()
);
create index if not exists rede_p4_cartas_campanhas_comunidade on interno.rede_p4_cartas_campanhas (comunidade, criada_em desc);

-- As cartas de solidariedade (item 92): o texto e a assinatura escolhida; quem escreveu fica só para ela ver e apagar a dela.
create table if not exists interno.rede_p4_cartas (
  id uuid primary key default gen_random_uuid(),
  campanha uuid not null references interno.rede_p4_cartas_campanhas (id) on delete cascade,
  -- Quem escreveu: só para a própria pessoa ver e apagar a dela e para o limite. NUNCA sai do banco para outra pessoa.
  autor uuid not null references interno.perfis (id) on delete cascade,
  texto text not null check (char_length(texto) between 20 and 3000),
  -- A assinatura escolhida: o codinome de quando escreveu, ou vazio ("Uma pessoa da Alumia").
  assinatura text not null default '' check (char_length(assinatura) <= 60),
  estado text not null default 'pendente' check (estado in ('pendente', 'aprovada')),
  criada_dia date not null default current_date
);
create index if not exists rede_p4_cartas_campanha on interno.rede_p4_cartas (campanha, estado);
create index if not exists rede_p4_cartas_autor on interno.rede_p4_cartas (autor);

do $$
declare t text;
begin
  foreach t in array array['rede_p4_cartas_campanhas', 'rede_p4_cartas'] loop
    execute format('alter table interno.%I enable row level security', t);
    execute format('revoke all on table interno.%I from public', t);
    if exists (select 1 from pg_roles where rolname = 'anon') then execute format('revoke all on table interno.%I from anon, authenticated', t); end if;
  end loop;
end $$;

/** A mediação abre a campanha. p: {comunidade, para, situacao, sobre, entrega}. */
create or replace function public.rede_p4_carta_campanha(p jsonb) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid; v_slug text; v_sit text := coalesce(p ->> 'situacao', '');
begin
  perform interno.alumia_porta();
  v := interno.rede_p4_ac_eu();
  v_slug := interno.rede_p4_ac_mediacao(p ->> 'comunidade', v);
  if v_sit not in ('presa', 'demitida', 'ameacada', 'outra') then perform interno.erro('invalido:situacao'); end if;
  perform interno.limite('alumia_p4_cartas_campanha', 10, 1440);
  insert into rede_p4_cartas_campanhas (comunidade, para, situacao, sobre, entrega)
  values (v_slug, interno.rede_p4_ac_campo(p ->> 'para', 'para', 3, 120), v_sit, interno.rede_p4_ac_campo(p ->> 'sobre', 'sobre', 0, 1000),
          interno.rede_p4_ac_campo(p ->> 'entrega', 'entrega', 0, 300));
  return public.rede_p4_cartas(v_slug);
end $$;

/**
 * As campanhas de uma comunidade: para quem, o total de cartas aprovadas (só a partir de 3), as minhas cartas (o texto e o estado)
 * e, para a mediação, a fila (o texto e a assinatura escolhida, sem quem escreveu).
 */
create or replace function public.rede_p4_cartas(p_comunidade text) returns jsonb language plpgsql stable security definer set search_path = interno, pg_temp as $$
declare v uuid; v_slug text := lower(btrim(coalesce(p_comunidade, ''))); v_mod boolean;
begin
  perform interno.alumia_porta();
  v := interno.rede_p4_ac_eu();
  if not interno.rede_p4_ac_ve_comunidade(v_slug, v) then perform interno.erro('nao_encontrado'); end if;
  v_mod := interno.rede_p4_ac_modera(v_slug, v);
  return jsonb_build_object(
    'comunidade', v_slug,
    'modero', v_mod,
    'posso_escrever', interno.rede2_na_comunidade(v_slug, v),
    'campanhas', coalesce((select jsonb_agg(jsonb_build_object(
        'id', c.id, 'para', c.para, 'situacao', c.situacao, 'sobre', c.sobre, 'entrega', c.entrega, 'encerrada', c.encerrada,
        'aprovadas', interno.rede_p4_ac_pessoas((select count(*) from rede_p4_cartas k where k.campanha = c.id and k.estado = 'aprovada')),
        'minhas', coalesce((select jsonb_agg(jsonb_build_object('id', k.id, 'texto', k.texto, 'assinatura', k.assinatura, 'estado', k.estado) order by k.criada_dia)
                              from rede_p4_cartas k where k.campanha = c.id and k.autor = v), '[]'::jsonb),
        'fila', case when v_mod then coalesce((select jsonb_agg(jsonb_build_object('id', k.id, 'texto', k.texto, 'assinatura', k.assinatura) order by k.id)
                                                from rede_p4_cartas k where k.campanha = c.id and k.estado = 'pendente'), '[]'::jsonb) else '[]'::jsonb end)
        order by c.encerrada, c.criada_em desc)
      from rede_p4_cartas_campanhas c where c.comunidade = v_slug), '[]'::jsonb));
end $$;

/** Escrever uma carta. p: {campanha, texto, assinar: boolean}. Só quem é da comunidade; até 3 cartas por campanha. */
create or replace function public.rede_p4_carta_escrever(p jsonb) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid; c rede_p4_cartas_campanhas; v_assina text := '';
begin
  perform interno.alumia_porta();
  v := interno.rede_p4_ac_eu();
  select * into c from rede_p4_cartas_campanhas where id = (p ->> 'campanha')::uuid;
  if not found or not interno.rede_p4_ac_ve_comunidade(c.comunidade, v) then perform interno.erro('nao_encontrado'); end if;
  if not interno.rede2_na_comunidade(c.comunidade, v) then perform interno.erro('sem_permissao'); end if;
  if c.encerrada then perform interno.erro('encerrada'); end if;
  if (select count(*) from rede_p4_cartas where campanha = c.id and autor = v) >= 3 then perform interno.erro('limite'); end if;
  if coalesce((p ->> 'assinar')::boolean, false) then v_assina := left(coalesce(interno.rede_nome(v), ''), 60); end if;
  perform interno.limite('alumia_p4_carta', 20, 1440);
  insert into rede_p4_cartas (campanha, autor, texto, assinatura)
  values (c.id, v, interno.rede_p4_ac_campo(p ->> 'texto', 'texto', 20, 3000), v_assina);
  return public.rede_p4_cartas(c.comunidade);
end $$;

/** Apagar a própria carta (antes ou depois da aprovação, enquanto a campanha está aberta). */
create or replace function public.rede_p4_carta_apagar(p_id uuid) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid; v_slug text;
begin
  perform interno.alumia_porta();
  v := interno.rede_p4_ac_eu();
  select c.comunidade into v_slug from rede_p4_cartas k join rede_p4_cartas_campanhas c on c.id = k.campanha where k.id = p_id and k.autor = v;
  if v_slug is null then perform interno.erro('nao_encontrado'); end if;
  delete from rede_p4_cartas where id = p_id and autor = v;
  return public.rede_p4_cartas(v_slug);
end $$;

/** A mediação aprova (vai para a entrega) ou recusa (a carta some). */
create or replace function public.rede_p4_carta_decidir(p_id uuid, p_aprovar boolean) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid; v_slug text;
begin
  perform interno.alumia_porta();
  v := interno.rede_p4_ac_eu();
  select c.comunidade into v_slug from rede_p4_cartas k join rede_p4_cartas_campanhas c on c.id = k.campanha where k.id = p_id and k.estado = 'pendente';
  if v_slug is null or not interno.rede_p4_ac_modera(v_slug, v) then perform interno.erro('nao_encontrado'); end if;
  perform interno.limite('alumia_p4_carta_mod', 300, 60);
  if coalesce(p_aprovar, false) then update rede_p4_cartas set estado = 'aprovada' where id = p_id;
  else delete from rede_p4_cartas where id = p_id; end if;
  return public.rede_p4_cartas(v_slug);
end $$;

/** A entrega: as cartas aprovadas (texto e assinatura), em ordem sem sentido, para a mediação imprimir. Nunca quem escreveu. */
create or replace function public.rede_p4_carta_entrega(p_campanha uuid) returns jsonb language plpgsql stable security definer set search_path = interno, pg_temp as $$
declare v uuid; c rede_p4_cartas_campanhas;
begin
  perform interno.alumia_porta();
  v := interno.rede_p4_ac_eu();
  select * into c from rede_p4_cartas_campanhas where id = p_campanha;
  if not found or not interno.rede_p4_ac_modera(c.comunidade, v) then perform interno.erro('nao_encontrado'); end if;
  return jsonb_build_object('para', c.para, 'cartas', coalesce((select jsonb_agg(jsonb_build_object('texto', k.texto, 'assinatura', k.assinatura) order by k.id)
                                                                 from rede_p4_cartas k where k.campanha = c.id and k.estado = 'aprovada'), '[]'::jsonb));
end $$;

/** A mediação encerra a campanha (ou reabre). Encerrada, ninguém escreve; as cartas continuam até a mediação apagar a campanha. */
create or replace function public.rede_p4_carta_encerrar(p_campanha uuid, p_apagar boolean) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid; c rede_p4_cartas_campanhas;
begin
  perform interno.alumia_porta();
  v := interno.rede_p4_ac_eu();
  select * into c from rede_p4_cartas_campanhas where id = p_campanha for update;
  if not found or not interno.rede_p4_ac_modera(c.comunidade, v) then perform interno.erro('nao_encontrado'); end if;
  if coalesce(p_apagar, false) then delete from rede_p4_cartas_campanhas where id = c.id;
  else update rede_p4_cartas_campanhas set encerrada = true where id = c.id; end if;
  return public.rede_p4_cartas(c.comunidade);
end $$;

do $$
declare f text;
  v_pessoa text[] := array['rede_p4_carta_campanha(jsonb)', 'rede_p4_cartas(text)', 'rede_p4_carta_escrever(jsonb)', 'rede_p4_carta_apagar(uuid)',
    'rede_p4_carta_decidir(uuid, boolean)', 'rede_p4_carta_entrega(uuid)', 'rede_p4_carta_encerrar(uuid, boolean)'];
begin
  foreach f in array v_pessoa loop
    execute format('revoke all on function public.%s from public', f);
    if exists (select 1 from pg_roles where rolname = 'anon') then
      execute format('revoke all on function public.%s from anon', f);
      execute format('grant execute on function public.%s to authenticated, service_role', f);
    end if;
  end loop;
end $$;

-- ═══ Item 93 · Questionário da base ════════════════════════════════════════════════════════════════════════════════════
-- A mediação monta um questionário de até 12 perguntas (uma escolha, várias escolhas, escala de 1 a 5 ou resposta aberta). Cada
-- pessoa da comunidade responde uma vez. As respostas NÃO levam a conta nem a hora: quem respondeu fica numa tabela à parte só para
-- não responder duas vezes, sem ligação com as respostas. O relatório só sai somado, quando há 3 respostas ou mais, e cada opção
-- com menos de 3 aparece como "menos de 3"; as respostas abertas só a mediação lê, embaralhadas.
create table if not exists interno.rede_p4_questionarios (
  id uuid primary key default gen_random_uuid(),
  comunidade text not null references interno.rede_comunidades (slug) on delete cascade on update cascade,
  titulo text not null check (char_length(titulo) between 3 and 120),
  sobre text not null default '' check (char_length(sobre) <= 600),
  -- [{tipo: escolha | varias | escala | aberta, texto, opcoes: [..]}], na ordem; o número da pergunta é a posição (0 a 11).
  perguntas jsonb not null check (jsonb_typeof(perguntas) = 'array' and jsonb_array_length(perguntas) between 1 and 12),
  aberto boolean not null default true,
  criado_em timestamptz not null default now()
);
create index if not exists rede_p4_questionarios_comunidade on interno.rede_p4_questionarios (comunidade, criado_em desc);

-- Quem já respondeu: só para não responder duas vezes. Sem hora e sem ligação com as respostas.
create table if not exists interno.rede_p4_quest_responderam (
  questionario uuid not null references interno.rede_p4_questionarios (id) on delete cascade,
  quem uuid not null references interno.perfis (id) on delete cascade,
  primary key (questionario, quem)
);

-- As respostas, soltas: a pergunta, a opção (escolha e várias), o valor (escala) ou o texto (aberta). Sem conta e sem hora.
create table if not exists interno.rede_p4_quest_respostas (
  id uuid primary key default gen_random_uuid(),
  questionario uuid not null references interno.rede_p4_questionarios (id) on delete cascade,
  pergunta smallint not null check (pergunta between 0 and 11),
  opcao smallint check (opcao is null or opcao between 0 and 9),
  valor smallint check (valor is null or valor between 1 and 5),
  texto text check (texto is null or char_length(texto) between 1 and 1000),
  check (num_nonnulls(opcao, valor, texto) = 1)
);
create index if not exists rede_p4_quest_respostas_q on interno.rede_p4_quest_respostas (questionario, pergunta);

do $$
declare t text;
begin
  foreach t in array array['rede_p4_questionarios', 'rede_p4_quest_responderam', 'rede_p4_quest_respostas'] loop
    execute format('alter table interno.%I enable row level security', t);
    execute format('revoke all on table interno.%I from public', t);
    if exists (select 1 from pg_roles where rolname = 'anon') then execute format('revoke all on table interno.%I from anon, authenticated', t); end if;
  end loop;
end $$;

/** As perguntas como a mediação mandou, conferidas: tipo conhecido, texto de 3 a 200, de 2 a 10 opções (escolha e várias). */
create or replace function interno.rede_p4_quest_perguntas(p jsonb) returns jsonb language plpgsql stable set search_path = interno, pg_temp as $$
declare q jsonb; v_saida jsonb := '[]'::jsonb; v_tipo text; v_ops jsonb; o jsonb;
begin
  if jsonb_typeof(p) is distinct from 'array' or jsonb_array_length(p) not between 1 and 12 then perform interno.erro('invalido:perguntas'); end if;
  for q in select * from jsonb_array_elements(p) loop
    v_tipo := coalesce(q ->> 'tipo', '');
    if v_tipo not in ('escolha', 'varias', 'escala', 'aberta') then perform interno.erro('invalido:perguntas'); end if;
    v_ops := '[]'::jsonb;
    if v_tipo in ('escolha', 'varias') then
      if jsonb_typeof(q -> 'opcoes') is distinct from 'array' or jsonb_array_length(q -> 'opcoes') not between 2 and 10 then perform interno.erro('invalido:opcoes'); end if;
      for o in select * from jsonb_array_elements(q -> 'opcoes') loop
        v_ops := v_ops || to_jsonb(interno.rede_p4_ac_campo(o #>> '{}', 'opcoes', 1, 80));
      end loop;
    end if;
    v_saida := v_saida || jsonb_build_array(jsonb_build_object('tipo', v_tipo, 'texto', interno.rede_p4_ac_campo(q ->> 'texto', 'perguntas', 3, 200), 'opcoes', v_ops));
  end loop;
  return v_saida;
end $$;

/** O relatório somado de um questionário. Nulo com menos de 3 respostas; cada contagem abaixo de 3 sai nula ("menos de 3"). */
create or replace function interno.rede_p4_quest_relatorio(p_id uuid, p_mediacao boolean) returns jsonb language plpgsql stable security definer set search_path = interno, pg_temp as $$
declare q rede_p4_questionarios; v_n bigint; v_saida jsonb := '[]'::jsonb; v_i integer := 0; x jsonb;
begin
  select * into q from rede_p4_questionarios where id = p_id;
  v_n := (select count(*) from rede_p4_quest_responderam where questionario = p_id);
  if v_n < 3 then return null; end if;
  for x in select * from jsonb_array_elements(q.perguntas) loop
    v_saida := v_saida || jsonb_build_array(jsonb_build_object(
      'tipo', x ->> 'tipo', 'texto', x ->> 'texto',
      'opcoes', case when x ->> 'tipo' in ('escolha', 'varias') then
          (select jsonb_agg(jsonb_build_object('opcao', o.valor, 'total', interno.rede_p4_ac_pessoas((select count(*) from rede_p4_quest_respostas r where r.questionario = p_id and r.pergunta = v_i and r.opcao = o.n - 1))) order by o.n)
             from jsonb_array_elements_text(x -> 'opcoes') with ordinality as o(valor, n)) end,
      'escala', case when x ->> 'tipo' = 'escala' then
          (select jsonb_agg(jsonb_build_object('valor', k, 'total', interno.rede_p4_ac_pessoas((select count(*) from rede_p4_quest_respostas r where r.questionario = p_id and r.pergunta = v_i and r.valor = k))) order by k)
             from generate_series(1, 5) k) end,
      -- As abertas: só a mediação lê, embaralhadas (a ordem não diz quem respondeu primeiro).
      'abertas', case when x ->> 'tipo' = 'aberta' and p_mediacao then
          coalesce((select jsonb_agg(r.texto order by r.id) from rede_p4_quest_respostas r where r.questionario = p_id and r.pergunta = v_i and r.texto is not null), '[]'::jsonb) end,
      'abertas_total', case when x ->> 'tipo' = 'aberta' then
          interno.rede_p4_ac_pessoas((select count(*) from rede_p4_quest_respostas r where r.questionario = p_id and r.pergunta = v_i and r.texto is not null)) end));
    v_i := v_i + 1;
  end loop;
  return jsonb_build_object('respostas', interno.rede_p4_ac_pessoas(v_n), 'perguntas', v_saida);
end $$;

/** A mediação cria o questionário. p: {comunidade, titulo, sobre, perguntas}. */
create or replace function public.rede_p4_quest_criar(p jsonb) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid; v_slug text;
begin
  perform interno.alumia_porta();
  v := interno.rede_p4_ac_eu();
  v_slug := interno.rede_p4_ac_mediacao(p ->> 'comunidade', v);
  perform interno.limite('alumia_p4_quest', 10, 1440);
  insert into rede_p4_questionarios (comunidade, titulo, sobre, perguntas)
  values (v_slug, interno.rede_p4_ac_campo(p ->> 'titulo', 'titulo', 3, 120), interno.rede_p4_ac_campo(p ->> 'sobre', 'sobre', 0, 600),
          interno.rede_p4_quest_perguntas(p -> 'perguntas'));
  return public.rede_p4_questionarios(v_slug);
end $$;

/** Os questionários de uma comunidade: as perguntas, se já respondi e o relatório somado (nulo abaixo de 3). */
create or replace function public.rede_p4_questionarios(p_comunidade text) returns jsonb language plpgsql stable security definer set search_path = interno, pg_temp as $$
declare v uuid; v_slug text := lower(btrim(coalesce(p_comunidade, ''))); v_mod boolean;
begin
  perform interno.alumia_porta();
  v := interno.rede_p4_ac_eu();
  if not interno.rede_p4_ac_ve_comunidade(v_slug, v) then perform interno.erro('nao_encontrado'); end if;
  v_mod := interno.rede_p4_ac_modera(v_slug, v);
  return jsonb_build_object(
    'comunidade', v_slug, 'modero', v_mod, 'posso_responder', interno.rede2_na_comunidade(v_slug, v),
    'questionarios', coalesce((select jsonb_agg(jsonb_build_object(
        'id', q.id, 'titulo', q.titulo, 'sobre', q.sobre, 'perguntas', q.perguntas, 'aberto', q.aberto,
        'ja_respondi', exists (select 1 from rede_p4_quest_responderam r where r.questionario = q.id and r.quem = v),
        'relatorio', interno.rede_p4_quest_relatorio(q.id, v_mod))
        order by q.aberto desc, q.criado_em desc)
      from rede_p4_questionarios q where q.comunidade = v_slug), '[]'::jsonb));
end $$;

/**
 * Responder: p_respostas é uma lista na ordem das perguntas; cada item é o número da opção (escolha), a lista de números (várias),
 * o valor de 1 a 5 (escala), o texto (aberta) ou nulo (pular). Uma vez só por pessoa; não dá para mudar depois (não há ligação).
 */
create or replace function public.rede_p4_quest_responder(p_id uuid, p_respostas jsonb) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid; q rede_p4_questionarios; x jsonb; r jsonb; v_i integer := 0; v_n integer; o jsonb;
begin
  perform interno.alumia_porta();
  v := interno.rede_p4_ac_eu();
  select * into q from rede_p4_questionarios where id = p_id;
  if not found or not interno.rede_p4_ac_ve_comunidade(q.comunidade, v) then perform interno.erro('nao_encontrado'); end if;
  if not interno.rede2_na_comunidade(q.comunidade, v) then perform interno.erro('sem_permissao'); end if;
  if not q.aberto then perform interno.erro('encerrado'); end if;
  if jsonb_typeof(p_respostas) is distinct from 'array' or jsonb_array_length(p_respostas) <> jsonb_array_length(q.perguntas) then perform interno.erro('invalido:respostas'); end if;
  perform interno.limite('alumia_p4_quest_responder', 30, 60);
  insert into rede_p4_quest_responderam (questionario, quem) values (p_id, v) on conflict do nothing;
  if not found then perform interno.erro('ja_respondeu'); end if;
  for x in select * from jsonb_array_elements(q.perguntas) loop
    r := p_respostas -> v_i;
    v_n := jsonb_array_length(x -> 'opcoes');
    if r is not null and jsonb_typeof(r) <> 'null' then
      if x ->> 'tipo' = 'escolha' then
        if jsonb_typeof(r) <> 'number' or (r #>> '{}')::numeric not between 0 and v_n - 1 or (r #>> '{}')::numeric % 1 <> 0 then perform interno.erro('invalido:respostas'); end if;
        insert into rede_p4_quest_respostas (questionario, pergunta, opcao) values (p_id, v_i, (r #>> '{}')::smallint);
      elsif x ->> 'tipo' = 'varias' then
        if jsonb_typeof(r) <> 'array' or jsonb_array_length(r) > v_n then perform interno.erro('invalido:respostas'); end if;
        for o in select distinct value from jsonb_array_elements(r) loop
          if jsonb_typeof(o) <> 'number' or (o #>> '{}')::numeric not between 0 and v_n - 1 or (o #>> '{}')::numeric % 1 <> 0 then perform interno.erro('invalido:respostas'); end if;
          insert into rede_p4_quest_respostas (questionario, pergunta, opcao) values (p_id, v_i, (o #>> '{}')::smallint);
        end loop;
      elsif x ->> 'tipo' = 'escala' then
        if jsonb_typeof(r) <> 'number' or (r #>> '{}')::numeric not in (1, 2, 3, 4, 5) then perform interno.erro('invalido:respostas'); end if;
        insert into rede_p4_quest_respostas (questionario, pergunta, valor) values (p_id, v_i, (r #>> '{}')::smallint);
      else
        if jsonb_typeof(r) <> 'string' then perform interno.erro('invalido:respostas'); end if;
        if btrim(r #>> '{}') <> '' then
          insert into rede_p4_quest_respostas (questionario, pergunta, texto) values (p_id, v_i, interno.rede_p4_ac_campo(r #>> '{}', 'respostas', 1, 1000));
        end if;
      end if;
    end if;
    v_i := v_i + 1;
  end loop;
  return public.rede_p4_questionarios(q.comunidade);
end $$;

/** A mediação encerra (ou apaga, com as respostas). */
create or replace function public.rede_p4_quest_encerrar(p_id uuid, p_apagar boolean) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid; q rede_p4_questionarios;
begin
  perform interno.alumia_porta();
  v := interno.rede_p4_ac_eu();
  select * into q from rede_p4_questionarios where id = p_id for update;
  if not found or not interno.rede_p4_ac_modera(q.comunidade, v) then perform interno.erro('nao_encontrado'); end if;
  if coalesce(p_apagar, false) then delete from rede_p4_questionarios where id = p_id;
  else update rede_p4_questionarios set aberto = false where id = p_id; end if;
  return public.rede_p4_questionarios(q.comunidade);
end $$;

do $$
declare f text;
  v_internas text[] := array['rede_p4_quest_perguntas(jsonb)', 'rede_p4_quest_relatorio(uuid, boolean)'];
  v_pessoa text[] := array['rede_p4_quest_criar(jsonb)', 'rede_p4_questionarios(text)', 'rede_p4_quest_responder(uuid, jsonb)', 'rede_p4_quest_encerrar(uuid, boolean)'];
begin
  foreach f in array v_internas loop
    execute format('revoke all on function interno.%s from public', f);
    if exists (select 1 from pg_roles where rolname = 'anon') then execute format('revoke all on function interno.%s from anon, authenticated', f); end if;
  end loop;
  foreach f in array v_pessoa loop
    execute format('revoke all on function public.%s from public', f);
    if exists (select 1 from pg_roles where rolname = 'anon') then
      execute format('revoke all on function public.%s from anon', f);
      execute format('grant execute on function public.%s to authenticated, service_role', f);
    end if;
  end loop;
end $$;

-- ═══ Item 122 · Rodízio de tarefas ═════════════════════════════════════════════════════════════════════════════════════
-- A mediação cria uma escala recorrente (limpeza da sede, ata da reunião, cozinha do mutirão): a tarefa, a frequência (semanal,
-- quinzenal ou mensal) e o primeiro dia. Quem quiser entra no rodízio; a vez gira na ordem de entrada. Cada pessoa vê SÓ as próprias
-- vezes (as três próximas datas); ninguém vê a escala com nomes, nem a mediação: ela vê só se a vez de cada data tem alguém e quantas
-- pessoas estão no rodízio (a partir de 3). Combina-se a troca de vez por mensagem, como sempre. O kanban do item 52 é de outro
-- lote; quando ele existir, a tarefa da vez pode virar cartão (pendência registrada no relatório).
create table if not exists interno.rede_p4_rodizios (
  id uuid primary key default gen_random_uuid(),
  comunidade text not null references interno.rede_comunidades (slug) on delete cascade on update cascade,
  tarefa text not null check (char_length(tarefa) between 3 and 80),
  sobre text not null default '' check (char_length(sobre) <= 300),
  frequencia text not null check (frequencia in ('semanal', 'quinzenal', 'mensal')),
  comeca date not null,
  ativo boolean not null default true,
  criado_em timestamptz not null default now()
);
create index if not exists rede_p4_rodizios_comunidade on interno.rede_p4_rodizios (comunidade, ativo);

-- Quem está no rodízio e a ordem (o número da entrada). Nunca sai do banco: cada pessoa recebe só as próprias datas.
create table if not exists interno.rede_p4_rodizio_pessoas (
  rodizio uuid not null references interno.rede_p4_rodizios (id) on delete cascade,
  quem uuid not null references interno.perfis (id) on delete cascade,
  ordem bigint generated always as identity,
  primary key (rodizio, quem)
);

do $$
declare t text;
begin
  foreach t in array array['rede_p4_rodizios', 'rede_p4_rodizio_pessoas'] loop
    execute format('alter table interno.%I enable row level security', t);
    execute format('revoke all on table interno.%I from public', t);
    if exists (select 1 from pg_roles where rolname = 'anon') then execute format('revoke all on table interno.%I from anon, authenticated', t); end if;
  end loop;
end $$;

/** A data da vez k (0, 1, 2…) de um rodízio. */
create or replace function interno.rede_p4_rodizio_data(p_comeca date, p_frequencia text, p_k integer) returns date language sql immutable as $$
  select case p_frequencia when 'semanal' then p_comeca + 7 * p_k when 'quinzenal' then p_comeca + 14 * p_k
    else (p_comeca + make_interval(months => p_k))::date end
$$;

/** O número da vez de hoje (a primeira que ainda não passou). */
create or replace function interno.rede_p4_rodizio_agora(p_comeca date, p_frequencia text, p_hoje date) returns integer language sql immutable as $$
  select case when p_hoje <= p_comeca then 0
    when p_frequencia = 'semanal' then ceil((p_hoje - p_comeca) / 7.0)::integer
    when p_frequencia = 'quinzenal' then ceil((p_hoje - p_comeca) / 14.0)::integer
    else (select min(k) from generate_series(0, 1200) k where (p_comeca + make_interval(months => k))::date >= p_hoje) end
$$;

/** Um rodízio como sai para quem vê: as MINHAS três próximas vezes, se estou nele; quantas pessoas (a partir de 3). */
create or replace function interno.rede_p4_rodizio_json(p_id uuid, p_quem uuid) returns jsonb language plpgsql stable security definer set search_path = interno, pg_temp as $$
declare r rede_p4_rodizios; v_n integer; v_pos integer; v_k integer; v_minhas jsonb := '[]'::jsonb; v_i integer;
begin
  select * into r from rede_p4_rodizios where id = p_id;
  v_n := (select count(*) from rede_p4_rodizio_pessoas where rodizio = p_id);
  -- A minha posição (0 a n-1) na ordem de entrada.
  select x.pos into v_pos from (select quem, (row_number() over (order by ordem) - 1)::integer pos from rede_p4_rodizio_pessoas where rodizio = p_id) x where x.quem = p_quem;
  if v_pos is not null and r.ativo then
    v_k := interno.rede_p4_rodizio_agora(r.comeca, r.frequencia, current_date);
    -- A próxima vez minha é a primeira k >= agora com k mod n = pos; depois, de n em n.
    v_k := v_k + ((v_pos - v_k % v_n) % v_n + v_n) % v_n;
    for v_i in 0..2 loop
      v_minhas := v_minhas || to_jsonb(interno.rede_p4_rodizio_data(r.comeca, r.frequencia, v_k + v_i * v_n));
    end loop;
  end if;
  return jsonb_build_object('id', r.id, 'tarefa', r.tarefa, 'sobre', r.sobre, 'frequencia', r.frequencia, 'comeca', r.comeca, 'ativo', r.ativo,
    'estou', v_pos is not null, 'minhas_vezes', v_minhas, 'pessoas', interno.rede_p4_ac_pessoas(v_n), 'tem_gente', v_n > 0,
    'proxima', case when r.ativo then interno.rede_p4_rodizio_data(r.comeca, r.frequencia, interno.rede_p4_rodizio_agora(r.comeca, r.frequencia, current_date)) end);
end $$;

/** A mediação cria o rodízio. p: {comunidade, tarefa, sobre, frequencia, comeca (AAAA-MM-DD, de hoje até um ano)}. */
create or replace function public.rede_p4_rodizio_criar(p jsonb) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid; v_slug text; v_freq text := coalesce(p ->> 'frequencia', ''); v_dia date;
begin
  perform interno.alumia_porta();
  v := interno.rede_p4_ac_eu();
  v_slug := interno.rede_p4_ac_mediacao(p ->> 'comunidade', v);
  if v_freq not in ('semanal', 'quinzenal', 'mensal') then perform interno.erro('invalido:frequencia'); end if;
  begin
    v_dia := (p ->> 'comeca')::date;
  exception when others then
    perform interno.erro('invalido:data');
  end;
  if v_dia is null or v_dia < current_date or v_dia > current_date + 366 then perform interno.erro('invalido:data'); end if;
  perform interno.limite('alumia_p4_rodizio', 20, 1440);
  insert into rede_p4_rodizios (comunidade, tarefa, sobre, frequencia, comeca)
  values (v_slug, interno.rede_p4_ac_campo(p ->> 'tarefa', 'tarefa', 3, 80), interno.rede_p4_ac_campo(p ->> 'sobre', 'sobre', 0, 300), v_freq, v_dia);
  return public.rede_p4_rodizios(v_slug);
end $$;

/** Os rodízios de uma comunidade, cada um com as minhas vezes. */
create or replace function public.rede_p4_rodizios(p_comunidade text) returns jsonb language plpgsql stable security definer set search_path = interno, pg_temp as $$
declare v uuid; v_slug text := lower(btrim(coalesce(p_comunidade, '')));
begin
  perform interno.alumia_porta();
  v := interno.rede_p4_ac_eu();
  if not interno.rede_p4_ac_ve_comunidade(v_slug, v) then perform interno.erro('nao_encontrado'); end if;
  return jsonb_build_object('comunidade', v_slug, 'modero', interno.rede_p4_ac_modera(v_slug, v), 'posso_entrar', interno.rede2_na_comunidade(v_slug, v),
    'rodizios', coalesce((select jsonb_agg(interno.rede_p4_rodizio_json(r.id, v) order by r.ativo desc, r.criado_em desc)
                            from rede_p4_rodizios r where r.comunidade = v_slug), '[]'::jsonb));
end $$;

/** Entrar (p_sim) ou sair do rodízio. Só quem é da comunidade. Sair e entrar de novo põe a pessoa no fim da fila. */
create or replace function public.rede_p4_rodizio_entrar(p_id uuid, p_sim boolean) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid; r rede_p4_rodizios;
begin
  perform interno.alumia_porta();
  v := interno.rede_p4_ac_eu();
  select * into r from rede_p4_rodizios where id = p_id;
  if not found or not interno.rede_p4_ac_ve_comunidade(r.comunidade, v) then perform interno.erro('nao_encontrado'); end if;
  if not interno.rede2_na_comunidade(r.comunidade, v) then perform interno.erro('sem_permissao'); end if;
  perform interno.limite('alumia_p4_rodizio_entrar', 30, 60);
  if coalesce(p_sim, false) then
    if not r.ativo then perform interno.erro('encerrado'); end if;
    insert into rede_p4_rodizio_pessoas (rodizio, quem) values (p_id, v) on conflict do nothing;
  else
    delete from rede_p4_rodizio_pessoas where rodizio = p_id and quem = v;
  end if;
  return public.rede_p4_rodizios(r.comunidade);
end $$;

/** A mediação encerra o rodízio (as pessoas saem dele) ou apaga. */
create or replace function public.rede_p4_rodizio_encerrar(p_id uuid, p_apagar boolean) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid; r rede_p4_rodizios;
begin
  perform interno.alumia_porta();
  v := interno.rede_p4_ac_eu();
  select * into r from rede_p4_rodizios where id = p_id for update;
  if not found or not interno.rede_p4_ac_modera(r.comunidade, v) then perform interno.erro('nao_encontrado'); end if;
  if coalesce(p_apagar, false) then delete from rede_p4_rodizios where id = p_id;
  else
    update rede_p4_rodizios set ativo = false where id = p_id;
    delete from rede_p4_rodizio_pessoas where rodizio = p_id;
  end if;
  return public.rede_p4_rodizios(r.comunidade);
end $$;

do $$
declare f text;
  v_internas text[] := array['rede_p4_rodizio_data(date, text, integer)', 'rede_p4_rodizio_agora(date, text, date)', 'rede_p4_rodizio_json(uuid, uuid)'];
  v_pessoa text[] := array['rede_p4_rodizio_criar(jsonb)', 'rede_p4_rodizios(text)', 'rede_p4_rodizio_entrar(uuid, boolean)', 'rede_p4_rodizio_encerrar(uuid, boolean)'];
begin
  foreach f in array v_internas loop
    execute format('revoke all on function interno.%s from public', f);
    if exists (select 1 from pg_roles where rolname = 'anon') then execute format('revoke all on function interno.%s from anon, authenticated', f); end if;
  end loop;
  foreach f in array v_pessoa loop
    execute format('revoke all on function public.%s from public', f);
    if exists (select 1 from pg_roles where rolname = 'anon') then
      execute format('revoke all on function public.%s from anon', f);
      execute format('grant execute on function public.%s to authenticated, service_role', f);
    end if;
  end loop;
end $$;

-- ═══ Item 95 · Selos de acessibilidade do ato (e a ficha do ato do lote) ═══════════════════════════════════════════════════
-- Quem organiza o ato marca o que o lugar oferece: acesso para cadeira de rodas, intérprete de Libras, banheiro e sombra (ou
-- lugar coberto). Quem pode ver o ato vê os selos. A ficha do ato (interno.rede_p4_ato_json) também serve à ciranda (96), ao
-- panfleto (94) e à previsão do tempo (97), sem copiar o texto do post: só o título, a data, a cidade e o ponto público do chamado.
create table if not exists interno.rede_p4_ato_acess (
  ato uuid primary key references interno.rede_chamados (post) on delete cascade,
  selos text[] not null default '{}' check (selos <@ array['cadeira', 'libras', 'banheiro', 'sombra']::text[]),
  atualizado_em timestamptz not null default now()
);

do $$
begin
  alter table interno.rede_p4_ato_acess enable row level security;
  revoke all on table interno.rede_p4_ato_acess from public;
  if exists (select 1 from pg_roles where rolname = 'anon') then revoke all on table interno.rede_p4_ato_acess from anon, authenticated; end if;
end $$;

/**
 * A ficha de um ato para quem pode vê-lo (interno.rede_ato_achar confere rede_ve): título, início, cidade, ponto, situação, se eu
 * organizo, os selos e a ciranda (quando houver a tabela do item 96). Nunca o texto do post, nunca quem confirmou.
 */
create or replace function interno.rede_p4_ato_json(p_ato uuid, p_quem uuid) returns jsonb language plpgsql stable security definer set search_path = interno, pg_temp as $$
declare p rede_posts; c rede_chamados; v_org boolean; v_cir jsonb;
begin
  p := interno.rede_ato_achar(p_ato, p_quem);
  if p.oculto or p.retido then perform interno.erro('nao_encontrado'); end if;
  select * into c from rede_chamados where post = p_ato;
  v_org := interno.rede_ato_organiza(p_ato, p_quem);
  if to_regclass('interno.rede_p4_cirandas') is not null then
    execute 'select interno.rede_p4_ciranda_json($1, $2, $3)' into v_cir using p_ato, p_quem, v_org;
  end if;
  return jsonb_build_object(
    'id', p_ato, 'titulo', coalesce(c.titulo, ''), 'inicio', c.inicio, 'fim', c.fim, 'cidade', c.cidade, 'ponto', c.ponto, 'tipo', c.tipo,
    'situacao', c.situacao, 'aberto_internet', p.publico = 'internet', 'organizo', v_org,
    'selos', coalesce((select to_jsonb(a.selos) from rede_p4_ato_acess a where a.ato = p_ato), '[]'::jsonb),
    'ciranda', v_cir);
end $$;

/** A ficha de um ato (para a tela do lote: selos, ciranda, panfleto e tempo). */
create or replace function public.rede_p4_ato(p_ato uuid) returns jsonb language plpgsql volatile security definer set search_path = interno, pg_temp as $$
declare v uuid;
begin
  perform interno.alumia_porta();
  v := interno.rede_p4_ac_eu();
  perform interno.limite('alumia_p4_ato_ler', 300, 10);
  return interno.rede_p4_ato_json(p_ato, v);
end $$;

/** Os atos que eu organizo e que ainda não passaram (para a tela escolher). Só os meus. */
create or replace function public.rede_p4_ato_meus() returns jsonb language plpgsql stable security definer set search_path = interno, pg_temp as $$
declare v uuid;
begin
  perform interno.alumia_porta();
  v := interno.rede_p4_ac_eu();
  return coalesce((select jsonb_agg(jsonb_build_object('id', c.post, 'titulo', coalesce(c.titulo, ''), 'inicio', c.inicio, 'cidade', c.cidade) order by c.inicio)
                     from rede_chamados c join rede_posts p on p.id = c.post
                    where c.inicio > now() - interval '6 hours' and c.situacao <> 'cancelado' and p.apagado_em is null
                      and interno.rede_ato_organiza(c.post, v)), '[]'::jsonb);
end $$;

/** Quem organiza marca os selos. p_selos: lista de cadeira | libras | banheiro | sombra (vazia tira todos). */
create or replace function public.rede_p4_ato_selos(p_ato uuid, p_selos text[]) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid; v_selos text[] := coalesce(p_selos, '{}');
begin
  perform interno.alumia_porta();
  v := interno.rede_p4_ac_eu();
  perform interno.rede_ato_achar(p_ato, v);
  if not interno.rede_ato_organiza(p_ato, v) then perform interno.erro('so_quem_organizou'); end if;
  if not (v_selos <@ array['cadeira', 'libras', 'banheiro', 'sombra']::text[]) then perform interno.erro('invalido:selos'); end if;
  perform interno.limite('alumia_p4_ato_selos', 60, 60);
  insert into rede_p4_ato_acess (ato, selos) values (p_ato, (select coalesce(array_agg(distinct s order by s), '{}') from unnest(v_selos) s))
  on conflict (ato) do update set selos = excluded.selos, atualizado_em = now();
  return interno.rede_p4_ato_json(p_ato, v);
end $$;

do $$
declare f text;
  v_pessoa text[] := array['rede_p4_ato(uuid)', 'rede_p4_ato_meus()', 'rede_p4_ato_selos(uuid, text[])'];
begin
  revoke all on function interno.rede_p4_ato_json(uuid, uuid) from public;
  if exists (select 1 from pg_roles where rolname = 'anon') then revoke all on function interno.rede_p4_ato_json(uuid, uuid) from anon, authenticated; end if;
  foreach f in array v_pessoa loop
    execute format('revoke all on function public.%s from public', f);
    if exists (select 1 from pg_roles where rolname = 'anon') then
      execute format('revoke all on function public.%s from anon', f);
      execute format('grant execute on function public.%s to authenticated, service_role', f);
    end if;
  end loop;
end $$;

-- ═══ Item 96 · Ciranda no ato ou na reunião ═══════════════════════════════════════════════════════════════════════════
-- Quem organiza avisa que há cuidado de crianças: quantas vagas, a faixa de idade e quem cuida (em palavras: "a equipe do
-- coletivo"). Quem vai reserva vagas para as crianças dela (só o número, nunca nome ou idade de criança). Quem vê o ato sabe se
-- há vagas: o número que sobra só aparece a partir de 3; abaixo disso, "poucas vagas"; sem nenhuma, "lotada". Quem organiza vê só o
-- total reservado, também a partir de 3. A reserva guarda a conta só para a própria pessoa mudar ou cancelar.
create table if not exists interno.rede_p4_cirandas (
  ato uuid primary key references interno.rede_chamados (post) on delete cascade,
  vagas smallint not null check (vagas between 1 and 60),
  idades text not null default '' check (char_length(idades) <= 60),
  cuidado text not null default '' check (char_length(cuidado) <= 300),
  criada_em timestamptz not null default now()
);

-- As reservas da ciranda do ato (item 96): só o número de crianças; quem reservou, só para mudar ou cancelar a própria reserva.
create table if not exists interno.rede_p4_ciranda_reservas (
  ato uuid not null references interno.rede_p4_cirandas (ato) on delete cascade,
  -- Quem reservou: só para mudar ou cancelar a própria reserva. NUNCA sai do banco para outra pessoa.
  quem uuid not null references interno.perfis (id) on delete cascade,
  criancas smallint not null check (criancas between 1 and 4),
  primary key (ato, quem)
);

do $$
declare t text;
begin
  foreach t in array array['rede_p4_cirandas', 'rede_p4_ciranda_reservas'] loop
    execute format('alter table interno.%I enable row level security', t);
    execute format('revoke all on table interno.%I from public', t);
    if exists (select 1 from pg_roles where rolname = 'anon') then execute format('revoke all on table interno.%I from anon, authenticated', t); end if;
  end loop;
end $$;

/** A ciranda de um ato como sai: nula sem ciranda. Sobram (a partir de 3), poucas, lotada, as minhas crianças e, para quem organiza, o reservado (a partir de 3). */
create or replace function interno.rede_p4_ciranda_json(p_ato uuid, p_quem uuid, p_organizo boolean) returns jsonb language plpgsql stable security definer set search_path = interno, pg_temp as $$
declare c rede_p4_cirandas; v_res integer; v_sobram integer;
begin
  select * into c from rede_p4_cirandas where ato = p_ato;
  if not found then return null; end if;
  v_res := coalesce((select sum(criancas) from rede_p4_ciranda_reservas where ato = p_ato), 0);
  v_sobram := greatest(c.vagas - v_res, 0);
  return jsonb_build_object('vagas', c.vagas, 'idades', c.idades, 'cuidado', c.cuidado,
    'sobram', case when v_sobram >= 3 then v_sobram end, 'poucas', v_sobram between 1 and 2, 'lotada', v_sobram = 0,
    'minhas', coalesce((select criancas from rede_p4_ciranda_reservas where ato = p_ato and quem = p_quem), 0),
    'reservadas', case when p_organizo then interno.rede_p4_ac_pessoas(v_res) end);
end $$;

/** Quem organiza abre ou ajusta a ciranda. p: {vagas, idades, cuidado}. Vagas abaixo do já reservado são recusadas. */
create or replace function public.rede_p4_ciranda_abrir(p_ato uuid, p jsonb) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid; v_vagas integer;
begin
  perform interno.alumia_porta();
  v := interno.rede_p4_ac_eu();
  perform interno.rede_ato_aberto(p_ato, v);
  if not interno.rede_ato_organiza(p_ato, v) then perform interno.erro('so_quem_organizou'); end if;
  begin
    v_vagas := (p ->> 'vagas')::integer;
  exception when others then
    perform interno.erro('invalido:vagas');
  end;
  if v_vagas is null or v_vagas not between 1 and 60 or v_vagas < coalesce((select sum(criancas) from rede_p4_ciranda_reservas where ato = p_ato), 0) then
    perform interno.erro('invalido:vagas');
  end if;
  perform interno.limite('alumia_p4_ciranda', 30, 60);
  insert into rede_p4_cirandas (ato, vagas, idades, cuidado)
  values (p_ato, v_vagas, interno.rede_p4_ac_campo(p ->> 'idades', 'idades', 0, 60), interno.rede_p4_ac_campo(p ->> 'cuidado', 'cuidado', 0, 300))
  on conflict (ato) do update set vagas = excluded.vagas, idades = excluded.idades, cuidado = excluded.cuidado;
  return interno.rede_p4_ato_json(p_ato, v);
end $$;

/** Quem organiza tira a ciranda (as reservas somem junto). */
create or replace function public.rede_p4_ciranda_fechar(p_ato uuid) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid;
begin
  perform interno.alumia_porta();
  v := interno.rede_p4_ac_eu();
  perform interno.rede_ato_achar(p_ato, v);
  if not interno.rede_ato_organiza(p_ato, v) then perform interno.erro('so_quem_organizou'); end if;
  delete from rede_p4_cirandas where ato = p_ato;
  return interno.rede_p4_ato_json(p_ato, v);
end $$;

/** Reservar vagas para as minhas crianças (1 a 4); 0 cancela. Sem vaga que chegue: "lotada". */
create or replace function public.rede_p4_ciranda_reservar(p_ato uuid, p_criancas integer) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid; c rede_p4_cirandas; v_outras integer; v_n integer := coalesce(p_criancas, 0);
begin
  perform interno.alumia_porta();
  v := interno.rede_p4_ac_eu();
  perform interno.rede_ato_aberto(p_ato, v);
  select * into c from rede_p4_cirandas where ato = p_ato for update;
  if not found then perform interno.erro('sem_ciranda'); end if;
  if v_n not between 0 and 4 then perform interno.erro('invalido:criancas'); end if;
  perform interno.limite('alumia_p4_ciranda_reservar', 30, 60);
  if v_n = 0 then
    delete from rede_p4_ciranda_reservas where ato = p_ato and quem = v;
  else
    v_outras := coalesce((select sum(criancas) from rede_p4_ciranda_reservas where ato = p_ato and quem <> v), 0);
    if v_outras + v_n > c.vagas then perform interno.erro('lotada'); end if;
    insert into rede_p4_ciranda_reservas (ato, quem, criancas) values (p_ato, v, v_n)
    on conflict (ato, quem) do update set criancas = excluded.criancas;
  end if;
  return interno.rede_p4_ato_json(p_ato, v);
end $$;

do $$
declare f text;
  v_pessoa text[] := array['rede_p4_ciranda_abrir(uuid, jsonb)', 'rede_p4_ciranda_fechar(uuid)', 'rede_p4_ciranda_reservar(uuid, integer)'];
begin
  revoke all on function interno.rede_p4_ciranda_json(uuid, uuid, boolean) from public;
  if exists (select 1 from pg_roles where rolname = 'anon') then revoke all on function interno.rede_p4_ciranda_json(uuid, uuid, boolean) from anon, authenticated; end if;
  foreach f in array v_pessoa loop
    execute format('revoke all on function public.%s from public', f);
    if exists (select 1 from pg_roles where rolname = 'anon') then
      execute format('revoke all on function public.%s from anon', f);
      execute format('grant execute on function public.%s to authenticated, service_role', f);
    end if;
  end loop;
end $$;

-- ═══ Item 100 · Chave Pix oficial no perfil verificado (e a página da organização do lote) ══════════════════════════════
-- A organização COM SELO mostra a chave Pix oficial (a mesma regra do caixa: CNPJ ou chave aleatória; CPF, telefone e e-mail de
-- pessoa são recusados). Sem selo, a chave não aparece (fica guardada). Quando um post cita uma organização com chave oficial
-- (pelo @ ou pelo nome) e traz OUTRA chave Pix, a Alumia avisa quem lê (interno.rede_p4_pix_conferir, pelo encaixe anexosDoCartao,
-- sem mexer no cartão): o aviso só diz "a chave deste post não é a oficial de @org"; nenhum texto de post sai do banco.
-- A página da organização do lote (rede_p4_org_pagina) junta o Pix (100), a sala de imprensa (124), a vitrine (125) e os links (126),
-- cada parte quando a tabela dela existe.
create table if not exists interno.rede_p4_org_pix (
  org uuid primary key references interno.rede_orgs (perfil) on delete cascade,
  chave text not null check (char_length(chave) between 8 and 140),
  desde date not null default current_date
);

do $$
begin
  alter table interno.rede_p4_org_pix enable row level security;
  revoke all on table interno.rede_p4_org_pix from public;
  if exists (select 1 from pg_roles where rolname = 'anon') then revoke all on table interno.rede_p4_org_pix from anon, authenticated; end if;
end $$;

/** Uma chave Pix normalizada para comparar: só letras e números, minúsculas. */
create or replace function interno.rede_p4_pix_norma(p text) returns text language sql immutable as $$
  select lower(regexp_replace(coalesce(p, ''), '[^A-Za-z0-9]', '', 'g'))
$$;

/** As chaves Pix que aparecem num texto (CNPJ, CPF, chave aleatória, e-mail e telefone), normalizadas. Só quando o texto fala em Pix. */
create or replace function interno.rede_p4_pix_no_texto(p text) returns text[] language sql immutable as $$
  select case when coalesce(p, '') !~* '\mpix\M' then '{}'::text[] else coalesce((
    select array_agg(distinct interno.rede_p4_pix_norma(m[1])) from regexp_matches(p,
      '(\d{2}\.?\d{3}\.?\d{3}/?\d{4}-?\d{2}|\d{3}\.?\d{3}\.?\d{3}-?\d{2}|[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}|[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+\.[A-Za-z.]{2,}|\+?55\s?\(?\d{2}\)?\s?9?\d{4}[-\s]?\d{4}|\(?\d{2}\)?\s?9\d{4}[-\s]?\d{4})', 'g') m), '{}'::text[]) end
$$;

/** A chave oficial que sai: só de organização com selo. */
create or replace function interno.rede_p4_org_pix_json(p_org uuid) returns jsonb language sql stable security definer set search_path = interno, pg_temp as $$
  select case when interno.alumia_o13_selo(p_org) then (select to_jsonb(x.chave) from rede_p4_org_pix x where x.org = p_org) end
$$;

/** Quem gere uma organização com selo define (ou tira, com vazio) a chave oficial. */
create or replace function public.rede_p4_pix_definir(p_handle text, p_chave text) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid; v_org uuid; v_chave text;
begin
  perform interno.alumia_porta();
  v := interno.rede_p4_ac_eu();
  v_org := interno.rede_p4_ac_gestao(p_handle, v, true);
  perform interno.limite('alumia_p4_pix', 10, 60);
  v_chave := interno.alumia_o13_pix(p_chave);
  if v_chave = '' then
    delete from rede_p4_org_pix where org = v_org;
  else
    if char_length(v_chave) < 8 then perform interno.erro('invalido:pix'); end if;
    insert into rede_p4_org_pix (org, chave) values (v_org, v_chave) on conflict (org) do update set chave = excluded.chave, desde = current_date;
  end if;
  return public.rede_p4_org_pagina(p_handle);
end $$;

/**
 * Confere um post que a pessoa pode ver: se ele cita uma organização com chave oficial e traz outra chave Pix, devolve o aviso com o
 * @ e o nome da organização. Nunca devolve o texto do post nem a chave encontrada.
 */
create or replace function public.rede_p4_pix_conferir(p_post uuid) returns jsonb language plpgsql volatile security definer set search_path = interno, pg_temp as $$
declare v uuid; p rede_posts; v_chaves text[]; v_texto text; r record;
begin
  perform interno.alumia_porta();
  v := interno.rede_p4_ac_eu();
  select * into p from rede_posts where id = p_post;
  if not found or not interno.rede_ve(p, v) then perform interno.erro('nao_encontrado'); end if;
  perform interno.limite('alumia_p4_pix_conferir', 600, 10);
  v_texto := coalesce(p.texto, '');
  v_chaves := interno.rede_p4_pix_no_texto(v_texto);
  if cardinality(v_chaves) = 0 then return jsonb_build_object('alerta', false); end if;
  for r in
    select x.org, x.chave, f.rede_handle, interno.rede_nome(x.org) nome from rede_p4_org_pix x join rede_orgs o on o.perfil = x.org join perfis f on f.id = x.org
     where o.verificada_em is not null and not f.suspenso and x.org <> p.autor
       and (v_texto ~* ('@' || f.rede_handle || '\M') or strpos(lower(v_texto), lower(interno.rede_nome(x.org))) > 0)
  loop
    if exists (select 1 from unnest(v_chaves) k where k <> interno.rede_p4_pix_norma(r.chave)) then
      return jsonb_build_object('alerta', true, 'org', jsonb_build_object('handle', r.rede_handle, 'nome', r.nome));
    end if;
  end loop;
  return jsonb_build_object('alerta', false);
end $$;

/**
 * A página da organização do lote, para quem é da Alumia: @, nome, selo, se eu giro, a chave Pix oficial (só com selo) e, quando as
 * tabelas dos itens 124 a 126 existem, a sala de imprensa, a vitrine e os links. Nunca quem gere nem quantas pessoas são.
 */
create or replace function public.rede_p4_org_pagina(p_handle text) returns jsonb language plpgsql volatile security definer set search_path = interno, pg_temp as $$
declare v uuid; v_org uuid; v_saida jsonb; v_parte jsonb;
begin
  perform interno.alumia_porta();
  v := interno.rede_p4_ac_eu();
  v_org := interno.rede_p4_ac_org(p_handle);
  if v_org is null or not interno.alumia_org_vista(v_org, v) then perform interno.erro('nao_encontrado'); end if;
  perform interno.limite('alumia_p4_org_ler', 300, 10);
  v_saida := interno.rede_p4_ac_org_json(v_org) || jsonb_build_object('gerencio', interno.alumia_org_gere(v, v_org), 'pix', interno.rede_p4_org_pix_json(v_org));
  if to_regprocedure('interno.rede_p4_org_imprensa_json(uuid)') is not null then
    execute 'select interno.rede_p4_org_imprensa_json($1)' into v_parte using v_org;
    v_saida := v_saida || jsonb_build_object('imprensa', v_parte);
  end if;
  if to_regprocedure('interno.rede_p4_vitrine_da_org(uuid)') is not null then
    execute 'select interno.rede_p4_vitrine_da_org($1)' into v_parte using v_org;
    v_saida := v_saida || jsonb_build_object('vitrine', v_parte);
  end if;
  if to_regprocedure('interno.rede_p4_org_links_json(uuid)') is not null then
    execute 'select interno.rede_p4_org_links_json($1)' into v_parte using v_org;
    v_saida := v_saida || jsonb_build_object('links', v_parte);
  end if;
  return v_saida;
end $$;

do $$
declare f text;
  v_internas text[] := array['rede_p4_pix_norma(text)', 'rede_p4_pix_no_texto(text)', 'rede_p4_org_pix_json(uuid)'];
  v_pessoa text[] := array['rede_p4_pix_definir(text, text)', 'rede_p4_pix_conferir(uuid)', 'rede_p4_org_pagina(text)'];
begin
  foreach f in array v_internas loop
    execute format('revoke all on function interno.%s from public', f);
    if exists (select 1 from pg_roles where rolname = 'anon') then execute format('revoke all on function interno.%s from anon, authenticated', f); end if;
  end loop;
  foreach f in array v_pessoa loop
    execute format('revoke all on function public.%s from public', f);
    if exists (select 1 from pg_roles where rolname = 'anon') then
      execute format('revoke all on function public.%s from anon', f);
      execute format('grant execute on function public.%s to authenticated, service_role', f);
    end if;
  end loop;
end $$;

-- ═══ Item 124 · Sala de imprensa da organização ═══════════════════════════════════════════════════════════════════════
-- Quem gere a organização publica a sala de imprensa: os releases (título, texto, data e link), o contato de imprensa (e-mail e
-- telefone INSTITUCIONAIS; a tela avisa que não é para pôr o de uma pessoa; CPF é recusado) e o kit de identidade (até 4 cores e o
-- link para baixar o kit). Aparece na página da organização do lote (rede_p4_org_pagina).
create table if not exists interno.rede_p4_org_imprensa (
  org uuid primary key references interno.rede_orgs (perfil) on delete cascade,
  email text check (email is null or (char_length(email) <= 120 and email ~ '^[a-z0-9._%+-]+@[a-z0-9-]+(\.[a-z0-9-]+)+$')),
  telefone text check (telefone is null or telefone ~ '^[0-9]{10,13}$'),
  sobre text not null default '' check (char_length(sobre) <= 600),
  cores text[] not null default '{}' check (cardinality(cores) <= 4),
  kit text check (kit is null or kit ~ '^https://'),
  atualizada_em timestamptz not null default now()
);

create table if not exists interno.rede_p4_org_releases (
  id uuid primary key default gen_random_uuid(),
  org uuid not null references interno.rede_orgs (perfil) on delete cascade,
  titulo text not null check (char_length(titulo) between 3 and 140),
  texto text not null check (char_length(texto) between 20 and 6000),
  dia date not null,
  link text check (link is null or link ~ '^https://'),
  criado_em timestamptz not null default now()
);
create index if not exists rede_p4_org_releases_org on interno.rede_p4_org_releases (org, dia desc);

do $$
declare t text;
begin
  foreach t in array array['rede_p4_org_imprensa', 'rede_p4_org_releases'] loop
    execute format('alter table interno.%I enable row level security', t);
    execute format('revoke all on table interno.%I from public', t);
    if exists (select 1 from pg_roles where rolname = 'anon') then execute format('revoke all on table interno.%I from anon, authenticated', t); end if;
  end loop;
end $$;

/** A sala de imprensa como sai (nula sem nada publicado): contato, sobre, cores, kit e os releases (os 30 mais novos). */
create or replace function interno.rede_p4_org_imprensa_json(p_org uuid) returns jsonb language sql stable security definer set search_path = interno, pg_temp as $$
  select case when i.org is null and not exists (select 1 from rede_p4_org_releases r where r.org = p_org) then null else jsonb_build_object(
    'email', i.email, 'telefone', i.telefone, 'sobre', coalesce(i.sobre, ''), 'cores', coalesce(to_jsonb(i.cores), '[]'::jsonb), 'kit', i.kit,
    'releases', coalesce((select jsonb_agg(jsonb_build_object('id', r.id, 'titulo', r.titulo, 'texto', r.texto, 'dia', r.dia, 'link', r.link) order by r.dia desc, r.criado_em desc)
                            from (select * from rede_p4_org_releases r where r.org = p_org order by r.dia desc, r.criado_em desc limit 30) r), '[]'::jsonb)) end
    from (select p_org as id) x left join rede_p4_org_imprensa i on i.org = x.id
$$;

/** Quem gere salva o contato e o kit. p: {email, telefone, sobre, cores: ['#rrggbb'], kit}. Vazio tira. */
create or replace function public.rede_p4_org_imprensa(p_handle text, p jsonb) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid; v_org uuid; v_email text := nullif(lower(btrim(coalesce(p ->> 'email', ''))), ''); v_tel text := nullif(regexp_replace(coalesce(p ->> 'telefone', ''), '[^0-9]', '', 'g'), '');
  v_cores text[] := '{}'; c text;
begin
  perform interno.alumia_porta();
  v := interno.rede_p4_ac_eu();
  v_org := interno.rede_p4_ac_gestao(p_handle, v, false);
  perform interno.limite('alumia_p4_imprensa', 30, 60);
  if v_email is not null and (char_length(v_email) > 120 or v_email !~ '^[a-z0-9._%+-]+@[a-z0-9-]+(\.[a-z0-9-]+)+$') then perform interno.erro('invalido:email'); end if;
  if v_tel is not null and v_tel !~ '^[0-9]{10,13}$' then perform interno.erro('invalido:telefone'); end if;
  if jsonb_typeof(p -> 'cores') = 'array' then
    if jsonb_array_length(p -> 'cores') > 4 then perform interno.erro('invalido:cores'); end if;
    for c in select lower(value) from jsonb_array_elements_text(p -> 'cores') loop
      if c !~ '^#[0-9a-f]{6}$' then perform interno.erro('invalido:cores'); end if;
      v_cores := v_cores || c;
    end loop;
  end if;
  insert into rede_p4_org_imprensa (org, email, telefone, sobre, cores, kit)
  values (v_org, v_email, v_tel, interno.rede_p4_ac_campo(p ->> 'sobre', 'sobre', 0, 600), v_cores, interno.rede_p4_ac_link(p ->> 'kit'))
  on conflict (org) do update set email = excluded.email, telefone = excluded.telefone, sobre = excluded.sobre, cores = excluded.cores, kit = excluded.kit, atualizada_em = now();
  return public.rede_p4_org_pagina(p_handle);
end $$;

/** Quem gere publica um release. p: {titulo, texto, dia, link}. */
create or replace function public.rede_p4_org_release(p_handle text, p jsonb) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid; v_org uuid; v_dia date;
begin
  perform interno.alumia_porta();
  v := interno.rede_p4_ac_eu();
  v_org := interno.rede_p4_ac_gestao(p_handle, v, false);
  begin
    v_dia := coalesce(nullif(p ->> 'dia', '')::date, current_date);
  exception when others then
    perform interno.erro('invalido:dia');
  end;
  if v_dia > current_date + 1 or v_dia < current_date - 3650 then perform interno.erro('invalido:dia'); end if;
  perform interno.limite('alumia_p4_release', 20, 1440);
  -- O texto do release é da organização: pode trazer o contato institucional, mas não CPF.
  if char_length(interno.rede_p4_ac_texto(p ->> 'texto', 6001)) not between 20 and 6000 then perform interno.erro('invalido:texto'); end if;
  if coalesce(p ->> 'texto', '') ~ '\d{3}\.?\d{3}\.?\d{3}-?\d{2}' then perform interno.erro('dado_pessoal'); end if;
  insert into rede_p4_org_releases (org, titulo, texto, dia, link)
  values (v_org, interno.rede_p4_ac_campo(p ->> 'titulo', 'titulo', 3, 140), interno.rede_p4_ac_texto(p ->> 'texto', 6000), v_dia, interno.rede_p4_ac_link(p ->> 'link'));
  return public.rede_p4_org_pagina(p_handle);
end $$;

/** Quem gere tira um release. */
create or replace function public.rede_p4_org_release_tirar(p_id uuid) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid; v_org uuid;
begin
  perform interno.alumia_porta();
  v := interno.rede_p4_ac_eu();
  select org into v_org from rede_p4_org_releases where id = p_id;
  if v_org is null or not interno.alumia_org_gere(v, v_org) then perform interno.erro('nao_encontrado'); end if;
  delete from rede_p4_org_releases where id = p_id;
  return public.rede_p4_org_pagina((select rede_handle from perfis where id = v_org));
end $$;

do $$
declare f text;
  v_pessoa text[] := array['rede_p4_org_imprensa(text, jsonb)', 'rede_p4_org_release(text, jsonb)', 'rede_p4_org_release_tirar(uuid)'];
begin
  revoke all on function interno.rede_p4_org_imprensa_json(uuid) from public;
  if exists (select 1 from pg_roles where rolname = 'anon') then revoke all on function interno.rede_p4_org_imprensa_json(uuid) from anon, authenticated; end if;
  foreach f in array v_pessoa loop
    execute format('revoke all on function public.%s from public', f);
    if exists (select 1 from pg_roles where rolname = 'anon') then
      execute format('revoke all on function public.%s from anon', f);
      execute format('grant execute on function public.%s to authenticated, service_role', f);
    end if;
  end loop;
end $$;

-- ═══ Item 125 · Vitrine da economia solidária ═════════════════════════════════════════════════════════════════════════
-- Cooperativas e produtores, pela organização COM SELO que os conhece: nome, o que fazem, a categoria, a cidade e UM link (https)
-- para quem quiser comprar ou apoiar fora da Alumia. Sem pagamento, sem preço, sem carrinho, sem custódia: só o link. A vitrine
-- geral junta as de todas as organizações com selo; sem o selo, os itens somem (ficam guardados).
create table if not exists interno.rede_p4_vitrine (
  id uuid primary key default gen_random_uuid(),
  org uuid not null references interno.rede_orgs (perfil) on delete cascade,
  nome text not null check (char_length(nome) between 3 and 80),
  sobre text not null default '' check (char_length(sobre) <= 400),
  categoria text not null check (categoria in ('alimentos', 'artesanato', 'roupas', 'servicos', 'cultura', 'outros')),
  cidade text not null default '' check (char_length(cidade) <= 60),
  link text not null check (link ~ '^https://'),
  criado_em timestamptz not null default now()
);
create index if not exists rede_p4_vitrine_org on interno.rede_p4_vitrine (org);
create index if not exists rede_p4_vitrine_categoria on interno.rede_p4_vitrine (categoria, criado_em desc);

do $$
begin
  alter table interno.rede_p4_vitrine enable row level security;
  revoke all on table interno.rede_p4_vitrine from public;
  if exists (select 1 from pg_roles where rolname = 'anon') then revoke all on table interno.rede_p4_vitrine from anon, authenticated; end if;
end $$;

/** Os itens da vitrine de uma organização (vazio sem selo). */
create or replace function interno.rede_p4_vitrine_da_org(p_org uuid) returns jsonb language sql stable security definer set search_path = interno, pg_temp as $$
  select coalesce((select jsonb_agg(jsonb_build_object('id', x.id, 'nome', x.nome, 'sobre', x.sobre, 'categoria', x.categoria, 'cidade', x.cidade, 'link', x.link) order by x.nome)
                     from rede_p4_vitrine x where x.org = p_org and interno.alumia_o13_selo(p_org)), '[]'::jsonb)
$$;

/** Quem gere uma organização com selo põe um item. p: {nome, sobre, categoria, cidade, link}. Até 40 por organização. */
create or replace function public.rede_p4_vitrine_por(p_handle text, p jsonb) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid; v_org uuid; v_cat text := coalesce(p ->> 'categoria', ''); v_link text;
begin
  perform interno.alumia_porta();
  v := interno.rede_p4_ac_eu();
  v_org := interno.rede_p4_ac_gestao(p_handle, v, true);
  if v_cat not in ('alimentos', 'artesanato', 'roupas', 'servicos', 'cultura', 'outros') then perform interno.erro('invalido:categoria'); end if;
  v_link := interno.rede_p4_ac_link(p ->> 'link');
  if v_link is null then perform interno.erro('invalido:link'); end if;
  if (select count(*) from rede_p4_vitrine where org = v_org) >= 40 then perform interno.erro('limite'); end if;
  perform interno.limite('alumia_p4_vitrine', 60, 1440);
  insert into rede_p4_vitrine (org, nome, sobre, categoria, cidade, link)
  values (v_org, interno.rede_p4_ac_campo(p ->> 'nome', 'nome', 3, 80), interno.rede_p4_ac_campo(p ->> 'sobre', 'sobre', 0, 400), v_cat,
          interno.rede_p4_ac_campo(p ->> 'cidade', 'cidade', 0, 60), v_link);
  return public.rede_p4_org_pagina(p_handle);
end $$;

/** Quem gere tira um item. */
create or replace function public.rede_p4_vitrine_tirar(p_id uuid) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid; v_org uuid;
begin
  perform interno.alumia_porta();
  v := interno.rede_p4_ac_eu();
  select org into v_org from rede_p4_vitrine where id = p_id;
  if v_org is null or not interno.alumia_org_gere(v, v_org) then perform interno.erro('nao_encontrado'); end if;
  delete from rede_p4_vitrine where id = p_id;
  return public.rede_p4_org_pagina((select rede_handle from perfis where id = v_org));
end $$;

/** A vitrine geral: de todas as organizações com selo, filtrada por categoria e cidade (vazio = todas). Até 200, mais novos primeiro. */
create or replace function public.rede_p4_vitrine(p_categoria text, p_cidade text) returns jsonb language plpgsql volatile security definer set search_path = interno, pg_temp as $$
declare v uuid; v_cat text := nullif(btrim(coalesce(p_categoria, '')), ''); v_cid text := nullif(interno.rede_ato_cidade(p_cidade), '');
begin
  perform interno.alumia_porta();
  v := interno.rede_p4_ac_eu();
  perform interno.limite('alumia_p4_vitrine_ler', 300, 10);
  return coalesce((select jsonb_agg(jsonb_build_object('id', x.id, 'nome', x.nome, 'sobre', x.sobre, 'categoria', x.categoria, 'cidade', x.cidade, 'link', x.link,
                                                       'org', interno.rede_p4_ac_org_json(x.org)) order by x.criado_em desc)
                     from (select x.* from rede_p4_vitrine x join rede_orgs o on o.perfil = x.org join perfis f on f.id = x.org
                            where o.verificada_em is not null and not f.suspenso and not interno.rede_bloqueado(v, x.org)
                              and (v_cat is null or x.categoria = v_cat) and (v_cid is null or interno.rede_ato_cidade(x.cidade) = v_cid)
                            order by x.criado_em desc limit 200) x), '[]'::jsonb);
end $$;

do $$
declare f text;
  v_pessoa text[] := array['rede_p4_vitrine_por(text, jsonb)', 'rede_p4_vitrine_tirar(uuid)', 'rede_p4_vitrine(text, text)'];
begin
  revoke all on function interno.rede_p4_vitrine_da_org(uuid) from public;
  if exists (select 1 from pg_roles where rolname = 'anon') then revoke all on function interno.rede_p4_vitrine_da_org(uuid) from anon, authenticated; end if;
  foreach f in array v_pessoa loop
    execute format('revoke all on function public.%s from public', f);
    if exists (select 1 from pg_roles where rolname = 'anon') then
      execute format('revoke all on function public.%s from anon', f);
      execute format('grant execute on function public.%s to authenticated, service_role', f);
    end if;
  end loop;
end $$;

-- ═══ Item 126 · Página de links da organização ════════════════════════════════════════════════════════════════════════
-- Quem gere a organização monta a lista de links dela (site, campanha, formulário de filiação de fora, redes), até 20, na ordem
-- escolhida. Só https e sem usuário e senha no endereço. Aparece na página da organização do lote (rede_p4_org_pagina).
create table if not exists interno.rede_p4_org_links (
  id uuid primary key default gen_random_uuid(),
  org uuid not null references interno.rede_orgs (perfil) on delete cascade,
  titulo text not null check (char_length(titulo) between 2 and 60),
  url text not null check (url ~ '^https://'),
  ordem smallint not null check (ordem between 0 and 19),
  unique (org, ordem)
);

do $$
begin
  alter table interno.rede_p4_org_links enable row level security;
  revoke all on table interno.rede_p4_org_links from public;
  if exists (select 1 from pg_roles where rolname = 'anon') then revoke all on table interno.rede_p4_org_links from anon, authenticated; end if;
end $$;

/** Os links da organização, na ordem. */
create or replace function interno.rede_p4_org_links_json(p_org uuid) returns jsonb language sql stable security definer set search_path = interno, pg_temp as $$
  select coalesce((select jsonb_agg(jsonb_build_object('titulo', l.titulo, 'url', l.url) order by l.ordem) from rede_p4_org_links l where l.org = p_org), '[]'::jsonb)
$$;

/** Quem gere troca a lista inteira. p_links: [{titulo, url}], até 20 (vazia tira todos). */
create or replace function public.rede_p4_org_links(p_handle text, p_links jsonb) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid; v_org uuid; l jsonb; v_i integer := 0; v_url text;
begin
  perform interno.alumia_porta();
  v := interno.rede_p4_ac_eu();
  v_org := interno.rede_p4_ac_gestao(p_handle, v, false);
  if jsonb_typeof(p_links) is distinct from 'array' or jsonb_array_length(p_links) > 20 then perform interno.erro('invalido:links'); end if;
  perform interno.limite('alumia_p4_links', 30, 60);
  delete from rede_p4_org_links where org = v_org;
  for l in select * from jsonb_array_elements(p_links) loop
    v_url := interno.rede_p4_ac_link(l ->> 'url');
    if v_url is null then perform interno.erro('invalido:link'); end if;
    insert into rede_p4_org_links (org, titulo, url, ordem) values (v_org, interno.rede_p4_ac_campo(l ->> 'titulo', 'titulo', 2, 60), v_url, v_i);
    v_i := v_i + 1;
  end loop;
  return public.rede_p4_org_pagina(p_handle);
end $$;

do $$
begin
  revoke all on function interno.rede_p4_org_links_json(uuid) from public;
  revoke all on function public.rede_p4_org_links(text, jsonb) from public;
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on function interno.rede_p4_org_links_json(uuid) from anon, authenticated;
    revoke all on function public.rede_p4_org_links(text, jsonb) from anon;
    grant execute on function public.rede_p4_org_links(text, jsonb) to authenticated, service_role;
  end if;
end $$;

-- ═══ Item 123 · Frentes entre organizações ════════════════════════════════════════════════════════════════════════════
-- Uma frente junta várias organizações numa página: o nome, o texto, as organizações que aceitaram e os atos em comum. Quem gere
-- uma organização cria a frente (a dela entra aceita) e convida outras pelo @; quem gere a convidada aceita ou recusa. Só quem gere
-- uma organização da frente põe um ato, e só ato que essa organização organiza (rede_ato_organiza). Cada pessoa só vê os atos que
-- rede_ve deixa. A página mostra organizações (que são públicas), nunca quem as gere.
create table if not exists interno.rede_p4_frentes (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9-]{3,40}$'),
  nome text not null check (char_length(nome) between 3 and 80),
  sobre text not null default '' check (char_length(sobre) <= 1000),
  criada_em timestamptz not null default now()
);

create table if not exists interno.rede_p4_frente_orgs (
  frente uuid not null references interno.rede_p4_frentes (id) on delete cascade,
  org uuid not null references interno.rede_orgs (perfil) on delete cascade,
  aceita_em timestamptz,
  convidada_em timestamptz not null default now(),
  primary key (frente, org)
);
create index if not exists rede_p4_frente_orgs_org on interno.rede_p4_frente_orgs (org);

create table if not exists interno.rede_p4_frente_atos (
  frente uuid not null references interno.rede_p4_frentes (id) on delete cascade,
  ato uuid not null references interno.rede_chamados (post) on delete cascade,
  primary key (frente, ato)
);

do $$
declare t text;
begin
  foreach t in array array['rede_p4_frentes', 'rede_p4_frente_orgs', 'rede_p4_frente_atos'] loop
    execute format('alter table interno.%I enable row level security', t);
    execute format('revoke all on table interno.%I from public', t);
    if exists (select 1 from pg_roles where rolname = 'anon') then execute format('revoke all on table interno.%I from anon, authenticated', t); end if;
  end loop;
end $$;

/** A pessoa gere alguma organização que já aceitou a frente? Devolve essa organização (a primeira) ou nulo. */
create or replace function interno.rede_p4_frente_minha_org(p_frente uuid, p_quem uuid) returns uuid language sql stable security definer set search_path = interno, pg_temp as $$
  select fo.org from rede_p4_frente_orgs fo where fo.frente = p_frente and fo.aceita_em is not null and interno.alumia_org_gere(p_quem, fo.org) order by fo.aceita_em limit 1
$$;

/** A página da frente: o nome, as organizações que aceitaram, os atos que eu posso ver e, para quem gere uma delas, os convites pendentes. */
create or replace function interno.rede_p4_frente_json(p_frente uuid, p_quem uuid) returns jsonb language plpgsql stable security definer set search_path = interno, pg_temp as $$
declare f rede_p4_frentes; v_dentro boolean;
begin
  select * into f from rede_p4_frentes where id = p_frente;
  v_dentro := interno.rede_p4_frente_minha_org(p_frente, p_quem) is not null;
  return jsonb_build_object('id', f.id, 'slug', f.slug, 'nome', f.nome, 'sobre', f.sobre, 'gerencio', v_dentro,
    'orgs', coalesce((select jsonb_agg(interno.rede_p4_ac_org_json(fo.org) order by fo.aceita_em) from rede_p4_frente_orgs fo where fo.frente = f.id and fo.aceita_em is not null), '[]'::jsonb),
    'convidadas', case when v_dentro then coalesce((select jsonb_agg(interno.rede_p4_ac_org_json(fo.org)) from rede_p4_frente_orgs fo where fo.frente = f.id and fo.aceita_em is null), '[]'::jsonb) else '[]'::jsonb end,
    -- Os convites que EU posso responder (de organizações que eu giro).
    'para_responder', coalesce((select jsonb_agg(interno.rede_p4_ac_org_json(fo.org)) from rede_p4_frente_orgs fo where fo.frente = f.id and fo.aceita_em is null and interno.alumia_org_gere(p_quem, fo.org)), '[]'::jsonb),
    'atos', coalesce((select jsonb_agg(jsonb_build_object('id', c.post, 'titulo', coalesce(c.titulo, ''), 'inicio', c.inicio, 'cidade', c.cidade, 'situacao', c.situacao) order by c.inicio)
                        from rede_p4_frente_atos fa join rede_chamados c on c.post = fa.ato join rede_posts p on p.id = c.post
                       where fa.frente = f.id and p.apagado_em is null and not p.oculto and interno.rede_ve(p, p_quem)), '[]'::jsonb));
end $$;

/** Quem gere uma organização cria a frente. p: {org, slug, nome, sobre}. A organização dela entra aceita. */
create or replace function public.rede_p4_frente_criar(p jsonb) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid; v_org uuid; v_slug text := lower(btrim(coalesce(p ->> 'slug', ''))); v_id uuid;
begin
  perform interno.alumia_porta();
  v := interno.rede_p4_ac_eu();
  v_org := interno.rede_p4_ac_gestao(p ->> 'org', v, false);
  if v_slug !~ '^[a-z0-9-]{3,40}$' then perform interno.erro('invalido:slug'); end if;
  if exists (select 1 from rede_p4_frentes where slug = v_slug) then perform interno.erro('slug_em_uso'); end if;
  perform interno.limite('alumia_p4_frente', 5, 1440);
  insert into rede_p4_frentes (slug, nome, sobre) values (v_slug, interno.rede_p4_ac_campo(p ->> 'nome', 'nome', 3, 80), interno.rede_p4_ac_campo(p ->> 'sobre', 'sobre', 0, 1000))
  returning id into v_id;
  insert into rede_p4_frente_orgs (frente, org, aceita_em) values (v_id, v_org, now());
  return interno.rede_p4_frente_json(v_id, v);
end $$;

/** A página de uma frente pelo endereço (qualquer pessoa da Alumia). */
create or replace function public.rede_p4_frente(p_slug text) returns jsonb language plpgsql stable security definer set search_path = interno, pg_temp as $$
declare v uuid; v_id uuid;
begin
  perform interno.alumia_porta();
  v := interno.rede_p4_ac_eu();
  select id into v_id from rede_p4_frentes where slug = lower(btrim(coalesce(p_slug, '')));
  if v_id is null then perform interno.erro('nao_encontrado'); end if;
  return interno.rede_p4_frente_json(v_id, v);
end $$;

/** As frentes: as que têm 2 organizações ou mais (as públicas) e as das organizações que eu giro (com convites). */
create or replace function public.rede_p4_frentes() returns jsonb language plpgsql stable security definer set search_path = interno, pg_temp as $$
declare v uuid;
begin
  perform interno.alumia_porta();
  v := interno.rede_p4_ac_eu();
  return coalesce((select jsonb_agg(jsonb_build_object('slug', f.slug, 'nome', f.nome, 'orgs', (select count(*) from rede_p4_frente_orgs fo where fo.frente = f.id and fo.aceita_em is not null))
                          order by f.nome)
                     from rede_p4_frentes f
                    where (select count(*) from rede_p4_frente_orgs fo where fo.frente = f.id and fo.aceita_em is not null) >= 2
                       or exists (select 1 from rede_p4_frente_orgs fo where fo.frente = f.id and interno.alumia_org_gere(v, fo.org))), '[]'::jsonb);
end $$;

/** Quem gere uma organização da frente convida outra pelo @. */
create or replace function public.rede_p4_frente_convidar(p_frente uuid, p_org text) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid; v_outra uuid;
begin
  perform interno.alumia_porta();
  v := interno.rede_p4_ac_eu();
  if interno.rede_p4_frente_minha_org(p_frente, v) is null then perform interno.erro('sem_permissao'); end if;
  v_outra := interno.rede_p4_ac_org(p_org);
  if v_outra is null then perform interno.erro('nao_encontrado'); end if;
  if (select count(*) from rede_p4_frente_orgs where frente = p_frente) >= 40 then perform interno.erro('limite'); end if;
  perform interno.limite('alumia_p4_frente_convite', 30, 1440);
  insert into rede_p4_frente_orgs (frente, org) values (p_frente, v_outra) on conflict do nothing;
  return interno.rede_p4_frente_json(p_frente, v);
end $$;

/** Quem gere a convidada aceita (p_aceitar) ou recusa; quem gere uma que já está, sai (p_aceitar falso). */
create or replace function public.rede_p4_frente_responder(p_frente uuid, p_org text, p_aceitar boolean) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid; v_org uuid;
begin
  perform interno.alumia_porta();
  v := interno.rede_p4_ac_eu();
  v_org := interno.rede_p4_ac_gestao(p_org, v, false);
  if not exists (select 1 from rede_p4_frente_orgs where frente = p_frente and org = v_org) then perform interno.erro('nao_encontrado'); end if;
  if coalesce(p_aceitar, false) then
    update rede_p4_frente_orgs set aceita_em = coalesce(aceita_em, now()) where frente = p_frente and org = v_org;
  else
    delete from rede_p4_frente_orgs where frente = p_frente and org = v_org;
    -- Sem nenhuma organização, a frente acaba.
    if not exists (select 1 from rede_p4_frente_orgs where frente = p_frente and aceita_em is not null) then
      delete from rede_p4_frentes where id = p_frente;
      return jsonb_build_object('apagada', true);
    end if;
  end if;
  return interno.rede_p4_frente_json(p_frente, v);
end $$;

/** Quem gere uma organização da frente põe (p_por) ou tira um ato que essa organização organiza. */
create or replace function public.rede_p4_frente_ato(p_frente uuid, p_ato uuid, p_por boolean) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid;
begin
  perform interno.alumia_porta();
  v := interno.rede_p4_ac_eu();
  if interno.rede_p4_frente_minha_org(p_frente, v) is null then perform interno.erro('sem_permissao'); end if;
  perform interno.limite('alumia_p4_frente_ato', 60, 60);
  if coalesce(p_por, false) then
    perform interno.rede_ato_achar(p_ato, v);
    -- O ato tem de ser de uma organização da frente: o autor é ela, ou ela aceitou organizar junto.
    if not exists (select 1 from rede_p4_frente_orgs fo where fo.frente = p_frente and fo.aceita_em is not null and interno.alumia_org_gere(v, fo.org)
                     and (exists (select 1 from rede_posts p where p.id = p_ato and p.autor = fo.org)
                          or exists (select 1 from rede_ato_coletivos c where c.ato = p_ato and c.org = fo.org and c.aceito_em is not null))) then
      perform interno.erro('so_quem_organizou');
    end if;
    insert into rede_p4_frente_atos (frente, ato) values (p_frente, p_ato) on conflict do nothing;
  else
    delete from rede_p4_frente_atos where frente = p_frente and ato = p_ato;
  end if;
  return interno.rede_p4_frente_json(p_frente, v);
end $$;

do $$
declare f text;
  v_internas text[] := array['rede_p4_frente_minha_org(uuid, uuid)', 'rede_p4_frente_json(uuid, uuid)'];
  v_pessoa text[] := array['rede_p4_frente_criar(jsonb)', 'rede_p4_frente(text)', 'rede_p4_frentes()', 'rede_p4_frente_convidar(uuid, text)',
    'rede_p4_frente_responder(uuid, text, boolean)', 'rede_p4_frente_ato(uuid, uuid, boolean)'];
begin
  foreach f in array v_internas loop
    execute format('revoke all on function interno.%s from public', f);
    if exists (select 1 from pg_roles where rolname = 'anon') then execute format('revoke all on function interno.%s from anon, authenticated', f); end if;
  end loop;
  foreach f in array v_pessoa loop
    execute format('revoke all on function public.%s from public', f);
    if exists (select 1 from pg_roles where rolname = 'anon') then
      execute format('revoke all on function public.%s from anon', f);
      execute format('grant execute on function public.%s to authenticated, service_role', f);
    end if;
  end loop;
end $$;

-- ═══ Item 98 · Pouso solidário ══════════════════════════════════════════════════════════════════════════════════════
-- Hospedagem para quem vem de fora (ato, congresso, plenária), SEMPRE combinada pela organização com selo. Quem pode receber
-- oferece à organização (cidade, quantas pessoas, de quando a quando, observação sem endereço); quem precisa pede (cidade, quantas
-- pessoas, chegada e saída). Ninguém vê oferta nem pedido de outra pessoa; só a gestão da organização vê os dois lados, com o
-- codinome e o @ de cada um, para combinar por mensagem — é a exceção do lote, e só porque a própria pessoa escolheu oferecer ou
-- pedir àquela organização. Endereço nunca entra (o texto é conferido). Tudo some 7 dias depois da data final.
-- PENDÊNCIA JURÍDICA: responsabilidade da organização pela hospedagem, termo de quem recebe e de quem vai, e menores de idade (o
-- relatório do lote tem as opções); até lá o interruptor fica desligado.
create table if not exists interno.rede_p4_pouso_abertos (
  org uuid primary key references interno.rede_orgs (perfil) on delete cascade,
  sobre text not null default '' check (char_length(sobre) <= 500),
  aberto_em timestamptz not null default now()
);

-- O pouso solidário (item 98): a oferta ou o pedido de hospedagem, com cidade, datas e número de pessoas; só a gestão vê quem.
create table if not exists interno.rede_p4_pouso (
  id uuid primary key default gen_random_uuid(),
  org uuid not null references interno.rede_p4_pouso_abertos (org) on delete cascade,
  -- Quem ofereceu ou pediu: a gestão da organização vê (para combinar); mais ninguém.
  quem uuid not null references interno.perfis (id) on delete cascade,
  tipo text not null check (tipo in ('oferta', 'pedido')),
  cidade text not null check (char_length(cidade) between 2 and 60),
  pessoas smallint not null check (pessoas between 1 and 10),
  de date not null,
  ate date not null,
  observacao text not null default '' check (char_length(observacao) <= 300),
  estado text not null default 'aberto' check (estado in ('aberto', 'combinado')),
  criado_em timestamptz not null default now(),
  check (ate >= de and ate <= de + 30)
);
create index if not exists rede_p4_pouso_org on interno.rede_p4_pouso (org, tipo, de);
create index if not exists rede_p4_pouso_quem on interno.rede_p4_pouso (quem);

do $$
declare t text;
begin
  foreach t in array array['rede_p4_pouso_abertos', 'rede_p4_pouso'] loop
    execute format('alter table interno.%I enable row level security', t);
    execute format('revoke all on table interno.%I from public', t);
    if exists (select 1 from pg_roles where rolname = 'anon') then execute format('revoke all on table interno.%I from anon, authenticated', t); end if;
  end loop;
end $$;

/** Uma oferta ou pedido como sai. p_gestao: a gestão vê o codinome e o @ (para combinar); a própria pessoa não precisa. */
create or replace function interno.rede_p4_pouso_json(p_id uuid, p_gestao boolean) returns jsonb language sql stable security definer set search_path = interno, pg_temp as $$
  select jsonb_build_object('id', x.id, 'tipo', x.tipo, 'cidade', x.cidade, 'pessoas', x.pessoas, 'de', x.de, 'ate', x.ate, 'observacao', x.observacao, 'estado', x.estado,
    'org', interno.rede_p4_ac_org_json(x.org))
    || case when p_gestao then jsonb_build_object('codinome', interno.rede_nome(x.quem), 'handle', f.rede_handle) else '{}'::jsonb end
    from rede_p4_pouso x join perfis f on f.id = x.quem where x.id = p_id
$$;

/** Quem gere uma organização com selo abre (p_abrir) ou fecha o pouso solidário. Fechar apaga ofertas e pedidos. */
create or replace function public.rede_p4_pouso_abrir(p_handle text, p_abrir boolean, p_sobre text) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid; v_org uuid;
begin
  perform interno.alumia_porta();
  v := interno.rede_p4_ac_eu();
  v_org := interno.rede_p4_ac_gestao(p_handle, v, true);
  perform interno.limite('alumia_p4_pouso_abrir', 20, 60);
  if coalesce(p_abrir, false) then
    insert into rede_p4_pouso_abertos (org, sobre) values (v_org, interno.rede_p4_ac_campo(p_sobre, 'sobre', 0, 500))
    on conflict (org) do update set sobre = excluded.sobre;
  else
    delete from rede_p4_pouso_abertos where org = v_org;
  end if;
  return public.rede_p4_pouso();
end $$;

/**
 * O pouso para quem chama: as organizações com pouso aberto, as minhas ofertas e pedidos e, para cada organização que eu giro, os
 * dois lados (com codinome e @, para combinar).
 */
create or replace function public.rede_p4_pouso() returns jsonb language plpgsql stable security definer set search_path = interno, pg_temp as $$
declare v uuid;
begin
  perform interno.alumia_porta();
  v := interno.rede_p4_ac_eu();
  return jsonb_build_object(
    'orgs', coalesce((select jsonb_agg(interno.rede_p4_ac_org_json(a.org) || jsonb_build_object('sobre', a.sobre) order by f.rede_handle)
                        from rede_p4_pouso_abertos a join rede_orgs o on o.perfil = a.org join perfis f on f.id = a.org
                       where o.verificada_em is not null and not f.suspenso and not interno.rede_bloqueado(v, a.org)), '[]'::jsonb),
    'meus', coalesce((select jsonb_agg(interno.rede_p4_pouso_json(x.id, false) order by x.de) from rede_p4_pouso x where x.quem = v), '[]'::jsonb),
    'gestao', coalesce((select jsonb_agg(interno.rede_p4_ac_org_json(a.org) || jsonb_build_object(
                          'ofertas', coalesce((select jsonb_agg(interno.rede_p4_pouso_json(x.id, true) order by x.de) from rede_p4_pouso x where x.org = a.org and x.tipo = 'oferta'), '[]'::jsonb),
                          'pedidos', coalesce((select jsonb_agg(interno.rede_p4_pouso_json(x.id, true) order by x.de) from rede_p4_pouso x where x.org = a.org and x.tipo = 'pedido'), '[]'::jsonb)))
                          from rede_p4_pouso_abertos a where interno.alumia_org_gere(v, a.org)), '[]'::jsonb));
end $$;

/** Oferecer ou pedir pouso a uma organização. p: {org, tipo, cidade, pessoas, de, ate, observacao}. Até 3 abertos por pessoa. */
create or replace function public.rede_p4_pouso_por(p jsonb) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid; v_org uuid; v_tipo text := coalesce(p ->> 'tipo', ''); v_de date; v_ate date; v_n integer;
begin
  perform interno.alumia_porta();
  v := interno.rede_p4_ac_eu();
  v_org := interno.rede_p4_ac_org(p ->> 'org');
  if v_org is null or not exists (select 1 from rede_p4_pouso_abertos where org = v_org) or not interno.alumia_o13_selo(v_org) or interno.rede_bloqueado(v, v_org) then
    perform interno.erro('nao_encontrado');
  end if;
  if v_tipo not in ('oferta', 'pedido') then perform interno.erro('invalido:tipo'); end if;
  begin
    v_de := (p ->> 'de')::date; v_ate := (p ->> 'ate')::date; v_n := (p ->> 'pessoas')::integer;
  exception when others then
    perform interno.erro('invalido:data');
  end;
  if v_de is null or v_ate is null or v_de < current_date or v_ate < v_de or v_ate > v_de + 30 or v_de > current_date + 366 then perform interno.erro('invalido:data'); end if;
  if v_n is null or v_n not between 1 and 10 then perform interno.erro('invalido:pessoas'); end if;
  if (select count(*) from rede_p4_pouso where quem = v) >= 3 then perform interno.erro('limite'); end if;
  perform interno.limite('alumia_p4_pouso', 10, 1440);
  insert into rede_p4_pouso (org, quem, tipo, cidade, pessoas, de, ate, observacao)
  values (v_org, v, v_tipo, interno.rede_p4_ac_campo(p ->> 'cidade', 'cidade', 2, 60), v_n, v_de, v_ate, interno.rede_p4_ac_campo(p ->> 'observacao', 'observacao', 0, 300));
  return public.rede_p4_pouso();
end $$;

/** A própria pessoa tira a dela; a gestão da organização marca "combinado" ou tira. */
create or replace function public.rede_p4_pouso_mudar(p_id uuid, p_acao text) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid; x rede_p4_pouso;
begin
  perform interno.alumia_porta();
  v := interno.rede_p4_ac_eu();
  select * into x from rede_p4_pouso where id = p_id for update;
  if not found or (x.quem <> v and not interno.alumia_org_gere(v, x.org)) then perform interno.erro('nao_encontrado'); end if;
  if p_acao = 'tirar' then delete from rede_p4_pouso where id = p_id;
  elsif p_acao = 'combinado' and interno.alumia_org_gere(v, x.org) then update rede_p4_pouso set estado = 'combinado' where id = p_id;
  else perform interno.erro('invalido:acao'); end if;
  return public.rede_p4_pouso();
end $$;

/** A faxina (chave de serviço, uma vez por dia): o que acabou há mais de 7 dias some. */
create or replace function public.rede_p4_pouso_faxina() returns integer language plpgsql security definer set search_path = interno, pg_temp as $$
declare n integer;
begin
  perform interno.alumia_porta();
  delete from rede_p4_pouso where ate < current_date - 7;
  get diagnostics n = row_count;
  return n;
end $$;

do $$
declare f text;
  v_pessoa text[] := array['rede_p4_pouso_abrir(text, boolean, text)', 'rede_p4_pouso()', 'rede_p4_pouso_por(jsonb)', 'rede_p4_pouso_mudar(uuid, text)'];
begin
  revoke all on function interno.rede_p4_pouso_json(uuid, boolean) from public;
  revoke all on function public.rede_p4_pouso_faxina() from public;
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on function interno.rede_p4_pouso_json(uuid, boolean) from anon, authenticated;
    revoke all on function public.rede_p4_pouso_faxina() from anon, authenticated;
    grant execute on function public.rede_p4_pouso_faxina() to service_role;
  end if;
  foreach f in array v_pessoa loop
    execute format('revoke all on function public.%s from public', f);
    if exists (select 1 from pg_roles where rolname = 'anon') then
      execute format('revoke all on function public.%s from anon', f);
      execute format('grant execute on function public.%s to authenticated, service_role', f);
    end if;
  end loop;
end $$;

-- ═══ Item 99 · Ficha de filiação cifrada ══════════════════════════════════════════════════════════════════════════════
-- Filiação é dado sensível (LGPD, art. 11). A ficha é cifrada NO APARELHO de quem se filia, com a biblioteca de cifra que o projeto
-- já usa (lib/rede/seguranca-pessoal/selo.ts: HPKE com X-Wing e AES-256-GCM, a mesma construção do lote de segurança pessoal, com
-- o rótulo próprio "filiacao"), para a CHAVE DE SEGURANÇA de cada pessoa que gere a organização (interno.rede_p4_seg_chaves; a
-- privada fica só no aparelho dela). O banco guarda a cifra (sempre do mesmo tamanho), os embrulhos e o resumo (sha256) de um RECIBO
-- que só quem mandou tem: com ele, a pessoa desfaz a filiação a qualquer hora. O banco NÃO guarda quem mandou, nem a hora (só o
-- dia). A ficha some em 180 dias ou quando a gestão apaga (ela baixa a lista aberta no próprio aparelho).
-- PENDÊNCIA JURÍDICA: base legal, prazo de guarda e o que fazer com fichas de partido (Lei 9.096/1995, filiação partidária oficial é
-- no sistema da Justiça Eleitoral). Até lá o interruptor fica desligado.
create table if not exists interno.rede_p4_filiacao_abertas (
  org uuid primary key references interno.rede_orgs (perfil) on delete cascade,
  sobre text not null default '' check (char_length(sobre) <= 500),
  aberta_em timestamptz not null default now()
);

create table if not exists interno.rede_p4_filiacoes (
  id uuid primary key,
  org uuid not null references interno.rede_p4_filiacao_abertas (org) on delete cascade,
  -- iv (12) ‖ AES-GCM(ficha preenchida até 4096 bytes) ‖ etiqueta (16): todas do mesmo tamanho.
  cifra bytea not null check (octet_length(cifra) = 12 + 4096 + 16),
  recibo bytea not null check (octet_length(recibo) = 32),
  criado_dia date not null default current_date,
  apagar_em date not null default current_date + 180
);
create index if not exists rede_p4_filiacoes_org on interno.rede_p4_filiacoes (org);
create index if not exists rede_p4_filiacoes_apagar on interno.rede_p4_filiacoes (apagar_em);

-- A chave da ficha de filiação (item 99), cifrada para cada conta que a organização escolheu para ler; o servidor não abre.
create table if not exists interno.rede_p4_filiacao_embrulhos (
  filiacao uuid not null references interno.rede_p4_filiacoes (id) on delete cascade,
  conta uuid not null references interno.perfis (id) on delete cascade,
  embrulho bytea not null check (octet_length(embrulho) = 1168),
  primary key (filiacao, conta)
);
create index if not exists rede_p4_filiacao_embrulhos_conta on interno.rede_p4_filiacao_embrulhos (conta);

do $$
declare t text;
begin
  foreach t in array array['rede_p4_filiacao_abertas', 'rede_p4_filiacoes', 'rede_p4_filiacao_embrulhos'] loop
    execute format('alter table interno.%I enable row level security', t);
    execute format('revoke all on table interno.%I from public', t);
    if exists (select 1 from pg_roles where rolname = 'anon') then execute format('revoke all on table interno.%I from anon, authenticated', t); end if;
  end loop;
end $$;

/** Quem gere uma organização com selo abre (ou fecha) a filiação pela Alumia. Fechar apaga as fichas que ainda estão lá. */
create or replace function public.rede_p4_filiacao_abrir(p_handle text, p_abrir boolean, p_sobre text) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid; v_org uuid;
begin
  perform interno.alumia_porta();
  v := interno.rede_p4_ac_eu();
  v_org := interno.rede_p4_ac_gestao(p_handle, v, true);
  perform interno.limite('alumia_p4_filiacao_abrir', 20, 60);
  if coalesce(p_abrir, false) then
    insert into rede_p4_filiacao_abertas (org, sobre) values (v_org, interno.rede_p4_ac_campo(p_sobre, 'sobre', 0, 500)) on conflict (org) do update set sobre = excluded.sobre;
  else
    delete from rede_p4_filiacao_abertas where org = v_org;
  end if;
  return public.rede_p4_filiacao_orgs();
end $$;

/**
 * As organizações com a filiação aberta e pronta (alguém da gestão tem chave de segurança), e as que eu giro: se a filiação está
 * aberta, se eu tenho chave e quantas fichas há para mim. Nunca quem gere.
 */
create or replace function public.rede_p4_filiacao_orgs() returns jsonb language plpgsql stable security definer set search_path = interno, pg_temp as $$
declare v uuid;
begin
  perform interno.alumia_porta();
  v := interno.rede_p4_ac_eu();
  return jsonb_build_object(
    'orgs', coalesce((select jsonb_agg(interno.rede_p4_ac_org_json(a.org) || jsonb_build_object('sobre', a.sobre) order by f.rede_handle)
                        from rede_p4_filiacao_abertas a join rede_orgs o on o.perfil = a.org join perfis f on f.id = a.org
                       where o.verificada_em is not null and not f.suspenso and not interno.rede_bloqueado(v, a.org)
                         and exists (select 1 from rede_org_gestores g join rede_p4_seg_chaves c on c.usuario = g.gestor join diretorio_contas d on d.usuario = g.gestor where g.org = a.org)), '[]'::jsonb),
    'gestao', coalesce((select jsonb_agg(interno.rede_p4_ac_org_json(g.org) || jsonb_build_object(
                          'aberta', exists (select 1 from rede_p4_filiacao_abertas a where a.org = g.org),
                          'minha_chave', exists (select 1 from rede_p4_seg_chaves c where c.usuario = v),
                          'fichas', (select count(*) from rede_p4_filiacoes x join rede_p4_filiacao_embrulhos e on e.filiacao = x.id and e.conta = v where x.org = g.org)))
                          from rede_org_gestores g join rede_orgs o on o.perfil = g.org where g.gestor = v and o.verificada_em is not null), '[]'::jsonb));
end $$;

/** As chaves para cifrar a ficha: de cada pessoa que gere a organização e tem chave, a conta, a identidade e a chave assinada. */
create or replace function public.rede_p4_filiacao_destinos(p_handle text) returns jsonb language plpgsql volatile security definer set search_path = interno, pg_temp as $$
declare v uuid; v_org uuid := interno.rede_p4_ac_org(p_handle);
begin
  perform interno.alumia_porta();
  v := interno.rede_p4_ac_eu();
  if v_org is null or not exists (select 1 from rede_p4_filiacao_abertas where org = v_org) or not interno.alumia_o13_selo(v_org) or interno.rede_bloqueado(v, v_org) then
    perform interno.erro('nao_encontrado');
  end if;
  perform interno.limite('alumia_p4_filiacao_destinos', 60, 60);
  return coalesce((select jsonb_agg(jsonb_build_object('conta', g.gestor, 'identidade', encode(d.identidade, 'base64'),
                                                       'publica', encode(c.publica, 'base64'), 'assinatura', encode(c.assinatura, 'base64')) order by g.gestor)
                     from rede_org_gestores g join rede_p4_seg_chaves c on c.usuario = g.gestor join diretorio_contas d on d.usuario = g.gestor join perfis f on f.id = g.gestor
                    where g.org = v_org and not f.suspenso), '[]'::jsonb);
end $$;

/**
 * Mandar a ficha já cifrada: {org, id, cifra, recibo (o resumo sha256 do recibo, 32 bytes), embrulhos: [{conta, embrulho}]}. Cada
 * embrulho tem de ser para alguém que gere a organização e tem chave. O banco NÃO grava quem mandou.
 */
create or replace function public.rede_p4_filiacao_enviar(p jsonb) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid; v_org uuid := interno.rede_p4_ac_org(p ->> 'org'); v_id uuid; v_cifra bytea; v_recibo bytea; e jsonb; v_conta uuid; v_contas uuid[] := '{}';
begin
  perform interno.alumia_porta();
  v := interno.rede_p4_ac_eu();
  if v_org is null or not exists (select 1 from rede_p4_filiacao_abertas where org = v_org) or not interno.alumia_o13_selo(v_org) or interno.rede_bloqueado(v, v_org) then
    perform interno.erro('nao_encontrado');
  end if;
  begin
    v_id := (p ->> 'id')::uuid;
  exception when others then
    perform interno.erro('invalido:id');
  end;
  if v_id is null or exists (select 1 from rede_p4_filiacoes where id = v_id) then perform interno.erro('invalido:id'); end if;
  v_cifra := interno.rede_p4_seg_bytes(p ->> 'cifra', 'cifra', 12 + 4096 + 16, 12 + 4096 + 16);
  v_recibo := interno.rede_p4_seg_bytes(p ->> 'recibo', 'recibo', 32, 32);
  if jsonb_typeof(p -> 'embrulhos') is distinct from 'array' or jsonb_array_length(p -> 'embrulhos') not between 1 and 20 then perform interno.erro('invalido:embrulhos'); end if;
  perform interno.limite('alumia_p4_filiacao', 5, 1440);
  insert into rede_p4_filiacoes (id, org, cifra, recibo) values (v_id, v_org, v_cifra, v_recibo);
  for e in select * from jsonb_array_elements(p -> 'embrulhos') loop
    begin
      v_conta := (e ->> 'conta')::uuid;
    exception when others then
      perform interno.erro('invalido:embrulhos');
    end;
    if v_conta = any (v_contas) or not exists (select 1 from rede_org_gestores g join rede_p4_seg_chaves c on c.usuario = g.gestor where g.org = v_org and g.gestor = v_conta) then
      perform interno.erro('invalido:embrulhos');
    end if;
    v_contas := v_contas || v_conta;
    insert into rede_p4_filiacao_embrulhos (filiacao, conta, embrulho) values (v_id, v_conta, interno.rede_p4_seg_bytes(e ->> 'embrulho', 'embrulho', 1168, 1168));
  end loop;
  return jsonb_build_object('ok', true, 'id', v_id);
end $$;

/** Desfazer a filiação com o recibo (só quem mandou o tem). Sem conta: vale o recibo. */
create or replace function public.rede_p4_filiacao_cancelar(p_id uuid, p_recibo text) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid; v_rec bytea;
begin
  perform interno.alumia_porta();
  v := interno.rede_p4_ac_eu();
  perform interno.limite('alumia_p4_filiacao_cancelar', 20, 60);
  v_rec := interno.rede_p4_seg_bytes(p_recibo, 'recibo', 16, 64);
  delete from rede_p4_filiacoes where id = p_id and recibo = sha256(v_rec);
  if not found then perform interno.erro('nao_encontrado'); end if;
  return jsonb_build_object('ok', true);
end $$;

/** As fichas de uma organização que eu giro, com o MEU embrulho (só abre no meu aparelho). */
create or replace function public.rede_p4_filiacoes(p_handle text) returns jsonb language plpgsql volatile security definer set search_path = interno, pg_temp as $$
declare v uuid; v_org uuid;
begin
  perform interno.alumia_porta();
  v := interno.rede_p4_ac_eu();
  v_org := interno.rede_p4_ac_gestao(p_handle, v, true);
  perform interno.limite('alumia_p4_filiacoes_ler', 120, 60);
  return coalesce((select jsonb_agg(jsonb_build_object('id', x.id, 'dia', x.criado_dia, 'apagar_em', x.apagar_em, 'cifra', encode(x.cifra, 'base64'), 'embrulho', encode(e.embrulho, 'base64'))
                                    order by x.criado_dia, x.id)
                     from rede_p4_filiacoes x join rede_p4_filiacao_embrulhos e on e.filiacao = x.id and e.conta = v where x.org = v_org), '[]'::jsonb);
end $$;

/** Quem gere apaga uma ficha (depois de baixar no aparelho). */
create or replace function public.rede_p4_filiacao_apagar(p_id uuid) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid; v_org uuid;
begin
  perform interno.alumia_porta();
  v := interno.rede_p4_ac_eu();
  select org into v_org from rede_p4_filiacoes where id = p_id;
  if v_org is null or not interno.alumia_org_gere(v, v_org) then perform interno.erro('nao_encontrado'); end if;
  delete from rede_p4_filiacoes where id = p_id;
  return jsonb_build_object('ok', true);
end $$;

/** A faxina (chave de serviço, uma vez por dia): fichas com o prazo vencido somem. */
create or replace function public.rede_p4_filiacao_faxina() returns integer language plpgsql security definer set search_path = interno, pg_temp as $$
declare n integer;
begin
  perform interno.alumia_porta();
  delete from rede_p4_filiacoes where apagar_em < current_date;
  get diagnostics n = row_count;
  return n;
end $$;

do $$
declare f text;
  v_pessoa text[] := array['rede_p4_filiacao_abrir(text, boolean, text)', 'rede_p4_filiacao_orgs()', 'rede_p4_filiacao_destinos(text)', 'rede_p4_filiacao_enviar(jsonb)',
    'rede_p4_filiacao_cancelar(uuid, text)', 'rede_p4_filiacoes(text)', 'rede_p4_filiacao_apagar(uuid)'];
begin
  revoke all on function public.rede_p4_filiacao_faxina() from public;
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on function public.rede_p4_filiacao_faxina() from anon, authenticated;
    grant execute on function public.rede_p4_filiacao_faxina() to service_role;
  end if;
  foreach f in array v_pessoa loop
    execute format('revoke all on function public.%s from public', f);
    if exists (select 1 from pg_roles where rolname = 'anon') then
      execute format('revoke all on function public.%s from anon', f);
      execute format('grant execute on function public.%s to authenticated, service_role', f);
    end if;
  end loop;
end $$;

-- A faxina diária pelo pg_cron (da junção): o pouso que acabou há mais de 7 dias e a ficha de filiação vencida (180 dias) somem do
-- banco, como fazem public.rede_p4_pouso_faxina() e public.rede_p4_filiacao_faxina(), que continuam para a chave de serviço. A rotina
-- apaga direto nas tabelas (não passa pela porta da entrada, que é das chamadas de conta). Sem o pg_cron, só avisa.
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule('alumia-p4-coletiva-faxina', '41 3 * * *',
      'delete from interno.rede_p4_pouso where ate < current_date - 7; delete from interno.rede_p4_filiacoes where apagar_em < current_date');
  end if;
exception when others then
  raise warning 'alumia-p4-coletiva-faxina: a rotina não foi agendada (%).', sqlerrm;
end $$;

select interno.alumia_trancar();
