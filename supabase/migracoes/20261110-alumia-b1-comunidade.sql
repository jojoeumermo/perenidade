-- Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
--
-- ═══════════════════════════ Alumia · B1 · comunidade: o back-end que faltava na F3 (10/11/2026) ═══════════════════════════
-- docs/plano-2026-11/ALUMIA-ATE-O-FIM.md (B1), PLANO-ALUMIA.md §6, §7, §8 (F3) e §12, ALUMIA-FUNCOES-E-IDEIAS.md (Onda B, F3).
--   1. Reações: o total não conta quem a pessoa bloqueou, quem a bloqueou, nem conta suspensa (senão reagir e tirar a reação
--      mostra o bloqueado mexendo no número, que é a diferença entre "poucas" e 3).
--   2. Página da comunidade: área aberta → comunidade e situação → limite → página → posts da semana (só para quem vê a
--      comunidade). Antes, o limite era gasto até por quem pedia comunidade fechada ou que não existe, e o tipo de erro sondava slug.
--   3. Avisos dos tipos novos: conversa_seguida, ajudou, ato, reacao_story e lembrete, cada um com preferência no site e no
--      celular. A conversa seguida deixa de avisar quando a raiz fica oculta, retida ou apagada.
--   4. Notas de contexto (notas da comunidade).  5. Wiki da comunidade com histórico.  6. Busca com operadores e busca salva.
--   7. A linha dos #temas seguidos.  8. Salvos em pastas.  9. "Pergunte a…".  10. Posts recorrentes.  11. Citar trecho com
--   âncora.  12. Lembrar mais tarde.  13. Conversas que sigo (ver e deixar de seguir).
--
-- Regras (PLANO-ALUMIA §5): tabelas novas em interno com RLS e nenhuma permissão para anon/authenticated; acesso só pelas funções
-- security definer abaixo (search_path = interno, pg_temp), que conferem quem chama, bloqueio, visibilidade (interno.rede_ve) e
-- limite de uso (interno.rede2_limite / interno.limite). Nenhuma função devolve lista de pessoas; total só a partir de 3.
--
-- Leis (conferidas no texto, leis-do-brasil): LGPD (Lei 13.709/2018) art. 5º, II e art. 11 — opinião política e filiação são dado
-- sensível: quem avaliou uma nota, quem editou a wiki (fora da mediação), quem perguntou (se não quis aparecer), quem salvou e o
-- que alguém segue nunca saem daqui; art. 6º, III (necessidade): cada tabela guarda o mínimo e some com a conta ou com o post
-- (cascata); art. 18, VI: deixar de seguir, apagar pasta, tirar lembrete e retirar pergunta apagam a linha; art. 46: RLS e nenhuma
-- permissão direta. ECA (Lei 8.069/1990) e ECA Digital (Lei 15.211/2025): a Alumia segue só para 18+ confirmado
-- (interno.rede2_membro); só membro escreve, avalia, pergunta ou salva.
--
-- Idempotente (scripts/testar-alumia-b1-comunidade.mjs roda duas vezes no banco local). Roda depois de tudo o que já está no
-- install.sql (F0..F5, Fediverso e as de 10/11). NÃO rodar em produção sem o Jonathan.

-- ══════════════════════════════════════════ 1. Reações: o total sem bloqueio nem suspensa ══════════════════════════════════════════

/**
 * As reações de um post como a tela mostra: [{emoji, total, minha}] na ordem da lista. O total NÃO conta: quem p_quem bloqueou,
 * quem bloqueou p_quem (interno.rede_bloqueado vale nos dois sentidos) e contas suspensas. A reação da própria pessoa sempre conta
 * para ela. total nulo abaixo de 3. Nunca quem reagiu. Quem chama já conferiu que p_quem vê o post.
 */
