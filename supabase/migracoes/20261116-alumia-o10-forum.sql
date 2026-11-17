-- ───────────────────────────── Alumia, onda 10: o fórum da comunidade ─────────────────────────────
-- Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
--
-- Frente 10A. O fórum mora DENTRO da comunidade e não cria um tipo novo de post: um tópico é um post de comunidade, na raiz, do
-- tipo "discussão" ou "dúvida" (título e etiqueta já existem desde a v2), ou um post que virou tópico (abaixo). O que entra aqui:
--
--   1. ESTADO do tópico: aberto, encaminhado (virou aula, wiki ou tarefa) ou resolvido. Quem abriu o tópico ou a moderação muda.
--      A dúvida com a resposta que resolveu (rede_posts.aceita) já conta como resolvida enquanto ninguém mudar o estado à mão.
--   2. A LISTA do fórum, com a regra aberta e igual para todos: "última resposta" (o tópico sobe quando alguém responde), "mais
--      novos" (pela abertura) ou "sem resposta". Nada de ordem por reação nem por perfil de quem lê. Fixados vêm à parte.
--   3. RESUMO DE UMA LINHA (até 140 caracteres) no alto do tópico, escrito por gente: quem abriu ou a moderação. Guarda só QUAL
--      papel escreveu (autora ou moderação), nunca quem. Passa pela mesma recusa de dado pessoal e pelo veredito dos posts.
--   4. VIRAR TÓPICO: uma conversa (ou uma resposta dela) vira um tópico novo do fórum. O tópico novo cita o post de onde veio
--      (a citação da v2, se quem escreveu deixa citar: quem não pode ver o original vê "conteúdo restrito") e fica a marca
--      "continua em" na conversa. Quem pode:
--      a própria autora (em comunidade onde ela escreve) ou a moderação que cuida dos DOIS lugares (de onde vem e para onde vai).
--      Quando foi a moderação, a autora recebe um aviso (sem dizer quem levou).
--   5. "Até onde li" (pular para a primeira não lida) NÃO passa por aqui: fica só no aparelho (lib/rede/leitura-conversa.ts).
--      O servidor nunca sabe o que cada pessoa leu.
--
-- Nenhum endereço de rede é guardado. Nenhuma função devolve lista de pessoas: os números são de posts (respostas do tópico).
-- Tudo em interno, com RLS e sem política; o acesso é só por funções security definer com search_path fixo. As de membro passam
-- pela porta da entrada (interno.alumia_trancar, no fim).
--
-- Pode rodar mais de uma vez, sem apagar dado nenhum. Roda DEPOIS de 20261115-alumia-onda9-fim.sql.
-- Teste: scripts/testar-alumia-o10-forum.mjs.

-- ── 1. Tabela ─────────────────────────────────────────────────────────────────────────────────────────────────────────────

-- O que o fórum acrescenta a um tópico. Sem linha, o tópico está aberto (ou resolvido, se a dúvida tem a resposta marcada).
create table if not exists interno.alumia_forum_topicos (
  post uuid primary key references interno.rede_posts (id) on delete cascade,
  estado text not null default 'aberto' check (estado in ('aberto', 'encaminhado', 'resolvido')),
  -- Nulo enquanto ninguém mudou o estado à mão (aí vale a resposta aceita da dúvida).
  estado_em timestamptz,
  resumo text check (resumo is null or char_length(resumo) between 1 and 140),
  -- Só o papel de quem escreveu o resumo, nunca a pessoa.
  resumo_de text check (resumo_de is null or resumo_de in ('autora', 'moderacao')),
  resumo_em timestamptz,
  -- O post de onde o tópico veio ("virar tópico"); some o vínculo se o original for apagado.
  veio_de uuid references interno.rede_posts (id) on delete set null,
  criado_em timestamptz not null default now(),
  check ((resumo is null) = (resumo_de is null))
);
create index if not exists alumia_forum_topicos_veio_de on interno.alumia_forum_topicos (veio_de) where veio_de is not null;
alter table interno.alumia_forum_topicos enable row level security;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on table interno.alumia_forum_topicos from anon, authenticated;
  end if;
end $$;

-- A lista do fórum lê as raízes de uma comunidade por tipo; o índice de comunidade já existe (rede_posts_comunidade).

-- ── 2. Auxiliares internos ────────────────────────────────────────────────────────────────────────────────────────────────

