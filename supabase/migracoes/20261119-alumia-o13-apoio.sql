-- ───────────────────────────── Alumia, onda 13: apoio (vaquinha e petição) ─────────────────────────────
-- Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
--
-- Frente 13A. Dinheiro e petição, sem nenhum pagamento dentro da Alumia e sem lista de ninguém.
--
--   1. VAQUINHA COM TRANSPARÊNCIA (L1-18, troca por princípio): o caixa transparente do B1 ganha a meta, o valor arrecadado e a
--      prestação de contas, todos INFORMADOS pela organização e com data. O "como apoiar" (a chave Pix como texto e/ou um link
--      https de fora) só existe para ORGANIZAÇÃO COM SELO: sem selo o banco recusa pôr, e o que já estava some da resposta enquanto
--      não houver selo. Nenhum pagamento passa pela Alumia; quem doa nunca aparece (nem nome, nem número de doadores: o banco nem
--      sabe quem doou). Quem desconfia de uma vaquinha falsa denuncia, e a denúncia cai na fila da mediação (alvo "org", categoria
--      "golpe"), sem que a organização saiba quem denunciou.
--   2. PETIÇÃO COM META (L1-20): a petição do ato ganha uma meta (opcional). A assinatura é com a conta; o total só aparece a
--      partir de 3 (o mesmo marco de 15 minutos de antes) e NINGUÉM vê quem assinou, nem quem organiza. Para entregar a petição,
--      quem organiza recebe um documento com o texto, para quem é, o número de assinaturas e as datas. Só o número: nenhum nome.
--
-- Nenhum endereço de rede é guardado. Nenhuma função devolve lista de pessoas; números só a partir de 3. Tudo em interno, com RLS e
-- sem política; o acesso é só por funções security definer com search_path fixo. As de membro passam pela porta da entrada
-- (interno.alumia_trancar, no fim). Nenhuma função NOVA recebe parâmetro do tipo linha de tabela (as antigas que recebiam ficam
-- como estavam, sem valor padrão, e deixam de ser usadas aqui).
--
-- Leis: LGPD (Lei 13.709/2018) art. 5º, II e art. 11 (apoiar uma causa e assinar uma petição revelam opinião política: nenhuma
-- lista), art. 6º, III (necessidade: o banco não guarda quem doou; a prestação de contas recusa CPF, telefone, e-mail e endereço).
-- ECA Digital (Lei 15.211/2025): toda ação exige ser membro da Alumia (18+ com consentimento).
--
-- Pode rodar mais de uma vez, sem apagar dado nenhum. Roda DEPOIS de 20261118-alumia-onda12-fim.sql.
-- Teste: scripts/testar-alumia-o13-apoio.mjs.

-- ── 1. Tabelas ────────────────────────────────────────────────────────────────────────────────────────────────────────────

-- A vaquinha: meta e arrecadado em centavos, informados pela organização; o dia em que o arrecadado foi informado.
alter table interno.rede_org_caixas add column if not exists meta bigint;
alter table interno.rede_org_caixas add column if not exists arrecadado bigint;
alter table interno.rede_org_caixas add column if not exists arrecadado_dia date;
do $$
begin
  if not exists (select 1 from pg_constraint where conrelid = 'interno.rede_org_caixas'::regclass and conname = 'rede_org_caixas_meta') then
    alter table interno.rede_org_caixas add constraint rede_org_caixas_meta check (meta is null or meta between 100 and 100000000000);
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'interno.rede_org_caixas'::regclass and conname = 'rede_org_caixas_arrecadado') then
    alter table interno.rede_org_caixas add constraint rede_org_caixas_arrecadado
      check ((arrecadado is null and arrecadado_dia is null) or (arrecadado between 0 and 100000000000 and arrecadado_dia is not null));
  end if;
end $$;

-- A prestação de contas: o que a organização fez com o dinheiro, com o dia. Sem quem escreveu (não precisa: quem pode escrever é
-- a tesouraria ou quem gerencia, e a prestação fala pela organização).
create table if not exists interno.rede_org_caixa_contas (
  id uuid primary key default gen_random_uuid(),
  caixa uuid not null references interno.rede_org_caixas (id) on delete cascade,
  dia date not null,
  texto text not null check (char_length(btrim(texto)) between 10 and 1000),
  link text check (link is null or (link ~ '^https://[^\s]{3,}$' and char_length(link) <= 300)),
  criado_em timestamptz not null default now()
);
create index if not exists rede_org_caixa_contas_caixa on interno.rede_org_caixa_contas (caixa, dia desc);
alter table interno.rede_org_caixa_contas enable row level security;
revoke all on table interno.rede_org_caixa_contas from public;

