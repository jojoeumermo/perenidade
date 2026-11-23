-- Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
-- Alumia · R2 · chat da equipe (painel) em MLS: sai o Megolm (biblioteca do Matrix) e sai a cifra "c2" feita à mão; entra o OpenMLS
-- do @wireapp/core-crypto na suíte híbrida ML-KEM-768 + X25519, um grupo MLS por conversa (lib/equipe/mls.ts, lib/chaveiro.ts).
--
--   O que fica igual: a identidade de cada pessoa da equipe (lib/sigilo.ts) assina cada mensagem por dentro da cifra ("s1"); a
--   identidade é repassada a um aparelho aprovado em HPKE ("h1", chat_aparelho_aprovar); o aparelho que se certifica sozinho espera
--   24 horas (chat_aparelhos.vale_desde, 20261121-equipe-chat-espera.sql); quem é de cada conversa continua no cadastro do painel.
--   O que muda:
--     - cada aparelho aprovado é uma folha do MLS ("<conta>:<aparelho>@alumia.invalid") com um certificado assinado pela
--       identidade da pessoa ("esta folha, com esta chave de assinatura, é deste aparelho meu"); os colegas só põem no grupo a
--       folha cujo certificado confere com a identidade que já conhecem (o servidor não consegue pôr um aparelho falso);
--     - o banco guarda os commits EMBRULHADOS (XChaCha20-Poly1305 com a chave da época, tirada do exporter do MLS), as boas-vindas
--       por aparelho (30 dias) e os pacotes de chave de cada folha; nada de GroupInfo, de autor de commit nem de hora;
--     - a "versão" da conversa passa a ser a época do MLS (chat_versoes ganha uma linha por commit); a mensagem é "m1.<época>.<...>",
--       cifrada com a chave da época (o histórico abre em todo aparelho que estava no grupo naquela época, e só nele);
--     - saem as tabelas e funções do Megolm/Olm (equipe_chat_olm, equipe_chat_unicas, equipe_chat_reserva, equipe_chat_caixa,
--       equipe_chat_pedidos e as equipe_chat_*) e as da cifra "c2" (chat_chaves e chat_chave_nova, chat_chaves_dar,
--       chat_chaves_pendentes, chat_chaves_recusar, chat_chaves).
--   A troca zera as conversas cifradas de antes, uma vez só (a marca "r2_troca_equipe" em interno.configuracoes): as mensagens "c2"
--   e "e1" das conversas e do mural da equipe (equipe_mensagens, cifrado com a chave do grupo do departamento), os anexos cifrados
--   e as versões; os avisos do sistema ficam. As tabelas antigas saem com drop (os arquivos delas
--   saem do disco do banco) toda vez: o install.sql rodado de novo as recria vazias, pelas migrações de antes, e esta as apaga de novo.
--
-- Leis e princípios: LGPD art. 6º (necessidade: some o autor e a hora do commit), art. 46 (segurança: cifra pós-quântica, chave nova
-- a cada época). Nenhuma lista de pessoas nova: as folhas de uma conversa só saem para quem está nela. Nenhum endereço de rede.
--
-- Funções novas: public.equipe_mls_publicar, public.equipe_mls_meus_pacotes, public.equipe_mls_estado, public.equipe_mls_pacotes_pegar,
-- public.equipe_mls_commit, public.equipe_mls_pendentes, public.equipe_mls_reentrar. Redefinidas (a definição completa, tirada do banco montado, menos o que saiu): interno.chat_versao_valida,
-- interno.chat_retirar e public.chat_aparelho_aprovar (o pedido de aparelho vale 10 minutos: conserto do C3 da R1). As funções public.chat_*/equipe_* são do painel da equipe: ficam fora da porta da Alumia, como as de antes
-- (conferem interno.eu() e interno.na_conversa). Nenhuma recebe linha de tabela com valor padrão. Pode rodar mais de uma vez.
-- Teste: npm run testar:r2-equipe.

