// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import { cx } from "./cx";

/** Um fio de 1 px entre blocos; com "rotulo", o nome em mono no meio do fio. */
export function Separador({ orientacao = "horizontal", rotulo, className }: { orientacao?: "horizontal" | "vertical"; rotulo?: string; className?: string }) {
  if (rotulo && orientacao === "horizontal") {
    return (
      <div role="separator" aria-label={rotulo} className={cx("pn-separador-com-rotulo pn-rotulo-mono", className)}>
        <span aria-hidden>{rotulo}</span>
      </div>
    );
  }
  return <div role="separator" aria-orientation={orientacao} data-orientacao={orientacao} className={cx("pn-separador", className)} />;
}
