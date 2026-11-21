-- Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
-- Alumia · R3 · o que a R2 deixou: o chat da equipe sem autor, sem hora e sem leitura no banco (13); o certificado das folhas MLS dos
-- grupos da rede (14); a urna anônima com passe por votação (15); a versão das impressões (2.6).
--
-- (13) Chat da equipe (painel). Antes, cada mensagem cifrada ficava no banco com o autor, a hora exata, e cada pessoa com a hora em
--   que leu (lido_em), recebeu (recebido_em) e estava digitando (digitando_em): quem copiasse o banco sabia quem escreveu a quem e
--   quando, e quem leu. Agora:
--     - o autor e a hora vão DENTRO do cifrado, assinados pela identidade de quem escreve (formato "s2", lib/equipe/autoria.ts); o
--       banco guarda só o dia (criado_em e expira_em passam a date) e um número por conversa (numero), no lugar da ordem global;
--     - apagar, editar e trocar a própria reação provam a autoria com uma ficha (HMAC com uma chave tirada da identidade, que só os
--       aparelhos da pessoa têm); o banco guarda só o resumo dela (dono, SHA-256), diferente em cada mensagem;
--     - lido_em, recebido_em, digitando_em, digitando e avisado_em saem; o "lido até" fica só no aparelho (lib/equipe/lidas.ts), as
--       contagens de não lidas são feitas na hora com o que o aparelho manda (nada é gravado); confirmação de leitura, "entregue" e
--       "digitando" deixam de existir no chat da equipe;
--     - o envio não grava nada com a conta de quem escreve na mesma transação (o limite de envio passou a ser por conversa e por dia;
--       os anexos sobem com a ficha, sem autor);
--     - o aviso por e-mail de mensagem nova passa a contar por número (avisado_ate) e pela última visita ao painel, sem hora de leitura.
--   Uma vez só (a marca "r3_troca_equipe"), as mensagens cifradas de antes saem (elas não têm o autor por dentro e não abririam mais);
--   os avisos do sistema ficam (sem hora: só o dia). A R2 e a R3 vão ao ar juntas: na prática não há mensagem "m1" de antes.
--
-- Leis e princípios: LGPD art. 6º, III (necessidade: some quem escreveu, quando e quem leu) e art. 46 (segurança). Nenhuma lista de
-- pessoas nova; nenhum número abaixo de 3 mostrado; nenhum endereço de rede. As funções public.chat_* são do painel da equipe e ficam
-- fora da porta da Alumia, como as de antes (conferem interno.eu() e interno.na_conversa). Nenhuma recebe linha de tabela com valor
-- padrão. A última definição de cada função redefinida é a completa, tirada do banco montado. Pode rodar mais de uma vez.
-- Teste: scripts/testar-r3-resto-equipe.mjs.

-- ══════════════════════════════ (13) O chat da equipe sem autor, hora e leitura ══════════════════════════════

-- ── A troca, uma vez só: as mensagens cifradas de antes saem (não têm o autor por dentro) ──
do $$
begin
  if not exists (select 1 from interno.configuracoes where chave = 'r3_troca_equipe') then
    delete from interno.conversa_anexos;
    delete from interno.conversa_mensagens where tipo is distinct from 'sistema';
    insert into interno.configuracoes (chave, valor) values ('r3_troca_equipe', jsonb_build_object('dia', current_date));
  end if;
end $$;

-- ── As colunas ──
alter table interno.conversa_mensagens add column if not exists numero bigint;
alter table interno.conversa_mensagens add column if not exists dono bytea;
alter table interno.conversas add column if not exists ultimo_numero bigint not null default 0;
alter table interno.conversa_membros add column if not exists avisado_ate bigint not null default 0;

-- O número dentro da conversa, para o que ficou (os avisos do sistema), na ordem de antes; e o contador de cada conversa.
do $$
begin
  if exists (select 1 from information_schema.columns where table_schema = 'interno' and table_name = 'conversa_mensagens' and column_name = 'ordem') then
    with n as (select id, row_number() over (partition by conversa order by criado_em, ordem) as k from interno.conversa_mensagens where numero is null)
    update interno.conversa_mensagens g set numero = n.k + coalesce((select max(numero) from interno.conversa_mensagens x where x.conversa = g.conversa), 0)
    from n where n.id = g.id;
  end if;
  update interno.conversas c set ultimo_numero = coalesce((select max(numero) from interno.conversa_mensagens g where g.conversa = c.id), 0)
  where ultimo_numero < coalesce((select max(numero) from interno.conversa_mensagens g where g.conversa = c.id), 0);
end $$;

-- A ordem global (dizia a ordem das mensagens entre todas as conversas) sai; fica o número por conversa.
alter table interno.conversa_mensagens drop column if exists ordem;
alter table interno.conversa_mensagens alter column numero set not null;
create unique index if not exists conversa_mensagens_numero on interno.conversa_mensagens (conversa, numero);

-- Só o dia: a hora sai das mensagens, do prazo da autodestruição e da última movimentação da conversa.
do $$
begin
  if (select data_type from information_schema.columns where table_schema = 'interno' and table_name = 'conversa_mensagens' and column_name = 'criado_em') <> 'date' then
    alter table interno.conversa_mensagens alter column criado_em drop default;
    alter table interno.conversa_mensagens alter column criado_em type date using (criado_em at time zone 'UTC')::date;
  end if;
  if (select data_type from information_schema.columns where table_schema = 'interno' and table_name = 'conversa_mensagens' and column_name = 'expira_em') <> 'date' then
    -- Arredonda para cima: some no dia seguinte ao prazo (no aparelho, some na hora: o prazo vai dentro do cifrado).
    alter table interno.conversa_mensagens alter column expira_em type date using ((expira_em at time zone 'UTC')::date + 1);
  end if;
  if (select data_type from information_schema.columns where table_schema = 'interno' and table_name = 'conversas' and column_name = 'movida_em') <> 'date' then
    alter table interno.conversas alter column movida_em drop default;
    alter table interno.conversas alter column movida_em type date using (movida_em at time zone 'UTC')::date;
  end if;
end $$;
alter table interno.conversa_mensagens alter column criado_em set default current_date;
alter table interno.conversas alter column movida_em set default current_date;

-- O autor só nos avisos do sistema (quem entrou, quem mudou o nome do grupo: o banco escreve, não é cifrado).
update interno.conversa_mensagens set autor = null where tipo is distinct from 'sistema' and autor is not null;
alter table interno.conversa_mensagens drop constraint if exists conversa_mensagens_sem_autor;
alter table interno.conversa_mensagens add constraint conversa_mensagens_sem_autor check (tipo = 'sistema' or autor is null);
-- A ficha de dono: o SHA-256 (32 bytes), obrigatório no que é cifrado.
alter table interno.conversa_mensagens drop constraint if exists conversa_mensagens_dono;
alter table interno.conversa_mensagens add constraint conversa_mensagens_dono check (tipo = 'sistema' or (dono is not null and octet_length(dono) = 32));
create index if not exists conversa_mensagens_dono_alvo on interno.conversa_mensagens (alvo, tipo, dono) where alvo is not null;

-- Leitura, entrega e "digitando" saem do banco; o aviso por e-mail passa a contar por número.
alter table interno.conversa_membros drop column if exists lido_em;
alter table interno.conversa_membros drop column if exists recebido_em;
alter table interno.conversa_membros drop column if exists digitando_em;
alter table interno.conversa_membros drop column if exists digitando;
alter table interno.conversa_membros drop column if exists avisado_em;

