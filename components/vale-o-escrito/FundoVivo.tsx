// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useEffect, useRef } from "react";
import { aparelhoFraco } from "./desempenho";

/**
 * O fundo vivo da moldura do Vale o Escrito: o canvas fica atrás de tudo (fixo, sem receber clique) e o código da rede
 * (redeNeural.ts) só é baixado quando o navegador estiver ocioso, depois da página pronta. Decorativo: aria-hidden.
 */
export function FundoVivo() {
  const tela = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    let parar: (() => void) | null = null;
    let cancelado = false;
    const calmo = (() => {
      try {
        return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      } catch {
        return false;
      }
    })();
    const comecar = () => {
      import("./redeNeural")
        .then(({ iniciarRede }) => {
          if (!cancelado && tela.current) parar = iniciarRede(tela.current, { calmo, leve: aparelhoFraco() });
        })
        .catch(() => {
          // sem o fundo, a página continua igual
        });
    };
    // Ocioso quando o navegador tem (Safari antigo não tem: cai num atraso curto).
    const comOcioso = typeof window.requestIdleCallback === "function";
    const id = comOcioso ? window.requestIdleCallback(comecar, { timeout: 1500 }) : window.setTimeout(comecar, 400);
    return () => {
      cancelado = true;
      if (comOcioso) window.cancelIdleCallback(id);
      else window.clearTimeout(id);
      parar?.();
    };
  }, []);

  return (
    <div className="ve-fundo-vivo" aria-hidden="true">
      <canvas ref={tela} />
    </div>
  );
}
