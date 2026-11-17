-- ───────────────────────────── Alumia, onda 10, frente 10C: a estrutura das comunidades ─────────────────────────────
-- Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
--
-- O que este arquivo faz, e só isto:
--   1. Subcomunidades (L2-53): uma comunidade abriga outras. A moderação da filha pede, a da mãe aceita (ou a mediação liga direto).
--      Um nível só: a mãe não tem mãe e a filha não abriga outras. A filha escolhe a herança: "propria" (só a moderação dela) ou
--      "mae" (a moderação da mãe também modera a filha). A herança vira papel de verdade em rede_comunidade_membros, marcado em
--      alumia_com_herdados para voltar ao que era quando a herança acaba; assim toda conferência de moderação que já existe vale.
--   2. A aba "Espaços" da organização (L3-13): as comunidades ligadas a uma organização com selo (a moderação da comunidade pede,
--      quem gerencia a organização aceita) e os núcleos dela, num lugar só. Lugares, nunca pessoas.
--   3. Comunidade só leitura (L2-52): só a moderação (e quem tiver cargo com permissão, quando a 10B entregar os cargos) abre post;
--      as respostas ficam abertas a todos, só a quem é da comunidade, ou fechadas, conforme a escolha. Vale em qualquer caminho
--      (gatilho antes de gravar o post).
--   4. Comunidades por cidade e bairro: município e bairro ESCRITOS pela moderação, com a UF. Nada de GPS nem de mapa de fora. A
--      lista por município conta comunidades (lugares), nunca pessoas.
--   5. Repostar em outra comunidade (L3-14): é uma citação (rede_conv_citar, com todas as conferências de publicar) gravada na
--      comunidade de destino, com a origem guardada à parte para o cartão mostrar de onde veio. Só post de primeiro nível com
--      público "membros" ou "internet" (nunca o de comunidade, núcleo, seguidores ou equipe), só se quem escreveu deixa citar
--      (citar_quem) e só se a comunidade de destino aceita (todos, só a moderação ou ninguém). O repost nunca abre mais que o
--      original: se o destino é aberto à internet e o original não, sai para membros.
--   6. A proposta de comunidade nova pode já trazer a cidade, o bairro e a comunidade-mãe (vira pedido para a mãe na aprovação).
--
-- Nenhuma coluna de endereço de rede; nenhuma função devolve lista de pessoas (quem modera, quem é membro, quem repostou).
-- Tabelas no esquema interno, RLS ligada e sem política; acesso só pelas funções abaixo (security definer, search_path fixo).
-- Pode rodar mais de uma vez, sem apagar dado nenhum. Teste: scripts/testar-alumia-o10-estrutura.mjs.

-- ── 1. Tabelas ─────────────────────────────────────────────────────────────────────────────────────────────────────────────

create table if not exists interno.alumia_com_estrutura (
  comunidade text primary key references interno.rede_comunidades (slug) on delete cascade on update cascade,
  mae text references interno.rede_comunidades (slug) on delete set null on update cascade,
  mae_situacao text check (mae_situacao is null or mae_situacao in ('pedido', 'aceito')),
  heranca text not null default 'propria' check (heranca in ('propria', 'mae')),
  so_leitura boolean not null default false,
  respostas text not null default 'todos' check (respostas in ('todos', 'membros', 'ninguem')),
  reposts text not null default 'todos' check (reposts in ('todos', 'moderacao', 'ninguem')),
  org uuid references interno.rede_orgs (perfil) on delete set null,
  org_situacao text check (org_situacao is null or org_situacao in ('pedido', 'aceito')),
  uf text check (uf is null or uf in ('AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG', 'PA',
                                      'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO')),
  municipio text check (municipio is null or char_length(municipio) between 2 and 80),
  bairro text check (bairro is null or char_length(bairro) between 2 and 80),
  atualizado_em timestamptz not null default now(),
  check (mae is distinct from comunidade),
  check ((mae is null) = (mae_situacao is null)),
  check ((org is null) = (org_situacao is null)),
  check (municipio is null or uf is not null),
  check (bairro is null or municipio is not null)
);
create index if not exists alumia_com_estrutura_mae on interno.alumia_com_estrutura (mae) where mae is not null;
create index if not exists alumia_com_estrutura_org on interno.alumia_com_estrutura (org) where org is not null;
create index if not exists alumia_com_estrutura_cidade on interno.alumia_com_estrutura (uf, municipio) where municipio is not null;

-- Quem modera a filha só por herança, e o que era antes (para voltar quando a herança acaba). Nunca sai em função nenhuma.
create table if not exists interno.alumia_com_herdados (
  comunidade text not null references interno.rede_comunidades (slug) on delete cascade on update cascade,
  usuario uuid not null references interno.perfis (id) on delete cascade,
  papel_antes text check (papel_antes is null or papel_antes in ('membro', 'moderacao')),
  situacao_antes text check (situacao_antes is null or situacao_antes in ('ativo', 'pendente', 'banido')),
  primary key (comunidade, usuario)
);

-- De onde veio cada repost entre comunidades (origem nula = o post não era de comunidade). Sem coluna de pessoa.
create table if not exists interno.alumia_com_reposts (
  post uuid primary key references interno.rede_posts (id) on delete cascade,
  origem text references interno.rede_comunidades (slug) on delete set null on update cascade,
  destino text not null references interno.rede_comunidades (slug) on delete cascade on update cascade,
  criado_em timestamptz not null default now()
);

-- O que a proposta de comunidade nova já traz (some quando a proposta é decidida).
create table if not exists interno.alumia_com_proposta_estrutura (
  proposta uuid primary key references interno.rede_propostas (id) on delete cascade,
  mae text references interno.rede_comunidades (slug) on delete set null on update cascade,
  uf text check (uf is null or uf in ('AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG', 'PA',
                                      'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO')),
  municipio text check (municipio is null or char_length(municipio) between 2 and 80),
  bairro text check (bairro is null or char_length(bairro) between 2 and 80),
  check (municipio is null or uf is not null),
  check (bairro is null or municipio is not null)
);

alter table interno.alumia_com_estrutura enable row level security;
alter table interno.alumia_com_herdados enable row level security;
alter table interno.alumia_com_reposts enable row level security;
alter table interno.alumia_com_proposta_estrutura enable row level security;
revoke all on table interno.alumia_com_estrutura, interno.alumia_com_herdados, interno.alumia_com_reposts, interno.alumia_com_proposta_estrutura from public;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on table interno.alumia_com_estrutura, interno.alumia_com_herdados, interno.alumia_com_reposts, interno.alumia_com_proposta_estrutura from anon, authenticated;
  end if;
