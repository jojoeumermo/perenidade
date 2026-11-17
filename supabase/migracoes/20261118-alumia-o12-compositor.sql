-- ───────────────────────────── Alumia: o compositor, onda 12, frente 12A ─────────────────────────────
-- Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
--
-- O que o Escrever ganha nesta frente, sem mexer no que já confere o post (public.rede_publicar e as funções que o embrulham):
--
--   Fio de uma vez     public.rede_pub_o12_fio: de 2 a 10 blocos escritos juntos saem numa chamada só. O primeiro abre a conversa
--                      (com o público, a comunidade, a roda, o não listado e o prazo de sempre); cada um dos outros responde ao
--                      anterior como "continuação do fio". Tudo ou nada: se um bloco não passa (dado pessoal, limite, imagem que não
--                      é dela), nenhum fica. Se a mediação precisa ler um bloco antes de ele aparecer (a triagem de sempre), os que
--                      vêm depois esperam guardados (interno.rede_o12_fio_espera) e saem quando a mediação libera aquele bloco;
--                      se ele é apagado, os que esperavam somem junto.
--   Carrossel e        Até 10 imagens por post (eram 4), cada uma com a descrição (ALT) de sempre e uma legenda própria de até 280
--   colagem            letras, que aparece embaixo da imagem para todo mundo. A pessoa escolhe como as imagens aparecem: grade (o
--                      de sempre), carrossel (uma por vez, com setas) ou colagem (ladrilhos de tamanhos diferentes). O metadado das
--                      fotos sai como já sai (no aparelho e de novo no servidor, na rota /api/rede/midia).
--   Fuso no agendar    public.rede_pub_o12_agendar: a pessoa ESCOLHE o fuso (lista do próprio Postgres, pg_timezone_names) e o dia
--                      e a hora nele; o banco converte. Nada é deduzido do endereço de rede (que nem chega aqui). O fuso fica junto
--                      do agendado para a fila mostrar a hora no fuso que ela escolheu.
--   Figurinhas         Um pacote da casa (desenhado no código, components/rede/figurinhas/PacoteDaCasa.tsx; nenhuma imagem de fora)
--                      em post e em resposta. Só os nomes do pacote valem. Só a figurinha (sem texto) também vale: o texto do post
--                      vira o nome dela, que é o que quem lê de fora do cartão (leitor de tela, Fediverso) recebe.
--
-- Mudanças no que já existe (feitas sobre a definição VIVA, como em 20261115-alumia-o9-modoato.sql, para não atropelar outra frente):
--   · interno.rede_midia aceita ordem de 0 a 9 (a regra era de 0 a 3);
--   · interno.rede_niveis (níveis de confiança, regras públicas) aceita até 10 imagens; os níveis com o valor de fábrica sobem
--     (membro 6, regular e líder 10; novo 1 e básico 2 ficam);
--   · public.rede_publicar aceita até 10 imagens (era 4) e public.rede_pub_corrigir aceita até 10 descrições e 10 imagens a tirar.
--
-- As escolhas novas ficam em tabelas próprias (rede_o12_post, rede_o12_midia, rede_o12_agendado, rede_o12_fio_espera): em interno, RLS
-- ligada e sem política, nenhuma permissão direta. Nenhuma função devolve lista de pessoas. A legenda passa pela mesma conferência
-- de dado pessoal e pela mesma triagem do texto do post. Nenhuma função tem parâmetro do tipo linha de tabela. Pode rodar mais de
-- uma vez, sem apagar dado nenhum. Roda DEPOIS da onda 11 (usa rede_pub_vida_publicar, da onda 9, e rede_pub_agendar_mais, da B1).
-- Teste: scripts/testar-alumia-o12-compositor.mjs.

-- 1. Até 10 imagens ─────────────────────────────────────────────────────────────────────────────────────────────────────────

do $$
declare v_nome text;
begin
  -- A regra de ordem da tabela tem o nome que o Postgres deu (rede_midia_ordem_check); troca qualquer uma que fale de "ordem".
  for v_nome in
    select c.conname from pg_constraint c
    where c.conrelid = 'interno.rede_midia'::regclass and c.contype = 'c' and pg_get_constraintdef(c.oid) ~ '\mordem\M'
  loop
    execute format('alter table interno.rede_midia drop constraint %I', v_nome);
  end loop;
  alter table interno.rede_midia add constraint rede_midia_ordem_check check (ordem between 0 and 9);