/** Este post é um tópico do fórum? Raiz, numa comunidade, não apagado, e do tipo discussão/dúvida ou levado ao fórum. */
create or replace function interno.alumia_o10_e_topico(p interno.rede_posts) returns boolean language sql stable security definer set search_path = interno, pg_temp as $$
  select p.id is not null and p.resposta_a is null and p.comunidade is not null and p.apagado_em is null
    and (p.tipo in ('discussao', 'duvida') or exists (select 1 from alumia_forum_topicos f where f.post = p.id))
$$;

/** O estado que vale: o escolhido à mão; sem escolha, a dúvida com a resposta marcada está resolvida. */
create or replace function interno.alumia_o10_estado(p interno.rede_posts, f interno.alumia_forum_topicos) returns text language sql stable security definer set search_path = interno, pg_temp as $$
  select case
    when f.post is not null and f.estado_em is not null then f.estado
    when p.tipo = 'duvida' and p.aceita is not null then 'resolvido'
    else 'aberto' end
$$;

/**
 * O tópico como a lista mostra, para quem lê (p_quem). As respostas contadas e a última resposta vêm só do que está no ar (nem
 * oculto, nem retido, nem apagado): é número de posts, não de pessoas. O autor sai pelo codinome, como no cartão do post.
 */
create or replace function interno.alumia_o10_item(p interno.rede_posts, p_quem uuid) returns jsonb language plpgsql stable security definer set search_path = interno, pg_temp as $$
declare f alumia_forum_topicos; v_n integer; v_ultima timestamptz;
begin
  select * into f from alumia_forum_topicos where post = p.id;
  select count(*)::integer, max(r.criado_em) into v_n, v_ultima
    from rede_posts r where r.root_id = p.id and not r.oculto and not r.retido and r.apagado_em is null;
  return jsonb_build_object(
    'id', p.id, 'titulo', coalesce(nullif(p.titulo, ''), left(p.texto, 140)), 'tipo', p.tipo, 'etiqueta', p.flair,
    'estado', interno.alumia_o10_estado(p, f), 'criado_em', p.criado_em, 'ultima_em', coalesce(v_ultima, p.criado_em),
    'respostas', coalesce(v_n, 0), 'autor', interno.rede_nome(p.autor), 'meu', p_quem is not null and p.autor = p_quem,
    'resumo', f.resumo, 'resumo_de', f.resumo_de, 'fixado', p.fixado, 'travado', p.travado, 'veio', f.veio_de is not null);
end $$;

/** O resumo de uma linha: sem dado pessoal (CPF, telefone, e-mail) e com o mesmo veredito automático dos posts. */
create or replace function interno.alumia_o10_resumo_ok(p_texto text, p_autor uuid) returns void language plpgsql security definer set search_path = interno, pg_temp as $$
begin
  if p_texto ~ '\d{3}\.?\d{3}\.?\d{3}-?\d{2}' or p_texto ~ '\(?\d{2}\)?\s?9\d{4}[-\s]?\d{4}' or p_texto ~* '[a-z0-9._%+-]+@[a-z0-9-]+\.[a-z.]{2,}' then
    perform interno.erro('dado_pessoal');
  end if;
  if (interno.veredito(p_texto, interno.cuida(), p_autor) ->> 'veredito') is distinct from 'publicar' then
    perform interno.erro('invalido:resumo');
  end if;
end $$;

-- ── 3. A lista do fórum ───────────────────────────────────────────────────────────────────────────────────────────────────

/**
 * Os tópicos de uma comunidade, 30 por vez. p: {ordem: 'ultima' (padrão) | 'novos' | 'sem_resposta', estado: nulo | 'aberto' |
 * 'encaminhado' | 'resolvido', etiqueta: nulo | nome, depois: {t, id} (o "proximo" da página anterior)}. A regra é a mesma para
 * todo mundo e está escrita na tela; nada de reação, alcance ou perfil de quem lê entra na ordem. Só entra o que a pessoa pode ver
 * (interno.rede_ve) e o que ela não silenciou. Os fixados vêm à parte, só na primeira página.
 * Devolve {itens, fixados, proximo, ordem, modero, pode_abrir, etiquetas}.
 */
