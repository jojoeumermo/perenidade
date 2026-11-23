-- Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
-- Alumia · R2 · grupos cifrados da rede em MLS pelo OpenMLS (núcleos e comunidades fechadas: posts restritos "p2" e voz):
--
--   A biblioteca troca: sai a ts-mls (20261113-rede-grupos-mls.sql) e entra o OpenMLS do @wireapp/core-crypto, na suíte híbrida
--   ML-KEM-768 + X25519 (lib/rede/grupos/motor-de-grupo.ts, lib/rede/grupos/chaveiro.ts). O estado da ts-mls não abre no OpenMLS:
--   as tabelas antigas (rede_mls_pacotes, rede_mls_commits, rede_mls_info, rede_mls_boasvindas) saem inteiras (drop, não delete),
--   e, uma vez só (a marca "r2_troca_grupos" em interno.configuracoes), os posts "p2" cifrados por ela também (ninguém mais teria a
--   chave para abrir; nada fica esquecido no servidor). As tabelas novas têm outros nomes (rede_grupo_*): o install.sql rodado de
--   novo recria as antigas vazias, pela migração de 11/2026, e esta migração, que vem depois, as apaga de novo sem tocar em nada.
--   Os aparelhos apagam a loja antiga sozinhos.
--
--   O que o banco guarda agora, e o que deixou de guardar:
--     - as folhas (cada aparelho de cada conta é uma folha do MLS, com nome "<conta>:<aparelho>@alumia.invalid"), até 5 por conta;
--     - os pacotes de chave de cada folha (cada um sai uma vez);
--     - o registro dos commits de cada grupo, em ordem, EMBRULHADOS (XChaCha20-Poly1305 com a chave da época, tirada do exporter
--       do MLS): o banco não vê quem fez o commit, quem entrou nem quem saiu; aceita só os tamanhos fixos do embrulho;
--     - as boas-vindas (Welcome, cifradas pelo MLS para o pacote de quem entra), uma por aparelho, por 30 dias; e os pedidos de
--       entrar de novo de quem ficou na árvore sem o grupo (rede_grupo_reentrar, 30 dias).
--     - SAEM: a GroupInfo (a árvore inteira em texto aberto; ninguém mais entra sozinho, só por boas-vindas), o autor de cada
--       commit e as horas (fica só o dia).
--   O banco continua decidindo QUEM é do grupo (os membros do núcleo ou da comunidade, como sempre): esconder a filiação é a outra
--   frente da R2 (grupos de membros escondidos, caixas anônimas). Ele não consegue ler nada nem pôr uma chave falsa no lugar do
--   aparelho de ninguém sem os aparelhos notarem (cada aparelho guarda a chave de cada folha que viu e recusa troca: grupo_suspeito).
--
-- Leis e princípios: LGPD art. 6º (necessidade: some a árvore, o autor do commit e a hora), art. 46 (segurança: cifra pós-quântica);
-- nenhuma lista de pessoas nova (as folhas só saem para quem é do mesmo grupo), nenhum endereço de rede, nenhum número de pessoas.
--
-- Funções novas ou redefinidas por inteiro (assinaturas novas; as antigas saem): public.rede_mls_publicar, public.rede_mls_meus_pacotes,
-- public.rede_mls_estado, public.rede_mls_pacotes_pegar, public.rede_mls_commit, public.rede_mls_reentrar, interno.rede_mls_embrulho_ok. Nenhuma recebe linha
-- de tabela com valor padrão. Pode rodar mais de uma vez. Termina trancando tudo na porta. Teste: npm run testar:r2-grupos-banco.

-- ── 1. A troca: o estado da ts-mls sai ─────────────────────────────────────────────────────────────────────────────────────
do $$
begin
  -- Os posts "p2" da ts-mls: uma vez só (depois, os "p2" são os do OpenMLS e ficam).
  if not exists (select 1 from interno.configuracoes where chave = 'r2_troca_grupos') then
    delete from interno.rede_posts where corpo_grupo is not null;
    insert into interno.configuracoes (chave, valor) values ('r2_troca_grupos', jsonb_build_object('dia', current_date));
  end if;
end $$;
drop table if exists interno.rede_mls_boasvindas, interno.rede_mls_info, interno.rede_mls_commits, interno.rede_mls_pacotes;
drop function if exists public.rede_mls_pacotes_publicar(text[]);
drop function if exists public.rede_mls_meus_pacotes();
drop function if exists public.rede_mls_estado(text, integer);
drop function if exists public.rede_mls_pacotes_pegar(text, uuid[]);
drop function if exists public.rede_mls_commit(text, integer, text, text, jsonb);

