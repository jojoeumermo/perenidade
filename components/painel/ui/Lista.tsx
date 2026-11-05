// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { cx } from "./cx";

/** A lista do painel (no lugar dos "ul.divide-y"): linhas de --pn-linha, num cartão. "plana" tira a moldura. */
export function Lista({ rotulo, children, plana, className }: { rotulo: string; children: ReactNode; plana?: boolean; className?: string }) {
  return (
    <ul aria-label={rotulo} className={cx("pn-lista", plana && "pn-lista-plana", className)}>
      {children}
    </ul>
  );
}

/**
 * Uma linha: ícone, título, metadado, selo e ações. Com "aoClicar", a linha inteira vira botão (as ações ficam fora dele,
 * para não aninhar botões). "atual" marca a linha aberta.
 */
export function ItemDeLista({ titulo, meta, simbolo: Simbolo, selo, acoes, aoClicar, atual, className }: { titulo: ReactNode; meta?: ReactNode; simbolo?: LucideIcon; selo?: ReactNode; acoes?: ReactNode; aoClicar?: () => void; atual?: boolean; className?: string }) {
  const miolo = (
    <>
      {Simbolo && <Simbolo aria-hidden className="pn-item-simbolo" />}
      <span className="pn-item-texto">
        <span className="pn-item-titulo">{titulo}</span>
        {meta && <span className="pn-item-meta">{meta}</span>}
      </span>
      {selo}
    </>
  );
  if (!aoClicar) {
    return (
      <li className={cx("pn-item", className)} data-atual={atual || undefined}>
        {miolo}
        {acoes && <span className="pn-item-acoes">{acoes}</span>}
      </li>
    );
  }
  return (
    <li style={{ display: "flex", alignItems: "stretch", borderBottom: "1px solid var(--pn-borda)" }} className={className}>
      <button type="button" className="pn-item pn-item-botao" style={{ borderBottom: 0 }} aria-current={atual ? "true" : undefined} onClick={aoClicar}>
        {miolo}
      </button>
      {acoes && (
        <span className="pn-item-acoes" style={{ paddingRight: "0.6rem" }}>
          {acoes}
        </span>
      )}
    </li>
  );
}