end $$;

-- ── 2. Auxiliares internos ─────────────────────────────────────────────────────────────────────────────────────────────────

/**
 * Ponto de encaixe dos cargos (frente 10B): quem tem cargo com permissão de postar numa comunidade só leitura. Aqui nasce
 * respondendo "não"; a 10B (ou quem junta) a redefine. Só é criada se ainda não existe, para esta migração rodada de novo não
 * apagar a versão da 10B.
 */
do $$
begin
  if to_regprocedure('interno.alumia_o10_cargo_posta(text, uuid)') is null then
    execute $f$
      create function interno.alumia_o10_cargo_posta(p_com text, p_quem uuid) returns boolean language sql stable security definer
      set search_path = interno, pg_temp as $c$ select false $c$
    $f$;
  end if;
end $$;

/** A comunidade aparece para quem pergunta? (espaço fechado da Rede de hoje nunca; comunidade fechada só para quem é dela ou modera) */
create or replace function interno.alumia_o10_aparece(c interno.rede_comunidades, p_quem uuid) returns boolean language sql stable security definer set search_path = interno, pg_temp as $$
  select c.slug is not null and c.slug not like 'fechado-%'
    and (c.tipo <> 'fechada' or interno.rede2_na_comunidade(c.slug, p_quem) or interno.rede3_com_modera(c.slug, p_quem))
$$;

/** O nome escrito arrumado: espaços em excesso fora, vazio vira nulo. */
create or replace function interno.alumia_o10_nome_lugar(p text, p_campo text) returns text language plpgsql immutable as $$
declare v text := btrim(regexp_replace(coalesce(p, ''), '\s+', ' ', 'g'));
begin
  if v = '' then return null; end if;
  if char_length(v) not between 2 and 80 or v ~ '[<>{}\\]' then perform interno.erro('invalido:' || p_campo); end if;
  return v;
end $$;

/** Avisa quem modera uma comunidade (o aviso vai para cada pessoa; nenhuma lista sai daqui). */
create or replace function interno.alumia_o10_avisar_moderacao(p_com text, p_texto text) returns void language plpgsql security definer set search_path = interno, pg_temp as $$
declare m uuid;
begin
  for m in select usuario from rede_comunidade_membros where comunidade = p_com and papel = 'moderacao' and situacao = 'ativo' loop
    perform interno.avisar_em(m, p_texto, 'rede');
  end loop;
end $$;

/** Avisa quem gerencia uma organização. */
create or replace function interno.alumia_o10_avisar_org(p_org uuid, p_texto text) returns void language plpgsql security definer set search_path = interno, pg_temp as $$
declare m uuid;
begin
  for m in select gestor from rede_org_gestores where org = p_org loop
    perform interno.avisar_em(m, p_texto, 'rede');
  end loop;
end $$;

/**
 * Refaz a herança de moderação de uma filha: quem modera a mãe passa a moderar a filha (se a herança é "mae" e a mãe aceitou), e
 * quem só moderava por herança volta ao que era quando deixa de valer. Quem já moderava a filha por conta própria fica como está;
 * quem foi banido da filha não volta por herança.
 */
create or replace function interno.alumia_o10_herdar(p_filha text) returns void language plpgsql security definer set search_path = interno, pg_temp as $$
declare e alumia_com_estrutura; h alumia_com_herdados; v_vale boolean; r record; m rede_comunidade_membros;
begin
  select * into e from alumia_com_estrutura where comunidade = p_filha;
  v_vale := found and e.heranca = 'mae' and e.mae_situacao = 'aceito' and e.mae is not null;
  -- 1. Quem não deve mais herdar volta ao que era.
  for h in select * from alumia_com_herdados where comunidade = p_filha loop
    if not v_vale or not exists (select 1 from rede_comunidade_membros x where x.comunidade = e.mae and x.usuario = h.usuario and x.papel = 'moderacao' and x.situacao = 'ativo') then
      delete from alumia_com_herdados where comunidade = p_filha and usuario = h.usuario;
      if h.papel_antes is null then
        delete from rede_comunidade_membros where comunidade = p_filha and usuario = h.usuario and papel = 'moderacao';
      else
        update rede_comunidade_membros set papel = h.papel_antes, situacao = coalesce(h.situacao_antes, 'ativo')
        where comunidade = p_filha and usuario = h.usuario and papel = 'moderacao';
      end if;
    end if;
  end loop;
  if not v_vale then return; end if;
  -- 2. Quem modera a mãe e ainda não modera a filha passa a moderar.
  for r in
    select x.usuario from rede_comunidade_membros x
    where x.comunidade = e.mae and x.papel = 'moderacao' and x.situacao = 'ativo'
      and not exists (select 1 from alumia_com_herdados k where k.comunidade = p_filha and k.usuario = x.usuario)
  loop
    select * into m from rede_comunidade_membros where comunidade = p_filha and usuario = r.usuario;
    if not found then
      insert into rede_comunidade_membros (comunidade, usuario, papel, situacao) values (p_filha, r.usuario, 'moderacao', 'ativo');
      insert into alumia_com_herdados (comunidade, usuario) values (p_filha, r.usuario);
    elsif m.situacao = 'banido' or m.banido_ate > now() or (m.papel = 'moderacao' and m.situacao = 'ativo') then
      null;
    else
      update rede_comunidade_membros set papel = 'moderacao', situacao = 'ativo' where comunidade = p_filha and usuario = r.usuario;
      insert into alumia_com_herdados (comunidade, usuario, papel_antes, situacao_antes) values (p_filha, r.usuario, m.papel, m.situacao);
    end if;
  end loop;
end $$;

/**
 * Modera a comunidade por conta própria (não só pela herança da mãe). Ajustar a estrutura (herança, comunidade de avisos, mãe,
 * organização) é só de quem modera por conta própria: quem chegou pela herança não troca a mãe nem a herança da filha.
 */
create or replace function interno.alumia_o10_modera_propria(p_slug text, p_quem uuid) returns boolean language sql stable security definer set search_path = interno, pg_temp as $$
  select p_quem is not null and interno.rede3_com_modera(p_slug, p_quem)
    and not exists (select 1 from alumia_com_herdados h where h.comunidade = p_slug and h.usuario = p_quem)
$$;

