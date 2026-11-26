// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { radio, usePlayer } from "@/lib/radio";

/**
 * O botão de ouvir de uma emissora no aplicativo (/app/eu/radio). Usa o MESMO tocador do site (lib/radio, montado em
 * app/[lang]/layout.tsx): o som sai direto da emissora e segue tocando ao navegar pelo app. Mesmo id e mesma fila de
 * components/RadioPage.tsx (emissora-<id>), então tocar no site e no app é a mesma coisa. Som não provado em aparelho real.
 */
export function TocarEmissora({ id, nome, lugar, url, ouvir, pausar }: { id: string; nome: string; lugar: string; url: string; ouvir: string; pausar: string }) {
  const { queue, index, playing } = usePlayer();
  const idDaFila = `emissora-${id}`;
  const eAtual = queue[index]?.id === idDaFila;
  const tocando = eAtual && playing;
  const tocar = () => {
    if (eAtual) radio.toggle();
    else radio.play([{ id: idDaFila, titulo: nome, artista: lugar, url, live: true }], 0);
  };
  return (
    <button type="button" onClick={tocar} aria-pressed={tocando} aria-label={`${tocando ? pausar : ouvir}: ${nome}`} className="app-radio-tocar" data-tocar-emissora={id}>
      <svg viewBox="0 0 20 20" aria-hidden width="18" height="18">
        {tocando ? (
          <>
            <rect x="4" y="3" width="4" height="14" fill="currentColor" />
            <rect x="12" y="3" width="4" height="14" fill="currentColor" />
          </>
        ) : (
          <path d="M5 3 L17 10 L5 17 Z" fill="currentColor" />
        )}
      </svg>
    </button>
  );
}
