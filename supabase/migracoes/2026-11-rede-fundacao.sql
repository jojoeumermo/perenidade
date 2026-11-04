-- ───────────────────────────── Rede Lúcia v2: fundação das funções (Etapa 7, R4) ─────────────────────────────
-- Migração acrescentável: pode rodar mais de uma vez, sem apagar dado nenhum. Roda DEPOIS do install.sql (que já traz as
-- tabelas da Fase 2: rede_posts ampliada, rede_comunidades, rede_nucleos, rede_migracao, rede2_pode_ver…) e ANTES das
-- outras migrações rede (consertos, perfil, publicar, conversa, descoberta, comunidades, avisos, moderacao).
-- Contrato completo das funções: docs/rede/V2.md. Especificação: docs/rede/ESPEC.md. Teste: npm run testar:rede-fundacao.
--
-- O que este arquivo faz, e só isto:
--   1. interno.rede_ve(post, usuario): a matriz de visibilidade da ESPEC (seção 2), em cima de rede2_pode_ver, com o
--      que faltava: o espaço fechado da Rede de hoje ("fechado-…") não vaza para quem é "membro da Rede".
--   2. Leitura: rede_linha (abas e paginação por cursor), rede_post, rede_novos, rede_comunidade, rede_perfil_de,
--      rede_situacao. Toda leitura passa por interno.rede_ve; apoios e "vou" só saem para quem escreveu.
--   3. Escrita básica: rede_aderir (18 anos + consentimento), rede_publicar (texto, tipo, público, comunidade, resposta),
--      rede_reagir (apoiar e útil, sem devolver o total de apoios) e rede_salvar.
--   4. Migração idempotente do Fórum para rede_posts, com o mapa em rede_migracao (nada é apagado) e o resolvedor dos
--      endereços antigos (rede_antigo: ?t= e ?sala=).
--
-- Dado de pessoa: nenhum novo. Nenhuma tabela nova. Nada da Rede de hoje muda de comportamento: os posts da v2 recebem um
-- "alcance" conservador (só "publico" quando o post é para a internet), então a Rede de hoje, com o recurso desligado,
-- nunca mostra um post restrito da v2.
--
-- Leis: LGPD (13.709/2018) art. 11, I (opinião política e filiação sindical são dado sensível: consentimento específico e
-- destacado, em rede_aderir) e art. 14 (menores: a Rede é só para 18+); Marco Civil (12.965/2014) arts. 15, 19 e 21 (registro
-- de moderação e retirada); Código Penal arts. 138 a 140 (a denúncia e o recurso ficam no pacote de moderação).

-- ── 1. A matriz de visibilidade ───────────────────────────────────────────────────────────────────────────────────────

/**
 * Esta pessoa (p_quem; nulo = visitante) pode ver este post? A matriz da ESPEC, seção 2. Vale para linha, busca, aviso,
 * prévia, exportação e contagem. É rede2_pode_ver mais a trava do espaço fechado da Rede de hoje: um post de
 * "fechado-…" só é de quem é membro do espaço (ou de quem o escreveu), em qualquer público.
 */
create or replace function interno.rede_ve(p interno.rede_posts, p_quem uuid) returns boolean language sql stable security definer set search_path = interno, pg_temp as $$
  select interno.rede2_pode_ver(p, p_quem)
    and (p.comunidade is null or p.comunidade not like 'fechado-%' or p.autor = p_quem
         or exists (select 1 from rede_espaco_membros m where m.espaco = p.comunidade and m.usuario = p_quem))
$$;

/** Este post está silenciado por quem lê (pessoa, comunidade, conversa ou palavra)? O que a própria pessoa escreveu nunca. */
create or replace function interno.rede_silenciado(p interno.rede_posts, p_quem uuid) returns boolean language sql stable security definer set search_path = interno, pg_temp as $$
  select p_quem is not null and p.autor is distinct from p_quem and exists (
    select 1 from rede_silenciados s
    where s.usuario = p_quem and (s.ate is null or s.ate > now())
      and (s.pessoa = p.autor
           or (s.comunidade is not null and s.comunidade = p.comunidade)
           or (s.conversa is not null and s.conversa = coalesce(p.root_id, p.id))
           or (s.palavra is not null and position(interno.normal(s.palavra) in interno.normal(coalesce(p.titulo, '') || ' ' || p.texto)) > 0)))
$$;

/** O "alcance" da Rede de hoje que acompanha um público da v2: só a internet aparece na Rede de hoje; o resto fica de fora dela. */
create or replace function interno.rede_alcance(p_publico text) returns text language sql immutable as $$
  select case p_publico when 'internet' then 'publico' when 'seguidores' then 'seguidores' else 'equipe' end
$$;

-- ── 2. O post como a v2 mostra ─────────────────────────────────────────────────────────────────────────────────────────

/**
 * O post em JSON para quem lê (p_quem). Só codinome, nunca o nome do painel. Apoios só para quem escreveu; "vou" só para quem
 * organizou o chamado; respostas contadas pela mesma matriz. A mídia sai sem o caminho do arquivo (o pacote publicar entrega a
 * URL assinada). p_completo traz o corpo inteiro (a página do post); a linha traz só o resumo.
 */
