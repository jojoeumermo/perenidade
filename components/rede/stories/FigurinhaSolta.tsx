// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useEffect, useRef, type CSSProperties, type KeyboardEvent as EventoDeTecla, type ReactNode } from "react";
import { posicaoValida } from "@/lib/rede/stories/visual";
import type { PosicaoDaFigurinha, TipoDeFigurinha } from "@/lib/rede/tipos-stories";

/** O lugar em CSS: o centro da figurinha em x/y da tela, girada e no tamanho (o visor e o "criar" usam a mesma conta). */
export function estiloDaPosicao(p: PosicaoDaFigurinha): CSSProperties {
  return { left: `${p.x * 100}%`, top: `${p.y * 100}%`, transform: `translate(-50%, -50%) rotate(${p.giro}deg) scale(${p.escala})` };
}

/** Perto do meio e do reto, a figurinha gruda (como as guias do Instagram). */
const IMA_X = 0.02;
const IMA_GIRO = 3;
function comIma(p: PosicaoDaFigurinha): PosicaoDaFigurinha & { noMeio: boolean } {
  const noMeio = Math.abs(p.x - 0.5) < IMA_X;
  return { ...p, x: noMeio ? 0.5 : p.x, giro: Math.abs(p.giro) < IMA_GIRO ? 0 : p.giro, noMeio };
}

/** O que, dentro da figurinha, é para escrever ou escolher (o dedo ali não arrasta). */
const INTERATIVO = "input, textarea, select, a, label, button:not(.al-st-alca), [contenteditable='true']";

const IconeAlca = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden>
    {[7, 12, 17].flatMap((x) => [9, 15].map((y) => <circle key={`${x}-${y}`} cx={x} cy={y} r={1.7} />))}
  </svg>
);

/**
 * Uma figurinha solta na tela do "criar" (prancha celular-criar-story: a figurinha inclinada sobre o fundo): arrastar com um dedo
 * move; dois dedos giram e mudam o tamanho; a roda do mouse muda o tamanho (com Shift, gira). Os campos de dentro continuam
 * funcionando (o dedo num campo não arrasta). Pelo teclado, a alça: setas movem, + e − mudam o tamanho, [ e ] giram. Durante o
 * gesto o estilo muda direto (60 quadros, sem passar pelo React); no fim, `aoMudar` guarda o lugar, que vai junto no story.
 */
