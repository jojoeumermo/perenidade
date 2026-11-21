// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

// Os ganchos das chamadas (Prompt 4, itens 139 e 140): os textos, o que está tocando e o andamento da chamada desta aba.
import { useEffect, useState, useSyncExternalStore } from "react";
import { guardaDosToques, type ToqueRecebido } from "@/lib/rede/chamada/guarda";
import { painelDaChamada } from "@/lib/rede/chamada/cliente";
import type { EstadoDaChamada } from "@/lib/rede/chamada/painel";
import { carregarTextosDasChamadas, type TextosDasChamadas } from "@/lib/rede/textos-p4-chamadas";

/** Os textos no idioma da página; `null` enquanto chegam. */
export function useTextosDasChamadas(lang: string): TextosDasChamadas | null {
  const [pronto, setPronto] = useState<{ lang: string; t: TextosDasChamadas } | null>(null);
  useEffect(() => {
    let vivo = true;
    carregarTextosDasChamadas(lang).then((t) => vivo && setPronto({ lang, t }), () => undefined);
    return () => {
      vivo = false;
    };
  }, [lang]);
  return pronto?.lang === lang ? pronto.t : null;
}

const NADA: ToqueRecebido[] = [];
let ultimo: ToqueRecebido[] = NADA;
const tocandoAgora = () => {
  const agora = guardaDosToques.tocando();
  // A mesma lista (mesmo conteúdo) devolve a mesma referência: o React não redesenha à toa.
  if (agora.length === ultimo.length && agora.every((t, i) => t === ultimo[i])) return ultimo;
  ultimo = agora.length ? agora : NADA;
  return ultimo;
};

/** O que está tocando agora nesta aba (a guarda da memória). */
export function useTocando(): ToqueRecebido[] {
  return useSyncExternalStore((f) => guardaDosToques.ouvir(f), tocandoAgora, () => NADA);
}

/** O andamento da chamada desta aba. */
export function useChamada(): EstadoDaChamada {
  const p = painelDaChamada();
  return useSyncExternalStore((f) => p.ouvir(f), p.estado, p.estado);
}

/** "mm:ss" (ou "h:mm:ss") desde `desde`, a cada segundo. */
export function useDuracao(desde: number | null): string {
  const [agora, setAgora] = useState(() => Date.now());
  useEffect(() => {
    if (!desde) return;
    const t = setInterval(() => setAgora(Date.now()), 1000);
    return () => clearInterval(t);
  }, [desde]);
  if (!desde) return "";
  const s = Math.max(0, Math.floor((agora - desde) / 1000));
  const h = Math.floor(s / 3600);
  const mm = String(Math.floor((s % 3600) / 60)).padStart(h ? 2 : 1, "0");
  const ss = String(s % 60).padStart(2, "0");
  return h ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}
