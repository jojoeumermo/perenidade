// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import type { LucideIcon } from "lucide-react";
import { forwardRef, type ReactNode } from "react";
import { cx } from "./cx";

/**
 * O cabeçalho de uma seção. Nível 1 é só da casca (o h1 da página: traço das lutas e o nome do espaço em mono, título em
 * Garamond de 30 px com o ícone num quadrado bordô claro, a linha "sobre" e as ações à direita). Nas seções, nível 2
 * (h2 em Garamond de 20 px), no lugar de "jornal-secao" e de "h2.font-serif". As seções nunca desenham outro h1.
 */
export const CabecalhoDeSecao = forwardRef<HTMLHeadingElement, { nivel?: 1 | 2; titulo: ReactNode; rotulo?: ReactNode; sobre?: ReactNode; simbolo?: LucideIcon; icone?: ReactNode; acoes?: ReactNode; abas?: ReactNode; id?: string; className?: string }>(
  function CabecalhoDeSecao({ nivel = 2, titulo, rotulo, sobre, simbolo: Simbolo, icone, acoes, abas, id, className }, ref) {
    const Titulo = nivel === 1 ? "h1" : "h2";
    const marca = icone ?? (Simbolo ? <Simbolo aria-hidden /> : null);
    return (
      <header className={cx("pn-cabecalho", className)} data-nivel={nivel}>
        <div className="pn-cabecalho-texto">
          {rotulo && (
            <p className="pn-cabecalho-rotulo">
              {nivel === 1 && <span aria-hidden className="pn-cabecalho-lutas" />}
              {rotulo}
            </p>
          )}
          <Titulo ref={ref} id={id} tabIndex={nivel === 1 ? -1 : undefined} className="pn-cabecalho-titulo">
            {marca && (
              <span aria-hidden className="pn-cabecalho-icone">
                {marca}
              </span>
            )}
            <span style={{ minWidth: 0 }}>{titulo}</span>
          </Titulo>
          {sobre && <p className="pn-cabecalho-sobre">{sobre}</p>}
        </div>
        {acoes && <div className="pn-cabecalho-acoes">{acoes}</div>}
        {abas && <div className="pn-cabecalho-abas">{abas}</div>}
      </header>
    );
  },
);
