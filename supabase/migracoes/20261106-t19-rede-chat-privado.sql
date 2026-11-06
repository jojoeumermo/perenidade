-- ───────────────────────────── Alumia: chat privado cifrado de ponta a ponta (T19) ─────────────────────────────
-- Migração acrescentável: pode rodar mais de uma vez, sem apagar dado nenhum. O mesmo bloco está no fim do install.sql. Roda
-- DEPOIS das migrações da Rede v2 (2026-11-rede-*.sql) e da Alumia (2026-11-alumia.sql). Documento: docs/rede/CHAT-PRIVADO.md.
--
-- A mesma tecnologia das conversas da equipe (lib/sigilo.ts): cada pessoa tem uma chave de aparelho ECDH P-256 (privada não
-- exportável, só no navegador) certificada por uma identidade ECDSA P-256; cada conversa tem uma chave AES-GCM-256, embrulhada
-- (ECDH + HKDF-SHA-256 + AES-GCM) para a chave de cada participante; cada mensagem vai cifrada e assinada no aparelho. O banco
-- guarda só a parte pública das chaves, os embrulhos e o texto cifrado, e RECUSA texto aberto (check no formato "c2.").
--
-- Regras, todas conferidas aqui no servidor (o aparelho confere de novo o que é de cifra):
--   1. Só entre membros da Alumia (18+, consentimento em vigor, conta não suspensa: interno.rede2_membro). LGPD art. 14 e ECA:
--      a Alumia não tem menores; o chat privado também não.
--   2. Quem não segue não entra direto: se a outra pessoa não segue você, vira PEDIDO de conversa (só "fulana quer conversar",
--      sem mensagem) e só depois de aceito alguém escreve. Cada pessoa escolhe: aceitar pedidos (padrão), só de quem eu sigo, ou
--      ninguém. Perfil invisível não recebe pedido. Pedido recusado não se repete por 30 dias.
--   3. Bloqueio (interno.rede_bloqueios, o mesmo da Alumia) corta tudo: não pede, não envia, não lê a chave.
--   4. Denúncia com os trechos que a própria pessoa escolhe e decifra no aparelho dela (a moderação nunca tem a chave), na mesma
--      fila de denúncias da Alumia (alvo: o perfil).
--   5. Limite de envio por pessoa (interno.limite), metade para conta nova.
--   6. Nada de conteúdo, nem de "quem fala com quem", no registro de atividades (interno.registrar não é chamado aqui).
--   7. Retenção mínima: cada mensagem nasce com prazo (1, 7 ou 30 dias; padrão 7) e some sozinha; pedido sem resposta some em
--      30 dias; a faxina (interno.rede_dm_faxina) roda junto das próprias chamadas e as leituras já filtram o que venceu.
--   8. Apagar: a mensagem (quem escreveu), a conversa (qualquer participante; some para os dois), tudo do chat (a pessoa) e a
--      conta (chave estrangeira com on delete cascade): LGPD art. 18, VI.
--   9. Nada federado: as tabelas rede_dm_* não aparecem em nenhuma função do Fediverso (conferido em scripts/testar-rede-chat.mjs).
--  10. RLS ligada sem política nenhuma e nenhum privilégio direto: ninguém lê tabela, só as funções abaixo (que conferem que quem
--      chama é participante).
-- Leis conferidas em 06/11/2026: LGPD (13.709/2018) arts. 6º (finalidade, necessidade, segurança, prevenção), 7º, 11, 14, 18 e
-- 46; Marco Civil (12.965/2014) arts. 7º (sigilo das comunicações privadas), 10 e 19; ECA (8.069/1990) art. 241-D.

-- ── 1. Tabelas ──────────────────────────────────────────────────────────────────────────────────────────────────────────

-- A chave de cada pessoa no chat (uma por conta: o aparelho em que o chat foi ativado). Só a parte pública.
create table if not exists interno.rede_dm_chaves (
  usuario uuid primary key references interno.perfis (id) on delete cascade,
  identidade text not null check (identidade ~ '^B[A-Za-z0-9_-]{86}$'),
  publica text not null check (publica ~ '^B[A-Za-z0-9_-]{86}$'),
  certificado text not null check (certificado ~ '^[A-Za-z0-9_-]{86}$'),
  versao integer not null default 1 check (versao > 0),
  criado_em timestamptz not null default now(),
  trocada_em timestamptz not null default now()
);

-- Quem pode me chamar e o prazo padrão das minhas conversas novas.
create table if not exists interno.rede_dm_prefs (
  usuario uuid primary key references interno.perfis (id) on delete cascade,
  quem_pode text not null default 'pedidos' check (quem_pode in ('pedidos', 'seguidos', 'ninguem')),
  prazo_dias smallint not null default 7 check (prazo_dias in (1, 7, 30))
);

