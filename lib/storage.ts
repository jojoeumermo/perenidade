// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useSyncExternalStore } from "react";

// As chaves moram em lib/chaves.ts (sem "use client"), para o servidor também poder lê-las (o hash dos scripts da página do chat).
import { KEYS } from "./chaves";
export { KEYS };

const listeners = new Set<() => void>();

function subscribe(callback: () => void) {
  listeners.add(callback);
  window.addEventListener("storage", callback);
  return () => {
    listeners.delete(callback);
    window.removeEventListener("storage", callback);
  };
}

export function getItem(key: string): string {
  try {
    return localStorage.getItem(key) ?? "";
  } catch {
    return "";
  }
}

export function setItem(key: string, value: string | null) {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    // Armazenamento indisponível (modo privado, cota): o site segue funcionando sem guardar nada.
  }
  listeners.forEach((listener) => listener());
}

/** Avisa os componentes de que algo mudou por fora de setItem (a sessão, gravada pelo cliente de contas). */
export function notifyStored() {
  listeners.forEach((listener) => listener());
}

export function parse<T>(raw: string, fallback: T): T {
  try {
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

export function useStored(key: string): string {
  return useSyncExternalStore(
    subscribe,
    () => getItem(key),
    () => "",
  );
}

const noop = () => () => {};

/** false no servidor e na hidratação, true depois: para UI que depende do navegador. */
export function useHydrated(): boolean {
  return useSyncExternalStore(
    noop,
    () => true,
    () => false,
  );
}
