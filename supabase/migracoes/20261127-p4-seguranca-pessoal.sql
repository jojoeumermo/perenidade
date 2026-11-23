-- Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
-- Alumia · Prompt 4 · segurança pessoal: registro de abuso verificável (item 10), plantão jurídico (item 11) e interruptor de
-- sumiço (item 12). Atrás do interruptor "alumia-p4-seguranca-pessoal" (só pelo nome).
--
-- O banco só guarda cifra. Tudo é cifrado NO APARELHO de quem manda (lib/rede/seguranca-pessoal/selo.ts) para a CHAVE DE SEGURANÇA
-- de quem vai ler: um par X-Wing (HPKE, RFC 9180, pela mesma biblioteca do chat), criado no aparelho de cada pessoa e assinado pela
-- identidade da conta. Não é a chave de voto: o voto não muda em nada. Quem administra o banco não abre nada daqui.
--
--   1. Chave de segurança     interno.rede_p4_seg_chaves: a pública e a assinatura (a privada fica só no aparelho).
--   2. Assessoria jurídica    interno.rede_p4_seg_assessoras: quem gere uma organização com selo indica as contas da assessoria
--                             jurídica. Ninguém lê essa lista: quem pede recebe só as chaves (para cifrar), sem nome nem @.
--   3. Envios (10 e 11)       interno.rede_p4_seg_envios e rede_p4_seg_embrulhos: a cifra (uma vez) e a chave dela embrulhada
--                             para cada assessora. SEM a conta de quem mandou, sem hora (só o dia), sem endereço de rede. Somem em 30
--                             dias, ou antes, quando a última assessora apaga.
--   4. Sumiço (12)            interno.rede_p4_sumico: "se eu não entrar em N dias" (14 a 365), avisar um contato de confiança
--                             (o aviso vai cifrado para a chave dela e só é entregue quando o prazo passa) e/ou apagar a conta.
--                             Desligado por padrão. Lembrete 7 dias antes. Entrar de novo (interno.perfis.visto_em) zera o prazo.
--   5. A rotina diária        interno.rede_p4_seg_rodar(): lembrete, entrega, apagar a conta pedida e a faxina. Só age com o
--                             interruptor ligado no painel (interno.recursos_vivos), como o "Fui detido".
-- Roda depois de 20261126-p5-fim.sql (banco na versão 17). Não mexe na versão nem na lista da porta: o 20261127-p4-fim.sql faz isso.
-- Nenhuma função existente é redefinida. Pode rodar mais de uma vez. Endereço de rede: nada daqui lê ou guarda.
-- Lei: LGPD art. 46 (segurança: cifrado de ponta a ponta), art. 6º, III (necessidade: só os campos mínimos) e art. 18, VI (a
-- pessoa pede que a conta seja apagada). Lei 13.869/2019 e CF art. 5º, LXIII (assistência de advogado): o registro e o pedido vão
-- só à assessoria indicada pela organização. Parecer jurídico pendente antes de ligar.

-- ── 0. O interruptor ──────────────────────────────────────────────────────────────────────────────────────────────────────────
do $$
begin
  if to_regclass('interno.recursos_catalogo') is not null then
    insert into interno.recursos_catalogo (nome, so_pelo_nome) values ('alumia-p4-seguranca-pessoal', true)
      on conflict (nome) do update set so_pelo_nome = true;
  end if;
end $$;

/** Ligado só com decisão explícita do painel (como o "Fui detido"): a variável de montagem mostra a tela, quem libera é o banco. */
create or replace function interno.rede_p4_seg_ligado() returns boolean language plpgsql stable security definer set search_path = interno, pg_temp as $$
begin
  if to_regclass('interno.recursos_vivos') is null then return false; end if;
  if exists (select 1 from recursos_vivos where nome in ('rede-v2', 'alumia-2') and not ligado) then return false; end if;
  return coalesce((select ligado from recursos_vivos where nome = 'alumia-p4-seguranca-pessoal'), false);
end $$;

/** Quem chama: sessão, conta ativa, membro da Alumia e o interruptor ligado. */
create or replace function interno.rede_p4_seg_eu() returns uuid language plpgsql stable security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu();
begin
  if not interno.rede2_membro(v) then perform interno.erro('sem_permissao'); end if;
  if not interno.rede_p4_seg_ligado() then perform interno.erro('desligado'); end if;
  return v;
end $$;

