// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import type { ReactNode } from "react";
import { CabecalhoDeSecao, Cartao } from "../ui";

export interface SecaoDoRegistro {
  id: string;
  titulo: string;
  conteudo: ReactNode;
}

/**
 * Molde REGISTRO: um item (ou uma área de trabalho) com seções empilhadas, cada uma com o seu cabeçalho de nível 2, e, no
 * computador, um lado de apoio num cartão (histórico, quem mexeu, ajuda). Serve Escrever, Departamentos, Núcleos,
 * Conversas, Podcast, Pautas, Minhas contribuições e as áreas de trabalho em geral.
 */
export function MoldeRegistro({ secoes, lado, acoes }: { secoes: SecaoDoRegistro[]; lado?: ReactNode; acoes?: ReactNode }) {
  return (
    <div className="pn-tela">
      {acoes && <div className="pn-barra-ferramentas">{acoes}</div>}
      <div className={`pn-registro ${lado ? "pn-registro-com-lado" : ""}`}>
        <div className="pn-registro" style={{ gap: "1.75rem" }}>
          {secoes.map((s) => (
            <section key={s.id} aria-labelledby={`registro-${s.id}`} className="pn-secao">
              <CabecalhoDeSecao nivel={2} id={`registro-${s.id}`} titulo={s.titulo} />
              {s.conteudo}
            </section>
          ))}
        </div>
        {lado && (
          <Cartao as="div" role="complementary" aria-label="Apoio">
            {lado}
          </Cartao>
        )}
      </div>
    </div>
  );
}