create or replace function interno.rede_alumia_reacoes_de(p_post uuid, p_quem uuid) returns jsonb language sql stable security definer set search_path = interno, pg_temp as $$
  select coalesce(jsonb_agg(jsonb_build_object('emoji', z.emoji, 'total', interno.rede_alumia_agregado(z.n), 'minha', z.minha)
                            order by array_position(interno.rede_alumia_emojis(), z.emoji)), '[]'::jsonb)
  from (
    select r.emoji, count(*)::integer as n, bool_or(p_quem is not null and r.usuario = p_quem) as minha
    from rede_reacoes_emoji r join perfis f on f.id = r.usuario
    where r.post = p_post
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

-- ══════════════════════════════════════════ 2. A página da comunidade, na ordem certa ══════════════════════════════════════════

/**
 * Pode ver esta comunidade? Devolve a linha dela ou recusa, SEM gastar limite: visitante recebe sempre 'entre_primeiro' para o que
 * não for disciplina visível (assim não dá para saber, de fora, se um slug de luta existe); quem entrou recebe 'nao_encontrado'
 * para slug que não existe e para comunidade fechada de que não é (os dois iguais); conta suspensa, 'conta_suspensa'.
 */
create or replace function interno.rede_alumia_com_ver(p_slug text, p_quem uuid) returns interno.rede_comunidades language plpgsql stable security definer set search_path = interno, pg_temp as $$
declare c rede_comunidades;
begin
  if p_quem is not null and exists (select 1 from perfis f where f.id = p_quem and f.suspenso) then perform interno.erro('conta_suspensa'); end if;
  c := interno.rede3_com_achar(p_slug);
  if p_quem is null then
    if c.slug is null or c.categoria <> 'disciplinas' or c.tipo = 'fechada' then perform interno.erro('entre_primeiro'); end if;
  elsif c.slug is null or (c.tipo = 'fechada' and not interno.rede2_na_comunidade(c.slug, p_quem)) then
    perform interno.erro('nao_encontrado');
  end if;
  return c;
end $$;

/**
 * A página da comunidade na tela nova. A ordem: área aberta → achar e conferir (fechada, visitante, suspensa) → limite → página
 * → posts da semana. Quem foi banido vê a página (com o aviso de banido, como hoje), mas não a contagem da semana.
 */
create or replace function public.rede_alumia_com_pagina(p_slug text) returns jsonb language plpgsql volatile security definer set search_path = interno, pg_temp as $$
declare v uuid := auth.uid(); c rede_comunidades; v_base jsonb;
begin
  perform interno.aberta('comunidade');
  c := interno.rede_alumia_com_ver(p_slug, v);
  perform interno.limite('rede2_ler', 600, 60);
  v_base := public.rede_com_pagina(c.slug);
  return v_base || jsonb_build_object('posts_7d', case when interno.rede3_com_situacao(c.slug, v) = 'banido' then null
                                                       else interno.rede_alumia_agregado(interno.rede_alumia_posts_7d(c.slug)) end);
end $$;

revoke all on function interno.rede_alumia_com_ver(text, uuid) from public;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on function interno.rede_alumia_com_ver(text, uuid) from anon, authenticated;
    revoke all on function public.rede_alumia_com_pagina(text) from public, anon, authenticated;
    grant execute on function public.rede_alumia_com_pagina(text) to anon, authenticated, service_role;
  end if;
end $$;

-- ══════════════════════════════════════════ 3. Avisos dos tipos novos ══════════════════════════════════════════

-- Os tipos: os que já existem (inclusive os da federação e os que outra frente acrescentar) + os novos. A regra é refeita a partir
-- da que está no banco, para não apagar tipo de ninguém.
do $$
declare v_def text; v_tipos text[]; v_novos text[] := array['conversa_seguida', 'ajudou', 'ato', 'reacao_story', 'lembrete'];
begin
  select pg_get_constraintdef(oid) into v_def from pg_constraint where conrelid = 'interno.avisos'::regclass and conname = 'avisos_tipo';
  select coalesce(array_agg(distinct m[1]), '{}') into v_tipos from regexp_matches(coalesce(v_def, ''), '''([a-z_]+)''', 'g') m;
  if v_tipos @> v_novos then return; end if;
  v_tipos := array(select distinct unnest(v_tipos || v_novos || array['resposta', 'mencao', 'citacao', 'seguidor', 'chamado', 'nucleo', 'moderacao', 'apoio']) order by 1);
  alter table interno.avisos drop constraint if exists avisos_tipo;
  execute format('alter table interno.avisos add constraint avisos_tipo check (tipo is null or tipo = any (%L::text[]))', v_tipos);
end $$;

do $$
declare r record; v_tipos text[] := '{}'; v_novos text[] := array['conversa_seguida', 'ajudou', 'ato', 'reacao_story', 'lembrete'];
begin
  for r in select conname, pg_get_constraintdef(oid) as def from pg_constraint
           where conrelid = 'interno.rede_avisos_prefs'::regclass and contype = 'c' and pg_get_constraintdef(oid) ~* '[^_]tipo' loop
    v_tipos := v_tipos || array(select m[1] from regexp_matches(r.def, '''([a-z_]+)''', 'g') m);
    if v_tipos @> v_novos then return; end if;
    execute format('alter table interno.rede_avisos_prefs drop constraint %I', r.conname);
  end loop;
  v_tipos := array(select distinct unnest(v_tipos || v_novos || array['resposta', 'mencao', 'citacao', 'seguidor', 'chamado', 'nucleo', 'moderacao', 'apoio', 'resumo']) order by 1);
  execute format('alter table interno.rede_avisos_prefs add constraint rede_avisos_prefs_tipo_b1 check (tipo = any (%L::text[]))', v_tipos);
end $$;

/** Os tipos que a pessoa liga e desliga na tela (a mesma lista de lib/rede/tipos-avisos.ts, TIPOS_DE_AVISO, na mesma ordem). */
create or replace function interno.rede_alumia_tipos_de_aviso() returns text[] language sql immutable as $$
  select array['resposta', 'mencao', 'citacao', 'seguidor', 'chamado', 'nucleo', 'moderacao', 'apoio',
               'conversa_seguida', 'ajudou', 'ato', 'reacao_story', 'lembrete']::text[]
$$;

/** A chave que agrupa: as de antes (com as da federação) + a conversa seguida, que junta as respostas novas da mesma conversa. */
create or replace function interno.rede3_aviso_chave(p_tipo text, p_post uuid, p_id uuid) returns text language sql immutable as $$
  select case when p_tipo in ('resposta', 'mencao', 'citacao', 'apoio', 'fed_resposta', 'fed_curtida', 'fed_impulso', 'conversa_seguida') and p_post is not null then p_tipo || ':' || p_post::text
              when p_tipo in ('seguidor', 'fed_seguidor') then p_tipo
              else 'n:' || p_id::text end
$$;

/** A porta para criar um aviso da Alumia, agora com os tipos novos (as mesmas conferências: si mesmo, bloqueio, suspensa). */
create or replace function interno.rede3_aviso_criar(p_para uuid, p_tipo text, p_post uuid, p_alvo uuid, p_ator uuid, p_texto text default null) returns void language plpgsql security definer set search_path = interno, pg_temp as $$
begin
  if p_para is null or not (p_tipo = any (interno.rede_alumia_tipos_de_aviso())) then return; end if;
  if p_ator is not null and (p_ator = p_para or interno.rede_bloqueado(p_ator, p_para)) then return; end if;
  if not exists (select 1 from perfis where id = p_para and not suspenso) then return; end if;
  insert into avisos (para, texto, categoria, tipo, post, alvo, ator)
  values (p_para,
    left(coalesce(nullif(btrim(p_texto), ''), case p_tipo
      when 'resposta' then 'Alguém respondeu ao seu post na Alumia.' when 'mencao' then 'Alguém mencionou você na Alumia.'
      when 'citacao' then 'Alguém citou o seu post na Alumia.' when 'seguidor' then 'Alguém começou a seguir você na Alumia.'
      when 'apoio' then 'Alguém apoiou o seu post na Alumia.' when 'chamado' then 'Um chamado da Alumia mudou.'
      when 'nucleo' then 'Há novidade no seu núcleo da Alumia.' when 'conversa_seguida' then 'Há respostas novas numa conversa que você segue na Alumia.'
      when 'ajudou' then 'Sua resposta ajudou quem abriu a conversa na Alumia.' when 'ato' then 'Um ato que você acompanha mudou.'
      when 'reacao_story' then 'Alguém reagiu ao seu story.' when 'lembrete' then 'Você pediu para lembrar de um post agora.'
      else 'Há uma atualização da moderação da Alumia.' end), 500),
    'rede', p_tipo, p_post, p_alvo, p_ator)
  on conflict do nothing;
end $$;

/**
 * Antes de gravar um aviso (o gatilho de sempre, com os tipos novos): (1) a resposta da fundação ganha estrutura, como antes;
 * (2) os avisos de ato (que as frentes de atos gravam como 'chamado') viram 'ato'; a reação a story (sem tipo) vira 'reacao_story';
 * (3) quem desligou o tipo no site não recebe (a moderação nunca é desligada).
 */
create or replace function interno.rede3_aviso_antes() returns trigger language plpgsql security definer set search_path = interno, pg_temp as $$
declare m text[]; r record;
begin
  if new.categoria = 'rede' and new.tipo is null and new.post is null then
    m := regexp_match(new.texto, '^(.+) respondeu ao seu post na (?:Rede L[úu]cia|Alumia): “(.*)”$');
    if m is not null then
      select p.id, p.resposta_a, p.autor into r from rede_posts p join rede_posts pai on pai.id = p.resposta_a
       where pai.autor = new.para and p.autor is not null and interno.rede_nome(p.autor) = m[1] and left(p.texto, 120) = m[2]
       order by p.criado_em desc limit 1;
      if found then new.tipo := 'resposta'; new.post := r.resposta_a; new.alvo := r.id; new.ator := r.autor; end if;
    end if;
  end if;
  if new.categoria = 'rede' and new.tipo = 'chamado' and new.texto ~ '^(Um ato que você|O farol de um ato|A corrente de um ato)' then
    new.tipo := 'ato';
  end if;
  if new.categoria = 'rede' and new.tipo is null and new.texto ~ '^Alguém reagiu ao seu story' then
    new.tipo := 'reacao_story';
  end if;
  if new.tipo is not null and new.tipo <> 'moderacao' and not interno.rede3_aviso_pref(new.para, new.tipo, 'site') then return null; end if;
  return new;
end $$;
drop trigger if exists rede3_aviso_antes on interno.avisos;
create trigger rede3_aviso_antes before insert on interno.avisos for each row execute function interno.rede3_aviso_antes();

-- rede_aviso_listar: o texto de reserva também sai nos tipos novos sem trecho de post (ato, reação a story, lembrete). Remendo no
-- lugar, como o do Fediverso, para não reescrever o que as outras frentes já remendaram.
do $$
declare
  v_def text;
  v_marca text := 'when n.tipo is null or n.tipo in (''chamado'', ''nucleo'', ''moderacao'') then n.texto end';
begin
  v_def := pg_get_functiondef('public.rede_aviso_listar(text, integer)'::regprocedure);
  if position('''reacao_story''' in v_def) > 0 then return; end if;
  if position(v_marca in v_def) = 0 then
    raise exception 'public.rede_aviso_listar mudou: o remendo da B1 comunidade (20261110-alumia-b1-comunidade.sql) precisa ser revisto';
  end if;
  v_def := replace(v_def, v_marca, 'when n.tipo is null or n.tipo in (''chamado'', ''nucleo'', ''moderacao'', ''ato'', ''reacao_story'', ''lembrete'') then n.texto end');
  execute v_def;
end $$;

-- O resumo semanal conta os tipos novos pelo nome (e não como "avisos da conta").
do $$
declare
  v_def text;
  v_marca text := 'when ''moderacao'' then case when r.n = 1 then ''aviso da moderação'' else ''avisos da moderação'' end';
begin
  v_def := pg_get_functiondef('interno.rede3_aviso_resumo(uuid)'::regprocedure);
  if position('conversa_seguida' in v_def) > 0 or position(v_marca in v_def) = 0 then return; end if;
  v_def := replace(v_def, v_marca, v_marca || '
      when ''conversa_seguida'' then case when r.n = 1 then ''resposta numa conversa que você segue'' else ''respostas em conversas que você segue'' end
      when ''ajudou'' then case when r.n = 1 then ''resposta sua que ajudou'' else ''respostas suas que ajudaram'' end
      when ''ato'' then case when r.n = 1 then ''novidade em ato'' else ''novidades em atos'' end
      when ''reacao_story'' then case when r.n = 1 then ''reação a story'' else ''reações a stories'' end
      when ''lembrete'' then case when r.n = 1 then ''lembrete'' else ''lembretes'' end');
  execute v_def;
end $$;

/** As preferências, com os tipos novos: no site tudo ligado; celular e resumo desligados até a pessoa ligar. */
create or replace function public.rede_aviso_prefs_ver() returns jsonb language plpgsql stable security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu();
begin
  return jsonb_build_object(
    'site', (select jsonb_object_agg(t, interno.rede3_aviso_pref(v, t, 'site')) from unnest(interno.rede_alumia_tipos_de_aviso()) t),
    'push', (select jsonb_object_agg(t, interno.rede3_aviso_pref(v, t, 'push')) from unnest(interno.rede_alumia_tipos_de_aviso()) t),
    'resumo', interno.rede3_aviso_pref(v, 'resumo', 'email'),
    'push_aparelhos', (select count(*)::integer from rede_push_assinaturas where usuario = v),
    'membro', interno.rede2_membro(v));
end $$;

/** Liga ou desliga um tipo num canal (os tipos novos inclusive). As mesmas regras de antes. */
create or replace function public.rede_aviso_prefs_salvar(p_tipo text, p_canal text, p_ligado boolean) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu();
begin
  perform interno.aberta('comunidade');
  perform interno.limite('rede_avisos_prefs', 120, 60);
  if p_tipo is null or not (p_tipo = any (interno.rede_alumia_tipos_de_aviso() || 'resumo'::text)) then perform interno.erro('invalido:tipo'); end if;
  if p_canal is null or p_canal not in ('site', 'push', 'email') or (p_canal = 'email') <> (p_tipo = 'resumo') then perform interno.erro('invalido:canal'); end if;
  if p_tipo = 'moderacao' and p_canal = 'site' and not coalesce(p_ligado, false) then perform interno.erro('invalido:tipo'); end if;
  if p_canal in ('push', 'email') and coalesce(p_ligado, false) and not interno.rede2_membro(v) then perform interno.erro('consentimento'); end if;
  insert into rede_avisos_prefs (usuario, tipo, canal, ligado) values (v, p_tipo, p_canal, coalesce(p_ligado, false))
  on conflict (usuario, tipo, canal) do update set ligado = excluded.ligado;
  return public.rede_aviso_prefs_ver();
end $$;

/**
 * Resposta nova numa conversa seguida: aviso do tipo 'conversa_seguida' (desliga sem desligar as respostas a si mesma), agrupado
 * pela conversa. Não avisa quando a raiz ficou oculta, retida ou apagada depois de seguida, nem quem não vê mais a raiz ou a
 * resposta, nem quem foi banido da comunidade. Até 500 por resposta.
 */
create or replace function interno.rede_alumia_aviso_seguidores() returns trigger language plpgsql security definer set search_path = interno, pg_temp as $$
declare v_raiz rede_posts; v_pai uuid; s record;
begin
  if new.resposta_a is null or new.oculto or new.retido or new.apagado_em is not null then return null; end if;
  if not exists (select 1 from rede_alumia_seguir_conversa where raiz = coalesce(new.root_id, new.id)) then return null; end if;
  select * into v_raiz from rede_posts where id = coalesce(new.root_id, new.id);
  if not found or v_raiz.oculto or v_raiz.retido or v_raiz.apagado_em is not null then return null; end if;
  select autor into v_pai from rede_posts where id = new.resposta_a;
  for s in
    select usuario from rede_alumia_seguir_conversa
     where raiz = v_raiz.id and usuario is distinct from new.autor and usuario is distinct from v_pai
     order by criado_em limit 500
  loop
    if interno.rede_ve(new, s.usuario) and interno.rede_ve(v_raiz, s.usuario)
       and (v_raiz.comunidade is null or interno.rede3_com_situacao(v_raiz.comunidade, s.usuario) is distinct from 'banido') then
      perform interno.rede3_aviso_criar(s.usuario, 'conversa_seguida', v_raiz.id, new.id, new.autor, 'Há respostas novas numa conversa que você segue na Alumia.');
    end if;
  end loop;
  return null;
end $$;
drop trigger if exists rede_alumia_aviso_seguidores on interno.rede_posts;
create trigger rede_alumia_aviso_seguidores after insert on interno.rede_posts for each row execute function interno.rede_alumia_aviso_seguidores();

/**
 * "ajudou a autora" com o aviso do tipo novo 'ajudou' (agrupável e que se desliga), apontando para a conversa e a resposta, sem
 * dizer quem marcou (só quem abriu a conversa marca; o aviso não precisa do nome). O resto como na F3.
 */
create or replace function public.rede_alumia_ajudou(p_resposta uuid, p_sim boolean default true) returns jsonb language plpgsql volatile security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); r rede_posts; v_raiz rede_posts; v_antes uuid;
begin
  perform interno.aberta('comunidade');
  if not interno.rede2_membro(v) then perform interno.erro('consentimento'); end if;
  select * into r from rede_posts where id = p_resposta;
  if not found or r.resposta_a is null or not interno.rede_ve(r, v) or r.oculto or r.retido or r.apagado_em is not null then perform interno.erro('nao_encontrado'); end if;
  v_raiz := interno.rede3_conv_raiz(r);
  if v_raiz.id is null or not interno.rede_ve(v_raiz, v) then perform interno.erro('nao_encontrado'); end if;
  if v_raiz.autor is distinct from v then perform interno.erro('sem_permissao'); end if;
  if r.autor = v then perform interno.erro('invalido:propria'); end if;
  perform interno.rede2_limite('reagir');
  select resposta into v_antes from rede_ajudou where rede_ajudou.raiz = v_raiz.id;
  if coalesce(p_sim, true) then
    insert into rede_ajudou (raiz, resposta) values (v_raiz.id, r.id)
    on conflict (raiz) do update set resposta = excluded.resposta, marcado_em = now();
    if v_raiz.tipo = 'duvida' then update rede_posts set aceita = r.id where id = v_raiz.id; end if;
    if v_antes is distinct from r.id and r.autor is not null and not interno.rede_bloqueado(v, r.autor) then
      perform interno.rede3_aviso_criar(r.autor, 'ajudou', v_raiz.id, r.id, null, 'Sua resposta ajudou quem abriu a conversa na Alumia.');
    end if;
    return jsonb_build_object('ajudou', r.id);
  end if;
  delete from rede_ajudou where rede_ajudou.raiz = v_raiz.id and resposta = r.id;
  if v_raiz.tipo = 'duvida' and v_raiz.aceita = r.id then update rede_posts set aceita = null where id = v_raiz.id; end if;
  return jsonb_build_object('ajudou', coalesce((select resposta from rede_ajudou where rede_ajudou.raiz = v_raiz.id),
    (select aceita from rede_posts where id = v_raiz.id and tipo = 'duvida')));
end $$;

revoke all on function interno.rede_alumia_tipos_de_aviso(), interno.rede_alumia_aviso_seguidores() from public;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on function interno.rede_alumia_tipos_de_aviso(), interno.rede_alumia_aviso_seguidores() from anon, authenticated;
  end if;
end $$;

-- ══════════════════════════════════════════ 4. Notas de contexto (notas da comunidade) ══════════════════════════════════════════
-- A regra, igual à da tela (i18n/rede/conversa/*.json, notas.regra): quem tem nível 2 ou mais propõe, com fonte; quem tem nível 1
-- ou mais avalia "ajuda" ou "não ajuda"; a nota aparece quando pelo menos 3 disseram "ajuda", "ajuda" é pelo menos 2/3 dos votos e,
-- entre quem disse "ajuda", há duas pessoas que costumam discordar (nas outras notas que as duas avaliaram, pelo menos 2,
-- discordaram em mais da metade). Quem propôs e quem avaliou nunca aparecem; nenhum aviso vai para quem interagiu com o post.

create table if not exists interno.rede_alumia_notas (
  id uuid primary key default gen_random_uuid(),
  post uuid not null references interno.rede_posts (id) on delete cascade,
  autora uuid not null references interno.perfis (id) on delete cascade,
  texto text not null check (char_length(texto) between 20 and 500),
  fonte text not null check (char_length(fonte) between 10 and 500 and fonte ~* '^https?://[^/@\s]+(/\S*)?$'),
  situacao text not null default 'proposta' check (situacao in ('proposta', 'mostrada', 'oculta')),
  criado_em timestamptz not null default now(),
  mudou_em timestamptz not null default now(),
  unique (post, autora)
);
create index if not exists rede_alumia_notas_post on interno.rede_alumia_notas (post, situacao);
create table if not exists interno.rede_alumia_nota_votos (
  nota uuid not null references interno.rede_alumia_notas (id) on delete cascade,
  usuario uuid not null references interno.perfis (id) on delete cascade,
  ajuda boolean not null,
  criado_em timestamptz not null default now(),
  primary key (nota, usuario)
);
create index if not exists rede_alumia_nota_votos_usuario on interno.rede_alumia_nota_votos (usuario, nota);
alter table interno.rede_alumia_notas enable row level security;
alter table interno.rede_alumia_nota_votos enable row level security;

/** Duas pessoas "costumam discordar": nas outras notas que as duas avaliaram (pelo menos 2), discordaram em mais da metade. */
create or replace function interno.rede_alumia_discordam(p_a uuid, p_b uuid, p_fora uuid) returns boolean language sql stable security definer set search_path = interno, pg_temp as $$
  select count(*) >= 2 and count(*) filter (where a.ajuda <> b.ajuda) * 2 > count(*)
  from rede_alumia_nota_votos a join rede_alumia_nota_votos b on b.nota = a.nota and b.usuario = p_b
  where a.usuario = p_a and a.nota <> p_fora
$$;

/** Recalcula se a nota aparece (a regra do começo da seção). Conta suspensa não vota. A oculta (pela moderação) não muda. */
create or replace function interno.rede_alumia_nota_recalcular(p_nota uuid) returns text language plpgsql security definer set search_path = interno, pg_temp as $$
declare n rede_alumia_notas; v_sim integer; v_nao integer; v_ponte boolean; v_nova text;
begin
  select * into n from rede_alumia_notas where id = p_nota for update;
  if not found then return null; end if;
  if n.situacao = 'oculta' then return 'oculta'; end if;
  select count(*) filter (where v.ajuda), count(*) filter (where not v.ajuda) into v_sim, v_nao
  from rede_alumia_nota_votos v join perfis f on f.id = v.usuario where v.nota = p_nota and not f.suspenso;
  v_ponte := v_sim >= 3 and v_sim * 3 >= (v_sim + v_nao) * 2 and exists (
    select 1
    from (select v.usuario from rede_alumia_nota_votos v join perfis f on f.id = v.usuario
          where v.nota = p_nota and v.ajuda and not f.suspenso order by v.criado_em limit 60) a
    join (select v.usuario from rede_alumia_nota_votos v join perfis f on f.id = v.usuario
          where v.nota = p_nota and v.ajuda and not f.suspenso order by v.criado_em limit 60) b on b.usuario > a.usuario
    where interno.rede_alumia_discordam(a.usuario, b.usuario, p_nota));
  v_nova := case when v_ponte then 'mostrada' else 'proposta' end;
  if v_nova <> n.situacao then update rede_alumia_notas set situacao = v_nova, mudou_em = now() where id = p_nota; end if;
  return v_nova;
end $$;

/** O post de uma nota, se p_quem ainda pode vê-lo (e ele não está oculto, retido nem apagado). */
create or replace function interno.rede_alumia_nota_post(p_post uuid, p_quem uuid) returns interno.rede_posts language plpgsql stable security definer set search_path = interno, pg_temp as $$
declare x rede_posts;
begin
  select * into x from rede_posts where id = p_post;
  if not found or not interno.rede_ve(x, p_quem) or x.oculto or x.retido or x.apagado_em is not null then perform interno.erro('nao_encontrado'); end if;
  return x;
end $$;

/**
 * As notas de um post para quem vê: as que aparecem (texto, fonte, data; nunca quem propôs nem quem avaliou), as propostas que
 * esta pessoa pode avaliar (sem total de votos, para não puxar o voto), a nota dela e o que ela pode fazer. Visitante vê só as que
 * aparecem. A regra vem da tela.
 */
create or replace function public.rede_alumia_notas(p_post uuid) returns jsonb language plpgsql volatile security definer set search_path = interno, pg_temp as $$
declare v uuid := auth.uid(); x rede_posts; v_nivel smallint := 0; v_membro boolean := false; v_mod boolean;
begin
  perform interno.aberta('comunidade');
  if v is not null and exists (select 1 from perfis where id = v and suspenso) then perform interno.erro('conta_suspensa'); end if;
  x := interno.rede_alumia_nota_post(p_post, v);
  perform interno.limite('rede2_ler', 600, 60);
  if v is not null then v_membro := interno.rede2_membro(v); v_nivel := interno.rede3_mod_nivel(v); end if;
  v_mod := v is not null and (interno.cuida() or (x.comunidade is not null and interno.rede3_com_modera(x.comunidade, v)));
  return jsonb_build_object(
    'mostradas', (select coalesce(jsonb_agg(jsonb_build_object('id', n.id, 'texto', n.texto, 'fonte', n.fonte, 'criado_em', n.criado_em) order by n.mudou_em), '[]'::jsonb)
                  from rede_alumia_notas n where n.post = x.id and n.situacao = 'mostrada' and not interno.rede_bloqueado(v, n.autora)),
    'para_avaliar', case when v_membro and v_nivel >= 1 then
                  (select coalesce(jsonb_agg(jsonb_build_object('id', z.id, 'texto', z.texto, 'fonte', z.fonte, 'criado_em', z.criado_em, 'mostrada', z.situacao = 'mostrada',
                            'minha', (select vt.ajuda from rede_alumia_nota_votos vt where vt.nota = z.id and vt.usuario = v)) order by z.criado_em), '[]'::jsonb)
                   from (select n.* from rede_alumia_notas n
                         where n.post = x.id and n.situacao <> 'oculta' and n.autora <> v and not interno.rede_bloqueado(v, n.autora)
                         order by n.criado_em limit 10) z)
                  else '[]'::jsonb end,
    'minha', (select jsonb_build_object('id', n.id, 'texto', n.texto, 'fonte', n.fonte, 'situacao', n.situacao) from rede_alumia_notas n where n.post = x.id and n.autora = v),
    'pode_propor', v_membro and v_nivel >= 2 and x.autor is distinct from v,
    'pode_avaliar', v_membro and v_nivel >= 1,
    'modera', v_mod,
    'ocultas', case when v_mod then (select coalesce(jsonb_agg(jsonb_build_object('id', n.id, 'texto', n.texto, 'fonte', n.fonte, 'situacao', n.situacao) order by n.criado_em), '[]'::jsonb)
                                     from rede_alumia_notas n where n.post = x.id and n.situacao = 'oculta') end);
end $$;

/**
 * Propõe (ou reescreve) a nota da própria pessoa num post: nível 2 ou mais, membro, com fonte http(s), sem dado pessoal, nunca no
 * próprio post. Reescrever zera os votos (a nota é outra). Até 5 por dia. Nenhum aviso sai daqui.
 */
create or replace function public.rede_alumia_nota_propor(p_post uuid, p_texto text, p_fonte text) returns jsonb language plpgsql volatile security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); x rede_posts; v_txt text; v_fonte text := btrim(coalesce(p_fonte, '')); v_id uuid; v_sit text;
begin
  perform interno.aberta('comunidade');
  if not interno.rede2_membro(v) then perform interno.erro('consentimento'); end if;
  x := interno.rede_alumia_nota_post(p_post, v);
  if x.autor = v then perform interno.erro('invalido:propria'); end if;
  if x.comunidade is not null and interno.rede3_com_situacao(x.comunidade, v) = 'banido' then perform interno.erro('sem_permissao'); end if;
  if interno.rede3_mod_nivel(v) < 2 then perform interno.erro('nivel'); end if;
  v_txt := interno.txt(p_texto, 'texto', 20, 500);
  if char_length(v_fonte) < 10 or char_length(v_fonte) > 500 or v_fonte !~* '^https?://[^/@\s]+(/\S*)?$' then perform interno.erro('invalido:fonte'); end if;
  if interno.rede3_pub_dado_pessoal(v_txt) then perform interno.erro('dado_pessoal'); end if;
  perform interno.limite('alumia_nota', 5, 1440);
  select id, situacao into v_id, v_sit from rede_alumia_notas where post = x.id and autora = v;
  if v_id is null then
    insert into rede_alumia_notas (post, autora, texto, fonte) values (x.id, v, v_txt, v_fonte) returning id into v_id;
  else
    if v_sit = 'oculta' then perform interno.erro('sem_permissao'); end if;
    update rede_alumia_notas set texto = v_txt, fonte = v_fonte, situacao = 'proposta', mudou_em = now() where id = v_id;
    delete from rede_alumia_nota_votos where nota = v_id;
  end if;
  return jsonb_build_object('id', v_id, 'situacao', 'proposta');
end $$;

/** Retira a própria nota (apaga a nota e os votos: LGPD art. 18, VI). */
create or replace function public.rede_alumia_nota_retirar(p_nota uuid) returns jsonb language plpgsql volatile security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu();
begin
  perform interno.aberta('comunidade');
  delete from rede_alumia_notas where id = p_nota and autora = v and situacao <> 'oculta';
  if not found then perform interno.erro('nao_encontrado'); end if;
  return jsonb_build_object('retirada', true);
end $$;

/**
 * Avalia uma nota: "ajuda" (true), "não ajuda" (false) ou tira a avaliação (nulo). Nível 1 ou mais, membro, nunca a própria nota.
 * Devolve só a avaliação dela e se a nota aparece (o que qualquer pessoa vê), nunca o total.
 */
create or replace function public.rede_alumia_nota_avaliar(p_nota uuid, p_ajuda boolean) returns jsonb language plpgsql volatile security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); n rede_alumia_notas; v_sit text;
begin
  perform interno.aberta('comunidade');
  if not interno.rede2_membro(v) then perform interno.erro('consentimento'); end if;
  select * into n from rede_alumia_notas where id = p_nota;
  if not found or n.situacao = 'oculta' or interno.rede_bloqueado(v, n.autora) then perform interno.erro('nao_encontrado'); end if;
  perform interno.rede_alumia_nota_post(n.post, v);
  if n.autora = v then perform interno.erro('invalido:propria'); end if;
  if interno.rede3_mod_nivel(v) < 1 then perform interno.erro('nivel'); end if;
  perform interno.rede2_limite('votar');
  if p_ajuda is null then
    delete from rede_alumia_nota_votos where nota = n.id and usuario = v;
  else
    insert into rede_alumia_nota_votos (nota, usuario, ajuda) values (n.id, v, p_ajuda)
    on conflict (nota, usuario) do update set ajuda = excluded.ajuda, criado_em = now();
  end if;
  v_sit := interno.rede_alumia_nota_recalcular(n.id);
  return jsonb_build_object('minha', p_ajuda, 'mostrada', v_sit = 'mostrada');