/** Base64 que o aparelho mandou, com o tamanho conferido; fora disso, erro com o nome do campo. */
create or replace function interno.rede_p4_seg_bytes(p_texto text, p_campo text, p_min integer, p_max integer) returns bytea language plpgsql immutable set search_path = interno, pg_temp as $$
declare v bytea;
begin
  if p_texto is null or p_texto !~ '^[A-Za-z0-9+/]+={0,2}$' then perform interno.erro('invalido:' || p_campo); end if;
  begin
    v := decode(p_texto, 'base64');
  exception when others then
    perform interno.erro('invalido:' || p_campo);
  end;
  if octet_length(v) not between p_min and p_max then perform interno.erro('invalido:' || p_campo); end if;
  return v;
end $$;

-- ── 1. As tabelas ─────────────────────────────────────────────────────────────────────────────────────────────────────────────

-- A chave de segurança da conta: X-Wing (1216 bytes), assinada pela identidade da conta (Ed25519, 64 bytes). A privada nunca vem.
create table if not exists interno.rede_p4_seg_chaves (
  usuario uuid primary key references interno.perfis (id) on delete cascade,
  publica bytea not null check (octet_length(publica) = 1216),
  assinatura bytea not null check (octet_length(assinatura) = 64),
  criado_dia date not null default current_date
);

-- Quem a organização indicou como assessoria jurídica. Só a gestão da organização mexe; ninguém lista.
create table if not exists interno.rede_p4_seg_assessoras (
  org uuid not null references interno.rede_orgs (perfil) on delete cascade,
  usuario uuid not null references interno.perfis (id) on delete cascade,
  desde date not null default current_date,
  primary key (org, usuario),
  check (org <> usuario)
);
create index if not exists rede_p4_seg_assessoras_usuario on interno.rede_p4_seg_assessoras (usuario);

-- Um envio (registro de abuso ou pedido do plantão): a cifra, para que organização e para quê. Sem autor, sem hora.
create table if not exists interno.rede_p4_seg_envios (
  id uuid primary key,
  org uuid not null references interno.rede_orgs (perfil) on delete cascade,
  finalidade text not null check (finalidade in ('registro', 'plantao')),
  cifra bytea not null check (octet_length(cifra) between 28 and 9437184),
  criado_dia date not null default current_date,
  apagar_em date not null default current_date + 30
);
create index if not exists rede_p4_seg_envios_apagar on interno.rede_p4_seg_envios (apagar_em);

-- A chave da cifra embrulhada para cada assessora (HPKE: enc 1120 + 32 + 16).
create table if not exists interno.rede_p4_seg_embrulhos (
  envio uuid not null references interno.rede_p4_seg_envios (id) on delete cascade,
  conta uuid not null references interno.perfis (id) on delete cascade,
  embrulho bytea not null check (octet_length(embrulho) = 1168),
  primary key (envio, conta)
);
create index if not exists rede_p4_seg_embrulhos_conta on interno.rede_p4_seg_embrulhos (conta);

-- O interruptor de sumiço de cada pessoa (uma linha só quando ligado).
create table if not exists interno.rede_p4_sumico (
  usuario uuid primary key references interno.perfis (id) on delete cascade,
  dias integer not null check (dias between 14 and 365),
  apagar boolean not null default false,
  destino uuid references interno.perfis (id) on delete set null,
  id uuid,
  cifra bytea check (cifra is null or octet_length(cifra) = 12 + 4096 + 16),
  embrulho bytea check (embrulho is null or octet_length(embrulho) = 1168),
  lembrado_dia date,
  criado_dia date not null default current_date,
  check ((destino is null) = (cifra is null) and (cifra is null) = (embrulho is null) and (cifra is null) = (id is null)),
  check (apagar or destino is not null)
);

-- O aviso entregue (depois do prazo) a quem foi escolhida. Sem quem mandou: o nome vai dentro da cifra.
create table if not exists interno.rede_p4_sumico_entregues (
  id uuid primary key,
  destino uuid not null references interno.perfis (id) on delete cascade,
  cifra bytea not null check (octet_length(cifra) = 12 + 4096 + 16),
  embrulho bytea not null check (octet_length(embrulho) = 1168),
  entregue_dia date not null default current_date,
  apagar_em date not null default current_date + 90
);
create index if not exists rede_p4_sumico_entregues_destino on interno.rede_p4_sumico_entregues (destino);

