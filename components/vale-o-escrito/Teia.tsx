// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import "@/styles/vale-o-escrito.css";
// D3 SÓ AQUI (d3-force) e só chega ao navegador quando alguém abre a visão "Teia" (next/dynamic em Observatorio.tsx).
import { forceCenter, forceCollide, forceLink, forceManyBody, forceSimulation, forceX, forceY, type SimulationLinkDatum, type SimulationNodeDatum } from "d3-force";
import { memo, useEffect, useMemo, useRef, type RefObject } from "react";
import type { TipoDeNo } from "@/lib/vale-o-escrito/tipos";
import { fioDaTeia, limitarEscala, nivelDaTeia, posicaoInicial, rotuloVisivel, sementeDoPar, type ArestaDaTeia, type Grafo, type NivelDaTeia, type NoDaTeia, type Ponto } from "@/lib/vale-o-escrito/visual";
import { NoSvg, raioDoNo, type S } from "./Primitivas";
import { HudDoVisor, useVisor, type Transformacao } from "./Visor";

const L = 1000;
const A = 640;

interface NoSim extends SimulationNodeDatum {
  chave: string;
  raio: number;
}

/**
 * A simulação de força roda inteira, de uma vez, ao montar o grafo, e para: depois disso nada se mexe (os nós não se
 * arrastam nem se pinçam). Determinística: ponto de partida fixo (posicaoInicial) e o sorteio do d3-force com semente
 * própria, então o mesmo grafo dá sempre o mesmo desenho, no servidor de testes e em qualquer navegador.
 *
 * 09/11/2026: os pontos estavam embolados. Agora a repulsão é maior e chega mais longe, os fios são mais compridos e a
 * colisão respeita o tamanho de cada nó (com folga para o halo), então os casos grandes não engolem os vizinhos.
 */
function calcularPosicoes(g: Grafo): Map<string, Ponto> {
  const nos: NoSim[] = g.nos.map((n, i) => ({ chave: n.chave, raio: raioDoNo(n), ...posicaoInicial(i, g.nos.length, L, A) }));
  const ligas: SimulationLinkDatum<NoSim>[] = g.arestas.map((a) => ({ source: a.de, target: a.para }));
  const sim = forceSimulation<NoSim>(nos)
    .force("liga", forceLink<NoSim, SimulationLinkDatum<NoSim>>(ligas).id((d) => d.chave).distance(96).strength(0.45))
    .force("carga", forceManyBody<NoSim>().strength(-340).distanceMax(700))
    .force("centro", forceCenter(L / 2, A / 2))
    .force("x", forceX<NoSim>(L / 2).strength(0.025))
    .force("y", forceY<NoSim>(A / 2).strength(0.04))
    .force("colisao", forceCollide<NoSim>((d) => d.raio + 15).strength(0.9).iterations(2))
    .stop();
  const passos = Math.min(420, 200 + g.nos.length * 2);
  for (let i = 0; i < passos; i++) sim.tick();
  return new Map(nos.map((n) => [n.chave, { x: n.x ?? L / 2, y: n.y ?? A / 2 }]));
}

/** Escala e deslocamento que deixam o desenho inteiro na tela, com folga (a visão de abertura e o botão de recentrar). */
function caber(posicoes: Map<string, Ponto>): Transformacao {
  const ps = [...posicoes.values()];
  if (ps.length === 0) return { k: 1, x: 0, y: 0 };
  const xs = ps.map((p) => p.x);
  const ys = ps.map((p) => p.y);
  const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
  const w = Math.max(maxX - minX, 60), h = Math.max(maxY - minY, 60);
  const k = limitarEscala(Math.min(2.4, Math.min((L * 0.86) / w, (A * 0.86) / h)));
  return { k, x: L / 2 - ((minX + maxX) / 2) * k, y: A / 2 - ((minY + maxY) / 2) * k };
}

/** A escala que o SVG usa para o tamanho dos nós e rótulos: em degraus (¼ de oitava), para o zoom contínuo da roda não redesenhar todos os nós a cada passo. */
const degrau = (k: number) => 2 ** (Math.round(Math.log2(k) * 4) / 4);

const COR: Record<TipoDeNo, string> = { entrada: "255,43,79", pessoa: "255,210,63", organizacao: "124,196,255", lugar: "232,232,224" };