end $$;

/** A moderação da comunidade (ou a equipe) oculta ou devolve uma nota. Fica no registro, sem dizer a ninguém quem propôs. */
create or replace function public.rede_alumia_nota_ocultar(p_nota uuid, p_sim boolean default true) returns jsonb language plpgsql volatile security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); n rede_alumia_notas; x rede_posts;
begin
  perform interno.aberta('comunidade');
  select * into n from rede_alumia_notas where id = p_nota;
  if not found then perform interno.erro('nao_encontrado'); end if;
  select * into x from rede_posts where id = n.post;
  if not (interno.cuida() or (x.comunidade is not null and interno.rede3_com_modera(x.comunidade, v))) then perform interno.erro('sem_permissao'); end if;
  perform interno.limite('alumia_nota_mod', 120, 60);
  update rede_alumia_notas set situacao = case when coalesce(p_sim, true) then 'oculta' else 'proposta' end, mudou_em = now() where id = n.id;
  if not coalesce(p_sim, true) then perform interno.rede_alumia_nota_recalcular(n.id); end if;
  perform interno.registrar('alumia_nota_' || case when coalesce(p_sim, true) then 'ocultar' else 'devolver' end, n.id::text, jsonb_build_object('post', n.post));
  return jsonb_build_object('situacao', (select situacao from rede_alumia_notas where id = n.id));
end $$;

-- ══════════════════════════════════════════ 5. Wiki da comunidade com histórico ══════════════════════════════════════════
-- Cartilha de direitos, contatos de advogados populares e da defensoria. Quem pode ver a comunidade lê; quem é dela (nível 1 ou
-- mais, não banido) edita; a moderação trava a página e volta versões. Quem editou aparece só para a moderação (LGPD art. 11:
-- editar a cartilha de uma luta é dado de opinião política). CPF nunca entra (dado pessoal de terceiro).

create table if not exists interno.rede_alumia_wiki (
  comunidade text not null references interno.rede_comunidades (slug) on delete cascade on update cascade,
  pagina text not null check (pagina ~ '^[a-z0-9-]{2,60}$'),
  titulo text not null check (char_length(titulo) between 2 and 120),
  corpo text not null check (char_length(corpo) <= 20000),
  versao integer not null default 1,
  travada boolean not null default false,
  editado_em timestamptz not null default now(),
  primary key (comunidade, pagina)
);
create table if not exists interno.rede_alumia_wiki_versoes (
  comunidade text not null,
  pagina text not null,
  versao integer not null,
  titulo text not null,
  corpo text not null,
  resumo text not null default '' check (char_length(resumo) <= 140),
  editou uuid references interno.perfis (id) on delete set null,
  criado_em timestamptz not null default now(),
  primary key (comunidade, pagina, versao),
  foreign key (comunidade, pagina) references interno.rede_alumia_wiki (comunidade, pagina) on delete cascade on update cascade
);
alter table interno.rede_alumia_wiki enable row level security;
alter table interno.rede_alumia_wiki_versoes enable row level security;

/** Pode editar a wiki desta comunidade? A moderação sempre; quem é dela, membro da Alumia, nível 1 ou mais e não banido. */
create or replace function interno.rede_alumia_wiki_edita(p_slug text, p_quem uuid) returns boolean language sql stable security definer set search_path = interno, pg_temp as $$
  select p_quem is not null and interno.rede2_membro(p_quem) and (interno.rede3_com_modera(p_slug, p_quem)
    or (interno.rede3_com_situacao(p_slug, p_quem) = 'membro' and interno.rede3_mod_nivel(p_quem) >= 1))
