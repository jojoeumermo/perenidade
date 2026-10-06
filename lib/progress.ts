"use client";

import { useMemo, useSyncExternalStore } from "react";

// Progresso guardado só no navegador (sem conta, sem servidor).
// Quando o login existir, estas mesmas chaves podem ser sincronizadas com o Supabase.

const DONE_KEY = "perenidade:concluidas";
const LAST_KEY = "perenidade:ultima-aula";

export interface LastLesson {
  href: string;
  title: string;
  track: string;
}

const listeners = new Set<() => void>();

function subscribe(callback: () => void) {
  listeners.add(callback);
  window.addEventListener("storage", callback);
  return () => {
    listeners.delete(callback);
    window.removeEventListener("storage", callback);
  };
}

function get(key: string): string {
  try {
    return localStorage.getItem(key) ?? "";
  } catch {
    return "";
  }
}

function set(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Armazenamento indisponível (modo privado, cota): o site segue funcionando sem progresso.
  }
  listeners.forEach((listener) => listener());
}

function parse<T>(raw: string, fallback: T): T {
  try {
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function useStored(key: string): string {
  return useSyncExternalStore(
    subscribe,
    () => get(key),
    () => "",
  );
}

export function useCompleted(): Set<string> {
  const raw = useStored(DONE_KEY);
  return useMemo(() => new Set(parse<string[]>(raw, [])), [raw]);
}

export function setCompleted(id: string, done: boolean) {
  const current = new Set(parse<string[]>(get(DONE_KEY), []));
  if (done) current.add(id);
  else current.delete(id);
  set(DONE_KEY, JSON.stringify([...current]));
}

export function useLastLesson(): LastLesson | null {
  const raw = useStored(LAST_KEY);
  return useMemo(() => parse<LastLesson | null>(raw, null), [raw]);
}

export function rememberLesson(lesson: LastLesson) {
  set(LAST_KEY, JSON.stringify(lesson));
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
