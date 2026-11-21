-- Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
-- Alumia · Prompt 4 · as chamadas (itens 139 e 140) e a sala de vídeo do painel no LiveKit (item 141), atrás dos interruptores
-- "alumia-p4-chamadas" e "sala-livekit".
--
-- Roda depois de 20261126-p5-fim.sql (banco na versão 17), junto das outras 20261127-p4-*; quem junta põe esta antes do
-- 20261127-p4-fim.sql, que continua o último. Não mexe em rede_alumia_versao nem na lista de exceções da porta.
--
-- O que faz: só os dois interruptores no catálogo (só pelo nome, desligados), para o painel único poder ligá-los. Nada mais, de
-- propósito:
--   139 e 140  a chamada de voz e de vídeo da conversa a dois mora no APARELHO: o toque viaja DENTRO do cifrado do chat (o servidor
--              não sabe que houve chamada), a combinação vai cifrada pelo canal de combinação (só blocos cifrados) e o áudio e o vídeo
--              vão direto entre os aparelhos, sempre por retransmissão, cifrados ponta a ponta (DTLS-SRTP). Nenhuma tabela, nenhum
--              registro de chamada (feita, recebida ou perdida);
--   141        a sala de vídeo do painel no LiveKit usa as mesmas regras de entrada de hoje (interno.reuniao_entra e o canal da equipe)
--              e o nome de sala que já está guardado: nenhuma mudança no banco (pedido do próprio item).
--
-- Nenhuma função nova, nenhuma função existente redefinida, nenhuma tabela. Endereço de rede: nada daqui lê ou guarda. Pode rodar
-- mais de uma vez, sem apagar dado nenhum.
-- Lei: LGPD art. 6º, III (necessidade: o servidor não guarda nada da chamada) e art. 46 (segurança: ponta a ponta).
-- Teste: npm run testar:p4-chamadas.

do $$
begin
  if to_regclass('interno.recursos_catalogo') is not null then
    insert into interno.recursos_catalogo (nome, so_pelo_nome) values ('alumia-p4-chamadas', true), ('sala-livekit', true)
      on conflict (nome) do update set so_pelo_nome = true;
  end if;
end $$;

select interno.alumia_trancar();
