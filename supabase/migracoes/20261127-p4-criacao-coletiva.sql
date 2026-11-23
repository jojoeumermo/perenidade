-- Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
-- Alumia · Prompt 4 · criação coletiva (itens 33, 34, 36 e 37), atrás do interruptor "alumia-p4-criacao-coletiva".
-- Roda depois das migrações 20261127-p4-* da onda 1 (banco na versão 17 com elas); quem junta põe antes do 20261127-p4-fim.sql.
-- Não sobe rede_alumia_versao nem mexe na lista da porta.
--
-- O que faz:
--   0. O interruptor no catálogo (só pelo nome, desligado). Desligado, toda função daqui responde "desligado".
--   1. Item 33, rascunho coletivo de nota ou manifesto. O rascunho É uma página da wiki da comunidade (interno.rede_alumia_wiki), com
--      o nome "rascunho-…": o texto, as versões, o comparar e o voltar são os da wiki (rede_alumia_wiki_salvar, _historico e
--      _restaurar), sem histórico novo. Em cima dela: sugestões de troca de trecho ("trocar X por Y, porque…"), que quem pode editar
--      a wiki aceita (vira uma versão nova da wiki) ou recusa; e comentários, que são as anotações do item 34. A moderação fecha o
--      rascunho (a página trava, como a trava da wiki).
--   2. Item 34, anotar trechos do acervo e discutir à margem: uma anotação presa a um trecho de uma página da wiki da comunidade
--      (a versão, o começo e o fim do trecho e o próprio trecho, para achar de novo depois que o texto mudar), com respostas. Só
--      quem é da comunidade (membro ativo ou moderação) lê e escreve, mesmo quando a comunidade é aberta e a wiki é lida por
--      qualquer conta. Núcleo: desde a R2 o servidor não sabe quem é de cada núcleo (20261124-r2-membros.sql), então a anotação
--      "só para o núcleo" NÃO entra aqui: fica para a mensagem do grupo do núcleo (pendência do prompt 2).
--   3. Item 36, estúdio de cartaz: a identidade visual da organização (três cores, uma das fontes da Alumia e a assinatura), que
--      quem gerencia grava e quem fala pela organização (gestão ou função com "avisos") usa no estúdio. O cartaz é desenhado no
--      aparelho; o banco não recebe imagem nenhuma. O contraste entre o texto e o fundo tem de passar de 4,5 (WCAG AA).
--   4. Item 37, zine: o banco entrega, de uma lista de posts escolhida pela pessoa, só os que podem sair da Alumia (a mesma regra do
--      RSS e do cartão, interno.alumia_alc_sai, e que ela vê por interno.rede_ve) e os dela mesma (não cifrados, não retidos). A
--      folha A4 é montada e impressa no aparelho.
--
-- Privacidade: nenhuma função devolve quem escreveu uma sugestão, anotação ou resposta (só "minha"), nem a ninguém da moderação;
-- nenhuma contagem; nenhum endereço de rede; nada de texto de post para terceiros (a zine é impressa no aparelho). Tabelas em
-- interno, RLS ligada sem política, nenhuma permissão direta; acesso só pelas funções security definer abaixo, todas com a porta da
-- Alumia (interno.alumia_porta) na primeira linha.
-- Pode rodar mais de uma vez. Teste: npm run testar:p4-criacao-coletiva. Nenhuma função existente é redefinida: todas as daqui são
-- novas (prefixo rede_p4_cc_).
-- Lei: LGPD art. 6º, III (necessidade: só o que a função precisa), art. 11 (dado sensível: opinião e organização política; quem
-- escreveu cada trecho de um manifesto não sai em função nenhuma) e art. 46 (segurança).

-- ── 0. O interruptor ───────────────────────────────────────────────────────────────────────────────────────────────────────
do $$
begin
  if to_regclass('interno.recursos_catalogo') is not null then
    insert into interno.recursos_catalogo (nome, so_pelo_nome) values ('alumia-p4-criacao-coletiva', true)
      on conflict (nome) do update set so_pelo_nome = true;
  end if;
end $$;

/** A criação coletiva está ligada? Só com decisão explícita do painel, e sem a Alumia desligada lá. Sem a tabela: desligada. */
create or replace function interno.rede_p4_cc_ligada() returns boolean language plpgsql stable security definer set search_path = interno, pg_temp as $$
begin
  if to_regclass('interno.recursos_vivos') is null then return false; end if;
  if exists (select 1 from recursos_vivos where nome in ('rede-v2', 'alumia-2') and not ligado) then return false; end if;
  return coalesce((select ligado from recursos_vivos where nome = 'alumia-p4-criacao-coletiva'), false);
end $$;

create or replace function interno.rede_p4_cc_exige() returns void language plpgsql stable security definer set search_path = interno, pg_temp as $$
begin
  if not interno.rede_p4_cc_ligada() then perform interno.erro('desligado'); end if;
end $$;

-- ── 1. As tabelas ──────────────────────────────────────────────────────────────────────────────────────────────────────────

-- O rascunho coletivo: uma página da wiki marcada como rascunho de nota ou de manifesto.
create table if not exists interno.rede_p4_cc_rascunhos (
  comunidade text not null,
  pagina text not null check (pagina ~ '^rascunho-[a-z0-9-]{1,51}$'),
  tipo text not null check (tipo in ('nota', 'manifesto')),
  situacao text not null default 'aberto' check (situacao in ('aberto', 'fechado')),
  criado_em timestamptz not null default now(),
  fechado_em timestamptz,
  primary key (comunidade, pagina),
  foreign key (comunidade, pagina) references interno.rede_alumia_wiki (comunidade, pagina) on delete cascade on update cascade
);

