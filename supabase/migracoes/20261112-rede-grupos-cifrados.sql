-- ───────────────────────────── Alumia: as chaves dos POSTS RESTRITOS (cifra de grupo, C1) ─────────────────────────────
-- Migração acrescentável: pode rodar mais de uma vez, sem apagar dado nenhum. O mesmo bloco está no fim do install.sql.
-- Documento: docs/rede/POSTS-RESTRITOS.md. Cifra: lib/rede/cifra-grupo.ts. Teste: npm run testar:cifra-grupo.
--
-- O banco guarda só o que é PÚBLICO ou CIFRADO: a parte pública do par de cada pessoa ("g1.<x25519>.<ml-kem>"), as versões da
-- chave de cada grupo e, para cada versão, a chave embrulhada para cada membro ("e1...", que só o aparelho dele abre). A chave
-- do grupo e o texto dos posts nunca passam por aqui em claro.
--
-- Grupos: "nucleo:<uuid>" (rede_nucleo_membros) e "comunidade:<slug>" (rede_comunidade_membros, ativo e não banido). Só membro
-- (18+, interno.rede2_membro) vê as chaves públicas do grupo, pega o próprio embrulho e cria versão nova. A versão nova precisa
-- trazer o embrulho de TODOS os membros que têm chave publicada (inclusive quem cria) e de ninguém mais. Quem sai do grupo não
-- pede mais o estado, e o estado passa a dizer "precisa_nova": o próximo que escrever cria a versão seguinte, que quem saiu não abre.
-- Nada disso conta quem leu nem guarda texto.

-- 1. As tabelas ──────────────────────────────────────────────────────────────────────────────────────────────────────────────
create table if not exists interno.rede_grupo_chaves (
  usuario uuid primary key references interno.perfis (id) on delete cascade,
  publica text not null check (publica ~ '^g1\.[A-Za-z0-9_-]{43}\.[A-Za-z0-9_-]+$' and char_length(publica) = 1626),
  atualizado_em timestamptz not null default now()
);
create table if not exists interno.rede_grupo_versoes (
  grupo text not null check (grupo ~ '^(nucleo:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}|comunidade:[a-z0-9-]{2,60})$'),
  versao integer not null check (versao between 1 and 9999999),
  criado_por uuid references interno.perfis (id) on delete set null,
  criado_em timestamptz not null default now(),
  primary key (grupo, versao)
);
create table if not exists interno.rede_grupo_embrulhos (
  grupo text not null,
  versao integer not null,
  para uuid not null references interno.perfis (id) on delete cascade,
  embrulho text not null check (embrulho ~ '^e1\.' and char_length(embrulho) <= 1600),
  primary key (grupo, versao, para),
  foreign key (grupo, versao) references interno.rede_grupo_versoes (grupo, versao) on delete cascade
);
create index if not exists rede_grupo_embrulhos_para on interno.rede_grupo_embrulhos (para);
alter table interno.rede_grupo_chaves enable row level security;
alter table interno.rede_grupo_versoes enable row level security;
alter table interno.rede_grupo_embrulhos enable row level security;
revoke all on interno.rede_grupo_chaves, interno.rede_grupo_versoes, interno.rede_grupo_embrulhos from public;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on interno.rede_grupo_chaves, interno.rede_grupo_versoes, interno.rede_grupo_embrulhos from anon, authenticated;
  end if;
end $$;

-- 2. Quem é do grupo ──────────────────────────────────────────────────────────────────────────────────────────────────────────
create or replace function interno.rede_grupo_membro(p_grupo text, p_usuario uuid) returns boolean language plpgsql stable security definer set search_path = interno, pg_temp as $$
begin
  if p_usuario is null or not interno.rede2_membro(p_usuario) then return false; end if;
  if p_grupo ~ '^nucleo:[0-9a-f-]{36}$' then return interno.rede2_no_nucleo(substr(p_grupo, 8)::uuid, p_usuario); end if;
  if p_grupo ~ '^comunidade:[a-z0-9-]{2,60}$' then return interno.rede2_na_comunidade(substr(p_grupo, 12), p_usuario); end if;
  return false;
end $$;

/** Os membros do grupo (só os ids), para conferir quem precisa de embrulho. */
create or replace function interno.rede_grupo_membros(p_grupo text) returns setof uuid language sql stable security definer set search_path = interno, pg_temp as $$
  select m.usuario from rede_nucleo_membros m where p_grupo ~ '^nucleo:[0-9a-f-]{36}$' and m.nucleo = substr(p_grupo, 8)::uuid and interno.rede2_membro(m.usuario)
  union
  select m.usuario from rede_comunidade_membros m where p_grupo ~ '^comunidade:[a-z0-9-]{2,60}$' and m.comunidade = substr(p_grupo, 12)
    and m.situacao = 'ativo' and (m.banido_ate is null or m.banido_ate < now()) and interno.rede2_membro(m.usuario)
$$;

-- 3. O que a pessoa chama ────────────────────────────────────────────────────────────────────────────────────────────────────
/** Publica (ou troca) a parte pública do par de grupo desta pessoa. Trocar o par não abre o que veio antes neste aparelho. */
create or replace function public.rede_grupo_chave_publicar(p_publica text) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu();
begin
  perform interno.aberta('comunidade');
  if not interno.rede2_membro(v) then perform interno.erro('consentimento'); end if;
  if coalesce(p_publica, '') !~ '^g1\.[A-Za-z0-9_-]{43}\.[A-Za-z0-9_-]+$' or char_length(p_publica) <> 1626 then perform interno.erro('invalido:publica'); end if;
  perform interno.limite('rede_grupo_chave', 10, 1440);
  insert into rede_grupo_chaves (usuario, publica) values (v, p_publica)
  on conflict (usuario) do update set publica = excluded.publica, atualizado_em = now();
  -- Par novo: os embrulhos feitos para o par antigo não abrem mais; tira-os (quem escrever cria a versão seguinte para o novo).
  delete from rede_grupo_embrulhos where para = v;
  return jsonb_build_object('ok', true);
