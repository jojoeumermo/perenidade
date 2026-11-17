-- Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
-- Alumia · Onda 9 · fim: compõe numa ordem só a regra de quem vê um post com as funções próprias das frentes da onda 9 e marca no
-- banco que as migrações da onda foram instaladas (a proteção contra ataque, a moderação da comunidade, o modo ato, o público e a
-- vida do post, os rótulos e a transparência e o que a onda 8 deixou: as migrações 20261115-alumia-o9-*.sql, na ordem do fim do
-- install.sql). Pode rodar mais de uma vez. Roda por último, depois de todas elas.
-- Serve para conferir de fora, sem entrar no painel, se o SQL da onda já está em produção:
--   POST /rest/v1/rpc/rede_alumia_versao  →  6
-- O site NÃO exige a versão 6 para abrir: com o banco ainda em 5, o que já existia segue igual e cada função nova que faltar
-- responde "indisponível" na própria tela (o painel de controle mostra "esperada 6 · instalada 5").
--
-- A ordem de quem vê (cada frente criou a sua função e nenhuma redefiniu a regra inteira; aqui elas entram, uma vez só):
--   1. interno.rede2_pode_ver (a base, que interno.rede_ve de dois argumentos chama e que 15 leituras de atos, chamados e avisos
--      chamam direto): autora sempre vê; removido, apagado ou retido não; bloqueio; conta suspensa; comunidade fechada ou
--      restrita; espaço fechado da Rede de hoje; e só então a VIDA DO POST (9D, interno.rede_vida_ve: arquivado, vencido, não
--      listado com a trava e a roda), antes do público. A regra da vida entra aqui, e não só em rede_ve, para nenhum caminho de
--      leitura passar por fora dela.
--   2. interno.rede_ve (dois argumentos): igual, rede2_pode_ver mais a trava do espaço fechado.
--   3. interno.rede_ve (um argumento, a Rede de hoje): a mesma regra de antes, mais a vida do post (só fecha, nunca abre).
--   4. interno.rede_silenciado (o que sai das listas para quem lê): a soneca de pessoa, comunidade, conversa e palavra de antes;
--      depois o não listado e o arquivado (9D, interno.rede_vida_fora_da_lista); depois o rótulo com efeito "esconder" que a pessoa
--      assinou (9E, interno.alumia_rotulo_esconde).
--   5. A resposta de uma pessoa restrita (9A, interno.rede_o9_recolhida) sai do fio para quem não a escreveu, não é dona da
--      conversa e não modera: interno.rede2_pode_ver diz "não vê", sem carimbo e sem contar nas respostas, como o "Só a roda". Assim
--      ninguém de fora deduz que a dona restringiu alguém. Quem escreveu vê a própria resposta com o carimbo "aguardando a dona da
--      conversa" (a troca por princípio 6: a restrita sabe que a resposta espera; a tela não finge nada a ela). interno.rede_post_v2
--      continua recolhendo a resposta (sem texto, corpo, aviso, mídia nem citação) para qualquer leitura que chegue a ela por fora.
-- O modo protegido (9A) já vale nos gatilhos da própria migração; os rótulos com efeito "avisar" (9E) são só uma tarja na tela.

-- ── 1. A versão ───────────────────────────────────────────────────────────────────────────────────────────────────────────
create or replace function public.rede_alumia_versao() returns integer language sql immutable set search_path = interno, pg_temp as $$
  select 6
$$;
revoke all on function public.rede_alumia_versao() from public;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    grant execute on function public.rede_alumia_versao() to anon, authenticated, service_role;
  end if;
end $$;

-- ── 2. Quem vê: a base ────────────────────────────────────────────────────────────────────────────────────────────────────

/**
 * Quem pode ver um post (a mesma de 20261112-alumia-portas.sql). O que muda: depois das travas de comunidade e do espaço fechado,
 * a resposta recolhida da restrita (9A) sai para quem não a escreveu, não é dona e não modera; e antes do público, a vida do post (20261115-alumia-o9-publicar.sql, interno.rede_vida_ve): nula = sem opinião; falsa = arquivado,
 * vencido, não listado com a trava para quem não é aprovada, ou roda de que a pessoa não faz parte; verdadeira = está na roda.
 */
