-- ───────────────────────────── Alumia: integração das duas faixas, o banco final ─────────────────────────────
-- Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
--
-- Fica no FIM do install.sql (depois da onda 14). Pode rodar mais de uma vez: as colunas e as regras só entram quando faltam, e as
-- funções são redefinidas inteiras, com o corpo que o banco montado tinha antes dela (as ondas 5 a 14 e a Faixa 2) mais o que vem
-- aqui. Teste: scripts/testar-alumia-integracao.mjs.
--
-- O que entra aqui, e só isto:
--   1. Posts restritos cifrados (pedido P21 da Faixa 2, docs/rede/POSTS-RESTRITOS.md): interno.rede_posts ganha "grupo"
--      ("nucleo:<uuid>" ou "comunidade:<slug>", o grupo MLS) e "corpo_grupo" (o "p2.<época>.<vetor>.<cifrado>" que só o aparelho
--      de quem é do grupo abre). Os dois vêm juntos ou nenhum, e com eles o texto fica vazio (sem título e sem corpo longo).
--   2. public.rede_publicar aceita o post cifrado só com público de núcleo ou de comunidade fechada, só de quem é desse núcleo ou
--      dessa comunidade, só do tipo "post", sem texto, enquete, prévia de link nem descrição de imagem em texto aberto. O aviso de
--      resposta a um post cifrado sai sem trecho. E o pedido P9: com o modo total do Fediverso ligado, o post de perfil pode
--      escolher "internet" (na Alumia ele vale como "membros", pela matriz; sai para o Fediverso quando a pessoa ligou a federação).
--   3. interno.rede_post_v2 devolve "grupo" e "corpo_grupo" (a quem já recebe o post) e, dentro de "autor", "robo": a organização
--      dona quando o autor é conta automática (sobra 1 da onda 13). Uma vez só, com o corpo completo: a resposta recolhida da 9A e
--      o "útil" pelo marco, só a partir de 3 (20261120-alumia-o14-banco.sql).
--   4. O post cifrado nunca sai da Alumia: interno.rede_fed_federavel (federação) e interno.alumia_alc_sai (RSS, incorporação,
--      Telegram e resumo das comunidades) recusam "corpo_grupo" com todas as regras de antes. A busca, os avisos e o resumo semanal
--      leem o texto, que vem vazio.
--   5. A porta em tudo (interno.alumia_trancar).
-- Nenhuma função nova; nenhuma recebe linha de tabela com valor padrão (a de federação continua com o padrão do "p_nivel", que é
-- um inteiro). Endereço de rede: nada daqui lê ou guarda (decisão de 13/11).

-- ── 1. As colunas do post cifrado ─────────────────────────────────────────────────────────────────────────────────────────

alter table interno.rede_posts add column if not exists grupo text;
alter table interno.rede_posts add column if not exists corpo_grupo text;

do $$
declare k record;
begin
  -- A regra "texto não vazio (ou repost)" passa a aceitar o post cifrado, que tem o texto vazio.
  for k in
    select c.conname from pg_constraint c
    where c.conrelid = 'interno.rede_posts'::regclass and c.contype = 'c' and c.conname <> 'rede_posts_texto_ou_grupo'
      and pg_get_constraintdef(c.oid) like '%char_length(texto) > 0%'
  loop
    execute format('alter table interno.rede_posts drop constraint %I', k.conname);
  end loop;
  if not exists (select 1 from pg_constraint where conrelid = 'interno.rede_posts'::regclass and conname = 'rede_posts_texto_ou_grupo') then
    alter table interno.rede_posts add constraint rede_posts_texto_ou_grupo
      check (char_length(texto) > 0 or repost_de is not null or corpo_grupo is not null);
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'interno.rede_posts'::regclass and conname = 'rede_posts_grupo') then
    alter table interno.rede_posts add constraint rede_posts_grupo
      check (grupo is null or grupo ~ '^(nucleo:[0-9a-f-]{36}|comunidade:[a-z0-9-]+)$');
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'interno.rede_posts'::regclass and conname = 'rede_posts_corpo_grupo') then
    alter table interno.rede_posts add constraint rede_posts_corpo_grupo
      check (corpo_grupo is null or (corpo_grupo ~ '^p2\.' and char_length(corpo_grupo) <= 12000));
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'interno.rede_posts'::regclass and conname = 'rede_posts_grupo_junto') then
    alter table interno.rede_posts add constraint rede_posts_grupo_junto check ((grupo is null) = (corpo_grupo is null));
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'interno.rede_posts'::regclass and conname = 'rede_posts_grupo_sem_texto') then
    alter table interno.rede_posts add constraint rede_posts_grupo_sem_texto
      check (corpo_grupo is null or (texto = '' and titulo is null and corpo is null));
  end if;
