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

-- @@CONTINUA@@

-- ═══════════════════════════ fim da Alumia · B1 · comunidade ═══════════════════════════