end $$;

-- Os níveis de confiança (regras públicas em interno.rede_niveis, /alumia/cuidado) também limitam as imagens por post: o teto da
-- tabela passa de 4 para 10, e os níveis que ainda têm o valor de fábrica (4) sobem: membro 6, regular e líder 10. Quem é novo
-- continua com 1 e o básico com 2 (a defesa contra conta criada para espalhar imagem). Um valor que a coordenação já mudou fica.
do $$
declare v_nome text;
begin
  for v_nome in
    select c.conname from pg_constraint c
    where c.conrelid = 'interno.rede_niveis'::regclass and c.contype = 'c' and pg_get_constraintdef(c.oid) ~ '\mimagens\M'
  loop
    execute format('alter table interno.rede_niveis drop constraint %I', v_nome);
  end loop;
  alter table interno.rede_niveis add constraint rede_niveis_imagens_check check (imagens between 0 and 10);
  update interno.rede_niveis set imagens = 6 where nivel = 2 and imagens = 4;
  update interno.rede_niveis set imagens = 10 where nivel in (3, 4) and imagens = 4;
end $$;

do $$
declare v_def text; v_novo text;
begin
  v_def := pg_get_functiondef('public.rede_publicar(jsonb)'::regprocedure);
  if position('jsonb_array_length(v_midia) > 10' in v_def) > 0 then return; end if;
  v_novo := replace(v_def, 'jsonb_array_length(v_midia) > 4', 'jsonb_array_length(v_midia) > 10');
  if v_novo = v_def then
    raise exception 'public.rede_publicar mudou de forma: o teto de imagens não foi achado';
  end if;
  execute v_novo;
end $$;

do $$
declare v_def text; v_novo text;
begin
  if to_regprocedure('public.rede_pub_corrigir(uuid, jsonb)') is null then return; end if;
  v_def := pg_get_functiondef('public.rede_pub_corrigir(uuid, jsonb)'::regprocedure);
  v_novo := replace(replace(v_def, 'jsonb_array_length(p -> ''alts'') > 4', 'jsonb_array_length(p -> ''alts'') > 10'),
                    'jsonb_array_length(p -> ''tirar'') > 4', 'jsonb_array_length(p -> ''tirar'') > 10');
  if v_novo <> v_def then execute v_novo; end if;
end $$;

-- 2. Tabelas ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────

/** O que o compositor escolheu para um post: como as imagens aparecem e a figurinha. Só existe linha quando há escolha. */
create table if not exists interno.rede_o12_post (
  post uuid primary key references interno.rede_posts (id) on delete cascade,
  arranjo text not null default 'grade' check (arranjo in ('grade', 'carrossel', 'colagem')),
  figurinha text check (figurinha is null or figurinha in ('punho', 'lampiao', 'megafone', 'estrela', 'cravo', 'coracao', 'livro', 'sol',
                                                            'cafe', 'presente', 'na-luta', 'valeu')),
  so_figurinha boolean not null default false,
  criado_em timestamptz not null default now(),
  check (not so_figurinha or figurinha is not null)
);

/** A legenda de uma imagem (aparece para todo mundo, embaixo dela). Some com a imagem. */
create table if not exists interno.rede_o12_midia (
  midia uuid primary key references interno.rede_midia (id) on delete cascade,
  legenda text not null check (char_length(legenda) between 1 and 280)
);

/** O fuso escolhido e as escolhas do compositor de um post agendado (aplicadas ao post quando ele sai). */
create table if not exists interno.rede_o12_agendado (
  agendado uuid primary key references interno.rede_agendados (id) on delete cascade,
  autor uuid not null references interno.perfis (id) on delete cascade,
  fuso text check (fuso is null or char_length(fuso) between 1 and 64),
  extras jsonb not null default '{}'::jsonb check (jsonb_typeof(extras) = 'object')
);

/**
 * Os blocos de um fio que esperam a mediação ler o bloco de cima (`post`). Saem quando ele é liberado; somem quando ele é apagado.
 * `base` leva o que vale para o fio inteiro (o aviso de conteúdo e o prazo para sumir).
 */