-- ── 1. A troca: as conversas cifradas de antes saem (só na primeira vez) ─────────────────────────────────────────────────
do $$
begin
  if not exists (select 1 from interno.configuracoes where chave = 'r2_troca_equipe') then
    delete from interno.conversa_anexos;
    delete from interno.conversa_mensagens where tipo is distinct from 'sistema';
    -- O mural da equipe usa a mesma cifra (a chave do grupo do departamento): sai junto.
    delete from interno.equipe_mensagens;
    delete from interno.chat_versoes;
    update interno.conversas set versao_minima = 0 where versao_minima <> 0;
    insert into interno.configuracoes (chave, valor) values ('r2_troca_equipe', jsonb_build_object('dia', current_date));
  end if;
end $$;
drop table if exists interno.equipe_chat_pedidos, interno.equipe_chat_caixa, interno.equipe_chat_reserva, interno.equipe_chat_unicas,
  interno.equipe_chat_olm, interno.chat_chaves;
drop function if exists public.equipe_chat_olm_publicar(uuid, jsonb, text);
drop function if exists public.equipe_chat_olm_consultar(uuid, uuid[]);
drop function if exists public.equipe_chat_olm_reivindicar(uuid, jsonb);
drop function if exists public.equipe_chat_olm_enviar(uuid, text, jsonb);
drop function if exists public.equipe_chat_olm_receber(uuid);
drop function if exists public.equipe_chat_olm_confirmar(uuid, bigint);
drop function if exists public.equipe_chat_pedir_chave(uuid, uuid, text);
drop function if exists public.equipe_chat_pedidos(uuid);
drop function if exists public.equipe_chat_pedido_atendido(uuid, bigint);
drop function if exists public.equipe_chat_versao_nova(uuid, uuid, integer);
drop function if exists interno.equipe_chat_meu(uuid);
drop function if exists interno.equipe_chat_id(uuid);
drop function if exists interno.equipe_chat_usuario(text);
drop function if exists interno.equipe_chat_destino(text, text);
drop function if exists public.chat_chave_nova(uuid, uuid, integer, jsonb);
drop function if exists public.chat_chaves_dar(uuid, jsonb);
drop function if exists public.chat_chaves_pendentes(uuid);
drop function if exists public.chat_chaves_recusar(uuid, uuid, integer);
drop function if exists public.chat_chaves(uuid, uuid);

-- ── 2. As tabelas ─────────────────────────────────────────────────────────────────────────────────────────────────────────

-- A folha MLS de cada aparelho aprovado, com o certificado da identidade da pessoa (ECDSA de lib/sigilo.ts, 86 letras).
create table if not exists interno.equipe_mls_folhas (
  aparelho uuid primary key references interno.chat_aparelhos (id) on delete cascade,
  usuario uuid not null references interno.perfis (id) on delete cascade,
  nome text not null unique check (nome ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}:[0-9a-f]{1,16}@alumia[.]invalid$'),
  certificado text not null check (certificado ~ '^[A-Za-z0-9_-]{86}$'),
  dia date not null default current_date
);
create index if not exists equipe_mls_folhas_usuario on interno.equipe_mls_folhas (usuario);

-- Pacotes de chave de cada folha (cada um sai uma vez; até 20).
create table if not exists interno.equipe_mls_pacotes (
  id uuid primary key default gen_random_uuid(),
  aparelho uuid not null references interno.equipe_mls_folhas (aparelho) on delete cascade,
  pacote text not null check (pacote ~ '^[A-Za-z0-9+/]+={0,2}$' and char_length(pacote) <= 8000),
  dia date not null default current_date
);
create index if not exists equipe_mls_pacotes_aparelho on interno.equipe_mls_pacotes (aparelho);

-- Os commits de cada conversa, em ordem, embrulhados (o mesmo formato dos grupos da rede: interno.rede_mls_embrulho_ok).
create table if not exists interno.equipe_mls_commits (
  conversa uuid not null references interno.conversas (id) on delete cascade,
  epoca integer not null check (epoca > 0),
  commit text not null,
  dia date not null default current_date,
  primary key (conversa, epoca)
);