do $$
declare t text;
begin
  foreach t in array array['rede_p4_seg_chaves', 'rede_p4_seg_assessoras', 'rede_p4_seg_envios', 'rede_p4_seg_embrulhos', 'rede_p4_sumico', 'rede_p4_sumico_entregues'] loop
    execute format('alter table interno.%I enable row level security', t);
    execute format('revoke all on table interno.%I from public', t);
    if exists (select 1 from pg_roles where rolname = 'anon') then
      execute format('revoke all on table interno.%I from anon, authenticated', t);
    end if;
  end loop;
end $$;

-- ── 2. A chave de segurança ───────────────────────────────────────────────────────────────────────────────────────────────────

/** A minha situação: tenho chave? sou assessora de quem? gero que organização? quais organizações têm plantão? e o sumiço. */
create or replace function public.rede_p4_seg_situacao() returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.rede_p4_seg_eu(); s rede_p4_sumico;
begin
  perform interno.limite('p4_seg_ler', 240, 60);
  select * into s from rede_p4_sumico where usuario = v;
  return jsonb_build_object(
    'chave', (select encode(publica, 'base64') from rede_p4_seg_chaves where usuario = v),
    'identidade', exists (select 1 from diretorio_contas where usuario = v),
    -- As organizações em que sou assessora (só as minhas).
    'assessora_de', coalesce((select jsonb_agg(jsonb_build_object('handle', f.rede_handle, 'nome', interno.rede_nome(o.perfil)) order by f.rede_handle)
                              from rede_p4_seg_assessoras a join rede_orgs o on o.perfil = a.org join perfis f on f.id = o.perfil
                             where a.usuario = v), '[]'::jsonb),
    -- As organizações com selo que eu giro: só se o plantão tem alguém pronto (sem dizer quem nem quantas).
    'gestora_de', coalesce((select jsonb_agg(jsonb_build_object('handle', f.rede_handle, 'nome', interno.rede_nome(o.perfil),
                              'pronta', exists (select 1 from rede_p4_seg_assessoras a join rede_p4_seg_chaves c on c.usuario = a.usuario where a.org = o.perfil)) order by f.rede_handle)
                              from rede_org_gestores g join rede_orgs o on o.perfil = g.org join perfis f on f.id = o.perfil
                             where g.gestor = v and o.verificada_em is not null), '[]'::jsonb),
    -- As organizações com selo que têm plantão com chave (é o que a organização publica; nenhuma pessoa).
    'plantoes', coalesce((select jsonb_agg(jsonb_build_object('handle', f.rede_handle, 'nome', interno.rede_nome(o.perfil)) order by f.rede_handle)
                            from rede_orgs o join perfis f on f.id = o.perfil
                           where o.verificada_em is not null and not f.suspenso
                             and exists (select 1 from rede_p4_seg_assessoras a join rede_p4_seg_chaves c on c.usuario = a.usuario
                                          join diretorio_contas d on d.usuario = a.usuario where a.org = o.perfil)), '[]'::jsonb),
    'sumico', case when s.usuario is null then null else jsonb_build_object(
                'dias', s.dias, 'apagar', s.apagar,
                'destino', (select rede_handle from perfis where id = s.destino),
                'prazo', ((select visto_em from perfis where id = v)::date + s.dias)) end
  );
end $$;

/** Publica (ou troca) a minha chave de segurança. O aparelho assinou com a identidade; quem cifra confere a assinatura. */
create or replace function public.rede_p4_seg_chave_publicar(p jsonb) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.rede_p4_seg_eu(); v_pub bytea; v_ass bytea;
begin
  perform interno.limite('p4_seg_chave', 10, 60);
  if not exists (select 1 from diretorio_contas where usuario = v) then perform interno.erro('sem_identidade'); end if;
  v_pub := interno.rede_p4_seg_bytes(p ->> 'publica', 'publica', 1216, 1216);
  v_ass := interno.rede_p4_seg_bytes(p ->> 'assinatura', 'assinatura', 64, 64);
  insert into rede_p4_seg_chaves (usuario, publica, assinatura) values (v, v_pub, v_ass)
  on conflict (usuario) do update set publica = excluded.publica, assinatura = excluded.assinatura, criado_dia = current_date;
  return jsonb_build_object('ok', true);
end $$;