create table if not exists interno.rede_o12_fio_espera (
  post uuid primary key references interno.rede_posts (id) on delete cascade,
  autor uuid not null references interno.perfis (id) on delete cascade,
  blocos jsonb not null check (jsonb_typeof(blocos) = 'array' and jsonb_array_length(blocos) between 1 and 9),
  base jsonb not null default '{}'::jsonb check (jsonb_typeof(base) = 'object'),
  erro text not null default '' check (char_length(erro) <= 120),
  criado_em timestamptz not null default now()
);
create index if not exists rede_o12_fio_espera_autor on interno.rede_o12_fio_espera (autor);

alter table interno.rede_o12_post enable row level security;
alter table interno.rede_o12_midia enable row level security;
alter table interno.rede_o12_agendado enable row level security;
alter table interno.rede_o12_fio_espera enable row level security;
revoke all on table interno.rede_o12_post, interno.rede_o12_midia, interno.rede_o12_agendado, interno.rede_o12_fio_espera from public;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on table interno.rede_o12_post, interno.rede_o12_midia, interno.rede_o12_agendado, interno.rede_o12_fio_espera from anon, authenticated;
  end if;
end $$;

-- 3. As peças de dentro ──────────────────────────────────────────────────────────────────────────────────────────────────────

/** Os nomes do pacote da casa (os mesmos de lib/rede/publicar/figurinhas.ts e da regra da tabela). */
create or replace function interno.rede_o12_figurinhas() returns text[] language sql immutable as $$
  select array['punho', 'lampiao', 'megafone', 'estrela', 'cravo', 'coracao', 'livro', 'sol', 'cafe', 'presente', 'na-luta', 'valeu']
$$;

/**
 * Separa do pedido o que é desta frente e confere: { pedido (o que segue para as funções de sempre), extras }.
 *   p.arranjo        'grade' | 'carrossel' | 'colagem' (só com 2 imagens ou mais; com uma, fica 'grade');
 *   p.figurinha      um nome do pacote; p.so_figurinha true: o post é só a figurinha (o texto é o nome dela);
 *   p.midia[].legenda até 280 letras (vazia não conta).
 * Dado pessoal na legenda: 'dado_pessoal'. Legenda que a triagem mandaria para a leitura da mediação: 'legenda_revisar' (a regra é
 * aberta, a mesma do aviso de antes de publicar); no modo de segurança, em que tudo passa pela mediação, a legenda segue com o post.
 */
create or replace function interno.rede_o12_separar(p jsonb, p_autor uuid) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare
  v_arranjo text := coalesce(nullif(btrim(coalesce(p ->> 'arranjo', '')), ''), 'grade');
  v_fig text := nullif(btrim(coalesce(p ->> 'figurinha', '')), '');
  v_so boolean;
  v_midia jsonb := case when jsonb_typeof(p -> 'midia') = 'array' then p -> 'midia' end;
  v_limpa jsonb := '[]'::jsonb; v_legendas jsonb := '{}'::jsonb; m jsonb; v_leg text; v_textos text := ''; v_tri jsonb;
