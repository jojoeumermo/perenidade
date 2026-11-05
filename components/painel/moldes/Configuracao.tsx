// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import type { ReactNode } from "react";
import { Botao, Cartao } from "../ui";

export interface GrupoDeConfiguracao {
  id: string;
  titulo: string;
  sobre?: string;
  campos: ReactNode;
}

/**
 * Molde CONFIGURAÇÃO: grupos de campos (cada um num cartão, com título em Garamond) e um rodapé preso embaixo que guarda
 * tudo de uma vez. O botão "Salvar" é o único principal da tela e só vale quando algo mudou; "Descartar" volta ao que
 * estava. Serve Controles do site, Aviso de abertura, Segurança e sucessão, Interdição, Estado técnico, Avisos à equipe e
 * Minha conta.
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
        <Cartao key={g.id} titulo={g.titulo} sobre={g.sobre} className="pn-config-grupo">
          {g.campos}
        </Cartao>
      ))}
      <div className="pn-config-rodape">
        <span className="pn-ajuda" role="status" style={{ marginRight: "auto" }}>
          {salvando ? "Guardando…" : sujo ? "Há mudanças ainda não guardadas." : "Tudo guardado."}
        </span>
        {aoDescartar && (
          <Botao onClick={aoDescartar} disabled={!sujo || salvando}>
            Descartar
          </Botao>
        )}
        <Botao type="submit" variante="principal" disabled={!sujo} carregando={salvando}>
          {rotuloSalvar}
        </Botao>
      </div>
    </form>
  );
}