-- Uma conversa por par de pessoas (a < b). "pedido": só quem pediu e quem recebeu sabem; ninguém escreve até ser aceito.
create table if not exists interno.rede_dm_conversas (
  id uuid primary key default gen_random_uuid(),
  a uuid not null references interno.perfis (id) on delete cascade,
  b uuid not null references interno.perfis (id) on delete cascade,
  situacao text not null default 'pedido' check (situacao in ('pedido', 'aberta')),
  pediu uuid not null references interno.perfis (id) on delete cascade,
  versao integer not null default 0 check (versao >= 0),
  versao_em timestamptz,
  prazo_dias smallint not null default 7 check (prazo_dias in (1, 7, 30)),
  a_leu_em timestamptz,
  b_leu_em timestamptz,
  ultima_em timestamptz not null default now(),
  criado_em timestamptz not null default now(),
  unique (a, b),
  check (a < b),
  check (pediu = a or pediu = b)
);

-- A chave de cada versão da conversa, embrulhada para a chave de cada participante (para = usuario; chave_versao = a versão
-- da chave dele quando foi embrulhada). de_publica e de_certificado: a chave de quem embrulhou, para o outro conferir.
create table if not exists interno.rede_dm_embrulhos (
  conversa uuid not null references interno.rede_dm_conversas (id) on delete cascade,
  versao integer not null check (versao > 0),
  para uuid not null references interno.perfis (id) on delete cascade,
  chave_versao integer not null check (chave_versao > 0),
  embrulho text not null check (embrulho ~ '^w1\.[A-Za-z0-9_-]{16}\.[A-Za-z0-9_-]{64}$'),
  de uuid not null references interno.perfis (id) on delete cascade,
  de_publica text not null check (de_publica ~ '^B[A-Za-z0-9_-]{86}$'),
  de_certificado text not null check (de_certificado ~ '^[A-Za-z0-9_-]{86}$'),
  criado_em timestamptz not null default now(),
  primary key (conversa, versao, para)
);

-- As mensagens: só o cifrado. O check recusa qualquer coisa fora do formato "c2.<versão>.<vetor>.<cifrado>".
create table if not exists interno.rede_dm_mensagens (
  id uuid primary key default gen_random_uuid(),
  conversa uuid not null references interno.rede_dm_conversas (id) on delete cascade,
  autor uuid not null references interno.perfis (id) on delete cascade,
  versao integer not null check (versao > 0),
  corpo text not null check (char_length(corpo) <= 12000 and corpo ~ '^c2\.[1-9][0-9]{0,6}\.[A-Za-z0-9_-]{16}\.[A-Za-z0-9_-]{23,}$'),
  criado_em timestamptz not null default now(),
  expira_em timestamptz not null
);
create index if not exists rede_dm_mensagens_conversa on interno.rede_dm_mensagens (conversa, criado_em desc);
create index if not exists rede_dm_mensagens_expira on interno.rede_dm_mensagens (expira_em);

-- Pedido recusado: quem recusou não recebe outro pedido da mesma pessoa até `ate`. Só isso; some depois do prazo.
create table if not exists interno.rede_dm_recusas (
  quem uuid not null references interno.perfis (id) on delete cascade,
  de uuid not null references interno.perfis (id) on delete cascade,
  ate timestamptz not null,
  primary key (quem, de)
);

alter table interno.rede_dm_chaves enable row level security;
alter table interno.rede_dm_prefs enable row level security;
alter table interno.rede_dm_conversas enable row level security;
alter table interno.rede_dm_embrulhos enable row level security;
alter table interno.rede_dm_mensagens enable row level security;
alter table interno.rede_dm_recusas enable row level security;
revoke all on interno.rede_dm_chaves, interno.rede_dm_prefs, interno.rede_dm_conversas, interno.rede_dm_embrulhos, interno.rede_dm_mensagens,
  interno.rede_dm_recusas from public;
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on interno.rede_dm_chaves, interno.rede_dm_prefs, interno.rede_dm_conversas, interno.rede_dm_embrulhos, interno.rede_dm_mensagens,
      interno.rede_dm_recusas from anon, authenticated;
  end if;
end $$;

-- ── 2. Auxiliares internos ──────────────────────────────────────────────────────────────────────────────────────────────

/** A faxina do chat: mensagens vencidas, pedidos sem resposta há 30 dias, recusas vencidas. Roda junto das chamadas. */
create or replace function interno.rede_dm_faxina() returns void language plpgsql security definer set search_path = interno, pg_temp as $$
begin
  delete from rede_dm_mensagens where expira_em <= now();
  delete from rede_dm_conversas where situacao = 'pedido' and criado_em < now() - interval '30 days';
  delete from rede_dm_recusas where ate <= now();
  -- Embrulhos de versões antigas, sem nenhuma mensagem viva que precise deles (a versão atual fica sempre).
  delete from rede_dm_embrulhos e using rede_dm_conversas c
  where c.id = e.conversa and e.versao < c.versao
    and not exists (select 1 from rede_dm_mensagens m where m.conversa = e.conversa and m.versao = e.versao);