begin
  if p is null or jsonb_typeof(p) is distinct from 'object' then perform interno.erro('invalido:post'); end if;
  if v_arranjo not in ('grade', 'carrossel', 'colagem') then perform interno.erro('invalido:arranjo'); end if;
  if v_fig is not null and not (v_fig = any (interno.rede_o12_figurinhas())) then perform interno.erro('invalido:figurinha'); end if;
  if p ? 'so_figurinha' and jsonb_typeof(p -> 'so_figurinha') not in ('boolean', 'null') then perform interno.erro('invalido:figurinha'); end if;
  v_so := coalesce((p ->> 'so_figurinha')::boolean, false);
  if v_so and v_fig is null then perform interno.erro('invalido:figurinha'); end if;
  if v_midia is not null then
    if jsonb_array_length(v_midia) > 10 then perform interno.erro('invalido:midia'); end if;
    for m in select e from jsonb_array_elements(v_midia) e loop
      if jsonb_typeof(m) is distinct from 'object' then perform interno.erro('invalido:midia'); end if;
      if m ? 'legenda' and jsonb_typeof(m -> 'legenda') not in ('string', 'null') then perform interno.erro('invalido:legenda'); end if;
      v_leg := nullif(btrim(coalesce(m ->> 'legenda', '')), '');
      if v_leg is not null then
        if char_length(v_leg) > 280 then perform interno.erro('invalido:legenda'); end if;
        v_legendas := v_legendas || jsonb_build_object(btrim(coalesce(m ->> 'caminho', '')), v_leg);
        v_textos := v_textos || ' ' || v_leg;
      end if;
      v_limpa := v_limpa || (m - 'legenda');
    end loop;
  end if;
  if (v_midia is null or jsonb_array_length(v_midia) < 2) then v_arranjo := 'grade'; end if;
  if v_textos <> '' then
    if interno.rede3_pub_dado_pessoal(v_textos) then perform interno.erro('dado_pessoal'); end if;
    v_tri := interno.rede_triagem(v_textos, p_autor);
    if ((v_tri ->> 'veredito') <> 'publicar' and coalesce(v_tri ->> 'motivo', '') <> 'modo_seguranca')
       or interno.normal(v_textos) ~ '(^|[^a-z])(macaco|crioulo|viado|bicha|sapatao|retardado|mongoloide|vagabunda|nordestino imundo|judeu imundo|negro imundo)([^a-z]|$)' then
      perform interno.erro('legenda_revisar');
    end if;
  end if;
  return jsonb_build_object(
    'pedido', (p - 'arranjo' - 'figurinha' - 'so_figurinha') || case when v_midia is not null then jsonb_build_object('midia', v_limpa) else '{}'::jsonb end,
    'extras', jsonb_strip_nulls(jsonb_build_object(
      'arranjo', case when v_arranjo <> 'grade' then v_arranjo end,
      'figurinha', v_fig,
      'so_figurinha', case when v_so then true end,
      'legendas', case when v_legendas <> '{}'::jsonb then v_legendas end)));
end $$;

/** Grava as escolhas do compositor num post da própria autora (as legendas acham a imagem pelo caminho). */
create or replace function interno.rede_o12_aplicar(p_post uuid, p_autor uuid, p_extras jsonb) returns void language plpgsql security definer set search_path = interno, pg_temp as $$
declare k text; v_leg text;
begin
  if p_post is null or p_extras is null or p_extras = '{}'::jsonb then return; end if;
  if not exists (select 1 from rede_posts where id = p_post and autor = p_autor) then return; end if;
  if p_extras ? 'arranjo' or p_extras ? 'figurinha' then
    insert into rede_o12_post (post, arranjo, figurinha, so_figurinha)
    values (p_post, coalesce(p_extras ->> 'arranjo', 'grade'), p_extras ->> 'figurinha', coalesce((p_extras ->> 'so_figurinha')::boolean, false))
    on conflict (post) do update set arranjo = excluded.arranjo, figurinha = excluded.figurinha, so_figurinha = excluded.so_figurinha;
  end if;
  if jsonb_typeof(p_extras -> 'legendas') = 'object' then
    for k, v_leg in select key, value from jsonb_each_text(p_extras -> 'legendas') loop
      insert into rede_o12_midia (midia, legenda)
      select m.id, v_leg from rede_midia m where m.post = p_post and m.caminho = k
      on conflict (midia) do update set legenda = excluded.legenda;
    end loop;
  end if;
end $$;

/**
 * Publica os blocos de um fio, cada um respondendo ao anterior (p_anterior é o último que já saiu). Se o de cima está esperando a
 * mediação (retido ou oculto), os blocos que faltam ficam guardados em rede_o12_fio_espera e saem quando ele for liberado.
 * Devolve os ids que saíram agora, na ordem.
 */
create or replace function interno.rede_o12_fio_seguir(p_autor uuid, p_anterior uuid, p_blocos jsonb, p_base jsonb) returns uuid[] language plpgsql security definer set search_path = interno, pg_temp as $$
declare
  v_ids uuid[] := '{}'; v_ant uuid := p_anterior; x rede_posts; v_i integer := 0; v_n integer := jsonb_array_length(p_blocos);
  b jsonb; v_pedido jsonb; v_post jsonb; v_id uuid; v_expira timestamptz := nullif(p_base ->> 'expira_em', '')::timestamptz;
