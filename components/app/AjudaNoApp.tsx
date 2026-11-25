// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { alternarAssistente } from "../assistente/BotaoDoAssistente";

/**
 * Entrada para as perguntas frequentes dentro do app (aba Eu). No visual do app o botão "?" flutuante some (ele cobria
 * texto no fim das telas); a janela é a mesma e abre pelo evento que o próprio botão escuta.
 */
export function AjudaNoApp({ titulo }: { titulo: string }) {
  return (
    <button type="button" onClick={alternarAssistente} data-ajuda-do-app="" className="app-cartao app-atalho-ajuda">
      <span className="app-cartao-titulo app-cartao-titulo-menor">{titulo}</span>
    </button>
  );
}