end $$;

/**
 * O estado do grupo para quem é membro: a versão atual, as partes públicas de quem tem chave publicada, os embrulhos desta pessoa
 * e se é preciso uma versão nova (não há nenhuma; alguém do grupo com chave não tem embrulho na atual; ou há embrulho de quem não é
 * mais do grupo).
 */
create or replace function public.rede_grupo_estado(p_grupo text) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); v_atual integer;
begin
  perform interno.aberta('comunidade');
  if not interno.rede_grupo_membro(p_grupo, v) then perform interno.erro('nao_encontrado'); end if;
  perform interno.limite('rede_grupo_ler', 600, 60);
  select max(versao) into v_atual from rede_grupo_versoes where grupo = p_grupo;
  return jsonb_build_object(
    'atual', v_atual,
    'membros', coalesce((select jsonb_agg(jsonb_build_object('usuario', c.usuario, 'publica', c.publica) order by c.usuario)
                         from rede_grupo_chaves c where c.usuario in (select interno.rede_grupo_membros(p_grupo))), '[]'::jsonb),
    'meus', coalesce((select jsonb_agg(jsonb_build_object('versao', e.versao, 'embrulho', e.embrulho) order by e.versao)
                      from rede_grupo_embrulhos e where e.grupo = p_grupo and e.para = v), '[]'::jsonb),
    'precisa_nova', v_atual is null
      or exists (select 1 from rede_grupo_chaves c where c.usuario in (select interno.rede_grupo_membros(p_grupo))
                 and not exists (select 1 from rede_grupo_embrulhos e where e.grupo = p_grupo and e.versao = v_atual and e.para = c.usuario))
      -- Alguém saiu do grupo e tinha a chave atual: a versão seguinte é a que o deixa de fora (ele não pede mais o estado).
      or exists (select 1 from rede_grupo_embrulhos e where e.grupo = p_grupo and e.versao = v_atual
                 and e.para not in (select interno.rede_grupo_membros(p_grupo))));
end $$;

/**
 * Cria a versão `p_versao` (a atual + 1) da chave do grupo, com `p_embrulhos` = [{para, embrulho}]: exatamente um para cada membro
 * que tem chave publicada (inclusive quem cria). Duas pessoas ao mesmo tempo: a segunda recebe "versao_ocupada" e usa a da primeira.
 */
create or replace function public.rede_grupo_versao_nova(p_grupo text, p_versao integer, p_embrulhos jsonb) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); v_atual integer; v_esperados uuid[]; v_dados uuid[];
begin
  perform interno.aberta('comunidade');
  if not interno.rede_grupo_membro(p_grupo, v) then perform interno.erro('nao_encontrado'); end if;
  if not exists (select 1 from rede_grupo_chaves where usuario = v) then perform interno.erro('sem_chave'); end if;
  perform interno.limite('rede_grupo_versao', 60, 60);
  perform pg_advisory_xact_lock(hashtext('rede_grupo:' || p_grupo));
  select max(versao) into v_atual from rede_grupo_versoes where grupo = p_grupo;
  if p_versao is distinct from coalesce(v_atual, 0) + 1 then perform interno.erro('versao_ocupada'); end if;
  if jsonb_typeof(p_embrulhos) <> 'array' or jsonb_array_length(p_embrulhos) > 5000 then perform interno.erro('invalido:embrulhos'); end if;
  select coalesce(array_agg(c.usuario order by c.usuario), '{}') into v_esperados from rede_grupo_chaves c where c.usuario in (select interno.rede_grupo_membros(p_grupo));
  select coalesce(array_agg(distinct (e ->> 'para')::uuid order by (e ->> 'para')::uuid), '{}') into v_dados from jsonb_array_elements(p_embrulhos) e;
  if v_dados <> v_esperados or jsonb_array_length(p_embrulhos) <> cardinality(v_dados) then perform interno.erro('invalido:membros'); end if;
  insert into rede_grupo_versoes (grupo, versao, criado_por) values (p_grupo, p_versao, v);
  insert into rede_grupo_embrulhos (grupo, versao, para, embrulho)
  select p_grupo, p_versao, (e ->> 'para')::uuid, e ->> 'embrulho' from jsonb_array_elements(p_embrulhos) e;
  return jsonb_build_object('versao', p_versao);
end $$;

-- 4. Permissões ───────────────────────────────────────────────────────────────────────────────────────────────────────────
revoke all on function interno.rede_grupo_membro(text, uuid), interno.rede_grupo_membros(text) from public;
revoke all on function public.rede_grupo_chave_publicar(text), public.rede_grupo_estado(text), public.rede_grupo_versao_nova(text, integer, jsonb) from public;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on function interno.rede_grupo_membro(text, uuid), interno.rede_grupo_membros(text) from anon, authenticated;
    revoke all on function public.rede_grupo_chave_publicar(text), public.rede_grupo_estado(text), public.rede_grupo_versao_nova(text, integer, jsonb) from anon;
    grant execute on function public.rede_grupo_chave_publicar(text), public.rede_grupo_estado(text), public.rede_grupo_versao_nova(text, integer, jsonb) to authenticated;
  end if;
end $$;