/** A estrutura mudou (mãe, situação da mãe ou herança): refaz a herança da filha. */
create or replace function interno.alumia_o10_estrutura_mudou() returns trigger language plpgsql security definer set search_path = interno, pg_temp as $$
begin
  if tg_op = 'INSERT' or new.mae is distinct from old.mae or new.mae_situacao is distinct from old.mae_situacao or new.heranca is distinct from old.heranca then
    perform interno.alumia_o10_herdar(new.comunidade);
  end if;
  return null;
end $$;
drop trigger if exists alumia_o10_estrutura_mudou on interno.alumia_com_estrutura;
create trigger alumia_o10_estrutura_mudou after insert or update on interno.alumia_com_estrutura for each row execute function interno.alumia_o10_estrutura_mudou();

/**
 * Mudou a moderação de uma comunidade: se ela é mãe, as filhas que herdam acompanham. Quem sai da filha leva a marca de herança
 * junto. As mudanças que a própria herança faz (gatilho dentro de gatilho) não disparam de novo.
 */
create or replace function interno.alumia_o10_membros_mudou() returns trigger language plpgsql security definer set search_path = interno, pg_temp as $$
declare f text;
begin
  if pg_trigger_depth() > 1 then return null; end if;
  if tg_op = 'DELETE' then
    delete from alumia_com_herdados where comunidade = old.comunidade and usuario = old.usuario;
  end if;
  for f in select comunidade from alumia_com_estrutura where mae = coalesce(new.comunidade, old.comunidade) and mae_situacao = 'aceito' and heranca = 'mae' loop
    perform interno.alumia_o10_herdar(f);
  end loop;
  return null;
end $$;
drop trigger if exists alumia_o10_membros_mudou on interno.rede_comunidade_membros;
create trigger alumia_o10_membros_mudou after insert or update or delete on interno.rede_comunidade_membros for each row execute function interno.alumia_o10_membros_mudou();

/**
 * Comunidade só leitura: abrir post é da moderação (e de quem tem cargo com permissão); responder segue a escolha da comunidade.
 * Gatilho antes de gravar: vale para publicar, citar, repostar e qualquer caminho que venha depois.
 */
create or replace function interno.alumia_o10_so_leitura() returns trigger language plpgsql security definer set search_path = interno, pg_temp as $$
declare e alumia_com_estrutura;
begin
  if new.autor is null or new.comunidade is null then return new; end if;
  select * into e from alumia_com_estrutura where comunidade = new.comunidade;
  if not found or not e.so_leitura then return new; end if;
  if interno.rede3_com_modera(new.comunidade, new.autor) or interno.alumia_o10_cargo_posta(new.comunidade, new.autor) then return new; end if;
  if new.resposta_a is null then perform interno.erro('so_leitura'); end if;
  if e.respostas = 'ninguem' or (e.respostas = 'membros' and not interno.rede2_na_comunidade(new.comunidade, new.autor)) then
    perform interno.erro('so_leitura_respostas');
  end if;
  return new;
end $$;
drop trigger if exists alumia_o10_so_leitura on interno.rede_posts;
create trigger alumia_o10_so_leitura before insert on interno.rede_posts for each row execute function interno.alumia_o10_so_leitura();

/** A proposta foi decidida: aprovada, a cidade e o pedido à mãe entram na comunidade nova; em qualquer caso, o rascunho some. */
create or replace function interno.alumia_o10_proposta_decidida() returns trigger language plpgsql security definer set search_path = interno, pg_temp as $$
declare x alumia_com_proposta_estrutura; v_mae text;
begin
  if new.situacao = old.situacao or new.situacao = 'aberta' then return null; end if;
  select * into x from alumia_com_proposta_estrutura where proposta = new.id;
  if not found then return null; end if;
  if new.situacao = 'aprovada' and exists (select 1 from rede_comunidades where slug = new.slug) then
    -- A mãe só vale se ainda pode ser mãe (não é filha de ninguém).
    v_mae := case when x.mae is not null and x.mae <> new.slug
                    and not exists (select 1 from alumia_com_estrutura k where k.comunidade = x.mae and k.mae is not null) then x.mae end;
    insert into alumia_com_estrutura (comunidade, mae, mae_situacao, uf, municipio, bairro)
    values (new.slug, v_mae, case when v_mae is not null then 'pedido' end, x.uf, x.municipio, x.bairro)
    on conflict (comunidade) do nothing;
    if v_mae is not null then
      perform interno.alumia_o10_avisar_moderacao(v_mae, format('A comunidade nova “%s” pediu para ser subcomunidade de “%s”. Decida na aba Estrutura.',
        new.nome, (select nome from rede_comunidades where slug = v_mae)));
    end if;
  end if;
  delete from alumia_com_proposta_estrutura where proposta = new.id;
  return null;
end $$;
drop trigger if exists alumia_o10_proposta_decidida on interno.rede_propostas;
create trigger alumia_o10_proposta_decidida after update of situacao on interno.rede_propostas for each row execute function interno.alumia_o10_proposta_decidida();

/** Uma comunidade em JSON curto (sem contagem de pessoas). */
create or replace function interno.alumia_o10_com_json(c interno.rede_comunidades) returns jsonb language sql stable security definer set search_path = interno, pg_temp as $$
  select jsonb_build_object('slug', c.slug, 'nome', c.nome, 'descricao', c.descricao, 'tipo', c.tipo, 'categoria', c.categoria, 'cor', c.cor)
$$;

/** Posts da semana numa comunidade (agregado, sem nome; o número só a partir de 3, como os "posts da semana" de sempre). */
create or replace function interno.alumia_o10_posts_7d(p_com text) returns integer language sql stable security definer set search_path = interno, pg_temp as $$
  select interno.rede_alumia_agregado((select count(*)::integer from rede_posts p where p.comunidade = p_com and p.criado_em > now() - interval '7 days' and not p.oculto and not p.retido and p.apagado_em is null))
$$;

-- ── 3. Ler a estrutura de uma comunidade ────────────────────────────────────────────────────────────────────────────────────

/**
 * A estrutura de uma comunidade para a aba dela: a mãe (aceita), as filhas que quem pergunta pode ver, a herança, o modo só
 * leitura, quem pode responder e trazer reposts, a cidade escrita e a organização (com selo). Para a moderação, também os pedidos
 * pendentes (o dela à mãe e à organização, e os das filhas que querem morar aqui). Nunca uma lista de pessoas.
 */
