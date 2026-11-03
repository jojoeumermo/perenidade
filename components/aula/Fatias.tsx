// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { Fragment, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { fill } from "@/i18n/config";
import type { TextosDaAula } from "@/i18n/escola/aula";
import { letrasDoComeco, type Ancora } from "@/lib/fatias";
import { gravarPonto, IR_PARA_PARTE } from "@/lib/posicao-da-aula";

export interface FatiaDaAula {
  minutos: number;
  titulo: string | null;
  ancora: Ancora;
}

const CHAVE_EM_PARTES = "lucia:aula-em-partes";

interface Parte {
  minutos: number;
  titulo: string | null;
  /** Antes do primeiro bloco da parte: a marca "Parte 2 de 5 · 4 min". */
  marca: HTMLElement;
  /** Depois do último bloco: "Parar aqui" e, no modo uma parte por vez, "Continuar". */
  fim: HTMLElement;
  /** O primeiro bloco numerado (data-p) da parte. */
  primeiroBloco: number;
}

const ehTitulo = (el: Element) => el.tagName === "H2" || el.tagName === "H3";

/**
 * Marca as partes no texto já montado: cada bloco de primeiro nível ganha data-parte (que o acompanhante do estudante,
 * E4-10, lê) e entre as partes entram dois pontos de montagem. Uma âncora que não se acha no texto (um parágrafo que
 * começa com fórmula, por exemplo) só junta a parte dela com a anterior.
 */
function marcarPartes(raiz: Element, fatias: FatiaDaAula[]): Parte[] {
  // Os pontos do "Ouvir" (OuvirParagrafo, R1-87) não são blocos do texto: andam com o parágrafo logo abaixo (CSS).
  const filhos = [...raiz.children].filter((el) => !el.hasAttribute("data-fatia") && !el.hasAttribute("data-ouvir"));
  const comeca: { filho: number; fatia: number }[] = [{ filho: 0, fatia: 0 }];
  let titulos = 0;
  filhos.forEach((el, i) => {
    const n = ehTitulo(el) ? titulos++ : -1;
    const letras = el.tagName === "P" ? letrasDoComeco(el.textContent ?? "") : "";
    for (let j = comeca[comeca.length - 1].fatia + 1; j < fatias.length; j++) {
      const a = fatias[j].ancora;
      const achou = (a.tipo === "titulo" && a.n === n) || (a.tipo === "texto" && letras.length >= 12 && letras.startsWith(a.texto.slice(0, Math.min(24, a.texto.length))));
      if (achou && i > 0) {
        comeca.push({ filho: i, fatia: j });
        break;
      }
    }
  });
  return comeca.map(({ filho, fatia }, p) => {
    const ate = comeca[p + 1]?.filho ?? filhos.length;
    const daParte = filhos.slice(filho, ate);
    daParte.forEach((el) => el.setAttribute("data-parte", String(p)));
    const fatiasJuntas = fatias.slice(fatia, comeca[p + 1]?.fatia ?? fatias.length);
    const marca = document.createElement("div");
    marca.setAttribute("data-fatia", "marca");
    marca.setAttribute("data-parte", String(p));
    marca.id = `parte-${p + 1}`;
    marca.className = "fatia-marca no-print";
    // A marca entra antes do "Ouvir" do primeiro parágrafo, se ele já estiver lá, para o botão ficar junto do parágrafo.
    let antesDe: Element | null = daParte[0] ?? null;
    while (antesDe?.previousElementSibling?.hasAttribute("data-ouvir")) antesDe = antesDe.previousElementSibling;
    raiz.insertBefore(marca, antesDe);
    const fim = document.createElement("div");
    fim.setAttribute("data-fatia", "fim");
    fim.setAttribute("data-parte", String(p));
    fim.className = "fatia-fim no-print";
    raiz.insertBefore(fim, daParte[daParte.length - 1]?.nextSibling ?? null);
    const bloco = daParte.map((el) => el.getAttribute("data-p")).find((v) => v !== null);
    return { minutos: fatiasJuntas.reduce((s, f) => s + f.minutos, 0), titulo: fatiasJuntas[0]?.titulo ?? null, marca, fim, primeiroBloco: bloco ? Number(bloco) : 0 };
  });
}

function lerEmPartes(): boolean {
  try {
    return localStorage.getItem(CHAVE_EM_PARTES) === "1";
  } catch {
    return false;
  }
}

/**
 * A aula em fatias (Etapa 4, R1-17): o índice das partes no topo, a marca "Parte 2 de 5 · 4 min" no começo de cada uma
 * e, no fim, "Parar aqui", que guarda o ponto neste aparelho (lib/posicao-da-aula.ts). O modo "uma parte por vez",
 * lembrado em "lucia:aula-em-partes", mostra só a parte atual, com "Continuar". A página continua uma só: sem o
 * navegador (ou sem este recurso), a aula aparece inteira como sempre. Aula de uma fatia não muda.
 */
