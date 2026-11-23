-- Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
-- Alumia · Prompt 4 · o compositor (itens 26, 27, 28, 29, 117 e 118), atrás do interruptor "alumia-p4-compositor".
--
-- O que faz:
--   26  Artigo com capítulos: o texto longo (tipo discussão, até 10.000 letras como hoje) ganha CAPA (uma das imagens anexadas,
--       escolhida pela autora) e a conta dos CAPÍTULOS (cada "## Título" do texto abre um). O índice e a leitura em páginas são
--       feitos na tela, a partir do próprio texto (lib/rede/texto/formatado.ts, capitulosDoTexto).
--   27  Álbum de até 20 imagens (eram 10), cada uma com a legenda da onda 12. A limpeza dos metadados e o desfoque de rostos são
--       os de sempre (no aparelho e de novo na rota /api/rede/midia). Com o interruptor desligado, o teto continua 10.
--   28  O lembrete de descrever a imagem já existia na tela; o filtro "esconder imagens sem descrição" é só do aparelho de quem
--       lê (nada aqui: o banco não sabe quem ligou o filtro).
--   29  "Mande a sua": a autora marca o post como convite; as respostas são respostas comuns (uma frase ou uma imagem), com as
--       regras de sempre. O total aparece só a partir de 3 pessoas diferentes; abaixo disso, nenhum número. Ninguém vê lista.
--   117 Versão curta: até 280 letras, escrita pela autora, só no texto longo. Passa pela mesma conferência de dado pessoal e pela
--       mesma triagem do texto do post (a legenda da onda 12 faz igual).
--   118 Marca "com fonte": a fonte entra já no compositor (um link http(s) sem rastreio, uma checagem do Vale o Escrito, ou os
--       dois) e fica na mesma tabela do "Fonte?" (interno.rede_fontes, 20261118-alumia-o12-coautoria.sql).
--
-- Roda depois das migrações 20261127-p4-* da primeira junção (banco na versão 18 depois delas); quem junta põe esta antes do
-- 20261127-p4-fim.sql, que continua o último. Não mexe em rede_alumia_versao nem na lista de exceções da porta.
--
-- Como entra no que já existe: public.rede_pub_p4_publicar e public.rede_pub_p4_agendar embrulham as da onda 12 (que embrulham a
-- onda 9 e o rede_publicar de sempre): nada do que confere o post foi reescrito. Funções existentes redefinidas (corpo inteiro tirado
-- do banco montado; muda só o teto de imagens): public.rede_publicar(jsonb), interno.rede_o12_separar(jsonb, uuid),
-- public.rede_pub_corrigir(uuid, jsonb), interno.rede_texto_limpo(text) (imagem 1 a 20 no meio do texto longo),
-- public.rede_mod_niveis() e public.rede_mod_meu_nivel() (o teto que vale de verdade).
-- O post cifrado (P21, item 136) não leva nada daqui: a versão curta, a fonte, a capa e o convite são texto aberto, então a
-- função recusa ('invalido:grupo') e a tabela nova também (gatilho), venha de qual caminho vier.
--
-- Tabelas em interno, RLS ligada e sem política, nenhuma permissão direta. Nenhuma função devolve lista de pessoas; o total do
-- convite é nulo abaixo de 3. Endereço de rede: nada daqui lê ou guarda. Pode rodar mais de uma vez, sem apagar dado nenhum.
-- Lei: LGPD art. 6º, III (necessidade: só o que a autora escreveu para o post) e art. 46 (segurança: nada aberto em post cifrado).
-- Teste: npm run testar:p4-compositor.

-- ── 0. O interruptor ───────────────────────────────────────────────────────────────────────────────────────────────────────
do $$
begin
  if to_regclass('interno.recursos_catalogo') is not null then
    insert into interno.recursos_catalogo (nome, so_pelo_nome) values ('alumia-p4-compositor', true)
      on conflict (nome) do update set so_pelo_nome = true;
  end if;
end $$;