-- Uma sugestão de troca de trecho num rascunho. O autor fica só para "minha" e para retirar; nunca sai em função.
create table if not exists interno.rede_p4_cc_sugestoes (
  id uuid primary key default gen_random_uuid(),
  comunidade text not null,
  pagina text not null,
  base integer not null check (base > 0),
  trecho text not null check (char_length(trecho) between 1 and 2000),
  proposta text not null default '' check (char_length(proposta) <= 2000),
  motivo text not null default '' check (char_length(motivo) <= 280),
  autor uuid references interno.perfis (id) on delete cascade,
  situacao text not null default 'aberta' check (situacao in ('aberta', 'aceita', 'recusada')),
  criado_em timestamptz not null default now(),
  decidido_em timestamptz,
  foreign key (comunidade, pagina) references interno.rede_p4_cc_rascunhos (comunidade, pagina) on delete cascade on update cascade
);
create index if not exists rede_p4_cc_sugestoes_pagina on interno.rede_p4_cc_sugestoes (comunidade, pagina, criado_em);

-- A anotação à margem (presa a um trecho) ou o comentário geral (sem trecho) de uma página da wiki.
create table if not exists interno.rede_p4_cc_anotacoes (
  id uuid primary key default gen_random_uuid(),
  comunidade text not null,
  pagina text not null,
  versao integer not null check (versao > 0),
  inicio integer,
  fim integer,
  trecho text not null default '',
  texto text not null check (char_length(texto) between 1 and 1000),
  autor uuid references interno.perfis (id) on delete cascade,
  resolvida boolean not null default false,
  criado_em timestamptz not null default now(),
  check ((inicio is null and fim is null and trecho = '')
         or (inicio >= 0 and fim > inicio and fim - inicio <= 500 and char_length(trecho) = fim - inicio)),
  foreign key (comunidade, pagina) references interno.rede_alumia_wiki (comunidade, pagina) on delete cascade on update cascade
);
create index if not exists rede_p4_cc_anotacoes_pagina on interno.rede_p4_cc_anotacoes (comunidade, pagina, criado_em);

-- As respostas a uma anotação da margem: o texto e quem respondeu (só para a própria pessoa apagar a dela; nunca sai para outra).
create table if not exists interno.rede_p4_cc_anotacao_respostas (
  id uuid primary key default gen_random_uuid(),
  anotacao uuid not null references interno.rede_p4_cc_anotacoes (id) on delete cascade,
  texto text not null check (char_length(texto) between 1 and 1000),
  autor uuid references interno.perfis (id) on delete cascade,
  criado_em timestamptz not null default now()
);
create index if not exists rede_p4_cc_anotacao_respostas_anotacao on interno.rede_p4_cc_anotacao_respostas (anotacao, criado_em);

-- A identidade visual da organização para o estúdio de cartaz.
create table if not exists interno.rede_p4_cc_org_identidade (
  org uuid primary key references interno.rede_orgs (perfil) on delete cascade,
  fundo text not null check (fundo ~ '^#[0-9a-f]{6}$'),
  destaque text not null check (destaque ~ '^#[0-9a-f]{6}$'),
  texto text not null check (texto ~ '^#[0-9a-f]{6}$'),
  fonte text not null default 'archivo' check (fonte in ('archivo', 'garamond', 'sistema', 'mono')),
  assinatura text not null default '' check (char_length(assinatura) <= 80),
  mudou_em timestamptz not null default now()
);

alter table interno.rede_p4_cc_rascunhos enable row level security;
alter table interno.rede_p4_cc_sugestoes enable row level security;
alter table interno.rede_p4_cc_anotacoes enable row level security;
alter table interno.rede_p4_cc_anotacao_respostas enable row level security;
alter table interno.rede_p4_cc_org_identidade enable row level security;
do $$
begin
  revoke all on table interno.rede_p4_cc_rascunhos, interno.rede_p4_cc_sugestoes, interno.rede_p4_cc_anotacoes, interno.rede_p4_cc_anotacao_respostas,
    interno.rede_p4_cc_org_identidade from public;
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on table interno.rede_p4_cc_rascunhos, interno.rede_p4_cc_sugestoes, interno.rede_p4_cc_anotacoes, interno.rede_p4_cc_anotacao_respostas,
      interno.rede_p4_cc_org_identidade from anon, authenticated;
  end if;
end $$;

-- ── 2. Peças de dentro ─────────────────────────────────────────────────────────────────────────────────────────────────────

/** É da comunidade (membro ativo, não banido, membro da Alumia) ou a modera? Só quem é da comunidade lê e escreve à margem. */
create or replace function interno.rede_p4_cc_da_comunidade(p_slug text, p_quem uuid) returns boolean language sql stable security definer set search_path = interno, pg_temp as $$
  select coalesce(p_quem is not null and interno.rede2_membro(p_quem)
    and (interno.rede3_com_modera(p_slug, p_quem) or interno.rede3_com_situacao(p_slug, p_quem) = 'membro'), false)
$$;

/**
 * A página da wiki para a criação coletiva: confere o interruptor, se a pessoa vê a comunidade e se é dela; senão "sem_permissao"
 * (quem não é da comunidade não fica sabendo nem se há anotação).
 */
create or replace function interno.rede_p4_cc_pagina_de(p_slug text, p_pagina text, p_quem uuid) returns interno.rede_alumia_wiki language plpgsql stable security definer set search_path = interno, pg_temp as $$
declare c rede_comunidades; w rede_alumia_wiki;
begin
  perform interno.rede_p4_cc_exige();
  perform interno.aberta('comunidade');
  c := interno.rede_alumia_com_ver(p_slug, p_quem);
  if not interno.rede_p4_cc_da_comunidade(c.slug, p_quem) then perform interno.erro('sem_permissao'); end if;
  select * into w from rede_alumia_wiki where comunidade = c.slug and pagina = coalesce(p_pagina, '');
  if not found then perform interno.erro('nao_encontrado'); end if;
  return w;