end $$;

/** De vez em quando (2% das chamadas), a faxina. */
create or replace function interno.rede_dm_talvez_faxina() returns void language plpgsql security definer set search_path = interno, pg_temp as $$
begin
  if random() < 0.02 then perform interno.rede_dm_faxina(); end if;
end $$;

/** A conversa, se quem chama participa dela. Senão, "não encontrada" (o mesmo erro para quem não participa e para o que não existe). */
create or replace function interno.rede_dm_minha(p_conversa uuid, p_eu uuid) returns interno.rede_dm_conversas language plpgsql stable security definer set search_path = interno, pg_temp as $$
declare c rede_dm_conversas;
begin
  select * into c from rede_dm_conversas where id = p_conversa and (a = p_eu or b = p_eu);
  if not found then perform interno.erro('nao_encontrado'); end if;
  return c;
end $$;

/** O outro participante. */
create or replace function interno.rede_dm_outro(c interno.rede_dm_conversas, p_eu uuid) returns uuid language sql immutable as $$
  select case when c.a = p_eu then c.b else c.a end
$$;

/** Limites do chat, por pessoa. Conta nova (menos de 3 dias) tem metade. */
create or replace function interno.rede_dm_limite(p_acao text) returns void language plpgsql security definer set search_path = interno, pg_temp as $$
declare
  v_teto integer; v_minutos integer := 60;
  v_nova boolean := exists (select 1 from auth.users u where u.id = auth.uid() and u.created_at > now() - interval '3 days');
begin
  v_teto := case p_acao when 'enviar' then 120 when 'pedir' then 20 when 'ler' then 1200 when 'chave' then 10 when 'denunciar' then 10 when 'apagar' then 200 else null end;
  if v_teto is null then perform interno.erro('acao_desconhecida'); end if;
  if p_acao in ('pedir', 'chave', 'denunciar') then v_minutos := 1440; end if;
  if v_nova and p_acao <> 'ler' then v_teto := greatest(1, v_teto / 2); end if;
  perform interno.limite('rede_dm_' || p_acao, v_teto, v_minutos);
end $$;

/** A pessoa como o chat a mostra: só codinome, @handle e rosto (nunca nome do painel nem e-mail). */
create or replace function interno.rede_dm_pessoa(p_id uuid, p_quem uuid) returns jsonb language sql stable security definer set search_path = interno, pg_temp as $$
  select jsonb_build_object('id', f.id, 'codinome', interno.rede_nome(f.id), 'handle', f.rede_handle, 'avatar', interno.rede3_perfil_imagem(f, 'avatar', p_quem))
  from perfis f where f.id = p_id
$$;

/** Uma conversa como quem chama a vê. */
create or replace function interno.rede_dm_json(c interno.rede_dm_conversas, p_eu uuid) returns jsonb language sql stable security definer set search_path = interno, pg_temp as $$
  select jsonb_build_object(
    'id', c.id,
    'com', interno.rede_dm_pessoa(interno.rede_dm_outro(c, p_eu), p_eu),
    'situacao', c.situacao,
    'pedi', c.pediu = p_eu,
    'versao', c.versao,
    'prazo_dias', c.prazo_dias,
    'ultima_em', c.ultima_em,
    'bloqueio', interno.rede_bloqueado(p_eu, interno.rede_dm_outro(c, p_eu)),
    'pode_escrever', c.situacao = 'aberta' and not interno.rede_bloqueado(p_eu, interno.rede_dm_outro(c, p_eu))
      and interno.rede2_membro(interno.rede_dm_outro(c, p_eu)),
    'nao_lidas', (select count(*)::int from rede_dm_mensagens m where m.conversa = c.id and m.autor <> p_eu and m.expira_em > now()
      and m.criado_em > coalesce(case when c.a = p_eu then c.a_leu_em else c.b_leu_em end, '-infinity'::timestamptz)))
$$;

-- ── 3. Situação, preferências e a chave ─────────────────────────────────────────────────────────────────────────────────