-- A meta da petição (assinaturas). Opcional.
alter table interno.rede_peticoes add column if not exists meta integer;
do $$
begin
  if not exists (select 1 from pg_constraint where conrelid = 'interno.rede_peticoes'::regclass and conname = 'rede_peticoes_meta') then
    alter table interno.rede_peticoes add constraint rede_peticoes_meta check (meta is null or meta between 10 and 10000000);
  end if;
end $$;

-- ── 2. Vaquinha ───────────────────────────────────────────────────────────────────────────────────────────────────────────

/** A organização tem selo (verificada pela coordenação)? Só com selo há "como apoiar". */
create or replace function interno.alumia_o13_selo(p_org uuid) returns boolean language sql stable security definer set search_path = interno, pg_temp as $$
  select exists (select 1 from rede_orgs where perfil = p_org and verificada_em is not null)
$$;

/**
 * A chave Pix como texto da ORGANIZAÇÃO: CPF de pessoa, telefone e e-mail são recusados (a mesma regra do B1). CNPJ e chave
 * aleatória passam.
 */
create or replace function interno.alumia_o13_pix(p_pix text) returns text language plpgsql immutable set search_path = interno, pg_temp as $$
declare v text := btrim(coalesce(p_pix, ''));
begin
  if char_length(v) > 140 then perform interno.erro('invalido:pix'); end if;
  if v ~ '(^|[^0-9])\d{3}\.?\d{3}\.?\d{3}-?\d{2}([^0-9]|$)' or v ~ '\(?\d{2}\)?\s?9\d{4}[-\s]?\d{4}' or v ~* '@' then perform interno.erro('dado_pessoal'); end if;
  return v;
end $$;

/** Um link de fora: https, sem espaço, até 300. Vazio vira nulo. */
create or replace function interno.alumia_o13_link(p_link text) returns text language plpgsql immutable set search_path = interno, pg_temp as $$
declare v text := nullif(btrim(coalesce(p_link, '')), '');
begin
  if v is not null and (v !~ '^https://[^\s]{3,}$' or char_length(v) > 300) then perform interno.erro('invalido:link'); end if;
  return v;
end $$;