end $$;

/** Pode decidir sugestões nesta página (quem pode editar a wiki, e a página não travada, ou a moderação)? */
create or replace function interno.rede_p4_cc_decide(w interno.rede_alumia_wiki, p_quem uuid) returns boolean language sql stable security definer set search_path = interno, pg_temp as $$
  select coalesce(interno.rede3_com_modera(w.comunidade, p_quem) or (interno.rede_alumia_wiki_edita(w.comunidade, p_quem) and not w.travada), false)
$$;

/** Quantas vezes o trecho aparece no texto (sem expressão regular: o trecho é texto puro). */
create or replace function interno.rede_p4_cc_vezes(p_texto text, p_trecho text) returns integer language sql immutable as $$
  select case when coalesce(p_trecho, '') = '' then 0
    else (char_length(coalesce(p_texto, '')) - char_length(replace(coalesce(p_texto, ''), p_trecho, ''))) / char_length(p_trecho) end
$$;

/** Grava uma versão nova da página (a mesma tabela de versões da wiki) e devolve o número dela. */
create or replace function interno.rede_p4_cc_nova_versao(w interno.rede_alumia_wiki, p_corpo text, p_resumo text, p_quem uuid) returns integer language plpgsql security definer set search_path = interno, pg_temp as $$
declare v_ver integer := w.versao + 1;
begin
  update rede_alumia_wiki set corpo = p_corpo, versao = v_ver, editado_em = now() where comunidade = w.comunidade and pagina = w.pagina;
  insert into rede_alumia_wiki_versoes (comunidade, pagina, versao, titulo, corpo, resumo, editou) values (w.comunidade, w.pagina, v_ver, w.titulo, p_corpo, left(p_resumo, 140), p_quem);
  delete from rede_alumia_wiki_versoes where comunidade = w.comunidade and pagina = w.pagina and versao <= v_ver - 200;
  return v_ver;
end $$;

/** A luminância relativa de uma cor "#rrggbb" (WCAG 2). */
create or replace function interno.rede_p4_cc_luminancia(p_cor text) returns numeric language plpgsql immutable as $$
declare v_canais numeric[] := array[]::numeric[]; v_c numeric; i integer;
begin
  for i in 0..2 loop
    v_c := ('x' || substr(p_cor, 2 + i * 2, 2))::bit(8)::integer / 255.0;
    v_canais := v_canais || case when v_c <= 0.03928 then v_c / 12.92 else power((v_c + 0.055) / 1.055, 2.4) end;
  end loop;
  return 0.2126 * v_canais[1] + 0.7152 * v_canais[2] + 0.0722 * v_canais[3];
end $$;

/** O contraste entre duas cores "#rrggbb" (de 1 a 21). */
create or replace function interno.rede_p4_cc_contraste(p_a text, p_b text) returns numeric language sql immutable as $$
  select (greatest(interno.rede_p4_cc_luminancia(p_a), interno.rede_p4_cc_luminancia(p_b)) + 0.05)
       / (least(interno.rede_p4_cc_luminancia(p_a), interno.rede_p4_cc_luminancia(p_b)) + 0.05)
$$;

-- ── 3. Rascunho coletivo (item 33) e anotações (item 34): as funções da tela ───────────────────────────────────────────────

/** O interruptor, para a tela saber se mostra a criação coletiva (o banco confere de novo em cada chamada). */
create or replace function public.rede_p4_cc_aberto() returns boolean language plpgsql stable security definer set search_path = interno, pg_temp as $$
begin
  perform interno.alumia_porta();
  return auth.uid() is not null and interno.rede_p4_cc_ligada();
end $$;

/** Os rascunhos de uma comunidade (os abertos primeiro), para quem é dela. Sem autor e sem contagem. */
create or replace function public.rede_p4_cc_rascunhos(p_slug text) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid; c rede_comunidades;
begin
  perform interno.alumia_porta();
  v := interno.eu();
  perform interno.rede_p4_cc_exige();
  perform interno.aberta('comunidade');
  c := interno.rede_alumia_com_ver(p_slug, v);
  if not interno.rede_p4_cc_da_comunidade(c.slug, v) then perform interno.erro('sem_permissao'); end if;
  perform interno.limite('rede2_ler', 600, 60);
  return jsonb_build_object(
    'comunidade', jsonb_build_object('slug', c.slug, 'nome', c.nome),
    'pode_criar', interno.rede_alumia_wiki_edita(c.slug, v),
    'rascunhos', coalesce((select jsonb_agg(jsonb_build_object('pagina', r.pagina, 'titulo', w.titulo, 'tipo', r.tipo, 'situacao', r.situacao,
        'versao', w.versao, 'editado_em', w.editado_em,
        'sugestoes_abertas', exists (select 1 from rede_p4_cc_sugestoes s where s.comunidade = r.comunidade and s.pagina = r.pagina and s.situacao = 'aberta'))
      order by r.situacao = 'aberto' desc, w.editado_em desc)
      from rede_p4_cc_rascunhos r join rede_alumia_wiki w on w.comunidade = r.comunidade and w.pagina = r.pagina
      where r.comunidade = c.slug), '[]'::jsonb),
    -- As outras páginas do acervo (a wiki), para anotar à margem (item 34): título e versão, sem quem editou e sem contagem.
    'paginas', coalesce((select jsonb_agg(jsonb_build_object('pagina', w.pagina, 'titulo', w.titulo, 'versao', w.versao, 'editado_em', w.editado_em)
        order by w.titulo)
      from rede_alumia_wiki w
      where w.comunidade = c.slug and not exists (select 1 from rede_p4_cc_rascunhos r where r.comunidade = w.comunidade and r.pagina = w.pagina)), '[]'::jsonb));