/** Onde estou no chat: minha chave (pública), preferências e quantas conversas têm algo novo e quantos pedidos esperam. */
create or replace function public.rede_dm_situacao() returns jsonb language plpgsql volatile security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); k rede_dm_chaves; p rede_dm_prefs;
begin
  perform interno.aberta('comunidade');
  if not interno.rede2_membro(v) then perform interno.erro('consentimento'); end if;
  perform interno.rede_dm_limite('ler');
  perform interno.rede_dm_talvez_faxina();
  select * into k from rede_dm_chaves where usuario = v;
  select * into p from rede_dm_prefs where usuario = v;
  return jsonb_build_object(
    'eu', v,
    'chave', case when k.usuario is null then null else jsonb_build_object('identidade', k.identidade, 'publica', k.publica, 'certificado', k.certificado, 'versao', k.versao) end,
    'quem_pode', coalesce(p.quem_pode, 'pedidos'),
    'prazo_dias', coalesce(p.prazo_dias, 7),
    'pedidos', (select count(*)::int from rede_dm_conversas c where c.situacao = 'pedido' and c.pediu <> v and (c.a = v or c.b = v)
      and not interno.rede_bloqueado(v, c.pediu)),
    'novas', (select count(*)::int from rede_dm_conversas c where (c.a = v or c.b = v) and c.situacao = 'aberta'
      and exists (select 1 from rede_dm_mensagens m where m.conversa = c.id and m.autor <> v and m.expira_em > now()
        and m.criado_em > coalesce(case when c.a = v then c.a_leu_em else c.b_leu_em end, '-infinity'::timestamptz))));
end $$;

/** Quem pode me chamar ('pedidos', 'seguidos', 'ninguem') e o prazo padrão (1, 7 ou 30 dias) das conversas novas. */
create or replace function public.rede_dm_prefs(p_quem_pode text, p_prazo_dias integer) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu();
begin
  perform interno.aberta('comunidade');
  if not interno.rede2_membro(v) then perform interno.erro('consentimento'); end if;
  if coalesce(p_quem_pode, '') not in ('pedidos', 'seguidos', 'ninguem') then perform interno.erro('invalido:quem_pode'); end if;
  if coalesce(p_prazo_dias, 0) not in (1, 7, 30) then perform interno.erro('invalido:prazo'); end if;
  insert into rede_dm_prefs (usuario, quem_pode, prazo_dias) values (v, p_quem_pode, p_prazo_dias)
  on conflict (usuario) do update set quem_pode = excluded.quem_pode, prazo_dias = excluded.prazo_dias;
  return jsonb_build_object('quem_pode', p_quem_pode, 'prazo_dias', p_prazo_dias);
end $$;

/**
 * Ativa o chat neste aparelho: grava a parte pública da chave do aparelho, a identidade e o certificado (a assinatura da chave
 * pela identidade). Trocar de aparelho troca a chave (versão + 1): as conversas ganham chave nova no próximo uso; o que foi
 * escrito antes fica legível só no aparelho antigo (a chave privada nunca sai de lá).
 */
create or replace function public.rede_dm_chave_publicar(p_identidade text, p_publica text, p_certificado text) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); k rede_dm_chaves;
begin
  perform interno.aberta('comunidade');
  if not interno.rede2_membro(v) then perform interno.erro('consentimento'); end if;
  if coalesce(p_identidade, '') !~ '^B[A-Za-z0-9_-]{86}$' then perform interno.erro('invalido:identidade'); end if;
  if coalesce(p_publica, '') !~ '^B[A-Za-z0-9_-]{86}$' or p_publica = p_identidade then perform interno.erro('invalido:publica'); end if;
  if coalesce(p_certificado, '') !~ '^[A-Za-z0-9_-]{86}$' then perform interno.erro('invalido:certificado'); end if;
  select * into k from rede_dm_chaves where usuario = v;
  if found and k.publica = p_publica and k.identidade = p_identidade and k.certificado = p_certificado then
    return jsonb_build_object('versao', k.versao);
  end if;
  perform interno.rede_dm_limite('chave');
  insert into rede_dm_chaves (usuario, identidade, publica, certificado) values (v, p_identidade, p_publica, p_certificado)
  on conflict (usuario) do update set identidade = excluded.identidade, publica = excluded.publica, certificado = excluded.certificado,
    versao = rede_dm_chaves.versao + 1, trocada_em = now()
  returning * into k;
  return jsonb_build_object('versao', k.versao);
end $$;

-- ── 4. Conversas: abrir, pedido, aceitar, recusar, listar ───────────────────────────────────────────────────────────────

/**
 * Abrir conversa com @handle. Se a outra pessoa segue você, abre direto. Se não segue: com "pedidos" (padrão) vira pedido; com
 * "seguidos" ou "ninguem", não abre. Bloqueio, perfil invisível, quem não é membro (18+) e recusa recente: o mesmo "fechado",
 * sem dizer qual foi o motivo (não revela nada da outra pessoa).
 */
create or replace function public.rede_dm_abrir(p_handle text) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare
  v uuid := interno.eu(); f perfis; c rede_dm_conversas; v_pode text; v_segue boolean; v_a uuid; v_b uuid; v_prazo smallint;