/** Tira a minha chave: ninguém mais cifra para mim. O que já chegou continua (e só abre com a privada antiga). */
create or replace function public.rede_p4_seg_chave_tirar() returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.rede_p4_seg_eu();
begin
  perform interno.limite('p4_seg_chave', 10, 60);
  delete from rede_p4_seg_chaves where usuario = v;
  return jsonb_build_object('ok', true);
end $$;

-- ── 3. A assessoria jurídica da organização ───────────────────────────────────────────────────────────────────────────────────

/** Quem gere uma organização com selo indica (ou tira) uma conta da assessoria jurídica, pelo @. Ninguém recebe a lista de volta. */
create or replace function public.rede_p4_seg_assessora(p_org text, p_handle text, p_ligar boolean) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.rede_p4_seg_eu(); v_org uuid; v_pessoa uuid; v_nome text;
begin
  perform interno.limite('p4_seg_assessora', 20, 60);
  select o.perfil into v_org from rede_orgs o join perfis f on f.id = o.perfil join rede_org_gestores g on g.org = o.perfil and g.gestor = v
   where f.rede_handle = lower(btrim(coalesce(p_org, ''), ' @')) and o.verificada_em is not null;
  if v_org is null then perform interno.erro('sem_permissao'); end if;
  select id into v_pessoa from perfis where rede_handle = lower(btrim(coalesce(p_handle, ''), ' @')) and not suspenso;
  if v_pessoa is null or v_pessoa = v_org or not interno.rede2_membro(v_pessoa) then perform interno.erro('nao_encontrado'); end if;
  if coalesce(p_ligar, false) then
    insert into rede_p4_seg_assessoras (org, usuario) values (v_org, v_pessoa) on conflict do nothing;
    if found then
      v_nome := (select rede_handle from perfis where id = v_org);
      perform interno.avisar_em(v_pessoa, format('A organização @%s indicou você como assessoria jurídica na Alumia. Para receber os pedidos cifrados, crie a sua chave de segurança na tela "Segurança pessoal". Para sair, peça à gestão da organização.', v_nome), 'conta');
    end if;
  else
    delete from rede_p4_seg_assessoras where org = v_org and usuario = v_pessoa;
  end if;
  return jsonb_build_object('ok', true);
end $$;

/** Eu saio da assessoria de uma organização (sem depender da gestão). */
create or replace function public.rede_p4_seg_assessora_sair(p_org text) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.rede_p4_seg_eu();
begin
  perform interno.limite('p4_seg_assessora', 20, 60);
  delete from rede_p4_seg_assessoras a using perfis f where f.id = a.org and a.usuario = v and f.rede_handle = lower(btrim(coalesce(p_org, ''), ' @'));
  return jsonb_build_object('ok', true);
end $$;

/**
 * As chaves para cifrar um pedido ao plantão de uma organização: para cada assessora com chave, a conta (que vai na assinatura e
 * no contexto da cifra), a identidade e a chave assinada. Sem nome, sem @: o aparelho só precisa disso para cifrar e conferir.
 */
create or replace function public.rede_p4_seg_destinos(p_org text) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.rede_p4_seg_eu(); v_org uuid;
begin
  perform interno.rede3_perfil_exige_membro(v);
  perform interno.limite('p4_seg_destinos', 60, 60);
  select o.perfil into v_org from rede_orgs o join perfis f on f.id = o.perfil
   where f.rede_handle = lower(btrim(coalesce(p_org, ''), ' @')) and o.verificada_em is not null and not f.suspenso;
  if v_org is null then perform interno.erro('nao_encontrado'); end if;
  return coalesce((select jsonb_agg(jsonb_build_object('conta', a.usuario, 'identidade', encode(d.identidade, 'base64'),
                                                       'publica', encode(c.publica, 'base64'), 'assinatura', encode(c.assinatura, 'base64'))
                                    order by gen_random_uuid())
                     from rede_p4_seg_assessoras a join rede_p4_seg_chaves c on c.usuario = a.usuario
                     join diretorio_contas d on d.usuario = a.usuario join perfis f on f.id = a.usuario
                    where a.org = v_org and not f.suspenso and a.usuario <> v), '[]'::jsonb);
end $$;

-- ── 4. Mandar e receber (itens 10 e 11) ───────────────────────────────────────────────────────────────────────────────────────

/**
 * Manda um registro de abuso ou um pedido do plantão, já cifrado no aparelho: {id, org, finalidade, cifra, embrulhos: [{conta,
 * embrulho}]}. Cada embrulho tem de ser para uma assessora da organização com chave. O banco NÃO grava quem mandou.
 */