end $$;

-- ── 2. O que sai da Alumia (RSS, incorporação, Telegram, resumo das comunidades) ────────────────────────────────────────

/** O post pode sair da Alumia por RSS, incorporação, Telegram e o resumo das comunidades. O cifrado nunca sai. */
create or replace function interno.alumia_alc_sai(p interno.rede_posts) returns boolean language sql stable security definer set search_path = interno, pg_temp as $$
  select p.id is not null
    and not interno.alumia_exigida()
    and p.resposta_a is null
    and not p.oculto and not p.retido and p.apagado_em is null
    and p.corpo_grupo is null
    and interno.rede2_publico(p) = 'internet'
    and coalesce(interno.rede_vida_federa(p), false)
    and coalesce(interno.rede_ve(p, null), false)
    and (p.comunidade is null
         or exists (select 1 from rede_comunidades c where c.slug = p.comunidade and c.tipo = 'aberta' and c.slug not like 'fechado-%'))
    and interno.alumia_alc_conta_sai(p.autor)
$$;

-- ── 3. A federação ──────────────────────────────────────────────────────────────────────────────────────────────────────

/**
 * O post pode sair para o Fediverso. A vida do post vem antes de tudo (20261116-fediverso-vida-do-post.sql); o post cifrado
 * nunca sai (e já pararia no público: só núcleo e comunidade fechada levam cifra).
 */
create or replace function interno.rede_fed_federavel(p interno.rede_posts, p_nivel integer default 0) returns boolean language plpgsql stable security definer set search_path = interno, pg_temp as $$
declare a rede_fed_atores; pai rede_posts; v_pub text;
begin
  if p.id is null or p.autor is null or p_nivel > 8 then return false; end if;
  -- A vida do post (não listado, arquivado, some sozinho, roda): nada disso sai. A chamada fica num "if" próprio: o plpgsql só a
  -- prepara quando a função existe.
  if to_regprocedure('interno.rede_vida_federa(interno.rede_posts)') is not null then
    if not interno.rede_vida_federa(p) then return false; end if;
  end if;
  -- O post cifrado do grupo (P21): só o aparelho de quem é do grupo abre.
  if p.corpo_grupo is not null or p.grupo is not null then return false; end if;
  select * into a from rede_fed_atores where perfil = p.autor;
  if not found or not a.ligado or a.ligado_em is null or p.criado_em < a.ligado_em then return false; end if;
  if interno.rede_fed_impedimento(p.autor) is not null then return false; end if;
  if (select rede_handle from perfis where id = p.autor) is distinct from a.handle then return false; end if;
  if p.tipo = 'aviso' or p.nucleo is not null or p.repost_de is not null then return false; end if;
  -- A comunidade fechada nunca sai, em nenhum modo.
  if p.comunidade is not null and exists (select 1 from rede_comunidades c where c.slug = p.comunidade and c.tipo = 'fechada') then return false; end if;
  if interno.rede_fed_total() and coalesce(a.consentimento_versao, 0) >= 2 then
    if p.oculto or p.retido or p.apagado_em is not null then return false; end if;
    if p.comunidade is not null and p.comunidade like 'fechado-%' then return false; end if;
    -- A escolha da pessoa (o mesmo cálculo de interno.rede2_publico antes do rebaixamento): só "internet" sai.
    if coalesce(p.publico, case p.alcance when 'seguidores' then 'seguidores' when 'equipe' then 'equipe' else 'internet' end) <> 'internet' then
      return false;
    end if;
    -- O "internet" do perfil rebaixado para "membros" pela matriz sai (decisão D3, docs/rede/FEDIVERSO.md); o "membros" escolhido
    -- de propósito já parou acima. O "membros" não passa por rede_ve (quem não entrou não o vê, por definição): o que o protege é
    -- a vida do post, conferida no começo.
    v_pub := interno.rede2_publico(p);
    if v_pub not in ('internet', 'membros') then return false; end if;
    if v_pub = 'internet' and not interno.rede_ve(p, null) then return false; end if;
    if p.comunidade is not null and not interno.rede_fed_comunidade_ok(p.comunidade) then return false; end if;
  else
    if coalesce(p.publico, 'internet') <> 'internet' then return false; end if;
    if interno.rede2_publico(p) <> 'internet' or not interno.rede_ve(p, null) then return false; end if;
  end if;
  if p.resposta_a is not null then
    select * into pai from rede_posts where id = p.resposta_a;
    if not found or not interno.rede_fed_federavel(pai, p_nivel + 1) then return false; end if;
  end if;
  return true;