/** Centavos escritos como texto ou número; nulo/vazio = nulo. Fora de 0..1e11 é recusado. */
create or replace function interno.alumia_o13_centavos(p_valor jsonb, p_campo text) returns bigint language plpgsql immutable set search_path = interno, pg_temp as $$
declare v text;
begin
  if p_valor is null or jsonb_typeof(p_valor) = 'null' then return null; end if;
  v := btrim(p_valor #>> '{}');
  if v = '' then return null; end if;
  if v !~ '^[0-9]{1,12}$' or v::bigint > 100000000000 then perform interno.erro('invalido:' || p_campo); end if;
  return v::bigint;
end $$;

/**
 * Um caixa como a tela mostra (troca a do B1, que recebia a linha da tabela). De fora: só o saldo e os lançamentos com os DOIS
 * carimbos. De dentro: tudo, sem quem lançou. Pix e link só enquanto a organização tem selo. Meta, arrecadado e prestação de
 * contas: o que a organização informou, com o dia. Nunca quem doou, nem quantas pessoas doaram.
 */
create or replace function interno.alumia_o13_caixa_json(p_caixa uuid, p_quem uuid, p_dentro boolean, p_tesouraria boolean, p_cuida boolean, p_selo boolean) returns jsonb
language plpgsql stable security definer set search_path = interno, pg_temp as $$
declare c rede_org_caixas;
begin
  select * into c from rede_org_caixas where id = p_caixa;
  if not found then return null; end if;
  return jsonb_build_object('id', c.id, 'nome', c.nome, 'tipo', c.tipo,
    'pix', case when p_selo then nullif(c.pix, '') end, 'link', case when p_selo then c.link end,
    'nucleo', (select n.nome from rede_nucleos n where n.id = c.nucleo),
    'saldo', coalesce((select sum(case when l.tipo = 'entrada' then l.centavos else -l.centavos end) from rede_org_caixa_lancamentos l where l.caixa = c.id and l.conferiu2 is not null), 0),
    'entradas', coalesce((select sum(l.centavos) from rede_org_caixa_lancamentos l where l.caixa = c.id and l.conferiu2 is not null and l.tipo = 'entrada'), 0),
    'saidas', coalesce((select sum(l.centavos) from rede_org_caixa_lancamentos l where l.caixa = c.id and l.conferiu2 is not null and l.tipo = 'saida'), 0),
    'esperando', case when p_dentro then (select count(*) from rede_org_caixa_lancamentos l where l.caixa = c.id and l.conferiu2 is null) end,
    'lancamentos', coalesce((select jsonb_agg(jsonb_build_object('id', l.id, 'tipo', l.tipo, 'centavos', l.centavos, 'descricao', l.descricao, 'dia', l.dia,
        'carimbos', (l.conferiu1 is not null)::int + (l.conferiu2 is not null)::int, 'conferidoEm', l.conferiu2_dia,
        'nota', p_dentro and exists (select 1 from rede_org_caixa_notas n where n.lancamento = l.id),
        'meu', p_quem is not null and l.lancou = p_quem,
        'possoConferir', p_tesouraria and l.conferiu2 is null and p_quem is distinct from l.conferiu1)
        order by l.dia desc, l.criado_em desc)
      from (select * from rede_org_caixa_lancamentos l where l.caixa = c.id and (p_dentro or l.conferiu2 is not null) order by l.dia desc, l.criado_em desc limit 100) l), '[]'::jsonb),
    'meta', c.meta, 'arrecadado', c.arrecadado, 'arrecadadoDia', c.arrecadado_dia,
    'contas', coalesce((select jsonb_agg(jsonb_build_object('id', k.id, 'dia', k.dia, 'texto', k.texto, 'link', k.link,
        'possoRetirar', p_cuida and k.criado_em > now() - interval '24 hours') order by k.dia desc, k.criado_em desc)
      from (select * from rede_org_caixa_contas k where k.caixa = c.id order by k.dia desc, k.criado_em desc limit 50) k), '[]'::jsonb));
end $$;

/** Os caixas da organização (troca a do B1: o mesmo, mais o selo e a vaquinha). Doador nunca aparece; quem lançou e quem conferiu, nunca. */
create or replace function public.rede_org_caixa(p_handle text) returns jsonb language plpgsql stable security definer set search_path = interno, pg_temp as $$
declare v uuid := auth.uid(); o uuid := interno.alumia_org_de(p_handle); v_dentro boolean; v_tes boolean; v_gere boolean; v_selo boolean;
begin
  perform interno.limite('alumia_org_ler', 300, 10);
  if o is null or interno.rede_bloqueado(v, o) then return null; end if;
  v_selo := interno.alumia_o13_selo(o);
  if not interno.rede2_membro(v) and not v_selo then return null; end if;
  v_dentro := interno.alumia_org_dentro(v, o);
  v_tes := interno.alumia_org_funcao_tem(v, o, 'caixa');
  v_gere := interno.alumia_org_gere(v, o);
  return jsonb_build_object('dentro', v_dentro, 'tesouraria', v_tes, 'gerencio', v_gere, 'selo', v_selo,
    'caixas', coalesce((select jsonb_agg(interno.alumia_o13_caixa_json(c.id, v, v_dentro, v_tes, v_tes or v_gere, v_selo) order by c.criado_dia, c.nome)
                        from rede_org_caixas c where c.org = o), '[]'::jsonb));
end $$;

/**
 * Abrir um caixa (quem gerencia ou tesouraria; troca a do B1). Pix e link só para organização com selo; Pix só como texto da
 * ORGANIZAÇÃO (CPF de pessoa, telefone e e-mail recusados). A meta (centavos) é opcional.
 */
create or replace function public.rede_org_caixa_criar(p_handle text, p jsonb) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); o uuid := interno.alumia_org_de(p_handle); v_pix text; v_link text; v_nucleo uuid; v_meta bigint;
begin
  perform interno.rede3_perfil_exige_membro(v);
  if o is null or not (interno.alumia_org_gere(v, o) or interno.alumia_org_funcao_tem(v, o, 'caixa')) then perform interno.erro('sem_permissao'); end if;
  if p is null or jsonb_typeof(p) is distinct from 'object' then perform interno.erro('invalido:caixa'); end if;
  perform interno.limite('alumia_org_caixa', 30, 1440);
  if (select count(*) from rede_org_caixas where org = o) >= 20 then perform interno.erro('limite'); end if;
  v_pix := interno.alumia_o13_pix(p ->> 'pix');
  v_link := interno.alumia_o13_link(p ->> 'link');
  if (v_pix <> '' or v_link is not null) and not interno.alumia_o13_selo(o) then perform interno.erro('so_com_selo'); end if;
  v_meta := interno.alumia_o13_centavos(p -> 'meta', 'meta');
  if nullif(p ->> 'nucleo', '') is not null then
    begin v_nucleo := (p ->> 'nucleo')::uuid; exception when others then perform interno.erro('invalido:nucleo'); end;
    if not exists (select 1 from rede_nucleos where id = v_nucleo and org = o) then perform interno.erro('invalido:nucleo'); end if;
  end if;
  begin
    insert into rede_org_caixas (org, nome, tipo, nucleo, pix, link, meta) values (o, btrim(coalesce(p ->> 'nome', '')), p ->> 'tipo', v_nucleo, v_pix, v_link, v_meta);
  exception
    when unique_violation then perform interno.erro('caixa_existe');
    when check_violation or not_null_violation then perform interno.erro('invalido:caixa');
  end;
  return public.rede_org_caixa(p_handle);
