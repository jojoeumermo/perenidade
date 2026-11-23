-- ───────────────────────────── Prompt 5: consertos da auditoria (depósito, só leitura, educadores, erros da tela) ─────────────────────────────
-- Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
--
-- Roda depois de 20261125-r3-fim.sql (banco na versão 16) e das migrações do Prompt 5 que vêm antes no install.sql; o
-- 20261126-p5-fim.sql vem por último. Pode rodar mais de uma vez, sem apagar dado nenhum.
-- Teste: npm run testar:p5-auditoria (cada parte é um ataque escrito como teste, que falhava antes e passa depois).
--
-- 1. O depósito do post (rede-midia) deixa de aceitar envio direto de quem tem conta. Antes, a regra rede_midia_envio deixava a
--    pessoa gravar na própria pasta sem passar pela rota que tira o EXIF/GPS (app/api/rede/midia): a "versão menor" .v640/.v1080
--    de uma foto publicada podia ser outra imagem qualquer (o celular mostra a versão; a moderação vê a principal), e a foto de um
--    post já publicado podia ser apagada e trocada por outra no mesmo caminho. Agora só o servidor do site grava, com a chave de
--    serviço, no caminho que o banco reservou como a pessoa; a versão menor é feita pelo servidor a partir da principal. Como a
--    chave de serviço passa por cima da regra de cota do depósito, a reserva passa a conferir a cota (midia_cheia), como a do vídeo.
--    Apagar o próprio arquivo continua (rede_midia_remocao), e ler continua com a matriz de quem vê o post.
-- 2. O story conferido (A16) não é trocado por baixo: a regra de envio do rede-stories recusa um caminho que já é de um story (a
--    foto ou a versão menor). Antes, a autora apagava o arquivo conferido e subia outro no mesmo caminho, e quem vê recebia o
--    arquivo novo sem a limpeza do servidor, com o conferido ainda verdadeiro. Trocar a foto continua por rede_story_trocar_midia.
--
-- 3. O modo só leitura de emergência passa a valer também no perfil da rede (codinome, @, foto, capa, bio, pronomes, status, post
--    fixado e a tag da Escola, em interno.perfis): antes, com o modo ligado, a conta comum trocava o nome e o @. Pôr vazio continua.
-- 4. Os educadores da Escola sem lista de militantes: alumia_escola_educadores deixa de devolver "candidatos" (todos os membros da
--    Frente, com o codinome e o @ da Alumia); a coordenação acha uma pessoa pelo @ exato (alumia_escola_educador_achar).
-- 5. Os erros da tela: a limpeza da mensagem tira também token (JWT, sk_/pk_, sequência longa), IPv4 e IPv6, número com pontuação
--    (CPF, telefone) e texto entre aspas; o endereço guarda só o idioma, o /alumia e a rota de primeiro nível conhecida (antes,
--    o slug de comunidade, pacote, busca, perfil e o do coringa passavam). Passado o teto do dia, uma linha vista uma vez só sai
--    para a nova entrar: a enxurrada de um visitante não cega mais o registro, e o erro que se repete nunca sai.
-- 6. contribuicao_editar, ferias_marcar(date) e territorio_parceiro_definir perdem a execução para visitante, e a assinatura velha
--    ferias_marcar(date) passa a ser a nova com o começo vazio (a mesma regra; nada de segunda porta com a regra antiga).
-- 7. O resumo das pendências (D6) na tela da própria pessoa conta com a sessão dela como está; antes, inventava o segundo fator, e
--    uma sessão sem ele via contagens da sessão com ele. A rotina do e-mail (sem sessão) continua contando como a pessoa.
--
-- Redefine (a definição COMPLETA, a do install.sql deste ramo, mais o que está dito acima): public.rede_pub_midia_reservar(text) e
-- public.alumia_escola_educadores() (a de 20261126-p5-emergencia.sql); interno.alumia_p5_endereco_limpo(text),
-- interno.alumia_p5_texto_limpo(text) e public.erro_tela_registrar(jsonb) (as de 20261126-p5-beta.sql); public.ferias_marcar(date)
-- (a do começo do install.sql); interno.pendencias_linhas(uuid) (a de 20261126-p5-equipe.sql).
-- Funções novas: public.rede_story_caminho_novo(text), interno.alumia_so_leitura_perfil() (gatilho em interno.perfis) e
-- public.alumia_escola_educador_achar(text). Regras do depósito: sai rede_midia_envio; rede_stories_envio é refeita.
-- Não mexe em rede_alumia_versao nem na lista de exceções da porta. Endereço de rede: nada daqui lê ou guarda. Termina trancando
-- tudo na porta.