$$;

/** Slug de página a partir do título ("Cartilha de direitos" → cartilha-de-direitos). */
create or replace function interno.rede_alumia_wiki_slug(p text) returns text language sql immutable as $$
  select left(btrim(regexp_replace(interno.rede3_desc_sa(coalesce(p, '')), '[^a-z0-9]+', '-', 'g'), '-'), 60)
$$;

/**
 * A wiki de uma comunidade: as páginas (título, versão, data), a página pedida (ou a primeira) com o texto, e o que a pessoa pode
 * fazer. Quem pode ver a comunidade lê (rede_alumia_com_ver: a mesma recusa da página, sem gastar limite antes).
 */
create or replace function public.rede_alumia_wiki(p_slug text, p_pagina text default null) returns jsonb language plpgsql volatile security definer set search_path = interno, pg_temp as $$
declare v uuid := auth.uid(); c rede_comunidades; w rede_alumia_wiki;
begin
  perform interno.aberta('comunidade');
  c := interno.rede_alumia_com_ver(p_slug, v);
  perform interno.limite('rede2_ler', 600, 60);
  if nullif(p_pagina, '') is not null then
    select * into w from rede_alumia_wiki where comunidade = c.slug and pagina = p_pagina;
    if not found then perform interno.erro('nao_encontrado'); end if;
  else
    select * into w from rede_alumia_wiki where comunidade = c.slug order by (pagina = 'inicio') desc, titulo limit 1;
  end if;
  return jsonb_build_object(
    'comunidade', jsonb_build_object('slug', c.slug, 'nome', c.nome, 'cor', c.cor),
    'paginas', (select coalesce(jsonb_agg(jsonb_build_object('pagina', x.pagina, 'titulo', x.titulo, 'versao', x.versao, 'editado_em', x.editado_em, 'travada', x.travada)
                  order by (x.pagina = 'inicio') desc, x.titulo), '[]'::jsonb) from rede_alumia_wiki x where x.comunidade = c.slug),
    'pagina', case when w.pagina is not null then jsonb_build_object('pagina', w.pagina, 'titulo', w.titulo, 'corpo', w.corpo, 'versao', w.versao,
                'editado_em', w.editado_em, 'travada', w.travada) end,
    'pode_editar', interno.rede_alumia_wiki_edita(c.slug, v) and (w.pagina is null or not w.travada or interno.rede3_com_modera(c.slug, v)),
    'pode_criar', interno.rede_alumia_wiki_edita(c.slug, v),
    'modera', v is not null and interno.rede3_com_modera(c.slug, v));
end $$;

/**
 * Cria ou edita uma página. p_base é a versão que a pessoa abriu (nula ao criar): se outra pessoa salvou no meio, 'conflito' (a
 * tela mostra a versão nova e não perde o texto). Até 50 páginas por comunidade, 200 versões por página (as mais velhas saem),
 * 30 edições por hora.
 */
create or replace function public.rede_alumia_wiki_salvar(p_slug text, p_pagina text, p_titulo text, p_corpo text, p_resumo text default '', p_base integer default null) returns jsonb
language plpgsql volatile security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); c rede_comunidades; w rede_alumia_wiki; v_tit text; v_corpo text; v_res text; v_pag text; v_ver integer;
begin
  perform interno.aberta('comunidade');
  c := interno.rede_alumia_com_ver(p_slug, v);
  if not interno.rede_alumia_wiki_edita(c.slug, v) then perform interno.erro('sem_permissao'); end if;
  v_tit := interno.txt(p_titulo, 'titulo', 2, 120);
  v_corpo := interno.txt(p_corpo, 'corpo', 1, 20000);
  v_res := interno.txt(coalesce(p_resumo, ''), 'resumo', 0, 140);
  if v_corpo ~ '\d{3}\.\d{3}\.\d{3}-\d{2}' or v_tit ~ '\d{3}\.\d{3}\.\d{3}-\d{2}' then perform interno.erro('dado_pessoal'); end if;
  perform interno.limite('alumia_wiki', 30, 60);
  v_pag := coalesce(nullif(p_pagina, ''), interno.rede_alumia_wiki_slug(v_tit));
  if v_pag !~ '^[a-z0-9-]{2,60}$' then perform interno.erro('invalido:pagina'); end if;
  select * into w from rede_alumia_wiki where comunidade = c.slug and pagina = v_pag for update;
  if not found then
    if p_base is not null then perform interno.erro('nao_encontrado'); end if;
    if (select count(*) from rede_alumia_wiki where comunidade = c.slug) >= 50 then perform interno.erro('invalido:muitas'); end if;
    insert into rede_alumia_wiki (comunidade, pagina, titulo, corpo) values (c.slug, v_pag, v_tit, v_corpo);
    v_ver := 1;
  else
    if p_base is null or p_base <> w.versao then perform interno.erro('conflito'); end if;
    if w.travada and not interno.rede3_com_modera(c.slug, v) then perform interno.erro('travado'); end if;
    if w.titulo = v_tit and w.corpo = v_corpo then return jsonb_build_object('pagina', v_pag, 'versao', w.versao); end if;
    v_ver := w.versao + 1;
    update rede_alumia_wiki set titulo = v_tit, corpo = v_corpo, versao = v_ver, editado_em = now() where comunidade = c.slug and pagina = v_pag;
  end if;
  insert into rede_alumia_wiki_versoes (comunidade, pagina, versao, titulo, corpo, resumo, editou) values (c.slug, v_pag, v_ver, v_tit, v_corpo, v_res, v);
  delete from rede_alumia_wiki_versoes where comunidade = c.slug and pagina = v_pag and versao <= v_ver - 200;
  return jsonb_build_object('pagina', v_pag, 'versao', v_ver);
end $$;

/**
 * O histórico de uma página: versão, data, resumo e tamanho. Quem editou (o codinome) só para a moderação (LGPD art. 11). Com
 * p_versao, o texto daquela versão (para comparar ou voltar).
 */
create or replace function public.rede_alumia_wiki_historico(p_slug text, p_pagina text, p_versao integer default null) returns jsonb
language plpgsql volatile security definer set search_path = interno, pg_temp as $$
declare v uuid := auth.uid(); c rede_comunidades; v_mod boolean; x rede_alumia_wiki_versoes;
begin
  perform interno.aberta('comunidade');
  c := interno.rede_alumia_com_ver(p_slug, v);
  if not exists (select 1 from rede_alumia_wiki where comunidade = c.slug and pagina = p_pagina) then perform interno.erro('nao_encontrado'); end if;
  perform interno.limite('rede2_ler', 600, 60);
  v_mod := v is not null and interno.rede3_com_modera(c.slug, v);
  if p_versao is not null then
    select * into x from rede_alumia_wiki_versoes where comunidade = c.slug and pagina = p_pagina and versao = p_versao;
    if not found then perform interno.erro('nao_encontrado'); end if;
    return jsonb_build_object('versao', x.versao, 'titulo', x.titulo, 'corpo', x.corpo, 'resumo', x.resumo, 'criado_em', x.criado_em,
      'editou', case when v_mod then interno.rede_nome(x.editou) end);
  end if;
  return jsonb_build_object('modera', v_mod, 'versoes', (select coalesce(jsonb_agg(jsonb_build_object('versao', z.versao, 'criado_em', z.criado_em, 'resumo', z.resumo,
      'tamanho', char_length(z.corpo), 'editou', case when v_mod then interno.rede_nome(z.editou) end) order by z.versao desc), '[]'::jsonb)
    from (select * from rede_alumia_wiki_versoes where comunidade = c.slug and pagina = p_pagina order by versao desc limit 100) z));
end $$;

/** A moderação volta uma página para uma versão antiga (vira uma versão nova, o histórico não se perde). */
create or replace function public.rede_alumia_wiki_restaurar(p_slug text, p_pagina text, p_versao integer) returns jsonb language plpgsql volatile security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); c rede_comunidades; x rede_alumia_wiki_versoes; w rede_alumia_wiki;
begin
  perform interno.aberta('comunidade');
  c := interno.rede_alumia_com_ver(p_slug, v);
  if not interno.rede3_com_modera(c.slug, v) then perform interno.erro('sem_permissao'); end if;
  select * into x from rede_alumia_wiki_versoes where comunidade = c.slug and pagina = p_pagina and versao = p_versao;
  if not found then perform interno.erro('nao_encontrado'); end if;
  perform interno.limite('alumia_wiki', 30, 60);
  select * into w from rede_alumia_wiki where comunidade = c.slug and pagina = p_pagina for update;
  update rede_alumia_wiki set titulo = x.titulo, corpo = x.corpo, versao = w.versao + 1, editado_em = now() where comunidade = c.slug and pagina = p_pagina;
  insert into rede_alumia_wiki_versoes (comunidade, pagina, versao, titulo, corpo, resumo, editou)
  values (c.slug, p_pagina, w.versao + 1, x.titulo, x.corpo, left('Volta à versão ' || p_versao, 140), v);
  perform interno.registrar('alumia_wiki_restaurar', c.slug || '/' || p_pagina, jsonb_build_object('versao', p_versao));
  return jsonb_build_object('pagina', p_pagina, 'versao', w.versao + 1);
end $$;

/** A moderação trava (só ela edita) ou destrava a página; ou apaga a página inteira (p_apagar). */
create or replace function public.rede_alumia_wiki_travar(p_slug text, p_pagina text, p_sim boolean default true, p_apagar boolean default false) returns jsonb
language plpgsql volatile security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); c rede_comunidades;
begin
  perform interno.aberta('comunidade');
  c := interno.rede_alumia_com_ver(p_slug, v);
  if not interno.rede3_com_modera(c.slug, v) then perform interno.erro('sem_permissao'); end if;
  if coalesce(p_apagar, false) then
    delete from rede_alumia_wiki where comunidade = c.slug and pagina = p_pagina;
    if not found then perform interno.erro('nao_encontrado'); end if;
    perform interno.registrar('alumia_wiki_apagar', c.slug || '/' || p_pagina, '{}'::jsonb);
    return jsonb_build_object('apagada', true);
  end if;
  update rede_alumia_wiki set travada = coalesce(p_sim, true) where comunidade = c.slug and pagina = p_pagina;
  if not found then perform interno.erro('nao_encontrado'); end if;
  return jsonb_build_object('travada', coalesce(p_sim, true));
end $$;

-- ══════════════════════════════════════════ 6. Conversas que sigo ══════════════════════════════════════════

/**
 * As conversas que a própria pessoa segue, da mais recente para a mais antiga (LGPD art. 18: ver e apagar sem abrir cada uma).
 * Conversa que ela não vê mais, ou que ficou oculta, retida ou apagada, vem como indisponível (sem título), para poder sair dela.
 */
create or replace function public.rede_alumia_conversas_seguidas(p_cursor text default null, p_limite integer default 30) returns jsonb
language plpgsql volatile security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); v_lim integer := least(greatest(coalesce(p_limite, 30), 1), 50); v_t timestamptz; v_id uuid;
  v_itens jsonb := '[]'::jsonb; v_prox text; v_n integer := 0; r record; x rede_posts; v_ok boolean;
begin
  perform interno.aberta('comunidade');
  perform interno.limite('rede2_ler', 600, 60);
  if nullif(p_cursor, '') is not null then
    begin
      v_t := split_part(p_cursor, '|', 1)::timestamptz; v_id := split_part(p_cursor, '|', 2)::uuid;
    exception when others then perform interno.erro('invalido:cursor');
    end;
  end if;
  for r in select s.raiz, s.criado_em from rede_alumia_seguir_conversa s
           where s.usuario = v and (v_t is null or (s.criado_em, s.raiz) < (v_t, v_id))
           order by s.criado_em desc, s.raiz desc limit v_lim + 1 loop
    v_n := v_n + 1;
    if v_n > v_lim then exit; end if;
    select * into x from rede_posts where id = r.raiz;
    v_ok := found and interno.rede_ve(x, v) and not x.oculto and not x.retido and x.apagado_em is null;
    v_itens := v_itens || jsonb_build_array(jsonb_build_object('raiz', r.raiz, 'seguida_em', r.criado_em, 'disponivel', v_ok,
      'titulo', case when v_ok then left(coalesce(nullif(x.titulo, ''), x.texto), 140) end, 'comunidade', case when v_ok then x.comunidade end));
    v_prox := r.criado_em::text || '|' || r.raiz::text;
  end loop;
  return jsonb_build_object('itens', v_itens, 'proximo', case when v_n > v_lim then v_prox end,
    'total', (select count(*)::integer from rede_alumia_seguir_conversa where usuario = v), 'teto', 500);
end $$;