end $$;

-- ── 4. O post como a tela recebe ────────────────────────────────────────────────────────────────────────────────────────

/**
 * O post como a tela recebe. A resposta recolhida da restrita (onda 9, 9A) vai sem conteúdo; o "útil" conta pelo marco e só a
 * partir de 3 (onda 14); "autor.robo" é a organização dona da conta automática (onda 13, nulo quando não é robô); "grupo" e
 * "corpo_grupo" são o post cifrado do núcleo ou da comunidade fechada (P21: o texto vem vazio e o aparelho abre o corpo).
 */
create or replace function interno.rede_post_v2(p interno.rede_posts, p_quem uuid, p_completo boolean default false) returns jsonb language sql stable security definer set search_path = interno, pg_temp as $$
  select case when interno.rede_o9_recolhida(p, p_quem)
              then pv.j || jsonb_build_object('titulo', null, 'texto', '', 'corpo', null, 'longo', false, 'midia', '[]'::jsonb, 'citado', null,
                                         'aviso', '', 'cita', null, 'chamado', null, 'aguardando', true, 'corpo_grupo', null)
              else pv.j end
  from (
  select jsonb_build_object(
    'id', p.id, 'tipo', p.tipo, 'titulo', p.titulo, 'texto', p.texto,
    'corpo', case when p_completo then p.corpo end, 'longo', p.corpo is not null,
    'comunidade', p.comunidade, 'flair', p.flair, 'publico', interno.rede2_publico(p),
    'criado_em', p.criado_em, 'editado_em', p.editado_em,
    'fixado', p.fixado, 'travado', p.travado, 'aceita', p.aceita, 'verificada', p.verificada,
    'resposta_a', p.resposta_a, 'raiz', coalesce(p.root_id, p.id), 'nivel', p.profundidade,
    'aviso', p.aviso, 'cita', p.cita, 'chamado', p.chamado,
    'grupo', p.grupo, 'corpo_grupo', p.corpo_grupo,
    'meu', p_quem is not null and p.autor = p_quem,
    'retido', p_quem is not null and p.autor = p_quem and (p.retido or p.oculto),
    'motivo', case when p_quem is not null and p.autor = p_quem and (p.retido or p.oculto) then p.motivo else '' end,
    'modero', p_quem is not null and p_quem = auth.uid() and (interno.cuida() or exists (
      select 1 from rede_comunidade_membros m where m.comunidade = p.comunidade and m.usuario = p_quem and m.papel = 'moderacao' and m.situacao = 'ativo')),
    'autor', jsonb_build_object(
      'id', p.autor, 'codinome', interno.rede_nome(p.autor),
      'handle', case when not coalesce(f.rede_modo = 'invisivel' or f.rede_invisivel, false) then f.rede_handle end,
      'perfil', not coalesce(f.rede_modo = 'invisivel' or f.rede_invisivel, false),
      'equipe', interno.voluntario_e(p.autor),
      -- A conta automática diz de quem é, para todo mundo (o mesmo de public.alumia_pontes_rotulos).
      'robo', (select jsonb_build_object('handle', o.rede_handle, 'nome', coalesce(o.rede_codinome, o.nome))
                 from rede_pontes_robos r join perfis o on o.id = r.org
                where r.perfil = p.autor and r.situacao <> 'criando')),
    'respostas', interno.rede2_respostas_visiveis(p.id, p_quem),
    'na_conversa', case when p.root_id is null then (select count(*)::integer from rede_posts r where r.root_id = p.id and interno.rede_ve(r, p_quem)) end,
    'util', interno.rede_util_publicado(p.id),
    'util_eu', p_quem is not null and exists (select 1 from rede_reacoes r where r.post = p.id and r.tipo = 'util' and r.usuario = p_quem),
    -- Só quem escreveu vê quantos apoiaram (decisão 3): a Rede de hoje também guardava em rede_apoios.
    'apoios', case when p_quem is not null and p.autor = p_quem then (
      select count(*)::integer from (select usuario from rede_reacoes where post = p.id and tipo = 'apoio' union select usuario from rede_apoios where post = p.id) z) end,
    'apoiei', p_quem is not null and (exists (select 1 from rede_reacoes r where r.post = p.id and r.tipo = 'apoio' and r.usuario = p_quem) or exists (select 1 from rede_apoios a where a.post = p.id and a.usuario = p_quem)),
    'salvei', p_quem is not null and exists (select 1 from rede_salvos s where s.post = p.id and s.usuario = p_quem),
    -- "Eu vou": o total é de quem organizou; quem marcou só sabe que marcou. Ninguém vê lista de nomes.
    'vou', case when p.chamado is not null and p_quem is not null and p.autor = p_quem then (select count(*)::integer from rede_vou v where v.post = p.id) end,
    'vou_eu', p_quem is not null and exists (select 1 from rede_vou v where v.post = p.id and v.usuario = p_quem),
    'midia', (select coalesce(jsonb_agg(jsonb_build_object('id', m.id, 'alt', m.alt, 'largura', m.largura, 'altura', m.altura, 'blurhash', m.blurhash) order by m.ordem), '[]'::jsonb) from rede_midia m where m.post = p.id),
    'citado', case when p.quote_of is not null then (
      select case when interno.rede_ve(o, p_quem) then jsonb_build_object('id', o.id, 'codinome', interno.rede_nome(o.autor), 'trecho', left(o.texto, 200))
                  else jsonb_build_object('restrito', true) end from rede_posts o where o.id = p.quote_of) end) as j
  from (select 1) u left join perfis f on f.id = p.autor
  ) pv
