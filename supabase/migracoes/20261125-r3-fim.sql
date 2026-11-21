-- Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
-- Alumia · Reforço 3 · fim: marca no banco que o SQL da onda R3 foi instalado (as migrações de 25/11, na ordem do fim do install.sql:
-- 20261125-r3-resto-r2.sql, 20261125-r3-sem-internet-formal.sql, 20261125-r3-servidor-chat.sql e 20261125-r3-publico-ferramentas.sql),
-- põe no catálogo o recurso novo, liga a emissão do passe da urna à marca "já pegou a cédula", escreve a lista final de exceções da
-- porta e passa a porta em toda função nova. Pode rodar mais de uma vez. Roda por último, depois de todas elas.
-- Serve para conferir de fora, sem entrar no painel, se o SQL da R3 já está em produção:
--   POST /rest/v1/rpc/rede_alumia_versao  →  16
--
-- O que a montagem do install.sql conferiu (no banco montado): nenhuma migração da R3 redefine interno.alumia_porta_aberta (a
-- definição final é a daqui, a da R2 com as três funções novas só do servidor do site); public.rede_passes_contexto_marcar vem da do
-- servidor do chat e é redefinida aqui, completa, com a chamada a interno.voto_cedula_tomada da do resto da R2 (as duas migrações
-- entraram em frentes separadas e só a junção pode ligar uma à outra); interno.votacao_json vem da 20261124-r2-voto.sql e é
-- redefinida aqui, completa, contando as cédulas emitidas pela urna anônima. Nenhuma função recebe linha de tabela com valor padrão.
-- Endereço de rede: nada daqui lê ou guarda.
-- Lei: LGPD art. 46 (segurança: a porta passa em toda função nova; "abertas" tem de vir vazia) e art. 6º, III (necessidade: a
-- cédula da urna não se liga a quem votou).

-- ── 1. A versão ───────────────────────────────────────────────────────────────────────────────────────────────────────────
create or replace function public.rede_alumia_versao() returns integer language sql immutable set search_path = interno, pg_temp as $$
  select 16
$$;
revoke all on function public.rede_alumia_versao() from public;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    grant execute on function public.rede_alumia_versao() to anon, authenticated, service_role;
  end if;
end $$;

-- ── 2. O recurso novo no catálogo (lib/recursos.ts): só pelo nome, desligado ───────────────────────────────────────────────
-- "alumia-chat-so-app": ligado, o site deixa de carregar o código de chave do chat e as páginas do chat mandam para os apps
-- (/alumia/app, baixar e conferir). Desligado no beta (o chat do site continua). A mesma linha está no primeiro insert do catálogo
-- (2026-11-backend-1.sql e install.sql).
do $$
begin
  if to_regclass('interno.recursos_catalogo') is not null then
    insert into interno.recursos_catalogo (nome, so_pelo_nome) values ('alumia-chat-so-app', true)
      on conflict (nome) do update set so_pelo_nome = true;
  end if;
end $$;

-- ── 3. O passe da urna marca quem pegou a cédula ──────────────────────────────────────────────────────────────────────────

/**
 * A marca "esta conta já pegou o passe deste contexto" (20261125-r3-servidor-chat.sql), agora também "já pegou a cédula" da urna
 * anônima (20261125-r3-resto-r2.sql, interno.voto_cedula_tomada), na mesma transação: quem pega o passe da urna não pega outro e
 * conta como quem votou; a cédula vai depois, sem sessão, pela rota da urna. Definição completa (a última).
 */
create or replace function public.rede_passes_contexto_marcar(p_tipo text, p_alvo uuid, p_marca bytea) returns boolean language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.diretorio_eu(); n integer;
begin
  if octet_length(p_marca) is distinct from 32 or p_alvo is null then perform interno.erro('invalido:marca'); end if;
  if not interno.passes_contexto_permitido(p_tipo, p_alvo, v) then perform interno.erro('sem_permissao'); end if;
  insert into passes_emitidos_contexto (marca, dia) values (p_marca, interno.caixa_hoje()) on conflict (marca) do nothing;
  get diagnostics n = row_count;
  -- A urna anônima (20261125-r3-resto-r2.sql): quem pega o passe da urna fica como "já pegou a cédula", nesta mesma transação.
  if n = 1 then perform interno.voto_cedula_tomada(p_tipo, p_alvo, v); end if;
  return n = 1;
