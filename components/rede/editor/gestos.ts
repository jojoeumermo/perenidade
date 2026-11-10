// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useEffect, useRef, type RefObject } from "react";
import { transformacaoEmCss, transformacaoValida, type Transformacao } from "@/lib/rede/stories/midia";

/** Quanto falta para o "ímã": perto do centro e do giro reto, a mídia gruda (como as guias do Instagram). */
const IMA_POS = 0.025;
const IMA_GIRO = (4 * Math.PI) / 180;

function ima(t: Transformacao): Transformacao & { guiaX: boolean; guiaY: boolean; reto: boolean } {
  const guiaX = Math.abs(t.x) < IMA_POS;
  const guiaY = Math.abs(t.y) < IMA_POS;
  const reto = Math.abs(t.giro) < IMA_GIRO;
  return { x: guiaX ? 0 : t.x, y: guiaY ? 0 : t.y, escala: t.escala, giro: reto ? 0 : t.giro, guiaX, guiaY, reto };
}

/**
 * Os gestos da mídia no "criar": arrastar com um dedo move; dois dedos dão zoom e giram; a roda do mouse dá zoom (com Shift,
 * gira). Durante o gesto a mídia anda direto pelo estilo (sem passar pelo React, para ficar a 60 quadros); no fim, `aoMudar`
 * guarda o valor. As guias do centro aparecem e a mídia gruda nelas; um toque curto de vibração marca o encaixe (onde houver).
 */
export function useGestosDaMidia({
  area,
  midia,
  guias,
  valor,
  ativo,
  aoMudar,
}: {
  /** Onde os dedos tocam (a camada de gestos, por cima da mídia e por baixo do texto). */
  area: RefObject<HTMLElement | null>;
  /** O que se move (a mídia). */
  midia: RefObject<HTMLElement | null>;
  /** As guias do centro (ganham data-x / data-y quando a mídia encaixa). */
  guias: RefObject<HTMLElement | null>;
  valor: Transformacao;
  ativo: boolean;
  aoMudar: (t: Transformacao) => void;
}): void {
  const atual = useRef(valor);
  const aoMudarAgora = useRef(aoMudar);
  useEffect(() => {
    atual.current = valor;
    aoMudarAgora.current = aoMudar;
  });

  useEffect(() => {
    const el = area.current;
    if (!el || !ativo) return;
    const dedos = new Map<number, { x: number; y: number }>();
    let inicio: { t: Transformacao; dedos: Map<number, { x: number; y: number }> } | null = null;
    let encaixe = { guiaX: false, guiaY: false, reto: false };
    let mexeu = false;

    const aplicar = (t: Transformacao) => {
      const m = ima(transformacaoValida(t));
      if (navigator.vibrate && ((m.guiaX && !encaixe.guiaX) || (m.guiaY && !encaixe.guiaY) || (m.reto && !encaixe.reto && t.giro !== 0))) {
        try {
          navigator.vibrate(6);
        } catch {
          /* sem vibração */
        }
      }
      encaixe = m;
      const limpo: Transformacao = { x: m.x, y: m.y, escala: m.escala, giro: m.giro };
      atual.current = limpo;
      if (midia.current) midia.current.style.transform = transformacaoEmCss(limpo);
      if (guias.current) {
        guias.current.dataset.x = m.guiaX && mexeu ? "sim" : "nao";
        guias.current.dataset.y = m.guiaY && mexeu ? "sim" : "nao";
      }
    };
    const comecar = () => {
      inicio = { t: { ...atual.current }, dedos: new Map(dedos) };
    };
    const terminar = () => {
      if (guias.current) {
        guias.current.dataset.x = "nao";
        guias.current.dataset.y = "nao";
      }
      if (mexeu) aoMudarAgora.current(atual.current);
      mexeu = false;
      inicio = null;
    };

    const baixo = (e: PointerEvent) => {
      if (e.pointerType === "mouse" && e.button !== 0) return;
      el.setPointerCapture(e.pointerId);
      dedos.set(e.pointerId, { x: e.clientX, y: e.clientY });
      comecar();
    };
    const move = (e: PointerEvent) => {
      if (!dedos.has(e.pointerId) || !inicio) return;
      dedos.set(e.pointerId, { x: e.clientX, y: e.clientY });
      const r = el.getBoundingClientRect();
      const ids = [...inicio.dedos.keys()].filter((id) => dedos.has(id));
      if (ids.length === 0) return;
      mexeu = true;
      const t0 = inicio.t;
      if (ids.length === 1) {
        const a = inicio.dedos.get(ids[0])!;
        const b = dedos.get(ids[0])!;
        aplicar({ ...t0, x: t0.x + (b.x - a.x) / r.width, y: t0.y + (b.y - a.y) / r.height });
        return;
      }
      const [p, q] = ids;
      const a1 = inicio.dedos.get(p)!;
      const a2 = inicio.dedos.get(q)!;
      const b1 = dedos.get(p)!;
      const b2 = dedos.get(q)!;
      const d0 = Math.hypot(a2.x - a1.x, a2.y - a1.y) || 1;
      const d1 = Math.hypot(b2.x - b1.x, b2.y - b1.y) || 1;
      const g0 = Math.atan2(a2.y - a1.y, a2.x - a1.x);
      const g1 = Math.atan2(b2.y - b1.y, b2.x - b1.x);
      const m0 = { x: (a1.x + a2.x) / 2, y: (a1.y + a2.y) / 2 };
      const m1 = { x: (b1.x + b2.x) / 2, y: (b1.y + b2.y) / 2 };
      aplicar({ x: t0.x + (m1.x - m0.x) / r.width, y: t0.y + (m1.y - m0.y) / r.height, escala: t0.escala * (d1 / d0), giro: t0.giro + (g1 - g0) });
    };
    const cima = (e: PointerEvent) => {
      dedos.delete(e.pointerId);
      if (dedos.size === 0) terminar();
      else comecar(); // tirou um dos dois dedos: recomeça do que ficou (sem pulo)
    };
    let fimDaRoda = 0;
    const roda = (e: WheelEvent) => {
      e.preventDefault();
      mexeu = true;
      const t = atual.current;
      if (e.shiftKey) aplicar({ ...t, giro: t.giro + e.deltaY * 0.004 });
      else aplicar({ ...t, escala: t.escala * Math.exp(-e.deltaY * 0.0015) });
      window.clearTimeout(fimDaRoda);
      fimDaRoda = window.setTimeout(terminar, 220);
    };

    el.addEventListener("pointerdown", baixo);
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerup", cima);
    el.addEventListener("pointercancel", cima);
    el.addEventListener("wheel", roda, { passive: false });
    return () => {
      window.clearTimeout(fimDaRoda);
      el.removeEventListener("pointerdown", baixo);
      el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerup", cima);
      el.removeEventListener("pointercancel", cima);
      el.removeEventListener("wheel", roda);
    };
  }, [area, midia, guias, ativo]);
}