-- Anexos: sobem com o resumo da ficha de dono, sem autor; presos à mensagem, ficam só com o dia.
alter table interno.conversa_anexos add column if not exists dono bytea;
alter table interno.conversa_anexos alter column autor drop not null;
update interno.conversa_anexos set autor = null where autor is not null;
alter table interno.conversa_anexos drop constraint if exists conversa_anexos_sem_autor;
alter table interno.conversa_anexos add constraint conversa_anexos_sem_autor check (autor is null and (dono is null or octet_length(dono) = 32));

-- As funções antigas que gravavam o autor, a leitura ou o "digitando" saem (as novas têm outra assinatura).
drop function if exists public.chat_enviar(uuid, text, text, uuid, uuid[]);
drop function if exists public.chat_apagar(uuid);
drop function if exists public.chat_digitando(uuid, text);
drop function if exists public.chat_recebidas(uuid);
drop function if exists public.chat_anexo_enviar(uuid, text, boolean);
drop function if exists public.chat_conversas();
drop function if exists public.presenca();

/** O resumo (SHA-256) de uma ficha de dono em base64url (43 letras), ou nulo se não for uma ficha. */
create or replace function interno.chat_resumo_da_ficha(p text) returns bytea language plpgsql immutable set search_path = interno, pg_temp as $$
begin
  if p is null or p !~ '^[A-Za-z0-9_-]{43}$' then return null; end if;
  return extensions.digest(decode(translate(p, '-_', '+/') || '=', 'base64'), 'sha256');
exception when others then
  return null;
end $$;

/** Um resumo de dono que o aparelho manda (base64url de 32 bytes), ou nulo. */
create or replace function interno.chat_dono(p text) returns bytea language plpgsql immutable set search_path = interno, pg_temp as $$
begin
  if p is null or p !~ '^[A-Za-z0-9_-]{43}$' then return null; end if;
  return decode(translate(p, '-_', '+/') || '=', 'base64');
exception when others then
  return null;
end $$;

/** O próximo número da conversa (trava a linha da conversa até o fim da transação). */
create or replace function interno.chat_proximo_numero(p_conversa uuid) returns bigint language plpgsql security definer set search_path = interno, pg_temp as $$
declare v bigint;
begin
  update conversas set ultimo_numero = ultimo_numero + 1, movida_em = current_date where id = p_conversa returning ultimo_numero into v;
  if v is null then perform interno.erro('nao_encontrado'); end if;
  return v;
end $$;

revoke all on function interno.chat_resumo_da_ficha(text), interno.chat_dono(text), interno.chat_proximo_numero(uuid) from public;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on function interno.chat_resumo_da_ficha(text), interno.chat_dono(text), interno.chat_proximo_numero(uuid) from anon, authenticated;
  end if;
end $$;

/**
 * Enviar ao chat da equipe. O aparelho escolhe o id da mensagem (vai assinado por dentro), manda o resumo da ficha de dono e, para
 * editar, a ficha da mensagem original. O banco não grava quem enviou nem a hora; nem grava nada com a conta de quem enviou nesta
 * transação (sem limite por pessoa: o limite é por conversa e por dia). Reação, voto e resposta a evento: uma por pessoa e mensagem
 * (a ficha delas é sempre a mesma para a mesma pessoa e a mesma mensagem, e a nova troca a anterior).
 */
create or replace function public.chat_enviar(p_id uuid, p_mensagem uuid, p_corpo text, p_tipo text, p_alvo uuid, p_anexos uuid[], p_dono text, p_prova text) returns jsonb
language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); v_tipo text := coalesce(p_tipo, 'texto'); v_versao integer; v_prazo integer; a conversa_mensagens; v_presos integer;
        v_dono bytea := interno.chat_dono(p_dono); v_numero bigint; v_expira date;
begin
  if not interno.na_conversa(p_id) then perform interno.erro('nao_encontrado'); end if;
  if v_tipo not in ('texto', 'reacao', 'edicao', 'voto', 'rsvp') then perform interno.erro('invalido:tipo'); end if;
  if p_mensagem is null or exists (select 1 from conversa_mensagens where id = p_mensagem) then perform interno.erro('invalido:mensagem'); end if;
  if v_dono is null then perform interno.erro('invalido:dono'); end if;
  if v_tipo = 'texto' and exists (select 1 from conversas where id = p_id and so_admins_enviam and tipo <> 'direta') and not interno.chat_admin(p_id) then perform interno.erro('so_admins'); end if;
  if interno.chat_barrado(p_id) is not null then perform interno.erro(interno.chat_barrado(p_id)); end if;
  -- O limite: por conversa e por dia (contado pelo número), sem gravar nada com a conta de quem envia.
  if (select count(*) from conversa_mensagens where conversa = p_id and criado_em = current_date) >= 3000 then perform interno.erro('limite'); end if;
  -- O banco recusa texto aberto: só entra o que já chega cifrado com a chave atual da conversa.
  v_versao := interno.chat_versao_valida(p_id, p_corpo);
  if v_tipo in ('reacao', 'edicao', 'voto', 'rsvp') then
    select * into a from conversa_mensagens where id = p_alvo and conversa = p_id and tipo = 'texto';
    if not found then perform interno.erro('nao_encontrado'); end if;
    -- Editar: só quem tem a ficha da mensagem original (os aparelhos de quem a escreveu). O prazo de 15 minutos é conferido nos
    -- aparelhos, pela hora assinada dentro do cifrado (o banco não sabe mais a hora).
    if v_tipo = 'edicao' and (a.dono is null or interno.chat_resumo_da_ficha(p_prova) is distinct from a.dono) then perform interno.erro('sem_permissao'); end if;
    if v_tipo in ('reacao', 'voto', 'rsvp') then delete from conversa_mensagens where tipo = v_tipo and alvo = p_alvo and dono = v_dono; end if;
    v_expira := a.expira_em;
  elsif p_alvo is not null then
    perform interno.erro('invalido:alvo');
  else
    select apagar_apos into v_prazo from conversas where id = p_id;
    if v_prazo is not null then v_expira := (now() + make_interval(secs => v_prazo))::date + 1; end if;
  end if;
  v_numero := interno.chat_proximo_numero(p_id);
  insert into conversa_mensagens (id, conversa, numero, corpo, versao, expira_em, tipo, alvo, dono)
  values (p_mensagem, p_id, v_numero, p_corpo, v_versao, v_expira, v_tipo, p_alvo, v_dono);
  if v_tipo = 'texto' then
    -- Mensagem nova desarquiva a conversa para quem a tinha arquivado (para todos: não diz quem enviou).
    update conversa_prefs set arquivada = false where conversa = p_id and arquivada;
  end if;
  -- Os arquivos que subiram antes ficam presos à mensagem: só os desta conversa, ainda soltos, com o mesmo resumo de dono, e todos
  -- ou nada. Presos, ficam só com o dia.
  if p_anexos is not null and cardinality(p_anexos) > 0 then
    if v_tipo <> 'texto' or cardinality(p_anexos) > 6 then perform interno.erro('invalido:anexos'); end if;
    update conversa_anexos set mensagem = p_mensagem, dono = null, criado_em = ((now() at time zone 'UTC')::date)::timestamp at time zone 'UTC'
    where id = any (p_anexos) and conversa = p_id and dono = v_dono and mensagem is null;
    get diagnostics v_presos = row_count;
    if v_presos <> cardinality(p_anexos) then perform interno.erro('invalido:anexos'); end if;
  end if;
  return jsonb_build_object('id', p_mensagem, 'numero', v_numero);