create or replace function interno.rede_post_v2(p interno.rede_posts, p_quem uuid, p_completo boolean default false) returns jsonb language sql stable security definer set search_path = interno, pg_temp as $$
  select jsonb_build_object(
    'id', p.id, 'tipo', p.tipo, 'titulo', p.titulo, 'texto', p.texto,
    'corpo', case when p_completo then p.corpo end, 'longo', p.corpo is not null,
    'comunidade', p.comunidade, 'flair', p.flair, 'publico', interno.rede2_publico(p),
    'criado_em', p.criado_em, 'editado_em', p.editado_em,
    'fixado', p.fixado, 'travado', p.travado, 'aceita', p.aceita, 'verificada', p.verificada,
    'resposta_a', p.resposta_a, 'raiz', coalesce(p.root_id, p.id), 'nivel', p.profundidade,
    'aviso', p.aviso, 'cita', p.cita, 'chamado', p.chamado,
    'meu', p_quem is not null and p.autor = p_quem,
    'retido', p_quem is not null and p.autor = p_quem and (p.retido or p.oculto),
    'motivo', case when p_quem is not null and p.autor = p_quem and (p.retido or p.oculto) then p.motivo else '' end,
    'modero', p_quem is not null and p_quem = auth.uid() and (interno.cuida() or exists (
      select 1 from rede_comunidade_membros m where m.comunidade = p.comunidade and m.usuario = p_quem and m.papel = 'moderacao' and m.situacao = 'ativo')),
    'autor', jsonb_build_object(
      'id', p.autor, 'codinome', interno.rede_nome(p.autor),
      'handle', case when not coalesce(f.rede_modo = 'invisivel' or f.rede_invisivel, false) then f.rede_handle end,
      'perfil', not coalesce(f.rede_modo = 'invisivel' or f.rede_invisivel, false),
      'equipe', interno.voluntario_e(p.autor)),
    'respostas', interno.rede2_respostas_visiveis(p.id, p_quem),
    'na_conversa', case when p.root_id is null then (select count(*)::integer from rede_posts r where r.root_id = p.id and interno.rede_ve(r, p_quem)) end,
    'util', (select count(*)::integer from rede_reacoes r where r.post = p.id and r.tipo = 'util'),
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
                  else jsonb_build_object('restrito', true) end from rede_posts o where o.id = p.quote_of) end)
  from (select 1) u left join perfis f on f.id = p.autor
$$;

-- ── 3. Abas, cursor e linha ────────────────────────────────────────────────────────────────────────────────────────────

/**
 * Valida a aba e devolve a forma canônica. 'seguindo', 'comunidades' e 'tudo' pedem conta (a linha Tudo é só para membros logados,
 * decisão 2); 'geral' (a linha aberta das disciplinas) é de qualquer um; 'c:<slug>' é uma comunidade (apelido vira o nome novo);
 * 'u:<handle>' é o perfil de uma pessoa (perfil invisível ou bloqueado: não existe; trancado: só quem a segue com aprovação).
 */
create or replace function interno.rede_aba(p_aba text, p_quem uuid) returns text language plpgsql stable security definer set search_path = interno, pg_temp as $$
declare v_slug text; v_alvo perfis;
begin
  if p_aba in ('tudo', 'seguindo', 'comunidades') then
    if p_quem is null then perform interno.erro('entre_primeiro'); end if;
    return p_aba;
  elsif p_aba = 'geral' then
    return 'geral';
  elsif p_aba ~ '^c:[a-z0-9-]{2,60}$' then
    select c.slug into v_slug from rede_comunidades c where c.slug = substr(p_aba, 3) or substr(p_aba, 3) = any (c.apelidos) order by (c.slug = substr(p_aba, 3)) desc limit 1;
    -- A comunidade da Rede de hoje (texto livre no post) também abre: o slug vale como está.
    return 'c:' || coalesce(v_slug, substr(p_aba, 3));
  elsif p_aba ~ '^u:[a-z0-9_]{3,20}$' then
    if p_quem is null then perform interno.erro('entre_primeiro'); end if;
    select * into v_alvo from perfis where rede_handle = substr(p_aba, 3);
    if not found or (v_alvo.id <> p_quem and (v_alvo.rede_modo = 'invisivel' or v_alvo.rede_invisivel or interno.rede_bloqueado(p_quem, v_alvo.id))) then
      perform interno.erro('nao_encontrado');
    end if;
    if v_alvo.id <> p_quem and v_alvo.rede_modo = 'trancado'
       and not exists (select 1 from rede_seguindo s where s.quem = p_quem and s.segue = v_alvo.id and not s.pendente) then
      return 'nada';
    end if;
    return 'u:' || v_alvo.id::text;
  end if;
  perform interno.erro('invalido:aba');
  return null;
end $$;

/** O post (de primeiro nível) pertence a esta aba? Não olha a visibilidade: quem chama também confere interno.rede_ve. */
create or replace function interno.rede_na_aba(p interno.rede_posts, p_aba text, p_quem uuid) returns boolean language sql stable security definer set search_path = interno, pg_temp as $$
  select p.resposta_a is null and p.apagado_em is null and case
    when p_aba = 'tudo' then true
    when p_aba = 'geral' then interno.rede2_publico(p) = 'internet'
    when p_aba = 'seguindo' then p.autor = p_quem or exists (select 1 from rede_seguindo s where s.quem = p_quem and s.segue = p.autor and not s.pendente)
    when p_aba = 'comunidades' then (p.comunidade is not null and (
        exists (select 1 from rede_comunidade_membros m where m.comunidade = p.comunidade and m.usuario = p_quem and m.situacao = 'ativo')
        or exists (select 1 from rede_comunidades_seguidas c where c.usuario = p_quem and c.comunidade = p.comunidade)))
      or (p.nucleo is not null and exists (select 1 from rede_nucleo_membros n where n.nucleo = p.nucleo and n.usuario = p_quem))
    when p_aba like 'c:%' then p.comunidade = substr(p_aba, 3)
    when p_aba like 'u:%' then p.autor::text = substr(p_aba, 3)
    else false end
$$;

