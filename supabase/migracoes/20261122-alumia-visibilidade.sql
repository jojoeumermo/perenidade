-- ───────────────────────── Alumia: o seletor de visibilidade do Escrever e o "só mencionados" cifrado ─────────────────────────
-- Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
--
-- Fica no fim do install.sql (depois da integração). Pode rodar mais de uma vez: as regras só entram quando faltam e as funções
-- são redefinidas inteiras, com o corpo que o banco montado tinha antes dela mais o que vem aqui. Teste:
-- scripts/testar-alumia-visibilidade.mjs.
--
-- A decisão de 17/11 (D3/P9, opção A): o Escrever mostra um seletor claro de quem vê, cada opção com uma frase sobre quem vê e se
-- o post sai da Alumia. Os públicos que o banco já tinha cobrem quase tudo, e não mudam:
--   Todos na Alumia (só nela)   "membros". Nunca sai: interno.rede_fed_federavel só deixa sair o post em que a pessoa escolheu
--                               "internet" (o "membros" escolhido de propósito para antes de tudo), e interno.alumia_alc_sai (RSS,
--                               incorporação, Telegram, resumo das comunidades) só leva o que a matriz deixa em "internet".
--   Alumia e Fediverso          "internet" no post de perfil, só com o modo total ligado (P9, 20261121-alumia-integracao.sql). Na
--                               Alumia vale como "membros" (pela matriz); sai para o Fediverso quando a pessoa ligou a federação.
--                               O post de perfil antigo que já federava ("internet" gravado, ou o antigo sem público com alcance
--                               "publico") continua igual: nada aqui muda um post que já existe.
--   Seguidores, Amigos próximos (a roda), Comunidade, Núcleo, Equipe: como já eram.
-- Por isso nem a federação nem o que sai por RSS são redefinidos aqui: a separação entre "só nela" e "Alumia e Fediverso" já está
-- no banco, e o teste prova as duas regras com o corpo final delas.
--
-- O que entra, e só isto:
--   1. "Só eu" (privado): o público novo 'eu'. Só a autora vê, não sai da Alumia, não entra em lista de ninguém. Vem pelo mesmo
--      caminho da roda (public.rede_pub_vida_publicar e o gatilho interno.rede_vida_nasce), com o alcance 'eu' (a regra antiga,
--      interno.rede_ve de um argumento, não o entrega a ninguém além da autora). Resposta da autora ao próprio post herda o 'eu'.
--   2. "Só mencionados" no post cifrado (núcleo e comunidade fechada): o servidor não tem o texto, então não sabia quem foi marcado
--      e ninguém conseguia responder. Agora a autora manda junto, em aberto, só a lista dos @nome marcados (de 1 a 20; a tela diz
--      isso antes de publicar). Fica em interno.rede_pub_extras.mencionados e só serve para public.rede_publicar conferir quem pode
--      responder. O texto continua cifrado; nenhuma função devolve a lista.
--   3. A porta em tudo (interno.alumia_trancar).
-- Nenhuma tabela nova; nenhuma função recebe linha de tabela com valor padrão. Endereço de rede: nada daqui lê ou guarda.

-- ── 1. O público "só eu" ────────────────────────────────────────────────────────────────────────────────────────────────────

do $$
begin
  -- O público ganha 'eu' (a regra de antes, da onda 9, já tinha 'roda').
  if exists (select 1 from pg_constraint where conrelid = 'interno.rede_posts'::regclass and conname = 'rede_posts_publico'
             and pg_get_constraintdef(oid) !~ '''eu''') then
    alter table interno.rede_posts drop constraint rede_posts_publico;
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'interno.rede_posts'::regclass and conname = 'rede_posts_publico') then
    alter table interno.rede_posts add constraint rede_posts_publico
      check (publico is null or publico in ('internet', 'membros', 'seguidores', 'comunidade', 'nucleo', 'equipe', 'roda', 'eu'));
  end if;
  -- O alcance da Rede de antes também: 'eu' não passa em nenhum caso de interno.rede_ve(p) a não ser o da autora.
  if exists (select 1 from pg_constraint where conrelid = 'interno.rede_posts'::regclass and conname = 'rede_posts_alcance_v9'
             and pg_get_constraintdef(oid) !~ '''eu''') then
    alter table interno.rede_posts drop constraint rede_posts_alcance_v9;
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'interno.rede_posts'::regclass and conname = 'rede_posts_alcance_v9') then
    alter table interno.rede_posts add constraint rede_posts_alcance_v9 check (alcance in ('publico', 'seguidores', 'equipe', 'roda', 'eu'));
  end if;
  -- Só post "só eu" tem alcance 'eu', e vice-versa.
  if not exists (select 1 from pg_constraint where conrelid = 'interno.rede_posts'::regclass and conname = 'rede_posts_eu_alcance') then
    alter table interno.rede_posts add constraint rede_posts_eu_alcance check ((publico = 'eu') = (alcance = 'eu'));
  end if;
