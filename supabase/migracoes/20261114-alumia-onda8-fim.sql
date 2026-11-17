-- Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
-- Alumia · Onda 8 · fim: marca no banco que as migrações da onda 8 foram instaladas (a conta segura, a lei e a ajuda, os meus
-- dados, o voto secreto, a porta de entrada e a operação: as migrações 20261114-alumia-o8-*.sql, na ordem do fim do install.sql).
-- Pode rodar mais de uma vez. Roda por último, depois de todas elas.
-- Serve para conferir de fora, sem entrar no painel, se o SQL da onda já está em produção:
--   POST /rest/v1/rpc/rede_alumia_versao  →  5
-- O site NÃO exige a versão 5 para abrir: com o banco ainda em 4, o que já existia segue igual e cada função nova que faltar
-- responde "indisponível" na própria tela (o painel de controle mostra "esperada 5 · instalada 4").
create or replace function public.rede_alumia_versao() returns integer language sql immutable set search_path = interno, pg_temp as $$
  select 5
$$;
revoke all on function public.rede_alumia_versao() from public;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    grant execute on function public.rede_alumia_versao() to anon, authenticated, service_role;
  end if;
end $$;

-- As exceções novas da porta (o pedido de revisão de quem teve a conta suspensa ou retida e a marca de convite da triagem) saem da
-- porta, se uma migração rodada antes da lista nova já as tinha trancado (por exemplo, a da porta de entrada rodada sozinha antes
-- da lei). interno.alumia_destrancar vem de 20261113-alumia-o7-portas-fediverso.sql; função que não foi trancada fica como está.
do $$
declare f text;
begin
  foreach f in array array['alumia_lei_minha_conta', 'alumia_lei_recorrer_conta', 'alumia_triagem_convites'] loop
    if interno.alumia_porta_aberta(f, null) then perform interno.alumia_destrancar(f); end if;
  end loop;
end $$;

-- A porta da entrada nas funções novas da onda: a regra passa de novo por todas as public.rede_* e public.alumia_* (as que estão
-- na lista de exceções ficam como estão). Se alguma não puder ser trancada, avisa qual (e interno.alumia_entrada_ligar(true) se
-- recusa a ligar a trava enquanto houver porta aberta).
do $$
declare v jsonb := interno.alumia_trancar();
begin
  if jsonb_array_length(v -> 'abertas') > 0 then
    raise warning 'alumia_trancar: função sem porta: %', v -> 'abertas';
  end if;
end $$;
