// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useMemo } from "react";
import { getItem, KEYS, parse, setItem, useStored } from "./storage";
// O script inline das preferências (e o leitor de tinta eletrônica) mora em lib/prefs-script.ts, sem "use client": o servidor
// lê o texto exato para liberá-lo pelo hash na página do chat. No aplicativo do Instituto a Alumia some (<html data-sem-alumia>):
// decisão de 12/11/2026, lib/rede/app-do-instituto.ts.
import { prefsScript, readerDevice } from "./prefs-script";
export { prefsScript, readerDevice };

// Preferências de acessibilidade. Viram atributos em <html>, que o CSS (globals.css) lê.

export const TEXT_SCALES = [100, 115, 130, 150] as const;
/** Espaço entre linhas e entre letras: 0 normal, 1 maior, 2 bem maior. */
export const SPACING_LEVELS = [0, 1, 2] as const;
export const GUIDE_MODES = ["", "linha", "mascara"] as const;
export const COLOR_MODES = ["", "cinza", "pouca", "muita"] as const;
export type GuideMode = (typeof GUIDE_MODES)[number];
export type ColorMode = (typeof COLOR_MODES)[number];

export interface Prefs {
  scale: number;
  contrast: boolean;
  eink: boolean;
  /** Antigo "Texto espaçado" (um interruptor só). Quem tinha ligado passa a ter linhas 2 e letras 1 (comEconomia). */
  spacing: boolean;
  /** Espaço entre as linhas (0, 1 ou 2). */
  lines: number;
  /** Espaço entre as letras e as palavras (0, 1 ou 2). */
  letters: number;
  /** Letra mais legível (Atkinson Hyperlegible, OFL-1.1). */
  dyslexia: boolean;
  /** Links sublinhados e marcados. */
  links: boolean;
  /** Guia de leitura: uma linha ou uma máscara que acompanha o ponteiro e o foco. */
  guide: GuideMode;
  /** Pausar animações e transições. */
  motion: boolean;
  /** Cursor grande. */
  cursor: boolean;
  /** Cores da tela: cinza, menos cor ou mais cor. */
  color: ColorMode;
  focus: boolean;
  /** Fundo totalmente preto no tema escuro (telas AMOLED gastam menos bateria). */
  black: boolean;
  /** Sem imagens, sem animações e com as fontes do aparelho. */
  light: boolean;
  /** Modo pacote de dados (E4-17): liga também o modo leve e avisa antes de baixar algo grande. */
  pacote: boolean;
  /**
   * Contornos fortes (Prompt 5, E1): o design de sempre, de ponta a ponta, com o redesign ligado (recurso "design-novo").
   * Vira <html data-fortes>; os estilos do redesign (styles/design/) só valem sem ele. Sem o redesign, não muda nada.
   */
  fortes: boolean;
}

export const defaultPrefs: Prefs = {
  scale: 100,
  contrast: false,
  eink: false,
  spacing: false,
  lines: 0,
  letters: 0,
  dyslexia: false,
  links: false,
  guide: "",
  motion: false,
  cursor: false,
  color: "",
  focus: false,
  black: false,
  light: false,
  pacote: false,
  fortes: false,
};

/** Interruptores que viram data-<nome> em <html>, com o nome que o CSS usa. */
const flags = [
  ["contrast", "contrast"],
  ["eink", "eink"],
  ["focus", "focus"],
  ["black", "black"],
  ["light", "light"],
  ["pacote", "pacote"],
  ["dyslexia", "dislexia"],
  ["links", "links"],
  ["motion", "parado"],
  ["cursor", "cursor"],
  ["fortes", "fortes"],
] as const;

/** Escolhas com valor, que viram data-<nome>="valor" (sem valor, o atributo sai). */
const valores = [
  ["lines", "linhas"],
  ["letters", "letras"],
  ["guide", "guia"],
  ["color", "cor"],
] as const;

/** Aplica as preferências em <html>. A mesma lógica roda no script inline (prefsScript), antes da primeira pintura. */
export function applyPrefs(prefs: Prefs) {
  const root = document.documentElement;
  root.style.fontSize = prefs.scale === 100 ? "" : `${prefs.scale}%`;
  // Letra grande (130% e 150%): as casas que têm colunas fixas (a casca da Alumia) mudam de grade com este sinal.
  if (prefs.scale >= 130) root.setAttribute("data-escala", String(prefs.scale));
  else root.removeAttribute("data-escala");
  const reader = isReader();
  for (const [key, attr] of flags) {
    if (prefs[key] || (reader && key === "eink")) root.setAttribute(`data-${attr}`, "");
    else root.removeAttribute(`data-${attr}`);
  }
  for (const [key, attr] of valores) {
    const valor = prefs[key];
    if (valor) root.setAttribute(`data-${attr}`, String(valor));
    else root.removeAttribute(`data-${attr}`);
  }
  // data-spacing continua dizendo "a pessoa pediu mais espaço": outras regras do CSS respeitam a escolha por ele.
  if (prefs.lines || prefs.letters) root.setAttribute("data-spacing", "");
  else root.removeAttribute("data-spacing");
  if (reader) root.setAttribute("data-leitor", "");
  if (isApp() || celularNoNavegador()) root.setAttribute("data-app", "");
  // A área da página (E7): o CSS do aparelho fraco e do "menos movimento" do instituto não vale dentro da Alumia.
  if (naAlumia()) root.setAttribute("data-na-alumia", "");
  else root.removeAttribute("data-na-alumia");
}

