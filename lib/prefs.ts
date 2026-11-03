// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useMemo } from "react";
import { getItem, KEYS, parse, setItem, useStored } from "./storage";

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
  if (isApp()) root.setAttribute("data-app", "");
}

/** Leitores de tinta eletrônica (Kindle, Kobo e parentes): o site entra sozinho no visual próprio para eles. */
export const readerDevice = /Kindle|Silk|EBRD|E-?Reader|Kobo|PocketBook|Tolino|Onyx|BOOX|E Ink/i;
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

export const prefsScript = `(function(){try{var d=document.documentElement;if(matchMedia("(display-mode: standalone), (display-mode: minimal-ui)").matches||navigator.userAgent.indexOf("; wv)")>-1||navigator.standalone===true){d.setAttribute("data-app","");var c=function(){var m=document.querySelector('meta[name="viewport"]');if(m&&m.content.indexOf("viewport-fit")<0)m.content+=", viewport-fit=cover, interactive-widget=resizes-content";return m};if(!c())document.addEventListener("DOMContentLoaded",c)}}catch(e){}try{var d=document.documentElement;if(${readerDevice}.test(navigator.userAgent)){d.setAttribute("data-leitor","");d.setAttribute("data-eink","")}}catch(e){}try{var d=document.documentElement,t=localStorage.getItem("${KEYS.theme}");if(t==="light"||t==="dark")d.setAttribute("data-theme",t);var p=JSON.parse(localStorage.getItem("${KEYS.a11y}")||"{}");if(p.scale>100)d.style.fontSize=p.scale+"%";if(p.spacing&&p.lines===undefined&&p.letters===undefined){p.lines=2;p.letters=1}[["contrast","contrast"],["eink","eink"],["focus","focus"],["black","black"],["light","light"],["pacote","pacote"],["dyslexia","dislexia"],["links","links"],["motion","parado"],["cursor","cursor"]].forEach(function(k){if(p[k[0]])d.setAttribute("data-"+k[1],"")});[["lines","linhas"],["letters","letras"],["guide","guia"],["color","cor"]].forEach(function(k){if(p[k[0]])d.setAttribute("data-"+k[1],String(p[k[0]]))});if(p.lines||p.letters)d.setAttribute("data-spacing","");if(p.light===undefined&&((navigator.connection&&navigator.connection.saveData)||matchMedia("(prefers-reduced-data: reduce)").matches))d.setAttribute("data-light","")}catch(e){}})()`;

/**
 * O aparelho pede economia de dados: o modo "Economizar dados" do Android e do Chrome (navigator.connection.saveData,
 * o mesmo do cabeçalho Save-Data) ou a preferência prefers-reduced-data. Vale enquanto a pessoa não escolher.
 */
export function pedeEconomia(): boolean {
  if (typeof window === "undefined") return false;
  const conexao = (navigator as { connection?: { saveData?: boolean } }).connection;
  return conexao?.saveData === true || window.matchMedia("(prefers-reduced-data: reduce)").matches;
}

function comEconomia(guardado: Partial<Prefs>): Prefs {
  const prefs: Prefs = { ...defaultPrefs, light: guardado.light ?? pedeEconomia(), ...guardado };
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
