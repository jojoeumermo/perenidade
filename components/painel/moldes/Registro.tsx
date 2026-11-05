// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import type { ReactNode } from "react";

export interface SecaoDoRegistro {
  id: string;
  titulo: string;
  conteudo: ReactNode;
}

/**
 * Molde REGISTRO: um item (ou uma área de trabalho) com seções empilhadas e, no computador, um lado de apoio (histórico,
 * quem mexeu, ajuda). Serve Escrever, Departamentos, Núcleos, Conversas, Podcast, Pautas, Minhas contribuições e as
 * áreas de trabalho em geral.
 */
export function MoldeRegistro({ secoes, lado, acoes }: { secoes: SecaoDoRegistro[]; lado?: ReactNode; acoes?: ReactNode }) {
  return (
    <div className="pn-tela">
      {acoes && <div className="pn-barra-ferramentas">{acoes}</div>}
      <div className={`pn-registro ${lado ? "pn-registro-com-lado" : ""}`}>
        <div className="pn-registro" style={{ gap: "1.25rem" }}>
          {secoes.map((s) => (
            <section key={s.id} aria-labelledby={`registro-${s.id}`} className="pn-secao">
              <h2 id={`registro-${s.id}`} className="pn-secao-titulo">
                {s.titulo}
              </h2>
              {s.conteudo}
            </section>
          ))}
        </div>
        {lado && (
          <aside aria-label="Apoio" className="pn-cartao">
            {lado}
          </aside>
        )}
      </div>
    </div>
  );
}
