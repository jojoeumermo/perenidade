-- Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
-- Alumia · Prompt 4 · grupo "cartão do post": itens 30 (reações próprias da comunidade) e 35 (coleções públicas curadas).
--
-- Roda depois das migrações 20261127-p4-* da onda 1 (banco na versão 18); quem junta põe antes do 20261127-p4-fim.sql. Não mexe em
-- rede_alumia_versao nem na lista de exceções da porta: o 20261127-p4-fim.sql faz isso.
--
-- Tudo atrás do interruptor "alumia-p4-cartao-do-post" (só pelo nome; desligado por padrão). Sem decisão do painel, o banco se
-- comporta como antes: a lista de reações é a fechada de 8 e nenhuma pasta vira pública.
--
-- O que faz:
--   1. Item 30. A mediação de uma comunidade escolhe até 6 emojis para as reações dos posts dela (interno.rede_p4_com_reacoes).
--      A lista vale na hora de reagir (public.rede_alumia_reagir e uma regra na própria tabela interno.rede_reacoes_emoji) e na hora
--      de contar (interno.rede_alumia_reacoes_de, que agora mostra só os emojis da lista em vigor, na ordem dela). Sem lista própria,
--      ou com o interruptor desligado, vale a lista fechada de 8. A contagem continua a mesma: só o total por emoji, nulo abaixo de 3,
--      nunca quem reagiu (nem para a mediação, nem para quem escreveu). A tabela da lista não guarda quem da mediação mudou.
--      O check fixo de 8 emojis da tabela das reações (20261109-alumia-f3.sql) sai; no lugar, um check de tamanho e a regra da
--      lista. Emoji só da faixa de emojis (nada de letra, número ou sinal), e o gesto obsceno fica de fora.
--   2. Item 35. Uma pasta PRIVADA dos salvos pode virar pública: vira uma coleção do perfil da dona (interno.rede_acervo_colecoes, a
--      mesma do acervo da onda 10), e o que entra ou sai da pasta entra ou sai da coleção. Só entra na coleção o post que a regra do
--      acervo aceita (interno.rede_acervo_cabe: público aberto, fora de núcleo, de comunidade fechada, de seguidores e de equipe);
--      os posts restritos da pasta continuam só na pasta. Na leitura, a coleção já passa cada post por interno.rede_ve
--      (public.rede_acervo_colecao): ninguém vê pela coleção o que não veria fora dela. Pasta do núcleo nunca vira pública.
--      Voltar a pasta para privada apaga a coleção (os posts continuam salvos).
-- Pode rodar mais de uma vez. Endereço de rede: nada daqui lê ou guarda.
-- Lei: LGPD art. 6º, III (necessidade: a lista de emojis não guarda quem a mudou; a pasta pública não guarda quem viu), art. 11
-- (opinião política é dado sensível: nenhuma função devolve quem reagiu) e art. 46 (segurança: tabelas sem acesso direto).
-- Teste: npm run testar:p4-cartao-do-post.

-- ── 0. O interruptor ──────────────────────────────────────────────────────────────────────────────────────────────────────
do $$
begin
  if to_regclass('interno.recursos_catalogo') is not null then
    insert into interno.recursos_catalogo (nome, so_pelo_nome) values ('alumia-p4-cartao-do-post', true)
      on conflict (nome) do update set so_pelo_nome = true;
  end if;
end $$;

/**
 * O grupo "cartão do post" está ligado? Só com decisão explícita do painel (interno.recursos_vivos; o recurso é "só pelo nome") e
 * sem a Alumia desligada lá. Sem a tabela de recursos: desligado.
 */
create or replace function interno.rede_p4_cartao_ligado() returns boolean language plpgsql stable security definer set search_path = interno, pg_temp as $$
begin
  if to_regclass('interno.recursos_vivos') is null then return false; end if;
  if exists (select 1 from recursos_vivos where nome in ('rede-v2', 'alumia-2') and not ligado) then return false; end if;
  return coalesce((select ligado from recursos_vivos where nome = 'alumia-p4-cartao-do-post'), false);