end $$;

/** As comunidades de que a própria pessoa é (membro ativo ou moderação), para escolher onde criar. Só sobre ela; sem contagem. */
create or replace function public.rede_p4_cc_minhas_comunidades() returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid;
begin
  perform interno.alumia_porta();
  v := interno.eu();
  perform interno.rede_p4_cc_exige();
  perform interno.aberta('comunidade');
  perform interno.limite('rede2_ler', 600, 60);
  return coalesce((select jsonb_agg(jsonb_build_object('slug', c.slug, 'nome', c.nome, 'modero', coalesce(interno.rede3_com_modera(c.slug, v), false),
      'edito', coalesce(interno.rede_alumia_wiki_edita(c.slug, v), false)) order by c.nome)
    from rede_comunidades c
    where c.slug not like 'fechado-%' and interno.rede_p4_cc_da_comunidade(c.slug, v)), '[]'::jsonb);
end $$;

/**
 * Começa um rascunho de nota ou de manifesto: uma página nova da wiki ("rascunho-<título>"), com a primeira versão. Quem pode
 * criar página na wiki da comunidade. As mesmas regras da wiki: título de 2 a 120, texto até 20.000, sem CPF, até 50 páginas.
 */
create or replace function public.rede_p4_cc_rascunho_criar(p_slug text, p_titulo text, p_tipo text, p_corpo text) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid; c rede_comunidades; v_tit text; v_corpo text; v_pag text;
begin
  perform interno.alumia_porta();
  v := interno.eu();
  perform interno.rede_p4_cc_exige();
  perform interno.aberta('comunidade');
  c := interno.rede_alumia_com_ver(p_slug, v);
  if not interno.rede_p4_cc_da_comunidade(c.slug, v) or not interno.rede_alumia_wiki_edita(c.slug, v) then perform interno.erro('sem_permissao'); end if;
  if coalesce(p_tipo, '') not in ('nota', 'manifesto') then perform interno.erro('invalido:tipo'); end if;
  v_tit := interno.txt(p_titulo, 'titulo', 2, 120);
  v_corpo := interno.txt(p_corpo, 'corpo', 1, 20000);
  if v_corpo ~ '\d{3}\.\d{3}\.\d{3}-\d{2}' or v_tit ~ '\d{3}\.\d{3}\.\d{3}-\d{2}' then perform interno.erro('dado_pessoal'); end if;
  perform interno.limite('alumia_wiki', 30, 60);
  v_pag := rtrim(left('rascunho-' || interno.rede_alumia_wiki_slug(v_tit), 60), '-');
  if v_pag !~ '^rascunho-[a-z0-9-]{1,51}$' then perform interno.erro('invalido:titulo'); end if;
  if exists (select 1 from rede_alumia_wiki where comunidade = c.slug and pagina = v_pag) then perform interno.erro('ja_existe'); end if;
  if (select count(*) from rede_alumia_wiki where comunidade = c.slug) >= 50 then perform interno.erro('invalido:muitas'); end if;
  insert into rede_alumia_wiki (comunidade, pagina, titulo, corpo) values (c.slug, v_pag, v_tit, v_corpo);
  insert into rede_alumia_wiki_versoes (comunidade, pagina, versao, titulo, corpo, resumo, editou) values (c.slug, v_pag, 1, v_tit, v_corpo, 'Rascunho começado', v);
  insert into rede_p4_cc_rascunhos (comunidade, pagina, tipo) values (c.slug, v_pag, p_tipo);
  return jsonb_build_object('pagina', v_pag, 'versao', 1);
end $$;

/**
 * Uma página da wiki com a margem: o texto da versão atual, as anotações (com as respostas) e, se for rascunho, as sugestões. Para
 * cada item, só "minha" (nunca quem escreveu). Serve para qualquer página do acervo da comunidade (item 34) e para o rascunho (33).
 */
create or replace function public.rede_p4_cc_pagina(p_slug text, p_pagina text) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid; w rede_alumia_wiki; r rede_p4_cc_rascunhos; v_mod boolean;
begin
  perform interno.alumia_porta();
  v := interno.eu();
  w := interno.rede_p4_cc_pagina_de(p_slug, p_pagina, v);
  perform interno.limite('rede2_ler', 600, 60);
  select * into r from rede_p4_cc_rascunhos where comunidade = w.comunidade and pagina = w.pagina;
  v_mod := interno.rede3_com_modera(w.comunidade, v);
  return jsonb_build_object(
    'comunidade', w.comunidade,
    'pagina', jsonb_build_object('pagina', w.pagina, 'titulo', w.titulo, 'corpo', w.corpo, 'versao', w.versao, 'editado_em', w.editado_em, 'travada', w.travada),
    'rascunho', case when r.pagina is not null then jsonb_build_object('tipo', r.tipo, 'situacao', r.situacao, 'fechado_em', r.fechado_em) end,
    'sugestoes', case when r.pagina is null then '[]'::jsonb else coalesce((select jsonb_agg(jsonb_build_object('id', s.id, 'base', s.base, 'trecho', s.trecho,
        'proposta', s.proposta, 'motivo', s.motivo, 'situacao', s.situacao, 'criado_em', s.criado_em, 'decidido_em', s.decidido_em,
        'minha', s.autor = v) order by s.situacao = 'aberta' desc, s.criado_em)
      from rede_p4_cc_sugestoes s where s.comunidade = w.comunidade and s.pagina = w.pagina), '[]'::jsonb) end,
    'anotacoes', coalesce((select jsonb_agg(jsonb_build_object('id', a.id, 'versao', a.versao, 'inicio', a.inicio, 'fim', a.fim, 'trecho', a.trecho,
        'texto', a.texto, 'resolvida', a.resolvida, 'criado_em', a.criado_em, 'minha', a.autor = v,
        'respostas', coalesce((select jsonb_agg(jsonb_build_object('id', x.id, 'texto', x.texto, 'criado_em', x.criado_em, 'minha', x.autor = v) order by x.criado_em)
          from rede_p4_cc_anotacao_respostas x where x.anotacao = a.id), '[]'::jsonb)) order by a.resolvida, a.inicio nulls last, a.criado_em)
      from rede_p4_cc_anotacoes a where a.comunidade = w.comunidade and a.pagina = w.pagina), '[]'::jsonb),
    'pode', jsonb_build_object(
      'anotar', true,
      'editar', interno.rede_alumia_wiki_edita(w.comunidade, v) and (not w.travada or v_mod),
      'sugerir', r.pagina is not null and r.situacao = 'aberto',
      'decidir', r.pagina is not null and r.situacao = 'aberto' and interno.rede_p4_cc_decide(w, v),
      'fechar', r.pagina is not null and v_mod,
      'moderar', v_mod));
