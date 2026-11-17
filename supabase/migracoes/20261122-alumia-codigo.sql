-- ───────────────────────────── Alumia: o código que faltava para o beta (denúncia de post cifrado, WebFinger da organização) ─────────────────────────────
-- Migração acrescentável: pode rodar mais de uma vez. Roda depois de 20261121-alumia-integracao-fim.sql. Teste:
-- scripts/testar-alumia-codigo.mjs (a migração duas vezes sobre o install.sql do ramo).
--
-- 1. Denúncia de post cifrado (núcleo e comunidade fechada): a moderação não tem a chave do grupo, então a denúncia de um post
--    cifrado ia sem conteúdo. Agora quem denuncia ESCOLHE mandar um trecho em texto aberto (a tela diz o custo: a moderação vai ler
--    este trecho; o resto continua cifrado). O banco aceita o trecho só para post cifrado e só de quem é do grupo (a mesma regra do
--    MLS para publicar). Que a pessoa conseguiu abrir o post é conferido no aparelho dela: o banco não tem como saber (não tem a
--    chave), e a tela da moderação diz que o trecho foi escrito por quem denunciou. Sem trecho, a denúncia vai sem conteúdo, como
--    antes. public.rede_mod_denunciar ganha p_trecho (com valor padrão ''): a de quatro parâmetros sai, para a chamada de quatro
--    não ficar ambígua. interno.rede3_mod_item devolve o trecho ("aberto") e se o post é cifrado ("cifrado").
-- 2. WebFinger pelo domínio verificado da organização (pedido de 16/11, onda 12): a organização com selo põe no site dela um
--    redirecionamento de /.well-known/webfinger para a Alumia, e a Alumia responde por "acct:<@nome>@<domínio>" só quando o domínio
--    está verificado para ESSA organização (interno.rede_org_por_dominio, que volta nulo na hora em que o selo ou o domínio saem).
--    A conta continua a da Alumia (o "subject" do WebFinger), então nenhum servidor passa a depender do site da organização. O site
--    não abre conexão nenhuma com o domínio pedido: só pergunta ao banco. É uma ação nova ("org_dominio") de
--    public.rede_fed_mudanca_servidor, que já é chamada pelo servidor com o segredo da federação e já está na lista aberta da porta.
-- 3. Update(Person) da identidade pública (pedido de 13/11): não muda nada aqui. O nome público mora em rede_codinome, e o gatilho
--    interno.rede_fed_perfil_atualizado (20261112-fediverso-perfil-e-mudanca.sql) já põe o Update na fila quando ele, a bio, o
--    rosto ou a capa mudam. O teste prova o caminho inteiro (passar a público, trocar o nome, voltar ao codinome).

-- 1. A denúncia com o trecho ────────────────────────────────────────────────────────────────────────────────────────────────
alter table interno.rede_denuncias add column if not exists trecho text;
do $$
begin
  if not exists (select 1 from pg_constraint where conrelid = 'interno.rede_denuncias'::regclass and conname = 'rede_denuncias_trecho') then
    alter table interno.rede_denuncias add constraint rede_denuncias_trecho check (trecho is null or char_length(trecho) between 1 and 1000);
  end if;
end $$;

drop function if exists public.rede_mod_denunciar(text, text, text, text);
create or replace function public.rede_mod_denunciar(p_alvo_tipo text, p_alvo text, p_categoria text, p_texto text default '', p_trecho text default '') returns jsonb
language plpgsql security definer set search_path = interno, pg_temp as $$
declare
  v uuid := interno.eu(); x rede_posts; f perfis; c rede_comunidades; v_alvo text; d rede_denuncias; v_pri smallint; v_retido boolean := false;
  v_texto text := interno.txt(coalesce(p_texto, ''), 'texto', 0, 2000);
  -- O trecho que quem denuncia abriu no aparelho e escolheu mandar em texto aberto (só de post cifrado).
  v_trecho text := nullif(interno.txt(coalesce(p_trecho, ''), 'trecho', 0, 1000), '');