begin
  while v_i < v_n loop
    select * into x from rede_posts where id = v_ant;
    if not found or x.apagado_em is not null then perform interno.erro('nao_encontrado'); end if;
    if x.oculto or x.retido then
      insert into rede_o12_fio_espera (post, autor, blocos, base)
      values (v_ant, p_autor, (select jsonb_agg(e order by n) from jsonb_array_elements(p_blocos) with ordinality z(e, n) where n > v_i), p_base)
      on conflict (post) do update set blocos = excluded.blocos, base = excluded.base, erro = '', criado_em = now();
      return v_ids;
    end if;
    b := p_blocos -> v_i;
    v_pedido := (b - 'resposta_a' - 'publico' - 'comunidade' - 'nucleo' - 'nao_listado' - 'some_em' - 'tipo' - 'enquete' - 'responde_quem' - 'citar_quem' - 'fio')
                || jsonb_build_object('resposta_a', v_ant, 'fio', true)
                || case when nullif(p_base ->> 'aviso', '') is not null then jsonb_build_object('aviso', p_base ->> 'aviso') else '{}'::jsonb end;
    v_post := public.rede_pub_o12_publicar(v_pedido);
    v_id := (v_post ->> 'id')::uuid;
    if v_expira is not null then update rede_posts set expira_em = v_expira where id = v_id and autor = p_autor; end if;
    v_ids := v_ids || v_id;
    v_ant := v_id;
    v_i := v_i + 1;
  end loop;
  return v_ids;
end $$;

-- 4. As funções da tela ──────────────────────────────────────────────────────────────────────────────────────────────────────

/**
 * Publicar com as escolhas do compositor (arranjo, legendas, figurinha) sobre public.rede_pub_vida_publicar (que segue conferindo
 * tudo: público, roda, não listado, prazo, quem cita, dado pessoal, triagem). Também serve para resposta (com figurinha). Devolve o
 * post como a função de sempre, mais `o12` (as escolhas gravadas).
 */
create or replace function public.rede_pub_o12_publicar(p jsonb) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); v_sep jsonb; v_post jsonb;
begin
  perform interno.aberta('comunidade');
  v_sep := interno.rede_o12_separar(p, v);
  v_post := public.rede_pub_vida_publicar(v_sep -> 'pedido');
  perform interno.rede_o12_aplicar((v_post ->> 'id')::uuid, v, v_sep -> 'extras');
  return v_post || jsonb_build_object('o12', v_sep -> 'extras');
end $$;

/**
 * O fio montado de uma vez. p: o pedido do primeiro bloco (público, comunidade, roda, não listado, prazo, quem responde, quem cita,
 * aviso) com p.blocos = [bloco 1, bloco 2, …] (de 2 a 10; cada um { texto, midia?, arranjo?, figurinha?, so_figurinha? }; o que
 * vier no p fora de "blocos" vale para o primeiro). Os blocos seguintes respondem ao anterior como continuação do fio, com o mesmo
 * aviso de conteúdo e o mesmo prazo para sumir. Tudo ou nada. Devolve { ids, posts: [o primeiro], esperando } (esperando: quantos
 * blocos ficaram guardados até a mediação ler o bloco de cima).
 */
create or replace function public.rede_pub_o12_fio(p jsonb) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare
  v uuid := interno.eu(); v_blocos jsonb; v_raiz jsonb; v_post jsonb; v_ids uuid[]; v_resto uuid[]; b jsonb; v_espera integer := 0;
