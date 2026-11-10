// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useCallback, useEffect, useRef, useState, type Ref } from "react";
import { abaDaTecla } from "@/lib/rede/org/abas";
import "./org.css";

/**
 * A faixa de abas dos perfis (pessoa e organização): sublinhado vermelho na escolhida, setas, Home e End, a aba que recebe o foco
 * rola para a vista e, quando a faixa é mais larga que a tela (celular), um degradê na borda mostra que há mais abas para o lado.
 */
export function Abas<A extends string>({
  abas,
  atual,
  aoMudar,
  rotulos,
  rotulo,
  id,
  ref,
}: {
  abas: readonly A[];
  atual: A;
  aoMudar: (a: A) => void;
  rotulos: Record<A, string>;
  rotulo: string;
  /** Prefixo dos ids (a aba é `${id}-aba-${a}` e o painel `${id}-painel`). */
  id: string;
  ref?: Ref<HTMLDivElement>;
}) {
  const faixa = useRef<HTMLDivElement>(null);
  const [lados, setLados] = useState({ esquerda: false, direita: false });
  const medir = useCallback(() => {
    const f = faixa.current;
    if (!f) return;
    const esquerda = f.scrollLeft > 2;
    const direita = f.scrollLeft + f.clientWidth < f.scrollWidth - 2;
    setLados((l) => (l.esquerda === esquerda && l.direita === direita ? l : { esquerda, direita }));
  }, []);
  useEffect(() => {
    medir();
    const f = faixa.current;
    if (!f) return;
    f.addEventListener("scroll", medir, { passive: true });
    const r = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(medir);
    r?.observe(f);
    return () => {
      f.removeEventListener("scroll", medir);
      r?.disconnect();
    };
  }, [medir]);

  return (
    <div ref={ref} className="al-abas-moldura" data-mais-esquerda={lados.esquerda ? "" : undefined} data-mais-direita={lados.direita ? "" : undefined}>
      <div ref={faixa} className="al-abas" role="tablist" aria-label={rotulo}>
        {abas.map((a) => (
          <button
            key={a}
            type="button"
            role="tab"
            id={`${id}-aba-${a}`}
            aria-selected={atual === a}
            aria-controls={`${id}-painel`}
            tabIndex={atual === a ? 0 : -1}
            className="al-aba"
            onClick={() => aoMudar(a)}
            onFocus={(e) => {
              // A primeira e a última levam a faixa até a ponta (o degradê daquele lado some); as outras, só o necessário.
              const f = faixa.current;
              const i = abas.indexOf(a);
              if (f && (i === 0 || i === abas.length - 1)) f.scrollTo({ left: i === 0 ? 0 : f.scrollWidth });
              else e.currentTarget.scrollIntoView({ block: "nearest", inline: "nearest" });
            }}
            onKeyDown={(e) => {
              const n = abaDaTecla(e.key, abas, a);
              if (n === null) return;
              e.preventDefault();
              aoMudar(n);
              document.getElementById(`${id}-aba-${n}`)?.focus();
            }}
          >
            {rotulos[a]}
          </button>
        ))}
      </div>
    </div>
  );
}
