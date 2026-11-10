-- Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
-- Alumia · Onda 5 · fim: marca no banco que a onda inteira (F0, F1–F5 e a rodada de UI/UX de 10/11) foi instalada.
-- Pode rodar mais de uma vez. Roda por último, depois de todas as migrações 20261109-alumia-* e 20261110-alumia-*.
-- Serve para conferir de fora, sem entrar no painel, se o SQL da onda já está em produção:
--   POST /rest/v1/rpc/rede_alumia_versao  →  2
create or replace function public.rede_alumia_versao() returns integer language sql immutable set search_path = interno, pg_temp as $$
  select 2
$$;
revoke all on function public.rede_alumia_versao() from public;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    grant execute on function public.rede_alumia_versao() to anon, authenticated, service_role;
  end if;
end $$;
