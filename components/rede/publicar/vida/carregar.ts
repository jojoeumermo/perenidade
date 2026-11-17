// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { redePub } from "@/lib/rede/cliente-publicar";
import type { VidaDoPost } from "@/lib/rede/tipos-publicar";

// A vida dos posts (quando some; para a autora, arquivado, não listado, roda) chega em LOTE, como os detalhes
// (components/rede/publicar/detalhes.ts): os cartões que aparecem juntos pedem no mesmo instante e uma chamada só responde.
// Banco sem a migração da onda 9: a chamada falha, cada cartão recebe nulo e nada aparece (a tela não inventa).
type Pendente = (v: VidaDoPost | null) => void;

const guardados = new Map<string, Promise<VidaDoPost | null>>();
const pendentes = new Map<string, Pendente[]>();
let marcado = false;
let semBanco = false;

async function enviar() {
  marcado = false;
  const ids = [...pendentes.keys()].slice(0, 50);
  const grupos = ids.map((id) => [id, pendentes.get(id) ?? []] as const);
  ids.forEach((id) => pendentes.delete(id));
  try {
    const r = semBanco ? {} : await redePub.vida(ids);
    for (const [id, quem] of grupos) quem.forEach((f) => f(r[id] ?? null));
  } catch {
    semBanco = true;
    for (const [, quem] of grupos) quem.forEach((f) => f(null));
  }
  if (pendentes.size) {
    marcado = true;
    setTimeout(() => void enviar(), 20);
  }
}

export function vidaDe(id: string): Promise<VidaDoPost | null> {
  const feito = guardados.get(id);
  if (feito) return feito;
  const p = new Promise<VidaDoPost | null>((resolver) => {
    pendentes.set(id, [...(pendentes.get(id) ?? []), resolver]);
    if (!marcado) {
      marcado = true;
      setTimeout(() => void enviar(), 30);
    }
  });
  guardados.set(id, p);
  return p;
}

/** Esquece o que se sabia do post (depois de arquivar ou desarquivar). */
export const esquecerVida = (id: string) => void guardados.delete(id);