end $$;

/** O caixa e a organização dele, com quem chama conferido: tesouraria ou quem gerencia. */
create or replace function interno.alumia_o13_caixa_cuida(p_caixa uuid, p_quem uuid) returns uuid language plpgsql stable security definer set search_path = interno, pg_temp as $$
declare o uuid;
begin
  select c.org into o from rede_org_caixas c where c.id = p_caixa;
  if o is null or not (interno.alumia_org_funcao_tem(p_quem, o, 'caixa') or interno.alumia_org_gere(p_quem, o)) then perform interno.erro('sem_permissao'); end if;
  return o;
end $$;

/**
 * Ajustar a vaquinha (tesouraria ou quem gerencia). Só as chaves que vierem mudam: `pix`, `link` (só com selo; vazio tira),
 * `meta` (centavos, nulo tira) e `arrecadado` (centavos, o que a organização informa ter arrecadado FORA da Alumia, com o dia de
 * hoje; nulo tira). Registrado na auditoria sem quem (a organização responde pelo que informa).
 */
create or replace function public.rede_org_vaquinha_ajustar(p_caixa uuid, p jsonb) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); o uuid; c rede_org_caixas; v_pix text; v_link text; v_arr bigint;
begin
  perform interno.rede3_perfil_exige_membro(v);
  o := interno.alumia_o13_caixa_cuida(p_caixa, v);
  if p is null or jsonb_typeof(p) is distinct from 'object' then perform interno.erro('invalido:vaquinha'); end if;
  perform interno.limite('alumia_org_vaquinha', 60, 1440);
  select * into c from rede_org_caixas where id = p_caixa for update;
  if p ? 'pix' or p ? 'link' then
    v_pix := case when p ? 'pix' then interno.alumia_o13_pix(p ->> 'pix') else c.pix end;
    v_link := case when p ? 'link' then interno.alumia_o13_link(p ->> 'link') else c.link end;
    if (v_pix <> '' or v_link is not null) and not interno.alumia_o13_selo(o) then perform interno.erro('so_com_selo'); end if;
    update rede_org_caixas set pix = v_pix, link = v_link where id = c.id;
  end if;
  if p ? 'meta' then
    begin
      update rede_org_caixas set meta = interno.alumia_o13_centavos(p -> 'meta', 'meta') where id = c.id;
    exception when check_violation then perform interno.erro('invalido:meta');
    end;
  end if;
  if p ? 'arrecadado' then
    v_arr := interno.alumia_o13_centavos(p -> 'arrecadado', 'arrecadado');
    update rede_org_caixas set arrecadado = v_arr, arrecadado_dia = case when v_arr is null then null else current_date end where id = c.id;
  end if;
  insert into auditoria (quem, nome, acao, alvo, detalhes)
  values (o, '', 'alumia_vaquinha_ajustar', c.id::text, jsonb_build_object('chaves', (select coalesce(jsonb_agg(k), '[]'::jsonb) from jsonb_object_keys(p) k where k in ('pix', 'link', 'meta', 'arrecadado'))));
  return public.rede_org_caixa((select rede_handle from perfis where id = o));
