// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useGuardado } from "@/components/estudo/guardado";
import { lerMissoes, lerTarefas, lerVozesLocais, type Marca, type VozLocal } from "@/lib/escola/vida";

// O que a vida real guarda no aparelho, lido de novo a cada mudança de estudo (evento "lucia:estudo" nesta aba,
// "storage" nas outras). Como em components/escola/guardado-escola.ts: no servidor e na hidratação começa vazio, para o
// HTML ser igual dos dois lados; o valor real chega logo depois, no primeiro efeito.

const SEM_MARCAS: Record<string, Marca> = {};
const SEM_VOZES: VozLocal[] = [];

export function useTarefas(): Record<string, Marca> {
  return useGuardado<Record<string, Marca>>(lerTarefas, SEM_MARCAS)[0];
}

export function useMissoes(): Record<string, Marca> {
  return useGuardado<Record<string, Marca>>(lerMissoes, SEM_MARCAS)[0];
}

export function useVozesLocais(): VozLocal[] {
  return useGuardado<VozLocal[]>(lerVozesLocais, SEM_VOZES)[0];
}