/** Um halo pré-pintado por tipo (gradiente radial num canvas pequeno): desenhar é só copiar a imagem, barato até no celular. */
function halos(): Record<TipoDeNo, HTMLCanvasElement> {
  const feito = {} as Record<TipoDeNo, HTMLCanvasElement>;
  for (const tipo of Object.keys(COR) as TipoDeNo[]) {
    const c = document.createElement("canvas");
    c.width = c.height = 64;
    const ctx = c.getContext("2d");
    if (ctx) {
      const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
      const forte = tipo === "lugar" ? 0.35 : 0.7;
      g.addColorStop(0, `rgba(${COR[tipo]},${forte})`);
      g.addColorStop(0.35, `rgba(${COR[tipo]},${forte * 0.32})`);
      g.addColorStop(1, `rgba(${COR[tipo]},0)`);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, 64, 64);
    }
    feito[tipo] = c;
  }
  return feito;
}

interface Fio {
  aresta: ArestaDaTeia;
  caminho: Path2D;
  /** Pontos da curva (p, c1, c2, q), para as faíscas que correm pelo fio. */
  b: number[];
  mx: number;
  my: number;
  espessura: number;
  opacidade: number;
}

function montarFios(grafo: Grafo, pos: (c: string) => Ponto): Fio[] {
  return grafo.arestas.map((a) => {
    const p = pos(a.de);
    const q = pos(a.para);
    const c = fioDaTeia(p, q, sementeDoPar(a.de, a.para, a.id));
    const n = c.d.match(/-?\d+(?:\.\d+)?/g)?.map(Number) ?? [p.x, p.y, p.x, p.y, q.x, q.y, q.x, q.y];
    return { aresta: a, caminho: new Path2D(c.d), b: n, mx: c.mx, my: c.my, espessura: c.espessura, opacidade: c.opacidade };
  });
}

/** Ponto da Bézier cúbica em t. */
function naCurva(b: number[], t: number): Ponto {
  const u = 1 - t;
  const a = u * u * u, bb = 3 * u * u * t, c = 3 * u * t * t, d = t * t * t;
  return { x: a * b[0] + bb * b[2] + c * b[4] + d * b[6], y: a * b[1] + bb * b[3] + c * b[5] + d * b[7] };
}

/** Estado que o canvas lê a cada quadro (fica num ref: mudar não re-renderiza nada do React). */
interface Cena {
  t: Transformacao;
  fios: Fio[];
  nos: NoDaTeia[];
  pos: (c: string) => Ponto;
  selecionado: string | null;
  vizinhos: Set<string>;
  foraDoDestaque: (c: string) => boolean;
  kq: number;
}

/**
 * O fundo da teia em canvas, como fazem os observatórios grandes (o bl00d.money desenha a rede em canvas): os fios, os
 * pontos de confiança, os halos e as faíscas que correm pelos fios. O SVG por cima fica só com os núcleos e os rótulos,
 * que continuam botões de verdade (teclado, leitor de tela). Pausa fora da tela, com a aba escondida, em "menos
 * movimento" e no modo leve (data-qualidade="baixa"): aí desenha um quadro só, sem faíscas.
 */