create or replace function public.rede_p4_seg_enviar(p jsonb) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.rede_p4_seg_eu(); v_org uuid; v_id uuid; v_fin text := p ->> 'finalidade'; v_cifra bytea; e jsonb; v_conta uuid;
  v_contas uuid[] := '{}'; v_handle text;
begin
  perform interno.rede3_perfil_exige_membro(v);
  perform interno.limite('p4_seg_enviar', 10, 60);
  if v_fin is null or v_fin not in ('registro', 'plantao') then perform interno.erro('invalido:finalidade'); end if;
  begin
    v_id := (p ->> 'id')::uuid;
  exception when others then
    perform interno.erro('invalido:id');
  end;
  if v_id is null then perform interno.erro('invalido:id'); end if;
  select o.perfil, f.rede_handle into v_org, v_handle from rede_orgs o join perfis f on f.id = o.perfil
   where f.rede_handle = lower(btrim(coalesce(p ->> 'org', ''), ' @')) and o.verificada_em is not null and not f.suspenso;
  if v_org is null then perform interno.erro('nao_encontrado'); end if;
  -- O pedido do plantão tem tamanho fixo (2048 por dentro); o registro, até 9 MiB.
  v_cifra := case when v_fin = 'plantao' then interno.rede_p4_seg_bytes(p ->> 'cifra', 'cifra', 12 + 2048 + 16, 12 + 2048 + 16)
                  else interno.rede_p4_seg_bytes(p ->> 'cifra', 'cifra', 28, 9437184) end;
  if jsonb_typeof(p -> 'embrulhos') <> 'array' or jsonb_array_length(p -> 'embrulhos') not between 1 and 20 then perform interno.erro('invalido:embrulhos'); end if;
  if exists (select 1 from rede_p4_seg_envios where id = v_id) then perform interno.erro('repetido'); end if;
  insert into rede_p4_seg_envios (id, org, finalidade, cifra) values (v_id, v_org, v_fin, v_cifra);
  for e in select * from jsonb_array_elements(p -> 'embrulhos') loop
    begin
      v_conta := (e ->> 'conta')::uuid;
    exception when others then
      perform interno.erro('invalido:embrulhos');
    end;
    if v_conta is null or v_conta = any (v_contas)
       or not exists (select 1 from rede_p4_seg_assessoras a join rede_p4_seg_chaves c on c.usuario = a.usuario where a.org = v_org and a.usuario = v_conta) then
      perform interno.erro('invalido:embrulhos');
    end if;
    insert into rede_p4_seg_embrulhos (envio, conta, embrulho) values (v_id, v_conta, interno.rede_p4_seg_bytes(e ->> 'embrulho', 'embrulho', 1168, 1168));
    v_contas := v_contas || v_conta;
  end loop;
  foreach v_conta in array v_contas loop
    perform interno.avisar_em(v_conta, format('Chegou %s cifrado para a assessoria jurídica de @%s. Abra na Alumia, em "Segurança pessoal", no aparelho em que você criou a chave de segurança.',
      case when v_fin = 'plantao' then 'um pedido do plantão' else 'um registro de abuso' end, v_handle), 'conta');
  end loop;
  return jsonb_build_object('ok', true);
end $$;

/** A minha caixa de assessora: só o que foi embrulhado para mim. Sem a cifra (pesada): ela vem em rede_p4_seg_abrir. */
create or replace function public.rede_p4_seg_caixa() returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.rede_p4_seg_eu();
begin
  perform interno.limite('p4_seg_ler', 240, 60);
  return coalesce((select jsonb_agg(jsonb_build_object('id', e.id, 'org', f.rede_handle, 'finalidade', e.finalidade, 'dia', e.criado_dia,
                                                       'apagar_em', e.apagar_em, 'tamanho', octet_length(e.cifra)) order by e.criado_dia desc, e.id)
                     from rede_p4_seg_embrulhos b join rede_p4_seg_envios e on e.id = b.envio join perfis f on f.id = e.org
                    where b.conta = v), '[]'::jsonb);
end $$;