/**
 * A linha, 20 por vez (no máximo 50), por cursor: o cursor é o "criado_em|id" do último post entregue, então posts que chegam
 * enquanto a pessoa lê não repetem nem pulam nada. Devolve {itens, proximo} (proximo nulo = acabou). Respeita a matriz e o que
 * a pessoa silenciou. Com limite de leitura por conta (ou por origem, para visitante): contra raspagem.
 */
create or replace function public.rede_linha(p_aba text, p_cursor text default null, p_limite integer default 20) returns jsonb
language plpgsql volatile security definer set search_path = interno, pg_temp as $$
declare
  v_quem uuid := auth.uid();
  v_aba text;
  v_limite integer := least(greatest(coalesce(p_limite, 20), 1), 50);
  v_t timestamptz; v_id uuid;
  v_itens jsonb; v_n integer; v_ultimo jsonb; v_proximo text;
begin
  perform interno.aberta('comunidade');
  if v_quem is not null and exists (select 1 from perfis where id = v_quem and suspenso) then perform interno.erro('conta_suspensa'); end if;
  perform interno.limite('rede2_ler', 600, 60);
  v_aba := interno.rede_aba(coalesce(p_aba, ''), v_quem);
  if nullif(p_cursor, '') is not null then
    begin
      v_t := split_part(p_cursor, '|', 1)::timestamptz;
      v_id := split_part(p_cursor, '|', 2)::uuid;
    exception when others then
      perform interno.erro('invalido:cursor');
    end;
  end if;
  select coalesce(jsonb_agg(interno.rede_post_v2(r, v_quem) order by r.criado_em desc, r.id desc), '[]'::jsonb), count(*)::integer into v_itens, v_n
  from rede_posts r where r.id in (
    select p.id from rede_posts p
    where (v_t is null or (p.criado_em, p.id) < (v_t, v_id))
      and interno.rede_na_aba(p, v_aba, v_quem) and interno.rede_ve(p, v_quem) and not interno.rede_silenciado(p, v_quem)
    order by p.criado_em desc, p.id desc
    limit v_limite + 1);
  if v_n > v_limite then
    select coalesce(jsonb_agg(e.valor order by e.n), '[]'::jsonb) into v_itens from jsonb_array_elements(v_itens) with ordinality e(valor, n) where e.n <= v_limite;
    v_ultimo := v_itens -> (v_limite - 1);
    v_proximo := (v_ultimo ->> 'criado_em') || '|' || (v_ultimo ->> 'id');
  end if;
  return jsonb_build_object('itens', v_itens, 'proximo', v_proximo);
end $$;

/**
 * O contador "N novos" de uma aba: quantos posts de primeiro nível chegaram desde p_desde, de outras pessoas, que esta pessoa pode ver.
 * Mesma regra da linha (matriz e silenciados). Só um número: nada do conteúdo.
 */
create or replace function public.rede_novos(p_aba text, p_desde timestamptz) returns integer language plpgsql stable security definer set search_path = interno, pg_temp as $$
declare v_quem uuid := auth.uid(); v_aba text;
begin
  if p_desde is null then return 0; end if;
  v_aba := interno.rede_aba(coalesce(p_aba, ''), v_quem);
  return (select count(*)::integer from rede_posts p
    where p.criado_em > p_desde and p.autor is distinct from v_quem
      and interno.rede_na_aba(p, v_aba, v_quem) and interno.rede_ve(p, v_quem) and not interno.rede_silenciado(p, v_quem));
end $$;

/** Um post com o corpo inteiro, a cadeia de quem ele responde (só o que se pode ver) e a conversa abaixo dele (até 10 níveis, 400 posts). */
create or replace function public.rede_post(p_id uuid) returns jsonb language plpgsql volatile security definer set search_path = interno, pg_temp as $$
declare v_quem uuid := auth.uid(); x rede_posts; v_resp jsonb; v_cima jsonb;
begin
  perform interno.aberta('comunidade');
  perform interno.limite('rede2_ler', 600, 60);
  select * into x from rede_posts where id = p_id;
  if not found or not interno.rede_ve(x, v_quem) then perform interno.erro('nao_encontrado'); end if;
  with recursive arv(id, n) as (
    select r.id, 1 from rede_posts r where r.resposta_a = x.id and interno.rede_ve(r, v_quem)
    union all
    select r.id, a.n + 1 from rede_posts r join arv a on r.resposta_a = a.id where interno.rede_ve(r, v_quem) and a.n < 10)
  select coalesce(jsonb_agg(interno.rede_post_v2(r, v_quem) order by r.criado_em, r.id), '[]'::jsonb) into v_resp
  from rede_posts r where r.id in (select arv.id from arv limit 400);
  with recursive cima(id, n) as (
    select x.resposta_a, 1 where x.resposta_a is not null
    union all
    select r.resposta_a, c.n + 1 from rede_posts r join cima c on r.id = c.id where r.resposta_a is not null and c.n < 10)
  select coalesce(jsonb_agg(interno.rede_post_v2(r, v_quem) order by r.profundidade), '[]'::jsonb) into v_cima
  from rede_posts r where r.id in (select cima.id from cima) and interno.rede_ve(r, v_quem);
  return jsonb_build_object('post', interno.rede_post_v2(x, v_quem, true), 'acima', v_cima, 'respostas', v_resp);
end $$;

-- ── 4. Quem sou eu na Rede, a comunidade e o perfil ────────────────────────────────────────────────────────────────────