-- ── 1. O depósito do post ─────────────────────────────────────────────────────────────────────────────────────────────────

/**
 * Antes de subir um arquivo, a rota do servidor (app/api/rede/midia) pede aqui, como a pessoa, um caminho "<pessoa>/<id>.<ext>".
 * É aqui que entram o limite de envios, a conferência de que a pessoa é membro da Rede e (desde a auditoria do P5, porque o
 * servidor grava com a chave de serviço) a cota. p_ext: 'jpg', 'png', 'webp', 'webm', 'ogg', 'm4a'.
 */
create or replace function public.rede_pub_midia_reservar(p_ext text) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); v_id uuid := gen_random_uuid();
begin
  perform interno.aberta('comunidade');
  if p_ext not in ('jpg', 'png', 'webp', 'webm', 'ogg', 'm4a') then perform interno.erro('invalido:arquivo'); end if;
  if not coalesce((select rede_18 from perfis where id = v), false) then perform interno.erro('confirme_idade'); end if;
  if not interno.rede2_membro(v) then perform interno.erro('consentimento'); end if;
  perform interno.limite('rede_pub_midia', 40, 60);
  if interno.alumia_midia_uso(v) >= interno.alumia_midia_cota() then perform interno.erro('midia_cheia'); end if;
  return jsonb_build_object('id', v_id, 'caminho', v::text || '/' || v_id::text || '.' || p_ext);
end $$;

-- Sem regra de envio para quem tem conta no rede-midia: só a chave de serviço (o servidor do site) grava.
do $$
begin
  if to_regclass('storage.objects') is not null then
    execute 'drop policy if exists "rede_midia_envio" on storage.objects';
  end if;
end $$;

-- ── 2. O story conferido ──────────────────────────────────────────────────────────────────────────────────────────────────

/**
 * Regra do depósito rede-stories: o caminho ainda não é de nenhum story (nem a foto, nem a versão menor). Sem ela, a autora
 * apagava o arquivo de um story já conferido e subia outro no mesmo caminho, que ia a quem vê sem a limpeza do servidor e com o
 * conferido ainda verdadeiro. Trocar a foto de um story é rede_story_trocar_midia, com caminho novo (e volta o conferido).
 */
create or replace function public.rede_story_caminho_novo(p_caminho text) returns boolean language sql stable security definer set search_path = interno, pg_temp as $$
  select p_caminho is not null and not exists (select 1 from rede_stories s where s.midia_caminho = p_caminho or s.midia_menor = p_caminho)
$$;
revoke all on function public.rede_story_caminho_novo(text) from public;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on function public.rede_story_caminho_novo(text) from anon;
    grant execute on function public.rede_story_caminho_novo(text) to authenticated, service_role;
  end if;
  if to_regclass('storage.objects') is not null then
    execute 'drop policy if exists "rede_stories_envio" on storage.objects';
    execute 'create policy "rede_stories_envio" on storage.objects for insert to authenticated with check (bucket_id = ''rede-stories'' and (storage.foldername(name))[1] = auth.uid()::text and public.rede_story_pode_enviar() and public.rede_story_caminho_novo(name))';
  end if;
end $$;

-- ── 3. O modo só leitura e o perfil da rede ───────────────────────────────────────────────────────────────────────────────

/**
 * A trava do modo só leitura no perfil da rede. O perfil fica em interno.perfis (dividido com o site do instituto e o painel), que
 * a trava das tabelas interno.rede_* e interno.alumia_* não cobria: com o modo ligado, uma conta comum ainda trocava o codinome,
 * o @, a foto, a capa e a bio (numa invasão, contas trocando de nome para imitar outras). Aqui só as colunas que os outros veem
 * na rede; o resto da linha (férias, avisos, se proteger, entrada) segue. Tirar (pôr vazio) não é trocar e continua. Quem passa é
 * quem passa na trava das tabelas (interno.alumia_so_leitura_passa).
 */