-- Boas-vindas para cada aparelho posto no grupo da conversa. Só aquele aparelho lê; some em 30 dias.
create table if not exists interno.equipe_mls_boasvindas (
  conversa uuid not null references interno.conversas (id) on delete cascade,
  epoca integer not null check (epoca > 0),
  para uuid not null references interno.equipe_mls_folhas (aparelho) on delete cascade,
  welcome text not null check (welcome ~ '^[A-Za-z0-9+/]+={0,2}$' and char_length(welcome) <= 400000),
  dia date not null default current_date,
  primary key (conversa, epoca, para)
);

-- Quais aparelhos já estão no grupo de cada conversa (quem fez um commit nele ou recebeu as boas-vindas). Não diz nada novo ao banco
-- (ele já sabe quem é de cada conversa e quais aparelhos cada pessoa tem): serve para um aparelho online saber em quais conversas há
-- aparelho aprovado de colega esperando entrar (equipe_mls_pendentes), como a lista de chaves a repassar de antes.
create table if not exists interno.equipe_mls_no_grupo (
  conversa uuid not null references interno.conversas (id) on delete cascade,
  aparelho uuid not null references interno.equipe_mls_folhas (aparelho) on delete cascade,
  primary key (conversa, aparelho)
);

alter table interno.equipe_mls_no_grupo enable row level security;
alter table interno.equipe_mls_folhas enable row level security;
alter table interno.equipe_mls_pacotes enable row level security;
alter table interno.equipe_mls_commits enable row level security;
alter table interno.equipe_mls_boasvindas enable row level security;
revoke all on interno.equipe_mls_folhas, interno.equipe_mls_pacotes, interno.equipe_mls_commits, interno.equipe_mls_boasvindas, interno.equipe_mls_no_grupo from public;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on interno.equipe_mls_folhas, interno.equipe_mls_pacotes, interno.equipe_mls_commits, interno.equipe_mls_boasvindas, interno.equipe_mls_no_grupo from anon, authenticated;
  end if;
end $$;

/** O embrulho de um commit da equipe: o mesmo formato e os mesmos tamanhos dos grupos da rede. */
create or replace function interno.equipe_mls_embrulho_ok(p text) returns boolean language plpgsql immutable set search_path = interno, pg_temp as $$
declare v bytea;
begin
  if p is null or p !~ '^[A-Za-z0-9+/]+={0,2}$' or char_length(p) > 175000 then return false; end if;
  v := decode(p, 'base64');
  return octet_length(v) in (2098, 8242, 32818, 131122) and get_byte(v, 0) = 71 and get_byte(v, 1) = 1;
exception when others then
  return false;
end $$;
do $$
begin
  if not exists (select 1 from pg_constraint where conrelid = 'interno.equipe_mls_commits'::regclass and conname = 'equipe_mls_commits_embrulho') then
    alter table interno.equipe_mls_commits add constraint equipe_mls_commits_embrulho check (interno.equipe_mls_embrulho_ok(commit));
  end if;
end $$;

/** Este aparelho é meu, aprovado e já vale (fora da espera de 24 horas)? */
create or replace function interno.equipe_mls_meu(p_aparelho uuid) returns boolean language sql stable security definer set search_path = interno, pg_temp as $$
  select exists (select 1 from chat_aparelhos a join perfis f on f.id = a.usuario
                 where a.id = p_aparelho and a.usuario = interno.eu() and a.certificado is not null and interno.chat_aparelho_vale(a.vale_desde) and not f.suspenso)
$$;

-- ── 3. A versão da conversa é a época do MLS ─────────────────────────────────────────────────────────────────────────────

/**
 * O corpo cifrado de uma mensagem: só "m1.<época>.<nonce e cifrado em base64url>", num dos tamanhos fixos do bloco (o cifrado de
 * 256 a 8192 bytes mais 40). A época tem de ser a mais nova da conversa e não pode ser anterior à última saída de alguém.
 */
