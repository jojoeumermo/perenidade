// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import "@/styles/vale-o-escrito.css";
import type { ReactNode } from "react";
import Link from "@/components/Link";

/**
 * O alto das páginas de texto do Vale o Escrito (sobre, enviar, correção), no lugar do PageHeading de papel do site: o
 * rótulo mono com o caminho, o título grande na display condensada e a linha fina. Servidor ou cliente, sem estado.
 */
export function CabecaDoVale({ olho, titulo, voltar, children }: { olho: string; titulo: string; voltar?: { href: string; texto: string }; children?: ReactNode }) {
  return (
    <header className="ve-cabeca">
      {voltar && (
        <Link className="ve-pagina-voltar" href={voltar.href}>
          ← {voltar.texto}
        </Link>
      )}
      <span className="ve-rotulo">{olho}</span>
      <h1>{titulo}</h1>
      {children && <div className="ve-cabeca-lead">{children}</div>}
    </header>
  );
}
