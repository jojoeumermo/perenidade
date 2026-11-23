-- Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
--
-- Alumia · a janela de conversas no canto (recurso "alumia-chat-flutuante", lib/recursos.ts).
-- Roda depois de 20261128-coordenacao-geral.sql. Não mexe na versão nem na lista da porta.
--
-- O recurso sai ligado pelo código (PADRAO). Esta migração só põe o nome no catálogo, para o painel único poder desligá-lo (e
-- ligar de novo na hora: não é "só pelo nome", não há texto, SQL nem revisão esperando). Nenhuma tabela, nenhuma função: a
-- janela não guarda nada no servidor (o estado dela mora na memória da aba). Pode rodar mais de uma vez.
do $$
begin
  if to_regclass('interno.recursos_catalogo') is not null then
    insert into interno.recursos_catalogo (nome, so_pelo_nome) values ('alumia-chat-flutuante', false)
      on conflict (nome) do update set so_pelo_nome = false;
  end if;
end $$;
