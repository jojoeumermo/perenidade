// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
// O gesto de voltar: deslizar da borda esquerda para a direita. As regras são puras (testadas em
// scripts/testar-app-casca.mjs); `podeComecar` olha o elemento tocado e só roda no navegador.
// Princípio: o gesto NUNCA toma o lugar da rolagem horizontal (carrosséis, tabelas, abas que correm de lado).

export interface Toque {
  x: number;
  y: number;
  /** milissegundos (performance.now) */
  t: number;
}

export const GESTO = {
  /** A largura da faixa da borda onde o gesto pode começar (px). O gesto do sistema Android usa os primeiros ~20 px. */
  borda: 28,
  /** O quanto precisa andar para a direita (px). */
  distancia: 72,
  /** Mais devagar que isso não é gesto, é arrasto de texto ou de mapa. */
  tempoMax: 900,
  /** A inclinação máxima: andar na vertical mais que a metade do que andou na horizontal é rolagem. */
  inclinacao: 0.5,
} as const;

/** O toque começou na faixa da borda esquerda? */
export const naBorda = (x: number): boolean => x >= 0 && x <= GESTO.borda;

/** O deslizar do `inicio` ao `fim` vale como "voltar"? */
export function valeComoVoltar(inicio: Toque, fim: Toque): boolean {
  const dx = fim.x - inicio.x;
  const dy = Math.abs(fim.y - inicio.y);
  const dt = fim.t - inicio.t;
  return naBorda(inicio.x) && dx >= GESTO.distancia && dy <= dx * GESTO.inclinacao && dt <= GESTO.tempoMax;
}

/** 0 a 1: o quanto do gesto já foi feito (para o indicador que acompanha o dedo). */
export function progressoDoGesto(inicio: Toque, atual: Toque): number {
  const dx = atual.x - inicio.x;
  const dy = Math.abs(atual.y - inicio.y);
  if (dx <= 0 || dy > dx * GESTO.inclinacao * 1.6) return 0;
  return Math.min(1, dx / GESTO.distancia);
}

/** iPhone e iPad já têm o deslizar da borda do sistema (também no site instalado): lá a casca não duplica o gesto. */
export const temGestoDoSistema = (agente: string, maxToques: number, plataforma = ""): boolean =>
  /iPhone|iPad|iPod/.test(agente) || (plataforma === "MacIntel" && maxToques > 1);

/**
 * Pode começar um gesto neste elemento? Não, dentro de: campo de texto, controle deslizante, mapa/canvas, quadro
 * embutido, janela aberta (modal) e qualquer coisa marcada com data-sem-gesto; e não sobre uma faixa que rola de lado e
 * ainda tem o que rolar para trás (scrollLeft > 0): aí o dedo é da faixa.
 */
export function podeComecar(alvo: EventTarget | null): boolean {
  if (!(alvo instanceof Element)) return true;
  if (alvo.closest("input, textarea, select, canvas, iframe, video, [contenteditable=''], [contenteditable='true'], [data-sem-gesto], [role='slider'], [role='dialog'], [aria-modal='true']")) return false;
  if (document.querySelector("dialog[open], [aria-modal='true']")) return false;
  for (let el: Element | null = alvo; el && el !== document.documentElement; el = el.parentElement) {
    if (!(el instanceof HTMLElement)) continue;
    if (el.scrollWidth > el.clientWidth + 1 && el.scrollLeft > 0) {
      const o = getComputedStyle(el).overflowX;
      if (o === "auto" || o === "scroll") return false;
    }
  }
  return true;
}