begin
  perform interno.aberta('comunidade');
  if not interno.rede2_membro(v) then perform interno.erro('consentimento'); end if;
  select * into f from perfis where rede_handle = lower(btrim(coalesce(p_handle, ''), ' @'));
  if not found or f.id = v then perform interno.erro('dm_fechada'); end if;
  v_a := least(v, f.id); v_b := greatest(v, f.id);
  select * into c from rede_dm_conversas where a = v_a and b = v_b;
  if found then
    if interno.rede_bloqueado(v, f.id) then perform interno.erro('dm_fechada'); end if;
    return interno.rede_dm_json(c, v);
  end if;
  if not interno.rede2_membro(f.id) or interno.rede_bloqueado(v, f.id) or f.rede_invisivel or f.rede_modo = 'invisivel'
     or exists (select 1 from rede_dm_recusas r where r.quem = f.id and r.de = v and r.ate > now()) then
    perform interno.erro('dm_fechada');
  end if;
  v_pode := coalesce((select quem_pode from rede_dm_prefs where usuario = f.id), 'pedidos');
  v_segue := exists (select 1 from rede_seguindo s where s.quem = f.id and s.segue = v and not s.pendente);
  if v_pode = 'ninguem' or (v_pode = 'seguidos' and not v_segue) then perform interno.erro('dm_fechada'); end if;
  perform interno.rede_dm_limite('pedir');
  v_prazo := coalesce((select prazo_dias from rede_dm_prefs where usuario = v), 7);
  insert into rede_dm_conversas (a, b, situacao, pediu, prazo_dias) values (v_a, v_b, case when v_segue then 'aberta' else 'pedido' end, v, v_prazo)
  returning * into c;
  return interno.rede_dm_json(c, v);
end $$;

/** Responder a um pedido de conversa: aceitar abre; recusar apaga o pedido e impede outro da mesma pessoa por 30 dias. */
create or replace function public.rede_dm_responder(p_conversa uuid, p_aceitar boolean) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); c rede_dm_conversas;
begin
  perform interno.aberta('comunidade');
  if not interno.rede2_membro(v) then perform interno.erro('consentimento'); end if;
  c := interno.rede_dm_minha(p_conversa, v);
  if c.situacao <> 'pedido' or c.pediu = v then perform interno.erro('sem_permissao'); end if;
  if coalesce(p_aceitar, false) then
    if interno.rede_bloqueado(v, c.pediu) or not interno.rede2_membro(c.pediu) then perform interno.erro('dm_fechada'); end if;
    update rede_dm_conversas set situacao = 'aberta', ultima_em = now() where id = c.id returning * into c;
    return interno.rede_dm_json(c, v);
  end if;
  insert into rede_dm_recusas (quem, de, ate) values (v, c.pediu, now() + interval '30 days')
  on conflict (quem, de) do update set ate = excluded.ate;
  delete from rede_dm_conversas where id = c.id;
  return jsonb_build_object('recusado', true);
end $$;

/** Minhas conversas e pedidos, da mais recente à mais antiga. Quem eu bloqueei (ou me bloqueou) com pedido pendente não aparece. */
create or replace function public.rede_dm_conversas() returns jsonb language plpgsql volatile security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu();
begin
  perform interno.aberta('comunidade');
  if not interno.rede2_membro(v) then perform interno.erro('consentimento'); end if;
  perform interno.rede_dm_limite('ler');
  perform interno.rede_dm_talvez_faxina();
  return coalesce((
    select jsonb_agg(interno.rede_dm_json(c, v) order by c.ultima_em desc)
    from rede_dm_conversas c
    where (c.a = v or c.b = v) and not (c.situacao = 'pedido' and interno.rede_bloqueado(v, interno.rede_dm_outro(c, v)))
  ), '[]'::jsonb);
end $$;

-- ── 5. Chaves da conversa ───────────────────────────────────────────────────────────────────────────────────────────────

/**
 * O que o aparelho precisa para cifrar e decifrar: a chave pública atual de cada participante (para conferir o certificado com
 * a identidade guardada no aparelho) e os embrulhos feitos PARA mim. Embrulho para o outro nunca sai.
 */
create or replace function public.rede_dm_chaves_da_conversa(p_conversa uuid) returns jsonb language plpgsql stable security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); c rede_dm_conversas; o uuid;
begin
  perform interno.aberta('comunidade');
  if not interno.rede2_membro(v) then perform interno.erro('consentimento'); end if;
  c := interno.rede_dm_minha(p_conversa, v);
  o := interno.rede_dm_outro(c, v);
  if c.situacao <> 'aberta' or interno.rede_bloqueado(v, o) then perform interno.erro('dm_fechada'); end if;
  return jsonb_build_object(
    'versao', c.versao,
    'versao_em', c.versao_em,
    'participantes', coalesce((select jsonb_agg(jsonb_build_object('usuario', k.usuario, 'identidade', k.identidade, 'publica', k.publica,
      'certificado', k.certificado, 'versao', k.versao)) from rede_dm_chaves k where k.usuario in (c.a, c.b)), '[]'::jsonb),
    'embrulhos', coalesce((select jsonb_agg(jsonb_build_object('versao', e.versao, 'chave_versao', e.chave_versao, 'embrulho', e.embrulho,
      'de', e.de, 'de_publica', e.de_publica, 'de_certificado', e.de_certificado) order by e.versao) from rede_dm_embrulhos e
      where e.conversa = c.id and e.para = v), '[]'::jsonb));