create or replace function interno.chat_versao_valida(p_conversa uuid, p_corpo text) returns integer language plpgsql stable security definer set search_path = interno, pg_temp as $$
declare v_versao integer;
begin
  if char_length(coalesce(p_corpo, '')) > 12000 or coalesce(p_corpo, '') !~ '^m1[.][1-9][0-9]{0,6}[.][A-Za-z0-9_-]+$'
     or char_length(split_part(p_corpo, '.', 3)) not in (395, 736, 1419, 2784, 5515, 8246, 10976) then
    perform interno.erro('invalido:corpo');
  end if;
  v_versao := split_part(p_corpo, '.', 2)::integer;
  -- Só vale a época mais nova, e só se ela for posterior à última saída de alguém da conversa.
  if v_versao is distinct from (select max(versao) from chat_versoes where conversa = p_conversa)
     or v_versao < (select versao_minima from conversas where id = p_conversa) then
    perform interno.erro('chave_desatualizada');
  end if;
  return v_versao;
end $$;

/** Tira a pessoa da conversa e exige uma época nova (o próximo aparelho que escreve tira as folhas dela do grupo). */
create or replace function interno.chat_retirar(p_conversa uuid, p_usuario uuid) returns void language plpgsql security definer set search_path = interno, pg_temp as $$
begin
  delete from conversa_membros where conversa = p_conversa and usuario = p_usuario;
  if not found then return; end if;
  delete from equipe_mls_boasvindas where conversa = p_conversa and para in (select id from chat_aparelhos where usuario = p_usuario);
  delete from equipe_mls_no_grupo where conversa = p_conversa and aparelho in (select id from chat_aparelhos where usuario = p_usuario);
  perform interno.chat_trocar_chave(p_conversa);
end $$;

-- ── 4. O que o aparelho chama ────────────────────────────────────────────────────────────────────────────────────────────

/**
 * Publica a folha deste aparelho (nome e certificado da identidade) e pacotes de chave dela (até 20). Folha com nome novo (o aparelho
 * perdeu a loja do motor) troca a antiga, e os pacotes da antiga saem. Devolve quantos pacotes a folha tem.
 */
create or replace function public.equipe_mls_publicar(p_aparelho uuid, p_nome text, p_certificado text, p_pacotes text[]) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); x text; n integer; v_antigo text;
begin
  if not interno.equipe_mls_meu(p_aparelho) then perform interno.erro('aparelho_desconhecido'); end if;
  perform interno.limite('equipe_mls_pacotes', 30, 60);
  if coalesce(p_nome, '') !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}:[0-9a-f]{1,16}@alumia[.]invalid$'
     or split_part(p_nome, ':', 1)::uuid is distinct from v then
    perform interno.erro('invalido:nome');
  end if;
  if coalesce(p_certificado, '') !~ '^[A-Za-z0-9_-]{86}$' then perform interno.erro('invalido:certificado'); end if;
  if coalesce(array_length(p_pacotes, 1), 0) > 20 then perform interno.erro('invalido:pacotes'); end if;
  select nome into v_antigo from equipe_mls_folhas where aparelho = p_aparelho;
  if v_antigo is distinct from p_nome then
    delete from equipe_mls_folhas where aparelho = p_aparelho;
    insert into equipe_mls_folhas (aparelho, usuario, nome, certificado) values (p_aparelho, v, p_nome, p_certificado);
  else
    update equipe_mls_folhas set certificado = p_certificado, dia = current_date where aparelho = p_aparelho;
  end if;
  foreach x in array coalesce(p_pacotes, '{}') loop
    if x !~ '^[A-Za-z0-9+/]+={0,2}$' or char_length(x) > 8000 then perform interno.erro('invalido:pacote'); end if;
    if (select count(*) from equipe_mls_pacotes where aparelho = p_aparelho) >= 20 then exit; end if;
    insert into equipe_mls_pacotes (aparelho, pacote) values (p_aparelho, x);
  end loop;
  select count(*) into n from equipe_mls_pacotes where aparelho = p_aparelho;
  return jsonb_build_object('pacotes', n);
end $$;