function FundoDaTeia({ cena }: { cena: RefObject<Cena> }) {
  const tela = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = tela.current;
    if (!c) return;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    const imgs = halos();
    const calmo = (() => {
      try {
        return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      } catch {
        return false;
      }
    })();
    let w = 0, h = 0, dpr = 1, quadro = 0, naTela = true, ultimo = "";
    const leve = () => c.closest("[data-qualidade]")?.getAttribute("data-qualidade") === "baixa";
    const medir = () => {
      const r = c.getBoundingClientRect();
      dpr = Math.min(2, window.devicePixelRatio || 1);
      w = r.width;
      h = r.height;
      c.width = Math.max(1, Math.round(w * dpr));
      c.height = Math.max(1, Math.round(h * dpr));
      ultimo = "";
    };
    const desenhar = (agora: number) => {
      quadro = 0;
      const k = cena.current;
      if (!k || w === 0) return;
      const animado = !calmo && !leve() && naTela && document.visibilityState === "visible";
      const chave = `${k.t.k},${k.t.x},${k.t.y},${k.selecionado},${k.fios.length},${k.kq}`;
      if (!animado && chave === ultimo) return;
      ultimo = chave;
      // viewBox com preserveAspectRatio "xMidYMid meet": a mesma conta do SVG.
      const s = Math.min(w / L, h / A);
      const ox = (w - L * s) / 2, oy = (h - A * s) / 2;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, c.width, c.height);
      const e = s * k.t.k * dpr;
      ctx.setTransform(e, 0, 0, e, dpr * (ox + s * k.t.x), dpr * (oy + s * k.t.y));
      const sel = k.selecionado;
      const fino = 1 / Math.sqrt(k.kq);
      // 1. Fios
      ctx.lineCap = "round";
      for (const f of k.fios) {
        const a = f.aresta;
        const realce = sel !== null && (a.de === sel || a.para === sel);
        const apagado = (sel !== null && !realce) || (k.foraDoDestaque(a.de) && k.foraDoDestaque(a.para));
        ctx.globalAlpha = apagado ? 0.1 : realce ? 1 : f.opacidade;
        if (realce) {
          ctx.strokeStyle = "#ff6b80";
          ctx.lineWidth = 1.8;
          ctx.setLineDash([6, 4]);
          ctx.lineDashOffset = animado ? -(agora / 90) % 10 : 0;
        } else {
          ctx.strokeStyle = a.implicita ? "#5a2a32" : "#a0606a";
          ctx.lineWidth = (a.implicita ? 0.8 : 1.1) * f.espessura;
          ctx.setLineDash(a.implicita ? [3, 3] : []);
        }
        ctx.stroke(f.caminho);
      }
      ctx.setLineDash([]);
      // 2. Faíscas correndo pelos fios confirmados (o "sangue" da rede)
      if (animado) {
        ctx.globalCompositeOperation = "lighter";
        for (let i = 0; i < k.fios.length; i++) {
          const f = k.fios[i];
          const a = f.aresta;
          const realce = sel !== null && (a.de === sel || a.para === sel);
          if (sel !== null && !realce) continue;
          if (a.implicita && !realce) continue;
          const vel = realce ? 1700 : 4200 + (i % 7) * 600;
          const t = ((agora / vel + i * 0.137) % 1 + 1) % 1;
          const p = naCurva(f.b, t);
          ctx.globalAlpha = realce ? 0.95 : 0.6;
          const r = (realce ? 9 : 6) * fino;
          ctx.drawImage(imgs.entrada, p.x - r, p.y - r, r * 2, r * 2);
        }
        ctx.globalCompositeOperation = "source-over";
      }
      // 3. Pontos de confiança no meio do fio
      for (const f of k.fios) {
        const a = f.aresta;
        if (!a.confianca) continue;
        const realce = sel !== null && (a.de === sel || a.para === sel);
        const apagado = (sel !== null && !realce) || (k.foraDoDestaque(a.de) && k.foraDoDestaque(a.para));
        ctx.globalAlpha = apagado ? 0.1 : 1;
        ctx.beginPath();
        ctx.arc(f.mx, f.my, 2.1 * fino, 0, Math.PI * 2);
        if (a.confianca === "primaria") {
          ctx.fillStyle = "#3ddc97";
          ctx.fill();
        } else {
          ctx.fillStyle = "#050505";
          ctx.fill();
          ctx.strokeStyle = "#8a8a84";
          ctx.lineWidth = 1 / (k.t.k * s);
          ctx.stroke();
        }
      }
      // 4. Halos neon (com uma respiração lenta nos casos quando há movimento)
      ctx.globalCompositeOperation = "lighter";
      for (const n of k.nos) {
        const p = k.pos(n.chave);
        const r = raioDoNo(n) * fino;
        const forca = Math.min(n.grau, 12) / 12;
        const respira = animado && n.tipo === "entrada" ? 1 + 0.08 * Math.sin(agora / 900 + p.x * 0.05) : 1;
        const halo = r * (2.1 + forca * 1.6) * respira;
        const apagado = (sel !== null && !k.vizinhos.has(n.chave)) || k.foraDoDestaque(n.chave);
        ctx.globalAlpha = (apagado ? 0.12 : 0.45 + forca * 0.55) * (n.chave === sel ? 1.4 : 1);
        ctx.drawImage(imgs[n.tipo], p.x - halo, p.y - halo, halo * 2, halo * 2);
      }
      ctx.globalCompositeOperation = "source-over";
      ctx.globalAlpha = 1;
      if (animado) quadro = requestAnimationFrame(desenhar);
    };
    const pedir = () => {
      if (!quadro) quadro = requestAnimationFrame(desenhar);
    };
    medir();
    const ro = new ResizeObserver(() => {
      medir();
      pedir();
    });
    ro.observe(c);
    const io = new IntersectionObserver((es) => {
      naTela = es.some((x) => x.isIntersecting);
      pedir();
    });
    io.observe(c);
    document.addEventListener("visibilitychange", pedir);
    // Quem muda a cena (zoom, arrasto, seleção) avisa por este evento; com animação o laço já redesenha sozinho.
    c.addEventListener("ve-cena", pedir);
    pedir();
    return () => {
      cancelAnimationFrame(quadro);
      ro.disconnect();
      io.disconnect();
      document.removeEventListener("visibilitychange", pedir);
      c.removeEventListener("ve-cena", pedir);
    };
  }, [cena]);
  return <canvas ref={tela} className="ve-teia-fundo" aria-hidden="true" />;
}

