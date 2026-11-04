// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useConsertos } from "./contexto";

/**
 * O botão "Escrever" no celular e no tablet. No computador (xl) o botão fica no menu da esquerda; abaixo disso o menu vira uma
 * faixa e o botão sumia. Este fica fixo no canto, acima da barra de baixo do site, a um toque do polegar (alvo de 48 px).
 */
export function BotaoEscrever({ aoClicar }: { aoClicar: () => void }) {
  const x = useConsertos();
  return (
    <button
      type="button"
      onClick={aoClicar}
      className="fixed right-4 bottom-[calc(5rem+env(safe-area-inset-bottom))] z-30 flex min-h-12 cursor-pointer items-center gap-2 rounded-full bg-[#c21f16] px-5 py-3 font-sans text-base font-bold text-white shadow-[3px_3px_0_var(--ink)] xl:hidden"
    >
      <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
        <path d="M12 5v14M5 12h14" />
      </svg>
      {x.escrever}
    </button>
  );
}