/** Um envio da minha caixa, para abrir no aparelho: a cifra e o MEU embrulho. De outra pessoa: não existe. */
create or replace function public.rede_p4_seg_abrir(p_id uuid) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.rede_p4_seg_eu(); r record;
begin
  perform interno.limite('p4_seg_ler', 240, 60);
  select e.id, e.finalidade, e.cifra, b.embrulho into r from rede_p4_seg_embrulhos b join rede_p4_seg_envios e on e.id = b.envio
   where b.envio = p_id and b.conta = v;
  if not found then perform interno.erro('nao_encontrado'); end if;
  return jsonb_build_object('id', r.id, 'finalidade', r.finalidade, 'cifra', encode(r.cifra, 'base64'), 'embrulho', encode(r.embrulho, 'base64'));
end $$;

/** Apago o meu embrulho; quando não sobra nenhum, o envio inteiro some. */
create or replace function public.rede_p4_seg_apagar(p_id uuid) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.rede_p4_seg_eu();
begin
  perform interno.limite('p4_seg_apagar', 120, 60);
  delete from rede_p4_seg_embrulhos where envio = p_id and conta = v;
  delete from rede_p4_seg_envios e where e.id = p_id and not exists (select 1 from rede_p4_seg_embrulhos b where b.envio = e.id);
  return jsonb_build_object('ok', true);
end $$;

-- ── 5. O interruptor de sumiço (item 12) ──────────────────────────────────────────────────────────────────────────────────────

/**
 * A chave de um contato de confiança para o aviso do sumiço: só de quem aceitou ser meu contato no modo ato (interno.alumia_ato_contatos)
 * e tem chave de segurança. Assim ninguém sonda quem tem chave.
 */
create or replace function public.rede_p4_sumico_destino(p_handle text) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.rede_p4_seg_eu(); v_pessoa uuid; r record;
begin
  perform interno.limite('p4_seg_destinos', 60, 60);
  select id into v_pessoa from perfis where rede_handle = lower(btrim(coalesce(p_handle, ''), ' @')) and not suspenso;
  if v_pessoa is null or not exists (select 1 from alumia_ato_contatos where dono = v and contato = v_pessoa and aceito) then perform interno.erro('nao_encontrado'); end if;
  select c.publica, c.assinatura, d.identidade into r from rede_p4_seg_chaves c join diretorio_contas d on d.usuario = c.usuario where c.usuario = v_pessoa;
  if not found then perform interno.erro('sem_chave'); end if;
  return jsonb_build_object('conta', v_pessoa, 'identidade', encode(r.identidade, 'base64'), 'publica', encode(r.publica, 'base64'), 'assinatura', encode(r.assinatura, 'base64'));
end $$;

/**
 * Liga (ou troca) o interruptor: {dias, apagar, destino (@ ou nulo), id, cifra, embrulho}. O aviso chega cifrado (o banco não lê) e
 * só é entregue quando o prazo passa. Pelo menos uma das duas coisas: avisar alguém ou apagar a conta.
 */
create or replace function public.rede_p4_sumico_salvar(p jsonb) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.rede_p4_seg_eu(); v_dias integer; v_apagar boolean := coalesce((p ->> 'apagar')::boolean, false);
  v_destino uuid; v_id uuid; v_cifra bytea; v_emb bytea;
begin
  perform interno.limite('p4_sumico', 20, 60);
  begin
    v_dias := (p ->> 'dias')::integer;
  exception when others then
    perform interno.erro('invalido:dias');
  end;
  if v_dias is null or v_dias not between 14 and 365 then perform interno.erro('invalido:dias'); end if;
  if nullif(btrim(coalesce(p ->> 'destino', '')), '') is not null then
    select id into v_destino from perfis where rede_handle = lower(btrim(p ->> 'destino', ' @')) and not suspenso;
    if v_destino is null or not exists (select 1 from alumia_ato_contatos where dono = v and contato = v_destino and aceito) then perform interno.erro('nao_encontrado'); end if;
    if not exists (select 1 from rede_p4_seg_chaves where usuario = v_destino) then perform interno.erro('sem_chave'); end if;
    begin
      v_id := (p ->> 'id')::uuid;
    exception when others then
      perform interno.erro('invalido:id');
    end;
    if v_id is null then perform interno.erro('invalido:id'); end if;
    v_cifra := interno.rede_p4_seg_bytes(p ->> 'cifra', 'cifra', 12 + 4096 + 16, 12 + 4096 + 16);
    v_emb := interno.rede_p4_seg_bytes(p ->> 'embrulho', 'embrulho', 1168, 1168);
  elsif not v_apagar then
    perform interno.erro('invalido:vazio');
  end if;
  insert into rede_p4_sumico (usuario, dias, apagar, destino, id, cifra, embrulho) values (v, v_dias, v_apagar, v_destino, v_id, v_cifra, v_emb)
  on conflict (usuario) do update set dias = excluded.dias, apagar = excluded.apagar, destino = excluded.destino, id = excluded.id,
    cifra = excluded.cifra, embrulho = excluded.embrulho, lembrado_dia = null, criado_dia = current_date;
  return jsonb_build_object('ok', true);