/** Deixa de seguir várias conversas de uma vez (nulo: todas). Funciona mesmo com a conversa indisponível. Devolve {removidas}. */
create or replace function public.rede_alumia_deixar_conversas(p_raizes uuid[] default null) returns jsonb language plpgsql volatile security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); v_n integer;
begin
  perform interno.aberta('comunidade');
  perform interno.limite('rede2_seguir', 100, 60);
  delete from rede_alumia_seguir_conversa where usuario = v and (p_raizes is null or raiz = any (p_raizes));
  get diagnostics v_n = row_count;
  return jsonb_build_object('removidas', v_n);
end $$;

-- ══════════════════════════════════════════ 7. A linha dos #temas seguidos ══════════════════════════════════════════

/** Os #temas que a própria pessoa segue (agora com limite de leitura). Visitante recebe a lista vazia. */
create or replace function public.rede_alumia_tags_seguidas() returns jsonb language plpgsql volatile security definer set search_path = interno, pg_temp as $$
declare v uuid := auth.uid();
begin
  perform interno.aberta('comunidade');
  if v is null then return jsonb_build_object('tags', '[]'::jsonb); end if;
  perform interno.limite('rede2_ler', 600, 60);
  return jsonb_build_object('tags', (select coalesce(jsonb_agg(tag order by tag), '[]'::jsonb) from rede_alumia_seguir_tag where usuario = v));
end $$;

/**
 * A aba de um #tema (p_tag) ou de todos os seguidos (p_tag nulo): posts de primeiro nível dos últimos 60 dias com a hashtag, que a
 * pessoa vê e não silenciou, SEMPRE do mais novo para o mais velho (sem nota escondida). Cursor "criado_em|id". No máximo 100.
 */
create or replace function public.rede_alumia_linha_tags(p_tag text default null, p_cursor text default null, p_limite integer default 20) returns jsonb
language plpgsql volatile security definer set search_path = interno, pg_temp as $$
declare v uuid := auth.uid(); v_tags text[]; v_lim integer := least(greatest(coalesce(p_limite, 20), 1), 50); v_t timestamptz; v_id uuid; v_ids uuid[]; v_tempos timestamptz[]; v_itens jsonb; v_prox text;
begin
  perform interno.aberta('comunidade');
  if v is not null and exists (select 1 from perfis where id = v and suspenso) then perform interno.erro('conta_suspensa'); end if;
  if nullif(btrim(coalesce(p_tag, '')), '') is not null then
    v_tags := array[interno.rede3_desc_tag_norm(p_tag)];
  elsif v is null then
    perform interno.erro('entre_primeiro');
  else
    select coalesce(array_agg(tag), '{}') into v_tags from rede_alumia_seguir_tag where usuario = v;
  end if;
  perform interno.limite('rede2_ler', 600, 60);
  if cardinality(v_tags) = 0 then return jsonb_build_object('itens', '[]'::jsonb, 'proximo', null, 'tags', '[]'::jsonb); end if;
  if nullif(p_cursor, '') is not null then
    begin
      v_t := split_part(p_cursor, '|', 1)::timestamptz; v_id := split_part(p_cursor, '|', 2)::uuid;
    exception when others then perform interno.erro('invalido:cursor');
    end;
  end if;
  select coalesce(array_agg(b.id order by b.criado_em desc, b.id desc), '{}'), coalesce(array_agg(b.criado_em order by b.criado_em desc, b.id desc), '{}') into v_ids, v_tempos
  from (select p.id, p.criado_em from rede_posts p
        where p.resposta_a is null and p.apagado_em is null and p.criado_em > now() - interval '60 days'
          and (v_t is null or (p.criado_em, p.id) < (v_t, v_id))
          and interno.rede3_desc_tags(p.titulo, p.texto, p.corpo) && v_tags
          and interno.rede_ve(p, v) and not interno.rede_silenciado(p, v)
        order by p.criado_em desc, p.id desc limit v_lim + 1) b;
  if cardinality(v_ids) > v_lim then
    v_ids := v_ids[1:v_lim]; v_tempos := v_tempos[1:v_lim];
    v_prox := v_tempos[v_lim]::text || '|' || v_ids[v_lim]::text;
  end if;
  select coalesce(jsonb_agg(interno.rede_post_v2(r, v) order by array_position(v_ids, r.id)), '[]'::jsonb) into v_itens from rede_posts r where r.id = any (v_ids);
  return jsonb_build_object('itens', v_itens, 'proximo', v_prox, 'tags', to_jsonb(v_tags));
end $$;

-- ══════════════════════════════════════════ 8. Busca com operadores e busca salva ══════════════════════════════════════════
-- Operadores: tag:<tema>, c:<comunidade>, de:@<pessoa>, tipo:<post|discussao|duvida|chamado|enquete|aviso>, desde:<AAAA-MM-DD>.
-- "de:" só acha quem apareceria na busca de pessoas (perfil invisível, conta suspensa e bloqueio nos dois sentidos ficam de fora,
-- e a busca volta vazia sem dizer por quê). "desde:" é só data: nenhum lugar, nenhum horário.

/** Separa os operadores do texto livre. Pura. Operador repetido: vale o último. */
create or replace function interno.rede_alumia_busca_ler(p_q text) returns jsonb language plpgsql immutable as $$
declare v_q text := left(coalesce(p_q, ''), 200); m text[]; v jsonb := '{}'::jsonb; v_resto text;
begin
  for m in select regexp_matches(v_q, '(?:^|\s)(tag|c|de|tipo|desde):(\S+)', 'gi') loop
    v := v || jsonb_build_object(lower(m[1]), m[2]);
  end loop;
  v_resto := btrim(regexp_replace(regexp_replace(v_q, '(^|\s)(tag|c|de|tipo|desde):\S+', ' ', 'gi'), '\s+', ' ', 'g'));
  return v || jsonb_build_object('texto', v_resto);
end $$;

/**
 * A busca da tela nova. Sem operador: a busca de sempre (rede_desc_buscar, um limite só). Com operador: os posts que passam em
 * todos (o texto livre também, se houver), em relevância ou do mais novo, no máximo 100. Operador inválido: 'invalido:<nome>'.
 */
create or replace function public.rede_alumia_buscar(p_q text, p_ordem text default 'relevancia', p_cursor text default null, p_limite integer default 20) returns jsonb
language plpgsql volatile security definer set search_path = interno, pg_temp as $$
declare
  v uuid := auth.uid(); o jsonb := interno.rede_alumia_busca_ler(p_q);
  v_texto text := o ->> 'texto'; v_tsq tsquery; v_tag text; v_com text; v_tipo text; v_desde date; v_autor uuid; v_de text;
  v_ordem text := coalesce(nullif(p_ordem, ''), 'relevancia'); v_lim integer := least(greatest(coalesce(p_limite, 20), 1), 50);
  v_n integer := 0; v_cs numeric; v_ct timestamptz; v_ci uuid; v_ids uuid[]; v_notas numeric[]; v_tempos timestamptz[]; v_itens jsonb; v_prox text; v_fim boolean := false;
begin
  if not (o ?| array['tag', 'c', 'de', 'tipo', 'desde']) then
    return public.rede_desc_buscar(p_q, p_ordem, p_cursor, p_limite) || jsonb_build_object('operadores', '{}'::jsonb);
  end if;
  perform interno.aberta('comunidade');
  if v is not null and exists (select 1 from perfis where id = v and suspenso) then perform interno.erro('conta_suspensa'); end if;
  if v_ordem not in ('relevancia', 'novos') then perform interno.erro('invalido:ordem'); end if;
  if o ? 'tag' then v_tag := interno.rede3_desc_tag_norm(o ->> 'tag'); end if;
  if o ? 'c' then
    v_com := lower(o ->> 'c');
    if v_com !~ '^[a-z0-9-]{2,60}$' then perform interno.erro('invalido:c'); end if;
  end if;
  if o ? 'tipo' then
    v_tipo := lower(interno.rede3_desc_sa(o ->> 'tipo'));
    v_tipo := case v_tipo when 'duvidas' then 'duvida' when 'discussoes' then 'discussao' when 'atos' then 'chamado' when 'ato' then 'chamado' when 'enquetes' then 'enquete' else v_tipo end;
    if v_tipo not in ('post', 'discussao', 'duvida', 'chamado', 'enquete', 'aviso') then perform interno.erro('invalido:tipo'); end if;
  end if;
  if o ? 'desde' then
    begin
      v_desde := to_date(o ->> 'desde', 'YYYY-MM-DD');
    exception when others then perform interno.erro('invalido:desde');
    end;
    if o ->> 'desde' !~ '^\d{4}-\d{2}-\d{2}$' or v_desde > current_date or v_desde < date '2020-01-01' then perform interno.erro('invalido:desde'); end if;
  end if;
  if o ? 'de' then
    v_de := lower(regexp_replace(o ->> 'de', '^@', ''));
    if v_de !~ '^[a-z0-9_]{3,20}$' then perform interno.erro('invalido:de'); end if;
    select f.id into v_autor from perfis f
    where f.rede_handle = v_de and f.rede_codinome_ok and f.rede_modo <> 'invisivel' and not f.rede_invisivel and not f.suspenso
      and interno.rede2_membro(f.id) and not interno.rede_bloqueado(v, f.id);
    -- Quem não apareceria na busca de pessoas: nenhum post (o mesmo resultado de quem não existe).
    if v_autor is null then v_autor := '00000000-0000-0000-0000-000000000000'::uuid; end if;
  end if;
  perform interno.rede2_limite('buscar');
  if char_length(v_texto) >= 2 then
    v_tsq := websearch_to_tsquery('portuguese', interno.rede3_desc_sa(v_texto));
    if numnode(v_tsq) = 0 then v_tsq := null; end if;
  end if;
  if v_tsq is null then v_ordem := 'novos'; end if;
  if nullif(p_cursor, '') is not null then
    begin
      v_cs := split_part(p_cursor, '|', 1)::numeric; v_ct := split_part(p_cursor, '|', 2)::timestamptz;
      v_ci := split_part(p_cursor, '|', 3)::uuid; v_n := split_part(p_cursor, '|', 4)::integer;
    exception when others then perform interno.erro('invalido:cursor');
    end;
    if v_n < 0 or v_n > 100 then perform interno.erro('invalido:cursor'); end if;
  end if;
  v_lim := least(v_lim, 100 - v_n);
  if v_lim <= 0 then return jsonb_build_object('itens', '[]'::jsonb, 'proximo', null, 'ordem', v_ordem, 'fim_por_teto', true, 'operadores', o - 'texto', 'pessoas', '[]'::jsonb, 'comunidades', '[]'::jsonb); end if;
  select coalesce(array_agg(b.id order by b.nota desc, b.criado_em desc, b.id desc), '{}'), coalesce(array_agg(b.nota order by b.nota desc, b.criado_em desc, b.id desc), '{}'),
         coalesce(array_agg(b.criado_em order by b.nota desc, b.criado_em desc, b.id desc), '{}') into v_ids, v_notas, v_tempos
  from (select s.* from (
          select p.id, p.criado_em,
            case when v_ordem = 'relevancia' then round(ts_rank_cd(interno.rede3_desc_doc(p.titulo, p.texto, p.corpo), v_tsq)::numeric, 4) else 0::numeric end as nota
          from rede_posts p
          where p.apagado_em is null
            and (v_tsq is null or interno.rede3_desc_doc(p.titulo, p.texto, p.corpo) @@ v_tsq)
            and (v_tag is null or interno.rede3_desc_tags(p.titulo, p.texto, p.corpo) @> array[v_tag])
            and (v_com is null or p.comunidade = v_com)
            and (v_tipo is null or p.tipo = v_tipo)
            and (v_desde is null or p.criado_em >= v_desde::timestamptz)
            and (v_autor is null or p.autor = v_autor)
            and interno.rede_ve(p, v) and not interno.rede_silenciado(p, v)) s
        where v_cs is null or (s.nota, s.criado_em, s.id) < (v_cs, v_ct, v_ci)
        order by s.nota desc, s.criado_em desc, s.id desc limit v_lim + 1) b;
  if cardinality(v_ids) > v_lim then
    v_ids := v_ids[1:v_lim]; v_notas := v_notas[1:v_lim]; v_tempos := v_tempos[1:v_lim];
    if v_n + v_lim >= 100 then v_fim := true;
    else v_prox := v_notas[v_lim]::text || '|' || v_tempos[v_lim]::text || '|' || v_ids[v_lim]::text || '|' || (v_n + v_lim)::text; end if;
  end if;
  select coalesce(jsonb_agg(interno.rede_post_v2(r, v) order by array_position(v_ids, r.id)), '[]'::jsonb) into v_itens from rede_posts r where r.id = any (v_ids);
  return jsonb_build_object('q', btrim(left(coalesce(p_q, ''), 200)), 'itens', v_itens, 'proximo', v_prox, 'ordem', v_ordem, 'fim_por_teto', v_fim,
    'operadores', o - 'texto', 'pessoas', '[]'::jsonb, 'comunidades', '[]'::jsonb);
end $$;