create or replace function public.alumia_estr_ver(p_slug text) returns jsonb language plpgsql stable security definer set search_path = interno, pg_temp as $$
declare v uuid := auth.uid(); c rede_comunidades; e alumia_com_estrutura; v_mod boolean; v_tem boolean; v_mae rede_comunidades; v_org jsonb;
begin
  perform interno.aberta('comunidade');
  perform interno.limite('alumia_estr_ler', 300, 10);
  c := interno.rede3_com_achar(p_slug);
  if c.slug is null or not interno.alumia_o10_aparece(c, v) then perform interno.erro('nao_encontrado'); end if;
  v_mod := interno.rede3_com_modera(c.slug, v);
  select * into e from alumia_com_estrutura where comunidade = c.slug;
  v_tem := found;
  if v_tem and e.mae is not null then select * into v_mae from rede_comunidades where slug = e.mae; end if;
  if v_tem and e.org is not null then
    select jsonb_build_object('handle', f.rede_handle, 'codinome', coalesce(f.rede_codinome, ''), 'selo', o.verificada_em is not null)
      into v_org from rede_orgs o join perfis f on f.id = o.perfil where o.perfil = e.org and not f.suspenso;
  end if;
  return jsonb_build_object(
    'comunidade', c.slug,
    'nome', c.nome,
    'modero', v_mod,
    'ajusto', v_mod and interno.alumia_o10_modera_propria(c.slug, v),
    'mae', case when v_tem and e.mae_situacao = 'aceito' and interno.alumia_o10_aparece(v_mae, v) then interno.alumia_o10_com_json(v_mae) end,
    'mae_pedido', case when v_mod and v_tem and e.mae_situacao = 'pedido' then interno.alumia_o10_com_json(v_mae) end,
    'filhas', (select coalesce(jsonb_agg(interno.alumia_o10_com_json(k) || jsonb_build_object('bairro', x.bairro, 'municipio', x.municipio) order by k.nome), '[]'::jsonb)
               from alumia_com_estrutura x join rede_comunidades k on k.slug = x.comunidade
               where x.mae = c.slug and x.mae_situacao = 'aceito' and interno.alumia_o10_aparece(k, v)),
    'pedidos_filhas', case when v_mod then (
               select coalesce(jsonb_agg(interno.alumia_o10_com_json(k) || jsonb_build_object('heranca', x.heranca) order by k.nome), '[]'::jsonb)
               from alumia_com_estrutura x join rede_comunidades k on k.slug = x.comunidade where x.mae = c.slug and x.mae_situacao = 'pedido') end,
    'pode_ser_mae', not v_tem or e.mae is null,
    'pode_ser_filha', not exists (select 1 from alumia_com_estrutura x where x.mae = c.slug),
    'heranca', coalesce(e.heranca, 'propria'),
    'so_leitura', coalesce(e.so_leitura, false),
    'respostas', coalesce(e.respostas, 'todos'),
    'reposts', coalesce(e.reposts, 'todos'),
    'local', case when v_tem and e.municipio is not null then jsonb_build_object('uf', e.uf, 'municipio', e.municipio, 'bairro', e.bairro) end,
    'org', case when v_tem and e.org_situacao = 'aceito' and coalesce((v_org ->> 'selo')::boolean, false) then v_org end,
    'org_pedido', case when v_mod and v_tem and e.org_situacao = 'pedido' then v_org end,
    'posso_abrir_post', v is not null and (not coalesce(e.so_leitura, false) or v_mod or interno.alumia_o10_cargo_posta(c.slug, v)),
    'posso_responder', v is not null and (not coalesce(e.so_leitura, false) or v_mod or interno.alumia_o10_cargo_posta(c.slug, v)
                       or e.respostas = 'todos' or (e.respostas = 'membros' and interno.rede2_na_comunidade(c.slug, v))));
end $$;

-- ── 4. A moderação ajusta ───────────────────────────────────────────────────────────────────────────────────────────────────

/**
 * A moderação ajusta o que é da própria comunidade: so_leitura, respostas ('todos' | 'membros' | 'ninguem'), reposts ('todos' |
 * 'moderacao' | 'ninguem'), heranca ('propria' | 'mae'), uf, municipio e bairro (vazio apaga). Só o que vier muda; campo
 * desconhecido é recusado. Só a moderação própria da comunidade (quem chegou pela herança da mãe não ajusta).
 */
create or replace function public.alumia_estr_salvar(p_slug text, p jsonb) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); c rede_comunidades; e alumia_com_estrutura; k text; v_uf text; v_mun text; v_bai text;
begin
  perform interno.aberta('comunidade');
  perform interno.limite('alumia_estr', 60, 10);
  c := interno.rede3_com_achar(p_slug);
  if c.slug is null or c.slug like 'fechado-%' then perform interno.erro('nao_encontrado'); end if;
  if not interno.alumia_o10_modera_propria(c.slug, v) then perform interno.erro('sem_permissao'); end if;
  if p is null or jsonb_typeof(p) <> 'object' then perform interno.erro('invalido:estrutura'); end if;
  for k in select jsonb_object_keys(p) loop
    if k not in ('so_leitura', 'respostas', 'reposts', 'heranca', 'uf', 'municipio', 'bairro') then perform interno.erro('invalido:estrutura'); end if;
  end loop;
  if p ? 'so_leitura' and jsonb_typeof(p -> 'so_leitura') <> 'boolean' then perform interno.erro('invalido:so_leitura'); end if;
  if p ? 'respostas' and coalesce(p ->> 'respostas', '') not in ('todos', 'membros', 'ninguem') then perform interno.erro('invalido:respostas'); end if;
  if p ? 'reposts' and coalesce(p ->> 'reposts', '') not in ('todos', 'moderacao', 'ninguem') then perform interno.erro('invalido:reposts'); end if;
  if p ? 'heranca' and coalesce(p ->> 'heranca', '') not in ('propria', 'mae') then perform interno.erro('invalido:heranca'); end if;

  insert into alumia_com_estrutura (comunidade) values (c.slug) on conflict (comunidade) do nothing;
  select * into e from alumia_com_estrutura where comunidade = c.slug for update;
  v_uf := case when p ? 'uf' then nullif(upper(btrim(coalesce(p ->> 'uf', ''))), '') else e.uf end;
  v_mun := case when p ? 'municipio' then interno.alumia_o10_nome_lugar(p ->> 'municipio', 'municipio') else e.municipio end;
  v_bai := case when p ? 'bairro' then interno.alumia_o10_nome_lugar(p ->> 'bairro', 'bairro') else e.bairro end;
  if v_mun is null then v_bai := null; end if;
  if v_uf is not null and v_uf not in ('AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG', 'PA',
                                        'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO') then
    perform interno.erro('invalido:uf');
  end if;
  if v_mun is not null and v_uf is null then perform interno.erro('invalido:uf'); end if;
  update alumia_com_estrutura set
    so_leitura = case when p ? 'so_leitura' then (p ->> 'so_leitura')::boolean else so_leitura end,
    respostas = coalesce(p ->> 'respostas', respostas),
    reposts = coalesce(p ->> 'reposts', reposts),
    heranca = coalesce(p ->> 'heranca', heranca),
    uf = case when v_mun is null then null else v_uf end,
    municipio = v_mun, bairro = v_bai, atualizado_em = now()
  where comunidade = c.slug;
  perform interno.registrar('alumia_estr_salvar', c.slug, p - 'municipio' - 'bairro');
  return public.alumia_estr_ver(c.slug);
