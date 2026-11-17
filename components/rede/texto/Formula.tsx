// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useEffect, useRef, useState } from "react";
import { formulaCabe, OPCOES_DO_KATEX } from "@/lib/rede/texto/formula";

type Katex = typeof import("katex").default;
let katexPromessa: Promise<Katex> | null = null;

/** O KaTeX e a folha dele só chegam ao aparelho quando a tela tem uma fórmula (o cartão de post fica leve). */
function carregarKatex(): Promise<Katex> {
  katexPromessa ??= Promise.all([import("katex"), import("./estilo-katex")]).then(([m]) => m.default);
  return katexPromessa;
}

/**
 * Uma fórmula em LaTeX, desenhada pelo KaTeX no aparelho de quem lê, com as travas de lib/rede/texto/formula.ts (sem "trust":
 * nenhum \href, \url, \includegraphics nem \html… vira HTML). O KaTeX escreve direto no elemento (katex.render), sem innerHTML
 * vindo do texto. Enquanto carrega, ou se não der, aparece a expressão em letra fixa; o MathML do KaTeX é o que o leitor de tela lê.
 */
export function Formula({ expressao, bloco }: { expressao: string; bloco: boolean }) {
  const alvo = useRef<HTMLSpanElement>(null);
  const [pronta, setPronta] = useState<string | null>(null);

  useEffect(() => {
    let vivo = true;
    if (!formulaCabe(expressao)) return;
    carregarKatex()
      .then((katex) => {
        if (!vivo || !alvo.current) return;
        katex.render(expressao, alvo.current, { ...OPCOES_DO_KATEX, displayMode: bloco });
        setPronta(`${bloco ? "b" : "l"}${expressao}`);
      })
      .catch(() => undefined);
    return () => {
      vivo = false;
    };
  }, [expressao, bloco]);

  const desenhada = pronta === `${bloco ? "b" : "l"}${expressao}`;
  // A fórmula em bloco larga demais rola para o lado: aí ela entra na ordem do teclado (Tab, depois as setas), como o bloco de código.
  const caixa = useRef<HTMLSpanElement>(null);
  const [larga, setLarga] = useState(false);
  useEffect(() => {
    const el = caixa.current;
    if (!bloco || !el || typeof ResizeObserver === "undefined") return;
    const medir = () => setLarga(el.scrollWidth > el.clientWidth + 1);
    const ro = new ResizeObserver(medir);
    ro.observe(el);
    medir();
    return () => ro.disconnect();
  }, [bloco, desenhada]);
  return (
    <span
      ref={caixa}
      className={bloco ? "txf-formula txf-formula-em-bloco" : "txf-formula"}
      tabIndex={bloco && larga ? 0 : undefined}
      role={bloco && larga ? "group" : undefined}
      aria-label={bloco && larga ? expressao : undefined}
    >
      {/* O React não põe nada dentro deste: quem escreve é o KaTeX. */}
      <span ref={alvo} hidden={!desenhada} />
      {!desenhada && <code className="txf-formula-texto">{expressao}</code>}
    </span>
  );
}