$$;

-- ── 5. Publicar ─────────────────────────────────────────────────────────────────────────────────────────────────────────

/**
 * Publica um post ou uma resposta. O corpo de antes (as ondas e a Faixa 2: enquete, quem responde, fio, prévia, imagens, áudio,
 * triagem) mais o post cifrado do grupo (P21) e o "internet" do perfil no modo total do Fediverso (P9).
 */
create or replace function public.rede_publicar(p jsonb) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare
  v uuid := interno.eu();
  x rede_posts; o rede_posts; v_raiz rede_posts; c rede_comunidades;
  v_tipo text := coalesce(nullif(btrim(p ->> 'tipo'), ''), 'post');
  v_titulo text; v_texto text; v_corpo text;
  v_com text := nullif(btrim(coalesce(p ->> 'comunidade', '')), '');
  v_publico text := nullif(btrim(coalesce(p ->> 'publico', '')), '');
  v_flair text := nullif(btrim(coalesce(p ->> 'flair', '')), '');
  v_aviso text := left(btrim(coalesce(p ->> 'aviso', '')), 80);
  v_resposta uuid; v_nucleo uuid; v_tri jsonb; v_ver text; v_tudo text; v_motivo text;
  v_quem text := coalesce(nullif(btrim(p ->> 'responde_quem'), ''), 'todos');
  v_fio boolean := coalesce((p ->> 'fio')::boolean, false);
  v_previa jsonb := null; v_opcoes jsonb := '[]'::jsonb; v_horas integer := 24; v_multipla boolean := false;
  v_midia jsonb := case when jsonb_typeof(p -> 'midia') = 'array' then p -> 'midia' else '[]'::jsonb end;
  v_audio jsonb := case when jsonb_typeof(p -> 'audio') = 'object' then p -> 'audio' end;
  m jsonb; v_i integer := 0; v_ok boolean; v_cam text; v_ext text; v_handle text; v_dur integer; v_opcao text;
  -- P21: o grupo MLS e o corpo cifrado (só o aparelho de quem é do grupo abre).
  v_grupo text := nullif(btrim(coalesce(p ->> 'grupo', '')), '');
  v_corpo_grupo text := nullif(btrim(coalesce(p ->> 'corpo_grupo', '')), '');
