-- ───────────────────────────── Alumia, onda 13: sair da Alumia ─────────────────────────────
-- Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
--
-- Frente 13C. O que deixa um post, uma comunidade ou a lista de quem eu sigo sair da Alumia, com a regra escrita aqui:
--
--   1. O QUE PODE SAIR (interno.alumia_alc_sai): só o post de primeiro nível, de público "internet", que quem não tem conta já vê
--      (a mesma matriz: interno.rede_ve com visitante), que não está fora do Fediverso nem não listado, arquivado, com prazo para
--      sumir ou na roda (interno.rede_vida_federa), de comunidade ABERTA (ou de perfil), de conta que não está suspensa, trancada,
--      invisível nem fora da busca. Com a trava da entrada ligada, NADA sai (e a porta, no fim, fecha as funções para visitante).
--      O público é o de fato (interno.rede2_publico): pela matriz de hoje, "internet" só vale em comunidade de disciplina; em
--      qualquer outro lugar o post é de membros e não sai. Se a matriz mudar, esta regra acompanha sem mudar uma linha.
--   2. RSS (public.rede_alc_rss): de uma comunidade aberta, ou do perfil de uma ORGANIZAÇÃO COM SELO (a regra de quem vê perfil sem
--      conta: de pessoa, nada; os posts dela saem pelas comunidades abertas). Desligado no painel ("alumia-alcance"), nulo também
--      para quem chama o banco direto (a decisão do painel em interno.recursos_vivos). Até 30 posts, dos últimos 120 dias. Só título,
--      texto, aviso de conteúdo, codinome, @ e comunidade: nenhuma foto, nenhum lugar de ato, nenhum número.
--   3. CARTÃO PARA COLAR EM OUTRO SITE (public.rede_alc_post): o mesmo post, pela mesma regra. O servidor do site monta o HTML,
--      sem script nenhum, com a política de segurança e o sandbox dele (app/api/rede/embed).
--   4. QUEM EU SIGO (public.rede_alc_seguindo): a lista é só da pessoa. Devolve os @ daqui (sem quem está invisível, suspensa ou
--      só pediu e não foi aceita) e os @nome@servidor de fora, para ela baixar num arquivo. Importar usa as funções que já existem
--      (rede_perfil_seguir e a rota do Fediverso da Faixa 2), uma a uma, com os limites delas.
--
-- Nenhuma tabela nova. Nenhum endereço de rede é guardado. Nenhuma função devolve lista de quem segue, curtiu ou viu. As funções
-- são security definer com search_path fixo; as públicas passam pela porta da entrada (interno.alumia_trancar, no fim). Nenhuma
-- função recebe parâmetro do tipo linha de tabela com valor padrão.
--
-- Pode rodar mais de uma vez, sem apagar dado nenhum. Roda DEPOIS das migrações da onda 12.
-- Teste: scripts/testar-alumia-o13-alcance.mjs.

-- ── 1. O que pode sair ────────────────────────────────────────────────────────────────────────────────────────────────────

/** A conta que escreveu deixa os posts dela saírem? Nem suspensa, nem trancada, nem invisível, nem fora da busca, e com @. */
create or replace function interno.alumia_alc_conta_sai(p_autor uuid) returns boolean language sql stable security definer set search_path = interno, pg_temp as $$
  select exists (
    select 1 from perfis f where f.id = p_autor and not f.suspenso and f.rede_handle is not null
      and coalesce(f.rede_modo, 'aberto') = 'aberto' and not coalesce(f.rede_invisivel, false) and not coalesce(f.rede_fora_da_busca, false))
$$;

/** Este post pode sair da Alumia (RSS e cartão para colar em outro site)? Regra no alto do arquivo. */
create or replace function interno.alumia_alc_sai(p interno.rede_posts) returns boolean language sql stable security definer set search_path = interno, pg_temp as $$
  select p.id is not null
    and not interno.alumia_exigida()
    and p.resposta_a is null
    and not p.oculto and not p.retido and p.apagado_em is null
    and interno.rede2_publico(p) = 'internet'
    and coalesce(interno.rede_vida_federa(p), false)
    and coalesce(interno.rede_ve(p, null), false)
    and (p.comunidade is null
         or exists (select 1 from rede_comunidades c where c.slug = p.comunidade and c.tipo = 'aberta' and c.slug not like 'fechado-%'))
    and interno.alumia_alc_conta_sai(p.autor)
