// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

// O "visor" das visões em SVG (Teia, Órbita, Grupos): aproximar e afastar com a roda do mouse, pinça de dois dedos no
// celular, arrastar o fundo para mover, teclado (+, −, 0 e setas) e os botões +/−/recentrar SEMPRE visíveis, com o nível
// nomeado ("Zoom: Caso") e a leitura de coordenadas. Antes só a Teia tinha zoom, e sem pinça; a Órbita não tinha nenhum
// (NOVAS-TAREFAS, T10). Sem biblioteca: Pointer Events e um ouvinte de roda não passivo.

import { useCallback, useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { fill } from "@/i18n/config";
import { ESCALA_DO_NIVEL, NIVEIS_DA_TEIA, limitarEscala, nivelDaTeia, type Ponto } from "@/lib/vale-o-escrito/visual";
import type { S } from "./Primitivas";

export interface Transformacao {
  k: number;
  x: number;
  y: number;
}

export const IDENTIDADE: Transformacao = { k: 1, x: 0, y: 0 };

/**
 * Estado e gestos do visor. `L` e `A` são a largura e a altura do viewBox. `ajuste` é a vista de abertura (e do botão
 * recentrar). `mexeu` fica verdadeiro depois de um arrasto ou pinça, para o clique que vem junto não escolher um nó.
 */
export function useVisor(L: number, A: number, ajuste: Transformacao) {
  const [t, setT] = useState(ajuste);
  const svg = useRef<SVGSVGElement>(null);
  const mexeu = useRef(false);
  const ponteiros = useRef(new Map<number, Ponto>());
  const pan = useRef<{ px: number; py: number; ox: number; oy: number } | null>(null);
  const pinca = useRef<{ d0: number; k0: number; mundo: Ponto } | null>(null);
  const tRef = useRef(t);
  useEffect(() => {
    tRef.current = t;
  });

  // Vista nova (grafo ou centro novo): o visor volta ao começo.
  const [ajusteAnterior, setAjusteAnterior] = useState(ajuste);
  if (ajusteAnterior !== ajuste) {
    setAjusteAnterior(ajuste);
    setT(ajuste);
  }

  /** Pixels da tela → unidades do desenho (o SVG mantém a proporção e centraliza). */
  const unidade = useCallback(() => {
    const r = svg.current?.getBoundingClientRect();
    if (!r || r.width === 0 || r.height === 0) return { u: 1, cx: 0, cy: 0 };
    return { u: Math.max(L / r.width, A / r.height), cx: r.left + r.width / 2, cy: r.top + r.height / 2 };
  }, [L, A]);

  const paraDesenho = useCallback(
    (clientX: number, clientY: number): Ponto => {
      const { u, cx, cy } = unidade();
      return { x: (clientX - cx) * u + L / 2, y: (clientY - cy) * u + A / 2 };
    },
    [unidade, L, A],
  );

  const zoomarEm = useCallback(
    (fator: number, ancora?: Ponto) => {
      setT((a) => {
        const k = limitarEscala(a.k * fator);
        const p = ancora ?? { x: L / 2, y: A / 2 };
        return { k, x: p.x - ((p.x - a.x) * k) / a.k, y: p.y - ((p.y - a.y) * k) / a.k };
      });
    },
    [L, A],
  );

  // A roda do mouse precisa de ouvinte não passivo para não rolar a página junto. Trackpad (deltaY pequeno) aproxima
  // proporcional ao gesto; roda comum, 15% por passo.
  useEffect(() => {
    const el = svg.current;
    if (!el) return;
    const roda = (e: WheelEvent) => {
      e.preventDefault();
      const fator = Math.abs(e.deltaY) < 40 && e.deltaMode === 0 ? Math.exp(-e.deltaY * 0.01) : e.deltaY < 0 ? 1.15 : 1 / 1.15;
      zoomarEm(fator, paraDesenho(e.clientX, e.clientY));
    };
    el.addEventListener("wheel", roda, { passive: false });
    return () => el.removeEventListener("wheel", roda);
  }, [zoomarEm, paraDesenho]);

  const comecarPinca = () => {
    const [a, b] = [...ponteiros.current.values()];
    const m = paraDesenho((a.x + b.x) / 2, (a.y + b.y) / 2);
    const tt = tRef.current;
    pinca.current = { d0: Math.hypot(a.x - b.x, a.y - b.y) || 1, k0: tt.k, mundo: { x: (m.x - tt.x) / tt.k, y: (m.y - tt.y) / tt.k } };
    pan.current = null;
    mexeu.current = true;
  };

  /** Ponteiro desceu no SVG. `noFundo` = falso quando caiu num nó (o nó cuida do próprio arrasto). */
  const baixar = (e: PointerEvent<SVGSVGElement>) => {
    ponteiros.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (ponteiros.current.size === 1) mexeu.current = false;
    if (ponteiros.current.size >= 2) {
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch {}
      comecarPinca();
      return;
    }
    if ((e.target as Element).closest(".ve-no")) return;
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {}
    pan.current = { px: e.clientX, py: e.clientY, ox: tRef.current.x, oy: tRef.current.y };
  };

  /** Devolve verdadeiro quando o movimento foi do visor (pinça ou arrasto do fundo). */
  const mover = (e: PointerEvent<SVGSVGElement>): boolean => {
    if (ponteiros.current.has(e.pointerId)) ponteiros.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const pc = pinca.current;
    if (pc && ponteiros.current.size >= 2) {
      const [a, b] = [...ponteiros.current.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y) || 1;
      const m = paraDesenho((a.x + b.x) / 2, (a.y + b.y) / 2);
      const k = limitarEscala((pc.k0 * d) / pc.d0);
      setT({ k, x: m.x - pc.mundo.x * k, y: m.y - pc.mundo.y * k });
      return true;
    }
    const p = pan.current;
    if (p) {
      const { u } = unidade();
      const dx = (e.clientX - p.px) * u;
      const dy = (e.clientY - p.py) * u;
      if (!mexeu.current && Math.abs(dx) + Math.abs(dy) > 4 * u) mexeu.current = true;
      setT((x) => ({ ...x, x: p.ox + dx, y: p.oy + dy }));
      return true;
    }
    return pinca.current !== null;
  };

  const soltar = (e: PointerEvent<SVGSVGElement>) => {
    ponteiros.current.delete(e.pointerId);
    if (ponteiros.current.size < 2) pinca.current = null;
    pan.current = null;
    // O clique que vem logo depois do arrasto ainda vê `mexeu`; depois disso (teclado, outro toque) volta ao normal.
    if (ponteiros.current.size === 0) window.setTimeout(() => (mexeu.current = false), 0);
  };

  const proximoNivel = (dir: 1 | -1) => {
    const nivel = nivelDaTeia(tRef.current.k);
    const i = NIVEIS_DA_TEIA.indexOf(nivel);
    const alvo = NIVEIS_DA_TEIA[Math.min(NIVEIS_DA_TEIA.length - 1, Math.max(0, i + dir))];
    // Já no último nível (ou no primeiro): ainda aproxima/afasta um passo, para o botão nunca ficar "morto".
    zoomarEm(alvo === nivel ? (dir > 0 ? 1.25 : 1 / 1.25) : ESCALA_DO_NIVEL[alvo] / tRef.current.k);
  };

  const tecla = (e: KeyboardEvent<HTMLElement>) => {
    const passo = 40;
    if (e.key === "+" || e.key === "=") zoomarEm(1.25);
    else if (e.key === "-" || e.key === "_") zoomarEm(1 / 1.25);
    else if (e.key === "0") setT(ajuste);
    else if ((e.target as Element).closest?.(".ve-no")) return;
    else if (e.key === "ArrowLeft") setT((a) => ({ ...a, x: a.x + passo }));
    else if (e.key === "ArrowRight") setT((a) => ({ ...a, x: a.x - passo }));
    else if (e.key === "ArrowUp") setT((a) => ({ ...a, y: a.y + passo }));
    else if (e.key === "ArrowDown") setT((a) => ({ ...a, y: a.y - passo }));
    else return;
    e.preventDefault();
  };

  return { t, setT, svg, mexeu, unidade, zoomarEm, baixar, mover, soltar, tecla, proximoNivel, recentrar: () => setT(ajuste) };
}

/** Os botões +/−/recentrar, o nível nomeado ("ZOOM 03 — CASO") e a leitura de coordenadas, sempre visíveis. */
export function HudDoVisor({
  t,
  s,
  totalNos,
  totalArestas,
  aoMais,
  aoMenos,
  aoRecentrar,
}: {
  t: Transformacao;
  s: S;
  totalNos: number;
  totalArestas: number;
  aoMais: () => void;
  aoMenos: () => void;
  aoRecentrar: () => void;
}) {
  const nivel = nivelDaTeia(t.k);
  const n = String(NIVEIS_DA_TEIA.indexOf(nivel) + 1).padStart(2, "0");
  const rotulo = fill(s.visual.zoomNivel, { nivel: s.visual.zoomTeia[nivel] });
  return (
    <>
      <div className="ve-hud">
        <div className="ve-hud-botoes" role="group" aria-label={rotulo}>
          <button type="button" onClick={aoMais} aria-label={s.visual.zoomMais} title={s.visual.zoomMais}>
            +
          </button>
          <button type="button" onClick={aoMenos} aria-label={s.visual.zoomMenos} title={s.visual.zoomMenos}>
            −
          </button>
          <button type="button" onClick={aoRecentrar} aria-label={s.visual.zoomRestaurar} title={s.visual.zoomRestaurar}>
            ◎
          </button>
        </div>
        <span className="ve-nivel" aria-live="polite">
          <span aria-hidden="true">ZOOM {n} — </span>
          {rotulo}
        </span>
      </div>
      {/* A leitura de painel (coordenadas e escala), decorativa: o nível nomeado acima é o que vale para o leitor de tela. */}
      <p className="ve-coord" aria-hidden="true">
        X {(-t.x).toFixed(1)} · Y {(-t.y).toFixed(1)}
        <br />
        {totalNos} · {totalArestas} · ×{t.k.toFixed(2)}
      </p>
    </>
  );
}
