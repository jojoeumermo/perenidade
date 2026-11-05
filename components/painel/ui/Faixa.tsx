// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import { CircleAlert, CircleCheck, Info, type LucideIcon, TriangleAlert } from "lucide-react";
import type { ReactNode } from "react";
import { cx } from "./cx";

export type TomDaFaixa = "info" | "aviso" | "erro" | "ok" | "bordo";

const SIMBOLOS: Record<TomDaFaixa, LucideIcon> = { info: Info, aviso: TriangleAlert, erro: CircleAlert, ok: CircleCheck, bordo: Info };

/**
 * O recado em faixa (no lugar de "border-l-4 …"): ícone, título opcional, o texto e uma ação à direita. Erro é anunciado
 * na hora (role="alert"); o resto, com calma (role="status"). A palavra diz o estado; a cor só acompanha.
 */
export function Faixa({ tom = "info", titulo, acao, children, className, semSimbolo }: { tom?: TomDaFaixa; titulo?: ReactNode; acao?: ReactNode; children?: ReactNode; className?: string; semSimbolo?: boolean }) {
  const Simbolo = SIMBOLOS[tom];
  return (
    <div role={tom === "erro" ? "alert" : "status"} className={cx("pn-faixa", `pn-faixa-${tom}`, className)}>
      {!semSimbolo && <Simbolo aria-hidden />}
      <div className="pn-faixa-texto">
        {titulo && <p className="pn-faixa-titulo">{titulo}</p>}
        {children}
      </div>
      {acao && <div className="pn-cabecalho-acoes">{acao}</div>}
    </div>
  );
}