end $$;

-- ── 5. Subcomunidades ──────────────────────────────────────────────────────────────────────────────────────────────────────

/**
 * A moderação própria da filha pede para morar dentro de outra comunidade (p_mae nulo ou vazio: sai da mãe). Se quem pede também
 * modera a mãe (ou é da mediação), já fica aceito; senão a moderação da mãe é avisada e decide. Um nível só. Trocar de mãe (ou
 * sair dela) volta a herança para "propria": a filha escolhe de novo se quer a moderação da mãe nova.
 */
create or replace function public.alumia_estr_mae_pedir(p_slug text, p_mae text) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); c rede_comunidades; m rede_comunidades; v_aceito boolean;
begin
  perform interno.aberta('comunidade');
  perform interno.limite('alumia_estr', 60, 10);
  c := interno.rede3_com_achar(p_slug);
  if c.slug is null or c.slug like 'fechado-%' then perform interno.erro('nao_encontrado'); end if;
  if not interno.alumia_o10_modera_propria(c.slug, v) then perform interno.erro('sem_permissao'); end if;
  insert into alumia_com_estrutura (comunidade) values (c.slug) on conflict (comunidade) do nothing;
  perform 1 from alumia_com_estrutura where comunidade = c.slug for update;
  if nullif(btrim(coalesce(p_mae, '')), '') is null then
    update alumia_com_estrutura set mae = null, mae_situacao = null, heranca = 'propria', atualizado_em = now() where comunidade = c.slug;
    perform interno.registrar('alumia_estr_mae_sair', c.slug, '{}'::jsonb);
    return public.alumia_estr_ver(c.slug);
  end if;
  m := interno.rede3_com_achar(p_mae);
  if m.slug is null or m.slug like 'fechado-%' or not interno.alumia_o10_aparece(m, v) then perform interno.erro('nao_encontrado'); end if;
  if m.slug = c.slug then perform interno.erro('invalido:mae'); end if;
  -- Um nível só: a mãe não pode ser filha, e quem já abriga outras não vira filha.
  if exists (select 1 from alumia_com_estrutura x where x.comunidade = m.slug and x.mae is not null) then perform interno.erro('mae_e_filha'); end if;
  if exists (select 1 from alumia_com_estrutura x where x.mae = c.slug) then perform interno.erro('filha_e_mae'); end if;
  v_aceito := interno.rede3_com_modera(m.slug, v);
  update alumia_com_estrutura set mae = m.slug, mae_situacao = case when v_aceito then 'aceito' else 'pedido' end,
    heranca = case when mae is distinct from m.slug then 'propria' else heranca end, atualizado_em = now() where comunidade = c.slug;
  if not v_aceito then
    perform interno.alumia_o10_avisar_moderacao(m.slug, format('A comunidade “%s” pediu para ser subcomunidade de “%s”. Decida na aba Estrutura.', c.nome, m.nome));
  end if;
  perform interno.registrar('alumia_estr_mae_pedir', c.slug, jsonb_build_object('mae', m.slug, 'aceito', v_aceito));
  return public.alumia_estr_ver(c.slug);
end $$;

/** A moderação da mãe aceita ou recusa a filha que pediu (ou desfaz uma filha já aceita, com p_aceita falso). */
create or replace function public.alumia_estr_mae_decidir(p_mae text, p_filha text, p_aceita boolean) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); m rede_comunidades; e alumia_com_estrutura; v_nome text;
begin
  perform interno.aberta('comunidade');
  perform interno.limite('alumia_estr', 60, 10);
  m := interno.rede3_com_achar(p_mae);
  if m.slug is null then perform interno.erro('nao_encontrado'); end if;
  if not interno.rede3_com_modera(m.slug, v) then perform interno.erro('sem_permissao'); end if;
  select * into e from alumia_com_estrutura where comunidade = coalesce(p_filha, '') and mae = m.slug for update;
  if not found then perform interno.erro('nao_encontrado'); end if;
  if coalesce(p_aceita, false) then
    if exists (select 1 from alumia_com_estrutura x where x.comunidade = m.slug and x.mae is not null) then perform interno.erro('mae_e_filha'); end if;
    update alumia_com_estrutura set mae_situacao = 'aceito', atualizado_em = now() where comunidade = e.comunidade;
  else
    update alumia_com_estrutura set mae = null, mae_situacao = null, atualizado_em = now() where comunidade = e.comunidade;
  end if;
  select nome into v_nome from rede_comunidades where slug = e.comunidade;
  perform interno.alumia_o10_avisar_moderacao(e.comunidade, format(case when coalesce(p_aceita, false)
    then '“%s” aceitou “%s” como subcomunidade.' else '“%s” não abriga mais “%s” como subcomunidade.' end, m.nome, v_nome));
  perform interno.registrar('alumia_estr_mae_decidir', e.comunidade, jsonb_build_object('mae', m.slug, 'aceita', coalesce(p_aceita, false)));
  return public.alumia_estr_ver(m.slug);
end $$;

-- ── 6. A organização e os Espaços ───────────────────────────────────────────────────────────────────────────────────────────

/**
 * A moderação própria liga a comunidade a uma organização com selo (p_handle vazio: desliga). Se quem pede também gerencia a
 * organização, já fica aceito; senão quem gerencia é avisado e decide.
 */
