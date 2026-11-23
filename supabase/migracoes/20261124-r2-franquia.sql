-- Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
-- Alumia · R2 · denúncia com prova (message franking):
--
--   Cada mensagem cifrada leva um compromisso (HMAC com uma chave sorteada que vai dentro do cifrado), e o servidor do site marca
--   cada depósito com uma chave do dia que só ele tem (lib/rede/franquia/protocolo.ts e servidor.ts). Quem denuncia escolhe os
--   trechos no aparelho, e a tela avisa que eles saem do cifrado e vão para a moderação. O servidor do site confere a prova (o texto
--   está dentro de uma mensagem que passou por aquela caixa naquele dia) e chama este banco. Antes da denúncia, o servidor não lê
--   nada: o compromisso e a marca não dizem nada do texto. A prova NÃO diz quem depositou (a caixa não tem conta): a autoria é a que
--   o aparelho de quem denuncia diz, e a fila mostra isso.
--
--   1. interno.rede_denuncias ganha "prova": a lista dos trechos conferidos, cada um com o texto, o dia da mensagem e de onde veio
--      (conversa, grupo, post). NÃO guarda a caixa, o compromisso, a marca, a chave nem o conteúdo inteiro: nada que ligue a conta
--      de quem denuncia a uma caixa.
--   2. public.rede_franquia_denunciar: só o servidor do site chama (chave de serviço), depois de conferir a prova. A frente das
--      caixas também a define (versão curta, sem a coluna "prova"); esta migração vem depois na ordem e a substitui inteira
--      (apaga antes: o nome do primeiro parâmetro muda). A denúncia entra
--      na mesma fila da Alumia (perfil de quem escreveu, ou o post cifrado), com a prioridade da categoria; quem denuncia nunca é
--      revelado. Teto: 20 denúncias por hora por pessoa (contadas nas próprias denúncias, sem tabela nova).
--   3. interno.rede3_mod_item devolve a prova (a fila da moderação e o painel único mostram "com prova").
--   4. public.rede_franquia_autoria (revisão final da R2): só o servidor do site chama, antes de conferir a prova. Devolve o id da
--      conta do @ denunciado e as identidades dela no registro público das chaves (interno.rede_kt, linhas "conta"). O servidor do
--      site confere com elas a DECLARAÇÃO de quem escreveu (Ed25519 sobre a caixa, o resumo do passe de depósito e a conta) e exige
--      o mesmo resumo de passe dentro da marca. Sem isso, qualquer conta forjava "prova" com uma marca de depósito em caixa
--      inventada (a rota responde igual para passe errado, de propósito). Não grava nada.
--
-- Leis e princípios: LGPD art. 6º (finalidade e necessidade: só o que quem denuncia escolheu mandar), art. 7º, IX e art. 11, II, a
-- (moderação e segurança de quem usa a rede); Marco Civil art. 19 e 21 (a denúncia, o prazo e a remoção). Nenhum endereço de rede,
-- nenhuma lista de pessoas, nenhuma ligação de conta a caixa.
--
-- Redefine (a definição COMPLETA, tirada do banco montado com o install.sql deste ramo): interno.rede3_mod_item; cria
-- public.rede_franquia_autoria (que entra na lista final de exceções da porta, em 20261124-r2-fim.sql); e substitui
-- public.rede_franquia_denunciar da migração das caixas. Pode rodar mais de
-- uma vez. Termina trancando tudo na porta. Teste: npm run testar:r2-franquia.

-- ── 1. A prova na denúncia ────────────────────────────────────────────────────────────────────────────────────────────────

/**
 * A prova guardada tem a forma certa? Uma lista de 1 a 10 trechos, cada um {texto (1 a 1000 letras), dia (data), origem} e nada
 * mais (nem caixa, nem compromisso, nem marca, nem chave).
 */