/** A folha publicada deste aparelho e quantos pacotes ela ainda tem (o aparelho repõe quando fica pouco). */
create or replace function public.equipe_mls_meus_pacotes(p_aparelho uuid) returns jsonb language plpgsql stable security definer set search_path = interno, pg_temp as $$
begin
  if not interno.equipe_mls_meu(p_aparelho) then perform interno.erro('aparelho_desconhecido'); end if;
  return jsonb_build_object(
    'nome', (select nome from equipe_mls_folhas where aparelho = p_aparelho),
    'pacotes', (select count(*) from equipe_mls_pacotes where aparelho = p_aparelho));
end $$;

/**
 * O estado do grupo da conversa para um aparelho meu, aprovado, de quem está nela: a época, a mínima, quem está, as folhas dos
 * aparelhos aprovados (com o certificado, que cada colega confere), as identidades, os commits depois de `p_desde` (até 200), as
 * boas-vindas mais novas para este aparelho, e o dia e o número de mensagens da época atual (a regra de trocar de época).
 */
create or replace function public.equipe_mls_estado(p_aparelho uuid, p_conversa uuid, p_desde integer) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v_epoca integer;
begin
  if not interno.na_conversa(p_conversa) then perform interno.erro('nao_encontrado'); end if;
  if not interno.equipe_mls_meu(p_aparelho) then perform interno.erro('aparelho_desconhecido'); end if;
  perform interno.limite('equipe_mls_ler', 600, 60);
  update chat_aparelhos set visto_em = now() where id = p_aparelho and visto_em < now() - interval '1 hour';
  delete from equipe_mls_boasvindas where dia < current_date - 30;
  select max(epoca) into v_epoca from equipe_mls_commits where conversa = p_conversa;
  return jsonb_build_object(
    'epoca', v_epoca,
    'minima', (select versao_minima from conversas where id = p_conversa),
    'epoca_dia', (select dia from equipe_mls_commits where conversa = p_conversa and epoca = v_epoca),
    'mensagens', (select count(*) from conversa_mensagens g where g.conversa = p_conversa and g.versao = v_epoca and g.tipo is distinct from 'sistema'),
    'membros', coalesce((select jsonb_agg(m.usuario order by m.usuario) from conversa_membros m join perfis f on f.id = m.usuario
                         where m.conversa = p_conversa and not f.suspenso), '[]'::jsonb),
    -- Só aparelhos aprovados e que já valem, de quem está na conversa: o certificado vai junto, e quem confere é cada aparelho.
    'folhas', coalesce((select jsonb_agg(jsonb_build_object('nome', e.nome, 'usuario', e.usuario, 'aparelho', e.aparelho, 'certificado', e.certificado) order by e.nome)
                        from equipe_mls_folhas e join chat_aparelhos a on a.id = e.aparelho join conversa_membros m on m.usuario = a.usuario and m.conversa = p_conversa
                        join perfis f on f.id = a.usuario
                        where not f.suspenso and a.certificado is not null and interno.chat_aparelho_vale(a.vale_desde)), '[]'::jsonb),
    -- As folhas listadas que não estão no grupo pelo banco (saíram e voltaram à conversa, ou o aparelho perdeu as boas-vindas e
    -- pediu para entrar de novo): se estiverem na árvore, o próximo aparelho tira e põe de novo, com boas-vindas novas.
    'reentrar', coalesce((select jsonb_agg(e.nome order by e.nome)
                        from equipe_mls_folhas e join chat_aparelhos a on a.id = e.aparelho join conversa_membros m on m.usuario = a.usuario and m.conversa = p_conversa
                        join perfis f on f.id = a.usuario
                        where not f.suspenso and a.certificado is not null and interno.chat_aparelho_vale(a.vale_desde)
                          and not exists (select 1 from equipe_mls_no_grupo g where g.conversa = p_conversa and g.aparelho = e.aparelho)), '[]'::jsonb),
    -- A identidade de cada pessoa da conversa, como o banco a conhece. Quem compara com a que já conhecia é o aparelho.
    'identidades', coalesce((select jsonb_agg(jsonb_build_object('usuario', m.usuario, 'nome', f.nome, 'assina', i.assina, 'versao', i.versao) order by f.nome)
                             from conversa_membros m join perfis f on f.id = m.usuario left join chat_identidades i on i.usuario = m.usuario
                             where m.conversa = p_conversa), '[]'::jsonb),
    'commits', coalesce((select jsonb_agg(jsonb_build_object('epoca', c.epoca, 'commit', c.commit) order by c.epoca)
      from (select * from equipe_mls_commits where conversa = p_conversa and epoca > coalesce(p_desde, 0) order by epoca limit 200) c), '[]'::jsonb),
    'boasvindas', (select jsonb_build_object('epoca', b.epoca, 'welcome', b.welcome) from equipe_mls_boasvindas b
      where b.conversa = p_conversa and b.para = p_aparelho order by b.epoca desc limit 1));