end $$;

/** Recusa com "desligado" quando o interruptor está desligado. */
create or replace function interno.rede_p4_cartao_exige() returns void language plpgsql stable security definer set search_path = interno, pg_temp as $$
begin
  if not interno.rede_p4_cartao_ligado() then perform interno.erro('desligado'); end if;
end $$;

-- ── 1. Item 30: as reações próprias da comunidade ─────────────────────────────────────────────────────────────────────────

/** A lista de emojis que a mediação escolheu para a comunidade. Uma linha por comunidade; não guarda quem escolheu. */
create table if not exists interno.rede_p4_com_reacoes (
  comunidade text primary key references interno.rede_comunidades (slug) on delete cascade on update cascade,
  emojis text[] not null check (cardinality(emojis) between 1 and 6),
  mudou_em timestamptz not null default now()
);
alter table interno.rede_p4_com_reacoes enable row level security;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on table interno.rede_p4_com_reacoes from anon, authenticated;
  end if;
end $$;

/**
 * Um emoji aceitável numa lista da mediação: de 1 a 16 caracteres, todos da faixa dos emojis (setas e símbolos, pictogramas,
 * seletor de variação, junção, tecla, bandeiras por etiqueta, © ® e os quatro símbolos CJK de emoji). Sem letra, número, espaço ou
 * sinal; sem o gesto obsceno (U+1F595). A mesma conta está em lib/rede/p4/cartao/regras.ts (emojiAceito).
 */
create or replace function interno.rede_p4_emoji_ok(p text) returns boolean language sql immutable as $$
  select p is not null and char_length(p) between 1 and 16
     and p ~ ('^[' || chr(8592) || '-' || chr(11263) || chr(126976) || '-' || chr(129791) || chr(65039) || chr(8205) || chr(8419)
              || chr(917536) || '-' || chr(917631) || chr(169) || chr(174) || chr(12336) || chr(12349) || chr(12951) || chr(12953) || ']+$')
     and position(chr(128405) in p) = 0
$$;

/** A lista em vigor numa comunidade: a da mediação (com o interruptor ligado) ou a fechada de 8. Comunidade nula: a fechada. */
create or replace function interno.rede_p4_emojis_da_com(p_slug text) returns text[] language sql stable security definer set search_path = interno, pg_temp as $$
  select coalesce(case when p_slug is not null and interno.rede_p4_cartao_ligado()
                       then (select r.emojis from rede_p4_com_reacoes r where r.comunidade = p_slug) end,
                  interno.rede_alumia_emojis())
$$;

/** A lista em vigor para um post (a da comunidade dele). */
create or replace function interno.rede_p4_emojis_do_post(p_post uuid) returns text[] language sql stable security definer set search_path = interno, pg_temp as $$
  select interno.rede_p4_emojis_da_com((select p.comunidade from rede_posts p where p.id = p_post))
$$;

revoke all on function interno.rede_p4_cartao_ligado(), interno.rede_p4_cartao_exige(), interno.rede_p4_emoji_ok(text),
  interno.rede_p4_emojis_da_com(text), interno.rede_p4_emojis_do_post(uuid) from public;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on function interno.rede_p4_cartao_ligado(), interno.rede_p4_cartao_exige(), interno.rede_p4_emoji_ok(text),
      interno.rede_p4_emojis_da_com(text), interno.rede_p4_emojis_do_post(uuid) from anon, authenticated;
  end if;
end $$;

-- O check fixo de 8 sai; no lugar, o tamanho (a lista em vigor é conferida pela regra abaixo).
do $$
begin
  alter table interno.rede_reacoes_emoji drop constraint if exists rede_reacoes_emoji_emoji_check;
  if not exists (select 1 from pg_constraint where conrelid = 'interno.rede_reacoes_emoji'::regclass and conname = 'rede_reacoes_emoji_emoji_p4') then
    alter table interno.rede_reacoes_emoji add constraint rede_reacoes_emoji_emoji_p4 check (char_length(emoji) between 1 and 16);
  end if;
