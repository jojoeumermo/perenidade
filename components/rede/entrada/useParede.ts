// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

// A parede que gira (P5, A1; a parte pura está em lib/rede/entrada/rotacao.ts). A cada ~10 segundos, todos os painéis trocam de
// figura: as silhuetas de sempre e as pessoas do Memorial com foto de licença livre (pedidas só na primeira troca). A próxima leva
// de imagens já chega carregada antes de aparecer. Parada para quem pediu menos movimento, no modo parado e no e-ink do site
// (podeMexer), com economia de dados ligada e enquanto a aba não está visível.
import { useEffect, useRef, useState } from "react";
import type { FiguraDaEntrada } from "@/lib/rede/entrada/figuras";
import { figuraValida, INTERVALO_DA_PAREDE_MS, juntarFiguras, levaDaParede } from "@/lib/rede/entrada/rotacao";
import { podeMexer } from "@/lib/rede/atos/movimento";

function economiaDeDados(): boolean {
  const c = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
  return Boolean(c?.saveData);
}

/** Carrega as imagens antes de mostrar (a troca não pisca). Erro numa imagem não segura a troca. */
async function precarregar(figuras: FiguraDaEntrada[]): Promise<void> {
  await Promise.all(
    figuras.map(async (f) => {
      const img = new Image();
      img.src = `/${f.src}`;
      try {
        await img.decode();
      } catch {
        // a imagem que falhou aparece como o fundo do painel
      }
    }),
  );
}

/** As figuras que a parede mostra agora (sempre a mesma quantidade de painéis). */
export function useParede(figuras: FiguraDaEntrada[]): FiguraDaEntrada[] {
  const [estado, setEstado] = useState<{ conjunto: FiguraDaEntrada[]; leva: number }>({ conjunto: figuras, leva: 0 });
  const ocupada = useRef(false);

  useEffect(() => {
    if (!podeMexer() || economiaDeDados()) return;
    let vivo = true;
    let conjunto = figuras;
    let pediu = false;
    let leva = 0;
    const trocar = async () => {
      if (ocupada.current || document.visibilityState !== "visible" || !podeMexer()) return;
      ocupada.current = true;
      try {
        if (!pediu) {
          pediu = true;
          const r = await fetch("/api/alumia/parede", { cache: "force-cache" }).then((x) => (x.ok ? x.json() : null)).catch(() => null);
          const novas = Array.isArray(r?.figuras) ? (r.figuras as unknown[]).filter(figuraValida) : [];
          conjunto = juntarFiguras(figuras, novas);
        }
        const proxima = levaDaParede(conjunto, leva + 1, figuras.length);
        await precarregar(proxima);
        if (!vivo) return;
        leva += 1;
        setEstado({ conjunto, leva });
      } finally {
        ocupada.current = false;
      }
    };
    const relogio = window.setInterval(() => void trocar(), INTERVALO_DA_PAREDE_MS);
    return () => {
      vivo = false;
      window.clearInterval(relogio);
    };
  }, [figuras]);

  return estado.leva === 0 ? figuras : levaDaParede(estado.conjunto, estado.leva, figuras.length);
}