/** Onde esta pessoa está na Rede: o que a casca precisa para decidir entre a linha, a primeira entrada e o convite a entrar. */
create or replace function public.rede_situacao() returns jsonb language plpgsql stable security definer set search_path = interno, pg_temp as $$
declare v uuid := auth.uid(); f perfis; v_regras integer;
begin
  v_regras := coalesce((select max(versao) from rede_regras), 1);
  if v is null then return jsonb_build_object('logado', false, 'membro', false, 'regras_versao', v_regras); end if;
  select * into f from perfis where id = v;
  if not found then return jsonb_build_object('logado', true, 'membro', false, 'regras_versao', v_regras); end if;
  return jsonb_build_object(
    'logado', true, 'suspenso', f.suspenso, 'membro', interno.rede2_membro(v),
    'maior', f.rede_18, 'consentimento', f.rede_consentimento, 'regras_versao', v_regras,
    'codinome', f.rede_codinome, 'codinome_ok', f.rede_codinome_ok and f.rede_codinome is not null,
    'handle', f.rede_handle, 'modo', f.rede_modo, 'equipe', interno.voluntario_e(v), 'cuida', interno.cuida());
end $$;

/**
 * Entrar na Rede: declara ter 18 anos ou mais e consente, de forma específica e destacada, com as normas (LGPD art. 11, I: a
 * conversa política pode revelar opinião política e filiação sindical). Sem 18 anos não entra: o resto do site continua aberto.
 * Dá para revogar depois (o pacote consertos acrescenta a tela); a versão é a das normas em vigor.
 */
create or replace function public.rede_aderir(p_maior boolean, p_versao integer) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); v_vigente integer := coalesce((select max(versao) from rede_regras), 1);
begin
  perform interno.aberta('comunidade');
  perform interno.limite('rede2_aderir', 20, 60);
  if not coalesce(p_maior, false) then perform interno.erro('idade_minima'); end if;
  if p_versao is distinct from v_vigente then perform interno.erro('invalido:versao'); end if;
  update perfis set rede_18 = true, rede_consentimento = v_vigente where id = v;
  if not exists (select 1 from rede_consentimentos c where c.usuario = v and c.versao = v_vigente and c.revogado_em is null) then
    insert into rede_consentimentos (usuario, versao) values (v, v_vigente);
  end if;
  perform interno.registrar('rede_aderir', '', jsonb_build_object('versao', v_vigente));
  return public.rede_situacao();
end $$;

/** A página de uma comunidade: cabeçalho, regras, etiquetas, moderação por codinome. Comunidade fechada não existe para quem não é dela. */
create or replace function public.rede_comunidade(p_slug text) returns jsonb language plpgsql stable security definer set search_path = interno, pg_temp as $$
declare v uuid := auth.uid(); c rede_comunidades;
begin
  select * into c from rede_comunidades k where k.slug = coalesce(p_slug, '') or coalesce(p_slug, '') = any (k.apelidos) order by (k.slug = coalesce(p_slug, '')) desc limit 1;
  if not found then perform interno.erro('nao_encontrado'); end if;
  if c.tipo = 'fechada' and not interno.rede2_na_comunidade(c.slug, v) then perform interno.erro('nao_encontrado'); end if;
  -- As lutas e o Instituto são para quem entrou; só as disciplinas se leem sem conta (decisão 2).
  if c.categoria <> 'disciplinas' and v is null then perform interno.erro('entre_primeiro'); end if;
  return jsonb_build_object(
    'slug', c.slug, 'nome', c.nome, 'descricao', c.descricao, 'categoria', c.categoria, 'tipo', c.tipo, 'publico_padrao', c.publico_padrao,
    'icone', c.icone, 'cor', c.cor, 'aulas', to_jsonb(c.aulas), 'trilhas', to_jsonb(c.trilhas),
    'regras', (select coalesce(jsonb_agg(jsonb_build_object('numero', r.numero, 'titulo', r.titulo, 'texto', r.texto) order by r.numero), '[]'::jsonb) from rede_comunidade_regras r where r.comunidade = c.slug),
    'etiquetas', (select coalesce(jsonb_agg(jsonb_build_object('nome', f.nome, 'cor', f.cor) order by f.nome), '[]'::jsonb) from rede_comunidade_flairs f where f.comunidade = c.slug),
    'moderacao', (select coalesce(jsonb_agg(interno.rede_nome(m.usuario) order by m.entrou_em), '[]'::jsonb) from rede_comunidade_membros m where m.comunidade = c.slug and m.papel = 'moderacao' and m.situacao = 'ativo'),
    'membro', interno.rede2_na_comunidade(c.slug, v),
    'banido', v is not null and exists (select 1 from rede_comunidade_membros m where m.comunidade = c.slug and m.usuario = v and (m.situacao = 'banido' or m.banido_ate > now())));
end $$;

/** O alto da página de um perfil, pelo @handle. Perfil invisível ou bloqueado (em qualquer lado) não existe. Só codinome: nunca o nome do painel. */
create or replace function public.rede_perfil_de(p_handle text) returns jsonb language plpgsql stable security definer set search_path = interno, pg_temp as $$
declare v uuid := auth.uid(); f perfis; v_handle text := lower(btrim(coalesce(p_handle, ''), ' @'));
begin
  if v is null then perform interno.erro('entre_primeiro'); end if;
  select * into f from perfis where rede_handle = v_handle;
  if not found or (f.id <> v and (f.rede_modo = 'invisivel' or f.rede_invisivel or interno.rede_bloqueado(v, f.id))) then perform interno.erro('nao_encontrado'); end if;
  return jsonb_build_object(
    'id', f.id, 'codinome', f.rede_codinome, 'handle', f.rede_handle, 'bio', f.rede_bio, 'modo', f.rede_modo, 'selos', to_jsonb(f.rede_selos),
    'equipe', interno.voluntario_e(f.id), 'meu', f.id = v,
    'sigo', exists (select 1 from rede_seguindo s where s.quem = v and s.segue = f.id and not s.pendente),
    'pendente', exists (select 1 from rede_seguindo s where s.quem = v and s.segue = f.id and s.pendente),
    'fixado', case when f.rede_fixado is not null then (select interno.rede_post_v2(o, v) from rede_posts o where o.id = f.rede_fixado and o.autor = f.id and interno.rede_ve(o, v)) end);