create or replace function interno.alumia_so_leitura_perfil() returns trigger language plpgsql security definer set search_path = interno, pg_temp as $$
declare c text; v_novo jsonb; v_velho jsonb;
begin
  if not interno.alumia_so_leitura() or interno.alumia_so_leitura_passa() then return new; end if;
  v_novo := to_jsonb(new);
  v_velho := to_jsonb(old);
  foreach c in array array['rede_codinome', 'rede_handle', 'rede_bio', 'rede_avatar', 'rede_avatar_dados', 'rede_capa', 'rede_capa_dados',
                           'rede_pronomes', 'rede_status_texto', 'rede_status_tipo', 'rede_fixado', 'escola_tag'] loop
    if (v_novo -> c) is distinct from (v_velho -> c) and coalesce(v_novo ->> c, '') <> '' then perform interno.erro('alumia_so_leitura'); end if;
  end loop;
  return new;
end $$;
revoke all on function interno.alumia_so_leitura_perfil() from public;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then revoke all on function interno.alumia_so_leitura_perfil() from anon, authenticated; end if;
end $$;
drop trigger if exists alumia_so_leitura_perfil on interno.perfis;
create trigger alumia_so_leitura_perfil before update on interno.perfis for each row execute function interno.alumia_so_leitura_perfil();

-- ── 4. Os educadores da Escola, sem lista de militantes ───────────────────────────────────────────────────────────────────

/**
 * Para o painel (coordenação com o segundo fator): quem é educador da Escola, desde quando, e a regra em vigor ("lista" ou
 * "militantes"). Redefinida inteira (a de 20261126-p5-emergencia.sql) SEM o campo "candidatos", que trazia todos os militantes da
 * Frente com o codinome e o @ da Alumia: uma lista de pessoas que ligava a militância ao pseudônimo. Para escolher alguém, a
 * coordenação acha a pessoa pelo @ exato (public.alumia_escola_educador_achar), uma por vez.
 */
create or replace function public.alumia_escola_educadores() returns jsonb language plpgsql stable security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.alumia_admin_exige();
begin
  return jsonb_build_object(
    'regra', case when exists (select 1 from escola_educadores) then 'lista' else 'militantes' end,
    'educadores', coalesce((select jsonb_agg(jsonb_build_object('id', e.usuario, 'nome', interno.alumia_painel_nome(e.usuario), 'desde', e.desde)
        order by interno.alumia_painel_nome(e.usuario)) from escola_educadores e), '[]'::jsonb));
end $$;

/**
 * Acha UMA conta pelo @ exato (com ou sem o "@"), para a coordenação fazer dela educador(a) da Escola. Devolve o id, o nome que o
 * painel mostra e se já é educador; nunca diz se a pessoa está numa frente. Pedaço de @ não acha ninguém (nao_encontrado).
 */
create or replace function public.alumia_escola_educador_achar(p_handle text) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.alumia_admin_exige(); h text := lower(btrim(coalesce(p_handle, ''), ' @')); v_id uuid;
begin
  perform interno.limite('alumia_admin_achar', 60, 60);
  if h !~ '^[a-z0-9_]{3,30}$' then perform interno.erro('nao_encontrado'); end if;
  select f.id into v_id from perfis f where f.rede_handle = h and not f.suspenso;
  if v_id is null then perform interno.erro('nao_encontrado'); end if;
  return jsonb_build_object('id', v_id, 'nome', interno.alumia_painel_nome(v_id), 'educador', exists (select 1 from escola_educadores e where e.usuario = v_id));
end $$;

revoke all on function public.alumia_escola_educador_achar(text) from public;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on function public.alumia_escola_educador_achar(text) from anon;
    grant execute on function public.alumia_escola_educador_achar(text) to authenticated;
  end if;
end $$;

-- ── 5. Os erros da tela ───────────────────────────────────────────────────────────────────────────────────────────────────

/**
 * O endereço de uma tela sem nada de quem é (redefinida inteira; a de 20261126-p5-beta.sql deixava passar o slug de uma
 * comunidade, de um pacote, de uma busca, de um perfil e o que o coringa [...resto] recebe): sem "?", "#" e o endereço do site;
 * fica o idioma, o "/alumia" e a primeira parte só se for uma rota conhecida da Alumia; tudo o que vem depois vira um ":x". Fora
 * de um caminho ("javascript:..."), vazio. Até 200 letras. A mesma regra de telaLimpa (lib/rede/beta/tela.ts).
 */