end $$;

/** Apagar uma mensagem minha: só com a ficha dela (o banco não sabe quem escreveu). As edições e reações a ela saem junto. */
create or replace function public.chat_apagar(p_id uuid, p_prova text) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); v_resumo bytea := interno.chat_resumo_da_ficha(p_prova);
begin
  perform v;
  if v_resumo is null then perform interno.erro('nao_encontrado'); end if;
  delete from conversa_mensagens where id = p_id and dono = v_resumo and tipo <> 'sistema' and interno.na_conversa(conversa);
  if not found then perform interno.erro('nao_encontrado'); end if;
  return jsonb_build_object('ok', true);
end $$;

/**
 * Subir um arquivo já cifrado no aparelho (base64 do cifrado). Fica solto até chat_enviar prendê-lo à mensagem (com o mesmo resumo
 * de dono). O banco confere só o tamanho e a quantidade; o tipo, o conteúdo e quem subiu ele não guarda.
 */
create or replace function public.chat_anexo_enviar(p_conversa uuid, p_cifrado text, p_uma_vez boolean, p_dono text) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); v_bytes bytea; v_id uuid; v_dono bytea := interno.chat_dono(p_dono);
begin
  perform v;
  if not interno.na_conversa(p_conversa) then perform interno.erro('nao_encontrado'); end if;
  if v_dono is null then perform interno.erro('invalido:dono'); end if;
  if coalesce(p_cifrado, '') !~ '^[A-Za-z0-9+/=\s]{24,}$' or char_length(p_cifrado) > 16800000 then perform interno.erro('invalido:arquivo'); end if;
  v_bytes := decode(regexp_replace(p_cifrado, '\s', '', 'g'), 'base64');
  if length(v_bytes) > 12582912 + 16 then perform interno.erro('invalido:tamanho'); end if;
  -- O limite é por conversa (soltos ao mesmo tempo), sem gravar nada com a conta de quem sobe.
  if (select count(*) from conversa_anexos where conversa = p_conversa and mensagem is null) >= 60 then perform interno.erro('invalido:anexos'); end if;
  insert into conversa_anexos (conversa, autor, dono, cifrado, tamanho, uma_vez) values (p_conversa, null, v_dono, v_bytes, length(v_bytes), coalesce(p_uma_vez, false)) returning id into v_id;
  return jsonb_build_object('id', v_id);
end $$;

/**
 * Baixar o cifrado de um arquivo de uma conversa em que estou. "Ver uma vez": cada pessoa lê uma só vez (visto_por guarda quem já
 * abriu esse arquivo, porque é preciso para cumprir o "uma vez"); quando todos menos um (quem enviou, que o banco não sabe quem é)
 * leram, ou a mensagem some, os bytes vão embora.
 */
create or replace function public.chat_anexo_ler(p_id uuid) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); a conversa_anexos; v_membros integer;
begin
  select * into a from conversa_anexos where id = p_id;
  if not found or a.mensagem is null or not interno.na_conversa(a.conversa) then perform interno.erro('nao_encontrado'); end if;
  perform interno.limite('anexo_ler', 600, 60);
  if a.uma_vez then
    if v = any (a.visto_por) or a.cifrado is null then perform interno.erro('ja_visto'); end if;
    update conversa_anexos set visto_por = array_append(visto_por, v) where id = p_id;
    select count(*) into v_membros from conversa_membros m where m.conversa = a.conversa;
    if cardinality(a.visto_por) + 1 >= v_membros - 1 then update conversa_anexos set cifrado = null where id = p_id; end if;
  end if;
  return jsonb_build_object('cifrado', encode(a.cifrado, 'base64'), 'uma_vez', a.uma_vez);
end $$;

/** O "lido até" que o aparelho manda: {conversa: número}. Nada disso é gravado; serve só para contar agora. */
create or replace function interno.chat_lido_ate(p_lidos jsonb, p_conversa uuid) returns bigint language plpgsql immutable set search_path = interno, pg_temp as $$
begin
  if p_lidos is null or jsonb_typeof(p_lidos) <> 'object' then return 0; end if;
  return greatest(coalesce((p_lidos ->> p_conversa::text)::bigint, 0), 0);
exception when others then
  return 0;
end $$;
revoke all on function interno.chat_lido_ate(jsonb, uuid) from public;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then revoke all on function interno.chat_lido_ate(jsonb, uuid) from anon, authenticated; end if;
end $$;

/**
 * A lista de conversas. As não lidas são contadas com o "lido até" que este aparelho guarda (p_lidos; nada é gravado). A última
 * mensagem vai cifrada (quem escreveu e a hora estão dentro); a ordem por dia de movimento (o aparelho reordena pela hora de dentro).
 */
create or replace function public.chat_conversas(p_lidos jsonb) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); v_mostro boolean := coalesce((select chat_visto from perfis where id = v), true);
begin
  if not interno.voluntario() then perform interno.erro('sem_permissao'); end if;
  update perfis set visto_em = now() where id = v and visto_em < now() - interval '30 seconds';
  -- Nada fica guardado por mais de trinta dias, e o que saiu com autodestruição some no prazo (no dia seguinte, no banco).
  delete from conversa_mensagens where criado_em < current_date - 30 or expira_em <= current_date;
  return (
    select coalesce(jsonb_agg(jsonb_build_object(
      'id', c.id, 'tipo', c.tipo, 'departamento', c.departamento, 'dona', coalesce(c.criada_por = v, false) or interno.coord() or coalesce(m.admin, false),
      'fixada', coalesce(p.fixada, false), 'arquivada', coalesce(p.arquivada, false), 'trancada', coalesce(p.trancada, false),
      'fechada', interno.chat_barrado(c.id) is not null,
      'silenciada', coalesce(p.silenciada_ate > now(), false), 'marcada_nao_lida', coalesce(p.nao_lida, false),
      'descricao', c.descricao,
      'foto', (select jsonb_build_object('id', g.id, 'corpo', g.corpo, 'numero', g.numero, 'dia', g.criado_em) from conversa_mensagens g where g.id = c.foto),
      'nome', case when c.tipo = 'direta' then coalesce(interno.nome_visto(o.nome), 'Alguém que saiu da equipe') else c.nome end,
      'outro', case when c.tipo = 'direta' then o.id end,
      -- O "visto por último" só aparece se os dois mostram o próprio.
      'online', case when c.tipo = 'direta' and o.mostra and v_mostro then coalesce(o.visto_em > now() - interval '2 minutes', false) end,
      'visto_em', case when c.tipo = 'direta' and o.mostra and v_mostro then o.visto_em end,
      'membros', (select count(*) from conversa_membros x where x.conversa = c.id),
      'apagar_apos', c.apagar_apos,
      'ultima', (select jsonb_build_object('id', g.id, 'corpo', g.corpo, 'numero', g.numero, 'dia', g.criado_em, 'versao', g.versao)
                 from conversa_mensagens g where g.conversa = c.id and g.tipo = 'texto' order by g.numero desc limit 1),
      'nao_lidas', (select count(*) from conversa_mensagens g where g.conversa = c.id and g.tipo = 'texto' and g.numero > interno.chat_lido_ate(p_lidos, c.id)),
      'ultimo_numero', c.ultimo_numero,
      'movida_em', c.movida_em) order by coalesce(p.fixada, false) desc, c.movida_em desc, c.ultimo_numero desc), '[]'::jsonb)
    from conversa_membros m
    join conversas c on c.id = m.conversa
    left join conversa_prefs p on p.conversa = c.id and p.usuario = v
    left join lateral (select f.id, f.nome, f.visto_em, f.chat_visto as mostra from conversa_membros x join perfis f on f.id = x.usuario
                       where x.conversa = c.id and x.usuario <> v and c.tipo = 'direta' limit 1) o on true
    where m.usuario = v);
