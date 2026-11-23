-- ───────────────────────────── Prompt 5 (A16): stories, foto em alta com versão menor, teste com resposta certa e contagem livre ─────────────────────────────
-- Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
--
-- Roda depois de 20261125-r3-fim.sql (banco na versão 16) e das migrações do Prompt 5 que vêm antes no install.sql; o
-- 20261126-p5-fim.sql vem por último. Pode rodar mais de uma vez, sem apagar dado nenhum.
-- Teste: npm run testar:p5-stories-mais.
--
-- 1. FOTO EM ALTA E VERSÃO MENOR. A foto do story sai do aparelho em alta (até 1440 × 2560, até 6 MB) e, junto, numa versão menor
--    (540 × 960, até 512 KB) para a capa do destaque e para a tela abrir na hora enquanto a alta chega. As duas são refeitas no
--    aparelho (sem metadado) e as duas passam pela conferência do servidor. A versão menor mora em rede_stories.midia_menor e tem a
--    mesma regra de leitura da alta (public.rede_story_pode): quem não vê o story não abre nenhuma das duas. Trocar a foto (borrar
--    de novo) tira a versão menor, para a de antes do borrado não continuar no ar.
--    A faxina (supabase/functions/faxina-stories) recebe a versão menor como mais uma linha da lista, com o mesmo id: a função de
--    hoje, sem mudar nada, confere e apaga as duas. O arquivo que nenhum story cita (a versão menor de um story apagado) sai como
--    órfão, como sempre.
-- 2. TESTE COM RESPOSTA CERTA (figurinha "teste"): uma pergunta, de 2 a 4 opções e qual é a certa. A resposta segue o caminho da
--    enquete do story: chega só pelo servidor do site (app/api/alumia/voto/marca, tipo "teste"), que grava a marca HMAC de "já
--    respondeu"; a opção vai para uma urna sem pessoa, regravada em ordem sorteada. Ninguém (nem a autora, nem a coordenação) vê
--    quem respondeu nem o que cada pessoa respondeu. A autora vê só a soma por opção, a partir de 3 respostas. Quem vê o story só
--    fica sabendo qual era a certa DEPOIS de responder (o que este aparelho escolheu fica nele).
-- 3. CONTAGEM LIVRE: a contagem regressiva pode ser para um momento que não é um ato da Alumia (uma plenária, uma greve, uma
--    data), com nome e hora escritos pela autora, até um ano à frente. Sem "me avise" (o lembrete é do ato).
--
-- Redefine (a definição COMPLETA, tirada do banco montado com o install.sql deste ramo, com as mudanças acima):
-- public.rede_story_publicar(jsonb), interno.rede5_story_figurinha(...), interno.rede5_story_json(...), public.rede_story_pode(text),
-- public.rede_story_trocar_midia(uuid, text), public.rede_story_destaques(text), public.rede_story_faxina_lista(integer),
-- public.rede_story_conferir_pedir(uuid) e public.rede_story_pode_enviar() (60 arquivos em 24 h: a foto agora vai em dois).
-- Funções novas: interno.rede_story_teste_urna(uuid, smallint), public.rede_story_testar(uuid, integer) (só diz que vai pelo
-- servidor) e public.alumia_teste_story(uuid, uuid, integer, text) (só a chave de serviço). Tabelas novas:
-- interno.rede_story_teste_marcas e interno.rede_story_teste_urna. Não mexe em rede_alumia_versao nem na lista de exceções da
-- porta. Termina trancando tudo na porta.

-- ── 1. As colunas e as tabelas ──────────────────────────────────────────────────────────────────────────────────────────────

