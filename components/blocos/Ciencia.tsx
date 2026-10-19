// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { fill } from "@/i18n/config";
import type { Body as CorpoMatter, IConstraintDefinition } from "matter-js";
import { anguloEm, areaDoPoligono, distancia, lerGeometria, lerMolecula, lerSimulacao, MUNDO, posicoesDaGeometria } from "@/lib/interativos-mais";
import { COR_DO_ELEMENTO, formula, moleculaDe, NOME_DO_ELEMENTO, raioCovalente } from "@/lib/moleculas";
import { useI18n } from "../I18n";

// Simulação física (Matter.js, baixado só quando o bloco aparece), molécula em 3D (desenho próprio, sem biblioteca)
// e construção geométrica com pontos que se arrastam. Tudo roda no aparelho de quem estuda.

const caixa = "no-print my-6 border-l-2 border-gold bg-parchment-deep p-4 font-sans text-sm";
const botao = "cursor-pointer bg-ink px-4 py-2 font-medium text-parchment hover:bg-oxblood disabled:cursor-not-allowed disabled:opacity-50";
const claro = "cursor-pointer border-2 border-ink px-3 py-1 font-medium hover:border-oxblood hover:text-oxblood";
const movimentoReduzido = () => typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
const formatador = (lang: string) => new Intl.NumberFormat(lang === "zh" ? "zh-CN" : lang, { maximumFractionDigits: 2 });

// ───────────── Simulação física ─────────────

/** Pixels por metro no desenho: o mundo de 16 m × 9 m vira um quadro de 800 × 450. */
const PX = 50;
const LARGURA = MUNDO.largura * PX;
const ALTURA = MUNDO.altura * PX;