end $$;

-- ── 5. Publicar ────────────────────────────────────────────────────────────────────────────────────────────────────────

/**
 * A triagem de um texto antes de aparecer: o veredito automático (interno.veredito), o modo de segurança (aprovação manual) e a
 * segunda avaliação, feita fora do banco pela função avaliar-comunidade. Devolve {veredito, motivo, externa}. Com externa = true o
 * post nasce retido ("aguardando_avaliacao") e quem publicou chama a avaliação externa para ele (pacote consertos).
 */
create or replace function interno.rede_triagem(p_texto text, p_autor uuid) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v_av jsonb := interno.veredito(p_texto, interno.cuida(), p_autor); v_ver text := v_av ->> 'veredito'; v_motivo text := coalesce(v_av ->> 'motivo', ''); v_externa boolean := false;
begin
  if v_ver = 'publicar' and interno.aprovacao_manual() and not interno.cuida() then
    v_ver := 'revisar'; v_motivo := 'modo_seguranca';
  elsif v_ver = 'publicar' and interno.avaliacao_externa() then
    v_ver := 'revisar'; v_motivo := 'aguardando_avaliacao'; v_externa := true;
  end if;
  return jsonb_build_object('veredito', v_ver, 'motivo', v_motivo, 'externa', v_externa);
end $$;

/**
 * Publicar. Campos de p: tipo ('post', 'discussao', 'duvida'; 'aviso' só da equipe), texto (post e aviso, até 500), titulo e corpo
 * (discussão e dúvida: 5 a 140 e 10 a 10.000), publico ('internet' só em comunidade de disciplina, 'membros', 'seguidores',
 * 'comunidade', 'nucleo' com o campo nucleo, 'equipe' só da equipe), comunidade, flair, aviso (aviso de conteúdo, até 80) e
 * resposta_a (uma resposta herda comunidade, núcleo e público do que responde: nada amplia o alcance de um post restrito).
 * Confere: conta ativa, 18+ e consentimento (membro da Rede), codinome confirmado, limite, dado pessoal (CPF, telefone, e-mail),
 * comunidade (existe, não banido, restrita e fechada só para quem é dela), árvore (até 6 níveis, conversa travada) e a triagem.
 * Devolve o post como a v2 mostra, com "avaliar" = true quando falta a avaliação externa.
 * Os pacotes publicar e comunidades acrescentam enquete, chamado, mídia, rascunho e agendamento redefinindo esta função como
 * superconjunto (mesma assinatura, mesmas conferências): docs/rede/V2.md.
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
  v_resposta uuid; v_nucleo uuid; v_tri jsonb; v_ver text; v_tudo text;
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
  if v_tipo not in ('post', 'discussao', 'duvida', 'aviso') then perform interno.erro('invalido:tipo'); end if;
  if v_tipo = 'aviso' and not interno.voluntario() then perform interno.erro('sem_permissao'); end if;
  if v_resposta is not null and v_tipo <> 'post' then perform interno.erro('invalido:tipo'); end if;
  perform interno.rede2_limite(case when v_resposta is not null then 'responder' else 'postar' end);

  if v_tipo in ('discussao', 'duvida') then
    v_titulo := interno.txt(p ->> 'titulo', 'titulo', 5, 140);
    v_corpo := interno.txt(p ->> 'corpo', 'corpo', 10, 10000);
    v_texto := left(v_corpo, 500);
  else
    v_texto := interno.txt(p ->> 'texto', 'texto', 1, 500);
    v_titulo := case when v_tipo = 'aviso' then nullif(left(btrim(coalesce(p ->> 'titulo', '')), 140), '') end;
  end if;
  -- Dado pessoal não vai para a Rede: CPF, telefone e e-mail (LGPD, minimização).
  v_tudo := coalesce(v_titulo, '') || ' ' || v_texto || ' ' || coalesce(v_corpo, '');
  if v_tudo ~ '\d{3}\.?\d{3}\.?\d{3}-?\d{2}' or v_tudo ~ '\(?\d{2}\)?\s?9\d{4}[-\s]?\d{4}' or v_tudo ~* '[a-z0-9._%+-]+@[a-z0-9-]+\.[a-z.]{2,}' then
    perform interno.erro('dado_pessoal');
  end if;

  if v_resposta is not null then
    select * into o from rede_posts where id = v_resposta;
    if not found or not interno.rede_ve(o, v) or o.oculto or o.retido or o.apagado_em is not null then perform interno.erro('nao_encontrado'); end if;
    select * into v_raiz from rede_posts where id = coalesce(o.root_id, o.id);
    if o.travado or v_raiz.travado then perform interno.erro('travado'); end if;
    if o.profundidade >= 6 then perform interno.erro('limite_de_niveis'); end if;
    v_com := o.comunidade; v_nucleo := o.nucleo; v_publico := interno.rede2_publico(o); v_flair := null;
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
    if v_publico = 'internet' and (c.slug is null or c.categoria <> 'disciplinas') then perform interno.erro('invalido:publico'); end if;
    if v_publico = 'comunidade' and c.slug is null then perform interno.erro('invalido:publico'); end if;
    if v_publico = 'nucleo' then
      if v_nucleo is null or not interno.rede2_no_nucleo(v_nucleo, v) then perform interno.erro('sem_permissao'); end if;
    else
      v_nucleo := null;
    end if;
    if v_publico = 'equipe' and not interno.voluntario() then perform interno.erro('sem_permissao'); end if;
    if v_flair is not null and not exists (select 1 from rede_comunidade_flairs f where f.comunidade = v_com and f.nome = v_flair) then perform interno.erro('invalido:flair'); end if;
  end if;

  v_tri := interno.rede_triagem(v_tudo, v);
  v_ver := v_tri ->> 'veredito';
  insert into rede_posts (autor, tipo, titulo, texto, corpo, comunidade, resposta_a, publico, alcance, nucleo, flair, aviso, oculto, retido, avaliacao, motivo)
  values (v, v_tipo, v_titulo, v_texto, v_corpo, v_com, v_resposta, v_publico, interno.rede_alcance(v_publico), v_nucleo, v_flair, v_aviso,
          v_ver <> 'publicar', v_ver = 'revisar', case v_ver when 'publicar' then 'publicada' when 'bloquear' then 'bloqueada' else 'revisao' end, coalesce(v_tri ->> 'motivo', ''))
  returning * into x;
  if v_resposta is not null and o.autor is distinct from v and not x.oculto and not interno.rede_bloqueado(v, o.autor) then
    perform interno.avisar_em(o.autor, format('%s respondeu ao seu post na Rede Lúcia: “%s”', interno.rede_nome(v), left(v_texto, 120)), 'rede');
  end if;
  return interno.rede_post_v2(x, v, true) || jsonb_build_object('avaliar', coalesce((v_tri ->> 'externa')::boolean, false));
exception when check_violation then perform interno.erro('invalido:post');
end $$;

-- ── 5b. Reagir e salvar ───────────────────────────────────────────────────────────────────────────────────────────────

/**
 * Apoiar ('apoio') ou marcar como útil ('util'), ou desfazer. Só membro da Rede, só o que se pode ver, nunca no próprio post. A resposta
 * traz só o que a própria pessoa precisa saber (se apoiou, se achou útil) e o total de "útil", que é público. O total de apoios NUNCA
 * volta aqui: só o autor o vê, na linha (decisão 3: o número de apoios e a lista de quem apoiou podem revelar adesão política, LGPD art. 11).
 * Sem aviso ao autor: um aviso por apoio diria quem apoiou.
 */
