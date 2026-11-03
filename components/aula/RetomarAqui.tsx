// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useEffect, useRef, useState } from "react";
import { fill } from "@/i18n/config";
import type { TextosDaAula } from "@/i18n/escola/aula";
import { gravarPonto, IR_PARA_PARTE, pontoDaAula, type Ponto } from "@/lib/posicao-da-aula";
import { estadoDoLeitor, useLeitor } from "@/lib/vozes/leitor";

const BLOCOS = "#texto-da-aula [data-p]";

/** O bloco do texto que está na altura da leitura (um terço abaixo do topo da tela). */
function blocoNaTela(): HTMLElement | null {
  const linha = window.innerHeight / 3;
  let escolhido: HTMLElement | null = null;
  for (const el of document.querySelectorAll<HTMLElement>(BLOCOS)) {
    if (el.closest("[hidden], [data-parte-fora]")) continue;
    const caixa = el.getBoundingClientRect();
    if (!caixa.height) continue;
    if (caixa.top <= linha) escolhido = el;
    else break;
  }
  return escolhido;
}

function guardarAgora(aula: string) {
  const el = blocoNaTela();
  if (!el) return;
  const estado = estadoDoLeitor();
  gravarPonto(aula, { parte: Number(el.getAttribute("data-parte") ?? 0) || 0, paragrafo: Number(el.getAttribute("data-p")) || 0, trecho: estado.ativo ? estado.trecho : -1 });
}

/** Vai até o bloco, trocando de parte se o modo "uma parte por vez" estiver escondendo ele. */
function irAte(ponto: Pick<Ponto, "parte" | "paragrafo">) {
  window.dispatchEvent(new CustomEvent(IR_PARA_PARTE, { detail: ponto.parte }));
  window.setTimeout(() => {
    const alvo = document.querySelector<HTMLElement>(`#texto-da-aula [data-p="${ponto.paragrafo}"]`);
    if (!alvo) return;
    alvo.scrollIntoView({ block: "center", behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
    alvo.classList.add("nota-foco");
    window.setTimeout(() => alvo.classList.remove("nota-foco"), 2500);
  }, 60);
}

/**
 * Retomar exatamente (Etapa 4, R1-18). Guarda onde a pessoa está na aula (parte, bloco e trecho do "Ouvir") quando a
 * rolagem fica parada por 2 s, quando o áudio pausa e ao sair da página, só neste aparelho. Ao voltar, mostra o aviso
 * "Voltar para onde parou (parte 3, parágrafo 12)", sem pular sozinho. Cada bloco ganha também o id "p-<n>", para o
 * link do ponto (linkDoPonto) funcionar.
 */
export function RetomarAqui({ aula, partes, s }: { aula: string; partes: boolean; s: TextosDaAula["retomar"] }) {
  const [ponto, setPonto] = useState<Ponto | null>(null);
  const leitor = useLeitor();
  const tocava = useRef(false);

  useEffect(() => {
    for (const el of document.querySelectorAll<HTMLElement>(BLOCOS)) if (!el.id) el.id = `p-${el.getAttribute("data-p")}`;
    const guardado = pontoDaAula(aula);
    const ancora = /^#p-(\d+)$/.exec(window.location.hash);
    if (ancora) {
      // A pessoa abriu um link para o ponto: ela pediu para ir até lá.
      irAte({ parte: Number(document.getElementById(`p-${ancora[1]}`)?.getAttribute("data-parte") ?? 0), paragrafo: Number(ancora[1]) });
    } else if (guardado && (guardado.paragrafo > 0 || guardado.parte > 0)) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- o ponto só existe no aparelho
      setPonto(guardado);
    }
    let espera: number | undefined;
    const rolou = () => {
      window.clearTimeout(espera);
      espera = window.setTimeout(() => guardarAgora(aula), 2000);
    };
    const saiu = () => guardarAgora(aula);
    window.addEventListener("scroll", rolou, { passive: true });
    window.addEventListener("pagehide", saiu);
    return () => {
      window.clearTimeout(espera);
      window.removeEventListener("scroll", rolou);
      window.removeEventListener("pagehide", saiu);
    };
  }, [aula]);

  // O áudio pausou (ou parou): guarda o ponto com o trecho do "Ouvir".
  useEffect(() => {
    if (tocava.current && !leitor.tocando) guardarAgora(aula);
    tocava.current = leitor.tocando;
  }, [leitor.tocando, aula]);

  if (!ponto) return null;
  const texto = partes ? fill(s.aviso, { parte: ponto.parte + 1, paragrafo: ponto.paragrafo + 1 }) : fill(s.avisoSemParte, { paragrafo: ponto.paragrafo + 1 });
  return (
    <div className="retomar-aqui no-print no-leitor" role="status">
      <button
        type="button"
        className="retomar-ir"
        onClick={() => {
          irAte(ponto);
          setPonto(null);
        }}
      >
        <svg aria-hidden viewBox="0 0 24 24" className="h-5 w-5 shrink-0" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M6 3h12v18l-6-4-6 4z" />
        </svg>
        <span>{texto}</span>
      </button>
      <button type="button" className="retomar-dispensar" onClick={() => setPonto(null)}>
        {s.dispensar}
      </button>
    </div>
  );
}
