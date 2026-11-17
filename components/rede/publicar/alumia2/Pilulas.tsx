// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useRef, type ReactNode } from "react";

export interface OpcaoDePilula<V extends string> {
  valor: V;
  conteudo: ReactNode;
  /** Aparece, mas não dá para escolher: as setas pulam e o clique não muda nada (quem chama diz por quê, ao lado). */
  desligada?: boolean;
}

/**
 * Um grupo de rádio em pílulas com o teclado de um rádio de verdade (WAI-ARIA APG, "Radio Group"): uma só parada no Tab (a
 * opção escolhida, ou a primeira), as setas e Home/End trocam a escolha e levam o foco junto. `aoMudar` vale para as setas e
 * para o clique; `aoConfirmar` só para o clique, Enter ou Espaço (é quando uma lista que se abre pode se fechar). A opção desligada
 * fica à vista (aria-disabled) e as setas passam por cima dela.
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
    if (!n || opcoes.every((o) => o.desligada)) return;
    const daqui = botoes.current.findIndex((b) => b === document.activeElement);
    const de = daqui < 0 ? atual : daqui;
    // O próximo que dá para escolher, andando no sentido da tecla (a opção desligada fica de fora).
    const andar = (de0: number, passo: number) => {
      let i = de0;
      for (let k = 0; k < n; k++) {
        i = (i + passo + n) % n;
        if (!opcoes[i].desligada) return i;
      }
      return -1;
    };
    let alvo = -1;
    if (e.key === "ArrowRight" || e.key === "ArrowDown") alvo = andar(de, 1);
    else if (e.key === "ArrowLeft" || e.key === "ArrowUp") alvo = andar(de, -1);
    else if (e.key === "Home") alvo = andar(-1, 1);
    else if (e.key === "End") alvo = andar(n, -1);
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
          aria-disabled={o.desligada || undefined}
          data-desligada={o.desligada ? "sim" : undefined}
          tabIndex={i === atual ? 0 : -1}
          onClick={() => {
            if (o.desligada) return;
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
