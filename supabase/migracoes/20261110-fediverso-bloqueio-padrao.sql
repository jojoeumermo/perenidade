-- Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
-- ───────────────────────────── Alumia no Fediverso: o que já nasce bloqueado (Threads e Bridgy Fed) ─────────────────────────────
-- Migração acrescentável: pode rodar mais de uma vez. O mesmo bloco está no fim do install.sql. Roda DEPOIS de
-- 20261109-fediverso-total.sql (usa as tabelas e a função de bloqueio de lá). Teste: scripts/testar-fediverso-banco.mjs.
-- Se um dia 20261109-fediverso-total.sql (ou 2026-11-alumia.sql) for rodado de novo sozinho, rode este arquivo de novo em seguida:
-- aqueles arquivos trazem a versão antiga de public.rede_fed_bloquear, sem a trava do bloqueio fixo, e a de interno.rede_fed_bloqueado.
--
-- Decisão do Instituto: o Threads (Meta) NÃO entra, e sem interruptor (12/11/2026: o interruptor da coordenação, que existia
-- desde 10/11, foi retirado); o Bridgy Fed (a ponte com o Bluesky e com sites) fica DESLIGADO, também sem interruptor. Os dois só
-- mudariam com outra migração.
--
-- O que este arquivo faz:
--   1. Coluna "fixo" em interno.rede_fed_bloqueados: bloqueio "de casa", que a mediação comum não desfaz.
--   2. Semeia threads.net, threads.com e brid.gy como fixos. O bloqueio vale para o domínio e para os subdomínios
--      (www.threads.net, bsky.brid.gy, web.brid.gy, fed.brid.gy), como em interno.rede_fed_bloqueado. Bloquear some com o que
--      havia desses domínios (seguidores, notas guardadas, avisos), igual ao bloqueio feito pela mediação.
--   3. public.rede_fed_bloquear recusa mexer em linha fixa ("bloqueio_fixo"), devolve "fixo" na lista e anota no registro.
--   4. Não há interruptor do Threads: a função public.rede_fed_threads, se existir (de uma versão anterior deste arquivo), é
--      apagada, e a anotação antiga "threads_liberado" em configuracoes também.

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
  v_novos integer := 0; v_n integer;
begin
  insert into interno.rede_fed_bloqueados (dominio, motivo, por, fixo)
  values ('brid.gy', 'Bridgy Fed (ponte com o Bluesky e com sites): desligado por decisão do Instituto.', null, true)
  on conflict (dominio) do nothing;
  get diagnostics v_n = row_count; v_novos := v_novos + v_n;
  update interno.rede_fed_bloqueados set fixo = true where dominio = 'brid.gy' and not fixo;
  -- O Threads não entra, sem exceção (não há interruptor; uma anotação antiga de "liberado" não vale mais).
  insert into interno.rede_fed_bloqueados (dominio, motivo, por, fixo)
  select d, 'Threads (Meta): não federa com a Alumia, por decisão do Instituto. Sem interruptor.', null, true
  from unnest(interno.rede_fed_threads_dominios()) d
  on conflict (dominio) do nothing;
  get diagnostics v_n = row_count; v_novos := v_novos + v_n;
  update interno.rede_fed_bloqueados set fixo = true, motivo = 'Threads (Meta): não federa com a Alumia, por decisão do Instituto. Sem interruptor.'
   where dominio = any(interno.rede_fed_threads_dominios()) and (not fixo or motivo is distinct from 'Threads (Meta): não federa com a Alumia, por decisão do Instituto. Sem interruptor.');
  update interno.configuracoes set valor = valor - 'threads_liberado' where chave = 'fediverso' and valor ? 'threads_liberado';
  if v_novos > 0 then perform interno.rede_fed_bloqueio_faxina(); end if;
end $$;

-- 3. A mediação bloqueia e desbloqueia, menos o que é fixo ───────────────────────────────────────────────────────────────

/**
 * A mediação bloqueia (ou desbloqueia) uma instância inteira: nada entra dela, nada sai para ela, e o que havia dela some (agora
 * também curtidas, impulsos, avisos, seguidores das comunidades e bloqueios dela). Domínio vazio e p_sim nulo: só a lista.
 * Bloqueio fixo (Threads, Bridgy Fed) não muda por aqui nem por lugar nenhum: "bloqueio_fixo".
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

-- 4. Sem interruptor do Threads ─────────────────────────────────────────────────────────────────────────────────────────
-- A versão de 10/11 deste arquivo criava public.rede_fed_threads (a coordenação liberava ou bloqueava o Threads). Não existe mais.
drop function if exists public.rede_fed_threads(boolean);

-- 5. Permissões ─────────────────────────────────────────────────────────────────────────────────────────────────────────
revoke all on function interno.rede_fed_threads_dominios(), interno.rede_fed_bloqueio_faxina(), interno.rede_fed_bloqueado(text) from public;
revoke all on function public.rede_fed_bloquear(text, boolean, text) from public;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on function interno.rede_fed_threads_dominios(), interno.rede_fed_bloqueio_faxina(), interno.rede_fed_bloqueado(text) from anon, authenticated;
    revoke all on function public.rede_fed_bloquear(text, boolean, text) from anon, authenticated;
    grant execute on function public.rede_fed_bloquear(text, boolean, text) to authenticated, service_role;
  end if;
end $$;
