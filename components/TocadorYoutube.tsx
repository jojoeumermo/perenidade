// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useState } from "react";

/**
 * A cópia de uma aula (ou a transmissão ao vivo) no canal do instituto no YouTube. Nada do Google carrega até a pessoa
 * clicar: antes disso é só um quadro do site. Depois, o tocador vem pelo domínio sem cookies de propaganda.
 */
export function TocadorYoutube({ id, titulo, aoVivo = false, textos }: { id: string; titulo: string; aoVivo?: boolean; textos: { assistir: string; aviso: string } }) {
  const [carregado, setCarregado] = useState(false);
  if (!/^[A-Za-z0-9_-]{11}$/.test(id)) return null;
  return (
    <div className="no-print">
      <div className="relative aspect-video max-w-full overflow-hidden border-2 border-ink bg-[#17130e]">
        {carregado ? (
          <iframe
            src={`https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0&hl=pt-BR&cc_lang_pref=pt`}
            title={titulo}
            referrerPolicy="strict-origin-when-cross-origin"
            sandbox="allow-scripts allow-same-origin allow-presentation allow-popups"
            allow="autoplay; fullscreen; picture-in-picture; encrypted-media"
            allowFullScreen
            className="absolute inset-0 h-full w-full"
          />
        ) : (
          <button type="button" onClick={() => setCarregado(true)} className="group absolute inset-0 flex cursor-pointer flex-col items-center justify-center gap-4 p-6 text-center text-[#f4ecd8]">
            <span aria-hidden className={`flex h-16 w-16 items-center justify-center rounded-full ${aoVivo ? "bg-[#c21f16]" : "bg-[#f4ecd8] text-[#17130e]"} transition-transform group-hover:scale-110`}>
              <svg viewBox="0 0 24 24" className="ml-1 h-7 w-7" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>
            </span>
            <span className="font-sans text-lg font-bold">{textos.assistir}</span>
            <span className="max-w-md font-sans text-xs text-[#b3a584]">{textos.aviso}</span>
          </button>
        )}
      </div>
    </div>
  );
}