end $$;

/**
 * Uma prestação de contas (tesouraria ou quem gerencia): o que a organização fez com o dinheiro, com o dia (até 2 anos para trás,
 * nunca no futuro) e, se quiser, um link https (a nota no site dela, por exemplo). Sem CPF, telefone, e-mail ou endereço. Até
 * 200 por caixa.
 */
create or replace function public.rede_org_vaquinha_conta(p_caixa uuid, p jsonb) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); o uuid; v_dia date; v_texto text;
begin
  perform interno.rede3_perfil_exige_membro(v);
  o := interno.alumia_o13_caixa_cuida(p_caixa, v);
  if p is null or jsonb_typeof(p) is distinct from 'object' then perform interno.erro('invalido:conta'); end if;
  perform interno.limite('alumia_org_vaquinha', 60, 1440);
  begin v_dia := (p ->> 'dia')::date; exception when others then perform interno.erro('invalido:dia'); end;
  if v_dia is null or v_dia > current_date or v_dia < current_date - 730 then perform interno.erro('invalido:dia'); end if;
  v_texto := interno.alumia_sem_dado_pessoal(interno.txt(p ->> 'texto', 'texto', 10, 1000), 'texto');
  if (select count(*) from rede_org_caixa_contas where caixa = p_caixa) >= 200 then perform interno.erro('limite'); end if;
  insert into rede_org_caixa_contas (caixa, dia, texto, link) values (p_caixa, v_dia, v_texto, interno.alumia_o13_link(p ->> 'link'));
  return public.rede_org_caixa((select rede_handle from perfis where id = o));
end $$;

/** Tirar uma prestação de contas: só nas primeiras 24 h (para corrigir engano), tesouraria ou quem gerencia. Registrado (sem quem). */
create or replace function public.rede_org_vaquinha_conta_retirar(p_conta uuid) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); o uuid; k rede_org_caixa_contas;
begin
  perform interno.rede3_perfil_exige_membro(v);
  select * into k from rede_org_caixa_contas where id = p_conta for update;
  if not found then perform interno.erro('nao_encontrado'); end if;
  o := interno.alumia_o13_caixa_cuida(k.caixa, v);
  if k.criado_em <= now() - interval '24 hours' then perform interno.erro('prazo_passou'); end if;
  perform interno.limite('alumia_org_vaquinha', 60, 1440);
  delete from rede_org_caixa_contas where id = k.id;
  insert into auditoria (quem, nome, acao, alvo, detalhes) values (o, '', 'alumia_vaquinha_conta_retirar', k.caixa::text, jsonb_build_object('dia', k.dia));
  return public.rede_org_caixa((select rede_handle from perfis where id = o));
end $$;

/**
 * Denunciar uma vaquinha que parece falsa (qualquer membro que vê o caixa, menos quem cuida dele). Cai na fila da mediação como
 * denúncia da organização (alvo "org", categoria "golpe"), com o nome e o id do caixa no texto. A organização não sabe quem
 * denunciou. A mesma pessoa denunciando de novo recebe o mesmo protocolo.
 */
create or replace function public.rede_org_vaquinha_denunciar(p_caixa uuid, p_texto text) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); c rede_org_caixas; d rede_denuncias; v_texto text := interno.txt(coalesce(p_texto, ''), 'texto', 0, 1500); v_pri smallint;
begin
  perform interno.rede3_perfil_exige_membro(v);
  select * into c from rede_org_caixas where id = p_caixa;
  if not found or interno.rede_bloqueado(v, c.org) then perform interno.erro('nao_encontrado'); end if;
  if v = c.org or interno.alumia_org_gere(v, c.org) or interno.alumia_org_funcao_tem(v, c.org, 'caixa') then perform interno.erro('sem_permissao'); end if;
  v_texto := interno.alumia_sem_dado_pessoal(v_texto, 'texto');
  select * into d from rede_denuncias where quem = v and alvo_tipo = 'org' and alvo = c.org::text and categoria = 'golpe' and situacao in ('aberta', 'em_analise')
    and texto like '%' || c.id::text || '%' limit 1;
  if found then return jsonb_build_object('protocolo', d.protocolo, 'ja', true); end if;
  perform interno.rede2_limite('denunciar');
  v_pri := interno.rede2_prioridade('golpe');
  insert into rede_denuncias (alvo_tipo, alvo, categoria, prioridade, texto, quem)
  values ('org', c.org::text, 'golpe', v_pri, left(format('Vaquinha que parece falsa: caixa "%s" (%s). %s', c.nome, c.id, v_texto), 2000), v)
  returning * into d;
  return jsonb_build_object('protocolo', d.protocolo, 'ja', false);