end $$;

/** Nenhuma reação entra com emoji fora da lista em vigor do post, venha de qual função vier. */
create or replace function interno.rede_p4_reacao_da_lista() returns trigger language plpgsql
set search_path = interno, pg_temp as $$
begin
  if not (new.emoji = any (interno.rede_p4_emojis_do_post(new.post))) then perform interno.erro('invalido:emoji'); end if;
  return new;
end $$;
revoke all on function interno.rede_p4_reacao_da_lista() from public;
drop trigger if exists p4_reacao_da_lista on interno.rede_reacoes_emoji;
create trigger p4_reacao_da_lista before insert or update of emoji, post on interno.rede_reacoes_emoji
  for each row execute function interno.rede_p4_reacao_da_lista();

/**
 * As reações de um post como a tela mostra (a de 20261110-alumia-b1-comunidade.sql, com a lista em vigor): [{emoji, total, minha}]
 * na ordem da lista, só os emojis da lista. O total NÃO conta quem p_quem bloqueou, quem bloqueou p_quem e contas suspensas. Nunca
 * quem reagiu. Quem chama já conferiu que p_quem vê o post.
 * Nenhum número abaixo de 3, nem pela própria ação (auditoria do P4, B4): o total só sai quando as reações das OUTRAS pessoas
 * chegam a 3 (a da própria pessoa não completa o 3; antes, quem reagia em 3º recebia 3 e sabia que eram 2), e a entrada do emoji
 * só aparece com o total ou com a reação da própria pessoa (antes, a entrada com total nulo dizia "1 ou 2").
 */
create or replace function interno.rede_alumia_reacoes_de(p_post uuid, p_quem uuid) returns jsonb language sql stable security definer set search_path = interno, pg_temp as $$
  select coalesce(jsonb_agg(jsonb_build_object('emoji', z.emoji, 'total', case when z.outros >= 3 then z.n end, 'minha', z.minha)
                            order by array_position(l.lista, z.emoji)) filter (where z.minha or z.outros >= 3), '[]'::jsonb)
  from (select interno.rede_p4_emojis_do_post(p_post) as lista) l
  cross join lateral (
    select r.emoji, count(*)::integer as n, bool_or(p_quem is not null and r.usuario = p_quem) as minha,
           (count(*) filter (where p_quem is null or r.usuario <> p_quem))::integer as outros
    from rede_reacoes_emoji r join perfis f on f.id = r.usuario
    where r.post = p_post and r.emoji = any (l.lista)
      and (r.usuario = p_quem or (not f.suspenso and not interno.rede_bloqueado(p_quem, r.usuario)))
    group by r.emoji) z
$$;
revoke all on function interno.rede_alumia_reacoes_de(uuid, uuid) from public;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on function interno.rede_alumia_reacoes_de(uuid, uuid) from anon, authenticated;
  end if;
end $$;

-- public.rede_alumia_reagir: a conferência do emoji passa a ser a da lista em vigor do post (o resto da função fica como está).
do $$
declare v_def text; v_novo text;
  v_marca constant text := 'not (p_emoji = any (interno.rede_alumia_emojis()))';
begin
  v_def := pg_get_functiondef('public.rede_alumia_reagir(uuid, text, boolean)'::regprocedure);
  if position('interno.rede_p4_emojis_do_post(p_post)' in v_def) > 0 then return; end if;
  v_novo := replace(v_def, v_marca, 'not (p_emoji = any (interno.rede_p4_emojis_do_post(p_post)))');
  if v_novo = v_def then
    raise exception 'public.rede_alumia_reagir mudou de forma: a conferência do emoji não foi achada';
  end if;
  execute v_novo;
end $$;

/**
 * As reações de uma comunidade: a lista em vigor, se é a própria da mediação e se quem chama pode mudá-la (a mediação, com o
 * interruptor ligado). Quem não vê a comunidade recebe 'nao_encontrado'. Nunca quem mudou nem quantas pessoas reagiram.
 */