end $$;

/**
 * Uma versão nova da chave da conversa (a primeira, ou porque alguém trocou de aparelho, ou porque passou uma semana). Quem
 * chama embrulha no aparelho para a chave ATUAL de cada participante (os dois), com a própria chave atual. p_embrulhos:
 * [{"para": uuid, "chave_versao": n, "embrulho": "w1..."}].
 */
create or replace function public.rede_dm_nova_versao(p_conversa uuid, p_versao integer, p_embrulhos jsonb) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare
  v uuid := interno.eu(); c rede_dm_conversas; o uuid; minha rede_dm_chaves; e jsonb; k rede_dm_chaves; v_para uuid; n integer := 0;
begin
  perform interno.aberta('comunidade');
  if not interno.rede2_membro(v) then perform interno.erro('consentimento'); end if;
  select * into c from rede_dm_conversas where id = p_conversa and (a = v or b = v) for update;
  if not found then perform interno.erro('nao_encontrado'); end if;
  o := interno.rede_dm_outro(c, v);
  if c.situacao <> 'aberta' or interno.rede_bloqueado(v, o) or not interno.rede2_membro(o) then perform interno.erro('dm_fechada'); end if;
  if p_versao is distinct from c.versao + 1 then perform interno.erro('versao_desatualizada'); end if;
  select * into minha from rede_dm_chaves where usuario = v;
  if not found then perform interno.erro('dm_sem_chave'); end if;
  if jsonb_typeof(p_embrulhos) <> 'array' or jsonb_array_length(p_embrulhos) <> 2 then perform interno.erro('invalido:embrulhos'); end if;
  for e in select * from jsonb_array_elements(p_embrulhos) loop
    begin v_para := (e ->> 'para')::uuid; exception when others then perform interno.erro('invalido:embrulhos'); end;
    if v_para not in (c.a, c.b) then perform interno.erro('invalido:embrulhos'); end if;
    select * into k from rede_dm_chaves where usuario = v_para;
    if not found then perform interno.erro('dm_sem_chave'); end if;
    if (e ->> 'chave_versao')::integer is distinct from k.versao then perform interno.erro('versao_desatualizada'); end if;
    if coalesce(e ->> 'embrulho', '') !~ '^w1\.[A-Za-z0-9_-]{16}\.[A-Za-z0-9_-]{64}$' then perform interno.erro('invalido:embrulho'); end if;
    insert into rede_dm_embrulhos (conversa, versao, para, chave_versao, embrulho, de, de_publica, de_certificado)
    values (c.id, p_versao, v_para, k.versao, e ->> 'embrulho', v, minha.publica, minha.certificado);
    n := n + 1;
  end loop;
  if n <> 2 or (select count(distinct para) from rede_dm_embrulhos where conversa = c.id and versao = p_versao) <> 2 then perform interno.erro('invalido:embrulhos'); end if;
  update rede_dm_conversas set versao = p_versao, versao_em = now() where id = c.id;
  return jsonb_build_object('versao', p_versao);
end $$;

-- ── 6. Mensagens ────────────────────────────────────────────────────────────────────────────────────────────────────────

/** Envia uma mensagem já cifrada no aparelho, na versão atual da chave. O banco não aceita texto aberto. */
create or replace function public.rede_dm_enviar(p_conversa uuid, p_versao integer, p_corpo text) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); c rede_dm_conversas; o uuid; m rede_dm_mensagens;
begin
  perform interno.aberta('comunidade');
  if not interno.rede2_membro(v) then perform interno.erro('consentimento'); end if;
  c := interno.rede_dm_minha(p_conversa, v);
  o := interno.rede_dm_outro(c, v);
  if c.situacao <> 'aberta' or interno.rede_bloqueado(v, o) or not interno.rede2_membro(o) then perform interno.erro('dm_fechada'); end if;
  if c.versao < 1 or p_versao is distinct from c.versao then perform interno.erro('versao_desatualizada'); end if;
  if p_corpo is null or char_length(p_corpo) > 12000 or p_corpo !~ ('^c2\.' || p_versao || '\.[A-Za-z0-9_-]{16}\.[A-Za-z0-9_-]{23,}$') then
    perform interno.erro('invalido:corpo');
  end if;
  perform interno.rede_dm_limite('enviar');
  insert into rede_dm_mensagens (conversa, autor, versao, corpo, expira_em) values (c.id, v, p_versao, p_corpo, now() + make_interval(days => c.prazo_dias))
  returning * into m;
  update rede_dm_conversas set ultima_em = m.criado_em,
    a_leu_em = case when a = v then m.criado_em else a_leu_em end, b_leu_em = case when b = v then m.criado_em else b_leu_em end
  where id = c.id;
  perform interno.rede_dm_talvez_faxina();
  return jsonb_build_object('id', m.id, 'criado_em', m.criado_em, 'expira_em', m.expira_em);