create table if not exists interno.rede_alumia_buscas_salvas (
  id uuid primary key default gen_random_uuid(),
  usuario uuid not null references interno.perfis (id) on delete cascade,
  nome text not null check (char_length(nome) between 1 and 40),
  q text not null check (char_length(q) between 2 and 200),
  criado_em timestamptz not null default now(),
  unique (usuario, q)
);
alter table interno.rede_alumia_buscas_salvas enable row level security;

/** As buscas salvas da própria pessoa (viram abas na tela de busca). */
create or replace function public.rede_alumia_buscas_salvas() returns jsonb language plpgsql volatile security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu();
begin
  perform interno.aberta('comunidade');
  perform interno.limite('rede2_ler', 600, 60);
  return jsonb_build_object('itens', (select coalesce(jsonb_agg(jsonb_build_object('id', b.id, 'nome', b.nome, 'q', b.q) order by b.criado_em), '[]'::jsonb)
    from rede_alumia_buscas_salvas b where b.usuario = v));
end $$;

/** Salva uma busca (a mesma busca de novo só troca o nome). Até 20. */
create or replace function public.rede_alumia_busca_salvar(p_nome text, p_q text) returns jsonb language plpgsql volatile security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); v_nome text; v_q text; v_id uuid;
begin
  perform interno.aberta('comunidade');
  if not interno.rede2_membro(v) then perform interno.erro('consentimento'); end if;
  v_nome := interno.txt(p_nome, 'nome', 1, 40);
  v_q := interno.txt(regexp_replace(coalesce(p_q, ''), '\s+', ' ', 'g'), 'q', 2, 200);
  perform interno.limite('alumia_busca_salva', 30, 60);
  if not exists (select 1 from rede_alumia_buscas_salvas where usuario = v and q = v_q) and (select count(*) from rede_alumia_buscas_salvas where usuario = v) >= 20 then
    perform interno.erro('invalido:muitas');
  end if;
  insert into rede_alumia_buscas_salvas (usuario, nome, q) values (v, v_nome, v_q)
  on conflict (usuario, q) do update set nome = excluded.nome returning id into v_id;
  return jsonb_build_object('id', v_id, 'nome', v_nome, 'q', v_q);
end $$;

/** Apaga uma busca salva da própria pessoa. */
create or replace function public.rede_alumia_busca_apagar(p_id uuid) returns jsonb language plpgsql volatile security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu();
begin
  perform interno.aberta('comunidade');
  delete from rede_alumia_buscas_salvas where id = p_id and usuario = v;
  if not found then perform interno.erro('nao_encontrado'); end if;
  return jsonb_build_object('apagada', true);
end $$;

-- ══════════════════════════════════════════ 9. Salvos em pastas ══════════════════════════════════════════
-- Pasta privada (só a dona vê) e pasta do núcleo (quem é do núcleo vê e põe; a tabela nem guarda quem pôs: LGPD art. 6º, III).
-- Um salvo fica em no máximo uma pasta privada; tirar dos salvos tira das pastas privadas.

create table if not exists interno.rede_alumia_pastas (
  id uuid primary key default gen_random_uuid(),
  usuario uuid references interno.perfis (id) on delete cascade,
  nucleo uuid references interno.rede_nucleos (id) on delete cascade,
  nome text not null check (char_length(nome) between 1 and 40),
  criado_em timestamptz not null default now(),
  check ((usuario is null) <> (nucleo is null))
);
create unique index if not exists rede_alumia_pastas_nome_pessoa on interno.rede_alumia_pastas (usuario, lower(nome)) where usuario is not null;
create unique index if not exists rede_alumia_pastas_nome_nucleo on interno.rede_alumia_pastas (nucleo, lower(nome)) where nucleo is not null;
create table if not exists interno.rede_alumia_pasta_itens (
  pasta uuid not null references interno.rede_alumia_pastas (id) on delete cascade,
  post uuid not null references interno.rede_posts (id) on delete cascade,
  criado_em timestamptz not null default now(),
  primary key (pasta, post)
);
create index if not exists rede_alumia_pasta_itens_post on interno.rede_alumia_pasta_itens (post);
alter table interno.rede_alumia_pastas enable row level security;
alter table interno.rede_alumia_pasta_itens enable row level security;

/** A pasta, se p_quem pode mexer nela (a dona; no núcleo, quem é dele). Senão 'nao_encontrado' (sem dizer se existe). */
create or replace function interno.rede_alumia_pasta(p_id uuid, p_quem uuid) returns interno.rede_alumia_pastas language plpgsql stable security definer set search_path = interno, pg_temp as $$
declare k rede_alumia_pastas;
begin
  select * into k from rede_alumia_pastas where id = p_id;
  if not found or not coalesce(k.usuario = p_quem or (k.nucleo is not null and interno.rede2_no_nucleo(k.nucleo, p_quem)), false) then perform interno.erro('nao_encontrado'); end if;
  return k;
end $$;

/** Tirou dos salvos: sai das pastas privadas dela. */
create or replace function interno.rede_alumia_salvo_saiu() returns trigger language plpgsql security definer set search_path = interno, pg_temp as $$
begin
  delete from rede_alumia_pasta_itens i using rede_alumia_pastas k where k.id = i.pasta and k.usuario = old.usuario and i.post = old.post;
  return null;
end $$;
drop trigger if exists rede_alumia_salvo_saiu on interno.rede_salvos;
create trigger rede_alumia_salvo_saiu after delete on interno.rede_salvos for each row execute function interno.rede_alumia_salvo_saiu();

/**
 * As pastas desta pessoa (as privadas e as dos núcleos dela), com quantos posts cada uma tem (posts, nunca pessoas). Com p_post,
 * também em quais pastas aquele post está (para a escolha ao salvar).
 */
create or replace function public.rede_alumia_pastas(p_post uuid default null) returns jsonb language plpgsql volatile security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu();
begin
  perform interno.aberta('comunidade');
  perform interno.limite('rede2_ler', 600, 60);
  return jsonb_build_object('itens', (select coalesce(jsonb_agg(jsonb_build_object('id', k.id, 'nome', k.nome,
      'nucleo', case when k.nucleo is not null then jsonb_build_object('id', n.id, 'nome', n.nome) end,
      'posts', (select count(*)::integer from rede_alumia_pasta_itens i where i.pasta = k.id),
      'tem', case when p_post is not null then exists (select 1 from rede_alumia_pasta_itens i where i.pasta = k.id and i.post = p_post) end)
      order by (k.nucleo is not null), lower(k.nome)), '[]'::jsonb)
    from rede_alumia_pastas k left join rede_nucleos n on n.id = k.nucleo
    where k.usuario = v or (k.nucleo is not null and interno.rede2_no_nucleo(k.nucleo, v))),
    'nucleos', (select coalesce(jsonb_agg(jsonb_build_object('id', n.id, 'nome', n.nome) order by n.nome), '[]'::jsonb)
      from rede_nucleos n join rede_nucleo_membros m on m.nucleo = n.id and m.usuario = v));
end $$;

/** Cria uma pasta: privada (p_nucleo nulo) ou do núcleo (quem é dele). Até 30 de cada. */
create or replace function public.rede_alumia_pasta_criar(p_nome text, p_nucleo uuid default null) returns jsonb language plpgsql volatile security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); v_nome text; v_id uuid;
begin
  perform interno.aberta('comunidade');
  if not interno.rede2_membro(v) then perform interno.erro('consentimento'); end if;
  v_nome := interno.txt(p_nome, 'nome', 1, 40);
  if p_nucleo is not null and not interno.rede2_no_nucleo(p_nucleo, v) then perform interno.erro('nao_encontrado'); end if;
  perform interno.limite('alumia_pasta', 30, 60);
  if (select count(*) from rede_alumia_pastas where (p_nucleo is null and usuario = v) or (p_nucleo is not null and nucleo = p_nucleo)) >= 30 then perform interno.erro('invalido:muitas'); end if;
  begin
    insert into rede_alumia_pastas (usuario, nucleo, nome) values (case when p_nucleo is null then v end, p_nucleo, v_nome) returning id into v_id;
  exception when unique_violation then perform interno.erro('invalido:nome');
  end;
  return jsonb_build_object('id', v_id, 'nome', v_nome);
end $$;

/** Renomeia ou apaga (p_nome nulo) uma pasta. Privada: a dona. Do núcleo: a mediação do núcleo. Os posts continuam salvos. */
create or replace function public.rede_alumia_pasta_mudar(p_id uuid, p_nome text default null) returns jsonb language plpgsql volatile security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); k rede_alumia_pastas;
begin
  perform interno.aberta('comunidade');
  k := interno.rede_alumia_pasta(p_id, v);
  if k.nucleo is not null and not exists (select 1 from rede_nucleo_membros m where m.nucleo = k.nucleo and m.usuario = v and m.papel = 'mediacao') then
    perform interno.erro('sem_permissao');
  end if;
  perform interno.limite('alumia_pasta', 30, 60);
  if p_nome is null then
    delete from rede_alumia_pastas where id = k.id;
    return jsonb_build_object('apagada', true);
  end if;
  begin
    update rede_alumia_pastas set nome = interno.txt(p_nome, 'nome', 1, 40) where id = k.id;
  exception when unique_violation then perform interno.erro('invalido:nome');
  end;
  return jsonb_build_object('id', k.id, 'nome', btrim(p_nome));
end $$;

/**
 * Põe (p_sim) ou tira um post de uma pasta. Pasta privada: o post vai para os salvos também, e sai da outra pasta privada em que
 * estava (mover). Pasta do núcleo: quem é do núcleo põe e tira; ninguém fica sabendo quem pôs.
 */
create or replace function public.rede_alumia_pasta_por(p_pasta uuid, p_post uuid, p_sim boolean default true) returns jsonb language plpgsql volatile security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); k rede_alumia_pastas; x rede_posts;
begin
  perform interno.aberta('comunidade');
  if not interno.rede2_membro(v) then perform interno.erro('consentimento'); end if;
  k := interno.rede_alumia_pasta(p_pasta, v);
  perform interno.rede2_limite('salvar');
  if not coalesce(p_sim, true) then
    delete from rede_alumia_pasta_itens where pasta = k.id and post = p_post;
    return jsonb_build_object('na_pasta', false);
  end if;
  select * into x from rede_posts where id = p_post;
  if not found or not interno.rede_ve(x, v) or x.apagado_em is not null then perform interno.erro('nao_encontrado'); end if;
  if (select count(*) from rede_alumia_pasta_itens where pasta = k.id) >= 500 then perform interno.erro('invalido:muitas'); end if;
  if k.usuario is not null then
    insert into rede_salvos (usuario, post) values (v, x.id) on conflict do nothing;
    delete from rede_alumia_pasta_itens i using rede_alumia_pastas o where o.id = i.pasta and o.usuario = v and i.post = x.id and o.id <> k.id;
  end if;
  insert into rede_alumia_pasta_itens (pasta, post) values (k.id, x.id) on conflict do nothing;
  return jsonb_build_object('na_pasta', true);
end $$;

/** Os posts de uma pasta, de quando entraram (mais novo primeiro). Só o que esta pessoa ainda vê. Cursor "<quando>|<post>". */
create or replace function public.rede_alumia_pasta_posts(p_pasta uuid, p_cursor text default null, p_limite integer default 20) returns jsonb
language plpgsql volatile security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); k rede_alumia_pastas; v_lim integer := least(greatest(coalesce(p_limite, 20), 1), 50); v_t timestamptz; v_id uuid; v_itens jsonb := '[]'::jsonb; v_prox text; v_n integer := 0; r record;
begin
  perform interno.aberta('comunidade');
  k := interno.rede_alumia_pasta(p_pasta, v);
  perform interno.limite('rede2_ler', 600, 60);
  if nullif(p_cursor, '') is not null then
    begin
      v_t := split_part(p_cursor, '|', 1)::timestamptz; v_id := split_part(p_cursor, '|', 2)::uuid;
    exception when others then perform interno.erro('invalido:cursor');
    end;
  end if;
  for r in select i.criado_em as em, p.id from rede_alumia_pasta_itens i join rede_posts p on p.id = i.post
           where i.pasta = k.id and (v_t is null or (i.criado_em, i.post) < (v_t, v_id)) and interno.rede_ve(p, v) and p.apagado_em is null
           order by i.criado_em desc, i.post desc limit v_lim + 1 loop
    v_n := v_n + 1;
    if v_n > v_lim then exit; end if;
    v_itens := v_itens || jsonb_build_array(interno.rede_post_v2((select x from rede_posts x where x.id = r.id), v));
    v_prox := r.em::text || '|' || r.id::text;
  end loop;
  return jsonb_build_object('itens', v_itens, 'proximo', case when v_n > v_lim then v_prox end, 'pasta', jsonb_build_object('id', k.id, 'nome', k.nome, 'nucleo', k.nucleo is not null));
end $$;

-- ══════════════════════════════════════════ 10. "Pergunte a…" (caixa de perguntas) ══════════════════════════════════════════
-- A caixa é de uma pessoa (que abre a dela) ou de uma comunidade (a moderação abre e responde). A fila é por ordem de chegada.
-- Pergunta anônima só se a caixa aceitar e quem pergunta tiver nível 1 ou mais; nenhuma pergunta com dado pessoal (CPF, telefone,
-- e-mail, endereço). Quem perguntou só aparece se quis (e nunca na anônima). Quem respondeu pela comunidade nunca aparece.

