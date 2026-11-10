-- Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
-- ───────────────────────────── Alumia no Fediverso: o que já nasce bloqueado (Threads e Bridgy Fed) ─────────────────────────────
-- Migração acrescentável: pode rodar mais de uma vez. O mesmo bloco está no fim do install.sql. Roda DEPOIS de
-- 20261109-fediverso-total.sql (usa as tabelas e a função de bloqueio de lá). Teste: scripts/testar-fediverso-banco.mjs.
-- Se um dia 20261109-fediverso-total.sql (ou 2026-11-alumia.sql) for rodado de novo sozinho, rode este arquivo de novo em seguida:
-- aqueles arquivos trazem a versão antiga de public.rede_fed_bloquear, sem a trava do bloqueio fixo, e a de interno.rede_fed_bloqueado.
--
-- Decisão do Instituto (10/11/2026): o Threads (Meta) fica BLOQUEADO, com um interruptor na moderação que só a coordenação mexe;
-- o Bridgy Fed (a ponte com o Bluesky e com sites) fica DESLIGADO, sem interruptor: só muda com outra migração.
--
-- O que este arquivo faz:
--   1. Coluna "fixo" em interno.rede_fed_bloqueados: bloqueio "de casa", que a mediação comum não desfaz.
--   2. Semeia threads.net, threads.com e brid.gy como fixos. O bloqueio vale para o domínio e para os subdomínios
--      (www.threads.net, bsky.brid.gy, web.brid.gy, fed.brid.gy), como em interno.rede_fed_bloqueado. Bloquear some com o que
--      havia desses domínios (seguidores, notas guardadas, avisos), igual ao bloqueio feito pela mediação.
--   3. public.rede_fed_bloquear recusa mexer em linha fixa ("bloqueio_fixo"), devolve "fixo" na lista e anota no registro.
--   4. public.rede_fed_threads: o interruptor do Threads. A mediação vê o estado; só a coordenação (e a vice) muda. Se a
--      coordenação liberar o Threads, fica anotado em configuracoes ("fediverso" › "threads_liberado") e rodar este arquivo de
--      novo NÃO bloqueia de volta.

-- 1. O bloqueio fixo ─────────────────────────────────────────────────────────────────────────────────────────────────────
alter table interno.rede_fed_bloqueados add column if not exists fixo boolean not null default false;

/** Os domínios do Threads: as contas federam por threads.net; threads.com é o endereço novo do site, bloqueado por garantia. */
create or replace function interno.rede_fed_threads_dominios() returns text[] language sql immutable as $$
  select array['threads.net', 'threads.com']
$$;

/**
 * A instância deste endereço está bloqueada (ela ou um subdomínio dela)? Igual à de 2026-11-alumia.sql, mas sem deixar passar o
 * mesmo domínio escrito de outro jeito: com ponto no fim (https://threads.net./...) ou com usuário (e senha) na frente (https://x@threads.net/...).
 */
create or replace function interno.rede_fed_bloqueado(p_url text) returns boolean language sql stable security definer set search_path = interno, pg_temp as $$
  select exists (select 1 from rede_fed_bloqueados b, lateral (select rtrim(lower(substring(coalesce(p_url, '') from '^https://(?:[^/?#]*@)?([^/:?#]+)')), '.') as d) x
                 where x.d = b.dominio or x.d like '%.' || b.dominio)
$$;

/** Tira o que havia das instâncias bloqueadas: nada delas fica guardado e nada mais sai para elas. */
create or replace function interno.rede_fed_bloqueio_faxina() returns void language plpgsql volatile security definer set search_path = interno, pg_temp as $$
begin
  delete from rede_fed_seguidores where interno.rede_fed_bloqueado(ator);
  delete from rede_fed_seguindo where interno.rede_fed_bloqueado(ator);
  delete from rede_fed_recebidos where interno.rede_fed_bloqueado(ator);
  delete from rede_fed_remotos where interno.rede_fed_bloqueado(ator);
  delete from fediverso_interacoes where interno.rede_fed_bloqueado(ator) or interno.rede_fed_bloqueado(objeto_remoto);
  delete from fediverso_grupo_seguidores where interno.rede_fed_bloqueado(ator);
  delete from fediverso_bloqueios_recebidos where interno.rede_fed_bloqueado(ator);
  delete from avisos where ator_remoto is not null and interno.rede_fed_bloqueado(ator_remoto);
  update rede_fed_fila set feito_em = now(), erro = 'instancia_bloqueada' where feito_em is null and interno.rede_fed_bloqueado(destino);
end $$;

-- 2. A semente ───────────────────────────────────────────────────────────────────────────────────────────────────────────
do $$
declare
  v_liberado boolean := coalesce((select valor ->> 'threads_liberado' from interno.configuracoes where chave = 'fediverso'), '') = 'true';
  v_novos integer := 0; v_n integer;
begin
  insert into interno.rede_fed_bloqueados (dominio, motivo, por, fixo)
  values ('brid.gy', 'Bridgy Fed (ponte com o Bluesky e com sites): desligado por decisão do Instituto.', null, true)
  on conflict (dominio) do nothing;
  get diagnostics v_n = row_count; v_novos := v_novos + v_n;
  update interno.rede_fed_bloqueados set fixo = true where dominio = 'brid.gy' and not fixo;
  -- O Threads só entra se a coordenação não o liberou pelo interruptor.
  if not v_liberado then
    insert into interno.rede_fed_bloqueados (dominio, motivo, por, fixo)
    select d, 'Threads (Meta): bloqueado por decisão do Instituto. Só a coordenação liga ou desliga.', null, true
    from unnest(interno.rede_fed_threads_dominios()) d
    on conflict (dominio) do nothing;
    get diagnostics v_n = row_count; v_novos := v_novos + v_n;
    update interno.rede_fed_bloqueados set fixo = true where dominio = any(interno.rede_fed_threads_dominios()) and not fixo;
  end if;
  if v_novos > 0 then perform interno.rede_fed_bloqueio_faxina(); end if;