end $$;

-- ── 2. A lista dos @ marcados no post cifrado com "só mencionados" ─────────────────────────────────────────────────────────

alter table interno.rede_pub_extras add column if not exists mencionados text[];
do $$
begin
  if not exists (select 1 from pg_constraint where conrelid = 'interno.rede_pub_extras'::regclass and conname = 'rede_pub_extras_mencionados') then
    alter table interno.rede_pub_extras add constraint rede_pub_extras_mencionados
      check (mencionados is null or (responde_quem = 'mencionados' and cardinality(mencionados) between 1 and 20));
  end if;
end $$;

-- ── 3. Quem vê e o que sai ──────────────────────────────────────────────────────────────────────────────────────────────────

/**
 * A parte da vida do post na regra de quem vê. Nulo: sem opinião (segue a regra de sempre). Quem escreveu: sempre nulo (a regra de
 * sempre já deixa a autora ver o que é dela). Só eu: ninguém mais. Arquivado ou vencido: ninguém mais. Não listado com a trava
 * ligada: só conta aprovada. Roda: só quem está na roda de quem abriu a conversa (e ela própria), conta aprovada com a trava ligada.
 */
create or replace function interno.rede_vida_ve(p interno.rede_posts, p_quem uuid) returns boolean language plpgsql stable security definer set search_path = interno, pg_temp as $$
declare v_dono uuid;
begin
  if p is null or p.id is null then return null; end if;
  if p_quem is not null and p.autor = p_quem then return null; end if;
  if p.publico = 'eu' then return false; end if;
  if p.arquivado_em is not null then return false; end if;
  if p.expira_em is not null and p.expira_em <= now() then return false; end if;
  if p.nao_listado and interno.alumia_exigida() and not interno.rede2_membro(p_quem) then return false; end if;
  if p.publico = 'roda' then
    if p_quem is null then return false; end if;
    if interno.alumia_exigida() and not interno.rede2_membro(p_quem) then return false; end if;
    v_dono := coalesce((select r.autor from rede_posts r where r.id = p.root_id), p.autor);
    if v_dono is null then return false; end if;
    return p_quem = v_dono or exists (select 1 from rede_roda x where x.dono = v_dono and x.membro = p_quem);
  end if;
  return null;
end $$;

/** Pode sair no Fediverso? Nunca o não listado, o arquivado (nem depois de desarquivar), o que some sozinho, o da roda e o "só eu". */
create or replace function interno.rede_vida_federa(p interno.rede_posts) returns boolean language sql stable security definer set search_path = interno, pg_temp as $$
  select p.id is not null and not (p.nao_listado or p.fora_do_fediverso or p.arquivado_em is not null or p.expira_em is not null or coalesce(p.publico, '') in ('roda', 'eu'))
$$;

-- ── 4. Publicar ─────────────────────────────────────────────────────────────────────────────────────────────────────────────

/**
 * Antes de gravar o post: aplica as escolhas que public.rede_pub_vida_publicar deixou na transação (roda, só eu, não listado, prazo),
 * só no post de primeiro nível da própria autora. Roda aqui, e não depois, para os avisos (menção, conversa seguida) já verem o post
 * como ele é. Todo post 'roda' tem alcance 'roda' e todo post 'eu' tem alcance 'eu' (as respostas herdam o público).
 */
