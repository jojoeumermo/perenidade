// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import "@/styles/vale-o-escrito.css";
// D3 SÓ AQUI (d3-force) e só chega ao navegador quando alguém abre a visão "Teia" (next/dynamic em Observatorio.tsx).
import { forceCenter, forceCollide, forceLink, forceManyBody, forceSimulation, forceX, forceY, type SimulationLinkDatum, type SimulationNodeDatum } from "d3-force";
import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { fill } from "@/i18n/config";
import {
  ESCALA_DO_NIVEL,
  NIVEIS_DA_TEIA,
  limitarEscala,
  nivelDaTeia,
  posicaoInicial,
  rotuloVisivel,
  type Grafo,
  type Ponto,
} from "@/lib/vale-o-escrito/visual";
import { NoSvg, type S } from "./Primitivas";

const L = 1000;
const A = 640;

interface NoSim extends SimulationNodeDatum {
  chave: string;
}

/** A simulação de força roda inteira, de uma vez, ao montar o grafo: o desenho não treme e quem prefere menos movimento não vê nada se mexer. */
function calcularPosicoes(g: Grafo): Map<string, Ponto> {
  const nos: NoSim[] = g.nos.map((n, i) => ({ chave: n.chave, ...posicaoInicial(i, g.nos.length, L, A) }));
  const ligas: SimulationLinkDatum<NoSim>[] = g.arestas.map((a) => ({ source: a.de, target: a.para }));
  const sim = forceSimulation<NoSim>(nos)
    .force("liga", forceLink<NoSim, SimulationLinkDatum<NoSim>>(ligas).id((d) => d.chave).distance(58).strength(0.7))
    .force("carga", forceManyBody<NoSim>().strength(-130).distanceMax(320))
    .force("centro", forceCenter(L / 2, A / 2))
    .force("x", forceX<NoSim>(L / 2).strength(0.03))
    .force("y", forceY<NoSim>(A / 2).strength(0.05))
    .force("colisao", forceCollide<NoSim>(16))
    .stop();
  const passos = Math.min(360, 120 + g.nos.length * 2);
  for (let i = 0; i < passos; i++) sim.tick();
  return new Map(nos.map((n) => [n.chave, { x: n.x ?? L / 2, y: n.y ?? A / 2 }]));
}

/** Escala e deslocamento que deixam o desenho inteiro na tela, com folga (a visão de abertura e o botão de recentrar). */
function caber(posicoes: Map<string, Ponto>): { k: number; x: number; y: number } {
  const ps = [...posicoes.values()];
  if (ps.length === 0) return { k: 1, x: 0, y: 0 };
  const xs = ps.map((p) => p.x);
  const ys = ps.map((p) => p.y);
  const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
  const w = Math.max(maxX - minX, 60), h = Math.max(maxY - minY, 60);
  const k = limitarEscala(Math.min(2.4, Math.max(0.7, Math.min((L * 0.8) / w, (A * 0.8) / h))));
  return { k, x: L / 2 - ((minX + maxX) / 2) * k, y: A / 2 - ((minY + maxY) / 2) * k };
}

