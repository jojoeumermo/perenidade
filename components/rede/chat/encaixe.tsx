// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import { apagarTudoDoChat } from "@/lib/rede/chat/gaveta";
import type { Encaixe } from "../encaixes";

/**
 * Encaixe da F7 (chat privado e núcleo cifrado): o que esta frente pendura nas telas comuns (menu, cartão, compositor, abas, coluna da direita,
 * ajustes, Sair rápido). Tudo o que entrar aqui fica atrás da flag "alumia-chat-grupo" (lib/recursos.ts) e segue as regras de
 * privacidade do PLANO-ALUMIA §6. A exceção é a limpeza do "Sair rápido", que vale sempre: apagar nunca precisa de flag.
 *
 * aoSairRapido: apaga deste aparelho TUDO do chat (o banco IndexedDB inteiro, com a chave do aparelho e a identidade, e o que
 * estiver na memória: chaves de conversa, rascunho, mensagens abertas). Termina em menos de meio segundo e nunca lança. Vem de
 * lib/rede/chat/gaveta.ts, um arquivo sem importações, para não pesar na casca nem depender de baixar código na hora de sair. É
 * a mesma limpeza que lib/rede/chat-chaveiro.ts oferece como apagarTudoDoChat.
 */
export const encaixe: Encaixe = {
  aoSairRapido: [() => apagarTudoDoChat()],
};