end $$;

/** Pega um pacote de chave de cada folha pedida (só folhas de aparelhos aprovados de quem está na conversa; o pacote sai do banco). */
create or replace function public.equipe_mls_pacotes_pegar(p_aparelho uuid, p_conversa uuid, p_nomes text[]) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare x text; v_aparelho uuid; v_pacote text; saida jsonb := '{}'::jsonb;
begin
  if not interno.na_conversa(p_conversa) then perform interno.erro('nao_encontrado'); end if;
  if not interno.equipe_mls_meu(p_aparelho) then perform interno.erro('aparelho_desconhecido'); end if;
  if coalesce(array_length(p_nomes, 1), 0) > 200 then perform interno.erro('invalido:pedido'); end if;
  perform interno.limite('equipe_mls_pegar', 120, 60);
  foreach x in array coalesce(p_nomes, '{}') loop
    select e.aparelho into v_aparelho from equipe_mls_folhas e join chat_aparelhos a on a.id = e.aparelho
      join conversa_membros m on m.usuario = a.usuario and m.conversa = p_conversa join perfis f on f.id = a.usuario
      where e.nome = x and e.aparelho <> p_aparelho and not f.suspenso and a.certificado is not null and interno.chat_aparelho_vale(a.vale_desde);
    if v_aparelho is null then continue; end if;
    v_pacote := null;
    delete from equipe_mls_pacotes where id = (select id from equipe_mls_pacotes where aparelho = v_aparelho order by dia, id limit 1 for update skip locked) returning pacote into v_pacote;
    if v_pacote is not null then saida := saida || jsonb_build_object(x, v_pacote); end if;
    v_aparelho := null;
  end loop;
  return saida;
end $$;

/**
 * Grava o commit embrulhado que leva a conversa à época `p_epoca` (a atual + 1; dois aparelhos ao mesmo tempo, o segundo recebe
 * "versao_ocupada") e as boas-vindas ([{para: nome da folha, welcome}], só para folhas aprovadas de quem está na conversa). A época
 * vira a versão da conversa (chat_versoes), que é o que chat_enviar confere.
 */