end $$;

/**
 * Sugere trocar um trecho do rascunho (proposta vazia = tirar o trecho). p_base é a versão que a pessoa leu: se o texto mudou no
 * meio, "conflito"; o trecho tem de estar no texto atual. Até 30 sugestões por hora.
 */
create or replace function public.rede_p4_cc_sugerir(p_slug text, p_pagina text, p_base integer, p_trecho text, p_proposta text, p_motivo text default '') returns jsonb
language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid; w rede_alumia_wiki; r rede_p4_cc_rascunhos; v_trecho text; v_id uuid;
  v_proposta text; v_motivo text;
begin
  perform interno.alumia_porta();
  v := interno.eu();
  v_trecho := coalesce(p_trecho, '');
  v_proposta := interno.txt(p_proposta, 'proposta', 0, 2000);
  v_motivo := interno.txt(p_motivo, 'motivo', 0, 280);
  w := interno.rede_p4_cc_pagina_de(p_slug, p_pagina, v);
  select * into r from rede_p4_cc_rascunhos where comunidade = w.comunidade and pagina = w.pagina;
  if r.pagina is null then perform interno.erro('nao_e_rascunho'); end if;
  if r.situacao <> 'aberto' then perform interno.erro('travado'); end if;
  if p_base is null or p_base <> w.versao then perform interno.erro('conflito'); end if;
  if char_length(v_trecho) < 1 or char_length(v_trecho) > 2000 then perform interno.erro('invalido:trecho'); end if;
  if interno.rede_p4_cc_vezes(w.corpo, v_trecho) <> 1 then perform interno.erro('invalido:trecho'); end if;
  if v_proposta = btrim(v_trecho) then perform interno.erro('invalido:proposta'); end if;
  if v_proposta ~ '\d{3}\.\d{3}\.\d{3}-\d{2}' or v_motivo ~ '\d{3}\.\d{3}\.\d{3}-\d{2}' then perform interno.erro('dado_pessoal'); end if;
  perform interno.limite('p4_sugerir', 30, 60);
  insert into rede_p4_cc_sugestoes (comunidade, pagina, base, trecho, proposta, motivo, autor)
  values (w.comunidade, w.pagina, w.versao, v_trecho, v_proposta, v_motivo, v) returning id into v_id;
  return jsonb_build_object('id', v_id);
end $$;

/**
 * Aceita (o trecho vira a proposta numa versão nova da wiki) ou recusa uma sugestão aberta. Quem pode editar a wiki, com o
 * rascunho aberto. Se o trecho não está mais no texto (ou aparece mais de uma vez), "conflito": a sugestão continua aberta.
 */
create or replace function public.rede_p4_cc_sugestao_decidir(p_id uuid, p_aceitar boolean) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid; s rede_p4_cc_sugestoes; w rede_alumia_wiki; r rede_p4_cc_rascunhos; v_ver integer;
begin
  perform interno.alumia_porta();
  v := interno.eu();
  perform interno.rede_p4_cc_exige();
  select * into s from rede_p4_cc_sugestoes where id = p_id;
  if not found then perform interno.erro('nao_encontrado'); end if;
  w := interno.rede_p4_cc_pagina_de(s.comunidade, s.pagina, v);
  select * into r from rede_p4_cc_rascunhos where comunidade = s.comunidade and pagina = s.pagina;
  if r.situacao <> 'aberto' then perform interno.erro('travado'); end if;
  if not interno.rede_p4_cc_decide(w, v) then perform interno.erro('sem_permissao'); end if;
  if s.situacao <> 'aberta' then perform interno.erro('ja_decidida'); end if;
  perform interno.limite('alumia_wiki', 30, 60);
  if coalesce(p_aceitar, false) then
    select * into w from rede_alumia_wiki where comunidade = s.comunidade and pagina = s.pagina for update;
    if interno.rede_p4_cc_vezes(w.corpo, s.trecho) <> 1 then perform interno.erro('conflito'); end if;
    if char_length(replace(w.corpo, s.trecho, s.proposta)) not between 1 and 20000 then perform interno.erro('invalido:corpo'); end if;
    v_ver := interno.rede_p4_cc_nova_versao(w, replace(w.corpo, s.trecho, s.proposta), 'Sugestão aceita', v);
    update rede_p4_cc_sugestoes set situacao = 'aceita', decidido_em = now() where id = s.id;
    return jsonb_build_object('situacao', 'aceita', 'versao', v_ver);
  end if;
  update rede_p4_cc_sugestoes set situacao = 'recusada', decidido_em = now() where id = s.id;
  return jsonb_build_object('situacao', 'recusada', 'versao', w.versao);
