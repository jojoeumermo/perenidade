// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { createElement, Fragment, useMemo, type ReactNode } from "react";
import { destinoQueEngana, htmlParaArvore, semDirecao, textoDaArvore, type NoDeFora } from "@/lib/rede/fediverso/tela/html";

/**
 * Um nó da árvore vira um elemento React: só as tags da lista, sem atributo nenhum além do href https de <a>. Quando o texto de
 * um link mostra um endereço que não é o do destino, o servidor de verdade vai escrito ao lado, entre parênteses.
 */
function desenhar(no: NoDeFora, chave: number): ReactNode {
  if (typeof no === "string") return no;
  if (no.tag === "br") return <br key={chave} />;
  const filhos = no.filhos.map(desenhar);
  if (no.tag === "a") {
    const real = destinoQueEngana(no.href, textoDaArvore(no.filhos));
    return (
      <a key={chave} href={no.href} rel="nofollow noopener noreferrer ugc" target="_blank">
        {filhos}
        {real && <span data-destino=""> ({real})</span>}
      </a>
    );
  }
  return createElement(no.tag, { key: chave }, ...filhos);
}

/** Texto puro com as quebras de linha de quem escreveu. */
function linhas(texto: string): ReactNode {
  return semDirecao(texto).split(/\r?\n/).map((linha, i) => (
    <Fragment key={i}>
      {i > 0 && <br />}
      {linha}
    </Fragment>
  ));
}

/**
 * O texto de um post de fora. O HTML (já limpo no servidor) é convertido para elementos React por lista permitida
 * (lib/rede/fediverso/tela/html.ts): nunca entra como HTML cru. Sem `html` (ou se dele não sobra nada), mostra `texto` com as
 * quebras de linha.
 */
export function HtmlDeFora({ html, texto, className }: { html?: string | null; texto?: string | null; className?: string }) {
  const arvore = useMemo(() => htmlParaArvore(html), [html]);
  // Palavra comprida (um endereço inteiro) quebra em vez de alargar o cartão em 375 px.
  const estilo = { overflowWrap: "anywhere" as const };
  if (!arvore.length) {
    if (!texto) return null;
    return (
      <div className={className} style={estilo}>
        <p>{linhas(texto)}</p>
      </div>
    );
  }
  return (
    <div className={className} style={estilo}>
      {arvore.map(desenhar)}
    </div>
  );
}

export default HtmlDeFora;