end $$;

-- 3. A mediação bloqueia e desbloqueia, menos o que é fixo ───────────────────────────────────────────────────────────────

/**
 * A mediação bloqueia (ou desbloqueia) uma instância inteira: nada entra dela, nada sai para ela, e o que havia dela some (agora
 * também curtidas, impulsos, avisos, seguidores das comunidades e bloqueios dela). Domínio vazio e p_sim nulo: só a lista.
 * Bloqueio fixo (Threads, Bridgy Fed) não muda por aqui: "bloqueio_fixo". O do Threads muda em public.rede_fed_threads.
 */
create or replace function public.rede_fed_bloquear(p_dominio text, p_sim boolean, p_motivo text default '') returns jsonb
language plpgsql volatile security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); v_d text := lower(btrim(coalesce(p_dominio, '')));
begin
  if not (interno.media() or interno.cuida()) then perform interno.erro('sem_permissao'); end if;
  if v_d = '' and p_sim is null then
    return coalesce((select jsonb_agg(jsonb_build_object('dominio', dominio, 'motivo', motivo, 'desde', criado_em, 'fixo', fixo) order by dominio) from rede_fed_bloqueados), '[]'::jsonb);
  end if;
  if v_d !~ '^[a-z0-9.-]{3,253}$' or v_d !~ '\.' then perform interno.erro('invalido:dominio'); end if;
  if exists (select 1 from rede_fed_bloqueados where dominio = v_d and fixo) then perform interno.erro('bloqueio_fixo'); end if;
  if coalesce(p_sim, true) then
    insert into rede_fed_bloqueados (dominio, motivo, por) values (v_d, left(coalesce(p_motivo, ''), 300), v)
    on conflict (dominio) do update set motivo = excluded.motivo, por = excluded.por, criado_em = now();
    perform interno.rede_fed_bloqueio_faxina();
    perform interno.registrar('rede_fed_instancia_bloqueada', v_d);
  else
    delete from rede_fed_bloqueados where dominio = v_d;
    if found then perform interno.registrar('rede_fed_instancia_desbloqueada', v_d); end if;
  end if;
  return coalesce((select jsonb_agg(jsonb_build_object('dominio', dominio, 'motivo', motivo, 'desde', criado_em, 'fixo', fixo) order by dominio) from rede_fed_bloqueados), '[]'::jsonb);
end $$;

-- 4. O interruptor do Threads ────────────────────────────────────────────────────────────────────────────────────────────

/**
 * O interruptor do Threads na moderação. Sem argumento (ou nulo): só o estado, para quem media ou cuida. Com true ou false:
 * bloqueia ou libera o Threads, e só a coordenação (e a vice) pode. O Bridgy Fed não tem interruptor.
 * Devolve { bloqueado, pode_mudar }.
 */
create or replace function public.rede_fed_threads(p_bloquear boolean default null) returns jsonb
language plpgsql volatile security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); v_dominios text[] := interno.rede_fed_threads_dominios();
begin
  if not (interno.media() or interno.cuida()) then perform interno.erro('sem_permissao'); end if;
  if p_bloquear is not null then
    if not interno.coord() then perform interno.erro('sem_permissao'); end if;
    perform interno.limite('rede_fed_threads', 10, 60);
    if p_bloquear then
      insert into rede_fed_bloqueados (dominio, motivo, por, fixo)
      select d, 'Threads (Meta): bloqueado por decisão do Instituto. Só a coordenação liga ou desliga.', v, true from unnest(v_dominios) d
      on conflict (dominio) do update set motivo = excluded.motivo, por = excluded.por, fixo = true, criado_em = now();
      perform interno.rede_fed_bloqueio_faxina();
      update configuracoes set valor = valor - 'threads_liberado' where chave = 'fediverso';
      perform interno.registrar('rede_fed_threads_bloqueado', 'threads.net');
    else
      delete from rede_fed_bloqueados where dominio = any(v_dominios);
      insert into configuracoes (chave, valor) values ('fediverso', '{"threads_liberado": true}'::jsonb)
      on conflict (chave) do update set valor = configuracoes.valor || excluded.valor;
      perform interno.registrar('rede_fed_threads_liberado', 'threads.net');
    end if;
  end if;
  return jsonb_build_object(
    'bloqueado', (select count(*) = cardinality(v_dominios) from rede_fed_bloqueados where dominio = any(v_dominios)),
    'pode_mudar', interno.coord());
end $$;

-- 5. Permissões ─────────────────────────────────────────────────────────────────────────────────────────────────────────
revoke all on function interno.rede_fed_threads_dominios(), interno.rede_fed_bloqueio_faxina(), interno.rede_fed_bloqueado(text) from public;
revoke all on function public.rede_fed_bloquear(text, boolean, text), public.rede_fed_threads(boolean) from public;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on function interno.rede_fed_threads_dominios(), interno.rede_fed_bloqueio_faxina(), interno.rede_fed_bloqueado(text) from anon, authenticated;
    revoke all on function public.rede_fed_bloquear(text, boolean, text), public.rede_fed_threads(boolean) from anon, authenticated;
    grant execute on function public.rede_fed_bloquear(text, boolean, text), public.rede_fed_threads(boolean) to authenticated, service_role;
  end if;
end $$;
