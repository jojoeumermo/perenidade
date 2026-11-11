-- ───────────────────────────── Alumia: chat privado, mensagens em blocos (formato "c3") ─────────────────────────────
-- Migração acrescentável: pode rodar mais de uma vez, sem apagar dado nenhum. Roda DEPOIS de 20261106-t19-rede-chat-privado.sql
-- e de 20261107-t33-seguranca.sql (ela redefine três funções dessas duas; se uma delas for rodada de novo, rode esta de novo
-- em seguida). Documento: docs/rede/CHAT-PRIVADO.md. Teste: npm run testar:rede-chat.
--
-- O que muda no banco (o aparelho faz a parte da cifra: lib/rede/chat/c3.ts e lib/rede/chat/padding.ts):
--   1. Mensagem nova só no formato "c3.<versão>.<vetor>.<cifrado>", e o cifrado só em sete tamanhos fixos. Antes de cifrar, o
--      aparelho completa a mensagem até um bloco de 256, 512, 1024, 2048, 4096, 6144 ou 8192 bytes. Assim o tamanho guardado
--      não conta o tamanho do que foi escrito.
--   2. O formato antigo "c2" continua na tabela só para LEITURA, até cada mensagem vencer (no máximo 30 dias): a função de
--      enviar recusa "c2" novo.
--   3. A chave da conversa tem prazo também no banco: envio numa versão com mais de 8 dias é recusado (o aparelho troca a
--      versão aos 7; o dia a mais é folga para relógio e conversa aberta).
--   4. Faxina certa, não por sorteio: a cada envio, a cada versão nova e a cada leitura da conversa, somem as mensagens
--      vencidas daquela conversa e os embrulhos de versões antigas que não têm mais nenhuma mensagem viva.
--
-- Os tamanhos, em caracteres, da última parte do corpo "c3". O AES-GCM acrescenta 16 bytes (a marca) ao bloco, e o resultado
-- vai em base64url sem "=": n bytes viram 4 * floor(n / 3) caracteres, mais 2 se sobrar 1 byte ou 3 se sobrarem 2.
--     bloco   + marca   = bytes    caracteres
--       256   + 16      =   272         363
--       512   + 16      =   528         704
--      1024   + 16      =  1040        1387
--      2048   + 16      =  2064        2752
--      4096   + 16      =  4112        5483
--      6144   + 16      =  6160        8214
--      8192   + 16      =  8208       10944
-- O corpo inteiro é "c3." + a versão (1 a 7 algarismos) + "." + 16 caracteres do vetor + "." + o cifrado: no máximo 10972
-- caracteres, dentro do teto de 12000 que já existia. A conta está repetida em lib/rede/chat/padding.ts (TAMANHOS_DO_CIFRADO)
-- e o teste confere que as duas listas são iguais.
--
-- Nada de novo é guardado: nenhuma coluna, nenhuma tabela, nenhum registro de quem fez o quê.

-- ── 1. A tabela só aceita "c3" nos tamanhos certos (e o "c2" que já estava lá), na versão da coluna ───────────────────────

-- A regra antiga da coluna (só "c2") sai, com o nome que tiver; a nova entra com nome fixo. Rodando de novo, sai e entra a mesma.
-- A versão escrita no corpo ("c3.<versão>." ou "c2.<versão>.") tem de ser a da coluna "versao", nos dois formatos: é a coluna
-- que diz ao aparelho qual chave usar e que a faxina dos embrulhos olha, então uma linha não pode dizer uma versão na coluna e
-- outra no corpo. A regra vale também para as linhas "c2" que já estão na tabela (o envio sempre gravou as duas iguais). Se
-- alguma linha não bater, o comando falha sem mudar nada: o passo a passo em docs/rede/CHAT-PRIVADO.md diz o que fazer. A saída
-- da regra antiga e a entrada da nova são UM comando só: se a nova não entrar, a antiga não sai (a tabela nunca fica sem regra).
do $$
declare r record;
begin
  for r in select conname from pg_constraint
           where conrelid = 'interno.rede_dm_mensagens'::regclass and contype = 'c' and pg_get_constraintdef(oid) like '%c2%' loop
    execute format('alter table interno.rede_dm_mensagens drop constraint %I', r.conname);
  end loop;
  alter table interno.rede_dm_mensagens add constraint rede_dm_mensagens_corpo_formato check (
    char_length(corpo) <= 12000 and split_part(corpo, '.', 2) = versao::text and (
      (corpo ~ '^c3\.[1-9][0-9]{0,6}\.[A-Za-z0-9_-]{16}\.[A-Za-z0-9_-]+$'
        and char_length(split_part(corpo, '.', 4)) in (363, 704, 1387, 2752, 5483, 8214, 10944))
      or corpo ~ '^c2\.[1-9][0-9]{0,6}\.[A-Za-z0-9_-]{16}\.[A-Za-z0-9_-]{23,}$'
    )
  );