end $$;

/** As mensagens (cifradas), das mais novas para trás; `p_antes` pagina. Marca a conversa como lida para quem chama. */
create or replace function public.rede_dm_mensagens(p_conversa uuid, p_antes timestamptz default null, p_limite integer default 50) returns jsonb language plpgsql volatile security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); c rede_dm_conversas; v_limite integer := least(greatest(coalesce(p_limite, 50), 1), 100);
begin
  perform interno.aberta('comunidade');
  if not interno.rede2_membro(v) then perform interno.erro('consentimento'); end if;
  perform interno.rede_dm_limite('ler');
  c := interno.rede_dm_minha(p_conversa, v);
  if c.situacao <> 'aberta' then perform interno.erro('dm_fechada'); end if;
  if p_antes is null then
    update rede_dm_conversas set a_leu_em = case when a = v then now() else a_leu_em end, b_leu_em = case when b = v then now() else b_leu_em end where id = c.id;
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object('id', x.id, 'autor', x.autor, 'versao', x.versao, 'corpo', x.corpo, 'criado_em', x.criado_em, 'expira_em', x.expira_em) order by x.criado_em desc)
    from (select * from rede_dm_mensagens m where m.conversa = c.id and m.expira_em > now() and (p_antes is null or m.criado_em < p_antes)
          order by m.criado_em desc limit v_limite) x
  ), '[]'::jsonb);
end $$;

/** Apaga uma mensagem minha, de verdade (some para os dois). */
create or replace function public.rede_dm_apagar_mensagem(p_id uuid) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu();
begin
  perform interno.rede_dm_limite('apagar');
  delete from rede_dm_mensagens where id = p_id and autor = v;
  if not found then perform interno.erro('nao_encontrado'); end if;
  return jsonb_build_object('ok', true);
end $$;

/** Apaga a conversa inteira, para os dois: mensagens, chaves embrulhadas, tudo (LGPD art. 18, VI). */
create or replace function public.rede_dm_apagar(p_conversa uuid) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); c rede_dm_conversas;
begin
  perform interno.rede_dm_limite('apagar');
  c := interno.rede_dm_minha(p_conversa, v);
  delete from rede_dm_conversas where id = c.id;
  return jsonb_build_object('ok', true);
end $$;

/** Prazo das mensagens desta conversa (1, 7 ou 30 dias). Encurtar vale também para o que já foi escrito; alongar, só para as novas. */
create or replace function public.rede_dm_prazo(p_conversa uuid, p_dias integer) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); c rede_dm_conversas;
begin
  perform interno.aberta('comunidade');
  if not interno.rede2_membro(v) then perform interno.erro('consentimento'); end if;
  if coalesce(p_dias, 0) not in (1, 7, 30) then perform interno.erro('invalido:prazo'); end if;
  c := interno.rede_dm_minha(p_conversa, v);
  update rede_dm_conversas set prazo_dias = p_dias where id = c.id;
  update rede_dm_mensagens set expira_em = least(expira_em, criado_em + make_interval(days => p_dias)) where conversa = c.id;
  delete from rede_dm_mensagens where conversa = c.id and expira_em <= now();
  return jsonb_build_object('prazo_dias', p_dias);
end $$;

/**
 * Denunciar a outra pessoa da conversa. `p_trechos` é o que quem denuncia escolheu mostrar, já decifrado no aparelho dela (o
 * servidor e a moderação nunca têm a chave da conversa). Vai para a fila de denúncias da Alumia como denúncia de perfil, com a
 * mesma prioridade por categoria; quem denuncia nunca é revelado. Pode bloquear junto.
 */