begin
  perform interno.aberta('comunidade');
  if p is null or jsonb_typeof(p) is distinct from 'object' or jsonb_typeof(p -> 'blocos') is distinct from 'array' then perform interno.erro('invalido:fio'); end if;
  v_blocos := p -> 'blocos';
  if jsonb_array_length(v_blocos) not between 2 and 10 then perform interno.erro('invalido:fio'); end if;
  for b in select e from jsonb_array_elements(v_blocos) e loop
    if jsonb_typeof(b) is distinct from 'object' or jsonb_typeof(b -> 'texto') is distinct from 'string' then perform interno.erro('invalido:fio'); end if;
    if b ? 'resposta_a' or b ? 'enquete' or coalesce(b ->> 'tipo', 'post') <> 'post' then perform interno.erro('invalido:fio'); end if;
  end loop;
  if nullif(p ->> 'resposta_a', '') is not null or coalesce(p ->> 'tipo', 'post') <> 'post' or p ? 'enquete' then perform interno.erro('invalido:fio'); end if;
  perform interno.limite('rede_pub_o12_fio', 10, 60);
  -- Os que esperam há mais de 30 dias (bloco de cima que a mediação nunca liberou) vão embora.
  delete from rede_o12_fio_espera where autor = v and criado_em < now() - interval '30 days';

  v_raiz := (p - 'blocos') || (v_blocos -> 0);
  v_post := public.rede_pub_o12_publicar(v_raiz);
  v_ids := array[(v_post ->> 'id')::uuid];
  v_resto := interno.rede_o12_fio_seguir(v, v_ids[1], (select jsonb_agg(e order by n) from jsonb_array_elements(v_blocos) with ordinality z(e, n) where n > 1),
                                         jsonb_strip_nulls(jsonb_build_object('aviso', nullif(btrim(coalesce(p ->> 'aviso', '')), ''), 'expira_em', v_post ->> 'expira_em')));
  v_ids := v_ids || v_resto;
  v_espera := jsonb_array_length(v_blocos) - coalesce(array_length(v_ids, 1), 0);
  return jsonb_build_object('ids', to_jsonb(v_ids), 'posts', jsonb_build_array(v_post), 'esperando', v_espera);
end $$;

/**
 * Desfaz um fio que acabou de sair (o "Desfazer" dos 10 s): os blocos são apagados do último ao primeiro, com a mesma regra do
 * rede_pub_desfazer (só a autora, até 30 s, nada que a triagem segurou, nada que outra pessoa já respondeu). Tudo ou nada.
 */
create or replace function public.rede_pub_o12_fio_desfazer(p_ids uuid[]) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); v_id uuid; x rede_posts; v_n integer := 0;
begin
  perform interno.aberta('comunidade');
  perform interno.limite('alumia_desfazer', 30, 60);
  if p_ids is null or coalesce(array_length(p_ids, 1), 0) not between 1 and 10 then perform interno.erro('invalido:fio'); end if;
  for v_id in select u from unnest(p_ids) with ordinality z(u, n) order by n desc loop
    select * into x from rede_posts where id = v_id and autor = v for update;
    if not found or x.apagado_em is not null then perform interno.erro('nao_encontrado'); end if;
    if x.criado_em < now() - interval '30 seconds' then perform interno.erro('prazo_passou'); end if;
    if x.retido or x.oculto or coalesce(x.avaliacao, 'publicada') in ('revisao', 'bloqueada') then perform interno.erro('sem_permissao'); end if;
    if exists (select 1 from rede_posts r where r.resposta_a = x.id and r.autor is distinct from v) then perform interno.erro('sem_permissao'); end if;
    delete from rede_posts where id = x.id;
    v_n := v_n + 1;
  end loop;
  return jsonb_build_object('desfeito', true, 'blocos', v_n);
end $$;

/**
 * Agendar no fuso que a pessoa escolheu. p_local: o dia e a hora como ela escreveu ('2026-11-20T18:30'); p_fuso: um nome da lista do
 * Postgres (pg_timezone_names, 'America/Sao_Paulo'). Com "quando o ato terminar" (p_opcoes.apos_ato), p_local e p_fuso podem vir
 * nulos. O resto é o rede_pub_agendar_mais de sempre (ensaio do pedido, de 5 minutos a 30 dias, até 10 na fila, repetição); as
 * escolhas do compositor ficam guardadas e valem quando o post sair.
 */