begin
  perform interno.aberta('comunidade');
  if p_categoria is null or p_categoria not in ('menores', 'ameaca', 'exposicao', 'violencia', 'autolesao', 'odio', 'assedio', 'golpe', 'spam', 'outro', 'ilegal') then perform interno.erro('invalido:categoria'); end if;
  if p_alvo_tipo = 'post' then
    begin select * into x from rede_posts where id = p_alvo::uuid; exception when others then perform interno.erro('invalido:alvo'); end;
    if not found or not interno.rede_ve(x, v) then perform interno.erro('nao_encontrado'); end if;
    if x.autor = v then perform interno.erro('sem_permissao'); end if;
    v_alvo := x.id::text;
  elsif p_alvo_tipo = 'perfil' then
    select * into f from perfis where rede_handle = lower(btrim(coalesce(p_alvo, ''), ' @'));
    if not found or (f.id <> v and (f.rede_modo = 'invisivel' or f.rede_invisivel or interno.rede_bloqueado(v, f.id))) then perform interno.erro('nao_encontrado'); end if;
    if f.id = v then perform interno.erro('sem_permissao'); end if;
    v_alvo := f.id::text;
  elsif p_alvo_tipo = 'comunidade' then
    select * into c from rede_comunidades where slug = coalesce(p_alvo, '') or coalesce(p_alvo, '') = any (apelidos) order by (slug = coalesce(p_alvo, '')) desc limit 1;
    if not found or (c.tipo = 'fechada' and not interno.rede2_na_comunidade(c.slug, v)) then perform interno.erro('nao_encontrado'); end if;
    v_alvo := c.slug;
  else
    perform interno.erro('invalido:alvo_tipo');
  end if;

  -- O trecho aberto: só de post cifrado, e só de quem é do grupo da chave (quem não é do grupo não abre o post).
  if v_trecho is not null then
    if p_alvo_tipo <> 'post' or x.corpo_grupo is null or x.grupo is null then perform interno.erro('invalido:trecho'); end if;
    if not interno.rede_grupo_membro(x.grupo, v) then perform interno.erro('sem_permissao'); end if;
  end if;

  select * into d from rede_denuncias where quem = v and alvo_tipo = p_alvo_tipo and alvo = v_alvo and situacao in ('aberta', 'em_analise') limit 1;
  if found then
    -- A mesma pessoa denunciou antes sem o trecho e agora quer mandá-lo: ele entra na denúncia que já está aberta.
    if v_trecho is not null and d.trecho is null then update rede_denuncias set trecho = v_trecho where id = d.id; end if;
    return jsonb_build_object('protocolo', d.protocolo, 'prioridade', d.prioridade, 'retido', false, 'ja', true, 'responder_ate', d.responder_ate);
  end if;

  perform interno.rede2_limite('denunciar');
  v_pri := interno.rede2_prioridade(p_categoria);
  insert into rede_denuncias (alvo_tipo, alvo, categoria, prioridade, texto, quem, trecho) values (p_alvo_tipo, v_alvo, p_categoria, v_pri, v_texto, v, v_trecho) returning * into d;

  if p_alvo_tipo = 'post' and p_categoria in ('menores', 'exposicao') and not (x.oculto or x.retido) then
    begin
      perform interno.limite('rede3_precaucao', 5, 1440);
      update rede_posts set retido = true, oculto = true, motivo = 'aguardando_analise_de_denuncia' where id = x.id;
      perform interno.rede3_mod_registrar('reter', 'post', x.id::text, 'precaucao', 'Retido por precaução até a moderação ler a denúncia (protocolo da denúncia: ' || d.protocolo || ').', d.id, true);
      perform interno.rede3_mod_avisar_afetado(x.autor, 'Um post seu ficou retido por precaução enquanto a moderação lê uma denúncia (decisão automática, ainda sem leitura de uma pessoa). Só você o vê. Você pode recorrer em até 30 dias, em Denúncias e recursos.');
      v_retido := true;
    exception when others then
      v_retido := false;
    end;
  end if;

  if v_pri = 1 then
    insert into avisos (para, texto)
    select distinct p.usuario, left('Denúncia prioritária ' || d.protocolo || ' (' || p_categoria || '). Abra a fila de moderação da Rede.', 500) from papeis p where p.papel in ('coordenacao', 'vice', 'mediacao') and p.usuario <> v;
  end if;
  return jsonb_build_object('protocolo', d.protocolo, 'prioridade', d.prioridade, 'retido', v_retido, 'ja', false, 'responder_ate', d.responder_ate);
end $$;

