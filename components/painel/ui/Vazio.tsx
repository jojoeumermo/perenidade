// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import type { ReactNode } from "react";

/** Estado vazio: diz o que não há e, se couber, o que fazer. Nunca uma tela em branco. */
export function Vazio({ titulo, texto, acao }: { titulo: string; texto?: string; acao?: ReactNode }) {
  return (
    <div className="pn-vazio" role="status">
      <p className="pn-vazio-titulo">{titulo}</p>
      {texto && <p>{texto}</p>}
      {acao && <div>{acao}</div>}
    </div>
  );
}