end $$;

/**
 * Anota um trecho (p_inicio e p_fim contam letras a partir de 0 na versão p_versao, que tem de ser a atual; o trecho tem de bater
 * com o texto nesse lugar) ou comenta a página inteira (sem trecho). Só quem é da comunidade. Até 60 por hora.
 */
create or replace function public.rede_p4_cc_anotar(p_slug text, p_pagina text, p_versao integer, p_inicio integer, p_fim integer, p_texto text) returns jsonb
language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid; w rede_alumia_wiki; v_trecho text; v_id uuid; v_texto text;
begin
  perform interno.alumia_porta();
  v := interno.eu();
  v_texto := interno.txt(p_texto, 'texto', 1, 1000);
  v_trecho := '';
  w := interno.rede_p4_cc_pagina_de(p_slug, p_pagina, v);
  if p_versao is null or p_versao <> w.versao then perform interno.erro('conflito'); end if;
  if p_inicio is not null or p_fim is not null then
    if p_inicio is null or p_fim is null or p_inicio < 0 or p_fim <= p_inicio or p_fim - p_inicio > 500 or p_fim > char_length(w.corpo) then
      perform interno.erro('invalido:trecho');
    end if;
    v_trecho := substr(w.corpo, p_inicio + 1, p_fim - p_inicio);
  end if;
  if v_texto ~ '\d{3}\.\d{3}\.\d{3}-\d{2}' then perform interno.erro('dado_pessoal'); end if;
  perform interno.limite('p4_anotar', 60, 60);
  insert into rede_p4_cc_anotacoes (comunidade, pagina, versao, inicio, fim, trecho, texto, autor)
  values (w.comunidade, w.pagina, w.versao, p_inicio, p_fim, v_trecho, v_texto, v) returning id into v_id;
  return jsonb_build_object('id', v_id, 'trecho', v_trecho);
end $$;

/** Responde a uma anotação (a discussão à margem). Só quem é da comunidade. */
create or replace function public.rede_p4_cc_anotacao_responder(p_id uuid, p_texto text) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid; a rede_p4_cc_anotacoes; v_id uuid; v_texto text;
begin
  perform interno.alumia_porta();
  v := interno.eu();
  v_texto := interno.txt(p_texto, 'texto', 1, 1000);
  perform interno.rede_p4_cc_exige();
  select * into a from rede_p4_cc_anotacoes where id = p_id;
  if not found then perform interno.erro('nao_encontrado'); end if;
  perform interno.rede_p4_cc_pagina_de(a.comunidade, a.pagina, v);
  if v_texto ~ '\d{3}\.\d{3}\.\d{3}-\d{2}' then perform interno.erro('dado_pessoal'); end if;
  if (select count(*) from rede_p4_cc_anotacao_respostas where anotacao = a.id) >= 200 then perform interno.erro('invalido:muitas'); end if;
  perform interno.limite('p4_anotar', 60, 60);
  insert into rede_p4_cc_anotacao_respostas (anotacao, texto, autor) values (a.id, v_texto, v) returning id into v_id;
  return jsonb_build_object('id', v_id);
end $$;

/** Marca a anotação como resolvida (ou reabre): quem a escreveu, quem pode editar a página ou a moderação. */
create or replace function public.rede_p4_cc_anotacao_resolver(p_id uuid, p_sim boolean default true) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid; a rede_p4_cc_anotacoes; w rede_alumia_wiki;
begin
  perform interno.alumia_porta();
  v := interno.eu();
  perform interno.rede_p4_cc_exige();
  select * into a from rede_p4_cc_anotacoes where id = p_id;
  if not found then perform interno.erro('nao_encontrado'); end if;
  w := interno.rede_p4_cc_pagina_de(a.comunidade, a.pagina, v);
  if a.autor is distinct from v and not interno.rede_p4_cc_decide(w, v) then perform interno.erro('sem_permissao'); end if;
  update rede_p4_cc_anotacoes set resolvida = coalesce(p_sim, true) where id = a.id;
  return jsonb_build_object('resolvida', coalesce(p_sim, true));
end $$;

/**
 * Apaga uma anotação, uma resposta ou uma sugestão ainda aberta: quem escreveu, ou a moderação (que fica no registro, sem dizer de
 * quem era). p_tipo: 'anotacao', 'resposta' ou 'sugestao'.
 */
create or replace function public.rede_p4_cc_apagar(p_tipo text, p_id uuid) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid; v_com text; v_pag text; v_autor uuid; v_aberta boolean; v_mod boolean;
begin
  perform interno.alumia_porta();
  v := interno.eu();
  v_aberta := true;
  perform interno.rede_p4_cc_exige();
  if p_tipo = 'anotacao' then
    select comunidade, pagina, autor into v_com, v_pag, v_autor from rede_p4_cc_anotacoes where id = p_id;
  elsif p_tipo = 'resposta' then
    select a.comunidade, a.pagina, x.autor into v_com, v_pag, v_autor from rede_p4_cc_anotacao_respostas x join rede_p4_cc_anotacoes a on a.id = x.anotacao where x.id = p_id;
  elsif p_tipo = 'sugestao' then
    select comunidade, pagina, autor, situacao = 'aberta' into v_com, v_pag, v_autor, v_aberta from rede_p4_cc_sugestoes where id = p_id;
  else
    perform interno.erro('invalido:tipo');
  end if;
  if v_com is null then perform interno.erro('nao_encontrado'); end if;
  perform interno.rede_p4_cc_pagina_de(v_com, v_pag, v);
  v_mod := interno.rede3_com_modera(v_com, v);
  if v_autor is distinct from v and not v_mod then perform interno.erro('sem_permissao'); end if;
  if not v_aberta and not v_mod then perform interno.erro('ja_decidida'); end if;
  if p_tipo = 'anotacao' then delete from rede_p4_cc_anotacoes where id = p_id;
  elsif p_tipo = 'resposta' then delete from rede_p4_cc_anotacao_respostas where id = p_id;
  else delete from rede_p4_cc_sugestoes where id = p_id;
  end if;
  if v_autor is distinct from v then perform interno.registrar('alumia_p4_apagar_' || p_tipo, v_com || '/' || v_pag, '{}'::jsonb); end if;
  return jsonb_build_object('apagado', true);