/** O compositor do prompt 4 está ligado? Desligado com a Alumia (rede-v2, alumia-2) desligada; sem decisão no painel, desligado. */
create or replace function interno.rede_p4c_ligada() returns boolean language plpgsql stable security definer set search_path = interno, pg_temp as $$
begin
  if to_regclass('interno.recursos_vivos') is null then return false; end if;
  if exists (select 1 from recursos_vivos where nome in ('rede-v2', 'alumia-2') and not ligado) then return false; end if;
  return coalesce((select ligado from recursos_vivos where nome = 'alumia-p4-compositor'), false);
end $$;

/** O teto de imagens por post: 20 com o interruptor ligado (o álbum, item 27), 10 sem ele (a onda 12). */
create or replace function interno.rede_p4c_imagens() returns integer language sql stable security definer set search_path = interno, pg_temp as $$
  select case when interno.rede_p4c_ligada() then 20 else 10 end
$$;

-- ── 1. Álbum de até 20 imagens (item 27) ───────────────────────────────────────────────────────────────────────────────────
do $$
declare v_nome text;
begin
  for v_nome in
    select c.conname from pg_constraint c
    where c.conrelid = 'interno.rede_midia'::regclass and c.contype = 'c' and pg_get_constraintdef(c.oid) ~ '\mordem\M'
      and pg_get_constraintdef(c.oid) !~ '19'
  loop
    execute format('alter table interno.rede_midia drop constraint %I', v_nome);
  end loop;
  if not exists (select 1 from pg_constraint where conrelid = 'interno.rede_midia'::regclass and conname = 'rede_midia_ordem_check') then
    alter table interno.rede_midia add constraint rede_midia_ordem_check check (ordem between 0 and 19);
  end if;
end $$;

-- Os níveis de confiança (regras públicas, /alumia/cuidado): o teto da tabela vai a 20, e os níveis regular e líder que ainda têm o
-- valor da onda 12 (10) sobem para 20. Novo (1), básico (2) e membro (6) ficam. Um valor que a coordenação já mudou fica.
do $$
declare v_nome text;
begin
  for v_nome in
    select c.conname from pg_constraint c
    where c.conrelid = 'interno.rede_niveis'::regclass and c.contype = 'c' and pg_get_constraintdef(c.oid) ~ '\mimagens\M'
      and pg_get_constraintdef(c.oid) !~ '20'
  loop
    execute format('alter table interno.rede_niveis drop constraint %I', v_nome);
  end loop;
  if not exists (select 1 from pg_constraint where conrelid = 'interno.rede_niveis'::regclass and conname = 'rede_niveis_imagens_check') then
    alter table interno.rede_niveis add constraint rede_niveis_imagens_check check (imagens between 0 and 20);
  end if;
  update interno.rede_niveis set imagens = 20 where nivel in (3, 4) and imagens = 10;
end $$;

-- As regras públicas dos níveis (/alumia/cuidado) e "o meu nível" mostram o teto que vale de verdade: o do nível, sem passar do
-- teto do álbum (com o interruptor desligado, 10, mesmo para quem o nível dá 20). Corpos inteiros, tirados do banco montado; a
-- única mudança é o least(). Funções existentes redefinidas: public.rede_mod_niveis() e public.rede_mod_meu_nivel().
CREATE OR REPLACE FUNCTION public.rede_mod_niveis()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'interno', 'pg_temp'
AS $function$
begin perform interno.alumia_porta(); return (select coalesce(jsonb_agg(jsonb_build_object(
    'nivel', n.nivel, 'nome', n.nome, 'automatico', n.automatico, 'dias', n.dias, 'participacoes', n.participacoes, 'posts', n.posts,
    'sem_procedente', n.sem_procedente, 'links', n.links, 'imagens', least(n.imagens, interno.rede_p4c_imagens()), 'posts_dia', n.posts_dia) order by n.nivel), '[]'::jsonb)
  from rede_niveis n
); end $function$
;

