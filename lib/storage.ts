// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useSyncExternalStore } from "react";

// Tudo o que o site guarda fica no navegador da pessoa, sob estas chaves. Não há servidor.
export const KEYS = {
  /** Menu do painel só com ícones (computador). */
  painelCompacto: "lucia:painel-compacto",
  /** Modo foco do painel: só as seções essenciais no menu. */
  painelFoco: "lucia:painel-foco",
  done: "lucia:concluidas",
  last: "lucia:ultima-aula",
  draft: "lucia:rascunho",
  theme: "lucia:tema",
  a11y: "lucia:acessibilidade",
  session: "lucia:sessao",
  // Primeiro nome da conta, para o cabeçalho dizer "Olá" sem esperar o serviço; sai junto com a sessão.
  name: "lucia:nome",
  notes: "lucia:fichamento",
  radio: "lucia:radio",
  device: "lucia:aparelho",
  notice: "lucia:aviso",
  light: "lucia:leve",
  filter: "lucia:filtro",
  purge: "lucia:purga",
  seen: "lucia:visto",
  site: "lucia:site",
  passkey: "lucia:digital",
  // O rascunho da folha de redação e a última ferramenta aberta em cada disciplina (caixa de ferramentas das aulas).
  essay: "lucia:redacao",
  tools: "lucia:ferramentas",
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