-- ── 2. As tabelas ─────────────────────────────────────────────────────────────────────────────────────────────────────────

/** O embrulho de um commit: base64 de um dos tamanhos fixos (34 + n + 16, n em 2048, 8192, 32768, 131072) e com a marca 0x47 01. */
create or replace function interno.rede_mls_embrulho_ok(p text) returns boolean language plpgsql immutable set search_path = interno, pg_temp as $$
declare v bytea;
begin
  if p is null or p !~ '^[A-Za-z0-9+/]+={0,2}$' or char_length(p) > 175000 then return false; end if;
  v := decode(p, 'base64');
  return octet_length(v) in (2098, 8242, 32818, 131122) and get_byte(v, 0) = 71 and get_byte(v, 1) = 1;
exception when others then
  return false;
end $$;

-- Cada aparelho de cada conta é uma folha. O nome tem a conta (o banco já sabe quem é do grupo) e um número sorteado no aparelho.
create table if not exists interno.rede_grupo_folhas (
  nome text primary key check (nome ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}:[0-9a-f]{1,16}@alumia[.]invalid$'),
  usuario uuid not null references interno.perfis (id) on delete cascade,
  dia date not null default current_date,
  check (split_part(nome, ':', 1)::uuid = usuario)
);
create index if not exists rede_grupo_folhas_usuario on interno.rede_grupo_folhas (usuario);

-- Pacotes de chave (base64 do KeyPackage). Cada um serve uma vez; até 20 por folha.
create table if not exists interno.rede_grupo_pacotes (
  id uuid primary key default gen_random_uuid(),
  nome text not null references interno.rede_grupo_folhas (nome) on delete cascade,
  pacote text not null check (pacote ~ '^[A-Za-z0-9+/]+={0,2}$' and char_length(pacote) <= 8000),
  dia date not null default current_date
);
create index if not exists rede_grupo_pacotes_nome on interno.rede_grupo_pacotes (nome);

-- O registro dos commits de cada grupo, em ordem. `epoca` é a época a que o commit leva o grupo (o primeiro, 1). Sem autor, sem hora.
create table if not exists interno.rede_grupo_commits (
  grupo text not null check (grupo ~ '^(nucleo:[0-9a-f-]{36}|comunidade:[a-z0-9-]{2,60})$'),
  epoca integer not null check (epoca > 0),
  commit text not null check (interno.rede_mls_embrulho_ok(commit)),
  dia date not null default current_date,
  primary key (grupo, epoca)
);

-- Boas-vindas (Welcome) para cada aparelho posto no grupo. Só aquele aparelho lê; some em 30 dias.
create table if not exists interno.rede_grupo_boasvindas (
  grupo text not null,
  epoca integer not null check (epoca > 0),
  para text not null references interno.rede_grupo_folhas (nome) on delete cascade,
  welcome text not null check (welcome ~ '^[A-Za-z0-9+/]+={0,2}$' and char_length(welcome) <= 400000),
  dia date not null default current_date,
  primary key (grupo, epoca, para)
);

alter table interno.rede_grupo_folhas enable row level security;
alter table interno.rede_grupo_pacotes enable row level security;
alter table interno.rede_grupo_commits enable row level security;
alter table interno.rede_grupo_boasvindas enable row level security;
revoke all on interno.rede_grupo_folhas, interno.rede_grupo_pacotes, interno.rede_grupo_commits, interno.rede_grupo_boasvindas from public;
revoke all on function interno.rede_mls_embrulho_ok(text) from public;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on interno.rede_grupo_folhas, interno.rede_grupo_pacotes, interno.rede_grupo_commits, interno.rede_grupo_boasvindas from anon, authenticated;
    revoke all on function interno.rede_mls_embrulho_ok(text) from anon, authenticated;
  end if;
end $$;
-- Os pedidos de entrar de novo: a folha que está na árvore do grupo mas cujo aparelho ficou sem o grupo (as boas-vindas venceram em
-- 30 dias, ou falharam). O próximo aparelho do grupo que acertar a árvore tira a folha e põe de novo, com boas-vindas novas; o
-- pedido sai quando elas são gravadas. O banco já sabe quem é do grupo e quais folhas cada conta tem: nada de novo.
create table if not exists interno.rede_grupo_reentrar (
  grupo text not null,
  nome text not null references interno.rede_grupo_folhas (nome) on delete cascade,
  dia date not null default current_date,
  primary key (grupo, nome)
);
alter table interno.rede_grupo_reentrar enable row level security;
revoke all on interno.rede_grupo_reentrar from public;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on interno.rede_grupo_reentrar from anon, authenticated;
  end if;