end $$;

/** O painel diz que a pessoa está por aqui e pergunta quantas conversas têm mensagem nova (pelo "lido até" do aparelho, sem gravar). */
create or replace function public.presenca(p_lidos jsonb) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu();
begin
  update perfis set visto_em = now() where id = v and visto_em < now() - interval '30 seconds';
  delete from conversa_mensagens where expira_em <= current_date;
  return jsonb_build_object('conversas', case when interno.voluntario() then (
    select count(*) from conversa_membros m left join conversa_prefs p on p.conversa = m.conversa and p.usuario = v
    where m.usuario = v and not coalesce(p.arquivada, false) and not coalesce(p.silenciada_ate > now(), false)
      and (coalesce(p.nao_lida, false) or exists (select 1 from conversa_mensagens g where g.conversa = m.conversa and g.tipo = 'texto' and g.numero > interno.chat_lido_ate(p_lidos, m.conversa)))) else 0 end);
end $$;

/** Abrir uma conversa: quem está nela, as fixadas, as minhas favoritas e as mensagens (sem autor nem hora: estão dentro do cifrado). */
create or replace function public.chat_ver(p_id uuid) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); c conversas; v_mostro boolean := true;
begin
  if not interno.na_conversa(p_id) then perform interno.erro('nao_encontrado'); end if;
  select * into c from conversas where id = p_id;
  select chat_visto into v_mostro from perfis where id = v;
  delete from conversa_mensagens where conversa = p_id and expira_em <= current_date;
  update conversa_prefs set nao_lida = false where conversa = p_id and usuario = v and nao_lida;
  update perfis set visto_em = now() where id = v and visto_em < now() - interval '30 seconds';
  return jsonb_build_object(
    'id', c.id, 'tipo', c.tipo, 'departamento', c.departamento, 'nome', c.nome, 'descricao', c.descricao, 'foto', c.foto,
    'so_admins_enviam', c.so_admins_enviam, 'so_admins_mudam', c.so_admins_mudam,
    'admin', c.tipo in ('grupo', 'departamento') and interno.chat_admin(p_id),
    'posso_enviar', (c.tipo = 'direta' or not c.so_admins_enviam or interno.chat_admin(p_id)) and interno.chat_barrado(p_id) is null,
    'barrado', interno.chat_barrado(p_id), 'motivo_do_fechamento', interno.chat_controle() ->> 'motivo',
    'dona', coalesce(c.criada_por = v, false) or (c.tipo = 'grupo' and interno.chat_admin(p_id)),
    'apagar_apos', c.apagar_apos, 'apagar_desde', c.apagar_desde, 'apagar_por', coalesce((select nome from perfis where id = c.apagar_por), ''),
    -- Visto por último só aparece entre quem mostra o próprio. Leitura, entrega e "digitando" não existem mais no banco.
    'membros', (select coalesce(jsonb_agg(jsonb_build_object('id', f.id, 'nome', interno.nome_visto(f.nome), 'avatar', f.avatar, 'eu', f.id = v,
                  'online', case when f.id = v or (f.chat_visto and v_mostro) then f.visto_em > now() - interval '2 minutes' end,
                  'visto_em', case when f.id = v or (f.chat_visto and v_mostro) then f.visto_em end,
                  'admin', m.admin) order by f.nome), '[]'::jsonb)
                from conversa_membros m join perfis f on f.id = m.usuario where m.conversa = p_id),
    'fixadas', coalesce((select jsonb_agg(x.mensagem order by x.criado_em) from conversa_fixadas x where x.conversa = p_id), '[]'::jsonb),
    'favoritas', coalesce((select jsonb_agg(x.mensagem) from conversa_favoritas x join conversa_mensagens g on g.id = x.mensagem where x.usuario = v and g.conversa = p_id), '[]'::jsonb),
    'mensagens', (select coalesce(jsonb_agg(x.j order by x.numero), '[]'::jsonb) from (
                    select g.numero, jsonb_build_object('id', g.id, 'numero', g.numero, 'dia', g.criado_em, 'corpo', g.corpo, 'expira_em', g.expira_em, 'tipo', g.tipo,
                                                       'alvo', g.alvo, 'detalhe', g.detalhe,
                                                       -- Só nos avisos do sistema (não cifrados) o banco sabe quem fez.
                                                       'autor', case when g.tipo = 'sistema' then g.autor end,
                                                       'anexos', (select coalesce(jsonb_agg(jsonb_build_object('id', n.id, 'uma_vez', n.uma_vez, 'aberto', v = any (n.visto_por), 'disponivel', n.cifrado is not null)), '[]'::jsonb)
                                                                  from conversa_anexos n where n.mensagem = g.id)) as j
                    from conversa_mensagens g where g.conversa = p_id order by g.numero desc limit 400) x));
end $$;

/** Marcar a conversa (fixar, arquivar, silenciar, marcar como não lida, trancar). "Não lida" é uma marca minha, sem hora de leitura. */
create or replace function public.chat_conversa_marcar(p_id uuid, p_fixar boolean default null::boolean, p_arquivar boolean default null::boolean, p_silenciar_horas integer default null::integer, p_nao_lida boolean default null::boolean, p_trancar boolean default null::boolean) returns jsonb
language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu();
begin
  if not interno.na_conversa(p_id) then perform interno.erro('nao_encontrado'); end if;
  if p_silenciar_horas is not null and p_silenciar_horas not in (0, 8, 168, 876000) then perform interno.erro('invalido:horas'); end if;
  insert into conversa_prefs (usuario, conversa) values (v, p_id) on conflict do nothing;
  update conversa_prefs set
    fixada = coalesce(p_fixar, fixada),
    arquivada = coalesce(p_arquivar, arquivada),
    silenciada_ate = case when p_silenciar_horas is null then silenciada_ate when p_silenciar_horas = 0 then null else now() + make_interval(hours => p_silenciar_horas) end,
    nao_lida = coalesce(p_nao_lida, nao_lida),
    trancada = coalesce(p_trancar, trancada)
  where usuario = v and conversa = p_id;
  return jsonb_build_object('ok', true);
end $$;

/** As minhas favoritas (cifradas como estão; quem escreveu e a hora estão dentro). */
create or replace function public.chat_favoritas() returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu();
begin
  return (select coalesce(jsonb_agg(jsonb_build_object('id', g.id, 'conversa', g.conversa, 'conversa_nome', case when c.tipo = 'direta' then coalesce((select interno.nome_visto(p.nome) from conversa_membros x join perfis p on p.id = x.usuario where x.conversa = c.id and x.usuario <> v limit 1), '') else c.nome end,
            'corpo', g.corpo, 'numero', g.numero, 'dia', g.criado_em, 'versao', g.versao) order by x.criado_em desc), '[]'::jsonb)
          from conversa_favoritas x join conversa_mensagens g on g.id = x.mensagem join conversas c on c.id = g.conversa
          where x.usuario = v and interno.na_conversa(g.conversa));
end $$;