$$;

/** O post como sai: só o que quem não tem conta já lê na página do post, sem foto, sem lugar de ato e sem número. */
create or replace function interno.alumia_alc_item(p interno.rede_posts) returns jsonb language sql stable security definer set search_path = interno, pg_temp as $$
  select jsonb_build_object(
    'id', p.id, 'tipo', p.tipo, 'titulo', p.titulo, 'texto', left(coalesce(p.texto, ''), 4000), 'longo', p.corpo is not null,
    'aviso', coalesce(p.aviso, ''), 'criado_em', p.criado_em, 'editado_em', p.editado_em,
    'comunidade', case when p.comunidade is not null then jsonb_build_object('slug', c.slug, 'nome', c.nome) end,
    'autor', jsonb_build_object('codinome', interno.rede_nome(p.autor), 'handle', f.rede_handle))
  from perfis f left join rede_comunidades c on c.slug = p.comunidade
  where f.id = p.autor
$$;

-- ── 2. RSS ────────────────────────────────────────────────────────────────────────────────────────────────────────────────

/**
 * O canal RSS de uma comunidade aberta (p_tipo 'comunidade', p_nome = slug) ou do perfil de uma organização com selo (p_tipo
 * 'perfil', p_nome = @). Nulo quando não existe, não pode sair ou a trava da entrada está ligada (a rota responde 404 igual).
 */
create or replace function public.rede_alc_rss(p_tipo text, p_nome text) returns jsonb language plpgsql stable security definer set search_path = interno, pg_temp as $$
declare v_nome text := lower(btrim(coalesce(p_nome, ''), ' @')); f perfis; c rede_comunidades; v_itens jsonb;
begin
  if interno.alumia_exigida() or exists (select 1 from recursos_vivos where nome in ('rede-v2', 'alumia-2', 'alumia-alcance') and not ligado) then return null; end if;
  if p_tipo = 'perfil' then
    if v_nome !~ '^[a-z0-9_]{3,20}$' then return null; end if;
    select * into f from perfis x where x.rede_handle = v_nome;
    if not found or not interno.alumia_alc_conta_sai(f.id)
       or not exists (select 1 from rede_orgs o where o.perfil = f.id and o.verificada_em is not null) then
      return null;
    end if;
    select coalesce(jsonb_agg(interno.alumia_alc_item(y) order by y.criado_em desc), '[]'::jsonb) into v_itens
      from rede_posts y
     where y.id in (select p.id from rede_posts p
                     where p.autor = f.id and p.resposta_a is null and p.apagado_em is null and p.criado_em > now() - interval '120 days'
                       and interno.alumia_alc_sai(p)
                     order by p.criado_em desc limit 30);
    return jsonb_build_object('tipo', 'perfil', 'nome', f.rede_handle, 'titulo', interno.rede_nome(f.id), 'descricao', '', 'itens', v_itens);
  elsif p_tipo = 'comunidade' then
    if v_nome !~ '^[a-z0-9-]{2,60}$' or v_nome like 'fechado-%' then return null; end if;
    select * into c from rede_comunidades x where x.slug = v_nome and x.tipo = 'aberta';
    if not found then return null; end if;
    select coalesce(jsonb_agg(interno.alumia_alc_item(y) order by y.criado_em desc), '[]'::jsonb) into v_itens
      from rede_posts y
     where y.id in (select p.id from rede_posts p
                     where p.comunidade = c.slug and p.resposta_a is null and p.apagado_em is null and p.criado_em > now() - interval '120 days'
                       and interno.alumia_alc_sai(p)
                     order by p.criado_em desc limit 30);
    return jsonb_build_object('tipo', 'comunidade', 'nome', c.slug, 'titulo', c.nome, 'descricao', c.descricao, 'itens', v_itens);
  end if;
  return null;