export function Simulacao({ spec }: { spec: string }) {
  const { t, lang } = useI18n();
  const cena = useMemo(() => lerSimulacao(spec), [spec]);
  const tela = useRef<HTMLCanvasElement>(null);
  const [rodando, setRodando] = useState(false);
  const [lento, setLento] = useState(false);
  const [rodada, setRodada] = useState(0);
  const [leituras, setLeituras] = useState<{ nome: string; altura: number; velocidade: number }[]>([]);
  const [tempo, setTempo] = useState(0);
  const [falhou, setFalhou] = useState(false);
  const controle = useRef({ rodando: false, lento: false });
  useEffect(() => {
    controle.current = { rodando, lento };
  }, [rodando, lento]);
  const num = formatador(lang);

  useEffect(() => {
    let vivo = true;
    let quadro = 0;
    let desligar = () => {};
    void import("matter-js")
      .then((modulo) => {
        if (!vivo || !tela.current) return;
        const M = (modulo as unknown as { default?: typeof import("matter-js") }).default ?? modulo;
        const { Bodies, Body, Composite, Constraint, Engine, Mouse, MouseConstraint } = M;
        const canvas = tela.current;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        const motor = Engine.create();
        motor.gravity.y = (cena.gravidade * PX) / 1000;
        const mundo = motor.world;
        const tinta = getComputedStyle(canvas).color || "#1f1f1f";
        const tela2y = (y: number) => ALTURA - y * PX;
        if (cena.chao) Composite.add(mundo, Bodies.rectangle(LARGURA / 2, ALTURA + 25, LARGURA * 3, 50, { isStatic: true, friction: 0.5, label: "chao" }));
        if (cena.paredes) {
          Composite.add(mundo, Bodies.rectangle(-25, ALTURA / 2 - ALTURA, 50, ALTURA * 4, { isStatic: true, label: "parede" }));
          Composite.add(mundo, Bodies.rectangle(LARGURA + 25, ALTURA / 2 - ALTURA, 50, ALTURA * 4, { isStatic: true, label: "parede" }));
        }
        const nomeados: { nome: string; corpo: CorpoMatter }[] = [];
        const pendulos: { ponto: { x: number; y: number }; corpo: CorpoMatter }[] = [];
        for (const c of cena.corpos) {
          const opcoes = { restitution: c.quique, friction: c.atrito, frictionAir: 0.002, isStatic: c.fixo, render: { fillStyle: c.cor }, label: c.nome };
          let corpo: CorpoMatter;
          if (c.tipo === "bola") corpo = Bodies.circle(c.x * PX, tela2y(c.y), c.raio * PX, opcoes);
          else if (c.tipo === "caixa") corpo = Bodies.rectangle(c.x * PX, tela2y(c.y), c.largura * PX, c.altura * PX, { ...opcoes, angle: (-c.angulo * Math.PI) / 180 });
          else if (c.tipo === "rampa") {
            const [x1, y1, x2, y2] = [c.x * PX, tela2y(c.y), c.x2 * PX, tela2y(c.y2)];
            corpo = Bodies.rectangle((x1 + x2) / 2, (y1 + y2) / 2, Math.hypot(x2 - x1, y2 - y1), 0.16 * PX, { ...opcoes, isStatic: true, angle: Math.atan2(y2 - y1, x2 - x1) });
          } else {
            const teta = (c.angulo * Math.PI) / 180;
            const ponto = { x: c.x * PX, y: tela2y(c.y) };
            corpo = Bodies.circle(ponto.x + Math.sin(teta) * c.comprimento * PX, ponto.y + Math.cos(teta) * c.comprimento * PX, c.raio * PX, { ...opcoes, frictionAir: 0, restitution: 0.9 });
            Composite.add(mundo, Constraint.create({ pointA: ponto, bodyB: corpo, length: c.comprimento * PX, stiffness: 1 }));
            pendulos.push({ ponto, corpo });
          }
          if (c.massa && !c.fixo && c.tipo !== "rampa") Body.setMass(corpo, c.massa);
          if ((c.vx || c.vy) && !c.fixo) Body.setVelocity(corpo, { x: (c.vx * PX) / 60, y: (-c.vy * PX) / 60 });
          Composite.add(mundo, corpo);
          if (c.nome) nomeados.push({ nome: c.nome, corpo });
        }
        // Arrastar os objetos com o mouse ou o dedo; a roda do mouse continua rolando a página.
        const mouse = Mouse.create(canvas);
        const m = mouse as unknown as { mousewheel?: EventListener };
        if (m.mousewheel) {
          canvas.removeEventListener("wheel", m.mousewheel);
          canvas.removeEventListener("mousewheel", m.mousewheel);
          canvas.removeEventListener("DOMMouseScroll", m.mousewheel);
        }
        Composite.add(mundo, MouseConstraint.create(motor, { mouse, constraint: { stiffness: 0.2, render: { visible: false } } as IConstraintDefinition }));

        let decorrido = 0;
        let ultimaLeitura = 0;
        const desenhar = () => {
          const r = canvas.getBoundingClientRect();
          if (r.width) Mouse.setScale(mouse, { x: LARGURA / r.width, y: ALTURA / r.height });
          ctx.clearRect(0, 0, LARGURA, ALTURA);
          // Grade de 1 m, com os números nas bordas para medir.
          ctx.strokeStyle = "rgba(127,127,127,0.18)";
          ctx.lineWidth = 1;
          ctx.fillStyle = "rgba(127,127,127,0.8)";
          ctx.font = "11px Inter, system-ui, sans-serif";
          for (let x = 0; x <= MUNDO.largura; x++) {
            ctx.beginPath();
            ctx.moveTo(x * PX, 0);
            ctx.lineTo(x * PX, ALTURA);
            ctx.stroke();
            if (x % 2 === 0) ctx.fillText(`${x}`, x * PX + 2, ALTURA - 4);
          }
          for (let y = 0; y <= MUNDO.altura; y++) {
            ctx.beginPath();
            ctx.moveTo(0, tela2y(y));
            ctx.lineTo(LARGURA, tela2y(y));
            ctx.stroke();
            if (y > 0 && y % 2 === 0) ctx.fillText(`${y} m`, 3, tela2y(y) + 12);
          }
          for (const p of pendulos) {
            ctx.strokeStyle = tinta;
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(p.ponto.x, p.ponto.y);
            ctx.lineTo(p.corpo.position.x, p.corpo.position.y);
            ctx.stroke();
            ctx.fillStyle = tinta;
            ctx.fillRect(p.ponto.x - 4, p.ponto.y - 4, 8, 8);
          }
          for (const corpo of Composite.allBodies(mundo)) {
            if (corpo.label === "chao" || corpo.label === "parede") continue;
            ctx.fillStyle = corpo.render.fillStyle && corpo.render.fillStyle !== "" ? corpo.render.fillStyle : tinta;
            ctx.strokeStyle = tinta;
            ctx.lineWidth = 2;
            ctx.beginPath();
            if (corpo.circleRadius) {
              ctx.arc(corpo.position.x, corpo.position.y, corpo.circleRadius, 0, Math.PI * 2);
              ctx.fill();
              ctx.stroke();
              // Um raio desenhado mostra a bola girando.
              ctx.beginPath();
              ctx.moveTo(corpo.position.x, corpo.position.y);
              ctx.lineTo(corpo.position.x + Math.cos(corpo.angle) * corpo.circleRadius, corpo.position.y + Math.sin(corpo.angle) * corpo.circleRadius);
              ctx.strokeStyle = "rgba(255,255,255,0.8)";
              ctx.stroke();
            } else {
              corpo.vertices.forEach((v, i) => (i ? ctx.lineTo(v.x, v.y) : ctx.moveTo(v.x, v.y)));
              ctx.closePath();
              if (corpo.isStatic) ctx.fillStyle = "rgba(120,110,95,0.85)";
              ctx.fill();
              ctx.stroke();
            }
            if (corpo.label) {
              ctx.fillStyle = tinta;
              ctx.font = "bold 13px Inter, system-ui, sans-serif";
              ctx.fillText(corpo.label, corpo.position.x + (corpo.circleRadius ?? 10) + 4, corpo.position.y - (corpo.circleRadius ?? 10) - 2);
            }
          }
          if (cena.chao) {
            ctx.fillStyle = tinta;
            ctx.fillRect(0, ALTURA - 2, LARGURA, 2);
          }
        };
        const passo = () => {
          if (!vivo) return;
          if (controle.current.rodando) {
            motor.timing.timeScale = controle.current.lento ? 0.25 : 1;
            Engine.update(motor, 1000 / 60);
            decorrido += (1 / 60) * motor.timing.timeScale;
            if (decorrido - ultimaLeitura > 0.1) {
              ultimaLeitura = decorrido;
              setTempo(decorrido);
              setLeituras(cena.mostrar.map((nome) => {
                const achado = nomeados.find((x) => x.nome.toLowerCase() === nome.toLowerCase());
                return achado ? { nome: achado.nome, altura: (ALTURA - achado.corpo.position.y) / PX, velocidade: (achado.corpo.speed * 60) / PX } : { nome, altura: NaN, velocidade: NaN };
              }));
            }
          }
          desenhar();
          quadro = requestAnimationFrame(passo);
        };
        quadro = requestAnimationFrame(passo);
        desligar = () => {
          cancelAnimationFrame(quadro);
          Mouse.clearSourceEvents(mouse);
          Engine.clear(motor);
        };
      })
      .catch(() => vivo && setFalhou(true));
    return () => {
      vivo = false;
      desligar();
    };
  }, [cena, rodada]);

  if (!cena.corpos.length) return <pre className="text-sm">{spec}</pre>;
  const descricao = cena.corpos.map((c) => `${c.nome || c.tipo}`).join(", ");
  return (
    <figure className={caixa}>
      <canvas ref={tela} width={LARGURA} height={ALTURA} role="img" aria-label={`${t.blocks.simulation}: ${descricao}`} className="w-full touch-none border-2 border-ink bg-parchment text-ink" />
      {falhou && <p className="mt-2 text-oxblood">{t.blocks.failed}</p>}
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <button type="button" className={botao} onClick={() => setRodando((r) => !r)}>{rodando ? t.blocks.pause : t.blocks.run}</button>
        <button type="button" className={claro} onClick={() => { setRodando(false); setTempo(0); setLeituras([]); setRodada((r) => r + 1); }}>{t.blocks.restart}</button>
        <label className="flex items-center gap-2 text-xs">
          <input type="checkbox" checked={lento} onChange={(e) => setLento(e.target.checked)} className="accent-[var(--oxblood)]" />
          {t.blocks.slowMotion}
        </label>
        <span className="font-mono text-xs" aria-live="off">t = {num.format(tempo)} s</span>
      </div>
      {leituras.length > 0 && (
        <ul className="mt-2 space-y-0.5 font-mono text-xs" aria-live="off">
          {leituras.map((l) => (
            <li key={l.nome}>{Number.isFinite(l.altura) ? fill(t.blocks.reading, { nome: l.nome, h: num.format(l.altura), v: num.format(l.velocidade) }) : l.nome}</li>
          ))}
        </ul>
      )}
      <figcaption className="mt-1 text-xs text-ink-soft">{fill(t.blocks.simulationHint, { g: num.format(cena.gravidade) })}</figcaption>
    </figure>
  );
}

