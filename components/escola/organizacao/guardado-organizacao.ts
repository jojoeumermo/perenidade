// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useGuardado } from "@/components/estudo/guardado";
import { type ProtocoloGuardado, type Roda, lerProtocolosGuardados, lerRodasGuardadas, votosDoSemestre } from "@/lib/escola/organizacao";
import { type RespostaPublicaDaOuvidoria, ouvidoriaPublicas } from "@/lib/escola/banco";

// O que a organização estudantil guarda no aparelho, lido de novo a cada mudança de estudo ("lucia:estudo" nesta aba,
// "storage" nas outras). No servidor e na hidratação começa vazio, para o HTML ser igual dos dois lados.

const SEM_LISTA: never[] = [];

export function useVotos(semestre: string): string[] {
  return useGuardado<string[]>(() => votosDoSemestre(semestre), SEM_LISTA)[0];
}

export function useProtocolos(): ProtocoloGuardado[] {
  return useGuardado<ProtocoloGuardado[]>(() => lerProtocolosGuardados(), SEM_LISTA)[0];
}

export function useRodas(): Roda[] {
  return useGuardado<Roda[]>(() => lerRodasGuardadas(), SEM_LISTA)[0];
}

let publicas: Promise<RespostaPublicaDaOuvidoria[]> | null = null;

/** As respostas públicas, um pedido por visita (memória do módulo). Sem serviço ou com falha, lista vazia. */
export function respostasPublicas(): Promise<RespostaPublicaDaOuvidoria[]> {
  publicas ??= ouvidoriaPublicas().catch(() => []);
  return publicas;
}

/** Esquece a memória das respostas (depois de mandar uma mensagem, a próxima visita pede de novo). */
export function esquecerRespostasPublicas() {
  publicas = null;
}