export function Fatias({ aula, fatias, s }: { aula: string; fatias: FatiaDaAula[]; s: TextosDaAula["fatias"] }) {
  const [partes, setPartes] = useState<Parte[]>([]);
  const [umaPorVez, setUmaPorVez] = useState(false);
  const [atual, setAtual] = useState(0);
  const [parado, setParado] = useState(-1);

  useEffect(() => {
    const raiz = document.querySelector("#texto-da-aula .prose-lesson");
    if (!raiz || fatias.length < 2) return;
    const marcadas = marcarPartes(raiz, fatias);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- as partes só existem depois que o texto está na tela
    setPartes(marcadas.length > 1 ? marcadas : []);
    setUmaPorVez(lerEmPartes());
    const ir = (e: Event) => {
      const p = Number((e as CustomEvent<number>).detail);
      if (Number.isInteger(p) && p >= 0 && p < marcadas.length) setAtual(p);
    };
    window.addEventListener(IR_PARA_PARTE, ir);
    return () => {
      window.removeEventListener(IR_PARA_PARTE, ir);
      for (const p of marcadas) {
        p.marca.remove();
        p.fim.remove();
      }
      for (const el of raiz.querySelectorAll("[data-parte]")) {
        el.removeAttribute("data-parte");
        el.removeAttribute("data-parte-fora");
      }
    };
  }, [aula, fatias]);

  // Uma parte por vez: as outras saem da tela (e da leitura em voz alta, que pula o que não está visível).
  useEffect(() => {
    const raiz = document.querySelector("#texto-da-aula .prose-lesson");
    if (!raiz || !partes.length) return;
    for (const el of raiz.querySelectorAll("[data-parte]")) el.toggleAttribute("data-parte-fora", umaPorVez && el.getAttribute("data-parte") !== String(atual));
  }, [partes, umaPorVez, atual]);

  if (partes.length < 2) return null;
  const n = partes.length;

  const mostrar = (p: number) => {
    setAtual(p);
    window.setTimeout(() => partes[p]?.marca.scrollIntoView({ block: "start", behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" }), 30);
  };
  const alternar = () => {
    const novo = !umaPorVez;
    setUmaPorVez(novo);
    try {
      if (novo) localStorage.setItem(CHAVE_EM_PARTES, "1");
      else localStorage.removeItem(CHAVE_EM_PARTES);
    } catch {
      // sem armazenamento: vale até fechar a página
    }
  };
  const pararAqui = (p: number) => {
    const seguinte = partes[p + 1];
    gravarPonto(aula, seguinte ? { parte: p + 1, paragrafo: seguinte.primeiroBloco, trecho: -1 } : { parte: p, paragrafo: partes[p].primeiroBloco, trecho: -1 });
    setParado(p);
  };

  return (
    <>
      <nav aria-label={fill(s.indice, { n })} className="fatias-indice no-print no-leitor" data-fatias={n}>
        <p className="rotulo">{fill(s.indice, { n })}</p>
        <ol>
          {partes.map((p, i) => (
            <li key={i}>
              <a
                href={`#parte-${i + 1}`}
                aria-current={umaPorVez && i === atual ? "true" : undefined}
                onClick={(e) => {
                  e.preventDefault();
                  mostrar(i);
                }}
              >
                <span className="fatias-numero">{i + 1}</span>
                <span className="min-w-0 flex-1">{p.titulo ?? fill(s.semTitulo, { i: i + 1 })}</span>
                <span className="fatias-minutos">{fill(s.minutos, { min: p.minutos })}</span>
              </a>
            </li>
          ))}
        </ol>
        <button type="button" aria-pressed={umaPorVez} onClick={alternar} className="fatias-modo">
          <span aria-hidden className="fatias-chave" />
          {s.umaPorVez}
        </button>
      </nav>
      {partes.map((p, i) => (
        <Fragment key={i}>
          {createPortal(<p className="fatia-marca-texto">{fill(s.marca, { i: i + 1, n, min: p.minutos })}</p>, p.marca)}
          {createPortal(
            <div className="fatia-fim-acoes">
              <button type="button" className="fatia-parar" onClick={() => pararAqui(i)}>
                <svg aria-hidden viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M6 3h12v18l-6-4-6 4z" />
                </svg>
                {s.pararAqui}
              </button>
              {umaPorVez && i + 1 < n && (
                <button type="button" className="fatia-continuar" onClick={() => mostrar(i + 1)}>
                  {fill(s.continuar, { i: i + 2 })}
                  <svg aria-hidden viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M5 12h13M13 6l6 6-6 6" />
                  </svg>
                </button>
              )}
              {umaPorVez && i + 1 === n && <span className="fatia-ultima">{s.fim}</span>}
              {parado === i && (
                <span role="status" className="fatia-guardado">
                  {s.parado}
                </span>
              )}
            </div>,
            p.fim,
          )}
        </Fragment>
      ))}
    </>
  );
}
