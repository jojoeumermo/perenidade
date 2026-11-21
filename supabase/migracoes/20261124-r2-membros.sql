-- Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
--
-- ═══════════════════════ Alumia · Reforço 2 · Membros escondidos: o banco não sabe quem é de cada núcleo (24/11/2026) ═══════════════════════
-- Migração acrescentável: pode rodar mais de uma vez. Roda depois de 20261123-r1-fim.sql (banco na versão 14), na ordem alfabética das
-- migrações da R2 (caixas, cofres, dupla, equipe, franquia, grupos, membros, voto); não usa tabela de nenhuma delas. Teste:
-- scripts/testar-r2-membros-banco.mjs (a migração duas vezes sobre o install.sql; os ataques de quem tem o banco inteiro escritos
-- como teste). A parte do aparelho (grupo MLS, papéis assinados, pedido de entrada) está em lib/rede/membros e é provada por
-- scripts/testar-r2-membros.mjs.
--
-- O que muda:
-- 1. Quem é de cada núcleo passa a morar só nos aparelhos dos membros (a árvore do grupo MLS e a lista de papéis assinada dentro
--    dele). SAEM do banco: interno.rede_nucleo_membros (conta, núcleo, papel), interno.rede_org_nucleo_pedidos (quem pediu para
--    entrar em qual núcleo), as tabelas do MLS de hoje que ligam conta a grupo (rede_mls_commits com o autor, rede_mls_boasvindas com
--    o destinatário, rede_mls_pacotes por conta, rede_mls_info com a árvore), os posts de núcleo (rede_posts.nucleo, com autor) e os
--    convites de núcleo (rede_convites.nucleo, com quem criou). As tabelas saem com DROP (os arquivos saem do disco do banco); o beta
--    foi avisado antes, com data (docs/rede/CHAT-PRIVADO.md, a troca do beta).
-- 2. Cada função que lia a filiação passa a ler interno.rede_nucleo_sem_membros(), que não devolve linha nenhuma: no servidor,
--    ninguém é de núcleo nenhum. O que dependia disso no servidor (mediação de núcleo na moderação, acervo, pastas e encontros do
--    núcleo, consulta e eleição restritas a quem é de núcleo, "chama" do núcleo) fica fechado aqui; o conteúdo do núcleo vai como
--    mensagem do grupo, na caixa anônima da época.
-- 3. A ENTRADA no núcleo: o perfil público do núcleo ganha a caixa de entrada (id e passe de depósito, públicos de propósito), a chave
--    X-Wing da entrada e a chave de gestão do núcleo (Ed25519) com a assinatura da entrada, que o aparelho confere. Quem quer entrar
--    deposita um pedido cifrado para a chave da entrada; a mediação decide no aparelho e põe a pessoa pelo MLS. Para trocar a caixa
--    ou a chave da entrada, a mediação mostra o PASSE DE GESTÃO (32 bytes; o banco guarda só o resumo), por uma chamada sem sessão de
--    conta (public.rede_nucleo_entrada_trocar, só para o servidor do site, na lista de exceções da porta): o banco não fica sabendo
--    quem é da mediação. A primeira publicação (e o recomeço, se a mediação inteira perder os aparelhos) é de quem cria o núcleo: a
--    gestão da organização ou a coordenação (quem acompanha, nos núcleos do Instituto), com sessão, como hoje.
-- Endereço de rede: nada daqui lê ou guarda. Nenhum número de pessoas por núcleo.
-- Leis: LGPD art. 6º, III (necessidade), art. 11 (dado sensível: filiação política e organização de militância), art. 46
-- (segurança), art. 16 (eliminação); Constituição art. 5º, XVII (liberdade de associação) e Marco Civil art. 10 (sigilo).

-- ── 1. A entrada do núcleo no perfil público ───────────────────────────────────────────────────────────────────────────────

alter table interno.rede_nucleos add column if not exists entrada_caixa bytea;
alter table interno.rede_nucleos add column if not exists entrada_pd bytea;
alter table interno.rede_nucleos add column if not exists entrada_xwing bytea;
alter table interno.rede_nucleos add column if not exists entrada_chave bytea;
alter table interno.rede_nucleos add column if not exists entrada_assinatura bytea;
alter table interno.rede_nucleos add column if not exists entrada_gestao_h bytea;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'rede_nucleos_entrada_tamanhos') then
    alter table interno.rede_nucleos add constraint rede_nucleos_entrada_tamanhos check (
      (entrada_caixa is null and entrada_pd is null and entrada_xwing is null and entrada_chave is null and entrada_assinatura is null and entrada_gestao_h is null)
      or (octet_length(entrada_caixa) = 32 and octet_length(entrada_pd) = 32 and octet_length(entrada_xwing) = 1216
          and octet_length(entrada_chave) = 32 and octet_length(entrada_assinatura) = 64 and octet_length(entrada_gestao_h) = 32));
  end if;
end $$;

-- ── 2. Peças de dentro ─────────────────────────────────────────────────────────────────────────────────────────────────────

-- No servidor, ninguém é de núcleo nenhum: as funções que liam a filiação leem esta, que não devolve linha. (A forma é a da tabela que
-- saiu, para as funções continuarem válidas e fechadas, sem um ramo de "quem é membro" que alguém reabra por engano.)
create or replace function interno.rede_nucleo_sem_membros() returns table (nucleo uuid, usuario uuid, papel text, entrou_em timestamptz)
language sql immutable security definer set search_path = interno, pg_temp as $$
  select null::uuid, null::uuid, null::text, null::timestamptz where false
$$;
revoke all on function interno.rede_nucleo_sem_membros() from public, anon, authenticated;

create or replace function interno.rede_nucleo_b64url(p bytea) returns text language sql immutable security definer set search_path = interno, pg_temp as $$
  select rtrim(translate(encode(p, 'base64'), E'+/\n', '-_'), '=')
$$;
revoke all on function interno.rede_nucleo_b64url(bytea) from public, anon, authenticated;

-- O resumo do passe de gestão (o mesmo rótulo de lib/rede/membros/rotulos.ts).
create or replace function interno.rede_nucleo_gestao_h(p bytea) returns bytea language sql immutable security definer set search_path = interno, pg_temp as $$
  select sha256(convert_to('alumia/r2/grupo/gestao/v1', 'UTF8') || p)
$$;
revoke all on function interno.rede_nucleo_gestao_h(bytea) from public, anon, authenticated;

-- ── 3. Publicar e trocar a entrada ─────────────────────────────────────────────────────────────────────────────────────────

-- Com sessão: quem cria o núcleo (gestão da organização; coordenação ou quem acompanha, nos núcleos do Instituto) publica a primeira
-- entrada, ou recomeça uma entrada perdida. `p`: {caixa, pd, xwing, chave, assinatura, gestao_h}, em base64url.
create or replace function public.rede_nucleo_entrada_iniciar(p_nucleo uuid, p jsonb) returns jsonb
language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); n rede_nucleos; v_pode boolean;
  v_caixa bytea; v_pd bytea; v_xwing bytea; v_chave bytea; v_ass bytea; v_gestao bytea;
begin
  perform interno.rede3_perfil_exige_membro(v);
  perform interno.limite('rede_nucleo_entrada', 20, 60);
  select * into n from rede_nucleos where id = p_nucleo;
  if not found then perform interno.erro('nao_encontrado'); end if;
  v_pode := (n.org is not null and interno.alumia_org_gere(v, n.org))
         or (n.org is null and (interno.coord() or exists (select 1 from nucleos x where x.id = n.nucleo and x.acompanha = v)));
  if not v_pode then perform interno.erro('sem_permissao'); end if;
  begin
    v_caixa := decode(translate(p ->> 'caixa', '-_', '+/') || repeat('=', (4 - length(p ->> 'caixa') % 4) % 4), 'base64');
    v_pd := decode(translate(p ->> 'pd', '-_', '+/') || repeat('=', (4 - length(p ->> 'pd') % 4) % 4), 'base64');
    v_xwing := decode(translate(p ->> 'xwing', '-_', '+/') || repeat('=', (4 - length(p ->> 'xwing') % 4) % 4), 'base64');
    v_chave := decode(translate(p ->> 'chave', '-_', '+/') || repeat('=', (4 - length(p ->> 'chave') % 4) % 4), 'base64');
    v_ass := decode(translate(p ->> 'assinatura', '-_', '+/') || repeat('=', (4 - length(p ->> 'assinatura') % 4) % 4), 'base64');
    v_gestao := decode(translate(p ->> 'gestao_h', '-_', '+/') || repeat('=', (4 - length(p ->> 'gestao_h') % 4) % 4), 'base64');
    update rede_nucleos set entrada_caixa = v_caixa, entrada_pd = v_pd, entrada_xwing = v_xwing, entrada_chave = v_chave,
      entrada_assinatura = v_ass, entrada_gestao_h = v_gestao where id = n.id;
  exception when others then perform interno.erro('invalido:entrada');
  end;
  return jsonb_build_object('ok', true);
end $$;
revoke all on function public.rede_nucleo_entrada_iniciar(uuid, jsonb) from public, anon;
grant execute on function public.rede_nucleo_entrada_iniciar(uuid, jsonb) to authenticated;

-- Sem sessão (só o servidor do site, pela rota anônima app/api/alumia/nucleo/entrada): a mediação troca a caixa e a chave X-Wing da
-- entrada mostrando o passe de gestão. A chave de gestão (Ed25519) não muda por aqui. Passe errado: {ok:false}, sem dizer mais.
create or replace function public.rede_nucleo_entrada_trocar(p_nucleo uuid, p_gestao bytea, p_caixa bytea, p_pd bytea, p_xwing bytea,
  p_assinatura bytea, p_gestao_h_novo bytea) returns jsonb
language plpgsql security definer set search_path = interno, pg_temp as $$
declare n rede_nucleos;
begin
  if p_gestao is null or octet_length(p_gestao) <> 32 then return jsonb_build_object('ok', false); end if;
  select * into n from rede_nucleos where id = p_nucleo for update;
  if not found or n.entrada_gestao_h is null or n.entrada_gestao_h <> interno.rede_nucleo_gestao_h(p_gestao) then
    return jsonb_build_object('ok', false);
  end if;
  begin
    update rede_nucleos set entrada_caixa = p_caixa, entrada_pd = p_pd, entrada_xwing = p_xwing, entrada_assinatura = p_assinatura,
      entrada_gestao_h = coalesce(p_gestao_h_novo, n.entrada_gestao_h) where id = n.id;
  exception when check_violation or not_null_violation then return jsonb_build_object('ok', false, 'erro', 'invalido');
  end;
  return jsonb_build_object('ok', true);
end $$;
revoke all on function public.rede_nucleo_entrada_trocar(uuid, bytea, bytea, bytea, bytea, bytea, bytea) from public, anon, authenticated;
grant execute on function public.rede_nucleo_entrada_trocar(uuid, bytea, bytea, bytea, bytea, bytea, bytea) to service_role;

-- ── 4. As funções que liam a filiação (definição completa, tirada do banco montado na versão 14) ──────────────────────────
-- Cada uma lê interno.rede_nucleo_sem_membros() no lugar da tabela que sai; as que só faziam entrar, sair e decidir pedido saem
-- (seção 6). Ajustes à mão: alumia_chama (sem "chama"), rede_grupo_membros (só comunidades), rede_com_nucleo (perfil público e
-- entrada), rede_com_nucleo_abrir e rede_org_nucleo_criar (ninguém entra pelo servidor), rede_fix_convite_usar (convite de núcleo
-- vira pedido de entrada), rede_org_perfil (sem "sou" nem "pedi"), rede_nucleos_fechados_listar (sem número de pessoas) e "Meus
-- dados" (sem núcleos nem pedidos de núcleo: o servidor não tem mais o que entregar).

CREATE OR REPLACE FUNCTION interno.alumia_chama(p_nucleo uuid)
 RETURNS text
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'interno', 'pg_temp'
AS $function$
  -- R2 (membros escondidos): o servidor não sabe quantas pessoas há num núcleo; a "chama" (plena/brasa) sai daqui e a tela não
  -- mostra número nenhum vindo do servidor.
  select null::text
$function$;