end $$;

-- ── 3. Petição com meta ───────────────────────────────────────────────────────────────────────────────────────────────────

/**
 * A petição como a tela recebe (troca a do B1, que recebia a linha da tabela). `total`: assinaturas publicadas, nulo abaixo de 3
 * (para todo mundo, inclusive quem organiza). `meta` e `chegou` (o total publicado alcançou a meta). Nunca quem.
 */
create or replace function interno.alumia_o13_peticao_json(p_peticao uuid, p_quem uuid, p_organiza boolean) returns jsonb
language plpgsql stable security definer set search_path = interno, pg_temp as $$
declare t rede_peticoes; v_n bigint;
begin
  select * into t from rede_peticoes where id = p_peticao;
  if not found then return null; end if;
  v_n := interno.rede_peticao_publicada(t.id);
  return jsonb_build_object(
    'id', t.id, 'ato', t.post, 'alvo', t.alvo, 'texto', t.texto, 'prazo', t.prazo,
    'aberta', not t.encerrada and (t.prazo is null or t.prazo > now()),
    'total', case when v_n >= 3 then v_n end,
    'meta', t.meta,
    'chegou', t.meta is not null and v_n >= 3 and v_n >= t.meta,
    'assinei', p_quem is not null and exists (select 1 from rede_peticao_assinaturas a where a.peticao = t.id and a.usuario = p_quem),
    'organiza', p_organiza);
end $$;

/** A petição de um ato (nula se não há). Visitante lê se o ato é público na internet. */
create or replace function public.rede_peticao(p_ato uuid) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := auth.uid(); p rede_posts; v_id uuid;
begin
  perform interno.aberta('comunidade');
  if v is not null and exists (select 1 from perfis where id = v and suspenso) then perform interno.erro('conta_suspensa'); end if;
  perform interno.limite('alumia_atos_ler', 300, 60);
  p := interno.rede_ato_achar(p_ato, v);
  select id into v_id from rede_peticoes where post = p_ato;
  if v_id is null then return null; end if;
  return interno.alumia_o13_peticao_json(v_id, v, v is not null and interno.rede_age_como(v, p.autor));
end $$;

/** A meta de assinaturas escrita na petição: nulo, ou 10 a 10 milhões. */
create or replace function interno.alumia_o13_meta_peticao(p_valor jsonb) returns integer language plpgsql immutable set search_path = interno, pg_temp as $$
declare v text;
begin
  if p_valor is null or jsonb_typeof(p_valor) = 'null' then return null; end if;
  v := btrim(p_valor #>> '{}');
  if v = '' then return null; end if;
  if v !~ '^[0-9]{1,8}$' or v::integer not between 10 and 10000000 then perform interno.erro('invalido:meta'); end if;
  return v::integer;
end $$;

/**
 * Só quem organiza o ato abre a petição dele (uma por ato). p: {alvo 3–120, texto 20–1500, prazo ISO opcional até 365 dias,
 * meta opcional de 10 a 10 milhões}. Ato cancelado não abre petição; ato que já passou abre (a pauta continua depois do dia).
 */
create or replace function public.rede_peticao_criar(p_ato uuid, p jsonb) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); x rede_posts; v_id uuid; v_alvo text; v_texto text; v_prazo timestamptz; v_tri jsonb; v_meta integer;
begin
  perform interno.aberta('comunidade');
  if not interno.rede2_membro(v) then perform interno.erro('consentimento'); end if;
  if p is null or jsonb_typeof(p) is distinct from 'object' then perform interno.erro('invalido:peticao'); end if;
  x := interno.rede_ato_achar(p_ato, v);
  if not interno.rede_age_como(v, x.autor) then perform interno.erro('so_quem_organizou'); end if;
  if x.oculto or x.retido or x.apagado_em is not null then perform interno.erro('nao_encontrado'); end if;
  if exists (select 1 from rede_chamados where post = p_ato and situacao = 'cancelado') then perform interno.erro('ato_cancelado'); end if;
  if exists (select 1 from rede_peticoes where post = p_ato) then perform interno.erro('peticao_existe'); end if;
  v_alvo := regexp_replace(interno.txt(p ->> 'alvo', 'alvo', 3, 120), '\s+', ' ', 'g');
  v_texto := interno.txt(p ->> 'texto', 'texto', 20, 1500);
  begin
    v_prazo := nullif(btrim(coalesce(p ->> 'prazo', '')), '')::timestamptz;
  exception when others then perform interno.erro('invalido:prazo');
  end;
  if v_prazo is not null and (v_prazo <= now() or v_prazo > now() + interval '365 days') then perform interno.erro('invalido:prazo'); end if;
  v_meta := interno.alumia_o13_meta_peticao(p -> 'meta');
  if interno.rede3_pub_dado_pessoal(v_alvo || ' ' || v_texto) then perform interno.erro('dado_pessoal'); end if;
  -- A triagem de sempre: o que ela não deixaria publicar também não vira petição.
  v_tri := interno.rede_triagem(v_alvo || ' ' || v_texto, v);
  if (v_tri ->> 'veredito') <> 'publicar' then perform interno.erro('invalido:triagem'); end if;
  perform interno.limite('alumia_peticao_criar', 5, 1440);
  insert into rede_peticoes (post, alvo, texto, prazo, meta) values (p_ato, v_alvo, v_texto, v_prazo, v_meta) returning id into v_id;
  return interno.alumia_o13_peticao_json(v_id, v, true);