create or replace function interno.alumia_p5_endereco_limpo(p text) returns text language sql immutable as $$
  select case when b.x !~ '^/' or b.m is null then '' else left(
           coalesce(b.m[1], '') || coalesce(b.m[2], '')
           || case when b.m[3] is null or b.m[3] = '/' then ''
                   when b.m[3] ~ '^/(agenda|ajuda|aparelhos|aparencia|app|aprovados|ato|atos|aula|avisos|buscar|c|calendario|como-a-linha|comunidades|conquistas|conversas|convite|cuidado|denunciar|denuncias|editar-perfil|explorar|fediverso|identidades|leve|linhas|listas|mapa|meus-dados|moderacao|modo-ato|nucleos|o|o-que-guardamos|organizacoes|p|pacote|pontes|privacidade|propor|questoes|redacao|regras|rotulos|salvos|seguranca|series|silenciados|stories|tag|temas|termos|trabalhadores|transparencia|turmas|u)$' then b.m[3]
                   else '/:x' end
           || case when coalesce(b.m[4], '') ~ '^/*$' then '' else '/:x' end, 200) end
  from (select a.x, regexp_match(a.x, '^(/[a-z]{2}(?:-[A-Za-z]{2,4})?(?=/|$))?(/alumia(?=/|$))?(/[^/]*)?(.*)$') as m
        from (select regexp_replace(split_part(split_part(coalesce(p, ''), '?', 1), '#', 1), '^https?://[^/]*', '', 'i') as x) a) b
$$;

/**
 * Uma mensagem de erro sem dado pessoal (redefinida inteira; a de 20261126-p5-beta.sql deixava passar CPF, IP, token e nomes
 * entre aspas), na ordem: e-mail, link, id, token (JWT, chave sk_/pk_, sequência longa de letras e algarismos), endereço de rede
 * (IPv4 e IPv6), número com pontuação (CPF, telefone), texto entre aspas (fica só um nome de propriedade, como 'map'), @nome e
 * número de 4 algarismos ou mais. Até 300 letras, numa linha. A mesma regra de mensagemLimpa (lib/rede/beta/tela.ts).
 */
create or replace function interno.alumia_p5_texto_limpo(p text) returns text language sql immutable as $$
  select left(btrim(regexp_replace(
    regexp_replace(regexp_replace(regexp_replace(regexp_replace(regexp_replace(regexp_replace(regexp_replace(regexp_replace(
    regexp_replace(regexp_replace(regexp_replace(regexp_replace(regexp_replace(regexp_replace(
      coalesce(p, ''),
      '[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}', '<e-mail>', 'g'),
      '(https?|wss?|blob|data):[^\s"''<>)]*', '<link>', 'g'),
      '[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}', ':x', 'g'),
      'eyJ[A-Za-z0-9_-]{8,}(\.[A-Za-z0-9_-]+)*', '<token>', 'g'),
      '(sk|pk|rk)_(live|test)_[A-Za-z0-9]+', '<token>', 'g'),
      '(?=[A-Za-z0-9+/_=-]*[0-9])(?=[A-Za-z0-9+/_=-]*[A-Za-z])[A-Za-z0-9+/_=-]{20,}', '<token>', 'g'),
      '[0-9]{1,3}(\.[0-9]{1,3}){3}', '<ip>', 'g'),
      '(?=[0-9A-Fa-f:]*[0-9])[0-9A-Fa-f]{1,4}(:[0-9A-Fa-f]{0,4}){2,7}', '<ip>', 'g'),
      '[0-9]{3,}([./-][0-9]+)+', ':x', 'g'),
      '''(?![a-z_$][A-Za-z0-9_$.]{0,40}'')[^'']*''', '''…''', 'g'),
      '"(?![a-z_$][A-Za-z0-9_$.]{0,40}")[^"]*"', '"…"', 'g'),
      '“[^”]*”', '“…”', 'g'),
      '‘[^’]*’', '‘…’', 'g'),
      '(@[A-Za-z0-9_]{2,}|[0-9]{4,})', ':x', 'g'),
    '\s+', ' ', 'g')), 300)
$$;

