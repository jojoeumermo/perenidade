-- Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
-- Alumia · Onda 6 (B1) · fim: marca no banco que o back-end completo das telas foi instalado (B1 dos atos, do perfil e das
-- organizações, dos stories, da casca e da comunidade: as cinco migrações 20261110-alumia-b1-*.sql, nessa ordem).
-- Pode rodar mais de uma vez. Roda por último, depois de todas elas.
-- Serve para conferir de fora, sem entrar no painel, se o SQL da onda já está em produção:
--   POST /rest/v1/rpc/rede_alumia_versao  →  3
-- O site NÃO exige a versão 3 para abrir: com o banco ainda em 2, o que já existia segue igual e cada função nova que faltar
-- responde "indisponível" na própria tela.
create or replace function public.rede_alumia_versao() returns integer language sql immutable set search_path = interno, pg_temp as $$
  select 3
$$;
revoke all on function public.rede_alumia_versao() from public;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    grant execute on function public.rede_alumia_versao() to anon, authenticated, service_role;
  end if;
end $$;
