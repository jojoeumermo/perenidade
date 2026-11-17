// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

// As peças comuns das cinco páginas da lei e da ajuda (termos, privacidade, o que guardamos, regras, ajuda): o cabeçalho com a
// versão em carimbo, a faixa de navegação entre elas, o sumário que acompanha a leitura, as seções e o texto com ênfase e links.
import "./lei.css";
import { Fragment, type ReactNode, useEffect, useState } from "react";
import Link from "@/components/Link";
import { EsqueletoDaLinha } from "../Esqueletos";
import { por, type TextosDaLei } from "./textos";
import { dataDaVersao } from "./versao";

export type PaginaDaLei = "termos" | "privacidade" | "guardamos" | "regras" | "ajuda";

const ROTAS: Record<PaginaDaLei, string> = {
  termos: "termos",
  privacidade: "privacidade",
  guardamos: "o-que-guardamos",
  regras: "regras",
  ajuda: "ajuda",
};

/** O endereço de uma das cinco páginas. */
export const rotaDaLei = (lang: string, pagina: PaginaDaLei, ancora = "") => `/${lang}/alumia/${ROTAS[pagina]}${ancora ? `#${ancora}` : ""}`;

/** Endereço do texto: "/alumia/…" e "/denunciar" ganham o idioma; "#…" fica; o resto (mailto) passa como está. */
function enderecoDoTexto(lang: string, href: string): string {
  if (href.startsWith("/")) return `/${lang}${href}`;
  return href;
}

/**
 * O texto dos arquivos de idioma, com duas marcas só: **ênfase** e [rótulo](/endereço). Nada de HTML: o texto vira nós do React,
 * então nada do arquivo pode injetar marcação.
 */
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
      const href = enderecoDoTexto(lang, m[3]);
      partes.push(
        href.startsWith("/") ? (
          <Link key={i++} href={href} className="le-link">{m[2]}</Link>
        ) : (
          <a key={i++} href={href} className="le-link">{m[2]}</a>
        ),
      );
    }
    fim = marca.lastIndex;
  }
  if (fim < texto.length) partes.push(texto.slice(fim));
  return <>{partes.map((p, k) => <Fragment key={k}>{p}</Fragment>)}</>;
}

/** A faixa com as cinco páginas: a aberta marcada, as outras a um toque. */
export function NavDaLei({ lang, t, aberta }: { lang: string; t: TextosDaLei; aberta: PaginaDaLei }) {
  const nomes: Record<PaginaDaLei, string> = { termos: t.nav.termos, privacidade: t.nav.privacidade, guardamos: t.nav.guardamos, regras: t.nav.regras, ajuda: t.nav.ajuda };
  return (
    <nav className="le-nav" aria-label={t.nav.rotulo}>
      {(Object.keys(ROTAS) as PaginaDaLei[]).map((p) => (
        <Link key={p} href={rotaDaLei(lang, p)} className="le-nav-item al-cond" aria-current={p === aberta ? "page" : undefined}>
          {nomes[p]}
        </Link>
      ))}
    </nav>
  );
}

/** O cabeçalho: o carimbo da versão (nos termos e na privacidade), o título, a chamada e a faixa tecida. */
export function CabecaDaLei({ lang, t, titulo, chamada, comVersao = false }: { lang: string; t: TextosDaLei; titulo: string; chamada: string; comVersao?: boolean }) {
  return (
    <header className="le-cabeca">
      {comVersao && (
        <p className="le-carimbo al-cond">
          <span>{por(t.comum.versao, { data: dataDaVersao(lang) })}</span>
          <span className="le-carimbo-nota">{t.comum.revisao}</span>
        </p>
      )}
      <h1 className="al-cond">{titulo}</h1>
      <p className="le-chamada">
        <Rico lang={lang} texto={chamada} />
      </p>
    </header>
  );
}

export interface SecaoDaLei {
  id: string;
  titulo: string;
  paragrafos?: string[];
  itens?: string[];
}

/** Uma seção de texto corrido: parágrafos e, se houver, a lista. */
export function Secao({ lang, secao, n }: { lang: string; secao: SecaoDaLei; n: number }) {
  return (
    <section className="le-secao" id={secao.id} aria-labelledby={`${secao.id}-t`}>
      <h2 id={`${secao.id}-t`} className="le-secao-titulo al-cond">
        <span className="le-secao-n" aria-hidden>{String(n).padStart(2, "0")}</span>
        {secao.titulo}
      </h2>
      {secao.paragrafos?.map((p, i) => (
        <p key={i} className="le-texto">
          <Rico lang={lang} texto={p} />
        </p>
      ))}
      {secao.itens && (
        <ul className="le-itens">
          {secao.itens.map((item, i) => (
            <li key={i}>
              <Rico lang={lang} texto={item} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/** O sumário que acompanha a leitura: marca a seção que está na tela. */
export function Indice({ t, secoes }: { t: TextosDaLei; secoes: { id: string; titulo: string }[] }) {
  const [ativa, setAtiva] = useState(secoes[0]?.id ?? "");
  useEffect(() => {
    if (typeof IntersectionObserver === "undefined") return;
    const alvos = secoes.map((s) => document.getElementById(s.id)).filter((e): e is HTMLElement => !!e);
    const olho = new IntersectionObserver(
      (entradas) => {
        const visivel = entradas.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
        if (visivel) setAtiva(visivel.target.id);
      },
      { rootMargin: "-15% 0px -70% 0px" },
    );
    alvos.forEach((a) => olho.observe(a));
    return () => olho.disconnect();
  }, [secoes]);
  return (
    <nav className="le-indice" aria-label={t.comum.indice}>
      <p className="le-indice-titulo al-cond">{t.comum.indice}</p>
      <ol>
        {secoes.map((s) => (
          <li key={s.id}>
            <a href={`#${s.id}`} aria-current={s.id === ativa ? "location" : undefined}>{s.titulo}</a>
          </li>
        ))}
      </ol>
    </nav>
  );
}

/** Enquanto os textos chegam. */
export function CarregandoALei({ rotulo }: { rotulo: string }) {
  return <EsqueletoDaLinha rotulo={rotulo} quantos={3} />;
}

/** Data e hora curtas no idioma da página ("14 de nov., 18:30"). */
export function quando(lang: string, iso: string | null | undefined, comHora = true): string {
  if (!iso) return "";
  const idioma = lang === "pt" ? "pt-BR" : lang;
  try {
    return new Intl.DateTimeFormat(idioma, comHora ? { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" } : { day: "numeric", month: "long", year: "numeric" }).format(new Date(iso));
  } catch {
    return iso.slice(0, 16).replace("T", " ");
  }
}

/** O código de um erro do banco ("invalido:texto", "prazo_vencido"…), para escolher o texto da tela. */
export function codigoDoErro(erro: unknown): string {
  if (erro && typeof erro === "object" && "code" in erro && typeof (erro as { code: unknown }).code === "string") return (erro as { code: string }).code;
  return erro instanceof Error ? erro.message : String(erro ?? "");
}
