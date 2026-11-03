// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useEffect, useState } from "react";
import { useGuardado } from "@/components/estudo/guardado";
import { lerProjetos, type Projetos } from "@/lib/escola/formatura";

const SEM_PROJETOS: Projetos = { versao: 1, cursos: {} };

/** O projeto final de cada curso (lucia:escola:projeto), lido de novo a cada mudança de estudo. */
export function useProjetos(): Projetos {
  return useGuardado<Projetos>(lerProjetos, SEM_PROJETOS)[0];
}

/** Só vira true no navegador, depois da hidratação (para o portal da folha impressa). */
export function useNoNavegador(): boolean {
  const [pronto, setPronto] = useState(false);
  useEffect(() => {
    const id = window.setTimeout(() => setPronto(true), 0);
    return () => window.clearTimeout(id);
  }, []);
  return pronto;
}

/** Copia um texto para a área de transferência. Devolve false se o navegador não deixar. */
export async function copiarTexto(texto: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(texto);
    return true;
  } catch {
    return false;
  }
}