end $$;

/** A moderação fecha o rascunho (a página trava e as sugestões param) ou reabre. O texto e as versões continuam na wiki. */
create or replace function public.rede_p4_cc_rascunho_fechar(p_slug text, p_pagina text, p_fechar boolean default true) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid; w rede_alumia_wiki;
begin
  perform interno.alumia_porta();
  v := interno.eu();
  w := interno.rede_p4_cc_pagina_de(p_slug, p_pagina, v);
  if not interno.rede3_com_modera(w.comunidade, v) then perform interno.erro('sem_permissao'); end if;
  if not exists (select 1 from rede_p4_cc_rascunhos where comunidade = w.comunidade and pagina = w.pagina) then perform interno.erro('nao_e_rascunho'); end if;
  update rede_p4_cc_rascunhos set situacao = case when coalesce(p_fechar, true) then 'fechado' else 'aberto' end,
    fechado_em = case when coalesce(p_fechar, true) then now() end
  where comunidade = w.comunidade and pagina = w.pagina;
  update rede_alumia_wiki set travada = coalesce(p_fechar, true) where comunidade = w.comunidade and pagina = w.pagina;
  perform interno.registrar('alumia_p4_rascunho_' || case when coalesce(p_fechar, true) then 'fechar' else 'abrir' end, w.comunidade || '/' || w.pagina, '{}'::jsonb);
  return jsonb_build_object('situacao', case when coalesce(p_fechar, true) then 'fechado' else 'aberto' end);
end $$;

-- ── 4. Estúdio de cartaz (item 36) ─────────────────────────────────────────────────────────────────────────────────────────

/** A identidade de uma organização como o estúdio usa (nula quando a organização ainda não gravou a dela). */
create or replace function interno.rede_p4_cc_identidade_json(p_org uuid) returns jsonb language sql stable security definer set search_path = interno, pg_temp as $$
  select jsonb_build_object('fundo', i.fundo, 'destaque', i.destaque, 'texto', i.texto, 'fonte', i.fonte, 'assinatura', i.assinatura, 'mudou_em', i.mudou_em)
  from rede_p4_cc_org_identidade i where i.org = p_org
$$;

/**
 * As organizações pelas quais a pessoa fala (gestão ou função com "avisos"), com a identidade de cada uma, para o estúdio. Só
 * sobre ela: nunca quem mais fala pela organização.
 */
create or replace function public.rede_p4_cc_estudio_orgs() returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid;
begin
  perform interno.alumia_porta();
  v := interno.eu();
  perform interno.rede_p4_cc_exige();
  perform interno.limite('rede2_ler', 600, 60);
  return coalesce((select jsonb_agg(jsonb_build_object('handle', f.rede_handle, 'nome', coalesce(nullif(f.rede_codinome, ''), f.rede_handle), 'palavra', o.palavra,
      'selo', o.verificada_em is not null, 'gerencio', coalesce(interno.alumia_org_gere(v, o.perfil), false),
      'identidade', interno.rede_p4_cc_identidade_json(o.perfil)) order by coalesce(nullif(f.rede_codinome, ''), f.rede_handle))
    from rede_orgs o join perfis f on f.id = o.perfil
    where not f.suspenso and f.rede_handle is not null and coalesce(interno.alumia_o12_comunica(v, o.perfil), false)), '[]'::jsonb);
end $$;

/**
 * Quem gerencia grava a identidade da organização: fundo, destaque e texto ("#rrggbb"), a fonte (uma das da Alumia) e a assinatura
 * (até 80 letras, sem link). O texto sobre o fundo precisa de contraste 4,5 ou mais. Até 20 gravações por hora.
 */
create or replace function public.rede_p4_cc_org_identidade_salvar(p_handle text, p jsonb) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v_org uuid; v_fundo text; v_destaque text; v_texto text; v_fonte text; v_assinatura text;
begin
  perform interno.alumia_porta();
  perform interno.rede_p4_cc_exige();
  v_org := interno.alumia_org_gestor(p_handle, 'p4_identidade', 20, 60);
  v_fundo := lower(coalesce(p ->> 'fundo', ''));
  v_destaque := lower(coalesce(p ->> 'destaque', ''));
  v_texto := lower(coalesce(p ->> 'texto', ''));
  v_fonte := coalesce(p ->> 'fonte', 'archivo');
  v_assinatura := interno.txt(coalesce(p ->> 'assinatura', ''), 'assinatura', 0, 80);
  if v_fundo !~ '^#[0-9a-f]{6}$' or v_destaque !~ '^#[0-9a-f]{6}$' or v_texto !~ '^#[0-9a-f]{6}$' then perform interno.erro('invalido:cor'); end if;
  if v_fonte not in ('archivo', 'garamond', 'sistema', 'mono') then perform interno.erro('invalido:fonte'); end if;
  if v_assinatura ~* '(https?://|www\.)' then perform interno.erro('invalido:assinatura'); end if;
  if interno.rede_p4_cc_contraste(v_texto, v_fundo) < 4.5 then perform interno.erro('invalido:contraste'); end if;
  insert into rede_p4_cc_org_identidade (org, fundo, destaque, texto, fonte, assinatura) values (v_org, v_fundo, v_destaque, v_texto, v_fonte, v_assinatura)
  on conflict (org) do update set fundo = excluded.fundo, destaque = excluded.destaque, texto = excluded.texto, fonte = excluded.fonte,
    assinatura = excluded.assinatura, mudou_em = now();
  return interno.rede_p4_cc_identidade_json(v_org);