create or replace function interno.rede2_pode_ver(p interno.rede_posts, p_quem uuid) returns boolean language plpgsql stable security definer set search_path = interno, pg_temp as $$
declare
  v_publico text;
  v_comunidade rede_comunidades;
  v_equipe boolean;
  v_dentro boolean;
  v_vida boolean;
begin
  if p is null or p.id is null then return false; end if;
  if p_quem is not null and p.autor = p_quem then return true; end if;
  -- Removido, apagado ou retido: só o autor (acima).
  if p.oculto or p.retido or p.apagado_em is not null then return false; end if;
  if interno.rede_bloqueado(p_quem, p.autor) then return false; end if;
  if p_quem is not null and exists (select 1 from perfis f where f.id = p_quem and f.suspenso) then return false; end if;

  v_publico := interno.rede2_publico(p);
  v_equipe := p_quem is not null and interno.voluntario_e(p_quem);
  v_dentro := not interno.alumia_exigida() or interno.rede2_membro(p_quem);

  -- A comunidade restringe antes do público: em comunidade fechada só entra quem é dela; em restrita, membro da Rede lê.
  if p.comunidade is not null then
    select * into v_comunidade from rede_comunidades where slug = p.comunidade;
    if v_comunidade.slug is not null and v_comunidade.tipo = 'fechada' and not interno.rede2_na_comunidade(p.comunidade, p_quem) then return false; end if;
    if v_comunidade.slug is not null and v_comunidade.tipo = 'restrita' and not (interno.rede2_membro(p_quem) or interno.rede2_na_comunidade(p.comunidade, p_quem)) then return false; end if;
  end if;

  -- O espaço fechado da Rede de hoje ("fechado-…") só é de quem é membro do espaço, em qualquer público (a trava que
  -- interno.rede_ve já aplicava; aqui também, para nenhum outro caminho de leitura passar por fora dela).
  if p.comunidade like 'fechado-%' and not exists (select 1 from rede_espaco_membros m where m.espaco = p.comunidade and m.usuario = p_quem) then
    return false;
  end if;

  -- A resposta recolhida da restrita (onda 9, 9A): fora do fio para quem não escreveu, não é dona e não modera.
  if p.resposta_a is not null and exists (select 1 from rede_o9_restritos r where r.restrito = p.autor)
     and interno.rede_o9_recolhida(p, p_quem) then
    return false;
  end if;

  -- A vida do post (onda 9, 9D): arquivado, vencido, não listado com a trava e a roda decidem antes do público.
  v_vida := interno.rede_vida_ve(p, p_quem);
  if v_vida is not null then return v_vida; end if;

  return case v_publico
    when 'internet' then true
    when 'membros' then interno.rede2_membro(p_quem) or v_equipe
    when 'seguidores' then v_dentro and exists (select 1 from rede_seguindo s where s.quem = p_quem and s.segue = p.autor and not s.pendente)
    when 'comunidade' then v_dentro and p.comunidade is not null and interno.rede2_na_comunidade(p.comunidade, p_quem)
    when 'nucleo' then v_dentro and p.nucleo is not null and interno.rede2_no_nucleo(p.nucleo, p_quem)
    when 'equipe' then v_equipe
    else false
  end;
end $$;

/**
 * A regra de leitura da Rede de hoje (um argumento, a mesma de 2026-11-rede-perfil.sql), mais a vida do post: o arquivado, o
 * vencido e o não listado com a trava somem também por este caminho, e a resposta recolhida da restrita também. Só fecha: o post da roda continua só da autora aqui (o
 * alcance 'roda' não passa em nenhum dos casos de baixo).
 */
create or replace function interno.rede_ve(p interno.rede_posts) returns boolean language sql stable security definer set search_path = interno, pg_temp as $$
  select (not p.oculto or p.autor = auth.uid())
    and not interno.rede_bloqueado(auth.uid(), p.autor)
    and interno.rede_espaco_entra(p.comunidade)
    and (p.alcance = 'publico' or p.autor = auth.uid()
         or (p.alcance = 'seguidores' and exists (select 1 from rede_seguindo s where s.quem = auth.uid() and s.segue = p.autor and not s.pendente))
         or (p.alcance = 'equipe' and interno.voluntario()))
    and coalesce(interno.rede_vida_ve(p, auth.uid()), true)
    and not (p.resposta_a is not null and exists (select 1 from rede_o9_restritos r where r.restrito = p.autor)
             and coalesce(interno.rede_o9_recolhida(p, auth.uid()), false))
