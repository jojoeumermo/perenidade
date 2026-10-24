// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import type { ReactNode } from "react";
import { Star } from "../Masthead";

// As peças das páginas no desenho do Caderno do Povo (o guia está em docs/DESENHO-DAS-PAGINAS.md):
//   <Capa>   a faixa de abertura, de ponta a ponta: papel pontilhado, preto ou vermelho
//   <Corpo>  o miolo da página, numa largura de leitura (estreita, média ou larga)
//   <Secao>  uma seção com a tarja de título (★ NOME e o fio até o fim da linha)

export type TomDaCapa = "papel" | "preto" | "vermelho";

const fundos: Record<TomDaCapa, string> = {
  papel: "pont border-b-[3px] border-ink text-ink",
  preto: "capa-preta border-b-4 border-[#c21f16] bg-[#1f1a14] text-[#f4ecd8]",
  vermelho: "capa-vermelha border-b-[3px] border-ink bg-[#c21f16] text-white",
};

const larguras = { estreita: "max-w-3xl", media: "max-w-5xl", larga: "max-w-[78rem]" } as const;
export type Largura = keyof typeof larguras;

/**
 * A abertura da página: o rótulo de arquivo, o título grande em letra de livro (com uma palavra de destaque em itálico
 * vermelho, se quiser), a linha fina, os botões e, à direita, o que a página quiser pôr em evidência (um cartaz, um
 * número, um cartão). Sem `lado`, o título ocupa a largura toda.
 */
export function Capa({
  rotulo,
  titulo,
  destaque,
  children,
  acoes,
  lado,
  tom = "papel",
  largura = "larga",
  estrela = false,
}: {
  rotulo: string;
  titulo: string;
  /** Palavra (ou trecho) que vem depois do título, em itálico vermelho: "Jornal Revolucionário *Lúcia*". */
  destaque?: string;
  /** A linha fina, embaixo do título. */
  children?: ReactNode;
  acoes?: ReactNode;
  lado?: ReactNode;
  tom?: TomDaCapa;
  largura?: Largura;
  /** A estrela grande do símbolo, recortada no canto (só nas capas preta e vermelha). */
  estrela?: boolean;
}) {
  const claro = tom !== "papel";
  return (
    <header className={`capa-da-pagina relative overflow-hidden ${fundos[tom]}`}>
      {estrela && claro && <Star className="pointer-events-none absolute -right-16 -bottom-24 h-80 w-80 rotate-12 text-[#c21f16] opacity-90 max-md:h-48 max-md:w-48 [.capa-vermelha_&]:text-[#a51810]" />}
      <div className={`relative mx-auto grid ${larguras[largura]} items-center gap-10 px-4 pt-12 pb-12 sm:px-6 lg:px-8 lg:pt-14 lg:pb-14 max-md:pt-8 max-md:pb-9 ${lado ? "md:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]" : ""}`}>
        <div className="min-w-0">
          <p className={`rotulo ${claro ? "text-[#e0837a]! [.capa-vermelha_&]:text-white!" : ""}`}>{rotulo}</p>
          <h1 className="mt-3 text-[2.6rem] font-medium leading-[1.0] tracking-[-0.01em] text-balance sm:text-6xl lg:text-[4.2rem]">
            {titulo}
            {destaque && (
              <>
                {" "}
                <span className={`italic ${tom === "papel" ? "text-prelo-texto" : tom === "preto" ? "text-[#e0837a]" : "text-[#1f1a14]"}`}>{destaque}</span>
              </>
            )}
          </h1>
          {children && <div className={`mt-5 max-w-[40rem] text-[1.3rem] leading-[1.45] max-md:text-lg ${claro ? "text-[#e9dcbc] [.capa-vermelha_&]:text-white/90" : "text-ink-soft"}`}>{children}</div>}
          {acoes && <div className="mt-7 flex flex-wrap items-center gap-3.5">{acoes}</div>}
        </div>
        {lado && <div className="min-w-0">{lado}</div>}
      </div>
    </header>
  );
}

/** O miolo da página, centrado, na largura que a leitura pede. */
export function Corpo({ children, largura = "media", className = "" }: { children: ReactNode; largura?: Largura; className?: string }) {
  return <div className={`mx-auto ${larguras[largura]} px-4 py-12 sm:px-6 lg:px-8 max-md:py-8 ${className}`}>{children}</div>;
}

/**
 * Uma seção com a tarja de título: a etiqueta (vermelha ou preta) com a estrela e um fio até o fim da linha, como nas
 * editorias do jornal. `acao` é um link ou botão que fica no fim do fio ("Ver todas →").
 */
export function Secao({ titulo, id, tarja = "preta", acao, children, className = "", descricao }: { titulo: string; id?: string; tarja?: "preta" | "vermelha"; acao?: ReactNode; children: ReactNode; className?: string; descricao?: ReactNode }) {
  return (
    <section aria-labelledby={id ? `${id}-titulo` : undefined} id={id} className={`scroll-mt-40 ${className}`}>
      <div className="flex items-center gap-3.5">
        <h2 id={id ? `${id}-titulo` : undefined} className={`shrink-0 px-3 py-1.5 font-mono text-xs font-semibold uppercase tracking-[0.2em] ${tarja === "vermelha" ? "bg-[#c21f16] text-white" : "bg-ink text-parchment"}`}>
          ★ {titulo}
        </h2>
        <span aria-hidden className={`flex-1 border-t-2 ${tarja === "vermelha" ? "border-[#c21f16]" : "border-ink"}`} />
        {acao && <span className="shrink-0 font-sans text-sm font-bold">{acao}</span>}
      </div>
      {descricao && <div className="mt-3 max-w-3xl text-lg leading-snug text-ink-soft">{descricao}</div>}
      <div className="mt-6">{children}</div>
    </section>
  );
}