create or replace function interno.rede_vida_nasce() returns trigger language plpgsql security definer set search_path = interno, pg_temp as $$
declare c jsonb;
begin
  begin
    c := nullif(current_setting('alumia.vida', true), '')::jsonb;
  exception when others then
    c := null;
  end;
  if c is not null and new.resposta_a is null and new.autor is not null and new.autor = nullif(c ->> 'autor', '')::uuid then
    if coalesce((c ->> 'roda')::boolean, false) then
      new.publico := 'roda';
      new.nucleo := null;
    end if;
    if coalesce((c ->> 'eu')::boolean, false) then
      new.publico := 'eu';
      new.nucleo := null;
    end if;
    if coalesce((c ->> 'nao_listado')::boolean, false) then new.nao_listado := true; end if;
    if nullif(c ->> 'expira_em', '') is not null then new.expira_em := (c ->> 'expira_em')::timestamptz; end if;
  end if;
  if new.publico = 'roda' then new.alcance := 'roda'; end if;
  if new.publico = 'eu' then new.alcance := 'eu'; end if;
  return new;
end $$;
drop trigger if exists rede_vida_nasce on interno.rede_posts;
create trigger rede_vida_nasce before insert on interno.rede_posts for each row execute function interno.rede_vida_nasce();

/**
 * Publicar com o que a vida do post acrescenta ao pedido de public.rede_pub_publicar_mais (que continua conferindo tudo):
 *   p.publico = 'roda'   só a minha roda (sem comunidade, sem núcleo; a roda precisa ter alguém: erro 'roda_vazia');
 *   p.publico = 'eu'     só eu (sem comunidade, sem núcleo): ninguém mais vê, nada sai da Alumia;
 *   p.nao_listado        true: não entra em linha nem busca (não vale para a roda nem para o "só eu", que já não são de lista);
 *   p.some_em            '24h' ou '7d': o post some sozinho depois disso.
 * Resposta não escolhe nada disso: segue a conversa. Devolve o post como rede_pub_publicar_mais, mais nao_listado e expira_em.
 */
create or replace function public.rede_pub_vida_publicar(p jsonb) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare
  v uuid := interno.eu();
  v_roda boolean; v_eu boolean; v_nao_listado boolean := false; v_some text; v_expira timestamptz; v_pedido jsonb; v_post jsonb;
begin
  perform interno.aberta('comunidade');
  if p is null or jsonb_typeof(p) is distinct from 'object' then perform interno.erro('invalido:post'); end if;
  if p ? 'nao_listado' and jsonb_typeof(p -> 'nao_listado') not in ('boolean', 'null') then perform interno.erro('invalido:nao_listado'); end if;
  v_roda := coalesce(p ->> 'publico', '') = 'roda';
  v_eu := coalesce(p ->> 'publico', '') = 'eu';
  v_nao_listado := coalesce((p ->> 'nao_listado')::boolean, false);
  v_some := nullif(btrim(coalesce(p ->> 'some_em', '')), '');
  if v_some is not null and v_some not in ('24h', '7d') then perform interno.erro('invalido:some_em'); end if;
  v_expira := case v_some when '24h' then now() + interval '24 hours' when '7d' then now() + interval '7 days' end;
  if nullif(p ->> 'resposta_a', '') is not null and (v_roda or v_eu or v_nao_listado or v_some is not null) then perform interno.erro('invalido:publico'); end if;
  -- Não listado e some sozinho ficam fora do Fediverso só quando a federação compuser interno.rede_vida_federa (a
  -- migração da vida do post no Fediverso). Até lá, quem tem a federação ligada não escolhe nenhum dos dois: o post sairia como
  -- público e ficaria copiado do lado de lá.
  if (v_nao_listado or v_some is not null) and not v_roda and not v_eu and interno.rede_vida_federacao_ligada(v) then
    perform interno.erro('vida_federacao');
  end if;
  if v_roda or v_eu then
    if nullif(btrim(coalesce(p ->> 'comunidade', '')), '') is not null or nullif(p ->> 'nucleo', '') is not null then perform interno.erro('invalido:publico'); end if;
    if v_roda and not exists (select 1 from rede_roda r where r.dono = v) then perform interno.erro('roda_vazia'); end if;
    v_nao_listado := false;
  end if;
  v_pedido := p - 'nao_listado' - 'some_em';
  -- A conferência do público é a de "seguidores" (o mais fechado sem comunidade); o gatilho troca para 'roda' ou 'eu' antes de gravar.
  if v_roda or v_eu then v_pedido := v_pedido || jsonb_build_object('publico', 'seguidores'); end if;
  perform set_config('alumia.vida', jsonb_build_object('autor', v, 'roda', v_roda, 'eu', v_eu, 'nao_listado', v_nao_listado, 'expira_em', v_expira)::text, true);
  begin
    v_post := public.rede_pub_publicar_mais(v_pedido);
  exception when others then
    perform set_config('alumia.vida', '', true);
    raise;
  end;
  perform set_config('alumia.vida', '', true);
  return v_post || jsonb_build_object('nao_listado', v_nao_listado, 'expira_em', v_expira);