/** Aviso do sistema numa conversa (não cifrado: quem fez o quê). Fica só com o dia e o número da conversa. */
create or replace function interno.chat_aviso(p_conversa uuid, p_evento text, p_alvo uuid default null::uuid, p_texto text default null::text) returns void
language plpgsql security definer set search_path = interno, pg_temp as $$
begin
  insert into conversa_mensagens (conversa, numero, autor, corpo, versao, tipo, detalhe)
  values (p_conversa, interno.chat_proximo_numero(p_conversa), auth.uid(), 'sistema', 0, 'sistema',
          jsonb_build_object('evento', p_evento, 'por', coalesce((select interno.primeiro_nome(nome) from perfis where id = auth.uid()), ''), 'alvo', p_alvo,
                             'alvo_nome', coalesce((select interno.primeiro_nome(nome) from perfis where id = p_alvo), ''), 'texto', left(coalesce(p_texto, ''), 120)));
end $$;

/**
 * O aviso por e-mail de mensagens novas da equipe. Sem hora de leitura: conta as mensagens de número maior que o último aviso
 * (avisado_ate), de dias DEPOIS da última visita da pessoa ao painel (quem passou pelo painel no dia não recebe), em grupos de
 * departamento e em conversas privadas com a coordenação. O banco não sabe quem escreveu: não diz "de quem".
 */
create or replace function interno.chat_emails() returns void language plpgsql security definer set search_path = interno, pg_temp as $$
declare r record; v_linhas text; v_total integer;
begin
  for r in
    select m.usuario, u.email, interno.primeiro_nome(f.nome) as nome, f.visto_em
    from conversa_membros m join perfis f on f.id = m.usuario join auth.users u on u.id = m.usuario
    where not f.suspenso and coalesce(u.email, '') <> ''
      and exists (select 1 from papeis p where p.usuario = m.usuario)
    group by m.usuario, u.email, f.nome, f.visto_em
  loop
    with pendentes as (
      select c.id, c.tipo, c.nome, count(*) as n, max(x.numero) as ultimo
      from conversa_membros m join conversas c on c.id = m.conversa
      join conversa_mensagens x on x.conversa = c.id
      where m.usuario = r.usuario and x.tipo = 'texto' and x.numero > m.avisado_ate
        and x.criado_em > coalesce((r.visto_em at time zone 'UTC')::date, '-infinity'::date)
        and x.criado_em < current_date and x.criado_em > current_date - 3
        and (c.tipo = 'departamento'
             or (c.tipo = 'direta' and exists (select 1 from conversa_membros y join papeis p on p.usuario = y.usuario
                                               where y.conversa = c.id and y.usuario <> r.usuario and p.papel in ('coordenacao', 'vice'))))
      group by c.id, c.tipo, c.nome
    )
    select string_agg('• ' || case when tipo = 'departamento' then 'Grupo ' || nome else 'Conversa com a coordenação' end
                      || ': ' || n || case when n = 1 then ' mensagem nova' else ' mensagens novas' end, E'\n' order by nome),
           sum(n)
    into v_linhas, v_total from pendentes;
    if v_total is null then continue; end if;
    perform interno.email(r.email, 'chat_mensagem',
      case when v_total = 1 then 'Você tem 1 mensagem nova da equipe' else 'Você tem ' || v_total || ' mensagens novas da equipe' end,
      'Olá, ' || coalesce(nullif(r.nome, ''), 'tudo bem') || E'.\n\nChegaram mensagens nas Conversas do painel desde a sua última visita:\n\n' || v_linhas
      || E'\n\nAbra o painel para ler (as mensagens são cifradas e só aparecem lá):\n\n' || interno.endereco() || E'/pt/painel\n\nPara não receber estes avisos, desligue em Minha conta › E-mails.', '', 6);
    update conversa_membros m set avisado_ate = c.ultimo_numero
    from conversas c where c.id = m.conversa and m.usuario = r.usuario and m.avisado_ate < c.ultimo_numero;
  end loop;
end $$;

grant execute on function public.chat_enviar(uuid, uuid, text, text, uuid, uuid[], text, text), public.chat_apagar(uuid, text),
  public.chat_anexo_enviar(uuid, text, boolean, text), public.chat_conversas(jsonb), public.presenca(jsonb) to authenticated;
revoke execute on function public.chat_enviar(uuid, uuid, text, text, uuid, uuid[], text, text), public.chat_apagar(uuid, text),
  public.chat_anexo_enviar(uuid, text, boolean, text), public.chat_conversas(jsonb), public.presenca(jsonb) from anon;

-- ══════════════════════════════ (14) O certificado das folhas MLS dos grupos da rede ══════════════════════════════
-- Antes, a folha (um aparelho de uma conta) entrava no grupo só com o nome dela: o servidor podia listar um aparelho-fantasma de uma
-- conta do grupo, com uma chave dele, e os aparelhos o punham no grupo ("confiar na primeira vez", só com aviso). Agora cada folha
-- leva um certificado (96 bytes: a identidade da conta e a assinatura dela sobre a conta, o nome da folha e a impressão da chave da
-- folha; lib/rede/grupos/certificado.ts). O banco só transporta (não confere Ed25519): quem põe alguém no grupo confere a assinatura
-- e que a identidade é a do registro público de chaves. As folhas de antes, sem certificado, saem (com os pacotes, as boas-vindas e
-- os pedidos de reentrada delas): cada aparelho publica de novo, com certificado, na próxima vez que abrir um grupo.
alter table interno.rede_grupo_folhas add column if not exists certificado bytea;
delete from interno.rede_grupo_folhas where certificado is null or octet_length(certificado) <> 96;
alter table interno.rede_grupo_folhas alter column certificado set not null;
alter table interno.rede_grupo_folhas drop constraint if exists rede_grupo_folhas_certificado;
alter table interno.rede_grupo_folhas add constraint rede_grupo_folhas_certificado check (octet_length(certificado) = 96);

drop function if exists public.rede_mls_publicar(text, text[]);

/**
 * Publica a folha deste aparelho com o certificado (base64 de 96 bytes, assinado pela identidade da conta) e pacotes de chave dela
 * (até 20 guardados por folha; os que passarem são ignorados). A conta tem até 5 folhas: a 6ª tira a mais antiga. O certificado novo
 * troca o de antes (a identidade da conta pode ter mudado). Devolve quantos pacotes a folha tem.
 */
create or replace function public.rede_mls_publicar(p_nome text, p_pacotes text[], p_certificado text) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); x text; n integer; v_cert bytea;
begin
  perform interno.aberta('comunidade');
  if not interno.rede2_membro(v) then perform interno.erro('consentimento'); end if;
  perform interno.limite('rede_mls_pacotes', 30, 60);
  if coalesce(p_nome, '') !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}:[0-9a-f]{1,16}@alumia[.]invalid$'
     or split_part(p_nome, ':', 1)::uuid is distinct from v then
    perform interno.erro('invalido:nome');
  end if;
  begin
    v_cert := case when coalesce(p_certificado, '') ~ '^[A-Za-z0-9+/]+={0,2}$' then decode(p_certificado, 'base64') end;
  exception when others then
    v_cert := null;
  end;
  if octet_length(v_cert) is distinct from 96 then perform interno.erro('invalido:certificado'); end if;
  if coalesce(array_length(p_pacotes, 1), 0) > 20 then perform interno.erro('invalido:pacotes'); end if;
  insert into rede_grupo_folhas (nome, usuario, certificado) values (p_nome, v, v_cert)
  on conflict (nome) do update set dia = current_date, certificado = excluded.certificado;
  delete from rede_grupo_folhas where nome in (
    select f.nome from rede_grupo_folhas f where f.usuario = v order by (f.nome = p_nome) desc, f.dia desc, f.nome offset 5);
  foreach x in array coalesce(p_pacotes, '{}') loop
    if x !~ '^[A-Za-z0-9+/]+={0,2}$' or char_length(x) > 8000 then perform interno.erro('invalido:pacote'); end if;
    if (select count(*) from rede_grupo_pacotes where nome = p_nome) >= 20 then exit; end if;
    insert into rede_grupo_pacotes (nome, pacote) values (p_nome, x);
  end loop;
  select count(*) into n from rede_grupo_pacotes where nome = p_nome;
  return jsonb_build_object('pacotes', n);