/**
 * Guarda um erro da tela, somado por dia (redefinida inteira; a de 20261126-p5-beta.sql). Qualquer pessoa chama (a tela de
 * entrada também quebra), com limite por origem e um teto de linhas por dia. Antes, passado o teto, o erro novo era ignorado: um
 * visitante de muitas origens enchia o dia de lixo diferente e a coordenação deixava de ver os erros de verdade. Agora, passado o
 * teto, uma linha que só apareceu uma vez hoje sai para a nova entrar: o erro que se repete (o de verdade, que bate em várias
 * telas) nunca sai, e o que chega depois da enxurrada entra.
 */
create or replace function public.erro_tela_registrar(p jsonb) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v_msg text; v_pag text; v_ver text; v_nav text;
begin
  if p is null or jsonb_typeof(p) <> 'object' then return jsonb_build_object('ok', false); end if;
  perform interno.limite('erro_tela', 20, 10);
  v_msg := interno.alumia_p5_texto_limpo(p ->> 'mensagem');
  v_pag := interno.alumia_p5_endereco_limpo(p ->> 'pagina');
  v_ver := coalesce(substring(lower(coalesce(p ->> 'versao', '')) from '^([0-9a-z.-]{0,40})$'), '');
  v_nav := case when p ->> 'navegador' in ('chrome', 'firefox', 'safari', 'edge', 'samsung', 'opera') then p ->> 'navegador' else 'outro' end;
  if v_msg = '' or v_pag !~ '^/' then return jsonb_build_object('ok', false); end if;
  if (select count(*) from alumia_erros_tela where dia = current_date) >= 2000
     and not exists (select 1 from alumia_erros_tela where dia = current_date and mensagem = v_msg and pagina = v_pag and versao = v_ver and navegador = v_nav) then
    delete from alumia_erros_tela where ctid = (select ctid from alumia_erros_tela where dia = current_date and vezes = 1 limit 1);
    if not found then return jsonb_build_object('ok', true); end if;
  end if;
  insert into alumia_erros_tela (dia, mensagem, pagina, versao, navegador) values (current_date, v_msg, v_pag, v_ver, v_nav)
  on conflict (dia, mensagem, pagina, versao, navegador) do update set vezes = least(alumia_erros_tela.vezes + 1, 1000000);
  if random() < 0.02 then delete from alumia_erros_tela where dia < current_date - 30; end if;
  return jsonb_build_object('ok', true);
end $$;

-- ── 6. As funções do painel do instituto e o visitante ────────────────────────────────────────────────────────────────────

/**
 * Férias de verdade: até a data. A assinatura antiga (só o "até"), que o site de antes chama, passa a ser a nova com o começo vazio
 * (public.ferias_marcar(date, date), 20261126-p5-equipe.sql): a mesma regra, e as férias marcadas para depois não ficam
 * penduradas. Redefinida inteira (a de antes, do começo do install.sql, tinha a regra antiga).
 */
create or replace function public.ferias_marcar(p_ate date) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
begin
  return public.ferias_marcar(null::date, p_ate);
end $$;

-- Sem execução para visitante (por dentro já recusavam com entre_primeiro; faltava o revoke que as outras do P5 têm).
revoke all on function public.contribuicao_editar(uuid, jsonb), public.ferias_marcar(date), public.territorio_parceiro_definir(uuid, text, boolean) from public;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on function public.contribuicao_editar(uuid, jsonb), public.ferias_marcar(date), public.territorio_parceiro_definir(uuid, text, boolean) from anon;
    grant execute on function public.contribuicao_editar(uuid, jsonb), public.ferias_marcar(date), public.territorio_parceiro_definir(uuid, text, boolean)
      to authenticated, service_role;
  end if;
end $$;

-- ── 7. O resumo das pendências na tela da própria pessoa ──────────────────────────────────────────────────────────────────

/**
 * As linhas do resumo de uma pessoa (redefinida inteira; a de 20261126-p5-equipe.sql): as contagens da Mesa dela (painel_resumo) e
 * as aulas que faltam nas disciplinas em que ela é educadora. Só números; nada de nome, título ou texto. Na tela da própria pessoa
 * (a prévia de pendencias_email_ver), conta com a sessão dela como está: antes, a função trocava a sessão por uma com o segundo
 * fator, e uma sessão sem ele via contagens que só a sessão com ele veria. A rotina do e-mail, que não tem sessão, continua
 * contando como a pessoa, só durante a conta.
 */
