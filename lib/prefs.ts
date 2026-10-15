// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useMemo } from "react";
import { getItem, KEYS, parse, setItem, useStored } from "./storage";

// Preferências de acessibilidade. Viram atributos em <html>, que o CSS (globals.css) lê.

export const TEXT_SCALES = [100, 115, 130] as const;

export interface Prefs {
  scale: number;
  contrast: boolean;
  eink: boolean;
  spacing: boolean;
  focus: boolean;
  /** Fundo totalmente preto no tema escuro (telas AMOLED gastam menos bateria). */
  black: boolean;
  /** Sem imagens, sem animações e com as fontes do aparelho. */
  light: boolean;
}

export const defaultPrefs: Prefs = { scale: 100, contrast: false, eink: false, spacing: false, focus: false, black: false, light: false };

const flags = ["contrast", "eink", "spacing", "focus", "black", "light"] as const;

/** Aplica as preferências em <html>. A mesma lógica roda no script inline, antes da primeira pintura. */
export function applyPrefs(prefs: Prefs) {
  const root = document.documentElement;
  root.style.fontSize = prefs.scale === 100 ? "" : `${prefs.scale}%`;
  const reader = isReader();
  for (const key of flags) {
    if (prefs[key] || (reader && key === "eink")) root.setAttribute(`data-${key}`, "");
    else root.removeAttribute(`data-${key}`);
  }
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

export const prefsScript = `(function(){try{var d=document.documentElement;if(matchMedia("(display-mode: standalone), (display-mode: minimal-ui)").matches||navigator.userAgent.indexOf("; wv)")>-1||navigator.standalone===true){d.setAttribute("data-app","");var c=function(){var m=document.querySelector('meta[name="viewport"]');if(m&&m.content.indexOf("viewport-fit")<0)m.content+=", viewport-fit=cover, interactive-widget=resizes-content";return m};if(!c())document.addEventListener("DOMContentLoaded",c)}}catch(e){}try{var d=document.documentElement;if(${readerDevice}.test(navigator.userAgent)){d.setAttribute("data-leitor","");d.setAttribute("data-eink","")}}catch(e){}try{var d=document.documentElement,t=localStorage.getItem("${KEYS.theme}");if(t==="light"||t==="dark")d.setAttribute("data-theme",t);var p=JSON.parse(localStorage.getItem("${KEYS.a11y}")||"{}");if(p.scale>100)d.style.fontSize=p.scale+"%";["contrast","eink","spacing","focus","black","light"].forEach(function(k){if(p[k])d.setAttribute("data-"+k,"")})}catch(e){}})()`;

export function readPrefs(): Prefs {
  return { ...defaultPrefs, ...parse<Partial<Prefs>>(getItem(KEYS.a11y), {}) };
}

export function usePrefs(): Prefs {
  const raw = useStored(KEYS.a11y);
  return useMemo(() => ({ ...defaultPrefs, ...parse<Partial<Prefs>>(raw, {}) }), [raw]);
}

export function setPrefs(patch: Partial<Prefs>) {
  const next = { ...readPrefs(), ...patch };
  // Alto contraste e e-ink são paletas diferentes: ligar um desliga o outro.
  if (patch.contrast) next.eink = false;
  if (patch.eink) next.contrast = false;
  setItem(KEYS.a11y, JSON.stringify(next));
  applyPrefs(next);
}

export function resetPrefs() {
  setItem(KEYS.a11y, null);
  applyPrefs(defaultPrefs);
}