create or replace function interno.rede_franquia_prova_ok(p jsonb) returns boolean language sql immutable set search_path = interno, pg_temp as $$
  -- "case" e não "and"/"or": o Postgres não promete a ordem, e jsonb_array_length de um não-lista dá erro.
  select case when p is null or jsonb_typeof(p) <> 'array' then false
    else jsonb_array_length(p) between 1 and 10 and octet_length(p::text) <= 16000
      and not exists (
        select 1 from jsonb_array_elements(p) e
        where case when jsonb_typeof(e) <> 'object' then true
          else (select array_agg(k order by k) from jsonb_object_keys(e) k) <> array['dia', 'origem', 'texto']
            or jsonb_typeof(e -> 'texto') <> 'string' or char_length(btrim(e ->> 'texto')) not between 1 and 1000
            or coalesce(e ->> 'dia', '') !~ '^\d{4}-\d{2}-\d{2}$'
            or coalesce(e ->> 'origem', '') not in ('conversa', 'grupo', 'post') end)
  end
$$;

alter table interno.rede_denuncias add column if not exists prova jsonb;
do $$
begin
  if not exists (select 1 from pg_constraint where conrelid = 'interno.rede_denuncias'::regclass and conname = 'rede_denuncias_prova') then
    alter table interno.rede_denuncias add constraint rede_denuncias_prova check (prova is null or interno.rede_franquia_prova_ok(prova));
  end if;
end $$;

-- ── 2. A denúncia com prova ───────────────────────────────────────────────────────────────────────────────────────────────

/**
 * A denúncia com prova (só o servidor do site chama, depois de conferir cada trecho com o segredo da franquia).
 *   p_usuario: quem denuncia (da sessão, conferida pelo servidor);
 *   p: {categoria, autor (o @ de quem escreveu, como o aparelho de quem denuncia diz; com post, pode faltar), post? (id do post
 *       cifrado), texto?,
 *       prova: [{texto, dia, origem}]} (cada trecho já conferido pelo servidor do site).
 * Devolve {protocolo, prioridade, ja, responder_ate}. Erros: sem_permissao, invalido:categoria, invalido:prova,
 * invalido:alvo, nao_encontrado, muitos_pedidos.
 */
drop function if exists public.rede_franquia_denunciar(uuid, jsonb);
create or replace function public.rede_franquia_denunciar(p_usuario uuid, p jsonb) returns jsonb
language plpgsql security definer set search_path = interno, pg_temp as $$
declare
  v_cat text := p ->> 'categoria';
  v_autor text := lower(btrim(coalesce(p ->> 'autor', ''), ' @'));
  v_post text := nullif(btrim(coalesce(p ->> 'post', '')), '');
  v_entrada jsonb := p -> 'prova';
  v_prova jsonb;
  v_texto text;
  f perfis; x rede_posts; d rede_denuncias;
  v_alvo_tipo text; v_alvo text; v_pri smallint;