// ───────────── Molécula em 3D ─────────────

/** Raios de van der Waals (Å), para o modelo de esferas que se encostam. */
const VDW: Record<string, number> = { H: 1.1, C: 1.7, N: 1.55, O: 1.52, F: 1.47, Cl: 1.75, Br: 1.85, I: 1.98, S: 1.8, P: 1.8, Na: 2.27, K: 2.75, B: 1.92, Si: 2.1, Xe: 2.16, Mg: 1.73, Ca: 2.31 };

function clarear(cor: string, quanto: number) {
  const n = parseInt(cor.slice(1), 16);
  const canal = (c: number) => Math.max(0, Math.min(255, Math.round(c + (quanto > 0 ? (255 - c) * quanto : c * quanto))));
  return `rgb(${canal(n >> 16)}, ${canal((n >> 8) & 255)}, ${canal(n & 255)})`;
}

export function Molecula({ spec }: { spec: string }) {
  const { t, lang } = useI18n();
  const dados = useMemo(() => lerMolecula(spec), [spec]);
  const resultado = useMemo(() => moleculaDe(dados.entrada, dados.xyz), [dados]);
  const tela = useRef<HTMLCanvasElement>(null);
  const giro = useRef({ yaw: 0.6, pitch: -0.35, arrastando: false, x: 0, y: 0 });
  const [sozinha, setSozinha] = useState(() => !movimentoReduzido());
  const [estilo, setEstilo] = useState(dados.estilo);
  const [rotulos, setRotulos] = useState(dados.rotulos);
  const opcoes = useRef({ sozinha, estilo, rotulos });
  useEffect(() => {
    opcoes.current = { sozinha, estilo, rotulos };
  }, [sozinha, estilo, rotulos]);

  useEffect(() => {
    const canvas = tela.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx || !resultado) return;
    const { atomos, ligacoes } = resultado.mol;
    const alcance = Math.max(1.5, ...atomos.map((a) => Math.hypot(a.x, a.y, a.z) + 0.8));
    let quadro = 0;
    const desenhar = () => {
      const { yaw, pitch } = giro.current;
      const [cy, sy, cp, sp] = [Math.cos(yaw), Math.sin(yaw), Math.cos(pitch), Math.sin(pitch)];
      const W = canvas.width;
      const H = canvas.height;
      const escala = (Math.min(W, H) * 0.56) / alcance;
      const foco = alcance * 4;
      const projetado = atomos.map((a) => {
        const x1 = a.x * cy + a.z * sy;
        const z1 = -a.x * sy + a.z * cy;
        const y2 = a.y * cp - z1 * sp;
        const z2 = a.y * sp + z1 * cp;
        const p = foco / (foco + z2);
        return { x: W / 2 + x1 * escala * p, y: H / 2 - y2 * escala * p, z: z2, p };
      });
      const { estilo: e, rotulos: r } = opcoes.current;
      const raioNaTela = (i: number) => {
        const el = atomos[i].el;
        const base = e === "bolas" ? (VDW[el] ?? 1.8) * 0.95 : el === "H" ? 0.28 : Math.min(0.55, 0.22 + raioCovalente(el) * 0.3);
        return base * escala * projetado[i].p;
      };
      type Item = { z: number; desenhar: () => void };
      const itens: Item[] = [];
      if (e !== "bolas") {
        for (const l of ligacoes) {
          const [a, b] = [projetado[l.a], projetado[l.b]];
          itens.push({
            z: (a.z + b.z) / 2,
            desenhar: () => {
              const dx = b.x - a.x;
              const dy = b.y - a.y;
              const L = Math.hypot(dx, dy) || 1;
              const [nx, ny] = [-dy / L, dx / L];
              const larg = Math.max(2, 0.13 * escala * ((a.p + b.p) / 2));
              const linhas = l.ordem === 3 ? [-1, 0, 1] : l.ordem === 2 || l.ordem === 1.5 ? [-0.5, 0.5] : [0];
              const sep = larg * 1.5;
              linhas.forEach((k, idx) => {
                const [ox, oy] = [nx * k * sep, ny * k * sep];
                for (const [de, ate, cor] of [[a, { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }, atomos[l.a].el], [{ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }, b, atomos[l.b].el]] as const) {
                  ctx.strokeStyle = clarear(COR_DO_ELEMENTO[cor] ?? "#c0c0c0", -0.15);
                  ctx.lineWidth = linhas.length > 1 ? larg * 0.75 : larg;
                  ctx.setLineDash(l.ordem === 1.5 && idx === 1 ? [larg, larg] : []);
                  ctx.beginPath();
                  ctx.moveTo(de.x + ox, de.y + oy);
                  ctx.lineTo(ate.x + ox, ate.y + oy);
                  ctx.stroke();
                }
              });
              ctx.setLineDash([]);
            },
          });
        }
      }
      atomos.forEach((a, i) => {
        const p = projetado[i];
        itens.push({
          z: p.z,
          desenhar: () => {
            const raio = raioNaTela(i);
            const cor = COR_DO_ELEMENTO[a.el] ?? "#ff69b4";
            const g = ctx.createRadialGradient(p.x - raio * 0.35, p.y - raio * 0.35, raio * 0.1, p.x, p.y, raio);
            g.addColorStop(0, clarear(cor, 0.7));
            g.addColorStop(0.6, cor);
            g.addColorStop(1, clarear(cor, -0.45));
            ctx.fillStyle = g;
            ctx.beginPath();
            ctx.arc(p.x, p.y, raio, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = "rgba(0,0,0,0.25)";
            ctx.lineWidth = 1;
            ctx.stroke();
            if (r) {
              const escuro = ["H", "F", "Cl", "S", "B"].includes(a.el);
              ctx.fillStyle = escuro ? "#1f1f1f" : "#ffffff";
              ctx.font = `bold ${Math.max(10, Math.round(raio * 0.9))}px Inter, system-ui, sans-serif`;
              ctx.textAlign = "center";
              ctx.textBaseline = "middle";
              ctx.fillText(a.el, p.x, p.y + 1);
            }
          },
        });
      });
      ctx.clearRect(0, 0, W, H);
      // Mais longe primeiro, para os átomos da frente cobrirem os de trás.
      itens.sort((x, y) => y.z - x.z).forEach((item) => item.desenhar());
    };
    const animar = () => {
      if (opcoes.current.sozinha && !giro.current.arrastando) giro.current.yaw += 0.008;
      desenhar();
      quadro = requestAnimationFrame(animar);
    };
    quadro = requestAnimationFrame(animar);
    return () => cancelAnimationFrame(quadro);
  }, [resultado]);

  if (!resultado) return <pre className="text-sm">{spec}</pre>;
  const contagem = resultado.mol.atomos.reduce<Record<string, number>>((c, a) => ({ ...c, [a.el]: (c[a.el] ?? 0) + 1 }), {});
  const titulo = dados.titulo || resultado.nome || dados.entrada;
  const f = formula(resultado.mol);
  return (
    <figure className={caixa}>
      <p className="font-serif text-lg">
        {titulo && <span className="first-letter:uppercase">{titulo} · </span>}
        <span className="font-mono">{f}</span>
      </p>
      <canvas
        ref={tela}
        width={720}
        height={420}
        tabIndex={0}
        role="img"
        aria-label={`${t.blocks.molecule}: ${titulo} (${f}). ${resultado.nota}`}
        className="mt-2 w-full cursor-grab touch-none border-2 border-ink bg-parchment text-ink focus:outline-2 focus:outline-oxblood active:cursor-grabbing"
        onPointerDown={(e) => {
          giro.current = { ...giro.current, arrastando: true, x: e.clientX, y: e.clientY };
          e.currentTarget.setPointerCapture(e.pointerId);
        }}
        onPointerMove={(e) => {
          const g = giro.current;
          if (!g.arrastando) return;
          g.yaw += (e.clientX - g.x) * 0.01;
          g.pitch = Math.max(-1.5, Math.min(1.5, g.pitch + (e.clientY - g.y) * 0.01));
          g.x = e.clientX;
          g.y = e.clientY;
        }}
        onPointerUp={() => (giro.current.arrastando = false)}
        onKeyDown={(e) => {
          const g = giro.current;
          const passo = { ArrowLeft: [-0.15, 0], ArrowRight: [0.15, 0], ArrowUp: [0, -0.15], ArrowDown: [0, 0.15] }[e.key];
          if (!passo) return;
          e.preventDefault();
          g.yaw += passo[0];
          g.pitch = Math.max(-1.5, Math.min(1.5, g.pitch + passo[1]));
        }}
      />
      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs">
        <label className="flex items-center gap-1.5"><input type="checkbox" checked={sozinha} onChange={(e) => setSozinha(e.target.checked)} className="accent-[var(--oxblood)]" />{t.blocks.autoRotate}</label>
        <label className="flex items-center gap-1.5"><input type="checkbox" checked={rotulos} onChange={(e) => setRotulos(e.target.checked)} className="accent-[var(--oxblood)]" />{t.blocks.atomLabels}</label>
        <span className="flex gap-1" role="group" aria-label={t.blocks.modelStyle}>
          <button type="button" aria-pressed={estilo === "bastoes"} onClick={() => setEstilo("bastoes")} className={`${claro} ${estilo === "bastoes" ? "bg-ink text-parchment" : ""}`}>{t.blocks.ballAndStick}</button>
          <button type="button" aria-pressed={estilo === "bolas"} onClick={() => setEstilo("bolas")} className={`${claro} ${estilo === "bolas" ? "bg-ink text-parchment" : ""}`}>{t.blocks.spaceFilling}</button>
        </span>
        <span className="text-ink-soft">{t.blocks.rotateHint}</span>
      </div>
      <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs" aria-label={t.blocks.atoms}>
        {Object.entries(contagem).map(([el, n]) => (
          <li key={el} className="flex items-center gap-1.5">
            <span className="inline-block h-3 w-3 rounded-full border border-ink/30" style={{ background: COR_DO_ELEMENTO[el] ?? "#ff69b4" }} aria-hidden />
            {el} {lang === "pt" && NOME_DO_ELEMENTO[el] ? `(${NOME_DO_ELEMENTO[el]})` : ""} × {n}
          </li>
        ))}
      </ul>
      {resultado.nota && <figcaption className="mt-2 text-ink-soft">{resultado.nota}</figcaption>}
    </figure>
  );
}