end $$;

-- ── 3. O cartão para colar em outro site ──────────────────────────────────────────────────────────────────────────────────

/** Um post para o cartão de fora: o mesmo recorte do RSS. Nulo quando não existe ou não pode sair. */
create or replace function public.rede_alc_post(p_post uuid) returns jsonb language plpgsql stable security definer set search_path = interno, pg_temp as $$
declare p rede_posts;
begin
  if p_post is null or interno.alumia_exigida() or exists (select 1 from recursos_vivos where nome in ('rede-v2', 'alumia-2', 'alumia-alcance') and not ligado) then return null; end if;
  select * into p from rede_posts x where x.id = p_post;
  if not found or not interno.alumia_alc_sai(p) then return null; end if;
  return interno.alumia_alc_item(p);
end $$;

-- ── 4. Quem eu sigo ───────────────────────────────────────────────────────────────────────────────────────────────────────

/**
 * A lista de quem a própria pessoa segue, para ela levar a outro lugar: os @ daqui (aceitos; quem ficou invisível ou suspensa não
 * vai, porque o @ dela não pode sair) e os @nome@servidor de fora (só os que a outra instância aceitou). Ninguém pede a lista de
 * outra pessoa: a função só lê a de quem chama.
 */
create or replace function public.rede_alc_seguindo() returns jsonb language plpgsql stable security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); v_fora jsonb := '[]'::jsonb;
begin
  if to_regclass('interno.rede_fed_seguindo') is not null and to_regclass('interno.rede_fed_remotos') is not null then
    execute $q$
      select coalesce(jsonb_agg(z.handle order by z.desde), '[]'::jsonb) from (
        select distinct on (lower(r.handle)) lower(r.handle) as handle, s.criado_em as desde
          from interno.rede_fed_seguindo s join interno.rede_fed_remotos r on r.ator = s.ator
         where s.perfil = $1 and s.aceito and r.handle ~* '^[a-z0-9_.-]{1,64}@[a-z0-9.-]{3,253}(:[0-9]{1,5})?$'
         order by lower(r.handle), s.criado_em) z
    $q$ into v_fora using v;
  end if;
  return jsonb_build_object(
    'locais', coalesce((select jsonb_agg(f.rede_handle order by s.criado_em)
                          from rede_seguindo s join perfis f on f.id = s.segue
                         where s.quem = v and not s.pendente and f.rede_handle is not null and not f.suspenso
                           and coalesce(f.rede_modo, 'aberto') <> 'invisivel' and not coalesce(f.rede_invisivel, false)), '[]'::jsonb),
    'fora', coalesce(v_fora, '[]'::jsonb));
end $$;

-- ── 5. Quem chama o quê ───────────────────────────────────────────────────────────────────────────────────────────────────
revoke all on function interno.alumia_alc_conta_sai(uuid), interno.alumia_alc_sai(interno.rede_posts), interno.alumia_alc_item(interno.rede_posts) from public;
revoke all on function public.rede_alc_rss(text, text), public.rede_alc_post(uuid), public.rede_alc_seguindo() from public;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on function interno.alumia_alc_conta_sai(uuid), interno.alumia_alc_sai(interno.rede_posts), interno.alumia_alc_item(interno.rede_posts) from anon, authenticated;
    -- O RSS e o cartão: o servidor do site chama como visitante (a chave pública), com a porta; a trava fecha os dois.
    grant execute on function public.rede_alc_rss(text, text), public.rede_alc_post(uuid) to anon, authenticated, service_role;
    revoke all on function public.rede_alc_seguindo() from anon;
    grant execute on function public.rede_alc_seguindo() to authenticated, service_role;
  end if;
end $$;

-- ── 6. A porta em todas as funções novas ──────────────────────────────────────────────────────────────────────────────────
do $$
declare v jsonb := interno.alumia_trancar();
begin
  if jsonb_array_length(v -> 'abertas') > 0 then
    raise warning 'alumia_trancar: função sem porta: %', v -> 'abertas';
  end if;
end $$;
select interno.alumia_trancar();
