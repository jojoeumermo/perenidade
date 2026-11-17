-- Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
-- Alumia · Integração das duas faixas · fim: marca no banco que o SQL final foi instalado (as ondas 5 a 14, a Faixa 2 com o
-- Fediverso e o chat cifrado, e as duas migrações da integração: 20261121-alumia-int-resumo.sql e 20261121-alumia-integracao.sql,
-- na ordem do fim do install.sql) e passa a porta da entrada em toda função nova. Põe no catálogo o interruptor "alumia-aberta"
-- (só pelo nome), para o painel poder desligá-lo: ele e "fediverso-total" saem ligados pelo PADRAO de lib/recursos.ts, e o painel
-- desliga cada um com uma linha ligado=false em interno.recursos_vivos (sem apagar nada).
-- Pode rodar mais de uma vez. Roda por último, depois de todas elas.
-- Serve para conferir de fora, sem entrar no painel, se o SQL final já está em produção:
--   POST /rest/v1/rpc/rede_alumia_versao  →  12
-- O site NÃO exige a versão 12 para abrir: com o banco ainda em 11, o que já existia segue igual (o painel de controle mostra
-- "esperada 12 · instalada 11").
--
-- O que a junta conferiu: a do resumo só redefine as duas funções do resumo das comunidades (alumia_pontes_resumo_ver e
-- alumia_pontes_resumo_salvar), a da integração só as quatro do post cifrado (rede_publicar, rede_post_v2, rede_fed_federavel e
-- alumia_alc_sai), e a da espera do chat da equipe (20261121-equipe-chat-espera.sql, revisão de 17/11) só as do aparelho da equipe
-- (chat_aparelho_json, chat_aparelho_registrar, chat_aparelho_recuperar, chat_identidade_definir, chat_aparelho_aprovar,
-- chat_aparelho_pedir, chat_aparelhos_meus, equipe_chat_meu e equipe_de); nenhuma redefine função da outra. As funções public.chat_* e public.equipe_chat_* são do chat da equipe (o
-- painel), com a conferência própria de aparelho aprovado: ficam fora da porta da Alumia. Nenhuma função recebe linha de tabela
-- com valor padrão. Endereço de rede: nada daqui lê ou guarda (decisão de 13/11).

-- ── 1. A versão ───────────────────────────────────────────────────────────────────────────────────────────────────────────
create or replace function public.rede_alumia_versao() returns integer language sql immutable set search_path = interno, pg_temp as $$
  select 12
$$;
revoke all on function public.rede_alumia_versao() from public;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    grant execute on function public.rede_alumia_versao() to anon, authenticated, service_role;
  end if;
end $$;

-- ── 2. O interruptor da Alumia aberta ─────────────────────────────────────────────────────────────────────────────────────────
-- No catálogo, só pelo nome (como os outros da Alumia). Ligado pelo PADRAO do código; o painel o desliga sem segunda pessoa.
do $$
begin
  if to_regclass('interno.recursos_catalogo') is not null then
    insert into interno.recursos_catalogo (nome, so_pelo_nome) values ('alumia-aberta', true)
      on conflict (nome) do update set so_pelo_nome = true;
  end if;
end $$;

-- ── 3. A porta ────────────────────────────────────────────────────────────────────────────────────────────────────────────
-- Toda função public.rede_* e public.alumia_* que anon ou authenticated chamam passa pela porta da entrada (as redefinidas pela
-- integração também: create or replace tira a porta, e esta linha a devolve). "abertas" tem de vir vazia.
do $$
declare v jsonb := interno.alumia_trancar();
begin
  if jsonb_array_length(coalesce(v -> 'abertas', '[]'::jsonb)) > 0 then
    raise warning 'alumia_trancar: função sem porta: %', v -> 'abertas';
  end if;
end $$;
select interno.alumia_trancar();