end $$;

/** Quantos pacotes desta folha ainda estão guardados e o certificado dela (o aparelho repõe quando fica pouco ou a identidade mudou). */
create or replace function public.rede_mls_meus_pacotes(p_nome text) returns jsonb language plpgsql stable security definer set search_path = interno, pg_temp as $$
begin
  perform interno.aberta('comunidade');
  return jsonb_build_object(
    'pacotes', (select count(*) from rede_grupo_pacotes p join rede_grupo_folhas f on f.nome = p.nome where p.nome = p_nome and f.usuario = interno.eu()),
    'certificado', (select interno.caixa_b64(f.certificado) from rede_grupo_folhas f where f.nome = p_nome and f.usuario = interno.eu()));
end $$;

/**
 * O estado do grupo para quem é membro: a época atual, as contas e as folhas delas (com o certificado de cada uma), os commits depois
 * de `p_desde` (até 200) e as boas-vindas mais novas feitas para a folha `p_nome` (que tem de ser desta conta). Quem não é membro
 * recebe "nao_encontrado".
 */
create or replace function public.rede_mls_estado(p_grupo text, p_nome text, p_desde integer) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu();
begin
  perform interno.aberta('comunidade');
  if not interno.rede_grupo_membro(p_grupo, v) then perform interno.erro('nao_encontrado'); end if;
  perform interno.limite('rede_grupo_ler', 600, 60);
  delete from rede_grupo_boasvindas where dia < current_date - 30;
  delete from rede_grupo_reentrar where dia < current_date - 30;
  return jsonb_build_object(
    'epoca', (select max(epoca) from rede_grupo_commits where grupo = p_grupo),
    'membros', coalesce((select jsonb_agg(u order by u) from interno.rede_grupo_membros(p_grupo) u), '[]'::jsonb),
    'folhas', coalesce((select jsonb_agg(f.nome order by f.nome) from rede_grupo_folhas f where f.usuario in (select interno.rede_grupo_membros(p_grupo))), '[]'::jsonb),
    -- O certificado de cada folha (onda R3): quem põe a folha no grupo confere a assinatura e a identidade no registro público.
    'certificados', coalesce((select jsonb_object_agg(f.nome, interno.caixa_b64(f.certificado)) from rede_grupo_folhas f where f.usuario in (select interno.rede_grupo_membros(p_grupo))), '{}'::jsonb),
    'commits', coalesce((select jsonb_agg(jsonb_build_object('epoca', c.epoca, 'commit', c.commit) order by c.epoca)
      from (select * from rede_grupo_commits where grupo = p_grupo and epoca > coalesce(p_desde, 0) order by epoca limit 200) c), '[]'::jsonb),
    'boasvindas', (select jsonb_build_object('epoca', b.epoca, 'welcome', b.welcome) from rede_grupo_boasvindas b
      join rede_grupo_folhas f on f.nome = b.para and f.usuario = v
      where b.grupo = p_grupo and b.para = p_nome order by b.epoca desc limit 1),
    -- As folhas de membros que pediram para entrar de novo (rede_mls_reentrar): quem as tiver na árvore tira e põe de novo.
    'reentrar', coalesce((select jsonb_agg(r.nome order by r.nome) from rede_grupo_reentrar r join rede_grupo_folhas f on f.nome = r.nome
      where r.grupo = p_grupo and f.usuario in (select interno.rede_grupo_membros(p_grupo))), '[]'::jsonb));
end $$;

do $$
declare f record;
begin
  for f in select p.oid::regprocedure as assinatura from pg_proc p join pg_namespace n on n.oid = p.pronamespace
           where n.nspname = 'public' and p.proname in ('rede_mls_publicar', 'rede_mls_meus_pacotes', 'rede_mls_estado') loop
    execute format('revoke all on function %s from public', f.assinatura);
    if exists (select 1 from pg_roles where rolname = 'anon') then
      execute format('revoke all on function %s from anon', f.assinatura);
      execute format('grant execute on function %s to authenticated', f.assinatura);
    end if;
  end loop;
end $$;


