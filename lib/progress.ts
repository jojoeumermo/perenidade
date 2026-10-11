// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useMemo } from "react";
import { getItem, KEYS, parse, setItem, useStored } from "./storage";

// Progresso guardado só no navegador (sem conta, sem servidor).

export interface LastLesson {
  /** Caminho sem o prefixo de idioma, para funcionar em qualquer língua. */
  path: string;
  title: string;
  track: string;
}

export function useCompleted(): Set<string> {
  const raw = useStored(KEYS.done);
  return useMemo(() => new Set(parse<string[]>(raw, [])), [raw]);
}

export function setCompleted(id: string, done: boolean) {
  const current = new Set(parse<string[]>(getItem(KEYS.done), []));
  if (done) current.add(id);
  else current.delete(id);
  setItem(KEYS.done, JSON.stringify([...current]));
}

export function useLastLesson(): LastLesson | null {
  const raw = useStored(KEYS.last);
  return useMemo(() => parse<LastLesson | null>(raw, null), [raw]);
}

export function rememberLesson(lesson: LastLesson) {
  setItem(KEYS.last, JSON.stringify(lesson));
}
