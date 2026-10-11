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
  for (const key of flags) {
    if (prefs[key]) root.setAttribute(`data-${key}`, "");
    else root.removeAttribute(`data-${key}`);
  }
}

export const prefsScript = `(function(){try{var d=document.documentElement,t=localStorage.getItem("${KEYS.theme}");if(t==="light"||t==="dark")d.setAttribute("data-theme",t);var p=JSON.parse(localStorage.getItem("${KEYS.a11y}")||"{}");if(p.scale>100)d.style.fontSize=p.scale+"%";["contrast","eink","spacing","focus","black","light"].forEach(function(k){if(p[k])d.setAttribute("data-"+k,"")})}catch(e){}})()`;

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
