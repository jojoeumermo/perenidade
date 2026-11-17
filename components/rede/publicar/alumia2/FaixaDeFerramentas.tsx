// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { Icone } from "./icones";
import "./escrever.css";

/**
 * A fileira de ferramentas do Escrever (imagem, áudio, vídeo, enquete, mais tarde, figurinha, fio, aviso): numa linha só, que rola
 * na horizontal quando não cabe (celular estreito), em vez de quebrar em duas. As ferramentas nunca encolhem abaixo de 44 px. Quando
 * há mais para um lado, a borda daquele lado esmaece e mostra uma seta; tocar na seta rola a fileira (o teclado chega a cada
 * ferramenta pelo Tab, e o navegador traz a que tem o foco para dentro). O que vem em `depois` (o contador) fica parado à direita.
 */
export function FaixaDeFerramentas({ rotulo, mais, children, depois }: { rotulo: string; mais: string; children: ReactNode; depois?: ReactNode }) {
  const faixa = useRef<HTMLDivElement>(null);
  const [lados, setLados] = useState({ antes: false, depois: false });
  const medir = useCallback(() => {
    const f = faixa.current;
    if (!f) return;
    const antes = f.scrollLeft > 1;
    const depois = f.scrollLeft + f.clientWidth < f.scrollWidth - 1;
    setLados((l) => (l.antes === antes && l.depois === depois ? l : { antes, depois }));
  }, []);
  useEffect(() => {
    const f = faixa.current;
    if (!f) return;
    medir();
    const obs = typeof ResizeObserver === "function" ? new ResizeObserver(medir) : null;
    obs?.observe(f);
    window.addEventListener("resize", medir);
    return () => {
      obs?.disconnect();
      window.removeEventListener("resize", medir);
    };
  }, [medir]);
  // Uma ferramenta que aparece ou some (o vídeo, o fio) muda o que cabe sem mudar a largura da fileira: mede de novo a cada desenho
  // (só troca o estado quando um dos lados muda).
  useEffect(() => {
    medir();
  });
  const rolar = (sentido: 1 | -1) => faixa.current?.scrollBy({ left: sentido * Math.max(120, (faixa.current?.clientWidth ?? 0) * 0.6), behavior: "smooth" });
  return (
    <div className="al2-ferramentas-faixa" data-mais-antes={lados.antes ? "sim" : undefined} data-mais-depois={lados.depois ? "sim" : undefined}>
      <div className="al2-ferramentas-janela">
        <div ref={faixa} className="al2-ferramentas" role="toolbar" aria-label={rotulo} onScroll={medir}>
          {children}
        </div>
        {/* As setas são para quem usa o mouse ou o dedo; o leitor de tela e o teclado andam pelas ferramentas sem elas. */}
        <button type="button" tabIndex={-1} aria-hidden className="al2-ferramentas-mais al2-ferramentas-mais-antes" title={mais} onClick={() => rolar(-1)}>
          <Icone nome="chevron" className="h-5 w-5 rotate-180" />
        </button>
        <button type="button" tabIndex={-1} aria-hidden className="al2-ferramentas-mais al2-ferramentas-mais-depois" title={mais} onClick={() => rolar(1)}>
          <Icone nome="chevron" className="h-5 w-5" />
        </button>
      </div>
      {depois}
    </div>
  );
}