end $$;

/**
 * Assinar (p_sim) ou tirar a assinatura (sempre pode, LGPD art. 18, IX). Petição encerrada ou vencida não recebe assinatura nova.
 * A data do ato não conta (a petição vive mais que o ato).
 */
create or replace function public.rede_peticao_assinar(p_peticao uuid, p_sim boolean) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); t rede_peticoes; x rede_posts;
begin
  perform interno.aberta('comunidade');
  if not interno.rede2_membro(v) then perform interno.erro('consentimento'); end if;
  perform interno.rede2_limite('reagir');
  select * into t from rede_peticoes where id = p_peticao;
  if not found then perform interno.erro('nao_encontrado'); end if;
  x := interno.rede_ato_achar(t.post, v);
  if coalesce(p_sim, true) then
    if t.encerrada or (t.prazo is not null and t.prazo <= now()) then perform interno.erro('peticao_encerrada'); end if;
    if x.oculto or x.retido or x.apagado_em is not null then perform interno.erro('nao_encontrado'); end if;
    insert into rede_peticao_assinaturas (peticao, usuario) values (t.id, v) on conflict do nothing;
  else
    delete from rede_peticao_assinaturas where peticao = t.id and usuario = v;
  end if;
  return interno.alumia_o13_peticao_json(t.id, v, interno.rede_age_como(v, x.autor));
end $$;

/** Só quem organiza: encerra a petição (o total publicado fica; assinatura nova não entra). */
create or replace function public.rede_peticao_encerrar(p_peticao uuid) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); t rede_peticoes; x rede_posts;
begin
  perform interno.aberta('comunidade');
  if not interno.rede2_membro(v) then perform interno.erro('consentimento'); end if;
  select * into t from rede_peticoes where id = p_peticao;
  if not found then perform interno.erro('nao_encontrado'); end if;
  x := interno.rede_ato_achar(t.post, v);
  if not interno.rede_age_como(v, x.autor) then perform interno.erro('so_quem_organizou'); end if;
  perform interno.limite('alumia_ato_mudar', 20, 60);
  update rede_peticoes set encerrada = true where id = p_peticao;
  return interno.alumia_o13_peticao_json(t.id, v, true);
end $$;

/** Só quem organiza, com a petição aberta: põe, troca ou tira (nulo) a meta de assinaturas. */
create or replace function public.rede_peticao_meta(p_peticao uuid, p_meta integer) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); t rede_peticoes; x rede_posts; v_meta integer;
begin
  perform interno.aberta('comunidade');
  if not interno.rede2_membro(v) then perform interno.erro('consentimento'); end if;
  select * into t from rede_peticoes where id = p_peticao;
  if not found then perform interno.erro('nao_encontrado'); end if;
  x := interno.rede_ato_achar(t.post, v);
  if not interno.rede_age_como(v, x.autor) then perform interno.erro('so_quem_organizou'); end if;
  if t.encerrada or (t.prazo is not null and t.prazo <= now()) then perform interno.erro('peticao_encerrada'); end if;
  v_meta := interno.alumia_o13_meta_peticao(to_jsonb(p_meta));
  perform interno.limite('alumia_ato_mudar', 20, 60);
  update rede_peticoes set meta = v_meta where id = t.id;
  return interno.alumia_o13_peticao_json(t.id, v, true);
