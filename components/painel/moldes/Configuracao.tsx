// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import type { ReactNode } from "react";
import { Botao } from "../ui";

export interface GrupoDeConfiguracao {
  id: string;
  titulo: string;
  sobre?: string;
  campos: ReactNode;
}

/**
 * Molde CONFIGURAÇÃO: grupos de campos e um rodapé que guarda tudo de uma vez. O botão "Salvar" é o único principal da tela e
 * só vale quando algo mudou; "Descartar" volta ao que estava. Serve Controles do site, Aviso de abertura, Segurança e
 * sucessão, Interdição, Estado técnico, Avisos à equipe e Minha conta.
 */
export function MoldeConfiguracao({ grupos, sujo, salvando = false, aoSalvar, aoDescartar, rotuloSalvar = "Salvar" }: { grupos: GrupoDeConfiguracao[]; sujo: boolean; salvando?: boolean; aoSalvar: () => void; aoDescartar?: () => void; rotuloSalvar?: string }) {
  return (
    <form
      className="pn-tela"
      onSubmit={(e) => {
        e.preventDefault();
        if (sujo && !salvando) aoSalvar();
      }}
    >
      {grupos.map((g) => (
        <section key={g.id} aria-labelledby={`config-${g.id}`} className="pn-config-grupo">
          <div>
            <h2 id={`config-${g.id}`} className="pn-secao-titulo">
              {g.titulo}
            </h2>
            {g.sobre && <p className="pn-ajuda">{g.sobre}</p>}
          </div>
          {g.campos}
        </section>
      ))}
      <div className="pn-config-rodape">
        <span className="pn-ajuda" role="status">
          {salvando ? "Guardando…" : sujo ? "Há mudanças ainda não guardadas." : "Tudo guardado."}
        </span>
        {aoDescartar && (
          <Botao onClick={aoDescartar} disabled={!sujo || salvando}>
            Descartar
          </Botao>
        )}
        <Botao type="submit" variante="principal" disabled={!sujo || salvando}>
          {rotuloSalvar}
        </Botao>
      </div>
    </form>
  );
}