create or replace function public.rede_p4_reacoes_da_comunidade(p_slug text) returns jsonb language plpgsql volatile security definer set search_path = interno, pg_temp as $$
declare v uuid := auth.uid(); c rede_comunidades; v_lig boolean;
begin
  perform interno.alumia_porta();
  perform interno.aberta('comunidade');
  perform interno.limite('rede2_ler', 600, 60);
  c := interno.rede_alumia_com_ver(p_slug, v);
  v_lig := interno.rede_p4_cartao_ligado();
  return jsonb_build_object(
    'emojis', to_jsonb(interno.rede_p4_emojis_da_com(c.slug)),
    'padrao', to_jsonb(interno.rede_alumia_emojis()),
    'propria', v_lig and exists (select 1 from rede_p4_com_reacoes r where r.comunidade = c.slug),
    'pode_mudar', v_lig and v is not null and interno.rede2_membro(v) and interno.rede3_com_modera(c.slug, v),
    'maximo', 6);
end $$;

/**
 * A mediação troca a lista da comunidade (de 1 a 6 emojis, sem repetir) ou volta à fechada (lista vazia ou nula). As reações já
 * feitas com um emoji que saiu da lista não aparecem mais (não são apagadas: voltam se o emoji voltar).
 */
create or replace function public.rede_p4_reacoes_mudar(p_slug text, p_emojis text[]) returns jsonb language plpgsql volatile security definer set search_path = interno, pg_temp as $$
declare v uuid; c rede_comunidades; v_lista text[];
begin
  perform interno.alumia_porta();
  perform interno.aberta('comunidade');
  perform interno.rede_p4_cartao_exige();
  v := interno.eu();
  if not interno.rede2_membro(v) then perform interno.erro('consentimento'); end if;
  c := interno.rede_alumia_com_ver(p_slug, v);
  if not interno.rede3_com_modera(c.slug, v) then perform interno.erro('sem_permissao'); end if;
  perform interno.limite('alumia_p4_reacoes', 20, 60);
  v_lista := coalesce(p_emojis, '{}'::text[]);
  if cardinality(v_lista) = 0 then
    delete from rede_p4_com_reacoes where comunidade = c.slug;
    return jsonb_build_object('emojis', to_jsonb(interno.rede_alumia_emojis()), 'propria', false);
  end if;
  if cardinality(v_lista) > 6 then perform interno.erro('invalido:muitos'); end if;
  if exists (select 1 from unnest(v_lista) e where not interno.rede_p4_emoji_ok(e)) then perform interno.erro('invalido:emoji'); end if;
  if (select count(distinct e) from unnest(v_lista) e) <> cardinality(v_lista) then perform interno.erro('invalido:repetido'); end if;
  insert into rede_p4_com_reacoes (comunidade, emojis, mudou_em) values (c.slug, v_lista, now())
    on conflict (comunidade) do update set emojis = excluded.emojis, mudou_em = now();
  return jsonb_build_object('emojis', to_jsonb(v_lista), 'propria', true);
end $$;

revoke all on function public.rede_p4_reacoes_da_comunidade(text), public.rede_p4_reacoes_mudar(text, text[]) from public;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on function public.rede_p4_reacoes_mudar(text, text[]) from anon;
    grant execute on function public.rede_p4_reacoes_da_comunidade(text) to anon, authenticated, service_role;
    grant execute on function public.rede_p4_reacoes_mudar(text, text[]) to authenticated, service_role;
  end if;
end $$;

-- ── 2. Item 35: a pasta dos salvos que vira coleção pública ───────────────────────────────────────────────────────────────

/** A ligação entre a pasta privada e a coleção do perfil que a espelha. Não guarda quem viu nem quantas vezes. */
create table if not exists interno.rede_p4_pastas_publicas (
  pasta uuid primary key references interno.rede_alumia_pastas (id) on delete cascade,
  colecao uuid not null unique references interno.rede_acervo_colecoes (id) on delete cascade,
  criado_em timestamptz not null default now()
);
alter table interno.rede_p4_pastas_publicas enable row level security;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on table interno.rede_p4_pastas_publicas from anon, authenticated;
  end if;
