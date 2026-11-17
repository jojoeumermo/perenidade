// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useEffect, useState } from "react";
import { redeCompositor, type EscolhasDoPost } from "@/lib/rede/publicar/cliente-compositor";
import { EXEMPLOS_DO_COMPOSITOR } from "@/lib/rede/publicar/exemplos-compositor";

// As escolhas do compositor (arranjo, legendas, figurinha) chegam em LOTE, como a vida do post (../vida/carregar.ts): os cartões que
// aparecem juntos pedem no mesmo instante e uma chamada só responde. Banco sem a migração da onda 12: a chamada falha, cada cartão
// recebe nulo e as imagens aparecem na grade de sempre (a tela não inventa).
type Pendente = (v: EscolhasDoPost | null) => void;

const guardados = new Map<string, Promise<EscolhasDoPost | null>>();
const pendentes = new Map<string, Pendente[]>();
let marcado = false;
let semBanco = false;

async function enviar() {
  marcado = false;
  const ids = [...pendentes.keys()].slice(0, 50);
  const grupos = ids.map((id) => [id, pendentes.get(id) ?? []] as const);
  ids.forEach((id) => pendentes.delete(id));
  try {
    const r = semBanco ? {} : await redeCompositor.extras(ids);
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

export function escolhasDe(id: string): Promise<EscolhasDoPost | null> {
  const feito = guardados.get(id);
  if (feito) return feito;
  const p = new Promise<EscolhasDoPost | null>((resolver) => {
    pendentes.set(id, [...(pendentes.get(id) ?? []), resolver]);
    if (!marcado) {
      marcado = true;
      setTimeout(() => void enviar(), 30);
    }
  });
  guardados.set(id, p);
  return p;
}

/** As escolhas de um post: na prévia, as de exemplo; post de exemplo fora da prévia, nada; o resto, do banco (em lote). */
export function useEscolhasDoPost(id: string, previa: boolean): EscolhasDoPost | null {
  const exemplo = id.startsWith("exemplo-");
  const [e, setE] = useState<EscolhasDoPost | null>(() => (previa && exemplo ? (EXEMPLOS_DO_COMPOSITOR[id]?.escolhas ?? null) : null));
  useEffect(() => {
    if (exemplo || previa) return;
    let vivo = true;
    escolhasDe(id).then((x) => vivo && setE(x));
    return () => {
      vivo = false;
    };
  }, [id, exemplo, previa]);
  return e;
}
