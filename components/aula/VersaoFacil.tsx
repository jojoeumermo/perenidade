// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useState, type ReactNode } from "react";
import type { TextosDaAula } from "@/i18n/escola/aula";

/**
 * A versão fácil (Etapa 4, R1-88): quando existe "<aula>.facil.md" ao lado da aula (escrita e revisada por
 * educadores), aparece "Ler versão fácil", que mostra o outro texto no mesmo lugar; "Voltar ao texto completo" desfaz.
 * Os dois textos vêm montados do servidor: o completo aparece primeiro (busca, impressão e sem JavaScript), o fácil fica
 * guardado até o clique.
 */
export function VersaoFacil({ completo, facil, s }: { completo: ReactNode; facil: ReactNode; s: TextosDaAula["facil"] }) {
  const [ligada, setLigada] = useState(false);
  return (
    <>
      <p className="versao-facil no-print no-leitor">
        <button
          type="button"
          aria-pressed={ligada}
          aria-controls="texto-da-aula texto-facil"
          onClick={() => {
            setLigada(!ligada);
            window.getSelection()?.removeAllRanges();
          }}
        >
          <svg aria-hidden viewBox="0 0 24 24" className="h-5 w-5 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            {ligada ? <path d="M15 5l-7 7 7 7" /> : <path d="M4 5h11a4 4 0 0 1 4 4v10H8a4 4 0 0 1-4-4zM8 10h7M8 14h5" />}
          </svg>
          {ligada ? s.voltar : s.ler}
        </button>
      </p>
      <div hidden={ligada}>{completo}</div>
      <div id="texto-facil" className="mt-8" hidden={!ligada}>
        <p className="border-l-4 border-gold pl-3 font-sans text-sm text-ink-soft">{s.aviso}</p>
        {facil}
      </div>
    </>
  );
}