alter table interno.rede_stories add column if not exists midia_menor text;
alter table interno.rede_stories drop constraint if exists rede_stories_midia_menor;
alter table interno.rede_stories add constraint rede_stories_midia_menor check (midia_menor is null or (
  fundo = 'imagem' and midia_menor <> midia_caminho
  and midia_menor ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f-]{32,36}\.(webp|png|jpg)$'));
create unique index if not exists rede_stories_midia_menor on interno.rede_stories (midia_menor) where midia_menor is not null;

alter table interno.rede_story_figurinhas drop constraint if exists rede_story_figurinhas_tipo_check;
alter table interno.rede_story_figurinhas add constraint rede_story_figurinhas_tipo_check
  check (tipo in ('contagem', 'pergunta', 'enquete', 'link', 'comunidade', 'decorativa', 'resposta', 'vou', 'pessoa', 'campanha', 'teste'));

-- Quem já respondeu o teste de um story: só a marca HMAC do servidor (nunca a pessoa).
create table if not exists interno.rede_story_teste_marcas (
  story uuid not null references interno.rede_stories (id) on delete cascade,
  marca text not null check (marca ~ '^[0-9a-f]{64}$'),
  primary key (story, marca)
);
-- As respostas do teste: só a opção, sem pessoa, regravadas em ordem sorteada a cada resposta.
create table if not exists interno.rede_story_teste_urna (
  story uuid not null references interno.rede_stories (id) on delete cascade,
  opcao smallint not null check (opcao between 0 and 3)
);
create index if not exists rede_story_teste_urna_story on interno.rede_story_teste_urna (story);
alter table interno.rede_story_teste_urna set (autovacuum_vacuum_threshold = 0, autovacuum_vacuum_scale_factor = 0);
do $$
declare t text;
begin
  foreach t in array array['rede_story_teste_marcas', 'rede_story_teste_urna'] loop
    execute format('alter table interno.%I enable row level security', t);
    execute format('revoke all on interno.%I from public', t);
    if exists (select 1 from pg_roles where rolname = 'anon') then
      execute format('revoke all on interno.%I from anon, authenticated', t);
    end if;
  end loop;
end $$;

-- ── 2. Publicar: a versão menor, o teste e a contagem livre ─────────────────────────────────────────────────────────────────

create or replace function public.rede_story_publicar(p jsonb) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare
  v uuid := interno.rede5_story_membro();
  v_publico text := coalesce(p ->> 'publico', 'seguidores');
  v_fundo text := coalesce(p -> 'fundo' ->> 'tipo', 'listras');
  v_cor text := coalesce(p -> 'fundo' ->> 'cor', 'azul');
  v_texto text; v_legenda text; v_alt text; v_imagem text := nullif(btrim(coalesce(p ->> 'imagem', '')), '');
  v_menor text := nullif(btrim(coalesce(p ->> 'menor', '')), '');
  v_post uuid; pr rede_posts; v_figs jsonb := coalesce(p -> 'figurinhas', '[]'::jsonb);
  f jsonb; v_tipo text; v_limpas jsonb := '[]'::jsonb; v_tudo text := ''; v_ato uuid; v_titulo text; v_inicio timestamptz; v_cidade text;
  v_url text; v_rotulo text; v_perg text; v_op0 text; v_op1 text; v_enquetes integer := 0; v_contagens integer := 0; v_comunidades integer := 0;
  v_interativas integer := 0; v_decorativas integer := 0; v_vous integer := 0; v_pessoas integer := 0; v_campanhas integer := 0; v_respostas integer := 0;
  v_testes integer := 0; v_ops jsonb; v_op text; v_certa integer;
  v_tam bigint; v_mime text; s rede_stories; i integer := 0; v_duracao integer; v_som boolean := false; v_estilo jsonb; c rede_comunidades;
  v_comunidade text; v_legendas jsonb := '[]'::jsonb; v_musica text; v_resp uuid; v_rtexto text; v_quem uuid; v_tag text; v_mencionadas uuid[] := '{}';
  v_slug_mencao text;
begin
  if p is null or jsonb_typeof(p) is distinct from 'object' then perform interno.erro('invalido:pedido'); end if;
  if v_publico not in ('seguidores', 'membros', 'proximos', 'comunidade') then perform interno.erro('invalido:publico'); end if;
  if v_fundo not in ('listras', 'mosaico', 'imagem', 'video') then perform interno.erro('invalido:fundo'); end if;
  if v_cor not in ('azul', 'vermelho', 'dourado', 'verde', 'rosa', 'noite') then perform interno.erro('invalido:cor'); end if;
  if not exists (select 1 from perfis where id = v and rede_handle is not null) then perform interno.erro('sem_handle'); end if;
  v_texto := interno.txt(p ->> 'texto', 'texto', 0, 140);
  v_legenda := nullif(interno.txt(p ->> 'legenda', 'legenda', 0, 80), '');
  v_alt := nullif(interno.txt(p ->> 'alt', 'alt', 0, 200), '');
  v_estilo := interno.rede5_story_estilo(p -> 'estilo');
  if jsonb_typeof(v_figs) is distinct from 'array' or jsonb_array_length(v_figs) > 6 then perform interno.erro('invalido:figurinhas'); end if;

  -- O público "só esta comunidade": só de uma comunidade em que sou membro ativa.
  if v_publico = 'comunidade' then
    v_comunidade := nullif(btrim(coalesce(p ->> 'comunidade', '')), '');
    if v_comunidade is null or not exists (select 1 from rede_comunidade_membros m where m.comunidade = v_comunidade and m.usuario = v and m.situacao = 'ativo') then
      perform interno.erro('invalido:comunidade');
    end if;
  end if;

  -- A mídia: imagem ou vídeo exigem o caminho, e o caminho só vale com um dos dois.
  if (v_fundo in ('imagem', 'video')) <> (v_imagem is not null) then perform interno.erro('invalido:imagem'); end if;
  if v_fundo = 'video' then
    begin v_duracao := round((p -> 'video' ->> 'duracao_ms')::numeric)::integer; exception when others then v_duracao := null; end;
    if v_duracao is null or v_duracao not between 300 and 60500 then perform interno.erro('invalido:video'); end if;
    v_som := coalesce((p -> 'video' ->> 'som')::boolean, false);
    v_musica := nullif(p -> 'video' ->> 'musica', '');
    if v_musica is not null and v_musica not in ('batucada', 'marcha', 'ciranda', 'tambor') then perform interno.erro('invalido:musica'); end if;
    v_legendas := interno.rede5_story_legendas(p -> 'video' -> 'legendas', v_duracao);
    select v_tudo || coalesce(string_agg(x ->> 'texto', E'\n'), '') into v_tudo from jsonb_array_elements(v_legendas) x;
  elsif jsonb_typeof(p -> 'video') = 'object' and (nullif(p -> 'video' ->> 'musica', '') is not null
        or (jsonb_typeof(p -> 'video' -> 'legendas') = 'array' and jsonb_array_length(p -> 'video' -> 'legendas') > 0)) then
    perform interno.erro('invalido:video');
  end if;
  if v_imagem is not null then
    if v_fundo = 'imagem' and v_imagem !~ ('^' || v::text || '/[0-9a-f-]{32,36}\.(webp|png|jpg)$') then perform interno.erro('invalido:imagem'); end if;
    if v_fundo = 'video' and v_imagem !~ ('^' || v::text || '/[0-9a-f-]{32,36}\.(mp4|webm)$') then perform interno.erro('invalido:video'); end if;
    if exists (select 1 from rede_stories where midia_caminho = v_imagem or midia_menor = v_imagem) then perform interno.erro('invalido:imagem'); end if;
    if to_regclass('storage.objects') is not null then
      execute 'select (metadata ->> ''size'')::bigint, metadata ->> ''mimetype'' from storage.objects where bucket_id = ''rede-stories'' and name = $1'
        into v_tam, v_mime using v_imagem;
      if v_mime is null then perform interno.erro('invalido:imagem'); end if;
      -- P5: a foto em alta vai até 6 MB (1440 × 2560); a versão menor vem à parte.
      if v_fundo = 'imagem' and (v_mime not in ('image/webp', 'image/png', 'image/jpeg') or coalesce(v_tam, 0) > 6291456) then perform interno.erro('invalido:imagem'); end if;
      if v_fundo = 'video' and (v_mime not in ('video/mp4', 'video/webm') or coalesce(v_tam, 0) > 20971520) then perform interno.erro('invalido:video'); end if;
    end if;
  else
    v_alt := null;
  end if;
  -- P5: a versão menor da foto (só com foto; outro arquivo da mesma pasta, nunca usado antes, até 512 KB).
  if v_menor is not null then
    if v_fundo <> 'imagem' or v_menor = v_imagem or v_menor !~ ('^' || v::text || '/[0-9a-f-]{32,36}\.(webp|png|jpg)$') then perform interno.erro('invalido:imagem'); end if;
    if exists (select 1 from rede_stories where midia_caminho = v_menor or midia_menor = v_menor) then perform interno.erro('invalido:imagem'); end if;
    if to_regclass('storage.objects') is not null then
      v_tam := null; v_mime := null;
      execute 'select (metadata ->> ''size'')::bigint, metadata ->> ''mimetype'' from storage.objects where bucket_id = ''rede-stories'' and name = $1'
        into v_tam, v_mime using v_menor;
      if v_mime is null or v_mime not in ('image/webp', 'image/png', 'image/jpeg') or coalesce(v_tam, 0) > 524288 then perform interno.erro('invalido:imagem'); end if;
    end if;
  end if;

  -- "Pôr no story": só um post que eu vejo.
  if nullif(p ->> 'post_ref', '') is not null then
    begin v_post := (p ->> 'post_ref')::uuid; exception when others then perform interno.erro('invalido:post'); end;
    select * into pr from rede_posts where id = v_post;
    if not found or pr.apagado_em is not null or not interno.rede2_pode_ver(pr, v) then perform interno.erro('nao_encontrado'); end if;
  end if;

  for f in select * from jsonb_array_elements(v_figs) loop
    v_tipo := f ->> 'tipo';
    if v_tipo = 'decorativa' then v_decorativas := v_decorativas + 1; else v_interativas := v_interativas + 1; end if;
    if v_tipo = 'contagem' then
      v_contagens := v_contagens + 1;
      if nullif(f ->> 'ato', '') is null and jsonb_typeof(f -> 'livre') = 'boolean' and (f ->> 'livre')::boolean then
        -- P5: a contagem livre (um momento que não é ato da Alumia): nome e hora da autora, de 1 minuto a 1 ano à frente.
        v_titulo := interno.txt(f ->> 'titulo', 'contagem', 1, 60);
        begin v_inicio := (f ->> 'inicio')::timestamptz; exception when others then v_inicio := null; end;
        if v_inicio is null or v_inicio < now() + interval '1 minute' or v_inicio > now() + interval '366 days' then perform interno.erro('invalido:contagem'); end if;
        v_tudo := v_tudo || E'\n' || v_titulo;
        v_limpas := v_limpas || jsonb_build_object('tipo', 'contagem', 'dados', jsonb_build_object('ato', null, 'titulo', v_titulo, 'inicio', v_inicio, 'livre', true));
      else
        begin v_ato := (f ->> 'ato')::uuid; exception when others then v_ato := null; end;
        if v_ato is null then perform interno.erro('invalido:contagem'); end if;
        select left(coalesce(nullif(btrim(x.titulo), ''), btrim(x.texto)), 60), ch.inicio into v_titulo, v_inicio
        from rede_chamados ch join rede_posts x on x.id = ch.post
        where ch.post = v_ato and ch.inicio > now() and not ch.cancelado and interno.rede2_pode_ver(x, v)
          and (x.autor = v or exists (select 1 from rede_vou u where u.post = x.id and u.usuario = v));
        if not found then perform interno.erro('invalido:contagem'); end if;
        v_limpas := v_limpas || jsonb_build_object('tipo', 'contagem', 'dados', jsonb_build_object('ato', v_ato, 'titulo', v_titulo, 'inicio', v_inicio));
      end if;
    elsif v_tipo = 'pergunta' then
      v_perg := interno.txt(f ->> 'texto', 'pergunta', 1, 90);
      v_tudo := v_tudo || E'\n' || v_perg;
      v_limpas := v_limpas || jsonb_build_object('tipo', 'pergunta', 'dados', jsonb_build_object('texto', v_perg));
    elsif v_tipo = 'enquete' then
      v_enquetes := v_enquetes + 1;
      if jsonb_typeof(f -> 'opcoes') is distinct from 'array' or jsonb_array_length(f -> 'opcoes') <> 2 then perform interno.erro('invalido:enquete'); end if;
      v_perg := interno.txt(f ->> 'pergunta', 'pergunta', 1, 90);
      v_op0 := interno.txt(f -> 'opcoes' ->> 0, 'opcao', 1, 24);
      v_op1 := interno.txt(f -> 'opcoes' ->> 1, 'opcao', 1, 24);
      if lower(v_op0) = lower(v_op1) then perform interno.erro('invalido:opcao'); end if;
      v_tudo := v_tudo || E'\n' || v_perg || E'\n' || v_op0 || E'\n' || v_op1;
      v_limpas := v_limpas || jsonb_build_object('tipo', 'enquete', 'dados', jsonb_build_object('pergunta', v_perg, 'opcoes', jsonb_build_array(v_op0, v_op1)));
    elsif v_tipo = 'teste' then
      -- P5: o teste com resposta certa (2 a 4 opções diferentes; a certa é uma delas).
      v_testes := v_testes + 1;
      if jsonb_typeof(f -> 'opcoes') is distinct from 'array' or jsonb_array_length(f -> 'opcoes') not between 2 and 4 then perform interno.erro('invalido:teste'); end if;
      v_perg := interno.txt(f ->> 'pergunta', 'pergunta', 1, 90);
      v_ops := '[]'::jsonb;
      for v_op in select interno.txt(x, 'opcao', 1, 24) from jsonb_array_elements_text(f -> 'opcoes') x loop
        if exists (select 1 from jsonb_array_elements_text(v_ops) y where lower(y) = lower(v_op)) then perform interno.erro('invalido:opcao'); end if;
        v_ops := v_ops || to_jsonb(v_op);
        v_tudo := v_tudo || E'\n' || v_op;
      end loop;
      begin v_certa := (f ->> 'certa')::integer; exception when others then v_certa := null; end;
      if v_certa is null or v_certa < 0 or v_certa >= jsonb_array_length(v_ops) then perform interno.erro('invalido:teste'); end if;
      v_tudo := v_tudo || E'\n' || v_perg;
      v_limpas := v_limpas || jsonb_build_object('tipo', 'teste', 'dados', jsonb_build_object('pergunta', v_perg, 'opcoes', v_ops, 'certa', v_certa));
    elsif v_tipo = 'link' then
      v_url := btrim(coalesce(f ->> 'url', ''));
      if v_url !~* '^https://[a-z0-9.-]+\.[a-z]{2,}(:[0-9]{2,5})?(/[^\s<>"]*)?$' or char_length(v_url) > 300 then perform interno.erro('invalido:link'); end if;
      v_rotulo := interno.txt(coalesce(f ->> 'rotulo', ''), 'rotulo', 0, 40);
      v_tudo := v_tudo || E'\n' || v_rotulo;
      v_limpas := v_limpas || jsonb_build_object('tipo', 'link', 'dados', jsonb_build_object('url', v_url, 'rotulo', v_rotulo));
    elsif v_tipo = 'comunidade' then
      v_comunidades := v_comunidades + 1;
      select * into c from rede_comunidades where slug = coalesce(f ->> 'slug', '');
      if not found or (c.tipo <> 'aberta' and not exists (select 1 from rede_comunidade_membros m where m.comunidade = c.slug and m.usuario = v and m.situacao = 'ativo')) then
        perform interno.erro('invalido:comunidade');
      end if;
      v_slug_mencao := c.slug;
      v_limpas := v_limpas || jsonb_build_object('tipo', 'comunidade', 'dados', jsonb_build_object('slug', c.slug, 'nome', c.nome));
    elsif v_tipo = 'decorativa' then
      if coalesce(f ->> 'nome', '') <> all (interno.rede5_story_decorativas()) then perform interno.erro('invalido:decorativa'); end if;
      v_limpas := v_limpas || jsonb_build_object('tipo', 'decorativa', 'dados', jsonb_build_object('nome', f ->> 'nome'));
    elsif v_tipo = 'resposta' then
      v_respostas := v_respostas + 1;
      begin v_resp := (f ->> 'resposta')::uuid; exception when others then v_resp := null; end;
      v_rtexto := null;
      select r.texto, (select g.dados ->> 'texto' from rede_story_figurinhas g where g.story = r.story and g.tipo = 'pergunta' order by g.ordem limit 1)
        into v_rtexto, v_perg
      from rede_story_respostas r join rede_stories x on x.id = r.story
      where r.id = v_resp and x.autor = v and r.pergunta;
      if v_rtexto is null or v_perg is null then perform interno.erro('invalido:resposta'); end if;
      v_tudo := v_tudo || E'\n' || v_rtexto;
      v_limpas := v_limpas || jsonb_build_object('tipo', 'resposta', 'dados', jsonb_build_object('pergunta', v_perg, 'texto', v_rtexto));
    elsif v_tipo = 'vou' then
      v_vous := v_vous + 1;
      begin v_ato := (f ->> 'ato')::uuid; exception when others then v_ato := null; end;
      v_titulo := null;
      select left(coalesce(nullif(btrim(coalesce(ch.titulo, '')), ''), nullif(btrim(coalesce(x.titulo, '')), ''), btrim(x.texto)), 60), ch.inicio, ch.cidade
        into v_titulo, v_inicio, v_cidade
      from rede_chamados ch join rede_posts x on x.id = ch.post
      where ch.post = v_ato and ch.inicio > now() - interval '6 hours' and not ch.cancelado and coalesce(ch.situacao, '') <> 'cancelado'
        and x.apagado_em is null and not x.oculto and not x.retido and interno.rede2_pode_ver(x, v);
      if v_titulo is null then perform interno.erro('invalido:vou'); end if;
      v_limpas := v_limpas || jsonb_build_object('tipo', 'vou', 'dados', jsonb_build_object('ato', v_ato, 'titulo', v_titulo, 'inicio', v_inicio, 'cidade', v_cidade));
    elsif v_tipo = 'pessoa' then
      v_pessoas := v_pessoas + 1;
      -- Quem está invisível, suspensa ou sem codinome aprovado não é achada (a mesma recusa de um @ que não existe).
      select x.id into v_quem from perfis x where x.rede_handle = regexp_replace(lower(btrim(coalesce(f ->> 'handle', ''))), '^@', '') and x.rede_handle is not null
        and x.rede_codinome_ok and not x.suspenso and not coalesce(x.rede_modo = 'invisivel' or x.rede_invisivel, false);
      if v_quem is null or v_quem = v or not interno.rede2_membro(v_quem) or interno.rede_bloqueado(v, v_quem) then perform interno.erro('invalido:pessoa'); end if;
      v_mencionadas := v_mencionadas || v_quem;
      v_limpas := v_limpas || jsonb_build_object('tipo', 'pessoa', 'dados', jsonb_build_object('perfil', v_quem));
    elsif v_tipo = 'campanha' then
      v_campanhas := v_campanhas + 1;
      v_tag := lower(regexp_replace(btrim(coalesce(f ->> 'tag', '')), '^#', ''));
      if v_tag !~ '^[a-z0-9_]{2,40}$' or v_tag !~ '[a-z_]' then perform interno.erro('invalido:campanha'); end if;
      v_tudo := v_tudo || E'\n' || v_tag;
      v_limpas := v_limpas || jsonb_build_object('tipo', 'campanha', 'dados', jsonb_build_object('tag', v_tag,
        'corrente', coalesce(jsonb_typeof(f -> 'corrente') = 'boolean' and (f ->> 'corrente')::boolean, false)));
    else
      perform interno.erro('invalido:figurinha');
    end if;
    if interno.rede5_story_pos(f -> 'pos') is not null then
      v_limpas := jsonb_set(v_limpas, array[(jsonb_array_length(v_limpas) - 1)::text, 'dados', 'pos'], interno.rede5_story_pos(f -> 'pos'));
    end if;
  end loop;
  if v_enquetes > 1 or v_contagens > 1 or v_comunidades > 1 or v_vous > 1 or v_pessoas > 1 or v_campanhas > 1 or v_respostas > 1 or v_testes > 1
     or v_interativas > 3 or v_decorativas > 3 then
    perform interno.erro('invalido:figurinhas');
  end if;
  if v_texto = '' and v_imagem is null and v_post is null and jsonb_array_length(v_limpas) = 0 then perform interno.erro('invalido:vazio'); end if;
  if interno.rede3_pub_dado_pessoal(v_texto || E'\n' || coalesce(v_legenda, '') || E'\n' || coalesce(v_alt, '') || v_tudo) then perform interno.erro('dado_pessoal'); end if;

  perform interno.limite('rede5_story_publicar', 20, 1440);
  insert into rede_stories (autor, publico, comunidade, fundo, cor, texto, legenda, midia_caminho, midia_menor, alt, post_ref, conferido, duracao_ms, som, estilo, legendas, musica)
  values (v, v_publico, v_comunidade, v_fundo, v_cor, v_texto, v_legenda, v_imagem, v_menor, v_alt, v_post, v_imagem is null, v_duracao, v_som, v_estilo, v_legendas, v_musica)
  returning * into s;
  for f in select * from jsonb_array_elements(v_limpas) loop
    insert into rede_story_figurinhas (story, ordem, tipo, dados) values (s.id, i, f ->> 'tipo', f -> 'dados');
    i := i + 1;
  end loop;

  -- A pessoa mencionada fica sabendo (se não desligou os avisos de menção). Quem ela é já estava no story; nada mais sai.
  foreach v_quem in array v_mencionadas loop
    if interno.rede3_aviso_pref(v_quem, 'mencao', 'site') then
      insert into avisos (para, texto, categoria, ator) values (v_quem, 'Você foi mencionada num story (some em 24 h).', 'rede', v);
    end if;
  end loop;
  -- A moderação da comunidade mencionada recebe UM aviso por dia, que só soma (sem dizer quem mencionou).
  if v_slug_mencao is not null then perform interno.rede5_story_avisar_mencao(v_slug_mencao); end if;
  return jsonb_build_object('id', s.id, 'expira_em', s.expira_em);
end $$;

-- ── 3. Como a figurinha e o story aparecem ──────────────────────────────────────────────────────────────────────────────────

create or replace function interno.rede5_story_figurinha(f interno.rede_story_figurinhas, s interno.rede_stories, p_quem uuid) returns jsonb language plpgsql stable security definer set search_path = interno, pg_temp as $$
declare v_ato uuid; p rede_posts; ch rede_chamados; v_n0 integer; v_n1 integer; c rede_comunidades; v_quem uuid; v_n bigint; v_soma jsonb;
begin
  if f.tipo = 'contagem' then
    begin v_ato := (f.dados ->> 'ato')::uuid; exception when others then v_ato := null; end;
    if v_ato is not null then
      select * into p from rede_posts where id = v_ato;
      if not found or not interno.rede2_pode_ver(p, p_quem) then v_ato := null; end if;
    end if;
    return jsonb_build_object('tipo', 'contagem', 'ato', v_ato, 'titulo', f.dados ->> 'titulo', 'inicio', f.dados ->> 'inicio',
      'avisar', v_ato is not null and exists (select 1 from rede_story_lembretes l where l.ato = v_ato and l.quem = p_quem))
      || case when coalesce(f.dados ->> 'livre', '') = 'true' then jsonb_build_object('livre', true) else '{}'::jsonb end;
  elsif f.tipo = 'pergunta' then
    return jsonb_build_object('tipo', 'pergunta', 'texto', f.dados ->> 'texto');
  elsif f.tipo = 'enquete' then
    if s.autor = p_quem then
      select count(*) filter (where opcao = 0)::integer, count(*) filter (where opcao = 1)::integer into v_n0, v_n1 from rede_story_votos where story = s.id;
    end if;
    return jsonb_build_object('tipo', 'enquete', 'pergunta', f.dados ->> 'pergunta', 'opcoes', f.dados -> 'opcoes',
      'meu_voto', (select v.opcao from rede_story_votos v where v.story = s.id and v.quem = p_quem and s.autor <> p_quem),
      'soma', case when s.autor = p_quem and v_n0 + v_n1 >= 3 then jsonb_build_array(v_n0, v_n1) end);
  elsif f.tipo = 'teste' then
    -- P5: quem vê recebe a pergunta e as opções, sem a certa (ela só chega na resposta, pelo servidor). A autora vê a certa e a
    -- soma por opção, só a partir de 3 respostas no total; ninguém vê quem respondeu nem o que cada pessoa respondeu.
    if s.autor is distinct from p_quem then
      return jsonb_build_object('tipo', 'teste', 'pergunta', f.dados ->> 'pergunta', 'opcoes', f.dados -> 'opcoes');
    end if;
    if (select count(*) from rede_story_teste_urna where story = s.id) >= 3 then
      select jsonb_agg(coalesce(x.n, 0) order by k.i) into v_soma
      from generate_series(0, jsonb_array_length(f.dados -> 'opcoes') - 1) k(i)
      left join (select opcao, count(*)::integer n from rede_story_teste_urna where story = s.id group by opcao) x on x.opcao = k.i;
    end if;
    return jsonb_build_object('tipo', 'teste', 'pergunta', f.dados ->> 'pergunta', 'opcoes', f.dados -> 'opcoes',
      'certa', (f.dados ->> 'certa')::integer, 'soma', v_soma);
  elsif f.tipo = 'comunidade' then
    select * into c from rede_comunidades where slug = f.dados ->> 'slug';
    if not found then return jsonb_build_object('tipo', 'comunidade', 'slug', null, 'nome', f.dados ->> 'nome'); end if;
    if c.tipo <> 'aberta' and not exists (select 1 from rede_comunidade_membros m where m.comunidade = c.slug and m.usuario = p_quem and m.situacao = 'ativo') then
      return jsonb_build_object('tipo', 'comunidade', 'slug', null, 'nome', c.nome);
    end if;
    return jsonb_build_object('tipo', 'comunidade', 'slug', c.slug, 'nome', c.nome);
  elsif f.tipo = 'decorativa' then
    return jsonb_build_object('tipo', 'decorativa', 'nome', f.dados ->> 'nome');
  elsif f.tipo = 'resposta' then
    -- A pergunta e a resposta, sem quem respondeu (a autora escolheu publicar; o nome nunca foi guardado aqui).
    return jsonb_build_object('tipo', 'resposta', 'pergunta', f.dados ->> 'pergunta', 'texto', f.dados ->> 'texto');
  elsif f.tipo = 'vou' then
    begin v_ato := (f.dados ->> 'ato')::uuid; exception when others then v_ato := null; end;
    if v_ato is not null then
      select * into p from rede_posts where id = v_ato;
      if not found or p.apagado_em is not null or not interno.rede2_pode_ver(p, p_quem) then v_ato := null; end if;
    end if;
    if v_ato is not null then
      select * into ch from rede_chamados where post = v_ato;
      -- O total é o do último marco (interno.rede_vou_publicado, o mesmo atraso do mosaico do ato): quem olha o story não vê o
      -- nulo virar 3, nem o 3 virar 4, no instante em que alguém confirma.
      v_n := interno.rede_vou_publicado(v_ato);
    end if;
    return jsonb_build_object('tipo', 'vou', 'ato', v_ato, 'titulo', f.dados ->> 'titulo', 'inicio', coalesce(ch.inicio::text, f.dados ->> 'inicio'),
      'cidade', f.dados ->> 'cidade', 'vou_eu', v_ato is not null and exists (select 1 from rede_vou u where u.post = v_ato and u.usuario = p_quem),
      'total', case when v_ato is not null then interno.rede5_story_total(v_n) end,
      'encerrado', v_ato is null or ch.cancelado or coalesce(ch.situacao, '') = 'cancelado' or ch.inicio < now() - interval '6 hours');
  elsif f.tipo = 'pessoa' then
    begin v_quem := (f.dados ->> 'perfil')::uuid; exception when others then v_quem := null; end;
    -- O mesmo filtro da busca de pessoas: quem está invisível, suspensa ou sem codinome aprovado não tem o @ mostrado (também
    -- quando ficou invisível DEPOIS de mencionada).
    if v_quem is null or interno.rede_bloqueado(p_quem, v_quem) or not interno.rede2_membro(v_quem)
       or not exists (select 1 from perfis x where x.id = v_quem and x.rede_handle is not null and x.rede_codinome_ok and not x.suspenso
                        and not coalesce(x.rede_modo = 'invisivel' or x.rede_invisivel, false)) then
      return jsonb_build_object('tipo', 'pessoa', 'handle', null, 'nome', '');
    end if;
    return jsonb_build_object('tipo', 'pessoa', 'handle', (select rede_handle from perfis where id = v_quem), 'nome', interno.rede_nome(v_quem));
  elsif f.tipo = 'campanha' then
    if coalesce((f.dados ->> 'corrente')::boolean, false) then
      -- Quantas PESSOAS entraram na corrente (stories no ar com a mesma #): só a partir de 3, arredondado, e só as que já estavam
      -- no último marco (interno.rede_contagem_marco): quem olha não vê o total mudar no instante em que alguém entra.
      select count(distinct x.autor) into v_n from rede_story_figurinhas g join rede_stories x on x.id = g.story
      where g.tipo = 'campanha' and g.dados ->> 'tag' = f.dados ->> 'tag' and coalesce((g.dados ->> 'corrente')::boolean, false)
        and x.expira_em > now() and not x.retido and x.criado_em <= interno.rede_contagem_marco();
    end if;
    return jsonb_build_object('tipo', 'campanha', 'tag', f.dados ->> 'tag', 'corrente', coalesce((f.dados ->> 'corrente')::boolean, false),
      'total', interno.rede5_story_total(v_n));
  else
    return jsonb_build_object('tipo', 'link', 'url', f.dados ->> 'url', 'rotulo', f.dados ->> 'rotulo');
  end if;
end $$;

create or replace function interno.rede5_story_json(s interno.rede_stories, p_quem uuid) returns jsonb language sql stable security definer set search_path = interno, pg_temp as $$
  select jsonb_build_object(
    'id', s.id, 'autora', interno.rede5_story_autora(s.autor), 'criado_em', s.criado_em, 'expira_em', s.expira_em,
    -- "proximos" (a roda) só a autora fica sabendo: para quem vê, o story da roda chega como um story comum, sem marca nenhuma
    -- (senão o selo contaria à pessoa que ela está na roda da autora).
    'publico', case when s.publico = 'proximos' and s.autor is distinct from p_quem then 'seguidores' else s.publico end,
    'comunidade', case when s.comunidade is not null then (select jsonb_build_object('slug', c.slug, 'nome', c.nome) from rede_comunidades c where c.slug = s.comunidade) end,
    'fundo', case
      -- P5: com a versão menor da foto (abre na hora; a alta chega depois).
      when s.fundo = 'imagem' then jsonb_build_object('tipo', 'imagem', 'cor', s.cor, 'caminho', s.midia_caminho, 'url', '', 'alt', coalesce(s.alt, ''))
                                   || case when s.midia_menor is not null then jsonb_build_object('menor', s.midia_menor) else '{}'::jsonb end
      when s.fundo = 'video' then jsonb_build_object('tipo', 'video', 'cor', s.cor, 'caminho', s.midia_caminho, 'url', '', 'alt', coalesce(s.alt, ''),
                                                     'duracao', s.duracao_ms, 'som', s.som)
      else jsonb_build_object('tipo', s.fundo, 'cor', s.cor) end,
    'texto', s.texto, 'legenda', s.legenda, 'meu', s.autor = p_quem, 'estilo', s.estilo,
    'post', interno.rede5_story_post(s.post_ref, p_quem),
    'legendas', case when jsonb_array_length(s.legendas) > 0 then s.legendas end,
    'musica', s.musica,
    'destaques', case when s.autor = p_quem then coalesce((select jsonb_agg(d.destaque) from rede_story_no_destaque d where d.story = s.id), '[]'::jsonb) end,
    'respostas', case when s.autor = p_quem then (select count(*)::integer from rede_story_respostas r where r.story = s.id) end,
    'reacoes', case when s.autor = p_quem then interno.rede5_story_reacoes(s.id) end,
    'figurinhas', coalesce((select jsonb_agg(interno.rede5_story_figurinha(f, s, p_quem) || jsonb_strip_nulls(jsonb_build_object('pos', f.dados -> 'pos')) order by f.ordem) from rede_story_figurinhas f where f.story = s.id), '[]'::jsonb))
$$;

-- ── 4. A regra do depósito, trocar a foto, a capa do destaque e o limite de envio ───────────────────────────────────────────

create or replace function public.rede_story_pode(p_caminho text) returns boolean language sql stable security definer set search_path = interno, pg_temp as $$
  select interno.alumia_passa() and exists (select 1 from rede_stories s where (s.midia_caminho = p_caminho or s.midia_menor = p_caminho)
                 and (s.conferido or s.autor = auth.uid())
                 and (interno.rede5_story_ve(s, auth.uid()) or interno.rede5_story_ve_destaque(s, auth.uid())))
$$;

create or replace function public.rede_story_trocar_midia(p_story uuid, p_caminho text) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.rede5_story_membro(); s rede_stories; v_tam bigint; v_mime text;
begin
  perform interno.limite('rede5_story_trocar', 20, 60);
  select * into s from rede_stories where id = p_story and autor = v;
  if not found or not (s.expira_em > now() or interno.rede5_story_no_destaque(s.id)) then perform interno.erro('nao_encontrado'); end if;
  if s.fundo <> 'imagem' then perform interno.erro('invalido:imagem'); end if;
  if coalesce(p_caminho, '') !~ ('^' || v::text || '/[0-9a-f-]{32,36}\.(webp|png|jpg)$') then perform interno.erro('invalido:imagem'); end if;
  if exists (select 1 from rede_stories where midia_caminho = p_caminho or midia_menor = p_caminho) then perform interno.erro('invalido:imagem'); end if;
  if to_regclass('storage.objects') is not null then
    execute 'select (metadata ->> ''size'')::bigint, metadata ->> ''mimetype'' from storage.objects where bucket_id = ''rede-stories'' and name = $1'
      into v_tam, v_mime using p_caminho;
    if v_mime is null or v_mime not in ('image/webp', 'image/png', 'image/jpeg') or coalesce(v_tam, 0) > 6291456 then perform interno.erro('invalido:imagem'); end if;
  end if;
  -- P5: a versão menor era da foto de antes (sem o borrado novo): sai junto, e o arquivo vira órfão (a faxina apaga).
  update rede_stories set midia_caminho = p_caminho, midia_menor = null, conferido = false where id = s.id;
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.rede_story_destaques(p_handle text) returns jsonb language plpgsql stable security definer set search_path = interno, pg_temp as $$
declare v uuid := auth.uid(); v_autor uuid;
begin
  if v is null or not interno.rede2_membro(v) then return '[]'::jsonb; end if;
  perform interno.rede5_story_ligado();
  if coalesce(p_handle, '') !~ '^[a-z0-9_]{3,20}$' then perform interno.erro('invalido:handle'); end if;
  select id into v_autor from perfis where rede_handle = p_handle;
  if not found then return '[]'::jsonb; end if;
  return coalesce((
    select jsonb_agg(jsonb_strip_nulls(jsonb_build_object('id', d.id, 'titulo', d.titulo, 'cor', d.cor, 'n', x.n,
             'capa', case when coalesce(x.escolhida, x.capa) is not null then jsonb_build_object('caminho', coalesce(x.escolhida, x.capa), 'tipo', 'imagem') end,
             'capa_story', case when d.autor = v then d.capa end)) order by d.ordem, d.criado_em)
    from rede_story_destaques d
    cross join lateral (
      -- P5: a capa usa a versão menor da foto quando há (a capa é uma bolinha; a alta abre ao tocar).
      select count(*)::integer as n,
             (array_agg(coalesce(s.midia_menor, s.midia_caminho) order by nd.ordem, nd.posto_em) filter (where s.midia_caminho is not null and s.fundo = 'imagem'))[1] as capa,
             (array_agg(coalesce(s.midia_menor, s.midia_caminho)) filter (where s.id = d.capa and s.fundo = 'imagem'))[1] as escolhida
      from rede_story_no_destaque nd join rede_stories s on s.id = nd.story
      where nd.destaque = d.id and interno.rede5_story_regra(s, v)) x
    where d.autor = v_autor and (x.n > 0 or d.autor = v)), '[]'::jsonb);
end $$;

/** Regra de envio: membro da Alumia, stories ligados, e no máximo 60 arquivos nas últimas 24 h na própria pasta (P5: a foto vai em dois). */
create or replace function public.rede_story_pode_enviar() returns boolean language plpgsql stable security definer set search_path = interno, pg_temp as $$
declare v uuid := auth.uid(); v_n integer := 0;
begin
  if v is null or not interno.rede2_membro(v) then return false; end if;
  if exists (select 1 from recursos_vivos where nome in ('rede-v2', 'alumia-2', 'alumia-stories') and not ligado) then return false; end if;
  if to_regclass('storage.objects') is not null then
    execute 'select count(*)::integer from storage.objects where bucket_id = ''rede-stories'' and name like $1 and created_at > now() - interval ''24 hours'''
      into v_n using v::text || '/%';
  end if;
  return v_n < 60;
end $$;

-- ── 5. A conferência e a faxina com a versão menor ──────────────────────────────────────────────────────────────────────────

/** O caminho da mídia do próprio story ainda não conferido (nulo: já conferido, sem mídia, ou não é da pessoa) e o da versão menor. */
create or replace function public.rede_story_conferir_pedir(p_id uuid) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := auth.uid(); s rede_stories;
begin
  if v is null then perform interno.erro('entre_primeiro'); end if;
  perform interno.limite('rede_story_conferir', 30, 10);
  select * into s from rede_stories where id = p_id and autor = v;
  if not found then perform interno.erro('nao_encontrado'); end if;
  return jsonb_build_object('id', s.id, 'caminho', case when s.midia_caminho is not null and not s.conferido then s.midia_caminho end,
                            'menor', case when s.midia_menor is not null and not s.conferido then s.midia_menor end);
end $$;

-- A lista da faxina: a versão menor entra como mais uma linha com o mesmo id (a faxina de hoje confere e apaga as duas sem mudar
-- nada; se uma delas for ruim, o id vai também para os ruins, e o story sai do ar). Órfão é o arquivo que nenhum story cita.
create or replace function public.rede_story_faxina_lista(p_limite integer default 200) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v_lim integer := greatest(1, least(coalesce(p_limite, 200), 500)); v_orfaos jsonb := '[]'::jsonb;
begin
  if to_regclass('storage.objects') is not null then
    execute 'select coalesce(jsonb_agg(o.name), ''[]''::jsonb) from (select name from storage.objects o where o.bucket_id = ''rede-stories''
               and o.created_at < now() - interval ''1 hour''
               and not exists (select 1 from interno.rede_stories s where s.midia_caminho = o.name or s.midia_menor = o.name)
               order by o.created_at limit $1) o'
      into v_orfaos using v_lim;
  end if;
  return jsonb_build_object(
    'apagar', coalesce((select jsonb_agg(jsonb_build_object('id', x.id, 'caminho', m.caminho) order by x.expira_em, m.k) from (
      select s.id, s.midia_caminho, s.midia_menor, s.expira_em from rede_stories s
      where s.expira_em <= now() and s.midia_caminho is not null and not interno.rede5_story_guardado(s.id)
      order by s.expira_em limit v_lim) x
      cross join lateral (values (1, x.midia_caminho), (2, x.midia_menor)) m(k, caminho) where m.caminho is not null), '[]'::jsonb),
    'conferir', coalesce((select jsonb_agg(jsonb_build_object('id', x.id, 'caminho', m.caminho) order by x.criado_em, m.k) from (
      select s.id, s.midia_caminho, s.midia_menor, s.criado_em from rede_stories s
      where s.midia_caminho is not null and not s.conferido and (s.expira_em > now() or interno.rede5_story_no_destaque(s.id))
      order by s.criado_em limit least(v_lim, 50)) x
      cross join lateral (values (1, x.midia_caminho), (2, x.midia_menor)) m(k, caminho) where m.caminho is not null), '[]'::jsonb),
    'orfaos', v_orfaos);
end $$;

-- ── 6. A resposta ao teste (pelo servidor do site, como a enquete do story) ─────────────────────────────────────────────────

/** A urna do teste: a resposta nova entra junto das outras, todas regravadas em ordem sorteada (sem pessoa, sem hora). */
create or replace function interno.rede_story_teste_urna(p_story uuid, p_opcao smallint) returns void language plpgsql security definer set search_path = interno, pg_temp as $$
begin
  with velhos as (
    delete from rede_story_teste_urna
    where story = p_story
      and ctid = any (array(select ctid from rede_story_teste_urna where story = p_story order by gen_random_uuid() limit 2000))
    returning opcao)
  insert into rede_story_teste_urna (story, opcao)
  select p_story, t.o from (select opcao as o from velhos union all select p_opcao) t order by gen_random_uuid();
end $$;

/** A resposta ao teste do story chega só pelo servidor do site (public.alumia_teste_story). */
create or replace function public.rede_story_testar(p_id uuid, p_opcao integer) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
begin
  perform interno.eu();
  perform interno.erro('voto_pelo_servidor');
  return null;
end $$;

/**
 * Para o servidor do site (só a chave de serviço): a resposta ao teste de um story. Gravado: a marca HMAC de "já respondeu" e a
 * opção na urna sem pessoa. Devolve a figurinha como a pessoa passa a ver, com a certa e se acertou.
 */
create or replace function public.alumia_teste_story(p_usuario uuid, p_story uuid, p_opcao integer, p_marca text) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare s rede_stories; f rede_story_figurinhas; v_certa integer;
begin
  if not interno.servico() then perform interno.erro('sem_permissao'); end if;
  if p_marca is null or p_marca !~ '^[0-9a-f]{64}$' then perform interno.erro('invalido:marca'); end if;
  perform interno.aberta('comunidade');
  perform interno.rede5_story_ligado();
  if p_usuario is null or not exists (select 1 from perfis where id = p_usuario and not suspenso) or not interno.rede2_membro(p_usuario) then
    perform interno.erro('sem_permissao');
  end if;
  s := interno.rede5_story_visivel(p_story, p_usuario);
  if s.autor = p_usuario then perform interno.erro('sem_permissao'); end if;
  select * into f from rede_story_figurinhas where story = s.id and tipo = 'teste';
  if not found then perform interno.erro('nao_encontrado'); end if;
  if p_opcao is null or p_opcao < 0 or p_opcao >= jsonb_array_length(f.dados -> 'opcoes') then perform interno.erro('invalido:opcao'); end if;
  v_certa := (f.dados ->> 'certa')::integer;
  perform pg_advisory_xact_lock(hashtextextended('rede_story_teste_urna:' || s.id::text, 0));
  -- Responder de novo não muda a resposta nem dá erro: volta a certa, sem dizer o que a pessoa respondeu antes.
  insert into rede_story_teste_marcas (story, marca) values (s.id, p_marca) on conflict do nothing;
  if not found then
    return interno.rede5_story_figurinha(f, s, p_usuario) || jsonb_build_object('certa', v_certa, 'ja_respondeu', true);
  end if;
  perform interno.rede_story_teste_urna(s.id, p_opcao::smallint);
  return interno.rede5_story_figurinha(f, s, p_usuario) || jsonb_build_object('certa', v_certa, 'minha', p_opcao, 'acertou', p_opcao = v_certa);
end $$;

revoke all on function interno.rede_story_teste_urna(uuid, smallint) from public;
revoke all on function public.alumia_teste_story(uuid, uuid, integer, text) from public;
revoke all on function public.rede_story_testar(uuid, integer) from public;
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on function interno.rede_story_teste_urna(uuid, smallint) from anon, authenticated;
    revoke all on function public.alumia_teste_story(uuid, uuid, integer, text) from anon, authenticated;
    grant execute on function public.alumia_teste_story(uuid, uuid, integer, text) to service_role;
    revoke all on function public.rede_story_testar(uuid, integer) from anon;
    grant execute on function public.rede_story_testar(uuid, integer) to authenticated, service_role;
  end if;
end $$;

select interno.alumia_trancar();