create or replace function public.alumia_estr_org_pedir(p_slug text, p_handle text) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); c rede_comunidades; v_org uuid; v_aceito boolean;
begin
  perform interno.aberta('comunidade');
  perform interno.limite('alumia_estr', 60, 10);
  c := interno.rede3_com_achar(p_slug);
  if c.slug is null or c.slug like 'fechado-%' then perform interno.erro('nao_encontrado'); end if;
  if not interno.alumia_o10_modera_propria(c.slug, v) then perform interno.erro('sem_permissao'); end if;
  insert into alumia_com_estrutura (comunidade) values (c.slug) on conflict (comunidade) do nothing;
  if nullif(btrim(coalesce(p_handle, ''), ' @'), '') is null then
    update alumia_com_estrutura set org = null, org_situacao = null, atualizado_em = now() where comunidade = c.slug;
    perform interno.registrar('alumia_estr_org_sair', c.slug, '{}'::jsonb);
    return public.alumia_estr_ver(c.slug);
  end if;
  v_org := interno.alumia_org_de(p_handle);
  if v_org is null then perform interno.erro('nao_encontrado'); end if;
  if not exists (select 1 from rede_orgs o where o.perfil = v_org and o.verificada_em is not null) then perform interno.erro('sem_selo'); end if;
  v_aceito := interno.alumia_org_gere(v, v_org);
  update alumia_com_estrutura set org = v_org, org_situacao = case when v_aceito then 'aceito' else 'pedido' end, atualizado_em = now() where comunidade = c.slug;
  if not v_aceito then
    perform interno.alumia_o10_avisar_org(v_org, format('A comunidade “%s” pediu para aparecer nos Espaços da organização. Decida na aba Espaços do perfil.', c.nome));
  end if;
  perform interno.registrar('alumia_estr_org_pedir', c.slug, jsonb_build_object('aceito', v_aceito));
  return public.alumia_estr_ver(c.slug);
end $$;

/** Quem gerencia a organização aceita ou recusa a comunidade (ou tira dos Espaços uma já aceita, com p_aceita falso). */
create or replace function public.alumia_estr_org_decidir(p_handle text, p_slug text, p_aceita boolean) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); v_org uuid; e alumia_com_estrutura;
begin
  perform interno.aberta('comunidade');
  perform interno.limite('alumia_estr', 60, 10);
  v_org := interno.alumia_org_de(p_handle);
  if v_org is null then perform interno.erro('nao_encontrado'); end if;
  if not interno.alumia_org_gere(v, v_org) then perform interno.erro('sem_permissao'); end if;
  select * into e from alumia_com_estrutura where comunidade = coalesce(p_slug, '') and org = v_org for update;
  if not found then perform interno.erro('nao_encontrado'); end if;
  if coalesce(p_aceita, false) then
    update alumia_com_estrutura set org_situacao = 'aceito', atualizado_em = now() where comunidade = e.comunidade;
  else
    update alumia_com_estrutura set org = null, org_situacao = null, atualizado_em = now() where comunidade = e.comunidade;
  end if;
  perform interno.alumia_o10_avisar_moderacao(e.comunidade, case when coalesce(p_aceita, false)
    then 'A organização aceitou a comunidade nos Espaços dela.' else 'A comunidade não aparece mais nos Espaços da organização.' end);
  perform interno.registrar('alumia_estr_org_decidir', e.comunidade, jsonb_build_object('aceita', coalesce(p_aceita, false)));
  return public.alumia_estr_espacos(p_handle);
end $$;

/**
 * Os Espaços de uma organização com selo: as comunidades ligadas (com as filhas de cada uma que quem pergunta pode ver) e os
 * núcleos dela, num lugar só. Só lugares: nome, tipo, cidade escrita e posts da semana (agregado). Para quem gerencia, também os
 * pedidos de comunidades. Organização sem selo: nulo (a não ser para quem a gerencia, que vê os pedidos).
 */
create or replace function public.alumia_estr_espacos(p_handle text) returns jsonb language plpgsql stable security definer set search_path = interno, pg_temp as $$
declare v uuid := auth.uid(); v_org uuid; o rede_orgs; f perfis; v_gere boolean;
begin
  perform interno.aberta('comunidade');
  perform interno.limite('alumia_estr_ler', 300, 10);
  v_org := interno.alumia_org_de(p_handle);
  if v_org is null or interno.rede_bloqueado(v, v_org) then return null; end if;
  select * into o from rede_orgs where perfil = v_org;
  select * into f from perfis where id = v_org;
  v_gere := interno.alumia_org_gere(v, v_org);
  if o.verificada_em is null and not v_gere then return null; end if;
  return jsonb_build_object(
    'handle', f.rede_handle, 'codinome', coalesce(f.rede_codinome, ''), 'selo', o.verificada_em is not null, 'gerencio', v_gere,
    'comunidades', case when o.verificada_em is not null then (
      select coalesce(jsonb_agg(interno.alumia_o10_com_json(k) || jsonb_build_object(
          'municipio', x.municipio, 'uf', x.uf, 'bairro', x.bairro,
          'posts_7d', case when v is null then null else interno.alumia_o10_posts_7d(k.slug) end,
          'filhas', (select coalesce(jsonb_agg(interno.alumia_o10_com_json(q) order by q.nome), '[]'::jsonb)
                     from alumia_com_estrutura y join rede_comunidades q on q.slug = y.comunidade
                     where y.mae = k.slug and y.mae_situacao = 'aceito' and interno.alumia_o10_aparece(q, v)))
        order by k.nome), '[]'::jsonb)
      from alumia_com_estrutura x join rede_comunidades k on k.slug = x.comunidade
      where x.org = v_org and x.org_situacao = 'aceito' and interno.alumia_o10_aparece(k, v)) else '[]'::jsonb end,
    'nucleos', case when o.verificada_em is not null then (
      select coalesce(jsonb_agg(jsonb_build_object('id', n.id, 'nome', n.nome, 'quando', nullif(n.org_quando, ''),
          'cidade', coalesce(nullif(n.org_cidade, ''), nullif(n.cidade, '')), 'uf', n.org_uf) order by n.nome), '[]'::jsonb)
      from rede_nucleos n where n.org = v_org) else '[]'::jsonb end,
    'pedidos', case when v_gere then (
      select coalesce(jsonb_agg(interno.alumia_o10_com_json(k) order by k.nome), '[]'::jsonb)
      from alumia_com_estrutura x join rede_comunidades k on k.slug = x.comunidade where x.org = v_org and x.org_situacao = 'pedido') end);
end $$;

-- ── 7. Por cidade e bairro ──────────────────────────────────────────────────────────────────────────────────────────────────