end $$;

-- ── 3. O que o aparelho chama ────────────────────────────────────────────────────────────────────────────────────────────

/**
 * Publica a folha deste aparelho e pacotes de chave dela (até 20 guardados por folha; os que passarem são ignorados). A conta tem
 * até 5 folhas: a 6ª tira a mais antiga (aparelho que não volta mais). Devolve quantos pacotes a folha tem.
 */
create or replace function public.rede_mls_publicar(p_nome text, p_pacotes text[]) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); x text; n integer;
begin
  perform interno.aberta('comunidade');
  if not interno.rede2_membro(v) then perform interno.erro('consentimento'); end if;
  perform interno.limite('rede_mls_pacotes', 30, 60);
  if coalesce(p_nome, '') !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}:[0-9a-f]{1,16}@alumia[.]invalid$'
     or split_part(p_nome, ':', 1)::uuid is distinct from v then
    perform interno.erro('invalido:nome');
  end if;
  if coalesce(array_length(p_pacotes, 1), 0) > 20 then perform interno.erro('invalido:pacotes'); end if;
  insert into rede_grupo_folhas (nome, usuario) values (p_nome, v) on conflict (nome) do update set dia = current_date;
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

/** Quantos pacotes desta folha ainda estão guardados (o aparelho repõe quando fica pouco). Folha de outra conta: 0. */
create or replace function public.rede_mls_meus_pacotes(p_nome text) returns jsonb language plpgsql stable security definer set search_path = interno, pg_temp as $$
begin
  perform interno.aberta('comunidade');
  return jsonb_build_object('pacotes', (select count(*) from rede_grupo_pacotes p join rede_grupo_folhas f on f.nome = p.nome
                                         where p.nome = p_nome and f.usuario = interno.eu()));
end $$;

/**
 * O estado do grupo para quem é membro: a época atual, as contas e as folhas delas, os commits depois de `p_desde` (até 200) e as
 * boas-vindas mais novas feitas para a folha `p_nome` (que tem de ser desta conta). Quem não é membro recebe "nao_encontrado".
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
    'commits', coalesce((select jsonb_agg(jsonb_build_object('epoca', c.epoca, 'commit', c.commit) order by c.epoca)
      from (select * from rede_grupo_commits where grupo = p_grupo and epoca > coalesce(p_desde, 0) order by epoca limit 200) c), '[]'::jsonb),
    'boasvindas', (select jsonb_build_object('epoca', b.epoca, 'welcome', b.welcome) from rede_grupo_boasvindas b
      join rede_grupo_folhas f on f.nome = b.para and f.usuario = v
      where b.grupo = p_grupo and b.para = p_nome order by b.epoca desc limit 1),
    -- As folhas de membros que pediram para entrar de novo (rede_mls_reentrar): quem as tiver na árvore tira e põe de novo.
    'reentrar', coalesce((select jsonb_agg(r.nome order by r.nome) from rede_grupo_reentrar r join rede_grupo_folhas f on f.nome = r.nome
      where r.grupo = p_grupo and f.usuario in (select interno.rede_grupo_membros(p_grupo))), '[]'::jsonb));
end $$;

/**
 * A folha `p_nome` (desta conta) está no grupo para os outros, mas este aparelho não tem o grupo nem boas-vindas que sirvam: pede para
 * entrar de novo. `p_visto`: a época das boas-vindas mais novas que ele viu (0 se nenhuma); se chegaram outras depois, nada muda.
 */
create or replace function public.rede_mls_reentrar(p_grupo text, p_nome text, p_visto integer) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu();
begin
  perform interno.aberta('comunidade');
  if not interno.rede_grupo_membro(p_grupo, v) then perform interno.erro('nao_encontrado'); end if;
  if not exists (select 1 from rede_grupo_folhas where nome = p_nome and usuario = v) then perform interno.erro('invalido:nome'); end if;
  perform interno.limite('rede_mls_reentrar', 30, 60);
  if exists (select 1 from rede_grupo_boasvindas where grupo = p_grupo and para = p_nome and epoca > coalesce(p_visto, 0)) then
    return jsonb_build_object('ok', false, 'novas', true);
  end if;
  delete from rede_grupo_boasvindas where grupo = p_grupo and para = p_nome;
  insert into rede_grupo_reentrar (grupo, nome) values (p_grupo, p_nome) on conflict (grupo, nome) do update set dia = current_date;
  return jsonb_build_object('ok', true);
