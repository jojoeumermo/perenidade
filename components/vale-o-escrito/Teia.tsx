// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import "@/styles/vale-o-escrito.css";
// D3 SÓ AQUI (d3-force) e só chega ao navegador quando alguém abre a visão "Teia" (next/dynamic em Observatorio.tsx).
import { forceCenter, forceCollide, forceLink, forceManyBody, forceSimulation, forceX, forceY, type SimulationLinkDatum, type SimulationNodeDatum } from "d3-force";
import { useMemo, useRef, useState, type PointerEvent } from "react";
import type { TipoDeNo } from "@/lib/vale-o-escrito/tipos";
import { limitarEscala, nivelDaTeia, posicaoInicial, rotuloVisivel, type Grafo, type Ponto } from "@/lib/vale-o-escrito/visual";
import { ArestaSvg, DefsNeon, NoSvg, type S } from "./Primitivas";
import { HudDoVisor, useVisor } from "./Visor";

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
  destaque = null,
  s,
}: {
  grafo: Grafo;
  selecionado: string | null;
  aoSelecionar: (chave: string) => void;
  /** Tipo de nó em destaque (legenda): os outros tipos apagam. */
  destaque?: TipoDeNo | null;
  s: S;
}) {
  const base = useMemo(() => calcularPosicoes(grafo), [grafo]);
  const [movidos, setMovidos] = useState<Map<string, Ponto>>(new Map());
  const ajuste = useMemo(() => caber(base), [base]);
  const v = useVisor(L, A, ajuste);
  const t = v.t;
  const arrasto = useRef<{ chave: string; px: number; py: number; ox: number; oy: number; andou: boolean } | null>(null);

  // Grafo novo: os nós arrastados voltam ao lugar (o visor volta ao começo sozinho, pelo ajuste novo).
  const [grafoAnterior, setGrafoAnterior] = useState(grafo);
  if (grafoAnterior !== grafo) {
    setGrafoAnterior(grafo);
    setMovidos(new Map());
  }

  const pos = (chave: string): Ponto => movidos.get(chave) ?? base.get(chave) ?? { x: L / 2, y: A / 2 };
  const nivel = nivelDaTeia(t.k);

  const noNo = (e: PointerEvent<SVGGElement>, chave: string) => {
    // Sem capturar o ponteiro aqui: um toque simples tem de chegar ao onClick do nó. A captura começa quando o nó é arrastado.
    const p = pos(chave);
    arrasto.current = { chave, px: e.clientX, py: e.clientY, ox: p.x, oy: p.y, andou: false };
  };
  const mover = (e: PointerEvent<SVGSVGElement>) => {
    if (v.mover(e)) {
      arrasto.current = null;
      return;
    }
    const a = arrasto.current;
    if (!a) return;
    const { u } = v.unidade();
    const dx = (e.clientX - a.px) * u;
    const dy = (e.clientY - a.py) * u;
    if (!a.andou && Math.abs(dx) + Math.abs(dy) > 4 * u) {
      a.andou = true;
      v.mexeu.current = true;
      try {
        v.svg.current?.setPointerCapture(e.pointerId);
      } catch {}
    }
    if (a.andou) setMovidos((m) => new Map(m).set(a.chave, { x: a.ox + dx / t.k, y: a.oy + dy / t.k }));
  };
  const soltar = (e: PointerEvent<SVGSVGElement>) => {
    v.soltar(e);
    arrasto.current = null;
  };
  /** Clique de verdade (sem arrasto nem pinça) escolhe o nó; o arrasto só o move. */
  const escolher = (chave: string) => {
    if (v.mexeu.current) {
      v.mexeu.current = false;
      return;
    }
    aoSelecionar(chave);
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
  const tipoDe = useMemo(() => new Map(grafo.nos.map((n) => [n.chave, n.tipo])), [grafo]);
  const foraDoDestaque = (chave: string) => destaque !== null && tipoDe.get(chave) !== destaque;

  return (
    <div onKeyDown={v.tecla} style={{ width: "100%", height: "100%" }}>
      <HudDoVisor
        t={t}
        s={s}
        totalNos={grafo.nos.length}
        totalArestas={grafo.arestas.length}
        aoMais={() => v.proximoNivel(1)}
        aoMenos={() => v.proximoNivel(-1)}
        aoRecentrar={v.recentrar}
      />
      <svg
        ref={v.svg}
        className="ve-svg"
        viewBox={`0 0 ${L} ${A}`}
        preserveAspectRatio="xMidYMid meet"
        role="group"
        aria-label={s.visual.aria.palco}
        onPointerDown={v.baixar}
        onPointerMove={mover}
        onPointerUp={soltar}
        onPointerCancel={soltar}
        style={{ cursor: "grab" }}
      >
        <DefsNeon />
        <g transform={`translate(${t.x} ${t.y}) scale(${t.k})`}>
          {grafo.arestas.map((a) => {
            const realce = selecionado !== null && (a.de === selecionado || a.para === selecionado);
            const apagado = (selecionado !== null && !realce) || (foraDoDestaque(a.de) && foraDoDestaque(a.para));
            const mostrarTexto = (nivel === "caso" || nivel === "detalhe") && (realce || nivel === "detalhe");
            return (
              <ArestaSvg key={a.id} aresta={a} p={pos(a.de)} q={pos(a.para)} realce={realce} apagado={apagado} escala={t.k}>
                {(meio) =>
                  mostrarTexto && (
                    <text className="ve-eixo-texto" x={meio.x} y={meio.y - 3} textAnchor="middle" style={{ fontSize: 8 / Math.sqrt(t.k) }}>
                      {a.situacao ? s.situacao[a.situacao] : (a.rotulo ?? s.visual.ligacao[a.tipo])}
                    </text>
                  )
                }
              </ArestaSvg>
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
                apagado={(selecionado !== null && !vizinhosDoSel.has(n.chave)) || foraDoDestaque(n.chave)}
                mostrarRotulo={rotuloVisivel(n.tipo, nivel, selecionado === n.chave || destaque === n.tipo)}
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