/** Os nós em SVG (núcleo e rótulo). Memorizado: arrastar o fundo não redesenha nenhum nó; o zoom só quando muda de degrau. */
const CamadaDeNos = memo(function CamadaDeNos({
  grafo,
  pos,
  s,
  kq,
  nivel,
  selecionado,
  vizinhos,
  destaque,
  tipoDe,
  escolher,
}: {
  grafo: Grafo;
  pos: (c: string) => Ponto;
  s: S;
  kq: number;
  nivel: NivelDaTeia;
  selecionado: string | null;
  vizinhos: Set<string>;
  destaque: TipoDeNo | null;
  tipoDe: Map<string, TipoDeNo>;
  escolher: (c: string) => void;
}) {
  const fora = (c: string) => destaque !== null && tipoDe.get(c) !== destaque;
  return (
    <>
      {(nivel === "caso" || nivel === "detalhe") &&
        grafo.arestas.map((a) => {
          const realce = selecionado !== null && (a.de === selecionado || a.para === selecionado);
          if (!(realce || nivel === "detalhe")) return null;
          if (selecionado !== null && !realce) return null;
          const c = fioDaTeia(pos(a.de), pos(a.para), sementeDoPar(a.de, a.para, a.id));
          return (
            <text key={a.id} className="ve-eixo-texto" x={c.mx} y={c.my - 3} textAnchor="middle" style={{ fontSize: 8 / Math.sqrt(kq) }}>
              {a.situacao ? s.situacao[a.situacao] : (a.rotulo ?? s.visual.ligacao[a.tipo])}
            </text>
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
            escala={kq}
            semHalo
            selecionado={selecionado === n.chave}
            apagado={(selecionado !== null && !vizinhos.has(n.chave)) || fora(n.chave)}
            mostrarRotulo={rotuloVisivel(n.tipo, nivel, selecionado === n.chave || destaque === n.tipo)}
            aoSelecionar={escolher}
          />
        );
      })}
    </>
  );
});

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
  // Toque continua da página (rolar e aproximar com dois dedos como em qualquer página): gestos: false. A roda do mouse,
  // com ou sem Ctrl, aproxima e afasta o desenho (roda: true), e o mouse arrasta o fundo. Aproximada além da abertura,
  // um dedo no fundo também arrasta (só então o SVG pede touch-action: none); os nós continuam parados.
  const { t, svgRef, arrastoNoToque, baixar, mover, soltar, tecla, proximoNivel, recentrar, consumirMexeu } = useVisor(L, A, ajuste, { gestos: false, roda: true });

  const pos = useMemo(() => (chave: string): Ponto => base.get(chave) ?? { x: L / 2, y: A / 2 }, [base]);
  const nivel = nivelDaTeia(t.k);
  const kq = degrau(t.k);
  const fios = useMemo(() => montarFios(grafo, pos), [grafo, pos]);

  // O clique de verdade (sem arrastar o fundo) escolhe o nó. Guardado num ref para a camada memorizada não mudar.
  const escolhaRef = useRef({ consumirMexeu, aoSelecionar });
  useEffect(() => {
    escolhaRef.current = { consumirMexeu, aoSelecionar };
  });
  const escolher = useMemo(
    () => (chave: string) => {
      if (escolhaRef.current.consumirMexeu()) return;
      escolhaRef.current.aoSelecionar(chave);
    },
    [],
  );

  const vizinhos = useMemo(() => {
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

  // A cena do canvas: atualizada a cada render (barato) e avisada por evento, sem re-render nenhum.
  const cena = useRef<Cena>(null as unknown as Cena);
  const caixa = useRef<HTMLDivElement>(null);
  useEffect(() => {
    cena.current = {
      t,
      fios,
      nos: grafo.nos,
      pos,
      selecionado,
      vizinhos,
      foraDoDestaque: (c: string) => destaque !== null && tipoDe.get(c) !== destaque,
      kq,
    };
    caixa.current?.querySelector("canvas")?.dispatchEvent(new Event("ve-cena"));
  });

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
      <div ref={caixa} className="ve-teia-caixa">
        <FundoDaTeia cena={cena} />
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
          <g transform={`translate(${t.x} ${t.y}) scale(${t.k})`}>
            <CamadaDeNos grafo={grafo} pos={pos} s={s} kq={kq} nivel={nivel} selecionado={selecionado} vizinhos={vizinhos} destaque={destaque} tipoDe={tipoDe} escolher={escolher} />
          </g>
        </svg>
      </div>
    </div>
  );
}