create or replace function public.equipe_mls_commit(p_aparelho uuid, p_conversa uuid, p_epoca integer, p_commit text, p_boasvindas jsonb) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v_atual integer; b jsonb; v_para uuid;
begin
  if not interno.na_conversa(p_conversa) then perform interno.erro('nao_encontrado'); end if;
  if not interno.equipe_mls_meu(p_aparelho) then perform interno.erro('aparelho_desconhecido'); end if;
  perform interno.limite('chat_chave', 120, 60);
  -- Um commit por vez em cada conversa.
  perform 1 from conversas where id = p_conversa for update;
  select max(epoca) into v_atual from equipe_mls_commits where conversa = p_conversa;
  if p_epoca is distinct from coalesce(v_atual, 0) + 1 then perform interno.erro('versao_ocupada'); end if;
  if not interno.equipe_mls_embrulho_ok(p_commit) then perform interno.erro('invalido:commit'); end if;
  if jsonb_typeof(coalesce(p_boasvindas, '[]'::jsonb)) <> 'array' or jsonb_array_length(coalesce(p_boasvindas, '[]'::jsonb)) > 200 then perform interno.erro('invalido:boasvindas'); end if;
  insert into equipe_mls_commits (conversa, epoca, commit) values (p_conversa, p_epoca, p_commit);
  insert into chat_versoes (conversa, versao, criada_por) values (p_conversa, p_epoca, p_aparelho) on conflict do nothing;
  insert into equipe_mls_no_grupo (conversa, aparelho) select p_conversa, p_aparelho where exists (select 1 from equipe_mls_folhas where aparelho = p_aparelho) on conflict do nothing;
  for b in select * from jsonb_array_elements(coalesce(p_boasvindas, '[]'::jsonb)) loop
    select e.aparelho into v_para from equipe_mls_folhas e join chat_aparelhos a on a.id = e.aparelho
      join conversa_membros m on m.usuario = a.usuario and m.conversa = p_conversa
      where e.nome = b ->> 'para' and a.certificado is not null and interno.chat_aparelho_vale(a.vale_desde);
    if v_para is null then continue; end if;
    if coalesce(b ->> 'welcome', '') !~ '^[A-Za-z0-9+/]+={0,2}$' or char_length(b ->> 'welcome') > 400000 then perform interno.erro('invalido:boasvindas'); end if;
    insert into equipe_mls_boasvindas (conversa, epoca, para, welcome) values (p_conversa, p_epoca, v_para, b ->> 'welcome') on conflict do nothing;
    insert into equipe_mls_no_grupo (conversa, aparelho) values (p_conversa, v_para) on conflict do nothing;
    v_para := null;
  end loop;
  return jsonb_build_object('epoca', p_epoca);
end $$;

/**
 * As conversas deste aparelho (até 20) em que há aparelho aprovado de alguém da conversa que ainda não entrou no grupo: o aparelho
 * online acerta o grupo delas (lib/chaveiro.ts, repassar), e quem chegou depois passa a ler sem esperar alguém escrever.
 */
create or replace function public.equipe_mls_pendentes(p_aparelho uuid) returns jsonb language plpgsql stable security definer set search_path = interno, pg_temp as $$
begin
  if not interno.equipe_mls_meu(p_aparelho) then perform interno.erro('aparelho_desconhecido'); end if;
  return coalesce((select jsonb_agg(x.conversa) from (
    select distinct m.conversa from conversa_membros m
    join equipe_mls_no_grupo g on g.conversa = m.conversa and g.aparelho = p_aparelho
    where m.usuario = interno.eu() and exists (
      select 1 from conversa_membros o join chat_aparelhos a on a.usuario = o.usuario join equipe_mls_folhas e on e.aparelho = a.id
      join perfis f on f.id = a.usuario
      where o.conversa = m.conversa and a.certificado is not null and interno.chat_aparelho_vale(a.vale_desde) and not f.suspenso
        and not exists (select 1 from equipe_mls_no_grupo n where n.conversa = m.conversa and n.aparelho = a.id))
    limit 20) x), '[]'::jsonb);
end $$;

/**
 * Este aparelho está na conversa, mas sem o grupo dela (as boas-vindas venceram em 30 dias, ou falharam): pede para entrar de novo.
 * `p_visto`: a época das boas-vindas mais novas que ele viu (0 se nenhuma).
 * O banco esquece que ele está no grupo e as boas-vindas velhas; o próximo aparelho da conversa que acertar o grupo tira a folha
 * dele e põe de novo (equipe_mls_estado, "reentrar"). Não diz nada novo ao banco: ele já sabe quem é da conversa.
 */
create or replace function public.equipe_mls_reentrar(p_aparelho uuid, p_conversa uuid, p_visto integer) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
begin
  if not interno.na_conversa(p_conversa) then perform interno.erro('nao_encontrado'); end if;
  if not interno.equipe_mls_meu(p_aparelho) then perform interno.erro('aparelho_desconhecido'); end if;
  perform interno.limite('equipe_mls_reentrar', 30, 60);
  -- Boas-vindas mais novas do que as que o aparelho viu chegaram enquanto ele pedia: ele entra por elas, nada muda.
  if exists (select 1 from equipe_mls_boasvindas where conversa = p_conversa and para = p_aparelho and epoca > coalesce(p_visto, 0)) then
    return jsonb_build_object('ok', false, 'novas', true);
  end if;
  delete from equipe_mls_no_grupo where conversa = p_conversa and aparelho = p_aparelho;
  delete from equipe_mls_boasvindas where conversa = p_conversa and para = p_aparelho;
  return jsonb_build_object('ok', true);