export const isReader = () => typeof navigator !== "undefined" && readerDevice.test(navigator.userAgent);

/**
 * Aberto como aplicativo: instalado na tela inicial (PWA) ou dentro do aplicativo Android, cujo WebView se anuncia
 * com "; wv)". Só nesse caso o site veste o visual de aplicativo (<html data-app>); no navegador nada muda.
 */
export const isApp = () =>
  typeof window !== "undefined" &&
  (window.matchMedia("(display-mode: standalone), (display-mode: minimal-ui)").matches ||
    navigator.userAgent.indexOf("; wv)") > -1 ||
    (navigator as { standalone?: boolean }).standalone === true);



/**
 * O aparelho pede economia de dados: o modo "Economizar dados" do Android e do Chrome (navigator.connection.saveData,
 * o mesmo do cabeçalho Save-Data) ou a preferência prefers-reduced-data. Vale enquanto a pessoa não escolher.
 */
export function pedeEconomia(): boolean {
  if (typeof window === "undefined") return false;
  const conexao = (navigator as { connection?: { saveData?: boolean } }).connection;
  return conexao?.saveData === true || window.matchMedia("(prefers-reduced-data: reduce)").matches || aparelhoFraco();
}

/**
 * Aparelho fraco (Prompt 5, E7): pouca memória, navigator.deviceMemory ≤ 2 (o Chrome e parentes arredondam para 0,25, 0,5, 1, 2,
 * 4 ou 8; os outros navegadores não dizem, e aí não conta).
 */
export function aparelhoFraco(): boolean {
  if (typeof navigator === "undefined") return false;
  const memoria = (navigator as { deviceMemory?: number }).deviceMemory;
  return typeof memoria === "number" && memoria > 0 && memoria <= 2;
}

/**
 * Celular no navegador comum (toque e aparelho de tela pequena em qualquer orientação: o lado menor da tela até 768 px, fora da Alumia e sem leitor de tinta): veste o MESMO visual do aplicativo
 * (<html data-app>), mas continua sendo o navegador: a Alumia segue acessível (sem data-sem-alumia). Mesma conta do script
 * inline (lib/prefs-script.ts).
 */
export function celularNoNavegador(): boolean {
  if (typeof window === "undefined") return false;
  return !naAlumia() && window.matchMedia("(pointer: coarse)").matches && Math.min(window.screen.width, window.screen.height) <= 768 && !readerDevice.test(navigator.userAgent);
}

/** A página é da Alumia (endereço próprio ou /<idioma>/alumia)? A mesma conta do script inline (lib/prefs-script.ts). */
export function naAlumia(): boolean {
  if (typeof window === "undefined") return false;
  return window.location.hostname.indexOf("alumia.") === 0 || window.location.pathname.split("/")[2] === "alumia";
}

/**
 * O modo leve ligou sozinho? (o aparelho pede economia ou é fraco, a pessoa nunca escolheu, e a página é do instituto). Na Alumia
 * ele nunca liga sozinho (E7: lá o foco é a experiência; o leve continua como escolha).
 */
export function leveSozinho(guardado: Partial<Prefs> = parse<Partial<Prefs>>(getItem(KEYS.a11y), {})): boolean {
  return guardado.light === undefined && !naAlumia() && pedeEconomia();
}

function comEconomia(guardado: Partial<Prefs>): Prefs {
  const prefs: Prefs = { ...defaultPrefs, light: guardado.light ?? leveSozinho(guardado), ...guardado };
  // O antigo "Texto espaçado" vira as duas escolhas novas, com valores parecidos com os de antes.
  if (guardado.spacing && guardado.lines === undefined && guardado.letters === undefined) {
    prefs.lines = 2;
    prefs.letters = 1;
  }
  return prefs;
}

export function readPrefs(): Prefs {
  return comEconomia(parse<Partial<Prefs>>(getItem(KEYS.a11y), {}));
}

export function usePrefs(): Prefs {
  const raw = useStored(KEYS.a11y);
  return useMemo(() => comEconomia(parse<Partial<Prefs>>(raw, {})), [raw]);
}

export function setPrefs(patch: Partial<Prefs>) {
  const next = { ...readPrefs(), ...patch };
  // Alto contraste e e-ink são paletas diferentes: ligar um desliga o outro.
  if (patch.contrast) next.eink = false;
  if (patch.eink) next.contrast = false;
  // Modo pacote de dados (E4-17) implica o modo leve; desligar o pacote não desliga o leve (a tela oferece).
  if (patch.pacote) next.light = true;
  // Mexeu no espaço das linhas ou das letras: o interruptor antigo deixa de valer.
  if (patch.lines !== undefined || patch.letters !== undefined) next.spacing = false;
  setItem(KEYS.a11y, JSON.stringify(next));
  applyPrefs(next);
}

export function resetPrefs() {
  setItem(KEYS.a11y, null);
  applyPrefs(comEconomia({}));
}