end $$;

-- ── 2. Auxiliares internos ──────────────────────────────────────────────────────────────────────────────────────────────

/** O corpo é um "c3" bem formado, da versão dada, num dos sete tamanhos? */
create or replace function interno.rede_dm_corpo_c3(p_corpo text, p_versao integer) returns boolean language sql immutable as $$
  select p_corpo is not null and p_versao is not null and p_versao > 0
    and char_length(p_corpo) <= 12000
    and p_corpo ~ ('^c3\.' || p_versao || '\.[A-Za-z0-9_-]{16}\.[A-Za-z0-9_-]+$')
    and char_length(split_part(p_corpo, '.', 4)) in (363, 704, 1387, 2752, 5483, 8214, 10944)
$$;

/**
 * A faxina de UMA conversa, sempre que ela é usada: as mensagens vencidas somem, e os embrulhos de versões antigas que não
 * têm mais nenhuma mensagem viva também (a versão atual fica sempre). Sem o embrulho, aquela chave antiga não pode mais ser
 * entregue a ninguém.
 */
create or replace function interno.rede_dm_faxina_da_conversa(p_conversa uuid) returns void language plpgsql security definer set search_path = interno, pg_temp as $$
begin
  delete from rede_dm_mensagens where conversa = p_conversa and expira_em <= now();
  delete from rede_dm_embrulhos e using rede_dm_conversas c
  where c.id = p_conversa and e.conversa = c.id and e.versao < c.versao
    and not exists (select 1 from rede_dm_mensagens m where m.conversa = e.conversa and m.versao = e.versao);
end $$;

-- ── 3. Enviar: só "c3", só em versão com menos de 8 dias ────────────────────────────────────────────────────────────────

/**
 * Envia uma mensagem já cifrada no aparelho, na versão atual da chave. Igual a antes, com quatro diferenças: só aceita o
 * formato "c3" num dos tamanhos fixos (texto aberto e "c2" novo são recusados), recusa versão com mais de 8 dias (o aparelho
 * faz uma versão nova e tenta de novo), trava a linha da conversa durante o envio e faz a faxina da conversa.
 */
create or replace function public.rede_dm_enviar(p_conversa uuid, p_versao integer, p_corpo text) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); c rede_dm_conversas; o uuid; m rede_dm_mensagens;
begin
  perform interno.aberta('comunidade');
  if not interno.rede2_membro(v) then perform interno.erro('consentimento'); end if;
  -- A linha da conversa fica travada até o fim do envio (como na versão nova): uma versão nova não confirma, nem apaga os
  -- embrulhos da versão conferida aqui, no meio deste envio. Sem a trava, a mensagem podia ser gravada numa versão cujos
  -- embrulhos a faxina já tinha levado, e quem ainda não tinha aberto aquela chave nunca a abriria.
  select * into c from rede_dm_conversas where id = p_conversa and (a = v or b = v) for update;
  if not found then perform interno.erro('nao_encontrado'); end if;
  o := interno.rede_dm_outro(c, v);
  if c.situacao <> 'aberta' or interno.rede_bloqueado(v, o) or not interno.rede2_membro(o) then perform interno.erro('dm_fechada'); end if;
  if c.versao < 1 or p_versao is distinct from c.versao then perform interno.erro('versao_desatualizada'); end if;
  if c.versao_em is null or c.versao_em < now() - interval '8 days' then perform interno.erro('versao_desatualizada'); end if;
  if not interno.rede_dm_corpo_c3(p_corpo, p_versao) then perform interno.erro('invalido:corpo'); end if;
  perform interno.rede_dm_limite('enviar');
  insert into rede_dm_mensagens (conversa, autor, versao, corpo, expira_em) values (c.id, v, p_versao, p_corpo, now() + make_interval(days => c.prazo_dias))
  returning * into m;
  update rede_dm_conversas set ultima_em = m.criado_em,
    a_leu_em = case when a = v then m.criado_em else a_leu_em end, b_leu_em = case when b = v then m.criado_em else b_leu_em end
  where id = c.id;
  perform interno.rede_dm_faxina_da_conversa(c.id);
  perform interno.rede_dm_talvez_faxina();
  return jsonb_build_object('id', m.id, 'criado_em', m.criado_em, 'expira_em', m.expira_em);