// ───────────── Geometria ─────────────

const VW = 640;

export function Geometria({ spec }: { spec: string }) {
  const { t, lang } = useI18n();
  const geo = useMemo(() => lerGeometria(spec), [spec]);
  const [movidos, setMovidos] = useState<Record<string, { x: number; y: number }>>({});
  const arrastando = useRef<string | null>(null);
  const svg = useRef<SVGSVGElement>(null);
  const num = formatador(lang);
  const pos = useMemo(() => posicoesDaGeometria(geo, movidos), [geo, movidos]);

  const [x0, x1] = geo.x;
  const escala = VW / (x1 - x0);
  const ys = geo.pontos.map((p) => p.y);
  const [y0, y1] = geo.y ?? (() => {
    const base = ys.length ? Math.min(...ys) - 1 : x0;
    return [base, base + (x1 - x0) * 0.62];
  })();
  const VH = Math.max(160, Math.min(900, (y1 - y0) * escala));
  const X = (x: number) => (x - x0) * escala;
  const Y = (y: number) => VH - (y - y0) * escala;
  if (!geo.pontos.length) return <pre className="text-sm">{spec}</pre>;

  const paraMundo = (e: React.PointerEvent) => {
    const m = svg.current?.getScreenCTM();
    if (!m) return null;
    const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(m.inverse());
    const passo = geo.passo || 0;
    const ajusta = (v: number) => (passo ? Math.round(v / passo) * passo : v);
    return { x: Math.max(x0, Math.min(x1, ajusta(p.x / escala + x0))), y: Math.max(y0, Math.min(y1, ajusta((VH - p.y) / escala + y0))) };
  };
  /** Reta e semirreta vão até a borda do quadro. */
  const prolongar = (a: { x: number; y: number }, b: { x: number; y: number }, dosDois: boolean) => {
    const d = { x: b.x - a.x, y: b.y - a.y };
    const L = Math.hypot(d.x, d.y) || 1;
    const longe = (x1 - x0 + (y1 - y0)) * 2;
    const fim = { x: a.x + (d.x / L) * longe, y: a.y + (d.y / L) * longe };
    const inicio = dosDois ? { x: a.x - (d.x / L) * longe, y: a.y - (d.y / L) * longe } : a;
    return [inicio, fim];
  };
  const medidas: string[] = [];
  const desenho: React.ReactNode[] = [];
  geo.objetos.forEach((o, k) => {
    const ps = o.refs.map((r) => pos[r]).filter(Boolean);
    if (ps.length !== o.refs.length) return;
    if (o.tipo === "segmento" || o.tipo === "vetor") {
      desenho.push(<line key={k} x1={X(ps[0].x)} y1={Y(ps[0].y)} x2={X(ps[1].x)} y2={Y(ps[1].y)} stroke="currentColor" strokeWidth={2.5} markerEnd={o.tipo === "vetor" ? "url(#seta-geo)" : undefined} />);
    } else if (o.tipo === "reta" || o.tipo === "semirreta") {
      const [a, b] = prolongar(ps[0], ps[1], o.tipo === "reta");
      desenho.push(<line key={k} x1={X(a.x)} y1={Y(a.y)} x2={X(b.x)} y2={Y(b.y)} stroke="currentColor" strokeWidth={2} />);
    } else if (o.tipo === "circulo") {
      const r = o.raio ?? distancia(ps[0], ps[1]);
      desenho.push(<circle key={k} cx={X(ps[0].x)} cy={Y(ps[0].y)} r={r * escala} fill="none" stroke="var(--oxblood)" strokeWidth={2.5} />);
      medidas.push(`${t.blocks.radius} (${o.refs[0]}) = ${num.format(r)}`);
    } else if (o.tipo === "poligono") {
      desenho.push(<polygon key={k} points={ps.map((p) => `${X(p.x)},${Y(p.y)}`).join(" ")} fill="var(--gold)" fillOpacity={0.25} stroke="currentColor" strokeWidth={2.5} />);
      medidas.push(`${t.blocks.area} (${o.refs.join("")}) = ${num.format(areaDoPoligono(ps))}`);
    } else if (o.tipo === "angulo") {
      const [a, v, b] = ps;
      const graus = anguloEm(a, v, b);
      const r = 0.9;
      const ua = Math.atan2(a.y - v.y, a.x - v.x);
      const ub = Math.atan2(b.y - v.y, b.x - v.x);
      let delta = ub - ua;
      while (delta > Math.PI) delta -= 2 * Math.PI;
      while (delta < -Math.PI) delta += 2 * Math.PI;
      const fim = ua + delta;
      const arco = `M ${X(v.x + r * Math.cos(ua))} ${Y(v.y + r * Math.sin(ua))} A ${r * escala} ${r * escala} 0 0 ${delta > 0 ? 0 : 1} ${X(v.x + r * Math.cos(fim))} ${Y(v.y + r * Math.sin(fim))}`;
      const meio = ua + delta / 2;
      desenho.push(
        <g key={k}>
          <path d={arco} fill="none" stroke="var(--oxblood)" strokeWidth={2} />
          <text x={X(v.x + (r + 0.55) * Math.cos(meio))} y={Y(v.y + (r + 0.55) * Math.sin(meio))} textAnchor="middle" dominantBaseline="middle" className="fill-oxblood font-mono text-[13px]">{num.format(graus)}°</text>
        </g>,
      );
      medidas.push(`∠${o.refs.join("")} = ${num.format(graus)}°`);
    } else if (o.tipo === "distancia") {
      const d = distancia(ps[0], ps[1]);
      desenho.push(<text key={k} x={X((ps[0].x + ps[1].x) / 2)} y={Y((ps[0].y + ps[1].y) / 2) - 8} textAnchor="middle" className="fill-current font-mono text-[13px]">{num.format(d)}</text>);
      medidas.push(`${o.refs.join("")} = ${num.format(d)}`);
    }
  });
  const grade: React.ReactNode[] = [];
  if (geo.grade && x1 - x0 <= 60) {
    for (let x = Math.ceil(x0); x <= x1; x++) grade.push(<line key={`gx${x}`} x1={X(x)} y1={0} x2={X(x)} y2={VH} stroke="currentColor" strokeOpacity={x === 0 ? 0.6 : 0.12} />);
    for (let y = Math.ceil(y0); y <= y1; y++) grade.push(<line key={`gy${y}`} x1={0} y1={Y(y)} x2={VW} y2={Y(y)} stroke="currentColor" strokeOpacity={y === 0 ? 0.6 : 0.12} />);
  }
  return (
    <figure className={caixa}>
      <svg
        ref={svg}
        viewBox={`0 0 ${VW} ${VH}`}
        role="img"
        aria-label={`${t.blocks.geometry}: ${medidas.join("; ")}`}
        className="w-full touch-none select-none border-2 border-ink bg-parchment text-ink"
        onPointerMove={(e) => {
          if (!arrastando.current) return;
          const p = paraMundo(e);
          const nome = arrastando.current;
          if (p) setMovidos((m) => ({ ...m, [nome]: p }));
        }}
        onPointerUp={() => (arrastando.current = null)}
        onPointerLeave={() => (arrastando.current = null)}
      >
        <defs>
          <marker id="seta-geo" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
            <path d="M 0 0 L 10 5 L 0 10 z" fill="currentColor" />
          </marker>
        </defs>
        {grade}
        {desenho}
        {geo.pontos.map((p) => {
          const q = pos[p.nome];
          if (!q) return null;
          const livre = p.tipo === "livre";
          return (
            <g key={p.nome}>
              {livre && (
                <circle
                  cx={X(q.x)}
                  cy={Y(q.y)}
                  r={16}
                  fill="transparent"
                  className="cursor-grab"
                  tabIndex={0}
                  role="button"
                  aria-label={`${p.nome} (${num.format(q.x)}; ${num.format(q.y)})`}
                  onPointerDown={(e) => {
                    arrastando.current = p.nome;
                    (e.currentTarget.ownerSVGElement ?? e.currentTarget).setPointerCapture?.(e.pointerId);
                  }}
                  onKeyDown={(e) => {
                    const passo = geo.passo || 0.5;
                    const d = { ArrowLeft: [-passo, 0], ArrowRight: [passo, 0], ArrowUp: [0, passo], ArrowDown: [0, -passo] }[e.key];
                    if (!d) return;
                    e.preventDefault();
                    setMovidos((m) => ({ ...m, [p.nome]: { x: Math.max(x0, Math.min(x1, q.x + d[0])), y: Math.max(y0, Math.min(y1, q.y + d[1])) } }));
                  }}
                />
              )}
              <circle cx={X(q.x)} cy={Y(q.y)} r={livre ? 7 : 5} fill={livre ? "var(--oxblood)" : "currentColor"} stroke="var(--parchment)" strokeWidth={2} pointerEvents="none" />
              <text x={X(q.x) + 9} y={Y(q.y) - 9} className="fill-current font-serif text-[15px] font-semibold" pointerEvents="none">{p.nome}</text>
            </g>
          );
        })}
      </svg>
      <div className="mt-2 flex flex-wrap items-center gap-3">
        {medidas.length > 0 && <p className="font-mono text-xs" aria-live="polite">{medidas.join(" · ")}</p>}
        {Object.keys(movidos).length > 0 && <button type="button" className={claro} onClick={() => setMovidos({})}>{t.blocks.restart}</button>}
      </div>
      <figcaption className="mt-1 text-xs text-ink-soft">{t.blocks.dragPoints}</figcaption>
    </figure>
  );
}