CREATE OR REPLACE FUNCTION public.rede_mod_meu_nivel()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'interno', 'pg_temp'
AS $function$begin perform interno.alumia_porta(); 
declare v uuid := interno.eu(); v_n smallint := interno.rede3_mod_nivel(v); a rede_niveis; p rede_niveis;
begin
  select * into a from rede_niveis where nivel = v_n;
  select * into p from rede_niveis where nivel = v_n + 1 and automatico;
  return jsonb_build_object(
    'nivel', v_n, 'nome', a.nome, 'lider', exists (select 1 from rede_lideres l where l.usuario = v),
    'dados', interno.rede3_mod_dados(v),
    'procedentes_90', interno.rede3_mod_procedentes(v, 90),
    'atual', to_jsonb(a) || jsonb_build_object('imagens', least(a.imagens, interno.rede_p4c_imagens())),
    'proximo', case when p.nivel is not null then to_jsonb(p) || jsonb_build_object('imagens', least(p.imagens, interno.rede_p4c_imagens())) end,
    'proximo_sem_procedente', case when p.nivel is not null then interno.rede3_mod_procedentes(v, p.sem_procedente) = 0 end);
end
; end $function$
;

-- A imagem que entra num post respeita o nível de quem escreveu (interno.rede3_mod_antes_da_midia, de sempre) e o rede_publicar
-- abaixo respeita o teto do álbum: as duas regras juntas dão o menor dos dois.

-- O teto de imagens do rede_publicar, do separar da onda 12 e da correção (descrições e imagens a tirar) passa a ser
-- interno.rede_p4c_imagens() (20 com o interruptor, 10 sem ele). As três são redefinidas INTEIRAS, com o corpo que estava valendo no
-- banco montado (install.sql do ramo, versão 18, depois do Prompt 5 e da primeira junção do Prompt 4), tirado por pg_get_functiondef;
-- a única mudança em cada uma é o teto. Funções existentes redefinidas aqui: public.rede_publicar(jsonb),
-- interno.rede_o12_separar(jsonb, uuid), public.rede_pub_corrigir(uuid, jsonb) e interno.rede_texto_limpo(text).

