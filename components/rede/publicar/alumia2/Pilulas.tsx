// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useRef, type ReactNode } from "react";

export interface OpcaoDePilula<V extends string> {
  valor: V;
  conteudo: ReactNode;
}

/**
 * Um grupo de rádio em pílulas com o teclado de um rádio de verdade (WAI-ARIA APG, "Radio Group"): uma só parada no Tab (a
 * opção escolhida, ou a primeira), as setas e Home/End trocam a escolha e levam o foco junto. `aoMudar` vale para as setas e
 * para o clique; `aoConfirmar` só para o clique, Enter ou Espaço (é quando uma lista que se abre pode se fechar).
 */
export function Pilulas<V extends string>({
  rotulo,
  opcoes,
  escolhido,
  aoMudar,
  aoConfirmar,
  aoEsc,
  className = "",
  classeItem = "al2-tipo",
}: {
  rotulo: string;
  opcoes: OpcaoDePilula<V>[];
  escolhido: V | null;
  aoMudar: (v: V) => void;
  aoConfirmar?: (v: V) => void;
  /** Esc dentro do grupo (ex.: fechar a lista de Onde publicar sem fechar o Escrever). */
  aoEsc?: () => void;
  className?: string;
  classeItem?: string;
}) {
  const botoes = useRef<(HTMLButtonElement | null)[]>([]);
  const atual = Math.max(0, opcoes.findIndex((o) => o.valor === escolhido));

  function teclas(e: React.KeyboardEvent<HTMLDivElement>) {
    if (e.key === "Escape" && aoEsc) {
      e.preventDefault();
      e.stopPropagation();
      aoEsc();
      return;
    }
    const n = opcoes.length;
    if (!n) return;
    const daqui = botoes.current.findIndex((b) => b === document.activeElement);
    const de = daqui < 0 ? atual : daqui;
    let alvo = -1;
    if (e.key === "ArrowRight" || e.key === "ArrowDown") alvo = (de + 1) % n;
    else if (e.key === "ArrowLeft" || e.key === "ArrowUp") alvo = (de - 1 + n) % n;
    else if (e.key === "Home") alvo = 0;
    else if (e.key === "End") alvo = n - 1;
    if (alvo < 0) return;
    e.preventDefault();
    aoMudar(opcoes[alvo].valor);
    botoes.current[alvo]?.focus();
  }

  return (
    <div role="radiogroup" aria-label={rotulo} className={className} onKeyDown={teclas}>
      {opcoes.map((o, i) => (
        <button
          key={o.valor}
          ref={(b) => {
            botoes.current[i] = b;
          }}
          type="button"
          role="radio"
          aria-checked={o.valor === escolhido}
          tabIndex={i === atual ? 0 : -1}
          onClick={() => {
            aoMudar(o.valor);
            aoConfirmar?.(o.valor);
          }}
          className={classeItem}
        >
          {o.conteudo}
        </button>
      ))}
    </div>
  );
}
