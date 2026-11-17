// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useMemo, type ReactNode } from "react";
import Link from "@/components/Link";
import { lerTextoFormatado, lerTrechos } from "@/lib/rede/texto/formatado";
import { desenhar, desenharTrechos, type PecasDoTexto } from "@/lib/rede/texto/desenhar";
import { preencher } from "@/lib/rede/preencher";
import { TextoComTags } from "../descoberta/TextoComTags";
import { SoMencoes } from "../conversa/TextoComMencoes";
import { LinkDoLeitor } from "../protecao/LinkDoLeitor";
import { BlocoDeCodigo } from "./BlocoDeCodigo";
import { Formula } from "./Formula";
import { useTextosDoTexto, type TextosDoTexto } from "./textos";
import "./texto.css";

/** Uma imagem anexada ao post, já com o endereço assinado do depósito (o cartão pede como sempre, pela matriz de quem vê). */
export interface ImagemDoTexto {
  src: string;
  alt: string;
  largura?: number | null;
  altura?: number | null;
}

/** As peças de verdade: fórmula com o KaTeX, bloco de código com copiar, imagem do post, link e texto com menções e hashtags. */
function pecas(lang: string, t: TextosDoTexto | null, imagens: readonly ImagemDoTexto[]): PecasDoTexto {
  return {
    Formula,
    Codigo: ({ codigo, lingua }) => <BlocoDeCodigo codigo={codigo} lingua={lingua} t={t} />,
    Texto: ({ texto }) => <TextoComTags texto={texto} lang={lang} Resto={SoMencoes} />,
    Imagem: ({ n, alt }) => {
      const img = imagens[n - 1];
      if (!img) return <p className="txf-imagem-falta">{t ? preencher(t.imagem.falta, { n }) : `(${n})`}</p>;
      const descricao = alt || img.alt;
      return (
        <figure className="txf-imagem">
          {/* O endereço é o do depósito da própria Alumia (assinado, por pouco tempo): nada de fora. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={img.src} alt={descricao} loading="lazy" decoding="async" width={img.largura ?? undefined} height={img.altura ?? undefined} />
          {alt && <figcaption>{alt}</figcaption>}
        </figure>
      );
    },
    Link: ({ href, children }: { href: string; children?: ReactNode }) =>
      href.startsWith("/") ? (
        <Link href={href} className="txf-link">
          {children}
        </Link>
      ) : (
        // Conferido no Safe Browsing do lado de quem lê: o link perigoso sai como texto, sem clique.
        <LinkDoLeitor href={href} lang={lang} className="txf-link">
          {children}
          <span className="txf-so-leitor"> ({t?.link.fora ?? "↗"})</span>
        </LinkDoLeitor>
      ),
  };
}

/**
 * O texto formatado (lib/rede/texto/formatado.ts) desenhado com as peças da Alumia: o texto longo, a questão, a explicação, a prévia
 * do compositor. `imagens` são as imagens anexadas ao post, na ordem (a "imagem:1" é a primeira). `nivel` é o h do "##".
 */
export function TextoFormatado({ texto, lang, imagens = [], nivel = 4, className = "" }: { texto: string; lang: string; imagens?: readonly ImagemDoTexto[]; nivel?: 2 | 3 | 4; className?: string }) {
  const t = useTextosDoTexto(lang);
  const blocos = useMemo(() => lerTextoFormatado(texto), [texto]);
  const p = useMemo(() => pecas(lang, t, imagens), [lang, t, imagens]);
  return <div className={`txf ${className}`.trim()}>{desenhar(blocos, p, nivel)}</div>;
}

/** Uma linha só (a alternativa de uma questão, um título): os trechos, sem blocos. */
export function TrechoFormatado({ texto, lang }: { texto: string; lang: string }) {
  const t = useTextosDoTexto(lang);
  const trechos = useMemo(() => lerTrechos(texto.replace(/\s*\n\s*/g, " ")), [texto]);
  const p = useMemo(() => pecas(lang, t, []), [lang, t]);
  return <>{desenharTrechos(trechos, p)}</>;
}
