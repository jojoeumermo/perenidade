// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useGuardado } from "@/components/estudo/guardado";
import { type Inscricao, lerCaderneta, lerInscricoes, lerMatricula, type Matricula, type RegistroDaCaderneta } from "@/lib/escola/estudante";

// O que a Escola guarda no aparelho, lido de novo a cada mudança de estudo (evento "lucia:estudo" nesta aba, "storage"
// nas outras). No servidor e na hidratação começa vazio, para o HTML ser igual dos dois lados; o valor real chega logo
// depois, no primeiro efeito.

const SEM_LISTA: never[] = [];

export function useMatricula(): Matricula | null {
  return useGuardado<Matricula | null>(lerMatricula, null)[0];
}

export function useInscricoes(): Inscricao[] {
  return useGuardado<Inscricao[]>(lerInscricoes, SEM_LISTA)[0];
}

export function useCaderneta(): RegistroDaCaderneta[] {
  return useGuardado<RegistroDaCaderneta[]>(lerCaderneta, SEM_LISTA)[0];
}