create or replace function public.rede_reagir(p_post uuid, p_tipo text, p_sim boolean) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); x rede_posts;
begin
  perform interno.aberta('comunidade');
  if p_tipo is null or p_tipo not in ('apoio', 'util') then perform interno.erro('invalido:tipo'); end if;
  if not interno.rede2_membro(v) then perform interno.erro('consentimento'); end if;
  select * into x from rede_posts where id = p_post;
  if not found or not interno.rede_ve(x, v) or x.oculto or x.retido or x.apagado_em is not null then perform interno.erro('nao_encontrado'); end if;
  if x.autor = v then perform interno.erro('sem_permissao'); end if;
  perform interno.rede2_limite('reagir');
  if coalesce(p_sim, false) then
    insert into rede_reacoes (post, usuario, tipo) values (p_post, v, p_tipo) on conflict do nothing;
  else
    delete from rede_reacoes where post = p_post and usuario = v and tipo = p_tipo;
    if p_tipo = 'apoio' then delete from rede_apoios where post = p_post and usuario = v; end if;
  end if;
  return jsonb_build_object(
    'apoiei', exists (select 1 from rede_reacoes r where r.post = p_post and r.usuario = v and r.tipo = 'apoio') or exists (select 1 from rede_apoios a where a.post = p_post and a.usuario = v),
    'util_eu', exists (select 1 from rede_reacoes r where r.post = p_post and r.usuario = v and r.tipo = 'util'),
    'util', (select count(*)::integer from rede_reacoes r where r.post = p_post and r.tipo = 'util'));
end $$;

/** Guardar um post para ler depois (privado, no servidor). Só o que se pode ver. */
create or replace function public.rede_salvar(p_post uuid, p_sim boolean) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); x rede_posts;
begin
  perform interno.aberta('comunidade');
  select * into x from rede_posts where id = p_post;
  if not found or not interno.rede_ve(x, v) or x.oculto or x.retido or x.apagado_em is not null then perform interno.erro('nao_encontrado'); end if;
  perform interno.rede2_limite('salvar');
  if coalesce(p_sim, false) then insert into rede_salvos (usuario, post) values (v, p_post) on conflict do nothing;
  else delete from rede_salvos where usuario = v and post = p_post; end if;
  return jsonb_build_object('salvei', exists (select 1 from rede_salvos s where s.usuario = v and s.post = p_post));
end $$;

-- ── 6. Fórum → Rede (idempotente, sem apagar nada) ───────────────────────────────────────────────────────────────────

/**
 * Leva os tópicos, as respostas e os votos úteis do Fórum para rede_posts (o que ainda está retido esperando a mediação fica de fora até ser aprovado), guardando o mapa "id antigo → id novo" em rede_migracao
 * (tipos 'topico', 'resposta', 'voto' e 'comunidade'). As tabelas antigas ficam intactas: dá para voltar. Pode rodar quantas vezes
 * quiser: só leva o que ainda não está no mapa (rode de novo antes de abrir a v2, para pegar o que chegou depois). Nenhum aviso é
 * disparado. Tópico vira 'duvida' ou 'discussao' (título, corpo, disciplina → comunidade, aceita, trancado → travado); resposta vira
 * resposta na árvore (resposta de resposta preservada até o 6º nível; abaixo disso sobe para o ancestral do 5º); voto +1 vira
 * 'util' (voto -1 não tem par na v2 e fica só no banco antigo). O conteúdo das disciplinas segue público para a internet; sem
 * disciplina, vira "membros". O "alcance" da Rede de hoje fica 'equipe' para que a Rede de hoje não os mostre na linha dela.
 */