/** O item da fila de moderação: o de antes, mais o trecho aberto por quem denunciou ("aberto") e se o post é cifrado ("cifrado"). */
create or replace function interno.rede3_mod_item(d interno.rede_denuncias) returns jsonb
language plpgsql stable security definer set search_path = interno, pg_temp as $$
declare x rede_posts; v_trecho text; v_nucleo boolean := false; v_com text; v_titulo text; v_cifrado boolean := false;
begin
  if d.alvo_tipo = 'post' then
    select * into x from rede_posts where id::text = d.alvo;
    if found then
      v_nucleo := x.nucleo is not null; v_com := x.comunidade; v_titulo := x.titulo; v_cifrado := x.corpo_grupo is not null;
      if not v_nucleo then v_trecho := left(x.texto, 200); end if;
    end if;
  elsif d.alvo_tipo = 'comunidade' then
    v_com := d.alvo;
  end if;
  return jsonb_build_object(
    'id', d.id, 'protocolo', d.protocolo, 'alvo_tipo', d.alvo_tipo, 'alvo', d.alvo, 'categoria', d.categoria, 'prioridade', d.prioridade,
    'situacao', d.situacao, 'criado_em', d.criado_em, 'texto', d.texto, 'comunidade', v_com, 'titulo', v_titulo, 'trecho', v_trecho, 'nucleo', v_nucleo,
    'cifrado', v_cifrado, 'aberto', d.trecho,
    'mesmas', (select count(*)::integer from rede_denuncias o where o.alvo_tipo = d.alvo_tipo and o.alvo = d.alvo),
    'responder_ate', d.responder_ate,
    'vencida', d.situacao in ('aberta', 'em_analise') and d.responder_ate is not null and d.responder_ate < now());
end $$;

-- 2. O WebFinger pelo domínio da organização ────────────────────────────────────────────────────────────────────────────────
/**
 * Ações (pedem o segredo da federação):
 *   quem_segue {ator}            → as pessoas daqui que seguem aquele ator (até 2000), para o Move;
 *   org_dominio {dominio, nome}  → {handle} da organização com selo, não suspensa, dona do domínio VERIFICADO, quando "nome" é o
 *                                  @nome dela; senão nulo. Não diz se o domínio existe ou de quem é (nulo nos dois casos).
 */
create or replace function public.rede_fed_mudanca_servidor(p_segredo text, p_acao text, p jsonb default '{}'::jsonb) returns jsonb
language plpgsql stable security definer set search_path = interno, pg_temp as $$
declare
  v_ator text := left(coalesce(p ->> 'ator', ''), 500);
  v_dominio text := lower(btrim(left(coalesce(p ->> 'dominio', ''), 300), ' .'));
  v_nome text := lower(btrim(left(coalesce(p ->> 'nome', ''), 100), ' @'));
  v_org uuid; v_handle text;
begin
  perform interno.rede_fed_segredo(p_segredo);
  if p_acao = 'org_dominio' then
    if char_length(v_dominio) > 253 or v_dominio !~ '^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)+$'
       or v_nome !~ '^[a-z0-9_]{3,20}$' then
      return null;
    end if;
    v_org := interno.rede_org_por_dominio(v_dominio);
    if v_org is null then return null; end if;
    select f.rede_handle into v_handle from perfis f where f.id = v_org and f.rede_handle = v_nome;
    return case when v_handle is null then null else jsonb_build_object('handle', v_handle) end;
  end if;
  if p_acao <> 'quem_segue' then perform interno.erro('invalido:acao'); end if;
  if v_ator !~ '^https://[^\s]+$' then perform interno.erro('invalido:ator'); end if;
  return coalesce((select jsonb_agg(s.perfil) from (select perfil from rede_fed_seguindo where ator = v_ator order by criado_em limit 2000) s), '[]'::jsonb);
end $$;

-- 3. Permissões ───────────────────────────────────────────────────────────────────────────────────────────────────────────
revoke all on function public.rede_mod_denunciar(text, text, text, text, text) from public;
revoke all on function interno.rede3_mod_item(interno.rede_denuncias) from public;
revoke all on function public.rede_fed_mudanca_servidor(text, text, jsonb) from public;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on function public.rede_mod_denunciar(text, text, text, text, text) from anon, authenticated;
    revoke all on function interno.rede3_mod_item(interno.rede_denuncias) from anon, authenticated;
    -- Denunciar: só com conta (a função confere a sessão).
    grant execute on function public.rede_mod_denunciar(text, text, text, text, text) to authenticated, service_role;
    -- Como antes: o site chama com a chave pública e o segredo (sem o segredo, a função recusa).
    grant execute on function public.rede_fed_mudanca_servidor(text, text, jsonb) to anon, authenticated, service_role;
  end if;
end $$;

select interno.alumia_trancar();