/** Os municípios escritos que têm comunidade que quem pergunta pode ver, com quantas comunidades (lugares, não pessoas). */
create or replace function public.alumia_estr_cidades() returns jsonb language plpgsql stable security definer set search_path = interno, pg_temp as $$
declare v uuid := auth.uid();
begin
  perform interno.aberta('comunidade');
  perform interno.limite('alumia_estr_ler', 300, 10);
  return (select coalesce(jsonb_agg(jsonb_build_object('uf', z.uf, 'municipio', z.municipio, 'comunidades', z.n) order by z.uf, z.chave), '[]'::jsonb) from (
    select x.uf, interno.normal(x.municipio) as chave, min(x.municipio) as municipio, count(*)::integer as n
    from alumia_com_estrutura x join rede_comunidades k on k.slug = x.comunidade
    where x.municipio is not null and interno.alumia_o10_aparece(k, v)
      -- Visitante: só o que a lista de comunidades já mostra a ele (as disciplinas e a amostra das abertas e restritas).
      and (v is not null or k.categoria = 'disciplinas' or k.tipo in ('aberta', 'restrita'))
    group by x.uf, interno.normal(x.municipio)) z);
end $$;

/** As comunidades de um município (a cidade toda primeiro, depois por bairro), com a situação de quem pergunta. */
create or replace function public.alumia_estr_da_cidade(p_uf text, p_municipio text) returns jsonb language plpgsql stable security definer set search_path = interno, pg_temp as $$
declare v uuid := auth.uid(); v_uf text := upper(btrim(coalesce(p_uf, ''))); v_chave text := interno.normal(p_municipio);
begin
  perform interno.aberta('comunidade');
  perform interno.limite('alumia_estr_ler', 300, 10);
  if v_chave = '' then perform interno.erro('invalido:municipio'); end if;
  return jsonb_build_object('uf', v_uf, 'itens', (
    select coalesce(jsonb_agg(interno.alumia_o10_com_json(k) || jsonb_build_object(
        'municipio', x.municipio, 'bairro', x.bairro, 'situacao', interno.rede3_com_situacao(k.slug, v),
        'posts_7d', case when v is null then null else interno.alumia_o10_posts_7d(k.slug) end)
      order by x.bairro nulls first, interno.normal(x.bairro), k.nome), '[]'::jsonb)
    from alumia_com_estrutura x join rede_comunidades k on k.slug = x.comunidade
    where x.uf = v_uf and interno.normal(x.municipio) = v_chave and interno.alumia_o10_aparece(k, v)
      and (v is not null or k.categoria = 'disciplinas' or k.tipo in ('aberta', 'restrita'))));
end $$;

-- ── 8. Repostar em outra comunidade ─────────────────────────────────────────────────────────────────────────────────────────

/**
 * Leva um post a outra comunidade, com um comentário de quem leva (1 a 500). É uma citação na comunidade de destino (todas as
 * conferências de publicar valem, inclusive o modo só leitura, o modo lento e o filtro da comunidade), com a origem guardada.
 */
create or replace function public.alumia_estr_repostar(p_post uuid, p_destino text, p_texto text) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); o rede_posts; c rede_comunidades; k rede_comunidades; e alumia_com_estrutura; v_pub text; v_publico text; v_texto text; v_r jsonb;
begin
  perform interno.aberta('comunidade');
  perform interno.limite('alumia_estr_repostar', 20, 10);
  v_texto := interno.txt(p_texto, 'texto', 1, 500);
  select * into o from rede_posts where id = p_post;
  if not found or not interno.rede_ve(o, v) or o.oculto or o.retido or o.apagado_em is not null then perform interno.erro('nao_encontrado'); end if;
  if o.resposta_a is not null then perform interno.erro('invalido:repostar'); end if;
  c := interno.rede3_com_achar(p_destino);
  if c.slug is null or c.slug like 'fechado-%' or not interno.alumia_o10_aparece(c, v) then perform interno.erro('invalido:comunidade'); end if;
  if o.comunidade is not distinct from c.slug then perform interno.erro('mesma_comunidade'); end if;
  -- O público do original manda: só o que já é de toda a Alumia (ou da internet) viaja para outra comunidade.
  v_pub := interno.rede2_publico(o);
  if v_pub not in ('internet', 'membros') or o.nucleo is not null then perform interno.erro('repostar_publico'); end if;
  if o.comunidade is not null then
    select * into k from rede_comunidades where slug = o.comunidade;
    if found and k.tipo = 'fechada' then perform interno.erro('repostar_publico'); end if;
  end if;
  -- A regra do destino.
  select * into e from alumia_com_estrutura where comunidade = c.slug;
  if found and (e.reposts = 'ninguem' or (e.reposts = 'moderacao' and not interno.rede3_com_modera(c.slug, v))) then perform interno.erro('repostar_fechado'); end if;
  -- Quem escreveu decide quem cita (o gatilho também confere; aqui só para o erro chegar antes de gravar).
  if not interno.rede_b1_pode_citar(o.id, v) then perform interno.erro('citar_fechado'); end if;
  -- Nunca mais aberto que o original.
  v_publico := case when c.publico_padrao = 'comunidade' then 'comunidade' when v_pub = 'internet' and c.publico_padrao = 'internet' then 'internet' else 'membros' end;
  v_r := public.rede_conv_citar(jsonb_build_object('citar', o.id, 'comunidade', c.slug, 'texto', v_texto, 'publico', v_publico));
  insert into alumia_com_reposts (post, origem, destino) values ((v_r ->> 'id')::uuid, o.comunidade, c.slug) on conflict (post) do nothing;
  return v_r || jsonb_build_object('origem', case when k.slug is not null then interno.alumia_o10_com_json(k) end, 'destino', interno.alumia_o10_com_json(c));
end $$;

/**
 * De onde veio cada repost entre comunidades (até 50 ids): para o cartão mostrar "trazido de …". Só os posts que quem pergunta
 * vê; a comunidade de origem só aparece se quem pergunta pode vê-la (senão vem "restrita"). Nunca diz quem trouxe.
 */
create or replace function public.alumia_estr_origens(p_ids uuid[]) returns jsonb language plpgsql stable security definer set search_path = interno, pg_temp as $$
declare v uuid := auth.uid();
begin
  perform interno.aberta('comunidade');
  perform interno.limite('alumia_estr_ler', 300, 10);
  return (select coalesce(jsonb_agg(jsonb_build_object(
      'post', r.post,
      'origem', case when k.slug is not null and interno.alumia_o10_aparece(k, v) then interno.alumia_o10_com_json(k) end,
      'restrita', k.slug is not null and not interno.alumia_o10_aparece(k, v),
      'perfil', r.origem is null)), '[]'::jsonb)
    from alumia_com_reposts r join rede_posts x on x.id = r.post left join rede_comunidades k on k.slug = r.origem
    where r.post = any ((coalesce(p_ids, '{}'::uuid[]))[1:50]) and interno.rede_ve(x, v));