create or replace function interno.rede_migrar_forum() returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare
  t record; r record; v record;
  v_novo uuid; v_pai uuid; v_pai_post rede_posts; v_topico_post rede_posts; v_com text; v_publico text; v_alvo uuid;
  n_t integer := 0; n_r integer := 0; n_v integer := 0; n_c integer := 0; v_passos integer;
begin
  -- Uma comunidade por disciplina que já teve conversa (as de lib/areas entram pelo pacote comunidades, com nome e descrição de verdade).
  for t in select distinct disciplina as d from topicos where disciplina is not null and disciplina ~ '^[a-z0-9-]{2,60}$' loop
    if not exists (select 1 from rede_comunidades c where c.slug = t.d or t.d = any (c.apelidos)) then
      insert into rede_comunidades (slug, nome, categoria, tipo, publico_padrao)
      values (t.d, case when char_length(t.d) < 3 then 'Sala ' || t.d else left(initcap(replace(t.d, '-', ' ')), 60) end, 'disciplinas', 'aberta', 'internet')
      on conflict (slug) do nothing;
      n_c := n_c + 1;
    end if;
  end loop;

  for t in select tp.* from topicos tp where not coalesce(tp.retido, false) and not exists (select 1 from rede_migracao m where m.tipo = 'topico' and m.antigo = tp.id::text) order by tp.criado_em, tp.id loop
    v_com := (select c.slug from rede_comunidades c where c.slug = t.disciplina or t.disciplina = any (c.apelidos) order by (c.slug = t.disciplina) desc limit 1);
    v_publico := case when v_com is not null and exists (select 1 from rede_comunidades c where c.slug = v_com and c.categoria = 'disciplinas') then 'internet' else 'membros' end;
    v_novo := gen_random_uuid();
    insert into rede_posts (id, autor, tipo, titulo, texto, corpo, comunidade, publico, alcance, oculto, retido, avaliacao, motivo, travado, cita, criado_em)
    values (v_novo, t.autor, case when t.tipo = 'duvida' then 'duvida' else 'discussao' end, left(t.titulo, 140),
            coalesce(nullif(btrim(left(t.corpo, 500)), ''), '…'), left(t.corpo, 10000), v_com, v_publico, 'equipe',
            t.oculto, coalesce(t.retido, false), t.avaliacao, coalesce(t.motivo, ''), t.trancado,
            case when t.alvo is not null then jsonb_build_object('tipo', case when t.alvo like '/trilhas/%' then 'aula' else 'obra' end, 'caminho', t.alvo, 'titulo', coalesce(t.alvo_titulo, '')) end,
            t.criado_em);
    insert into rede_migracao (tipo, antigo, novo) values ('topico', t.id::text, v_novo::text);
    if t.disciplina is not null and v_com is not null and v_com <> t.disciplina then
      insert into rede_migracao (tipo, antigo, novo) values ('comunidade', t.disciplina, v_com) on conflict do nothing;
    end if;
    n_t := n_t + 1;
  end loop;

  -- Respostas do mais antigo para o mais novo: o pai (uma resposta ou o tópico) já está na Rede quando o filho entra.
  for r in select rs.* from respostas rs where not exists (select 1 from rede_migracao m where m.tipo = 'resposta' and m.antigo = rs.id::text) order by rs.criado_em, rs.id loop
    -- Resposta ainda retida (esperando a mediação) fica no Fórum até ser aprovada: a Rede nova a leva na próxima rodada, e a fila de moderação não duplica.
    continue when coalesce(r.retido, false);
    continue when r.pai is not null and not exists (select 1 from rede_migracao m3 where m3.tipo = 'resposta' and m3.antigo = r.pai::text);
    select * into v_topico_post from rede_posts where id = (select novo::uuid from rede_migracao where tipo = 'topico' and antigo = r.topico::text);
    continue when v_topico_post.id is null;
    v_pai := coalesce((select novo::uuid from rede_migracao where tipo = 'resposta' and antigo = r.pai::text), v_topico_post.id);
    select * into v_pai_post from rede_posts where id = v_pai;
    v_passos := 0;
    while v_pai_post.profundidade >= 6 and v_pai_post.resposta_a is not null and v_passos < 40 loop
      select * into v_pai_post from rede_posts where id = v_pai_post.resposta_a;
      v_passos := v_passos + 1;
    end loop;
    v_novo := gen_random_uuid();
    insert into rede_posts (id, autor, tipo, texto, corpo, comunidade, resposta_a, publico, alcance, oculto, retido, avaliacao, motivo, criado_em)
    values (v_novo, r.autor, 'post', coalesce(nullif(btrim(left(r.corpo, 500)), ''), '…'), case when char_length(r.corpo) > 500 then left(r.corpo, 10000) end,
            v_topico_post.comunidade, v_pai_post.id, v_topico_post.publico, 'equipe', r.oculto, coalesce(r.retido, false), r.avaliacao, coalesce(r.motivo, ''), r.criado_em);
    insert into rede_migracao (tipo, antigo, novo) values ('resposta', r.id::text, v_novo::text);
    n_r := n_r + 1;
  end loop;

  -- A resposta aceita de cada dúvida.
  update rede_posts p set aceita = (select m2.novo::uuid from rede_migracao m2 where m2.tipo = 'resposta' and m2.antigo = tp.aceita::text)
  from rede_migracao m join topicos tp on tp.id::text = m.antigo
  where m.tipo = 'topico' and p.id = m.novo::uuid and tp.aceita is not null and p.aceita is null
    and exists (select 1 from rede_migracao m2 where m2.tipo = 'resposta' and m2.antigo = tp.aceita::text);

  -- Votos úteis (+1). Quem votou continua sem aparecer em lugar nenhum: a v2 só devolve totais.
  for v in select vt.* from votos vt where vt.valor = 1 and not exists (select 1 from rede_migracao m where m.tipo = 'voto' and m.antigo = vt.usuario::text || ':' || vt.tipo || ':' || vt.alvo::text) loop
    v_alvo := (select m.novo::uuid from rede_migracao m where m.tipo = v.tipo and m.antigo = v.alvo::text);
    continue when v_alvo is null;
    insert into rede_reacoes (post, usuario, tipo) values (v_alvo, v.usuario, 'util') on conflict do nothing;
    insert into rede_migracao (tipo, antigo, novo) values ('voto', v.usuario::text || ':' || v.tipo || ':' || v.alvo::text, v_alvo::text);
    n_v := n_v + 1;
  end loop;
  return jsonb_build_object('comunidades', n_c, 'topicos', n_t, 'respostas', n_r, 'votos', n_v);