CREATE OR REPLACE FUNCTION public.rede_publicar(p jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'interno', 'pg_temp'
AS $function$begin perform interno.alumia_porta(); 
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
       -- p4-136: sem anexo aberto
       or jsonb_array_length(v_midia) > 0 or v_audio is not null
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

  if jsonb_array_length(v_midia) > interno.rede_p4c_imagens() then perform interno.erro('invalido:midia'); end if;
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
; end $function$
;

CREATE OR REPLACE FUNCTION interno.rede_o12_separar(p jsonb, p_autor uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'interno', 'pg_temp'
AS $function$
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
    if jsonb_array_length(v_midia) > interno.rede_p4c_imagens() then perform interno.erro('invalido:midia'); end if;
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
end $function$
;

CREATE OR REPLACE FUNCTION public.rede_pub_corrigir(p_post uuid, p jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'interno', 'pg_temp'
AS $function$begin perform interno.alumia_porta(); 
declare
  v uuid := interno.eu(); x rede_posts; v_aviso text; v_mudou boolean := false; v_item jsonb; v_id uuid; v_alt text; v_tirados jsonb := '[]'::jsonb; v_cam text; v_citar text;
begin
  perform interno.aberta('comunidade');
  if p is null or jsonb_typeof(p) is distinct from 'object' then perform interno.erro('invalido:post'); end if;
  select * into x from rede_posts where id = p_post for update;
  if not found or x.autor is distinct from v or x.apagado_em is not null or x.tipo = 'aviso' then perform interno.erro('sem_permissao'); end if;
  if not coalesce((select rede_18 from perfis where id = v), false) then perform interno.erro('confirme_idade'); end if;
  if not interno.rede2_membro(v) then perform interno.erro('consentimento'); end if;
  perform interno.rede2_limite('editar');

  if p ? 'aviso' then
    v_aviso := left(btrim(coalesce(p ->> 'aviso', '')), 80);
    if interno.rede3_pub_dado_pessoal(v_aviso) then perform interno.erro('dado_pessoal'); end if;
    if v_aviso is distinct from coalesce(x.aviso, '') then
      update rede_posts set aviso = v_aviso where id = x.id;
      v_mudou := true;
    end if;
  end if;

  if p ? 'alts' then
    if jsonb_typeof(p -> 'alts') <> 'array' or jsonb_array_length(p -> 'alts') > interno.rede_p4c_imagens() then perform interno.erro('invalido:alts'); end if;
    for v_item in select * from jsonb_array_elements(p -> 'alts') loop
      begin
        v_id := (v_item ->> 'id')::uuid;
      exception when others then perform interno.erro('invalido:alts');
      end;
      v_alt := left(btrim(coalesce(v_item ->> 'alt', '')), 1000);
      if interno.rede3_pub_dado_pessoal(v_alt) then perform interno.erro('dado_pessoal'); end if;
      update rede_midia set alt = v_alt where id = v_id and post = x.id and alt is distinct from v_alt;
      if found then v_mudou := true; end if;
    end loop;
  end if;

  if p ? 'tirar' then
    if jsonb_typeof(p -> 'tirar') <> 'array' or jsonb_array_length(p -> 'tirar') > interno.rede_p4c_imagens() then perform interno.erro('invalido:tirar'); end if;
    for v_item in select * from jsonb_array_elements(p -> 'tirar') loop
      begin
        v_id := (v_item #>> '{}')::uuid;
      exception when others then perform interno.erro('invalido:tirar');
      end;
      delete from rede_midia where id = v_id and post = x.id returning caminho into v_cam;
      if v_cam is not null then
        v_tirados := v_tirados || to_jsonb(v_cam);
        v_mudou := true;
        v_cam := null;
      end if;
    end loop;
    -- As que ficam voltam a ser 0, 1, 2… (a ordem é única por post).
    -- Uma por vez, da menor para a maior: cada uma desce para uma vaga já livre (a ordem é única por post).
    for v_item in select to_jsonb(z) from (select id, (row_number() over (order by ordem))::integer - 1 as n, ordem from rede_midia where post = x.id order by ordem) z loop
      if (v_item ->> 'ordem')::integer <> (v_item ->> 'n')::integer then
        update rede_midia set ordem = (v_item ->> 'n')::smallint where id = (v_item ->> 'id')::uuid;
      end if;
    end loop;
  end if;

  if p ? 'citar_quem' then
    v_citar := p ->> 'citar_quem';
    if v_citar not in ('ninguem', 'seguindo', 'todos') or x.resposta_a is not null then perform interno.erro('invalido:citar_quem'); end if;
    insert into rede_b1_post (post, citar_quem) values (x.id, v_citar) on conflict (post) do update set citar_quem = excluded.citar_quem;
  end if;

  if v_mudou and x.criado_em < now() - interval '15 minutes' then
    update rede_posts set editado_em = now() where id = x.id;
  end if;
  select * into x from rede_posts where id = x.id;
  return jsonb_build_object('post', interno.rede_post_v2(x, v, true), 'tirados', v_tirados);
exception when check_violation then perform interno.erro('invalido:post');
end
; end $function$
;

-- O texto longo põe no meio as imagens do próprio post: "![descrição](imagem:1)" até "(imagem:20)" (eram 1 a 4, mesmo depois das 10
-- da onda 12). A mesma regra do aparelho (lib/rede/texto/limpar.ts). Corpo de antes, inteiro, só com a faixa trocada.
CREATE OR REPLACE FUNCTION interno.rede_texto_limpo(p text)
 RETURNS text
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO 'interno', 'pg_temp'
AS $function$
  select regexp_replace(
           regexp_replace(
             regexp_replace(regexp_replace(coalesce(p, ''), '\r\n?', E'\n', 'g'),
               '[\u0001-\u0008\u000B\u000C\u000E-\u001F\u007F\u202A-\u202E\u2066-\u2069]', '', 'g'),
             '!\[([^]\n]{0,255})\]\((?!imagem:(?:[1-9]|1[0-9]|20)\))(?:[^()\n]|\([^()\n]*\))*\)', '\1', 'g'),
           '\]\(\s*(?!https?://[^\s()/@\\]+(?:[/?#](?:[^\s()\\]|\([^\s()\\]*\))*)?\)|/(?![/\\])(?:[^\s()\\]|\([^\s()\\]*\))*\)|imagem:(?:[1-9]|1[0-9]|20)\)|#\))(?:[^()\n]|\([^()\n]*\))*\)', '](#)', 'gi')
$function$
;

-- ── 2. As tabelas ──────────────────────────────────────────────────────────────────────────────────────────────────────────

/** O que o compositor do prompt 4 guardou num post. Só existe linha quando há escolha. */
create table if not exists interno.rede_p4c_post (
  post uuid primary key references interno.rede_posts (id) on delete cascade,
  -- 117: a versão curta (só no texto longo).
  resumo text check (resumo is null or char_length(resumo) between 1 and 280),
  -- 26: a capa do artigo, pela ordem da imagem no post (0 é a primeira).
  capa smallint check (capa is null or capa between 0 and 19),
  -- 29: o post é um convite ("Mande a sua").
  convite boolean not null default false,
  criado_em timestamptz not null default now(),
  check (resumo is not null or capa is not null or convite)
);

/** As escolhas do prompt 4 de um post agendado (aplicadas quando ele sai). */
create table if not exists interno.rede_p4c_agendado (
  agendado uuid primary key references interno.rede_agendados (id) on delete cascade,
  autor uuid not null references interno.perfis (id) on delete cascade,
  extras jsonb not null default '{}'::jsonb check (jsonb_typeof(extras) = 'object')
);

alter table interno.rede_p4c_post enable row level security;
alter table interno.rede_p4c_agendado enable row level security;
revoke all on table interno.rede_p4c_post, interno.rede_p4c_agendado from public;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on table interno.rede_p4c_post, interno.rede_p4c_agendado from anon, authenticated;
  end if;
end $$;

/** Nada do prompt 4 se liga a um post cifrado (a versão curta, a capa e o convite são abertos). */
create or replace function interno.rede_p4c_sem_cifra() returns trigger language plpgsql set search_path = interno, pg_temp as $$
begin
  if exists (select 1 from interno.rede_posts p where p.id = new.post and p.corpo_grupo is not null) then
    perform interno.erro('invalido:grupo');
  end if;
  return new;
end $$;
revoke all on function interno.rede_p4c_sem_cifra() from public;
drop trigger if exists p4c_sem_cifra on interno.rede_p4c_post;
create trigger p4c_sem_cifra before insert or update of post on interno.rede_p4c_post for each row execute function interno.rede_p4c_sem_cifra();

-- ── 3. As peças de dentro ──────────────────────────────────────────────────────────────────────────────────────────────────

/**
 * Quantos capítulos tem um texto longo: cada título ("# " ou "## " no começo da linha) abre um; o "### " é subtítulo e fica dentro.
 * É a mesma regra da tela (capitulosDoTexto, lib/rede/texto/formatado.ts), sem olhar bloco de código: serve só para o "N capítulos"
 * da linha; o índice de verdade é o da tela.
 */
create or replace function interno.rede_p4c_capitulos(p_corpo text) returns integer language sql immutable set search_path = interno, pg_temp as $$
  select coalesce((select count(*)::integer from regexp_matches(coalesce(p_corpo, ''), '(^|\n) {0,3}#{1,2}[ \t]+\S', 'g')), 0)
$$;

/**
 * Separa do pedido o que é do prompt 4 e confere: { pedido (o que segue para a onda 12), extras }.
 *   p.resumo   a versão curta, até 280 letras, só no texto longo (tipo 'discussao' ou 'duvida');
 *   p.capa     a ordem da imagem que é a capa (0 a 19), só no texto longo com imagem;
 *   p.convite  true: o post é um convite "Mande a sua" (só post de abertura, tipo 'post');
 *   p.fonte    { link?, vale? }: a fonte do post (só post de abertura).
 * Desligado: 'desligado'. No post cifrado: 'invalido:grupo'. Dado pessoal na versão curta: 'dado_pessoal'; triagem que mandaria
 * para a mediação: 'resumo_revisar' (no modo de segurança, em que tudo passa pela mediação, segue com o post).
 */
create or replace function interno.rede_p4c_separar(p jsonb, p_autor uuid) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare
  v_tipo text := coalesce(nullif(btrim(coalesce(p ->> 'tipo', '')), ''), 'post');
  v_resposta boolean := nullif(btrim(coalesce(p ->> 'resposta_a', '')), '') is not null;
  v_resumo text; v_capa integer; v_convite boolean := false; v_link text; v_vale text; v_tri jsonb; v_n integer;
begin
  if p is null or jsonb_typeof(p) is distinct from 'object' then perform interno.erro('invalido:post'); end if;
  if not (p ? 'resumo' or p ? 'capa' or p ? 'convite' or p ? 'fonte') then
    return jsonb_build_object('pedido', p, 'extras', '{}'::jsonb);
  end if;
  if not interno.rede_p4c_ligada() then perform interno.erro('desligado'); end if;
  if nullif(btrim(coalesce(p ->> 'grupo', '')), '') is not null or nullif(btrim(coalesce(p ->> 'corpo_grupo', '')), '') is not null then
    perform interno.erro('invalido:grupo');
  end if;

  -- 117: a versão curta.
  if p ? 'resumo' and jsonb_typeof(p -> 'resumo') <> 'null' then
    if jsonb_typeof(p -> 'resumo') <> 'string' then perform interno.erro('invalido:resumo'); end if;
    v_resumo := nullif(btrim(p ->> 'resumo'), '');
    if v_resumo is not null then
      if v_tipo not in ('discussao', 'duvida') or char_length(v_resumo) > 280 then perform interno.erro('invalido:resumo'); end if;
      if interno.rede3_pub_dado_pessoal(v_resumo) then perform interno.erro('dado_pessoal'); end if;
      v_tri := interno.rede_triagem(v_resumo, p_autor);
      if ((v_tri ->> 'veredito') <> 'publicar' and coalesce(v_tri ->> 'motivo', '') <> 'modo_seguranca')
         or interno.normal(v_resumo) ~ '(^|[^a-z])(macaco|crioulo|viado|bicha|sapatao|retardado|mongoloide|vagabunda|nordestino imundo|judeu imundo|negro imundo)([^a-z]|$)' then
        perform interno.erro('resumo_revisar');
      end if;
    end if;
  end if;

  -- 26: a capa do artigo.
  if p ? 'capa' and jsonb_typeof(p -> 'capa') <> 'null' then
    if jsonb_typeof(p -> 'capa') <> 'number' then perform interno.erro('invalido:capa'); end if;
    begin
      v_capa := (p ->> 'capa')::integer;
    exception when others then perform interno.erro('invalido:capa');
    end;
    v_n := case when jsonb_typeof(p -> 'midia') = 'array' then jsonb_array_length(p -> 'midia') else 0 end;
    if v_tipo not in ('discussao', 'duvida') or v_capa is null or v_capa < 0 or v_capa >= v_n then perform interno.erro('invalido:capa'); end if;
  end if;

  -- 29: o convite.
  if p ? 'convite' and jsonb_typeof(p -> 'convite') <> 'null' then
    if jsonb_typeof(p -> 'convite') <> 'boolean' then perform interno.erro('invalido:convite'); end if;
    v_convite := (p ->> 'convite')::boolean;
    if v_convite and (v_resposta or v_tipo <> 'post') then perform interno.erro('invalido:convite'); end if;
  end if;

  -- 118: a fonte (as mesmas regras do rede_fonte_dar).
  if p ? 'fonte' and jsonb_typeof(p -> 'fonte') <> 'null' then
    if jsonb_typeof(p -> 'fonte') <> 'object' or v_resposta then perform interno.erro('invalido:fonte'); end if;
    v_link := nullif(btrim(coalesce(p -> 'fonte' ->> 'link', '')), '');
    v_vale := nullif(lower(btrim(coalesce(p -> 'fonte' ->> 'vale', ''))), '');
    if v_link is null and v_vale is null then perform interno.erro('invalido:fonte'); end if;
    if v_link is not null and (char_length(v_link) < 10 or char_length(v_link) > 500 or v_link !~* '^https?://[^/@\s]+(/\S*)?$'
       or v_link ~* '[?&](utm_[a-z_]+|fbclid|gclid|dclid|gbraid|wbraid|msclkid|mc_[a-z]+|igshid|igsh|si|ref_src|ref_url|_hsenc|_hsmi|yclid|twclid|ttclid|s_cid|mkt_tok)=') then
      perform interno.erro('invalido:fonte');
    end if;
    if v_vale is not null and (v_vale !~ '^[a-z0-9][a-z0-9-]{1,79}$'
       or (to_regprocedure('interno.rede_vale_citavel(text)') is not null and not interno.rede_vale_citavel(v_vale))) then
      perform interno.erro('invalido:vale');
    end if;
  end if;

  return jsonb_build_object(
    'pedido', p - 'resumo' - 'capa' - 'convite' - 'fonte',
    'extras', jsonb_strip_nulls(jsonb_build_object(
      'resumo', v_resumo,
      'capa', v_capa,
      'convite', case when v_convite then true end,
      'fonte', case when v_link is not null or v_vale is not null then jsonb_strip_nulls(jsonb_build_object('link', v_link, 'vale', v_vale)) end)));
end $$;

/** Grava as escolhas num post da própria autora. */
create or replace function interno.rede_p4c_aplicar(p_post uuid, p_autor uuid, p_extras jsonb) returns void language plpgsql security definer set search_path = interno, pg_temp as $$
begin
  if p_post is null or p_extras is null or p_extras = '{}'::jsonb then return; end if;
  if not exists (select 1 from rede_posts where id = p_post and autor = p_autor) then return; end if;
  if p_extras ? 'resumo' or p_extras ? 'capa' or p_extras ? 'convite' then
    insert into rede_p4c_post (post, resumo, capa, convite)
    values (p_post, p_extras ->> 'resumo', (p_extras ->> 'capa')::smallint, coalesce((p_extras ->> 'convite')::boolean, false))
    on conflict (post) do update set resumo = excluded.resumo, capa = excluded.capa, convite = excluded.convite;
  end if;
  if jsonb_typeof(p_extras -> 'fonte') = 'object' and to_regclass('interno.rede_fontes') is not null then
    insert into rede_fontes (post, link, vale) values (p_post, p_extras -> 'fonte' ->> 'link', p_extras -> 'fonte' ->> 'vale')
    on conflict (post) do update set link = excluded.link, vale = excluded.vale, dada_em = now();
  end if;
end $$;

-- ── 4. As funções da tela ──────────────────────────────────────────────────────────────────────────────────────────────────

/**
 * Publicar com as escolhas do prompt 4 (versão curta, capa, convite, fonte) por cima de public.rede_pub_o12_publicar, que segue
 * conferindo tudo (arranjo, legendas, roda, não listado, prazo, dado pessoal, triagem). Devolve o post, mais `p4` (o que gravou).
 */
create or replace function public.rede_pub_p4_publicar(p jsonb) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); v_sep jsonb; v_post jsonb;
begin
  perform interno.aberta('comunidade');
  v_sep := interno.rede_p4c_separar(p, v);
  v_post := public.rede_pub_o12_publicar(v_sep -> 'pedido');
  perform interno.rede_p4c_aplicar((v_post ->> 'id')::uuid, v, v_sep -> 'extras');
  return v_post || jsonb_build_object('p4', v_sep -> 'extras');
end $$;

/** Agendar com as escolhas do prompt 4: o agendar da onda 12 (fuso escolhido), e as escolhas valem quando o post sair. */
create or replace function public.rede_pub_p4_agendar(p jsonb, p_local text, p_fuso text, p_opcoes jsonb) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); v_sep jsonb; v_r jsonb;
begin
  perform interno.aberta('comunidade');
  v_sep := interno.rede_p4c_separar(p, v);
  v_r := public.rede_pub_o12_agendar(v_sep -> 'pedido', p_local, p_fuso, p_opcoes);
  if v_sep -> 'extras' <> '{}'::jsonb then
    insert into rede_p4c_agendado (agendado, autor, extras) values ((v_r ->> 'id')::uuid, v, v_sep -> 'extras')
    on conflict (agendado) do update set extras = excluded.extras;
  end if;
  return v_r;
end $$;

/**
 * Por lote (até 50 ids): o que o prompt 4 guardou em cada post que a pessoa pode ver:
 *   { resumo, capa (o id da imagem), capitulos (só a partir de 2), convite, total (pessoas diferentes que responderam ao convite,
 *     nulo abaixo de 3), fonte: { link, vale } }.
 * Post sem nada não aparece. Desligado: {}. Nunca diz quem respondeu.
 */
create or replace function public.rede_pub_p4_extras(p_ids uuid[]) returns jsonb language plpgsql stable security definer set search_path = interno, pg_temp as $$
declare v uuid := auth.uid(); r jsonb := '{}'::jsonb; p rede_posts; e rede_p4c_post; v_capa uuid; v_cap integer; v_total integer; v_fonte jsonb; v_item jsonb;
begin
  if p_ids is null or not interno.rede_p4c_ligada() then return r; end if;
  for p in select * from rede_posts where id = any (p_ids[1:50]) and apagado_em is null loop
    continue when not interno.rede_ve(p, v);
    continue when p.corpo_grupo is not null;
    continue when (p.oculto or p.retido) and p.autor is distinct from v;
    e := null; v_capa := null; v_total := null; v_fonte := null;
    select * into e from rede_p4c_post where post = p.id;
    if e.capa is not null then select m.id into v_capa from rede_midia m where m.post = p.id and m.ordem = e.capa; end if;
    v_cap := case when p.tipo in ('discussao', 'duvida') then interno.rede_p4c_capitulos(p.corpo) else 0 end;
    if coalesce(e.convite, false) then
      select count(distinct x.autor)::integer into v_total from rede_posts x
      where x.resposta_a = p.id and x.apagado_em is null and not x.oculto and not x.retido and x.autor is distinct from p.autor;
      if v_total < 3 then v_total := null; end if;
    end if;
    if to_regclass('interno.rede_fontes') is not null then
      select jsonb_strip_nulls(jsonb_build_object('link', f.link, 'vale', f.vale)) into v_fonte from rede_fontes f where f.post = p.id;
    end if;
    v_item := jsonb_strip_nulls(jsonb_build_object(
      'resumo', e.resumo,
      'capa', v_capa,
      'capitulos', case when v_cap >= 2 then v_cap end,
      'convite', case when coalesce(e.convite, false) then true end,
      'total', v_total,
      'fonte', v_fonte));
    continue when v_item = '{}'::jsonb;
    r := r || jsonb_build_object(p.id::text, v_item);
  end loop;
  return r;
end $$;

-- ── 5. O agendado que sai ──────────────────────────────────────────────────────────────────────────────────────────────────
create or replace function interno.rede_p4c_agendado_saiu() returns trigger language plpgsql security definer set search_path = interno, pg_temp as $$
declare g rede_p4c_agendado;
begin
  if new.estado <> 'publicado' or old.estado = 'publicado' or new.post is null then return null; end if;
  select * into g from rede_p4c_agendado where agendado = new.id;
  if found then
    begin
      perform interno.rede_p4c_aplicar(new.post, new.autor, g.extras);
    exception when others then null;
    end;
  end if;
  return null;
end $$;
drop trigger if exists rede_p4c_agendado_saiu on interno.rede_agendados;
create trigger rede_p4c_agendado_saiu after update of estado on interno.rede_agendados for each row execute function interno.rede_p4c_agendado_saiu();

-- ── 6. Permissões ──────────────────────────────────────────────────────────────────────────────────────────────────────────
do $$
declare r record;
begin
  for r in
    select p.oid::regprocedure as f from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'interno' and p.proname like 'rede\_p4c\_%'
  loop
    execute format('revoke all on function %s from public', r.f);
    if exists (select 1 from pg_roles where rolname = 'anon') then execute format('revoke all on function %s from anon, authenticated', r.f); end if;
  end loop;
  for r in
    select p.oid::regprocedure as f, p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname like 'rede\_pub\_p4\_%'
  loop
    execute format('revoke all on function %s from public', r.f);
    if exists (select 1 from pg_roles where rolname = 'anon') then
      execute format('revoke all on function %s from anon', r.f);
      execute format('grant execute on function %s to authenticated, service_role', r.f);
      if r.proname = 'rede_pub_p4_extras' then execute format('grant execute on function %s to anon', r.f); end if;
    end if;
  end loop;
end $$;

select interno.alumia_trancar();
