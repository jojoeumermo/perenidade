// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

/** A estrela da marca em traço fino (o vazio sem ícone próprio). */
function Estrela({ className }: { className?: string }) {
  return (
    <svg aria-hidden viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round">
      <path d="M12 2.8l2.75 5.95 6.5.75-4.82 4.43 1.3 6.42L12 17.1l-5.73 3.25 1.3-6.42L2.75 9.5l6.5-.75z" />
    </svg>
  );
}

/** Estado vazio: diz o que não há e, se couber, o que fazer. Nunca uma tela em branco. */
export function Vazio({ titulo, texto, acao, simbolo: Simbolo }: { titulo: string; texto?: string; acao?: ReactNode; simbolo?: LucideIcon }) {
  return (
    <div className="pn-vazio" role="status">
      {Simbolo ? <Simbolo aria-hidden className="pn-vazio-simbolo" strokeWidth={1.4} /> : <Estrela className="pn-vazio-simbolo" />}
      <p className="pn-vazio-titulo">{titulo}</p>
      {texto && <p>{texto}</p>}
      {acao && <div style={{ marginTop: "0.4rem" }}>{acao}</div>}
    </div>
  );
}
