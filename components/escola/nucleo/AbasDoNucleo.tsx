// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useRef } from "react";

export const ABAS = ["pauta", "tarefas", "circulo", "assembleia"] as const;
export type AbaDoNucleo = (typeof ABAS)[number];

/**
 * As abas da prancha Cel-Núcleo (Pauta · Tarefas · Círculo · Assembleia), no padrão de abas do WAI-ARIA: setas e
 * Home/End mudam de aba, só a aba atual entra no Tab. Os painéis ficam todos montados (escondidos com hidden), para o
 * kit e a assembleia, que vêm prontos do servidor, não se refazerem a cada troca.
 */
export function AbasDoNucleo({ rotulo, nomes, atual, escolher, paineis }: { rotulo: string; nomes: Record<AbaDoNucleo, string>; atual: AbaDoNucleo; escolher: (aba: AbaDoNucleo) => void; paineis: Record<AbaDoNucleo, React.ReactNode> }) {
  const botoes = useRef<Partial<Record<AbaDoNucleo, HTMLButtonElement | null>>>({});
  const ir = (aba: AbaDoNucleo) => {
    escolher(aba);
    botoes.current[aba]?.focus();
  };
  function tecla(e: React.KeyboardEvent, i: number) {
    const ultimo = ABAS.length - 1;
    const destino = e.key === "ArrowRight" ? (i === ultimo ? 0 : i + 1) : e.key === "ArrowLeft" ? (i === 0 ? ultimo : i - 1) : e.key === "Home" ? 0 : e.key === "End" ? ultimo : null;
    if (destino === null) return;
    e.preventDefault();
    ir(ABAS[destino]);
  }
  return (
    <>
      <div role="tablist" aria-label={rotulo} className="en-abas">
        {ABAS.map((aba, i) => (
          <button
            key={aba}
            ref={(b) => {
              botoes.current[aba] = b;
            }}
            id={`en-aba-${aba}`}
            role="tab"
            type="button"
            aria-selected={atual === aba}
            aria-controls={`en-painel-${aba}`}
            tabIndex={atual === aba ? 0 : -1}
            onClick={() => escolher(aba)}
            onKeyDown={(e) => tecla(e, i)}
            className="en-aba"
          >
            {nomes[aba]}
          </button>
        ))}
      </div>
      {ABAS.map((aba) => (
        <div key={aba} id={`en-painel-${aba}`} role="tabpanel" aria-labelledby={`en-aba-${aba}`} hidden={atual !== aba} tabIndex={0} className="en-painel" data-aba={aba}>
          {paineis[aba]}
        </div>
      ))}
    </>
  );
}
