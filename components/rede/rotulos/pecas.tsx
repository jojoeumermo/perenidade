// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

// As peças comuns do relatório, dos rótulos e do bloco do painel: o número do relatório ("menos de 3" abaixo de 3, "sem número" no reservado), o texto com
// **ênfase** e [link](/endereço) sem HTML, o cabeçalho com carimbo e o esqueleto de carregamento.
import "./rotulos.css";
import { Fragment, type ReactNode } from "react";
import Link from "@/components/Link";
import { EsqueletoDaLinha } from "../Esqueletos";
import { numeroDoRelatorio, type NumeroDoRelatorio } from "./regras";

/** O número como o relatório mostra: o número (com separador de milhar no idioma), "menos de 3" ou "sem número", apagado. */
export function Numero({ lang, n, menos, reservado = menos, className = "rt-n", como: Tag = "span" }: { lang: string; n: NumeroDoRelatorio | undefined; menos: string; reservado?: string; className?: string; como?: "span" | "dd" | "strong" }) {
  const valor = numeroDoRelatorio(n);
  const idioma = lang === "pt" ? "pt-BR" : lang;
  return (
    <Tag className={className} data-pouco={valor === null ? "sim" : undefined}>
      {valor === null ? (n === "reservado" ? reservado : menos) : new Intl.NumberFormat(idioma).format(valor)}
    </Tag>
  );
}

/** O texto dos arquivos de idioma com duas marcas: **ênfase** e [rótulo](/endereço). Nada de HTML. */
export function Rico({ lang, texto }: { lang: string; texto: string }) {
  const partes: ReactNode[] = [];
  const marca = /\*\*([^*]+)\*\*|\[([^\]]+)\]\(([^)\s]+)\)/g;
  let fim = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = marca.exec(texto))) {
    if (m.index > fim) partes.push(texto.slice(fim, m.index));
    if (m[1]) partes.push(<strong key={i++}>{m[1]}</strong>);
    else {
      const href = m[3].startsWith("/") ? `/${lang}${m[3]}` : m[3];
      partes.push(href.startsWith("/") ? <Link key={i++} href={href} className="rt-link">{m[2]}</Link> : <a key={i++} href={href} className="rt-link">{m[2]}</a>);
    }
    fim = marca.lastIndex;
  }
  if (fim < texto.length) partes.push(texto.slice(fim));
  return <>{partes.map((p, k) => <Fragment key={k}>{p}</Fragment>)}</>;
}

/** O cabeçalho: o carimbo, o título, a chamada e a faixa tecida. */
export function Cabeca({ carimbo, titulo, chamada, lang }: { carimbo: string; titulo: string; chamada: string; lang: string }) {
  return (
    <header className="rt-cabeca">
      <p className="rt-carimbo al-cond">{carimbo}</p>
      <h1 className="al-cond">{titulo}</h1>
      <p className="rt-chamada"><Rico lang={lang} texto={chamada} /></p>
    </header>
  );
}

/** Enquanto os textos ou os dados chegam. */
export function Carregando({ rotulo }: { rotulo: string }) {
  return <EsqueletoDaLinha rotulo={rotulo} quantos={3} />;
}