end $$;
revoke all on function public.rede_passes_contexto_marcar(text, uuid, bytea) from public;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on function public.rede_passes_contexto_marcar(text, uuid, bytea) from anon;
    grant execute on function public.rede_passes_contexto_marcar(text, uuid, bytea) to authenticated;
  end if;
end $$;

-- ── 3b. A votação da equipe conta quem pegou a cédula da urna anônima ──────────────────────────────────────────────────────
-- Com a urna anônima (20261125-r3-resto-r2.sql), a cédula da votação secreta da equipe não passa mais pela marca de "já votou"
-- (votacao_marcas): quem pegou a cédula só entra no contador interno.votacao_cedulas_emitidas (sem ninguém). A votação na tela
-- (interno.votacao_json, da 20261124-r2-voto.sql) contava só as marcas e mostrava 0. Definição completa (a última), tirada do banco
-- montado, com o contador somado.
CREATE OR REPLACE FUNCTION interno.votacao_json(v interno.votacoes)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'interno', 'pg_temp'
AS $function$
  select jsonb_build_object('id', v.id, 'titulo', v.titulo, 'descricao', v.descricao, 'opcoes', to_jsonb(v.opcoes), 'departamento', v.departamento, 'secreta', v.secreta,
    'encerra_em', v.encerra_em, 'terminou_em', least(coalesce(v.encerrada_em, v.encerra_em), v.encerra_em), 'encerrada', v.encerrada_em is not null or v.encerra_em <= now(), 'criado_em', v.criado_em,
    'criada_por', coalesce((select interno.nome_visto(nome) from perfis where id = v.criada_por), ''),
    'minha', v.criada_por = auth.uid(),
    'posso_votar', interno.vota_em(v, auth.uid()),
    'votei', auth.uid() is not null and exists (select 1 from votacao_votantes p where p.votacao = v.id and p.usuario = auth.uid()),
    'votantes', (select count(*) from votacao_votantes p where p.votacao = v.id) + (select count(*) from votacao_marcas m where m.votacao = v.id)
                + coalesce((select e.n from votacao_cedulas_emitidas e where e.votacao = v.id), 0),
    'aptos', (select count(*) from perfis f where interno.vota_em(v, f.id)),
    'chave', v.secreta and exists (select 1 from rede_consulta_chaves k where k.consulta = v.id and k.tipo = 'equipe'),
    'apurar', v.secreta and (v.encerrada_em is not null or v.encerra_em <= now()) and exists (select 1 from votacao_cifradas c where c.votacao = v.id),
    'resultado', case when (v.encerrada_em is not null or v.encerra_em <= now())
                        and not exists (select 1 from votacao_cifradas c where c.votacao = v.id)
                        and (not v.secreta or (select count(*) from votacao_votos w where w.votacao = v.id) >= 3) then
      (select jsonb_agg(jsonb_build_object('opcao', o.i - 1, 'texto', o.t, 'votos', (select count(*) from votacao_votos w where w.votacao = v.id and w.opcao = o.i - 1),
         'quem', case when not v.secreta then (select coalesce(jsonb_agg(interno.nome_visto(f.nome) order by f.nome), '[]'::jsonb) from votacao_votos w join perfis f on f.id = w.usuario where w.votacao = v.id and w.opcao = o.i - 1) end)
         order by o.i)
       from unnest(v.opcoes) with ordinality as o(t, i)) end)
$function$;

-- ── 4. A lista final de exceções da porta ─────────────────────────────────────────────────────────────────────────────────