create or replace function public.alumia_forum_lista(p_slug text, p jsonb default '{}'::jsonb) returns jsonb language plpgsql volatile security definer set search_path = interno, pg_temp as $$
declare
  v uuid := auth.uid(); c rede_comunidades;
  v_p jsonb := coalesce(p, '{}'::jsonb);
  v_ordem text := coalesce(nullif(btrim(v_p ->> 'ordem'), ''), 'ultima');
  v_estado text := nullif(btrim(coalesce(v_p ->> 'estado', '')), '');
  v_etiqueta text := nullif(btrim(coalesce(v_p ->> 'etiqueta', '')), '');
  v_depois_t timestamptz; v_depois_id uuid;
  v_pagina jsonb; v_itens jsonb; v_fixados jsonb := '[]'::jsonb; v_ult jsonb;
begin
  perform interno.aberta('comunidade');
  perform interno.limite('rede2_ler', 600, 60);
  if jsonb_typeof(v_p) is distinct from 'object' then perform interno.erro('invalido:forum'); end if;
  if v_ordem not in ('ultima', 'novos', 'sem_resposta') then perform interno.erro('invalido:ordem'); end if;
  if v_estado is not null and v_estado not in ('aberto', 'encaminhado', 'resolvido') then perform interno.erro('invalido:estado'); end if;
  if v_etiqueta is not null and char_length(v_etiqueta) > 40 then perform interno.erro('invalido:etiqueta'); end if;
  if jsonb_typeof(v_p -> 'depois') = 'object' then
    begin
      v_depois_t := (v_p -> 'depois' ->> 't')::timestamptz;
      v_depois_id := (v_p -> 'depois' ->> 'id')::uuid;
    exception when others then perform interno.erro('invalido:depois');
    end;
    if v_depois_t is null or v_depois_id is null then perform interno.erro('invalido:depois'); end if;
  end if;
  -- Comunidade fechada, para quem é de fora (e para visitante): nem fica sabendo que ela existe. Nas abertas, rede_ve decide post a post.
  c := interno.rede3_com_achar(p_slug);
  if c.slug is null or (c.tipo = 'fechada' and (v is null or not interno.rede2_na_comunidade(c.slug, v))) then perform interno.erro('nao_encontrado'); end if;

  with base as (
    select x.*, interno.alumia_o10_item(x, v) as item
    from rede_posts x
    where x.comunidade = c.slug and x.resposta_a is null and x.apagado_em is null
      and interno.alumia_o10_e_topico(x)
      and interno.rede_ve(x, v) and not interno.rede_silenciado(x, v)
      and (v_etiqueta is null or x.flair = v_etiqueta)),
  filtrados as (
    select b.*, case when v_ordem = 'ultima' then (b.item ->> 'ultima_em')::timestamptz else b.criado_em end as chave
    from base b
    where not b.fixado
      and (v_estado is null or b.item ->> 'estado' = v_estado)
      and (v_ordem <> 'sem_resposta' or (b.item ->> 'respostas')::integer = 0)),
  pagina as (
    select f.item, f.chave, f.id from filtrados f
    where v_depois_t is null or (f.chave, f.id) < (v_depois_t, v_depois_id)
    order by f.chave desc, f.id desc
    limit 31)
  select coalesce(jsonb_agg(jsonb_build_object('item', pg.item, 't', pg.chave, 'id', pg.id) order by pg.chave desc, pg.id desc), '[]'::jsonb)
    into v_pagina
  from pagina pg;
  -- Uma a mais que a página: se veio, há próxima, e o marcador é o último desta.
  if jsonb_array_length(v_pagina) > 30 then
    v_ult := jsonb_build_object('t', v_pagina -> 29 -> 't', 'id', v_pagina -> 29 -> 'id');
  end if;
  select coalesce(jsonb_agg(e.valor -> 'item' order by e.i), '[]'::jsonb) into v_itens
  from jsonb_array_elements(v_pagina) with ordinality as e(valor, i) where e.i <= 30;

  if v_depois_t is null then
    select coalesce(jsonb_agg(interno.alumia_o10_item(x, v) order by x.criado_em desc), '[]'::jsonb) into v_fixados
    from rede_posts x
    where x.comunidade = c.slug and x.resposta_a is null and x.apagado_em is null and x.fixado
      and interno.alumia_o10_e_topico(x) and interno.rede_ve(x, v) and not interno.rede_silenciado(x, v)
      and (v_etiqueta is null or x.flair = v_etiqueta);
  end if;

  return jsonb_build_object(
    'itens', coalesce(v_itens, '[]'::jsonb), 'fixados', v_fixados, 'proximo', v_ult, 'ordem', v_ordem,
    'modero', interno.rede3_com_modera(c.slug, v),
    'pode_abrir', v is not null and interno.rede2_membro(v)
      and not exists (select 1 from rede_comunidade_membros m where m.comunidade = c.slug and m.usuario = v and (m.situacao = 'banido' or m.banido_ate > now()))
      and (c.tipo = 'aberta' or interno.rede2_na_comunidade(c.slug, v)),
    'etiquetas', coalesce((select jsonb_agg(f.nome order by f.nome) from rede_comunidade_flairs f where f.comunidade = c.slug), '[]'::jsonb));