end $$;

/**
 * Por lote (até 50 ids): quando o post some (para quem pode vê-lo) e, só para a autora, se está arquivado, se é não listado, se é
 * da roda e se é "só eu". Id que a pessoa não pode ver não aparece. Nunca diz quem está na roda.
 */
create or replace function public.rede_pub_vida(p_ids uuid[]) returns jsonb language plpgsql stable security definer set search_path = interno, pg_temp as $$
declare v uuid := auth.uid(); r jsonb := '{}'::jsonb; p rede_posts;
begin
  if p_ids is null then return r; end if;
  for p in select * from rede_posts where id = any (p_ids[1:50]) and apagado_em is null loop
    continue when not interno.rede_ve(p, v);
    r := r || jsonb_build_object(p.id::text, jsonb_strip_nulls(jsonb_build_object(
      'expira_em', p.expira_em,
      'arquivado', case when v is not null and p.autor = v then p.arquivado_em is not null end,
      'nao_listado', case when v is not null and p.autor = v then p.nao_listado end,
      'roda', case when v is not null and p.autor = v then p.publico = 'roda' end,
      'so_eu', case when v is not null and p.autor = v then p.publico = 'eu' end)));
  end loop;
  return r;
end $$;

/**
 * Publica um post ou uma resposta. O corpo de antes (as ondas, a Faixa 2 e a integração: enquete, quem responde, fio, prévia,
 * imagens, áudio, triagem, o post cifrado do grupo e o "internet" do perfil no modo total) mais a lista dos @ marcados no post
 * cifrado com "só mencionados", e a conferência dela na resposta.
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
  -- Quem foi marcado com @ no post cifrado com "só mencionados": só os @nome, em aberto, para conferir quem pode responder.
  v_mencionados text[];
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
  -- "Só mencionados" no post cifrado: o servidor não tem o texto, então a lista dos @ marcados vem junto, em aberto (só os
  -- @nome, de 1 a 20, sem repetir). Só vale com o corpo cifrado e "só mencionados", e nunca numa resposta (quem decide é o post
  -- que abre a conversa). No post aberto o servidor lê os @ no próprio texto, como sempre.
  if p ? 'mencionados' and jsonb_typeof(p -> 'mencionados') <> 'null' then
    if jsonb_typeof(p -> 'mencionados') <> 'array' or v_corpo_grupo is null or v_quem <> 'mencionados' or v_resposta is not null
       or jsonb_array_length(p -> 'mencionados') not between 1 and 20
       or exists (select 1 from jsonb_array_elements(p -> 'mencionados') e
                  where jsonb_typeof(e) <> 'string' or lower(ltrim(btrim(e #>> '{}'), '@')) !~ '^[a-z0-9_]{3,20}$') then
      perform interno.erro('invalido:mencionados');
    end if;
    select array_agg(distinct lower(ltrim(btrim(e), '@'))) into v_mencionados from jsonb_array_elements_text(p -> 'mencionados') e;
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
        -- No post aberto, o @ está no texto; no cifrado, na lista que a autora mandou junto (rede_pub_extras.mencionados).
        if v_handle is null or not (
             (v_raiz.corpo_grupo is null
              and lower(coalesce(v_raiz.titulo, '') || ' ' || v_raiz.texto || ' ' || coalesce(v_raiz.corpo, '')) ~ ('(^|[^a-z0-9_])@' || v_handle || '([^a-z0-9_]|$)'))
          or (v_raiz.corpo_grupo is not null
              and exists (select 1 from rede_pub_extras e where e.post = v_raiz.id and lower(v_handle) = any (coalesce(e.mencionados, '{}'::text[]))))) then
          perform interno.erro('sem_permissao');
        end if;
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
    insert into rede_pub_extras (post, responde_quem, previa, fio, mencionados) values (x.id, v_quem, v_previa, v_fio, v_mencionados);
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
end

$$;

-- ── 5. A porta ──────────────────────────────────────────────────────────────────────────────────────────────────────────────

select interno.alumia_trancar();