end $$;

/** Pega um pacote de chave de cada folha pedida que é de um membro do grupo (o pacote sai do banco). */
create or replace function public.rede_mls_pacotes_pegar(p_grupo text, p_nomes text[]) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); x text; saida jsonb := '{}'::jsonb; v_pacote text;
begin
  perform interno.aberta('comunidade');
  if not interno.rede_grupo_membro(p_grupo, v) then perform interno.erro('nao_encontrado'); end if;
  if coalesce(array_length(p_nomes, 1), 0) > 200 then perform interno.erro('invalido:pedido'); end if;
  perform interno.limite('rede_mls_pegar', 120, 60);
  foreach x in array coalesce(p_nomes, '{}') loop
    if not exists (select 1 from rede_grupo_folhas f where f.nome = x and f.usuario <> v and interno.rede_grupo_membro(p_grupo, f.usuario)) then continue; end if;
    v_pacote := null;
    delete from rede_grupo_pacotes where id = (select id from rede_grupo_pacotes where nome = x order by dia, id limit 1 for update skip locked) returning pacote into v_pacote;
    if v_pacote is not null then saida := saida || jsonb_build_object(x, v_pacote); end if;
  end loop;
  return saida;
end $$;

/**
 * Grava o commit embrulhado que leva o grupo à época `p_epoca` (tem de ser a atual + 1: dois aparelhos ao mesmo tempo, o segundo
 * recebe "versao_ocupada", lê o commit do primeiro e tenta de novo) e as boas-vindas ([{para, welcome}], só para folhas de membros).
 */
create or replace function public.rede_mls_commit(p_grupo text, p_epoca integer, p_commit text, p_boasvindas jsonb) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); v_atual integer; b jsonb; v_para text;
begin
  perform interno.aberta('comunidade');
  if not interno.rede_grupo_membro(p_grupo, v) then perform interno.erro('nao_encontrado'); end if;
  perform interno.limite('rede_mls_commit', 60, 60);
  -- Um commit por vez em cada grupo.
  perform pg_advisory_xact_lock(hashtext('rede_mls:' || p_grupo));
  select max(epoca) into v_atual from rede_grupo_commits where grupo = p_grupo;
  if p_epoca is distinct from coalesce(v_atual, 0) + 1 then perform interno.erro('versao_ocupada'); end if;
  if not interno.rede_mls_embrulho_ok(p_commit) then perform interno.erro('invalido:commit'); end if;
  if jsonb_typeof(coalesce(p_boasvindas, '[]'::jsonb)) <> 'array' or jsonb_array_length(coalesce(p_boasvindas, '[]'::jsonb)) > 200 then perform interno.erro('invalido:boasvindas'); end if;
  insert into rede_grupo_commits (grupo, epoca, commit) values (p_grupo, p_epoca, p_commit);
  for b in select * from jsonb_array_elements(coalesce(p_boasvindas, '[]'::jsonb)) loop
    v_para := b ->> 'para';
    if not exists (select 1 from rede_grupo_folhas f where f.nome = v_para and interno.rede_grupo_membro(p_grupo, f.usuario)) then continue; end if;
    if coalesce(b ->> 'welcome', '') !~ '^[A-Za-z0-9+/]+={0,2}$' or char_length(b ->> 'welcome') > 400000 then perform interno.erro('invalido:boasvindas'); end if;
    insert into rede_grupo_boasvindas (grupo, epoca, para, welcome) values (p_grupo, p_epoca, v_para, b ->> 'welcome') on conflict do nothing;
    delete from rede_grupo_reentrar where grupo = p_grupo and nome = v_para;
  end loop;
  return jsonb_build_object('epoca', p_epoca);
end $$;

-- ── 4. Permissões ─────────────────────────────────────────────────────────────────────────────────────────────────────────
do $$
declare f record;
begin
  for f in select p.oid::regprocedure as assinatura from pg_proc p join pg_namespace n on n.oid = p.pronamespace
           where n.nspname = 'public' and p.proname in ('rede_mls_publicar', 'rede_mls_meus_pacotes', 'rede_mls_estado', 'rede_mls_pacotes_pegar', 'rede_mls_commit', 'rede_mls_reentrar') loop
    execute format('revoke all on function %s from public', f.assinatura);
    if exists (select 1 from pg_roles where rolname = 'anon') then
      execute format('revoke all on function %s from anon', f.assinatura);
      execute format('grant execute on function %s to authenticated', f.assinatura);
    end if;
  end loop;
end $$;

select interno.alumia_trancar();