end $$;

-- ── 4. O tópico aberto ────────────────────────────────────────────────────────────────────────────────────────────────────

/**
 * O que o fórum sabe da conversa deste post (qualquer post dela): se a raiz é tópico (e o tópico como a lista mostra), se quem lê
 * pode mudar o estado e o resumo, se modera, de onde o tópico veio (só se quem lê pode ver o original) e para onde partes desta
 * conversa foram levadas ("continua em": só os tópicos que quem lê pode ver).
 * Devolve {raiz, topico, item, pode_mudar, modero, veio_de, continua: [{de, topico, titulo, comunidade}]}.
 */
create or replace function public.alumia_forum_topico(p_post uuid) returns jsonb language plpgsql volatile security definer set search_path = interno, pg_temp as $$
declare v uuid := auth.uid(); x rede_posts; raiz rede_posts; o rede_posts; f alumia_forum_topicos; v_e boolean; v_veio uuid;
begin
  perform interno.aberta('comunidade');
  perform interno.limite('rede2_ler', 600, 60);
  select * into x from rede_posts where id = p_post;
  if not found or not interno.rede_ve(x, v) then perform interno.erro('nao_encontrado'); end if;
  raiz := interno.rede3_conv_raiz(x);
  v_e := interno.alumia_o10_e_topico(raiz) and interno.rede_ve(raiz, v);
  select * into f from alumia_forum_topicos where post = raiz.id;
  if f.veio_de is not null then
    select * into o from rede_posts where id = f.veio_de;
    if found and interno.rede_ve(o, v) then v_veio := o.id; end if;
  end if;
  return jsonb_build_object(
    'raiz', raiz.id, 'topico', v_e,
    'item', case when v_e then interno.alumia_o10_item(raiz, v) end,
    'pode_mudar', v_e and v is not null and interno.rede2_membro(v) and (raiz.autor = v or interno.rede3_conv_modera(raiz, v)),
    'modero', v is not null and interno.rede3_conv_modera(raiz, v),
    'veio_de', v_veio,
    'continua', coalesce((
      select jsonb_agg(jsonb_build_object('de', t.veio_de, 'topico', t.post, 'titulo', coalesce(nullif(n.titulo, ''), left(n.texto, 140)), 'comunidade', n.comunidade)
             order by n.criado_em)
      from alumia_forum_topicos t join rede_posts n on n.id = t.post
      where t.veio_de in (select r.id from rede_posts r where r.id = raiz.id or r.root_id = raiz.id)
        and n.apagado_em is null and interno.rede_ve(n, v)), '[]'::jsonb));
end $$;

/** Muda o estado do tópico (aberto, encaminhado, resolvido). Só quem abriu o tópico ou a moderação. Devolve o tópico. */
create or replace function public.alumia_forum_estado(p_post uuid, p_estado text) returns jsonb language plpgsql volatile security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); x rede_posts; v_estado text := btrim(coalesce(p_estado, ''));
begin
  perform interno.aberta('comunidade');
  if not interno.rede2_membro(v) then perform interno.erro('consentimento'); end if;
  select * into x from rede_posts where id = p_post;
  if not found or not interno.rede_ve(x, v) then perform interno.erro('nao_encontrado'); end if;
  if not interno.alumia_o10_e_topico(x) then perform interno.erro('invalido:topico'); end if;
  if x.autor is distinct from v and not interno.rede3_conv_modera(x, v) then perform interno.erro('sem_permissao'); end if;
  if v_estado not in ('aberto', 'encaminhado', 'resolvido') then perform interno.erro('invalido:estado'); end if;
  perform interno.rede2_limite('editar');
  insert into alumia_forum_topicos (post, estado, estado_em) values (x.id, v_estado, now())
    on conflict (post) do update set estado = excluded.estado, estado_em = excluded.estado_em;
  perform interno.registrar('alumia_forum_estado', x.id::text, jsonb_build_object('estado', v_estado));
  return interno.alumia_o10_item(x, v);
