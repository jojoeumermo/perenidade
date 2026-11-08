// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import "@/styles/vale-o-escrito.css";
// D3 SÓ AQUI (d3-force) e só chega ao navegador quando alguém abre a visão "Teia" (next/dynamic em Observatorio.tsx).
import { forceCenter, forceCollide, forceLink, forceManyBody, forceSimulation, forceX, forceY, type SimulationLinkDatum, type SimulationNodeDatum } from "d3-force";
import { useMemo } from "react";
import type { TipoDeNo } from "@/lib/vale-o-escrito/tipos";
import { limitarEscala, nivelDaTeia, posicaoInicial, rotuloVisivel, type Grafo, type Ponto } from "@/lib/vale-o-escrito/visual";
import { ArestaSvg, DefsNeon, NoSvg, type S } from "./Primitivas";
import { HudDoVisor, useVisor } from "./Visor";

const L = 1000;
const A = 640;

interface NoSim extends SimulationNodeDatum {
  chave: string;
}

/**
 * A simulação de força roda inteira, de uma vez, ao montar o grafo, e para: depois disso nada se mexe (os nós não se
 * arrastam nem se pinçam). Determinística: ponto de partida fixo (posicaoInicial) e o sorteio do d3-force com semente
 * própria, então o mesmo grafo dá sempre o mesmo desenho, no servidor de testes e em qualquer navegador.
 */
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
  const ajuste = useMemo(() => caber(base), [base]);
  // Sem gestos de toque nem roda: a página rola e aproxima normalmente por cima da teia; o desenho aproxima pelos
  // botões +/−/◎ e pelo teclado, e o mouse arrasta o fundo. Aproximada além da abertura, um dedo no fundo também
  // arrasta (só então o SVG pede touch-action: none); os nós continuam parados.
  const { t, svgRef, arrastoNoToque, baixar, mover, soltar, tecla, proximoNivel, recentrar, consumirMexeu } = useVisor(L, A, ajuste, { gestos: false });

  const pos = (chave: string): Ponto => base.get(chave) ?? { x: L / 2, y: A / 2 };
  const nivel = nivelDaTeia(t.k);

  /** Clique de verdade (sem arrastar o fundo) escolhe o nó. */
  const escolher = (chave: string) => {
    if (consumirMexeu()) return;
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
    <div onKeyDown={tecla} style={{ width: "100%", height: "100%" }}>
      <HudDoVisor
        t={t}
        s={s}
        totalNos={grafo.nos.length}
        totalArestas={grafo.arestas.length}
        aoMais={() => proximoNivel(1)}
        aoMenos={() => proximoNivel(-1)}
        aoRecentrar={recentrar}
      />
      <svg
        ref={svgRef}
        className="ve-svg"
        viewBox={`0 0 ${L} ${A}`}
        preserveAspectRatio="xMidYMid meet"
        role="group"
        aria-label={s.visual.aria.palco}
        onPointerDown={baixar}
        onPointerMove={mover}
        onPointerUp={soltar}
        onPointerCancel={soltar}
        data-arrasto-toque={arrastoNoToque ? "sim" : undefined}
        style={{ cursor: "grab", touchAction: arrastoNoToque ? "none" : undefined }}
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
              />
            );
          })}
        </g>
      </svg>
    </div>
  );
}
