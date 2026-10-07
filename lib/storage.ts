"use client";

import { useSyncExternalStore } from "react";

// Tudo o que o site guarda fica no navegador da pessoa, sob estas chaves. Não há servidor.
export const KEYS = {
  done: "lucia:concluidas",
  last: "lucia:ultima-aula",
  draft: "lucia:rascunho",
  theme: "lucia:tema",
  a11y: "lucia:acessibilidade",
} as const;

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
