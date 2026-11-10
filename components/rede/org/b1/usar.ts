// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

// Ganchos do B1 das organizações: ler de novo de tempos em tempos SÓ com a aba visível (a fila da plenária e a Ata Viva ficam
// vivas sem gastar o limite de quem deixou a aba escondida) e o relógio de um segundo do cronômetro da fala.
import { useEffect, useRef, useState } from "react";

/**
 * Chama `ler` a cada `ms` enquanto a aba estiver visível (e uma vez ao voltar a ela). Devolve quando leu por último (ms) e se
 * está pausado. Erros não param o laço (a próxima volta tenta de novo).
 */
export function useLerDeNovo(ler: (() => Promise<void>) | null, ms: number): { ultima: number | null; pausado: boolean } {
  const [ultima, setUltima] = useState<number | null>(null);
  const [pausado, setPausado] = useState(false);
  const lerRef = useRef(ler);
  useEffect(() => {
    lerRef.current = ler;
  });
  const ligado = ler !== null;
  useEffect(() => {
    if (!ligado) return;
    let vivo = true;
    let relogio: ReturnType<typeof setTimeout> | null = null;
    const volta = async () => {
      if (!vivo) return;
      if (document.visibilityState === "visible") {
        try {
          await lerRef.current?.();
          if (vivo) setUltima(Date.now());
        } catch {
          // A próxima volta tenta de novo.
        }
      }
      if (vivo) relogio = setTimeout(volta, ms);
    };
    const visivel = () => {
      setPausado(document.visibilityState !== "visible");
      if (document.visibilityState === "visible") {
        if (relogio) clearTimeout(relogio);
        void volta();
      }
    };
    relogio = setTimeout(volta, ms);
    document.addEventListener("visibilitychange", visivel);
    return () => {
      vivo = false;
      if (relogio) clearTimeout(relogio);
      document.removeEventListener("visibilitychange", visivel);
    };
  }, [ligado, ms]);
  return { ultima, pausado };
}

/** O agora, de segundo em segundo, enquanto `ligado`. */
export function useAgora(ligado: boolean): number {
  const [agora, setAgora] = useState(() => Date.now());
  useEffect(() => {
    if (!ligado) return;
    const r = setInterval(() => setAgora(Date.now()), 1000);
    return () => clearInterval(r);
  }, [ligado]);
  return agora;
}
