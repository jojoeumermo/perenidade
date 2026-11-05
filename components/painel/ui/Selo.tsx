// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import type { ReactNode } from "react";
import { cx } from "./cx";
import { ContagemAnimada } from "./movimento";

export type TomDoSelo = "neutro" | "bordo" | "ok" | "aviso" | "erro" | "ouro" | "info";

/** Selo de estado ("no ar", "aguardando revisão", "15 min"): sempre com palavra, nunca só a cor. */
export function Selo({ tom = "neutro", ponto, children, className, titulo }: { tom?: TomDoSelo; ponto?: boolean; children: ReactNode; className?: string; titulo?: string }) {
  return (
    <span className={cx("pn-etiqueta", tom !== "neutro" && `pn-etiqueta-${tom}`, className)} title={titulo}>
      {ponto && <span aria-hidden className="pn-etiqueta-ponto" />}
      {children}
    </span>
  );
}

/**
 * O número bordô do que espera por alguém (menu, abas, listas). Some com zero. O número muda com um pulinho; o leitor de
 * tela lê "3 esperando" (ou o rótulo que vier).
 */
export function Contador({ n, rotulo = "esperando", className }: { n?: number | null; rotulo?: string; className?: string }) {
  if (!n) return null;
  return (
    <span className={cx("pn-contador", className)}>
      <ContagemAnimada valor={n > 999 ? "999+" : n} />
      <span className="sr-only"> {rotulo}</span>
    </span>
  );
}