end $$;

-- ── 4. Versão nova e leitura: as mesmas de antes, mais a faxina da conversa ─────────────────────────────────────────────

/**
 * Uma versão nova da chave da conversa. Igual à da T33 (freio de 20 por hora e de 5 minutos); no fim, a faxina da conversa
 * apaga os embrulhos das versões antigas que já não têm mensagem viva.
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
  if c.versao > 0 and c.versao_em > now() - interval '5 minutes'
     and (select count(*) from rede_dm_embrulhos x join rede_dm_chaves kk on kk.usuario = x.para and kk.versao = x.chave_versao
          where x.conversa = c.id and x.versao = c.versao) = 2 then
    perform interno.erro('versao_desatualizada');
  end if;
  perform interno.rede_dm_limite('versao');
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
  perform interno.rede_dm_faxina_da_conversa(c.id);
  perform interno.rede_dm_talvez_faxina();
  return jsonb_build_object('versao', p_versao);
end $$;

/** As mensagens (cifradas). Igual à da T33; ao abrir a conversa (primeira página), faz também a faxina dela. */
create or replace function public.rede_dm_mensagens(p_conversa uuid, p_antes timestamptz default null, p_limite integer default 50) returns jsonb language plpgsql volatile security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); c rede_dm_conversas; v_limite integer := least(greatest(coalesce(p_limite, 50), 1), 100); v_desde timestamptz;
begin
  perform interno.aberta('comunidade');
  if not interno.rede2_membro(v) then perform interno.erro('consentimento'); end if;
  perform interno.rede_dm_limite('ler');
  c := interno.rede_dm_minha(p_conversa, v);
  if c.situacao <> 'aberta' then perform interno.erro('dm_fechada'); end if;
  v_desde := coalesce(case when c.a = v then c.a_apagou_em else c.b_apagou_em end, '-infinity'::timestamptz);
  if p_antes is null then
    update rede_dm_conversas set a_leu_em = case when a = v then now() else a_leu_em end, b_leu_em = case when b = v then now() else b_leu_em end where id = c.id;
    perform interno.rede_dm_faxina_da_conversa(c.id);
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object('id', x.id, 'autor', x.autor, 'versao', x.versao, 'corpo', x.corpo, 'criado_em', x.criado_em, 'expira_em', x.expira_em) order by x.criado_em desc)
    from (select * from rede_dm_mensagens m where m.conversa = c.id and m.expira_em > now() and m.criado_em > v_desde and (p_antes is null or m.criado_em < p_antes)
          order by m.criado_em desc limit v_limite) x
  ), '[]'::jsonb);
end $$;

-- ── 5. Permissões ───────────────────────────────────────────────────────────────────────────────────────────────────────

revoke all on function interno.rede_dm_corpo_c3(text, integer), interno.rede_dm_faxina_da_conversa(uuid) from public;
do $$
declare f record;
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on function interno.rede_dm_corpo_c3(text, integer), interno.rede_dm_faxina_da_conversa(uuid) from anon, authenticated;
  end if;
  -- As funções da API redefinidas aqui: as mesmas permissões de antes (só quem entrou na conta chama; visitante nunca).
  for f in select p.oid::regprocedure as assinatura from pg_proc p join pg_namespace n on n.oid = p.pronamespace
           where n.nspname = 'public' and p.proname in ('rede_dm_enviar', 'rede_dm_nova_versao', 'rede_dm_mensagens') loop
    execute format('revoke all on function %s from public', f.assinatura);
    if exists (select 1 from pg_roles where rolname = 'anon') then
      execute format('revoke all on function %s from anon', f.assinatura);
      execute format('grant execute on function %s to authenticated', f.assinatura);
    end if;
  end loop;
end $$;