create table if not exists interno.rede_alumia_caixas (
  id uuid primary key default gen_random_uuid(),
  dono uuid unique references interno.perfis (id) on delete cascade,
  comunidade text unique references interno.rede_comunidades (slug) on delete cascade on update cascade,
  aberta boolean not null default true,
  anonimas boolean not null default false,
  chamada text not null default '' check (char_length(chamada) <= 140),
  criado_em timestamptz not null default now(),
  check ((dono is null) <> (comunidade is null))
);
create table if not exists interno.rede_alumia_perguntas (
  id uuid primary key default gen_random_uuid(),
  caixa uuid not null references interno.rede_alumia_caixas (id) on delete cascade,
  quem uuid not null references interno.perfis (id) on delete cascade,
  anonima boolean not null default false,
  mostrar_nome boolean not null default false,
  texto text not null check (char_length(texto) between 5 and 500),
  resposta text check (resposta is null or char_length(resposta) between 1 and 2000),
  situacao text not null default 'fila' check (situacao in ('fila', 'respondida', 'recusada')),
  criado_em timestamptz not null default now(),
  respondida_em timestamptz,
  check (not (anonima and mostrar_nome))
);
create index if not exists rede_alumia_perguntas_fila on interno.rede_alumia_perguntas (caixa, situacao, criado_em);
create index if not exists rede_alumia_perguntas_quem on interno.rede_alumia_perguntas (quem);
alter table interno.rede_alumia_caixas enable row level security;
alter table interno.rede_alumia_perguntas enable row level security;

/**
 * Acha a caixa pelo @ da pessoa ou pelo slug da comunidade, conferindo que p_quem pode ver (perfil fora da busca, conta suspensa e
 * bloqueio: 'nao_encontrado'; comunidade: a mesma recusa da página). Devolve a caixa (id nulo se ainda não foi aberta) e o dono.
 */
create or replace function interno.rede_alumia_caixa_de(p_handle text, p_slug text, p_quem uuid, out k interno.rede_alumia_caixas, out v_dono uuid, out v_slug text)
language plpgsql stable security definer set search_path = interno, pg_temp as $$
declare c rede_comunidades;
begin
  if nullif(p_slug, '') is not null then
    c := interno.rede_alumia_com_ver(p_slug, p_quem);
    v_slug := c.slug;
    select * into k from rede_alumia_caixas where comunidade = c.slug;
  else
    select f.id into v_dono from perfis f
    where f.rede_handle = lower(regexp_replace(coalesce(p_handle, ''), '^@', '')) and f.rede_codinome_ok and not f.suspenso and interno.rede2_membro(f.id)
      and (f.id = p_quem or (f.rede_modo <> 'invisivel' and not f.rede_invisivel and not interno.rede_bloqueado(p_quem, f.id)));
    if v_dono is null then perform interno.erro('nao_encontrado'); end if;
    select * into k from rede_alumia_caixas where dono = v_dono;
  end if;
end $$;

/** Quem cuida da caixa: a dona; na comunidade, a moderação. */
create or replace function interno.rede_alumia_caixa_cuida(k interno.rede_alumia_caixas, p_dono uuid, p_slug text, p_quem uuid) returns boolean language sql stable security definer set search_path = interno, pg_temp as $$
  select p_quem is not null and ((p_dono is not null and p_dono = p_quem) or (p_slug is not null and interno.rede3_com_modera(p_slug, p_quem)))
$$;

/**
 * A caixa como a tela mostra: aberta?, aceita anônima?, a chamada, as perguntas respondidas (mais novas primeiro, até 30), e o que
 * a pessoa pode fazer. Para quem cuida: a fila em ordem de chegada (quem perguntou só se quis aparecer).
 */
create or replace function public.rede_alumia_caixa(p_handle text default null, p_slug text default null) returns jsonb language plpgsql volatile security definer set search_path = interno, pg_temp as $$
declare v uuid := auth.uid(); r record; v_cuida boolean; v_membro boolean := v is not null and interno.rede2_membro(v);
begin
  perform interno.aberta('comunidade');
  if v is not null and exists (select 1 from perfis where id = v and suspenso) then perform interno.erro('conta_suspensa'); end if;
  if v is null and nullif(p_slug, '') is null then perform interno.erro('entre_primeiro'); end if;
  select * into r from interno.rede_alumia_caixa_de(p_handle, p_slug, v);
  perform interno.limite('rede2_ler', 600, 60);
  v_cuida := interno.rede_alumia_caixa_cuida(r.k, r.v_dono, r.v_slug, v);
  return jsonb_build_object(
    'existe', (r.k).id is not null,
    'aberta', coalesce((r.k).aberta, false),
    'anonimas', coalesce((r.k).anonimas, false),
    'chamada', coalesce((r.k).chamada, ''),
    'cuida', v_cuida,
    'pode_perguntar', v_membro and coalesce((r.k).aberta, false) and not v_cuida
      and (r.v_slug is null or interno.rede3_com_situacao(r.v_slug, v) is distinct from 'banido'),
    'pode_anonima', v_membro and coalesce((r.k).anonimas, false) and interno.rede3_mod_nivel(v) >= 1,
    'respondidas', (select coalesce(jsonb_agg(jsonb_build_object('id', z.id, 'texto', z.texto, 'resposta', z.resposta, 'respondida_em', z.respondida_em,
                      'quem', case when z.mostrar_nome and not z.anonima and not interno.rede_bloqueado(v, z.quem) then interno.rede_nome(z.quem) end,
                      'minha', z.quem = v) order by z.respondida_em desc), '[]'::jsonb)
                    from (select * from rede_alumia_perguntas where caixa = (r.k).id and situacao = 'respondida' order by respondida_em desc limit 30) z),
    'minhas', (select coalesce(jsonb_agg(jsonb_build_object('id', z.id, 'texto', z.texto, 'situacao', z.situacao, 'criado_em', z.criado_em) order by z.criado_em), '[]'::jsonb)
               from rede_alumia_perguntas z where z.caixa = (r.k).id and z.quem = v and z.situacao = 'fila'),
    'fila', case when v_cuida then (select coalesce(jsonb_agg(jsonb_build_object('id', z.id, 'texto', z.texto, 'criado_em', z.criado_em, 'anonima', z.anonima,
                      'quem', case when z.mostrar_nome and not z.anonima then interno.rede_nome(z.quem) end) order by z.criado_em), '[]'::jsonb)
                    from (select * from rede_alumia_perguntas where caixa = (r.k).id and situacao = 'fila' order by criado_em limit 100) z) end);
end $$;

/** Abre, fecha ou ajusta a caixa (a própria, ou a da comunidade pela moderação). */
create or replace function public.rede_alumia_caixa_ajustar(p_slug text default null, p_aberta boolean default true, p_anonimas boolean default false, p_chamada text default '') returns jsonb
language plpgsql volatile security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); c rede_comunidades; v_cham text;
begin
  perform interno.aberta('comunidade');
  if not interno.rede2_membro(v) then perform interno.erro('consentimento'); end if;
  v_cham := interno.txt(coalesce(p_chamada, ''), 'chamada', 0, 140);
  perform interno.limite('alumia_caixa', 30, 60);
  if nullif(p_slug, '') is not null then
    c := interno.rede_alumia_com_ver(p_slug, v);
    if not interno.rede3_com_modera(c.slug, v) then perform interno.erro('sem_permissao'); end if;
    insert into rede_alumia_caixas (comunidade, aberta, anonimas, chamada) values (c.slug, coalesce(p_aberta, true), coalesce(p_anonimas, false), v_cham)
    on conflict (comunidade) do update set aberta = excluded.aberta, anonimas = excluded.anonimas, chamada = excluded.chamada;
  else
    insert into rede_alumia_caixas (dono, aberta, anonimas, chamada) values (v, coalesce(p_aberta, true), coalesce(p_anonimas, false), v_cham)
    on conflict (dono) do update set aberta = excluded.aberta, anonimas = excluded.anonimas, chamada = excluded.chamada;
  end if;
  return jsonb_build_object('aberta', coalesce(p_aberta, true), 'anonimas', coalesce(p_anonimas, false), 'chamada', v_cham);
end $$;

/** Pergunta. Anônima só se a caixa aceitar e com nível 1 ou mais. Nunca com dado pessoal. Até 10 por dia; 200 na fila de cada caixa. */
create or replace function public.rede_alumia_perguntar(p_handle text, p_slug text, p_texto text, p_anonima boolean default false, p_mostrar_nome boolean default false) returns jsonb
language plpgsql volatile security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); r record; v_txt text; v_id uuid;
begin
  perform interno.aberta('comunidade');
  if not interno.rede2_membro(v) then perform interno.erro('consentimento'); end if;
  select * into r from interno.rede_alumia_caixa_de(p_handle, p_slug, v);
  if (r.k).id is null or not (r.k).aberta then perform interno.erro('travado'); end if;
  if interno.rede_alumia_caixa_cuida(r.k, r.v_dono, r.v_slug, v) then perform interno.erro('invalido:propria'); end if;
  if r.v_slug is not null and interno.rede3_com_situacao(r.v_slug, v) = 'banido' then perform interno.erro('sem_permissao'); end if;
  if coalesce(p_anonima, false) and (not (r.k).anonimas or interno.rede3_mod_nivel(v) < 1) then perform interno.erro('nivel'); end if;
  v_txt := interno.txt(p_texto, 'texto', 5, 500);
  if interno.rede3_pub_dado_pessoal(v_txt) then perform interno.erro('dado_pessoal'); end if;
  perform interno.limite('alumia_perguntar', 10, 1440);
  if (select count(*) from rede_alumia_perguntas where caixa = (r.k).id and situacao = 'fila') >= 200 then perform interno.erro('muitos_pedidos'); end if;
  insert into rede_alumia_perguntas (caixa, quem, anonima, mostrar_nome, texto)
  values ((r.k).id, v, coalesce(p_anonima, false), coalesce(p_mostrar_nome, false) and not coalesce(p_anonima, false), v_txt) returning id into v_id;
  return jsonb_build_object('id', v_id, 'situacao', 'fila');
end $$;

/**
 * Quem cuida responde (p_resposta) ou recusa (p_resposta nula) uma pergunta da fila. Responder publica a pergunta com a resposta
 * na caixa; quem perguntou recebe um aviso sem nome de quem respondeu. Quem perguntou pode retirar a própria pergunta (p_retirar).
 */
create or replace function public.rede_alumia_pergunta_tratar(p_id uuid, p_resposta text default null, p_retirar boolean default false) returns jsonb
language plpgsql volatile security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); q rede_alumia_perguntas; k rede_alumia_caixas;
begin
  perform interno.aberta('comunidade');
  select * into q from rede_alumia_perguntas where id = p_id;
  if not found then perform interno.erro('nao_encontrado'); end if;
  if coalesce(p_retirar, false) then
    if q.quem <> v then perform interno.erro('nao_encontrado'); end if;
    delete from rede_alumia_perguntas where id = q.id;
    return jsonb_build_object('retirada', true);
  end if;
  select * into k from rede_alumia_caixas where id = q.caixa;
  if not interno.rede_alumia_caixa_cuida(k, k.dono, k.comunidade, v) then perform interno.erro('nao_encontrado'); end if;
  perform interno.limite('alumia_responder', 120, 60);
  if p_resposta is null then
    update rede_alumia_perguntas set situacao = 'recusada', resposta = null, respondida_em = null where id = q.id;
    return jsonb_build_object('situacao', 'recusada');
  end if;
  update rede_alumia_perguntas set situacao = 'respondida', resposta = interno.txt(p_resposta, 'resposta', 1, 2000), respondida_em = now() where id = q.id;
  if q.situacao <> 'respondida' then perform interno.avisar_em(q.quem, 'Sua pergunta foi respondida na Alumia.', 'rede'); end if;
  return jsonb_build_object('situacao', 'respondida');
end $$;

-- ══════════════════════════════════════════ 11. Posts recorrentes ══════════════════════════════════════════
-- "Assembleia toda terça": o agendado ganha repetição (semanal, quinzenal, mensal) e um fim. Quando um sai (publicado ou falhou),
-- o próximo da série entra na fila com o mesmo pedido, até o fim ou 52 vezes. Parar a série cancela o que está na fila.

alter table interno.rede_agendados add column if not exists repetir text;
alter table interno.rede_agendados add column if not exists ate timestamptz;
alter table interno.rede_agendados add column if not exists serie uuid;
alter table interno.rede_agendados add column if not exists vez integer not null default 1;
do $$
begin
  alter table interno.rede_agendados add constraint rede_agendados_repetir check (repetir is null or repetir in ('semanal', 'quinzenal', 'mensal'));
exception when duplicate_object then null;
end $$;
create index if not exists rede_agendados_serie on interno.rede_agendados (serie) where serie is not null;