end $$;

/**
 * Espelha a pasta na coleção: tira da coleção o que saiu da pasta e põe, no fim da ordem, o que entrou e a regra do acervo aceita
 * (interno.rede_acervo_cabe), menos o que a autora tirou daquela coleção. Até 100 posts (o teto da coleção). Devolve se algum
 * post da pasta ficou de fora (restrito ou além do teto), sem dizer quantos nem quais.
 */
create or replace function interno.rede_p4_pasta_espelhar(p_pasta uuid) returns boolean language plpgsql security definer set search_path = interno, pg_temp as $$
declare k rede_acervo_colecoes; v_max integer; v_fora boolean;
begin
  select c.* into k from rede_p4_pastas_publicas l join rede_acervo_colecoes c on c.id = l.colecao where l.pasta = p_pasta;
  if k.id is null then return false; end if;
  delete from rede_acervo_colecao_itens i
   where i.colecao = k.id and not exists (select 1 from rede_alumia_pasta_itens p where p.pasta = p_pasta and p.post = i.post);
  select coalesce(max(ordem), 0) into v_max from rede_acervo_colecao_itens where colecao = k.id;
  insert into rede_acervo_colecao_itens (colecao, post, ordem)
  select k.id, n.post, v_max + n.o
    from (select i.post, row_number() over (order by i.criado_em, i.post)::integer as o
            from rede_alumia_pasta_itens i join rede_posts x on x.id = i.post
           where i.pasta = p_pasta and interno.rede_acervo_cabe(k, x)
             and not exists (select 1 from rede_acervo_colecao_fora f where f.colecao = k.id and f.post = i.post)
             and not exists (select 1 from rede_acervo_colecao_itens a where a.colecao = k.id and a.post = i.post)) n
   where n.o <= greatest(0, 100 - (select count(*)::integer from rede_acervo_colecao_itens where colecao = k.id));
  update rede_acervo_colecoes set mudou_em = now() where id = k.id;
  select exists (select 1 from rede_alumia_pasta_itens p where p.pasta = p_pasta
                  and not exists (select 1 from rede_acervo_colecao_itens a where a.colecao = k.id and a.post = p.post)) into v_fora;
  return v_fora;
end $$;

/** Entrou ou saiu post de uma pasta pública: a coleção acompanha (só com o interruptor ligado). */
create or replace function interno.rede_p4_pasta_mudou() returns trigger language plpgsql security definer set search_path = interno, pg_temp as $$
declare v_pasta uuid := coalesce(new.pasta, old.pasta);
begin
  if interno.rede_p4_cartao_ligado() and exists (select 1 from rede_p4_pastas_publicas where pasta = v_pasta) then
    perform interno.rede_p4_pasta_espelhar(v_pasta);
  end if;
  return null;
end $$;
drop trigger if exists p4_pasta_mudou on interno.rede_alumia_pasta_itens;
create trigger p4_pasta_mudou after insert or delete on interno.rede_alumia_pasta_itens
  for each row execute function interno.rede_p4_pasta_mudou();

/** A ligação saiu (a pasta foi apagada ou voltou a ser privada): a coleção que a espelhava sai junto. */
create or replace function interno.rede_p4_pasta_desligou() returns trigger language plpgsql security definer set search_path = interno, pg_temp as $$
begin
  delete from rede_acervo_colecoes where id = old.colecao;
  return null;
end $$;
drop trigger if exists p4_pasta_desligou on interno.rede_p4_pastas_publicas;
create trigger p4_pasta_desligou after delete on interno.rede_p4_pastas_publicas
  for each row execute function interno.rede_p4_pasta_desligou();

revoke all on function interno.rede_p4_pasta_espelhar(uuid), interno.rede_p4_pasta_mudou(), interno.rede_p4_pasta_desligou() from public;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on function interno.rede_p4_pasta_espelhar(uuid) from anon, authenticated;
  end if;