create or replace function public.rede_dm_denunciar(p_conversa uuid, p_categoria text, p_trechos text default '', p_bloquear boolean default false) returns jsonb
language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); c rede_dm_conversas; o uuid; d rede_denuncias; v_texto text;
begin
  perform interno.aberta('comunidade');
  if not interno.rede2_membro(v) then perform interno.erro('consentimento'); end if;
  if p_categoria is null or p_categoria not in ('menores', 'ameaca', 'exposicao', 'violencia', 'autolesao', 'odio', 'assedio', 'golpe', 'spam', 'outro') then perform interno.erro('invalido:categoria'); end if;
  c := interno.rede_dm_minha(p_conversa, v);
  o := interno.rede_dm_outro(c, v);
  v_texto := left('[Chat privado] Trechos escolhidos e decifrados por quem denunciou: ' || interno.txt(coalesce(p_trechos, ''), 'trechos', 0, 1900), 2000);
  select * into d from rede_denuncias where quem = v and alvo_tipo = 'perfil' and alvo = o::text and situacao in ('aberta', 'em_analise') limit 1;
  if not found then
    perform interno.rede_dm_limite('denunciar');
    insert into rede_denuncias (alvo_tipo, alvo, categoria, prioridade, texto, quem)
    values ('perfil', o::text, p_categoria, interno.rede2_prioridade(p_categoria), v_texto, v) returning * into d;
  end if;
  if coalesce(p_bloquear, false) then
    insert into rede_bloqueios (quem, bloqueado) values (v, o) on conflict do nothing;
    delete from rede_seguindo where (quem = v and segue = o) or (quem = o and segue = v);
  end if;
  return jsonb_build_object('protocolo', d.protocolo, 'prioridade', d.prioridade, 'bloqueado', coalesce(p_bloquear, false));
end $$;

/** Apaga tudo o que é meu no chat (chave, preferências, todas as conversas e mensagens), sem apagar a conta (LGPD art. 18, VI). */
create or replace function public.rede_dm_apagar_tudo() returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); n integer;
begin
  perform interno.rede_dm_limite('apagar');
  delete from rede_dm_conversas where a = v or b = v;
  get diagnostics n = row_count;
  delete from rede_dm_chaves where usuario = v;
  delete from rede_dm_prefs where usuario = v;
  delete from rede_dm_recusas where quem = v or de = v;
  return jsonb_build_object('conversas', n);
end $$;

-- ── 7. Permissões ───────────────────────────────────────────────────────────────────────────────────────────────────────

revoke all on function interno.rede_dm_faxina(), interno.rede_dm_talvez_faxina(), interno.rede_dm_minha(uuid, uuid),
  interno.rede_dm_outro(interno.rede_dm_conversas, uuid), interno.rede_dm_limite(text), interno.rede_dm_pessoa(uuid, uuid),
  interno.rede_dm_json(interno.rede_dm_conversas, uuid) from public;
revoke all on function public.rede_dm_situacao(), public.rede_dm_prefs(text, integer), public.rede_dm_chave_publicar(text, text, text),
  public.rede_dm_abrir(text), public.rede_dm_responder(uuid, boolean), public.rede_dm_conversas(), public.rede_dm_chaves_da_conversa(uuid),
  public.rede_dm_nova_versao(uuid, integer, jsonb), public.rede_dm_enviar(uuid, integer, text), public.rede_dm_mensagens(uuid, timestamptz, integer),
  public.rede_dm_apagar_mensagem(uuid), public.rede_dm_apagar(uuid), public.rede_dm_prazo(uuid, integer),
  public.rede_dm_denunciar(uuid, text, text, boolean), public.rede_dm_apagar_tudo() from public;
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on function interno.rede_dm_faxina(), interno.rede_dm_talvez_faxina(), interno.rede_dm_minha(uuid, uuid),
      interno.rede_dm_outro(interno.rede_dm_conversas, uuid), interno.rede_dm_limite(text), interno.rede_dm_pessoa(uuid, uuid),
      interno.rede_dm_json(interno.rede_dm_conversas, uuid) from anon, authenticated;
    revoke all on function public.rede_dm_situacao(), public.rede_dm_prefs(text, integer), public.rede_dm_chave_publicar(text, text, text),
      public.rede_dm_abrir(text), public.rede_dm_responder(uuid, boolean), public.rede_dm_conversas(), public.rede_dm_chaves_da_conversa(uuid),
      public.rede_dm_nova_versao(uuid, integer, jsonb), public.rede_dm_enviar(uuid, integer, text), public.rede_dm_mensagens(uuid, timestamptz, integer),
      public.rede_dm_apagar_mensagem(uuid), public.rede_dm_apagar(uuid), public.rede_dm_prazo(uuid, integer),
      public.rede_dm_denunciar(uuid, text, text, boolean), public.rede_dm_apagar_tudo() from anon;
    -- Só quem entrou na conta chama; visitante (anon) nunca.
    grant execute on function public.rede_dm_situacao(), public.rede_dm_prefs(text, integer), public.rede_dm_chave_publicar(text, text, text),
      public.rede_dm_abrir(text), public.rede_dm_responder(uuid, boolean), public.rede_dm_conversas(), public.rede_dm_chaves_da_conversa(uuid),
      public.rede_dm_nova_versao(uuid, integer, jsonb), public.rede_dm_enviar(uuid, integer, text), public.rede_dm_mensagens(uuid, timestamptz, integer),
      public.rede_dm_apagar_mensagem(uuid), public.rede_dm_apagar(uuid), public.rede_dm_prazo(uuid, integer),
      public.rede_dm_denunciar(uuid, text, text, boolean), public.rede_dm_apagar_tudo() to authenticated;
  end if;
end $$;