create or replace function interno.pendencias_linhas(p_usuario uuid) returns text[] language plpgsql security definer set search_path = interno, pg_temp as $$
declare v_claims text := current_setting('request.jwt.claims', true); v_sub text := current_setting('request.jwt.claim.sub', true);
  r jsonb; v_linhas text[] := '{}'; n integer; x record;
begin
  if p_usuario is null then return v_linhas; end if;
  if auth.uid() is not distinct from p_usuario then
    -- A própria pessoa, na tela dela (pendencias_email_ver): conta com a sessão dela como está, sem inventar o segundo fator.
    begin
      r := public.painel_resumo();
    exception when others then r := null;
    end;
  else
    -- A rotina do e-mail (sem sessão): conta como a pessoa, só durante a conta, e devolve a sessão como estava.
    perform set_config('request.jwt.claims', jsonb_build_object('sub', p_usuario, 'role', 'authenticated', 'aal', 'aal2')::text, true);
    perform set_config('request.jwt.claim.sub', p_usuario::text, true);
    begin
      r := public.painel_resumo();
    exception when others then r := null;
    end;
    perform set_config('request.jwt.claims', coalesce(v_claims, ''), true);
    perform set_config('request.jwt.claim.sub', coalesce(v_sub, ''), true);
  end if;
  if r is null then return v_linhas; end if;
  for x in select * from (values
      (1, 'fila', 'item esperando revisão', 'itens esperando revisão'),
      (2, 'triagem', 'envio esperando a triagem', 'envios esperando a triagem'),
      (3, 'testemunhar', 'certificado esperando a sua assinatura', 'certificados esperando a sua assinatura'),
      (4, 'pedidos', 'pedido de certificado', 'pedidos de certificado'),
      (5, 'horas', 'registro de horas para conferir', 'registros de horas para conferir'),
      (6, 'candidaturas', 'pedido para entrar na equipe', 'pedidos para entrar na equipe'),
      (7, 'juntas', 'envio compartilhado com você em andamento', 'envios compartilhados com você em andamento'),
      (8, 'pedidos_ajuda', 'pedido de ajuda para a sua função', 'pedidos de ajuda para a sua função'),
      (9, 'reforco', 'pedido de reforço aberto', 'pedidos de reforço abertos'),
      (10, 'denuncias', 'denúncia aberta', 'denúncias abertas'),
      (11, 'anotacoes', 'anotação esperando decisão', 'anotações esperando decisão'),
      (12, 'retidos', 'mensagem retida na comunidade', 'mensagens retidas na comunidade'),
      (13, 'mural', 'anúncio do Mural dos Trabalhadores esperando decisão', 'anúncios do Mural dos Trabalhadores esperando decisão'),
      (14, 'gaveta', 'item na Gaveta esperando decisão', 'itens na Gaveta esperando decisão'),
      (15, 'divulgacao', 'post de divulgação pronto para sair', 'posts de divulgação prontos para sair'),
      (16, 'pedidos_supervisao', 'pedido da supervisão esperando a coordenação', 'pedidos da supervisão esperando a coordenação'),
      (17, 'publicacao_atrasada', 'envio aprovado esperando a publicação', 'envios aprovados esperando a publicação')) t(ordem, chave, um, varios)
    order by ordem loop
    n := coalesce((r ->> x.chave)::integer, 0);
    if n > 0 then v_linhas := v_linhas || (n || ' ' || case when n = 1 then x.um else x.varios end); end if;
  end loop;
  -- Aulas a fazer: as lacunas abertas nas disciplinas em que a pessoa é educadora.
  select count(*) into n from disciplina_lacunas d where d.status = 'aberta'
    and exists (select 1 from papeis p where p.usuario = p_usuario and p.papel in ('educacao', 'educacao_secundaria') and p.disciplina = d.disciplina);
  if n > 0 then v_linhas := v_linhas || (n || ' ' || case when n = 1 then 'aula a fazer na sua disciplina' else 'aulas a fazer nas suas disciplinas' end); end if;
  return v_linhas;
end $$;

revoke all on function interno.pendencias_linhas(uuid) from public;

select interno.alumia_trancar();