begin
  if not interno.servico() then perform interno.erro('sem_permissao'); end if;
  perform interno.aberta('comunidade');
  if p_usuario is null or not exists (select 1 from perfis where id = p_usuario and not suspenso) or not interno.rede2_membro(p_usuario) then
    perform interno.erro('sem_permissao');
  end if;
  if v_cat is null or v_cat not in ('menores', 'ameaca', 'exposicao', 'violencia', 'autolesao', 'odio', 'assedio', 'golpe', 'spam', 'outro', 'ilegal') then
    perform interno.erro('invalido:categoria');
  end if;
  v_texto := interno.txt(coalesce(p ->> 'texto', ''), 'texto', 0, 2000);
  if v_entrada is null or jsonb_typeof(v_entrada) <> 'array' then perform interno.erro('invalido:prova'); end if;
  if jsonb_array_length(v_entrada) > 10 or exists (select 1 from jsonb_array_elements(v_entrada) e where jsonb_typeof(e) <> 'object') then
    perform interno.erro('invalido:prova');
  end if;
  -- Guarda só o texto, o dia e a origem (o que vier a mais é descartado aqui, nunca gravado).
  select jsonb_agg(jsonb_build_object('texto', btrim(e ->> 'texto'), 'dia', e ->> 'dia', 'origem', e ->> 'origem') order by o)
    into v_prova from jsonb_array_elements(v_entrada) with ordinality as t(e, o);
  if not interno.rede_franquia_prova_ok(v_prova) then perform interno.erro('invalido:prova'); end if;

  if v_post is not null then
    -- O post cifrado de grupo (os de antes da R2, ainda na linha): a denúncia fica no post (a moderação pode tirá-lo do ar), e quem
    -- escreveu é o autor do post (o @, se vier, tem de ser o dele). Lido pelo jsonb da linha, para não depender de colunas que a
    -- frente dos grupos pode mudar.
    begin select * into x from rede_posts where id = v_post::uuid; exception when others then perform interno.erro('invalido:alvo'); end;
    if not found or (to_jsonb(x) ->> 'corpo_grupo') is null then perform interno.erro('nao_encontrado'); end if;
    select * into f from perfis where id = x.autor;
    if not found or (v_autor <> '' and f.rede_handle is distinct from v_autor) then perform interno.erro('nao_encontrado'); end if;
    v_alvo_tipo := 'post'; v_alvo := x.id::text;
  else
    -- Quem escreveu, pelo @ (o mesmo caminho da denúncia de perfil: invisível e bloqueado não se acham).
    select * into f from perfis where rede_handle = v_autor and v_autor <> '';
    if not found or (f.id <> p_usuario and (f.rede_modo = 'invisivel' or f.rede_invisivel)) then perform interno.erro('nao_encontrado'); end if;
    v_alvo_tipo := 'perfil'; v_alvo := f.id::text;
  end if;
  if f.id = p_usuario then perform interno.erro('sem_permissao'); end if;

  -- A mesma pessoa já tem denúncia aberta sobre o mesmo alvo: os trechos novos entram nela (até 10, sem repetir texto).
  select * into d from rede_denuncias where quem = p_usuario and alvo_tipo = v_alvo_tipo and alvo = v_alvo and situacao in ('aberta', 'em_analise') limit 1;
  if found then
    select jsonb_agg(u.e order by u.o) into v_prova from (
      select t.e, min(t.o) as o from jsonb_array_elements(coalesce(d.prova, '[]'::jsonb) || v_prova) with ordinality as t(e, o)
      group by t.e order by 2 limit 10) u;
    update rede_denuncias set prova = v_prova where id = d.id;
    return jsonb_build_object('protocolo', d.protocolo, 'prioridade', d.prioridade, 'ja', true, 'responder_ate', d.responder_ate);
  end if;

  if (select count(*) from rede_denuncias where quem = p_usuario and criado_em > now() - interval '1 hour') >= 20 then
    perform interno.erro('muitos_pedidos');
  end if;
  v_pri := interno.rede2_prioridade(v_cat);
  insert into rede_denuncias (alvo_tipo, alvo, categoria, prioridade, texto, quem, prova)
  values (v_alvo_tipo, v_alvo, v_cat, v_pri, v_texto, p_usuario, v_prova) returning * into d;

  if v_pri = 1 then
    insert into avisos (para, texto)
    select distinct pp.usuario, left('Denúncia prioritária ' || d.protocolo || ' (' || v_cat || '). Abra a fila de moderação da Rede.', 500)
    from papeis pp where pp.papel in ('coordenacao', 'vice', 'mediacao') and pp.usuario <> p_usuario;
  end if;
  return jsonb_build_object('protocolo', d.protocolo, 'prioridade', d.prioridade, 'ja', false, 'responder_ate', d.responder_ate);
end $$;

-- ── 2b. A autoria da prova ────────────────────────────────────────────────────────────────────────────────────────────────

/**
 * Quem é o @ denunciado, para o servidor do site conferir a declaração de quem escreveu (só o servidor do site chama, antes de
 * rede_franquia_denunciar). Devolve {conta, identidades: [Ed25519 em base64]}: todas as identidades da conta no registro público
 * das chaves (a declaração pode ser de antes de uma troca de identidade). Nula: sem conta com esse @, conta invisível, ou conta sem
 * identidade no registro. Não grava nada; o registro já é público (as linhas são por resumo da conta).
 */