end $$;

-- ── 9. A proposta de comunidade nova ────────────────────────────────────────────────────────────────────────────────────────

/**
 * Quem propôs acrescenta à proposta ainda aberta a cidade, o bairro e a comunidade-mãe (vazio apaga). Na aprovação, a cidade entra
 * na comunidade nova e a mãe recebe o pedido.
 */
create or replace function public.alumia_estr_proposta(p_id uuid, p jsonb) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); x rede_propostas; m rede_comunidades; k text; v_uf text; v_mun text; v_bai text; v_mae text;
begin
  perform interno.aberta('comunidade');
  perform interno.limite('alumia_estr', 60, 10);
  select * into x from rede_propostas where id = p_id;
  if not found or x.autor is distinct from v then perform interno.erro('nao_encontrado'); end if;
  if x.situacao <> 'aberta' then perform interno.erro('ja_decidida'); end if;
  if p is null or jsonb_typeof(p) <> 'object' then perform interno.erro('invalido:estrutura'); end if;
  for k in select jsonb_object_keys(p) loop
    if k not in ('mae', 'uf', 'municipio', 'bairro') then perform interno.erro('invalido:estrutura'); end if;
  end loop;
  v_mun := interno.alumia_o10_nome_lugar(p ->> 'municipio', 'municipio');
  v_bai := case when v_mun is null then null else interno.alumia_o10_nome_lugar(p ->> 'bairro', 'bairro') end;
  v_uf := case when v_mun is null then null else nullif(upper(btrim(coalesce(p ->> 'uf', ''))), '') end;
  if v_mun is not null and (v_uf is null or v_uf not in ('AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG', 'PA',
                                                        'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO')) then
    perform interno.erro('invalido:uf');
  end if;
  if nullif(btrim(coalesce(p ->> 'mae', '')), '') is not null then
    m := interno.rede3_com_achar(p ->> 'mae');
    if m.slug is null or m.slug like 'fechado-%' or not interno.alumia_o10_aparece(m, v) then perform interno.erro('invalido:mae'); end if;
    if exists (select 1 from alumia_com_estrutura e where e.comunidade = m.slug and e.mae is not null) then perform interno.erro('mae_e_filha'); end if;
    v_mae := m.slug;
  end if;
  if v_mun is null and v_mae is null then
    delete from alumia_com_proposta_estrutura where proposta = x.id;
  else
    insert into alumia_com_proposta_estrutura (proposta, mae, uf, municipio, bairro) values (x.id, v_mae, v_uf, v_mun, v_bai)
    on conflict (proposta) do update set mae = excluded.mae, uf = excluded.uf, municipio = excluded.municipio, bairro = excluded.bairro;
  end if;
  return jsonb_build_object('proposta', x.id, 'mae', v_mae, 'uf', v_uf, 'municipio', v_mun, 'bairro', v_bai);
end $$;

-- ── 10. Permissões ──────────────────────────────────────────────────────────────────────────────────────────────────────────
-- Nenhuma função interna é chamável de fora. Ler a estrutura, os Espaços, as cidades e as origens: também visitante (cada uma
-- confere o que mostra). Ajustar, pedir, decidir e repostar: só conta.
revoke all on function interno.alumia_o10_aparece(interno.rede_comunidades, uuid), interno.alumia_o10_nome_lugar(text, text),
  interno.alumia_o10_avisar_moderacao(text, text), interno.alumia_o10_avisar_org(uuid, text), interno.alumia_o10_herdar(text), interno.alumia_o10_modera_propria(text, uuid),
  interno.alumia_o10_estrutura_mudou(), interno.alumia_o10_membros_mudou(), interno.alumia_o10_so_leitura(), interno.alumia_o10_proposta_decidida(),
  interno.alumia_o10_com_json(interno.rede_comunidades), interno.alumia_o10_posts_7d(text), interno.alumia_o10_cargo_posta(text, uuid) from public;
revoke all on function public.alumia_estr_ver(text), public.alumia_estr_salvar(text, jsonb), public.alumia_estr_mae_pedir(text, text),
  public.alumia_estr_mae_decidir(text, text, boolean), public.alumia_estr_org_pedir(text, text), public.alumia_estr_org_decidir(text, text, boolean),
  public.alumia_estr_espacos(text), public.alumia_estr_cidades(), public.alumia_estr_da_cidade(text, text), public.alumia_estr_repostar(uuid, text, text),
  public.alumia_estr_origens(uuid[]), public.alumia_estr_proposta(uuid, jsonb) from public;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on function interno.alumia_o10_aparece(interno.rede_comunidades, uuid), interno.alumia_o10_nome_lugar(text, text),
      interno.alumia_o10_avisar_moderacao(text, text), interno.alumia_o10_avisar_org(uuid, text), interno.alumia_o10_herdar(text), interno.alumia_o10_modera_propria(text, uuid),
      interno.alumia_o10_estrutura_mudou(), interno.alumia_o10_membros_mudou(), interno.alumia_o10_so_leitura(), interno.alumia_o10_proposta_decidida(),
      interno.alumia_o10_com_json(interno.rede_comunidades), interno.alumia_o10_posts_7d(text), interno.alumia_o10_cargo_posta(text, uuid) from anon, authenticated;
    grant execute on function public.alumia_estr_ver(text), public.alumia_estr_espacos(text), public.alumia_estr_cidades(),
      public.alumia_estr_da_cidade(text, text), public.alumia_estr_origens(uuid[]) to anon, authenticated, service_role;
    revoke all on function public.alumia_estr_salvar(text, jsonb), public.alumia_estr_mae_pedir(text, text), public.alumia_estr_mae_decidir(text, text, boolean),
      public.alumia_estr_org_pedir(text, text), public.alumia_estr_org_decidir(text, text, boolean), public.alumia_estr_repostar(uuid, text, text),
      public.alumia_estr_proposta(uuid, jsonb) from anon;
    grant execute on function public.alumia_estr_salvar(text, jsonb), public.alumia_estr_mae_pedir(text, text), public.alumia_estr_mae_decidir(text, text, boolean),
      public.alumia_estr_org_pedir(text, text), public.alumia_estr_org_decidir(text, text, boolean), public.alumia_estr_repostar(uuid, text, text),
      public.alumia_estr_proposta(uuid, jsonb) to authenticated, service_role;
  end if;
end $$;

-- ── 11. A porta ─────────────────────────────────────────────────────────────────────────────────────────────────────────────
select interno.alumia_trancar();