-- ══════════════════════════════ (15) A urna anônima: a cédula por rota sem sessão, com passe por votação ══════════════════════════════
-- Antes (R2), a cédula cifrada entrava pela função COM a sessão de quem votava, na mesma transação da linha de "já votou": quem tivesse
-- o banco (a ordem das transações, o xmin, a replicação) ligava a pessoa à cédula. Agora são dois momentos separados:
--   1. COM a sessão, cedo (ao abrir a votação): a conta pega UM passe cego da urna desta votação (Privacy Pass, RSA cego, com o
--      contexto da votação; lib/rede/passes/**). Nessa mesma transação, a conta fica marcada como "já pegou a cédula"
--      (interno.voto_cedula_tomada, chamada pela emissão do passe da urna);
--   2. SEM sessão, depois: a cédula vai pela rota anônima (app/api/alumia/urna/depositar) com o passe; o servidor confere o passe só com
--      a chave pública e chama public.rede_urna_depositar_anonimo (só o serviço). O passe é gasto (interno.passes_gastos: repetido,
--      recusado) e a cédula entra na urna no mesmo INSERT em que até 2000 cédulas de antes são regravadas, em ordem sorteada (o xmin e
--      a posição no disco não dizem qual chegou agora).
-- As funções com sessão que recebiam a cédula deixam de receber ("voto_anonimo"). Quem tem o banco vê quem pegou cédula (como via
-- quem votou) e as cédulas cifradas, sem ligação entre os dois. O voto secreto da equipe: o "já pegou" é a marca da emissão do passe
-- (sem a pessoa, como a marca de "já votou" da R2); o banco conta só quantas cédulas saíram de cada votação (sem ninguém).

/** Quantas cédulas da urna anônima saíram de cada votação secreta da equipe: só o número, sem ninguém. */
create table if not exists interno.votacao_cedulas_emitidas (
  votacao uuid primary key references interno.votacoes (id) on delete cascade,
  n integer not null default 0 check (n >= 0)
);
alter table interno.votacao_cedulas_emitidas enable row level security;
revoke all on interno.votacao_cedulas_emitidas from public;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then revoke all on interno.votacao_cedulas_emitidas from anon, authenticated; end if;
end $$;

/**
 * A conta `p_quem` pegou o passe da urna desta votação (chamada pela emissão do passe com contexto, na mesma transação). Consulta e
 * votação da comunidade: a linha de "já votou" de sempre (a conta, sem a cédula). Equipe: só o contador da votação (sem a pessoa).
 * Devolve false se a conta já tinha pego (consulta e comunidade).
 */
create or replace function interno.voto_cedula_tomada(p_tipo text, p_alvo uuid, p_quem uuid) returns boolean language plpgsql security definer set search_path = interno, pg_temp as $$
declare n integer;
begin
  if p_alvo is null or p_quem is null then return false; end if;
  if p_tipo = 'consulta' then
    insert into rede_consulta_votantes (consulta, usuario) values (p_alvo, p_quem) on conflict do nothing;
  elsif p_tipo = 'decisao' then
    insert into alumia_decisao_votantes (decisao, usuario) values (p_alvo, p_quem) on conflict do nothing;
  elsif p_tipo = 'equipe' then
    insert into votacao_cedulas_emitidas (votacao, n) values (p_alvo, 1) on conflict (votacao) do update set n = votacao_cedulas_emitidas.n + 1;
  else
    return false;
  end if;
  get diagnostics n = row_count;
  return n = 1;
end $$;
revoke all on function interno.voto_cedula_tomada(text, uuid, uuid) from public;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then revoke all on function interno.voto_cedula_tomada(text, uuid, uuid) from anon, authenticated; end if;
end $$;

/**
 * O depósito anônimo (só o serviço: a rota app/api/alumia/urna/depositar, que recusa pedido com sessão e já conferiu o passe com a
 * chave pública da urna desta votação). `p_passe_resumo`: o resumo do passe (32 bytes), gasto aqui; repetido, "passe_usado". A
 * cédula entra na urna da votação no mesmo INSERT que regrava até 2000 de antes, em ordem sorteada. Nada da conta: o serviço não sabe
 * de quem é.
 */
create or replace function public.rede_urna_depositar_anonimo(p_tipo text, p_alvo uuid, p_cedula text, p_passe_resumo bytea) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
begin
  if not interno.servico() then perform interno.erro('sem_permissao'); end if;
  if p_tipo is null or p_tipo not in ('consulta', 'decisao', 'equipe') or p_alvo is null then perform interno.erro('invalido:tipo'); end if;
  if not interno.voto_cedula_valida(p_cedula) then perform interno.erro('invalido:cedula'); end if;
  if octet_length(p_passe_resumo) is distinct from 32 then perform interno.erro('invalido:passe'); end if;
  if coalesce(interno.voto_situacao(p_tipo, p_alvo), '') <> 'aberta' then perform interno.erro('encerrada'); end if;
  if not exists (select 1 from rede_consulta_chaves k where k.consulta = p_alvo and k.tipo = p_tipo) then perform interno.erro('sem_chave'); end if;
  perform pg_advisory_xact_lock(hashtextextended('alumia_urna_anonima:' || p_alvo::text, 0));
  if not interno.caixa_gastar(p_passe_resumo) then perform interno.erro('passe_usado'); end if;
  if p_tipo = 'consulta' then
    perform interno.alumia_urna_cifrada(p_alvo, p_cedula);
  elsif p_tipo = 'decisao' then
    perform interno.alumia_dec_urna_cifrada(p_alvo, p_cedula);
  else
    perform interno.votacao_urna_cifrada(p_alvo, p_cedula);
  end if;
  return jsonb_build_object('ok', true);
end $$;
revoke all on function public.rede_urna_depositar_anonimo(text, uuid, text, bytea) from public;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then revoke all on function public.rede_urna_depositar_anonimo(text, uuid, text, bytea) from anon, authenticated; end if;
  if exists (select 1 from pg_roles where rolname = 'service_role') then grant execute on function public.rede_urna_depositar_anonimo(text, uuid, text, bytea) to service_role; end if;
end $$;

-- As funções com sessão deixam de receber a cédula (a cédula vai só pela rota anônima). As assinaturas ficam (o site de antes recebe
-- "voto_anonimo" e a tela pede para recarregar).
CREATE OR REPLACE FUNCTION public.rede_org_consulta_votar_cifrada(p_consulta uuid, p_cedula text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'interno', 'pg_temp'
AS $function$
begin
  -- Onda R3: a cédula vai pela urna anônima (app/api/alumia/urna/depositar), sem a sessão; aqui, com a sessão, não entra mais.
  perform interno.erro('voto_anonimo');
  return null;
end
$function$;

CREATE OR REPLACE FUNCTION public.alumia_decisao_votar_cifrada(p_id uuid, p_cedula text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'interno', 'pg_temp'
AS $function$
begin
  -- Onda R3: a cédula vai pela urna anônima (app/api/alumia/urna/depositar), sem a sessão; aqui, com a sessão, não entra mais.
  perform interno.erro('voto_anonimo');
  return null;
end
$function$;

create or replace function public.alumia_voto_equipe_cifrada(p_usuario uuid, p_votacao uuid, p_cedula text, p_marca text) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
begin
  -- Onda R3: a cédula vai pela urna anônima (app/api/alumia/urna/depositar); o servidor do site não a recebe mais com a sessão.
  perform interno.erro('voto_anonimo');
  return null;
end $$;

/**
 * Para a abridora: as partes repassadas e as cédulas cifradas, só com K partes ou mais (antes disso, só quantas chegaram), e as
 * opções (para a tela conferir as escolhas antes de mandar). "votantes": quantas cédulas foram entregues (quem pegou o passe da urna;
 * na equipe, o contador da votação, mais as marcas de antes da onda R3): a abridora confere que não há mais cédulas que isso.
 */
create or replace function public.rede_voto_urna(p_tipo text, p_alvo uuid) returns jsonb language plpgsql stable security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); r rede_consulta_chaves := interno.voto_guardia(p_tipo, p_alvo, v); v_n integer;
begin
  if interno.voto_situacao(r.tipo, r.consulta) <> 'fechada' then perform interno.erro('aberta'); end if;
  if r.apurada then perform interno.erro('apurada'); end if;
  if r.abridora is distinct from interno.voto_meu_indice(r, v) then perform interno.erro('sem_permissao'); end if;
  select count(*) into v_n from rede_consulta_aberturas where consulta = r.consulta;
  if v_n < r.k then return jsonb_build_object('entregues', v_n, 'k', r.k); end if;
  return jsonb_build_object('entregues', v_n, 'k', r.k,
    'partes', (select jsonb_agg(jsonb_build_object('indice', a.indice, 'parte', interno.voto_b64(a.parte)) order by a.indice) from rede_consulta_aberturas a where a.consulta = r.consulta),
    'cedulas', coalesce(case r.tipo
      when 'consulta' then (select jsonb_agg(x.cedula) from rede_consulta_cifradas x where x.consulta = r.consulta)
      when 'decisao' then (select jsonb_agg(x.cedula) from alumia_decisao_cifradas x where x.decisao = r.consulta)
      else (select jsonb_agg(x.cedula) from votacao_cifradas x where x.votacao = r.consulta) end, '[]'::jsonb),
    'votantes', case r.tipo
      when 'consulta' then (select count(*) from rede_consulta_votantes where consulta = r.consulta)
      when 'decisao' then (select count(*) from alumia_decisao_votantes where decisao = r.consulta)
      else (select count(*) from votacao_marcas where votacao = r.consulta) + (select count(*) from votacao_votantes where votacao = r.consulta)
           + coalesce((select n from votacao_cedulas_emitidas where votacao = r.consulta), 0) end,
    'metodo', case when r.tipo = 'consulta' then (select metodo from rede_consultas where id = r.consulta) end,
    'opcoes', case r.tipo
      when 'consulta' then (select jsonb_agg(o.id order by o.ordem) from rede_consulta_opcoes o where o.consulta = r.consulta)
      when 'decisao' then (select jsonb_agg(o.id order by o.ordem) from alumia_decisao_opcoes o where o.decisao = r.consulta)
      else (select jsonb_agg(o.i - 1 order by o.i) from votacoes x, unnest(x.opcoes) with ordinality as o(t, i) where x.id = r.consulta) end);
end $$;


-- ══════════════════════════════ (2.6) A versão do segredo da impressão de rede ══════════════════════════════
-- O segredo da impressão (ALUMIA_IMPRESSAO_SEGREDO) passa a ter versão ("v<N>:…", da cerimônia com várias pessoas; sem prefixo, a
-- versão 1 de antes). Cada impressão guarda a versão do segredo que a fez. Na troca, o servidor manda a impressão da versão nova e a
-- da anterior: o banco aceita a anterior por 30 dias contados de quando viu a versão nova pela primeira vez, e o banimento que
-- achou a rede pela anterior passa a valer também para a nova (os banimentos seguem valendo na troca). A de antes da anterior, nunca.
alter table interno.alumia_impressoes add column if not exists versao smallint not null default 1;
alter table interno.alumia_impressao_banidas add column if not exists versao smallint not null default 1;
alter table interno.alumia_impressoes drop constraint if exists alumia_impressoes_versao;
alter table interno.alumia_impressoes add constraint alumia_impressoes_versao check (versao >= 1);
alter table interno.alumia_impressao_banidas drop constraint if exists alumia_impressao_banidas_versao;
alter table interno.alumia_impressao_banidas add constraint alumia_impressao_banidas_versao check (versao >= 1);

/** Quando o banco viu esta versão do segredo pela primeira vez (anota na primeira vez). */
create or replace function interno.alumia_impressao_versao_desde(p_versao smallint) returns timestamptz language plpgsql security definer set search_path = interno, pg_temp as $$
declare v jsonb := coalesce((select valor from configuracoes where chave = 'impressao_versoes'), '{}'::jsonb); v_desde timestamptz;
begin
  if v ? p_versao::text then return (v ->> p_versao::text)::timestamptz; end if;
  v_desde := now();
  insert into configuracoes (chave, valor) values ('impressao_versoes', jsonb_build_object(p_versao::text, v_desde))
  on conflict (chave) do update set valor = configuracoes.valor || jsonb_build_object(p_versao::text, v_desde);
  return v_desde;
end $$;

/** O banimento copia as impressões da conta com a versão de cada uma (a função de banir de antes não sabe da versão). */
create or replace function interno.alumia_impressao_banidas_versao() returns trigger language plpgsql security definer set search_path = interno, pg_temp as $$
begin
  if new.versao = 1 then
    new.versao := coalesce((select max(i.versao) from alumia_impressoes i where i.impressao = new.impressao), 1);
  end if;
  return new;
end $$;
drop trigger if exists alumia_impressao_banidas_versao on interno.alumia_impressao_banidas;
create trigger alumia_impressao_banidas_versao before insert on interno.alumia_impressao_banidas for each row execute function interno.alumia_impressao_banidas_versao();

revoke all on function interno.alumia_impressao_versao_desde(smallint), interno.alumia_impressao_banidas_versao() from public;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on function interno.alumia_impressao_versao_desde(smallint), interno.alumia_impressao_banidas_versao() from anon, authenticated;
  end if;
end $$;

drop function if exists public.alumia_impressao_registrar(uuid, text, text);

/**
 * Registra a impressão da rede de quem entrou ou pediu a entrada (só a chave de serviço chama: app/api/alumia/impressao) e diz se a
 * rede está barrada. `p_versao`: a versão do segredo que fez a impressão. `p_anterior`: na troca do segredo, a impressão da mesma rede
 * com a versão anterior (vale por 30 dias desde que o banco viu a versão nova; o banimento que a achou passa a valer para a nova).
 * Se a rede não está barrada, a barreira por rede que havia sobre a conta sai (ela é da rede, não da pessoa). Quem tem função na casa
 * nunca é barrado por rede.
 */
create or replace function public.alumia_impressao_registrar(p_usuario uuid, p_impressao text, p_momento text default 'entrada', p_versao smallint default 1, p_anterior text default null)
returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare f perfis; b alumia_impressao_banimentos; r record; v_versao smallint := coalesce(p_versao, 1); v_anterior text; v_pela_anterior boolean := false;
begin
  if not interno.servico() then perform interno.erro('sem_permissao'); end if;
  if p_impressao is null or p_impressao !~ '^[0-9a-f]{64}$' then perform interno.erro('invalido:impressao'); end if;
  if v_versao < 1 then perform interno.erro('invalido:versao'); end if;
  if p_anterior is not null and p_anterior !~ '^[0-9a-f]{64}$' then perform interno.erro('invalido:impressao'); end if;
  select * into f from perfis where id = p_usuario;
  if not found then perform interno.erro('nao_encontrado'); end if;
  -- A anterior só vale na troca: versão de antes, e até 30 dias depois de o banco ver a nova pela primeira vez.
  if p_anterior is not null and v_versao > 1 and now() < interno.alumia_impressao_versao_desde(v_versao) + interval '30 days' then
    v_anterior := p_anterior;
  else
    perform interno.alumia_impressao_versao_desde(v_versao);
  end if;
  update alumia_impressao_banimentos set encerrado_em = now() where encerrado_em is null and ate <= now();
  insert into alumia_impressoes (usuario, impressao, versao) values (f.id, p_impressao, v_versao)
  on conflict (usuario, impressao) do update set vista_em = now(), vence_em = now() + interval '30 days', versao = excluded.versao;
  if interno.alumia_painel_da_casa(f.id) then return jsonb_build_object('barrada', false); end if;
  select x.* into b from alumia_impressao_banimentos x join alumia_impressao_banidas i on i.banimento = x.id
  where ((i.impressao = p_impressao and i.versao = v_versao) or (v_anterior is not null and i.impressao = v_anterior and i.versao = v_versao - 1))
    and x.encerrado_em is null and x.ate > now() order by x.ate desc limit 1;
  if found then
    -- Achada pela anterior: a nova entra no mesmo banimento (vale depois da troca, sem precisar banir de novo).
    insert into alumia_impressao_banidas (banimento, impressao, versao) values (b.id, p_impressao, v_versao) on conflict do nothing;
    if not exists (select 1 from alumia_sancoes s where s.usuario = f.id and s.encerrada_em is null and s.tipo = 'rede' and s.banimento_rede = b.id) then
      insert into alumia_sancoes (usuario, tipo, motivo, por, ate, ja_suspensa, banimento_rede)
      values (f.id, 'rede', b.motivo, b.por, b.ate, f.suspenso and not exists (select 1 from alumia_sancoes s where s.usuario = f.id and s.encerrada_em is null), b.id);
      update perfis set suspenso = true, suspensao = case when suspensao <> '' then suspensao else 'sistema' end where id = f.id;
    end if;
    return jsonb_build_object('barrada', true, 'ate', b.ate);
  end if;
  -- Veio de uma rede que não está barrada: a barreira por rede que havia sobre a conta sai.
  for r in select s.id, s.ja_suspensa from alumia_sancoes s where s.usuario = f.id and s.encerrada_em is null and s.tipo = 'rede' loop
    update alumia_sancoes set encerrada_em = now() where id = r.id;
    perform interno.alumia_painel_soltar(f.id, r.ja_suspensa);
  end loop;
  return jsonb_build_object('barrada', false);
end $$;
revoke all on function public.alumia_impressao_registrar(uuid, text, text, smallint, text) from public;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on function public.alumia_impressao_registrar(uuid, text, text, smallint, text) from anon, authenticated;
    grant execute on function public.alumia_impressao_registrar(uuid, text, text, smallint, text) to service_role;
  end if;
end $$;

select interno.alumia_trancar();
