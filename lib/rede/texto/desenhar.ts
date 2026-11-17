// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Desenha o texto formatado (./formatado) em elementos do React, só com os nós conhecidos: nenhum HTML vindo do texto é
// interpretado (o React escapa todo texto e todo atributo), e nada aqui usa innerHTML. As peças que dependem da tela (a fórmula
// com o KaTeX, o bloco de código com o botão de copiar, a imagem do post, o link interno, o texto com menções e hashtags) chegam
// de fora: components/rede/texto/TextoFormatado.tsx dá as de verdade; o teste dá as de mentira e confere o HTML que sai.
// Sem JSX e sem "@/": roda no Node dos testes.
import { createElement as h, Fragment, type ComponentType, type ReactNode } from "react";
import type { Bloco, Trecho } from "./formatado";

export interface PecasDoTexto {
  /** A fórmula (no meio da frase ou em bloco). */
  Formula: ComponentType<{ expressao: string; bloco: boolean }>;
  /** O bloco de código (o `código` no meio da frase é um <code> simples). */
  Codigo: ComponentType<{ codigo: string; lingua: string }>;
  /** O texto comum (com as menções e as hashtags). */
  Texto: ComponentType<{ texto: string }>;
  /** A imagem N do próprio post (nulo quando o post não tem essa imagem). */
  Imagem: ComponentType<{ n: number; alt: string }>;
  /** O link (o endereço já passou por urlSegura). */
  Link: ComponentType<{ href: string; children?: ReactNode }>;
}

/** Os trechos de um parágrafo, item ou título. */
export function desenharTrechos(trechos: readonly Trecho[], p: PecasDoTexto, prefixo = "t"): ReactNode[] {
  return trechos.map((x, i) => {
    const key = `${prefixo}${i}`;
    switch (x.t) {
      case "texto":
        return h(p.Texto, { key, texto: x.v });
      case "quebra":
        return h("br", { key });
      case "codigo":
        return h("code", { key, className: "txf-codigo-curto" }, x.v);
      case "formula":
        return h(p.Formula, { key, expressao: x.v, bloco: false });
      case "negrito":
        return h("strong", { key }, desenharTrechos(x.filhos, p, `${key}.`));
      case "italico":
        return h("em", { key }, desenharTrechos(x.filhos, p, `${key}.`));
      case "riscado":
        return h("s", { key }, desenharTrechos(x.filhos, p, `${key}.`));
      case "link":
        return h(p.Link, { key, href: x.url }, desenharTrechos(x.filhos, p, `${key}.`));
    }
  });
}

/**
 * Os blocos. `nivel` é o nível do título "##" (o "###" fica um abaixo): no cartão o título do post já é h3, então "##" vira h4.
 */
export function desenharBlocos(blocos: readonly Bloco[], p: PecasDoTexto, nivel: 2 | 3 | 4 = 4): ReactNode[] {
  return blocos.map((b, i) => {
    const key = `b${i}`;
    switch (b.t) {
      case "paragrafo":
        return h("p", { key, className: "txf-p" }, desenharTrechos(b.trechos, p, `${key}.`));
      case "titulo":
        return h(`h${Math.min(6, nivel + (b.nivel - 2))}`, { key, className: b.nivel === 2 ? "txf-titulo" : "txf-subtitulo" }, desenharTrechos(b.trechos, p, `${key}.`));
      case "lista":
        return h(
          b.ordenada ? "ol" : "ul",
          { key, className: "txf-lista", ...(b.ordenada && b.inicio !== 1 ? { start: b.inicio } : {}) },
          b.itens.map((item, j) => h("li", { key: j }, desenharTrechos(item, p, `${key}.${j}.`))),
        );
      case "citacao":
        return h("blockquote", { key, className: "txf-citacao" }, b.paragrafos.map((x, j) => h("p", { key: j }, desenharTrechos(x, p, `${key}.${j}.`))));
      case "codigo":
        return h(p.Codigo, { key, codigo: b.v, lingua: b.lingua });
      case "formula":
        return h("div", { key, className: "txf-formula-bloco" }, h(p.Formula, { expressao: b.v, bloco: true }));
      case "imagem":
        return h(p.Imagem, { key, n: b.n, alt: b.alt });
      case "separador":
        return h("hr", { key, className: "txf-separador" });
    }
  });
}

/** Tudo dentro de um fragmento (para quem só quer o nó). */
export function desenhar(blocos: readonly Bloco[], p: PecasDoTexto, nivel: 2 | 3 | 4 = 4): ReactNode {
  return h(Fragment, null, ...desenharBlocos(blocos, p, nivel));
}
