// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import "@/styles/vale-o-escrito.css";
import type { KeyboardEvent, PointerEvent } from "react";
import type { TextosDoObservatorio } from "@/lib/vale-o-escrito/textos";
import type { NoDaTeia } from "@/lib/vale-o-escrito/visual";

export type S = TextosDoObservatorio;

/** O que toda visão recebe. */
export interface PropsDeVisao {
  nos: NoDaTeia[];
  selecionado: string | null;
  aoSelecionar: (chave: string) => void;
  s: S;
}

export const raioDoNo = (n: NoDaTeia): number => (n.tipo === "entrada" ? 7 + Math.min(n.grau, 8) * 0.7 : n.tipo === "lugar" ? 5 : 6);

export const truncar = (texto: string, max: number): string => {
  const t = Array.from(texto);
  return t.length > max ? `${t.slice(0, max - 1).join("")}…` : texto;
};

/** O nome acessível de um nó: tipo, rótulo e, no caso, a situação jurídica (que nunca fica fora). */
export function nomeDoNo(no: NoDaTeia, s: S): string {
  const base = `${s.visual.tipoNo[no.tipo]}: ${no.rotulo}`;
  return no.situacao ? `${base}. ${s.ficha.situacao}: ${s.situacao[no.situacao]}` : base;
}

/** Um nó de SVG, focável e acionável por teclado (Enter ou espaço). `escala` mantém o tamanho legível ao aproximar. */
export function NoSvg({
  no,
  x,
  y,
  s,
  selecionado,
  apagado,
  mostrarRotulo,
  escala = 1,
  aoSelecionar,
  aoPressionar,
}: {
  no: NoDaTeia;
  x: number;
  y: number;
  s: S;
  selecionado: boolean;
  apagado?: boolean;
  mostrarRotulo: boolean;
  escala?: number;
  aoSelecionar: (chave: string) => void;
  aoPressionar?: (e: PointerEvent<SVGGElement>, chave: string) => void;
}) {
  const r = raioDoNo(no) / Math.sqrt(escala);
  const tecla = (e: KeyboardEvent<SVGGElement>) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      aoSelecionar(no.chave);
    }
  };
  return (
    <g
      className={`ve-no ve-no--${no.tipo}`}
      transform={`translate(${x} ${y})`}
      data-sel={selecionado}
      data-apagado={apagado ? "true" : "false"}
      role="button"
      tabIndex={0}
      aria-pressed={selecionado}
      aria-label={nomeDoNo(no, s)}
      onClick={() => aoSelecionar(no.chave)}
      onKeyDown={tecla}
      onPointerDown={aoPressionar ? (e) => aoPressionar(e, no.chave) : undefined}
    >
      <title>{nomeDoNo(no, s)}</title>
      <circle r={r} />
      {mostrarRotulo && (
        <text x={r + 4} y={3} style={{ fontSize: 9.5 / Math.sqrt(escala) }}>
          {truncar(no.rotulo, 30)}
        </text>
      )}
    </g>
  );
}