/**
 * As funções que ficam SEM a porta, de propósito: a lista da versão 15, mais a urna anônima e a chave dos passes da R3, que por
 * desenho não usam a sessão de conta e só o servidor do site chama (execute só para service_role). O teste da entrada
 * (scripts/testar-alumia-entrada.mjs) confere esta lista.
 */
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
                    -- O registro público das chaves é conferido por qualquer pessoa. (O envelope selado do chat do beta,
                    -- rede_sel_depositar, saiu com a conversa a dois da R2: 20261124-r2-dupla.sql.)
                    'rede_kt_ponta', 'rede_kt_trecho',
                    -- R2, caixas anônimas: sem sessão de conta por desenho; só o servidor do site chama (execute só para service_role).
                    'rede_caixa_lote', 'rede_caixa_buscar', 'rede_caixa_confirmar', 'rede_caixa_trocar', 'rede_caixa_apagar',
                    'rede_passe_gastar', 'rede_diretorio_ler', 'rede_diretorio_reivindicar', 'rede_passes_chave_registrar',
                    'rede_franquia_denunciar', 'rede_franquia_autoria',
                    -- R2 (membros escondidos): a mediação troca a entrada do núcleo com o passe de gestão, sem sessão de conta (só o
                    -- servidor do site chama; execute só para service_role).
                    'rede_nucleo_entrada_trocar',
                    -- R3 (20261125-r3-resto-r2.sql): a urna anônima recebe a cédula SEM sessão de conta, com o passe da urna (só o servidor
                    -- do site chama; execute só para service_role).
                    'rede_urna_depositar_anonimo',
                    -- R3 (20261125-r3-servidor-chat.sql): a chave RSA da semana dos passes, lida e guardada pelo servidor do site sem
                    -- sessão de conta (execute só para service_role).
                    'rede_passes_chave_ler', 'rede_passes_chave_guardar')
      or (p_nome in ('rede_linha', 'rede_novos') and coalesce(p_argumentos, '') like 'p_aba text%')
      -- O diretório das organizações com selo e o mapa dele (20261113-alumia-o7-entrada.sql, decisão de 12/11).
      or (p_nome = 'rede_org_diretorio' and coalesce(p_argumentos, '') = 'p jsonb')
      or (p_nome = 'rede_org_mapa' and coalesce(p_argumentos, '') = '')
$$;
revoke all on function interno.alumia_porta_aberta(text, text) from public;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on function interno.alumia_porta_aberta(text, text) from anon, authenticated;
  end if;
end $$;

-- ── 4b. Consertos da auditoria interna da R3 (redefinições completas, as últimas) ─────────────────────────────────────────

/**
 * O teto de depósitos por caixa. Na caixa de PEDIDOS de conversa (a única ligada a uma conta, pelo diretório), o teto não é mais uma
 * contagem por dia em caixa_contagem: quem tinha o banco ligava a caixa de pedidos à conta e sabia QUANTOS pedidos de conversa cada
 * conta recebeu em cada dia (quantas pessoas procuram fulana: um perfil de comportamento). Agora o teto da caixa de pedidos é o que
 * está NELA esperando leitura (300 pacotes), sem nada gravado além do próprio pacote, que sai quando a dona lê. Nas outras caixas
 * (sem dono no banco) a contagem por dia continua. Definição completa (a última; a de antes é a de 20261124-r2-caixas.sql).
 */
create or replace function interno.caixa_contar(p_caixa_h bytea, p_multi boolean, p_pedidos boolean) returns boolean language plpgsql security definer set search_path = interno, pg_temp as $$
declare v_n integer;
begin
  if p_pedidos then
    return (select count(*) from pacotes where caixa_h = p_caixa_h) < 300;
  end if;
  insert into caixa_contagem (caixa_h, dia, n) values (p_caixa_h, interno.caixa_hoje(), 1)
  on conflict (caixa_h, dia) do update set n = caixa_contagem.n + 1 returning n into v_n;
  return v_n <= case when p_multi then 5000 else 1000 end;
end $$;
revoke all on function interno.caixa_contar(bytea, boolean, boolean) from public;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on function interno.caixa_contar(bytea, boolean, boolean) from anon, authenticated;
  end if;