end $$;

/**
 * Torna pública (p_sim) a pasta PRIVADA da própria pessoa, ou a volta para privada. Pública: cria a coleção do perfil (título: o
 * dado ou o nome da pasta; até 30 coleções por pessoa) e espelha a pasta nela. Chamar de novo com p_sim só troca o título e a
 * descrição. Pede o @ da pessoa (sem ele, a coleção não teria onde aparecer). Devolve {publica, colecao, ficou_fora}.
 */
create or replace function public.rede_p4_pasta_publica(p_pasta uuid, p_sim boolean default true, p_titulo text default null, p_descricao text default '') returns jsonb
language plpgsql volatile security definer set search_path = interno, pg_temp as $$
declare v uuid; k rede_alumia_pastas; v_col uuid; v_tit text; v_desc text;
begin
  perform interno.alumia_porta();
  perform interno.aberta('comunidade');
  perform interno.rede_p4_cartao_exige();
  v := interno.eu();
  if not interno.rede2_membro(v) then perform interno.erro('consentimento'); end if;
  k := interno.rede_alumia_pasta(p_pasta, v);
  if k.usuario is distinct from v then perform interno.erro('sem_permissao'); end if;
  perform interno.limite('alumia_acervo_colecao', 30, 60);
  if not coalesce(p_sim, true) then
    delete from rede_p4_pastas_publicas where pasta = k.id;
    return jsonb_build_object('publica', false, 'colecao', null, 'ficou_fora', false);
  end if;
  if (select rede_handle from perfis where id = v) is null then perform interno.erro('sem_handle'); end if;
  v_tit := interno.txt(coalesce(nullif(btrim(coalesce(p_titulo, '')), ''), k.nome), 'titulo', 2, 80);
  v_desc := interno.txt(coalesce(p_descricao, ''), 'descricao', 0, 280);
  select colecao into v_col from rede_p4_pastas_publicas where pasta = k.id;
  if v_col is null then
    if (select count(*) from rede_acervo_colecoes where usuario = v) >= 30 then perform interno.erro('invalido:muitas'); end if;
    insert into rede_acervo_colecoes (usuario, titulo, descricao) values (v, v_tit, v_desc) returning id into v_col;
    insert into rede_p4_pastas_publicas (pasta, colecao) values (k.id, v_col);
  else
    update rede_acervo_colecoes set titulo = v_tit, descricao = v_desc, mudou_em = now() where id = v_col;
  end if;
  return jsonb_build_object('publica', true, 'colecao', v_col, 'ficou_fora', interno.rede_p4_pasta_espelhar(k.id));
end $$;

/** Quais pastas privadas da própria pessoa estão públicas, e a coleção de cada uma. */
create or replace function public.rede_p4_pastas_publicas() returns jsonb language plpgsql volatile security definer set search_path = interno, pg_temp as $$
declare v uuid;
begin
  perform interno.alumia_porta();
  perform interno.aberta('comunidade');
  v := interno.eu();
  perform interno.limite('rede2_ler', 600, 60);
  return jsonb_build_object('ligado', interno.rede_p4_cartao_ligado(), 'itens', (
    select coalesce(jsonb_agg(jsonb_build_object('pasta', l.pasta, 'colecao', l.colecao) order by l.criado_em), '[]'::jsonb)
      from rede_p4_pastas_publicas l join rede_alumia_pastas k on k.id = l.pasta where k.usuario = v));
end $$;

revoke all on function public.rede_p4_pasta_publica(uuid, boolean, text, text), public.rede_p4_pastas_publicas() from public;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on function public.rede_p4_pasta_publica(uuid, boolean, text, text), public.rede_p4_pastas_publicas() from anon;
    grant execute on function public.rede_p4_pasta_publica(uuid, boolean, text, text), public.rede_p4_pastas_publicas() to authenticated, service_role;
  end if;
end $$;

select interno.alumia_trancar();
