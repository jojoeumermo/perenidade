// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useEffect, useState } from "react";
import { redeP4 } from "@/lib/rede/publicar/cliente-p4";
import { previaLigada } from "@/lib/rede/publicar/alumia2";
import type { ExtrasDoP4 } from "@/lib/rede/publicar/p4-compositor";

// A prévia (dados de exemplo, nada vai a banco nenhum): dois convites (um com 4 pessoas, outro abaixo de 3, sem número) e uma fonte.
const DO_DUBLE: Record<string, ExtrasDoP4> = {
  "exemplo-ocupacao": { convite: true, total: 4 },
  "exemplo-cohab": { convite: true },
  "exemplo-mandata": { fonte: { link: "https://example.org/camara-votacao-tarifa" } },
};

// O que o compositor do prompt 4 guardou em cada post (versão curta, capa, capítulos, convite e total, fonte), pedido em LOTE: os
// cartões que aparecem juntos viram uma chamada só a rede_pub_p4_extras (até 50 ids). Post sem nada não vem; erro, nada.

let pedidos = new Map<string, ((e: ExtrasDoP4 | null) => void)[]>();
let agendado = false;
const guardados = new Map<string, ExtrasDoP4 | null>();

async function rodarLote() {
  agendado = false;
  const lote = pedidos;
  pedidos = new Map();
  const ids = [...lote.keys()];
  for (let i = 0; i < ids.length; i += 50) {
    const parte = ids.slice(i, i + 50);
    let r: Record<string, ExtrasDoP4> = {};
    try {
      r = (await redeP4.extras(parte)) ?? {};
    } catch {
      r = {};
    }
    for (const id of parte) {
      const e = r[id] ?? null;
      guardados.set(id, e);
      for (const f of lote.get(id) ?? []) f(e);
    }
  }
}

/** O que o post guardou (nulo: nada, ou ainda não chegou). Só ids do banco; na prévia, o dublê. */
export function extrasDoPost(id: string): Promise<ExtrasDoP4 | null> {
  if (previaLigada()) return Promise.resolve(DO_DUBLE[id] ?? null);
  if (!/^[0-9a-f-]{36}$/i.test(id)) return Promise.resolve(null);
  if (guardados.has(id)) return Promise.resolve(guardados.get(id) ?? null);
  return new Promise((resolver) => {
    pedidos.set(id, [...(pedidos.get(id) ?? []), resolver]);
    if (!agendado) {
      agendado = true;
      setTimeout(() => void rodarLote(), 30);
    }
  });
}

/** O gancho do cartão: nulo enquanto carrega ou quando o post não guardou nada. */
export function useExtrasDoPost(id: string, ligado: boolean): ExtrasDoP4 | null {
  const [e, setE] = useState<{ id: string; extras: ExtrasDoP4 | null } | null>(null);
  useEffect(() => {
    if (!ligado) return;
    let vivo = true;
    void extrasDoPost(id).then((x) => vivo && setE({ id, extras: x }));
    return () => {
      vivo = false;
    };
  }, [id, ligado]);
  return e?.id === id ? e.extras : null;
}
