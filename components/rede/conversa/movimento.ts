// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

// O movimento das telas da F3 na Alumia nova (comunidade, conversa, Explorar, Buscar, Avisos, Salvos): mola, FLIP e a régua que
// desliza sob o botão escolhido. Tudo com a Web Animations API do navegador (sem biblioteca). Nada se mexe para quem pediu menos
// movimento (prefers-reduced-motion), ligou o modo parado do site (:root[data-parado]) ou usa o e-ink (:root[data-eink]: a tela de
// tinta borra animação). O CSS (alumia3.css) segue a mesma regra para o que é só CSS.
import { useLayoutEffect, useRef, type RefObject } from "react";

/** A mola das pranchas: sobe rápido, passa um tico do ponto e assenta (curva `linear()` do CSS, a mesma do alumia3.css). */
export const MOLA =
  "linear(0, 0.006, 0.025 2.8%, 0.101 6.1%, 0.539 18.9%, 0.721 25.3%, 0.849 31.5%, 0.937 38.1%, 0.968 41.8%, 0.991 45.7%, 1.006 50.1%, 1.015 55%, 1.017 63.9%, 1.001)";
/** A mola com pulo (reação, carimbo pequeno): passa mais do ponto antes de assentar. */
export const MOLA_PULO =
  "linear(0, 0.009, 0.035 2.1%, 0.141, 0.281 6.7%, 0.723 12.9%, 0.938 16.7%, 1.017, 1.077, 1.121, 1.149 24.3%, 1.159, 1.163, 1.161, 1.154 29.9%, 1.129 32.8%, 1.051 39.6%, 1.017 43.1%, 0.991, 0.977 51%, 0.974 53.8%, 0.975 57.1%, 0.997 69.8%, 1.003 76.9%, 1)";

/** Esta pessoa quer a tela parada? (pedido do sistema, modo parado do site ou e-ink). */
export function semMovimento(): boolean {
  if (typeof window === "undefined") return true;
  const raiz = document.documentElement;
  if (raiz.hasAttribute("data-parado") || raiz.hasAttribute("data-eink")) return true;
  return window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
}

/** Um "pulo" curto no elemento (a reação escolhida, o Entrar que virou Participando). */
export function pular(el: Element | null | undefined, escala = 1.18) {
  if (!el || semMovimento() || typeof (el as HTMLElement).animate !== "function") return;
  (el as HTMLElement).animate([{ transform: "scale(1)" }, { transform: `scale(${escala})`, offset: 0.35 }, { transform: "scale(1)" }], {
    duration: 520,
    easing: MOLA,
  });
}

/**
 * FLIP: quando a ORDEM dos itens muda (a `chave`), cada item com [data-flip] desliza da posição antiga para a nova com a mola, em
 * vez de pular. A posição é medida em relação ao contêiner (rolar a página não conta como mudar de lugar). Item novo entra subindo.
 */
export function useFlip(raiz: RefObject<HTMLElement | null>, chave: string) {
  const antes = useRef<Map<string, number>>(new Map());
  const chaveAntes = useRef<string | null>(null);
  useLayoutEffect(() => {
    const el = raiz.current;
    if (!el) return;
    const topo = el.getBoundingClientRect().top;
    const agora = new Map<string, number>();
    el.querySelectorAll<HTMLElement>("[data-flip]").forEach((item) => {
      agora.set(item.dataset.flip ?? "", item.getBoundingClientRect().top - topo);
    });
    const mudou = chaveAntes.current !== null && chaveAntes.current !== chave;
    if (mudou && !semMovimento()) {
      let i = 0;
      el.querySelectorAll<HTMLElement>("[data-flip]").forEach((item) => {
        const id = item.dataset.flip ?? "";
        const de = antes.current.get(id);
        const para = agora.get(id) ?? 0;
        if (de === undefined) {
          item.animate([{ opacity: 0, transform: "translateY(12px)" }, { opacity: 1, transform: "none" }], { duration: 420, easing: MOLA, delay: 30 * i++ });
        } else if (Math.abs(de - para) > 1) {
          // Só a diferença do próprio item (o pai já se moveu junto): desconta o deslocamento do item [data-flip] de fora.
          const pai = item.parentElement?.closest<HTMLElement>("[data-flip]");
          const dPai = pai ? (antes.current.get(pai.dataset.flip ?? "") ?? 0) - (agora.get(pai.dataset.flip ?? "") ?? 0) : 0;
          const dy = de - para - dPai;
          if (Math.abs(dy) > 1) item.animate([{ transform: `translateY(${dy}px)` }, { transform: "none" }], { duration: 560, easing: MOLA });
        }
      });
    }
    antes.current = agora;
    chaveAntes.current = chave;
  });
}

/**
 * A régua que desliza sob o botão escolhido (abas da comunidade, "Mais antigas / Mais novas"): põe --al3-x e --al3-l no contêiner,
 * medidos do botão com aria-selected/aria-pressed = true. O CSS desenha a régua e anima a transição (com a mola).
 */
export function useRegua(raiz: RefObject<HTMLElement | null>, chave: string) {
  useLayoutEffect(() => {
    const el = raiz.current;
    if (!el) return;
    const medir = () => {
      const escolhido = el.querySelector<HTMLElement>('[aria-selected="true"], [aria-pressed="true"]');
      if (!escolhido) return;
      el.style.setProperty("--al3-x", `${escolhido.offsetLeft}px`);
      el.style.setProperty("--al3-l", `${escolhido.offsetWidth}px`);
      el.dataset.regua = "sim";
    };
    medir();
    // A fonte chega depois e o celular gira: mede de novo quando o tamanho muda.
    const obs = typeof ResizeObserver !== "undefined" ? new ResizeObserver(medir) : null;
    obs?.observe(el);
    return () => obs?.disconnect();
  }, [raiz, chave]);
}

/** Leva o elemento para a vista sem pulo seco (suave quando pode; direto para quem pediu a tela parada). */
export function trazerParaVista(el: Element | null | undefined) {
  el?.scrollIntoView({ behavior: semMovimento() ? "auto" : "smooth", block: "nearest" });
}