end $$;

/** Desliga o interruptor: a linha some inteira (o aviso cifrado junto). */
create or replace function public.rede_p4_sumico_tirar() returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.rede_p4_seg_eu();
begin
  perform interno.limite('p4_sumico', 20, 60);
  delete from rede_p4_sumico where usuario = v;
  return jsonb_build_object('ok', true);
end $$;

/** Os avisos de sumiço entregues a mim (para abrir no aparelho). */
create or replace function public.rede_p4_sumico_recebidos() returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.rede_p4_seg_eu();
begin
  perform interno.limite('p4_seg_ler', 240, 60);
  return coalesce((select jsonb_agg(jsonb_build_object('id', id, 'dia', entregue_dia, 'cifra', encode(cifra, 'base64'), 'embrulho', encode(embrulho, 'base64'))
                                    order by entregue_dia desc, id)
                     from rede_p4_sumico_entregues where destino = v), '[]'::jsonb);
end $$;

create or replace function public.rede_p4_sumico_recebido_apagar(p_id uuid) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.rede_p4_seg_eu();
begin
  perform interno.limite('p4_seg_apagar', 120, 60);
  delete from rede_p4_sumico_entregues where id = p_id and destino = v;
  return jsonb_build_object('ok', true);
end $$;

-- ── 6. A rotina diária ────────────────────────────────────────────────────────────────────────────────────────────────────────

/**
 * Uma vez por dia (pg_cron), só com o interruptor ligado no painel:
 *   - lembrete: 7 dias antes do prazo, um aviso à própria pessoa (uma vez por prazo; entrar de novo zera tudo);
 *   - prazo vencido E lembrete dado há 7 dias ou mais (a rotina parada não dispara nada sem aviso): entrega o aviso cifrado ao contato escolhido e, se a pessoa pediu, apaga a conta (como public.conta_apagar,
 *     menos a senha, que ela deu ao ligar; a última coordenação nunca é apagada por aqui);
 *   - faxina: envios e avisos entregues depois do prazo de guarda.
 * Devolve só números (nunca quem).
 */
create or replace function interno.rede_p4_seg_rodar() returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare r record; v_lembrados integer := 0; v_entregues integer := 0; v_apagadas integer := 0; v_ultimos integer := 0;
begin
  if not interno.rede_p4_seg_ligado() then return jsonb_build_object('ligado', false); end if;
  -- Entrou de novo depois do lembrete: o lembrete volta a valer para o próximo prazo.
  update rede_p4_sumico s set lembrado_dia = null from perfis f
   where f.id = s.usuario and s.lembrado_dia is not null and f.visto_em >= s.lembrado_dia::timestamptz;
  for r in select s.*, f.visto_em from rede_p4_sumico s join perfis f on f.id = s.usuario
            where s.lembrado_dia is null and f.visto_em < now() - make_interval(days => s.dias - 7) loop
    perform interno.avisar_em(r.usuario, format('Você ligou o interruptor de sumiço da Alumia. Se não entrar em 7 dias, %s. Para não disparar, basta entrar na Alumia.',
      concat_ws(' e ', case when r.destino is not null then 'o aviso vai para o contato escolhido' end, case when r.apagar then 'a sua conta será apagada' end)), 'conta');
    update rede_p4_sumico set lembrado_dia = current_date where usuario = r.usuario;
    v_lembrados := v_lembrados + 1;
  end loop;
  for r in select s.*, f.visto_em from rede_p4_sumico s join perfis f on f.id = s.usuario
            where f.visto_em < now() - make_interval(days => s.dias) and s.lembrado_dia <= current_date - 7 loop
    if r.destino is not null then
      insert into rede_p4_sumico_entregues (id, destino, cifra, embrulho) values (r.id, r.destino, r.cifra, r.embrulho) on conflict (id) do nothing;
      perform interno.avisar_em(r.destino, 'Chegou um aviso cifrado do interruptor de sumiço de um contato de confiança seu. Abra na Alumia, em "Segurança pessoal", no aparelho em que você criou a chave de segurança.', 'conta');
      v_entregues := v_entregues + 1;
    end if;
    delete from rede_p4_sumico where usuario = r.usuario;
    if r.apagar then
      if exists (select 1 from papeis where usuario = r.usuario and papel = 'coordenacao') and (select count(*) from papeis where papel = 'coordenacao') <= 1 then
        v_ultimos := v_ultimos + 1;
      else
        perform interno.alumia_md_apagar_de_vez(r.usuario);
        delete from perfis where id = r.usuario;
        delete from auth.users where id = r.usuario;
        v_apagadas := v_apagadas + 1;
      end if;
    end if;
  end loop;
  delete from rede_p4_seg_envios where apagar_em < current_date;
  delete from rede_p4_sumico_entregues where apagar_em < current_date;
  return jsonb_build_object('ligado', true, 'lembrados', v_lembrados, 'entregues', v_entregues, 'apagadas', v_apagadas, 'ultima_coordenacao', v_ultimos);