/** O próximo horário de uma série. */
create or replace function interno.rede_alumia_proxima_vez(p_quando timestamptz, p_repetir text) returns timestamptz language sql immutable as $$
  select p_quando + case p_repetir when 'semanal' then interval '7 days' when 'quinzenal' then interval '14 days' when 'mensal' then interval '1 month' end
$$;

/** Saiu um da série: o próximo entra na fila (se não passou do fim, nem de 52 vezes, nem a série foi parada). */
create or replace function interno.rede_alumia_serie_seguir() returns trigger language plpgsql security definer set search_path = interno, pg_temp as $$
declare v_prox timestamptz;
begin
  if new.repetir is null or old.estado <> 'pendente' or new.estado not in ('publicado', 'falhou') or new.vez >= 52 then return null; end if;
  v_prox := interno.rede_alumia_proxima_vez(new.quando, new.repetir);
  while v_prox < now() loop v_prox := interno.rede_alumia_proxima_vez(v_prox, new.repetir); end loop;
  if new.ate is not null and v_prox > new.ate then return null; end if;
  if exists (select 1 from rede_agendados where serie = new.serie and estado = 'pendente') then return null; end if;
  insert into rede_agendados (autor, pedido, quando, repetir, ate, serie, vez) values (new.autor, new.pedido, v_prox, new.repetir, new.ate, new.serie, new.vez + 1);
  return null;
end $$;
drop trigger if exists rede_alumia_serie_seguir on interno.rede_agendados;
create trigger rede_alumia_serie_seguir after update of estado on interno.rede_agendados for each row execute function interno.rede_alumia_serie_seguir();

/**
 * Agenda um post que se repete: o primeiro passa por rede_pub_agendar (o mesmo ensaio, as mesmas regras), e a série ganha a
 * repetição e o fim (até 1 ano). Devolve {id, serie, quando, repetir, ate}.
 */
create or replace function public.rede_alumia_agendar_serie(p jsonb, p_quando timestamptz, p_repetir text, p_ate timestamptz default null) returns jsonb
language plpgsql volatile security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); v_r jsonb; v_serie uuid := gen_random_uuid();
begin
  if p_repetir is null or p_repetir not in ('semanal', 'quinzenal', 'mensal') then perform interno.erro('invalido:repetir'); end if;
  if p_ate is not null and (p_ate <= p_quando or p_ate > now() + interval '1 year') then perform interno.erro('invalido:ate'); end if;
  if (select count(distinct serie) from rede_agendados where autor = v and serie is not null and estado = 'pendente') >= 5 then perform interno.erro('muitos_pedidos'); end if;
  v_r := public.rede_pub_agendar(p, p_quando);
  update rede_agendados set repetir = p_repetir, ate = coalesce(p_ate, now() + interval '1 year'), serie = v_serie where id = (v_r ->> 'id')::uuid and autor = v;
  return v_r || jsonb_build_object('serie', v_serie, 'repetir', p_repetir, 'ate', coalesce(p_ate, now() + interval '1 year'));
end $$;

/** As séries da própria pessoa que ainda têm um post na fila: o próximo horário, a repetição, o fim e quantas já saíram. */
create or replace function public.rede_alumia_series() returns jsonb language plpgsql volatile security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu();
begin
  perform interno.aberta('comunidade');
  perform interno.rede3_pub_rodar(v);
  return jsonb_build_object('itens', (select coalesce(jsonb_agg(jsonb_build_object('serie', a.serie, 'id', a.id, 'quando', a.quando, 'repetir', a.repetir, 'ate', a.ate,
      'vez', a.vez, 'texto', left(coalesce(a.pedido ->> 'titulo', a.pedido ->> 'texto', ''), 120)) order by a.quando), '[]'::jsonb)
    from rede_agendados a where a.autor = v and a.serie is not null and a.estado = 'pendente'));
end $$;

/** Para a série: cancela o que está na fila e não gera mais nenhum. */
create or replace function public.rede_alumia_serie_parar(p_serie uuid) returns jsonb language plpgsql volatile security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu();
begin
  perform interno.aberta('comunidade');
  update rede_agendados set repetir = null where serie = p_serie and autor = v;
  update rede_agendados set estado = 'cancelado' where serie = p_serie and autor = v and estado = 'pendente';
  if not found then perform interno.erro('nao_encontrado'); end if;
  return jsonb_build_object('parada', true);
end $$;

-- ══════════════════════════════════════════ 12. Lembrar mais tarde ══════════════════════════════════════════
-- Um aviso privado do tipo 'lembrete' na hora escolhida. Se, na hora, o post foi apagado, ficou oculto, retido ou a pessoa não o vê
-- mais, o lembrete some sem avisar. O agendador do banco roda a cada 5 minutos; sem ele, o lembrete sai quando ela abre a lista.

create table if not exists interno.rede_alumia_lembretes (
  usuario uuid not null references interno.perfis (id) on delete cascade,
  post uuid not null references interno.rede_posts (id) on delete cascade,
  quando timestamptz not null,
  criado_em timestamptz not null default now(),
  primary key (usuario, post)
);
create index if not exists rede_alumia_lembretes_quando on interno.rede_alumia_lembretes (quando);
alter table interno.rede_alumia_lembretes enable row level security;

/** Dispara os lembretes que venceram (de uma pessoa, ou de todas). Devolve quantos avisos saíram. */
create or replace function interno.rede_alumia_lembretes_rodar(p_usuario uuid default null) returns integer language plpgsql security definer set search_path = interno, pg_temp as $$
declare l record; x rede_posts; v_n integer := 0;
begin
  for l in delete from rede_alumia_lembretes where quando <= now() and (p_usuario is null or usuario = p_usuario) returning * loop
    select * into x from rede_posts where id = l.post;
    if found and not x.oculto and not x.retido and x.apagado_em is null and interno.rede_ve(x, l.usuario) then
      perform interno.rede3_aviso_criar(l.usuario, 'lembrete', coalesce(x.root_id, x.id), x.id, null, 'Você pediu para lembrar de um post agora.');
      v_n := v_n + 1;
    end if;
  end loop;
  return v_n;
end $$;

/** Marca (p_quando) ou tira (nulo) o lembrete de um post: de 5 minutos a 90 dias. Até 100. Só a pessoa sabe. */
create or replace function public.rede_alumia_lembrar(p_post uuid, p_quando timestamptz default null) returns jsonb language plpgsql volatile security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); x rede_posts;
begin
  perform interno.aberta('comunidade');
  if not interno.rede2_membro(v) then perform interno.erro('consentimento'); end if;
  if p_quando is null then
    delete from rede_alumia_lembretes where usuario = v and post = p_post;
    return jsonb_build_object('quando', null);
  end if;
  select * into x from rede_posts where id = p_post;
  if not found or not interno.rede_ve(x, v) or x.apagado_em is not null then perform interno.erro('nao_encontrado'); end if;
  if p_quando < now() + interval '5 minutes' or p_quando > now() + interval '90 days' then perform interno.erro('invalido:quando'); end if;
  perform interno.rede2_limite('salvar');
  if not exists (select 1 from rede_alumia_lembretes where usuario = v and post = p_post) and (select count(*) from rede_alumia_lembretes where usuario = v) >= 100 then
    perform interno.erro('invalido:muitas');
  end if;
  insert into rede_alumia_lembretes (usuario, post, quando) values (v, p_post, p_quando) on conflict (usuario, post) do update set quando = excluded.quando;
  return jsonb_build_object('quando', p_quando);
end $$;

/** Os lembretes da própria pessoa (dispara antes os que venceram). Com p_post, só o daquele post. */
create or replace function public.rede_alumia_lembretes(p_post uuid default null) returns jsonb language plpgsql volatile security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu();
begin
  perform interno.aberta('comunidade');
  perform interno.limite('rede2_ler', 600, 60);
  perform interno.rede_alumia_lembretes_rodar(v);
  return jsonb_build_object('itens', (select coalesce(jsonb_agg(jsonb_build_object('post', l.post, 'quando', l.quando) order by l.quando), '[]'::jsonb)
    from rede_alumia_lembretes l where l.usuario = v and (p_post is null or l.post = p_post)));
end $$;

/** Para o agendador (pg_cron ou função agendada com a chave de serviço). */
create or replace function public.rede_alumia_lembretes_disparar() returns integer language sql volatile security definer set search_path = interno, pg_temp as $$
  select interno.rede_alumia_lembretes_rodar(null)
$$;
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule('lucia-alumia-lembretes', '*/5 * * * *', 'select public.rede_alumia_lembretes_disparar()');
  end if;
exception when others then null;
end $$;

-- ══════════════════════════════════════════ 13. Permissões ══════════════════════════════════════════

do $$
declare f record; v_anon boolean := exists (select 1 from pg_roles where rolname = 'anon');
begin
  -- Tabelas novas: nenhuma permissão direta (só pelas funções acima).
  revoke all on table interno.rede_alumia_notas, interno.rede_alumia_nota_votos, interno.rede_alumia_wiki, interno.rede_alumia_wiki_versoes,
    interno.rede_alumia_buscas_salvas, interno.rede_alumia_pastas, interno.rede_alumia_pasta_itens, interno.rede_alumia_caixas,
    interno.rede_alumia_perguntas, interno.rede_alumia_lembretes from public;
  if v_anon then
    revoke all on table interno.rede_alumia_notas, interno.rede_alumia_nota_votos, interno.rede_alumia_wiki, interno.rede_alumia_wiki_versoes,
      interno.rede_alumia_buscas_salvas, interno.rede_alumia_pastas, interno.rede_alumia_pasta_itens, interno.rede_alumia_caixas,
      interno.rede_alumia_perguntas, interno.rede_alumia_lembretes from anon, authenticated;
  end if;
  for f in select n.nspname as esquema, p.proname as nome, format('%I.%I(%s)', n.nspname, p.proname, pg_get_function_identity_arguments(p.oid)) as assinatura
           from pg_proc p join pg_namespace n on n.oid = p.pronamespace
           where (n.nspname = 'interno' and p.proname in ('rede_alumia_discordam', 'rede_alumia_nota_recalcular', 'rede_alumia_nota_post', 'rede_alumia_wiki_edita',
                    'rede_alumia_wiki_slug', 'rede_alumia_busca_ler', 'rede_alumia_pasta', 'rede_alumia_salvo_saiu', 'rede_alumia_caixa_de', 'rede_alumia_caixa_cuida',
                    'rede_alumia_proxima_vez', 'rede_alumia_serie_seguir', 'rede_alumia_lembretes_rodar'))
              or (n.nspname = 'public' and p.proname in ('rede_alumia_notas', 'rede_alumia_nota_propor', 'rede_alumia_nota_retirar', 'rede_alumia_nota_avaliar',
                    'rede_alumia_nota_ocultar', 'rede_alumia_wiki', 'rede_alumia_wiki_salvar', 'rede_alumia_wiki_historico', 'rede_alumia_wiki_restaurar',
                    'rede_alumia_wiki_travar', 'rede_alumia_conversas_seguidas', 'rede_alumia_deixar_conversas', 'rede_alumia_tags_seguidas', 'rede_alumia_linha_tags',
                    'rede_alumia_buscar', 'rede_alumia_buscas_salvas', 'rede_alumia_busca_salvar', 'rede_alumia_busca_apagar', 'rede_alumia_pastas',
                    'rede_alumia_pasta_criar', 'rede_alumia_pasta_mudar', 'rede_alumia_pasta_por', 'rede_alumia_pasta_posts', 'rede_alumia_caixa',
                    'rede_alumia_caixa_ajustar', 'rede_alumia_perguntar', 'rede_alumia_pergunta_tratar', 'rede_alumia_agendar_serie', 'rede_alumia_series',
                    'rede_alumia_serie_parar', 'rede_alumia_lembrar', 'rede_alumia_lembretes', 'rede_alumia_lembretes_disparar'))
  loop
    execute format('revoke all on function %s from public', f.assinatura);
    if not v_anon then continue; end if;
    execute format('revoke all on function %s from anon, authenticated', f.assinatura);
    if f.esquema = 'interno' then continue; end if;
    -- Leitura com ou sem conta (a função decide o que cada um vê); o resto só com conta; o agendador só com a chave de serviço.
    if f.nome = 'rede_alumia_lembretes_disparar' then
      execute format('grant execute on function %s to service_role', f.assinatura);
    elsif f.nome in ('rede_alumia_notas', 'rede_alumia_wiki', 'rede_alumia_wiki_historico', 'rede_alumia_linha_tags', 'rede_alumia_buscar', 'rede_alumia_caixa', 'rede_alumia_tags_seguidas') then
      execute format('grant execute on function %s to anon, authenticated, service_role', f.assinatura);
    else
      execute format('grant execute on function %s to authenticated, service_role', f.assinatura);
    end if;
  end loop;
end $$;

-- ═══════════════════════════ fim da Alumia · B1 · comunidade ═══════════════════════════
