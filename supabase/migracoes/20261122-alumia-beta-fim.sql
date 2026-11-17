-- Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
-- Alumia · Beta fechado · fim: marca no banco que o SQL do beta foi instalado (as quatro migrações de 22/11, na ordem do fim do
-- install.sql: 20261122-alumia-chat.sql, 20261122-alumia-visibilidade.sql, 20261122-alumia-codigo.sql e 20261122-alumia-admin.sql)
-- e passa a porta da entrada em toda função nova. Põe no catálogo o interruptor "fediverso-grupos" (só pelo nome, como os outros):
-- ele sai ligado pelo PADRAO de lib/recursos.ts junto de "fediverso-total" e "alumia-aberta" (decisão de 17/11, "Fediverso em
-- tudo"), e o painel desliga cada um com uma linha ligado=false em interno.recursos_vivos (sem apagar nada).
-- Pode rodar mais de uma vez. Roda por último, depois de todas elas.
-- Serve para conferir de fora, sem entrar no painel, se o SQL do beta já está em produção:
--   POST /rest/v1/rpc/rede_alumia_versao  →  13
-- O Escrever só mostra "Só eu" com a versão 13 (lib/rede/publicar/visibilidade.ts): num banco de antes o post ficaria para os
-- seguidores.
--
-- O que a junta conferiu: nenhuma das quatro redefine função de outra. A do chat redefine interno.rede_fed_avisar,
-- public.rede_fed_servidor, interno.rede_fed_consentimento_historico e public.rede_fed_situacao; a da visibilidade,
-- public.rede_publicar, interno.rede_vida_ve, interno.rede_vida_federa, interno.rede_vida_nasce, public.rede_pub_vida_publicar e
-- public.rede_pub_vida; a do código, public.rede_mod_denunciar (agora com cinco parâmetros), interno.rede3_mod_item e
-- public.rede_fed_mudanca_servidor; a do admin, public.alumia_cadastro_passar. Nenhuma função recebe linha de tabela com valor
-- padrão. Endereço de rede: nada daqui lê ou guarda (decisão de 13/11).
--
-- A entrada continua desligada no banco. Para o beta fechado, interno.alumia_entrada_ligar(true) roda ANTES de publicar o site.

-- ── 1. A versão ───────────────────────────────────────────────────────────────────────────────────────────────────────────
create or replace function public.rede_alumia_versao() returns integer language sql immutable set search_path = interno, pg_temp as $$
  select 13
$$;
revoke all on function public.rede_alumia_versao() from public;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    grant execute on function public.rede_alumia_versao() to anon, authenticated, service_role;
  end if;
end $$;

-- ── 2. O interruptor dos grupos do Fediverso ──────────────────────────────────────────────────────────────────────────────────
-- No catálogo, só pelo nome (como os outros da Alumia). Ligado pelo PADRAO do código; o painel o desliga sem segunda pessoa.
do $$
begin
  if to_regclass('interno.recursos_catalogo') is not null then
    insert into interno.recursos_catalogo (nome, so_pelo_nome) values ('fediverso-grupos', true)
      on conflict (nome) do update set so_pelo_nome = true;
  end if;
end $$;

-- ── 3. A porta ────────────────────────────────────────────────────────────────────────────────────────────────────────────
-- Toda função public.rede_* e public.alumia_* que anon ou authenticated chamam passa pela porta da entrada (as redefinidas pelo
-- beta também: create or replace tira a porta, e esta linha a devolve). "abertas" tem de vir vazia.
do $$
declare v jsonb := interno.alumia_trancar();
begin
  if jsonb_array_length(coalesce(v -> 'abertas', '[]'::jsonb)) > 0 then
    raise warning 'alumia_trancar: função sem porta: %', v -> 'abertas';
  end if;
end $$;
select interno.alumia_trancar();