end $$;

-- ── 5. Zine (item 37) ──────────────────────────────────────────────────────────────────────────────────────────────────────

/**
 * Um post pode entrar na zine de quem pede? Os de outras pessoas, só se podem sair da Alumia (interno.alumia_alc_sai, a regra do RSS
 * e do cartão, que já recusa tudo com a trava da entrada ligada) e se ela os vê (interno.rede_ve). Os dela mesma, só os de público
 * aberto (internet ou membros), fora de comunidade fechada, sem cifra, não retidos, não ocultos, não apagados e que não são resposta:
 * post restrito não sai, nem o dela (a mesma regra do "exportar como imagem", item 120).
 */
create or replace function interno.rede_p4_cc_zine_cabe(p interno.rede_posts, p_quem uuid) returns boolean language sql stable security definer set search_path = interno, pg_temp as $$
  select p.id is not null and p.autor is not null and p_quem is not null and (
    (p.autor = p_quem and p.corpo_grupo is null and not p.retido and not p.oculto and p.apagado_em is null and p.resposta_a is null
      and interno.rede2_publico(p) in ('internet', 'membros')
      and (p.comunidade is null or exists (select 1 from rede_comunidades c where c.slug = p.comunidade and c.tipo = 'aberta' and c.slug not like 'fechado-%')))
    or (interno.alumia_alc_sai(p) and coalesce(interno.rede_ve(p, p_quem), false)))
$$;

/**
 * Os posts para a zine, na ordem pedida (até 12, sem repetir): só os que cabem (interno.rede_p4_cc_zine_cabe). Os outros não vêm, e
 * "fora" diz quantos dos pedidos ficaram de fora (um número dos posts que ela mesma pediu, não de pessoas). Sem foto e sem lugar de
 * ato (interno.alumia_alc_item). Nada é gravado: a folha é montada e impressa no aparelho.
 */
create or replace function public.rede_p4_cc_zine_posts(p_ids uuid[]) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid; v_ids uuid[]; v_itens jsonb;
begin
  perform interno.alumia_porta();
  v := interno.eu();
  perform interno.rede_p4_cc_exige();
  select coalesce(array_agg(id order by primeira), '{}') into v_ids
    from (select id, min(ordem) primeira from unnest(coalesce(p_ids, '{}'::uuid[])) with ordinality as x (id, ordem) where id is not null group by id) u;
  if cardinality(v_ids) = 0 then return jsonb_build_object('itens', '[]'::jsonb, 'fora', 0); end if;
  if cardinality(v_ids) > 12 then perform interno.erro('invalido:muitos'); end if;
  perform interno.limite('rede2_ler', 600, 60);
  select coalesce(jsonb_agg(interno.alumia_alc_item(p) || jsonb_build_object('meu', p.autor = v) order by x.ordem), '[]'::jsonb) into v_itens
  from unnest(v_ids) with ordinality as x (id, ordem)
  join rede_posts p on p.id = x.id
  where interno.rede_p4_cc_zine_cabe(p, v);
  return jsonb_build_object('itens', v_itens, 'fora', cardinality(v_ids) - jsonb_array_length(v_itens));
end $$;

/** Os últimos posts da própria pessoa que cabem na zine (até 30), para escolher: só o começo do texto e a data. */
create or replace function public.rede_p4_cc_zine_meus() returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid;
begin
  perform interno.alumia_porta();
  v := interno.eu();
  perform interno.rede_p4_cc_exige();
  perform interno.limite('rede2_ler', 600, 60);
  return coalesce((select jsonb_agg(jsonb_build_object('id', q.id, 'titulo', q.titulo, 'texto', left(coalesce(q.texto, ''), 140), 'criado_em', q.criado_em) order by q.criado_em desc)
    from (select p.* from rede_posts p where p.autor = v and interno.rede_p4_cc_zine_cabe(p, v) order by p.criado_em desc limit 30) q), '[]'::jsonb);
end $$;

-- ── 6. Permissões ──────────────────────────────────────────────────────────────────────────────────────────────────────────
do $$
declare r record;
begin
  -- As de dentro: ninguém chama pela API.
  for r in
    select p.oid::regprocedure as f from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'interno' and p.proname like 'rede\_p4\_cc\_%'
  loop
    execute format('revoke all on function %s from public', r.f);
    if exists (select 1 from pg_roles where rolname = 'anon') then execute format('revoke all on function %s from anon, authenticated', r.f); end if;
  end loop;
  -- As da tela: só conta logada (a porta da entrada vem na primeira linha de cada uma).
  for r in
    select p.oid::regprocedure as f from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname like 'rede\_p4\_cc\_%'
  loop
    execute format('revoke all on function %s from public', r.f);
    if exists (select 1 from pg_roles where rolname = 'anon') then
      execute format('revoke all on function %s from anon', r.f);
      execute format('grant execute on function %s to authenticated, service_role', r.f);
    end if;
  end loop;
end $$;

select interno.alumia_trancar();