end $$;

/**
 * Escreve (ou tira, com texto vazio) o resumo de uma linha do tópico: até 140 caracteres, numa linha só. Só quem abriu o tópico ou
 * a moderação. Guarda só QUAL papel escreveu. Devolve o tópico.
 */
create or replace function public.alumia_forum_resumo(p_post uuid, p_texto text) returns jsonb language plpgsql volatile security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); x rede_posts; v_texto text;
begin
  perform interno.aberta('comunidade');
  if not interno.rede2_membro(v) then perform interno.erro('consentimento'); end if;
  select * into x from rede_posts where id = p_post;
  if not found or not interno.rede_ve(x, v) then perform interno.erro('nao_encontrado'); end if;
  if not interno.alumia_o10_e_topico(x) then perform interno.erro('invalido:topico'); end if;
  if x.autor is distinct from v and not interno.rede3_conv_modera(x, v) then perform interno.erro('sem_permissao'); end if;
  perform interno.rede2_limite('editar');
  v_texto := btrim(regexp_replace(coalesce(p_texto, ''), '\s+', ' ', 'g'));
  if v_texto = '' then
    update alumia_forum_topicos set resumo = null, resumo_de = null, resumo_em = null where post = x.id;
    perform interno.registrar('alumia_forum_resumo_retirado', x.id::text);
    return interno.alumia_o10_item(x, v);
  end if;
  v_texto := interno.txt(v_texto, 'resumo', 1, 140);
  perform interno.alumia_o10_resumo_ok(v_texto, v);
  insert into alumia_forum_topicos (post, resumo, resumo_de, resumo_em)
    values (x.id, v_texto, case when x.autor = v then 'autora' else 'moderacao' end, now())
    on conflict (post) do update set resumo = excluded.resumo, resumo_de = excluded.resumo_de, resumo_em = excluded.resumo_em;
  perform interno.registrar('alumia_forum_resumo', x.id::text);
  return interno.alumia_o10_item(x, v);
end $$;

-- ── 5. Virar tópico ───────────────────────────────────────────────────────────────────────────────────────────────────────

/**
 * Leva um post (a raiz de uma conversa ou uma resposta dela) para um tópico NOVO no fórum de uma comunidade. p: {comunidade,
 * titulo (5 a 140), corpo (10 a 10.000), tipo: 'discussao' (padrão) | 'duvida', etiqueta (da comunidade, opcional)}.
 * O tópico novo passa por TODAS as conferências de publicar (rede_publicar: idade, codinome, banimento, limite, dado pessoal,
 * veredito, etiqueta da comunidade) e cita o original quando quem escreveu deixa citar (se não deixa, fica só o vínculo).
 * Quem pode: a autora do original, ou a moderação que cuida do lugar de onde ele vem E da comunidade de destino. O mesmo post não
 * vira dois tópicos na mesma comunidade. A autora é avisada quando foi a moderação que levou (o aviso não diz quem).
 * Devolve {topico, avaliar, citou}.
 */
create or replace function public.alumia_forum_virar(p_post uuid, p jsonb) returns jsonb language plpgsql volatile security definer set search_path = interno, pg_temp as $$
declare
  v uuid := interno.eu(); o rede_posts; x rede_posts; c rede_comunidades;
  v_tipo text; v_pub jsonb; v_id uuid; v_titulo text;
