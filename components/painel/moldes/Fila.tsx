// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { type KeyboardEvent, type ReactNode, useState } from "react";
import { Botao, Esqueleto, Vazio } from "../ui";

/**
 * Molde FILA: uma lista de coisas esperando decisão e, ao lado (no celular, embaixo), o item aberto. A pessoa lê, decide e
 * vai ao próximo. Setas para cima e para baixo percorrem a lista. Serve a Fila de revisão, Triagem, Comunidade, Reforço,
 * Gaveta, Mural, Traduções e as outras seções de "decidir o que espera".
 */
export function MoldeFila<T>({ itens, chave, linha, detalhe, carregando = false, vazio, barra, rotulo }: { itens: T[]; chave: (item: T) => string; linha: (item: T) => ReactNode; detalhe: (item: T, proximo: () => void) => ReactNode; carregando?: boolean; vazio?: ReactNode; barra?: ReactNode; rotulo: string }) {
  const [escolhida, setEscolhida] = useState<string | null>(null);
  // Se o item aberto saiu da lista (foi decidido), abre o primeiro: a fila anda sozinha.
  const atual = itens.find((i) => chave(i) === escolhida) ?? itens[0];
  const posicao = atual ? itens.indexOf(atual) : -1;
  const proximo = () => {
    const seguinte = itens[posicao + 1] ?? itens[posicao - 1];
    setEscolhida(seguinte ? chave(seguinte) : null);
  };
  const aoTeclar = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
    e.preventDefault();
    const alvo = itens[posicao + (e.key === "ArrowDown" ? 1 : -1)];
    if (alvo) setEscolhida(chave(alvo));
  };
  if (carregando) return <Esqueleto linhas={4} rotulo={`Carregando ${rotulo}`} />;
  return (
    <div className="pn-tela">
      {barra && <div className="pn-barra-ferramentas">{barra}</div>}
      {itens.length === 0 ? (
        (vazio ?? <Vazio titulo="Nada esperando" texto="Quando chegar algo, aparece aqui." />)
      ) : (
        <div className="pn-fila pn-fila-com-detalhe">
          <div role="list" aria-label={rotulo} className="pn-fila-lista" onKeyDown={aoTeclar}>
            {itens.map((item) => (
              <div role="listitem" key={chave(item)}>
                <button type="button" className="pn-fila-item" aria-current={atual && chave(atual) === chave(item) ? "true" : undefined} onClick={() => setEscolhida(chave(item))}>
                  {linha(item)}
                </button>
              </div>
            ))}
          </div>
          <section aria-label="Item aberto" className="pn-cartao">
            {atual && detalhe(atual, proximo)}
            <div className="pn-barra-ferramentas" style={{ marginTop: "1rem" }}>
              <Botao pequeno disabled={itens.length < 2} onClick={proximo}>
                Próximo
              </Botao>
              <span className="pn-ajuda">
                {posicao + 1} de {itens.length}
              </span>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
