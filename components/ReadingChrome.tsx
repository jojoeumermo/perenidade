// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useEffect, useRef } from "react";

/**
 * Modo leitura do aplicativo, para a tela de aula: rolando para baixo, a barra de cima e as abas saem da frente e
 * fica só o texto; rolando para cima, voltam. Um fio vermelho no topo mostra quanto da aula já foi lido.
 * Fora do aplicativo não faz nada. Uma conta por quadro, sem biblioteca: precisa rodar liso em celular simples.
 */
export function ReadingChrome() {
  const bar = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = document.documentElement;
    if (!root.hasAttribute("data-app")) return;
    let last = window.scrollY;
    let waiting = false;
    const update = () => {
      waiting = false;
      const y = window.scrollY;
      const max = root.scrollHeight - window.innerHeight;
      if (bar.current) bar.current.style.transform = `scaleX(${max > 0 ? Math.min(y / max, 1) : 0})`;
      // Só reage a um gesto de verdade: tremor do dedo não fica escondendo e mostrando as barras.
      if (Math.abs(y - last) < 12) return;
      if (y > last && y > 160) root.setAttribute("data-lendo", "");
      else root.removeAttribute("data-lendo");
      last = y;
    };
    const onScroll = () => {
      if (waiting) return;
      waiting = true;
      requestAnimationFrame(update);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      root.removeAttribute("data-lendo");
    };
  }, []);

  return (
    <div aria-hidden className="regua-de-leitura no-print pointer-events-none fixed inset-x-0 top-[env(safe-area-inset-top,0px)] z-40 hidden h-[3px] app:max-md:block">
      <div ref={bar} className="h-full origin-left scale-x-0 bg-oxblood" />
    </div>
  );
}