end $$;

/**
 * Para onde vai um endereço antigo do Fórum: ?t=<id do tópico> → o post novo; ?sala=<disciplina> → a comunidade (o apelido vira o nome
 * novo); ?sala=fechado-… → o espaço migrado. Só devolve o par de endereços (nada de conteúdo): quem abrir o destino ainda passa pela
 * matriz. Usado pelo proxy para o redirecionamento 301. Devolve {tipo: 'post'|'comunidade', novo} ou nulo.
 */
create or replace function public.rede_antigo(p_tipo text, p_antigo text) returns jsonb language plpgsql stable security definer set search_path = interno, pg_temp as $$
declare v_novo text;
begin
  if p_tipo = 'topico' and coalesce(p_antigo, '') ~ '^[0-9a-f-]{36}$' then
    select m.novo into v_novo from rede_migracao m where m.tipo = 'topico' and m.antigo = p_antigo;
    if v_novo is not null then return jsonb_build_object('tipo', 'post', 'novo', v_novo); end if;
  elsif p_tipo = 'sala' and coalesce(p_antigo, '') ~ '^[a-z0-9-]{2,60}$' then
    select c.slug into v_novo from rede_comunidades c where c.slug = p_antigo or p_antigo = any (c.apelidos) order by (c.slug = p_antigo) desc limit 1;
    if v_novo is null then select m.novo into v_novo from rede_migracao m where m.tipo in ('comunidade', 'espaco') and m.antigo = p_antigo limit 1; end if;
    if v_novo is not null then return jsonb_build_object('tipo', 'comunidade', 'novo', v_novo); end if;
  end if;
  return null;
end $$;

-- ── 7. Permissões ───────────────────────────────────────────────────────────────────────────────────────────────────────
-- Nenhuma função interna é chamável de fora. As públicas: leitura aberta a quem tem a chave (a matriz decide o que cada um vê);
-- escrita só para conta (a própria função confere a sessão).
revoke all on function interno.rede_ve(interno.rede_posts, uuid), interno.rede_silenciado(interno.rede_posts, uuid), interno.rede_alcance(text),
  interno.rede_post_v2(interno.rede_posts, uuid, boolean), interno.rede_aba(text, uuid), interno.rede_na_aba(interno.rede_posts, text, uuid),
  interno.rede_triagem(text, uuid), interno.rede_migrar_forum() from public;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on function interno.rede_ve(interno.rede_posts, uuid), interno.rede_silenciado(interno.rede_posts, uuid), interno.rede_alcance(text),
      interno.rede_post_v2(interno.rede_posts, uuid, boolean), interno.rede_aba(text, uuid), interno.rede_na_aba(interno.rede_posts, text, uuid),
      interno.rede_triagem(text, uuid), interno.rede_migrar_forum() from anon, authenticated;
    revoke all on function public.rede_linha(text, text, integer), public.rede_novos(text, timestamptz), public.rede_post(uuid), public.rede_situacao(),
      public.rede_aderir(boolean, integer), public.rede_comunidade(text), public.rede_perfil_de(text), public.rede_publicar(jsonb), public.rede_antigo(text, text),
      public.rede_reagir(uuid, text, boolean), public.rede_salvar(uuid, boolean) from public;
    -- Leitura: com ou sem conta (a matriz e a aba decidem o que sai).
    grant execute on function public.rede_linha(text, text, integer), public.rede_novos(text, timestamptz), public.rede_post(uuid), public.rede_situacao(),
      public.rede_comunidade(text), public.rede_antigo(text, text) to anon, authenticated, service_role;
    -- Escrita e perfil: só com conta.
    revoke all on function public.rede_aderir(boolean, integer), public.rede_perfil_de(text), public.rede_publicar(jsonb), public.rede_reagir(uuid, text, boolean), public.rede_salvar(uuid, boolean) from anon;
    grant execute on function public.rede_aderir(boolean, integer), public.rede_perfil_de(text), public.rede_publicar(jsonb), public.rede_reagir(uuid, text, boolean), public.rede_salvar(uuid, boolean) to authenticated, service_role;
  end if;
end $$;

-- Leva o Fórum agora (e de novo, sem estrago, a cada vez que este arquivo rodar): o que chegou depois entra, o que já entrou fica.
select interno.rede_migrar_forum();