create or replace function public.rede_pub_o12_agendar(p jsonb, p_local text, p_fuso text, p_opcoes jsonb) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); v_sep jsonb; v_quando timestamptz; v_r jsonb; v_fuso text := nullif(btrim(coalesce(p_fuso, '')), '');
begin
  perform interno.aberta('comunidade');
  if p_local is not null then
    if v_fuso is null or char_length(v_fuso) > 64 or not exists (select 1 from pg_timezone_names where name = v_fuso) then perform interno.erro('invalido:fuso'); end if;
    if p_local !~ '^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}(:\d{2})?$' then perform interno.erro('invalido:quando'); end if;
    begin
      v_quando := (replace(p_local, 'T', ' ')::timestamp) at time zone v_fuso;
    exception when others then perform interno.erro('invalido:quando');
    end;
  elsif nullif(coalesce(p_opcoes, '{}'::jsonb) ->> 'apos_ato', '') is null then
    perform interno.erro('invalido:quando');
  end if;
  v_sep := interno.rede_o12_separar(p, v);
  v_r := public.rede_pub_agendar_mais(v_sep -> 'pedido', v_quando, coalesce(p_opcoes, '{}'::jsonb));
  insert into rede_o12_agendado (agendado, autor, fuso, extras) values ((v_r ->> 'id')::uuid, v, v_fuso, v_sep -> 'extras')
  on conflict (agendado) do update set fuso = excluded.fuso, extras = excluded.extras;
  return v_r || jsonb_build_object('fuso', v_fuso);
end $$;

/** A fila das agendadas (rede_pub_agendados, que também publica o que venceu), com o fuso escolhido em cada uma. */
create or replace function public.rede_pub_o12_agendados() returns jsonb language plpgsql volatile security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); v_lista jsonb;
begin
  v_lista := public.rede_pub_agendados();
  return coalesce((
    select jsonb_agg(e || jsonb_build_object('fuso', g.fuso) order by n)
    from jsonb_array_elements(v_lista) with ordinality z(e, n)
    left join rede_o12_agendado g on g.agendado = (e ->> 'id')::uuid and g.autor = v), '[]'::jsonb);
end $$;

/**
 * Por lote (até 50 ids): as escolhas do compositor de cada post que a pessoa pode ver ({ arranjo, figurinha, so_figurinha,
 * legendas: { id da imagem: legenda } }). Post sem escolha nenhuma não aparece.
 */
create or replace function public.rede_pub_o12_extras(p_ids uuid[]) returns jsonb language plpgsql stable security definer set search_path = interno, pg_temp as $$
declare v uuid := auth.uid(); r jsonb := '{}'::jsonb; p rede_posts; o rede_o12_post; v_leg jsonb;
begin
  if p_ids is null then return r; end if;
  for p in select * from rede_posts where id = any (p_ids[1:50]) and apagado_em is null loop
    continue when not interno.rede_ve(p, v);
    select * into o from rede_o12_post where post = p.id;
    select jsonb_object_agg(m.id::text, l.legenda) into v_leg from rede_midia m join rede_o12_midia l on l.midia = m.id where m.post = p.id;
    continue when o.post is null and v_leg is null;
    r := r || jsonb_build_object(p.id::text, jsonb_strip_nulls(jsonb_build_object(
      'arranjo', coalesce(o.arranjo, 'grade'), 'figurinha', o.figurinha, 'so_figurinha', case when o.so_figurinha then true end, 'legendas', v_leg)));
  end loop;
  return r;
end $$;

-- 5. Gatilhos: o agendado que sai e o bloco liberado ───────────────────────────────────────────────────────────────────────────

/** Quando um agendado sai (publicado), as escolhas guardadas viram do post. */
create or replace function interno.rede_o12_agendado_saiu() returns trigger language plpgsql security definer set search_path = interno, pg_temp as $$
declare g rede_o12_agendado;
begin
  if new.estado <> 'publicado' or old.estado = 'publicado' or new.post is null then return null; end if;
  select * into g from rede_o12_agendado where agendado = new.id;
  if found then
    begin
      perform interno.rede_o12_aplicar(new.post, new.autor, g.extras);
    exception when others then null;
    end;
  end if;
  return null;
end $$;
drop trigger if exists rede_o12_agendado_saiu on interno.rede_agendados;
create trigger rede_o12_agendado_saiu after update of estado on interno.rede_agendados for each row execute function interno.rede_o12_agendado_saiu();

