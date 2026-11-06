// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Onde ficam os botões flutuantes (T11, 06/11/2026): o de acessibilidade (components/A11yWidget.tsx) e o do VLibras
// (o botão azul com a mão, posto pelo próprio tradutor do governo). Queixa: "eles ficam sobrepondo tudo". Agora a pessoa
// pode arrastar cada um (mouse, dedo ou caneta) ou escolher o canto no painel de acessibilidade (teclado e leitor de
// tela). A posição fica só neste aparelho (localStorage "lucia:flutuantes", com try/catch: sem armazenamento, vale até
// fechar a aba). Nada vai para servidor nenhum, nada é medido: é preferência de interface, como as outras de lib/prefs.ts.

import { useSyncExternalStore } from "react";

export type Flutuante = "acessibilidade" | "vlibras";
export const CANTOS = ["inf-dir", "inf-esq", "sup-dir", "sup-esq"] as const;
export type Canto = (typeof CANTOS)[number];

/**
 * A posição de um botão: um dos cantos ou um ponto livre (depois de arrastar), em frações da área onde o botão cabe
 * (0 = encostado à esquerda/no alto, 1 = à direita/embaixo). Frações, e não pixels, para continuar na tela quando a janela
 * muda de tamanho ou o celular vira.
 */
export type Posicao = { canto: Canto } | { x: number; y: number };

export const CHAVE_DOS_FLUTUANTES = "lucia:flutuantes";
const EVENTO = "lucia:flutuantes";

type Guardado = Partial<Record<Flutuante, Posicao>>;

const limitar = (n: number) => (Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : 0.5);

function valida(p: unknown): Posicao | null {
  if (!p || typeof p !== "object") return null;
  const o = p as Record<string, unknown>;
  if (typeof o.canto === "string" && (CANTOS as readonly string[]).includes(o.canto)) return { canto: o.canto as Canto };
  if (typeof o.x === "number" && typeof o.y === "number") return { x: limitar(o.x), y: limitar(o.y) };
  return null;
}

let memoria: Guardado | null = null;
const vazio: Guardado = {};

function ler(): Guardado {
  if (memoria) return memoria;
  try {
    const bruto = JSON.parse(localStorage.getItem(CHAVE_DOS_FLUTUANTES) ?? "{}") as Record<string, unknown>;
    const lido: Guardado = {};
    for (const qual of ["acessibilidade", "vlibras"] as const) {
      const p = valida(bruto?.[qual]);
      if (p) lido[qual] = p;
    }
    memoria = lido;
  } catch {
    memoria = {};
  }
  return memoria;
}

/** A posição escolhida para um botão, ou null (o lugar de sempre). */
export function lerPosicao(qual: Flutuante): Posicao | null {
  return ler()[qual] ?? null;
}

/** Guarda (ou, com null, esquece) a posição de um botão e avisa quem está desenhando. */
export function gravarPosicao(qual: Flutuante, posicao: Posicao | null) {
  const novo: Guardado = { ...ler() };
  if (posicao) novo[qual] = valida(posicao) ?? undefined;
  else delete novo[qual];
  memoria = novo;
  try {
    if (Object.keys(novo).length) localStorage.setItem(CHAVE_DOS_FLUTUANTES, JSON.stringify(novo));
    else localStorage.removeItem(CHAVE_DOS_FLUTUANTES);
  } catch {
    // sem armazenamento: vale só até fechar a aba
  }
  window.dispatchEvent(new Event(EVENTO));
}

function assinar(avisar: () => void) {
  const naOutraAba = (e: StorageEvent) => {
    if (e.key !== CHAVE_DOS_FLUTUANTES) return;
    memoria = null;
    avisar();
  };
  window.addEventListener(EVENTO, avisar);
  window.addEventListener("storage", naOutraAba);
  return () => {
    window.removeEventListener(EVENTO, avisar);
    window.removeEventListener("storage", naOutraAba);
  };
}

/** As posições escolhidas, para desenhar (no servidor e na primeira pintura: nenhuma, o lugar de sempre). */
export function usePosicoes(): Guardado {
  return useSyncExternalStore(assinar, ler, () => vazio);
}
// Só para os testes: esquece o que foi lido.
export function _esquecer() {
  memoria = null;
}

/** Uma posição livre vira canto quando cai nele: ajuda a decidir para que lado o painel abre. */
export function ladoDe(p: Posicao | null | undefined): { direita: boolean; baixo: boolean } {
  if (!p) return { direita: true, baixo: true };
  if ("canto" in p) return { direita: p.canto.endsWith("dir"), baixo: p.canto.startsWith("inf") };
  return { direita: p.x >= 0.5, baixo: p.y >= 0.5 };
}

/**
 * O estilo (position: fixed) de um botão de `tamanho` (CSS, ex.: "2.75rem") numa posição. As margens dos cantos de baixo
 * respeitam a barra de navegação do celular (--recuo-baixo) como o lugar de sempre; as de cima, o entalhe (safe area).
 */