create or replace function public.rede_franquia_autoria(p_autor text) returns jsonb
language plpgsql stable security definer set search_path = interno, pg_temp as $$
declare v_autor text := lower(btrim(coalesce(p_autor, ''), ' @')); f perfis; v_ids jsonb;
begin
  if not interno.servico() then perform interno.erro('sem_permissao'); end if;
  if v_autor = '' then return null; end if;
  select * into f from perfis where rede_handle = v_autor;
  if not found or f.rede_modo = 'invisivel' or f.rede_invisivel then return null; end if;
  select jsonb_agg(substr(k.identidade, 4) order by k.seq) into v_ids
  from rede_kt k where k.tipo = 'conta' and k.quem = interno.rede_kt_quem(f.id) and k.identidade like 'r2:%';
  if v_ids is null then return null; end if;
  return jsonb_build_object('conta', f.id, 'identidades', v_ids);
end $$;

-- ── 3. A fila mostra a prova ──────────────────────────────────────────────────────────────────────────────────────────────

/**
 * O item da fila de moderação: o de antes (o trecho aberto por quem denunciou, "aberto", e se o post é cifrado, "cifrado"), mais
 * a prova da denúncia com prova ("prova": os trechos conferidos, com o dia, a origem e o nível).
 */
create or replace function interno.rede3_mod_item(d interno.rede_denuncias) returns jsonb
language plpgsql stable security definer set search_path = interno, pg_temp as $$
declare x rede_posts; v_trecho text; v_nucleo boolean := false; v_com text; v_titulo text; v_cifrado boolean := false;
begin
  if d.alvo_tipo = 'post' then
    select * into x from rede_posts where id::text = d.alvo;
    if found then
      v_nucleo := x.nucleo is not null; v_com := x.comunidade; v_titulo := x.titulo; v_cifrado := (to_jsonb(x) ->> 'corpo_grupo') is not null;
      if not v_nucleo then v_trecho := left(x.texto, 200); end if;
    end if;
  elsif d.alvo_tipo = 'comunidade' then
    v_com := d.alvo;
  end if;
  return jsonb_build_object(
    'id', d.id, 'protocolo', d.protocolo, 'alvo_tipo', d.alvo_tipo, 'alvo', d.alvo, 'categoria', d.categoria, 'prioridade', d.prioridade,
    'situacao', d.situacao, 'criado_em', d.criado_em, 'texto', d.texto, 'comunidade', v_com, 'titulo', v_titulo, 'trecho', v_trecho, 'nucleo', v_nucleo,
    'cifrado', v_cifrado, 'aberto', d.trecho,
    'prova', to_jsonb(d) -> 'prova',
    'mesmas', (select count(*)::integer from rede_denuncias o where o.alvo_tipo = d.alvo_tipo and o.alvo = d.alvo),
    'responder_ate', d.responder_ate,
    'vencida', d.situacao in ('aberta', 'em_analise') and d.responder_ate is not null and d.responder_ate < now());
end $$;

-- ── 4. Permissões ─────────────────────────────────────────────────────────────────────────────────────────────────────────
revoke all on function interno.rede_franquia_prova_ok(jsonb) from public;
revoke all on function interno.rede3_mod_item(interno.rede_denuncias) from public;
revoke all on function public.rede_franquia_denunciar(uuid, jsonb) from public;
revoke all on function public.rede_franquia_autoria(text) from public;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on function interno.rede_franquia_prova_ok(jsonb) from anon, authenticated;
    revoke all on function interno.rede3_mod_item(interno.rede_denuncias) from anon, authenticated;
    revoke all on function public.rede_franquia_denunciar(uuid, jsonb) from anon, authenticated;
    revoke all on function public.rede_franquia_autoria(text) from anon, authenticated;
  end if;
  -- Só o servidor do site (a chave de serviço), depois de conferir a prova com o segredo da franquia.
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant execute on function public.rede_franquia_denunciar(uuid, jsonb) to service_role;
    grant execute on function public.rede_franquia_autoria(text) to service_role;
  end if;
end $$;

select interno.alumia_trancar();
