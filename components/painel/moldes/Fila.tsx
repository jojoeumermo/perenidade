// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { ArrowDown, ArrowUp } from "lucide-react";
import { type KeyboardEvent, type ReactNode, useRef, useState } from "react";
import { type ComandoDaSecao, useComandosDaSecao } from "../estado";
import { Botao, Esqueleto, Kbd, PaineisAjustaveis, Vazio } from "../ui";

/**
 * Molde FILA: uma lista de coisas esperando decisão e, ao lado (no celular, embaixo), o item aberto. A pessoa lê, decide e
 * vai ao próximo. No computador, a divisória entre lista e detalhe se arrasta (a largura fica guardada). Teclado: "j" e
 * "k" ou as setas percorrem a lista, Enter abre o item no detalhe. "comandos" registra na paleta (Ctrl K) os comandos do
 * item aberto (aprovar, devolver, chamar alguém…). Serve a Fila de revisão, Triagem, Comunidade, Reforço, Gaveta, Mural,
 * Traduções, Imprensa, Erros e as outras seções de "decidir o que espera".
 */
export function MoldeFila<T>({
  itens,
  chave,
  linha,
  detalhe,
  carregando = false,
  vazio,
  barra,
  rotulo,
  comandos,
  id = "fila",
}: {
  itens: T[];
  chave: (item: T) => string;
  linha: (item: T) => ReactNode;
  detalhe: (item: T, proximo: () => void) => ReactNode;
  carregando?: boolean;
  vazio?: ReactNode;
  barra?: ReactNode;
  rotulo: string;
  /** Os comandos do item aberto, para a paleta. */
  comandos?: (item: T) => ComandoDaSecao[];
  /** Nome das larguras guardadas (uma fila com desenho diferente pode ter as suas). */
  id?: string;
}) {
  const [escolhida, setEscolhida] = useState<string | null>(null);
  const lista = useRef<HTMLDivElement>(null);
  const detalheRef = useRef<HTMLElement>(null);
  // Se o item aberto saiu da lista (foi decidido), abre o primeiro: a fila anda sozinha.
  const atual = itens.find((i) => chave(i) === escolhida) ?? itens[0];
  const posicao = atual ? itens.indexOf(atual) : -1;
  const proximo = () => {
    const seguinte = itens[posicao + 1] ?? itens[posicao - 1];
    setEscolhida(seguinte ? chave(seguinte) : null);
  };
  const ir = (passo: number) => {
    const alvo = itens[posicao + passo];
    if (!alvo) return;
    setEscolhida(chave(alvo));
    // O foco acompanha a linha escolhida (o leitor de tela lê a linha nova).
    requestAnimationFrame(() => lista.current?.querySelector<HTMLButtonElement>(`[data-chave="${CSS.escape(chave(alvo))}"]`)?.focus());
  };
  const aoTeclar = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.key === "ArrowDown" || e.key === "j") {
      e.preventDefault();
      ir(1);
    } else if (e.key === "ArrowUp" || e.key === "k") {
      e.preventDefault();
      ir(-1);
    }
  };
  useComandosDaSecao(atual && comandos ? comandos(atual) : [], [atual ? chave(atual) : null, itens.length]);

  if (carregando) return <Esqueleto forma="fila" linhas={5} rotulo={`Carregando ${rotulo}`} />;
  if (itens.length === 0) {
    return (
      <div className="pn-tela">
        {barra && <div className="pn-barra-ferramentas">{barra}</div>}
        {vazio ?? <Vazio titulo="Nada esperando" texto="Quando chegar algo, aparece aqui." />}
      </div>
    );
  }

  const colunaDaLista = (
    <div ref={lista} role="list" aria-label={rotulo} className="pn-fila-lista" onKeyDown={aoTeclar}>
      {itens.map((item) => {
        const k = chave(item);
        const aberta = atual !== undefined && chave(atual) === k;
        return (
          <div role="listitem" key={k}>
            <button
              type="button"
              data-chave={k}
              className="pn-fila-item"
              aria-current={aberta ? "true" : undefined}
              onClick={() => setEscolhida(k)}
              onKeyDown={(e) => {
                // Enter abre e leva o foco ao detalhe (para ler e decidir sem mouse).
                if (e.key === "Enter") {
                  e.preventDefault();
                  setEscolhida(k);
                  requestAnimationFrame(() => detalheRef.current?.focus());
                }
              }}
            >
              {linha(item)}
            </button>
          </div>
        );
      })}
    </div>
  );

  const colunaDoDetalhe = (
    <section ref={detalheRef} tabIndex={-1} aria-label="Item aberto" className="pn-cartao pn-fila-detalhe">
      {atual && detalhe(atual, proximo)}
      <div className="pn-fila-detalhe-barra">
        <Botao pequeno disabled={itens.length < 2} onClick={proximo} simboloFim={ArrowDown}>
          Próximo
        </Botao>
        <span className="pn-ajuda">
          {posicao + 1} de {itens.length}
        </span>
        <span className="pn-ajuda pn-so-computador" style={{ marginLeft: "auto", alignItems: "center", gap: "0.3rem" }} aria-hidden>
          <Kbd>j</Kbd>
          <Kbd>k</Kbd>
          <ArrowUp width={12} height={12} />
          <ArrowDown width={12} height={12} />
          percorrer · <Kbd>Ctrl K</Kbd> comandos
        </span>
      </div>
    </section>
  );

  return (
    <div className="pn-tela">
      {barra && <div className="pn-barra-ferramentas">{barra}</div>}
      <PaineisAjustaveis
        id={id}
        paineis={[
          { id: "lista", nome: "lista", minimo: 22, padrao: 34, maximo: 55, conteudo: colunaDaLista },
          { id: "detalhe", nome: "detalhe", minimo: 40, conteudo: colunaDoDetalhe },
        ]}
      />
    </div>
  );
}