export function FigurinhaSolta({
  tipo,
  pos,
  ativa,
  rotulo,
  idDaDica,
  aoMudar,
  aoTocar,
  children,
}: {
  tipo: TipoDeFigurinha;
  pos: PosicaoDaFigurinha;
  /** Falso no modo "desenhar" (o dedo desenha por cima). */
  ativa: boolean;
  /** "Mover a figurinha Enquete". */
  rotulo: string;
  idDaDica: string;
  aoMudar: (p: PosicaoDaFigurinha) => void;
  /** Tocou nela: vem para a frente. */
  aoTocar: () => void;
  children: ReactNode;
}) {
  const el = useRef<HTMLDivElement>(null);
  const atual = useRef(pos);
  const aoMudarAgora = useRef(aoMudar);
  const aoTocarAgora = useRef(aoTocar);
  useEffect(() => {
    atual.current = pos;
    aoMudarAgora.current = aoMudar;
    aoTocarAgora.current = aoTocar;
  });

  useEffect(() => {
    const no = el.current;
    if (!no || !ativa) return;
    const camada = no.parentElement;
    const dedos = new Map<number, { x: number; y: number }>();
    let inicio: { p: PosicaoDaFigurinha; dedos: Map<number, { x: number; y: number }> } | null = null;
    let mexeu = false;
    let noMeioAntes = false;

    const aplicar = (bruto: PosicaoDaFigurinha) => {
      const m = comIma(posicaoValida(bruto));
      if (m.noMeio && !noMeioAntes && navigator.vibrate) {
        try {
          navigator.vibrate(6);
        } catch {
          /* sem vibração */
        }
      }
      noMeioAntes = m.noMeio;
      const limpo: PosicaoDaFigurinha = { x: m.x, y: m.y, giro: m.giro, escala: m.escala };
      atual.current = limpo;
      Object.assign(no.style, estiloDaPosicao(limpo));
      if (camada) camada.dataset.guia = m.noMeio ? "sim" : "nao";
    };
    const comecar = () => {
      inicio = { p: { ...atual.current }, dedos: new Map(dedos) };
    };
    const terminar = () => {
      no.dataset.pegando = "nao";
      if (camada) camada.dataset.guia = "nao";
      if (mexeu) aoMudarAgora.current(atual.current);
      mexeu = false;
      inicio = null;
    };
    const baixo = (e: PointerEvent) => {
      aoTocarAgora.current();
      if ((e.pointerType === "mouse" && e.button !== 0) || (e.target instanceof Element && e.target.closest(INTERATIVO))) return;
      e.preventDefault();
      no.setPointerCapture(e.pointerId);
      dedos.set(e.pointerId, { x: e.clientX, y: e.clientY });
      no.dataset.pegando = "sim";
      comecar();
    };
    const move = (e: PointerEvent) => {
      if (!dedos.has(e.pointerId) || !inicio || !camada) return;
      dedos.set(e.pointerId, { x: e.clientX, y: e.clientY });
      const r = camada.getBoundingClientRect();
      const ids = [...inicio.dedos.keys()].filter((id) => dedos.has(id));
      if (ids.length === 0) return;
      const p0 = inicio.p;
      if (ids.length === 1) {
        const a = inicio.dedos.get(ids[0])!;
        const b = dedos.get(ids[0])!;
        if (!mexeu && Math.hypot(b.x - a.x, b.y - a.y) < 3) return;
        mexeu = true;
        aplicar({ ...p0, x: p0.x + (b.x - a.x) / r.width, y: p0.y + (b.y - a.y) / r.height });
        return;
      }
      mexeu = true;
      const [p, q] = ids;
      const a1 = inicio.dedos.get(p)!;
      const a2 = inicio.dedos.get(q)!;
      const b1 = dedos.get(p)!;
      const b2 = dedos.get(q)!;
      const d0 = Math.hypot(a2.x - a1.x, a2.y - a1.y) || 1;
      const d1 = Math.hypot(b2.x - b1.x, b2.y - b1.y) || 1;
      const g = ((Math.atan2(b2.y - b1.y, b2.x - b1.x) - Math.atan2(a2.y - a1.y, a2.x - a1.x)) * 180) / Math.PI;
      const m0 = { x: (a1.x + a2.x) / 2, y: (a1.y + a2.y) / 2 };
      const m1 = { x: (b1.x + b2.x) / 2, y: (b1.y + b2.y) / 2 };
      aplicar({ x: p0.x + (m1.x - m0.x) / r.width, y: p0.y + (m1.y - m0.y) / r.height, escala: p0.escala * (d1 / d0), giro: p0.giro + g });
    };
    const cima = (e: PointerEvent) => {
      if (!dedos.delete(e.pointerId)) return;
      if (dedos.size === 0) terminar();
      else comecar(); // tirou um dos dois dedos: segue do que ficou, sem pulo
    };
    let fimDaRoda = 0;
    const roda = (e: WheelEvent) => {
      if (e.target instanceof Element && e.target.closest("select, textarea")) return;
      e.preventDefault();
      mexeu = true;
      const p = atual.current;
      if (e.shiftKey) aplicar({ ...p, giro: p.giro + e.deltaY * 0.08 });
      else aplicar({ ...p, escala: p.escala * Math.exp(-e.deltaY * 0.0015) });
      window.clearTimeout(fimDaRoda);
      fimDaRoda = window.setTimeout(terminar, 220);
    };
    no.addEventListener("pointerdown", baixo);
    no.addEventListener("pointermove", move);
    no.addEventListener("pointerup", cima);
    no.addEventListener("pointercancel", cima);
    no.addEventListener("wheel", roda, { passive: false });
    return () => {
      window.clearTimeout(fimDaRoda);
      no.removeEventListener("pointerdown", baixo);
      no.removeEventListener("pointermove", move);
      no.removeEventListener("pointerup", cima);
      no.removeEventListener("pointercancel", cima);
      no.removeEventListener("wheel", roda);
    };
  }, [ativa]);

  const teclar = (e: EventoDeTecla<HTMLButtonElement>) => {
    const p = atual.current;
    const passo = e.shiftKey ? 0.06 : 0.02;
    const novo: Partial<Record<string, PosicaoDaFigurinha>> = {
      ArrowLeft: { ...p, x: p.x - passo },
      ArrowRight: { ...p, x: p.x + passo },
      ArrowUp: { ...p, y: p.y - passo },
      ArrowDown: { ...p, y: p.y + passo },
      "+": { ...p, escala: p.escala * 1.08 },
      "=": { ...p, escala: p.escala * 1.08 },
      "-": { ...p, escala: p.escala / 1.08 },
      "[": { ...p, giro: p.giro - 5 },
      "]": { ...p, giro: p.giro + 5 },
    };
    const n = novo[e.key];
    if (!n) return;
    e.preventDefault();
    aoMudar(posicaoValida(n));
  };

  return (
    <div ref={el} className="al-st-fig-solta al-ed-figurinha-entra" data-tipo={tipo} data-pegando="nao" data-ativa={ativa ? "sim" : "nao"} style={estiloDaPosicao(pos)}>
      <button type="button" className="al-st-alca" aria-label={rotulo} aria-describedby={idDaDica} onKeyDown={teclar} tabIndex={ativa ? 0 : -1}>
        <IconeAlca />
      </button>
      {children}
    </div>
  );
}
