// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { vozesNaturaisPossiveis } from "./vozes/catalogo";
import { iniciar, parar, useLeitor } from "./vozes/leitor";

// Leitura em voz alta: nada sai do aparelho. A voz é a escolhida no "Ouvir a aula" (a do aparelho ou uma natural, que
// também roda no aparelho); o leitor de verdade está em lib/vozes/leitor.ts. Aqui ficam os nomes que o resto do site usa.

/** Há como ler em voz alta aqui? No modo leitor (Kindle e tinta eletrônica) nunca aparece. */
export function speechSupported(): boolean {
  if (typeof window === "undefined" || document.documentElement.hasAttribute("data-leitor")) return false;
  return "speechSynthesis" in window || vozesNaturaisPossiveis();
}

export function useSpeaking(): boolean {
  return useLeitor().ativo;
}

/** Lê o trecho selecionado ou, sem seleção, o texto dos `alvos` (seletores CSS, na ordem); sem alvos, a página inteira. */
export function startReading(alvos?: string[]) {
  if (!speechSupported()) return;
  void iniciar(alvos);
}

export function stopReading() {
  parar();
}