end $$;

do $$
begin
  if to_regprocedure('cron.schedule(text,text,text)') is not null then
    perform cron.schedule('alumia-p4-seguranca-pessoal', '29 5 * * *', 'select interno.rede_p4_seg_rodar()');
  end if;
exception when others then
  raise warning 'alumia-p4-seguranca-pessoal: a rotina não foi agendada (%).', sqlerrm;
end $$;

-- ── 7. Permissões ─────────────────────────────────────────────────────────────────────────────────────────────────────────────
revoke all on function interno.rede_p4_seg_ligado(), interno.rede_p4_seg_eu(), interno.rede_p4_seg_bytes(text, text, integer, integer),
  interno.rede_p4_seg_rodar() from public;
revoke all on function public.rede_p4_seg_situacao(), public.rede_p4_seg_chave_publicar(jsonb), public.rede_p4_seg_chave_tirar(),
  public.rede_p4_seg_assessora(text, text, boolean), public.rede_p4_seg_assessora_sair(text), public.rede_p4_seg_destinos(text),
  public.rede_p4_seg_enviar(jsonb), public.rede_p4_seg_caixa(), public.rede_p4_seg_abrir(uuid), public.rede_p4_seg_apagar(uuid),
  public.rede_p4_sumico_destino(text), public.rede_p4_sumico_salvar(jsonb), public.rede_p4_sumico_tirar(), public.rede_p4_sumico_recebidos(),
  public.rede_p4_sumico_recebido_apagar(uuid) from public;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on function interno.rede_p4_seg_ligado(), interno.rede_p4_seg_eu(), interno.rede_p4_seg_bytes(text, text, integer, integer),
      interno.rede_p4_seg_rodar() from anon, authenticated;
    revoke all on function public.rede_p4_seg_situacao(), public.rede_p4_seg_chave_publicar(jsonb), public.rede_p4_seg_chave_tirar(),
      public.rede_p4_seg_assessora(text, text, boolean), public.rede_p4_seg_assessora_sair(text), public.rede_p4_seg_destinos(text),
      public.rede_p4_seg_enviar(jsonb), public.rede_p4_seg_caixa(), public.rede_p4_seg_abrir(uuid), public.rede_p4_seg_apagar(uuid),
      public.rede_p4_sumico_destino(text), public.rede_p4_sumico_salvar(jsonb), public.rede_p4_sumico_tirar(), public.rede_p4_sumico_recebidos(),
      public.rede_p4_sumico_recebido_apagar(uuid) from anon;
    grant execute on function public.rede_p4_seg_situacao(), public.rede_p4_seg_chave_publicar(jsonb), public.rede_p4_seg_chave_tirar(),
      public.rede_p4_seg_assessora(text, text, boolean), public.rede_p4_seg_assessora_sair(text), public.rede_p4_seg_destinos(text),
      public.rede_p4_seg_enviar(jsonb), public.rede_p4_seg_caixa(), public.rede_p4_seg_abrir(uuid), public.rede_p4_seg_apagar(uuid),
      public.rede_p4_sumico_destino(text), public.rede_p4_sumico_salvar(jsonb), public.rede_p4_sumico_tirar(), public.rede_p4_sumico_recebidos(),
      public.rede_p4_sumico_recebido_apagar(uuid) to authenticated;
  end if;
end $$;

select interno.alumia_trancar();