export function estiloDaPosicao(p: Posicao, tamanho: string): Record<string, string> {
  const margem = "0.75rem";
  const baixo = `calc(${margem} + var(--recuo-baixo, 0px))`;
  const cima = `calc(${margem} + env(safe-area-inset-top, 0px))`;
  if ("canto" in p) {
    return {
      top: p.canto.startsWith("sup") ? cima : "auto",
      bottom: p.canto.startsWith("inf") ? baixo : "auto",
      left: p.canto.endsWith("esq") ? margem : "auto",
      right: p.canto.endsWith("dir") ? margem : "auto",
    };
  }
  // Ponto livre: preso pelos lados mais perto, para o que abre dali (o painel, o avatar do VLibras) crescer para dentro
  // da tela e não para fora.
  const { direita, baixo: emBaixo } = ladoDe(p);
  const horizontal = `(100vw - 2 * ${margem} - ${tamanho}) * ${(direita ? 1 - p.x : p.x).toFixed(4)}`;
  const vertical = `(100dvh - ${cima} - ${baixo} - ${tamanho}) * ${(emBaixo ? 1 - p.y : p.y).toFixed(4)}`;
  return {
    left: direita ? "auto" : `calc(${margem} + ${horizontal})`,
    right: direita ? `calc(${margem} + ${horizontal})` : "auto",
    top: emBaixo ? "auto" : `calc(${cima} + ${vertical})`,
    bottom: emBaixo ? `calc(${baixo} + ${vertical})` : "auto",
  };
}

/** A posição livre do centro de um botão de `largura` × `altura` px solto no ponto (cx, cy) da janela. */
export function posicaoDoPonto(cx: number, cy: number, largura: number, altura: number, janela = { w: window.innerWidth, h: window.innerHeight }): Posicao {
  const livreX = Math.max(1, janela.w - largura - 24);
  const livreY = Math.max(1, janela.h - altura - 24);
  return { x: limitar((cx - largura / 2 - 12) / livreX), y: limitar((cy - altura / 2 - 12) / livreY) };
}

/**
 * Arrastar um elemento com o ponteiro (mouse, dedo, caneta). Só vira arrasto depois de andar `folga` px: um toque curto
 * continua sendo clique. Durante o arrasto, `mover` recebe a posição do ponteiro; ao soltar, `soltar` recebe a última.
 * Devolve `arrastou()`, para o clique logo depois do arrasto ser ignorado.
 */
export function arrastavel(
  el: HTMLElement,
  {
    mover,
    soltar,
    folga = 6,
    podeComecar = () => true,
  }: { mover: (x: number, y: number) => void; soltar: (x: number, y: number) => void; folga?: number; podeComecar?: (alvo: EventTarget | null) => boolean },
) {
  let inicio: { x: number; y: number; id: number } | null = null;
  let arrastando = false;
  let acabouDeArrastar = false;
  const descer = (e: PointerEvent) => {
    if (e.button !== 0 || !podeComecar(e.target)) return;
    inicio = { x: e.clientX, y: e.clientY, id: e.pointerId };
    arrastando = false;
  };
  const andar = (e: PointerEvent) => {
    if (!inicio || e.pointerId !== inicio.id) return;
    if (!arrastando && Math.hypot(e.clientX - inicio.x, e.clientY - inicio.y) < folga) return;
    if (!arrastando) {
      arrastando = true;
      try {
        el.setPointerCapture(e.pointerId);
      } catch {
        // ponteiro já solto
      }
    }
    e.preventDefault();
    mover(e.clientX, e.clientY);
  };
  const subir = (e: PointerEvent) => {
    if (!inicio || e.pointerId !== inicio.id) return;
    if (arrastando) {
      soltar(e.clientX, e.clientY);
      acabouDeArrastar = true;
      window.setTimeout(() => (acabouDeArrastar = false), 0);
    }
    inicio = null;
    arrastando = false;
  };
  const cancelar = () => {
    inicio = null;
    arrastando = false;
  };
  // O clique que fecha um arrasto não abre nada (fase de captura: chega antes do clique do próprio botão).
  const clicar = (e: MouseEvent) => {
    if (!acabouDeArrastar) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    acabouDeArrastar = false;
  };
  el.addEventListener("pointerdown", descer);
  el.addEventListener("pointermove", andar);
  el.addEventListener("pointerup", subir);
  el.addEventListener("pointercancel", cancelar);
  el.addEventListener("click", clicar, true);
  return () => {
    el.removeEventListener("pointerdown", descer);
    el.removeEventListener("pointermove", andar);
    el.removeEventListener("pointerup", subir);
    el.removeEventListener("pointercancel", cancelar);
    el.removeEventListener("click", clicar, true);
  };
}
