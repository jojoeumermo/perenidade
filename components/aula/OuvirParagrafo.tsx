// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import type { TextosDaAula } from "@/i18n/escola/aula";
import { speechSupported, startReading, stopReading, useSpeaking } from "@/lib/speech";

const nada = () => () => {};

interface Ponto {
  n: string;
  onde: HTMLElement;
}

/** O alto-falante em traço, no estilo dos ícones de components/celular/Atalhos.tsx. */
export function IconeAltoFalante({ falando = false }: { falando?: boolean }) {
  return (
    <svg aria-hidden viewBox="0 0 24 24" className="h-5 w-5 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      {falando ? <rect x="7" y="7" width="10" height="10" rx="1" /> : <path d="M4 9h4l5-4v14l-5-4H4zM16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12" />}
    </svg>
  );
}

/**
 * Ouvir antes de ler (Etapa 4, R1-87): nas aulas e trilhas de alfabetização, cada parágrafo ganha um botão "Ouvir" com
 * o alto-falante, que lê só aquele parágrafo com o mesmo leitor do "Ouvir a aula" (lib/vozes/leitor.ts). Os botões
 * entram ao lado dos parágrafos já montados (o texto continua o mesmo para a busca, a impressão e o leitor de tinta).
 */
export function OuvirParagrafo({ raiz, s }: { raiz: string; s: TextosDaAula["ouvir"] }) {
  const pode = useSyncExternalStore(nada, speechSupported, () => false);
  const falando = useSpeaking();
  const [pontos, setPontos] = useState<Ponto[]>([]);
  const [lendo, setLendo] = useState<string | null>(null);

  useEffect(() => {
    if (!pode) return;
    const criados: Ponto[] = [];
    for (const p of document.querySelectorAll<HTMLElement>(`${raiz} p[data-p]`)) {
      if (!(p.textContent ?? "").trim()) continue;
      const onde = document.createElement("div");
      onde.className = "ouvir-paragrafo no-print no-leitor";
      onde.setAttribute("data-ouvir", "");
      p.parentElement?.insertBefore(onde, p);
      criados.push({ n: p.getAttribute("data-p") ?? "", onde });
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect -- os parágrafos só existem depois que o texto está na tela
    setPontos(criados);
    return () => {
      for (const c of criados) c.onde.remove();
    };
  }, [raiz, pode]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- a leitura acabou (ou outra começou): o botão volta a "Ouvir"
    if (!falando) setLendo(null);
  }, [falando]);

  return (
    <>
      {pontos.map((ponto) =>
        createPortal(
          <button
            type="button"
            className="ouvir-paragrafo-botao"
            aria-label={lendo === ponto.n ? s.parar : s.rotulo}
            aria-pressed={lendo === ponto.n}
            onClick={() => {
              if (lendo === ponto.n) {
                stopReading();
                setLendo(null);
                return;
              }
              window.getSelection()?.removeAllRanges();
              startReading([`${raiz} p[data-p="${ponto.n}"]`]);
              setLendo(ponto.n);
            }}
          >
            <IconeAltoFalante falando={lendo === ponto.n} />
            <span>{lendo === ponto.n ? s.parar : s.ouvir}</span>
          </button>,
          ponto.onde,
          ponto.n,
        ),
      )}
    </>
  );
}