begin
  perform interno.aberta('comunidade');
  if not interno.rede2_membro(v) then perform interno.erro('consentimento'); end if;
  if p is null or jsonb_typeof(p) is distinct from 'object' then perform interno.erro('invalido:forum'); end if;
  select * into o from rede_posts where id = p_post;
  if not found or not interno.rede_ve(o, v) or o.oculto or o.retido or o.apagado_em is not null then perform interno.erro('nao_encontrado'); end if;
  c := interno.rede3_com_achar(nullif(btrim(coalesce(p ->> 'comunidade', '')), ''));
  if c.slug is null then perform interno.erro('invalido:comunidade'); end if;
  if o.autor is distinct from v and not (interno.rede3_conv_modera(o, v) and interno.rede3_com_modera(c.slug, v)) then
    perform interno.erro('sem_permissao');
  end if;
  v_tipo := coalesce(nullif(btrim(p ->> 'tipo'), ''), 'discussao');
  if v_tipo not in ('discussao', 'duvida') then perform interno.erro('invalido:tipo'); end if;
  if exists (select 1 from alumia_forum_topicos t join rede_posts n on n.id = t.post
             where t.veio_de = o.id and n.comunidade = c.slug and n.apagado_em is null) then
    perform interno.erro('ja_virou');
  end if;

  v_pub := public.rede_publicar(jsonb_build_object('tipo', v_tipo, 'titulo', p ->> 'titulo', 'corpo', p ->> 'corpo',
    'comunidade', c.slug, 'flair', nullif(btrim(coalesce(p ->> 'etiqueta', '')), '')));
  v_id := (v_pub ->> 'id')::uuid;
  if v_id is null or v_id = o.id then perform interno.erro('invalido:forum'); end if;
  -- Cita o original só se quem escreveu deixa citar (a escolha "quem pode citar" do B1 vale aqui também). Sem citação, o vínculo
  -- "veio de" continua, e a conversa original abre pelo link para quem pode vê-la.
  if to_regprocedure('interno.rede_b1_pode_citar(uuid, uuid)') is null or interno.rede_b1_pode_citar(o.id, v) then
    update rede_posts set quote_of = o.id where id = v_id and autor = v;
  end if;
  insert into alumia_forum_topicos (post, veio_de) values (v_id, o.id)
    on conflict (post) do update set veio_de = excluded.veio_de;
  select * into x from rede_posts where id = v_id;
  v_titulo := coalesce(x.titulo, left(x.texto, 80));
  perform interno.registrar('alumia_forum_virou', v_id::text, jsonb_build_object('de', o.id));

  -- A autora fica sabendo quando não foi ela quem levou. Sem o nome de quem levou (vai como aviso da moderação).
  if o.autor is not null and o.autor <> v and not x.oculto and not x.retido and not interno.rede_bloqueado(v, o.autor) and interno.rede_ve(x, o.autor) then
    perform interno.rede3_conv_avisar(o.autor, 'moderacao', o.id, x.id, null,
      format('A moderação levou a sua mensagem para um tópico do fórum de %s: “%s”.', c.nome, left(v_titulo, 80)));
  end if;
  return jsonb_build_object('topico', v_id, 'avaliar', coalesce((v_pub ->> 'avaliar')::boolean, false), 'citou', x.quote_of is not null);
end $$;

-- ── 6. Permissões ─────────────────────────────────────────────────────────────────────────────────────────────────────────
revoke all on function interno.alumia_o10_e_topico(interno.rede_posts), interno.alumia_o10_estado(interno.rede_posts, interno.alumia_forum_topicos),
  interno.alumia_o10_item(interno.rede_posts, uuid), interno.alumia_o10_resumo_ok(text, uuid) from public;
revoke all on function public.alumia_forum_lista(text, jsonb), public.alumia_forum_topico(uuid), public.alumia_forum_estado(uuid, text),
  public.alumia_forum_resumo(uuid, text), public.alumia_forum_virar(uuid, jsonb) from public;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on function interno.alumia_o10_e_topico(interno.rede_posts), interno.alumia_o10_estado(interno.rede_posts, interno.alumia_forum_topicos),
      interno.alumia_o10_item(interno.rede_posts, uuid), interno.alumia_o10_resumo_ok(text, uuid) from anon, authenticated;
    revoke all on function public.alumia_forum_lista(text, jsonb), public.alumia_forum_topico(uuid), public.alumia_forum_estado(uuid, text),
      public.alumia_forum_resumo(uuid, text), public.alumia_forum_virar(uuid, jsonb) from anon, authenticated;
    -- Ler o fórum é como ler a comunidade (a matriz de quem vê decide o que sai); mudar pede conta.
    grant execute on function public.alumia_forum_lista(text, jsonb), public.alumia_forum_topico(uuid) to anon, authenticated, service_role;
    grant execute on function public.alumia_forum_estado(uuid, text), public.alumia_forum_resumo(uuid, text), public.alumia_forum_virar(uuid, jsonb) to authenticated, service_role;
  end if;
end $$;

-- ── 7. A porta em todas as funções novas ──────────────────────────────────────────────────────────────────────────────────
do $$
declare v jsonb := interno.alumia_trancar();
begin
  if jsonb_array_length(v -> 'abertas') > 0 then
    raise warning 'alumia_trancar: função sem porta: %', v -> 'abertas';
  end if;
end $$;
select interno.alumia_trancar();
