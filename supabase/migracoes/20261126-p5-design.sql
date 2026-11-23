-- ───────────────────────────── Prompt 5 (E1): o interruptor do redesign no catálogo de recursos ─────────────────────────────
-- Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
--
-- Roda depois de 20261125-r3-fim.sql (banco na versão 16) e das migrações do Prompt 5 que vêm antes no install.sql; o
-- 20261126-p5-fim.sql vem por último. Pode rodar mais de uma vez, sem apagar dado nenhum.
-- Teste: npm run testar:p5-design.
--
-- "design-novo" (lib/recursos.ts): o redesign "Caderno aberto" do site do instituto e do painel. Entra no catálogo só pelo nome
-- e sem linha em interno.recursos_vivos, isto é, desligado: ligar pelo painel pede a confirmação de uma segunda pessoa, como
-- todo recurso só pelo nome. Desligado, o site fica exatamente como hoje. A mesma linha está no primeiro insert do catálogo
-- (2026-11-backend-1.sql e install.sql), para o banco montado do zero.
-- Não mexe em rede_alumia_versao nem na lista de exceções da porta.

do $$
begin
  if to_regclass('interno.recursos_catalogo') is not null then
    insert into interno.recursos_catalogo (nome, so_pelo_nome) values ('design-novo', true)
      on conflict (nome) do update set so_pelo_nome = true;
  end if;
end $$;

select interno.alumia_trancar();