CREATE OR REPLACE FUNCTION interno.alumia_consulta_json(c interno.rede_consultas, p_quem uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'interno', 'pg_temp'
AS $function$
declare
  v_fechada boolean := c.prazo <= now(); v_votantes integer; v_cedulas integer; v_ap jsonb; v_mostra boolean; v_nucleos uuid[];
  v_posso boolean; v_votei boolean; v_quorum boolean; v_apurar boolean := false;
begin
  v_nucleos := case when cardinality(c.nucleos) > 0 then c.nucleos else coalesce((select array_agg(id) from rede_nucleos where org = c.org), '{}') end;
  select count(*) into v_votantes from rede_consulta_votantes where consulta = c.id;
  v_votei := p_quem is not null and exists (select 1 from rede_consulta_votantes where consulta = c.id and usuario = p_quem);
  v_posso := p_quem is not null and not v_fechada and not v_votei and interno.rede2_membro(p_quem) and not interno.rede_bloqueado(p_quem, c.org)
    and exists (select 1 from interno.rede_nucleo_sem_membros() m where m.usuario = p_quem and m.nucleo = any (v_nucleos));
  v_quorum := c.quorum is null or v_votantes >= c.quorum;
  if v_fechada then
    select count(*) into v_cedulas from rede_consulta_cedulas where consulta = c.id;
    v_apurar := exists (select 1 from rede_consulta_cifradas x where x.consulta = c.id);
  end if;
  v_mostra := v_fechada and not v_apurar and v_votantes >= 3 and coalesce(v_cedulas, 0) >= 3 and v_quorum;
  if v_mostra then v_ap := interno.alumia_apurar(c.id); end if;
  return jsonb_build_object(
    'id', c.id, 'pergunta', c.pergunta, 'metodo', c.metodo, 'prazo', c.prazo, 'compromisso', c.compromisso, 'quorum', c.quorum,
    'situacao', case when v_fechada then 'fechada' else 'aberta' end,
    'votantes', case when v_fechada then interno.alumia_pessoas(v_votantes) end,
    'quorumAtingido', case when v_fechada then v_quorum end,
    'apurar', v_apurar,
    'possoVotar', v_posso, 'votei', v_votei,
    'nucleos', coalesce((select jsonb_agg(n.nome order by n.nome) from rede_nucleos n where n.id = any (v_nucleos)), '[]'::jsonb),
    'opcoes', coalesce((select jsonb_agg(jsonb_build_object('id', o.id, 'texto', o.texto,
                'proporcao', case when v_mostra then round((v_ap -> 'proporcoes' ->> o.id::text)::numeric, 4) end) order by o.ordem)
              from rede_consulta_opcoes o where o.consulta = c.id), '[]'::jsonb));
end $function$;

CREATE OR REPLACE FUNCTION interno.alumia_eleicao_json(e interno.rede_org_eleicoes, p_quem uuid)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'interno', 'pg_temp'
AS $function$
  select jsonb_build_object(
    'id', e.id, 'funcao', jsonb_build_object('id', f.id, 'nome', f.nome, 'tipo', f.tipo),
    'inscricoesAte', e.inscricoes_ate, 'prazo', e.prazo, 'mandatoFim', e.mandato_fim, 'quorum', e.quorum, 'situacao', e.situacao,
    'candidatos', coalesce((select jsonb_agg(jsonb_build_object('handle', p.rede_handle, 'codinome', coalesce(p.rede_codinome, ''), 'eu', k.pessoa = p_quem) order by lower(coalesce(nullif(p.rede_codinome, ''), p.rede_handle)))
      from rede_org_eleicao_candidatos k join perfis p on p.id = k.pessoa where k.eleicao = e.id and not p.suspenso), '[]'::jsonb),
    'souCandidata', exists (select 1 from rede_org_eleicao_candidatos k where k.eleicao = e.id and k.pessoa = p_quem),
    'possoCandidatar', e.situacao = 'inscricoes' and now() < e.inscricoes_ate and interno.rede2_membro(p_quem)
      and exists (select 1 from rede_nucleos n join interno.rede_nucleo_sem_membros() m on m.nucleo = n.id where n.org = e.org and m.usuario = p_quem),
    'consulta', (select interno.alumia_consulta_json(c, p_quem) from rede_consultas c where c.id = e.consulta),
    'eleita', (select jsonb_build_object('handle', p.rede_handle, 'codinome', coalesce(p.rede_codinome, '')) from rede_org_mandatos m join perfis p on p.id = m.pessoa where m.id = e.eleito))
  from rede_org_funcoes f where f.id = e.funcao
$function$;

CREATE OR REPLACE FUNCTION interno.alumia_o12_chama(p_quem uuid, p_nucleo uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'interno', 'pg_temp'
AS $function$
  select p_quem is not null and exists (
    select 1 from rede_nucleos n where n.id = p_nucleo and n.org is not null
      and (interno.alumia_o12_comunica(p_quem, n.org)
           or exists (select 1 from interno.rede_nucleo_sem_membros() m where m.nucleo = n.id and m.usuario = p_quem and m.papel = 'mediacao')))
$function$;

CREATE OR REPLACE FUNCTION interno.alumia_org_dentro(p_quem uuid, p_org uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'interno', 'pg_temp'
AS $function$
  select p_quem is not null and p_org is not null and (interno.alumia_org_gere(p_quem, p_org) or exists (
    select 1 from rede_nucleos n join interno.rede_nucleo_sem_membros() m on m.nucleo = n.id where n.org = p_org and m.usuario = p_quem))
$function$;

CREATE OR REPLACE FUNCTION interno.escola_medeia(p_nucleo uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'interno', 'pg_temp'
AS $function$
  select p_nucleo is not null and (interno.coord() or (
    interno.sessao_confiavel() and interno.e_militante(auth.uid())
    and exists (select 1 from interno.rede_nucleo_sem_membros() m where m.nucleo = p_nucleo and m.usuario = auth.uid() and m.papel = 'mediacao')))
$function$;

CREATE OR REPLACE FUNCTION interno.rede2_no_nucleo(p_nucleo uuid, p_usuario uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'interno', 'pg_temp'
AS $function$
  select p_usuario is not null and exists (select 1 from interno.rede_nucleo_sem_membros() m where m.nucleo = p_nucleo and m.usuario = p_usuario)
$function$;

CREATE OR REPLACE FUNCTION interno.rede3_conv_modera(p interno.rede_posts, p_quem uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'interno', 'pg_temp'
AS $function$
  select p_quem is not null and (
    (p_quem = auth.uid() and interno.cuida())
    or (p.comunidade is not null and exists (select 1 from rede_comunidade_membros m where m.comunidade = p.comunidade and m.usuario = p_quem and m.papel = 'moderacao' and m.situacao = 'ativo'))
    or (p.nucleo is not null and exists (select 1 from interno.rede_nucleo_sem_membros() n where n.nucleo = p.nucleo and n.usuario = p_quem and n.papel = 'mediacao')))
$function$;

CREATE OR REPLACE FUNCTION interno.rede3_mod_modera(p_com text, p_nucleo uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'interno', 'pg_temp'
AS $function$
  select auth.uid() is not null and (
    interno.cuida()
    or (p_com is not null and exists (select 1 from rede_comunidade_membros m where m.comunidade = p_com and m.usuario = auth.uid() and m.papel = 'moderacao' and m.situacao = 'ativo'))
    or (p_nucleo is not null and exists (select 1 from interno.rede_nucleo_sem_membros() n where n.nucleo = p_nucleo and n.usuario = auth.uid() and n.papel = 'mediacao')))
$function$;

CREATE OR REPLACE FUNCTION interno.rede3_mod_modera_escopo(p_tipo text, p_escopo text)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'interno', 'pg_temp'
AS $function$
declare v_nucleo uuid;
begin
  if p_tipo = 'comunidade' then return interno.rede3_mod_modera(p_escopo, null); end if;
  if p_tipo = 'nucleo' then
    begin v_nucleo := p_escopo::uuid; exception when others then return false; end;
    return auth.uid() is not null and exists (select 1 from interno.rede_nucleo_sem_membros() n where n.nucleo = v_nucleo and n.usuario = auth.uid() and n.papel = 'mediacao');
  end if;
  return false;
end $function$;

CREATE OR REPLACE FUNCTION interno.rede3_mod_pode_post(p interno.rede_posts, p_com_denuncia boolean)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'interno', 'pg_temp'
AS $function$
  select case when p.nucleo is not null then
      auth.uid() is not null and (exists (select 1 from interno.rede_nucleo_sem_membros() n where n.nucleo = p.nucleo and n.usuario = auth.uid() and n.papel = 'mediacao')
                                  or (p_com_denuncia and interno.cuida()))
    else interno.rede3_mod_modera(p.comunidade, null) end
$function$;

CREATE OR REPLACE FUNCTION interno.rede_acervo_media(p_nucleo uuid, p_quem uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'interno', 'pg_temp'
AS $function$
  select p_quem is not null and exists (select 1 from interno.rede_nucleo_sem_membros() m where m.nucleo = p_nucleo and m.usuario = p_quem and m.papel = 'mediacao')
$function$;

CREATE OR REPLACE FUNCTION interno.rede_fix_cuida(p_espaco text, p_nucleo uuid, p_quem uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'interno', 'pg_temp'
AS $function$
  select p_quem is not null and (
    (p_espaco is not null and exists (select 1 from rede_espaco_membros m where m.espaco = p_espaco and m.usuario = p_quem and m.cuida))
    or (p_nucleo is not null and exists (select 1 from interno.rede_nucleo_sem_membros() m where m.nucleo = p_nucleo and m.usuario = p_quem and m.papel = 'mediacao'))
    or interno.cuida())
$function$;

CREATE OR REPLACE FUNCTION interno.rede_grupo_membros(p_grupo text)
 RETURNS SETOF uuid
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'interno', 'pg_temp'
AS $function$
  -- R2: os núcleos não têm mais membros no servidor (moram na árvore do MLS, nos aparelhos); só as comunidades fechadas.
  select m.usuario from rede_comunidade_membros m where p_grupo ~ '^comunidade:[a-z0-9-]{2,60}$' and m.comunidade = substr(p_grupo, 12)
    and m.situacao = 'ativo' and (m.banido_ate is null or m.banido_ate < now()) and interno.rede2_membro(m.usuario)
$function$;

CREATE OR REPLACE FUNCTION interno.rede_na_aba(p interno.rede_posts, p_aba text, p_quem uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'interno', 'pg_temp'
AS $function$
  select p.resposta_a is null and p.apagado_em is null and case
    when p_aba = 'tudo' then true
    when p_aba = 'geral' then interno.rede2_publico(p) = 'internet'
    when p_aba = 'seguindo' then p.autor = p_quem or exists (select 1 from rede_seguindo s where s.quem = p_quem and s.segue = p.autor and not s.pendente)
    when p_aba = 'comunidades' then (p.comunidade is not null and (
        exists (select 1 from rede_comunidade_membros m where m.comunidade = p.comunidade and m.usuario = p_quem and m.situacao = 'ativo')
        or exists (select 1 from rede_comunidades_seguidas c where c.usuario = p_quem and c.comunidade = p.comunidade)))
      or (p.nucleo is not null and exists (select 1 from interno.rede_nucleo_sem_membros() n where n.nucleo = p.nucleo and n.usuario = p_quem))
    when p_aba like 'c:%' then p.comunidade = substr(p_aba, 3)
    when p_aba like 'u:%' then p.autor::text = substr(p_aba, 3)
    else false end
$function$;

CREATE OR REPLACE FUNCTION public.alumia_painel_denuncia(p_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'interno', 'pg_temp'
AS $function$begin perform interno.alumia_porta();
declare v uuid := auth.uid(); d rede_denuncias; x rede_posts; v_alvo jsonb;
begin
  perform interno.alumia_painel_exige();
  perform interno.limite('alumia_painel_agir', 300, 60);
  select * into d from rede_denuncias where id = p_id;
  if not found then perform interno.erro('nao_encontrado'); end if;
  if d.situacao = 'aberta' then update rede_denuncias set situacao = 'em_analise', cuida = v where id = d.id; d.situacao := 'em_analise'; end if;
  if d.alvo_tipo = 'post' then
    select * into x from rede_posts where id::text = d.alvo;
    if found then
      if x.nucleo is not null and not exists (select 1 from interno.rede_nucleo_sem_membros() n where n.nucleo = x.nucleo and n.usuario = v)
         and not exists (select 1 from rede_moderacao m where m.acao = 'quebra_vidro' and m.denuncia = d.id and m.quem = v) then
        perform interno.rede3_mod_registrar('quebra_vidro', 'post', x.id::text, 'denuncia', 'O painel da Alumia abriu o post de núcleo por causa da denúncia ' || d.protocolo || '.', d.id);
        insert into avisos (para, texto, categoria)
        select n.usuario, 'A moderação geral abriu um post do núcleo por causa de uma denúncia (protocolo ' || d.protocolo || '). O acesso ficou registrado.', 'rede'
        from interno.rede_nucleo_sem_membros() n where n.nucleo = x.nucleo and n.papel = 'mediacao';
        perform interno.alumia_painel_registrar('quebra_vidro', 'post', x.id::text, interno.alumia_painel_nome_fixo(x.autor), 'Denúncia ' || d.protocolo);
      end if;
      v_alvo := jsonb_build_object('id', x.id, 'tipo', x.tipo, 'titulo', x.titulo, 'texto', x.texto, 'corpo', x.corpo, 'comunidade', x.comunidade, 'nucleo', x.nucleo is not null,
        'criado_em', x.criado_em, 'oculto', x.oculto, 'retido', x.retido, 'motivo', x.motivo, 'autor', interno.alumia_painel_nome(x.autor), 'autor_id', x.autor,
        'autor_nivel', interno.rede3_mod_nivel(x.autor), 'autor_procedentes_90', interno.rede3_mod_procedentes(x.autor, 90));
    end if;
  elsif d.alvo_tipo = 'perfil' then
    select jsonb_build_object('autor', interno.alumia_painel_nome(f.id), 'autor_id', f.id, 'bio', f.rede_bio, 'autor_nivel', interno.rede3_mod_nivel(f.id),
      'autor_procedentes_90', interno.rede3_mod_procedentes(f.id, 90)) into v_alvo from perfis f where f.id::text = d.alvo;
  elsif d.alvo_tipo = 'comunidade' then
    select jsonb_build_object('comunidade', c.slug, 'nome', c.nome, 'descricao', c.descricao) into v_alvo from rede_comunidades c where c.slug = d.alvo;
  end if;
  return jsonb_build_object('denuncia', interno.rede3_mod_item(d), 'alvo', v_alvo,
    'historico', coalesce((select jsonb_agg(jsonb_build_object('acao', m.acao, 'regra', m.regra, 'motivo', m.motivo, 'criado_em', m.criado_em) order by m.criado_em desc)
                           from rede_moderacao m where m.alvo_tipo = d.alvo_tipo and m.alvo = d.alvo and m.acao <> 'quebra_vidro'), '[]'::jsonb));
end
; end $function$;

CREATE OR REPLACE FUNCTION public.alumia_painel_denuncia_decidir(p_id uuid, p_decisao text, p_regra text, p_motivo text, p_resposta text DEFAULT ''::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'interno', 'pg_temp'
AS $function$begin perform interno.alumia_porta();
declare
  v uuid := auth.uid(); d rede_denuncias; x rede_posts; v_regra text := interno.txt(p_regra, 'regra', 3, 80); v_motivo text := interno.alumia_painel_motivo(p_motivo);
  v_resposta text := interno.txt(coalesce(p_resposta, ''), 'resposta', 0, 300); v_afetado uuid;
begin
  perform interno.alumia_painel_exige();
  perform interno.limite('alumia_painel_agir', 300, 60);
  if p_decisao is null or p_decisao not in ('ocultar', 'avisar', 'descartar') then perform interno.erro('invalido:decisao'); end if;
  select * into d from rede_denuncias where id = p_id for update;
  if not found then perform interno.erro('nao_encontrado'); end if;
  if d.situacao in ('resolvida', 'descartada') then perform interno.erro('ja_decidida'); end if;
  if d.alvo_tipo = 'post' then
    select * into x from rede_posts where id::text = d.alvo;
    if found then
      v_afetado := x.autor;
      -- Em post de núcleo, a decisão só vem depois de abrir a denúncia (o acesso registrado e a mediação avisada).
      if x.nucleo is not null and not exists (select 1 from interno.rede_nucleo_sem_membros() n where n.nucleo = x.nucleo and n.usuario = v)
         and not exists (select 1 from rede_moderacao m where m.acao = 'quebra_vidro' and m.denuncia = d.id and m.quem = v) then
        perform interno.erro('abra_primeiro');
      end if;
    end if;
  elsif d.alvo_tipo = 'perfil' then
    begin v_afetado := d.alvo::uuid; exception when others then v_afetado := null; end;
  end if;
  if p_decisao = 'ocultar' then
    if d.alvo_tipo <> 'post' or x.id is null then perform interno.erro('invalido:decisao'); end if;
    update rede_posts set oculto = true, retido = false, motivo = left(v_motivo, 200) where id = x.id;
    perform interno.rede3_mod_registrar('remover', 'post', x.id::text, v_regra, v_motivo, d.id);
    perform interno.rede3_mod_avisar_afetado(v_afetado, left('Um post seu foi retirado da Alumia (regra: ' || v_regra || '). Decisão de uma pessoa da coordenação. Você pode recorrer em até 30 dias, em Denúncias e recursos. Motivo: ' || v_motivo, 500));
  elsif p_decisao = 'avisar' then
    if d.alvo_tipo = 'comunidade' or v_afetado is null then perform interno.erro('invalido:decisao'); end if;
    perform interno.rede3_mod_registrar('avisar', d.alvo_tipo, d.alvo, v_regra, v_motivo, d.id);
    perform interno.rede3_mod_avisar_afetado(v_afetado, left('A coordenação da Alumia deixou um aviso para você (regra: ' || v_regra || '). Você pode recorrer em até 30 dias, em Denúncias e recursos. Motivo: ' || v_motivo, 500));
  else
    perform interno.rede3_mod_registrar('descartar', d.alvo_tipo, d.alvo, v_regra, v_motivo, d.id);
  end if;
  update rede_denuncias set situacao = case when p_decisao = 'descartar' then 'descartada' else 'resolvida' end, cuida = v where id = d.id;
  perform interno.avisar_em(d.quem, left('Sua denúncia ' || d.protocolo || case when p_decisao = 'descartar'
      then ' foi analisada: não encontramos violação das normas da Alumia.' else ' foi analisada e a Alumia tomou providências.' end
    || case when v_resposta <> '' then ' Resposta da coordenação: ' || v_resposta else '' end || ' Obrigada por cuidar da rede.', 500), 'rede');
  perform interno.alumia_painel_registrar('denuncia_' || p_decisao, 'denuncia', d.protocolo, case when v_afetado is null then '' else interno.alumia_painel_nome_fixo(v_afetado) end, v_motivo,
    jsonb_build_object('regra', v_regra, 'categoria', d.categoria, 'alvo_tipo', d.alvo_tipo, 'respondeu', v_resposta <> ''));
  return jsonb_build_object('situacao', case when p_decisao = 'descartar' then 'descartada' else 'resolvida' end);
end
; end $function$;

CREATE OR REPLACE FUNCTION public.rede_alumia_pasta_mudar(p_id uuid, p_nome text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'interno', 'pg_temp'
AS $function$begin perform interno.alumia_porta();
declare v uuid := interno.eu(); k rede_alumia_pastas;
begin
  perform interno.aberta('comunidade');
  k := interno.rede_alumia_pasta(p_id, v);
  if k.nucleo is not null and not exists (select 1 from interno.rede_nucleo_sem_membros() m where m.nucleo = k.nucleo and m.usuario = v and m.papel = 'mediacao') then
    perform interno.erro('sem_permissao');
  end if;
  perform interno.limite('alumia_pasta', 30, 60);
  if p_nome is null then
    delete from rede_alumia_pastas where id = k.id;
    return jsonb_build_object('apagada', true);
  end if;
  begin
    update rede_alumia_pastas set nome = interno.txt(p_nome, 'nome', 1, 40) where id = k.id;
  exception when unique_violation then perform interno.erro('invalido:nome');
  end;
  return jsonb_build_object('id', k.id, 'nome', btrim(p_nome));
end
; end $function$;

CREATE OR REPLACE FUNCTION public.rede_alumia_pastas(p_post uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'interno', 'pg_temp'
AS $function$begin perform interno.alumia_porta();
declare v uuid := interno.eu();
begin
  perform interno.aberta('comunidade');
  perform interno.limite('rede2_ler', 600, 60);
  return jsonb_build_object('itens', (select coalesce(jsonb_agg(jsonb_build_object('id', k.id, 'nome', k.nome,
      'nucleo', case when k.nucleo is not null then jsonb_build_object('id', n.id, 'nome', n.nome) end,
      'posts', (select count(*)::integer from rede_alumia_pasta_itens i where i.pasta = k.id),
      'tem', case when p_post is not null then exists (select 1 from rede_alumia_pasta_itens i where i.pasta = k.id and i.post = p_post) end)
      order by (k.nucleo is not null), lower(k.nome)), '[]'::jsonb)
    from rede_alumia_pastas k left join rede_nucleos n on n.id = k.nucleo
    where k.usuario = v or (k.nucleo is not null and interno.rede2_no_nucleo(k.nucleo, v))),
    'nucleos', (select coalesce(jsonb_agg(jsonb_build_object('id', n.id, 'nome', n.nome) order by n.nome), '[]'::jsonb)
      from rede_nucleos n join interno.rede_nucleo_sem_membros() m on m.nucleo = n.id and m.usuario = v));
end
; end $function$;

CREATE OR REPLACE FUNCTION public.rede_com_encontro_remover(p_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'interno', 'pg_temp'
AS $function$begin perform interno.alumia_porta();
declare v uuid := interno.eu();
begin
  delete from rede_encontros e where e.id = p_id and exists (select 1 from interno.rede_nucleo_sem_membros() m where m.nucleo = e.nucleo and m.usuario = v and m.papel = 'mediacao');
  return jsonb_build_object('ok', true);
end
; end $function$;

CREATE OR REPLACE FUNCTION public.rede_com_encontro_salvar(p jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'interno', 'pg_temp'
AS $function$begin perform interno.alumia_porta();
declare v uuid := interno.eu(); v_nucleo uuid; v_quando timestamptz; v_tipo text := coalesce(p ->> 'local_tipo', ''); v_texto text; v_id uuid;
begin
  if p is null or jsonb_typeof(p) is distinct from 'object' then perform interno.erro('invalido:encontro'); end if;
  begin
    v_nucleo := (p ->> 'nucleo')::uuid; v_quando := (p ->> 'quando')::timestamptz;
  exception when others then perform interno.erro('invalido:encontro');
  end;
  if not exists (select 1 from interno.rede_nucleo_sem_membros() where nucleo = v_nucleo and usuario = v and papel = 'mediacao') then perform interno.erro('sem_permissao'); end if;
  if v_quando < now() - interval '1 hour' or v_quando > now() + interval '1 year' then perform interno.erro('invalido:quando'); end if;
  if v_tipo not in ('praca', 'biblioteca', 'sindicato', 'escola', 'universidade', 'associacao', 'online', 'outro') then perform interno.erro('invalido:local'); end if;
  v_texto := interno.txt(p ->> 'local_texto', 'local', case when v_tipo = 'outro' then 3 else 0 end, 140);
  -- Ponto de encontro público, nunca endereço de casa: rua, avenida etc. com número, ou CEP, ficam de fora.
  if v_texto ~* '\m(rua|avenida|av\.?|travessa|alameda|estrada|rodovia)\M[^;]{0,60}\d' or v_texto ~ '\d{5}-?\d{3}' then perform interno.erro('dado_pessoal'); end if;
  insert into rede_encontros (nucleo, quando, local_tipo, local_texto) values (v_nucleo, v_quando, v_tipo, v_texto) returning id into v_id;
  return jsonb_build_object('id', v_id);
end
; end $function$;

CREATE OR REPLACE FUNCTION public.rede_com_nucleo(p_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'interno', 'pg_temp'
AS $function$begin perform interno.alumia_porta();
declare v uuid := interno.eu(); n rede_nucleos;
begin
  -- R2: o servidor não sabe quem é do núcleo. Devolve só o perfil público e a caixa de entrada (id e passe de depósito públicos de
  -- propósito, chave X-Wing da entrada e a assinatura da chave de gestão do núcleo, que o aparelho confere). Papel, mediação e
  -- encontros moram no grupo, nos aparelhos.
  if not interno.rede2_membro(v) then perform interno.erro('nao_encontrado'); end if;
  select * into n from rede_nucleos where id = p_id;
  if n.id is null then perform interno.erro('nao_encontrado'); end if;
  return jsonb_build_object(
    'id', n.id, 'nome', n.nome, 'cidade', n.cidade, 'trilha', n.trilha, 'org', n.org,
    'entrada', case when n.entrada_caixa is not null then jsonb_build_object(
      'caixa', interno.rede_nucleo_b64url(n.entrada_caixa), 'pd', interno.rede_nucleo_b64url(n.entrada_pd), 'xwing', interno.rede_nucleo_b64url(n.entrada_xwing),
      'chave', interno.rede_nucleo_b64url(n.entrada_chave), 'assinatura', interno.rede_nucleo_b64url(n.entrada_assinatura)) end);
end
; end $function$;

CREATE OR REPLACE FUNCTION public.rede_com_nucleo_abrir(p_nucleo uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'interno', 'pg_temp'
AS $function$begin perform interno.alumia_porta();
declare v uuid := interno.eu(); n nucleos; v_id uuid;
begin
  select * into n from nucleos where id = p_nucleo and ativo;
  if not found then perform interno.erro('nao_encontrado'); end if;
  if not (interno.coord() or (n.acompanha is not null and n.acompanha = v)) then perform interno.erro('sem_permissao'); end if;
  insert into rede_nucleos (nucleo, nome, cidade, criado_por) values (n.id, n.nome, n.cidade, v)
  on conflict (nucleo) do nothing;
  select id into v_id from rede_nucleos where nucleo = n.id;
  -- R2: ninguém entra no núcleo pelo servidor; quem acompanha cria o grupo no aparelho e publica a caixa de entrada
  -- (public.rede_nucleo_entrada_iniciar).
  perform interno.registrar('rede_com_nucleo_abrir', v_id::text, '{}'::jsonb);
  return jsonb_build_object('id', v_id);
end
; end $function$;

CREATE OR REPLACE FUNCTION public.rede_com_nucleos()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'interno', 'pg_temp'
AS $function$begin perform interno.alumia_porta();
declare v uuid := interno.eu();
begin
  return jsonb_build_object('itens', (
    select coalesce(jsonb_agg(jsonb_build_object('id', n.id, 'nome', n.nome, 'cidade', n.cidade, 'trilha', n.trilha, 'papel', m.papel) order by n.nome), '[]'::jsonb)
    from interno.rede_nucleo_sem_membros() m join rede_nucleos n on n.id = m.nucleo where m.usuario = v));
end
; end $function$;

CREATE OR REPLACE FUNCTION public.rede_fix_convite_usar(p_codigo text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'interno', 'pg_temp'
AS $function$begin perform interno.alumia_porta();
declare
  v uuid := interno.eu(); c rede_convites; e rede_espacos; n rede_nucleos;
  v_cru text := btrim(coalesce(p_codigo, ''));
  v_norm text := lower(regexp_replace(v_cru, '[^a-zA-Z0-9]', '', 'g'));
begin
  perform interno.rede_fix_idade(true);
  perform interno.limite('rede_fix_convite_usar', 20, 60);
  perform interno.rede_fix_expirar_codigos();
  if char_length(v_cru) = 12 and v_cru ~ '^[A-Za-z0-9]{12}$' then
    select * into e from rede_espacos where codigo = v_cru and codigo_expira_em is not null and codigo_expira_em > now() and codigo_apagado_em is null;
    if not found then return jsonb_build_object('ok', false, 'erro', 'convite_vencido'); end if;
    insert into rede_espaco_membros (espaco, usuario) values (e.slug, v) on conflict do nothing;
    return jsonb_build_object('ok', true, 'tipo', 'espaco', 'slug', e.slug, 'nome', e.nome, 'antigo', true);
  end if;
  if v_norm !~ '^[a-f0-9]{32}$' then return jsonb_build_object('ok', false, 'erro', 'convite_vencido'); end if;
  select * into c from rede_convites where token_hash = encode(sha256(convert_to(v_norm, 'UTF8')), 'hex') for update;
  if not found or c.revogado_em is not null or c.validade <= now() then return jsonb_build_object('ok', false, 'erro', 'convite_vencido'); end if;
  if c.espaco is not null then
    select * into e from rede_espacos where slug = c.espaco;
    if not exists (select 1 from rede_espaco_membros where espaco = c.espaco and usuario = v) then
      if c.usos >= c.usos_max then return jsonb_build_object('ok', false, 'erro', 'convite_vencido'); end if;
      insert into rede_espaco_membros (espaco, usuario, cuida) values (c.espaco, v, c.escopo = 'mediacao');
      update rede_convites set usos = usos + 1 where id = c.id;
    end if;
    return jsonb_build_object('ok', true, 'tipo', 'espaco', 'slug', e.slug, 'nome', e.nome);
  end if;
  if not interno.rede2_membro(v) then perform interno.erro('consentimento'); end if;
  select * into n from rede_nucleos where id = c.nucleo;
  -- R2: convite de núcleo não põe ninguém no núcleo pelo servidor (que não sabe quem é de qual núcleo). A tela leva a pessoa ao
  -- pedido de entrada pela caixa do núcleo, que a mediação aceita no aparelho.
  return jsonb_build_object('ok', false, 'erro', 'nucleo_pela_entrada', 'nucleo', n.id, 'nome', n.nome);
end
; end $function$;

CREATE OR REPLACE FUNCTION public.rede_meusdados_exportar()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'interno', 'pg_temp'
AS $function$begin perform interno.alumia_porta();
declare v uuid := interno.eu(); v_saida jsonb;
begin
  if not interno.alumia_md_fator_recente() then perform interno.erro('confirme_segundo_fator'); end if;
  perform interno.limite('rede_meusdados_exportar', 1, 1440);
  v_saida := jsonb_build_object(
    'formato', 'alumia-meus-dados/1',
    'gerado_em', now(),
    'conta', jsonb_build_object('email', interno.email_da_conta(v), 'criada_em', (select criado_em from perfis where id = v)),
    'perfil', coalesce((select jsonb_build_object(
        'codinome', f.rede_codinome, 'arroba', f.rede_handle, 'bio', f.rede_bio, 'pronomes', f.rede_pronomes,
        'identidade', f.rede_identidade, 'modo', f.rede_modo, 'invisivel', f.rede_invisivel,
        'status', jsonb_build_object('tipo', f.rede_status_tipo, 'texto', f.rede_status_texto, 'ate', f.rede_status_ate),
        'estudando', f.rede_estudando, 'aparencia', f.rede_aparencia, 'selos', f.rede_selos, 'mostrar_selos', f.rede_selos_mostrar,
        'avatar', f.rede_avatar, 'avatar_desenho', f.rede_avatar_dados, 'capa', f.rede_capa, 'capa_desenho', f.rede_capa_dados,
        'foto_publica', nullif(f.foto_publica, ''), 'post_fixado', f.rede_fixado, '18_anos', f.rede_18)
      from perfis f where f.id = v), '{}'::jsonb),
    'campos_do_perfil', interno.alumia_md_parte('select ordem, rotulo, valor from rede_perfil_campos where usuario = $1 order by ordem', v),
    'consentimentos', interno.alumia_md_parte('select versao, criado_em, revogado_em, fediverso from rede_consentimentos where usuario = $1 order by criado_em', v),
    'entrada', interno.alumia_md_parte('select situacao, origem, motivo_pedido, pedido_em, decidido_em, motivo_decisao from alumia_entrada where usuario = $1', v),
    'posts', interno.alumia_md_parte($q$
      select x.id, x.tipo, x.titulo, x.texto, x.corpo, x.comunidade, coalesce(x.publico, x.alcance) as publico, x.resposta_a,
             x.quote_of as citando, x.repost_de as repostando, x.aviso, x.flair, x.posicao, x.criado_em, x.editado_em, x.apagado_em,
             (x.oculto or x.retido) as fora_do_ar,
             interno.alumia_md_piso((select count(*) from rede_posts r where r.resposta_a = x.id and r.autor is distinct from $1)) as respostas_de_outras_pessoas,
             interno.alumia_md_piso((select count(*) from rede_apoios a where a.post = x.id and a.usuario <> $1)) as apoios,
             interno.alumia_md_piso((select count(*) from rede_reacoes r where r.post = x.id and r.usuario <> $1)
                                  + (select count(*) from rede_reacoes_emoji r where r.post = x.id and r.usuario <> $1)) as reacoes,
             (select coalesce(jsonb_agg(jsonb_build_object('arquivo', m.caminho, 'tipo', m.tipo, 'descricao', m.alt) order by m.ordem), '[]'::jsonb)
                from rede_midia m where m.post = x.id) as midias,
             (select coalesce(jsonb_agg(jsonb_build_object('arquivo', a.caminho, 'tipo', a.tipo, 'segundos', a.duracao)), '[]'::jsonb)
                from rede_audios a where a.post = x.id) as audios,
             (select coalesce(jsonb_agg(jsonb_build_object('texto', e.texto_anterior, 'em', e.criado_em) order by e.criado_em), '[]'::jsonb)
                from rede_post_edicoes e where e.post = x.id) as versoes_anteriores,
             (select to_jsonb(c) - 'post' - 'lembrete_24h_em' - 'lembrete_2h_em' from rede_chamados c where c.post = x.id) as ato
      from rede_posts x where x.autor = $1 order by x.criado_em limit 50000 $q$, v),
    'rascunhos', interno.alumia_md_parte('select pedido, atualizado_em from rede_rascunhos where autor = $1 order by atualizado_em', v),
    'agendados', interno.alumia_md_parte('select pedido, quando, estado, repetir, repetir_ate, criado_em from rede_agendados where autor = $1 order by quando', v),
    'stories', interno.alumia_md_parte($q$
      select s.id, s.publico, s.texto, s.legenda, s.legendas, s.fundo, s.cor, s.estilo, s.musica, s.alt as descricao, s.midia_caminho as arquivo,
             s.post_ref as post, s.comunidade, s.criado_em, s.expira_em
      from rede_stories s where s.autor = $1 order by s.criado_em $q$, v),
    'destaques_de_stories', interno.alumia_md_parte($q$
      select d.titulo, d.cor, d.ordem, d.criado_em,
             (select coalesce(jsonb_agg(n.story order by n.ordem), '[]'::jsonb) from rede_story_no_destaque n where n.destaque = d.id) as stories
      from rede_story_destaques d where d.autor = $1 order by d.ordem $q$, v),
    'respostas_a_stories', interno.alumia_md_parte('select story, texto, pergunta, criado_em from rede_story_respostas where quem = $1 order by criado_em', v),
    'notas_da_comunidade', interno.alumia_md_parte('select post, texto, fonte, situacao, criado_em from rede_alumia_notas where autora = $1 order by criado_em', v),
    'perguntas_que_fiz', interno.alumia_md_parte('select texto, anonima, situacao, criado_em, respondida_em is not null as respondida from rede_alumia_perguntas where quem = $1 order by criado_em', v),
    'minhas_caixas_de_perguntas', interno.alumia_md_parte($q$
      select c.comunidade, c.chamada, c.aberta, c.anonimas, c.criado_em,
             interno.alumia_md_piso((select count(*) from rede_alumia_perguntas p where p.caixa = c.id)) as perguntas_recebidas
      from rede_alumia_caixas c where c.dono = $1 order by c.criado_em $q$, v))
  -- (em partes: uma chamada de função leva no máximo 100 argumentos)
  || jsonb_build_object(
    'seguindo', interno.alumia_md_parte($q$
      select coalesce('@' || f.rede_handle, interno.rede_nome(s.segue)) as quem, s.pendente as esperando_aceite, s.criado_em
      from rede_seguindo s join perfis f on f.id = s.segue where s.quem = $1 order by s.criado_em $q$, v),
    'seguidores', jsonb_build_object('quantos', interno.alumia_md_piso((select count(*) from rede_seguindo s where s.segue = v and not s.pendente))),
    'comunidades', interno.alumia_md_parte('select comunidade, papel, situacao, entrou_em from rede_comunidade_membros where usuario = $1 order by entrou_em', v),
    'comunidades_seguidas', interno.alumia_md_parte('select comunidade from rede_comunidades_seguidas where usuario = $1 order by comunidade', v),
    'espacos_fechados', interno.alumia_md_parte('select espaco, entrou_em from rede_espaco_membros where usuario = $1 order by entrou_em', v),
    'organizacoes_que_ajudo_a_gerir', interno.alumia_md_parte('select coalesce(''@'' || f.rede_handle, '''') as organizacao, g.papel, g.desde from rede_org_gestores g join perfis f on f.id = g.org where g.gestor = $1', v),
    'mandatos', interno.alumia_md_parte('select funcao, inicio, fim, origem, aceito, encerrado_dia from rede_org_mandatos where pessoa = $1 order by inicio', v),
    'salvos', interno.alumia_md_parte('select post, criado_em from rede_salvos where usuario = $1 order by criado_em', v),
    'pastas', interno.alumia_md_parte($q$
      select p.nome, p.criado_em, (select coalesce(jsonb_agg(i.post order by i.criado_em), '[]'::jsonb) from rede_alumia_pasta_itens i where i.pasta = p.id) as posts
      from rede_alumia_pastas p where p.usuario = $1 order by p.criado_em $q$, v),
    'lembretes', interno.alumia_md_parte('select post, quando from rede_alumia_lembretes where usuario = $1 order by quando', v),
    'conversas_que_sigo', interno.alumia_md_parte('select raiz as post, criado_em from rede_alumia_seguir_conversa where usuario = $1 order by criado_em', v),
    'temas_que_sigo', interno.alumia_md_parte('select tag, criado_em from rede_alumia_seguir_tag where usuario = $1 order by criado_em', v),
    'buscas_salvas', interno.alumia_md_parte('select nome, q as busca, criado_em from rede_alumia_buscas_salvas where usuario = $1 order by criado_em', v),
    'interesses', interno.alumia_md_parte('select tipo, chave, criado_em from rede_desc_interesses where usuario = $1 order by criado_em', v),
    'repostagens', interno.alumia_md_parte('select post, criado_em from rede_repostagens where quem = $1 order by criado_em', v),
    'apoios_que_dei', interno.alumia_md_parte('select post from rede_apoios where usuario = $1', v),
    'reacoes_que_dei', interno.alumia_md_parte($q$
      select post, tipo as reacao, criado_em from rede_reacoes where usuario = $1
      union all select post, emoji, criado_em from rede_reacoes_emoji where usuario = $1 order by 3 $q$, v),
    'atos_que_vou', interno.alumia_md_parte('select post as ato, criado_em from rede_vou where usuario = $1 order by criado_em', v),
    'caronas', interno.alumia_md_parte('select ato, tipo, meio, saida_publica as saida, vagas, sai_em, criado_em from rede_ato_caronas where quem = $1 order by criado_em', v),
    'peticoes_que_assinei', interno.alumia_md_parte('select peticao, criado_em from rede_peticao_assinaturas where usuario = $1 order by criado_em', v),
    'minhas_peticoes', interno.alumia_md_parte($q$
      select pe.post, pe.alvo, pe.texto, pe.prazo, pe.encerrada,
             interno.alumia_md_piso((select count(*) from rede_peticao_assinaturas a where a.peticao = pe.id)) as assinaturas
      from rede_peticoes pe join rede_posts x on x.id = pe.post where x.autor = $1 order by pe.criada_em $q$, v),
    'consultas_em_que_votei', interno.alumia_md_parte('select consulta from rede_consulta_votantes where usuario = $1', v))
  || jsonb_build_object(
    'correntes', interno.alumia_md_parte('select texto, cidade, meta, quando, criada_em, expira_em from rede_correntes where autor = $1 order by criada_em', v),
    'bloqueei', interno.alumia_md_parte($q$
      select coalesce('@' || f.rede_handle, interno.rede_nome(b.bloqueado)) as quem, b.criado_em
      from rede_bloqueios b join perfis f on f.id = b.bloqueado where b.quem = $1 order by b.criado_em $q$, v),
    'silenciei', interno.alumia_md_parte($q$
      select case when s.pessoa is not null then coalesce('@' || f.rede_handle, interno.rede_nome(s.pessoa)) end as pessoa, s.comunidade, s.palavra, s.conversa, s.ate, s.criado_em
      from rede_silenciados s left join perfis f on f.id = s.pessoa where s.usuario = $1 order by s.criado_em $q$, v),
    'minha_roda', interno.alumia_md_parte($q$
      select coalesce('@' || f.rede_handle, interno.rede_nome(r.membro)) as quem, r.criado_em
      from rede_roda r join perfis f on f.id = r.membro where r.dono = $1 order by r.criado_em $q$, v),
    'preferencias_de_avisos', interno.alumia_md_parte('select tipo, canal, ligado from rede_avisos_prefs where usuario = $1 order by tipo, canal', v),
    'aparelhos_com_push', jsonb_build_object('quantos', (select count(*) from rede_push_assinaturas where usuario = v)),
    'avisos', interno.alumia_md_parte($q$
      select a.tipo, a.categoria, a.post, a.lido, a.criado_em,
             case when a.categoria = 'conta' or a.tipo = 'moderacao' then a.texto end as texto
      from avisos a where a.para = $1 and a.categoria in ('rede', 'conta') order by a.criado_em desc limit 2000 $q$, v),
    'decisoes_da_moderacao_sobre_mim', interno.alumia_md_parte($q$
      select m.acao, m.alvo_tipo, m.alvo, m.regra, m.motivo, m.criado_em from rede_moderacao m
      where (m.alvo_tipo in ('pessoa', 'usuario') and m.alvo = $1::text)
         or (m.alvo_tipo = 'post' and m.alvo in (select x.id::text from rede_posts x where x.autor = $1))
      order by m.criado_em $q$, v),
    'sancoes', interno.alumia_md_parte('select tipo, motivo, criado_em, ate, encerrada_em from alumia_sancoes where usuario = $1 order by criado_em', v),
    'denuncias_que_fiz', interno.alumia_md_parte('select protocolo, alvo_tipo, alvo, categoria, texto, situacao, criado_em from rede_denuncias where quem = $1 order by criado_em', v),
    'recursos_que_fiz', interno.alumia_md_parte('select acao as decisao, texto, situacao, criado_em, decidido_em from rede_recursos where autor = $1 order by criado_em', v),
    'perguntas_em_plenarias', interno.alumia_md_parte('select plenaria, texto, mostrar, criado_em, respondida_em from rede_plenaria_perguntas where autor = $1 order by criado_em', v),
    'fediverso', coalesce((select jsonb_build_object('ligado', a.ligado, 'desde', a.ligado_em, 'arroba', a.handle,
        'seguidores_de_fora', interno.alumia_md_piso((select count(*) from rede_fed_seguidores s where s.perfil = v)),
        'contas_de_fora_que_sigo', (select coalesce(jsonb_agg(s.ator order by s.criado_em), '[]'::jsonb) from rede_fed_seguindo s where s.perfil = v))
      from rede_fed_atores a where a.perfil = v), 'null'::jsonb),
    'conversas_privadas', 'As conversas do chat privado não entram nesta cópia: o servidor guarda só o texto cifrado, que só os aparelhos de quem conversa conseguem abrir.',
    'midias', interno.alumia_md_parte($q$
      select 'rede-midia' as deposito, m.caminho from rede_midia m join rede_posts x on x.id = m.post where x.autor = $1 and m.caminho like $1::text || '/%'
      union select 'rede-midia', a.caminho from rede_audios a join rede_posts x on x.id = a.post where x.autor = $1 and a.caminho like $1::text || '/%'
      union select 'rede-stories', s.midia_caminho from rede_stories s where s.autor = $1 and s.midia_caminho like $1::text || '/%'
      order by 1, 2 limit 5000 $q$, v));
  return v_saida;
end
; end $function$;

CREATE OR REPLACE FUNCTION public.rede_meusdados_mais()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'interno', 'pg_temp'
AS $function$begin perform interno.alumia_porta();
declare v uuid := interno.eu();
begin
  if v is null then perform interno.erro('sem_sessao'); end if;
  if not interno.alumia_md_fator_recente() then perform interno.erro('confirme_segundo_fator'); end if;
  return jsonb_build_object(
    'links_do_perfil', interno.alumia_md_parte($q$
      select l.ordem, l.titulo, l.url, l.conferido_como, l.conferido_em, l.pedido_em, l.mediacao_em
      from alumia_perfil_links l where l.usuario = $1 order by l.ordem $q$, v),
    'secoes_do_perfil', interno.alumia_md_parte($q$
      select s.secoes, s.sobre, s.comunidades, s.atualizado_em from alumia_perfil_secoes s where s.usuario = $1 $q$, v),
    'voluntariado_no_perfil', interno.alumia_md_parte($q$
      select p.frente, p.ano_de, p.ano_ate, p.situacao from alumia_perfil_voluntariado p where p.usuario = $1 order by p.ano_de $q$, v),
    'outras_identidades', interno.alumia_md_parte($q$
      select i.tipo, i.criada_em, f.rede_codinome as codinome, f.rede_handle as arroba
      from rede_identidades i join perfis f on f.id = i.identidade where i.dono = $1 and i.identidade <> $1 order by i.criada_em $q$, v),
    'aceites_dos_termos', interno.alumia_md_parte($q$
      select t.versao, t.aceito_em, t.como from alumia_termos_aceites t where t.usuario = $1 order by t.aceito_em $q$, v),
    'regras_lidas', interno.alumia_md_parte($q$
      select r.comunidade, r.lidas_em from alumia_regras_lidas r where r.usuario = $1 order by r.lidas_em $q$, v),
    'redacoes', interno.alumia_md_parte($q$
      select r.semana, r.titulo, r.texto, r.entregue_em, r.devolvida_em, r.apagar_em from alumia_redacoes r where r.autora = $1 order by r.semana $q$, v),
    'redacoes_por_semana', interno.alumia_md_parte($q$
      select c.semana, c.feitas, c.dispensada, c.medalha from alumia_redacao_creditos c where c.usuario = $1 order by c.semana $q$, v),
    'recado_no_mural', interno.alumia_md_parte($q$
      select m.como, m.codinome, m.curso, m.instituicao, m.recado, m.entrou_em from alumia_mural m where m.usuario = $1 $q$, v),
    'questoes', interno.alumia_md_parte($q$
      select q.materia, q.tema, q.enunciado, q.alternativas, q.certa, q.explicacao, q.criado_em, q.mudou_em, q.retirada_em
      from rede_questoes q where q.autor = $1 order by q.criado_em $q$, v),
    'fio_esperando_para_sair', interno.alumia_md_parte($q$
      select e.post, e.blocos, e.criado_em from rede_o12_fio_espera e where e.autor = $1 order by e.criado_em $q$, v),
    'extras_dos_agendados', interno.alumia_md_parte($q$
      select a.agendado, a.fuso, a.extras from rede_o12_agendado a where a.autor = $1 $q$, v),
    'propostas_de_comunidade', interno.alumia_md_parte($q$
      select p.slug, p.nome, p.objetivo, p.regras, p.situacao, p.motivo, p.criado_em from rede_propostas p where p.autor = $1 order by p.criado_em $q$, v),
    'sinteses', interno.alumia_md_parte($q$
      select s.raiz, s.texto, s.criado_em, s.retirada_em from rede_sinteses s where s.autor = $1 order by s.criado_em $q$, v),
    'perguntas_em_ama', interno.alumia_md_parte($q$
      select p.ama, p.nome, p.texto, p.situacao, p.resposta, p.motivo, p.criado_em, p.respondida_em
      from rede_ama_perguntas p where p.quem = $1 order by p.criado_em $q$, v),
    'reacoes_a_stories', interno.alumia_md_parte($q$ select r.story, r.reacao from rede_story_reacoes r where r.quem = $1 $q$, v),
    'lembretes_de_ato_em_stories', interno.alumia_md_parte($q$ select l.ato from rede_story_lembretes l where l.quem = $1 $q$, v),
    'falas_em_atas', interno.alumia_md_parte($q$
      select f.ata, f.ponto, f.posicao, f.falou_em from rede_org_ata_falas f where f.pessoa = $1 order by f.falou_em $q$, v),
    'candidaturas', interno.alumia_md_parte($q$ select c.eleicao, c.opcao from rede_org_eleicao_candidatos c where c.pessoa = $1 $q$, v),
    'conquistas', interno.alumia_md_parte($q$
      select c.medalha, c.alvo, c.progresso, c.mostrar from alumia_conquistas c where c.usuario = $1 order by c.medalha $q$, v),
    'convites_que_gerei', interno.alumia_md_parte($q$
      select c.criado_em, c.vence_em, c.situacao from alumia_convites c where c.criado_por = $1 order by c.criado_em $q$, v),
    'colecoes_do_acervo', interno.alumia_md_parte($q$
      select c.comunidade, c.titulo, c.descricao, c.criado_em, c.mudou_em from rede_acervo_colecoes c where c.usuario = $1 order by c.criado_em $q$, v),
    'agenda_assinada', interno.alumia_md_parte($q$
      select a.data, a.desde from alumia_agenda_assinaturas a where a.usuario = $1 order by a.desde $q$, v),
    'funcoes', jsonb_build_object(
      'cargos', interno.alumia_md_parte($q$
        select c.cargo, c.situacao, c.convidado_em, c.aceito_em from alumia_cargo_pessoas c where c.usuario = $1 order by c.convidado_em $q$, v),
      'moderacao', interno.alumia_md_parte($q$ select m.comunidade from rede_moderadores m where m.usuario = $1 order by 1 $q$, v),
      'lideranca', interno.alumia_md_parte($q$ select l.criado_em from rede_lideres l where l.usuario = $1 $q$, v),
      'monitoria', interno.alumia_md_parte($q$
        select m.disciplinas, m.situacao, m.nomeado_em, m.aceito_em from alumia_monitores m where m.usuario = $1 $q$, v),
      'administracao', interno.alumia_md_parte($q$ select a.nomeado_em from alumia_painel_admin a where a.usuario = $1 $q$, v),
      'turmas', interno.alumia_md_parte($q$ select t.turma, t.cuida, t.entrou_em from alumia_turma_pessoas t where t.usuario = $1 order by t.entrou_em $q$, v)),
    'organizacoes', jsonb_build_object(
      'minha_organizacao', interno.alumia_md_parte($q$
        select o.tipo, o.cidade, o.documento_tipo, o.documento_publico, o.verificada_em, o.criada_em from rede_orgs o where o.perfil = $1 $q$, v),
      'robos_da_organizacao', interno.alumia_md_parte($q$
        select r.nome, r.descricao, r.situacao, r.criado_em from rede_pontes_robos r where r.perfil = $1 order by r.criado_em $q$, v),
      'boletins_assinados', interno.alumia_md_parte($q$
        select b.org, b.email as por_email, b.desde from rede_org_boletim_assinaturas b where b.usuario = $1 order by b.desde $q$, v),
      'sinos', interno.alumia_md_parte($q$ select s.org from rede_org_sinos s where s.usuario = $1 $q$, v)),
    'participacao', jsonb_build_object(
      'correntes', interno.alumia_md_parte($q$ select c.corrente from rede_corrente_vou c where c.usuario = $1 $q$, v),
      'tarefas_de_ato', interno.alumia_md_parte($q$ select t.tarefa, t.criado_em from rede_ato_tarefa_quem t where t.usuario = $1 order by t.criado_em $q$, v),
      'fotos_no_album_do_ato', interno.alumia_md_parte($q$
        select a.ato, a.caminho as arquivo, a.legenda, a.estado, a.criado_em, a.decidido_em from rede_ato_album a where a.quem = $1 order by a.criado_em $q$, v),
      'coautorias', interno.alumia_md_parte($q$
        select c.post, c.estado, c.convidada_em, c.decidida_em from rede_coautorias c where c.coautora = $1 order by c.convidada_em $q$, v),
      'etiquetas_em_comunidades', interno.alumia_md_parte($q$
        select e.comunidade, e.etiqueta, e.situacao, e.desde from alumia_etiqueta_de e where e.usuario = $1 order by e.desde $q$, v),
      'respostas_de_entrada_em_comunidade', interno.alumia_md_parte($q$
        select r.comunidade, r.respostas, r.criado_em from alumia_com_respostas r where r.usuario = $1 order by r.criado_em $q$, v),
      'notas_da_comunidade_avaliadas', interno.alumia_md_parte($q$
        select n.nota, n.ajuda, n.criado_em from rede_alumia_nota_votos n where n.usuario = $1 order by n.criado_em $q$, v),
      'pedidos_de_fonte', interno.alumia_md_parte($q$ select f.post, f.criado_em from rede_fonte_pedidos f where f.usuario = $1 order by f.criado_em $q$, v),
      'pedido_de_mais_convites', exists (select 1 from alumia_convite_pedidos p where p.usuario = v),
      -- As conversas que a pessoa abriu com a mediação (20261123-r1-uso.sql), com as mensagens dos dois lados: a da mediação sai
      -- como "mediacao", nunca com quem dela escreveu (a coluna "por" não entra).
      'conversas_com_a_moderacao', interno.alumia_md_parte($q$
        select c.comunidade, c.numero, c.com_codinome, c.situacao, c.criada_em, c.encerrada_em,
          (select coalesce(jsonb_agg(jsonb_build_object('de', m.de, 'texto', m.texto, 'em', m.em) order by m.id), '[]'::jsonb)
             from rede_modmail_mensagens m where m.conversa = c.id) as mensagens
        from rede_modmail_conversas c where c.autor = $1 order by c.criada_em $q$, v)),
    'preferencias', jsonb_build_object(
      'conversas', jsonb_build_object('onde', 'no_aparelho', 'arquivos_cifrados', interno.alumia_md_parte($q$
        select c.tipo, c.versao, c.dia, octet_length(c.blob) as bytes from rede_cofres_da_conta c where c.usuario = $1 order by c.tipo $q$, v)),
      'mencoes_e_marcacoes', interno.alumia_md_parte($q$
        select p.mencao_quem, p.marcar_quem, p.marcar_aprovar, p.blindagem_ate, p.atualizado_em from rede_o9_prefs p where p.usuario = $1 $q$, v),
      'silencio_dos_avisos', interno.alumia_md_parte($q$ select s.inicio, s.fim from rede_avisos_silencio s where s.usuario = $1 $q$, v),
      'primeiros_passos', interno.alumia_md_parte($q$
        select d.escolhas_em, d.guia_em, d.guia_pulado, d.aparece, d.aparece_em, d.escolhas_adiadas_em from rede_desc_entrada d where d.usuario = $1 $q$, v),
      'rotuladores_assinados', interno.alumia_md_parte($q$
        select r.rotulador, r.efeito, r.criado_em from alumia_rotulos_assinaturas r where r.usuario = $1 order by r.criado_em $q$, v),
      'tempo_de_conta', interno.alumia_md_parte($q$ select c.semanas, c.desde from rede_vida_conta c where c.usuario = $1 $q$, v)),
    'retencoes_por_precaucao', interno.alumia_md_parte($q$
      select r.criado_em, r.responder_ate, r.situacao, r.decidido_em from alumia_lei_retencoes r where r.usuario = $1 order by r.criado_em $q$, v));
end
; end $function$;

CREATE OR REPLACE FUNCTION public.rede_mod_abrir(p_denuncia uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'interno', 'pg_temp'
AS $function$begin perform interno.alumia_porta();
declare v uuid := interno.eu(); d rede_denuncias; x rede_posts; v_post jsonb; v_alvo_nome text; v_membro_nucleo boolean;
begin
  select * into d from rede_denuncias where id = p_denuncia;
  if not found or not interno.rede3_mod_pode_denuncia(d) then perform interno.erro('nao_encontrado'); end if;
  if d.situacao = 'aberta' then update rede_denuncias set situacao = 'em_analise', cuida = v where id = d.id; d.situacao := 'em_analise'; end if;
  if d.alvo_tipo = 'post' then
    select * into x from rede_posts where id::text = d.alvo;
    if found then
      if x.nucleo is not null then
        v_membro_nucleo := exists (select 1 from interno.rede_nucleo_sem_membros() n where n.nucleo = x.nucleo and n.usuario = v);
        if not v_membro_nucleo and not exists (select 1 from rede_moderacao m where m.acao = 'quebra_vidro' and m.denuncia = d.id and m.quem = v) then
          perform interno.rede3_mod_registrar('quebra_vidro', 'post', x.id::text, 'denuncia', 'A moderação geral abriu o post de núcleo por causa da denúncia ' || d.protocolo || '.', d.id);
          insert into avisos (para, texto, categoria)
          select n.usuario, 'A moderação geral abriu um post do núcleo por causa de uma denúncia (protocolo ' || d.protocolo || '). O acesso ficou registrado.', 'rede' from interno.rede_nucleo_sem_membros() n where n.nucleo = x.nucleo and n.papel = 'mediacao';
        end if;
      end if;
      v_post := jsonb_build_object(
        'id', x.id, 'tipo', x.tipo, 'titulo', x.titulo, 'texto', x.texto, 'corpo', x.corpo, 'comunidade', x.comunidade, 'publico', interno.rede2_publico(x),
        'criado_em', x.criado_em, 'oculto', x.oculto, 'retido', x.retido, 'travado', x.travado, 'motivo', x.motivo,
        'autor', interno.rede_nome(x.autor), 'autor_nivel', interno.rede3_mod_nivel(x.autor), 'autor_procedentes_90', interno.rede3_mod_procedentes(x.autor, 90),
        'rotulo', (select to_jsonb(r) - 'quem' from rede_rotulos r where r.post = x.id));
    end if;
  elsif d.alvo_tipo = 'perfil' then
    select jsonb_build_object('codinome', f.rede_codinome, 'handle', f.rede_handle, 'bio', f.rede_bio, 'nivel', interno.rede3_mod_nivel(f.id), 'procedentes_90', interno.rede3_mod_procedentes(f.id, 90)) into v_post from perfis f where f.id::text = d.alvo;
  end if;
  return jsonb_build_object(
    'denuncia', interno.rede3_mod_item(d), 'alvo', v_post,
    'historico', coalesce((select jsonb_agg(jsonb_build_object('id', m.id, 'acao', m.acao, 'regra', m.regra, 'motivo', m.motivo, 'criado_em', m.criado_em, 'por', interno.rede_nome(m.quem)) order by m.criado_em desc)
                           from rede_moderacao m where m.alvo_tipo = d.alvo_tipo and m.alvo = d.alvo and m.acao <> 'quebra_vidro'), '[]'::jsonb));
end
; end $function$;

CREATE OR REPLACE FUNCTION public.rede_mod_agir(p_denuncia uuid, p_alvo_tipo text, p_alvo text, p_acao text, p_regra text, p_motivo text, p_contexto text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'interno', 'pg_temp'
AS $function$begin perform interno.alumia_porta();
declare
  v uuid := interno.eu(); d rede_denuncias; x rede_posts; f perfis;
  v_regra text := interno.txt(p_regra, 'regra', 3, 80); v_motivo text := interno.txt(p_motivo, 'motivo', 3, 1000);
  v_id uuid; v_afetado uuid; v_motivo_log text := interno.txt(p_motivo, 'motivo', 3, 1000); v_texto text; v_com text := nullif(btrim(coalesce(p_contexto, '')), '');
begin
  if p_acao is null or p_acao not in ('remover', 'restaurar', 'reter', 'travar', 'destravar', 'avisar', 'banir', 'desbanir') then perform interno.erro('invalido:acao'); end if;
  if p_denuncia is not null then
    select * into d from rede_denuncias where id = p_denuncia;
    if not found or not interno.rede3_mod_pode_denuncia(d) then perform interno.erro('nao_encontrado'); end if;
    -- A denúncia tem de ser sobre o alvo da ação: senão ela serviria de passe livre (quebra-vidro) para mexer em outro post.
    if d.alvo_tipo is distinct from p_alvo_tipo then perform interno.erro('invalido:alvo'); end if;
  end if;
  perform interno.limite('rede3_agir', 300, 60);

  if p_alvo_tipo = 'post' and p_acao in ('remover', 'restaurar', 'reter', 'travar', 'destravar', 'avisar') then
    begin select * into x from rede_posts where id = p_alvo::uuid; exception when others then perform interno.erro('invalido:alvo'); end;
    if p_denuncia is not null and d.alvo is distinct from x.id::text then perform interno.erro('invalido:alvo'); end if;
    if not found or not interno.rede3_mod_pode_post(x, p_denuncia is not null) then perform interno.erro('nao_encontrado'); end if;
    -- Equipe geral em post de núcleo: só depois de abrir a denúncia (rede_mod_abrir registra o quebra-vidro e avisa a mediação).
    if x.nucleo is not null and not exists (select 1 from interno.rede_nucleo_sem_membros() n where n.nucleo = x.nucleo and n.usuario = v and n.papel = 'mediacao')
       and not exists (select 1 from rede_moderacao m where m.acao = 'quebra_vidro' and m.denuncia = p_denuncia and m.quem = v) then
      perform interno.erro('sem_permissao');
    end if;
    v_afetado := x.autor;
    if p_acao = 'remover' then update rede_posts set oculto = true, retido = false, motivo = left(v_motivo, 200) where id = x.id;
    elsif p_acao = 'restaurar' then update rede_posts set oculto = false, retido = false, motivo = '', avaliacao = 'revista' where id = x.id;
    elsif p_acao = 'reter' then update rede_posts set oculto = true, retido = true, motivo = left(v_motivo, 200) where id = x.id;
    elsif p_acao = 'travar' then update rede_posts set travado = true where id = x.id;
    elsif p_acao = 'destravar' then update rede_posts set travado = false where id = x.id;
    end if;
    v_id := interno.rede3_mod_registrar(p_acao, 'post', x.id::text, v_regra, v_motivo_log, p_denuncia);
  elsif p_alvo_tipo = 'perfil' and p_acao in ('avisar', 'banir', 'desbanir') then
    select * into f from perfis where rede_handle = lower(btrim(coalesce(p_alvo, ''), ' @'));
    if not found then
      begin select * into f from perfis where id = p_alvo::uuid; exception when others then null; end;
    end if;
    if f.id is null then perform interno.erro('nao_encontrado'); end if;
    if f.id = v or interno.voluntario_e(f.id) then perform interno.erro('sem_permissao'); end if;
    v_afetado := f.id;
    if p_acao in ('banir', 'desbanir') then
      if v_com is null or not exists (select 1 from rede_comunidades where slug = v_com) then perform interno.erro('invalido:contexto'); end if;
      if not interno.rede3_mod_modera(v_com, null) then perform interno.erro('sem_permissao'); end if;
      if p_acao = 'banir' then
        insert into rede_comunidade_membros (comunidade, usuario, situacao, papel) values (v_com, f.id, 'banido', 'membro')
        on conflict (comunidade, usuario) do update set situacao = 'banido', papel = 'membro', banido_ate = null;
      else
        delete from rede_comunidade_membros where comunidade = v_com and usuario = f.id and situacao = 'banido';
      end if;
      v_motivo_log := 'comunidade ' || v_com || ': ' || v_motivo;
    elsif not (interno.cuida() or (v_com is not null and interno.rede3_mod_modera(v_com, null))) then
      perform interno.erro('sem_permissao');
    end if;
    v_id := interno.rede3_mod_registrar(p_acao, 'perfil', f.id::text, v_regra, left(v_motivo_log, 1000), p_denuncia);
  else
    perform interno.erro('invalido:alvo_tipo');
  end if;

  v_texto := case p_acao
    when 'remover' then 'Um post seu foi retirado da Rede'
    when 'reter' then 'Um post seu ficou retido para leitura da moderação'
    when 'travar' then 'Uma conversa sua foi travada'
    when 'banir' then 'Você não pode mais escrever numa comunidade da Rede'
    when 'avisar' then 'A moderação da Rede deixou um aviso para você'
    else null end;
  if v_texto is not null and v_afetado is not null then
    perform interno.rede3_mod_avisar_afetado(v_afetado, left(v_texto || ' (regra: ' || v_regra || '). Decisão de uma pessoa da moderação. Você pode recorrer em até 30 dias, em Denúncias e recursos. Motivo: ' || left(v_motivo, 200), 500));
  end if;
  if p_denuncia is not null and p_acao <> 'restaurar' then
    update rede_denuncias set situacao = 'resolvida', cuida = v where id = d.id;
    perform interno.avisar_em(d.quem, 'Sua denúncia ' || d.protocolo || ' foi analisada e a Rede tomou providências. Obrigada por cuidar da Rede.', 'rede');
  end if;
  return jsonb_build_object('acao', v_id);
end
; end $function$;

CREATE OR REPLACE FUNCTION public.rede_mod_escopo()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'interno', 'pg_temp'
AS $function$begin perform interno.alumia_porta();
declare v uuid := interno.eu();
begin
  return jsonb_build_object(
    'cuida', interno.cuida(), 'coord', interno.coord(),
    'comunidades', coalesce((select jsonb_agg(m.comunidade order by m.comunidade) from rede_comunidade_membros m where m.usuario = v and m.papel = 'moderacao' and m.situacao = 'ativo'), '[]'::jsonb),
    'nomes', coalesce((select jsonb_object_agg(c.slug, c.nome) from rede_comunidade_membros m join rede_comunidades c on c.slug = m.comunidade
                       where m.usuario = v and m.papel = 'moderacao' and m.situacao = 'ativo'), '{}'::jsonb),
    'nucleos', coalesce((select jsonb_agg(jsonb_build_object('id', n.id, 'nome', n.nome) order by n.nome) from interno.rede_nucleo_sem_membros() m join rede_nucleos n on n.id = m.nucleo where m.usuario = v and m.papel = 'mediacao'), '[]'::jsonb));
end
; end $function$;

CREATE OR REPLACE FUNCTION public.rede_mod_fila(p_situacao text DEFAULT 'abertas'::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'interno', 'pg_temp'
AS $function$begin perform interno.alumia_porta();
declare v uuid := interno.eu();
begin
  if not (interno.cuida() or exists (select 1 from rede_comunidade_membros m where m.usuario = v and m.papel = 'moderacao' and m.situacao = 'ativo')
          or exists (select 1 from interno.rede_nucleo_sem_membros() n where n.usuario = v and n.papel = 'mediacao')) then
    perform interno.erro('sem_permissao');
  end if;
  return coalesce((select jsonb_agg(interno.rede3_mod_item(d) order by (d.situacao in ('aberta', 'em_analise')) desc, d.prioridade, d.criado_em)
    from (select * from rede_denuncias q
          where (case when coalesce(p_situacao, 'abertas') = 'fechadas' then q.situacao in ('resolvida', 'descartada') else q.situacao in ('aberta', 'em_analise') end)
          order by q.prioridade, q.criado_em limit 400) d
    where interno.rede3_mod_pode_denuncia(d)), '[]'::jsonb);
end
; end $function$;

CREATE OR REPLACE FUNCTION public.rede_nucleos_fechados_listar()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'interno', 'pg_temp'
AS $function$begin perform interno.alumia_porta();
begin
  perform interno.eu();
  if not interno.coord() then perform interno.erro('sem_permissao'); end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'nucleo', n.id, 'nome', n.nome, 'cidade', n.cidade, 'uf', n.uf,
      'acompanha', coalesce((select interno.nome_visto(p.nome) from perfis p where p.id = n.acompanha), ''),
      'aberto', r.id is not null,
      'rede', r.id) order by n.uf, n.cidade, n.nome)
    from nucleos n left join rede_nucleos r on r.nucleo = n.id where n.ativo), '[]'::jsonb);
end
; end $function$;

CREATE OR REPLACE FUNCTION public.rede_org_comunicacao(p_handle text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'interno', 'pg_temp'
AS $function$begin perform interno.alumia_porta();
declare v uuid := interno.eu(); o uuid := interno.alumia_org_de(p_handle); v_com boolean; v_gere boolean; v_ultimo timestamptz;
begin
  perform interno.rede3_perfil_exige_membro(v);
  perform interno.limite('alumia_o12_ler', 300, 10);
  if o is null or interno.rede_bloqueado(v, o) then return null; end if;
  v_com := interno.alumia_o12_comunica(v, o);
  v_gere := coalesce(interno.alumia_org_gere(v, o), false);
  if not v_com and not exists (select 1 from rede_nucleos n join interno.rede_nucleo_sem_membros() m on m.nucleo = n.id where n.org = o and m.usuario = v and m.papel = 'mediacao') then
    return null;
  end if;
  if v_com then perform interno.alumia_o12_vencer(o); end if;
  select max(saiu_em) into v_ultimo from rede_org_boletins where org = o;
  return jsonb_build_object(
    'comunico', v_com, 'gerencio', v_gere, 'selo', exists (select 1 from rede_orgs where perfil = o and verificada_em is not null),
    'fila', case when v_com then coalesce((select jsonb_agg(interno.alumia_o12_item(x.id, v) order by x.esperando desc, x.criado_em desc)
      from (select f.id, f.criado_em, f.situacao = 'esperando' as esperando from rede_org_fila f where f.org = o
            order by (f.situacao = 'esperando') desc, f.criado_em desc limit 50) x), '[]'::jsonb) else '[]'::jsonb end,
    'modelos', case when v_com then coalesce((select jsonb_agg(jsonb_build_object('id', m.id, 'nome', m.nome, 'texto', m.texto, 'publico', m.publico) order by lower(m.nome))
      from rede_org_modelos m where m.org = o), '[]'::jsonb) else '[]'::jsonb end,
    'nucleos', coalesce((select jsonb_agg(jsonb_build_object('id', n.id, 'nome', n.nome) || interno.alumia_o12_teto(n.id) order by n.nome)
      from rede_nucleos n where n.org = o and interno.alumia_o12_chama(v, n.id)), '[]'::jsonb),
    'boletim', case when v_com then jsonb_build_object(
      'assinantes', interno.alumia_pessoas((select count(*) from rede_org_boletim_assinaturas a join perfis f on f.id = a.usuario where a.org = o and not f.suspenso)),
      'porEmail', interno.alumia_pessoas((select count(*) from rede_org_boletim_assinaturas a join perfis f on f.id = a.usuario where a.org = o and a.email and not f.suspenso)),
      'ultimo', v_ultimo,
      'proximo', case when v_ultimo is not null and v_ultimo > now() - interval '6 days' then v_ultimo + interval '6 days' end,
      'posts', coalesce((select jsonb_agg(jsonb_build_object('id', p.id, 'texto', left(p.texto, 140), 'publico', p.publico, 'criadoEm', p.criado_em) order by p.criado_em desc)
        from (select * from rede_posts p where p.autor = o and (interno.alumia_o12_cabe_no_boletim(p.id, o, 'membros') or interno.alumia_o12_cabe_no_boletim(p.id, o, 'seguidores'))
                and p.criado_em > now() - interval '8 days'
              order by p.criado_em desc limit 30) p), '[]'::jsonb)) end,
    'dominio', case when v_gere then interno.alumia_o12_dominio_json(o) end);
end
; end $function$;

CREATE OR REPLACE FUNCTION public.rede_org_consulta_votar(p_consulta uuid, p_ranking uuid[])
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'interno', 'pg_temp'
AS $function$begin perform interno.alumia_porta();
declare v uuid := interno.eu(); c rede_consultas; v_nucleos uuid[]; v_opcoes uuid[];
begin
  perform interno.rede3_perfil_exige_membro(v);
  select * into c from rede_consultas where id = p_consulta;
  if not found or interno.rede_bloqueado(v, c.org) then perform interno.erro('nao_encontrado'); end if;
  if c.prazo <= now() then perform interno.erro('consulta_fechada'); end if;
  v_nucleos := case when cardinality(c.nucleos) > 0 then c.nucleos else coalesce((select array_agg(id) from rede_nucleos where org = c.org), '{}') end;
  if not exists (select 1 from interno.rede_nucleo_sem_membros() m where m.usuario = v and m.nucleo = any (v_nucleos)) then perform interno.erro('sem_permissao'); end if;
  perform interno.limite('alumia_org_votar', 30, 60);
  select array_agg(id) into v_opcoes from rede_consulta_opcoes where consulta = c.id;
  if p_ranking is null or cardinality(p_ranking) = 0 or cardinality(p_ranking) > cardinality(v_opcoes)
     or (c.metodo = 'simples' and cardinality(p_ranking) <> 1)
     or exists (select 1 from unnest(p_ranking) x where x is null or not x = any (v_opcoes))
     or (select count(distinct x) from unnest(p_ranking) x) <> cardinality(p_ranking) then
    perform interno.erro('invalido:ranking');
  end if;
  -- Um voto por vez em cada consulta: a urna regrava as cédulas e dois votos ao mesmo tempo se atropelariam.
  perform pg_advisory_xact_lock(hashtextextended('alumia_urna:' || c.id::text, 0));
  insert into rede_consulta_votantes (consulta, usuario) values (c.id, v) on conflict do nothing;
  if not found then perform interno.erro('ja_votou'); end if;
  perform interno.alumia_urna(c.id, p_ranking);
  return jsonb_build_object('votei', true);
end
; end $function$;

CREATE OR REPLACE FUNCTION public.rede_org_consulta_votar_cifrada(p_consulta uuid, p_cedula text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'interno', 'pg_temp'
AS $function$begin perform interno.alumia_porta();
declare v uuid := interno.eu(); c rede_consultas; v_nucleos uuid[];
begin
  perform interno.rede3_perfil_exige_membro(v);
  select * into c from rede_consultas where id = p_consulta;
  if not found or interno.rede_bloqueado(v, c.org) then perform interno.erro('nao_encontrado'); end if;
  if c.prazo <= now() then perform interno.erro('consulta_fechada'); end if;
  v_nucleos := case when cardinality(c.nucleos) > 0 then c.nucleos else coalesce((select array_agg(id) from rede_nucleos where org = c.org), '{}') end;
  if not exists (select 1 from interno.rede_nucleo_sem_membros() m where m.usuario = v and m.nucleo = any (v_nucleos)) then perform interno.erro('sem_permissao'); end if;
  if p_cedula is null or char_length(p_cedula) > 1600 or p_cedula !~ '^c1\.[A-Za-z0-9_-]{87}\.[A-Za-z0-9_-]{16}\.[A-Za-z0-9_-]{22,}$' then perform interno.erro('invalido:cedula'); end if;
  perform interno.limite('alumia_org_votar', 30, 60);
  perform pg_advisory_xact_lock(hashtextextended('alumia_urna:' || c.id::text, 0));
  insert into rede_consulta_votantes (consulta, usuario) values (c.id, v) on conflict do nothing;
  if not found then perform interno.erro('ja_votou'); end if;
  perform interno.alumia_urna_cifrada(c.id, p_cedula);
  return jsonb_build_object('votei', true);
end
; end $function$;

CREATE OR REPLACE FUNCTION public.rede_org_eleicao_candidatar(p_eleicao uuid, p_sim boolean)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'interno', 'pg_temp'
AS $function$begin perform interno.alumia_porta();
declare v uuid := interno.eu(); e rede_org_eleicoes;
begin
  perform interno.rede3_perfil_exige_membro(v);
  select * into e from rede_org_eleicoes where id = p_eleicao;
  if not found or interno.rede_bloqueado(v, e.org) or not exists (select 1 from rede_nucleos n join interno.rede_nucleo_sem_membros() m on m.nucleo = n.id where n.org = e.org and m.usuario = v) then
    perform interno.erro('nao_encontrado');
  end if;
  perform interno.limite('alumia_org_candidatar', 20, 60);
  if e.situacao <> 'inscricoes' or now() >= e.inscricoes_ate then perform interno.erro('inscricoes_fechadas'); end if;
  if coalesce(p_sim, false) then
    if (select count(*) from rede_org_eleicao_candidatos where eleicao = e.id) >= 7 then perform interno.erro('limite'); end if;
    insert into rede_org_eleicao_candidatos (eleicao, pessoa) values (e.id, v) on conflict do nothing;
  else
    delete from rede_org_eleicao_candidatos where eleicao = e.id and pessoa = v;
  end if;
  return interno.alumia_eleicao_json((select x from rede_org_eleicoes x where x.id = e.id), v);
end
; end $function$;

CREATE OR REPLACE FUNCTION public.rede_org_mandato_dar(p_handle text, p jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'interno', 'pg_temp'
AS $function$begin perform interno.alumia_porta();
declare o uuid := interno.alumia_org_gestor(p_handle, 'alumia_org_mandato', 60, 60); f rede_org_funcoes; v_quem uuid; v_fim date;
begin
  begin
    select * into f from rede_org_funcoes where id = (p ->> 'funcao')::uuid and org = o;
  exception when others then perform interno.erro('invalido:funcao');
  end;
  if f.id is null then perform interno.erro('nao_encontrado'); end if;
  begin v_fim := (p ->> 'fim')::date; exception when others then perform interno.erro('invalido:fim'); end;
  if v_fim is null or v_fim <= current_date or v_fim > current_date + 730 then perform interno.erro('invalido:fim'); end if;
  select id into v_quem from perfis where rede_handle = lower(btrim(coalesce(p ->> 'handle', ''), ' @')) and not suspenso;
  if v_quem is null or not interno.rede2_membro(v_quem) or interno.rede_bloqueado(o, v_quem)
     or not exists (select 1 from rede_nucleos n join interno.rede_nucleo_sem_membros() m on m.nucleo = n.id where n.org = o and m.usuario = v_quem) then
    perform interno.erro('nao_encontrado');
  end if;
  if (select count(*) from rede_org_mandatos where funcao = f.id and encerrado_dia is null and fim >= current_date) >= f.vagas then perform interno.erro('sem_vaga'); end if;
  insert into rede_org_mandatos (funcao, pessoa, fim, origem, aceito) values (f.id, v_quem, v_fim, 'nomeacao', false) on conflict do nothing;
  if not found then perform interno.erro('ja_ocupa'); end if;
  perform interno.avisar_em(v_quem, format('Você foi indicada para a função “%s” em “%s”, até %s. Ela só vale, e só aparece para as outras pessoas, se você aceitar pela página da organização.', f.nome, interno.rede_nome(o), to_char(v_fim, 'DD/MM/YYYY')), 'rede');
  return public.rede_org_funcoes(p_handle);
end
; end $function$;

CREATE OR REPLACE FUNCTION public.rede_org_nucleo_chamar(p_nucleo uuid, p_texto text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'interno', 'pg_temp'
AS $function$begin perform interno.alumia_porta();
declare v uuid := interno.eu(); n rede_nucleos; v_texto text; v_post uuid; x rede_posts; v_n integer := 0; r record;
begin
  perform interno.rede3_perfil_exige_membro(v);
  select * into n from rede_nucleos where id = p_nucleo for update;
  if not found or n.org is null or not interno.alumia_o12_chama(v, n.id) or interno.rede_bloqueado(v, n.org)
     or not exists (select 1 from perfis f where f.id = n.org and not f.suspenso) then
    perform interno.erro('sem_permissao');
  end if;
  perform interno.limite('alumia_o12_chamar', 10, 60);
  v_texto := interno.txt(p_texto, 'texto', 1, 500);
  if (interno.alumia_o12_teto(n.id) ->> 'restam')::integer <= 0 then perform interno.erro('teto_do_nucleo'); end if;
  v_post := interno.alumia_o12_postar(n.org, 'post', null, v_texto, null, 'nucleo', n.id);
  insert into rede_org_nucleo_chamadas (nucleo, post) values (n.id, v_post);
  select * into x from rede_posts where id = v_post;
  if not x.oculto and not x.retido then
    for r in select m.usuario from interno.rede_nucleo_sem_membros() m join perfis f on f.id = m.usuario
             where m.nucleo = n.id and m.usuario <> v and not f.suspenso and not interno.rede_bloqueado(m.usuario, n.org) loop
      if not interno.rede_ve(x, r.usuario) then continue; end if;
      perform interno.rede3_aviso_criar(r.usuario, 'nucleo', v_post, null, null, format('“%s” chamou o seu núcleo (%s) na Alumia.', interno.rede_nome(n.org), n.nome));
      v_n := v_n + 1;
    end loop;
  end if;
  return jsonb_build_object('post', v_post, 'retido', x.oculto or x.retido, 'avisadas', interno.alumia_pessoas(v_n)) || interno.alumia_o12_teto(n.id);
end
; end $function$;

CREATE OR REPLACE FUNCTION public.rede_org_nucleo_criar(p_handle text, p jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'interno', 'pg_temp'
AS $function$begin perform interno.alumia_porta();
declare v uuid := auth.uid(); v_org uuid := interno.alumia_org_gestor(p_handle, 'alumia_org_nucleo', 10, 1440); v_id uuid; v_uf text := nullif(upper(btrim(coalesce(p ->> 'uf', ''))), '');
begin
  if (select count(*) from rede_nucleos where org = v_org) >= 50 then perform interno.erro('limite_nucleos'); end if;
  begin
    insert into rede_nucleos (nome, cidade, criado_por, org, org_quando, org_cor, org_pauta, org_tarefa, org_cidade, org_uf, org_no_mapa)
    values (btrim(coalesce(p ->> 'nome', '')), btrim(coalesce(p ->> 'onde', '')), v_org, v_org, btrim(coalesce(p ->> 'quando', '')),
            coalesce(nullif(p ->> 'cor', '')::smallint, 1),
            interno.alumia_sem_dado_pessoal(left(coalesce(p ->> 'pauta', ''), 600), 'pauta'), interno.alumia_sem_dado_pessoal(left(coalesce(p ->> 'tarefa', ''), 200), 'tarefa'),
            btrim(coalesce(p ->> 'cidade', '')), v_uf, coalesce((p ->> 'mapa')::boolean, false))
    returning id into v_id;
  exception when check_violation or invalid_text_representation or numeric_value_out_of_range then perform interno.erro('invalido:nucleo');
  end;
  -- R2: quem cria não entra no núcleo pelo servidor. O aparelho de quem cria faz o grupo (MLS) e publica a caixa de entrada com
  -- public.rede_nucleo_entrada_iniciar; os convites viram pedido de entrada pela caixa do núcleo.
  return jsonb_build_object('id', v_id);
end
; end $function$;

CREATE OR REPLACE FUNCTION public.rede_org_nucleo_mapa(p_nucleo uuid, p_sim boolean)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'interno', 'pg_temp'
AS $function$begin perform interno.alumia_porta();
declare v uuid := interno.eu(); n rede_nucleos;
begin
  perform interno.rede3_perfil_exige_membro(v);
  select * into n from rede_nucleos where id = p_nucleo and org is not null;
  if not found or not (interno.alumia_org_gere(v, n.org) or exists (select 1 from interno.rede_nucleo_sem_membros() m where m.nucleo = n.id and m.usuario = v and m.papel = 'mediacao')) then
    perform interno.erro('sem_permissao');
  end if;
  perform interno.limite('alumia_org_nucleo_mapa', 30, 60);
  update rede_nucleos set org_no_mapa = coalesce(p_sim, false) where id = n.id;
  return jsonb_build_object('mapa', coalesce(p_sim, false), 'chama', interno.alumia_chama(n.id));
end
; end $function$;

CREATE OR REPLACE FUNCTION public.rede_org_perfil(p_handle text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'interno', 'pg_temp'
AS $function$begin perform interno.alumia_porta();
declare v uuid := auth.uid(); v_org uuid; o rede_orgs; f perfis; v_membro boolean; v_dentro boolean; v_gere boolean;
begin
  perform interno.limite('alumia_org_ler', 300, 10);
  v_org := interno.alumia_org_de(p_handle);
  if v_org is null then return null; end if;
  select * into o from rede_orgs where perfil = v_org;
  select * into f from perfis where id = v_org;
  if interno.rede_bloqueado(v, v_org) then return null; end if;
  v_membro := interno.rede2_membro(v);
  if not v_membro and o.verificada_em is null then return null; end if;
  v_dentro := interno.alumia_org_dentro(v, v_org);
  v_gere := interno.alumia_org_gere(v, v_org);
  return jsonb_build_object(
    'handle', f.rede_handle, 'codinome', coalesce(f.rede_codinome, ''), 'tipo', o.tipo, 'bio', coalesce(f.rede_bio, ''),
    'cidade', nullif(o.cidade, ''), 'verificadaEm', o.verificada_em,
    'documento', case when o.verificada_em is not null then nullif(o.documento_tipo, '') end,
    'palavra', o.palavra,
    'sigo', v is not null and exists (select 1 from rede_seguindo s where s.quem = v and s.segue = v_org and not s.pendente),
    'sino', v is not null and exists (select 1 from rede_org_sinos s where s.org = v_org and s.usuario = v),
    'gerencio', v_gere, 'dentro', v_dentro, 'mesa', interno.alumia_org_mesa(v, v_org),
    'nucleos', coalesce((select jsonb_agg(jsonb_build_object('id', n.id, 'nome', n.nome, 'cor', n.org_cor, 'quando', n.org_quando,
                  'onde', nullif(n.cidade, ''), 'chama', interno.alumia_chama(n.id),
                  'mapa', case when v_gere then n.org_no_mapa end,
                  'pauta', case when v_dentro then nullif(n.org_pauta, '') end, 'tarefa', case when v_dentro then nullif(n.org_tarefa, '') end) order by n.nome)
                from rede_nucleos n where n.org = v_org), '[]'::jsonb),
    'votacoes', coalesce((select jsonb_agg(jsonb_build_object('id', x.id, 'data', x.data, 'projeto', x.projeto, 'voto', x.voto, 'porque', x.porque,
                  'resultado', x.resultado, 'fonte', x.fonte) order by x.data desc, x.criado_em desc)
                from (select * from rede_org_votacoes where org = v_org order by data desc, criado_em desc limit 30) x), '[]'::jsonb),
    'consultas', coalesce((select jsonb_agg(interno.alumia_consulta_json(c, v) || jsonb_build_object('eleicao', c.eleicao is not null,
                  'virouFio', exists (select 1 from rede_org_encaminhamentos e where e.origem = 'consulta' and e.origem_id = c.id)) order by c.prazo desc)
                from (select * from rede_consultas where org = v_org and (eleicao is null or v_dentro) order by prazo desc limit 10) c), '[]'::jsonb),
    'plenarias', coalesce((select jsonb_agg(interno.alumia_plenaria_json(p, v, v_membro) order by (p.situacao = 'ao_vivo') desc, p.inicio)
                from (select * from rede_plenarias where org = v_org and situacao <> 'encerrada' order by inicio limit 5) p), '[]'::jsonb));
end
; end $function$;

-- ── 5. A lista de exceções da porta (a das caixas anônimas, 20261124-r2-caixas.sql, + a troca da entrada do núcleo) ──────────
-- A lista final (sem o 'rede_sel_depositar', cuja função a conversa a dois apagou) fica em 20261124-r2-fim.sql.
create or replace function interno.alumia_porta_aberta(p_nome text, p_argumentos text) returns boolean language sql immutable as $$
  select p_nome in ('alumia_entrada_eu', 'alumia_entrada_pedir', 'alumia_triagem_contagem', 'alumia_triagem_fila', 'alumia_triagem_decidir',
                    'rede_situacao', 'rede_aderir', 'rede_codinome_definir', 'rede_confirmar_idade', 'rede_eu', 'rede_alumia_versao',
                    'rede_fed_situacao', 'rede_antigo',
                    -- Chamadas pelo servidor do site sem sessão, com o segredo da federação (Faixa 2): com a porta, o Fediverso para.
                    'rede_fed_servidor', 'rede_fed_midia_servidor', 'rede_fed_mudanca_servidor',
                    -- Quem teve a conta suspensa ou retida pede revisão (20261114-alumia-o8-lei.sql).
                    'alumia_lei_minha_conta', 'alumia_lei_recorrer_conta',
                    -- A marca "veio por convite" na triagem, que tem a regra dela (20261114-alumia-o8-porta.sql).
                    'alumia_triagem_convites',
                    -- O relatório de transparência, público como a página (20261115-alumia-o9-transparencia.sql).
                    'alumia_transparencia',
                    -- Faixa 2: o envelope selado é anônimo por desenho (quem deposita não se identifica), e o registro público das
                    -- chaves é conferido por qualquer pessoa. As outras rede_olm_*, rede_mls_*
                    -- e rede_sel_* ficam com a porta.
                    'rede_sel_depositar', 'rede_kt_ponta', 'rede_kt_trecho',
                    -- R2, caixas anônimas: sem sessão de conta por desenho; só o servidor do site chama (execute só para service_role).
                    'rede_caixa_lote', 'rede_caixa_buscar', 'rede_caixa_confirmar', 'rede_caixa_trocar', 'rede_caixa_apagar',
                    'rede_passe_gastar', 'rede_diretorio_ler', 'rede_diretorio_reivindicar', 'rede_passes_chave_registrar',
                    'rede_franquia_denunciar',
                    -- R2 (membros escondidos): a mediação troca a entrada do núcleo com o passe de gestão, sem sessão de conta (só o
                    -- servidor do site chama; execute só para service_role).
                    'rede_nucleo_entrada_trocar')
      or (p_nome in ('rede_linha', 'rede_novos') and coalesce(p_argumentos, '') like 'p_aba text%')
      -- O diretório das organizações com selo e o mapa dele (20261113-alumia-o7-entrada.sql, decisão de 12/11).
      or (p_nome = 'rede_org_diretorio' and coalesce(p_argumentos, '') = 'p jsonb')
      or (p_nome = 'rede_org_mapa' and coalesce(p_argumentos, '') = '')
$$;
revoke all on function interno.alumia_porta_aberta(text, text) from public, anon, authenticated;

-- ── 6. O que sai ───────────────────────────────────────────────────────────────────────────────────────────────────────────

-- Posts de núcleo (autor + núcleo = quem é de qual núcleo) e convites de núcleo (quem criou = mediação de qual núcleo).
delete from interno.rede_posts where nucleo is not null;
delete from interno.rede_convites where nucleo is not null;
-- As saídas guardadas para a contagem de pessoas por núcleo (não há mais contagem de núcleo no servidor).
delete from interno.rede_contagem_saidas s where exists (select 1 from interno.rede_nucleos n where n.id = s.alvo);

-- A Escola (cadastro da coordenação) deixa de guardar o núcleo de cada militante e o da banca, e quem criou um encontro ou um
-- recado de núcleo (a mediação de antes). Dali em diante, a regra do banco não deixa gravar de novo.
update interno.escola_militancia set nucleo = null where nucleo is not null;
update interno.escola_bancas set nucleo = null where nucleo is not null;
update interno.escola_encontros set criado_por = null where criado_por is not null;
update interno.escola_recados set por = null where nucleo is not null and por is not null;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'rede_posts_sem_nucleo') then
    alter table interno.rede_posts add constraint rede_posts_sem_nucleo check (nucleo is null);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'escola_militancia_sem_nucleo') then
    alter table interno.escola_militancia add constraint escola_militancia_sem_nucleo check (nucleo is null);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'escola_bancas_sem_nucleo') then
    alter table interno.escola_bancas add constraint escola_bancas_sem_nucleo check (nucleo is null);
  end if;
end $$;

drop function if exists public.rede_com_nucleo_sair(uuid);
drop function if exists public.rede_org_nucleo_entrar(uuid);
drop function if exists public.rede_org_nucleo_pedidos(text);
drop function if exists public.rede_org_nucleo_decidir(uuid, text, boolean);
drop function if exists public.rede_mls_commit(text, integer, text, text, jsonb);
drop function if exists public.rede_mls_estado(text, integer);
drop function if exists public.rede_mls_meus_pacotes();
drop function if exists public.rede_mls_pacotes_pegar(text, uuid[]);
drop function if exists public.rede_mls_pacotes_publicar(text[]);

drop table if exists interno.rede_nucleo_membros;
drop function if exists interno.alumia_nucleo_saiu();
drop table if exists interno.rede_org_nucleo_pedidos;
drop table if exists interno.rede_mls_boasvindas;
drop table if exists interno.rede_mls_commits;
drop table if exists interno.rede_mls_info;
drop table if exists interno.rede_mls_pacotes;

-- ── 7. O chamado da organização ao núcleo (junção da R2) ──────────────────────────────────────────────────────────────────────
-- O chamado virava um post do núcleo (que o banco agora recusa: rede_posts_sem_nucleo) e um aviso a quem é do núcleo (que o banco
-- não sabe mais). Sem isto, quem tem cargo via o erro cru da restrição. Agora: as mesmas conferências de antes e, no fim, a recusa
-- clara 'nucleo_no_grupo' (o chamado ao núcleo vai como mensagem do grupo, nos aparelhos).
create or replace function public.rede_org_nucleo_chamar(p_nucleo uuid, p_texto text) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); n rede_nucleos;
begin
  perform interno.rede3_perfil_exige_membro(v);
  select * into n from rede_nucleos where id = p_nucleo;
  if not found or n.org is null or not interno.alumia_o12_chama(v, n.id) or interno.rede_bloqueado(v, n.org)
     or not exists (select 1 from perfis f where f.id = n.org and not f.suspenso) then
    perform interno.erro('sem_permissao');
  end if;
  perform interno.erro('nucleo_no_grupo');
  return null;
end $$;

select interno.alumia_trancar();
