// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import "@/styles/vale-o-escrito.css";
import type { KeyboardEvent, PointerEvent, ReactNode } from "react";
import type { TextosDoObservatorio } from "@/lib/vale-o-escrito/textos";
import { curvaDaAresta, type ArestaDaTeia, type NoDaTeia, type Ponto } from "@/lib/vale-o-escrito/visual";

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
  // Neon em todos os nós: um halo de gradiente (sem filtro: barato até no celular) na cor do tipo, maior e mais forte
  // quanto mais ligações o nó tem.
  const forca = Math.min(no.grau, 12) / 12;
  const halo = r * (2.1 + forca * 1.6);
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
      <circle className="ve-halo" r={halo} fill={`url(#ve-halo-${no.tipo})`} style={{ opacity: 0.45 + forca * 0.55 }} aria-hidden="true" />
      {selecionado && <circle className="ve-anel-pulso" r={r + 4} aria-hidden="true" />}
      <circle className="ve-nucleo" r={r} />
      {mostrarRotulo && (
        <text x={r + 4} y={3} style={{ fontSize: 9.5 / Math.sqrt(escala) }}>
          {truncar(no.rotulo, 30)}
        </text>
      )}
    </g>
  );
}

/** Os gradientes do halo neon, um por tipo de nó. Vai uma vez dentro de cada <svg> de visão. */
export function DefsNeon() {
  const cores: Record<NoDaTeia["tipo"], string> = { entrada: "#ff2b4f", pessoa: "#ffd23f", organizacao: "#7cc4ff", lugar: "#e8e8e0" };
  return (
    <defs>
      {(Object.keys(cores) as NoDaTeia["tipo"][]).map((t) => (
        <radialGradient key={t} id={`ve-halo-${t}`}>
          <stop offset="0" stopColor={cores[t]} stopOpacity={t === "lugar" ? 0.35 : 0.65} />
          <stop offset="0.35" stopColor={cores[t]} stopOpacity={t === "lugar" ? 0.12 : 0.22} />
          <stop offset="1" stopColor={cores[t]} stopOpacity="0" />
        </radialGradient>
      ))}
    </defs>
  );
}

/**
 * Uma ligação desenhada em curva (fio de teia), com o ponto de confiança no meio: cheio = confirmada por fonte primária,
 * vazio = só imprensa. Devolve também o meio da curva, para quem escreve um texto em cima.
 */
export function ArestaSvg({
  aresta,
  p,
  q,
  realce,
  apagado,
  escala = 1,
  comConfianca = true,
  children,
}: {
  aresta: ArestaDaTeia;
  p: Ponto;
  q: Ponto;
  realce: boolean;
  apagado?: boolean;
  escala?: number;
  comConfianca?: boolean;
  children?: (meio: Ponto) => ReactNode;
}) {
  const c = curvaDaAresta(p, q, aresta.id);
  return (
    <g>
      <path className="ve-aresta" data-implicita={aresta.implicita} data-realce={realce} data-apagado={apagado ? "true" : "false"} d={c.d} />
      {comConfianca && aresta.confianca && (
        <circle
          className="ve-confianca"
          data-confianca={aresta.confianca}
          data-apagado={apagado ? "true" : "false"}
          cx={c.mx}
          cy={c.my}
          r={2.1 / Math.sqrt(escala)}
          aria-hidden="true"
        />
      )}
      {children?.({ x: c.mx, y: c.my })}
    </g>
  );
}