end $$;

/**
 * O documento de entrega (só quem organiza): para quem é, o texto, o NÚMERO de assinaturas (o publicado, a partir de 3), a meta,
 * o dia em que a petição abriu e o de hoje. Nenhum nome, nenhuma lista: nem para quem organiza. Abaixo de 3, recusa.
 */
create or replace function public.rede_peticao_entrega(p_peticao uuid) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); t rede_peticoes; x rede_posts; v_n bigint;
begin
  perform interno.aberta('comunidade');
  if not interno.rede2_membro(v) then perform interno.erro('consentimento'); end if;
  select * into t from rede_peticoes where id = p_peticao;
  if not found then perform interno.erro('nao_encontrado'); end if;
  x := interno.rede_ato_achar(t.post, v);
  if not interno.rede_age_como(v, x.autor) then perform interno.erro('so_quem_organizou'); end if;
  perform interno.limite('alumia_peticao_entrega', 20, 60);
  v_n := interno.rede_peticao_publicada(t.id);
  if v_n < 3 then perform interno.erro('poucas_assinaturas'); end if;
  return jsonb_build_object('alvo', t.alvo, 'texto', t.texto, 'total', v_n, 'meta', t.meta, 'abertaEm', t.criada_em, 'prazo', t.prazo,
    'encerrada', t.encerrada or (t.prazo is not null and t.prazo <= now()), 'ato', x.titulo, 'geradoEm', now());
end $$;

-- ── 4. Permissões ─────────────────────────────────────────────────────────────────────────────────────────────────────────
revoke all on function interno.alumia_o13_selo(uuid), interno.alumia_o13_pix(text), interno.alumia_o13_link(text), interno.alumia_o13_centavos(jsonb, text),
  interno.alumia_o13_caixa_json(uuid, uuid, boolean, boolean, boolean, boolean), interno.alumia_o13_caixa_cuida(uuid, uuid), interno.alumia_o13_peticao_json(uuid, uuid, boolean),
  interno.alumia_o13_meta_peticao(jsonb) from public;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on function interno.alumia_o13_selo(uuid), interno.alumia_o13_pix(text), interno.alumia_o13_link(text), interno.alumia_o13_centavos(jsonb, text),
      interno.alumia_o13_caixa_json(uuid, uuid, boolean, boolean, boolean, boolean), interno.alumia_o13_caixa_cuida(uuid, uuid), interno.alumia_o13_peticao_json(uuid, uuid, boolean),
      interno.alumia_o13_meta_peticao(jsonb) from anon, authenticated;
    -- As de conta (todas pedem quem é membro): só quem tem conta. A leitura do caixa e da petição continua aberta ao visitante,
    -- como era (o caixa só de organização com selo; a petição só de ato público na internet).
    revoke all on function public.rede_org_vaquinha_ajustar(uuid, jsonb), public.rede_org_vaquinha_conta(uuid, jsonb), public.rede_org_vaquinha_conta_retirar(uuid),
      public.rede_org_vaquinha_denunciar(uuid, text), public.rede_peticao_meta(uuid, integer), public.rede_peticao_entrega(uuid) from public, anon;
    grant execute on function public.rede_org_vaquinha_ajustar(uuid, jsonb), public.rede_org_vaquinha_conta(uuid, jsonb), public.rede_org_vaquinha_conta_retirar(uuid),
      public.rede_org_vaquinha_denunciar(uuid, text), public.rede_peticao_meta(uuid, integer), public.rede_peticao_entrega(uuid) to authenticated;
  end if;
end $$;

-- ── 5. A porta ────────────────────────────────────────────────────────────────────────────────────────────────────────────
-- Toda função public.rede_* nova ou trocada que anon ou authenticated chamam passa pela porta da entrada. "abertas" tem de vir vazia.
select interno.alumia_trancar();