$$;

-- ── 3. O que sai das listas ───────────────────────────────────────────────────────────────────────────────────────────────

/**
 * Este post sai das listas de quem lê? A soneca de antes (pessoa, comunidade, conversa ou palavra; o que a própria pessoa escreveu
 * nunca); depois o não listado de outra pessoa e o arquivado (9D); depois o rótulo com efeito "esconder" que a pessoa assinou (9E).
 * Quem tem o link de um não listado ainda abre o post (a página do post não passa por aqui).
 */
create or replace function interno.rede_silenciado(p interno.rede_posts, p_quem uuid) returns boolean language sql stable security definer set search_path = interno, pg_temp as $$
  select (p_quem is not null and p.autor is distinct from p_quem and exists (
    select 1 from rede_silenciados s
    where s.usuario = p_quem and (s.ate is null or s.ate > now())
      and (s.pessoa = p.autor
           or (s.comunidade is not null and s.comunidade = p.comunidade)
           or (s.conversa is not null and s.conversa = coalesce(p.root_id, p.id))
           or (s.palavra is not null and position(interno.normal(s.palavra) in interno.normal(coalesce(p.titulo, '') || ' ' || p.texto)) > 0))))
    or coalesce(interno.rede_vida_fora_da_lista(p, p_quem), false)
    or coalesce(interno.alumia_rotulo_esconde(p, p_quem), false)
$$;

-- ── 4. O post como as leituras o entregam ─────────────────────────────────────────────────────────────────────────────────

/**
 * O post em JSON para quem lê (o mesmo de 2026-11-rede-fundacao.sql). O que muda: a resposta recolhida para esta pessoa (9A,
 * interno.rede_o9_recolhida: a dona da conversa restringiu quem escreveu) vai sem título, texto, corpo, aviso de conteúdo, mídia,
 * citação e chamado, com "aguardando": true. Quem escreveu, as donas da conversa e a mediação recebem tudo (a própria função
 * decide). Para as outras pessoas rede2_pode_ver já tira a resposta do fio; isto vale para quem chega a ela por outro caminho.
 */
create or replace function interno.rede_post_v2(p interno.rede_posts, p_quem uuid, p_completo boolean default false) returns jsonb language sql stable security definer set search_path = interno, pg_temp as $$
  select case when interno.rede_o9_recolhida(p, p_quem)
              then pv.j || jsonb_build_object('titulo', null, 'texto', '', 'corpo', null, 'longo', false, 'midia', '[]'::jsonb, 'citado', null,
                                         'aviso', '', 'cita', null, 'chamado', null, 'aguardando', true)
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
                  else jsonb_build_object('restrito', true) end from rede_posts o where o.id = p.quote_of) end) as j
  from (select 1) u left join perfis f on f.id = p.autor
  ) pv
$$;

revoke all on function interno.rede2_pode_ver(interno.rede_posts, uuid), interno.rede_ve(interno.rede_posts), interno.rede_silenciado(interno.rede_posts, uuid),
  interno.rede_post_v2(interno.rede_posts, uuid, boolean) from public;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on function interno.rede2_pode_ver(interno.rede_posts, uuid), interno.rede_ve(interno.rede_posts), interno.rede_silenciado(interno.rede_posts, uuid),
      interno.rede_post_v2(interno.rede_posts, uuid, boolean) from anon, authenticated;
  end if;
end $$;

-- ── 5. A porta ────────────────────────────────────────────────────────────────────────────────────────────────────────────
-- O relatório de transparência fica fora da porta (a lista de 20261115-alumia-o9-transparencia.sql), se uma migração rodada antes
-- da lista nova já o tinha trancado. interno.alumia_destrancar vem de 20261113-alumia-o7-portas-fediverso.sql.
do $$
begin
  if interno.alumia_porta_aberta('alumia_transparencia', null) then perform interno.alumia_destrancar('alumia_transparencia'); end if;
end $$;

-- A porta da entrada nas funções novas da onda: a regra passa de novo por todas as public.rede_* e public.alumia_* (as que estão
-- na lista de exceções ficam como estão). Se alguma não puder ser trancada, avisa qual.
do $$
declare v jsonb := interno.alumia_trancar();
begin
  if jsonb_array_length(v -> 'abertas') > 0 then
    raise warning 'alumia_trancar: função sem porta: %', v -> 'abertas';
  end if;
end $$;