begin
  perform interno.aberta('comunidade');
  if p is null or jsonb_typeof(p) is distinct from 'object' then perform interno.erro('invalido:post'); end if;
  if not coalesce((select rede_18 from perfis where id = v), false) then perform interno.erro('confirme_idade'); end if;
  if not interno.rede2_membro(v) then perform interno.erro('consentimento'); end if;
  if not coalesce((select rede_codinome_ok and rede_codinome is not null from perfis where id = v), false) then perform interno.erro('confirme_codinome'); end if;
  begin
    v_resposta := nullif(p ->> 'resposta_a', '')::uuid;
    v_nucleo := nullif(p ->> 'nucleo', '')::uuid;
  exception when others then perform interno.erro('invalido:post');
  end;
  if v_tipo not in ('post', 'discussao', 'duvida', 'aviso', 'enquete') then perform interno.erro('invalido:tipo'); end if;
  if v_tipo = 'aviso' and not interno.voluntario() then perform interno.erro('sem_permissao'); end if;
  if v_resposta is not null and v_tipo <> 'post' then perform interno.erro('invalido:tipo'); end if;
  if v_quem not in ('todos', 'seguindo', 'mencionados', 'ninguem') then perform interno.erro('invalido:responde_quem'); end if;
  if v_fio and v_resposta is null then perform interno.erro('invalido:fio'); end if;
  -- O post cifrado: os dois juntos, no formato do MLS, só do tipo "post", e nada em texto aberto junto (texto, título, corpo
  -- longo, enquete, prévia de link, descrição de imagem). O público e o grupo são conferidos depois, quando se sabe o público.
  if v_grupo is not null or v_corpo_grupo is not null then
    if v_grupo is null or v_corpo_grupo is null
       or v_grupo !~ '^(nucleo:[0-9a-f-]{36}|comunidade:[a-z0-9-]{2,60})$'
       or v_corpo_grupo !~ '^p2\.' or char_length(v_corpo_grupo) > 12000
       or v_tipo <> 'post'
       or nullif(btrim(coalesce(p ->> 'texto', '')), '') is not null
       or nullif(btrim(coalesce(p ->> 'titulo', '')), '') is not null
       or nullif(btrim(coalesce(p ->> 'corpo', '')), '') is not null
       or (p ? 'enquete' and jsonb_typeof(p -> 'enquete') <> 'null')
       or (p ? 'previa' and jsonb_typeof(p -> 'previa') = 'object')
       or exists (select 1 from jsonb_array_elements(v_midia) e where nullif(btrim(coalesce(e ->> 'alt', '')), '') is not null) then
      perform interno.erro('invalido:grupo');
    end if;
  end if;
  perform interno.rede2_limite(case when v_resposta is not null then 'responder' else 'postar' end);

  if v_corpo_grupo is not null then
    v_texto := '';
  elsif v_tipo in ('discussao', 'duvida') then
    v_titulo := interno.txt(p ->> 'titulo', 'titulo', 5, 140);
    v_corpo := interno.txt(p ->> 'corpo', 'corpo', 10, 10000);
    v_texto := left(v_corpo, 500);
  else
    v_texto := interno.txt(p ->> 'texto', 'texto', 1, 500);
    v_titulo := case when v_tipo = 'aviso' then nullif(left(btrim(coalesce(p ->> 'titulo', '')), 140), '') end;
  end if;

  -- Enquete: 2 a 4 opções de até 80, prazo de 1 hora a 7 dias.
  if v_tipo = 'enquete' then
    if jsonb_typeof(p -> 'enquete') is distinct from 'object' or jsonb_typeof(p -> 'enquete' -> 'opcoes') is distinct from 'array' then perform interno.erro('invalido:enquete'); end if;
    if jsonb_array_length(p -> 'enquete' -> 'opcoes') not between 2 and 4 then perform interno.erro('invalido:opcoes'); end if;
    for v_opcao in select btrim(e) from jsonb_array_elements_text(p -> 'enquete' -> 'opcoes') e loop
      if char_length(v_opcao) not between 1 and 80 then perform interno.erro('invalido:opcoes'); end if;
      v_opcoes := v_opcoes || to_jsonb(v_opcao);
    end loop;
    if (select count(distinct lower(e)) from jsonb_array_elements_text(v_opcoes) e) <> jsonb_array_length(v_opcoes) then perform interno.erro('invalido:opcoes'); end if;
    begin
      v_horas := coalesce(nullif(p -> 'enquete' ->> 'horas', '')::integer, 24);
      v_multipla := coalesce((p -> 'enquete' ->> 'multipla')::boolean, false);
    exception when others then perform interno.erro('invalido:enquete');
    end;
    if v_horas not between 1 and 168 then perform interno.erro('invalido:prazo'); end if;
  elsif p ? 'enquete' and jsonb_typeof(p -> 'enquete') <> 'null' then
    perform interno.erro('invalido:enquete');
  end if;

  if jsonb_array_length(v_midia) > 10 then perform interno.erro('invalido:midia'); end if;
  if jsonb_array_length(v_midia) > 0 and v_audio is not null then perform interno.erro('invalido:midia'); end if;
  if p ? 'previa' and jsonb_typeof(p -> 'previa') = 'object' then v_previa := interno.rede3_pub_previa(p -> 'previa'); end if;

  -- Dado pessoal não vai para a Rede: CPF, telefone, e-mail e endereço com número (LGPD, minimização).
  v_tudo := coalesce(v_titulo, '') || ' ' || v_texto || ' ' || coalesce(v_corpo, '') || ' ' || coalesce(v_opcoes::text, '')
            || ' ' || coalesce((select string_agg(coalesce(e ->> 'alt', ''), ' ') from jsonb_array_elements(v_midia) e), '')
            || ' ' || coalesce(v_previa ->> 'titulo', '') || ' ' || coalesce(v_previa ->> 'descricao', '');
  if interno.rede3_pub_dado_pessoal(v_tudo) then perform interno.erro('dado_pessoal'); end if;

  if v_resposta is not null then
    select * into o from rede_posts where id = v_resposta;
    if not found or not interno.rede_ve(o, v) or o.oculto or o.retido or o.apagado_em is not null then perform interno.erro('nao_encontrado'); end if;
    select * into v_raiz from rede_posts where id = coalesce(o.root_id, o.id);
    if o.travado or v_raiz.travado then perform interno.erro('travado'); end if;
    if o.profundidade >= 6 then perform interno.erro('limite_de_niveis'); end if;
    v_com := o.comunidade; v_nucleo := o.nucleo; v_publico := interno.rede2_publico(o); v_flair := null;
    -- Quem pode responder (decidido por quem abriu a conversa); o próprio autor da conversa sempre pode.
    if v_raiz.autor is distinct from v then
      select coalesce(e.responde_quem, 'todos') into v_quem from (select 1) u left join rede_pub_extras e on e.post = v_raiz.id;
      if v_quem = 'ninguem' then perform interno.erro('sem_permissao'); end if;
      if v_quem = 'seguindo' and not exists (select 1 from rede_seguindo s where s.quem = v_raiz.autor and s.segue = v and not s.pendente) then perform interno.erro('sem_permissao'); end if;
      if v_quem = 'mencionados' then
        select rede_handle into v_handle from perfis where id = v;
        if v_handle is null or lower(coalesce(v_raiz.titulo, '') || ' ' || v_raiz.texto || ' ' || coalesce(v_raiz.corpo, '')) !~ ('(^|[^a-z0-9_])@' || v_handle || '([^a-z0-9_]|$)') then perform interno.erro('sem_permissao'); end if;
      end if;
    end if;
    v_quem := 'todos';
    -- Fio: só a sequência do próprio autor (resposta ao próprio post).
    if v_fio and o.autor is distinct from v then perform interno.erro('invalido:fio'); end if;
  end if;

  if v_com is not null then
    select * into c from rede_comunidades where slug = v_com;
    if not found and v_resposta is null then perform interno.erro('invalido:comunidade'); end if;
    if found then
      if exists (select 1 from rede_comunidade_membros m where m.comunidade = c.slug and m.usuario = v and (m.situacao = 'banido' or m.banido_ate > now())) then perform interno.erro('sem_permissao'); end if;
      if c.tipo <> 'aberta' and not interno.rede2_na_comunidade(c.slug, v) then perform interno.erro('sem_permissao'); end if;
    end if;
  end if;

  if v_resposta is null then
    if v_publico is null then
      v_publico := case when c.slug is null then 'membros' else case c.publico_padrao when 'comunidade' then 'comunidade' when 'internet' then 'internet' else 'membros' end end;
    end if;
    if v_publico not in ('internet', 'membros', 'seguidores', 'comunidade', 'nucleo', 'equipe') then perform interno.erro('invalido:publico'); end if;
    -- "internet": nas comunidades das disciplinas; e no perfil quando o modo total do Fediverso está ligado (P9: na Alumia vale
    -- como "membros", pela matriz; sai para o Fediverso se a pessoa ligou a federação).
    if v_publico = 'internet' and not ((c.slug is not null and c.categoria = 'disciplinas') or (c.slug is null and v_com is null and interno.rede_fed_total())) then
      perform interno.erro('invalido:publico');
    end if;
    if v_publico = 'comunidade' and c.slug is null then perform interno.erro('invalido:publico'); end if;
    if v_publico = 'nucleo' then
      if v_nucleo is null or not interno.rede2_no_nucleo(v_nucleo, v) then perform interno.erro('sem_permissao'); end if;
    else
      v_nucleo := null;
    end if;
    if v_publico = 'equipe' and not interno.voluntario() then perform interno.erro('sem_permissao'); end if;
    if v_flair is not null and not exists (select 1 from rede_comunidade_flairs f where f.comunidade = v_com and f.nome = v_flair) then perform interno.erro('invalido:flair'); end if;
  end if;

  -- O post cifrado só no núcleo ou na comunidade fechada do próprio post, e só de quem é do grupo (as regras do MLS).
  if v_corpo_grupo is not null then
    if not ((v_publico = 'nucleo' and v_nucleo is not null and v_grupo = 'nucleo:' || v_nucleo::text)
            or (v_publico = 'comunidade' and c.slug is not null and c.tipo = 'fechada' and v_grupo = 'comunidade:' || c.slug)) then
      perform interno.erro('invalido:grupo');
    end if;
    if not interno.rede_grupo_membro(v_grupo, v) then perform interno.erro('sem_permissao'); end if;
  else
    v_grupo := null;
  end if;

  -- Imagens: só da própria pasta, ainda sem dono, e que existem no depósito (onde há depósito).
  for m in select e from jsonb_array_elements(v_midia) e loop
    v_cam := btrim(coalesce(m ->> 'caminho', ''));
    if v_cam !~ ('^' || v ::text || '/[a-f0-9-]{36}\.(jpg|png|webp)$') then perform interno.erro('invalido:midia'); end if;
    if exists (select 1 from rede_midia where caminho = v_cam) then perform interno.erro('invalido:midia'); end if;
    if to_regclass('storage.objects') is not null then
      execute 'select exists (select 1 from storage.objects where bucket_id = ''rede-midia'' and name = $1)' into v_ok using v_cam;
      if not v_ok then perform interno.erro('invalido:midia'); end if;
    end if;
  end loop;
  if v_audio is not null then
    v_cam := btrim(coalesce(v_audio ->> 'caminho', ''));
    if v_cam !~ ('^' || v ::text || '/[a-f0-9-]{36}\.(webm|ogg|m4a)$') or exists (select 1 from rede_audios where caminho = v_cam) then perform interno.erro('invalido:audio'); end if;
    begin v_dur := (v_audio ->> 'duracao')::numeric::integer; exception when others then v_dur := null; end;
    if v_dur is null or v_dur not between 1 and 60 then perform interno.erro('invalido:audio'); end if;
  end if;

  v_tri := interno.rede_triagem(v_tudo, v);
  v_ver := v_tri ->> 'veredito'; v_motivo := coalesce(v_tri ->> 'motivo', '');
  -- Regra simples de ódio (xingamentos de ódio explícitos): vai para a leitura da mediação em vez de aparecer; a decisão é de gente.
  if v_ver = 'publicar' and interno.normal(v_tudo) ~ '(^|[^a-z])(macaco|crioulo|viado|bicha|sapatao|retardado|mongoloide|vagabunda|nordestino imundo|judeu imundo|negro imundo)([^a-z]|$)' then
    v_ver := 'revisar'; v_motivo := 'regra_simples_odio';
  end if;

  insert into rede_posts (autor, tipo, titulo, texto, corpo, comunidade, resposta_a, publico, alcance, nucleo, flair, aviso, oculto, retido, avaliacao, motivo, grupo, corpo_grupo)
  values (v, v_tipo, v_titulo, v_texto, v_corpo, v_com, v_resposta, v_publico, interno.rede_alcance(v_publico), v_nucleo, v_flair, v_aviso,
          v_ver <> 'publicar', v_ver = 'revisar', case v_ver when 'publicar' then 'publicada' when 'bloquear' then 'bloqueada' else 'revisao' end, v_motivo,
          v_grupo, v_corpo_grupo)
  returning * into x;

  if v_quem <> 'todos' or v_previa is not null or v_fio then
    insert into rede_pub_extras (post, responde_quem, previa, fio) values (x.id, v_quem, v_previa, v_fio);
  end if;
  if v_tipo = 'enquete' then
    insert into rede_enquetes (post, prazo, multipla) values (x.id, now() + make_interval(hours => v_horas), v_multipla);
    insert into rede_opcoes (enquete, texto, ordem) select x.id, e.t, (e.n - 1)::smallint from jsonb_array_elements_text(v_opcoes) with ordinality e(t, n);
  end if;
  v_i := 0;
  for m in select e from jsonb_array_elements(v_midia) e loop
    v_cam := btrim(m ->> 'caminho');
    v_ext := substring(v_cam from '\.([a-z]+)$');
    insert into rede_midia (post, caminho, tipo, largura, altura, alt, ordem)
    values (x.id, v_cam, case v_ext when 'jpg' then 'image/jpeg' when 'png' then 'image/png' else 'image/webp' end,
            nullif(m ->> 'largura', '')::integer, nullif(m ->> 'altura', '')::integer, left(btrim(coalesce(m ->> 'alt', '')), 1000), v_i::smallint);
    v_i := v_i + 1;
  end loop;
  if v_audio is not null then
    v_ext := substring(btrim(v_audio ->> 'caminho') from '\.([a-z0-9]+)$');
    insert into rede_audios (post, caminho, tipo, duracao)
    values (x.id, btrim(v_audio ->> 'caminho'), case v_ext when 'webm' then 'audio/webm' when 'ogg' then 'audio/ogg' else 'audio/mp4' end, v_dur::smallint);
  end if;

  if v_resposta is not null and o.autor is distinct from v and not x.oculto and not interno.rede_bloqueado(v, o.autor) then
    -- A resposta cifrada avisa sem trecho (o servidor não tem o texto).
    perform interno.avisar_em(o.autor, case when v_corpo_grupo is not null then format('%s respondeu ao seu post na Alumia.', interno.rede_nome(v))
                                            else format('%s respondeu ao seu post na Alumia: “%s”', interno.rede_nome(v), left(v_texto, 120)) end, 'rede');
  end if;
  return interno.rede_post_v2(x, v, true) || jsonb_build_object('avaliar', coalesce((v_tri ->> 'externa')::boolean, false));
exception when check_violation or invalid_text_representation or numeric_value_out_of_range then perform interno.erro('invalido:post');
end $$;

-- ── 6. A porta ──────────────────────────────────────────────────────────────────────────────────────────────────────────
-- create or replace tira a porta de public.rede_publicar; esta linha a devolve. "abertas" tem de vir vazia.
select interno.alumia_trancar();