/** A próxima vez de uma série (rede_alumia_serie_seguir) leva o fuso e as escolhas da vez anterior. */
create or replace function interno.rede_o12_serie_copia() returns trigger language plpgsql security definer set search_path = interno, pg_temp as $$
begin
  if new.serie is null then return null; end if;
  insert into rede_o12_agendado (agendado, autor, fuso, extras)
  select new.id, new.autor, g.fuso, g.extras from rede_o12_agendado g join rede_agendados a on a.id = g.agendado
  where a.serie = new.serie and a.id <> new.id and a.autor = new.autor
  order by a.vezes desc limit 1
  on conflict (agendado) do nothing;
  return null;
end $$;
drop trigger if exists rede_o12_serie_copia on interno.rede_agendados;
create trigger rede_o12_serie_copia after insert on interno.rede_agendados for each row execute function interno.rede_o12_serie_copia();

/**
 * Um bloco de fio que esperava a mediação foi liberado (deixou de estar retido e oculto): os blocos guardados saem agora, como a
 * autora (a mesma troca de sessão do agendador, interno.rede3_pub_rodar, com a entrada que ela já tinha passado ao publicar o fio).
 * Apagado: os que esperavam somem. Se a saída falhar, o motivo fica guardado e nada mais muda.
 */
create or replace function interno.rede_o12_fio_liberado() returns trigger language plpgsql security definer set search_path = interno, pg_temp as $$
declare w rede_o12_fio_espera; v_antes text := current_setting('request.jwt.claims', true); v_antes_sub text := current_setting('request.jwt.claim.sub', true);
begin
  select * into w from rede_o12_fio_espera where post = new.id;
  if not found then return null; end if;
  if new.apagado_em is not null then
    delete from rede_o12_fio_espera where post = new.id;
    return null;
  end if;
  if new.oculto or new.retido then return null; end if;
  delete from rede_o12_fio_espera where post = new.id;
  perform set_config('request.jwt.claims', jsonb_build_object('sub', w.autor, 'role', 'authenticated', 'aal', 'aal2')::text, true);
  perform set_config('request.jwt.claim.sub', w.autor::text, true);
  begin
    perform interno.rede_o12_fio_seguir(w.autor, new.id, w.blocos, w.base);
  exception when others then
    insert into rede_o12_fio_espera (post, autor, blocos, base, erro) values (w.post, w.autor, w.blocos, w.base, left(sqlerrm, 120))
    on conflict (post) do update set erro = excluded.erro;
  end;
  perform set_config('request.jwt.claims', coalesce(v_antes, ''), true);
  perform set_config('request.jwt.claim.sub', coalesce(v_antes_sub, ''), true);
  return null;
end $$;
drop trigger if exists rede_o12_fio_liberado on interno.rede_posts;
create trigger rede_o12_fio_liberado after update of oculto, retido, apagado_em on interno.rede_posts for each row
  when (old.oculto is distinct from new.oculto or old.retido is distinct from new.retido or old.apagado_em is distinct from new.apagado_em)
  execute function interno.rede_o12_fio_liberado();

-- 6. Permissões ─────────────────────────────────────────────────────────────────────────────────────────────────────────────

do $$
declare r record;
begin
  -- As de dentro: ninguém chama pela API.
  for r in
    select p.oid::regprocedure as f from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'interno' and p.proname like 'rede\_o12\_%'
  loop
    execute format('revoke all on function %s from public', r.f);
    if exists (select 1 from pg_roles where rolname = 'anon') then execute format('revoke all on function %s from anon, authenticated', r.f); end if;
  end loop;
  -- As da tela: escrever só com conta; as escolhas dos posts (a matriz decide quem vê), com ou sem conta, como rede_pub_detalhes.
  for r in
    select p.oid::regprocedure as f, p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname like 'rede\_pub\_o12\_%'
  loop
    execute format('revoke all on function %s from public', r.f);
    if exists (select 1 from pg_roles where rolname = 'anon') then
      execute format('revoke all on function %s from anon', r.f);
      execute format('grant execute on function %s to authenticated, service_role', r.f);
      if r.proname = 'rede_pub_o12_extras' then execute format('grant execute on function %s to anon', r.f); end if;
    end if;
  end loop;
end $$;

-- As funções novas passam pela porta da entrada, como toda função da rede (20261112-alumia-portas.sql).
select interno.alumia_trancar();