end $$;
-- A contagem por dia que já estava gravada para as caixas de pedidos sai (uma vez; rodar de novo não acha nada).
delete from interno.caixa_contagem c using interno.diretorio_contas d where c.caixa_h = interno.caixa_resumo('alumia/r2/caixa', d.pedidos_caixa);

/**
 * Publica (ou atualiza) um aparelho da conta: o certificado assinado pela identidade, a impressão Proteus e a chave X-Wing da semana.
 * O dia em que o aparelho entrou fica só como a SEGUNDA-FEIRA da semana (UTC): o diretório é lido sem sessão, só pelo codinome, e o
 * dia exato deixava quem está de fora acompanhar quando a pessoa troca ou acrescenta aparelho. O aparelho assina o certificado com
 * o mesmo dia (lib/rede/chat/r2/servico.ts, semanaDoCertificado). Definição completa (a última; a de antes é a de
 * 20261124-r2-caixas.sql).
 */
create or replace function public.rede_diretorio_publicar(p_aparelho jsonb) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare
  v uuid := interno.diretorio_eu(); o uuid;
  v_ap bytea := interno.caixa_bytes(p_aparelho ->> 'aparelho'); v_cert bytea := interno.caixa_bytes(p_aparelho ->> 'certificado');
  v_imp bytea := interno.caixa_bytes(p_aparelho ->> 'proteus_impressao'); v_xw bytea := interno.caixa_bytes(p_aparelho ->> 'xwing_semana');
  v_xa bytea := interno.caixa_bytes(p_aparelho ->> 'xwing_assinatura'); v_sem integer;
begin
  perform interno.limite('rede_diretorio_publicar', 60, 60);
  begin v_sem := (p_aparelho ->> 'semana')::integer; exception when others then v_sem := null; end;
  if octet_length(v_ap) is distinct from 32 or octet_length(v_cert) is distinct from 64 or coalesce(octet_length(v_imp), 0) not between 16 and 64
     or octet_length(v_xw) is distinct from 1216 or octet_length(v_xa) is distinct from 64 or coalesce(v_sem, 0) <= 0 then
    perform interno.erro('invalido:aparelho');
  end if;
  select usuario into o from diretorio_aparelhos where aparelho = v_ap;
  if found and o <> v then perform interno.erro('aparelho_de_outra_conta'); end if;
  if not found and (select count(*) from diretorio_aparelhos where usuario = v) >= 8 then perform interno.erro('aparelhos_demais'); end if;
  insert into diretorio_aparelhos (aparelho, usuario, certificado, proteus_impressao, xwing_semana, xwing_assinatura, semana, criado_dia)
  values (v_ap, v, v_cert, v_imp, v_xw, v_xa, v_sem, date_trunc('week', interno.caixa_hoje()::timestamp)::date)
  on conflict (aparelho) do update set certificado = excluded.certificado, proteus_impressao = excluded.proteus_impressao,
    xwing_semana = excluded.xwing_semana, xwing_assinatura = excluded.xwing_assinatura, semana = excluded.semana;
  return jsonb_build_object('ok', true);
end $$;
revoke all on function public.rede_diretorio_publicar(jsonb) from public;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on function public.rede_diretorio_publicar(jsonb) from anon;
    grant execute on function public.rede_diretorio_publicar(jsonb) to authenticated;
  end if;
end $$;

-- ── 5. A porta ────────────────────────────────────────────────────────────────────────────────────────────────────────────
-- Toda função public.rede_* e public.alumia_* que anon ou authenticated chamam passa pela porta da entrada (as redefinidas pela
-- R3 também: create or replace tira a porta, e esta linha a devolve). "abertas" tem de vir vazia.
do $$
declare v jsonb := interno.alumia_trancar();
begin
  if jsonb_array_length(coalesce(v -> 'abertas', '[]'::jsonb)) > 0 then
    raise warning 'alumia_trancar: função sem porta: %', v -> 'abertas';
  end if;
end $$;
select interno.alumia_trancar();
