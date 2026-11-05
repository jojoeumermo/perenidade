// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import type { ReactNode } from "react";
import { cx } from "./cx";

export type TomDaEstatistica = "neutro" | "bordo" | "ok" | "aviso" | "erro";

/** Um quadro de número: rótulo em mono, valor em Garamond, detalhe em uma linha. Com "aoClicar", vira botão. */
export function Estatistica({ rotulo, valor, detalhe, tom = "neutro", aoClicar, className }: { rotulo: ReactNode; valor: ReactNode; detalhe?: ReactNode; tom?: TomDaEstatistica; aoClicar?: () => void; className?: string }) {
  const miolo = (
    <>
      <span className="pn-rotulo-mono">{rotulo}</span>
      <span className="pn-estatistica-valor">{valor}</span>
      {detalhe && <span className="pn-estatistica-detalhe">{detalhe}</span>}
    </>
  );
  return aoClicar ? (
    <button type="button" onClick={aoClicar} data-tom={tom} className={cx("pn-estatistica", className)}>
      {miolo}
    </button>
  ) : (
    <div data-tom={tom} className={cx("pn-estatistica", className)}>
      {miolo}
    </div>
  );
}

/** A grade de estatísticas: os quadros lado a lado, num cartão só. */
export function Estatisticas({ children, rotulo, className }: { children: ReactNode; rotulo?: string; className?: string }) {
  return (
    <div role={rotulo ? "group" : undefined} aria-label={rotulo} className={cx("pn-estatisticas", className)}>
      {children}
    </div>
  );
}
