// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

/** O botão de imprimir das folhas (zine, kit do núcleo). No papel, ele mesmo some. */
export function BotaoImprimir({ texto }: { texto: string }) {
  return (
    <button type="button" onClick={() => window.print()} className="no-print cursor-pointer bg-ink px-5 py-2.5 font-sans font-semibold text-parchment hover:bg-oxblood">
      {texto}
    </button>
  );
}