export default function Teia({
  grafo,
  selecionado,
  aoSelecionar,
  s,
}: {
  grafo: Grafo;
  selecionado: string | null;
  aoSelecionar: (chave: string) => void;
  s: S;
}) {
  const base = useMemo(() => calcularPosicoes(grafo), [grafo]);
  const [movidos, setMovidos] = useState<Map<string, Ponto>>(new Map());
  const ajuste = useMemo(() => caber(base), [base]);
  const [t, setT] = useState(ajuste);
  const svg = useRef<SVGSVGElement>(null);
  const arrastou = useRef(false);
  const arrasto = useRef<{ tipo: "fundo" | "no"; chave?: string; px: number; py: number; ox: number; oy: number; andou: boolean } | null>(null);

  // Grafo novo: a visão volta ao começo.
  const [grafoAnterior, setGrafoAnterior] = useState(grafo);
  if (grafoAnterior !== grafo) {
    setGrafoAnterior(grafo);
    setMovidos(new Map());
    setT(ajuste);
  }

  const pos = (chave: string): Ponto => movidos.get(chave) ?? base.get(chave) ?? { x: L / 2, y: A / 2 };
  const nivel = nivelDaTeia(t.k);

  /** Pixels da tela → unidades do desenho (o SVG mantém a proporção e centraliza). */
  const unidade = useCallback(() => {
    const r = svg.current?.getBoundingClientRect();
    if (!r || r.width === 0 || r.height === 0) return { u: 1, cx: 0, cy: 0 };
    return { u: Math.max(L / r.width, A / r.height), cx: r.left + r.width / 2, cy: r.top + r.height / 2 };
  }, []);

  const zoomarEm = useCallback((fator: number, ancora?: Ponto) => {
    setT((a) => {
      const k = limitarEscala(a.k * fator);
      const p = ancora ?? { x: L / 2, y: A / 2 };
      return { k, x: p.x - ((p.x - a.x) * k) / a.k, y: p.y - ((p.y - a.y) * k) / a.k };
    });
  }, []);

  // A roda do mouse precisa de ouvinte não passivo para não rolar a página junto.
  useEffect(() => {
    const el = svg.current;
    if (!el) return;
    const roda = (e: WheelEvent) => {
      e.preventDefault();
      const { u, cx, cy } = unidade();
      zoomarEm(e.deltaY < 0 ? 1.15 : 1 / 1.15, { x: (e.clientX - cx) * u + L / 2, y: (e.clientY - cy) * u + A / 2 });
    };
    el.addEventListener("wheel", roda, { passive: false });
    return () => el.removeEventListener("wheel", roda);
  }, [unidade, zoomarEm]);

  const noFundo = (e: PointerEvent<SVGSVGElement>) => {
    if ((e.target as Element).closest(".ve-no")) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    arrastou.current = false;
    arrasto.current = { tipo: "fundo", px: e.clientX, py: e.clientY, ox: t.x, oy: t.y, andou: false };
  };
  const noNo = (e: PointerEvent<SVGGElement>, chave: string) => {
    // Sem capturar o ponteiro aqui: um toque simples tem de chegar ao onClick do nó. A captura começa quando o nó é arrastado.
    arrastou.current = false;
    const p = pos(chave);
    arrasto.current = { tipo: "no", chave, px: e.clientX, py: e.clientY, ox: p.x, oy: p.y, andou: false };
  };
  const mover = (e: PointerEvent<SVGSVGElement>) => {
    const a = arrasto.current;
    if (!a) return;
    const { u } = unidade();
    const dx = (e.clientX - a.px) * u;
    const dy = (e.clientY - a.py) * u;
    if (!a.andou && Math.abs(dx) + Math.abs(dy) > 4 * u) {
      a.andou = true;
      arrastou.current = true;
      if (a.tipo === "no") svg.current?.setPointerCapture(e.pointerId);
    }
    if (a.tipo === "fundo") setT((x) => ({ ...x, x: a.ox + dx, y: a.oy + dy }));
    else if (a.andou && a.chave) setMovidos((m) => new Map(m).set(a.chave!, { x: a.ox + dx / t.k, y: a.oy + dy / t.k }));
  };
  const soltar = () => {
    arrasto.current = null;
  };
  /** Clique de verdade (sem arrasto) escolhe o nó; o arrasto só o move. */
  const escolher = (chave: string) => {
    if (arrastou.current) {
      arrastou.current = false;
      return;
    }
    aoSelecionar(chave);
  };

  const tecla = (e: KeyboardEvent<HTMLDivElement>) => {
    const passo = 40;
    if (e.key === "+" || e.key === "=") zoomarEm(1.25);
    else if (e.key === "-" || e.key === "_") zoomarEm(1 / 1.25);
    else if (e.key === "0") setT(ajuste);
    else if (e.key === "ArrowLeft") setT((a) => ({ ...a, x: a.x + passo }));
    else if (e.key === "ArrowRight") setT((a) => ({ ...a, x: a.x - passo }));
    else if (e.key === "ArrowUp") setT((a) => ({ ...a, y: a.y + passo }));
    else if (e.key === "ArrowDown") setT((a) => ({ ...a, y: a.y - passo }));
    else return;
    e.preventDefault();
  };

  const proximoNivel = (dir: 1 | -1) => {
    const i = NIVEIS_DA_TEIA.indexOf(nivel);
    const alvo = NIVEIS_DA_TEIA[Math.min(NIVEIS_DA_TEIA.length - 1, Math.max(0, i + dir))];
    zoomarEm(ESCALA_DO_NIVEL[alvo] / t.k);
  };

  const vizinhosDoSel = useMemo(() => {
    const set = new Set<string>();
    if (selecionado) {
      set.add(selecionado);
      for (const a of grafo.arestas) {
        if (a.de === selecionado) set.add(a.para);
        if (a.para === selecionado) set.add(a.de);
      }
    }
    return set;
  }, [grafo, selecionado]);

  return (
    <div onKeyDown={tecla} style={{ width: "100%", height: "100%" }}>
      <div className="ve-hud">
        <div className="ve-hud-botoes" role="group" aria-label={fill(s.visual.zoomNivel, { nivel: s.visual.zoomTeia[nivel] })}>
          <button type="button" onClick={() => proximoNivel(1)} aria-label={s.visual.zoomMais} title={s.visual.zoomMais}>
            +
          </button>
          <button type="button" onClick={() => proximoNivel(-1)} aria-label={s.visual.zoomMenos} title={s.visual.zoomMenos}>
            −
          </button>
          <button type="button" onClick={() => setT(ajuste)} aria-label={s.visual.zoomRestaurar} title={s.visual.zoomRestaurar}>
            ◎
          </button>
        </div>
        <span className="ve-nivel" aria-live="polite">
          {fill(s.visual.zoomNivel, { nivel: s.visual.zoomTeia[nivel] })}
        </span>
      </div>
      {/* A leitura de painel (coordenadas e escala), decorativa: o nível nomeado acima é o que vale para o leitor de tela. */}
      <p className="ve-coord" aria-hidden="true">
        X {(-t.x).toFixed(1)} · Y {(-t.y).toFixed(1)}
        <br />
        {grafo.nos.length} · {grafo.arestas.length} · ×{t.k.toFixed(2)}
      </p>
      <svg
        ref={svg}
        className="ve-svg"
        viewBox={`0 0 ${L} ${A}`}
        preserveAspectRatio="xMidYMid meet"
        role="group"
        aria-label={s.visual.aria.palco}
        onPointerDown={noFundo}
        onPointerMove={mover}
        onPointerUp={soltar}
        onPointerCancel={soltar}
        style={{ cursor: "grab" }}
      >
        <g transform={`translate(${t.x} ${t.y}) scale(${t.k})`}>
          {grafo.arestas.map((a) => {
            const p = pos(a.de);
            const q = pos(a.para);
            const realce = selecionado !== null && (a.de === selecionado || a.para === selecionado);
            const apagado = selecionado !== null && !realce;
            const mostrarTexto = (nivel === "caso" || nivel === "detalhe") && (realce || nivel === "detalhe");
            return (
              <g key={a.id}>
                <line className="ve-aresta" data-implicita={a.implicita} data-realce={realce} data-apagado={apagado} x1={p.x} y1={p.y} x2={q.x} y2={q.y} />
                {mostrarTexto && (
                  <text className="ve-eixo-texto" x={(p.x + q.x) / 2} y={(p.y + q.y) / 2} textAnchor="middle" style={{ fontSize: 8 / Math.sqrt(t.k) }}>
                    {a.situacao ? s.situacao[a.situacao] : (a.rotulo ?? s.visual.ligacao[a.tipo])}
                  </text>
                )}
              </g>
            );
          })}
          {grafo.nos.map((n) => {
            const p = pos(n.chave);
            return (
              <NoSvg
                key={n.chave}
                no={n}
                x={p.x}
                y={p.y}
                s={s}
                escala={t.k}
                selecionado={selecionado === n.chave}
                apagado={selecionado !== null && !vizinhosDoSel.has(n.chave)}
                mostrarRotulo={rotuloVisivel(n.tipo, nivel, selecionado === n.chave)}
                aoSelecionar={escolher}
                aoPressionar={noNo}
              />
            );
          })}
        </g>
      </svg>
    </div>
  );
}
