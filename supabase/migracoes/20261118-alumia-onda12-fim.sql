-- Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
-- Alumia · Onda 12 · fim: marca no banco que as migrações da onda 12 foram instaladas (o compositor, a voz e o vídeo, assinar junto
-- e reagir, o perfil com seções e os pacotes iniciais, a comunicação da organização: as migrações 20261118-alumia-o12-*.sql, na
-- ordem do fim do install.sql), põe os interruptores novos no catálogo e a porta da entrada em toda função nova.
-- Pode rodar mais de uma vez. Roda por último, depois de todas elas.
-- Serve para conferir de fora, sem entrar no painel, se o SQL da onda já está em produção:
--   POST /rest/v1/rpc/rede_alumia_versao  →  9
-- O site NÃO exige a versão 9 para abrir: com o banco ainda em 8, o que já existia segue igual e cada função nova que faltar
-- responde "indisponível" na própria tela (o painel de controle mostra "esperada 9 · instalada 8").
--
-- O que entra aqui:
--   · os interruptores novos no catálogo (lib/recursos.ts), só pelo nome e desligados: "alumia-coautoria" (assinar junto, "Fonte?",
--     marcar na foto com aceite e a checagem do Vale o Escrito na nota) e "alumia-video-post" (o vídeo curto no post; a migração da
--     voz e do vídeo já o põe, e aqui ele entra de novo para o catálogo não depender da ordem);
--   · a porta em toda função public.rede_* e public.alumia_* nova.
-- As funções que as frentes deixaram para a junta conferir: nenhuma das cinco migrações redefine uma função de outra, nem a regra de
-- quem vê, e nenhuma redefine interno.alumia_porta_aberta (a lista de 20261115-alumia-o9-transparencia.sql, com a federação e o
-- diretório, continua valendo). A da voz e do vídeo refaz a cota e o painel do espaço com o depósito do álbum (onda 11) e o novo
-- depósito do vídeo; a do perfil refaz rede_perfil_extras, rede_perfil_extras_editar e rede_desc_pacote_pessoa com a mesma
-- assinatura. Nenhuma função recebe linha de tabela com valor padrão. Endereço de rede: nada daqui lê ou guarda (decisão de 13/11).

-- ── 1. A versão ───────────────────────────────────────────────────────────────────────────────────────────────────────────
create or replace function public.rede_alumia_versao() returns integer language sql immutable set search_path = interno, pg_temp as $$
  select 9
$$;
revoke all on function public.rede_alumia_versao() from public;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    grant execute on function public.rede_alumia_versao() to anon, authenticated, service_role;
  end if;
end $$;

-- ── 2. Os interruptores novos ─────────────────────────────────────────────────────────────────────────────────────────────
-- Só pelo nome, como os outros da Alumia: ligar pelo painel pede a confirmação de uma segunda pessoa.
do $$
begin
  if to_regclass('interno.recursos_catalogo') is not null then
    insert into interno.recursos_catalogo (nome, so_pelo_nome) values ('alumia-coautoria', true), ('alumia-video-post', true)
      on conflict (nome) do update set so_pelo_nome = true;
  end if;
end $$;

-- ── 3. A porta ────────────────────────────────────────────────────────────────────────────────────────────────────────────
-- Toda função public.rede_* e public.alumia_* que anon ou authenticated chamam passa pela porta da entrada (as redefinidas pelas
-- frentes também: create or replace tira a porta, e esta linha a devolve). "abertas" tem de vir vazia.
do $$
declare v jsonb := interno.alumia_trancar();
begin
  if jsonb_array_length(coalesce(v -> 'abertas', '[]'::jsonb)) > 0 then
    raise warning 'alumia_trancar: função sem porta: %', v -> 'abertas';
  end if;
end $$;
select interno.alumia_trancar();
