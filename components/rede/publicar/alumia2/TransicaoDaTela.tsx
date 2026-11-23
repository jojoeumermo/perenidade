// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

// A troca de tela da Alumia com View Transitions (Prompt 5, A17). Cada tela da Alumia monta a casca de novo, e a tela nova só
// chega depois dos textos e do pedaço de código dela: o <ViewTransition> do React não pega essa troca (ela termina fora da transição
// da navegação). Por isso a transição é pedida aqui, no toque: o navegador tira o retrato da tela que sai, o roteador troca o
// endereço, e a tela nova sobe no lugar (styles/alumia.css, :root[data-al-transicao]). O menu do lado e a barra de baixo ficam
// parados (têm nome próprio na transição). Sem a API no navegador, com "menos movimento" (do sistema ou do botão de acessibilidade)
// ou no leitor de tinta, só navega; a reserva de antes (a tela nova entra com .al2-tela-entra) continua para quem tem movimento e não
// tem a API.
import { useEffect } from "react";
import { semMovimento } from "@/components/app/transicoes";
import { registrarNavegacaoAnimada } from "@/components/Link";

type ComTransicao = Document & { startViewTransition?: (atualizar: () => Promise<void> | void) => { finished: Promise<void> } };
type Roteador = { push: (href: string) => void };

/** Uma troca de tela animada está acontecendo agora? (a tela nova não anima de novo por cima) */
export function trocaEmCurso(): boolean {
  return typeof document !== "undefined" && document.documentElement.hasAttribute("data-al-transicao");
}

/** O navegador anima a troca de tela por View Transitions, com movimento permitido? Só no navegador. */
export function trocaAnimada(): boolean {
  if (typeof document === "undefined" || typeof (document as ComTransicao).startViewTransition !== "function") return false;
  const raiz = document.documentElement;
  return !semMovimento() && !raiz.hasAttribute("data-eink") && !raiz.hasAttribute("data-leitor");
}

/** Espera o endereço mudar (o roteador trocou de tela), no máximo `limite` ms. */
function esperarOEndereco(de: string, limite = 700): Promise<void> {
  return new Promise((pronto) => {
    const fim = performance.now() + limite;
    const olhar = () => {
      if (window.location.pathname + window.location.search !== de || performance.now() > fim) return pronto();
      requestAnimationFrame(olhar);
    };
    requestAnimationFrame(olhar);
  });
}

/** Vai para `href` dentro da Alumia; com a API e movimento permitido, a troca anima. Nunca lança. */
export function navegarComTransicao(roteador: Roteador, href: string): void {
  if (!trocaAnimada()) return roteador.push(href);
  const raiz = document.documentElement;
  const de = window.location.pathname + window.location.search;
  raiz.setAttribute("data-al-transicao", "");
  const limpar = () => raiz.removeAttribute("data-al-transicao");
  try {
    (document as ComTransicao).startViewTransition!(() => {
      roteador.push(href);
      return esperarOEndereco(de);
    }).finished.then(limpar, limpar);
  } catch {
    limpar();
    roteador.push(href);
  }
}

/** O endereço é uma tela da Alumia, outra que não a de agora? */
function telaDaAlumia(href: string): string | null {
  let url: URL;
  try {
    url = new URL(href, window.location.href);
  } catch {
    return null;
  }
  if (url.origin !== window.location.origin) return null;
  if (window.location.hostname.indexOf("alumia.") !== 0 && url.pathname.split("/")[2] !== "alumia") return null;
  // Âncora na mesma tela, ou a mesma tela: sem transição.
  if (url.pathname === window.location.pathname && url.search === window.location.search) return null;
  return url.pathname + url.search + url.hash;
}

/**
 * Liga a transição nos links da Alumia enquanto a casca está montada: o <Link> do site (components/Link.tsx) pergunta antes de
 * navegar. Os links abertos em outra aba, com tecla apertada ou que a própria peça já tratou nem chegam aqui (o Next só chama a
 * navegação do próprio site).
 */
export function useTransicaoNosLinks(roteador: Roteador): void {
  useEffect(
    () =>
      registrarNavegacaoAnimada((href) => {
        if (!trocaAnimada()) return false;
        const destino = telaDaAlumia(href);
        if (!destino) return false;
        navegarComTransicao(roteador, destino);
        return true;
      }),
    [roteador],
  );
}
