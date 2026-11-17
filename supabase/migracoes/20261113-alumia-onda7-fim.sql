-- Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
-- Alumia · Onda 7 · fim: marca no banco que as migrações da onda 7 foram instaladas (as portas do Fediverso, a entrada com o
-- diretório aberto, a identidade pública opcional, o painel de controle, os pedidos P18 a P20 e a linha com regra aberta: as
-- migrações 20261113-alumia-o7-*.sql, na ordem do fim do install.sql).
-- Pode rodar mais de uma vez. Roda por último, depois de todas elas.
-- Serve para conferir de fora, sem entrar no painel, se o SQL da onda já está em produção:
--   POST /rest/v1/rpc/rede_alumia_versao  →  4
-- O site NÃO exige a versão 4 para abrir: com o banco ainda em 3, o que já existia segue igual e cada função nova que faltar
-- responde "indisponível" na própria tela (o painel de controle mostra "esperada 4 · instalada 3").
create or replace function public.rede_alumia_versao() returns integer language sql immutable set search_path = interno, pg_temp as $$
  select 4
$$;
revoke all on function public.rede_alumia_versao() from public;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    grant execute on function public.rede_alumia_versao() to anon, authenticated, service_role;
  end if;
end $$;

-- A porta da entrada nas funções novas da onda: a regra passa de novo por todas as public.rede_* e public.alumia_* (as que estão
-- na lista de exceções, como o diretório das organizações e as do servidor da federação, ficam como estão). Se alguma não puder
-- ser trancada, avisa qual (e interno.alumia_entrada_ligar(true) se recusa a ligar a trava enquanto houver porta aberta).
do $$
declare v jsonb := interno.alumia_trancar();
begin
  if jsonb_array_length(v -> 'abertas') > 0 then
    raise warning 'alumia_trancar: função sem porta: %', v -> 'abertas';
  end if;
end $$;