end $$;

-- ── 4b. Aprovar aparelho: o pedido vale 10 minutos (conserto do C3 da R1) ─────────────────────────────────────────────────
-- O código de aprovação passou de 8 para 12 números (lib/sigilo.ts) e o pedido leva, cifrada junto da chave pública, a hora em que foi
-- feito: o aparelho que aprova recusa pedido de mais de 10 minutos pelo relógio dele. O banco também recusa ("aparelho_pedido_vencido"), para
-- quem não tem o aparelho de agora; o aparelho novo troca o código sozinho antes de vencer (chat_aparelho_pedir).
-- Definição completa (tirada do banco montado) com a conferência nova; o resto é igual.
create or replace function public.chat_aparelho_aprovar(p_id uuid, p_por uuid, p_certificado text, p_identidade_embrulho text) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); v_publica text; a chat_aparelhos;
begin
  select publica into v_publica from chat_aparelhos where id = p_por and usuario = v and certificado is not null and interno.chat_aparelho_vale(vale_desde);
  if v_publica is null then perform interno.erro('aparelho_desconhecido'); end if;
  -- Pedido feito com código (aparelho novo) vale 10 minutos. Sem pedido (os aparelhos de antes da identidade, aprovados pelo primeiro
  -- aparelho que a cria), não há código para forçar.
  if exists (select 1 from chat_aparelhos where id = p_id and usuario = v and pedido is not null and pedido_em < now() - interval '10 minutes') then
    perform interno.erro('aparelho_pedido_vencido');
  end if;
  if coalesce(p_certificado, '') !~ '^[A-Za-z0-9_-]{86}$' then perform interno.erro('invalido:certificado'); end if;
  if not interno.equipe_chat_embrulho_ok(p_identidade_embrulho) then perform interno.erro('invalido:embrulho'); end if;
  update chat_aparelhos set certificado = p_certificado, aprovado_por = p_por, aprovado_publica = v_publica, aprovado_em = now(), identidade_embrulho = p_identidade_embrulho, pedido = null, vale_desde = null
  where id = p_id and usuario = v and (certificado is null or not interno.chat_aparelho_vale(vale_desde)) and id <> p_por returning * into a;
  if not found then perform interno.erro('nao_encontrado'); end if;
  perform interno.registrar('chat_aparelho_aprovado', v::text, jsonb_build_object('rotulo', a.rotulo));
  return interno.chat_aparelho_json(a);
end $$;

-- ── 5. Permissões ─────────────────────────────────────────────────────────────────────────────────────────────────────────
revoke all on function interno.equipe_mls_embrulho_ok(text), interno.equipe_mls_meu(uuid) from public;
do $$
declare f record;
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on function interno.equipe_mls_embrulho_ok(text), interno.equipe_mls_meu(uuid) from anon, authenticated;
  end if;
  for f in select p.oid::regprocedure as assinatura from pg_proc p join pg_namespace n on n.oid = p.pronamespace
           where n.nspname = 'public' and p.proname in ('equipe_mls_publicar', 'equipe_mls_meus_pacotes', 'equipe_mls_estado', 'equipe_mls_pacotes_pegar', 'equipe_mls_commit', 'equipe_mls_pendentes', 'equipe_mls_reentrar') loop
    execute format('revoke all on function %s from public', f.assinatura);
    if exists (select 1 from pg_roles where rolname = 'anon') then
      execute format('revoke all on function %s from anon', f.assinatura);
      execute format('grant execute on function %s to authenticated', f.assinatura);
    end if;
  end loop;
end $$;

select interno.alumia_trancar();
