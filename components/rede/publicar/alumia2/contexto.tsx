// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { createContext, useContext } from "react";
import type { CorDaComunidadeNum } from "@/lib/rede/publicar/alumia2";
import type { TextosAlumia2 } from "./textos";

/** O que as peças da cara nova dividem: os textos, se é prévia (dados de exemplo) e o nome/cor das comunidades conhecidas. */
export interface ContextoAlumia2 {
  t: TextosAlumia2;
  previa: boolean;
  comunidades: Record<string, { nome: string; cor?: CorDaComunidadeNum }>;
}

const Contexto = createContext<ContextoAlumia2 | null>(null);

export const ProvedorAlumia2 = Contexto.Provider;

/** Os textos e o estado da cara nova; fora da casca nova (nunca deveria acontecer) devolve nulo e a peça não aparece. */
export function useAlumia2(): ContextoAlumia2 | null {
  return useContext(Contexto);
}
